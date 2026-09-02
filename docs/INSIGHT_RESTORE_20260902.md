# INSIGHT FULL HISTORY RESTORE — CURRENT CHECKPOINT

Updated: 2026-09-02 17:50 JST

This checkpoint is newer than the earlier Sep-2 simplified participant INSIGHT work. Future work must determine latest state by timestamp first and start from current GitHub `main`.

## User-required behavior
- Do NOT replace the rich INSIGHT with the simplified `MemberInsightApp` again.
- Participant INSIGHT must expose the previously accumulated history immediately from Supabase; note re-crawling must not block initial history display.
- Keep explicit `アカウント切替`, `本人通知`, and `データ更新` controls visible in the participant INSIGHT header.
- Keep fixed distribution URL: `https://mumei-s.github.io/note-insight/`.
- Edge/PWA must not reopen the notification setup page as the application start screen.

## Restored ss_yr historical data
The old data was NOT deleted. It remains under analytics `member_id='owner'` and was verified at this checkpoint:
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

## Supabase functions
- `insight-member-history` v1 ACTIVE
  - custom participant auth
  - actions: summary, likes, supporters, comments, comment_thread, social, changes, notifications, articles
  - uses existing `insight_fast_*` SQL RPCs for saved-history reads
  - `ss_yr -> owner`, all other members -> own UUID
- `insight-member-api` v2 ACTIVE
  - current public reaction sync
  - for `ss_yr`, article/like/comment sync now continues writing to legacy `owner` history scope instead of the small participant UUID scope
  - new private notification rows remain scoped to the authenticated participant ID
- `insight-self-account` v3 ACTIVE
  - long-session touch/logout/leave remains
  - `touch` now self-heals the public participant row
  - when the same note ID already exists (e.g. old OWNER public row), update by note ID instead of silently failing the `note_id` unique constraint

## Frontend
- `src/member-insight-full.tsx` + `src/member-insight-full.css` are the restored participant dashboard.
- `src/App.tsx` routes participant dashboard/features/evidence fallback to `MemberInsightFull`, not `MemberInsightApp`.
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

## Edge / PWA stale notification-page repair
- `public/sw.js` cache generation: `mumei-note-insight-v25`.
- Service Worker detects stale direct navigation to notification pages and redirects to root.
- On SW activation it enumerates existing window clients and attempts to navigate stale notification clients back to root.
- Legitimate notification setup requires explicit markers:
  - `notification-setup.html?from=insight...`
  - `notification-import.html?from=setup...`
- `public/notification-setup.html` uses the explicit marker and links back to INSIGHT.
- This is code/build/deploy verified, but actual Edge Android UI must be tested on the user's device.

## Build/deploy checkpoint
GitHub Pages run for main commit `aa1f821bde6540321190baaf6fe2eb4559be4e4b` completed successfully:
- notification userscript syntax check: success
- `npm run build`: success
- Pages artifact: success
- deploy: success

## Do not regress
- Do not reintroduce the simplified four-tab participant dashboard as the primary INSIGHT.
- Do not move ss_yr historical data to a new empty UUID scope.
- Do not show only newly crawled history when the old saved full history exists.
- Do not remove comments, follower/following history, supporter ranking, or notification history.
- Do not remove the account-switch or personal-notification controls.
- Do not change the fixed distribution URL.
