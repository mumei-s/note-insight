import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import { browserSourceModule } from './browser-source-module.mjs';
import {webcrypto} from 'node:crypto';

const read=p=>readFileSync(p,'utf8'),KEY='mumei_insight_dashboard_feature_enabled_v1';
const bridge=read('public/note-insight-dashboard-feature-bridge-v1.js'),core=read(process.env.DASHBOARD_CORE_SOURCE||'public/note-insight-dashboard-sync-core-v1.1.0.js'),wrapper=read('public/note-insight-dashboard-sync.user.js');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label='condition'){for(let i=0;i<100;i++){if(fn())return;await pause(20)}assert.ok(fn(),label)}
function harness(t,{enabled=true,automatic=true,legacy=false,listener=true,failWrite=false,identity,stats,readOnStart=true}={}){
 const values=new Map([[KEY,enabled],['mumei_insight_dashboard_auto_enabled_v1',automatic],['mumei_insight_notification_feature_enabled_v1',true]]),listeners=[],calls=[];
 function create(url,html){const dom=new JSDOM(html,{url,runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;t.after(()=>w.close());
  const native=w.setTimeout.bind(w);w.setTimeout=(fn,ms,...a)=>native(fn,ms>=10000?ms:Math.min(ms,20),...a);w.setInterval=()=>1;
  Object.defineProperty(w.crypto,'subtle',{value:webcrypto.subtle});w.TextEncoder=TextEncoder;
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
 function note(html=markup,url='https://note.com/sitesettings/stats'){const w=create(url,html);w.eval(read('public/note-insight-dashboard-save-queue-v1.js'));w.eval(core);w.eval(wrapper);if(readOnStart&&enabled&&/^\/(?:dashboard|sitesettings\/stats)(?:\/|$)/.test(w.location.pathname))w.setTimeout(()=>w.document.dispatchEvent(new w.CustomEvent('mumei-dashboard-read',{detail:{automatic:false}})),50);return w}
 function app(){const w=create('https://mumei-s.github.io/note-insight/','<div class="miv5-update"><div class="miv5-source-grid"><div class="miv5-source-card dashboard"><button class="miv5-source-main">分析</button><a class="miv5-install-link miv5-dashboard-settings" href="./dashboard-setup.html">設定・更新</a></div><div class="miv5-source-card notice"><button class="miv5-source-main">本人通知</button></div></div></div>');browserSourceModule(w,'src/insight-top-install-v16.ts');return w}
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

const accountActions='<a href="/dashboard">ダッシュボード</a><a href="/settings">設定</a><a href="/notes">自分の記事</a><a href="/notes?status=draft">下書き</a>';
for(const kind of ['account-sheet','menu','dialog','native-dialog','modal'])test('前面メニューの開閉だけでパネルと余白を隠して戻す：'+kind,async t=>{
 const h=harness(t,{readOnStart:false}),w=h.note();await until(()=>w.document.getElementById('mumei-dashboard-sync'));
 w.document.dispatchEvent(new w.CustomEvent('mumei-dashboard-status',{detail:{message:'同期完了｜記事298件・日別PV 28日',kind:'ok'}}));
 const before=JSON.stringify({...w.localStorage}),href=w.location.href,calls=h.calls.length;
 const sheet=w.document.createElement(kind==='native-dialog'?'dialog':'section');sheet.hidden=true;
 if(kind==='menu'||kind==='dialog')sheet.setAttribute('role',kind);
 if(kind==='modal')sheet.setAttribute('aria-modal','true');
 if(kind==='native-dialog')sheet.open=true;
 sheet.innerHTML=kind==='account-sheet'?accountActions:'<button>閉じる</button>';w.document.body.append(sheet);
 for(let i=0;i<3;i++){
  sheet.hidden=false;await until(()=>!w.document.getElementById('mumei-dashboard-sync'));
  assert.equal(w.document.getElementById('mumei-dashboard-clearance'),null);assert.equal(w.location.href,href);
  w.document.dispatchEvent(new w.CustomEvent('mumei-dashboard-read',{detail:{automatic:false}}));
  w.dispatchEvent(new w.Event('pageshow'));await pause(60);assert.equal(w.document.getElementById('mumei-dashboard-sync'),null);
  sheet.hidden=true;await until(()=>w.document.getElementById('mumei-dashboard-sync'));
  assert.equal(w.document.querySelectorAll('#mumei-dashboard-sync').length,1);assert.equal(w.document.querySelectorAll('#mumei-dashboard-clearance').length,1);
  assert.match(w.document.getElementById('mumei-dash-brief').textContent,/保存済み.*記事298件・日別PV 28日/);
 }
 assert.equal(h.calls.length,calls,'開閉・再表示で追加の読込や通信を行わない');assert.equal(JSON.stringify({...w.localStorage}),before,'接続・履歴・保存状態を変更しない');assert.equal(h.values.get(KEY),true);
});

test('初期表示中のアカウントメニューも隠し、OFFにしたまま閉じても復活させない',async t=>{
 const h=harness(t,{readOnStart:false}),w=h.note('<main><h1>アクセス状況</h1></main><section id="account-sheet">'+accountActions+'</section>');
 await pause(80);assert.equal(w.document.getElementById('mumei-dashboard-sync'),null);
 await w.__mumeiDashboardFeatureV1.setEnabled(false);w.document.getElementById('account-sheet').remove();w.dispatchEvent(new w.Event('pageshow'));await pause(80);
 assert.equal(w.document.getElementById('mumei-dashboard-sync'),null);assert.equal(h.values.get(KEY),false);assert.equal(h.calls.length,0);
 await w.__mumeiDashboardFeatureV1.setEnabled(true);await until(()=>w.document.getElementById('mumei-dashboard-sync'));assert.equal(h.calls.length,0);
});

test('メニュー表示中の別画面移動と戻る・進むでも公式画面だけに一つ復元する',async t=>{
 const h=harness(t,{readOnStart:false}),w=h.note();await until(()=>w.document.getElementById('mumei-dashboard-sync'));
 const sheet=w.document.createElement('section');sheet.innerHTML=accountActions;w.document.body.append(sheet);await until(()=>!w.document.getElementById('mumei-dashboard-sync'));
 w.history.pushState(null,'','/notes');sheet.remove();await pause(80);assert.equal(w.document.getElementById('mumei-dashboard-sync'),null);
 w.history.back();await until(()=>w.location.pathname==='/sitesettings/stats'&&w.document.getElementById('mumei-dashboard-sync'));
 w.history.forward();await until(()=>w.location.pathname==='/notes'&&!w.document.getElementById('mumei-dashboard-sync'));
 w.history.back();await until(()=>w.location.pathname==='/sitesettings/stats'&&w.document.getElementById('mumei-dashboard-sync'));
 assert.equal(w.document.querySelectorAll('#mumei-dashboard-sync').length,1);assert.equal(h.calls.length,0);
});

test('通常本文のリンクや非表示メニューと公式の指標・期間ポップアップでは隠さない',async t=>{
 const h=harness(t,{readOnStart:false}),w=h.note('<main><h1>アクセス状況</h1>'+accountActions+'<button aria-label="グラフに表示する指標" aria-haspopup="listbox" aria-controls="metrics">ページビュー</button><button aria-label="期間選択" aria-haspopup="listbox" aria-controls="periods">過去30日間</button></main>');
 await until(()=>w.document.getElementById('mumei-dashboard-sync'));
 const sheet=w.document.createElement('section');sheet.hidden=true;sheet.innerHTML=accountActions;w.document.body.append(sheet);
 for(const [id,options] of [['metrics','ページビュー スキ'],['periods','過去30日間 全期間']]){
  const popup=w.document.createElement('section');popup.setAttribute('role','dialog');popup.innerHTML='<div role="menu"><div role="listbox" id="'+id+'">'+options.split(' ').map(s=>'<button role="option">'+s+'</button>').join('')+'</div></div>';w.document.body.append(popup);
  await pause(80);assert.ok(w.document.getElementById('mumei-dashboard-sync'),'公式の'+id+'はパネルを隠さない');popup.remove();
  const nested=w.document.createElement('section');nested.id=id;nested.innerHTML='<div role="dialog"><div role="menu">'+options.split(' ').map(s=>'<button role="option">'+s+'</button>').join('')+'</div></div>';w.document.body.append(nested);
  await pause(80);assert.ok(w.document.getElementById('mumei-dashboard-sync'),'公式の'+id+'の内部メニューもパネルを隠さない');nested.remove();
 }
 const header=w.document.createElement('header');header.innerHTML='<a href="/dashboard">ダッシュボード</a><a href="/settings">設定</a>';w.document.body.prepend(header);await pause(80);assert.ok(w.document.getElementById('mumei-dashboard-sync'),'別の場所の本文アクションと混同しない');assert.equal(h.calls.length,0);
});

test('DOMを再挿入しないrole/inert/open変更でも前面メニューの終了を検出する',async t=>{
 const h=harness(t,{readOnStart:false}),w=h.note();await until(()=>w.document.getElementById('mumei-dashboard-sync'));
 const sheet=w.document.createElement('section');sheet.innerHTML='<button>閉じる</button>';w.document.body.append(sheet);await pause(60);assert.ok(w.document.getElementById('mumei-dashboard-sync'));
 sheet.setAttribute('role','menu');await until(()=>!w.document.getElementById('mumei-dashboard-sync'));
 sheet.setAttribute('inert','');await until(()=>w.document.getElementById('mumei-dashboard-sync'));
 sheet.removeAttribute('inert');await until(()=>!w.document.getElementById('mumei-dashboard-sync'));
 sheet.remove();const dialog=w.document.createElement('dialog');dialog.innerHTML='<button>閉じる</button>';w.document.body.append(dialog);await until(()=>w.document.getElementById('mumei-dashboard-sync'));
 dialog.open=true;await until(()=>!w.document.getElementById('mumei-dashboard-sync'));dialog.open=false;await until(()=>w.document.getElementById('mumei-dashboard-sync'));assert.equal(h.calls.length,0);
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
 await pause(100);assert.equal(h.calls.filter(x=>x.action==='ingest').length,0);w.document.getElementById('mumei-dash-run').click();await until(()=>h.calls.some(x=>x.action==='ingest'));assert.equal(h.calls.filter(x=>x.action==='ingest').length,1);assert.ok(w.document.querySelector('#mumei-dashboard-sync'));
});


for(const automatic of [true,false])test('以前の自動設定に関係なく明示読み込みだけで開始する：'+automatic,async t=>{
 const h=harness(t,{automatic,readOnStart:false}),w=h.note(undefined,'https://note.com/dashboard');await pause(180);
 assert.ok(w.document.getElementById('mumei-dashboard-sync'));
 assert.equal(w.document.getElementById('mumei-dash-mode'),null);assert.equal(w.document.getElementById('mumei-dash-details'),null);
 assert.equal(w.document.getElementById('mumei-dash-run').textContent,'読み込み');
 assert.equal(h.calls.length,0);w.document.dispatchEvent(new w.Event('mumei-dashboard-read'));await pause(100);assert.equal(h.calls.length,0);
 assert.equal(w.document.getElementById('mumei-dash-settings').textContent,'ON/OFFはメイン🔔から');assert.equal(new URL(w.document.getElementById('mumei-dash-settings').href).pathname,'/note-insight/notification-connection.html');
 w.document.getElementById('mumei-dash-run').click();await until(()=>h.calls.some(x=>x.action==='ingest'));
 const count=h.calls.length,next=h.note();await pause(150);assert.equal(h.calls.length,count,'再訪で読み取りを始めない');
 assert.ok(next.document.getElementById('mumei-dash-history'));assert.equal(next.document.querySelectorAll('button').length,4,'読み込み・INSIGHT・OFF・履歴コピーだけ');
});
for(const path of ['/dashboard','/dashboard/','/dashboard/articles','/sitesettings/stats'])test('公式URLのパネルに読み込み・履歴・OFFを表示する：'+path,async t=>{
 const h=harness(t,{readOnStart:false}),w=h.note(undefined,'https://note.com'+path);await until(()=>w.document.getElementById('mumei-dash-run'));
 assert.equal(h.calls.length,0);w.document.getElementById('mumei-dash-run').click();await until(()=>h.calls.some(x=>x.action==='ingest'));
});
test('通常ページから公式画面へ移動しても自動読み込みせず、戻るとパネルを消す',async t=>{
 const h=harness(t,{readOnStart:false}),w=h.note(undefined,'https://note.com/tester/n/nfixture');await pause(100);assert.equal(h.calls.length,0);assert.equal(w.document.getElementById('mumei-dashboard-sync'),null);
 w.history.pushState(null,'','/dashboard');await until(()=>w.document.getElementById('mumei-dash-run'));await pause(100);assert.equal(h.calls.length,0);
 w.history.pushState(null,'','/tester/n/nfixture');await until(()=>!w.document.getElementById('mumei-dashboard-sync'));
});
