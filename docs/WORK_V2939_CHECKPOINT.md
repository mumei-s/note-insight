# WORK v2.9.39 CHECKPOINT

Updated: 2026-09-08 09:24 JST

Always fetch current GitHub `main` before continuing.

## Release tracks

- INSIGHT app: `2026.09.07.8` — unchanged.
- 本人通知・統計: `2.9.39`.

## Real-device regressions that triggered this release

Android Edge/Tampermonkey reports after v2.9.38:

1. Filter ON could navigate to an unrelated note page.
2. Manual save could leave the notification panel / return to note top; reopening 🔔 then showed the saved result.
3. Notification scrolling still felt heavy.
4. INSIGHT control taps had previously leaked into note DOM navigation.
5. Install/update sometimes opened raw userscript text and/or returned to the smartphone home screen, leaving the user unsure whether the update succeeded.

## v2.9.39 architecture

### Controls

- Visible controls now live in `public/note-insight-notification-runtime-v2939-dock.js` as a small fixed iframe.
- User taps therefore do not bubble through note's DOM/event delegation.
- The old rail remains hidden as an internal command/state bridge only.
- The iframe calls the legacy handlers directly through their `onclick` function, not through a DOM `.click()` event.
- INSIGHT uses the absolute notification route directly.
- Scroll position is captured/restored around filter/manual operations.

### Manual save root

- `public/note-insight-notification-runtime-v2939-prelude.js` runs before the manual reader.
- It narrows the reader root to the notification-row container where possible, so the reader cannot accidentally select the page/background scroller.

### Filter

- `public/note-insight-notification-runtime-v2939-filter.js` is the authoritative visible filter.
- Filter behavior is display-only: it does not navigate, scroll, or synthesize user gestures.
- Only the leading/representative creator is evaluated.
- A registered creator appearing only second/later in an aggregated notification does not hide that row.
- Exact name, truncated leading name, profile hydration, and leading creator link ID remain supported.
- Legacy over-broad mute classes are visually neutralized for rows that v2.9.39 decides should remain visible.
- No filter scan is attached to scroll events.

### Scrolling

- `public/note-insight-notification-runtime-v2939-scroll.js` only applies native `overscroll-behavior`/`touch-action` to the actual notification scroller.
- It does not handle `touchmove`, `wheel`, `preventDefault`, or write `scrollTop` during normal scrolling.
- `public/note-insight-notification-runtime-v2938-perf.js` is loaded before the old UI so the old per-scroll filter hook is not bound.

### Install/update

- `public/notification-update.html` no longer navigates directly to raw GitHub source.
- It opens Tampermonkey's official `script_installation.php#url=...` installer page.
- Pending update state is persisted in `localStorage`, not only `sessionStorage`, so reopening the browser/tab can resume verification after a smartphone-home detour.
- After install window close/focus return, it automatically opens the note version-check route.
- Successful check returns to `notification-setup.html`, which shows `本人通知 v2.9.39｜最新版` / `更新完了`.

## Reference design note

Public descriptions of `note共同マガジン通知フィルター` by ひゅー describe a Chrome extension focused on hiding only joint-magazine notification types. v2.9.39 adopts the same high-level separation principle—filtering only changes visibility—without using or reproducing paid source code.

## Do not regress

- Do not place visible notification controls back inside note's notification/modal DOM.
- Do not use synthetic DOM clicks for the visible controls.
- Do not attach filter work to every scroll event.
- Do not manually drive notification scrolling on touchmove/wheel.
- Do not let second/later creators trigger a filtered row.
- Do not return to direct raw-text installation as the primary update path.
- Keep INSIGHT app and本人通知 versions independent.
