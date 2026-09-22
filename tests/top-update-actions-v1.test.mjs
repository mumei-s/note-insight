import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import ts from 'typescript';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import * as React from 'react';
import * as jsx from 'react/jsx-runtime';
import {createRoot} from 'react-dom/client';
const {act}=React;
const pause=()=>new Promise(r=>setTimeout(r,20));

async function page(t,{release,fetcher,storage={},enhance=false}={}){
 const dom=new JSDOM('<div id="root"></div>',{url:'https://mumei-s.github.io/note-insight/#dashboard',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
 for(const key of ['window','document','localStorage','HTMLElement','Element'])globalThis[key]=w[key];globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.localStorage.setItem('token','first-account');
 for(const [key,value]of Object.entries(storage))w.localStorage.setItem(key,value);
 const calls=[];
 const fetch=async(url,init={})=>{calls.push({url,body:JSON.parse(init.body||'{}')});if(fetcher)return fetcher(url,init);return Response.json({ok:true,member:{noteId:'tester'},scannedArticles:3,catalog:{stored:5}})};
 const ctx=vm.createContext({window:w,document:w.document,history:w.history,location:w.location,localStorage:w.localStorage,sessionStorage:w.sessionStorage,navigator:w.navigator,URL,URLSearchParams,AbortController,Event:w.Event,requestAnimationFrame:fn=>fn(),clearTimeout:w.clearTimeout.bind(w),fetch,console});
 const stub=()=>React.createElement('div');
 const deps={react:React,'react/jsx-runtime':jsx,'./insight-account-store':{INSIGHT_TOKEN_KEY:'token'},'./insight-release':{CURRENT_INSIGHT_APP_VERSION:'1',NOTIFICATION_VERSION_STORAGE_KEY:'notice-version',DASHBOARD_VERSION_STORAGE_KEY:'dash-version',versionDiffers:(a,b)=>Number(a)<Number(b),fetchInsightRelease:release||(async()=>({appVersion:'2',notificationVersion:'1',dashboardVersion:'1'}))}};
 for(const [file,name]of [['unified-v4','UnifiedV4'],['social-v2','SocialV2'],['notifications-final','NotificationsFinal'],['analysis-hub','AnalysisHub'],['comments-final','CommentsFinal'],['favorites-final','FavoritesFinal'],['completeness','Completeness']])deps['./member-insight-'+file]={['MemberInsight'+name]:stub};
 const code=ts.transpileModule(readFileSync('src/member-insight-live-v2.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const m=new vm.SourceTextModule(code,{context:ctx,initializeImportMeta:meta=>meta.env={BASE_URL:'/note-insight/'}});
 await m.link(name=>{const exports=deps[name]||(name.endsWith('.css')||name==='./insight-ux-v12'?{}:null);if(!exports)throw Error(name);return new vm.SyntheticModule(Object.keys(exports),function(){for(const[k,v]of Object.entries(exports))this.setExport(k,v)},{context:ctx})});await m.evaluate();
 const root=createRoot(w.document.getElementById('root'));t.after(async()=>{await act(async()=>root.unmount());w.close()});
 await act(async()=>{root.render(React.createElement(m.namespace.MemberInsightLiveV2));await pause()});
 if(enhance){w.fetch=fetch;w.matchMedia=()=>({matches:true});for(const file of ['insight-dashboard-label-v19','insight-inline-updates-v1','insight-top-install-v16','insight-update-guide-v18','insight-ux-v11','insight-ux-v12','insight-ux-v13'])w.eval(`(()=>{${ts.transpileModule(readFileSync(`src/${file}.ts`,'utf8').replace('export {};',''),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText}\n})()`);await act(async()=>new Promise(r=>setTimeout(r,350)))}
 return{w,calls};
}

test('本体更新を通常データから独立させ、公開データの操作と状況表示を混ぜない',async t=>{
 let version='2';const h=await page(t,{release:async()=>({appVersion:version,notificationVersion:'1',dashboardVersion:'1'})});
 const normal=h.w.document.querySelector('.normal'),banner=h.w.document.querySelector('.miv5-app-update');
 assert.ok(banner);assert.equal(normal.querySelectorAll('button').length,1);assert.equal(normal.classList.contains('needs-update'),false);assert.doesNotMatch(normal.textContent,/本体|NEW|↑|⬆/);assert.equal(banner.closest('.miv5-source-card'),null);
 await act(async()=>{normal.querySelector('button').click();await pause()});
 assert.ok(h.calls.some(c=>c.body.action==='sync'));assert.ok(!h.calls.some(c=>c.url.includes('index.html')));
 const status=normal.querySelector('span').textContent;assert.match(status,/記事確認3件.*保存5件/);
 version='1';await act(async()=>{banner.querySelector('button').click();await new Promise(r=>setTimeout(r,720))});
 assert.equal(normal.querySelector('span').textContent,status);assert.match(h.w.document.querySelector('.miv5-app-feedback').textContent,/最新版/);assert.equal(h.w.document.querySelector('.miv5-app-update'),null);
});

test('本体の最新版照会が失敗したら更新完了を出さず、公開データ表示を維持する',async t=>{
 let checked=0;const h=await page(t,{release:async()=>{if(checked++)throw Error('offline');return{appVersion:'2',notificationVersion:'1',dashboardVersion:'1'}}});
 const status=h.w.document.querySelector('.normal span').textContent;
 await act(async()=>{h.w.document.querySelector('.miv5-app-update button').click();await pause()});
 assert.match(h.w.document.querySelector('.miv5-app-feedback').textContent,/最新版を確認できません/);assert.doesNotMatch(h.w.document.querySelector('.miv5-app-feedback').textContent,/更新完了|最新版です/);assert.equal(h.w.document.querySelector('.normal span').textContent,status);assert.equal(h.w.document.querySelector('.miv5-app-update button').disabled,false);
});

test('アカウントを切り替えた後に古い公開データの応答を適用しない',async t=>{
 let finish;const h=await page(t,{fetcher:async(url,init)=>JSON.parse(init.body||'{}').action==='sync'?new Promise(resolve=>finish=resolve):Response.json({ok:true,member:{noteId:'tester'}})});
 await act(async()=>h.w.document.querySelector('.normal button').click());
 h.w.localStorage.setItem('token','next-account');
 await act(async()=>{finish(Response.json({ok:true,scannedArticles:9876,catalog:{stored:9876}}));await pause()});
 assert.doesNotMatch(h.w.document.querySelector('.normal span').textContent,/9,876|9876|更新済み/);
});

for(const [state,installed]of [['更新','0'],['未導入','']])test(`分析の${state}はパネル自体から正しい更新画面へ進める`,async t=>{
 const {w}=await page(t,{storage:{'dash-version':installed,'notice-version':'1'},enhance:true});
 const card=w.document.querySelector('.dashboard'),action=card.querySelector('.miv5-source-main');
 assert.equal(card.classList.contains(installed?'needs-update':'needs-install'),true);assert.equal(action.tagName,'A');assert.match(action.querySelector('em').textContent,installed?/更新あり/:/未導入/);
 assert.equal(w.document.getElementById('mumei-insight-update-guide-v18'),null);
 let clicked;action.addEventListener('click',e=>{clicked={blocked:e.defaultPrevented,url:new URL(action.href)};e.preventDefault()});action.click();
 assert.equal(clicked.blocked,false);assert.equal(clicked.url.pathname,'/note-insight/dashboard-setup.html');assert.equal(clicked.url.searchParams.get('account'),'tester');assert.match(clicked.url.searchParams.get('return'),/#dashboard/);
 assert.equal(w.getComputedStyle(action).animation,'none');
 w.localStorage.setItem('dash-version','1');await act(async()=>{w.dispatchEvent(new w.Event('focus'));await new Promise(r=>setTimeout(r,350))});
 assert.equal(card.classList.contains('needs-update'),false);assert.equal(card.classList.contains('needs-install'),false);assert.equal(card.querySelector('em'),null);
 const current=card.querySelector('.miv5-source-main');assert.equal(current.tagName,'BUTTON');await act(async()=>current.click());assert.equal(w.history.state.insightMode,'analysis');
});

test('本人通知だけの更新では分析に更新ランプを付けない',async t=>{
 const {w}=await page(t,{storage:{'dash-version':'1','notice-version':'0'},enhance:true});
 assert.equal(w.document.querySelector('.notice').classList.contains('needs-update'),true);assert.equal(w.document.querySelector('.dashboard').classList.contains('needs-update'),false);assert.equal(w.document.querySelector('.dashboard .miv5-source-main').tagName,'BUTTON');assert.equal(w.document.getElementById('mumei-insight-update-guide-v18'),null);
});
