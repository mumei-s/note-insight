import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync('public/note-insight-notification-network-v3300.js','utf8');
function harness(shared={gm:new Map(),local:new Map(),saved:[]},options={}){
 let notices=[],apiCalls=0,accountCalls=0,onSave=null,rejectSave=false,badEnvelope=false,me='tester',localFailure='',removeBlocked=false,gmFailure=()=>false;
 const events=new EventTarget(),doc=new EventTarget();
 class CE extends Event{constructor(name,init){super(name);this.detail=init?.detail}}
 const storage={getItem:k=>{if(localFailure==='security')throw new Error('SecurityError');return shared.local.get(k)??null},setItem:(k,v)=>{if(localFailure)throw new Error('QuotaExceededError');shared.local.set(k,v)},removeItem:k=>{if(removeBlocked||localFailure==='security')throw new Error('SecurityError');shared.local.delete(k)}};
 const gm={getValue:async(k,d)=>shared.gm.get(k)??d,setValue:async(k,v)=>{if(gmFailure(k))throw new Error('fixture GM storage failure');shared.gm.set(k,structuredClone(v))},xmlHttpRequest:opts=>{
   const input=JSON.parse(opts.data),rows=input.notifications||[];
   if(!opts.url.includes('ingest'))return opts.onload({status:200,responseText:'{"ok":true}'});
   if(rejectSave){rejectSave=false;return opts.onerror()}
   shared.saved.push(...rows.map(r=>Number(r.meta.event_identity.slice(7))));
   onSave?.(rows);
   opts.onload({status:200,responseText:JSON.stringify({ok:true,confirmedClientSignatures:rows.map(r=>r.meta.client_signature)})});
 }};
 shared.gm.set('mumei_insight_notification_sync_token_v2:tester','fixture-token');
 const context={URL,Event,CustomEvent:CE,Element:class{},Map,Set,Date,Promise,JSON,Number,String,Boolean,Math,structuredClone,GM:gm,localStorage:storage,document:doc,location:{hostname:'note.com',origin:'https://note.com',href:'https://note.com/',pathname:'/'},AbortController,setTimeout:options.setTimeout||setTimeout,clearTimeout:options.clearTimeout||clearTimeout,addEventListener:events.addEventListener.bind(events),dispatchEvent:events.dispatchEvent.bind(events),fetch:async(url)=>{
  if(String(url).includes('current_user')){accountCalls++;return{ok:true,json:async()=>({data:{urlname:me}})}};
  apiCalls++;const u=new URL(url),per=Number(options.pageSize||u.searchParams.get('per')||12),page=Number(u.searchParams.get('page')||1),rows=notices.slice(((options.repeatPage?1:page)-1)*per,(options.repeatPage?1:page)*per),j=badEnvelope?{error:'bad page size'}:{data:rows,total_count:notices.length,next_page:page*per<notices.length?page+1:null};
  return{ok:true,status:200,headers:{get:()=> 'application/json'},json:async()=>j,text:async()=>JSON.stringify(j),clone(){return this}};
 }};
 context.window=context;vm.createContext(context);vm.runInContext(source,context);
 return{api:context.__mumeiNotificationNetwork3300,shared,gm,context,events,failLocal(kind='quota'){localFailure=kind},blockRemove(){removeBlocked=true},failGM(fn=()=>true){gmFailure=fn},setRows(rows){notices=rows},rows:()=>notices,bad(){badEnvelope=true},setNotices(n){notices=Array.from({length:n},(_,i)=>({id:n-i,kind:'note_comment_like',body:`人物さんがあなたのコメントにスキしました ${n-i}`,noticed_at:new Date(1700000000000+(n-i)*60000).toISOString(),action_users:[{name:'人物',url:'https://note.com/person'}]}))},setOnSave(fn){onSave=fn},rejectNext(){rejectSave=true},changeAccount(){me='other'},get calls(){return apiCalls},get accountCalls(){return accountCalls}};
}
async function pauseAfter20(h){h.setOnSave(()=>h.rejectNext());try{return await h.api.syncCurrent()}catch(e){assert.equal(e.progress.savedCount,20);return {saved:20,partial:true}}}
test('300件は画面を動かさず古い順に保存し、2回目は新着5件のみ',async()=>{
 const h=harness();h.setNotices(300);const first=await h.api.syncCurrent();assert.equal(first.received,300);assert.deepEqual(h.shared.saved,Array.from({length:300},(_,i)=>i+1));
 const before=h.calls;h.setNotices(305);const second=await h.api.syncCurrent();assert.equal(second.received,5);assert.equal(h.calls-before,2);assert.deepEqual(h.shared.saved.slice(-5),[301,302,303,304,305]);
 const third=await h.api.syncCurrent();assert.equal(third.saved,0);
});
test('20件確認後の通信失敗・新着によるページずれでも保存済みjournalから再開',async()=>{
 const h=harness();h.setNotices(300);const first=await pauseAfter20(h);assert.equal(first.saved,20);assert.equal(first.partial,true);
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

for(const failure of ['quota','security'])test(`note.com Storageの${failure}エラーでも300件を保存し、再起動後は差分5件だけ保存`,async()=>{
 const h=harness();h.shared.local.set('note-site-data','keep');h.shared.local.set('mumei_insight_notification_sync_token_v2:other','keep-other');h.failLocal(failure);h.setNotices(300);const first=await h.api.syncCurrent();assert.equal(first.saved,300);assert.equal(first.historyComplete,true);
 const resumed=harness(h.shared);resumed.failLocal(failure);resumed.setNotices(305);const delta=await resumed.api.syncCurrent();assert.equal(delta.saved,5);assert.equal(resumed.calls,2);assert.deepEqual(h.shared.saved,Array.from({length:305},(_,i)=>i+1));assert.equal(h.shared.local.get('note-site-data'),'keep');assert.equal(h.shared.local.get('mumei_insight_notification_sync_token_v2:other'),'keep-other');
});
test('容量不足と通信失敗が重なっても未送信分を保持し、再読込せず続きから保存',async()=>{
 const h=harness();h.failLocal();h.setNotices(12);h.rejectNext();await assert.rejects(h.api.syncCurrent());assert.equal(h.shared.saved.length,0);
 const resumed=harness(h.shared);resumed.failLocal();resumed.setNotices(15);await resumed.api.syncCurrent();assert.equal(resumed.calls,0);assert.deepEqual(h.shared.saved,Array.from({length:12},(_,i)=>i+1));await resumed.api.syncCurrent();assert.deepEqual(h.shared.saved.slice(-3),[13,14,15]);
});
test('旧ローカルの途中データを移行し、削除不能の古いコピーで保存位置を巻き戻さない',async()=>{
 const journalKey='mumei_notification_window_v360:tester',h=harness();h.setNotices(300);await pauseAfter20(h);
 const legacy={...h.shared.gm.get(journalKey)};delete legacy.__mumeiDurable;delete legacy.revision;assert.equal(legacy.schema,1);assert.equal(legacy.rows.length,280);h.shared.local.set(journalKey,JSON.stringify(legacy));h.shared.gm.delete(journalKey);
 const resumed=harness(h.shared);resumed.failLocal();resumed.blockRemove();resumed.setNotices(305);const result=await resumed.api.syncCurrent();assert.equal(result.saved,300);assert.equal(resumed.calls,0);
 const next=harness(h.shared);next.failLocal();next.blockRemove();next.setNotices(305);const delta=await next.api.syncCurrent();assert.equal(delta.saved,5);assert.deepEqual(h.shared.saved,Array.from({length:305},(_,i)=>i+1));
});
test('拡張保存の一時失敗はローカルへ退避し、復帰後は新しい途中データから再開',async()=>{
 const journalKey='mumei_notification_window_v360:tester',h=harness();h.failGM(k=>k===journalKey);h.setNotices(300);await pauseAfter20(h);assert.equal(h.shared.saved.length,20);
 const resumed=harness(h.shared);resumed.failLocal();resumed.setNotices(305);const result=await resumed.api.syncCurrent();assert.equal(result.saved,300);assert.equal(resumed.calls,0);assert.deepEqual(h.shared.saved,Array.from({length:300},(_,i)=>i+1));
});
test('両方の保存先が使えない時は送信前に止め、以前の保存位置と未送信データを維持',async()=>{
 const h=harness();h.setNotices(300);await pauseAfter20(h);const cpKey='mumei_insight_notification_checkpoint_v2922:tester',checkpoint=structuredClone(h.shared.gm.get(cpKey));
 const resumed=harness(h.shared);resumed.failLocal();resumed.failGM();await assert.rejects(resumed.api.syncCurrent(),/途中保存ができません/);assert.equal(h.shared.saved.length,20);assert.deepEqual(h.shared.gm.get(cpKey),checkpoint);
 const recovered=harness(h.shared);recovered.setNotices(305);await recovered.api.syncCurrent();assert.equal(recovered.calls,0);assert.deepEqual(h.shared.saved,Array.from({length:300},(_,i)=>i+1));
});

const tick=()=>new Promise(r=>setImmediate(r));
async function settles(p){let timer;try{return await Promise.race([p,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('reader is still waiting')),1000)})])}finally{clearTimeout(timer)}}
function clock(){const timers=new Map();let id=0;return{timers,setTimeout(fn,ms){timers.set(++id,{fn,ms});return id},clearTimeout(id){timers.delete(id)},fire(ms){const entry=[...timers].find(([,t])=>t.ms===ms);assert.ok(entry,`deadline ${ms} must exist`);timers.delete(entry[0]);entry[1].fn()}}}
test('69件取得後、Promiseだけを返す拡張通信でも保存確認まで進む',async()=>{
 const h=harness();h.setNotices(69);let requests=0;
 h.gm.xmlHttpRequest=opts=>{requests++;const rows=JSON.parse(opts.data).notifications;h.shared.saved.push(...rows.map(r=>Number(r.meta.event_identity.slice(7))));return Promise.resolve({status:200,responseText:JSON.stringify({ok:true,confirmedClientSignatures:rows.map(r=>r.meta.client_signature)})})};
 const result=await settles(h.api.syncCurrent());assert.equal(result.saved,69);assert.equal(requests,4);assert.equal(result.historyComplete,true);
});
test('保存通信が無応答でも期限で停止し、遅い応答を無視して取得済み69件から再開',async()=>{
 const timer=clock(),h=harness(undefined,timer),original=h.gm.xmlHttpRequest;let pending,aborted=0;h.setNotices(69);
 h.gm.xmlHttpRequest=opts=>{pending=opts;return{abort(){aborted++}}};
 const run=h.api.syncCurrent(),rejected=assert.rejects(run,/保存先の応答がありません/);await tick();timer.fire(45000);await settles(rejected);
 assert.equal(aborted,1);const jkey='mumei_notification_window_v360:tester';assert.equal(h.shared.gm.get(jkey).rows.length,69);assert.equal(h.shared.gm.get(jkey).saved,0);
 const old=JSON.parse(pending.data).notifications;pending.onload({status:200,responseText:JSON.stringify({ok:true,confirmedClientSignatures:old.map(r=>r.meta.client_signature)})});await tick();assert.equal(h.shared.gm.get(jkey).saved,0);
 const before=h.calls;h.gm.xmlHttpRequest=original;const next=await settles(h.api.syncCurrent());assert.equal(h.calls,before);assert.equal(next.saved,69);assert.equal(timer.timers.size,0);
});
test('保存前の本人確認が無応答でも期限で解除し、未保存データを保持する',async()=>{
 const timer=clock(),h=harness(undefined,timer),original=h.context.fetch;h.setNotices(69);let accounts=0,signal;
 h.context.fetch=(url,init)=>{if(String(url).includes('current_user')&&++accounts>1){signal=init?.signal;return new Promise(()=>{})}return original(url,init)};
 const run=h.api.syncCurrent(),rejected=assert.rejects(run,/本人確認が時間切れ/);await tick();h.api.stop();assert.equal(signal.aborted,false,'停止は保存の本人照合を中断しない');timer.fire(15000);await settles(rejected);assert.equal(signal.aborted,true);
 h.context.fetch=original;const before=h.calls,next=await settles(h.api.syncCurrent());assert.equal(next.saved,69);assert.equal(h.calls,before);
});
test('通知本文の受信が止まっても期限で解除し、未取得のページから再開',async()=>{
 const timer=clock(),h=harness(undefined,timer),original=h.context.fetch;h.setNotices(24);
 h.context.fetch=async(url,init)=>{const res=await original(url,init);if(String(url).includes('page=2'))res.text=()=>new Promise(()=>{});return res};
 const run=h.api.syncCurrent(),rejected=assert.rejects(run,/通知の取得が時間切れ/);await tick();timer.fire(15000);await settles(rejected);
 const journal=h.shared.gm.get('mumei_notification_window_v360:tester');assert.equal(journal.rows.length,12);assert.match(journal.nextRequest.url,/page=2/);h.context.fetch=original;const next=await settles(h.api.syncCurrent());assert.equal(next.saved,24);
});
test('送信中に停止しても確認応答を待ち、取得済み全69件を保存する',async()=>{
 const h=harness(),original=h.gm.xmlHttpRequest;h.setNotices(69);let pending,aborted=0;
 h.gm.xmlHttpRequest=opts=>{pending=opts;return {abort(){aborted++}}};const run=h.api.syncCurrent();await tick();h.api.stop();await tick();assert.equal(aborted,0);assert.equal(h.shared.gm.get('mumei_notification_network_outbox_v331:tester').length,20);
 h.gm.xmlHttpRequest=original;original(pending);const result=await settles(run);assert.equal(result.saved,69);assert.equal(result.historyComplete,true);assert.deepEqual(h.shared.saved,Array.from({length:69},(_,i)=>i+1));
});
test('次ページの待機中に別ページへ移動しても、取得済みページは保存し、残りから再開する',async()=>{
 const h=harness(),original=h.context.fetch;h.setNotices(24);let waiting=false;
 h.context.fetch=(url,init)=>{if(String(url).includes('page=2')){waiting=true;return new Promise(()=>{})}return original(url,init)};
 const run=h.api.syncCurrent();await tick();assert.equal(waiting,true);h.events.dispatchEvent(new Event('popstate'));const result=await settles(run);assert.equal(result.saved,12);assert.equal(result.partial,true);assert.equal(h.shared.gm.get('mumei_notification_window_v360:tester').phase,'collect');
 h.context.fetch=original;const next=await settles(h.api.syncCurrent());assert.equal(next.saved,24);assert.deepEqual(h.shared.saved,[...Array.from({length:12},(_,i)=>i+13),...Array.from({length:12},(_,i)=>i+1)]);
});

 test('新着なしの同期はnote本人確認と1ページのみで、保存済み通知を再送しない',async()=>{
 const h=harness();h.setNotices(12);await h.api.syncCurrent();
 const accounts=h.accountCalls,pages=h.calls,saved=h.shared.saved.length;
 const result=await h.api.syncCurrent();
 assert.equal(result.historyComplete,true);assert.equal(result.saved,0);
 assert.equal(h.accountCalls-accounts,1);assert.equal(h.calls-pages,1);assert.equal(h.shared.saved.length,saved);
 });

