import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';

const read=p=>fs.readFileSync(new URL('../public/'+p,import.meta.url),'utf8');
const reader=read('note-insight-notification-reader-v323.js');
const checkpoint=read('note-insight-notification-checkpoint-v325.js');
const runtime=read('note-insight-notification-runtime-v327.js');
const stableRuntime=read('note-insight-notification-runtime-v2958.js');
const stableReader=read('note-insight-notification-autoscan-v2970.js');
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
  for(const name of ['note-insight-notification-reader-v323.js','note-insight-notification-checkpoint-v325.js','note-insight-notification-runtime-v327.js','note-insight-notification-runtime-v2958.js','note-insight-notification-autoscan-v2970.js','note-insight-notification-loader-v318.js','note-insight-dashboard-integrated-v318.js','note-insight-notification-v3.user.js'])assert.doesNotThrow(()=>new Function(read(name)));
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
  assert.match(reader,/findSavedRecoveryElement/);assert.match(reader,/kind!=='done'&&kind!=='error'/);assert.match(reader,/2500/);assert.match(reader,/persistRecoveredBoundary/);assert.match(reader,/checkpointFor/);assert.match(reader,/通知履歴の最下部まで到達できませんでした/);assert.match(reader,/通知一覧の先頭まで確認できませんでした/);assert.doesNotMatch(reader,/start\.rebase|完了ラインを再作成しています/);
  assert.match(reader,/boundarySignature/);
  assert.match(reader,/boundaryEventIdentity/);
  assert.match(reader,/function boundaryMatch/);
  assert.match(reader,/reader-bottom-up-confirmed-v326/);
  assert.match(reader,/保存済みラインから先頭まで追加分を確認します/);
});

