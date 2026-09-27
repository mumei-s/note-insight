-- Preserve original evidence. Only known posted-article bodies and unambiguous
-- archived notice matches are repaired; ambiguous time/name matches stay other.
with fixed as (
 update public.insight_notifications
 set notification_type='creator_article_posted',meta=meta||jsonb_build_object(
  'previous_classified_type',notification_type,'classified_type','creator_article_posted',
  'classifier','action-v27-membership','classification_status','matched','reclassify_pending',false,'last_reclassified_at',now())
 where meta->>'kind'='super_follow' and notification_type='follow'
 and coalesce(meta->>'body',raw_text) ~ '記事を(投稿|更新)しました'
 returning id
) select count(*) as corrected_article_notices from fixed;

with probes as (
 select distinct on(p.member_id,n->>'id') p.member_id,n
 from public.insight_notification_network_probes p
 cross join lateral jsonb_array_elements(case when jsonb_typeof(p.response_sample->'data')='array' then p.response_sample->'data' else '[]'::jsonb end)n
 where n->>'id' is not null and n->>'kind' is not null
 order by p.member_id,n->>'id',p.captured_at desc
), matched as (
 select a.id,p.n from public.insight_notifications a join probes p on p.member_id=a.member_id
 and (a.meta->>'event_identity'='notice:'||(p.n->>'id') or (
 coalesce(a.meta->>'time_estimated','false')<>'true' and p.n->'action_users'->0->>'url'=a.actor_url
 and p.n->>'noticed_at'~'^\d{4}-' and abs(extract(epoch from ((p.n->>'noticed_at')::timestamptz-a.occurred_at)))<=1
 and 1=(select count(*) from probes q where q.member_id=a.member_id and q.n->'action_users'->0->>'url'=a.actor_url and q.n->>'noticed_at'~'^\d{4}-' and abs(extract(epoch from ((q.n->>'noticed_at')::timestamptz-a.occurred_at)))<=60)
 )) where a.notification_type='other'
), supported as (
 select *,case when n->>'kind'='jm_magazine_add' then 'magazine_article_added'
 when n->>'kind'='super_follow' and n->>'body'~'記事を(投稿|更新)しました' then 'creator_article_posted' end category from matched
), fixed as (
 update public.insight_notifications a set
 raw_text=regexp_replace(s.n->>'body','<[^>]*>',' ','g'),actor_name=coalesce(s.n->'action_users'->0->>'name',a.actor_name),
 target_url=coalesce(s.n->>'all_area_url',s.n->>'featured_area_url',a.target_url),
 occurred_at=coalesce((s.n->>'noticed_at')::timestamptz,a.occurred_at),notification_type=s.category,
 meta=a.meta||s.n||jsonb_build_object('original_capture',jsonb_build_object('raw_text',a.raw_text,'actor_name',a.actor_name,'target_url',a.target_url,'occurred_at',a.occurred_at,'event_identity',a.meta->>'event_identity'),
 'event_identity','notice:'||(s.n->>'id'),'recovery_notice_id',s.n->>'id','recovery_basis','unique_actor_exact_time','recovery_version','evidence-v1','classifier','action-v27-membership','classified_type',s.category,'classification_status','matched','reclassify_pending',false,'last_reclassified_at',now())
 from supported s where s.id=a.id and s.category is not null returning a.id,a.notification_type
) select * from fixed;
