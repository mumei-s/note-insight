import test from 'node:test';
import assert from 'node:assert/strict';
import * as React from 'react';
import { sceneFixture, pause } from './react-scene-fixture.mjs';

const tokenKey='fixture-member-token';
const accountA={noteId:'creator_a',displayName:'保存済みの本人A',imageUrl:'https://images.test/saved-a.png'};
const accountB={noteId:'creator_b',displayName:'本人B',imageUrl:'https://images.test/b.png'};
const identity=(extra={})=>({ok:true,application:{...accountA,status:'active',...extra}});
async function settle(work=()=>{}){await React.act(async()=>{work();for(let i=0;i<5;i++)await pause()})}

async function fixture(t,{mode='normal',account=accountA,fetcher=async()=>Response.json(identity({displayName:'認証済みの本人A',imageUrl:'https://images.test/current-a.png'}))}={}){
 let current=account,now=Date.now();const calls=[],sceneRevisions=[],intervals=[],globals={};
 class Clock extends Date{static now(){return now}}
 const stub=({noteId,active,revision})=>{React.useEffect(()=>{if(active!==false)sceneRevisions.push(revision)},[active,revision]);return React.createElement('div',{'data-scene-note':noteId,'data-scene-active':String(active)})};
 const h=await sceneFixture(t,{globals,fetch:async(url,init)=>{
  const call={url:String(url),body:JSON.parse(init.body||'{}'),token:init.headers['X-Insight-Token'],signal:init.signal};calls.push(call);return fetcher(call);
 },dependencies:{
  './creator-avatar':{CreatorAvatar:({image,name})=>React.createElement(image?'img':'span',image?{src:image,alt:name}:{},image?undefined:name)},
  './insight-account-store':{INSIGHT_TOKEN_KEY:tokenKey,currentStoredInsightAccount:()=>current,setAccessIntent(){}},
  './insight-release':{CURRENT_INSIGHT_APP_VERSION:'test',CURRENT_DASHBOARD_VERSION:'test',CURRENT_NOTIFICATION_VERSION:'test',NOTIFICATION_VERSION_STORAGE_KEY:'notice-version',DASHBOARD_VERSION_STORAGE_KEY:'dash-version',fetchInsightRelease:async()=>({appVersion:'test',dashboardVersion:'test',notificationVersion:'test'}),versionDiffers:()=>false},
  './insight-visible-motion':{useVisibleMotion:()=>({ref:null,motion:false})},
  './insight-ux-v12':{},
  ...Object.fromEntries([['unified-v4','UnifiedV4'],['social-v2','SocialV2'],['notifications-final','NotificationsFinal'],['analysis-hub','AnalysisHub'],['comments-final','CommentsFinal'],['favorites-final','FavoritesFinal']].map(([file,name])=>['./member-insight-'+file,{['MemberInsight'+name]:stub}])),
 }});
 Object.assign(globals,{Date:Clock,URLSearchParams,Event:h.w.Event,CustomEvent:h.w.CustomEvent,navigator:h.w.navigator,requestAnimationFrame:callback=>h.w.requestAnimationFrame(callback)});
 h.w.setInterval=(fn,ms)=>{const timer={fn,ms,cancelled:false};intervals.push(timer);return intervals.length};h.w.clearInterval=id=>{if(intervals[id-1])intervals[id-1].cancelled=true};
 Object.defineProperty(h.w.document,'visibilityState',{value:'visible',writable:true});h.w.scrollTo=()=>{};h.w.HTMLElement.prototype.scrollIntoView=()=>{};
 h.w.localStorage.setItem(tokenKey,'token-a');h.w.history.replaceState({},'',`?insightMode=${mode}#dashboard`);
 const Component=h.load(process.env.INSIGHT_SHELL_REPRO_SOURCE||'src/member-insight-live-v2.tsx').MemberInsightLiveV2;
 const start=()=>h.render(Component,{});await start();await settle();
 return{...h,Component,calls,sceneRevisions,intervals,start,advance:ms=>{now+=ms},account:next=>{current=next},creator:()=>h.w.document.querySelector('.miv5-creator-copy').textContent,image:()=>h.w.document.querySelector('.miv5-creator-avatar img')?.src};
}

