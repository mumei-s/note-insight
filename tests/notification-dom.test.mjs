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
  assert.match(runtime,/通知フィルター登録/);assert.match(runtime,/data-addg/);assert.match(runtime,/note URL \/ @ID \/ ID/);assert.doesNotMatch(runtime,/notification-filter\.html|location\.replace\(u\.href\)/);assert.doesNotMatch(runtime,/new MutationObserver/);
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

test('persistent checkpoint mirrors the saved boundary across page closes without global DOM observer',()=>{assert.match(checkpoint,/mumei_insight_notification_checkpoint_local_v325:/);assert.match(checkpoint,/localStorage\.setItem/);assert.match(checkpoint,/addEventListener\('pagehide'/);assert.match(checkpoint,/visibilitychange/);assert.match(checkpoint,/async function restore\(/);assert.match(checkpoint,/ここまで保存済み/);assert.doesNotMatch(checkpoint,/new MutationObserver/)});

test('V3.2.45 wrapper activates bottom-up reader and fixed five-panel runtime',()=>{
  const meta=v3.split('// ==/UserScript==')[0];assert.match(v3,/@version\s+3\.2\.45/);assert.match(meta,/note-insight-notification-reader-v323\.js\?v=3245/);assert.match(meta,/note-insight-notification-checkpoint-v325\.js\?v=3245/);assert.match(meta,/note-insight-notification-runtime-v327\.js\?v=3245/);assert.doesNotMatch(meta,/note-insight-notification-settings-route-v332\.js/);assert.doesNotMatch(meta,/note-insight-notification-dock-watch-v312\.js/);assert.match(v3,/bottom-up-saved-line-v3245/);assert.match(v3,/#mumei-v325-dock \[data-a="settings"\]/);assert.match(v3,/#mumei-v3-tray-v330 \[data-act="settings"\]/);assert.match(v3,/api\.openSettings/);assert.doesNotMatch(v3,/notification-filter\.html/);assert.match(runtime,/function runPrimaryDockAction/);assert.match(runtime,/type="button" data-a="read"/);assert.match(runtime,/pointerdown/);assert.match(runtime,/pointerup/);assert.match(runtime,/stopImmediatePropagation/);assert.match(runtime,/function leadCreatorId/);assert.doesNotMatch(runtime,/magazineNoise\(text\(el\)\)&&creatorIds\(el\)/);assert.match(runtime,/ids\.has\(lead\)/);assert.match(runtime,/function maybeAuto/);assert.match(runtime,/autoDoneForSession/);assert.doesNotMatch(runtime,/lastAutoAt/);assert.match(runtime,/async function safeScan/);assert.match(runtime,/event\?\.composedPath/);assert.match(runtime,/li,\[role="listitem"\]/);assert.doesNotMatch(runtime,/new MutationObserver/)
});

test('installer opens canonical userscript and keeps visible copy versionless',async()=>{
  const html=read('tool-setup.html'),dom=new JSDOM(html,{url:'https://mumei-s.github.io/note-insight/tool-setup.html',runScripts:'outside-only'}),w=dom.window;try{w.fetch=async()=>({ok:true,json:async()=>({notificationVersion:'3.2.45'})});for(const s of w.document.querySelectorAll('script'))w.eval(s.textContent);await new Promise(resolve=>setTimeout(resolve,0));const install=w.document.getElementById('install'),u=new URL(install.href);assert.equal(u.origin,'https://raw.githubusercontent.com');assert.equal(u.pathname,'/mumei-s/note-insight/main/public/note-insight-notification-v3.user.js');assert.equal(w.document.querySelector('.toolname').textContent,'本人通知ツール');assert.match(install.textContent,/最新版をインストール \/ 更新/);assert.match(html,/insight-release\.json/);assert.doesNotMatch(html,/本人通知 V\d/);assert.match(html,/ブラウザ別インストール/);assert.match(html,/5パネル/);assert.match(html,/次回からはその保存位置を境界/);assert.match(html,/URLを貼り付ける操作はありません/);assert.match(html,/確認ボタンも不要/);assert.match(html,/from==='note'\|\|from==='notifications'/);assert.doesNotMatch(html,/notification-filter\.html/)}finally{dom.window.close()}
});