SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='15s';

-- This private projection contains no notification body or metadata. Every
-- source id has a row, including an empty tombstone for an excluded source.
-- Keeping tombstones makes ON CONFLICT DO NOTHING backfills safe when a
-- concurrent non-key UPDATE changes eligibility (KEY SHARE permits that UPDATE).
-- Deliberately no FK: an FK would reject the source's existing TRUNCATE command
-- without CASCADE. Atomic source DELETE/TRUNCATE triggers maintain the boundary.
DO $guard$
BEGIN
  IF to_regprocedure('insight_notification_internal.prepare_format(bigint,text,text,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb)') IS NULL THEN
    RAISE EXCEPTION 'NOTIFICATION_PREPARED_FORMAT_REQUIRED';
  END IF;
END;
$guard$;

CREATE TABLE insight_notification_internal.prepared_rows (
  id bigint PRIMARY KEY,
  member_id text,
  semantic_key text COLLATE "C",
  raw_type text,
  target_url text,
  occurred_at timestamptz,
  captured_at timestamptz,
  format_version smallint NOT NULL DEFAULT 1 CHECK (format_version=1),
  format_type text,
  completion_key text,
  is_question_answer boolean,
  is_canonical boolean,
  insufficient boolean,
  reclassify_pending boolean,
  CONSTRAINT prepared_rows_tombstone CHECK (semantic_key IS NOT NULL OR
    (raw_type IS NULL AND target_url IS NULL AND occurred_at IS NULL AND captured_at IS NULL
      AND format_type IS NULL AND completion_key IS NULL AND is_question_answer IS NULL
      AND is_canonical IS NULL AND insufficient IS NULL AND reclassify_pending IS NULL))
);
CREATE INDEX prepared_rows_member_idx ON insight_notification_internal.prepared_rows(member_id);
ALTER TABLE insight_notification_internal.prepared_rows ENABLE ROW LEVEL SECURITY;
CREATE POLICY prepared_rows_service ON insight_notification_internal.prepared_rows
  FOR ALL TO service_role USING (true) WITH CHECK (true);
REVOKE ALL ON TABLE insight_notification_internal.prepared_rows FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE,TRUNCATE ON TABLE insight_notification_internal.prepared_rows TO service_role;

CREATE FUNCTION insight_notification_internal.project_row(p_row public.insight_notifications)
RETURNS insight_notification_internal.prepared_rows
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER PARALLEL SAFE
SET search_path=''
AS $project$
DECLARE
  result insight_notification_internal.prepared_rows;
  m record;
BEGIN
  result.id:=p_row.id;
  result.member_id:=p_row.member_id;
  result.format_version:=1;
  IF p_row.insight_feed_key IS NULL THEN RETURN result; END IF;
  result.semantic_key:=p_row.insight_feed_key;
  result.raw_type:=p_row.notification_type;
  result.target_url:=p_row.target_url;
  result.occurred_at:=p_row.occurred_at;
  result.captured_at:=p_row.captured_at;
  -- Excluded-only groups are pruned; mixed groups use the original raw fold.
  -- Their singleton formatter fields are never read, so do not parse their body.
  IF p_row.notification_type IN ('like','follow','comment') THEN RETURN result; END IF;
  -- Match the canonical singleton's jsonb_to_record conversion, including
  -- JSON null -> SQL NULL. Duplicate folds retain their separate representation.
  SELECT * INTO m FROM jsonb_to_record(
    CASE WHEN jsonb_typeof(p_row.meta)='object' THEN p_row.meta ELSE '{}'::jsonb END
  ) AS fields(source jsonb,event_identity jsonb,body jsonb,kind jsonb,
    classification_status jsonb,reclassify_pending jsonb,classifier jsonb,recovery_version jsonb);
  SELECT f.notification_type,f.completion_key,f.is_question_answer,f.is_canonical,
    f.insufficient,f.reclassify_pending
  INTO result.format_type,result.completion_key,result.is_question_answer,result.is_canonical,
    result.insufficient,result.reclassify_pending
  FROM insight_notification_internal.prepare_format(p_row.id,p_row.notification_type,p_row.raw_text,
    m.source,m.event_identity,m.body,m.kind,m.classification_status,m.reclassify_pending,
    m.classifier,m.recovery_version) f;
  RETURN result;
