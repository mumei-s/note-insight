import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import ts from 'typescript';
import {readFileSync} from 'node:fs';
import * as React from 'react';
import {sceneFixture,pause} from './react-scene-fixture.mjs';
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return{promise,resolve,reject}};
function lifecycle(fetch){const exports={};vm.runInNewContext(ts.transpileModule(readFileSync('src/insight-view-lifecycle.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,fetch,URL,AbortController,setTimeout,clearTimeout});return exports;}
test('previous-launch cache is fallback, not fresh even when saved one second ago',()=>{const api=lifecycle(()=>{});assert.equal(api.isFreshInsightView(Date.now()-1000),false);assert.equal(api.isFreshInsightView(Date.now()),true);assert.equal(api.isFreshInsightView(Date.now()+1000),false)});
test('hung fetch or hung JSON body times out even if fetch ignores abort',async()=>{for(const fetch of [()=>new Promise(()=>{}),async()=>({ok:true,status:200,json:()=>new Promise(()=>{})})]){const api=lifecycle(fetch);await assert.rejects(api.fetchInsightResource('https://example.test/feed',{body:JSON.stringify({action:'list',token:'secret'})},10),e=>e.name==='TimeoutError');const log=api.insightRequestDiagnostics();assert.equal(log.length,1);assert.equal(log[0].source,'feed');assert.equal(log[0].action,'list');assert.doesNotMatch(JSON.stringify(log),/secret/);}});
test('caller cancellation terminates a fetch ignoring abort',async()=>{const api=lifecycle(()=>new Promise(()=>{})),controller=new AbortController();const pending=api.fetchInsightResource('https://example.test/feed',{signal:controller.signal},10000);controller.abort();await assert.rejects(pending,e=>e.name==='AbortError');});
const row=(id,text)=>({id,notification_type:'tip',display_category:'tip',raw_text:text,article_key:id,liker_key:'person',article_title:text,actor_name:'人物',actor_url:'https://note.com/person',captured_at:'2026-10-08T00:00:00Z'});
const dependencies={'./insight-account-store':{INSIGHT_TOKEN_KEY:'token',currentStoredInsightAccount:()=>({noteId:'tester',memberToken:'test-token'}),setAccessIntent:()=>{}},'./creator-avatar':{CreatorAvatar:()=>null,creatorImage:()=>null,creatorNoteId:()=>''},'./member-insight-magazines':{MemberInsightMagazines:()=>null},'./member-insight-dm':{MemberInsightDm:()=>null}};
test('notification launch never flashes disk rows; latest feed appears when verified',async t=>{const pending=deferred();const h=await sceneFixture(t,{dependencies,fetch:async(url,init)=>{const body=JSON.parse(init.body||'{}');if(body.action==='recent'||String(url).includes('reclassify'))return new Promise(()=>{});return pending.promise;}});h.w.localStorage.setItem('token','test-token');h.w.localStorage.setItem('mumei-notification-board:tester',JSON.stringify([row('old','古い通知')]));h.w.localStorage.setItem('mumei-notification-board-meta:tester',JSON.stringify({serverCheckedAt:Date.now()-1000}));const C=h.load('src/member-insight-notifications-final.tsx').MemberInsightNotificationsFinal;await h.render(C,{noteId:'tester'});assert.doesNotMatch(h.w.document.body.textContent,/古い通知/);await React.act(async()=>{pending.resolve(Response.json({ok:true,noteId:'tester',rows:[row('new','最新通知')],total:1,categoryCounts:{all:1}}));await pause();await pause();});assert.match(h.w.document.body.textContent,/最新通知/);assert.doesNotMatch(h.w.document.querySelector('.minf-list').textContent,/古い通知/);});
test('notification offline restores saved history with explicit failure label',async t=>{const h=await sceneFixture(t,{dependencies,fetch:async()=>{throw new Error('offline')}});h.w.localStorage.setItem('token','test-token');h.w.localStorage.setItem('mumei-notification-board:tester',JSON.stringify([row('old','保存通知')]));const C=h.load('src/member-insight-notifications-final.tsx').MemberInsightNotificationsFinal;await h.render(C,{noteId:'tester'});assert.match(h.w.document.body.textContent,/保存通知/);assert.match(h.w.document.querySelector(".minf-head").textContent,/1/);assert.match(h.w.document.body.textContent,/最新確認に失敗したため前回保存分/);});
test('likes and article summary display independently of stalled dashboard metrics',async t=>{const pending=deferred();const h=await sceneFixture(t,{dependencies,fetch:async(url,init)=>{if(String(url).includes('dashboard-data'))return new Promise(()=>{});const b=JSON.parse(init.body||'{}');if(b.action==='summary')return Response.json({member:{noteId:'tester',displayName:'本人',imageUrl:null},summary:{},analysis:{},counts:{},articles:[]});if(b.action==='likes')return pending.promise;return Response.json({rows:[]});}});h.w.localStorage.setItem('token','test-token');const C=h.load('src/member-insight-unified-v4.tsx').MemberInsightUnifiedV4;await h.render(C);assert.match(h.w.document.body.textContent,/本人/);await React.act(async()=>{pending.resolve(Response.json({rows:[row('new','最新スキ')],total:1}));await pause();await pause();});assert.match(h.w.document.body.textContent,/最新スキ/);});
test('returning to persistent likes keeps selected page while checking latest rows',async t=>{const pages=[];const h=await sceneFixture(t,{dependencies,fetch:async(url,init)=>{const b=JSON.parse(init.body||'{}');if(b.action==='summary')return Response.json({member:{noteId:'tester',displayName:'本人',imageUrl:null},summary:{},analysis:{},counts:{},articles:[]});if(b.action==='likes'){pages.push(b.page);return Response.json({rows:[row('p'+b.page,'ページ'+b.page)],total:250});}return Response.json({});}});h.w.localStorage.setItem('token','test-token');const C=h.load('src/member-insight-unified-v4.tsx').MemberInsightUnifiedV4;await h.render(C,{active:true});await h.click(h.w.document.querySelector('.miu-pager button:last-child'));assert.equal(pages.at(-1),2);await h.render(C,{active:false});await h.render(C,{active:true});assert.equal(pages.at(-1),2);assert.match(h.w.document.querySelector('.miu-pager').textContent,/2 \/ 3/);});

for(const [currentTab,action] of [['supporters','supporters'],['commentRanking','comment_ranking']]){
 test(`${currentTab} ignores an older response delivered after the latest revision`,async t=>{
  const old=deferred(),latest=deferred(),requests=[];
  const h=await sceneFixture(t,{dependencies,fetch:async(_url,init)=>{
   const b=JSON.parse(init.body||'{}');
   if(b.action==='summary')return Response.json({member:{noteId:'tester',displayName:'本人',imageUrl:null},summary:{},analysis:{},counts:{},articles:[]});
   if(b.action===action){requests.push(init.signal);return requests.length===1?old.promise:latest.promise;}
   return Response.json({rows:[]});
  }});
  h.w.localStorage.setItem('token','test-token');
  h.w.history.replaceState({insightTab:currentTab},'',h.w.location.href);
  const C=h.load('src/member-insight-unified-v4.tsx').MemberInsightUnifiedV4;
  await h.render(C,{active:true,revision:0});
  assert.equal(requests.length,1);
  await h.render(C,{active:true,revision:1});
  assert.equal(requests.length,2);
  const rankedRow=(id,name)=>({...row(id,name),liker_key:id,actor_key:id,actor_name:name,like_count:1,initial_comment_count:1,article_count:1});
  await React.act(async()=>{latest.resolve(Response.json({rows:[rankedRow('latest','最新の順位')],total:1}));await pause();await pause();});
  assert.match(h.w.document.querySelector('.miu-rank-list').textContent,/最新の順位/);
  // The transport deliberately ignores cancellation and still delivers the old payload.
  await React.act(async()=>{old.resolve(Response.json({rows:[rankedRow('old','古い順位')],total:1}));await pause();await pause();});
  assert.match(h.w.document.querySelector('.miu-rank-list').textContent,/最新の順位/);
  assert.doesNotMatch(h.w.document.querySelector('.miu-rank-list').textContent,/古い順位/);
 });
}
