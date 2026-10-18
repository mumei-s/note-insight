import test from 'node:test';
import assert from 'node:assert/strict';
import * as React from 'react';
import {sceneFixture,pause} from './react-scene-fixture.mjs';

const tokenKey='mumei-insight-access-token',token='current-token';
const dependencies={'./insight-account-store':{INSIGHT_TOKEN_KEY:tokenKey,currentStoredInsightAccount:()=>({noteId:'tester',memberToken:token})},'./creator-avatar':{CreatorAvatar:()=>null,creatorNoteId:()=>''}};
const row=(id,text='前回の通知',extra={})=>({id,notification_type:'tip',display_category:'tip',raw_text:text,actor_name:'人物',actor_url:'https://note.com/person',actor_image_url:'https://images.test/icon.png',captured_at:'2026-10-18T01:00:00Z',confirmed:false,favorite:false,...extra});
const selection=(extra={})=>({kind:'all',handlingStatus:'all',selectedDay:'',page:1,...extra});
const copy=(rows=[row('old')],selected=selection(),total=rows.length)=>({selection:selected,rows,total,statusCounts:{all:total,pending:total,completed:0},categoryCounts:{all:total,tip:total},updatedAt:'2026-10-18T01:00:00Z',syncAt:'2026-10-18T01:00:00Z',serverSync:{received:1,confirmed:1,source:'test'}});
const feed=(rows,total=rows.length,noteId='tester')=>Response.json({ok:true,noteId,rows,total,statusCounts:{all:total,pending:total,completed:0},categoryCounts:{all:total,tip:total}});
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve}};
async function settle(work=()=>{}){await React.act(async()=>{work();for(let i=0;i<5;i++)await pause()})}
async function setup(t,{saved=copy(),scope={account:'tester',token},fetch=async()=>new Promise(()=>{})}={}){
 const calls=[],globals={URLSearchParams};
 const h=await sceneFixture(t,{dependencies,globals,fetch:async(url,init)=>{const body=JSON.parse(init.body||'{}');calls.push(body);if(String(url).includes('creator-icons'))return Response.json({items:[]});return fetch(body,init)}});
 globals.Event=h.w.Event;h.w.localStorage.setItem(tokenKey,token);h.w.localStorage.setItem('mumei-notification-reclassify-version:tester','action-v28-context:evidence-v2-articles');
 const storage=h.load('src/insight-saved-view.ts');if(saved)storage.writeSavedInsightView('notifications',scope,saved,Date.now()-86400000);
 const Component=h.load('src/member-insight-notifications-final.tsx').MemberInsightNotificationsFinal;
 return{...h,Component,storage,calls,start:()=>h.render(Component,{noteId:'tester'}),saved:()=>storage.readSavedInsightView('notifications',{account:'tester',token})};
}

test('previous launch shows its selected page immediately, checks only that 100-row page, and replaces it with verified rows',async t=>{
 const pending=deferred(),h=await setup(t,{saved:copy([row('old')],selection({kind:'tip',selectedDay:'2026-10-18',page:2}),250),fetch:()=>pending.promise});
 await h.start();
 assert.match(h.w.document.querySelector('.minf-list').textContent,/前回の通知/);
 assert.match(h.w.document.body.textContent,/前回表示分・最新確認中/);
 assert.doesNotMatch(h.w.document.body.textContent,/通知を読み込み中/);
 assert.equal(h.w.document.querySelector('.minf-filter-panel select').value,'tip');
 assert.match(h.w.document.querySelector('.minf-pager').textContent,/2 \/ 3/);
 assert.deepEqual(h.calls.filter(c=>!c.action).map(c=>[c.page,c.pageSize,c.kind,c.day,c.includeCategoryPreview]),[[2,100,'tip','2026-10-18',false]]);
 assert.equal(h.calls.filter(c=>c.action==='recent').length,0);
 await settle(()=>pending.resolve(feed([row('new','今回の最新通知')],250)));
 assert.match(h.w.document.querySelector('.minf-list').textContent,/今回の最新通知/);
 assert.doesNotMatch(h.w.document.body.textContent,/前回の通知|前回表示分/);
 assert.equal(h.saved().value.selection.page,2);assert.equal(h.saved().value.rows[0].id,'new');
});

