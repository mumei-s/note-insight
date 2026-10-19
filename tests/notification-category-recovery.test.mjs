import test from 'node:test';
import assert from 'node:assert/strict';
import * as React from 'react';
import {sceneFixture,pause} from './react-scene-fixture.mjs';

const tokenKey='mumei-insight-access-token',token='category-recovery-token';
const counts={all:209,tip:189,rating:20};
const row=(id,kind='rating')=>({id,notification_type:kind,display_category:kind,actor_name:'人物 '+id,actor_url:'https://note.com/person',actor_image_url:'https://images.test/person.png',raw_text:kind==='rating'?'記事を高評価しました':'保存された通知',captured_at:'2026-10-19T12:00:00Z',confirmed:false});
const ratingRows=Array.from({length:20},(_,i)=>row('rating-'+i));
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve}};
const response=(rows,total=rows.length)=>Response.json({ok:true,noteId:'tester',rows,total,categoryCounts:counts,statusCounts:{all:total,pending:total,completed:0}});
const timeout=()=>Response.json({ok:false,error:'NOTIFICATION_FEED_READ_FAILED:57014'},{status:500});
async function settle(work=()=>{}){await React.act(async()=>{work();for(let i=0;i<6;i++)await pause()})}
async function choose(h,kind){await settle(()=>{const select=h.w.document.querySelector('.minf-filter-panel select');select.value=kind;select.dispatchEvent(new h.w.Event('change',{bubbles:true}))})}
async function fixture(t,{selected=async()=>response(ratingRows),all,saved}={}){
 const calls=[],timers=[];
 const h=await sceneFixture(t,{globals:{URLSearchParams},dependencies:{
  './creator-avatar':{CreatorAvatar:()=>null,creatorNoteId:()=>''},
  './insight-account-store':{INSIGHT_TOKEN_KEY:tokenKey,currentStoredInsightAccount:()=>({noteId:'tester'})},
 },fetch:async(url,init)=>{
  if(String(url).includes('creator-icons'))return Response.json({items:[]});
  const body=JSON.parse(init.body);calls.push(body);
  if(body.action==='recent')return Response.json({ok:true,noteId:'tester',rows:[]});
  if(body.kind==='all')return all?all(body):response(Array.from({length:100},(_,i)=>row('tip-'+i,'tip')),209);
  return selected(body);
 }});
 h.w.localStorage.setItem(tokenKey,token);
 h.w.localStorage.setItem('mumei-notification-reclassify-version:tester','action-v28-context:evidence-v2-articles');
 h.w.setInterval=(fn,ms)=>{timers.push({fn,ms,active:true});return timers.length};
 h.w.clearInterval=id=>{if(timers[id-1])timers[id-1].active=false};
 const storage=h.load('src/insight-saved-view.ts');
 if(saved)storage.writeSavedInsightView('notifications',{account:'tester',token},saved,Date.now()-86400000);
 const Component=h.load('src/member-insight-notifications-final.tsx').MemberInsightNotificationsFinal;
 await h.render(Component,{noteId:'tester'});await settle();
 return{...h,calls,timers,feeds:()=>calls.filter(body=>!body.action),saved:()=>storage.readSavedInsightView('notifications',{account:'tester',token}),retry:()=>h.w.document.querySelector('.minf-error button'),text:()=>h.w.document.querySelector('.minf').textContent};
}

