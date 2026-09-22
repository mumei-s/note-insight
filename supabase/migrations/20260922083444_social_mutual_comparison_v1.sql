create table public.insight_social_comparisons (
  member_id text not null,
  person_key text not null,
  actor_name text,
  actor_url text,
  actor_image_url text,
  is_following boolean,
  is_follower boolean,
  following_rank integer,
  follower_rank integer,
  checked_at timestamptz not null,
  first_checked_at timestamptz not null default now(),
  mutual_seen_at timestamptz,
  lost_at timestamptz,
  gained_at timestamptz,
  primary key (member_id, person_key)
);
create index insight_social_comparisons_following_order on public.insight_social_comparisons (member_id, following_rank desc) where is_following is true;
alter table public.insight_social_comparisons enable row level security;
revoke all on public.insight_social_comparisons from anon, authenticated;
grant all on public.insight_social_comparisons to service_role;

create table public.insight_social_comparison_status (
  member_id text primary key,
  checked_at timestamptz not null default now(),
  complete boolean not null default false,
  following_total integer,
  follower_total integer,
  following_checked integer not null default 0,
  follower_checked integer not null default 0,
  error text
);
alter table public.insight_social_comparison_status enable row level security;
revoke all on public.insight_social_comparison_status from anon, authenticated;
grant all on public.insight_social_comparison_status to service_role;

-- Only the authenticated Edge Function can supply member_id. Each page saves
-- atomically; a late response cannot replace a newer observation.
create function public.save_insight_social_comparison(p_member text,p_rows jsonb,p_checked timestamptz)
returns integer language plpgsql security invoker set search_path = '' as $$
declare
  item jsonb;
  old public.insight_social_comparisons%rowtype;
  f boolean;
  r boolean;
  saved integer := 0;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('social-compare:'||p_member,0));
  for item in select value from pg_catalog.jsonb_array_elements(p_rows) loop
    select * into old from public.insight_social_comparisons
      where member_id=p_member and person_key=item->>'person_key' for update;
    if old.checked_at is not null and old.checked_at >= p_checked then continue; end if;
    f := (item->>'is_following')::boolean;
    r := (item->>'is_follower')::boolean;
    insert into public.insight_social_comparisons (
      member_id,person_key,actor_name,actor_url,actor_image_url,is_following,is_follower,
      following_rank,follower_rank,checked_at,mutual_seen_at,lost_at,gained_at
    ) values (
      p_member,item->>'person_key',item->>'actor_name',item->>'actor_url',item->>'actor_image_url',f,r,
      coalesce((item->>'following_rank')::integer,old.following_rank),
      coalesce((item->>'follower_rank')::integer,old.follower_rank),p_checked,
      case when f and r then p_checked else old.mutual_seen_at end,
      case when old.is_following and old.is_follower and f and r is false then p_checked
           when f and r then null else old.lost_at end,
      case when f and r and old.checked_at is not null and (old.is_following is false or old.is_follower is false) then p_checked
           else old.gained_at end
    ) on conflict (member_id,person_key) do update set
      actor_name=coalesce(excluded.actor_name,insight_social_comparisons.actor_name),
      actor_url=coalesce(excluded.actor_url,insight_social_comparisons.actor_url),
      actor_image_url=coalesce(excluded.actor_image_url,insight_social_comparisons.actor_image_url),
      is_following=excluded.is_following,is_follower=excluded.is_follower,
      following_rank=excluded.following_rank,follower_rank=excluded.follower_rank,
      checked_at=excluded.checked_at,mutual_seen_at=excluded.mutual_seen_at,
      lost_at=excluded.lost_at,gained_at=excluded.gained_at;
    saved := saved+1;
  end loop;
  return saved;
end;
$$;
revoke all on function public.save_insight_social_comparison(text,jsonb,timestamptz) from public, anon, authenticated;
grant execute on function public.save_insight_social_comparison(text,jsonb,timestamptz) to service_role;
