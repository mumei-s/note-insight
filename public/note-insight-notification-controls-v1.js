(function(){
'use strict';
if(location.hostname!=='note.com')return;
if(window.__mumeiNotificationControlsV1Loaded)return;window.__mumeiNotificationControlsV1Loaded=true;
const VERSION='1.2.0';
const TOOLBAR='mumei-inline-notification-controls-v1',STYLE=TOOLBAR+'-style';
const FIL='mumei_insight_magazine_filter_enabled_v3:';
const SETTINGS='https://mumei-s.github.io/note-insight/notification-filter-settings.html?from=note';
const INSIGHT='https://mumei-s.github.io/note-insight/?insightMode=notifications#dashboard';
const ITEM='.m-navbarNoticeItem,[class*="navbarNoticeItem"],[class*="notificationItem" i],[class*="noticeItem" i],[data-testid*="notification-item" i],[data-testid*="notice-item" i]';
const isDmRoute=()=>/^\/messages\/rooms(?:\/|$)/i.test(location.pathname);
const modern=()=>Boolean(globalThis.GM),key=(p,id)=>p+String(id||'').toLowerCase(),clean=v=>String(v||'').replace(/\s+/g,' ').trim();
async function get(k,d){try{if(modern()&&typeof GM.getValue==='function')return await GM.getValue(k,d);if(typeof GM_getValue==='function')return GM_getValue(k,d)}catch{}return d}
async function set(k,v){try{if(modern()&&typeof GM.setValue==='function')return await GM.setValue(k,v);if(typeof GM_setValue==='function')return GM_setValue(k,v)}catch{}}
async function account(){try{const r=await fetch('/api/v2/current_user',{credentials:'include',cache:'no-store'});if(!r.ok)return null;const j=await r.json(),u=(j.data??j).user||(j.data??j),id=String(u.urlname||u.url_name||u.username||'').toLowerCase();return/^[a-z0-9_-]+$/.test(id)?{id}:null}catch{return null}}
function shown(el){if(!(el instanceof Element))return false;const r=el.getBoundingClientRect();if(r.width<1||r.height<1)return false;for(let p=el;p&&p!==document.body;p=p.parentElement){const s=getComputedStyle(p);if(p.hidden||p.getAttribute('aria-hidden')==='true'||s.display==='none'||s.visibility==='hidden')return false}return true}
function tabs(root){let n=false,o=false,c=0;for(const el of root.querySelectorAll('button,a,[role="tab"],[role="button"]')){if(c++>140)break;if(!shown(el))continue;const t=clean(el.textContent||el.getAttribute('aria-label')||el.getAttribute('title'));if(/^通知(?:\s*\d+)?$/u.test(t))n=true;if(/^お知らせ(?:\s*\d+)?$/u.test(t))o=true;if(n&&o)return true}return false}
function hasRows(root){let n=0;for(const el of root.querySelectorAll(ITEM+',li,[role="listitem"]')){if(!shown(el))continue;const t=clean(el.textContent);if(t.length<3||t.length>4000)continue;if(/(?:たった今|昨日|\d+\s*(?:秒|分|時間|日|週|か月|ヶ月|月|年)前)/u.test(t)){if(++n>=1)return true}}return false}
function findPanel(){
 if(isDmRoute())return null;
 const reader=window.__mumeiNotificationReaderV4;
 try{const p=reader&&typeof reader.findPanel==='function'?reader.findPanel():null;if(p&&shown(p))return p}catch{}
 const exact=[...document.querySelectorAll(ITEM)].filter(shown);
 for(const item of exact){let p=item.parentElement,d=0;while(p&&p!==document.body&&d++<12){if(shown(p)&&(tabs(p)||p.matches('[role="dialog"],[role="menu"],[popover],.m-navbarNotice,[class*="notificationList" i],[class*="noticeList" i]'))&&hasRows(p))return p;p=p.parentElement}}
 const controls=[...document.querySelectorAll('button,a,[role="tab"],[role="button"]')].filter(shown),ns=controls.filter(x=>/^通知(?:\s*\d+)?$/u.test(clean(x.textContent))),os=controls.filter(x=>/^お知らせ(?:\s*\d+)?$/u.test(clean(x.textContent)));
 for(const a of ns)for(const b of os){let p=a.parentElement,d=0;while(p&&p!==document.body&&d++<12){if(p.contains(b)&&shown(p)){let q=p,k=0;while(q&&q!==document.body&&k++<6){if(hasRows(q))return q;q=q.parentElement}}p=p.parentElement}}
 return null
}
function installStyle(){let s=document.getElementById(STYLE);if(!s){s=document.createElement('style');s.id=STYLE;document.documentElement.append(s)}s.textContent=`#${TOOLBAR}{position:fixed;left:8px;right:8px;bottom:max(8px,env(safe-area-inset-bottom));z-index:2147483000;display:grid;grid-template-columns:.82fr 1fr .72fr 1.12fr;gap:3px;padding:3px;margin:0;background:rgba(8,20,29,.94);border:1px solid #35576d;border-radius:8px;box-shadow:0 3px 12px rgba(0,0,0,.28);backdrop-filter:blur(5px)}#${TOOLBAR} button{min-height:29px;border:1px solid #496a80;border-radius:6px;background:#102534;color:#e9f8ff;font:900 9px/1 system-ui;padding:0 5px;white-space:nowrap}#${TOOLBAR} button[data-on="1"]{background:#163421;border-color:#57b878;color:#d9ffe5}#${TOOLBAR} button:active{transform:scale(.98)}`}
async function sync(bar){const a=await account();if(!a||!bar?.isConnected)return;const enabled=Boolean(await get(key(FIL,a.id),false)),b=bar.querySelector('[data-action="filter"]');if(b){b.dataset.on=enabled?'1':'0';b.textContent=enabled?'フィルター ON':'フィルター OFF'}}
async function act(action,bar){
 const a=await account();if(!a)return;
 if(action==='read'){
  const b=bar?.querySelector('[data-action="read"]');if(b){b.textContent='読込中';b.dataset.state='busy'}
  const reader=window.__mumeiNotificationReaderV4;
  if(!reader||typeof reader.scan!=='function'){if(b){b.textContent='再読込';b.dataset.state='error'}return}
  try{await reader.scan()}catch{if(b){b.textContent='再読込';b.dataset.state='error'}}return
 }
 if(action==='filter'){const next=!Boolean(await get(key(FIL,a.id),false));await set(key(FIL,a.id),next);window.dispatchEvent(new Event('mumei-insight-filter-refresh-v2939'));await sync(bar);return}
 if(action==='settings'){const u=new URL(SETTINGS);u.searchParams.set('notificationAccount',a.id);location.assign(u.href);return}
 if(action==='insight'){const u=new URL(INSIGHT);u.searchParams.set('insightMode','notifications');u.searchParams.set('notificationAccount',a.id);u.hash='dashboard';location.assign(u.href);return}
}
function makeBar(){
 const bar=document.createElement('div');bar.id=TOOLBAR;bar.setAttribute('data-mumei-notification-controls','1');
 bar.innerHTML='<button type="button" data-action="read">読込</button><button type="button" data-action="filter">フィルター</button><button type="button" data-action="settings">設定</button><button type="button" data-action="insight">INSIGHT【通知】</button>';
 for(const ev of ['pointerdown','mousedown','touchstart'])bar.addEventListener(ev,e=>e.stopPropagation(),true);
 bar.addEventListener('click',e=>{const b=e.target instanceof Element?e.target.closest('button[data-action]'):null;if(!b)return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();void act(String(b.getAttribute('data-action')||''),bar)},true);
 return bar
}
function dedupe(){
 const all=[...document.querySelectorAll('#'+TOOLBAR+',[data-mumei-notification-controls="1"],#mumei-inline-notification-tools-v339')];
 let keep=all.find(x=>x.id===TOOLBAR)||null;
 if(!keep&&all.length){keep=all[0];keep.id=TOOLBAR;keep.setAttribute('data-mumei-notification-controls','1')}
 for(const el of all)if(el!==keep)el.remove();
 return keep
}
function mount(){
 if(isDmRoute()){for(const el of document.querySelectorAll('#'+TOOLBAR+',[data-mumei-notification-controls="1"],#mumei-inline-notification-tools-v339'))el.remove();return}
 const panel=findPanel();if(!panel)return;
 installStyle();
 let bar=dedupe()||makeBar();
 if(document.body&&bar.parentElement!==document.body)document.body.appendChild(bar);
 void sync(bar)
}
let timer=0;const schedule=(ms=180)=>{clearTimeout(timer);timer=setTimeout(mount,ms)};
setTimeout(()=>schedule(450),100);
new MutationObserver(()=>schedule(180)).observe(document.documentElement,{subtree:true,childList:true});
document.addEventListener('click',e=>{if(isDmRoute())return;const el=e.target instanceof Element?e.target.closest('button,[role="button"],[aria-label],[title],[data-testid]'):null;if(!el)return;const t=clean([el.textContent,el.getAttribute('aria-label'),el.getAttribute('title'),el.getAttribute('data-testid')].join(' '));if(/(?:通知|お知らせ|notification|notice|bell)/iu.test(t))schedule(220)},true);
window.addEventListener('pageshow',()=>schedule(300));window.addEventListener('focus',()=>schedule(300));
window.addEventListener('mumei-notification-reader-status',e=>{const bar=dedupe();if(!bar?.isConnected)return;const b=bar.querySelector('[data-action="read"]'),d=e.detail||{};if(!b)return;const state=String(d.state||'');b.title=String(d.message||'');if(state==='done'){b.textContent='✓保存';b.dataset.state='done'}else if(state==='error'){b.textContent='再読込';b.dataset.state='error'}else if(d.scanning){b.textContent='読込中';b.dataset.state='busy'}});
window.__mumeiNotificationControlsV1={version:VERSION,mount,findPanel,sync};
})();