# WORK LATEST CHAT HANDOFF — 2026-09-10

Latest requirements: current ChatGPT conversation / 「実機確認修正Deploy」 continuation. Fetch current GitHub `main` before editing and never overwrite unrelated newer work. Preserve `docs/WORK_CURRENT_SOURCE.md` invariants. Real-device behavior is authoritative.

Release: INSIGHT `2026.09.10.1` / 本人通知 `2.9.59` / Dashboard bridge `1.4.2`.

Implemented on `fix-latest-chat-20260910-v2`: React owns all four TOP cards (mobile 2x2; runtime 4th-card injection removed); 通常データ refresh can supersede/abort stale auto sync and releases busy UI while saved data stays usable; 本人通知なし詳細分析 displays saved public data first and refreshes in background without requiring notification/Dashboard userscripts; notification category UI is one tap panel with no long-press/reorder; notification ingest now uses classification-independent stable identity, exact membership kinds, article-update classification, and feed-compatible resume provenance. Production Supabase already has ingest v23, exact reclassify, classifier migration; 603 resume rows normalized; 7 duplicate client-signature rows removed. Remaining `other` audit has no known membership/comment/magazine forms. Updates remain per TOP item with no generic banner.

Finalize by comparing branch to current main, fast-forwarding only if main is its ancestor, then monitor syntax/build/regression/Pages deploy. Android blank-space acceptance still needs actual production mobile observation; do not infer it from CI.
