import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
const read=p=>fs.readFileSync(new URL('../public/'+p,import.meta.url),'utf8');
const runtime=read('note-insight-notification-runtime-v2958.js');
const reader=read('note-insight-notification-autoscan-v2970.js');
function env(){const dom=new JSDOM('<button id="bell" aria-label="通知">🔔</button><main><a class="m-navbarNoticeItem">背景の記事です3分前</a></main><section id="popup" role="dialog" hidden><button>通知</button><button>お知らせ</button><div id="list"></div></section>',{url:'https://note.com/',runScripts:'outside-only',pretendToBeVisual:true});const w=dom.window;w.HTMLElement.prototype.getBoundingClientRect=function(){return {width:320,height:200,left:0,top:40,right:320,bottom:240}};w.fetch=async()=>({ok:true,json:async()=>({data:{urlname:'fixture'}})});const values=new Map();w.GM={getValue:async(k,d)=>values.get(k)??d,setValue:async(k,v)=>values.set(k,v)};return{dom,w,values}}
function expose(w,src,names){w.eval(src.replace(/\}\)\(\);?\s*$/,'window.testAPI={'+names.join(',')+'};})();'));return w.testAPI}
test('bell capture works even when note stops bubbling; background rows never establish a shell',async()=>{const{dom,w}=env();const api=expose(w,runtime,['findNoticeShell','maintenance','frameHtml']);try{assert.equal(api.findNoticeShell(),null);const bell=w.document.getElementById('bell');bell.addEventListener('click',e=>{e.stopPropagation();w.document.getElementById('popup').hidden=false;w.document.getElementById('list').innerHTML='<a class="m-navbarNoticeItem">未知の通知3分前</a>'});bell.click();assert.ok(w.document.getElementById('mumei-v2948-frame'));assert.equal(api.findNoticeShell().id,'popup');await api.maintenance();const f=w.document.getElementById('mumei-v2948-frame');assert.equal(f.style.display,'block');assert.match(api.frameHtml(),/repeat\(4,minmax\(0,1fr\)\)/);w.document.getElementById('popup').hidden=true;await api.maintenance();assert.equal(f.style.display,'none')}finally{dom.window.close()}});
test('reader preserves unknown rows and root article links, scans bottom-to-top and rejects unconfirmed saves',async()=>{const{dom,w,values}=env();try{const popup=w.document.getElementById('popup');popup.hidden=false;popup.setAttribute('data-mumei-notice-shell-v2958','1');w.document.getElementById('list').innerHTML='<a class="m-navbarNoticeItem" data-notification-id="new" href="https://note.com/a/n/n1?c=c1">Aさんがあなたのコメントに返信しました3分前</a><a class="m-navbarNoticeItem" data-notification-id="old" href="https://note.com/a/m/m1">未知の通知3分前</a>';const api=expose(w,reader,['rows','rowData','findPanel','sendBatch','sig','scan']);assert.equal(api.findPanel().id,'popup');const rows=api.rows(popup);assert.equal(rows.length,2);const newer=api.rowData(rows[0]);assert.match(newer.target_url,/n1\?c=c1/);values.set('mumei_insight_notification_sync_token_v2:fixture','fixture-only');const sent=[];w.GM.xmlHttpRequest=o=>{const rs=JSON.parse(o.data).notifications;sent.push(...rs.map(x=>x.meta.event_identity));o.onload({status:200,responseText:JSON.stringify({ok:true,confirmedClientSignatures:rs.map(api.sig)})})};await api.scan();assert.deepEqual(sent,['notice:old','notice:new']);assert.equal(values.get('mumei_insight_notification_saved_v2919:fixture').length,2);const saved=new Set();w.GM.xmlHttpRequest=o=>o.onload({status:200,responseText:'{"ok":true,"confirmedClientSignatures":[]}'});await assert.rejects(api.sendBatch([newer],{id:'fixture'},saved),/未保存/);assert.equal(saved.size,0)}finally{dom.window.close()}});

