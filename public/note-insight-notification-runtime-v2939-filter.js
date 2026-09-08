(function(){
'use strict';
if(location.hostname!=='note.com')return;
const EVT='mumei-insight-filter-refresh-v2939';
const LEGACY='mumei-muted-v2933';
const OWN='mumei-muted-v2939';
const FORCE='data-mumei-v2939-force-visible';
const FIL='mumei_insight_magazine_filter_enabled_v3:';
const GRP='mumei_insight_notification_groups_v1:';
const MUT='mumei_insight_magazine_mute_ids_v5:';
const PROFILE='mumei_insight_magazine_mute_profiles_v5:';
const ITEM='.m-navbarNoticeItem,[class*="navbarNoticeItem"],[class*="notificationItem" i],[class*="noticeItem" i],[data-testid*="notification-item" i],[data-testid*="notice-item" i]';
const STYLE='mumei-v2939-filter-style';
const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
const key=(p,id)=>p+String(id||'').toLowerCase();
const modern=()=>Boolean(globalThis.GM);
async function get(k,d){if(modern()&&typeof GM.getValue==='function')return GM.getValue(k,d);if(typeof GM_getValue==='function')return GM_getValue(k,d);return d}
let accountId='',cache=null,cacheAt=0,root=null,obs=null,timer=0;
async function account(){if(accountId)return{id:accountId};try{const r=await fetch('/api/v2/current_user',{credentials:'include',cache:'no-store'});if(!r.ok)return null;const j=await r.json(),u=(j.data??j).user||(j.data??j),id=String(u.urlname||u.url_name||u.username||'').toLowerCase();if(!/^[a-z0-9_-]+$/.test(id))return null;accountId=id;return{id}}catch{return null}}
function installStyle(){if(document.getElementById(STYLE))return;const s=document.createElement('style');s.id=STYLE;s.textContent=`.${LEGACY}[${FORCE}="1"]{display:var(--mumei-v2939-display,block)!important}.${OWN}{display:none!important}`;document.documentElement.append(s)}
function shown(el){if(!el?.getBoundingClientRect)return false;const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'}
function exact(v){return[...document.querySelectorAll('button,a,[role="tab"],[role="button"],div,span')].find(el=>shown(el)&&clean(el.textContent)===v)||null}
function commonShell(a,b){if(!a||!b)return null;let p=a;for(let i=0;i<10&&p&&p!==document.body;i++,p=p.parentElement){if(p.contains(b)&&shown(p)){const r=p.getBoundingClientRect();if(r.width>180&&r.height>100)return p}}return null}
function shell(){return commonShell(exact('通知'),exact('お知らせ'))}
function rows(r){if(!r)return[];let xs=[...r.querySelectorAll(ITEM)];if(!xs.length)xs=[...r.querySelectorAll('li,[role="listitem"],article')].filter(el=>{const t=clean(el.textContent);return t.length>5&&/(?:さん|新しい記事|マガジン|運営メンバー)/u.test(t)});return[...new Set(xs)]}
function creatorIdFromUrl(v){try{const u=new URL(String(v||''),location.href),p=u.pathname.split('/').filter(Boolean);if(!u.hostname.endsWith('note.com')||p.length!==1)return'';const id=(p[0]||'').toLowerCase();return/^[a-z0-9_-]+$/.test(id)&&!['settings','sitesettings','membership'].includes(id)?id:''}catch{return''}}
function creatorLinks(el){return[...el.querySelectorAll('a[href]')].map(a=>({id:creatorIdFromUrl(a.getAttribute('href')),txt:clean(a.textContent)})).filter(x=>x.id)}
function leadName(t){const m=clean(t).match(/^(.{1,180}?)\s*さん(?:他\d+名)?(?:が|の|から|より|に)/u);return m?.[1]?.trim()||''}
function norm(v){return clean(v).toLowerCase().replace(/\s+/g,'').replace(/[.…⋯]+$/u,'')}
function nameMatch(lead,full){const a=norm(lead),b=norm(full);if(!a||!b)return false;if(a===b)return true;return /[.…⋯]$/u.test(clean(lead))&&a.length>=2&&b.startsWith(a)}
function magazineNoise(t){const s=clean(t);return /さん(?:他\d+名)?が.*(?:マガジン|共同運営|共同マガ|運営メンバー).*?(?:新しい記事を\d+本追加しました|記事を\d+本追加しました|仲間入りしました)/u.test(s)||/さん(?:他\d+名)?が.*新しい記事を\d+本追加しました/u.test(s)}
async function state(force=false){if(!force&&cache&&Date.now()-cacheAt<3000)return cache;const a=await account();if(!a)return null;const enabled=Boolean(await get(key(FIL,a.id),false)),gs=await get(key(GRP,a.id),[]);let ids=[];if(Array.isArray(gs)&&gs.length)ids=[...new Set(gs.filter(g=>g?.enabled!==false).flatMap(g=>Array.isArray(g?.ids)?g.ids:[]).map(x=>String(x).toLowerCase()).filter(x=>/^[a-z0-9_-]+$/.test(x)))];else{const raw=await get(key(MUT,a.id),[]);ids=[...new Set((Array.isArray(raw)?raw:[]).map(x=>String(x).toLowerCase()).filter(x=>/^[a-z0-9_-]+$/.test(x)))]}const ps=await get(key(PROFILE,a.id),[]),profiles=(Array.isArray(ps)?ps:[]).filter(p=>p?.id&&ids.includes(String(p.id).toLowerCase())).map(p=>({id:String(p.id).toLowerCase(),name:clean(p.name)}));cache={enabled,ids:new Set(ids),profiles};cacheAt=Date.now();return cache}
function leadId(el,lead,st){const links=creatorLinks(el);const text=links.find(x=>x.txt&&nameMatch(lead,x.txt));if(text)return text.id;const prof=st.profiles.find(p=>p.name&&nameMatch(lead,p.name));if(prof)return prof.id;const first=links[0];if(!first)return'';const p=st.profiles.find(x=>x.id===first.id);if(first.txt&&nameMatch(lead,first.txt))return first.id;if(p?.name&&nameMatch(lead,p.name))return first.id;return''}
function forceVisible(el,on){if(!el)return;if(on){if(!el.style.getPropertyValue('--mumei-v2939-display'))el.style.setProperty('--mumei-v2939-display',el.tagName==='LI'?'list-item':'block');el.setAttribute(FORCE,'1')}else el.removeAttribute(FORCE)}
function setHidden(el,want){if(!el)return;forceVisible(el,!want);el.classList.toggle(OWN,Boolean(want))}
async function refresh(forceState=false){installStyle();const r=shell();if(!r)return;attach(r);const st=await state(forceState);if(!st)return;for(const el of rows(r)){const t=clean(el.textContent),lead=leadName(t);let hide=false;if(st.enabled&&st.ids.size&&lead&&magazineNoise(t)){hide=st.profiles.some(p=>p.name&&nameMatch(lead,p.name));if(!hide){const id=leadId(el,lead,st);hide=Boolean(id&&st.ids.has(id))}}setHidden(el,hide)}for(const el of r.querySelectorAll(`.${LEGACY}`)){if(!el.classList.contains(OWN))forceVisible(el,true)}}
function schedule(ms=50,force=false){clearTimeout(timer);timer=setTimeout(()=>void refresh(force),ms)}
function attach(r){if(root===r&&obs)return;if(obs)obs.disconnect();root=r;obs=new MutationObserver(ms=>{if(ms.some(m=>m.type==='childList'&&m.addedNodes.length))schedule(70,false)});obs.observe(r,{childList:true,subtree:true})}
function discover(){const r=shell();if(r)attach(r);schedule(40,false)}
window.addEventListener(EVT,()=>{cache=null;cacheAt=0;for(const ms of [20,120,420,1000])setTimeout(()=>void refresh(true),ms)});
document.addEventListener('click',()=>setTimeout(discover,80),true);
addEventListener('focus',discover);addEventListener('pageshow',discover);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')discover()});
installStyle();setTimeout(discover,120);
})();