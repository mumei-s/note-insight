# Settings update verification — 2026-09-30

App: 2026.09.30.8. Notification 3.6.20, Dashboard 1.6.4 and DM 1.4.9 unchanged.

Only round settings links show steady update highlighting. Feature cards continue to open their features.

Local browser assertions: 178.

- chromium 141.0.7390.37, viewport 360: passed
- chromium 141.0.7390.37, viewport 1280: passed
- firefox 142.0.1, viewport 360: passed
- firefox 142.0.1, viewport 1280: passed
- webkit 26.0, viewport 360: passed
- webkit 26.0, viewport 1280: passed

The UI suite uses synthetic account/version state. It does not authenticate as a participant, contact note APIs, or install userscripts into real participant extension managers. Engine tests are not real Android Edge/Yahoo or iOS Safari device tests.

Checked: matching round-button labels, steady glow without a large-card glow, actual feature and setup clicks, current/missing/update transitions, per-browser settings, network-only release metadata, offline shell, reconnection update, hash preservation, and synthetic login/history/session preservation.

Legacy static suite: 7 checks, 3 identical failures on the exact pre-change baseline and candidate; zero new failures. Original failing tests were not removed or claimed to pass.

Code commits are separated by feature boundary. No Supabase, scheduler, MUUMEI, participant data, or userscript-body changes.
