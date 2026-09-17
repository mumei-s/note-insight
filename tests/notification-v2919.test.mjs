import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const read=p=>readFile(new URL(`../${p}`,import.meta.url),"utf8");
const has=(text,items)=>{for(const x of items)assert.match(text,new RegExp(x.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")))};

test("V3.2.27 loads reader, persistent checkpoint, stable compact runtime and fallback dock",async()=>{
  const v3=await read("public/note-insight-notification-v3.user.js"),runtime=await read("public/note-insight-notification-runtime-v327.js"),checkpoint=await read("public/note-insight-notification-checkpoint-v325.js"),dock=await read("public/note-insight-notification-dock-watch-v312.js"),reader=await read("public/note-insight-notification-reader-v323.js"),loader=await read("public/note-insight-notification-loader-v318.js");
  assert.match(v3,/@version\s+3\.2\.27/);
  assert.match(v3,/@require\s+https:\/\/raw\.githubusercontent\.com\/mumei-s\/note-insight\/main\/public\/note-insight-notification-reader-v323\.js\?v=3227/);
  assert.match(v3,/@require\s+https:\/\/raw\.githubusercontent\.com\/mumei-s\/note-insight\/main\/public\/note-insight-notification-checkpoint-v325\.js\?v=3227/);
  assert.match(v3,/@require\s+https:\/\/raw\.githubusercontent\.com\/mumei-s\/note-insight\/main\/public\/note-insight-notification-runtime-v327\.js\?v=3227/);
  assert.match(v3,/@require\s+https:\/\/raw\.githubusercontent\.com\/mumei-s\/note-insight\/main\/public\/note-insight-notification-dock-watch-v312\.js\?v=3227/);
  assert.doesNotMatch(v3,/surface-guard-v326/);
  has(v3,["mumei-notification-tool-version","mumei-notification-v3-loader","runtime-checked-v3227"]);
  has(runtime,["__mumeiNotificationRuntime327","mumei-v325-dock","data-a=\"mode\"","自動","手動","通知フィルター登録","function findSurface(","async function openSettings(","function scheduleHide(","function confirmHide(","mumei_insight_notification_auto_v325:"]);
  has(checkpoint,["mumei_insight_notification_checkpoint_local_v325:","localStorage.setItem","async function restore(","async function persist(","ここまで保存済み"]);
  assert.match(runtime,/window\.__mumeiNotificationDock322=true/);
  assert.doesNotMatch(runtime,/notification-filter\.html/);
  assert.match(dock,/VERSION='3\.2\.23'/);
  has(reader,["__mumeiNotificationReader323","__mumeiV3Reader323","readyToScan","confirmedClientSignatures","incremental-top-to-checkpoint","ここまで保存済み"]);
  assert.doesNotMatch(reader,/loadAbsoluteBottom|fullFallback/);
  has(loader,["note-insight-dashboard-integrated-v318.js","mumei-dashboard-flow-v143"]);
});

test("notification filter registration stays inline on the note notification surface",async()=>{
  const runtime=await read("public/note-insight-notification-runtime-v327.js"),page=await read("public/notification-filter.html"),setup=await read("public/tool-setup.html");
  has(runtime,["通知フィルター登録","async function openSettings(","GRP='mumei_insight_notification_groups_v1:'","MUT='mumei_insight_magazine_mute_ids_v5:'","FIL='mumei_insight_magazine_filter_enabled_v3:'"]);
  assert.doesNotMatch(runtime,/location\.(?:assign|replace)\([^\n]*notification-filter\.html/);
  has(page,["通知フィルター設定"]);
  assert.doesNotMatch(setup,/通知フィルター設定|フィルターグループ|フィルターを全部解除/);
});

test("installer remains a compact automatic-confirmation V3.2.27 update route",async()=>{
  const setup=await read("public/tool-setup.html"),top=await read("src/insight-top-install-v16.ts"),route=await read("src/insight-notification-update-route-v1.ts"),bridge=await read("public/note-insight-bridge.user.js");
  has(setup,["INSIGHT インストール / 更新","INSIGHTをインストール / 更新","本人通知 V3.2.27","この画面で更新結果を確認","mumei-s.github.io/note-insight/note-insight-notification-v3.user.js","mumei-notification-v3-loader","mumei-notification-tool-version","ユーザースクリプトの更新を確認","URLを貼り付ける操作はありません","確認ボタンも不要"]);
  assert.doesNotMatch(setup,/script_installation\.php#url=/);
  assert.doesNotMatch(setup,/本人通知を実働確認|ダッシュボードを読み込む|Import from URL|https:\/\/note\.com\/notifications|mumei_insight_version_check|2\.9\.27/);
  has(top,["./tool-setup.html?from=top"]);has(route,["notification-update.html"]);has(bridge,["互換停止版"]);
});

test("release tracks V3.2.27",async()=>{
  const manifest=JSON.parse(await read("public/insight-release.json")),release=await read("src/insight-release.ts"),v3=await read("public/note-insight-notification-v3.user.js");
  assert.equal(manifest.appVersion,"2026.09.17.2");assert.equal(manifest.notificationVersion,"3.2.27");assert.equal(manifest.dashboardVersion,"1.4.4");
  assert.match(release,/CURRENT_INSIGHT_APP_VERSION = "2026\.09\.17\.2"/);assert.match(release,/CURRENT_NOTIFICATION_VERSION = "3\.2\.27"/);assert.match(v3,/@version\s+3\.2\.27/);
});

test("Dashboard and notification auth prefer explicit owner before stale member session",async()=>{
  const dash=await read("supabase/functions/insight-dashboard-import-token/index.ts"),notice=await read("supabase/functions/insight-notification-import-token/index.ts");
  for(const src of [dash,notice])assert.match(src,/if\(preferred==="owner"&&await owner\(req\)\)return ownerIdentity\(\);const p=await participant\(req\)/);
});

test("private notification categories stay dense while public duplicates are excluded",async()=>{
  const ui=await read("src/member-insight-notifications-final.tsx"),picker=await read("src/insight-notification-ui-v18.ts"),feed=await read("supabase/functions/insight-notification-feed-final/index.ts");
  has(ui,["reply_self","membership_join","purchase","tip","other"]);has(feed,["[\"like\",\"follow\",\"comment\",\"creator_article_posted\"]"]);has(picker,["スキ","人物フォロー","通常コメント","記事投稿"]);
});