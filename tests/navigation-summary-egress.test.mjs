import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {webcrypto} from 'node:crypto';

const source=readFileSync('supabase/functions/insight-member-history/index.ts','utf8');
const before=readFileSync('tests/fixtures/member-history-before-navigation.ts','utf8');
const plain=x=>JSON.parse(JSON.stringify(x));
async function run(code,{body={action:'summary'},scope='member-a',noteId='tester',zero=false,denied=false,errorRpc='',errorArticles=false}={}){
 const requests=[];
 const summary={articleCount:zero?0:1000,displayedLikeTotal:zero?0:9001,identifiedLikeCount:zero?0:8123,supporterCount:zero?0:321,lastSeenAt:'2026-10-20T00:00:00Z'};
 const analysis={uniqueSupporters:summary.supporterCount,repeatSupporters:zero?0:44,pendingLikes:zero?0:18,topArticles:[{title:'previous analysis contract'}]};
 const articles=zero?[]:Array.from({length:1000},(_,i)=>({article_key:'a'+i,title:'Article '+i,url:'https://note.com/'+noteId+'/n/a'+i,publish_at:'2026-10-20',like_count:i,comment_count:0,last_seen_at:'2026-10-20'}));
 const db={from(table){
  const read={table,columns:'',filters:[],options:{},limit:null,update:false};
  const result=()=>{
   requests.push(plain(read));
   if(read.update)return{data:null,error:null};
   if(table==='insight_member_sessions')return{data:denied?null:{id:'session-a',application_id:scope,expires_at:'2099-01-01',revoked_at:null},error:null};
   if(table==='insight_access_applications')return{data:{id:scope,note_id:noteId,display_name:'Tester',image_url:null,status:'active'},error:null};
   if(read.options.head)return{data:null,count:zero?0:table==='insight_public_comments'?22:table==='insight_notifications'?44:read.filters.some(([k,v])=>k==='direction'&&v==='followers')?55:66,error:null};
   if(table==='insight_public_articles')return{data:errorArticles?null:articles,error:errorArticles?{code:'57014',message:'private database error'}:null};
   return{data:[],error:null};
  };
  const q={select(columns,options={}){read.columns=columns;read.options=options;return q},eq(k,v){read.filters.push([k,v]);return q},in(k,v){read.filters.push([k,v]);return q},update(){read.update=true;return q},order(){return q},limit(v){read.limit=v;return q},maybeSingle:async()=>result(),then:(ok,no)=>Promise.resolve(result()).then(ok,no)};return q;
 },async rpc(name,args){requests.push({rpc:name,args:plain(args)});return{data:name==='insight_fast_summary'?summary:analysis,error:name===errorRpc?{code:'57014',message:'private query'}:null}}};
 let handle;
 vm.runInNewContext(ts.transpileModule(code.replace(/^import[^\n]+\n/,''),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,{createClient:()=>db,Request,Response,TextEncoder,crypto:webcrypto,console:{error(){}},Deno:{env:{get:()=>''},serve:fn=>handle=fn}});
 const response=await handle(new Request('https://example.test/history',{method:'POST',headers:{'X-Insight-Token':'fixture'},body:JSON.stringify(body)}));
 return{status:response.status,payload:await response.json(),requests};
}
for(const zero of [false,true])test(`navigation summary preserves visible counts (${zero?'zero':'populated'}) without analysis RPC or article payload`,async t=>{
 const old=await run(before,{zero}),next=await run(source,{zero,body:{action:'summary',view:'navigation'}});
 assert.equal(next.status,200);assert.deepEqual(next.payload.member,old.payload.member);assert.deepEqual(next.payload.summary,old.payload.summary);assert.deepEqual(next.payload.counts,old.payload.counts);
 assert.equal(next.payload.analysis.uniqueSupporters,old.payload.analysis.uniqueSupporters);assert.equal(next.payload.summaryMode,'navigation');assert.deepEqual(next.payload.articles,[]);
 assert.deepEqual(next.requests.filter(r=>r.rpc).map(r=>r.rpc),['insight_fast_summary']);
 assert.equal(next.requests.filter(r=>r.table==='insight_public_articles').length,0);
 assert.equal(old.requests.filter(r=>r.rpc).length,2);
 assert.equal(next.requests.filter(r=>r.options?.head).length,4,'fresh header counts remain checked');
 t.diagnostic(`Fixture navigation response JSON: ${Buffer.byteLength(JSON.stringify(old.payload))} -> ${Buffer.byteLength(JSON.stringify(next.payload))} bytes. Not measured production egress.`);
});
for(const body of [{action:'summary'},{action:'summary',view:'unknown'},{action:'summary',view:true}])test('legacy and unknown summary modes preserve the entire existing response '+JSON.stringify(body),async()=>{
 const old=await run(before,{body}),next=await run(source,{body});assert.deepEqual(next.payload,old.payload);assert.deepEqual(next.requests,old.requests);
});
for(const [noteId,expected]of [['tester','member-a'],['ss_yr','owner']])test('navigation summary keeps authenticated member scope '+noteId,async()=>{
 const next=await run(source,{noteId,body:{action:'summary',view:'navigation'}});assert.equal(next.status,200);
 assert.equal(next.requests.find(r=>r.rpc).args.p_member,expected);
 for(const request of next.requests.filter(r=>r.options?.head))assert.ok(request.filters.some(([key,value])=>key==='member_id'&&(value===expected||Array.isArray(value)&&value.includes(expected))));
});
test('navigation summary still rejects authentication and reports RPC failures',async()=>{
 const denied=await run(source,{denied:true,body:{action:'summary',view:'navigation'}});assert.equal(denied.status,401);assert.equal(denied.requests.some(r=>r.rpc),false);
 const failed=await run(source,{errorRpc:'insight_fast_summary',body:{action:'summary',view:'navigation'}});assert.equal(failed.status,500);assert.equal(failed.payload.code,'57014');assert.doesNotMatch(JSON.stringify(failed.payload),/private query/);
});
test('article archive remains available on demand with the previous bound and error behavior',async()=>{
 const articles=await run(source,{body:{action:'articles'}});const old=await run(before);
 assert.equal(articles.status,200);assert.deepEqual(articles.payload.rows,old.payload.articles);assert.equal(articles.payload.total,1000);assert.equal(articles.requests.find(r=>r.table==='insight_public_articles').limit,1000);
 assert.equal(articles.requests.some(r=>r.rpc),false);const failed=await run(source,{body:{action:'articles'},errorArticles:true});assert.equal(failed.status,500);
});
