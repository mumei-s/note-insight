# Notification recent: scoped auxiliary reads

Local candidate against `f87785887c248cf4246d3571a7f6adde4fa3acbc`. No deployment,
production query, migration, stored-history change, or write-path change.

## Change

`insight-notification-feed-final` previously loaded every notification completion
in 1,000-key pages and the member's favorite rows after every recent request,
including an empty result. The 300-row notification query itself is unchanged.

- Deduplicate exactly as before, then query only the completion keys of the
  retained rows, in batches of at most 100 keys. Empty results issue no completion
  query. Both `notice:<numeric identity>` and winning `row:<id>` keys are retained.
- Query favorite candidates only for creators found after the existing display
  fallback. An empty creator set issues no favorite query.
- Favorite filters are case-insensitive exact keys or whole URL path segments.
  They are deliberately a superset: the existing JavaScript URL parser and alias
  mapping remain authoritative. Scheme/host case, HTTP, credentials, ports,
  backslashes, dot segments, slash/query/fragment suffixes, numeric aliases,
  invalid-URL key fallback and the JavaScript Kelvin-sign lowercase case are
  covered. URLs with TAB/LF/CR are retained as candidates because URL parsing
  strips these characters.
- Favorite requests contain at most 50 creator IDs and at most 6,000 encoded
  filter characters for multi-ID batches. The test includes 300 distinct
  80-character IDs. One individually oversized stored ID is not truncated.
- All auxiliary reads retain the authenticated member scope; completion reads
  additionally retain the creator and notification-type scope.

This reduces transferred candidate data, not necessarily database scan work.
Long/distinct creator sets can require more favorite queries than the old single
query. There is no cross-request cache and no stale-state window.

## Verification

`node --test tests/notification-recent-egress.test.mjs`

Six local PGlite tests execute the real Edge request handler against synthetic
SQL tables, compare entire responses with a frozen source oracle, and check that
all saved tables remain unchanged. Covered: empty results; over 2,000 completion
keys; same-time `since` boundary; reclassified older rows; semantic duplicate
winners; actor fallback; legacy favorite aliases; owner/application scope;
participant isolation; the 300-row boundary; filter-size budgets; authentication
and database errors.

Synthetic measurements, not estimates of production billing:

- Empty recent: auxiliary queries **4 → 0**; auxiliary JSON **136,274 → 0 bytes**.
- Five retained rows: auxiliary JSON **123,027 → 455 bytes**; full response remains
  **3,569 bytes** and is structurally identical.
- Running the tests against the baseline source fails five budget assertions.

The existing handling, context, save-order, store-started and feed-RPC suites
also pass (38 tests). Full repository checks are separate.

## Existing limits and rollout review

Favorite alias order is unspecified by the pre-existing query. The change keeps
the JavaScript last-matching-alias rule and does not introduce sorting. The
server's existing implicit result cap now applies to each filtered favorite
batch instead of the whole member list. A real favorite previously hidden beyond
that old cap may therefore become visible. No pagination or migration is added
to redefine this pre-existing behavior.

Before an approved rollout, verify the deployed API supports the documented
PostgREST `match` / `imatch` operators. These exist in both the official v12 and
v14 documentation; production was not contacted during this work.

- https://supabase.com/docs/reference/javascript/or
- https://supabase.com/docs/reference/javascript/in
- https://docs.postgrest.org/en/v12/references/api/tables_views.html#operators
- https://docs.postgrest.org/en/v14/references/api/tables_views.html#operators

Rollback is the prior Edge source only; no data restoration is needed.
