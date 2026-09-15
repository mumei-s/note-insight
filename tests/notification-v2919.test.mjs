import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const read=p=>readFile(new URL(`../${p}`,import.meta.url),"utf8");
const has=(text,items)=>{for(const x of items)assert.match(text,new RegExp(x.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")))};

test("V3.2.4 uses one visible dock and one direct reader with no legacy iframe path",async()=>{
  const v3=await read("public/note-insight-notification-v3.user.js"),dock=await read("public/note-insight-notification-dock-watch-v312.js"),reader=await read("public/note-insight-notification-reader-v322.js"),loader=await read("public/note-insight-notification-loader-v318.js");
  assert.match(v3,/@version\s+3\.2\.4/);
  has(v3,["note-insight-notification-dock-watch-v312.js","note-insight-notification-reader-v322.js","note-insight-notification-loader-v318.js"]);
  assert.doesNotMatch(v3.split("// ==/UserScript==")[0],/@require/);
  has(dock,["__mumeiNotificationDock322","grid-template-columns:repeat(4,minmax(0,1fr))","下から読込","フィルターOFF","フィルター設定","INSIGHT【通知】","mumei-v3-read-request","touch-action:manipulation","window.addEventListener('click',onClick,true)","blockNoticeNavigationWhileReading"]);
  assert.doesNotMatch(dock,/pointerdown|pointerup|touch-action:none|srcdoc=|ensureBackend|backendButton|mumei-v3-notification-frame.*contentDocument/);
  has(reader,["__mumeiNotificationReader322","verified-shell-bottom-to-top","confirmedClientSignatures","mumei-v3-reader-status","mumei-v3-reader-ready","sendBatch","scrollHost"]);
  has(loader,["const VERSION='3.2.4'","runtime-checked-v324","note-insight-dashboard-integrated-v318.js","mumei-dashboard-flow-v143"]);
});

test("notification filter commands are handled on note without passing taps through notification rows",async()=>{
  const dock=await read("public/note-insight-notification-dock-watch-v312.js"),page=await read("public/notification-filter.html");
  has(dock,["mumei_groups_sync","mumei_filter_reset","mumei_filter_export","processFilterCommands","touch-action:manipulation","stopImmediatePropagation","mumei_return","https://note.com/notifications"]);
  has(page,["https://note.com/notifications","mumei_return","mumei_groups_sync","mumei_filter_reset"]);
  assert.doesNotMatch(page,/function closePage\(\)\{if\(document\.referrer/);
});

test("one setup center uses one unified userscript and never requires Tampermonkey reinstall",async()=>{
  const setup=await read("public/tool-setup.html"),top=await read("src/insight-top-install-v16.ts"),route=await read("src/insight-notification-update-route-v1.ts"),bridge=await read("public/note-insight-bridge.user.js");
  has(setup,["INSIGHT かんたん設定","Android の Edge","通知＋ダッシュボードをインストール／更新","本人通知を実働確認／連携","note-insight-notification-v3.user.js","Tampermonkey自体を入れ直す必要はありません"]);
  assert.doesNotMatch(setup,/Import from URL|script_installation\.php#url=|window\.open\(/);
  has(top,["./tool-setup.html?from=top","設定 / 更新"]);has(route,["notification-update.html"]);has(bridge,["互換停止版","@version      1.0.1"]);
});

test("release tracks V3.2.4",async()=>{
  const manifest=JSON.parse(await read("public/insight-release.json")),release=await read("src/insight-release.ts"),v3=await read("public/note-insight-notification-v3.user.js");
  assert.equal(manifest.appVersion,"2026.09.15.5");assert.equal(manifest.notificationVersion,"3.2.4");assert.equal(manifest.dashboardVersion,"1.4.4");
  assert.match(release,/CURRENT_INSIGHT_APP_VERSION = "2026\.09\.15\.5"/);assert.match(release,/CURRENT_NOTIFICATION_VERSION = "3\.2\.4"/);assert.match(v3,/@version\s+3\.2\.4/);
});

test("Dashboard and notification auth prefer explicit owner before stale member session",async()=>{
  const dash=await read("supabase/functions/insight-dashboard-import-token/index.ts"),notice=await read("supabase/functions/insight-notification-import-token/index.ts");
  for(const src of [dash,notice])assert.match(src,/if\(preferred==="owner"&&await owner\(req\)\)return ownerIdentity\(\);const p=await participant\(req\)/);
});

test("private notification categories stay dense while public duplicates are excluded",async()=>{
  const ui=await read("src/member-insight-notifications-final.tsx"),picker=await read("src/insight-notification-ui-v18.ts"),feed=await read("supabase/functions/insight-notification-feed-final/index.ts");
  has(ui,["reply_self","reply_other","membership_reaction_self","membership_join","purchase","tip","quote","other"]);has(feed,["[\"like\",\"follow\",\"comment\",\"creator_article_posted\"]","canonical-public-comments"]);has(picker,["スキ","人物フォロー","通常コメント","記事投稿"]);
});
