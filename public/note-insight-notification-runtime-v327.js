(function(){
'use strict';
if(location.hostname!=='note.com')return;
window.__mumeiNotificationDock322=true;
window.__mumeiNotificationRuntime325=true;
window.__mumeiNotificationRuntime327=true;
if(window.__mumeiNotificationRuntime328)return;window.__mumeiNotificationRuntime328=true;
const VERSION='3.2.77';
const HOST='mumei-v325-dock-host',ROOT='mumei-v325-dock',SETTINGS='mumei-v325-filter-settings',READ_MENU='mumei-v325-read-choice',HIDE='mumei-v325-filter-hide';
const BOUNDARY='mumei-v3-saved-boundary-v3223',PROGRESS='mumei-v3-reader-progress-v3223';
const FIL='mumei_insight_magazine_filter_enabled_v3:',GRP='mumei_insight_notification_groups_v1:',MUT='mumei_insight_magazine_mute_ids_v5:',AUTO='mumei_insight_notification_auto_v325:',ENABLED='mumei_insight_notification_feature_enabled_v1';
const ITEM='.m-navbarNoticeItem,[class*="navbarNoticeItem" i],[class*="notificationItem" i],[class*="noticeItem" i],[class*="notification-item" i],[class*="notice-item" i],[data-testid*="notification-item" i],[data-testid*="notice-item" i]';
const clean=v=>String(v||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
const modern=()=>Boolean(globalThis.GM);
let shell=null,accountId='',filterOn=false,filterLoaded=false,autoMode=true,modeLoaded=false,autoDoneForSession=false,featureEnabled=true,enabledLoaded=false;
const profileCache=new Map();
let dockVisible=false,panelSessionActive=false,inspectTimer=0,hideTimer=0,filterTimer=0,intentUntil=0,suppressUntilBell=false,settingsNavStarted=false,notificationSurfaceLeaseUntil=0,notificationSurfaceLeaseRoute='';
async function get(k,d){try{if(modern()&&typeof GM.getValue==='function')return await GM.getValue(k,d);if(typeof GM_getValue==='function')return GM_getValue(k,d)}catch{}return d}
async function set(k,v){try{if(modern()&&typeof GM.setValue==='function')return await GM.setValue(k,v);if(typeof GM_setValue==='function')return GM_setValue(k,v)}catch{}}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function visible(el){if(!(el instanceof Element))return false;const r=el.getBoundingClientRect();if(r.width<1||r.height<1||r.right<=0||r.bottom<=0||r.left>=innerWidth||r.top>=innerHeight)return false;for(let p=el,d=0;p&&d++<14;p=p.parentElement){const s=getComputedStyle(p);if(p.hidden||p.getAttribute('aria-hidden')==='true'||p.hasAttribute('inert')||s.display==='none'||s.visibility==='hidden'||Number(s.opacity||1)<=.01)return false}return true}
function text(el){return clean(el?.textContent||el?.getAttribute?.('aria-label')||el?.getAttribute?.('title')||'')}
function rowish(el){if(!visible(el))return false;const t=text(el);return t.length>=3&&t.length<=5000&&/(?:たった今|昨日|秒前|分前|時間前|日前|週間前|スキ|フォロー|コメント|返信|追加|メンバー|購入|通知)/u.test(t)}
function noticeRows(root){if(!root?.querySelectorAll)return[];const xs=[...root.querySelectorAll(ITEM)].filter(rowish);return xs.filter(el=>!xs.some(o=>o!==el&&o.contains(el)))}
function rows(root){if(!root?.querySelectorAll)return[];const specific=noticeRows(root);if(specific.length)return specific;let xs=[...root.querySelectorAll('li,[role="listitem"]')].filter(rowish);return xs.filter(el=>!xs.some(o=>o!==el&&o.contains(el)))}
function exact(root,label){return[...(root?.querySelectorAll?.('button,a,[role="tab"],[role="button"]')||[])].find(el=>{if(!visible(el))return false;const t=text(el);return t===label||new RegExp('^'+label+'(?:\\s*\\d+\\s*(?:件)?)?$','u').test(t)})||null}
function common(a,b){let p=a;for(let i=0;p&&p!==document.body&&i<14;i++,p=p.parentElement)if(p.contains(b))return p;return null}
function expand(base){let p=base,best=null;for(let i=0;p&&p!==document.body&&p!==document.documentElement&&i<12;i++,p=p.parentElement){if(!visible(p))continue;if(rows(p).length)best=p;if(p.matches?.('[role="dialog"],[role="menu"],[popover],main,[role="main"],section,aside')&&(rows(p).length||/(?:通知|お知らせ)/u.test(text(p))))return p}return best}
function notificationRoute(){return /^\/notifications(?:\/|$)/i.test(location.pathname)}
function textEditorElement(el){
  if(!(el instanceof Element))return false;
  if(el.closest('#'+ROOT)||el.closest('#'+SETTINGS))return false;
  if(el.matches('textarea,[contenteditable="true"],[role="textbox"]'))return true;
  if(el.matches('input:not([type]),input[type="text"],input[type="search"],input[type="email"],input[type="url"],input[type="tel"],input[type="password"]'))return true;
  return Boolean(el.closest('textarea,[contenteditable="true"],[role="textbox"],input:not([type]),input[type="text"],input[type="search"],input[type="email"],input[type="url"],input[type="tel"],input[type="password"]'))
}
function editingOutsideNotification(){
  const el=document.activeElement;
  if(!textEditorElement(el)||notificationRoute())return false;
  const owner=el?.closest?.('[role="dialog"],[role="menu"],[popover],[class*="notification" i],[class*="notice" i]');
  return !Boolean(owner&&strongNoticeSurface(owner))
}
function hasNoticeTabs(root){return Boolean(exact(root,'通知')&&exact(root,'お知らせ'))}
function strongNoticeSurface(root){
  if(!root||!visible(root))return false;
  const specific=noticeRows(root);
  if(notificationRoute())return Boolean(hasNoticeTabs(root)||specific.length);
  if(hasNoticeTabs(root)&&specific.length)return true;
  return Boolean(specific.length&&root.matches?.('[role="dialog"],[role="menu"],[popover],[class*="notification" i],[class*="notice" i]'))
}
function popupSurface(){
  if(document.visibilityState==='hidden'||notificationRoute())return null;
  for(const root of document.querySelectorAll('[role="dialog"],[role="menu"],[popover],[class*="notification" i],[class*="notice" i],main,section,aside,nav')){
    if(strongNoticeSurface(root))return root
  }
  for(const row of [...document.querySelectorAll(ITEM)].filter(visible)){
    let p=row.parentElement;
    for(let depth=0;p&&p!==document.body&&p!==document.documentElement&&depth<10;depth++,p=p.parentElement){
      if(strongNoticeSurface(p))return p
    }
  }
  return null
}
function routeSurface(){
  if(!notificationRoute())return null;
  for(const el of document.querySelectorAll('main,[role="main"],section,aside'))if(strongNoticeSurface(el))return el;
  return null
}
function trustedBellSurface(){
  if(!panelSessionActive||(!bellIntent()&&!notificationRoute()))return null;
  if(notificationRoute()){
    for(const el of document.querySelectorAll('main,[role="main"],section,aside')){
      if(!visible(el))continue;
      if(hasNoticeTabs(el)||rows(el).length)return el
    }
    return null
  }
  const roots=[...document.querySelectorAll('[role="dialog"],[role="menu"],[popover],main,section,aside,nav')].filter(visible);
  for(const root of roots){
    const a=exact(root,'通知'),b=exact(root,'お知らせ');
    if(!a||!b)continue;
    const x=expand(common(a,b)||root);
    if(x)return x;
    if(rows(root).length)return root
  }
  return null
}
function findSurface(){return popupSurface()||routeSurface()||trustedBellSurface()}
function bellIntent(){return !editingOutsideNotification()&&Date.now()<intentUntil}
function bellMeta(el){if(!(el instanceof Element))return'';return clean([el.textContent,el.getAttribute('aria-label'),el.getAttribute('title'),el.getAttribute('data-testid'),el.id,typeof el.className==='string'?el.className:''].join(' '))}
function bellHit(el){if(!(el instanceof Element)||el.closest('#'+ROOT)||el.closest('#'+SETTINGS))return false;const href=String(el.getAttribute('href')||''),meta=bellMeta(el);if(/\/notifications(?:[/?#]|$)/i.test(href))return true;if(/(?:notification|notice|通知|お知らせ|bell)/iu.test(meta)&&!/setting|filter/i.test(meta))return true;return false}
function bellTrigger(target,event){const seen=new Set(),xs=[];const add=el=>{if(el instanceof Element&&!seen.has(el)){seen.add(el);xs.push(el)}};add(target);for(const x of event?.composedPath?.()||[])add(x);for(const raw of xs.slice(0,20)){add(raw.closest?.('button,a,[role="button"],[role="tab"],[aria-label],[data-testid]'));if(bellHit(raw))return true}return xs.some(bellHit)}
function notificationBellElement(){
  const direct='a[href*="/notifications"],[aria-label*="通知"],[aria-label*="お知らせ"],[title*="通知"],[title*="お知らせ"],[data-testid*="notification" i],[data-testid*="notice" i]';
  for(const el of document.querySelectorAll(direct)){const hit=el.matches('button,a,[role="button"],[role="tab"]')?el:el.closest('button,a,[role="button"],[role="tab"]');if(hit&&visible(hit)&&!hit.closest('#'+ROOT))return hit}
  for(const el of document.querySelectorAll('header button,header a,nav button,nav a,button,[role="button"],[role="tab"]'))if(visible(el)&&bellHit(el))return el;
  for(const el of document.querySelectorAll('header button,header [role="button"],nav button,nav [role="button"]')){
    if(!visible(el)||el.closest('#'+ROOT))continue;
    const r=el.getBoundingClientRect(),t=clean(el.textContent);
    if(r.top<180&&el.querySelector('svg')&&/^\d{1,3}$/.test(t))return el
  }
  return null
}
function openNotificationBell(){
  suppressUntilBell=false;
  if(findSurface()){autoDoneForSession=false;return true}
  const el=notificationBellElement();if(!el)return false;
  autoDoneForSession=false;intentUntil=Date.now()+7000;
  try{el.click()}catch{return false}
  for(const ms of[0,80,180,360,700,1200,2200])setTimeout(()=>scheduleInspect(0),ms);
  return true
}
function independentDockHost(){let host=document.getElementById(HOST);if(host)return host;host=document.createElement('div');host.id=HOST;(document.body||document.documentElement).appendChild(host);return host}
function mountUiInSurface(){const host=independentDockHost();const r=document.getElementById(ROOT);if(r&&r.parentElement!==host)host.appendChild(r);const p=document.getElementById(SETTINGS);if(p&&p.parentElement!==host)host.appendChild(p)}
function markSurface(next){if(shell&&shell!==next)shell.removeAttribute('data-mumei-notice-shell-v3');shell=next;if(shell)shell.setAttribute('data-mumei-notice-shell-v3','1')}
function panelEvent(e){const path=e?.composedPath?.()||[];return path.some(node=>node instanceof Element&&(node.id===HOST||node.id===ROOT||node.id===SETTINGS||node.id===READ_MENU))}
function notificationRouteKey(){return location.pathname+location.search}
function notificationVisibleNow(){const api=reader();const scanning=Boolean(api&&typeof api.isScanning==='function'&&api.isScanning());const leased=scanning&&Date.now()<notificationSurfaceLeaseUntil&&notificationSurfaceLeaseRoute===notificationRouteKey();return Boolean(notificationRoute()||popupSurface()||leased)}
function routeLifecycle(){
  intentUntil=0;
  const next=popupSurface();
  if(notificationRoute()){
    suppressUntilBell=false;panelSessionActive=true;
    showRoot(true);
    scheduleInspect(20);setTimeout(()=>scheduleInspect(0),320);
    return
  }
  if(next){
    suppressUntilBell=false;panelSessionActive=true;
    void activate(next);
    return
  }
  notificationSurfaceLeaseUntil=0;notificationSurfaceLeaseRoute='';
  hideImmediately()
}
async function account(){if(accountId)return accountId;try{const r=await fetch('/api/v2/current_user',{credentials:'include',cache:'no-store'});if(!r.ok)return'';const j=await r.json(),u=(j.data??j).user||(j.data??j),id=clean(u?.urlname||u?.url_name||u?.username).replace(/^@/,'').toLowerCase();if(/^[a-z0-9_-]+$/.test(id))accountId=id}catch{}return accountId}
function ensureStyle(){if(document.getElementById(ROOT+'-style'))return;const s=document.createElement('style');s.id=ROOT+'-style';s.textContent=`#${HOST}{position:fixed!important;inset:0!important;z-index:2147483646!important;pointer-events:none!important;background:transparent!important}#${HOST}>#${ROOT},#${HOST}>#${SETTINGS}{pointer-events:auto!important}.${HIDE}{display:none!important}#${ROOT}{position:fixed!important;left:8px!important;right:8px!important;bottom:calc(env(safe-area-inset-bottom,0px) + 10px)!important;z-index:2147483647!important;height:38px!important;display:none;grid-template-columns:minmax(54px,.72fr) minmax(46px,.62fr) minmax(70px,1fr) minmax(48px,.66fr) minmax(68px,.9fr);gap:3px;padding:4px;border:1px solid #355063;border-radius:9px;background:#0e1c26;box-shadow:0 -3px 10px #0006;box-sizing:border-box!important;font-family:system-ui,-apple-system,sans-serif}#${ROOT} button{min-width:0;height:28px;padding:0 4px;border:1px solid #42667b;border-radius:6px;background:#102737;color:#e3f8ff;font:900 9.5px/1 system-ui;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#${ROOT} button.mode.auto{background:#17422f;border-color:#56a77b;color:#d6ffe7}#${ROOT} button.mode.manual{background:#3c2c10;border-color:#92712f;color:#ffe8ad}#${ROOT} button.on{background:#17422f;border-color:#56a77b}#${ROOT} button.ins{border-color:#55d8f1;background:#11374a}#${ROOT} button.err{border-color:#c95b68;color:#ffd5da}#${SETTINGS}{position:fixed!important;left:8px!important;right:8px!important;bottom:calc(env(safe-area-inset-bottom,0px) + 54px)!important;z-index:2147483647!important;max-height:68vh!important;overflow:auto!important;overscroll-behavior:contain!important;touch-action:pan-y!important;-webkit-overflow-scrolling:touch!important;padding:10px!important;border:1px solid #49687d!important;border-radius:11px!important;background:#07131d!important;color:#e8f6ff!important;box-shadow:0 12px 30px #000c!important;font:850 11px/1.4 system-ui!important}#${SETTINGS} h3{margin:0 0 8px;font-size:14px}#${SETTINGS} .g{border:1px solid #2d4b60;border-radius:9px;background:#0a1924;padding:8px;margin:7px 0}#${SETTINGS} .gh{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:6px;align-items:center}#${SETTINGS} input[type=text]{width:100%;height:34px;border:1px solid #3f5f74;border-radius:7px;background:#0b1b27;color:#fff;padding:0 8px}#${SETTINGS} button{min-height:32px;border:1px solid #4a6a80;border-radius:7px;background:#112a3a;color:#dff7ff;font-weight:900}#${SETTINGS} .members{display:grid;gap:5px;margin-top:7px}#${SETTINGS} .m{display:grid;grid-template-columns:minmax(0,1fr) 54px;gap:5px;align-items:center}#${SETTINGS} .who{display:grid;grid-template-columns:34px minmax(0,1fr);gap:7px;align-items:center;min-width:0}#${SETTINGS} .avatar{width:34px;height:34px;border-radius:50%;object-fit:cover;background:#142634;border:1px solid #35576d}#${SETTINGS} .who-txt{min-width:0}#${SETTINGS} .nick{font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#${SETTINGS} .uid{font-size:10px;color:#9db3c2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#${SETTINGS} .add{display:grid;grid-template-columns:minmax(0,1fr) 58px;gap:5px;margin-top:7px}#${SETTINGS} .footer{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px}#${READ_MENU}{position:fixed!important;left:8px!important;right:8px!important;bottom:calc(env(safe-area-inset-bottom,0px) + 54px)!important;z-index:2147483647!important;display:grid!important;grid-template-columns:1fr 1fr!important;gap:6px!important;padding:7px!important;border:1px solid #49687d!important;border-radius:10px!important;background:#07131d!important;box-shadow:0 10px 24px #000b!important;pointer-events:auto!important}#${READ_MENU} button{min-height:38px!important;border:1px solid #42667b!important;border-radius:8px!important;background:#102737!important;color:#e3f8ff!important;font:900 11px/1.15 system-ui!important}#${READ_MENU} button[data-mode="full"]{border-color:#9a7b31!important;background:#2a2108!important;color:#ffe6a0!important}#${READ_MENU} small{grid-column:1/-1;color:#a9bdc9;font:800 9px/1.25 system-ui;text-align:center}`;(document.head||document.documentElement).appendChild(s)}
function runPrimaryDockAction(b){const a=b?.dataset?.a;if(a==='read')openReadChoice();else if(a==='mode')void toggleMode();else if(a==='filter')void toggleFilter()}
function runDockAction(b){const a=b?.dataset?.a;if(a==='read')openReadChoice();else if(a==='mode')void toggleMode();else if(a==='filter')void toggleFilter();else if(a==='settings')void openSettings();else if(a==='ins')void openInsight()}
function ensureRoot(){let r=document.getElementById(ROOT),host=independentDockHost();if(r){if(r.parentElement!==host)host.appendChild(r);return r}r=document.createElement('div');r.id=ROOT;r.innerHTML='<button type="button" data-a="read">読込</button><button type="button" class="mode auto" data-a="mode">自動</button><button type="button" data-a="filter">フィルター</button><button type="button" data-a="settings">設定</button><button type="button" class="ins" data-a="ins">INSIGHT</button>';host.appendChild(r);
const actionButton=e=>{const b=e.target instanceof Element?e.target.closest('button[data-a]'):null;if(!b)return null;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();return b};
for(const type of['pointerdown','mousedown','touchstart','click'])r.addEventListener(type,e=>{actionButton(e)},true);
r.addEventListener('pointerup',e=>{const b=actionButton(e);if(b)runDockAction(b)},true);
return r}
function closeReadChoice(){document.getElementById(READ_MENU)?.remove()}
function openReadChoice(){
 if(!dockVisible||!notificationVisibleNow())return;
 closeReadChoice();
 const host=independentDockHost(),m=document.createElement('div');m.id=READ_MENU;
 m.innerHTML='<button type="button" data-mode="continue">続きから読む</button><button type="button" data-mode="full">全読み</button><small>全読み＝読み込み停止期間の取りこぼし回収。保存済みも再照合します</small>';
 m.addEventListener('click',e=>{const b=e.target instanceof Element?e.target.closest('button[data-mode]'):null;if(!b)return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();const mode=b.dataset.mode==='full'?'full':'continue';closeReadChoice();const read=document.querySelector('#'+ROOT+' [data-a="read"]');if(read instanceof HTMLButtonElement)void manualRead(read,mode)},true);
 host.appendChild(m)
}
function showRoot(on){const routeOn=notificationRoute();const want=Boolean(on&&featureEnabled&&(routeOn||(panelSessionActive&&notificationVisibleNow())));dockVisible=want;if(!featureEnabled){document.getElementById(HOST)?.remove();return}const r=ensureRoot();r.style.setProperty('display',want?'grid':'none','important');if(!want){document.getElementById(SETTINGS)?.remove();closeReadChoice()}}
function cleanupVisuals(){document.getElementById(BOUNDARY)?.remove();const p=document.getElementById(PROGRESS);if(p){if(p.style.display!=='none')p.style.setProperty('display','none','important');if(p.textContent)p.textContent=''}document.getElementById(SETTINGS)?.remove();closeReadChoice()}
function clearFeatureHides(){for(const el of document.querySelectorAll('.'+HIDE))el.classList.remove(HIDE)}
async function initEnabled(){if(enabledLoaded)return featureEnabled;featureEnabled=Boolean(await get(ENABLED,true));enabledLoaded=true;return featureEnabled}
function disableFeatureNow(){
  intentUntil=0;
  if(inspectTimer){clearTimeout(inspectTimer);inspectTimer=0}
  if(hideTimer){clearTimeout(hideTimer);hideTimer=0}
  if(filterTimer){clearTimeout(filterTimer);filterTimer=0}
  markSurface(null);
  panelSessionActive=false;
  dockVisible=false;
  document.getElementById(HOST)?.remove();
  clearFeatureHides();
  cleanupVisuals()
}
async function setFeatureEnabled(v){
  featureEnabled=Boolean(v);enabledLoaded=true;await set(ENABLED,featureEnabled);
  if(!featureEnabled){disableFeatureNow();return false}
  suppressUntilBell=true;panelSessionActive=false;showRoot(false);scheduleInspect(0);return true
}
function getFeatureEnabled(){return featureEnabled}
function leavingNotificationHref(target){
  const a=target instanceof Element?target.closest('a[href]'):null;
  if(!a||a.closest('#'+ROOT)||a.closest('#'+SETTINGS))return false;
  try{
    const u=new URL(a.getAttribute('href'),location.href);
    if(u.origin!==location.origin)return true;
    return !/^\/notifications(?:\/|$)/i.test(u.pathname)
  }catch{return false}
}
function notificationLeaveAction(target){
  if(!(target instanceof Element)||!shell||!shell.contains(target))return false;
  if(target.closest('#'+ROOT)||target.closest('#'+SETTINGS))return false;
  if(leavingNotificationHref(target))return true;
  const ctl=target.closest('button,[role="button"],[role="tab"]'),label=clean(ctl?.textContent||'');
  if(label==='通知'||label==='お知らせ')return false;
  const row=target.closest(ITEM+',li,[role="listitem"]');
  return Boolean(row&&shell.contains(row)&&rowish(row))
}
function hideImmediately(){
  notificationSurfaceLeaseUntil=0;notificationSurfaceLeaseRoute='';
  suppressUntilBell=true;
  panelSessionActive=false;
  intentUntil=0;
  markSurface(null);
  dockVisible=false;
  const r=document.getElementById(ROOT);if(r)r.style.setProperty('display','none','important');
  cleanupVisuals()
}
function onShellPointerDown(e){
  if(!featureEnabled||!shell)return;
  const target=e.target instanceof Element?e.target:null;
  if(notificationLeaveAction(target))hideImmediately()
}
function profileIdFromHref(href){try{const u=new URL(href,location.href),p=u.pathname.split('/').filter(Boolean),id=(p[0]||'').toLowerCase();return u.hostname.endsWith('note.com')&&p.length===1&&/^[a-z0-9_-]+$/.test(id)&&!['notifications','settings','sitesettings','membership'].includes(id)?id:''}catch{return''}}
function creatorIds(el){const out=[];for(const a of el.querySelectorAll?.('a[href]')||[]){const id=profileIdFromHref(a.getAttribute('href'));if(id)out.push(id)}return[...new Set(out)]}
function labelKey(v){return clean(v).toLowerCase().replace(/[.…⋯]+/gu,'').replace(/[\s　]+/gu,'')}
function leadDisplayName(el){const s=clean(el?.textContent||''),m=s.match(/^(.{1,160}?)さん(?:他\s*\d+\s*名)?が/u);return m?clean(m[1]):''}
function profileCandidates(el){const out=[];for(const a of el.querySelectorAll?.('a[href]')||[]){const id=profileIdFromHref(a.getAttribute('href'));if(!id)continue;const r=a.getBoundingClientRect?.()||{top:0,left:0,width:0,height:0};const imgs=[...(a.querySelectorAll?.('img[alt]')||[])].map(img=>img.getAttribute('alt')||'');const label=clean([a.textContent,a.getAttribute('aria-label'),a.getAttribute('title'),...imgs].join(' '));out.push({id,label,top:Number(r.top)||0,left:Number(r.left)||0,visibleBox:Number(r.width)>0&&Number(r.height)>0})}return out}
function leadCreatorId(el){const cs=profileCandidates(el);if(!cs.length)return'';const lead=labelKey(leadDisplayName(el));if(lead.length>=2){for(const c of cs){const k=labelKey(c.label);if(k.length>=2&&(k.startsWith(lead)||lead.startsWith(k)))return c.id}}const visual=cs.filter(c=>c.visibleBox).sort((a,b)=>Math.abs(a.top-b.top)>6?a.top-b.top:a.left-b.left);return(visual[0]||cs[0]).id}
function magazineNoise(v){const s=clean(v);return(/(?:共同)?マガジン/u.test(s)&&/(?:新しい記事|記事を|追加しました|追加されました|仲間入りしました|運営メンバー|投稿しました)/u.test(s))||/新しい記事を\s*\d+\s*本?追加しました/u.test(s)}
function filterRowish(el){const t=text(el);return t.length>=3&&t.length<=5000&&/(?:たった今|昨日|秒前|分前|時間前|日前|週間前|スキ|フォロー|コメント|返信|追加|メンバー|購入|通知)/u.test(t)}
function filterRows(root){if(!root?.querySelectorAll)return[];let xs=[...root.querySelectorAll(ITEM)].filter(filterRowish);if(xs.length)return xs.filter(el=>!xs.some(o=>o!==el&&o.contains(el)));xs=[...root.querySelectorAll('li,[role="listitem"]')].filter(filterRowish);return xs.filter(el=>!xs.some(o=>o!==el&&o.contains(el)))}
function normalizeGroups(raw){return(Array.isArray(raw)?raw:[]).map((g,i)=>{const src=Array.isArray(g?.ids)?g.ids:Array.isArray(g?.members)?g.members.filter(m=>m?.enabled!==false).map(m=>m?.id):[];return{name:clean(g?.name)||`グループ ${i+1}`,enabled:g?.enabled!==false,ids:[...new Set(src.map(x=>clean(x).replace(/^@/,'').toLowerCase()).filter(x=>/^[a-z0-9_-]+$/.test(x)))]}})}
async function readGroups(){const id=await account();if(!id)return[];let gs=normalizeGroups(await get(GRP+id,[]));if(!gs.length){const legacy=await get(MUT+id,[]);if(Array.isArray(legacy)&&legacy.length)gs=[{name:'通知フィルター',enabled:true,ids:[...new Set(legacy.map(String).map(x=>x.toLowerCase()).filter(x=>/^[a-z0-9_-]+$/.test(x)))]}]}return gs}
async function saveGroups(gs){const id=await account();if(!id)return;const safe=normalizeGroups(gs);await set(GRP+id,safe);await set(MUT+id,[...new Set(safe.filter(g=>g.enabled).flatMap(g=>g.ids))]);filterOn=Boolean(await get(FIL+id,false));await applyFilter()}
async function initFilter(){if(filterLoaded)return;const id=await account();filterOn=id?Boolean(await get(FIL+id,false)):false;filterLoaded=true;paintFilter()}
function paintFilter(){if(suppressUntilBell||!featureEnabled)return;const r=document.getElementById(ROOT);if(!r)return;const b=r.querySelector('[data-a="filter"]');if(!b)return;b.textContent=filterOn?'F ON':'フィルター';b.classList.toggle('on',filterOn)}
async function applyFilter(){if(!shell||!visible(shell))return;paintFilter();const gs=filterOn?await readGroups():[],ids=new Set(gs.filter(g=>g.enabled).flatMap(g=>g.ids));for(const el of filterRows(shell)){const lead=filterOn?leadCreatorId(el):'';el.classList.toggle(HIDE,Boolean(filterOn&&lead&&ids.has(lead)))}}
function scheduleFilter(){clearTimeout(filterTimer);filterTimer=setTimeout(()=>void applyFilter(),140)}
async function toggleFilter(){await initFilter();filterOn=!filterOn;const id=await account();if(id)await set(FIL+id,filterOn);paintFilter();await applyFilter()}
function parseId(v){const raw=clean(v);if(!raw)return'';try{const u=new URL(/^https?:\/\//i.test(raw)?raw:`https://note.com/${raw.replace(/^@/,'')}`),id=(u.pathname.split('/').filter(Boolean)[0]||'').toLowerCase();return u.hostname==='note.com'&&/^[a-z0-9_-]+$/.test(id)?id:''}catch{return''}}
async function creatorProfile(id){
  const key=String(id||'').toLowerCase();
  if(profileCache.has(key))return profileCache.get(key);
  const task=(async()=>{
    try{
      const r=await fetch('/api/v2/creators/'+encodeURIComponent(key),{credentials:'include',cache:'no-store'});
      if(!r.ok)throw new Error('profile '+r.status);
      const j=await r.json(),d=j?.data??j??{};
      return{id:key,nickname:clean(d.nickname||d.name||key),profileImageUrl:clean(d.profileImageUrl||d.profile_image_url||d.avatarUrl||'')}
    }catch{return{id:key,nickname:key,profileImageUrl:''}}
  })();
  profileCache.set(key,task);
  return task
}
async function openSettings(){
  if(!dockVisible)return false;
  closeReadChoice();
  const id=await account();
  if(!id)return false;
  try{
    sessionStorage.removeItem('mumei-v3-notification-return-v3268');
    sessionStorage.removeItem('mumei-v3-notification-return-v3223');
  }catch{}
  intentUntil=0;
  panelSessionActive=false;
  markSurface(null);
  showRoot(false);
  cleanupVisuals();
  const u=new URL('https://mumei-s.github.io/note-insight/notification-filter-settings.html');
  u.searchParams.set('notificationAccount',id);
  u.searchParams.set('ts',String(Date.now()));
  location.replace(u.href);
  return true
}
async function initMode(){if(modeLoaded)return;const id=await account();autoMode=id?Boolean(await get(AUTO+id,true)):true;modeLoaded=true;paintMode()}
function paintMode(){if(suppressUntilBell||!featureEnabled)return;const r=document.getElementById(ROOT);if(!r)return;const b=r.querySelector('[data-a="mode"]');if(!b)return;b.textContent=autoMode?'自動':'手動';b.classList.toggle('auto',autoMode);b.classList.toggle('manual',!autoMode);b.title=autoMode?'自動読み込みON。タップで手動へ':'自動読み込みOFF。タップで自動へ'}
async function toggleMode(){await initMode();autoMode=!autoMode;const id=await account();if(id)await set(AUTO+id,autoMode);paintMode();if(autoMode)maybeAuto(true)}
function reader(){return window.__mumeiV3Reader323||window.__mumeiV3Reader322||null}
async function waitForRows(timeout=5000){const end=Date.now()+timeout;while(Date.now()<end){const current=findSurface();if(current&&rows(current).length)return current;if(!notificationRoute()&&!popupSurface()&&!bellIntent())return null;await sleep(120)}return null}
async function safeScan(mode='continue'){const current=await waitForRows();if(!current)return 0;if(current!==shell)markSurface(current);showRoot(true);await window.__mumeiV3Checkpoint325?.restore?.();const again=await waitForRows(1200);if(!again)return 0;const api=reader();if(!api||typeof api.scan!=='function')throw new Error('通知Readerを起動できませんでした');return api.scan(mode==='full'?'full':'continue')}
async function manualRead(btn,mode='continue'){btn.classList.remove('err');btn.textContent=mode==='full'?'全読待機':'待機';try{const current=await waitForRows();if(!current){btn.textContent='読込';return}btn.textContent=mode==='full'?'全読中':'読込中';notificationSurfaceLeaseUntil=Date.now()+60000;notificationSurfaceLeaseRoute=notificationRouteKey();await safeScan(mode)}catch(e){btn.classList.add('err');btn.textContent=mode==='full'?'全読再試行':'再読込';btn.title=String(e?.message||e)}}
function hideProgress(){const p=document.getElementById(PROGRESS);if(p)p.style.setProperty('display','none','important')}
function onStatus(e){if(!featureEnabled||!panelSessionActive)return;const d=e.detail||{};if(d.scanning&&notificationSurfaceLeaseRoute===notificationRouteKey())notificationSurfaceLeaseUntil=Date.now()+60000;showRoot(true);const r=document.getElementById(ROOT);if(!r)return;const b=r.querySelector('[data-a="read"]');if(!b)return;b.classList.toggle('err',d.kind==='error');b.textContent=d.scanning?(d.mode==='full'?'全読中':'読込中'):d.kind==='error'?(d.mode==='full'?'全読再試行':'再読込'):'読込';if(d.message)b.title=String(d.message)}
async function openInsight(){closeReadChoice();const id=await account(),u=new URL('https://mumei-s.github.io/note-insight/?insightMode=notifications#dashboard');if(id)u.searchParams.set('notificationAccount',id);intentUntil=0;panelSessionActive=false;markSurface(null);showRoot(false);cleanupVisuals();location.assign(u.href)}
function maybeAuto(force=false){
  if(!autoMode||autoDoneForSession||!shell||!visible(shell)||!rows(shell).length)return;
  const api=reader();
  if(!api||typeof api.scan!=='function'||typeof api.isScanning==='function'&&api.isScanning())return;
  autoDoneForSession=true;
  setTimeout(()=>{
    const current=findSurface();
    if(autoMode&&current&&rows(current).length&&!(typeof api.isScanning==='function'&&api.isScanning()))void safeScan('continue').catch(()=>{})
  },220)
}
async function activate(next){if(!await initEnabled()||suppressUntilBell)return;panelSessionActive=true;notificationSurfaceLeaseUntil=Date.now()+60000;notificationSurfaceLeaseRoute=notificationRouteKey();clearTimeout(hideTimer);hideTimer=0;markSurface(next);showRoot(true);await Promise.all([initFilter(),initMode()]);scheduleFilter();if(rows(next).length){await window.__mumeiV3Checkpoint325?.restore?.();window.__mumeiV3Checkpoint325?.mark?.();maybeAuto()}}
async function activateIntent(){if(!await initEnabled()||suppressUntilBell)return;panelSessionActive=true;clearTimeout(hideTimer);hideTimer=0;showRoot(true);await Promise.all([initFilter(),initMode()])}
function confirmHide(){hideTimer=0;if(suppressUntilBell)return;const next=findSurface();if(next){void activate(next);return}if(notificationRoute()||bellIntent()){void activateIntent();return}if(panelSessionActive){markSurface(null);showRoot(true);return}cleanupVisuals()}
function scheduleHide(delay=750){if(hideTimer)return;hideTimer=setTimeout(confirmHide,delay)}
async function inspect(){
 if(!await initEnabled()){disableFeatureNow();return}
 if(notificationRoute()){
  suppressUntilBell=false;panelSessionActive=true;clearTimeout(hideTimer);hideTimer=0;
  const next=routeSurface()||findSurface();if(next)markSurface(next);
  showRoot(true);await Promise.all([initFilter(),initMode()]);if(next){scheduleFilter();if(rows(next).length){await window.__mumeiV3Checkpoint325?.restore?.();window.__mumeiV3Checkpoint325?.mark?.();maybeAuto()}}
  return
 }
 if(suppressUntilBell){showRoot(false);return}
 const next=findSurface();if(next){await activate(next);return}
 if(bellIntent()){await activateIntent();return}
 if(panelSessionActive){if(shell&&!shell.isConnected)markSurface(null);showRoot(false);cleanupVisuals();return}
 cleanupVisuals()
}
function scheduleInspect(ms=100){clearTimeout(inspectTimer);inspectTimer=setTimeout(()=>void inspect(),ms)}
function onTopClick(e){if(panelEvent(e))return;const target=e.target instanceof Element?e.target:null;if(!featureEnabled||!bellTrigger(target,e))return;suppressUntilBell=false;panelSessionActive=true;autoDoneForSession=false;const openNow=Boolean(findSurface())||notificationRoute();if(openNow){intentUntil=0;showRoot(true);setTimeout(()=>scheduleInspect(0),60);setTimeout(()=>scheduleInspect(0),180);setTimeout(()=>scheduleInspect(0),500);return}intentUntil=Date.now()+7000;void activateIntent();for(const ms of[0,40,100,180,350,700,1200,2200,4000,6500])setTimeout(()=>scheduleInspect(0),ms)}

function settingsButtonFromEvent(e){
  const path=e?.composedPath?.()||[];
  for(const node of path){
    if(node instanceof Element&&node.matches?.('#'+ROOT+' [data-a="settings"]'))return node
  }
  const target=e?.target instanceof Element?e.target:null;
  return target?.closest?.('#'+ROOT+' [data-a="settings"]')||null
}
function blockSettingsEvent(e){
  const b=settingsButtonFromEvent(e);if(!b)return false;
  e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();return true
}
function onSettingsPressStart(e){blockSettingsEvent(e)}
function onSettingsPressEnd(e){
  if(!blockSettingsEvent(e)||settingsNavStarted)return;
  settingsNavStarted=true;
  Promise.resolve(openSettings()).finally(()=>setTimeout(()=>{settingsNavStarted=false},1600))
}
function onSettingsClick(e){blockSettingsEvent(e)}
function onEditorFocus(e){
  const target=e.target instanceof Element?e.target:null;
  if(!textEditorElement(target))return;
  const owner=target?.closest?.('[role="dialog"],[role="menu"],[popover],[class*="notification" i],[class*="notice" i]');
  if(notificationRoute()||Boolean(owner&&strongNoticeSurface(owner)))return;
  intentUntil=0;
  hideImmediately()
}
function boot(){ensureStyle();mountUiInSurface();ensureRoot();window.addEventListener('mumei-v3-reader-status',onStatus);document.addEventListener('mumei-v3-reader-status',onStatus);window.addEventListener('focusin',onEditorFocus,true);window.addEventListener('click',onTopClick,true);addEventListener('popstate',routeLifecycle);addEventListener('hashchange',routeLifecycle);addEventListener('pageshow',routeLifecycle);for(const name of['pushState','replaceState']){const original=history[name];if(!original.__mumei328){const wrapped=function(...a){const r=original.apply(this,a);setTimeout(routeLifecycle,0);return r};wrapped.__mumei328=true;history[name]=wrapped}}void initEnabled().then(on=>{if(on){document.getElementById(ROOT)?.remove();if(notificationRoute()){suppressUntilBell=false;panelSessionActive=true;showRoot(true)}void window.__mumeiV3Checkpoint325?.ready?.finally?.(()=>scheduleInspect(0));scheduleInspect(0)}else disableFeatureNow()});setInterval(()=>{if(featureEnabled)scheduleInspect(0)},800)}
if(document.body)boot();else document.addEventListener('DOMContentLoaded',boot,{once:true});
window.__mumeiV3Runtime328={version:VERSION,findSurface,popupSurface,routeSurface,inspect,bellTrigger,openNotificationBell,isNotificationOpen:()=>Boolean(findSurface()),openSettings,getAuto:()=>autoMode,setAuto:async v=>{await initMode();autoMode=Boolean(v);const id=await account();if(id)await set(AUTO+id,autoMode);paintMode()},getEnabled:async()=>{await initEnabled();return featureEnabled},setEnabled:setFeatureEnabled,cleanup:cleanupVisuals,isVisible:()=>dockVisible};
window.__mumeiV3Runtime327=window.__mumeiV3Runtime328;
window.__mumeiV3Runtime325=window.__mumeiV3Runtime328;
})();
