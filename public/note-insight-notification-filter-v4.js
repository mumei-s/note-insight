(function(){
'use strict';
if(location.hostname!=='note.com')return;
if(window.__mumeiNotificationFilterV4Loaded)return;window.__mumeiNotificationFilterV4Loaded=true;
const VERSION='4.2.2';
const featureOn=()=>window.__mumeiNotificationFeatureV1?.isEnabled?.()!==false;
const EVT='mumei-insight-filter-refresh-v2939';
const LEGACY='mumei-muted-v2933';
const OWN='mumei-muted-v2939';
const FORCE='data-mumei-v2939-force-visible';
const FIL='mumei_insight_magazine_filter_enabled_v3:';
const GRP='mumei_insight_notification_groups_v1:';
const MUT='mumei_insight_magazine_mute_ids_v5:';
const PROFILE='mumei_insight_magazine_mute_profiles_v5:';
const ITEM='.m-navbarNoticeItem,[class*="navbarNoticeItem"],[class*="notificationItem" i],[class*="noticeItem" i],[data-testid*="notification-item" i],[data-testid*="notice-item" i]';
const FALLBACK_ITEM='li,[role="listitem"],article,a[href]';
const PANEL_HINT='.m-navbarNotice,[class*="notificationList" i],[class*="noticeList" i],[data-mumei-notice-shell-v2958],[role="dialog"],[role="menu"],[popover],'+ITEM;
const STYLE='mumei-v2939-filter-style';
const isDmRoute=()=>/^\/messages\/rooms(?:\/|$)/i.test(location.pathname)&&!shell();
const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
const key=(p,id)=>p+String(id||'').toLowerCase();
const modern=()=>Boolean(globalThis.GM);
async function put(k,v){if(modern()&&typeof GM.setValue==='function')return GM.setValue(k,v);if(typeof GM_setValue==='function')return GM_setValue(k,v)}
let profileJob=null;const profileAttempt=new Map(),profileQueue=new Set();
function hydrateProfiles(id,ids,profiles){
 const now=Date.now();
 for(const who of ids)if(!profiles.some(p=>p.id===who&&p.name)&&now-(profileAttempt.get(who)||0)>15000)profileQueue.add(who);
 if(profileJob||!profileQueue.size)return;
 profileJob=(async()=>{
  while(profileQueue.size){
   const batch=[...profileQueue].slice(0,4);for(const who of batch)profileQueue.delete(who);
   const saved=await get(key(PROFILE,id),[]),next=new Map((Array.isArray(saved)?saved:[]).map(p=>[String(p.id||'').toLowerCase(),p]));
   await Promise.all(batch.map(async who=>{profileAttempt.set(who,Date.now());try{const r=await fetch('/api/v2/creators/'+encodeURIComponent(who),{credentials:'include',cache:'no-store'});if(!r.ok)return;const j=await r.json(),d=j.data||j,name=clean(d.nickname||d.name);if(name)next.set(who,{id:who,name,image:d.profileImageUrl||d.profile_image_url||''})}catch{}}));
   await put(key(PROFILE,id),[...next.values()]);
  }
  cache=null;cacheAt=0;if(accountId===id)schedule(0,true)
 })().catch(()=>{}).finally(()=>{profileJob=null;if(profileQueue.size&&accountId===id)hydrateProfiles(id,[...profileQueue],[])})
}
async function get(k,d){if(modern()&&typeof GM.getValue==='function')return GM.getValue(k,d);if(typeof GM_getValue==='function')return GM_getValue(k,d);return d}
let accountId='',accountJob=null,cache=null,cacheAt=0,root=null,watchedPanel=null,obs=null,timer=0,pendingForce=false,revision=0,run=0,retries=0;
const listened=new Set();
function invalidate(){cache=null;cacheAt=0;revision++}
function listenAccount(id){if(listened.has(id))return;const listen=modern()&&GM.addValueChangeListener||typeof GM_addValueChangeListener==='function'&&GM_addValueChangeListener;if(!listen)return;listened.add(id);for(const prefix of [FIL,GRP,MUT,PROFILE])try{listen(key(prefix,id),()=>{if(accountId!==id)return;invalidate();schedule(0,true)})}catch{}}
async function account(){if(accountId)return{id:accountId};if(accountJob)return accountJob;const activeRoot=root;const job=(async()=>{try{const r=await fetch('/api/v2/current_user',{credentials:'include',cache:'no-store'});if(!r.ok)return null;const j=await r.json(),u=(j.data??j).user||(j.data??j),id=String(u.urlname||u.url_name||u.username||'').toLowerCase();if(!/^[a-z0-9_-]+$/.test(id)||root!==activeRoot||accountJob!==job)return null;accountId=id;listenAccount(id);return{id}}catch{return null}})();accountJob=job;try{return await job}finally{if(accountJob===job)accountJob=null}}
function installStyle(){if(document.getElementById(STYLE))return;const s=document.createElement('style');s.id=STYLE;s.textContent=`.${LEGACY}[${FORCE}="1"]{display:var(--mumei-v2939-display,block)!important}.${OWN}{display:none!important}`;document.documentElement.append(s)}
function shown(el){if(!el?.isConnected||!el.getBoundingClientRect)return false;for(let p=el;p;p=p.parentElement){const s=getComputedStyle(p);if(p.hidden||p.getAttribute('aria-hidden')==='true'||s.display==='none'||s.visibility==='hidden')return false}const r=el.getBoundingClientRect();return r.width>0&&r.height>0}
function exact(v){return[...document.querySelectorAll('button,a,[role="tab"],[role="button"],div,span')].find(el=>shown(el)&&clean(el.textContent)===v)||null}
function commonShell(a,b){if(!a||!b)return null;let p=a;for(let i=0;i<10&&p&&p!==document.body;i++,p=p.parentElement){if(p.contains(b)&&shown(p)){const r=p.getBoundingClientRect();if(r.width>180&&r.height>0&&rows(p).length)return p}}return null}
function shell(){const native=window.__mumeiNotificationReaderV4?.findPanel?.();return native&&shown(native)?native:commonShell(exact('通知'),exact('お知らせ'))}
function fallbackRow(el){const t=clean(el.textContent),dated=!el.matches('a[href]')||el.querySelector('time[datetime]')||/(?:たった今|昨日|\d+\s*(?:秒|分|時間|日|週|か月|ヶ月|月|年)前|\d{1,2}月\d{1,2}日)/u.test(t);return t.length>5&&t.length<4000&&Boolean(leadName(t))&&Boolean(dated)}
function candidates(r){
 if(!r)return[];
 const known=[...new Set([...r.querySelectorAll('.m-navbarNoticeItem,[data-testid="notification-item"],[data-testid="notice-item"]'),...[...r.querySelectorAll(ITEM)].filter(el=>!String(el.className||'').includes('__'))])];
 const fallback=[...r.querySelectorAll(FALLBACK_ITEM)].filter(el=>fallbackRow(el)&&!known.some(k=>k!==el&&el.contains(k)));
 return [...new Set([...known,...fallback])]
}
function collection(el,xs){const nested=xs.filter(child=>child!==el&&el.contains(child)&&leadName(clean(child.textContent)));return nested.some((a,i)=>nested.slice(i+1).some(b=>!a.contains(b)&&!b.contains(a)))}
function rows(r){const xs=candidates(r),single=xs.filter(el=>!collection(el,xs));return single.filter(el=>!single.some(parent=>parent!==el&&parent.contains(el)))}
function restoreCollections(){for(const el of document.querySelectorAll('.'+OWN))if(collection(el,candidates(el)))setHidden(el,false)}
function creatorIdFromUrl(v){try{const u=new URL(String(v||''),location.href),p=u.pathname.split('/').filter(Boolean);if(!u.hostname.endsWith('note.com')||p.length!==1)return'';const id=(p[0]||'').toLowerCase();return/^[a-z0-9_-]+$/.test(id)&&!['settings','sitesettings','membership'].includes(id)?id:''}catch{return''}}
function creatorLinks(el){return[...el.querySelectorAll('a[href]')].map(a=>({id:creatorIdFromUrl(a.getAttribute('href')),txt:clean(a.textContent)})).filter(x=>x.id)}
function leadName(t){const m=clean(t).match(/^(.{1,180}?)\s*さん\s*(?:他\s*\d[\d,]*\s*名\s*)?(?:が|の|から|より|に)/u);return m?.[1]?.trim()||''}
function norm(v){return clean(v).toLowerCase().replace(/\s+/g,'').replace(/[.…⋯]+$/u,'')}
function nameMatch(lead,full){const a=norm(lead),b=norm(full);if(!a||!b)return false;if(a===b)return true;return /[.…⋯]$/u.test(clean(lead))&&a.length>=2&&b.startsWith(a)}
function magazineNoise(t){const s=clean(t).replace(/\s+/g,'').replace(/(\d),(?=\d)/g,'$1');return /さん(?:他\d+名)?が.*(?:マガジン|共同運営|共同マガ|運営メンバー).*?(?:新しい記事を\d+本追加しました|記事を\d+本追加しました|仲間入りしました)/u.test(s)||/さん(?:他\d+名)?が.*新しい記事を\d+本追加しました/u.test(s)||/さん(?:他\d+名)?が.+?に(?:新しい)?記事を(?:\d+本)?追加しました(?![」』】"”])/u.test(s)}
async function state(force=false){if(!force&&cache&&Date.now()-cacheAt<3000)return cache;const rev=revision,a=await account();if(!a)return null;const enabled=Boolean(await get(key(FIL,a.id),false)),gs=await get(key(GRP,a.id),[]);let ids=[];if(Array.isArray(gs)&&gs.length)ids=[...new Set(gs.filter(g=>g?.enabled!==false).flatMap(g=>Array.isArray(g?.ids)?g.ids:[]).map(x=>String(x).toLowerCase()).filter(x=>/^[a-z0-9_-]+$/.test(x)))];else{const raw=await get(key(MUT,a.id),[]);ids=[...new Set((Array.isArray(raw)?raw:[]).map(x=>String(x).toLowerCase()).filter(x=>/^[a-z0-9_-]+$/.test(x)))]}const ps=await get(key(PROFILE,a.id),[]),profiles=(Array.isArray(ps)?ps:[]).filter(p=>p?.id&&ids.includes(String(p.id).toLowerCase())).map(p=>({id:String(p.id).toLowerCase(),name:clean(p.name)}));if(rev!==revision||a.id!==accountId)return null;if(enabled)hydrateProfiles(a.id,ids,profiles);cache={enabled,ids:new Set(ids),profiles};cacheAt=Date.now();return cache}
function leadId(el,lead,st){const links=creatorLinks(el);const text=links.find(x=>x.txt&&nameMatch(lead,x.txt));if(text)return text.id;const prof=st.profiles.find(p=>p.name&&nameMatch(lead,p.name));if(prof)return prof.id;const first=links[0];if(!first)return'';const p=st.profiles.find(x=>x.id===first.id);if(first.txt&&nameMatch(lead,first.txt))return first.id;if(p?.name&&nameMatch(lead,p.name))return first.id;return''}
function forceVisible(el,on){if(!el)return;if(on){if(!el.style.getPropertyValue('--mumei-v2939-display'))el.style.setProperty('--mumei-v2939-display',el.tagName==='LI'?'list-item':'block');if(el.getAttribute(FORCE)!=='1')el.setAttribute(FORCE,'1')}else if(el.hasAttribute(FORCE))el.removeAttribute(FORCE)}
function setHidden(el,want){if(!el)return;forceVisible(el,!want);if(el.classList.contains(OWN)!==Boolean(want))el.classList.toggle(OWN,Boolean(want))}
function clearHides(){clearContinuation();for(const el of document.querySelectorAll(`.${OWN},.${LEGACY}`))setHidden(el,false)}
// Collapsing the entire loaded page must not collapse note's pagination surface.
// Leave a scroll runway before its native loader, without exposing a muted row
// or moving the viewport. The next page is still loaded by note itself.
let continuation=null,scrollFallback=null;
function clearContinuation(){continuation?.remove();continuation=null;if(scrollFallback){const {el,styles}=scrollFallback;for(const [name,value,priority]of styles){if(value)el.style.setProperty(name,value,priority);else el.style.removeProperty(name)}scrollFallback=null}}
function provideScroll(parent,surface){
 if(surface)return surface;
 if(parent===document.body||parent===document.documentElement)return null;
 if(scrollFallback?.el!==parent){if(scrollFallback)clearContinuation();const names=['overflow-y','max-height','touch-action','overscroll-behavior-y'];scrollFallback={el:parent,styles:names.map(name=>[name,parent.style.getPropertyValue(name),parent.style.getPropertyPriority(name)])};}
 const top=Math.max(0,parent.getBoundingClientRect().top||0),height=Math.max(160,innerHeight-top-90);
 for(const [name,value,priority]of [['overflow-y','auto','important'],['max-height',height+'px','important'],['touch-action','pan-y','important'],['overscroll-behavior-y','contain','']])if(parent.style.getPropertyValue(name)!==value||parent.style.getPropertyPriority(name)!==priority)parent.style.setProperty(name,value,priority);return parent;
}
function scrollSurface(r){for(let el=r;el&&el!==document.body&&el!==document.documentElement;el=el.parentElement)if(/(?:auto|scroll)/.test(getComputedStyle(el).overflowY))return el;return null}
function continueFilteredPage(st,list,surface){
 const muted=list.filter(el=>el.classList.contains(OWN)),allHidden=muted.length===list.length;
 if(!st.enabled||!muted.length){clearContinuation();return}
 const last=list.at(-1),parent=last?.parentElement;if(!parent)return;
 if(!continuation?.isConnected||continuation.parentElement!==parent){clearContinuation();continuation=document.createElement(/^(UL|OL)$/.test(parent.tagName)?'li':'div');continuation.id='mumei-notification-filter-continuation-v4';continuation.setAttribute('role','status');continuation.style.cssText='box-sizing:border-box;display:block;padding:24px 16px;color:inherit;font:600 13px/1.7 system-ui;list-style:none';parent.insertBefore(continuation,last.nextSibling)}
 surface=provideScroll(parent,surface);
 if(continuation.previousElementSibling!==last)parent.insertBefore(continuation,last.nextSibling);
 const viewport=Math.min(innerHeight,surface?.clientHeight||innerHeight),visibleHeight=list.filter(el=>!el.classList.contains(OWN)).reduce((sum,el)=>sum+el.getBoundingClientRect().height,0),height=Math.max(allHidden?160:96,viewport+96-visibleHeight)+'px';
 if(continuation.style.minHeight!==height)continuation.style.minHeight=height;
 const message=allHidden?`${muted.length}件をフィルターで非表示にしています。下へスクロールして続きを表示できます。`:'下へスクロールして続きを表示';
 if(continuation.textContent!==message)continuation.textContent=message;
}
let lastResult=null;
function reportResult(st,list){const result={enabled:st.enabled,total:list.length,hidden:list.filter(el=>el.classList.contains(OWN)).length};if(JSON.stringify(result)===JSON.stringify(lastResult))return;lastResult=result;window.dispatchEvent(new CustomEvent('mumei-notification-filter-status',{detail:result}))}
async function refresh(forceState=false){const activeRun=++run;if(!featureOn()){attach(null);clearHides();return}restoreCollections();if(isDmRoute()){attach(null);return}installStyle();const candidate=shell(),filteredRoot=Boolean(root?.isConnected&&root.querySelector?.('.'+OWN)),candidateHasRows=Boolean(candidate&&rows(candidate).length),r=filteredRoot&&!candidateHasRows?root:candidate&&shown(candidate)?candidate:filteredRoot?root:null;attach(r);if(!r)return;const rev=revision;let st;try{st=await state(forceState)}catch{st=null}if(!featureOn()){clearHides();return}if(activeRun!==run||rev!==revision||root!==r)return;if(!shown(r)){clearContinuation();return;}if(!st){if(retries++<2)schedule(400*retries,true);return}retries=0;const list=rows(r),surface=scrollSurface(r);for(const el of list){const t=clean(el.textContent),lead=leadName(t);let hide=false;if(st.enabled&&st.ids.size&&lead&&magazineNoise(t)){hide=st.profiles.some(p=>p.name&&nameMatch(lead,p.name));if(!hide){const id=leadId(el,lead,st);hide=Boolean(id&&st.ids.has(id))}}setHidden(el,hide)}for(const el of r.querySelectorAll(`.${LEGACY}`)){if(!el.classList.contains(OWN))forceVisible(el,true)}continueFilteredPage(st,list,surface);reportResult(st,list)}
// Coalesce events without postponing forever while note appends incoming rows.
function schedule(ms=50,force=false){pendingForce=pendingForce||force;if(timer)return;timer=setTimeout(()=>{timer=0;const forced=pendingForce;pendingForce=false;void refresh(forced)},ms)}
function nativeClass(v){return String(v||'').split(/\s+/).filter(x=>x&&x!==OWN).sort().join(' ')}
function owned(el){return Boolean(el?.closest?.('[id^="mumei-"],[id^="miv5-"]'))}
function changed(m){if(owned(m.target.nodeType===1?m.target:m.target.parentElement))return false;if(m.type==='attributes'&&m.attributeName==='class')return nativeClass(m.oldValue)!==nativeClass(m.target.getAttribute('class'))||!m.target.classList.contains(OWN)&&String(m.oldValue||'').split(/\s+/).includes(OWN);return true}
function releaseScrollGuard(r){if(!r||r.getAttribute('data-mumei-filter-scroll-guard')!=='1')return;r.removeAttribute('data-mumei-filter-scroll-guard');r.style.removeProperty('overscroll-behavior-y')}
function attach(r){if(root===r)return;const previous=root,sameSurface=Boolean(previous?.isConnected&&r?.isConnected&&(previous.contains(r)||r.contains(previous)));obs?.disconnect();obs=null;if(root){if(!sameSurface){clearContinuation();for(const el of root.querySelectorAll(`.${OWN}`))setHidden(el,false)}releaseScrollGuard(root)}root=r;if(!sameSurface){accountId='';accountJob=null}retries=0;invalidate();if(!r)return;watchedPanel=r;r.setAttribute('data-mumei-filter-scroll-guard','1');r.style.setProperty('overscroll-behavior-y','contain');obs=new MutationObserver(ms=>{if(ms.some(changed))schedule(50)});obs.observe(r,{childList:true,characterData:true,attributes:true,attributeFilter:['href','class'],attributeOldValue:true,subtree:true})}
// Native touch and wheel gestures must reach note's actual scroll ancestor.
// A panel can be nested inside that ancestor or use the document viewport.
function discover(){retries=0;schedule(40,true)}
window.addEventListener(EVT,()=>{invalidate();schedule(0,true)});
window.addEventListener('mumei-notification-feature-changed',()=>{invalidate();clearTimeout(timer);timer=0;pendingForce=false;if(featureOn())schedule(0,true);else{attach(null);clearHides()}});
document.addEventListener('click',()=>schedule(80),true);
addEventListener('focus',discover);addEventListener('pageshow',discover);addEventListener('popstate',discover);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')discover()});
// Catch a panel mounted after the bell click, including a reused hidden panel.
// Observe only relevant mutations; no background polling or repeated API scan.
const discovery=new MutationObserver(ms=>{if(!featureOn())return;if(root&&(!root.isConnected||root.hidden)){schedule(0);return}for(const m of ms){const target=m.target,panel=root||watchedPanel;if(m.type==='attributes'){if(owned(target))continue;if((panel&&(target===panel||target.contains(panel)))||target.matches?.(PANEL_HINT)){if(m.attributeName!=='class'||changed(m)){schedule();return}}}else{if(root?.contains(target))continue;if([...m.addedNodes].some(n=>n.nodeType===1&&!owned(n)&&(n.matches(PANEL_HINT)||n.querySelector(PANEL_HINT)||n.matches(FALLBACK_ITEM)&&fallbackRow(n)||[...n.querySelectorAll(FALLBACK_ITEM)].some(fallbackRow)))){schedule();return}}}});
discovery.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style','hidden','aria-hidden'],attributeOldValue:true});
installStyle();schedule(120);
window.__mumeiNotificationFilterV4={version:VERSION,refresh,getState:()=>lastResult,findPanel:()=>featureOn()&&root?.isConnected?(shown(root)?root:commonShell(exact('通知'),exact('お知らせ'))):null};
})();
