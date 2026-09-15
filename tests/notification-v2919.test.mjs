import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const read=p=>readFile(new URL(`../${p}`,import.meta.url),"utf8");
const has=(text,items)=>{for(const x of items)assert.match(text,new RegExp(x.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")))};

test("V3.2.9 owns the only visible fixed dock and loads remote parts independently",async()=>{
  const v3=await read("public/note-insight-notification-v3.user.js"),dock=await read("public/note-insight-notification-dock-watch-v312.js"),reader=await read("public/note-insight-notification-reader-v322.js"),loader=await read("public/note-insight-notification-loader-v318.js");
  assert.match(v3,/@version\s+3\.2\.9/);
  has(v3,["mumei-v329-component-cache:","mumei-v3-rescue-dock-v329","grid-template-columns:repeat(4,minmax(0,1fr))","手動読み込み","フィルターOFF","INSIGHT","window.addEventListener('click',handleRescueClick,true)","window.__mumeiV3ParentDock=true","function startRescue()","async function loadPart(name)","runtime-checked-v329"]);
  assert.ok(v3.indexOf("loadPart('note-insight-notification-dock-watch-v312.js')")<v3.indexOf("loadPart('note-insight-notification-reader-v322.js')"));
  assert.ok(v3.indexOf("loadPart('note-insight-notification-reader-v322.js')")<v3.indexOf("loadPart('note-insight-notification-loader-v318.js')"));
  assert.doesNotMatch(v3.split("// ==/UserScript==")[0],/@require/);
  assert.match(v3,/@updateURL\s+https:\/\/raw\.githubusercontent\.com\/mumei-s\/note-insight\/main\/public\/note-insight-notification-v3\.user\.js/);
  has(dock,["__mumeiNotificationDock322","grid-template-columns:repeat(4,minmax(0,1fr))","data-act=\"settings\">設定","mumei-v3-read-request","touch-action:manipulation","window.addEventListener('click',onClick,true)"]);
  assert.doesNotMatch(dock,/pointerdown|pointerup|touch-action:none|srcdoc=/);
  has(reader,["__mumeiNotificationReader322","confirmedClientSignatures","mumei-v3-reader-status","sendBatch","rediscoverPanel"]);
  has(loader,["note-insight-dashboard-integrated-v318.js","mumei-dashboard-flow-v143"]);
});

test("notification filter settings stay on notification route",async()=>{
  const dock=await read("public/note-insight-notification-dock-watch-v312.js"),page=await read("public/notification-filter.html"),setup=await read("public/tool-setup.html");
  has(dock,["mumei_groups_sync","mumei_filter_reset","processFilterCommands","https://note.com/notifications","notification-filter.html"]);
  has(page,["https://note.com/notifications","mumei_return","通知フィルター設定"]);
  assert.doesNotMatch(setup,/通知フィルター設定|フィルターグループ|フィルターを全部解除/);
});

test("installer remains a slim update route",async()=>{
  const setup=await read("public/tool-setup.html"),top=await read("src/insight-top-install-v16.ts"),route=await read("src/insight-notification-update-route-v1.ts"),bridge=await read("public/note-insight-bridge.user.js");
  has(setup,["INSIGHT インストール / 更新","INSIGHTをインストール / 更新","更新されたか確認する","raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-notification-v3.user.js","https://note.com/notifications"]);
  assert.doesNotMatch(setup,/本人通知を実働確認|ダッシュボードを読み込む|Import from URL|script_installation\.php#url=/);
  has(top,["./tool-setup.html?from=top"]);has(route,["notification-update.html"]);has(bridge,["互換停止版"]);
});

test("release tracks V3.2.9",async()=>{
  const manifest=JSON.parse(await read("public/insight-release.json")),release=await read("src/insight-release.ts"),v3=await read("public/note-insight-notification-v3.user.js");
  assert.equal(manifest.appVersion,"2026.09.16.4");assert.equal(manifest.notificationVersion,"3.2.9");assert.equal(manifest.dashboardVersion,"1.4.4");
  assert.match(release,/CURRENT_INSIGHT_APP_VERSION = "2026\.09\.16\.4"/);assert.match(release,/CURRENT_NOTIFICATION_VERSION = "3\.2\.9"/);assert.match(v3,/@version\s+3\.2\.9/);
});

test("Dashboard and notification auth prefer explicit owner before stale member session",async()=>{
  const dash=await read("supabase/functions/insight-dashboard-import-token/index.ts"),notice=await read("supabase/functions/insight-notification-import-token/index.ts");
  for(const src of [dash,notice])assert.match(src,/if\(preferred==="owner"&&await owner\(req\)\)return ownerIdentity\(\);const p=await participant\(req\)/);
});

test("private notification categories stay dense while public duplicates are excluded",async()=>{
  const ui=await read("src/member-insight-notifications-final.tsx"),picker=await read("src/insight-notification-ui-v18.ts"),feed=await read("supabase/functions/insight-notification-feed-final/index.ts");
  has(ui,["reply_self","membership_join","purchase","tip","other"]);has(feed,["[\"like\",\"follow\",\"comment\",\"creator_article_posted\"]"]);has(picker,["スキ","人物フォロー","通常コメント","記事投稿"]);
});
