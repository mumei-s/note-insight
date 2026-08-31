# INSIGHT COMMERCIAL FLOW

Updated: 2026-08-31 JST

Production URL: `https://mumei-s.github.io/note-insight/`

This URL is the product URL. Do not version the path or issue a new buyer URL for ordinary releases. Query parameters may be used internally only for cache busting.

## Buyer journey
1. Open the production URL.
2. Choose `参加申請・ログイン`.
3. Enter the buyer's own note ID or creator-page URL.
4. Application status becomes `pending`.
5. OWNER opens `#manage`, verifies the purchase and approves the application.
6. Status becomes `approved` and an individual `INSIGHT-XXXXXXXX` passcode is generated.
7. Buyer refreshes application status and sees the passcode.
8. Buyer temporarily inserts the exact passcode into the public self-introduction/bio shown under their name on their note creator page and saves it.
9. Buyer presses `保存したのでINSIGHTで認証`.
10. `insight-access` fetches the public note creator profile and checks the exact passcode is present.
11. On success:
   - application becomes `active`;
   - a long-lived member session is issued;
   - the creator is added to the public participant list;
   - the public-reaction watch profile is enabled;
   - plaintext verification code is removed from the application row;
   - the code hash remains for later note-ID + passcode login.
12. Buyer restores the original note bio.
13. Buyer enters their tenant-safe member INSIGHT.

## Another device/browser
Use `note ID + individual passcode` on the same fixed production URL. A new hashed long-lived session is issued for that browser. OWNER may reissue a code; reissue revokes prior member sessions and requires profile verification again.

## OWNER
- OWNER authentication is separate from participant authentication.
- OWNER entry: `#owner`
- Paid-access management: `#manage`
- OWNER actions: list / approve / reissue / reject / revoke.
- Do not place OWNER management links on ordinary participant UI.

## Tenant isolation
- Participant authentication/session data: `insight_access_applications`, `insight_member_sessions`.
- Participant public analytics/reaction data uses member/application UUID as `member_id`.
- `insight-member-api` derives both member UUID and note ID from the authenticated session; the client cannot choose another creator ID.
- Paid participants must never receive the OWNER-hardcoded `ss_yr` analytics response.

## Notifications
Core browser/OS-independent watch is based on public note data:
- identifiable likes;
- public comments/replies;
- publicly exposed follower-list changes.

Account-private note notifications cannot be promised without an authenticated note session. Browser-assisted private notification import/sync remains an optional extension.

## Detached products
- Creator directory/catalog is not part of the current commercial INSIGHT app.
- Games are not part of the current commercial INSIGHT app.
- Preserve both archives, but do not expose or reconnect them without an explicit request.

## Release gates
Before treating a release as sellable:
- latest `main` builds successfully;
- GitHub Pages deploy succeeds;
- root URL opens TOP and never enters an Exit flow;
- detached catalog/game routes redirect safely to TOP;
- participant application appears in `#manage`;
- approval returns an individual passcode;
- profile verification activates only the same note ID;
- participant dashboard never exposes OWNER data;
- public participant list updates after activation;
- app-update control keeps the same root URL.
