(function(){
'use strict';
if(location.hostname!=='note.com')return;
if(window.__mumeiInsightDmReaderV1)return;window.__mumeiInsightDmReaderV1=true;
const VERSION='1.4.0';
const INGEST='https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-dm-ingest';
const TOKEN='mumei_insight_dm_sync_token_v1:';
const CHECK='mumei_insight_dm_checkpoint_v1:',QUEUE='mumei_insight_dm_queue_v1:',SAVED='mumei_insight_dm_saved_v1:',DONE='mumei_dm_just_completed_v1';
const MAX_ROOMS=500,MAX_SCROLL=1200,MAX_MESSAGES=5000;
const OUTBOX='mumei_dm_outbox_v140:';
let interrupted=false;
function stop(){interrupted=true}
window.addEventListener('pagehide',stop,{capture:true});
window.addEventListener('popstate',()=>{if(!dmRoute())stop()});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')stop()});
function pending(id){try{return JSON.parse(localStorage.getItem(key(OUTBOX,id))||'[]')}catch{return[]}}
function retainMessages(id,rows){const map=new Map(pending(id).map(r=>[r.message_key,r]));for(const r of rows)map.set(r.message_key,r);localStorage.setItem(key(OUTBOX,id),JSON.stringify([...map.values()]))}

const modern=()=>Boolean(globalThis.GM),key=(p,id)=>p+String(id||'').toLowerCase(),sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function get(k,d){try{if(modern()&&typeof GM.getValue==='function')return await GM.getValue(k,d);if(typeof GM_getValue==='function')return GM_getValue(k,d)}catch{}return d}
async function set(k,v){try{if(modern()&&typeof GM.setValue==='function')return await GM.setValue(k,v);if(typeof GM_setValue==='function')return GM_setValue(k,v)}catch{}}
function request(url,body,headers={}){return new Promise((resolve,reject)=>{const fn=modern()&&typeof GM.xmlHttpRequest==='function'?GM.xmlHttpRequest:typeof GM_xmlhttpRequest==='function'?GM_xmlhttpRequest:null;if(!fn)return reject(new Error('USERSCRIPT_REQUEST_UNAVAILABLE'));fn({method:'POST',url,headers:{'Content-Type':'application/json',...headers},data:JSON.stringify(body),timeout:60000,onload:r=>{let p={};try{p=JSON.parse(r.responseText||'{}')}catch{};r.status>=200&&r.status<300&&p.ok!==false?resolve(p):reject(new Error(p.error||('HTTP_'+r.status)))},onerror:()=>reject(new Error('NETWORK_ERROR')),ontimeout:()=>reject(new Error('TIMEOUT'))})})}
const clean=v=>String(v||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
const dmRoute=()=>/^\/messages\/rooms(?:\/|$)/i.test(location.pathname);
const rootRoute=()=>/^\/messages\/rooms\/?$/i.test(location.pathname);
const shown=el=>{if(!el||el.nodeType!==1)return false;const doc=el.ownerDocument||document,w=doc.defaultView||window,r=el.getBoundingClientRect();if(r.width<1||r.height<1)return false;for(let p=el;p&&p!==doc.body;p=p.parentElement){const s=w.getComputedStyle(p);if(p.hidden||p.getAttribute('aria-hidden')==='true'||s.display==='none'||s.visibility==='hidden')return false}return true};
const ROOM_ID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function roomKeyFromUrl(v){try{const u=new URL(String(v||''),location.href),m=u.pathname.match(/^\/messages\/rooms\/([^/?#]+)/i),id=m&&m[1]?m[1]:'';return ROOM_ID_RE.test(id)?id:''}catch{return''}}
function creatorId(v){try{const u=new URL(String(v||''),location.href),p=u.pathname.split('/').filter(Boolean),id=String(p[0]||'').toLowerCase();return u.hostname.endsWith('note.com')&&p.length===1&&/^[a-z0-9_-]+$/.test(id)&&!['messages','settings','notifications'].includes(id)?id:''}catch{return''}}
async function account(){try{const r=await fetch('/api/v2/current_user',{credentials:'include',cache:'no-store'});if(r.ok){const j=await r.json(),u=(j.data??j).user||(j.data??j),id=String(u.urlname||u.url_name||u.username||'').toLowerCase();if(/^[a-z0-9_-]+$/.test(id))return{id}}}catch{}return null}
function hash(v){let a=2166136261,b=2246822519;for(let i=0;i<v.length;i++){const c=v.charCodeAt(i);a=Math.imul(a^c,16777619);b=Math.imul(b^c,3266489917)}return((a>>>0).toString(16).padStart(8,'0')+(b>>>0).toString(16).padStart(8,'0'))}
function relativeTime(raw){const m=clean(raw).match(/(\d+)\s*(秒|分|時間|日|週)前/u);if(!m)return null;const u={'秒':1000,'分':60000,'時間':3600000,'日':86400000,'週':604800000};return new Date(Date.now()-Number(m[1])*u[m[2]]).toISOString()}
function roomAnchors(doc=document){const map=new Map(),base=doc.defaultView?.location?.href||location.href;for(const a of doc.querySelectorAll('a[href]')){if(!shown(a))continue;const href=a.getAttribute('href')||'',k=roomKeyFromUrl(href);if(!k)continue;const u=new URL(href,base);u.hash='';map.set(k,{a,url:u.href,key:k})}return[...map.values()].slice(0,MAX_ROOMS)}
function roomData(x){const a=x.a,box=a.closest('li,[role="listitem"],article')||a.parentElement||a;const text=clean((box&&box.textContent)||a.textContent),img=box&&box.querySelector?box.querySelector('img[src]'):null;let peerUrl=null,peerId=null;for(const l of (box&&box.querySelectorAll?box.querySelectorAll('a[href]'):[])){const id=creatorId(l.getAttribute('href'));if(id){peerId=id;peerUrl=new URL(l.getAttribute('href'),location.href).href;break}}const dt=box&&box.querySelector?box.querySelector('time[datetime],[datetime]'):null,tm=dt&&dt.getAttribute('datetime')||relativeTime(text);let name=clean((img&&img.getAttribute('alt'))||a.getAttribute('aria-label')||a.textContent).replace(/\s+(?:たった今|昨日|\d+\s*(?:秒|分|時間|日|週)前).*$/u,'').replace(/とのメッセージ(?:（未読のメッセージがあります）)?$/u,'').trim().slice(0,300)||null;return{thread_key:x.key,room_url:x.url,peer_note_id:peerId,peer_name:name,peer_url:peerUrl,peer_image_url:img?String(img.currentSrc||img.src||''):null,last_message_at:tm,meta:{preview:text.slice(0,4000),source:'note-dm-room-list-v1'}}}
function previewMessage(t){let raw=clean(t?.meta?.preview||'');if(!raw)return null;const name=clean(t?.peer_name||'');let body=raw;if(name&&body.startsWith(name))body=body.slice(name.length).trim();body=body.replace(/とのメッセージ(?:（未読のメッセージがあります）)?/u,'').replace(/(?:たった今|昨日|約?\d+\s*(?:秒|分|時間|日|週)前)$/u,'').trim();if(!body)return null;return{thread_key:t.thread_key,message_key:'preview:'+t.thread_key+':'+hash(body),direction:'unknown',sender_name:t.peer_name||null,sender_url:t.peer_url||null,sender_image_url:t.peer_image_url||null,body,sent_at:t.last_message_at||null,raw_text:raw,attachment_name:null,attachment_url:null,attachment_type:null,meta:{source:'note-dm-room-preview-v130',preview:true}}}
function textbox(doc=document){return[...doc.querySelectorAll('textarea,[contenteditable="true"],[role="textbox"]')].find(shown)||null}
function candidateNodes(root){
 if(!root)return[];
 const selector='[data-message-id],[data-testid*="message" i],[class*="messageItem" i],[class*="chatItem" i],[class*="bubble" i],[class*="messageBody" i],[class*="messageText" i],[class*="message_content" i],[class*="message_text" i],[class*="message-body" i],[class*="message-text" i],li,[role="listitem"],article';
 let all=[...root.querySelectorAll(selector)].filter(el=>{
  if(!shown(el)||el.closest('nav,header,form')||el.querySelector('textarea,[contenteditable="true"],[role="textbox"],a[href*="/messages/rooms/"]'))return false;
  const text=clean(el.textContent);return (text.length>0&&text.length<=12000)||Boolean(el.querySelector('a[download],img[src]'));
 });
 // A wrapper around several bubbles must not become one combined message.
 return all.filter(el=>!all.some(child=>child!==el&&el.contains(child)));
}
function conversationRoot(doc=document){const input=textbox(doc),win=doc.defaultView||window;if(input){let p=input.parentElement,best=null,d=0;while(p&&p!==doc.body&&p!==doc.documentElement&&d++<14){if(shown(p)){const xs=candidateNodes(p),roomLinks=p.querySelectorAll('a[href*="/messages/rooms/"]').length;if(xs.length&&roomLinks<3)best=p;const r=p.getBoundingClientRect();if(best&&r.height>(win.innerHeight||800)*.7)break}p=p.parentElement}if(best)return best}for(const root of doc.querySelectorAll('main,[role="main"],section,[class*="message" i],[class*="chat" i],[class*="conversation" i]')){if(!shown(root))continue;const xs=candidateNodes(root),roomLinks=root.querySelectorAll('a[href*="/messages/rooms/"]').length;if(xs.length&&roomLinks<3)return root}return null}
function scrollHost(root){if(!root)return null;const w=root.ownerDocument?.defaultView||window,xs=candidateNodes(root);let p=xs[0]||root;while(p&&root.contains(p)){const s=w.getComputedStyle(p);if(p.scrollHeight>p.clientHeight+30&&/(auto|scroll)/.test(s.overflowY))return p;if(p===root)break;p=p.parentElement}for(const el of root.querySelectorAll('div,section,main')){if(!shown(el))continue;const s=w.getComputedStyle(el);if(el.scrollHeight>el.clientHeight+30&&/(auto|scroll)/.test(s.overflowY)&&candidateNodes(el).length)return el}return root.scrollHeight>root.clientHeight+30?root:null}
function direction(el,root,me){const meta=clean([el.getAttribute('data-testid'),el.getAttribute('data-direction'),el.getAttribute('class'),el.getAttribute('aria-label')].join(' ')).toLowerCase();if(/(?:outgoing|sent|mine|my-message|from-me|self)/.test(meta))return'outbound';if(/(?:incoming|received|from-them|other)/.test(meta))return'inbound';for(const a of el.querySelectorAll('a[href]')){const id=creatorId(a.getAttribute('href'));if(id)return id===me?'outbound':'inbound'}const rr=root.getBoundingClientRect(),r=el.getBoundingClientRect(),center=r.left+r.width/2;if(center>rr.left+rr.width*.62)return'outbound';if(center<rr.left+rr.width*.38)return'inbound';return'unknown'}
function messageData(el,threadKey,root,me,duplicateFromNewest=0){const raw=clean(el.textContent),dt=el.querySelector('time[datetime],[datetime]'),tm=dt&&dt.getAttribute('datetime')||relativeTime(raw),dir=direction(el,root,me),baseHref=el.ownerDocument?.defaultView?.location?.href||location.href;let senderUrl=null,senderName=null,senderImage=null;for(const a of el.querySelectorAll('a[href]')){const id=creatorId(a.getAttribute('href'));if(id){senderUrl=new URL(a.getAttribute('href'),baseHref).href;senderName=clean(a.textContent)||id;break}}const img=[...el.querySelectorAll('img[src]')].find(x=>!/emoji|stamp|attachment|upload/i.test(String(x.className||'')+' '+String(x.alt||'')));if(img)senderImage=String(img.currentSrc||img.src||'');let attachmentUrl=null,attachmentName=null,attachmentType=null;for(const a of el.querySelectorAll('a[href]')){const href=String(a.href||'');if(!href||creatorId(href)||/\/messages\/rooms/i.test(href))continue;attachmentUrl=href;attachmentName=clean(a.getAttribute('download')||a.textContent)||null;attachmentType=/\.(?:png|jpe?g|gif|webp|heic)(?:$|\?)/i.test(href)?'image':'file';break}if(!attachmentUrl){const ai=[...el.querySelectorAll('img[src]')].find(x=>x!==img);if(ai){attachmentUrl=String(ai.currentSrc||ai.src||'');attachmentName=clean(ai.alt)||null;attachmentType='image'}}let body=raw;if(senderName&&body.startsWith(senderName))body=body.slice(senderName.length).trim();body=body.replace(/\s*(?:既読|未読)?\s*(?:たった今|昨日|\d+\s*(?:秒|分|時間|日|週)前)?$/u,'').trim();const domId=el.getAttribute('data-message-id')||el.getAttribute('data-id')||el.getAttribute('id')||'',base=[threadKey,domId,dt?.getAttribute('datetime')||'',dir,body,attachmentUrl||'',duplicateFromNewest].join('|');return{thread_key:threadKey,message_key:domId?('dom:'+threadKey+':'+domId):('sig:'+hash(base)),direction:dir,sender_name:senderName,sender_url:senderUrl,sender_image_url:senderImage,body:body||null,sent_at:tm,raw_text:raw||null,attachment_name:attachmentName,attachment_url:attachmentUrl,attachment_type:attachmentType,meta:{source:'note-dm-dom-v1',room_url:location.href,time_estimated:!dt}}}
async function save(a,threads,messages){const token=String(await get(key(TOKEN,a.id),'')||'');if(!token)throw new Error('DM_PAIR_REQUIRED');return request(INGEST,{noteId:a.id,threads,messages},{'X-Ingest-Token':token})}
function cloak(on){try{if(on){document.documentElement.style.setProperty('visibility','hidden','important');document.documentElement.setAttribute('data-mumei-dm-scan-cloak','1')}else{document.documentElement.style.removeProperty('visibility');document.documentElement.removeAttribute('data-mumei-dm-scan-cloak')}}catch{}}
async function scanRoom(a,threadKey,doc=document,roomUrl=location.href,alive=()=>true){
 let root=null;
 for(let i=0;i<60&&!interrupted&&alive();i++){root=conversationRoot(doc);if(root)break;await sleep(180)}
 if(!root)throw new Error('DM_CONVERSATION_NOT_FOUND');
 const map=new Map(),knownRaw=await get(key(SAVED,a.id)+':'+threadKey,[]),confirmed=new Set(Array.isArray(knownRaw)?knownRaw:[]);
 let saved=0,read=0,stable=0,lastHeight=-1,lastCount=-1,reachedEnd=false;
 const capture=()=>{root=conversationRoot(doc)||root;const repeats=new Map();for(const el of candidateNodes(root).slice().reverse()){const text=clean(el.textContent),index=repeats.get(text)||0;repeats.set(text,index+1);const m=messageData(el,threadKey,root,a.id,index);if(m.body||m.attachment_url)map.set(m.message_key,m)}retainMessages(a.id,[...map.values()].filter(m=>!confirmed.has(m.message_key)));read=map.size};
 const flush=async()=>{
  let rows=pending(a.id).filter(m=>m.thread_key===threadKey&&!confirmed.has(m.message_key));
  while(rows.length){
   const me=await account();if(me?.id!==a.id)throw new Error('NOTE_ACCOUNT_CHANGED');
   const part=rows.slice(0,50),p=await save(a,[],part),sent=new Set(part.map(m=>m.message_key)),ack=(p.confirmedMessageKeys||[]).filter(k=>sent.has(k));
   for(const k of ack)confirmed.add(k);saved+=ack.length;
   await set(key(SAVED,a.id)+':'+threadKey,[...confirmed].slice(-20000));
   localStorage.setItem(key(OUTBOX,a.id),JSON.stringify(pending(a.id).filter(m=>m.thread_key!==threadKey||!confirmed.has(m.message_key))));
   await updateCheck(a,{lastRunAt:Date.now(),lastSaveAt:Date.now(),lastRunComplete:false,lastThreadKey:threadKey,lastReadCount:read,lastSavedCount:saved,lastError:''});
   if(ack.length!==part.length)throw new Error('DM_SAVE_UNCONFIRMED');
   rows=rows.slice(part.length);if(interrupted||!alive())break;
  }
 };
 capture();await flush();
 const host=scrollHost(root),w=doc.defaultView||window;
 for(let i=0;i<MAX_SCROLL&&!interrupted&&alive()&&map.size<MAX_MESSAGES;i++){
  if(host){host.scrollTop=0;try{host.dispatchEvent(new w.Event('scroll',{bubbles:true}))}catch{}}
  await sleep(350);capture();await flush();
  const height=host?host.scrollHeight:0,count=map.size;
  if(height===lastHeight&&count===lastCount&&(!host||host.scrollTop===0))stable++;else stable=0;
  lastHeight=height;lastCount=count;
  if(stable>=8){reachedEnd=true;break}
 }
 capture();await flush();
 const empty=/(?:メッセージはありません|まだメッセージがありません|会話を始め)/u.test(clean(root.textContent));
 if(!read&&!empty)throw new Error('DM_MESSAGE_BODY_NOT_FOUND');
 return{read,saved,complete:reachedEnd&&!interrupted&&alive(),empty};
}
async function updateCheck(a,patch){const prev=await get(key(CHECK,a.id),{});await set(key(CHECK,a.id),{...prev,...patch,version:VERSION})}
let bgRunning=false,bgLastAt=0,bgWorkerDone=false;
function bgUrl(v){try{const u=new URL(v,location.href);u.searchParams.set('mumei_dm_parent','1');return u.href}catch{return String(v||'')}}
function syncFrame(a,url,threadKey){
 return new Promise(resolve=>{
  const frame=document.createElement('iframe');frame.setAttribute('aria-hidden','true');frame.tabIndex=-1;frame.style.cssText='position:fixed!important;width:390px!important;height:800px!important;opacity:0!important;pointer-events:none!important;left:-12000px!important;top:0!important;border:0!important';
  let done=false;
  const finish=x=>{if(done)return;done=true;clearTimeout(timer);try{frame.remove()}catch{}resolve(x)};
  const timer=setTimeout(()=>finish({threadKey,read:0,saved:0,timeout:true}),180000);
  frame.addEventListener('load',()=>{void (async()=>{try{const doc=frame.contentDocument;if(!doc)throw new Error('DM_FRAME_DOCUMENT_MISSING');const r=await scanRoom(a,threadKey,doc,url,()=>!done);finish({threadKey,...r,parentScan:true})}catch(e){finish({threadKey,read:0,saved:0,error:String(e?.message||e),parentScan:true})}})()},{once:true});
  frame.src=bgUrl(url);document.body.appendChild(frame)
 })
}
async function syncRoomsInBackground(a,rooms){
 if(bgRunning||!Array.isArray(rooms)||!rooms.length)return;
 const previous=await get(key(QUEUE,a.id),null);
 if(!previous&&Date.now()-bgLastAt<45000)return;
 bgRunning=true;bgLastAt=Date.now();interrupted=false;
 const list=rooms.slice(0,MAX_ROOMS),completed=new Set(previous?.completed||[]),errors=[];
 let read=Number(previous?.read||0),saved=Number(previous?.saved||0);
 const checkpoint=async()=>{
  const value={completed:[...completed],read,saved,at:Date.now()};await set(key(QUEUE,a.id),value);
  await updateCheck(a,{lastRunAt:Date.now(),lastRunMode:'background',lastRunComplete:false,lastReadCount:read,lastSavedCount:saved,threadCount:list.length,currentThread:completed.size,lastError:errors.join(' / '),navigationMode:'background-hidden'});
 };
 try{
  await checkpoint();
  for(const room of list){
   if(interrupted||!dmRoute())break;
   if(completed.has(room.key))continue;
   const result=await syncFrame(a,room.url,room.key);
   read+=Number(result.read||0);saved+=Number(result.saved||0);
   if(result.complete&&!result.error&&!result.timeout)completed.add(room.key);
   else{const reason=result.error||(result.timeout?'TIMEOUT':'途中保存');errors.push(`${room.key}: ${reason}`);await updateCheck(a,{lastError:String(reason),lastThreadKey:room.key,lastStage:'message-body'});}
   await checkpoint();
  }
  const complete=list.length>0&&list.every(room=>completed.has(room.key));
  if(complete)await set(key(QUEUE,a.id),null);
  await updateCheck(a,{lastRunAt:Date.now(),lastRunMode:complete?'full':'partial',lastRunComplete:complete,...(complete?{lastFullScanAt:Date.now()}:{}),lastReadCount:read,lastSavedCount:saved,threadCount:list.length,currentThread:completed.size,lastError:errors.join(' / '),navigationMode:'background-hidden'});
 }catch(e){errors.push(String(e?.message||e));await checkpoint()}
 finally{bgRunning=false}
}
async function clearLegacyQueue(a){try{sessionStorage.removeItem(DONE);cloak(false)}catch{}}
async function run(){
 if(!dmRoute()){interrupted=true;return}if(bgRunning)return;interrupted=false;
 const a=await account();if(!a)return;
 await clearLegacyQueue(a);
 const qs=new URLSearchParams(location.search),isParentWorker=window.top!==window.self&&qs.get('mumei_dm_parent')==='1',isBg=window.top!==window.self&&qs.get('mumei_dm_bg')==='1';
 if(isParentWorker)return;
 if(rootRoute()&&!isBg){
  const rooms=roomAnchors(),threads=rooms.map(roomData);
  if(threads.length)await save(a,threads,[]);
  if(!bgRunning)await updateCheck(a,{threadCount:threads.length,navigationMode:'passive'});
  void syncRoomsInBackground(a,rooms);
  return
 }
 const threadKey=roomKeyFromUrl(location.href);if(!threadKey)return;
 if(isBg&&bgWorkerDone)return; if(isBg)bgWorkerDone=true;
 try{
  const r=await scanRoom(a,threadKey);
  await set(key(SAVED,a.id),{lastThreadKey:threadKey,lastSavedAt:Date.now()});
  await updateCheck(a,{lastRunAt:Date.now(),lastRunMode:isBg?'background-room':'single-passive',lastRunComplete:Boolean(r.complete),lastReadCount:r.read,lastSavedCount:r.saved,lastThreadKey:threadKey,lastError:'',navigationMode:isBg?'background-hidden':'passive'});
  if(isBg)parent.postMessage({source:'mumei-dm-bg-v130',threadKey,read:r.read,saved:r.saved},location.origin)
 }catch(e){
  await updateCheck(a,{lastRunAt:Date.now(),lastRunComplete:false,lastRunMode:isBg?'background-room':'single-passive',lastError:String(e&&e.message||e),navigationMode:isBg?'background-hidden':'passive'});
  if(isBg)parent.postMessage({source:'mumei-dm-bg-v130',threadKey,read:0,saved:0,error:String(e&&e.message||e)},location.origin);else cloak(false)
 }
}
{let timer=0,running=false;const schedule=(ms=180)=>{clearTimeout(timer);timer=setTimeout(()=>{if(running)return;running=true;Promise.resolve(run()).catch(()=>{}).finally(()=>{running=false})},ms)};schedule(220);new MutationObserver(()=>schedule(180)).observe(document.documentElement,{subtree:true,childList:true});addEventListener('pageshow',()=>schedule(180));addEventListener('focus',()=>schedule(180));window.__mumeiInsightDmReaderV1Api={version:VERSION,stop,scanRoom,syncRoomsInBackground,candidateNodes,messageData,roomAnchors,run:()=>{if(running)return false;running=true;Promise.resolve(run()).catch(()=>{}).finally(()=>{running=false});return true}}}
})();