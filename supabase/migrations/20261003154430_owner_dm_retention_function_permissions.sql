-- Supabase default privileges also grant EXECUTE directly to API roles.
-- These trigger-only functions need no direct RPC execution by those roles.
-- Trigger invocation continues to run as the caller with existing table rights.
revoke all on function public.protect_owner_dm_history_row()
  from public, anon, authenticated, service_role;
revoke all on function public.protect_owner_dm_history_truncate()
  from public, anon, authenticated, service_role;
