# Notification Browser Installer Boundary

## Canonical installer
- public/notification-browser-install.html

## Compatibility entry
- public/tool-setup.html
  - Redirect only.
  - Must preserve query string and hash.
  - Must not contain browser-install UI or notification runtime logic.

## Change boundary
Normal本人通知 releases must not modify:
- public/notification-browser-install.html

The installer is independent from:
- public/note-insight-notification-runtime-v327.js
- public/note-insight-notification-reader-v323.js
- public/note-insight-notification-checkpoint-v325.js
- public/note-insight-notification-v3.user.js

The installer may read public/insight-release.json to display/check the latest release, but it must not embed a V3.x.x notification version string.

## UI contract
- Browser choices are compact collapsed panels.
- Only the detected browser panel opens automatically.
- Other panels remain collapsed until tapped.
- Android, iPhone/iPad, PC, and Mac routes remain separate.
- Safari offers Userscripts and Tampermonkey as explicit choices.
- Unsupported mobile browsers show the browser to switch to instead of dead-ending.
