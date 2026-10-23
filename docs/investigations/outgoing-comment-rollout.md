# Outgoing comment archive: rollout and rollback review

LOCAL CANDIDATE ONLY. No production migration, token change, endpoint deployment, branch push or public release has been performed by this task.

Base: main 97157a727, preserving PR77 list projection and saved-conversation behavior.
Reserved versions: INSIGHT 2026.10.23.3 / Reader 3.6.42.

## Scope requiring approval before external changes

- Apply `supabase/migrations/20261023080349_insight_own_comment_scope_archive.sql`.
- Add nullable `own_comment_account` to existing `insight_notification_pair_codes` and `insight_notification_ingest_tokens`. Existing rows remain unchanged.
- Create four SECURITY INVOKER RPCs with fixed empty search_path: `insight_upgrade_own_comment_scope`, `insight_archive_own_comments`, `insight_own_comment_history_page`, `insight_own_comment_saved_thread`.
- Add two scoped indexes for saved notification thread lookup and outgoing parent-key lookup; no row contents changed.
- Explicitly revoke RPC EXECUTE from PUBLIC, anon and authenticated; grant only service_role. No RLS policies or table privileges broadened.
- Deploy new `insight-outgoing-comment-ingest` and `insight-outgoing-comment-history`, and updated `insight-notification-import-token`. These functions use their own existing-token/session validation; if gateway JWT verification is configured false, preserve that intentional custom-auth setup only after review.
- Publish reviewed app/Reader code. No administrative SQL token-purpose upgrade. Users must opt in separately in INSIGHT and in the currently paired Reader browser.

## Recommended sequence after approval

1. Recheck current main and merge any later nonconflicting work; rerun tests/build. Save deployed prior import-token source/version and public release refs for rollback.
2. Verify the current schema matches tested UUID/text/timestamp assumptions. Apply only the approved additive migration; inspect new grants and functions read-only afterward. Verify old token purposes and existing comment rows have not changed.
3. Deploy backend endpoints and updated pairing endpoint. Read-only checks must verify old notification pairing/status remains valid. Do not issue credentials, enable permission, or send public comments as a test without explicit authorization.
4. Publish Reader/app update. Existing installs remain default-off and add zero startup requests until opted in. Old notification tokens still work normally.
5. User chooses explicit checkbox/button consent in INSIGHT, opens the official consent URL in the already supported browser, then chooses the Reader checkbox/button. Atomic exchange binds that one existing token to its verified account. No secret is displayed or transferred to page scripts.
6. Verify on an authorized genuine user post that exact native response remains intact, queue record is captured, exact server ACK arrives, private history appears, and opt-out across tabs stops future capture/send. Do not create unsolicited test comments on someone else's article.

## Boundaries and observability

- Supports successful modern note `/api/v3/notes/<key>/note_comments` browser POST only. Legacy `/comments`, native note app, missing past unnotified comments and browsers without the installed Reader are not covered.
- Local pending is not server-saved. UI pending count and failures remain until exact persisted-ID ACK. A network failure stops the current drain; permanent malformed records remain pending but cannot block unrelated valid posts.
- One initial account check/status request only for opted-in devices; no interval polling/crawling. History opens one bounded list page, with database-truncated body previews. Conversation detail uses exact article/root IDs and DB-side dedup/caps before transfer.
- Replies are only shown when saved; absence is never presented as proof there was no reply. Previous full text is retained across missing/deleted source responses.
- DOM/mock/PGlite tests are not proof of real Android userscript installation. Executor Chromium startup was blocked, so actual supported-browser validation is still required.

## Non-destructive rollback

1. Stop new consent issuance and archive upload if a safety issue requires it by deploying an authenticated feature-disabled response for the new routes; never weaken auth to keep them running. Preserve already saved rows. Pending Reader entries remain local and are not falsely acknowledged.
2. Publish a higher-version Reader patch that stops the optional observer/drain, preserving userscript settings and IndexedDB records. Simply serving a lower version may not downgrade installed managers.
3. Restore prior app UI/release behavior and prior import-token source if needed. Because some tokens may have the expanded purpose, preserve notification compatibility for both old and expanded purposes while disabling new capability; do not accidentally break notification status/pairing for opted-in users.
4. Leave the additive columns, saved outgoing activity rows and historical comment records intact. Do not DROP columns/tables/RPCs or delete data as routine rollback. Service-only unused RPCs can remain dormant; revoking their grants or changing token scopes is a separate reviewed security action.
5. Do not silently reset tokens or remove user permission. An authorized per-device stop may reduce that exact token to notification-only; never bulk mutate all users/devices. Retain any pending records for later explicit restart/recovery.
