(function(){
'use strict';
if(location.hostname!=='note.com')return;
if(window.__mumeiNotificationV315Fix)return;window.__mumeiNotificationV315Fix=true;
const VERSION='3.1.5';
const FRAME='mumei-v3-notification-frame';
const SETTINGS='https://mumei-s.github.io/note-insight/notification-filter.html?from=note';
const INSIGHT='https://mumei-s.github.io/note-insight/notification-entry.html?from=note&insightMode=notifications#dashboard';
const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
const safeReturn=v=>{try{const u=new URL(String(v||''));return u.origin==='https://mumei-s.github.io'&&u.pathname.startsWith('/note-insight/')?u.href:''}catch{return''}};

// 更新確認は外部本体の読込成功を待たず、親Userscriptが動いた時点で必ず戻す。
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
  b.searchParams.set('notificationUpdateResult','loader-checked-v315');
  location.replace(b.href);
})();

const HTML=`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent;font-family:system-ui,-apple-system,sans-serif}.dock{height:48px;padding:3px;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));grid-template-rows:25px 15px;gap:2px;border:1px solid #41677e;border-radius:10px;background:#07141e;box-shadow:0 -4px 16px rgba(0,0,0,.46)}button{height:25px;margin:0;padding:0 4px;border:1px solid #4c748b;border-radius:6px;background:#102a3a;color:#f1fbff;font:950 8.5px/1 system-ui;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ins{border-color:#55d8f1;background:#0b4056}.health{grid-column:1/-1;height:15px;display:flex;align-items:center;justify-content:center;border:1px solid #355063;border-radius:5px;background:#051019;color:#d4e8f4;font:850 7px/1 system-ui;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}</style><div class="dock"><button id="read">下から読込</button><button id="filter">フィルターOFF</button><button id="settings">フィルター設定</button><button id="ins" class="ins">INSIGHT【通知】</button><div id="health" class="health">本人通知 V3.1.5｜本体確認中…</div></div>`;
let intentUntil=0;
function ensure(){
  let f=document.getElementById(FRAME);
  if(!(f instanceof HTMLIFrameElement)){
    f=document.createElement('iframe');f.id=FRAME;f.title='INSIGHT 本人通知';f.srcdoc=HTML;
    f.style.cssText='position:fixed!important;left:6px!important;right:6px!important;bottom:max(8px,env(safe-area-inset-bottom,0px))!important;width:calc(100% - 12px)!important;height:48px!important;border:0!important;border-radius:10px!important;z-index:2147483647!important;background:transparent!important;display:none!important;visibility:visible!important;pointer-events:auto!important';
    (document.body||document.documentElement).appendChild(f);
  }
  bind(f);return f;
}
function bind(f){
  const go=()=>{try{const d=f.contentDocument;if(!d||d.documentElement.dataset.mumeiV315Fallback==='1')return false;d.documentElement.dataset.mumeiV315Fallback='1';const s=d.getElementById('settings'),i=d.getElementById('ins'),h=d.getElementById('health');if(s)s.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();location.assign(SETTINGS)},true);if(i)i.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();location.assign(INSIGHT)},true);if(h&&!h.dataset.readerStatus)h.textContent='本人通知 V3.1.5｜通知欄を開くと自動読込';return true}catch{return false}};
  if(!go())setTimeout(go,80);
}
function show(msg='通知欄を確認中…'){
  const f=ensure();f.dataset.mumeiDockVisible='1';f.style.setProperty('display','block','important');f.style.setProperty('visibility','visible','important');f.style.setProperty('width','calc(100% - 12px)','important');f.style.setProperty('height','48px','important');try{const h=f.contentDocument?.getElementById('health');if(h&&!h.dataset.readerStatus&&msg)h.textContent=msg}catch{}return f;
}
function bellMeta(el){return clean([el?.textContent,el?.getAttribute?.('aria-label'),el?.getAttribute?.('title'),el?.getAttribute?.('data-testid'),el?.getAttribute?.('href'),el?.id,el?.className].join(' '))}
function likelyBell(el){if(!(el instanceof Element))return false;const hit=el.closest('button,a,[role="button"],[role="tab"]');if(!hit)return false;const r=hit.getBoundingClientRect();if(r.top>220||r.bottom<0)return false;const m=bellMeta(hit);if(/(?:notification|notice|通知|お知らせ)/i.test(m)&&!/setting|filter/i.test(m))return true;if(hit.getAttribute('aria-expanded')==='true'&&hit.querySelector('svg'))return true;return !!hit.querySelector('svg')&&[...hit.querySelectorAll('span,div')].some(x=>/^\d{1,3}$/.test(clean(x.textContent)))}
function looksNoticeSurface(root){if(!(root instanceof Element))return false;const text=clean(root.textContent);if(text.length>14000)return false;if(/通知/.test(text)&&/お知らせ/.test(text))return true;if(/(?:たった今|\d+\s*(?:分|時間|日)前)/u.test(text)&&/(?:スキ|コメント|フォロー|マガジン|メンバーシップ|購入|返信)/u.test(text))return true;return false}
function surfaceOpen(){
  if(/^\/notifications(?:\/|$)/i.test(location.pathname))return true;
  for(const el of document.querySelectorAll('[role="dialog"],[role="menu"],[popover],[data-state="open"],[aria-modal="true"],[class*="notification" i],[class*="notice" i]'))if(looksNoticeSurface(el))return true;
  for(const el of document.querySelectorAll('button,a,[role="button"],[role="tab"]'))if(el.getAttribute('aria-expanded')==='true'&&likelyBell(el))return true;
  return Date.now()<intentUntil;
}
function wake(msg){intentUntil=Date.now()+30000;show(msg)}
document.addEventListener('click',e=>{if(likelyBell(e.target))wake('🔔を検出｜4ボタンを復旧しました')},true);
const observer=new MutationObserver(ms=>{for(const m of ms)for(const n of m.addedNodes){if(n instanceof Element&&looksNoticeSurface(n)){wake('通知一覧を検出｜4ボタンを表示');return}}if(surfaceOpen())show('通知一覧を確認中…')});
const start=()=>{ensure();observer.observe(document.documentElement,{subtree:true,childList:true});if(surfaceOpen())show('通知一覧を確認中…');};
if(document.body)start();else document.addEventListener('DOMContentLoaded',start,{once:true});
addEventListener('pageshow',()=>{if(surfaceOpen())show('通知一覧を確認中…')});
addEventListener('focus',()=>{if(surfaceOpen())show('通知一覧を確認中…')});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&surfaceOpen())show('通知一覧を確認中…')});
setInterval(()=>{if(surfaceOpen())show('')},1500);
})();
