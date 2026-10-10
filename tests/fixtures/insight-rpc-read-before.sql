-- Production definitions before the read-performance change, captured 2026-10-10.
-- Kept as the independent contract reference for PGlite equivalence tests.
CREATE OR REPLACE FUNCTION public.insight_fast_analysis_v2(p_member text DEFAULT 'owner'::text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
with supporter as (
  select liker_key,count(distinct article_key) article_count from insight_public_likes where member_id=p_member group by liker_key
), comment_roots as (
  select r.comment_key root_key,
    exists(select 1 from insight_manual_completions c where c.member_id=r.member_id and c.creator_urlname='ss_yr' and c.item_type='comment_thread' and c.item_key=r.comment_key) confirmed,
    case when not coalesce(cnt.has_creator_reply,false) then 'unreplied' when coalesce(lastall.is_creator,false) then 'replied' else 'followup_pending' end status,
    coalesce(lastext.is_creator_liked,r.is_creator_liked,false) heart_on_last_external
  from insight_public_comments r
  left join lateral (select bool_or(c.is_creator) has_creator_reply from insight_public_comments c where c.member_id=p_member and c.parent_key=r.comment_key) cnt on true
  left join lateral (select c.is_creator from insight_public_comments c where c.member_id=p_member and c.parent_key=r.comment_key order by c.occurred_at desc nulls last,c.comment_key desc limit 1) lastall on true
  left join lateral (select c.is_creator_liked from insight_public_comments c where c.member_id=p_member and c.parent_key=r.comment_key and c.is_creator=false order by c.occurred_at desc nulls last,c.comment_key desc limit 1) lastext on true
  where r.member_id=p_member and r.is_root=true and r.is_creator=false
), article_stats as (
  select a.article_key,a.title,a.url,a.like_count,a.comment_count,count(distinct l.liker_key) identified_likers
  from insight_public_articles a left join insight_public_likes l on l.member_id=a.member_id and l.article_key=a.article_key
  where a.member_id=p_member group by a.article_key,a.title,a.url,a.like_count,a.comment_count
  order by count(distinct l.liker_key) desc,a.like_count desc limit 10
), latest_followers as (select expected_count,added_count,removed_count,created_at from insight_relation_sync_runs where member_id=p_member and direction='followers' order by created_at desc limit 1),
prev_followers as (select expected_count from insight_relation_sync_runs where member_id=p_member and direction='followers' order by created_at desc offset 1 limit 1),
latest_followings as (select expected_count,added_count,removed_count,created_at from insight_relation_sync_runs where member_id=p_member and direction='followings' order by created_at desc limit 1),
prev_followings as (select expected_count from insight_relation_sync_runs where member_id=p_member and direction='followings' order by created_at desc offset 1 limit 1)
select jsonb_build_object(
 'uniqueSupporters',(select count(*) from supporter),
 'repeatSupporters',(select count(*) from supporter where article_count>=2),
 'repeatRate',coalesce((select count(*)::numeric/nullif((select count(*) from supporter),0) from supporter where article_count>=2),0),
 'pendingLikes',(select count(*) from insight_public_likes l where l.member_id=p_member and not exists(select 1 from insight_manual_completions c where c.member_id=l.member_id and c.creator_urlname='ss_yr' and c.item_type='like' and c.item_key=l.article_key||':'||l.liker_key)),
 'completedLikes',(select count(*) from insight_public_likes l where l.member_id=p_member and exists(select 1 from insight_manual_completions c where c.member_id=l.member_id and c.creator_urlname='ss_yr' and c.item_type='like' and c.item_key=l.article_key||':'||l.liker_key)),
 'unrepliedComments',(select count(*) from comment_roots where not confirmed and status='unreplied'),
 'followupPendingComments',(select count(*) from comment_roots where not confirmed and status='followup_pending'),
 'heartClosedComments',(select count(*) from comment_roots where not confirmed and status in ('unreplied','followup_pending') and heart_on_last_external),
 'repliedComments',(select count(*) from comment_roots where not confirmed and status='replied'),
 'completedCommentThreads',(select count(*) from comment_roots where confirmed),
 'topArticles',(select coalesce(jsonb_agg(to_jsonb(article_stats)),'[]'::jsonb) from article_stats),
 'followers',jsonb_build_object('total',coalesce((select expected_count from latest_followers),0),'delta',coalesce((select expected_count from latest_followers),0)-coalesce((select expected_count from prev_followers),(select expected_count from latest_followers),0),'added',coalesce((select added_count from latest_followers),0),'removed',coalesce((select removed_count from latest_followers),0),'at',(select created_at from latest_followers)),
 'followings',jsonb_build_object('total',coalesce((select expected_count from latest_followings),0),'delta',coalesce((select expected_count from latest_followings),0)-coalesce((select expected_count from prev_followings),(select expected_count from latest_followings),0),'added',coalesce((select added_count from latest_followings),0),'removed',coalesce((select removed_count from latest_followings),0),'at',(select created_at from latest_followings))
);
$function$;

CREATE OR REPLACE FUNCTION public.insight_fast_like_count_scoped_status(p_member text DEFAULT 'owner'::text, p_query text DEFAULT ''::text, p_from timestamp with time zone DEFAULT NULL::timestamp with time zone, p_to timestamp with time zone DEFAULT NULL::timestamp with time zone, p_status text DEFAULT 'pending'::text)
 RETURNS bigint
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
 select count(*)
 from insight_public_likes l
 left join insight_public_articles a on a.member_id=l.member_id and a.article_key=l.article_key
 where l.member_id=p_member
   and (p_from is null or l.liked_at>=p_from)
   and (p_to is null or l.liked_at<p_to)
   and (coalesce(p_query,'')='' or coalesce(l.actor_name,'') ilike '%'||p_query||'%' or coalesce(l.actor_url,'') ilike '%'||p_query||'%' or coalesce(a.title,'') ilike '%'||p_query||'%')
   and (
      p_status='all'
      or (p_status='completed' and exists(select 1 from insight_manual_completions c where c.member_id=l.member_id and c.creator_urlname='ss_yr' and c.item_type='like' and c.item_key=l.article_key||':'||l.liker_key))
      or (p_status='pending' and not exists(select 1 from insight_manual_completions c where c.member_id=l.member_id and c.creator_urlname='ss_yr' and c.item_type='like' and c.item_key=l.article_key||':'||l.liker_key))
   );
$function$;

CREATE OR REPLACE FUNCTION public.insight_fast_like_page_scoped_status(p_member text DEFAULT 'owner'::text, p_offset integer DEFAULT 0, p_limit integer DEFAULT 30, p_query text DEFAULT ''::text, p_sort text DEFAULT 'newest'::text, p_from timestamp with time zone DEFAULT NULL::timestamp with time zone, p_to timestamp with time zone DEFAULT NULL::timestamp with time zone, p_status text DEFAULT 'pending'::text)
 RETURNS TABLE(article_key text, article_title text, article_url text, liked_at timestamp with time zone, liker_key text, actor_name text, actor_url text, actor_image_url text, confirmed boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select l.article_key, coalesce(a.title,'記事'), coalesce(a.url,''), l.liked_at,
         l.liker_key, coalesce(l.actor_name,'noteユーザー'), l.actor_url, l.actor_image_url,
         exists(
           select 1 from insight_manual_completions c
           where c.member_id=l.member_id and c.creator_urlname='ss_yr' and c.item_type='like'
             and c.item_key=l.article_key||':'||l.liker_key
         ) as confirmed
  from insight_public_likes l
  left join insight_public_articles a on a.member_id=l.member_id and a.article_key=l.article_key
  where l.member_id=p_member
    and (p_from is null or l.liked_at>=p_from)
    and (p_to is null or l.liked_at<p_to)
    and (coalesce(p_query,'')='' or coalesce(l.actor_name,'') ilike '%'||p_query||'%' or coalesce(l.actor_url,'') ilike '%'||p_query||'%' or coalesce(a.title,'') ilike '%'||p_query||'%')
    and (
      p_status='all'
      or (p_status='completed' and exists(select 1 from insight_manual_completions c where c.member_id=l.member_id and c.creator_urlname='ss_yr' and c.item_type='like' and c.item_key=l.article_key||':'||l.liker_key))
      or (p_status='pending' and not exists(select 1 from insight_manual_completions c where c.member_id=l.member_id and c.creator_urlname='ss_yr' and c.item_type='like' and c.item_key=l.article_key||':'||l.liker_key))
    )
  order by
    case when p_sort='oldest' then l.liked_at end asc nulls last,
    case when p_sort='name' then lower(coalesce(l.actor_name,'')) end asc,
    case when p_sort='name-desc' then lower(coalesce(l.actor_name,'')) end desc,
    case when p_sort not in ('oldest','name','name-desc') then l.liked_at end desc nulls last,
    l.article_key asc,l.liker_key asc
  offset greatest(p_offset,0)
  limit least(greatest(p_limit,1),100);
$function$;

CREATE OR REPLACE FUNCTION public.insight_fast_summary(p_member text DEFAULT 'owner'::text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select jsonb_build_object(
    'articleCount', (select count(*) from insight_public_articles a where a.member_id=p_member),
    'displayedLikeTotal', (select coalesce(sum(a.like_count),0) from insight_public_articles a where a.member_id=p_member),
    'identifiedLikeCount', (select count(*) from insight_public_likes l where l.member_id=p_member),
    'supporterCount', (select count(distinct l.liker_key) from insight_public_likes l where l.member_id=p_member),
    'lastSeenAt', (select max(a.last_seen_at) from insight_public_articles a where a.member_id=p_member)
  );
$function$;

