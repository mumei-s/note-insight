(function(){
'use strict';
if(location.hostname!=='note.com')return;
const VERSION='3.2.22',PROTOCOL='3.2.22';
if(window.__mumeiV3Reader323?.version===VERSION&&window.__mumeiV3Reader323?.scan)return;
window.__mumeiNotificationReader323=true;

const INGEST='https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-notification-ingest-v2';
const TOKEN='mumei_insight_notification_sync_token_v2:',SAVED='mumei_insight_notification_saved_v2919:',CHECK='mumei_insight_notification_checkpoint_v2922:';
const SHELL='[data-mumei-notice-shell-v3="1"]';
const ITEM='.m-navbarNoticeItem,[class*="navbarNoticeItem"],[class*="notificationItem" i],[class*="noticeItem" i],[class*="NotificationItem" i],[data-testid*="notification-item" i],[data-testid*="notice-item" i]';
const TIME_RE=/(?:たった今|昨日|\d+\s*(?:秒|分|時間|日|週|か月|ヶ月|月|年)前|\d{1,2}月\d{1,2}日|\d{4}[\/.年]\d{1,2}[\/.月]\d{1,2}日?)/u;
const EXCLUDE=new Set(['settings','sitesettings','membership','memberships','notifications','messages','search','explore','login','signup']);
const OUTBOX='mumei-notification-outbox-v323:';
const PROGRESS_ID='mumei-v3-reader-progress-v3222';
const clean=v=>String(v||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
const stripTime=v=>clean(v).replace(/\s*(?:たった今|昨日|\d+\s*(?:秒|分|時間|日|週|か月|ヶ月|月|年)前|\d{1,2}月\d{1,2}日|\d{4}[\/.年]\d{1,2}[\/.月]\d{1,2}日?)$/u,'').trim();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const modern=()=>Boolean(globalThis.GM),key=(p,id)=>p+String(id||'').toLowerCase();

async function get(k,d){try{if(modern()&&typeof GM.getValue==='function')return await GM.getValue(k,d);if(typeof GM_getValue==='function')return GM_getValue(k,d)}catch{}return d}
async function set(k,v){try{if(modern()&&typeof GM.setValue==='function')return await GM.setValue(k,v);if(typeof GM_setValue==='function')return GM_setValue(k,v)}catch{}}
function request(url,body,headers={}){return new Promise((resolve,reject)=>{const fn=modern()&&typeof GM.xmlHttpRequest==='function'?GM.xmlHttpRequest:typeof GM_xmlhttpRequest==='function'?GM_xmlhttpRequest:null;if(!fn)return reject(new Error('USERSCRIPT_REQUEST_UNAVAILABLE'));fn({method:'POST',url,headers:{'Content-Type':'application/json',...headers},data:JSON.stringify(body),timeout:45000,onload:r=>{let p={};try{p=JSON.parse(r.responseText||'{}')}catch{};r.status>=200&&r.status<300&&p?.ok!==false?resolve(p):reject(new Error(p?.error||`HTTP_${r.status}`))},onerror:()=>reject(new Error('NETWORK_ERROR')),ontimeout:()=>reject(new Error('TIMEOUT'))})})}
function shown(el){if(!(el instanceof Element))return false;const r=el.getBoundingClientRect();if(r.width<1||r.height<1||r.right<=0||r.bottom<=0||r.left>=innerWidth||r.top>=innerHeight)return false;for(let p=el,d=0;p&&d++<14;p=p.parentElement){const s=getComputedStyle(p);if(p.hidden||p.getAttribute('aria-hidden')==='true'||p.hasAttribute('inert')||s.display==='none'||s.visibility==='hidden'||Number(s.opacity||1)<=.01)return false}return true}
function creatorId(v){try{const u=new URL(String(v||''),location.href),p=u.pathname.split('/').filter(Boolean),id=(p[0]||'').toLowerCase();return u.hostname.endsWith('note.com')&&p.length===1&&/^[a-z0-9_-]+$/.test(id)&&!EXCLUDE.has(id)?id:''}catch{return''}}
async function account(){try{const r=await fetch('/api/v2/current_user',{credentials:'include',cache:'no-store'});if(!r.ok)return null;const j=await r.json(),u=(j.data??j).user||(j.data??j),id=String(u?.urlname||u?.url_name||u?.username||'').replace(/^@/,'').toLowerCase();return/^[a-z0-9_-]+$/.test(id)?{id}:null}catch{return null}}
function rowish(el,trusted=false){if(!shown(el))return false;const t=clean(el.textContent);return t.length>=3&&t.length<=4000&&(trusted||TIME_RE.test(t))}
function rows(root){if(!root?.querySelectorAll)return[];const exact=[...root.querySelectorAll('.m-navbarNoticeItem,[data-testid="notification-item"],[data-testid="notice-item"]')].filter(el=>rowish(el,true));if(exact.length)return exact.filter(el=>!exact.some(other=>other!==el&&other.contains(el)));const known=[...root.querySelectorAll(ITEM)].filter(el=>rowish(el,true)&&!String(el.className).includes('__'));if(known.length)return known.filter(el=>!known.some(other=>other!==el&&other.contains(el)));const out=[];for(const el of root.querySelectorAll('li,[role="listitem"],a[href]')){if(!rowish(el))continue;if(out.some(x=>x.contains(el)))continue;for(let i=out.length-1;i>=0;i--)if(el.contains(out[i]))out.splice(i,1);out.push(el)}return out}
function rediscoverPanel(){for(const el of document.querySelectorAll('[role="dialog"],[role="menu"],[popover],aside,section,main,[role="main"]')){if(!shown(el))continue;if(rows(el).length){el.setAttribute('data-mumei-notice-shell-v3','1');return el}}if(/^\/notifications(?:\/|$)/i.test(location.pathname)){const main=document.querySelector('main,[role="main"]');if(main&&shown(main)){main.setAttribute('data-mumei-notice-shell-v3','1');return main}}return null}
function panel(){const p=document.querySelector(SHELL);return p&&shown(p)&&p!==document.body&&p!==document.documentElement?p:rediscoverPanel()}
function scrollHost(p){const xs=rows(p);let x=xs[0]||p;while(x&&p.contains(x)){if(x.scrollHeight>x.clientHeight+20&&/(auto|scroll)/.test(getComputedStyle(x).overflowY))return x;if(x===p)break;x=x.parentElement}return p.scrollHeight>p.clientHeight+20?p:null}
function links(el){const out=[];for(const a of [...(el.matches('a[href]')?[el]:[]),...el.querySelectorAll('a[href]')]){try{const u=new URL(a.getAttribute('href'),location.href);if(u.hostname.endsWith('note.com'))out.push({u:u.href,t:clean(a.textContent)})}catch{}if(out.length>=18)break}return out}
function estimatedTime(raw){const m=clean(raw).match(/(\d+)\s*(秒|分|時間|日|週)前$/u);if(!m)return null;const scale={'秒':1000,'分':60000,'時間':3600000,'日':86400000,'週':604800000};return new Date(Date.now()-Number(m[1])*scale[m[2]]).toISOString()}
function eventIdentity(el,raw,tm){const id=el.getAttribute('data-notification-id')||el.getAttribute('data-notice-id')||el.querySelector('[data-notification-id]')?.getAttribute('data-notification-id');if(id)return'notice:'+id;for(const a of [...(el.matches('a[href]')?[el]:[]),...el.querySelectorAll('a[href]')]){try{const u=new URL(a.href);for(const k of['notification_id','notice_id','c','comment_id'])if(u.searchParams.get(k))return'notice:'+u.searchParams.get(k)}catch{}}if(tm&&!Number.isNaN(Date.parse(tm)))return'time:'+new Date(tm).toISOString();const m=clean(raw).match(/(\d+)\s*(秒|分|時間|日|週)前$/u);if(m){const scale={'秒':1000,'分':60000,'時間':3600000,'日':86400000,'週':604800000},at=Date.now()-Number(m[1])*scale[m[2]],bucket=Math.max(60000,scale[m[2]]);return'estimated:'+Math.floor(at/bucket)+':'+bucket}return'label:'+(clean(raw).match(TIME_RE)?.[0]||'unknown')}
function rowData(el){const raw=clean(el.textContent);if(!raw||raw.length>4000)return null;const ls=links(el),actor=ls.find(x=>creatorId(x.u))||null,target=ls.find(x=>/[?&]kind=/.test(x.u))||ls.find(x=>/\/n\/|\/m\/|\/membership|kind=|scrollpos=comment/i.test(x.u))||null,tm=el.querySelector('time[datetime]')?.getAttribute('datetime')||el.querySelector('[datetime]')?.getAttribute('datetime')||null,m=stripTime(raw).match(/^(.{1,180}?)\s*さん/u);let img=null;for(const x of el.querySelectorAll('img[src]')){const src=String(x.currentSrc||x.src||'');if(src&&!/cover|ogp|magazine/i.test(src)){img=src;break}}return{raw_text:raw,actor_name:actor?.t||m?.[1]||null,actor_url:actor?.u||null,actor_image_url:img,target_title:target?.t||null,target_url:target?.u||null,source_url:target?.u||actor?.u||'https://note.com/',occurred_at:tm||estimatedTime(raw),meta:{source:'note-notification-manual-sync-v2968',capture_source:'note-notification-reader-v323',userscript:VERSION,protocol:PROTOCOL,scan_mode:'verified-shell-bottom-to-top',scan_strategy:'auto-checkpoint-bottom-to-top-v3222',event_identity:eventIdentity(el,raw,tm),verified_shell:true,time_estimated:!tm,article_url:ls.find(x=>/\/n\//.test(x.u))?.u||null,magazine_url:ls.find(x=>/\/m\//.test(x.u))?.u||null,links:ls.map(x=>({url:x.u,title:x.t}))}}}
const sig=r=>[stripTime(r.raw_text),String(r.target_url||'').split('#')[0],String(r.actor_url||'').split('?')[0],r.meta?.event_identity||r.occurred_at||'unknown'].join('|');
const legacySig=r=>[stripTime(r.raw_text),String(r.target_url||'').split('#')[0],String(r.actor_url||'').split('?')[0]].join('|');
function readOutbox(id){try{const v=JSON.parse(localStorage.getItem(key(OUTBOX,id))||'[]');return Array.isArray(v)?v:[]}catch{return[]}}
function writeOutbox(id,rs){localStorage.setItem(key(OUTBOX,id),JSON.stringify(rs))}
function retain(id,rs){const m=new Map(readOutbox(id).map(r=>[sig(r),r]));for(const r of rs)m.set(sig(r),r);writeOutbox(id,[...m.values()])}
function progressNode(){let el=document.getElementById(PROGRESS_ID);if(el)return el;el=document.createElement('div');el.id=PROGRESS_ID;el.setAttribute('role','status');el.style.cssText='position:fixed;left:8px;right:8px;bottom:calc(env(safe-area-inset-bottom,0px) + 58px);z-index:2147483646;display:none;padding:7px 10px;border:1px solid #3c5d72;border-radius:9px;background:rgba(7,18,27,.96);color:#dff7ff;font:900 11px/1.35 system-ui,-apple-system,sans-serif;box-shadow:0 -2px 8px rgba(0,0,0,.28);pointer-events:none;text-align:center';(document.body||document.documentElement).appendChild(el);return el}
let progressTimer=0;
function paintProgress(message,kind){const el=progressNode();clearTimeout(progressTimer);el.textContent=String(message||'');el.style.display=message?'block':'none';el.style.borderColor=kind==='error'?'#c95b68':kind==='done'?'#56a77b':'#3c5d72';el.style.color=kind==='error'?'#ffd5da':kind==='done'?'#caffda':'#dff7ff';if(kind==='done'||kind==='error')progressTimer=setTimeout(()=>{if(el.isConnected)el.style.display='none'},15000)}
function status(message,kind='info',label='',extra={}){paintProgress(message,kind);document.dispatchEvent(new CustomEvent('mumei-v3-reader-status',{detail:{message:String(message||''),kind,label,scanning,...extra}}))}
async function requestRetry(body,token){let last=null;for(let attempt=0;attempt<3;attempt++){try{return await request(INGEST,body,{'X-Ingest-Token':token})}catch(e){last=e;const m=String(e?.message||e);if(/401|403|TOKEN|ACCOUNT_CHANGED|連携/i.test(m))throw e;if(attempt<2)await sleep(650*(attempt+1))}}throw last||new Error('NETWORK_ERROR')}
async function sendBatch(input,a,saved){if(!input.length)return 0;retain(a.id,input.filter(r=>!saved.has(sig(r))));const token=String(await get(key(TOKEN,a.id),'')||'');if(!token)throw new Error('本人連携が必要です');let total=0;for(let i=0;i<input.length;i+=20){const part=input.slice(i,i+20).filter(r=>!saved.has(sig(r)));if(!part.length)continue;const current=await account();if(current?.id!==a.id)throw new Error('NOTE_ACCOUNT_CHANGED');const payload=part.map(r=>({...r,meta:{...(r.meta||{}),client_signature:sig(r)}}));const p=await requestRetry({noteId:a.id,notifications:payload},token);const sent=new Set(payload.map(sig)),confirmed=[...new Set(Array.isArray(p.confirmedClientSignatures)?p.confirmedClientSignatures.map(String).filter(s=>sent.has(s)):[])];for(const s of confirmed)saved.add(s);await set(key(SAVED,a.id),[...saved]);if(confirmed.length){const last=part.filter(r=>confirmed.includes(sig(r))).at(-1),cp=await get(key(CHECK,a.id),{}),now=Date.now();await set(key(CHECK,a.id),{...cp,lastSaveAt:now,lastCheckAt:now,savedCount:saved.size,lastError:'',version:VERSION,boundarySignature:sig(last),boundaryEventIdentity:last.meta?.event_identity,boundaryLegacySignature:legacySig(last),boundaryAt:now,boundarySource:'reader-confirmed-v3222'});document.dispatchEvent(new Event('mumei-notification-checkpoint'))}writeOutbox(a.id,readOutbox(a.id).filter(r=>!saved.has(sig(r))));total+=confirmed.length;if(confirmed.length!==payload.length)throw new Error('一部の通知が未保存です。再読込で再試行します')}return total}

let scanning=false,stop=false,active=null;
function capturePending(){if(!active)return;const{a,p,saved}=active;try{const rs=rows(p).slice().reverse().map(rowData).filter(r=>r&&!saved.has(sig(r)));retain(a.id,rs)}catch{}}
function pauseCapture(){capturePending();stop=true}
addEventListener('pagehide',pauseCapture,{capture:true});
addEventListener('popstate',pauseCapture,{capture:true});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')pauseCapture()},{capture:true});

async function scan(){
 if(scanning){stop=true;capturePending();status('停止地点まで保存します…','saving','保存中…');return}
 scanning=true;stop=false;let a=null,saved=null,count=0,seen=new Set(),p=null,host=null,complete=false,resumed=false,fullFallback=false;
 status('自動読込を開始します…','saving','自動読込');
 try{
  p=panel();if(!p)throw new Error('本物の🔔通知一覧を開いてください');
  a=await account();if(!a)throw new Error('noteログインを確認してください');
  if(!String(await get(key(TOKEN,a.id),'')||''))throw new Error('本人連携が必要です');
  let cp=await get(key(CHECK,a.id),{}),savedRaw=await get(key(SAVED,a.id),[]),previous=new Set(Array.isArray(savedRaw)?savedRaw.map(String):[]);saved=new Set(previous);active={a,p,saved};
  if(cp?.lastSaveAt)status(`前回保存済 ${new Date(cp.lastSaveAt).toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'})}｜自動位置合わせ中…`,'saving','自動読込');
  count+=await sendBatch(readOutbox(a.id),a,saved);
  cp=await get(key(CHECK,a.id),cp);
  host=scrollHost(p);
  const refreshSurface=()=>{const next=panel();if(!next)throw new Error('通知一覧を閉じたため中断しました');if(next!==p){p=next;active.p=p;const nextHost=scrollHost(p);if(nextHost)host=nextHost}return p};
  const current=()=>{refreshSurface();return rows(p).map(el=>{const r=rowData(el);if(r)el.dataset.mumeiReaderSignature=sig(r);return r}).filter(Boolean)};
  const capture=async()=>{const rs=current().slice().reverse();for(const r of rs)seen.add(sig(r));retain(a.id,rs.filter(r=>!saved.has(sig(r))));if(readOutbox(a.id).length>=15)count+=await sendBatch(readOutbox(a.id),a,saved);status(`読込 ${seen.size}件｜保存確認 ${count}件`,'saving','■ 停止保存',{readCount:seen.size,savedCount:count})};
  const goTop=async()=>{if(!host)return;for(let i=0;i<3&&!stop;i++){refreshSurface();host.scrollTop=0;await sleep(180)}};
  const stepDown=async()=>{if(!host)return false;refreshSurface();const max=Math.max(0,host.scrollHeight-host.clientHeight),before=host.scrollTop,step=Math.max(180,Math.floor(host.clientHeight*.78));host.scrollTop=Math.min(max,before+step);await sleep(200);return host.scrollTop>before+1};
  const loadAbsoluteBottom=async()=>{if(!host)return;status('通知一覧の最下部まで自動で読み込み中…','saving','最下部へ');let stable=0,lastHeight=-1;for(let i=0;i<120&&!stop;i++){refreshSurface();const max=Math.max(0,host.scrollHeight-host.clientHeight);host.scrollTop=max;await sleep(300);refreshSurface();const h=host.scrollHeight,atBottom=host.scrollTop>=Math.max(0,h-host.clientHeight)-2;if(atBottom&&h===lastHeight)stable++;else stable=0;lastHeight=h;if(stable>=4)break}};
  const findBoundary=async boundary=>{if(!host||!boundary)return false;await goTop();status('前回保存地点を自動で探しています…','saving','前回地点へ');let stable=0,lastHeight=-1;for(let i=0;i<140&&!stop;i++){const rs=current();if(rs.some(r=>legacySig(r)===boundary))return true;const moved=await stepDown();refreshSurface();const h=host.scrollHeight,max=Math.max(0,h-host.clientHeight),atBottom=host.scrollTop>=max-2;if(atBottom&&h===lastHeight&&!moved)stable++;else if(h!==lastHeight||moved)stable=0;lastHeight=h;if(stable>=4)break}return current().some(r=>legacySig(r)===boundary)};
  const walkUp=async()=>{if(!host){await capture();return true}let last=Infinity,guard=0;while(!stop&&guard++<160){await capture();refreshSurface();if(host.scrollTop<=1)break;const step=Math.max(180,Math.floor(host.clientHeight*.72)),next=Math.max(0,host.scrollTop-step);host.scrollTop=next;await sleep(190);if(Math.abs(host.scrollTop-last)<1&&next>0){host.scrollTop=Math.max(0,next-48);await sleep(120)}last=host.scrollTop}await capture();return !stop&&host.scrollTop<=1};

  if(host&&cp.boundaryLegacySignature){
   const found=await findBoundary(cp.boundaryLegacySignature);
   if(found&&!stop){
    const boundaryEl=rows(p).find(el=>{const r=rowData(el);return r&&legacySig(r)===cp.boundaryLegacySignature});
    if(boundaryEl)try{boundaryEl.scrollIntoView({block:'center',behavior:'auto'})}catch{}
    await sleep(120);resumed=true;
    status('前回保存地点を下端にして、上へ自動読込中…','saving','下→上 自動読込');
    complete=await walkUp();
   }else if(!stop){
    fullFallback=true;
    status('前回地点を確認できないため全体照合へ切替…','saving','全体照合');
   }
  }else fullFallback=true;

  if(fullFallback&&!stop){
   await goTop();
   await loadAbsoluteBottom();
   if(!stop){status('最下部から上へ自動読込・保存中…','saving','下→上 自動読込');complete=await walkUp()}
  }

  if(!stop){count+=await sendBatch(readOutbox(a.id),a,saved)}else{capturePending();try{count+=await sendBatch(readOutbox(a.id),a,saved)}catch{}}
  const latest=await get(key(CHECK,a.id),{}),visibleRows=current();const top=visibleRows.find(r=>saved.has(sig(r)));if(top){latest.boundarySignature=sig(top);latest.boundaryEventIdentity=top.meta?.event_identity;latest.boundaryLegacySignature=legacySig(top)}
  const now=Date.now();await set(key(CHECK,a.id),{...latest,lastCheckAt:now,manualNewCount:count,manualSeenCount:seen.size,historyComplete:cp.historyComplete===true||Boolean(fullFallback&&complete),lastError:'',lastScanMode:resumed?'checkpoint-auto-bottom-to-top':'full-auto-bottom-to-top',lastRunStopped:Boolean(stop),version:VERSION});
  document.dispatchEvent(new Event('mumei-notification-checkpoint'));
  const remain=readOutbox(a.id).length;
  if(remain)status(`⚠ ${remain}件は次回保存待ち｜${seen.size}件読取`,'error','保存待ち',{readCount:seen.size,savedCount:count,pendingCount:remain});
  else if(stop)status(`✓ 停止地点まで保存済｜新規 ${count}件｜読取 ${seen.size}件`,'done','✓ 保存済',{readCount:seen.size,savedCount:count});
  else status(`✓ 保存完了｜新規 ${count}件｜読取 ${seen.size}件｜${new Date(now).toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'})}`,'done','✓ 保存済',{readCount:seen.size,savedCount:count});
  if(host&&host.isConnected&&complete)try{host.scrollTop=0}catch{}
 }catch(e){capturePending();if(a){try{const cp=await get(key(CHECK,a.id),{}),pending=readOutbox(a.id).length;await set(key(CHECK,a.id),{...cp,lastError:String(e?.message||e),lastCheckAt:Date.now(),pendingCount:pending,version:VERSION})}catch{}}const pending=a?readOutbox(a.id).length:0;status(`⚠ ${String(e?.message||e)}${pending?`｜${pending}件は次回保存待ち`:''}`,'error',/連携/.test(String(e?.message||e))?'連携必要':'再読込',{pendingCount:pending})}
 finally{active=null;scanning=false;stop=false;document.dispatchEvent(new CustomEvent('mumei-v3-reader-stopped'))}
}

document.addEventListener('mumei-v3-read-request',()=>void scan());
function readyToScan(){const p=panel();return Boolean(p&&rows(p).length)}
window.__mumeiV3Reader323={scan,isScanning:()=>scanning,readyToScan,version:VERSION};
window.__mumeiV3Reader323Ready=true;
document.dispatchEvent(new Event('mumei-v3-reader-ready'));
})();