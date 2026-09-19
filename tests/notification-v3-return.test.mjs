import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const read=p=>readFile(new URL(`../${p}`,import.meta.url),"utf8");

test("installer entry redirects to isolated compact browser page",async()=>{
  const redirect=await read("public/tool-setup.html"),page=await read("public/notification-browser-install.html");
  assert.match(redirect,/notification-browser-install\.html/);
  assert.doesNotMatch(redirect,/Tampermonkey|Userscripts|ブラウザ別インストール/);
  assert.match(page,/mumei-installer-boundary/);
  assert.match(page,/INSIGHT インストール \/ 更新/);
  assert.match(page,/insight-release\.json/);
  assert.match(page,/Tampermonkey/);
  assert.match(page,/Userscripts/);
  assert.match(page,/Yahoo!ブラウザー/);
  assert.match(page,/data-browser="ios-safari"/);
  assert.match(page,/data-browser="android-edge"/);
  assert.match(page,/https:\/\/raw\.githubusercontent\.com\/mumei-s\/note-insight\/main\/public\/note-insight-notification-v3\.user\.js/);
  assert.doesNotMatch(page,/script_installation\.php#url=|本人通知 V\d|V3\.2\.69/);
});

test("V3.2.69 preloads bottom-up reader, checkpoint and fixed five-panel runtime",async()=>{
  const v3=await read("public/note-insight-notification-v3.user.js"),checkpoint=await read("public/note-insight-notification-checkpoint-v325.js"),runtime=await read("public/note-insight-notification-runtime-v327.js"),reader=await read("public/note-insight-notification-reader-v323.js");
  assert.match(v3,/@version\s+3\.2\.69/);assert.match(v3,/bottom-up-saved-line-v3245/);
  const meta=v3.split("// ==/UserScript==")[0];
  assert.match(meta,/note-insight-notification-reader-v323\.js\?v=3245/);assert.match(meta,/note-insight-notification-checkpoint-v325\.js\?v=3250/);assert.match(meta,/note-insight-notification-runtime-v327\.js\?v=3269/);assert.doesNotMatch(meta,/note-insight-notification-settings-route-v332\.js/);
  assert.doesNotMatch(meta,/note-insight-notification-dock-watch-v312\.js/);
  assert.match(runtime,/grid-template-columns:minmax\(54px,.72fr\) minmax\(46px,.62fr\) minmax\(70px,1fr\) minmax\(48px,.66fr\) minmax\(68px,.9fr\)/);
  for(const act of ["read","mode","filter","settings","ins"])assert.match(runtime,new RegExp(`data-a=\\"${act}\\"`));
  assert.match(runtime,/mountUiInSurface/);assert.match(runtime,/leadDisplayName/);assert.match(runtime,/profileCandidates/);assert.match(runtime,/filterRows/);assert.match(runtime,/runDockAction/);assert.match(runtime,/pointerdown/);assert.match(runtime,/pointerup/);assert.match(runtime,/leadCreatorId/);assert.match(runtime,/ids\.has\(lead\)/);assert.match(runtime,/mumei_insight_notification_auto_v325:/);assert.match(runtime,/event\?\.composedPath/);assert.doesNotMatch(runtime,/new MutationObserver/);assert.match(runtime,/openNotificationBell/);assert.match(runtime,/isNotificationOpen/);assert.match(runtime,/mumei_insight_notification_feature_enabled_v1/);assert.match(runtime,/setFeatureEnabled/);assert.match(runtime,/hideImmediately/);assert.match(runtime,/suppressUntilBell/);assert.match(runtime,/notificationLeaveAction/);assert.match(runtime,/strongNoticeSurface/);assert.match(runtime,/textEditorElement/);assert.match(runtime,/editingOutsideNotification/);assert.match(runtime,/onEditorFocus/);assert.match(runtime,/noticeRows/);assert.match(runtime,/for\(const type of\['pointerdown','mousedown','touchstart','click'\]\)/);assert.match(runtime,/function showRoot\(on\).*panelSessionActive/);assert.match(runtime,/function onStatus\(e\).*panelSessionActive/);assert.match(runtime,/function confirmHide\(\).*panelSessionActive/);assert.match(v3,/mumei_insight_return_bell_v1/);assert.match(v3,/new URL\('https:\/\/note\.com\/notifications'\)/);assert.doesNotMatch(v3,/api\.openNotificationBell\(\)\)clickedAt/);assert.match(v3,/mumei-notification-feature-ui-v1/);assert.match(v3,/mumei-notification-feature-bridge-v1/);assert.match(runtime,/notification-filter-settings\.html/);assert.match(runtime,/notificationAccount/);assert.match(runtime,/location\.replace\(u\.href\)/);assert.doesNotMatch(runtime,/通知フィルター登録|data-addg/);assert.doesNotMatch(runtime,/new MutationObserver/);
  assert.match(checkpoint,/mumei_insight_notification_checkpoint_local_v325:/);assert.match(checkpoint,/localStorage\.setItem/);assert.doesNotMatch(checkpoint,/new MutationObserver/);assert.match(reader,/checkpointFor/);assert.match(reader,/preserveBoundary/);assert.match(reader,/全件読み直しなし/);assert.match(reader,/bottom-up-from-saved-line/);assert.match(reader,/saved-line-bottom-up-v324/);
});

