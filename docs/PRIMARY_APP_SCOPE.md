# PRIMARY APP SCOPE

Updated: 2026-08-31 JST

## Primary deployed product
The primary `https://mumei-s.github.io/note-insight/` GitHub Pages app is now **INSIGHT only**.

- CREATOR WORLD / games are detached and preserved in source/backend for later separate use.
- クリエイター名鑑 is detached from the primary product. Do not expose catalog routes, cards, OWNER controls, rarity/legend labels, or directory UI from the INSIGHT product.
- Do not reconnect games or the directory unless the user explicitly requests it.
- Do not delete preserved detached source merely to keep it hidden from the primary runtime.

## Commercial access flow — canonical
1. The seller distributes the fixed GitHub Pages root URL. The URL must not change for releases.
2. A buyer opens `#access/insight` and applies with their own note creator ID/profile URL.
3. The application appears in the separate OWNER page at `#manage`.
4. OWNER approves the purchase/application.
5. Approval generates an individual `INSIGHT-XXXXXXXX` passcode.
6. The buyer temporarily places that code in the public self-introduction/bio shown under their name on their note creator page and saves it.
7. The buyer presses verification in INSIGHT. Server-side verification reads the public creator profile and confirms the code.
8. After successful verification the buyer restores the original bio. The passcode remains valid for future device/browser login as a hash; the plaintext is no longer exposed by the backend.
9. The verified creator is activated and appears in the public TOP participant icon list.
10. Long-lived sessions are per browser, while note ID + passcode can create a new session on another supported OS/browser.

## Identity and tenant isolation
- No shared participant password.
- No participant authentication dependency on `sabosan0404.chatgpt.site`.
- Paid participant applications and sessions live in Supabase tables behind Edge Functions.
- Participant sessions are hashed and expire/revoke server-side.
- Participant INSIGHT data is always scoped by the authenticated application/member UUID and verified note ID.
- Never route a paid participant through the OWNER-hardcoded `ss_yr` analytics API.
- OWNER authentication remains separate and uses the existing OWNER profile-challenge system.

## Notification scope
Cross-platform core notification/watch support uses server-side public note data and may track:
- likes whose public liker identity is available;
- public comments/replies;
- public follower-list changes that note exposes.

Notifications only visible inside a logged-in note account, such as some purchase/tip/magazine/account-private events, cannot be guaranteed from public server-side APIs. Treat any browser-assisted private-notification sync as an optional extension, never as a requirement for the core paid product.

## Navigation and update rules
- There is no app Exit/終了 route, dialog, back-button trap, `window.close`, or redirect to `exit.html` in the primary runtime.
- Browser back behavior remains normal browser navigation.
- Public bottom navigation contains TOP / INSIGHT only.
- OWNER management is separate at `#manage` and is not shown to ordinary participants.
- Participant dashboard includes an app-update action that refreshes service-worker/cache state while retaining the same fixed GitHub Pages root URL.

## Preservation rule
Always start from the latest GitHub `main`. Do not overwrite newer unrelated userscripts, detached games, notification tooling, or archived directory source while changing the primary INSIGHT product.
