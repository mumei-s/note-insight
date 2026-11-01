-- Exact bounded raw-recent selection. Authenticated Edge code supplies the
-- verified one/two member scopes; no browser role can execute this RPC.
-- Pick IDs before reading metadata, and keep the original raw 300-row boundary.
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='15s';

CREATE FUNCTION public.insight_notification_recent_rows(
  p_member_ids text[], p_since text DEFAULT ''
) RETURNS TABLE (
  id bigint,member_id text,notification_type text,raw_text text,
  actor_name text,actor_url text,actor_image_url text,target_title text,
  target_url text,source_url text,occurred_at timestamptz,captured_at timestamptz,
  is_read boolean,meta jsonb
)
LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path=''
SET plan_cache_mode='force_custom_plan'
AS $recent$
DECLARE
  v_since text:=COALESCE(p_since,'');
  v_cutoff timestamptz;
BEGIN
  IF p_member_ids IS NULL OR cardinality(p_member_ids) NOT BETWEEN 1 AND 2
     OR EXISTS(SELECT 1 FROM unnest(p_member_ids) scope(id)
       WHERE scope.id IS NULL OR btrim(scope.id)='' OR length(scope.id)>100)
     OR length(v_since)>100
  THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_NOTIFICATION_RECENT_PARAMETERS'; END IF;
  IF v_since='' THEN
    RETURN QUERY
    WITH candidates AS MATERIALIZED (
      SELECT recent.id,recent.captured_at
      FROM (SELECT DISTINCT scope.id FROM unnest(p_member_ids) scope(id)) scopes
      CROSS JOIN LATERAL (
        SELECT n.id,n.captured_at FROM public.insight_notifications n
        WHERE n.member_id=scopes.id
          AND n.notification_type NOT IN ('like','follow','comment','capture_noise')
        ORDER BY n.captured_at DESC,n.id ASC LIMIT 300
      ) recent
    ), picked AS MATERIALIZED (
      SELECT c.id,c.captured_at FROM candidates c
      ORDER BY c.captured_at DESC,c.id ASC LIMIT 300
    )
    SELECT n.id,n.member_id,n.notification_type,n.raw_text,n.actor_name,n.actor_url,
      n.actor_image_url,n.target_title,n.target_url,n.source_url,n.occurred_at,
      n.captured_at,n.is_read,n.meta
    FROM picked p JOIN public.insight_notifications n
      ON n.id=p.id AND n.member_id=ANY(p_member_ids)
    ORDER BY p.captured_at DESC,p.id ASC;
    RETURN;
  END IF;
  BEGIN
    v_cutoff:=v_since::timestamptz;
  EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_NOTIFICATION_RECENT_PARAMETERS';
  END;
  RETURN QUERY
  WITH scopes AS MATERIALIZED (
    SELECT DISTINCT scope.id FROM unnest(p_member_ids) scope(id)
  ), candidates AS MATERIALIZED (
    SELECT recent.id,recent.captured_at FROM scopes
    CROSS JOIN LATERAL (
      SELECT n.id,n.captured_at FROM public.insight_notifications n
      WHERE n.member_id=scopes.id
        AND n.notification_type NOT IN ('like','follow','comment','capture_noise')
        AND n.captured_at>=v_cutoff
      ORDER BY n.captured_at DESC,n.id ASC LIMIT 300
    ) recent
    UNION
    SELECT recent.id,recent.captured_at FROM scopes
    CROSS JOIN LATERAL (
      SELECT n.id,n.captured_at FROM public.insight_notifications n
      WHERE n.member_id=scopes.id
        AND n.notification_type NOT IN ('like','follow','comment','capture_noise')
        -- Keep the existing text comparison even for legacy/non-ISO metadata.
        AND n.meta->>'last_reclassified_at'>=v_since
      ORDER BY n.captured_at DESC,n.id ASC LIMIT 300
    ) recent
  ), picked AS MATERIALIZED (
    SELECT c.id,c.captured_at FROM candidates c
    ORDER BY c.captured_at DESC,c.id ASC LIMIT 300
  )
  SELECT n.id,n.member_id,n.notification_type,n.raw_text,n.actor_name,n.actor_url,
    n.actor_image_url,n.target_title,n.target_url,n.source_url,n.occurred_at,
    n.captured_at,n.is_read,n.meta
  FROM picked p JOIN public.insight_notifications n
    ON n.id=p.id AND n.member_id=ANY(p_member_ids)
  ORDER BY p.captured_at DESC,p.id ASC;
END;
$recent$;

REVOKE ALL ON FUNCTION public.insight_notification_recent_rows(text[],text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.insight_notification_recent_rows(text[],text) TO service_role;
