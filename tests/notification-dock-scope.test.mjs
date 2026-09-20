import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const read=(p)=>readFile(new URL(`../${p}`,import.meta.url),"utf8");

test("direct reader keeps bottom-up saved-line resume behavior",async()=>{
 const reader=await read("public/note-insight-notification-reader-v323.js");
 assert.doesNotMatch(reader,/fallbackHtml|ensureFallback|mumei-notice-reader-v2963|contentDocument/);
 assert.match(reader,/bottom-up-from-saved-line/);
 assert.match(reader,/saved-line-bottom-up-v324/);
 assert.match(reader,/ここまで保存済み/);
 assert.match(reader,/boundarySignature/);assert.match(reader,/findSavedRecoveryElement/);assert.match(reader,/reader-recovered-saved-v326/);
 assert.match(reader,/MAX_SEEK_STEPS/);
 assert.match(reader,/MAX_READ_STEPS/);
 assert.match(reader,/host\.scrollTop=Math\.max\(0,before-amount\)/);
});

test("V3.3.7 loads restored iframe dock and automatic stable reader",async()=>{
 const parent=await read("public/note-insight-notification-v3.user.js");
 const runtime=await read("public/note-insight-notification-runtime-v2958.js");
 const reader=await read("public/note-insight-notification-autoscan-v2970.js");
 assert.match(parent,/@version\s+3\.3\.7/);
 for(const part of ["note-insight-notification-runtime-v2958.js?v=3370","note-insight-notification-filter-restore-v2962.js?v=3370","note-insight-notification-autoscan-v2970.js?v=3370","note-insight-notification-filter-safety-v2961.js?v=3370","note-insight-notification-bootstrap-v2966.js?v=3370"])assert.ok(parent.includes(part));
 assert.doesNotMatch(parent,/note-insight-notification-runtime-v327\.js\?v=/);
 assert.match(runtime,/FRAME='mumei-v2948-frame'/);
 assert.match(runtime,/grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
 for(const label of ["下から読込","フィルターOFF","フィルター設定","INSIGHT【通知】"])assert.match(runtime,new RegExp(label));
 assert.match(runtime,/iframe/);assert.match(runtime,/srcdoc=frameHtml/);assert.match(runtime,/pointer-events:auto/);
 assert.match(reader,/actor_image_url:img/);assert.match(reader,/function scheduleAuto/);assert.match(reader,/void scan\(\)/);
 assert.match(reader,/historyComplete/);assert.match(reader,/REPAIR='mumei_insight_notification_avatar_repair_v337:'/);
 assert.match(reader,/for\(let i=0;i<500&&!stop;i\+\+\)/);assert.match(reader,/steps\+\+<600/);
});

test("five-panel dock stays fixed at the bottom and exposes auto on-off",async()=>{
 const runtime=await read("public/note-insight-notification-runtime-v327.js");
 assert.match(runtime,/position:fixed!important;left:8px!important;right:8px!important;bottom:calc\(env\(safe-area-inset-bottom,0px\) \+ 14px\)!important/);
 assert.match(runtime,/paintMode/);
 assert.match(runtime,/toggleMode/);
 assert.match(runtime,/autoMode\?'自動':'手動'/);
 assert.match(runtime,/自動読み込みON。タップで手動へ/);
 assert.match(runtime,/自動読み込みOFF。タップで自動へ/);
});

test("reader saves a confirmed completion boundary and subsequent scans move upward from it",async()=>{
 const reader=await read("public/note-insight-notification-reader-v323.js");
 assert.match(reader,/boundarySignature:sig\(last\)/);
 assert.match(reader,/boundaryEventIdentity:last\.meta\?\.event_identity/);
 assert.match(reader,/boundaryLegacySignature:legacySig\(last\)/);
 assert.match(reader,/function boundaryMatch/);
 assert.match(reader,/reader-bottom-up-confirmed-v326/);
 assert.match(reader,/保存済みラインから先頭まで追加分を確認します/);
});

test("settings button opens the dedicated filter settings page and never uses the inline panel",async()=>{
 const runtime=await read("public/note-insight-notification-runtime-v327.js");
 const page=await read("public/notification-filter-settings.html");
 assert.match(runtime,/data-a="settings">設定<\/button>/);
 assert.match(runtime,/notification-filter-settings\.html/);assert.match(runtime,/notificationAccount/);assert.match(runtime,/location\.replace\(u\.href\)/);assert.doesNotMatch(runtime,/通知フィルター登録|data-addg/);
 assert.match(page,/noteの🔔通知へ戻る/);assert.match(page,/history\.pushState/);assert.match(page,/https:\/\/note\.com\/\?mumei_filter_return=bell/);assert.doesNotMatch(page,/note\.com\/notifications/);assert.match(page,/className='summary'/);assert.match(page,/className='body'/);
 assert.doesNotMatch(runtime,/new MutationObserver/);
});

test("ingest token bridge is origin-locked",async()=>{
 const bridge=await read("public/notification-token-bridge.html");
 assert.match(bridge,/TARGET='https:\/\/note\.com'/);assert.match(bridge,/action:'issue'/);assert.doesNotMatch(bridge,/postMessage\([^\n]+,\s*['"]\*['"]\)/);
});

test("restored iframe runtime is the active tap-isolated dock",async()=>{
 const runtime=await read("public/note-insight-notification-runtime-v2958.js");
 assert.match(runtime,/const VERSION='3\.3\.7'/);
 assert.match(runtime,/function frameHtml/);assert.match(runtime,/showDock/);
 assert.match(runtime,/grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
 assert.doesNotMatch(runtime,/Compatibility shim only/);
});