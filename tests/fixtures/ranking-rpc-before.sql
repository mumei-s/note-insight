CREATE OR REPLACE FUNCTION public.insight_fast_ranking(p_member text DEFAULT 'owner'::text, p_offset integer DEFAULT 0, p_limit integer DEFAULT 30, p_query text DEFAULT ''::text)
 RETURNS TABLE(liker_key text, actor_name text, actor_url text, actor_image_url text, like_count bigint, last_liked_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select l.liker_key,
         coalesce((array_agg(l.actor_name order by l.liked_at desc nulls last))[1],'noteユーザー') as actor_name,
         (array_agg(l.actor_url order by l.liked_at desc nulls last))[1] as actor_url,
         (array_agg(l.actor_image_url order by l.liked_at desc nulls last))[1] as actor_image_url,
         count(distinct l.article_key) as like_count,
         max(l.liked_at) as last_liked_at
  from insight_public_likes l
  where l.member_id=p_member
    and (coalesce(p_query,'')='' or coalesce(l.actor_name,'') ilike '%'||p_query||'%' or coalesce(l.actor_url,'') ilike '%'||p_query||'%')
  group by l.liker_key
  order by like_count desc, last_liked_at desc nulls last
  offset greatest(p_offset,0)
  limit least(greatest(p_limit,1),100);
$function$;

CREATE OR REPLACE FUNCTION public.insight_fast_ranking_count(p_member text DEFAULT 'owner'::text, p_query text DEFAULT ''::text)
 RETURNS bigint
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select count(distinct l.liker_key)
  from insight_public_likes l
  where l.member_id=p_member
    and (coalesce(p_query,'')='' or coalesce(l.actor_name,'') ilike '%'||p_query||'%' or coalesce(l.actor_url,'') ilike '%'||p_query||'%');
$function$;

CREATE OR REPLACE FUNCTION public.insight_fast_summary(p_member text DEFAULT 'owner'::text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
WITH articles AS (
 SELECT count(*) AS article_count, coalesce(sum(like_count),0) AS displayed_likes,
        max(last_seen_at) AS last_seen_at
 FROM insight_public_articles WHERE member_id=p_member
), supporters AS (
 SELECT liker_key,count(*) AS like_count
 FROM insight_public_likes WHERE member_id=p_member GROUP BY liker_key
), likes AS (
 SELECT coalesce(sum(like_count),0)::bigint AS identified_likes,count(*) AS supporters
 FROM supporters
)
SELECT jsonb_build_object(
 'articleCount',articles.article_count,'displayedLikeTotal',articles.displayed_likes,
 'identifiedLikeCount',likes.identified_likes,'supporterCount',likes.supporters,
 'lastSeenAt',articles.last_seen_at
) FROM articles CROSS JOIN likes;
$function$;
