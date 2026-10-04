import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import {JSDOM} from 'jsdom';
import * as React from 'react';
import * as jsx from 'react/jsx-runtime';
import {createRoot} from 'react-dom/client';
const {act}=React;
async function component(file,ctx,stubs={}){
 const modules=new Map();
 function load(file){
  const path=resolve(file);if(modules.has(path))return modules.get(path);
  const exports={};modules.set(path,exports);
  const source=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText.replaceAll('import.meta.env.BASE_URL',JSON.stringify('/note-insight/'));
  const require=name=>{if(name==='react')return React;if(name==='react/jsx-runtime')return jsx;if(name.endsWith('.css'))return{};if(name in stubs)return stubs[name];const base=resolve(dirname(path),name);return load(base+(existsSync(base+'.ts')?'.ts':'.tsx'))};
  vm.compileFunction(source,['exports','require'],{parsingContext:ctx,filename:path})(exports,require);return exports;
 }
 return load(file);
}
function setup(){const dom=new JSDOM('<main id="root"></main>',{url:'https://mumei-s.github.io/note-insight/'});Object.defineProperty(dom.window.document,'visibilityState',{value:'visible'});for(const key of ['window','document','localStorage','HTMLElement','Element'])globalThis[key]=dom.window[key];globalThis.IS_REACT_ACT_ENVIRONMENT=true;const ctx=vm.createContext({window:dom.window,document:dom.window.document,localStorage:dom.window.localStorage,sessionStorage:dom.window.sessionStorage,location:dom.window.location,URL,URLSearchParams,AbortController,DOMException,Event:dom.window.Event,requestAnimationFrame:fn=>fn(),setTimeout,clearTimeout,console,fetch:(...a)=>globalThis.fetch(...a)});localStorage.setItem('token','test-only');return{dom,ctx,root:createRoot(document.getElementById('root'))}}
const stubs={'./member-insight-analysis-ranking':{ArticleRanking:()=>null},'./member-insight-analysis-history':{SavedHistory:()=>null},'./member-insight-analysis-growth':{GrowthAnalysis:()=>null},'./insight-account-store':{INSIGHT_TOKEN_KEY:'token',currentStoredInsightAccount:()=>({noteId:'tester'}),readStoredInsightAccounts:()=>[{noteId:'tester',memberToken:'test-only'}]},'./insight-member-db-fallback':{memberDbReadFallback:async()=>{throw new Error('fixture-fallback')},memberReadAuthFailure:()=>false}};
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
 const h=setup();let reclass=0;const requests=[];
 globalThis.fetch=async(url,init)=>({ok:true,json:async()=>String(url).includes('reclassify')?(requests.push(JSON.parse(init.body)),reclass++,{ok:true,checked:100,moved:0,nextCursor:'same'}):{ok:true,noteId:'tester',rows:[],total:0,categoryCounts:{},categoryPreview:{}}});
 const{MemberInsightNotificationsFinal:C}=await component('src/member-insight-notifications-final.tsx',h.ctx,stubs);
 await act(async()=>{h.root.render(React.createElement(C,{noteId:'tester'}));await new Promise(r=>setTimeout(r,10))});
 await act(async()=>{document.querySelector('.minf-detail-body button').click();await new Promise(r=>setTimeout(r,100))});
 assert.equal(reclass,2);assert.ok(requests.every(r=>r.onlyPending===true));assert.match(document.body.textContent,/分類位置が進まないため停止/);assert.equal(document.querySelector('.minf-detail-body button').disabled,false);
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

