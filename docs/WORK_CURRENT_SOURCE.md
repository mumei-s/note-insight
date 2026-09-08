# WORK CURRENT SOURCE OF TRUTH

Updated: 2026-09-08 11:08 JST

**Always determine the newest work by actual timestamp first, then fetch current GitHub `main`.** Do not choose an older chat/spec because of its title. Do not roll back unrelated newer userscript/tooling work.

## 0. 2026-09-08 current completion checkpoint

Current release:

- INSIGHT app: `2026.09.08.1`
- 本人通知・統計: **v2.9.42**
- fixed public distribution URL: `https://mumei-s.github.io/note-insight/`
- current userscript bootstrap: `public/note-insight-notification-sync.user.js`
- current notification runtime: `public/note-insight-notification-runtime-v2942.js`
- production `insight-notification-ingest-v2`: **v21 ACTIVE**
- production `insight-notification-feed-final`: **v11 ACTIVE**
- current relation backend source: `supabase/functions/insight-relations/index.ts`
- deployed production `insight-relations`: **v11 ACTIVE**

`v2.9.39` was rejected by Android real-device testing. `v2.9.40` reset the notification tool to one runtime. `v2.9.41` repaired the installer route. `v2.9.42` is the current stabilization checkpoint and additionally fixes the manual-save server contract, dock detection, browser guidance, install-result return flow and INSIGHT feed completeness.

### Current 本人通知 architecture — v2.9.42

1. **One current runtime only.**
   - Current bootstrap loads only `public/note-insight-notification-runtime-v2942.js`.
   - Old v2933/v2935/v2936/v2938/v2939/v2940 runtimes remain only as history and must not be re-added to the current `@require` chain.
   - Visible controls live in an isolated fixed iframe. Note DOM click delegation must never receive manual-save/filter/settings button taps.
   - The dock remains at the bottom with safe-area offset.

2. **Real note notification shell detection.**
   - A valid shell must contain the visible exact tabs `通知` and `お知らせ`.
   - Generic reaction dialogs such as `スキをつけたユーザー` must never become the manual-save/filter root.
   - The active shell is retained through a short `PANEL_GRACE=2600` ms transient-DOM grace period so note rerenders do not make the dock blink/disappear immediately.
   - The dock must not depend on one particular notification row existing at every instant.

3. **Filtering is display-only.**
   - Filter never navigates the page and never drives scroll.
   - Only a first/leading creator can cause a joint-magazine noise row to be hidden.
   - A registered creator appearing only second/later in an aggregated notification does not hide that row.
   - Leading creator URL/ID is strongest; if absent, saved hydrated profile names including safely truncated display names are fallback.
   - Existing rows are evaluated when the active notification panel is detected; afterward the panel-scoped MutationObserver evaluates newly inserted rows.
   - Filter groups, creator add/remove and group ON/OFF remain account-isolated.

4. **Native scrolling is authoritative.**
   - No `touchmove` handler.
   - No `wheel` handler.
   - No notification `scroll` listener.
   - No normal-scroll `preventDefault()`.
   - No `scrollTop` writes.
   - No `scrollTo()` from the current notification runtime.
   - No filter/manual-save logic is attached to normal scrolling.

5. **Manual save is manual-only and server-confirmed.**
   - User opens the real note bell notification list and presses `手動保存（続きから）`.
   - Runtime reads only notification rows already loaded in the real shell; it does not auto-scroll to fetch older rows.
   - Current source contract is exactly `note-notification-manual-sync-v2942`.
   - This **must remain compatible** with the server allowlist regex for `manual-sync-v\d+`.
   - A prior defect used `note-notification-manual-v2940`, which did not match the allowlist and could cause `NOTIFICATION_SOURCE_BLOCKED`. Do not restore that source shape.
   - Only server-returned `confirmedClientSignatures` are added to saved signatures/checkpoint.
   - Existing account-scoped saved-signature/checkpoint keys remain compatible.
   - `MAX_NEW=120`, `BATCH=25`, and manual cooldown remain safety limits.
   - Status says `INSIGHT反映N件` from confirmed saves; never count merely attempted rows as saved.

6. **All explicit manual notifications reach an INSIGHT category.**
   - Known rows continue through server classifier into `like`, `follow`, magazine, membership, purchase, tip, etc.
   - Explicit manual rows that cannot yet be classified are stored as `notification_type='other'` instead of being dropped.
   - `insight-notification-feed-final` allows `other` when its source is an explicit/manual notification source.
   - INSIGHT UI already has the `その他` category and 3-second feed refresh.
   - This guarantees a successfully server-confirmed manual row is not silently lost merely because the classifier does not yet know its exact subtype.

