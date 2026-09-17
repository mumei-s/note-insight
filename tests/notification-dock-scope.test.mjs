import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const read=(p)=>readFile(new URL(`../${p}`,import.meta.url),"utf8");

test("direct reader has no global fallback dock or legacy frame dependency",async()=>{
 const reader=await read("public/note-insight-notification-reader-v323.js");
 assert.doesNotMatch(reader,/fallbackHtml|ensureFallback|mumei-notice-reader-v2963|contentDocument/);
 assert.match(reader,/data-mumei-notice-shell-v3/);assert.match(reader,/incremental-top-to-checkpoint/);assert.match(reader,/ここまで保存済み/);assert.doesNotMatch(reader,/fullFallback|loadAbsoluteBottom/);
});

test("compact launcher is bounded to the notification surface",async()=>{
 const panel=await read("public/note-insight-notification-dock-watch-v312.js");
 assert.match(panel,/__mumeiNotificationDock322/);assert.match(panel,/bellGraceUntil/);assert.match(panel,/bellGraceUntil=Date\.now\(\)\+7000/);assert.match(panel,/notificationRoute\(\)/);
 assert.match(panel,/mumei-v3-launcher-v330/);assert.match(panel,/mumei-v3-tray-v330/);assert.match(panel,/showLauncher\(open\)/);
 assert.doesNotMatch(panel,/srcdoc=/);
});

test("V3.2.30 uses the compact launcher with four actions",async()=>{
 const parent=await read("public/note-insight-notification-v3.user.js"),checkpoint=await read("public/note-insight-notification-checkpoint-v325.js"),dock=await read("public/note-insight-notification-dock-watch-v312.js");
 assert.match(parent,/@version\s+3\.2\.30/);
 assert.match(parent,/note-insight-notification-reader-v323\.js\?v=3230/);
 assert.match(parent,/note-insight-notification-checkpoint-v325\.js\?v=3230/);
 assert.match(parent,/note-insight-notification-dock-watch-v312\.js\?v=3230/);
 assert.doesNotMatch(parent,/note-insight-notification-runtime-v327\.js/);
 assert.match(parent,/compact-launcher-v3230/);
 assert.match(dock,/grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
 for(const act of ["read","filter","settings","ins"])assert.match(dock,new RegExp(`data-act=\\"${act}\\"`));
 assert.match(dock,/🔔 INSIGHT/);assert.match(dock,/追加読込/);assert.match(dock,/フィルター登録/);
 assert.match(dock,/FILTER_BASE='https:\/\/mumei-s\.github\.io\/note-insight\/notification-filter\.html'/);
 assert.match(dock,/INSIGHT='https:\/\/mumei-s\.github\.io\/note-insight\/\?insightMode=notifications#dashboard'/);
 assert.match(checkpoint,/mumei_insight_notification_checkpoint_local_v325:/);
});

test("launcher tap expands and long press moves without replacing the read label with an error",async()=>{
 const panel=await read("public/note-insight-notification-dock-watch-v312.js");
 assert.match(panel,/setTray\(!trayOpen\)/);assert.match(panel,/pointerdown/);assert.match(panel,/pointermove/);assert.match(panel,/450/);assert.match(panel,/savePos\(b\)/);
 assert.match(panel,/touch-action:none/);assert.match(panel,/touch-action:manipulation/);
 assert.doesNotMatch(panel,/textContent='読込部品エラー'/);
});

test("filter registration and INSIGHT targets are explicit",async()=>{
 const panel=await read("public/note-insight-notification-dock-watch-v312.js");
 assert.match(panel,/history\.replaceState\(history\.state,'','\/notifications'\)/);
 assert.match(panel,/notification-filter\.html/);assert.match(panel,/mumei_return/);
 assert.match(panel,/note-insight\/\?insightMode=notifications#dashboard/);
 assert.doesNotMatch(panel,/notification-entry\.html/);
});

test("ingest token bridge is origin-locked",async()=>{
 const bridge=await read("public/notification-token-bridge.html");
 assert.match(bridge,/TARGET='https:\/\/note\.com'/);assert.match(bridge,/action:'issue'/);assert.doesNotMatch(bridge,/postMessage\([^\n]+,\s*['"]\*['"]\)/);
});

test("legacy notification runtime remains only a compatibility shim",async()=>{
 const runtime=await read("public/note-insight-notification-runtime-v2958.js");assert.match(runtime,/Compatibility shim only/);assert.doesNotMatch(runtime,/grid-template-columns|showDock|frameHtml/);
});
