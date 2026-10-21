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
const payload=value=>({ok:true,noteId:'tester',selectedPeriod:'month',latestDashboard:{pageViews:value,likes:0,comments:0,capturedAt:new Date().toISOString()},topArticles:[{title:`fixture-${Number(value).toLocaleString("en-US")}`,pageViews:value,likes:0,comments:0}],dailyMetrics:[]});
const stored=(h,value,period='month')=>h.load('src/insight-saved-view.ts').writeSavedInsightView('analysis-pro:'+period,{account:'tester',token:'fixture'},{...payload(value),selectedPeriod:period},Date.now()-10000);

test('分析起動時は同じ認証の保存値を即時表示し、最新応答で置換する',async t=>{
  let finish;const calls=[];
  const h=await sceneFixture(t,{dependencies,fetch:async(_url,init)=>{const body=JSON.parse(init.body);calls.push(body);return body.action==='analysis'?new Promise(resolve=>finish=resolve):Response.json({ok:true,followerCount:{count:7}})}});
  h.w.localStorage.setItem('fixture-token','fixture');stored(h,987654);
  const {MemberInsightAnalyticsProV3:C}=h.load('src/member-insight-analytics-pro-v3.tsx');await h.render(C,{});
  assert.match(h.w.document.querySelector('.mipro').textContent,/987,654/);
  await React.act(async()=>{finish(Response.json(payload(123456)));await pause()});
  assert.match(h.w.document.querySelector('.mipro').textContent,/123,456/);assert.doesNotMatch(h.w.document.querySelector('.mipro').textContent,/987,654/);
  assert.deepEqual(calls.map(x=>x.action).sort(),['analysis','follower-count']);assert.equal(calls.find(x=>x.action==='analysis').dashboardOnly,true);
});

