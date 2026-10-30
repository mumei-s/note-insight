import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

const BASE='https://mumei-s.github.io/note-insight/';
const source=readFileSync('public/insight-browser-guide.js','utf8');
const shared=readFileSync('public/insight-update-return.js','utf8');
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const android='Mozilla/5.0 (Linux; Android 15; Phone) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
const ios='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko)';
const pc='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const matrix=[
 ['Android Edge',android+' EdgA/130.0.0.0','android-edge',false,true,false],
 ['Android Firefox','Mozilla/5.0 (Android 15; Mobile; rv:130.0) Gecko/130.0 Firefox/130.0','android-firefox',false,true,false],
 ['Android Chrome',android,'android-other',false,true,false],
 ['Android WebView',android.replace('Phone','Phone; wv'),'android-other',false,true,true],
 ['Android ChatGPT',android+' ChatGPT/1.2026.293','android-other',false,true,true],
 ['Android Edge UA inside ChatGPT',android+' EdgA/130.0 ChatGPT/1.2026.293','android-edge',false,true,true],
 ['iPhone Safari',ios+' Version/18.0 Mobile/15E148 Safari/604.1','ios-safari',true,false,false],
 ['iPhone Chrome',ios+' CriOS/130.0.0.0 Mobile/15E148 Safari/604.1','ios-other',true,false,false],
 ['iPhone Edge',ios+' EdgiOS/130.0.0.0 Mobile/15E148 Safari/605.1.15','ios-other',true,false,false],
 ['iPhone Firefox',ios+' FxiOS/130.0 Mobile/15E148 Safari/605.1.15','ios-other',true,false,false],
 ['iPhone ChatGPT',ios+' Mobile/15E148 ChatGPT/1.2026.293','ios-other',true,false,true],
 ['iPad desktop Safari','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15','ios-safari',true,false,false,{platform:'MacIntel',maxTouchPoints:5}],
 ['Mac Safari','Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15','mac-safari',false,false,false],
 ['Windows Chrome',pc,'pc-chrome',false,false,false],
 ['Windows Edge',pc+' Edg/130.0.0.0','pc-edge',false,false,false],
 ['Windows Firefox','Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:130.0) Gecko/20100101 Firefox/130.0','pc-firefox',false,false,false],
 ['Windows Opera',pc+' OPR/115.0.0.0','pc-opera',false,false,false],
 ['Anonymous app UA','Mozilla/5.0','pc-chrome',false,false,false],
 ['Explicit ChatGPT UA','ChatGPT/1.2026.293','pc-chrome',false,false,true]
];

