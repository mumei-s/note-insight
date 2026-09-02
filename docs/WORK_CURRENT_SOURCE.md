# WORK CURRENT SOURCE OF TRUTH

Updated: 2026-09-02 20:07 JST

## 2026-09-02 20:07 FULL INSIGHT / ACCESS V6 / EDGE PWA — LATEST CHECKPOINT

**This is the newest checkpoint.** Future work must first compare actual timestamps, then fetch current GitHub `main`. Do not prefer an older chat/spec because of its title, and do not roll back newer unrelated userscript work such as 巡回BOOST.

Canonical detailed restore spec: `docs/INSIGHT_RESTORE_20260902.md`.
Canonical access semantics: `docs/ACCESS_V6_CURRENT.md`.

### Full participant INSIGHT restored
- The simplified `MemberInsightApp` is no longer the participant dashboard. `src/App.tsx` routes participant dashboard/features/evidence fallbacks to `MemberInsightFull` from `src/member-insight-full.tsx`.
- `ss_yr` participant authentication maps analytics reads/writes to the preserved legacy `owner` history scope. Other participants remain strictly scoped to their own application UUID.
- Verified preserved `ss_yr` history remains:
  - articles 256
  - identified likes 34,318
  - comments/replies 4,048
  - external root comment threads 1,570
  - active tracked followers 1,023
  - active tracked followings 888
  - notifications 2,483
- These histories are read immediately from saved Supabase data / existing `insight_fast_*` RPCs. Do not block the initial view on a fresh note crawl.
- The UI may render saved data in 100-row screen pages for mobile safety, but this is not a 100-row recrawl/rebuild. Full totals/history already exist server-side.
- Restored participant tabs: 概要 / スキ履歴 / コメント / 応援者 / フォロー / 通知 / 記事.
- Participant header must keep visible `アカウント切替`, `本人通知`, `データ更新` controls.

### Access V6 — code is profile verification only
- Active access UI is `AccessPortalV6` from `src/access-portal-v6.tsx`.
- `INSIGHT-XXXXXXXX` is **not a login password**. It is shown by INSIGHT and temporarily pasted into the participant's public note self-introduction/profile to prove ownership.
- There is no normal code-input login form.
- Normal participation: note ID once → OWNER approval → temporary profile code → paste into note bio → INSIGHT verifies → long-lived session saved → remove code.
- Normal switching among verified accounts is one-tap and does not log out the other saved account.
- Pending/approved-but-unverified applications are not shown as normal switchable accounts.
- New-device/lost-login recovery: note ID → new temporary verification code → note bio verification → new long-lived session. No remembered old code/password is needed.

### Supabase current functions
- `insight-member-history` v1 ACTIVE: authenticated full saved-history API, `ss_yr -> owner`, all other participants -> own UUID.
- `insight-member-api` v2 ACTIVE: current public-reaction sync; `ss_yr` article/like/comment updates continue writing to the legacy full-history scope.
- `insight-self-account` v4 ACTIVE: ten-year sliding touch, explicit logout/leave, public participant self-heal, private-notification cleanup on leave.
- `insight-access` **v3 ACTIVE**: participation/approval/profile verification; public participant upsert is now note-ID safe so an old OWNER public row cannot break first participant verification.
- `insight-recovery` v1 ACTIVE: new-device profile re-verification.
- `insight-notification-import-token` v4 ACTIVE + `insight-notification-ingest-v2` v1 ACTIVE: account-isolated personal notification pairing/ingestion.

### 本人通知
- Personal notification sync remains account-isolated v2.2 behavior.
- Actual note login identity is checked before ingestion and wrong-account ingestion fails closed server-side.
- Participant full INSIGHT exposes `本人通知` explicitly.
- Notification setup/import pages require explicit `from=insight` / `from=setup` markers.
- Notification setup links are forced into a separate browser/PWA client/tab so the main INSIGHT client is not replaced by the helper page.

### Edge / PWA TOP launch hardening
- Fixed distribution URL remains exactly `https://mumei-s.github.io/note-insight/`.
- PWA manifest has stable app id `/note-insight/` and internal start URL `/note-insight/?launch=top`.
- `src/main.tsx` consumes/removes the internal launch marker and normalizes participant startup to the public TOP. OWNER direct admin routes remain available when explicitly opened.
- Service Worker cache generation is **`mumei-note-insight-v26`**.
- On SW activation, existing notification setup/import windows are navigated back through the TOP launch entry when Android Edge permits background client navigation.
- Stale/direct notification helper navigation without explicit markers redirects to TOP.
- Actual Edge Android window restoration must still be checked on-device; build/deploy success alone does not prove browser-specific UI behavior.

