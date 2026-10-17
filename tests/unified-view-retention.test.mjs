import test from 'node:test';
import assert from 'node:assert/strict';
import * as React from 'react';
import {sceneFixture,pause} from './react-scene-fixture.mjs';

const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve}};
const summary=(id='tester')=>({member:{noteId:id,displayName:id,imageUrl:null},summary:{},analysis:{},counts:{comments:0,followers:0,followings:0,notifications:0},articles:[]});
const row=(name,page=1)=>({article_key:'article'+page,root_key:'root'+page,comment_key:'comment'+page,liker_key:'person'+page,actor_key:'person'+page,actor_name:name,article_title:name,like_count:1,initial_comment_count:1,article_count:1,confirmed:true});
async function fixture(t,{tab='likes',respond,realMagazines=false}={}){
 let now=Date.now(),h;
 class Clock extends Date{static now(){return now}}
 const calls=[],account=()=>h.w.localStorage.getItem('token')==='b'?'second':'tester';
 h=await sceneFixture(t,{globals:{Date:Clock,requestAnimationFrame:()=>{}},dependencies:{
  './insight-account-store':{INSIGHT_TOKEN_KEY:'token',currentStoredInsightAccount:()=>({noteId:account(),memberToken:'fixture'}),setAccessIntent:()=>{}},
  './creator-avatar':{CreatorAvatar:()=>null,creatorImage:()=>null,creatorNoteId:person=>person?.urlname||''},
  './member-insight-dm':{MemberInsightDm:()=>null},...realMagazines?{}:{'./member-insight-magazines':{MemberInsightMagazines:()=>null}},
 },fetch:async(url,init)=>{
  const body=JSON.parse(init.body||'{}'),call={...body,url:String(url),token:init.headers['X-Insight-Token'],signal:init.signal};calls.push(call);
  const custom=respond?.(call,calls);if(custom)return custom;
  if(String(url).includes('/rest/'))return Response.json({ok:false},{status:503});
  if(body.action==='summary')return Response.json(summary(account()));
  if(body.action==='analysis')return Response.json({ok:true,latestDashboard:{likes:7,comments:2}});
  if(body.action==='sync')return Response.json({ok:true});
  return Response.json({rows:[row(`${account()}ページ${body.page||1}`,body.page||1)],total:250});
 }});
 h.w.localStorage.setItem('token','a');h.w.history.replaceState({insightTab:tab},'',h.w.location.href);
 const C=h.load('src/member-insight-unified-v4.tsx').MemberInsightUnifiedV4;
 return{...h,C,calls,advance:ms=>now+=ms,count:action=>calls.filter(c=>c.action===action).length,show:props=>h.render(C,{active:true,revision:0,...props})};
}

test('a previous-launch summary is not current even if saved recently',async t=>{
 const next=deferred();const h=await fixture(t,{respond:call=>call.action==='summary'?next.promise:undefined});
 h.w.localStorage.setItem('mumei-insight-summary-cache-v1:tester',JSON.stringify({cachedAt:Date.now()-1000,data:{...summary(),member:{...summary().member,displayName:'古い保存本人'}}}));
 await h.show();assert.equal(h.count('summary'),1);assert.doesNotMatch(h.w.document.body.textContent,/古い保存本人/);
 await React.act(async()=>{next.resolve(Response.json(summary()));await pause()});assert.match(h.w.document.body.textContent,/MY NOTE INSIGHT/);
});

test('fresh return retains the selected like filter and page without requesting summary, analysis or likes',async t=>{
 const h=await fixture(t);await h.show();
 await h.click([...h.w.document.querySelectorAll('.miu-tabs button')].find(b=>b.textContent==='対応済み'));
 await h.click(h.w.document.querySelector('.miu-pager button:last-child'));
 const count=h.calls.length;assert.match(h.w.document.querySelector('.miu-pager').textContent,/2 \/ 3/);
 await h.show({active:false});await h.show();
 assert.equal(h.calls.length,count);assert.match(h.w.document.querySelector('.miu-card-grid').textContent,/testerページ2/);
 assert.match(h.w.document.querySelector('.miu-tabs button.active').textContent,/対応済み/);assert.match(h.w.document.querySelector('.miu-pager').textContent,/2 \/ 3/);
});

test('verified empty like history is retained; an empty API object is not a verified result',async t=>{
 let malformed=false;const h=await fixture(t,{respond:call=>call.action==='likes'?Response.json(malformed?{}:{rows:[],total:0}):undefined});
 await h.show();await h.show({active:false});await h.show();assert.equal(h.count('likes'),1);
 malformed=true;await h.show({revision:1});const afterFailure=h.count('likes');await h.show({active:false,revision:1});await h.show({revision:1});
 assert.equal(h.count('likes'),afterFailure+1);assert.match(h.w.document.body.textContent,/最新確認に失敗/);
});

test('TTL expiry checks latest in the background while keeping the loaded like page',async t=>{
 let stale=false;const next=deferred();const h=await fixture(t,{respond:call=>stale&&call.action==='likes'?next.promise:undefined});await h.show();
 await h.click(h.w.document.querySelector('.miu-pager button:last-child'));await h.show({active:false});h.advance(60_001);stale=true;await h.show();
 assert.equal(h.count('summary'),2);assert.equal(h.count('analysis'),0);assert.equal(h.count('likes'),3);
 assert.match(h.w.document.querySelector('.miu-card-grid').textContent,/testerページ2/);assert.match(h.w.document.querySelector('.miu-pager').textContent,/2 \/ 3/);
 await React.act(async()=>{next.resolve(Response.json({rows:[row('新しいページ2',2)],total:250}));await pause()});assert.match(h.w.document.body.textContent,/新しいページ2/);
});

