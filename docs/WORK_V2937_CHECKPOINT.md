# WORK v2.9.37 CHECKPOINT

Updated: 2026-09-07 22:43 JST

This checkpoint is newer than v2.9.36. Always fetch current GitHub `main` before continuing.

## Release tracks

- INSIGHT app: `2026.09.07.8` — unchanged.
- 本人通知・統計: `2.9.37`.

## v2.9.37 emergency stability fix

Reported on Android Edge after v2.9.36: filter ON caused the notification screen to blink/flicker.

Root cause:

- v2.9.36 correction removed the mute class from every filtered notification and then re-applied it on every reconciliation.
- its MutationObserver also watched class changes, so the script repeatedly observed its own class mutations and re-ran the same show/hide cycle.
- v2.9.36 foreground-scroll fill also programmatically moved the front scroller to the bottom and restored it, which could add visual jumping.

Fix:

- `public/note-insight-notification-runtime-v2936-filter.js` is now idempotent: it computes the desired hidden state and calls `setMuted(el,want)` only when a class actually needs to change.
- there is no blanket unmute-then-remute pass.
- lead-representative-only filtering remains: 2nd/later registered creators do not hide an aggregation; a registered leading creator still hides it using text/profile/link-ID matching.
- class observation may trigger reconciliation, but idempotent class writes prevent self-sustaining mutation loops.
- `public/note-insight-notification-runtime-v2936-scroll.js` no longer performs automatic scroll-to-bottom / restore loops.
- foreground touch/wheel capture and overscroll containment remain; an older-row request is attempted only when the user actively swipes/wheels downward and the foreground list has no usable scroll range.

## Cache/version

- bootstrap: `public/note-insight-notification-sync.user.js` v2.9.37.
- filter runtime cache key: `v=2936b`.
- scroll runtime cache key: `v=2936b`.
- appVersion remains `2026.09.07.8`.

## Do not regress

- never blanket-remove the filter mute class before recalculating every row;
- never create a class-mutation loop that repeatedly shows/hides the same notification;
- never auto-jump the visible notification list merely to fill filtered space;
- never allow filtered foreground gestures to scroll the background note page;
- keep filtering lead-representative only;
- keep INSIGHT app and本人通知 versions independent.
