import test from 'node:test';
import assert from 'node:assert/strict';
import * as React from 'react';
import {sceneFixture,pause} from './react-scene-fixture.mjs';

const tokenKey='fixture-token',scope={account:'tester',token:'token-a'};
const row=name=>({person_key:'person',actor_name:name,actor_url:'https://note.com/peer',relation:'mutual'});
const comparison={action:'comparison',window:'latest',relationship:'mutual',query:'',page:2,pageSize:50};
async function settle(work=()=>{}){await React.act(async()=>{work();await new Promise(r=>setTimeout(r,5));for(let i=0;i<3;i++)await pause()})}
async function fixture(t,query=comparison){
 const calls=[];let deliver;
 const fetch=async(_url,init)=>{calls.push({body:JSON.parse(init.body),token:init.headers['X-Insight-Token']});return new Promise(resolve=>{deliver=value=>resolve(Response.json(value))})};
 const h=await sceneFixture(t,{fetch,dependencies:{
  './insight-view-lifecycle':{fetchInsightResource:fetch,isFreshInsightView:()=>false},
  './creator-avatar':{CreatorAvatar:()=>React.createElement('span')},
  './insight-account-store':{INSIGHT_TOKEN_KEY:tokenKey,readStoredInsightAccounts:()=>[{noteId:'tester',memberToken:'token-a'},{noteId:'other',memberToken:'token-b'}]},
  './insight-member-db-fallback':{memberReadAuthFailure:()=>true,memberDbReadFallback:async()=>{throw new Error('offline')}},
 }});
 Object.defineProperty(h.w.document,'visibilityState',{value:'visible',writable:true});h.w.localStorage.setItem(tokenKey,'token-a');
 const saved=h.load('src/insight-saved-view.ts');saved.writeSavedInsightView('social-last',scope,{query,payload:{ok:true,noteId:'tester',rows:[row('前回の人物')],total:150}},Date.now()-600000);
 const Component=h.load('src/member-insight-social-v2.tsx').MemberInsightSocialV2;await h.render(Component,{});await settle();
 return{...h,Component,calls,deliver:value=>deliver(value),pending:()=>deliver,body:()=>h.w.document.querySelector('.mis2-social-root').textContent};
}

test('前回の条件とページを先に表示し、50件の最新確認を1回行う',async t=>{
 const h=await fixture(t);assert.match(h.body(),/前回の人物/);assert.match(h.body(),/前回表示分・最新確認中/);assert.equal(h.calls.length,1);assert.deepEqual(h.calls[0].body,comparison);
 assert.equal(h.w.document.querySelector('.mis2-relationship-filter select').value,'mutual');assert.match(h.body(),/2 \/ 3/);
 await settle(()=>h.deliver({ok:true,noteId:'tester',rows:[row('最新の人物')],total:150}));
 assert.match(h.body(),/最新の人物/);assert.doesNotMatch(h.body(),/前回の人物|前回表示分/);
});

test('個別履歴の前回ページを復元し、先頭へ戻して取得し直さない',async t=>{
 const query={action:'people',window:'oldest',query:'',page:3,pageSize:50,direction:'followings'};
 const h=await fixture(t,query);assert.match(h.body(),/前回の人物/);assert.match(h.body(),/前回表示分・最新確認中/);assert.equal(h.calls.length,1);assert.deepEqual(h.calls[0].body,query);
 assert.equal(h.w.document.querySelector('.mis2-pager select').value,'3');
});

test('tokenを切り替えると保存表示を消し、前tokenの遅い応答を表示しない',async t=>{
 const h=await fixture(t),old=h.pending();h.w.localStorage.setItem(tokenKey,'token-b');await h.render(h.Component,{});await settle();assert.doesNotMatch(h.body(),/前回の人物/);
 await settle(()=>old({ok:true,noteId:'tester',rows:[row('旧tokenの応答')],total:1}));assert.doesNotMatch(h.body(),/旧tokenの応答/);
 await settle(()=>h.deliver({ok:true,noteId:'other',rows:[],total:0}));
});