function fixture(t,{ua=android+' EdgA/130.0',platform='',maxTouchPoints=0,query='',tool='notification',withShared=true,live='',manager=''}={}){
 const dom=new JSDOM('<!doctype html><html><head></head><body><section id="guide"></section><a id="primary">更新</a></body></html>',{url:BASE+'notification-update-now.html'+(query?'?'+query:''),runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window;t.after(()=>w.close());const errors=[],events=[];
 for(const [name,value] of Object.entries({userAgent:ua,platform,maxTouchPoints}))Object.defineProperty(w.navigator,name,{value,configurable:true});
 if(live)w.document.documentElement.setAttribute('data-mumei-'+tool+'-live-version',live);
 if(manager)w.document.documentElement.setAttribute('data-mumei-'+tool+'-live-manager',manager);
 w.addEventListener('error',event=>errors.push(String(event.error||event.message)));
 w.document.addEventListener('mumei-insight-browser-guide-change',event=>events.push({...event.detail}));
 if(withShared)w.eval(shared);w.eval(source);
 const guide=w.MumeiInsightBrowserGuide,root=w.document.getElementById('guide');
 return{w,guide,root,events,errors,mount:()=>guide.mount(root,tool),el:selector=>root.querySelector(selector),state:()=>guide.forTool(tool)};
}

for(const [name,ua,browser,iosDevice,androidDevice,embedded,extra={}] of matrix)test('browser guide detects '+name+' without claiming a running installation',t=>{
 const h=fixture(t,{ua,...extra});
 const actual=h.guide.describe({userAgent:ua,...extra});
 assert.equal(actual.browser,browser);assert.equal(actual.ios,iosDevice);assert.equal(actual.android,androidDevice);assert.equal(actual.embedded,embedded);
 h.mount();assert.equal(h.state().liveVersion,'');assert.match(h.el('.ibg-state').textContent,/まだ確認できていません/);
 assert.equal(h.w.document.documentElement.getAttribute('data-mumei-notification-live-version'),null);
 assert.match(h.el('.ibg-context').textContent,/ブラウザ名の自動判定だけで更新済みにはしません/);
 assert.deepEqual(h.errors,[]);
});

for(const tool of ['notification','dm','dashboard'])for(const withShared of [true,false])test(`${tool}: handoff URL preserves only the account and safe app return (${withShared?'shared resolver':'standalone'})`,t=>{
 const h=fixture(t,{tool,withShared});
 const back=new URL(BASE);back.searchParams.set('insightMode','analysis');back.searchParams.set('analysisPanel','verdict');back.searchParams.set('insightTab','dm');back.searchParams.set('account','another');back.searchParams.set('token','BACK_SECRET');back.searchParams.set('code','BACK_CODE');back.hash='owner-insight';
 const q=new URLSearchParams({tool,account:'@Tester',token:'TOP_SECRET',code:'TOP_CODE',return:back.href,browserRoute:'ios-safari',scriptManager:'userscripts'});
 const safe=new URL(h.guide.safePage(tool,BASE+'notification-update-now.html?'+q));
 assert.equal(safe.origin,new URL(BASE).origin);assert.equal(safe.pathname,'/note-insight/notification-update-now.html');assert.equal(safe.searchParams.get('tool'),tool);assert.equal(safe.searchParams.get('account'),'tester');
 assert.equal(safe.searchParams.get('browserRoute'),'ios-safari');assert.equal(safe.searchParams.get('scriptManager'),'userscripts');
 assert.ok([...safe.searchParams.keys()].every(key=>['tool','account','return','browserRoute','scriptManager'].includes(key)));
 assert.doesNotMatch(decodeURIComponent(safe.href),/TOP_SECRET|TOP_CODE|BACK_SECRET|BACK_CODE|another/);
 const ret=new URL(safe.searchParams.get('return'));assert.equal(ret.origin,safe.origin);assert.equal(ret.pathname,'/note-insight/');
 assert.ok([...ret.searchParams.keys()].every(key=>['insightMode','insightTab','analysisPanel','account','notificationAccount'].includes(key)));
 assert.equal(ret.searchParams.get('account')||ret.searchParams.get('notificationAccount'),'tester');
 assert.equal(ret.searchParams.get('insightMode'),'analysis');assert.equal(ret.searchParams.get('analysisPanel'),'verdict');assert.equal(ret.searchParams.get('insightTab'),'dm');assert.equal(ret.hash,'#owner-insight');
});

test('standalone handoff preserves a normal app mode and selected tab without the shared return helper',t=>{
 const h=fixture(t,{withShared:false});
 for(const [tool,mode,tab] of [['dm','normal','dm'],['notification','notifications','notifications'],['dashboard','normal','articles']]){
  const back=BASE+'?'+new URLSearchParams({insightMode:mode,insightTab:tab,code:'SECRET_CODE',token:'SECRET_TOKEN'})+'#dashboard';
  const target=new URL(h.guide.safePage(tool,BASE+'notification-update-now.html?'+new URLSearchParams({tool,account:'Tester',return:back}))),ret=new URL(target.searchParams.get('return'));
  assert.equal(ret.searchParams.get('insightMode'),mode);assert.equal(ret.searchParams.get('insightTab'),tab);assert.equal(ret.searchParams.get('account')||ret.searchParams.get('notificationAccount'),'tester');assert.doesNotMatch(decodeURIComponent(target.href),/SECRET_CODE|SECRET_TOKEN/);
 }
});

test('malformed return URL never throws in standalone safePage or mounted browser guidance',async t=>{
 for(const tool of ['notification','dm','dashboard']){
  const h=fixture(t,{tool,withShared:false,query:new URLSearchParams({tool,account:'Tester',return:'http://['}).toString()});
  let target;assert.doesNotThrow(()=>{target=new URL(h.guide.safePage(tool))});assert.doesNotThrow(()=>h.guide.safePage(tool,'http://['));assert.doesNotThrow(()=>h.mount());await wait(0);
  const ret=new URL(target.searchParams.get('return'));assert.equal(ret.origin,new URL(BASE).origin);assert.equal(ret.pathname,'/note-insight/');assert.equal(ret.searchParams.get('account')||ret.searchParams.get('notificationAccount'),'tester');assert.equal(ret.searchParams.get('insightMode'),tool==='notification'?'notifications':tool==='dashboard'?'analysis':'normal');
  assert.equal(new URL(h.el('.ibg-url').value).origin,new URL(BASE).origin);assert.deepEqual(h.errors,[]);
 }
});

test('external, credential-bearing, executable and nested sensitive return URLs never leave the app origin',t=>{
 const h=fixture(t);
 for(const raw of ['https://evil.example/steal?token=SECRET','https://user:password@mumei-s.github.io/note-insight/','javascript:alert(1)','data:text/html,secret',BASE+'notification-update-now.html?'+new URLSearchParams({return:'https://evil.example/?code=SECRET',account:'../invalid',browserRoute:'<script>',scriptManager:'UNKNOWN'})]){
  const safe=new URL(h.guide.safePage('notification',raw)),ret=new URL(safe.searchParams.get('return'));
  assert.equal(safe.origin,new URL(BASE).origin);assert.equal(safe.username,'');assert.equal(safe.password,'');assert.equal(ret.origin,safe.origin);assert.doesNotMatch(safe.href,/SECRET|password|evil|javascript|script%3E/);assert.equal(safe.searchParams.has('browserRoute'),false);assert.equal(safe.searchParams.has('scriptManager'),false);
 }
 const safe=new URL(h.guide.safePage('dashboard',BASE+'dashboard-setup.html?auto=1&token=SECRET&account=Tester'));assert.equal(safe.searchParams.get('auto'),'0');assert.equal(safe.searchParams.get('account'),'tester');assert.equal(safe.searchParams.has('token'),false);
});

for(const [browser,pkg] of [['android-edge','com.microsoft.emmx'],['android-firefox','org.mozilla.firefox']])test(browser+' intent selects its exact package and sanitizes the HTTPS fallback',t=>{
 const h=fixture(t),raw=BASE+'notification-update-now.html?'+new URLSearchParams({account:'Tester',token:'SECRET',return:'https://evil.example/?code=CODE'});
 const value=h.guide.intent('dm',browser,raw);assert.ok(value.startsWith('intent://mumei-s.github.io/note-insight/notification-update-now.html?'));assert.ok(value.includes(';package='+pkg+';'));
 const fallback=new URL(decodeURIComponent(value.match(/;S\.browser_fallback_url=([^;]+);/)[1]));assert.equal(fallback.protocol,'https:');assert.equal(fallback.origin,new URL(BASE).origin);assert.equal(fallback.searchParams.get('browserLaunchFailed'),browser);assert.equal(fallback.searchParams.get('browserRoute'),browser);assert.equal(fallback.searchParams.get('scriptManager'),'tampermonkey');assert.equal(fallback.searchParams.get('account'),'tester');assert.equal(fallback.searchParams.get('tool'),'dm');assert.doesNotMatch(decodeURIComponent(fallback.href),/SECRET|evil|CODE/);
});

test('iOS offers a selectable URL and Userscripts instructions without inventing a Safari launch URL',t=>{
 const h=fixture(t,{ua:ios+' CriOS/130.0 Mobile/15E148 Safari/604.1'});h.mount();
 assert.equal(h.guide.intent('notification','ios-safari'),'');assert.equal(h.el('.ibg-edge').hidden,true);assert.equal(h.el('.ibg-firefox').hidden,true);assert.match(h.el('.ibg-switch').textContent,/Safariを自分で起動/);
 h.guide.setBrowser('notification','ios-safari');assert.equal(h.state().manager,'userscripts');assert.equal(h.el('.ibg-manager-row').hidden,false);assert.match(h.el('.ibg-steps').textContent,/Userscripts.*インストール／更新/);assert.match(h.el('.ibg-steps').textContent,/文字列の画面は正常な途中手順/);assert.equal(h.state().canInstall,false,'choosing Safari cannot enable extensions in the original iOS Chrome surface');
 assert.doesNotMatch(h.root.innerHTML,/x-safari|safari:\/\/|googlechrome:\/\//i);
});

test('copy success and denied clipboard both retain a sanitized, selectable handoff URL',async t=>{
 const h=fixture(t,{query:new URLSearchParams({account:'Tester',token:'SECRET'}).toString()});h.mount();const copied=[];
 Object.defineProperty(h.w.navigator,'clipboard',{configurable:true,value:{writeText:async value=>copied.push(value)}});h.el('.ibg-copy').click();await wait(0);assert.deepEqual(copied,[h.el('.ibg-url').value]);assert.match(h.el('.ibg-copy-status').textContent,/URLをコピーしました/);assert.doesNotMatch(copied[0],/SECRET/);
 Object.defineProperty(h.w.navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw Error('DENIED')}}});h.w.document.execCommand=()=>false;h.el('.ibg-copy').click();await wait(0);
 const input=h.el('.ibg-url');assert.equal(h.w.document.activeElement,input);assert.equal(input.selectionStart,0);assert.equal(input.selectionEnd,input.value.length);assert.match(h.el('.ibg-copy-status').textContent,/自動コピーできません.*長押し/);assert.equal(h.state().liveVersion,'');assert.equal(h.w.sessionStorage.length,0);
});

