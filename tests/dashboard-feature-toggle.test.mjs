import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import ts from 'typescript';

const read=p=>readFileSync(p,'utf8'),KEY='mumei_insight_dashboard_feature_enabled_v1';
const bridge=read('public/note-insight-dashboard-feature-bridge-v1.js'),core=read('public/note-insight-dashboard-sync-core-v1.1.0.js'),wrapper=read('public/note-insight-dashboard-sync.user.js');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label='condition'){for(let i=0;i<100;i++){if(fn())return;await pause(20)}assert.ok(fn(),label)}
function harness(t,{enabled=true,automatic=true,legacy=false,listener=true,failWrite=false,identity,stats}={}){
 const values=new Map([[KEY,enabled],['mumei_insight_dashboard_auto_enabled_v1',automatic],['mumei_insight_notification_feature_enabled_v1',true]]),listeners=[],calls=[];
 function create(url,html){const dom=new JSDOM(html,{url,runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;t.after(()=>w.close());
  const native=w.setTimeout.bind(w);w.setTimeout=(fn,ms,...a)=>native(fn,ms>=10000?ms:Math.min(ms,20),...a);w.setInterval=()=>1;
  w.HTMLElement.prototype.getBoundingClientRect=()=>({width:360,height:150});w.matchMedia=()=>({matches:true});w.performance.getEntriesByType=()=>[];
  Object.defineProperty(w.document.body,'innerText',{get(){return this.textContent}});
  const get=(k,d)=>values.has(k)?values.get(k):d,set=(k,v)=>{if(failWrite)throw Error('fixture-save-failed');const old=values.get(k);values.set(k,v);for(const l of listeners)if(l.k===k)l.fn(k,old,v,l.w!==w)},listen=(k,fn)=>listeners.push({k,fn,w});
  const request=o=>{const body=JSON.parse(o.data);calls.push(body);const saved=calls.findLast(x=>x.action==='ingest');const p=body.action==='ingest'?{ok:true,snapshotId:1,capturedAt:'2026-09-27T00:00:00Z'}:body.snapshotId?{ok:true,paired:true,noteId:'tester',snapshotId:1,confirmed:true,articleCount:saved.articles.length,dailyPvDays:saved.metricSeries.filter(x=>x.pageViews!==null).length,dailyMetricCount:saved.metricSeries.length,totals:saved.totals}:{ok:true,paired:true,noteId:'tester'};queueMicrotask(()=>o.onload({status:200,responseText:JSON.stringify(p)}))};
  if(legacy){w.GM_getValue=get;w.GM_setValue=set;w.GM_xmlhttpRequest=request;if(listener)w.GM_addValueChangeListener=listen}else w.GM={getValue:async(...a)=>get(...a),setValue:async(...a)=>set(...a),xmlHttpRequest:request,...(listener?{addValueChangeListener:listen}:{})};
  w.postMessage=data=>native(()=>w.dispatchEvent(new w.MessageEvent('message',{origin:w.location.origin,data})),0);
  w.fetch=async url=>{calls.push({action:'fetch',url:String(url)});return String(url).includes('current_user')&&identity?identity():Response.json(String(url).includes('/stats')&&stats?stats:{data:{urlname:'tester'}})};
  w.localStorage.setItem('mumei-dashboard-note-id-v1','tester');w.localStorage.setItem('mumei-dashboard-ingest-token-v1','fixture');
  w.eval(bridge);return w;
 }
 const markup='<main><h1>アクセス状況</h1><p>ページビュー 3</p><script type="application/json">{"page_views":{"2026-09-27":3}}</script></main>';
 function note(html=markup){const w=create('https://note.com/sitesettings/stats',html);w.eval(core);w.eval(wrapper);return w}
 function app(){const w=create('https://mumei-s.github.io/note-insight/','<div class="miv5-update"><div class="miv5-source-grid"><div class="miv5-source-card dashboard"><button class="miv5-source-main">分析</button><a class="miv5-install-link miv5-dashboard-settings" href="./dashboard-setup.html">設定・更新</a></div><div class="miv5-source-card notice"><button class="miv5-source-main">本人通知</button></div></div></div>');w.eval('(()=>{'+ts.transpileModule(read('src/insight-top-install-v16.ts').replace('export {};',''),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText+'})()');return w}
 return {values,calls,create,note,app};
}

for(const mode of ['modern','legacy','focus'])test('ダッシュボードOFFを保存し、再訪・別タブ・ONへの復帰に反映する: '+mode,async t=>{
 const h=harness(t,{legacy:mode==='legacy',listener:mode!=='focus'}),app=h.app(),w=h.note();
 const button=()=>app.document.querySelector('.mumei-dashboard-feature-toggle');
 await until(()=>button()?.textContent==='ダッシュボード パネル ON'&&h.calls.some(x=>x.action==='ingest'));
 button().click();await until(()=>button().textContent==='ダッシュボード パネル OFF');if(mode==='focus')w.dispatchEvent(new w.Event('focus'));
 await until(()=>!w.document.querySelector('#mumei-dashboard-sync'));
 const count=h.calls.length;w.dispatchEvent(new w.Event('pageshow'));w.document.dispatchEvent(new w.Event('mumei-dashboard-read'));w.document.querySelector('main').append(w.document.createElement('div'));await pause(160);assert.equal(h.calls.length,count,'OFF中の再読込なし');
 const revisit=h.note();await revisit.__mumeiDashboardFeatureV1.ready;await pause(100);assert.equal(revisit.document.querySelector('#mumei-dashboard-sync'),null);assert.equal(h.calls.length,count,'OFF再訪で本人取得もしない');assert.equal(revisit.fetch.__mumeiDashboardCapture,undefined,'OFF起動では通信の監視を設置しない');
 assert.equal(h.values.get('mumei_insight_notification_feature_enabled_v1'),true,'🔔の設定は独立');
 button().click();await until(()=>button().textContent==='ダッシュボード パネル ON');if(mode==='focus')w.dispatchEvent(new w.Event('focus'));await until(()=>w.document.querySelector('#mumei-dashboard-sync'));
});

test('公式パネルのOFFを押すと即消え、次回起動でもOFFを維持する',async t=>{
 const h=harness(t),w=h.note();await until(()=>w.document.querySelector('#mumei-dash-feature-off'));
 w.document.querySelector('#mumei-dash-feature-off').click();await until(()=>h.values.get(KEY)===false&&!w.document.querySelector('#mumei-dashboard-sync'));
 assert.equal(w.document.querySelector('#mumei-dashboard-clearance'),null);assert.ok(w.document.querySelector('main'),'公式画面は保持');
 const next=h.note();await next.__mumeiDashboardFeatureV1.ready;await pause(80);assert.equal(next.document.querySelector('#mumei-dashboard-sync'),null);
});

test('ダッシュボードから汎用🔔シートを開くと、URLが同じでもパネルを隠す',async t=>{
 const h=harness(t),w=h.note();await until(()=>h.calls.some(x=>x.action==='ingest'));
 const sheet=w.document.createElement('section');sheet.innerHTML='<nav><a href="#notices">通知</a><a href="#news">お知らせ</a></nav><article>人物さんがマガジンに記事を追加しました 1分前</article>';w.document.body.append(sheet);
 await until(()=>w.document.documentElement.getAttribute('data-mumei-dashboard-surface')==='other');assert.equal(w.document.querySelector('#mumei-dashboard-sync'),null,'通知中はパネルDOM自体を残さない');
 const count=h.calls.length;w.document.dispatchEvent(new w.Event('mumei-dashboard-read'));await pause(100);assert.equal(h.calls.length,count,'通知中に読み込まない');
 sheet.hidden=true;await until(()=>w.document.documentElement.getAttribute('data-mumei-dashboard-surface')==='dashboard'&&w.document.querySelector('#mumei-dashboard-sync'));assert.ok(w.document.querySelector('#mumei-dashboard-sync'));
});

test('本人確認待ちにOFFにした場合、遅れた応答から保存・パネル復活を起こさない',async t=>{
 let finish;const h=harness(t,{identity:()=>new Promise(r=>finish=r)}),w=h.note();await until(()=>finish);
 await w.__mumeiDashboardFeatureV1.setEnabled(false);finish(Response.json({data:{urlname:'tester'}}));await pause(150);
 assert.equal(w.document.querySelector('#mumei-dashboard-sync'),null);assert.equal(h.calls.filter(x=>x.action!=='fetch').length,0);
});

test('設定保存の失敗ではOFF成功と表示せず、元のON状態を維持する',async t=>{
 const h=harness(t,{failWrite:true}),app=h.app();const b=()=>app.document.querySelector('.mumei-dashboard-feature-toggle');await until(()=>b()?.textContent==='ダッシュボード パネル ON');b().click();await until(()=>/保存失敗/.test(b().textContent));assert.equal(h.values.get(KEY),true);assert.equal(b().getAttribute('aria-pressed'),'true');assert.equal(b().disabled,false);
});

test('他オリジンのメッセージや本人通知の切替では設定を変更しない',async t=>{
 const h=harness(t),w=h.app();await w.__mumeiDashboardFeatureV1.ready;
 w.dispatchEvent(new w.MessageEvent('message',{origin:'https://example.test',data:{source:'mumei-dashboard-feature-ui-v1',type:'set',enabled:false}}));
 w.dispatchEvent(new w.MessageEvent('message',{origin:w.location.origin,data:{source:'mumei-notification-feature-ui-v1',type:'set',enabled:false}}));await pause(80);assert.equal(h.values.get(KEY),true);
});


test('本人確認待ちのOFF→ONは古い読込を止めて、新しい読込を一度だけ開始する',async t=>{
 let finish,requests=0;const h=harness(t,{identity:()=>++requests===1?new Promise(r=>finish=r):Response.json({data:{urlname:'tester'}})}),w=h.note();await until(()=>finish);
 await w.__mumeiDashboardFeatureV1.setEnabled(false);await w.__mumeiDashboardFeatureV1.setEnabled(true);finish(Response.json({data:{urlname:'tester'}}));
 await until(()=>h.calls.some(x=>x.action==='ingest'));await pause(100);assert.equal(h.calls.filter(x=>x.action==='ingest').length,1);assert.ok(w.document.querySelector('#mumei-dashboard-sync'));
});

for(const cls of ['m-navbarNoticeButton','m-navbarNotice__trigger','m-navbarNotice'])test('ヘッダーのベルだけで同期パネルを消さない：'+cls,async t=>{
 const h=harness(t),w=h.note(`<header><div class="${cls}"><button aria-label="通知を開く">🔔</button></div></header><main><h1>アクセス状況</h1><p>ページビュー 3</p><script type="application/json">{"page_views":{"2026-09-27":3}}</script></main>`);
 await until(()=>h.calls.some(x=>x.action==='ingest'));
 assert.equal(w.document.documentElement.getAttribute('data-mumei-dashboard-surface'),'dashboard');
 const panel=w.document.getElementById('mumei-dashboard-sync');assert.ok(panel);assert.notEqual(w.getComputedStyle(panel).display,'none');
 assert.equal(w.document.getElementById('mumei-dash-mode').textContent,'自動');
 assert.equal(w.document.getElementById('mumei-dash-settings').textContent,'ON/OFFは設定から');
 assert.match(w.document.getElementById('mumei-dash-settings').href,/dashboard-setup\.html/);
 assert.equal(w.getComputedStyle(w.document.getElementById('mumei-dash-mode')).height,'28px');
});

for(const legacy of [false,true])test('手動を再訪でも保存し、読込ボタンだけで実行、再び自動に切り替えられる：legacy='+legacy,async t=>{
 const h=harness(t,{automatic:false,legacy}),w=h.note();await w.__mumeiDashboardFeatureV1.ready;await pause(150);
 assert.ok(w.document.getElementById('mumei-dashboard-sync'));assert.equal(w.document.getElementById('mumei-dash-mode').textContent,'手動');
 assert.equal(h.calls.length,0,'手動起動で本人取得も保存も始めない');
 w.document.dispatchEvent(new w.Event('mumei-dashboard-read'));w.dispatchEvent(new w.Event('pageshow'));await pause(100);assert.equal(h.calls.length,0,'起動通知では手動を解除しない');
 w.document.getElementById('mumei-dash-run').click();await until(()=>h.calls.some(x=>x.action==='ingest'));
 const count=h.calls.length;const next=h.note();await next.__mumeiDashboardFeatureV1.ready;await pause(100);
 assert.equal(next.document.getElementById('mumei-dash-mode').textContent,'手動');assert.equal(h.calls.length,count);
 next.document.getElementById('mumei-dash-mode').click();await until(()=>h.values.get('mumei_insight_dashboard_auto_enabled_v1')===true&&h.calls.filter(x=>x.action==='ingest').length===2);
 assert.equal(w.document.getElementById('mumei-dash-mode').textContent,'自動','別タブにも反映');
});

test('自動から手動へ切り替えると進行中の読込を止め、遅れた応答から保存しない',async t=>{
 let finish;const h=harness(t,{identity:()=>new Promise(r=>finish=r)}),w=h.note();await until(()=>finish);
 w.document.getElementById('mumei-dash-mode').click();await until(()=>h.values.get('mumei_insight_dashboard_auto_enabled_v1')===false);
 finish(Response.json({data:{urlname:'tester'}}));await pause(100);
 assert.equal(h.calls.filter(x=>x.action==='ingest').length,0);assert.ok(w.document.getElementById('mumei-dashboard-sync'));
 assert.equal(w.document.getElementById('mumei-dash-mode').textContent,'手動');
 const count=h.calls.length;w.document.dispatchEvent(new w.Event('mumei-dashboard-read'));await pause(100);assert.equal(h.calls.length,count);
});

test('モードの設定保存に失敗した場合は元の自動を維持する',async t=>{
 const h=harness(t,{failWrite:true}),w=h.note();await until(()=>w.document.getElementById('mumei-dash-mode'));
 w.document.getElementById('mumei-dash-mode').click();await until(()=>/fixture-save-failed/.test(w.document.querySelector('#mumei-dashboard-sync .status').textContent));
 assert.equal(w.document.getElementById('mumei-dash-mode').textContent,'自動');assert.equal(h.values.get('mumei_insight_dashboard_auto_enabled_v1'),true);
});

test('手動では公式通信や通知画面からの復帰で自動保存せず、読込で取得済み値を保存する',async t=>{
 const h=harness(t,{automatic:false,stats:{page_views:{'2026-09-26':8}}}),w=h.note();await w.__mumeiDashboardFeatureV1.ready;await pause(80);
 await w.fetch('/api/v1/stats');await pause(100);
 const sheet=w.document.createElement('section');sheet.innerHTML='<nav><a>通知</a><a>お知らせ</a></nav>';w.document.body.append(sheet);
 await until(()=>!w.document.getElementById('mumei-dashboard-sync'));sheet.hidden=true;
 await until(()=>w.document.getElementById('mumei-dashboard-sync'));await pause(100);
 assert.equal(h.calls.filter(x=>x.action==='ingest').length,0);
 assert.equal(h.calls.filter(x=>x.url?.includes('current_user')).length,0);
 assert.equal(w.document.getElementById('mumei-dash-mode').textContent,'手動');
 w.document.getElementById('mumei-dash-run').click();await until(()=>h.calls.some(x=>x.action==='ingest'));
 assert.equal(h.calls.find(x=>x.action==='ingest').metricSeries.find(x=>x.date==='2026-09-26').pageViews,8);
});

test('小型パネルの停止で手動読込を止め、読込ボタンから再開できる',async t=>{
 let finish,requests=0;const h=harness(t,{automatic:false,identity:()=>++requests===1?new Promise(r=>finish=r):Response.json({data:{urlname:'tester'}})}),w=h.note();await w.__mumeiDashboardFeatureV1.ready;await until(()=>w.document.getElementById('mumei-dash-run'));
 w.document.getElementById('mumei-dash-run').click();await until(()=>finish);
 assert.equal(w.document.getElementById('mumei-dash-run').textContent,'停止');w.document.getElementById('mumei-dash-run').click();
 finish(Response.json({data:{urlname:'tester'}}));await until(()=>w.document.getElementById('mumei-dash-run').textContent==='読込');
 assert.equal(h.calls.filter(x=>x.action==='ingest').length,0);
 w.document.getElementById('mumei-dash-run').click();await until(()=>h.calls.some(x=>x.action==='ingest'));
 assert.equal(h.calls.filter(x=>x.action==='ingest').length,1);
 assert.equal(w.document.getElementById('mumei-dash-mode').textContent,'手動');
});
