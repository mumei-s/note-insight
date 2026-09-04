import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("participant dashboard uses calendar-first unified INSIGHT v4 without overview duplication", async () => {
  const app = await read("src/App.tsx");
  const live = await read("src/member-insight-live.tsx");
  const full = await read("src/member-insight-unified-v4.tsx");
  assert.match(app, /MemberInsightLive/);
  assert.match(app, /route === "dashboard"[\s\S]*MemberInsightLive/);
  assert.match(live, /MemberInsightUnifiedV4 revision=\{revision\}/);
  assert.match(full, /useState<Tab>\("likes"\)/);
  assert.doesNotMatch(full, /\["overview","概要"\]/);
  for (const label of ["スキ履歴", "スキ順位", "コメント", "コメント順位", "マガジン", "お気に入り", "フォロー", "通知", "記事", "アカウント切替", "データ更新"]) assert.match(full, new RegExp(label));
});

test("likes keep avatars, favorite stars, and day month year filters with missing-icon enrichment", async () => {
  const full = await read("src/member-insight-unified-v4.tsx");
  const history = await read("supabase/functions/insight-member-history/index.ts");
  assert.match(full, /creator-icons/);
  assert.match(full, /await enrich\(x\.rows\|\|\[\]\)/);
  assert.match(full, /loading="lazy" decoding="async"/);
  assert.match(full, /日ごと/);
  assert.match(full, /月ごと/);
  assert.match(full, /年ごと/);
  assert.match(full, /favorite_toggle/);
  assert.match(full, /row\.favorite\?"★":"☆"/);
  assert.match(history, /insight_fast_like_page_scoped_status/);
  assert.match(history, /insight_favorite_creators/);
});

test("comments support calendar to article list to thread search while keeping heart-close state", async () => {
  const full = await read("src/member-insight-unified-v4.tsx");
  const extras = await read("supabase/functions/insight-member-extras/index.ts");
  assert.match(full, /comment_articles/);
  assert.match(full, /comments_filtered/);
  assert.match(full, /コメント日/);
  assert.match(full, /この日の記事すべて/);
  assert.match(full, /名前・記事・コメント本文/);
  assert.match(full, /heart_closed/);
  assert.match(full, /♡で終了/);
  assert.match(extras, /npm:@supabase\/supabase-js@2\.112\.4/);
  assert.match(extras, /X-Insight-Token/);
});

test("comment ranking explains initial-comment and article-count mismatch", async () => {
  const full = await read("src/member-insight-unified-v4.tsx");
  assert.match(full, /miu-rank-metrics/);
  assert.match(full, /initial_comment_count/);
  assert.match(full, /article_count/);
  assert.match(full, /重複初手/);
  assert.match(full, /最終コメント/);
  assert.match(full, /commenter_comments/);
});

test("magazines show participants followers articles and JST calendar article search with cached fallback", async () => {
  const full = await read("src/member-insight-unified-v4.tsx");
  const history = await read("supabase/functions/insight-member-history/index.ts");
  assert.match(full, /参加人数/);
  assert.match(full, /フォロワー/);
  assert.match(full, /記事数/);
  assert.match(full, /magazine_articles/);
  assert.match(full, /記事日/);
  assert.match(full, /recentArticles/);
  assert.match(full, /jstDay\(a\.publishAt\)/);
  assert.match(full, /setArticleRows\(local\)/);
  assert.match(history, /insight_magazine_cache/);
});

test("favorite reader and social history both expose calendar search", async () => {
  const full = await read("src/member-insight-unified-v4.tsx");
  assert.match(full, /favorite_articles/);
  assert.match(full, /favorite_read_set/);
  assert.match(full, /投稿日/);
  assert.match(full, /loadArticles\(r,v,query\)/);
  assert.match(full, /既読にする/);
  assert.match(full, /未読に戻す/);
  assert.match(full, /social_changes/);
  assert.match(full, /増減日/);
  assert.match(full, /最終確認/);
});

