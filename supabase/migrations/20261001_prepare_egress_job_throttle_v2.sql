-- PREP ONLY: isolated V2 background-job throttle.
-- This migration is intentionally NOT applied by creating this file.
-- It does not touch auth/session/member/login tables or existing job tables.

create table if not exists private.insight_egress_job_throttle_v2 (
  job_name text primary key,
  last_started_at timestamptz,
  next_allowed_at timestamptz not null default '-infinity'::timestamptz,
  updated_at timestamptz not null default now()
);

revoke all on table private.insight_egress_job_throttle_v2 from public, anon, authenticated;
grant select, insert, update on table private.insight_egress_job_throttle_v2 to service_role;

create or replace function public.insight_egress_job_acquire_v2(
  p_job_name text,
  p_min_interval_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_next timestamptz;
begin
  if p_job_name is null or btrim(p_job_name) = '' then
    raise exception 'JOB_NAME_REQUIRED';
  end if;

  if p_min_interval_seconds is null or p_min_interval_seconds < 1 then
    raise exception 'INVALID_INTERVAL';
  end if;

  insert into private.insight_egress_job_throttle_v2(job_name, next_allowed_at)
  values (p_job_name, '-infinity'::timestamptz)
  on conflict (job_name) do nothing;

  update private.insight_egress_job_throttle_v2
     set last_started_at = v_now,
         next_allowed_at = v_now + make_interval(secs => p_min_interval_seconds),
         updated_at = v_now
   where job_name = p_job_name
     and next_allowed_at <= v_now
  returning next_allowed_at into v_next;

  if v_next is not null then
    return jsonb_build_object(
      'allowed', true,
      'next_allowed_at', v_next
    );
  end if;

  select next_allowed_at
    into v_next
    from private.insight_egress_job_throttle_v2
   where job_name = p_job_name;

  return jsonb_build_object(
    'allowed', false,
    'next_allowed_at', v_next
  );
end;
$$;

revoke all on function public.insight_egress_job_acquire_v2(text, integer) from public, anon, authenticated;
grant execute on function public.insight_egress_job_acquire_v2(text, integer) to service_role;
