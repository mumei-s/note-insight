-- Applied on 2026-09-30. Do not resume jobs until quota and participant smoke tests pass.
CREATE TABLE IF NOT EXISTS private.insight_egress_job_backup (jobname text PRIMARY KEY, original_schedule text NOT NULL, original_active boolean NOT NULL, paused_at timestamptz NOT NULL DEFAULT now());
REVOKE ALL ON private.insight_egress_job_backup FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS private.insight_egress_control (singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton), maintenance boolean NOT NULL DEFAULT true, reason text NOT NULL DEFAULT 'egress_quota_maintenance', updated_at timestamptz NOT NULL DEFAULT now());
REVOKE ALL ON private.insight_egress_control FROM PUBLIC, anon, authenticated;
INSERT INTO private.insight_egress_control(singleton,maintenance) VALUES(true,true) ON CONFLICT(singleton) DO NOTHING;
INSERT INTO private.insight_egress_job_backup(jobname,original_schedule,original_active) SELECT jobname,schedule,active FROM cron.job WHERE jobname IN ('insight-relations-full-sync','insight-public-notification-watch','insight-comment-refresh','insight-avatar-refresh','insight-like-backfill') ON CONFLICT(jobname) DO NOTHING;
DO $pause$ DECLARE j record; BEGIN FOR j IN SELECT jobid FROM cron.job WHERE jobname IN ('insight-relations-full-sync','insight-public-notification-watch','insight-comment-refresh','insight-avatar-refresh','insight-like-backfill') AND active LOOP PERFORM cron.alter_job(j.jobid,active:=false); END LOOP; END $pause$;
CREATE OR REPLACE FUNCTION public.insight_background_maintenance() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $fn$ SELECT COALESCE((SELECT maintenance FROM private.insight_egress_control WHERE singleton=true),true); $fn$;
REVOKE ALL ON FUNCTION public.insight_background_maintenance() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.insight_background_maintenance() TO service_role;
