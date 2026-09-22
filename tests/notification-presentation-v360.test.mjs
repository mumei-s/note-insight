import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {JSDOM} from 'jsdom';
import * as React from 'react';
import * as jsx from 'react/jsx-runtime';
import {createRoot} from 'react-dom/client';
const {act}=React;
async function component(file,ctx,stubs={}){
 const source=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
 const mod=new vm.SourceTextModule(source,{context:ctx,initializeImportMeta(meta){meta.env={BASE_URL:"/note-insight/"}}});
 await mod.link(async name=>{const data=name==='react'?React:name==='react/jsx-runtime'?jsx:name.endsWith('.css')?{}:stubs[name];if(!data)throw new Error('Missing test stub '+name);const m=new vm.SyntheticModule(Object.keys(data),function(){for(const [k,v]of Object.entries(data))this.setExport(k,v)},{context:ctx});return m});await mod.evaluate();return mod.namespace;
}
function setup(){const dom=new JSDOM('<main id="root"></main>',{url:'https://mumei-s.github.io/note-insight/'});Object.defineProperty(dom.window.document,'visibilityState',{value:'visible'});for(const key of ['window','document','localStorage','HTMLElement','Element'])globalThis[key]=dom.window[key];globalThis.IS_REACT_ACT_ENVIRONMENT=true;const ctx=vm.createContext({window:dom.window,document:dom.window.document,localStorage:dom.window.localStorage,sessionStorage:dom.window.sessionStorage,location:dom.window.location,URL,URLSearchParams,AbortController,DOMException,Event:dom.window.Event,requestAnimationFrame:fn=>fn(),console,fetch:(...a)=>globalThis.fetch(...a)});localStorage.setItem('token','test-only');return{dom,ctx,root:createRoot(document.getElementById('root'))}}
const stubs={'./insight-account-store':{INSIGHT_TOKEN_KEY:'token',currentStoredInsightAccount:()=>({noteId:'tester'})}};
test('アイコン通信が止まっても本文を表示し、カテゴリ切替時に保存済みプレビューを即表示',async()=>{
 const h=setup();let feeds=0,blockFeed=false;
 const make=(id,kind,text)=>({id,notification_type:kind,display_category:kind,raw_text:text,actor_name:'人物',actor_url:'https://note.com/person',occurred_at:'2026-09-21T09:00:00Z'}),a=make('a','rating','記事を高評価しました'),b=make('b','purchase','記事が購入されました');
 globalThis.fetch=async(url)=>{if(String(url).includes('creator-icons')||blockFeed)return new Promise(()=>{});feeds++;return{ok:true,json:async()=>({ok:true,noteId:'tester',rows:[a],total:2,categoryCounts:{all:2,rating:1,purchase:1},categoryPreview:{rating:[a],purchase:[b]},unknownKinds:[]})}};
 const {MemberInsightNotificationsFinal:C}=await component('src/member-insight-notifications-final.tsx',h.ctx,stubs);
 await act(async()=>{h.root.render(React.createElement(C,{noteId:'tester'}));await new Promise(r=>setTimeout(r,30))});
 assert.match(document.body.textContent,/記事を高評価しました/);assert.doesNotMatch(document.body.textContent,/通知を読み込み中/);
 blockFeed=true;const select=document.querySelector('.minf-filter-panel select');
 await act(async()=>{select.value='purchase';select.dispatchEvent(new window.Event('change',{bubbles:true}))});
 assert.match(document.querySelector('.minf-list').textContent,/記事が購入されました/);assert.doesNotMatch(document.body.textContent,/通知を読み込み中/);
 await act(async()=>h.root.unmount());h.dom.window.close();assert.ok(feeds>=1);
});
test('再分類は同じカーソルが返れば停止する（無限ループしない）',async()=>{
 const h=setup();let reclass=0;
 globalThis.fetch=async(url)=>({ok:true,json:async()=>String(url).includes('reclassify')?(reclass++,{ok:true,checked:100,moved:0,nextCursor:'same'}):{ok:true,noteId:'tester',rows:[],total:0,categoryCounts:{},categoryPreview:{}}});
 const{MemberInsightNotificationsFinal:C}=await component('src/member-insight-notifications-final.tsx',h.ctx,stubs);
 await act(async()=>{h.root.render(React.createElement(C,{noteId:'tester'}));await new Promise(r=>setTimeout(r,10))});
 await act(async()=>{document.querySelector('.minf-detail-body button').click();await new Promise(r=>setTimeout(r,100))});
 assert.equal(reclass,2);assert.match(document.body.textContent,/分類位置が進まないため停止/);assert.equal(document.querySelector('.minf-detail-body button').disabled,false);
 await act(async()=>h.root.unmount());h.dom.window.close();
});
test('通知分類は既知kindを優先し、誤取得カウンターを隔離、未知本文はその他に保持',()=>{
 const file=readFileSync('supabase/functions/insight-notification-reclassify/index.ts','utf8');const start=file.indexOf('const clean='),end=file.indexOf('function noise(');const js=ts.transpileModule(file.slice(start,end)+'\nthis.classify=classify;', {compilerOptions:{module:ts.ModuleKind.None,target:ts.ScriptTarget.ES2022}}).outputText;const ctx=vm.createContext({URL});vm.runInContext(js,ctx);
 assert.equal(ctx.classify('あなたのメンバーシップに参加しました',null,{kind:'circle_plan_join'}),'membership_join');assert.equal(ctx.classify('2,647件2,647件10月18日まで',null,{}),'capture_noise');assert.equal(ctx.classify('人物さん 1分前',null,{}),'other');assert.equal(ctx.classify('記事更新',null,{kind:'purchase_note_update'}),'purchased_article_updated');
});
test('日別0件は残し、同日の重複スナップショットは合計せず最新を採用',()=>{
 const s=readFileSync('src/member-insight-analytics-pro-v3.tsx','utf8'),part=s.slice(s.indexOf('const metricValue='),s.indexOf('function TrendChart('));const code=ts.transpileModule(part+'\nthis.normalizeMetrics=normalizeMetrics;this.calendarWindow=calendarWindow;this.metricRows=metricRows;', {compilerOptions:{module:ts.ModuleKind.None,target:ts.ScriptTarget.ES2022}}).outputText,c=vm.createContext({});vm.runInContext(code,c);
 const rows=c.normalizeMetrics([{date:'2026-09-01',views:0},{date:'2026-09-21',views:3},{date:'2026-09-21',views:4}]);assert.equal(rows.length,2);assert.equal(rows[0].pageViews,0);assert.equal(rows[0].likes,null);assert.equal(rows[1].pageViews,4);assert.equal(c.calendarWindow(rows,7).length,1);assert.equal(c.metricRows({dashboard:rows}).length,0);
});

