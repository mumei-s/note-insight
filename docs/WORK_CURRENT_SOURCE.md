# WORK CURRENT SOURCE OF TRUTH

Updated: 2026-09-02 21:06 JST

**Always determine the newest work by actual timestamp first, then fetch current GitHub `main`.** Do not choose an older chat/spec because of its title. Do not roll back unrelated newer userscript/tooling work.

## 1. Production scope

Fixed public distribution URL:

`https://mumei-s.github.io/note-insight/`

The production-facing app is **INSIGHT only**.

- Games remain detached and preserved.
- Creator directory/catalog remains detached and preserved.
- Public participant navigation is TOP / INSIGHT.
- OWNER routes remain separate and authenticated.
- Core INSIGHT must work in ordinary modern browsers (Chrome/Chromium, Edge, Yahoo-compatible browsing environments where normal web APIs work, Safari-class browsers) without depending on Edge-specific behavior.
- PWA/Edge logic is only a recovery/safety layer for browser window restoration; it is never a prerequisite for core analytics.

## 2. Full participant INSIGHT — do not simplify again

Participant dashboard uses:

- `src/member-insight-live.tsx`
- `src/member-insight-full.tsx`
- `supabase/functions/insight-member-history`
- `supabase/functions/insight-member-api`

Do **not** restore the simplified `MemberInsightApp` as the participant dashboard.

Visible participant tabs:

- 概要
- スキ履歴
- コメント
- 応援者
- フォロー
- 通知
- 記事

Visible header controls:

- アカウント切替
- 本人通知
- データ更新

Saved full history is displayed immediately from Supabase / existing fast RPCs. A fresh note crawl must not block initial display.

Verified preserved `ss_yr` historical scope remains mapped to analytics `member_id='owner'`:

- articles: 256
- identified likes: 34,318
- comments/replies: 4,048
- external root comment threads: 1,570
- active tracked followers: 1,023
- active tracked followings: 888
- historical notifications: 2,483

`ss_yr` participant authentication maps server-side to this legacy full-history scope. Other participants remain strictly scoped to their own application UUID. Other participants must never receive `owner` data.

The UI may render 100 rows per screen page for mobile safety; this is **not** a 100-row recrawl. Full saved history and totals already exist server-side.

## 3. Live public reaction synchronization

Current Supabase function:

- `insight-member-api` **v4 ACTIVE**

Behavior:

- Existing saved history is shown first.
- A background sync runs after participant INSIGHT opens.
- `MemberInsightLive` also re-checks after returning/focusing the app, throttled to avoid repeated requests.
- Successful background sync updates the currently visible full-history tab without resetting the user back to 概要.
- Recent article page 1 comment threads are refreshed even when note's top-level `comment_count` did not change.
- Pending comment threads (`unreplied` / `followup_pending`) are also rechecked, including older articles.
- Pending-thread refresh uses a recent set plus a rotating window so older pending conversations continue to be revisited over successive syncs.
- Older article pages cycle instead of letting the cursor grow forever past the creator's article pages.
- `note.ts` comment collection follows up to 20 pages × 100 comments so large threads are not limited to the first 100 items.
- New external comments/replies create actor-specific public reaction notifications.
- Creator's own replies update thread state but do not create a false inbound notification.

For `ss_yr`, live article/like/comment updates continue writing to `owner` history scope so the old history and new history remain one continuous dataset.

## 4. Comment status semantics

Comment thread status comes from saved comment/reply rows, not only note's article-level comment count.

- `unreplied`: creator reply has not been captured.
- `followup_pending`: creator replied previously, but the latest reply is external.
- `replied`: latest reply is the creator.

If the creator replies on note, the next live public sync must capture that creator reply and change the thread status accordingly.

Public comments are public data. **本人通知 pairing is not required to identify who commented/replied.** The public sync stores actor name/profile URL and the INSIGHT notification/history views may show them directly.

## 5. Public notifications vs 本人通知

Two different sources are intentionally combined in the participant notification history:

### Public reaction watch — core, no userscript required

Provides identifiable public events such as:

- likes
- public comments/replies
- public follows where observable

These events are created by `insight-member-api` with source `member-public-watch` and actor fields.

For `ss_yr`, history reads merge both legacy `owner` notifications and the authenticated participant UUID notifications so old history and newly derived public events appear together.

### 本人通知 — optional private bell extension

Used for information exposed in the logged-in note bell, including events that public crawling cannot reliably provide, such as purchase/tip/private bell-only events.

Core INSIGHT must remain usable when the browser cannot run the notification userscript.

## 6. 本人通知 current implementation

Current components/functions:

- `public/note-insight-notification-sync.user.js` v2.2.0
- `public/notification-setup.html`
- `public/notification-import.html`
- `insight-notification-import-token` **v6 ACTIVE**
- `insight-notification-ingest-v2` **v2 ACTIVE**

Account isolation:

- Userscript reads the actual logged-in note identity from `/api/v2/current_user`.
- Notification token is stored per actual note ID.
- Last notification signature is stored per note ID.
- Magazine mute settings are stored per note ID.
- Server ingest rejects a token/note-ID mismatch with `NOTIFICATION_ACCOUNT_MISMATCH`.
- Notifications from two saved INSIGHT accounts must never mix.

Pairing:

