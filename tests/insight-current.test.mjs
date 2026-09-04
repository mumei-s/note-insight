import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("participant dashboard uses unified INSIGHT v4 with all primary tabs", async () => {
  const app = await read("src/App.tsx");
  const live = await read("src/member-insight-live.tsx");
  const full = await read("src/member-insight-unified-v4.tsx");
  assert.match(app, /MemberInsightLive/);
  assert.match(live, /MemberInsightUnifiedV4 revision=\{revision\}/);
  assert.match(full, /useState<Tab>\("likes"\)/);
  assert.doesNotMatch(full, /\["overview","概要"\]/);
  for (const label of ["スキ履歴","スキ順位","コメント","コメント順位","マガジン","お気に入り","フォロー","通知","記事","アカウント切替","データ更新"]) assert.match(full,new RegExp(label));
});

test("likes keep avatars favorites and calendar filters", async () => {
  const full = await read("src/member-insight-unified-v4.tsx");
  const history = await read("supabase/functions/insight-member-history/index.ts");
  assert.match(full,/creator-icons/);
  assert.match(full,/favorite_toggle/);
  assert.match(full,/日ごと/);
  assert.match(full,/月ごと/);
  assert.match(full,/年ごと/);
  assert.match(history,/insight_fast_like_page_scoped_status/);
});

test("comments keep calendar thread search and heart-close state", async () => {
  const full = await read("src/member-insight-unified-v4.tsx");
  const extras = await read("supabase/functions/insight-member-extras/index.ts");
  for (const token of ["comment_articles","comments_filtered","コメント日","この日の記事すべて","名前・記事・コメント本文","heart_closed","♡で終了"]) assert.match(full,new RegExp(token));
  assert.match(extras,/npm:@supabase\/supabase-js@2\.112\.4/);
  assert.match(extras,/X-Insight-Token/);
});

test("comment ranking keeps initial article duplicate and final metrics", async () => {
  const full = await read("src/member-insight-unified-v4.tsx");
  for (const token of ["initial_comment_count","article_count","重複初手","最終コメント","commenter_comments"]) assert.match(full,new RegExp(token));
});

test("magazines and favorite reader keep JST calendar search", async () => {
  const full = await read("src/member-insight-unified-v4.tsx");
  for (const token of ["参加人数","フォロワー","記事数","magazine_articles","recentArticles","jstDay\\(a\\.publishAt\\)","favorite_articles","favorite_read_set","増減日","最終確認"]) assert.match(full,new RegExp(token));
});

test("notification UI separates reaction commerce membership buzz and magazine", async () => {
  const full = await read("src/member-insight-unified-v4.tsx");
  const notify = await read("supabase/functions/insight-notification-history-v2/index.ts");
  const ingest = await read("supabase/functions/insight-notification-ingest-v2/index.ts");
  for (const label of ["返信","コメント","スキ","購入","チップ","メンシプ","話題","マガジン","高評価"]) assert.match(full,new RegExp(label));
  assert.match(full,/プロフィール ↗/);
  assert.match(full,/記事を開く ↗/);
  assert.match(notify,/listCommentEvents/);
  assert.match(ingest,/classifier:"action-v3"/);
  assert.match(ingest,/メンバーシップに参加しました/);
  assert.match(ingest,/話題です/);
});

test("article archive keeps JST thumbnails and incremental rendering", async () => {
  const full = await read("src/member-insight-unified-v4.tsx");
  const thumbs = await read("supabase/functions/insight-article-thumbnails/index.ts");
  assert.match(full,/自分の記事・過去アーカイブ/);
  assert.match(full,/jstDay\(r\.publish_at\)/);
  assert.match(full,/insight-article-thumbnails/);
  assert.match(full,/さらに40件表示/);
  assert.match(thumbs,/X-Insight-Token/);
  assert.match(thumbs,/og:image/);
});

test("member sync discovers the full article catalog instead of stopping at 18", async () => {
  const api = await read("supabase/functions/insight-member-api/index.ts");
  const note = await read("supabase/functions/insight-member-api/note.ts");
  const backfill = await read("supabase/functions/insight-like-backfill/index.ts");
  assert.match(api,/syncArticleCatalog/);
  assert.match(api,/page<=200/);
  assert.match(api,/historyPage=3\+\(\(cursor-1\)%198\)/);
  assert.match(api,/catalog,/);
  assert.match(backfill,/discoverCatalog/);
  assert.match(backfill,/memberId/);
  assert.match(backfill,/page<=200/);
  assert.match(note,/per_page=100/);
  assert.match(note,/api\/v1\/note\/\$\{id\}\/likes/);
});

