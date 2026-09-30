# INSIGHT egress optimization — 2026-09-30

## Scope and current safety state

The owner requested implementation before paying, not a billing upgrade. Billing remains untouched. Participant maintenance remains enabled. No participant records or saved history were deleted. Five cron jobs were deactivated after their schedules and prior active flags were backed up in `private.insight_egress_job_backup`. Their original scheduling frequencies were not changed.

At 2026-09-30 05:43:53 UTC (14:43 JST): maintenance=true, active INSIGHT cron jobs=0, backed-up jobs=5. No new entries in `net._http_response` were observed after 05:26 UTC before the single final read-only probe. That probe (10870) returned HTTP 402 `exceed_egress_quota` at 05:43:53 UTC. A paused service's zero cron traffic must not be presented as the savings of a normally running service.

## Production deployment completed

Source pin: `2648585ac129ff356052f65f9ea4c27ce0ab47ac` in `mumei-s/note-insight`.

Each deployed entrypoint statically imports the immutable GitHub raw URL for its own source at this commit. The Supabase deployment service successfully bundled the code and reported ACTIVE. Existing custom authentication and existing verify_jwt=false configuration were preserved; no unauthenticated data RPC was granted.

| Function | Before | Deployed |
|---|---:|---:|
| insight-like-backfill | 5 | 6 |
| insight-comment-refresh | 6 | 7 |
| insight-avatar-refresh | 3 | 4 |
| insight-relations | 12 | 13 |
| insight-notifications | 5 | 6 |

GitHub Actions run 36674378997 successfully applied exact-match source patches, Deno-checked all five functions, built the unchanged frontend, and committed the four existing-function updates separately. The legacy `insight-notifications` source had not previously been tracked in this repository; its existing live actions were retained when archiving the optimized version. No unrelated UI, notification reader, DM, follower-loss classification, or KNOTA functionality was rewritten.

## Applied migrations

- `20260930052504_insight_egress_maintenance_pause_20260930.sql`
- `20260930052907_insight_egress_batch_rpcs_20260930.sql`

Both files were copied into `supabase/migrations/` after application. New RPCs are service_role-only, SECURITY DEFINER with an empty search_path; private control tables are not exposed to anon/authenticated roles.

## Component comparison, NOT total billed GB

### 1. Like deficit detection: actual current database comparison

There are seven enabled, verified public-watch profiles with respectively 89, 269, 126, 49, 166, 94 and 195 positive-like articles. The former implementation required a list query plus one HEAD count per article: 995 HTTP requests for a full pass. The new implementation uses one aggregate RPC per profile: 7 requests, a 99.30% reduction for this component. An SQL comparison of old/new calculations found 109 candidate articles and ZERO candidate mismatches.

This excludes catalog discovery, external note.com requests, actual like ingestion, authorization and unrelated frontend requests.

### 2. Comment refresh: actual 275-comment sample

The largest sampled article has 275 stored comments. Former refresh performed one existing-key query and 275 individual upserts even when unchanged. New refresh uses one transactional RPC for these 275 comments. Thus this component changes from 276 DB HTTP requests to one (99.64% fewer). The SQL regression test confirmed changed=0 and unchanged=275. Unchanged rows are not rewritten.

Additional transactional tests verified new comment+notification creation, duplicate suppression, and persistence of an edited body, reply parent and heart/like-count change. Test fixtures were rolled back. Article metadata updates and external note comment/reply reads are outside the above 276-to-one comparison.

### 3. Public follower notification watcher

The former implementation read existing follower keys then upserted one row per fetched person. The new path sends deduplicated followers in batches and checks new/unchanged rows inside PostgreSQL. For 60 fetched people, the relevant DB round trips fall from 61 to one (98.36% fewer), excluding external note.com page fetches. A transaction using existing followers verified changed=0 and newNotifications=0. New follower notifications retain the existing fingerprint and baseline behavior.

### 4. Avatar propagation

Formerly each successful creator lookup caused two update requests, returning person keys only to count updates. The new path applies both table updates in one RPC per eight attempted creators and returns scalar counts. For 220 successful candidates, propagation requests change from 440 to 28 (93.64% fewer). This is a code-path calculation, not a post-release 220-person production measurement. Missing avatar candidates are distinct by URL. Failed/no-image URLs enter a six-hour retry cooldown rather than being retried every 15 minutes.

### 5. Full catalog discovery

The backfill's full historical catalog previously ran on every half-hour pass: up to 48 successful full sweeps per profile/day. A successful complete catalog now has a 24-hour cache, reducing this path to approximately one/day (97.92% fewer full sweeps under regular scheduling). Incomplete scans are not marked complete. The separate recent/rotating public watcher and half-hour like-deficit checking cadence remain available after maintenance is lifted. New items are not intentionally held for 24 hours.

### 6. Maintenance and quota behavior

All five background entrypoints honor a fail-closed maintenance check. Missing/invalid cron secrets are denied. A database HTTP 402 raises a quota error and opens a 60-second per-isolate circuit breaker; crawler loops stop rather than continuing requests across profiles. This is not a global cross-isolate rate limiter, and already in-flight parallel requests can still finish.

## Regression checks

Database transaction tests: unchanged upserts for articles/comments/likes/followers produce zero writes; edited comment writes once; repeat writes zero; new comment notification atomicity; duplicate notification prevention; reply/heart/body changes retained; unchanged follower notifications suppressed; empty-avatar batch=0; invalid secret denied; public RPC execution denied. All test mutations were rolled back.

Runtime test: `node tests/egress-runtime-20260930.test.mjs` passed 28 mocked checks across all five worker handlers: maintenance, missing-state fail-closed behavior, invalid/missing secrets, OPTIONS, one-network-call 402 breaker, bounded 400/400/1 batching, and propagated RPC failures. No production network was used in these runtime tests.

## What is not yet measured

The screenshot's 13.4 GB egress and 16 GB log ingestion are accumulated use; source changes do not erase previously accounted usage. Request-count savings above must NOT be multiplied into 13.4 GB or 16 GB to claim a final bill. Payload sizes, log source mix, frontend behavior and real activity differ by request. A free-5-GB/month guarantee cannot be made from these tests.

The production gateway still returns 402 before normal function execution, so participant login/read recovery and a representative 24-hour post-change traffic measurement remain pending. Do not lift maintenance solely because deployment succeeded.

## Resume procedure — deliberately not executed

After the owner confirms upgrade (or a quota reset), verify the gateway restriction has cleared. Keep participant maintenance while smoke-testing authorized reads. A controlled background test requires `private.insight_egress_control.maintenance=false`; do not enable every cron job before this smoke test. Restore each original active flag/schedule from `private.insight_egress_job_backup` only after checking its result, stagger initial runs, and watch for 402 or processing errors. Finally lift participant maintenance, then compare an equivalent observation window using billing usage and API/log counts. No payment or automatic paid resource creation is part of this change.
