import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const read=p=>readFile(new URL(`../${p}`,import.meta.url),"utf8");

test("v2.9.58 bootstrap uses matching runtime and autoscan",async()=>{
  const boot=await read("public/note-insight-notification-sync.user.js"),bridge=await read("public/note-insight-notification-bootstrap-v2958.js");
  assert.match(boot,/@version\s+2\.9\.58/);
  assert.match(boot,/runtime-v2958\.js\?v=2958a/);
  assert.match(boot,/notification-autoscan-v2958\.js\?v=2958a/);
  assert.match(boot,/notification-bootstrap-v2958\.js\?v=2958a/);
  assert.equal((boot.match(/\/\/ @require\s+/g)||[]).length,3);
  assert.match(bridge,/async function openMatchingInsight\(\)/);
  assert.match(bridge,/const VERSION='2\.9\.58'/);
});

test("v2.9.58 runtime keeps notification-only detection and exposes range UI",async()=>{
  const r=await read("public/note-insight-notification-runtime-v2958.js");
  for(const x of ["const VERSION='2.9.58'","function messagingContext()","function findNoticeShell()","REACTION_RE","スキした人","リアクション一覧","SHELL='mumei-notice-shell-v2958'","modeResume","modeAll","modeDate","年月日指定","dateFrom","dateTo"])assert.match(r,new RegExp(x.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));
  assert.doesNotMatch(r,/setInterval\(/);
  assert.doesNotMatch(r,/capture:true/);
});

test("v2.9.58 autoscan supports resume upward, one-shot all, date range and stop-save",async()=>{
  const r=await read("public/note-insight-notification-autoscan-v2958.js");
  for(const x of ["note-notification-resume-upward-v2958","note-notification-manual-sync-v2958","scanResume","scanRange","mode==='all'","mode==='date'","前回保存位置から上へ読込中","一括読込","年月日の範囲を確認してください","停止地点まで保存","resumeSignatureV2958","rangeFromV2958","rangeToV2958","FILTER_URL","location.assign(FILTER_URL)"])assert.match(r,new RegExp(x.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));
  assert.doesNotMatch(r,/querySelectorAll\('li,\[role="listitem"\],article,div'\)/);
});

test("installer detects raw user.js and returns automatically to INSIGHT",async()=>{
  const update=await read("public/notification-update.html"),setup=await read("public/notification-setup.html");
  for(const x of ["最新版 v2.9.58","v2.9.58 をインストール／更新","RAW_SCRIPT","raw.githubusercontent.com","child.close()","finishToVerify","mumei_insight_version_check"])assert.match(update,new RegExp(x.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));
  for(const x of ["最新版 v2.9.58","通知フィルター設定","checked===VERSION","location.replace(back)","一括・年月日指定"])assert.match(setup,new RegExp(x.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));
});

test("INSIGHT compact UX removes top blank space, restores installers and keeps comment body disclosure",async()=>{
  const base=await read("src/insight-source-boundaries.ts"),ux11=await read("src/insight-ux-v11.ts"),ux12=await read("src/insight-ux-v12.ts"),ux13=await read("src/insight-ux-v13.ts");
  assert.match(base,/import "\.\/insight-ux-v11"/);
  assert.match(base,/import "\.\/insight-ux-v13"/);
  for(const x of ["mumei-history-frequency","mumei-notification-updated","grid-template-columns:repeat(3","grid-template-rows:repeat(2,34px)","mumei-all-tab","CAT_ORDER_KEY","長押しで並べ替え","mumei-comment-toggle","COMMENT_LABELS","mumei-comment-open"])assert.match(ux11,new RegExp(x.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));
  for(const x of ["mumei-comment-body","コメント内容","insight-comment-events","コメント履歴から本文を照合",".minf-main small{display:block!important"])assert.match(ux12,new RegExp(x.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));
  for(const x of ["height:fit-content!important","grid-template-rows:auto!important","miv5-install-link","インストール / 更新","📊 ダッシュボード","miah-dashboard-with-read"])assert.match(ux13,new RegExp(x.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));
});

test("Dashboard analysis is an explicit two-way split for notification-free and notification-added reads",async()=>{
  const hub=await read("src/member-insight-analysis-hub.tsx"),ux13=await read("src/insight-ux-v13.ts"),live=await read("src/member-insight-live-v2.tsx");
  for(const x of ["公式＋INSIGHT分析","本人通知なしで利用可能","本人通知も追加","NOTIFICATION DEEP ANALYSIS","人物別反応","メンシプ","購入・支援","時間帯・曜日","topActorShare","kind:\"all\""])assert.match(hub,new RegExp(x.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));
  for(const x of ["📊 本人通知なし","🔔 本人通知あり","本人通知なしで読込","本人通知ありで読込","scope=${scope}","auto=1","insightMode","同一アカウント照合だけ自動実行"])assert.match(ux13,new RegExp(x.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));
  assert.match(live,/MemberInsightAnalysisHub/);
  assert.doesNotMatch(live,/miv5-dashboard-tools/);
});

test("ordinary INSIGHT entry stays at top while notification deep-link remains targeted",async()=>{
  const ux=await read("src/insight-source-boundaries.ts");
  for(const x of ["explicitNotificationEntry","mumei-insight-entry-at","openNormalTop","mumei-insight-open-mode","window.scrollTo({top:0","blurActive","app-bottom-nav button"])assert.match(ux,new RegExp(x.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));
  assert.match(ux,/q==="notifications"\|\|fresh/);
});

test("notifications remain grouped by day, reclassified daily, and always show kaomoji markers",async()=>{
  const ux=await read("src/insight-source-boundaries.ts"),reclass=await read("supabase/functions/insight-notification-reclassify/index.ts"),ingest=await read("supabase/functions/insight-notification-ingest-v2/index.ts");
  for(const x of ["KAOMOJI","mumei-kaomoji","mumei-notification-day-heading","ensureDailyReclassify","insight-notification-reclassify","RECLASSIFY_DAY_KEY"])assert.match(ux,new RegExp(x.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));
  for(const x of ["event_day_jst","reclassify_pending","last_reclassified_at","daily-v1","nextType=type===\"other\""])assert.match(reclass,new RegExp(x.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));
  assert.match(ingest,/resume-upward-v\\d\+/);
  assert.match(ingest,/event_day_jst:eventDay/);
});

test("INSIGHT top remains three compact source controls with clear update state",async()=>{
  const live=await read("src/member-insight-live-v2.tsx"),css=await read("src/member-insight-live-v2.css"),ux13=await read("src/insight-ux-v13.ts");
  for(const x of ["miv5-source-grid","✓ 通常データ","🔔 本人通知","📊 分析","appUpdateAvailable","notificationUpdateAvailable","dashboardUpdateAvailable","manualDataRefresh"])assert.match(live,new RegExp(x.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));
  for(const x of ["📊 ダッシュボード","notification-update.html","dashboard-setup.html","インストール / 更新"])assert.match(ux13,new RegExp(x.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));
  assert.match(css,/miv5-source-card\.needs-update \.miv5-source-main/);
});

test("public data completeness remains 8-slot grid",async()=>{
  const c=await read("src/member-insight-completeness.tsx"),css=await read("src/member-insight-completeness.css");
  for(const x of ["GRID_KEY","DEFAULT_SLOTS","micmp-grid8","☰ 選択","⚠ 注意","表示する6枠","フォロー/フォロワー","PV・分析","公開データ確認済み"])assert.match(c,new RegExp(x.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));
  assert.match(css,/grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
});

test("TOP keeps saved login and compact participant icons",async()=>{
  const hub=await read("src/hub-home-v2.tsx"),css=await read("src/hub-home-v2.css"),shim=await read("src/hub-home.tsx");
  assert.match(shim,/hub-home-v2/);assert.match(hub,/const OWNER_NOTE_ID = "ss_yr"/);assert.match(hub,/slice\(1, 5\)/);assert.match(hub,/slice\(5\)/);assert.match(hub,/ログイン情報は保持しています/);assert.match(css,/grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
});

test("analysis navigation is two-row visible and heavy graphs are collapsible",async()=>{
  const ux=await read("src/insight-source-boundaries.ts");
  assert.match(ux,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(ux,/詳細分析グラフを開く（流入・波形・星図）/);
});

test("release tracks are independent and current",async()=>{
  const manifest=JSON.parse(await read("public/insight-release.json")),release=await read("src/insight-release.ts"),dash=await read("public/note-insight-dashboard-sync.user.js");
  assert.equal(manifest.appVersion,"2026.09.09.13");
  assert.equal(manifest.notificationVersion,"2.9.58");
  assert.equal(manifest.dashboardVersion,"1.4.1");
  assert.match(release,/CURRENT_INSIGHT_APP_VERSION = "2026\.09\.09\.13"/);
  assert.match(release,/CURRENT_NOTIFICATION_VERSION = "2\.9\.58"/);
  assert.match(release,/CURRENT_DASHBOARD_VERSION = "1\.4\.1"/);
  assert.match(dash,/@version\s+1\.4\.1/);
});

test("Dashboard sync is independent from本人通知, auto-checks account, and has no duplicate numbered flow",async()=>{
  const boot=await read("public/note-insight-dashboard-sync.user.js"),core=await read("public/note-insight-dashboard-sync-core-v1.1.0.js"),setup=await read("public/dashboard-setup.html"),api=await read("supabase/functions/insight-dashboard-data/index.ts");
  const dash=`${boot}\n${core}`;assert.match(boot,/@match\s+https:\/\/note\.com\/\*/);assert.match(dash,/DASHBOARD_ACCOUNT_MISMATCH/);assert.match(api,/noteId!==who\.noteId/);
  for(const x of ["Dashboard同期ツール v1.4.1","本人通知は不要です","本人通知なしで読み込む","本人通知ありで読み込む","アカウントを照合中","note側の読込パネルは正常時には表示しません"])assert.match(setup,new RegExp(x.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));
  assert.doesNotMatch(setup,/本人連携だけ実行/);assert.doesNotMatch(setup,/① Dashboard同期/);assert.doesNotMatch(setup,/② 本人連携/);assert.doesNotMatch(setup,/③ 今すぐ公式Dashboard/);
  for(const x of ["const VERSION='1.4.1'","installHideStyle(true)","INSIGHTアカウント照合中","通常時パネルは完全非表示"])assert.match(boot,new RegExp(x.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));
});

test("notification and social history server paths remain intact",async()=>{
  const ui=await read("src/member-insight-notifications-final.tsx"),social=await read("src/member-insight-social-v2.tsx"),live=await read("src/member-insight-live-v2.tsx"),comments=await read("src/member-insight-comments-final.tsx"),feed=await read("supabase/functions/insight-notification-feed-final/index.ts");
  for(const x of ["creator_article_posted","membership_join","other"])assert.match(ui,new RegExp(x));assert.match(social,/live_expected_count/);assert.match(live,/direction:"followers"/);assert.match(live,/direction:"followings"/);assert.match(comments,/全コメント・全返信/);assert.match(feed,/membership_join/);
});
