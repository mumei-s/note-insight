import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const read=(p)=>readFile(new URL(`../${p}`,import.meta.url),"utf8");

test("direct reader keeps checkpoint incremental behavior",async()=>{
 const reader=await read("public/note-insight-notification-reader-v323.js");
 assert.doesNotMatch(reader,/fallbackHtml|ensureFallback|mumei-notice-reader-v2963|contentDocument/);
 assert.match(reader,/incremental-top-to-checkpoint/);
 assert.match(reader,/ここまで保存済み/);
 assert.match(reader,/boundarySignature/);
 assert.match(reader,/MAX_SCROLL_STEPS/);
});

test("V3.2.31 loads the fixed five-panel runtime",async()=>{
 const parent=await read("public/note-insight-notification-v3.user.js");
 const runtime=await read("public/note-insight-notification-runtime-v327.js");
 const checkpoint=await read("public/note-insight-notification-checkpoint-v325.js");
 assert.match(parent,/@version\s+3\.2\.31/);
 assert.match(parent,/note-insight-notification-reader-v323\.js\?v=3231/);
 assert.match(parent,/note-insight-notification-checkpoint-v325\.js\?v=3231/);
 assert.match(parent,/note-insight-notification-runtime-v327\.js\?v=3231/);
 assert.doesNotMatch(parent,/note-insight-notification-dock-watch-v312\.js/);
 assert.match(parent,/fixed-five-dock-v3231/);
 assert.match(runtime,/grid-template-columns:minmax\(54px,.72fr\) minmax\(46px,.62fr\) minmax\(70px,1fr\) minmax\(48px,.66fr\) minmax\(68px,.9fr\)/);
 for(const act of ["read","mode","filter","settings","ins"])assert.match(runtime,new RegExp(`data-a=\\"${act}\\"`));
 assert.match(runtime,/AUTO='mumei_insight_notification_auto_v325:'/);
 assert.match(runtime,/autoMode=true/);
 assert.match(runtime,/maybeAuto/);
 assert.match(runtime,/safeScan/);
 assert.match(runtime,/__mumeiV3Checkpoint325\?\.restore/);
 assert.match(checkpoint,/mumei_insight_notification_checkpoint_local_v325:/);
});

test("five-panel dock stays fixed at the bottom and exposes auto on-off",async()=>{
 const runtime=await read("public/note-insight-notification-runtime-v327.js");
 assert.match(runtime,/position:fixed!important;left:8px!important;right:8px!important;bottom:calc\(env\(safe-area-inset-bottom,0px\) \+ 10px\)!important/);
 assert.match(runtime,/paintMode/);
 assert.match(runtime,/toggleMode/);
 assert.match(runtime,/autoMode\?'自動':'手動'/);
 assert.match(runtime,/自動読み込みON。タップで手動へ/);
 assert.match(runtime,/自動読み込みOFF。タップで自動へ/);
});

test("reader saves a confirmed boundary and subsequent scans use it",async()=>{
 const reader=await read("public/note-insight-notification-reader-v323.js");
 assert.match(reader,/boundarySignature:sig\(last\)/);
 assert.match(reader,/boundaryEventIdentity:last\.meta\?\.event_identity/);
 assert.match(reader,/boundaryLegacySignature:legacySig\(last\)/);
 assert.match(reader,/function boundaryMatch/);
 assert.match(reader,/checkpoint-stop-v3223/);
});

test("ingest token bridge is origin-locked",async()=>{
 const bridge=await read("public/notification-token-bridge.html");
 assert.match(bridge,/TARGET='https:\/\/note\.com'/);assert.match(bridge,/action:'issue'/);assert.doesNotMatch(bridge,/postMessage\([^\n]+,\s*['"]\*['"]\)/);
});

test("legacy notification runtime remains only a compatibility shim",async()=>{
 const runtime=await read("public/note-insight-notification-runtime-v2958.js");assert.match(runtime,/Compatibility shim only/);assert.doesNotMatch(runtime,/grid-template-columns|showDock|frameHtml/);
});
