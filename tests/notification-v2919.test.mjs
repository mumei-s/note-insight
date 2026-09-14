import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const read=p=>readFile(new URL(`../${p}`,import.meta.url),"utf8");
const has=(text,items)=>{for(const x of items)assert.match(text,new RegExp(x.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")))};

test("bottom-up notification core remains intact",async()=>{
  const bridge=await read("public/note-insight-notification-bootstrap-v2966.js"),reader=await read("public/note-insight-notification-autoscan-v2970.js"),watch=await read("public/note-insight-notification-dock-watch-v312.js");
  has(bridge,["recoverAlreadyOpenNotice","wakeRuntime","data-mumei-v3-wakeup","knownNotificationRowsVisible"]);
  has(reader,["verified-shell-bottom-to-top","confirmedClientSignatures","scrollHost","sendBatch","slice().reverse()","下から読込"]);
  has(watch,["tryAutoStart","autoStarted=true","read.click()","scheduleAutoStart","mumeiDockVisible"]);
  assert.doesNotMatch(watch,/wakeRuntime|setTimeout\(pulse,180\)|function pulse\(/);
});

test("notification V3.1.5 wraps stable V3 core and adds dock recovery",async()=>{
  const v3=await read("public/note-insight-notification-v3.user.js"),fix=await read("public/note-insight-notification-v315-fix.js");
  assert.match(v3,/@version\s+3\.1\.5/);has(v3,["note-insight-notification-v315-fix.js?v=315","19b1beec55012b53bedcd93751af552f53c0cf8a/public/note-insight-notification-v3.user.js"]);
  has(fix,["const VERSION='3.1.5'","mumei_insight_version_check","loader-checked-v315","フィルター設定","INSIGHT【通知】","likelyBell","surfaceOpen","mumei-v3-notification-frame"]);
  assert.doesNotMatch(fix,/directPulseLoop|setTimeout\(directPulseLoop/);
});

test("notification runtime still exposes one four-control reading dock",async()=>{
  const r=await read("public/note-insight-notification-runtime-v2958.js");
  has(r,["grid-template-columns:repeat(4,minmax(0,1fr))","下から読込","フィルターOFF","フィルター設定","INSIGHT【通知】","前回保存ここまで"]);
});

test("one setup center directly opens userscripts and never uses the broken Tampermonkey intermediary",async()=>{
  const setup=await read("public/tool-setup.html"),top=await read("src/insight-top-install-v16.ts"),route=await read("src/insight-notification-update-route-v1.ts"),bridge=await read("public/note-insight-bridge.user.js");
  has(setup,["ONE SETUP CENTER","Android Edge","Android Firefox","Android Chrome / Yahoo","iPhone / iPad Safari","Mac Safari","PC Edge / Chrome / Firefox","Dashboard同期を直接インストール／更新","本人通知を直接インストール／更新","target=\"_blank\"","note-insight-dashboard-sync.user.js","note-insight-notification-v3.user.js","Import from URL","mumei-direct-install-pending","location.replace(back)"]);
  assert.doesNotMatch(setup,/script_installation\.php#url=|window\.open\(|ONE BRIDGE SETUP|Bridgeが実行されていません/);
  has(top,["./tool-setup.html?from=top","設定 / 更新","Dashboard同期ツール","本人通知ツール"]);has(route,["notification-update.html","miv5-source-card.notice"]);
  has(bridge,["互換停止版","@version      1.0.1","このBridgeは何も起動しません"]);
  assert.doesNotMatch(bridge,/note-insight-notification-v3\.user\.js|note-insight-dashboard-sync-core-v1\.1\.0\.js/);
});

test("legacy setup routes redirect while notification update uses dedicated recovery page",async()=>{
  for(const path of ["public/notification-setup.html","public/notification-update-v29665.html","public/notification-update-v2966.html","public/notification-setup-v2966.html","public/dashboard-setup.html"]){const p=await read(path);assert.match(p,/tool-setup\.html/)}
  const update=await read("public/notification-update.html");has(update,["本人通知 V3.1.5","インストール / 更新","Raw文字列","更新確認してINSIGHTへ戻る","raw.githubusercontent.com"]);
});

test("Dashboard and notification auth prefer explicit owner before stale member session",async()=>{
  const dash=await read("supabase/functions/insight-dashboard-import-token/index.ts"),notice=await read("supabase/functions/insight-notification-import-token/index.ts");
  for(const src of [dash,notice])assert.match(src,/if\(preferred==="owner"&&await owner\(req\)\)return ownerIdentity\(\);const p=await participant\(req\)/);
});

test("release tracks only the two active tools",async()=>{
  const manifest=JSON.parse(await read("public/insight-release.json")),release=await read("src/insight-release.ts"),dash=await read("public/note-insight-dashboard-sync.user.js"),v3=await read("public/note-insight-notification-v3.user.js");
  assert.equal(manifest.appVersion,"2026.09.14.8");assert.equal(manifest.notificationVersion,"3.1.5");assert.equal(manifest.dashboardVersion,"1.4.4");assert.equal(manifest.bridgeVersion,undefined);
  assert.doesNotMatch(release,/CURRENT_BRIDGE_VERSION|BRIDGE_VERSION_STORAGE_KEY|bridgeVersion/);assert.match(release,/CURRENT_NOTIFICATION_VERSION = "3\.1\.5"/);assert.match(release,/CURRENT_DASHBOARD_VERSION = "1\.4\.4"/);
  assert.match(dash,/@version\s+1\.4\.4/);assert.match(v3,/@version\s+3\.1\.5/);
});

test("private notification categories and dense analysis remain intact",async()=>{
  const ui=await read("src/member-insight-notifications-final.tsx"),pro=await read("src/member-insight-analytics-pro-v3.tsx"),detail=await read("public/install-free-analysis-v2.html");
  has(ui,["reply_self","reply_other","membership_reaction_self","membership_join","purchase","tip","quote","other"]);has(pro,["INSIGHT PRO ANALYTICS V3","反応/1,000PV","本人通知 × PV クロス分析","記事総合ランキング"]);has(detail,["1記事あたり平均スキ数","1記事あたり平均コメント数","本人通知・Dashboard同期なし"]);
});

test("notification and social history server paths remain intact",async()=>{
  const ui=await read("src/member-insight-notifications-final.tsx"),social=await read("src/member-insight-social-v2.tsx"),comments=await read("src/member-insight-comments-final.tsx"),feed=await read("supabase/functions/insight-notification-feed-final/index.ts");
  has(ui,["creator_article_posted","membership_join","other"]);assert.match(social,/live_expected_count/);assert.match(comments,/全コメント・全返信/);has(feed,["membership_join","canonical-public-comments","comment_body"]);
});
