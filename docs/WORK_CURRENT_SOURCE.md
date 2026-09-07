# WORK CURRENT SOURCE OF TRUTH

Updated: 2026-09-07 21:38 JST

**Always determine the newest work by actual timestamp first, then fetch current GitHub `main`.** Do not choose an older chat/spec because of its title. Do not roll back unrelated newer userscript/tooling work.

## 0. 2026-09-07 current completion checkpoint

This is the newest INSIGHT checkpoint and supersedes older notification-sync / relation-sync notes.

Current release:

- INSIGHT app: `2026.09.07.8`
- 本人通知・統計: **v2.9.35**
- fixed public distribution URL: `https://mumei-s.github.io/note-insight/`
- current userscript bootstrap: `public/note-insight-notification-sync.user.js`
- current manual reader: `public/note-insight-notification-runtime-v2933.js`
- current notification UI/filter: `public/note-insight-notification-runtime-v2933-ui.js`
- current notification bottom dock: `public/note-insight-notification-runtime-v2934-dock.js`
- current notification independent guard: `public/note-insight-notification-runtime-v2935-guard.js`
- current relation backend source: `supabase/functions/insight-relations/index.ts`
- deployed production `insight-relations`: **v11 ACTIVE**

### v2.9.35 notification fixes

1. **Membership joins and membership reactions remain exact categories.**
   - note URLs containing `kind=circle_plan_join` are forced to `membership_join`.
   - `kind=board_like_comment` / `kind=board_like_post` are forced to `membership_reaction`.
   - board replies, board posts and membership plan-open URLs are protected from the older generic DB classifier.
   - production DB migration `notification_membership_exact_v5` remains applied.

2. **Saved position remains internal; visible boundary decoration is disabled.**
   - saved/checkpoint keys remain compatible with prior versions.
   - `boundary` still drives `手動保存（続きから）` and prevents unnecessary re-reading.
   - v2.9.35 suppresses the card line/pill and removes `保存済み境界あり` from the bottom status text.
   - saved count and last-save time remain visible.
   - do not remove the internal checkpoint merely because its visible marker is suppressed.

3. **Notification filtering hides every matching magazine-noise row.**
   - registered creator + magazine-add noise is hidden for every matching row.
   - creator URL/ID remains the strongest match.
   - cached creator names are hydrated and truncated note display names ending in ellipsis are matched safely by normalized prefix.
   - there is no intentional “leave one notification visible” behavior.
   - filter groups, per-creator removal and group ON/OFF remain account-isolated.

4. **Install/update stays in browser history.**
   - `notification-update.html` opens the userscript installer in the same tab with `location.assign`.
   - browser Back returns to the update page; version verification then returns to 本人通知・設定.
   - browser diagnostics remain visible for supported/unsupported userscript environments.

5. **Bottom dock is independent from note reaction/modals.**
   - the visible dock is still compact and safe-area-aware near the bottom.
   - the dock/settings are re-parented to `document.body`; they no longer live inside note's notification panel DOM.
   - the dock is shown only when the real visible `通知` + `お知らせ` tab shell is present.
   - unrelated dialogs such as `スキをつけたユーザー` cannot become the notification host.
   - a MutationObserver restores dock state after note inserts/removes transient overlays.
   - manual-save custom events are guarded so their root is forced to the real notification shell; if the shell is absent the manual action is blocked instead of reading another modal.
   - closing another note modal must not permanently delete the dock.

### INSIGHT app 2026.09.07.8 notification-card compacting

- notification category pills remain the primary category label.
- duplicate large category headings inside cards are hidden for ordinary notification types.
- `magazine_article_added` retains the strong headline because the numeric value such as `新しい記事を109本追加` is important.
- redundant secondary text is hidden for simple types where it repeats actor/category information, including follow, magazine join/follow, membership join/reaction.
- card padding, avatar size, gaps and line height are reduced to show more history per screen without removing useful detail/link data.

### 2026-09-07 live follow/follower repair

The reported state was: a new follower already appeared in 【通知】, while INSIGHT本体の「フォロー・フォロワー」 totals, people list and 【増】【減】 history remained stale.

Root cause and repair:

- notification ingestion and relation synchronization are intentionally separate pipelines.
- the relation cron itself was still scheduled, but `insight-relations` failed before creating a new relation-sync run.
- old error formatting hid the database failure as `[object Object]`.
- relation upsert mixed rows with and without `last_changed_at` in one PostgREST bulk upsert when a real delta appeared.
- `upsertPeople` now separates unchanged (`stable`) and changed (`touched`) rows and upserts each uniform shape separately.
- relation/event batches are 300 rows.
- database/API errors use `errText`.
- production `insight-relations` is v11 and was verified by full cron sync.

Verified production result after repair (`2026-09-07 19:25 JST`):

- `ss_yr` official followers: **2,082** (previous 2,078, **+4**).
- latest identifiable follower snapshot: **1,000**; all +4 were identified (`unknownAdded=0`).
- `ss_yr` official followings: **891** (previous 889, **+2**) and all 891 were reconciled.
- 4 follower additions and 2 following additions were saved with actor names/profile URLs.

