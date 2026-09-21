(function(){
'use strict';
if(location.hostname!=='note.com'||!/^\/messages\/rooms(?:\/|$)/i.test(location.pathname))return;
if(window.__mumeiDmNetworkV2Loaded)return;window.__mumeiDmNetworkV2Loaded=true;
const VERSION='1.2.1';
const INGEST='https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-dm-ingest';
const TOKEN='mumei_insight_dm_sync_token_v1:',CHECK='mumei_insight_dm_checkpoint_v1:';
const modern=()=>Boolean(globalThis.GM),key=(p,id)=>p+String(id||'').toLowerCase();
const clean=v=>String(v??'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
const pageWindow=()=>{try{return typeof unsafeWindow!=='undefined'?unsafeWindow:window}catch{return window}};
async function get(k,d){try{if(modern()&&typeof GM.getValue==='function')return await GM.getValue(k,d);if(typeof GM_getValue==='function')return GM_getValue(k,d)}catch{}return d}
async function set(k,v){try{if(modern()&&typeof GM.setValue==='function')return await GM.setValue(k,v);if(typeof GM_setValue==='function')return GM_setValue(k,v)}catch{}}
function request(body,token){return new Promise((resolve,reject)=>{const fn=modern()&&typeof GM.xmlHttpRequest==='function'?GM.xmlHttpRequest:typeof GM_xmlhttpRequest==='function'?GM_xmlhttpRequest:null;if(!fn)return reject(new Error('DM_REQUEST_UNAVAILABLE'));fn({method:'POST',url:INGEST,headers:{'Content-Type':'application/json','X-Ingest-Token':token},data:JSON.stringify(body),timeout:45000,onload:r=>{let p={};try{p=JSON.parse(r.responseText||'{}')}catch{};r.status>=200&&r.status<300&&p?.ok!==false?resolve(p):reject(new Error(p?.error||('HTTP_'+r.status)))},onerror:()=>reject(new Error('DM_NETWORK_ERROR')),ontimeout:()=>reject(new Error('DM_TIMEOUT'))})})}
async function account(){try{const r=await fetch('/api/v2/current_user',{credentials:'include',cache:'no-store'});if(!r.ok)return null;const j=await r.json(),u=(j.data??j).user||(j.data??j),id=String(u?.urlname||u?.url_name||u?.username||'').replace(/^@/,'').toLowerCase();return/^[a-z0-9_-]+$/.test(id)?{id}:null}catch{return null}}
const ROOM_ID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function roomFromUrl(v){try{const u=new URL(String(v||''),location.href),m=u.pathname.match(/^\/messages\/rooms\/([^/?#]+)/i),id=m?.[1]||'';return ROOM_ID_RE.test(id)?id:''}catch{return''}}
function abs(v){try{return new URL(String(v||''),location.href).href}catch{return''}}
function hash(v){let a=2166136261,b=2246822519;for(let i=0;i<v.length;i++){const x=v.charCodeAt(i);a=Math.imul(a^x,16777619);b=Math.imul(b^x,3266489917)}return(a>>>0).toString(16).padStart(8,'0')+(b>>>0).toString(16).padStart(8,'0')}
const BODY=['body','message','text','content','message_body','messageBody','plain_text','plainText'];
const TIME=['sent_at','sentAt','created_at','createdAt','posted_at','postedAt','timestamp','datetime'];
const IDS=['message_id','messageId','id','uuid'];
const ROOMS=['room_id','roomId','thread_id','threadId','conversation_id','conversationId'];
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
function bodyText(obj){for(const k of BODY){const v=obj?.[k];if(typeof v==='string'){const s=clean(v);if(s&&s.length<=12000)return s}}return''}
function roomKey(obj,inherited=''){const raw=first(obj,ROOMS)||inherited||roomFromUrl(location.href);return ROOM_ID_RE.test(String(raw||''))?String(raw):''}
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
 const out=[],seen=new Set(),currentRoom=roomFromUrl(location.href);
 function walk(v,path='',depth=0,inheritedRoom=currentRoom){
  if(depth>10||v==null)return;
  if(Array.isArray(v)){for(const x of v.slice(0,3000))walk(x,path+'[]',depth+1,inheritedRoom);return}
  if(typeof v!=='object')return;
  const room=roomKey(v,inheritedRoom),body=bodyText(v),id=first(v,IDS),s=sender(v),at=time(v),att=attachment(v);
  const keys=Object.keys(v).join(' ').toLowerCase();
  const pathHint=/message|messages|chat|conversation|room/.test((path+' '+keys).toLowerCase());
  if(room&&(body||att.url)&&pathHint&&(id||at||s.name||s.id)){
   const direction=s.id?((s.id||'').toLowerCase()===me?'outbound':'inbound'):'unknown';
   const messageKey=id?('api:'+room+':'+id):('api-sig:'+hash([room,at||'',direction,body,att.url||''].join('|')));
   if(!seen.has(messageKey)){seen.add(messageKey);out.push({thread_key:room,message_key:messageKey,direction,sender_name:s.name||null,sender_url:s.url||null,sender_image_url:s.image||null,body:body||null,sent_at:at,raw_text:body||null,attachment_name:att.name,attachment_url:att.url,attachment_type:att.type,meta:{source:'note-dm-network-v2',userscript:VERSION,request_url:requestUrl,is_read:v.is_read??v.isRead??v.read??v.seen??null,network_path:path}})}
  }
  const nextRoom=room||inheritedRoom;for(const[k,x]of Object.entries(v))if(x&&typeof x==='object')walk(x,path?path+'.'+k:k,depth+1,nextRoom)
 }
 walk(json);return out
}
let saving=Promise.resolve(),captured=0,saved=0;const roomCounts=new Map();
function addRoom(rows,field){for(const r of rows){const k=String(r.thread_key||'');if(!k)continue;const v=roomCounts.get(k)||{captured:0,saved:0};v[field]=Number(v[field]||0)+1;roomCounts.set(k,v)}}
async function persist(rows){
 if(!rows.length)return;
 const a=await account();if(!a)return;const token=String(await get(key(TOKEN,a.id),'')||'');if(!token)return;
 captured+=rows.length;addRoom(rows,'captured');
 for(let i=0;i<rows.length;i+=100){
  const part=rows.slice(i,i+100),p=await request({noteId:a.id,threads:[],messages:part},token);
  const confirmed=Number(p?.messageCount||0);saved+=confirmed;if(confirmed)addRoom(part.slice(0,confirmed),'saved');
  const prev=await get(key(CHECK,a.id),{}),now=Date.now();await set(key(CHECK,a.id),{...prev,lastRunAt:now,lastRunMode:'network',lastRunComplete:false,lastReadCount:captured,lastSavedCount:saved,lastError:'',version:VERSION})
 }
}
async function inspect(meta,res,transport){
 if(!res||!/^\/messages\/rooms(?:\/|$)/i.test(location.pathname))return;
 let txt='';try{txt=await res.text()}catch{return}if(!txt||txt.length>5000000)return;
 let json;try{json=JSON.parse(txt)}catch{return}if(!responseHint(meta.url,meta.body,json))return;
 const a=await account();if(!a)return;const rows=extract(json,meta.url,a.id);if(!rows.length)return;
 saving=saving.then(()=>persist(rows)).catch(async e=>{const x=await account();if(x){const prev=await get(key(CHECK,x.id),{});await set(key(CHECK,x.id),{...prev,lastRunAt:Date.now(),lastRunComplete:false,lastRunMode:'network',lastError:String(e?.message||e),version:VERSION})}});
 await saving
}
function reqMeta(input,init){let url='',body=null,method='GET';try{if(typeof input==='string'||input instanceof URL){url=String(input);body=init?.body??null;method=String(init?.method||'GET').toUpperCase()}else if(input){url=String(input.url||'');body=init?.body??null;method=String(init?.method||input.method||'GET').toUpperCase()}}catch{}return{url:abs(url),body,method}}
function installFetch(){
 const p=pageWindow();if(!p?.fetch||p.fetch.__mumeiDmNetworkV2)return;const original=p.fetch.bind(p);
 const wrapped=function(input,init){const meta=reqMeta(input,init),promise=original(input,init);try{Promise.resolve(promise).then(r=>void inspect(meta,r.clone(),'fetch')).catch(()=>{})}catch{}return promise};
 try{Object.defineProperty(wrapped,'__mumeiDmNetworkV2',{value:true});p.fetch=wrapped}catch{}
}
function installXHR(){
 const p=pageWindow(),X=p?.XMLHttpRequest;if(!X?.prototype||X.prototype.__mumeiDmNetworkV2)return;const proto=X.prototype,open=proto.open,send=proto.send;
 proto.open=function(method,url,...rest){this.__mumeiDmV2={method:String(method||'GET').toUpperCase(),url:abs(url),body:null};return open.call(this,method,url,...rest)};
 proto.send=function(body){try{if(this.__mumeiDmV2)this.__mumeiDmV2.body=body??null;this.addEventListener('load',()=>{const m=this.__mumeiDmV2||{};let txt='';try{txt=typeof this.responseText==='string'?this.responseText:''}catch{}if(!txt||txt.length>5000000)return;let json;try{json=JSON.parse(txt)}catch{return}if(!responseHint(m.url,m.body,json))return;const fake={text:async()=>txt};void inspect(m,fake,'xhr')},{once:true})}catch{}return send.call(this,body)};
 try{Object.defineProperty(proto,'__mumeiDmNetworkV2',{value:true})}catch{}
}
installFetch();installXHR();
window.__mumeiDmNetworkV2={version:VERSION,extract,getCounts:()=>({captured,saved}),getRoomCount:k=>roomCounts.get(String(k||''))||{captured:0,saved:0}};
})();