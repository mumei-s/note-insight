import test from 'node:test';
import assert from 'node:assert/strict';
import * as React from 'react';
import {sceneFixture,pause} from './react-scene-fixture.mjs';

const tokenKey='mumei-insight-access-token';
async function settle(work=()=>{}){await React.act(async()=>{work();for(let i=0;i<5;i++)await pause()})}
async function select(h,selector,value){await settle(()=>{const el=h.w.document.querySelector(selector);assert.ok(el,selector);assert.equal(el.disabled,false);el.value=String(value);el.dispatchEvent(new h.w.Event('change',{bubbles:true}))})}
async function fixture(t){
 let now=Date.now(),held=false,incoming=[],reclassified=[];
 class Clock extends Date{static now(){return now}}
 const globals={URLSearchParams,Date:Clock};
 const calls=[],pending=[],records=Array.from({length:250},(_,i)=>({id:'r'+i,notification_type:'tip',display_category:'tip',actor_name:'架空人物'+i,actor_url:'https://note.com/fictional',actor_image_url:'https://images.test/icon.png',raw_text:'架空の通知'+i,captured_at:new Date(Date.parse('2026-10-27T12:00:00Z')-i*1000).toISOString(),confirmed:false}));
 const response=(body,{prefix='',noteId='tester'}={})=>Response.json({ok:true,noteId,rows:records.slice((body.page-1)*100,body.page*100).map(row=>({...row,actor_name:prefix+row.actor_name})),total:records.length,categoryCounts:{all:250,tip:250},statusCounts:{all:250,pending:250,completed:0}});
 const h=await sceneFixture(t,{globals,dependencies:{'./creator-avatar':{CreatorAvatar:()=>null,creatorNoteId:()=>''},'./insight-account-store':{INSIGHT_TOKEN_KEY:tokenKey,currentStoredInsightAccount:()=>({noteId:'tester'})}},fetch:async(url,init)=>{
  if(String(url).includes('creator-icons'))return Response.json({items:[]});
  if(String(url).endsWith('insight-notification-reclassify'))return Response.json({ok:true,checked:reclassified.length,moved:reclassified.length,rows:reclassified,nextCursor:null});
  const body=JSON.parse(init.body);calls.push(body);
  if(body.action==='recent')return Response.json({ok:true,noteId:'tester',rows:incoming});
  if(held)return new Promise(resolve=>pending.push({body,resolve}));
  return response(body);
 }});
 globals.Event=h.w.Event;h.w.localStorage.setItem(tokenKey,'fixture-token');h.w.localStorage.setItem('mumei-notification-reclassify-version:tester','action-v28-context:evidence-v2-articles');
 const Component=h.load('src/member-insight-notifications-final.tsx').MemberInsightNotificationsFinal;
 const start=props=>h.render(Component,{noteId:'tester',...props});await start();await settle();
 return{...h,Component,start,calls,pending,records,setRecent:rows=>{incoming=rows},setReclassified:rows=>{reclassified=rows},feeds:()=>calls.filter(body=>!body.action),advance:()=>{now+=61_000},hold:()=>{held=true},page:()=>h.w.document.querySelector('.minf-pager select')?.value,first:()=>h.w.document.querySelector('.minf-actor')?.textContent,reply:(request,options)=>request.resolve(response(request.body,options)),async visitAll(){for(const p of[2,3])await select(h,'.minf-pager select',p)}};
}

test('60秒を過ぎた既読ページも即表示し、時間経過だけで全件を再取得しない',async t=>{
 const h=await fixture(t);await h.visitAll();for(const p of[2,1])await select(h,'.minf-pager select',p);assert.equal(h.feeds().length,3);
 h.advance();h.hold();await select(h,'.minf-pager select',2);
 assert.equal(h.page(),'2');assert.equal(h.first(),'架空人物100');assert.equal(h.w.document.querySelector('.minf-pager select').disabled,false);assert.equal(h.w.document.querySelector('#minf-notifications').getAttribute('aria-busy'),'false');
 assert.doesNotMatch(h.w.document.body.textContent,/ページを読み込み中/);assert.deepEqual(h.feeds().map(body=>body.page),[1,2,3]);assert.equal(h.pending.length,0);
 await h.start({revision:1});await settle();assert.equal(h.pending.length,1);assert.equal(h.pending[0].body.page,2);assert.equal(h.first(),'架空人物100');assert.equal(h.w.document.querySelector('.minf-pager select').disabled,false);assert.match(h.w.document.querySelector('.minf-saved-status').textContent,/最新確認中/);
 await settle(()=>h.reply(h.pending[0],{prefix:'最新'}));assert.equal(h.first(),'最新架空人物100');assert.equal(h.w.document.querySelector('.minf-saved-status'),null);assert.equal(h.w.document.querySelector('#minf-notifications').getAttribute('aria-busy'),'false');
});

test('古いページの最新確認が時間切れでも対象ページを保ち、再試行も同じページを確認する',async t=>{
 const h=await fixture(t);await h.visitAll();h.advance();await select(h,'.minf-pager select',2);h.hold();await h.start({revision:1});await settle();
 await settle(()=>h.pending[0].resolve(Response.json({ok:false,error:'57014 statement timeout'},{status:504})));
 assert.equal(h.page(),'2');assert.equal(h.first(),'架空人物100');assert.match(h.w.document.querySelector('.minf-saved-status').textContent,/最新確認に失敗/);assert.match(h.w.document.querySelector('.minf-error').textContent,/時間切れ/);
 await h.click(h.w.document.querySelector('.minf-error button'));await settle();assert.equal(h.pending.length,2);assert.equal(h.pending[1].body.page,2);assert.equal(h.first(),'架空人物100');
 await settle(()=>h.reply(h.pending[1],{prefix:'確認済み'}));assert.equal(h.first(),'確認済み架空人物100');assert.equal(h.w.document.querySelector('.minf-error'),null);assert.equal(h.w.document.querySelector('.minf-saved-status'),null);
});

