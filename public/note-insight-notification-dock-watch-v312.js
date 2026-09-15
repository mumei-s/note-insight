(function(){
'use strict';
if(location.hostname!=='note.com')return;
if(window.__mumeiNotificationDock321)return;window.__mumeiNotificationDock321=true;

const VERSION='3.2.1';
const ROOT='mumei-v3-visible-dock-v321';
const BACKEND='mumei-v3-notification-frame';
const SHELL_ATTR='data-mumei-notice-shell-v3';
const OLD_IDS=['mumei-v2948-frame','mumei-notice-reader-v2963','mumei-v3-panel-clean-v1','mumei-v3-fixed-dock','mumei-v3-notification-launcher'];
const ITEM='.m-navbarNoticeItem,[class*="navbarNoticeItem"],[class*="notificationItem" i],[class*="noticeItem" i],[data-testid*="notification-item" i],[data-testid*="notice-item" i]';
const FIL='mumei_insight_magazine_filter_enabled_v3:',GRP='mumei_insight_notification_groups_v1:',MUT='mumei_insight_magazine_mute_ids_v5:';
const FILTER='https://mumei-s.github.io/note-insight/notification-filter.html?from=note&mumei_return='+encodeURIComponent('https://note.com/notifications');
const INSIGHT='https://mumei-s.github.io/note-insight/notification-entry.html?from=note&insightMode=notifications#dashboard';
const HIDE='mumei-v3-panel-hide-v321';
const clean=v=>String(v||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let shell=null,lastHref=location.href,intentUntil=0,inspectTimer=0,autoStarted=false,pendingRead=false,accountId='',filterLoaded=false,filterOn=false;

function visible(el){if(!(el instanceof Element))return false;const r=el.getBoundingClientRect();if(r.width<1||r.height<1||r.bottom<=0||r.right<=0||r.left>=innerWidth||r.top>=innerHeight)return false;for(let p=el,n=0;p&&n++<14;p=p.parentElement){const s=getComputedStyle(p);if(p.hasAttribute('hidden')||p.getAttribute('aria-hidden')==='true'||p.hasAttribute('inert')||s.display==='none'||s.visibility==='hidden'||Number(s.opacity||1)<=.01)return false}return true}
function text(el){return clean(el?.textContent||el?.getAttribute?.('aria-label')||el?.getAttribute?.('title')||el?.getAttribute?.('data-testid')||'')}
function notificationRoute(){return /^\/notifications(?:\/|$)/i.test(location.pathname)}
function messageContext(){const p=location.pathname.toLowerCase();if(/(?:^|\/)(?:messages?|dm|chat|talk|inbox)(?:\/|$)/i.test(p))return true;for(const el of document.querySelectorAll('textarea,[contenteditable="true"]'))if(visible(el)){const h=clean([...document.querySelectorAll('header,h1,h2,[role="banner"]')].slice(0,24).map(x=>x.textContent).join(' '));if(/(?:メッセージ|トーク|チャット)/u.test(h))return true}return false}
function exactTab(root,label){for(const el of root.querySelectorAll?.('button,a,[role="tab"],[role="button"]')||[])if(visible(el)&&new RegExp('^'+label+'(?:\\s*\\d+)?$','u').test(text(el)))return el;return null}
function commonAncestor(a,b){let p=a,d=0;while(p&&p!==document.body&&p!==document.documentElement&&d++<14){if(p.contains(b)&&visible(p))return p;p=p.parentElement}return null}
function plausibleShell(el){if(!visible(el)||el===document.body||el===document.documentElement)return false;const r=el.getBoundingClientRect();return r.width>=180&&r.height>=80&&r.top<Math.max(360,innerHeight*.62)&&r.height<=innerHeight*1.45}
function expandShell(base){let p=base,d=0,best=null;while(p&&p!==document.body&&p!==document.documentElement&&d++<8){if(plausibleShell(p)){best=p;if(p.matches('[role="dialog"],[role="menu"],[popover],.m-navbarNotice,[class*="notificationList" i],[class*="noticeList" i]'))return p}p=p.parentElement}return best}
function rowCandidate(el){if(!(el instanceof Element)||!visible(el))return false;const t=clean(el.textContent);return t.length>=3&&t.length<=4000}
function rows(root){return root?[...root.querySelectorAll(ITEM)].filter(rowCandidate):[]}
function findShell(){
 if(document.visibilityState==='hidden'||messageContext())return null;
 const route=notificationRoute();
 if(!route&&Date.now()>intentUntil&&!shell)return null;
 for(const root of document.querySelectorAll('[role="dialog"],[role="menu"],[popover],.m-navbarNotice,[class*="notificationList" i],[class*="noticeList" i],header,nav,main')){
  if(!visible(root))continue;const a=exactTab(root,'通知'),b=exactTab(root,'お知らせ');if(a&&b){const found=expandShell(commonAncestor(a,b)||root);if(found)return found}
 }
 const controls=[...document.querySelectorAll('button,a,[role="tab"],[role="button"]')].filter(visible),ns=controls.filter(x=>/^通知(?:\s*\d+)?$/u.test(text(x))),os=controls.filter(x=>/^お知らせ(?:\s*\d+)?$/u.test(text(x)));
 for(const a of ns)for(const b of os){const found=expandShell(commonAncestor(a,b));if(found)return found}
 if(route){for(const el of document.querySelectorAll('main,[role="main"],section'))if(visible(el)&&rows(el).length)return el}
 if(Date.now()<=intentUntil){for(const el of document.querySelectorAll('[role="dialog"],[role="menu"],[popover],section,aside'))if(plausibleShell(el)&&rows(el).length)return el}
 return null;
}
function markShell(next){if(shell&&shell!==next)shell.removeAttribute(SHELL_ATTR);shell=next;if(shell)shell.setAttribute(SHELL_ATTR,'1')}

function retireOld(){for(const id of OLD_IDS){const el=document.getElementById(id);if(!el||el.id===BACKEND)continue;if(id==='mumei-v3-notification-launcher'){el.remove();continue}if(el instanceof HTMLElement){el.style.setProperty('display','none','important');el.style.setProperty('visibility','hidden','important');el.style.setProperty('pointer-events','none','important');el.style.setProperty('width','0px','important');el.style.setProperty('height','0px','important')}}}
function ensureStyle(){if(document.getElementById('mumei-v3-dock-style-v321'))return;const s=document.createElement('style');s.id='mumei-v3-dock-style-v321';s.textContent=`.${HIDE}{display:none!important}#${ROOT}{position:fixed;left:8px;right:8px;bottom:max(10px,calc(env(safe-area-inset-bottom,0px) + 6px));height:34px;z-index:2147483647;display:none;grid-template-columns:repeat(4,minmax(0,1fr));gap:2px;padding:3px;border:1px solid #355063;border-radius:8px;background:#0e1c26;box-shadow:0 -3px 10px rgba(0,0,0,.30);font-family:system-ui,-apple-system,sans-serif;pointer-events:auto;touch-action:manipulation}#${ROOT} button{display:flex;align-items:center;justify-content:center;min-width:0;height:25px;margin:0;padding:0 3px;border:1px solid #42667b;border-radius:6px;background:#102737;color:#e3f8ff;font:900 10px/1 system-ui;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;touch-action:manipulation}#${ROOT} button.on{background:#17422f;border-color:#56a77b}#${ROOT} button.ins{border-color:#55d8f1;background:#11374a}#${ROOT} button.err{border-color:#c95b68;color:#ffd5da}`;(document.head||document.documentElement).appendChild(s)}
function ensureRoot(){let r=document.getElementById(ROOT);if(r)return r;r=document.createElement('div');r.id=ROOT;r.setAttribute('role','toolbar');r.setAttribute('aria-label','INSIGHT 本人通知');r.innerHTML='<button type="button" data-act="read">下から読込</button><button type="button" data-act="filter">フィルターOFF</button><button type="button" data-act="settings">フィルター設定</button><button type="button" class="ins" data-act="ins">INSIGHT【通知】</button>';(document.body||document.documentElement).appendChild(r);bindRoot(r);return r}
function ensureBackend(){let f=document.getElementById(BACKEND);if(f instanceof HTMLIFrameElement)return f;f=document.createElement('iframe');f.id=BACKEND;f.title='INSIGHT 本人通知 読込本体';f.srcdoc='<!doctype html><meta charset="utf-8"><button id="read">下から読込</button><button id="filter">フィルターOFF</button><button id="settings">設定</button><button id="ins">INSIGHT【通知】</button><div id="health"></div>';f.style.cssText='position:fixed!important;left:-10000px!important;top:0!important;width:2px!important;height:2px!important;opacity:0!important;visibility:hidden!important;pointer-events:none!important;border:0!important';(document.body||document.documentElement).appendChild(f);return f}
function backendDoc(){try{return ensureBackend().contentDocument}catch{return null}}
function backendButton(id){return backendDoc()?.getElementById(id)||null}
function backendReady(){const d=backendDoc();return !!(d&&d.documentElement.dataset.mumeiReader2963==='1'&&d.getElementById('read'))}
function uiButton(act){return ensureRoot().querySelector(`[data-act="${act}"]`)}
function showDock(on){const r=ensureRoot();r.style.setProperty('display',on?'grid':'none','important');r.style.setProperty('pointer-events',on?'auto':'none','important');r.dataset.open=on?'1':'0'}
function compactReadLabel(t){t=clean(t);if(/停止→保存中/.test(t))return '保存中…';if(/停止して保存/.test(t))return '■ 停止保存';if(/追加読込/.test(t))return '追加読込';return t||'下から読込'}
function syncRead(){const src=backendButton('read'),dst=uiButton('read');if(!dst)return;if(src){dst.textContent=compactReadLabel(src.textContent);dst.classList.remove('err');dst.dataset.repair=src.dataset.repair||'';const h=clean(backendDoc()?.getElementById('health')?.textContent);if(h)dst.title=h}else if(pendingRead){dst.textContent='準備中…'}}

function modern(){return Boolean(globalThis.GM)}
async function getValue(k,d){try{if(modern()&&typeof GM.getValue==='function')return await GM.getValue(k,d);if(typeof GM_getValue==='function')return GM_getValue(k,d)}catch{}return d}
async function setValue(k,v){try{if(modern()&&typeof GM.setValue==='function')return await GM.setValue(k,v);if(typeof GM_setValue==='function')return GM_setValue(k,v)}catch{}}
async function account(){if(accountId)return accountId;try{const r=await fetch('/api/v2/current_user',{credentials:'include',cache:'no-store'});if(!r.ok)return'';const j=await r.json(),u=(j.data??j).user||(j.data??j),id=clean(u?.urlname||u?.url_name||u?.username).replace(/^@/,'').toLowerCase();if(!/^[a-z0-9_-]+$/.test(id))return'';accountId=id;return id}catch{return''}}
function creatorId(v){try{const u=new URL(String(v||''),location.href),p=u.pathname.split('/').filter(Boolean),id=(p[0]||'').toLowerCase();return u.hostname.endsWith('note.com')&&p.length===1&&/^[a-z0-9_-]+$/.test(id)&&!['settings','sitesettings','membership','notifications'].includes(id)?id:''}catch{return''}}
function rowCreator(el){for(const a of el.querySelectorAll?.('a[href]')||[]){const id=creatorId(a.getAttribute('href'));if(id)return id}return''}
function magazineNoise(t){const s=clean(t);if(/新しい記事を\s*\d+\s*本追加しました/u.test(s))return true;if(!/(?:マガジン|共同運営|共同マガ|運営メンバー)/u.test(s))return false;return /(?:記事を\s*\d+\s*本追加|追加しました|追加されました|仲間入りしました|運営メンバー)/u.test(s)}
function clearFilter(){for(const el of document.querySelectorAll('.'+HIDE))el.classList.remove(HIDE)}
async function filterIds(){const id=await account();if(!id)return new Set();const gs=await getValue(GRP+id,[]);if(Array.isArray(gs)&&gs.length)return new Set(gs.filter(g=>g?.enabled!==false).flatMap(g=>Array.isArray(g?.ids)?g.ids:Array.isArray(g?.members)?g.members.filter(m=>m?.enabled!==false).map(m=>m.id):[]).map(x=>String(x).toLowerCase()).filter(x=>/^[a-z0-9_-]+$/.test(x)));const raw=await getValue(MUT+id,[]);return new Set((Array.isArray(raw)?raw:[]).map(x=>String(x).toLowerCase()).filter(x=>/^[a-z0-9_-]+$/.test(x)))}
function renderFilter(){const b=uiButton('filter');if(b){b.textContent=filterOn?'フィルターON':'フィルターOFF';b.classList.toggle('on',filterOn)}}
async function applyFilter(){clearFilter();renderFilter();if(!filterOn||!shell)return;const ids=await filterIds();if(!ids.size)return;for(const el of rows(shell)){if(magazineNoise(el.textContent)&&ids.has(rowCreator(el)))el.classList.add(HIDE)}}
async function initFilter(){if(filterLoaded){renderFilter();return}const id=await account();filterOn=id?Boolean(await getValue(FIL+id,false)):false;filterLoaded=true;renderFilter();if(filterOn)await applyFilter()}
async function toggleFilter(){await initFilter();filterOn=!filterOn;const id=await account();if(id)await setValue(FIL+id,filterOn);await applyFilter()}
async function openInsight(){const id=await account(),u=new URL(INSIGHT);if(id)u.searchParams.set('account',id);window.location.assign(u.href)}
function openSettings(){showDock(false);window.location.assign(FILTER+'&v=321&ts='+Date.now())}
function requestRead(){const b=backendButton('read');if(!b||!backendReady()){pendingRead=true;const v=uiButton('read');if(v)v.textContent='準備中…';window.dispatchEvent(new Event('focus'));return}pendingRead=false;b.click();setTimeout(syncRead,20)}

function bindRoot(root){if(root.dataset.bound==='1')return;root.dataset.bound='1';for(const type of['pointerdown','mousedown','touchstart','touchend','pointerup'])root.addEventListener(type,e=>{e.stopPropagation()},{capture:true,passive:true});root.addEventListener('click',e=>{const b=e.target instanceof Element?e.target.closest('button[data-act]'):null;if(!b)return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();const a=b.dataset.act;if(a==='read'){requestRead();return}if(a==='filter'){void toggleFilter();return}if(a==='settings'){openSettings();return}if(a==='ins'){void openInsight()}},true)}
async function tryAutoStart(){if(!shell||autoStarted||!backendReady())return;const b=backendButton('read');if(!b)return;const t=clean(b.textContent);if(!/(?:下から読込|追加読込)/u.test(t)||b.dataset.repair==='1')return;autoStarted=true;await sleep(180);if(shell&&visible(shell)){b.click();syncRead()}}
function coreReady(){return backendReady()}

function isBellClick(target){const hit=target instanceof Element?target.closest('button,a,[role="button"],[role="tab"]'):null;if(!hit||ROOT===hit.id||hit.closest('#'+ROOT))return false;const r=hit.getBoundingClientRect();if(r.top>210||r.bottom<0)return false;const meta=clean([hit.getAttribute('aria-label'),hit.getAttribute('title'),hit.getAttribute('data-testid'),hit.id,hit.className].join(' '));if(/(?:notification|notice|通知|お知らせ)/i.test(meta)&&!/setting|filter/i.test(meta))return true;if(hit.querySelector('svg')&&!hit.querySelector('img')){for(const x of hit.querySelectorAll('span,div'))if(/^\d{1,3}$/.test(clean(x.textContent)))return true}return false}
function topClick(e){if(!isBellClick(e.target))return;intentUntil=Date.now()+5000;for(const ms of[20,70,140,260,500,900,1500])setTimeout(inspect,ms)}
function inspect(){retireOld();ensureBackend();const next=findShell();if(next!==shell){markShell(next);autoStarted=false}const open=!!shell;showDock(open);if(!open){clearFilter();syncRead();return}void initFilter();if(filterOn)void applyFilter();if(coreReady()){if(pendingRead){pendingRead=false;requestRead()}void tryAutoStart()}syncRead()}
function schedule(ms=40){clearTimeout(inspectTimer);inspectTimer=setTimeout(inspect,ms)}
function routeChanged(){if(location.href===lastHref)return;lastHref=location.href;intentUntil=0;markShell(null);showDock(false);autoStarted=false;clearFilter();schedule(0)}
function installRouteWatch(){for(const name of['pushState','replaceState']){const orig=history[name];if(typeof orig!=='function'||orig.__mumeiDock321Wrapped)continue;const fn=function(){const out=orig.apply(this,arguments);queueMicrotask(routeChanged);return out};fn.__mumeiDock321Wrapped=true;history[name]=fn}addEventListener('popstate',routeChanged);addEventListener('hashchange',routeChanged)}
function boot(){ensureStyle();ensureRoot();ensureBackend();retireOld();installRouteWatch();inspect();document.addEventListener('click',topClick,true);document.addEventListener('mumei-v3-core-ready',()=>{schedule(0);setTimeout(syncRead,80)});new MutationObserver(()=>schedule(60)).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','aria-hidden','class','style']});addEventListener('pageshow',()=>schedule(80));addEventListener('focus',()=>schedule(80));document.addEventListener('visibilitychange',()=>schedule(40));setInterval(()=>{routeChanged();inspect();syncRead()},300)}
if(document.body)boot();else document.addEventListener('DOMContentLoaded',boot,{once:true});
})();
