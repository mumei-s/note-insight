import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as React from 'react';
import {JSDOM} from 'jsdom';
import {sceneFixture,pause} from './react-scene-fixture.mjs';

const helper=()=>readFileSync('public/insight-update-return.js','utf8');
const compile=source=>ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
async function settle(work=()=>{}){await React.act(async()=>{work();for(let i=0;i<8;i++)await pause()})}
async function shell(t,{query='',state={},beforeRender}={}){
 const globals={},calls=[];
 const stub=()=>React.createElement('div',{'data-feature-stub':true});
 const h=await sceneFixture(t,{globals,fetch:async(url,init)=>{calls.push({url:String(url),body:JSON.parse(init?.body||'{}')});return Response.json({ok:true,application:{noteId:'tester',status:'active',displayName:'架空の本人'}})},dependencies:{
  './creator-avatar':{CreatorAvatar:()=>null},
  './insight-account-store':{INSIGHT_TOKEN_KEY:'fixture-token',currentStoredInsightAccount:()=>({noteId:'tester'}),setAccessIntent(){}},
  './insight-release':{CURRENT_INSIGHT_APP_VERSION:'1',CURRENT_DASHBOARD_VERSION:'1',CURRENT_NOTIFICATION_VERSION:'1',NOTIFICATION_VERSION_STORAGE_KEY:'notice-version',DASHBOARD_VERSION_STORAGE_KEY:'dash-version',fetchInsightRelease:async()=>({appVersion:'1',dashboardVersion:'1',notificationVersion:'1'}),versionDiffers:()=>false},
  './insight-visible-motion':{useVisibleMotion:()=>({ref:null,motion:false})},'./insight-ux-v11':{},'./insight-ux-v12':{},'./insight-ux-v13':{},
  ...Object.fromEntries([['unified-v4','UnifiedV4'],['social-v2','SocialV2'],['notifications-final','NotificationsFinal'],['analysis-hub','AnalysisHub'],['comments-final','CommentsFinal'],['favorites-final','FavoritesFinal']].map(([file,name])=>['./member-insight-'+file,{['MemberInsight'+name]:stub}])),
 }});
 Object.assign(globals,{URLSearchParams,Event:h.w.Event,CustomEvent:h.w.CustomEvent,navigator:h.w.navigator,requestAnimationFrame:fn=>fn()});
 h.w.scrollTo=()=>{};h.w.HTMLElement.prototype.scrollIntoView=()=>{};h.w.localStorage.setItem('fixture-token','fixture');
 h.w.history.replaceState(state,'',query+'#dashboard');vm.runInNewContext(helper(),{window:h.w,document:h.w.document,history:h.w.history,location:h.w.location,localStorage:h.w.localStorage,sessionStorage:h.w.sessionStorage,URL});
 beforeRender?.(h);
 const Component=h.load('src/member-insight-live-v2.tsx').MemberInsightLiveV2;await h.render(Component,{});await settle();
 return{...h,calls};
}

for(const [mode,tab]of [['normal','dm'],['normal','articles'],['normal','supporters'],['normal','commentRanking'],['normal','magazines'],['comments','comments'],['favorites','favorites'],['social','social'],['notifications','notifications'],['analysis','likes']])test(`更新後の ${mode}/${tab} をqueryから復元して消費する`,async t=>{
 const h=await shell(t,{query:`?insightMode=${mode}&insightTab=${tab}&analysisPanel=notifications`});
 assert.equal(h.w.history.state.insightMode,mode);assert.equal(h.w.history.state.insightTab,tab);
 assert.ok(h.w.document.querySelector('.miv5.mode-'+mode));
 const q=new URLSearchParams(h.w.location.search);assert.equal(q.has('insightMode'),false);assert.equal(q.has('insightTab'),false);assert.equal(q.get('analysisPanel'),'notifications');
 assert.equal(h.calls.length,1,'復帰のための余分なデータ通信を追加しない');
});

test('DMの旧mode指定をnormal/dmへ変換し、不正なタブを採用しない',async t=>{
 const dm=await shell(t,{query:'?insightMode=dm'});assert.equal(dm.w.history.state.insightMode,'normal');assert.equal(dm.w.history.state.insightTab,'dm');
 const bad=await shell(t,{query:'?insightMode=normal&insightTab=__proto__',state:{insightTab:'also-invalid'}});assert.equal(bad.w.history.state.insightMode,'normal');assert.equal(bad.w.history.state.insightTab,'likes');
});

