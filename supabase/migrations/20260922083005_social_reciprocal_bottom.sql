create table public.insight_social_checks (
 member_id text not null, person_key text not null,
 actor_name text, actor_url text, actor_image_url text,
 source_rank integer not null check(source_rank>0), follows_you boolean not null,
 scan_id text not null, checked_at timestamptz not null, first_checked_at timestamptz not null,
 primary key(member_id,person_key)
);
create table public.insight_social_check_runs (
 member_id text primary key, scan_id text not null, scan_order text not null check(scan_order in ('latest','oldest')),
 official_total integer not null, scanned integer not null, checked_at timestamptz not null, finished boolean not null
);
create table public.insight_social_check_events (
 id bigint generated always as identity primary key, member_id text not null,
 person_key text not null, actor_name text, actor_url text, actor_image_url text,
 source_rank integer not null, official_total integer not null,
 event_type text not null check(event_type in ('added','removed')), detected_at timestamptz not null
);
create index insight_social_checks_scan_idx on public.insight_social_checks(member_id,scan_id,source_rank);
create index insight_social_check_events_scope_idx on public.insight_social_check_events(member_id,event_type,detected_at desc,id desc);
alter table public.insight_social_checks enable row level security;
alter table public.insight_social_check_runs enable row level security;
alter table public.insight_social_check_events enable row level security;
revoke all on public.insight_social_checks,public.insight_social_check_runs,public.insight_social_check_events from public,anon,authenticated;
grant select,insert,update on public.insight_social_checks,public.insight_social_check_runs,public.insight_social_check_events to service_role;
grant usage on sequence public.insight_social_check_events_id_seq to service_role;

create function public.insight_apply_social_checks(p_scope text,p_rows jsonb,p_scan text,p_order text,p_official integer,p_scanned integer,p_at timestamptz,p_finished boolean)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare r jsonb; prior public.insight_social_checks; keys jsonb:='[]'::jsonb;
begin
 if p_scope is null or length(p_scope)=0 or jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)>20 then raise exception 'SOCIAL_PAYLOAD_INVALID'; end if;
 -- Serialize batches from different tabs so a transition is recorded once.
 perform pg_advisory_xact_lock(hashtextextended('social-check:'||p_scope,0));
 for r in select value from jsonb_array_elements(p_rows) loop
  select * into prior from public.insight_social_checks where member_id=p_scope and person_key=r->>'person_key' for update;
  if prior.checked_at is null or prior.checked_at<p_at then
   if prior.checked_at is not null and prior.follows_you<>(r->>'follows_you')::boolean then
    insert into public.insight_social_check_events(member_id,person_key,actor_name,actor_url,actor_image_url,source_rank,official_total,event_type,detected_at)
    values(p_scope,r->>'person_key',r->>'actor_name',r->>'actor_url',r->>'actor_image_url',(r->>'source_rank')::integer,p_official,case when (r->>'follows_you')::boolean then 'added' else 'removed' end,p_at);
   end if;
   insert into public.insight_social_checks(member_id,person_key,actor_name,actor_url,actor_image_url,source_rank,follows_you,scan_id,checked_at,first_checked_at)
   values(p_scope,r->>'person_key',r->>'actor_name',r->>'actor_url',r->>'actor_image_url',(r->>'source_rank')::integer,(r->>'follows_you')::boolean,p_scan,p_at,coalesce(prior.first_checked_at,p_at))
   on conflict(member_id,person_key) do update set actor_name=excluded.actor_name,actor_url=excluded.actor_url,actor_image_url=coalesce(excluded.actor_image_url,insight_social_checks.actor_image_url),source_rank=excluded.source_rank,follows_you=excluded.follows_you,scan_id=excluded.scan_id,checked_at=excluded.checked_at;
  end if;
  keys:=keys||jsonb_build_array(r->>'person_key');
 end loop;
 insert into public.insight_social_check_runs(member_id,scan_id,scan_order,official_total,scanned,checked_at,finished)
 values(p_scope,p_scan,p_order,p_official,p_scanned,p_at,p_finished)
 on conflict(member_id) do update set scan_id=excluded.scan_id,scan_order=excluded.scan_order,official_total=excluded.official_total,scanned=excluded.scanned,checked_at=excluded.checked_at,finished=excluded.finished
 where insight_social_check_runs.checked_at<=excluded.checked_at;
 return keys;
end;
$$;
revoke all on function public.insight_apply_social_checks(text,jsonb,text,text,integer,integer,timestamptz,boolean) from public,anon,authenticated;
grant execute on function public.insight_apply_social_checks(text,jsonb,text,text,integer,integer,timestamptz,boolean) to service_role;