test('partial acknowledgement persists the confirmed checkpoint and retries only the missing row',async()=>{
 const{dom,w,values}=env();
 try{
  const api=expose(w,reader,['sendBatch','sig','readOutbox']),a={id:'fixture'},saved=new Set();
  values.set('mumei_insight_notification_sync_token_v2:fixture','fixture-only');
  const input=['old','new'].map(id=>({raw_text:id+'さんが返信しました',target_url:'https://note.com/a/n/n1',meta:{event_identity:'notice:'+id}}));
  w.GM.xmlHttpRequest=o=>o.onload({status:200,responseText:JSON.stringify({ok:true,confirmedClientSignatures:[api.sig(input[0])]})});
  await assert.rejects(api.sendBatch(input,a,saved),/未保存/);
  assert.equal(values.get('mumei_insight_notification_checkpoint_v2922:fixture').boundarySignature,api.sig(input[0]));
  assert.equal(api.readOutbox('fixture').length,1);
  assert.equal(api.readOutbox('fixture')[0].meta.event_identity,'notice:new');
  let count=0;
  w.GM.xmlHttpRequest=o=>{const rs=JSON.parse(o.data).notifications;count+=rs.length;o.onload({status:200,responseText:JSON.stringify({ok:true,confirmedClientSignatures:rs.map(api.sig)})})};
  await api.sendBatch(api.readOutbox('fixture'),a,saved);
  assert.equal(count,1);assert.equal(api.readOutbox('fixture').length,0);
  assert.equal(values.get('mumei_insight_notification_checkpoint_v2922:fixture').boundaryEventIdentity,'notice:new');
 }finally{w.close()}
});
test('pagehide retains unacknowledged captured rows, without claiming they were saved',async()=>{
 const{dom,w,values}=env();
 try{
  const popup=w.document.getElementById('popup');popup.hidden=false;popup.setAttribute('data-mumei-notice-shell-v2958','1');
  w.document.getElementById('list').innerHTML='<a class="m-navbarNoticeItem" data-notification-id="pending">Aさんが返信しました3分前</a>';
  values.set('mumei_insight_notification_sync_token_v2:fixture','fixture-only');
  const api=expose(w,reader,['scan','readOutbox']);let sent;
  const requested=new Promise(resolve=>{w.GM.xmlHttpRequest=o=>{sent=o;resolve()}});
  const scanning=api.scan();await requested;
  w.dispatchEvent(new w.Event('pagehide'));
  assert.equal(api.readOutbox('fixture').length,1);
  assert.equal(values.has('mumei_insight_notification_saved_v2919:fixture'),false);
  sent.onerror();await scanning;
  assert.equal(api.readOutbox('fixture').length,1);
  assert.equal(values.get('mumei_insight_notification_checkpoint_v2922:fixture').boundarySignature,undefined);
 }finally{w.close()}
});
test('completed initial history uses saved overlap without scrolling back to the oldest notification',async()=>{
 const{dom,w,values}=env();
 try{
  const popup=w.document.getElementById('popup');popup.hidden=false;popup.setAttribute('data-mumei-notice-shell-v2958','1');
  const list=w.document.getElementById('list');list.innerHTML='<a class="m-navbarNoticeItem" data-notification-id="old">Aさんが返信しました3分前</a>';
  values.set('mumei_insight_notification_sync_token_v2:fixture','fixture-only');
  const api=expose(w,reader,['scan','sig']);
  const sent=[];w.GM.xmlHttpRequest=o=>{const rs=JSON.parse(o.data).notifications;sent.push(...rs.map(r=>r.meta.event_identity));o.onload({status:200,responseText:JSON.stringify({ok:true,confirmedClientSignatures:rs.map(api.sig)})})};
  await api.scan();
  list.insertAdjacentHTML('afterbegin','<a class="m-navbarNoticeItem" data-notification-id="new">Bさんが返信しました1分前</a>');
  list.style.overflowY='auto';Object.defineProperty(list,'scrollHeight',{value:1000});Object.defineProperty(list,'clientHeight',{value:200});
  let moves=0;Object.defineProperty(list,'scrollTop',{get:()=>0,set:()=>{moves++}});
  await api.scan();
  assert.deepEqual(sent,['notice:old','notice:new']);assert.equal(moves,0);
 }finally{w.close()}
});
test('account change prevents transmitting the previous account outbox',async()=>{
 const{dom,w,values}=env();
 try{
  const api=expose(w,reader,['sendBatch','readOutbox']);values.set('mumei_insight_notification_sync_token_v2:fixture','fixture-only');
  w.fetch=async()=>({ok:true,json:async()=>({data:{urlname:'different'}})});
  let sent=false;w.GM.xmlHttpRequest=()=>{sent=true};
  await assert.rejects(api.sendBatch([{raw_text:'Aさんが返信しました',meta:{event_identity:'notice:1'}}],{id:'fixture'},new Set()),/NOTE_ACCOUNT_CHANGED/);
  assert.equal(sent,false);assert.equal(api.readOutbox('fixture').length,1);assert.equal(api.readOutbox('different').length,0);
 }finally{w.close()}
});
test('every active notification component parses before the loader can execute it',()=>{
 for(const name of ['note-insight-notification-dock-watch-v312.js','note-insight-notification-loader-v318.js','note-insight-dashboard-integrated-v318.js'])assert.doesNotThrow(()=>new Function(read(name)));
});
