import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {webcrypto} from 'node:crypto';

const core=readFileSync('public/note-insight-dashboard-sync-core-v1.1.0.js','utf8');
const coreVersion=core.match(/const VERSION='([^']+)'/)[1];
const wrapper=readFileSync('public/note-insight-dashboard-sync.user.js','utf8');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
function page(t,markup,{paired=true,identity=()=>'tester',stats=async()=>({}),before,after,watchHref=false,url='https://note.com/sitesettings/stats'}={}){
  const dom=new JSDOM(`<main><h1>アクセス状況</h1>${markup}</main>`,{url,runScripts:'outside-only'}),w=dom.window,saves=[],nav=[],diagnostics=[],warnings=[];
  t.after(()=>w.close());
  Object.defineProperty(w.crypto,'subtle',{value:webcrypto.subtle});w.TextEncoder=TextEncoder;
  Object.defineProperty(w.document.body,'innerText',{get(){return this.textContent}});
  w.performance.getEntriesByType=()=>[];
  const statusObserver=new w.MutationObserver(()=>{const status=w.document?.querySelector('#mumei-dashboard-sync .status');if(status?.dataset.kind==='warn'&&warnings.at(-1)!==status.textContent)warnings.push(status.textContent)});statusObserver.observe(w.document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['data-kind']});t.after(()=>statusObserver.disconnect());
  const timer=w.setTimeout.bind(w),interval=w.setInterval.bind(w);w.setTimeout=(fn,ms,...args)=>timer(fn,ms<5000?Math.min(ms,15):ms,...args);w.setInterval=watchHref?(fn,ms,...args)=>interval(fn,Math.min(ms,20),...args):()=>1;
  if(paired){w.localStorage.setItem('mumei-dashboard-note-id-v1',identity());w.localStorage.setItem('mumei-dashboard-ingest-token-v1','fixture')}
  w.fetch=async url=>Response.json(String(url).includes('current_user')?{data:{user:{urlname:identity()}}}:await stats(String(url)));
  w.GM_xmlhttpRequest=options=>{const body=JSON.parse(options.data);
    if(body.action==='sync-status'){const s=saves.at(-1);queueMicrotask(()=>options.onload({status:200,responseText:JSON.stringify(body.snapshotId?{ok:true,paired:true,noteId:identity(),snapshotId:saves.length,confirmed:true,articleCount:s.articles.length,dailyPvDays:s.metricSeries.filter(r=>r.pageViews!=null).length,dailyMetricCount:s.metricSeries.length,chartMetricCount:s.chartSeries?.length||0,totals:s.totals}:{ok:true,paired:true,noteId:identity()})}));return}
    saves.push(body);queueMicrotask(()=>options.onload({status:200,responseText:JSON.stringify({ok:true,snapshotId:saves.length,articleCount:body.articles.length,dailyPvDays:body.metricSeries.filter(r=>r.pageViews!=null).length,capturedAt:'2026-09-22T12:00:00Z'})}))};
  w.__location={get href(){return w.location.href},get origin(){return w.location.origin},get pathname(){return w.location.pathname},get search(){return w.location.search},assign:href=>nav.push(href)};
  before?.(w);const request=w.GM_xmlhttpRequest;w.GM_xmlhttpRequest=o=>{const b=JSON.parse(o.data);if(b.action==='client-status'){diagnostics.push(b);queueMicrotask(()=>o.onload({status:200,responseText:'{"ok":true,"recorded":true}'}));return}request(o)};w.eval(readFileSync('public/note-insight-dashboard-save-queue-v1.js','utf8'));w.eval(core.replace("'use strict';","'use strict'; const location=window.__location;"));w.eval(wrapper.replace("'use strict';","'use strict'; const location=window.__location;"));
  after?.(w);
  if(paired&&/^\/(?:dashboard|sitesettings\/stats)(?:\/|$)/.test(w.location.pathname)&&!w.sessionStorage.getItem('mumei-dashboard-read-history-v1'))w.setTimeout(()=>w.document.dispatchEvent(new w.CustomEvent('mumei-dashboard-read',{detail:{automatic:false}})),50);
  return {w,saves,nav,diagnostics,warnings};
}
async function saved(h,count=1){for(let i=0;i<100&&h.saves.length<count;i++)await pause(20);assert.equal(h.saves.length,count,h.w.document.querySelector('.status')?.textContent);await pause(20)}

test('画面表示前にnoteがクエリを消しても到着時の連携依頼を失わない',async t=>{
 const calls=[];
 const h=page(t,'<p>ページビュー 8</p>',{paired:false,url:'https://note.com/sitesettings/stats?mumei_dashboard_pair=12345678&mumei_dashboard_sync=1&mumei_dashboard_account=tester',before:w=>{
  w.GM_xmlhttpRequest=o=>{const b=JSON.parse(o.data);calls.push(b.action);queueMicrotask(()=>o.onload({status:200,responseText:JSON.stringify(b.action==='pair-exchange'?{ok:true,noteId:'tester',ingestToken:'fixture'}:{ok:true,paired:true,noteId:'tester'})}))};
 },after:w=>w.history.replaceState(null,'','/sitesettings/stats')});
 for(let i=0;i<30&&!calls.length;i++)await pause(20);
 assert.equal(calls[0],'pair-exchange',h.w.document.querySelector('.status')?.textContent);
 assert.equal(h.w.localStorage.getItem('mumei-dashboard-ingest-token-v1'),'fixture');
});

for(const condition of ['expired','wrong-account','normal-page'])test('保存した連携依頼の範囲を守る: '+condition,async t=>{
 const pending=JSON.stringify({code:'12345678',noteId:condition==='wrong-account'?'another':'tester',savedAt:Date.now(),expiresAt:new Date(Date.now()+(condition==='expired'?-1:600000)).toISOString()});
 const gmStore=new Map([['mumei-dashboard-handoff-v143',pending]]);let exchanges=0,reads=0;
 const h=page(t,'<p>アクセス状況 ページビュー 8</p>',{paired:false,url:condition==='normal-page'?'https://note.com/tester/n/n123':'https://note.com/sitesettings/stats',before:w=>{
  w.GM={getValue:async(k,d)=>gmStore.get(k)??d,setValue:async(k,v)=>gmStore.set(k,v),deleteValue:async k=>gmStore.delete(k)};
  const fetch=w.fetch;w.fetch=(...args)=>{reads++;return fetch(...args)};w.GM_xmlhttpRequest=()=>{exchanges++};
 }});await pause(100);
 assert.equal(exchanges,0);assert.equal(h.saves.length,0);assert.equal(h.nav.length,0);
 if(condition==='expired')assert.equal(gmStore.size,0);
 if(condition==='wrong-account')assert.match(h.w.document.querySelector('.status').textContent,/アカウント不一致/);
 if(condition==='normal-page'){assert.equal(reads,0);assert.equal(gmStore.size,1);assert.equal(h.w.document.getElementById('mumei-dashboard-sync'),null)}
});

test('折りたたみを開いて遅い日別通信を待ち、記事と公式合計を一度で保存する',async t=>{
  let finish,requested=false;
  const h=page(t,'<div><strong>1,234</strong><span>全体ビュー</span></div><div><strong>56</strong><span>スキ</span></div><details id="daily"><summary>日別アクセスグラフ</summary><div id="chart"></div></details><details id="articles"><summary>記事のアクセス状況</summary><table><thead><tr><th>タイトル</th><th>PV</th></tr></thead><tbody><tr><td><a href="https://note.com/tester/n/n1">記事</a></td><td>1234</td></tr></tbody></table></details>',{
    stats:()=>new Promise(resolve=>{requested=true;finish=resolve}),
    before:w=>w.document.querySelector('#daily summary').addEventListener('click',()=>void w.fetch('/api/v1/stats/daily')),
  });
  for(let i=0;i<40&&!requested;i++)await pause(10);
  assert.equal(requested,true);assert.equal(h.w.document.querySelector('#daily').open,true);assert.equal(h.w.document.querySelector('#articles').open,false,'次のパネルは最初の通信を待ってから開く');
  await pause(100);assert.equal(h.saves.length,0,'通信が終わる前に部分保存しない');
  finish({page_views:{'2026-09-20':0,'2026-09-21':1234}});await saved(h);assert.equal(h.w.document.querySelector('#articles').open,true);
  assert.equal(h.saves[0].totals.pageViews,1234);assert.equal(h.saves[0].totals.likes,56);assert.equal(h.saves[0].totals.comments,null);
  assert.equal(h.saves[0].articles.length,1);assert.equal(h.saves[0].contentSections.openedPanels,2);assert.equal(h.saves[0].metricSeries.length,2);
  assert.match(h.w.document.querySelector('.status').textContent,/同期完了.*日別PV 2日/);
});

