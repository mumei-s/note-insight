import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {JSDOM} from 'jsdom';

const base='https://mumei-s.github.io/note-insight/';
const html=readFileSync('public/dashboard-setup.html','utf8');
const script=readFileSync('public/dashboard-setup.js','utf8');
const release=JSON.parse(readFileSync('public/insight-release.json','utf8'));
const wrapper=readFileSync('public/note-insight-dashboard-sync.user.js','utf8');
const DASH='mumei-dashboard-tool-version',NOTICE='mumei-notification-tool-version',MEMBER='mumei-insight-access-token',OWNER='mumei-unified-owner-token',ACTIVE='mumei-insight-active-account-v3',PENDING='mumei-dashboard-update-pending-v2';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function settle(){await tick();await tick()}
function page(t,options={}){
  const dom=new JSDOM(html,{url:base+'dashboard-setup.html'+(options.query||'?account=tester&auto=0'),runScripts:'outside-only'}),w=dom.window;
  const observers=[];
  t.after(()=>{observers.forEach(o=>o.disconnect());dom.window.close()});
  const calls=[],nav=[],url=new URL(w.location.href);
  w.__location={href:url.href,origin:url.origin,search:url.search,assign:href=>nav.push({kind:'assign',href}),replace:href=>nav.push({kind:'replace',href})};
  if(options.ua)Object.defineProperty(w.navigator,'userAgent',{value:options.ua});
  if(options.platform)Object.defineProperty(w.navigator,'platform',{value:options.platform});
  if(options.touch)Object.defineProperty(w.navigator,'maxTouchPoints',{value:options.touch});
  for(const [key,value] of Object.entries(options.storage||{}))w.localStorage.setItem(key,value);
  for(const [key,value] of Object.entries(options.session||{}))w.sessionStorage.setItem(key,value);
  if(options.active)w.document.documentElement.setAttribute('data-mumei-dashboard-bridge',options.active);
  let observerCalls=0;
  const Observer=w.MutationObserver;
  w.MutationObserver=class extends Observer{constructor(callback){let instance;super(records=>{observerCalls++;if(observerCalls>100){instance.disconnect();return}callback(records,instance)});instance=this;observers.push(this)}};
  w.fetch=async(url,init={})=>{calls.push({url:String(url),init});if(String(url).includes('insight-release.json')){if(options.manifestError)throw new Error('offline');return{ok:true,json:async()=>release}}if(options.pair)return options.pair(url,init,w);return{ok:true,json:async()=>({ok:true,noteId:'tester',pairingCode:'12345678'})}};
  const gmStore=new Map();w.GM=options.gm||{getValue:async(k,d)=>gmStore.get(k)??d,setValue:async(k,v)=>gmStore.set(k,v),deleteValue:async k=>gmStore.delete(k)};
  if(options.legacyStore){delete w.GM;w.GM_getValue=(k,d)=>gmStore.get(k)??d;w.GM_setValue=(k,v)=>gmStore.set(k,v);w.GM_deleteValue=k=>gmStore.delete(k)}
  if(options.wrapper)w.eval(wrapper);
  // Intercept browser navigation without replacing the production pairing, version or event logic.
  w.eval(script.replace("'use strict';","'use strict'; const location=window.__location;"));
  return{w,calls,nav,gmStore,get:id=>w.document.getElementById(id),observerCalls:()=>observerCalls};
}