test('app-contained update click is blocked; manual browser or manager choices never forge a live version',t=>{
 const h=fixture(t,{ua:android+' EdgA/130.0 ChatGPT/1.2026.293'});h.mount();const primary=h.w.document.getElementById('primary');primary.href=BASE+'note-insight-notification-v3.user.js';let reached=0;primary.addEventListener('click',event=>{reached++;event.preventDefault()});
 primary.click();assert.equal(reached,0);assert.equal(h.state().canInstall,false);assert.match(h.el('.ibg-copy-status').textContent,/普段のブラウザを先に開いて/);
 h.guide.setBrowser('notification','android-edge');h.guide.setManager('notification','tampermonkey');primary.click();assert.equal(reached,0);assert.equal(h.state().liveVersion,'');assert.equal(h.state().canInstall,false);assert.equal(h.w.document.documentElement.hasAttribute('data-mumei-notification-live-version'),false);assert.equal(h.w.localStorage.length,0);assert.equal(h.w.sessionStorage.length,0);
});

test('preset handoff and actual dropdown actions change instructions without elevating an unsupported original surface',t=>{
 const h=fixture(t,{ua:android.replace('Phone','Phone; wv'),query:'browserRoute=android-edge&scriptManager=tampermonkey'});h.mount();
 assert.equal(h.state().browser,'android-edge');assert.equal(h.state().actualBrowser,'android-other');assert.equal(h.state().canInstall,false);
 const browser=h.el('.ibg-browser');browser.value='ios-safari';browser.dispatchEvent(new h.w.Event('change',{bubbles:true}));assert.equal(h.state().browser,'ios-safari');assert.equal(h.state().manager,'userscripts');assert.equal(h.el('.ibg-manager-row').hidden,false);
 const manager=h.el('.ibg-manager');manager.value='tampermonkey';manager.dispatchEvent(new h.w.Event('change',{bubbles:true}));assert.equal(h.state().manager,'tampermonkey');assert.match(h.el('.ibg-steps').textContent,/Tampermonkey/);
 const target=new URL(h.el('.ibg-url').value);assert.equal(target.searchParams.get('browserRoute'),'ios-safari');assert.equal(target.searchParams.get('scriptManager'),'tampermonkey');assert.equal(h.state().canInstall,false);assert.equal(h.state().liveVersion,'');
});