test('ARIAパネルを開き、メニュー・期間タブ・購入ボタンには触れない',async t=>{
  const clicked=[];
  const h=page(t,'<p>ページビュー 0</p><button id="chart-button" aria-expanded="false" aria-controls="chart">グラフを開く</button><section id="chart" hidden><script type="application/json">{"page_views":{"2026-09-21":0}}</script></section><button id="menu" aria-expanded="false" aria-haspopup="menu">記事メニュー</button><button role="tab" id="period">全期間</button><button id="purchase">購入</button>',{before:w=>{
    for(const id of ['menu','period','purchase'])w.document.getElementById(id).onclick=()=>clicked.push(id);
    w.document.getElementById('chart-button').onclick=()=>{w.document.getElementById('chart-button').setAttribute('aria-expanded','true');w.document.getElementById('chart').hidden=false};
  }});
  await saved(h);assert.deepEqual(clicked,[]);assert.equal(h.w.document.getElementById('chart').hidden,false);assert.equal(h.saves[0].metricSeries[0].pageViews,0);
});

test('複数の公式JSONを消さずに合わせ、日別未取得時は同期完了と表示しない',async t=>{
  const h=page(t,'<p>ページビュー 8</p><script type="application/json">{"page_views":{"2026-09-20":8}}</script><script type="application/json">{"likes":{"2026-09-20":3}}</script>');await saved(h);
  assert.equal(h.saves[0].metricSeries[0].pageViews,8);assert.equal(h.saves[0].metricSeries[0].likes,3);
  const missing=page(t,'<p>ページビュー 8</p>');await saved(missing);assert.doesNotMatch(missing.w.document.querySelector('.status').textContent,/同期完了/);assert.equal(missing.w.document.querySelector('.status').dataset.kind,'partial');assert.match(missing.w.document.querySelector('.status').textContent,/日別PV 0日.*未取得/);
});

test('期間を変えた後の公式データを明示読み込みで保存し、前の期間の取得値を混ぜない',async t=>{
  const h=page(t,'<p id="range">2026/9/20〜2026/9/20</p><p>ページビュー 2</p>',{stats:async url=>({page_views:{[url.includes('2026-09-21')?'2026-09-21':'2026-09-20']:url.includes('2026-09-21')?9:2}}),before:w=>{w.performance.getEntriesByType=()=>[{name:'https://note.com/api/v1/stats/daily?date=2026-09-20'}]}});
  await h.w.fetch('/api/v1/stats/daily?date=2026-09-20');await saved(h);
  h.w.document.getElementById('range').textContent='2026/9/21〜2026/9/21';
  await h.w.fetch('/api/v1/stats/daily?date=2026-09-21');h.w.document.getElementById('mumei-dash-run').click();await saved(h,2);
  assert.equal(h.saves[1].periodStart,'2026-09-21');assert.equal(h.saves[1].periodEnd,'2026-09-21');
  assert.deepEqual(JSON.parse(JSON.stringify(h.saves[1].metricSeries.map(r=>[r.date,r.pageViews]))),[['2026-09-21',9]]);
  h.w.document.getElementById('mumei-dash-run').click();await pause(250);assert.equal(h.saves.length,2,'同じデータを二重保存しない');
});

test('未連携の通常訪問では手順を表示し、保存やパネル展開を勝手に進めない',async t=>{
  const h=page(t,'<details><summary>日別アクセス</summary><p>ページビュー 8</p></details>',{paired:false});await pause(120);
  assert.equal(h.saves.length,0);assert.equal(h.w.document.querySelector('details').open,false);assert.match(h.w.document.querySelector('.status').textContent,/連携/);
});

test('連携が失効した場合は保存完了を出さず、接続し直す画面へ案内する',async t=>{
  const h=page(t,'<p>ページビュー 8</p>',{before:w=>{w.GM_xmlhttpRequest=opts=>queueMicrotask(()=>opts.onload({status:401,responseText:JSON.stringify({ok:false,error:'INGEST_TOKEN_INVALID'})}))}});
  for(let i=0;i<100&&!h.w.document.querySelector('.status')?.textContent.includes('連携が無効');i++)await pause(20);
  assert.match(h.w.document.querySelector('.status').textContent,/連携が無効/);assert.equal(h.w.document.querySelector('.status').dataset.kind,'warn');
  const action=h.w.document.getElementById('mumei-dash-run');assert.equal(action.dataset.action,'connect');assert.equal(action.textContent,'連携');action.click();await pause(30);assert.equal(new URL(h.nav[0]).searchParams.get('account'),'tester');assert.equal(new URL(h.nav[0]).searchParams.get('auto'),'1');
  assert.equal(h.w.localStorage.getItem('mumei-dashboard-last-sync'),null);
});

test('ARIA指定のない詳細ボタンでも、公式のグラフ部分を展開する',async t=>{
  const h=page(t,'<section><h2>日別アクセスグラフ</h2><button id="more">詳細を見る</button><div id="values" hidden>ページビュー 8</div></section>',{before:w=>{w.document.getElementById('more').onclick=()=>{w.document.getElementById('values').hidden=false;w.document.getElementById('more').textContent='閉じる'}}});
  await saved(h);assert.equal(h.w.document.getElementById('values').hidden,false);assert.equal(h.saves[0].contentSections.openedPanels,1);assert.equal(h.saves[0].totals.pageViews,8);
});

