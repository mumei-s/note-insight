import test from 'node:test';
import assert from 'node:assert/strict';
import * as React from 'react';
import {sceneFixture,pause} from './react-scene-fixture.mjs';
const KEY='mumei-unified-owner-token';
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{resolve,promise}};
async function fixture(t,fetch){const calls=[];const h=await sceneFixture(t,{fetch:async(url,init)=>{calls.push({url,init,action:JSON.parse(init.body).action});return fetch(url,init)}});h.w.localStorage.setItem(KEY,'owner-a');return{...h,calls}};
for(const file of ['owner-gate','management-page'])for(const failure of ['network',402,500,'malformed',401,403])test(`${file}: ${failure} preserves token unless explicit denial`,async t=>{
 const h=await fixture(t,async()=>{if(failure==='network')throw new Error('offline');return failure==='malformed'?new Response('{'):Response.json({error:'FAILED'},{status:failure})});
 await h.render(h.load(`src/${file}.tsx`)[file==='owner-gate'?'OwnerGate':'ManagementPage']);
 assert.equal(h.w.localStorage.getItem(KEY),[401,403].includes(failure)?null:'owner-a');assert.equal(h.calls.length,1);
});
for(const file of ['owner-gate','management-page'])test(`${file}: late old-token denial cannot delete replacement`,async t=>{
 const wait=deferred(),h=await fixture(t,()=>wait.promise);await h.render(h.load(`src/${file}.tsx`)[file==='owner-gate'?'OwnerGate':'ManagementPage']);h.w.localStorage.setItem(KEY,'owner-b');await React.act(async()=>{wait.resolve(Response.json({error:'OWNER_LOGIN_REQUIRED'},{status:401}));await pause()});assert.equal(h.w.localStorage.getItem(KEY),'owner-b');
});
test('management unlock reads once; pending poll is shared; late poll after unmount is aborted',async t=>{
 const pending=deferred();let list=0;const h=await fixture(t,async(_url,init)=>JSON.parse(init.body).action==='status'?Response.json({authenticated:true}):++list===1?Response.json({applications:[]}):pending.promise);
 const intervals=[];h.w.setInterval=fn=>{intervals.push(fn);return 1};h.w.clearInterval=()=>{};
 await h.render(h.load('src/management-page.tsx').ManagementPage);
 await h.change(h.w.document.querySelector('input'),'fixture-pass');
 await React.act(async()=>{h.w.document.querySelector('form').dispatchEvent(new h.w.Event('submit',{bubbles:true,cancelable:true}));await pause()});
 assert.equal(list,1);assert.equal(intervals.length,1);
 await React.act(async()=>{intervals[0]();intervals[0]();await pause()});assert.equal(list,2);
 await h.click([...h.w.document.querySelectorAll('button')].find(x=>x.textContent==='今すぐ更新'));assert.equal(list,2);
 await React.act(async()=>h.root.render(null));assert.equal(h.calls.at(-1).init.signal.aborted,true);
 await React.act(async()=>{pending.resolve(Response.json({applications:[{id:'late',noteId:'late',status:'active'}]}));await pause()});assert.doesNotMatch(h.w.document.body.textContent,/late/);
});
test('owner article details: late A cannot replace B and close aborts unfinished detail',async t=>{
 const a=deferred(),b=deferred();const h=await fixture(t,async(_url,init)=>{const body=JSON.parse(init.body);return body.action==='articles'?Response.json({rows:[{article_key:'A',title:'article-A'},{article_key:'B',title:'article-B'}],total:2}):body.articleKey==='A'?a.promise:b.promise});
 await h.render(h.load('src/article-likes-page-v2.tsx').ArticleLikesPageV2);
 await h.click(h.w.document.querySelectorAll('.al2-open')[0]);await h.click(h.w.document.querySelectorAll('.al2-open')[1]);
 assert.equal(h.calls[1].init.signal.aborted,true);
 await React.act(async()=>{b.resolve(Response.json({rows:[{liker_key:'b',actor_name:'person-B'}],total:1}));await pause();a.resolve(Response.json({rows:[{liker_key:'a',actor_name:'person-A'}],total:1}));await pause()});
 assert.match(h.w.document.querySelector('.al2-detail').textContent,/person-B/);assert.doesNotMatch(h.w.document.querySelector('.al2-detail').textContent,/person-A/);
 await h.click(h.w.document.querySelector('.al2-detailhead button'));assert.equal(h.w.document.querySelector('.al2-detail'),null);
});
test('owner read timeout ends a stalled body and ignores its late success',async t=>{
 const body=deferred(),timers=[];const h=await sceneFixture(t,{globals:{setTimeout:fn=>{timers.push(fn);return 1},clearTimeout:()=>{}},fetch:async()=>({ok:true,json:()=>body.promise})});
 const request=h.load('src/owner-read-request.ts').ownerReadRequest('https://example.test','fixture',{action:'status'});await pause();timers[0]();await assert.rejects(request,e=>e.name==='AbortError');body.resolve({authenticated:true});await pause();
});
test('owner article detail explicit denial clears old privileged rows; transient failure keeps token',async t=>{
 for(const status of [401,500]){const h=await fixture(t,async(_url,init)=>JSON.parse(init.body).action==='articles'?Response.json({rows:[{article_key:'A',title:'private-article-A'}],total:1}):Response.json({error:status===401?'OWNER_LOGIN_REQUIRED':'TEMPORARY'},{status}));await h.render(h.load('src/article-likes-page-v2.tsx').ArticleLikesPageV2);await h.click(h.w.document.querySelector('.al2-open'));assert.equal(h.w.localStorage.getItem(KEY),status===401?null:'owner-a');if(status===401)assert.doesNotMatch(h.w.document.body.textContent,/private-article-A/);}
});

for(const status of [401,403])test(`owner malformed ${status} remains explicit denial`,async t=>{const h=await fixture(t,async()=>new Response('<html>denied</html>',{status}));await h.render(h.load('src/owner-gate.tsx').OwnerGate);assert.equal(h.w.localStorage.getItem(KEY),null);});
