create or replace function public.insight_missing_comment_articles(p_member text, p_limit integer default 30)
returns table(article_key text, title text, url text, publish_at timestamptz, comment_count bigint, stored_count bigint, missing_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select a.article_key,
         a.title,
         a.url,
         a.publish_at,
         coalesce(a.comment_count,0)::bigint as comment_count,
         count(c.comment_key)::bigint as stored_count,
         greatest(coalesce(a.comment_count,0)::bigint-count(c.comment_key)::bigint,0) as missing_count
  from public.insight_public_articles a
  left join public.insight_public_comments c
    on c.member_id=a.member_id and c.article_key=a.article_key
  where a.member_id=p_member
    and coalesce(a.comment_count,0)>0
  group by a.article_key,a.title,a.url,a.publish_at,a.comment_count
  having count(c.comment_key)<coalesce(a.comment_count,0)
  order by greatest(coalesce(a.comment_count,0)::bigint-count(c.comment_key)::bigint,0) desc,
           a.publish_at desc nulls last
  limit greatest(1,least(coalesce(p_limit,30),100));
$$;
revoke all on function public.insight_missing_comment_articles(text,integer) from public;
grant execute on function public.insight_missing_comment_articles(text,integer) to service_role;