test('公式の未連携ボタンから設定・本人照合・日別保存・分析復帰までつながる',async t=>{
 const entry=page(t,'<p>ページビュー 8</p>',{paired:false});await pause(100);
 const connect=entry.w.document.getElementById('mumei-dash-run');assert.equal(connect.textContent,'連携');assert.equal(connect.disabled,false);connect.click();await pause(30);
 const setupUrl=new URL(entry.nav[0]);assert.equal(setupUrl.pathname,'/note-insight/dashboard-setup.html');assert.equal(setupUrl.searchParams.get('auto'),'1');assert.equal(setupUrl.searchParams.get('account'),'tester');
 const setup=new JSDOM(readFileSync('public/dashboard-setup.html','utf8'),{url:setupUrl.href,runScripts:'outside-only'}),w=setup.window,setupNav=[],pairCalls=[];
 const observers=[],Observer=w.MutationObserver;w.MutationObserver=class extends Observer{constructor(fn){super(fn);observers.push(this)}};t.after(()=>{observers.forEach(o=>o.disconnect());w.close()});w.localStorage.setItem('mumei-insight-access-token','member-fixture');w.localStorage.setItem('mumei-insight-active-account-v3','tester');
 const handoffStore=new Map(),gm={getValue:async(k,d)=>handoffStore.get(k)??d,setValue:async(k,v)=>handoffStore.set(k,v),deleteValue:async k=>handoffStore.delete(k)};w.GM=gm;
 w.__location={get href(){return w.location.href},get search(){return w.location.search},get origin(){return w.location.origin},assign:href=>{assert.ok(handoffStore.get('mumei-dashboard-handoff-v143'),'移動より先に共有保存を確認');setupNav.push(href)}};
 const release=JSON.parse(readFileSync('public/insight-release.json','utf8'));
 w.fetch=async(url,init={})=>{if(String(url).includes('insight-release.json'))return Response.json(release);pairCalls.push(init);assert.equal(JSON.parse(init.body).action,'pair-start');assert.equal(init.headers['X-Insight-Token'],'member-fixture');return Response.json({ok:true,noteId:'tester',pairingCode:'12345678'})};
 w.eval(readFileSync('public/note-insight-dashboard-feature-bridge-v1.js','utf8'));w.eval(wrapper);w.eval(readFileSync('public/dashboard-setup.js','utf8').replace("'use strict';","'use strict'; const location=window.__location;"));await pause(50);
 assert.equal(pairCalls.length,1);assert.equal(setupNav.length,1);assert.ok(!setupNav[0].includes('member-fixture'));
 const requests=[];let stored;
 const official=page(t,'<p>ページビュー 8</p><details><summary>日別アクセスグラフ</summary><script type="application/json">{"page_views":{"2026-09-21":8}}</script></details>',{paired:false,url:'https://note.com/sitesettings/stats',before:w=>{
  w.localStorage.setItem('mumei-dashboard-note-id-v1','tester');w.localStorage.setItem('mumei-dashboard-ingest-token-v1','expired-fixture');w.sessionStorage.setItem('mumei-dashboard-read-history-v1',JSON.stringify({version:coreVersion,noteId:'tester',rows:[],sticky:{message:'前回の連携失効',kind:'warn',action:'connect'}}));
  w.GM=gm; // note has already stripped all query parameters before userscript startup.
  w.GM_xmlhttpRequest=opts=>{const body=JSON.parse(opts.data);requests.push(body);let result;
   if(body.action==='pair-exchange'){assert.equal(body.code,'12345678');result={ok:true,noteId:'tester',ingestToken:'ingest-fixture'}}
   else if(body.action==='sync-status'){result=body.snapshotId?{ok:true,paired:true,noteId:'tester',snapshotId:1,confirmed:true,articleCount:0,dailyPvDays:1,dailyMetricCount:1,totals:stored.totals}:{ok:true,paired:true,noteId:'tester'}}
   else{stored=body;assert.equal(body.action,'ingest');assert.equal(opts.headers['X-Ingest-Token'],'ingest-fixture');assert.equal(body.noteId,'tester');assert.equal(body.metricSeries[0].pageViews,8);result={ok:true,snapshotId:1,dailyPvDays:1,articleCount:0,capturedAt:'2026-09-22T12:00:00Z'}}
   queueMicrotask(()=>opts.onload({status:200,responseText:JSON.stringify(result)}));
  };
 }});
 for(let i=0;i<100&&!official.nav.length;i++)await pause(20);
 assert.deepEqual(requests.map(r=>r.action),['pair-exchange','sync-status','ingest','sync-status']);assert.equal(official.w.document.querySelector('details').open,true);assert.match(official.w.document.querySelector('.status').textContent,/同期完了.*日別PV 1日/);
 assert.equal(official.nav.length,1);const back=new URL(official.nav[0]);assert.equal(back.origin,'https://mumei-s.github.io');assert.equal(back.searchParams.get('dashboardSync'),'ok');assert.equal(back.searchParams.get('insightMode'),'analysis');
 assert.equal(official.w.document.getElementById('mumei-dash-run').dataset.action,'read');
 assert.equal(handoffStore.has('mumei-dashboard-handoff-v143'),false,'使い終わった連携情報は残さない');
});

test('排他アコーディオンを順に開き、閉じられた先の数値も保存する',async t=>{
 const table=(name,pv)=>`<table><thead><tr><th>記事</th><th>PV</th></tr></thead><tbody><tr><td>${name}</td><td>${pv}</td></tr></tbody></table>`;
 const h=page(t,`<p>全体ビュー 12</p><div><h2>記事アクセス</h2><button id="a" aria-expanded="false">開く</button><div id="va" hidden>${table('先のパネル',5)}</div></div><div><h2>記事一覧</h2><button id="b" aria-expanded="false">開く</button><div id="vb" hidden>${table('後のパネル',7)}</div></div>`,{before:w=>{
  for(const id of ['a','b'])w.document.getElementById(id).onclick=()=>{for(const other of ['a','b']){w.document.getElementById('v'+other).hidden=other!==id;w.document.getElementById(other).setAttribute('aria-expanded',String(other===id))}};
 }});
 await saved(h);assert.deepEqual(h.saves[0].articles.map(r=>[r.title,r.pageViews]),[['先のパネル',5],['後のパネル',7]]);assert.equal(h.saves[0].contentSections.openedPanels,2);
});

test('遅れて出現する入れ子パネルと日別の表を開いて読む',async t=>{
 const h=page(t,'<p>全体ビュー 12</p><details><summary>日別アクセス</summary><div id="nested"></div></details>',{before:w=>{
  w.document.querySelector('summary').onclick=()=>setTimeout(()=>{const root=w.document.getElementById('nested');root.innerHTML='<h3>日別グラフ</h3><button id="late" aria-expanded="false">開く</button><div id="days" hidden><table><thead><tr><th>日付</th><th>PV</th><th>スキ</th></tr></thead><tbody><tr><td>2026年9月25日</td><td>12</td><td>0</td></tr></tbody></table></div>';root.querySelector('button').onclick=()=>{root.querySelector('button').setAttribute('aria-expanded','true');root.querySelector('#days').hidden=false}},50);
 }});
 await saved(h);assert.equal(h.saves[0].metricSeries[0].pageViews,12);assert.equal(h.saves[0].metricSeries[0].likes,0);assert.equal(h.saves[0].contentSections.openedPanels,2);
});

test('記事とメンバーシップを読み、不要なマガジンと期間ボタンには触れない',async t=>{
 const h=page(t,'<p>全体ビュー 12</p><button role="tab" aria-selected="true">記事</button><button role="tab" aria-selected="false">マガジン</button><button role="tab" aria-selected="false">メンバーシップ</button><button role="tab" id="month">月</button><section id="items"></section>',{before:w=>{
  const render=name=>w.document.querySelector('#items').innerHTML=`<table><thead><tr><th>タイトル</th><th>PV</th></tr></thead><tbody><tr><td>${name}</td><td>4</td></tr></tbody></table>`;render('記事');
  for(const el of [...w.document.querySelectorAll('[aria-selected]')])el.onclick=()=>{for(const tab of w.document.querySelectorAll('[aria-selected]'))tab.setAttribute('aria-selected',String(tab===el));render(el.textContent)};
  w.document.querySelector('#month').onclick=()=>assert.fail('期間を変えない');
 }});
 await saved(h);assert.deepEqual(h.saves[0].articles.map(r=>r.contentType),['article','membership']);
});

test('タブ切替でURLが変わっても記事とメンシプを往復せず全種類を一度で保存する',async t=>{
 const clicks=[];
 const h=page(t,'<p>全体ビュー 12</p><button role="tab" aria-selected="true">記事</button><button role="tab" aria-selected="false">メンバーシップ</button><button role="tab" aria-selected="false">マガジン</button><section id="items"></section>',{watchHref:true,before:w=>{
  const render=name=>w.document.getElementById('items').innerHTML=`<table><thead><tr><th>タイトル</th><th>PV</th></tr></thead><tbody><tr><td>${name}</td><td>4</td></tr></tbody></table>`;render('記事');
  for(const tab of w.document.querySelectorAll('[role="tab"]'))tab.onclick=()=>{clicks.push(tab.textContent);for(const el of w.document.querySelectorAll('[role="tab"]'))el.setAttribute('aria-selected',String(el===tab));w.history.replaceState(null,'','?content='+encodeURIComponent(tab.textContent));render(tab.textContent);void w.fetch('/api/v1/stats/list?content='+encodeURIComponent(tab.textContent))};
 }});
 await saved(h);await pause(250);assert.deepEqual(clicks,['メンバーシップ']);assert.equal(h.saves.length,1);assert.deepEqual(h.saves[0].articles.map(r=>r.contentType),['article','membership']);
});

