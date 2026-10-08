# INSIGHT 2026.10.08.2 — return from owner-notification connection

Base main: f70816109699ba2522fb48a5374c8065fc7400d0.

The connection page accepted an absent `return` parameter as its own URL, replacing the existing INSIGHT return link with a self-navigation. The top-right control was account switching rather than returning, and its bare access route omitted the manual switch intent.

- The top-right link now explicitly returns to INSIGHT; account switching remains a distinct top-left control with its original label.
- Blank, external, connection-page and installer-page return URLs use the INSIGHT notifications fallback. An app-root return retains its query and route; launch/switch markers and a previous account target are removed or replaced.
- Explicit account-switch URLs apply the switch intent before app auto-resume, including newly opened tabs. Opening this route does not sign out the current account.
- Connection status rechecks the current session on account changes and history restoration. Pairing stays disabled during the check. Late old-account responses cannot replace the current account or start a wrong-account return.
- The notification/dashboard ON/OFF controls, installer and existing notification tool versions are retained.

Verification: 12 new connection-navigation cases and 3 new app-entry cases, existing connection controls, manual account navigation and auth-storage cases all pass (32 cases). Production TypeScript/Vite build passes. The new navigation suite is part of the Pages workflow.

Reference reviewed: [Observe settings](https://note-observe.hasyamo.workers.dev/settings) provides an explicit return-to-main control. Only this navigation convention is relevant here; the notification/auth implementation remains INSIGHT's.
