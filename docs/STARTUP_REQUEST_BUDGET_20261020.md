# Whole-entry authentication budget

Three buildable, single-boundary changes: (1) shared in-flight-only session helper, (2) Live shell consumer and optional verified-identity handoff, (3) App/main consumers and whole-entry coverage. Apply in this order. No database migration or Edge Function deployment is needed for these frontend changes.

Normal overlapping startup checks fall from 3 to 1; slower storage hydration can make the initial check finish before App mounts, so the measured budget is 3 to 2 in that case. We deliberately do not cache settled authentication responses to claim a universal one-call budget. Later focus/resume/manual checks still contact the server.

A fresh, active, token/scope-matching server response can initialize Live. Previous saved profile data cannot grant that handoff. Each subscriber can cancel independently; only the last cancellation aborts shared transport. Account switches and logout invalidate stale responses. Wrong-account/malformed successful responses cannot overwrite saved identity in main.

New coverage: 12 shared-request tests and 15 real main-to-App-to-Live entry tests, including StrictMode, storage delay, session rejection, wrong scope, logout, account switching, late replies and manual refresh. Existing test assertions remain; three fixture loaders now load the real shared helper rather than silently stubbing a new import.

Independent review found no new correctness blocker and rejected folding the independently maintained Live surface into app-shell. The feature-boundary checker is unchanged.

Rollback all three frontend commits in reverse order, or restore main9af6ac7 frontend files and release metadata, then rebuild Pages. No user data restoration is needed. Reader3.6.38, Dashboard1.7.3 and DM1.4.11 versions stay unchanged.