test('同じ公式応答では勝手に再読込せず、明示読み込みで更新値を保存する',async t=>{
 const clicks=[];let checks=0,pv=12;
 const h=page(t,'<p id="pv">全体ビュー 12</p><button role="tab" aria-selected="true">記事</button><button role="tab" aria-selected="false">メンバーシップ</button><section id="items"></section>',{stats:async()=>({page_views:{'2026-09-27':pv}}),before:w=>{
  const send=w.GM_xmlhttpRequest;w.GM_xmlhttpRequest=o=>{if(JSON.parse(o.data).action==='sync-status')checks++;send(o)};
  const render=name=>w.document.getElementById('items').innerHTML=`<table><thead><tr><th>タイトル</th><th>PV</th></tr></thead><tbody><tr><td>${name}</td><td>4</td></tr></tbody></table>`;render('記事');
  for(const tab of w.document.querySelectorAll('[role="tab"]'))tab.onclick=()=>{clicks.push(tab.textContent);for(const el of w.document.querySelectorAll('[role="tab"]'))el.setAttribute('aria-selected',String(el===tab));render(tab.textContent);void w.fetch('/api/v1/stats/daily')};
 }});
 await saved(h);const initialChecks=checks;await h.w.fetch('/api/v1/stats/daily');await pause(350);
 assert.equal(checks,initialChecks);assert.deepEqual(clicks,['メンバーシップ']);
 pv=20;h.w.document.getElementById('pv').textContent='全体ビュー 20';await h.w.fetch('/api/v1/stats/daily');h.w.document.getElementById('mumei-dash-run').click();await saved(h,2);
 assert.deepEqual(clicks,['メンバーシップ','記事']);assert.equal(h.saves[1].totals.pageViews,20);assert.equal(h.saves[1].metricSeries[0].pageViews,20);assert.deepEqual(h.saves[1].articles.map(r=>r.contentType),['article','membership']);
});

test('失効をパネル操作の前に検知し、読取に見せかけた画面変更をしない',async t=>{
 const h=page(t,'<details><summary>記事アクセス</summary><p>ページビュー 12</p></details>',{before:w=>{
  w.GM_xmlhttpRequest=o=>{assert.equal(JSON.parse(o.data).action,'sync-status');queueMicrotask(()=>o.onload({status:401,responseText:'{"ok":false,"error":"INGEST_TOKEN_INVALID"}'}))};
 }});
 await pause(100);assert.equal(h.w.document.querySelector('details').open,false);assert.equal(h.w.localStorage.getItem('mumei-dashboard-ingest-token-v1'),null);assert.equal(h.w.document.getElementById('mumei-dash-run').dataset.action,'connect');assert.equal(h.saves.length,0);
});

test('保存応答だけ成功でもDB照合で件数が違えば完了や自動復帰にしない',async t=>{
 const h=page(t,'<p>ページビュー 12</p><script type="application/json">{"page_views":{"2026-09-25":12}}</script>',{before:w=>{
  w.GM_xmlhttpRequest=o=>{const b=JSON.parse(o.data);let p=b.action==='ingest'?{ok:true,snapshotId:7}:{ok:true,paired:true,noteId:'tester'};if(b.snapshotId)p={...p,snapshotId:7,confirmed:true,articleCount:999,dailyMetricCount:1,dailyPvDays:1};queueMicrotask(()=>o.onload({status:200,responseText:JSON.stringify(p)}))};
 }});
 for(let i=0;i<100&&!h.w.document.querySelector('.status')?.textContent.includes('保存件数');i++)await pause(20);
 assert.match(h.w.document.querySelector('.status').textContent,/保存件数が一致しません/);assert.equal(h.w.localStorage.getItem('mumei-dashboard-last-sync'),null);assert.equal(h.nav.length,0);
});

test('クリックしても開かないパネルは完了として保存しない',async t=>{
 const h=page(t,'<p>全体ビュー 12</p><button aria-expanded="false">日別アクセスグラフ</button>');
 await pause(500);assert.equal(h.saves.length,0);assert.match(h.w.document.querySelector('.status').textContent,/パネルを開けません/);
});

test('通常記事では通信を差し替えず、SPAで公式画面へ入った時から読める',async t=>{
 let original;
 const h=page(t,'<p>ページビュー 12</p>',{url:'https://note.com/tester/n/n123',before:w=>{original=w.fetch}});
 await pause(30);assert.equal(h.w.fetch,original);assert.equal(h.w.document.getElementById('mumei-dashboard-sync'),null);
 h.w.history.pushState(null,'','/sitesettings/stats');h.w.dispatchEvent(new h.w.PopStateEvent('popstate'));await pause(50);h.w.document.getElementById('mumei-dash-run').click();
 await saved(h);assert.equal(h.saves[0].totals.pageViews,12);
});

test('保存中に遅い公式データが届いた時は追加データを案内し、明示読み込みで保存する',async t=>{
 let release;
 const h=page(t,'<p id="pv">ページビュー 12</p>',{stats:async()=>({page_views:{'2026-09-25':20}}),before:w=>{
  const send=w.GM_xmlhttpRequest;let first=true;
  w.GM_xmlhttpRequest=o=>{if(first&&JSON.parse(o.data).action==='ingest'){first=false;release=()=>send(o)}else send(o)};
 }});
 for(let i=0;i<100&&!release;i++)await pause(20);assert.ok(release);
 h.w.document.getElementById('pv').textContent='ページビュー 20';await h.w.fetch('/api/v1/stats/daily');await pause(20);release();
 await saved(h);await pause(80);h.w.document.getElementById('mumei-dash-run').click();await saved(h,2);assert.equal(h.saves[1].totals.pageViews,20);assert.equal(h.saves[1].metricSeries[0].pageViews,20);assert.match(h.w.document.querySelector('.status').textContent,/同期完了/);
});

test('参加者を切り替えたら前の参加者の収集結果や遅延応答を再利用しない',async t=>{
 let account='participant_a',late;
 const table=name=>`<p>ページビュー 3</p><table><thead><tr><th>タイトル</th><th>PV</th></tr></thead><tbody><tr><td>${name}</td><td>3</td></tr></tbody></table>`;
 const h=page(t,`<section id="items">${table('最初の参加者の記事')}</section>`,{identity:()=>account,stats:async url=>url.includes('late')?new Promise(resolve=>late=resolve):{page_views:{'2026-09-27':3}}});
 await h.w.fetch('/api/v1/stats/daily');await saved(h);
 const oldRequest=h.w.fetch('/api/v1/stats/late');account='participant_b';
 h.w.localStorage.setItem('mumei-dashboard-note-id-v1',account);h.w.localStorage.setItem('mumei-dashboard-ingest-token-v1','fixture-b');h.w.document.getElementById('items').innerHTML=table('次の参加者の記事');
 late({page_views:{'2026-09-26':999}});await oldRequest;
 await h.w.fetch('/api/v1/stats/daily');h.w.document.getElementById('mumei-dash-run').click();await saved(h,2);
 assert.equal(h.saves[1].noteId,'participant_b');assert.deepEqual(h.saves[1].articles.map(r=>r.title),['次の参加者の記事']);assert.deepEqual(h.saves[1].metricSeries.map(r=>[r.date,r.pageViews]),[['2026-09-27',3]]);
});

for(const change of ['period','route'])test('読取途中の画面変更でも変更前の取得済みデータは保存する: '+change,async t=>{
 const h=page(t,'<p id="range">2026/8/30〜2026/9/26</p><p>ページビュー 12</p><button role="tab" aria-selected="true">記事</button><button role="tab" aria-selected="false" id="next">メンバーシップ</button>',{before:w=>{
  w.document.getElementById('next').onclick=()=>{if(change==='period')w.document.getElementById('range').textContent='2026/8/2〜2026/8/29';else w.history.pushState(null,'','/tester/n/n123')};
 }});
 await pause(400);assert.equal(h.saves.length,1);assert.equal(h.saves[0].periodStart,'2026-08-30');assert.equal(h.saves[0].contentSections.article.scope,'partial-read');if(change==='route')assert.equal(h.w.document.querySelector('#mumei-dashboard-sync'),null);else assert.match(h.w.document.querySelector('.status').textContent,/取得済みデータを保存しました/);
});

