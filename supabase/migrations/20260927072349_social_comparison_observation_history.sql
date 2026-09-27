-- Preserve observed relationship transitions without changing the comparison RPC.
-- Existing state is a baseline, never an invented historical transition.
create table public.insight_social_comparison_history (
 id bigint generated always as identity primary key,
 member_id text not null,
 person_key text not null,
 actor_name text,
 actor_url text,
 previous_following boolean,
 previous_follower boolean,
 is_following boolean,
 is_follower boolean,
 observed_at timestamptz not null,
 observation_kind text not null check (observation_kind in ('baseline','changed')),
 unique(member_id,person_key,observed_at)
);
create index insight_social_comparison_history_person_time
 on public.insight_social_comparison_history(member_id,person_key,observed_at desc);
alter table public.insight_social_comparison_history enable row level security;
revoke all on public.insight_social_comparison_history from public,anon,authenticated;
grant select,insert on public.insight_social_comparison_history to service_role;
grant usage,select on sequence public.insight_social_comparison_history_id_seq to service_role;

create function public.record_insight_social_comparison_history()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if TG_OP='INSERT' or (new.is_following is distinct from old.is_following or new.is_follower is distinct from old.is_follower) then
  insert into public.insight_social_comparison_history
   (member_id,person_key,actor_name,actor_url,previous_following,previous_follower,is_following,is_follower,observed_at,observation_kind)
  values(new.member_id,new.person_key,new.actor_name,new.actor_url,
   case when TG_OP='UPDATE' then old.is_following else null end,
   case when TG_OP='UPDATE' then old.is_follower else null end,
   new.is_following,new.is_follower,new.checked_at,case when TG_OP='INSERT' then 'baseline' else 'changed' end)
  on conflict(member_id,person_key,observed_at) do nothing;
 end if;
 return new;
end;
$$;
revoke all on function public.record_insight_social_comparison_history() from public,anon,authenticated;
grant execute on function public.record_insight_social_comparison_history() to service_role;
create trigger insight_social_comparison_history_after_write
 after insert or update on public.insight_social_comparisons
 for each row execute function public.record_insight_social_comparison_history();
insert into public.insight_social_comparison_history
 (member_id,person_key,actor_name,actor_url,is_following,is_follower,observed_at,observation_kind)
 select member_id,person_key,actor_name,actor_url,is_following,is_follower,checked_at,'baseline'
 from public.insight_social_comparisons
 on conflict(member_id,person_key,observed_at) do nothing;
