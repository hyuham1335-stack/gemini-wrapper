create table public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  polar_customer_id text,
  polar_subscription_id text unique,
  plan text not null default 'free' check (plan in ('free', 'pro', 'unlimited')),
  status text not null default 'active' check (status in ('active', 'past_due', 'revoked')),
  cancel_at_period_end boolean not null default false,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.subscriptions enable row level security;
create policy "Users can read their own subscription" on public.subscriptions
  for select using (auth.uid() = user_id);

create table public.usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  month text not null, -- 'YYYY-MM', computed server-side only (see increment_usage), never client-supplied
  count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, month)
);
alter table public.usage enable row level security;
create policy "Users can read their own usage" on public.usage
  for select using (auth.uid() = user_id);

-- Webhook idempotency ledger + raw payload audit log. RLS enabled with zero policies = fully
-- denied to anon/authenticated roles; only the service role (which bypasses RLS) can touch it.
create table public.webhook_events (
  id text primary key, -- Polar's `webhook-id` header
  event_type text not null,
  payload jsonb not null,
  received_at timestamptz not null default now()
);
alter table public.webhook_events enable row level security;

-- Atomic monthly usage increment. EXECUTE is restricted to service_role so a browser client
-- can never call this directly to inflate or reset another user's count.
create or replace function public.increment_usage(p_user_id uuid)
returns integer
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
  on conflict (user_id, month)
  do update set count = public.usage.count + 1, updated_at = now()
  returning count into v_count;

  return v_count;
end;
$$;

revoke all on function public.increment_usage(uuid) from public;
grant execute on function public.increment_usage(uuid) to service_role;

-- Auto-grant Free plan on signup (DB-internal only, no Polar call involved).
create or replace function public.handle_new_user_subscription()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.subscriptions (user_id, plan, status)
  values (new.id, 'free', 'active')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created_subscription
  after insert on auth.users
  for each row execute function public.handle_new_user_subscription();

-- Backfill existing users who signed up before this migration.
insert into public.subscriptions (user_id, plan, status)
select id, 'free', 'active' from auth.users
on conflict (user_id) do nothing;