test('分析の通信失敗では前回の保存値を復元し、失敗を明示する',async t=>{
  const h=await sceneFixture(t,{dependencies,fetch:async()=>{throw new Error('fixture-network-down')}});
  h.w.localStorage.setItem('fixture-token','fixture');stored(h,987654);
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
  h.w.localStorage.setItem('fixture-token','fixture');stored(h,987654);const {MemberInsightAnalyticsProV3:C}=h.load('src/member-insight-analytics-pro-v3.tsx');await h.render(C,{});
  await h.click([...h.w.document.querySelectorAll('.mipro-period-picker button')].find(button=>button.textContent.startsWith('全期間')));assert.equal(waiting.length,2);assert.equal(waiting[0].signal.aborted,true);
  await React.act(async()=>{waiting[0].resolve(Response.json(payload(111111)));waiting[1].resolve(Response.json({...payload(222222),selectedPeriod:'all'}));await pause()});
  assert.match(h.w.document.querySelector('.mipro').textContent,/222,222/);assert.doesNotMatch(h.w.document.querySelector('.mipro').textContent,/111,111/);
  assert.equal(h.load('src/insight-saved-view.ts').readSavedInsightView('analysis-pro:month',{account:'tester',token:'fixture'}).value.latestDashboard.pageViews,987654);
  assert.equal(h.load('src/insight-saved-view.ts').readSavedInsightView('analysis-pro:all',{account:'tester',token:'fixture'}).value.latestDashboard.pageViews,222222);
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

for(const view of ['dashboard','verdict']){
 test(`${view}: delayed hydration restores once without additional requests and cannot overwrite network success`,async t=>{
  let finish;let calls=0;
  const h=await sceneFixture(t,{dependencies,fetch:async(_url,init)=>{calls++;return JSON.parse(init.body).action==='analysis'?new Promise(r=>finish=r):Response.json({ok:true})}});
  h.w.localStorage.setItem('fixture-token','fixture');const {MemberInsightAnalyticsProV3:C}=h.load('src/member-insight-analytics-pro-v3.tsx');await h.render(C,{view});
  await React.act(async()=>{stored(h,987654);h.w.dispatchEvent(new h.w.Event('mumei-insight-storage-hydrated'));await pause()});
  assert.match(h.w.document.querySelector('.mipro').textContent,/987,654/);assert.equal(calls,2);
  await React.act(async()=>{finish(Response.json(payload(123456)));await pause();stored(h,987654);h.w.dispatchEvent(new h.w.Event('mumei-insight-storage-hydrated'));await pause()});
  assert.match(h.w.document.querySelector('.mipro').textContent,/123,456/);assert.doesNotMatch(h.w.document.querySelector('.mipro').textContent,/987,654/);assert.equal(calls,2);
 });
 for(const failure of ['analysis','follower-count'])test(`${view}: ${failure} denial clears display and all period copies, blocks late hydration`,async t=>{
  const h=await sceneFixture(t,{dependencies,fetch:async(_url,init)=>JSON.parse(init.body).action===failure?Response.json({error:'permission denied'},{status:403}):Response.json(payload(123456))});
  h.w.localStorage.setItem('fixture-token','fixture');stored(h,987654);stored(h,987654,'all');const {MemberInsightAnalyticsProV3:C}=h.load('src/member-insight-analytics-pro-v3.tsx');await h.render(C,{view});
  assert.doesNotMatch(h.w.document.querySelector('.mipro').textContent,/987,654|123,456/);
  assert.equal(h.load('src/insight-saved-view.ts').readSavedInsightView('analysis-pro:all',{account:'tester',token:'fixture'}),null);
  await React.act(async()=>{stored(h,987654);h.w.dispatchEvent(new h.w.Event('mumei-insight-storage-hydrated'));await pause()});
  assert.doesNotMatch(h.w.document.querySelector('.mipro').textContent,/987,654/);
 });
}
for(const nextToken of ['', 'another-token'])test(`analysis token change to ${nextToken||'logout'} never restores previous credentials`,async t=>{
 const h=await sceneFixture(t,{dependencies,fetch:async()=>{throw new Error('network offline')}});
 h.w.localStorage.setItem('fixture-token','fixture');stored(h,987654);const {MemberInsightAnalyticsProV3:C}=h.load('src/member-insight-analytics-pro-v3.tsx');await h.render(C,{});assert.match(h.w.document.querySelector('.mipro').textContent,/987,654/);
 await React.act(async()=>{h.w.localStorage.setItem('fixture-token',nextToken);h.w.dispatchEvent(new h.w.Event('mumei-insight-accounts'));await pause()});
 assert.doesNotMatch(h.w.document.querySelector('.mipro').textContent,/987,654/);
});

test('legacy account-only analysis cache is not trusted on transient failure',async t=>{
 const h=await sceneFixture(t,{dependencies,fetch:async()=>{throw new Error('network offline')}});
 h.w.localStorage.setItem('fixture-token','fixture');h.w.localStorage.setItem('mumei-insight-pro-cache-v3:tester',JSON.stringify({cachedAt:Date.now(),data:payload(987654)}));
 const {MemberInsightAnalyticsProV3:C}=h.load('src/member-insight-analytics-pro-v3.tsx');await h.render(C,{});assert.doesNotMatch(h.w.document.querySelector('.mipro').textContent,/987,654/);
});

async function notificationScene(t,load){
 const h=await sceneFixture(t,{dependencies:{'./insight-account-store':account,'./member-insight-analytics-pro-v3':{MemberInsightAnalyticsProV3:()=>null},'./member-insight-analysis-summary-client':{loadNotificationSummary:load}}});
 h.w.history.replaceState({},'','/note-insight/?analysisPanel=notifications');h.w.localStorage.setItem('fixture-token','fixture');
 h.Component=h.load('src/member-insight-analysis-hub.tsx').MemberInsightAnalysisHub;
 h.save=(sample,period=0)=>h.load('src/insight-saved-view.ts').writeSavedInsightView('notification-analysis:'+period,{account:'tester',token:'fixture'},{sample,people:sample},Date.now()-10000);
 return h;
}
test('notification analysis shows previous snapshot before request and keeps it on transient failure',async t=>{
 let reject;const h=await notificationScene(t,()=>new Promise((_,r)=>reject=r));h.save(987654);await h.render(h.Component,{});
 assert.match(h.w.document.querySelector('.miah-notification').textContent,/987,654/);
 await React.act(async()=>{reject(new Error('offline'));await pause()});assert.match(h.w.document.querySelector('.miah-notification').textContent,/987,654/);assert.match(h.w.document.querySelector('[role=alert]').textContent,/offline/);
});
test('notification delayed hydration restores without extra call; network response wins over later hydration',async t=>{
 let finish,calls=0;const h=await notificationScene(t,()=>{calls++;return new Promise(r=>finish=r)});await h.render(h.Component,{});
 await React.act(async()=>{h.save(987654);h.w.dispatchEvent(new h.w.Event('mumei-insight-storage-hydrated'));await pause()});assert.match(h.w.document.querySelector('.miah-notification').textContent,/987,654/);
 await React.act(async()=>{finish({sample:123456,people:1});await pause();h.save(987654);h.w.dispatchEvent(new h.w.Event('mumei-insight-storage-hydrated'));await pause()});assert.match(h.w.document.querySelector('.miah-notification').textContent,/123,456/);assert.doesNotMatch(h.w.document.querySelector('.miah-notification').textContent,/987,654/);assert.equal(calls,1);
});
test('notification auth denial clears all periods and blocks late hydration',async t=>{
 const h=await notificationScene(t,async()=>{throw new Error('HTTP_401')});h.save(987654);h.save(987654,7);await h.render(h.Component,{});
 assert.doesNotMatch(h.w.document.querySelector('.miah-notification').textContent,/987,654/);assert.equal(h.load('src/insight-saved-view.ts').readSavedInsightView('notification-analysis:7',{account:'tester',token:'fixture'}),null);
 await React.act(async()=>{h.save(987654);h.w.dispatchEvent(new h.w.Event('mumei-insight-storage-hydrated'));await pause()});assert.doesNotMatch(h.w.document.querySelector('.miah-notification').textContent,/987,654/);
});
for(const nextToken of ['', 'another-token'])test(`notification ${nextToken||'logout'} clears old snapshot and ignores old response`,async t=>{
 const pending=[];const h=await notificationScene(t,()=>new Promise(r=>pending.push(r)));h.save(987654);await h.render(h.Component,{});
 await React.act(async()=>{h.w.localStorage.setItem('fixture-token',nextToken);h.w.dispatchEvent(new h.w.Event('mumei-insight-accounts'));await pause();pending[0]({sample:888888,people:1});await pause()});
 assert.doesNotMatch(h.w.document.querySelector('.miah-notification').textContent,/987,654|888,888/);
});
test('notification period restore stays separate and aborts old request',async t=>{
 const pending=[];const h=await notificationScene(t,(period,force,signal)=>new Promise(r=>pending.push({period,signal,r})));h.save(987654);h.save(123456,7);await h.render(h.Component,{});
 await React.act(async()=>{const select=h.w.document.querySelector('.miah-period select');select.value='7';select.dispatchEvent(new h.w.Event('change',{bubbles:true}));await pause()});
 assert.equal(pending[0].signal.aborted,true);assert.equal(pending[1].period,7);assert.match(h.w.document.querySelector('.miah-notification').textContent,/123,456/);assert.doesNotMatch(h.w.document.querySelector('.miah-notification').textContent,/987,654/);
});
test('summary client preserves authorization failure HTTP status',async t=>{
 const h=await sceneFixture(t,{dependencies:{'./insight-account-store':account},fetch:async()=>Response.json({error:'permission denied'},{status:403})});h.w.localStorage.setItem('fixture-token','fixture');
 await assert.rejects(h.load('src/member-insight-analysis-summary-client.ts').loadNotificationSummary(),/HTTP_403/);
});
test('summary denial invalidates previous short-lived success instead of serving it on remount',async t=>{
 let calls=0;const h=await sceneFixture(t,{dependencies:{'./insight-account-store':account},fetch:async()=>++calls===1?Response.json({sample:123}):Response.json({error:'permission denied'},{status:401})});h.w.localStorage.setItem('fixture-token','fixture');const load=h.load('src/member-insight-analysis-summary-client.ts').loadNotificationSummary;
 assert.equal((await load()).sample,123);await assert.rejects(load(0,true),/HTTP_401/);await assert.rejects(load(),/HTTP_401/);assert.equal(calls,3);
});
test('summary auth denial invalidates simultaneous period requests as authorization failures',async t=>{
 const pending=[];const h=await sceneFixture(t,{dependencies:{'./insight-account-store':account},fetch:async()=>new Promise(r=>pending.push(r))});h.w.localStorage.setItem('fixture-token','fixture');const load=h.load('src/member-insight-analysis-summary-client.ts').loadNotificationSummary;
 const first=load(0),second=load(7),firstRejected=assert.rejects(first,/HTTP_401/),secondRejected=assert.rejects(second,/HTTP_401/);
 pending[0](Response.json({error:'permission denied'},{status:401}));await Promise.all([firstRejected,secondRejected]);
});
test('verdict notification denial clears saved dashboard and prevents delayed primary republish',async t=>{
 let finish;const h=await sceneFixture(t,{dependencies:{...dependencies,'./member-insight-analysis-summary-client':{loadNotificationSummary:async()=>{throw new Error('INSIGHT_SESSION_INVALID')}}},fetch:async(_url,init)=>JSON.parse(init.body).action==='analysis'?new Promise(r=>finish=r):Response.json({ok:true})});
 h.w.localStorage.setItem('fixture-token','fixture');stored(h,987654);const {MemberInsightAnalyticsProV3:C}=h.load('src/member-insight-analytics-pro-v3.tsx');await h.render(C,{view:'verdict'});
 await React.act(async()=>{finish(Response.json(payload(123456)));await pause()});assert.doesNotMatch(h.w.document.querySelector('.mipro').textContent,/987,654|123,456/);assert.equal(h.load('src/insight-saved-view.ts').readSavedInsightView('analysis-pro:month',{account:'tester',token:'fixture'}),null);
});
test('dashboard period change cannot restore old-period hydration before effect cleanup',async t=>{
 const h=await sceneFixture(t,{dependencies,fetch:async()=>new Promise(()=>{})});h.w.localStorage.setItem('fixture-token','fixture');stored(h,987654);const {MemberInsightAnalyticsProV3:C}=h.load('src/member-insight-analytics-pro-v3.tsx');await h.render(C,{});
 await React.act(async()=>{[...h.w.document.querySelectorAll('.mipro-period-picker button')].find(b=>b.textContent.startsWith('全期間')).click();h.w.dispatchEvent(new h.w.Event('mumei-insight-storage-hydrated'));await pause()});assert.doesNotMatch(h.w.document.querySelector('.mipro').textContent,/987,654/);
});
test('notification period change cannot restore old-period hydration before effect cleanup',async t=>{
 const h=await notificationScene(t,()=>new Promise(()=>{}));h.save(987654);await h.render(h.Component,{});
 await React.act(async()=>{const select=h.w.document.querySelector('.miah-period select');select.value='7';select.dispatchEvent(new h.w.Event('change',{bubbles:true}));h.w.dispatchEvent(new h.w.Event('mumei-insight-storage-hydrated'));await pause()});assert.doesNotMatch(h.w.document.querySelector('.miah-notification').textContent,/987,654/);
});
for(const sample of [0,987654])test(`notification saved ${sample} keeps original timestamp and pending/offline provenance`,async t=>{
 let reject;const h=await notificationScene(t,()=>new Promise((_,r)=>reject=r));const at=Date.parse('2026-10-20T01:23:00Z');h.load('src/insight-saved-view.ts').writeSavedInsightView('notification-analysis:0',{account:'tester',token:'fixture'},{sample,people:sample},at);await h.render(h.Component,{});
 const text=()=>h.w.document.querySelector('.miah-notification').textContent;assert.match(text(),/前回の保存済み分析.*2026\/10\/20.*10:23/);assert.match(text(),/最新の通知を確認中/);
 await React.act(async()=>{reject(new Error('offline'));await pause()});assert.match(text(),/前回の保存済み分析.*2026\/10\/20.*10:23/);assert.match(text(),/offline/);assert.doesNotMatch(text(),/最新の通知を確認中/);
});
test('notification live empty result removes saved provenance and wins over late hydration',async t=>{
 let finish;const h=await notificationScene(t,()=>new Promise(r=>finish=r));h.save(987654);await h.render(h.Component,{});
 await React.act(async()=>{finish({sample:0});await pause();h.save(987654);h.w.dispatchEvent(new h.w.Event('mumei-insight-storage-hydrated'));await pause()});const text=h.w.document.querySelector('.miah-notification').textContent;assert.match(text,/選択期間の本人通知はありません/);assert.doesNotMatch(text,/987,654|前回の保存済み分析|最新の通知を確認中/);
});
