# INSIGHT capacity and billing diagnosis — 2026-10-08

Read-only follow-up to the user's clarification that “communication status” refers to the capacity overage that led to a paid plan. No individual participant histories, credential values or cron command strings were returned during this diagnosis.

## Previous restriction

`docs/EGRESS_OPTIMIZATION_20260930.md` records HTTP 402 `exceed_egress_quota`, 13.4 GB cumulative egress and 16 GB log ingestion on September 30. These are historical figures, not October usage. Egress measures outgoing data; it is distinct from database disk size and browser local-storage exhaustion.

## Current observations

Read-only connector/SQL checks at approximately 2026-10-08 19:19 JST found:

| Item | Observed value |
| --- | --- |
| Project | ACTIVE_HEALTHY |
| Organization plan | Pro |
| Database | 268,987,539 bytes (about 257 MiB) |
| Storage objects | About 3.34 MiB |
| Database read-only restrictions | off |
| REST / Functions HTTP 402, previous 24 hours | 0 / 0 |
| REST / Functions log records, previous 24 hours | 55,636 / 1,918 |
| Capacity/read-only database errors | 0 |
| Scheduled INSIGHT jobs | All 5 active |
| Background maintenance flag | false |

The five active jobs match the September 30 pause backup and retain their original schedules. The pause record does not describe the current state. Function HTTP 500 errors were also observed (62, including 58 for DM ingest); these are separate from the absence of capacity-restriction errors.

Monthly egress, service byte breakdown, invoice amount, Spend Cap and payment status were unavailable through the connector. The Usage/Billing browser page required sign-in. Request counts cannot be converted into billable GB or a bill. Current healthy status does not prove that previous billed usage was reversed or that future usage is within quota.

## Endpoint counts

The log aggregates use one fixed window: 2026-10-07 10:19:08 UTC to 2026-10-08 10:19:08 UTC (October 7–8, 19:19:08 JST). Query strings, headers, bodies and member IDs were not returned.

| REST table/RPC | Records | HTTP 400+ |
| --- | ---: | ---: |
| insight_public_articles | 9,912 | 0 |
| insight_notifications | 9,530 | 3 |
| rpc/insight_comment_refresh_batch | 6,837 | 161 |
| rpc/insight_egress_upsert | 6,311 | 0 |
| insight_public_likes | 4,660 | 0 |
| insight_public_comments | 3,778 | 0 |
| insight_notification_profiles | 2,797 | 31 |
| rpc/insight_apply_avatar_batch | 2,277 | 0 |

| Function | Records | HTTP 400+ |
| --- | ---: | ---: |
| insight-member-history | 351 | 0 |
| insight-access | 284 | 0 |
| halloween-profile | 214 | 0 |
| insight-member-api | 169 | 0 |
| insight-notification-ingest-v2 | 153 | 1 |
| insight-access-reactivate | 142 | 0 |
| insight-comment-refresh | 81 | 0 |
| creator-icons | 78 | 0 |
| insight-avatar-refresh | 76 | 0 |
| insight-dm-ingest | 74 | 58 |

The project also serves `halloween-profile`; project/organization usage must not automatically be attributed entirely to INSIGHT. The top request counts are public-article/notification reads and batch RPCs. DM ingest failures (all 58 are HTTP 5xx) and comment-refresh-batch failures (161 HTTP 4xx) need separate follow-up; neither is proof of a quota restriction. Endpoint counts do not measure response bytes or identify the calling client.

## Code-level traffic candidates

| Priority | Current behavior | Reduction direction |
| --- | --- | --- |
| DM | While visible, 2.5-second polling requests summary, people and stats; selected conversations reread all message pages. Backend page processing rereads up to 5,000 threads. | A lightweight revision check; people/stats only when changed; message cursor and person-scoped DB selection. |
| TOP dashboard | Summary activation/revision also requests 365-day analysis. Backend selects large likes/comments and dashboard/article snapshot sets. | A dedicated latest-KPI response for TOP; detailed series only in analysis. |
| Notifications | Two-minute full refresh selects all notification history before filtering; completion/favorite reads also recur. | Database-side filtering, pagination and joins; changed-revision reuse. |
| Social comparison | 60-second/resume checks read up to 20,000 relationships and 20,000 comparisons before returning a small page. | Database-side comparison/window/pagination plus revision reuse and in-flight deduplication. |
| Manual public sync | Some per-article reads and per-row writes remain outside the September 30 batched background path. | Apply existing batch/difference routines to this path. |
| Quota restriction recovery | Some timers continue after 402 and additionally try a REST read fallback. | Shared backoff that keeps saved views available and avoids repeated failed traffic. |

These are candidates from source code, not measured shares of billed bytes. The previous freshness release reduced hidden DM polling and removed a delayed duplicate startup update, but also caused the full dashboard analysis to rerun on more revisions/activations. Thus the freshness fix must not be reported as a demonstrated billing saving.

Supabase images in the inspected INSIGHT code are mainly external HTTP URLs. Full-history JSON rereads are a stronger first target than deleting images or user history.

Official references: [Egress accounting and usage](https://supabase.com/docs/guides/platform/manage-your-usage/egress), [Database size](https://supabase.com/docs/guides/platform/database-size), [Billing FAQ](https://supabase.com/docs/guides/platform/billing-faq). The current Egress documentation explicitly notes that gateway logs do not include response-byte data.