test('従来URLで更新パネルを表示し、TOPへ戻さず分析へ戻るURLを維持する',async t=>{
  const h=page(t,{query:'?account=tester&return='+encodeURIComponent(base+'#dashboard')});await settle();
  assert.equal(h.nav.length,0);assert.match(h.get('dashboardTitle').textContent,/ダッシュボード同期/);
  const back=new URL(h.get('returnAnalysis').href);assert.equal(back.searchParams.get('insightMode'),'analysis');assert.equal(back.hash,'#dashboard');
  assert.equal(h.get('installDashboard').target,'_blank');assert.match(h.get('installDashboard').href,/note-insight-dashboard-sync\.user\.js$/);
});
test('旧v2 URLはアカウント・戻り先・クエリを維持して新パネルへ進む',()=>{
  const oldHtml=readFileSync('public/dashboard-setup-v2.html','utf8'),code=oldHtml.match(/<script>([\s\S]*?)<\/script>/)[1],url=new URL(base+'dashboard-setup-v2.html?account=tester&auto=0&return='+encodeURIComponent(base+'?insightMode=analysis')+'#tools');let next;
  runInNewContext(code,{URL,location:{href:url.href,search:url.search,hash:url.hash,replace:href=>next=new URL(href)}});
  assert.equal(next.pathname,'/note-insight/dashboard-setup.html');assert.equal(next.search,url.search);assert.equal(next.hash,'#tools');
});
test('保存済みの版だけでは起動済みにならず、旧版を最新版と判定しない',async t=>{
  for(const active of ['', '1.4.4']){const h=page(t,{active,storage:{[DASH]:release.dashboardVersion}});await settle();assert.equal(h.get('startRead').disabled,true);assert.equal(h.get('installDashboard').hidden,false);assert.notEqual(h.get('dashBadge').textContent,'最新版');assert.equal(h.calls.filter(c=>c.init.method==='POST').length,0)}
});
test('最新版の実ツールと共存し、本人通知なしでも操作不要で読込可能になる',async t=>{
  const h=page(t,{wrapper:true});await settle();
  assert.equal(h.get('dashCurrent').textContent,'v'+release.dashboardVersion);assert.equal(h.get('dashBadge').textContent,'最新版');assert.equal(h.get('installDashboard').hidden,true);assert.equal(h.get('verifyDashboard').hidden,true);assert.equal(h.get('startRead').disabled,false);assert.equal(h.get('installNotice').hidden,false);
  assert.ok(h.observerCalls()<30,'wrapper DOM cleanup and panel observation must settle');assert.equal(h.nav.length,0);assert.equal(h.calls.filter(c=>c.init.method==='POST').length,0,'opening settings must not issue a pairing request');
});
test('ツールの遅い起動も自動反映し、最新版以上をダウングレードしない',async t=>{
  const h=page(t);await settle();h.w.document.documentElement.setAttribute('data-mumei-dashboard-bridge','99.0.0');await settle();
  assert.equal(h.get('startRead').disabled,false);assert.equal(h.get('installDashboard').hidden,true);assert.equal(h.nav.length,0);
});
test('最新版照会に失敗した時は確認済みを捏造しない',async t=>{
  const h=page(t,{active:release.dashboardVersion,manifestError:true});await settle();assert.equal(h.get('startRead').disabled,true);assert.match(h.get('dashStatus').textContent,/確認に失敗/);assert.equal(h.nav.length,0);
});
test('更新から戻ったらこの画面で一度だけ再起動し、アカウントと分析の戻り先を保持する',async t=>{
  const query='?account=tester&return='+encodeURIComponent(base+'?insightMode=analysis#dashboard')+'&auto=0',h=page(t,{active:'1.4.4',query,session:{[PENDING]:JSON.stringify({at:Date.now(),reloaded:false})}});await settle();h.w.dispatchEvent(new h.w.Event('focus'));await settle();
  assert.equal(h.nav.length,1);const u=new URL(h.nav[0].href);assert.equal(u.pathname,'/note-insight/dashboard-setup.html');assert.equal(u.searchParams.get('account'),'tester');assert.equal(u.searchParams.get('return'),base+'?insightMode=analysis#dashboard');assert.ok(u.searchParams.has('verifyTs'));
  h.w.dispatchEvent(new h.w.Event('focus'));await settle();assert.equal(h.nav.length,1);assert.match(h.get('dashStatus').textContent,/更新をまだ確認できません/);
});
test('外部の戻り先を受け入れず、分析へ戻す',async t=>{
  const h=page(t,{query:'?return='+encodeURIComponent('https://example.test/landing')});await settle();assert.equal(new URL(h.get('back').href).origin,new URL(base).origin);assert.equal(new URL(h.get('back').href).searchParams.get('insightMode'),'analysis');
});

