-- Consume transactionally prepared notification inputs without decoding all raw
-- metadata on each page read. Duplicate groups retain the ordered greedy fold.
-- The original response, scope checks, USING parameters and invoker ACL stay fixed.
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='15s';

DO $prerequisites$
DECLARE v_rpc regprocedure:=to_regprocedure('public.insight_notification_feed_page(text[],text,text,text,text,text,integer,integer,boolean)');
  v_prepare regprocedure:=to_regprocedure('insight_notification_internal.prepare_format(bigint,text,text,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb)');
BEGIN
  IF v_rpc IS NULL OR (SELECT md5(prosrc) FROM pg_proc WHERE oid=v_rpc) IS DISTINCT FROM 'e981d5ce269e8faad389e71a71fc24de' THEN
    RAISE EXCEPTION 'Notification feed differs from the approved parameter-plan prerequisite';
  END IF;
  IF v_prepare IS NULL OR (SELECT md5(prosrc) FROM pg_proc WHERE oid=v_prepare) IS DISTINCT FROM '48d98cdf69b8663e65cadb1aacb33c2c' THEN
    RAISE EXCEPTION 'Notification formatter differs from the approved preparation prerequisite';
  END IF;
  PERFORM insight_notification_internal.assert_prepared_rows_complete();
END;
$prerequisites$;

-- The pure formatter emits exactly one row; avoid the set-returning default
-- estimate multiplying all later page and payload cardinalities.
ALTER FUNCTION insight_notification_internal.prepare_format(bigint,text,text,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb) ROWS 1;

