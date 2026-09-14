(function(){
'use strict';
if(location.hostname!=='note.com')return;
if(window.__mumeiNotificationDockWatchV312)return;window.__mumeiNotificationDockWatchV312=true;
window.__mumeiNotificationDockControllerReady=true;
const FRAME='mumei-v3-notification-frame',LEGACY_LAUNCHER='mumei-v3-notification-launcher';
const ITEM='.m-navbarNoticeItem,[class*="navbarNoticeItem"],[class*="notificationItem" i],[class*="noticeItem" i],[data-testid*="notification-item" i],[data-testid*="notice-item" i]';
const clean=v=>String(v||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
let primary=null,autoStarted=false,resetTimer=0,styleObserver=null;
const HTML=`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent;font-family:system-ui,-apple-system,sans-serif}.dock{height:48px;padding:3px;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));grid-template-rows:25px 15px;gap:2px;border:1px solid #355063;border-radius:10px;background:#0e1c26;box-shadow:0 -4px 14px rgba(0,0,0,.34)}button{display:flex;align-items:center;justify-content:center;text-align:center;min-width:0;height:25px;margin:0;padding:0 4px;border:1px solid #42667b;border-radius:6px;background:#102737;color:#e3f8ff;font:900 8px/1 system-ui;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.on{background:#17422f;border-color:#56a77b}.ins{border-color:#55d8f1;background:#11374a}.health{grid-column:1/-1;height:15px;display:flex;align-items:center;justify-content:center;padding:0 4px;border:1px solid #355063;border-radius:5px;background:#091923;color:#c5d8e5;font:850 7px/1 system-ui;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.saving{color:#fff0a7}.error{color:#ffd2d7}.done{color:#c8ffda}</style><div class="dock"><button id="read">下から読込</button><button id="filter">フィルターOFF</button><button id="settings">フィルター設定</button><button id="ins" class="ins">INSIGHT【通知】</button><div id="health" class="health">🔔 本人通知パネル準備済み</div></div>`;
function removeLauncher(){document.getElementById(LEGACY_LAUNCHER)?.remove()}
function makeVisible(f){
  if(!(f instanceof HTMLIFrameElement))return;
  f.dataset.mumeiDockVisible='1';
  f.style.setProperty('position','fixed','important');
  f.style.setProperty('left','6px','important');
  f.style.setProperty('right','6px','important');
  f.style.setProperty('bottom','max(8px,env(safe-area-inset-bottom,0px))','important');
  f.style.setProperty('width','calc(100% - 12px)','important');
  f.style.setProperty('height','48px','important');
  f.style.setProperty('border','0','important');
  f.style.setProperty('border-radius','10px','important');
  f.style.setProperty('z-index','2147483647','important');
  f.style.setProperty('background','transparent','important');
  f.style.setProperty('display','block','important');
  f.style.setProperty('visibility','visible','important');
  f.style.setProperty('pointer-events','auto','important');
  f.removeAttribute('hidden');f.setAttribute('aria-hidden','false');
}
function ensureDock(){
  removeLauncher();
  let f=document.getElementById(FRAME);
  if(!(f instanceof HTMLIFrameElement)){
    f=document.createElement('iframe');f.id=FRAME;f.title='INSIGHT 本人通知';f.srcdoc=HTML;
    (document.body||document.documentElement).appendChild(f);
  }
  primary=f;makeVisible(f);
  if(f.dataset.mumeiAlwaysVisible!=='1'){
    f.dataset.mumeiAlwaysVisible='1';
    styleObserver?.disconnect();
    styleObserver=new MutationObserver(()=>{
      if(!f.isConnected)return;
      if(f.style.getPropertyValue('display')!=='block'||f.style.getPropertyValue('visibility')!=='visible'||f.hidden||f.getAttribute('aria-hidden')==='true')makeVisible(f)
    });
    styleObserver.observe(f,{attributes:true,attributeFilter:['style','hidden','aria-hidden']});
  }
  return f
}
function frame(){return primary?.isConnected?primary:ensureDock()}
function dockVisible(){return true}
function forceDock(msg='🔔 本人通知パネル準備済み'){
  const f=ensureDock();
  try{const h=f.contentDocument?.getElementById('health');if(h&&!h.dataset.readerStatus&&msg)h.textContent=msg}catch{}
  return f
}
function visible(el){if(!(el instanceof Element))return false;const r=el.getBoundingClientRect();if(r.width<1||r.height<1||r.bottom<=0||r.right<=0)return false;const s=getComputedStyle(el);return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity||1)>0.01}
function notificationSurface(root){
  if(!(root instanceof Element)||!visible(root))return false;
  if(root.matches?.(ITEM)||root.querySelector?.(ITEM))return true;
  const t=clean(root.textContent);if(!t||t.length>9000)return false;
  return /(?:たった今|昨日|\d+\s*(?:秒|分|時間|日|週|か月|ヶ月|月|年)前)/u.test(t)&&/(?:スキ|コメント|返信|フォロー|マガジン|メンバーシップ|掲示板|購入|サポート|通知|お知らせ)/u.test(t)
}
function anySurface(){
  for(const el of document.querySelectorAll(ITEM))if(visible(el))return true;
  for(const el of document.querySelectorAll('[role="dialog"],[role="menu"],[popover],.m-navbarNotice,[class*="notification" i],[class*="notice" i]'))if(notificationSurface(el))return true;
  return false
}
function tryAutoStart(){
  if(autoStarted||!anySurface())return false;const f=frame();
  try{
    const d=f.contentDocument,read=d?.getElementById('read'),health=d?.getElementById('health');
    if(!d||d.documentElement.dataset.mumeiReader2963!=='1'||!read)return false;
    const label=clean(read.textContent);if(!/下から読込/.test(label)||read.dataset.repair==='1')return false;
    autoStarted=true;
    if(health){health.dataset.readerStatus='1';health.textContent='🔄 自動で下から読込を開始します…';health.className='health saving'}
    setTimeout(()=>{if(anySurface()&&read.isConnected&&/下から読込/.test(clean(read.textContent)))read.click()},180);
    return true
  }catch{return false}
}
function maybeReset(){clearTimeout(resetTimer);resetTimer=setTimeout(()=>{if(!anySurface())autoStarted=false},400)}
function inspect(){removeLauncher();forceDock();if(anySurface())tryAutoStart();else maybeReset()}
function fallbackLinks(){
  const f=frame();const bind=()=>{try{
    const d=f.contentDocument;if(!d||d.documentElement.dataset.mumeiFallbackLinks==='1'||f.dataset.bound==='1')return;
    d.documentElement.dataset.mumeiFallbackLinks='1';
    d.getElementById('settings')?.addEventListener('click',()=>location.assign('https://mumei-s.github.io/note-insight/notification-filter.html?from=note'));
    d.getElementById('ins')?.addEventListener('click',()=>location.assign('https://mumei-s.github.io/note-insight/notification-entry.html?from=note&insightMode=notifications#dashboard'))
  }catch{}};
  f.addEventListener('load',()=>setTimeout(bind,40),{once:true});setTimeout(bind,1200)
}
function boot(){removeLauncher();forceDock();fallbackLinks();inspect();
  new MutationObserver(ms=>{let relevant=false;for(const m of ms){for(const n of m.addedNodes){if(!(n instanceof Element))continue;if(n.id===LEGACY_LAUNCHER){n.remove();continue}if(n.matches?.(ITEM)||n.querySelector?.(ITEM)||n.matches?.('[role="dialog"],[role="menu"],[popover],[class*="notification" i],[class*="notice" i]')){relevant=true;break}}if(relevant)break}removeLauncher();if(relevant||anySurface())inspect();else maybeReset()}).observe(document.documentElement,{subtree:true,childList:true});
  document.addEventListener('click',()=>setTimeout(inspect,80),true);
  addEventListener('pageshow',()=>setTimeout(inspect,80));
  addEventListener('focus',()=>setTimeout(inspect,80));
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')setTimeout(inspect,80)})
}
if(document.body)boot();else document.addEventListener('DOMContentLoaded',boot,{once:true});
})();