### Latest verified release before docs commits
- Functional release commit: `5a86d38839e9938da89bcdb6f7289bd889027080`.
- Pages workflow: notification userscript syntax check SUCCESS, production build SUCCESS, artifact SUCCESS, deploy SUCCESS.
- Documentation commits after that must also be allowed to complete Pages before declaring the current HEAD deployed.

### Do not regress
- Never restore the simplified four-tab participant dashboard as primary INSIGHT.
- Never move `ss_yr` away from the preserved legacy full-history scope unless data has been fully migrated and verified.
- Never remove comments, follower/following history, supporter ranking, notification history, article archive, account switch or personal notification controls.
- Never restore code-input login or treat the temporary profile verification code as a password.
- Never change the fixed public distribution URL.

## 2026-09-02 11:44 ACCOUNT-ID ISOLATION / PRIVATE NOTIFICATION 2.2 — PREVIOUS CHECKPOINT

This older checkpoint is retained for implementation history only. The 20:07 checkpoint above and `docs/ACCESS_V6_CURRENT.md` supersede any V4/code-login UI statements below.

### INSIGHT account switching — fixed-ID bug resolved
- Root cause: participant access still used device-global applicant/passcode state, so a newly selected note account could keep the previous application's identity/token context. In addition, switch intent could be consumed before the current active member session had been migrated into the saved-account list.
- `src/insight-account-store.ts` now uses account store v3: `mumei-insight-saved-accounts-v3` plus `mumei-insight-active-account-v3`.
- Every saved note account owns its own `noteId / memberToken / applicantToken / passcode / identity metadata`. Global token keys remain only as the compatibility slot for whichever account is currently selected.
- Legacy v2 saved accounts are migrated automatically. The current account is resolved by explicit active note ID first, then member-token/applicant-token match; it no longer falls back blindly to the first stored account.
- Earlier V4 UI details are historical; current active access UI is V6.
- Completing profile verification immediately saves that participant as an active account and enters INSIGHT. Normal later switching requires no code and does not log out other saved accounts.
- Database state during this stage: `ss_yr` was active/profile-verified; `fuku444` was OWNER-approved but not profile-verified.

### Private本人通知 — account-safe v2.2
- The prior v2.1 userscript used one device-global private-notification ingest token. That was unsafe for multi-account note usage because a note login switch could continue using the previous account's token.
- `public/note-insight-notification-sync.user.js` is v2.2.0.
- v2.2 reads actual note login identity from `/api/v2/current_user`.
- Private notification token, last-notification signature, and magazine-mute settings are stored under actual note ID.
- Pairing refuses a mismatch between the expected INSIGHT note ID and note's actual logged-in ID.
- Existing notification UX from v2.1 is preserved: real bell view detection, manual-bell fallback, right-edge `🔔 同期` dock, exact magazine-add filtering, and no hiding of likes/comments/follows/purchases/tips.

## 2026-09-02 10:28 CODE-ONLY LOGIN / NON-BLOCKING INITIAL LOAD — HISTORICAL CHECKPOINT

This section is historical. **Code-only login was later removed from the normal UX.** Current V6 semantics are defined above.

- The simplified `MemberInsightApp` once used a lightweight dashboard and background initial sync to avoid an infinite spinner.
- That simplified dashboard was later superseded by the restored full-history `MemberInsightFull`.
- A 20-second timeout pattern remains useful for network operations, but saved full history should be shown from Supabase/RPC rather than rebuilt by a fresh crawl.

## 2026-09-02 ACCESS / TOP / MULTI-ACCOUNT — HISTORICAL FOUNDATION

- The production-facing app remains INSIGHT only. Games and creator directory stay detached.
- Account switching is **not logout**. Switching to another saved account does not revoke the previous account session.
- Transient network/API failures must not erase a saved login. A stored member session is removed only on explicit authentication failure.
- Public TOP has `ログイン`, `参加`, small `ログアウト`, and small `退会` controls. Destructive actions require yes/no confirmation.
- Explicit logout revokes only the current account session. Other stored accounts remain available.
- Explicit leave/退会 revokes all sessions for that participant, marks participation revoked, removes it from active public participants and disables notification watch.
- Valid participant sessions use sliding long-term retention; app launch touches the session and refresh failure does not block startup.
- Duplicate upper TOP branding was removed and participant-facing copy no longer frames participation as a purchase/sale flow.
- Social preview uses dedicated `insight-og-image`.

## 2026-09-02 NOTE NOTIFICATION SYNC 2.1 — HISTORICAL BASELINE

