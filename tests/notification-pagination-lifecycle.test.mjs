import test from 'node:test';
import assert from 'node:assert/strict';
import * as React from 'react';
import {sceneFixture,pause} from './react-scene-fixture.mjs';

const tokenKey='mumei-insight-access-token';
const classifier='action-v28-context:evidence-v2-articles';
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r});return{promise,resolve}};
const record=(id,kind='my_article_magazine_added',extra={})=>({id:String(id),notification_type:kind,display_category:kind,actor_name:'人物 '+id,actor_url:'https://note.com/peer',actor_image_url:'https://images.test/peer.png',raw_text:'保存された通知 '+id,captured_at:new Date(Date.parse('2026-10-14T00:00:00Z')-Number(id.replace(/\D/g,''))*1000).toISOString(),confirmed:false,...extra});
async function settle(work=()=>{}){await React.act(async()=>{work();for(let i=0;i<5;i++)await pause()})}
async function select(h,selector,value){await settle(()=>{const el=h.w.document.querySelector(selector);assert.ok(el,selector);el.value=String(value);el.dispatchEvent(new h.w.Event('change',{bubbles:true}))})}
async function fixture(t,{recent=async()=>[],holdPage=null}={}){
 const calls=[],records=Array.from({length:201},(_,i)=>record('article-'+i)).concat(Array.from({length:201},(_,i)=>record('board-'+i,'membership_board_reply',{confirmed:i%2===0})));
 const h=await sceneFixture(t,{globals:{URLSearchParams},dependencies:{
  './creator-avatar':{CreatorAvatar:()=>React.createElement('span'),creatorNoteId:()=>''},
  './insight-account-store':{INSIGHT_TOKEN_KEY:tokenKey,currentStoredInsightAccount:()=>({noteId:'tester'})},
 },fetch:async(url,init)=>{
  if(String(url).includes('creator-icons'))return Response.json({items:[]});
  const body=JSON.parse(init.body);calls.push(body);
  if(body.action==='recent')return Response.json({ok:true,noteId:'tester',rows:await recent(body),watermark:'2026-10-14T00:00:00Z'});
  let rows=records.filter(r=>(!body.kind||body.kind==='all'||r.display_category===body.kind)&&(body.handlingStatus==='completed'?r.confirmed:body.handlingStatus==='pending'?!r.confirmed:true));
  if(body.day)rows=rows.filter(r=>new Date(r.captured_at).toLocaleDateString('sv-SE',{timeZone:'Asia/Tokyo'})===body.day);
  if(holdPage)await holdPage(body);
  const categoryCounts={all:rows.length,...Object.fromEntries(['my_article_magazine_added','membership_board_reply'].map(kind=>[kind,rows.filter(r=>r.display_category===kind).length]))};
  return Response.json({ok:true,noteId:'tester',rows:rows.slice((body.page-1)*body.pageSize,body.page*body.pageSize),total:rows.length,categoryCounts,statusCounts:{all:rows.length,pending:rows.filter(r=>!r.confirmed).length,completed:rows.filter(r=>r.confirmed).length}});
 }});
 h.w.localStorage.setItem(tokenKey,'fixture');h.w.localStorage.setItem('mumei-notification-reclassify-version:tester',classifier);
 const Component=h.load('src/member-insight-notifications-final.tsx').MemberInsightNotificationsFinal;
 const start=props=>h.render(Component,{noteId:'tester',...props});await start();await settle();
 return{...h,Component,start,calls,ids:()=>[...h.w.document.querySelectorAll('.minf-list article')].map(el=>el.querySelector('.minf-actor')?.textContent),page:()=>h.w.document.querySelector('.minf-pager select')?.value};
}

test('遅い1ページ目の新着取得が、移動後の2ページ目の通知を上書きしない',async t=>{
 const wait=deferred();const h=await fixture(t,{recent:()=>wait.promise});
 await select(h,'.minf-filter-panel select','my_article_magazine_added');
 await settle(()=>h.w.dispatchEvent(new h.w.Event('focus')));assert.ok(h.calls.some(call=>call.action==='recent'),'the slow recent request actually started before paging');
 await select(h,'.minf-pager select',2);assert.equal(h.page(),'2');const before=h.ids();
 await settle(()=>wait.resolve([record('new-arrival','my_article_magazine_added',{captured_at:'2026-10-14T12:00:00Z'})]));
 assert.equal(h.page(),'2');assert.deepEqual(h.ids(),before,'page 2 retains its selected 100 rows after an earlier recent response');
});

test('公開データのrevision更新でも、選択中の通知カテゴリと2ページ目を維持する',async t=>{
 const h=await fixture(t);await select(h,'.minf-filter-panel select','membership_board_reply');await select(h,'.minf-pager select',2);
 const before=h.ids();assert.equal(h.page(),'2');await h.start({revision:1});await settle();
 assert.equal(h.w.document.querySelector('.minf-filter-panel select').value,'membership_board_reply');
 assert.equal(h.page(),'2','background revision revalidates the current page');assert.deepEqual(h.ids(),before);
 assert.equal(h.calls.filter(call=>call.page).at(-1).page,2);
});

test('カテゴリと対応状況を変えたら1ページ目へ戻り、古いページ応答は表示しない',async t=>{
 const wait=deferred();let hold=false;const h=await fixture(t,{holdPage:body=>hold&&body.page===2?wait.promise:undefined});
 hold=true;await select(h,'.minf-pager select',2);
 await select(h,'.minf-filter-panel select','membership_board_reply');
 await settle(()=>wait.resolve());assert.equal(h.page(),'1');assert.ok([...h.w.document.querySelectorAll('.minf-list article')].every(el=>el.classList.contains('type-membership_board_reply')));
 await select(h,'.minf-pager select',2);
 const pending=[...h.w.document.querySelectorAll('.minf-handling-tabs button')].find(button=>button.textContent.startsWith('未対応'));
 await h.click(pending);await settle();assert.ok([undefined,'1'].includes(h.page()),'100 pending rows stay on page 1');
 assert.equal(h.calls.filter(call=>call.page).at(-1).page,1);assert.equal(h.calls.filter(call=>call.page).at(-1).handlingStatus,'pending');
});

test('2ページ目から日付を変えたら1ページ目を取得し、前の一覧を混ぜない',async t=>{
 const h=await fixture(t);await select(h,'.minf-filter-panel select','membership_board_reply');await select(h,'.minf-pager select',2);
 await h.change(h.w.document.querySelector('.minf-filter-panel input[type="date"]'),'2026-10-13');await settle();
 const last=h.calls.filter(call=>call.page).at(-1);assert.equal(last.day,'2026-10-13');assert.equal(last.page,1);
 assert.ok([undefined,'1'].includes(h.page()));assert.equal(h.ids().length,0);assert.match(h.w.document.querySelector('.minf-empty').textContent,/2026\/10\/13/);
});
