import test from 'node:test';
import assert from 'node:assert/strict';
import * as React from 'react';
import {sceneFixture,pause} from './react-scene-fixture.mjs';

const member={id:'fixture-id',noteId:'fixture',displayName:'本人',status:'active',imageUrl:null};
const deferred=()=>{let resolve;const promise=new Promise(done=>resolve=done);return{promise,resolve}};
const marker=name=>()=>React.createElement('div',{'data-fixture':name},name);
async function fixture(t,{hash='#dashboard',intent,fetch=async()=>Response.json({ok:true,application:member})}={}){
  const calls=[],globals={URLSearchParams};
  const components={'./article-likes-page-v2':'ArticleLikesPageV2','./combined-analytics-app':'CombinedAnalyticsApp','./evidence-v2':'EvidenceV2','./feature-page':'FeaturePage','./hub-home':'HubHome','./management-page':'ManagementPage','./member-insight-live-v2':'MemberInsightLiveV2','./owner-gate':'OwnerGate'};
  const dependencies=Object.fromEntries(Object.entries(components).map(([path,name])=>[path,{[name]:marker(name)}]));
  dependencies['./insight-display-mode']={useInsightDisplayMode:()=>{}};
  const h=await sceneFixture(t,{globals,dependencies,fetch:async(url,init)=>{calls.push({url,action:JSON.parse(init.body||'{}').action,signal:init.signal});return fetch(url,init)}});
  globals.Event=h.w.Event;
  h.w.history.replaceState(null,'',hash);h.w.localStorage.setItem('mumei-insight-access-token','fixture-token');
  h.w.localStorage.setItem('mumei-insight-saved-accounts-v3',JSON.stringify([{...member,memberToken:'fixture-token',updatedAt:1}]));
  if(intent)h.load('src/insight-account-store.ts').setAccessIntent(intent);
  return{...h,calls,App:h.load('src/App.tsx').App};
}

test('保存tokenの本人画面起動は実Appの検証1本だけを待ち、仮Portalをmountしない',async t=>{
  const pending=deferred(),h=await fixture(t,{fetch:()=>pending.promise});await h.render(h.App);
  assert.equal(h.calls.length,1);assert.equal(h.calls[0].action,'session');assert.ok(h.calls[0].signal);assert.ok(h.w.document.querySelector('.app-session-check'));assert.equal(h.w.document.querySelector('[data-fixture="MemberInsightLiveV2"]'),null);
  await React.act(async()=>{pending.resolve(Response.json({ok:true,application:member}));await pause();await pause()});
  assert.equal(h.calls.length,1);assert.ok(h.w.document.querySelector('[data-fixture="MemberInsightLiveV2"]'));assert.equal(h.w.document.querySelector('.app-session-check'),null);
});

test('失効した本人sessionは確認後に実Portalを表示し、保存profileで通過させない',async t=>{
  const pending=deferred();let calls=0;const h=await fixture(t,{fetch:()=>++calls===1?pending.promise:Promise.resolve(Response.json({ok:false,error:'INSIGHT_SESSION_INVALID'},{status:401}))});await h.render(h.App);
  assert.equal(h.calls.length,1);
  await React.act(async()=>{pending.resolve(Response.json({ok:false,error:'INSIGHT_SESSION_INVALID'},{status:401}));await pause();await pause()});
  assert.equal(h.calls.length,2,'必要になった実Portalのsession確認は維持する');assert.equal(h.w.document.querySelector('[data-fixture="MemberInsightLiveV2"]'),null);assert.match(h.w.document.body.textContent,/アカウント切替・再ログイン/);
});

test('一時通信断では既存のoffline復帰を維持し、余分なPortal通信を追加しない',async t=>{
  const h=await fixture(t,{fetch:async()=>{throw new Error('offline')}});await h.render(h.App);
  assert.equal(h.calls.length,1);assert.ok(h.w.document.querySelector('[data-fixture="MemberInsightLiveV2"]'));assert.equal(h.w.localStorage.getItem('mumei-insight-access-token'),'fixture-token');
});

test('明示logout済みで本人画面を開くと実Portalを表示し、保存tokenを復活させない',async t=>{
  const h=await fixture(t);h.w.localStorage.setItem('mumei-insight-explicit-logout:fixture','1');h.w.localStorage.removeItem('mumei-insight-access-token');await h.render(h.App);
  assert.equal(h.calls.length,0);assert.equal(h.w.localStorage.getItem('mumei-insight-access-token'),null);assert.equal(h.w.document.querySelector('.app-session-check'),null);assert.match(h.w.document.body.textContent,/アカウント切替・再ログイン/);
});

for(const [hash,intent,expected]of [['#',undefined,'HubHome'],['#owner',undefined,'OwnerGate'],['#access/insight','login','アカウント切替・再ログイン'],['#access/insight','switch','アカウント切替・再ログイン']]){
  test(`${hash} ${intent||''} の実画面は本人画面の起動待ちへ置き換えない`,async t=>{
    const h=await fixture(t,{hash,intent});await h.render(h.App);assert.equal(h.calls.length,0);assert.equal(h.w.document.querySelector('.app-session-check'),null);assert.match(h.w.document.body.textContent,new RegExp(expected));
  });
}
