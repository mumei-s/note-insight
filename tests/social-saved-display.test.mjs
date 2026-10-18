import test from 'node:test';
import assert from 'node:assert/strict';
import * as React from 'react';
import {sceneFixture,pause} from './react-scene-fixture.mjs';

const tokenKey='fixture-token',scope={account:'tester',token:'token-a'};
const row=name=>({person_key:'person',actor_name:name,actor_url:'https://note.com/peer',relation:'mutual'});
const comparison={action:'comparison',window:'latest',relationship:'mutual',query:'',page:2,pageSize:50};
async function settle(work=()=>{}){await React.act(async()=>{work();await new Promise(r=>setTimeout(r,5));for(let i=0;i<3;i++)await pause()})}
async function fixture(t,query=comparison,{fallback=async()=>{throw new Error('offline')}}={}){
 const calls=[];let deliver;
 const fetch=async(_url,init)=>{calls.push({body:JSON.parse(init.body),token:init.headers['X-Insight-Token']});return new Promise(resolve=>{deliver=(value,status=200)=>resolve(Response.json(value,{status}))})};
 const h=await sceneFixture(t,{fetch,dependencies:{
  './insight-view-lifecycle':{fetchInsightResource:fetch,isFreshInsightView:()=>false},
  './creator-avatar':{CreatorAvatar:()=>React.createElement('span')},
  './insight-account-store':{INSIGHT_TOKEN_KEY:tokenKey,readStoredInsightAccounts:()=>[{noteId:'tester',memberToken:'token-a'},{noteId:'other',memberToken:'token-b'}]},
  './insight-member-db-fallback':{memberReadAuthFailure:message=>/INSIGHT_(SESSION_INVALID|LOGIN_REQUIRED|MEMBER_INACTIVE)|HTTP_40[13]/.test(message),memberDbReadFallback:fallback},
 }});
 Object.defineProperty(h.w.document,'visibilityState',{value:'visible',writable:true});h.w.localStorage.setItem(tokenKey,'token-a');
 const saved=h.load('src/insight-saved-view.ts');saved.writeSavedInsightView('social-last',scope,{query,payload:{ok:true,noteId:'tester',rows:[row('前回の人物')],total:150}},Date.now()-600000);
 const Component=h.load('src/member-insight-social-v2.tsx').MemberInsightSocialV2;await h.render(Component,{});await settle();
 return{...h,Component,calls,deliver:(value,status)=>deliver(value,status),pending:()=>deliver,body:()=>h.w.document.querySelector('.mis2-social-root,.mis2').textContent};
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

test('401と403は任意のエラー本文でも保存表示とコピーを破棄する',async t=>{
 for(const status of [401,403]){
  const h=await fixture(t);assert.match(h.body(),/前回の人物/);
  await settle(()=>h.deliver({ok:false,error:'アクセス拒否の応答'},status));
  assert.doesNotMatch(h.body(),/前回の人物|前回表示分/);assert.match(h.body(),/アクセスを確認できませんでした/);
  assert.equal(h.load('src/insight-saved-view.ts').readSavedInsightView('social-last',scope),null);
  const before=h.calls.length;await settle(()=>h.w.dispatchEvent(new h.w.Event('focus')));assert.equal(h.calls.length,before);
 }
});

test('並行した取得の認証拒否後は古い200応答でもコピーと人物を復活させない',async t=>{
 const h=await fixture(t),old=h.pending(),select=h.w.document.querySelector('.mis2-relationship-filter select');
 await React.act(async()=>{select.value='following_only';select.dispatchEvent(new h.w.Event('change',{bubbles:true}));await pause()});await settle();
 assert.equal(h.calls.length,2);await settle(()=>h.deliver({ok:false,error:'denied'},403));
 await settle(()=>old({ok:true,noteId:'tester',rows:[row('拒否後の古い応答')],total:1}));
 assert.doesNotMatch(h.body(),/前回の人物|拒否後の古い応答/);assert.equal(h.load('src/insight-saved-view.ts').readSavedInsightView('social-last',scope),null);
});

test('一時的な500では保存表示を残し、接続回復時に最新確認できる',async t=>{
 const h=await fixture(t);await settle(()=>h.deliver({ok:false,error:'保存先が一時停止中'},500));
 assert.match(h.body(),/前回の人物/);assert.match(h.body(),/前回表示分・最新確認できず/);assert.ok(h.load('src/insight-saved-view.ts').readSavedInsightView('social-last',scope));
 await settle(()=>h.w.dispatchEvent(new h.w.Event('focus')));assert.equal(h.calls.length,2);
 await settle(()=>h.deliver({ok:true,noteId:'tester',rows:[row('回復後の人物')],total:1}));assert.match(h.body(),/回復後の人物/);assert.doesNotMatch(h.body(),/前回表示分/);
});

test('代替の保存先読取で認証拒否された場合も前回表示へ戻さない',async t=>{
 const h=await fixture(t,comparison,{fallback:async()=>{throw new Error('HTTP_401')}});await settle(()=>h.deliver({ok:false,error:'一時的なAPI障害'},500));
 assert.doesNotMatch(h.body(),/前回の人物|前回表示分/);assert.equal(h.load('src/insight-saved-view.ts').readSavedInsightView('social-last',scope),null);
});
