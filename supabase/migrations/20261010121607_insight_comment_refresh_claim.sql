-- A shared, atomic one-minute cooldown bounds member refresh traffic and
-- prevents the cron and an open comment view from collecting the same scope.
CREATE TABLE IF NOT EXISTS private.insight_comment_refresh_state (
  member_id text PRIMARY KEY,
  started_at timestamptz NOT NULL
);
REVOKE ALL ON private.insight_comment_refresh_state FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION public.insight_comment_refresh_claim(p_member text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE claimed integer;
BEGIN
  IF p_member IS NULL OR length(p_member) = 0 THEN
    RAISE EXCEPTION 'COMMENT_SCOPE_REQUIRED';
  END IF;
  INSERT INTO private.insight_comment_refresh_state(member_id, started_at)
  VALUES (p_member, clock_timestamp())
  ON CONFLICT (member_id) DO UPDATE SET started_at = EXCLUDED.started_at
  WHERE private.insight_comment_refresh_state.started_at <= clock_timestamp() - interval '60 seconds';
  GET DIAGNOSTICS claimed = ROW_COUNT;
  RETURN claimed = 1;
END $fn$;
REVOKE ALL ON FUNCTION public.insight_comment_refresh_claim(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.insight_comment_refresh_claim(text) TO service_role;
