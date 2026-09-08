# WORK CURRENT SOURCE OF TRUTH

Updated: 2026-09-08 13:45 JST

**Always fetch the current GitHub `main` before editing. Newest actual timestamp/current main is authoritative. Never overwrite unrelated newer work with stale local state. Real-device reports are authoritative; CI success alone does not prove a device bug is fixed.**

## 0. Current production checkpoint

- INSIGHT app: **`2026.09.08.4`**
- 本人通知・統計 package: **`v2.9.47`**
- public URL: `https://mumei-s.github.io/note-insight/`
- userscript bootstrap: `public/note-insight-notification-sync.user.js`
- stable notification core runtime: `public/note-insight-notification-runtime-v2945.js`
- notification ingest: production `insight-notification-ingest-v2` **v21 ACTIVE**
- notification feed: production `insight-notification-feed-final` **v13 ACTIVE**
- relation backend: production `insight-relations` **v11 ACTIVE**
- exact membership migration retained: `20260907185100_notification_membership_exact_v5.sql`
- exact follow/article-post classifier migration applied: `20260908051000_notification_classification_exact_v6.sql`

### Real-device history that must not be forgotten

- v2.9.39: rejected for interaction/scroll instability.
- v2.9.40: reset active 本人通知 to one runtime.
- v2.9.41: installer routing repair.
- v2.9.42: manual-save server contract fixed, but Android dock failed because iframe inline script/postMessage could die.
- v2.9.43: removed inline-script/postMessage control dependency.
- v2.9.44: filter double-binding/OFF restoration and magazine-join avatar repair.
- v2.9.45: filter became session-only; previous-save checkpoint/line became independent of note unread state.
- v2.9.46: proved manual rows were already in DB; repaired DB→feed→matching INSIGHT account display path.
- **v2.9.47: exact notification category routing, manual comment/reply feed merge, self/other reply split, own/joined membership-reaction split, old follow/article-post backfill, and saved-overlap checkpoint recovery.**

## 1. Production scope — do not simplify

Production-facing app is INSIGHT only. Games and creator directory/catalog remain detached and preserved.

Participant INSIGHT remains the full implementation. Do not remove or collapse core tabs/features, including:

- 概要
- スキ履歴
- コメント
- 応援者
- フォロー
- 通知
- 記事
- comments/replies/history
- follow/follower people and delta history
- supporter rankings
- article archive
- favorites/groups
- account switching

Saved history displays first; fresh crawls must not block initial display. Browser Back never means logout. OWNER and participant scopes remain isolated. `ss_yr` remains mapped to preserved owner scope where required; never expose owner history to another participant.

Core INSIGHT analytics must work without requiring Edge or a userscript. The userscript is only for private本人 notification capture/filter functions that note does not expose publicly.

## 2. Version tracks are permanently separate

Never combine INSIGHT本体 and 本人通知 versions.

- `public/insight-release.json.appVersion` = latest INSIGHT app version.
- `public/insight-release.json.notificationVersion` = latest 本人通知 version.
- `src/insight-release.ts` = running app version.
- userscript metadata/version = installed 本人通知 version.

INSIGHT always shows both current/latest versions separately. Only the product actually changed receives NEW/更新あり treatment. An unverified userscript installation says `この端末 未確認`; never infer installed version only from server manifest.

Current pair: **INSIGHT `2026.09.08.4` / 本人通知 `2.9.47`.**

## 3. Stable 本人通知 runtime architecture

### One active core only

Bootstrap v2.9.47 loads exactly one core `@require`:

`public/note-insight-notification-runtime-v2945.js?v=2945a`

Do not restore old v2933/v2935/v2936/v2938/v2939/v2940/v2942/v2943/v2944 runtimes to the active chain. v2945 remains the stable core until its actual core source is intentionally changed.

### Bottom dock

- controls stay at bottom with safe-area offset.
- fixed iframe is presentation isolation only.
- iframe contains markup/styles, no executable inline JS.
- parent userscript binds controls directly through `contentDocument`.
- no postMessage control transport.
- same controls are bound once only.
- generic note popups such as `スキをつけたユーザー` must never become the bell root.

### Real bell detection

Use exact visible `通知` + `お知らせ` tabs and their common notification shell. Temporary DOM rerenders must not make the dock blink/disappear. Reaction dialogs and unrelated modals must not be treated as the notification list.

## 4. Filter — fixed semantics

Filter is display-only and must never navigate or drive scrolling.

