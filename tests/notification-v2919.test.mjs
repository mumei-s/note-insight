import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const read=p=>readFile(new URL(`../${p}`,import.meta.url),"utf8");

test("v2.9.51 bootstrap loads core plus current-DOM automatic scanner",async()=>{
  const boot=await read("public/note-insight-notification-sync.user.js");
  assert.match(boot,/@version\s+2\.9\.51/);
  assert.match(boot,/runtime-v2948\.js\?v=2948a/);
  assert.match(boot,/notification-autoscan-v2951\.js\?v=2951a/);
  assert.equal((boot.match(/\/\/ @require\s+/g)||[]).length,2);
  assert.match(boot,/async function openMatchingInsight\(\)/);
  assert.match(boot,/u\.searchParams\.set\('account',a\.id\)/);
});

test("v2.9.51 auto scanner recognizes open full-page and popup notification lists",async()=>{
  const r=await read("public/note-insight-notification-autoscan-v2951.js");
  for(const x of ["MAX_STEPS=72","CHUNK_STEPS=6","yieldUi","fallbackRows(root)","commonAncestor(nodes)","document.scrollingElement","scrollHost(panel)","host.scrollTop=0","saved.has(s)","boundarySignature:newBoundary","confirmedClientSignatures","host.scrollTop=original","auto-saved-overlap-v2951","自動保存（前回まで）"])assert.match(r,new RegExp(x.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));
  assert.match(r,/SRC='note-notification-manual-sync-v2951'/);
  assert.match(r,/const globalRows=rows\(document\.body\)/);
  assert.doesNotMatch(r,/\bunread\b|aria-unread|is-unread/i);
});

test("notification core still owns filtering, marker and server-confirmed manual compatibility",async()=>{
  const r=await read("public/note-insight-notification-runtime-v2948.js");
  for(const x of ["SAVED='mumei_insight_notification_saved_v2919:'","CHECK='mumei_insight_notification_checkpoint_v2922:'","前回保存ここまで","filterOn=false","async function resetFilterSession(root)","function verifiedLeadCreatorId","confirmedClientSignatures"])assert.match(r,new RegExp(x.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));
  assert.doesNotMatch(r,/\bunread\b|aria-unread|is-unread/i);
});

test("notification installer and settings publish v2.9.51 and verify the running script",async()=>{
  const update=await read("public/notification-update.html"),setup=await read("public/notification-setup.html");
  assert.match(update,/最新版 v2\.9\.51/);
  assert.match(update,/window\.open\(SCRIPT,'mumei-notification-install'\)/);
  assert.match(update,/Date\.now\(\)-rawSince>1800/);
  assert.match(update,/Android Edge/);
  assert.match(setup,/最新版は v2\.9\.51/);
  assert.match(setup,/前回保存位置まで小分け自動走査/);
  assert.match(setup,/誤判定するケースを修正/);
});

test("INSIGHT separates normal refresh data from本人通知-only data",async()=>{
  const ux=await read("src/insight-source-boundaries.ts"),main=await read("src/main.tsx");
  assert.match(main,/import "\.\/insight-source-boundaries"/);
  for(const x of ["✓ 通常更新（INSIGHT本体）","🔔 本人通知で追加取得","公開記事","フォロー","フォロワー推移","通知履歴","メンシプ参加","掲示板返信","↻ 通常データを今すぐ更新"])assert.match(ux,new RegExp(x.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));
  assert.match(ux,/post\(MEMBER,"sync"/);
  assert.match(ux,/post\(RELATIONS,"sync",\{direction:"followers"\}/);
  assert.match(ux,/post\(RELATIONS,"sync",\{direction:"followings"\}/);
  assert.match(ux,/Dashboardの新しい値/);
  assert.match(ux,/本人通知とは別経路/);
});

test("analysis navigation is two-row visible and heavy graphs are collapsible",async()=>{
  const ux=await read("src/insight-source-boundaries.ts");
  assert.match(ux,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(ux,/全項目を2段表示・横スライド不要/);
  assert.match(ux,/詳細分析グラフを開く（流入・波形・星図）/);
  assert.match(ux,/mumei-overview-graphs-collapsed/);
});

test("release tracks are independent and current",async()=>{
  const manifest=JSON.parse(await read("public/insight-release.json")),release=await read("src/insight-release.ts"),dash=await read("public/note-insight-dashboard-sync.user.js");
  assert.equal(manifest.appVersion,"2026.09.09.2");
  assert.equal(manifest.notificationVersion,"2.9.51");
  assert.equal(manifest.dashboardVersion,"1.4.0");
  assert.match(release,/CURRENT_INSIGHT_APP_VERSION = "2026\.09\.09\.2"/);
  assert.match(release,/CURRENT_NOTIFICATION_VERSION = "2\.9\.51"/);
  assert.match(release,/CURRENT_DASHBOARD_VERSION = "1\.4\.0"/);
  assert.match(dash,/@version\s+1\.4\.0/);
});

test("Dashboard sync remains separate from本人通知 and rejects account mismatch",async()=>{
  const boot=await read("public/note-insight-dashboard-sync.user.js"),core=await read("public/note-insight-dashboard-sync-core-v1.1.0.js"),setup=await read("public/dashboard-setup.html"),api=await read("supabase/functions/insight-dashboard-data/index.ts");
  const dash=`${boot}\n${core}`;
  assert.match(boot,/@match\s+https:\/\/note\.com\/\*/);
  assert.match(boot,/HANDOFF_KEY='mumei-dashboard-handoff-v140'/);
  assert.match(dash,/DASHBOARD_ACCOUNT_MISMATCH/);
  assert.match(api,/purpose","note_dashboard_sync"/);
  assert.match(api,/noteId!==who\.noteId/);
  assert.match(setup,/Dashboard同期ツール v1\.4\.0/);
  assert.match(setup,/autoStart/);
});

test("notification UI keeps requested categories and unknown manual rows",async()=>{
  const ui=await read("src/member-insight-notifications-final.tsx"),ingest=await read("supabase/functions/insight-notification-ingest-v2/index.ts");
  for(const x of ["creator_article_posted","reply_self","reply_other","membership_reaction_self","membership_reaction_joined","magazine_join","membership_join","other"])assert.match(ui,new RegExp(x));
  assert.doesNotMatch(ingest,/if\(type==="other"\)\{skipped\+\+;continue\}/);
});

test("follow totals and history continue to refresh independently of本人通知",async()=>{
  const social=await read("src/member-insight-social-v2.tsx"),live=await read("src/member-insight-live-v2.tsx"),rel=await read("supabase/functions/insight-relations/index.ts");
  assert.match(social,/live_expected_count/);
  assert.match(live,/post\(RELATIONS,"sync",\{direction:"followers"\}/);
  assert.match(live,/post\(RELATIONS,"sync",\{direction:"followings"\}/);
  assert.match(rel,/relation-delta-fix/);
});

test("comment and membership history server paths remain intact",async()=>{
  const comments=await read("src/member-insight-comments-final.tsx"),feed=await read("supabase/functions/insight-notification-feed-final/index.ts"),migration=await read("supabase/migrations/20260907185100_notification_membership_exact_v5.sql");
  assert.match(comments,/全コメント・全返信/);
  assert.match(feed,/membership_reaction_self/);
  assert.match(feed,/membership_reaction_joined/);
  assert.match(feed,/membership_join/);
  assert.match(migration,/circle_plan_join/);
});