(function(){
'use strict';
if(location.hostname!=='note.com')return;
if(window.__mumeiNotificationNetwork3300)return;
window.__mumeiNotificationNetwork3300=true;

const VERSION='3.5.6';
const MAX_NOTICES=300,MAX_PAGES=3;
const INGEST='https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-notification-ingest-v2';
const PROBE='https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-notification-network-probe';
const TOKEN='mumei_insight_notification_sync_token_v2:';
const STATUS='mumei_notification_network_status_v3300:',CHECK='mumei_insight_notification_checkpoint_v2922:';
const OUTBOX='mumei_notification_network_outbox_v331:';
const HISTORY='mumei_notification_network_history_v334:';
const SOURCE='note-notification-explicit-sync-v330';
const ACTION_RE=/(?:スキ|フォロー|コメント|返信|購入|高評価|チップ|サポート|メンバーシップ|メンシプ|マガジン|記事を投稿|記事を更新|話題|ポイント|引用|追加しました|参加しました|加入しました)/u;
const URL_HINT_RE=/(?:notice|notification|navbar|activity|activities)/i;
const KEY_HINT_RE=/(?:notice|notification|activity|event)/i;
const TEXT_KEYS=['message','text','body','title','label','description','content','display_text','displayText','notice_text','noticeText','notification_text','notificationText','summary'];
const TIME_KEYS=['noticed_at','noticedAt','created_at','createdAt','occurred_at','occurredAt','published_at','publishedAt','updated_at','updatedAt','timestamp','datetime','date'];
const ID_KEYS=['notification_id','notificationId','notice_id','noticeId','id','key','uuid'];
const URL_KEYS=['target_url','targetUrl','url','href','link','path','permalink'];
const modern=()=>Boolean(globalThis.GM),key=(p,id)=>p+String(id||'').toLowerCase();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const clean=v=>String(v??'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();

async function get(k,d){try{if(modern()&&typeof GM.getValue==='function')return await GM.getValue(k,d);if(typeof GM_getValue==='function')return GM_getValue(k,d)}catch{}return d}
async function set(k,v){try{if(modern()&&typeof GM.setValue==='function')return await GM.setValue(k,v);if(typeof GM_setValue==='function')return GM_setValue(k,v)}catch{}}
function request(url,body,token){return new Promise((resolve,reject)=>{const fn=modern()&&typeof GM.xmlHttpRequest==='function'?GM.xmlHttpRequest:typeof GM_xmlhttpRequest==='function'?GM_xmlhttpRequest:null;if(!fn)return reject(new Error('USERSCRIPT_REQUEST_UNAVAILABLE'));fn({method:'POST',url,headers:{'Content-Type':'application/json','X-Ingest-Token':token},data:JSON.stringify(body),timeout:45000,onload:r=>{let p={};try{p=JSON.parse(r.responseText||'{}')}catch{};r.status>=200&&r.status<300&&p?.ok!==false?resolve(p):reject(new Error(p?.error||`HTTP_${r.status}`))},onerror:()=>reject(new Error('NETWORK_ERROR')),ontimeout:()=>reject(new Error('TIMEOUT'))})})}
async function account(){try{const r=await fetch('/api/v2/current_user',{credentials:'include',cache:'no-store'});if(!r.ok)return null;const j=await r.json(),u=(j.data??j).user||(j.data??j),id=String(u?.urlname||u?.url_name||u?.username||'').replace(/^@/,'').toLowerCase();return/^[a-z0-9_-]+$/.test(id)?{id}:null}catch{return null}}
function status(message,kind='info',extra={}){
 const detail={message:String(message||''),kind,label:kind==='done'?'✓通信保存':kind==='error'?'通信再試行':'通信読込',state:kind==='done'?'done':kind==='error'?'error':kind==='saving'?'saving':'info',scanning:kind==='saving',network:true,version:VERSION,...extra};
 document.dispatchEvent(new CustomEvent('mumei-v3-reader-status',{detail}));
 try{window.dispatchEvent(new CustomEvent('mumei-notification-reader-status',{detail}))}catch{}
}
function pageWindow(){try{return typeof unsafeWindow!=='undefined'?unsafeWindow:window}catch{return window}}
function absUrl(v){try{return new URL(String(v||''),location.href).href}catch{return''}}
function sameNoteOrGraphql(v){try{const u=new URL(v,location.href);return u.hostname==='note.com'||u.hostname==='graphql.note.com'}catch{return false}}
function compact(v,depth=0){if(depth>5)return'[depth]';if(v===null||typeof v==='number'||typeof v==='boolean')return v;if(typeof v==='string')return v.slice(0,1000);if(Array.isArray(v))return v.slice(0,25).map(x=>compact(x,depth+1));if(v&&typeof v==='object'){const o={};let n=0;for(const[k,x]of Object.entries(v)){if(n++>=50)break;o[String(k).slice(0,100)]=compact(x,depth+1)}return o}return String(v??'').slice(0,500)}
function shape(v,depth=0){if(depth>5)return typeof v;if(Array.isArray(v))return{type:'array',length:v.length,item:v.length?shape(v[0],depth+1):null};if(v&&typeof v==='object'){const o={};let n=0;for(const[k,x]of Object.entries(v)){if(n++>=50)break;o[k]=shape(x,depth+1)}return o}return typeof v}
function str(v){return typeof v==='string'?clean(v):''}
function firstString(obj,keys){for(const k of keys){const v=obj?.[k];if(typeof v==='string'&&clean(v))return clean(v)}return''}
function findNested(obj,names){if(!obj||typeof obj!=='object')return null;for(const k of names){const v=obj[k];if(v&&typeof v==='object'&&!Array.isArray(v))return v}return null}
function actorInfo(obj){
 const actionUsers=Array.isArray(obj?.action_users)?obj.action_users:Array.isArray(obj?.actionUsers)?obj.actionUsers:[];
 const primary=actionUsers.find(x=>x&&typeof x==='object')||null;
 const a=primary||findNested(obj,['actor','user','creator','from_user','fromUser','sender','member','owner']);
 const name=firstString(a||{},['name','display_name','displayName','nickname','urlname','username'])||firstString(obj,['actor_name','actorName','user_name','userName','creator_name','creatorName']);
 const urlname=firstString(a||{},['urlname','username','screen_name'])||firstString(obj,['actor_urlname','actorUrlname']);
 const url=firstString(a||{},['url','profile_url','profileUrl','href','link']);
 const image=firstString(a||{},['user_profile_image_path','userProfileImagePath','profile_image_url','profileImageUrl','image_url','imageUrl','avatar_url','avatarUrl','icon_url','iconUrl']);
 return{name,urlname,url,image}
}
function targetInfo(obj){
 const t=findNested(obj,['target','note','article','magazine','membership','resource','object']);
 let url=firstString(obj,['all_area_url','allAreaUrl','featured_area_url','featuredAreaUrl',...URL_KEYS])||firstString(t||{},URL_KEYS);
 if(url&&url.startsWith('/'))url='https://note.com'+url;
 const title=firstString(obj,['target_title','targetTitle','note_name','noteName','featured_content_name','featuredContentName'])||firstString(t||{},['name','title','label']);
 return{url,title}
}
function occurred(obj){for(const k of TIME_KEYS){const v=obj?.[k];if(typeof v==='string'&&!Number.isNaN(Date.parse(v)))return new Date(v).toISOString();if(typeof v==='number'&&v>1e9){const ms=v<1e12?v*1000:v;return new Date(ms).toISOString()}}return null}
function eventId(obj){for(const k of ID_KEYS){const v=obj?.[k];if(typeof v==='string'||typeof v==='number')return String(v)}return''}
function astText(v,depth=0){if(depth>8||v==null)return'';if(typeof v==='string')return clean(v);if(Array.isArray(v))return clean(v.slice(0,120).map(x=>astText(x,depth+1)).join(' '));if(typeof v!=='object')return'';if(typeof v.value==='string')return clean(v.value);if(typeof v.text==='string')return clean(v.text);return astText(v.children||v.content||v.body||[],depth+1)}
function bestText(obj){
 for(const k of TEXT_KEYS){const v=obj?.[k];if(typeof v==='string'){const s=clean(v);if(s&&(ACTION_RE.test(s)||obj?.kind||obj?.notification_id||obj?.notice_id))return s}}
 const ast=astText(obj?.body_ast??obj?.bodyAst);if(ast)return ast;
 const strings=[];
 for(const [k,v] of Object.entries(obj||{})){if(typeof v==='string'){const s=clean(v);if(s.length>=5&&s.length<=1200)strings.push([k,s])}}
 const hit=strings.find(([,s])=>ACTION_RE.test(s));if(hit)return hit[1];
 return''
}
function qualifies(obj,path){
 if(!obj||typeof obj!=='object'||Array.isArray(obj))return false;
 const text=bestText(obj);if(!text)return false;
 const keys=Object.keys(obj).join(' ');
 const hint=KEY_HINT_RE.test(keys)||KEY_HINT_RE.test(path)||Boolean(obj?.kind);
 const hasMeta=Boolean(eventId(obj)||occurred(obj)||findNested(obj,['actor','user','creator','sender'])||Array.isArray(obj?.action_users)||Array.isArray(obj?.actionUsers));
 return hint||hasMeta
}
function extract(json,requestUrl){
 const out=[],seen=new Set();
 function walk(v,path='',depth=0){
  if(depth>10||v==null)return;
  if(Array.isArray(v)){for(let i=0;i<Math.min(v.length,1500);i++)walk(v[i],path+'[]',depth+1);return}
  if(typeof v!=='object')return;
  if(qualifies(v,path)){
   const raw=bestText(v),actor=actorInfo(v),target=targetInfo(v),id=eventId(v),at=occurred(v);
   const actorUrl=actor.url?absUrl(actor.url):actor.urlname?`https://note.com/${actor.urlname.replace(/^@/,'')}`:null;
   const ev=id?'notice:'+id:at?'time:'+at:'network:'+clean(raw).slice(0,160);
   const sig=['network-v330',id||ev,at||'',raw,target.url||'',actorUrl||actor.name||''].join('|');
   if(!seen.has(sig)){seen.add(sig);out.push({
    raw_text:raw,actor_name:actor.name||null,actor_url:actorUrl,actor_image_url:actor.image||null,
    target_title:target.title||null,target_url:target.url||null,source_url:target.url||requestUrl||'https://note.com/',
    occurred_at:at,meta:{source:SOURCE,capture_source:'note-network-v3300',userscript:VERSION,protocol:VERSION,scan_mode:'network-response',scan_strategy:'direct-api-v350',event_identity:ev,client_signature:sig,request_url:requestUrl,
      kind:str(v.kind)||null,body:str(v.body)||null,body_ast:compact(v.body_ast??v.bodyAst??null),all_area_url:str(v.all_area_url??v.allAreaUrl)||null,featured_area_url:str(v.featured_area_url??v.featuredAreaUrl)||null,featured_content_name:str(v.featured_content_name??v.featuredContentName)||null,action_users:compact(Array.isArray(v.action_users)?v.action_users:Array.isArray(v.actionUsers)?v.actionUsers:[])
    }
   })}
  }
  for(const[k,x]of Object.entries(v))walk(x,path?path+'.'+k:k,depth+1)
 }
 walk(json);
 return out.slice(0,1000)
}
function operationName(body){try{const j=typeof body==='string'?JSON.parse(body):body;return clean(j?.operationName||j?.operation_name||'')}catch{return''}}
function candidateHint(url,body,json){
 const op=operationName(body),u=String(url||'');
 if(URL_HINT_RE.test(u)||URL_HINT_RE.test(op))return true;
 try{
  const s=JSON.stringify(compact(json));
  if(ACTION_RE.test(s)&&/(?:notice|notification|activity|通知|お知らせ)/iu.test(s))return true;
  const host=new URL(u,location.href).hostname;
  return host==='graphql.note.com'&&ACTION_RE.test(s)&&/(?:createdAt|created_at|actor|user|edges|nodes)/i.test(s)
 }catch{return false}
}
function nextHint(json){
 let found=null;
 function walk(v,depth=0){if(found||depth>8||!v)return;if(Array.isArray(v)){for(const x of v.slice(0,30))walk(x,depth+1);return}if(typeof v!=='object')return;
  const hasNext=v.hasNextPage??v.has_next_page??v.has_next;
  const cursor=v.endCursor??v.end_cursor??v.nextCursor??v.next_cursor??null;
  const next=v.next_page??v.nextPage??v.next??v.next_url??v.nextUrl??null;
  const last=v.is_last_page??v.isLastPage??null;
  if((hasNext===true&&cursor)||(next!==null&&next!==false)||(last===false&&cursor)){found={hasNext,cursor,next,last};return}
  for(const x of Object.values(v))walk(x,depth+1)
 }
 walk(json);return found
}
function terminalHint(json){
 let end=false;
 function walk(v,depth=0){if(end||depth>8||!v)return;if(Array.isArray(v)){for(const x of v.slice(0,30))walk(x,depth+1);return}if(typeof v!=='object')return;
  const hasNext=v.hasNextPage??v.has_next_page??v.has_next;
  const last=v.is_last_page??v.isLastPage;
  const ownsNext=Object.prototype.hasOwnProperty.call(v,'next_page')||Object.prototype.hasOwnProperty.call(v,'nextPage')||Object.prototype.hasOwnProperty.call(v,'next')||Object.prototype.hasOwnProperty.call(v,'next_url')||Object.prototype.hasOwnProperty.call(v,'nextUrl');
  const next=v.next_page??v.nextPage??v.next??v.next_url??v.nextUrl??null;
  if(hasNext===false||last===true||(ownsNext&&(next===null||next===false||next===''))){end=true;return}
  for(const x of Object.values(v))walk(x,depth+1)
 }
 walk(json);return end
}
function requestMeta(input,init){
 let url='',method='GET',body=null,headers={};
 try{
  if(typeof input==='string'||input instanceof URL){url=String(input);method=String(init?.method||'GET').toUpperCase();body=init?.body??null;headers=init?.headers||{}}
  else if(input){url=String(input.url||'');method=String(init?.method||input.method||'GET').toUpperCase();body=init?.body??null;try{for(const[k,v]of input.headers?.entries?.()||[])headers[k]=v}catch{}}
 }catch{}
 return{url:absUrl(url),method,body,headers}
}
function xBodySample(body){if(body==null)return null;if(typeof body==='string'){try{return compact(JSON.parse(body))}catch{return body.slice(0,5000)}}return typeof body==='object'?compact(body):String(body).slice(0,5000)}
let armedUntil=0,lastCapture=null,lastResult=null,inflight=0,stopRequested=false;
function runtime(){return window.__mumeiV3Runtime328||window.__mumeiV3Runtime327||window.__mumeiV3Runtime325||null}
function captureActive(){return Date.now()<armedUntil||Boolean(runtime()?.isSessionActive?.())}
function arm(ms=20000){armedUntil=Math.max(armedUntil,Date.now()+ms)}
function looksBell(target,e){
 try{if(runtime()?.bellTrigger?.(target,e))return true}catch{}
 const el=target instanceof Element?target.closest('button,a,[role="button"],[aria-label],[data-testid]'):null;
 const s=clean([el?.textContent,el?.getAttribute?.('aria-label'),el?.getAttribute?.('title'),el?.getAttribute?.('href'),el?.getAttribute?.('data-testid')].join(' '));
 return/(?:通知|お知らせ|notification|notice|bell)/iu.test(s)&&!/設定|filter/i.test(s)
}
document.addEventListener('pointerdown',e=>{if(looksBell(e.target,e))arm()},true);
document.addEventListener('click',e=>{if(looksBell(e.target,e))arm()},true);

async function tokenFor(id){return String(await get(key(TOKEN,id),'')||'')}
async function saveProbe(cap,candidates){
 const a=await account();if(!a)return;
 const token=await tokenFor(a.id);if(!token)return;
 const record={page_url:location.href,request_url:cap.url,request_method:cap.method,transport:cap.transport,status:cap.status,content_type:cap.contentType,operation_name:operationName(cap.body),request_sample:xBodySample(cap.body),response_shape:shape(cap.json),response_sample:compact(cap.json),candidate_count:candidates.length};
 try{await request(PROBE,{noteId:a.id,records:[record]},token)}catch{}
}
function clientSig(r){
 const known=clean(r?.meta?.client_signature||'');if(known)return known;
 return ['network-v331',clean(r?.meta?.event_identity||''),clean(r?.occurred_at||''),clean(r?.raw_text||''),clean(r?.target_url||''),clean(r?.actor_url||r?.actor_name||'')].join('|')
}
async function readOutbox(id){const v=await get(key(OUTBOX,id),[]);return Array.isArray(v)?v:[]}
async function writeOutbox(id,rows){await set(key(OUTBOX,id),Array.isArray(rows)?rows:[])}
function mergePending(existing,rows,cap,manual){
 const m=new Map();
 for(const r of [...(Array.isArray(existing)?existing:[]),...(Array.isArray(rows)?rows:[])]){
  if(!r)continue;const s=clientSig(r);if(!s)continue;
  m.set(s,{...r,meta:{...(r.meta||{}),client_signature:s,manual:Boolean(manual||r?.meta?.manual),network_endpoint:r?.meta?.network_endpoint||cap?.url||null}})
 }
 return m
}
async function pendingCount(id){return (await readOutbox(id)).length}
async function historyState(id){const v=await get(key(HISTORY,id),{});return v&&typeof v==='object'?v:{}}
async function writeHistoryState(id,v){await set(key(HISTORY,id),v&&typeof v==='object'?v:{})}
async function writeUnifiedStatus(id,patch){
 const cp=await get(key(CHECK,id),{});
 await set(key(CHECK,id),{...cp,...patch,version:VERSION});
}
async function ingestRows(rows,cap,manual=false,emitStatus=true){
 const a=await account();if(!a)throw new Error('noteログインを確認してください');
 const token=await tokenFor(a.id);if(!token)throw new Error('本人連携が必要です');
 const pending=mergePending(await readOutbox(a.id),rows,cap,manual);
 if(!pending.size)return{handled:true,saved:0,received:Array.isArray(rows)?rows.length:0,pending:0};
 await writeOutbox(a.id,[...pending.values()]);
 const received=Array.isArray(rows)?rows.length:0;let saved=0,lastResponse=null;
 try{
  while(pending.size){
   const current=await account();if(current?.id!==a.id)throw new Error('NOTE_ACCOUNT_CHANGED');
   const part=[...pending.values()].slice(0,50);
   const res=await request(INGEST,{noteId:a.id,notifications:part},token);lastResponse=res;
   const sent=new Set(part.map(clientSig)),confirmed=new Set((Array.isArray(res?.confirmedClientSignatures)?res.confirmedClientSignatures:[]).map(String).filter(s=>sent.has(s)));
   for(const s of confirmed){pending.delete(s);saved++}
   await writeOutbox(a.id,[...pending.values()]);
   if(confirmed.size){const now=Date.now();await writeUnifiedStatus(a.id,{lastSaveAt:now,lastCheckAt:now,lastRunAt:now,lastRunComplete:false,lastRunMode:'partial',lastRunReadCount:received,lastRunSavedCount:saved,lastError:''});try{document.dispatchEvent(new Event('mumei-notification-checkpoint'))}catch{}}
   if(confirmed.size!==part.length)break
  }
 }catch(e){
  await writeOutbox(a.id,[...pending.values()]);
  lastResult={at:Date.now(),saved,received,pending:pending.size,url:cap?.url||'',mode:'network',error:String(e?.message||e)};
  await set(key(STATUS,a.id),lastResult);
  if(emitStatus)status(`⚠ 通信保存未完了｜${pending.size}件を次回再送`,'error',{readCount:received,savedCount:saved,pendingCount:pending.size,mode:'network'});
  throw e
 }
 lastResult={at:Date.now(),saved,received,pending:pending.size,url:cap?.url||'',mode:'network'};
 await set(key(STATUS,a.id),lastResult);
 if(pending.size){
  if(emitStatus)status(`⚠ ${received}件確認・${saved}件保存確認・${pending.size}件未保存（次回再送）`,'error',{readCount:received,savedCount:saved,pendingCount:pending.size,mode:'network'});
  throw new Error(`通信読込の${pending.size}件が未保存です。未保存分は保持して再試行します`)
 }
 if(emitStatus)status(`✓ 通信から${received}件確認・${saved}件保存確認`,'done',{readCount:received,savedCount:saved,pendingCount:0,mode:'network'});
 return{handled:true,saved,received,pending:0,response:lastResponse}
}
async function processCapture(cap,{manual=false,probe=true}={}){
 if(!cap?.json)return{handled:false,saved:0};
 const rows=extract(cap.json,cap.url);
 if(probe)void saveProbe(cap,rows);
 if(!rows.length)return{handled:false,saved:0,candidate:true};
 lastCapture={...cap,rows,at:Date.now()};
 if(manual)return ingestRows(rows,cap,true);
 return{handled:true,saved:0,received:rows.length,deferred:true}
}
async function inspectResponse(meta,res,transport){
 if(!captureActive()||!res)return;
 const url=meta.url;if(!sameNoteOrGraphql(url)||url.includes('xxhaerjvrgmnadxjqetz.supabase.co'))return;
 let ct='';try{ct=String(res.headers?.get?.('content-type')||'')}catch{}
 if(ct&&!/json|javascript|graphql|text/i.test(ct)&&!URL_HINT_RE.test(url))return;
 let txt='';try{txt=await res.text()}catch{return}
 if(!txt||txt.length>2500000)return;
 let json;try{json=JSON.parse(txt)}catch{return}
 if(!candidateHint(url,meta.body,json))return;
 const cap={...meta,transport,status:Number(res.status||0),contentType:ct,json,requestInit:meta.requestInit||null};
 void processCapture(cap,{manual:false,probe:true})
}
function installFetch(){
 const p=pageWindow();if(!p?.fetch||p.fetch.__mumeiNetwork3300)return;
 const original=p.fetch.bind(p);
 const wrapped=function(input,init){
  const meta=requestMeta(input,init);meta.requestInit=init||null;
  const promise=original(input,init);
  try{Promise.resolve(promise).then(res=>{if(captureActive())void inspectResponse(meta,res.clone(),'fetch')}).catch(()=>{})}catch{}
  return promise
 };
 try{Object.defineProperty(wrapped,'__mumeiNetwork3300',{value:true});p.fetch=wrapped}catch{}
 window.__mumeiNetworkOriginalFetch3300=original
}
function installXHR(){
 const p=pageWindow(),X=p?.XMLHttpRequest;if(!X?.prototype||X.prototype.__mumeiNetwork3300)return;
 const proto=X.prototype,open=proto.open,send=proto.send;
 proto.open=function(method,url,...rest){try{this.__mumei3300={method:String(method||'GET').toUpperCase(),url:absUrl(url),body:null}}catch{}return open.call(this,method,url,...rest)};
 proto.send=function(body){try{if(this.__mumei3300)this.__mumei3300.body=body??null;this.addEventListener('load',()=>{if(!captureActive())return;const m=this.__mumei3300||{};if(!sameNoteOrGraphql(m.url)||m.url?.includes('xxhaerjvrgmnadxjqetz.supabase.co'))return;let txt='';try{txt=typeof this.responseText==='string'?this.responseText:''}catch{}if(!txt||txt.length>2500000)return;let json;try{json=JSON.parse(txt)}catch{return}if(!candidateHint(m.url,m.body,json))return;const cap={url:m.url,method:m.method||'GET',body:m.body,transport:'xhr',status:Number(this.status||0),contentType:String(this.getResponseHeader?.('content-type')||''),json,requestInit:null};void processCapture(cap,{manual:false,probe:true})},{once:true})}catch{}return send.call(this,body)};
 try{Object.defineProperty(proto,'__mumeiNetwork3300',{value:true})}catch{}
}
async function waitCapture(ms=2500){
 const start=Date.now(),existing=lastCapture;if(existing&&Date.now()-existing.at<60000)return existing;
 while(Date.now()-start<ms){if(lastCapture&&lastCapture!==existing)return lastCapture;await sleep(100)}
 return lastCapture&&Date.now()-lastCapture.at<120000?lastCapture:null
}
function mutateNextRequest(cap,hint){
 if(!cap||!hint)return null;
 let url=new URL(cap.url,location.href),method=cap.method||'GET',body=cap.body,init={...(cap.requestInit||{})};
 const next=hint.next;
 if(typeof next==='string'&&next){
  if(/^https?:\/\//i.test(next)||next.startsWith('/'))url=new URL(next,location.href);
  else if(/^\d+$/.test(next))url.searchParams.set('page',next)
 }else if(typeof next==='number')url.searchParams.set('page',String(next));
 const cursor=hint.cursor;
 if(cursor){
  if(method==='GET'){
   if(url.searchParams.has('after'))url.searchParams.set('after',String(cursor));
   else if(url.searchParams.has('cursor'))url.searchParams.set('cursor',String(cursor));
   else url.searchParams.set('after',String(cursor))
  }else{
   try{
    const j=typeof body==='string'?JSON.parse(body):structuredClone(body||{});
    j.variables=j.variables||{};
    if('after' in j.variables||!('cursor' in j.variables))j.variables.after=cursor;
    else j.variables.cursor=cursor;
    body=JSON.stringify(j);init.body=body
   }catch{return null}
  }
 }
 if(method==='GET')delete init.body;
 init.method=method;init.credentials=init.credentials||'include';init.cache='no-store';
 return{url:url.href,method,body,requestInit:init}
}
async function replay(cap){
 const original=window.__mumeiNetworkOriginalFetch3300||pageWindow().fetch.bind(pageWindow());
 const init={...(cap.requestInit||{}),method:cap.method||'GET',credentials:cap.requestInit?.credentials||'include',cache:'no-store'};
 if(cap.body!=null&&init.method!=='GET'&&init.method!=='HEAD')init.body=cap.body;
 const res=await original(cap.url,init);
 if(!res.ok)throw new Error('HTTP_'+res.status);
 const txt=await res.text();
 let json;try{json=JSON.parse(txt)}catch{throw new Error('通知履歴APIの応答をJSONとして読めませんでした')}
 return{...cap,status:res.status,contentType:String(res.headers.get('content-type')||''),json,at:Date.now()}
}
function totalHint(json){
 let best=0;
 function walk(v,depth=0){if(depth>6||v==null)return;if(Array.isArray(v)){for(const x of v.slice(0,20))walk(x,depth+1);return}if(typeof v!=='object')return;
  for(const k of ['total_count','totalCount','total','count']){const n=Number(v?.[k]);if(Number.isFinite(n)&&n>best&&n<1000000)best=n}
  for(const x of Object.values(v))if(x&&typeof x==='object')walk(x,depth+1)
 }
 walk(json);return best
}
async function directNoticeCapture(){
 const original=window.__mumeiNetworkOriginalFetch3300||pageWindow().fetch.bind(pageWindow());
 const u=new URL('/api/v3/notices',location.origin);u.searchParams.set('page','1');u.searchParams.set('per','100');u.searchParams.set('body_ast','1');
 const init={method:'GET',credentials:'include',cache:'no-store',headers:{'Accept':'application/json'}};
 const res=await original(u.href,init);if(!res.ok)throw new Error('NOTICE_API_HTTP_'+res.status);
 const json=await res.json();if(!candidateHint(u.href,null,json)&&!Array.isArray(json?.data))throw new Error('NOTICE_API_UNEXPECTED');
 const cap={url:u.href,method:'GET',body:null,transport:'direct',status:res.status,contentType:String(res.headers.get('content-type')||''),json,requestInit:init,at:Date.now()};
 cap.rows=extract(json,u.href);lastCapture=cap;return cap
}
async function widenNoticeCapture(cap){
 try{
  const u=new URL(cap?.url||'',location.href);
  if((cap?.method||'GET')==='GET'&&u.hostname==='note.com'&&/\/api\/v3\/notices$/i.test(u.pathname)){
   u.searchParams.set('page','1');u.searchParams.set('per','100');u.searchParams.set('body_ast','1');
   const widened=await replay({...cap,url:u.href,method:'GET',body:null,rows:null,requestInit:{...(cap?.requestInit||{}),method:'GET',credentials:'include',cache:'no-store'}});
   widened.url=u.href;return widened
  }
 }catch{}
 return cap
}

function directNoticesCap(cap){try{const u=new URL(cap?.url||'',location.href);return (cap?.method||'GET')==='GET'&&u.hostname==='note.com'&&/\/api\/v3\/notices$/i.test(u.pathname)}catch{return false}}
function directPageRequest(cap,page){
 try{
  const u=new URL(cap?.url||'',location.href);u.searchParams.set('page',String(Math.max(1,Number(page)||1)));u.searchParams.set('per',u.searchParams.get('per')||'100');u.searchParams.set('body_ast','1');
  return{...cap,url:u.href,method:'GET',body:null,rows:null,transport:'direct',requestInit:{...(cap?.requestInit||{}),method:'GET',credentials:'include',cache:'no-store'}}
 }catch{return null}
}
async function syncDirectFullAscending(a,state,cap,resume){
 if(!directNoticesCap(cap))return null;
 const firstRows=cap.rows||extract(cap.json,cap.url),apiTotal=totalHint(cap.json),u=new URL(cap.url,location.href),per=Math.max(1,Number(u.searchParams.get('per')||100));
 if(!apiTotal&&!terminalHint(cap.json))return null;
 const totalCount=Math.min(MAX_NOTICES,Math.max(apiTotal,Number(state?.partialTotalCount||0),firstRows.length)),lastPage=Math.max(1,Math.min(MAX_PAGES,Math.ceil(Math.max(1,totalCount)/per))),resumeRaw=resume?Math.max(1,Number(new URL(resume.url,location.href).searchParams.get('page')||0)):0,resumePage=resumeRaw?Math.min(lastPage,resumeRaw):0;
 let page=resumePage||lastPage,total=resume?Number(state?.partialSaved||0):0,received=resume?Math.min(MAX_NOTICES,Number(state?.partialReceived||0)):0,pages=resume?Number(state?.partialPages||0):0,newestSig=clean(state?.partialNewestSig||'')||(firstRows.length?clientSig(firstRows[0]):'');
 if(!resume&&page!==1){const req=directPageRequest(cap,page);if(!req)return null;cap=await replay(req)}
 status(`通知一覧の下から上へ読込中… 読込 ${received} / ${totalCount||'?'}｜保存 ${total}`,'saving',{mode:'network-full-bottom-up',readCount:received,savedCount:total,totalCount,direction:'bottom-up'});
 while(page>=1){
  const raw=cap.rows||extract(cap.json,cap.url),remaining=Math.max(0,MAX_NOTICES-received),rows=[...raw].reverse().slice(-remaining);
  received+=rows.length;
  if(rows.length){const r=await ingestRows(rows,cap,true,false);total+=Number(r.saved||0)}
  void saveProbe(cap,raw);pages++;
  status(`読込 ${received}${totalCount?` / ${totalCount}`:''}｜保存 ${total}`,'saving',{mode:'network-full-bottom-up',readCount:received,savedCount:total,totalCount,pages,direction:'bottom-up'});
  const nextPage=page-1,nextReq=received<MAX_NOTICES&&nextPage>=1?directPageRequest(cap,nextPage):null;
  await writeHistoryState(a.id,{...state,historyComplete:false,resume:nextReq?{url:nextReq.url,method:'GET',body:null,requestInit:nextReq.requestInit,transport:'direct'}:null,partialReceived:received,partialSaved:total,partialPages:pages,partialNewestSig:newestSig,partialTotalCount:totalCount,version:VERSION,partialAt:Date.now(),direction:'bottom-up'});
  await writeUnifiedStatus(a.id,{lastCheckAt:Date.now(),lastRunAt:Date.now(),lastRunComplete:false,lastRunMode:'partial',lastRunReadCount:received,lastRunSavedCount:total,historyComplete:false,lastError:'',direction:'bottom-up'});
  if(stopRequested){status(`停止・途中保存｜読込 ${received}${totalCount?` / ${totalCount}`:''}｜保存 ${total}`,'done',{mode:'network-partial',readCount:received,savedCount:total,totalCount,pages,historyComplete:false,direction:'bottom-up'});return{handled:true,partial:true,saved:total,received,totalCount,pages,pending:await pendingCount(a.id),historyComplete:false,mode:'network-partial',direction:'bottom-up'}}
  if(!nextReq)break;
  try{cap=await replay(nextReq)}catch(e){await writeUnifiedStatus(a.id,{lastCheckAt:Date.now(),lastRunAt:Date.now(),lastRunComplete:false,lastRunMode:'partial',lastRunReadCount:received,lastRunSavedCount:total,lastError:String(e?.message||e),direction:'bottom-up'});return{handled:false,saved:total,received,pages,pending:await pendingCount(a.id),reason:'NEXT_FETCH_FAILED',needsDom:false,error:String(e?.message||e)}}
  page=nextPage
 }
 const pending=await pendingCount(a.id);if(pending)throw new Error(`${pending}件が未保存のため完了扱いにしません`);
 const done={...state,historyComplete:true,frontierSig:newestSig||state?.frontierSig||'',verifiedAt:Date.now(),fullVerifiedAt:Date.now(),lastPages:pages,lastReceived:received,lastSaved:total,lastMode:'full',version:VERSION,resume:null,partialReceived:0,partialSaved:0,partialPages:0,partialNewestSig:'',partialTotalCount:0,direction:'bottom-up'};
 await writeHistoryState(a.id,done);
 await writeUnifiedStatus(a.id,{lastCheckAt:Date.now(),lastRunAt:Date.now(),lastRunComplete:true,lastRunMode:'full',lastRunReadCount:received,lastRunSavedCount:total,manualSeenCount:received,manualNewCount:total,historyComplete:true,lastError:'',direction:'bottom-up'});
 status(`✓ note取得上限${MAX_NOTICES}件まで確認｜下→上 ${pages}ページ・${received}件確認・${total}件保存`,'done',{mode:'network-window-bottom-up',readCount:received,savedCount:total,totalCount:Math.min(MAX_NOTICES,totalCount||received),pages,pendingCount:0,historyComplete:true,direction:'bottom-up',windowLimit:MAX_NOTICES});
 return{handled:true,saved:total,received,totalCount:Math.min(MAX_NOTICES,totalCount||received),pages,pending:0,historyComplete:true,full:true,mode:'network-window-bottom-up',direction:'bottom-up',windowLimit:MAX_NOTICES}
}
async function syncHistory(opts={}){
 stopRequested=false;
 const forceFull=Boolean(opts.forceFull),waitMs=Number(opts.waitMs||3000);
 arm(Math.max(forceFull?180000:120000,waitMs+5000));
 const a=await account();if(!a)throw new Error('noteログインを確認してください');
 const state=await historyState(a.id);
 const frontier=!forceFull&&state?.historyComplete?clean(state.frontierSig||''):'';
 const resume=!forceFull&&!state?.historyComplete&&state?.version===VERSION&&state?.resume?.url?state.resume:null;
 status(frontier?'保存済み地点まで追加通知をたどっています…':resume?'前回の途中地点から通知履歴を再開します…':'通知履歴を終端まで全件確認しています…','saving',{mode:frontier?'network-delta':resume?'network-resume':'network-full'});
 let cap=null;
 if(resume){try{cap=await replay({...resume,rows:null})}catch{}}
 if(!cap){try{cap=await directNoticeCapture()}catch{}}
 if(!cap)cap=await waitCapture(waitMs);
 if(cap&&cap.transport!=='direct')cap=await widenNoticeCapture(cap);
 if(!cap){
  if(await pendingCount(a.id)){const retry=await ingestRows([],null,true,false);return{handled:true,saved:Number(retry.saved||0),received:0,pages:0,pending:0,historyComplete:Boolean(state?.historyComplete),mode:'retry'}}
  await writeUnifiedStatus(a.id,{lastCheckAt:Date.now(),lastRunAt:Date.now(),lastRunComplete:false,lastRunMode:'partial',lastRunReadCount:0,lastRunSavedCount:0,lastError:'通知通信をまだ捕捉できていません'});return{handled:false,saved:0,reason:'NO_NETWORK_CAPTURE',needsDom:false}
 }
 if(!frontier&&directNoticesCap(cap)){
  const direct=await syncDirectFullAscending(a,state,cap,resume);if(direct)return direct
 }
 let total=resume?Number(state?.partialSaved||0):0,received=resume?Math.min(MAX_NOTICES,Number(state?.partialReceived||0)):0,pages=resume?Number(state?.partialPages||0):0,requestSeen=new Set(),completed=false,reachedFrontier=false,reachedEnd=false,reachedWindowLimit=false,newestSig=clean(state?.partialNewestSig||''),capLimitHit=false,totalCount=Math.min(MAX_NOTICES,Math.max(Number(state?.partialTotalCount||0),totalHint(cap?.json)));
 for(let i=0;i<MAX_PAGES&&cap&&received<MAX_NOTICES;i++){
  const reqSig=[cap.url,cap.method,typeof cap.body==='string'?cap.body:JSON.stringify(cap.body||null)].join('|');
  if(requestSeen.has(reqSig)){
   status('APIページングが同じ位置で停止したため、画面は動かさず、次回の通信読取で続行します…','saving',{mode:'network-fallback'});
   await writeUnifiedStatus(a.id,{lastCheckAt:Date.now(),lastRunAt:Date.now(),lastRunComplete:false,lastRunMode:'partial',lastRunReadCount:received,lastRunSavedCount:total,lastError:'APIページングが同じ位置で停止しました'});return{handled:false,saved:total,received,pages,pending:0,reason:'REPEATED_REQUEST',needsDom:false}
  }
  requestSeen.add(reqSig);
  const pageRows=(cap.rows||extract(cap.json,cap.url)).slice(0,Math.max(0,MAX_NOTICES-received));
  if(!newestSig&&pageRows.length)newestSig=clientSig(pageRows[0]);
  received+=pageRows.length;
  let saveRows=pageRows;
  if(frontier){
   const cut=pageRows.findIndex(r=>clientSig(r)===frontier);
   if(cut>=0){saveRows=pageRows.slice(0,cut);reachedFrontier=true}
  }
  if(saveRows.length){const r=await ingestRows(saveRows,cap,true,false);total+=Number(r.saved||0)}
  void saveProbe(cap,pageRows);pages++;
  totalCount=Math.min(MAX_NOTICES,Math.max(totalCount,totalHint(cap.json),received));status(`読込 ${received}${totalCount?` / ${totalCount}`:''}｜保存 ${total}`,'saving',{mode:frontier?'network-delta':'network-window',readCount:received,savedCount:total,totalCount,pages,windowLimit:MAX_NOTICES});
  if(received>=MAX_NOTICES||pages>=MAX_PAGES){reachedWindowLimit=true;completed=true;break}
  if(reachedFrontier){completed=true;break}
  const hint=nextHint(cap.json);
  if(!hint){
   if(terminalHint(cap.json)){reachedEnd=true;completed=true;break}
   status('APIで終端を確認できないため、画面は動かさず、次回の通信読取で続行します…','saving',{mode:'network-fallback',readCount:received,savedCount:total,pages});
   await writeUnifiedStatus(a.id,{lastCheckAt:Date.now(),lastRunAt:Date.now(),lastRunComplete:false,lastRunMode:'partial',lastRunReadCount:received,lastRunSavedCount:total,lastError:'API終端を確認できませんでした'});return{handled:false,saved:total,received,pages,pending:0,reason:'END_UNCONFIRMED',needsDom:false}
  }
  const nextReq=mutateNextRequest(cap,hint);
  if(!nextReq){
   status('次ページを解釈できないため、画面は動かさず、次回の通信読取で続行します…','saving',{mode:'network-fallback',readCount:received,savedCount:total,pages});
   await writeUnifiedStatus(a.id,{lastCheckAt:Date.now(),lastRunAt:Date.now(),lastRunComplete:false,lastRunMode:'partial',lastRunReadCount:received,lastRunSavedCount:total,lastError:'次ページを解釈できませんでした'});return{handled:false,saved:total,received,pages,pending:0,reason:'NEXT_UNREADABLE',needsDom:false}
  }
  if(!frontier){
   await writeHistoryState(a.id,{...state,historyComplete:false,resume:{url:nextReq.url,method:nextReq.method,body:nextReq.body??null,requestInit:nextReq.requestInit||null},partialReceived:received,partialSaved:total,partialPages:pages,partialNewestSig:newestSig,partialTotalCount:totalCount,version:VERSION,partialAt:Date.now()});
  }
  if(stopRequested){await writeUnifiedStatus(a.id,{lastCheckAt:Date.now(),lastRunAt:Date.now(),lastRunComplete:false,lastRunMode:'partial',lastRunReadCount:received,lastRunSavedCount:total,lastError:'',historyComplete:Boolean(frontier),direction:'bottom-up'});status(`停止・途中保存｜読込 ${received}${totalCount?` / ${totalCount}`:''}｜保存 ${total}`,'done',{mode:'network-partial',readCount:received,savedCount:total,totalCount,pages,historyComplete:Boolean(frontier),direction:'bottom-up'});return{handled:true,partial:true,saved:total,received,totalCount,pages,pending:await pendingCount(a.id),historyComplete:Boolean(frontier),mode:'network-partial'}}
  try{cap=await replay({...cap,...nextReq,rows:null})}catch(e){
   status('APIの次ページ取得に失敗したため、画面は動かさず、次回の通信読取で続行します…','saving',{mode:'network-fallback',readCount:received,savedCount:total,pages});
   await writeUnifiedStatus(a.id,{lastCheckAt:Date.now(),lastRunAt:Date.now(),lastRunComplete:false,lastRunMode:'partial',lastRunReadCount:received,lastRunSavedCount:total,lastError:String(e?.message||e)});return{handled:false,saved:total,received,pages,pending:0,reason:'NEXT_FETCH_FAILED',needsDom:false,error:String(e?.message||e)}
  }
  if(i===MAX_PAGES-1&&!completed)capLimitHit=true
 }
 const pending=await pendingCount(a.id);
 if(pending)throw new Error(`${pending}件が未保存のため完了扱いにしません`);
 if(capLimitHit||!completed){
  status('APIで完了地点を確認できないため、画面は動かさず、次回の通信読取で続行します…','saving',{mode:'network-fallback',readCount:received,savedCount:total,pages});
  await writeUnifiedStatus(a.id,{lastCheckAt:Date.now(),lastRunAt:Date.now(),lastRunComplete:false,lastRunMode:'partial',lastRunReadCount:received,lastRunSavedCount:total,lastError:capLimitHit?'APIページ上限':'API読取未完了'});return{handled:false,saved:total,received,pages,pending:0,reason:capLimitHit?'PAGE_LIMIT':'INCOMPLETE',needsDom:false}
 }
 const nextState={
  ...state,
  historyComplete:true,
  frontierSig:newestSig||frontier||state?.frontierSig||'',
  verifiedAt:Date.now(),
  fullVerifiedAt:reachedEnd?Date.now():Number(state?.fullVerifiedAt||0),
  lastPages:pages,
  lastReceived:received,
  lastSaved:total,
  lastMode:reachedEnd?'full':'delta',
  version:VERSION,
  resume:null,partialReceived:0,partialSaved:0,partialPages:0,partialNewestSig:'',partialTotalCount:0
 };
 await writeHistoryState(a.id,nextState);
 await writeUnifiedStatus(a.id,{lastCheckAt:Date.now(),lastRunAt:Date.now(),lastRunComplete:true,lastRunMode:reachedEnd?'full':'delta',lastRunReadCount:received,lastRunSavedCount:total,manualSeenCount:received,manualNewCount:total,historyComplete:true,lastError:''});
 if(reachedEnd||reachedWindowLimit){
  status(`✓ note取得上限${MAX_NOTICES}件まで確認｜${pages}ページ・${received}件確認・${total}件保存`,'done',{mode:'network-window',readCount:received,savedCount:total,totalCount:Math.min(MAX_NOTICES,totalCount||received),pages,pendingCount:0,historyComplete:true,windowLimit:MAX_NOTICES});
  return{handled:true,saved:total,received,totalCount:Math.min(MAX_NOTICES,totalCount||received),pages,pending:0,historyComplete:true,full:true,mode:'network-window',windowLimit:MAX_NOTICES}
 }
 status(`✓ 追加分確認完了｜${pages}ページ・${received}件照合・${total}件保存確認`,'done',{mode:'network-delta',readCount:received,savedCount:total,totalCount:Math.min(MAX_NOTICES,totalCount||received),pages,pendingCount:0,historyComplete:true,boundaryReached:true,windowLimit:MAX_NOTICES});
 return{handled:true,saved:total,received,pages,pending:0,historyComplete:true,delta:true,mode:'network-delta'}
}
function stop(){stopRequested=true;return true}
async function syncCurrent(opts={}){return syncHistory(opts)}
async function syncFull(){return syncHistory({forceFull:true,waitMs:3000})}
async function restoreStatus(){
 const a=await account();if(!a)return;const s=await get(key(STATUS,a.id),null);
 if(s&&Date.now()-Number(s.at||0)<24*60*60*1000)lastResult=s
}
installFetch();installXHR();void restoreStatus();
window.__mumeiNotificationNetwork3300={version:VERSION,arm,stop,syncCurrent,syncFull,syncHistory,hasCapture:()=>Boolean(lastCapture),getLastCapture:()=>lastCapture,getLastResult:()=>lastResult};
})();