test("notification V4 separates reaction commerce membership buzz and magazine and uses real comment actors", async () => {
  const full = await read("src/member-insight-unified-v4.tsx");
  const notify = await read("supabase/functions/insight-notification-history-v2/index.ts");
  const ingest = await read("supabase/functions/insight-notification-ingest-v2/index.ts");
  const migration = await read("supabase/migrations/20260904212500_notification_action_classifier_v2.sql");

  assert.match(full, /insight-notification-history-v2/);
  for (const label of ["返信", "コメント", "スキ", "購入", "チップ", "メンシプ", "話題", "マガジン", "高評価"]) assert.match(full, new RegExp(label));
  assert.match(full, /await enrich\(x\.rows\|\|\[\]\)/);
  assert.match(full, /プロフィール ↗/);
  assert.match(full, /記事を開く ↗/);
  assert.match(notify, /listCommentEvents/);
  assert.match(notify, /insight_public_comments/);
  assert.match(notify, /not\("parent_key","is",null\)/);
  assert.match(notify, /is\("parent_key",null\)/);
  assert.match(notify, /eq\("is_creator",false\)/);
  assert.match(notify, /public_comment_reply/);
  assert.match(notify, /public_comment_root/);
  assert.match(notify, /public-comment-summary%/);
  assert.match(notify, /actorNameFromText/);
  assert.match(ingest, /npm:@supabase\/supabase-js@2\.112\.4/);
  assert.match(ingest, /classifier:"action-v3"/);
  assert.match(ingest, /あなたの記事にスキしました/);
  assert.match(ingest, /メンバーシップに参加しました/);
  assert.match(ingest, /あなたの記事を高評価しました/);
  assert.match(ingest, /話題です/);
  assert.doesNotMatch(ingest, /if\(\/返信\/\.test\(t\)\)return"reply"/);
  assert.doesNotMatch(ingest, /if\(\/コメント\/\.test\(t\)\)return"comment"/);
  assert.match(migration, /src = 'public_watcher'/);
  assert.match(migration, /public-like%/);
  assert.match(migration, /member-public-watch/);
  assert.match(migration, /メンバーシップをはじめました/);
  assert.match(migration, /new\.notification_type := 'other'/);
});

test("article archive uses JST calendar matching and authenticated thumbnail cards", async () => {
  const full = await read("src/member-insight-unified-v4.tsx");
  const history = await read("supabase/functions/insight-member-history/index.ts");
  const thumbs = await read("supabase/functions/insight-article-thumbnails/index.ts");
  assert.match(full, /自分の記事・過去アーカイブ/);
  assert.match(full, /記事タイトルを検索/);
  assert.match(full, /jstDay\(r\.publish_at\)/);
  assert.match(full, /insight-article-thumbnails/);
  assert.match(full, /miu-self-article-grid/);
  assert.match(full, /さらに40件表示/);
  assert.match(thumbs, /X-Insight-Token/);
  assert.match(thumbs, /api\/v3\/notes/);
  assert.match(thumbs, /og:image/);
  assert.match(history, /limit\(1000\)/);
});

test("comments refresh recent and pending threads without rebuilding history", async () => {
  const api = await read("supabase/functions/insight-member-api/index.ts");
  const note = await read("supabase/functions/insight-member-api/note.ts");
  const scheduled = await read("supabase/functions/insight-comment-refresh/index.ts");
  const history = await read("supabase/functions/insight-member-history/index.ts");
  assert.match(api, /historyPage=3\+\(\(cursor-1\)%18\)/);
  assert.match(api, /p_status:"pending"/);
  assert.match(api, /refreshComments\.add\(row\.key\)/);
  assert.match(api, /refreshedCommentThreads/);
  assert.match(api, /x\.parent\?"reply":"comment"/);
  assert.match(note, /page<=20/);
  assert.match(note, /next_page/);
  assert.match(note, /latest_creator_reply/);
  assert.match(note, /commentText/);
  assert.match(note, /row\.comment\?\?row\.body\?\?row\.text/);
  assert.match(note, /parent_key=/);
  assert.match(scheduled, /latest_creator_reply/);
  assert.match(scheduled, /next_page/);
  assert.match(scheduled, /commentText/);
  assert.match(scheduled, /parent_key=/);
  assert.match(scheduled, /insight_fast_comment_threads/);
  assert.match(history, /noteId==="ss_yr"\?"owner"/);
  assert.match(history, /insight_fast_comment_threads/);
});

test("public comment and like notifications identify actors without private bell pairing", async () => {
  const api = await read("supabase/functions/insight-member-api/index.ts");
  const history = await read("supabase/functions/insight-member-history/index.ts");
  const full = await read("src/member-insight-unified-v4.tsx");
  assert.match(api, /actor_name:name/);
  assert.match(api, /member-public-watch/);
  assert.match(api, /さんが「\$\{art\.title\}」に\$\{x\.parent\?"返信":"コメント"\}しました/);
  assert.match(history, /\[m\.scope,m\.id\]/);
  assert.match(full, /r\.actor_name/);
});