test('パネル読取が失敗した後の通信で自動巡回を再開せず、手動でだけ再試行する',async t=>{
 let clicks=0;
 const h=page(t,'<p>ページビュー 12</p><button id="broken" aria-expanded="false">日別アクセスグラフ</button>',{before:w=>{
  w.document.getElementById('broken').onclick=()=>{clicks++;setTimeout(()=>{if(!w.closed)void w.fetch('/api/v1/stats/daily?attempt='+clicks)},180)};
 }});
 await pause(750);assert.equal(clicks,1);assert.equal(h.saves.length,0);assert.match(h.w.document.querySelector('.status').textContent,/パネルを開けません/);
 h.w.document.getElementById('mumei-dash-run').click();await pause(400);assert.equal(clicks,2);
});

test('同じ読込ツールが二重起動してもパネルと読込処理を一つに保つ',async t=>{
 const h=page(t,'<p>ページビュー 12</p>',{after:w=>{w.eval(readFileSync('public/note-insight-dashboard-save-queue-v1.js','utf8'));w.eval(core.replace("'use strict';","'use strict'; const location=window.__location;"));w.eval(wrapper.replace("'use strict';","'use strict'; const location=window.__location;"))}});
 await saved(h);assert.equal(h.w.document.querySelectorAll('#mumei-dashboard-sync').length,1);assert.equal(h.saves.length,1);
});

test('起動部だけ新しく読込本体が古い時はクリック巡回せず更新入口を表示する',async t=>{
 const h=page(t,'<p>ページビュー 12</p><button id="content" role="tab">メンバーシップ</button>',{before:w=>{w.document.getElementById('content').onclick=()=>assert.fail('古い読込本体を動かさない')},after:w=>w.addEventListener('DOMContentLoaded',()=>{w.document.getElementById('mumei-dashboard-sync').dataset.coreVersion='1.5.3'})});
 await pause(180);assert.equal(h.saves.length,0);assert.match(h.w.document.querySelector('.status').textContent,/更新が揃っていません/);assert.ok(h.w.document.querySelector('a#mumei-dash-update[href*="dashboard-setup.html"]'));assert.equal(h.w.document.getElementById('mumei-dash-run').disabled,true);
});

test('自動起動の通知が重なっても保存後に内容タブを再巡回しない',async t=>{
 let clicks=0;
 const h=page(t,'<p>ページビュー 12</p><button role="tab" aria-selected="true">記事</button><button role="tab" id="membership" aria-selected="false">メンバーシップ</button>',{before:w=>{for(const tab of w.document.querySelectorAll('[role="tab"]'))tab.onclick=()=>{clicks++;for(const el of w.document.querySelectorAll('[role="tab"]'))el.setAttribute('aria-selected',String(el===tab))}}});
 await saved(h);assert.equal(clicks,1);h.w.document.dispatchEvent(new h.w.Event('mumei-dashboard-read'));await pause(350);assert.equal(clicks,1);assert.equal(h.saves.length,1);
});

test('補助表示やAPI応答時刻が更新され続けても同じ公式数値の読取は完了する',async t=>{
 let clock=0,poll;const clicks=[];t.after(()=>clearInterval(poll));
 const h=page(t,'<p>ページビュー 12</p><span id="clock">補助表示</span><button role="tab" aria-selected="true">記事</button><button role="tab" aria-selected="false">メンバーシップ</button>',{stats:async()=>({generatedAt:clock,page_views:{'2026-09-27':12}}),before:w=>{
  for(const tab of w.document.querySelectorAll('[role="tab"]'))tab.onclick=()=>{clicks.push(tab.textContent);for(const el of w.document.querySelectorAll('[role="tab"]'))el.setAttribute('aria-selected',String(el===tab));if(!poll)poll=setInterval(()=>{w.document.getElementById('clock').textContent='補助表示 '+(++clock);void w.fetch('/api/v1/stats/daily')},12)};
 }});
 await saved(h);clearInterval(poll);assert.deepEqual(clicks,['メンバーシップ']);assert.equal(h.saves[0].metricSeries[0].pageViews,12);await pause(350);assert.equal(h.saves.length,1);assert.match(h.w.document.querySelector('.status').textContent,/同期完了/);
});


test('再描画で作り直される排他パネルを二度開かず、両方の記事を保存する',async t=>{
 const clicks=[];
 const h=page(t,'<p>ページビュー 12</p><section id="panels"></section>',{before:w=>{
  function render(active=''){
   w.document.getElementById('panels').innerHTML=['a','b'].map(id=>`<section><h2>記事アクセス ${id}</h2><button id="${id}" aria-expanded="${active===id}">開く</button>${active===id?`<table><thead><tr><th>記事</th><th>PV</th></tr></thead><tbody><tr><td>${id}</td><td>6</td></tr></tbody></table>`:''}</section>`).join('');
   for(const el of w.document.querySelectorAll('#panels button'))el.onclick=()=>{clicks.push(el.id);render(el.id)};
  }render();
 }});
 await saved(h);assert.deepEqual(clicks,['a','b']);assert.deepEqual(h.saves[0].articles.map(r=>r.title),['a','b']);
});

test('数値を表示する進捗グラフや並べ替えボタンを通信待ち・開く対象にしない',async t=>{
 const h=page(t,'<p>ページビュー 12</p><div role="progressbar" aria-valuenow="70" aria-valuemax="100"></div><button aria-expanded="false" id="sort">記事数順</button><button aria-expanded="false" id="period-select">過去28日間</button>',{before:w=>{for(const id of ['sort','period-select'])w.document.getElementById(id).onclick=()=>assert.fail('表示条件を変更しない')}});
 await saved(h);assert.equal(h.saves[0].totals.pageViews,12);
});

test('途中のパネル失敗から再開しても取得済みの記事タブへ戻らない',async t=>{
 const clicks=[];let allow=false;
 const h=page(t,'<p>ページビュー 12</p><button role="tab" aria-selected="true">記事</button><button role="tab" aria-selected="false">メンバーシップ</button><section id="items"></section>',{before:w=>{
  const render=label=>{w.document.getElementById('items').innerHTML=`<table><thead><tr><th>タイトル</th><th>PV</th></tr></thead><tbody><tr><td>${label}</td><td>6</td></tr></tbody></table>`+(label==='メンバーシップ'?'<button id="broken" aria-expanded="false">日別アクセスグラフ</button>':'');const broken=w.document.getElementById('broken');if(broken)broken.onclick=()=>{clicks.push('グラフ');if(allow){broken.setAttribute('aria-expanded','true');w.document.getElementById('items').insertAdjacentHTML('beforeend','<script type="application/json">{"page_views":{"2026-09-27":12}}</script>')}}};render('記事');
  for(const tab of w.document.querySelectorAll('[role="tab"]'))tab.onclick=()=>{clicks.push(tab.textContent);for(const el of w.document.querySelectorAll('[role="tab"]'))el.setAttribute('aria-selected',String(el===tab));render(tab.textContent)};
 }});
 for(let i=0;i<100&&!h.w.document.querySelector('.status')?.textContent.includes('PANEL_NOT_OPEN');i++)await pause(20);
 assert.match(h.w.document.querySelector('.status').textContent,/取得済み 記事2件/);assert.equal(h.saves.length,0);assert.equal(h.w.document.getElementById('mumei-dash-run').textContent,'読み込み');
 allow=true;h.w.document.getElementById('mumei-dash-run').click();await saved(h);
 assert.deepEqual(clicks,['メンバーシップ','グラフ','グラフ']);assert.deepEqual(h.saves[0].articles.map(r=>r.title),['記事','メンバーシップ']);assert.match(h.w.document.querySelector('.status').textContent,/同期完了/);
});

