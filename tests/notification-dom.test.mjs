import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';

const read=p=>fs.readFileSync(new URL('../public/'+p,import.meta.url),'utf8');
const dock=read('note-insight-notification-dock-watch-v312.js');
const reader=read('note-insight-notification-reader-v323.js');
const checkpoint=read('note-insight-notification-checkpoint-v325.js');
const runtime=read('note-insight-notification-runtime-v327.js');
const v3=read('note-insight-notification-v3.user.js');

function env(){
  const dom=new JSDOM('<button id="bell" aria-label="通知">🔔</button><main><section id="popup" role="dialog"><button>通知</button><button>お知らせ</button><div id="list"></div></section></main>',{url:'https://note.com/notifications',runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window;w.HTMLElement.prototype.getBoundingClientRect=function(){return {width:320,height:180,left:0,top:20,right:320,bottom:200}};w.fetch=async()=>({ok:true,json:async()=>({data:{urlname:'fixture'}})});const values=new Map();w.GM={getValue:async(k,d)=>values.get(k)??d,setValue:async(k,v)=>values.set(k,v)};return{dom,w,values};
}
function expose(w,src,names){w.eval(src.replace(/\}\)\(\);?\s*$/,'window.testAPI={'+names.join(',')+'};})();'));return w.testAPI}
function exposeDock(w){const tail="if(document.body)boot();else document.addEventListener('DOMContentLoaded',boot,{once:true});\n})();";const src=dock.replace(tail,"window.testAPI={findShell,ensureLauncher,ensureTray,setTray,showLauncher};\n})();");w.eval(src);return w.testAPI}

test('active notification scripts parse',()=>{
  for(const name of ['note-insight-notification-dock-watch-v312.js','note-insight-notification-reader-v323.js','note-insight-notification-checkpoint-v325.js','note-insight-notification-runtime-v327.js','note-insight-notification-loader-v318.js','note-insight-dashboard-integrated-v318.js','note-insight-notification-v3.user.js'])assert.doesNotThrow(()=>new Function(read(name)));
});

test('compact launcher expands to the four current actions',()=>{
  const{dom,w}=env();try{const api=exposeDock(w),popup=w.document.getElementById('popup');popup.setAttribute('data-mumei-notice-shell-v3','1');w.document.getElementById('list').innerHTML='<a class="m-navbarNoticeItem">Aさんが返信しました 1分前</a>';assert.equal(api.findShell().id,'popup');const launcher=api.ensureLauncher(),tray=api.ensureTray();assert.equal(launcher.textContent,'🔔 INSIGHT');assert.equal(tray.querySelectorAll('button').length,4);assert.equal(tray.querySelector('[data-act="read"]').textContent,'追加読込');assert.equal(tray.querySelector('[data-act="settings"]').textContent,'フィルター登録');assert.equal(tray.querySelector('[data-act="ins"]').textContent,'INSIGHT');api.showLauncher(true);api.setTray(true);assert.equal(tray.style.display,'grid');}finally{dom.window.close()}
});

test('reader extracts visible notifications and sends oldest first',async()=>{
  const{dom,w,values}=env();try{const popup=w.document.getElementById('popup');popup.setAttribute('data-mumei-notice-shell-v3','1');w.document.getElementById('list').innerHTML='<a class="m-navbarNoticeItem" data-notification-id="new" href="https://note.com/a/n/n1?c=c1">Aさんがあなたのコメントに返信しました3分前</a><a class="m-navbarNoticeItem" data-notification-id="old" href="https://note.com/a/m/m1">未知の通知3分前</a>';const api=expose(w,reader,['rows','rowData','panel','sendBatch','sig','scan']);assert.equal(api.panel().id,'popup');values.set('mumei_insight_notification_sync_token_v2:fixture','fixture-only');const sent=[];w.GM.xmlHttpRequest=o=>{const batch=JSON.parse(o.data).notifications;sent.push(...batch.map(x=>x.meta.event_identity));o.onload({status:200,responseText:JSON.stringify({ok:true,confirmedClientSignatures:batch.map(api.sig)})})};await api.scan();assert.deepEqual(sent,['notice:old','notice:new']);assert.equal(values.get('mumei_insight_notification_saved_v2919:fixture').length,2)}finally{dom.window.close()}
});

test('reader is incremental, marks saved boundary, and has no full-history fallback',()=>{assert.match(reader,/scan_mode:'incremental-top-to-checkpoint'/);assert.match(reader,/ここまで保存済み/);assert.match(reader,/BOUNDARY_NOT_FOUND_SAFE_STOP/);assert.doesNotMatch(reader,/loadAbsoluteBottom|fullFallback|全体照合へ切替/)});

test('persistent checkpoint mirrors the saved boundary across page closes',()=>{assert.match(checkpoint,/mumei_insight_notification_checkpoint_local_v325:/);assert.match(checkpoint,/localStorage\.setItem/);assert.match(checkpoint,/addEventListener\('pagehide'/);assert.match(checkpoint,/visibilitychange/);assert.match(checkpoint,/async function restore\(/);assert.match(checkpoint,/ここまで保存済み/)});

test('V3.2.30 wrapper uses compact launcher instead of obsolete five-button runtime',()=>{
  const meta=v3.split('// ==/UserScript==')[0];assert.match(v3,/@version\s+3\.2\.30/);assert.match(meta,/note-insight-notification-reader-v323\.js\?v=3230/);assert.match(meta,/note-insight-notification-checkpoint-v325\.js\?v=3230/);assert.match(meta,/note-insight-notification-dock-watch-v312\.js\?v=3230/);assert.doesNotMatch(meta,/note-insight-notification-runtime-v327\.js/);assert.match(v3,/compact-launcher-v3230/);assert.match(dock,/mumei-v3-launcher-v330/);assert.match(dock,/pointerdown/);assert.match(dock,/setTray\(!trayOpen\)/);assert.match(dock,/notification-filter\.html/);assert.match(dock,/note-insight\/\?insightMode=notifications#dashboard/);assert.doesNotMatch(dock,/textContent='読込部品エラー'/);assert.match(runtime,/VERSION='3\.2\.28'/);
});

test('installer opens canonical userscript and keeps visible copy versionless',async()=>{
  const html=read('tool-setup.html'),dom=new JSDOM(html,{url:'https://mumei-s.github.io/note-insight/tool-setup.html',runScripts:'outside-only'}),w=dom.window;try{w.fetch=async()=>({ok:true,json:async()=>({notificationVersion:'3.2.30'})});w.eval(w.document.querySelector('script').textContent);await new Promise(resolve=>setTimeout(resolve,0));const install=w.document.getElementById('install'),u=new URL(install.href);assert.equal(u.origin,'https://mumei-s.github.io');assert.equal(u.pathname,'/note-insight/note-insight-notification-v3.user.js');assert.equal(w.document.querySelector('.toolname').textContent,'本人通知ツール');assert.match(install.textContent,/最新版をインストール \/ 更新/);assert.match(html,/insight-release\.json/);assert.doesNotMatch(html,/本人通知 V\d/);assert.match(html,/ブラウザ別インストール/);assert.match(html,/URLを貼り付ける操作はありません/);assert.match(html,/確認ボタンも不要/)}finally{dom.window.close()}
});
