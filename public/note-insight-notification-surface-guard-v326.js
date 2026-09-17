(function(){
'use strict';
if(location.hostname!=='note.com')return;
if(window.__mumeiNotificationSurfaceGuard326)return;window.__mumeiNotificationSurfaceGuard326=true;
const VERSION='3.2.26';
const SHELL='[data-mumei-notice-shell-v3="1"]';
const ITEM='.m-navbarNoticeItem,[class*="navbarNoticeItem" i],[class*="notificationItem" i],[class*="noticeItem" i],[data-testid*="notification-item" i],[data-testid*="notice-item" i]';
const BOUNDARY='mumei-v3-saved-boundary-v3223';
const PROGRESS='mumei-v3-reader-progress-v3223';
const DOCK='mumei-v325-dock';
const SETTINGS='mumei-v325-filter-settings';
const clean=v=>String(v||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
function visible(el){if(!(el instanceof Element))return false;const r=el.getBoundingClientRect();if(r.width<1||r.height<1||r.right<=0||r.bottom<=0||r.left>=innerWidth||r.top>=innerHeight)return false;for(let p=el,d=0;p&&d++<14;p=p.parentElement){const s=getComputedStyle(p);if(p.hidden||p.getAttribute('aria-hidden')==='true'||p.hasAttribute('inert')||s.display==='none'||s.visibility==='hidden'||Number(s.opacity||1)<=.01)return false}return true}
function text(el){return clean(el?.textContent||el?.getAttribute?.('aria-label')||el?.getAttribute?.('title')||'')}
function rowish(el){if(!visible(el))return false;const t=text(el);return t.length>=3&&t.length<=5000&&/(?:たった今|昨日|秒前|分前|時間前|日前|週間前|スキ|フォロー|コメント|返信|追加|メンバー|購入|通知)/u.test(t)}
function rows(root){if(!root?.querySelectorAll)return[];return[...root.querySelectorAll(ITEM)].filter(rowish)}
function exact(root,label){return[...(root?.querySelectorAll?.('button,a,[role="tab"],[role="button"]')||[])].find(el=>visible(el)&&text(el)===label)||null}
function notificationRoute(){return /^\/notifications(?:\/|$)/i.test(location.pathname)}
function strictSurface(){
 if(notificationRoute())for(const el of document.querySelectorAll('main,[role="main"],section,aside'))if(visible(el)&&rows(el).length)return el;
 for(const root of document.querySelectorAll('[role="dialog"],[role="menu"],[popover]')){
  if(!visible(root)||!rows(root).length)continue;
  if(exact(root,'通知')&&exact(root,'お知らせ'))return root;
 }
 return null;
}
function cleanupVisuals(){
 document.getElementById(BOUNDARY)?.remove();
 const p=document.getElementById(PROGRESS);if(p){p.style.setProperty('display','none','important');p.textContent=''}
 const d=document.getElementById(DOCK);if(d)d.style.setProperty('display','none','important');
 document.getElementById(SETTINGS)?.remove();
}
function enforce(){
 const active=strictSurface();
 for(const marked of document.querySelectorAll(SHELL))if(marked!==active)marked.removeAttribute('data-mumei-notice-shell-v3');
 if(active){active.setAttribute('data-mumei-notice-shell-v3','1');return active}
 cleanupVisuals();return null;
}
function patchReader(){
 const api=window.__mumeiV3Reader323;if(!api||typeof api.scan!=='function'||api.__surfaceGuard326)return false;
 const original=api.scan.bind(api);
 api.scan=async(...args)=>{if(!enforce())return 0;return original(...args)};
 api.readyToScan=()=>Boolean(enforce());
 api.__surfaceGuard326=true;return true;
}
let timer=0;
function schedule(){clearTimeout(timer);timer=setTimeout(()=>{patchReader();enforce()},40)}
const mo=new MutationObserver(schedule);mo.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style','hidden','aria-hidden']});
addEventListener('popstate',schedule);addEventListener('hashchange',schedule);addEventListener('pageshow',schedule);
document.addEventListener('mumei-v3-reader-status',()=>{if(!strictSurface())cleanupVisuals()});
for(const name of['pushState','replaceState']){const original=history[name];if(!original.__mumeiGuard326){const wrapped=function(...args){const r=original.apply(this,args);schedule();setTimeout(schedule,80);return r};wrapped.__mumeiGuard326=true;history[name]=wrapped}}
setInterval(()=>{patchReader();enforce()},500);
schedule();
window.__mumeiNotificationSurfaceGuard326API={version:VERSION,enforce,strictSurface,cleanup:cleanupVisuals};
})();
