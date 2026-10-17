SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='45s';

-- Persist deterministic eligibility and semantic keys at write time so page and
-- filter reads do not repeat full-history text/URL/time normalization.
-- This STORED column rewrites existing rows under ACCESS EXCLUSIVE; assess the
-- backfill/lock window before applying. Deploy before the matching Edge consumer.
CREATE OR REPLACE FUNCTION public.insight_notification_feed_key(
  p_notification_type text,p_raw_text text,p_actor_name text,p_actor_url text,
  p_target_title text,p_target_url text,p_source_url text,
  p_occurred_at timestamptz,p_captured_at timestamptz,p_meta jsonb
) RETURNS text
LANGUAGE sql IMMUTABLE SECURITY INVOKER PARALLEL SAFE
SET search_path = ''
AS $function$
WITH RECURSIVE source AS MATERIALIZED (
  SELECT p_notification_type AS notification_type,p_raw_text AS raw_text,
    p_actor_name AS actor_name,p_actor_url AS actor_url,p_target_title AS target_title,
    p_target_url AS target_url,p_source_url AS source_url,
    p_occurred_at AS occurred_at,p_captured_at AS captured_at,
    meta.source AS m_source,meta.noise_reason AS m_noise_reason,
    meta.event_identity AS m_event_identity,meta.client_signature AS m_client_signature,
    1::bigint AS ordinal
  FROM jsonb_to_record(CASE WHEN jsonb_typeof(p_meta)='object' THEN p_meta ELSE '{}'::jsonb END)
    AS meta(source jsonb,noise_reason jsonb,event_identity jsonb,client_signature jsonb)
),
feed_text_walk(ordinal,slot,value,path) AS (
  SELECT s.ordinal,v.slot,v.value,ARRAY[]::bigint[]
  FROM source s
  CROSS JOIN LATERAL (VALUES
    ('source'::text,s.m_source),
    ('identity'::text,s.m_event_identity),
    ('signature'::text,s.m_client_signature)
  ) v(slot,value)
  WHERE jsonb_typeof(v.value)='array'
  UNION ALL
  SELECT w.ordinal,w.slot,e.value,w.path||e.ordinality
  FROM feed_text_walk w
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(w.value)='array' THEN w.value ELSE '[]'::jsonb END
  ) WITH ORDINALITY e(value,ordinality)
), feed_text_leaves AS (
  SELECT ordinal,slot,path,
    CASE
      WHEN value IS NULL OR value='null'::jsonb THEN ''
      WHEN cardinality(path)=0 AND value IN ('false'::jsonb,'0'::jsonb,'""'::jsonb) THEN ''
      WHEN jsonb_typeof(value)='string' THEN value#>>'{}'
      WHEN jsonb_typeof(value)='object' THEN '[object Object]'
      WHEN jsonb_typeof(value)='array' THEN ''
      WHEN jsonb_typeof(value)='number' THEN trim_scale((value#>>'{}')::numeric)::text
      ELSE value#>>'{}'
    END AS text
  FROM feed_text_walk
  WHERE jsonb_typeof(value) IS DISTINCT FROM 'array' OR value='[]'::jsonb
), feed_text AS (
  SELECT ordinal,slot,string_agg(text,',' ORDER BY path) AS text
  FROM feed_text_leaves GROUP BY ordinal,slot
), feed_normalized AS MATERIALIZED (
  SELECT s.*,
    COALESCE(NULLIF(s.notification_type,''),'other') AS raw_type,
    CASE
      WHEN s.m_source IS NULL OR s.m_source IN ('null'::jsonb,'false'::jsonb,'0'::jsonb,'""'::jsonb) THEN ''
      WHEN jsonb_typeof(s.m_source)='array' THEN COALESCE((SELECT text FROM feed_text WHERE ordinal=s.ordinal AND slot='source'),'')
      WHEN jsonb_typeof(s.m_source)='object' THEN '[object Object]'
      WHEN jsonb_typeof(s.m_source)='number' THEN trim_scale((s.m_source#>>'{}')::numeric)::text
      ELSE s.m_source#>>'{}'
    END AS raw_source,
    CASE
      WHEN s.m_event_identity IS NULL OR s.m_event_identity IN ('null'::jsonb,'false'::jsonb,'0'::jsonb,'""'::jsonb) THEN ''
      WHEN jsonb_typeof(s.m_event_identity)='array' THEN COALESCE((SELECT text FROM feed_text WHERE ordinal=s.ordinal AND slot='identity'),'')
      WHEN jsonb_typeof(s.m_event_identity)='object' THEN '[object Object]'
      WHEN jsonb_typeof(s.m_event_identity)='number' THEN trim_scale((s.m_event_identity#>>'{}')::numeric)::text
      ELSE s.m_event_identity#>>'{}'
    END AS event_identity,
    CASE
      WHEN s.m_client_signature IS NULL OR s.m_client_signature IN ('null'::jsonb,'false'::jsonb,'0'::jsonb,'""'::jsonb) THEN ''
      WHEN jsonb_typeof(s.m_client_signature)='array' THEN COALESCE((SELECT text FROM feed_text WHERE ordinal=s.ordinal AND slot='signature'),'')
      WHEN jsonb_typeof(s.m_client_signature)='object' THEN '[object Object]'
      WHEN jsonb_typeof(s.m_client_signature)='number' THEN trim_scale((s.m_client_signature#>>'{}')::numeric)::text
      ELSE s.m_client_signature#>>'{}'
    END AS client_signature,
    COALESCE(s.m_client_signature NOT IN ('null'::jsonb,'false'::jsonb,'0'::jsonb,'""'::jsonb),false) AS signature_truthy,
    btrim(regexp_replace(regexp_replace(translate(COALESCE(s.raw_text,''),
      U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF',repeat(' ',25)),
      ' +',' ','g'),
      ' (?:たった今|昨日|[0-9]+ *(?:秒|分|時間|日|週|か月|ヶ月|月|年)前)$','')) AS raw,
    CASE WHEN s.captured_at IS NOT NULL THEN floor(extract(epoch FROM s.captured_at)*1000)
      ELSE 946684800000::numeric END AS captured_ms,
    CASE WHEN s.occurred_at IS NOT NULL THEN floor(extract(epoch FROM s.occurred_at)*1000)
      WHEN s.captured_at IS NOT NULL THEN floor(extract(epoch FROM s.captured_at)*1000)
      ELSE 946684800000::numeric END AS event_ms
  FROM source s
), feed_prepared AS (
  SELECT normalized.*,
    -- urlKey does not trim or parse a URL and removes exactly one final slash.
    COALESCE(NULLIF(lower(regexp_replace(split_part(split_part(COALESCE(actor_url,''),'?',1),'#',1),'/$','')),''),
      lower(COALESCE(actor_name,''))) AS actor,
    COALESCE(NULLIF(lower(regexp_replace(split_part(split_part(COALESCE(target_url,''),'?',1),'#',1),'/$','')),''),
      lower(regexp_replace(split_part(split_part(COALESCE(source_url,''),'?',1),'#',1),'/$',''))) AS target,
    floor((CASE WHEN event_ms<>0 THEN event_ms ELSE captured_ms END)/300000)::text AS five,
    floor((CASE WHEN event_ms<>0 THEN event_ms ELSE captured_ms END)/1800000)::text AS half,
    raw_source ~ '^note-notification-(?:bottom-up-v(?:2970|3)|reader-v[0-9]+|manual-sync-v[0-9]+|explicit-sync(?:-v[0-9]+)?|continuous-sync-v[0-9]+)$' AS explicit_manual
  FROM feed_normalized normalized
), feed_eligible AS (
  SELECT * FROM feed_prepared
  WHERE (raw_type NOT IN ('comment','reply') OR explicit_manual)
    AND COALESCE(m_noise_reason#>>'{}','')<>'non-notification-api-capture'
    AND raw_source<>'canonical-public-comments'
    AND raw_type<>'capture_noise'
    AND raw<>''
    AND (
      explicit_manual OR raw_type='other'
      OR raw_type IN ('badge','purchase_message','my_article_magazine_added','tip',
        'membership_reaction','membership_join','membership_article_added',
        'membership_article_updated','membership_magazine_added','membership_started',
        'membership_plan','membership_board','membership_board_reply','creator_article_posted')
      OR (raw_type='follow' AND raw ~ 'フォロー|フォロワー')
      OR raw ~* '(?:さん(?:他[0-9]+名)?(?:が|に)|あなた(?:の|を|に)|新しい(?:スキ|コメント|フォロワー)).{0,160}.{0,160}(?:スキしました|コメントしました|返信しました|フォローしました|フォローされました|追加しました|追加されました|仲間入りしました|参加しました|購入されました|購入しました|投稿しました|話題|高評価|ポイント)|(?:メンバーシップ|メンシプ|Member *Ship|掲示板).{0,200}(?:投稿しました|開始しました|始めました|はじめました|追加しました|追加されました|公開しました|参加しました|加入しました|入会しました|メンバーになりました)|(?:購入がありました|返信がありました|コメントがありました)|(?:チップ|サポート|支援|応援金).{0,180}(?:届きました|届いた|受け取りました|受け取った|もらいました|いただきました|贈られました|送られました)'
    )
)
SELECT CASE
      WHEN left(event_identity,7)='notice:' THEN 'notice|'||event_identity
      WHEN signature_truthy THEN 'client|'||client_signature
      WHEN raw_type='follow' THEN 'follow|'||actor||'|'||half
      WHEN raw_type IN ('reply','comment') THEN raw_type||'|'||actor||'|'||raw||'|'||five
      ELSE raw_type||'|'||actor||'|'||target||'|'||raw||'|'||five||
        CASE
          WHEN raw_type='my_article_magazine_added' AND target='' THEN '|'||COALESCE(NULLIF(target_title,''),raw)
          WHEN raw_type='tip' AND actor='' AND target='' THEN '|'||raw
          WHEN raw_type IN ('magazine_follow','magazine_article_added','my_article_magazine_added',
            'magazine_join','membership_board','membership_board_reply','membership_reaction',
            'membership_article_added','membership_article_updated','membership_magazine_added',
            'membership_started','membership_plan','membership_join','purchase','tip','buzz',
            'rating','points','quote','comment_like','like','creator_article_posted') THEN ''
          ELSE '|'||raw END
    END
FROM feed_eligible;
$function$;
REVOKE ALL ON FUNCTION public.insight_notification_feed_key(text,text,text,text,text,text,text,timestamptz,timestamptz,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.insight_notification_feed_key(text,text,text,text,text,text,text,timestamptz,timestamptz,jsonb) TO service_role;
COMMENT ON FUNCTION public.insight_notification_feed_key(text,text,text,text,text,text,text,timestamptz,timestamptz,jsonb)
IS 'Service-only immutable eligibility and semantic key from primitive notification values; no table reads or timezone-dependent timestamp formatting.';

ALTER TABLE public.insight_notifications ADD COLUMN insight_feed_key text COLLATE "C"
GENERATED ALWAYS AS (public.insight_notification_feed_key(
  notification_type,raw_text,actor_name,actor_url,target_title,target_url,source_url,
  occurred_at,captured_at,meta
)) STORED;
COMMENT ON COLUMN public.insight_notifications.insight_feed_key IS
'Automatically recomputed eligible feed semantic key; NULL means ineligible, never unprepared.';

-- Bound the notification feed transfer to the requested page and small category previews.
-- Classification, ordered greedy deduplication and exact counts run inside PostgreSQL.
-- Deploy this migration before the Edge consumer; there is deliberately no full-history fallback.
CREATE OR REPLACE FUNCTION public.insight_notification_feed_page(
  p_member_ids text[], p_scope text, p_note_id text,
  p_kind text DEFAULT 'all', p_day text DEFAULT '', p_handling_status text DEFAULT 'all',
  p_page integer DEFAULT 1, p_page_size integer DEFAULT 100, p_preview boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_kind text := COALESCE(p_kind,'all');
  v_day text := CASE WHEN p_day ~ '^\d{4}-\d{2}-\d{2}$' THEN p_day ELSE '' END;
  v_handling text := CASE WHEN p_handling_status IN ('pending','completed') THEN p_handling_status ELSE 'all' END;
BEGIN
  IF p_member_ids IS NULL OR cardinality(p_member_ids) NOT BETWEEN 1 AND 2
     OR EXISTS(SELECT 1 FROM unnest(p_member_ids) AS member(id) WHERE id IS NULL OR btrim(id)='' OR length(id)>100)
     OR p_scope IS NULL OR btrim(p_scope)='' OR NOT p_scope=ANY(p_member_ids)
     OR p_note_id IS NULL OR p_note_id !~ '^[A-Za-z0-9_-]{1,100}$'
     OR p_page IS NULL OR p_page NOT BETWEEN 1 AND 1000000
     OR p_page_size IS NULL OR p_page_size NOT BETWEEN 20 AND 100
     OR p_preview IS NULL OR length(v_kind)>100 OR length(COALESCE(p_day,''))>100
  THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_NOTIFICATION_FEED_PARAMETERS'; END IF;
  RETURN (
  WITH RECURSIVE
-- Eligibility and semantic keys are calculated once when raw notification inputs
-- change. Retain excluded raw types until after the ordered greedy fold.
source_order AS MATERIALIZED (
  SELECT id,row_number() OVER(ORDER BY captured_at DESC,id ASC) AS ordinal
  FROM public.insight_notifications WHERE member_id=ANY(p_member_ids) AND insight_feed_key IS NOT NULL
), source AS MATERIALIZED (
  SELECT raw.id,raw.member_id,raw.notification_type,raw.raw_text,
    raw.actor_name,raw.actor_url,COALESCE(raw.actor_image_url,'')<>'' AS actor_image_present,
    raw.target_title,raw.target_url,raw.source_url,raw.occurred_at,raw.captured_at,raw.is_read,
    meta.source AS m_source,meta.event_identity AS m_event_identity,
    meta.body AS m_body,meta.kind AS m_kind,meta.classification_status AS m_classification_status,
    meta.reclassify_pending AS m_reclassify_pending,meta.classifier AS m_classifier,
    meta.recovery_version AS m_recovery_version,ordered.ordinal,
    raw.insight_feed_key COLLATE "C" AS semantic_key
  FROM source_order ordered JOIN public.insight_notifications raw ON raw.id=ordered.id
  CROSS JOIN LATERAL jsonb_to_record(
    CASE WHEN jsonb_typeof(raw.meta)='object' THEN raw.meta ELSE '{}'::jsonb END
  ) AS meta(source jsonb,event_identity jsonb,body jsonb,kind jsonb,classification_status jsonb,
    reclassify_pending jsonb,classifier jsonb,recovery_version jsonb)
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
  SELECT keyed.*,count(*) OVER grouped AS group_size,
    bool_or(COALESCE(notification_type,'') NOT IN ('like','follow','comment')) OVER grouped AS group_displayable
  FROM feed_keyed_base keyed WINDOW grouped AS (PARTITION BY semantic_key)
), duplicate_groups AS MATERIALIZED (
  SELECT k.semantic_key,k.group_size AS last_rn,jsonb_agg(jsonb_build_object('score',k.score,'n',jsonb_build_object(
    'id',k.id,'member_id',k.member_id,'notification_type',k.notification_type,'raw_text',k.raw_text,
    'actor_name',k.actor_name,'actor_url',k.actor_url,'actor_image_url',CASE WHEN k.actor_image_present THEN 'present' END,
    'target_title',k.target_title,'target_url',k.target_url,'source_url',k.source_url,
    'occurred_at',k.occurred_at,'captured_at',k.captured_at,'is_read',k.is_read,'meta',light_meta.value,'__origins',jsonb_build_array(k.id))) ORDER BY k.ordinal) AS items
  FROM feed_keyed k
  JOIN public.insight_notifications original ON original.id=k.id AND original.member_id=ANY(p_member_ids)
  CROSS JOIN LATERAL (
    SELECT COALESCE(jsonb_object_agg(entry.key,entry.value),'{}'::jsonb) AS value
    FROM jsonb_each(CASE WHEN jsonb_typeof(original.meta)='object' THEN original.meta ELSE '{}'::jsonb END) entry
    WHERE entry.key=ANY(ARRAY['source','noise_reason','event_identity','client_signature','body','comment_body','kind','classification_status','reclassify_pending','classifier','recovery_version'])
  ) light_meta
  WHERE k.group_size>1 AND k.group_displayable
  GROUP BY k.semantic_key,k.group_size
),
feed_fold(semantic_key,rn,n) AS (
  SELECT semantic_key,1::bigint,(items->0)->'n' FROM duplicate_groups
  UNION ALL
  SELECT f.semantic_key,f.rn+1,
    other.n||rich.n||jsonb_build_object('__origins',(other.n->'__origins')||(rich.n->'__origins'),'meta',om.value||rm.value||
      CASE WHEN body.value IS NOT NULL THEN jsonb_build_object('body',body.value) ELSE '{}'::jsonb END
    )||fields.value||jsonb_build_object('captured_at',
      CASE WHEN coalesce(floor(extract(epoch FROM nullif(rich.n->>'captured_at','')::timestamptz)*1000),0)
                   >=coalesce(floor(extract(epoch FROM nullif(other.n->>'captured_at','')::timestamptz)*1000),0)
        THEN coalesce(nullif(nullif(rich.n->'captured_at','null'::jsonb),'""'::jsonb),
          nullif(nullif(other.n->'captured_at','null'::jsonb),'""'::jsonb),'null'::jsonb)
        ELSE coalesce(other.n->'captured_at','null'::jsonb) END)
  FROM feed_fold f
  JOIN duplicate_groups g ON g.semantic_key=f.semantic_key AND f.rn<g.last_rn
  CROSS JOIN LATERAL (SELECT (g.items->f.rn::int)->'n' AS n,((g.items->f.rn::int)->>'score')::integer AS score) r
  CROSS JOIN LATERAL (SELECT
    (CASE WHEN coalesce((f.n->'meta'->'body') NOT IN ('null'::jsonb,'false'::jsonb,'0'::jsonb,'""'::jsonb),false) THEN 32 ELSE 0 END
      +CASE WHEN coalesce(f.n->>'actor_image_url','')<>'' THEN 16 ELSE 0 END
      +CASE WHEN coalesce(f.n->>'actor_url','')<>'' THEN 8 ELSE 0 END
      +CASE WHEN coalesce(f.n->>'actor_name','')<>'' THEN 4 ELSE 0 END
      +CASE WHEN coalesce(f.n->>'target_url','')<>'' THEN 4 ELSE 0 END
      +CASE WHEN coalesce(f.n->>'target_title','')<>'' THEN 2 ELSE 0 END
      +CASE WHEN coalesce(f.n->>'occurred_at','')<>'' THEN 1 ELSE 0 END) AS score
  ) previous
  CROSS JOIN LATERAL (SELECT CASE WHEN r.score>previous.score THEN r.n ELSE f.n END AS n) rich
  CROSS JOIN LATERAL (SELECT CASE WHEN r.score>previous.score THEN f.n ELSE r.n END AS n) other
  CROSS JOIN LATERAL (SELECT CASE jsonb_typeof(other.n->'meta')
    WHEN 'object' THEN other.n->'meta'
    WHEN 'array' THEN coalesce((SELECT jsonb_object_agg((e.ordinality-1)::text,e.value)
      FROM jsonb_array_elements(other.n->'meta') WITH ORDINALITY e(value,ordinality)),'{}'::jsonb)
    ELSE '{}'::jsonb END AS value) om
  CROSS JOIN LATERAL (SELECT CASE jsonb_typeof(rich.n->'meta')
    WHEN 'object' THEN rich.n->'meta'
    WHEN 'array' THEN coalesce((SELECT jsonb_object_agg((e.ordinality-1)::text,e.value)
      FROM jsonb_array_elements(rich.n->'meta') WITH ORDINALITY e(value,ordinality)),'{}'::jsonb)
    ELSE '{}'::jsonb END AS value) rm
  LEFT JOIN LATERAL (
    SELECT v.value FROM (VALUES
      (1,rm.value->'body'),(2,rm.value->'comment_body'),
      (3,om.value->'body'),(4,om.value->'comment_body')
    ) v(priority,value)
    WHERE v.value NOT IN ('null'::jsonb,'false'::jsonb,'0'::jsonb,'""'::jsonb)
    ORDER BY v.priority LIMIT 1
  ) body ON true
  CROSS JOIN LATERAL (
    SELECT jsonb_object_agg(k,coalesce(
      nullif(nullif(rich.n->k,'null'::jsonb),'""'::jsonb),
      nullif(nullif(other.n->k,'null'::jsonb),'""'::jsonb),'null'::jsonb)) AS value
    FROM unnest(ARRAY['actor_image_url','actor_name','actor_url','target_title',
      'target_url','source_url','occurred_at']) AS field(k)
  ) fields
),
folded_duplicates AS MATERIALIZED (
  SELECT f.n FROM feed_fold f JOIN duplicate_groups g ON g.semantic_key=f.semantic_key AND g.last_rn=f.rn
), folded_rows AS MATERIALIZED (
  SELECT k.id,k.notification_type,k.raw_text,k.target_url,k.occurred_at,k.captured_at,
    k.m_source,k.m_event_identity,k.m_body,k.m_kind,k.m_classification_status,
    k.m_reclassify_pending,k.m_classifier,k.m_recovery_version,ARRAY[k.id] AS origins
  FROM feed_keyed k WHERE k.group_size=1 AND k.group_displayable
  UNION ALL
  SELECT (n->>'id')::bigint,n->>'notification_type',n->>'raw_text',n->>'target_url',
    (n->>'occurred_at')::timestamptz,(n->>'captured_at')::timestamptz,
    n#>'{meta,source}',n#>'{meta,event_identity}',n#>'{meta,body}',n#>'{meta,kind}',n#>'{meta,classification_status}',
    n#>'{meta,reclassify_pending}',n#>'{meta,classifier}',n#>'{meta,recovery_version}',
    ARRAY(SELECT value::bigint FROM jsonb_array_elements_text(n->'__origins') value)
  FROM folded_duplicates WHERE COALESCE(n->>'notification_type','') NOT IN ('like','follow','comment')
), format_value_walk(id,slot,value,path) AS (
  SELECT r.id,v.slot,v.value,ARRAY[]::bigint[] FROM folded_rows r
  CROSS JOIN LATERAL (VALUES ('body'::text,r.m_body),('identity'::text,r.m_event_identity)) v(slot,value)
  WHERE jsonb_typeof(v.value)='array'
  UNION ALL
  SELECT w.id,w.slot,e.value,w.path||e.position FROM format_value_walk w
  CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(w.value)='array' THEN w.value ELSE '[]'::jsonb END) WITH ORDINALITY e(value,position)
), format_value_text AS (
  SELECT id,slot,string_agg(CASE
    WHEN value IS NULL OR value='null'::jsonb THEN '' WHEN jsonb_typeof(value)='string' THEN value#>>'{}'
    WHEN jsonb_typeof(value)='object' THEN '[object Object]' WHEN jsonb_typeof(value)='array' THEN ''
    WHEN jsonb_typeof(value)='number' THEN trim_scale((value#>>'{}')::numeric)::text ELSE value#>>'{}' END,',' ORDER BY path) AS text
  FROM format_value_walk WHERE jsonb_typeof(value) IS DISTINCT FROM 'array' OR value='[]'::jsonb GROUP BY id,slot
), format_inputs AS NOT MATERIALIZED (
  SELECT r.*,
    CASE jsonb_typeof(m_body)
      WHEN 'string' THEN COALESCE(NULLIF(m_body#>>'{}',''),raw_text,'') WHEN 'object' THEN '[object Object]'
      WHEN 'array' THEN COALESCE((SELECT text FROM format_value_text WHERE id=r.id AND slot='body'),'')
      WHEN 'number' THEN CASE WHEN m_body='0'::jsonb THEN COALESCE(raw_text,'') ELSE trim_scale((m_body#>>'{}')::numeric)::text END
      WHEN 'boolean' THEN CASE WHEN m_body='true'::jsonb THEN 'true' ELSE COALESCE(raw_text,'') END ELSE COALESCE(raw_text,'') END AS body_text,
    CASE WHEN jsonb_typeof(m_event_identity)='string' THEN m_event_identity#>>'{}'
      WHEN jsonb_typeof(m_event_identity)='array' THEN COALESCE((SELECT text FROM format_value_text WHERE id=r.id AND slot='identity'),'') ELSE '' END AS completion_identity,
    CASE WHEN notification_type='other' AND m_kind='"user_badge"'::jsonb THEN 'badge'
      WHEN notification_type='other' AND m_kind='"thank_you_message"'::jsonb THEN 'purchase_message' ELSE notification_type END AS base_type
  FROM folded_rows r
  WHERE COALESCE(notification_type,'') NOT IN ('like','follow','comment')
), format_types AS MATERIALIZED (
  SELECT id,occurred_at,captured_at,target_url,completion_identity,
    m_kind='"qa_answer"'::jsonb AS is_question_answer,m_source='"canonical-public-comments"'::jsonb AS is_canonical,
    m_classification_status='"insufficient_evidence"'::jsonb AS insufficient,
    (COALESCE(m_reclassify_pending,'null'::jsonb) NOT IN ('null'::jsonb,'false'::jsonb,'0'::jsonb,'""'::jsonb) OR m_classifier IS DISTINCT FROM '"action-v28-context"'::jsonb OR m_recovery_version IS DISTINCT FROM '"evidence-v2-articles"'::jsonb) AS reclassify_pending,
    CASE
      WHEN m_kind='"stock_photo"'::jsonb OR (base_type='other' AND body_text ~ '記事であなたの画像を使用しました') THEN 'image_used'
      WHEN (base_type='quote' OR m_kind='"embed_note"'::jsonb) AND translate(body_text,U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF',repeat(' ',25)) ~ 'あなたの記事 *が *話題(です|になりました)' THEN 'buzz'
      WHEN base_type='other' AND body_text ~ ('さん(他[0-9]+名)?が[^'||chr(10)||chr(13)||chr(8232)||chr(8233)||']{0,250}[^'||chr(10)||chr(13)||chr(8232)||chr(8233)||']{0,250}記事を(投稿|更新)しました') THEN 'creator_article_posted'
      ELSE base_type END AS type
  FROM format_inputs
), contexts AS NOT MATERIALIZED (
  SELECT *,COALESCE(lower((regexp_match(target_url,'^[A-Za-z][A-Za-z0-9+.-]*://[^/?#]+/([^/?#]+)/n/'))[1]),'') AS article,
    CASE WHEN target_url ~* '^https://note[.]com/[^/]+/membership([/?#]|$)' THEN lower(split_part(split_part(target_url,'/',4),'?',1)) ELSE '' END AS membership,
    CASE WHEN type='other' AND is_question_answer THEN 'question_answer' ELSE COALESCE(type,'') END AS structured
  FROM format_types
), categorized AS MATERIALIZED (
  SELECT id::text AS id,type AS notification_type,
    CASE WHEN article=p_note_id OR is_canonical THEN 'self' WHEN article<>'' THEN 'other' ELSE 'unknown' END AS article_context,
    NULLIF(article,'') AS article_owner,NULLIF(membership,'') AS membership_owner,
    CASE WHEN type='reply' THEN CASE WHEN article=p_note_id OR is_canonical THEN 'reply_self' WHEN article<>'' THEN 'reply_other' ELSE 'reply_unknown' END
       WHEN type='membership_reaction' THEN CASE WHEN membership=p_note_id THEN 'membership_reaction_self' WHEN membership<>'' THEN 'membership_reaction_joined' ELSE 'membership_reaction_unknown' END ELSE structured END AS category,
    CASE
       WHEN type='comment' THEN CASE WHEN article=p_note_id OR is_canonical THEN '自分の記事へのコメント' WHEN article<>'' THEN '@'||article||' の記事へのコメント' ELSE 'コメント' END
       WHEN type='reply' THEN CASE WHEN article=p_note_id OR is_canonical THEN '自分の記事のコメントへの返信' WHEN article<>'' THEN '@'||article||' の記事で自分のコメントへの返信' ELSE '返信先の記事を確認待ち' END
       WHEN type='comment_like' THEN CASE WHEN article=p_note_id OR is_canonical THEN '自分の記事のコメントへの♡' WHEN article<>'' THEN '@'||article||' の記事コメントへの♡' ELSE 'コメントへの♡' END
       WHEN type='like' THEN CASE WHEN article=p_note_id OR is_canonical THEN '自分の記事へのスキ' WHEN article<>'' THEN '@'||article||' の記事へのスキ' ELSE '記事へのスキ' END
       WHEN type='membership_reaction' THEN CASE WHEN membership=p_note_id THEN '自分のメンシプ反応' WHEN membership<>'' THEN '参加中のメンシプ反応' ELSE 'メンシプ所有者を確認待ち' END
       WHEN structured='question_answer' THEN '質問箱への回答' ELSE '' END AS context_label,
    EXISTS(SELECT 1 FROM public.insight_manual_completions c WHERE c.member_id=p_scope AND c.creator_urlname=p_note_id AND c.item_type='notification' AND c.item_key=CASE WHEN completion_identity ~ '^notice:\d+$' THEN completion_identity ELSE 'row:'||id::text END) AS confirmed,
    insufficient,
    reclassify_pending,
    COALESCE(floor(extract(epoch FROM captured_at)*1000),0) AS captured_ms,
    COALESCE(floor(extract(epoch FROM COALESCE(occurred_at,captured_at))*1000),946684800000) AS event_ms,
    to_char(COALESCE(occurred_at,captured_at) AT TIME ZONE 'Asia/Tokyo','YYYY-MM-DD') AS day
  FROM contexts
), ordered AS NOT MATERIALIZED (
  SELECT * FROM categorized
), day_rows AS MATERIALIZED (
  SELECT * FROM ordered WHERE v_day='' OR day=v_day
), dated AS MATERIALIZED (
  SELECT * FROM day_rows WHERE v_handling='all' OR confirmed=(v_handling='completed')
), selected AS (
  SELECT * FROM dated WHERE v_kind='all' OR category=v_kind
), paged AS MATERIALIZED (
  SELECT * FROM selected ORDER BY captured_ms DESC,event_ms DESC,id COLLATE "C" DESC LIMIT p_page_size OFFSET (p_page::bigint-1)*p_page_size
), previews AS MATERIALIZED (
  SELECT * FROM (SELECT *,row_number() OVER(PARTITION BY category ORDER BY captured_ms DESC,event_ms DESC,id COLLATE "C" DESC) AS category_row FROM dated WHERE p_preview) ranked WHERE category_row<=12
), visible_ids AS (
  SELECT id FROM paged UNION SELECT id FROM previews
), visible AS MATERIALIZED (
  SELECT c.*,r.origins,r.m_body,r.occurred_at,r.captured_at
  FROM visible_ids v JOIN categorized c ON c.id=v.id JOIN folded_rows r ON r.id::text=v.id
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
  FROM visible v JOIN public.insight_notifications winning ON winning.id=v.id::bigint AND winning.member_id=ANY(p_member_ids)
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
       JOIN public.insight_notifications original ON original.id=member.id AND original.member_id=ANY(p_member_ids)
       CROSS JOIN LATERAL jsonb_each(CASE WHEN jsonb_typeof(original.meta)='object' THEN original.meta
         WHEN jsonb_typeof(original.meta)='array' THEN COALESCE((SELECT jsonb_object_agg((a.position-1)::text,a.value) FROM jsonb_array_elements(original.meta) WITH ORDINALITY a(value,position)),'{}'::jsonb) ELSE '{}'::jsonb END) entry) AS merged_meta
    FROM unnest(v.origins) WITH ORDINALITY origin(id,position)
    JOIN public.insight_notifications original ON original.id=origin.id AND original.member_id=ANY(p_member_ids)
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
  WHERE f.member_id=p_scope
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
  SELECT captured_at FROM public.insight_notifications WHERE member_id=ANY(p_member_ids) ORDER BY captured_at DESC LIMIT 1
), last_sync AS (
  SELECT created_at,inserted_count,received_count,source FROM public.insight_notification_sync_runs WHERE member_id=ANY(p_member_ids) AND source='browser-notification-stable-v3-confirmed' ORDER BY created_at DESC LIMIT 1
)
SELECT jsonb_build_object(
  'ok',true,'feedAt',to_char(statement_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'classifierVersion','action-v28-context',
  'page',p_page,'pageSize',p_page_size,'total',(SELECT count(*) FROM selected),
  'rows',COALESCE((SELECT jsonb_agg(d.n ORDER BY p.captured_ms DESC,p.event_ms DESC,p.id COLLATE "C" DESC) FROM paged p JOIN decorated d ON d.id=p.id),'[]'::jsonb),
  'categoryCounts',jsonb_build_object('all',(SELECT count(*) FROM dated))||COALESCE((SELECT value FROM category_counts),'{}'::jsonb),
  'categoryPreview',COALESCE((SELECT value FROM category_preview),'{}'::jsonb),
  'statusCounts',(SELECT jsonb_build_object('all',count(*),'pending',count(*) FILTER(WHERE NOT confirmed),'completed',count(*) FILTER(WHERE confirmed)) FROM day_rows WHERE v_kind='all' OR category=v_kind),
  'handlingStatus',v_handling,'unknownKinds','[]'::jsonb,
  'unresolved',(SELECT jsonb_build_object('remaining',count(*),'insufficient',count(*) FILTER(WHERE insufficient)) FROM ordered WHERE notification_type='other'),
  'reclassifyPending',(SELECT count(*) FROM ordered WHERE notification_type='other' AND reclassify_pending),
  'noteId',p_note_id,'selectedDay',NULLIF(v_day,''),
  'lastUpdatedAt',(SELECT CASE WHEN extract(epoch FROM captured_at)<>0 THEN to_char(captured_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END FROM latest),
  'lastSyncAt',(SELECT created_at FROM last_sync),'lastSyncSource',(SELECT NULLIF(source,'') FROM last_sync),
  'lastSyncInserted',COALESCE((SELECT inserted_count FROM last_sync),0),'lastSyncConfirmed',COALESCE((SELECT inserted_count FROM last_sync),0),'lastSyncReceived',COALESCE((SELECT received_count FROM last_sync),0)
)

  );
END;
$function$;
REVOKE ALL ON FUNCTION public.insight_notification_feed_page(text[],text,text,text,text,text,integer,integer,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.insight_notification_feed_page(text[],text,text,text,text,text,integer,integer,boolean) TO service_role;
COMMENT ON FUNCTION public.insight_notification_feed_page(text[],text,text,text,text,text,integer,integer,boolean)
IS 'Service-only notification page and exact aggregates; caller scope is supplied by authenticated INSIGHT Edge code.';