test('高評価20件の読込が失敗しても全209件を表示せず、通知なしにせず、その分類だけ再試行する',async t=>{
 const pending=deferred();let attempts=0;
 const h=await fixture(t,{selected:()=>++attempts===1?pending.promise:response(ratingRows)});
 assert.match(h.w.document.querySelector('.minf-handling-tabs').textContent,/209/);
 await choose(h,'rating');
 assert.doesNotMatch(h.w.document.querySelector('.minf-handling-tabs').textContent,/209/);
 assert.match(h.text(),/通知を読み込み中/);
 assert.doesNotMatch(h.text(),/この分類の通知はありません/);
 await settle(()=>pending.resolve(timeout()));
 assert.match(h.w.document.querySelector('.minf-error').textContent,/通知履歴の読込に失敗/);
 assert.match(h.w.document.querySelector('.minf-error').textContent,/時間切れ/);
 assert.doesNotMatch(h.w.document.querySelector('.minf-error').textContent,/57014/);
 assert.doesNotMatch(h.text(),/この分類の通知はありません/);
 assert.equal(h.w.document.querySelectorAll('.minf-list article').length,0);
 assert.equal(h.saved().value.selection.kind,'all','別分類の保存済み一覧を高評価へコピーしない');
 assert.equal(h.retry().textContent,'再試行');assert.equal(h.retry().disabled,false);
 await h.click(h.retry());await settle();
 assert.equal(h.w.document.querySelectorAll('.minf-list article').length,20);
 assert.equal(h.w.document.querySelector('.minf-handling-tabs button small').textContent,'20');
 assert.equal(h.w.document.querySelector('.minf-error'),null);
 assert.deepEqual(h.feeds().map(body=>body.kind),['all','rating','rating']);
 for(const body of h.feeds()){assert.equal(body.pageSize,100);assert.equal(body.includeCategoryPreview,false)}
});

test('未取得分類の通信中に別分類へ移っても、古い失敗応答を空表示やエラーへ反映しない',async t=>{
 const rating=deferred(),purchase=deferred();
 const h=await fixture(t,{selected:body=>body.kind==='rating'?rating.promise:purchase.promise});
 await choose(h,'rating');await choose(h,'purchase');
 await settle(()=>rating.resolve(timeout()));
 assert.equal(h.w.document.querySelector('.minf-filter-panel select').value,'purchase');
 assert.match(h.text(),/通知を読み込み中/);assert.doesNotMatch(h.text(),/この分類の通知はありません/);
 assert.equal(h.w.document.querySelector('.minf-error'),null);
 await settle(()=>purchase.resolve(response([row('purchase-one','purchase')])));
 assert.equal(h.w.document.querySelectorAll('.minf-list article').length,1);
 assert.ok(h.w.document.querySelector('.minf-list article.type-purchase'));
 assert.equal(h.w.document.querySelector('.minf-error'),null);
});

for(const [label,badRows] of [['本文0件',[]],['別分類の本文だけ',[row('wrong-kind','tip')]]])test(`件数あり・${label}の矛盾応答を正常キャッシュとして保存せず、次に開いた時も再確認する`,async t=>{
 let attempts=0;const h=await fixture(t,{selected:()=>++attempts===1?response(badRows,20):response(ratingRows)});
 await choose(h,'rating');
 assert.match(h.w.document.querySelector('.minf-error').textContent,/応答が不完全/);
 assert.doesNotMatch(h.text(),/この分類の通知はありません/);
 assert.equal(h.saved().value.selection.kind,'all');
 await choose(h,'all');await choose(h,'rating');
 assert.equal(attempts,2,'失敗した空ページをcompleteなキャッシュとして使わない');
 assert.equal(h.w.document.querySelectorAll('.minf-list article').length,20);
 assert.equal(h.saved().value.selection.kind,'rating');
 assert.equal(h.saved().value.rows.length,20);
});

for(const previousEmpty of [false,true])test(`分類の取得失敗後に定期確認しても、待機中は読込表示を維持して通知なしと誤表示しない（前回0件=${previousEmpty}）`,async t=>{
 const pending=deferred();let attempts=0;
 const saved=previousEmpty?{selection:{kind:'rating',handlingStatus:'all',selectedDay:'',page:1},rows:[],total:0,statusCounts:{all:0,pending:0,completed:0},categoryCounts:{all:0,rating:0},updatedAt:'',syncAt:'',serverSync:{received:0,confirmed:0,source:''}}:undefined;
 const h=await fixture(t,{saved,selected:()=>++attempts===1?timeout():pending.promise});
 if(!previousEmpty)await choose(h,'rating');assert.match(h.text(),/通知履歴の読込に失敗/);
 const refresh=h.timers.findLast(timer=>timer.active&&timer.ms===120000);
 assert.ok(refresh);await settle(refresh.fn);
 assert.match(h.text(),/通知を読み込み中/);
 assert.doesNotMatch(h.text(),/この分類の通知はありません/);
 assert.equal(h.w.document.querySelector('.minf-error'),null);
 assert.equal(h.feeds().at(-1).kind,'rating');
 await settle(()=>pending.resolve(response(ratingRows)));
 assert.equal(h.w.document.querySelectorAll('.minf-list article').length,20);
 assert.doesNotMatch(h.text(),/通知を読み込み中|この分類の通知はありません/);
 assert.equal(h.feeds().length,previousEmpty?2:3);
});

