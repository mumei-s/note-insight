-- INSIGHT: retain previously observed comment text and creator identity when note later
-- returns deleted placeholders, missing fields, or no longer exposes a profile.
-- This is additive. Deliberate verified erasure remains a separate operation.

create schema if not exists private;

create table if not exists private.insight_comment_body_versions (
  version_id bigint generated always as identity primary key,
  member_id text not null,
  article_key text not null,
  comment_key text not null,
  prior_body text not null,
  prior_actor_name text,
  prior_actor_url text,
  observed_change_at timestamptz not null default now()
);

create index if not exists insight_comment_body_versions_member_idx
  on private.insight_comment_body_versions (member_id, article_key, comment_key, version_id desc);

alter table private.insight_comment_body_versions enable row level security;
revoke all on private.insight_comment_body_versions from public, anon, authenticated;
revoke all on sequence private.insight_comment_body_versions_version_id_seq from public, anon, authenticated;

create or replace function private.insight_preserve_public_comment_history()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  -- A failed/deleted note response does not revoke a captured historical body.
  if nullif(btrim(old.body), '') is not null
     and (nullif(btrim(new.body), '') is null
          or btrim(new.body) ~* '^(削除済み|削除されたコメント|コメントは削除されました[。.]?|このコメントは削除されました[。.]?|\[deleted\]|\[removed\])$')
  then
    new.body := old.body;
  end if;

  -- Genuine author edits are allowed, with the earlier version still archived.
  if nullif(btrim(old.body), '') is not null and new.body is distinct from old.body then
    insert into private.insight_comment_body_versions
      (member_id, article_key, comment_key, prior_body, prior_actor_name, prior_actor_url)
    values (old.member_id, old.article_key, old.comment_key,
            old.body, old.actor_name, old.actor_url);
  end if;

  -- Missing or generic profile responses must not erase a previously known actor.
  if nullif(btrim(old.actor_name), '') is not null
     and (nullif(btrim(new.actor_name), '') is null
          or btrim(new.actor_name) in ('noteユーザー','退会済み','削除済み'))
  then new.actor_name := old.actor_name; end if;
  if nullif(btrim(old.actor_url), '') is not null
     and nullif(btrim(new.actor_url), '') is null
  then new.actor_url := old.actor_url; end if;
  if nullif(btrim(old.actor_image_url), '') is not null
     and nullif(btrim(new.actor_image_url), '') is null
  then new.actor_image_url := old.actor_image_url; end if;
  if nullif(btrim(old.actor_key), '') is not null
     and nullif(btrim(new.actor_key), '') is null
  then new.actor_key := old.actor_key; end if;

  return new;
end;
$function$;

drop trigger if exists insight_preserve_comment_history_v1 on public.insight_public_comments;
create trigger insight_preserve_comment_history_v1
before update of body, actor_name, actor_url, actor_image_url, actor_key
on public.insight_public_comments
for each row execute function private.insight_preserve_public_comment_history();

create or replace function private.insight_preserve_observed_creator()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if nullif(btrim(old.actor_name), '') is not null
     and (nullif(btrim(new.actor_name), '') is null
          or btrim(new.actor_name) in ('noteユーザー','退会済み','削除済み'))
  then new.actor_name := old.actor_name; end if;
  if nullif(btrim(old.actor_url), '') is not null
     and nullif(btrim(new.actor_url), '') is null
  then new.actor_url := old.actor_url; end if;

  if tg_table_name <> 'insight_public_followers' then
    if nullif(btrim(old.actor_image_url), '') is not null
       and nullif(btrim(new.actor_image_url), '') is null
    then new.actor_image_url := old.actor_image_url; end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists insight_preserve_like_creator_v1 on public.insight_public_likes;
create trigger insight_preserve_like_creator_v1
before update of actor_name, actor_url, actor_image_url
on public.insight_public_likes
for each row execute function private.insight_preserve_observed_creator();

drop trigger if exists insight_preserve_follower_creator_v1 on public.insight_public_followers;
create trigger insight_preserve_follower_creator_v1
before update of actor_name, actor_url
on public.insight_public_followers
for each row execute function private.insight_preserve_observed_creator();

drop trigger if exists insight_preserve_relation_creator_v1 on public.insight_relations;
create trigger insight_preserve_relation_creator_v1
before update of actor_name, actor_url, actor_image_url
on public.insight_relations
for each row execute function private.insight_preserve_observed_creator();

revoke all on function private.insight_preserve_public_comment_history() from public, anon, authenticated, service_role;
revoke all on function private.insight_preserve_observed_creator() from public, anon, authenticated, service_role;
