create or replace function public.fix_insight_membership_row()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  t text := regexp_replace(coalesce(new.raw_text,''), '[[:space:]]+', ' ', 'g');
  target text := coalesce(new.target_url,'');
begin
  if target like '%kind=circle_plan_join%' then
    new.notification_type := 'membership_join';
  elsif target ~ 'kind=board_like_(comment|post)' then
    new.notification_type := 'membership_reaction';
  elsif target ~ 'kind=board_reply_(comment|post)' then
    new.notification_type := 'membership_board_reply';
  elsif target like '%kind=board_new_post%' then
    new.notification_type := 'membership_board';
  elsif target like '%kind=circle_plan_open%' then
    new.notification_type := 'membership_plan';
  elsif target like '%/membership%' and t ~ 'さん(他[0-9]+名)?が.{0,180}に参加しました' then
    new.notification_type := 'membership_join';
  elsif target like '%/membership/%' and t like '%スキしました%' then
    new.notification_type := 'membership_reaction';
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_zzz_fix_insight_membership on public.insight_notifications;
create trigger trg_zzz_fix_insight_membership
before insert or update of raw_text, notification_type, target_url
on public.insight_notifications
for each row execute function public.fix_insight_membership_row();

update public.insight_notifications
set notification_type = notification_type
where target_url like '%kind=circle_plan_join%'
   or target_url ~ 'kind=board_like_(comment|post)'
   or target_url ~ 'kind=board_reply_(comment|post)'
   or target_url like '%kind=board_new_post%'
   or target_url like '%kind=circle_plan_open%';