test('同じ分類・日付・対応状況・ページの前回表示は失敗時も保持し、その条件で再試行する',async t=>{
 const selection={kind:'rating',handlingStatus:'pending',selectedDay:'2026-10-19',page:2};
 const saved={selection,rows:ratingRows.map(r=>({...r,raw_text:'前回保存した高評価'})),total:120,statusCounts:{all:120,pending:120,completed:0},categoryCounts:{all:309,rating:120},updatedAt:'2026-10-19T12:00:00Z',syncAt:'2026-10-19T12:00:00Z',serverSync:{received:20,confirmed:20,source:'test'}};
 let attempts=0;const h=await fixture(t,{saved,selected:()=>++attempts===1?timeout():response(ratingRows,120)});
 assert.equal(h.w.document.querySelectorAll('.minf-list article').length,20);
 assert.match(h.text(),/前回保存した高評価/);assert.match(h.text(),/前回表示分・最新確認に失敗/);
 assert.doesNotMatch(h.text(),/この分類の通知はありません/);
 await h.click(h.retry());await settle();
 assert.equal(h.w.document.querySelectorAll('.minf-list article').length,20);
 assert.doesNotMatch(h.text(),/前回保存した高評価|前回表示分/);
 assert.equal(h.feeds().length,2);
 for(const body of h.feeds())assert.deepEqual([body.kind,body.day,body.handlingStatus,body.page,body.pageSize,body.includeCategoryPreview],['rating','2026-10-19','pending',2,100,false]);
 assert.equal(h.calls.some(body=>body.action==='recent'),false);
});

test('旧版の件数あり・本文0件の保存表示は復元せず、古い全209件も表示せず、失敗後に再試行できる',async t=>{
 const saved={selection:{kind:'points',handlingStatus:'all',selectedDay:'',page:1},rows:[],total:20,statusCounts:{all:209,pending:209,completed:0},categoryCounts:{all:209,points:20},updatedAt:'',syncAt:'',serverSync:{received:0,confirmed:0,source:''}};
 const pending=deferred(),retry=deferred();let attempts=0;
 const h=await fixture(t,{saved,all:()=>++attempts===1?pending.promise:retry.promise});
 assert.match(h.text(),/通知を読み込み中/);
 assert.doesNotMatch(h.text(),/この分類の通知はありません|前回表示分/);
 assert.doesNotMatch(h.w.document.querySelector('.minf-handling-tabs').textContent,/209/);
 await settle(()=>pending.resolve(timeout()));
 assert.match(h.text(),/通知履歴の読込に失敗/);
 assert.doesNotMatch(h.text(),/この分類の通知はありません|前回表示分/);
 assert.doesNotMatch(h.w.document.querySelector('.minf-handling-tabs').textContent,/209/);
 assert.equal(h.retry().disabled,false);
 await h.click(h.retry());await settle();
 assert.match(h.text(),/通知を読み込み中/);
 assert.doesNotMatch(h.text(),/この分類の通知はありません/);
 await settle(()=>retry.resolve(response(ratingRows)));
 assert.equal(h.w.document.querySelectorAll('.minf-list article').length,20);
 assert.equal(h.w.document.querySelector('.minf-handling-tabs button small').textContent,'20');
 assert.equal(h.saved().value.rows.length,20);
 assert.equal(h.w.document.querySelector('.minf-error'),null);
 assert.deepEqual(h.feeds().map(body=>[body.kind,body.page,body.pageSize,body.includeCategoryPreview]),[['all',1,100,false],['all',1,100,false]]);
});
