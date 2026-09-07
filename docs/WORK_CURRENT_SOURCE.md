# WORK CURRENT SOURCE OF TRUTH

Updated: 2026-09-07 19:51 JST

**Always determine the newest work by actual timestamp first, then fetch current GitHub `main`.** Do not choose an older chat/spec because of its title. Do not roll back unrelated newer userscript/tooling work.

## 0. 2026-09-07 current completion checkpoint

This is the newest INSIGHT checkpoint and supersedes older notification-sync / relation-sync notes.

Current release:

- INSIGHT app: `2026.09.07.7`
- 本人通知・統計: **v2.9.34**
- fixed public distribution URL: `https://mumei-s.github.io/note-insight/`
- current userscript bootstrap: `public/note-insight-notification-sync.user.js`
- current manual reader: `public/note-insight-notification-runtime-v2933.js`
- current notification UI/filter: `public/note-insight-notification-runtime-v2933-ui.js`
- current notification bottom dock: `public/note-insight-notification-runtime-v2934-dock.js`
- current relation backend source: `supabase/functions/insight-relations/index.ts`
- deployed production `insight-relations`: **v11 ACTIVE**

### v2.9.34 notification fixes

1. **Membership joins and membership reactions are exact categories.**
   - note URLs containing `kind=circle_plan_join` are forced to `membership_join`.
   - `kind=board_like_comment` / `kind=board_like_post` are forced to `membership_reaction`.
   - board replies, board posts and membership plan-open URLs are also protected from the older generic DB classifier.
   - production DB migration `notification_membership_exact_v5` is applied.
   - existing misclassified rows were reclassified; the observed Monetize Crew join resolves as `membership_join` and the observed membership-board like resolves as `membership_reaction`.
   - source migration: `supabase/migrations/20260907185100_notification_membership_exact_v5.sql`.

2. **Saved boundary is visible without enlarging the notification row.**
   - saved/checkpoint keys remain compatible with prior versions.
   - the exact saved boundary row receives a non-layout pill marker: `✓ ここまで保存済み｜次回はこの上だけ保存`.
   - a size guard prevents a mistaken large container from becoming the boundary marker.
   - the compact status line also reports when a saved boundary exists, even before the user scrolls to the exact row.
   - the marker is reapplied while the real notification list lazily renders and while the user scrolls.

3. **Notification filtering hides every matching magazine-noise row.**
   - registered creator + magazine-add noise is hidden for every matching row.
   - creator URL/ID remains the strongest match.
   - cached creator names are hydrated and truncated note display names ending in ellipsis are matched safely by normalized prefix.
   - there is no intentional “leave one notification visible” behavior.
   - the unnecessary explanatory sentence about this was removed from the participant-facing settings UI; behavior is enforced in code/tests instead.
   - filter groups, per-creator removal and group ON/OFF remain account-isolated.

4. **Install/update no longer opens a disposable new browser tab.**
   - `notification-update.html` opens the userscript installer in the same tab with `location.assign`.
   - the update page therefore remains in browser Back history instead of returning to the Android home screen because a new tab was closed.
   - after install/update, browser Back returns to the update page; `pageshow`/focus/visibility handling performs version verification and returns to 本人通知・設定.
   - browser diagnostics remain visible for supported/unsupported userscript environments.

5. **Notification controls are a compact bottom dock.**
   - the notification controls no longer occupy the top of the note notification list.
   - the dock is fixed near the bottom with safe-area awareness and a compact two-row layout.
   - the notification list remains readable from its natural top edge.
   - settings open above the dock so browser bottom UI / gesture areas are not intentionally covered.
   - manual save, filter, settings and INSIGHT【通知】 behavior remain unchanged.

### 2026-09-07 live follow/follower repair

The reported state was: a new follower already appeared in 【通知】, while INSIGHT本体の「フォロー・フォロワー」 totals, people list and 【増】【減】 history remained stale.

Root cause and repair:

- notification ingestion and relation synchronization are intentionally separate pipelines.
- the relation cron itself was still scheduled and returning from pg_cron, but the actual `insight-relations` Edge Function was failing before it could write a new relation-sync run.
- production responses showed per-member errors as only `[object Object]`, so the old error formatting was also hiding the real database error.
- the relation upsert constructed mixed JSON row shapes when only some people were newly changed: changed rows included `last_changed_at`, unchanged rows did not. This can break a PostgREST bulk upsert exactly when a real follow delta appears.
- `upsertPeople` now separates unchanged (`stable`) and changed (`touched`) rows and upserts each uniform shape separately.
- relation/event batches were reduced to 300 rows for safer requests.
- database/API errors are normalized through `errText`, so future failures expose message/code/details/hint instead of `[object Object]`.
- production `insight-relations` was deployed as v11 and a full cron sync was immediately run to verify the fix.

