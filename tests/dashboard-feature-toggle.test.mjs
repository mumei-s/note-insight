import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import ts from 'typescript';

const read=p=>readFileSync(p,'utf8'),KEY='mumei_insight_dashboard_feature_enabled_v1';
const bridge=read('public/note-insight-dashboard-feature-bridge-v1.js'),core=read('public/note-insight-dashboard-sync-core-v1.1.0.js'),wrapper=read('public/note-insight-dashboard-sync.user.js');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label='condition'){for(let i=0;i<100;i++){if(fn())return;await pause(20)}assert.ok(fn(),label)}
function harness(t,{enabled=true,legacy=false,listener=true,failWrite=false,identity}={}){
 const values=new Map([[KEY,enabled],['mumei_insight_notification_feature_enabled_v1',true]]),listeners=[],calls=[];
 function create(url,html){const dom=new JSDOM(html,{url,runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;t.after(()=>w.close());
  const native=w.setTimeout.bind(w);w.setTimeout=(fn,ms,...a)=>native(fn,ms>=10000?ms:Math.min(ms,20),...a);w.setInterval=()=>1;
  w.HTMLElement.prototype.getBoundingClientRect=()=>({width:360,height:150});w.matchMedia=()=>({matches:true});w.performance.getEntriesByType=()=>[];
  Object.defineProperty(w.document.body,'innerText',{get(){return this.textContent}});
  const get=(k,d)=>values.has(k)?values.get(k):d,set=(k,v)=>{if(failWrite)throw Error('fixture-save-failed');const old=values.get(k);values.set(k,v);for(const l of listeners)if(l.k===k)l.fn(k,old,v,l.w!==w)},listen=(k,fn)=>listeners.push({k,fn,w});
  const request=o=>{const body=JSON.parse(o.data);calls.push(body);const saved=calls.findLast(x=>x.action==='ingest');const p=body.action==='ingest'?{ok:true,snapshotId:1,capturedAt:'2026-09-27T00:00:00Z'}:body.snapshotId?{ok:true,paired:true,noteId:'tester',snapshotId:1,confirmed:true,articleCount:saved.articles.length,dailyPvDays:saved.metricSeries.filter(x=>x.pageViews!==null).length,dailyMetricCount:saved.metricSeries.length,totals:saved.totals}:{ok:true,paired:true,noteId:'tester'};queueMicrotask(()=>o.onload({status:200,responseText:JSON.stringify(p)}))};
  if(legacy){w.GM_getValue=get;w.GM_setValue=set;w.GM_xmlhttpRequest=request;if(listener)w.GM_addValueChangeListener=listen}else w.GM={getValue:async(...a)=>get(...a),setValue:async(...a)=>set(...a),xmlHttpRequest:request,...(listener?{addValueChangeListener:listen}:{})};
  w.postMessage=data=>native(()=>w.dispatchEvent(new w.MessageEvent('message',{origin:w.location.origin,data})),0);
  w.fetch=async url=>{calls.push({action:'fetch',url:String(url)});return String(url).includes('current_user')&&identity?identity():Response.json({data:{urlname:'tester'}})};
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
 const h=harness(t),w=h.note();await until(()=>h.calls.some(x=>x.action==='ingest'));const panel=w.document.querySelector('#mumei-dashboard-sync');panel.setAttribute('data-mumei-recovery','1');panel.style.setProperty('display','block','important');
 const sheet=w.document.createElement('section');sheet.innerHTML='<nav><a href="#notices">通知</a><a href="#news">お知らせ</a></nav><article>人物さんがマガジンに記事を追加しました 1分前</article>';w.document.body.append(sheet);
 await until(()=>w.document.documentElement.getAttribute('data-mumei-dashboard-surface')==='other');assert.equal(w.getComputedStyle(panel).display,'none','wrapperの表示指定にも勝って隠す');
 const count=h.calls.length;w.document.dispatchEvent(new w.Event('mumei-dashboard-read'));await pause(100);assert.equal(h.calls.length,count,'通知中に読み込まない');
 sheet.hidden=true;await until(()=>w.document.documentElement.getAttribute('data-mumei-dashboard-surface')==='dashboard');assert.notEqual(w.getComputedStyle(panel).display,'none');
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
