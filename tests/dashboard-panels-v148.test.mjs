import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

const core=readFileSync('public/note-insight-dashboard-sync-core-v1.1.0.js','utf8');
const wrapper=readFileSync('public/note-insight-dashboard-sync.user.js','utf8');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
function page(t,markup,{paired=true,stats=async()=>({}),before,url='https://note.com/sitesettings/stats'}={}){
  const dom=new JSDOM(`<main><h1>アクセス状況</h1>${markup}</main>`,{url,runScripts:'outside-only'}),w=dom.window,saves=[],nav=[];
  t.after(()=>w.close());
  Object.defineProperty(w.document.body,'innerText',{get(){return this.textContent}});
  w.performance.getEntriesByType=()=>[];
  const timer=w.setTimeout.bind(w);w.setTimeout=(fn,ms,...args)=>timer(fn,ms<5000?Math.min(ms,15):ms,...args);w.setInterval=()=>1;
  if(paired){w.localStorage.setItem('mumei-dashboard-note-id-v1','tester');w.localStorage.setItem('mumei-dashboard-ingest-token-v1','fixture')}
  w.fetch=async url=>Response.json(String(url).includes('current_user')?{data:{user:{urlname:'tester'}}}:await stats(String(url)));
  w.GM_xmlhttpRequest=options=>{const body=JSON.parse(options.data);
    if(body.action==='sync-status'){const s=saves.at(-1);queueMicrotask(()=>options.onload({status:200,responseText:JSON.stringify(body.snapshotId?{ok:true,paired:true,noteId:'tester',snapshotId:saves.length,confirmed:true,articleCount:s.articles.length,dailyPvDays:s.metricSeries.filter(r=>r.pageViews!=null).length,dailyMetricCount:s.metricSeries.length,totals:s.totals}:{ok:true,paired:true,noteId:'tester'})}));return}
    saves.push(body);queueMicrotask(()=>options.onload({status:200,responseText:JSON.stringify({ok:true,snapshotId:saves.length,articleCount:body.articles.length,dailyPvDays:body.metricSeries.filter(r=>r.pageViews!=null).length,capturedAt:'2026-09-22T12:00:00Z'})}))};
  w.__location={get href(){return w.location.href},get origin(){return w.location.origin},get pathname(){return w.location.pathname},get search(){return w.location.search},assign:href=>nav.push(href)};
  before?.(w);w.eval(core.replace("'use strict';","'use strict'; const location=window.__location;"));w.eval(wrapper.replace("'use strict';","'use strict'; const location=window.__location;"));
  return {w,saves,nav};
}
async function saved(h,count=1){for(let i=0;i<100&&h.saves.length<count;i++)await pause(20);assert.equal(h.saves.length,count,h.w.document.querySelector('.status')?.textContent);await pause(20)}

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

test('期間を変えた後の公式データを自動保存し、前の期間の取得値を混ぜない',async t=>{
  const h=page(t,'<p id="range">2026年9月20日〜2026年9月20日</p><p>ページビュー 2</p>',{stats:async url=>({page_views:{[url.includes('2026-09-21')?'2026-09-21':'2026-09-20']:url.includes('2026-09-21')?9:2}}),before:w=>{w.performance.getEntriesByType=()=>[{name:'https://note.com/api/v1/stats/daily?date=2026-09-20'}]}});
  await h.w.fetch('/api/v1/stats/daily?date=2026-09-20');await saved(h);
  h.w.document.getElementById('range').textContent='2026年9月21日〜2026年9月21日';
  await h.w.fetch('/api/v1/stats/daily?date=2026-09-21');await saved(h,2);
  assert.deepEqual(JSON.parse(JSON.stringify(h.saves[1].metricSeries.map(r=>[r.date,r.pageViews]))),[['2026-09-21',9]]);
  h.w.document.getElementById('mumei-dash-read').click();await pause(250);assert.equal(h.saves.length,2,'同じデータを二重保存しない');
});