for(const failure of ['ingest','confirmation'])test('保存の失敗はタブを再巡回せず必要な通信だけ再試行する: '+failure,async t=>{
 const clicks=[];let fail=true,ingests=0;
 const h=page(t,'<p>ページビュー 12</p><script type="application/json">{"page_views":{"2026-09-27":12}}</script><button role="tab" aria-selected="true">記事</button><button role="tab" aria-selected="false">メンバーシップ</button>',{before:w=>{
  for(const tab of w.document.querySelectorAll('[role="tab"]'))tab.onclick=()=>{clicks.push(tab.textContent);for(const el of w.document.querySelectorAll('[role="tab"]'))el.setAttribute('aria-selected',String(el===tab))};
  const send=w.GM_xmlhttpRequest;w.GM_xmlhttpRequest=o=>{const b=JSON.parse(o.data);if(b.action==='ingest')ingests++;if(fail&&(failure==='ingest'?b.action==='ingest':Boolean(b.snapshotId))){queueMicrotask(()=>o.onerror());return}send(o)};
 }});
 for(let i=0;i<100&&!h.w.document.querySelector('.status')?.textContent.includes('NETWORK_ERROR');i++)await pause(20);
 assert.equal(ingests,1);assert.match(h.w.document.querySelector('.status').textContent,/取得済み/);assert.equal(h.w.document.getElementById('mumei-dash-run').textContent,'読み込み');
 fail=false;h.w.document.getElementById('mumei-dash-run').click();
 for(let i=0;i<100&&!h.w.document.querySelector('.status')?.textContent.includes('同期完了');i++)await pause(20);
 assert.match(h.w.document.querySelector('.status').textContent,/同期完了/);assert.deepEqual(clicks,['メンバーシップ']);assert.equal(ingests,failure==='ingest'?2:1);
});

test('ページを開き直した後も保存待ちデータを復元し、別参加者には再利用しない',async t=>{
 const checkpointKey='mumei-dashboard-read-checkpoint-v1';
 const first=page(t,'<p>2026/9/1〜2026/9/27</p><p>ページビュー 12</p><table><thead><tr><th>記事</th><th>PV</th></tr></thead><tbody><tr><td>保持する記事</td><td>12</td></tr></tbody></table>',{before:w=>{const send=w.GM_xmlhttpRequest;w.GM_xmlhttpRequest=o=>JSON.parse(o.data).action==='ingest'?queueMicrotask(()=>o.onerror()):send(o)}});
 for(let i=0;i<100&&!first.w.document.querySelector('.status')?.textContent.includes('NETWORK_ERROR');i++)await pause(20);
 const cached=first.w.localStorage.getItem(checkpointKey);assert.ok(cached);assert.ok(!cached.includes('fixture'),'接続トークンを複製しない');
 const restored=page(t,'<p>ページビュー 12</p><button role="tab">メンバーシップ</button>',{before:w=>{w.sessionStorage.setItem(checkpointKey,cached);w.document.querySelector('button').onclick=()=>assert.fail('保存再試行にタブ切替は不要');setTimeout(()=>w.document.querySelector('main').insertAdjacentHTML('afterbegin','<p>2026/9/1〜2026/9/27</p>'),70)}});
 await saved(restored);assert.deepEqual(restored.saves[0].articles.map(r=>r.title),['保持する記事']);
 const another=page(t,'<p>ページビュー 5</p>',{identity:()=>'participant_b',before:w=>w.sessionStorage.setItem(checkpointKey,cached)});
 await saved(another);assert.equal(another.saves[0].noteId,'participant_b');assert.equal(another.saves[0].articles.length,0);assert.equal(another.saves[0].totals.pageViews,5);
});


test('開けないパネルが別のDOMに置き換わっても完了扱いにしない',async t=>{
 let clicks=0;
 const h=page(t,'<p>ページビュー 12</p><section id="container"></section>',{before:w=>{
  const render=()=>{w.document.getElementById('container').innerHTML='<button id="closed" aria-expanded="false">日別アクセスグラフ</button>';w.document.getElementById('closed').onclick=()=>{clicks++;render()}};render();
 }});
 for(let i=0;i<100&&!h.w.document.querySelector('.status')?.textContent.includes('PANEL_NOT_OPEN');i++)await pause(20);
 assert.equal(clicks,1);assert.equal(h.saves.length,0);assert.match(h.w.document.querySelector('.status').textContent,/PANEL_NOT_OPEN/);
});


for(const mode of ['date-remount','hidden-date','metric-tab','content-route'])test('ツール自身の内容切替を期間変更と誤判定しない: '+mode,async t=>{
 const clicks=[];
 const h=page(t,'<p id="range">2026/8/30〜2026/9/26</p><p>ページビュー 12</p><button role="tab" aria-selected="true" id="metric">インプレッション</button><button role="tab" aria-selected="true">記事</button><button role="tab" aria-selected="false">メンバーシップ</button><section id="items"></section>',{stats:async()=>({page_views:{'2026-09-26':12}}),before:w=>{
  const render=label=>w.document.getElementById('items').innerHTML=`<table><thead><tr><th>記事</th><th>PV</th></tr></thead><tbody><tr><td>${label}</td><td>6</td></tr></tbody></table>`;render('記事');
  for(const tab of [...w.document.querySelectorAll('[role=tab]')].filter(el=>el.id!=='metric'))tab.onclick=()=>{
   clicks.push(tab.textContent);for(const el of [...w.document.querySelectorAll('[role=tab]')].filter(el=>el.id!=='metric'))el.setAttribute('aria-selected',String(el===tab));render(tab.textContent);
   if(mode==='date-remount'||mode==='hidden-date'){w.document.getElementById('range').textContent='';if(mode==='date-remount')setTimeout(()=>w.document.getElementById('range').textContent='2026/8/30〜2026/9/26',50)}
   if(mode==='metric-tab')w.document.getElementById('metric')?.remove();
   if(mode==='content-route')w.history.pushState(null,'','/sitesettings/stats/membership');
   void w.fetch('/api/v1/stats/daily');
  };
 }});
 await saved(h);assert.deepEqual(clicks,['メンバーシップ']);assert.equal(h.saves[0].periodStart,'2026-08-30');assert.equal(h.saves[0].periodEnd,'2026-09-26');assert.equal(h.saves[0].articles.length,2);assert.equal(h.diagnostics.length,0);assert.deepEqual(h.warnings,[],'自動切替中に停止エラーを一瞬でも出さない');
});

test('期間変更で停止したエラーは新期間の通信や起動通知で上書き・自動再開しない',async t=>{
 let clicks=0;
 const h=page(t,'<p id="range">2026/8/30〜2026/9/26</p><p>ページビュー 12</p><button role="tab" aria-selected="true">記事</button><button id="next" role="tab" aria-selected="false">メンバーシップ</button>',{stats:async()=>({page_views:{'2026-09-25':12}}),before:w=>{w.document.getElementById('next').onclick=()=>{clicks++;w.document.getElementById('range').textContent='2026/8/2〜2026/8/29'}}});
 for(let i=0;i<100&&!h.w.document.querySelector('.status')?.textContent.includes('取得済みデータを保存しました');i++)await pause(20);
 const status=h.w.document.querySelector('.status'),error=status.textContent;assert.match(error,/取得済みデータを保存しました/);
 await h.w.fetch('/api/v1/stats/daily');h.w.document.dispatchEvent(new h.w.Event('mumei-dashboard-read'));h.w.document.dispatchEvent(new h.w.CustomEvent('mumei-dashboard-status',{detail:{message:'もう一度読み込みます'}}));await pause(300);
 assert.equal(status.textContent,error);assert.equal(clicks,1);assert.equal(h.saves.length,1);assert.equal(h.saves[0].periodStart,'2026-08-30');assert.equal(h.diagnostics.length,0);
 assert.ok(!JSON.stringify(h.diagnostics).includes('fixture'));
 const details=h.w.document.getElementById('mumei-dash-history');details.open=true;await pause(20);const area=details.querySelector('textarea'),frozen=area.value;
 assert.match(frozen,/取得済みデータを保存しました/);assert.ok(frozen.includes('v'+coreVersion));
 h.w.document.dispatchEvent(new h.w.CustomEvent('mumei-dashboard-status',{detail:{message:'追加の状態'}}));await pause(20);assert.equal(area.value,frozen,'開いている履歴は読みながら書き換えない');
 let copied='';Object.defineProperty(h.w.navigator,'clipboard',{value:{writeText:async value=>copied=value}});h.w.document.getElementById('mumei-dash-copy').click();await pause(10);assert.equal(copied,frozen);
});

