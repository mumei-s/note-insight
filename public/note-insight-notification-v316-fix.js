(function(){
'use strict';
if(location.hostname!=='note.com')return;
if(window.__mumeiNotificationV316Fix)return;window.__mumeiNotificationV316Fix=true;
const VERSION='3.1.6';
const FRAME='mumei-v3-notification-frame';
const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
const safeReturn=v=>{try{const u=new URL(String(v||''));return u.origin==='https://mumei-s.github.io'&&u.pathname.startsWith('/note-insight/')?u.href:''}catch{return''}};

// 更新確認は読込本体の完了を待たず、親Userscript起動時点でINSIGHT側へ返す。
(function immediateVersionReturn(){
  const u=new URL(location.href);
  if(u.searchParams.get('mumei_insight_version_check')!=='1')return;
  const back=safeReturn(u.searchParams.get('mumei_return'));
  u.searchParams.delete('mumei_insight_version_check');
  u.searchParams.delete('mumei_return');
  history.replaceState(history.state,'',u.pathname+(u.search?'?'+u.searchParams.toString():'')+u.hash);
  if(!back)return;
  const b=new URL(back);
  b.searchParams.set('notificationInstalled',VERSION);
  b.searchParams.set('notificationCheckedAt',String(Date.now()));
  b.searchParams.set('notificationUpdateResult','loader-checked-v316');
  location.replace(b.href);
})();

function bellMeta(el){return clean([el?.textContent,el?.getAttribute?.('aria-label'),el?.getAttribute?.('title'),el?.getAttribute?.('data-testid'),el?.getAttribute?.('href'),el?.id,el?.className].join(' '))}
function likelyBell(el){
  if(!(el instanceof Element))return false;
  const hit=el.closest('button,a,[role="button"],[role="tab"]');
  if(!hit)return false;
  const r=hit.getBoundingClientRect();if(r.top>220||r.bottom<0)return false;
  const m=bellMeta(hit);
  if(/(?:notification|notice|通知|お知らせ)/i.test(m)&&!/setting|filter/i.test(m))return true;
  return !!hit.querySelector('svg')&&[...hit.querySelectorAll('span,div')].some(x=>/^\d{1,3}$/.test(clean(x.textContent)));
}
function oneShotShow(){
  const f=document.getElementById(FRAME);
  if(!(f instanceof HTMLIFrameElement))return;
  f.dataset.mumeiDockVisible='1';
  f.style.setProperty('display','block','important');
  f.style.setProperty('visibility','visible','important');
}

// 3.1.6は表示状態を所有しない。ベル押下直後の取りこぼしだけ1回補助し、
// 以後の表示/非表示は安定版V3.1.4 + dock-watchの1系統へ任せる。
document.addEventListener('click',e=>{
  if(!likelyBell(e.target))return;
  setTimeout(oneShotShow,220);
},true);
})();
