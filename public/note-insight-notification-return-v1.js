(function(){
'use strict';
if(location.hostname!=='note.com')return;
if(window.__mumeiNotificationReturnV1Loaded)return;window.__mumeiNotificationReturnV1Loaded=true;
const VERSION='1.1.0',RETURN='mumei_insight_return_bell_v1';
const modern=()=>Boolean(globalThis.GM);
const get=async(k,d)=>{try{if(modern()&&typeof GM.getValue==='function')return await GM.getValue(k,d);if(typeof GM_getValue==='function')return GM_getValue(k,d)}catch{}return d};
const set=async(k,v)=>{try{if(modern()&&typeof GM.setValue==='function')return await GM.setValue(k,v);if(typeof GM_setValue==='function')return GM_setValue(k,v)}catch{}};
const dm=()=>/^\/messages\/rooms(?:\/|$)/i.test(location.pathname);
const query=()=>new URLSearchParams(location.search);
const wants=()=>query().get('mumei_filter_return')==='bell'||query().get('mumei_fullread')==='1';
function cloak(){if(dm()||(!wants()&&location.pathname!=='/notifications'))return;document.documentElement.style.setProperty('visibility','hidden','important');document.documentElement.setAttribute('data-mumei-bell-return-cloak','1')}
function reveal(){document.documentElement.style.removeProperty('visibility');document.documentElement.removeAttribute('data-mumei-bell-return-cloak')}
function shown(el){if(!(el instanceof Element))return false;const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(el).display!=='none'&&getComputedStyle(el).visibility!=='hidden'}
const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
function exactTabsOpen(){
 const visible=[...document.querySelectorAll('button,a,[role="tab"],[role="button"],div,span')].filter(shown);
 const notices=visible.filter(el=>/^通知(?:\s*\d+)?$/u.test(clean(el.textContent)));
 const news=visible.filter(el=>/^お知らせ(?:\s*\d+)?$/u.test(clean(el.textContent)));
 if(!notices.length||!news.length)return false;
 for(const n of notices)for(const o of news){
  let p=n.parentElement,d=0;
  while(p&&p!==document.body&&d++<10){if(p.contains(o)&&shown(p))return true;p=p.parentElement}
 }
 return false
}
function openNotice(){
 try{const p=window.__mumeiNotificationReaderV4?.findPanel?.();if(p&&shown(p))return true}catch{}
 if(exactTabsOpen())return true;
 for(const root of document.querySelectorAll('[role="dialog"],[role="menu"],[popover],section,aside')){
  if(!shown(root))continue;const t=clean(root.textContent);
  if(/通知/.test(t)&&/お知らせ/.test(t))return true
 }
 return false
}
function clickBell(){
 const sel='[aria-label*="通知"],[aria-label*="お知らせ"],[title*="通知"],[title*="お知らせ"],[data-testid*="notification" i],[data-testid*="notice" i]';
 for(const el of document.querySelectorAll(sel)){const hit=el.matches('button,[role="button"]')?el:el.closest('button,[role="button"]');if(hit&&shown(hit)){hit.click();return true}}
 return false
}
cloak();
(async()=>{
 if(dm()){reveal();return}
 const stale=await get(RETURN,null);if(stale)await set(RETURN,null);
 if(location.pathname==='/notifications'){location.replace(location.origin+'/?mumei_filter_return=bell');return}
 if(!wants()){reveal();return}
 let tries=0,clicked=false,clickedAt=0;
 const finish=()=>{
  try{const u=new URL(location.href);u.searchParams.delete('mumei_filter_return');u.searchParams.delete('mumei_fullread');history.replaceState(history.state,'',u.pathname+u.search+u.hash)}catch{}
  window.__mumeiNotificationReturnDone=true;reveal();
  window.dispatchEvent(new CustomEvent('mumei-notification-return-opened',{detail:{version:VERSION}}))
 };
 const step=()=>{
  if(openNotice()){finish();return}
  if(!clicked){
   if(clickBell()){clicked=true;clickedAt=Date.now()}
  }else if(Date.now()-clickedAt>6000){reveal();return}
  if(tries++>=120){reveal();return}
  setTimeout(step,120)
 };
 step()
})();
})();