(function(){
'use strict';
if(!['note.com','mumei-s.github.io'].includes(location.hostname))return;
if(window.__mumeiNotificationLoader321)return;window.__mumeiNotificationLoader321=true;
const VERSION='3.2.1';
const BASE='https://mumei-s.github.io/note-insight/';
const V3_FRAME='mumei-v3-notification-frame';
const IS_NOTE=location.hostname==='note.com';
const ESSENTIAL=['note-insight-notification-runtime-v2958.js','note-insight-notification-autoscan-v2970.js','note-insight-notification-bootstrap-v2966.js'];
const OPTIONAL=['note-insight-notification-filter-restore-v2962.js','note-insight-notification-filter-safety-v2961.js'];
const CACHE='mumei-v3-core-cache:';
const loaded=new Set();
let loading=false,ready=false,retryTimer=0,retryCount=0,lastHref=location.href,dashboardLoaded=false;

function modern(){return Boolean(globalThis.GM)}
async function getValue(k,d=''){try{if(modern()&&typeof GM.getValue==='function')return await GM.getValue(k,d);if(typeof GM_getValue==='function')return GM_getValue(k,d)}catch{}return d}
async function setValue(k,v){try{if(modern()&&typeof GM.setValue==='function')return await GM.setValue(k,v);if(typeof GM_setValue==='function')return GM_setValue(k,v)}catch{}}
function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
function safeReturn(v){try{const u=new URL(String(v||''));return u.origin==='https://mumei-s.github.io'&&u.pathname.startsWith('/note-insight/')?u.href:''}catch{return''}}
function dashboardRoute(){return true}
function stripLegacyUi(){for(const id of['mumei-v2948-frame','mumei-notice-reader-v2963','mumei-v3-panel-clean-v1','mumei-v3-fixed-dock','mumei-v3-notification-launcher']){const el=document.getElementById(id);if(!el||id===V3_FRAME)continue;if(id==='mumei-v3-notification-launcher'){el.remove();continue}if(el instanceof HTMLElement){el.style.setProperty('display','none','important');el.style.setProperty('visibility','hidden','important');el.style.setProperty('pointer-events','none','important');el.style.setProperty('width','0px','important');el.style.setProperty('height','0px','important')}}}

const initialUrl=location.href;
const versionCheckRequested=new URL(initialUrl).searchParams.get('mumei_insight_version_check')==='1';
function handleVersionCheck(){const u=new URL(location.href);if(u.searchParams.get('mumei_insight_version_check')!=='1'&&!versionCheckRequested)return false;const back=safeReturn(u.searchParams.get('mumei_return'));u.searchParams.delete('mumei_insight_version_check');u.searchParams.delete('mumei_return');history.replaceState(history.state,'',u.pathname+(u.search?'?'+u.searchParams.toString():'')+u.hash);if(back){const b=new URL(back);b.searchParams.set('notificationInstalled',VERSION);b.searchParams.set('notificationCheckedAt',String(Date.now()));b.searchParams.set('notificationUpdateResult','runtime-checked-v321');location.replace(b.href)}return true}

function gmRequest(url){return new Promise((resolve,reject)=>{const details={method:'GET',url,headers:{'Cache-Control':'no-cache'},timeout:20000,onload:r=>r.status>=200&&r.status<300?resolve(String(r.responseText||'')):reject(new Error('HTTP_'+r.status)),onerror:()=>reject(new Error('NETWORK_ERROR')),ontimeout:()=>reject(new Error('TIMEOUT'))};try{if(modern()&&typeof GM.xmlHttpRequest==='function'){GM.xmlHttpRequest(details);return}if(typeof GM_xmlhttpRequest==='function'){GM_xmlhttpRequest(details);return}}catch(e){reject(e);return}reject(new Error('USERSCRIPT_REQUEST_UNAVAILABLE'))})}
async function fetchText(url){const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw new Error('FETCH_'+r.status);return r.text()}
async function componentText(name){const url=BASE+name+'?v=321&ts='+Date.now();let last=null;for(let i=0;i<2;i++){try{const t=await gmRequest(url);if(t.trim()){await setValue(CACHE+name,t);return t}}catch(e){last=e}try{const t=await fetchText(url);if(t.trim()){await setValue(CACHE+name,t);return t}}catch(e){last=e}await sleep(180+i*220)}const cached=String(await getValue(CACHE+name,'')||'');if(cached.trim())return cached;throw last||new Error('EMPTY_'+name)}
function transform(name,code){let s=String(code||'');if(name.includes('runtime-v2958')){s=s.replaceAll('__mumeiNotificationRuntime2958','__mumeiNotificationRuntimeV321').replaceAll('mumei-v2948-frame',V3_FRAME).replaceAll('mumei-notice-shell-v2958','mumei-notice-shell-v3');s=s.replace(/const VERSION='[^']*'/,"const VERSION='3.2.1'")}else if(name.includes('autoscan-v2970')){s=s.replaceAll('__mumeiNotificationAutoscan2970','__mumeiNotificationAutoscanV321').replaceAll('mumei-v2948-frame',V3_FRAME).replaceAll('data-mumei-notice-shell-v2958','data-mumei-notice-shell-v3');s=s.replace(/const VERSION='[^']*',PROTOCOL='[^']*'/,"const VERSION='3.2.1',PROTOCOL='3.2.1'")}else if(name.includes('bootstrap-v2966')){s=s.replaceAll('mumei-v2948-frame',V3_FRAME);s=s.replace(/const VERSION='[^']*'/,"const VERSION='3.2.1'");if(versionCheckRequested)s=s.replace('if(handleVersionCheck())return;','')}else if(name.includes('filter-restore-v2962')){s=s.replaceAll('__mumeiNotificationFilterRestore2962','__mumeiNotificationFilterRestoreV321').replaceAll('mumei-v2948-frame',V3_FRAME)}else if(name.includes('filter-safety-v2961')){s=s.replaceAll('__mumeiNotificationFilterSafety2961','__mumeiNotificationFilterSafetyV321').replaceAll('mumei-v2948-frame',V3_FRAME).replaceAll('data-mumei-notice-shell-v2958','data-mumei-notice-shell-v3')}return s}
async function loadComponent(name){if(loaded.has(name))return true;const src=transform(name,await componentText(name));if(!src.trim())throw new Error('EMPTY_'+name);eval(src+'\n//# sourceURL='+(BASE+name));loaded.add(name);return true}

async function ensureDashboard(){if(!dashboardRoute()||dashboardLoaded)return;try{await loadComponent('note-insight-dashboard-integrated-v318.js');dashboardLoaded=true;try{localStorage.setItem('mumei-dashboard-integrated-runtime','3.2.1')}catch{}}catch(e){console.warn('[INSIGHT] ダッシュボード接続失敗',e)}}
function signalReady(){ready=true;retryCount=0;window.__mumeiV3CoreReady=true;document.dispatchEvent(new Event('mumei-v3-core-ready'));try{localStorage.setItem('mumei-notification-v3-loader',VERSION)}catch{}}
function scheduleRetry(){if(ready||retryTimer)return;const delays=[900,1800,3500,7000,15000,30000],delay=delays[Math.min(retryCount++,delays.length-1)];retryTimer=setTimeout(()=>{retryTimer=0;startLoad()},delay)}
async function loadLatest(){await ensureDashboard();if(!document.body)await new Promise(resolve=>document.addEventListener('DOMContentLoaded',resolve,{once:true}));stripLegacyUi();if(!IS_NOTE){if(versionCheckRequested)handleVersionCheck();return}let ok=true;for(const name of ESSENTIAL){try{await loadComponent(name)}catch(e){ok=false;console.warn('[INSIGHT通知V3] core retry',name,e)}}if(!ok){scheduleRetry();return}for(const name of OPTIONAL)loadComponent(name).catch(e=>console.warn('[INSIGHT通知V3] optional',name,e));signalReady();if(versionCheckRequested)handleVersionCheck()}
async function startLoad(){if(loading||ready)return;loading=true;try{await loadLatest()}finally{loading=false}}
function routeChanged(){if(location.href===lastHref)return;lastHref=location.href;void ensureDashboard();stripLegacyUi()}
function installRouteWatch(){for(const name of['pushState','replaceState']){const orig=history[name];if(typeof orig!=='function'||orig.__mumeiLoader321Wrapped)continue;const fn=function(){const out=orig.apply(this,arguments);queueMicrotask(routeChanged);return out};fn.__mumeiLoader321Wrapped=true;history[name]=fn}addEventListener('popstate',routeChanged);addEventListener('hashchange',routeChanged)}
installRouteWatch();
window.addEventListener('online',()=>{void ensureDashboard();if(!ready)startLoad()});
window.addEventListener('focus',()=>{stripLegacyUi();void ensureDashboard();if(!ready)startLoad()});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){stripLegacyUi();void ensureDashboard();if(!ready)startLoad()}});
startLoad();
})();
