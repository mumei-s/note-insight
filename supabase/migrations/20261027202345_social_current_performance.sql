-- Read each scoped complete snapshot once, rather than once per saved person.
-- Current relationship is a dated projection; source observations remain intact.
create or replace view public.insight_social_current_people
with (security_invoker = true) as
with keys as not materialized (
 select member_id,person_key from public.insight_relations
 union
 select member_id,person_key from public.insight_social_comparisons
), complete_runs as not materialized (
 select distinct on (s.member_id,s.direction) s.member_id,s.direction,s.created_at
 from public.insight_relation_sync_runs s
 where s.complete is true
 order by s.member_id,s.direction,s.created_at desc,s.id desc
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
 left join complete_runs following_complete
  on following_complete.member_id=k.member_id and following_complete.direction='followings'
 left join complete_runs follower_complete
  on follower_complete.member_id=k.member_id and follower_complete.direction='followers'
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
