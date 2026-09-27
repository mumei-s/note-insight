-- Read the saved DAY observations across every confirmed snapshot. Period totals
-- and WEEK/MONTH buckets are deliberately excluded. Newest non-null value wins.
create or replace function public.insight_dashboard_saved_daily(p_member_id text)
returns jsonb language sql stable security invoker set search_path=public as $$
 with cells as (
  select coalesce(r->>'date',r->>'day',r->>'at')::text as day,
   s.captured_at,s.id,f.key,f.value,
   row_number() over(partition by coalesce(r->>'date',r->>'day',r->>'at'),f.key order by s.captured_at desc,s.id desc) as rank
  from public.insight_dashboard_snapshots s
  cross join lateral jsonb_array_elements(coalesce(s.metric_series,'[]'::jsonb)) r
  cross join lateral jsonb_each(jsonb_build_object(
   'pageViews',coalesce(r->'pageViews',r->'page_views',r->'pv',r->'views'),
   'impressions',r->'impressions','likes',r->'likes','comments',r->'comments',
   'salesYen',coalesce(r->'salesYen',r->'sales_yen',r->'sales'))) f
  where s.member_id=p_member_id and s.confirmed=true
   and jsonb_typeof(f.value)='number' and (f.value::text)::numeric>=0
   and coalesce(r->>'date',r->>'day',r->>'at') ~ '^\d{4}-\d{2}-\d{2}$'
 ), days as (
  select day,jsonb_build_object('date',day)||jsonb_object_agg(key,value) as value
  from cells where rank=1 group by day
 ) select coalesce(jsonb_agg(value order by day),'[]'::jsonb) from days;
$$;
revoke all on function public.insight_dashboard_saved_daily(text) from public,anon,authenticated;
grant execute on function public.insight_dashboard_saved_daily(text) to service_role;

create table public.insight_dashboard_follower_counts (
 member_id text not null,
 date date not null,
 count integer not null check(count>=0),
 measured_at timestamptz not null,
 primary key(member_id,date)
);
alter table public.insight_dashboard_follower_counts enable row level security;
revoke all on public.insight_dashboard_follower_counts from public,anon,authenticated;
grant select,insert,update on public.insight_dashboard_follower_counts to service_role;
