-- Reconstructed from the live schema to restore local migration history — this predates
-- the local migrations/ folder being kept in sync with the project, so it documents what
-- was already applied remotely rather than introducing anything new.
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '새 대화',
  created_at timestamptz not null default now()
);
alter table public.conversations enable row level security;
create index conversations_user_id_created_at_idx on public.conversations (user_id, created_at desc);

create policy "conversations_select_own" on public.conversations for select using (auth.uid() = user_id);
create policy "conversations_insert_own" on public.conversations for insert with check (auth.uid() = user_id);
create policy "conversations_update_own" on public.conversations for update using (auth.uid() = user_id);
create policy "conversations_delete_own" on public.conversations for delete using (auth.uid() = user_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);
alter table public.messages enable row level security;
create index messages_conversation_id_created_at_idx on public.messages (conversation_id, created_at);

create policy "messages_select_own" on public.messages for select using (
  exists (select 1 from public.conversations c where c.id = messages.conversation_id and c.user_id = auth.uid())
);
create policy "messages_insert_own" on public.messages for insert with check (
  exists (select 1 from public.conversations c where c.id = messages.conversation_id and c.user_id = auth.uid())
);
create policy "messages_delete_own" on public.messages for delete using (
  exists (select 1 from public.conversations c where c.id = messages.conversation_id and c.user_id = auth.uid())
);