test("five-panel dock appears on the notification surface and auto mode runs scans",async()=>{
  const runtime=await read("public/note-insight-notification-runtime-v327.js");
  assert.match(runtime,/bottom:calc\(env\(safe-area-inset-bottom,0px\) \+ 10px\)!important/);
  assert.match(runtime,/async function activate\(next\)/);
  assert.match(runtime,/showRoot\(true\)/);
  assert.match(runtime,/maybeAuto\(\)/);assert.match(runtime,/autoDoneForSession/);
  assert.match(runtime,/async function safeScan\(\)/);
  assert.match(runtime,/__mumeiV3Checkpoint325\?\.restore\?\.\(\)/);
});

test("auto mode is saved per note account and can be switched off",async()=>{
  const runtime=await read("public/note-insight-notification-runtime-v327.js");
  assert.match(runtime,/AUTO='mumei_insight_notification_auto_v325:'/);
  assert.match(runtime,/autoMode=id\?Boolean\(await get\(AUTO\+id,true\)\):true/);
  assert.match(runtime,/autoMode=!autoMode/);
  assert.match(runtime,/await set\(AUTO\+id,autoMode\)/);
  assert.match(runtime,/自動読み込みON。タップで手動へ/);
  assert.match(runtime,/自動読み込みOFF。タップで自動へ/);
});

test("completion line is the only resume boundary and next read moves upward from it",async()=>{
  const reader=await read("public/note-insight-notification-reader-v323.js");
  assert.match(reader,/saved-line-bottom-up-v324/);
  assert.match(reader,/boundarySignature/);
  assert.match(reader,/boundaryEventIdentity/);
  assert.match(reader,/function boundaryMatch/);assert.match(reader,/findSavedRecoveryElement/);assert.match(reader,/persistRecoveredBoundary/);
  assert.match(reader,/ここまで保存済み/);
  assert.match(reader,/完了ラインから上方向へ、追加分だけ読み込みます/);
  assert.match(reader,/host\.scrollTop=Math\.max\(0,before-amount\)/);
});

test("INSIGHT notifications keep one category selector",async()=>{
  const ui=await read("src/insight-notification-ui-v18.ts"),release=await read("src/insight-release.ts");
  assert.match(release,/insight-notification-ui-v18/);assert.match(ui,/mumei-notification-category-button/);assert.match(ui,/通知項目：/);assert.match(ui,/PUBLIC_DUPLICATE_LABELS/);
});

test("notification dock stays body-fixed and does not use the notification shell for panel placement",async()=>{
  const runtime=await read("public/note-insight-notification-runtime-v327.js");
  assert.match(runtime,/function independentDockHost\(\)/);
  assert.doesNotMatch(runtime,/shell\.appendChild\(r\)/);
  assert.doesNotMatch(runtime,/window\.addEventListener\('pointerdown',onShellPointerDown,true\)/);
  assert.match(runtime,/if\(!featureEnabled\|\|!bellTrigger\(target,e\)\)return/);
  assert.match(runtime,/if\(notificationRoute\(\)\|\|bellIntent\(\)\)\{await activateIntent\(\);return\}/);
});


test("notification dock lifecycle is isolated from note notification DOM",async()=>{
  const runtime=await read("public/note-insight-notification-runtime-v327.js");
  assert.match(runtime,/HOST='mumei-v325-dock-host'/);
  assert.match(runtime,/function independentDockHost\(\)/);
  assert.match(runtime,/panelSessionActive/);
  assert.match(runtime,/function panelEvent\(e\)/);
  assert.doesNotMatch(runtime,/shell\.appendChild\(r\)/);
  assert.match(runtime,/if\(panelEvent\(e\)\)return/);
  assert.match(runtime,/if\(panelSessionActive\)\{if\(shell&&!shell\.isConnected\)markSurface\(null\);showRoot\(true\);return\}/);
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


test("article return preserves notification panel session",async()=>{
  const runtime=await read("public/note-insight-notification-runtime-v327.js");
  assert.match(runtime,/NAV_RETURN='mumei-v3-notification-return-v3269'/);
  assert.match(runtime,/function saveArticleReturn\(target\)/);
  assert.match(runtime,/function suspendForArticleReturn\(\)/);
  assert.match(runtime,/async function resumeArticleReturn\(\)/);
  assert.match(runtime,/document\.addEventListener\('click',onNotificationArticleClick,true\)/);
  assert.match(runtime,/addEventListener\('popstate',routeLifecycle\)/);
  assert.match(runtime,/if\(st&&returnSourceHere\(st\)\)\{void resumeArticleReturn\(\);return\}/);
  assert.doesNotMatch(runtime,/popstate',\(\)=>\{intentUntil=0;if\(!notificationRoute\(\)\)hideImmediately\(\)/);
});


test("dock state survives navigation but UI is visible only on notification context",async()=>{
  const runtime=await read("public/note-insight-notification-runtime-v327.js");
  assert.match(runtime,/function notificationVisibleNow\(\)/);
  assert.match(runtime,/panelSessionActive&&notificationVisibleNow\(\)/);
  assert.match(runtime,/if\(suppressUntilBell\)\{showRoot\(false\);return\}/);
  assert.match(runtime,/if\(panelSessionActive\)\{if\(shell&&!shell\.isConnected\)markSurface\(null\);showRoot\(false\);cleanupVisuals\(\);return\}/);
  assert.doesNotMatch(runtime,/if\(panelSessionActive\)\{if\(shell&&!shell\.isConnected\)markSurface\(null\);showRoot\(true\);return\}/);
});
