-- Single-message responses have /messages/<id>, unlike list responses.
with sources as (
  select id,substring(meta->>'request_url' from '^https://dm-api[.]note[.]com/api/v[0-9]+/[0-9a-f-]+/rooms/([0-9a-f-]{36})/messages(?:/[0-9a-f-]{36})?(?:[?]|$)') as actual_room
  from public.insight_dm_messages
  where meta->>'source'='note-dm-network-v2'
)
update public.insight_dm_messages m
set thread_key=s.actual_room,
    meta=coalesce(m.meta,'{}'::jsonb)||jsonb_build_object('previous_thread_key',m.thread_key,'room_repaired_at',now(),'room_evidence','request_url')
from sources s
where m.id=s.id and s.actual_room is not null and m.thread_key<>s.actual_room;
