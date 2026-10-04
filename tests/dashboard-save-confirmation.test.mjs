import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import ts from 'typescript';
import {readFileSync} from 'node:fs';
import {createHash,webcrypto} from 'node:crypto';
const hash=v=>createHash('sha256').update(v).digest('hex');
async function backend(){
 let handle;const logs=[];
 const tables={
  insight_member_sessions:[{application_id:"owner-app",token_hash:hash("fixture"),expires_at:"2099-01-01",revoked_at:null}],
  insight_access_applications:[{id:"owner-app",note_id:"ss_yr",status:"active"}],
  insight_notification_ingest_tokens:[{member_id:'owner',purpose:'note_dashboard_sync',token_hash:hash('fixture'),revoked_at:null,expires_at:'2099-01-01'}],
  insight_dashboard_snapshots:[{id:'7',member_id:'owner',confirmed:true,captured_at:'2026-09-26',metric_series:[{date:'2026-09-25',pageViews:12,likes:0}],total_page_views:12,total_likes:0},{id:'8',member_id:'another',confirmed:true},{id:'9',member_id:'owner',confirmed:false}],
  insight_dashboard_article_snapshots:[{snapshot_id:'7'},{snapshot_id:'7'}],
 };
 const db={rpc:async(name,args)=>({data:tables.insight_dashboard_snapshots.filter(r=>r.member_id===args.p_member_id&&r.confirmed).sort((a,b)=>String(a.captured_at).localeCompare(String(b.captured_at))).flatMap(r=>r.metric_series||[])}),from(name){const filters=[];let counted=false,sortKey=null,ascending=true,rowLimit=Infinity,start=0,end=Infinity;const q={select(_s,options){counted=options?.count==='exact';return q},eq(k,v){filters.push(r=>r[k]===v);return q},is(k,v){filters.push(r=>r[k]===v);return q},gt(k,v){filters.push(r=>r[k]>v);return q},gte(k,v){filters.push(r=>r[k]>=v);return q},order(k,opts){sortKey=k;ascending=opts?.ascending!==false;return q},limit(v){rowLimit=v;return q},range(a,z){start=a;end=z;return q},upsert(row){tables[name]=[row];return Promise.resolve({error:null})}};
  const execute=()=>{let rows=(tables[name]||[]).filter(r=>filters.every(f=>f(r)));if(sortKey)rows.sort((a,b)=>String(a[sortKey]).localeCompare(String(b[sortKey]))*(ascending?1:-1));rows=rows.slice(start,Math.min(end+1,start+rowLimit));return {data:rows,count:counted?rows.length:null,error:null}};
  q.maybeSingle=async()=>{const r=execute();return {...r,data:r.data[0]||null}};q.then=(a,b)=>Promise.resolve(execute()).then(a,b);return q;
 }};
 const profile={data:{urlname:"ss_yr",followerCount:2132}};let profileCalls=0;const ctx=vm.createContext({Request,Response,TextEncoder,setTimeout,clearTimeout,AbortController,fetch:async()=>{profileCalls++;return Response.json(profile)},crypto:webcrypto,console:{error(){},info:message=>logs.push(message)},Deno:{env:{get:()=>''},serve:fn=>handle=fn}});
 const code=ts.transpileModule(readFileSync('supabase/functions/insight-dashboard-data/index.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
 const mod=new vm.SourceTextModule(code,{context:ctx});await mod.link(()=>new vm.SyntheticModule(['createClient'],function(){this.setExport('createClient',()=>db)},{context:ctx}));await mod.evaluate();
 return {tables,logs,profile,profileCalls:()=>profileCalls,async call(body={},token='fixture'){const r=await handle(new Request('https://example.test',{method:'POST',headers:{'X-Ingest-Token':token,'X-Insight-Token':token},body:JSON.stringify({action:'sync-status',noteId:'ss_yr',...body})}));return {status:r.status,body:await r.json()}}};
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

test('一般参加者も本人通知なしで自分の保存を照合でき、他人の保存にはアクセスできない',async()=>{
 const h=await backend();
 h.tables.insight_access_applications=[{id:'member-a',note_id:'participant_a',status:'active',verified_at:'2026-09-26'},{id:'member-b',note_id:'participant_b',status:'active',verified_at:'2026-09-26'}];
 for(const id of ['a','b']){
  h.tables.insight_notification_ingest_tokens.push({member_id:'member-'+id,purpose:'note_dashboard_sync',token_hash:hash('fixture-'+id),revoked_at:null,expires_at:'2099-01-01'});
  h.tables.insight_dashboard_snapshots.push({id:'snapshot-'+id,member_id:'member-'+id,confirmed:true,captured_at:'2026-09-27',metric_series:[{date:'2026-09-26',pageViews:5}],total_page_views:5});
  h.tables.insight_dashboard_article_snapshots.push({snapshot_id:'snapshot-'+id});
 }
 for(const id of ['a','b']){
  const self={noteId:'participant_'+id},token='fixture-'+id;
  assert.equal((await h.call(self,token)).body.paired,true);
  const saved=await h.call({...self,snapshotId:'snapshot-'+id},token);assert.equal(saved.status,200);assert.equal(saved.body.articleCount,1);assert.equal(saved.body.dailyPvDays,1);assert.equal(saved.body.totals.pageViews,5);
  assert.equal((await h.call({...self,snapshotId:'snapshot-'+(id==='a'?'b':'a')},token)).status,409);assert.equal((await h.call({...self,snapshotId:'7'},token)).status,409);
 }
});


test('端末の停止理由は本人認証後だけ記録し、本文や接続情報をログへ転送しない',async()=>{
 const h=await backend(),body={action:'client-status',connectorVersion:'1.5.7',code:'VIEW_CHANGED',stage:'panel',readArticles:12,readDaily:2,waitingRequests:1,loadingElements:0,elapsedMs:1234,panelsOpened:1,activeTab:'メンバーシップ',periodKnown:false,periodChanged:true,routeChanged:false,token:'secret',message:'private article',html:'<body>private</body>'};
 assert.equal((await h.call(body,'')).status,401);assert.equal((await h.call({...body,noteId:'another'})).status,409);assert.equal(h.logs.length,0);
 assert.equal((await h.call(body)).body.recorded,true);assert.equal(h.logs.length,1);const logged=JSON.parse(h.logs[0].replace('DASHBOARD_CLIENT_STATUS ',''));
 assert.equal(logged.noteId,'ss_yr');assert.equal(logged.code,'VIEW_CHANGED');assert.equal(logged.readArticles,12);assert.equal(logged.periodChanged,true);assert.doesNotMatch(h.logs[0],/secret|private|<body>/);
 assert.equal(h.tables.insight_dashboard_snapshots.length,3,'診断を読込成功の記録として保存しない');
});

test('全期間の月別グラフの件数を本人の保存結果で照合できる',async()=>{
 const h=await backend();h.tables.insight_dashboard_snapshots[0].raw_data={chartSeries:[{granularity:'MONTH',startDate:'2025-01-01',endDate:'2025-01-31',pageViews:0},{granularity:'MONTH',startDate:'2025-02-01',endDate:'2025-02-28',pageViews:100}]};
 const result=await h.call({snapshotId:'7'});assert.equal(result.body.chartMetricCount,2);assert.equal(result.body.dailyPvDays,1);
});
test('全期間は明示的な公式全期間だけに一致し、28日を全期間へ代入しない',()=>{
 const source=readFileSync('supabase/functions/insight-dashboard-data/index.ts','utf8'),code=source.slice(source.indexOf('function snapshotPeriod('),source.indexOf('async function analysis('));const ctx=vm.createContext({});vm.runInContext(ts.transpileModule(code+'this.pick=periodSnapshots;', {compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,ctx);
 const rows=[{id:1,period_type:'custom',period_start:'2026-08-31',period_end:'2026-09-27'},{id:2,period_type:'all',period_start:null,period_end:null},{id:3,period_type:'custom',period_start:'2026-09-21',period_end:'2026-09-27'}];
 assert.deepEqual(Array.from(ctx.pick(rows,'all'),r=>r.id),[2]);assert.deepEqual(Array.from(ctx.pick(rows,'week'),r=>r.id),[3]);assert.deepEqual(Array.from(ctx.pick(rows,'month'),r=>r.id),[1]);assert.equal(ctx.pick(rows.slice(0,1),'all').length,0);
});

test('分析APIは選択期間の集計と記事を揃え、未取得・別参加者・日別と月別を混ぜない',async()=>{
 const h=await backend();h.tables.insight_dashboard_snapshots=[
  {id:'month',member_id:'owner',confirmed:true,captured_at:'2026-09-27T03:00:00Z',dashboard_schema_version:5,period_type:'month',period_start:'2026-08-31',period_end:'2026-09-27',total_page_views:28,metric_series:[{date:'2026-09-27',pageViews:1}]},
  {id:'all',member_id:'owner',confirmed:true,captured_at:'2026-09-26T03:00:00Z',dashboard_schema_version:5,period_type:'all',total_page_views:1000,metric_series:[],raw_data:{chartSeries:[{granularity:'MONTH',startDate:'2025-01-01',endDate:'2025-01-31',pageViews:1000}]}},
  {id:'foreign',member_id:'another',confirmed:true,captured_at:'2026-09-28T03:00:00Z',dashboard_schema_version:5,period_type:'all',total_page_views:999999}
 ];h.tables.insight_dashboard_article_snapshots=[{snapshot_id:'all',article_key:'lifetime',page_views:1000},{snapshot_id:'month',article_key:'28days',page_views:28},{snapshot_id:'foreign',article_key:'private',page_views:999999}];
 const all=await h.call({action:'analysis',period:'all',dashboardOnly:true});assert.equal(all.status,200);assert.equal(all.body.latestDashboard.pageViews,1000);assert.equal(all.body.topArticles[0].article_key,'lifetime');assert.equal(all.body.dailyMetrics.length,0);assert.equal(all.body.dailyHistory.length,1);assert.equal(all.body.dailyHistory[0].pageViews,1);assert.equal(all.body.latestDashboard.chartSeries[0].pageViews,1000);assert.equal(all.body.periodAvailable,true);assert.doesNotMatch(JSON.stringify(all.body),/private|999999/);
 const month=await h.call({action:'analysis',period:'month',dashboardOnly:true});assert.equal(month.body.latestDashboard.pageViews,28);assert.equal(month.body.topArticles[0].article_key,'28days');assert.equal(month.body.dailyMetrics.length,1);
 const week=await h.call({action:'analysis',period:'week',dashboardOnly:true});assert.equal(week.body.periodAvailable,false);assert.equal(week.body.latestDashboard,null);assert.deepEqual(week.body.topArticles,[]);assert.deepEqual(week.body.dailyMetrics,[]);
});

test('フォロワーは本人の公開プロフィールで確認し、5分以内は保存値を使う',async()=>{
 const h=await backend();assert.equal((await h.call({action:'follower-count'},'')).status,401);assert.equal(h.profileCalls(),0);
 const r=await h.call({action:'follower-count',noteId:'another'});assert.equal(r.status,200);assert.equal(r.body.noteId,'ss_yr');assert.equal(r.body.followerCount.count,2132);assert.equal(r.body.followerCount.stale,false);assert.equal(h.tables.insight_dashboard_follower_counts[0].member_id,'owner');
 await h.call({action:'follower-count'});assert.equal(h.profileCalls(),1);
 h.tables.insight_dashboard_follower_counts[0].measured_at='2020-01-01';h.profile.data.urlname='another';const stale=await h.call({action:'follower-count'});assert.equal(stale.body.followerCount.count,2132);assert.equal(stale.body.followerCount.stale,true);
 h.tables.insight_dashboard_follower_counts=[];h.profile.data.urlname='ss_yr';h.profile.data.followerCount=0;assert.equal((await h.call({action:'follower-count'})).body.followerCount.count,0);
});

test('記事別データが1000件を超えてもページングして全件を表示する',async()=>{
 const h=await backend();h.tables.insight_dashboard_snapshots[0].period_type='all';h.tables.insight_dashboard_article_snapshots=Array.from({length:1301},(_,i)=>({snapshot_id:'7',article_key:String(i).padStart(4,'0'),page_views:i}));
 const result=await h.call({action:'analysis',period:'all',dashboardOnly:true});assert.equal(result.status,200);assert.equal(result.body.topArticles.length,1301);
});

test('途中保存は残しつつ、取得済みの完全な記事一覧を少ない件数で置き換えない',async()=>{
 const h=await backend();h.tables.insight_dashboard_snapshots=[{id:'full',member_id:'owner',confirmed:true,captured_at:'2026-09-25',period_type:'month',dashboard_schema_version:5,total_page_views:100,metric_series:[],content_sections:{article:{scope:'current-period-expanded'}}},{id:'partial',member_id:'owner',confirmed:true,captured_at:'2026-09-26',period_type:'month',dashboard_schema_version:5,total_page_views:20,metric_series:[{date:'2026-09-26',pageViews:20}],content_sections:{article:{scope:'partial-read'}}}];
 h.tables.insight_dashboard_article_snapshots=[{snapshot_id:'full',article_key:'keep',page_views:100},{snapshot_id:'partial',article_key:'part',page_views:20}];
 const r=await h.call({action:'analysis',dashboardOnly:true});assert.equal(r.body.latestDashboard.pageViews,100);assert.deepEqual(r.body.topArticles.map(x=>x.article_key),['keep']);assert.ok(r.body.dailyHistory.some(x=>x.date==='2026-09-26'));
});
