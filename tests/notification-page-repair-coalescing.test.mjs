import test from 'node:test';
import assert from 'node:assert/strict';
import * as React from 'react';
import {sceneFixture,pause} from './react-scene-fixture.mjs';

const tokenKey='mumei-insight-access-token';
const row=(id,text='最新の架空通知',kind='tip')=>({id,notification_type:kind,display_category:kind,actor_name:'架空人物'+id,actor_url:'https://note.com/fictional',actor_image_url:'https://images.test/icon.png',raw_text:text,captured_at:'2026-10-27T12:00:00Z',confirmed:false});
async function settle(work=()=>{}){await React.act(async()=>{work();for(let i=0;i<6;i++)await pause()})}
async function fixture(t,{recent=[row('new')],kind='all',savedRows=[]}={}){
 const calls=[],pending=[];
 const h=await sceneFixture(t,{globals:{URLSearchParams},dependencies:{'./creator-avatar':{CreatorAvatar:()=>null,creatorNoteId:()=>''},'./insight-account-store':{INSIGHT_TOKEN_KEY:tokenKey,currentStoredInsightAccount:()=>({noteId:'tester'})}},fetch:async(url,init)=>{
  if(String(url).includes('creator-icons'))return Response.json({items:[]});const body=JSON.parse(init.body);calls.push(body);
  if(body.action==='recent')return Response.json({ok:true,noteId:'tester',rows:recent});
  return new Promise(resolve=>pending.push({body,resolve}));
 }});
 h.w.localStorage.setItem(tokenKey,'fixture-token');h.w.localStorage.setItem('mumei-notification-reclassify-version:tester','action-v28-context:evidence-v2-articles');
 if(kind!=='all')h.load('src/insight-saved-view.ts').writeSavedInsightView('notifications',{account:'tester',token:'fixture-token'},{selection:{kind,handlingStatus:'all',selectedDay:'',page:1},rows:savedRows,total:savedRows.length,statusCounts:{all:savedRows.length},categoryCounts:{all:savedRows.length,[kind]:savedRows.length},updatedAt:'',syncAt:'',serverSync:{received:0,confirmed:0,source:''}},Date.now()-1000);
 const Component=h.load('src/member-insight-notifications-final.tsx').MemberInsightNotificationsFinal;await h.render(Component,{noteId:'tester'});await settle();
 return{...h,calls,pending,feeds:()=>calls.filter(body=>!body.action),reply:(request,rows,total=rows.length)=>request.resolve(Response.json({ok:true,noteId:'tester',rows,total,categoryCounts:{all:total,tip:total},statusCounts:{all:total,pending:total,completed:0}}))};
}

test('起動中の新着確認を全ページ取得に合流し、同じ最新本文を含む応答なら二重取得しない',async t=>{
 const incoming=row('new'),h=await fixture(t,{recent:[incoming]});assert.equal(h.feeds().length,1);assert.equal(h.calls.filter(body=>body.action==='recent').length,1);assert.match(h.w.document.querySelector('.minf-list').textContent,/最新の架空通知/);
 await settle(()=>h.reply(h.pending[0],[incoming,row('older','以前の架空通知')]));
 assert.equal(h.feeds().length,1,'新着が同じ応答に反映済みなら同一ページを取得し直さない');assert.equal(h.w.document.querySelectorAll('.minf-list article').length,2);assert.equal(h.w.document.querySelector('.minf-error'),null);
});

for(const update of['new-id','changed-body'])test(`進行中の全ページに${update}が未反映なら新着を逆戻りさせず、一回だけ確認を続ける`,async t=>{
 const incoming=row(update==='new-id'?'new':'same','取得中に到着した最新本文'),h=await fixture(t,{recent:[incoming]}),old=row(update==='new-id'?'old':'same','以前の古い本文');
 assert.equal(h.feeds().length,1);await settle(()=>h.reply(h.pending[0],[old]));
 assert.equal(h.feeds().length,2);assert.equal(h.pending.length,2);assert.match(h.w.document.querySelector('.minf-list').textContent,/取得中に到着した最新本文/);assert.doesNotMatch(h.w.document.querySelector('.minf-list').textContent,/以前の古い本文/);
 await settle(()=>h.reply(h.pending[1],[incoming]));assert.equal(h.feeds().length,2,'確認の再帰ループを作らない');assert.match(h.w.document.querySelector('.minf-list').textContent,/取得中に到着した最新本文/);
});

test('合流先の取得が時間切れなら自動で繰り返さず、新着表示と明示再試行を保つ',async t=>{
 const h=await fixture(t);await settle(()=>h.pending[0].resolve(Response.json({ok:false,error:'57014 statement timeout'},{status:504})));
 assert.equal(h.feeds().length,1);assert.match(h.w.document.querySelector('.minf-list').textContent,/最新の架空通知/);assert.match(h.w.document.querySelector('.minf-error').textContent,/時間切れ/);
 await h.click(h.w.document.querySelector('.minf-error button'));await settle();assert.equal(h.feeds().length,2);await settle(()=>h.reply(h.pending[1],[row('new')]));assert.equal(h.feeds().length,2);
});

test('分類変更後は前の合流計画を破棄し、遅い応答から別分類を再取得しない',async t=>{
 const h=await fixture(t);await settle(()=>{const select=h.w.document.querySelector('.minf-filter-panel select');select.value='purchase';select.dispatchEvent(new h.w.Event('change',{bubbles:true}))});
 assert.equal(h.feeds().length,2);assert.equal(h.pending[1].body.kind,'purchase');await settle(()=>h.reply(h.pending[0],[row('old','遅い別分類の本文')]));assert.equal(h.feeds().length,2);
 await settle(()=>h.reply(h.pending[1],[row('purchase','選択した購入通知','purchase')]));assert.equal(h.feeds().length,2);assert.match(h.w.document.querySelector('.minf-list').textContent,/選択した購入通知/);assert.doesNotMatch(h.w.document.body.textContent,/遅い別分類の本文/);
});

test('別分類の新着は、進行中の選択ページに存在しないことを理由に二重取得しない',async t=>{
 const h=await fixture(t,{kind:'tip',recent:[row('purchase','別分類の新着','purchase')]});assert.equal(h.feeds().length,1);assert.equal(h.pending[0].body.kind,'tip');
 await settle(()=>h.reply(h.pending[0],[row('tip','選択した分類の本文')]));assert.equal(h.feeds().length,1);assert.match(h.w.document.querySelector('.minf-list').textContent,/選択した分類の本文/);assert.doesNotMatch(h.w.document.querySelector('.minf-list').textContent,/別分類の新着/);
});

for(const reflected of[true,false])test(`選択分類から移動した通知は、進行中応答の除外状態で確認する (${reflected?'反映済み':'未反映'})`,async t=>{
 const old=row('same','以前の分類本文'),moved=row('same','別分類へ移動した最新本文','purchase'),h=await fixture(t,{kind:'tip',savedRows:[old],recent:[moved]});
 await settle(()=>h.reply(h.pending[0],reflected?[]:[old]));assert.equal(h.feeds().length,reflected?1:2);
 if(!reflected){assert.doesNotMatch(h.w.document.body.textContent,/以前の分類本文/);await settle(()=>h.reply(h.pending[1],[]))}
 assert.equal(h.w.document.querySelector('.minf-list'),null);assert.match(h.w.document.body.textContent,/この分類の通知はありません/);
});
