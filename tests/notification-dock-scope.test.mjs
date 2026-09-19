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

test("V3.2.88 loads bottom-up reader and fixed five-panel runtime",async()=>{
 const parent=await read("public/note-insight-notification-v3.user.js");
 const runtime=await read("public/note-insight-notification-runtime-v327.js");
 const checkpoint=await read("public/note-insight-notification-checkpoint-v325.js");
 const reader=await read("public/note-insight-notification-reader-v323.js");
 assert.match(parent,/@version\s+3\.2\.88/);
 assert.match(parent,/note-insight-notification-reader-v323\.js\?v=3258/);
 assert.match(parent,/note-insight-notification-checkpoint-v325\.js\?v=3250/);
 assert.match(parent,/note-insight-notification-runtime-v327\.js\?v=3288/);
 assert.doesNotMatch(parent,/note-insight-notification-dock-watch-v312\.js/);
 assert.match(parent,/bottom-up-saved-line-v3245/);
 assert.match(runtime,/grid-template-columns:minmax\(54px,.72fr\) minmax\(46px,.62fr\) minmax\(70px,1fr\) minmax\(48px,.66fr\) minmax\(68px,.9fr\)/);
 for(const act of ["read","mode","filter","settings","ins"])assert.match(runtime,new RegExp(`data-a=\\"${act}\\"`));
 assert.match(runtime,/AUTO='mumei_insight_notification_auto_v325:'/);
 assert.match(runtime,/autoMode=true/);
 assert.match(runtime,/dockVisible=want/);assert.match(runtime,/if\(!featureEnabled\)/);
 assert.match(runtime,/maybeAuto/);assert.match(runtime,/autoDoneForSession/);assert.doesNotMatch(runtime,/lastAutoAt/);
 assert.match(runtime,/mountUiInSurface/);assert.match(runtime,/shell&&shell\.isConnected/);assert.match(runtime,/leadDisplayName/);assert.match(runtime,/profileCandidates/);assert.match(runtime,/filterRows/);assert.match(runtime,/runPrimaryDockAction/);assert.match(runtime,/pointerdown/);assert.match(runtime,/pointerup/);assert.match(runtime,/stopImmediatePropagation/);assert.match(runtime,/leadCreatorId/);assert.match(runtime,/ids\.has\(lead\)/);assert.match(runtime,/notification-filter-settings\.html/);assert.match(runtime,/notificationAccount/);assert.match(runtime,/location\.replace\(u\.href\)/);assert.match(runtime,/openNotificationBell/);assert.match(runtime,/isNotificationOpen/);assert.match(runtime,/mumei_insight_notification_feature_enabled_v1/);assert.match(runtime,/setFeatureEnabled/);assert.match(runtime,/hideImmediately/);assert.match(runtime,/suppressUntilBell/);assert.match(runtime,/notificationLeaveAction/);assert.match(runtime,/onGlobalPointerDown/);assert.match(runtime,/function showRoot\(on\).*suppressUntilBell/);assert.match(runtime,/function onStatus\(e\).*suppressUntilBell/);assert.match(runtime,/function confirmHide\(\).*suppressUntilBell/);assert.doesNotMatch(runtime,/if\(on\)\{ensureRoot\(\)/);assert.doesNotMatch(runtime,/autoDoneForSession=false;markSurface\(null\);showRoot\(false\);cleanupVisuals\(\)/);assert.match(runtime,/safeScan/);assert.match(runtime,/event\?\.composedPath/);assert.match(runtime,/class\*="notification-item"/);assert.doesNotMatch(runtime,/new MutationObserver/);
 assert.match(runtime,/notification-filter-settings\.html/);assert.doesNotMatch(runtime,/通知フィルター登録|data-addg/);
 assert.doesNotMatch(runtime,/new MutationObserver/);
 assert.match(runtime,/__mumeiV3Checkpoint325\?\.restore/);
 assert.match(checkpoint,/mumei_insight_notification_checkpoint_local_v325:/);assert.match(checkpoint,/前回の保存位置を保持中｜全件再読込なし/);assert.doesNotMatch(checkpoint,/new MutationObserver/);assert.match(reader,/preserveBoundary/);assert.match(reader,/全件読み直しなし/);
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

test("reader saves a confirmed completion boundary and subsequent scans move upward from it",async()=>{
 const reader=await read("public/note-insight-notification-reader-v323.js");
 assert.match(reader,/boundarySignature:sig\(last\)/);
 assert.match(reader,/boundaryEventIdentity:last\.meta\?\.event_identity/);
 assert.match(reader,/boundaryLegacySignature:legacySig\(last\)/);
 assert.match(reader,/function boundaryMatch/);
 assert.match(reader,/reader-bottom-up-confirmed-v326/);
 assert.match(reader,/完了ラインから上方向へ、追加分だけ読み込みます/);
});

test("settings button opens the dedicated filter settings page and never uses the inline panel",async()=>{
 const runtime=await read("public/note-insight-notification-runtime-v327.js");
 const page=await read("public/notification-filter-settings.html");
 assert.match(runtime,/data-a="settings">設定<\/button>/);
 assert.match(runtime,/notification-filter-settings\.html/);assert.match(runtime,/notificationAccount/);assert.match(runtime,/location\.replace\(u\.href\)/);assert.doesNotMatch(runtime,/通知フィルター登録|data-addg/);
 assert.match(page,/noteの🔔通知へ戻る/);assert.match(page,/history\.pushState/);assert.match(page,/mumei_filter_return=bell/);assert.match(page,/return-bell/);assert.match(page,/return-ready/);assert.match(page,/className='summary'/);assert.match(page,/className='body'/);
 assert.doesNotMatch(runtime,/new MutationObserver/);
});

test("ingest token bridge is origin-locked",async()=>{
 const bridge=await read("public/notification-token-bridge.html");
 assert.match(bridge,/TARGET='https:\/\/note\.com'/);assert.match(bridge,/action:'issue'/);assert.doesNotMatch(bridge,/postMessage\([^\n]+,\s*['"]\*['"]\)/);
});

test("legacy notification runtime remains only a compatibility shim",async()=>{
 const runtime=await read("public/note-insight-notification-runtime-v2958.js");assert.match(runtime,/Compatibility shim only/);assert.doesNotMatch(runtime,/grid-template-columns|showDock|frameHtml/);
});