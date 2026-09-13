(function(){
'use strict';
if(window.__mumeiNotificationFilterSafety2961)return;window.__mumeiNotificationFilterSafety2961=true;
const HIDE='mumei-v2958-hide',FRAME='mumei-v2948-frame',SHELL='[data-mumei-notice-shell-v2958="1"]',SHIELD='data-mumei-input-shield-hidden';
const ITEM='.m-navbarNoticeItem,[class*="navbarNoticeItem"],[class*="notificationItem" i],[class*="noticeItem" i],[data-testid*="notification-item" i],[data-testid*="notice-item" i]';
const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
function viewportSize(){return{w:Math.max(document.documentElement?.clientWidth||0,window.innerWidth||0),h:Math.max(document.documentElement?.clientHeight||0,window.innerHeight||0)}}
function shown(el){if(!(el instanceof Element))return false;const r=el.getBoundingClientRect(),vp=viewportSize();if(r.width<1||r.height<1||r.right<=0||r.bottom<=0||r.left>=vp.w||r.top>=vp.h)return false;let p=el,d=0;while(p&&d++<14){if(p.hasAttribute('hidden')||p.getAttribute('aria-hidden')==='true'||p.hasAttribute('inert'))return false;const s=getComputedStyle(p);if(s.display==='none'||s.visibility==='hidden'||Number(s.opacity||1)<=0.01)return false;p=p.parentElement}return true}
function tabLike(el){let n=0,notice=false,news=false;for(const x of el.querySelectorAll('button,a,[role="tab"],[role="button"]')){if(n++>80)break;if(!shown(x))continue;const t=clean(x.textContent||x.getAttribute('aria-label')||x.getAttribute('title'));if(/^通知(?:\s*\d+)?$/u.test(t))notice=true;if(/^お知らせ(?:\s*\d+)?$/u.test(t))news=true;if(notice&&news)return true}return false}
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
function notificationRoute(){return /^\/notifications(?:\/|$)/.test(location.pathname.toLowerCase())}
function editableTarget(el){if(!(el instanceof Element))return false;if(el.matches('textarea,[contenteditable="true"],[contenteditable=""],[role="textbox"],.ProseMirror,[data-lexical-editor="true"]'))return true;if(el.matches('input')&&!/^(?:button|submit|reset|checkbox|radio|range|color|file|image|hidden)$/i.test(el.getAttribute('type')||'text'))return true;return!!el.closest('textarea,[contenteditable="true"],[contenteditable=""],[role="textbox"],.ProseMirror,[data-lexical-editor="true"]')}
function activeEditing(){return editableTarget(document.activeElement)}
function strictNoticeContext(){if(notificationRoute())return true;const marked=document.querySelector(SHELL);if(marked&&shown(marked)&&tabLike(marked))return true;let n=0;for(const el of document.querySelectorAll('[role="dialog"],[role="menu"],[popover],[class*="notification" i],[class*="notice" i]')){if(n++>80)break;if(shown(el)&&tabLike(el))return true}return false}
function looksLikeInsightDock(f){try{const title=clean(f.title||''),d=f.contentDocument,body=clean(d?.body?.textContent||'');return(/INSIGHT.*通知/u.test(title)||/INSIGHT【通知】/u.test(body))&&/前回の続きから読込/u.test(body)}catch{return false}}
function dockNodes(){const out=[...document.querySelectorAll(`#${FRAME}`)];for(const f of document.querySelectorAll('iframe')){if(out.includes(f))continue;if(looksLikeInsightDock(f))out.push(f)}return out}
function hideDock(el){if(!(el instanceof HTMLElement))return;if(el.style.getPropertyValue('display')!=='none'||el.style.getPropertyPriority('display')!=='important')el.style.setProperty('display','none','important');if(el.style.getPropertyValue('pointer-events')!=='none'||el.style.getPropertyPriority('pointer-events')!=='important')el.style.setProperty('pointer-events','none','important');if(el.style.getPropertyValue('visibility')!=='hidden'||el.style.getPropertyPriority('visibility')!=='important')el.style.setProperty('visibility','hidden','important');el.setAttribute(SHIELD,'1')}
function releaseDock(el){if(!(el instanceof HTMLElement)||el.getAttribute(SHIELD)!=='1')return;el.removeAttribute(SHIELD);if(el.style.getPropertyValue('display')==='none'&&el.style.getPropertyPriority('display')==='important')el.style.removeProperty('display');if(el.style.getPropertyValue('pointer-events')==='none'&&el.style.getPropertyPriority('pointer-events')==='important')el.style.removeProperty('pointer-events');if(el.style.getPropertyValue('visibility')==='hidden'&&el.style.getPropertyPriority('visibility')==='important')el.style.removeProperty('visibility')}
function guardNotificationDock(forceTyping=false){const block=forceTyping||activeEditing()||!strictNoticeContext();for(const el of dockNodes()){if(block)hideDock(el);else releaseDock(el)}return block}
function repair(root=document){
  const blocked=guardNotificationDock(false);
  const hidden=[...root.querySelectorAll(`.${HIDE}`)];
  let restored=0;
  for(const el of hidden){if(unsafeContainer(el)){el.classList.remove(HIDE);el.setAttribute('data-mumei-filter-container-restored','1');restored++}}
  const f=document.getElementById(FRAME),health=f?.contentDocument?.getElementById('health');
  if(restored&&health&&!blocked){health.textContent=`フィルター安全補正 ✓ 親コンテナ ${restored}件を復元`;health.className='health done'}
}
let timer=0;function schedule(ms=30){clearTimeout(timer);timer=setTimeout(()=>repair(document),ms)}
const mo=new MutationObserver(muts=>{for(const m of muts){if(m.type==='attributes'){const t=m.target;if(t instanceof HTMLElement&&(t.id===FRAME||t.getAttribute(SHIELD)==='1'||t.classList.contains(HIDE)||t.tagName==='IFRAME')){schedule(0);return}}if(m.type==='childList'){for(const x of m.addedNodes){if(!(x instanceof Element))continue;if(x.id===FRAME||x.tagName==='IFRAME'||x.querySelector?.(`#${FRAME},iframe`)){schedule(0);return}}schedule();return}}});
function bind(){repair(document);mo.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style','hidden','aria-hidden','inert']})}
document.addEventListener('focusin',e=>{if(editableTarget(e.target)){guardNotificationDock(true);schedule(0)}},true);
document.addEventListener('pointerdown',e=>{if(editableTarget(e.target)){guardNotificationDock(true);schedule(0)}},true);
document.addEventListener('click',e=>{if(editableTarget(e.target)){guardNotificationDock(true);schedule(0)}else schedule(40)},true);
document.addEventListener('focusout',()=>schedule(80),true);
if(window.visualViewport){visualViewport.addEventListener('resize',()=>{if(activeEditing())guardNotificationDock(true);else schedule(20)})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
window.addEventListener('pageshow',()=>schedule(0));window.addEventListener('focus',()=>schedule(0));window.addEventListener('popstate',()=>schedule(0));window.addEventListener('hashchange',()=>schedule(0));window.addEventListener('pagehide',()=>{for(const el of dockNodes())hideDock(el)});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'){for(const el of dockNodes())hideDock(el)}else schedule(0)});
})();