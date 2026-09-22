(function(){
'use strict';
if(location.hostname!=='note.com')return;
if(window.__mumeiNotificationControlsV1Loaded)return;window.__mumeiNotificationControlsV1Loaded=true;
const VERSION='1.3.5';
const TOOLBAR='mumei-inline-notification-controls-v1',STYLE=TOOLBAR+'-style';
const FIL='mumei_insight_magazine_filter_enabled_v3:';
const SETTINGS='https://mumei-s.github.io/note-insight/notification-filter-settings.html?from=note';
const INSIGHT='https://mumei-s.github.io/note-insight/?insightMode=notifications#dashboard';
const ITEM='.m-navbarNoticeItem,[class*="navbarNoticeItem"],[class*="notificationItem" i],[class*="noticeItem" i],[data-testid*="notification-item" i],[data-testid*="notice-item" i]';
const isDmRoute=()=>/^\/messages\/rooms(?:\/|$)/i.test(location.pathname);
const modern=()=>Boolean(globalThis.GM),key=(p,id)=>p+String(id||'').toLowerCase(),clean=v=>String(v||'').replace(/\s+/g,' ').trim();
async function get(k,d){try{if(modern()&&typeof GM.getValue==='function')return await GM.getValue(k,d);if(typeof GM_getValue==='function')return GM_getValue(k,d)}catch{}return d}
async function set(k,v){try{if(modern()&&typeof GM.setValue==='function')return await GM.setValue(k,v);if(typeof GM_setValue==='function')return GM_setValue(k,v)}catch{}}
let knownAccount=null,accountRequest=null;
async function account(){if(accountRequest)return accountRequest;accountRequest=(async()=>{const c=new AbortController(),timer=setTimeout(()=>c.abort(),8000);try{const r=await fetch('/api/v2/current_user',{credentials:'include',cache:'no-store',signal:c.signal});if(!r.ok)return null;const j=await r.json(),u=(j.data??j).user||(j.data??j),id=String(u.urlname||u.url_name||u.username||'').toLowerCase();knownAccount=/^[a-z0-9_-]+$/.test(id)?{id}:null;return knownAccount}catch{return null}finally{clearTimeout(timer);accountRequest=null}})();return accountRequest}
function text(el,value){if(el&&el.textContent!==value)el.textContent=value}
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
function installStyle(){let s=document.getElementById(STYLE);if(s)return;s=document.createElement('style');s.id=STYLE;document.documentElement.append(s);s.textContent=`#${TOOLBAR}{position:fixed;left:8px;right:8px;bottom:max(8px,env(safe-area-inset-bottom));z-index:2147483000;display:grid;grid-template-columns:.82fr 1fr .72fr 1.12fr;gap:3px;padding:3px;margin:0;background:rgba(8,20,29,.94);border:1px solid #35576d;border-radius:8px;box-shadow:0 3px 12px rgba(0,0,0,.28);backdrop-filter:blur(5px)}#${TOOLBAR} button{min-height:42px;border:1px solid #496a80;border-radius:6px;background:#102534;color:#e9f8ff;font:800 11px/1.2 system-ui;padding:0 5px;white-space:nowrap;touch-action:manipulation;cursor:pointer}#${TOOLBAR} .read-status{grid-column:1/-1;margin:1px 4px 2px;color:#bedce9;font:600 10px/1.3 system-ui;overflow-wrap:anywhere}#${TOOLBAR} button[data-on="1"]{background:#163421;border-color:#57b878;color:#d9ffe5}#${TOOLBAR} button[data-state="done"]{background:#123d26;border-color:#63cf85;color:#dfffea}#${TOOLBAR} button[data-state="error"]{background:#3a171d;border-color:#a95b68;color:#ffdbe0}#${TOOLBAR} button:active{transform:scale(.98)}`}
async function sync(bar){const a=await account();if(!a||!bar?.isConnected)return;const enabled=Boolean(await get(key(FIL,a.id),false)),b=bar.querySelector('[data-action="filter"]');if(b){b.dataset.on=enabled?'1':'0';text(b,enabled?'フィルター ON':'フィルター OFF')}}
function leave(url,label){
 const veil=document.createElement('div');veil.id='mumei-route-veil-v130';veil.textContent=label||'INSIGHTへ移動中…';veil.style.cssText='position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;background:#07131c;color:#e7f8ff;font:900 13px/1.4 system-ui;letter-spacing:.03em';
 document.documentElement.appendChild(veil);requestAnimationFrame(()=>location.replace(url))
}
async function act(action,bar){
 if(action==='read'){
  const b=bar?.querySelector('[data-action="read"]');if(b){const running=b.dataset.state==='busy';b.textContent=running?'停止中…':'読込中';b.dataset.state='busy'}
  const reader=window.__mumeiNotificationReaderV4;
  if(!reader||typeof reader.scan!=='function'){if(b){b.textContent='再読込';b.dataset.state='error'}return}
  try{await reader.scan({forceNetwork:true})}catch{if(b){b.textContent='再読込';b.dataset.state='error'}}return
 }
 if(action==='filter'){const a=await account();if(!a){renderStatus({state:'error',message:'noteログインの確認に失敗しました'});return}const next=!Boolean(await get(key(FIL,a.id),false));await set(key(FIL,a.id),next);window.dispatchEvent(new Event('mumei-insight-filter-refresh-v2939'));await sync(bar);return}
 if(action==='settings'){const u=new URL(SETTINGS);if(knownAccount)u.searchParams.set('notificationAccount',knownAccount.id);leave(u.href,'設定を開いています…');return}
 if(action==='insight'){const u=new URL(INSIGHT);u.searchParams.set('insightMode','notifications');if(knownAccount)u.searchParams.set('notificationAccount',knownAccount.id);u.hash='dashboard';leave(u.href,'INSIGHT【通知】を開いています…');return}
}
function makeBar(){
 const bar=document.createElement('div');bar.id=TOOLBAR;bar.setAttribute('data-mumei-notification-controls','1');
 bar.innerHTML='<button type="button" data-action="read">読込</button><button type="button" data-action="filter">フィルター</button><button type="button" data-action="settings">設定</button><button type="button" data-action="insight">INSIGHT【通知】</button><p class="read-status" role="status" aria-live="polite">新着を確認します</p>';
 return bar
}
function toolbarTarget(e){const t=e.target;return t instanceof Element?t.closest('#'+TOOLBAR+' button[data-action]'):null}
function interceptToolbar(e){
 const b=toolbarTarget(e);if(!b)return;
 // Cancelling touchstart/touchend suppresses the browser-generated click on phones.
 // Isolate the gesture from note, but cancel its default action only on click.
 e.stopPropagation();e.stopImmediatePropagation();
 if(e.type==='click')e.preventDefault();
 if(e.type==='click'){const bar=b.closest('#'+TOOLBAR);if(bar)void act(String(b.getAttribute('data-action')||''),bar)}
}
for(const ev of ['pointerdown','pointerup','mousedown','mouseup','touchstart','touchend','click'])window.addEventListener(ev,interceptToolbar,{capture:true,passive:ev!=='click'});
function dedupe(){
 const all=[...document.querySelectorAll('#'+TOOLBAR+',[data-mumei-notification-controls="1"],#mumei-inline-notification-tools-v339')];
 let keep=all.find(x=>x.id===TOOLBAR)||null;
 if(!keep&&all.length){keep=all[0];keep.id=TOOLBAR;keep.setAttribute('data-mumei-notification-controls','1')}
 for(const el of all)if(el!==keep)el.remove();
 return keep
}
function mount(){
 if(isDmRoute()){for(const el of document.querySelectorAll('#'+TOOLBAR+',[data-mumei-notification-controls="1"],#mumei-inline-notification-tools-v339'))el.remove();return}
 const panel=findPanel();if(!panel){const old=dedupe();if(old)old.remove();return}
 installStyle();
 let bar=dedupe()||makeBar();
 if(document.body&&bar.parentElement!==document.body){document.body.appendChild(bar);void sync(bar)}
 if(lastStatus)renderStatus(lastStatus)
}
let timer=0,lastStatus=null;
const owned=node=>node instanceof Element&&Boolean(node.closest('#'+TOOLBAR+',#'+STYLE));
const schedule=(ms=180)=>{if(timer)return;timer=setTimeout(()=>{timer=0;mount()},ms)};
function observe(){if(!document.documentElement){document.addEventListener('DOMContentLoaded',observe,{once:true});return}new MutationObserver(records=>{if(records.some(r=>!owned(r.target)))schedule()}).observe(document.documentElement,{subtree:true,childList:true});schedule(150)}
observe();
window.addEventListener('pageshow',()=>{knownAccount=null;schedule(150)});window.addEventListener('focus',()=>{knownAccount=null;schedule(150);const bar=dedupe();if(bar)void sync(bar)});
function renderStatus(d){
 lastStatus=d;const bar=dedupe();if(!bar?.isConnected)return;
 const b=bar.querySelector('[data-action="read"]'),line=bar.querySelector('.read-status');if(!b)return;
 const state=String(d.state||''),read=Number(d.readCount||0),saved=Number(d.savedCount||0),total=Number(d.totalCount||0);
 const busy=Boolean(d.scanning||state==='saving'),paused=Boolean(d.stopping||d.partial)&&!busy;
 const label=state==='error'?'再試行':busy?(d.stopping?'停止中…':'停止'):paused?'続き読込':saved?'✓保存 '+saved:'確認済み';
 text(b,label);b.dataset.state=state==='error'?'error':busy?'busy':paused?'paused':'done';
 const message=state==='error'?String(d.message||'読込に失敗しました'):busy?`読込 ${read}${total?' / '+total:''}｜保存確認 ${saved}`:paused?`途中保存 ${saved}件｜続きから再開できます`:saved?`読込 ${read}｜保存確認 ${saved}件`:'新着なし｜今回の追加保存 0件';
 text(line,message);b.title=String(d.message||message);b.setAttribute('aria-label',label+'：'+message);
}
window.addEventListener('mumei-notification-reader-status',e=>renderStatus(e.detail||{}));
window.__mumeiNotificationControlsV1={version:VERSION,mount,findPanel,sync};
})();
