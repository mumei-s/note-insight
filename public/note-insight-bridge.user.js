// ==UserScript==
// @name         無名S note INSIGHT Bridge
// @namespace    https://mumei-s.github.io/note-insight/bridge
// @version      1.0.0
// @description  INSIGHTの本人通知と公式Dashboard同期を1本で起動する共通Bridge。今後の機能更新はBridgeから自動取得します。
// @match        https://note.com/*
// @match        https://mumei-s.github.io/note-insight/*
// @run-at       document-start
// @grant        GM.xmlHttpRequest
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM.deleteValue
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @connect      mumei-s.github.io
// @connect      raw.githubusercontent.com
// @connect      xxhaerjvrgmnadxjqetz.supabase.co
// @updateURL    https://mumei-s.github.io/note-insight/note-insight-bridge.user.js
// @downloadURL  https://mumei-s.github.io/note-insight/note-insight-bridge.user.js
// ==/UserScript==

(function(){
'use strict';
const VERSION='1.0.0';
const BASE='https://mumei-s.github.io/note-insight/';
const CACHE='mumei-insight-bridge-cache:';
const HEARTBEAT='mumei-insight-bridge-version';
const loaded=new Set();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const modern=()=>Boolean(globalThis.GM);
async function getValue(k,d=''){try{if(modern()&&typeof GM.getValue==='function')return await GM.getValue(k,d);if(typeof GM_getValue==='function')return GM_getValue(k,d)}catch{}return d}
async function setValue(k,v){try{if(modern()&&typeof GM.setValue==='function')return await GM.setValue(k,v);if(typeof GM_setValue==='function')return GM_setValue(k,v)}catch{}}
function markReady(){try{localStorage.setItem(HEARTBEAT,VERSION);localStorage.setItem('mumei-insight-bridge-at',String(Date.now()))}catch{}document.documentElement?.setAttribute('data-mumei-insight-bridge',VERSION);document.dispatchEvent(new CustomEvent('mumei-insight-bridge-ready',{detail:{version:VERSION}}))}
markReady();
if(location.origin==='https://mumei-s.github.io'){addEventListener('pageshow',markReady);addEventListener('focus',markReady);return}
if(location.origin!=='https://note.com')return;
function gmRequest(url){return new Promise((resolve,reject)=>{const o={method:'GET',url,headers:{'Cache-Control':'no-cache'},timeout:20000,onload:r=>r.status>=200&&r.status<300?resolve(String(r.responseText||'')):reject(new Error('HTTP_'+r.status)),onerror:()=>reject(new Error('NETWORK_ERROR')),ontimeout:()=>reject(new Error('TIMEOUT'))};try{if(modern()&&typeof GM.xmlHttpRequest==='function'){GM.xmlHttpRequest(o);return}if(typeof GM_xmlhttpRequest==='function'){GM_xmlhttpRequest(o);return}}catch(e){reject(e);return}reject(new Error('USERSCRIPT_REQUEST_UNAVAILABLE'))})}
async function source(name){const u=BASE+name+'?bridge='+VERSION+'&ts='+Date.now();let last=null;for(let i=0;i<2;i++){try{const s=await gmRequest(u);if(s.trim()){await setValue(CACHE+name,s);return s}}catch(e){last=e}try{const r=await fetch(u,{cache:'no-store'});if(r.ok){const s=await r.text();if(s.trim()){await setValue(CACHE+name,s);return s}}}catch(e){last=e}await sleep(180+i*220)}const cached=String(await getValue(CACHE+name,'')||'');if(cached.trim())return cached;throw last||new Error('LOAD_FAILED_'+name)}
function stripHeader(s){return String(s||'').replace(/^\s*\/\/ ==UserScript==[\s\S]*?\/\/ ==\/UserScript==\s*/,'')}
async function run(name){if(loaded.has(name))return;const s=stripHeader(await source(name));eval(s+'\n//# sourceURL='+(BASE+name));loaded.add(name)}
async function notification(){if(document.documentElement.getAttribute('data-mumei-bridge-notice')==='1')return;document.documentElement.setAttribute('data-mumei-bridge-notice','1');try{await sleep(700);const existing=String(localStorage.getItem('mumei-notification-v3-loader')||'');if(existing==='3.1.3'&&document.getElementById('mumei-v3-notification-frame'))return;await run('note-insight-notification-v3.user.js')}catch(e){document.documentElement.removeAttribute('data-mumei-bridge-notice');console.warn('[INSIGHT Bridge] notification retry',e);setTimeout(notification,1500)}}
async function dashboard(){if(document.documentElement.getAttribute('data-mumei-bridge-dash')==='1')return;const path=location.pathname.toLowerCase(),q=new URLSearchParams(location.search),direct=q.get('mumei_dashboard_sync')==='1',flow=sessionStorage.getItem('mumei-dashboard-flow-v143')==='1';if(!path.includes('/sitesettings/stats')&&!direct&&!flow)return;document.documentElement.setAttribute('data-mumei-bridge-dash','1');try{if(direct){await sleep(800);const stillDirect=new URLSearchParams(location.search).get('mumei_dashboard_sync')==='1';if(!stillDirect&&sessionStorage.getItem('mumei-dashboard-flow-v143')==='1')return}await run('note-insight-dashboard-sync-core-v1.1.0.js');await run('note-insight-dashboard-sync.user.js')}catch(e){document.documentElement.removeAttribute('data-mumei-bridge-dash');console.warn('[INSIGHT Bridge] dashboard retry',e);setTimeout(dashboard,1500)}}
notification();dashboard();
addEventListener('pageshow',()=>{markReady();notification();dashboard()});
addEventListener('focus',()=>{markReady();notification();dashboard()});
})();