test('相互照合は下から始まり、最新順・減の絞り込み・個別履歴へ切り替えられる',async t=>{
 const h=setup(),requests=[];
 t.after(async()=>{await act(async()=>h.root.unmount());h.dom.window.close()});
 globalThis.fetch=async(url,init)=>{if(String(url).includes('creator-icons'))return new Promise(()=>{});const b=JSON.parse(init.body);requests.push(b);return{ok:true,json:async()=>({ok:true,rows:[{person_key:b.window==='oldest'?'old':'new',actor_name:b.window==='oldest'?'一覧の下の人物':'最新の人物',relation:'following_only',is_following:true,is_follower:false,active:true,first_seen_at:'2026-08-01',last_seen_at:'2026-09-21'}],total:1,latest:{}})}};
 const{MemberInsightSocialV2:C}=await component('src/member-insight-social-v2.tsx',h.ctx,stubs);await act(async()=>h.root.render(React.createElement(C)));await act(async()=>{await new Promise(r=>setTimeout(r,20))});assert.equal(requests.at(-1).action,'comparison');assert.equal(requests.at(-1).window,'oldest');assert.match(document.querySelector('.mis2-list').textContent,/一覧の下の人物/);
 await act(async()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='最新1,000人').click());await act(async()=>{await new Promise(r=>setTimeout(r,20))});assert.equal(requests.at(-1).window,'latest');assert.match(document.querySelector('.mis2-list').textContent,/最新の人物/);
 await act(async()=>{const s=document.querySelector('.mis2-relationship-filter select');s.value='lost';s.dispatchEvent(new window.Event('change',{bubbles:true}))});await act(async()=>{await new Promise(r=>setTimeout(r,20))});assert.equal(requests.at(-1).relationship,'lost');
 await act(async()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='個別の履歴').click());await act(async()=>{await new Promise(r=>setTimeout(r,20))});assert.equal(requests.at(-1).action,'people');assert.equal(requests.at(-1).window,'latest');
 await act(async()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='過去から1,000人').click());await act(async()=>{await new Promise(r=>setTimeout(r,20))});assert.equal(requests.at(-1).window,'oldest');assert.match(document.querySelector('.mis2-list').textContent,/一覧の下の人物/);assert.match(document.querySelector('.mis2-list').textContent,/最新照合/);
 await act(async()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='【増】【減】履歴').click());await act(async()=>{await new Promise(r=>setTimeout(r,20))});assert.equal(requests.at(-1).action,'events');assert.equal(requests.at(-1).window,'oldest');
 await act(async()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='最新1,000人').click());await act(async()=>{await new Promise(r=>setTimeout(r,20))});assert.equal(requests.at(-1).window,'latest');
});

test('立体円グラフは正確な割合を保ち、凡例を選ぶと件数と割合が変わる',async()=>{
 const h=setup(),{InsightDonut:C}=await component('src/insight-donut.tsx',h.ctx);
 await act(async()=>h.root.render(React.createElement(C,{label:'内訳',items:[{label:'コメント',value:75},{label:'購入',value:25},{label:'未取得',value:0}]})));
 const arcs=[...document.querySelectorAll('.donut-slice circle')];assert.equal(arcs.length,2);const length=Number(arcs[0].getAttribute('stroke-dasharray').split(' ')[0]);assert.ok(Math.abs(length/(2*Math.PI*65)-.75)<1e-9);
 await act(async()=>document.querySelectorAll('.insight-donut-legend')[1].click());assert.equal(document.querySelector('svg text').textContent,'25');assert.match(document.querySelector('svg').textContent,/25.0%/);
 await act(async()=>h.root.render(React.createElement(C,{label:'内訳',items:[{label:'未取得',value:0}]})));assert.doesNotMatch(document.body.innerHTML,/NaN|Infinity/);
 await act(async()=>h.root.unmount());h.dom.window.close();
});

test('通知取得が止まっていても公式ダッシュボードの取得結果を先に表示する',async()=>{const h=setup();let dashboardOnly=false;globalThis.fetch=async(url,init)=>{if(String(url).includes('notification-feed'))return new Promise(()=>{});dashboardOnly=JSON.parse(init.body).dashboardOnly;return{ok:true,json:async()=>({ok:true,noteId:'tester',latestDashboard:{pageViews:12345,likes:300,comments:100,capturedAt:'2026-09-22T00:00:00Z'},topArticles:[],followers:[]})}};const{MemberInsightAnalyticsProV3:C}=await component('src/member-insight-analytics-pro-v3.tsx',h.ctx,{...stubs,'./insight-release':{CURRENT_DASHBOARD_VERSION:'test',CURRENT_INSIGHT_APP_VERSION:'test',CURRENT_NOTIFICATION_VERSION:'test'},'./member-insight-analysis-donut':{InsightDonut:()=>React.createElement('div',null,'円グラフ')},'./member-insight-analysis-charts':{InsightColumns:()=>null,InsightScatter:()=>null},'./member-insight-analysis-summary-client':{loadNotificationSummary:()=>new Promise(()=>{})}});await act(async()=>{h.root.render(React.createElement(C));await new Promise(r=>setTimeout(r,20))});assert.equal(dashboardOnly,true);assert.match(document.body.textContent,/12,345/);assert.doesNotMatch(document.body.textContent,/通知との照合を更新中/);assert.ok(document.querySelector('.mipro-fold[open]'));await act(async()=>h.root.unmount());h.dom.window.close()});