test('読込中に選んだ有効pending tabが復帰queryに優先し、履歴のtabも復元する',async t=>{
 const h=await shell(t,{query:'?insightMode=analysis&insightTab=dm',state:{insightPendingTab:'articles'}});assert.equal(h.w.history.state.insightMode,'normal');assert.equal(h.w.history.state.insightTab,'articles');assert.equal(h.w.history.state.insightPendingTab,undefined);
 const history=await shell(t,{state:{insightMode:'normal',insightTab:'commentRanking'}});assert.equal(history.w.history.state.insightTab,'commentRanking');
});

test('画面内で項目を変更した後の更新リンクにも現在のmode/tab/accountを埋め込む',async t=>{
 const h=await shell(t,{query:'?insightMode=social&insightTab=social&token=must-not-copy'});
 await settle(()=>h.w.dispatchEvent(new h.w.CustomEvent('mumei-insight-select-item',{detail:'supporters'})));
 const settings=new URL(h.w.document.querySelector('a[aria-label="分析設定"]').href),back=new URL(settings.searchParams.get('return'));
 assert.equal(back.searchParams.get('insightMode'),'normal');assert.equal(back.searchParams.get('insightTab'),'supporters');assert.equal(back.searchParams.get('account'),'tester');assert.equal(back.searchParams.has('token'),false);assert.equal(back.hash,'#dashboard');
});

test('明示された復帰先を初期TOP補正が後から上書きしない',async t=>{
 const h=await shell(t,{query:'?insightMode=analysis&insightTab=likes&analysisPanel=verdict'});
 h.load('src/insight-source-boundaries.ts');await React.act(async()=>new Promise(resolve=>setTimeout(resolve,300)));
 assert.equal(h.w.history.state.insightMode,'analysis');assert.equal(h.w.history.state.insightTab,'likes');assert.ok(h.w.document.querySelector('.miv5.mode-analysis'));assert.equal(new URLSearchParams(h.w.location.search).get('analysisPanel'),'verdict');
});

test('境界moduleの読込後に利用者が選んだ項目も、遅いshell mountで上書きしない',async t=>{
 const h=await shell(t,{beforeRender:h=>{h.load('src/insight-source-boundaries.ts');h.w.history.replaceState({insightPendingTab:'notifications'},'',h.w.location.href)}});
 await React.act(async()=>new Promise(resolve=>setTimeout(resolve,330)));
 assert.equal(h.w.history.state.insightMode,'notifications');assert.equal(h.w.history.state.insightTab,'notifications');assert.ok(h.w.document.querySelector('.miv5.mode-notifications'));
});

test('DMから分析へ移動しpanelを選んだ後のクリックで、表示中の分析と現在本人へ戻る',async t=>{
 const h=await shell(t,{query:'?insightMode=normal&insightTab=dm&account=stale_account'});
 await settle(()=>h.w.dispatchEvent(new h.w.CustomEvent('mumei-insight-open-mode',{detail:'analysis'})));
 h.w.history.replaceState({...h.w.history.state,analysisPanel:'verdict'},'','?analysisPanel=verdict&account=stale_account#dashboard');
 const captureClick=async()=>{const gear=h.w.document.querySelector('a[aria-label="分析設定"]');gear.addEventListener('click',e=>e.preventDefault(),{once:true});await settle(()=>gear.click());return new URL(new URL(gear.href).searchParams.get('return'))};
 const current=await captureClick();assert.equal(current.searchParams.get('insightMode'),'analysis');assert.equal(current.searchParams.get('analysisPanel'),'verdict');assert.equal(current.searchParams.get('account'),'tester');
 await settle(()=>h.w.dispatchEvent(new h.w.CustomEvent('mumei-insight-select-item',{detail:'articles'})));assert.equal(h.w.history.state.analysisPanel,undefined);
 await settle(()=>h.w.dispatchEvent(new h.w.CustomEvent('mumei-insight-open-mode',{detail:'analysis'})));
 const menu=await captureClick();assert.equal(menu.searchParams.get('insightMode'),'analysis');assert.equal(menu.searchParams.has('analysisPanel'),false,'分析一覧へ戻った後に古い総合判定を復活させない');
});

