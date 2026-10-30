import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

const BASE='https://mumei-s.github.io/note-insight/';
const ACTIVE='mumei-insight-active-account-v3';
const PREFIX='mumei-insight-update-pending-v1:';
const release=JSON.parse(readFileSync('public/insight-release.json','utf8'));
const versions={notification:release.notificationVersion,dashboard:release.dashboardVersion,dm:release.dmVersion};
const clone=value=>JSON.parse(JSON.stringify(value));

function page(t,{path='notification-browser-install.html',query='',active='tester'}={}){
 const dom=new JSDOM('<!doctype html><html><head></head><body></body></html>',{url:BASE+path+query,runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
 t.after(()=>w.close());if(active)w.localStorage.setItem(ACTIVE,active);
 w.eval(readFileSync('public/insight-update-return.js','utf8'));
 return{w,api:w.MumeiInsightUpdateReturn};
}
function operation(h,tool='notification',options={}){
 const nav=[],statuses=[],returnTo=BASE+'?insightMode=comments&insightTab=comments&notificationAccount=tester#dashboard';
 const controller=h.api.create({tool,returnTo,account:'tester',navigate:href=>nav.push(href),onStatus:message=>statuses.push(message),...options});
 return{controller,nav,statuses,returnTo};
}
function mark(h,tool,version=versions[tool]){h.w.document.documentElement.setAttribute('data-mumei-'+tool+'-live-version',version)}
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));

test('戻り先を同一INSIGHT本体に限り、外部・別ページ・認証付きURLを拒否する',t=>{
 const h=page(t);
 for(const raw of ['https://evil.test/note-insight/#dashboard','https://mumei-s.github.io/note-insight-guide/#dashboard','https://user:secret@mumei-s.github.io/note-insight/#dashboard',BASE+'notification-filter-settings.html',BASE+'dm-browser-install.html',BASE+'editor.note.com']){
  const u=new URL(h.api.resolve(raw,{fallbackMode:'notifications',account:'tester'}));
  assert.equal(u.origin,new URL(BASE).origin);assert.equal(u.pathname,'/note-insight/');assert.equal(u.hash,'#dashboard');assert.equal(u.searchParams.get('insightMode'),'notifications');assert.equal(u.username,'');assert.equal(u.password,'');
 }
});

test('許可された元の画面・アカウント・分析項目とownerの入口を保持する',t=>{
 const h=page(t),raw=BASE+'index.html?insightMode=analysis&analysisPanel=notifications&notificationAccount=tester#owner-insight';
 const u=new URL(h.api.resolve(raw,{fallbackMode:'normal'}));
 assert.equal(u.pathname,'/note-insight/index.html');assert.equal(u.hash,'#owner-insight');assert.equal(u.searchParams.get('insightMode'),'analysis');assert.equal(u.searchParams.get('analysisPanel'),'notifications');assert.equal(u.searchParams.get('notificationAccount'),'tester');
});

test('戻りURLには画面とアカウントだけを残し、認証値・一時結果・未知のクエリを除く',t=>{
 const allowed=new Set(['insightMode','insightTab','analysisPanel','notificationAccount','account']);
 const raw=BASE+'?insightMode=analysis&insightTab=likes&analysisPanel=dashboard&notificationAccount=tester&account=tester&token=private-token&accessToken=private-access&X-Insight-Token=private-header&passcode=private-code&launch=private-launch&return=https%3A%2F%2Fevil.test&notificationInstalled=99.0.0&notificationCheckedAt=1&insightAppVersion=99.0.0&_insight_cb=1&unknown=private-other#owner-insight';
 const h=page(t,{path:'',query:new URL(raw).search+new URL(raw).hash});
 for(const href of [h.api.resolve(raw),h.api.capture()]){
  const u=new URL(href);assert.ok([...u.searchParams.keys()].every(key=>allowed.has(key)));assert.doesNotMatch(href,/private-|token=|accessToken|passcode|notificationInstalled|notificationCheckedAt|insightAppVersion|_insight_cb|unknown|evil\.test/);
  assert.equal(u.searchParams.get('insightMode'),'analysis');assert.equal(u.searchParams.get('analysisPanel'),'dashboard');assert.equal(u.searchParams.get('notificationAccount'),'tester');assert.equal(u.hash,'#owner-insight');
 }
});

