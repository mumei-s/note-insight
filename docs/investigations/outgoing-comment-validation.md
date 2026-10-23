# Local candidate validation (2026-10-23)

No publication, migration application, real token mutation or external comment occurred.

- Base preserved: origin/main 97157a727 (PR77).
- Production client build: PASS (TypeScript + Vite).
- Current Pages userscript syntax checks, including both new modules: PASS.
- Existing Pages workflow test commands: 22 groups, 1420 tests passed, 0 failed.
- Outgoing feature + notification token-purpose tests: 59 passed, 0 failed.
- Backend worker's isolated TypeScript check with Deno/npm ambient declarations: PASS.
- In-memory PGlite covers explicit scope/account binding, single-use transactional upgrade, expiry/revocation, first-body retention, exact ACK, bounded list/detail data and preserved older deleted replies. No production SQL was applied.
- Independent security review: no remaining blocker after consent-code length, cross-tab stop, poisoned queue and full-entropy nonce fixes.
- Diff whitespace check: PASS.

The first full workflow execution flagged its feature-boundary step because new paths had no classifications and the provisional commit combined Reader/UI files. The implementation was not weakened to suppress the failure: narrow mappings were added to the existing Reader/UI/backend groups, and the local changes were split into separate commits. Every resulting implementation commit was then checked individually and passed. The raw initial log retains that resolved failure; the post-fix boundary log records the successful checks. All 1420 test cases in that initial execution passed.

Real userscript manager/browser verification is NOT complete. Local Chromium startup was blocked by the executor sandbox, and no genuine external comment was posted for testing. The working Node/JSDOM integration verifies actual observer installation, original fetch promise preservation and the exact ACK adapter with mocked successful responses, not Android extension compatibility.

Before release: approved migration/backend/publication, then explicit user device consent and an authorized genuine-post observation in the supported browser. Unsupported: native note app, legacy `/comments` endpoint, and unknown historic comments with no captured URL/ID.