7. **Install/update v2.9.42.**
   - Never navigate directly to `tampermonkey.net/script_installation.php`; real-device testing showed that intermediate page can remain stuck.
   - Primary userscript URL is `https://mumei-s.github.io/note-insight/note-insight-notification-sync.user.js`.
   - Installer opens the `.user.js` in a dedicated child tab from the user gesture, preserving the update/result page in the original tab.
   - If the new tab shows only raw script text, treat that as **not installed/updated**. Never mark success from opening the URL alone.
   - Pending update state is stored as `mumei-notification-update-pending`.
   - When the installer tab closes or the original update tab regains focus/visibility, the original tab starts note-side version verification.
   - `notification-setup.html` shows `✅ 更新完了｜本人通知 v2.9.42｜最新版です` only when the running note userscript itself reports v2.9.42.
   - The success result remains visible briefly, then returns to the original INSIGHT URL with `location.replace`.
   - A failed/old-version result stays visible and explicitly says `更新されていません`.
   - If Android temporarily returns to the home screen, reopening the original INSIGHT/settings tab resumes verification from pending state while fresh.

8. **Browser guidance shown on the install page.**
   - Android Edge: supported with Tampermonkey and the required browser-side user-script/developer permission.
   - Android Firefox: supported with Android Tampermonkey add-on enabled.
   - iPhone/iPad Safari: supported with Safari Tampermonkey enabled and relevant website access allowed.
   - Desktop Chrome/Edge: supported; current Tampermonkey 5.3+ may require Allow User Scripts or Developer Mode.
   - Desktop Firefox/Safari/Opera: supported with the corresponding Tampermonkey extension enabled.
   - Android Chrome and Yahoo in-app browser: do not claim 本人通知 support; guide to Edge/Firefox (or Safari on iOS).
   - Core INSIGHT analytics still must not depend on any one browser or userscript engine.

9. **Independent version tracks.**
   - `public/insight-release.json.appVersion` is the latest INSIGHT app version.
   - `public/insight-release.json.notificationVersion` is the latest 本人通知 version.
   - `src/insight-release.ts` embeds the running INSIGHT app version.
   - userscript metadata/version identifies the installed 本人通知 version.
   - an INSIGHT-only change increments `appVersion` only.
   - a 本人通知-only change increments `notificationVersion` only.
   - INSIGHT main dashboard always shows current/latest values for both tracks.
   - only the mismatched product receives `NEW` / `更新あり` treatment.
   - an unverified notification installation says `この端末 未確認`; never infer installation from the server manifest.

### INSIGHT app 2026.09.08.1 update feedback

- The INSIGHT本体 update/check button visibly enters `確認中…`.
- Even when already current, the check is held long enough to be perceptible and then shows `✅ INSIGHT本体 v...｜最新版です` for several seconds.
- Future actual app updates store a session result marker before reload so the new bundle can show `更新完了・最新版` after reload.
- The version status cards remain the authoritative current/latest display.

### INSIGHT notification-card compacting retained

- notification category pills remain the primary category label.
- duplicate large category headings inside cards stay hidden for ordinary notification types.
- `magazine_article_added` retains the strong headline because numeric values such as `新しい記事を109本追加` are important.
- redundant secondary text stays hidden for simple types where it repeats actor/category information, including follow, magazine join/follow, membership join/reaction.
- card padding, avatar size, gaps and line height remain compact.

### Exact membership categories retained

- note URLs containing `kind=circle_plan_join` remain `membership_join`.
- `kind=board_like_comment` / `kind=board_like_post` remain `membership_reaction`.
- board replies, board posts and membership plan-open URLs remain protected from generic DB classification.
- production DB migration `notification_membership_exact_v5` remains applied.

### Live follow/follower repair retained

- notification ingestion and relation synchronization are separate pipelines.
- `insight-relations` production function is v11.
- relation upsert separates unchanged (`stable`) and changed (`touched`) rows into uniform PostgREST batches.
- relation/event batches are 300 rows and database/API errors use `errText`.
- `MemberInsightLiveV2` starts both follower/following direction syncs after INSIGHT opens.
- relation refresh is throttled by `RELATION_MS=180_000`.
- opening the フォロー view explicitly calls `relationSync(true)`.
- successful direction sync increments revision and reloads totals, people and delta history.
- current note official count is overlaid through `insight-social-events.liveCounts` when available.

