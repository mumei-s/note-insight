import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';

const read=p=>fs.readFileSync(new URL('../public/'+p,import.meta.url),'utf8');
const reader=read('note-insight-notification-reader-v323.js');
const checkpoint=read('note-insight-notification-checkpoint-v325.js');
const runtime=read('note-insight-notification-runtime-v327.js');
const v3=read('note-insight-notification-v3.user.js');
const legacy325=read('note-insight-notification-runtime-v325.js');
const legacy324=read('note-insight-notification-runtime-v324.js');
const legacyRoute=read('note-insight-notification-settings-route-v332.js');

function env(){
  const dom=new JSDOM('<button id="bell" aria-label="通知">🔔</button><main><section id="popup" role="dialog"><button>通知</button><button>お知らせ</button><div id="list"></div></section></main>',{url:'https://note.com/notifications',runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window;w.HTMLElement.prototype.getBoundingClientRect=function(){return {width:320,height:180,left:0,top:20,right:320,bottom:200}};w.fetch=async()=>({ok:true,json:async()=>({data:{urlname:'fixture'}})});const values=new Map();w.GM={getValue:async(k,d)=>values.get(k)??d,setValue:async(k,v)=>values.set(k,v)};return{dom,w,values};
}
function expose(w,src,names){w.eval(src.replace(/\}\)\(\);?\s*$/,'window.testAPI={'+names.join(',')+'};})();'));return w.testAPI}

test('active notification scripts parse',()=>{
  for(const name of ['note-insight-notification-reader-v323.js','note-insight-notification-checkpoint-v325.js','note-insight-notification-runtime-v327.js','note-insight-notification-loader-v318.js','note-insight-dashboard-integrated-v318.js','note-insight-notification-v3.user.js'])assert.doesNotThrow(()=>new Function(read(name)));
});

test('fixed runtime declares exactly five bottom actions including auto mode',()=>{
  assert.match(runtime,/mumei-v325-dock/);
  assert.match(runtime,/position:fixed!important;left:8px!important;right:8px!important;bottom:/);
  assert.match(runtime,/grid-template-columns:minmax\(54px,.72fr\) minmax\(46px,.62fr\) minmax\(70px,1fr\) minmax\(48px,.66fr\) minmax\(68px,.9fr\)/);
  for(const act of ['read','mode','filter','settings','ins'])assert.match(runtime,new RegExp(`data-a=\\"${act}\\"`));
  assert.match(runtime,/mumei_insight_notification_auto_v325:/);
  assert.match(runtime,/notification-filter-settings\.html/);assert.match(runtime,/notificationAccount/);assert.match(runtime,/location\.replace\(u\.href\)/);assert.doesNotMatch(runtime,/通知フィルター登録|data-addg/);assert.doesNotMatch(runtime,/new MutationObserver/);
  assert.match(runtime,/autoMode\?'自動':'手動'/);
});

test('legacy settings UIs stay inline and never open the obsolete external page',()=>{for(const src of [legacy325,legacy324]){assert.match(src,/通知フィルター登録<\/h3>/);assert.match(src,/data-addg/);assert.doesNotMatch(src,/notification-filter\.html|location\.replace\(u\.href\)/)}assert.match(legacyRoute,/__mumeiV3Runtime328/);assert.match(legacyRoute,/openSettings/);assert.doesNotMatch(legacyRoute,/notification-filter\.html|new MutationObserver/)});

test('reader sends visible notifications from the lower side upward',async()=>{
  const{dom,w,values}=env();try{const popup=w.document.getElementById('popup');popup.setAttribute('data-mumei-notice-shell-v3','1');w.document.getElementById('list').innerHTML='<a class="m-navbarNoticeItem" data-notification-id="new" href="https://note.com/a/n/n1?c=c1">Aさんがあなたのコメントに返信しました3分前</a><a class="m-navbarNoticeItem" data-notification-id="old" href="https://note.com/a/m/m1">未知の通知3分前</a>';const api=expose(w,reader,['rows','rowData','panel','sendBatch','sig','scan']);assert.equal(api.panel().id,'popup');values.set('mumei_insight_notification_sync_token_v2:fixture','fixture-only');const sent=[];w.GM.xmlHttpRequest=o=>{const batch=JSON.parse(o.data).notifications;sent.push(...batch.map(x=>x.meta.event_identity));o.onload({status:200,responseText:JSON.stringify({ok:true,confirmedClientSignatures:batch.map(api.sig)})})};await api.scan();assert.deepEqual(sent,['notice:old','notice:new']);assert.equal(values.get('mumei_insight_notification_saved_v2919:fixture').length,2)}finally{dom.window.close()}
});