- target groups and creator IDs are saved per note account.
- ON/OFF itself is **session-only**.
- every bell reopen starts OFF.
- closing bell resets OFF and restores all rows hidden in that session.
- only the **leading/first creator** may cause a joint-magazine notification to hide.
- a target creator appearing second/later in an aggregate notification must not hide it.
- creator URL/ID is strongest match; hydrated exact/truncated name is fallback.
- ON reports actual `非表示N件`; OFF reports actual `N件復元`.
- do not intentionally leave one matching row behind.

Real-device filter was confirmed working before v2.9.47; classification/checkpoint changes must not regress it.

## 5. Native scrolling is authoritative

The notification userscript must not slow or seize normal note scrolling.

Do not add back:

- `touchmove` interception
- `wheel` interception
- notification scroll listeners
- normal-scroll `preventDefault()`
- `scrollTop` writes
- `scrollTo()`
- auto-scroll to load older notifications
- filter/manual-save work on every scroll frame

## 6. Manual save and continuation checkpoint

Manual save is the only authoritative private-notification capture action.

- user opens the real note bell and presses `手動保存（続きから）`.
- runtime reads rows already loaded in that bell shell; it does not auto-scroll.
- current source contract remains `note-notification-manual-sync-v2945`, accepted by server `manual-sync-v\d+` allowlist.
- only server-returned `confirmedClientSignatures` count as saved.
- note unread/new/read state is **never** the continuation source.
- merely opening or closing the bell never advances the checkpoint.

Authoritative state:

- saved signatures key: `mumei_insight_notification_saved_v2919:<account>`
- checkpoint key: `mumei_insight_notification_checkpoint_v2922:<account>`
- checkpoint boundary: `boundarySignature`

### v2.9.47 overlap recovery

Exact previous boundary may not be present in the currently rendered note list. To avoid repeated `前回ライン未到達`, bootstrap v2.9.47 may recover the checkpoint from the **first visible row that overlaps a server-confirmed saved signature**.

- recovery source marker: `saved-overlap-recovery-v2947`
- this uses saved signatures, never note unread/seen badges.
- it must not scroll the page.
- if no safe overlap is found, keep the old checkpoint rather than silently skipping a gap.

### Previous-save line

`前回保存ここまで` is visual only. Show it only when a safe boundary row is present and size guards pass. If marker rendering becomes unstable/giant/blinking, suppress the visual marker but keep the underlying continuation state.

## 7. Exact notification classification — current required tabs

Known notification types must not remain in `その他`.

Current INSIGHT notification categories include at minimum:

- スキ
- コメント♡
- コメント
- **自分の記事返信**
- **相手の記事返信**
- 人物フォロー
- **記事投稿**
- マガジンフォロー
- 自分の記事追加
- マガジン記事追加
- **マガジン参加**
- メンシプ掲示板
- 掲示板返信
- **自分のメンシプ反応**
- **参加中のメンシプ反応**
- メンシプ開始
- プラン追加
- **メンシプ参加**
- 購入
- チップ・サポート
- 話題
- 高評価
- ポイント
- 引用・紹介
- その他

`その他` is only for genuinely unknown notification forms. Once a form is known, add an exact classifier/backfill rather than leaving duplicate known rows in その他.

### Follow classifier repair v6

DB trigger previously overwrote manual `さんがフォローしました` rows to `other` when target URL was null. Migration `notification_classification_exact_v6` fixes and backfills these to `follow` while retaining true `magazine_follow` when the target is a magazine.

Manual/public duplicates for the same follow actor are deduped in feed using a wider time bucket so one event does not appear simultaneously in 人物フォロー and その他.

### Creator article posts

`○○さんが記事を投稿しました` is `creator_article_posted` and displays in **記事投稿**. v6 migration backfilled existing known rows, including the previously observed Labo. case.

### Comments and replies

Manual bell comment/reply rows live in `insight_notifications`; public canonical comments/replies live in `insight_public_comments`. Feed must merge both stores. Never make コメント/返信 tabs read only the public table.

Replies are display-split by target article owner while DB type remains `reply`:

- target article owner == current note account → `reply_self` → **自分の記事返信**
- target article owner != current note account → `reply_other` → **相手の記事返信**

This specifically covers replies received after the user commented on someone else’s article. Such replies must not disappear or be merged into the own-article reply slot.

### Magazine join

`運営メンバーに仲間入りしました` remains `magazine_join` and must display in **マガジン参加**. Production DB has confirmed v2.9.45 manual rows of this type; feed/UI must not drop them.

### Membership reactions

DB keeps exact base type `membership_reaction`. Feed display splits by target membership owner:

- target owner == current note account → `membership_reaction_self` → **自分のメンシプ反応**
- otherwise → `membership_reaction_joined` → **参加中のメンシプ反応**

Exact `kind=board_like_comment` / `kind=board_like_post` protection remains mandatory.