test("personal notification pairing stays account-safe and note browsing stays passive", async () => {
  const pairing = await read("supabase/functions/insight-notification-import-token/index.ts");
  const ingest = await read("supabase/functions/insight-notification-ingest-v2/index.ts");
  const setup = await read("public/notification-import.html");
  const userScript = await read("public/note-insight-notification-sync.user.js");
  const live = await read("src/member-insight-live.tsx");
  assert.match(pairing, /authorized:true/);
  assert.match(pairing, /pairedState/);
  assert.match(pairing, /pairedExpiresAt/);
  assert.match(pairing, /pair-exchange/);
  assert.match(ingest, /NOTIFICATION_ACCOUNT_MISMATCH/);
  assert.match(ingest, /synced_note_id/);
  assert.match(setup, /本人通知は連携済みです/);
  assert.match(setup, /スキ・公開コメント・公開フォローは本人通知なしでもINSIGHTで追跡/);
  assert.match(setup, /v2\.5\.1/);
  assert.match(userScript, /@version\s+2\.5\.1/);
  assert.match(userScript, /\/api\/v2\/current_user/);
  assert.match(userScript, /TOKEN_PREFIX='mumei_insight_notification_sync_token_v2:'/);
  assert.match(userScript, /MUTE_PROFILE_PREFIX/);
  assert.match(userScript, /ensureMuteProfiles/);
  assert.match(userScript, /byName=profiles\.some/);
  assert.match(userScript, /isMagazineNotice\(text\)&&\(byLink\|\|byName\|\|byId\)/);
  assert.doesNotMatch(userScript, /observe\(document\.documentElement/);
  assert.match(userScript, /rootObserver\.observe\(root,\{childList:true,subtree:true\}\)/);
  assert.match(userScript, /originalTop/);
  assert.match(userScript, /box\.scrollTop=originalTop/);
  assert.match(userScript, /document\.body\|\|box===document\.documentElement/);
  assert.match(userScript, /if\(!bellLike\(target\)/);
  assert.doesNotMatch(userScript, /preventDefault\(/);
  assert.doesNotMatch(userScript, /stopPropagation\(/);
  assert.match(live, /QUIET_AFTER_INTERACTION_MS/);
  assert.match(live, /pointerdown/);
  assert.match(live, /touchstart/);
  assert.match(live, /scroll/);
});

test("access switching and browser history never use the profile code as a password", async () => {
  const access = await read("src/access-portal-v6.tsx");
  const main = await read("src/main.tsx");
  const app = await read("src/App.tsx");
  assert.match(access, /アカウント切替/);
  assert.match(access, /<em>\{current \? "使用中" : "切替"\}<\/em>/);
  assert.match(access, /機種変更・再ログイン/);
  assert.doesNotMatch(access, /type="password"/);
  assert.doesNotMatch(access, /コードでINSIGHTへログイン/);
  assert.match(main, /if \(pwaTopLaunch\)/);
  assert.doesNotMatch(main, /rawInitialRoute/);
  assert.match(app, /popstate/);
  assert.doesNotMatch(main, /localStorage\.removeItem\(INSIGHT_TOKEN_KEY\)/);
});

test("distribution remains browser-neutral and Edge can reset stale PWA cache without losing login storage", async () => {
  const manifest = JSON.parse(await read("public/manifest.webmanifest"));
  const sw = await read("public/sw.js");
  const recovery = await read("public/recovery.html");
  const setup = await read("public/notification-setup.html");
  assert.equal(manifest.id, "/note-insight/");
  assert.equal(manifest.scope, "/note-insight/");
  assert.match(manifest.start_url, /^\/note-insight\/\?launch=top$/);
  assert.match(sw, /mumei-note-insight-v31/);
  assert.doesNotMatch(sw, /client\.navigate/);
  assert.doesNotMatch(sw, /staleNotificationEntry/);
  assert.match(sw, /cache: "no-store"/);
  assert.match(recovery, /getRegistrations/);
  assert.match(recovery, /caches\.delete/);
  assert.doesNotMatch(recovery, /localStorage\.clear/);
  assert.match(setup, /from.*insight/);
});