test('全履歴の集計応答が止まっていても、新着取得の本文をすぐに表示する',async()=>{
 const h=setup();let recentCalls=0;
 globalThis.fetch=async(url,init)=>{const input=JSON.parse(init?.body||'{}');if(input.action!=='recent')return new Promise(()=>{});recentCalls++;return{ok:true,json:async()=>({ok:true,noteId:'tester',watermark:'2026-09-22T00:00:00Z',rows:[{id:'fresh',notification_type:'tip',display_category:'tip',raw_text:'新しいチップが届きました',occurred_at:'2026-09-22T00:00:00Z',captured_at:'2026-09-22T00:00:00Z'}]})}};
 const{MemberInsightNotificationsFinal:C}=await component('src/member-insight-notifications-final.tsx',h.ctx,stubs);await act(async()=>{h.root.render(React.createElement(C,{noteId:'tester'}));await new Promise(r=>setTimeout(r,20))});assert.ok(recentCalls>=1);assert.match(document.querySelector('.minf-list').textContent,/新しいチップが届きました/);await act(async()=>h.root.unmount());h.dom.window.close();
});

test('フォロー一覧は最新1000人から過去の保存順1000人へ切り替えられる',async()=>{
 const h=setup(),requests=[];
 globalThis.fetch=async(url,init)=>{if(String(url).includes('creator-icons'))return new Promise(()=>{});const b=JSON.parse(init.body);requests.push(b);return{ok:true,json:async()=>({ok:true,rows:[{person_key:b.window==='oldest'?'old':'new',actor_name:b.window==='oldest'?'過去に保存した人物':'最新の人物',active:b.window!=='oldest',first_seen_at:'2026-08-01',last_seen_at:'2026-09-21'}],total:1,latest:{}})}};
 const{MemberInsightSocialV2:C}=await component('src/member-insight-social-v2.tsx',h.ctx,stubs);await act(async()=>h.root.render(React.createElement(C)));await act(async()=>{await new Promise(r=>setTimeout(r,20))});assert.match(document.querySelector('.mis2-list').textContent,/最新の人物/);
 await act(async()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='過去から1,000人').click());await act(async()=>{await new Promise(r=>setTimeout(r,20))});assert.equal(requests.at(-1).window,'oldest');assert.match(document.querySelector('.mis2-list').textContent,/過去に保存した人物/);assert.match(document.querySelector('.mis2-list').textContent,/過去の保存/);
 await act(async()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='【増】【減】履歴').click());await act(async()=>{await new Promise(r=>setTimeout(r,20))});assert.equal(requests.at(-1).action,'events');assert.equal(requests.at(-1).window,'oldest');
 await act(async()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='最新1,000人').click());await act(async()=>{await new Promise(r=>setTimeout(r,20))});assert.equal(requests.at(-1).window,'latest');
 await act(async()=>h.root.unmount());h.dom.window.close();
});

