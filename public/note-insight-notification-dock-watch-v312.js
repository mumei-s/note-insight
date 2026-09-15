(function(){
'use strict';
if(location.hostname!=='note.com')return;
if(window.__mumeiNotificationSingleDock320)return;window.__mumeiNotificationSingleDock320=true;

const VERSION='3.2.0';
const FRAME='mumei-v3-notification-frame';
const SHELL_ATTR='data-mumei-notice-shell-v3';
const OLD_IDS=['mumei-v2948-frame','mumei-notice-reader-v2963','mumei-v3-panel-clean-v1','mumei-v3-fixed-dock','mumei-v3-notification-launcher'];
const ITEM='.m-navbarNoticeItem,[class*="navbarNoticeItem"],[class*="notificationItem" i],[class*="noticeItem" i],[data-testid*="notification-item" i],[data-testid*="notice-item" i]';
const FIL='mumei_insight_magazine_filter_enabled_v3:',GRP='mumei_insight_notification_groups_v1:',MUT='mumei_insight_magazine_mute_ids_v5:';
const FILTER='https://mumei-s.github.io/note-insight/notification-filter.html?from=note&mumei_return='+encodeURIComponent('https://note.com/notifications');
const INSIGHT='https://mumei-s.github.io/note-insight/notification-entry.html?from=note&insightMode=notifications#dashboard';
const HIDE='mumei-v3-panel-hide';
const clean=v=>String(v||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let shell=null,lastHref=location.href,intentUntil=0,inspectTimer=0,autoStarted=false,pendingRead=false,accountId='',filterLoaded=false,filterOn=false,coreReady=Boolean(window.__mumeiV3CoreReady);

function visible(el){if(!(el instanceof Element))return false;const r=el.getBoundingClientRect();if(r.width<1||r.height<1||r.bottom<=0||r.right<=0||r.left>=innerWidth||r.top>=innerHeight)return false;for(let p=el,n=0;p&&n++<12;p=p.parentElement){const s=getComputedStyle(p);if(p.hasAttribute('hidden')||p.getAttribute('aria-hidden')==='true'||p.hasAttribute('inert')||s.display==='none'||s.visibility==='hidden'||Number(s.opacity||1)<=.01)return false}return true}
function text(el){return clean(el?.textContent||el?.getAttribute?.('aria-label')||el?.getAttribute?.('title')||'')}
function notificationRoute(){return /^\/notifications(?:\/|$)/i.test(location.pathname)}
function messageContext(){const p=location.pathname.toLowerCase();if(/(?:^|\/)(?:messages?|dm|chat|talk|inbox)(?:\/|$)/i.test(p))return true;for(const el of document.querySelectorAll('textarea,[contenteditable="true"]'))if(visible(el)){const h=clean([...document.querySelectorAll('header,h1,h2,[role="banner"]')].slice(0,24).map(x=>x.textContent).join(' '));if(/(?:メッセージ|トーク|チャット)/u.test(h))return true}return false}
function exactTab(root,label){for(const el of root.querySelectorAll?.('button,a,[role="tab"],[role="button"]')||[])if(visible(el)&&new RegExp('^'+label+'(?:\\s*\\d+)?$','u').test(text(el)))return el;return null}
function commonAncestor(a,b){let p=a,d=0;while(p&&p!==document.body&&p!==document.documentElement&&d++<12){if(p.contains(b)&&visible(p))return p;p=p.parentElement}return null}
function plausibleShell(el){if(!visible(el)||el===document.body||el===document.documentElement)return false;const r=el.getBoundingClientRect();return r.width>=180&&r.height>=80&&r.top<Math.max(320,innerHeight*.55)&&r.height<=innerHeight*1.35}
function expandShell(base){let p=base,d=0,best=null;while(p&&p!==document.body&&p!==document.documentElement&&d++<6){if(plausibleShell(p)){best=p;if(p.matches('[role="dialog"],[role="menu"],[popover],.m-navbarNotice,[class*="notificationList" i],[class*="noticeList" i]'))return p}p=p.parentElement}return best}
function findShell(){
 if(document.visibilityState==='hidden'||messageContext())return null;
 const route=notificationRoute();
 if(!route&&Date.now()>intentUntil&&!shell)return null;
 for(const root of document.querySelectorAll('[role="dialog"],[role="menu"],[popover],.m-navbarNotice,[class*="notificationList" i],[class*="noticeList" i],header,nav,main')){
   if(!visible(root))continue;
   const a=exactTab(root,'通知'),b=exactTab(root,'お知らせ');
   if(a&&b){const found=expandShell(commonAncestor(a,b)||root);if(found)return found}
 }
 const controls=[...document.querySelectorAll('button,a,[role="tab"],[role="button"]')].filter(visible),ns=controls.filter(x=>/^通知(?:\s*\d+)?$/u.test(text(x))),os=controls.filter(x=>/^お知らせ(?:\s*\d+)?$/u.test(text(x)));
 for(const a of ns)for(const b of os){const found=expandShell(commonAncestor(a,b));if(found)return found}
 if(route){for(const el of document.querySelectorAll('main,[role="main"],section'))if(visible(el)&&el.querySelector(ITEM))return el}
 return null;
}
function markShell(next){if(shell&&shell!==next)shell.removeAttribute(SHELL_ATTR);shell=next;if(shell)shell.setAttribute(SHELL_ATTR,'1')}

function retireOld(){for(const id of OLD_IDS){const el=document.getElementById(id);if(!el||el.id===FRAME)continue;if(el instanceof HTMLElement){el.style.setProperty('display','none','important');el.style.setProperty('visibility','hidden','important');el.style.setProperty('pointer-events','none','important');el.style.setProperty('width','0px','important');el.style.setProperty('height','0px','important')}if(id==='mumei-v3-notification-launcher')el.remove()}}
function ensureStyle(){if(document.getElementById('mumei-v3-single-dock-style'))return;const s=document.createElement('style');s.id='mumei-v3-single-dock-style';s.textContent='.'+HIDE+'{display:none!important}';document.documentElement.appendChild(s)}
function frameHtml(){return '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent;font-family:system-ui,-apple-system,sans-serif}.dock{height:32px;padding:3px;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:2px;border:1px solid #355063;border-radius:8px;background:#0e1c26;box-shadow:0 -3px 10px rgba(0,0,0,.30)}button{display:flex;align-items:center;justify-content:center;min-width:0;height:25px;margin:0;padding:0 3px;border:1px solid #42667b;border-radius:6px;background:#102737;color:#e3f8ff;font:900 8px/1 system-ui;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;touch-action:manipulation}.on{background:#17422f;border-color:#56a77b}.ins{border-color:#55d8f1;background:#11374a}</style><div class="dock"><button id="read">下から読込</button><button id="filter">フィルターOFF</button><button id="settings">フィルター設定</button><button id="ins" class="ins">INSIGHT【通知】</button></div>'}
function getFrame(){const f=document.getElementById(FRAME);return f instanceof HTMLIFrameElement?f:null}
function ensureFrame(){let f=getFrame();if(f){bindFrame();return f}f=document.createElement('iframe');f.id=FRAME;f.title='INSIGHT 本人通知';f.srcdoc=frameHtml();f.style.cssText='position:fixed!important;left:8px!important;right:8px!important;bottom:max(10px,calc(env(safe-area-inset-bottom,0px) + 6px))!important;width:calc(100% - 16px)!important;height:34px!important;border:0!important;border-radius:8px!important;z-index:2147483647!important;background:transparent!important;display:none!important;visibility:hidden!important;pointer-events:none!important';(document.body||document.documentElement).appendChild(f);f.addEventListener('load',bindFrame,{once:true});setTimeout(bindFrame,80);return f}
function showDock(showing){const f=ensureFrame();f.style.setProperty('display',showing?'block':'none','important');f.style.setProperty('visibility',showing?'visible':'hidden','important');f.style.setProperty('pointer-events',showing?'auto':'none','important');f.style.setProperty('height',showing?'34px':'0px','important');f.dataset.mumeiDockVisible=showing?'1':'0'}
function uiButton(id){try{return getFrame()?.contentDocument?.getElementById(id)||null}catch{return null}}

function modern(){return Boolean(globalThis.GM)}
async function getValue(k,d){try{if(modern()&&typeof GM.getValue==='function')return await GM.getValue(k,d);if(typeof GM_getValue==='function')return GM_getValue(k,d)}catch{}return d}
async function setValue(k,v){try{if(modern()&&typeof GM.setValue==='function')return await GM.setValue(k,v);if(typeof GM_setValue==='function')return GM_setValue(k,v)}catch{}}
async function account(){if(accountId)return accountId;try{const r=await fetch('/api/v2/current_user',{credentials:'include',cache:'no-store'});if(!r.ok)return'';const j=await r.json(),u=(j.data??j).user||(j.data??j),id=clean(u?.urlname||u?.url_name||u?.username).replace(/^@/,'').toLowerCase();if(!/^[a-z0-9_-]+$/.test(id))return'';accountId=id;return id}catch{return''}}
function creatorId(v){try{const u=new URL(String(v||''),location.href),p=u.pathname.split('/').filter(Boolean),id=(p[0]||'').toLowerCase();return u.hostname.endsWith('note.com')&&p.length===1&&/^[a-z0-9_-]+$/.test(id)&&!['settings','sitesettings','membership','notifications'].includes(id)?id:''}catch{return''}}
function rowCreator(el){for(const a of el.querySelectorAll?.('a[href]')||[]){const id=creatorId(a.getAttribute('href'));if(id)return id}return''}
function noticeRows(root=shell){return root?[...root.querySelectorAll(ITEM)].filter(visible):[]}
function magazineNoise(t){const s=clean(t);if(/新しい記事を\s*\d+\s*本追加しました/u.test(s))return true;if(!/(?:マガジン|共同運営|共同マガ|運営メンバー)/u.test(s))return false;return /(?:記事を\s*\d+\s*本追加|追加しました|追加されました|仲間入りしました|運営メンバー)/u.test(s)}
function clearFilter(){for(const el of document.querySelectorAll('.'+HIDE))el.classList.remove(HIDE)}
async function filterIds(){const id=await account();if(!id)return new Set();const gs=await getValue(GRP+id,[]);if(Array.isArray(gs)&&gs.length)return new Set(gs.filter(g=>g?.enabled!==false).flatMap(g=>Array.isArray(g?.ids)?g.ids:Array.isArray(g?.members)?g.members.filter(m=>m?.enabled!==false).map(m=>m.id):[]).map(x=>String(x).toLowerCase()).filter(x=>/^[a-z0-9_-]+$/.test(x)));const raw=await getValue(MUT+id,[]);return new Set((Array.isArray(raw)?raw:[]).map(x=>String(x).toLowerCase()).filter(x=>/^[a-z0-9_-]+$/.test(x)))}
function renderFilter(){const b=uiButton('filter');if(b){b.textContent=filterOn?'フィルターON':'フィルターOFF';b.classList.toggle('on',filterOn)}}
async function applyFilter(){clearFilter();renderFilter();if(!filterOn||!shell)return;const ids=await filterIds();if(!ids.size)return;for(const el of noticeRows()){if(magazineNoise(el.textContent)&&ids.has(rowCreator(el)))el.classList.add(HIDE)}}
async function initFilter(){if(filterLoaded){renderFilter();return}const id=await account();filterOn=id?Boolean(await getValue(FIL+id,false)):false;filterLoaded=true;renderFilter();if(filterOn)await applyFilter()}
async function toggleFilter(){await initFilter();filterOn=!filterOn;const id=await account();if(id)await setValue(FIL+id,filterOn);await applyFilter()}
async function openInsight(){const id=await account(),u=new URL(INSIGHT);if(id)u.searchParams.set('account',id);location.assign(u.href)}

function bindFrame(){const f=getFrame();if(!f)return;let d;try{d=f.contentDocument}catch{return}if(!d||d.documentElement.dataset.mumeiSingleDockBound==='1')return;d.documentElement.dataset.mumeiSingleDockBound='1';d.addEventListener('click',e=>{const b=e.target?.closest?.('button');if(!b)return;if(b.id==='filter'){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();void toggleFilter();return}if(b.id==='settings'){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();location.assign(FILTER);return}if(b.id==='ins'){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();void openInsight();return}if(b.id==='read'&&!coreReady){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();pendingRead=true}},true);renderFilter()}
async function tryAutoStart(){if(!shell||!coreReady||autoStarted)return;const b=uiButton('read');if(!b)return;const t=clean(b.textContent);if(!/(?:下から読込|追加読込)/u.test(t))return;autoStarted=true;await sleep(150);if(shell&&visible(shell)&&b.isConnected)b.click()}

function inspect(){retireOld();const next=findShell();if(next!==shell){markShell(next);autoStarted=false}const open=!!shell;showDock(open);if(!open){clearFilter();return}bindFrame();void initFilter();if(filterOn)void applyFilter();void tryAutoStart()}
function schedule(ms=40){clearTimeout(inspectTimer);inspectTimer=setTimeout(inspect,ms)}
function routeChanged(){if(location.href===lastHref)return;lastHref=location.href;intentUntil=0;markShell(null);showDock(false);autoStarted=false;clearFilter();schedule(0)}
function installRouteWatch(){for(const name of['pushState','replaceState']){const orig=history[name];if(typeof orig!=='function'||orig.__mumeiSingleDockWrapped)continue;const fn=function(){const out=orig.apply(this,arguments);queueMicrotask(routeChanged);return out};fn.__mumeiSingleDockWrapped=true;history[name]=fn}addEventListener('popstate',routeChanged);addEventListener('hashchange',routeChanged)}
function topClick(e){const el=e.target instanceof Element?e.target.closest('button,a,[role="button"],[role="tab"]'):null;if(!el)return;const r=el.getBoundingClientRect();if(r.top>220||r.bottom<0)return;intentUntil=Date.now()+3000;for(const ms of[30,90,180,360,700])setTimeout(inspect,ms)}
function blockNoticeNavigationWhileReading(e){const b=uiButton('read');const busy=!!b&&/(?:停止|保存中|読込中|確認中)/u.test(clean(b.textContent));if(!busy||!shell)return;const a=e.target instanceof Element?e.target.closest('a[href]'):null;if(a&&shell.contains(a)){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation()}}
function coreBecameReady(){coreReady=true;window.__mumeiV3CoreReady=true;bindFrame();if(pendingRead){pendingRead=false;setTimeout(()=>uiButton('read')?.click(),120)}schedule(0)}
function boot(){ensureStyle();ensureFrame();retireOld();installRouteWatch();inspect();document.addEventListener('click',topClick,true);document.addEventListener('click',blockNoticeNavigationWhileReading,true);document.addEventListener('mumei-v3-core-ready',coreBecameReady);new MutationObserver(()=>schedule(50)).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','aria-hidden','class','style']});addEventListener('pageshow',()=>schedule(80));addEventListener('focus',()=>schedule(80));document.addEventListener('visibilitychange',()=>schedule(40));setInterval(()=>{routeChanged();inspect()},300)}
if(document.body)boot();else document.addEventListener('DOMContentLoaded',boot,{once:true});
})();