test('通知のtopリンクと捕捉routeが履歴だけの現在tabを復帰先へ渡す',async t=>{
 const h=await shell(t,{query:'?insightMode=normal&insightTab=articles'});
 h.w.matchMedia=()=>({matches:true});h.w.document.body.insertAdjacentHTML('beforeend','<div class="miu"><a href="https://note.com/tester">@tester</a></div><div class="miv5-update"><div class="miv5-source-grid"><div class="miv5-source-card notice"><button class="miv5-source-main"></button></div></div></div>');
 h.load('src/insight-top-install-v16.ts');await React.act(async()=>new Promise(resolve=>setTimeout(resolve,50)));
 const link=h.w.document.querySelector('.notice a.mumei-canonical-install'),back=new URL(new URL(link.href).searchParams.get('return'));
 assert.equal(back.searchParams.get('insightMode'),'normal');assert.equal(back.searchParams.get('insightTab'),'articles');assert.equal(back.searchParams.get('account'),'tester');
 const source=compile(readFileSync('src/insight-notification-update-route-v1.ts','utf8')),nav=[];
 const adapter=h.load('src/insight-update-return.ts');vm.runInNewContext(source,{exports:{},require:name=>{assert.equal(name,'./insight-update-return');return adapter},window:h.w,document:h.w.document,location:{href:h.w.location.href,assign:value=>nav.push(value)},URL});
 link.click();assert.equal(nav.length,1);const captured=new URL(new URL(nav[0]).searchParams.get('return'));assert.equal(captured.searchParams.get('insightTab'),'articles');
});

test('共有helperが読み込めなくても復帰先へ秘密queryをコピーせず本体を落とさない',()=>{
 const dom=new JSDOM('',{url:'https://mumei-s.github.io/note-insight/?token=secret&accessIntent=switch#access/insight'}),exports={};
 try{vm.runInNewContext(compile(readFileSync('src/insight-update-return.ts','utf8')),{exports,window:dom.window});assert.equal(exports.captureInsightReturn({mode:'analysis'}),'https://mumei-s.github.io/note-insight/#dashboard');assert.equal(exports.resolveInsightReturn('https://evil.test'),'https://mumei-s.github.io/note-insight/#dashboard')}finally{dom.window.close()}
});

test('DM更新リンクは外側の履歴にかかわらずnormal/dmと本人を引き継ぐ',async t=>{
 const h=await sceneFixture(t,{fetch:async(_url,init)=>{const action=JSON.parse(init.body).action;return Response.json(action==='people'?{ok:true,rows:[]}:action==='stats'?{ok:true,paired:false}:{ok:true,messages:0,readerStatus:[]})},dependencies:{
  './creator-avatar':{CreatorAvatar:()=>null},'./insight-account-store':{INSIGHT_TOKEN_KEY:'fixture-token',currentStoredInsightAccount:()=>({noteId:'tester'})},
  './insight-release':{CURRENT_DM_VERSION:'1.4.12',fetchInsightRelease:async()=>({dmVersion:'1.4.12'}),versionDiffers:()=>false},
 }});
 h.w.localStorage.setItem('fixture-token','fixture');h.w.history.replaceState({insightMode:'normal',insightTab:'likes'},'','?token=secret#dashboard');
 vm.runInNewContext(helper(),{window:h.w,document:h.w.document,history:h.w.history,location:h.w.location,localStorage:h.w.localStorage,sessionStorage:h.w.sessionStorage,URL});
 await h.render(h.load('src/member-insight-dm.tsx').MemberInsightDm,{});await settle();
 const install=new URL(h.w.document.querySelector('a[href*="dm-browser-install.html"]').href),back=new URL(install.searchParams.get('return'));
 assert.equal(install.searchParams.get('account'),'tester');assert.equal(back.searchParams.get('insightMode'),'normal');assert.equal(back.searchParams.get('insightTab'),'dm');assert.equal(back.searchParams.get('account'),'tester');assert.equal(back.searchParams.has('token'),false);
});