test("comment refresh still follows pending threads and nested replies", async () => {
  const api = await read("supabase/functions/insight-member-api/index.ts");
  const note = await read("supabase/functions/insight-member-api/note.ts");
  const scheduled = await read("supabase/functions/insight-comment-refresh/index.ts");
  assert.match(api,/p_status:"pending"/);
  assert.match(api,/refreshedCommentThreads/);
  assert.match(note,/latest_creator_reply/);
  assert.match(note,/parent_key=/);
  assert.match(scheduled,/insight_fast_comment_threads/);
});

test("personal notification pairing stays account-safe and note browsing stays passive", async () => {
  const pairing = await read("supabase/functions/insight-notification-import-token/index.ts");
  const ingest = await read("supabase/functions/insight-notification-ingest-v2/index.ts");
  const setup = await read("public/notification-import.html");
  const userScript = await read("public/note-insight-notification-sync.user.js");
  assert.match(pairing,/pair-exchange/);
  assert.match(ingest,/NOTIFICATION_ACCOUNT_MISMATCH/);
  assert.match(setup,/共通同期ツール v2\.7\.0/);
  assert.match(setup,/参加者ごとの専用ファイルは不要/);
  assert.match(setup,/本人通知を今すぐ同期/);
  assert.match(setup,/ダッシュボードを今すぐ同期/);
  assert.match(userScript,/@version\s+2\.7\.0/);
  assert.match(userScript,/TOKEN_PREFIX='mumei_insight_notification_sync_token_v2:'/);
  assert.match(userScript,/MUTE_PROFILE_PREFIX/);
  assert.match(userScript,/byName=profiles\.some/);
  assert.match(userScript,/isMagazineNotice\(text\)&&\(byLink\|\|byName\|\|byId\)/);
  assert.doesNotMatch(userScript,/statusDock/);
  assert.doesNotMatch(userScript,/data-sync-tab/);
  assert.doesNotMatch(userScript,/observe\(document\.documentElement/);
  assert.match(userScript,/rootObserver\.observe\(root,\{childList:true,subtree:true\}\)/);
  assert.match(userScript,/explicitNoticeSync/);
  assert.match(userScript,/if\(explicitNoticeSync\)/);
  assert.match(userScript,/collectHistoryManual/);
  assert.match(userScript,/box\.scrollTop=original/);
  assert.doesNotMatch(userScript,/preventDefault\(/);
  assert.doesNotMatch(userScript,/stopPropagation\(/);
});

test("dashboard sync v2.7 is explicit and has DOM fallback", async () => {
  const userScript = await read("public/note-insight-notification-sync.user.js");
  const dashboard = await read("supabase/functions/insight-dashboard-data/index.ts");
  assert.match(userScript,/isDashboardPage/);
  assert.match(userScript,/dashboardDomRows/);
  assert.match(userScript,/mumei_dashboard/);
  assert.match(userScript,/ダッシュボード統計を今すぐ同期/);
  assert.match(userScript,/syncDashboard\(true\)/);
  assert.doesNotMatch(userScript,/DASH_INTERVAL/);
  assert.doesNotMatch(userScript,/setInterval\([^)]*syncDashboard/);
  assert.match(dashboard,/insight_dashboard_snapshots/);
  assert.match(dashboard,/snapshotId/);
  assert.match(dashboard,/note-stats-api/);
});

test("access switching and PWA recovery remain intact", async () => {
  const access = await read("src/access-portal-v6.tsx");
  const main = await read("src/main.tsx");
  const sw = await read("public/sw.js");
  const recovery = await read("public/recovery.html");
  assert.match(access,/アカウント切替/);
  assert.doesNotMatch(access,/type="password"/);
  assert.match(main,/if \(pwaTopLaunch\)/);
  assert.match(sw,/mumei-note-insight-v31/);
  assert.doesNotMatch(sw,/client\.navigate/);
  assert.match(recovery,/getRegistrations/);
  assert.match(recovery,/caches\.delete/);
  assert.doesNotMatch(recovery,/localStorage\.clear/);
});