Verified production result after repair (`2026-09-07 19:25 JST`):

- `ss_yr` official followers: **2,082** (previous saved run 2,078, **+4**).
- `ss_yr` latest identifiable follower snapshot: **1,000** because note caps the identity list; all +4 were identified in the latest window (`unknownAdded=0`).
- `ss_yr` official followings: **891** (previous 889, **+2**) and the complete 891-person list was reconciled.
- follower additions were written with actor names/profile URLs for 4 people.
- following additions were written with actor names/profile URLs for 2 people.
- the other active verified participant was also synced successfully in the same production cron run, proving this was not an OWNER-only repair.

Current client behavior already triggers relation synchronization without requiring a new button:

- `MemberInsightLiveV2` starts both direction-specific relation syncs shortly after INSIGHT opens.
- relation refresh is throttled by `RELATION_MS=180_000`.
- opening the フォロー view explicitly calls `relationSync(true)`.
- after either direction succeeds, `revision` increments and `MemberInsightSocialV2` reloads totals, people and delta history.
- `MemberInsightSocialV2` also overlays the current note official count through `insight-social-events.liveCounts` when available.

Therefore the fix is server-side and does **not** require a new app or userscript install for the repaired relation pipeline itself.

### Independent release/version tracks

INSIGHT本体 and 本人通知 are two independently updated products and must never share one version counter.

- `public/insight-release.json.appVersion` is the latest **INSIGHT本体** version.
- `public/insight-release.json.notificationVersion` is the latest **本人通知** version.
- `src/insight-release.ts` embeds the currently running INSIGHT app version.
- the userscript metadata/runtime identifies the installed 本人通知 version independently.
- an INSIGHT-only change increments `appVersion` only; it must not force a 本人通知 reinstall/update.
- a 本人通知-only change increments `notificationVersion` only; it must not pretend the INSIGHT app itself changed.
- the INSIGHT main dashboard must always show two persistent version rows/cards, not only when an update exists:
  - `INSIGHT本体　現在 v... / 最新 v...`
  - `本人通知　この端末 v... / 最新 v...`
- only a mismatch receives `NEW` / `更新あり` treatment and the corresponding update route.
- an unverified notification installation must say `この端末 未確認`; never guess that it is installed merely because the server manifest has a latest version.

### Manual-only notification behavior

- Automatic notification crawling and automatic navigation remain OFF.
- User opens the real note bell and presses `手動保存（続きから）`.
- Only server-confirmed rows become saved rows.
- saved boundary/checkpoint is reused on the next manual run.
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
- relation sync must continue to split changed/unchanged bulk upserts; do not restore mixed row shapes in one PostgREST upsert.
- opening the フォロー screen must continue to trigger an immediate relation refresh through `relationSync(true)`.

## 5. Public notifications vs 本人通知

Public reaction watch supplies identifiable public events such as likes, comments/replies and observable follows.

本人通知 supplies logged-in note-bell events that public crawling cannot reliably provide, including bell-only/private events such as purchases, tips, membership events and other notification-only categories.

The participant notification view intentionally merges the appropriate saved sources for that participant while maintaining strict account isolation.

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
2. JavaScript syntax checks for bootstrap + current notification runtime/UI + v2.9.34 bottom dock
3. TypeScript/Vite production build
4. unified INSIGHT regression tests including `tests/notification-v2919.test.mjs`
5. Pages artifact upload
6. deploy

Regression coverage must protect:

- v2.9.34 bootstrap/runtime paths and bottom dock;
- manual-only notification behavior;
- server-confirmed saves and saved boundary marker;
- full-match filter behavior including truncated creator names;
- no unnecessary “one row remains” explanatory text in settings;
- same-tab installer return flow;
- exact membership `kind=` DB classification;
- notification deep link and 3-second INSIGHT feed refresh;
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
- Never parse note comments as old flat strings only.
- Never let the generic notification classifier override exact membership URL kinds.
- Never intentionally leave one filtered magazine notification visible.
- Never restore a saved-boundary marker that can enlarge a whole notification panel/container.
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
