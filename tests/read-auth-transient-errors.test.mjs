import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {webcrypto} from 'node:crypto';

const readFunctions=['insight-dm-feed','insight-comment-events','insight-comment-hearts','insight-notification-feed-final'];
function fixture(name,{failure,missing,revoked=false,inactive=false}={}){
 let handler;const reads=[],writes=[];
 const db={from(table){
  const result=()=>{reads.push(table);if(table===failure)return{data:null,error:{code:'57014',message:'canceling statement due to timeout'}};
   if(table===missing)return{data:null,error:null};
   if(table==='insight_member_sessions')return{data:{application_id:'member-a',expires_at:'2099-01-01',revoked_at:revoked?'2026-01-01':null},error:null};
   if(table==='insight_access_applications')return{data:{id:'member-a',note_id:'tester',display_name:'Tester',status:inactive?'inactive':'active',verified_at:'2026-01-01'},error:null};
   if(table==='insight_dm_ingest_tokens')return{data:{member_id:'member-a',expires_at:'2099-01-01'},error:null};
   return{data:null,error:null};
  };
  const q={};for(const method of ['select','eq','is','gt','order','limit','in','range'])q[method]=()=>q;
  for(const method of ['insert','upsert','update','delete'])q[method]=()=>{writes.push(table);return q};
  q.maybeSingle=async()=>result();q.then=(resolve,reject)=>Promise.resolve(result()).then(resolve,reject);return q;
 }};
 const code=readFileSync('supabase/functions/'+name+'/index.ts','utf8').replace(/^import[^\n]+\n/,'');
 vm.runInNewContext(ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,{URL,Request,Response,TextEncoder,crypto:webcrypto,console:{error(){}},createClient:()=>db,Deno:{env:{get:()=>''},serve:fn=>handler=fn}});
 return{reads,writes,async call({headers={},body={action:'unknown'}}={}){const r=await handler(new Request('https://example.test',{method:'POST',headers:{'X-Insight-Token':'fixture','X-Ingest-Token':'fixture',...headers},body:JSON.stringify(body)}));return{status:r.status,data:await r.json()}}};
}
for(const name of readFunctions){
 for(const failure of ['insight_member_sessions','insight_access_applications'])test(name+': transient '+failure+' error is not false logout',async()=>{
  const h=fixture(name,{failure}),r=await h.call();
  assert.equal(r.status,500);assert.equal(r.data.error,'AUTH_CHECK_UNAVAILABLE');assert.deepEqual(h.writes,[]);
  assert.equal(h.reads.at(-1),failure,'must fail closed before reading member data');
 });
 for(const scenario of [{missing:'insight_member_sessions'},{revoked:true},{inactive:true}])test(name+': real denial still denies '+JSON.stringify(scenario),async()=>{
  const h=fixture(name,scenario),r=await h.call();assert.equal(r.status,401);assert.deepEqual(h.writes,[]);
 });
}
for(const failure of ['insight_member_sessions','insight_access_applications'])test('DM pairing stats preserves session on transient '+failure,async()=>{
 const h=fixture('insight-dm-import-token',{failure}),r=await h.call({body:{action:'stats'}});assert.equal(r.status,500);assert.equal(r.data.error,'AUTH_CHECK_UNAVAILABLE');assert.deepEqual(h.writes,[]);
});
for(const failure of ['insight_dm_ingest_tokens','insight_access_applications'])test('DM ingest transient '+failure+' error does not invalidate pairing',async()=>{
 const h=fixture('insight-dm-ingest',{failure}),r=await h.call();assert.equal(r.status,500);assert.equal(r.data.error,'DM_STORAGE_57014');assert.deepEqual(h.writes,[]);
});
test('DM ingest genuinely absent token remains unauthorized',async()=>{
 const h=fixture('insight-dm-ingest',{missing:'insight_dm_ingest_tokens'}),r=await h.call();assert.equal(r.status,401);assert.equal(r.data.error,'DM_INGEST_TOKEN_INVALID');assert.deepEqual(h.writes,[]);
});
for(const failure of ['insight_dm_messages','insight_dm_threads'])test('DM pairing stats count failure '+failure+' is not zero success',async()=>{
 const h=fixture('insight-dm-import-token',{failure}),r=await h.call({body:{action:'stats'}});assert.equal(r.status,500);assert.equal(r.data.ok,false);assert.equal(r.data.error,'DM_STATS_UNAVAILABLE');assert.equal(r.data.messages,undefined);assert.deepEqual(h.writes,[]);
});
test('DM pairing token stats read failure is not unpaired success',async()=>{
 const h=fixture('insight-dm-import-token',{failure:'insight_dm_ingest_tokens'}),r=await h.call({body:{action:'stats'}});assert.equal(r.status,500);assert.equal(r.data.ok,false);assert.equal(r.data.paired,undefined);assert.deepEqual(h.writes,[]);
});
