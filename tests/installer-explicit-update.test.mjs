import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

const BASE='https://mumei-s.github.io/note-insight/';
const ACTIVE='mumei-insight-active-account-v3';
const shared=readFileSync('public/insight-update-return.js','utf8');
const release=JSON.parse(readFileSync('public/insight-release.json','utf8'));
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function settle(check,message){for(let i=0;i<80&&!check();i++)await wait(10);assert.ok(check(),message)}
function fixture(t,{tool='notification',current='3.6.57',manifest=release,fail=false,returnTo='',page='notification-update-now.html',ua='Mozilla/5.0 (Linux; Android 15) Chrome/130.0.0.0 Mobile Safari/537.36 EdgA/130.0.0.0'}={}){
 const params=new URLSearchParams({tool,account:'tester'});if(returnTo)params.set('return',returnTo);
 const html=readFileSync('public/'+page,'utf8');
 const dom=new JSDOM(html,{url:BASE+page+'?'+params,runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window,nav=[],fetches=[],errors=[];t.after(()=>w.close());
 Object.defineProperty(w.navigator,'userAgent',{configurable:true,value:ua});
 w.localStorage.setItem(ACTIVE,'tester');
 if(current)w.document.documentElement.setAttribute('data-mumei-'+tool+'-live-version',current);
 w.addEventListener('error',e=>errors.push(e.error||e.message));
 w.fetch=async(url,options)=>{fetches.push({url:String(url),options});if(fail)throw Error('OFFLINE');assert.match(String(url),/insight-release\.json/);return{ok:true,json:async()=>manifest}};
 const loc=new URL(w.location.href);w.__location={href:loc.href,origin:loc.origin,pathname:loc.pathname,search:loc.search,hash:loc.hash,replace:url=>nav.push(url)};
 if(page==='notification-update-now.html'){
  w.eval('(()=>{const location=window.__location;'+shared+'})()');
  w.eval('(()=>{const location=window.__location;'+readFileSync('public/insight-browser-guide.js','utf8')+'})()');
  for(const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi))if(match[1].trim())w.eval('(()=>{const location=window.__location;'+match[1]+'})()');
  w.MumeiInsightBrowserGuide.mount(w.document.getElementById('insightBrowserGuide'),tool);
 }else{
  // Real global script evaluation preserves the existing page's manifest binding.
  w.eval(shared);
  for(const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi))if(match[1].trim())w.eval(match[1]);
 }
 const click=id=>{const node=w.document.getElementById(id);node.addEventListener('click',e=>e.preventDefault(),{once:true});node.click()};
 return{w,nav,fetches,errors,click,el:id=>w.document.getElementById(id)};
}

for(const tool of ['notification','dm'])test(`${tool}: an older installed tool has an explicit update button, not only a return button`,async t=>{
 const expected=release[tool==='dm'?'dmVersion':'notificationVersion'];
 const h=fixture(t,{tool,current:'1.0.0',page:tool==='dm'?'dm-browser-install.html':'notification-browser-install.html'});
 await settle(()=>h.el('verifiedUpdateAction')?.textContent.includes(expected),'old installation exposes the actual update path');
 const action=h.el('verifiedUpdateAction'),status=h.el(tool==='dm'?'dmEasyStatus':'easyStatus');
 assert.equal(action.hidden,false);assert.notEqual(action.style.display,'none');
 assert.match(status.textContent,/未更新/);assert.match(status.textContent,/1\.0\.0/);assert.ok(status.textContent.includes(expected));
 const next=new URL(action.href);assert.equal(next.origin,new URL(BASE).origin);assert.equal(next.pathname,'/note-insight/notification-update-now.html');assert.equal(next.searchParams.get('tool'),tool);
 assert.equal(h.w.document.documentElement.getAttribute('data-mumei-'+tool+'-live-version'),'1.0.0','UI cannot forge the runtime version');
 status.textContent='導入済み。普段は自動更新を利用できます。';
 await settle(()=>status.textContent.includes('未更新'),'subsequent old-page repaint cannot hide the mismatch');
 assert.equal(h.errors.length,0);
});