test('saved first page remains marked old after recent check; full response, including empty, is authoritative',async t=>{
 const full=deferred(),h=await setup(t,{fetch:b=>b.action==='recent'?Promise.resolve(Response.json({ok:true,noteId:'tester',rows:[]})):full.promise});
 await h.start();await settle();
 assert.match(h.w.document.body.textContent,/前回の通知/);assert.match(h.w.document.body.textContent,/前回表示分・最新確認中/);
 assert.equal(h.calls.filter(c=>!c.action).length,1);assert.equal(h.calls.filter(c=>c.action==='recent').length,1);
 await settle(()=>full.resolve(feed([])));
 assert.doesNotMatch(h.w.document.body.textContent,/前回の通知|前回表示分/);
 assert.match(h.w.document.body.textContent,/この分類の通知はありません/);assert.deepEqual(Array.from(h.saved().value.rows),[]);assert.equal(h.saved().value.total,0);
});

test('previous empty page shows its saved state while checking and does not become a blocking loading screen',async t=>{
 const h=await setup(t,{saved:copy([])});await h.start();
 assert.match(h.w.document.body.textContent,/前回表示分・最新確認中/);assert.match(h.w.document.body.textContent,/この分類の通知はありません/);
 assert.doesNotMatch(h.w.document.body.textContent,/通知を読み込み中/);assert.equal(h.calls.filter(c=>!c.action).length,1);
});

for(const scope of [{account:'tester',token:'older-token'},{account:'someone-else',token}]){
 test(`snapshot scope ${scope.account}/${scope.token} cannot be displayed for current account/session`,async t=>{
  const h=await setup(t,{scope});await h.start();assert.doesNotMatch(h.w.document.body.textContent,/前回の通知|前回表示分/);assert.match(h.w.document.body.textContent,/通知を読み込み中/);
 });
}

test('unbound legacy board stays hidden, including after a failed network check',async t=>{
 const h=await setup(t,{saved:null,fetch:async()=>{throw new Error('offline')}});h.w.localStorage.setItem('mumei-notification-board:tester',JSON.stringify([row('old','本人不明の旧board')]));await h.start();
 assert.doesNotMatch(h.w.document.body.textContent,/本人不明の旧board|前回表示分/);assert.match(h.w.document.body.textContent,/通知履歴の読込に失敗/);
});

test('offline keeps scoped saved page visible and explicitly reports failed latest verification',async t=>{
 const h=await setup(t,{fetch:async()=>{throw new Error('offline')}});await h.start();
 assert.match(h.w.document.querySelector('.minf-list').textContent,/前回の通知/);assert.match(h.w.document.body.textContent,/前回表示分・最新確認に失敗/);assert.match(h.w.document.body.textContent,/最新確認に失敗したため前回保存分/);
});

for(const status of [401,403]){
 test(`HTTP ${status} discards the scoped display instead of reviving saved rows`,async t=>{
  const pending=deferred(),h=await setup(t,{fetch:b=>b.action==='recent'?new Promise(()=>{}):pending.promise});await h.start();assert.match(h.w.document.body.textContent,/前回の通知/);
  await settle(()=>pending.resolve(Response.json({error:'INSIGHT_LOGIN_REQUIRED'},{status})));
  assert.doesNotMatch(h.w.document.body.textContent,/前回の通知|前回表示分/);assert.equal(h.saved(),null);
 });
}

test('server account mismatch discards the display and scoped copy',async t=>{
 const pending=deferred(),h=await setup(t,{fetch:b=>b.action==='recent'?new Promise(()=>{}):pending.promise});await h.start();await settle(()=>pending.resolve(feed([row('foreign','別人の通知')],1,'other')));
 assert.doesNotMatch(h.w.document.body.textContent,/前回の通知|別人の通知|前回表示分/);assert.match(h.w.document.body.textContent,/通知アカウント不一致/);assert.equal(h.saved(),null);
});

test('successful response persists one 100-row page rather than collecting earlier pages or preview rows',async t=>{
 const rows=Array.from({length:100},(_,i)=>row('r'+i,'通知'+i)),h=await setup(t,{saved:null,fetch:async b=>b.action==='recent'?Response.json({ok:true,noteId:'tester',rows:[]}):feed(rows,5000)});await h.start();await settle();
 assert.equal(h.saved().value.rows.length,100);assert.equal(h.saved().value.total,5000);assert.equal(h.calls.filter(c=>!c.action).length,1);assert.equal(h.calls.filter(c=>!c.action)[0].includeCategoryPreview,false);
});

