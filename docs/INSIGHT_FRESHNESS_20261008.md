# INSIGHT freshness update — 2026.10.08.1

Scope: the latest 「フィルター修正確認」 request, including startup and resume freshness across all INSIGHT sections. Base: bc76fdf54c27a12c42f84d759a927c13a2b6f8ec.

## Behavior

- Previous-page disk snapshots remain available for offline recovery, but are no longer presented as a newly verified startup view. A failed latest check visibly identifies saved fallback data.
- Likes, supporter ranking, first-comment ranking, magazines, favorites, social views, notifications, DM, and analysis check current data when activated or resumed. Retained views preserve filter and page choices.
- Summary/history and dashboard metrics load independently. Notification rows and comment rows become visible before optional avatar enrichment finishes.
- Comments replace edited bodies and heart state, and recheck saved pages when deletion/backfill leaves the aggregate count unchanged.
- Hidden DM views stop their polling and pending work; reactivation checks immediately. Analysis summary requests share a current revision and queue a newer check when requested during an existing request.
- Shared network deadlines cover both response headers and the body. Cancellation and request generation guards prevent stale responses and account changes from overwriting newer views. Read fallback keeps the captured account token.
- A bounded in-memory diagnostic records only endpoint/action, elapsed time, status and outcome; it does not record tokens, headers or response bodies.

The existing owner-notification userscript remains 3.6.37, dashboard sync remains 1.7.3, and DM sync remains 1.4.10. The filtered 「続きへ」 correction is preserved. No Supabase schema or deployed backend function changes are part of this update.

## Verification

- Added startup, offline recovery, hung-body timeout, cancellation, account-switch, comment merge, retained-page, hidden-DM and analysis-generation regression cases.
- Rechecked existing notification handling/presentation, likes completion, social, DM and magazine tests. Updated old startup-cache assumptions and VM dependency fixtures to match the current requirement without removing retained-data checks.
- TypeScript/Vite production build and whitespace checks pass. Each feature is committed separately and checked by the repository boundary script.
- The added freshness suites are included in the Pages deployment workflow. The corresponding GitHub Actions run records final deployed checks.

Authenticated production histories and Android return-to-app behavior cannot be exercised from the available signed-out browser. These cases are covered with controlled React scene requests; actual user-device traffic timing is not claimed.
