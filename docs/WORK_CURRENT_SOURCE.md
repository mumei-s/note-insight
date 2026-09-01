# WORK CURRENT SOURCE OF TRUTH

Updated: 2026-09-01 JST

## 2026-09-01 NOTE NOTIFICATION FILTER — CURRENT CHECKPOINT

- `public/note-insight-notification-sync.user.js` v2.0 keeps the existing real-bell capture and INSIGHT ingest flow.
- `public/notification-import.html` now manages a per-device list of note creator profile URLs.
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
- Supabase `insight-access` v2 is deployed ACTIVE. OWNER list / approve / reissue responses do not include the applicant verification code. Applicant `application-status` still returns it only through the applicant token while status is `approved`.
- Deployed `insight-access` v2 source is tracked at `supabase/functions/insight-access/index.ts`.
- OWNER-token compatibility is handled by `public.is_owner_token`, which accepts the current OWNER session table as well as the legacy credential path.
- Fixed public URL remains `https://mumei-s.github.io/note-insight/`.
- Social sharing metadata and the dedicated 1200x630 INSIGHT OG preview are enabled for the fixed URL.

## 2026-08-31 COMMERCIAL INSIGHT — HIGHEST PRIORITY
The deployed primary `note-insight` app is now **INSIGHT only**.

Canonical product scope is `docs/PRIMARY_APP_SCOPE.md`.

- Games remain detached and preserved.
- クリエイター名鑑 is also detached from the production-facing INSIGHT app. Do not expose catalog pages, rarity/legend systems, participant cards, catalog OWNER management, or directory navigation unless explicitly requested later.
- The primary public URL stays `https://mumei-s.github.io/note-insight/` across releases.
- There is no Exit/終了 button, exit confirmation, close-window behavior, or browser-back interception.
- Public navigation is TOP / INSIGHT only.
- OWNER management is separate at `#manage` and is never linked from the public participant UI.

## Paid participant flow
1. Buyer opens the fixed root URL and chooses participation/login.
2. Buyer submits their note ID/profile URL.
3. Application is stored in Supabase and appears in the OWNER `#manage` page after OWNER authentication.
4. OWNER approves.
5. Approval creates an individual `INSIGHT-XXXXXXXX` passcode for that applicant.
6. The applicant sees that code in their own application flow and temporarily places it in their public note creator bio/self-introduction and saves it.
7. INSIGHT verifies the public profile contains the exact code.
8. Verification activates the account, issues a long-lived hashed session token and adds the creator to the public participant list.
9. Buyer restores the original bio.
10. Another browser/device may log in using the verified note ID + individual passcode. No shared participant password is used.

## Backend boundaries
- `insight-access`: paid applications, approval, passcode, public-profile verification, session creation/login/revocation, public participants.
- `insight-member-api`: participant-safe analytics/public-reaction store. Every read/write is scoped to the authenticated application/member UUID and verified note ID.
- OWNER analytics may continue using OWNER-only legacy/full endpoints, but paid participants must never receive OWNER `ss_yr` data.
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

Private note-account notifications that are not exposed publicly (for example some purchase, tip, magazine, or other account-private events) are an optional extension and must not block the core paid product.

## Detached archives — preserve, do not re-enable
### Games
The completed six-game implementation, game CSS/tests, ledger support, migrations and `docs/GAME_SPEC.md` remain preserved. Do not delete or reconnect without explicit instruction.

### Creator directory
Existing directory/catalog source and Supabase data remain preserved but are not part of the current deployed product. Rarity/legend labels are not required for any future directory return unless explicitly requested.

## Persistence discipline
Always begin from current GitHub `main`. Commit in small recoverable stages. If usage limits appear, stop only after pushing the current compilable state and updating this file. Do not roll back unrelated newer userscripts or tooling.
