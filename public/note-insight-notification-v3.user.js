// ==UserScript==
// @name         無名S note INSIGHT 本人通知 V3
// @namespace    https://github.com/mumei-s/note-insight/notification-v3
// @version      3.2.8
// @description  本人通知V3。通知一覧の固定4列パネル・通知読込・フィルター・INSIGHT連携・ダッシュボード同期を1本で起動。
// @match        https://note.com/*
// @match        https://mumei-s.github.io/note-insight/tool-setup.html*
// @match        https://mumei-s.github.io/note-insight/dashboard-setup.html*
// @run-at       document-idle
// @grant        GM.xmlHttpRequest
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM.deleteValue
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @connect      mumei-s.github.io
// @connect      xxhaerjvrgmnadxjqetz.supabase.co
// @updateURL    https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-notification-v3.user.js
// @downloadURL  https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-insight-notification-v3.user.js
// ==/UserScript==

(function(){
'use strict';
if(!['note.com','mumei-s.github.io'].includes(location.hostname))return;
if(window.__mumeiUnifiedNotification328)return;window.__mumeiUnifiedNotification328=true;
const VERSION='3.2.8';
const BASE='https://mumei-s.github.io/note-insight/';
const CACHE='mumei-v328-component-cache:';
const GENERIC='mumei-component-cache:';
const isNote=location.hostname==='note.com';
const isDashboardSetup=!isNote&&/\/dashboard-setup\.html$/i.test(location.pathname);
const modern=()=>Boolean(globalThis.GM);
const RESCUE='mumei-v3-rescue-dock-v328';
const STANDARD='mumei-v3-visible-dock-v322';
const FILTER='mumei_insight_magazine_filter_enabled_v3:';
let rescueIntentUntil=0,rescuePendingRead=false,rescueAccount='';
function safeReturn(v){try{const u=new URL(String(v||''));return u.origin==='https://mumei-s.github.io'&&u.pathname.startsWith('/note-insight/')?u.href:''}catch{return''}}
function directVersionCheck(){if(!isNote)return false;const u=new URL(location.href);if(u.searchParams.get('mumei_insight_version_check')!=='1')return false;const back=safeReturn(u.searchParams.get('mumei_return'));if(!back)return false;const dest=new URL(back);dest.searchParams.set('notificationInstalled',VERSION);dest.searchParams.set('notificationCheckedAt',String(Date.now()));dest.searchParams.set('notificationUpdateResult','runtime-checked-v328');location.replace(dest.href);return true}
async function getValue(k,d=''){try{if(modern()&&typeof GM.getValue==='function')return await GM.getValue(k,d);if(typeof GM_getValue==='function')return GM_getValue(k,d)}catch{}return d}
async function setValue(k,v){try{if(modern()&&typeof GM.setValue==='function')return await GM.setValue(k,v);if(typeof GM_setValue==='function')return GM_setValue(k,v)}catch{}}
function gmText(url){return new Promise((resolve,reject)=>{const req={method:'GET',url,headers:{'Cache-Control':'no-cache'},timeout:20000,onload:r=>r.status>=200&&r.status<300?resolve(String(r.responseText||'')):reject(new Error('HTTP_'+r.status)),onerror:()=>reject(new Error('NETWORK_ERROR')),ontimeout:()=>reject(new Error('TIMEOUT'))};try{if(modern()&&typeof GM.xmlHttpRequest==='function'){GM.xmlHttpRequest(req);return}if(typeof GM_xmlhttpRequest==='function'){GM_xmlhttpRequest(req);return}}catch(e){reject(e);return}reject(new Error('USERSCRIPT_REQUEST_UNAVAILABLE'))})}
async function source(name){const url=BASE+name+'?v=328&ts='+Date.now();let last=null;for(let i=0;i<3;i++){try{const t=await gmText(url);if(t.trim()){await setValue(CACHE+name,t);await setValue(GENERIC+name,t);return t}}catch(e){last=e}try{const r=await fetch(url,{cache:'no-store'});if(r.ok){const t=await r.text();if(t.trim()){await setValue(CACHE+name,t);await setValue(GENERIC+name,t);return t}}}catch(e){last=e}await new Promise(r=>setTimeout(r,180+i*260))}const exact=String(await getValue(CACHE+name,'')||'');if(exact.trim())return exact;const generic=String(await getValue(GENERIC+name,'')||'');if(generic.trim())return generic;throw last||new Error('EMPTY_'+name)}
async function run(name){const src=await source(name);(0,eval)(src+'\n//# sourceURL='+(BASE+name));}
function record(name,state,error=''){try{localStorage.setItem('mumei-notification-v328-component:'+name,JSON.stringify({state,error:String(error||''),at:Date.now()}))}catch{}}
function fatal(e){console.error('[INSIGHT V3.2.8]',e);try{localStorage.setItem('mumei-notification-v3-error',String(e?.message||e))}catch{}}
function notificationRoute(){return /^\/notifications(?:\/|$)/i.test(location.pathname)}
function notificationTrigger(target){const el=target?.closest?.('button,a,[role="button"],[role="tab"]');if(!el)return false;const href=String(el.getAttribute('href')||'');const t=[el.textContent,el.getAttribute('aria-label'),el.getAttribute('title'),el.getAttribute('data-testid')].filter(Boolean).join(' ');return /\/notifications(?:[/?#]|$)/i.test(href)||/(?:^|\s)(?:通知|お知らせ)(?:\s|$)/u.test(t)||/notification|notice/i.test(t)}
function ensureRescue(){let r=document.getElementById(RESCUE);if(r)return r;const s=document.createElement('style');s.id=RESCUE+'-style';s.textContent=`#${RESCUE}{position:fixed;left:8px;right:8px;bottom:max(10px,calc(env(safe-area-inset-bottom,0px) + 6px));height:34px;z-index:2147483646;display:none;grid-template-columns:repeat(4,minmax(0,1fr));gap:2px;padding:3px;border:1px solid #355063;border-radius:8px;background:#0e1c26;box-shadow:0 -3px 10px rgba(0,0,0,.30);font-family:system-ui,-apple-system,sans-serif;pointer-events:auto!important;touch-action:manipulation!important}#${RESCUE} button{display:flex;align-items:center;justify-content:center;min-width:0;height:25px;margin:0;padding:0 3px;border:1px solid #42667b;border-radius:6px;background:#102737;color:#e3f8ff;font:900 10px/1 system-ui;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;touch-action:manipulation!important}#${RESCUE} button.on{background:#17422f;border-color:#56a77b}#${RESCUE} button.ins{border-color:#55d8f1;background:#11374a}`;(document.head||document.documentElement).appendChild(s);r=document.createElement('div');r.id=RESCUE;r.setAttribute('role','toolbar');r.setAttribute('aria-label','INSIGHT 本人通知 救済パネル');r.innerHTML='<button type="button" data-r="read">下から読込</button><button type="button" data-r="filter">フィルターOFF</button><button type="button" data-r="settings">設定</button><button type="button" class="ins" data-r="ins">INSIGHT【通知】</button>';(document.body||document.documentElement).appendChild(r);r.addEventListener('click',async e=>{const b=e.target.closest('button[data-r]');if(!b)return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();const a=b.dataset.r;if(a==='read'){const api=window.__mumeiV3Reader322;if(api&&typeof api.scan==='function'){b.textContent='読込開始…';try{await api.scan()}catch{}}else{rescuePendingRead=true;b.textContent='読込待機…';document.dispatchEvent(new Event('mumei-v3-read-request'))}return}if(a==='filter'){const id=await currentAccount();if(!id)return;const k=FILTER+id,on=!Boolean(await getValue(k,false));await setValue(k,on);b.textContent=on?'フィルターON':'フィルターOFF';b.classList.toggle('on',on);document.dispatchEvent(new Event('mumei-v3-filter-changed'));return}if(a==='settings'){location.href='https://mumei-s.github.io/note-insight/notification-filter.html?from=note&mumei_return='+encodeURIComponent('https://note.com/notifications')+'&v=328&ts='+Date.now();return}if(a==='ins'){const id=await currentAccount(),u=new URL('https://mumei-s.github.io/note-insight/notification-entry.html?from=note&insightMode=notifications#dashboard');if(id)u.searchParams.set('account',id);location.href=u.href}},true);return r}
async function currentAccount(){if(rescueAccount)return rescueAccount;try{const r=await fetch('/api/v2/current_user',{credentials:'include',cache:'no-store'});if(!r.ok)return'';const j=await r.json(),u=(j.data??j).user||(j.data??j),id=String(u?.urlname||u?.url_name||u?.username||'').replace(/^@/,'').toLowerCase();if(/^[a-z0-9_-]+$/.test(id))rescueAccount=id}catch{}return rescueAccount}
async function paintRescueFilter(){const r=document.getElementById(RESCUE);if(!r)return;const id=await currentAccount();if(!id)return;const on=Boolean(await getValue(FILTER+id,false)),b=r.querySelector('[data-r="filter"]');if(b){b.textContent=on?'フィルターON':'フィルターOFF';b.classList.toggle('on',on)}}
function standardVisible(){const r=document.getElementById(STANDARD);if(!r)return false;const s=getComputedStyle(r);return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity||1)>.01}
function showRescue(on){const r=ensureRescue();if(standardVisible()){r.style.setProperty('display','none','important');return}r.style.setProperty('display',on?'grid':'none','important');if(on)void paintRescueFilter()}
function refreshRescue(){if(!isNote)return;showRescue(notificationRoute()||Date.now()<rescueIntentUntil)}
function startRescue(){if(!isNote)return;ensureRescue();document.addEventListener('click',e=>{if(!notificationTrigger(e.target))return;rescueIntentUntil=Date.now()+30000;showRescue(true)},true);const hook=name=>{const orig=history[name];history[name]=function(){const out=orig.apply(this,arguments);setTimeout(refreshRescue,0);return out}};hook('pushState');hook('replaceState');addEventListener('popstate',refreshRescue);setInterval(refreshRescue,700);refreshRescue()}
async function loadPart(name){try{await run(name);record(name,'ok');return true}catch(e){record(name,'error',e?.message||e);fatal(e);return false}}
async function boot(){if(directVersionCheck())return;if(isNote){startRescue();await loadPart('note-insight-notification-dock-watch-v312.js');refreshRescue();const readerOk=await loadPart('note-insight-notification-reader-v322.js');if(readerOk&&rescuePendingRead){rescuePendingRead=false;try{await window.__mumeiV3Reader322?.scan?.()}catch{}}await loadPart('note-insight-notification-loader-v318.js')}else if(isDashboardSetup){await loadPart('note-insight-notification-loader-v318.js')}try{localStorage.setItem('mumei-notification-v3-loader',VERSION)}catch{}}
void boot();
})();
