import test from 'node:test';
import assert from 'node:assert/strict';
import * as React from 'react';
import { sceneFixture, pause } from './react-scene-fixture.mjs';

const account={ INSIGHT_TOKEN_KEY:'fixture-token', currentStoredInsightAccount:()=>({noteId:'tester'}) };
const dependencies={
  './insight-account-store':account,
  './insight-release':{CURRENT_DASHBOARD_VERSION:'fixture',CURRENT_INSIGHT_APP_VERSION:'fixture',CURRENT_NOTIFICATION_VERSION:'fixture'},
  './member-insight-analysis-summary-client':{loadNotificationSummary:async()=>({total:0,dailyCounts:[]})},
};
const payload=value=>({ok:true,noteId:'tester',selectedPeriod:'month',latestDashboard:{pageViews:value,likes:0,comments:0,capturedAt:new Date().toISOString()},topArticles:[],dailyMetrics:[]});
const stored=(w,value)=>w.localStorage.setItem('mumei-insight-pro-cache-v3:tester',JSON.stringify({cachedAt:Date.now()-10000,data:payload(value)}));

test('分析起動時は前回の保存値を出さず、最新応答を先に表示する',async t=>{
  let finish;const calls=[];
  const h=await sceneFixture(t,{dependencies,fetch:async(_url,init)=>{const body=JSON.parse(init.body);calls.push(body);return body.action==='analysis'?new Promise(resolve=>finish=resolve):Response.json({ok:true,followerCount:{count:7}})}});
  h.w.localStorage.setItem('fixture-token','fixture');stored(h.w,987654);
  const {MemberInsightAnalyticsProV3:C}=h.load('src/member-insight-analytics-pro-v3.tsx');await h.render(C,{});
  assert.doesNotMatch(h.w.document.querySelector('.mipro').textContent,/987,654/);assert.match(h.w.document.querySelector('.mipro').textContent,/保存済みデータを確認中/);
  await React.act(async()=>{finish(Response.json(payload(123456)));await pause()});
  assert.match(h.w.document.querySelector('.mipro').textContent,/123,456/);assert.doesNotMatch(h.w.document.querySelector('.mipro').textContent,/987,654/);
  assert.deepEqual(calls.map(x=>x.action).sort(),['analysis','follower-count']);assert.equal(calls.find(x=>x.action==='analysis').dashboardOnly,true);
});

test('分析の通信失敗では前回の保存値を復元し、失敗を明示する',async t=>{
  const h=await sceneFixture(t,{dependencies,fetch:async()=>{throw new Error('fixture-network-down')}});
  h.w.localStorage.setItem('fixture-token','fixture');stored(h.w,987654);
  const {MemberInsightAnalyticsProV3:C}=h.load('src/member-insight-analytics-pro-v3.tsx');await h.render(C,{});
  assert.match(h.w.document.querySelector('.mipro').textContent,/987,654/);assert.match(h.w.document.querySelector('.mipro-warning').textContent,/更新失敗.*保存済み/);
  assert.equal(h.w.document.querySelector('.mipro-head-actions button:last-child').disabled,false);
});

test('分析の副通信中は復帰イベントを重複発行せず、離脱で取得を中断する',async t=>{
  const calls=[],waiting=[];
  const h=await sceneFixture(t,{dependencies,fetch:async(_url,init)=>{const body=JSON.parse(init.body);calls.push({body,signal:init.signal});if(body.action==='follower-count')return new Promise(resolve=>waiting.push(resolve));return Response.json(payload(123456))}});
  Object.defineProperty(h.w.document,'visibilityState',{value:'visible',configurable:true});h.w.localStorage.setItem('fixture-token','fixture');
  const {MemberInsightAnalyticsProV3:C}=h.load('src/member-insight-analytics-pro-v3.tsx');await h.render(C,{});
  assert.match(h.w.document.querySelector('.mipro').textContent,/123,456/);assert.equal(h.w.document.querySelector('.mipro-head-actions button:last-child').disabled,true);
  await React.act(async()=>{for(const name of ['online','pageshow','focus'])h.w.dispatchEvent(new h.w.Event(name));h.w.document.dispatchEvent(new h.w.Event('visibilitychange'));await pause()});
  assert.equal(calls.length,2,'未完了のフォロワー確認と並行して分析を再発行しない');
  await React.act(async()=>{waiting[0](Response.json({ok:true,followerCount:{count:7}}));await pause()});
  assert.equal(h.w.document.querySelector('.mipro-head-actions button:last-child').disabled,false);
  await React.act(async()=>{h.w.dispatchEvent(new h.w.Event('online'));await pause()});assert.equal(calls.length,4);
  await React.act(async()=>h.root.unmount());assert.equal(calls.at(-2).signal.aborted,true);
});

test('通知分析の更新中に届いたrevisionは通信完了後に一度だけ新しい集計を確認する',async t=>{
  const waiting=[];
  const h=await sceneFixture(t,{dependencies:{'./insight-account-store':account},fetch:(_url,init)=>new Promise(resolve=>waiting.push({resolve,signal:init.signal}))});
  h.w.localStorage.setItem('fixture-token','a');const {loadNotificationSummary:load}=h.load('src/member-insight-analysis-summary-client.ts');
  const first=load(),same=load();assert.equal(first,same);const updated=load(0,true),alsoUpdated=load(0,true);assert.equal(updated,alsoUpdated);assert.equal(waiting.length,1);
  waiting[0].resolve(Response.json({ok:true,total:1}));assert.equal((await first).total,1);await pause();assert.equal(waiting.length,2);
  waiting[1].resolve(Response.json({ok:true,total:2}));assert.equal((await updated).total,2);assert.equal((await load()).total,2);assert.equal(waiting.length,2);
});

