import test from 'node:test';
import assert from 'node:assert/strict';
import * as React from 'react';
import {sceneFixture,pause} from './react-scene-fixture.mjs';

const tokenKey='mumei-insight-access-token';
const row=(body='保存済みの実返信')=>({id:'7',notification_type:'membership_board_reply',display_category:'membership_board_reply',raw_text:'相手から返信が届きました',actor_name:'相手',captured_at:'2026-10-16T12:00:00Z',confirmed:false,favorite:false,meta:{reply_body:body}});
async function settle(work=()=>{}){await React.act(async()=>{work();for(let i=0;i<8;i++)await pause()})}

async function fixture(t,{saved=row(),incoming=saved,latest=incoming}={}){
 const calls=[];let deliver;
 const held=new Promise(resolve=>{deliver=resolve});
 const full=rows=>Response.json({ok:true,noteId:'tester',rows,total:rows.length,categoryCounts:{all:rows.length,membership_board_reply:rows.length}});
 const h=await sceneFixture(t,{globals:{URLSearchParams},dependencies:{'./creator-avatar':{CreatorAvatar:()=>React.createElement('span'),creatorNoteId:()=>''},'./insight-account-store':{INSIGHT_TOKEN_KEY:tokenKey,currentStoredInsightAccount:()=>({noteId:'tester'})}},fetch:async(url,init)=>{
  if(String(url).includes('creator-icons'))return Response.json({items:[]});
  const request=JSON.parse(init.body);calls.push(request);
  if(request.action==='recent')return Response.json({ok:true,noteId:'tester',rows:[incoming],watermark:incoming.captured_at});
  if(calls.filter(r=>!r.action).length===1)return held;
  return full([latest]);
 }});
 h.w.localStorage.setItem(tokenKey,'test-token');
 h.w.localStorage.setItem('mumei-notification-board:tester',JSON.stringify([saved]));
 h.w.localStorage.setItem('mumei-notification-board-meta:tester',JSON.stringify({serverCheckedAt:1}));
 h.w.localStorage.setItem('mumei-notification-reclassify-version:tester','action-v28-context:evidence-v2-articles');
 t.after(()=>deliver(full([saved])));
 const Component=h.load('src/member-insight-notifications-final.tsx').MemberInsightNotificationsFinal;
 await h.render(Component,{noteId:'tester'});await settle();
 return{...h,calls,feeds:()=>calls.filter(r=>!r.action),deliver:()=>deliver(full([saved]))};
}

test('再起動後の新着確認が保存済み通知と同じなら、進行中の一覧を中止して取り直さない',async t=>{
 const h=await fixture(t);
 assert.equal(h.feeds().length,1,'unchanged recent results must not start a second full-page request');
 assert.equal(h.calls.filter(r=>r.action==='recent').length,1);
 await settle(h.deliver);
 assert.equal(h.feeds().length,1);
 assert.match(h.w.document.querySelector('.minf-comment-context').textContent,/保存済みの実返信/);
});

test('初回新着で同じ通知の実返信が更新された場合は、古い一覧応答から本文を戻さない',async t=>{
 const h=await fixture(t,{incoming:row('更新された実返信')});
 assert.equal(h.feeds().length,1,'share the pending full-page request before deciding whether repair is required');
 assert.match(h.w.document.querySelector('.minf-comment-context').textContent,/更新された実返信/);
 await settle(h.deliver);
 assert.equal(h.feeds().length,2,'an unreflected response requires exactly one follow-up after completion');
 const body=h.w.document.querySelector('.minf-comment-context').textContent;
 assert.match(body,/更新された実返信/);assert.doesNotMatch(body,/保存済みの実返信/);
});

test('本文が同じでも投稿者を新着で補修したら、遅い一覧の旧投稿者へ戻さない',async t=>{
 const saved={...row(),meta:{...row().meta,comment_author:'旧投稿者'}},incoming={...saved,meta:{...saved.meta,comment_author:'新投稿者'}};
 const h=await fixture(t,{saved,incoming});
 assert.equal(h.feeds().length,1,'keep the original full-page flight while showing the newer author');
 assert.match(h.w.document.querySelector('.minf-comment-context').textContent,/新投稿者/);
 await settle(h.deliver);
 assert.equal(h.feeds().length,2,'repair an old-author response once after it completes');
 const body=h.w.document.querySelector('.minf-comment-context').textContent;
 assert.match(body,/保存済みの実返信/);assert.match(body,/新投稿者/);assert.doesNotMatch(body,/旧投稿者/);
});
