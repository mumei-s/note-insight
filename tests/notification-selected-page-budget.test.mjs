import test from 'node:test';
import assert from 'node:assert/strict';
import * as React from 'react';
import {sceneFixture,pause} from './react-scene-fixture.mjs';

const tokenKey='mumei-insight-access-token';
const records=Array.from({length:200},(_,i)=>({id:String(i),notification_type:i<100?'tip':'purchase',display_category:i<100?'tip':'purchase',actor_name:`人物${i}`,raw_text:`通知${i}`,captured_at:'2026-10-17T15:30:00Z',confirmed:false,meta:{body:`保存本文${i}`}}));
async function settle(work=()=>{}){await React.act(async()=>{work();for(let i=0;i<6;i++)await pause()})}
async function choose(h,value){await settle(()=>{const select=h.w.document.querySelector('.minf-filter-panel select');select.value=value;select.dispatchEvent(new h.w.Event('change',{bubbles:true}))})}
async function fixture(t){
 const calls=[],timers=[];let heldKind='',deliver,formats=0;
 const NativeDateFormat=Intl.DateTimeFormat;
 const h=await sceneFixture(t,{globals:{URLSearchParams,Intl:{DateTimeFormat:function(...args){formats++;return new NativeDateFormat(...args)}}},dependencies:{'./creator-avatar':{CreatorAvatar:()=>React.createElement('span'),creatorNoteId:()=>''},'./insight-account-store':{INSIGHT_TOKEN_KEY:tokenKey,currentStoredInsightAccount:()=>({noteId:'tester'})}},fetch:async(url,init)=>{
  if(String(url).includes('creator-icons'))return Response.json({items:[]});
  const body=JSON.parse(init.body);calls.push(body);
  if(body.action==='recent')return Response.json({ok:true,noteId:'tester',rows:[]});
  const rows=records.filter(row=>body.kind==='all'||row.display_category===body.kind),response=()=>Response.json({ok:true,noteId:'tester',rows:rows.slice((body.page-1)*100,body.page*100),total:rows.length,categoryCounts:{all:200,tip:100,purchase:100},statusCounts:{all:200,pending:200,completed:0}});
  if(body.kind===heldKind)return new Promise(resolve=>{deliver=()=>resolve(response())});
  return response();
 }});
 h.w.setInterval=(fn,ms)=>{timers.push({fn,ms});return timers.length};h.w.clearInterval=()=>{};
 h.w.localStorage.setItem(tokenKey,'token-a');h.w.localStorage.setItem('mumei-notification-reclassify-version:tester','action-v28-context:evidence-v2-articles');
 const Component=h.load('src/member-insight-notifications-final.tsx').MemberInsightNotificationsFinal;
 const start=props=>h.render(Component,{noteId:'tester',...props});await start();await settle();
 return{...h,calls,timers,start,feeds:()=>calls.filter(body=>!body.action),hold:kind=>{heldKind=kind},deliver:()=>deliver(),formats:()=>formats};
}

test('起動・明示更新・定期確認では現在の100件だけを要求し、非表示分類の本文を取得しない',async t=>{
 const h=await fixture(t);assert.equal(h.feeds().length,1);
 assert.equal(h.w.document.querySelectorAll('.minf-list article').length,100);
 assert.equal(h.w.document.querySelector('.minf-pager select').options.length,2,'exact total still permits page 2');
 assert.match(h.w.document.querySelector('.minf-filter-panel select').textContent,/購入 \(100\)/);
 await h.start({revision:1});await settle();
 await settle(h.timers.find(timer=>timer.ms===120000).fn);
 assert.equal(h.feeds().length,3);
 for(const body of h.feeds()){assert.equal(body.includeCategoryPreview,false,'unseen previews must not delay or increase any selected-page response');assert.equal(body.pageSize,100);assert.equal(body.kind,'all')}
});

test('未取得分類を開いた時にそのページを確認し、確認済みの同じ分類へ戻る時は再取得しない',async t=>{
 const h=await fixture(t);h.hold('purchase');await choose(h,'purchase');
 assert.equal(h.feeds().length,2);assert.equal(h.feeds().at(-1).kind,'purchase');assert.equal(h.feeds().at(-1).includeCategoryPreview,false);
 assert.equal(h.w.document.querySelectorAll('.minf-list article').length,0,'unrelated initial rows are not presented as the selected category');
 await settle(h.deliver);
 assert.equal(h.w.document.querySelectorAll('.minf-list article').length,100);
 assert.ok([...h.w.document.querySelectorAll('.minf-list article')].every(article=>article.classList.contains('type-purchase')));
 await choose(h,'all');await choose(h,'purchase');
 assert.equal(h.feeds().length,2,'current session verified pages keep their cache reuse');
 assert.equal(h.w.document.querySelectorAll('.minf-list article').length,100);
});

test('通知100件の再描画でも日時書式を共有し、日本時間の日付と時刻を維持する',async t=>{
 const h=await fixture(t),times=[...h.w.document.querySelectorAll('.minf-list time')];
 assert.equal(times.length,100);for(const time of times)assert.equal(time.textContent,'2026/10/18 00:30');
 await h.start({revision:1});await settle();
 assert.equal(h.formats(),1,'a whole list refresh should not reconstruct 100 expensive locale formatters');
});
