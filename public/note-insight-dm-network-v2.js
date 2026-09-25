(function(){
'use strict';
if(location.hostname!=='note.com')return;
if(window.__mumeiDmNetworkV2Loaded)return;window.__mumeiDmNetworkV2Loaded=true;
const VERSION='1.4.6';
const INGEST='https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-dm-ingest';
const TOKEN='mumei_insight_dm_sync_token_v1:',CHECK='mumei_insight_dm_checkpoint_v1:';
const modern=()=>Boolean(globalThis.GM),key=(p,id)=>p+String(id||'').toLowerCase();
const clean=v=>String(v??'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
const pageWindow=()=>{try{return typeof unsafeWindow!=='undefined'?unsafeWindow:window}catch{return window}};
const dmSurface=()=>/^\/messages\/rooms(?:\/|$)/i.test(location.pathname);
async function get(k,d){if(modern()&&typeof GM.getValue==='function')return await GM.getValue(k,d);if(typeof GM_getValue==='function')return GM_getValue(k,d);const raw=localStorage.getItem(k);return raw===null?d:JSON.parse(raw)}
async function set(k,v){if(modern()&&typeof GM.setValue==='function')return await GM.setValue(k,v);if(typeof GM_setValue==='function')return GM_setValue(k,v);localStorage.setItem(k,JSON.stringify(v))}
function request(body,token){return new Promise((resolve,reject)=>{const fn=modern()&&typeof GM.xmlHttpRequest==='function'?GM.xmlHttpRequest:typeof GM_xmlhttpRequest==='function'?GM_xmlhttpRequest:null;if(!fn)return reject(new Error('DM_REQUEST_UNAVAILABLE'));fn({method:'POST',url:INGEST,headers:{'Content-Type':'application/json','X-Ingest-Token':token},data:JSON.stringify(body),timeout:45000,onload:r=>{let p={};try{p=JSON.parse(r.responseText||'{}')}catch{};r.status>=200&&r.status<300&&p?.ok!==false?resolve(p):reject(new Error(p?.error||('HTTP_'+r.status)))},onerror:()=>reject(new Error('DM_NETWORK_ERROR')),ontimeout:()=>reject(new Error('DM_TIMEOUT'))})})}
async function account(){try{const r=await fetch('/api/v2/current_user',{credentials:'include',cache:'no-store'});if(!r.ok)return null;const j=await r.json(),u=(j.data??j).user||(j.data??j),id=String(u?.urlname||u?.url_name||u?.username||'').replace(/^@/,'').toLowerCase();return/^[a-z0-9_-]+$/.test(id)?{id}:null}catch{return null}}
const ROOM_ID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function roomFromUrl(v){try{const u=new URL(String(v||''),location.href),m=u.pathname.match(/^\/(?:api\/v[0-9]+\/)?messages\/rooms\/([^/?#]+)/i)||u.pathname.match(/^\/api\/v[0-9]+\/[^/]+\/rooms\/([^/?#]+)\/messages(?:\/|$)/i),id=m?.[1]||'';return ROOM_ID_RE.test(id)?id:''}catch{return''}}
function abs(v){try{return new URL(String(v||''),location.href).href}catch{return''}}
function hash(v){let a=2166136261,b=2246822519;for(let i=0;i<v.length;i++){const x=v.charCodeAt(i);a=Math.imul(a^x,16777619);b=Math.imul(b^x,3266489917)}return(a>>>0).toString(16).padStart(8,'0')+(b>>>0).toString(16).padStart(8,'0')}
const BODY=['body','message','text','content','message_body','messageBody','plain_text','plainText'];
const TIME=['sent_at','sentAt','created_at','createdAt','posted_at','postedAt','timestamp','datetime'];
const IDS=['message_id','messageId','message_key','messageKey','message_uuid','messageUuid','id','uuid','key'];
function messageId(obj){
 const direct=first(obj,IDS);if(direct)return direct;
 const candidates=Object.entries(obj||{}).filter(([k,v])=>!/(?:room|thread|sender|user|author|account)/i.test(k)&&/(?:message|uuid|uid|id|key)/i.test(k)&&typeof v==='string'&&ROOM_ID_RE.test(v));
 return candidates.length===1?candidates[0][1]:'';
}
const ROOMS=['room_id','roomId','room_key','roomKey','thread_id','threadId','conversation_id','conversationId'];
const URLS=['url','href','link','attachment_url','attachmentUrl','file_url','fileUrl'];
function first(obj,keys){for(const k of keys){const v=obj?.[k];if(typeof v==='string'&&clean(v))return clean(v);if(typeof v==='number'&&Number.isFinite(v))return String(v)}return''}
function nested(obj,keys){for(const k of keys){const v=obj?.[k];if(v&&typeof v==='object'&&!Array.isArray(v))return v}return null}
function time(obj){for(const k of TIME){const v=obj?.[k];if(typeof v==='string'&&!Number.isNaN(Date.parse(v)))return new Date(v).toISOString();if(typeof v==='number'&&v>1e9)return new Date(v<1e12?v*1000:v).toISOString()}return null}
function creatorId(v){try{const u=new URL(String(v||''),location.href),p=u.pathname.split('/').filter(Boolean),id=(p[0]||'').toLowerCase();return u.hostname.endsWith('note.com')&&p.length===1&&/^[a-z0-9_-]+$/.test(id)?id:''}catch{return''}}
function sender(obj){
 const s=nested(obj,['sender','user','from_user','fromUser','author','creator','account']);
 const name=first(s||{},['name','display_name','displayName','nickname','urlname','username'])||first(obj,['sender_name','senderName','user_name','userName']);
 const url=first(s||{},['url','profile_url','profileUrl','href'])||first(obj,['sender_url','senderUrl']);
 const id=first(s||{},['urlname','username'])||creatorId(url);
 const image=first(s||{},['user_profile_image_path','profile_image_url','profileImageUrl','image_url','imageUrl','avatar_url','avatarUrl']);
 return{name,id,url:url?abs(url):id?('https://note.com/'+id):null,image:image?abs(image):null}
}
function bodyText(obj){for(const k of BODY){const v=obj?.[k];if(typeof v==='string'){const s=v.replace(/<br\s*\/?\s*>/gi,'\n').replace(/<\/(?:p|div)>/gi,'\n').replace(/<[^>]*>/g,'').replace(/\r\n?/g,'\n').trim();if(s&&s.length<=12000)return s}}return''}
function roomKey(obj,inherited=''){const raw=first(obj,ROOMS)||inherited;return ROOM_ID_RE.test(String(raw||''))?String(raw):''}
function attachment(obj){
 const a=nested(obj,['attachment','file','image','media']);
 const url=first(a||{},URLS)||first(obj,['attachment_url','attachmentUrl','file_url','fileUrl']);
 if(!url)return{url:null,name:null,type:null};
 const name=first(a||{},['name','filename','file_name','fileName'])||first(obj,['attachment_name','attachmentName']);
 const type=first(a||{},['type','mime_type','mimeType'])||(/\.(?:png|jpe?g|gif|webp|heic)(?:$|\?)/i.test(url)?'image':'file');
 return{url:abs(url)||url,name:name||null,type:type||null}
}
function responseHint(url,body,json){
 const hay=(String(url||'')+' '+String(body||'')).toLowerCase();
 if(/message|messages|room|rooms|conversation|chat|direct.?message|dm/.test(hay))return true;
 try{const s=JSON.stringify(json).slice(0,250000).toLowerCase();return/(message_id|room_id|conversation_id|sender_id|messages)/.test(s)&&/(body|content|text)/.test(s)}catch{return false}
}
function extract(json,requestUrl,me){
 const out=[],seen=new Set(),currentRoom=roomFromUrl(requestUrl),requestRoom=apiEndpoint(requestUrl)?currentRoom:'';
 function walk(v,path='',depth=0,inheritedRoom=currentRoom){
  if(depth>10||v==null)return;
  if(Array.isArray(v)){for(const x of v.slice(0,3000))walk(x,path+'[]',depth+1,inheritedRoom);return}
  if(typeof v!=='object')return;
  const containerRoom=/(?:^|\.)(?:room|conversation|thread)$/i.test(path)&&ROOM_ID_RE.test(String(v.id||''))?String(v.id):inheritedRoom;
  const room=roomKey(v,containerRoom),body=bodyText(v),id=messageId(v),s=sender(v),at=time(v),att=attachment(v);
  if(requestRoom&&room&&room!==requestRoom)return;
  const keys=Object.keys(v).join(' ').toLowerCase();
  const pathHint=/message|messages|chat|conversation|room/.test((path+' '+keys).toLowerCase())||(Boolean(currentRoom)&&/^data(?:\[\])?$/.test(path));
  if(room&&(body||att.url)&&pathHint&&!/last_?message|preview/i.test(path)&&(id||at||s.name||s.id)){
   const direction=s.id?((s.id||'').toLowerCase()===me?'outbound':'inbound'):'unknown';
   const messageKey=id?('api:'+room+':'+id):('api-sig:'+hash([room,at||'',direction,body,att.url||''].join('|')));
   if(!seen.has(messageKey)){seen.add(messageKey);out.push({thread_key:room,message_key:messageKey,direction,sender_name:s.name||null,sender_url:s.url||null,sender_image_url:s.image||null,body:body||null,sent_at:at,raw_text:body||null,attachment_name:att.name,attachment_url:att.url,attachment_type:att.type,meta:{source:'note-dm-network-v2',userscript:VERSION,request_url:requestUrl,is_read:v.is_read??v.isRead??v.read??v.seen??null,network_path:path,id_field:IDS.find(k=>v[k]!=null)||null,field_names:Object.keys(v).slice(0,40)}})}
  }
  const nextRoom=room||inheritedRoom;for(const[k,x]of Object.entries(v))if(x&&typeof x==='object')walk(x,path?path+'.'+k:k,depth+1,nextRoom)
 }
 walk(json);return out
}
let saving=Promise.resolve(),captured=0,saved=0;const roomCounts=new Map(),roomRows=new Map();
let roomOwner='',apiTemplate=null;const historyJobs=new Map();
const SAVED='mumei_insight_dm_saved_v1:',HISTORY='mumei_insight_dm_history_v144:';
function selectOwner(id){if(roomOwner!==id){roomRows.clear();roomCounts.clear();apiTemplate=null;captured=0;saved=0;roomOwner=id}}
function remember(rows){for(const row of rows){let map=roomRows.get(row.thread_key);if(!map){map=new Map();roomRows.set(row.thread_key,map)}map.set(row.message_key,row)}}
function snapshot(k){return [...(roomRows.get(String(k))||new Map()).values()]}
function flightRows(text,url,me){
 const records=new Map();for(const line of String(text||'').split('\n')){const at=line.indexOf(':');if(at<1)continue;try{records.set(line.slice(0,at),JSON.parse(line.slice(at+1)))}catch{}}
 const resolve=(value,seen=new Set(),depth=0)=>{if(depth>18)return null;if(typeof value==='string'&&/^\$[0-9a-f]+$/i.test(value)){const id=value.slice(1);if(records.has(id)&&!seen.has(id))return resolve(records.get(id),new Set([...seen,id]),depth+1)}if(Array.isArray(value))return value.map(v=>resolve(v,seen,depth+1));if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,resolve(v,seen,depth+1)]));return value};
 const rows=new Map();for(const value of records.values())for(const row of extract(resolve(value),url,me))rows.set(row.message_key,row);return [...rows.values()]
}
function fromDocument(doc,url,me){selectOwner(me);const rows=[];let flight='';for(const script of doc.querySelectorAll('script')){const text=script.textContent||'';if(text.length>5000000)continue;try{if(script.type==='application/json'||script.id==='__NEXT_DATA__')rows.push(...extract(JSON.parse(text),url,me));else{const match=text.match(/^\s*(?:self\.)?__next_f\.push\((\[[\s\S]*\])\)\s*;?\s*$/);if(match){const chunk=JSON.parse(match[1]);if(chunk[0]===1&&typeof chunk[1]==='string')flight+=chunk[1]}}}catch{}}rows.push(...flightRows(flight,url,me));remember(rows);return rows}
async function readRoom(url,me){
 const room=roomFromUrl(url);if(!room||new URL(url,location.href).origin!==location.origin)throw new Error('DM_ROOM_URL_INVALID');
 const c=new AbortController(),timer=setTimeout(()=>c.abort(),12000);
 try{const res=await fetch(url,{credentials:'include',cache:'no-store',signal:c.signal});if(!res.ok)throw new Error('DM_ROOM_HTTP_'+res.status);if(res.url&&roomFromUrl(res.url)!==room)throw new Error('DM_ROOM_REDIRECTED');const html=await res.text();return fromDocument(new DOMParser().parseFromString(html,'text/html'),url,me)}finally{clearTimeout(timer)}
}
function addRoom(rows,field){for(const r of rows){const k=String(r.thread_key||'');if(!k)continue;const v=roomCounts.get(k)||{captured:0,saved:0};v[field]=Number(v[field]||0)+1;roomCounts.set(k,v)}}
const OUTBOX='mumei_dm_network_outbox_v140:';
async function pending(id){const saved=await get(key(OUTBOX+'durable:',id),null);if(Array.isArray(saved))return saved;try{const v=JSON.parse(localStorage.getItem(key(OUTBOX,id))||'[]');return Array.isArray(v)?v:[]}catch{return[]}}
async function retain(id,rows){await set(key(OUTBOX+'durable:',id),rows);try{localStorage.removeItem(key(OUTBOX,id))}catch{}}
async function persist(rows,owner){
 const a=await account();if(!a||owner&&owner!==a.id)throw new Error('NOTE_ACCOUNT_CHANGED');
 selectOwner(a.id);const known=new Map();for(const row of rows){if(!known.has(row.thread_key))known.set(row.thread_key,new Set(await get(key(SAVED,a.id)+':'+row.thread_key,[])))}
 const map=new Map((await pending(a.id)).map(r=>[r.message_key,r]));for(const row of rows)if(!known.get(row.thread_key)?.has(row.message_key))map.set(row.message_key,row);
 await retain(a.id,[...map.values()]);if(!map.size)return;
 const token=String(await get(key(TOKEN,a.id),'')||'');if(!token)throw new Error('DM_PAIR_REQUIRED');
 captured+=rows.length;addRoom(rows,'captured');
 while(map.size){
  const current=await account();if(current?.id!==a.id)throw new Error('NOTE_ACCOUNT_CHANGED');
  const part=[...map.values()].slice(0,50),p=await request({noteId:a.id,threads:[],messages:part},token),sent=new Set(part.map(r=>r.message_key));
  const ack=new Set((p.confirmedMessageKeys||[]).filter(k=>sent.has(k)));for(const thread of new Set(part.map(r=>r.thread_key))){const prior=new Set(await get(key(SAVED,a.id)+':'+thread,[]));for(const row of part)if(row.thread_key===thread&&ack.has(row.message_key))prior.add(row.message_key);await set(key(SAVED,a.id)+':'+thread,[...prior].slice(-20000))}for(const k of ack)map.delete(k);
  await retain(a.id,[...map.values()]);saved+=ack.size;addRoom(part.filter(r=>ack.has(r.message_key)),'saved');
  const prev=await get(key(CHECK,a.id),{}),now=Date.now();await set(key(CHECK,a.id),{...prev,lastRunAt:now,lastSaveAt:now,networkReadCount:captured,networkSavedCount:saved,version:VERSION});
  if(ack.size!==part.length)throw new Error('DM_SAVE_UNCONFIRMED');
 }
}
async function inspect(meta,res,transport){
 if(!res||!/^\/messages\/rooms(?:\/|$)/i.test(location.pathname)||(!apiEndpoint(meta.url)&&!roomFromUrl(meta.url)))return;
 let txt='';try{txt=await res.text()}catch{return}if(!txt||txt.length>5000000)return;
 let json=null;try{json=JSON.parse(txt)}catch{}if(!responseHint(meta.url,meta.body,json))return;
 const capturedOwner=meta.owner?await meta.owner:null,a=await account();if(!a||capturedOwner&&capturedOwner.id!==a.id)return;selectOwner(a.id);learnRequest(meta,json,a.id);const rows=json?extract(json,meta.url,a.id):flightRows(txt,meta.url,a.id);if(!rows.length)return;remember(rows);
 saving=saving.then(()=>persist(rows,a.id)).catch(async e=>{const x=await account();if(x){const prev=await get(key(CHECK,x.id),{});await set(key(CHECK,x.id),{...prev,lastRunAt:Date.now(),lastRunComplete:false,lastRunMode:'network',lastError:String(e?.message||e),version:VERSION})}});
 await saving
}
function requestHeaders(input,init){
 const headers={};for(const h of [input?.headers,init?.headers]){if(h?.forEach)h.forEach((v,k)=>{headers[k]=v});else if(Array.isArray(h))for(const[k,v]of h)headers[k]=v;else if(h&&typeof h==='object')Object.assign(headers,h)}return headers;
}
function apiEndpoint(v){try{const u=new URL(v,location.href);return u.origin==='https://dm-api.note.com'&&/^\/api\/v[0-9]+\/[0-9a-f-]+\/rooms\/[0-9a-f-]+\/messages\/?$/i.test(u.pathname)?u:null}catch{return null}}
function learnRequest(meta,json,owner){
 const u=apiEndpoint(meta.url);if(!u||meta.method!=='GET'||!Array.isArray(json?.data))return;
 // Authorization headers are kept only in memory, scoped to this note account.
 apiTemplate={url:u.href,headers:meta.headers||{},owner};
}
function reqMeta(input,init){let url='',body=null,method='GET';try{if(typeof input==='string'||input instanceof URL){url=String(input);body=init?.body??null;method=String(init?.method||'GET').toUpperCase()}else if(input){url=String(input.url||'');body=init?.body??null;method=String(init?.method||input.method||'GET').toUpperCase()}}catch{}return{url:abs(url),body,method,headers:requestHeaders(input,init),owner:apiEndpoint(url)?account():null}}
let directFetch=null;
async function readHistory(thread,owner,{shouldStop=()=>false,onProgress=async()=>{}}={}){
 const jobKey=owner+':'+thread;if(historyJobs.has(jobKey))return historyJobs.get(jobKey);
 if(!ROOM_ID_RE.test(thread)||!apiTemplate||apiTemplate.owner!==owner||!directFetch)return null;
 const template={...apiTemplate,headers:{...apiTemplate.headers}};
 const job=(async()=>{
  const stateKey=key(HISTORY,owner)+':'+thread;
  let state=await get(stateKey,{});if(!state||typeof state!=='object')state={};
  let read=0,newSaved=0,pages=0;const seen=new Set(),readKeys=new Set();
  const canRead=async()=>{if(shouldStop())return false;const a=await account();if(a?.id!==owner)throw new Error('NOTE_ACCOUNT_CHANGED');return true};
  const checkpoint=async patch=>{state={...state,...patch,at:Date.now(),version:VERSION};await set(stateKey,state)};
  const base=apiEndpoint(template.url);base.pathname=base.pathname.replace(/\/rooms\/[^/]+\/messages/, '/rooms/'+thread+'/messages');base.searchParams.delete('before');base.searchParams.set('sort','desc');base.searchParams.set('perPage','20');
  const page=async before=>{
   if(pages++>=250)throw new Error('DM_BATCH_LIMIT');
   const u=new URL(base);if(before)u.searchParams.set('before',before);
   const signature=u.href;if(seen.has(signature))throw new Error('DM_CURSOR_STALLED');seen.add(signature);
   const ac=new AbortController(),timeout=setTimeout(()=>ac.abort(),20000);
   let json;try{const res=await directFetch(u.href,{method:'GET',credentials:'include',headers:template.headers,cache:'no-store',signal:ac.signal});if(!res.ok)throw new Error('DM_HISTORY_HTTP_'+res.status);json=await res.json()}finally{clearTimeout(timeout)}
   if(!Array.isArray(json?.data))throw new Error('DM_HISTORY_RESPONSE_UNVERIFIED');
   const current=await account();if(current?.id!==owner)throw new Error('NOTE_ACCOUNT_CHANGED');
   const rows=extract(json,u.href,owner).filter(r=>r.thread_key===thread);
   if(json.data.length&&rows.length!==json.data.length)throw new Error('DM_HISTORY_MESSAGE_UNVERIFIED');
   const known=new Set(await get(key(SAVED,owner)+':'+thread,[])),fresh=rows.filter(r=>!known.has(r.message_key));
   remember(rows);
   const saveJob=saving.catch(()=>{}).then(()=>persist(fresh,owner));saving=saveJob;await saveJob;
   for(const row of rows)readKeys.add(row.message_key);read=readKeys.size;newSaved+=fresh.length;
   const storedCount=(await get(key(SAVED,owner)+':'+thread,[])).filter(k=>k.startsWith('api:'+thread+':')).length;
   await onProgress({read,saved:newSaved,stored:storedCount,complete:false,stage:state.complete?'delta':'history'});
   const ordered=json.data.map((row,i)=>({row,i,at:Date.parse(time(row)||'')}));
   if(ordered.length&&ordered.every(x=>Number.isFinite(x.at)))ordered.sort((a,b)=>b.at-a.at||a.i-b.i);
   const beforeNext=ordered.length?messageId(ordered[ordered.length-1].row):'';
   if(rows.length&&!beforeNext)throw new Error('DM_MESSAGE_ID_UNAVAILABLE');
   if(rows.length&&(!/^[A-Za-z0-9_-]{1,200}$/.test(beforeNext)||beforeNext===before))throw new Error('DM_CURSOR_STALLED');
   return{keys:rows.map(r=>r.message_key),before:beforeNext,empty:!json.data.length};
  };
  try{
   // Always check the newest page, then resume the unacknowledged gap. The
   // committed head boundary never advances until the whole new segment saves.
   let cursor='',newHead=null,headDone=false;const boundary=new Set(state.headKeys||[]),pendingHead=new Set(state.pendingHeadKeys||[]),resume=state.headResumeBefore||'';
   while(await canRead()){
    const p=await page(cursor);if(newHead===null)newHead=p.keys;
    if(p.empty){await checkpoint({complete:true,headKeys:newHead,headResumeBefore:null,pendingHeadKeys:null});headDone=true;break}
    if(!boundary.size){await checkpoint({headKeys:newHead,before:state.before||p.before,headResumeBefore:null,pendingHeadKeys:null});headDone=true;break}
    if(p.keys.some(k=>boundary.has(k))){await checkpoint({headKeys:newHead,headResumeBefore:null,pendingHeadKeys:null});headDone=true;break}
    cursor=resume&&p.keys.some(k=>pendingHead.has(k))?resume:p.before;
    await checkpoint({headResumeBefore:cursor,pendingHeadKeys:newHead});
   }
   if(!headDone)return{read,saved:newSaved,complete:false,stopped:true};
   if(state.complete)return{read,saved:newSaved,stored:(await get(key(SAVED,owner)+':'+thread,[])).filter(k=>k.startsWith('api:'+thread+':')).length,complete:true,mode:'delta'};
   cursor=state.before||'';
   while(await canRead()){
    const p=await page(cursor);
    if(p.empty){await checkpoint({complete:true,before:null});return{read,saved:newSaved,stored:(await get(key(SAVED,owner)+':'+thread,[])).filter(k=>k.startsWith('api:'+thread+':')).length,complete:true,mode:'history'}}
    cursor=p.before;await checkpoint({before:cursor,complete:false});
   }
   return{read,saved:newSaved,complete:false,stopped:true};
  }catch(e){const progress={read,saved:newSaved,stored:(await get(key(SAVED,owner)+':'+thread,[])).filter(k=>k.startsWith('api:'+thread+':')).length,complete:false};if(String(e?.message||e)==='DM_BATCH_LIMIT')return{...progress,limited:true};try{e.dmProgress=progress}catch{}throw e}
 })();historyJobs.set(jobKey,job);try{return await job}finally{historyJobs.delete(jobKey)}
}
function installFetch(p=pageWindow()){
 if(!p?.fetch||p.fetch.__mumeiDmNetworkV2)return;const original=p.fetch.bind(p);if(!directFetch)directFetch=original;
 const wrapped=function(input,init){const meta=reqMeta(input,init),promise=original(input,init);if(!dmSurface()&&!apiEndpoint(meta.url)&&!roomFromUrl(meta.url))return promise;try{Promise.resolve(promise).then(r=>void inspect(meta,r.clone(),'fetch')).catch(()=>{})}catch{}return promise};
 try{Object.defineProperty(wrapped,'__mumeiDmNetworkV2',{value:true});p.fetch=wrapped}catch{}
}
function installXHR(p=pageWindow()){
 const X=p?.XMLHttpRequest;if(!X?.prototype||X.prototype.__mumeiDmNetworkV2)return;const proto=X.prototype,open=proto.open,send=proto.send,setHeader=proto.setRequestHeader;
 if(setHeader)proto.setRequestHeader=function(k,v){if(this.__mumeiDmV2)this.__mumeiDmV2.headers[k]=v;return setHeader.call(this,k,v)};
 proto.open=function(method,url,...rest){const relevant=dmSurface()||apiEndpoint(url)||roomFromUrl(url);this.__mumeiDmV2=relevant?{method:String(method||'GET').toUpperCase(),url:abs(url),body:null,headers:{},owner:apiEndpoint(url)?account():null}:null;return open.call(this,method,url,...rest)};
 proto.send=function(body){try{if(!this.__mumeiDmV2)return send.call(this,body);this.__mumeiDmV2.body=body??null;this.addEventListener('load',()=>{const m=this.__mumeiDmV2||{};let txt='';try{txt=typeof this.responseText==='string'?this.responseText:''}catch{}if(!txt||txt.length>5000000)return;let json;try{json=JSON.parse(txt)}catch{return}if(!responseHint(m.url,m.body,json))return;const fake={text:async()=>txt};void inspect(m,fake,'xhr')},{once:true})}catch{}return send.call(this,body)};
 try{Object.defineProperty(proto,'__mumeiDmNetworkV2',{value:true})}catch{}
}
installFetch();installXHR();
const retry=()=>{if(!/^\/messages\/rooms(?:\/|$)/i.test(location.pathname))return;saving=saving.then(()=>persist([])).catch(()=>{})};window.addEventListener('pageshow',retry);window.addEventListener('focus',retry);setTimeout(retry,1200);
window.__mumeiDmNetworkV2={version:VERSION,extract,snapshot,fromDocument,readRoom,readHistory,flightRows,observeWindow:p=>{installFetch(p);installXHR(p)},getCounts:()=>({captured,saved}),getRoomCount:k=>roomCounts.get(String(k||''))||{captured:0,saved:0}};
})();
