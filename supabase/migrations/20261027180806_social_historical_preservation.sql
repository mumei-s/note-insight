-- Restore saved people to the historical view without assigning a person's
-- identity to a count-only change or treating a capped-window absence as proof.
-- This projection never rewrites the saved relation/event/comparison records.
create or replace view public.insight_relation_history_rows
with (security_invoker = true) as
with negative_history as not materialized (
  select h.member_id, h.person_key, d.direction, h.observed_at,
    coalesce(h.actor_name, c.actor_name, r.actor_name) as actor_name,
    coalesce(h.actor_url, c.actor_url, r.actor_url) as actor_url,
    coalesce(c.actor_image_url, r.actor_image_url) as actor_image_url,
    'history:' || h.id::text || ':' || d.direction as observation_id
  from public.insight_social_comparison_history h
  cross join lateral (values
    ('followers'::text, h.previous_follower, h.is_follower),
    ('followings'::text, h.previous_following, h.is_following)
  ) d(direction, previous_value, current_value)
  left join public.insight_social_comparisons c
    on c.member_id = h.member_id and c.person_key = h.person_key
  left join public.insight_relations r
    on r.member_id = h.member_id and r.person_key = h.person_key
      and r.direction = d.direction
  where d.current_value is false
    and (
      (h.observation_kind = 'changed' and d.previous_value is true)
      or (
        h.observation_kind = 'baseline' and r.first_seen_at < h.observed_at
        -- lost_at already records this loss more precisely; do not also invent
        -- a second event at the later first imported negative observation.
        and not (d.direction = 'followers' and c.lost_at is not null
          and c.lost_at <= h.observed_at)
        -- A later baseline is another observation of the same negative state,
        -- not a second loss, unless an intervening positive is actually saved.
        -- This uses append-only evidence, so clearing current lost_at after a
        -- re-follow cannot turn the old baseline into a newly counted loss.
        and not exists (
          select 1 from public.insight_social_comparison_history prior_loss
          where prior_loss.member_id = h.member_id
            and prior_loss.person_key = h.person_key
            and prior_loss.observation_kind = 'changed'
            and prior_loss.observed_at <= h.observed_at
            and (case when d.direction = 'followers'
              then prior_loss.previous_follower
              else prior_loss.previous_following end) is true
            and (case when d.direction = 'followers'
              then prior_loss.is_follower
              else prior_loss.is_following end) is false
            and not (
              coalesce(r.first_seen_at > prior_loss.observed_at
                and r.first_seen_at <= h.observed_at, false)
              or coalesce(r.last_seen_at > prior_loss.observed_at
                and r.last_seen_at <= h.observed_at, false)
            )
            and not exists (
              select 1 from public.insight_social_comparison_history positive
              where positive.member_id = h.member_id
                and positive.person_key = h.person_key
                and positive.observed_at > prior_loss.observed_at
                and positive.observed_at <= h.observed_at
                and (case when d.direction = 'followers'
                  then positive.is_follower else positive.is_following end) is true
            )
        )
      )
    )
), saved_losses as not materialized (
  select c.member_id, c.person_key, 'followers'::text as direction,
    c.lost_at as observed_at,
    coalesce(c.actor_name, r.actor_name) as actor_name,
    coalesce(c.actor_url, r.actor_url) as actor_url,
    coalesce(c.actor_image_url, r.actor_image_url) as actor_image_url,
    'loss:' || c.person_key as observation_id
  from public.insight_social_comparisons c
  left join public.insight_relations r
    on r.member_id = c.member_id and r.person_key = c.person_key
      and r.direction = 'followers'
  where c.lost_at is not null and c.lost_at <= c.checked_at
), confirmed_losses as not materialized (
  -- A changed-history row and the legacy lost_at cache can describe the same
  -- observation. Keep exactly one; later re-follow/loss episodes remain apart.
  select distinct on (member_id, direction, person_key, observed_at)
    member_id, direction, person_key, observed_at,
    actor_name, actor_url, actor_image_url, observation_id
  from (
    select * from negative_history
    union all
    select * from saved_losses
  ) observations
  order by member_id, direction, person_key, observed_at, observation_id
), existing_events as not materialized (
  select 'event:' || e.id::text as id, e.member_id, e.run_id, e.direction,
    e.event_type, e.person_key,
    coalesce(e.actor_name, r.actor_name, c.actor_name) as actor_name,
    coalesce(e.actor_url, r.actor_url, c.actor_url) as actor_url,
    coalesce(e.actor_image_url, r.actor_image_url, c.actor_image_url) as actor_image_url,
    e.detected_at, e.change_count,
    case when e.person_key like 'unknown:%' then 'count_only'
      when e.change_count = 0 then 'window_candidate'
      when s.complete is true or loss.observed_at is not null then
        case when s.complete is true then 'complete_snapshot' else 'authenticated_relationship' end
      else 'window_candidate' end as evidence,
    (e.person_key not like 'unknown:%' and e.change_count > 0
      and (s.complete is true or loss.observed_at is not null)) as identity_exact,
    'relation_event'::text as source,
    r.last_seen_at as evidence_window_start
  from public.insight_relation_events e
  left join public.insight_relation_sync_runs s
    on s.member_id = e.member_id and s.id = e.run_id
  left join public.insight_relations r
    on r.member_id = e.member_id and r.direction = e.direction
      and r.person_key = e.person_key
  left join public.insight_social_comparisons c
    on c.member_id = e.member_id and c.person_key = e.person_key
  left join confirmed_losses loss
    on loss.member_id = e.member_id and loss.direction = e.direction
      and loss.person_key = e.person_key and loss.observed_at = e.detected_at
      and e.event_type = 'removed'
  where e.person_key not like 'aggregate:%'
), verified_events as not materialized (
  select 'verified:' || loss.observation_id as id, loss.member_id,
    null::bigint as run_id, loss.direction, 'removed'::text as event_type,
    loss.person_key, loss.actor_name, loss.actor_url, loss.actor_image_url,
    loss.observed_at as detected_at, 1::integer as change_count,
    'authenticated_relationship'::text as evidence, true as identity_exact,
    'authenticated_history'::text as source,
    null::timestamptz as evidence_window_start
  from confirmed_losses loss
  where not exists (
    select 1 from public.insight_relation_events e
    where e.member_id = loss.member_id and e.direction = loss.direction
      and e.person_key = loss.person_key and e.event_type = 'removed'
      and e.detected_at = loss.observed_at and e.change_count > 0
  )
), archived_candidates as not materialized (
  select 'archive:' || r.direction || ':' || r.person_key as id, r.member_id,
    null::bigint as run_id, r.direction, 'removed'::text as event_type,
    r.person_key, r.actor_name, r.actor_url, r.actor_image_url,
    greatest(r.last_changed_at, r.last_seen_at) as detected_at,
    -- Candidates are named people to investigate, not additional lost followers.
    0::integer as change_count, 'window_candidate'::text as evidence,
    false as identity_exact, 'saved_archive'::text as source,
    r.last_seen_at as evidence_window_start
  from public.insight_relations r
  where r.active is false and r.direction in ('followers', 'followings')
    and r.first_seen_at is not null and r.last_seen_at is not null
    and not exists (
      select 1 from public.insight_relation_events e
      where e.member_id = r.member_id and e.direction = r.direction
        and e.person_key = r.person_key and e.event_type = 'removed'
        and e.detected_at >= r.last_seen_at
    )
    and not exists (
      select 1 from confirmed_losses loss
      where loss.member_id = r.member_id and loss.direction = r.direction
        and loss.person_key = r.person_key and loss.observed_at >= r.last_seen_at
    )
)
select * from existing_events
union all
select * from verified_events
union all
select * from archived_candidates;

