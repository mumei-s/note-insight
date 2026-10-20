import test from 'node:test';
import assert from 'node:assert/strict';
import * as React from 'react';
import {sceneFixture,pause} from './react-scene-fixture.mjs';

const deferred=()=>{let resolve;const promise=new Promise(yes=>{resolve=yes});return{promise,resolve}};
const cases=[['likes','likes'],['supporters','supporters'],['commentRanking','comment_ranking']];
const summary=account=>({ok:true,member:{noteId:account,displayName:account,imageUrl:null},summary:{identifiedLikeCount:201},analysis:{},counts:{comments:201,followers:0,followings:0,notifications:0},articles:[]});
const pageRows=(action,page,label,total=201)=>Array.from({length:Math.min(100,Math.max(0,total-(page-1)*100))},(_,index)=>{
 const key=String((page-1)*100+index);
 return{article_key:'article-'+key,liker_key:'person-'+key,actor_key:'person-'+key,actor_name:`${label} ${action} ${key}`,article_title:'保存記事 '+key,like_count:5,initial_comment_count:4,article_count:3,confirmed:false,liked_at:'2026-10-18T01:00:00Z',last_comment_at:'2026-10-18T01:00:00Z'};
});
async function settle(fn=()=>{}){await React.act(async()=>{fn();for(let i=0;i<4;i++)await pause()})}

async function documentFixture(t,{tab='likes',stored=[],token='session-a',account='tester',now=Date.now(),respond,label='初回の本人',total=201}={}){
 let h;const calls=[];class Clock extends Date{static now(){return now}}
 h=await sceneFixture(t,{globals:{Date:Clock,requestAnimationFrame:()=>{}},dependencies:{
  './insight-account-store':{INSIGHT_TOKEN_KEY:'fixture-token',currentStoredInsightAccount:()=>({noteId:account,displayName:account,memberToken:h.w.localStorage.getItem('fixture-token'),status:'active'}),setAccessIntent:()=>{}},
  './creator-avatar':{CreatorAvatar:()=>null,creatorImage:()=>null},
  './member-insight-dm':{MemberInsightDm:()=>null},'./member-insight-magazines':{MemberInsightMagazines:()=>null},
 },fetch:async(url,init)=>{
  const body=JSON.parse(init.body||'{}'),call={...body,url:String(url),token:init.headers['X-Insight-Token'],signal:init.signal};calls.push(call);
  const answer=respond?.(call);if(answer)return answer;
  if(call.url.includes('/rest/'))return Response.json({ok:false,error:'fallback unavailable'},{status:503});
  if(body.action==='summary')return Response.json(summary(account));
  return Response.json({ok:true,rows:pageRows(body.action,Number(body.page)||1,label,total),total});
 }});
 for(const[key,value]of stored)h.w.localStorage.setItem(key,value);
 h.w.localStorage.setItem('fixture-token',token);h.w.history.replaceState({insightTab:tab},'',h.w.location.href);
 const Component=h.load('src/member-insight-unified-v4.tsx').MemberInsightUnifiedV4;
 // Close the first document for real, while allowing the fixture's after hook
 // to call cleanup again without touching a root that belongs to the next page.
 let unmounted=false,closed=false;const unmount=h.root.unmount.bind(h.root),close=h.w.close.bind(h.w);
 h.root.unmount=()=>{if(!unmounted){unmounted=true;unmount()}};h.w.close=()=>{if(!closed){closed=true;close()}};
 return{...h,calls,show:()=>h.render(Component,{active:true,revision:0}),text:()=>h.w.document.body.textContent,
  storage:()=>Array.from({length:h.w.localStorage.length},(_,i)=>{const key=h.w.localStorage.key(i);return[key,h.w.localStorage.getItem(key)]}),
  close:async()=>{await React.act(async()=>h.root.unmount());h.w.close()},
  panel:()=>h.w.document.querySelector('.miu-tab-stage > div:not([hidden])'),
 };
}

