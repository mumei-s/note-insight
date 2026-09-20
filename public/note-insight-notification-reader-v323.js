(function(){
'use strict';
if(location.hostname!=='note.com')return;
const VERSION='3.2.89',PROTOCOL='3.2.89';
if(window.__mumeiV3Reader323?.version===VERSION&&window.__mumeiV3Reader323?.scan)return;
window.__mumeiNotificationReader323=true;

const INGEST='https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-notification-ingest-v2';
const TOKEN='mumei_insight_notification_sync_token_v2:',SAVED='mumei_insight_notification_saved_v2919:',CHECK='mumei_insight_notification_checkpoint_v2922:',LOCAL_CHECK='mumei_insight_notification_checkpoint_local_v325:';
const SHELL='[data-mumei-notice-shell-v3="1"]';
const ITEM='.m-navbarNoticeItem,[class*="navbarNoticeItem"],[class*="notificationItem" i],[class*="noticeItem" i],[class*="NotificationItem" i],[data-testid*="notification-item" i],[data-testid*="notice-item" i]';
const TIME_RE=/(?:たった今|昨日|\d+\s*(?:秒|分|時間|日|週|か月|ヶ月|月|年)前|\d{1,2}月\d{1,2}日|\d{4}[\/.年]\d{1,2}[\/.月]\d{1,2}日?)/u;
const EXCLUDE=new Set(['settings','sitesettings','membership','memberships','notifications','messages','search','explore','login','signup']);
const OUTBOX='mumei-notification-outbox-v323:';
const PROGRESS_ID='mumei-v3-reader-progress-v3223';
const BOUNDARY_ID='mumei-v3-saved-boundary-v3223';
const NAV_RETURN='mumei-v3-notification-return-v3223';
const MAX_SEEK_STEPS=56;
const MAX_READ_STEPS=56;
const MAX_READ_ROWS=420;
const MAX_INCREMENT_STEPS=20;
const MAX_INCREMENT_ROWS=240;
const clean=v=>String(v||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
const stripTime=v=>clean(v).replace(/\s*(?:たった今|昨日|\d+\s*(?:秒|分|時間|日|週|か月|ヶ月|月|年)前|\d{1,2}月\d{1,2}日|\d{4}[\/.年]\d{1,2}[\/.月]\d{1,2}日?)$/u,'').trim();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const modern=()=>Boolean(globalThis.GM),key=(p,id)=>p+String(id||'').toLowerCase();

async function get(k,d){try{if(modern()&&typeof GM.getValue==='function')return await GM.getValue(k,d);if(typeof GM_getValue==='function')return GM_getValue(k,d)}catch{}return d}
async function set(k,v){try{if(modern()&&typeof GM.setValue==='function')return await GM.setValue(k,v);if(typeof GM_setValue==='function')return GM_setValue(k,v)}catch{}}
function localCheckpoint(id){try{const v=JSON.parse(localStorage.getItem(key(LOCAL_CHECK,id))||'null');return v&&typeof v==='object'?v:null}catch{return null}}
function boundaryAge(v){return Number(v?.boundaryAt||v?.lastSaveAt||v?.lastCheckAt||0)}
async function checkpointFor(id){
  const remote=await get(key(CHECK,id),{}),local=localCheckpoint(id);
  let chosen=remote&&typeof remote==='object'?remote:{};
  const remoteHas=hasBoundary(chosen),localHas=hasBoundary(local);
  if(local&&localHas&&(!remoteHas||boundaryAge(local)>boundaryAge(chosen))){chosen={...chosen,...local};await set(key(CHECK,id),chosen)}
  return chosen
}
function request(url,body,headers={}){return new Promise((resolve,reject)=>{const fn=modern()&&typeof GM.xmlHttpRequest==='function'?GM.xmlHttpRequest:typeof GM_xmlhttpRequest==='function'?GM_xmlhttpRequest:null;if(!fn)return reject(new Error('USERSCRIPT_REQUEST_UNAVAILABLE'));fn({method:'POST',url,headers:{'Content-Type':'application/json',...headers},data:JSON.stringify(body),timeout:45000,onload:r=>{let p={};try{p=JSON.parse(r.responseText||'{}')}catch{};r.status>=200&&r.status<300&&p?.ok!==false?resolve(p):reject(new Error(p?.error||`HTTP_${r.status}`))},onerror:()=>reject(new Error('NETWORK_ERROR')),ontimeout:()=>reject(new Error('TIMEOUT'))})})}
function shown(el){if(!(el instanceof Element))return false;const r=el.getBoundingClientRect();if(r.width<1||r.height<1||r.right<=0||r.bottom<=0||r.left>=innerWidth||r.top>=innerHeight)return false;for(let p=el,d=0;p&&d++<14;p=p.parentElement){const s=getComputedStyle(p);if(p.hidden||p.getAttribute('aria-hidden')==='true'||p.hasAttribute('inert')||s.display==='none'||s.visibility==='hidden'||Number(s.opacity||1)<=.01)return false}return true}
function creatorId(v){try{const u=new URL(String(v||''),location.href),p=u.pathname.split('/').filter(Boolean),id=(p[0]||'').toLowerCase();return u.hostname.endsWith('note.com')&&p.length===1&&/^[a-z0-9_-]+$/.test(id)&&!EXCLUDE.has(id)?id:''}catch{return''}}
async function account(){try{const r=await fetch('/api/v2/current_user',{credentials:'include',cache:'no-store'});if(!r.ok)return null;const j=await r.json(),u=(j.data??j).user||(j.data??j),id=String(u?.urlname||u?.url_name||u?.username||'').replace(/^@/,'').toLowerCase();return/^[a-z0-9_-]+$/.test(id)?{id}:null}catch{return null}}
function rowish(el,trusted=false){if(!shown(el))return false;const t=clean(el.textContent);return t.length>=3&&t.length<=4000&&(trusted||TIME_RE.test(t))}
function rows(root){if(!root?.querySelectorAll)return[];const exact=[...root.querySelectorAll('.m-navbarNoticeItem,[data-testid="notification-item"],[data-testid="notice-item"]')].filter(el=>rowish(el,true));if(exact.length)return exact.filter(el=>!exact.some(other=>other!==el&&other.contains(el)));const known=[...root.querySelectorAll(ITEM)].filter(el=>rowish(el,true)&&!String(el.className).includes('__'));if(known.length)return known.filter(el=>!known.some(other=>other!==el&&other.contains(el)));const out=[];for(const el of root.querySelectorAll('li,[role="listitem"],a[href]')){if(!rowish(el))continue;if(out.some(x=>x.contains(el)))continue;for(let i=out.length-1;i>=0;i--)if(el.contains(out[i]))out.splice(i,1);out.push(el)}return out}
function loadedRows(root){if(!root?.querySelectorAll)return[];let xs=[...root.querySelectorAll('.m-navbarNoticeItem,[data-testid="notification-item"],[data-testid="notice-item"],[class*="navbarNoticeItem" i],[class*="notificationItem" i],[class*="noticeItem" i],[class*="notification-item" i],[class*="notice-item" i]')].filter(el=>clean(el.textContent).length>=3);if(xs.length)return xs.filter(el=>!xs.some(o=>o!==el&&o.contains(el)));xs=[...root.querySelectorAll('li,[role="listitem"]')].filter(el=>clean(el.textContent).length>=3&&TIME_RE.test(clean(el.textContent)));return xs.filter(el=>!xs.some(o=>o!==el&&o.contains(el)))}

function rediscoverPanel(){for(const el of document.querySelectorAll('[role="dialog"],[role="menu"],[popover],aside,section,main,[role="main"]')){if(!shown(el))continue;if(rows(el).length){el.setAttribute('data-mumei-notice-shell-v3','1');return el}}if(/^\/notifications(?:\/|$)/i.test(location.pathname)){const main=document.querySelector('main,[role="main"]');if(main&&shown(main)){main.setAttribute('data-mumei-notice-shell-v3','1');return main}}return null}
function panel(){const p=document.querySelector(SHELL);return p&&shown(p)&&p!==document.body&&p!==document.documentElement?p:rediscoverPanel()}
function scrollHost(p){const xs=rows(p);let x=xs[0]||p;while(x&&p.contains(x)){if(x.scrollHeight>x.clientHeight+20&&/(auto|scroll)/.test(getComputedStyle(x).overflowY))return x;if(x===p)break;x=x.parentElement}return p.scrollHeight>p.clientHeight+20?p:null}
function links(el){const out=[];for(const a of [...(el.matches('a[href]')?[el]:[]),...el.querySelectorAll('a[href]')]){try{const u=new URL(a.getAttribute('href'),location.href);if(u.hostname.endsWith('note.com'))out.push({u:u.href,t:clean(a.textContent)})}catch{}if(out.length>=18)break}return out}
function estimatedTime(raw){const m=clean(raw).match(/(\d+)\s*(秒|分|時間|日|週)前$/u);if(!m)return null;const scale={'秒':1000,'分':60000,'時間':3600000,'日':86400000,'週':604800000};return new Date(Date.now()-Number(m[1])*scale[m[2]]).toISOString()}
function eventIdentity(el,raw,tm){const id=el.getAttribute('data-notification-id')||el.getAttribute('data-notice-id')||el.querySelector('[data-notification-id]')?.getAttribute('data-notification-id');if(id)return'notice:'+id;for(const a of [...(el.matches('a[href]')?[el]:[]),...el.querySelectorAll('a[href]')]){try{const u=new URL(a.href);for(const k of['notification_id','notice_id','c','comment_id'])if(u.searchParams.get(k))return'notice:'+u.searchParams.get(k)}catch{}}if(tm&&!Number.isNaN(Date.parse(tm)))return'time:'+new Date(tm).toISOString();return'label:'+(stripTime(raw).slice(0,180)||'unknown')}
function rowData(el){const raw=clean(el.textContent);if(!raw||raw.length>4000)return null;const ls=links(el),actor=ls.find(x=>creatorId(x.u))||null,target=ls.find(x=>/[?&]kind=/.test(x.u))||ls.find(x=>/\/n\/|\/m\/|\/membership|kind=|scrollpos=comment/i.test(x.u))||null,tm=el.querySelector('time[datetime]')?.getAttribute('datetime')||el.querySelector('[datetime]')?.getAttribute('datetime')||null,m=stripTime(raw).match(/^(.{1,180}?)\s*さん/u);let img=null;for(const x of el.querySelectorAll('img[src]')){const src=String(x.currentSrc||x.src||'');if(src&&!/cover|ogp|magazine/i.test(src)){img=src;break}}return{raw_text:raw,actor_name:actor?.t||m?.[1]||null,actor_url:actor?.u||null,actor_image_url:img,target_title:target?.t||null,target_url:target?.u||null,source_url:target?.u||actor?.u||'https://note.com/',occurred_at:tm||estimatedTime(raw),meta:{source:'note-notification-manual-sync-v2968',capture_source:'note-notification-reader-v323',userscript:VERSION,protocol:PROTOCOL,scan_mode:'incremental-top-until-saved',scan_strategy:'top-until-first-saved-v329',event_identity:eventIdentity(el,raw,tm),verified_shell:true,time_estimated:!tm,article_url:ls.find(x=>/\/n\//.test(x.u))?.u||null,magazine_url:ls.find(x=>/\/m\//.test(x.u))?.u||null,links:ls.map(x=>({url:x.u,title:x.t}))}}}
const sig=r=>[stripTime(r.raw_text),String(r.target_url||'').split('#')[0],String(r.actor_url||'').split('?')[0],r.meta?.event_identity||r.occurred_at||'unknown'].join('|');
const legacySig=r=>[stripTime(r.raw_text),String(r.target_url||'').split('#')[0],String(r.actor_url||'').split('?')[0]].join('|');
function readOutbox(id){try{const v=JSON.parse(localStorage.getItem(key(OUTBOX,id))||'[]');return Array.isArray(v)?v:[]}catch{return[]}}
function writeOutbox(id,rs){localStorage.setItem(key(OUTBOX,id),JSON.stringify(rs))}
function retain(id,rs){const m=new Map(readOutbox(id).map(r=>[sig(r),r]));for(const r of rs)m.set(sig(r),r);writeOutbox(id,[...m.values()])}
function progressNode(){let el=document.getElementById(PROGRESS_ID);if(el)return el;el=document.createElement('div');el.id=PROGRESS_ID;el.setAttribute('role','status');el.style.cssText='position:fixed;right:8px;bottom:calc(env(safe-area-inset-bottom,0px) + 54px);z-index:2147483646;display:none;max-width:min(72vw,360px);padding:4px 7px;border:1px solid #3c5d72;border-radius:7px;background:rgba(7,18,27,.94);color:#dff7ff;font:900 9.5px/1.25 system-ui,-apple-system,sans-serif;box-shadow:0 -1px 5px rgba(0,0,0,.24);pointer-events:none;text-align:center';(document.body||document.documentElement).appendChild(el);return el}
let progressTimer=0;
function paintProgress(message,kind){
  const el=progressNode();
  clearTimeout(progressTimer);
  if(kind!=='done'&&kind!=='error'){el.style.display='none';el.textContent='';return}
  el.textContent=String(message||'');
  el.style.display=message?'block':'none';
  el.style.borderColor=kind==='error'?'#c95b68':'#56a77b';
  el.style.color=kind==='error'?'#ffd5da':'#caffda';
  progressTimer=setTimeout(()=>{if(el.isConnected)el.style.display='none'},kind==='error'?6000:2500)
}
function status(message,kind='info',label='',extra={}){paintProgress(message,kind);document.dispatchEvent(new CustomEvent('mumei-v3-reader-status',{detail:{message:String(message||''),kind,label,scanning,...extra}}))}
function clearBoundary(){document.getElementById(BOUNDARY_ID)?.remove()}
function markBoundary(el){clearBoundary();if(!(el instanceof Element)||!el.parentNode)return;const line=document.createElement('div');line.id=BOUNDARY_ID;line.textContent='ここまで保存済み';line.style.cssText='margin:7px 4px;padding:5px 8px;border-top:2px solid #69d7f2;border-bottom:1px solid #2f7183;background:rgba(18,64,78,.82);color:#bff5ff;font:900 11px/1.25 system-ui;text-align:center;border-radius:5px;pointer-events:none';el.parentNode.insertBefore(line,el)}
async function requestRetry(body,token){let last=null;for(let attempt=0;attempt<3;attempt++){try{return await request(INGEST,body,{'X-Ingest-Token':token})}catch(e){last=e;const m=String(e?.message||e);if(/401|403|TOKEN|ACCOUNT_CHANGED|連携/i.test(m))throw e;if(attempt<2)await sleep(650*(attempt+1))}}throw last||new Error('NETWORK_ERROR')}
async function sendBatch(input,a,saved){if(!input.length)return 0;retain(a.id,input.filter(r=>!saved.has(sig(r))));const token=String(await get(key(TOKEN,a.id),'')||'');if(!token)throw new Error('本人連携が必要です');let total=0;for(let i=0;i<input.length;i+=20){const part=input.slice(i,i+20).filter(r=>!saved.has(sig(r)));if(!part.length)continue;const current=await account();if(current?.id!==a.id)throw new Error('NOTE_ACCOUNT_CHANGED');const payload=part.map(r=>({...r,meta:{...(r.meta||{}),client_signature:sig(r)}}));const p=await requestRetry({noteId:a.id,notifications:payload},token);const sent=new Set(payload.map(sig)),confirmed=[...new Set(Array.isArray(p.confirmedClientSignatures)?p.confirmedClientSignatures.map(String).filter(s=>sent.has(s)):[])];for(const s of confirmed)saved.add(s);await set(key(SAVED,a.id),[...saved]);if(confirmed.length){const last=part.filter(r=>confirmed.includes(sig(r))).at(-1),cp=await get(key(CHECK,a.id),{}),now=Date.now();await set(key(CHECK,a.id),{...cp,lastSaveAt:now,lastCheckAt:now,savedCount:saved.size,lastError:'',version:VERSION,boundarySignature:sig(last),boundaryEventIdentity:last.meta?.event_identity,boundaryLegacySignature:legacySig(last),boundaryDisplayText:stripTime(last.raw_text),boundaryAt:now,boundarySource:'reader-incremental-confirmed-v329'});document.dispatchEvent(new Event('mumei-notification-checkpoint'))}writeOutbox(a.id,readOutbox(a.id).filter(r=>!saved.has(sig(r))));total+=confirmed.length;if(confirmed.length!==payload.length)throw new Error('一部の通知が未保存です。再読込で再試行します')}return total}

let scanning=false,active=null;
function capturePending(){if(!active)return;const{a,p,saved}=active;try{const rs=rows(p).map(rowData).filter(r=>r&&!saved.has(sig(r)));retain(a.id,rs.reverse())}catch{}}
function pauseCapture(){capturePending()}
addEventListener('pagehide',pauseCapture,{capture:true});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')pauseCapture()},{capture:true});

function boundaryMatch(r,cp){if(!r||!cp)return false;if(cp.boundaryEventIdentity&&r.meta?.event_identity===cp.boundaryEventIdentity)return true;if(cp.boundarySignature&&sig(r)===cp.boundarySignature)return true;if(cp.boundaryLegacySignature&&legacySig(r)===cp.boundaryLegacySignature)return true;if(cp.boundaryDisplayText&&stripTime(r.raw_text)===cp.boundaryDisplayText)return true;return false}
function hasBoundary(cp){return Boolean(cp?.boundaryEventIdentity||cp?.boundarySignature||cp?.boundaryLegacySignature)}
function findBoundaryElement(p,cp){for(const el of loadedRows(p)){const r=rowData(el);if(r&&boundaryMatch(r,cp))return el}return null}
function findSavedRecoveryElement(p,saved){
  if(!saved?.size)return null;
  for(const el of loadedRows(p)){
    const r=rowData(el);
    if(r&&saved.has(sig(r)))return{el,row:r};
  }
  return null
}
async function persistRecoveredBoundary(a,cp,row,source){
  if(!a?.id||!row)return cp;
  const now=Date.now();
  const next={...cp,boundarySignature:sig(row),boundaryEventIdentity:row.meta?.event_identity,boundaryLegacySignature:legacySig(row),boundaryDisplayText:stripTime(row.raw_text),boundaryAt:now,boundarySource:source||'reader-recovered-saved-v326',lastError:'',lastRunStopped:false,version:VERSION};
  await set(key(CHECK,a.id),next);
  document.dispatchEvent(new Event('mumei-notification-checkpoint'));
  return next
}
function saveReturnPosition(p,host,el){try{const r=rowData(el);if(!r)return;sessionStorage.setItem(NAV_RETURN,JSON.stringify({href:location.href,legacy:legacySig(r),scrollTop:host?.scrollTop||0,at:Date.now()}))}catch{}}
async function restoreReturnPosition(){if(!/^\/notifications(?:\/|$)/i.test(location.pathname))return;let st=null;try{st=JSON.parse(sessionStorage.getItem(NAV_RETURN)||'null')}catch{}if(!st||Date.now()-Number(st.at||0)>30*60*1000)return;for(let i=0;i<28;i++){const p=panel();if(p){const host=scrollHost(p),els=rows(p);for(const el of els){const r=rowData(el);if(r&&legacySig(r)===st.legacy){try{el.scrollIntoView({block:'center',behavior:'auto'});if(host&&Number.isFinite(st.scrollTop))host.scrollTop=st.scrollTop}catch{}sessionStorage.removeItem(NAV_RETURN);return}}if(host){const max=Math.max(0,host.scrollHeight-host.clientHeight);if(host.scrollTop<max-2)host.scrollTop=Math.min(max,host.scrollTop+Math.max(220,Math.floor(host.clientHeight*.8)))}}await sleep(180)}}

document.addEventListener('click',e=>{const p=panel();if(!p)return;const a=e.target?.closest?.('a[href]');if(!a||!p.contains(a))return;let u;try{u=new URL(a.href,location.href)}catch{return}if(!u.hostname.endsWith('note.com'))return;const el=a.closest(ITEM+',li,[role="listitem"]');if(!el)return;saveReturnPosition(p,scrollHost(p),el)},{capture:true});

async function seekStart(p,host,cp,saved){
 const needBoundary=hasBoundary(cp),needSaved=Boolean(saved?.size),needAnchor=needBoundary||needSaved;
 let recovery=findSavedRecoveryElement(p,saved);
 const exactNow=needBoundary?findBoundaryElement(p,cp):null;
 if(exactNow){markBoundary(exactNow);try{exactNow.scrollIntoView({block:'center',behavior:'auto'})}catch{}await sleep(60);return{ok:true,boundaryFound:true,recovered:false}}
 if(recovery){markBoundary(recovery.el);return{ok:true,boundaryFound:true,recovered:true,recoveryRow:recovery.row}}
 if(!host){
  if(needAnchor)return{ok:true,boundaryFound:false,preserveBoundary:true};
  return{ok:true,boundaryFound:false,recovered:false};
 }
 try{host.scrollTop=0}catch{}
 await sleep(100);
 let stable=0,lastTop=-1;
 for(let step=0;step<MAX_SEEK_STEPS;step++){
  const el=needBoundary?findBoundaryElement(p,cp):null;
  if(el){markBoundary(el);try{el.scrollIntoView({block:'center',behavior:'auto'})}catch{}await sleep(80);return{ok:true,boundaryFound:true,recovered:false}}
  recovery=findSavedRecoveryElement(p,saved);
  if(recovery){markBoundary(recovery.el);try{recovery.el.scrollIntoView({block:'center',behavior:'auto'})}catch{}await sleep(80);return{ok:true,boundaryFound:true,recovered:true,recoveryRow:recovery.row}}
  const max=Math.max(0,host.scrollHeight-host.clientHeight),before=host.scrollTop;
  if(before>=max-2){stable++;if(stable>=2)break}else{const amount=Math.max(220,Math.floor(host.clientHeight*.86));host.scrollTop=Math.min(max,before+amount);await sleep(170);if(Math.abs(host.scrollTop-before)<2)stable++;else stable=0}
  if(host.scrollTop===lastTop)stable++;lastTop=host.scrollTop;if(stable>=3)break;
 }
 if(needAnchor)return{ok:true,boundaryFound:false,preserveBoundary:true};
 const max=Math.max(0,host.scrollHeight-host.clientHeight);try{host.scrollTop=max}catch{}await sleep(80);
 return{ok:true,boundaryFound:false,recovered:false};
}
async function collectBottomUp(p,host,cp){
 const needBoundary=hasBoundary(cp);
 const collected=[],seen=new Set();
 let crossed=!needBoundary,found=!needBoundary,stable=0,lastTop=host?.scrollTop??0;
 for(let step=0;step<MAX_READ_STEPS&&collected.length<MAX_READ_ROWS;step++){
  const nextPanel=panel();if(!nextPanel)throw new Error('通知一覧を閉じたため中断しました');if(nextPanel!==p){p=nextPanel;host=scrollHost(p);active.p=p}
  const els=rows(p);
  for(let i=els.length-1;i>=0;i--){
   const el=els[i],r=rowData(el);if(!r)continue;
   const k=sig(r);if(seen.has(k))continue;seen.add(k);
   if(!crossed){if(boundaryMatch(r,cp)){crossed=true;found=true;markBoundary(el)}continue}
   if(boundaryMatch(r,cp))continue;
   if(!active.saved.has(k)){collected.push(r);if(collected.length>=MAX_READ_ROWS)break}
  }
  if(collected.length>=MAX_READ_ROWS||!host)break;
  const before=host.scrollTop;
  if(before<=2){stable++;if(stable>=2)break}else{const amount=Math.max(220,Math.floor(host.clientHeight*.82));host.scrollTop=Math.max(0,before-amount);await sleep(170);if(Math.abs(host.scrollTop-before)<2)stable++;else stable=0}
  if(host.scrollTop===lastTop)stable++;lastTop=host.scrollTop;if(stable>=3)break;
 }
 return{p,host,collected,seenCount:seen.size,boundaryFound:found};
}

async function collectIncrementalFromTop(p,host,cp,saved){
 const needAnchor=hasBoundary(cp)||Boolean(saved?.size);
 const collected=[],seen=new Set();
 let anchorFound=false,anchorRow=null,stable=0,lastTop=-1;
 if(host){try{host.scrollTop=0}catch{}await sleep(100)}
 for(let step=0;step<MAX_INCREMENT_STEPS&&collected.length<MAX_INCREMENT_ROWS;step++){
  const nextPanel=panel();if(!nextPanel)throw new Error('通知一覧を閉じたため中断しました');
  if(nextPanel!==p){p=nextPanel;host=scrollHost(p);active.p=p;if(host&&step===0){try{host.scrollTop=0}catch{}}}
  const els=rows(p);
  for(let i=0;i<els.length;i++){
   const el=els[i],r=rowData(el);if(!r)continue;
   const k=sig(r);if(seen.has(k))continue;seen.add(k);
   if(saved.has(k)||boundaryMatch(r,cp)){anchorFound=true;anchorRow=r;markBoundary(el);break}
   collected.push(r);
   if(collected.length>=MAX_INCREMENT_ROWS)break
  }
  if(anchorFound||collected.length>=MAX_INCREMENT_ROWS)break;
  if(!needAnchor)break;
  if(!host)break;
  const max=Math.max(0,host.scrollHeight-host.clientHeight),before=host.scrollTop;
  if(before>=max-2){stable++;if(stable>=2)break}
  else{
   const amount=Math.max(220,Math.floor(host.clientHeight*.82));
   host.scrollTop=Math.min(max,before+amount);
   await sleep(170);
   if(Math.abs(host.scrollTop-before)<2)stable++;else stable=0
  }
  if(host.scrollTop===lastTop)stable++;lastTop=host.scrollTop;if(stable>=3)break
 }
 return{p,host,collected,seenCount:seen.size,anchorFound,anchorRow,needAnchor}
}

async function scan(){
 if(scanning){status('読込中です。二重開始はしません。','saving','読込中');return 0}
 scanning=true;let a=null,saved=null,p=null,host=null,count=0,safetyStop=false;
 status('新しい通知だけ確認しています…','saving','差分読込');
 try{
  p=panel();if(!p)throw new Error('本物の🔔通知一覧を開いてください');
  a=await account();if(!a)throw new Error('noteログインを確認してください');
  if(!String(await get(key(TOKEN,a.id),'')||''))throw new Error('本人連携が必要です');
  let cp=await checkpointFor(a.id),savedRaw=await get(key(SAVED,a.id),[]);
  saved=new Set(Array.isArray(savedRaw)?savedRaw.map(String):[]);
  active={a,p,saved};
  count+=await sendBatch(readOutbox(a.id),a,saved);
  cp=await checkpointFor(a.id);host=scrollHost(p);
  const result=await collectIncrementalFromTop(p,host,cp,saved);p=result.p;host=result.host;

  if(result.needAnchor&&!result.anchorFound){
   safetyStop=true;
   const latest=await checkpointFor(a.id),now=Date.now();
   await set(key(CHECK,a.id),{...latest,lastCheckAt:now,lastError:'INCREMENTAL_ANCHOR_NOT_FOUND',lastScanMode:'incremental-top-until-saved',lastRunStopped:true,version:VERSION});
   document.dispatchEvent(new Event('mumei-notification-checkpoint'));
   status('⚠ 保存済み位置まで届きませんでした。通常読込では過去へ潜りません。「全読み」で履歴を回収してください。','error','全読みを使用',{readCount:result.seenCount,savedCount:count});
   return count
  }

  if(result.collected.length)count+=await sendBatch(result.collected,a,saved);
  const latest=await get(key(CHECK,a.id),{}),now=Date.now();
  await set(key(CHECK,a.id),{...latest,lastCheckAt:now,manualNewCount:count,manualSeenCount:result.seenCount,lastError:'',lastScanMode:'incremental-top-until-saved',lastRunStopped:false,historyComplete:false,version:VERSION});
  document.dispatchEvent(new Event('mumei-notification-checkpoint'));
  const remain=readOutbox(a.id).length;
  if(remain)status(`⚠ ${remain}件は次回保存待ち｜差分 ${result.seenCount}件確認`,'error','保存待ち',{readCount:result.seenCount,savedCount:count,pendingCount:remain});
  else if(result.anchorFound)status(`✓ 保存済み通知で停止｜新規 ${count}件`,'done','✓ 差分保存',{readCount:result.seenCount,savedCount:count});
  else status(`✓ 現在表示分を保存｜新規 ${count}件`,'done','✓ 初回差分保存',{readCount:result.seenCount,savedCount:count});
  return count
 }catch(e){
  if(!safetyStop)capturePending();
  if(a){try{const cp=await get(key(CHECK,a.id),{}),pending=readOutbox(a.id).length;await set(key(CHECK,a.id),{...cp,lastError:String(e?.message||e),lastCheckAt:Date.now(),pendingCount:pending,lastScanMode:'incremental-top-until-saved',lastRunStopped:safetyStop,version:VERSION})}catch{}}
  const pending=a?readOutbox(a.id).length:0,msg=String(e?.message||e);
  status(`⚠ ${msg}${pending?`｜${pending}件は次回保存待ち`:''}`,'error',/連携/.test(msg)?'連携必要':'再読込',{pendingCount:pending});
  return count
 }finally{active=null;scanning=false;document.dispatchEvent(new CustomEvent('mumei-v3-reader-stopped'))}
}

document.addEventListener('mumei-v3-read-request',()=>void scan());
function readyToScan(){const p=panel();return Boolean(p&&rows(p).length)}
window.__mumeiV3Reader323={scan,isScanning:()=>scanning,readyToScan,version:VERSION};
window.__mumeiV3Reader323Ready=true;
document.dispatchEvent(new Event('mumei-v3-reader-ready'));
setTimeout(()=>void restoreReturnPosition(),250);
})();