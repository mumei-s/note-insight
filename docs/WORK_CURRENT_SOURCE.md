# WORK CURRENT SOURCE OF TRUTH

Updated: 2026-09-07 19:03 JST

**Always determine the newest work by actual timestamp first, then fetch current GitHub `main`.** Do not choose an older chat/spec because of its title. Do not roll back unrelated newer userscript/tooling work.

## 0. 2026-09-07 本人通知 v2.9.33 completion checkpoint

This is the newest INSIGHT checkpoint and supersedes older notification-sync notes.

Current release:

- INSIGHT app: `2026.09.07.6`
- 本人通知・統計: **v2.9.33**
- fixed public distribution URL: `https://mumei-s.github.io/note-insight/`
- current userscript bootstrap: `public/note-insight-notification-sync.user.js`
- current manual reader: `public/note-insight-notification-runtime-v2933.js`
- current notification UI/filter: `public/note-insight-notification-runtime-v2933-ui.js`

### v2.9.33 completed fixes

1. **Membership joins and membership reactions are exact categories.**
   - note URLs containing `kind=circle_plan_join` are forced to `membership_join`.
   - `kind=board_like_comment` / `kind=board_like_post` are forced to `membership_reaction`.
   - board replies, board posts and membership plan-open URLs are also protected from the older generic DB classifier.
   - production DB migration `notification_membership_exact_v5` is applied.
   - existing misclassified rows were reclassified; the observed Monetize Crew join now resolves as `membership_join` and the observed membership-board like now resolves as `membership_reaction`.
   - source migration: `supabase/migrations/20260907185100_notification_membership_exact_v5.sql`.

2. **Saved boundary is visible without enlarging the notification row.**
   - saved/checkpoint keys remain compatible with prior versions.
   - the exact saved boundary row receives a non-layout pill marker: `✓ ここまで保存済み｜次回はこの上だけ保存`.
   - a size guard prevents a mistaken large container from becoming the boundary marker.
   - the compact status line also reports when a saved boundary exists, even before the user scrolls to the exact row.
   - the marker is reapplied while the real notification list lazily renders and while the user scrolls.

3. **Notification filtering does not intentionally leave one row.**
   - registered creator + magazine-add noise is hidden for every matching row.
   - creator URL/ID remains the strongest match.
   - cached creator names are hydrated and truncated note display names ending in ellipsis are matched safely by normalized prefix.
   - filter settings explicitly state that there is no “leave one notification visible” rule.
   - filter groups, per-creator removal and group ON/OFF remain account-isolated.

4. **Install/update no longer opens a disposable new browser tab.**
   - `notification-update.html` opens the userscript installer in the **same tab** with `location.assign`.
   - the update page therefore remains in browser Back history instead of returning to the Android home screen because a new tab was closed.
   - after install/update, browser Back returns to the update page; `pageshow`/focus/visibility handling performs version verification and returns to 本人通知・設定.
   - browser diagnostics remain visible for supported/unsupported userscript environments.

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

## 4. Public notifications vs 本人通知

Public reaction watch supplies identifiable public events such as likes, comments/replies and observable follows.

本人通知 supplies logged-in note-bell events that public crawling cannot reliably provide, including bell-only/private events such as purchases, tips, membership events and other notification-only categories.

The participant notification view intentionally merges the appropriate saved sources for that participant while maintaining strict account isolation.

## 5. 本人通知 account isolation and pairing

- actual note login identity is read from `/api/v2/current_user`.
- ingest token, saved signatures/checkpoint and filter settings are isolated by actual note ID.
- server ingest rejects note-ID/token mismatch with `NOTIFICATION_ACCOUNT_MISMATCH`.
- active verified INSIGHT participants may pair their selected account; no legacy password/code login is reintroduced.
- switching between saved verified accounts does not log out the other saved account.

## 6. Notification categories

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

## 7. Access V6 / account switching

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

## 8. Back / browser history semantics

Browser Back must **never mean logout**.

- participant token is not revoked by Back/Forward.
- explicit logout/leave actions are the only destructive session actions.
- internal PWA `?launch=top` behavior must not erase normal dashboard deep links.
- notification installer/update flow must retain an in-browser return path; do not restore `window.open(..., '_blank')` for the userscript installer.

## 9. PWA and fixed URL

- fixed public URL remains `https://mumei-s.github.io/note-insight/`.
- PWA/browser recovery logic is a safety layer, not a prerequisite for analytics.
- do not change the distribution URL.

## 10. CI / regression protection

Pages workflow must pass before public deployment:

1. `npm ci`
2. JavaScript syntax checks for bootstrap + current v2.9.33 runtime/UI
3. TypeScript/Vite production build
4. unified INSIGHT regression tests including `tests/notification-v2919.test.mjs`
5. Pages artifact upload
6. deploy

Notification regression coverage must protect:

- v2.9.33 bootstrap/runtime paths;
- manual-only behavior;
- server-confirmed saves and saved boundary marker;
- full-match filter behavior including truncated creator names;
- same-tab installer return flow;
- exact membership `kind=` DB classification;
- notification deep link and 3-second INSIGHT feed refresh;
- current release manifest.

## 11. Do not regress

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

## 12. Detached archives

### Games
Preserve completed six-game source, CSS, ledger support, migrations and `docs/GAME_SPEC.md`. Do not reconnect unless explicitly requested.

### Creator directory
Preserve directory/catalog source and Supabase data. It is not part of the current production-facing INSIGHT app unless explicitly requested.

## 13. Persistence discipline

Always fetch newest GitHub `main` by actual commit timestamp before editing. Commit in small recoverable stages. If usage limits appear, stop only after pushing a compilable state and updating this file. Never overwrite unrelated newer work with an older local tree.
