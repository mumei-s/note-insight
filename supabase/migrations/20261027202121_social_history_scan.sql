-- Return only the next explicit history-check batch, never all saved people.
-- This service-only helper does not perform network reads or change evidence.
create or replace function public.insight_social_history_candidates(
 p_member text,p_after text default '',p_limit integer default 20
) returns jsonb
language sql stable security invoker set search_path='' as $function$
 with identities as (
  select r.person_key,r.actor_name,r.actor_url,r.last_seen_at as known_at
  from public.insight_relations r
  where r.member_id=p_member and r.person_key>coalesce(p_after,'')
  union all
  select c.person_key,c.actor_name,c.actor_url,c.checked_at as known_at
  from public.insight_social_comparisons c
  where c.member_id=p_member and c.person_key>coalesce(p_after,'')
 ), people as (
  select distinct on (i.person_key) i.person_key,i.actor_name,i.actor_url
  from identities i
  where i.actor_url ~ '^https://note[.]com/[A-Za-z0-9_-]+/?$'
  order by i.person_key,i.known_at desc nulls last,i.actor_url,i.actor_name
 ), candidates as (
  select p.person_key,p.actor_name,p.actor_url
  from people p
  left join public.insight_social_comparisons c
    on c.member_id=p_member and c.person_key=p.person_key
  where c.person_key is null or c.is_following is null or c.is_follower is null
    or c.checked_at < now()-interval '1 day'
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
revoke all on function public.insight_social_history_candidates(text,text,integer) from public,anon,authenticated;
grant execute on function public.insight_social_history_candidates(text,text,integer) to service_role;
