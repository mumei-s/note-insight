-- Inspect a bounded number of own-article comment notifications that have not
-- yet been reconciled into the durable comment archive. One database-side
-- comparison replaces repetitive client fetching of stale article counters.
create or replace function public.insight_comment_notification_backfill_candidates(
 p_member text,
 p_limit integer default 3
)
returns table(article_key text,title text,url text,publish_at timestamptz,comment_count integer)
language sql
stable
security invoker
set search_path to ''
as $$
  select a.article_key,a.title,a.url,a.publish_at,a.comment_count
  from public.insight_notifications n
  join public.insight_notification_profiles p
    on p.member_id=n.member_id
  join public.insight_public_articles a
    on a.member_id=n.member_id
   and a.article_key=substring(n.target_url from '/n/(n[0-9a-fA-F]+)')
  where n.member_id=p_member
    and n.notification_type in ('comment','reply')
    and n.occurred_at >= now() - interval '120 days'
    and n.target_url like ('https://note.com/' || p.note_urlname || '/n/%')
    and substring(n.target_url from '[?&]c=(nc[A-Za-z0-9]+)') is not null
    and not exists (
      select 1 from public.insight_public_comments c
      where c.member_id=n.member_id
        and c.article_key=a.article_key
        and c.comment_key=substring(n.target_url from '[?&]c=(nc[A-Za-z0-9]+)')
    )
  group by a.article_key,a.title,a.url,a.publish_at,a.comment_count
  order by max(n.occurred_at) desc
  limit greatest(1,least(coalesce(p_limit,3),3))
$$;

revoke all on function public.insight_comment_notification_backfill_candidates(text,integer)
from public,anon,authenticated;
grant execute on function public.insight_comment_notification_backfill_candidates(text,integer)
to service_role;
