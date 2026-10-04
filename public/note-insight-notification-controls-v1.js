(function(){
'use strict';
if(location.hostname!=='note.com')return;
if(window.__mumeiNotificationControlsV1Loaded)return;window.__mumeiNotificationControlsV1Loaded=true;
const VERSION='1.4.5';
const featureOn=()=>window.__mumeiNotificationFeatureV1?.isEnabled?.()!==false;
const TOOLBAR='mumei-inline-notification-controls-v1',STYLE=TOOLBAR+'-style';
const FIL='mumei_insight_magazine_filter_enabled_v3:',PANEL='mumei_insight_notification_panel_enabled_v1';
const SETTINGS='https://mumei-s.github.io/note-insight/notification-filter-settings.html?from=note';
const INSIGHT='https://mumei-s.github.io/note-insight/?insightMode=notifications#dashboard';
const CONNECTION='https://mumei-s.github.io/note-insight/notification-connection.html?from=note';
const ITEM='.m-navbarNoticeItem,[class*="navbarNoticeItem"],[class*="notificationItem" i],[class*="noticeItem" i],[data-testid*="notification-item" i],[data-testid*="notice-item" i]';
const isDmRoute=()=>/^\/messages\/rooms(?:\/|$)/i.test(location.pathname)&&!findPanel();
const modern=()=>Boolean(globalThis.GM),key=(p,id)=>p+String(id||'').toLowerCase(),clean=v=>String(v||'').replace(/\s+/g,' ').trim();
async function get(k,d){try{if(modern()&&typeof GM.getValue==='function')return await GM.getValue(k,d);if(typeof GM_getValue==='function')return GM_getValue(k,d)}catch{}return d}
async function set(k,v){try{if(modern()&&typeof GM.setValue==='function')return await GM.setValue(k,v);if(typeof GM_setValue==='function')return GM_setValue(k,v)}catch{}}
async function refreshPanel(){panelVisible=Boolean(await get(PANEL,true));if(panelVisible)schedule(0);else for(const el of document.querySelectorAll('#'+TOOLBAR+',[data-mumei-notification-controls="1"],#mumei-inline-notification-tools-v339'))el.remove();return panelVisible}
let knownAccount=null,accountRequest=null,panelVisible=null;
async function account(){if(accountRequest)return accountRequest;accountRequest=(async()=>{const c=new AbortController(),timer=setTimeout(()=>c.abort(),8000);try{const r=await fetch('/api/v2/current_user',{credentials:'include',cache:'no-store',signal:c.signal});if(!r.ok)return null;const j=await r.json(),u=(j.data??j).user||(j.data??j),id=String(u.urlname||u.url_name||u.username||'').toLowerCase();knownAccount=/^[a-z0-9_-]+$/.test(id)?{id}:null;return knownAccount}catch{return null}finally{clearTimeout(timer);accountRequest=null}})();return accountRequest}
function text(el,value){if(el&&el.textContent!==value)el.textContent=value}
function shown(el){if(!(el instanceof Element))return false;const r=el.getBoundingClientRect();if(r.width<1||r.height<1)return false;for(let p=el;p&&p!==document.body;p=p.parentElement){const s=getComputedStyle(p);if(p.hidden||p.getAttribute('aria-hidden')==='true'||s.display==='none'||s.visibility==='hidden')return false}return true}
function tabs(root){let n=false,o=false,c=0;for(const el of root.querySelectorAll('button,a,[role="tab"],[role="button"]')){if(c++>140)break;if(!shown(el))continue;const t=clean(el.textContent||el.getAttribute('aria-label')||el.getAttribute('title'));if(/^通知(?:\s*\d+)?$/u.test(t))n=true;if(/^お知らせ(?:\s*\d+)?$/u.test(t))o=true;if(n&&o)return true}return false}
function hasRows(root){let n=0;for(const el of root.querySelectorAll(ITEM+',li,[role="listitem"]')){if(!shown(el))continue;const t=clean(el.textContent);if(t.length<3||t.length>4000)continue;if(/(?:たった今|昨日|\d+\s*(?:秒|分|時間|日|週|か月|ヶ月|月|年)前)/u.test(t)){if(++n>=1)return true}}return false}
function findPanel(){
 try{const p=window.__mumeiNotificationFilterV4?.findPanel?.();if(p&&shown(p))return p}catch{}
 const reader=window.__mumeiNotificationReaderV4;
 try{const p=reader&&typeof reader.findPanel==='function'?reader.findPanel():null;if(p&&shown(p))return p}catch{}
 const exact=[...document.querySelectorAll(ITEM)].filter(shown);
 for(const item of exact){let p=item.parentElement,d=0;while(p&&p!==document.body&&d++<12){if(shown(p)&&(tabs(p)||p.matches('[role="dialog"],[role="menu"],[popover],.m-navbarNotice,[class*="notificationList" i],[class*="noticeList" i]'))&&hasRows(p))return p;p=p.parentElement}}
 const controls=[...document.querySelectorAll('button,a,[role="tab"],[role="button"]')].filter(shown),ns=controls.filter(x=>/^通知(?:\s*\d+)?$/u.test(clean(x.textContent))),os=controls.filter(x=>/^お知らせ(?:\s*\d+)?$/u.test(clean(x.textContent)));
 for(const a of ns)for(const b of os){let p=a.parentElement,d=0;while(p&&p!==document.body&&d++<12){if(p.contains(b)&&shown(p)){let q=p,k=0;while(q&&q!==document.body&&k++<6){if(hasRows(q))return q;q=q.parentElement}}p=p.parentElement}}
 return null
}
function installStyle(){let s=document.getElementById(STYLE);if(s?.dataset.version===VERSION)return;if(!s){s=document.createElement('style');s.id=STYLE;document.documentElement.append(s)}s.dataset.version=VERSION;s.textContent=`#${TOOLBAR}{overflow:hidden;position:fixed;left:8px;right:8px;bottom:max(8px,env(safe-area-inset-bottom));z-index:2147483000;display:grid;grid-template-columns:.82fr 1fr .72fr 1.12fr;gap:3px;padding:3px;margin:0;background:rgba(8,20,29,.94);border:1px solid #35576d;border-radius:8px;box-shadow:0 3px 12px rgba(0,0,0,.28);backdrop-filter:blur(5px)}#${TOOLBAR} button{min-height:32px!important;height:32px!important;min-width:0;border:1px solid #496a80;border-radius:6px;background:#102534;color:#e9f8ff;font:800 11px/1.2 system-ui;padding:0 3px!important;white-space:nowrap;touch-action:manipulation;cursor:pointer}#${TOOLBAR} button[data-action=filter]{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0;overflow:hidden;white-space:normal;font-size:10px;line-height:1.05}#${TOOLBAR} button[data-action=filter] small{font-size:9px;line-height:1.1}#${TOOLBAR} .read-status{grid-column:1/-1;margin:0 3px;color:#bedce9;font:600 10px/1.3 system-ui;white-space:normal;overflow-wrap:anywhere}#${TOOLBAR} button[data-on="1"]{background:#163421;border-color:#57b878;color:#d9ffe5}#${TOOLBAR} button[data-state="done"]{background:#123d26;border-color:#63cf85;color:#dfffea}#${TOOLBAR} button[data-state="error"]{background:#3a171d;border-color:#a95b68;color:#ffdbe0}#${TOOLBAR} button:active{transform:scale(.98)}#${TOOLBAR}[aria-busy="true"]::after{content:"";position:absolute;bottom:0;left:2%;width:24%;height:2px;background:#8aebff;border-radius:3px;pointer-events:none;animation:mumei-notification-progress 1s ease-in-out infinite}@keyframes mumei-notification-progress{0%{transform:translateX(0);opacity:.4}50%{opacity:1}100%{transform:translateX(300%);opacity:.4}}@media(prefers-reduced-motion:reduce){#${TOOLBAR}[aria-busy="true"]::after{animation:none;width:96%}}`}
async function sync(bar){if(!bar?.isConnected)return;const a=await account();if(!a)return;const enabled=Boolean(await get(key(FIL,a.id),false)),b=bar.querySelector('[data-action="filter"]');if(b){b.dataset.on=enabled?'1':'0';b.setAttribute('aria-label',enabled?'フィルター ON':'フィルター OFF');if(!b.querySelector('span'))b.innerHTML='<span>フィルター </span><small></small>';text(b.querySelector('small'),enabled?'ON':'OFF')}}
function leave(url,label){
 const veil=document.createElement('div');veil.id='mumei-route-veil-v130';veil.textContent=label||'INSIGHTへ移動中…';veil.style.cssText='position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;background:#07131c;color:#e7f8ff;font:900 13px/1.4 system-ui;letter-spacing:.03em';
 document.documentElement.appendChild(veil);requestAnimationFrame(()=>location.replace(url))
}
async function act(action,bar){
 if(!featureOn())return;
 if(action==='read'){
  const b=bar?.querySelector('[data-action="read"]');if(b){const running=b.dataset.state==='busy';b.textContent=running?'停止中…':'読込中';b.dataset.state='busy'}
  if(b?.dataset.repair==='1'){const a=knownAccount||await account(),u=new URL(CONNECTION);if(a)u.searchParams.set('notificationAccount',a.id);u.searchParams.set('return',INSIGHT);leave(u.href,'本人通知の再連携を開いています…');return}
  const reader=window.__mumeiNotificationReaderV4;
  if(!reader||typeof reader.scan!=='function'){if(b){b.textContent='再読込';b.dataset.state='error'}return}
  try{await reader.scan({forceNetwork:true})}catch{if(b){b.textContent='再読込';b.dataset.state='error'}}return
 }
 if(action==='filter'){const a=await account();if(!a){renderStatus({state:'error',message:'noteログインの確認に失敗しました'});return}const next=!Boolean(await get(key(FIL,a.id),false));await set(key(FIL,a.id),next);window.dispatchEvent(new Event('mumei-insight-filter-refresh-v2939'));await sync(bar);return}
 if(action==='settings'){const a=knownAccount||await account();if(!a){renderStatus({state:'error',message:'note本人IDを確認できません。もう一度設定を押してください'});return}const u=new URL(SETTINGS);u.searchParams.set('notificationAccount',a.id);leave(u.href,'設定を開いています…');return}
 if(action==='insight'){const a=knownAccount||await account();const u=new URL(INSIGHT);u.searchParams.set('insightMode','notifications');if(a)u.searchParams.set('notificationAccount',a.id);u.hash='dashboard';leave(u.href,'INSIGHT【通知】を開いています…');return}
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
 if(keep){keep.removeAttribute('data-collapsed');for(const button of keep.querySelectorAll('[data-action="collapse"],.collapse'))button.remove()}
 return keep
}
function mount(){
 if(!featureOn()||panelVisible!==true||isDmRoute()){for(const el of document.querySelectorAll('#'+TOOLBAR+',[data-mumei-notification-controls="1"],#mumei-inline-notification-tools-v339'))el.remove();return}
 const panel=findPanel();if(!panel){const old=dedupe();if(old)old.remove();return}
 installStyle();
 let bar=dedupe()||makeBar();
 if(document.body&&bar.parentElement!==document.body){document.body.appendChild(bar);void sync(bar)}
 lastFilter=window.__mumeiNotificationFilterV4?.getState?.()||lastFilter;
 if(lastStatus)renderStatus(lastStatus);else text(bar.querySelector('.read-status'),filterNotice()||'新着を確認します')
}
let timer=0,lastStatus=null,lastFilter=null;
function filterNotice(){return lastFilter?.enabled&&lastFilter.total>0&&lastFilter.hidden===lastFilter.total?`表示中の${lastFilter.total}件はすべてフィルター対象です｜OFFで表示`:''}
const owned=node=>node instanceof Element&&Boolean(node.closest('#'+TOOLBAR+',#'+STYLE));
const schedule=(ms=180)=>{if(timer)return;timer=setTimeout(()=>{timer=0;mount()},ms)};
function observe(){if(!document.documentElement){document.addEventListener('DOMContentLoaded',observe,{once:true});return}new MutationObserver(records=>{if(records.some(r=>!owned(r.target)))schedule()}).observe(document.documentElement,{subtree:true,childList:true});schedule(150)}
void refreshPanel().then(observe);
window.addEventListener('pageshow',()=>{void refreshPanel();const bar=dedupe();if(bar)void sync(bar)});window.addEventListener('focus',()=>{void refreshPanel();const bar=dedupe();if(bar)void sync(bar)});
function renderStatus(d){
 lastStatus=d;const bar=dedupe();if(!bar?.isConnected)return;
 const b=bar.querySelector('[data-action="read"]'),line=bar.querySelector('.read-status');if(!b)return;
 const state=String(d.state||''),read=Number(d.readCount||0),saved=Number(d.savedCount||0),total=Number(d.totalCount||0);
 const busy=Boolean(d.scanning||state==='saving'),paused=Boolean(d.stopping||d.partial)&&!busy;
 bar.setAttribute('aria-busy',String(busy));
 const repair=state==='error'&&(String(d.errorCode||'')==='PAIR_REQUIRED'||/(?:本人通知|本人)の?連携|PAIR_REQUIRED/u.test(String(d.message||'')));
 const label=repair?'再連携':state==='error'?'再試行':busy?(d.stopping?'停止中…':'停止'):paused?'続き読込':saved?'✓保存 '+saved:d.historyComplete?'確認済み':'再確認';
 b.dataset.repair=repair?'1':'0';
 text(b,label);b.dataset.state=state==='error'?'error':busy?'busy':paused?'paused':'done';
 const message=state==='error'?String(d.message||'読込に失敗しました')+(total?`（保存確認 ${saved} / ${total}件）`:''):busy&&d.phase==='saving'?`保存先を確認中｜保存確認 ${saved} / ${total}件`:busy?`読込 ${read}${total?' / '+total:''}｜保存確認 ${saved}`:paused?`途中保存 ${saved}件｜続きから再開できます`:saved?`読込 ${read}｜保存確認 ${saved}件`:d.historyComplete?`確認 ${Number(d.checkedCount||0)}件・追加0件${d.boundaryAt?'｜保存位置 '+new Date(d.boundaryAt).toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'}):''}`:'確認中・保存完了は未確認';
 text(line,[message,filterNotice()].filter(Boolean).join('｜'));b.title=String(d.message||message);b.setAttribute('aria-label',label+'：'+message);
}
window.addEventListener('mumei-notification-reader-status',e=>renderStatus(e.detail||{}));
window.addEventListener('mumei-notification-filter-status',e=>{lastFilter=e.detail||null;mount()});
window.addEventListener('mumei-notification-feature-changed',()=>{lastStatus=null;lastFilter=null;mount()});
const panelListen=modern()&&typeof GM.addValueChangeListener==='function'?GM.addValueChangeListener:typeof GM_addValueChangeListener==='function'?GM_addValueChangeListener:null;if(panelListen)try{panelListen(PANEL,()=>void refreshPanel())}catch{}
window.__mumeiNotificationControlsV1={version:VERSION,mount,findPanel,sync,refreshPanel};
})();