for(const mode of ['normal','comments','notifications','analysis'])test(`${mode}の起動shellは本人session1要求で済み、未使用のdashboard集計を取得しない`,async t=>{
 const h=await fixture(t,{mode});
 assert.equal(h.calls.length,1,'各機能bodyを除いた起動shellの通信予算');
 assert.equal(new URL(h.calls[0].url).pathname,'/functions/v1/insight-access');assert.deepEqual(h.calls[0].body,{action:'session'});assert.equal(h.calls[0].token,'token-a');
 assert.match(h.creator(),/認証済みの本人A/);assert.match(h.creator(),/@creator_a/);assert.equal(h.image(),'https://images.test/current-a.png');
 await settle(()=>h.w.dispatchEvent(new h.w.CustomEvent('mumei-insight-select-item',{detail:'supporters'})));
 assert.equal(h.calls.length,1,'同じshell内の項目移動は本人や全履歴を再要求しない');
});

test('保存先の本人がまだ不明でも認証済みsessionのIDを正規化し、欠損名や画像を推測しない',async t=>{
 const h=await fixture(t,{account:null,fetcher:async()=>Response.json(identity({noteId:'CREATOR_A',displayName:null,imageUrl:null}))});
 assert.equal(h.creator(),'creator_a@creator_a ↗');assert.equal(h.image(),undefined);assert.doesNotMatch(h.creator(),/ss_yr|undefined|null/);assert.equal(h.calls.length,1);
});

test('本人再確認が失敗しても確認済みの名前・画像とログインを保ちdashboardへ迂回しない',async t=>{
 let fail=false;
 const h=await fixture(t,{fetcher:async()=>fail?new Response('temporarily unavailable',{status:402}):Response.json(identity({displayName:'確認済みの本人',imageUrl:'https://images.test/verified.png'}))});
 fail=true;await settle(()=>h.w.dispatchEvent(new h.w.Event('pageshow')));
 assert.match(h.creator(),/確認済みの本人/);assert.equal(h.image(),'https://images.test/verified.png');assert.equal(h.w.localStorage.getItem(tokenKey),'token-a');
 assert.equal(h.calls.length,2);assert.ok(h.calls.every(call=>call.body.action==='session'&&call.url.endsWith('/insight-access')));
});

test('起動時の402や通信断では保存済み本人を保持し、重いdashboard取得で再試行しない',async t=>{
 for(const fetcher of [async()=>new Response('temporarily unavailable',{status:402}),async()=>{throw new Error('offline')}]){
  const h=await fixture(t,{fetcher});assert.match(h.creator(),/保存済みの本人A/);assert.equal(h.image(),accountA.imageUrl);
  assert.equal(h.w.localStorage.getItem(tokenKey),'token-a');assert.equal(h.calls.length,1);assert.deepEqual(h.calls[0].body,{action:'session'});
  await h.render(()=>null,{});
 }
});

test('200の不正な本人・inactive・失効応答を認証済みidentityとして表示しない',async t=>{
 for(const payload of [identity({noteId:'another_creator',displayName:'別人の名前'}),identity({status:'approved',displayName:'未確認の名前'}),{ok:true},identity({noteId:'',displayName:'壊れた名前'})]){
  const h=await fixture(t,{fetcher:async()=>Response.json(payload)});
  assert.match(h.creator(),/保存済みの本人A/);assert.doesNotMatch(h.creator(),/別人|未確認|壊れた/);assert.equal(h.w.localStorage.getItem(tokenKey),'token-a');
  await h.render(()=>null,{});
 }
 const h=await fixture(t,{fetcher:async()=>Response.json({ok:false,error:'INSIGHT_SESSION_INVALID',application:{noteId:'another_creator',displayName:'失効した本人',status:'active'}},{status:401})});
 assert.match(h.creator(),/保存済みの本人A/);assert.doesNotMatch(h.creator(),/失効した本人/);
});

for(const changeToken of [false,true])test(`本人切替後は${changeToken?'token変更前':'同tokenの別scope'}の遅いidentityを使わない`,async t=>{
 let deliver,reads=0;
 const h=await fixture(t,{fetcher:async()=>++reads===1?Response.json(identity({displayName:'認証済みの本人A'})):new Promise(resolve=>{deliver=()=>resolve(Response.json(identity({displayName:'遅い本人A'})))})});
 assert.match(h.creator(),/認証済みの本人A/);await settle(()=>h.w.dispatchEvent(new h.w.Event('pageshow')));
 h.account(accountB);if(changeToken)h.w.localStorage.setItem(tokenKey,'token-b');await h.start();assert.match(h.creator(),/本人B/);await settle(deliver);
 assert.match(h.creator(),/本人B/);assert.doesNotMatch(h.creator(),/遅い本人A|creator_a/);assert.equal(h.image(),'https://images.test/b.png');
});