test('設定・連携ページ内のreturnを解決し、設定画面へ循環しない',t=>{
 const h=page(t),target=BASE+'?insightMode=normal&insightTab=dm#dashboard';
 const nested=BASE+'notification-connection.html?notificationAccount=tester&return='+encodeURIComponent(BASE+'dashboard-setup.html?return='+encodeURIComponent(target));
 assert.equal(h.api.resolve(nested),target);
 const bad=BASE+'notification-connection.html?return='+encodeURIComponent('https://evil.test/landing');
 const result=new URL(h.api.resolve(bad,{fallbackMode:'analysis'}));assert.equal(result.pathname,'/note-insight/');assert.equal(result.searchParams.get('insightMode'),'analysis');
 let deep=target;for(let i=0;i<12;i++)deep=BASE+'tool-setup.html?return='+encodeURIComponent(deep);
 const bounded=new URL(h.api.resolve(deep,{fallbackMode:'notifications'}));assert.equal(bounded.pathname,'/note-insight/');assert.equal(bounded.searchParams.get('insightMode'),'notifications');
});

test('別機能installerの既定タブで、明示された元画面を上書きしない',t=>{
 const h=page(t);
 for(const mode of ['normal','comments','favorites','social','notifications','analysis']){
  const u=new URL(h.api.resolve(BASE+'?insightMode='+mode+'#dashboard',{fallbackMode:'notifications',fallbackTab:'notifications'}));
  assert.equal(u.searchParams.get('insightMode'),mode);assert.equal(u.searchParams.get('insightTab'),['comments','favorites','social','notifications'].includes(mode)?mode:null);
 }
});

test('URLに出ていない履歴内のDMタブを戻りURLに記録する',t=>{
 const h=page(t,{path:'',query:'?notificationAccount=tester#dashboard'});
 h.w.history.replaceState({route:'dashboard',insightMode:'normal',insightTab:'dm'},'',h.w.location.href);
 const u=new URL(h.api.capture());assert.equal(u.searchParams.get('insightMode'),'normal');assert.equal(u.searchParams.get('insightTab'),'dm');assert.equal(u.searchParams.get('notificationAccount'),'tester');assert.equal(u.hash,'#dashboard');
});

test('明示された表示中の項目を優先し、不明なmode/tabを戻り先へ持ち込まない',t=>{
 const h=page(t,{path:'',query:'?insightMode=unknown&insightTab=unknown#dashboard'});
 h.w.history.replaceState({insightMode:'normal',insightTab:'likes'},'',h.w.location.href);
 const u=new URL(h.api.capture({mode:'notifications',tab:'notifications',account:'tester'}));
 assert.equal(u.searchParams.get('insightMode'),'notifications');assert.equal(u.searchParams.get('insightTab'),'notifications');assert.equal(u.searchParams.get('notificationAccount'),'tester');
 const safe=new URL(h.api.resolve(BASE+'?insightMode=unknown&insightTab=unknown#dashboard'));
 assert.notEqual(safe.searchParams.get('insightMode'),'unknown');assert.notEqual(safe.searchParams.get('insightTab'),'unknown');
});

for(const tool of Object.keys(versions))test(`${tool}: クリック・保存版・確認クエリだけでは更新完了にしない`,t=>{
 const h=page(t,{query:'?notificationInstalled=99.0.0&notificationCheckedAt='+Date.now()}),o=operation(h,tool);
 h.w.localStorage.setItem('mumei-notification-tool-version','99.0.0');h.w.localStorage.setItem('mumei-notification-v3-loader','99.0.0');h.w.localStorage.setItem('mumei-dm-tool-version','99.0.0');h.w.localStorage.setItem('mumei-dashboard-tool-version','99.0.0');
 assert.equal(h.api.live(tool),'');o.controller.begin(versions[tool]);assert.ok(o.controller.pending());o.controller.finish(versions[tool]);assert.equal(o.nav.length,0);assert.ok(o.controller.pending(),'確認待ちはクリックだけで消さない');
});

for(const tool of Object.keys(versions))test(`${tool}: この文書の最新版起動を確認して元のINSIGHTへ一度だけ戻る`,t=>{
 const h=page(t),o=operation(h,tool);mark(h,tool);o.controller.finish(versions[tool]);assert.equal(o.nav.length,0,'起動済みでも更新操作をしていない設定画面から追い出さない');
 o.controller.begin(versions[tool]);const pending=clone(o.controller.pending());assert.equal(pending.targetVersion,versions[tool]);assert.equal(pending.account,'tester');assert.ok(pending.at);assert.equal(h.api.live(tool),versions[tool]);
 o.controller.finish(versions[tool]);assert.deepEqual(o.nav,[o.returnTo]);assert.equal(o.controller.pending(),null);o.controller.finish(versions[tool]);assert.equal(o.nav.length,1);assert.equal(h.w.sessionStorage.getItem(PREFIX+tool),null);
 const later=operation(h,tool);later.controller.finish(versions[tool]);assert.equal(later.nav.length,0,'更新待ちは消費後に再利用しない');
});

