import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as React from 'react';
import { sceneFixture, pause } from './react-scene-fixture.mjs';

const app={id:'fixture-id',noteId:'fixture',displayName:'確認用',status:'active',imageUrl:null};
async function fixture(t,fetch){
  const globals={};const h=await sceneFixture(t,{globals,fetch});globals.Event=h.w.Event;
  h.w.localStorage.setItem('mumei-insight-access-token','fixture-token');
  h.w.localStorage.setItem('mumei-insight-saved-accounts-v3',JSON.stringify([{...app,memberToken:'fixture-token',applicantToken:'fixture-applicant',updatedAt:1}]));
  const store=h.load('src/insight-account-store.ts');return {...h,store};
}
for(const intent of ['login','switch','apply'])test(`明示的な${intent}はStrictModeでも選択画面で止まりログインを保持する`,async t=>{
  const calls=[];const h=await fixture(t,async(...args)=>{calls.push(args);return Response.json({ok:true,application:app})});
  h.store.setAccessIntent(intent);h.w.location.hash='access/insight';
  const {AccessPortalV6}=h.load('src/access-portal-v6.tsx');
  await h.render(()=>React.createElement(React.StrictMode,{},React.createElement(AccessPortalV6)),{});
  assert.equal(h.w.location.hash,'#access/insight');assert.equal(calls.length,0);
  assert.equal(h.w.localStorage.getItem('mumei-insight-access-token'),'fixture-token');
  assert.match(h.w.document.body.textContent,intent==='apply'?/参加申請/:/アカウント切替・再ログイン/);
  if(intent!=='apply'){
    const current=h.w.document.querySelector('.access2-account');assert.equal(current.disabled,false);
    await h.click(current);assert.equal(h.w.location.hash,'#dashboard');
    assert.equal(h.store.hasManualAccessIntent(),false);assert.equal(calls.length,1);
  }
});