const browsers=[
  ['Android Edge','Mozilla/5.0 (Linux; Android 14) Chrome/130 Mobile Safari/537.36 EdgA/130','android-edge'],
  ['Android Firefox','Mozilla/5.0 (Android 14; Mobile; rv:130.0) Gecko/130.0 Firefox/130.0','android-firefox'],
  ['Android Chrome','Mozilla/5.0 (Linux; Android 14) Chrome/130 Mobile Safari/537.36','android-other'],
  ['iPhone Safari','Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Version/18.0 Mobile/15E148 Safari/604.1','ios-safari'],
  ['iPhone Chrome','Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) CriOS/130 Mobile/15E148 Safari/604.1','ios-other'],
  ['PC Edge','Mozilla/5.0 (Windows NT 10.0) Chrome/130 Safari/537.36 Edg/130','pc-edge'],
  ['PC Chrome','Mozilla/5.0 (Windows NT 10.0) Chrome/130 Safari/537.36','pc-chrome'],
  ['PC Firefox','Mozilla/5.0 (Windows NT 10.0; rv:130.0) Gecko/20100101 Firefox/130.0','pc-firefox'],
  ['PC Opera','Mozilla/5.0 (Windows NT 10.0) Chrome/130 Safari/537.36 OPR/114','pc-opera'],
  ['Mac Safari','Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) Version/18.0 Safari/605.1.15','mac-safari'],
];
for(const [name,ua,expected] of browsers)test(name+'の案内と既存拡張機能の更新導線',async t=>{
  const h=page(t,{ua});await settle();assert.equal(h.get('browser').value,expected);const other=expected.endsWith('other');assert.equal(h.get('switchBrowser').hidden,!other);
  const a=h.get('installDashboard');let blocked=false;a.addEventListener('click',e=>{blocked=e.defaultPrevented;e.preventDefault()});a.click();assert.equal(blocked,other);
  assert.equal(Boolean(h.w.sessionStorage.getItem(PENDING)),!other);assert.ok(h.get('extensionLinks').querySelector('a[href^="https:"]'));
});
test('iPadのデスクトップUAもiPad Safariとして案内する',async t=>{
  const h=page(t,{ua:browsers.at(-1)[1],platform:'MacIntel',touch:5});await settle();assert.equal(h.get('browser').value,'ios-safari');
});

test('参加者本人のトークンだけで照合し、秘密情報を含めずnoteへ読み込みを引き継ぐ',async t=>{
  const h=page(t,{wrapper:true,storage:{[MEMBER]:'member-fixture',[OWNER]:'owner-must-not-be-used',[ACTIVE]:'tester'}});await settle();h.get('startRead').click();await settle();
  const request=h.calls.find(c=>c.init.method==='POST');assert.ok(request);assert.equal(request.init.headers['X-Insight-Token'],'member-fixture');assert.equal(request.init.headers['X-Owner-Token'],undefined);assert.equal(JSON.parse(request.init.body).role,'member');
  assert.equal(h.nav.length,1);const u=new URL(h.nav[0].href);assert.equal(u.origin,'https://note.com');assert.equal(u.pathname,'/sitesettings/stats');assert.equal(u.searchParams.get('mumei_dashboard_pair'),'12345678');assert.equal(u.searchParams.get('mumei_dashboard_account'),'tester');assert.equal(u.searchParams.get('mumei_dashboard_tool_version'),release.dashboardVersion);assert.equal(new URL(u.searchParams.get('mumei_dashboard_return')).searchParams.get('insightMode'),'analysis');assert.ok(!u.href.includes('fixture'));assert.ok(h.observerCalls()<30);
});
test('auto=1の明示的な読み込み依頼だけ一度実行し、再読込の無限再実行を防ぐ',async t=>{
  const h=page(t,{wrapper:true,query:'?account=tester&auto=1',storage:{[MEMBER]:'fixture',[ACTIVE]:'tester'}});await settle();h.w.dispatchEvent(new h.w.Event('focus'));await settle();assert.equal(h.calls.filter(c=>c.init.method==='POST').length,1);assert.equal(new URL(h.w.location.href).searchParams.get('auto'),'0');assert.equal(h.nav.length,1);
});

