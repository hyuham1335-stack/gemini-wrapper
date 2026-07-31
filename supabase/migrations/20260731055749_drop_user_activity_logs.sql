-- user_activity_logs was provisioned for future audit logging in
-- 20260731052033_add_profiles_and_activity_logs.sql but was never wired into any app code
-- (0 rows, no references outside that migration and the migrate-encrypt script's table list).
drop table public.user_activity_logs;
