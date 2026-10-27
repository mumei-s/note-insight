-- Current relationship is a dated projection; source observations remain intact.
create or replace view public.insight_social_current_people
with (security_invoker = true) as
with keys as not materialized (
 select member_id,person_key from public.insight_relations
 union
 select member_id,person_key from public.insight_social_comparisons
), resolved as not materialized (
 select k.member_id,k.person_key,
  coalesce(comparison.actor_name,following_list.actor_name,follower_list.actor_name) as actor_name,
  coalesce(comparison.actor_url,following_list.actor_url,follower_list.actor_url) as actor_url,
  coalesce(comparison.actor_image_url,following_list.actor_image_url,follower_list.actor_image_url) as actor_image_url,
  following.present as is_following,follower.present as is_follower,
  following.verified_at as following_verified_at,follower.verified_at as follower_verified_at,
  following.evidence as following_evidence,follower.evidence as follower_evidence,
  coalesce(following_list.source_rank,comparison.following_rank) as following_rank,
  coalesce(follower_list.source_rank,comparison.follower_rank) as follower_rank,
  least(following_list.first_seen_at,follower_list.first_seen_at,comparison.first_checked_at) as first_seen_at,
  comparison.lost_at as saved_lost_at,comparison.gained_at as saved_gained_at
 from keys k
 left join public.insight_relations following_list
  on following_list.member_id=k.member_id and following_list.person_key=k.person_key
   and following_list.direction='followings'
 left join public.insight_relations follower_list
  on follower_list.member_id=k.member_id and follower_list.person_key=k.person_key
   and follower_list.direction='followers'
 left join public.insight_social_comparisons comparison
  on comparison.member_id=k.member_id and comparison.person_key=k.person_key
 left join lateral (
  select h.is_following as present,h.observed_at
  from public.insight_social_comparison_history h
  where h.member_id=k.member_id and h.person_key=k.person_key
   and h.is_following is not null
  order by h.observed_at desc,h.id desc limit 1
 ) following_history on true
 left join lateral (
  select h.is_follower as present,h.observed_at
  from public.insight_social_comparison_history h
  where h.member_id=k.member_id and h.person_key=k.person_key
   and h.is_follower is not null
  order by h.observed_at desc,h.id desc limit 1
 ) follower_history on true
 left join lateral (
  select s.created_at from public.insight_relation_sync_runs s
  where s.member_id=k.member_id and s.direction='followings' and s.complete is true
  order by s.created_at desc,s.id desc limit 1
 ) following_complete on true
 left join lateral (
  select s.created_at from public.insight_relation_sync_runs s
  where s.member_id=k.member_id and s.direction='followers' and s.complete is true
  order by s.created_at desc,s.id desc limit 1
 ) follower_complete on true
 left join lateral (
  select observations.present,observations.verified_at,observations.evidence
  from (values
   (true,following_list.last_seen_at,'saved_list'::text),
   (comparison.is_following,comparison.checked_at,'authenticated_relationship'::text),
   (following_history.present,following_history.observed_at,'authenticated_relationship'::text),
   (false,case when coalesce(following_list.active,false) is false
    and (following_list.last_changed_at is null
     or following_list.last_changed_at<=following_complete.created_at)
    then following_complete.created_at end,'complete_snapshot'::text)
  ) observations(present,verified_at,evidence)
  where observations.present is not null and observations.verified_at is not null
  -- A concurrent positive is enough to prevent a false negative.
  order by observations.verified_at desc,observations.present desc,
   (observations.evidence='authenticated_relationship') desc
  limit 1
 ) following on true
 left join lateral (
  select observations.present,observations.verified_at,observations.evidence
  from (values
   (true,follower_list.last_seen_at,'saved_list'::text),
   (comparison.is_follower,comparison.checked_at,'authenticated_relationship'::text),
   (follower_history.present,follower_history.observed_at,'authenticated_relationship'::text),
   (false,case when coalesce(follower_list.active,false) is false
    and (follower_list.last_changed_at is null
     or follower_list.last_changed_at<=follower_complete.created_at)
    then follower_complete.created_at end,'complete_snapshot'::text)
  ) observations(present,verified_at,evidence)
  where observations.present is not null and observations.verified_at is not null
  order by observations.verified_at desc,observations.present desc,
   (observations.evidence='authenticated_relationship') desc
  limit 1
 ) follower on true
)
select r.member_id,r.person_key,r.actor_name,r.actor_url,r.actor_image_url,
 r.is_following,r.is_follower,
 case when r.is_following is true and r.is_follower is true then 'mutual'
  when r.is_following is true and r.is_follower is false then 'following_only'
  when r.is_following is false and r.is_follower is true then 'follower_only'
  when r.is_following is false and r.is_follower is false then 'none'
  else 'unknown' end::text as relation,
 greatest(r.following_verified_at,r.follower_verified_at) as checked_at,
 case when r.following_evidence=r.follower_evidence then r.following_evidence
  when r.following_evidence is null then r.follower_evidence
  when r.follower_evidence is null then r.following_evidence
  else 'mixed' end::text as evidence,
 (r.is_following is not null and r.is_follower is not null) as identity_exact,
 r.following_verified_at,r.follower_verified_at,r.following_evidence,r.follower_evidence,
 r.following_rank,r.follower_rank,r.first_seen_at,
 case when r.is_following is true and r.is_follower is false
  then r.saved_lost_at end as lost_at,
 case when r.is_following is true and r.is_follower is true
  then r.saved_gained_at end as gained_at
