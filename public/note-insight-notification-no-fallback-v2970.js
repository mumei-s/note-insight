(function(){
'use strict';
if(location.hostname!=='note.com')return;
if(window.__mumeiNotificationNoFallback2970)return;window.__mumeiNotificationNoFallback2970=true;
const FALLBACK='mumei-notice-reader-v2963',PRIMARY='mumei-v2948-frame',SHELL='[data-mumei-notice-shell-v2958="1"]',SENTINEL='data-mumei-fallback-disabled-v2970';
function visible(el){if(!(el instanceof Element))return false;const r=el.getBoundingClientRect(),w=Math.max(document.documentElement?.clientWidth||0,innerWidth||0),h=Math.max(document.documentElement?.clientHeight||0,innerHeight||0);if(r.width<1||r.height<1||r.right<=0||r.bottom<=0||r.left>=w||r.top>=h)return false;let p=el,d=0;while(p&&d++<10){if(p.hasAttribute('hidden')||p.getAttribute('aria-hidden')==='true'||p.hasAttribute('inert'))return false;const s=getComputedStyle(p);if(s.display==='none'||s.visibility==='hidden'||Number(s.opacity||1)<=.01)return false;p=p.parentElement}return true}
function notificationOpen(){if(/^\/notifications(?:\/|$)/.test(location.pathname.toLowerCase()))return true;const shell=document.querySelector(SHELL);return Boolean(shell&&visible(shell));}
function installSentinel(){let x=document.getElementById(FALLBACK);if(x?.hasAttribute?.(SENTINEL))return x;if(x)x.remove();if(!document.documentElement)return null;x=document.createElement('span');x.id=FALLBACK;x.setAttribute(SENTINEL,'1');x.setAttribute('aria-hidden','true');x.hidden=true;x.style.setProperty('display','none','important');x.style.setProperty('pointer-events','none','important');document.documentElement.appendChild(x);return x;}
function enforce(){installSentinel();const p=document.getElementById(PRIMARY);if(p&&!notificationOpen())p.style.setProperty('display','none','important');}
let timer=0;function schedule(ms=0){clearTimeout(timer);timer=setTimeout(enforce,ms)}
enforce();
new MutationObserver(()=>schedule(0)).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['style','hidden','aria-hidden']});
document.addEventListener('focusin',()=>schedule(0),true);document.addEventListener('click',()=>schedule(0),true);
window.addEventListener('pageshow',()=>schedule(0));window.addEventListener('focus',()=>schedule(0));window.addEventListener('popstate',()=>schedule(0));window.addEventListener('hashchange',()=>schedule(0));document.addEventListener('visibilitychange',()=>schedule(0));
})();