revoke all on public.insight_relation_history_rows from public, anon, authenticated;
grant select on public.insight_relation_history_rows to service_role;

comment on view public.insight_relation_history_rows is
  'Service-only historical projection. Count-only drops, archived window candidates and observed relationship losses remain distinct; no source histories are rewritten.';

-- Preserve the owner's recovered observations across future re-follow updates.
-- Append evidence only: no existing counts, people or observations are rewritten.
do $$
begin
  -- Use the same owner lock as save_insight_social_comparison so its legacy
  -- lost_at value cannot clear between the proof check and the history append.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('social-compare:owner', 0));

  if exists (
    select 1
    from public.insight_social_comparisons c
    join public.insight_social_comparison_history h
      on h.member_id = c.member_id and h.person_key = c.person_key
        and h.observed_at = c.lost_at
    where c.member_id = 'owner' and c.lost_at is not null
      and c.lost_at <= c.checked_at
      and not (h.observation_kind = 'changed'
        and h.previous_follower is true and h.is_follower is false)
  ) then
    raise exception 'SOCIAL_LEGACY_LOSS_TIMESTAMP_CONFLICT';
  end if;

  -- lost_at is written only after observing mutual=true -> following=true,
  -- follower=false. Preserve that known transition at its original observation
  -- time; a false baseline or a count decrease supplies no such evidence.
  insert into public.insight_social_comparison_history (
    member_id, person_key, actor_name, actor_url,
    previous_following, previous_follower, is_following, is_follower,
    observed_at, observation_kind
  )
  select c.member_id, c.person_key, c.actor_name, c.actor_url,
    true, true, true, false, c.lost_at, 'changed'
  from public.insight_social_comparisons c
  where c.member_id = 'owner' and c.lost_at is not null
    and c.lost_at <= c.checked_at
  on conflict (member_id, person_key, observed_at) do nothing;

  -- The inactive saved-person row proves only a prior window observation.
  -- Count zero deliberately keeps these people separate from confirmed losses
  -- and the original official-total unknown changes.
  insert into public.insight_relation_events (
    member_id, run_id, direction, event_type, person_key,
    actor_name, actor_url, actor_image_url, detected_at, change_count
  )
  select v.member_id, null, v.direction, 'removed', v.person_key,
    v.actor_name, v.actor_url, v.actor_image_url, v.detected_at, 0
  from public.insight_relation_history_rows v
  where v.member_id = 'owner' and v.source = 'saved_archive'
    and v.detected_at is not null
    and not exists (
      select 1 from public.insight_relation_events e
      where e.member_id = v.member_id and e.direction = v.direction
        and e.person_key = v.person_key and e.event_type = 'removed'
        and e.detected_at = v.detected_at
    );
end;
$$;
