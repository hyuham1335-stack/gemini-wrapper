-- profiles: PII (email, full_name) is encrypted app-side (see lib/encryption.ts) before
-- being written here. *_hash columns hold an HMAC-SHA256 of the plaintext for equality
-- lookups, since AES-GCM's random IV means *_encrypted can never be compared with `=`.
create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email_encrypted text,
  email_hash text,
  full_name_encrypted text,
  full_name_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create index profiles_email_hash_idx on public.profiles (email_hash) where email_hash is not null;
create index profiles_full_name_hash_idx on public.profiles (full_name_hash) where full_name_hash is not null;

-- Read-only for the owning user. No insert/update/delete policy for anon/authenticated:
-- all writes must go through the service-role client + lib/encryption.ts, so a client can
-- never write an unencrypted value or a hash that doesn't match the encrypted column.
create policy "Users can read their own profile" on public.profiles
  for select using (auth.uid() = user_id);

-- Guarantees a profile row exists per user. Cannot populate email/full_name itself —
-- encryption keys live only in the Node app, not in Postgres — so this creates an
-- empty placeholder row that application code fills in via UPDATE later.
create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_user_profile() from public, anon, authenticated;

create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute function public.handle_new_user_profile();

-- Backfill existing users who signed up before this migration.
insert into public.profiles (user_id)
select id from auth.users
on conflict (user_id) do nothing;

-- user_activity_logs: audit-log data. RLS enabled with zero policies = fully denied to
-- anon/authenticated roles; only the service role (which bypasses RLS) can read/write it,
-- same pattern already used for public.webhook_events.
create table public.user_activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  ip_address_encrypted text,
  created_at timestamptz not null default now()
);
alter table public.user_activity_logs enable row level security;

create index user_activity_logs_user_id_created_at_idx
  on public.user_activity_logs (user_id, created_at desc);
