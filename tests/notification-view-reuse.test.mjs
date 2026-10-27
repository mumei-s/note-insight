import test from 'node:test';
import assert from 'node:assert/strict';
import * as React from 'react';
import {sceneFixture,pause} from './react-scene-fixture.mjs';
import './notification-stale-page-retention.test.mjs';
import './notification-page-repair-coalescing.test.mjs';

const key='mumei-insight-access-token';
const row=(id,type='tip',extra={})=>({id:String(id),notification_type:type,display_category:type,actor_name:'人物'+id,raw_text:'通知概要'+id,captured_at:new Date(Date.parse('2026-10-14T12:00:00Z')-id*1000).toISOString(),confirmed:false,...extra});
async function settle(work=()=>{}){await React.act(async()=>{work();for(let i=0;i<5;i++)await pause()})}
async function select(h,selector,value){await settle(()=>{const el=h.w.document.querySelector(selector);el.value=String(value);el.dispatchEvent(new h.w.Event('change',{bubbles:true}))})}
async function fixture(t,{override,recent=()=>[],icons=async()=>Response.json({items:[]})}={}){
 const calls=[],records=Array.from({length:220},(_,i)=>row(i,i%2?'tip':'purchase'));
 const h=await sceneFixture(t,{globals:{URLSearchParams},dependencies:{'./creator-avatar':{CreatorAvatar:()=>React.createElement('span'),creatorNoteId:()=>''},'./insight-account-store':{INSIGHT_TOKEN_KEY:key,currentStoredInsightAccount:()=>({noteId:'tester'})}},fetch:async(url,init)=>{
  if(String(url).includes('creator-icons'))return icons();
  const b=JSON.parse(init.body);calls.push(b);
  if(b.action==='recent')return Response.json({ok:true,noteId:'tester',rows:await recent()});
  const x=override?.(b);if(x)return x;
  const selected=records.filter(r=>b.kind==='all'||r.display_category===b.kind),counts={all:220,tip:110,purchase:110};
  return Response.json({ok:true,noteId:'tester',rows:selected.slice((b.page-1)*100,b.page*100),total:selected.length,categoryCounts:counts,categoryPreview:b.includeCategoryPreview?{tip:records.filter(r=>r.display_category==='tip').slice(0,12),purchase:records.filter(r=>r.display_category==='purchase').slice(0,12)}:{}});
 }});
 h.w.localStorage.setItem(key,'token-a');h.w.localStorage.setItem('mumei-notification-reclassify-version:tester','action-v28-context:evidence-v2-articles');
 const Component=h.load('src/member-insight-notifications-final.tsx').MemberInsightNotificationsFinal;
 const start=props=>h.render(Component,{noteId:'tester',...props});await start();await settle();
 return {...h,calls,Component,start,feeds:()=>calls.filter(b=>!b.action),ids:()=>[...h.w.document.querySelectorAll('.minf-list article')].map(el=>el.querySelector('.minf-actor').textContent)};
}

test('12件のカテゴリpreviewを100件の完了ページと誤認せず、確認済みカテゴリへ戻ると全件再取得しない',async t=>{
 const h=await fixture(t);assert.equal(h.feeds().length,1);
 await select(h,'.minf-filter-panel select','tip');assert.equal(h.feeds().length,2);assert.equal(h.ids().length,100);
 await select(h,'.minf-filter-panel select','all');assert.equal(h.feeds().length,2);assert.equal(h.ids().length,100);
 await select(h,'.minf-filter-panel select','tip');assert.equal(h.feeds().length,2);assert.equal(h.ids().length,100);
 assert.equal(h.w.document.querySelectorAll('.minf-pager').length,2,'page controls are above and below the long list');
});

test('本人通知を閉じて戻ってもカテゴリ・2ページ目・取得済み100件を即保持し、freshな全件を読み直さない',async t=>{
 const h=await fixture(t);await select(h,'.minf-filter-panel select','tip');await select(h,'.minf-pager select',2);const ids=h.ids(),count=h.feeds().length;
 await React.act(async()=>{h.root.render(null);await pause()});await h.start();await settle();
 assert.equal(h.w.document.querySelector('.minf-filter-panel select').value,'tip');assert.equal(h.w.document.querySelector('.minf-pager select').value,'2');
 assert.deepEqual(h.ids(),ids);assert.equal(h.feeds().length,count);assert.equal(h.w.document.querySelectorAll('.minf-list article').length,10);
});

