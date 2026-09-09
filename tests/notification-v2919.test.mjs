import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const read=p=>readFile(new URL(`../${p}`,import.meta.url),"utf8");

test("v2.9.54 bootstrap uses DM-safe runtime",async()=>{
  const boot=await read("public/note-insight-notification-sync.user.js");
  assert.match(boot,/@version\s+2\.9\.54/);
  assert.match(boot,/runtime-v2954\.js\?v=2954a/);
  assert.match(boot,/notification-autoscan-v2952\.js\?v=2952a/);
  assert.doesNotMatch(boot,/runtime-v2948\.js/);
  assert.equal((boot.match(/\/\/ @require\s+/g)||[]).length,2);
  assert.match(boot,/async function openMatchingInsight\(\)/);
});

test("v2.9.54 runtime is passive and never shows dock outside visible notification tabs",async()=>{
  const r=await read("public/note-insight-notification-runtime-v2954.js");
  assert.match(r,/const VERSION='2\.9\.54'/);
  assert.match(r,/function messagingContext\(\)/);
  assert.match(r,/function visibleNoticeContext\(\)/);
  assert.match(r,/t==='通知'/);
  assert.match(r,/t==='お知らせ'/);
  assert.match(r,/function shown\(el\)/);
  assert.match(r,/if\(!visibleNoticeContext\(\)\)return null/);
  assert.match(r,/function resetOutsideNotice\(\)/);
  assert.match(r,/document\.addEventListener\('click',clickHint,\{passive:true\}\)/);
  assert.doesNotMatch(r,/setInterval\(/);
  assert.doesNotMatch(r,/capture:true/);
});

test("lightweight autoscan keeps checkpoint automation without full div scan",async()=>{
  const r=await read("public/note-insight-notification-autoscan-v2952.js");
  for(const x of ["CHUNK_STEPS=1","yieldUi","ANCHOR_LIMIT=240","TIME_LIMIT=100","saved.has(s)","boundarySignature:newBoundary","confirmedClientSignatures","host.scrollTop=original","自動保存（前回まで）"])assert.match(r,new RegExp(x.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));
  assert.doesNotMatch(r,/querySelectorAll\('li,\[role="listitem"\],article,div'\)/);
  assert.doesNotMatch(r,/\bunread\b|aria-unread|is-unread/i);
});

test("installer and settings publish v2.9.54",async()=>{
  const update=await read("public/notification-update.html"),setup=await read("public/notification-setup.html");
  assert.match(update,/最新版 v2\.9\.54/);
  assert.match(update,/v2\.9\.54 をインストール／更新/);
  assert.match(update,/DM・メッセージ・投稿・プロフィール/);
  assert.match(setup,/最新版 v2\.9\.54/);
  assert.match(setup,/DM・メッセージ・投稿・プロフィール/);
});

test("INSIGHT top is three primary sources with versions and update badges",async()=>{
  const live=await read("src/member-insight-live-v2.tsx"),ux=await read("src/insight-source-boundaries.ts"),main=await read("src/main.tsx");
  assert.match(main,/import "\.\/insight-source-boundaries"/);
  for(const x of ["miv5-source-grid","✓ 通常データ","🔔 本人通知","📊 公式Dashboard分析","appUpdateAvailable","notificationUpdateAvailable","dashboardUpdateAvailable","↻ データ更新","本体更新"])assert.match(live,new RegExp(x.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));
  assert.doesNotMatch(live,/AUTO DATA SYNC/);
  assert.doesNotMatch(live,/miv5-release-alert/);
  assert.match(ux,/⚠️ 注意・説明/);
  assert.match(ux,/公開データ確認済み/);
  assert.match(ux,/データ精度/);
});

test("Dashboard install and read controls live inside Dashboard analysis",async()=>{
  const live=await read("src/member-insight-live-v2.tsx");
  assert.match(live,/miv5-dashboard-tools/);
  assert.match(live,/公式Dashboard同期/);
  assert.match(live,/同期ツールをインストール/);
  assert.match(live,/新しい公式値を読み込む/);
  assert.match(live,/dashboardHref/);
});

test("public data completeness is compact and opens real history tabs",async()=>{
  const c=await read("src/member-insight-completeness.tsx"),css=await read("src/member-insight-completeness.css");
  assert.match(c,/micmp-shortcuts/);
  for(const x of ["記事","スキ","コメント","フォロワー","フォロー",".miu-nav button"])assert.match(c,new RegExp(x.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));
  assert.doesNotMatch(c,/DATA COMPLETENESS/);
  assert.match(css,/grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
});

test("analysis navigation is two-row visible and heavy graphs are collapsible",async()=>{
  const ux=await read("src/insight-source-boundaries.ts");
  assert.match(ux,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(ux,/詳細分析グラフを開く（流入・波形・星図）/);
});

test("release tracks are independent and current",async()=>{
  const manifest=JSON.parse(await read("public/insight-release.json")),release=await read("src/insight-release.ts"),dash=await read("public/note-insight-dashboard-sync.user.js");
  assert.equal(manifest.appVersion,"2026.09.09.6");
  assert.equal(manifest.notificationVersion,"2.9.54");
  assert.equal(manifest.dashboardVersion,"1.4.0");
  assert.match(release,/CURRENT_INSIGHT_APP_VERSION = "2026\.09\.09\.6"/);
  assert.match(release,/CURRENT_NOTIFICATION_VERSION = "2\.9\.54"/);
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
