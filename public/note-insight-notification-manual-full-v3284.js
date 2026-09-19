(function(){
'use strict';
if(location.hostname!=='note.com')return;
if(window.__mumeiNotificationManualFull3284)return;
window.__mumeiNotificationManualFull3284=true;

const VERSION='3.2.84';
const ROOT='mumei-v325-dock';
const MENU='mumei-v3284-manual-read-choice';
const INGEST='https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-notification-ingest-v2';
const TOKEN='mumei_insight_notification_sync_token_v2:';
const SAVED='mumei_insight_notification_saved_v2919:';
const FULL_OUTBOX='mumei-notification-fullread-outbox-v3284:';
const FULL_STATE='mumei-notification-fullread-state-v3284:';
const ITEM='.m-navbarNoticeItem,[class*="navbarNoticeItem" i],[class*="notificationItem" i],[class*="noticeItem" i],[class*="NotificationItem" i],[data-testid*="notification-item" i],[data-testid*="notice-item" i]';
const TIME_RE=/(?:たった今|昨日|\d+\s*(?:秒|分|時間|日|週|か月|ヶ月|月|年)前|\d{1,2}月\d{1,2}日|\d{4}[\/.年]\d{1,2}[\/.月]\d{1,2}日?)/u;
const EXCLUDE=new Set(['settings','sitesettings','membership','memberships','notifications','messages','search','explore','login','signup']);
const clean=v=>String(v||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
const stripTime=v=>clean(v).replace(/\s*(?:たった今|昨日|\d+\s*(?:秒|分|時間|日|週|か月|ヶ月|月|年)前|\d{1,2}月\d{1,2}日|\d{4}[\/.年]\d{1,2}[\/.月]\d{1,2}日?)$/u,'').trim();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const modern=()=>Boolean(globalThis.GM),key=(p,id)=>p+String(id||'').toLowerCase();

async function get(k,d){try{if(modern()&&typeof GM.getValue==='function')return await GM.getValue(k,d);if(typeof GM_getValue==='function')return GM_getValue(k,d)}catch{}return d}
async function set(k,v){try{if(modern()&&typeof GM.setValue==='function')return await GM.setValue(k,v);if(typeof GM_setValue==='function')return GM_setValue(k,v)}catch{}}
function request(url,body,headers={}){return new Promise((resolve,reject)=>{const fn=modern()&&typeof GM.xmlHttpRequest==='function'?GM.xmlHttpRequest:typeof GM_xmlhttpRequest==='function'?GM_xmlhttpRequest:null;if(!fn)return reject(new Error('USERSCRIPT_REQUEST_UNAVAILABLE'));fn({method:'POST',url,headers:{'Content-Type':'application/json',...headers},data:JSON.stringify(body),timeout:45000,onload:r=>{let p={};try{p=JSON.parse(r.responseText||'{}')}catch{};r.status>=200&&r.status<300&&p?.ok!==false?resolve(p):reject(new Error(p?.error||`HTTP_${r.status}`))},onerror:()=>reject(new Error('NETWORK_ERROR')),ontimeout:()=>reject(new Error('TIMEOUT'))})})}
async function requestRetry(body,token){let last=null;for(let attempt=0;attempt<3;attempt++){try{return await request(INGEST,body,{'X-Ingest-Token':token})}catch(e){last=e;const m=String(e?.message||e);if(/401|403|TOKEN|ACCOUNT_CHANGED|連携/i.test(m))throw e;if(attempt<2)await sleep(650*(attempt+1))}}throw last||new Error('NETWORK_ERROR')}

function shown(el){if(!(el instanceof Element))return false;const r=el.getBoundingClientRect();if(r.width<1||r.height<1||r.right<=0||r.bottom<=0||r.left>=innerWidth||r.top>=innerHeight)return false;for(let p=el,d=0;p&&d++<14;p=p.parentElement){const s=getComputedStyle(p);if(p.hidden||p.getAttribute('aria-hidden')==='true'||p.hasAttribute('inert')||s.display==='none'||s.visibility==='hidden'||Number(s.opacity||1)<=.01)return false}return true}
function creatorId(v){try{const u=new URL(String(v||''),location.href),p=u.pathname.split('/').filter(Boolean),id=(p[0]||'').toLowerCase();return u.hostname.endsWith('note.com')&&p.length===1&&/^[a-z0-9_-]+$/.test(id)&&!EXCLUDE.has(id)?id:''}catch{return''}}
async function account(){try{const r=await fetch('/api/v2/current_user',{credentials:'include',cache:'no-store'});if(!r.ok)return null;const j=await r.json(),u=(j.data??j).user||(j.data??j),id=String(u?.urlname||u?.url_name||u?.username||'').replace(/^@/,'').toLowerCase();return/^[a-z0-9_-]+$/.test(id)?{id}:null}catch{return null}}
function rowish(el,trusted=false){if(!shown(el))return false;const t=clean(el.textContent);return t.length>=3&&t.length<=4000&&(trusted||TIME_RE.test(t))}
function rows(root){if(!root?.querySelectorAll)return[];const exact=[...root.querySelectorAll('.m-navbarNoticeItem,[data-testid="notification-item"],[data-testid="notice-item"]')].filter(el=>rowish(el,true));if(exact.length)return exact.filter(el=>!exact.some(other=>other!==el&&other.contains(el)));const known=[...root.querySelectorAll(ITEM)].filter(el=>rowish(el,true)&&!String(el.className).includes('__'));if(known.length)return known.filter(el=>!known.some(other=>other!==el&&other.contains(el)));const out=[];for(const el of root.querySelectorAll('li,[role="listitem"],a[href]')){if(!rowish(el))continue;if(out.some(x=>x.contains(el)))continue;for(let i=out.length-1;i>=0;i--)if(el.contains(out[i]))out.splice(i,1);out.push(el)}return out}
function panel(){const rt=window.__mumeiV3Runtime328||window.__mumeiV3Runtime327||window.__mumeiV3Runtime325;const p=rt?.findSurface?.()||document.querySelector('[data-mumei-notice-shell-v3="1"]');return p&&shown(p)&&p!==document.body&&p!==document.documentElement?p:null}
function scrollHost(p){const xs=rows(p);let x=xs[0]||p;while(x&&p.contains(x)){if(x.scrollHeight>x.clientHeight+20&&/(auto|scroll)/.test(getComputedStyle(x).overflowY))return x;if(x===p)break;x=x.parentElement}if(p.scrollHeight>p.clientHeight+20)return p;if(/^\/notifications(?:\/|$)/i.test(location.pathname)){const d=document.scrollingElement;if(d&&d.scrollHeight>innerHeight+20)return d}return null}
function links(el){const out=[];for(const a of [...(el.matches('a[href]')?[el]:[]),...el.querySelectorAll('a[href]')]){try{const u=new URL(a.getAttribute('href'),location.href);if(u.hostname.endsWith('note.com'))out.push({u:u.href,t:clean(a.textContent)})}catch{}if(out.length>=18)break}return out}
function estimatedTime(raw){const m=clean(raw).match(/(\d+)\s*(秒|分|時間|日|週)前$/u);if(!m)return null;const scale={'秒':1000,'分':60000,'時間':3600000,'日':86400000,'週':604800000};return new Date(Date.now()-Number(m[1])*scale[m[2]]).toISOString()}
function eventIdentity(el,raw,tm){const id=el.getAttribute('data-notification-id')||el.getAttribute('data-notice-id')||el.querySelector('[data-notification-id]')?.getAttribute('data-notification-id');if(id)return'notice:'+id;for(const a of [...(el.matches('a[href]')?[el]:[]),...el.querySelectorAll('a[href]')]){try{const u=new URL(a.href);for(const k of['notification_id','notice_id','c','comment_id'])if(u.searchParams.get(k))return'notice:'+u.searchParams.get(k)}catch{}}if(tm&&!Number.isNaN(Date.parse(tm)))return'time:'+new Date(tm).toISOString();return'label:'+(stripTime(raw).slice(0,180)||'unknown')}
function rowData(el){const raw=clean(el.textContent);if(!raw||raw.length>4000)return null;const ls=links(el),actor=ls.find(x=>creatorId(x.u))||null,target=ls.find(x=>/[?&]kind=/.test(x.u))||ls.find(x=>/\/n\/|\/m\/|\/membership|kind=|scrollpos=comment/i.test(x.u))||null,tm=el.querySelector('time[datetime]')?.getAttribute('datetime')||el.querySelector('[datetime]')?.getAttribute('datetime')||null,m=stripTime(raw).match(/^(.{1,180}?)\s*さん/u);let img=null;for(const x of el.querySelectorAll('img[src]')){const src=String(x.currentSrc||x.src||'');if(src&&!/cover|ogp|magazine/i.test(src)){img=src;break}}return{raw_text:raw,actor_name:actor?.t||m?.[1]||null,actor_url:actor?.u||null,actor_image_url:img,target_title:target?.t||null,target_url:target?.u||null,source_url:target?.u||actor?.u||'https://note.com/',occurred_at:tm||estimatedTime(raw),meta:{source:'note-notification-manual-sync-v2968',capture_source:'note-notification-fullread-v3284',userscript:VERSION,protocol:VERSION,scan_mode:'full-history-repair',scan_strategy:'manual-full-history-isolated-v1',event_identity:eventIdentity(el,raw,tm),verified_shell:true,time_estimated:!tm,article_url:ls.find(x=>/\/n\//.test(x.u))?.u||null,magazine_url:ls.find(x=>/\/m\//.test(x.u))?.u||null,links:ls.map(x=>({url:x.u,title:x.t}))}}}
const sig=r=>[stripTime(r.raw_text),String(r.target_url||'').split('#')[0],String(r.actor_url||'').split('?')[0],r.meta?.event_identity||r.occurred_at||'unknown'].join('|');

function readOutbox(id){try{const v=JSON.parse(localStorage.getItem(key(FULL_OUTBOX,id))||'[]');return Array.isArray(v)?v:[]}catch{return[]}}
function writeOutbox(id,rs){localStorage.setItem(key(FULL_OUTBOX,id),JSON.stringify(rs))}
function retain(id,rs){const m=new Map(readOutbox(id).map(r=>[sig(r),r]));for(const r of rs)m.set(sig(r),r);writeOutbox(id,[...m.values()])}
function status(message,kind='info',extra={}){document.dispatchEvent(new CustomEvent('mumei-v3-reader-status',{detail:{message:String(message||''),kind,scanning:kind==='saving',mode:'full',...extra}}))}
function readButton(){return document.querySelector('#'+ROOT+' [data-a="read"]')}
function paintRead(label,err=false){const b=readButton();if(!b)return;b.textContent=label;b.classList.toggle('err',err)}

async function sendBatchFull(input,a,saved){
 if(!input.length)return 0;
 const token=String(await get(key(TOKEN,a.id),'')||'');if(!token)throw new Error('本人連携が必要です');
 let total=0;
 for(let i=0;i<input.length;i+=20){
  const part=input.slice(i,i+20);if(!part.length)continue;
  retain(a.id,part);
  const current=await account();if(current?.id!==a.id)throw new Error('NOTE_ACCOUNT_CHANGED');
  const payload=part.map(r=>({...r,meta:{...(r.meta||{}),client_signature:sig(r)}}));
  const p=await requestRetry({noteId:a.id,notifications:payload},token);
  const sent=new Set(payload.map(sig)),confirmed=[...new Set(Array.isArray(p.confirmedClientSignatures)?p.confirmedClientSignatures.map(String).filter(s=>sent.has(s)):[])];
  for(const s of confirmed)saved.add(s);
  await set(key(SAVED,a.id),[...saved]);
  writeOutbox(a.id,readOutbox(a.id).filter(r=>!confirmed.includes(sig(r))));
  total+=confirmed.length;
  if(confirmed.length!==payload.length)throw new Error('全読みの一部が未保存です。全読みで再試行してください')
 }
 return total
}

let fullScanning=false;
async function scanFull(){
 if(fullScanning||window.__mumeiV3Reader323?.isScanning?.())return 0;
 fullScanning=true;let a=null,total=0,seenCount=0;
 paintRead('全読中');
 status('全読みを開始します…','saving');
 try{
  let p=panel();if(!p)throw new Error('本物の🔔通知一覧を開いてください');
  a=await account();if(!a)throw new Error('noteログインを確認してください');
  const token=String(await get(key(TOKEN,a.id),'')||'');if(!token)throw new Error('本人連携が必要です');
  const savedRaw=await get(key(SAVED,a.id),[]),saved=new Set(Array.isArray(savedRaw)?savedRaw.map(String):[]);
  total+=await sendBatchFull(readOutbox(a.id),a,saved);
  let host=scrollHost(p);try{if(host)host.scrollTop=0}catch{}
  await sleep(120);
  const seen=new Set(),buffer=[];let stable=0,lastTop=-1,lastMax=-1,noNew=0;
  for(let step=0;step<360&&seen.size<8000;step++){
   const next=panel();if(!next)throw new Error('通知一覧を閉じたため全読みを中断しました');
   if(next!==p){p=next;host=scrollHost(p)}
   let added=0;
   for(const el of rows(p)){
    const r=rowData(el);if(!r)continue;const k=sig(r);if(seen.has(k))continue;
    seen.add(k);buffer.push(r);added++
   }
   seenCount=seen.size;
   if(buffer.length>=80)total+=await sendBatchFull(buffer.splice(0,buffer.length),a,saved);
   if(step%5===0)status(`全読み中… ${seen.size}件確認 / ${total}件保存確認`,'saving',{readCount:seen.size,savedCount:total});
   if(!host)break;
   const viewport=host===document.scrollingElement?innerHeight:host.clientHeight;
   const max=Math.max(0,host.scrollHeight-viewport),before=host.scrollTop;
   if(added===0)noNew++;else noNew=0;
   if(before>=max-2){stable=max===lastMax?stable+1:0;if(stable>=4&&noNew>=3)break;await sleep(220)}
   else{host.scrollTop=Math.min(max,before+Math.max(240,Math.floor(viewport*.82)));await sleep(180);if(Math.abs(host.scrollTop-before)<2)stable++;else stable=0}
   if(host.scrollTop===lastTop&&max===lastMax)stable++;
   lastTop=host.scrollTop;lastMax=max
  }
  if(buffer.length)total+=await sendBatchFull(buffer.splice(0,buffer.length),a,saved);
  await set(key(FULL_STATE,a.id),{at:Date.now(),seenCount,total,version:VERSION});
  status(`✓ 全読み完了｜${seenCount}件照合・${total}件保存確認`,'done',{readCount:seenCount,savedCount:total});
  paintRead('読込');
  return total
 }catch(e){
  const msg=String(e?.message||e);
  status(`⚠ 全読み失敗：${msg}`,'error');
  paintRead('全読再試行',true);
  return 0
 }finally{fullScanning=false}
}

function isManual(){
 const mode=document.querySelector('#'+ROOT+' [data-a="mode"]');
 if(mode?.classList.contains('manual')||clean(mode?.textContent)==='手動')return true;
 return false
}
function closeMenu(){document.getElementById(MENU)?.remove()}
function openMenu(){
 const root=document.getElementById(ROOT);if(!root||!isManual())return;
 closeMenu();
 const m=document.createElement('div');m.id=MENU;
 m.style.cssText='position:absolute;left:0;right:0;bottom:42px;z-index:2147483647;display:grid;grid-template-columns:1fr 1fr;gap:5px;padding:6px;border:1px solid #49687d;border-radius:9px;background:#07131d;box-shadow:0 8px 20px #000b';
 m.innerHTML='<button type="button" data-v3284-mode="continue" style="height:34px;border:1px solid #42667b;border-radius:7px;background:#102737;color:#e3f8ff;font:900 11px/1 system-ui">続きから読む</button><button type="button" data-v3284-mode="full" style="height:34px;border:1px solid #96732e;border-radius:7px;background:#33260b;color:#ffe4a0;font:900 11px/1 system-ui">全読み</button><small style="grid-column:1/-1;color:#9db3c2;font:800 9px/1.25 system-ui;text-align:center">全読み＝読込停止期間の取りこぼし回収</small>';
 root.appendChild(m)
}
function readFromEvent(e){const path=e?.composedPath?.()||[];for(const n of path)if(n instanceof Element&&n.matches?.('#'+ROOT+' [data-a="read"]'))return n;const t=e.target instanceof Element?e.target:null;return t?.closest?.('#'+ROOT+' [data-a="read"]')||null}
function choiceFromEvent(e){const path=e?.composedPath?.()||[];for(const n of path)if(n instanceof Element&&n.matches?.('#'+MENU+' [data-v3284-mode]'))return n;const t=e.target instanceof Element?e.target:null;return t?.closest?.('#'+MENU+' [data-v3284-mode]')||null}
function block(e){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation()}
let lastOpen=0,lastChoice=0;
function capture(e){
 const c=choiceFromEvent(e);
 if(c){
  block(e);
  if((e.type==='pointerup'||e.type==='touchend'||e.type==='mouseup')&&Date.now()-lastChoice>350){
   lastChoice=Date.now();
   const mode=c.getAttribute('data-v3284-mode');
   if(mode==='full')void scanFull();else{paintRead('読込中');void Promise.resolve(window.__mumeiV3Reader323?.scan?.()).finally(()=>paintRead('読込'))}
   setTimeout(closeMenu,180)
  }
  return
 }
 const r=readFromEvent(e);
 if(!r||!isManual())return;
 block(e);
 if((e.type==='pointerup'||e.type==='touchend'||e.type==='mouseup'||e.type==='click')&&Date.now()-lastOpen>350){lastOpen=Date.now();openMenu()}
}
for(const type of['pointerdown','mousedown','touchstart','pointerup','mouseup','touchend','click'])window.addEventListener(type,capture,true);
addEventListener('popstate',closeMenu);addEventListener('hashchange',closeMenu);addEventListener('pagehide',closeMenu);

window.__mumeiV3ManualFull3284={version:VERSION,scanFull,closeMenu};
})();