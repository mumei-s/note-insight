import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import ts from 'typescript';
import {readFileSync} from 'node:fs';
import {createHash,webcrypto} from 'node:crypto';
const hash=v=>createHash('sha256').update(v).digest('hex');
async function backend(){
 let handle;
 const tables={
  insight_notification_ingest_tokens:[{member_id:'owner',purpose:'note_dashboard_sync',token_hash:hash('fixture'),revoked_at:null,expires_at:'2099-01-01'}],
  insight_dashboard_snapshots:[{id:'7',member_id:'owner',confirmed:true,captured_at:'2026-09-26',metric_series:[{date:'2026-09-25',pageViews:12,likes:0}],total_page_views:12,total_likes:0},{id:'8',member_id:'another',confirmed:true},{id:'9',member_id:'owner',confirmed:false}],
  insight_dashboard_article_snapshots:[{snapshot_id:'7'},{snapshot_id:'7'}],
 };
 const db={from(name){const filters=[];let counted=false;const q={select(_s,options){counted=options?.count==='exact';return q},eq(k,v){filters.push(r=>r[k]===v);return q},is(k,v){filters.push(r=>r[k]===v);return q},gt(k,v){filters.push(r=>r[k]>v);return q}};
  const execute=()=>{const rows=(tables[name]||[]).filter(r=>filters.every(f=>f(r)));return {data:rows,count:counted?rows.length:null,error:null}};
  q.maybeSingle=async()=>{const r=execute();return {...r,data:r.data[0]||null}};q.then=(a,b)=>Promise.resolve(execute()).then(a,b);return q;
 }};
 const ctx=vm.createContext({Request,Response,TextEncoder,crypto:webcrypto,console:{error(){}},Deno:{env:{get:()=>''},serve:fn=>handle=fn}});
 const code=ts.transpileModule(readFileSync('supabase/functions/insight-dashboard-data/index.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
 const mod=new vm.SourceTextModule(code,{context:ctx});await mod.link(()=>new vm.SyntheticModule(['createClient'],function(){this.setExport('createClient',()=>db)},{context:ctx}));await mod.evaluate();
 return {tables,async call(body={},token='fixture'){const r=await handle(new Request('https://example.test',{method:'POST',headers:{'X-Ingest-Token':token},body:JSON.stringify({action:'sync-status',noteId:'ss_yr',...body})}));return {status:r.status,body:await r.json()}}};
}
test('保存前の照合は有効な本人用Dashboardトークンだけを認める',async()=>{
 const h=await backend();assert.equal((await h.call()).body.paired,true);
 assert.equal((await h.call({},'')).status,401);assert.equal((await h.call({},'wrong')).status,401);
 h.tables.insight_notification_ingest_tokens[0].revoked_at='2026-09-25';assert.equal((await h.call()).status,401);
 h.tables.insight_notification_ingest_tokens[0].revoked_at=null;h.tables.insight_notification_ingest_tokens[0].purpose='note_notification_auto_sync';assert.equal((await h.call()).status,401);
});
test('保存後の照合は同じ本人の確定済み記録と実際の記事件数を返す',async()=>{
 const h=await backend(),r=await h.call({snapshotId:'7'});assert.equal(r.status,200);assert.equal(r.body.confirmed,true);assert.equal(r.body.articleCount,2);assert.equal(r.body.dailyPvDays,1);assert.equal(r.body.dailyMetricCount,1);assert.equal(r.body.totals.pageViews,12);assert.equal(r.body.totals.likes,0);
 assert.equal((await h.call({snapshotId:'8'})).status,409);assert.equal((await h.call({snapshotId:'9'})).status,409);assert.equal((await h.call({noteId:'another',snapshotId:'7'})).status,409);
 assert.equal(h.tables.insight_dashboard_snapshots.length,3,'照合はデータを作成しない');
});