test('a revision received while hidden checks latest on return and preserves the page',async t=>{
 const h=await fixture(t);await h.show();await h.click(h.w.document.querySelector('.miu-pager button:last-child'));
 await h.show({active:false});const count=h.calls.length;await h.show({active:false,revision:1});assert.equal(h.calls.length,count);await h.show({revision:1});
 assert.equal(h.count('summary'),2);assert.equal(h.count('analysis'),0);assert.equal(h.calls.filter(c=>c.action==='likes').at(-1).page,2);
 assert.match(h.w.document.querySelector('.miu-pager').textContent,/2 \/ 3/);
});

test('explicit data update bypasses fresh summary retention without loading unseen analysis',async t=>{
 const h=await fixture(t);await h.show();await h.click(h.w.document.querySelector('.miu-topactions button.sync'));
 assert.equal(h.count('sync'),1);assert.equal(h.count('summary'),2);assert.equal(h.count('analysis'),0);
 assert.equal(h.count('likes'),2,'explicit update also checks the active saved history');
});

test('switching the token and account cannot retain the prior account rows or metrics',async t=>{
 let switched=false;const latest=deferred();const h=await fixture(t,{respond:call=>switched&&call.action==='likes'?latest.promise:undefined});await h.show();
 await h.show({active:false});h.w.localStorage.setItem('token','b');switched=true;await h.show();
 assert.equal(h.count('summary'),2);assert.equal(h.count('analysis'),0);assert.equal(h.count('likes'),2);assert.equal(h.calls.filter(c=>c.action==='likes').at(-1).token,'b');
 assert.doesNotMatch(h.w.document.body.textContent,/testerページ1/);
 await React.act(async()=>{latest.resolve(Response.json({rows:[row('second最新')],total:1}));await pause()});assert.match(h.w.document.body.textContent,/second最新/);
});

test('a new token for the same account still checks all current data',async t=>{
 const h=await fixture(t);await h.show();await h.show({active:false});h.w.localStorage.setItem('token','c');await h.show();
 assert.equal(h.count('summary'),2);assert.equal(h.count('analysis'),0);assert.equal(h.count('likes'),2);assert.equal(h.calls.filter(c=>c.action==='likes').at(-1).token,'c');
});

test('an account switch followed by a failed summary cannot restore the former account',async t=>{
 const h=await fixture(t,{respond:call=>call.action==='summary'&&call.token==='b'?Response.json({ok:false,error:'offline'},{status:503}):undefined});await h.show();
 await h.show({active:false});h.w.localStorage.setItem('token','b');await h.show();
 assert.match(h.w.document.querySelector('.miu-top').textContent,/second/);assert.doesNotMatch(h.w.document.body.textContent,/testerページ/);assert.match(h.w.document.body.textContent,/最新確認に失敗/);
});

for(const [tab,action]of[['supporters','supporters'],['commentRanking','comment_ranking']])test(`${tab} keeps its page and expanded details on a fresh return`,async t=>{
 const h=await fixture(t,{tab});await h.show();await h.click(h.w.document.querySelector('.miu-pager button:last-child'));
 await h.click(h.w.document.querySelector(tab==='commentRanking'?'.miu-rank-metrics button':'.miu-rank-list article button:last-child'));const count=h.calls.length;assert.ok(h.w.document.querySelector('.miu-expand'));
 await h.show({active:false});await h.show();assert.equal(h.calls.length,count);assert.equal(h.count(action),2);assert.ok(h.w.document.querySelector('.miu-expand'));assert.match(h.w.document.querySelector('.miu-pager').textContent,/2 \/ 3/);
 await h.show({revision:1});assert.equal(h.count(action),3);
});

test('magazine history requests are retained across fresh returns and renewed for revisions and TTL',async t=>{
 const h=await fixture(t,{tab:'magazines',realMagazines:true,respond:call=>call.action==='magazines'?Response.json({rows:[],total:0}):undefined});await h.show();assert.equal(h.count('magazines'),1);
 await h.show({active:false});await h.show();assert.equal(h.count('magazines'),1);
 await h.show({revision:1});assert.equal(h.count('magazines'),2);await h.show({active:false,revision:1});h.advance(60_001);await h.show({revision:1});assert.equal(h.count('magazines'),3);
});

test('leaving an unfinished like request does not mark it verified or accept its late response',async t=>{
 const old=deferred();const h=await fixture(t,{respond:(call,calls)=>call.action==='likes'&&calls.filter(c=>c.action==='likes').length===1?old.promise:undefined});await h.show();
 const first=h.calls.find(c=>c.action==='likes');await h.show({active:false});assert.equal(first.signal.aborted,true);await h.show();assert.equal(h.count('likes'),2);
 await React.act(async()=>{old.resolve(Response.json({rows:[row('破棄される古い応答')],total:1}));await pause()});assert.doesNotMatch(h.w.document.body.textContent,/破棄される/);assert.match(h.w.document.body.textContent,/testerページ1/);
});

test('malformed summary JSON and empty objects are not written as successful summaries',async t=>{
 let malformed=true;const h=await fixture(t,{respond:call=>call.action==='summary'&&malformed?new Response('{broken',{headers:{'content-type':'application/json'}}):undefined});await h.show();
 assert.equal(h.w.localStorage.getItem('mumei-insight-summary-cache-v1:tester'),null);
 await h.show({active:false});malformed=false;await h.show();assert.equal(h.count('summary'),2);assert.equal(h.count('analysis'),0);
 assert.equal(JSON.parse(h.w.localStorage.getItem('mumei-insight-summary-cache-v1:tester')).data.member.noteId,'tester');
});