for(const tool of ['notification','dm','dashboard'])test(tool+': a real existing live runtime remains usable even under an embedded-looking UA',async t=>{
 const h=fixture(t,{tool,ua:android+' EdgA/130.0 ChatGPT/1.2026.293',live:'1.2.3',manager:'Tampermonkey'});h.mount();
 assert.equal(h.state().liveVersion,'1.2.3');assert.equal(h.state().manager,'tampermonkey');assert.equal(h.state().canInstall,true);assert.equal(h.el('.ibg-handoff').hidden,true);assert.match(h.el('.ibg-state').textContent,/v1\.2\.3.*起動/);
 const primary=h.w.document.getElementById('primary'),file={notification:'note-insight-notification-v3.user.js',dm:'note-insight-dm.user.js',dashboard:'note-insight-dashboard-sync.user.js'}[tool];primary.href=BASE+file;let reached=0;primary.addEventListener('click',event=>{reached++;event.preventDefault()});primary.click();assert.equal(reached,1);
 h.guide.setBrowser(tool,'ios-safari');h.guide.setManager(tool,'userscripts');await wait(0);assert.equal(h.state().manager,'userscripts');assert.equal(h.state().canInstall,true);assert.equal(h.w.document.documentElement.getAttribute('data-mumei-'+tool+'-live-manager'),'Tampermonkey');assert.equal(h.w.document.documentElement.getAttribute('data-mumei-'+tool+'-live-version'),'1.2.3');assert.deepEqual(h.errors,[]);
});

