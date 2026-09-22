-- Edge Functions classify structured kinds before the older text-only triggers.
-- Keep their confirmed result as the final classification, preserving raw data.
create or replace function public.apply_insight_notification_classification_v25()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.meta->>'noise_reason' = 'non-notification-api-capture' then
    new.notification_type := 'capture_noise';
    new.meta := coalesce(new.meta, '{}'::jsonb) || '{"reclassify_pending":false}'::jsonb;
  elsif new.meta->>'classifier' in ('action-v25-window','action-v26-formats')
    and new.meta->>'classified_type' in (
      'like','follow','comment','reply','comment_like','creator_article_posted',
      'my_article_magazine_added','magazine_follow','magazine_article_added','magazine_join',
      'membership_board','membership_board_reply','membership_reaction','membership_started',
      'membership_plan','membership_join','question_box_started','question_answer',
      'purchased_article_updated','purchase','tip','buzz','rating','points','quote','image_used','other','capture_noise'
    ) then
    new.notification_type := new.meta->>'classified_type';
  end if;
  return new;
end;
$$;

-- Only the authenticated owner Edge Function can read or acknowledge formats.
create table public.insight_notification_format_reads (
  kind text primary key check (kind ~ '^[a-zA-Z0-9_:-]{1,120}$'),
  read_at timestamptz
);
alter table public.insight_notification_format_reads enable row level security;
revoke all on public.insight_notification_format_reads from public, anon, authenticated;
grant select, insert, update on public.insight_notification_format_reads to service_role;

create or replace function public.insight_notification_format_summary()
returns table(kind text, notification_count bigint, first_seen_at timestamptz, last_seen_at timestamptz, read_at timestamptz)
language sql stable security invoker set search_path = public as $$
  select n.meta->>'kind', count(*), min(n.captured_at), max(n.captured_at), r.read_at
  from public.insight_notifications n
  left join public.insight_notification_format_reads r on r.kind=n.meta->>'kind'
  where n.notification_type='other'
    and n.meta->>'kind' ~ '^[a-zA-Z0-9_:-]{1,120}$'
    and coalesce(n.meta->>'noise_reason','')<>'non-notification-api-capture'
  group by n.meta->>'kind',r.read_at
  order by (r.read_at is null) desc,max(n.captured_at) desc;
$$;
revoke all on function public.insight_notification_format_summary() from public, anon, authenticated;
grant execute on function public.insight_notification_format_summary() to service_role;
create index if not exists insight_notification_unknown_format_idx
  on public.insight_notifications ((meta->>'kind'),captured_at)
  where notification_type='other' and meta->>'kind' is not null;

-- Repair confirmed formats for all participants now, without requiring a page visit.
with fixes as (
 select id,case when meta->>'kind'='stock_photo' then 'image_used' else 'buzz' end as new_type
 from public.insight_notifications
 where coalesce(meta->>'noise_reason','')<>'non-notification-api-capture'
 and (meta->>'kind'='stock_photo' or
   ((notification_type='quote' or meta->>'kind'='embed_note')
     and concat(meta->>'body',' ',raw_text) ~ 'あなたの記事[[:space:]]*が[[:space:]]*話題(です|になりました)'))
)
update public.insight_notifications n set notification_type=f.new_type,
  meta=coalesce(n.meta,'{}'::jsonb)||jsonb_build_object('classifier','action-v26-formats','classified_type',f.new_type,'reclassify_pending',false,'classification_status','matched','last_reclassified_at',now())
from fixes f where n.id=f.id;

-- Public actor identities may reuse their own verified image, without name matching.
with icons as (
 select distinct on (actor_url) actor_url,actor_image_url
 from public.insight_notifications
 where actor_url ~ '^https://note.com/[A-Za-z0-9_-]+/?$'
 and actor_url !~ '^https://note.com/(m|n|messages|settings)/?$'
 and actor_image_url like 'https://%'
 and actor_image_url !~ '(magazine_cover|/assets/notices/|notices/icon_)'
 order by actor_url,captured_at desc
)
update public.insight_notifications n set actor_image_url=i.actor_image_url,
  meta=coalesce(n.meta,'{}'::jsonb)||jsonb_build_object('last_reclassified_at',now(),'classifier','action-v26-formats','classified_type',n.notification_type,'reclassify_pending',n.notification_type='other')
from icons i where n.actor_url=i.actor_url and coalesce(n.actor_image_url,'')='';
