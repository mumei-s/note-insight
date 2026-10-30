(function(){
'use strict';
if(location.hostname!=='note.com')return;
if(window.__mumeiV3Checkpoint325)return;
const VERSION='3.6.4';
const CHECK='mumei_insight_notification_checkpoint_v2922:';
const LOCAL='mumei_insight_notification_checkpoint_local_v325:';
const BOUNDARY_ID='mumei-v3-saved-boundary-v3223';
const SHELL='[data-mumei-notice-shell-v3="1"]';
const ITEM='.m-navbarNoticeItem,[class*="navbarNoticeItem" i],[class*="notificationItem" i],[class*="noticeItem" i],[data-testid*="notification-item" i],[data-testid*="notice-item" i],li,[role="listitem"]';
const clean=v=>String(v||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
const stripTime=v=>clean(v).replace(/\s*(?:たった今|昨日|\d+\s*(?:秒|分|時間|日|週|か月|ヶ月|月|年)前|\d{1,2}月\d{1,2}日|\d{4}[\/.年]\d{1,2}[\/.月]\d{1,2}日?)$/u,'').trim();
const modern=()=>(typeof GM!=='undefined'&&Boolean(GM));
async function get(k,d){try{if(modern()&&typeof GM.getValue==='function')return await GM.getValue(k,d);if(typeof GM_getValue==='function')return GM_getValue(k,d)}catch{}return d}
async function set(k,v){try{if(modern()&&typeof GM.setValue==='function')return await GM.setValue(k,v);if(typeof GM_setValue==='function')return GM_setValue(k,v)}catch{}}
async function account(){try{const r=await fetch('/api/v2/current_user',{credentials:'include',cache:'no-store'});if(!r.ok)return'';const j=await r.json(),u=(j.data??j).user||(j.data??j),id=clean(u?.urlname||u?.url_name||u?.username).replace(/^@/,'').toLowerCase();return/^[a-z0-9_-]+$/.test(id)?id:''}catch{return''}}
function localRead(id){try{const v=JSON.parse(localStorage.getItem(LOCAL+id)||'null');return v&&typeof v==='object'?v:null}catch{return null}}
function localWrite(id,v){try{localStorage.setItem(LOCAL+id,JSON.stringify(v))}catch{}}
function boundaryAge(v){return Number(v?.boundaryAt||v?.lastSaveAt||v?.lastCheckAt||0)}
function identity(el){const id=el?.getAttribute?.('data-notification-id')||el?.getAttribute?.('data-notice-id')||el?.querySelector?.('[data-notification-id]')?.getAttribute?.('data-notification-id');if(id)return'notice:'+id;for(const a of el?.querySelectorAll?.('a[href]')||[]){try{const u=new URL(a.href,location.href);for(const k of['notification_id','notice_id','c','comment_id'])if(u.searchParams.get(k))return'notice:'+u.searchParams.get(k)}catch{}}const label=stripTime(el?.textContent||'').slice(0,180);return label?'label:'+label:''}
function visible(el){if(!(el instanceof Element))return false;const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&r.bottom>0&&r.right>0&&r.top<innerHeight&&r.left<innerWidth}
function creatorId(v){try{const u=new URL(String(v||''),location.href),p=u.pathname.split('/').filter(Boolean),id=(p[0]||'').toLowerCase();return u.hostname.endsWith('note.com')&&p.length===1&&/^[a-z0-9_-]+$/.test(id)&&!['settings','sitesettings','membership','memberships','notifications','messages','search','explore','login','signup'].includes(id)?id:''}catch{return''}}
function rowLegacySignature(el){
  const links=[];
  for(const a of [...(el?.matches?.('a[href]')?[el]:[]),...(el?.querySelectorAll?.('a[href]')||[])]){
    try{const u=new URL(a.getAttribute('href'),location.href);if(u.hostname.endsWith('note.com'))links.push(u.href)}catch{}
    if(links.length>=18)break
  }
  const actor=links.find(u=>creatorId(u))||'';
  const target=links.find(u=>/[?&]kind=/.test(u))||links.find(u=>/\/n\/|\/m\/|\/membership|kind=|scrollpos=comment/i.test(u))||'';
  return [stripTime(el?.textContent||''),String(target||'').split('#')[0],String(actor||'').split('?')[0]].join('|')
}
function candidateRows(){const root=window.__mumeiNotificationReaderV4?.findPanel?.()||document.querySelector(SHELL)||(/^\/notifications(?:\/|$)/i.test(location.pathname)?document.querySelector('main,[role="main"]'):null);if(!root)return[];const xs=[...root.querySelectorAll(ITEM)].filter(el=>clean(el.textContent).length>=3),selected=new Set(xs);return xs.filter(el=>{for(let parent=el.parentElement;parent;parent=parent.parentElement)if(selected.has(parent))return false;return true})}
function findBoundaryRow(cp){
  const xs=candidateRows(),eventId=String(cp?.boundaryEventIdentity||''),legacy=String(cp?.boundaryLegacySignature||''),display=String(cp?.boundaryDisplayText||'');
  // An exposed native notice ID is stronger than a repeated notification body.
  // Find it across the whole list before considering older text-only captures.
  const nativeId=eventId.startsWith('notice:');
  if(nativeId){const exact=xs.find(el=>identity(el)===eventId);if(exact)return exact}
  const matches=[];
  for(const el of xs){
    const actualId=identity(el),idOk=eventId?actualId===eventId:false;
    if(nativeId&&actualId.startsWith('notice:')&&!idOk)continue;
    const legacyOk=legacy?rowLegacySignature(el)===legacy:false;
    // Network identities are not always exposed as DOM data attributes.
    // Match the acknowledged body and target, including the appended preview.
    const compact=v=>stripTime(v).replace(/\s/g,''),body=compact(display),content=compact(el.textContent);
    const bodyOk=body&&content.startsWith(body);
    const target=String(cp?.boundaryTargetUrl||'').split('#')[0];
    const targetOk=!target||[...(el.matches('a[href]')?[el]:[]),...el.querySelectorAll('a[href]')].some(a=>String(a.href).split('#')[0]===target);
    if(bodyOk&&targetOk){matches.push(el);continue}
    if(display&&!bodyOk)continue;
    if(eventId&&legacy){if(idOk&&legacyOk||!actualId.startsWith('notice:')&&legacyOk)matches.push(el);continue}
    if(eventId){if(idOk)matches.push(el);continue}
    if(legacy){if(legacyOk)matches.push(el);continue}
    if(display&&stripTime(el.textContent)===display)matches.push(el)
  }
  // Ambiguous text-only rows cannot prove which repeated event was saved.
  return matches.length===1?matches[0]:null
}
function lineNode(text,fallback=false){const line=document.createElement('div');line.id=BOUNDARY_ID;line.dataset.fallback=fallback?'1':'0';line.textContent=text;line.style.cssText='margin:7px 4px;padding:5px 8px;border-top:2px solid #69d7f2;border-bottom:1px solid #2f7183;background:rgba(18,64,78,.82);color:#bff5ff;font:900 11px/1.25 system-ui;text-align:center;border-radius:5px;pointer-events:none';return line}
function markBoundary(cp){
  const old=document.getElementById(BOUNDARY_ID),row=findBoundaryRow(cp);
  if(row&&row.parentNode){
    if(old&&old.nextElementSibling===row&&old.dataset.fallback!=='1')return true;
    old?.remove();row.parentNode.insertBefore(lineNode('ここまで保存済み'),row);return true
  }
  old?.remove();
  return false
}
let accountId='',cached=null,generation=0,restoreTimer=0;
function clearCached(){accountId='';cached=null;document.getElementById(BOUNDARY_ID)?.remove()}
async function restore(){
 if(document.visibilityState==='hidden')return null;
 const request=++generation;clearCached();const id=await account(),valid=()=>request===generation;
 if(!id||!valid())return null;
 const remote=await get(CHECK+id,{});if(!valid())return null;
 const local=localRead(id);let chosen=remote&&typeof remote==='object'?remote:{};
 const remoteHas=Boolean(chosen?.boundaryEventIdentity||chosen?.boundarySignature||chosen?.boundaryLegacySignature),localHas=Boolean(local?.boundaryEventIdentity||local?.boundarySignature||local?.boundaryLegacySignature);
 if(local&&localHas&&(!remoteHas||boundaryAge(local)>boundaryAge(chosen))){chosen={...chosen,...local};if(!valid())return null;await set(CHECK+id,chosen);if(!valid())return null}
 accountId=id;cached=chosen;
 if(chosen?.boundaryEventIdentity||chosen?.boundarySignature||chosen?.boundaryLegacySignature){localWrite(id,chosen);setTimeout(()=>{if(valid()&&accountId===id&&cached===chosen)markBoundary(chosen)},80)}
 return chosen
}
async function persist(){
 if(document.visibilityState==='hidden')return null;
 const request=++generation;clearCached();const id=await account(),valid=()=>request===generation;
 if(!id||!valid())return null;
 let cp=await get(CHECK+id,{});if(!valid())return null;if(!cp||typeof cp!=='object')cp={};
 const row=findBoundaryRow(cp);if(row)cp={...cp,boundaryDisplayText:stripTime(row.textContent),persistentMirrorAt:Date.now(),persistentMirrorVersion:VERSION};
 accountId=id;cached=cp;if(cp?.boundaryEventIdentity||cp?.boundarySignature||cp?.boundaryLegacySignature)localWrite(id,cp);markBoundary(cp);return cp
}
function scheduleRestore(){if(restoreTimer||document.visibilityState==='hidden')return;generation++;clearCached();restoreTimer=setTimeout(()=>{restoreTimer=0;void restore()},0)}
function suspendScope(){if(cached&&accountId)localWrite(accountId,cached);generation++;clearCached();clearTimeout(restoreTimer);restoreTimer=0}
const ready=restore();
document.addEventListener('mumei-notification-checkpoint',()=>void persist());
addEventListener('pageshow',scheduleRestore);addEventListener('focus',scheduleRestore);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')suspendScope();else scheduleRestore()});
addEventListener('pagehide',suspendScope,{capture:true});
window.__mumeiV3Checkpoint325={version:VERSION,restore,persist,ready,getCached:()=>cached,mark:()=>cached?markBoundary(cached):false};
})();