test('不正な成功応答では確認済み本文を空にせず、最新確認失敗を表示する',async t=>{
 let invalid=false;const h=await fixture(t,{override:()=>invalid?Response.json({}):null});const ids=h.ids();invalid=true;
 await h.start({revision:1});await settle();assert.deepEqual(h.ids(),ids);assert.match(h.w.document.querySelector('.minf-error').textContent,/API_ERROR|不完全/);
 assert.equal(h.feeds().length,2);
});

test('明示revisionが変われば同じページを再確認し、token変更後のfresh cacheは使わない',async t=>{
 const h=await fixture(t);await select(h,'.minf-pager select',2);await h.start({revision:1});assert.equal(h.feeds().at(-1).page,2);
 const n=h.feeds().length;h.w.localStorage.setItem(key,'token-b');await h.start({revision:1});await settle();assert.ok(h.feeds().length>n);
});

test('件数が減り閲覧ページが範囲外になった時は、残る最後のページを読み直す',async t=>{
 let reduced=false;const h=await fixture(t,{override:b=>reduced?Response.json({ok:true,noteId:'tester',rows:b.page===1?Array.from({length:80},(_,i)=>row(i)):[],total:80,categoryCounts:{all:80}}):null});
 await select(h,'.minf-pager select',2);reduced=true;await h.start({revision:1});await settle();
 assert.equal(h.feeds().at(-1).page,1);assert.equal(h.ids().length,80);assert.equal(h.w.document.querySelector('.minf-empty'),null);
});

test('全件確認中の新着確認は後へ回し、全件完了後に新着を反映する',async t=>{
 let release,held=false;const wait=new Promise(resolve=>{release=resolve});
 const h=await fixture(t,{override:b=>held?wait:null});held=true;
 await h.start({revision:1});const before=h.calls.filter(b=>b.action==='recent').length;
 await settle(()=>h.w.dispatchEvent(new h.w.Event('focus')));assert.equal(h.calls.filter(b=>b.action==='recent').length,before);
 await settle(()=>release(Response.json({ok:true,noteId:'tester',rows:[row(50)],total:1,categoryCounts:{all:1}})));
 assert.equal(h.calls.filter(b=>b.action==='recent').length,before+1);assert.deepEqual(h.ids(),['人物50']);
});

test('100件から新着で101件になったら正しい件数を再確認し、落ちた古い1件へページ送りできる',async t=>{
 let added=false;const old=Array.from({length:100},(_,i)=>row(i)),incoming=row(500,'tip',{captured_at:'2026-10-14T15:00:00Z'});
 const h=await fixture(t,{recent:()=>added?[incoming]:[],override:b=>{const rows=added?[incoming,...old]:old;return Response.json({ok:true,noteId:'tester',rows:rows.slice((b.page-1)*100,b.page*100),total:rows.length,categoryCounts:{all:rows.length,tip:rows.length}})}});
 assert.equal(h.w.document.querySelector('.minf-pager'),null);added=true;await settle(()=>h.w.dispatchEvent(new h.w.Event('focus')));
 assert.equal(h.w.document.querySelector('.minf-pager select').options.length,2);await select(h,'.minf-pager select',2);assert.deepEqual(h.ids(),['人物99']);
});

test('別カテゴリの対応状態を保存待ちでも、キャッシュ切替へその行を混ぜない',async t=>{
 let acknowledge;const wait=new Promise(resolve=>{acknowledge=resolve});
 const h=await fixture(t,{override:b=>b.action==='completion'?wait:null});
 await select(h,'.minf-filter-panel select','purchase');await select(h,'.minf-filter-panel select','tip');
 await h.click(h.w.document.querySelector('.minf-completion button'));await select(h,'.minf-filter-panel select','purchase');
 assert.ok([...h.w.document.querySelectorAll('.minf-list article')].every(el=>el.classList.contains('type-purchase')));
 await settle(()=>acknowledge(Response.json({ok:true,completed:true})));
});

