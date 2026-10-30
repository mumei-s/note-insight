import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

const BASE='https://mumei-s.github.io/note-insight/';
const shared=readFileSync('public/insight-update-return.js','utf8');
const browserGuide=readFileSync('public/insight-browser-guide.js','utf8');
const release=JSON.parse(readFileSync('public/insight-release.json','utf8'));
const settle=async()=>{await new Promise(resolve=>setImmediate(resolve));await new Promise(resolve=>setImmediate(resolve))};

function fixture(t,tool,{ua,platform='',touch=0,loadGuide=true}={}){
 const file=tool==='dm'?'dm-browser-install.html':'notification-browser-install.html',html=readFileSync('public/'+file,'utf8');
 const dom=new JSDOM(html,{url:BASE+file+'?account=tester&return='+encodeURIComponent(BASE+'?insightMode=normal&insightTab=dm#dashboard'),runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
 t.after(()=>w.close());Object.defineProperty(w.navigator,'userAgent',{value:ua||'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Version/18.0 Mobile/15E148 Safari/604.1'});
 Object.defineProperty(w.navigator,'platform',{value:platform});Object.defineProperty(w.navigator,'maxTouchPoints',{value:touch});
 const calls=[];w.fetch=async(url,init={})=>{calls.push({url:String(url),init});assert.match(String(url),/insight-release\.json/);return{ok:true,json:async()=>release}};
 w.eval(shared);if(loadGuide)w.eval(browserGuide);for(const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi))if(match[1].trim())w.eval(match[1]);
 return{w,calls,el:id=>w.document.getElementById(id),file,html};
}

for(const tool of ['notification','dm'])test(`${tool}: Safari Userscriptsは文字列から拡張メニューで更新し、TM専用復旧は表示しない`,async t=>{
 const h=fixture(t,tool);await settle();const dm=tool==='dm';
 assert.match(h.el(dm?'dmEasyExtension':'easyExtension').href,/apps\.apple\.com\/.*id1463298887/);
 assert.match(h.el(dm?'dmEasyInstallHelp':'easyInstallHelp').textContent,/Userscripts/);
 assert.match(h.el(dm?'dmEasyUpdateText':'easyUpdateText').textContent,/文字列/);
 assert.ok([...h.w.document.querySelectorAll('[data-tampermonkey-help]')].every(node=>node.hidden));
 assert.equal(h.w.document.querySelectorAll('a[href*="browser=safari"]').length,0,'無料の主導線から有料の導入へ誘導しない');
 const link=h.el('install');link.addEventListener('click',event=>event.preventDefault());link.click();assert.match(h.el(dm?'result':'verifyResult').textContent,/Userscripts/);assert.ok(h.w.sessionStorage.getItem('mumei-insight-update-pending-v1:'+tool));
 assert.ok(h.calls.every(call=>!call.init.method||call.init.method==='GET'));
 h.w.MumeiInsightBrowserGuide.setManager(tool,'tampermonkey');await settle();assert.ok([...h.w.document.querySelectorAll('[data-tampermonkey-help]')].every(node=>!node.hidden));assert.equal(h.el(dm?'dmEasyExtension':'easyExtension').hidden,true,'既存TMの選択でSafari有料版の新規導入リンクを出さない');
});

for(const tool of ['notification','dm'])test(`${tool}: iPadのMac風UAでもUserscriptsの導線を使う`,async t=>{
 const h=fixture(t,tool,{ua:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15',platform:'MacIntel',touch:5});await settle();
 assert.equal(h.w.MumeiInsightBrowserGuide.forTool(tool).actualBrowser,'ios-safari');assert.match(h.el(tool==='dm'?'dmEasyExtension':'easyExtension').href,/id1463298887/);
});

for(const tool of ['notification','dm'])test(`${tool}: 共通ヘルパーが取得できなくてもSafariにTMのURL importを要求しない`,async t=>{
 const h=fixture(t,tool,{loadGuide:false});await settle();
 assert.match(h.el(tool==='dm'?'dmEasyExtension':'easyExtension').href,/id1463298887/);assert.ok([...h.w.document.querySelectorAll('[data-tampermonkey-help]')].every(node=>node.hidden));
 const event=new h.w.MouseEvent('click',{bubbles:true,cancelable:true});h.el('install').addEventListener('click',e=>e.preventDefault());h.el('install').dispatchEvent(event);
 assert.match(h.el(tool==='dm'?'result':'verifyResult').textContent,/Safariの拡張機能メニュー → Userscripts/);assert.doesNotMatch(h.el(tool==='dm'?'result':'verifyResult').textContent,/Tampermonkey|ユーティリティ/);
});

for(const tool of ['notification','dm'])test(`${tool}: ChatGPT内では説明選択だけでインストールを開始しない`,async t=>{
 const h=fixture(t,tool,{ua:'Mozilla/5.0 (Linux; Android 15; wv) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36 ChatGPT/1.0'});await settle();
 h.w.MumeiInsightBrowserGuide.setBrowser(tool,'android-edge');await settle();assert.equal(h.w.MumeiInsightBrowserGuide.forTool(tool).canInstall,false);
 const link=h.el('install'),event=new h.w.MouseEvent('click',{bubbles:true,cancelable:true});link.dispatchEvent(event);
 assert.equal(event.defaultPrevented,true);assert.equal(h.w.sessionStorage.getItem('mumei-insight-update-pending-v1:'+tool),null);assert.equal(h.el(tool==='dm'?'dmEasyFirst':'easyFirst').hidden,true);
});

for(const file of ['notification-browser-install.html','dm-browser-install.html','dashboard-setup.html'])test(`${file}: 共通ヘルパーが読めない場合も生HTMLにSafariの正しい途中手順を残す`,()=>{
 const html=readFileSync('public/'+file,'utf8'),dom=new JSDOM(html);try{
  const guide=dom.window.document.querySelector('[data-insight-browser-guide]');assert.ok(guide);assert.match(guide.textContent,/Safari/);assert.match(guide.textContent,/Userscripts/);assert.match(guide.textContent,/文字列/);assert.match(guide.textContent,/確定/);
  const src=dom.window.document.querySelector('script[src*="insight-browser-guide.js"]');assert.equal(src?.defer,true);
 }finally{dom.window.close()}
});
