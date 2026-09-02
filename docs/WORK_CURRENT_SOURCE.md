# WORK CURRENT SOURCE OF TRUTH

Updated: 2026-09-02 10:28 JST

## 2026-09-02 10:28 CODE-ONLY LOGIN / NON-BLOCKING INITIAL LOAD — LATEST CHECKPOINT

This is the newest checkpoint. Determine future source-of-truth by actual timestamp first, then current GitHub `main`.

- Participant login now requires **only the individual `INSIGHT-XXXXXXXX` code**. A note ID is no longer entered again at login.
- note ID / creator URL remains required only when creating a new participation application, because that step identifies which public note profile must be verified.
- `src/access-portal-v3.tsx` is the active participant access screen. `src/App.tsx` routes `#access/insight` to `AccessPortalV3`.
- Supabase Edge Function `insight-code-login` v1 is ACTIVE. It hashes the submitted individual code, resolves exactly one active application, and issues a long-lived member session. Duplicate-code conflicts fail closed.
- Saved accounts still switch with one tap and do not log out other saved accounts.
- The post-login freeze was traced to `MemberInsightApp`: the first dashboard load waited for the full initial `sync` operation before releasing the loading screen.
- `src/member-insight-app.tsx` now renders the dashboard immediately after the lightweight `dashboard` response and starts first-time sync in the background. React StrictMode duplicate effects are guarded with `initialSyncStarted`.
- Member API calls now have a 20-second client timeout. A timeout never leaves the user on an infinite spinner; it shows a retry button or leaves the already-rendered INSIGHT usable while sync can be retried manually.
- Service Worker cache generation is `mumei-note-insight-v21` so browsers do not keep the older two-field login UI.
- Preserve all 2026-09-02 notification-sync v2.1 behavior below.

## 2026-09-02 ACCESS / TOP / MULTI-ACCOUNT — CURRENT CHECKPOINT

- The production-facing app remains INSIGHT only. Games and creator directory stay detached.
- `src/insight-account-store.ts` keeps multiple INSIGHT accounts on the same device. Each saved account can retain its member session, applicant token, verification passcode and identity metadata independently.
- Account switching is **not logout**. Switching to a sub account or another saved account does not revoke the previous account session and does not erase an in-progress application / profile-verification flow.
- Transient network/API failures must not erase a saved login. A stored member session is removed only when the server explicitly reports an authentication failure such as `INSIGHT_SESSION_INVALID`, `INSIGHT_MEMBER_INACTIVE` or `INSIGHT_LOGIN_REQUIRED`.
- Public TOP has `ログイン`, `参加`, small `ログアウト`, and small `退会` controls. `ログアウト` and `退会` are deliberately less prominent and always require a yes/no confirmation dialog.
- Explicit logout revokes only the current account session. Other stored accounts remain available.
- Explicit leave/退会 revokes all sessions for that participant, marks the application `revoked`, removes it from the active public participant rail and disables its notification-watch profile.
- Supabase Edge Function `insight-self-account` v1 is ACTIVE. It provides custom-authenticated `touch`, `logout`, and `leave` operations using `X-Insight-Token`.
- Valid participant sessions use sliding long-term retention: every app launch calls `touch`, extending the session expiry to ten years from that use. Failure of the refresh call never blocks app startup.
- The duplicate upper `無名S note / INSIGHT` TOP branding was removed. The page starts with the compact account/control bar and the single main `無名S note INSIGHT` hero.
- Participant-facing TOP/access copy no longer frames participation as a purchase/sale flow.
- Social preview is replaced by a dedicated readable 1200×630 image served by Supabase Edge Function `insight-og-image` v1 ACTIVE. `index.html` uses it for Open Graph and Twitter preview metadata.

## 2026-09-02 NOTE NOTIFICATION SYNC 2.1 — CURRENT CHECKPOINT

- `public/note-insight-notification-sync.user.js` v2.1 no longer depends on finding or programmatically clicking a labelled bell button.
- The adapter watches for the visible `通知` / `お知らせ` tab pair and real notification rows. A manual tap on note's bell therefore starts sync even when the icon has no usable aria-label/title.
- The old permanent bottom error (`通知ベルを自動で見つけられません`) is removed. If automatic opening is unavailable, the adapter asks for one manual bell tap and keeps watching until the notification view appears.
- Notification row discovery supports the current mobile layout as well as legacy `.m-navbarNoticeItem`, list-item, dialog and menu layouts.
- The sync status UI is a right-edge `🔔 同期` pull-out tab. It automatically collapses, can be reopened, and can be closed without covering note's bottom content.
- Tool-panel UX rule: every persistent note-side tool must provide at least one non-obstructive control—saved drag position, minimization, or edge-tab storage. Existing selector panels retain drag/minimize, 巡回BOOST retains saved drag, DIRECT retains its edge toggle, and ポン出し remains launcher-only until opened.
- Magazine-notification muting remains exact and safe: visible actor URL + magazine-add text are both required; likes, comments, follows, purchases and tips remain untouched.

## 2026-09-01 NOTE NOTIFICATION FILTER — CURRENT CHECKPOINT