test('停止操作後に通信が終われば保存し、パネル巡回は続けない',async t=>{
 let release;const clicks=[];
 const h=page(t,'<p>ページビュー 12</p><button role="tab" aria-selected="true">記事</button><button role="tab" aria-selected="false">メンバーシップ</button>',{stats:()=>new Promise(resolve=>release=resolve),before:w=>{for(const el of w.document.querySelectorAll('[role=tab]'))el.onclick=()=>{clicks.push(el.textContent);void w.fetch('/api/v1/stats/daily')}}});
 for(let i=0;i<100&&!release;i++)await pause(20);assert.ok(release);
 h.w.document.getElementById('mumei-dash-run').click();release({page_views:{'2026-09-26':12}});await pause(250);
 assert.equal(h.saves.length,1);assert.deepEqual(clicks,['メンバーシップ']);assert.match(h.w.document.querySelector('.status').textContent,/取得済みデータを保存しました/);assert.equal(h.w.document.querySelector('.status').dataset.kind,'paused');assert.equal(h.w.document.getElementById('mumei-dash-run').disabled,false);
 h.w.document.dispatchEvent(new h.w.Event('mumei-dashboard-read'));await pause(150);assert.equal(h.saves.length,1);assert.deepEqual(clicks,['メンバーシップ']);
});


test('ページを再表示しても最後のエラーと履歴を残し、自動再開しない',async t=>{
 const message='公式データの待機が15秒を超えました [READ_WAIT]';
 const h=page(t,'<p>ページビュー 12</p>',{before:w=>w.sessionStorage.setItem('mumei-dashboard-read-history-v1',JSON.stringify({version:coreVersion,noteId:'tester',rows:[{at:'10:00:00',message,kind:'warn'}],sticky:{message,kind:'warn',action:'read'}}))});
 await pause(150);assert.equal(h.saves.length,0);assert.equal(h.w.document.querySelector('.status').textContent,message);
 const details=h.w.document.getElementById('mumei-dash-history');details.open=true;await pause(20);assert.match(details.querySelector('textarea').value,/10:00:00.*READ_WAIT/);
 h.w.document.getElementById('mumei-dash-run').click();await saved(h);assert.doesNotMatch(h.w.document.querySelector('.status').textContent,/READ_WAIT/);
});

const officialMetrics=[['IMPRESSION','インプレッション'],['PAGE_VIEW','ページビュー'],['LIKE','スキ'],['COMMENT','コメント'],['SALES','売上']];
const officialMetricSelect=hidden=>`<div>${hidden?'<div aria-hidden="true">':''}<select id="metric">${officialMetrics.map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select>${hidden?'</div><button aria-label="グラフに表示する指標" aria-haspopup="listbox">インプレッション</button>':''}</div>`;
for(const hidden of [false,true])test('公式GraphQLの5指標を自動で読み、日別PVの0も保存する：native hidden='+hidden,async t=>{
 const changed=[],network=[];
 const h=page(t,'<p>2026/9/20〜2026/9/21</p><p>ページビュー 8</p>'+officialMetricSelect(hidden),{before:w=>{
  const original=w.fetch;w.fetch=async(url,init)=>{if(!String(url).includes('graphql.note.com'))return original(url);const request=JSON.parse(init.body);network.push(request);return Response.json({data:{dashboardMetricChart:{granularity:'DAY',points:[{label:'9/20',startDate:'2026-09-20',endDate:'2026-09-20',value:0},{label:'9/21',startDate:'2026-09-21',endDate:'2026-09-21',value:request.variables.metric==='PAGE_VIEW'?8:3}]},privateAccount:{secret:'must never be saved'}}})};
  w.document.getElementById('metric').onchange=()=>{const metric=w.document.getElementById('metric').value;changed.push(metric);void w.fetch('https://graphql.note.com/graphql',{method:'POST',body:JSON.stringify({operationName:'Dashboard_MetricChartQuery',variables:{metric,unit:'LAST_28_DAYS',date:'2026-09-21T00:00:00+09:00'}})})};
 }});
 await saved(h);assert.deepEqual(changed,['PAGE_VIEW','LIKE','COMMENT','SALES','IMPRESSION']);assert.equal(network.length,5);
 assert.deepEqual(h.saves[0].metricSeries.map(r=>r.pageViews),[0,8]);assert.equal(h.saves[0].metricSeries[1].likes,3);assert.equal(h.saves[0].metricSeries[1].salesYen,3);
 assert.doesNotMatch(JSON.stringify(h.saves),/must never be saved/);assert.deepEqual(h.warnings,[]);
 h.w.document.getElementById('mumei-dash-run').click();for(let i=0;i<100&&network.length<10;i++)await pause(20);await pause(150);assert.equal(network.length,10,'明示読み込みでは現在の5指標を再確認する');assert.equal(h.saves.length,1,'同じ値は重複保存しない');
});
test('キャッシュから表示され通信しない公式グラフも、実際のDAY pointsから自動取得する',async t=>{
 const h=page(t,'<p>2026/9/20〜2026/9/21</p><p>ページビュー 8</p>'+officialMetricSelect(false)+'<figure data-name="StackedBarChart"></figure>',{before:w=>{
  const render=()=>{const metric=w.document.getElementById('metric').selectedOptions[0].textContent;w.document.querySelector('figure').__reactFiber$fixture={memoizedProps:{},return:{alternate:{memoizedProps:{seriesLabel:metric,data:{granularity:'DAY',points:[{startDate:'2026-09-20',endDate:'2026-09-20',value:8},{startDate:'2026-09-21',endDate:'2026-09-21',value:0}]}}}}}};render();w.document.getElementById('metric').onchange=render;
 }});await saved(h);assert.equal(h.saves[0].metricSeries.length,2);assert.equal(h.saves[0].metricSeries[0].pageViews,8);assert.equal(h.saves[0].metricSeries[1].pageViews,0);
});
test('公式の「もっとみる」で記事の続きまで読み、マガジンへ移動しない',async t=>{
 let clicks=0,magazine=0;
 const h=page(t,'<p>ページビュー 8</p><button role="tab" aria-selected="true">記事</button><button role="tab" id="mag" aria-selected="false">マガジン</button><section><table><thead><tr><th>タイトル</th><th>ページビュー</th></tr></thead><tbody><tr><td>先頭の記事</td><td>3</td></tr></tbody></table><div><button id="more">もっとみる</button></div></section>',{before:w=>{
  w.document.getElementById('mag').onclick=()=>magazine++;
  w.document.getElementById('more').onclick=()=>{clicks++;w.document.querySelector('tbody').insertAdjacentHTML('beforeend',`<tr><td>続きの記事${clicks}</td><td>2</td></tr>`);if(clicks===2)w.document.getElementById('more').remove()};
 }});await saved(h);assert.equal(clicks,2);assert.equal(magazine,0);assert.equal(h.saves[0].articles.length,3);
});
test('履歴の開閉だけで読み込みを止めず、重複する詳細・縮小を表示しない',async t=>{
 const h=page(t,'<p>ページビュー 8</p><script type="application/json">{"page_views":{"2026-09-20":8}}</script>');
 await saved(h);const history=h.w.document.getElementById('mumei-dash-history');history.open=true;await pause(20);
 assert.match(history.querySelector('textarea').value,/保存/);history.open=false;
 assert.ok(h.w.document.getElementById('mumei-dash-run'));assert.equal(h.w.document.getElementById('mumei-dash-details'),null);assert.equal(h.w.document.getElementById('mumei-dash-toggle'),null);
});

