// ==UserScript==
// @name         無名S note INSIGHT 本人通知 V3
// @namespace    https://github.com/mumei-s/note-insight/notification-v3
// @version      3.2.6
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
// @updateURL    https://mumei-s.github.io/note-insight/note-insight-notification-v3.user.js
// @downloadURL  https://mumei-s.github.io/note-insight/note-insight-notification-v3.user.js
// ==/UserScript==

(function(){
'use strict';
if(!['note.com','mumei-s.github.io'].includes(location.hostname))return;
if(window.__mumeiUnifiedNotification326)return;window.__mumeiUnifiedNotification326=true;
const VERSION='3.2.6';
const BASE='https://mumei-s.github.io/note-insight/';
const CACHE='mumei-v326-component-cache:';
const GENERIC='mumei-component-cache:';
const isNote=location.hostname==='note.com';
const isDashboardSetup=!isNote&&/\/dashboard-setup\.html$/i.test(location.pathname);
const modern=()=>Boolean(globalThis.GM);
async function getValue(k,d=''){try{if(modern()&&typeof GM.getValue==='function')return await GM.getValue(k,d);if(typeof GM_getValue==='function')return GM_getValue(k,d)}catch{}return d}
async function setValue(k,v){try{if(modern()&&typeof GM.setValue==='function')return await GM.setValue(k,v);if(typeof GM_setValue==='function')return GM_setValue(k,v)}catch{}}
function gmText(url){return new Promise((resolve,reject)=>{const req={method:'GET',url,headers:{'Cache-Control':'no-cache'},timeout:20000,onload:r=>r.status>=200&&r.status<300?resolve(String(r.responseText||'')):reject(new Error('HTTP_'+r.status)),onerror:()=>reject(new Error('NETWORK_ERROR')),ontimeout:()=>reject(new Error('TIMEOUT'))};try{if(modern()&&typeof GM.xmlHttpRequest==='function'){GM.xmlHttpRequest(req);return}if(typeof GM_xmlhttpRequest==='function'){GM_xmlhttpRequest(req);return}}catch(e){reject(e);return}reject(new Error('USERSCRIPT_REQUEST_UNAVAILABLE'))})}
async function source(name){const url=BASE+name+'?v=326&ts='+Date.now();let last=null;for(let i=0;i<3;i++){try{const t=await gmText(url);if(t.trim()){await setValue(CACHE+name,t);await setValue(GENERIC+name,t);return t}}catch(e){last=e}try{const r=await fetch(url,{cache:'no-store'});if(r.ok){const t=await r.text();if(t.trim()){await setValue(CACHE+name,t);await setValue(GENERIC+name,t);return t}}}catch(e){last=e}await new Promise(r=>setTimeout(r,180+i*260))}const exact=String(await getValue(CACHE+name,'')||'');if(exact.trim())return exact;const generic=String(await getValue(GENERIC+name,'')||'');if(generic.trim())return generic;throw last||new Error('EMPTY_'+name)}
async function run(name){const src=await source(name);(0,eval)(src+'\n//# sourceURL='+(BASE+name));}
function fatal(e){console.error('[INSIGHT V3.2.6]',e);try{localStorage.setItem('mumei-notification-v3-error',String(e?.message||e))}catch{}}
async function boot(){try{if(isNote){await run('note-insight-notification-reader-v322.js');await run('note-insight-notification-dock-watch-v312.js');await run('note-insight-notification-loader-v318.js')}else if(isDashboardSetup){await run('note-insight-notification-loader-v318.js')}try{localStorage.setItem('mumei-notification-v3-loader',VERSION)}catch{}}catch(e){fatal(e)}}
void boot();
})();
