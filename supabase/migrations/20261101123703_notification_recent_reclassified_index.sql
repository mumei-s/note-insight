-- Keep the original text comparison, including legacy non-ISO metadata, while
-- avoiding an ordered full-history JSON scan when there are no reclassifications.
-- Bound index keys physically; oversized legacy values use an exact fallback.
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='15s';

DO $guard$
BEGIN
  IF (SELECT md5(prosrc) FROM pg_proc
      WHERE oid=to_regprocedure('public.insight_notification_recent_rows(text[],text)'))
      IS DISTINCT FROM 'e719de4dd2c1c7a16586a4de1e8c1a92' THEN
    RAISE EXCEPTION 'Notification recent RPC differs from the reviewed prerequisite';
  END IF;
END;
$guard$;

CREATE INDEX insight_notification_recent_reclassified_short_idx
ON public.insight_notifications(member_id,((meta->>'last_reclassified_at')))
INCLUDE(id,captured_at)
WHERE notification_type NOT IN ('like','follow','comment','capture_noise')
  AND octet_length(COALESCE(member_id,''))::bigint+octet_length(meta->>'last_reclassified_at')<=1800;

CREATE INDEX insight_notification_recent_reclassified_long_idx
ON public.insight_notifications(member_id,captured_at DESC,id ASC)
WHERE notification_type NOT IN ('like','follow','comment','capture_noise')
  AND octet_length(COALESCE(member_id,''))::bigint+octet_length(meta->>'last_reclassified_at')>1800;

DO $patch$
DECLARE
  v_rpc regprocedure:='public.insight_notification_recent_rows(text[],text)'::regprocedure;
  v_definition text;
  v_previous text:=$old$
    SELECT recent.id,recent.captured_at FROM scopes
    CROSS JOIN LATERAL (
      SELECT n.id,n.captured_at FROM public.insight_notifications n
      WHERE n.member_id=scopes.id
        AND n.notification_type NOT IN ('like','follow','comment','capture_noise')
        -- Keep the existing text comparison even for legacy/non-ISO metadata.
        AND n.meta->>'last_reclassified_at'>=v_since
      ORDER BY n.captured_at DESC,n.id ASC LIMIT 300
    ) recent$old$;
  v_replacement text:=$new$
    SELECT recent.id,recent.captured_at FROM scopes
    CROSS JOIN LATERAL (
      SELECT n.id,n.captured_at FROM public.insight_notifications n
      WHERE n.member_id=scopes.id
        AND n.notification_type NOT IN ('like','follow','comment','capture_noise')
        AND octet_length(COALESCE(n.member_id,''))::bigint+octet_length(n.meta->>'last_reclassified_at')<=1800
        AND n.meta->>'last_reclassified_at'>=v_since
      ORDER BY n.captured_at DESC,n.id ASC LIMIT 300
    ) recent
    UNION
    SELECT recent.id,recent.captured_at FROM scopes
    CROSS JOIN LATERAL (
      SELECT n.id,n.captured_at FROM public.insight_notifications n
      WHERE n.member_id=scopes.id
        AND n.notification_type NOT IN ('like','follow','comment','capture_noise')
        AND octet_length(COALESCE(n.member_id,''))::bigint+octet_length(n.meta->>'last_reclassified_at')>1800
        AND n.meta->>'last_reclassified_at'>=v_since
      ORDER BY n.captured_at DESC,n.id ASC LIMIT 300
    ) recent$new$;
BEGIN
  SELECT pg_get_functiondef(v_rpc) INTO v_definition;
  IF strpos(v_definition,v_previous)=0
     OR strpos(substr(v_definition,strpos(v_definition,v_previous)+length(v_previous)),v_previous)>0 THEN
    RAISE EXCEPTION 'Notification recent RPC reclassification branch is not unique';
  END IF;
  EXECUTE replace(v_definition,v_previous,v_replacement);
  IF (SELECT prosecdef OR provolatile<>'s'
      OR proconfig IS DISTINCT FROM ARRAY['search_path=""','plan_cache_mode=force_custom_plan']
      OR proowner::regrole::text<>'postgres'
      OR proacl::text IS DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres}'
      FROM pg_proc WHERE oid=v_rpc) THEN
    RAISE EXCEPTION 'Notification recent RPC security attributes changed';
  END IF;
END;
$patch$;