async function finishWindows(h){let result;for(let i=0;i<10;i++){result=await h.api.syncCurrent();if(result.historyComplete)return result}assert.fail('history did not complete within fixture windows')}
test('初回650件をスクロールせず複数ウィンドウで全件保存し、最終ラインは最新通知',async()=>{
 const h=harness();h.setNotices(650);const first=await h.api.syncCurrent();assert.equal(first.saved,300);assert.equal(first.historyComplete,false);assert.equal(first.partial,true);
 await finishWindows(h);assert.equal(h.shared.saved.length,650);assert.equal(new Set(h.shared.saved).size,650);
 const cp=h.shared.gm.get('mumei_insight_notification_checkpoint_v2922:tester');assert.equal(cp.boundaryEventIdentity,'notice:650');
 const before=h.calls;const next=await h.api.syncCurrent();assert.equal(next.saved,0);assert.equal(h.calls-before,1);
});
test('旧版が300件で完了扱いした履歴を一度だけ全走査し、保存済みは再送しない',async()=>{
 const h=harness();h.setNotices(300);await finishWindows(h);
 const historyKey=[...h.shared.gm.keys()].find(k=>k.includes('history')&&h.shared.gm.get(k)?.frontierSig);assert.ok(historyKey);
 const state=h.shared.gm.get(historyKey);delete state.completionSchema;h.shared.gm.set(historyKey,state);
 const old=h.rows();const older=Array.from({length:350},(_,i)=>({...old[0],id:-i,body:`古い通知 ${i}`,noticed_at:new Date(1600000000000-i*60000).toISOString()}));h.setRows([...old,...older]);
 await finishWindows(h);assert.equal(h.shared.saved.length,650);assert.equal(h.shared.gm.get(historyKey).completionSchema,2);
 const before=h.calls;await h.api.syncCurrent();assert.equal(h.calls-before,1);assert.equal(h.shared.saved.length,650);
});
test('初回途中の保存失敗は残りを保持し、再起動後に650件全件を確認する',async()=>{
 const h=harness();h.setNotices(650);await pauseAfter20(h);const resumed=harness(h.shared);resumed.setNotices(650);
 resumed.setOnSave(null);await finishWindows(resumed);assert.equal(h.shared.saved.length,650);assert.equal(new Set(h.shared.saved).size,650);
});
test('保存済み境界より新しい650件もウィンドウを継続し、同時刻のIDを失わない',async()=>{
 const h=harness();h.setNotices(12);await finishWindows(h);h.setNotices(662);h.setRows(h.rows().map(r=>Number(r.id)>12?{...r,noticed_at:'2026-10-20T00:00:00Z'}:r));await finishWindows(h);
 assert.equal(h.shared.saved.length,662);assert.equal(new Set(h.shared.saved).size,662);const before=h.calls;assert.equal((await h.api.syncCurrent()).saved,0);assert.equal(h.calls-before,1);
});
test('1500件の初回保存後も最新ページの確認済み署名を保持し、次回は再送しない',async()=>{
 const h=harness();h.setNotices(1500);await finishWindows(h);assert.equal(h.shared.saved.length,1500);
 const before=h.calls,result=await h.api.syncCurrent();assert.equal(result.historyComplete,true);assert.equal(result.saved,0);assert.equal(h.calls-before,1);assert.equal(h.shared.saved.length,1500);
});
for(const pageSize of [7,17])test(`APIページ${pageSize}件でも途中ページを切り捨てず全430件を保存`,async()=>{
 const h=harness(undefined,{pageSize});h.setNotices(430);await finishWindows(h);assert.equal(h.shared.saved.length,430);assert.equal(new Set(h.shared.saved).size,430);
});
test('APIが同じページを返し続ける場合は無限走査せず未保存通知を保持する',async()=>{
 const h=harness(undefined,{repeatPage:true});h.setNotices(650);await assert.rejects(h.api.syncCurrent(),/同じページ/);assert.equal(h.calls,2);assert.equal(h.shared.saved.length,0);const journal=h.shared.gm.get('mumei_notification_window_v360:tester');assert.equal(journal.rows.length,12);
});
test('旧版の未完了journalを捨てず保存後に完全走査し、完了証明を新しくする',async()=>{
 const h=harness();h.setNotices(650);await pauseAfter20(h);const key='mumei_notification_window_v360:tester',journal=h.shared.gm.get(key);delete journal.completionSchema;h.shared.gm.set(key,journal);
 const resumed=harness(h.shared);resumed.setNotices(650);await finishWindows(resumed);assert.equal(h.shared.saved.length,650);assert.equal(new Set(h.shared.saved).size,650);
 const before=resumed.calls;assert.equal((await resumed.api.syncCurrent()).saved,0);assert.equal(resumed.calls-before,1);
});
test('途中でnote本人が変われば未送信分を別アカウントに保存しない',async()=>{
 const h=harness();h.setNotices(650);h.setOnSave(()=>h.changeAccount());await assert.rejects(h.api.syncCurrent(),/NOTE_ACCOUNT_CHANGED/);assert.equal(h.shared.saved.length,20);const journal=h.shared.gm.get('mumei_notification_window_v360:tester');assert.equal(journal.saved,20);assert.equal(journal.rows.length,280);
});
