(function(){
'use strict';
if(location.hostname!=='note.com')return;
const ROOT='mumei-v3-fixed-dock',OLD='mumei-v3-notification-launcher';
const ITEM='.m-navbarNoticeItem,[class*="navbarNoticeItem"],[class*="notificationItem" i],[class*="noticeItem" i],[data-testid*="notification-item" i],[data-testid*="notice-item" i]';
const SRC='https://mumei-s.github.io/note-insight/note-insight-notification-fixed-dock-v319.js?compat=312&ts='+Date.now();
const clean=v=>String(v||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
function visible(el){if(!(el instanceof Element))return false;const r=el.getBoundingClientRect();if(r.width<1||r.height<1||r.bottom<=0||r.right<=0)return false;const s=getComputedStyle(el);return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity||1)>.01}
function notificationSurface(root){if(!(root instanceof Element)||!visible(root))return false;if(root.matches?.(ITEM)||root.querySelector?.(ITEM))return true;const t=clean(root.textContent);if(!t||t.length>9000)return false;return /(?:たった今|昨日|\d+\s*(?:秒|分|時間|日|週|か月|ヶ月|月|年)前)/u.test(t)&&/(?:スキ|コメント|返信|フォロー|マガジン|メンバーシップ|掲示板|購入|サポート|通知|お知らせ)/u.test(t)}
function notificationOpen(){if(document.visibilityState==='hidden')return false;if(/^\/notifications(?:\/|$)/i.test(location.pathname))return true;for(const el of document.querySelectorAll(ITEM))if(visible(el))return true;for(const el of document.querySelectorAll('[role="dialog"],[role="menu"],[popover],.m-navbarNotice,[class*="notification" i],[class*="notice" i]'))if(notificationSurface(el))return true;return false}
function applyVisibility(){const r=document.getElementById(ROOT);if(!(r instanceof HTMLElement))return false;const show=notificationOpen();r.style.setProperty('display',show?'block':'none','important');r.style.setProperty('visibility',show?'visible':'hidden','important');r.style.setProperty('pointer-events',show?'auto':'none','important');return true}
function installVisibilityGuard(){if(window.__mumeiNotificationVisibilityGuard312){applyVisibility();return}window.__mumeiNotificationVisibilityGuard312=true;const run=()=>applyVisibility();new MutationObserver(()=>run()).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class','hidden','aria-hidden','open','style']});document.addEventListener('click',()=>setTimeout(run,80),true);addEventListener('pageshow',()=>setTimeout(run,80));addEventListener('focus',()=>setTimeout(run,80));document.addEventListener('visibilitychange',run);setInterval(run,450);run()}
installVisibilityGuard();
// V3.1.9 already owns the fixed dock. In that case this live-loaded file only controls visibility.
if(window.__mumeiNotificationFixedDock319){applyVisibility();return}
if(window.__mumeiNotificationDockWatchV312)return;window.__mumeiNotificationDockWatchV312=true;
window.__mumeiNotificationDockControllerReady=true;
window.__mumeiNotificationCompactDock=true;
window.__mumeiNotificationLauncherV317=true;
function removeOld(){document.getElementById(OLD)?.remove()}
function run(code){if(window.__mumeiNotificationFixedDock319){applyVisibility();return}const src=String(code||'');if(!src.includes('__mumeiNotificationFixedDock319'))throw new Error('FIXED_DOCK_INVALID');(0,eval)(src+'\n//# sourceURL='+SRC);setTimeout(applyVisibility,0)}
function gm(){return new Promise((resolve,reject)=>{const o={method:'GET',url:SRC,headers:{'Cache-Control':'no-cache'},timeout:16000,onload:r=>r.status>=200&&r.status<300?resolve(String(r.responseText||'')):reject(new Error('HTTP_'+r.status)),onerror:()=>reject(new Error('NETWORK_ERROR')),ontimeout:()=>reject(new Error('TIMEOUT'))};try{if(globalThis.GM&&typeof GM.xmlHttpRequest==='function'){GM.xmlHttpRequest(o);return}if(typeof GM_xmlhttpRequest==='function'){GM_xmlhttpRequest(o);return}}catch(e){reject(e);return}reject(new Error('GM_REQUEST_UNAVAILABLE'))})}
async function fetchFixed(){let last=null;for(let i=0;i<2;i++){try{return await gm()}catch(e){last=e}try{const r=await fetch(SRC,{cache:'no-store'});if(r.ok)return await r.text();last=new Error('FETCH_'+r.status)}catch(e){last=e}await new Promise(r=>setTimeout(r,180+i*260))}throw last||new Error('FIXED_DOCK_UNAVAILABLE')}
async function boot(){removeOld();const mo=new MutationObserver(()=>{removeOld();applyVisibility()});mo.observe(document.documentElement,{subtree:true,childList:true});try{run(await fetchFixed());removeOld();applyVisibility()}catch(e){console.warn('[INSIGHT通知] 4列固定パネル hotfix retry',e);setTimeout(async()=>{try{run(await fetchFixed());removeOld();applyVisibility()}catch(err){console.warn('[INSIGHT通知] 4列固定パネル hotfix failed',err)}},1800)}}
if(document.documentElement)void boot();else document.addEventListener('DOMContentLoaded',()=>void boot(),{once:true});
})();