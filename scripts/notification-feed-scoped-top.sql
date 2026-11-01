-- Keep exact notification totals, folding and payload semantics unchanged.
-- Only the two top-of-scope metadata reads change: one indexed top row per
-- authenticated scope, then the same global ordering. No new public API.
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='15s';

DO $patch$
DECLARE
  v_rpc regprocedure:='public.insight_notification_feed_page(text[],text,text,text,text,text,integer,integer,boolean)'::regprocedure;
  v_definition text;
  v_source text;
  v_expected_source text;
  v_security jsonb;
  v_after_security jsonb;
  v_old_latest text:=$old_latest$SELECT captured_at FROM public.insight_notifications WHERE member_id=ANY($1) ORDER BY captured_at DESC LIMIT 1$old_latest$;
  v_new_latest text:=$new_latest$SELECT newest.captured_at
  FROM unnest($1) AS scope(member_id)
  CROSS JOIN LATERAL (
    SELECT n.captured_at FROM public.insight_notifications n
    WHERE n.member_id=scope.member_id ORDER BY n.captured_at DESC LIMIT 1
  ) newest
  ORDER BY newest.captured_at DESC LIMIT 1$new_latest$;
  v_old_sync text:=$old_sync$SELECT created_at,inserted_count,received_count,source FROM public.insight_notification_sync_runs WHERE member_id=ANY($1) AND source='browser-notification-stable-v3-confirmed' ORDER BY created_at DESC LIMIT 1$old_sync$;
  v_new_sync text:=$new_sync$SELECT newest.created_at,newest.inserted_count,newest.received_count,newest.source
  FROM unnest($1) AS scope(member_id)
  CROSS JOIN LATERAL (
    SELECT r.created_at,r.inserted_count,r.received_count,r.source
    FROM public.insight_notification_sync_runs r
    WHERE r.member_id=scope.member_id AND r.source='browser-notification-stable-v3-confirmed'
    ORDER BY r.created_at DESC LIMIT 1
  ) newest
  ORDER BY newest.created_at DESC LIMIT 1$new_sync$;
BEGIN
  SELECT pg_get_functiondef(p.oid),p.prosrc,
    jsonb_build_object('owner',p.proowner,'acl',p.proacl::text,'volatility',p.provolatile,
      'security_definer',p.prosecdef,'parallel',p.proparallel,'strict',p.proisstrict,
      'config',to_jsonb(p.proconfig))
  INTO v_definition,v_source,v_security FROM pg_proc p WHERE p.oid=v_rpc;
  IF md5(v_source) IS DISTINCT FROM '77c56df0bd92a570bc057a088323535e'
     OR strpos(v_source,v_old_latest)=0 OR strpos(v_source,v_old_sync)=0
     OR (SELECT proacl::text FROM pg_proc WHERE oid=v_rpc) IS DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres}'
  THEN RAISE EXCEPTION 'Notification feed scoped-top prerequisite differs'; END IF;
  -- A partial metadata-only index keeps this addition small. Existing rows,
  -- raw notification bodies and archive storage are not copied or changed.
  CREATE INDEX insight_notification_sync_runs_confirmed_scope_latest_idx
    ON public.insight_notification_sync_runs(member_id,created_at DESC)
    INCLUDE(inserted_count,received_count,source)
    WHERE source='browser-notification-stable-v3-confirmed';
  v_expected_source:=replace(replace(v_source,v_old_latest,v_new_latest),v_old_sync,v_new_sync);
  v_definition:=replace(replace(v_definition,v_old_latest,v_new_latest),v_old_sync,v_new_sync);
  EXECUTE v_definition;
  SELECT jsonb_build_object('owner',p.proowner,'acl',p.proacl::text,'volatility',p.provolatile,
      'security_definer',p.prosecdef,'parallel',p.proparallel,'strict',p.proisstrict,
      'config',to_jsonb(p.proconfig))
  INTO v_after_security FROM pg_proc p WHERE p.oid=v_rpc;
  IF (SELECT prosrc FROM pg_proc WHERE oid=v_rpc) IS DISTINCT FROM v_expected_source
     OR v_after_security IS DISTINCT FROM v_security
  THEN RAISE EXCEPTION 'Notification scoped-top verification failed'; END IF;
END;
$patch$;