test('未連携の通常訪問では手順を表示し、保存やパネル展開を勝手に進めない',async t=>{
  const h=page(t,'<details><summary>日別アクセス</summary><p>ページビュー 8</p></details>',{paired:false});await pause(120);
  assert.equal(h.saves.length,0);assert.equal(h.w.document.querySelector('details').open,false);assert.match(h.w.document.querySelector('.status').textContent,/連携/);
});

test('連携が失効した場合は保存完了を出さず、接続し直す画面へ案内する',async t=>{
  const h=page(t,'<p>ページビュー 8</p>',{before:w=>{w.GM_xmlhttpRequest=opts=>queueMicrotask(()=>opts.onload({status:401,responseText:JSON.stringify({ok:false,error:'INGEST_TOKEN_INVALID'})}))}});
  for(let i=0;i<100&&!h.w.document.querySelector('.status')?.textContent.includes('連携が無効');i++)await pause(20);
  assert.match(h.w.document.querySelector('.status').textContent,/連携が無効/);assert.equal(h.w.document.querySelector('.status').dataset.kind,'warn');
  const action=h.w.document.getElementById('mumei-dash-read');assert.equal(action.dataset.action,'connect');assert.equal(action.textContent,'連携して読み込む');action.click();await pause(30);assert.equal(new URL(h.nav[0]).searchParams.get('account'),'tester');assert.equal(new URL(h.nav[0]).searchParams.get('auto'),'1');
  assert.equal(h.w.localStorage.getItem('mumei-dashboard-last-sync'),null);
});

test('ARIA指定のない詳細ボタンでも、公式のグラフ部分を展開する',async t=>{
  const h=page(t,'<section><h2>日別アクセスグラフ</h2><button id="more">詳細を見る</button><div id="values" hidden>ページビュー 8</div></section>',{before:w=>{w.document.getElementById('more').onclick=()=>{w.document.getElementById('values').hidden=false;w.document.getElementById('more').textContent='閉じる'}}});
  await saved(h);assert.equal(h.w.document.getElementById('values').hidden,false);assert.equal(h.saves[0].contentSections.openedPanels,1);assert.equal(h.saves[0].totals.pageViews,8);
});

