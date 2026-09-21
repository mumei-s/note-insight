(function(){
'use strict';
if(location.hostname!=='note.com')return;
if(window.__mumeiNotificationReaderV4Loaded)return;window.__mumeiNotificationReaderV4Loaded=true;
const VERSION='3.5.0',PROTOCOL='3.5.0';
const INGEST='https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-notification-ingest-v2';
const TOKEN='mumei_insight_notification_sync_token_v2:',SAVED='mumei_insight_notification_saved_v2919:',CHECK='mumei_insight_notification_checkpoint_v2922:',REPAIR='mumei_insight_notification_avatar_repair_v338:';
const SHELL='[data-mumei-notice-shell-v2958="1"]';
const ITEM='.m-navbarNoticeItem,[class*="navbarNoticeItem"],[class*="notificationItem" i],[class*="noticeItem" i],[class*="NotificationItem" i],[data-testid*="notification-item" i],[data-testid*="notice-item" i]';
const TIME_RE=/(?:たった今|昨日|\d+\s*(?:秒|分|時間|日|週|か月|ヶ月|月|年)前|\d{1,2}月\d{1,2}日|\d{4}[\/.年]\d{1,2}[\/.月]\d{1,2}日?)/u;
const NOTICE_RE=/(?:さん|通知|新しい記事|追加しました|フォロー|コメント|返信|スキ|いいね|リアクション|購入|チップ|サポート|支援|応援金|メンバー|メンバーシップ|メンシプ|プラン|加入|入会|マガジン|掲示板|話題|高評価|引用|紹介)/u;
const EXCLUDE=new Set(['settings','sitesettings','membership','memberships','notifications','messages','search','explore','login','signup']);
const isDmRoute=()=>/^\/messages\/rooms(?:\/|$)/i.test(location.pathname);
const clean=v=>String(v||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
const stripTime=v=>clean(v).replace(/\s*(?:たった今|昨日|\d+\s*(?:秒|分|時間|日|週|か月|ヶ月|月|年)前|\d{1,2}月\d{1,2}日|\d{4}[\/.年]\d{1,2}[\/.月]\d{1,2}日?)$/u,'').trim();
const modern=()=>Boolean(globalThis.GM),key=(p,id)=>p+String(id||'').toLowerCase(),sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function get(k,d){if(modern()&&typeof GM.getValue==='function')return GM.getValue(k,d);if(typeof GM_getValue==='function')return GM_getValue(k,d);return d}
async function set(k,v){if(modern()&&typeof GM.setValue==='function')return GM.setValue(k,v);if(typeof GM_setValue==='function')return GM_setValue(k,v)}
function request(url,body,headers={}){return new Promise((resolve,reject)=>{const fn=modern()&&typeof GM.xmlHttpRequest==='function'?GM.xmlHttpRequest:typeof GM_xmlhttpRequest==='function'?GM_xmlhttpRequest:null;if(!fn)return reject(new Error('USERSCRIPT_REQUEST_UNAVAILABLE'));fn({method:'POST',url,headers:{'Content-Type':'application/json',...headers},data:JSON.stringify(body),timeout:45000,onload:r=>{let p={};try{p=JSON.parse(r.responseText||'{}')}catch{};r.status>=200&&r.status<300&&p.ok!==false?resolve(p):reject(new Error(p.error||`HTTP_${r.status}`))},onerror:()=>reject(new Error('NETWORK_ERROR')),ontimeout:()=>reject(new Error('TIMEOUT'))})})}
function shown(el){if(!(el instanceof Element))return false;const r=el.getBoundingClientRect();if(r.width<1||r.height<1)return false;for(let p=el;p&&p!==document.body;p=p.parentElement){const s=getComputedStyle(p);if(p.hidden||p.getAttribute('aria-hidden')==='true'||p.hasAttribute('inert')||s.display==='none'||s.visibility==='hidden')return false}return true}
function creatorId(v){try{const u=new URL(String(v||''),location.href),p=u.pathname.split('/').filter(Boolean),id=(p[0]||'').toLowerCase();return u.hostname.endsWith('note.com')&&p.length===1&&/^[a-z0-9_-]+$/.test(id)&&!EXCLUDE.has(id)?id:''}catch{return''}}
function accountFromDom(){const selectors=['header a[href]','nav a[href]','[class*="header" i] a[href]','[data-testid*="profile" i] a[href]'];for(const a of document.querySelectorAll(selectors.join(','))){if(!shown(a))continue;const id=creatorId(a.getAttribute('href'));if(!id)continue;const r=a.getBoundingClientRect();if(r.top<220||a.querySelector('img'))return{id}}return null}
async function account(){try{const r=await fetch('/api/v2/current_user',{credentials:'include',cache:'no-store'});if(r.ok){const j=await r.json(),u=(j.data??j).user||(j.data??j),id=String(u.urlname||u.url_name||u.username||'').toLowerCase();if(/^[a-z0-9_-]+$/.test(id))return{id}}}catch{}return null}
function rowish(el,trusted=false){if(!shown(el))return false;const t=clean(el.textContent);return t.length>=3&&t.length<=4000&&(trusted||TIME_RE.test(t))}
function rows(root){if(!root?.querySelectorAll)return[];const exact=[...root.querySelectorAll('.m-navbarNoticeItem,[data-testid="notification-item"],[data-testid="notice-item"]')].filter(el=>rowish(el,true));if(exact.length)return exact.filter(el=>!exact.some(other=>other!==el&&other.contains(el)));const known=[...root.querySelectorAll(ITEM)].filter(el=>rowish(el,true)&&!String(el.className).includes('__'));if(known.length)return known.filter(el=>!known.some(other=>other!==el&&other.contains(el)));
 // The enclosing notification list is already verified. Keep unknown wording as well.
 const out=[];for(const el of root.querySelectorAll('li,[role="listitem"],a[href]')){if(!rowish(el))continue;if(out.some(x=>x.contains(el)))continue;for(let i=out.length-1;i>=0;i--)if(el.contains(out[i]))out.splice(i,1);out.push(el)}return out;
}
function tabLabel(el){return clean(el?.textContent||el?.getAttribute?.('aria-label')||el?.getAttribute?.('title')||'')}
function noticeTabs(root){if(!root?.querySelectorAll)return false;let notice=false,news=false,n=0;for(const el of root.querySelectorAll('button,a,[role="tab"],[role="button"]')){if(n++>160)break;if(!shown(el))continue;const t=tabLabel(el);if(/^通知(?:\s*\d+)?$/u.test(t))notice=true;else if(/^お知らせ(?:\s*\d+)?$/u.test(t))news=true;if(notice&&news)return true}return false}
function noticeLikeRows(root){if(!root?.querySelectorAll)return 0;let n=0,seen=new Set();const candidates=[...root.querySelectorAll(ITEM),...root.querySelectorAll('li,[role="listitem"],a[href]')];for(const el of candidates){if(seen.has(el)||!shown(el))continue;seen.add(el);const t=clean(el.textContent);if(t.length<3||t.length>4000)continue;if(TIME_RE.test(t)){if(++n>=1)return n}}return n}
function directPanel(){
 if(isDmRoute())return null;
 const marked=document.querySelector(SHELL);if(marked&&shown(marked)&&marked!==document.body&&marked!==document.documentElement)return marked;
 const exact=[...document.querySelectorAll('.m-navbarNoticeItem,[data-testid="notification-item"],[data-testid="notice-item"],[class*="navbarNoticeItem"],[class*="notificationItem" i],[class*="noticeItem" i]')].filter(shown);
 for(const item of exact){
  let p=item.parentElement,d=0,best=null;
  while(p&&p!==document.body&&p!==document.documentElement&&d++<12){
   if(!shown(p)){p=p.parentElement;continue}
   const named=p.matches('[role="dialog"],[role="menu"],[popover],.m-navbarNotice,[class*="notificationList" i],[class*="noticeList" i]');
   if(noticeTabs(p)||named)best=p;
   if(best&&noticeLikeRows(best)>=1)return best;
   const r=p.getBoundingClientRect();if(r.width>0&&r.height>0&&r.height>innerHeight*1.3)break;
   p=p.parentElement
  }
 }
 const controls=[...document.querySelectorAll('button,a,[role="tab"],[role="button"]')].filter(shown);
 const ns=controls.filter(el=>/^通知(?:\s*\d+)?$/u.test(tabLabel(el))),os=controls.filter(el=>/^お知らせ(?:\s*\d+)?$/u.test(tabLabel(el)));
 for(const n of ns)for(const o of os){
  let p=n.parentElement,d=0;
  while(p&&p!==document.body&&p!==document.documentElement&&d++<12){
   if(p.contains(o)&&shown(p)){
    let q=p,k=0;
    while(q&&q!==document.body&&q!==document.documentElement&&k++<7){
     if(shown(q)&&noticeLikeRows(q)>=1)return q;
     q=q.parentElement
    }
   }
   p=p.parentElement
  }
 }
 return null
}
function findPanel(){return directPanel()}
function scrollHost(panel){const xs=rows(panel);let p=xs[0]||panel;while(p&&panel.contains(p)){if(p.scrollHeight>p.clientHeight+20&&/(auto|scroll)/.test(getComputedStyle(p).overflowY))return p;if(p===panel)break;p=p.parentElement}return panel.scrollHeight>panel.clientHeight+20?panel:null}
function links(el){const out=[];for(const a of [...(el.matches('a[href]')?[el]:[]),...el.querySelectorAll('a[href]')]){try{const u=new URL(a.getAttribute('href'),location.href);if(u.hostname.endsWith('note.com'))out.push({a,u:u.href,t:clean(a.textContent)})}catch{}if(out.length>=18)break}return out}
function estimatedTime(raw){const m=clean(raw).match(/(\d+)\s*(秒|分|時間|日|週)前$/u);if(m){const unit={'秒':1000,'分':60000,'時間':3600000,'日':86400000,'週':604800000};return new Date(Date.now()-Number(m[1])*unit[m[2]]).toISOString()}return null}
function rowData(el){const raw=clean(el.textContent);if(!raw||raw.length>4000)return null;const ls=links(el),actor=ls.find(x=>creatorId(x.u))||null,target=ls.find(x=>/[?&]kind=/.test(x.u))||ls.find(x=>/\/n\/|\/m\/|\/membership|kind=|scrollpos=comment/i.test(x.u))||null,tm=el.querySelector('time[datetime]')?.getAttribute('datetime')||el.querySelector('[datetime]')?.getAttribute('datetime')||null,m=stripTime(raw).match(/^(.{1,180}?)\s*さん/u);let img=null;for(const x of el.querySelectorAll('img[src]')){const src=String(x.currentSrc||x.src||'');if(src&&!/cover|ogp|magazine/i.test(src)){img=src;break}}return{raw_text:raw,actor_name:actor?.t||m?.[1]||null,actor_url:actor?.u||null,actor_image_url:img,target_title:target?.t||null,target_url:target?.u||null,source_url:target?.u||actor?.u||'https://note.com/',occurred_at:tm||estimatedTime(raw),meta:{source:'note-notification-manual-sync-v2968',capture_source:'note-notification-reader-v4',userscript:VERSION,protocol:PROTOCOL,scan_mode:'isolated-reader-v4-bottom-to-top',event_identity:eventIdentity(el,raw,tm),verified_shell:true,time_estimated:!tm,article_url:ls.find(x=>/\/n\//.test(x.u))?.u||null,magazine_url:ls.find(x=>/\/m\//.test(x.u))?.u||null,links:ls.map(x=>({url:x.u,title:x.t}))}}}
function eventIdentity(el,raw,tm){
 const id=el.getAttribute('data-notification-id')||el.getAttribute('data-notice-id')||el.querySelector('[data-notification-id]')?.getAttribute('data-notification-id');
 if(id)return 'notice:'+id;
 for(const a of [...(el.matches('a[href]')?[el]:[]),...el.querySelectorAll('a[href]')]){try{const u=new URL(a.href);for(const k of ['notification_id','notice_id','c','comment_id'])if(u.searchParams.get(k))return 'notice:'+u.searchParams.get(k)}catch{}}
 if(tm&&!Number.isNaN(Date.parse(tm)))return 'time:'+new Date(tm).toISOString();
 // Relative labels are evidence of a date, never a durable event ID.
 const m=clean(raw).match(/(\d+)\s*(秒|分|時間|日|週)前$/u);
 if(m){const scale={'秒':1000,'分':60000,'時間':3600000,'日':86400000,'週':604800000};const at=Date.now()-Number(m[1])*scale[m[2]],bucket=Math.max(60000,scale[m[2]]);return 'estimated:'+Math.floor(at/bucket)+':'+bucket}
 return 'label:'+clean(raw).match(TIME_RE)?.[0];
}
const sig=r=>[stripTime(r.raw_text),String(r.target_url||'').split('#')[0],String(r.actor_url||'').split('?')[0],r.meta?.event_identity||r.occurred_at||'unknown'].join('|');
let scanning=false,stop=false,active=null;
const OUTBOX='mumei-notification-outbox-v318:';
function readOutbox(id){try{const value=JSON.parse(localStorage.getItem(key(OUTBOX,id))||'[]');return Array.isArray(value)?value:[]}catch{throw new Error('未送信通知の保存データを確認できません')}}
function writeOutbox(id,rs){localStorage.setItem(key(OUTBOX,id),JSON.stringify(rs))}
function retain(id,rs){const pending=new Map(readOutbox(id).map(r=>[sig(r),r]));for(const r of rs)pending.set(sig(r),r);writeOutbox(id,[...pending.values()])}
function capturePending(){if(!active)return;const {a,panel,saved}=active;try{const rs=rows(panel).slice().reverse().map(rowData).filter(r=>r&&!saved.has(sig(r)));retain(a.id,rs)}catch(e){health(String(e?.message||e),'error')}}
function pauseCapture(){capturePending();stop=true}
window.addEventListener('pagehide',pauseCapture,{capture:true});
window.addEventListener('popstate',pauseCapture,{capture:true});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')pauseCapture()},{capture:true});
function health(msg,cls='',extra={}){
 try{window.dispatchEvent(new CustomEvent('mumei-notification-reader-status',{detail:{message:String(msg||''),state:String(cls||''),scanning:scanning||cls==='saving',stopping:stop,version:VERSION,...extra}}))}catch{}
}
async function sendBatch(input,a,saved,force=false){
 if(!input.length)return 0;
 retain(a.id,input.filter(r=>force||!saved.has(sig(r))));
 const token=String(await get(key(TOKEN,a.id),'')||'');if(!token)throw new Error('PAIR_REQUIRED');
 let total=0;
 for(let i=0;i<input.length;i+=20){
  const part=input.slice(i,i+20).filter(r=>force||!saved.has(sig(r)));if(!part.length)continue;
  const current=await account();if(current?.id!==a.id)throw new Error('NOTE_ACCOUNT_CHANGED');
  const payload=part.map(r=>({...r,meta:{...(r.meta||{}),client_signature:sig(r)}}));
  const p=await request(INGEST,{noteId:a.id,notifications:payload},{'X-Ingest-Token':token});
  const sent=new Set(payload.map(sig)),confirmed=[...new Set(Array.isArray(p.confirmedClientSignatures)?p.confirmedClientSignatures.map(String).filter(s=>sent.has(s)):[])];
  for(const id of confirmed)saved.add(id);
  // Commit confirmations and checkpoint before removing anything from the outbox.
  await set(key(SAVED,a.id),[...saved]);
  if(confirmed.length){
   const last=part.filter(r=>confirmed.includes(sig(r))).at(-1),cp=await get(key(CHECK,a.id),{}),now=Date.now();
   await set(key(CHECK,a.id),{...cp,lastSaveAt:now,lastCheckAt:now,savedCount:saved.size,lastError:'',version:VERSION,boundarySignature:sig(last),boundaryEventIdentity:last.meta?.event_identity,boundaryLegacySignature:[stripTime(last.raw_text),String(last.target_url||'').split('#')[0],String(last.actor_url||'').split('?')[0]].join('|'),boundaryAt:now,boundarySource:'reader-confirmed-v318'});
   document.dispatchEvent(new Event('mumei-notification-checkpoint'));
  }
  writeOutbox(a.id,readOutbox(a.id).filter(r=>!saved.has(sig(r))));
  total+=confirmed.length;
  if(confirmed.length!==payload.length)throw new Error('一部の通知が未保存です。再読込で再試行します');
 }
 return total;
}
async function seekOldest(host,panel,capture=async()=>{},overlap=()=>false){
 if(!host){await capture();return true}
 let same=0,last=-1;
 for(let i=0;i<1200&&!stop;i++){
  if(findPanel()!==panel)throw new Error('通知一覧を閉じたため中断しました');
  await capture();if(overlap())return false;
  host.scrollTop=Math.max(0,host.scrollHeight-host.clientHeight);
  health('古い通知を確認中…','saving');await sleep(500);
  await capture();if(overlap())return false;
  const height=host.scrollHeight;if(height===last)same++;else same=0;last=height;
  if(same>=6)return true;
 }
 if(!stop)throw new Error('古い通知の読み込みが続いています。次回も続きから読み込みます');
 return false;
}
async function scan(){
 if(isDmRoute())return;
 if(scanning){health('通信読取中です…','saving');return 0}
 const net=window.__mumeiNotificationNetwork3300;
 if(!net||typeof net.syncCurrent!=='function'){health('⚠ 通信Readerを起動できません','error');return 0}
 scanning=true;stop=false;
 try{
  const r=await net.syncCurrent({waitMs:1000});
  const saved=Number(r?.saved||0),read=Number(r?.received||0);
  if(r?.handled){
   const label=r?.full?'✓全履歴確認':r?.delta?'✓追加確認':'✓通信確認';
   health(`${label}｜${saved}件保存確認｜${read}件読取`,'done',{readCount:read,savedCount:saved,totalCount:Number(r?.totalCount||read)});
   return saved
  }
  health('通信読取待機｜🔔を開いたまま次回も続きから確認します','saving');
  return 0
 }catch(e){
  health(`⚠ ${String(e?.message||e)}｜未保存分は次回に引継ぎ`,'error');
  return 0
 }finally{scanning=false;stop=false}
}
async function scanDomLegacy(){
 if(isDmRoute())return;
 if(scanning){stop=true;capturePending();health('停止地点まで保存します…','saving');return}
 // Lock before asynchronous login and storage checks to prevent two readers.
 scanning=true;stop=false;let a=null,saved=null,count=0,readCount=0,complete=false;
 try{
  const panel=findPanel();if(!panel)throw new Error('本物の🔔通知一覧を開いてください');
  a=await account();if(!a)throw new Error('noteログインを確認してください');
  if(!String(await get(key(TOKEN,a.id),'')||''))throw new Error('本人連携が必要です')
  const cp=await get(key(CHECK,a.id),{}),savedRaw=await get(key(SAVED,a.id),[]),repairDone=Boolean(await get(key(REPAIR,a.id),false));
  saved=new Set(Array.isArray(savedRaw)?savedRaw.map(String):[]);
  const previous=new Set(saved),seen=new Set(),repairSeen=new Set(),repairRows=[],host=scrollHost(panel);
  active={a,panel,saved};
  count+=await sendBatch(readOutbox(a.id),a,saved);
  const currentRows=()=>rows(panel).map(el=>{const r=rowData(el);if(r)el.dataset.mumeiReaderSignature=sig(r);return r}).filter(Boolean);
  const overlap=()=>cp.historyComplete===true&&currentRows().some(r=>previous.has(sig(r)));
  const capture=async()=>{
   const rs=currentRows().slice().reverse();
   for(const r of rs){const id=sig(r);if(!seen.has(id)){seen.add(id);readCount++}if(!repairDone&&!repairSeen.has(id)){repairSeen.add(id);repairRows.push(r)}}
   // Local write is synchronous: pagehide cannot discard a partially filled batch.
   retain(a.id,rs.filter(r=>!saved.has(sig(r))));
   if(readOutbox(a.id).length>=20)count+=await sendBatch(readOutbox(a.id),a,saved);
   health(`追加読込 ${readCount}件｜保存 ${count}件`,'saving');
  };
  const reachedEnd=await seekOldest(host,panel,capture,overlap);
  await capture();
  // The initial DOM list is newest-first; preserve the oldest-to-newest send order.
  let pending=readOutbox(a.id);
  count+=await sendBatch(pending,a,saved);
  complete=!stop&&(reachedEnd||overlap());
  if(!stop&&host){
   let steps=0;
   while(host.scrollTop>1&&steps++<1200&&!stop){
    if(findPanel()!==panel)throw new Error('通知一覧を閉じたため中断しました');
    const before=host.scrollTop;host.scrollTop=Math.max(0,before-Math.max(160,host.clientHeight*.75));
    await sleep(350);await capture();count+=await sendBatch(readOutbox(a.id),a,saved);
    if(Math.abs(host.scrollTop-before)<1){complete=false;break}
   }
   if(host.scrollTop>1)complete=false;
  }
  if(!repairDone&&repairRows.length){health(`アイコン情報を補修中… ${repairRows.length}件`,'saving');await sendBatch(repairRows,a,saved,true)}
  const latest=await get(key(CHECK,a.id),{});
  if(complete){const top=currentRows().find(r=>saved.has(sig(r)));if(top){latest.boundarySignature=sig(top);latest.boundaryEventIdentity=top.meta?.event_identity;latest.boundaryLegacySignature=[stripTime(top.raw_text),String(top.target_url||'').split('#')[0],String(top.actor_url||'').split('?')[0]].join('|')}}
  const runMode=complete?(cp.historyComplete===true?'delta':'full'):'partial',runAt=Date.now();
  await set(key(CHECK,a.id),{...latest,lastCheckAt:runAt,manualNewCount:count,manualSeenCount:readCount,historyComplete:cp.historyComplete===true||complete,lastError:'',lastRunComplete:complete,lastRunMode:runMode,lastRunAt:runAt,lastRunSavedCount:count,lastRunReadCount:readCount,version:VERSION});
  if(complete&&!repairDone)await set(key(REPAIR,a.id),true);
  health(`${stop?'停止・':''}${complete?(cp.historyComplete===true?'✓追加確認':'✓全履歴確認'):'途中保存'}｜${count}件保存確認｜${readCount}件読取${complete?'':'｜続きは次回'}`,'done');
 }catch(e){
  capturePending();
  if(a){try{const cp=await get(key(CHECK,a.id),{}),runAt=Date.now();await set(key(CHECK,a.id),{...cp,lastError:String(e?.message||e),lastCheckAt:runAt,lastRunComplete:false,lastRunMode:'error',lastRunAt:runAt,lastRunSavedCount:count,lastRunReadCount:readCount,version:VERSION})}catch{}}
  health(`⚠ ${String(e?.message||e)}｜未送信分は次回に引継ぎ`,'error');
 }finally{active=null;scanning=false;stop=false}
}
let scheduled=0,autoTimer=0,autoPanel=null,lastAutoAt=0;
function scheduleAuto(delay=350){
 if(isDmRoute())return;
 clearTimeout(autoTimer);
 autoTimer=setTimeout(()=>{
  const p=findPanel();
  if(!p){autoPanel=null;return}
  if(scanning)return;
  if(p===autoPanel&&Date.now()-lastAutoAt<15000)return;
  autoPanel=p;lastAutoAt=Date.now();
  void scan()
 },delay)
}
setTimeout(()=>scheduleAuto(600),120);
new MutationObserver(()=>{clearTimeout(scheduled);scheduled=setTimeout(()=>scheduleAuto(300),120)}).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style','hidden','aria-hidden','open']});
document.addEventListener('click',e=>{if(isDmRoute())return;const el=e.target instanceof Element?e.target.closest('button,[role="button"],[aria-label],[title],[data-testid]'):null;if(!el)return;const meta=clean([el.textContent,el.getAttribute('aria-label'),el.getAttribute('title'),el.getAttribute('data-testid')].join(' '));if(/(?:通知|お知らせ|notification|notice|bell)/iu.test(meta))scheduleAuto(280)},true);
window.addEventListener('pageshow',()=>scheduleAuto(500));
window.addEventListener('focus',()=>scheduleAuto(500));
window.__mumeiNotificationReaderV4={version:VERSION,scan,scheduleAuto,rowData,findPanel,directPanel,isDmRoute,scanDomLegacy};
})();