test('noteへ移動する前に拡張機能へ一回限りの連携依頼を保存する',async t=>{
 const h=page(t,{wrapper:true,storage:{[MEMBER]:'member-fixture',[ACTIVE]:'tester'}});await settle();h.get('startRead').click();await settle();
 assert.equal(h.nav.length,1);const pending=JSON.parse(h.gmStore.get('mumei-dashboard-handoff-v143')||'null');
 assert.equal(pending?.code,'12345678');assert.equal(pending.noteId,'tester');assert.ok(pending.savedAt);assert.ok(pending.expiresAt);assert.ok(!JSON.stringify(pending).includes('member-fixture'));
});
test('GM_setValue形式のブラウザでも共有保存を確認してから移動する',async t=>{
 const h=page(t,{wrapper:true,legacyStore:true,storage:{[MEMBER]:'fixture',[ACTIVE]:'tester'}});await settle();h.get('startRead').click();await settle();
 assert.equal(h.nav.length,1);assert.equal(JSON.parse(h.gmStore.get('mumei-dashboard-handoff-v143')).noteId,'tester');
});

test('拡張機能の保存が遅い間は移動も二重の連携開始もしない',async t=>{
 const storage=new Map();let finish;
 const gm={getValue:async(k,d)=>storage.get(k)??d,setValue:(k,v)=>new Promise(resolve=>{finish=()=>{storage.set(k,v);resolve()}}),deleteValue:async k=>storage.delete(k)};
 const h=page(t,{wrapper:true,gm,storage:{[MEMBER]:'fixture',[ACTIVE]:'tester'}});await settle();h.get('startRead').click();await settle();
 assert.equal(h.nav.length,0);assert.ok(finish);h.get('startRead').click();await settle();assert.equal(h.calls.filter(c=>c.init.method==='POST').length,1);
 finish();await settle();assert.equal(h.nav.length,1);
});
test('拡張機能への保存失敗を移動成功と表示しない',async t=>{
 const h=page(t,{wrapper:true,gm:{getValue:async(k,d)=>d,setValue:async()=>{throw Error('disk full')}},storage:{[MEMBER]:'fixture',[ACTIVE]:'tester'}});await settle();h.get('startRead').click();await settle();
 assert.equal(h.nav.length,0);assert.match(h.get('readStatus').textContent,/連携情報を保存できません/);assert.equal(h.get('startRead').disabled,false);
});
test('連携情報の保存中に本人アカウントが変わった場合も移動しない',async t=>{
 const storage=new Map();let finish;
 const h=page(t,{wrapper:true,gm:{getValue:async(k,d)=>storage.get(k)??d,setValue:(k,v)=>new Promise(resolve=>{finish=()=>{storage.set(k,v);resolve()}})},storage:{[MEMBER]:'fixture',[ACTIVE]:'tester'}});await settle();h.get('startRead').click();await settle();h.w.localStorage.setItem(ACTIVE,'another');finish();await settle();
 assert.equal(h.nav.length,0);assert.match(h.get('readStatus').textContent,/アカウント/);
});
test('ログインなしなら読込を実行せず、エラーが版検出のDOM更新で消えない',async t=>{
  const h=page(t,{wrapper:true});await settle();h.get('startRead').click();await settle();h.w.document.documentElement.setAttribute('data-mumei-dashboard-bridge',release.dashboardVersion);await settle();assert.equal(h.calls.filter(c=>c.init.method==='POST').length,0);assert.equal(h.nav.length,0);assert.match(h.get('readStatus').textContent,/ログイン/);
});
for(const problem of ['changed-before','changed-during','wrong-response'])test('アカウント不一致を停止する: '+problem,async t=>{
  const h=page(t,{wrapper:true,storage:{[MEMBER]:'fixture',[ACTIVE]:problem==='changed-before'?'another':'tester'},pair:async(url,init,w)=>{if(problem==='changed-during')w.localStorage.setItem(MEMBER,'changed-fixture');return{ok:true,json:async()=>({ok:true,noteId:problem==='wrong-response'?'another':'tester',pairingCode:'12345678'})}}});await settle();h.get('startRead').click();await settle();assert.equal(h.nav.length,0);assert.match(h.get('readStatus').textContent,/アカウント/);if(problem==='changed-before')assert.equal(h.calls.filter(c=>c.init.method==='POST').length,0);
});
test('本人通知の更新は独立パネルを使い、完了後この更新画面へ戻れる',async t=>{
  const h=page(t,{active:release.dashboardVersion,storage:{[NOTICE]:'3.5.0'}});await settle();const u=new URL(h.get('installNotice').href);assert.equal(u.pathname,'/note-insight/notification-browser-install.html');assert.equal(new URL(u.searchParams.get('return')).pathname,'/note-insight/dashboard-setup.html');assert.equal(h.get('installNotice').hidden,false);
  h.w.localStorage.setItem(NOTICE,release.notificationVersion);h.w.dispatchEvent(new h.w.Event('mumei-notification-version-changed'));await settle();assert.equal(h.get('installNotice').hidden,true);
});