from resolved r;

revoke all on public.insight_social_current_people from public,anon,authenticated;
grant select on public.insight_social_current_people to service_role;
comment on view public.insight_social_current_people is
 'Service-only latest dated evidence per relationship direction. Window absence alone is not negative evidence, and unknown remains null.';

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
   then p.is_follower is true and p.follower_verified_at>h.detected_at
   else p.is_following is true and p.following_verified_at>h.detected_at end,false))
  as candidate_resolved
from public.insight_relation_history_rows h
left join public.insight_social_current_people p
 on p.member_id=h.member_id and p.person_key=h.person_key;

revoke all on public.insight_relation_history_current from public,anon,authenticated;
grant select on public.insight_relation_history_current to service_role;
comment on view public.insight_relation_history_current is
 'Service-only dated current relationship projection. Resolved window candidates remain auditable; exact historical losses survive a re-follow.';

create or replace function public.insight_social_history_summary(
 p_member text,
 p_direction text default 'all',
 p_from timestamptz default null,
 p_to timestamptz default null,
 p_query text default null
) returns jsonb language sql stable security invoker set search_path='' as $$
 with filtered as not materialized (
  select h.* from public.insight_relation_history_current h
  where h.member_id=p_member
    and (p_direction not in ('followers','followings') or h.direction=p_direction)
    and h.event_type='removed'
    and (p_from is null or h.detected_at>=p_from)
    and (p_to is null or h.detected_at<p_to)
    and (nullif(p_query,'') is null or h.actor_name ilike '%'||p_query||'%'
      or h.actor_url ilike '%'||p_query||'%')
 ), totals as (
  select coalesce(sum(greatest(change_count,0)) filter(where identity_exact is true),0) as confirmed,
    coalesce(sum(greatest(change_count,0)) filter(where person_key like 'unknown:%'),0) as unknown_count,
    count(distinct person_key) filter(where identity_exact is not true
      and person_key not like 'unknown:%' and candidate_resolved is not true) as unresolved,
    count(distinct person_key) filter(where candidate_resolved is true) as resolved
  from filtered
 ), saved as (
  select count(distinct r.person_key) as n from public.insight_relations r
  where r.member_id=p_member
    and (p_direction not in ('followers','followings') or r.direction=p_direction)
    and (nullif(p_query,'') is null or r.actor_name ilike '%'||p_query||'%'
      or r.actor_url ilike '%'||p_query||'%')
 ), latest as (
  select distinct on(s.direction) s.direction,s.received_count,s.expected_count,s.complete,s.created_at
  from public.insight_relation_sync_runs s where s.member_id=p_member
    and (p_direction not in ('followers','followings') or s.direction=p_direction)
  order by s.direction,s.created_at desc,s.id desc
 )
 select jsonb_build_object(
  'confirmedRemoved',totals.confirmed,'unknownDecrease',totals.unknown_count,
  'unresolvedCandidates',totals.unresolved,'resolvedCandidates',totals.resolved,
  'savedPeople',saved.n,
  'coverage',coalesce((select jsonb_object_agg(direction,jsonb_build_object(
    'received',received_count,'expected',expected_count,'complete',complete,'at',created_at))
    from latest),'{}'::jsonb)
 ) from totals cross join saved;
$$;
revoke all on function public.insight_social_history_summary(text,text,timestamptz,timestamptz,text)
  from public,anon,authenticated;
grant execute on function public.insight_social_history_summary(text,text,timestamptz,timestamptz,text)
  to service_role;
comment on function public.insight_social_history_summary(text,text,timestamptz,timestamptz,text) is
  'Service-only history totals with explicit uncertainty. savedPeople and coverage describe saved population; event totals obey the supplied time and search filters.';
