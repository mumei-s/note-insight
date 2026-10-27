SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='15s';

-- One pure formatter serves both saved singleton rows and the ordered duplicate
-- fold. Callers retain their existing SQL NULL / JSON null representation.
CREATE FUNCTION insight_notification_internal.prepare_format(
  p_id bigint,p_notification_type text,p_raw_text text,
  p_source jsonb,p_event_identity jsonb,p_body jsonb,p_kind jsonb,
  p_classification_status jsonb,p_reclassify_pending jsonb,
  p_classifier jsonb,p_recovery_version jsonb
) RETURNS TABLE(
  notification_type text,completion_key text,is_question_answer boolean,
  is_canonical boolean,insufficient boolean,reclassify_pending boolean
)
LANGUAGE sql IMMUTABLE SECURITY INVOKER PARALLEL SAFE CALLED ON NULL INPUT
SET search_path=''
AS $prepare$
WITH RECURSIVE format_value_walk(slot,value,path) AS (
  SELECT v.slot,v.value,ARRAY[]::bigint[]
  FROM (VALUES ('body'::text,p_body),('identity'::text,p_event_identity)) v(slot,value)
  WHERE jsonb_typeof(v.value)='array'
  UNION ALL
  SELECT w.slot,e.value,w.path||e.position
  FROM format_value_walk w
  CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(w.value)='array' THEN w.value ELSE '[]'::jsonb END) WITH ORDINALITY e(value,position)
), format_value_text AS (
  SELECT slot,string_agg(CASE
    WHEN value IS NULL OR value='null'::jsonb THEN '' WHEN jsonb_typeof(value)='string' THEN value#>>'{}'
    WHEN jsonb_typeof(value)='object' THEN '[object Object]' WHEN jsonb_typeof(value)='array' THEN ''
    WHEN jsonb_typeof(value)='number' THEN trim_scale((value#>>'{}')::numeric)::text ELSE value#>>'{}' END,',' ORDER BY path) AS text
  FROM format_value_walk
  WHERE jsonb_typeof(value) IS DISTINCT FROM 'array' OR value='[]'::jsonb
  GROUP BY slot
), format_inputs AS (
  SELECT
    CASE jsonb_typeof(p_body)
      WHEN 'string' THEN COALESCE(NULLIF(p_body#>>'{}',''),p_raw_text,'') WHEN 'object' THEN '[object Object]'
      WHEN 'array' THEN COALESCE((SELECT text FROM format_value_text WHERE slot='body'),'')
      WHEN 'number' THEN CASE WHEN p_body='0'::jsonb THEN COALESCE(p_raw_text,'') ELSE trim_scale((p_body#>>'{}')::numeric)::text END
      WHEN 'boolean' THEN CASE WHEN p_body='true'::jsonb THEN 'true' ELSE COALESCE(p_raw_text,'') END ELSE COALESCE(p_raw_text,'') END AS body_text,
    CASE WHEN jsonb_typeof(p_event_identity)='string' THEN p_event_identity#>>'{}'
      WHEN jsonb_typeof(p_event_identity)='array' THEN COALESCE((SELECT text FROM format_value_text WHERE slot='identity'),'') ELSE '' END AS completion_identity,
    CASE WHEN p_notification_type='other' AND p_kind='"user_badge"'::jsonb THEN 'badge'
      WHEN p_notification_type='other' AND p_kind='"thank_you_message"'::jsonb THEN 'purchase_message'
      WHEN p_notification_type='other' AND p_kind='"store_create"'::jsonb THEN 'store_started' ELSE p_notification_type END AS base_type
)
SELECT
  CASE
    WHEN p_kind='"stock_photo"'::jsonb OR (base_type='other' AND body_text ~ '記事であなたの画像を使用しました') THEN 'image_used'
    WHEN (base_type='quote' OR p_kind='"embed_note"'::jsonb) AND translate(body_text,U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF',repeat(' ',25)) ~ 'あなたの記事 *が *話題(です|になりました)' THEN 'buzz'
    WHEN base_type='other' AND body_text ~ ('さん(他[0-9]+名)?が[^'||chr(10)||chr(13)||chr(8232)||chr(8233)||']{0,250}[^'||chr(10)||chr(13)||chr(8232)||chr(8233)||']{0,250}記事を(投稿|更新)しました') THEN 'creator_article_posted'
    ELSE base_type END,
  CASE WHEN completion_identity ~ '^notice:\d+$' THEN completion_identity ELSE 'row:'||p_id::text END,
  p_kind='"qa_answer"'::jsonb,p_source='"canonical-public-comments"'::jsonb,
  p_classification_status='"insufficient_evidence"'::jsonb,
  (COALESCE(p_reclassify_pending,'null'::jsonb) NOT IN ('null'::jsonb,'false'::jsonb,'0'::jsonb,'""'::jsonb)
    OR p_classifier IS DISTINCT FROM '"action-v28-context"'::jsonb OR p_recovery_version IS DISTINCT FROM '"evidence-v2-articles"'::jsonb)
FROM format_inputs;
$prepare$;

REVOKE ALL ON FUNCTION insight_notification_internal.prepare_format(bigint,text,text,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION insight_notification_internal.prepare_format(bigint,text,text,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb) TO service_role;