### Membership join

`kind=circle_plan_join` remains `membership_join` and must display in **メンシプ参加**. Do not let generic DB classifier overwrite it. Production DB contains confirmed membership_join rows and the feed must return them.

## 8. Feed and display pipeline — verify end to end

A save is not complete merely because ingest accepted it. For notification regressions always verify:

`note bell row → ingest confirmation → insight_notifications → classification → feed → matching INSIGHT account → requested tab/card`

Production feed v13:

- explicit manual rows are authoritative and are not dropped by a second wording regex.
- manual comment/reply rows are merged with canonical public comment/reply rows.
- synthetic display categories are applied for self/other replies and own/joined membership reactions.
- account response includes the authenticated note ID.

INSIGHT UI rejects cross-account notification display instead of silently showing the wrong account.

## 9. Account-aware INSIGHT handoff

When pressing `INSIGHT【通知】` from note:

1. read current note account via note current-user endpoint.
2. pass its note ID to `notification-entry.html`.
3. activate only the matching already-saved INSIGHT account/session token.
4. open notification mode directly.

Never manufacture a token from a note ID. If note-side requested account and feed-authenticated account differ, show an account mismatch instead of displaying another account’s history.

## 10. Install/update flow

Never navigate directly to Tampermonkey `script_installation.php`.

Primary script URL remains:

`https://mumei-s.github.io/note-insight/note-insight-notification-sync.user.js`

Update page behavior:

- keep the update/result page open.
- open `.user.js` in a dedicated child tab from a direct user gesture.
- if Tampermonkey intercepts, proceed with its installer.
- if the child remains same-origin raw `.user.js` text for about 1.8s, close that raw-text tab and verify the actually running note userscript.
- show `最新版` only after note-side version verification succeeds.
- if version did not change, explicitly show `更新されていません`.
- pending update state survives Android temporarily leaving the browser.

Browser guidance remains:

- Android Edge: supported with Tampermonkey + required userscript/developer permission.
- Android Firefox: supported with Android Tampermonkey add-on enabled.
- iPhone/iPad Safari: supported with Safari Tampermonkey and website access allowed.
- Desktop Chrome/Edge: supported; current Tampermonkey may require Allow User Scripts/Developer Mode.
- Desktop Firefox/Safari/Opera: supported with corresponding Tampermonkey extension.
- Android Chrome/Yahoo in-app browser: do not claim本人通知 userscript support; guide to a supported browser. Core INSIGHT still works independently.

## 11. Magazine join avatars

`magazine_join` legacy rows may contain null actor fields or magazine-cover images. Current behavior:

- actor-link image first
- `/profile_` asset next
- other non-cover actor candidate last
- never deliberately use `magazine_cover`, OGP or generic cover as person avatar
- merge duplicate magazine-join rows before enrichment and prefer richer actor/profile/target/timestamp data
- `creator-icons` is preferred final enrichment when actor URL exists

Existing production backfill repaired known unambiguous missing/wrong actor images.

## 12. Public comments/replies and reactions

Public note comments/likes are core public data and must not require本人通知 pairing.

Preserve:

- note v3 structured comment JSON
- note pagination by `next_page`
- structured comment-body extraction
- parent/child reply relationships
- latest creator reply semantics
- revisiting pending/older threads
- creator replies updating thread state without false inbound notifications

Thread states remain `unreplied`, `followup_pending`, `replied` with existing semantics.

## 13. Follow/follower semantics

Notification ingestion and relation synchronization are separate pipelines.

- current totals prefer note official counts.
- followers identity enumeration is capped by note at latest 1,000 identities for larger accounts.
- falling outside latest-1,000 window alone is not an unfollow.
- `insight-relations` v11 separates stable/touched upsert row shapes and uses smaller uniform batches.
- opening フォロー triggers relation refresh; totals/people/delta history remain intact.

## 14. UI compacting retained

Notification cards remain compact. Category pill is the primary category label. Duplicate large category headings stay removed for ordinary types. `magazine_article_added` retains strong numeric headline such as `新しい記事を109本追加` because count is meaningful.

Do not reintroduce redundant vertical text that repeats the pill/actor unless it conveys distinct information.

## 15. Regression gate

Before declaring a notification release complete:

1. fetch latest main.
2. preserve unrelated newer changes.
3. run userscript syntax checks.
4. run production TypeScript/Vite build.
5. run unified regression tests.
6. confirm Pages deploy success.
7. if backend changed, confirm production Edge Function/migration state.
8. where possible inspect real production rows for the reported notification forms.
9. still require real-device confirmation for device/UI behavior.

Never call a real-device issue fixed solely because code/tests/deploy passed.
