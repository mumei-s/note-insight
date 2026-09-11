(function(){
'use strict';
if(window.__mumeiNotificationFilterSafety2961)return;window.__mumeiNotificationFilterSafety2961=true;
const HIDE='mumei-v2958-hide',FRAME='mumei-v2948-frame';
const ITEM='.m-navbarNoticeItem,[class*="navbarNoticeItem"],[class*="notificationItem" i],[class*="noticeItem" i],[data-testid*="notification-item" i],[data-testid*="notice-item" i]';
const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
function tabLike(el){let n=0,notice=false,news=false;for(const x of el.querySelectorAll('button,a,[role="tab"],[role="button"]')){if(n++>80)break;const t=clean(x.textContent||x.getAttribute('aria-label')||x.getAttribute('title'));if(/^通知(?:\s*\d+)?$/u.test(t))notice=true;if(/^お知らせ(?:\s*\d+)?$/u.test(t))news=true;if(notice&&news)return true}return false}
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
  const hidden=[...root.querySelectorAll(`.${HIDE}`)];
  let restored=0;
  for(const el of hidden){if(unsafeContainer(el)){el.classList.remove(HIDE);el.setAttribute('data-mumei-filter-container-restored','1');restored++}}
  const f=document.getElementById(FRAME),health=f?.contentDocument?.getElementById('health');
  if(restored&&health){health.textContent=`フィルター安全補正 ✓ 親コンテナ ${restored}件を復元`;health.className='health done'}
}
let timer=0;function schedule(ms=30){clearTimeout(timer);timer=setTimeout(()=>repair(document),ms)}
const mo=new MutationObserver(muts=>{for(const m of muts){if(m.type==='attributes'&&m.target instanceof HTMLElement&&m.target.classList.contains(HIDE)){schedule(0);return}if(m.type==='childList'){schedule();return}}});
function bind(){repair(document);mo.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class']})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
window.addEventListener('pageshow',()=>schedule(0));window.addEventListener('focus',()=>schedule(0));
})();