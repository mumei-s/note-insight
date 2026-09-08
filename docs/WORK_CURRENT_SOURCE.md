# WORK CURRENT SOURCE OF TRUTH

Updated: 2026-09-08 12:52 JST

**Always determine the newest work by actual timestamp first, then fetch current GitHub `main`.** Do not choose an older chat/spec because of its title. Do not roll back unrelated newer userscript/tooling work.

## 0. 2026-09-08 current completion checkpoint

Current release:

- INSIGHT app: `2026.09.08.3`
- 本人通知・統計 package: **v2.9.46**
- fixed public distribution URL: `https://mumei-s.github.io/note-insight/`
- current userscript bootstrap: `public/note-insight-notification-sync.user.js`
- current stable notification core runtime: `public/note-insight-notification-runtime-v2945.js`
- production `insight-notification-ingest-v2`: **v21 ACTIVE**
- production `insight-notification-feed-final`: **v12 ACTIVE**
- deployed production `insight-relations`: **v11 ACTIVE**

Real-device history: v2.9.39 was rejected for interaction/scroll instability. v2.9.40 reset to one runtime. v2.9.41 repaired installer routing. v2.9.42 fixed manual-save server contract but failed because iframe inline script/postMessage could die on Android. v2.9.43 removed that dependency. v2.9.44 fixed filter duplicate binding/OFF restoration and magazine-join avatars. v2.9.45 made filter state session-only and restored a checkpoint-based previous-save line independent of note read/unread state. Real-device testing then confirmed manual ingest and filtering were operating, but newly loaded notifications were not visible in the INSIGHT【通知】 screen. Production audit proved the v2.9.45 rows were already in `insight_notifications`; the remaining fault was **after ingest**. v2.9.46 therefore hardens the DB→feed→matching-INSIGHT-account display path without changing the stable v2945 filter/checkpoint core.

### A. Current 本人通知 architecture

1. **One stable core runtime only.**
   - Bootstrap package is v2.9.46.
   - Bootstrap still loads exactly one core `@require`: `public/note-insight-notification-runtime-v2945.js?v=2945a`.
   - v2945 remains the verified filter/checkpoint implementation; do not rename it to v2946 unless its core source is actually changed.
   - Older v2933/v2935/v2936/v2938/v2939/v2940/v2942/v2943/v2944 runtimes remain history only and must never be restored to the active chain.
   - Visible controls remain inside one isolated fixed iframe. The iframe contains markup/styles only, no executable inline script.
   - Parent userscript binds controls directly through `contentDocument`; no postMessage control transport.
   - Same iframe controls are bound only once.

2. **Real note bell shell only.**
   - Detect exact visible `通知` and `お知らせ` tabs; use throttled small-text fallback only when necessary.
   - Generic dialogs such as `スキをつけたユーザー` must never become the manual-save/filter root.
   - Dock remains at the bottom with safe-area offset.

3. **Filter is display-only, reversible and session-only.**
   - Target groups/creator IDs are saved per note account.
   - ON/OFF itself is not carried into the next bell session.
   - Every bell reopen starts OFF and restores rows hidden by the previous session.
   - Closing bell also resets OFF.
   - Only a first/leading creator may cause a joint-magazine notification to hide.
   - A targeted creator appearing only second/later in an aggregated notification does not hide the row.
   - ON/OFF status reports actual hidden/restored counts.
   - Filter does not navigate, drive scroll or proxy-click note DOM.

4. **Native scrolling is authoritative.**
   - No `touchmove` interception.
   - No `wheel` interception.
   - No notification `scroll` listener.
   - No normal-scroll `preventDefault()`.
   - No `scrollTop` writes or `scrollTo()` from current notification core.
   - Filter/manual-save work is not attached to normal scrolling.

5. **Manual save is checkpoint-based and server-confirmed.**
   - Current source contract is `note-notification-manual-sync-v2945`, compatible with ingest allowlist `manual-sync-v\d+`.
   - Only server-returned `confirmedClientSignatures` count as saved.
   - `checkpoint.boundarySignature` is the continuation authority.
   - note unread/read/new/seen state is never a continuation signal.
   - Opening or closing the bell without pressing manual save never moves the checkpoint.
   - If previous boundary exists in loaded rows, only rows above it are new candidates.
   - If previous boundary is not loaded, do not silently advance past an unseen gap.
   - `前回保存ここまで` is visual only. It appears only when the exact boundary row is present and passes size guards. Marker failure must never change saved checkpoint state.

