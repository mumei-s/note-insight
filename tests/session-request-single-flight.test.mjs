import test from 'node:test';
import assert from 'node:assert/strict';
import { sceneFixture, pause } from './react-scene-fixture.mjs';

const tokenKey='session-test-token';
const deferred=()=>{let resolve;const promise=new Promise(done=>resolve=done);return{promise,resolve}};
const session=(name='creator_a')=>Response.json({ok:true,application:{noteId:name,status:'active',displayName:name,imageUrl:null}});
async function fixture(t,respond){
 const calls=[];let scope='creator_a';
 const h=await sceneFixture(t,{dependencies:{'./insight-account-store':{INSIGHT_TOKEN_KEY:tokenKey,currentStoredInsightAccount:()=>({noteId:scope})}},fetch:async(url,init)=>{const call={url,init};calls.push(call);return respond(call,calls.length)}});
 h.w.localStorage.setItem(tokenKey,'token-a');
 return{...h,calls,api:h.load('src/insight-session-request.ts'),scope:value=>{scope=value},token:value=>h.w.localStorage.setItem(tokenKey,value)};
}

test('concurrent auth consumers share one complete response body; later reads verify again',async t=>{
 const next=deferred(),h=await fixture(t,(_call,n)=>n===1?next.promise:session());
 const first=h.api.readInsightSession('token-a'),second=h.api.readInsightSession('token-a');assert.equal(h.calls.length,1);
 next.resolve(session());const [a,b]=await Promise.all([first,second]);assert.equal(a.payload.application.noteId,b.payload.application.noteId);assert.ok(a.response.ok);
 await h.api.readInsightSession('token-a');assert.equal(h.calls.length,2,'settled auth must never become a result cache');
});

test('one consumer cancellation cannot cancel another consumer’s session check',async t=>{
 const next=deferred(),h=await fixture(t,()=>next.promise),a=new AbortController(),b=new AbortController();
 const first=h.api.readInsightSession('token-a',a.signal),second=h.api.readInsightSession('token-a',b.signal);
 a.abort();await assert.rejects(first,e=>e.name==='AbortError');assert.equal(h.calls[0].init.signal.aborted,false);
 next.resolve(session());assert.equal((await second).payload.ok,true);assert.equal(h.calls.length,1);
});

test('cancelling every consumer aborts transport and a new caller does not join the cancelled read',async t=>{
 const old=deferred(),h=await fixture(t,(_call,n)=>n===1?old.promise:session()),a=new AbortController(),b=new AbortController();
 const first=h.api.readInsightSession('token-a',a.signal),second=h.api.readInsightSession('token-a',b.signal);
 a.abort();b.abort();await Promise.all([assert.rejects(first,e=>e.name==='AbortError'),assert.rejects(second,e=>e.name==='AbortError')]);assert.equal(h.calls[0].init.signal.aborted,true);
 const latest=await h.api.readInsightSession('token-a');assert.equal(latest.payload.application.noteId,'creator_a');assert.equal(h.calls.length,2);old.resolve(session('old'));await pause();
});

for(const tokenChange of [false,true])test(`account ${tokenChange?'token':'scope'} change cannot share or accept the old auth result`,async t=>{
 const old=deferred(),h=await fixture(t,(_call,n)=>n===1?old.promise:session('creator_b'));
 const first=h.api.readInsightSession('token-a');h.scope('creator_b');if(tokenChange)h.token('token-b');
 const next=h.api.readInsightSession(tokenChange?'token-b':'token-a');await assert.rejects(first,e=>e.name==='AbortError'||/ACCOUNT_CHANGED/.test(e.message));assert.equal(h.calls[0].init.signal.aborted,true);
 assert.equal((await next).payload.application.noteId,'creator_b');old.resolve(session());await pause();assert.equal(h.calls.length,2);
});

test('changed account without a replacement request rejects late results',async t=>{
 const old=deferred(),h=await fixture(t,()=>old.promise),request=h.api.readInsightSession('token-a');h.token('token-b');old.resolve(session());await assert.rejects(request,/ACCOUNT_CHANGED/);
});

for(const failure of ['network','401','402','malformed'])test(`${failure} result is shared once but never cached for the next check`,async t=>{
 const next=deferred(),h=await fixture(t,(_call,n)=>n===1?next.promise:session());
 const first=h.api.readInsightSession('token-a'),second=h.api.readInsightSession('token-a');
 if(failure==='network')next.resolve(Promise.reject(new Error('offline')));else next.resolve(failure==='malformed'?new Response('{'):Response.json({ok:false,error:failure==='401'?'INSIGHT_SESSION_INVALID':'unavailable'},{status:Number(failure)}));
 if(failure==='network')await Promise.all([assert.rejects(first,/offline/),assert.rejects(second,/offline/)]);else{const results=await Promise.all([first,second]);assert.ok(results.every(r=>h.api.verifiedInsightSessionIdentity(r)===null))}
 assert.equal(h.calls.length,1);await h.api.readInsightSession('token-a');assert.equal(h.calls.length,2);
});

test('identity handoff accepts only successful, active, matching-account server data',async t=>{
 const h=await fixture(t,()=>session());
 const result=await h.api.readInsightSession('token-a');assert.equal(h.api.verifiedInsightSessionIdentity(result).member.noteId,'creator_a');
 for(const payload of [{ok:true},{ok:false,application:{noteId:'creator_a',status:'active'}},{ok:true,application:{noteId:'creator_b',status:'active'}},{ok:true,application:{noteId:'creator_a',status:'approved'}}])assert.equal(h.api.verifiedInsightSessionIdentity({...result,payload}),null);
});

test('already-aborted consumer starts no auth request',async t=>{
 const h=await fixture(t,()=>session()),controller=new AbortController();controller.abort();
 await assert.rejects(h.api.readInsightSession('token-a',controller.signal),e=>e.name==='AbortError');assert.equal(h.calls.length,0);
});
