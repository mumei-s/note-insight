# WORK LATEST CHAT HANDOFF — 2026-09-10

Latest requirement source: current ChatGPT conversation continuing 「実機確認修正Deploy」. Always fetch current GitHub main before editing; preserve unrelated newer work and `docs/WORK_CURRENT_SOURCE.md` invariants. Real-device behavior is authoritative.

Release target: INSIGHT `2026.09.10.1`, 本人通知 `2.9.59`, Dashboard bridge `1.4.2`.

Implemented on `fix-latest-chat-20260910-v2`: React-native four-card TOP (2x2 mobile) with dynamic detail-card injection removed; bounded/abortable 通常データ refresh with saved data retained; 本人通知なし詳細分析 reads saved public data first then refreshes in background; one compact notification category selector, no long-press/reorder; stable classification-independent notification identity; exact membership kind/article-update classification; resume captures normalized for feed with provenance retained. Production Supabase is already updated; 603 resume rows normalized; 7 duplicate client-signature rows removed; remaining other audit has no known membership/comment/magazine forms. Update indicators remain per TOP item.

Finalize by comparing branch to current main, fast-forwarding only if main remains a strict ancestor, then monitor syntax/build/regressions/Pages deploy and fix any failure. Android blank-space acceptance requires actual production mobile observation; CI is not proof.
