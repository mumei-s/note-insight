(function(){
'use strict';
if(location.hostname!=='note.com')return;
if(window.__mumeiNotificationDockWatchV312)return;window.__mumeiNotificationDockWatchV312=true;
const FRAME='mumei-v3-notification-frame';
const ITEM='.m-navbarNoticeItem,[class*="navbarNoticeItem"],[class*="notificationItem" i],[class*="noticeItem" i],[data-testid*="notification-item" i],[data-testid*="notice-item" i]';
const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
let intentUntil=0,timer=0,autoStarted=false,resetTimer=0;
function frame(){return document.getElementById(FRAME)}
function wakeRuntime(){
  const probe=document.createElement('button');probe.type='button';probe.setAttribute('aria-label','notification');probe.setAttribute('data-mumei-v3-wakeup','1');probe.style.cssText='position:fixed;left:0;top:0;width:1px;height:1px;opacity:.001;pointer-events:none;z-index:-1';document.documentElement.append(probe);probe.dispatchEvent(new MouseEvent('click',{bubbles:true,composed:true}));probe.remove()
}
function forceDock(msg='通知一覧を確認中…'){
  wakeRuntime();
  const f=frame();if(f){f.style.setProperty('display','block','important');f.style.setProperty('visibility','visible','important');f.style.removeProperty('width');f.style.removeProperty('height');f.style.removeProperty('max-width');f.style.removeProperty('max-height');try{const h=f.contentDocument?.getElementById('health');if(h&&!h.dataset.readerStatus)h.textContent=msg}catch{}}
}
function meta(el){return clean([el?.getAttribute?.('aria-label'),el?.getAttribute?.('title'),el?.getAttribute?.('data-testid'),el?.id,el?.className].join(' '))}
function likelyBell(el){if(!(el instanceof Element))return false;const hit=el.closest('button,a,[role="button"],[role="tab"]');if(!hit)return false;const r=hit.getBoundingClientRect();if(r.top>190||r.bottom<0)return false;const m=meta(hit),t=clean(hit.textContent);if(/(?:notification|notice|通知|お知らせ)/i.test(m+' '+t)&&!/setting|filter/i.test(m))return true;const badge=[...hit.querySelectorAll('span,div')].some(x=>/^\d{1,3}$/.test(clean(x.textContent))&&x.getBoundingClientRect().width<50);return badge&&!!hit.querySelector('svg')
}
function notificationSurface(root){if(!(root instanceof Element))return false;if(root.matches?.(ITEM)||root.querySelector?.(ITEM))return true;const txt=clean(root.textContent);if(txt.length>9000)return false;if(/通知/.test(txt)&&/お知らせ/.test(txt))return true;if(/(?:たった今|\d+\s*(?:分|時間|日)前)/u.test(txt)&&/(?:スキ|コメント|フォロー|マガジン|メンバーシップ|返信)/u.test(txt))return true;return false}
function anySurface(){if(document.querySelector(ITEM))return true;for(const el of document.querySelectorAll('[role="dialog"],[role="menu"],[popover],.m-navbarNotice,[class*="notification" i],[class*="notice" i]'))if(notificationSurface(el))return true;return false}
function tryAutoStart(){
  if(autoStarted||!anySurface())return false;
  const f=frame();if(!f)return false;
  try{
    const d=f.contentDocument,read=d?.getElementById('read'),health=d?.getElementById('health');
    if(!d||d.documentElement.dataset.mumeiReader2963!=='1'||!read)return false;
    const label=clean(read.textContent);
    if(!/下から読込/.test(label)||read.dataset.repair==='1')return false;
    autoStarted=true;
    if(health){health.dataset.readerStatus='1';health.textContent='🔄 自動で下から読込を開始します…';health.className='health saving'}
    setTimeout(()=>{if(anySurface()&&read.isConnected&&/下から読込/.test(clean(read.textContent)))read.click()},180);
    return true
  }catch{return false}
}
function maybeResetAuto(){clearTimeout(resetTimer);resetTimer=setTimeout(()=>{if(!anySurface())autoStarted=false},450)}
function pulse(){if(Date.now()>intentUntil)return;forceDock();tryAutoStart();clearTimeout(timer);timer=setTimeout(pulse,180)}
function arm(ms=6000,msg='通知一覧を確認中…'){intentUntil=Date.now()+ms;forceDock(msg);tryAutoStart();clearTimeout(timer);timer=setTimeout(pulse,120)}
document.addEventListener('click',e=>{if(likelyBell(e.target)){autoStarted=false;arm(6000,'🔔を検出しました。自動読込を準備中…')}},true);
new MutationObserver(ms=>{let hit=false;for(const m of ms)for(const n of m.addedNodes){if(!(n instanceof Element))continue;if(notificationSurface(n)){hit=true;break}}if(hit)arm();else{if(anySurface()){forceDock();tryAutoStart()}else maybeResetAuto()}}).observe(document.documentElement,{subtree:true,childList:true});
addEventListener('pageshow',()=>{if(anySurface()){autoStarted=false;arm(3500)}});
addEventListener('focus',()=>{if(anySurface())arm(2500)});
setTimeout(()=>{if(anySurface()){autoStarted=false;arm(5000)}},120);
setTimeout(()=>{if(anySurface())arm(5000)},650);
})();
