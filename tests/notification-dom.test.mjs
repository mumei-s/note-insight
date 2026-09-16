import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';

const read=p=>fs.readFileSync(new URL('../public/'+p,import.meta.url),'utf8');
const dock=read('note-insight-notification-dock-watch-v312.js');
const reader=read('note-insight-notification-reader-v323.js');
const v3=read('note-insight-notification-v3.user.js');

function env(){
  const dom=new JSDOM('<button id="bell" aria-label="通知">🔔</button><main><section id="popup" role="dialog"><button>通知</button><button>お知らせ</button><div id="list"></div></section></main>',{url:'https://note.com/notifications',runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window;
  w.HTMLElement.prototype.getBoundingClientRect=function(){return {width:320,height:180,left:0,top:20,right:320,bottom:200}};
  w.fetch=async()=>({ok:true,json:async()=>({data:{urlname:'fixture'}})});
  const values=new Map();
  w.GM={getValue:async(k,d)=>values.get(k)??d,setValue:async(k,v)=>values.set(k,v)};
  return{dom,w,values};
}
function expose(w,src,names){w.eval(src.replace(/\}\)\(\);?\s*$/,'window.testAPI={'+names.join(',')+'};})();'));return w.testAPI}
function exposeDock(w){const src=dock.replace("if(document.body)boot();else document.addEventListener('DOMContentLoaded',boot,{once:true});\n})();","window.testAPI={findShell,showDock,ensureRoot};\n})();");w.eval(src);return w.testAPI}

test('active notification scripts parse',()=>{
  for(const name of ['note-insight-notification-dock-watch-v312.js','note-insight-notification-reader-v323.js','note-insight-notification-loader-v318.js','note-insight-dashboard-integrated-v318.js','note-insight-notification-v3.user.js'])assert.doesNotThrow(()=>new Function(read(name)));
});

test('dock shows four current controls and direct INSIGHT notification destination',()=>{
  const{dom,w}=env();
  try{
    const api=exposeDock(w),popup=w.document.getElementById('popup');
    popup.setAttribute('data-mumei-notice-shell-v3','1');
    w.document.getElementById('list').innerHTML='<a class="m-navbarNoticeItem">Aさんが返信しました 1分前</a>';
    assert.equal(api.findShell().id,'popup');
    api.showDock(true);
    const root=w.document.querySelector('[data-mumei-notification-dock="1"]');
    assert.ok(root);
    assert.equal(root.querySelectorAll('button').length,4);
    assert.equal(root.querySelector('[data-act="read"]').textContent,'手動読み込み');
    assert.equal(root.querySelector('[data-act="settings"]').textContent,'フィルター登録');
    assert.equal(root.querySelector('[data-act="ins"]').textContent,'INSIGHT');
    assert.match(dock,/INSIGHT='https:\/\/mumei-s\.github\.io\/note-insight\/\?insightMode=notifications#dashboard'/);
    assert.doesNotMatch(dock,/notification-entry\.html/);
  }finally{dom.window.close()}
});

test('reader extracts visible notifications and sends oldest first',async()=>{
  const{dom,w,values}=env();
  try{
    const popup=w.document.getElementById('popup');popup.setAttribute('data-mumei-notice-shell-v3','1');
    w.document.getElementById('list').innerHTML='<a class="m-navbarNoticeItem" data-notification-id="new" href="https://note.com/a/n/n1?c=c1">Aさんがあなたのコメントに返信しました3分前</a><a class="m-navbarNoticeItem" data-notification-id="old" href="https://note.com/a/m/m1">未知の通知3分前</a>';
    const api=expose(w,reader,['rows','rowData','panel','sendBatch','sig','scan']);
    assert.equal(api.panel().id,'popup');
    values.set('mumei_insight_notification_sync_token_v2:fixture','fixture-only');
    const sent=[];
    w.GM.xmlHttpRequest=o=>{const batch=JSON.parse(o.data).notifications;sent.push(...batch.map(x=>x.meta.event_identity));o.onload({status:200,responseText:JSON.stringify({ok:true,confirmedClientSignatures:batch.map(api.sig)})})};
    await api.scan();
    assert.deepEqual(sent,['notice:old','notice:new']);
    assert.equal(values.get('mumei_insight_notification_saved_v2919:fixture').length,2);
  }finally{dom.window.close()}
});

test('reader is incremental, marks saved boundary, and has no full-history fallback',()=>{
  assert.match(reader,/VERSION='3\.2\.23'/);
  assert.match(reader,/scan_mode:'incremental-top-to-checkpoint'/);
  assert.match(reader,/checkpoint-stop-v3223/);
  assert.match(reader,/ここまで保存済み/);
  assert.match(reader,/MAX_SCROLL_STEPS=42/);
  assert.match(reader,/MAX_READ_ROWS=420/);
  assert.match(reader,/読込中です。二重開始はしません。/);
  assert.match(reader,/BOUNDARY_NOT_FOUND_SAFE_STOP/);
  assert.doesNotMatch(reader,/loadAbsoluteBottom|fullFallback|全体照合へ切替/);
});

test('V3.2.23 wrapper ships current reader, filter registration, return restore and direct INSIGHT',()=>{
  const meta=v3.split('// ==/UserScript==')[0];
  assert.match(v3,/@version\s+3\.2\.23/);
  assert.match(meta,/note-insight-notification-reader-v323\.js\?v=3223/);
  assert.match(meta,/note-insight-notification-dock-watch-v312\.js\?v=3223/);
  assert.match(v3,/フィルター登録/);
  assert.match(v3,/notification-filter\.html\?from=note&v=3223/);
  assert.match(v3,/function captureNotificationReturn\(/);
  assert.match(v3,/function restoreNotificationReturn\(/);
  assert.match(v3,/note-insight\/\?insightMode=notifications#dashboard/);
  assert.doesNotMatch(v3,/notification-entry\.html\?from=note/);
});

test('installer opens only current V3.2.23 userscript and checks same-page runtime state',()=>{
  const html=read('tool-setup.html'),dom=new JSDOM(html,{url:'https://mumei-s.github.io/note-insight/tool-setup.html',runScripts:'outside-only'}),w=dom.window;
  try{
    w.eval(w.document.querySelector('script').textContent);
    const install=w.document.getElementById('install'),u=new URL(install.href);
    assert.equal(u.origin,'https://mumei-s.github.io');
    assert.equal(u.pathname,'/note-insight/note-insight-notification-v3.user.js');
    assert.match(w.document.querySelector('.version').textContent,/3\.2\.23/);
    assert.match(html,/mumei-notification-v3-loader/);
    assert.match(html,/URLを貼り付ける操作はありません/);
    assert.doesNotMatch(html,/2\.9\.27|script_installation\.php|https:\/\/note\.com\/notifications/);
  }finally{w.close()}
});