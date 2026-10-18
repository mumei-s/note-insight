import test from 'node:test';
import assert from 'node:assert/strict';
import * as React from 'react';
import {sceneFixture,pause} from './react-scene-fixture.mjs';

const tokenKey='mumei-insight-access-token';
const response=value=>Response.json({ok:true,...value});
async function settle(fn=()=>{}){await React.act(async()=>{fn();for(let i=0;i<5;i++)await pause()})}
async function fixture(t,{count=1200,legacy=false}={}){
 let now=Date.now(),savedAt='2026-10-14T01:00:00.000Z',runAt=savedAt,body='保存済み本文',failSummary=false,failMessages=false,peoplePending=null;
 let people=[{person_key:'note:peer',peer_note_id:'peer',peer_name:'選択した相手',last_message_at:'2026-10-14T00:00:00Z',room_count:1}];
 const calls=[],intervals=[];
 class Clock extends Date{static now(){return now}}
 const h=await sceneFixture(t,{globals:{Date:Clock},dependencies:{
  './creator-avatar':{CreatorAvatar:()=>React.createElement('span')},
  './insight-account-store':{INSIGHT_TOKEN_KEY:tokenKey,currentStoredInsightAccount:()=>({noteId:'tester'})},
  './insight-release':{CURRENT_DM_VERSION:'1.4.10',fetchInsightRelease:async()=>({dmVersion:'1.4.10'}),versionDiffers:()=>false},
 },fetch:async(_url,init)=>{
  const x=JSON.parse(init.body);calls.push({action:x.action,page:x.page,token:init.headers['X-Insight-Token']});
  if(x.action==='summary')return failSummary?new Response(JSON.stringify({ok:false,error:'SUMMARY_UNAVAILABLE'}),{status:500}):response({messages:count,threads:1,readerStatus:[],lastSync:{created_at:runAt,upserted_count:count,thread_count:1},...(legacy?{}:{lastMessageSavedAt:count?savedAt:null})});
  if(x.action==='people')return peoplePending||response({rows:people});
  if(x.action==='stats')return response({paired:true});
  if(x.action==='person_messages')return failMessages?new Response(JSON.stringify({ok:false,error:'BODY_UNAVAILABLE'}),{status:500}):response({rows:Array.from({length:count},(_,i)=>({message_key:'m'+i,body:body+i+':'+x.personKey})).slice((x.page-1)*500,x.page*500),total:count});
  throw new Error('Unexpected action '+x.action);
 }});
 h.w.localStorage.setItem(tokenKey,'token-a');
 h.w.setInterval=(fn,ms)=>{const timer={fn,ms,cancelled:false};intervals.push(timer);return timer};h.w.clearInterval=timer=>{if(timer)timer.cancelled=true};
 const C=h.load('src/member-insight-dm.tsx').MemberInsightDm;
 return{...h,calls,renderDm:props=>h.render(C,{active:true,revision:0,...props}),open:()=>h.w.document.querySelector('.midm-threads button')?h.click(h.w.document.querySelector('.midm-threads button')):settle(),
  poll:(advance=61000)=>settle(()=>{now+=advance;intervals.findLast(timer=>timer.ms===60000&&!timer.cancelled).fn()}),
  advance:ms=>{now+=ms},update:next=>{if('count'in next)count=next.count;if('savedAt'in next)savedAt=next.savedAt;if('runAt'in next)runAt=next.runAt;if('body'in next)body=next.body;if('failSummary'in next)failSummary=next.failSummary;if('failMessages'in next)failMessages=next.failMessages;if('people'in next)people=next.people;if('peoplePending'in next)peoplePending=next.peoplePending},
  count:action=>calls.filter(call=>call.action===action).length,text:()=>h.w.document.body.textContent};
}

test('検証済みDMは通常pollと60秒以内の復帰で再取得せず期限超は本文・選択を保持して確認する',async t=>{
 const h=await fixture(t);await h.renderDm();await h.open();await settle();
 assert.equal(h.count('person_messages'),1);const article=h.w.document.querySelector('.midm-message'),panel=h.w.document.querySelector('.midm-history-panel');panel.open=true;
 const before={summary:h.count('summary'),people:h.count('people'),stats:h.count('stats')};
 await h.poll(0);assert.equal(h.count('summary'),before.summary);assert.equal(h.count('person_messages'),1);assert.equal(h.count('people'),before.people);assert.equal(h.count('stats'),before.stats);
 h.advance(30000);await h.renderDm({active:false});await h.renderDm({active:true});await settle();
 assert.equal(h.count('summary'),before.summary);assert.equal(h.count('person_messages'),1);
 assert.equal(h.w.document.querySelector('.midm-message'),article);assert.equal(h.w.document.querySelector('.midm-history-panel'),panel);assert.equal(panel.open,true);assert.match(h.text(),/選択した相手/);assert.equal(h.w.document.querySelectorAll('.midm-message').length,500);
 h.advance(60000);await h.renderDm({active:false});await h.renderDm({active:true});await settle();assert.equal(h.count('person_messages'),2);assert.equal(h.w.document.querySelector('.midm-message'),article);assert.equal(panel.open,true);
});