test('reader starts from the lower side, marks the completion line, and next run reads only above it',()=>{
  assert.match(reader,/scan_mode:'bottom-up-from-saved-line'/);
  assert.match(reader,/scan_strategy:'saved-line-bottom-up-v324'/);
  assert.match(reader,/host\.scrollTop=Math\.max\(0,before-amount\)/);
  assert.match(reader,/ここまで保存済み/);
  assert.match(reader,/findSavedRecoveryElement/);assert.match(reader,/kind!=='done'&&kind!=='error'/);assert.match(reader,/2500/);assert.match(reader,/persistRecoveredBoundary/);assert.match(reader,/checkpointFor/);assert.match(reader,/preserveBoundary/);assert.match(reader,/全件読み直しなし/);assert.doesNotMatch(reader,/start\.rebase|完了ラインを再作成しています/);
  assert.match(reader,/boundarySignature/);
  assert.match(reader,/boundaryEventIdentity/);
  assert.match(reader,/function boundaryMatch/);
  assert.match(reader,/reader-bottom-up-confirmed-v326/);
  assert.match(reader,/完了ラインから上方向へ、追加分だけ読み込みます/);
});

test('persistent checkpoint mirrors the saved boundary across page closes without global DOM observer',()=>{assert.match(checkpoint,/mumei_insight_notification_checkpoint_local_v325:/);assert.match(checkpoint,/localStorage\.setItem/);assert.match(checkpoint,/addEventListener\('pagehide'/);assert.match(checkpoint,/visibilitychange/);assert.match(checkpoint,/async function restore\(/);assert.match(checkpoint,/ここまで保存済み/);assert.match(checkpoint,/前回の保存位置を保持中｜全件再読込なし/);assert.doesNotMatch(checkpoint,/new MutationObserver/)});

test('V3.2.89 wrapper activates bottom-up reader and fixed five-panel runtime',()=>{
  const meta=v3.split('// ==/UserScript==')[0];assert.match(v3,/@version\s+3\.2\.89/);assert.match(meta,/note-insight-notification-reader-v323\.js\?v=3258/);assert.match(meta,/note-insight-notification-checkpoint-v325\.js\?v=3250/);assert.match(meta,/note-insight-notification-runtime-v327\.js\?v=3289/);assert.doesNotMatch(meta,/note-insight-notification-settings-route-v332\.js/);assert.doesNotMatch(meta,/note-insight-notification-dock-watch-v312\.js/);assert.match(v3,/bottom-up-saved-line-v3245/);assert.match(v3,/#mumei-v325-dock \[data-a="settings"\]/);assert.match(v3,/#mumei-v3-tray-v330 \[data-act="settings"\]/);assert.match(v3,/api\.openSettings/);assert.match(v3,/notification-filter-settings\.html/);assert.match(v3,/mumei-filter-page-v1/);assert.match(v3,/mumei-filter-bridge-v1/);assert.match(v3,/@connect\s+note\.com/);assert.doesNotMatch(v3,/e\.source!==window/);assert.match(v3,/mumei_filter_return/);assert.match(v3,/mumei_insight_return_bell_v1/);assert.match(v3,/return-bell/);assert.match(v3,/return-ready/);assert.match(v3,/isNotificationOpen/);assert.match(v3,/openNotificationBell/);assert.match(v3,/mumei-notification-feature-ui-v1/);assert.match(v3,/mumei-notification-feature-bridge-v1/);assert.match(v3,/mumei_insight_notification_feature_enabled_v1/);assert.match(runtime,/function runPrimaryDockAction/);assert.match(runtime,/type="button" data-a="read"/);assert.match(runtime,/pointerdown/);assert.match(runtime,/pointerup/);assert.match(runtime,/stopImmediatePropagation/);assert.match(runtime,/function mountUiToViewport/);assert.match(runtime,/shell&&shell\.isConnected/);assert.match(runtime,/function leadDisplayName/);assert.match(runtime,/function profileCandidates/);assert.match(runtime,/function filterRows/);assert.match(runtime,/function leadCreatorId/);assert.doesNotMatch(runtime,/magazineNoise\(text\(el\)\)&&creatorIds\(el\)/);assert.match(runtime,/ids\.has\(lead\)/);assert.match(runtime,/notification-filter-settings\.html/);assert.match(runtime,/notificationAccount/);assert.match(runtime,/location\.replace\(u\.href\)/);assert.match(runtime,/function maybeAuto/);assert.match(runtime,/autoDoneForSession/);assert.match(runtime,/function openNotificationBell/);assert.match(runtime,/isNotificationOpen/);assert.match(runtime,/mumei_insight_notification_feature_enabled_v1/);assert.match(runtime,/setFeatureEnabled/);assert.match(runtime,/disableFeatureNow/);assert.match(runtime,/hideImmediately/);assert.match(runtime,/suppressUntilBell/);assert.match(runtime,/notificationLeaveAction/);assert.match(runtime,/onGlobalPointerDown/);assert.match(runtime,/window\.addEventListener\('pointerdown',onGlobalPointerDown,true\)/);assert.match(runtime,/function showRoot\(on\).*suppressUntilBell/);assert.match(runtime,/function onStatus\(e\).*suppressUntilBell/);assert.match(runtime,/function confirmHide\(\).*suppressUntilBell/);assert.match(runtime,/async function activate\(next\).*suppressUntilBell/);assert.match(runtime,/async function activateIntent\(\).*suppressUntilBell/);assert.doesNotMatch(runtime,/if\(on\)\{ensureRoot\(\)/);assert.doesNotMatch(runtime,/autoDoneForSession=false;markSurface\(null\);showRoot\(false\);cleanupVisuals\(\)/);assert.doesNotMatch(runtime,/lastAutoAt/);assert.match(runtime,/async function safeScan/);assert.match(runtime,/event\?\.composedPath/);assert.match(runtime,/li,\[role="listitem"\]/);assert.doesNotMatch(runtime,/new MutationObserver/)
});

test('installer is isolated behind a redirect shell and stays versionless',async()=>{
  const settingsPage=read('notification-filter-settings.html');
  assert.match(settingsPage,/← noteの🔔通知へ戻る/);
  assert.match(settingsPage,/className='summary'/);
  assert.match(settingsPage,/className='body'/);

  const redirect=read('tool-setup.html');
  assert.match(redirect,/notification-browser-install\.html/);
  assert.match(redirect,/location\.replace\(target\.href\)/);
  assert.doesNotMatch(redirect,/ブラウザ別インストール|raw\.githubusercontent\.com\/mumei-s\/note-insight\/main\/public\/note-insight-notification-v3\.user\.js/);

  const html=read('notification-browser-install.html');
  const dom=new JSDOM(html,{url:'https://mumei-s.github.io/note-insight/notification-browser-install.html',runScripts:'outside-only'});
  const w=dom.window;
  try{
    w.fetch=async()=>({ok:true,json:async()=>({notificationVersion:'3.2.89'})});
    for(const s of w.document.querySelectorAll('script'))w.eval(s.textContent);
    await new Promise(resolve=>setTimeout(resolve,0));
    const install=w.document.getElementById('install'),u=new URL(install.href);
    assert.equal(u.origin,'https://raw.githubusercontent.com');
    assert.equal(u.pathname,'/mumei-s/note-insight/main/public/note-insight-notification-v3.user.js');
    assert.equal(w.document.querySelector('.toolname').textContent,'本人通知ツール');
    assert.match(install.textContent,/本人通知をインストール \/ 更新/);
    assert.match(html,/mumei-installer-boundary/);
    assert.match(html,/insight-release\.json/);
    assert.doesNotMatch(html,/本人通知 V\d|V3\.2\.89/);
    assert.match(html,/ブラウザ別インストール/);
    for(const id of ['android-edge','android-firefox','android-other','ios-safari','ios-other','pc-edge','pc-chrome','pc-firefox','pc-opera','mac-safari'])assert.match(html,new RegExp('data-browser="'+id+'"'));
    assert.match(html,/Yahoo!ブラウザー/);
    assert.match(html,/apps\.apple\.com\/jp\/app\/userscripts\/id1463298887/);
    assert.match(html,/tampermonkey\.net\/index\.php\?browser=safari/);
    assert.match(html,/addons\.mozilla\.org\/android\/addon\/tampermonkey/);
    assert.match(html,/play\.google\.com\/store\/apps\/details\?id=com\.microsoft\.emmx/);
    assert.match(html,/play\.google\.com\/store\/apps\/details\?id=org\.mozilla\.firefox/);
  }finally{dom.window.close()}
});

test('manual full-read stays isolated from the 05:48 runtime core',async()=>{
  const full=await read('note-insight-notification-manual-full-v3284.js');
  assert.match(v3,/note-insight-notification-manual-full-v3284\.js\?v=3286/);
  assert.match(full,/続きから読む/);assert.match(full,/全読み/);
  assert.match(full,/function isManual\(\)/);
  assert.match(full,/manual-full-history-isolated-v1/);
  assert.match(full,/window\.__mumeiV3ManualFull3284/);
  assert.doesNotMatch(runtime,/続きから読む|全読み|manual-full-history-isolated-v1/);
});


test('background history changes keep the notification session unless pathname really changes',()=>{
  assert.doesNotMatch(runtime,/if\(!notificationRoute\(\)\)hideImmediately\(\)/);
  assert.match(runtime,/addEventListener\('popstate',\(\)=>\{intentUntil=0;if\(sessionPathChanged\(\)\)\{hideImmediately\(\);return\}scheduleInspect\(0\)/);
  assert.match(runtime,/for\(const name of\['pushState','replaceState'\]\)/);
  assert.match(runtime,/if\(sessionPathChanged\(\)\)\{hideImmediately\(\);return r\}/);
  assert.match(runtime,/getShell:\(\)=>shell/);
});

test('manual full-read uses dedicated notifications page',async()=>{
  const full=await read('note-insight-notification-manual-full-v3284.js');
  assert.match(full,/function requestDedicatedFullRead\(\)/);
  assert.match(full,/new URL\('\/notifications',location\.origin\)/);
  assert.match(full,/mumei_fullread/);
  assert.match(full,/function resumeRequestedFullRead\(\)/);
  assert.match(full,/manual-full-history-isolated-v1/);
});


test('notification session survives temporary surface loss',()=>{
  assert.match(runtime,/panelSessionActive=false/);
  assert.match(runtime,/function startPanelSession\(\)/);
  assert.match(runtime,/function endPanelSession\(\)/);
  assert.match(runtime,/if\(panelSessionActive\)\{if\(shell&&!shell\.isConnected\)markSurface\(null\);showRoot\(true\);return\}/);
  assert.match(runtime,/function onGlobalPointerDown\(e\)/);
  assert.match(runtime,/window\.addEventListener\('pointerdown',onGlobalPointerDown,true\)/);
  assert.match(runtime,/Promise\.resolve\(safeScan\(\)\)\.then/);
  assert.match(runtime,/autoStarting=false/);
});


test('update detection only trusts runtime that actually started on note',()=>{
  assert.match(v3,/ACTIVE_GM_KEY='mumei-notification-active-runtime-version-v1'/);
  assert.match(v3,/void gmVersionGet\(\)\.then\(active=>/);
  assert.match(v3,/const confirmActiveRuntime=\(\)=>/);
  assert.match(v3,/window\.__mumeiV3Runtime328\?\.version/);
  assert.doesNotMatch(v3,/if\(location\.hostname==='mumei-s\.github\.io'\)\{\s*try\{localStorage\.setItem\(TOOL_KEY,VERSION\)/);
});


test('V3.2.89 dock is viewport-owned, never notification-surface-owned',()=>{
  assert.match(runtime,/function mountUiToViewport\(\)\{const host=document\.body\|\|document\.documentElement/);
  assert.match(runtime,/function mountUiToViewport\(\)\{const host=document\.body\|\|document\.documentElement;if\(!host\)return;const r=/);
  assert.match(runtime,/function ensureRoot\(\).*mountUiToViewport\(\);return r/s);
  assert.match(runtime,/function showRoot\(on\).*mountUiToViewport\(\)/s);
});
