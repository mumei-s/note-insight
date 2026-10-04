import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
import {JSDOM} from 'jsdom';
const source=readFileSync('public/note-insight-dashboard-save-queue-v1.js','utf8');
const payload={action:'ingest',noteId:'tester',articles:[{key:'n1',title:'保存する記事'}],metricSeries:[{date:'2026-09-26',pageViews:0}],chartSeries:[],totals:{pageViews:0,likes:null},contentSections:{article:{scope:'partial-read'}}};
function page(t,{stored=[],account='tester',failConfirm=false,url='https://note.com/tester/n/n2'}={}){
 const dom=new JSDOM('<main></main>',{url,runScripts:'outside-only'}),w=dom.window;t.after(()=>w.close());Object.defineProperty(w.crypto,'subtle',{value:webcrypto.subtle});w.TextEncoder=TextEncoder;
 for(const[k,v]of stored)w.localStorage.setItem(k,v);w.localStorage.setItem('mumei-dashboard-note-id-v1','tester');w.localStorage.setItem('mumei-dashboard-ingest-token-v1','secret-token');
 const calls=[];w.fetch=async()=>Response.json({data:{urlname:account}});
 w.GM_xmlhttpRequest=o=>{const b=JSON.parse(o.data);calls.push(b);queueMicrotask(()=>{if(b.action==='sync-status'&&failConfirm)return o.onerror();o.onload({status:200,responseText:JSON.stringify(b.action==='ingest'?{ok:true,snapshotId:42}:{ok:true,noteId:'tester',snapshotId:42,confirmed:true,articleCount:1,dailyMetricCount:1,dailyPvDays:1,totals:{pageViews:0}})})})};w.eval(source);
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