CREATE OR REPLACE FUNCTION public.insight_notification_feed_page(
  p_member_ids text[], p_scope text, p_note_id text,
  p_kind text DEFAULT 'all', p_day text DEFAULT '', p_handling_status text DEFAULT 'all',
  p_page integer DEFAULT 1, p_page_size integer DEFAULT 100, p_preview boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path = ''
SET plan_cache_mode = 'force_custom_plan'
AS $function$
DECLARE
  v_kind text := COALESCE(p_kind,'all');
  v_day text := CASE WHEN p_day ~ '^\d{4}-\d{2}-\d{2}$' THEN p_day ELSE '' END;
  v_handling text := CASE WHEN p_handling_status IN ('pending','completed') THEN p_handling_status ELSE 'all' END;
  v_result jsonb;
BEGIN
  IF p_member_ids IS NULL OR cardinality(p_member_ids) NOT BETWEEN 1 AND 2
     OR EXISTS(SELECT 1 FROM unnest(p_member_ids) AS member(id) WHERE id IS NULL OR btrim(id)='' OR length(id)>100)
     OR p_scope IS NULL OR btrim(p_scope)='' OR NOT p_scope=ANY(p_member_ids)
     OR p_note_id IS NULL OR p_note_id !~ '^[A-Za-z0-9_-]{1,100}$'
     OR p_page IS NULL OR p_page NOT BETWEEN 1 AND 1000000
     OR p_page_size IS NULL OR p_page_size NOT BETWEEN 20 AND 100
     OR p_preview IS NULL OR length(v_kind)>100 OR length(COALESCE(p_day,''))>100
  THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_NOTIFICATION_FEED_PARAMETERS'; END IF;
  EXECUTE $query$
  WITH RECURSIVE
-- Eligibility and semantic keys are calculated once when raw notification inputs
-- change. Retain excluded raw types until after the ordered greedy fold.
source_keys AS MATERIALIZED (
  SELECT id,semantic_key COLLATE "C" AS semantic_key,raw_type AS notification_type,
    target_url,occurred_at,captured_at,format_type,completion_key,
    is_question_answer,is_canonical,insufficient,reclassify_pending
  FROM insight_notification_internal.prepared_rows
  WHERE member_id=ANY($1) AND semantic_key IS NOT NULL
), group_sizes AS MATERIALIZED (
  SELECT semantic_key,count(*) AS group_size
  FROM source_keys GROUP BY semantic_key
  HAVING bool_or(COALESCE(notification_type,'') NOT IN ('like','follow','comment'))
), source_order AS MATERIALIZED (
  SELECT k.*,g.group_size
  FROM source_keys k JOIN group_sizes g USING(semantic_key)
), source AS MATERIALIZED (
  SELECT raw.id,raw.member_id,raw.notification_type,raw.raw_text,
    raw.actor_name,raw.actor_url,COALESCE(raw.actor_image_url,'')<>'' AS actor_image_present,
    raw.target_title,raw.target_url,raw.source_url,raw.occurred_at,raw.captured_at,raw.is_read,
    meta.source AS m_source,meta.event_identity AS m_event_identity,
    meta.body AS m_body,meta.kind AS m_kind,meta.classification_status AS m_classification_status,
    meta.reclassify_pending AS m_reclassify_pending,meta.classifier AS m_classifier,
    meta.recovery_version AS m_recovery_version,ordered.group_size,
    raw.insight_feed_key COLLATE "C" AS semantic_key
  FROM source_order ordered JOIN public.insight_notifications raw ON raw.id=ordered.id
  CROSS JOIN LATERAL jsonb_to_record(
    CASE WHEN jsonb_typeof(raw.meta)='object' THEN raw.meta ELSE '{}'::jsonb END
  ) AS meta(source jsonb,event_identity jsonb,body jsonb,kind jsonb,classification_status jsonb,
    reclassify_pending jsonb,classifier jsonb,recovery_version jsonb)
  WHERE ordered.group_size>1
), feed_keyed_base AS NOT MATERIALIZED (
  SELECT source.*,
    (CASE WHEN COALESCE(m_body NOT IN ('null'::jsonb,'false'::jsonb,'0'::jsonb,'""'::jsonb),false) THEN 32 ELSE 0 END
      +CASE WHEN actor_image_present THEN 16 ELSE 0 END
      +CASE WHEN COALESCE(actor_url,'')<>'' THEN 8 ELSE 0 END
      +CASE WHEN COALESCE(actor_name,'')<>'' THEN 4 ELSE 0 END
      +CASE WHEN COALESCE(target_url,'')<>'' THEN 4 ELSE 0 END
      +CASE WHEN COALESCE(target_title,'')<>'' THEN 2 ELSE 0 END
      +CASE WHEN occurred_at IS NOT NULL THEN 1 ELSE 0 END) AS score
  FROM source
)
,feed_keyed AS MATERIALIZED (
  SELECT keyed.*,true AS group_displayable FROM feed_keyed_base keyed
), duplicate_groups AS MATERIALIZED (
  SELECT k.semantic_key,k.group_size AS last_rn,jsonb_agg(jsonb_build_object('score',k.score,'n',jsonb_build_object(
    'id',k.id,'member_id',k.member_id,'notification_type',k.notification_type,'raw_text',k.raw_text,
    'actor_name',k.actor_name,'actor_url',k.actor_url,'actor_image_url',CASE WHEN k.actor_image_present THEN 'present' END,
    'target_title',k.target_title,'target_url',k.target_url,'source_url',k.source_url,
    'occurred_at',k.occurred_at,'captured_at',k.captured_at,'is_read',k.is_read,'meta',light_meta.value,'__origins',jsonb_build_array(k.id))) ORDER BY k.captured_at DESC,k.id ASC) AS items
  FROM feed_keyed k
  JOIN public.insight_notifications original ON original.id=k.id AND original.member_id=ANY($1)
  CROSS JOIN LATERAL (
    SELECT COALESCE(jsonb_object_agg(entry.key,entry.value),'{}'::jsonb) AS value
    FROM jsonb_each(CASE WHEN jsonb_typeof(original.meta)='object' THEN original.meta ELSE '{}'::jsonb END) entry
    WHERE entry.key=ANY(ARRAY['source','noise_reason','event_identity','client_signature','body','comment_body','kind','classification_status','reclassify_pending','classifier','recovery_version'])
  ) light_meta
  WHERE k.group_size>1 AND k.group_displayable
  GROUP BY k.semantic_key,k.group_size
),
folded_duplicates AS MATERIALIZED (
  SELECT insight_notification_internal.fold_items(items) AS n FROM duplicate_groups
), folded_rows AS MATERIALIZED (
  SELECT ordered.id,ordered.notification_type,NULL::text AS raw_text,ordered.target_url,
    ordered.occurred_at,ordered.captured_at,
    NULL::jsonb AS m_source,NULL::jsonb AS m_event_identity,NULL::jsonb AS m_body,
    NULL::jsonb AS m_kind,NULL::jsonb AS m_classification_status,
    NULL::jsonb AS m_reclassify_pending,NULL::jsonb AS m_classifier,NULL::jsonb AS m_recovery_version,
    ARRAY[ordered.id] AS origins
  FROM source_order ordered
  WHERE ordered.group_size=1
  UNION ALL
  SELECT (n->>'id')::bigint,n->>'notification_type',n->>'raw_text',n->>'target_url',
    (n->>'occurred_at')::timestamptz,(n->>'captured_at')::timestamptz,
    n#>'{meta,source}',n#>'{meta,event_identity}',n#>'{meta,body}',n#>'{meta,kind}',n#>'{meta,classification_status}',
    n#>'{meta,reclassify_pending}',n#>'{meta,classifier}',n#>'{meta,recovery_version}',
    ARRAY(SELECT value::bigint FROM jsonb_array_elements_text(n->'__origins') value)
  FROM folded_duplicates WHERE COALESCE(n->>'notification_type','') NOT IN ('like','follow','comment')
), format_types AS MATERIALIZED (
  SELECT k.id,k.occurred_at,k.captured_at,k.target_url,k.completion_key,
    k.is_question_answer,k.is_canonical,k.insufficient,k.reclassify_pending,k.format_type AS type
  FROM source_order k WHERE k.group_size=1
  UNION ALL
  SELECT r.id,r.occurred_at,r.captured_at,r.target_url,prepared.completion_key,
    prepared.is_question_answer,prepared.is_canonical,prepared.insufficient,
    prepared.reclassify_pending,prepared.notification_type AS type
  FROM folded_rows r
  CROSS JOIN LATERAL insight_notification_internal.prepare_format(
    r.id,r.notification_type,r.raw_text,r.m_source,r.m_event_identity,r.m_body,r.m_kind,
    r.m_classification_status,r.m_reclassify_pending,r.m_classifier,r.m_recovery_version
  ) prepared
  WHERE cardinality(r.origins)>1
), contexts AS NOT MATERIALIZED (
  SELECT *,COALESCE(lower((regexp_match(target_url,'^[A-Za-z][A-Za-z0-9+.-]*://[^/?#]+/([^/?#]+)/n/'))[1]),'') AS article,
    CASE WHEN target_url ~* '^https://note[.]com/[^/]+/membership([/?#]|$)' THEN lower(split_part(split_part(target_url,'/',4),'?',1)) ELSE '' END AS membership,
    CASE WHEN type='other' AND is_question_answer THEN 'question_answer' ELSE COALESCE(type,'') END AS structured
  FROM format_types
), categorized AS MATERIALIZED (
  SELECT id::text AS id,type AS notification_type,
    CASE WHEN type='reply' THEN CASE WHEN article=$3 OR is_canonical THEN 'reply_self' WHEN article<>'' THEN 'reply_other' ELSE 'reply_unknown' END
       WHEN type='membership_reaction' THEN CASE WHEN membership=$3 THEN 'membership_reaction_self' WHEN membership<>'' THEN 'membership_reaction_joined' ELSE 'membership_reaction_unknown' END ELSE structured END AS category,
    EXISTS(SELECT 1 FROM public.insight_manual_completions c WHERE c.member_id=$2 AND c.creator_urlname=$3 AND c.item_type='notification' AND c.item_key=completion_key) AS confirmed,
    insufficient,
    reclassify_pending,
    COALESCE(floor(extract(epoch FROM captured_at)*1000),0) AS captured_ms,
    COALESCE(floor(extract(epoch FROM COALESCE(occurred_at,captured_at))*1000),946684800000) AS event_ms,
    to_char(COALESCE(occurred_at,captured_at) AT TIME ZONE 'Asia/Tokyo','YYYY-MM-DD') AS day
  FROM contexts
), ordered AS NOT MATERIALIZED (
  SELECT * FROM categorized
), day_rows AS MATERIALIZED (
  SELECT id,category,confirmed,captured_ms,event_ms FROM ordered WHERE $5='' OR day=$5
), dated AS MATERIALIZED (
  SELECT * FROM day_rows WHERE $6='all' OR confirmed=($6='completed')
), selected AS (
  SELECT * FROM dated WHERE $4='all' OR category=$4
), paged AS MATERIALIZED (
  SELECT * FROM selected ORDER BY captured_ms DESC,event_ms DESC,id COLLATE "C" DESC LIMIT $8 OFFSET ($7::bigint-1)*$8
), previews AS MATERIALIZED (
  SELECT * FROM (SELECT *,row_number() OVER(PARTITION BY category ORDER BY captured_ms DESC,event_ms DESC,id COLLATE "C" DESC) AS category_row FROM dated WHERE $9) ranked WHERE category_row<=12
), visible_ids AS (
  SELECT id FROM paged UNION SELECT id FROM previews
), visible AS MATERIALIZED (
  SELECT c.*,    CASE WHEN article=$3 OR is_canonical THEN 'self' WHEN article<>'' THEN 'other' ELSE 'unknown' END AS article_context,
    NULLIF(article,'') AS article_owner,NULLIF(membership,'') AS membership_owner,
    CASE
       WHEN type='comment' THEN CASE WHEN article=$3 OR is_canonical THEN '自分の記事へのコメント' WHEN article<>'' THEN '@'||article||' の記事へのコメント' ELSE 'コメント' END
       WHEN type='reply' THEN CASE WHEN article=$3 OR is_canonical THEN '自分の記事のコメントへの返信' WHEN article<>'' THEN '@'||article||' の記事で自分のコメントへの返信' ELSE '返信先の記事を確認待ち' END
       WHEN type='comment_like' THEN CASE WHEN article=$3 OR is_canonical THEN '自分の記事のコメントへの♡' WHEN article<>'' THEN '@'||article||' の記事コメントへの♡' ELSE 'コメントへの♡' END
       WHEN type='like' THEN CASE WHEN article=$3 OR is_canonical THEN '自分の記事へのスキ' WHEN article<>'' THEN '@'||article||' の記事へのスキ' ELSE '記事へのスキ' END
       WHEN type='membership_reaction' THEN CASE WHEN membership=$3 THEN '自分のメンシプ反応' WHEN membership<>'' THEN '参加中のメンシプ反応' ELSE 'メンシプ所有者を確認待ち' END
       WHEN structured='question_answer' THEN '質問箱への回答' ELSE '' END AS context_label,
r.origins,r.m_body,r.occurred_at,r.captured_at
  FROM visible_ids v JOIN categorized c ON c.id=v.id JOIN folded_rows r ON r.id::text=v.id
  JOIN contexts ctx ON ctx.id::text=v.id
), visible_payloads AS MATERIALIZED (
  SELECT v.id,jsonb_build_object(
    'id',winning.id,'member_id',winning.member_id,'notification_type',v.notification_type,'raw_text',winning.raw_text,
    'actor_name',raw_meta.actor_name,'actor_url',raw_meta.actor_url,'actor_image_url',raw_meta.actor_image_url,
    'target_title',raw_meta.target_title,'target_url',CASE WHEN cardinality(v.origins)=1 THEN winning.target_url ELSE raw_meta.target_url END,
    'source_url',CASE WHEN cardinality(v.origins)=1 THEN winning.source_url ELSE raw_meta.source_url END,
    'occurred_at',v.occurred_at,'captured_at',v.captured_at,'is_read',winning.is_read,
    'meta',CASE WHEN cardinality(v.origins)=1 THEN winning.meta ELSE COALESCE(raw_meta.merged_meta,'{}'::jsonb)||CASE WHEN v.m_body NOT IN ('null'::jsonb,'false'::jsonb,'0'::jsonb,'""'::jsonb) THEN jsonb_build_object('body',v.m_body) ELSE '{}'::jsonb END END,
    'article_context',v.article_context,'article_owner',v.article_owner,'membership_owner',v.membership_owner,
    'display_category',v.category,'context_label',v.context_label,'confirmed',v.confirmed,'__origins',to_jsonb(v.origins)) AS n
  FROM visible v
  JOIN LATERAL (
    SELECT raw_winner.* FROM public.insight_notifications raw_winner
    WHERE raw_winner.id=v.id::bigint AND raw_winner.member_id=ANY($1)
    LIMIT 1
  ) winning ON true
  CROSS JOIN LATERAL (
    SELECT
      (array_agg(original.actor_name ORDER BY origin.position DESC) FILTER(WHERE COALESCE(original.actor_name,'')<>''))[1] AS actor_name,
      (array_agg(original.actor_url ORDER BY origin.position DESC) FILTER(WHERE COALESCE(original.actor_url,'')<>''))[1] AS actor_url,
      (array_agg(original.actor_image_url ORDER BY origin.position DESC) FILTER(WHERE COALESCE(original.actor_image_url,'')<>''))[1] AS actor_image_url,
      (array_agg(original.target_title ORDER BY origin.position DESC) FILTER(WHERE COALESCE(original.target_title,'')<>''))[1] AS target_title,
      (array_agg(original.target_url ORDER BY origin.position DESC) FILTER(WHERE COALESCE(original.target_url,'')<>''))[1] AS target_url,
      (array_agg(original.source_url ORDER BY origin.position DESC) FILTER(WHERE COALESCE(original.source_url,'')<>''))[1] AS source_url,
      (SELECT jsonb_object_agg(entry.key,entry.value ORDER BY member.position)
       FROM unnest(v.origins) WITH ORDINALITY member(id,position)
       JOIN public.insight_notifications original ON original.id=member.id AND original.member_id=ANY($1)
       CROSS JOIN LATERAL jsonb_each(CASE WHEN jsonb_typeof(original.meta)='object' THEN original.meta
         WHEN jsonb_typeof(original.meta)='array' THEN COALESCE((SELECT jsonb_object_agg((a.position-1)::text,a.value) FROM jsonb_array_elements(original.meta) WITH ORDINALITY a(value,position)),'{}'::jsonb) ELSE '{}'::jsonb END) entry) AS merged_meta
    FROM unnest(v.origins) WITH ORDINALITY origin(id,position)
    JOIN public.insight_notifications original ON original.id=origin.id AND original.member_id=ANY($1)
  ) raw_meta
), visible_actor AS MATERIALIZED (
  SELECT v.id,actor.value AS actor,v.n||jsonb_build_object(
    'target_title',COALESCE(NULLIF(NULLIF(v.n->'target_title','null'::jsonb),'""'::jsonb),CASE WHEN v.n#>'{meta,featured_content_name}' NOT IN ('null'::jsonb,'false'::jsonb,'0'::jsonb,'""'::jsonb) THEN v.n#>'{meta,featured_content_name}' END,'null'::jsonb),
    'actor_url',COALESCE(NULLIF(NULLIF(v.n->'actor_url','null'::jsonb),'""'::jsonb),CASE WHEN actor.value->'url' NOT IN ('null'::jsonb,'false'::jsonb,'0'::jsonb,'""'::jsonb) THEN actor.value->'url' END,CASE WHEN actor.value->'profile_url' NOT IN ('null'::jsonb,'false'::jsonb,'0'::jsonb,'""'::jsonb) THEN actor.value->'profile_url' END,'null'::jsonb),
    'actor_name',COALESCE(NULLIF(NULLIF(v.n->'actor_name','null'::jsonb),'""'::jsonb),CASE WHEN actor.value->'name' NOT IN ('null'::jsonb,'false'::jsonb,'0'::jsonb,'""'::jsonb) THEN actor.value->'name' END,CASE WHEN actor.value->'nickname' NOT IN ('null'::jsonb,'false'::jsonb,'0'::jsonb,'""'::jsonb) THEN actor.value->'nickname' END,'null'::jsonb)) AS n
  FROM visible_payloads v
  CROSS JOIN LATERAL (SELECT COALESCE(CASE WHEN v.n#>'{meta,action_users}' NOT IN ('null'::jsonb,'false'::jsonb,'0'::jsonb,'""'::jsonb) THEN v.n#>'{meta,action_users}' END,v.n#>'{meta,actionUsers}','[]'::jsonb)->0 AS value) actor
), visible_comment_values AS MATERIALIZED (
  SELECT v.id,CASE WHEN v.n#>'{meta,comment_body}' NOT IN ('null'::jsonb,'false'::jsonb,'0'::jsonb,'""'::jsonb) THEN v.n#>'{meta,comment_body}'
    WHEN v.n#>>'{meta,source}'='canonical-public-comments' AND v.n#>'{meta,body}' NOT IN ('null'::jsonb,'false'::jsonb,'0'::jsonb,'""'::jsonb) THEN v.n#>'{meta,body}' ELSE '""'::jsonb END AS value
  FROM visible_actor v
), visible_comment_walk(id,value,path) AS (
  SELECT id,value,ARRAY[]::bigint[] FROM visible_comment_values WHERE jsonb_typeof(value)='array'
  UNION ALL
  SELECT w.id,e.value,w.path||e.position
  FROM visible_comment_walk w
  CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(w.value)='array' THEN w.value ELSE '[]'::jsonb END) WITH ORDINALITY e(value,position)
), visible_comment_text AS (
  SELECT id,string_agg(CASE
    WHEN value IS NULL OR value='null'::jsonb THEN ''
    WHEN jsonb_typeof(value)='string' THEN value#>>'{}'
    WHEN jsonb_typeof(value)='object' THEN '[object Object]'
    WHEN jsonb_typeof(value)='array' THEN ''
    WHEN jsonb_typeof(value)='number' THEN trim_scale((value#>>'{}')::numeric)::text
    ELSE value#>>'{}' END,',' ORDER BY path) AS text
  FROM visible_comment_walk WHERE jsonb_typeof(value) IS DISTINCT FROM 'array' OR value='[]'::jsonb GROUP BY id
), favorite_keys AS MATERIALIZED (
  SELECT f.creator_key,COALESCE(lower(profile.id),lower(f.creator_key)) AS actor_id,row_number() OVER() AS position
  FROM public.insight_favorite_creators f
  LEFT JOIN LATERAL (
    SELECT (regexp_match(f.actor_url,'^https?://(?:[^/?#@]*@)?note[.]com(?::[0-9]+)?/+([A-Za-z0-9_-]+)(?:[/?#]|$)','i'))[1] AS id
  ) profile ON profile.id NOT IN ('m','n','messages','membership','settings')
  WHERE f.member_id=$2
), decorated AS MATERIALIZED (
  SELECT v.id, (v.n-'__origins') || jsonb_build_object(
    'actor_image_url',COALESCE(image.raw_image,CASE WHEN image.fallback_image ~ '^https://' THEN image.fallback_image END),
    'comment_body',NULLIF(CASE jsonb_typeof(comment_value.value)
      WHEN 'string' THEN comment_value.value#>>'{}'
      WHEN 'object' THEN '[object Object]'
      WHEN 'array' THEN COALESCE((SELECT text FROM visible_comment_text WHERE id=v.id),'')
      WHEN 'number' THEN trim_scale((comment_value.value#>>'{}')::numeric)::text
      ELSE comment_value.value#>>'{}' END,''),
    'comment_identity',identity.value,
    'favorite',creator.id IS NOT NULL AND fav.creator_key IS NOT NULL,
    'favorite_creator_key',CASE WHEN creator.id IS NOT NULL THEN COALESCE(fav.creator_key,lower(creator.id)) END) AS n
  FROM visible_actor v JOIN visible_comment_values comment_value ON comment_value.id=v.id
  CROSS JOIN LATERAL (
    SELECT
      NULLIF(v.n->>'actor_image_url','') AS raw_image,
      COALESCE(CASE WHEN v.actor->'user_profile_image_path' NOT IN ('null'::jsonb,'false'::jsonb,'0'::jsonb,'""'::jsonb) THEN v.actor->>'user_profile_image_path' END,CASE WHEN v.actor->'profile_image_url' NOT IN ('null'::jsonb,'false'::jsonb,'0'::jsonb,'""'::jsonb) THEN v.actor->>'profile_image_url' END,CASE WHEN v.actor->'profileImageUrl' NOT IN ('null'::jsonb,'false'::jsonb,'0'::jsonb,'""'::jsonb) THEN v.actor->>'profileImageUrl' END,CASE WHEN v.actor->'avatarUrl' NOT IN ('null'::jsonb,'false'::jsonb,'0'::jsonb,'""'::jsonb) THEN v.actor->>'avatarUrl' END,'') AS fallback_image
  ) image
  LEFT JOIN LATERAL (
    SELECT (regexp_match(v.n->>'actor_url','^https?://(?:[^/?#@]*@)?note[.]com(?::[0-9]+)?/+([A-Za-z0-9_-]+)(?:[/?#]|$)','i'))[1] AS id
  ) creator ON creator.id NOT IN ('m','n','messages','membership','settings')
  LEFT JOIN LATERAL (SELECT f.creator_key FROM favorite_keys f WHERE f.actor_id=lower(creator.id) ORDER BY f.position DESC LIMIT 1) fav ON true
  LEFT JOIN LATERAL (
    SELECT jsonb_build_object('articleKey',route.parts[2],'commentKey',decoded.value,'url','https://note.com/'||route.parts[1]||'/n/'||route.parts[2]||'?scrollpos=comment&c='||decoded.value) AS value
    FROM unnest(ARRAY[v.n->>'target_url',v.n#>>'{meta,all_area_url}',v.n#>>'{meta,featured_area_url}']) WITH ORDINALITY candidate(url,position)
    CROSS JOIN LATERAL (SELECT regexp_match(candidate.url,'^[A-Za-z][A-Za-z0-9+.-]*://(?:[^/?#@]*@)?note[.]com(?::[0-9]+)?(/[^?#]*)(?:[?]([^#]*))?(?:#.*)?$','i') AS parts) parsed
    CROSS JOIN LATERAL (SELECT regexp_match(parsed.parts[1],'^/([A-Za-z0-9_-]+)/n/(n[A-Za-z0-9]+)$') AS parts) route
    CROSS JOIN LATERAL (
      SELECT CASE WHEN strpos(q.value,'=')>0 THEN substr(q.value,strpos(q.value,'=')+1) ELSE '' END AS value
      FROM unnest(string_to_array(parsed.parts[2],'&')) WITH ORDINALITY q(value,position)
      WHERE split_part(q.value,'=',1) IN ('c','%63') ORDER BY q.position LIMIT 1
    ) query
    CROSS JOIN LATERAL (
      SELECT string_agg(CASE WHEN tokens.parts[1] IS NULL THEN tokens.parts[2] WHEN ('x'||tokens.parts[1])::bit(8)::int BETWEEN 1 AND 127 THEN chr(('x'||tokens.parts[1])::bit(8)::int) ELSE '?' END,'' ORDER BY tokens.position) AS value
      FROM regexp_matches(query.value,'%([A-Fa-f0-9]{2})|([^%])','g') WITH ORDINALITY tokens(parts,position)
    ) decoded
    WHERE route.parts IS NOT NULL AND decoded.value ~ '^nc[A-Za-z0-9]+$' AND query.value !~ '%(?![A-Fa-f0-9]{2})'
    ORDER BY candidate.position LIMIT 1
  ) identity ON true
), category_counts AS (
  SELECT jsonb_object_agg(category,total) AS value FROM (SELECT category,count(*) AS total FROM dated GROUP BY category) counts
), category_preview AS (
  SELECT jsonb_object_agg(category,items) AS value FROM (
    SELECT p.category,jsonb_agg(d.n ORDER BY p.captured_ms DESC,p.event_ms DESC,p.id COLLATE "C" DESC) AS items FROM previews p JOIN decorated d ON d.id=p.id GROUP BY p.category
  ) categories
), latest AS (
  SELECT captured_at FROM public.insight_notifications WHERE member_id=ANY($1) ORDER BY captured_at DESC LIMIT 1
), last_sync AS (
  SELECT created_at,inserted_count,received_count,source FROM public.insight_notification_sync_runs WHERE member_id=ANY($1) AND source='browser-notification-stable-v3-confirmed' ORDER BY created_at DESC LIMIT 1
)
SELECT jsonb_build_object(
  'ok',true,'feedAt',to_char(statement_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'classifierVersion','action-v28-context',
  'page',$7,'pageSize',$8,'total',(SELECT count(*) FROM selected),
  'rows',COALESCE((SELECT jsonb_agg(d.n ORDER BY p.captured_ms DESC,p.event_ms DESC,p.id COLLATE "C" DESC) FROM paged p JOIN decorated d ON d.id=p.id),'[]'::jsonb),
  'categoryCounts',jsonb_build_object('all',(SELECT count(*) FROM dated))||COALESCE((SELECT value FROM category_counts),'{}'::jsonb),
  'categoryPreview',COALESCE((SELECT value FROM category_preview),'{}'::jsonb),
  'statusCounts',(SELECT jsonb_build_object('all',count(*),'pending',count(*) FILTER(WHERE NOT confirmed),'completed',count(*) FILTER(WHERE confirmed)) FROM day_rows WHERE $4='all' OR category=$4),
  'handlingStatus',$6,'unknownKinds','[]'::jsonb,
  'unresolved',(SELECT jsonb_build_object('remaining',count(*),'insufficient',count(*) FILTER(WHERE insufficient)) FROM ordered WHERE notification_type='other'),
  'reclassifyPending',(SELECT count(*) FROM ordered WHERE notification_type='other' AND reclassify_pending),
  'noteId',$3,'selectedDay',NULLIF($5,''),
  'lastUpdatedAt',(SELECT CASE WHEN extract(epoch FROM captured_at)<>0 THEN to_char(captured_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END FROM latest),
  'lastSyncAt',(SELECT created_at FROM last_sync),'lastSyncSource',(SELECT NULLIF(source,'') FROM last_sync),
  'lastSyncInserted',COALESCE((SELECT inserted_count FROM last_sync),0),'lastSyncConfirmed',COALESCE((SELECT inserted_count FROM last_sync),0),'lastSyncReceived',COALESCE((SELECT received_count FROM last_sync),0)
)

$query$ INTO v_result
  USING p_member_ids,p_scope,p_note_id,v_kind,v_day,v_handling,p_page,p_page_size,p_preview;
  RETURN v_result;
END;
$function$;

DO $verify$
DECLARE v_rpc regprocedure:=to_regprocedure('public.insight_notification_feed_page(text[],text,text,text,text,text,integer,integer,boolean)');
BEGIN
  IF (SELECT md5(prosrc) FROM pg_proc WHERE oid=v_rpc) IS DISTINCT FROM '77c56df0bd92a570bc057a088323535e'
     OR (SELECT prorows FROM pg_proc WHERE oid='insight_notification_internal.prepare_format(bigint,text,text,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb)'::regprocedure) IS DISTINCT FROM 1::real
     OR (SELECT proowner::regrole::text FROM pg_proc WHERE oid=v_rpc) IS DISTINCT FROM 'postgres'
     OR (SELECT proacl::text FROM pg_proc WHERE oid=v_rpc) IS DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres}'
     OR (SELECT prosecdef OR provolatile<>'s' OR proconfig IS DISTINCT FROM ARRAY['search_path=""','plan_cache_mode=force_custom_plan'] FROM pg_proc WHERE oid=v_rpc)
  THEN RAISE EXCEPTION 'Prepared-row notification feed definition verification failed'; END IF;
END;
$verify$;