test('Safari detects the actual Userscripts manager but changing instructions alone never confirms an update',async t=>{
 const h=fixture(t,{ua:ios+' Version/18.0 Mobile/15E148 Safari/604.1',live:'3.6.60',manager:'Userscripts'});h.mount();assert.equal(h.state().manager,'userscripts');assert.match(h.el('.ibg-steps').textContent,/拡張機能 → Userscripts/);
 h.guide.setManager('notification','tampermonkey');assert.equal(h.state().manager,'tampermonkey');assert.match(h.el('.ibg-steps').textContent,/Tampermonkey/);assert.equal(h.w.document.documentElement.getAttribute('data-mumei-notification-live-manager'),'Userscripts');assert.equal(h.w.document.documentElement.getAttribute('data-mumei-notification-live-version'),'3.6.60');
 h.w.document.documentElement.removeAttribute('data-mumei-notification-live-version');await wait(0);assert.equal(h.state().liveVersion,'');assert.match(h.el('.ibg-state').textContent,/まだ確認できていません/);assert.equal(h.el('.ibg-handoff').hidden,false);assert.equal(h.w.sessionStorage.length,0);
});

test('repeated tool-ready signals and unchanged runtime attributes do not create an event or DOM mutation loop',async t=>{
 const h=fixture(t);h.mount();const first=h.events.length;assert.equal(first,1);const initialAttrs=[...h.w.document.documentElement.attributes].map(a=>[a.name,a.value]);
 for(let i=0;i<5;i++)h.w.dispatchEvent(new h.w.Event('mumei-insight-tool-ready'));await wait(20);assert.equal(h.events.length,first);assert.deepEqual([...h.w.document.documentElement.attributes].map(a=>[a.name,a.value]),initialAttrs);
 h.w.document.documentElement.setAttribute('data-mumei-notification-live-version','3.6.60');await wait(20);assert.equal(h.events.length,first+1);
 for(let i=0;i<5;i++)h.w.document.documentElement.setAttribute('data-mumei-notification-live-version','3.6.60');await wait(20);assert.equal(h.events.length,first+1);
 h.guide.setBrowser('notification','not-a-browser');h.guide.setManager('notification','unknown-manager');await wait(20);assert.equal(h.events.length,first+1);assert.equal(h.w.document.querySelectorAll('#insight-browser-guide-style').length,1);assert.deepEqual(h.errors,[]);
});
