// ==UserScript==
// @name         無名S note INSIGHT 本人通知 V3
// @namespace    https://github.com/mumei-s/note-insight/notification-v3
// @version      3.2.82
// @description  2026-09-14 13:58の正常構成へ復元。通知UI・監視・自動読込・起動を分離した安定版です。
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
const VERSION='3.2.82';
const BASE='https://mumei-s.github.io/note-insight/';
const V3_FRAME='mumei-v3-notification-frame';
const OLD_IDS=['mumei-v2948-frame','mumei-notice-reader-v2963'];
const ESSENTIAL=[
  'note-insight-notification-runtime-v2958.js',
  'note-insight-notification-dock-watch-v312.js',
  'note-insight-notification-autoscan-v2970.js',
  'note-insight-notification-bootstrap-v2966.js'
];
const OPTIONAL=[
  'note-insight-notification-filter-restore-v2962.js',
  'note-insight-notification-filter-safety-v2961.js'
];
const CACHE='mumei-v3-core-cache:';
const loaded=new Set();
let loading=false,ready=false,retryTimer=0,retryCount=0;

function clean(v){return String(v||'').replace(/\s+/g,' ').trim()}
function safeReturn(v){try{const u=new URL(String(v||''));return u.origin==='https://mumei-s.github.io'&&u.pathname.startsWith('/note-insight/')?u.href:''}catch{return''}}
function modern(){return Boolean(globalThis.GM)}
async function getValue(k,d=''){try{if(modern()&&typeof GM.getValue==='function')return await GM.getValue(k,d);if(typeof GM_getValue==='function')return GM_getValue(k,d)}catch{}return d}
async function setValue(k,v){try{if(modern()&&typeof GM.setValue==='function')return await GM.setValue(k,v);if(typeof GM_setValue==='function')return GM_setValue(k,v)}catch{}}
function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
function clearLegacyStatus(){document.getElementById('mumei-v3-load-status')?.remove()}

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
if(versionCheckRequested){const u=new URL(location.href);u.searchParams.delete('mumei_insight_version_check');u.searchParams.delete('mumei_return');history.replaceState(history.state,'',u.pathname+u.search+u.hash)}

function looksOldDock(f){
  if(!(f instanceof HTMLIFrameElement)||f.id===V3_FRAME)return false;
  if(OLD_IDS.includes(f.id))return true;
  try{
    const body=clean(f.contentDocument?.body?.textContent||''),title=clean(f.title||'');
    if(/本人通知の接続に失敗|再接続してください|本人通知.*接続失敗/u.test(body))return true;
    return(/INSIGHT.*通知/u.test(title)||/INSIGHT【通知】|本人通知/u.test(body))&&/(?:前回の続きから読込|下から読込|接続に失敗)/u.test(body)
  }catch{return false}
}
function neutralize(el){
  if(!(el instanceof HTMLElement)||el.id===V3_FRAME)return;
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
  clearLegacyStatus();
  for(const id of OLD_IDS){const el=document.getElementById(id);if(el)neutralize(el)}
  for(const f of document.querySelectorAll('iframe'))if(looksOldDock(f))neutralize(f)
}
function installOldGuard(){
  const start=()=>{
    sweepOld();
    new MutationObserver(ms=>{for(const m of ms){if(m.type==='attributes'){const t=m.target;if(t instanceof HTMLIFrameElement&&looksOldDock(t))neutralize(t);continue}if(m.type==='childList'){for(const n of m.addedNodes){if(n instanceof HTMLElement&&n.id==='mumei-v3-load-status'){n.remove();continue}if(n instanceof HTMLIFrameElement&&looksOldDock(n))neutralize(n);else if(n instanceof Element){for(const f of n.querySelectorAll?.('iframe')||[])if(looksOldDock(f))neutralize(f)}}}}}).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['style','class','hidden','aria-hidden']})
  };
  if(document.documentElement)start();else document.addEventListener('DOMContentLoaded',start,{once:true})
}
installOldGuard();