test('同じDM件数でも保存stampが変わった本文を読み直し編集を表示する',async t=>{
 const h=await fixture(t,{count:1});await h.renderDm();await h.open();h.update({savedAt:'2026-10-14T01:00:01.000Z',body:'編集後の本文'});await h.poll();
 assert.equal(h.count('person_messages'),2);assert.match(h.text(),/編集後の本文/);assert.doesNotMatch(h.text(),/保存済み本文/);
});

test('owner保持で本文保存日時が不変でも本文upsert runの変更を再確認する',async t=>{
 const h=await fixture(t,{count:1});await h.renderDm();await h.open();h.update({runAt:'2026-10-14T01:00:01.000Z',body:'owner保存後の本文'});await h.poll();assert.equal(h.count('person_messages'),2);assert.match(h.text(),/owner保存後の本文/);
});

test('Readerから新しい保存signalが届いたら60秒以内でも本文を再確認する',async t=>{
 const h=await fixture(t,{count:1});await h.renderDm();await h.open();const send=lastSaveAt=>h.w.dispatchEvent(new h.w.MessageEvent('message',{source:h.w,origin:h.w.location.origin,data:{source:'mumei-dm-status-bridge',noteId:'tester',status:{lastSaveAt}}}));await settle(()=>send(100));h.update({body:'Reader保存後の本文'});await settle(()=>send(200));assert.equal(h.count('person_messages'),2);assert.match(h.text(),/Reader保存後の本文/);
});

test('同じ保存stampでも件数減少は保存先を再読取して削除を反映する',async t=>{
 const h=await fixture(t,{count:2});await h.renderDm();await h.open();h.update({count:1});await h.poll();
 assert.equal(h.count('person_messages'),2);assert.equal(h.w.document.querySelectorAll('.midm-message').length,1);
});

test('stamp不変でも明示revisionと手動再確認は最新本文を読み直す',async t=>{
 const h=await fixture(t,{count:1});await h.renderDm();await h.open();h.update({body:'更新後の本文'});await h.renderDm({revision:1});await settle();assert.equal(h.count('person_messages'),2);assert.match(h.text(),/更新後の本文/);
 h.update({body:'手動再確認後の本文'});await h.click([...h.w.document.querySelectorAll('button')].find(button=>button.textContent==='保存先を再確認'));await settle();assert.equal(h.count('person_messages'),3);assert.match(h.text(),/手動再確認後の本文/);
});

test('summary確認に失敗しても検証済みDM本文を保持し空や完了へ置換しない',async t=>{
 const h=await fixture(t,{count:1});await h.renderDm();await h.open();h.update({failSummary:true});await h.poll();assert.equal(h.count('person_messages'),1);assert.match(h.text(),/保存済み本文/);assert.match(h.text(),/SUMMARY_UNAVAILABLE/);
});

test('保存stampを返さない旧APIでも定期確認で表示ページの同数編集を確認する',async t=>{
 const h=await fixture(t,{count:1,legacy:true});await h.renderDm();await h.open();h.update({body:'旧APIの編集後本文'});await h.poll();assert.equal(h.count('person_messages'),2);assert.match(h.text(),/旧APIの編集後本文/);
});

test('DM画面を新しく作り直した時は同じ本人でも最初に保存先の最新本文を検証する',async t=>{
 const h=await fixture(t,{count:1});await h.renderDm();await h.open();await h.render(()=>null);h.update({body:'再起動後の最新本文'});await h.renderDm();await h.open();assert.equal(h.count('person_messages'),2);assert.match(h.text(),/再起動後の最新本文/);
});

test('遅い相手一覧の再確認が途中で選び直した相手と本文を元へ戻さない',async t=>{
 const h=await fixture(t,{count:1}),people=[{person_key:'note:a',peer_note_id:'a',peer_name:'相手A'},{person_key:'note:b',peer_note_id:'b',peer_name:'相手B'}];h.update({people});await h.renderDm();await h.open();let finish;h.update({peoplePending:new Promise(resolve=>{finish=resolve})});h.advance(61000);await h.poll();
 await h.click(h.w.document.querySelector('.midm-back-list'));await h.click([...h.w.document.querySelectorAll('.midm-threads button')].find(button=>button.textContent.includes('相手B')));await settle(()=>finish(response({rows:people})));
 assert.match(h.w.document.querySelector('.midm-room-head').textContent,/相手B/);assert.match(h.w.document.querySelector('.midm-messages').textContent,/note:b/);assert.doesNotMatch(h.w.document.querySelector('.midm-messages').textContent,/note:a/);
});

test('手動本文確認の失敗をfresh成功として再利用せず次の確認で再試行する',async t=>{
 const h=await fixture(t,{count:1});await h.renderDm();await h.open();h.update({failMessages:true});await h.click([...h.w.document.querySelectorAll('button')].find(button=>button.textContent==='保存先を再確認'));await settle();assert.match(h.text(),/BODY_UNAVAILABLE/);assert.match(h.text(),/保存済み本文/);
 h.update({failMessages:false,body:'再試行後の本文'});await h.poll();assert.equal(h.count('person_messages'),3);assert.match(h.text(),/再試行後の本文/);assert.doesNotMatch(h.text(),/BODY_UNAVAILABLE/);
});