### B. Notification reflection pipeline — v2.9.46

**A manual notification is not considered end-to-end complete merely because the userscript says saved. Always verify the complete path:**

`note bell row → ingest v21 → insight_notifications → feed v12 → matching INSIGHT account → INSIGHT【通知】`

Production audit on 2026-09-08 confirmed recent v2.9.45 owner imports were in the DB with source `note-notification-manual-sync-v2945` and userscript `2.9.45`. Recent browser sync runs included successful 12/12 inserts. Types present included `magazine_article_added`, `like`, `magazine_join` and `comment`. Therefore the reported missing reflection was not an ingest failure.

1. **Feed v12 treats accepted explicit/manual rows as authoritative.**
   - Once an explicit/manual row has been accepted into `insight_notifications`, `insight-notification-feed-final` returns it after basic raw-text sanity validation.
   - Manual rows do not have to pass a second wording/action regex to become visible.
   - This prevents a note wording change from producing “saved in DB but invisible in INSIGHT”.
   - Explicit/manual `other` rows remain visible under INSIGHT【その他】.

2. **INSIGHT【通知】 entry is account-aware.**
   - v2.9.46 bootstrap reads the real currently logged-in note account from `/api/v2/current_user` when the user presses `INSIGHT【通知】`.
   - It passes `account=<noteId>` to `notification-entry.html`.
   - `notification-entry.html` searches `mumei-insight-saved-accounts-v3` for that exact note ID.
   - Only if that saved account contains its own `memberToken` does entry activate it by setting the existing INSIGHT active-account/member-token keys.
   - Never derive, invent or copy a token from the note ID itself.
   - If the matching saved INSIGHT login is absent, entry does not silently claim success; it warns and opens with the existing INSIGHT session.

3. **Cross-account display is rejected.**
   - `MemberInsightNotificationsFinal` compares the requested notification account / current member note ID against the feed-returned `noteId`.
   - If they differ, it clears notification rows and shows an explicit account-mismatch error instead of showing another account’s history.
   - Feed still refreshes every 3 seconds when visible once the correct account session is active.

4. **`ss_yr` legacy scope remains preserved.**
   - `ss_yr` continues to map to `member_id='owner'` in notification feed/ingest semantics.
   - Other participants remain scoped to their own application/member UUID.
   - Never expose OWNER rows to another participant.

### C. Install/update

- Package latest: v2.9.46.
- Never navigate directly to Tampermonkey `script_installation.php`.
- Primary distribution remains `https://mumei-s.github.io/note-insight/note-insight-notification-sync.user.js`.
- Update page remains open while the `.user.js` is opened in a child tab from a direct user gesture.
- If the child remains raw `.user.js` text for about 1.8 seconds, close that child and perform note-side version verification; never strand the user on raw text.
- Success is shown only when the actually running note userscript reports v2.9.46 through version-check flow.
- Successful result says `更新完了｜本人通知 v2.9.46｜最新版です` and returns to INSIGHT.
- If running version is old/absent, remain on result page and explicitly say it was not updated.
- Pending update state remains persistent so Android temporarily leaving the browser does not lose verification state.

Browser guidance retained:
- Android Edge: supported with Tampermonkey and required user-script/developer permission enabled.
- Android Firefox: supported with Android Tampermonkey add-on enabled.
- iPhone/iPad Safari: supported with Safari Tampermonkey and site access permitted.
- Desktop Chrome/Edge: supported; current Tampermonkey may require Allow User Scripts or Developer Mode.
- Desktop Firefox/Safari/Opera: supported with corresponding extension.
- Android Chrome and Yahoo in-app browser: do not claim 本人通知 support; guide to Edge/Firefox (or Safari on iOS).
- Core INSIGHT analytics must never depend on Edge or the notification userscript.

### D. Version tracks

