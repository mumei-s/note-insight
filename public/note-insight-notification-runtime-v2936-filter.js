(function(){
'use strict';
if(location.hostname!=='note.com')return;
const RAIL='mumei-v2933-rail';
const MUTED='mumei-muted-v2933';
const FIL='mumei_insight_magazine_filter_enabled_v3:';
const GRP='mumei_insight_notification_groups_v1:';
const MUT='mumei_insight_magazine_mute_ids_v5:';
const PROFILE='mumei_insight_magazine_mute_profiles_v5:';
const ITEM='.m-navbarNoticeItem,[class*="navbarNoticeItem"],[class*="notificationItem" i],[class*="noticeItem" i],[data-testid*="notification-item" i],[data-testid*="notice-item" i]';
const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
const key=(p,id)=>p+String(id||'').toLowerCase();
const modern=()=>Boolean(globalThis.GM);
async function get(k,d){if(modern()&&typeof GM.getValue==='function')return GM.getValue(k,d);if(typeof GM_getValue==='function')return GM_getValue(k,d);return d}
let accountId='';
async function account(){if(accountId)return{id:accountId};try{const r=await fetch('/api/v2/current_user',{credentials:'include',cache:'no-store'});if(!r.ok)return null;const j=await r.json(),u=(j.data??j).user||(j.data??j),id=String(u.urlname||u.url_name||u.username||'').toLowerCase();if(!/^[a-z0-9_-]+$/.test(id))return null;accountId=id;return{id}}catch{return null}}
function shown(el){if(!el?.getBoundingClientRect)return false;const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity||1)>0}
function exact(v){return[...document.querySelectorAll('button,a,[role="tab"],[role="button"],div,span')].find(el=>shown(el)&&clean(el.textContent)===v)||null}
function commonShell(a,b){if(!a||!b)return null;let p=a;for(let i=0;i<10&&p&&p!==document.body;i++,p=p.parentElement){if(p.contains(b)&&shown(p)){const r=p.getBoundingClientRect();if(r.width>180&&r.height>100)return p}}return null}
function shell(){return commonShell(exact('通知'),exact('お知らせ'))}
function logicalRows(root){if(!root)return[];let xs=[...root.querySelectorAll(ITEM)];if(!xs.length)xs=[...root.querySelectorAll('li,[role="listitem"],article')];if(!xs.length)xs=[...root.querySelectorAll('div')].filter(el=>{const t=clean(el.textContent);return t.length>8&&/(?:さん他\d+名が|新しい記事を\d+本追加しました|運営メンバーに仲間入りしました)/u.test(t)});return[...new Set(xs)].filter(el=>shown(el)||el.classList.contains(MUTED))}
function creatorIdFromUrl(v){try{const u=new URL(String(v||''),location.href),p=u.pathname.split('/').filter(Boolean);if(!u.hostname.endsWith('note.com')||p.length!==1)return'';const id=(p[0]||'').toLowerCase();return/^[a-z0-9_-]+$/.test(id)&&!['settings','sitesettings','membership'].includes(id)?id:''}catch{return''}}
function creatorLinks(el){return[...el.querySelectorAll('a[href]')].map(a=>({a,id:creatorIdFromUrl(a.getAttribute('href')),txt:clean(a.textContent)})).filter(x=>x.id)}
function leadTextName(t){const s=clean(t),m=s.match(/^(.{1,180}?)\s*さん(?:他\d+名)?(?:が|の|から|より|に)/u);return m?.[1]?.trim()||''}
function normName(v){return clean(v).toLowerCase().replace(/\s+/g,'').replace(/[.…⋯]+$/u,'')}
function nameMatches(lead,full){const a=normName(lead),b=normName(full);if(!a||!b)return false;if(a===b)return true;const truncated=/[.…⋯]$/u.test(clean(lead));return truncated&&a.length>=2&&b.startsWith(a)}
function magazineNoise(t){const s=clean(t);return /さん(?:他\d+名)?が.*(?:マガジン|共同運営|共同マガ|運営メンバー).*?(?:新しい記事を\d+本追加しました|記事を\d+本追加しました|仲間入りしました)/u.test(s)||/さん(?:他\d+名)?が.*新しい記事を\d+本追加しました/u.test(s)}
async function state(){const a=await account();if(!a)return null;const enabled=Boolean(await get(key(FIL,a.id),false));const gs=await get(key(GRP,a.id),[]);let ids=[];if(Array.isArray(gs)&&gs.length)ids=[...new Set(gs.filter(g=>g?.enabled!==false).flatMap(g=>Array.isArray(g?.ids)?g.ids:[]).map(x=>String(x).toLowerCase()).filter(x=>/^[a-z0-9_-]+$/.test(x)))];else{const raw=await get(key(MUT,a.id),[]);ids=[...new Set((Array.isArray(raw)?raw:[]).map(x=>String(x).toLowerCase()).filter(x=>/^[a-z0-9_-]+$/.test(x)))]}const ps=await get(key(PROFILE,a.id),[]);const profiles=(Array.isArray(ps)?ps:[]).filter(p=>p?.id&&ids.includes(String(p.id).toLowerCase())).map(p=>({id:String(p.id).toLowerCase(),name:clean(p.name)}));return{enabled,ids:new Set(ids),profiles}}
function leadId(el,lead,st){const links=creatorLinks(el);if(!links.length)return'';if(lead){const textHit=links.find(x=>x.txt&&nameMatches(lead,x.txt));if(textHit)return textHit.id;const profHit=st.profiles.find(p=>p.name&&nameMatches(lead,p.name));if(profHit)return profHit.id}const first=links[0];if(!first)return'';const p=st.profiles.find(x=>x.id===first.id);if(!lead)return first.id;if(first.txt&&nameMatches(lead,first.txt))return first.id;if(p?.name&&nameMatches(lead,p.name))return first.id;return''}
function outerRow(el,root){let best=el,p=el;for(let i=0;i<4&&p?.parentElement&&p.parentElement!==root;i++){const q=p.parentElement;if(q.contains(exact('通知'))||q.contains(exact('お知らせ')))break;const items=q.querySelectorAll(ITEM).length;if(items>1)break;const r=q.getBoundingClientRect(),hr=root.getBoundingClientRect();if(r.height>0&&r.height<=520&&r.width>=Math.min(180,hr.width*.6))best=q;p=q}return best}
function setMuted(el,want){if(!el)return;const has=el.classList.contains(MUTED);if(want&&!has)el.classList.add(MUTED);else if(!want&&has)el.classList.remove(MUTED)}
let busy=false,timer=0;
async function reconcile(){if(busy)return;busy=true;try{const root=shell();if(!root)return;const st=await state();if(!st)return;const logical=logicalRows(root),seen=new Set();for(const el of logical){const row=outerRow(el,root);if(seen.has(row))continue;seen.add(row);const t=clean(row.textContent||el.textContent),lead=leadTextName(t);let want=false;if(st.enabled&&st.ids.size&&magazineNoise(t)&&lead){want=st.profiles.some(p=>p.name&&nameMatches(lead,p.name));if(!want){const id=leadId(row,lead,st);want=Boolean(id&&st.ids.has(id))}}setMuted(row,want);if(row!==el)setMuted(el,false)}if(!st.enabled||!st.ids.size){for(const e of root.querySelectorAll(`.${MUTED}`))setMuted(e,false)}}finally{busy=false}}
function schedule(ms=45){clearTimeout(timer);timer=setTimeout(()=>void reconcile(),ms)}
const obs=new MutationObserver(ms=>{if(ms.some(m=>m.type==='childList'||m.type==='characterData'||(m.type==='attributes'&&m.attributeName==='class')))schedule(55)});obs.observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class']});
document.addEventListener('click',e=>{const b=e.target instanceof Element?e.target.closest(`#${RAIL} .filter`):null;schedule(b?90:55)},true);
document.addEventListener('scroll',()=>schedule(90),true);addEventListener('focus',()=>schedule(90));addEventListener('pageshow',()=>schedule(90));document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')schedule(90)});
schedule(140);
})();
