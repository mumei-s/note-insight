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

test("V3.2.77 loads bottom-up reader and fixed five-panel runtime",async()=>{
 const parent=await read("public/note-insight-notification-v3.user.js");
 const runtime=await read("public/note-insight-notification-runtime-v327.js");
 const checkpoint=await read("public/note-insight-notification-checkpoint-v325.js");
 const reader=await read("public/note-insight-notification-reader-v323.js");
 assert.match(parent,/@version\s+3\.2\.77/);
 assert.match(parent,/note-insight-notification-reader-v323\.js\?v=3250/);
 assert.match(parent,/note-insight-notification-checkpoint-v325\.js\?v=3250/);
 assert.match(parent,/note-insight-notification-runtime-v327\.js\?v=3277/);
 assert.doesNotMatch(parent,/note-insight-notification-dock-watch-v312\.js/);
 assert.match(parent,/bottom-up-saved-line-v3245/);
 assert.match(runtime,/grid-template-columns:minmax\(54px,.72fr\) minmax\(46px,.62fr\) minmax\(70px,1fr\) minmax\(48px,.66fr\) minmax\(68px,.9fr\)/);
 for(const act of ["read","mode","filter","settings","ins"])assert.match(runtime,new RegExp(`data-a=\\"${act}\\"`));
 assert.match(runtime,/AUTO='mumei_insight_notification_auto_v325:'/);
 assert.match(runtime,/autoMode=true/);
 assert.match(runtime,/dockVisible=want/);assert.match(runtime,/if\(!featureEnabled\)/);
 assert.match(runtime,/maybeAuto/);assert.match(runtime,/autoDoneForSession/);assert.doesNotMatch(runtime,/lastAutoAt/);
 assert.match(runtime,/mountUiInSurface/);assert.match(runtime,/function independentDockHost\(\)/);assert.match(runtime,/leadDisplayName/);assert.match(runtime,/profileCandidates/);assert.match(runtime,/filterRows/);assert.match(runtime,/runDockAction/);assert.match(runtime,/pointerdown/);assert.match(runtime,/pointerup/);assert.match(runtime,/stopImmediatePropagation/);assert.match(runtime,/leadCreatorId/);assert.match(runtime,/ids\.has\(lead\)/);assert.match(runtime,/notification-filter-settings\.html/);assert.match(runtime,/notificationAccount/);assert.match(runtime,/location\.replace\(u\.href\)/);assert.match(runtime,/openNotificationBell/);assert.match(runtime,/isNotificationOpen/);assert.match(runtime,/mumei_insight_notification_feature_enabled_v1/);assert.match(runtime,/setFeatureEnabled/);assert.match(runtime,/hideImmediately/);assert.match(runtime,/suppressUntilBell/);assert.match(runtime,/notificationLeaveAction/);assert.match(runtime,/strongNoticeSurface/);assert.match(runtime,/trustedBellSurface/);assert.match(runtime,/autoDoneForSession=false;const openNow=Boolean\(findSurface\(\)\)\|\|notificationRoute\(\)/);assert.match(runtime,/textEditorElement/);assert.match(runtime,/editingOutsideNotification/);assert.match(runtime,/onEditorFocus/);assert.match(runtime,/noticeRows/);assert.doesNotMatch(runtime,/return shell&&visible\(shell\)\?shell:null/);assert.match(runtime,/for\(const type of\['pointerdown','mousedown','touchstart','click'\]\)/);assert.match(runtime,/function showRoot\(on\).*panelSessionActive/);assert.match(runtime,/function onStatus\(e\).*panelSessionActive/);assert.match(runtime,/function confirmHide\(\).*panelSessionActive/);assert.doesNotMatch(runtime,/if\(on\)\{ensureRoot\(\)/);assert.doesNotMatch(runtime,/autoDoneForSession=false;markSurface\(null\);showRoot\(false\);cleanupVisuals\(\)/);assert.match(runtime,/safeScan/);assert.match(runtime,/event\?\.composedPath/);assert.match(runtime,/class\*="notification-item"/);assert.doesNotMatch(runtime,/new MutationObserver/);
 assert.match(runtime,/notification-filter-settings\.html/);assert.doesNotMatch(runtime,/通知フィルター登録|data-addg/);
 assert.doesNotMatch(runtime,/new MutationObserver/);
 assert.match(runtime,/__mumeiV3Checkpoint325\?\.restore/);
 assert.match(checkpoint,/mumei_insight_notification_checkpoint_local_v325:/);assert.match(checkpoint,/前回の保存位置を保持中｜全件再読込なし/);assert.doesNotMatch(checkpoint,/new MutationObserver/);assert.match(reader,/preserveBoundary/);assert.match(reader,/collectRecentFallback/);assert.match(reader,/recent-fallback-from-saved-time/);assert.match(reader,/全件読み直しなし/);
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
 assert.match(page,/noteの🔔通知へ戻る/);assert.match(page,/history\.pushState/);assert.match(page,/mumei_settings_return/);assert.doesNotMatch(page,/return-bell|return-ready/);assert.doesNotMatch(runtime,/mumei_open_filter_settings|settingsRouteRequest/);assert.match(page,/const NOTE='https:\/\/note\.com\/notifications'/);assert.match(page,/className='summary'/);assert.match(page,/className='body'/);
 assert.doesNotMatch(runtime,/new MutationObserver/);
});

test("ingest token bridge is origin-locked",async()=>{
 const bridge=await read("public/notification-token-bridge.html");
 assert.match(bridge,/TARGET='https:\/\/note\.com'/);assert.match(bridge,/action:'issue'/);assert.doesNotMatch(bridge,/postMessage\([^\n]+,\s*['"]\*['"]\)/);
});

test("legacy notification runtime remains only a compatibility shim",async()=>{
 const runtime=await read("public/note-insight-notification-runtime-v2958.js");assert.match(runtime,/Compatibility shim only/);assert.doesNotMatch(runtime,/grid-template-columns|showDock|frameHtml/);
});

test("body-fixed notification dock cannot be reparented into note notification DOM",async()=>{
 const runtime=await read("public/note-insight-notification-runtime-v327.js");
 assert.match(runtime,/function independentDockHost\(\)/);
 assert.doesNotMatch(runtime,/shell\.appendChild\(r\)/);
 assert.doesNotMatch(runtime,/window\.addEventListener\('pointerdown',onShellPointerDown,true\)/);
 assert.match(runtime,/stopImmediatePropagation/);
});


test("notification dock lifecycle is isolated from note notification DOM",async()=>{
  const runtime=await read("public/note-insight-notification-runtime-v327.js");
  assert.match(runtime,/HOST='mumei-v325-dock-host'/);
  assert.match(runtime,/function independentDockHost\(\)/);
  assert.match(runtime,/panelSessionActive/);
  assert.match(runtime,/function panelEvent\(e\)/);
  assert.doesNotMatch(runtime,/shell\.appendChild\(r\)/);
  assert.match(runtime,/if\(panelEvent\(e\)\)return/);
  assert.match(runtime,/if\(panelSessionActive\)\{if\(shell&&!shell\.isConnected\)markSurface\(null\);showRoot\(false\);cleanupVisuals\(\);return\}/);
});


test("dock event ownership stays inside the independent host",async()=>{
  const runtime=await read("public/note-insight-notification-runtime-v327.js");
  assert.match(runtime,/HOST='mumei-v325-dock-host'/);
  assert.match(runtime,/function independentDockHost\(\)/);
  assert.match(runtime,/function panelEvent\(e\)/);
  assert.match(runtime,/for\(const type of\['pointerdown','mousedown','touchstart','click'\]\)/);
  assert.doesNotMatch(runtime,/window\.addEventListener\('touchstart',onSettingsPressStart,true\)/);
  assert.doesNotMatch(runtime,/shell\.appendChild\(r\)/);
});


test("article return position is owned only by Reader, never Runtime",async()=>{
  const runtime=await read("public/note-insight-notification-runtime-v327.js");
  const reader=await read("public/note-insight-notification-reader-v323.js");
  assert.doesNotMatch(runtime,/NAV_RETURN|saveArticleReturn|resumeArticleReturn|pendingReturn|returnSourceHere/);
  assert.match(reader,/NAV_RETURN='mumei-v3-notification-return-v3223'/);
  assert.match(reader,/function saveReturnPosition\(/);
  assert.match(reader,/function restoreReturnPosition\(/);
});

test("dock state survives navigation but UI is visible only on notification context",async()=>{
  const runtime=await read("public/note-insight-notification-runtime-v327.js");
  assert.match(runtime,/function notificationVisibleNow\(\)/);
  assert.match(runtime,/panelSessionActive&&notificationVisibleNow\(\)/);
  assert.match(runtime,/if\(suppressUntilBell\)\{showRoot\(false\);return\}/);
  assert.match(runtime,/if\(panelSessionActive\)\{if\(shell&&!shell\.isConnected\)markSurface\(null\);showRoot\(false\);cleanupVisuals\(\);return\}/);
  assert.doesNotMatch(runtime,/if\(panelSessionActive\)\{if\(shell&&!shell\.isConnected\)markSurface\(null\);showRoot\(true\);return\}/);
});


test("recovery invariants keep dock scoped and persist visible rows first",async()=>{
  const runtime=await read("public/note-insight-notification-runtime-v327.js");
  const reader=await read("public/note-insight-notification-reader-v323.js");
  const page=await read("public/notification-filter-settings.html");
  assert.match(runtime,/function notificationVisibleNow\(\)/);assert.match(runtime,/notificationSurfaceLeaseUntil/);assert.match(runtime,/notificationSurfaceLeaseRoute/);
  assert.doesNotMatch(runtime,/bellIntent\(\)\|\|returnRestoring/);
  assert.doesNotMatch(runtime,/saveArticleReturn|resumeArticleReturn|pendingReturn|returnSourceHere/);
  assert.match(runtime,/sessionStorage\.removeItem\('mumei-v3-notification-return-v3223'\)/);
  assert.match(page,/const NOTE='https:\/\/note\.com\/notifications'/);
  assert.doesNotMatch(page,/history\.back\(/);
  assert.match(reader,/function visiblePending\(p,saved\)/);
  assert.match(reader,/const immediate=visiblePending\(p,saved\)/);
  assert.match(reader,/count\+=await sendBatch\(immediate,a,saved\)/);
});


test("manual read explicitly separates continuation from full-history recovery",async()=>{
 const runtime=await read("public/note-insight-notification-runtime-v327.js");
 const reader=await read("public/note-insight-notification-reader-v323.js");
 assert.match(runtime,/READ_MENU='mumei-v325-read-choice'/);
 assert.match(runtime,/続きから読む/);assert.match(runtime,/全読み/);
 assert.match(runtime,/safeScan\(mode='continue'\)/);
 assert.match(runtime,/safeScan\('continue'\)/);
 assert.doesNotMatch(runtime,/maybeAuto[\s\S]{0,900}safeScan\('full'\)/);
 assert.match(reader,/async function scanContinue\(\)/);
 assert.match(reader,/async function scanFull\(\)/);
 assert.match(reader,/full-history-repair/);assert.match(reader,/manual-full-history-v1/);
 assert.match(reader,/sendBatchFull\(readOutbox\(a\.id\),a,saved\)/);
 assert.match(reader,/lastFullScanAt/);
});


test("reader rediscovery never treats an arbitrary creator page as notification surface",async()=>{
  const reader=await read("public/note-insight-notification-reader-v323.js");
  assert.match(reader,/function readerNotificationRoute\(\)/);
  assert.match(reader,/function readerNoticeContainer\(el\)/);
  assert.match(reader,/\[role="dialog"\],\[role="menu"\],\[popover\],\[class\*="notification" i\],\[class\*="notice" i\]/);
  assert.doesNotMatch(reader,/for\(const el of document\.querySelectorAll\('\[role="dialog"\],\[role="menu"\],\[popover\],aside,section,main,\[role="main"\]'\)\)/);
});


test("notifications route bypasses popup/session suppression and always shows the dock",async()=>{
  const runtime=await read("public/note-insight-notification-runtime-v327.js");
  assert.match(runtime,/function showRoot\(on\)\{const routeOn=notificationRoute\(\)/);
  assert.match(runtime,/routeOn\|\|\(panelSessionActive&&notificationVisibleNow\(\)\)/);
  assert.match(runtime,/async function inspect\(\)\{[\s\S]*if\(notificationRoute\(\)\)\{[\s\S]*showRoot\(true\)/);
  assert.match(runtime,/if\(notificationRoute\(\)\)\{[\s\S]*showRoot\(true\);[\s\S]*scheduleInspect\(20\)/);
});