for(const tool of ['notification','dm'])test(`${tool}: update action lets the extension intercept a stable userscript URL without opening its intermediate page`,async t=>{
 const expected=release[tool==='dm'?'dmVersion':'notificationVersion'],h=fixture(t,{tool,current:'1.0.0'});
 await settle(()=>h.el('latest').textContent==='v'+expected,'published release is loaded');
 const action=h.el('installNow'),url=new URL(action.href);
 assert.equal(action.hidden,false);assert.equal(action.getAttribute('aria-disabled'),'false');
 assert.equal(url.origin,new URL(BASE).origin);assert.equal(url.pathname,'/note-insight/'+(tool==='dm'?'note-insight-dm.user.js':'note-insight-notification-v3.user.js'));
 assert.equal(url.search,'');assert.equal(url.hash,'');
 assert.doesNotMatch(readFileSync('public/notification-update-now.html','utf8'),/https:\/\/www\.tampermonkey\.net\/script_installation\.php/);
 h.click('installNow');await wait(30);
 assert.match(h.el('status').textContent,/まだ更新を確認できません/);assert.equal(h.nav.length,0);
 assert.equal(h.w.document.documentElement.getAttribute('data-mumei-'+tool+'-live-version'),'1.0.0');
 const pending=JSON.parse(h.w.sessionStorage.getItem('mumei-insight-update-pending-v1:'+tool));assert.equal(pending.targetVersion,expected);
 h.w.document.documentElement.setAttribute('data-mumei-'+tool+'-live-version',expected);
 await settle(()=>h.nav.length===1,'actual new runtime, not a button click, confirms update');
 assert.equal(h.w.sessionStorage.getItem('mumei-insight-update-pending-v1:'+tool),null);
 assert.equal(new URL(h.nav[0]).origin,new URL(BASE).origin);
 assert.equal(h.errors.length,0);
});

for(const tool of ['notification','dm'])test(`${tool}: URL import fallback copies the stable source but requires actual updated runtime`,async t=>{
 const expected=release[tool==='dm'?'dmVersion':'notificationVersion'],h=fixture(t,{tool,current:'1.0.0'}),copied=[];
 Object.defineProperty(h.w.navigator,'clipboard',{configurable:true,value:{writeText:async value=>copied.push(value)}});
 await settle(()=>h.el('latest').textContent==='v'+expected,'published release is loaded');
 h.click('copyUrl');
 await settle(()=>h.el('copyStatus').textContent.includes('URLをコピーしました'),'fallback reports copy');
 assert.deepEqual(copied,['https://raw.githubusercontent.com/mumei-s/note-insight/main/public/'+(tool==='dm'?'note-insight-dm.user.js':'note-insight-notification-v3.user.js')]);
 assert.equal(h.el('scriptUrl').value,copied[0]);assert.equal(h.el('manualHelp').open,true);
 assert.match(h.el('manualHelp').textContent,/ユーティリティ → URLからインポート/);
 assert.equal(h.el('manualHelp').querySelectorAll('li').length,3);
 assert.match(h.el('status').textContent,/まだ更新を確認できません/);assert.equal(h.nav.length,0);
 assert.equal(h.w.document.documentElement.getAttribute('data-mumei-'+tool+'-live-version'),'1.0.0');
 const pending=JSON.parse(h.w.sessionStorage.getItem('mumei-insight-update-pending-v1:'+tool));assert.equal(pending.targetVersion,expected);
 h.w.document.documentElement.setAttribute('data-mumei-'+tool+'-live-version',expected);
 await settle(()=>h.nav.length===1,'only the new running version completes the update');
 assert.equal(h.errors.length,0);
});

test('clipboard failure keeps the import URL selectable and never claims an update or successful copy',async t=>{
 const h=fixture(t,{current:'1.0.0'});
 Object.defineProperty(h.w.navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw Error('DENIED')}}});h.w.document.execCommand=()=>false;
 await settle(()=>h.el('latest').textContent.startsWith('v'),'published release is loaded');h.click('copyUrl');
 await settle(()=>h.el('copyStatus').textContent.includes('自動コピーができません'),'copy failure is explained');
 assert.match(h.el('copyStatus').textContent,/長押ししてコピー/);assert.equal(h.el('manualHelp').open,true);
 assert.match(h.el('scriptUrl').value,/^https:\/\/raw\.githubusercontent\.com\/mumei-s\/note-insight\/main\/public\/note-insight-notification-v3\.user\.js$/);
 assert.match(h.el('status').textContent,/未更新/);assert.equal(h.el('readyBack').hidden,true);assert.equal(h.nav.length,0);
 assert.equal(h.w.sessionStorage.getItem('mumei-insight-update-pending-v1:notification'),null);
 assert.equal(h.errors.length,0);
});

