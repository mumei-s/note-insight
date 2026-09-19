import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const read=p=>readFile(new URL(`../${p}`,import.meta.url),"utf8");
const has=(text,items)=>{for(const x of items)assert.match(text,new RegExp(x.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")))};

test("V3.2.73 loads bottom-up reader, persistent checkpoint and fixed five-panel dock",async()=>{
  const v3=await read("public/note-insight-notification-v3.user.js"),checkpoint=await read("public/note-insight-notification-checkpoint-v325.js"),runtime=await read("public/note-insight-notification-runtime-v327.js"),reader=await read("public/note-insight-notification-reader-v323.js"),loader=await read("public/note-insight-notification-loader-v318.js");
  assert.match(v3,/@version\s+3\.2\.73/);
  assert.match(v3,/@require\s+https:\/\/raw\.githubusercontent\.com\/mumei-s\/note-insight\/main\/public\/note-insight-notification-reader-v323\.js\?v=3246/);
  assert.match(v3,/@require\s+https:\/\/raw\.githubusercontent\.com\/mumei-s\/note-insight\/main\/public\/note-insight-notification-checkpoint-v325\.js\?v=3250/);
  assert.match(v3,/@require\s+https:\/\/raw\.githubusercontent\.com\/mumei-s\/note-insight\/main\/public\/note-insight-notification-runtime-v327\.js\?v=3272/);
  assert.doesNotMatch(v3,/note-insight-notification-settings-route-v332\.js/);
  assert.doesNotMatch(v3,/note-insight-notification-dock-watch-v312\.js|surface-guard-v326/);
  has(v3,["mumei-notification-tool-version","mumei-notification-v3-loader","bottom-up-saved-line-v3245","#mumei-v325-dock [data-a=\"settings\"]","#mumei-v3-tray-v330 [data-act=\"settings\"]","mumei-notification-feature-ui-v1","mumei-notification-feature-bridge-v1","mumei_insight_notification_feature_enabled_v1"]);
  has(checkpoint,["mumei_insight_notification_checkpoint_local_v325:","localStorage.setItem","async function restore(","async function persist(","ここまで保存済み","前回の保存位置を保持中｜全件再読込なし"]);assert.doesNotMatch(checkpoint,/new MutationObserver/);has(reader,["checkpointFor(","preserveBoundary","全件読み直しなし"]);assert.doesNotMatch(reader,/start\.rebase/);
  has(runtime,["notification-filter-settings.html","notificationAccount","location.assign(u.href)","openNotificationBell","isNotificationOpen","mumei_insight_notification_feature_enabled_v1","setFeatureEnabled","hideImmediately","suppressUntilBell","notificationLeaveAction","function showRoot(on)","panelSessionActive","function onStatus(e)","panelSessionActive","function confirmHide()","panelSessionActive","strongNoticeSurface","trustedBellSurface","noticeRows","textEditorElement","editingOutsideNotification","onEditorFocus","event?.composedPath","mumei-v325-dock","data-a=\"read\"","data-a=\"mode\"","data-a=\"filter\"","data-a=\"settings\"","data-a=\"ins\"","mumei_insight_notification_auto_v325:","async function initMode(","async function toggleMode(","function maybeAuto(","autoDoneForSession","async function safeScan(","mountUiInSurface","leadDisplayName","profileCandidates","filterRows","runDockAction","pointerdown","pointerup","leadCreatorId","ids.has(lead)","creatorProfile","profileImageUrl","nickname"]);
  assert.doesNotMatch(runtime,/notification-filter\.html|new MutationObserver/);
  assert.match(runtime,/grid-template-columns:minmax\(54px,.72fr\) minmax\(46px,.62fr\) minmax\(70px,1fr\) minmax\(48px,.66fr\) minmax\(68px,.9fr\)/);
  has(reader,["__mumeiNotificationReader323","__mumeiV3Reader323","readyToScan","confirmedClientSignatures","bottom-up-from-saved-line","saved-line-bottom-up-v324","ここまで保存済み","boundarySignature","boundaryEventIdentity","完了ラインから上方向へ、追加分だけ読み込みます","findSavedRecoveryElement","persistRecoveredBoundary","preserveBoundary","全件読み直しなし"]);
  has(loader,["note-insight-dashboard-integrated-v318.js","mumei-dashboard-flow-v143"]);
});

test("five-panel dock contains manual read, auto toggle, filter, registration and INSIGHT",async()=>{
  const runtime=await read("public/note-insight-notification-runtime-v327.js");
  has(runtime,["type=\"button\" data-a=\"read\">読込</button>","type=\"button\" class=\"mode auto\" data-a=\"mode\">自動</button>","type=\"button\" data-a=\"filter\">フィルター</button>","data-a=\"settings\">設定</button>","data-a=\"ins\">INSIGHT</button>"]);
  assert.match(runtime,/position:fixed!important;left:8px!important;right:8px!important;bottom:/);
  assert.match(runtime,/autoMode\?'自動':'手動'/);
});

test("installer is isolated, versionless and browser-specific",async()=>{
  const redirect=await read("public/tool-setup.html"),setup=await read("public/notification-browser-install.html"),top=await read("src/insight-top-install-v16.ts"),route=await read("src/insight-notification-update-route-v1.ts"),bridge=await read("public/note-insight-bridge.user.js");
  has(redirect,["notification-browser-install.html","location.replace(target.href)"]);
  assert.doesNotMatch(redirect,/ブラウザ別インストール|raw\.githubusercontent\.com\/mumei-s\/note-insight\/main\/public\/note-insight-notification-v3\.user\.js/);
  has(setup,["mumei-installer-boundary","INSIGHT インストール / 更新","本人通知ツール","本人通知をインストール / 更新","ブラウザ別インストール","insight-release.json","notificationVersion","raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-notification-v3.user.js","mumei-notification-v3-loader","mumei-notification-tool-version","apps.apple.com/jp/app/userscripts/id1463298887","data-browser=\"android-edge\"","data-browser=\"android-firefox\"","data-browser=\"android-other\"","data-browser=\"ios-safari\"","data-browser=\"ios-other\"","data-browser=\"pc-edge\"","data-browser=\"pc-chrome\"","data-browser=\"pc-firefox\"","data-browser=\"pc-opera\"","data-browser=\"mac-safari\"","Yahoo!ブラウザー"]);
  assert.doesNotMatch(setup,/本人通知 V\d|V3\.2\.73をインストール|script_installation\.php#url=/);
  has(top,["./tool-setup.html?from=top","mumei-notice-controls","mumei-notice-feature-toggle","mumei-notification-feature-ui-v1","mumei-notification-feature-bridge-v1","本人通知機能をOFFにする","本人通知機能をONにする"]);
  assert.match(top,/grid-template-columns:minmax\(34px,.62fr\) minmax\(0,1fr\)/);
  has(route,["notification-update.html"]);
  has(bridge,["互換停止版"]);
});

test("release tracks V3.2.73 without putting the version in the user-facing label",async()=>{
  const manifest=JSON.parse(await read("public/insight-release.json")),release=await read("src/insight-release.ts"),v3=await read("public/note-insight-notification-v3.user.js");assert.equal(manifest.appVersion,"2026.09.19.1");assert.equal(manifest.notificationVersion,"3.2.73");assert.equal(manifest.notificationLabel,"本人通知");assert.equal(manifest.dashboardVersion,"1.4.4");assert.match(release,/CURRENT_INSIGHT_APP_VERSION = "2026\.09\.19\.1"/);assert.match(release,/CURRENT_NOTIFICATION_VERSION = "3\.2\.73"/);assert.match(v3,/@version\s+3\.2\.73/);
});

test("Dashboard and notification auth prefer explicit owner before stale member session",async()=>{const dash=await read("supabase/functions/insight-dashboard-import-token/index.ts"),notice=await read("supabase/functions/insight-notification-import-token/index.ts");for(const src of [dash,notice])assert.match(src,/if\(preferred==="owner"&&await owner\(req\)\)return ownerIdentity\(\);const p=await participant\(req\)/)});

test("private notification categories stay dense while public duplicates are excluded",async()=>{const ui=await read("src/member-insight-notifications-final.tsx"),picker=await read("src/insight-notification-ui-v18.ts"),feed=await read("supabase/functions/insight-notification-feed-final/index.ts");has(ui,["reply_self","membership_join","purchase","tip","other"]);has(feed,["[\"like\",\"follow\",\"comment\",\"creator_article_posted\"]"]);has(picker,["スキ","人物フォロー","通常コメント","記事投稿"])});

test("tool status distinguishes not-installed from update available",async()=>{
  const ui=await read("src/member-insight-live-v2.tsx"),top=await read("src/insight-top-install-v16.ts"),guide=await read("src/insight-update-guide-v18.ts");
  has(ui,["notificationMissing","dashboardMissing","versionDiffers(notificationInstalled,notificationLatest)","needs-install","⬆ 更新あり","＋ 未導入"]);assert.doesNotMatch(ui,/notificationInstalled&&notificationLatest\?<em>✓ 最新版<\/em>/);assert.doesNotMatch(ui,/dashboardInstalled&&dashboardLatest\?<em>✓ 最新版<\/em>/);
  has(top,["needs-update","needs-install","⬆ 更新あり","＋ インストール"]);
  has(guide,["更新あり","未導入","更新と未導入を分けて表示"]);
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
  assert.match(runtime,/if\(panelSessionActive\)\{if\(shell&&!shell\.isConnected\)markSurface\(null\);showRoot\(false\);cleanupVisuals\(\);return\}/);
});


test("installed newer than published latest is still current",async()=>{
  const release=await read("src/insight-release.ts"),setup=await read("public/notification-browser-install.html"),ui=await read("src/member-insight-live-v2.tsx");
  assert.match(release,/compareVersions\(current,latest\)<0/);
  assert.match(setup,/compareVersion\(current,latest\)>=0/);
  assert.match(setup,/本人通知ツールは最新版です/);
  assert.match(setup,/mumei-notification-install-pending-v1/);
  assert.match(ui,/versionDiffers\(notificationInstalled,notificationLatest\)/);
  assert.doesNotMatch(ui,/✓ 最新版/);
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
  assert.match(runtime,/NAV_RETURN='mumei-v3-notification-return-v3268'/);
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
