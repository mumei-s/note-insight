import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { stripTypeScriptTypes } from 'node:module';
import { webcrypto } from 'node:crypto';
const root = process.argv[2] || new URL('../supabase/functions/', import.meta.url).pathname;
let tests = 0;
function contextFor(name, state = {authorized:true,maintenance:true}, fetchImpl) {
  let calls=0, network=0, tableCalls=0, handler;
  const client={rpc:async()=>{calls++;return {data:state,error:null}},from:()=>{tableCalls++;throw Error('Unexpected table access while paused')}};
  const context=vm.createContext({
    Request,Response,URL,TextEncoder,AbortController,Date,setTimeout,clearTimeout,crypto:webcrypto,
    console:{error:()=>{}},
    fetch:async (...args)=>{network++; if(fetchImpl)return fetchImpl(...args); throw Error('Unexpected network call while paused')},
    createClient:()=>client,
    Deno:{env:{get:k=>k==='SUPABASE_URL'?'https://example.invalid':'test-only-key'},serve:h=>{handler=h}},
  });
  const shared=fs.readFileSync(path.join(root,'_shared/egress-20260930.ts'),'utf8').replace(/^export /gm,'');
  const body=name?fs.readFileSync(path.join(root,name,'index.ts'),'utf8').replace(/^import .*;\s*$/gm,''):'';
  const js=stripTypeScriptTypes(shared+'\n'+body+'\nglobalThis.guard={checkedFetch,backgroundGate,rpcValue,batchUpsert,quotaError};',{mode:'strip'});
  vm.runInContext(js,context);
  return {handler,guard:context.guard,counts:()=>({calls,network,tableCalls})};
}
for(const [name,action] of [
 ['insight-like-backfill',null],['insight-comment-refresh',null],['insight-avatar-refresh',null],
 ['insight-relations','cron'],['insight-notifications','cron-public-watch'],
]) {
 for(const state of [{authorized:true,maintenance:true},{authorized:true},{authorized:false,maintenance:true}]) {
  const env=contextFor(name,state);
  const r=await env.handler(new Request('https://example.invalid',{method:'POST',headers:{'Content-Type':'application/json','X-Cron-Secret':'test-only'},body:JSON.stringify(action?{action}:{})}));
  if(state.authorized){assert.equal(r.status,200,name); assert.equal((await r.json()).paused,true,name)}
  else assert.equal(r.status,401,name);
  assert.deepEqual(env.counts(),{calls:1,network:0,tableCalls:0},name);tests++;
 }
 const env=contextFor(name);
 const r=await env.handler(new Request('https://example.invalid',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(action?{action}:{})}));
 assert.equal(r.status,401,name); assert.deepEqual(env.counts(),{calls:0,network:0,tableCalls:0},name); tests++;
 const preflight=await env.handler(new Request('https://example.invalid',{method:'OPTIONS'})); assert.equal(preflight.status,200,name);tests++;
}
{
 const env=contextFor(null,undefined,()=>new Response('{}',{status:402}));
 await assert.rejects(env.guard.checkedFetch('https://example.invalid'),/EGRESS_QUOTA_HTTP_402/);
 await assert.rejects(env.guard.checkedFetch('https://example.invalid'),/EGRESS_QUOTA_CIRCUIT_OPEN/);
 assert.equal(env.counts().network,1); tests++;
}
{
 const env=contextFor(null); const sizes=[];
 const db={rpc:async(name,args)=>{assert.equal(name,'insight_egress_upsert');sizes.push(args.p_rows.length);return{data:args.p_rows.length,error:null}}};
 const changed=await env.guard.batchUpsert(db,'insight_public_comments',Array.from({length:801},(_,i)=>({i})));
 assert.equal(changed,801);assert.deepEqual(sizes,[400,400,1]); tests++;
 await assert.rejects(env.guard.rpcValue({rpc:async()=>({data:null,error:{message:'exceed_egress_quota'}})},'test'),/exceed_egress_quota/); tests++;
}
console.log(JSON.stringify({result:'PASS',tests,coverage:'5 worker handlers: authenticated maintenance, fail-closed missing state, invalid and missing secrets, OPTIONS; 402 circuit breaker; bounded batches; RPC errors',network:'mocked, no production traffic'},null,2));