function gmRequest(url){return new Promise((resolve,reject)=>{
  const details={method:'GET',url,headers:{'Cache-Control':'no-cache'},timeout:20000,onload:r=>r.status>=200&&r.status<300?resolve(String(r.responseText||'')):reject(new Error('HTTP_'+r.status)),onerror:()=>reject(new Error('NETWORK_ERROR')),ontimeout:()=>reject(new Error('TIMEOUT'))};
  try{
    if(modern()&&typeof GM.xmlHttpRequest==='function'){GM.xmlHttpRequest(details);return}
    if(typeof GM_xmlhttpRequest==='function'){GM_xmlhttpRequest(details);return}
  }catch(e){reject(e);return}
  reject(new Error('USERSCRIPT_REQUEST_UNAVAILABLE'))
})}
async function fetchText(url){const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw new Error('FETCH_'+r.status);return r.text()}
async function componentText(name){
  const url=BASE+name+'?v3='+Date.now();let last=null;
  for(let i=0;i<2;i++){
    try{const text=await gmRequest(url);if(text.trim()){await setValue(CACHE+name,text);return text}}catch(e){last=e}
    try{const text=await fetchText(url);if(text.trim()){await setValue(CACHE+name,text);return text}}catch(e){last=e}
    await sleep(180+i*220)
  }
  const cached=String(await getValue(CACHE+name,'')||'');
  if(cached.trim())return cached;
  throw last||new Error('EMPTY_'+name)
}
function transform(name,code){
  let s=String(code||'');
  if(name.includes('runtime-v2958')){
    s=s.replaceAll('__mumeiNotificationRuntime2958','__mumeiNotificationRuntimeV3');
    s=s.replaceAll('mumei-v2948-frame',V3_FRAME).replaceAll('mumei-v2958-style','mumei-v3-notification-style').replaceAll('mumei-v2958-hide','mumei-v3-notification-hide').replaceAll('mumei-v2958-boundary','mumei-v3-notification-boundary').replaceAll('mumei-notice-shell-v2958','mumei-notice-shell-v3');
    s=s.replace(/const VERSION='[^']*'/,"const VERSION='3.1.2'");
  }else if(name.includes('filter-restore-v2962')){
    s=s.replaceAll('__mumeiNotificationFilterRestore2962','__mumeiNotificationFilterRestoreV3').replaceAll('mumei-v2948-frame',V3_FRAME);
    s=s.replace(/const VERSION='[^']*'/,"const VERSION='3.1.2'");
  }else if(name.includes('autoscan-v2970')){
    s=s.replaceAll('__mumeiNotificationAutoscan2970','__mumeiNotificationAutoscanV3').replaceAll('mumei-v2948-frame',V3_FRAME).replaceAll('data-mumei-notice-shell-v2958','data-mumei-notice-shell-v3');
    s=s.replace(/const VERSION='[^']*',PROTOCOL='[^']*'/,"const VERSION='3.1.2',PROTOCOL='3.1.2'");
    s=s.replaceAll('note-notification-bottom-up-v2970','note-notification-bottom-up-v3');
  }else if(name.includes('filter-safety-v2961')){
    s=s.replaceAll('__mumeiNotificationFilterSafety2961','__mumeiNotificationFilterSafetyV3').replaceAll('mumei-v2948-frame',V3_FRAME).replaceAll('data-mumei-notice-shell-v2958','data-mumei-notice-shell-v3').replaceAll('data-mumei-input-shield-hidden','data-mumei-v3-input-shield-hidden');
  }else if(name.includes('bootstrap-v2966')){
    s=s.replace(/const VERSION='[^']*'/,"const VERSION='3.1.2'").replaceAll('mumei-v2948-frame',V3_FRAME);
    if(versionCheckRequested)s=s.replace('if(handleVersionCheck())return;','')
  }
  return s
}
async function loadComponent(name){
  if(loaded.has(name))return true;
  const src=transform(name,await componentText(name));
  if(!src.trim())throw new Error('EMPTY_'+name);
  eval(src+'\n//# sourceURL='+(BASE+name));
  loaded.add(name);return true
}
function scheduleRetry(){
  if(ready||retryTimer)return;
  const delays=[900,1800,3500,7000,15000,30000];const delay=delays[Math.min(retryCount++,delays.length-1)];
  retryTimer=setTimeout(()=>{retryTimer=0;startLoad()},delay)
}
async function loadLatest(){
  if(!document.body)await new Promise(resolve=>document.addEventListener('DOMContentLoaded',resolve,{once:true}));
  sweepOld();let essentialOk=true;
  for(const name of ESSENTIAL){try{await loadComponent(name)}catch(e){essentialOk=false;console.warn('[INSIGHT通知V3] core retry',name,e)}}
  if(essentialOk){
    ready=true;retryCount=0;clearLegacyStatus();sweepOld();
    try{localStorage.setItem('mumei-notification-v3-loader',VERSION)}catch{}
    for(const name of OPTIONAL){loadComponent(name).catch(e=>console.warn('[INSIGHT通知V3] optional',name,e))}
    if(versionCheckRequested)handleVersionCheck();
    return
  }
  scheduleRetry()
}
async function startLoad(){if(loading||ready)return;loading=true;try{await loadLatest()}finally{loading=false}}
window.addEventListener('online',()=>{if(!ready)startLoad()});
window.addEventListener('focus',()=>{clearLegacyStatus();sweepOld();if(!ready)startLoad()});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){clearLegacyStatus();sweepOld();if(!ready)startLoad()}});
startLoad();
})();
