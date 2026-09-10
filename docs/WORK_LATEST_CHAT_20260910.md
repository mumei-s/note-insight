# WORK LATEST CHAT HANDOFF — 2026-09-10

This file is the highest-priority handoff for the next Work/session.

## Authority

- The user's current ChatGPT conversation / 「実機確認修正Deploy」 continuation is the latest specification.
- Always fetch the current GitHub `main` before editing.
- Never overwrite newer unrelated work with stale local state.
- Existing `docs/WORK_CURRENT_SOURCE.md` remains authoritative for preserved historical invariants and completed functionality.
- Real-device behavior reported by the user is authoritative. CI success alone does not prove a mobile/UI bug is fixed.

## 2026-09-10 implementation progress

Release target: **INSIGHT `2026.09.10.1` / 本人通知 `2.9.59` / Dashboard bridge `1.4.2`**.

1. **TOP blank-space structural fix**
   - Removed the runtime `install-free-analysis-link.js` injection from `index.html`.
   - The 4th `詳細分析` card is now owned by `MemberInsightLiveV2` React DOM.
   - TOP has one layout authority: mobile 2x2, desktop 4 columns, content-sized rows/height.
   - The old situation (React 3-card grid + MutationObserver 4th card + separate 2-column CSS) is no longer active.
   - Final Android real-device observation is still required after production deploy; do not claim visual acceptance until observed.

2. **通常データ stuck at 更新中**
   - Manual refresh no longer waits indefinitely for an automatic refresh.
   - Forced manual refresh aborts/supersedes a stale running public sync.
   - Public sync has explicit abort/timeout ownership.
   - UI busy state releases after a bounded time and saved data remains usable while refresh retries.

3. **本人通知なし詳細分析**
   - `public/install-free-analysis.html` now routes to `install-free-analysis-v2.html`.
   - v2 restores saved member session token when possible.
   - It renders saved public/dashboard member data first, then refreshes public data in background.
   - 本人通知 and Dashboard userscripts are not required for this public-data-only analysis.
   - PV/sales/traffic are not guessed.

4. **本人通知 identity/classification**
   - Production `insight-notification-ingest-v2` upgraded to stable classification-independent event identity.
   - Client notification signature is the preferred stable identity; classification changes no longer create a second event identity.
   - Existing legacy/stable candidates are consolidated during future ingest.
   - Exact target kinds handled first: `circle_plan_join`, `board_like_comment/post`, `board_reply_comment`.
   - Article update notices are classified as `creator_article_posted`.
   - Resume-upward/downward captures are stored with a manual-sync-compatible feed source while original capture source is preserved.

5. **Production backend already applied**
   - `insight-notification-ingest-v2`: production Edge Function v23 ACTIVE.
   - `insight-notification-reclassify`: production exact-kind code ACTIVE.
   - DB migration `notification_classifier_exact_actions_v7` applied so the DB BEFORE trigger no longer overwrites corrected exact kinds/article updates back to `other`.
   - 603 existing resume-captured rows had their source normalized for current feed visibility while preserving capture provenance.
   - 7 existing duplicate rows sharing the same client signature were removed, retaining the richest/latest representative.
   - Remaining `other` audit after repair: no membership/comment/magazine-known-form rows; remaining matches are mostly old capture noise plus genuinely unsupported forms (e.g. 質問箱開始).

6. **通知 category UI**
   - Keep ONE compact category selector.
   - No long-press reorder, draggable category rail, or floating category controls.
   - Tapping opens choices inside the same control; selecting closes it.

7. **Update notifications**
   - Keep independent top-item update state for INSIGHT app, 本人通知, Dashboard sync.
   - Do not restore a redundant global update banner.

## Current promotion checkpoint

- Fix branch: `fix-latest-chat-20260910-v2`.
- Branch is based on the latest main that existed at the start of this continuation; compare against current main before promotion.
- Regression coverage now matches native 4-card TOP, stable notification identity, exact membership kinds and INSIGHT `2026.09.10.1`.
- Next step: fast-forward current main to the branch only if it is still a strict ancestor; then monitor GitHub Pages build/regressions/deploy until success.

## Required final verification

After each new change:
1. fetch latest main,
2. run userscript syntax/build/regressions,
3. deploy GitHub Pages and relevant Supabase changes,
4. verify public production assets/pages,
5. then verify Android/mobile real rendering for the persistent blank-space issue,
6. record exact commit SHA / Actions run and any remaining real-device-only check.

Do not simplify or remove unrelated completed INSIGHT features to make tests pass.