test('acknowledged completion, favorite, and resolved comment body replace the previous display copy',async t=>{
 const detail={...row('reply','返信のお知らせ'),notification_type:'reply',display_category:'reply_self',target_url:'https://note.com/tester/n/n123#comment-77',comment_identity:{articleKey:'n123',commentKey:'77',url:'https://note.com/tester/n/n123#comment-77'}},completion=deferred(),favorite=deferred();
 const h=await setup(t,{saved:copy([detail]),fetch:async b=>{
  if(b.action==='completion')return completion.promise;
  if(b.action==='favorite_toggle')return favorite.promise;
  if(b.action==='comment_detail')return Response.json({ok:true,body:'保存された実返信本文',articleKey:'n123',commentKey:'77',url:detail.target_url});
  return new Promise(()=>{});
 }});await h.start();
 await h.click(h.w.document.querySelector('.minf-completion button'));assert.equal(h.saved(),null,'old unacknowledged status cannot reappear on restart');
 await settle(()=>completion.resolve(Response.json({ok:true})));assert.equal(h.saved().value.rows[0].confirmed,true);
 await h.click(h.w.document.querySelector('.minf-star'));assert.equal(h.saved(),null);
 await settle(()=>favorite.resolve(Response.json({ok:true,favorite:true,creatorKey:'person'})));assert.equal(h.saved().value.rows[0].favorite,true);assert.equal(h.saved().value.rows[0].confirmed,true);
 const details=h.w.document.querySelector('.minf-comment-context');await settle(()=>{details.open=true;details.dispatchEvent(new h.w.Event('toggle'))});
 assert.equal(h.saved().value.rows[0].meta.comment_body,'保存された実返信本文');assert.equal(h.saved().value.rows[0].favorite,true);
});


test('same component token change cannot copy old rows into the replacement token scope',async t=>{
 const held=deferred(),h=await setup(t,{fetch:async b=>{await held.promise;return b.action==='recent'?Response.json({ok:true,noteId:'tester',rows:[]}):feed([row('new','replacement rows')])}});await h.start();assert.match(h.w.document.body.textContent,/前回の通知/);
 h.w.localStorage.setItem(tokenKey,'replacement-token');await h.render(h.Component,{noteId:'tester'});
 assert.doesNotMatch(h.w.document.body.textContent,/前回の通知|前回表示分/);
 assert.equal(h.storage.readSavedInsightView('notifications',{account:'tester',token:'replacement-token'}),null);
 await settle(()=>held.resolve(true));
 assert.doesNotMatch(h.w.document.body.textContent,/前回の通知/);
 const current=h.storage.readSavedInsightView('notifications',{account:'tester',token:'replacement-token'});assert.equal(current.value.rows[0].id,'new');
});

for(const status of [401,403]){
 test(`recent HTTP ${status} also closes the saved view while the page request is pending`,async t=>{
  const recent=deferred(),h=await setup(t,{fetch:b=>b.action==='recent'?recent.promise:new Promise(()=>{})});await h.start();
  await settle(()=>recent.resolve(Response.json({error:'INSIGHT_LOGIN_REQUIRED'},{status})));
  assert.doesNotMatch(h.w.document.body.textContent,/前回の通知|前回表示分・/);assert.equal(h.saved(),null);assert.match(h.w.document.body.textContent,/ログインを確認できない/);
 });
}

test('favorite on a restored page preserves its newer body and completion instead of stale legacy board fields',async t=>{
 const latest=row('same','今回保存した通知',{confirmed:true,meta:{reply_body:'確認済みの最新本文'}}),h=await setup(t,{saved:copy([latest]),fetch:async b=>b.action==='favorite_toggle'?Response.json({ok:true,favorite:true,creatorKey:'person'}):new Promise(()=>{})});
 h.w.localStorage.setItem('mumei-notification-board:tester',JSON.stringify([{...latest,raw_text:'古い通知',confirmed:false,meta:{reply_body:'古い本文'}}]));await h.start();
 await h.click(h.w.document.querySelector('.minf-star'));await settle();
 const current=h.saved().value.rows[0];assert.equal(current.favorite,true);assert.equal(current.confirmed,true);assert.equal(current.meta.reply_body,'確認済みの最新本文');assert.equal(current.raw_text,'今回保存した通知');
});

test('non-JSON authentication failure also discards the saved page',async t=>{
 const pending=deferred(),h=await setup(t,{fetch:b=>b.action==='recent'?new Promise(()=>{}):pending.promise});await h.start();
 await settle(()=>pending.resolve(new Response('login required',{status:401})));
 assert.doesNotMatch(h.w.document.body.textContent,/前回の通知|前回表示分・/);assert.equal(h.saved(),null);
});
