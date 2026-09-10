import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const read=p=>readFile(new URL(`../${p}`,import.meta.url),"utf8");
const has=(text,items)=>{for(const x of items)assert.match(text,new RegExp(x.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")))};

test("v2.9.59 bootstrap uses refreshed notification runtime",async()=>{
  const boot=await read("public/note-insight-notification-sync.user.js"),bridge=await read("public/note-insight-notification-bootstrap-v2958.js");
  assert.match(boot,/@version\s+2\.9\.59/);has(boot,["runtime-v2958.js?v=2959a","notification-autoscan-v2958.js?v=2959a","notification-bootstrap-v2958.js?v=2959a"]);assert.equal((boot.match(/\/\/ @require\s+/g)||[]).length,3);has(bridge,["async function openMatchingInsight()","const VERSION='2.9.59'"]);
});

test("v2.9.59 runtime remains notification-only and compact",async()=>{
  const r=await read("public/note-insight-notification-runtime-v2958.js");has(r,["const VERSION='2.9.59'","function messagingContext()","function findNoticeShell()","REACTION_RE","スキした人","リアクション一覧","SHELL='mumei-notice-shell-v2958'","前回の続きから読込","フィルター設定","INSIGHT【通知】"]);for(const x of ["年月日指定","modeDate","rangePanel"])assert.doesNotMatch(r,new RegExp(x));assert.doesNotMatch(r,/setInterval\(/);assert.doesNotMatch(r,/capture:true/);
});

test("v2.9.59 autoscan resumes upward and saves the stop boundary",async()=>{
  const r=await read("public/note-insight-notification-autoscan-v2958.js");has(r,["note-notification-resume-upward-v2959","autoScan","前回保存位置から上へ読込中","停止地点まで保存","resumeSignatureV2959","FILTER_URL","location.assign(FILTER_URL)"]);for(const x of ["scanRange","modeDate","modeAll","年月日の範囲を確認してください","rangeFromV2958","rangeToV2958"])assert.doesNotMatch(r,new RegExp(x));
});

test("notification installer returns to INSIGHT and date filtering stays in INSIGHT",async()=>{
  const update=await read("public/notification-update.html"),setup=await read("public/notification-setup.html");has(update,["最新版 v2.9.59","v2.9.59 をインストール／更新","日付指定はINSIGHTの【通知】側","RAW_SCRIPT","raw.githubusercontent.com","mumei_insight_version_check"]);has(setup,["最新版 v2.9.59","通知フィルター設定","checked===VERSION","location.replace(back)","日付指定はINSIGHTの【通知】履歴側"]);
});

test("notification history keeps one shared date filter and all required categories",async()=>{
  const ui=await read("src/member-insight-notifications-final.tsx"),css=await read("src/member-insight-notifications-final.css"),feed=await read("supabase/functions/insight-notification-feed-final/index.ts");has(ui,["selectedDay","type=\"date\"","📅 表示日","全期間に戻す","この日付は下の全カテゴリ共通です。","reply_self","reply_other","membership_reaction_self","membership_reaction_joined","membership_join","purchase","tip","quote","other"]);has(css,["minf-date-filter","color-scheme:dark","grid-template-columns:minmax(150px,1fr) auto auto"]);has(feed,["function jstDay","selectedDay:day||null","dated=day?filtered.filter"]);
});

test("notification categories stay one panel and v14 adds persisted long-press reorder",async()=>{
  const ux11=await read("src/insight-ux-v11.ts"),mobile=await read("src/insight-mobile-v14.ts");has(ux11,["mumei-category-panel","mumei-category-toggle","mumei-category-open","mumeiSinglePanelBound","通知項目：","mumei-all-tab"]);for(const x of ["CAT_ORDER_KEY","mumei-moving","holdTimer"])assert.doesNotMatch(ux11,new RegExp(x));has(mobile,["mumei-notification-category-order-v14","HOLD_MS=520","bindCategoryReorder","saveOrder","applyCategoryOrder","mumei-cat-held","長押しで並替"]);
});

test("comment body recovery uses feed body, canonical comment history and delegated binding",async()=>{
  const old=await read("src/insight-ux-v12.ts"),mobile=await read("src/insight-mobile-v14.ts"),feed=await read("supabase/functions/insight-notification-feed-final/index.ts");has(old,["mumei-comment-body","コメント本文","返信本文","insight-comment-events"]);has(mobile,["bindCommentBody","ensureCommentBody","feedBodies","meta?.body","insight-comment-events","通常コメント履歴から照合","通知feedの保存本文","mumei-comment-open"]);has(feed,["mergeMeta","meta:mergeMeta","comment_body","meta?.body"]);
});

test("v15 TOP is normal-data, analysis, notification with detail beside account switch",async()=>{
  const live=await read("src/member-insight-live-v2.tsx"),mobile=await read("src/insight-mobile-v15.ts"),ux13=await read("src/insight-ux-v13.ts"),unified=await read("src/member-insight-unified-v4.tsx");has(live,["miv5-source-card normal","🔔 本人通知","📊 分析","🔎 詳細分析","manualDataRefresh","aria-label=\"連携データを更新\""]);has(mobile,["miv5-source-card.normal{display:grid","miv5-source-card.dashboard{display:grid","miv5-source-card.notice{display:grid","miv5-source-card.detail{display:none","grid-template-columns:repeat(3,minmax(0,1fr))","mumei-detail-analysis-proxy","mumei-public-refresh-proxy{display:none","mumei-top-tool-install","dashboard-setup.html","notification-update.html","インストール / 更新","INSIGHT本体を更新","@([A-Za-z0-9_-]+)"]);has(ux13,["📊 分析","Dashboard同期＋本人通知 必須","Dashboard分析はDashboard同期＋本人通知の2ツール必須"]);has(unified,["アカウント切替","miu-topactions"]);
});

test("public refresh remains abortable and cannot permanently disable the visible control",async()=>{
  const live=await read("src/member-insight-live-v2.tsx"),mobile=await read("src/insight-mobile-v14.ts"),detail=await read("public/install-free-analysis-v2.html");has(live,["AbortController","PUBLIC_SYNC_TIMEOUT","MANUAL_UI_TIMEOUT","publicSyncController","manualRefreshRunning","finally{manualRefreshRunning.current=false;setDataBusy(false)}"]);has(mobile,["source.click()","aria-busy","保存済みデータを維持して更新"]);has(detail,["watchdog=setTimeout","更新待ちを解除しました","busy=false;refresh.disabled=false"]);
});

test("notification-free detail analysis is compact, explicit and graphed",async()=>{
  const detail=await read("public/install-free-analysis-v2.html");has(detail,["<details class=\"section\"","分析をすべて開く","分析をすべて収納","1記事あたり平均スキ数","1記事あたり平均コメント数","1記事あたり平均反応数","平均反応数","反応＝スキ＋コメント","PVではありません","recentSpark","cadenceChart","daysChart","hoursChart","wordsChart","evergreenChart","articlesChart","overflow-x:hidden"]);
});

test("Dashboard analysis requires Dashboard sync plus notification while detail analysis stays separate",async()=>{
  const hub=await read("src/member-insight-analysis-hub.tsx"),ux13=await read("src/insight-ux-v13.ts"),live=await read("src/member-insight-live-v2.tsx");has(hub,["Dashboard同期＋本人通知の2つが必要","Dashboard分析の必須構成","公式Dashboard＋INSIGHT分析","NOTIFICATION DEEP ANALYSIS","人物別反応","メンシプ","購入/支援","topActorShare","kind:\"all\"","詳細分析"]);has(ux13,["Dashboard分析はDashboard同期＋本人通知の2ツール必須","旧v13の「本人通知なし/あり」2分岐DOM上書きは廃止"]);assert.doesNotMatch(ux13,/本人通知なしで読込/);assert.match(live,/MemberInsightAnalysisHub/);
});

test("ordinary INSIGHT entry stays at top while notification deep-link remains targeted",async()=>{
  const ux=await read("src/insight-source-boundaries.ts");has(ux,["explicitNotificationEntry","mumei-insight-entry-at","openNormalTop","mumei-insight-open-mode","window.scrollTo({top:0","blurActive","app-bottom-nav button"]);assert.match(ux,/q==="notifications"\|\|fresh/);
});

test("notifications remain grouped by day and exact-kind classification stays active",async()=>{
  const ux=await read("src/insight-source-boundaries.ts"),reclass=await read("supabase/functions/insight-notification-reclassify/index.ts"),ingest=await read("supabase/functions/insight-notification-ingest-v2/index.ts");has(ux,["KAOMOJI","mumei-kaomoji","mumei-notification-day-heading","ensureDailyReclassify","insight-notification-reclassify","RECLASSIFY_DAY_KEY"]);has(reclass,["event_day_jst","reclassify_pending","last_reclassified_at","daily-v2-exact-kind","nextType=type===\"other\""]);has(ingest,["resume-upward-v\\d+","event_day_jst:eventDay","classification-independent-v2","stableSemantic","storedSource","circle_plan_join","board_like_comment","board_reply_comment"]);
});

test("public completeness, saved login and participant presentation remain intact",async()=>{
  const c=await read("src/member-insight-completeness.tsx"),cc=await read("src/member-insight-completeness.css"),hub=await read("src/hub-home-v2.tsx"),hc=await read("src/hub-home-v2.css");has(c,["GRID_KEY","DEFAULT_SLOTS","micmp-grid8","☰ 選択","⚠ 注意","表示する6枠","フォロー/フォロワー","PV・分析","公開データ確認済み"]);assert.match(cc,/grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);has(hub,["const OWNER_NOTE_ID = \"ss_yr\"","slice(1, 5)","slice(5)","ログイン情報は保持しています"]);assert.match(hc,/grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
});

test("analysis navigation keeps heavy in-app graphs collapsible",async()=>{
  const ux=await read("src/insight-source-boundaries.ts");assert.match(ux,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);assert.match(ux,/詳細分析グラフを開く（流入・波形・星図）/);
});

test("release tracks are independent and current",async()=>{
  const manifest=JSON.parse(await read("public/insight-release.json")),release=await read("src/insight-release.ts"),dash=await read("public/note-insight-dashboard-sync.user.js");assert.equal(manifest.appVersion,"2026.09.11.1");assert.equal(manifest.notificationVersion,"2.9.59");assert.equal(manifest.dashboardVersion,"1.4.2");assert.match(release,/CURRENT_INSIGHT_APP_VERSION = "2026\.09\.11\.1"/);assert.match(release,/CURRENT_NOTIFICATION_VERSION = "2\.9\.59"/);assert.match(release,/CURRENT_DASHBOARD_VERSION = "1\.4\.2"/);assert.match(release,/import "\.\/insight-mobile-v15"/);assert.match(dash,/@version\s+1\.4\.3/);
});

test("Dashboard setup uses browser-specific panels and requires both tools",async()=>{
  const boot=await read("public/note-insight-dashboard-sync.user.js"),core=await read("public/note-insight-dashboard-sync-core-v1.1.0.js"),setup=await read("public/dashboard-setup.html"),api=await read("supabase/functions/insight-dashboard-data/index.ts");const dash=`${boot}\n${core}`;assert.match(boot,/@match\s+https:\/\/note\.com\/\*/);assert.match(dash,/DASHBOARD_ACCOUNT_MISMATCH/);assert.match(api,/noteId!==who\.noteId/);has(setup,["Dashboard同期ツール","本人通知ツール","2つを使用します","この端末で使うもの","iPhone / iPad Safari","iPhone / iPad の Chrome・Edge・Firefox","Mac Safari","PC Chrome / Edge / Firefox","Android","Userscripts","Tampermonkey","Dashboard同期を入れる","本人通知を入れる","2つを確認してDashboardを読み込む","normalizeAccount","mumei_dashboard_pair","mumei_dashboard_sync"]);assert.doesNotMatch(setup,/本人通知ツールは不要/);assert.doesNotMatch(setup,/本人通知追加.*任意/);has(boot,["@grant        GM.xmlHttpRequest","const VERSION='1.4.2'","directPayload()","INSIGHTアカウント照合中"]);
});

test("notification and social history server paths remain intact",async()=>{
  const ui=await read("src/member-insight-notifications-final.tsx"),social=await read("src/member-insight-social-v2.tsx"),live=await read("src/member-insight-live-v2.tsx"),comments=await read("src/member-insight-comments-final.tsx"),feed=await read("supabase/functions/insight-notification-feed-final/index.ts");has(ui,["creator_article_posted","membership_join","other"]);assert.match(social,/live_expected_count/);assert.match(live,/direction:"followers"/);assert.match(live,/direction:"followings"/);assert.match(comments,/全コメント・全返信/);has(feed,["membership_join","canonical-public-comments","comment_body"]);
});
