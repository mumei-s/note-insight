# INSIGHT 2026.10.03.23

Started from verified main `3e4df6def335ef05687e01d0ecd6113d8a949816`.

## Result

- Magazine search has its own state and result cache for each magazine and account. Changing the open magazine or list filters cancels the previous request. Request epochs and abort signals prevent late responses from appearing in another magazine.
- Opening search visibly changes the button. Recent matching articles appear immediately, followed by the full result. Busy feedback shows real elapsed time and the visible count; cancellation preserves visible articles. Identical searches reuse a result for 60 seconds. Errors remain distinguishable from an empty result. Dates are searched in Japan time.
- Creator avatars use one shared resolver for TOP, the member header, likes, supporters, comments, favorites, social, notification, DM, magazine owners, participants and article authors. Known images appear immediately; absent/broken images are looked up in batches using the actual note identity. Image results are public-only, cached and isolated by identity.
- TOP has a finite dimensional title entrance, diagonal light strokes, translucent layers and particles. Participant presentation uses a diagonal light rail, round satellite avatars and a profile spotlight. It does not use rotating cards from the reference videos. All current public participants are visible in the list from the start, without a disclosure control. Previous/next/pause and touch switching remain available.
- Main route and INSIGHT tab transitions use independent, non-interactive light layers. Data panels are not remounted to create animation. Persistent navigation remains calm.
- Analysis text is brighter over darker panels. Shared donuts use actual proportions; bars retain their height scale; line graphs preserve their points and missing-data gaps. Shading, ground shadows and finite light movement add depth. Motion is disabled for reduced-motion preferences and paused while scenes are hidden.
- Social preview essentials fit the center square of the 1200x630 image. A new image filename replaces cached old metadata; both full and square crops were visually checked.

## Validation

- TypeScript and Vite production build passed.
- 83 entry, authentication, notification, DM, reader-analysis, release and new search/presentation tests passed.
- All 12 analysis repair tests passed, including DM request ordering and person switching.
- New behavioral coverage checks cross-magazine late responses, cancellation, immediate local matches, query-specific reuse, batched image recovery, identity switching, all eight fixture members remaining visible, exact donut proportions and proportional bars with missing values.
- Existing test adapters were extended to resolve the shared avatar/motion dependencies. Existing behavior assertions were retained.
- `git diff --check` passed. Each implementation commit preserves the existing feature boundary rule.
- Actual Android app/link-preview cache behavior and signed-in production panes require user-device verification; no credentials or private sessions were invented for QA.

## Release boundaries

App: `2026.10.03.23`. Service worker cache: `v89-search-light-20261003`.
Notification `3.6.24`, dashboard `1.6.4`, DM `1.4.10` remain unchanged. No database, authorization or userscript changes.

Primary new components: `creator-avatar.tsx`, `member-insight-magazines.tsx`, `hub-participant-showcase.tsx`, `insight-visible-motion.ts`; scene styles are separate from feature data logic.
