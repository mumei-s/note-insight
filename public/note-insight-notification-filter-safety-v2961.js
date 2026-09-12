(function(){
'use strict';
if(window.__mumeiNotificationFilterSafety2961)return;window.__mumeiNotificationFilterSafety2961=true;
const HIDE='mumei-v2958-hide',FRAME='mumei-v2948-frame',READER='mumei-notice-reader-v2963',SHELL='[data-mumei-notice-shell-v2958="1"]';
const ITEM='.m-navbarNoticeItem,[class*="navbarNoticeItem"],[class*="notificationItem" i],[class*="noticeItem" i],[data-testid*="notification-item" i],[data-testid*="notice-item" i]';
const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
function shown(el){if(!(el instanceof Element))return false;const r=el.getBoundingClientRect(),w=Math.max(document.documentElement?.clientWidth||0,innerWidth||0),h=Math.max(document.documentElement?.clientHeight||0,innerHeight||0);if(r.width<1||r.height<1||r.right<=0||r.bottom<=0||r.left>=w||r.top>=h)return false;let p=el,d=0;while(p&&d++<10){if(p.hasAttribute('hidden')||p.getAttribute('aria-hidden')==='true'||p.hasAttribute('inert'))return false;const s=getComputedStyle(p);if(s.display==='none'||s.visibility==='hidden'||Number(s.opacity||1)<=.01)return false;p=p.parentElement}return true}
function tabLike(el){let n=0,notice=false,news=false;for(const x of el.querySelectorAll('button,a,[role="tab"],[role="button"]')){if(n++>80)break;if(!shown(x))continue;const t=clean(x.textContent||x.getAttribute('aria-label')||x.getAttribute('title'));if(/^通知(?:\s*\d+)?$/u.test(t))notice=true;if(/^お知らせ(?:\s*\d+)?$/u.test(t))news=true;if(notice&&news)return true}return false}
function editableTarget(el){if(!(el instanceof Element))return false;return Boolean(el.closest('input,textarea,select,[contenteditable="true"],[contenteditable=""],[role="textbox"],.ProseMirror'))}
function readerAllowed(){if(/^\/notifications(?:\/|$)/.test(location.pathname.toLowerCase()))return true;const marked=document.querySelector(SHELL);if(marked&&shown(marked)&&tabLike(marked))return true;for(const c of document.querySelectorAll('[role="dialog"],[role="menu"],[popover],[class*="notification" i],[class*="notice" i]')){if(shown(c)&&tabLike(c))return true}return false}
function guardReaderFallback(target=document.activeElement){const fallback=document.getElementById(READER),typing=editableTarget(target);if(fallback&&(typing||!readerAllowed()))fallback.remove();if(typing&&!readerAllowed()){const primary=document.getElementById(FRAME);if(primary)primary.style.setProperty('display','none','important')}}
function distinctNotificationDescendants(el){const xs=[...el.querySelectorAll(ITEM)].filter(x=>x!==el);const roots=[];for(const x of xs){if(roots.some(r=>r.contains(x)))continue;for(let i=roots.length-1;i>=0;i--)if(x.contains(roots[i]))roots.splice(i,1);roots.push(x);if(roots.length>1)return roots.length}return roots.length}
function unsafeContainer(el){
  if(!(el instanceof HTMLElement))return true;
  if(el.id===FRAME||el.closest(`#${FRAME}`))return true;
  if(el.hasAttribute('data-mumei-notice-shell-v2958'))return true;
  if(tabLike(el))return true;
  if(el.querySelectorAll('time,[datetime]').length>1)return true;
  if(distinctNotificationDescendants(el)>1)return true;
  const t=clean(el.textContent);
  if(t.length>900)return true;
  return false;
}
function repair(root=document){
  guardReaderFallback();
  const hidden=[...root.querySelectorAll(`.${HIDE}`)];
  let restored=0;
  for(const el of hidden){if(unsafeContainer(el)){el.classList.remove(HIDE);el.setAttribute('data-mumei-filter-container-restored','1');restored++}}
  const f=document.getElementById(FRAME),health=f?.contentDocument?.getElementById('health');
  if(restored&&health){health.textContent=`フィルター安全補正 ✓ 親コンテナ ${restored}件を復元`;health.className='health done'}
  guardReaderFallback();
}
let timer=0;function schedule(ms=30){clearTimeout(timer);timer=setTimeout(()=>repair(document),ms)}
const mo=new MutationObserver(muts=>{for(const m of muts){if(m.type==='attributes'&&m.target instanceof HTMLElement&&m.target.classList.contains(HIDE)){schedule(0);return}if(m.type==='childList'){schedule();return}}});
function bind(){repair(document);mo.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class']})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
document.addEventListener('focusin',e=>{if(editableTarget(e.target)){guardReaderFallback(e.target);schedule(0)}},true);
document.addEventListener('click',e=>{if(editableTarget(e.target))guardReaderFallback(e.target)},true);
window.addEventListener('pageshow',()=>schedule(0));window.addEventListener('focus',()=>schedule(0));window.addEventListener('pagehide',()=>document.getElementById(READER)?.remove());window.addEventListener('popstate',()=>schedule(0));window.addEventListener('hashchange',()=>schedule(0));document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')document.getElementById(READER)?.remove();else schedule(0)});
})();