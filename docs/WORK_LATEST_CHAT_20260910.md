# WORK LATEST CHAT HANDOFF — 2026-09-10

**LATEST REQUIREMENTS = current ChatGPT conversation, continuation of 「実機確認修正Deploy」.** Fetch current GitHub `main` before editing; never overwrite unrelated newer work. Preserve all invariants from `docs/WORK_CURRENT_SOURCE.md`. Real-device reports are authoritative; CI does not prove mobile rendering.

Release target: INSIGHT `2026.09.10.1` / 本人通知 `2.9.59` / Dashboard bridge `1.4.2`.

Implemented on branch `fix-latest-chat-20260910-v2`:
- TOP structural blank-space fix: no dynamically injected 4th card. React owns all four; mobile 2x2, desktop 4 columns, content-height grid.
- 通常データ: forced manual refresh supersedes stale auto sync; abort/timeout ownership; bounded busy state; saved data stays usable.
- 本人通知なし詳細分析: saved public data first, background refresh after; no notification/Dashboard userscript required; no fabricated PV/sales/traffic.
- 通知 category UI: one compact tap selector only; no long-press/reorder/draggable category rail.
- 本人通知 backend: classification-independent stable identity; exact membership kinds; article-update classification; resume capture source normalized for feed with original source preserved.
- Supabase production updated: ingest v23 ACTIVE; reclassify exact-kind ACTIVE; DB migration `notification_classifier_exact_actions_v7` applied.
- Existing data repaired: 603 resume rows normalized for feed; 7 duplicate client-signature rows removed; known article-update rows backfilled.
- Remaining `other`: no known membership/comment/magazine forms in audit; residuals are old capture noise or unsupported forms.
- Update indications remain per top item; no generic global banner.

Finalization: compare this branch to current main, fast-forward only if main is a strict ancestor, then monitor userscript syntax, npm build, unified regressions, Pages artifact and deploy. Repair any failure. Android top blank-space acceptance still requires actual production mobile observation; do not claim it from CI alone.
