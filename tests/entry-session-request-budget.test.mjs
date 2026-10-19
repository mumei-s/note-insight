import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as React from 'react';
import * as jsx from 'react/jsx-runtime';
import { sceneFixture, pause } from './react-scene-fixture.mjs';

const tokenKey='mumei-insight-access-token';
const account={id:'entry-account',noteId:'creator_a',displayName:'保存した本人',status:'active',imageUrl:null};
const payload=(extra={})=>({ok:true,application:{...account,displayName:'今回確認した本人',...extra}});
const deferred=()=>{let resolve;const promise=new Promise(done=>resolve=done);return{promise,resolve}};
async function settle(work=()=>{}){await React.act(async()=>{work();for(let i=0;i<7;i++)await pause()})}
function withoutImports(source){const file=ts.createSourceFile('fixture.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);for(const statement of [...file.statements].reverse())if(ts.isImportDeclaration(statement))source=source.slice(0,statement.getFullStart())+source.slice(statement.end);return source}

async function fixture(t,{mode='normal',respond=()=>Response.json(payload()),slowMount=false}={}){
 const calls=[],mounted=[],dependencies={},globals={URLSearchParams};
 const marker=name=>()=>{React.useEffect(()=>{mounted.push(name)},[]);return React.createElement('div',{'data-scene':name},name)};
 for(const [file,name]of Object.entries({'article-likes-page-v2':'ArticleLikesPageV2','combined-analytics-app':'CombinedAnalyticsApp','evidence-v2':'EvidenceV2','feature-page':'FeaturePage','hub-home':'HubHome','management-page':'ManagementPage','owner-gate':'OwnerGate','access-portal-v6':'AccessPortalV6','member-insight-unified-v4':'MemberInsightUnifiedV4','member-insight-social-v2':'MemberInsightSocialV2','member-insight-notifications-final':'MemberInsightNotificationsFinal','member-insight-analysis-hub':'MemberInsightAnalysisHub','member-insight-comments-final':'MemberInsightCommentsFinal','member-insight-favorites-final':'MemberInsightFavoritesFinal'}))dependencies['./'+file]={[name]:marker(name)};
 Object.assign(dependencies,{
  './creator-avatar':{CreatorAvatar:()=>null},'./insight-visible-motion':{useVisibleMotion:()=>({ref:null,motion:false})},'./insight-display-mode':{useInsightDisplayMode(){}},'./insight-ux-v12':{},
  './insight-release':{CURRENT_INSIGHT_APP_VERSION:'test',CURRENT_DASHBOARD_VERSION:'test',CURRENT_NOTIFICATION_VERSION:'test',NOTIFICATION_VERSION_STORAGE_KEY:'notice-version',DASHBOARD_VERSION_STORAGE_KEY:'dash-version',fetchInsightRelease:async()=>({appVersion:'test',dashboardVersion:'test',notificationVersion:'test'}),versionDiffers:()=>false},
 });
 const fetcher=async(url,init)=>{const body=JSON.parse(init.body||'{}'),call={url:String(url),body,signal:init.signal,token:init.headers?.['X-Insight-Token']};calls.push(call);if(body.action==='touch')return Response.json({ok:true});const response=await respond(call,calls.filter(x=>x.body.action==='session').length);return response.clone()};
 const h=await sceneFixture(t,{globals,dependencies,fetch:fetcher});
 Object.assign(globals,{Event:h.w.Event,CustomEvent:h.w.CustomEvent,navigator:h.w.navigator,requestAnimationFrame:callback=>h.w.requestAnimationFrame(callback)});
 Object.defineProperty(h.w.document,'visibilityState',{value:'visible',writable:true});h.w.scrollTo=()=>{};h.w.HTMLElement.prototype.scrollIntoView=()=>{};
 h.w.localStorage.setItem(tokenKey,'token-a');h.w.localStorage.setItem('mumei-insight-saved-accounts-v3',JSON.stringify([{...account,memberToken:'token-a',updatedAt:1}]));h.w.localStorage.setItem('mumei-insight-active-account-v3',account.noteId);
 h.w.history.replaceState({},'',`?insightMode=${mode}#dashboard`);
 const store=h.load('src/insight-account-store.ts'),session=h.load('src/insight-session-request.ts');
 function require(name){if(name==='react')return React;if(name==='react/jsx-runtime')return jsx;if(name.endsWith('.css'))return{};if(dependencies[name])return dependencies[name];const file='src/'+name.replace(/^\.\//,'');return h.load(file+(existsSync(file+'.ts')?'.ts':'.tsx'))}
 const context={exports:{},require,window:h.w,document:h.w.document,location:h.w.location,history:h.w.history,localStorage:h.w.localStorage,sessionStorage:h.w.sessionStorage,fetch:fetcher,URL,URLSearchParams,AbortController,setTimeout,clearTimeout,console,...globals};
 function loadSource(path){const exports={};const compiled=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText.replaceAll('import.meta.env.BASE_URL',JSON.stringify('/note-insight/'));vm.runInNewContext(compiled,{...context,exports});return exports}
 dependencies['./member-insight-live-v2']=loadSource(process.env.INSIGHT_ENTRY_SHELL_SOURCE||'src/member-insight-live-v2.tsx');
 const App=loadSource(process.env.INSIGHT_ENTRY_APP_SOURCE||'src/App.tsx').App;
 const source=readFileSync(process.env.INSIGHT_ENTRY_MAIN_SOURCE||'src/main.tsx','utf8'),startup=source.slice(0,source.indexOf('function startupFailureLabel('));
 vm.runInNewContext(ts.transpileModule(withoutImports(startup),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,{...context,...store,...session,installApiBridge(){},registerServiceWorker(){}});
 if(slowMount)await settle();
 return{...h,calls,mounted,App,store,start:()=>h.render(App),sessions:()=>calls.filter(x=>x.body.action==='session'),creator:()=>h.w.document.querySelector('.miv5-creator-copy')?.textContent};
}

for(const mode of ['normal','notifications','comments','analysis'])test(`whole ${mode} entry shares main/App auth and hands the verified identity to Live`,async t=>{
 const pending=deferred(),h=await fixture(t,{mode,respond:()=>pending.promise});await h.start();await settle();
 assert.equal(h.sessions().length,1,'main and the real App must share the pending auth request');assert.deepEqual(h.mounted,[],'no history scene before authentication');
 await settle(()=>pending.resolve(Response.json(payload())));
 assert.equal(h.sessions().length,1,'the real Live shell consumes App’s verified identity instead of checking it again');assert.match(h.creator(),/今回確認した本人/);assert.equal(h.mounted.length,1);
 await settle(()=>h.w.dispatchEvent(new h.w.Event('pageshow')));assert.equal(h.sessions().length,2,'a later resume checks again and shares main/Live demand');
});

test('auth that finished before storage hydration is checked again, while Live still avoids a third check',async t=>{
 const h=await fixture(t,{slowMount:true});assert.equal(h.sessions().length,1);await h.start();await settle();assert.equal(h.sessions().length,2);assert.match(h.creator(),/今回確認した本人/);
});

test('returning from TOP does not reuse the old App-to-Live identity handoff',async t=>{
 const pending=deferred(),h=await fixture(t,{respond:(_call,n)=>n===1?pending.promise:Response.json(payload({displayName:'復帰して確認した本人'}))});await h.start();await settle(()=>pending.resolve(Response.json(payload())));
 await settle(()=>{h.w.location.hash='';h.w.dispatchEvent(new h.w.Event('hashchange'))});await settle(()=>{h.w.location.hash='#dashboard';h.w.dispatchEvent(new h.w.Event('hashchange'))});
 assert.ok(h.sessions().length>=2);assert.match(h.creator(),/復帰して確認した本人/);
});

for(const bad of [{ok:true},{ok:true,application:{...account,noteId:'wrong_account',displayName:'違う本人'}},{ok:true,application:{...account,status:'approved',displayName:'未確認本人'}}])test('invalid initial identity never suppresses the shell’s independent verification',async t=>{
 const pending=deferred(),h=await fixture(t,{respond:(_call,n)=>n===1?pending.promise:Response.json(payload())});await h.start();await settle(()=>pending.resolve(Response.json(bad)));
 assert.equal(h.sessions().length,2);assert.match(h.creator(),/今回確認した本人/);assert.doesNotMatch(h.creator(),/違う本人|未確認本人/);
});

test('temporary failure retains offline login and still lets the shell retry identity',async t=>{
 const pending=deferred(),h=await fixture(t,{respond:(_call,n)=>n===1?pending.promise:Response.json(payload())});await h.start();await settle(()=>pending.resolve(new Response('temporarily unavailable',{status:402})));
 assert.equal(h.sessions().length,2);assert.equal(h.w.localStorage.getItem(tokenKey),'token-a');assert.match(h.creator(),/今回確認した本人/);
});

test('expired auth still leads to access screen, with no authenticated scene mounted',async t=>{
 const pending=deferred(),h=await fixture(t,{respond:()=>pending.promise});await h.start();await settle(()=>pending.resolve(Response.json({ok:false,error:'INSIGHT_SESSION_INVALID'},{status:401})));
 assert.equal(h.sessions().length,1);assert.deepEqual(h.mounted,['AccessPortalV6']);assert.equal(h.creator(),undefined);
});

for(const action of ['switch','logout'])test(`whole entry ${action} discards pending old auth before any old-account history can mount`,async t=>{
 const old=deferred(),other={...account,id:'second-id',noteId:'creator_b',displayName:'切替先の本人'};
 const h=await fixture(t,{respond:call=>call.token==='token-a'?old.promise:Response.json({ok:true,application:other})});await h.start();
 await settle(()=>{
  if(action==='switch')h.store.rememberMemberSession(other,'token-b');
  else{h.w.localStorage.setItem('mumei-insight-explicit-logout:'+account.noteId,'1');h.store.forgetMemberSession(account.noteId)}
  h.w.dispatchEvent(new h.w.Event('mumei-insight-accounts'));
 });
 if(action==='switch'){assert.match(h.creator(),/切替先の本人/);assert.equal(h.sessions().length,2);assert.equal(h.sessions()[0].signal.aborted,true)}
 else{assert.equal(h.creator(),undefined);assert.deepEqual(h.mounted,['AccessPortalV6']);assert.equal(h.w.localStorage.getItem(tokenKey),null)}
 await settle(()=>old.resolve(Response.json(payload({displayName:'遅い旧本人'}))));
 assert.equal(h.w.localStorage.getItem(tokenKey),action==='switch'?'token-b':null);assert.doesNotMatch(h.w.document.body.textContent,/遅い旧本人/);
 if(action==='switch')assert.match(h.creator(),/切替先の本人/);else assert.equal(h.creator(),undefined);
});

test('StrictMode effect replay keeps the shared entry request and still hands off identity',async t=>{
 const pending=deferred(),h=await fixture(t,{respond:()=>pending.promise});
 await h.render(()=>React.createElement(React.StrictMode,null,React.createElement(h.App)));await settle();assert.equal(h.sessions().length,1);
 await settle(()=>pending.resolve(Response.json(payload())));assert.equal(h.sessions().length,1);assert.match(h.creator(),/今回確認した本人/);
});

test('completed overlapping entry has one auth request across all three real callers',async t=>{
 const pending=deferred(),h=await fixture(t,{respond:()=>pending.promise});await h.start();await settle(()=>pending.resolve(Response.json(payload())));
 assert.equal(h.sessions().length,1,'complete main, App, and Live entry auth budget');assert.match(h.creator(),/今回確認した本人/);
});