Current client behavior:

- `MemberInsightLiveV2` starts both direction-specific relation syncs shortly after INSIGHT opens.
- relation refresh is throttled by `RELATION_MS=180_000`.
- opening the フォロー view explicitly calls `relationSync(true)`.
- successful direction sync increments `revision`; `MemberInsightSocialV2` reloads totals, people and delta history.
- current note official count is overlaid through `insight-social-events.liveCounts` when available.

### Independent release/version tracks

INSIGHT本体 and 本人通知 are independently updated products and must never share one version counter.

- `public/insight-release.json.appVersion` is the latest **INSIGHT本体** version.
- `public/insight-release.json.notificationVersion` is the latest **本人通知** version.
- `src/insight-release.ts` embeds the currently running INSIGHT app version.
- userscript metadata/version identifies the installed 本人通知 version independently.
- an INSIGHT-only change increments `appVersion` only.
- a 本人通知-only change increments `notificationVersion` only.
- when both products change in one request, each track increments independently, as in this checkpoint (`2026.09.07.8` / `2.9.35`).
- INSIGHT main dashboard always shows both current/latest version tracks.
- only a mismatch receives `NEW` / `更新あり` treatment for that product.
- an unverified notification installation says `この端末 未確認`; never infer installation from the server manifest.

### Manual-only notification behavior

- Automatic notification crawling and automatic navigation remain OFF.
- User opens the real note bell and presses `手動保存（続きから）`.
- Only server-confirmed rows become saved rows.
- saved boundary/checkpoint is reused internally on the next manual run.
- `MAX_NEW=120`, `BATCH=25`, and the manual cooldown remain safety limits.
- INSIGHT【通知】 reads saved server data and refreshes the visible feed every 3 seconds.
- 本人通知 is an optional logged-in bell extension; core public likes/comments do not depend on it.

## 1. Production scope

The production-facing app is **INSIGHT only**.

- Games remain detached and preserved.
- Creator directory/catalog remains detached and preserved.
- Public participant navigation is TOP / INSIGHT.
- OWNER routes remain separate and authenticated.
- Core INSIGHT must work in ordinary modern browsers without depending on Edge-specific behavior.
- browser/userscript compatibility diagnostics may recommend another browser where a userscript engine is unavailable, but Edge must never be a requirement for core INSIGHT analytics.

## 2. Full participant INSIGHT — do not simplify

Participant dashboard uses the full-history/live implementation, including:

- `src/member-insight-live.tsx`
- `src/member-insight-full.tsx`
- `supabase/functions/insight-member-history`
- `supabase/functions/insight-member-api`

Visible participant tabs include:

- 概要
- スキ履歴
- コメント
- 応援者
- フォロー
- 通知
- 記事

Visible header controls include account switching, 本人通知 and data refresh.

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

The notification UI/feed currently supports categories including:

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

There is no normal code-input password login form.

New-device/lost-session recovery repeats public profile verification; remembered old verification codes/passwords are not required.

## 9. Back / browser history semantics

Browser Back must **never mean logout**.

- participant token is not revoked by Back/Forward.
- explicit logout/leave actions are the only destructive session actions.
- internal PWA `?launch=top` behavior must not erase normal dashboard deep links.
- notification installer/update flow must retain an in-browser return path; do not restore `window.open(..., '_blank')` for the userscript installer.

## 10. PWA and fixed URL

- fixed public URL remains `https://mumei-s.github.io/note-insight/`.
- PWA/browser recovery logic is a safety layer, not a prerequisite for analytics.
- do not change the distribution URL.

## 11. CI / regression protection

Pages workflow must pass before public deployment:

1. `npm ci`
2. JavaScript syntax checks for bootstrap + current notification runtime/UI + v2.9.34 dock + v2.9.35 guard
3. TypeScript/Vite production build
4. unified INSIGHT regression tests including `tests/notification-v2919.test.mjs`
5. Pages artifact upload
6. deploy

Regression coverage must protect:

- v2.9.35 bootstrap/guard path;
- manual-only notification behavior;
- server-confirmed saves and internal checkpoint reuse;
- no visible boundary decoration/status prefix in v2.9.35;
- independent body-level dock/settings and real-notification-shell gating;
- modal-close restoration via MutationObserver;
- full-match filter behavior including truncated creator names;
- same-tab installer return flow;
- exact membership `kind=` DB classification;
- notification deep link and 3-second INSIGHT feed refresh;
- compact INSIGHT notification cards with numeric magazine-add headline retained;
- independent app/notification release versions and persistent main-screen version display;
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
- Never show the old saved-boundary pill/line as a required UI; the checkpoint is internal.
- Never attach the notification dock/settings to a note reaction modal or unrelated dialog.
- Never allow `スキをつけたユーザー` or other unrelated modal to become the manual-save root.
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
