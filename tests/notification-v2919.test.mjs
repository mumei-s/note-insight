import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const read=p=>readFile(new URL(`../${p}`,import.meta.url),"utf8");
const has=(text,items)=>{for(const x of items)assert.match(text,new RegExp(x.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")))};

test("V3.2.55 loads bottom-up reader, persistent checkpoint and fixed five-panel dock",async()=>{
  const v3=await read("public/note-insight-notification-v3.user.js"),checkpoint=await read("public/note-insight-notification-checkpoint-v325.js"),runtime=await read("public/note-insight-notification-runtime-v327.js"),reader=await read("public/note-insight-notification-reader-v323.js"),loader=await read("public/note-insight-notification-loader-v318.js");
  assert.match(v3,/@version\s+3\.2\.55/);
  assert.match(v3,/@require\s+https:\/\/raw\.githubusercontent\.com\/mumei-s\/note-insight\/main\/public\/note-insight-notification-reader-v323\.js\?v=3245/);
  assert.match(v3,/@require\s+https:\/\/raw\.githubusercontent\.com\/mumei-s\/note-insight\/main\/public\/note-insight-notification-checkpoint-v325\.js\?v=3250/);
  assert.match(v3,/@require\s+https:\/\/raw\.githubusercontent\.com\/mumei-s\/note-insight\/main\/public\/note-insight-notification-runtime-v327\.js\?v=3255/);
  assert.doesNotMatch(v3,/note-insight-notification-settings-route-v332\.js/);
  assert.doesNotMatch(v3,/note-insight-notification-dock-watch-v312\.js|surface-guard-v326/);
  has(v3,["mumei-notification-tool-version","mumei-notification-v3-loader","bottom-up-saved-line-v3245","#mumei-v325-dock [data-a=\"settings\"]","#mumei-v3-tray-v330 [data-act=\"settings\"]","mumei-notification-feature-ui-v1","mumei-notification-feature-bridge-v1","mumei_insight_notification_feature_enabled_v1"]);
  has(checkpoint,["mumei_insight_notification_checkpoint_local_v325:","localStorage.setItem","async function restore(","async function persist(","ここまで保存済み","前回の保存位置を保持中｜全件再読込なし"]);assert.doesNotMatch(checkpoint,/new MutationObserver/);has(reader,["checkpointFor(","preserveBoundary","全件読み直しなし"]);assert.doesNotMatch(reader,/start\.rebase/);
  has(runtime,["notification-filter-settings.html","notificationAccount","location.replace(u.href)","openNotificationBell","isNotificationOpen","mumei_insight_notification_feature_enabled_v1","setFeatureEnabled","hideImmediately","suppressUntilBell","notificationLeaveAction","onShellPointerDown","function showRoot(on){const want=Boolean(on&&featureEnabled&&!suppressUntilBell)","function onStatus(e){if(suppressUntilBell||!featureEnabled)","function confirmHide(){hideTimer=0;if(suppressUntilBell)","event?.composedPath","mumei-v325-dock","data-a=\"read\"","data-a=\"mode\"","data-a=\"filter\"","data-a=\"settings\"","data-a=\"ins\"","mumei_insight_notification_auto_v325:","async function initMode(","async function toggleMode(","function maybeAuto(","autoDoneForSession","async function safeScan(","mountUiInSurface","leadDisplayName","profileCandidates","filterRows","runPrimaryDockAction","pointerdown","pointerup","leadCreatorId","ids.has(lead)","creatorProfile","profileImageUrl","nickname"]);
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
  has(setup,["mumei-installer-boundary","INSIGHT インストール / 更新","本人通知ツール","最新版をインストール / 更新","ブラウザ別インストール","insight-release.json","notificationVersion","raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-notification-v3.user.js","mumei-notification-v3-loader","mumei-notification-tool-version","apps.apple.com/jp/app/userscripts/id1463298887","data-browser=\"android-edge\"","data-browser=\"android-firefox\"","data-browser=\"android-other\"","data-browser=\"ios-safari\"","data-browser=\"ios-other\"","data-browser=\"pc-edge\"","data-browser=\"pc-chrome\"","data-browser=\"pc-firefox\"","data-browser=\"pc-opera\"","data-browser=\"mac-safari\"","Yahoo!ブラウザー"]);
  assert.doesNotMatch(setup,/本人通知 V\d|V3\.2\.55をインストール|script_installation\.php#url=/);
  has(top,["./tool-setup.html?from=top","mumei-notice-controls","mumei-notice-feature-toggle","mumei-notification-feature-ui-v1","mumei-notification-feature-bridge-v1","本人通知機能をOFFにする","本人通知機能をONにする"]);
  assert.match(top,/grid-template-columns:minmax\(34px,.62fr\) minmax\(0,1fr\)/);
  has(route,["notification-update.html"]);
  has(bridge,["互換停止版"]);
});

test("release tracks V3.2.55 without putting the version in the user-facing label",async()=>{
  const manifest=JSON.parse(await read("public/insight-release.json")),release=await read("src/insight-release.ts"),v3=await read("public/note-insight-notification-v3.user.js");assert.equal(manifest.appVersion,"2026.09.17.2");assert.equal(manifest.notificationVersion,"3.2.55");assert.equal(manifest.notificationLabel,"本人通知");assert.equal(manifest.dashboardVersion,"1.4.4");assert.match(release,/CURRENT_INSIGHT_APP_VERSION = "2026\.09\.17\.2"/);assert.match(release,/CURRENT_NOTIFICATION_VERSION = "3\.2\.55"/);assert.match(v3,/@version\s+3\.2\.55/);
});

test("Dashboard and notification auth prefer explicit owner before stale member session",async()=>{const dash=await read("supabase/functions/insight-dashboard-import-token/index.ts"),notice=await read("supabase/functions/insight-notification-import-token/index.ts");for(const src of [dash,notice])assert.match(src,/if\(preferred==="owner"&&await owner\(req\)\)return ownerIdentity\(\);const p=await participant\(req\)/)});

test("private notification categories stay dense while public duplicates are excluded",async()=>{const ui=await read("src/member-insight-notifications-final.tsx"),picker=await read("src/insight-notification-ui-v18.ts"),feed=await read("supabase/functions/insight-notification-feed-final/index.ts");has(ui,["reply_self","membership_join","purchase","tip","other"]);has(feed,["[\"like\",\"follow\",\"comment\",\"creator_article_posted\"]"]);has(picker,["スキ","人物フォロー","通常コメント","記事投稿"])});