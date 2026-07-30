-- Supabase grants EXECUTE on newly created functions directly to anon/authenticated by
-- default (via ALTER DEFAULT PRIVILEGES on the public schema), so `revoke ... from public`
-- in the previous migration didn't actually lock these down. The security advisor flagged
-- both increment_usage and handle_new_user_subscription as callable by anon/authenticated
-- via PostgREST RPC. Revoke explicitly from the roles PostgREST actually exposes.
revoke execute on function public.increment_usage(uuid) from anon, authenticated;
revoke execute on function public.handle_new_user_subscription() from public, anon, authenticated, service_role;
