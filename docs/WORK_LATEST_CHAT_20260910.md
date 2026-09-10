# WORK LATEST CHAT HANDOFF — 2026-09-10

This file is the highest-priority handoff for the next Work/session.

## Authority

- The user's current ChatGPT conversation / 「実機確認修正Deploy」 continuation is the latest specification.
- Always fetch the current GitHub `main` before editing.
- Never overwrite newer unrelated work with stale local state.
- Existing `docs/WORK_CURRENT_SOURCE.md` remains authoritative for preserved historical invariants and completed functionality.
- Real-device behavior reported by the user is authoritative. CI success alone does not prove a mobile/UI bug is fixed.

## Current release target

- INSIGHT: `2026.09.10.1`
- 本人通知: `2.9.59`
- Dashboard bridge: `1.4.2`

## Implemented in this continuation

- TOP: removed runtime injection of the 4th detail-analysis card. All four cards now belong to the React DOM. Mobile layout is 2x2, desktop 4 columns, content-sized height.
- 通常データ: manual refresh supersedes/aborts stale automatic public sync, has bounded busy UI, and keeps saved data usable.
- 本人通知なし詳細分析: saved public data renders first, background refresh follows; no notification or Dashboard userscript is required; PV/sales/traffic are not guessed.
- 通知 UI: remains one compact tap selector; no long-press reorder/draggable category rail.
- 本人通知 backend: classification-independent event identity, exact membership target kinds, article-update classification, resume captures normalized to feed-compatible manual source while preserving original capture source.
- Production Supabase: ingest Edge Function v23 ACTIVE; reclassify exact-kind code ACTIVE; DB classifier migration applied.
- Production data repair: 603 resume-captured rows normalized for feed visibility; 7 duplicate client-signature rows removed; article-update known rows backfilled.
- Remaining `other` audit found no membership/comment/magazine known-form rows. Remaining matches are historical capture noise or unsupported forms such as 質問箱開始.
- Update notices remain per top item; no global update banner.

## Production promotion rule

The fix branch is `fix-latest-chat-20260910-v2`. It was built from the then-current main. Before promotion compare current main vs this branch and fast-forward only when main is a strict ancestor. Then monitor userscript syntax, npm build, unified regressions, Pages artifact and deploy. If any CI step fails, repair it before declaring completion.

## Still requires observation after deploy

The repeated Android top blank-space bug is not accepted by CI alone. After production deploy, open the actual mobile-sized production view and confirm no reserved vertical gap remains. If this normal chat cannot run a real authenticated mobile browser, mark that single observation as needing Work/Android confirmation rather than claiming it is fixed.