- `public/insight-release.json.appVersion` = INSIGHT app release.
- `public/insight-release.json.notificationVersion` = 本人通知 package release.
- `src/insight-release.ts` embeds running app version.
- userscript metadata/version identifies installed notification package.
- Current release is app `2026.09.08.3` + 本人通知 `2.9.46`.
- This change increments both because it changes both the userscript account handoff and the INSIGHT app entry/display behavior.
- Main dashboard always shows current/latest for both tracks separately.

### E. Magazine join avatar repair retained

- Legacy `magazine_join` rows had a mix of proper creator images, null creator data and mistaken magazine-cover images.
- 17 rows with missing actor URL/image were uniquely recovered and backfilled.
- 74 uniquely recoverable cover-image rows were replaced with creator profile images.
- Current core `actorImage()` prefers image inside actor link, then `/profile_`, then non-cover candidate.
- Never use `magazine_cover`, OGP or cover artwork as a person avatar.
- INSIGHT `mergeMagazineJoinRows()` merges richer duplicate join rows before icon enrichment.

### F. Exact membership categories retained

- `kind=circle_plan_join` → `membership_join`.
- `kind=board_like_comment` / `kind=board_like_post` → `membership_reaction`.
- board replies/posts and membership plan-open URLs remain protected from generic classification.
- migration `20260907185100_notification_membership_exact_v5.sql` remains applied.

### G. Follow/follower repair retained

- Notification ingestion and relation synchronization are separate pipelines.
- `insight-relations` production v11 remains active.
- Changed/unchanged relation rows are split into uniform PostgREST batches.
- relation/event batches remain 300; errors use normalized `errText`.
- both follower/following directions sync; opening フォロー triggers forced relation refresh.
- followers above 1,000 respect note’s latest-1,000 identity cap and official count delta semantics.

## 1. Production scope

The production-facing app is **INSIGHT only**.

- Games remain detached and preserved.
- Creator directory/catalog remains detached and preserved.
- Public participant navigation is TOP / INSIGHT.
- OWNER routes remain separate and authenticated.
- Core INSIGHT must work in ordinary modern browsers without depending on Edge-specific behavior.

## 2. Full participant INSIGHT — do not simplify

Visible participant tabs include:

- 概要
- スキ履歴
- コメント
- 応援者
- フォロー
- 通知
- 記事

Saved full history must display immediately. Fresh note crawling must never block initial history display.

`ss_yr` remains mapped to legacy analytics scope `member_id='owner'`; other participants remain strictly scoped to their own participant UUID.

## 3. Public comments/replies and reaction synchronization

- note v3 structured comment JSON supported.
- pagination follows note `next_page`.
- comment body text extracted from structured children/text.
- parent/child reply relationships stored.
- `latest_creator_reply` semantics preserved.
- pending/older threads revisited through rotating windows.
- creator replies update thread state without false inbound notifications.
- scheduled public comment refresh remains browser-independent.
- Public comments/likes must not require 本人通知 pairing.

Thread status remains `unreplied`, `followup_pending`, `replied`.

## 4. Follow/follower semantics

- Prefer note official current totals.
- Followers identity enumeration is capped to latest 1,000 for accounts over 1,000.
- Falling outside that window alone is not an unfollow.
- Official count delta + latest-1,000 snapshot drives capped tracking.
- Save named deltas only when identifiable; otherwise save unknown aggregate delta.
- Followings are fully reconciled when complete list is returned.

## 5. Public notifications vs 本人通知

Public reaction watch supplies identifiable public events such as likes, comments/replies and observable follows.

本人通知 supplies logged-in note-bell events that public crawling cannot reliably provide, including purchases, tips, membership and other notification-only categories.

The participant notification view merges appropriate saved sources while maintaining strict account isolation.

## 6. 本人通知 account isolation and pairing

- Actual note login identity comes from `/api/v2/current_user`.
- Ingest token, saved signatures/checkpoint and filter settings are isolated by actual note ID.
- Server ingest rejects note-ID/token mismatch with `NOTIFICATION_ACCOUNT_MISMATCH`.
- Active verified INSIGHT participants may pair their selected account.
- Switching saved verified accounts does not log out other saved accounts.
- Notification entry may activate an existing matching saved INSIGHT session but must never generate a session token locally.

## 7. Notification categories

Supported categories include:

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

