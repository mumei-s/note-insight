-- Edge Functions classify structured kinds before the older text-only triggers.
-- Keep their confirmed result as the final classification, preserving raw data.
create or replace function public.apply_insight_notification_classification_v25()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.meta->>'noise_reason' = 'non-notification-api-capture' then
    new.notification_type := 'capture_noise';
    new.meta := coalesce(new.meta, '{}'::jsonb) || '{"reclassify_pending":false}'::jsonb;
  elsif new.meta->>'classifier' in ('action-v25-window','action-v26-formats','action-v27-membership','action-v28-context')
    and new.meta->>'classified_type' in (
      'like','follow','comment','reply','comment_like','creator_article_posted',
      'my_article_magazine_added','magazine_follow','magazine_article_added','magazine_join',
      'membership_board','membership_board_reply','membership_reaction','membership_started',
      'membership_article_added','membership_article_updated','membership_magazine_added',
      'membership_plan','membership_join','question_box_started','question_answer',
      'badge','purchase_message','purchased_article_updated','purchase','tip','buzz','rating','points','quote','image_used','other','capture_noise'
    ) then
    new.notification_type := new.meta->>'classified_type';
  end if;
  return new;
end;
$$;


-- Reclassify only exact, observed formats; keep original capture and member ownership.
with fixes as (
 select id,case meta->>'kind'
 when 'user_badge' then 'badge'
 when 'thank_you_message' then 'purchase_message'
 else 'creator_article_posted' end as category
 from public.insight_notifications
 where notification_type='other' and (
 meta->>'kind' in ('user_badge','thank_you_message')
 or (coalesce(meta->>'kind','') in ('','super_follow')
 and raw_text ~ 'さん(他[0-9]+名)?が.{0,250}.{0,250}記事を(投稿|更新)しました'))
)
update public.insight_notifications n set notification_type=f.category,
 meta=coalesce(n.meta,'{}'::jsonb)||jsonb_build_object('classifier','action-v28-context','classified_type',f.category,'classification_status','matched','reclassify_pending',false,'last_reclassified_at',now())
from fixes f where n.id=f.id;