test('掲示板の通知文を返信本文へコピーせず、本文未取得と対象掲示板を表示する',async t=>{
 const board=row(1,'membership_board_reply',{raw_text:'相手さんがあなたのコメントに返信しました',target_url:'https://note.com/tester/membership/boards/123',meta:{body:'相手さんがあなたのコメントに返信しました'}});
 const h=await fixture(t,{override:b=>b.action==='comment_detail'?Response.json({ok:true,status:'missing_id',body:null}):Response.json({ok:true,noteId:'tester',rows:[board],total:1,categoryCounts:{all:1,membership_board_reply:1}})});
 const article=h.w.document.querySelector('.minf-list article'),details=article.querySelector('.minf-comment-context');assert.equal(article.dataset.commentContextNative,'true');assert.ok(details);
 await settle(()=>{details.open=true;details.dispatchEvent(new h.w.Event('toggle'))});
 assert.match(details.textContent,/取得・保存されていません/);assert.doesNotMatch(details.textContent,/相手さんがあなたのコメント/);assert.equal(details.querySelector('a').href,board.target_url);
});

test('保存済み掲示板返信の実本文は改行ごと表示し、通知文を混ぜず再取得しない',async t=>{
 const board=row(1,'membership_board_reply',{raw_text:'相手さんがあなたのコメントに返信しました',target_url:'https://note.com/tester/membership/boards/123',meta:{reply_body:'返信の実本文\n二行目',body:'通知概要'}});
 const h=await fixture(t,{override:()=>Response.json({ok:true,noteId:'tester',rows:[board],total:1,categoryCounts:{all:1}})}),details=h.w.document.querySelector('.minf-comment-context');
 await settle(()=>{details.open=true;details.dispatchEvent(new h.w.Event('toggle'))});assert.match(details.textContent,/返信の実本文\n二行目/);assert.doesNotMatch(details.textContent,/通知概要/);assert.equal(h.calls.filter(b=>b.action==='comment_detail').length,0);
});

test('開いている同じ通知の本文は、明示更新で確認した最新本文へ切り替わる',async t=>{
 let body='以前の返信';const h=await fixture(t,{override:()=>Response.json({ok:true,noteId:'tester',rows:[row(1,'membership_board_reply',{meta:{reply_body:body}})],total:1,categoryCounts:{all:1}})});
 const details=h.w.document.querySelector('.minf-comment-context');await settle(()=>{details.open=true;details.dispatchEvent(new h.w.Event('toggle'))});
 body='新しい返信';await h.start({revision:1});await settle();assert.equal(details.open,true);assert.match(details.textContent,/新しい返信/);assert.doesNotMatch(details.textContent,/以前の返信/);
});

test('遅いアイコン補完が、新着で更新した実本文をboard/cacheへ逆戻りさせない',async t=>{
 const waits=[];const before=row(1,'membership_board_reply',{actor_url:'https://note.com/peer',meta:{reply_body:'以前の返信'}}),after={...before,meta:{reply_body:'新しい返信'}};
 const h=await fixture(t,{override:()=>Response.json({ok:true,noteId:'tester',rows:[before],total:1,categoryCounts:{all:1}}),recent:()=>[after],icons:()=>new Promise(resolve=>waits.push(resolve))});
 await settle(()=>h.w.dispatchEvent(new h.w.Event('focus')));assert.ok(waits.length>=2);
 await settle(()=>waits[0](Response.json({items:[{noteId:'peer',image:'https://images.test/avatar.png'}]})));
 const stored=JSON.parse(h.w.localStorage.getItem('mumei-notification-board:tester'));assert.equal(stored[0].meta.reply_body,'新しい返信');
 await React.act(async()=>{h.root.render(null);await pause()});await h.start();await settle();assert.match(h.w.document.querySelector('.minf-comment-context').textContent,/新しい返信/);
 for(const resolve of waits.slice(1))resolve(Response.json({items:[]}));await settle();
});
