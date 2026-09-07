# WORK v2.9.36 CHECKPOINT

Updated: 2026-09-07 22:34 JST

This checkpoint is newer than the v2.9.35 section in `WORK_CURRENT_SOURCE.md`. Always fetch the latest GitHub `main` before continuing.

## Release tracks

- INSIGHT app: `2026.09.07.8` — unchanged by this fix.
- 本人通知・統計: `2.9.36`.
- Release manifest: `public/insight-release.json`.

## v2.9.36 fixes

1. **Notification filter is lead-representative only.**
   - A magazine-noise row is hidden only when the creator named at the very beginning of the note notification is a registered active filter target.
   - A registered creator appearing only as the 2nd/later creator in an aggregated notification must not hide that notification.
   - Matching uses the leading text name first, then matching creator-link text/profile ID, then hydrated stored profile names.
   - Exact short names are supported; truncated names ending in ellipsis may prefix-match safely.
   - `public/note-insight-notification-runtime-v2936-filter.js` re-evaluates and removes the older over-broad mute class before applying the lead-only decision.
   - The logical outer notification row is hidden, not only an inner text block, so empty avatar-only shells should not remain.

2. **Filtered notification scrolling stays on the foreground notification list.**
   - `public/note-insight-notification-runtime-v2936-scroll.js` identifies the real foreground notification scroller.
   - touch/wheel motion is routed to that scroller while filter is ON and propagation to the background note page is blocked.
   - `overscroll-behavior-y: contain` is applied to the foreground scroller.
   - If filtering leaves too few visible rows to scroll, the script scrolls the real notification list internally to trigger older/lazy rows, then restores the previous position.

3. **Existing v2.9.35 safeguards remain.**
   - bottom dock is independent from note reaction/modals and lives under `document.body`.
   - unrelated dialogs such as `スキをつけたユーザー` cannot own/delete the dock.
   - visible saved-boundary marker remains suppressed while the internal checkpoint remains active.
   - manual-only notification capture remains unchanged.

## Bootstrap/runtime files

- `public/note-insight-notification-sync.user.js` — v2.9.36.
- `public/note-insight-notification-runtime-v2933.js` — manual reader.
- `public/note-insight-notification-runtime-v2933-ui.js` — legacy controls/filter settings.
- `public/note-insight-notification-runtime-v2934-dock.js` — bottom dock.
- `public/note-insight-notification-runtime-v2935-guard.js` — independent modal guard.
- `public/note-insight-notification-runtime-v2936-filter.js` — lead-only filter correction.
- `public/note-insight-notification-runtime-v2936-scroll.js` — foreground scroll routing/fill.

## Regression requirements

Do not regress these rules:

- never hide a magazine aggregation merely because a filtered creator appears among 2nd/later avatars/participants;
- never leave the leading filtered creator visible because the displayed name is shortened/truncated;
- never hide only an inner text node and leave an empty avatar-only notification shell;
- when filter is ON, scrolling the visible notification panel must not scroll the background note page;
- INSIGHT app and 本人通知 versions remain independent.
