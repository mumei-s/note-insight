# INSIGHT 2026.10.03.24 — participant playback and list

Started from current main `55ece08d66d5d701ab89b279ddbcf39c20c94b9b`, after PR #43 was published.

The real-device report supersedes the earlier always-expanded participant-list requirement: place every participant in a compact, expandable list with a reveal effect and consistent card sizes.

## Changes

- Reproduced the playback failure: a compatibility mouse-over event after touching the stage left `hover` true; pressing Play changed the button to Stop but created no interval. Mouse hover now responds only to mouse pointer events. Explicit Play clears stale hover, advances to the next person immediately, and starts subsequent timed changes.
- Presentation-motion preferences are separate from explicit playback. Reduced motion prevents unsolicited cycling and decorative animation; an explicit Play action still cycles. Page visibility and intersection visibility stop cycling while hidden.
- Every participant remains available through the visible `参加者一覧` count button. Opening it reveals a light sweep and staggered icons. Its list has internal scrolling, local name/note-ID filtering, and no participant cap.
- Participant cards have a fixed 68px height and consistent 32px avatars. Names use at most two visual lines while their full text remains in the link and title. Two columns on mobile and three on desktop keep the panel compact.
- Shared visibility hook adds the existing `visible` and `foreground` flags to its result without changing other consumers' motion behavior.

## Validation

- TypeScript/Vite production build passed.
- All 97 targeted tests passed: playback after touch-style hover, immediate response and subsequent cycles, reduced-motion explicit playback, background/offscreen suspension, all 240 participants retained, name/ID filtering and clearing, and existing search, avatars, DM, notification, auth and analysis behavior.
- Local cloud-browser navigation to the preview server was blocked by the browser client; public-page visual validation follows deployment. This is not a site bot block.
- App version `2026.10.03.24`; app cache `v90-participant-play-20261003`. Notification `3.6.24`, dashboard `1.6.4`, DM `1.4.10` retained.
