import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

const core=readFileSync('public/note-insight-dashboard-sync-core-v1.1.0.js','utf8');
const wrapper=readFileSync('public/note-insight-dashboard-sync.user.js','utf8');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
function page(t,markup,{paired=true,stats=async()=>({}),before}={}){
  const dom=new JSDOM(`<main><h1>アクセス状況</h1>${markup}</main>`,{url:'https://note.com/sitesettings/stats',runScripts:'outside-only'}),w=dom.window,saves=[];
  t.after(()=>w.close());
  Object.defineProperty(w.document.body,'innerText',{get(){return this.textContent}});
  w.performance.getEntriesByType=()=>[];
  const timer=w.setTimeout.bind(w);w.setTimeout=(fn,ms,...args)=>timer(fn,ms<5000?Math.min(ms,15):ms,...args);w.setInterval=()=>1;
  if(paired){w.localStorage.setItem('mumei-dashboard-note-id-v1','tester');w.localStorage.setItem('mumei-dashboard-ingest-token-v1','fixture')}
  w.fetch=async url=>Response.json(String(url).includes('current_user')?{data:{user:{urlname:'tester'}}}:await stats(String(url)));
  w.GM_xmlhttpRequest=options=>{const body=JSON.parse(options.data);saves.push(body);queueMicrotask(()=>options.onload({status:200,responseText:JSON.stringify({ok:true,snapshotId:saves.length,articleCount:body.articles.length,dailyPvDays:body.metricSeries.filter(r=>r.pageViews!=null).length,capturedAt:'2026-09-22T12:00:00Z'})}))};
  before?.(w);w.eval(core);w.eval(wrapper);
  return {w,saves};
}
async function saved(h,count=1){for(let i=0;i<100&&h.saves.length<count;i++)await pause(20);assert.equal(h.saves.length,count,h.w.document.querySelector('.status')?.textContent);await pause(20)}

test('折りたたみを開いて遅い日別通信を待ち、記事と公式合計を一度で保存する',async t=>{
  let finish,requested=false;
  const h=page(t,'<div><strong>1,234</strong><span>全体ビュー</span></div><div><strong>56</strong><span>スキ</span></div><details id="daily"><summary>日別アクセスグラフ</summary><div id="chart"></div></details><details id="articles"><summary>記事のアクセス状況</summary><table><thead><tr><th>タイトル</th><th>PV</th></tr></thead><tbody><tr><td><a href="https://note.com/tester/n/n1">記事</a></td><td>1234</td></tr></tbody></table></details>',{
    stats:()=>new Promise(resolve=>{requested=true;finish=resolve}),
    before:w=>w.document.querySelector('#daily summary').addEventListener('click',()=>void w.fetch('/api/v1/stats/daily')),
  });
  for(let i=0;i<40&&!requested;i++)await pause(10);
  assert.equal(requested,true);assert.equal(h.w.document.querySelector('#daily').open,true);assert.equal(h.w.document.querySelector('#articles').open,true);
  await pause(100);assert.equal(h.saves.length,0,'通信が終わる前に部分保存しない');
  finish({page_views:{'2026-09-20':0,'2026-09-21':1234}});await saved(h);
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
  const link=h.w.document.getElementById('mumei-dash-reconnect');assert.equal(link.hidden,false);assert.equal(new URL(link.href).searchParams.get('account'),'tester');
  assert.equal(h.w.localStorage.getItem('mumei-dashboard-last-sync'),null);
});

test('ARIA指定のない詳細ボタンでも、公式のグラフ部分を展開する',async t=>{
  const h=page(t,'<section><h2>日別アクセスグラフ</h2><button id="more">詳細を見る</button><div id="values" hidden>ページビュー 8</div></section>',{before:w=>{w.document.getElementById('more').onclick=()=>{w.document.getElementById('values').hidden=false;w.document.getElementById('more').textContent='閉じる'}}});
  await saved(h);assert.equal(h.w.document.getElementById('values').hidden,false);assert.equal(h.saves[0].contentSections.openedPanels,1);assert.equal(h.saves[0].totals.pageViews,8);
});
