-- Edge Functions classify structured kinds before the older text-only triggers.
-- Keep their confirmed result as the final classification, preserving raw data.
create or replace function public.apply_insight_notification_classification_v25()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.meta->>'noise_reason' = 'non-notification-api-capture' then
    new.notification_type := 'capture_noise';
    new.meta := coalesce(new.meta, '{}'::jsonb) || '{"reclassify_pending":false}'::jsonb;
  elsif new.meta->>'classifier' = 'action-v25-window'
    and new.meta->>'classified_type' in (
      'like','follow','comment','reply','comment_like','creator_article_posted',
      'my_article_magazine_added','magazine_follow','magazine_article_added','magazine_join',
      'membership_board','membership_board_reply','membership_reaction','membership_started',
      'membership_plan','membership_join','question_box_started','question_answer',
      'purchased_article_updated','purchase','tip','buzz','rating','points','quote','other','capture_noise'
    ) then
    new.notification_type := new.meta->>'classified_type';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_zzzzzz_notification_classification_v25 on public.insight_notifications;
create trigger trg_zzzzzz_notification_classification_v25
before insert or update on public.insight_notifications
for each row execute function public.apply_insight_notification_classification_v25();
