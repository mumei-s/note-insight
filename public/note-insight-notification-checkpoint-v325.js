(function(){
'use strict';
if(location.hostname!=='note.com')return;
if(window.__mumeiV3Checkpoint325)return;
const VERSION='3.2.25';
const CHECK='mumei_insight_notification_checkpoint_v2922:';
const LOCAL='mumei_insight_notification_checkpoint_local_v325:';
const BOUNDARY_ID='mumei-v3-saved-boundary-v3223';
const SHELL='[data-mumei-notice-shell-v3="1"]';
const ITEM='.m-navbarNoticeItem,[class*="navbarNoticeItem" i],[class*="notificationItem" i],[class*="noticeItem" i],[data-testid*="notification-item" i],[data-testid*="notice-item" i],li,[role="listitem"]';
const clean=v=>String(v||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
const stripTime=v=>clean(v).replace(/\s*(?:たった今|昨日|\d+\s*(?:秒|分|時間|日|週|か月|ヶ月|月|年)前|\d{1,2}月\d{1,2}日|\d{4}[\/.年]\d{1,2}[\/.月]\d{1,2}日?)$/u,'').trim();
const modern=()=>Boolean(globalThis.GM);
async function get(k,d){try{if(modern()&&typeof GM.getValue==='function')return await GM.getValue(k,d);if(typeof GM_getValue==='function')return GM_getValue(k,d)}catch{}return d}
async function set(k,v){try{if(modern()&&typeof GM.setValue==='function')return await GM.setValue(k,v);if(typeof GM_setValue==='function')return GM_setValue(k,v)}catch{}}
async function account(){try{const r=await fetch('/api/v2/current_user',{credentials:'include',cache:'no-store'});if(!r.ok)return'';const j=await r.json(),u=(j.data??j).user||(j.data??j),id=clean(u?.urlname||u?.url_name||u?.username).replace(/^@/,'').toLowerCase();return/^[a-z0-9_-]+$/.test(id)?id:''}catch{return''}}
function localRead(id){try{const v=JSON.parse(localStorage.getItem(LOCAL+id)||'null');return v&&typeof v==='object'?v:null}catch{return null}}
function localWrite(id,v){try{localStorage.setItem(LOCAL+id,JSON.stringify(v))}catch{}}
function boundaryAge(v){return Number(v?.boundaryAt||v?.lastSaveAt||v?.lastCheckAt||0)}
function identity(el){const id=el?.getAttribute?.('data-notification-id')||el?.getAttribute?.('data-notice-id')||el?.querySelector?.('[data-notification-id]')?.getAttribute?.('data-notification-id');if(id)return'notice:'+id;for(const a of el?.querySelectorAll?.('a[href]')||[]){try{const u=new URL(a.href,location.href);for(const k of['notification_id','notice_id','c','comment_id'])if(u.searchParams.get(k))return'notice:'+u.searchParams.get(k)}catch{}}const label=stripTime(el?.textContent||'').slice(0,180);return label?'label:'+label:''}
function visible(el){if(!(el instanceof Element))return false;const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&r.bottom>0&&r.right>0&&r.top<innerHeight&&r.left<innerWidth}
function candidateRows(){const root=document.querySelector(SHELL)||(/^\/notifications(?:\/|$)/i.test(location.pathname)?document.querySelector('main,[role="main"]'):null);if(!root)return[];return[...root.querySelectorAll(ITEM)].filter(visible)}
function findBoundaryRow(cp){for(const el of candidateRows()){if(cp?.boundaryEventIdentity&&identity(el)===cp.boundaryEventIdentity)return el;if(cp?.boundaryDisplayText&&stripTime(el.textContent)===cp.boundaryDisplayText)return el}return null}
function markBoundary(cp){const old=document.getElementById(BOUNDARY_ID),row=findBoundaryRow(cp);if(!row||!row.parentNode)return false;if(old&&old.nextElementSibling===row)return true;old?.remove();const line=document.createElement('div');line.id=BOUNDARY_ID;line.textContent='ここまで保存済み';line.style.cssText='margin:7px 4px;padding:5px 8px;border-top:2px solid #69d7f2;border-bottom:1px solid #2f7183;background:rgba(18,64,78,.82);color:#bff5ff;font:900 11px/1.25 system-ui;text-align:center;border-radius:5px;pointer-events:none';row.parentNode.insertBefore(line,row);return true}
let accountId='',cached=null;
async function restore(){accountId=accountId||await account();if(!accountId)return null;const remote=await get(CHECK+accountId,{}),local=localRead(accountId);let chosen=remote&&typeof remote==='object'?remote:{};if(local&&(!chosen?.boundaryEventIdentity&&!chosen?.boundarySignature&&!chosen?.boundaryLegacySignature||boundaryAge(local)>boundaryAge(chosen))){chosen={...chosen,...local};await set(CHECK+accountId,chosen)}cached=chosen;if(chosen?.boundaryEventIdentity||chosen?.boundarySignature||chosen?.boundaryLegacySignature){localWrite(accountId,chosen);setTimeout(()=>markBoundary(chosen),120)}return chosen}
async function persist(){accountId=accountId||await account();if(!accountId)return null;let cp=await get(CHECK+accountId,{});if(!cp||typeof cp!=='object')cp={};const row=findBoundaryRow(cp);if(row)cp={...cp,boundaryDisplayText:stripTime(row.textContent),persistentMirrorAt:Date.now(),persistentMirrorVersion:VERSION};cached=cp;if(cp?.boundaryEventIdentity||cp?.boundarySignature||cp?.boundaryLegacySignature)localWrite(accountId,cp);markBoundary(cp);return cp}
const ready=restore();
document.addEventListener('mumei-notification-checkpoint',()=>void persist());
addEventListener('pageshow',()=>{void restore().then(cp=>cp&&markBoundary(cp))});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&cached&&accountId)localWrite(accountId,cached)});
addEventListener('pagehide',()=>{if(cached&&accountId)localWrite(accountId,cached)},{capture:true});
const mo=new MutationObserver(()=>{if(cached)markBoundary(cached)});mo.observe(document.documentElement,{subtree:true,childList:true});
window.__mumeiV3Checkpoint325={version:VERSION,restore,persist,ready,getCached:()=>cached,mark:()=>cached?markBoundary(cached):false};
})();