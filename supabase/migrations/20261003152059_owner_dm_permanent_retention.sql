-- Retain only the canonical ss_yr / owner DM archive. Peer removal or a later
-- partial/tombstone response must not replace a captured owner's message.
-- Participant storage, authentication, RLS and grants remain unchanged.
create or replace function public.protect_owner_dm_history_row()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.member_id <> 'owner' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    raise exception 'OWNER_DM_RETENTION_PROTECTED' using errcode = '23514';
  end if;

  if new.id is distinct from old.id or new.member_id is distinct from old.member_id
     or new.thread_key is distinct from old.thread_key then
    raise exception 'OWNER_DM_ARCHIVE_IDENTITY_IMMUTABLE' using errcode = '23514';
  end if;

  if tg_table_name = 'insight_dm_messages' then
    if new.message_key is distinct from old.message_key then
      raise exception 'OWNER_DM_ARCHIVE_IDENTITY_IMMUTABLE' using errcode = '23514';
    end if;
    -- Keep the first captured nonempty content; an initially missing value can
    -- still be filled by a later successful read. Reader/dedup metadata can update.
    new.body := coalesce(nullif(old.body, ''), new.body);
    new.raw_text := coalesce(nullif(old.raw_text, ''), new.raw_text);
    new.sender_name := coalesce(nullif(old.sender_name, ''), new.sender_name);
    new.sender_url := coalesce(nullif(old.sender_url, ''), new.sender_url);
    new.sender_image_url := coalesce(nullif(old.sender_image_url, ''), new.sender_image_url);
    new.attachment_name := coalesce(nullif(old.attachment_name, ''), new.attachment_name);
    new.attachment_url := coalesce(nullif(old.attachment_url, ''), new.attachment_url);
    new.attachment_type := coalesce(nullif(old.attachment_type, ''), new.attachment_type);
    new.sent_at := coalesce(old.sent_at, new.sent_at);
    new.captured_at := old.captured_at;
    if old.direction <> 'unknown' then new.direction := old.direction; end if;
  elsif tg_table_name = 'insight_dm_threads' then
    new.room_url := coalesce(nullif(new.room_url, ''), old.room_url);
    new.peer_note_id := coalesce(nullif(old.peer_note_id, ''), new.peer_note_id);
    new.peer_name := coalesce(nullif(old.peer_name, ''), new.peer_name);
    new.peer_url := coalesce(nullif(old.peer_url, ''), new.peer_url);
    new.peer_image_url := coalesce(nullif(old.peer_image_url, ''), new.peer_image_url);
    new.last_message_at := greatest(old.last_message_at, new.last_message_at);
  end if;
  new.meta := coalesce(old.meta, '{}'::jsonb) || coalesce(new.meta, '{}'::jsonb);
  return new;
end;
$$;

create or replace function public.protect_owner_dm_history_truncate()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_table_name = 'insight_dm_messages' then
    if exists (select 1 from public.insight_dm_messages where member_id = 'owner') then
      raise exception 'OWNER_DM_RETENTION_PROTECTED' using errcode = '23514';
    end if;
  elsif tg_table_name = 'insight_dm_threads' then
    if exists (select 1 from public.insight_dm_threads where member_id = 'owner') then
      raise exception 'OWNER_DM_RETENTION_PROTECTED' using errcode = '23514';
    end if;
  end if;
  return null;
end;
$$;

revoke all on function public.protect_owner_dm_history_row() from public;
revoke all on function public.protect_owner_dm_history_truncate() from public;

create or replace trigger owner_dm_messages_retention
before update or delete on public.insight_dm_messages
for each row execute function public.protect_owner_dm_history_row();
create or replace trigger owner_dm_threads_retention
before update or delete on public.insight_dm_threads
for each row execute function public.protect_owner_dm_history_row();
create or replace trigger owner_dm_messages_retention_truncate
before truncate on public.insight_dm_messages
for each statement execute function public.protect_owner_dm_history_truncate();
create or replace trigger owner_dm_threads_retention_truncate
before truncate on public.insight_dm_threads
for each statement execute function public.protect_owner_dm_history_truncate();

comment on function public.protect_owner_dm_history_row() is
  'Keep owner DM history without expiry; preserve first captured content and prevent deletion. Participant history is unchanged. Attachments remain stored URLs, not mirrored file bytes.';
