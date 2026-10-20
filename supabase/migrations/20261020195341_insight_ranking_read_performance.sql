-- Preserve existing RPC signatures, security attributes and grants.
-- The primary key (member_id, article_key, liker_key) makes article_key
-- unique and non-null within each member/liker group.
CREATE INDEX IF NOT EXISTS insight_public_likes_member_liker_liked_idx
  ON public.insight_public_likes(member_id,liker_key,liked_at DESC NULLS LAST);

CREATE OR REPLACE FUNCTION public.insight_fast_ranking(
 p_member text DEFAULT 'owner', p_offset integer DEFAULT 0,
 p_limit integer DEFAULT 30, p_query text DEFAULT ''
) RETURNS TABLE(liker_key text,actor_name text,actor_url text,actor_image_url text,like_count bigint,last_liked_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
 WITH ranked AS MATERIALIZED (
  SELECT l.liker_key,count(*) AS like_count,max(l.liked_at) AS last_liked_at
  FROM insight_public_likes l
  WHERE l.member_id=p_member
   AND (coalesce(p_query,'')='' OR coalesce(l.actor_name,'') ILIKE '%'||p_query||'%' OR coalesce(l.actor_url,'') ILIKE '%'||p_query||'%')
  GROUP BY l.liker_key
  ORDER BY like_count DESC,last_liked_at DESC NULLS LAST
  OFFSET greatest(p_offset,0) LIMIT least(greatest(p_limit,1),100)
 )
 SELECT r.liker_key,p.actor_name,p.actor_url,p.actor_image_url,r.like_count,r.last_liked_at
 FROM ranked r
 CROSS JOIN LATERAL (
  SELECT coalesce((array_agg(l.actor_name ORDER BY l.liked_at DESC NULLS LAST))[1],'noteユーザー') AS actor_name,
   (array_agg(l.actor_url ORDER BY l.liked_at DESC NULLS LAST))[1] AS actor_url,
   (array_agg(l.actor_image_url ORDER BY l.liked_at DESC NULLS LAST))[1] AS actor_image_url
  FROM insight_public_likes l
  WHERE l.member_id=p_member AND l.liker_key=r.liker_key
   AND (coalesce(p_query,'')='' OR coalesce(l.actor_name,'') ILIKE '%'||p_query||'%' OR coalesce(l.actor_url,'') ILIKE '%'||p_query||'%')
 ) p
 ORDER BY r.like_count DESC,r.last_liked_at DESC NULLS LAST;
$function$;