test('通知分析の強制確認中にさらに新しいrevisionが届けば最新revisionを再確認する',async t=>{
  const waiting=[];
  const h=await sceneFixture(t,{dependencies:{'./insight-account-store':account},fetch:()=>new Promise(resolve=>waiting.push(resolve))});
  h.w.localStorage.setItem('fixture-token','a');const {loadNotificationSummary:load}=h.load('src/member-insight-analysis-summary-client.ts');
  const first=load(0,true,undefined,1);assert.equal(load(0,true,undefined,1),first);
  const changed=load(0,true,undefined,2),latest=load(0,true,undefined,3);assert.equal(changed,latest);assert.equal(waiting.length,1);
  waiting[0](Response.json({ok:true,total:1}));await first;await pause();assert.equal(waiting.length,2);
  assert.equal(load(0,true,undefined,3),load(0,true,undefined,3));
  waiting[1](Response.json({ok:true,total:3}));assert.equal((await latest).total,3);assert.equal((await load()).total,3);assert.equal(waiting.length,2);
});

test('分析期間の切替は旧通信を中断し、遅い応答を別期間の表示や保存へ反映しない',async t=>{
  const waiting=[];
  const h=await sceneFixture(t,{dependencies,fetch:async(_url,init)=>{const body=JSON.parse(init.body);return body.action==='analysis'?new Promise(resolve=>waiting.push({body,resolve,signal:init.signal})):Response.json({ok:true,followerCount:{count:7}})}});
  h.w.localStorage.setItem('fixture-token','fixture');stored(h.w,987654);const {MemberInsightAnalyticsProV3:C}=h.load('src/member-insight-analytics-pro-v3.tsx');await h.render(C,{});
  await h.click([...h.w.document.querySelectorAll('.mipro-period-picker button')].find(button=>button.textContent.startsWith('全期間')));assert.equal(waiting.length,2);assert.equal(waiting[0].signal.aborted,true);
  await React.act(async()=>{waiting[0].resolve(Response.json(payload(111111)));waiting[1].resolve(Response.json({...payload(222222),selectedPeriod:'all'}));await pause()});
  assert.match(h.w.document.querySelector('.mipro').textContent,/222,222/);assert.doesNotMatch(h.w.document.querySelector('.mipro').textContent,/111,111/);
  assert.equal(JSON.parse(h.w.localStorage.getItem('mumei-insight-pro-cache-v3:tester')).data.latestDashboard.pageViews,987654);
  assert.equal(JSON.parse(h.w.localStorage.getItem('mumei-insight-pro-cache-v3:tester:all')).data.latestDashboard.pageViews,222222);
});

test('通知分析の共有通信は離脱した受信者だけを中断し、アカウント切替で旧通信を止める',async t=>{
  const waiting=[];
  const h=await sceneFixture(t,{dependencies:{'./insight-account-store':account},fetch:(_url,init)=>new Promise(resolve=>waiting.push({resolve,signal:init.signal}))});
  h.w.localStorage.setItem('fixture-token','a');const {loadNotificationSummary:load}=h.load('src/member-insight-analysis-summary-client.ts');const controller=new AbortController();
  const consumer=load(0,false,controller.signal),shared=load(),stopped=assert.rejects(consumer,/中断/);controller.abort();await stopped;assert.equal(waiting[0].signal.aborted,false);
  const switched=assert.rejects(shared,/アカウント/);h.w.localStorage.setItem('fixture-token','b');const latest=load();assert.equal(waiting[0].signal.aborted,true);
  waiting[1].resolve(Response.json({ok:true,total:2}));await switched;assert.equal((await latest).total,2);
});

test('本人通知分析はrevisionを強制確認し、モバイル復帰時の重複読込を抑える',async t=>{
  const calls=[],waiting=[];
  const h=await sceneFixture(t,{dependencies:{
    './insight-account-store':account,'./member-insight-analytics-pro-v3':{MemberInsightAnalyticsProV3:()=>null},
    './insight-view-lifecycle':{isFreshInsightView:()=>false},
    './member-insight-analysis-summary-client':{loadNotificationSummary:(period,force,signal)=>new Promise(resolve=>{calls.push({period,force,signal});waiting.push(resolve)})},
  }});
  h.w.history.replaceState({},'','/note-insight/?analysisPanel=notifications');h.w.localStorage.setItem('fixture-token','fixture');Object.defineProperty(h.w.document,'visibilityState',{value:'visible',configurable:true});
  const {MemberInsightAnalysisHub:C}=h.load('src/member-insight-analysis-hub.tsx');await h.render(C,{noteId:'tester',revision:0});assert.equal(calls.length,1);
  await React.act(async()=>{waiting[0]({sample:0});await pause()});await h.render(C,{noteId:'tester',revision:1});assert.equal(calls[1].force,true);
  await React.act(async()=>{waiting[1]({sample:0});await pause();h.w.document.dispatchEvent(new h.w.Event('visibilitychange'));for(const name of ['pageshow','focus','online'])h.w.dispatchEvent(new h.w.Event(name));await pause()});
  assert.equal(calls.length,3);assert.equal(calls[2].force,false);assert.ok(h.w.document.querySelector('.miah-menu'));
  await React.act(async()=>h.root.unmount());assert.equal(calls[2].signal.aborted,true);
  await React.act(async()=>{waiting[2]({sample:99999});await pause()});assert.equal(h.w.document.querySelector('.miah-notification'),null);
});