test('立体円グラフは正確な割合を保ち、凡例を選ぶと件数と割合が変わる',async()=>{
 const h=setup(),{InsightDonut:C}=await component('src/insight-donut.tsx',h.ctx);
 await act(async()=>h.root.render(React.createElement(C,{label:'内訳',items:[{label:'コメント',value:75},{label:'購入',value:25},{label:'未取得',value:0}]})));
 const arcs=[...document.querySelectorAll('.donut-slice circle')];assert.equal(arcs.length,2);const length=Number(arcs[0].getAttribute('stroke-dasharray').split(' ')[0]);assert.ok(Math.abs(length/(2*Math.PI*65)-.75)<1e-9);
 await act(async()=>document.querySelectorAll('.insight-donut-legend')[1].click());assert.equal(document.querySelector('svg text').textContent,'25');assert.match(document.querySelector('svg').textContent,/25.0%/);
 await act(async()=>h.root.render(React.createElement(C,{label:'内訳',items:[{label:'未取得',value:0}]})));assert.doesNotMatch(document.body.innerHTML,/NaN|Infinity/);
 await act(async()=>h.root.unmount());h.dom.window.close();
});

test('通知取得が止まっていても公式ダッシュボードの取得結果を先に表示する',async()=>{const h=setup();let dashboardOnly=false;globalThis.fetch=async(url,init)=>{if(String(url).includes('notification-feed'))return new Promise(()=>{});dashboardOnly=JSON.parse(init.body).dashboardOnly;return{ok:true,json:async()=>({ok:true,noteId:'tester',latestDashboard:{pageViews:12345,likes:300,comments:100,capturedAt:'2026-09-22T00:00:00Z'},topArticles:[],followers:[]})}};const{MemberInsightAnalyticsProV3:C}=await component('src/member-insight-analytics-pro-v3.tsx',h.ctx,{...stubs,'./insight-release':{CURRENT_DASHBOARD_VERSION:'test',CURRENT_INSIGHT_APP_VERSION:'test',CURRENT_NOTIFICATION_VERSION:'test'},'./insight-donut':{InsightDonut:()=>React.createElement('div',null,'円グラフ')}});await act(async()=>{h.root.render(React.createElement(C));await new Promise(r=>setTimeout(r,20))});assert.equal(dashboardOnly,true);assert.match(document.body.textContent,/12,345/);assert.match(document.body.textContent,/通知との照合を更新中/);assert.ok(document.querySelector('.mipro-fold[open]'));await act(async()=>h.root.unmount());h.dom.window.close()});

test('新着のアイコン補完を行い、次の差分応答に画像がなくても消さない',async()=>{
 const h=setup(),timers=[];h.dom.window.setInterval=(fn,ms)=>{timers.push({fn,ms});return timers.length};h.dom.window.clearInterval=()=>{};
 const row={id:999,notification_type:'buzz',raw_text:'あなたの記事が話題です！',target_url:'https://note.com/person/n/n123',actor_url:'https://note.com/person',actor_name:'人物',captured_at:'2026-09-22T01:00:00Z'};let holdIcons=false;
 globalThis.fetch=async(url,init)=>{if(String(url).includes('creator-icons')){if(holdIcons)return new Promise(()=>{});return{ok:true,json:async()=>({items:[{noteId:'person',image:'https://example.test/person.jpg'}]})}}const input=JSON.parse(init?.body||'{}');return{ok:true,json:async()=>({ok:true,noteId:'tester',rows:[row],total:1,categoryCounts:{all:1,buzz:1},categoryPreview:{buzz:[row]},watermark:'2026-09-22T01:00:00Z',unknownKinds:['future_kind']})}};
 const{MemberInsightNotificationsFinal:C}=await component('src/member-insight-notifications-final.tsx',h.ctx,stubs);
 await act(async()=>{h.root.render(React.createElement(C,{noteId:'tester'}));await new Promise(r=>setTimeout(r,25))});assert.equal(document.querySelector('.minf-avatar').getAttribute('src'),'https://example.test/person.jpg');assert.doesNotMatch(document.body.textContent,/新しい通知形式|分類ルールの更新が必要/);
 holdIcons=true;await act(async()=>{timers.find(t=>t.ms===1500).fn();await new Promise(r=>setTimeout(r,10))});assert.equal(document.querySelector('.minf-avatar').getAttribute('src'),'https://example.test/person.jpg');
 await act(async()=>h.root.unmount());h.dom.window.close();
});

test('画像の読込に失敗しても通知のアイコン欄を空にしない',async()=>{
 const h=setup();globalThis.fetch=async()=>({ok:true,json:async()=>({ok:true,noteId:'tester',rows:[{id:'broken',notification_type:'image_used',raw_text:'画像を使用しました',actor_name:'人物',actor_image_url:'https://example.test/broken.jpg',captured_at:'2026-09-22T02:00:00Z'}],total:1})});
 const{MemberInsightNotificationsFinal:C}=await component('src/member-insight-notifications-final.tsx',h.ctx,stubs);await act(async()=>{h.root.render(React.createElement(C,{noteId:'tester'}));await new Promise(r=>setTimeout(r,10))});const avatar=document.querySelector('.minf-avatar');assert.equal(avatar.tagName,'IMG');await act(async()=>avatar.dispatchEvent(new window.Event('error')));assert.ok(document.querySelector('.minf-avatar.fallback'));assert.match(document.body.textContent,/画像の使用/);await act(async()=>h.root.unmount());h.dom.window.close();
});
