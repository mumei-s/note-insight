import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
import {JSDOM} from 'jsdom';
const source=readFileSync('public/note-insight-dashboard-save-queue-v1.js','utf8');
const payload={action:'ingest',noteId:'tester',articles:[{key:'n1',title:'保存する記事'}],metricSeries:[{date:'2026-09-26',pageViews:0}],chartSeries:[],totals:{pageViews:0,likes:null},contentSections:{article:{scope:'partial-read'}}};
function page(t,{stored=[],account='tester',failConfirm=false,url='https://note.com/tester/n/n2',quota=false,gmStore,legacy=false,failIngest=false,failQueueClear=false}={}){
 const dom=new JSDOM('<main></main>',{url,runScripts:'outside-only'}),w=dom.window;t.after(()=>w.close());Object.defineProperty(w.crypto,'subtle',{value:webcrypto.subtle});w.TextEncoder=TextEncoder;
 for(const[k,v]of stored)w.localStorage.setItem(k,v);w.localStorage.setItem('mumei-dashboard-note-id-v1','tester');w.localStorage.setItem('mumei-dashboard-ingest-token-v1','secret-token');
 if(quota)w.Storage.prototype.setItem=function(){throw new w.DOMException('Storage quota reached','QuotaExceededError')};
 if(gmStore){const get=(k,d)=>gmStore.get(k)??d,set=(k,v)=>{if(failQueueClear&&k.startsWith('mumei-dashboard-save-queue-v1:')&&v==='[]')throw Error('Could not clear local queue');return gmStore.set(k,v)};if(legacy){w.GM_getValue=get;w.GM_setValue=set}else w.GM={getValue:async(...a)=>get(...a),setValue:async(...a)=>{await new Promise(r=>setTimeout(r,5));return set(...a)}}}
 const calls=[];w.fetch=async()=>Response.json({data:{urlname:account}});
 w.GM_xmlhttpRequest=o=>{const b=JSON.parse(o.data);calls.push(b);queueMicrotask(()=>{if(b.action==='ingest'&&failIngest||b.action==='sync-status'&&failConfirm)return o.onerror();o.onload({status:200,responseText:JSON.stringify(b.action==='ingest'?{ok:true,snapshotId:42}:{ok:true,noteId:'tester',snapshotId:42,confirmed:true,articleCount:1,dailyMetricCount:1,dailyPvDays:1,totals:{pageViews:0}})})})};w.eval(source);
 return{w,calls,q:w.__mumeiDashboardSaveQueueV1,stored:()=>Object.entries(w.localStorage)};
}
test('保存確認だけ失敗しても、別ページで復元して確認だけを再試行する',async t=>{
 const a=page(t,{failConfirm:true}),key=await a.q.prepare('tester','secret-token'),pending={payload};a.q.stage(key,pending);
 await assert.rejects(a.q.flush(key,pending.queueId),/NETWORK_ERROR/);assert.equal(a.calls.filter(r=>r.action==='ingest').length,1);
 assert.doesNotMatch(a.w.localStorage.getItem(key),/secret-token/);assert.equal(JSON.parse(a.w.localStorage.getItem(key))[0].saved.snapshotId,42);
 const b=page(t,{stored:a.stored()});const result=await b.q.flush(key,pending.queueId);
 assert.equal(result.verified.confirmed,true);assert.deepEqual(b.calls.map(r=>r.action),['sync-status']);assert.deepEqual(JSON.parse(b.w.localStorage.getItem(key)),[]);
});
test('noteの実アカウントが変われば別の人の保存待ちデータを送信しない',async t=>{
 const a=page(t,{account:'other'}),key=await a.q.prepare('tester','secret-token'),pending={payload};a.q.stage(key,pending);
 await assert.rejects(a.q.flush(key,pending.queueId),/ACCOUNT_MISMATCH/);assert.equal(a.calls.length,0);assert.equal(JSON.parse(a.w.localStorage.getItem(key)).length,1);
});
test('同じ保存の同時要求は一度だけ送信し、どちらも同じ保存結果を受け取る',async t=>{
 const a=page(t),key=await a.q.prepare('tester','secret-token'),pending={payload};a.q.stage(key,pending);
 const[x,y]=await Promise.all([a.q.flush(key,pending.queueId),a.q.flush(key,pending.queueId)]);assert.equal(x.saved.snapshotId,y.saved.snapshotId);assert.equal(a.calls.filter(r=>r.action==='ingest').length,1);
});
for(const legacy of [false,true])test('noteの容量不足でもツール側へ退避し、別ページで保存確認だけを続ける：'+(legacy?'legacy':'modern'),async t=>{
 const gmStore=new Map(),a=page(t,{quota:true,gmStore,legacy,failConfirm:true}),key=await a.q.prepare('tester','secret-token'),pending={payload};assert.doesNotThrow(()=>a.q.stage(key,pending));
 await assert.rejects(a.q.flush(key,pending.queueId),/NETWORK_ERROR/);await a.q.settled(key);assert.equal(JSON.parse(gmStore.get(key))[0].saved.snapshotId,42);assert.doesNotMatch(gmStore.get(key),/secret-token/);
 const b=page(t,{quota:true,gmStore,legacy});await b.q.prepare('tester','secret-token');const result=await b.q.flush(key,pending.queueId);assert.equal(result.verified.confirmed,true);assert.deepEqual(b.calls.map(r=>r.action),['sync-status']);assert.deepEqual(JSON.parse(gmStore.get(key)),[]);
 const again=await b.q.flush(key,pending.queueId);assert.equal(again.saved.snapshotId,42);assert.equal(b.calls.length,1);
});
test('容量不足と通信失敗が重なっても退避した取得分を復元し、アカウントが違えば送らない',async t=>{
 const gmStore=new Map(),a=page(t,{quota:true,gmStore,failIngest:true}),key=await a.q.prepare('tester','secret-token'),pending={payload};a.q.stage(key,pending);await assert.rejects(a.q.flush(key,pending.queueId),/NETWORK_ERROR/);
 const other=page(t,{quota:true,gmStore,account:'other'});await assert.rejects(other.q.flush(key,pending.queueId),/ACCOUNT_MISMATCH/);assert.equal(other.calls.length,0);
 const b=page(t,{quota:true,gmStore});const result=await b.q.flush(key,pending.queueId);assert.equal(result.verified.confirmed,true);assert.deepEqual(b.calls.map(r=>r.action),['ingest','sync-status']);
});
test('拡張保存APIがない場合も容量エラーで送信を遮らず、画面内で保存確認を完了する',async t=>{
 const a=page(t,{quota:true}),key=await a.q.prepare('tester','secret-token'),pending={payload};a.q.stage(key,pending);const[x,y]=await Promise.all([a.q.flush(key,pending.queueId),a.q.flush(key,pending.queueId)]);assert.equal(x.saved.snapshotId,y.saved.snapshotId);assert.equal(a.calls.filter(r=>r.action==='ingest').length,1);assert.equal(x.verified.confirmed,true);
});
test('途中状態の退避は最新だけを残し、取得済みのアカウントと進捗を再訪で復元する',async t=>{
 const gmStore=new Map(),a=page(t,{quota:true,gmStore}),key='mumei-dashboard-read-checkpoint-v1';for(let i=0;i<10;i++)a.q.remember(key,JSON.stringify({hash:'account-hash',progress:{opened:i},articles:[{title:'保存済み'}]}));await a.q.settled(key);
 const b=page(t,{quota:true,gmStore});assert.deepEqual(JSON.parse(await b.q.recall(key)),{hash:'account-hash',progress:{opened:9},articles:[{title:'保存済み'}]});
});
test('保存確認済みキューの削除だけ失敗しても、再訪で同じ取得分を二重送信しない',async t=>{
 const gmStore=new Map(),a=page(t,{quota:true,gmStore,failQueueClear:true}),key=await a.q.prepare('tester','secret-token'),pending={payload};a.q.stage(key,pending);const result=await a.q.flush(key,pending.queueId);assert.equal(result.verified.confirmed,true);assert.equal(JSON.parse(gmStore.get(key)).length,1);
 const b=page(t,{quota:true,gmStore});const restored=await b.q.flush(key,pending.queueId);assert.equal(restored.verified.confirmed,true);assert.equal(b.calls.length,0);assert.equal(JSON.parse(gmStore.get(key)).length,0);
});
test('退避後も旧タブが残した同じ本人の未保存キューを合流し、失わずに送信する',async t=>{
 const gmStore=new Map(),a=page(t,{quota:true,gmStore}),key=await a.q.prepare('tester','secret-token');gmStore.set(key,'[]');
 const b=page(t,{quota:true,gmStore,stored:[[key,JSON.stringify([{id:'older-tab',payload,saved:null,at:Date.now()}])]]});const result=await b.q.flush(key,'older-tab');assert.equal(result.verified.confirmed,true);assert.deepEqual(b.calls.map(r=>r.action),['ingest','sync-status']);assert.equal(b.w.localStorage.getItem(key),null);
});
test('別タブが先に保存確認した場合は古い画面内キューを更新して二重送信しない',async t=>{
 const gmStore=new Map(),a=page(t,{quota:true,gmStore,account:'other'}),key=await a.q.prepare('tester','secret-token'),pending={payload};a.q.stage(key,pending);await a.q.settled(key);
 const b=page(t,{quota:true,gmStore});await Promise.all([a.q.prepare('tester','secret-token'),b.q.prepare('tester','secret-token')]);const result=await b.q.flush(key,pending.queueId);assert.equal(result.verified.confirmed,true);
 a.w.fetch=async()=>Response.json({data:{urlname:'tester'}});const same=await a.q.flush(key,pending.queueId);assert.equal(same.verified.confirmed,true);assert.equal(a.calls.length,0);
});
