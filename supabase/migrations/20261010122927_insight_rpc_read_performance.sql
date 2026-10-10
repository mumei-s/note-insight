-- Preserve existing RPC contracts and grants while avoiding repeated full scans.
-- Likes' primary key (member_id, article_key, liker_key) makes each grouped
-- article/liker pair unique; COUNT(*) therefore preserves the former DISTINCT.
CREATE OR REPLACE FUNCTION public.insight_fast_summary(p_member text DEFAULT 'owner'::text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
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
CREATE OR REPLACE FUNCTION public.insight_fast_like_count_scoped_status(p_member text DEFAULT 'owner'::text, p_query text DEFAULT ''::text, p_from timestamp with time zone DEFAULT NULL::timestamp with time zone, p_to timestamp with time zone DEFAULT NULL::timestamp with time zone, p_status text DEFAULT 'pending'::text)
 RETURNS bigint
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
SELECT count(*)
FROM insight_public_likes l
LEFT JOIN insight_public_articles qa ON qa.member_id=l.member_id AND qa.article_key=l.article_key
 AND coalesce(p_query,'')<>''
LEFT JOIN insight_manual_completions c ON c.member_id=l.member_id AND c.creator_urlname='ss_yr'
 AND c.item_type='like' AND c.item_key=l.article_key||':'||l.liker_key
WHERE l.member_id=p_member
 AND (p_from IS NULL OR l.liked_at>=p_from) AND (p_to IS NULL OR l.liked_at<p_to)
 AND (coalesce(p_query,'')='' OR coalesce(l.actor_name,'') ILIKE '%'||p_query||'%'
  OR coalesce(l.actor_url,'') ILIKE '%'||p_query||'%' OR coalesce(qa.title,'') ILIKE '%'||p_query||'%')
 AND (p_status='all' OR (p_status='completed' AND c.item_key IS NOT NULL)
  OR (p_status='pending' AND c.item_key IS NULL));
$function$;

CREATE OR REPLACE FUNCTION public.insight_fast_like_page_scoped_status(p_member text DEFAULT 'owner'::text, p_offset integer DEFAULT 0, p_limit integer DEFAULT 30, p_query text DEFAULT ''::text, p_sort text DEFAULT 'newest'::text, p_from timestamp with time zone DEFAULT NULL::timestamp with time zone, p_to timestamp with time zone DEFAULT NULL::timestamp with time zone, p_status text DEFAULT 'pending'::text)
 RETURNS TABLE(article_key text, article_title text, article_url text, liked_at timestamp with time zone, liker_key text, actor_name text, actor_url text, actor_image_url text, confirmed boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
WITH selected AS MATERIALIZED (
 SELECT l.member_id,l.article_key,l.liked_at,l.liker_key,l.actor_name,l.actor_url,l.actor_image_url,
        c.item_key IS NOT NULL AS confirmed
 FROM insight_public_likes l
 LEFT JOIN insight_public_articles qa ON qa.member_id=l.member_id AND qa.article_key=l.article_key
  AND coalesce(p_query,'')<>''
 LEFT JOIN insight_manual_completions c ON c.member_id=l.member_id AND c.creator_urlname='ss_yr'
  AND c.item_type='like' AND c.item_key=l.article_key||':'||l.liker_key
 WHERE l.member_id=p_member
  AND (p_from IS NULL OR l.liked_at>=p_from) AND (p_to IS NULL OR l.liked_at<p_to)
  AND (coalesce(p_query,'')='' OR coalesce(l.actor_name,'') ILIKE '%'||p_query||'%'
   OR coalesce(l.actor_url,'') ILIKE '%'||p_query||'%' OR coalesce(qa.title,'') ILIKE '%'||p_query||'%')
  AND (p_status='all' OR (p_status='completed' AND c.item_key IS NOT NULL)
   OR (p_status='pending' AND c.item_key IS NULL))
 ORDER BY CASE WHEN p_sort='oldest' THEN l.liked_at END ASC NULLS LAST,
  CASE WHEN p_sort='name' THEN lower(coalesce(l.actor_name,'')) END ASC,
  CASE WHEN p_sort='name-desc' THEN lower(coalesce(l.actor_name,'')) END DESC,
  CASE WHEN p_sort NOT IN ('oldest','name','name-desc') THEN l.liked_at END DESC NULLS LAST,
  l.article_key ASC,l.liker_key ASC
 OFFSET greatest(p_offset,0) LIMIT least(greatest(p_limit,1),100)
)
SELECT s.article_key,coalesce(a.title,'記事'),coalesce(a.url,''),s.liked_at,
 s.liker_key,coalesce(s.actor_name,'noteユーザー'),s.actor_url,s.actor_image_url,s.confirmed
FROM selected s LEFT JOIN insight_public_articles a ON a.member_id=s.member_id AND a.article_key=s.article_key
ORDER BY CASE WHEN p_sort='oldest' THEN s.liked_at END ASC NULLS LAST,
 CASE WHEN p_sort='name' THEN lower(coalesce(s.actor_name,'')) END ASC,
 CASE WHEN p_sort='name-desc' THEN lower(coalesce(s.actor_name,'')) END DESC,
 CASE WHEN p_sort NOT IN ('oldest','name','name-desc') THEN s.liked_at END DESC NULLS LAST,
 s.article_key ASC,s.liker_key ASC;
$function$;

CREATE OR REPLACE FUNCTION public.insight_fast_analysis_v2(p_member text DEFAULT 'owner'::text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
WITH likes AS MATERIALIZED (
 SELECT l.article_key,l.liker_key,c.item_key IS NOT NULL AS confirmed
 FROM insight_public_likes l
 LEFT JOIN insight_manual_completions c ON c.member_id=l.member_id
  AND c.creator_urlname='ss_yr' AND c.item_type='like'
  AND c.item_key=l.article_key||':'||l.liker_key
 WHERE l.member_id=p_member
), supporter AS (
 SELECT liker_key,count(*) AS article_count FROM likes GROUP BY liker_key
), article_likes AS (
 SELECT article_key,count(*) AS identified_likers FROM likes GROUP BY article_key
), like_counts AS (
 SELECT count(*) FILTER (WHERE NOT confirmed) AS pending,
        count(*) FILTER (WHERE confirmed) AS completed FROM likes
), replies AS MATERIALIZED (
 SELECT parent_key,occurred_at,comment_key,is_creator,is_creator_liked
 FROM insight_public_comments WHERE member_id=p_member AND parent_key IS NOT NULL
), reply_flags AS (
 SELECT parent_key,bool_or(is_creator) AS has_creator_reply FROM replies GROUP BY parent_key
), last_reply AS (
 SELECT DISTINCT ON (parent_key) parent_key,is_creator FROM replies
 ORDER BY parent_key,occurred_at DESC NULLS LAST,comment_key DESC
), last_external AS (
 SELECT DISTINCT ON (parent_key) parent_key,is_creator_liked FROM replies
 WHERE is_creator=false
 ORDER BY parent_key,occurred_at DESC NULLS LAST,comment_key DESC
), comment_roots AS (
 SELECT r.comment_key AS root_key,completed.item_key IS NOT NULL AS confirmed,
  CASE WHEN NOT coalesce(cnt.has_creator_reply,false) THEN 'unreplied'
       WHEN coalesce(lastall.is_creator,false) THEN 'replied' ELSE 'followup_pending' END AS status,
  coalesce(lastext.is_creator_liked,r.is_creator_liked,false) AS heart_on_last_external
 FROM insight_public_comments r
 LEFT JOIN reply_flags cnt ON cnt.parent_key=r.comment_key
 LEFT JOIN last_reply lastall ON lastall.parent_key=r.comment_key
 LEFT JOIN last_external lastext ON lastext.parent_key=r.comment_key
 LEFT JOIN insight_manual_completions completed ON completed.member_id=r.member_id
  AND completed.creator_urlname='ss_yr' AND completed.item_type='comment_thread'
  AND completed.item_key=r.comment_key
 WHERE r.member_id=p_member AND r.is_root=true AND r.is_creator=false
), article_stats AS (
 SELECT a.article_key,a.title,a.url,a.like_count,a.comment_count,
        coalesce(l.identified_likers,0) AS identified_likers
 FROM insight_public_articles a LEFT JOIN article_likes l ON l.article_key=a.article_key
 WHERE a.member_id=p_member
 ORDER BY coalesce(l.identified_likers,0) DESC,a.like_count DESC LIMIT 10
), latest_followers AS (
 SELECT expected_count,added_count,removed_count,created_at FROM insight_relation_sync_runs
 WHERE member_id=p_member AND direction='followers' ORDER BY created_at DESC LIMIT 1
), prev_followers AS (
 SELECT expected_count FROM insight_relation_sync_runs WHERE member_id=p_member AND direction='followers'
 ORDER BY created_at DESC OFFSET 1 LIMIT 1
), latest_followings AS (
 SELECT expected_count,added_count,removed_count,created_at FROM insight_relation_sync_runs
 WHERE member_id=p_member AND direction='followings' ORDER BY created_at DESC LIMIT 1
), prev_followings AS (
 SELECT expected_count FROM insight_relation_sync_runs WHERE member_id=p_member AND direction='followings'
 ORDER BY created_at DESC OFFSET 1 LIMIT 1
)
SELECT jsonb_build_object(
 'uniqueSupporters',(SELECT count(*) FROM supporter),
 'repeatSupporters',(SELECT count(*) FROM supporter WHERE article_count>=2),
 'repeatRate',coalesce((SELECT count(*)::numeric/nullif((SELECT count(*) FROM supporter),0) FROM supporter WHERE article_count>=2),0),
 'pendingLikes',(SELECT pending FROM like_counts),'completedLikes',(SELECT completed FROM like_counts),
 'unrepliedComments',(SELECT count(*) FROM comment_roots WHERE NOT confirmed AND status='unreplied'),
 'followupPendingComments',(SELECT count(*) FROM comment_roots WHERE NOT confirmed AND status='followup_pending'),
 'heartClosedComments',(SELECT count(*) FROM comment_roots WHERE NOT confirmed AND status IN ('unreplied','followup_pending') AND heart_on_last_external),
 'repliedComments',(SELECT count(*) FROM comment_roots WHERE NOT confirmed AND status='replied'),
 'completedCommentThreads',(SELECT count(*) FROM comment_roots WHERE confirmed),
 'topArticles',(SELECT coalesce(jsonb_agg(to_jsonb(article_stats)),'[]'::jsonb) FROM article_stats),
 'followers',jsonb_build_object('total',coalesce((SELECT expected_count FROM latest_followers),0),'delta',coalesce((SELECT expected_count FROM latest_followers),0)-coalesce((SELECT expected_count FROM prev_followers),(SELECT expected_count FROM latest_followers),0),'added',coalesce((SELECT added_count FROM latest_followers),0),'removed',coalesce((SELECT removed_count FROM latest_followers),0),'at',(SELECT created_at FROM latest_followers)),
 'followings',jsonb_build_object('total',coalesce((SELECT expected_count FROM latest_followings),0),'delta',coalesce((SELECT expected_count FROM latest_followings),0)-coalesce((SELECT expected_count FROM prev_followings),(SELECT expected_count FROM latest_followings),0),'added',coalesce((SELECT added_count FROM latest_followings),0),'removed',coalesce((SELECT removed_count FROM latest_followings),0),'at',(SELECT created_at FROM latest_followings))
);
$function$;
