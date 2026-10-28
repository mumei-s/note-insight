-- Keep the last confirmed relationship when a capped list no longer includes
-- a person. This changes display classification only, never evidence or dates.
create or replace view public.insight_relation_history_current
with (security_invoker = true) as
select h.*,coalesce(p.relation,'unknown') as current_relation,
 p.is_following as current_is_following,p.is_follower as current_is_follower,
 p.checked_at as current_verified_at,
 p.following_verified_at as current_following_verified_at,
 p.follower_verified_at as current_follower_verified_at,
 case when h.direction='followers' then p.follower_evidence
  else p.following_evidence end::text as current_evidence,
 case when h.direction='followers' then p.is_follower
  else p.is_following end as current_direction_present,
 case when h.direction='followers' then p.follower_verified_at
  else p.following_verified_at end as current_direction_verified_at,
 (h.event_type='removed' and h.identity_exact is not true
  and h.person_key not like 'unknown:%'
  and coalesce(case when h.direction='followers'
   then p.is_follower is true
   else p.is_following is true end,false))
  as candidate_resolved
from public.insight_relation_history_rows h
left join public.insight_social_current_people p
 on p.member_id=h.member_id and p.person_key=h.person_key;

revoke all on public.insight_relation_history_current from public,anon,authenticated;
grant select on public.insight_relation_history_current to service_role;
comment on view public.insight_relation_history_current is
 'Service-only latest saved relationship projection. A capped-window exit cannot erase the last confirmed positive. Original evidence dates and exact past losses remain unchanged.';


-- An explicit refresh may still check an older known relationship.
create or replace function public.insight_social_pending_history_candidates(
 p_member text,p_after text default '',p_limit integer default 20
) returns jsonb
language sql stable security invoker set search_path='' as $function$
 with unresolved as not materialized (
  select h.person_key,h.actor_name,h.actor_url,h.detected_at
  from public.insight_relation_history_current h
  where h.member_id=p_member and h.person_key>coalesce(p_after,'')
    and h.event_type='removed' and h.identity_exact is not true
    and h.person_key not like 'unknown:%'
    -- The display restores the latest known positive. A later window exit can
    -- still request an explicit refresh without calling that person unfollowed.
    and (h.candidate_resolved is not true
      or h.current_direction_verified_at<=h.detected_at)
    and not coalesce(h.current_direction_present is false
      and h.current_direction_verified_at>=h.detected_at,false)
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
 'Service-only keyset refresh queue, separate from display uncertainty. Older saved positives outside the capped window can be refreshed; newer confirmed relationships and fresh complete checks are reused.';
