(function(){
'use strict';
if(location.hostname!=='note.com')return;
if(window.__mumeiNotificationLauncherV317Compat)return;window.__mumeiNotificationLauncherV317Compat=true;
window.__mumeiNotificationLauncherV317=true;
const OLD='mumei-v3-notification-launcher';
const SRC='https://mumei-s.github.io/note-insight/note-insight-notification-fixed-dock-v319.js?from=v317&ts='+Date.now();
function removeOld(){document.getElementById(OLD)?.remove()}
function run(code){if(window.__mumeiNotificationFixedDock319)return;const src=String(code||'');if(!src.includes('__mumeiNotificationFixedDock319'))throw new Error('FIXED_DOCK_INVALID');(0,eval)(src+'\n//# sourceURL='+SRC)}
function gm(){return new Promise((resolve,reject)=>{const o={method:'GET',url:SRC,headers:{'Cache-Control':'no-cache'},timeout:16000,onload:r=>r.status>=200&&r.status<300?resolve(String(r.responseText||'')):reject(new Error('HTTP_'+r.status)),onerror:()=>reject(new Error('NETWORK_ERROR')),ontimeout:()=>reject(new Error('TIMEOUT'))};try{if(globalThis.GM&&typeof GM.xmlHttpRequest==='function'){GM.xmlHttpRequest(o);return}if(typeof GM_xmlhttpRequest==='function'){GM_xmlhttpRequest(o);return}}catch(e){reject(e);return}reject(new Error('GM_REQUEST_UNAVAILABLE'))})}
async function fetchFixed(){let last=null;for(let i=0;i<2;i++){try{return await gm()}catch(e){last=e}try{const r=await fetch(SRC,{cache:'no-store'});if(r.ok)return await r.text();last=new Error('FETCH_'+r.status)}catch(e){last=e}await new Promise(r=>setTimeout(r,180+i*260))}throw last||new Error('FIXED_DOCK_UNAVAILABLE')}
async function boot(){removeOld();new MutationObserver(()=>removeOld()).observe(document.documentElement,{subtree:true,childList:true});try{run(await fetchFixed());removeOld()}catch(e){console.warn('[INSIGHT通知] legacy launcher compatibility retry',e);setTimeout(async()=>{try{run(await fetchFixed());removeOld()}catch(err){console.warn('[INSIGHT通知] legacy launcher compatibility failed',err)}},1800)}}
if(document.documentElement)void boot();else document.addEventListener('DOMContentLoaded',()=>void boot(),{once:true});
})();
