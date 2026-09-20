-- Lock down internal INSIGHT working tables.
-- They are accessed through service-role Edge Functions, never directly by browser clients.

alter table public.insight_creator_latest_articles enable row level security;
alter table public.insight_article_current_likes enable row level security;
alter table public.insight_notification_network_probes enable row level security;

revoke all privileges on table public.insight_creator_latest_articles from anon, authenticated;
revoke all privileges on table public.insight_article_current_likes from anon, authenticated;
revoke all privileges on table public.insight_notification_network_probes from anon, authenticated;

comment on table public.insight_creator_latest_articles is
  'Internal INSIGHT cache. Browser roles have no direct access; use authenticated Edge Functions.';
comment on table public.insight_article_current_likes is
  'Internal INSIGHT current-like snapshot. Browser roles have no direct access; use authenticated Edge Functions.';
comment on table public.insight_notification_network_probes is
  'Internal notification network diagnostics. Browser roles have no direct access; service-role only.';
