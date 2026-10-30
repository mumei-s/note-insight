import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync('public/note-insight-notification-network-v3300.js','utf8');
const TOKEN='mumei_insight_notification_sync_token_v2:',OUTBOX='mumei_notification_network_outbox_v331:',JOURNAL='mumei_notification_window_v360:';
const pause=()=>new Promise(resolve=>setTimeout(resolve,0));
function fixture(){
 const storage=new Map([[TOKEN+'tester','fictional-token-a'],[TOKEN+'other','fictional-token-b']]),reads=[],writes=[],posts=[],saved=[],events=new EventTarget(),document=new EventTarget();
 let rows=[],pageCalls=0,accountCalls=0,current='tester',accountReply=null,onSave=null,onPage=null;
 class CE extends Event{constructor(type,init){super(type);this.detail=init?.detail}}
 const GM={getValue:async(k,d)=>{reads.push(k);return storage.get(k)??d},setValue:async(k,v)=>{writes.push(k);storage.set(k,structuredClone(v))},xmlHttpRequest:request=>{
  const body=JSON.parse(request.data);posts.push({url:request.url,body,token:request.headers['X-Ingest-Token']});
  assert.ok(request.url.includes('/insight-notification-ingest-v2'),'no diagnostic or unexpected POST');
  const notifications=body.notifications||[];saved.push(...notifications.map(row=>Number(row.meta.event_identity.slice(7))));onSave?.();
  request.onload({status:200,responseText:JSON.stringify({ok:true,confirmedClientSignatures:notifications.map(row=>row.meta.client_signature)})});
 }};
 const fetch=async url=>{
  if(String(url).includes('current_user')){accountCalls++;return{ok:true,json:async()=>({data:{urlname:accountReply?.(accountCalls)||current}})}}
  pageCalls++;onPage?.(pageCalls);const u=new URL(url),page=Number(u.searchParams.get('page')||1),per=Number(u.searchParams.get('per')||12),data=rows.slice((page-1)*per,page*per),payload={data,total_count:rows.length,next_page:page*per<rows.length?page+1:null};
  return{ok:true,status:200,headers:{get:()=> 'application/json'},json:async()=>payload,text:async()=>JSON.stringify(payload),clone(){return this}};
 };
 const context={URL,Event,CustomEvent:CE,Element:class{},Map,Set,Date,Promise,JSON,Number,String,Boolean,Math,structuredClone,GM,localStorage:{getItem:()=>null,setItem(){},removeItem(){}},document,location:{hostname:'note.com',origin:'https://note.com',href:'https://note.com/',pathname:'/'},AbortController,setTimeout,clearTimeout,addEventListener:events.addEventListener.bind(events),dispatchEvent:events.dispatchEvent.bind(events),fetch};
 context.window=context;vm.createContext(context);vm.runInContext(source,context);
 return{api:context.__mumeiNotificationNetwork3300,storage,reads,writes,posts,saved,setRows(count){rows=Array.from({length:count},(_,i)=>({id:count-i,kind:'note_comment_like',body:`架空の人物さんがあなたのコメントにスキしました ${count-i}`,noticed_at:new Date(1700000000000+(count-i)*60000).toISOString(),action_users:[{name:'架空の人物',url:'https://note.com/fictional_person'}]}))},setRawRows(value){rows=value},onPage(fn){onPage=fn},accountReply(fn){accountReply=fn},changeAccount(id){current=id},onSave(fn){onSave=fn},get pageCalls(){return pageCalls},get accountCalls(){return accountCalls}};
}

test('300件の通知payloadは25ページ、新着5件は2ページのまま、各受信ページの本人確認だけ追加する',async()=>{
 const f=fixture();f.setRows(300);const first=await f.api.syncCurrent();assert.equal(first.saved,300);assert.equal(f.pageCalls,25);assert.equal(f.accountCalls,56,'開始時1回＋受信ページごと25回＋各20件の保存前・送信直前30回');
 assert.equal(new Set(f.saved).size,300);const pages=f.pageCalls,accounts=f.accountCalls;f.setRows(305);const next=await f.api.syncCurrent();assert.equal(next.saved,5);assert.equal(f.pageCalls-pages,2);assert.equal(f.accountCalls-accounts,5,'従来の保存前3回＋受信ページ本人確認2回');assert.deepEqual(f.saved.slice(-5),[301,302,303,304,305]);
 const noNewPages=f.pageCalls,noNewAccounts=f.accountCalls;const noNew=await f.api.syncCurrent();assert.equal(noNew.saved,0);assert.equal(f.pageCalls-noNewPages,1);assert.equal(f.accountCalls-noNewAccounts,2,'開始時と取得した1ページの本人を照合');
});

