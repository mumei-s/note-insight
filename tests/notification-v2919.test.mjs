import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const read=p=>readFile(new URL(`../${p}`,import.meta.url),"utf8");
const has=(text,items)=>{for(const x of items)assert.match(text,new RegExp(x.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")))};

test("bottom-up notification core remains intact",async()=>{
  const boot=await read("public/note-insight-notification-sync.user.js"),bridge=await read("public/note-insight-notification-bootstrap-v2966.js"),safety=await read("public/note-insight-notification-filter-safety-v2961.js"),restore=await read("public/note-insight-notification-filter-restore-v2962.js"),reader=await read("public/note-insight-notification-autoscan-v2970.js");
  has(boot,["runtime-v2958.js?v=2970","notification-filter-safety-v2961.js?v=2970","notification-filter-restore-v2962.js?v=2970","notification-autoscan-v2970.js?v=2970","notification-bootstrap-v2966.js?v=2970"]);
  has(bridge,["async function openMatchingInsight()","notificationInstalled","notificationCheckedAt","recoverAlreadyOpenNotice"]);
  has(safety,["unsafeContainer","distinctNotificationDescendants","purgeLegacyThreeButton"]);
  has(restore,["mumei_filter_export","mumei_existing","normalizeGroups"]);
  has(reader,["verified-shell-bottom-to-top","confirmedClientSignatures","scrollHost","sendBatch","slice().reverse()","下から読込"]);
});

test("notification V3.1 is the single resilient remote-core loader",async()=>{
  const v3=await read("public/note-insight-notification-v3.user.js");
  assert.match(v3,/@name\s+無名S note INSIGHT 本人通知 V3/);
  assert.match(v3,/@version\s+3\.1\.0/);
  assert.match(v3,/@run-at\s+document-start/);
  has(v3,["note-insight-notification-runtime-v2958.js","note-insight-notification-autoscan-v2970.js","note-insight-notification-bootstrap-v2966.js","mumei-v3-notification-frame","mumei-v3-core-cache:","componentText","scheduleRetry","clearLegacyStatus","data-mumei-v3-neutralized"]);
  assert.doesNotMatch(v3,/\/\/ @require\s+/);
  assert.doesNotMatch(v3,/function loaderNotice\(/);
  assert.doesNotMatch(v3,/本人通知の接続に失敗しました/);
});

test("notification runtime stays scoped to the real notification UI",async()=>{
  const r=await read("public/note-insight-notification-runtime-v2958.js");
  has(r,["function messagingContext()","function findNoticeShell()","REACTION_RE","SHELL='mumei-notice-shell-v2958'","下から読込","フィルター設定","INSIGHT【通知】","前回保存ここまで"]);
  assert.doesNotMatch(r,/setInterval\(/);
  assert.match(r,/capture:true/);
});

test("notification install and settings have one canonical no-popup entry",async()=>{
  const setup=await read("public/notification-setup.html");
  has(setup,["3.1.0","note-insight-notification-v3.user.js","V3.1.0ファイルを保存","mumei_insight_version_check","notificationInstalled","通知フィルター設定","maybeVerify"]);
  assert.doesNotMatch(setup,/target="_blank"|window\.open\(/);
  for(const path of ["public/notification-update.html","public/notification-update-v29665.html","public/notification-update-v2966.html","public/notification-setup-v2966.html"]){const p=await read(path);assert.match(p,/notification-setup\.html/)}
});

test("filter settings restore existing entries and never hide list parents",async()=>{
  const page=await read("public/notification-filter.html"),restore=await read("public/note-insight-notification-filter-restore-v2962.js"),safety=await read("public/note-insight-notification-filter-safety-v2961.js");
  has(page,["登録済みをnoteから復元","プロフィールURL・記事URL・@ID・ID","mumei_existing","mergeGroups","削除せずマージ"]);
  has(restore,["mumei_existing","mumei_filter_export","mumei_insight_notification_groups_v1:","mumei_insight_magazine_mute_ids_v5:"]);
  has(safety,["distinctNotificationDescendants","el.classList.remove(HIDE)","purgeLegacyThreeButton"]);
  assert.doesNotMatch(safety,/classList\.add\(HIDE\)/);
});

test("notification history keeps one panel, shared date filter and all private categories",async()=>{
  const ui=await read("src/member-insight-notifications-final.tsx"),css=await read("src/member-insight-notifications-final.css"),enh=await read("src/insight-notification-enhancements-v17.ts"),feed=await read("supabase/functions/insight-notification-feed-final/index.ts");
  has(ui,["selectedDay","📅 表示日","全期間に戻す","reply_self","reply_other","membership_reaction_self","membership_reaction_joined","membership_join","purchase","tip","quote","other"]);
  has(css,["minf-date-filter","color-scheme:dark"]);
  has(enh,["mumei-notification-category-order-v17","HOLD_MS=520","bindCategoryReorder","saveOrder","長押しで並替"]);
  has(feed,["categoryCounts","membership_join","canonical-public-comments","comment_body"]);
});

test("TOP keeps the three source cards and one canonical install control per tool",async()=>{
  const live=await read("src/member-insight-live-v2.tsx"),top=await read("src/insight-top-install-v16.ts"),release=await read("src/insight-release.ts"),unified=await read("src/member-insight-unified-v4.tsx");
  has(live,["miv5-source-card normal","🔔 本人通知","📊 分析","🔎 詳細分析"]);
  has(top,["FINAL TOP: this is the only active TOP layout manager","grid-template-columns:repeat(3,minmax(0,1fr))","mumei-canonical-install","dashboard-setup.html","notification-update.html","インストール / 更新"]);
  has(release,["insight-notification-enhancements-v17","insight-top-install-v16","insight-update-guide-v18"]);
  has(unified,["アカウント切替","miu-topactions"]);
});

test("notification-free detail analysis remains independent and dense",async()=>{
  const detail=await read("public/install-free-analysis-v2.html");
  has(detail,["分析をすべて開く","分析をすべて収納","1記事あたり平均スキ数","1記事あたり平均コメント数","反応＝スキ＋コメント","recentSpark","cadenceChart","daysChart","hoursChart","wordsChart","evergreenChart","articlesChart","本人通知・Dashboard同期なし"]);
});

test("Dashboard analysis keeps Pro V3 safeguards and collapsible graphs",async()=>{
  const hub=await read("src/member-insight-analysis-hub.tsx"),pro=await read("src/member-insight-analytics-pro-v3.tsx"),css=await read("src/member-insight-analytics-pro-v3.css");
  has(hub,["公式Dashboard＋INSIGHT Pro分析","MemberInsightAnalyticsProV3","NOTIFICATION DEEP ANALYSIS","人物別反応","メンシプ","購入/支援"]);
  has(pro,["INSIGHT PRO ANALYTICS V3","PV>Impは集計範囲不一致として率計算しない","反応/1,000PV","本人通知 × PV クロス分析","記事総合ランキング","分析をすべて開く","すべて収納"]);
  has(css,[".mipro-fold",".mipro-scatter",".mipro-table"]);
});

test("release tracks agree on notification V3.1.0",async()=>{
  const manifest=JSON.parse(await read("public/insight-release.json")),release=await read("src/insight-release.ts"),dash=await read("public/note-insight-dashboard-sync.user.js");
  assert.equal(manifest.appVersion,"2026.09.13.5");
  assert.equal(manifest.notificationVersion,"3.1.0");
  assert.equal(manifest.dashboardVersion,"1.4.2");
  assert.match(release,/CURRENT_NOTIFICATION_VERSION = "3\.1\.0"/);
  assert.match(release,/CURRENT_DASHBOARD_VERSION = "1\.4\.2"/);
  assert.match(dash,/@version\s+1\.4\.3/);
});

test("Dashboard setup uses the release manifest and the canonical notification entry",async()=>{
  const boot=await read("public/note-insight-dashboard-sync.user.js"),core=await read("public/note-insight-dashboard-sync-core-v1.1.0.js"),setup=await read("public/dashboard-setup.html"),api=await read("supabase/functions/insight-dashboard-data/index.ts"),dash=`${boot}\n${core}`;
  assert.match(boot,/@match\s+https:\/\/note\.com\/\*/);
  assert.match(dash,/DASHBOARD_ACCOUNT_MISMATCH/);
  assert.match(api,/noteId!==who\.noteId/);
  has(setup,["Dashboard同期","本人通知","必要なのは","notification-setup.html","insight-release.json","notificationVersion","NOTIFY_VERSION","normalizeAccount","mumei_dashboard_pair","mumei_dashboard_sync","Android","iPhone / iPad","Userscripts","2つを確認してDashboardを読み込む"]);
  assert.doesNotMatch(setup,/2\.9\.62/);
  has(boot,["@grant        GM.xmlHttpRequest","const VERSION='1.4.2'","directPayload()","INSIGHTアカウント照合中"]);
});

test("notification and social history server paths remain intact",async()=>{
  const ui=await read("src/member-insight-notifications-final.tsx"),social=await read("src/member-insight-social-v2.tsx"),live=await read("src/member-insight-live-v2.tsx"),comments=await read("src/member-insight-comments-final.tsx"),feed=await read("supabase/functions/insight-notification-feed-final/index.ts");
  has(ui,["creator_article_posted","membership_join","other"]);
  assert.match(social,/live_expected_count/);
  assert.match(live,/direction:"followers"/);
  assert.match(live,/direction:"followings"/);
  assert.match(comments,/全コメント・全返信/);
  has(feed,["membership_join","canonical-public-comments","comment_body"]);
});
