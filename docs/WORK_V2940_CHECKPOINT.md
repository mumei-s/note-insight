# WORK v2.9.40 CHECKPOINT

Updated: 2026-09-08 09:35 JST

Always fetch current GitHub `main` before continuing.

## Release tracks

- INSIGHT app: `2026.09.07.8` — unchanged.
- 本人通知・統計: `2.9.40`.

## Why v2.9.39 was rejected

Android Edge/Tampermonkey real-device testing still showed:

- filter ON sometimes did not filter at all;
- filter/manual actions could leave the notification panel or return to note top;
- notification scrolling still felt heavy;
- install/update could still leave the user at Android home or without a clear current-version confirmation.

Therefore v2.9.39 is not considered fixed on real devices.

## v2.9.40 architecture reset

`public/note-insight-notification-sync.user.js` now loads exactly one notification runtime:

- `public/note-insight-notification-runtime-v2940.js`

Old v2933/v2935/v2938/v2939 runtimes remain in the repository for history only and are no longer loaded by the current userscript.

### Filtering

- Display-only: filter never navigates and never drives scroll.
- Only the first/leading creator link may hide a joint-magazine notification.
- If a target creator only appears second/later in an aggregation, that row remains visible.
- If no creator link is available, leading display name is compared against hydrated saved profiles, including truncated names.
- Initial/current rows are evaluated once; afterward only newly inserted notification rows are observed.
- No filter work is attached to scroll events.

### Manual save

- Reads only currently loaded notification rows.
- Does not auto-scroll the notification panel.
- Does not write `scrollTop`, call `scrollTo`, or synthesize scrolling.
- Continues using the existing account-scoped saved-signature and checkpoint keys and Supabase ingest token.

### Controls

- Visible controls live inside a fixed iframe, isolated from note DOM event delegation.
- No legacy hidden button proxy or synthetic `.click()` bridge remains.
- INSIGHT navigation uses the fixed absolute notification-entry route.
- Group create/delete, group enable/disable, creator add/remove remain available inside the iframe settings view.

### Scrolling

- v2.9.40 has no touchmove handler, no wheel handler, no scroll listener, and no normal-scroll `preventDefault`.
- note/browser native scrolling is left untouched.

### Install/update

- The update page uses the Tampermonkey official `script_installation.php#url=...` intermediate installer.
- It now opens in the same tab instead of spawning a child tab.
- Pending update state is stored under `mumei-notification-update-pending` with target version and return URL.
- Returning to the update page automatically starts note-side version verification.
- Opening `notification-setup.html` after an Android-home detour also resumes verification automatically while the pending state is fresh.
- Successful verification stores and displays `本人通知 v2.9.40｜最新版` / `更新完了`.
- On current Chromium/Edge Tampermonkey 5.3+, userscript execution requires the browser-side user-script permission / developer-mode prerequisite documented by Tampermonkey.

## Regression protection

CI now checks only the current notification bootstrap and `runtime-v2940.js` for syntax.
Regression tests assert:

- exactly one `@require` in the current userscript;
- no legacy notification runtimes loaded;
- no touchmove/wheel/scroll interception or scroll-position writes;
- first-creator-only filtering;
- MutationObserver scoped to the active notification panel;
- isolated iframe controls;
- same-tab persistent install/update verification;
- INSIGHT app and本人通知 versions remain separate.

## Validation

GitHub Actions run `34173743707`:

- userscript/runtime syntax check: success;
- production TypeScript/Vite build: success;
- unified regression tests: success;
- GitHub Pages deploy: success.

Real-device behavior still must be judged from Android Edge/Tampermonkey testing; CI success alone is not a claim that the device issue is fixed.
