import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync('public/note-insight-notification-network-v3300.js','utf8');
function harness(shared={gm:new Map(),local:new Map(),saved:[]}){
 let notices=[],apiCalls=0,onSave=null,rejectSave=false,badEnvelope=false,me='tester';
 const events=new EventTarget(),doc=new EventTarget();
 class CE extends Event{constructor(name,init){super(name);this.detail=init?.detail}}
 const storage={getItem:k=>shared.local.get(k)??null,setItem:(k,v)=>shared.local.set(k,v)};
 const gm={getValue:async(k,d)=>shared.gm.get(k)??d,setValue:async(k,v)=>shared.gm.set(k,structuredClone(v)),xmlHttpRequest:opts=>{
   const input=JSON.parse(opts.data),rows=input.notifications||[];
   if(!opts.url.includes('ingest'))return opts.onload({status:200,responseText:'{"ok":true}'});
   if(rejectSave){rejectSave=false;return opts.onerror()}
   shared.saved.push(...rows.map(r=>Number(r.meta.event_identity.slice(7))));
   onSave?.(rows);
   opts.onload({status:200,responseText:JSON.stringify({ok:true,confirmedClientSignatures:rows.map(r=>r.meta.client_signature)})});
 }};
 shared.gm.set('mumei_insight_notification_sync_token_v2:tester','fixture-token');
 const context={URL,Event,CustomEvent:CE,Element:class{},Map,Set,Date,Promise,JSON,Number,String,Boolean,Math,structuredClone,GM:gm,localStorage:storage,document:doc,location:{hostname:'note.com',origin:'https://note.com',href:'https://note.com/',pathname:'/'},setTimeout,clearTimeout,addEventListener:events.addEventListener.bind(events),dispatchEvent:events.dispatchEvent.bind(events),fetch:async(url)=>{
  if(String(url).includes('current_user'))return{ok:true,json:async()=>({data:{urlname:me}})};
  apiCalls++;const u=new URL(url),per=Number(u.searchParams.get('per')||12),page=Number(u.searchParams.get('page')||1),rows=notices.slice((page-1)*per,page*per),j=badEnvelope?{error:'bad page size'}:{data:rows,total_count:notices.length,next_page:page*per<notices.length?page+1:null};
  return{ok:true,status:200,headers:{get:()=> 'application/json'},json:async()=>j,text:async()=>JSON.stringify(j),clone(){return this}};
 }};
 context.window=context;vm.createContext(context);vm.runInContext(source,context);
 return{api:context.__mumeiNotificationNetwork3300,shared,setRows(rows){notices=rows},rows:()=>notices,bad(){badEnvelope=true},setNotices(n){notices=Array.from({length:n},(_,i)=>({id:n-i,kind:'note_comment_like',body:`人物さんがあなたのコメントにスキしました ${n-i}`,noticed_at:new Date(1700000000000+(n-i)*60000).toISOString(),action_users:[{name:'人物',url:'https://note.com/person'}]}))},setOnSave(fn){onSave=fn},rejectNext(){rejectSave=true},changeAccount(){me='other'},get calls(){return apiCalls}};
}
test('300件は画面を動かさず古い順に保存し、2回目は新着5件のみ',async()=>{
 const h=harness();h.setNotices(300);const first=await h.api.syncCurrent();assert.equal(first.received,300);assert.deepEqual(h.shared.saved,Array.from({length:300},(_,i)=>i+1));
 const before=h.calls;h.setNotices(305);const second=await h.api.syncCurrent();assert.equal(second.received,5);assert.equal(h.calls-before,2);assert.deepEqual(h.shared.saved.slice(-5),[301,302,303,304,305]);
 const third=await h.api.syncCurrent();assert.equal(third.saved,0);
});
test('20件確認後の停止・新着によるページずれでも保存済みjournalから再開',async()=>{
 const h=harness();h.setNotices(300);h.setOnSave(()=>h.api.stop());const first=await h.api.syncCurrent();assert.equal(first.saved,20);assert.equal(first.partial,true);
 const resumed=harness(h.shared);resumed.setNotices(305);const next=await resumed.api.syncCurrent();assert.equal(resumed.calls,0);assert.equal(next.saved,300);assert.deepEqual(h.shared.saved,Array.from({length:300},(_,i)=>i+1));
 await resumed.api.syncCurrent();assert.deepEqual(h.shared.saved.slice(-5),[301,302,303,304,305]);
});
test('通信失敗では保存境界を進めず、再起動後に未送信分を保存',async()=>{
 const h=harness();h.setNotices(12);h.rejectNext();await assert.rejects(h.api.syncCurrent());assert.equal(h.shared.saved.length,0);const resumed=harness(h.shared);resumed.setNotices(12);await resumed.api.syncCurrent();assert.equal(resumed.calls,0);assert.deepEqual(h.shared.saved,Array.from({length:12},(_,i)=>i+1));
});
test('手動・自動の同時実行は同じ読取に合流',async()=>{const h=harness();h.setNotices(15);const a=h.api.syncCurrent(),b=h.api.syncCurrent();assert.equal(a,b);await Promise.all([a,b]);assert.equal(h.shared.saved.length,15)});
test('ネットワーク取得経路にscroll操作がない',()=>{const reader=readFileSync('public/note-insight-notification-reader-v4.js','utf8');assert.doesNotMatch(reader,/scrollTop\s*=|\.scrollTo\(|autoReadVisibleWindow/);assert.match(reader,/net\.syncCurrent/)});

test('前回の先頭通知が消えても保存済みの別通知で止まり、全ページを再走査しない',async()=>{const h=harness();h.setNotices(300);await h.api.syncCurrent();const before=h.calls;h.setNotices(299);const next=await h.api.syncCurrent();assert.equal(next.saved,0);assert.equal(h.calls-before,1)});

test('既読行の下にある新着と、本文が更新されたまとめ通知も保存する',async()=>{const h=harness();h.setNotices(24);await h.api.syncCurrent();const old=h.rows();h.setNotices(25);const added=h.rows()[0];h.setRows([old[0],added,{...old[1],body:old[1].body+' 追記'},...old.slice(2)]);const r=await h.api.syncCurrent();assert.equal(r.saved,2);assert.deepEqual(h.shared.saved.slice(-2),[23,25]);const cp=h.shared.gm.get('mumei_insight_notification_checkpoint_v2922:tester');assert.match(cp.boundaryDisplayText,/25/);assert.equal(cp.boundaryEventIdentity,'notice:25')});
test('HTTP200のエラー応答を通知0件として完了させない',async()=>{const h=harness();h.bad();await assert.rejects(h.api.syncCurrent(),/NOTICE_API_UNEXPECTED/);assert.equal(h.shared.saved.length,0);assert.equal(h.shared.gm.get('mumei_insight_notification_checkpoint_v2922:tester').lastRunComplete,false)});