- `public/note-insight-notification-sync.user.js` v2.0 keeps the existing real-bell capture and INSIGHT ingest flow.
- `public/notification-import.html` manages a per-device list of note creator profile URLs.
- The list is transferred to the note-side userscript without sending note passwords or login cookies to INSIGHT.
- Filtering is deliberately limited to notifications whose visible text is a magazine/article-add event and whose visible actor profile URL exactly matches a registered note ID.
- Likes, comments, follows, purchases, tips and all other notification types remain visible.
- Filtered notification nodes are hidden only in the user's rendered bell panel; note server data is never deleted or modified.
- The bell panel shows the number organized by INSIGHT and provides a temporary reveal/hide control.
- Aggregated notices that expose no matching creator URL are not hidden; do not guess actors hidden behind “他N名”.

## 2026-09-01 OWNER / PARTICIPANT SEPARATION — CURRENT CHECKPOINT
The production-facing `note-insight` app remains **INSIGHT only**. OWNER administration is not part of the participant UI.

Current durable checkpoint:
- Public TOP never reads OWNER state to reveal an admin link.
- Public TOP never routes to OWNER INSIGHT merely because an OWNER token exists in the browser.
- Participant navigation remains TOP / INSIGHT only.
- OWNER entry, OWNER INSIGHT and application management are separate routes and separate session state.
- `#manage` may be typed directly, but the management UI must not render until `unified-owner-access` confirms the OWNER session server-side. An unauthenticated browser is redirected to the OWNER gate without showing application data.
- Approval still generates an individual `INSIGHT-XXXXXXXX` code for the applicant's note-profile verification flow.
- The verification code is for the applicant only. OWNER may approve/reissue but does not need to see or copy the code.
- Supabase `insight-access` v2 remains ACTIVE. OWNER list / approve / reissue responses do not include the applicant verification code. Applicant `application-status` returns it only through the applicant token while status is `approved`.
- Deployed `insight-access` v2 source is tracked at `supabase/functions/insight-access/index.ts`.
- OWNER-token compatibility is handled by `public.is_owner_token`, which accepts the current OWNER session table as well as the legacy credential path.
- Fixed public URL remains `https://mumei-s.github.io/note-insight/`.

## 2026-08-31 PRIMARY INSIGHT SCOPE
The deployed primary `note-insight` app is **INSIGHT only**.

Canonical product scope is `docs/PRIMARY_APP_SCOPE.md`.

- Games remain detached and preserved.
- クリエイター名鑑 is detached from the production-facing INSIGHT app. Do not expose catalog pages, rarity/legend systems, participant cards, catalog OWNER management, or directory navigation unless explicitly requested later.
- The primary public URL stays `https://mumei-s.github.io/note-insight/` across releases.
- Public navigation is TOP / INSIGHT only.
- OWNER management is separate at `#manage` and is never linked from the public participant UI.

## Participant flow
1. Participant opens the fixed root URL and chooses participation/login.
2. Participant submits their note ID/profile URL for a new application.
3. Application is stored in Supabase and appears in the OWNER `#manage` page after OWNER authentication.
4. OWNER approves.
5. Approval creates an individual `INSIGHT-XXXXXXXX` passcode for that applicant.
6. The applicant sees that code in their own application flow and temporarily places it in their public note creator bio/self-introduction and saves it.
7. INSIGHT verifies the public profile contains the exact code.
8. Verification activates the account, issues a long-lived hashed session token and adds the creator to the public participant list.
9. Participant restores the original bio.
10. Later login on another browser/device requires only the individual `INSIGHT-XXXXXXXX` code. The code uniquely resolves the verified note account.

## Backend boundaries
- `insight-access`: applications, approval, passcode, public-profile verification, legacy session creation/login/revocation, public participants.
- `insight-code-login`: code-only participant login and new session issuance.
- `insight-self-account`: participant self-service long-session refresh, explicit logout and explicit leave.
- `insight-member-api`: participant-safe analytics/public-reaction store. Every read/write is scoped to the authenticated application/member UUID and verified note ID.
- OWNER analytics may continue using OWNER-only legacy/full endpoints, but participants must never receive OWNER `ss_yr` data.
- Participant access must not depend on `note-like-tracker.sabosan0404.chatgpt.site`.

## Participant INSIGHT core
Core cross-platform functionality must work from the fixed GitHub Pages URL on ordinary modern mobile/desktop browsers without a userscript:
- verified creator identity;
- official public creator counts;
- stored article list;
- identifiable public likes/supporters;
- public comments/replies;
- publicly observable follower information;
- supporter/commenter rankings;
- public-reaction notifications/deltas;
- manual sync and app-update controls.

Private note-account notifications that are not exposed publicly are an optional extension and must not block the core product.

## Detached archives — preserve, do not re-enable
### Games
The completed six-game implementation, game CSS/tests, ledger support, migrations and `docs/GAME_SPEC.md` remain preserved. Do not delete or reconnect without explicit instruction.

### Creator directory
Existing directory/catalog source and Supabase data remain preserved but are not part of the current deployed product. Rarity/legend labels are not required for any future directory return unless explicitly requested.

## Persistence discipline
Always determine the newest work by timestamp, then begin from current GitHub `main`. Commit in small recoverable stages. If usage limits appear, stop only after pushing the current compilable state and updating this file. Do not roll back unrelated newer userscripts or tooling.
