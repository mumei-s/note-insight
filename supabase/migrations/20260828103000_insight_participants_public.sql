create table if not exists public.insight_participants_public (
  member_id text primary key,
  note_id text not null unique,
  display_name text not null,
  image_url text,
  role text not null check (role in ('owner', 'member')),
  active boolean not null default true,
  synced_at timestamptz not null default now()
);

alter table public.insight_participants_public enable row level security;
revoke all on table public.insight_participants_public from anon, authenticated;

insert into public.insight_participants_public
  (member_id, note_id, display_name, image_url, role, active, synced_at)
values
  (
    '66150a78-7c53-408a-8119-16255d2183d9',
    'ss_yr',
    '【無名 S note】18日でフォロワー1000名🚨連続収益中！48マガ・13共マガ運営 参加72🙆',
    'https://assets.st-note.com/production/uploads/images/280421627/profile_54172438db482342de0ca9ef8c6395ec.jpg?fit=bounds&format=jpeg&quality=85&width=330',
    'owner',
    true,
    now()
  )
on conflict (member_id) do update set
  note_id = excluded.note_id,
  display_name = excluded.display_name,
  image_url = excluded.image_url,
  role = excluded.role,
  active = excluded.active,
  synced_at = excluded.synced_at;