test('persistent checkpoint mirrors the saved boundary across page closes without global DOM observer',()=>{assert.match(checkpoint,/mumei_insight_notification_checkpoint_local_v325:/);assert.match(checkpoint,/localStorage\.setItem/);assert.match(checkpoint,/addEventListener\('pagehide'/);assert.match(checkpoint,/visibilitychange/);assert.match(checkpoint,/async function restore\(/);assert.match(checkpoint,/ここまで保存済み/);assert.doesNotMatch(checkpoint,/new MutationObserver/)});

test('V3.3.11 wrapper activates automatic reader and inline notification controls',()=>{
  const meta=v3.split('// ==/UserScript==')[0];
  assert.match(v3,/@version\s+3\.3\.11/);
  assert.ok(meta.includes('note-insight-notification-autoscan-v2970.js?v=33110'));
  assert.ok(meta.includes('note-insight-notification-runtime-v2939-filter.js?v=33110'));
  assert.ok(meta.includes('note-insight-notification-bootstrap-v2966.js?v=33110'));
  assert.doesNotMatch(meta,/note-insight-notification-runtime-v2958\.js\?v=|note-insight-notification-runtime-v327\.js\?v=/);
  assert.match(stableReader,/mumei-inline-notification-tools-v339/);
  assert.match(stableReader,/フィルター ON|フィルター OFF/);
  assert.match(stableReader,/INSIGHT【通知】/);
  assert.match(stableReader,/function scheduleAuto/);
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
    w.fetch=async()=>({ok:true,json:async()=>({notificationVersion:'3.3.11'})});
    for(const s of w.document.querySelectorAll('script'))w.eval(s.textContent);
    await new Promise(resolve=>setTimeout(resolve,0));
    const install=w.document.getElementById('install'),u=new URL(install.href);
    assert.equal(u.origin,'https://raw.githubusercontent.com');
    assert.equal(u.pathname,'/mumei-s/note-insight/main/public/note-insight-notification-v3.user.js');
    assert.equal(w.document.querySelector('.toolname').textContent,'本人通知ツール');
    assert.match(install.textContent,/本人通知をインストール \/ 更新/);
    assert.match(html,/mumei-installer-boundary/);
    assert.match(html,/insight-release\.json/);
    assert.doesNotMatch(html,/本人通知 V\d|V3\.3\.11/);
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

test('manual full-read is no longer preloaded; stable reader owns automatic full and delta scans',async()=>{
  const meta=v3.split('// ==/UserScript==')[0];
  assert.doesNotMatch(meta,/note-insight-notification-manual-full-v3284\.js\?v=/);
  assert.match(stableReader,/function scheduleAuto/);
  assert.match(stableReader,/const reachedEnd=await seekOldest/);
  assert.match(stableReader,/const overlap=\(\)=>cp\.historyComplete===true/);
  assert.match(stableReader,/✓全履歴確認/);
  assert.match(stableReader,/✓追加確認/);
});


test('background history changes keep the notification session unless pathname really changes',()=>{
  assert.doesNotMatch(runtime,/if\(!notificationRoute\(\)\)hideImmediately\(\)/);
  assert.match(runtime,/addEventListener\('popstate',\(\)=>\{intentUntil=0;if\(sessionPathChanged\(\)\)\{hideImmediately\(\);return\}scheduleInspect\(0\)/);
  assert.match(runtime,/for\(const name of\['pushState','replaceState'\]\)/);
  assert.match(runtime,/if\(sessionPathChanged\(\)\)\{hideImmediately\(\);return r\}/);
  assert.match(runtime,/getShell:\(\)=>shell/);
});

test('manual full-read uses cloaked root bell session',async()=>{
  const full=await read('note-insight-notification-manual-full-v3284.js');
  assert.match(full,/function requestDedicatedFullRead\(\)/);
  assert.match(full,/new URL\('\/',location\.origin\)/);assert.match(full,/mumei_fullread/);assert.doesNotMatch(full,/new URL\('\/notifications'/);
  assert.match(full,/mumei_fullread/);
  assert.match(full,/function resumeRequestedFullRead\(\)/);
  assert.match(full,/manual-full-history-isolated-v1/);
});


test('notification session survives only while a real notification surface remains',()=>{
  assert.match(runtime,/panelSessionActive=false/);
  assert.match(runtime,/function startPanelSession\(\)/);
  assert.match(runtime,/function endPanelSession\(\)/);
  assert.match(runtime,/function notificationRoute\(\)\{return false\}/);assert.doesNotMatch(runtime,/a\[href\*="\/notifications"\]/);
  assert.match(runtime,/function onGlobalPointerDown\(e\)/);
  assert.match(runtime,/window\.addEventListener\('pointerdown',onGlobalPointerDown,true\)/);
  assert.match(runtime,/Promise\.resolve\(safeScan\(\)\)\.then/);
  assert.match(runtime,/autoStarting=false/);
});


test('update detection verifies the stable userscript on INSIGHT without visiting note',()=>{
  assert.match(v3,/ACTIVE_GM_KEY='mumei-notification-active-runtime-version-v1'/);
  assert.match(v3,/if\(location\.hostname==='mumei-s\.github\.io'\)\{/);
  assert.match(v3,/localStorage\.setItem\(TOOL_KEY,VERSION\)/);
  assert.match(v3,/Promise\.resolve\(gmVersionSet\(VERSION\)\)\.then\(\(\)=>gmVersionGet\(\)\)/);
  assert.doesNotMatch(v3,/window\.__mumeiNotificationRuntime2958/);
  assert.match(v3,/window\.__mumeiStableNotification3311/);
  assert.doesNotMatch(v3,/note\.com\/notifications/);
});


test('inline controls are notification-surface-owned instead of viewport-owned',()=>{
  assert.match(stableReader,/panel\.prepend\(bar\)|panel\.insertBefore\(bar,first\)/);
  assert.match(stableReader,/position:sticky/);
  assert.doesNotMatch(v3,/note-insight-notification-runtime-v2958\.js\?v=/);
});


test('filter toggle updates GM state and refreshes filter engine without affecting automatic reading',()=>{
  assert.match(stableReader,/mumei_insight_magazine_filter_enabled_v3:/);
  assert.match(stableReader,/mumei-insight-filter-refresh-v2939/);
  assert.match(stableReader,/function toolbarAction/);
  assert.match(stableReader,/function scheduleAuto/);
});


test('DM and generic list rows can never qualify as notification popup',()=>{
  assert.match(runtime,/function strongNoticeSurface\(root\)/);
  assert.match(runtime,/const a=exact\(root,'通知'\),b=exact\(root,'お知らせ'\)/);
  assert.match(runtime,/return shell&&strongNoticeSurface\(shell\)\?shell:null/);
  assert.doesNotMatch(runtime,/for\(const row of \[\.\.\.document\.querySelectorAll\(ITEM\)\]\.filter\(visible\)\)/);
  assert.match(runtime,/function findSurface\(\)\{return notificationRoute\(\)\?routeSurface\(\):popupSurface\(\)\}/);
  assert.match(runtime,/if\(shell&&strongNoticeSurface\(shell\)\)\{showRoot\(true\);return\}/);
});


test('DM header is never accepted as a notification surface',()=>{
  assert.match(runtime,/document\.querySelectorAll\('\[role="dialog"\],\[role="menu"\],\[popover\],main,section,aside'\)/);
  assert.doesNotMatch(runtime,/main,section,aside,nav,header/);
  assert.match(runtime,/const known=\[\.\.\.root\.querySelectorAll\(ITEM\)\]\.filter\(rowish\)/);
  assert.match(runtime,/function dismissActiveEditor\(\)/);
  assert.match(runtime,/dismissActiveEditor\(\);suppressUntilBell=false/);
});


test('opening the notification panel never advances or fabricates the checkpoint',()=>{
  const activate=runtime.slice(runtime.indexOf('async function activate(next)'),runtime.indexOf('async function activateIntent()'));
  assert.match(activate,/__mumeiV3Checkpoint325\?\.restore\?\.\(\)/);
  assert.doesNotMatch(activate,/__mumeiV3Checkpoint325\?\.mark\?\.\(\)/);
  assert.doesNotMatch(checkpoint,/前回の保存位置を保持中｜全件再読込なし/);
  assert.match(checkpoint,/function markBoundary\(cp\)[\s\S]*old\?\.remove\(\);\s*return false/);
  assert.match(reader,/confirmed\.length[\s\S]*mumei-notification-checkpoint/);
});


test('checkpoint exact identity prevents top-row false match',()=>{
  assert.match(checkpoint,/function rowLegacySignature\(el\)/);
  assert.match(checkpoint,/if\(eventId&&legacy\)\{if\(idOk&&legacyOk\)return el;continue\}/);
  assert.doesNotMatch(checkpoint,/前回の保存位置を保持中｜全件再読込なし/);
  const activate=runtime.slice(runtime.indexOf('async function activate(next)'),runtime.indexOf('async function activateIntent()'));
  assert.doesNotMatch(activate,/__mumeiV3Checkpoint325\?\.mark\?\.\(\)/);
});


test('checkpoint identity never falls back to text when a stronger identity exists',()=>{
  assert.match(checkpoint,/function rowLegacySignature\(el\)/);
  assert.match(checkpoint,/if\(eventId&&legacy\)\{if\(idOk&&legacyOk\)return el;continue\}/);
  assert.match(checkpoint,/if\(eventId\)\{if\(idOk\)return el;continue\}/);
  assert.match(checkpoint,/if\(legacy\)\{if\(legacyOk\)return el;continue\}/);
  assert.match(checkpoint,/if\(display&&stripTime\(el\.textContent\)===display\)return el/);
  const activate=runtime.slice(runtime.indexOf('async function activate(next)'),runtime.indexOf('async function activateIntent()'));
  assert.doesNotMatch(activate,/__mumeiV3Checkpoint325\?\.mark\?\.\(\)/);
});


test('read completion stays visible on the dock until the notification panel closes',()=>{
  assert.match(runtime,/#\$\{ROOT\} button\.done/);
  assert.match(runtime,/b\.classList\.toggle\('done',d\.kind==='done'\)/);
  assert.match(runtime,/const doneLabel=\(d\.mode==='network-full'\|\|d\.mode==='dom-full'\)\?'✓全読':\(d\.mode==='network-delta'\|\|d\.mode==='dom-delta'\)\?'✓追加'/);
  assert.match(runtime,/btn\.classList\.remove\('err','done'\)/);
});


test('restored DOM reader is primary and captures actor images',async()=>{
  const meta=v3.split('// ==/UserScript==')[0];
  assert.ok(meta.includes('note-insight-notification-autoscan-v2970.js?v=33110'));
  assert.doesNotMatch(meta,/note-insight-notification-network-v3300\.js\?v=/);
  assert.match(stableReader,/function rowData/);
  assert.match(stableReader,/actor_image_url:img/);
  assert.match(stableReader,/function scheduleAuto/);
  assert.match(stableReader,/for\(let i=0;i<1200&&!stop;i\+\+\)/);
  assert.match(stableReader,/steps\+\+<1200/);
});
