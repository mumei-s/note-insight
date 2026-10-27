-- Recheck unresolved saved identities without rereading active known people.
-- The older all-history helper remains available for full scans and old clients.
create or replace function public.insight_social_pending_history_candidates(
 p_member text,p_after text default '',p_limit integer default 20
) returns jsonb
language sql stable security invoker set search_path='' as $function$
 with unresolved as not materialized (
  select h.person_key,h.actor_name,h.actor_url,h.detected_at
  from public.insight_relation_history_current h
  where h.member_id=p_member and h.person_key>coalesce(p_after,'')
    and h.event_type='removed' and h.identity_exact is not true
    and h.candidate_resolved is not true and h.person_key not like 'unknown:%'
 ), identities as (
  select u.person_key,u.actor_name,u.actor_url,u.detected_at as required_at
  from unresolved u
  union all
  select p.person_key,p.actor_name,p.actor_url,null::timestamptz as required_at
  from public.insight_social_current_people p
  where p.member_id=p_member and p.person_key>coalesce(p_after,'')
    and p.relation='unknown' and p.person_key not like 'unknown:%'
 ), people as (
  select distinct on(i.person_key) i.person_key,i.actor_name,i.actor_url,i.required_at
  from identities i
  where i.actor_url ~ '^https://note[.]com/[A-Za-z0-9_-]+/?$'
  order by i.person_key,i.required_at desc nulls last,i.actor_url,i.actor_name
 ), candidates as (
  select p.person_key,p.actor_name,p.actor_url
  from people p
  left join public.insight_social_comparisons c
    on c.member_id=p_member and c.person_key=p.person_key
  where c.person_key is null or c.is_following is null or c.is_follower is null
    or c.checked_at<now()-interval '1 day' or c.checked_at<p.required_at
 ), batch as (
  select * from candidates order by person_key
  limit greatest(1,least(coalesce(p_limit,20),100))
 )
 select jsonb_build_object(
  'rows',coalesce((select jsonb_agg(to_jsonb(b) order by b.person_key) from batch b),'[]'::jsonb),
  'remaining',(select count(*) from candidates),
  'nextCursor',case when (select count(*) from candidates)>(select count(*) from batch)
    then (select max(person_key) from batch) else null end
 );
$function$;
revoke all on function public.insight_social_pending_history_candidates(text,text,integer)
 from public,anon,authenticated;
grant execute on function public.insight_social_pending_history_candidates(text,text,integer)
 to service_role;
comment on function public.insight_social_pending_history_candidates(text,text,integer) is
 'Service-only keyset batches for unresolved named removal observations and unknown relationships. Fresh complete checks are reused unless a later pending observation needs verification.';