test('新着のアイコン補完を行い、次の差分応答に画像がなくても消さない',async()=>{
 const h=setup(),timers=[];h.dom.window.setInterval=(fn,ms)=>{timers.push({fn,ms});return timers.length};h.dom.window.clearInterval=()=>{};
 const row={id:999,notification_type:'buzz',raw_text:'あなたの記事が話題です！',target_url:'https://note.com/person/n/n123',actor_url:'https://note.com/person',actor_name:'人物',captured_at:'2026-09-22T01:00:00Z'};let holdIcons=false;
 globalThis.fetch=async(url,init)=>{if(String(url).includes('creator-icons')){if(holdIcons)return new Promise(()=>{});return{ok:true,json:async()=>({items:[{noteId:'person',image:'https://example.test/person.jpg'}]})}}const input=JSON.parse(init?.body||'{}');return{ok:true,json:async()=>({ok:true,noteId:'tester',rows:[row],total:1,categoryCounts:{all:1,buzz:1},categoryPreview:{buzz:[row]},watermark:'2026-09-22T01:00:00Z',unknownKinds:['future_kind']})}};
 const{MemberInsightNotificationsFinal:C}=await component('src/member-insight-notifications-final.tsx',h.ctx,stubs);
 await act(async()=>{h.root.render(React.createElement(C,{noteId:'tester'}));await new Promise(r=>setTimeout(r,25))});assert.equal(document.querySelector('.minf-avatar').getAttribute('src'),'https://example.test/person.jpg');assert.doesNotMatch(document.body.textContent,/新しい通知形式|分類ルールの更新が必要/);
 holdIcons=true;await act(async()=>{timers.find(t=>t.ms===8000).fn();await new Promise(r=>setTimeout(r,10))});assert.equal(document.querySelector('.minf-avatar').getAttribute('src'),'https://example.test/person.jpg');
 await act(async()=>h.root.unmount());h.dom.window.close();
});

test('画像の読込に失敗しても通知のアイコン欄を空にしない',async()=>{
 const h=setup();globalThis.fetch=async()=>({ok:true,json:async()=>({ok:true,noteId:'tester',rows:[{id:'broken',notification_type:'image_used',raw_text:'画像を使用しました',actor_name:'人物',actor_image_url:'https://example.test/broken.jpg',captured_at:'2026-09-22T02:00:00Z'}],total:1})});
 const{MemberInsightNotificationsFinal:C}=await component('src/member-insight-notifications-final.tsx',h.ctx,stubs);await act(async()=>{h.root.render(React.createElement(C,{noteId:'tester'}));await new Promise(r=>setTimeout(r,10))});const avatar=document.querySelector('.minf-avatar');assert.equal(avatar.tagName,'IMG');await act(async()=>avatar.dispatchEvent(new window.Event('error')));assert.ok(document.querySelector('.minf-avatar.fallback'));assert.match(document.body.textContent,/画像の使用/);await act(async()=>h.root.unmount());h.dom.window.close();
});

