import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("participant dashboard uses production unified INSIGHT v4 wrapper with all primary tabs", async () => {
  const app = await read("src/App.tsx");
  const live = await read("src/member-insight-live-v2.tsx");
  const full = await read("src/member-insight-unified-v4.tsx");
  assert.match(app, /MemberInsightLiveV2/);
  assert.match(live, /MemberInsightUnifiedV4 revision=\{revision\}/);
  assert.match(live, /MemberInsightCompleteness/);
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

test("comments keep original workflow and exact counterpart reply-heart overlay", async () => {
  const full = await read("src/member-insight-unified-v4.tsx");
  const final = await read("src/member-insight-comments-final.tsx");
  const extras = await read("supabase/functions/insight-member-extras/index.ts");
  const live = await read("src/member-insight-live-v2.tsx");
  for (const token of ["comment_articles","comments_filtered","コメント日","この日の記事すべて","名前・記事・コメント本文","heart_closed","♡で終了"]) assert.match(full,new RegExp(token));
  for (const token of ["要対応","未返信","相手返信","♡で終了","自分返信","comment_thread","insight-comment-hearts","counterpartHearted","返信への♡あり","返信への♡なし"]) assert.match(final,new RegExp(token));
  assert.match(live,/MemberInsightCommentsFinal/);
  assert.match(extras,/X-Insight-Token/);
});

test("comment ranking keeps initial article duplicate and final metrics", async () => {
  const full = await read("src/member-insight-unified-v4.tsx");
  for (const token of ["initial_comment_count","article_count","重複初手","最終コメント","commenter_comments"]) assert.match(full,new RegExp(token));
});

test("magazines and favorite reader keep JST calendar search", async () => {
  const full = await read("src/member-insight-unified-v4.tsx");
  for (const token of ["参加人数","フォロワー","記事数","magazine_articles","recentArticles","jstDay\\(a\\.publishAt\\)","favorite_articles","favorite_read_set"]) assert.match(full,new RegExp(token));
});

test("notification UI separates final categories and all merges canonical comments replies", async () => {
  const live = await read("src/member-insight-live-v2.tsx");
  const ui = await read("src/member-insight-notifications-final.tsx");
  const feed = await read("supabase/functions/insight-notification-feed-final/index.ts");
  const ingest = await read("supabase/functions/insight-notification-ingest-v2/index.ts");
  assert.match(live,/MemberInsightNotificationsFinal/);
  for (const label of ["人物フォロー","マガジンフォロー","自分の記事追加","マガジン記事追加","マガジン参加","メンシプ掲示板","メンシプ開始","プラン追加","メンシプ参加","購入","サポート","話題","高評価","ポイント","その他"]) assert.match(ui,new RegExp(label));
  assert.match(ui,/insight-notification-feed-final/);
  assert.match(feed,/insight_public_comments/);
  assert.match(feed,/not\("notification_type","in","\(comment,reply\)"\)/);
  assert.match(feed,/canonical-public-comments/);
  assert.match(ingest,/classifier:"action-v4-exact"/);
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
  const auth = await read("supabase/functions/insight-member-api/auth.ts");
  const note = await read("supabase/functions/insight-member-api/note.ts");
  const backfill = await read("supabase/functions/insight-like-backfill/index.ts");
  assert.match(api,/syncArticleCatalog/);
  assert.match(api,/syncArticleCatalog\(m\.noteId,dataMember,baseline\)/);
  assert.match(api,/page<=200/);
  assert.match(api,/historyPage=3\+\(\(cursor-1\)%198\)/);
  assert.match(api,/catalog,/);
  assert.match(auth,/noteId:String\(a\.note_id\)/);
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

test("social screen is one exact add remove timeline without current mode or dedicated resync", async () => {
  const app = await read("src/App.tsx");
  const live = await read("src/member-insight-live-v2.tsx");
  const css = await read("src/member-insight-live-v2.css");
  const social = await read("src/member-insight-social-v2.tsx");
  const events = await read("supabase/functions/insight-social-events/index.ts");
  const relations = await read("supabase/functions/insight-relations/index.ts");
  assert.match(app,/MemberInsightLiveV2/);
  assert.match(live,/MemberInsightSocialV2/);
  assert.match(live,/mode==="social"/);
  assert.match(css,/mode-social/);
  assert.match(css,/min-height:0!important/);
  assert.match(social,/フォロー・フォロワー増減/);
  assert.match(social,/"all","すべて"/);
  assert.match(social,/"added","【増】"/);
  assert.match(social,/"removed","【減】"/);
  assert.match(social,/相手 → 本人/);
  assert.match(social,/本人 → 相手/);
  assert.match(social,/<select value=\{page\}/);
  assert.doesNotMatch(social,/現在一覧|最新を再同期/);
  assert.match(social,/startsWith\("aggregate:"\)/);
  assert.match(events,/direction==="followers"\|\|direction==="followings"/);
  assert.match(relations,/complete/);
});

test("personal notification pairing stays account-safe and bell import stays explicit", async () => {
  const pairing = await read("supabase/functions/insight-notification-import-token/index.ts");
  const ingest = await read("supabase/functions/insight-notification-ingest-v2/index.ts");
  const setup = await read("public/notification-import.html");
  const userScript = await read("public/note-insight-notification-sync.user.js");
  assert.match(pairing,/pair-exchange/);
  assert.match(ingest,/NOTIFICATION_ACCOUNT_MISMATCH/);
  assert.match(setup,/共通同期ツール v2\.8\.2/);
  assert.match(setup,/新しい参加者が増えても作り直し不要/);
  assert.match(setup,/参加者ごとの専用ファイルは不要/);
  assert.match(setup,/表示中を取り込む/);
  assert.match(setup,/過去分を取り込む/);
  assert.match(setup,/iPhone Safariでの初回インストール/);
  assert.match(setup,/apps\.apple\.com\/jp\/app\/userscripts\/id1463298887/);
  assert.match(setup,/設定 → アプリ → Safari → 拡張機能 → Userscripts/);
  assert.match(setup,/コード画面まで開けているなら③までは成功/);
  assert.match(setup,/\.\/note-insight-notification-sync\.user\.js/);
  assert.match(userScript,/@version\s+2\.8\.2/);
  assert.match(userScript,/@grant\s+GM\.xmlHttpRequest/);
  assert.match(userScript,/@grant\s+GM\.getValue/);
  assert.match(userScript,/@grant\s+GM\.setValue/);
  assert.match(userScript,/@grant\s+GM\.deleteValue/);
  assert.doesNotMatch(userScript,/GM_getValue|GM_setValue|GM_deleteValue|GM_registerMenuCommand/);
  assert.match(userScript,/ensurePanelAction/);
  assert.match(userScript,/表示中を取り込む/);
  assert.match(userScript,/過去分を取り込む/);
  assert.match(userScript,/const ids=await muteIds\(accountId\),profiles=await muteProfiles\(accountId\)/);
  assert.doesNotMatch(userScript,/statusDock|data-sync-tab|explicitNoticeSync|mumei_notify/);
  assert.doesNotMatch(userScript,/observe\(document\.documentElement/);
  assert.match(userScript,/rootObserver\.observe\(root,\{childList:true,subtree:true\}\)/);
  assert.match(userScript,/collectHistoryManual/);
  assert.match(userScript,/box\.scrollTop=original/);
  assert.doesNotMatch(userScript,/preventDefault\(|stopPropagation\(/);
});

test("dashboard sync v2.8.2 only runs on official note dashboard", async () => {
  const userScript = await read("public/note-insight-notification-sync.user.js");
  const setup = await read("public/notification-import.html");
  const dashboard = await read("supabase/functions/insight-dashboard-data/index.ts");
  assert.match(setup,/https:\/\/note\.com\/sitesettings\/stats/);
  assert.doesNotMatch(setup,/https:\/\/note\.com\/stats["']/);
  assert.match(userScript,/startsWith\('\/sitesettings\/stats'\)/);
  assert.doesNotMatch(userScript,/startsWith\('\/stats'\)/);
  assert.match(userScript,/dashboardDomRows/);
  assert.match(userScript,/ensureDashboardAction/);
  assert.match(userScript,/📊 INSIGHTへ統計保存/);
  assert.match(userScript,/syncDashboard\(true\)/);
  assert.doesNotMatch(userScript,/DASH_INTERVAL/);
  assert.doesNotMatch(userScript,/setInterval\([^)]*syncDashboard/);
  assert.match(dashboard,/insight_dashboard_snapshots/);
  assert.match(dashboard,/snapshotId/);
  assert.match(dashboard,/note-stats-api/);
});

test("analysis final shows no decorative chart before real dashboard snapshots", async () => {
  const live = await read("src/member-insight-live-v2.tsx");
  const analysis = await read("src/member-insight-analytics-final.tsx");
  assert.match(live,/MemberInsightAnalyticsFinal/);
  assert.match(live,/✓ 分析表示中/);
  assert.match(analysis,/ダッシュボード統計がまだありません/);
  assert.match(analysis,/snapshotCount<2/);
  assert.match(analysis,/総VIEW推移/);
  assert.match(analysis,/総スキ推移/);
  assert.match(analysis,/総コメント推移/);
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