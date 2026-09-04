create or replace function public.insight_bootstrap_participant_profile()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_member text;
  v_role text;
begin
  v_member := case when lower(coalesce(new.note_id,''))='ss_yr' then 'owner' else new.id::text end;
  v_role := case when v_member='owner' then 'owner' else 'member' end;
  if new.status='active' and new.verified_at is not null then
    insert into public.insight_notification_profiles(member_id,note_urlname,note_nickname,role,verified_at,public_watch_enabled,updated_at)
    values(v_member,lower(new.note_id),coalesce(new.display_name,new.note_id),v_role,new.verified_at,true,now())
    on conflict(member_id) do update set
      note_urlname=excluded.note_urlname,
      note_nickname=excluded.note_nickname,
      role=excluded.role,
      verified_at=excluded.verified_at,
      public_watch_enabled=true,
      updated_at=now();
  else
    update public.insight_notification_profiles set public_watch_enabled=false,updated_at=now() where member_id=v_member;
  end if;
  return new;
end;
$$;

drop trigger if exists insight_bootstrap_participant_profile_trg on public.insight_access_applications;
create trigger insight_bootstrap_participant_profile_trg
after insert or update of status,verified_at,note_id,display_name on public.insight_access_applications
for each row execute function public.insight_bootstrap_participant_profile();

insert into public.insight_notification_profiles(member_id,note_urlname,note_nickname,role,verified_at,public_watch_enabled,updated_at)
select case when lower(note_id)='ss_yr' then 'owner' else id::text end,
       lower(note_id),coalesce(display_name,note_id),
       case when lower(note_id)='ss_yr' then 'owner' else 'member' end,
       verified_at,true,now()
from public.insight_access_applications
where status='active' and verified_at is not null
on conflict(member_id) do update set
  note_urlname=excluded.note_urlname,
  note_nickname=excluded.note_nickname,
  role=excluded.role,
  verified_at=excluded.verified_at,
  public_watch_enabled=true,
  updated_at=now();