- An `active` INSIGHT participant is already authorized for notification pairing. Do not require a second/legacy notification-profile verification row.
- `insight-notification-import-token` v6 exposes `paired` / `pairedExpiresAt` in stats.
- Notification setup clearly shows `連携済み` or `未連携`.
- If unpaired, the user performs the one-time `このアカウントを連携する` flow.
- Pair exchange issues the ingest token only after the actual note login ID matches the selected INSIGHT note ID.
- Once paired, normal use is simply opening note's notification bell; the userscript observes the real notification view and ingests it.

Magazine muting remains exact/safe:

- hide only matching creator + magazine-add notifications;
- do not hide likes/comments/follows/purchases/tips.

## 7. Access V6 / account switching

Current access UI:

- `src/access-portal-v6.tsx`

The `INSIGHT-XXXXXXXX` code is **profile ownership verification only**. It is not a login password.

Normal participation:

1. Enter note ID/profile URL once.
2. OWNER approves.
3. INSIGHT displays a temporary verification code.
4. Participant temporarily places the code in public note self-introduction/profile.
5. INSIGHT verifies the profile.
6. Long-lived participant session is issued and saved.
7. Participant removes the code from note.

There is no normal code-input login form.

Normal same-device account switching:

- fully verified saved accounts only;
- tap `切替`;
- switching does not log out the other saved account;
- pending/unverified sub-account applications are not shown as normal switchable accounts.

New-device/lost-session recovery:

- note ID → new temporary profile verification code → public profile verification → new long-lived session;
- no remembered old verification code/password is required.

## 8. Back / browser history semantics

Browser Back must **never mean logout**.

`src/main.tsx` only forces TOP when the explicit internal PWA launch marker `?launch=top` is present.

- `#dashboard` and other INSIGHT deep links are not erased during browser Back/Forward.
- browser Back/Forward does not revoke or remove the participant token;
- explicit logout/leave buttons are the only destructive session actions.

`src/App.tsx` listens to `popstate` / `hashchange` and preserves the current participant route normally.

## 9. TOP / PWA / browser compatibility

Manifest:

- id: `/note-insight/`
- scope: `/note-insight/`
- internal PWA start URL: `/note-insight/?launch=top`

Service Worker cache generation:

- `mumei-note-insight-v28`

The fixed public URL remains unchanged and is what gets distributed.

Notification helper pages require explicit markers and are opened outside the main INSIGHT client where possible. A stale helper-page launch is redirected back through TOP.

These PWA rules are safety measures. They must not alter ordinary browser Back/Forward semantics or make Edge a requirement.

## 10. Current Supabase function versions

- `insight-access` v3 ACTIVE
- `insight-recovery` v1 ACTIVE
- `insight-self-account` v4 ACTIVE
- `insight-member-history` v1 ACTIVE
- `insight-member-api` **v4 ACTIVE**
- `insight-notification-import-token` **v6 ACTIVE**
- `insight-notification-ingest-v2` v2 ACTIVE

`insight-access` public participant upsert is note-ID safe, so an existing historical OWNER public row cannot break first participant verification.

## 11. CI / regression protection

Pages workflow now requires all of the following before deploy:

1. `npm ci`
2. notification userscript JavaScript syntax check
3. TypeScript + Vite production build
4. `tests/insight-current.test.mjs`
5. Pages artifact upload
6. deploy

`tests/insight-current.test.mjs` locks the current requirements, including:

- MemberInsightLive/full-history dashboard remains active;
- comment pending-thread refresh remains;
- actor-specific public comment/like notification support remains;
- personal notification account isolation/paired state remains;
- code-input password login does not return;
- Back does not clear the INSIGHT token;
- fixed PWA TOP behavior and current SW generation remain.

If any of those regress, Pages deployment must fail before publishing.

## 12. Latest verified release

Functional release HEAD before this documentation commit:

`440c459378c6a5a0065597ff54e89cb44ab66a49`

GitHub Pages workflow run `33627982524` completed:

- userscript syntax check: SUCCESS
- TypeScript/Vite build: SUCCESS
- current INSIGHT regression tests: SUCCESS
- artifact upload: SUCCESS
- deploy: SUCCESS

## 13. Do not regress

- Never replace full participant INSIGHT with the simplified dashboard.
- Never move `ss_yr` to an empty/new analytics scope without a verified migration of all history.
- Never remove comments/replies, follower/following history, supporter ranking, notification history or article archive.
- Never make a fresh note crawl block initial history display.
- Never make 本人通知/userscript a requirement for public comments/likes.
- Never mix notification tokens across note IDs.
- Never treat profile verification code as a password.
- Never make browser Back log the participant out.
- Never remove account switching.
- Never change the fixed distribution URL.
- Never make Edge a requirement; browser-specific handling is only a compatibility layer.

## 14. Detached archives

### Games
Preserve completed six-game source, CSS, ledger support, migrations and `docs/GAME_SPEC.md`. Do not reconnect unless explicitly requested.

### Creator directory
Preserve directory/catalog source and Supabase data. It is not part of the current production-facing INSIGHT app unless explicitly requested.

## 15. Persistence discipline

Always fetch the newest GitHub `main` by actual commit timestamp before editing. Commit in small recoverable stages. If usage limits appear, stop only after pushing a compilable state and updating this file. Never overwrite unrelated newer work with an older local tree.
