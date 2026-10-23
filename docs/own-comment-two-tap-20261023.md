# Own-comment consent: two-action candidate

Base: `6752b89742f548830a5ad4ca51e3a4f4b1370d07`.
Reserved release: INSIGHT `2026.10.23.4`, Reader `3.6.43`.

## Scope

After opening the existing save settings, initial activation requires two explicit actions:

1. INSIGHT: read the data/destination disclosure and press **同意してnoteへ進む**.
2. note: press **このブラウザで自動保存を有効にする**.

No duplicate checkboxes, generated-code copy, or extra handoff-link click is needed in the normal path. Same-tab navigation avoids popup permission. A validated same-tab `noreferrer` fallback link remains if navigation is refused. Reader installation/update, if needed, is separate; installed user version was not inspected.

The existing short-lived one-use consent code, authenticated INSIGHT session, same member/account binding, device token, and atomic server exchange remain unchanged. Both permission-start and device-enable handlers reject synthetic clicks. Landing on note does not enable capture. Reader rechecks the current note account immediately before exchanging scope. No database, Edge Function, RLS, secret, or existing-token mutation is part of this candidate.

Cancel aborts pending consent and rejects late results; retry cannot let an older request clear a newer lock. A successful server exchange followed by local-storage failure leaves capture off and exposes explicit Stop so the server scope can still be revoked. A consumed link cannot be reused to restart. Existing saved bodies, queue, stop, and deduplication logic remain intact.

## Verification

- Final TypeScript/build passed. All 25 configured Pages userscript syntax checks passed.
- Outgoing-comment unit/backend/DB regression: 51 passing tests, independently reviewed.
- Configured Pages workflow: all 23 test groups passed, totaling 1471 tests. The outgoing-comment group includes the 51 tests above.
- Legacy `npm test`: four pre-existing static assertions also fail on exact base; no unrelated BOOST/TOP/OWNER changes made.
- New real-browser suite: `tests/outgoing-comment-two-tap.browser.mjs`. Requires Playwright and Chromium, with all external API calls mocked. It exercises trusted clicks, synthetic-click rejection, cancellation, account change, malformed/expired handoff, Reader refusal, stop, and local-write failure recovery. Browser launch was blocked before any test ran by this executor's socket restrictions; the supported escalation failed in sandbox bootstrap. Actual Chromium trusted-click success and navigation are **not verified**. The unit suite does not pretend a synthetic event is a real user click.

Example browser-test command:

`PLAYWRIGHT_MODULE=/path/to/playwright-core/index.mjs CHROMIUM_PATH=/usr/bin/chromium node --test tests/outgoing-comment-two-tap.browser.mjs`

No real user permission was enabled and no actual comment was posted during development. No merge/deployment is included. A draft PR is not publication approval. Preserve the feature-separated commits with rebase merge if publication is authorized; squash/merge-commit would combine UI and Reader boundaries.

## Limits and rollback

Only future successful posts from an opted-in supported Reader browser are captured. This does not discover past unrecorded posts, monitor native note-app posts, or guarantee complete new-reply acquisition.

Rollback the client commits/release markers without reverting the earlier archive schema or deleting saved comments. Existing permission grants and archived data are not modified by publishing or rolling back this UX change.
