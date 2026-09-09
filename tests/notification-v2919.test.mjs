import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const read=p=>readFile(new URL(`../${p}`,import.meta.url),"utf8");

test("v2.9.57 bootstrap uses tab-first runtime and upward resume autoscan",async()=>{
  const boot=await read("public/note-insight-notification-sync.user.js"),bridge=await read("public/note-insight-notification-bootstrap-v2957.js");
  assert.match(boot,/@version\s+2\.9\.57/);
  assert.match(boot,/runtime-v2957\.js\?v=2957a/);
  assert.match(boot,/notification-autoscan-v2957\.js\?v=2957a/);
  assert.match(boot,/notification-bootstrap-v2957\.js\?v=2957a/);
  assert.equal((boot.match(/\/\/ @require\s+/g)||[]).length,3);
  assert.match(bridge,/async function openMatchingInsight\(\)/);
  assert.match(bridge,/const VERSION='2\.9\.57'/);
});

test("v2.9.57 runtime detects notification tabs and excludes DM/reactions",async()=>{
  const r=await read("public/note-insight-notification-runtime-v2957.js");
  assert.match(r,/const VERSION='2\.9\.57'/);
  assert.match(r,/function messagingContext\(\)/);
  assert.match(r,/function isNoticeTabText\(t\)/);
  assert.match(r,/function isNewsTabText\(t\)/);
  assert.match(r,/function findNoticeShell\(\)/);
  assert.match(r,/REACTION_RE/);
  assert.match(r,/スキした人/);
  assert.match(r,/リアクション一覧/);
  assert.match(r,/data-mumei-notice-shell-v2957/);
  assert.doesNotMatch(r,/setInterval\(/);
  assert.doesNotMatch(r,/capture:true/);
});

test("v2.9.57 autoscan resumes upward and stop saves checkpoint",async()=>{
  const r=await read("public/note-insight-notification-autoscan-v2957.js");
  for(const x of ["note-notification-resume-upward-v2957","前回の保存位置から上へ読込中","停止地点まで保存完了","次回ここから上へ","最新まで確認済み","resumeSignatureV2957","boundarySignature:newSig","FILTER_URL","location.assign(FILTER_URL)"])assert.match(r,new RegExp(x.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));
  assert.doesNotMatch(r,/querySelectorAll\('li,\[role="listitem"\],article,div'\)/);
});

test("installer and settings publish v2.9.57",async()=>{
  const update=await read("public/notification-update.html"),setup=await read("public/notification-setup.html");
  assert.match(update,/最新版 v2\.9\.57/);
  assert.match(update,/v2\.9\.57 をインストール／更新/);
  assert.match(update,/上方向（最新側）/);
  assert.match(setup,/最新版 v2\.9\.57/);
  assert.match(setup,/通知フィルター設定/);
  assert.match(setup,/上方向（最新側）/);
});

test("INSIGHT top is three compact pill controls with explicit update status",async()=>{
  const live=await read("src/member-insight-live-v2.tsx"),css=await read("src/member-insight-live-v2.css"),main=await read("src/main.tsx");
  assert.match(main,/import "\.\/insight-source-boundaries"/);
  for(const x of ["miv5-source-grid","✓ 通常データ","🔔 本人通知","📊 ダッシュボード","appUpdateAvailable","notificationUpdateAvailable","dashboardUpdateAvailable","manualDataRefresh","インストール / 更新"])assert.match(live,new RegExp(x.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));
  assert.doesNotMatch(live,/AUTO DATA SYNC/);
  assert.doesNotMatch(live,/↻ データ更新/);
  assert.match(css,/border-radius:999px/);
  assert.match(css,/miv5-source-card\.needs-update \.miv5-source-main/);
  assert.match(css,/miv5-install-link/);
});

test("ordinary INSIGHT entry stays at top while notification deep-link remains targeted",async()=>{
  const ux=await read("src/insight-source-boundaries.ts");
  for(const x of ["explicitNotificationEntry","mumei-insight-entry-at","openNormalTop","mumei-insight-open-mode","window.scrollTo({top:0","blurActive","app-bottom-nav button"])assert.match(ux,new RegExp(x.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));
  assert.match(ux,/q==="notifications"\|\|fresh/);
});

test("notifications are grouped by day, reclassified daily, and always show kaomoji markers",async()=>{
  const ux=await read("src/insight-source-boundaries.ts"),reclass=await read("supabase/functions/insight-notification-reclassify/index.ts"),ingest=await read("supabase/functions/insight-notification-ingest-v2/index.ts");
  for(const x of ["KAOMOJI","mumei-kaomoji","mumei-notification-day-heading","ensureDailyReclassify","insight-notification-reclassify","RECLASSIFY_DAY_KEY"])assert.match(ux,new RegExp(x.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));
  for(const x of ["event_day_jst","reclassify_pending","last_reclassified_at","daily-v1","nextType=type===\"other\""])assert.match(reclass,new RegExp(x.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));
  assert.match(ingest,/resume-upward-v\\d\+/);
  assert.match(ingest,/event_day_jst:eventDay/);
  assert.match(ingest,/reclassify_pending:type===\"other\"/);
});

test("Dashboard install and read controls stay available inside analysis",async()=>{
  const live=await read("src/member-insight-live-v2.tsx");
  assert.match(live,/miv5-dashboard-tools/);
  assert.match(live,/ダッシュボード同期/);
  assert.match(live,/同期ツールをインストール/);
  assert.match(live,/新しい公式値を読み込む/);
  assert.match(live,/dashboardHref/);
});

test("public data completeness is an 8-slot grid with two fixed and six selectable slots",async()=>{
  const c=await read("src/member-insight-completeness.tsx"),css=await read("src/member-insight-completeness.css");
  for(const x of ["GRID_KEY","DEFAULT_SLOTS","micmp-grid8","☰ 選択","⚠ 注意","表示する6枠","フォロー/フォロワー","PV・分析","mumei-insight-open-mode","公開データ確認済み","データ精度"])assert.match(c,new RegExp(x.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));
  assert.match(c,/CANDIDATE_IDS/);
  assert.match(css,/grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(css,/border-radius:999px/);
  assert.doesNotMatch(c,/DATA COMPLETENESS/);
});

test("TOP keeps saved login on URL/session check failure and compacts participant icons",async()=>{
  const hub=await read("src/hub-home-v2.tsx"),css=await read("src/hub-home-v2.css"),shim=await read("src/hub-home.tsx");
  assert.match(shim,/hub-home-v2/);
  assert.match(hub,/const OWNER_NOTE_ID = "ss_yr"/);
  assert.match(hub,/slice\(1, 5\)/);
  assert.match(hub,/slice\(5\)/);
  assert.match(hub,/hub-v2-primary/);
  assert.match(hub,/hub-v2-compact4/);
  assert.match(hub,/ほか \{rest\.length\}名を見る/);
  assert.match(hub,/ログイン情報は保持しています/);
  assert.match(hub,/forgetMemberSession\(activeAccount\.noteId\)/);
  assert.match(css,/grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(css,/hub-v2-more/);
});

test("analysis navigation is two-row visible and heavy graphs are collapsible",async()=>{
  const ux=await read("src/insight-source-boundaries.ts");
  assert.match(ux,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(ux,/詳細分析グラフを開く（流入・波形・星図）/);
  assert.doesNotMatch(ux,/const PANEL_ID=/);
  assert.doesNotMatch(ux,/function sourcePanel\(/);
});

test("release tracks are independent and current",async()=>{
  const manifest=JSON.parse(await read("public/insight-release.json")),release=await read("src/insight-release.ts"),dash=await read("public/note-insight-dashboard-sync.user.js");
  assert.equal(manifest.appVersion,"2026.09.09.9");
  assert.equal(manifest.notificationVersion,"2.9.57");
  assert.equal(manifest.dashboardVersion,"1.4.0");
  assert.match(release,/CURRENT_INSIGHT_APP_VERSION = "2026\.09\.09\.9"/);
  assert.match(release,/CURRENT_NOTIFICATION_VERSION = "2\.9\.57"/);
  assert.match(dash,/@version\s+1\.4\.0/);
});

test("Dashboard sync remains separate from本人通知 and rejects account mismatch",async()=>{
  const boot=await read("public/note-insight-dashboard-sync.user.js"),core=await read("public/note-insight-dashboard-sync-core-v1.1.0.js"),setup=await read("public/dashboard-setup.html"),api=await read("supabase/functions/insight-dashboard-data/index.ts");
  const dash=`${boot}\n${core}`;
  assert.match(boot,/@match\s+https:\/\/note\.com\/\*/);
  assert.match(dash,/DASHBOARD_ACCOUNT_MISMATCH/);
  assert.match(api,/noteId!==who\.noteId/);
  assert.match(setup,/Dashboard同期ツール v1\.4\.0/);
});

test("notification and social history server paths remain intact",async()=>{
  const ui=await read("src/member-insight-notifications-final.tsx"),social=await read("src/member-insight-social-v2.tsx"),live=await read("src/member-insight-live-v2.tsx"),comments=await read("src/member-insight-comments-final.tsx"),feed=await read("supabase/functions/insight-notification-feed-final/index.ts");
  for(const x of ["creator_article_posted","membership_join","other"])assert.match(ui,new RegExp(x));
  assert.match(social,/live_expected_count/);
  assert.match(live,/direction:"followers"/);
  assert.match(live,/direction:"followings"/);
  assert.match(comments,/全コメント・全返信/);
  assert.match(feed,/membership_join/);
});
