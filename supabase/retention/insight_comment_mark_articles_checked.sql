-- INSIGHT comment refresh checkpoint batching.
-- One scoped SQL update for up to 300 fully collected article checkpoints.
-- Keep comment_count and last_seen_at current without per-article PostgREST PATCH.
create or replace function public.insight_comment_mark_articles_checked(
  p_member text,
  p_articles jsonb
)
returns integer
language plpgsql
security invoker
set search_path to ''
as $function$
declare affected integer;
begin
  if nullif(btrim(p_member), '') is null
     or jsonb_typeof(p_articles) is distinct from 'array'
     or jsonb_array_length(p_articles) > 300
  then raise exception 'INVALID_COMMENT_CHECKPOINT_BATCH'; end if;

  if exists (
    select 1 from jsonb_array_elements(p_articles) a
    where nullif(a->>'article_key','') is null
      or (a->>'article_key') !~ '^n[0-9a-fA-F]+$'
      or jsonb_typeof(a->'comment_count') is distinct from 'number'
      or (a->>'comment_count') !~ '^[0-9]+$'
  ) then raise exception 'INVALID_COMMENT_CHECKPOINT_ROW'; end if;

  with input as (
    select distinct on (article_key) article_key, comment_count
    from jsonb_to_recordset(p_articles) as x(article_key text, comment_count integer)
    order by article_key
  )
  update public.insight_public_articles a
  set comment_count=input.comment_count,
      last_seen_at=clock_timestamp()
  from input
  where a.member_id=p_member and a.article_key=input.article_key;

  get diagnostics affected=row_count;
  return affected;
end;
$function$;

revoke all on function public.insight_comment_mark_articles_checked(text,jsonb)
from public, anon, authenticated;
grant execute on function public.insight_comment_mark_articles_checked(text,jsonb)
to service_role;
