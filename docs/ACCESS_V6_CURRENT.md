# INSIGHT ACCESS V6 — CURRENT CHECKPOINT

Updated: 2026-09-02 16:45 JST

This checkpoint is newer than earlier access/login checkpoints. Future work must determine the newest source by timestamp first, then fetch current GitHub `main` before editing.

## Fixed public URL
- Distribution URL remains exactly: `https://mumei-s.github.io/note-insight/`
- Opening/reloading the participant-facing app always starts at the public TOP.
- Participant hashes such as `#dashboard` / `#access/insight` are cleared on fresh page startup.
- OWNER direct routes (`#owner`, `#manage`, `#owner-insight`, `#owner-features/...`) are exempt so OWNER administration still works.

## Participant identity / code semantics
- `INSIGHT-XXXXXXXX` is **not a login password**.
- It is only a temporary proof-of-ownership code shown by INSIGHT and pasted into the participant's public note self-introduction/profile.
- There is no normal UI that asks the user to type an INSIGHT code to log in.

## Normal participation
1. Participant enters note ID/profile URL once.
2. OWNER approves.
3. INSIGHT displays the temporary verification code.
4. Participant pastes it into their note self-introduction and saves.
5. INSIGHT verifies the public profile.
6. A long-lived member session is issued and stored on that device.
7. The profile code can then be removed.

## Account switching
- Account switching remains supported.
- Only fully verified accounts with a saved valid member session appear in the switch list.
- Pending/approved-but-not-verified applications are not shown as normal switchable accounts.
- Switching is one tap and does not log out the other saved account.

## New device / lost local login
- User enters only their participating note ID/profile URL.
- `insight-recovery` issues a new temporary profile-verification code.
- User pastes the new code into their note self-introduction and saves.
- INSIGHT verifies it and issues a new long-lived member session.
- No remembered old code/password is required.

## Implementation
- Frontend route uses `AccessPortalV6` from `src/access-portal-v6.tsx`.
- `src/main.tsx` normalizes participant app startup to TOP.
- Supabase Edge Function `insight-recovery` v1 is ACTIVE.
- Existing multi-account storage remains account-scoped by note ID.
- Service Worker cache generation is `mumei-note-insight-v23`.

## Do not regress
- Do not restore code-input login forms.
- Do not treat the profile verification code as a password.
- Do not show pending sub-account applications in the normal account switch list.
- Do not change the public distribution URL.
- Preserve participant notification isolation and notification sync v2.2.
