import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const read=(p)=>readFile(new URL(`../${p}`,import.meta.url),"utf8");

test("direct reader has no global fallback dock or legacy frame dependency",async()=>{
 const reader=await read("public/note-insight-notification-reader-v323.js");
 assert.doesNotMatch(reader,/fallbackHtml|ensureFallback|mumei-notice-reader-v2963|contentDocument/);
 assert.match(reader,/data-mumei-notice-shell-v3/);assert.match(reader,/incremental-top-to-checkpoint/);assert.match(reader,/ここまで保存済み/);assert.doesNotMatch(reader,/fullFallback|loadAbsoluteBottom/);
});

test("canonical dock remains bounded to the notification surface",async()=>{
 const panel=await read("public/note-insight-notification-dock-watch-v312.js");
 assert.match(panel,/__mumeiNotificationDock322/);assert.match(panel,/bellGraceUntil/);assert.match(panel,/bellGraceUntil=Date\.now\(\)\+7000/);assert.match(panel,/notificationRoute\(\)/);assert.doesNotMatch(panel,/ensureLauncher|bindDrag|srcdoc=/);
});

test("V3.2.29 delegates dock ownership to the canonical four-button dock",async()=>{
 const parent=await read("public/note-insight-notification-v3.user.js");
 const checkpoint=await read("public/note-insight-notification-checkpoint-v325.js");
 const dock=await read("public/note-insight-notification-dock-watch-v312.js");
 assert.match(parent,/@version\s+3\.2\.29/);
 assert.match(parent,/note-insight-notification-reader-v323\.js\?v=3229/);
 assert.match(parent,/note-insight-notification-checkpoint-v325\.js\?v=3229/);
 assert.match(parent,/note-insight-notification-dock-watch-v312\.js\?v=3229/);
 assert.doesNotMatch(parent,/note-insight-notification-runtime-v327\.js/);
 assert.doesNotMatch(parent,/surface-guard-v326/);
 assert.match(parent,/dock-4col-v3229/);
 assert.match(dock,/grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
 assert.match(dock,/data-act="read"/);assert.match(dock,/data-act="filter"/);assert.match(dock,/data-act="settings"/);assert.match(dock,/data-act="ins"/);
 assert.match(dock,/FILTER_BASE='https:\/\/mumei-s\.github\.io\/note-insight\/notification-filter\.html'/);
 assert.match(dock,/INSIGHT='https:\/\/mumei-s\.github\.io\/note-insight\/\?insightMode=notifications#dashboard'/);
 assert.match(checkpoint,/mumei_insight_notification_checkpoint_local_v325:/);
});

test("filter registration and read operations use one native click path without pointer interception",async()=>{
 const panel=await read("public/note-insight-notification-dock-watch-v312.js");
 assert.match(panel,/touch-action:manipulation/);assert.match(panel,/window\.addEventListener\('click',onClick,true\)/);assert.doesNotMatch(panel,/pointerdown|pointerup|touch-action:none/);assert.match(panel,/フィルター登録/);
});

test("filter and INSIGHT targets are explicit and never inherit a creator page",async()=>{
 const panel=await read("public/note-insight-notification-dock-watch-v312.js");
 assert.match(panel,/history\.replaceState\(history\.state,'','\/notifications'\)/);
 assert.match(panel,/FILTER_BASE='https:\/\/mumei-s\.github\.io\/note-insight\/notification-filter\.html'/);
 assert.match(panel,/INSIGHT='https:\/\/mumei-s\.github\.io\/note-insight\/\?insightMode=notifications#dashboard'/);
 assert.doesNotMatch(panel,/const INSIGHT=.*notification-entry\.html/);
});

test("ingest token bridge is origin-locked",async()=>{
 const bridge=await read("public/notification-token-bridge.html");
 assert.match(bridge,/TARGET='https:\/\/note\.com'/);assert.match(bridge,/action:'issue'/);assert.doesNotMatch(bridge,/postMessage\([^\n]+,\s*['"]\*['"]\)/);
});

test("legacy notification runtime remains only a compatibility shim",async()=>{
 const runtime=await read("public/note-insight-notification-runtime-v2958.js");assert.match(runtime,/Compatibility shim only/);assert.doesNotMatch(runtime,/grid-template-columns|showDock|frameHtml/);
});