const analysisStubs={...stubs,'./insight-release':{CURRENT_DASHBOARD_VERSION:'test',CURRENT_INSIGHT_APP_VERSION:'test',CURRENT_NOTIFICATION_VERSION:'test'},'./member-insight-analysis-donut':{InsightDonut:()=>null},'./member-insight-analysis-charts':{InsightColumns:()=>null,InsightScatter:()=>null},'./member-insight-analysis-summary-client':{loadNotificationSummary:async()=>({dailyCounts:[],total:0})}};
test('分析全体を期間別に切替え、未取得の全期間に28日を流用せず、noteへの自動取得リンクを作る',async()=>{
 const h=setup(),requests=[];const data={noteId:'tester',selectedPeriod:'month',periodAvailable:true,availablePeriods:['month'],latestDashboard:{pageViews:280,likes:0,comments:0,capturedAt:'2026-09-27T02:38:00Z',periodStart:'2026-08-31',periodEnd:'2026-09-27'},topArticles:[],followers:[],dailyMetrics:Array.from({length:28},(_,i)=>({date:new Date(Date.UTC(2026,7,31+i)).toISOString().slice(0,10),pageViews:10,likes:0}))};
 globalThis.fetch=async(url,init)=>{const body=JSON.parse(init.body);requests.push({url,body});return {ok:true,json:async()=>body.period==='month'?data:{noteId:'tester',selectedPeriod:body.period,periodAvailable:false,availablePeriods:['month'],latestDashboard:null,dailyMetrics:[],topArticles:[]}}};
 const{MemberInsightAnalyticsProV3:C}=await component('src/member-insight-analytics-pro-v3.tsx',h.ctx,analysisStubs);
 try{
  await act(async()=>{h.root.render(React.createElement(C));await new Promise(r=>setTimeout(r,20))});assert.match(document.querySelector('.mipro-coverage-count').textContent,/28 \/ 28日/);
  await act(async()=>{[...document.querySelectorAll('.mipro-period-picker button')].find(b=>b.textContent.startsWith('全期間')).click();await new Promise(r=>setTimeout(r,20))});assert.equal(requests.at(-1).body.period,'all');assert.equal(document.querySelector('.mipro-trend'),null);assert.match(document.querySelector('.mipro-empty-period').textContent,/まだ取り込まれていません/);
  const link=new URL(document.querySelector('.mipro-empty-period a').href);assert.equal(link.searchParams.get('period'),'all');assert.equal(link.searchParams.get('auto'),'1');assert.equal(link.searchParams.get('account'),'tester');assert.ok(requests.every(r=>['analysis','follower-count'].includes(r.body.action)));
  await act(async()=>{[...document.querySelectorAll('.mipro-period-picker button')].find(b=>b.textContent.startsWith('28日')).click();await new Promise(r=>setTimeout(r,20))});assert.match(document.querySelector('.mipro-coverage-count').textContent,/28 \/ 28日/);
 }finally{await act(async()=>h.root.unmount());h.dom.window.close()}
});
test('全期間は公式の月別座標で描画し、日別28日の実績に置換しない',async()=>{
 const h=setup(),data={noteId:'tester',latestDashboard:{periodType:'all',pageViews:1000,chartSeries:[{granularity:'MONTH',startDate:'2025-01-01',endDate:'2025-01-31',pageViews:600},{granularity:'MONTH',startDate:'2025-02-01',endDate:'2025-02-28',pageViews:400}]},topArticles:[],dailyMetrics:[]};localStorage.setItem('mumei-analysis-period:tester','all');globalThis.fetch=async()=>({ok:true,json:async()=>data});const{MemberInsightAnalyticsProV3:C}=await component('src/member-insight-analytics-pro-v3.tsx',h.ctx,analysisStubs);
 try{await act(async()=>{h.root.render(React.createElement(C));await new Promise(r=>setTimeout(r,20))});assert.match(document.querySelector('.mipro-trend-head').textContent,/全期間.*月別/);assert.match(document.querySelector('.mipro-chart-period').textContent,/2025-01-01.*2025-02-28/);assert.match(document.querySelector('.mipro-coverage-count').textContent,/2 \/ 2点/);assert.match(document.querySelector('.mipro-trend-kpis').textContent,/1,000/);assert.doesNotMatch(document.body.innerHTML,/NaN|Infinity/)}finally{await act(async()=>h.root.unmount());h.dom.window.close()}
});

