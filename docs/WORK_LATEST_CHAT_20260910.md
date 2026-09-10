# WORK LATEST CHAT HANDOFF — 2026-09-10

This file is the highest-priority handoff for the next Work session.

## Authority

- The user explicitly states that the current ChatGPT conversation is the latest specification.
- Always fetch the current GitHub `main` before editing.
- Do not overwrite newer unrelated work with stale local state.
- Existing `docs/WORK_CURRENT_SOURCE.md` remains authoritative for preserved historical invariants and completed functionality, but this file supersedes it for the unresolved items below.
- Real-device behavior reported by the user is authoritative. CI success alone does not prove a mobile/UI bug is fixed.
- Current checkpoint when this handoff was created: `main = fab154c5cdbfc788c6598818aca9a055e4021a06`. Do not assume this SHA is still current; fetch `main` first.

## User's latest unresolved requirements — priority order

### 1. Remove the persistent blank space on INSIGHT top

The user has repeatedly reported a large blank vertical gap beneath the top source cards on Android/mobile.

Recent code-side attempts already:
- changed the source area toward auto-height,
- removed the prior JS pixel-height forcing,
- uses 2-column mobile layout for the dynamically inserted install-free analysis card.

This is NOT considered complete until verified on the actual rendered production page in a mobile-sized real browser/Cloud Browser.

Work must:
1. Open the deployed INSIGHT page, preferably with a mobile viewport comparable to the user's Android device.
2. Inspect the actual DOM and computed layout around `.miv5-update`, `.miv5-source-grid`, `.miv5-source-card`, the following `.micmp`, and any wrappers/pseudo-elements/transforms/absolute elements that may reserve height.
3. Identify the exact element owning the blank area instead of adding another speculative CSS override.
4. Fix the root cause in source.
5. Deploy.
6. Re-open the production page with cache-busting/service-worker effects accounted for and confirm the blank area is gone.

### 2. Verify and complete ALL 本人通知 categories end-to-end

The user wants all known note notification forms reflected in INSIGHT, not left missing or incorrectly grouped.

Do not stop at UI code. Verify the complete path:

`note bell row -> userscript capture -> ingest confirmation -> insight_notifications -> classification/reclassification -> feed -> matching INSIGHT account -> correct category/card`

Required known categories include at minimum:
- スキ
- コメント♡
- コメント
- 自分の記事返信
- 相手の記事返信
- 人物フォロー
- 記事投稿
- マガジンフォロー
- 自分の記事追加
- マガジン記事追加
- マガジン参加
- メンシプ掲示板
- 掲示板返信
- 自分のメンシプ反応
- 参加中のメンシプ反応
- メンシプ開始
- プラン追加
- メンシプ参加
- 購入
- チップ・サポート
- 話題
- 高評価
- ポイント
- 引用・紹介
- その他 only for truly unknown forms

Specific attention:
- `membership_join` must reliably appear.
- bulletin-board/member notifications must not disappear into `other`.
- reply_self/reply_other split must remain correct.
- known notifications must not duplicate into `other`.
- reclassification must not create a second identity for the same event merely because display category changed.
- save boundaries/checkpoints must not suppress later legitimate notifications.
- feed must show the authenticated matching INSIGHT account only.

If backend changes are required, deploy the relevant Supabase Edge Function/migration as well as GitHub code.

### 3. 本人通知「通知」UI must remain ONE panel

The user explicitly rejected the old long-press/reorder category rail.

Latest intended behavior:
- no long-press reorder,
- no draggable/movable notification-category controls,
- normally show one compact panel/button only,
- tapping it opens the category choices inside the same control,
- selecting a category closes it again,
- no extra floating/long-press panels that obscure the screen.

Current code was changed toward this in `src/insight-ux-v11.ts`; verify production mobile behavior rather than assuming CI proves it.

### 4. Make analysis work WITHOUT 本人通知

The user requires a usable analysis path even when the 本人通知 userscript is not installed.

There are two distinct analysis scopes and they must not be confused:

A. Public install-free analysis:
- `public/install-free-analysis.html`
- must work with INSIGHT login + public INSIGHT data only,
- must NOT require 本人通知,
- must NOT require Dashboard sync,
- must analyze public article/like/comment/follower/posting data,
- must not fabricate PV/sales/traffic.

B. Official Dashboard analysis:
- may require the Dashboard sync bridge where browser security prevents direct official Dashboard extraction,
- 本人通知 must remain optional,
- notification data is an additive layer only.

The user reported that "本人通知なしの分析もできない". Reproduce this on production, identify whether the failure is token/session recovery, public `sync`, `dashboard` member API response, navigation/card injection, or a hanging request, then fix it. Do not simply display explanatory text.

### 5. Fix 通常データ stuck at "更新中"

The user reports the top `通常データ` can remain stuck showing updating.

Current area to audit: `src/member-insight-live-v2.tsx`, especially:
- `publicSync()`
- `waitForPublicSyncIdle()`
- `manualDataRefresh()`
- the automatic timers and `running.current`
- overlapping relation/public sync
- timeout/AbortController paths

Acceptance criteria:
- no indefinite `更新中` state,
- stale locks recover,
- one failed request returns the button/state to usable form,
- manual refresh remains tappable,
- saved data remains visible while a fresh crawl retries,
- repeated taps do not wedge the UI.

### 6. Update notifications belong to EACH top item

The user confirmed they want update indication on each top feature, not a generic global banner.

Required behavior:
- INSIGHT app update -> indicate only the relevant INSIGHT/通常データ item.
- 本人通知 update -> indicate 本人通知 item.
- Dashboard sync update -> indicate Dashboard/分析 item.
- do not show a redundant global top banner that obscures which component needs updating.
- keep release tracks/version numbers separate.

Current production recently moved back toward per-card update indicators; verify actual mobile rendering and click paths.

### 7. Detect and fix other regressions while doing the above

Work must perform a focused production audit rather than only the named bugs.

Check at least:
- console/runtime errors,
- failed/slow network requests,
- service-worker/cache stale assets,
- login/session persistence and accidental logout,
- saved account auto-recovery,
- top card clickability,
- source card/layout overlap,
- notification installer/update return path,
- Dashboard sync second-run behavior,
- notification feed account mismatch safety,
- no regression to unrelated existing INSIGHT features.

Do not remove functioning features merely to make tests pass.

## Latest implementation state before this handoff

Recent intended changes already on main include:
- notification categories changed from long-press/reorder rail to one compact collapsible selector,
- top source area's JS fixed-height forcing removed,
- per-card update indication restored,
- global update banner removed/disabled,
- separate install-free analysis page exists,
- previous Dashboard direct pairing/read flow was repaired,
- saved INSIGHT login/session auto-recovery work was added earlier.

Treat all of these as "implemented but not fully accepted" until production/mobile behavior is verified.

## Completion standard for Work

Do not report completion after source edits alone.

For each repaired item:
1. fetch latest main,
2. implement minimal targeted changes,
3. run syntax/build/regression tests,
4. deploy GitHub Pages and relevant Supabase functions if needed,
5. verify the production page in the browser,
6. record the resulting commit SHA and exact observed behavior,
7. if real-device-only behavior cannot be reproduced in Cloud Browser, state exactly what remains for the user's Android check instead of claiming it is fixed.

The user's current conversation is the latest product requirement source. Preserve all unrelated newer work.
