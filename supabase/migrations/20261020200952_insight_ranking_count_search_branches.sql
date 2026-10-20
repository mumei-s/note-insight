-- Keep both counts exact and uncached. Separate the empty-search branch so a
-- generic RPC plan does not need actor profile columns for unfiltered counts.
-- Existing signature, security attributes and execution permissions are retained.
CREATE OR REPLACE FUNCTION public.insight_fast_ranking_count(
 p_member text DEFAULT 'owner'::text, p_query text DEFAULT ''::text
) RETURNS bigint
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
 SELECT CASE WHEN coalesce(p_query,'')='' THEN (
  SELECT count(DISTINCT l.liker_key)
  FROM insight_public_likes l WHERE l.member_id=p_member
 ) ELSE (
  SELECT count(DISTINCT l.liker_key)
  FROM insight_public_likes l WHERE l.member_id=p_member
   AND (coalesce(l.actor_name,'') ILIKE '%'||p_query||'%'
    OR coalesce(l.actor_url,'') ILIKE '%'||p_query||'%')
 ) END;
$function$;