test('journal所有者とingest開始時の本人が違えば他アカウントのtokenもoutboxも読まない',async()=>{
 const f=fixture();f.setRows(24);f.accountReply(count=>count<=3?'tester':'other');await assert.rejects(f.api.syncCurrent(),/NOTE_ACCOUNT_CHANGED/);
 assert.equal(f.posts.length,0);assert.equal(f.accountCalls,4);assert.ok(!f.reads.some(key=>key.endsWith(':other')),'他アカウントの連携情報やoutboxを読まない');assert.ok(!f.writes.some(key=>key.endsWith(':other')));
 assert.equal(f.storage.get(JOURNAL+'tester').rows.length,24,'未送信の通知は元のjournalに残す');assert.equal(f.storage.has(OUTBOX+'other'),false);
 f.accountReply(null);const resumed=await f.api.syncCurrent();assert.equal(resumed.saved,24);assert.equal(new Set(f.saved).size,24);assert.ok(f.posts.every(post=>post.body.noteId==='tester'&&post.token==='fictional-token-a'));
});

test('outbox作成後でも送信直前に本人が変わればPOSTせず元アカウントの途中保存を残す',async()=>{
 const f=fixture();f.setRows(24);f.accountReply(count=>count<5?'tester':'other');await assert.rejects(f.api.syncCurrent(),/NOTE_ACCOUNT_CHANGED/);
 assert.equal(f.posts.length,0);assert.equal(f.storage.get(OUTBOX+'tester').length,20);assert.equal(f.storage.get(JOURNAL+'tester').rows.length,24);assert.ok(!f.writes.some(key=>key.endsWith(':other')));assert.ok(!f.reads.some(key=>key.endsWith(':other')));
 f.accountReply(null);const resumed=await f.api.syncCurrent();assert.equal(resumed.saved,24);assert.equal(new Set(f.saved).size,24);assert.equal(f.storage.get(OUTBOX+'tester').length,0);
});

test('前のACK後に本人が変わっても次の20件を別アカウントへ移さず再開できる',async()=>{
 const f=fixture();f.setRows(48);let switched=false;f.onSave(()=>{if(!switched){switched=true;f.changeAccount('other')}});await assert.rejects(f.api.syncCurrent(),/NOTE_ACCOUNT_CHANGED/);
 assert.equal(f.saved.length,20);assert.ok(f.storage.get(JOURNAL+'tester').rows.length>0);assert.ok(!f.writes.some(key=>key.endsWith(':other')));assert.ok(!f.reads.some(key=>key.endsWith(':other')));assert.ok(f.posts.every(post=>post.body.noteId==='tester'));
 f.changeAccount('tester');f.onSave(null);await f.api.syncCurrent();assert.equal(new Set(f.saved).size,48);assert.equal(f.saved.length,48);await pause();
});

for(const switchPage of [1,2])test(`通知${switchPage}ページ目の受信中に本人が変わっても、元のjournalへ相手の通知を保持せず復帰後に再取得する`,async()=>{
 const f=fixture();f.setRows(24);
 f.onPage(page=>{if(page===switchPage){f.changeAccount('other');f.setRawRows(Array.from({length:24},(_,i)=>({id:924-i,kind:'note_comment_like',body:'別本人の非公開通知 '+(924-i),noticed_at:'2026-10-30T00:00:00Z',action_users:[{name:'別本人',url:'https://note.com/other'}]})))}});
 await assert.rejects(f.api.syncCurrent(),/NOTE_ACCOUNT_CHANGED/);
 const journal=f.storage.get(JOURNAL+'tester');assert.equal(journal.rows.length,(switchPage-1)*12,'直前までに本人確認済みの行だけを保持');assert.ok(journal.rows.every(row=>!row.raw_text.includes('別本人の非公開通知')));assert.equal(f.posts.length,0);assert.equal(f.storage.has(JOURNAL+'other'),false);
 assert.equal(journal.nextRequest?Number(new URL(journal.nextRequest.url).searchParams.get('page')):1,switchPage,'未確認のページへカーソルを進めない');
 f.onPage(null);f.changeAccount('tester');f.setRows(24);const before=f.pageCalls;await f.api.syncCurrent();
 assert.equal(f.pageCalls-before,3-switchPage,'本人復帰後は未確認ページから取得する');assert.deepEqual([...f.saved].sort((a,b)=>a-b),Array.from({length:24},(_,i)=>i+1));assert.ok(f.posts.every(post=>post.body.noteId==='tester'&&post.token==='fictional-token-a'&&post.body.notifications.every(row=>!row.raw_text.includes('別本人の非公開通知'))));
});
