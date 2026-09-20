create table if not exists public.insight_dm_ingest_tokens (
  id uuid primary key default gen_random_uuid(),
  member_id text not null,
  token_hash text not null unique,
  purpose text not null default 'note_dm_auto_sync',
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists insight_dm_ingest_tokens_member_idx on public.insight_dm_ingest_tokens(member_id,created_at desc);

create table if not exists public.insight_dm_pair_codes (
  id uuid primary key default gen_random_uuid(),
  member_id text not null,
  code_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists insight_dm_pair_codes_member_idx on public.insight_dm_pair_codes(member_id,created_at desc);

alter table public.insight_dm_ingest_tokens enable row level security;
alter table public.insight_dm_pair_codes enable row level security;
revoke all privileges on table public.insight_dm_ingest_tokens from anon, authenticated;
revoke all privileges on table public.insight_dm_pair_codes from anon, authenticated;

comment on table public.insight_dm_ingest_tokens is 'Standalone DM sync tokens; independent from本人通知 tokens.';
comment on table public.insight_dm_pair_codes is 'Short-lived standalone DM pairing codes.';