test('公式の未連携ボタンから設定・本人照合・日別保存・分析復帰までつながる',async t=>{
 const entry=page(t,'<p>ページビュー 8</p>',{paired:false});await pause(100);
 const connect=entry.w.document.getElementById('mumei-dash-read');assert.equal(connect.textContent,'連携して読み込む');assert.equal(connect.disabled,false);connect.click();await pause(30);
 const setupUrl=new URL(entry.nav[0]);assert.equal(setupUrl.pathname,'/note-insight/dashboard-setup.html');assert.equal(setupUrl.searchParams.get('auto'),'1');assert.equal(setupUrl.searchParams.get('account'),'tester');
 const setup=new JSDOM(readFileSync('public/dashboard-setup.html','utf8'),{url:setupUrl.href,runScripts:'outside-only'}),w=setup.window,setupNav=[],pairCalls=[];
 const observers=[],Observer=w.MutationObserver;w.MutationObserver=class extends Observer{constructor(fn){super(fn);observers.push(this)}};t.after(()=>{observers.forEach(o=>o.disconnect());w.close()});w.localStorage.setItem('mumei-insight-access-token','member-fixture');w.localStorage.setItem('mumei-insight-active-account-v3','tester');
 w.__location={get href(){return w.location.href},get search(){return w.location.search},get origin(){return w.location.origin},assign:href=>setupNav.push(href)};
 const release=JSON.parse(readFileSync('public/insight-release.json','utf8'));
 w.fetch=async(url,init={})=>{if(String(url).includes('insight-release.json'))return Response.json(release);pairCalls.push(init);assert.equal(JSON.parse(init.body).action,'pair-start');assert.equal(init.headers['X-Insight-Token'],'member-fixture');return Response.json({ok:true,noteId:'tester',pairingCode:'12345678'})};
 w.eval(wrapper);w.eval(readFileSync('public/dashboard-setup.js','utf8').replace("'use strict';","'use strict'; const location=window.__location;"));await pause(50);
 assert.equal(pairCalls.length,1);assert.equal(setupNav.length,1);assert.ok(!setupNav[0].includes('member-fixture'));
 const requests=[];let stored;
 const official=page(t,'<p>ページビュー 8</p><details><summary>日別アクセスグラフ</summary><script type="application/json">{"page_views":{"2026-09-21":8}}</script></details>',{paired:false,url:setupNav[0],before:w=>{
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
 assert.equal(official.w.document.getElementById('mumei-dash-read').dataset.action,'read');
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

test('記事・マガジン・メンバーシップを巡回し、期間ボタンには触れない',async t=>{
 const h=page(t,'<p>全体ビュー 12</p><button role="tab" aria-selected="true">記事</button><button role="tab" aria-selected="false">マガジン</button><button role="tab" aria-selected="false">メンバーシップ</button><button role="tab" id="month">月</button><section id="items"></section>',{before:w=>{
  const render=name=>w.document.querySelector('#items').innerHTML=`<table><thead><tr><th>タイトル</th><th>PV</th></tr></thead><tbody><tr><td>${name}</td><td>4</td></tr></tbody></table>`;render('記事');
  for(const el of [...w.document.querySelectorAll('[aria-selected]')])el.onclick=()=>{for(const tab of w.document.querySelectorAll('[aria-selected]'))tab.setAttribute('aria-selected',String(tab===el));render(el.textContent)};
  w.document.querySelector('#month').onclick=()=>assert.fail('期間を変えない');
 }});
 await saved(h);assert.deepEqual(h.saves[0].articles.map(r=>r.contentType),['article','magazine','membership']);
});

test('失効をパネル操作の前に検知し、読取に見せかけた画面変更をしない',async t=>{
 const h=page(t,'<details><summary>記事アクセス</summary><p>ページビュー 12</p></details>',{before:w=>{
  w.GM_xmlhttpRequest=o=>{assert.equal(JSON.parse(o.data).action,'sync-status');queueMicrotask(()=>o.onload({status:401,responseText:'{"ok":false,"error":"INGEST_TOKEN_INVALID"}'}))};
 }});
 await pause(100);assert.equal(h.w.document.querySelector('details').open,false);assert.equal(h.w.localStorage.getItem('mumei-dashboard-ingest-token-v1'),null);assert.equal(h.w.document.getElementById('mumei-dash-read').dataset.action,'connect');assert.equal(h.saves.length,0);
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
 h.w.history.pushState(null,'','/sitesettings/stats');h.w.dispatchEvent(new h.w.PopStateEvent('popstate'));
 await saved(h);assert.equal(h.saves[0].totals.pageViews,12);
});

test('保存中に遅い公式データが届いた時は追加保存するまで完了にしない',async t=>{
 let release;
 const h=page(t,'<p id="pv">ページビュー 12</p>',{stats:async()=>({page_views:{'2026-09-25':20}}),before:w=>{
  const send=w.GM_xmlhttpRequest;let first=true;
  w.GM_xmlhttpRequest=o=>{if(first&&JSON.parse(o.data).action==='ingest'){first=false;release=()=>send(o)}else send(o)};
 }});
 for(let i=0;i<100&&!release;i++)await pause(20);assert.ok(release);
 h.w.document.getElementById('pv').textContent='ページビュー 20';await h.w.fetch('/api/v1/stats/daily');await pause(20);release();
 await saved(h,2);assert.equal(h.saves[1].totals.pageViews,20);assert.equal(h.saves[1].metricSeries[0].pageViews,20);assert.match(h.w.document.querySelector('.status').textContent,/同期完了/);
});
