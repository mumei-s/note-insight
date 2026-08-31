# WORK CURRENT SOURCE OF TRUTH

Updated: 2026-08-31 JST

## 2026-08-31 COMMERCIAL INSIGHT — HIGHEST PRIORITY
The deployed primary `note-insight` app is now **INSIGHT only**.

Canonical product scope is `docs/PRIMARY_APP_SCOPE.md`.

- Games remain detached and preserved.
- クリエイター名鑑 is also detached from the production-facing INSIGHT app. Do not expose catalog pages, rarity/legend systems, participant cards, catalog OWNER management, or directory navigation unless explicitly requested later.
- The primary public URL stays `https://mumei-s.github.io/note-insight/` across releases.
- There is no Exit/終了 button, exit confirmation, close-window behavior, or browser-back interception.
- Public navigation is TOP / INSIGHT only.
- OWNER management is separate at `#manage`.

## Paid participant flow
1. Buyer opens the fixed root URL and chooses participation/login.
2. Buyer submits their note ID/profile URL.
3. Application is stored in Supabase and appears in the OWNER `#manage` page.
4. OWNER approves.
5. Approval creates an individual `INSIGHT-XXXXXXXX` passcode.
6. Buyer temporarily places the code in their public note creator bio/self-introduction and saves it.
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
