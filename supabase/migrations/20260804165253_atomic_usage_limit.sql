-- Closes a quota-bypass race in the chat endpoint: the old flow read the current usage
-- count, compared it to the plan limit, and only wrote the incremented count *after* the
-- full Gemini stream finished generating (seconds later). Concurrent requests from the same
-- user all read the same pre-increment count and could all pass the check, so the monthly
-- limit could be bypassed by however many requests were kept in flight at once.
--
-- try_increment_usage replaces increment_usage: the limit check and the increment now
-- happen in a single upsert, serialized by Postgres's row lock on the (user_id, month)
-- row, so concurrent requests genuinely queue against the limit instead of racing past it.
-- It's meant to be called to *reserve* a slot before generation starts.
create or replace function public.try_increment_usage(p_user_id uuid, p_limit integer)
returns integer -- new count if the reservation succeeded, null if the limit was already hit
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_month text := to_char(now(), 'YYYY-MM');
  v_count integer;
begin
  insert into public.usage (user_id, month, count, updated_at)
  values (p_user_id, v_month, 1, now())
  on conflict (user_id, month) do update
    set count = public.usage.count + 1, updated_at = now()
    where p_limit is null or public.usage.count < p_limit
  returning count into v_count;

  return v_count;
end;
$$;

revoke all on function public.try_increment_usage(uuid, integer) from public, anon, authenticated;
grant execute on function public.try_increment_usage(uuid, integer) to service_role;

-- Compensating rollback for try_increment_usage: called when a reserved slot turns out not
-- to have produced billable output (conversation not found, Gemini call failed, stream
-- errored out before completion), so failed attempts don't permanently eat into the quota.
create or replace function public.release_usage(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_month text := to_char(now(), 'YYYY-MM');
begin
  update public.usage
  set count = greatest(count - 1, 0), updated_at = now()
  where user_id = p_user_id and month = v_month;
end;
$$;

revoke all on function public.release_usage(uuid) from public, anon, authenticated;
grant execute on function public.release_usage(uuid) to service_role;

-- Superseded by try_increment_usage above (limit check + increment must be one atomic
-- statement to close the race); nothing else calls it.
drop function public.increment_usage(uuid);