async function recoveryFixture(t,fetch){
  const h=await fixture(t,fetch);h.w.history.replaceState(null,'','#access/insight');
  const source=readFileSync('src/main.tsx','utf8');
  const code=source.slice(source.indexOf('function showAccessNotice('),source.indexOf('async function pollOwnerPendingApplications('));
  const ctx=vm.createContext({window:h.w,document:h.w.document,localStorage:h.w.localStorage,sessionStorage:h.w.sessionStorage,
    ...h.store,fetch,ACCESS:'fixture-access',REACTIVATE:'fixture-reactivate',JOIN_NOTE_KEY:'join',requestedNotificationAccount:'',memberResumeRunning:false,memberResumeGeneration:0});
  vm.runInContext(ts.transpileModule(code+'\nthis.resume=tryReturningMemberResume;', {compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,ctx);
  return {...h,ctx};
}
test('共通の自動復帰も手動ログイン画面・切替ロックでは通信せず待つ',async t=>{
  let calls=0;const h=await recoveryFixture(t,async()=>{calls++;return Response.json({ok:true,application:app})});
  for(const intent of ['login','switch','apply']){h.store.setAccessIntent(intent);h.store.consumeAccessIntent();await h.ctx.resume();assert.equal(h.w.location.hash,'#access/insight');}
  assert.equal(calls,0);h.store.clearAccessIntent();h.w.sessionStorage.setItem('mumei-insight-account-switch-lock-v1','1');await h.ctx.resume();assert.equal(calls,0);
});
test('手動選択に移った後の遅延応答は画面を進めず、通常の自動復帰は維持する',async t=>{
  let finish;const h=await recoveryFixture(t,()=>new Promise(r=>finish=r));
  const pending=h.ctx.resume();await pause();h.store.setAccessIntent('login');h.store.consumeAccessIntent();
  finish(Response.json({ok:true,application:app}));await pending;assert.equal(h.w.location.hash,'#access/insight');
  h.store.clearAccessIntent();const regular=h.ctx.resume();await pause();finish(Response.json({ok:true,application:app}));await regular;
  assert.equal(h.w.location.hash,'#dashboard');assert.equal(h.w.localStorage.getItem('mumei-insight-access-token'),'fixture-token');
});
test('離れた画面への遅延復帰応答は保存アカウントを書き換えない',async t=>{
  let finish;const h=await recoveryFixture(t,()=>new Promise(r=>finish=r));h.w.localStorage.removeItem('mumei-insight-access-token');
  const pending=h.ctx.resume();await pause();h.w.history.replaceState(null,'','#');
  finish(Response.json({ok:true,application:app,memberToken:'late-token'}));await pending;
  assert.equal(h.w.location.hash,'');assert.equal(h.w.localStorage.getItem('mumei-insight-access-token'),null);
});

function applyStartupAccessIntent(h,url){
  h.w.history.replaceState(null,'',url);
  h.w.sessionStorage.clear();
  const source=readFileSync('src/main.tsx','utf8');
  const code=source.slice(source.indexOf('function applyRequestedAccessIntent('),source.indexOf('installApiBridge();'));
  const context=vm.createContext({window:h.w,sessionStorage:h.w.sessionStorage,URL,...h.store,ACCOUNT_ROUTE_REFRESH_KEY:'mumei-account-route-refresh-v1'});
  vm.runInContext(ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);
}
const accessIntentKeys=['mumei-insight-access-intent','mumei-insight-manual-access-intent-v1','mumei-insight-account-switch-lock-v1'];

for(const launch of ['', '&launch=top'])test(`新規タブの切替URL${launch?'はTOP起動指定があっても':'は'}保存ログインから自動復帰せずアカウント一覧を開く`,async t=>{
  let calls=0;
  const h=await recoveryFixture(t,async()=>{calls++;return Response.json({ok:true,application:app})});
  assert.equal(h.w.sessionStorage.length,0,'新規タブ相当の状態から開始する');
  applyStartupAccessIntent(h,`?accessIntent=switch${launch}#access/insight`);
  assert.deepEqual(accessIntentKeys.map(key=>h.w.sessionStorage.getItem(key)),['switch','switch','1'],'Reactのブート前に手動切替の3キーを設定する');
  assert.equal(h.w.location.hash,'#access/insight');
  const clean=new URL(h.w.location.href);assert.equal(clean.searchParams.has('accessIntent'),false);assert.equal(clean.searchParams.has('launch'),false);
  await h.ctx.resume();assert.equal(calls,0,'共通の自動復帰も切替画面を飛び越えない');
  const {AccessPortalV6}=h.load('src/access-portal-v6.tsx');
  await h.render(()=>React.createElement(React.StrictMode,{},React.createElement(AccessPortalV6)),{});
  assert.equal(h.w.location.hash,'#access/insight');assert.equal(calls,0);
  assert.match(h.w.document.body.textContent,/アカウント切替・再ログイン/);
  assert.equal(h.w.document.querySelectorAll('.access2-account').length,1);
  assert.equal(h.w.document.querySelector('.access2-account').disabled,false);
  assert.equal(h.w.localStorage.getItem('mumei-insight-access-token'),'fixture-token');
  assert.equal(h.store.hasManualAccessIntent(),true);
});

test('通常のダッシュボードURLにある切替マーカーは手動切替やアカウント一覧を発動しない',async t=>{
  let calls=0;
  const h=await recoveryFixture(t,async()=>{calls++;return Response.json({ok:true,application:app})});
  applyStartupAccessIntent(h,'?accessIntent=switch#dashboard');
  assert.equal(h.w.location.hash,'#dashboard');assert.equal(h.store.hasManualAccessIntent(),false);
  assert.deepEqual(accessIntentKeys.map(key=>h.w.sessionStorage.getItem(key)),[null,null,null]);
  assert.equal(new URL(h.w.location.href).searchParams.get('accessIntent'),'switch','切替ルート以外ではマーカーを適用しない');
  await h.ctx.resume();assert.equal(h.w.location.hash,'#dashboard');assert.equal(calls,1,'通常のダッシュボードでは保存済みセッションの検証を続ける');
  assert.equal(h.store.hasManualAccessIntent(),false);
  assert.equal(h.w.localStorage.getItem('mumei-insight-access-token'),'fixture-token');
});