test('本人Bのsession確認後はBの認証済みidentityを通知sceneへ渡し、Aの遅い成功でも戻さない',async t=>{
 let deliverA,reads=0;
 const h=await fixture(t,{mode:'notifications',fetcher:async call=>call.token==='token-b'?Response.json(identity({...accountB,displayName:'認証済みの本人B'})):++reads===1?Response.json(identity()):new Promise(resolve=>{deliverA=()=>resolve(Response.json(identity({displayName:'遅い本人A'})))})});
 await settle(()=>h.w.dispatchEvent(new h.w.Event('pageshow')));h.account(accountB);h.w.localStorage.setItem(tokenKey,'token-b');h.w.sessionStorage.setItem('mumei-insight-entry-mode','notifications');await h.render(h.Component,{key:'account-b'});await settle();
 assert.equal(h.calls[1].signal.aborted,true);
 assert.match(h.creator(),/認証済みの本人B/);assert.equal(h.w.document.querySelector('[data-scene-note]').getAttribute('data-scene-note'),'creator_b');
 await settle(deliverA);assert.match(h.creator(),/認証済みの本人B/);assert.equal(h.w.document.querySelector('[data-scene-note]').getAttribute('data-scene-note'),'creator_b');
 assert.equal(h.calls.length,3);assert.ok(h.calls.every(call=>call.body.action==='session'));
});

test('先の再確認と離脱を中断し、中断を無視した応答でも最新のidentityへ戻さない',async t=>{
 const deliveries=[];const h=await fixture(t,{fetcher:async()=>new Promise(resolve=>deliveries.push(name=>resolve(Response.json(identity({displayName:name})))))});
 h.advance(60001);
 await settle(()=>h.w.dispatchEvent(new h.w.Event('pageshow')));assert.equal(h.calls[0].signal.aborted,true);
 await settle(()=>deliveries[1]('今回確認した本人'));assert.match(h.creator(),/今回確認した本人/);
 await settle(()=>deliveries[0]('古い確認結果'));assert.match(h.creator(),/今回確認した本人/);assert.doesNotMatch(h.creator(),/古い確認結果/);
 await settle(()=>h.w.dispatchEvent(new h.w.Event('pageshow')));await h.render(()=>null,{});assert.equal(h.calls[2].signal.aborted,true);
 await settle(()=>deliveries[2]('離脱後の確認結果'));assert.equal(h.w.document.querySelector('.miv5'),null);
});

function resume(h){h.w.document.visibilityState='visible';h.w.document.dispatchEvent(new h.w.Event('visibilitychange'));h.w.dispatchEvent(new h.w.Event('pageshow'));h.w.dispatchEvent(new h.w.Event('online'));h.w.dispatchEvent(new h.w.Event('focus'))}

test('60秒以内の復帰eventsは履歴revisionを変えず軽い本人確認1要求にまとめる',async t=>{
 const h=await fixture(t);assert.deepEqual(h.sceneRevisions,[0]);h.advance(59999);
 await settle(()=>{h.w.document.visibilityState='hidden';h.w.document.dispatchEvent(new h.w.Event('visibilitychange'))});assert.equal(h.calls.length,1);
 await settle(()=>resume(h));assert.equal(h.calls.length,2);assert.deepEqual(h.sceneRevisions,[0]);assert.ok(h.calls.every(call=>call.body.action==='session'));
});

test('60秒超の復帰は連続eventsでも1回だけ履歴を確認し、次の短い復帰で再取得しない',async t=>{
 const h=await fixture(t);h.advance(60001);await settle(()=>resume(h));
 assert.deepEqual(h.sceneRevisions,[0,1]);assert.equal(h.calls.length,2);
 h.advance(59999);await settle(()=>resume(h));assert.deepEqual(h.sceneRevisions,[0,1]);assert.equal(h.calls.length,3);
 h.advance(2);await settle(()=>resume(h));assert.deepEqual(h.sceneRevisions,[0,1,2]);assert.equal(h.calls.length,4);
});

test('15分の定期確認は短期でもrevisionを更新し、その確認直後の復帰は重複読取しない',async t=>{
 const h=await fixture(t);h.advance(1000);await settle(()=>h.intervals[0].fn());
 assert.equal(h.intervals[0].ms,15*60000);assert.deepEqual(h.sceneRevisions,[0,1]);assert.equal(h.calls.length,2);
 h.advance(59000);await settle(()=>resume(h));assert.deepEqual(h.sceneRevisions,[0,1]);assert.equal(h.calls.length,3);
});