for(const[tab,action]of cases)test(`${action}: a fresh document ${action==='likes'?'starts at latest page 1':'restores the saved ranking page'}`,async t=>{
 const at=Date.now(),first=await documentFixture(t,{tab,now:at});await first.show();
 await first.click(first.panel().querySelector('.miu-pager button:last-child'));
 assert.match(first.panel().textContent,new RegExp(`初回の本人 ${action} 100`));
 assert.match(first.panel().querySelector('.miu-pager').textContent,/2 \/ 3/);
 const disk=first.storage();assert.ok(disk.some(([key])=>key.startsWith('mumei-insight-data-cache-v1:saved:')));
 await first.close();
 const current=deferred(),currentSummary=deferred();
 const second=await documentFixture(t,{tab,stored:disk,now:at+60_001,respond:call=>call.action===action?current.promise:call.action==='summary'?currentSummary.promise:undefined});
 assert.notEqual(second.w,first.w);await second.show();
 const entryPage=action==='likes'?1:2;
 if(action==='likes'){
  assert.doesNotMatch(second.panel().textContent,/初回の本人/);
  assert.equal(second.panel().querySelector('[data-insight-saved-view]'),null);
  assert.ok(second.panel().querySelector('.miu-load-scene'));
 }else{
  assert.match(second.panel().textContent,new RegExp(`初回の本人 ${action} 100`));
  assert.match(second.panel().querySelector('.miu-pager').textContent,/2 \/ 3/);
  assert.match(second.panel().textContent,/前回表示分.*最新を確認中/);
  assert.equal(second.panel().querySelector('.miu-load-scene'),null);
 }
 assert.deepEqual(second.calls.map(call=>call.action).sort(),[action,'summary'].sort());
 assert.equal(second.calls.find(call=>call.action===action).page,entryPage);assert.equal(second.calls.find(call=>call.action===action).pageSize,100);
 await settle(()=>{current.resolve(Response.json({ok:true,rows:pageRows(action,entryPage,'再起動後の確認結果'),total:201}));currentSummary.resolve(Response.json(summary('tester')))});
 assert.match(second.panel().textContent,new RegExp(`再起動後の確認結果 ${action} ${(entryPage-1)*100}`));assert.doesNotMatch(second.panel().textContent,/初回の本人/);
 assert.equal(second.panel().querySelector('[data-insight-saved-view]'),null);
});

for(const[tab,action]of cases.slice(1))test(`${action}: an empty verified ranking remains a saved zero after a new document opens`,async t=>{
 const at=Date.now(),first=await documentFixture(t,{tab,total:0,now:at});await first.show();
 assert.match(first.panel().querySelector('.miu-section-head').textContent,/0人/);const disk=first.storage();await first.close();
 const pending=deferred(),second=await documentFixture(t,{tab,stored:disk,total:0,now:at+60_001,respond:call=>call.action===action?pending.promise:undefined});await second.show();
 assert.equal(second.panel().querySelector('.miu-load-scene'),null);assert.match(second.panel().querySelector('.miu-section-head').textContent,/0人/);
 assert.match(second.panel().textContent,/前回表示分/);assert.equal(second.calls.filter(call=>call.action===action).length,1);
 await settle(()=>pending.resolve(Response.json({ok:true,rows:[],total:0})));assert.equal(second.panel().querySelector('[data-insight-saved-view]'),null);
});

for(const token of ['session-b',''])test(`cold ranking storage is not restored for ${token?'a changed credential':'logout'}`,async t=>{
 const at=Date.now(),first=await documentFixture(t,{tab:'commentRanking',now:at});await first.show();const disk=first.storage();await first.close();
 const pending=deferred(),second=await documentFixture(t,{tab:'commentRanking',stored:disk,token,now:at+60_001,respond:call=>call.action==='comment_ranking'?pending.promise:undefined});await second.show();
 assert.doesNotMatch(second.text(),/初回の本人/);assert.equal(second.w.document.querySelector('[data-insight-saved-view="comment_ranking"]'),null);
 if(token)await settle(()=>pending.resolve(Response.json({ok:true,rows:[],total:0})));
});

for(const[tab,action]of cases)test(`${action}: a late archive recovery fills the fresh document without restarting its current request`,async t=>{
 const at=Date.now(),first=await documentFixture(t,{tab,now:at});await first.show();const disk=first.storage();await first.close();
 const current=deferred(),currentSummary=deferred();
 const second=await documentFixture(t,{tab,now:at+60_001,respond:call=>call.action===action?current.promise:call.action==='summary'?currentSummary.promise:undefined});await second.show();
 assert.doesNotMatch(second.panel().textContent,/初回の本人/);assert.ok(second.panel().querySelector('.miu-load-scene'));
 const original=second.calls.find(call=>call.action===action),count=second.calls.length;
 await settle(()=>{for(const[key,value]of disk)second.w.localStorage.setItem(key,value);second.w.dispatchEvent(new second.w.Event('mumei-insight-storage-hydrated'))});
 assert.match(second.panel().textContent,new RegExp(`初回の本人 ${action} 0`));assert.match(second.panel().textContent,/前回表示分.*最新を確認中/);
 assert.equal(second.calls.length,count);assert.equal(original.signal.aborted,false,'archive recovery must not restart the current network request');
 await settle(()=>{current.resolve(Response.json({ok:true,rows:pageRows(action,1,'最新の現在ページ'),total:201}));currentSummary.resolve(Response.json(summary('tester')))});
 assert.match(second.panel().textContent,new RegExp(`最新の現在ページ ${action} 0`));assert.doesNotMatch(second.panel().textContent,/初回の本人/);
 assert.equal(second.panel().querySelector('[data-insight-saved-view]'),null);
});