test('裏の確認中にも別の既読ページへ移動でき、先の遅い応答で表示を戻さない',async t=>{
 const h=await fixture(t);await h.visitAll();h.advance();await select(h,'.minf-pager select',2);h.hold();await h.start({revision:1});await settle();await select(h,'.minf-pager select',1);
 assert.equal(h.page(),'1');assert.equal(h.first(),'架空人物0');assert.deepEqual(h.pending.map(request=>request.body.page),[2,1]);
 await settle(()=>h.reply(h.pending[0],{prefix:'遅い前ページ'}));assert.equal(h.page(),'1');assert.equal(h.first(),'架空人物0');
 await settle(()=>h.reply(h.pending[1],{prefix:'最新対象'}));assert.equal(h.page(),'1');assert.equal(h.first(),'最新対象架空人物0');
});

test('最新確認の失敗では古いページをfresh扱いにせず、戻る時も確認を続ける',async t=>{
 const h=await fixture(t);await h.visitAll();h.advance();await select(h,'.minf-pager select',2);h.hold();await h.start({revision:1});await settle();
 await settle(()=>h.pending[0].resolve(Response.json({ok:false,error:'57014 statement timeout'},{status:504})));
 await select(h,'.minf-pager select',1);await select(h,'.minf-pager select',2);
 assert.equal(h.page(),'2');assert.equal(h.first(),'架空人物100');assert.deepEqual(h.pending.map(request=>request.body.page),[2,1,2]);
 await settle(()=>h.reply(h.pending[1],{prefix:'遅い前ページ'}));assert.equal(h.first(),'架空人物100');await settle(()=>h.reply(h.pending[2]));
});

for(const status of[401,403])test(`保持ページの確認がHTTP ${status}なら、本文と前回表示のコピーを閉じる`,async t=>{
 const h=await fixture(t);await h.visitAll();h.advance();await select(h,'.minf-pager select',2);h.hold();await h.start({revision:1});await settle();assert.equal(h.first(),'架空人物100');
 await settle(()=>h.pending[0].resolve(Response.json({ok:false,error:'INSIGHT_LOGIN_REQUIRED'},{status})));
 assert.equal(h.w.document.querySelector('.minf-list'),null);assert.equal(h.w.document.querySelector('.minf-saved-status'),null);assert.equal(h.load('src/insight-saved-view.ts').readSavedInsightView('notifications',{account:'tester',token:'fixture-token'}),null);
});

test('revision更新と画面の開き直しでも同じページを保持し、必要な最新確認を省かない',async t=>{
 const h=await fixture(t);await h.visitAll();h.hold();await h.start({revision:1});await settle();assert.equal(h.page(),'3');assert.equal(h.first(),'架空人物200');assert.equal(h.pending.length,1);assert.equal(h.pending[0].body.page,3);
 await settle(()=>h.reply(h.pending[0]));h.advance();await React.act(async()=>{h.root.render(null);await pause()});await h.start({revision:1});await settle();
 assert.equal(h.page(),'3');assert.equal(h.first(),'架空人物200');assert.equal(h.pending.length,1,'時間経過だけの同一document再表示で取得済みページを読み直さない');assert.equal(h.w.document.querySelector('.minf-pager select').disabled,false);
 await h.start({revision:2});await settle();assert.equal(h.pending.length,2);assert.equal(h.pending[1].body.page,3);
 await settle(()=>h.reply(h.pending[1],{noteId:'someone_else'}));assert.equal(h.w.document.querySelector('.minf-list'),null);assert.match(h.w.document.querySelector('.minf-error').textContent,/アカウント不一致/);
});

test('同じIDの本文だけを新着で更新した時は、取得済みページも更新して戻る際の再取得をしない',async t=>{
 const h=await fixture(t);await h.visitAll();await select(h,'.minf-pager select',1);const count=h.feeds().length;
 h.setRecent([{...h.records[0],raw_text:'新着確認で更新された最新本文'}]);await settle(()=>h.w.dispatchEvent(new h.w.Event('focus')));
 assert.equal(h.feeds().length,count);assert.match(h.w.document.querySelector('.minf-list').textContent,/新着確認で更新された最新本文/);
 h.advance();await select(h,'.minf-pager select',2);await select(h,'.minf-pager select',1);
 assert.equal(h.feeds().length,count);assert.match(h.w.document.querySelector('.minf-list').textContent,/新着確認で更新された最新本文/);assert.doesNotMatch(h.w.document.querySelector('.minf-list article').textContent,/架空の通知0/);
});

test('再分類で変わった時は他の取得済みページも無効化し、最終バッチの同じページを二重取得しない',async t=>{
 const h=await fixture(t);await h.visitAll();const changed={...h.records[100],raw_text:'再分類した本文',notification_type:'purchase',display_category:'purchase'};h.records[100]=changed;h.setReclassified([changed]);const before=h.feeds().length;
 const button=[...h.w.document.querySelectorAll('button')].find(button=>button.textContent==='未分類を再分類');assert.ok(button);await h.click(button);await settle();
 assert.equal(h.feeds().length,before+1,'最終バッチと完了時に同じページを二重取得しない');
 await select(h,'.minf-pager select',2);assert.equal(h.feeds().length,before+2,'再分類の影響を受けた別ページは再確認する');assert.match(h.w.document.querySelector('.minf-list').textContent,/再分類した本文/);
});