test('URLが変わらない🔔表示ではパネル操作を止め、取得済みの保存は継続する',async t=>{
 let finish;const h=page(t,'<p>ページビュー 8</p><details><summary>日別グラフ</summary></details>',{stats:()=>new Promise(r=>finish=r),before:w=>{w.document.querySelector('summary').onclick=()=>void w.fetch('/api/v1/stats/daily')}});
 for(let i=0;i<60&&!finish;i++)await pause(10);
 const notice=h.w.document.createElement('section');notice.setAttribute('role','dialog');notice.setAttribute('aria-label','通知');notice.innerHTML='<button>通知</button><button>お知らせ</button>';h.w.document.body.append(notice);
 await pause(80);assert.equal(h.w.document.getElementById('mumei-dashboard-sync'),null);assert.equal(h.w.document.getElementById('mumei-dashboard-clearance'),null);
 finish({page_views:{'2026-09-20':8}});await saved(h);assert.equal(h.saves[0].contentSections.article.scope,'partial-read');
 notice.remove();await saved(h);assert.ok(h.w.document.getElementById('mumei-dashboard-sync'));assert.equal(h.saves[0].metricSeries[0].pageViews,8);assert.equal(h.diagnostics.length,0);
});
test('通知や通常記事へ移動したら残留パネルを消し、ダッシュボード復帰時だけ再表示する',async t=>{
 const h=page(t,'<p>ページビュー 8</p>',{watchHref:true});await saved(h);
 h.w.history.pushState(null,'','/notifications');await pause(100);assert.equal(h.w.document.getElementById('mumei-dashboard-sync'),null);assert.equal(h.w.document.getElementById('mumei-dashboard-clearance'),null);
 h.w.history.pushState(null,'','/tester/n/normal');await pause(100);assert.equal(h.w.document.getElementById('mumei-dashboard-sync'),null);
 h.w.history.pushState(null,'','/sitesettings/stats');await pause(180);assert.ok(h.w.document.getElementById('mumei-dashboard-sync'));assert.notEqual(h.w.getComputedStyle(h.w.document.getElementById('mumei-dashboard-sync')).display,'none');
});

test('バックグラウンドでは新しい読込を止め、取得済みの保存は継続する',async t=>{
 let visibility='visible',finish,identityCalls=0;
 const h=page(t,'<p>ページビュー 8</p><details><summary>日別グラフ</summary></details>',{stats:()=>new Promise(r=>finish=r),before:w=>{
  Object.defineProperty(w.document,'visibilityState',{get:()=>visibility});const fetch=w.fetch;w.fetch=(url,...args)=>{if(String(url).includes('current_user'))identityCalls++;return fetch(url,...args)};
  w.document.querySelector('summary').onclick=()=>void w.fetch('/api/v1/stats/daily');
 }});
 for(let i=0;i<60&&!finish;i++)await pause(10);
 visibility='hidden';h.w.document.dispatchEvent(new h.w.Event('visibilitychange'));const before=identityCalls;
 finish({page_views:{'2026-09-20':8}});await saved(h);assert.equal(h.saves[0].metricSeries[0].pageViews,8);
 h.w.document.dispatchEvent(new h.w.Event('mumei-dashboard-read'));await pause(100);assert.ok(identityCalls>=before);
 visibility='visible';h.w.document.dispatchEvent(new h.w.Event('visibilitychange'));await pause(100);assert.equal(h.saves.length,1);assert.equal(h.saves[0].metricSeries[0].pageViews,8);
});

test('365日の週月グラフを日別未取得の原因として示し、合計の保存は区別する',async t=>{
 const h=page(t,'<p>2025/9/28〜2026/9/27</p><p>ページビュー 120236</p>');await saved(h);
 assert.match(h.w.document.querySelector('.status').textContent,/32日以上.*週・月単位.*記事別は保存済み/);
 assert.match(h.w.document.getElementById('mumei-dash-brief').textContent,/グラフは週・月単位/);
 assert.doesNotMatch(h.w.document.querySelector('.status').textContent,/同期完了/);assert.equal(h.saves[0].metricSeries.length,0);
});
test('コンパクト表示でも期間変更による停止理由が読める',async t=>{
 const h=page(t,'<p>ページビュー 8</p>');await saved(h);
 const show=message=>h.w.document.dispatchEvent(new h.w.CustomEvent('mumei-dashboard-status',{detail:{message,kind:'warn'}}));
 show('表示期間または画面が変わりました [VIEW_CHANGED]');assert.equal(h.w.document.getElementById('mumei-dash-brief').textContent,'期間・画面変更で停止');
});

for(const requested of ['all','week'])test('指定期間を一度だけ自動選択し、日別と全期間の月別を混ぜず本人の保存を照合する: '+requested,async t=>{
 const changed=[];const h=page(t,'<select id="period"><option value="LAST_28_DAYS">過去28日間</option><option value="LAST_7_DAYS">過去7日間</option><option value="ALL">全期間</option></select><p id="range">2026/8/31〜2026/9/27</p><p id="total">ページビュー 8</p>'+officialMetricSelect(false)+'<figure data-name="StackedBarChart"></figure>',{before:w=>{
  w.sessionStorage.setItem('mumei-dashboard-requested-period',JSON.stringify({period:requested,noteId:'tester'}));
  const render=()=>{const all=w.document.getElementById('period').value==='ALL',metric=w.document.getElementById('metric').selectedOptions[0].textContent;w.document.getElementById('range').textContent=all?'全期間':'2026/9/21〜2026/9/27';w.document.getElementById('total').textContent='ページビュー '+(all?1000:7);w.document.querySelector('figure').__reactFiber$fixture={memoizedProps:{seriesLabel:metric,data:{granularity:all?'MONTH':'DAY',points:all?[{startDate:'2025-01-01',endDate:'2025-01-31',value:600},{startDate:'2025-02-01',endDate:'2025-02-28',value:400}]:Array.from({length:7},(_,i)=>({startDate:'2026-09-'+(21+i),endDate:'2026-09-'+(21+i),value:1}))}}}};
  render();w.document.getElementById('period').onchange=()=>{changed.push(w.document.getElementById('period').value);if(requested!=='all')render();else{w.document.getElementById('range').textContent='全期間';w.document.getElementById('total').textContent='ページビュー 1000'}};w.document.getElementById('metric').onchange=render;
 }});
 await saved(h);assert.deepEqual(changed,[requested==='all'?'ALL':'LAST_7_DAYS']);assert.equal(h.saves[0].periodType,requested);assert.equal(h.saves[0].metricSeries.length,requested==='all'?0:7);assert.equal(h.saves[0].chartSeries.length,requested==='all'?2:7);assert.equal(h.saves[0].totals.pageViews,requested==='all'?1000:7);assert.equal(h.saves[0].chartSeries[0].likes,requested==='all'?600:1);assert.match(h.w.document.querySelector('.status').textContent,/同期完了/);assert.deepEqual(h.warnings,[]);assert.equal(h.w.sessionStorage.getItem('mumei-dashboard-requested-period'),null);
});


for(const path of ['/dashboard-extra','/sitesettings/stats-extra'])test('公式ダッシュボードに似た別URLへパネルを出さない：'+path,async t=>{
 const h=page(t,'<p>アクセス状況 ページビュー 99</p>',{url:'https://note.com'+path,watchHref:true});
 await pause(150);
 assert.equal(h.w.document.getElementById('mumei-dashboard-sync'),null);
 assert.equal(h.saves.length,0);
});
test('HTTP 402は保存先利用制限として表示して再保存を続けない',async t=>{
 const h=page(t,'<p>ページビュー 8</p>',{before:w=>{
  w.GM_xmlhttpRequest=o=>queueMicrotask(()=>o.onload({status:402,responseText:'{}'}));
 }});
 for(let i=0;i<100&&!h.w.document.querySelector('.status')?.textContent.includes('HTTP_402');i++)await pause(20);
 assert.match(h.w.document.querySelector('.status')?.textContent||'',/HTTP_402/);
 assert.equal(h.w.document.getElementById('mumei-dash-brief')?.textContent,'保存先が利用制限中');
});