for(const tool of Object.keys(versions))test(`${tool}: manifest確認失敗・旧runtime・目標版未満は確認待ちを保持する`,t=>{
 const h=page(t),o=operation(h,tool);o.controller.begin(versions[tool]);mark(h,tool,'0.1.0');o.controller.finish(versions[tool]);assert.equal(o.nav.length,0);
 mark(h,tool);for(const invalid of ['','unknown',null])o.controller.finish(invalid);assert.equal(o.nav.length,0);assert.ok(o.controller.pending());
 o.controller.begin('99.0.0');o.controller.finish(versions[tool]);assert.equal(o.nav.length,0,'現在manifestより新しい要求の目標版も下げない');assert.equal(o.controller.pending().targetVersion,'99.0.0');
});

test('Dashboard既存bridgeの現在文書での起動確認も利用できる',t=>{
 const h=page(t,{path:'dashboard-setup.html'}),o=operation(h,'dashboard');h.w.document.documentElement.setAttribute('data-mumei-dashboard-bridge',versions.dashboard);
 assert.equal(h.api.live('dashboard'),versions.dashboard);o.controller.begin(versions.dashboard);o.controller.finish(versions.dashboard);assert.equal(o.nav.length,1);
});

for(const [tool,file,path] of [
 ['notification','note-insight-notification-v3.user.js','notification-browser-install.html'],
 ['dm','note-insight-dm.user.js','dm-browser-install.html'],
 ['dashboard','note-insight-dashboard-sync.user.js','dashboard-setup.html'],
])test(`${tool}: 実userscriptが先に起動していても現文書の版を読み取れる`,t=>{
 const dom=new JSDOM('<!doctype html><html><head></head><body></body></html>',{url:BASE+path,runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
 const observers=[],Observer=w.MutationObserver;w.MutationObserver=class extends Observer{constructor(callback){super(callback);observers.push(this)}};t.after(()=>{observers.forEach(observer=>observer.disconnect());w.close()});w.localStorage.setItem(ACTIVE,'tester');const store=new Map();w.GM={getValue:async(k,d)=>store.get(k)??d,setValue:async(k,v)=>store.set(k,v),deleteValue:async k=>store.delete(k)};
 let calls=0;w.fetch=async()=>{calls++;throw new Error('更新確認は同期APIを呼ばない')};
 w.eval(readFileSync('public/'+file,'utf8'));
 w.eval(readFileSync('public/insight-update-return.js','utf8'));
 const h={w,api:w.MumeiInsightUpdateReturn},o=operation(h,tool);assert.equal(h.api.live(tool),versions[tool]);o.controller.begin(versions[tool]);o.controller.finish(versions[tool]);assert.equal(o.nav.length,1);assert.equal(calls,0);
});

for(const [tool,file,path] of [
 ['notification','note-insight-notification-v3.user.js','notification-browser-install.html'],
 ['dm','note-insight-dm.user.js','dm-browser-install.html'],
 ['dashboard','note-insight-dashboard-sync.user.js','dashboard-setup.html'],
])test(`${tool}: document-startでhtml要素がなくても、生成後に実userscriptの起動版を公開する`,async t=>{
 const dom=new JSDOM('<!doctype html><html><head></head><body></body></html>',{url:BASE+path,runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
 const observers=[],Observer=w.MutationObserver;w.MutationObserver=class extends Observer{constructor(callback){super(callback);observers.push(this)}};t.after(()=>{observers.forEach(observer=>observer.disconnect());w.close()});
 w.localStorage.setItem(ACTIVE,'tester');const store=new Map();w.GM={getValue:async(k,d)=>store.get(k)??d,setValue:async(k,v)=>store.set(k,v),deleteValue:async k=>store.delete(k)};let requests=0,ready=0;
 w.fetch=async()=>{requests++;throw new Error('版の公開だけでAPIを呼ばない')};w.addEventListener('mumei-insight-tool-ready',()=>ready++);
 w.document.documentElement.remove();assert.equal(w.document.documentElement,null);w.eval(readFileSync('public/'+file,'utf8'));w.eval(readFileSync('public/insight-update-return.js','utf8'));
 assert.equal(w.MumeiInsightUpdateReturn.live(tool),'');assert.equal(ready,0);
 const root=w.document.createElement('html');root.append(w.document.createElement('head'),w.document.createElement('body'));w.document.append(root);w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
 for(let i=0;i<5;i++)await new Promise(resolve=>setImmediate(resolve));
 assert.equal(w.MumeiInsightUpdateReturn.live(tool),versions[tool]);assert.ok(ready>0);assert.equal(requests,0);
});

test('アカウント変更後は古い更新待ちで元の対象へ自動復帰しない',t=>{
 const h=page(t),o=operation(h);o.controller.begin(versions.notification);mark(h,'notification');h.w.localStorage.setItem(ACTIVE,'other');o.controller.finish(versions.notification);assert.equal(o.nav.length,0);
 const other=operation(h,'notification',{account:'other'});other.controller.finish(versions.notification);assert.equal(other.nav.length,0);
});

test('別ツールの更新待ちを上書き・消費せず、それぞれの実行確認を待つ',t=>{
 const h=page(t),operations=Object.fromEntries(Object.keys(versions).map(tool=>[tool,operation(h,tool)]));
 for(const [tool,o] of Object.entries(operations))o.controller.begin(versions[tool]);
 mark(h,'notification');for(const [tool,o] of Object.entries(operations))o.controller.finish(versions[tool]);
 assert.equal(operations.notification.nav.length,1);assert.equal(operations.dm.nav.length,0);assert.equal(operations.dashboard.nav.length,0);assert.ok(operations.dm.controller.pending());assert.ok(operations.dashboard.controller.pending());
 mark(h,'dm');operations.dm.controller.finish(versions.dm);assert.equal(operations.dm.nav.length,1);assert.ok(operations.dashboard.controller.pending());
 mark(h,'dashboard');operations.dashboard.controller.finish(versions.dashboard);assert.equal(operations.dashboard.nav.length,1);
});

test('端末内へ更新待ちを保存できない場合は自動復帰しない',t=>{
 const h=page(t);Object.defineProperty(h.w,'sessionStorage',{value:{getItem:()=>null,setItem:()=>{throw new Error('Storage unavailable')},removeItem:()=>{}}});
 const o=operation(h);mark(h,'notification');assert.equal(o.controller.begin(versions.notification),false);o.controller.finish(versions.notification);assert.equal(o.nav.length,0);assert.equal(o.controller.pending(),null);assert.ok(o.statuses.includes('storage-unavailable'));
});

test('期限切れ・未来時刻・壊れた更新待ちを完了扱いにしない',t=>{
 const h=page(t);mark(h,'notification');
 for(const at of [Date.now()-60*60*1000-1,Date.now()+60_000]){
  const o=operation(h);o.controller.begin(versions.notification);const pending=clone(o.controller.pending());pending.at=at;h.w.sessionStorage.setItem(PREFIX+'notification',JSON.stringify(pending));o.controller.finish(versions.notification);assert.equal(o.nav.length,0);assert.equal(o.controller.pending(),null);
 }
 h.w.sessionStorage.setItem(PREFIX+'notification','1');const broken=operation(h);broken.controller.finish(versions.notification);assert.equal(broken.nav.length,0);
});

test('画面を離れていない間の確認用再読込は一度だけとし、キャンセル後は戻らない',t=>{
 const h=page(t),o=operation(h);o.controller.begin(versions.notification);assert.equal(o.controller.reload(),true);assert.equal(o.controller.reload(),false);assert.equal(o.nav.length,0);
 const reopened=operation(h);assert.equal(reopened.controller.reload(),false,'文書が変わっても同じ更新待ちの再読込回数を保持');reopened.controller.cancel();mark(h,'notification');reopened.controller.finish(versions.notification);assert.equal(reopened.nav.length,0);assert.equal(reopened.controller.pending(),null);
 reopened.controller.begin(versions.notification);assert.equal(reopened.controller.reload(),true,'新しい明示操作は再確認できる');
});

function visibility(w,state){Object.defineProperty(w.document,'visibilityState',{configurable:true,value:state});Object.defineProperty(w.document,'hidden',{configurable:true,value:state==='hidden'});w.document.dispatchEvent(new w.Event('visibilitychange'))}
function freshDocument(t,h){const url=new URL(h.w.location.href),next=page(t,{path:url.pathname.slice('/note-insight/'.length),query:url.search+url.hash,active:''});for(const name of ['localStorage','sessionStorage'])for(let i=0;i<h.w[name].length;i++){const key=h.w[name].key(i);next.w[name].setItem(key,h.w[name].getItem(key))}return next}
for(const tool of Object.keys(versions))test(`${tool}: 早い確認再読込の後でも、本当に拡張機能へ移動して戻れば一度だけ再確認できる`,t=>{
 let h=page(t);const first=operation(h,tool);visibility(h.w,'visible');first.controller.begin(versions[tool]);assert.equal(first.controller.pending().awayCycle,0);assert.equal(first.controller.reload(),true);assert.equal(first.controller.pending().lastReloadCycle,0);
 h.w.dispatchEvent(new h.w.Event('blur'));visibility(h.w,'hidden');assert.equal(first.controller.pending().awayCycle,0,'自分の再読込で発生したblur/hiddenを外出として数えない');
 h=freshDocument(t,h);visibility(h.w,'visible');h.w.dispatchEvent(new h.w.Event('pageshow'));const resumed=operation(h,tool);
 for(let i=0;i<3;i++){h.w.dispatchEvent(new h.w.Event('pageshow'));h.w.dispatchEvent(new h.w.Event('focus'));visibility(h.w,'visible');assert.equal(resumed.controller.reload(),false,'pageshow/focusだけで再読込を繰り返さない')}
 h.w.dispatchEvent(new h.w.Event('blur'));visibility(h.w,'hidden');h.w.dispatchEvent(new h.w.Event('blur'));
 assert.equal(resumed.controller.pending().awayCycle,1,'一回の移動でblurとhiddenが両方発生しても一回');assert.equal(resumed.controller.pending().away,true);
 h.w.dispatchEvent(new h.w.Event('focus'));visibility(h.w,'visible');assert.equal(resumed.controller.pending().away,false);assert.equal(resumed.controller.reload(),true,'実際のインストール画面から戻った後はもう一度起動確認できる');assert.equal(resumed.controller.pending().lastReloadCycle,1);assert.equal(resumed.controller.reload(),false);
 h.w.dispatchEvent(new h.w.Event('blur'));visibility(h.w,'hidden');assert.equal(resumed.controller.pending().awayCycle,1,'二回目の確認再読込自身でもcycleを増やさない');h=freshDocument(t,h);visibility(h.w,'visible');h.w.dispatchEvent(new h.w.Event('pageshow'));
 const verified=operation(h,tool);assert.equal(verified.controller.reload(),false);mark(h,tool);verified.controller.finish(versions[tool]);verified.controller.finish(versions[tool]);assert.deepEqual(verified.nav,[verified.returnTo]);assert.equal(verified.controller.pending(),null);assert.equal(first.nav.length,0);assert.equal(resumed.nav.length,0);
});

test('実際に拡張機能から戻った後も、アカウント変更・期限切れ・キャンセルでは再読込も完了もしない',t=>{
 for(const reason of ['account','expired','cancel']){
  const h=page(t),o=operation(h);visibility(h.w,'visible');o.controller.begin(versions.notification);assert.equal(o.controller.reload(),true);h.w.dispatchEvent(new h.w.Event('pageshow'));h.w.dispatchEvent(new h.w.Event('blur'));visibility(h.w,'hidden');h.w.dispatchEvent(new h.w.Event('focus'));visibility(h.w,'visible');
  assert.equal(o.controller.pending().awayCycle,1);
  if(reason==='account')h.w.localStorage.setItem(ACTIVE,'other');else if(reason==='cancel')o.controller.cancel();else{const p=clone(o.controller.pending());p.at=Date.now()-60*60*1000-1;h.w.sessionStorage.setItem(PREFIX+'notification',JSON.stringify(p))}
  assert.equal(o.controller.reload(),false);mark(h,'notification');o.controller.finish(versions.notification);assert.equal(o.nav.length,0,reason);
 }
});

for(const tool of Object.keys(versions))test(`${tool}: 拡張機能を開いている間の遅い確認処理で再読込枠を消費しない`,t=>{
 const h=page(t),o=operation(h,tool);o.controller.begin(versions[tool]);h.w.dispatchEvent(new h.w.Event('blur'));
 assert.equal(o.controller.pending().awayCycle,1);assert.equal(o.controller.pending().away,true);assert.equal(o.controller.reload(),false,'まだ別画面にいるblur直後も再読込しない');
 visibility(h.w,'hidden');assert.equal(o.controller.reload(),false);assert.equal(o.controller.pending().lastReloadCycle,-1,'拡張機能にいる間に確認枠を消費しない');
 h.w.dispatchEvent(new h.w.Event('pageshow'));assert.equal(o.controller.pending().away,true,'非表示中のpageshowは帰還ではない');assert.equal(o.controller.pending().awayCycle,1);assert.equal(o.controller.reload(),false);
 visibility(h.w,'visible');h.w.dispatchEvent(new h.w.Event('focus'));assert.equal(o.controller.pending().away,false);assert.equal(o.controller.reload(),true,'本当に戻ってから一度だけ確認する');assert.equal(o.controller.pending().lastReloadCycle,1);assert.equal(o.controller.reload(),false);
});

const installers={
 notification:{page:'notification-browser-install.html',wrapper:'note-insight-notification-v3.user.js',button:'install',stored:'mumei-notification-tool-version'},
 dm:{page:'dm-browser-install.html',wrapper:'note-insight-dm.user.js',button:'install',stored:'mumei-dm-tool-version'},
 dashboard:{page:'dashboard-setup.html',wrapper:'note-insight-dashboard-sync.user.js',button:'installDashboard',stored:'mumei-dashboard-tool-version'},
};
function installer(t,tool,{installed=false,stale=false,releaseError=false,auto=false,pendingUpdate=false,withReadPermission=false}={}){
 const config=installers[tool],target=BASE+'?insightMode=normal&insightTab=dm&notificationAccount=tester#owner-insight';
 const nested=BASE+'notification-connection.html?return='+encodeURIComponent(target),query='?account=tester&notificationAccount=tester&auto='+(auto?'1':'0')+'&return='+encodeURIComponent(nested)+(stale?'&notificationInstalled=99.0.0&notificationCheckedAt='+Date.now():'');
 const html=readFileSync('public/'+config.page,'utf8'),dom=new JSDOM(html,{url:BASE+config.page+query,runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
 const observers=[],Observer=w.MutationObserver;w.MutationObserver=class extends Observer{constructor(callback){super(callback);observers.push(this)}};t.after(()=>{observers.forEach(observer=>observer.disconnect());w.close()});const nav=[],calls=[],gmWrites=[],messages=[];const u=new URL(w.location.href);
 w.__location={href:u.href,origin:u.origin,pathname:u.pathname,search:u.search,hash:u.hash,replace:href=>nav.push({kind:'replace',href}),assign:href=>nav.push({kind:'assign',href})};
 w.localStorage.setItem(ACTIVE,'tester');if(stale)w.localStorage.setItem(config.stored,'99.0.0');
 if(withReadPermission)w.localStorage.setItem('mumei-insight-access-token','read-authorized-fixture');
 w.fetch=async(url,init={})=>{calls.push({url:String(url),init});if(!String(url).includes('insight-release.json'))throw new Error('Unexpected network call');if(releaseError)throw new Error('offline');return{ok:true,json:async()=>({notificationVersion:versions.notification,dashboardVersion:versions.dashboard,dmVersion:versions.dm})}};
 const gm=new Map();w.GM={getValue:async(k,d)=>gm.get(k)??d,setValue:async(k,v)=>{gmWrites.push(k);gm.set(k,v)},deleteValue:async k=>gm.delete(k)};w.postMessage=data=>messages.push(clone(data));
 if(withReadPermission&&tool==='dashboard')w.eval(readFileSync('public/note-insight-dashboard-feature-bridge-v1.js','utf8'));
 const publish=(version=versions[tool])=>w.eval(readFileSync('public/'+config.wrapper,'utf8').replaceAll(versions[tool],version));
 if(installed)publish();
 w.eval('(()=>{const location=window.__location;'+readFileSync('public/insight-update-return.js','utf8')+'})()');
 if(pendingUpdate)w.MumeiInsightUpdateReturn.create({tool,account:'tester',returnTo:target,fallbackMode:'analysis'}).begin(versions[tool]);
 if(tool==='dashboard')w.eval('(()=>{const location=window.__location;'+readFileSync('public/dashboard-setup.js','utf8')+'})()');
 else for(const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi))if(match[1].trim())w.eval('(()=>{const location=window.__location;'+match[1]+'})()');
 const click=()=>{const button=w.document.getElementById(config.button);button.addEventListener('click',event=>event.preventDefault(),{once:true});button.click()};
 const focus=async()=>{w.dispatchEvent(new w.Event('focus'));await wait(200)};
 const noPairing=()=>{assert.ok(calls.every(call=>call.url.includes('insight-release.json')&&(!call.init.method||call.init.method==='GET')));assert.ok(gmWrites.every(key=>!/(?:handoff|pair|ingest-token)/i.test(key)));assert.ok(messages.every(message=>!/(?:pair|save|sync|read)/i.test(String(message.type||'')+' '+String(message.action||''))))};
 return{w,nav,calls,gmWrites,messages,target,publish,click,focus,noPairing};
}

for(const tool of Object.keys(installers))test(`${tool}: 実インストーラーは起動済みでも更新待ちなしでは画面を離れない`,async t=>{
 const h=installer(t,tool,{installed:true});await wait(160);await h.focus();assert.equal(h.nav.length,0);h.noPairing();
});

for(const tool of ['notification','dm'])test(`${tool}: インストール用URLは文字列表示を避けるためクエリなしで .user.js で終わる`,async t=>{
 const h=installer(t,tool);await wait(160);
 const link=h.w.document.getElementById('install'),url=new URL(link.href);
 assert.equal(url.origin,'https://raw.githubusercontent.com');
 assert.equal(url.pathname,'/mumei-s/note-insight/main/public/'+installers[tool].wrapper);
 assert.equal(url.search,'','クエリ付きURLはTampermonkeyに捕捉されない場合がある');
 assert.ok(link.href.endsWith('.user.js'));
 assert.equal(h.w.document.getElementById('scriptUrl').value,link.href);
 assert.equal(h.w.document.getElementById('scriptUrl').readOnly,true);
 h.click();
 assert.equal(new URL(link.href).search,'');
 assert.equal(h.nav.length,0);
 assert.match(h.w.document.getElementById(tool==='dm'?'result':'verifyResult').textContent,/文字列/);
 h.noPairing();
});

test('本人通知の公開版を取得できない時もURLを汚さず、更新済みとは表示しない',async t=>{
 const h=installer(t,'notification',{releaseError:true});await wait(160);
 const link=h.w.document.getElementById('install'),before=link.href;
 h.w.Date.now=()=>123456789;h.click();
 h.w.Date.now=()=>123456790;h.click();
 assert.equal(link.href,before);
 assert.equal(new URL(link.href).search,'');
 assert.equal(h.nav.length,0);
 assert.doesNotMatch(h.w.document.getElementById('verifyResult').textContent,/更新確認済み|最新版です/);
 h.noPairing();
});

for(const tool of ['notification','dm'])test(`${tool}: 文字列になる環境でも安定URLをワンタップでコピーしてインポートできる`,async t=>{
 const h=installer(t,tool);await wait(160);
 let copied='';
 Object.defineProperty(h.w.navigator,'clipboard',{configurable:true,value:{writeText:async value=>{copied=value}}});
 h.w.document.getElementById('copyScriptUrl').click();
 await wait(10);
 const expected=h.w.document.getElementById('install').href;
 assert.equal(copied,expected);
 assert.match(h.w.document.getElementById('copyScriptUrl').textContent,/コピーしました/);
 const guide=h.w.document.querySelector('.import-help');
 assert.match(guide.textContent,/ユーティリティ/);
 assert.match(guide.textContent,/URLからインポート/);
 assert.match(guide.textContent,/文字列/);
 assert.equal(h.nav.length,0,'URLをコピーしただけでインストール完了にしない');
 h.noPairing();
});

for(const tool of Object.keys(installers))test(`${tool}: 実インストーラーで古い保存版・クエリ・クリックだけでは戻らず、実起動後に元の画面へ戻る`,async t=>{
 const h=installer(t,tool,{stale:true});await wait(160);assert.equal(h.nav.length,0);h.click();await h.focus();
 const appNavigations=()=>h.nav.filter(({href})=>new URL(href).pathname==='/note-insight/'||new URL(href).pathname==='/note-insight/index.html');
 assert.equal(appNavigations().length,0,'保存値・query・クリックから完了を捏造しない');assert.ok(h.nav.length<=1,'実行確認のための再読込は一度まで');
 await h.focus();assert.equal(appNavigations().length,0);assert.ok(h.nav.length<=1,'確認できない状態で再読込を繰り返さない');
 h.publish();await h.focus();assert.deepEqual(appNavigations().map(entry=>entry.href),[h.target]);await h.focus();assert.equal(appNavigations().length,1);h.noPairing();
});

for(const tool of Object.keys(installers))test(`${tool}: 実ツールが起動してもmanifestを確認できなければ更新完了として戻らない`,async t=>{
 const h=installer(t,tool,{installed:true,releaseError:true});await wait(160);h.click();await h.focus();
 assert.equal(h.nav.filter(({href})=>new URL(href).pathname==='/note-insight/'||new URL(href).pathname==='/note-insight/index.html').length,0);h.noPairing();
});

test('Dashboard更新待ちがあるauto=1の入口では、読込権限があっても同期せず元のINSIGHTへ戻る',async t=>{
 const h=installer(t,'dashboard',{installed:true,auto:true,pendingUpdate:true,withReadPermission:true});await wait(160);await h.focus();
 assert.equal(h.w.document.documentElement.getAttribute('data-mumei-dashboard-feature'),'on','同期パネルが実際に有効な条件で検証する');assert.equal(h.w.localStorage.getItem('mumei-insight-access-token'),'read-authorized-fixture');
 assert.deepEqual(h.nav.map(entry=>entry.href),[h.target]);await h.focus();assert.equal(h.nav.length,1);h.noPairing();
});



test('本人通知：文字列画面を開かず、配信中の正しい最新版だけを安全にコピー',async t=>{
 const h=installer(t,'notification');await wait(160);
 const code=readFileSync('public/note-insight-notification-v3.user.js','utf8');let written='',url='',options;
 h.w.fetch=async(href,init)=>{url=String(href);options=init;return{ok:true,text:async()=>code}};
 Object.defineProperty(h.w.navigator,'clipboard',{configurable:true,value:{writeText:async text=>{written=text}}});
 h.w.document.getElementById('copyCode').click();await wait(100);
 assert.equal(written,code,'same-origin source copied with no mutation');
 assert.match(url,/^\.\/note-insight-notification-v3\.user\.js\?_script=/);
 assert.equal(options.cache,'no-store');
 assert.equal(options.credentials,'same-origin');
 assert.match(h.w.document.getElementById('codeResult').textContent,/コードをコピーしました/);
 assert.ok(h.w.sessionStorage.getItem('mumei-insight-update-pending-v1:notification'),'copy alone creates pending confirmation, not success');
 assert.equal(h.nav.length,0,'copy cannot claim install success or navigate');
});
test('本人通知：異なる出所や異なる版のコードはコピー・更新確認に使わない',async t=>{
 const h=installer(t,'notification');await wait(160);
 const wrong=readFileSync('public/note-insight-dm.user.js','utf8');let copies=0;
 h.w.fetch=async()=>({ok:true,text:async()=>wrong});
 Object.defineProperty(h.w.navigator,'clipboard',{configurable:true,value:{writeText:async()=>{copies++}}});
 h.w.document.getElementById('copyCode').click();await wait(90);
 assert.equal(copies,0);
 assert.match(h.w.document.getElementById('codeResult').textContent,/コピーできませんでした/);
 assert.equal(h.w.sessionStorage.getItem('mumei-insight-update-pending-v1:notification'),null);
});


test('DM同期：文字列画面を開かず、既存スクリプトへの上書きコードをコピー',async t=>{
 const h=installer(t,'dm');await wait(160);
 const code=readFileSync('public/note-insight-dm.user.js','utf8');let written='',url='',options;
 h.w.fetch=async(href,init)=>{url=String(href);options=init;return{ok:true,text:async()=>code}};
 Object.defineProperty(h.w.navigator,'clipboard',{configurable:true,value:{writeText:async text=>{written=text}}});
 h.w.document.getElementById('copyCode').click();await wait(90);
 assert.equal(written,code);
 assert.match(url,/^\.\/note-insight-dm\.user\.js\?_script=/);
 assert.equal(options.cache,'no-store');
 assert.equal(options.credentials,'same-origin');
 assert.match(h.w.document.getElementById('codeResult').textContent,/コピーしました/);
 assert.ok(h.w.sessionStorage.getItem('mumei-insight-update-pending-v1:dm'),'DM confirmation must not claim success before startup');
 assert.equal(h.nav.length,0);
});
test('DM同期：本人通知スクリプトの取り違えや版違いではコードをコピーしない',async t=>{
 const h=installer(t,'dm');await wait(160);
 const wrong=readFileSync('public/note-insight-notification-v3.user.js','utf8');let copies=0;
 h.w.fetch=async()=>({ok:true,text:async()=>wrong});
 Object.defineProperty(h.w.navigator,'clipboard',{configurable:true,value:{writeText:async()=>{copies++}}});
 h.w.document.getElementById('copyCode').click();await wait(90);
 assert.equal(copies,0);
 assert.match(h.w.document.getElementById('codeResult').textContent,/コピーできませんでした/);
 assert.equal(h.w.sessionStorage.getItem('mumei-insight-update-pending-v1:dm'),null);
});
