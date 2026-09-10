# WORK LATEST CHAT HANDOFF — 2026-09-10

Current ChatGPT conversation / 「実機確認修正Deploy」 continuation is the latest requirement source. Always fetch current `main`; preserve unrelated newer work and `docs/WORK_CURRENT_SOURCE.md` invariants. Real-device behavior is authoritative.

Release target: INSIGHT `2026.09.10.1`, 本人通知 `2.9.59`, Dashboard bridge `1.4.2`.

Implemented on `fix-latest-chat-20260910-v2`: native React four-card TOP (mobile 2x2) with dynamic detail-card injection removed; nonblocking/abortable 通常データ refresh with saved data preserved; 本人通知なし詳細分析 showing saved public data before background refresh; one compact notification category selector with long-press/reorder removed; classification-independent notification event identity; exact membership kinds and article-update classification; resume capture source made feed-compatible with provenance retained. Production Supabase is already updated (ingest v23 ACTIVE, exact reclassify ACTIVE, classifier migration applied); 603 resume rows normalized and 7 duplicate client-signature rows removed. Remaining `other` audit contains no known membership/comment/magazine forms. Update indicators remain per TOP item and no global banner is intended.

Finalize by comparing branch to current main, fast-forwarding only if main remains a strict ancestor, then monitor syntax/build/regressions/Pages deploy and repair any failure. Android blank-space acceptance requires real production mobile observation; CI alone is not proof.
