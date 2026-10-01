# Egress V2 staged rollout — 2026-10-01

This branch prepares a second-generation background-job throttle without changing current production behavior.

## Safety boundary

- No login/auth/session/member table changes.
- No React/PWA/UI changes.
- No maintenance banner changes.
- No existing Edge Function imports are changed yet.
- No cron schedule is changed yet.
- No data deletion.
- Current INSIGHT continues using the existing 2026-09-30 egress guard.

## What V2 adds

A service-role-only lease RPC prevents the same background job from starting again before its minimum interval has elapsed.

The intended rollout is one job at a time:
1. Apply the isolated migration.
2. Verify the RPC using service role.
3. Update exactly one background Edge Function to call `backgroundLeaseGate(...)`.
4. Compare output counts and user-visible data against the unchanged current function.
5. Only after matching, move the next job.

Recommended first candidates from 2026-10-01 logs:
- comment refresh
- notification-related background jobs
- avatar/follower refresh

Do not include login, access, member session, DM reader, notification reader UI, dashboard UI, or thin-thumbnail/card posting in this rollout.

## Rollback

Each caller remains independently switchable. Reverting one Edge Function import/call restores its previous behavior; the V2 table can remain unused without affecting INSIGHT.