## 1. Production scope

The production-facing app is **INSIGHT only**.

- Games remain detached and preserved.
- Creator directory/catalog remains detached and preserved.
- Public participant navigation is TOP / INSIGHT.
- OWNER routes remain separate and authenticated.
- Core INSIGHT must work in ordinary modern browsers without depending on Edge-specific behavior.
- Browser/userscript compatibility diagnostics may recommend another browser where a userscript engine is unavailable, but Edge must never be a requirement for core INSIGHT analytics.

## 2. Full participant INSIGHT — do not simplify

Participant dashboard uses the full-history/live implementation. Visible participant tabs include:

- 概要
- スキ履歴
- コメント
- 応援者
- フォロー
- 通知
- 記事

Saved full history must display immediately. A fresh note crawl must never block initial display.

`ss_yr` remains mapped to the preserved legacy analytics scope `member_id='owner'`; other participants remain strictly scoped to their own participant UUID. Never expose OWNER history to another participant.

## 3. Public comments/replies and reaction synchronization

Current semantics must be preserved:

- note v3 structured comment JSON is supported.
- pagination follows note `next_page` rather than assuming requested page size.
- comment body text is extracted from structured children/text values.
- parent/child reply relationships are stored.
- `latest_creator_reply` semantics are preserved.
- pending threads are revisited, including older threads through rotating windows.
- creator replies update thread state but do not create false inbound notifications.
- scheduled public comment refresh continues independently of the browser.

Thread status:

- `unreplied`: creator reply not captured.
- `followup_pending`: creator replied before, latest reply is external.
- `replied`: latest reply is the creator.

Public comments/likes are core public data and **must not require 本人通知 pairing**.

## 4. Follow/follower semantics

- Current totals should prefer note official current counts.
- `followers` identity enumeration is capped by note at the latest 1,000 identities for accounts above 1,000 followers.
- an identity falling outside the latest-1,000 window alone must never be treated as an unfollow.
- official-count delta plus latest-1,000 snapshot is used for capped follower tracking.
- when the official delta can be mapped to visible identity changes, save named 【増】【減】 events.
- if an official delta cannot be identified within the latest window, save the unmatched amount as an unknown aggregate event instead of inventing a person.
- `followings` is fully reconciled when note returns the complete list.
- relation sync must continue to split changed/unchanged bulk upserts.
- opening the フォロー screen must continue to trigger `relationSync(true)`.

## 5. Public notifications vs 本人通知

Public reaction watch supplies identifiable public events such as likes, comments/replies and observable follows.

本人通知 supplies logged-in note-bell events that public crawling cannot reliably provide, including purchases, tips, membership events and other notification-only categories.

The participant notification view merges appropriate saved sources for that participant while maintaining strict account isolation.

## 6. 本人通知 account isolation and pairing

- actual note login identity is read from `/api/v2/current_user`.
- ingest token, saved signatures/checkpoint and filter settings are isolated by actual note ID.
- server ingest rejects note-ID/token mismatch with `NOTIFICATION_ACCOUNT_MISMATCH`.
- active verified INSIGHT participants may pair their selected account; no legacy password/code login is reintroduced.
- switching between saved verified accounts does not log out the other saved account.

## 7. Notification categories

The notification UI/feed supports categories including:

- like
- comment_like
- comment / reply
- follow
- creator_article_posted
- magazine_follow / magazine_article_added / my_article_magazine_added / magazine_join
- membership_board / membership_board_reply
- membership_reaction
- membership_started / membership_plan / membership_join
- purchase / tip
- buzz / rating / points / quote / other

Membership exact-category DB protection must remain **after** the older generic classifier trigger so exact `kind=` URLs cannot be overwritten to generic categories.

## 8. Access V6 / account switching

`INSIGHT-XXXXXXXX` is profile ownership verification only; it is not a login password.

Normal participation:

1. enter note ID/profile URL;
2. OWNER approval;
3. temporary public profile verification code;
4. INSIGHT verifies it;
5. long-lived participant session is saved;
6. verification code may be removed from note profile.

There is no normal code-input password login form. New-device/lost-session recovery repeats public profile verification. Remembered old verification codes/passwords are not required.

## 9. Back / browser history semantics

Browser Back must **never mean logout**.

