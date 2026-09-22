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

test('フォローから記事・スキ順位へ移動し、戻る・進むでそのカテゴリと表示を復元する',async t=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'https://mumei-s.github.io/note-insight/'}),w=dom.window;
 for(const key of ['window','document','localStorage','HTMLElement','Element'])globalThis[key]=w[key];globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.localStorage.setItem('token','fixture');w.history.replaceState({route:'dashboard',insightMode:'social',insightTab:'social',insightScrollY:100},'');
 const root=createRoot(w.document.getElementById('root'));t.after(async()=>{await act(async()=>root.unmount());dom.window.close()});
 const fetch=async(url,init)=>{const b=JSON.parse(init?.body||'{}');return{ok:true,json:async()=>b.action==='summary'?{ok:true,member:{noteId:'tester',displayName:'Tester',imageUrl:null},summary:{},analysis:{},counts:{comments:0,followers:0,followings:0,notifications:0},articles:[]}:{ok:true,member:{noteId:'tester'},rows:[],total:0,topArticles:[],latestDashboard:null}}};
 const ctx=vm.createContext({window:w,document:w.document,history:w.history,location:w.location,localStorage:w.localStorage,sessionStorage:w.sessionStorage,URL,URLSearchParams,AbortController,Event:w.Event,requestAnimationFrame:fn=>fn(),clearTimeout:w.clearTimeout.bind(w),fetch,console});
 const stub=()=>React.createElement('div',{'data-feature-stub':true});
 const data={react:React,'react/jsx-runtime':jsx,'./insight-account-store':{INSIGHT_TOKEN_KEY:'token',currentStoredInsightAccount:()=>({noteId:'tester'}),setAccessIntent(){}},'./insight-release':{CURRENT_INSIGHT_APP_VERSION:'test',NOTIFICATION_VERSION_STORAGE_KEY:'notice-version',DASHBOARD_VERSION_STORAGE_KEY:'dash-version',versionDiffers:()=>false,fetchInsightRelease:async()=>({appVersion:'test',notificationVersion:'test',dashboardVersion:'test'})},'./member-insight-dm':{MemberInsightDm:stub}};
 for(const [file,name]of [['social-v2','SocialV2'],['notifications-final','NotificationsFinal'],['analysis-hub','AnalysisHub'],['comments-final','CommentsFinal'],['favorites-final','FavoritesFinal'],['completeness','Completeness']])data['./member-insight-'+file]={['MemberInsight'+name]:stub};
 const cache=new Map();async function load(file){if(cache.has(file))return cache.get(file);const source=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;const m=new vm.SourceTextModule(source,{context:ctx,initializeImportMeta:meta=>meta.env={BASE_URL:'/note-insight/'}});cache.set(file,m);await m.link(async name=>{if(name==='./member-insight-unified-v4')return load('src/member-insight-unified-v4.tsx');if(name==='./member-insight-notifications-final')return load('src/member-insight-notifications-final.tsx');const exports=data[name]||(name.endsWith('.css')||name==='./insight-ux-v12'?{}:null);if(!exports)throw new Error('Missing fixture '+name);return new vm.SyntheticModule(Object.keys(exports),function(){for(const[k,v]of Object.entries(exports))this.setExport(k,v)},{context:ctx})});return m}
 const module=await load('src/member-insight-live-v2.tsx');await module.evaluate();await act(async()=>root.render(React.createElement(module.namespace.MemberInsightLiveV2)));await act(async()=>{await new Promise(r=>setTimeout(r,20))});
 const choose=async label=>act(async()=>[...w.document.querySelectorAll('.miu-nav button')].find(b=>b.textContent===label).click());
 const active=()=>w.document.querySelector('.miu-nav .active')?.textContent;
 assert.equal(active(),'フォロー');await choose('記事');assert.equal(active(),'記事');assert.equal(w.history.state.insightTab,'articles');assert.ok(w.document.querySelector('.miv5.mode-normal'));
 await choose('スキ順位');assert.equal(active(),'スキ順位');const length=w.history.length;await choose('スキ順位');assert.equal(w.history.length,length);
 const travel=async method=>act(async()=>{const popped=new Promise(resolve=>w.addEventListener('popstate',resolve,{once:true}));w.history[method]();await popped});
 await travel('back');assert.equal(active(),'記事');assert.ok(w.document.querySelector('.miv5.mode-normal'));
 await travel('back');assert.equal(active(),'フォロー');assert.ok(w.document.querySelector('.miv5.mode-social'));
 await travel('forward');assert.equal(active(),'記事');assert.equal(w.history.state.insightTab,'articles');
 await choose('通知');assert.equal(active(),'通知');assert.ok(w.document.querySelector('.minf'));await choose('記事');assert.deepEqual([...w.document.querySelectorAll('.miu-nav .active')].map(x=>x.textContent),['記事']);
 await choose('お気に入り');assert.equal(active(),'お気に入り');assert.ok(w.document.querySelector('.miv5.mode-favorites'));
 await travel('back');assert.equal(active(),'記事');assert.ok(w.document.querySelector('.miv5.mode-normal'));
 for(const label of ['スキ履歴','コメント','コメント順位','マガジン','DM','通知','フォロー','記事']){await choose(label);assert.deepEqual([...w.document.querySelectorAll('.miu-nav .active')].map(x=>x.textContent),[label])}
});
