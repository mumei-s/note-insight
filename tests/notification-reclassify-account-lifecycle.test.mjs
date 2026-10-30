import test from 'node:test';
import assert from 'node:assert/strict';
import * as React from 'react';
import {sceneFixture,pause} from './react-scene-fixture.mjs';

const tokenKey='mumei-insight-access-token',classification='action-v28-context:evidence-v2-articles';
const row=(name)=>({id:'same-id',notification_type:'tip',display_category:'tip',actor_name:name,raw_text:name+'の保存通知',actor_url:'https://note.com/person',actor_image_url:'https://images.test/icon.png',captured_at:'2026-10-30T00:00:00Z',confirmed:false});
async function settle(work=()=>{}){await React.act(async()=>{work();for(let i=0;i<6;i++)await pause()})}

test('前の本人の再分類応答は、切替後の同じ通知ID・保存表示・件数を変更しない',async t=>{
 let finish,finishCurrent;const pending=new Promise(resolve=>{finish=resolve}),currentPending=new Promise(resolve=>{finishCurrent=resolve}),calls=[];
 const h=await sceneFixture(t,{globals:{URLSearchParams},dependencies:{
  './creator-avatar':{CreatorAvatar:()=>null,creatorNoteId:()=>''},
  './insight-account-store':{INSIGHT_TOKEN_KEY:tokenKey,currentStoredInsightAccount:()=>({noteId:localStorage.getItem(tokenKey)==='token-a'?'account_a':'account_b'})}
 },fetch:async(url,init)=>{
  const token=init.headers['X-Insight-Token'],body=JSON.parse(init.body);calls.push({url:String(url),token,body,signal:init.signal});
  if(String(url).includes('reclassify'))return token==='token-a'?pending:currentPending;
  if(String(url).includes('creator-icons'))return Response.json({items:[]});
  const noteId=token==='token-a'?'account_a':'account_b';
  return Response.json({ok:true,noteId,rows:body.action==='recent'?[]:[row(noteId)],total:1,categoryCounts:{all:1,tip:1},statusCounts:{all:1,pending:1,completed:0}});
 }});
 h.w.localStorage.setItem(tokenKey,'token-a');for(const account of ['account_a','account_b'])h.w.localStorage.setItem('mumei-notification-reclassify-version:'+account,classification);
 const C=h.load('src/member-insight-notifications-final.tsx').MemberInsightNotificationsFinal;
 await h.render(C,{noteId:'account_a'});await settle();assert.match(h.w.document.querySelector('.minf-list').textContent,/account_a/);
 await h.click([...h.w.document.querySelectorAll('button')].find(button=>button.textContent==='未分類を再分類'));assert.equal(calls.filter(call=>call.url.includes('reclassify')).length,1);
 h.w.localStorage.setItem(tokenKey,'token-b');await h.render(C,{noteId:'account_b'});await settle();assert.match(h.w.document.querySelector('.minf-list').textContent,/account_b/);
 assert.equal(calls.find(call=>call.url.includes('reclassify')&&call.token==='token-a').signal.aborted,true,'cancel the previous account request immediately');
 const currentButton=[...h.w.document.querySelectorAll('button')].find(button=>button.textContent==='未分類を再分類');assert.ok(currentButton,'the previous flight must not lock the new account');await h.click(currentButton);
 assert.equal(calls.filter(call=>call.url.includes('reclassify')&&call.token==='token-b').length,1);const requests=calls.length;
 await settle(()=>finish(Response.json({ok:true,moved:1,checked:1,rows:[row('前の本人の再分類')],nextCursor:null})));
 assert.match(h.w.document.querySelector('.minf-list')?.textContent||'',/account_b/);assert.doesNotMatch(h.w.document.body.textContent,/前の本人の再分類|アカウント不一致/);assert.equal(calls.length,requests,'an old account completion cannot start a feed request under the new token');
 assert.ok([...h.w.document.querySelectorAll('button')].some(button=>button.textContent==='再分類を停止'),'an old finally handler cannot clear the current account progress');
 await settle(()=>finishCurrent(Response.json({ok:true,moved:0,checked:1,rows:[],nextCursor:null})));assert.ok([...h.w.document.querySelectorAll('button')].some(button=>button.textContent==='未分類を再分類'));assert.match(h.w.document.querySelector('.minf-list').textContent,/account_b/);
 const saved=h.load('src/insight-saved-view.ts').readSavedInsightView('notifications',{account:'account_b',token:'token-b'});assert.equal(saved.value.rows[0].actor_name,'account_b');
});
