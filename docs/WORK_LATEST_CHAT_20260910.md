# WORK LATEST CHAT HANDOFF — 2026-09-10

Latest requirement source: current ChatGPT conversation / 「実機確認修正Deploy」 continuation. Always fetch current `main`; never overwrite unrelated newer work. Preserve `docs/WORK_CURRENT_SOURCE.md` invariants. Real-device behavior overrides assumptions from CI.

Release target: INSIGHT `2026.09.10.1` / 本人通知 `2.9.59` / Dashboard bridge `1.4.2`.

Implemented on `fix-latest-chat-20260910-v2`:
- TOP: removed dynamically injected 4th analysis card; React now owns all 4 cards. Mobile 2x2, desktop 4 columns, content-height grid.
- 通常データ: stale auto sync can be superseded/aborted; bounded busy UI; saved data remains usable.
- 本人通知なし詳細分析: saved data renders before background public refresh; no notification/Dashboard userscript requirement; no fake PV/sales/traffic.
- 通知 categories: one tap panel only; no long-press/reorder/draggable rail.
- 本人通知 backend: classification-independent stable identity; exact membership kinds; article-update classification; resume captures normalized to feed-compatible source while preserving capture source.
- Supabase production already updated: ingest v23 ACTIVE, reclassify exact-kind ACTIVE, DB classifier migration `notification_classifier_exact_actions_v7` applied.
- Existing production data: 603 resume rows normalized for feed; 7 duplicate client-signature rows removed; known article updates backfilled.
- Remaining other audit has no membership/comment/magazine known-form rows; residuals are historical capture noise or unsupported forms.
- Update indicators remain per top item; no global banner.

Finalize by comparing branch to current main, fast-forwarding only if main is still its ancestor, then monitoring syntax/build/regression/Pages deploy. Fix any CI failure before declaring completion. Android blank-space acceptance still requires actual production mobile observation; do not treat CI as real-device proof.