Exact membership protection must remain after older generic classifier behavior so exact `kind=` URLs cannot be overwritten.

## 8. Access V6 / account switching

`INSIGHT-XXXXXXXX` is profile ownership verification, not a login password.

Normal participation remains: note ID/profile → OWNER approval → temporary public profile verification code → verification → long-lived participant session. New-device/lost-session recovery repeats public verification. No normal password-style code login form.

## 9. Back / browser history semantics

Browser Back must never mean logout.

- participant token not revoked by Back/Forward.
- explicit logout/leave only destructive session actions.
- PWA `?launch=top` must not erase normal dashboard deep links.
- notification install/update preserves return path and persistent verification state.

## 10. PWA and fixed URL

- fixed public URL remains `https://mumei-s.github.io/note-insight/`.
- PWA/browser recovery is a safety layer, not an analytics prerequisite.
- do not change distribution URL.

## 11. CI / regression protection

Final Pages workflow must pass:

1. `npm ci`
2. syntax checks for current userscript bootstrap and current core runtime
3. production Vite/TypeScript build
4. unified INSIGHT regression tests
5. Pages artifact upload
6. Pages deploy

Regression coverage must protect:

- exactly one active runtime require (`runtime-v2945` for current v2.9.46 package);
- no legacy multi-runtime chain;
- iframe no inline script/postMessage control dependency;
- one physical button tap = one handler transition;
- bottom dock and real bell-shell gating;
- no notification scroll/touch/wheel interception;
- filter session OFF on every bell reopen;
- first/leading-creator-only filtering;
- OFF restores every hidden row;
- manual source stays ingest-allowlisted;
- checkpoint independent from note read/unread state;
- visual boundary best-effort only;
- server-confirmed signatures only;
- explicit/manual rows always survive feed visibility filtering;
- note-account-aware INSIGHT entry using only an existing matching saved member token;
- cross-account feed mismatch is rejected rather than silently displayed;
- magazine join creator image rules;
- install raw-text recovery and actual version verification;
- exact membership classification;
- 3-second notification feed refresh;
- independent app/notification release versions;
- follower/following relation refresh repair.

## 12. Do not regress

- Never simplify the full participant INSIGHT dashboard.
- Never move `ss_yr` away from `member_id='owner'` without verified full-history migration.
- Never remove comments/replies, follow history, supporter ranking, notifications or article archive.
- Never block saved-history display on a fresh crawl.
- Never make 本人通知 required for public comments/likes.
- Never mix notification tokens/settings/history across note IDs.
- Never treat profile verification code as a password.
- Never make browser Back logout.
- Never remove account switching.
- Never change fixed distribution URL.
- Never make Edge a core INSIGHT requirement.
- Never intentionally leave one matching magazine notification visible.
- Never let a second/later creator hide an aggregated notification.
- Never persist filter ON into the next bell session.
- Never move the saved checkpoint from merely opening/closing the bell or from note read/unread state.
- Never restore scroll/touch/wheel interception without verified device reason.
- Never restore old multi-runtime chain.
- Never put executable inline script inside dock iframe or use postMessage for dock controls.
- Never let dock taps proxy-click/fall through to note links.
- Never use magazine cover/OGP/cover as a person avatar.
- Never use a manual source outside the ingest allowlist.
- Never drop an accepted explicit/manual notification from feed because wording regex fails.
- Never open an account-blind INSIGHT notification entry from the note dock.
- Never display another saved INSIGHT account’s notification feed when a specific note account was requested.
- Never invent/copy a member token from a note ID; only activate an already stored matching account token.
- Never claim install success until note-side actual version verification reports expected version.
- Never couple INSIGHT本体 and 本人通知 to a single version number.

## 13. Detached archives

### Games
Preserve six-game source, CSS, ledger support, migrations and `docs/GAME_SPEC.md`. Do not reconnect unless explicitly requested.

### Creator directory
Preserve directory/catalog source and Supabase data. It is detached from current production-facing INSIGHT unless explicitly requested.

## 14. Persistence discipline

Always fetch newest GitHub `main` by actual commit timestamp before editing. Commit in small recoverable stages. If usage limits appear, stop only after pushing a compilable state and updating this file. Never overwrite unrelated newer work with an older local tree.
