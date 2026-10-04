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
const application={id:'own-application',noteId:'applicant',displayName:'申請者',imageUrl:null,status:'pending'};
const appSource=readFileSync('src/App.tsx','utf8');
const activePortal=appSource.match(/import\s+\{\s*(AccessPortalV\d+)\s*\}\s+from\s+"\.\/([^"\n]+)"/);
assert.ok(activePortal,'Appが実際に使う参加画面をテストする');
assert.ok(appSource.includes(`page = <${activePortal[1]} />`));
async function fixture(t,initial=application,notified=false){
 const dom=new JSDOM('<div id="root"></div>',{url:'https://mumei-s.github.io/note-insight/'});
 for(const key of ['window','document','localStorage','sessionStorage','HTMLElement','Element','navigator'])Object.defineProperty(globalThis,key,{value:dom.window[key],configurable:true,writable:true});
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const intervals=new Map(),notices=[],requests=[],accounts=new Map([['applicant',{noteId:'applicant',applicantToken:'own-applicant-token'}]]);
 let nextTimer=0,response={...initial};
 dom.window.setInterval=(fn,ms)=>{const id=++nextTimer;intervals.set(id,{fn,ms});return id};dom.window.clearInterval=id=>intervals.delete(id);
 dom.window.Notification=class{static permission='granted';constructor(title,options){notices.push({title,...options})}};
 localStorage.setItem('mumei-insight-current-join-v5','applicant');if(notified)localStorage.setItem('mumei-application-approval-notified:own-application','saved');
 const ctx=vm.createContext({window:dom.window,document:dom.window.document,localStorage,sessionStorage,navigator,AbortController,console,fetch:async(url,init)=>{requests.push({body:JSON.parse(init.body),headers:init.headers,signal:init.signal});if(String(url).includes('reactivate'))return{ok:true,json:async()=>({ok:true,application:{...application,status:'active'},memberToken:'fixture-member'})};return{ok:true,json:async()=>typeof response==='function'?response():{ok:true,application:response}}}});
 const exports={},code=ts.transpileModule(readFileSync(`src/${activePortal[2]}.tsx`,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.compileFunction(code,['exports','require'],{parsingContext:ctx})(exports,name=>name==='react'?React:name==='react/jsx-runtime'?jsx:name.endsWith('.css')?{}:{INSIGHT_TOKEN_KEY:'member-token',consumeAccessIntent:()=>'',getStoredInsightAccount:id=>accounts.get(id),readStoredInsightAccounts:()=>[...accounts.values()],rememberApplication:()=>{},rememberApplicant:()=>{},rememberMemberSession:()=>{},forgetMemberSession:()=>{}});
 const root=createRoot(document.getElementById('root'));t.after(async()=>{await act(async()=>root.unmount());dom.window.close()});
 await act(async()=>{root.render(React.createElement(exports[activePortal[1]]));await new Promise(r=>setTimeout(r,15))});
 return{dom,root,accounts,notices,requests,intervals,setResponse:value=>response=value,check:async()=>{await act(async()=>{[...intervals.values()].find(x=>x.ms===15000)?.fn();await new Promise(r=>setTimeout(r,5))})}};
}
test('承認待ち画面で本人の承認を自動検知し、一度だけ通知して本人確認へ進む',async t=>{
 const h=await fixture(t);assert.match(document.body.textContent,/承認待ち/);assert.ok(h.requests.every(x=>x.body.action==='application-status'&&x.headers['X-Insight-Applicant']==='own-applicant-token'));
 h.setResponse({...application,status:'approved',verificationCode:'INSIGHT-TEST1234'});await h.check();
 assert.match(document.body.textContent,/@applicant の参加申請が承認されました/);assert.match(document.body.textContent,/INSIGHT-TEST1234/);assert.equal(h.notices.length,1);assert.equal(h.intervals.size,0);
 window.dispatchEvent(new window.Event('focus'));await h.check();assert.equal(h.notices.length,1);
});
test('別の申請の応答では通知せず、本人のトークンを切り替えた後の遅延応答も破棄する',async t=>{
 const h=await fixture(t);h.setResponse({...application,id:'other-application',noteId:'other-person',status:'approved'});await h.check();assert.equal(h.notices.length,0);assert.match(document.body.textContent,/承認待ち/);
 let finish;h.setResponse(()=>new Promise(r=>finish=r));await h.check();assert.equal(document.querySelector('[aria-busy="true"]')?.getAttribute('aria-busy'),'true');
 h.accounts.set('applicant',{noteId:'applicant',applicantToken:'new-token'});
 await act(async()=>{finish({ok:true,application:{...application,status:'approved'}});await new Promise(r=>setTimeout(r,5))});assert.equal(h.notices.length,0);assert.match(document.body.textContent,/承認待ち/);
 await act(async()=>h.root.unmount());assert.equal(h.intervals.size,0);
});
test('閉じた後に承認済みで開いても表示を復元し、既に通知した申請を再通知しない',async t=>{
 const h=await fixture(t,{...application,status:'approved'},true);assert.match(document.body.textContent,/承認されました/);assert.equal(h.notices.length,0);
});
test('本人確認済みの再参加者も承認を通知し、従来どおり自動再開する',async t=>{
 const h=await fixture(t);h.setResponse({...application,status:'approved',verifiedAt:'2026-09-01T00:00:00Z'});await h.check();
 assert.equal(window.location.hash,'#dashboard');assert.match(document.querySelector('.access2-approval-toast').textContent,/@applicant の参加申請が承認されました/);assert.equal(h.notices.length,1);assert.equal(h.requests.at(-1).body.action,'resume');assert.equal(h.requests.at(-1).headers['X-Insight-Applicant'],'own-applicant-token');
});
test('参加申請の通知はOWNER認証がある画面だけに表示する',async()=>{
 const source=readFileSync('src/main.tsx','utf8'),start=source.indexOf('async function pollOwnerPendingApplications()'),end=source.indexOf('\nconst insightToken',start);
 const storage=new Map(),notices=[],requests=[];let authorized=false;
 const ctx=vm.createContext({OWNER_KEY:'owner',OWNER_PENDING_SEEN_KEY:'seen',REACTIVATE:'owner-status',window:{},localStorage:{getItem:k=>storage.get(k)||'',setItem:(k,v)=>storage.set(k,v)},showAccessNotice:m=>notices.push(m),readJson:r=>r.json(),fetch:async(url,init)=>{requests.push(init);return{ok:authorized,json:async()=>({ok:authorized,count:1,items:[{id:'request',noteId:'applicant'}]})}}});
 vm.runInContext(ts.transpileModule(source.slice(start,end)+'\nthis.check=pollOwnerPendingApplications;',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,ctx);
 await ctx.check();assert.equal(requests.length,0);storage.set('owner','test-invalid');await ctx.check();assert.equal(notices.length,0);
 authorized=true;storage.set('owner','test-owner');await ctx.check();assert.equal(requests.at(-1).headers['X-Owner-Token'],'test-owner');assert.equal(notices.length,1);await ctx.check();assert.equal(notices.length,1);
});