- participant token is not revoked by Back/Forward.
- explicit logout/leave actions are the only destructive session actions.
- internal PWA `?launch=top` behavior must not erase normal dashboard deep links.
- notification install/update must preserve a return path and persistent verification state.
- it is valid to open the real `.user.js` in a dedicated child tab from a direct user gesture so the original INSIGHT result page remains available.
- never navigate directly to Tampermonkey's `script_installation.php` intermediate page.

## 10. PWA and fixed URL

- fixed public URL remains `https://mumei-s.github.io/note-insight/`.
- PWA/browser recovery logic is a safety layer, not a prerequisite for analytics.
- do not change the distribution URL.

## 11. CI / regression protection

Pages workflow must pass before public deployment:

1. `npm ci`
2. JavaScript syntax checks for the current userscript bootstrap and current notification runtime
3. TypeScript/Vite production build
4. unified INSIGHT regression tests including `tests/notification-v2919.test.mjs`
5. Pages artifact upload
6. deploy

Current v2.9.42 Pages validation: GitHub Actions run `34178840083` succeeded, including syntax checks, production build, unified tests, artifact and Pages deploy.

Regression coverage must protect:

- exactly one current runtime `@require` (`runtime-v2942`);
- no legacy notification runtime chain;
- bottom iframe dock and real `通知` + `お知らせ` shell gating;
- transient panel grace without flicker-prone document-wide observers;
- manual source `note-notification-manual-sync-v2942` remaining compatible with server allowlist;
- server-confirmed saved signatures only;
- no normal-scroll interception or scroll-position writes;
- first/leading-creator-only filter behavior;
- filter observation scoped to active notification panel;
- iframe controls with no note-DOM proxy clicks;
- child-tab GitHub Pages `.user.js` install path;
- no direct `script_installation.php` navigation;
- persistent auto-verification and explicit success/failure result;
- explicit-manual `other` ingestion/feed visibility;
- exact membership `kind=` DB classification;
- notification deep link and 3-second INSIGHT feed refresh;
- compact notification cards with numeric magazine-add headline retained;
- independent app/notification release versions and persistent main-screen version display;
- visible INSIGHT app update-check feedback;
- relation sync for both followers/followings;
- social-mode forced relation refresh;
- split stable/touched relation upserts;
- normalized relation error reporting;
- current release manifest.

## 12. Do not regress

- Never replace full participant INSIGHT with a simplified dashboard.
- Never move `ss_yr` to an empty/new analytics scope without a verified migration of all history.
- Never remove comments/replies, follower/following history, supporter ranking, notification history or article archive.
- Never make a fresh note crawl block initial history display.
- Never make 本人通知/userscript a requirement for public comments/likes.
- Never mix notification tokens/settings/history across note IDs.
- Never treat profile verification code as a password.
- Never make browser Back log the participant out.
- Never remove account switching.
- Never change the fixed distribution URL.
- Never make Edge a requirement for core analytics.
- Never let the generic notification classifier override exact membership URL kinds.
- Never intentionally leave one filtered magazine notification visible.
- Never let a second/later creator in an aggregated notification cause the row to be hidden.
- Never restore scroll/touch/wheel interception to the current notification runtime without a verified device reason.
- Never load the old multi-runtime notification chain again.
- Never let manual/filter/settings dock taps proxy-click or fall through to note links.
- Never change the current manual source to a value outside the ingest allowlist contract.
- Never drop explicit-manual `other` rows from ingest/feed; they belong in INSIGHT【その他】 until a stronger classifier is added.
- Never open Tampermonkey's intermediate installation page directly.
- Never claim a notification install/update succeeded until note-side version verification reports the expected version.
- Never put changed and unchanged relation rows with different JSON key sets in one bulk PostgREST upsert.
- Never couple INSIGHT本体 and 本人通知 to one version number or force one update merely because the other changed.
- Never hide both current/latest version tracks from the INSIGHT main dashboard.

## 13. Detached archives

### Games
Preserve completed six-game source, CSS, ledger support, migrations and `docs/GAME_SPEC.md`. Do not reconnect unless explicitly requested.

### Creator directory
Preserve directory/catalog source and Supabase data. It is not part of the current production-facing INSIGHT app unless explicitly requested.

## 14. Persistence discipline

Always fetch newest GitHub `main` by actual commit timestamp before editing. Commit in small recoverable stages. If usage limits appear, stop only after pushing a compilable state and updating this file. Never overwrite unrelated newer work with an older local tree.