END;
$project$;

CREATE FUNCTION insight_notification_internal.sync_prepared_row()
RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY INVOKER
SET search_path=''
AS $sync$
DECLARE
  result insight_notification_internal.prepared_rows;
  cached insight_notification_internal.prepared_rows;
  cache_present boolean:=false;
BEGIN
  IF TG_OP='DELETE' THEN
    DELETE FROM insight_notification_internal.prepared_rows WHERE id=OLD.id;
    RETURN NULL;
  END IF;
  IF TG_OP='UPDATE' THEN
    -- The source uses BY DEFAULT identity and permits id updates. Remove the
    -- previous identity atomically, and recompute row:<id> completion fallbacks.
    IF OLD.id IS DISTINCT FROM NEW.id THEN
      DELETE FROM insight_notification_internal.prepared_rows WHERE id=OLD.id;
    ELSE
      SELECT * INTO cached FROM insight_notification_internal.prepared_rows WHERE id=NEW.id;
      cache_present:=FOUND;
    END IF;
  END IF;
  IF cache_present AND cached.format_version=1
      AND OLD.insight_feed_key IS NOT NULL AND NEW.insight_feed_key IS NOT NULL
      AND OLD.notification_type IS NOT DISTINCT FROM NEW.notification_type
      AND OLD.raw_text IS NOT DISTINCT FROM NEW.raw_text AND OLD.meta IS NOT DISTINCT FROM NEW.meta THEN
    -- Time, scope, URL, key and read-state changes do not need to parse the body.
    result:=cached;
    result.member_id:=NEW.member_id;
    result.semantic_key:=NEW.insight_feed_key;
    result.raw_type:=NEW.notification_type;
    result.target_url:=NEW.target_url;
    result.occurred_at:=NEW.occurred_at;
    result.captured_at:=NEW.captured_at;
  ELSE
    result:=insight_notification_internal.project_row(NEW::public.insight_notifications);
  END IF;
  INSERT INTO insight_notification_internal.prepared_rows AS current
    SELECT (result).*
  ON CONFLICT (id) DO UPDATE SET
    member_id=excluded.member_id,semantic_key=excluded.semantic_key,raw_type=excluded.raw_type,
    target_url=excluded.target_url,occurred_at=excluded.occurred_at,captured_at=excluded.captured_at,
    format_version=excluded.format_version,format_type=excluded.format_type,completion_key=excluded.completion_key,
    is_question_answer=excluded.is_question_answer,is_canonical=excluded.is_canonical,
    insufficient=excluded.insufficient,reclassify_pending=excluded.reclassify_pending
  WHERE ROW(current.member_id,current.semantic_key,current.raw_type,current.target_url,current.occurred_at,
      current.captured_at,current.format_version,current.format_type,current.completion_key,
      current.is_question_answer,current.is_canonical,current.insufficient,current.reclassify_pending)
    IS DISTINCT FROM ROW(excluded.member_id,excluded.semantic_key,excluded.raw_type,excluded.target_url,
      excluded.occurred_at,excluded.captured_at,excluded.format_version,excluded.format_type,
      excluded.completion_key,excluded.is_question_answer,excluded.is_canonical,excluded.insufficient,excluded.reclassify_pending);
  RETURN NULL;
END;
$sync$;

CREATE FUNCTION insight_notification_internal.truncate_prepared_rows()
RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY INVOKER
SET search_path=''
AS $truncate$
BEGIN
  TRUNCATE insight_notification_internal.prepared_rows;
  RETURN NULL;