test('INSIGHT成長分析は単日の突出と継続した底上げを分け、当日・欠損・前週0を誤判定しない',async()=>{
 const ctx=vm.createContext({}),c=await component('src/member-insight-analysis-growth.tsx',ctx);
 const rows=(now,before=Array(7).fill(10))=>[...before,...now].map((pageViews,i)=>({date:new Date(Date.UTC(2026,8,13+i)).toISOString().slice(0,10),pageViews}));
 const spike=c.growthPerspective([...rows([9,9,9,9,9,9,110]),{date:'2026-09-27',pageViews:99999}],'2026-09-27');
 assert.equal(spike.complete,true);assert.equal(spike.current,164);assert.equal(spike.previous,70);assert.equal(spike.currentMedian,9);assert.equal(spike.improved,1);assert.equal(spike.end,'2026-09-26');assert.equal(spike.title,'増加は一部の日に集中');
 const broad=c.growthPerspective(rows(Array(7).fill(20)),'2026-09-27');assert.match(broad.title,/日々のPVも底上げ/);assert.equal(broad.improved,7);assert.equal(broad.currentMedian,20);
 const missingRows=rows(Array(7).fill(20));missingRows[3].pageViews=null;const missing=c.growthPerspective(missingRows,'2026-09-27');assert.equal(missing.complete,false);assert.equal(missing.known,13);assert.equal(missing.title,undefined);
 const zero=c.growthPerspective(rows(Array(7).fill(0),Array(7).fill(0)),'2026-09-27');assert.equal(zero.complete,true);assert.equal(zero.current,0);assert.equal(zero.topShare,0);assert.match(zero.title,/横ばい/);
 assert.equal(c.growthPerspective([{date:'2026-09-27',pageViews:8}],'2026-09-27'),null);
});
test('前週比較グラフはタップした日の両方の値と差を示し、0始まりでも無限の成長率を出さない',async()=>{
 const h=setup(),c=await component('src/member-insight-analysis-growth.tsx',h.ctx),rows=Array.from({length:14},(_,i)=>({date:new Date(Date.UTC(2026,8,13+i)).toISOString().slice(0,10),pageViews:i<7?0:i}));
 try{
  await act(async()=>h.root.render(React.createElement(c.GrowthAnalysis,{rows,today:'2026-09-27'})));
  assert.match(document.body.textContent,/前週0のため率なし/);assert.equal(document.querySelectorAll('.mipro-growth-bars button').length,7);
  await act(async()=>document.querySelector('.mipro-growth-bars button').click());assert.match(document.querySelector('.mipro-growth-readout').textContent,/2026-09-20：7 PV.*2026-09-13：0 PV.*差：\+7 PV/);assert.doesNotMatch(document.body.innerHTML,/NaN|Infinity/);
 }finally{await act(async()=>h.root.unmount());h.dom.window.close()}
});

test('運営者の形式案内は詳細内に収納し、分類後に対象がなくなれば消える',async()=>{
 const h=setup();let unresolved=true;const ownerStubs={...stubs,'./insight-account-store':{INSIGHT_TOKEN_KEY:'token',currentStoredInsightAccount:()=>({noteId:'ss_yr'})}};
 globalThis.fetch=async(url)=>({ok:true,json:async()=>String(url).includes('format-reviews')?{ok:true,alerts:unresolved?[{kind:'future_kind',notification_count:1}]:[]}:{ok:true,noteId:'ss_yr',rows:[],total:0,categoryCounts:{}}});
 const {MemberInsightNotificationsFinal:C}=await component('src/member-insight-notifications-final.tsx',h.ctx,ownerStubs);await act(async()=>{h.root.render(React.createElement(C,{noteId:'ss_yr'}));await new Promise(r=>setTimeout(r,20))});
 assert.ok(document.querySelector('.minf-detail .minf-owner-formats'));assert.equal(document.querySelector('.minf-owner-formats').open,false);assert.equal(document.querySelector('.minf-detail').open,false);
 unresolved=false;await act(async()=>{window.dispatchEvent(new window.Event('mumei-notification-classified'));await new Promise(r=>setTimeout(r,10))});assert.equal(document.querySelector('.minf-owner-formats'),null);await act(async()=>h.root.unmount());h.dom.window.close();
});

test('最高・最低は表示期間と独立し、未取得と当日の途中値を記録に混ぜない',async()=>{
 const c=await component('src/member-insight-analysis-history.tsx',vm.createContext({}),{'./member-insight-analysis-charts':{InsightColumns:()=>null}});
 const data=[{date:'2025-01-01',pageViews:999},{date:'2026-09-01',pageViews:0},{date:'2026-09-02',pageViews:null},{date:'2026-09-25',pageViews:30},{date:'2026-09-26',pageViews:40},{date:'2026-09-27',pageViews:9999}];
 const stats=c.historyStats(data,'pageViews','2026-09-27',7);assert.equal(stats.max,999);assert.equal(stats.min,0);assert.equal(stats.selected.length,2);assert.equal(stats.average,35);assert.equal(stats.all.length,4);assert.equal(c.historyStats(data,'pageViews','2026-09-27',0).selected.length,4);
});