- v2.1 removed dependence on finding/programmatically clicking a labelled bell button.
- The adapter watches visible `通知` / `お知らせ` tabs and real notification rows.
- Manual bell fallback remains when automatic opening is unavailable.
- Notification row discovery supports current mobile layout and legacy layouts.
- The sync status UI is a right-edge `🔔 同期` pull-out tab.
- Exact magazine-add filtering requires visible actor URL + magazine-add text; likes, comments, follows, purchases and tips remain untouched.

## 2026-09-01 NOTE NOTIFICATION FILTER — HISTORICAL BASELINE

- Magazine mute creator lists are transferred without sending note passwords/login cookies to INSIGHT.
- Only exact visible magazine/article-add events from registered creator profile URLs are hidden in the rendered notification panel.
- Likes, comments, follows, purchases, tips and all other types remain visible.
- Aggregated notices with no exposed matching creator URL are not guessed/hidden.

## 2026-09-01 OWNER / PARTICIPANT SEPARATION — CURRENT SECURITY BOUNDARY

The production-facing `note-insight` app remains **INSIGHT only**. OWNER administration is not part of normal participant UI.

- Public TOP never reads OWNER state to reveal an admin link.
- Public TOP never routes to OWNER INSIGHT merely because an OWNER token exists in the browser.
- Participant navigation remains TOP / INSIGHT only.
- OWNER entry, OWNER INSIGHT and application management are separate routes and separate session state.
- `#manage` may be typed directly, but management data must not render until OWNER session is server-confirmed.
- OWNER may approve/reissue applicant profile verification codes but does not need to see/copy them in participant UI.
- OWNER-token compatibility is handled server-side.
- Fixed public URL remains `https://mumei-s.github.io/note-insight/`.

## 2026-08-31 PRIMARY INSIGHT SCOPE

The deployed primary `note-insight` app is **INSIGHT only**. Canonical product scope is `docs/PRIMARY_APP_SCOPE.md`.

- Games remain detached and preserved.
- クリエイター名鑑 remains detached from the production-facing INSIGHT app unless explicitly requested later.
- Public navigation is TOP / INSIGHT only.
- OWNER management remains separate at `#manage` and is never linked from normal participant UI.

## Participant flow — current
1. Participant opens the fixed root URL.
2. New participant enters note ID/profile URL once.
3. Application reaches OWNER management.
4. OWNER approves.
5. INSIGHT shows a temporary `INSIGHT-XXXXXXXX` ownership code.
6. Applicant temporarily places the code in public note self-introduction/profile.
7. INSIGHT verifies the public profile.
8. Account becomes active, a long-lived session is saved, and the creator is added/self-healed in the public participant list.
9. Participant removes the temporary code.
10. Normal switching among saved verified accounts is tap-only.
11. A new device uses note ID → new temporary verification code → profile re-verification; old code/password input is not required.

## Backend boundaries — current
- `insight-access`: applications, approval, profile verification, session compatibility, public participant registration; currently v3 ACTIVE.
- `insight-recovery`: new-device/lost-session profile re-verification; v1 ACTIVE.
- `insight-self-account`: participant long-session refresh/logout/leave/public-row self-heal; v4 ACTIVE.
- `insight-member-history`: participant-authenticated full saved-history read API; v1 ACTIVE.
- `insight-member-api`: participant current public-reaction sync; v2 ACTIVE.
- `insight-notification-import-token`: participant/OWNER private notification pairing; v4 ACTIVE.
- `insight-notification-ingest-v2`: account-verified private notification ingest; v1 ACTIVE.
- OWNER analytics may continue using OWNER-only legacy/full endpoints, but other participants must never receive `ss_yr`/`owner` data.

## Participant INSIGHT core
Core cross-platform functionality must work from the fixed GitHub Pages URL on ordinary modern mobile/desktop browsers without a userscript:
- verified creator identity;
- saved article history;
- identifiable public like history/supporters;
- public comments/replies and thread history;
- follower/following current state and available change history;
- supporter/commenter rankings;
- public-reaction notifications/deltas;
- manual data update controls.

Private note-account bell notifications are an optional account-isolated userscript extension and must never block core INSIGHT.

## Detached archives — preserve, do not re-enable
### Games
The completed six-game implementation, game CSS/tests, ledger support, migrations and `docs/GAME_SPEC.md` remain preserved. Do not delete or reconnect without explicit instruction.

### Creator directory
Existing directory/catalog source and Supabase data remain preserved but are not part of current deployed product.

## Persistence discipline
Always determine the newest work by **actual timestamp first**, then fetch current GitHub `main`. Commit in small recoverable stages. If usage limits appear, stop only after pushing a compilable state and updating this file. Never roll back unrelated newer userscripts or tooling.
