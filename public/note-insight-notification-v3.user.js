// ==UserScript==
// @name         無名S note INSIGHT 本人通知 V3
// @namespace    https://github.com/mumei-s/note-insight/notification-v3
// @version      3.0.1
// @description  一度だけ導入する安定ローダー。本人通知本体はINSIGHTから毎回最新版を取得し、今後の通常更新を不要にします。
// @match        https://note.com/*
// @run-at       document-start
// @grant        GM.xmlHttpRequest
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      mumei-s.github.io
// @connect      xxhaerjvrgmnadxjqetz.supabase.co
// @updateURL    https://mumei-s.github.io/note-insight/note-insight-notification-v3.user.js
// @downloadURL  https://mumei-s.github.io/note-insight/note-insight-notification-v3.user.js
// ==/UserScript==

(function(){
'use strict';
if(location.hostname!=='note.com')return;
const VERSION='3.0.1';
const BASE='https://mumei-s.github.io/note-insight/';
const V3_FRAME='mumei-v3-notification-frame';
const OLD_IDS=['mumei-v2948-frame','mumei-notice-reader-v2963'];
const COMPONENTS=[
  'note-insight-notification-runtime-v2958.js',
  'note-insight-notification-filter-restore-v2962.js',
  'note-insight-notification-autoscan-v2970.js',
  'note-insight-notification-filter-safety-v2961.js',
  'note-insight-notification-bootstrap-v2966.js'
];

function clean(v){return String(v||'').replace(/\s+/g,' ').trim()}
function safeReturn(v){try{const u=new URL(String(v||''));return u.origin==='https://mumei-s.github.io'&&u.pathname.startsWith('/note-insight/')?u.href:''}catch{return''}}
const versionCheckUrl=location.href;
function handleVersionCheck(){
  const u=new URL(versionCheckUrl);
  if(u.searchParams.get('mumei_insight_version_check')!=='1')return false;
  const back=safeReturn(u.searchParams.get('mumei_return'));
  u.searchParams.delete('mumei_insight_version_check');u.searchParams.delete('mumei_return');
  history.replaceState(history.state,'',u.pathname+(u.search?'?'+u.searchParams.toString():'')+u.hash);
  if(back){const b=new URL(back);b.searchParams.set('notificationInstalled',VERSION);b.searchParams.set('notificationCheckedAt',String(Date.now()));b.searchParams.set('notificationUpdateResult','checked-v3');location.replace(b.href)}
  return true;
}
const versionCheckRequested=new URL(versionCheckUrl).searchParams.get('mumei_insight_version_check')==='1';
// Claim the check before installed legacy scripts can return an obsolete version.
if(versionCheckRequested){const u=new URL(location.href);u.searchParams.delete('mumei_insight_version_check');u.searchParams.delete('mumei_return');history.replaceState(history.state,'',u.pathname+u.search+u.hash);}

function looksOldDock(f){
  if(!(f instanceof HTMLIFrameElement)||f.id===V3_FRAME)return false;
  if(OLD_IDS.includes(f.id))return true;
  try{const body=clean(f.contentDocument?.body?.textContent||''),title=clean(f.title||'');return(/INSIGHT.*通知/u.test(title)||/INSIGHT【通知】/u.test(body))&&/前回の続きから読込/u.test(body)}catch{return false}
}
function neutralize(el){
  if(!(el instanceof HTMLElement)||el.id===V3_FRAME)return;
  const already=el.getAttribute('data-mumei-v3-neutralized')==='1'&&el.style.getPropertyValue('display')==='none'&&el.style.getPropertyPriority('display')==='important'&&el.style.getPropertyValue('pointer-events')==='none';
  if(already)return;
  el.style.setProperty('display','none','important');
  el.style.setProperty('visibility','hidden','important');
  el.style.setProperty('pointer-events','none','important');
  el.style.setProperty('width','0','important');
  el.style.setProperty('height','0','important');
  el.style.setProperty('max-width','0','important');
  el.style.setProperty('max-height','0','important');
  el.setAttribute('data-mumei-v3-neutralized','1');
}
function sweepOld(){
  for(const id of OLD_IDS){const el=document.getElementById(id);if(el)neutralize(el)}
  for(const f of document.querySelectorAll('iframe'))if(looksOldDock(f))neutralize(f);
}
function installOldGuard(){
  const start=()=>{
    sweepOld();
    new MutationObserver(ms=>{for(const m of ms){if(m.type==='attributes'){const t=m.target;if(t instanceof HTMLIFrameElement&&looksOldDock(t))neutralize(t);continue}if(m.type==='childList'){for(const n of m.addedNodes){if(n instanceof HTMLIFrameElement&&looksOldDock(n))neutralize(n);else if(n instanceof Element){for(const f of n.querySelectorAll?.('iframe')||[])if(looksOldDock(f))neutralize(f)}}}}}).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['style','class','hidden','aria-hidden']});
  };
  if(document.documentElement)start();else document.addEventListener('DOMContentLoaded',start,{once:true});
}
installOldGuard();

