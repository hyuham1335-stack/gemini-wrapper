-- Step 2 of 2: existing rows have been backfilled by scripts/backfill-conversation-encryption.ts,
-- so the encrypted columns can now be required and the plaintext columns removed for good.
alter table public.conversations alter column title_encrypted set not null;
alter table public.conversations drop column title;
alter table public.messages alter column content_encrypted set not null;
alter table public.messages drop column content;
