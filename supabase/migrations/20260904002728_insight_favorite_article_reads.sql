create table if not exists public.insight_favorite_article_reads (
  member_id text not null,
  creator_key text not null,
  article_key text not null,
  article_url text,
  read_at timestamptz not null default now(),
  primary key (member_id, creator_key, article_key)
);

alter table public.insight_favorite_article_reads enable row level security;
revoke all on table public.insight_favorite_article_reads from anon, authenticated;

create index if not exists insight_favorite_article_reads_recent_idx
  on public.insight_favorite_article_reads (member_id, creator_key, read_at desc);
