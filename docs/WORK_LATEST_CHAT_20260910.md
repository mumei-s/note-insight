# WORK LATEST CHAT HANDOFF — 2026-09-10

Latest requirement source is the current ChatGPT conversation, continuing 「実機確認修正Deploy」. Always fetch current GitHub main before editing; preserve unrelated newer work and `docs/WORK_CURRENT_SOURCE.md` invariants. Real-device behavior is authoritative.

Current release target: INSIGHT `2026.09.10.1` / 本人通知 `2.9.59` / Dashboard bridge `1.4.2`.

Implemented on `fix-latest-chat-20260910-v2`: one native React four-card TOP (mobile 2x2) with the old dynamic detail-card injector no longer loaded; bounded/abortable 通常データ refresh while saved data remains usable; 本人通知なし詳細分析 renders saved public data before background refresh and requires neither optional userscript; one compact notification category panel with long-press/reorder removed; classification-independent notification event identity; exact membership kind handling and article-update classification; resume captures normalized for feed while preserving capture source. Production Supabase is updated (ingest v23, exact reclassify, classifier migration), 603 resume rows normalized, 7 duplicate client-signature rows removed. Remaining other audit has no known membership/comment/magazine forms. Update state remains per TOP item, no global banner.

Final step: compare branch to current main, fast-forward only if main remains a strict ancestor, monitor syntax/build/regressions/Pages deploy and repair any failure. Android blank-space acceptance requires production mobile observation; CI is not proof.