test('分析の更新入口は準備済みでも残り、足りないツールをそれぞれ表示する',async()=>{
  const ts=(await import('typescript')).default,vm=await import('node:vm'),React=await import('react'),jsx=await import('react/jsx-runtime'),{renderToStaticMarkup}=await import('react-dom/server');
  const context=vm.createContext({window:{location:{href:base+'#dashboard'}},Intl,URL,console}),source=ts.transpileModule(readFileSync('src/member-insight-analysis-hub.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const mod=new vm.SourceTextModule(source,{context});
  await mod.link(specifier=>{let exports={};if(specifier==='react')exports=React;else if(specifier==='react/jsx-runtime')exports=jsx;else if(specifier.endsWith('/insight-donut'))exports={InsightDonut:()=>null};else if(specifier.endsWith('/member-insight-analysis-summary-client'))exports={loadNotificationSummary:async()=>({sample:0})};else if(specifier.endsWith('/member-insight-analysis-charts'))exports={InsightColumns:()=>null};else if(specifier.endsWith('/insight-account-store'))exports={INSIGHT_TOKEN_KEY:MEMBER};else if(specifier.endsWith('/insight-release'))exports={CURRENT_DASHBOARD_VERSION:release.dashboardVersion,CURRENT_NOTIFICATION_VERSION:release.notificationVersion,compareVersions:(a,b)=>a.localeCompare(b,undefined,{numeric:true})};else if(specifier.endsWith('/member-insight-analytics-pro-v3'))exports={MemberInsightAnalyticsProV3:()=>React.createElement('div',{'data-pro-analysis':true})};return new vm.SyntheticModule(Object.keys(exports),function(){for(const [key,value] of Object.entries(exports))this.setExport(key,value)},{context})});await mod.evaluate();
  for(const ready of [false,true]){const markup=renderToStaticMarkup(React.createElement(mod.namespace.MemberInsightAnalysisHub,{noteId:'tester',notificationInstalled:release.notificationVersion,dashboardInstalled:ready?release.dashboardVersion:''})),doc=new JSDOM(markup);try{assert.ok(doc.window.document.querySelector('.miah-tools-link[href*="dashboard-setup.html"]'));assert.equal(Boolean(doc.window.document.querySelector('[data-pro-analysis]')),ready);assert.equal(doc.window.document.querySelectorAll('.miah-tool-statuses .update').length,ready?0:1)}finally{doc.window.close()}}
});