test('stored high version cannot hide the update when no runtime has reported',async t=>{
 const h=fixture(t,{current:''});h.w.localStorage.setItem('mumei-notification-tool-version','99.0.0');
 await settle(()=>h.el('latest').textContent.startsWith('v'),'release loaded');
 assert.equal(h.el('current').textContent,'起動未確認');assert.equal(h.el('readyBack').hidden,true);assert.equal(h.nav.length,0);
});

test('manifest failure remains unverified and never starts an install or marks it complete',async t=>{
 const h=fixture(t,{fail:true});await settle(()=>h.el('status').textContent.includes('確認に失敗'),'visible failure');
 assert.equal(h.el('installNow').getAttribute('aria-disabled'),'true');h.click('installNow');await wait(30);
 assert.equal(h.w.sessionStorage.getItem('mumei-insight-update-pending-v1:notification'),null);assert.equal(h.nav.length,0);
});

test('Edge launch stays explicit and return URLs never carry foreign hosts or login tokens',async t=>{
 const h=fixture(t,{returnTo:'https://outside.invalid/?token=secret'});await settle(()=>h.el('latest').textContent.startsWith('v'),'release loaded');
 const uri=h.w.document.querySelector('.ibg-edge').href;assert.match(uri,/^intent:\/\/mumei-s\.github\.io\/note-insight\/notification-update-now\.html\?/);assert.match(uri,/package=com\.microsoft\.emmx;/);assert.doesNotMatch(uri,/outside\.invalid|secret/);
 assert.equal(new URL(h.el('back').href).origin,new URL(BASE).origin);
 assert.equal(h.nav.length,0,'opening the helper must not automatically launch another app');
});

for(const tool of ['notification','dm'])test(tool+': Safari Userscripts uses the script-page extension popup instead of Tampermonkey URL import',async t=>{
 const h=fixture(t,{tool,current:'1.0.0',ua:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'});
 await settle(()=>h.el('latest').textContent.startsWith('v'),'release loaded');
 assert.equal(h.el('manualHelp').hidden,true);
 assert.match(h.el('instruction').textContent,/文字列の画面は正常/);
 assert.match(h.el('instruction').textContent,/拡張機能 → Userscripts/);
 assert.doesNotMatch(h.el('instruction').textContent,/URLからインポート/);
 h.click('installNow');await wait(10);
 assert.equal(h.el('manualHelp').hidden,true);
 assert.ok(h.w.sessionStorage.getItem('mumei-insight-update-pending-v1:'+tool));
 assert.match(h.el('status').textContent,/まだ更新を確認できません/);
});

test('a ChatGPT Android webview cannot start pending update before moving into an extension browser',async t=>{
 const h=fixture(t,{current:'',ua:'Mozilla/5.0 (Linux; Android 15; wv) AppleWebKit/537.36 Version/4.0 Chrome/130.0.0.0 Mobile Safari/537.36 ChatGPT/1.0'});
 await settle(()=>h.el('latest').textContent.startsWith('v'),'release loaded');
 assert.equal(h.el('installNow').getAttribute('aria-disabled'),'true');
 h.click('installNow');assert.equal(h.w.sessionStorage.getItem('mumei-insight-update-pending-v1:notification'),null);
 assert.equal(h.nav.length,0);
 assert.match(h.w.document.querySelector('.ibg-copy-status').textContent,/普段のブラウザ/);
});

test('a changed account cannot be redirected by the old pending update',async t=>{
 const h=fixture(t,{current:'1.0.0'});await settle(()=>h.el('latest').textContent.startsWith('v'),'release loaded');h.click('installNow');
 h.w.localStorage.setItem(ACTIVE,'someone_else');h.w.document.documentElement.setAttribute('data-mumei-notification-live-version',release.notificationVersion);
 await wait(50);assert.equal(h.nav.length,0);assert.match(h.el('status').textContent,/アカウントが変わった/);assert.equal(h.el('status').className,'status');
});
