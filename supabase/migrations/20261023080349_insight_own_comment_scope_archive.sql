-- Dormant until explicitly deployed. No existing token changes, table grants,
-- data deletion, or client SQL access. All functions run as service_role caller.
begin;
-- Snapshot the explicitly consented account, even if an application changes later.
alter table public.insight_notification_pair_codes add column if not exists own_comment_account text;
alter table public.insight_notification_ingest_tokens add column if not exists own_comment_account text;

create or replace function public.insight_upgrade_own_comment_scope(
 p_token_hash text, p_code_hash text, p_account text
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare t public.insight_notification_ingest_tokens%rowtype;
 c public.insight_notification_pair_codes%rowtype; verified_account text;
begin
 if p_token_hash !~ '^[a-f0-9]{64}$' or p_code_hash !~ '^[a-f0-9]{64}$'
    or p_account !~ '^[a-z0-9_-]{1,128}$' then return jsonb_build_object('ok',false); end if;
 select * into t from public.insight_notification_ingest_tokens
 where token_hash=p_token_hash and revoked_at is null and expires_at>clock_timestamp()
   and purpose in ('note_notification_auto_sync','note_notification_and_own_comment_sync') for update;
 if not found or t.expires_at<=clock_timestamp() then return jsonb_build_object('ok',false); end if;
 select lower(a.note_id) into verified_account from public.insight_access_applications a
 where ((t.member_id='owner' and a.note_id='ss_yr') or a.id::text=t.member_id)
   and a.status='active' and a.verified_at is not null and a.revoked_at is null
   and lower(a.note_id)=p_account limit 1 for share;
 if not found then return jsonb_build_object('ok',false); end if;
 select * into c from public.insight_notification_pair_codes
 where code_hash=p_code_hash and member_id=t.member_id and purpose='own_comment_scope_upgrade'
   and own_comment_account=p_account and used_at is null and expires_at>clock_timestamp() for update;
 if not found or c.expires_at<=clock_timestamp() then return jsonb_build_object('ok',false); end if;
 -- Both writes commit together. A replay or simultaneous second device cannot
 -- consume the same consent, and another member's code never upgrades this token.
 update public.insight_notification_ingest_tokens set purpose='note_notification_and_own_comment_sync', own_comment_account=p_account where id=t.id;
 update public.insight_notification_pair_codes set used_at=clock_timestamp() where id=c.id;
 return jsonb_build_object('ok',true);
end $$;
revoke all on function public.insight_upgrade_own_comment_scope(text,text,text) from public,anon,authenticated;
grant execute on function public.insight_upgrade_own_comment_scope(text,text,text) to service_role;

create or replace function public.insight_archive_own_comments(
 p_token_hash text, p_account text, p_records jsonb
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare t public.insight_notification_ingest_tokens%rowtype;
 verified_account text; r jsonb; saved public.insight_outgoing_activity%rowtype;
 expected_id text; event_id text; ack jsonb='[]'::jsonb; seen text[]='{}'; posted_at timestamptz;
begin
 if p_token_hash !~ '^[a-f0-9]{64}$' or p_account !~ '^[a-z0-9_-]{1,128}$'
   or jsonb_typeof(p_records) is distinct from 'array' then raise exception 'INVALID_ARCHIVE_REQUEST'; end if;
 if jsonb_array_length(p_records) not between 1 and 20 or octet_length(p_records::text)>512000 then raise exception 'INVALID_ARCHIVE_REQUEST'; end if;
 select * into t from public.insight_notification_ingest_tokens where token_hash=p_token_hash
  and purpose='note_notification_and_own_comment_sync' and own_comment_account=p_account and revoked_at is null and expires_at>clock_timestamp() for update;
 if not found or t.expires_at<=clock_timestamp() then raise exception 'OWN_COMMENT_SCOPE_REQUIRED'; end if;
 select lower(a.note_id) into verified_account from public.insight_access_applications a
 where ((t.member_id='owner' and a.note_id='ss_yr') or a.id::text=t.member_id)
  and a.status='active' and a.verified_at is not null and a.revoked_at is null
  and lower(a.note_id)=p_account limit 1 for share;
 if not found then raise exception 'OWN_COMMENT_PROFILE_VERIFICATION_REQUIRED'; end if;
 for r in select value from jsonb_array_elements(p_records) loop
  if jsonb_typeof(r) is distinct from 'object' or (r->>'account') is distinct from p_account
    or coalesce(r->>'articleKey','') !~ '^n[A-Za-z0-9]{1,127}$'
    or coalesce(r->>'commentKey','') !~ '^nc[A-Za-z0-9]{1,126}$'
    or not (r ? 'parentKey') or (jsonb_typeof(r->'parentKey') <> 'null' and
      (coalesce(r->>'parentKey','') !~ '^nc[A-Za-z0-9]{1,126}$' or r->>'parentKey'=r->>'commentKey'))
    or jsonb_typeof(r->'body') is distinct from 'string' or length(r->>'body') not between 1 and 100000
    or btrim(r->>'body')='' then raise exception 'INVALID_ARCHIVE_RECORD'; end if;
  expected_id=p_account||':'||(r->>'articleKey')||':'||(r->>'commentKey');
  if (r->>'id') is distinct from expected_id or expected_id=any(seen) then raise exception 'INVALID_ARCHIVE_ID'; end if;
  seen=array_append(seen,expected_id);
  posted_at=(r->>'createdAt')::timestamptz;
  if posted_at is null or not isfinite(posted_at) or posted_at>clock_timestamp()+interval '5 minutes' then raise exception 'INVALID_ARCHIVE_TIME'; end if;
  if r->>'articleUrl' is not null and (r->>'articleUrl') !~ ('^https://note[.]com/[A-Za-z0-9_-]+/n/'||(r->>'articleKey')||'$') then raise exception 'INVALID_ARCHIVE_URL'; end if;
  event_id='note-comment:'||(r->>'articleKey')||':'||(r->>'commentKey');
  insert into public.insight_outgoing_activity(member_id,event_key,event_type,actor_key,actor_url,subject_key,subject_url,message,occurred_at,source,raw_data)
  values(t.member_id,event_id,'commented',p_account,'https://note.com/'||p_account,r->>'articleKey',r->>'articleUrl',r->>'body',posted_at,'successful-note-comment-post',
   jsonb_build_object('schema',1,'client_id',expected_id,'account',p_account,'article_key',r->>'articleKey','comment_key',r->>'commentKey','parent_key',r->'parentKey'))
  on conflict(member_id,event_key) do nothing;
  -- Read the durable first capture, not the attempted replacement. Never update
  -- old text, even if the source comment is later edited or deleted.
  select * into saved from public.insight_outgoing_activity where member_id=t.member_id and event_key=event_id;
  if not found or saved.source<>'successful-note-comment-post' or saved.event_type<>'commented'
   or saved.actor_key is distinct from p_account or saved.subject_key is distinct from (r->>'articleKey')
   or saved.raw_data->>'client_id' is distinct from expected_id or saved.raw_data->>'account' is distinct from p_account
   or saved.raw_data->>'comment_key' is distinct from (r->>'commentKey')
   or saved.raw_data->'parent_key' is distinct from (r->'parentKey')
   or coalesce(saved.message,'')='' then raise exception 'OWN_COMMENT_ARCHIVE_CONFLICT'; end if;
  ack=ack||jsonb_build_array(jsonb_build_object('id',expected_id,'persisted',true));
 end loop;
 return jsonb_build_object('ok',true,'acks',ack);
end $$;
revoke all on function public.insight_archive_own_comments(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.insight_archive_own_comments(text,text,jsonb) to service_role;

create or replace function public.insight_own_comment_history_page(
 p_member_ids text[], p_account text, p_page integer default 1, p_page_size integer default 20
) returns jsonb language sql stable security invoker set search_path = '' as $$
 with settings as (
  select least(50,greatest(1,coalesce(p_page_size,20))) as size,
   least(1000,greatest(1,coalesce(p_page,1))) as page
 ), bounded as (
  select a.id,a.occurred_at,a.raw_data,a.actor_url,a.subject_url,left(a.message,180) as preview
  from public.insight_outgoing_activity a
  where a.member_id=any(p_member_ids) and cardinality(p_member_ids) between 1 and 2
   and a.source='successful-note-comment-post' and a.event_type='commented'
   and a.actor_key=p_account and a.raw_data->>'account'=p_account
   and a.event_key='note-comment:'||(a.raw_data->>'article_key')||':'||(a.raw_data->>'comment_key')
   and a.raw_data->>'client_id'=p_account||':'||(a.raw_data->>'article_key')||':'||(a.raw_data->>'comment_key')
  order by a.occurred_at desc nulls last,a.id desc
  limit (select size+1 from settings) offset (select (page-1)*size from settings)
 ), page_rows as (select * from bounded order by occurred_at desc nulls last,id desc limit (select size from settings))
 select jsonb_build_object('hasMore',(select count(*)>(select size from settings) from bounded),'rows',
  coalesce((select jsonb_agg(jsonb_build_object('id',raw_data->>'client_id','articleKey',raw_data->>'article_key',
   'commentKey',raw_data->>'comment_key','parentKey',raw_data->'parent_key','bodyPreview',preview,'occurredAt',occurred_at,
   'authorUrl',actor_url,'articleUrl',subject_url,'commentUrl',null) order by occurred_at desc nulls last,id desc) from page_rows),'[]'::jsonb));
$$;
revoke all on function public.insight_own_comment_history_page(text[],text,integer,integer) from public,anon,authenticated;
grant execute on function public.insight_own_comment_history_page(text[],text,integer,integer) to service_role;

-- Exact saved threads are projected/deduplicated in the database. Repeated
-- notification snapshots never multiply response payload or erase older replies.
create index if not exists insight_notifications_saved_comment_thread_idx
 on public.insight_notifications(member_id,(meta->'comment_conversation'->>'articleKey'),(meta->'comment_conversation'->>'threadKey'))
 where notification_type in ('comment','reply') and meta ? 'comment_conversation';
create index if not exists insight_outgoing_own_comment_parent_idx
 on public.insight_outgoing_activity(member_id,subject_key,(raw_data->>'parent_key'))
 where source='successful-note-comment-post' and event_type='commented';
create or replace function public.insight_own_comment_saved_thread(
 p_member_ids text[],p_scope text,p_account text,p_article text,p_root text
) returns jsonb language sql stable security invoker set search_path = '' as $$
 with notices as (
  select n.id,n.captured_at,n.target_url,n.meta->'comment_conversation' as conversation
  from public.insight_notifications n where n.member_id=any(p_member_ids)
   and cardinality(p_member_ids) between 1 and 2 and p_scope=any(p_member_ids)
   and n.notification_type in ('comment','reply') and n.meta ? 'comment_conversation'
   and n.meta->'comment_conversation'->>'articleKey'=p_article
   and n.meta->'comment_conversation'->>'threadKey'=p_root
 ), candidates as (
  select 1 priority,a.created_at as captured_at,a.id::text as evidence_id,
   a.raw_data->>'comment_key' as comment_key,a.raw_data->>'parent_key' as parent_key,
   a.message as body,p_account as author,a.actor_url as author_url,a.occurred_at::text as occurred_at
  from public.insight_outgoing_activity a where a.member_id=any(p_member_ids)
   and cardinality(p_member_ids) between 1 and 2 and p_scope=any(p_member_ids)
   and a.source='successful-note-comment-post' and a.event_type='commented'
   and a.actor_key=p_account and a.raw_data->>'account'=p_account and a.subject_key=p_article
   and a.raw_data->>'article_key'=p_article
   and a.event_key='note-comment:'||p_article||':'||(a.raw_data->>'comment_key')
   and a.raw_data->>'client_id'=p_account||':'||p_article||':'||(a.raw_data->>'comment_key')
   and ((a.raw_data->>'comment_key'=p_root and a.raw_data->>'parent_key' is null) or a.raw_data->>'parent_key'=p_root)
  union all
  select 2,n.captured_at,n.id::text,x->>'commentKey',x->>'parentKey',x->>'body',x->>'author',x->>'authorUrl',x->>'occurredAt'
  from notices n cross join lateral jsonb_array_elements(case when jsonb_typeof(n.conversation->'messages')='array' then n.conversation->'messages' else '[]'::jsonb end) x
  where (x->>'commentKey'=p_root and x->>'parentKey' is null) or x->>'parentKey'=p_root
  union all
  select 3,null::timestamptz,c.comment_key,c.comment_key,c.parent_key,c.body,c.actor_name,c.actor_url,c.occurred_at::text
  from public.insight_public_comments c where c.member_id=p_scope and p_scope=any(p_member_ids)
   and cardinality(p_member_ids) between 1 and 2 and c.article_key=p_article
   and ((c.comment_key=p_root and c.parent_key is null) or c.parent_key=p_root)
 ), unique_messages as (
  select distinct on(comment_key) * from candidates
  where p_article ~ '^n[A-Za-z0-9]{1,127}$' and p_root ~ '^nc[A-Za-z0-9]{1,126}$'
   and comment_key ~ '^nc[A-Za-z0-9]{1,126}$' and length(body) between 1 and 100000 and btrim(body)<>''
   and btrim(body) !~* '^(削除済み|このコメントは削除されました[。.]?|コメントは削除されました[。.]?|削除されたコメント|\[deleted\]|\[removed\])$'
  order by comment_key,priority,captured_at asc nulls last,evidence_id
 ), bounded_candidates as (
  select * from unique_messages order by priority,occurred_at asc nulls last,comment_key limit 501
 ), measured as (
  select *,row_number() over(order by priority,occurred_at asc nulls last,comment_key) as ordinal,
   sum(octet_length(body)) over(order by priority,occurred_at asc nulls last,comment_key) as body_bytes
  from bounded_candidates
 ), selected as (select * from measured where ordinal<=500 and body_bytes<=400000)
 select jsonb_build_object('messages',coalesce((select jsonb_agg(jsonb_build_object(
  'commentKey',comment_key,'parentKey',parent_key,'body',body,'author',left(author,160),
  'authorUrl',left(author_url,512),'occurredAt',left(occurred_at,64)) order by occurred_at asc nulls last,comment_key) from selected),'[]'::jsonb),
  'articleUrl',(select left(target_url,2048) from notices where target_url is not null order by captured_at desc,id desc limit 1),
  'truncated',exists(select 1 from measured where ordinal>500 or body_bytes>400000));
$$;
revoke all on function public.insight_own_comment_saved_thread(text[],text,text,text,text) from public,anon,authenticated;
grant execute on function public.insight_own_comment_saved_thread(text[],text,text,text,text) to service_role;

commit;