test('記事ランキングはスキとコメントを実数表示し、全記事へ続きを開ける',async()=>{
 const h=setup(),articles=Array.from({length:15},(_,i)=>({article_key:String(i),title:'長いタイトルでも省略せず表示する記事 '+i,pageViews:100+i,likes:i,comments:i+1,salesYen:i*100,score:90-i,conversion:5,reactionsPer1k:30}));
 const{ArticleRanking:C}=await component('src/member-insight-analysis-ranking.tsx',h.ctx);await act(async()=>h.root.render(React.createElement(C,{articles})));
 assert.equal(document.querySelectorAll('.mipro-ranking li').length,12);assert.match(document.querySelector('.mipro-ranking li').textContent,/スキ0 件コメント1 件/);assert.equal(document.querySelector('.mipro-table'),null);
 await act(async()=>{const s=document.querySelector('.mipro-ranking select');s.value='likes';s.dispatchEvent(new window.Event('change',{bubbles:true}))});assert.match(document.querySelector('.mipro-ranking li header').textContent,/記事 14/);
 await act(async()=>document.querySelector('.mipro-ranking-more').click());assert.equal(document.querySelectorAll('.mipro-ranking li').length,15);assert.match(document.querySelector('.mipro-ranking li details').textContent,/1,000回読まれたときの反応数/);await act(async()=>h.root.unmount());h.dom.window.close();
});

test('両方の分析レイヤーは立体円グラフの正確な比率と実数を共有し、値なしを0%と表示しない',async()=>{
 const h=setup(),{InsightDonut:C}=await component('src/member-insight-analysis-donut.tsx',h.ctx);await act(async()=>h.root.render(React.createElement(C,{label:'構成比',items:[{label:'スキ',value:75},{label:'コメント',value:25}]})));
 const slice=document.querySelector('.donut-slice circle').getAttribute('stroke-dasharray').split(' ').map(Number);assert.ok(Math.abs(slice[0]/(slice[0]+slice[1])-.75)<1e-12);assert.match(document.querySelector('figcaption').textContent,/75件75.0%/);assert.ok(document.querySelector('.donut-object'));
 await act(async()=>h.root.render(React.createElement(C,{label:'構成比',items:[{label:'スキ',value:0}]})));assert.match(document.body.textContent,/計算できる値がありません/);assert.doesNotMatch(document.body.textContent,/0.0%/);await act(async()=>h.root.unmount());h.dom.window.close();
});


test('先頭は最終保存のクリエイターになり、再表示でも差分位置と保存順を維持する',async()=>{
 const h=setup();const rows=[{id:'old',notification_type:'rating',raw_text:'更新時の人物さんが高評価しました',actor_name:'更新時の人物',captured_at:'2026-09-20T00:00:00Z',occurred_at:'2027-01-01T00:00:00Z'},{id:'last',notification_type:'rating',raw_text:'最終保存の人物さんが高評価しました',actor_name:'最終保存の人物',captured_at:'2026-10-04T00:00:00Z',occurred_at:'2026-09-21T00:00:00Z'}];
 localStorage.setItem('mumei-notification-board:tester',JSON.stringify(rows));localStorage.setItem('mumei-notification-recent-watermark:tester','2026-10-04T00:00:00Z');const requests=[];
 globalThis.fetch=async(url,init)=>{if(String(url).includes('creator-icons'))return{ok:true,json:async()=>({items:[]})};const body=JSON.parse(init?.body||'{}');requests.push(body);return{ok:true,json:async()=>({ok:true,noteId:'tester',rows:body.action==='recent'?[]:rows,total:2,categoryCounts:{all:2,rating:2},watermark:'2026-10-04T00:00:00Z'})}};
 const{MemberInsightNotificationsFinal:C}=await component('src/member-insight-notifications-final.tsx',h.ctx,stubs);
 await act(async()=>{h.root.render(React.createElement(C,{noteId:'tester'}));await new Promise(r=>setTimeout(r,20))});
 const body=document.querySelector('.minf-list').textContent;assert.ok(body.indexOf('最終保存の人物')<body.indexOf('更新時の人物'));assert.equal(requests.find(x=>x.action==='recent').since,'2026-10-04T00:00:00Z');
 await act(async()=>h.root.unmount());h.dom.window.close();
});
