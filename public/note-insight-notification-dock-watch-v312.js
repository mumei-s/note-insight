(function(){
'use strict';
if(location.hostname!=='note.com')return;
if(window.__mumeiNotificationDockWatchV312)return;window.__mumeiNotificationDockWatchV312=true;
const FRAME='mumei-v3-notification-frame';
const ITEM='.m-navbarNoticeItem,[class*="navbarNoticeItem"],[class*="notificationItem" i],[class*="noticeItem" i],[data-testid*="notification-item" i],[data-testid*="notice-item" i]';
const clean=v=>String(v||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
let primary=null,autoStarted=false,startTimers=[],manualVisible=false;
const HTML=`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent;font-family:system-ui,-apple-system,sans-serif}.dock{height:48px;padding:3px;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));grid-template-rows:25px 15px;gap:2px;border:1px solid #355063;border-radius:10px;background:#0e1c26;box-shadow:0 -4px 14px rgba(0,0,0,.34)}button{display:flex;align-items:center;justify-content:center;text-align:center;min-width:0;height:25px;margin:0;padding:0 4px;border:1px solid #42667b;border-radius:6px;background:#102737;color:#e3f8ff;font:900 8px/1 system-ui;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.on{background:#17422f;border-color:#56a77b}.ins{border-color:#55d8f1;background:#11374a}.health{grid-column:1/-1;height:15px;display:flex;align-items:center;justify-content:center;padding:0 4px;border:1px solid #355063;border-radius:5px;background:#091923;color:#c5d8e5;font:850 7px/1 system-ui;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.saving{color:#fff0a7}.error{color:#ffd2d7}.done{color:#c8ffda}</style><div class="dock"><button id="read">下から読込</button><button id="filter">フィルターOFF</button><button id="settings">フィルター設定</button><button id="ins" class="ins">INSIGHT【通知】</button><div id="health" class="health">通知一覧を確認中…</div></div>`;
function ensureDock(){
  let f=document.getElementById(FRAME);
  if(f instanceof HTMLIFrameElement){primary=f;return f}
  f=document.createElement('iframe');f.id=FRAME;f.title='INSIGHT 本人通知';f.srcdoc=HTML;
  f.style.cssText='position:fixed!important;left:6px!important;right:6px!important;bottom:max(8px,env(safe-area-inset-bottom,0px))!important;width:calc(100% - 12px)!important;height:48px!important;border:0!important;border-radius:10px!important;z-index:2147483647!important;background:transparent!important;display:none!important;visibility:visible!important;pointer-events:auto!important';
  f.dataset.mumeiDockVisible='0';(document.body||document.documentElement).appendChild(f);primary=f;return f
}
function frame(){return primary?.isConnected?primary:ensureDock()}
function showDock(msg='通知一覧を確認中…'){
  const f=ensureDock();
  if(f.dataset.mumeiDockVisible!=='1'){
    f.dataset.mumeiDockVisible='1';
    f.style.setProperty('display','block','important');
    f.style.setProperty('visibility','visible','important');
    f.style.setProperty('width','calc(100% - 12px)','important');
    f.style.setProperty('height','48px','important');
  }
  try{const h=f.contentDocument?.getElementById('health');if(h&&!h.dataset.readerStatus&&msg)h.textContent=msg}catch{}
  return f
}
function hideDock(){
  const f=primary?.isConnected?primary:null;if(!f)return;
  f.dataset.mumeiDockVisible='0';f.style.setProperty('display','none','important')
}
function meta(el){return clean([el?.getAttribute?.('aria-label'),el?.getAttribute?.('title'),el?.getAttribute?.('data-testid'),el?.id,el?.className].join(' '))}
function likelyBell(el){if(!(el instanceof Element))return false;const hit=el.closest('button,a,[role="button"],[role="tab"]');if(!hit)return false;const r=hit.getBoundingClientRect();if(r.top>190||r.bottom<0)return false;const m=meta(hit),t=clean(hit.textContent);if(/(?:notification|notice|通知|お知らせ)/i.test(m+' '+t)&&!/setting|filter/i.test(m))return true;const badge=[...hit.querySelectorAll('span,div')].some(x=>/^\d{1,3}$/.test(clean(x.textContent))&&x.getBoundingClientRect().width<50);return badge&&!!hit.querySelector('svg')}
function notificationSurface(root){if(!(root instanceof Element))return false;if(root.matches?.(ITEM)||root.querySelector?.(ITEM))return true;const txt=clean(root.textContent);if(txt.length>9000)return false;if(/通知/.test(txt)&&/お知らせ/.test(txt))return true;if(/(?:たった今|\d+\s*(?:分|時間|日)前)/u.test(txt)&&/(?:スキ|コメント|フォロー|マガジン|メンバーシップ|返信)/u.test(txt))return true;return false}
function anySurface(){if(document.querySelector(ITEM))return true;for(const el of document.querySelectorAll('[role="dialog"],[role="menu"],[popover],.m-navbarNotice,[class*="notification" i],[class*="notice" i]'))if(notificationSurface(el))return true;return false}
function tryAutoStart(){
  if(autoStarted||!anySurface())return false;const f=frame();if(!f)return false;
  try{const d=f.contentDocument,read=d?.getElementById('read'),health=d?.getElementById('health');if(!d||d.documentElement.dataset.mumeiReader2963!=='1'||!read)return false;const label=clean(read.textContent);if(!/下から読込/.test(label)||read.dataset.repair==='1')return false;autoStarted=true;if(health){health.dataset.readerStatus='1';health.textContent='🔄 自動で下から読込を開始します…';health.className='health saving'}setTimeout(()=>{if(anySurface()&&read.isConnected&&/下から読込/.test(clean(read.textContent)))read.click()},180);return true}catch{return false}
}
function clearStartTimers(){for(const t of startTimers)clearTimeout(t);startTimers=[]}
function scheduleAutoStart(){clearStartTimers();for(const ms of [80,260,650,1200])startTimers.push(setTimeout(()=>{if(manualVisible&&anySurface()){showDock();tryAutoStart()}},ms))}
function openIntent(msg){manualVisible=true;showDock(msg);scheduleAutoStart()}
function closeIntent(){manualVisible=false;clearStartTimers();autoStarted=false;hideDock()}
document.addEventListener('click',e=>{
  if(!likelyBell(e.target))return;
  if(manualVisible){closeIntent();return}
  autoStarted=false;openIntent('🔔を検出しました。自動読込を準備中…')
},true);
new MutationObserver(ms=>{
  let hit=false;
  for(const m of ms)for(const n of m.addedNodes){
    if(!(n instanceof Element))continue;
    if(n instanceof HTMLIFrameElement&&n.id===FRAME&&primary&&n!==primary){n.remove();continue}
    if(notificationSurface(n))hit=true
  }
  if(manualVisible&&(hit||anySurface())){showDock(hit?'通知一覧を検出しました。自動読込を準備中…':'');scheduleAutoStart()}
}).observe(document.documentElement,{subtree:true,childList:true});
addEventListener('pageshow',()=>{if(anySurface()){autoStarted=false;openIntent('通知一覧を確認中…')}});
addEventListener('focus',()=>{if(manualVisible){showDock();scheduleAutoStart()}else if(anySurface()){autoStarted=false;openIntent('通知一覧を確認中…')}});
addEventListener('pagehide',()=>closeIntent());
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&manualVisible)closeIntent()},true);
setTimeout(()=>{ensureDock();if(anySurface()){autoStarted=false;openIntent('通知一覧を確認中…')}},150);
})();
