-- Fail closed on accidental profile DELETE/CASCADE when saved INSIGHT history exists.
-- Formal verified erasure remains possible after a separately authorized, explicit
-- removal of the member's stored history; ordinary withdrawal must never do this.
create or replace function private.insight_retain_member_profile_history()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if tg_op='TRUNCATE' then
    raise exception 'INSIGHT_HISTORY_TRUNCATE_PROTECTED';
  end if;

  if exists(select 1 from public.insight_notifications where member_id=old.member_id)
     or exists(select 1 from public.insight_public_articles where member_id=old.member_id)
     or exists(select 1 from public.insight_public_comments where member_id=old.member_id)
     or exists(select 1 from public.insight_public_likes where member_id=old.member_id)
     or exists(select 1 from public.insight_public_followers where member_id=old.member_id)
     or exists(select 1 from public.insight_relations where member_id=old.member_id)
     or exists(select 1 from public.insight_relation_events where member_id=old.member_id)
     or exists(select 1 from public.insight_relation_history_rows where member_id=old.member_id)
     or exists(select 1 from public.insight_dm_threads where member_id=old.member_id)
     or exists(select 1 from public.insight_dm_messages where member_id=old.member_id)
     or exists(select 1 from public.insight_dashboard_snapshots where member_id=old.member_id)
     or exists(select 1 from private.insight_comment_body_versions where member_id=old.member_id)
  then
    raise exception 'INSIGHT_HISTORY_REQUIRES_VERIFIED_ERASURE';
  end if;

  return old;
end;
$function$;

drop trigger if exists insight_preserve_member_history_delete_v1
on public.insight_notification_profiles;
create trigger insight_preserve_member_history_delete_v1
before delete on public.insight_notification_profiles
for each row execute function private.insight_retain_member_profile_history();

drop trigger if exists insight_preserve_member_history_truncate_v1
on public.insight_notification_profiles;
create trigger insight_preserve_member_history_truncate_v1
before truncate on public.insight_notification_profiles
for each statement execute function private.insight_retain_member_profile_history();

revoke all on function private.insight_retain_member_profile_history()
from public, anon, authenticated, service_role;
