# INSIGHT FULL HISTORY RESTORE — CURRENT CHECKPOINT

Updated: 2026-09-02 20:07 JST

This checkpoint supersedes the earlier Sep-2 simplified participant INSIGHT work and the 17:50 restore checkpoint. Future work must determine latest state by actual timestamp first, then fetch current GitHub `main` before editing.

## User-required behavior
- Do NOT replace the rich INSIGHT with the simplified `MemberInsightApp` again.
- Participant INSIGHT must expose the previously accumulated history immediately from saved Supabase data / fast RPCs. A fresh note crawl must never block initial history display.
- Keep explicit `アカウント切替`, `本人通知`, and `データ更新` controls visible in the participant INSIGHT header.
- Keep fixed distribution URL exactly: `https://mumei-s.github.io/note-insight/`.
- `INSIGHT-XXXXXXXX` is a temporary note-profile ownership verification code only. It is not a login password and no normal code-input login form is used.
- Edge/PWA must open at the public TOP, not reopen the notification setup page as the application start screen.

## Restored ss_yr historical data
The old data was NOT deleted. It remains under analytics `member_id='owner'` and was re-verified during this restore:
- articles: 256
- identified like history: 34,318
- comments/replies: 4,048
- root external comment threads: 1,570
- active followers tracked: 1,023
- active followings tracked: 888
- notifications: 2,483

The later simplified participant UUID scope contained only 18 articles / 931 likes / 0 comments / 61 followers and caused the apparent regression. It must not be used as the primary history scope for `ss_yr`.

## Authentication and data scope
- Participant authentication remains `X-Insight-Token` and the active `insight_access_applications` row.
- `ss_yr` authenticates as the participant application but maps analytics history to legacy scope `owner`.
- Other participants map analytics history to their own application UUID only.
- This mapping is server-side. Other participants must never receive `owner` data.
- Account switching is one-tap among fully verified accounts with saved valid member sessions. Switching does not log out other saved accounts.
- New-device / lost-login recovery uses note ID → newly issued temporary profile code → note self-introduction verification → new long-lived session. No old code/password is entered.

## Supabase functions
- `insight-member-history` **v1 ACTIVE**
  - custom participant auth
  - actions: summary, likes, supporters, comments, comment_thread, social, changes, notifications, articles
  - uses existing `insight_fast_*` SQL RPCs for saved-history reads
  - `ss_yr -> owner`, all other members -> own UUID
- `insight-member-api` **v2 ACTIVE**
  - current public reaction sync
  - for `ss_yr`, article/like/comment sync continues writing to legacy `owner` history scope instead of the small participant UUID scope
  - new private notification rows remain scoped to the authenticated participant ID
- `insight-self-account` **v4 ACTIVE**
  - long-session touch/logout/leave remains
  - `touch` self-heals the public participant row
  - when the same note ID already exists (for example the old OWNER public row), it updates by note ID instead of silently failing the `note_id` unique constraint
  - participant leave revokes private-notification tokens and unused pair codes
- `insight-access` **v3 ACTIVE**
  - profile verification / OWNER approval flow remains
  - `publicParticipantUpsert` now also resolves the public row by note ID before insert; the first verification flow no longer fails when a historical OWNER public row already owns that note ID
- `insight-recovery` **v1 ACTIVE**
  - re-verifies ownership on a new device without asking the user to remember/type an old INSIGHT code
- `insight-notification-import-token` **v4 ACTIVE** and `insight-notification-ingest-v2` **v1 ACTIVE** preserve account-isolated personal notification pairing/ingestion.

## Frontend
- `src/member-insight-full.tsx` + `src/member-insight-full.css` are the restored participant dashboard.
- `src/App.tsx` routes participant dashboard/features/evidence fallbacks to `MemberInsightFull`, not `MemberInsightApp`.
- Restored tabs:
  - 概要
  - スキ履歴
  - コメント
  - 応援者
  - フォロー
  - 通知
  - 記事
- Comment rows can expand to stored thread details.
- Full totals come from saved DB/RPC data, not a fresh note crawl.
- The history UI renders server-backed 100-row view pages for mobile safety, but the complete saved history and totals are immediately available; it does not rebuild history 50/100 rows at a time from note.
- Participant header keeps visible `アカウント切替`, `本人通知`, `データ更新` controls.
- Participant access uses `AccessPortalV6`.

## Participation / code semantics
Normal participation:
1. Enter note ID/profile URL once.
2. OWNER approves.
3. INSIGHT displays a temporary verification code.
4. Participant pastes it into note self-introduction and saves.
5. INSIGHT verifies the public profile.
6. Long-lived member session is issued and saved.
7. Participant removes the temporary profile code.

The verification code is never a normal login password. Pending/unverified sub-account applications are not shown as normal switchable accounts.

## Personal notification
- Notification sync userscript remains account-isolated v2.2 behavior.
- The actual logged-in note identity is checked before private notification ingestion.
- Personal-notification setup links use explicit `from=insight` markers.
- Notification setup opens outside the PWA main client, so the main INSIGHT window is not replaced/parked on the helper page.
- Server-side ingestion rejects wrong-account notification tokens/IDs.

## Edge / PWA TOP repair
- `public/manifest.webmanifest` now has stable app `id: /note-insight/` and PWA `start_url: /note-insight/?launch=top`.
- `src/main.tsx` consumes the internal `launch=top` marker, removes it, clears participant hashes and normalizes the app to the fixed public TOP. Explicit OWNER direct routes remain exempt when opened directly.
- `public/sw.js` cache generation is **`mumei-note-insight-v26`**.
- On SW activation, any existing Edge/PWA window parked on `notification-setup.html` or `notification-import.html` is navigated through the TOP launch entry when the browser permits background navigation.
- Direct/stale notification helper navigation without the required marker is redirected to TOP.
- Legitimate notification setup requires explicit markers:
  - `notification-setup.html?from=insight...`
  - `notification-import.html?from=setup...`
- Actual Edge Android UI still must be verified on the user's device; code/build/deploy success does not prove Android's window-restoration behavior by itself.

## Build/deploy checkpoint
The latest functional release before this documentation update was GitHub main commit `5a86d38839e9938da89bcdb6f7289bd889027080`.
Its GitHub Pages run completed successfully:
- notification userscript JavaScript syntax check: success
- `npm run build`: success
- Pages artifact upload: success
- deploy: success

## Do not regress
- Do not reintroduce the simplified four-tab participant dashboard as the primary INSIGHT.
- Do not move `ss_yr` historical data to a new empty UUID scope.
- Do not show only newly crawled history when the old saved full history exists.
- Do not remove comments, follower/following history, supporter ranking, notification history or article archive.
- Do not remove account-switch or personal-notification controls.
- Do not restore a code-input login form.
- Do not treat the profile verification code as a password.
- Do not show pending sub-account applications in the normal switch list.
- Do not change the fixed distribution URL.
- Preserve newer unrelated userscript work such as 巡回BOOST when continuing INSIGHT work.