END;
$truncate$;

CREATE TRIGGER insight_notification_prepare_row
  AFTER INSERT OR UPDATE OR DELETE ON public.insight_notifications
  FOR EACH ROW EXECUTE FUNCTION insight_notification_internal.sync_prepared_row();
CREATE TRIGGER insight_notification_prepare_truncate
  AFTER TRUNCATE ON public.insight_notifications
  FOR EACH STATEMENT EXECUTE FUNCTION insight_notification_internal.truncate_prepared_rows();

-- Administrative cutover gate only. The feed never scans all sources to check
-- readiness. Source/cache writes are atomic after the triggers above are added.
CREATE FUNCTION insight_notification_internal.assert_prepared_rows_complete()
RETURNS void
LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path=''
AS $complete$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.insight_notifications'::regclass
      AND tgname='insight_notification_prepare_row' AND NOT tgisinternal AND tgtype=29
      AND tgenabled IN ('O','A') AND tgfoid='insight_notification_internal.sync_prepared_row()'::regprocedure)
    OR NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.insight_notifications'::regclass
      AND tgname='insight_notification_prepare_truncate' AND NOT tgisinternal AND tgtype=32
      AND tgenabled IN ('O','A') AND tgfoid='insight_notification_internal.truncate_prepared_rows()'::regprocedure) THEN
    RAISE EXCEPTION 'NOTIFICATION_PREPARED_TRIGGERS_REQUIRED';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.insight_notifications n
    FULL JOIN insight_notification_internal.prepared_rows p ON p.id=n.id
    WHERE n.id IS NULL OR p.id IS NULL OR p.format_version<>1
      OR p.member_id IS DISTINCT FROM n.member_id
      OR p.semantic_key IS DISTINCT FROM n.insight_feed_key COLLATE "C"
      OR (n.insight_feed_key IS NOT NULL AND
        (p.raw_type IS DISTINCT FROM n.notification_type OR p.target_url IS DISTINCT FROM n.target_url
          OR p.occurred_at IS DISTINCT FROM n.occurred_at OR p.captured_at IS DISTINCT FROM n.captured_at
          OR CASE WHEN n.notification_type IN ('like','follow','comment') THEN
            (p.format_type IS NOT NULL OR p.completion_key IS NOT NULL OR p.is_question_answer IS NOT NULL
              OR p.is_canonical IS NOT NULL OR p.insufficient IS NOT NULL OR p.reclassify_pending IS NOT NULL)
            ELSE p.completion_key IS NULL END))
      OR (n.insight_feed_key IS NULL AND
        (p.raw_type IS NOT NULL OR p.target_url IS NOT NULL OR p.occurred_at IS NOT NULL OR p.captured_at IS NOT NULL
          OR p.format_type IS NOT NULL OR p.completion_key IS NOT NULL OR p.is_question_answer IS NOT NULL
          OR p.is_canonical IS NOT NULL OR p.insufficient IS NOT NULL OR p.reclassify_pending IS NOT NULL))
  ) THEN
    RAISE EXCEPTION 'NOTIFICATION_PREPARED_ROWS_INCOMPLETE';
  END IF;
END;
$complete$;

REVOKE ALL ON FUNCTION insight_notification_internal.project_row(public.insight_notifications),
  insight_notification_internal.sync_prepared_row(),insight_notification_internal.truncate_prepared_rows(),
  insight_notification_internal.assert_prepared_rows_complete() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION insight_notification_internal.project_row(public.insight_notifications),
  insight_notification_internal.sync_prepared_row(),insight_notification_internal.truncate_prepared_rows(),
  insight_notification_internal.assert_prepared_rows_complete() TO service_role;

COMMENT ON TABLE insight_notification_internal.prepared_rows IS
  'Private v1 derived notification scalars; one row per source id, including excluded tombstones. No body/meta copies. Backfill and assert completeness before feed cutover.';
