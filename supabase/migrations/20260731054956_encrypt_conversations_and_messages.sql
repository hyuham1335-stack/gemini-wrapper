-- Step 1 of 2 for encrypting chat data at rest (see lib/encryption.ts, same AES-256-GCM
-- app-side pattern already used for profiles.email_encrypted/full_name_encrypted). Columns
-- start nullable so existing rows can be backfilled by scripts/backfill-conversation-encryption.ts
-- before the plaintext columns are dropped in a follow-up migration.
alter table public.conversations add column title_encrypted text;
alter table public.messages add column content_encrypted text;
