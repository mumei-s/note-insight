import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {JSDOM} from 'jsdom';

const read=p=>fs.readFileSync(new URL('../public/'+p,import.meta.url),'utf8');
const reader=read('note-insight-notification-reader-v323.js');
const checkpoint=read('note-insight-notification-checkpoint-v325.js');
const runtime=read('note-insight-notification-runtime-v327.js');
const v3=read('note-insight-notification-v3.user.js');

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
  assert.match(runtime,/autoMode\?'自動':'手動'/);
});

test('reader extracts visible notifications and sends oldest first',async()=>{
  const{dom,w,values}=env();try{const popup=w.document.getElementById('popup');popup.setAttribute('data-mumei-notice-shell-v3','1');w.document.getElementById('list').innerHTML='<a class="m-navbarNoticeItem" data-notification-id="new" href="https://note.com/a/n/n1?c=c1">Aさんがあなたのコメントに返信しました3分前</a><a class="m-navbarNoticeItem" data-notification-id="old" href="https://note.com/a/m/m1">未知の通知3分前</a>';const api=expose(w,reader,['rows','rowData','panel','sendBatch','sig','scan']);assert.equal(api.panel().id,'popup');values.set('mumei_insight_notification_sync_token_v2:fixture','fixture-only');const sent=[];w.GM.xmlHttpRequest=o=>{const batch=JSON.parse(o.data).notifications;sent.push(...batch.map(x=>x.meta.event_identity));o.onload({status:200,responseText:JSON.stringify({ok:true,confirmedClientSignatures:batch.map(api.sig)})})};await api.scan();assert.deepEqual(sent,['notice:old','notice:new']);assert.equal(values.get('mumei_insight_notification_saved_v2919:fixture').length,2)}finally{dom.window.close()}
});

test('reader is incremental and preserves the confirmed saved boundary',()=>{
  assert.match(reader,/scan_mode:'incremental-top-to-checkpoint'/);assert.match(reader,/ここまで保存済み/);assert.match(reader,/BOUNDARY_NOT_FOUND_SAFE_STOP/);assert.match(reader,/boundarySignature/);assert.match(reader,/boundaryEventIdentity/);assert.match(reader,/function boundaryMatch/);
});

test('persistent checkpoint mirrors the saved boundary across page closes',()=>{assert.match(checkpoint,/mumei_insight_notification_checkpoint_local_v325:/);assert.match(checkpoint,/localStorage\.setItem/);assert.match(checkpoint,/addEventListener\('pagehide'/);assert.match(checkpoint,/visibilitychange/);assert.match(checkpoint,/async function restore\(/);assert.match(checkpoint,/ここまで保存済み/)});

test('V3.2.31 wrapper activates fixed five-panel runtime',()=>{
  const meta=v3.split('// ==/UserScript==')[0];assert.match(v3,/@version\s+3\.2\.31/);assert.match(meta,/note-insight-notification-reader-v323\.js\?v=3231/);assert.match(meta,/note-insight-notification-checkpoint-v325\.js\?v=3231/);assert.match(meta,/note-insight-notification-runtime-v327\.js\?v=3231/);assert.doesNotMatch(meta,/note-insight-notification-dock-watch-v312\.js/);assert.match(v3,/fixed-five-dock-v3231/);assert.match(runtime,/function maybeAuto/);assert.match(runtime,/async function safeScan/);
});

test('installer opens canonical userscript and keeps visible copy versionless',async()=>{
  const html=read('tool-setup.html'),dom=new JSDOM(html,{url:'https://mumei-s.github.io/note-insight/tool-setup.html',runScripts:'outside-only'}),w=dom.window;try{w.fetch=async()=>({ok:true,json:async()=>({notificationVersion:'3.2.31'})});w.eval(w.document.querySelector('script').textContent);await new Promise(resolve=>setTimeout(resolve,0));const install=w.document.getElementById('install'),u=new URL(install.href);assert.equal(u.origin,'https://mumei-s.github.io');assert.equal(u.pathname,'/note-insight/note-insight-notification-v3.user.js');assert.equal(w.document.querySelector('.toolname').textContent,'本人通知ツール');assert.match(install.textContent,/最新版をインストール \/ 更新/);assert.match(html,/insight-release\.json/);assert.doesNotMatch(html,/本人通知 V\d/);assert.match(html,/ブラウザ別インストール/);assert.match(html,/URLを貼り付ける操作はありません/);assert.match(html,/確認ボタンも不要/)}finally{dom.window.close()}
});