function gmText(url){return new Promise((resolve,reject)=>{
  const fn=globalThis.GM?.xmlHttpRequest||globalThis.GM_xmlhttpRequest;
  if(!fn){fetch(url,{cache:'no-store'}).then(r=>r.ok?r.text():Promise.reject(new Error('HTTP_'+r.status))).then(resolve,reject);return}
  fn({method:'GET',url,headers:{'Cache-Control':'no-cache'},timeout:30000,onload:r=>r.status>=200&&r.status<300?resolve(String(r.responseText||'')):reject(new Error('HTTP_'+r.status)),onerror:()=>reject(new Error('NETWORK_ERROR')),ontimeout:()=>reject(new Error('TIMEOUT'))});
})}
function transform(name,code){
  let s=String(code||'');
  if(name.includes('runtime-v2958')){
    s=s.replaceAll('__mumeiNotificationRuntime2958','__mumeiNotificationRuntimeV3');
    s=s.replaceAll('mumei-v2948-frame',V3_FRAME).replaceAll('mumei-v2958-style','mumei-v3-notification-style').replaceAll('mumei-v2958-hide','mumei-v3-notification-hide').replaceAll('mumei-v2958-boundary','mumei-v3-notification-boundary').replaceAll('mumei-notice-shell-v2958','mumei-notice-shell-v3');
    s=s.replace(/const VERSION='[^']*'/,"const VERSION='3.0.1'");
  }else if(name.includes('filter-restore-v2962')){
    s=s.replaceAll('__mumeiNotificationFilterRestore2962','__mumeiNotificationFilterRestoreV3').replaceAll('mumei-v2948-frame',V3_FRAME);
    s=s.replace(/const VERSION='[^']*'/,"const VERSION='3.0.1'");
  }else if(name.includes('autoscan-v2970')){
    s=s.replaceAll('__mumeiNotificationAutoscan2970','__mumeiNotificationAutoscanV3').replaceAll('mumei-v2948-frame',V3_FRAME).replaceAll('data-mumei-notice-shell-v2958','data-mumei-notice-shell-v3');
    s=s.replace(/const VERSION='[^']*',PROTOCOL='[^']*'/,"const VERSION='3.0.1',PROTOCOL='3.0.1'");
    s=s.replaceAll('note-notification-bottom-up-v2970','note-notification-bottom-up-v3');
  }else if(name.includes('filter-safety-v2961')){
    s=s.replaceAll('__mumeiNotificationFilterSafety2961','__mumeiNotificationFilterSafetyV3').replaceAll('mumei-v2948-frame',V3_FRAME).replaceAll('data-mumei-notice-shell-v2958','data-mumei-notice-shell-v3').replaceAll('data-mumei-input-shield-hidden','data-mumei-v3-input-shield-hidden');
  }else if(name.includes('bootstrap-v2966')){
    s=s.replace(/const VERSION='[^']*'/,"const VERSION='3.0.1'").replaceAll('mumei-v2948-frame',V3_FRAME);
    if(versionCheckRequested)s=s.replace('if(handleVersionCheck())return;','');
  }
  return s;
}
let loading=false,ready=false;
function loaderNotice(message){
 const mount=()=>{let box=document.getElementById('mumei-v3-load-status');if(!box){box=document.createElement('div');box.id='mumei-v3-load-status';box.style.cssText='position:fixed;bottom:62px;left:8px;right:8px;z-index:2147483647;padding:10px;background:#102737;color:white;border:1px solid #55d8f1;border-radius:9px;font:12px system-ui;text-align:center';const label=document.createElement('span');box.append(label);const retry=document.createElement('button');retry.textContent='再接続';retry.style.cssText='margin-left:8px;padding:6px';retry.onclick=()=>startLoad();box.append(retry);(document.body||document.documentElement).append(box)}box.firstChild.textContent=message};if(document.documentElement)mount();else document.addEventListener('DOMContentLoaded',mount,{once:true});
}
async function loadLatest(){
  if(!document.body)await new Promise(resolve=>document.addEventListener('DOMContentLoaded',resolve,{once:true}));
  sweepOld();
  for(const name of COMPONENTS){
    const url=BASE+name+'?v3='+Date.now();
    const src=transform(name,await gmText(url));
    if(!src.trim())throw new Error('EMPTY_'+name);
    eval(src+'\n//# sourceURL='+url);
  }
  sweepOld();
  ready=true;document.getElementById('mumei-v3-load-status')?.remove();
  if(versionCheckRequested)handleVersionCheck();
  try{localStorage.setItem('mumei-notification-v3-loader',VERSION)}catch{}
}
async function startLoad(){if(loading||ready)return;loading=true;try{await loadLatest()}catch(e){console.error('[INSIGHT通知V3]',e);loaderNotice('本人通知の接続に失敗しました。通信を確認して再接続してください。')}finally{loading=false}}
window.addEventListener('online',()=>startLoad());
startLoad();
})();
