// ==UserScript==
// @name         無名S note アイコン＋キャプション 貼り付け装置
// @namespace    https://github.com/mumei-s/note-insight/profile-card-paster
// @version      2.5.8
// @description  スキ履歴の直近200人を人物重複なしで紹介。実アイコン・最新記事サムネイル・画像外のプロフィール全文・極薄200種。
// @match        https://editor.note.com/*
// @noframes
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        unsafeWindow
// @connect      note.com
// @connect      assets.st-note.com
// @connect      *
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-profile-card-paster-core-v232.js?v=258
// @updateURL    https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-profile-card-paster-v22.user.js
// @downloadURL  https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-profile-card-paster-v22.user.js
// ==/UserScript==

(function(){
'use strict';

const page=typeof unsafeWindow!=='undefined'?unsafeWindow:window;
if(location.hostname!=='editor.note.com')return;
if(page.__MUMEI_LIKE300_FIX_V258__)return;
page.__MUMEI_LIKE300_FIX_V258__=true;

const VERSION='2.5.8';
const PANEL='mumei-profile-card-paster-v1';
const STATUS='mumei-profile-card-paster-status-v1';
const BRIDGE_KEY='mumei_profile_card_likes_300_v2';
const RUN_PREFIX='mumei_profile_card_paster_run_v15:';
const PREP_PREFIX='mumei_profile_like300_fix_v230:';
const FINAL_URL='https://note.com/fuku444/n/nb4f6934381e9';
const FINAL_KEY='nb4f6934381e9';
const W=860,H=140;
const IMAGE_GAP=50;
const HISTORY_CANDIDATE_CAP=1500;

let busy=false;
let wakeLock=null;
let stopRequested=false;
let pauseRequested=false;
let nativeImageUploadActive=false;
let viewCache=null;
let imageCommandCache=null;
let selectionCache=null;
const activeRequests=new Set();
page.__MUMEI_PROFILE_CARD_FIXED_BUSY__=()=>busy||!!exportWaiter;
page.__MUMEI_PROFILE_CARD_FIXED_PAUSE_REQUESTED__=()=>pauseRequested;
const coreBusy=()=>Boolean(page.__MUMEI_PROFILE_CARD_CORE_BUSY__?.());
const notifyFixedState=()=>window.dispatchEvent(new window.Event('mumei-profile-card-fixed-state'));

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const norm=value=>{
 try{
  const u=new URL(String(value||''),location.href);
  u.search='';u.hash='';
  return u.href
 }catch{return String(value||'').trim()}
};
const noteKey=url=>String(url||'').match(/\/n\/(n[a-f0-9]{12})(?:[/?#]|$)/i)?.[1]||'';
const editorArticleKey=()=>location.pathname.match(/^\/notes\/(n[a-z0-9]{8,})\/edit\/?$/i)?.[1]||'';
const runKey=()=>RUN_PREFIX+(editorArticleKey()||'unknown');
const prepKey=()=>PREP_PREFIX+(editorArticleKey()||'unknown');
function createStoredState(localKey,backupPrefix){
 let activeKey='',memory,hydratedKey='',revision=0,queue=Promise.resolve(),failure=null;
 const select=()=>{const key=localKey();if(activeKey!==key){activeKey=key;memory=undefined;hydratedKey='';revision=0;}return key;};
 const localRead=key=>{try{return JSON.parse(localStorage.getItem(key)||'null')}catch{return null}};
 function read(){const key=select();if(memory===undefined)memory=localRead(key);return memory;}
 function write(value){
  const key=select(),articleKey=editorArticleKey()||'unknown';
  const stamp=Math.max(Date.now(),revision+1,Number(memory?.updatedAt||0)+1);revision=stamp;
  const snapshot=value==null?null:JSON.parse(JSON.stringify({...value,updatedAt:stamp}));memory=snapshot;
  let localOk=false;try{if(snapshot==null)localStorage.removeItem(key);else localStorage.setItem(key,JSON.stringify(snapshot));localOk=true}catch{}
  const envelope={value:snapshot==null?null:JSON.parse(JSON.stringify(snapshot)),updatedAt:stamp,deleted:snapshot==null,articleKey};
  queue=queue.then(async()=>{
   let backupOk=false;try{if(typeof GM_setValue==='function'){await Promise.resolve(GM_setValue(backupPrefix+articleKey,envelope));backupOk=true}}catch{}
   failure=localOk||backupOk?null:new Error('途中記録を保存できません。今ある貼り付けは保持しました');
  });
 }
 async function hydrate(){
  const key=select();if(hydratedKey===key)return read();
  const initialRevision=revision,articleKey=editorArticleKey()||'unknown';
  let backup=null;try{if(typeof GM_getValue==='function')backup=await Promise.resolve(GM_getValue(backupPrefix+articleKey,null))}catch{}
  if(activeKey!==key||revision!==initialRevision)return read();
  const local=localRead(key),localStamp=Number(local?.updatedAt||local?.createdAt||0);
  const valid=backup&&backup.articleKey===articleKey&&Number.isFinite(Number(backup.updatedAt));
  memory=valid&&Number(backup.updatedAt)>=localStamp?(backup.deleted?null:backup.value):local;
  revision=Math.max(revision,localStamp,valid?Number(backup.updatedAt):0);hydratedKey=key;return memory;
 }
 async function flush(){await queue;if(failure)throw failure;}
 return{read,write,hydrate,flush};
}
const runStore=createStoredState(runKey,'mumei_profile_card_run_backup_v253:');
const prepStore=createStoredState(prepKey,'mumei_profile_card_prep_backup_v253:');
const galleryStore=createStoredState(()=> 'mumei_profile_gallery126_v263:'+(editorArticleKey()||'unknown'),'mumei_profile_gallery126_backup_v263:');
function readRun(){return runStore.read()}
function writeRun(value){runStore.write(value)}
function readPrep(){return prepStore.read()}
function writePrep(value){prepStore.write(value)}
async function hydrateRunBackup(){return runStore.hydrate()}
async function flushRunBackup(){return runStore.flush()}
async function hydratePrepBackup(){return prepStore.hydrate()}
async function flushPrepBackup(){return prepStore.flush()}
page.__MUMEI_PROFILE_CARD_RUN_STORE__={read:readRun,write:writeRun,hydrate:hydrateRunBackup,flush:flushRunBackup};
page.__MUMEI_PROFILE_CARD_ENSURE_CARDS_READY__=ensureCardsRunReady;
async function keepAwake(){
 try{if(page.navigator?.wakeLock?.request&&!document.hidden)wakeLock=await page.navigator.wakeLock.request('screen')}catch{}
}
async function releaseAwake(){try{await wakeLock?.release?.()}catch{}wakeLock=null}
function setStatus(text,bad=false){
 const el=document.getElementById(STATUS);
 if(el){el.textContent=text;el.dataset.bad=bad?'1':'0'}
}
let exportWaiter=null;
function historyOptions(run=null){
 if(run?.likesHistoryFix230||run?.likesHistory){
  // Old quota-fragment backups did not store a count; their original plan
  // was 300 people. The new UI default must not reinterpret those backups.
  const count=Array.isArray(run.rows)&&run.rows.at(-1)?.finalMarker?run.rows.length-1:Number(run.historyRequestedCount||run.count)||300;
  return{mode:run.mode==='all'?'all':'number',count,target:run.mode==='all'?Infinity:count};
 }
 const panel=document.getElementById(PANEL),mode=panel?.querySelector('[data-mode]')?.value==='all'?'all':'number';
 const count=Number(panel?.querySelector('[data-count]')?.value||200);
 if(mode==='number'&&(!Number.isInteger(count)||count<1||count>HISTORY_CANDIDATE_CAP))throw new Error('スキ履歴の件数は1〜'+HISTORY_CANDIDATE_CAP+'人で指定してください');
 return{mode,count:mode==='all'?HISTORY_CANDIDATE_CAP:count,target:mode==='all'?Infinity:count};
}
function checkpointHistoryOptions(saved){
 const token=String(saved?.signature||'').match(/\|(all|\d+)\|(?:eligible-v251|exact-v250)$/)?.[1];
 if(token)return{mode:token==='all'?'all':'number',count:token==='all'?HISTORY_CANDIDATE_CAP:Number(token),target:token==='all'?Infinity:Number(token)};
 return historyOptions();
}
function historyExportCount(options){return options.mode==='all'?HISTORY_CANDIDATE_CAP:Math.min(HISTORY_CANDIDATE_CAP,Math.max(options.count+20,options.count*3));}
function prepareInsightExport(options=historyOptions()){
 if(exportWaiter)return exportWaiter.promise;
 const requestId='likes300-'+Date.now()+'-'+Math.random().toString(36).slice(2),url=new URL('https://mumei-s.github.io/note-insight/note-profile-card-paster-history-export.html');
 url.searchParams.set('request',requestId);url.searchParams.set('count',String(historyExportCount(options)));url.searchParams.set('unique','1');url.searchParams.set('scope','recent-likes');
 const popup=window.open(url.href,'_blank');
 if(!popup)return Promise.reject(new Error('スキ履歴取得画面を開けません。ブラウザのポップアップを確認してください'));
 let resolve,reject;const promise=new Promise((ok,fail)=>{resolve=ok;reject=fail});
 const timer=setTimeout(()=>{if(exportWaiter?.requestId===requestId){exportWaiter=null;notifyFixedState();try{popup.close()}catch{}reject(new Error('スキ履歴の取得待ちが時間切れになりました'));}},120000);
 exportWaiter={requestId,popup,promise,resolve,reject,timer};notifyFixedState();setStatus('スキ履歴だけを取得中｜取得後、この編集画面で貼り付け');return promise;
}
window.addEventListener('message',async event=>{
 const waiting=exportWaiter,payload=event.data;
 if(!waiting||event.origin!=='https://mumei-s.github.io'||event.source!==waiting.popup||payload?.type!=='MUMEI_INSIGHT_LIKES_V1'||payload.requestId!==waiting.requestId)return;
 exportWaiter=null;clearTimeout(waiting.timer);notifyFixedState();
 try{
  if(payload.ok!==true)throw new Error(String(payload.error||'スキ履歴取得失敗'));
  const people=uniquePeople(Array.isArray(payload.rows)?payload.rows:[]);
  if(!people.length)throw new Error('スキ履歴に対象のクリエイターがありません');
  await Promise.resolve(GM_setValue(BRIDGE_KEY,{version:231,scope:'recent-likes',at:Date.now(),people}));
  setStatus('スキ履歴 '+people.length+'人を受け取りました');waiting.resolve(people);
 }catch(error){waiting.reject(error);}
});
function startFixed300(options=historyOptions()){
 if(busy||exportWaiter||coreBusy()){setStatus('実行中です。先に「停止」を押してください',true);return;}
 const run=readRun();
 if(run?.likesHistoryFix230&&Array.isArray(run.rows)&&run.rows.length>1)return createFixed300();
 return prepareInsightExport(options).then(()=>createFixed300(options)).catch(error=>setStatus('取得停止：'+(error?.message||String(error)),true));
}
function mediaUrl(value){
 let raw='';
 if(typeof value==='string')raw=value;
 else if(value&&typeof value==='object')raw=value.url||value.src||value.path||value.image_url||value.imageUrl||'';
 raw=String(raw||'').trim();
 if(!raw)return'';
 if(raw.startsWith('//'))return'https:'+raw;
 if(/^https?:\/\//i.test(raw))return raw;
 if(raw.startsWith('/'))return'https://assets.st-note.com'+raw;
 if(/^production\//i.test(raw))return'https://assets.st-note.com/'+raw;
 return raw
}
async function xhr(url,responseType='text',timeout=60000){
 // Retry only this read request, once. Native uploads and editor transactions
 // are never repeated, and a deliberate stop always takes precedence.
 for(let attempt=0;attempt<2;attempt++){
  if(stopRequested)throw new Error('停止しました');
  try{return await new Promise((resolve,reject)=>{
   let request=null,completed=false;
   const done=()=>{completed=true;if(request)activeRequests.delete(request)};
   const fail=(message,code)=>{
    done();
    const error=new Error(stopRequested?'停止しました':message+' '+url);
    error.code=stopRequested?'STOPPED':code;reject(error);
   };
   request=GM_xmlhttpRequest({
    method:'GET',url,responseType,timeout,
    headers:{Accept:responseType==='blob'?'image/avif,image/webp,image/png,image/jpeg,*/*':'application/json,text/html,*/*'},
    onload:r=>{
     done();
     if(stopRequested){reject(new Error('停止しました'));return}
     if(r.status>=200&&r.status<300)resolve(r.response);
     else reject(new Error('GET '+r.status+' '+url))
    },
    onerror:()=>fail('通信失敗','REQUEST_FAILED'),
    ontimeout:()=>fail('通信タイムアウト','REQUEST_TIMEOUT'),
    onabort:()=>fail('通信が中断されました','REQUEST_ABORTED')
   });
   if(request&&!completed)activeRequests.add(request)
  })}catch(error){
   if(stopRequested)throw new Error('停止しました');
   if(attempt||nativeImageUploadActive||!['REQUEST_FAILED','REQUEST_TIMEOUT','REQUEST_ABORTED'].includes(error?.code))throw error;
   await sleep(180);
   if(stopRequested)throw new Error('停止しました');
   if(nativeImageUploadActive)throw error;
  }
 }
}
async function xhrJSON(url){
 const raw=await xhr(url,'text');
 try{return JSON.parse(String(raw||''))}
 catch{throw new Error('JSON解析失敗 '+url)}
}
function abortRequests(){
 for(const request of [...activeRequests]){try{request.abort?.()}catch{}}
 activeRequests.clear()
}

function webpackRequire(){
 const chunks=page.webpackChunk_N_E;
 if(!chunks||typeof chunks.push!=='function')return null;
 let requireFn=null;
 const id=997000000+Math.floor(Math.random()*900000);
 try{chunks.push([[id],{},r=>{requireFn=r}])}catch{}
 return requireFn
}
function nativeEditorFunction(kind){
 const req=webpackRequire(),image=kind==='image';
 const label=image?'note正規画像処理':'note正規URLカード処理';
 if(typeof req!=='function')throw new Error(label+'を取得できません');
 const source=value=>{try{return typeof value==='function'?Function.prototype.toString.call(value):''}catch{return''}};
 const fingerprint=text=>image?/Array\.from/.test(text)&&/imageUploading/.test(text)&&/entries/.test(text):text.includes('state.selection')&&text.includes('nodeBefore')&&text.includes('replaceRangeWith')&&text.includes('.then');
 const matches=new Set();
 const inspect=exports=>{
  const values=[exports];
  if(exports&&(typeof exports==='object'||typeof exports==='function')){
   let keys=[];try{keys=Object.getOwnPropertyNames(exports)}catch{}
   for(const key of keys){try{values.push(exports[key])}catch{}}
  }
  for(const value of values)if(typeof value==='function'&&value.length===(image?4:1)&&fingerprint(source(value)))matches.add(value);
 };
 // Current note builds expose registered factories (.m), but need not expose
 // the module cache (.c). Inspect cached exports when available, without
 // calling any candidate upload/card function to probe its behavior.
 let cached=[];try{cached=Object.values(req.c||{})}catch{}
 for(const entry of cached){try{inspect(entry?.exports)}catch{}}
 if(!matches.size){
  const factories=new Map();
  const register=map=>{
   let keys=[];try{keys=Object.keys(map||{})}catch{}
   for(const key of keys)if(!factories.has(key)){try{if(typeof map[key]==='function')factories.set(key,map[key])}catch{}}
  };
  try{register(req.m)}catch{}
  // Some runtime builds hide .m. Already registered chunk tables provide the
  // same factories; prefer the runtime table when both expose the same ID.
  const chunks=page.webpackChunk_N_E;
  if(Array.isArray(chunks))for(const chunk of chunks){try{register(chunk?.[1])}catch{}}
  const candidates=[...factories].filter(([,factory])=>fingerprint(source(factory)));
  if(candidates.length>16)throw new Error(label+'の候補が多すぎるため停止しました。本文は保持しています');
  // Load only modules whose registered source contains the complete native
  // fingerprint. Never execute unrelated module factories or test uploads.
  for(const [id] of candidates){try{inspect(req(id))}catch{}}
 }
 if(matches.size!==1)throw new Error(matches.size?label+'の候補を一意に確認できません。本文は保持しています':label+'を取得できません');
 return matches.values().next().value;
}
function looksLikeView(value){
 try{return Boolean(value&&typeof value==='object'&&value.state?.doc&&value.state?.schema&&typeof value.dispatch==='function'&&value.dom&&typeof value.posAtDOM==='function')}
 catch{return false}
}
function findView(){
 if(looksLikeView(viewCache)&&viewCache.dom?.isConnected)return viewCache;
 const root=document.querySelector('.ProseMirror[contenteditable="true"]')||document.querySelector('.ProseMirror');
 if(!root)return null;
 const seen=new Set(),queue=[];
 let seed=root;
 for(let i=0;i<6&&seed;i++,seed=seed.parentElement)queue.push([seed,0]);
 let checked=0;
 while(queue.length&&checked++<14000){
  const [value,depth]=queue.shift();
  if(!value||seen.has(value))continue;
  seen.add(value);
  if(looksLikeView(value))return viewCache=value;
  let keys=[];
  try{keys=Object.getOwnPropertyNames(value)}catch{continue}
  for(const key of keys){
   if(['window','document','ownerDocument','parentNode','children','childNodes','style'].includes(key))continue;
   let next;
   try{next=value[key]}catch{continue}
   if(looksLikeView(next))return viewCache=next;
   if(depth<7&&next&&(typeof next==='object'||typeof next==='function')&&next!==page&&next!==document)queue.push([next,depth+1])
  }
 }
 return null
}
function nativeImageCommand(){
 if(imageCommandCache)return imageCommandCache;
 return imageCommandCache=nativeEditorFunction('image');
}
function selectionApi(){
 if(selectionCache)return selectionCache;
 const current=findView()?.state?.selection?.constructor;
 if(typeof current?.atEnd==='function'&&typeof current?.near==='function')return selectionCache=current;
 const req=webpackRequire();let mod;try{mod=req?.(44044)}catch{}
 const Selection=mod?.Y1;
 if(typeof Selection?.atEnd!=='function')throw new Error('note内部Selectionを取得できません');
 return selectionCache=Selection;
}

function imageNodes(view){
 const out=[];
 view.state.doc.descendants((node,pos)=>{if(node.type?.name==='image')out.push({node,pos})});
 return out
}
function embedNodes(view){
 const out=[];
 view.state.doc.descendants((node,pos)=>{if(node.type?.name==='embed')out.push({node,pos})});
 return out
}
function cardKey(hit){return String(hit?.node?.attrs?.embeddedContentKey||'')}
function remoteImage(node){
 const src=String(node?.attrs?.src||'');
 return /^https:\/\//i.test(src)&&!/raw\.githubusercontent\.com/i.test(src)
}
async function waitNewNoteImage(view,beforeIds,timeout=150000){
 const end=Date.now()+timeout;
 while(Date.now()<end){
  const fresh=imageNodes(view).filter(hit=>{
   const id=String(hit.node.attrs?.id||'');
   return id&&!beforeIds.has(id)&&remoteImage(hit.node)
  }).sort((a,b)=>a.pos-b.pos);
  if(fresh.length===1)return fresh[0];
  if(fresh.length>1)throw new Error('複数の新しい画像を検出しました。貼り付け中の手動画像追加を止め、本文の画像を確認してください');
  if(stopRequested)throw new Error('停止しました');
  await sleep(70)
 }
 throw new Error('note画像アップロード待ちタイムアウト')
}
function relinkCaption(view,hit,row){
 const node=view.state.doc.nodeAt(hit.pos)||hit.node;
 if(node?.type?.name!=='image')throw new Error('画像ノードを確認できません');
 const caption=row.creator+'さん';
 const replacement=node.type.create({...node.attrs,link:row.url},view.state.schema.text(caption),node.marks);
 view.dispatch(view.state.tr.replaceWith(hit.pos,hit.pos+node.nodeSize,replacement));
 const id=String(replacement.attrs?.id||'');
 const after=imageNodes(view).find(x=>id&&String(x.node.attrs?.id||'')===id)||imageNodes(view).find(x=>x.pos===hit.pos);
 if(!after||norm(after.node.attrs?.link)!==norm(row.url)||String(after.node.textContent||'').trim()!==caption)throw new Error('画像リンク・名前キャプション設定に失敗しました');
 return after
}
function setSelectionForInsert(view,pos){
 const max=view.state.doc.content.size;
 const at=Math.max(0,Math.min(max,Number(pos)||0));
 const Selection=selectionApi();
 const resolved=view.state.doc.resolve(at);
 const selection=typeof Selection.near==='function'?Selection.near(resolved):Selection.atEnd(view.state.doc);
 view.dispatch(view.state.tr.setSelection(selection).scrollIntoView());
 view.focus();
 return view.state.selection.from
}
async function uploadOne(view,row,file,insertPos){
 assertCreatorAllowed(row);
 const before=new Set(imageNodes(view).map(x=>String(x.node.attrs?.id||'')).filter(Boolean));
 const selected=setSelectionForInsert(view,insertPos);
 const dt=new page.DataTransfer();
 dt.items.add(file);
 nativeImageUploadActive=true;
 try{
  if(nativeImageCommand()(view,dt.files,Math.max(0,selected-1),'image')!==true)throw new Error(row.index+'番 画像アップロードを開始できません');
  const hit=await waitNewNoteImage(view,before);
  const linked=relinkCaption(view,hit,row);
  const actual=imageNodes(view).find(x=>{
   const id=String(linked?.node?.attrs?.id||'');
   return (id&&String(x.node.attrs?.id||'')===id)||x.pos===linked.pos
  })||linked;
  return{hit:actual,nextPos:actual.pos+actual.node.nodeSize}
 }finally{nativeImageUploadActive=false}
}
function cardAnchorFromSelection(view){
 const sel=view.state.selection,$from=sel.$from;
 if(!$from)return view.state.doc.content.size;
 try{
  if($from.depth>=1){
   const node=$from.node(1),before=$from.before(1);
   if(node?.type===view.state.schema.nodes.paragraph&&!String(node.textContent||''))return before;
   return before+node.nodeSize
  }
 }catch{}
 return Math.max(0,Math.min(view.state.doc.content.size,Number(sel.from)||view.state.doc.content.size))
}

function contentList(payload){
 const data=payload?.data&&typeof payload.data==='object'?payload.data:{};
 return Array.isArray(data.contents)?data.contents:Array.isArray(data.notes)?data.notes:[]
}
function articleFromRaw(raw,creator={}){
 const note=raw?.note&&typeof raw.note==='object'?raw.note:raw;
 if(!note||typeof note!=='object')return null;
 const key=String(note.key||'').trim();
 if(!/^n[a-f0-9]{12}$/i.test(key))return null;
 const user=note.user||note.author||{};
 const urlname=String(creator.urlname||user.urlname||'').trim();
 const url=norm(note.noteUrl||note.url||(urlname?'https://note.com/'+urlname+'/n/'+key:''));
 if(!url)return null;
 return{
  likerKey:String(creator.likerKey||user.key||user.id||urlname||key),
  urlname,
  creator:String(creator.creator||user.nickname||user.name||urlname||'noteクリエイター').trim(),
  actorUrl:String(creator.actorUrl||(urlname?'https://note.com/'+urlname:'')),
  actorImageUrl:mediaUrl(creator.actorImageUrl)||avatarUrl(user),
  url,
  title:String(note.name||note.title||'無題の記事').trim(),
  key,
  publishAt:String(note.publishAt||note.publish_at||note.published_at||note.created_at||'').trim()||null,
  thumbUrl:thumbnailUrl(note)
 }
}
async function creatorContents(id){
 return xhrJSON('https://note.com/api/v2/creators/'+encodeURIComponent(id)+'/contents?kind=note&page=1&disabled_pinned=true&with_notes=false')
}
async function articleMetaImage(url){
 try{
  const html=await xhr(url,'text',45000);
  const doc=new DOMParser().parseFromString(String(html||''),'text/html');
  return mediaUrl(doc.querySelector('meta[property="og:image"]')?.content||doc.querySelector('meta[name="twitter:image"]')?.content||'')
 }catch{return''}
}
function profileText(profile){
 const value=profile.profile??profile.description??profile.bio??profile.introduction??profile.self_introduction??profile.note_intro??'';
 const doc=new DOMParser().parseFromString(String(value).replace(/<br\s*\/?\s*>/gi,'\n'),'text/html');
 return String(doc.body.textContent||'').replace(/\r\n?/g,'\n').replace(/[ \t]+/g,' ').trim()
}
function avatarUrl(user){
 return mediaUrl(user?.profileImageUrl||user?.userProfileImagePath||user?.user_profile_image_url||user?.profile_image_url||user?.user_profile_image_path||user?.profile_image_path||user?.profileImagePath||user?.icon_url||user?.image_url||'')
}
function thumbnailUrl(note){
 return mediaUrl(note?.eyecatch||note?.eyecatch_url||note?.spEyecatch||note?.thumbnailExternalUrl||note?.image_url||note?.imageUrl||note?.thumbnail_url||note?.thumbnailUrl||note?.eyecatch_image||note?.eyecatchImage||note?.image||note?.thumbnail||'')
}
async function preparePerson(person){
 assertCreatorAllowed(person);
 const id=canonicalUrlname(person);
 if(!id)throw new Error('クリエイターIDを確認できません');
 try{
  const [contents,profilePayload]=await Promise.all([
   creatorContents(id),
   xhrJSON('https://note.com/api/v2/creators/'+encodeURIComponent(id))
  ]);
  const profile=profilePayload?.data?.creator||profilePayload?.data?.user||profilePayload?.data||profilePayload||{};
  const baseCreator={
   likerKey:creatorKey(person)||id,
   urlname:id,
   creator:String(person.creator||id),
   actorUrl:String(person.actorUrl||('https://note.com/'+id)),
   actorImageUrl:mediaUrl(person.actorImageUrl||'')
  };
  const confirmedEmpty=payload=>Array.isArray(payload?.data?.contents)&&payload.data.contents.length===0&&payload.data.totalCount===0&&payload.data.isLastPage===true&&profile?.noteCount===0;
  const noPublicArticle=()=>{const error=new Error('公開記事なし');error.code='NO_PUBLIC_ARTICLE';return error};
  let candidates=contentList(contents).map(raw=>articleFromRaw(raw,baseCreator)).filter(Boolean);
  if(!candidates.length&&confirmedEmpty(contents))throw noPublicArticle();
  if(!candidates.length){
   const fallback=await xhrJSON('https://note.com/api/v2/creators/'+encodeURIComponent(id)+'/contents?kind=note&page=1&disabled_pinned=false&with_notes=false');
   candidates=contentList(fallback).map(raw=>articleFromRaw(raw,baseCreator)).filter(Boolean);
   if(!candidates.length&&confirmedEmpty(fallback)&&contentList(contents).length===0)throw noPublicArticle();
   candidates.sort((first,second)=>{const a=Date.parse(first.publishAt||''),b=Date.parse(second.publishAt||'');return Number.isFinite(a)&&Number.isFinite(b)?b-a:0});
  }
  const latest=candidates[0];
  if(!latest)throw new Error('公開記事を確認できません');

  const notePayload=await xhrJSON('https://note.com/api/v3/notes/'+encodeURIComponent(latest.key)).catch(()=>({}));
  const note=notePayload?.data||notePayload||{};
  const user=note.user||note.author||{};

  const avatar=avatarUrl(profile)||avatarUrl(user)||baseCreator.actorImageUrl||latest.actorImageUrl;
  const thumb=thumbnailUrl(note)||latest.thumbUrl||await articleMetaImage(latest.url);
  if(!thumb)throw new Error('記事サムネイルが未設定：'+id);
  const biography=profileText(profile);

  return{
   ...latest,
   creator:String(profile.nickname||profile.name||user.nickname||user.name||person.creator||id).trim(),
   actorImageUrl:avatar,
   avatarMissing:!avatar,
   thumbUrl:thumb,
   title:String(note.name||note.title||latest.title||'無題の記事').trim(),
   profileText:biography,
   profileLayout:'compact-v272',
   likesHistory:true,
   likedAt:String(person.likedAt||'')
  }
 }catch(error){const failure=new Error(id+'さんの確認失敗：'+(error?.message||String(error)));if(error?.code)failure.code=error.code;throw failure}
}
function canonicalUrlname(person){
 const raw=String(person?.urlname||'').trim();
 if(raw)return raw.toLowerCase();
 try{const url=new URL(String(person?.actorUrl||''));if(url.hostname==='note.com'||url.hostname==='www.note.com')return decodeURIComponent(url.pathname.split('/')[1]||'').trim().toLowerCase()}catch{}
 return''
}
function creatorKey(person){return String(person?.likerKey??person?.liker_key??'').trim()}
function excludedCreator(row){
 const ids=[String(row?.urlname||'').trim().toLowerCase()];
 for(const value of [row?.urlname,row?.actorUrl,row?.url])try{const url=new URL(String(value||''));if(url.protocol==='https:'&&(url.hostname==='note.com'||url.hostname==='www.note.com'))ids.push(decodeURIComponent(url.pathname.split('/')[1]||'').trim().toLowerCase())}catch{}
 return ids.includes('cinephileangel');
}
function excludePendingCreatorRows(rows,run={}){
 const retained=new Set([...(run.items||[]),...(run.cardKeys||[])].map(record=>norm(record.url)));
 const selected=rows.filter(row=>!excludedCreator(row)||retained.has(norm(row.url)));
 return selected.length===rows.length?rows:selected.map((row,index)=>({...row,index:index+1}));
}
function assertCreatorAllowed(row){if(excludedCreator(row))throw Object.assign(new Error('指定されたクリエイターは新規作成の対象外です'),{code:'CREATOR_EXCLUDED'})}
function uniquePeople(people){
 const parents=new Map();
 const root=id=>{if(!parents.has(id))parents.set(id,id);let at=id;while(parents.get(at)!==at)at=parents.get(at);while(parents.get(id)!==id){const next=parents.get(id);parents.set(id,at);id=next}return at};
 const join=(a,b)=>{const first=root(a),second=root(b);if(first!==second)parents.set(second,first)};
 const candidates=(Array.isArray(people)?people:[]).map(person=>({person,name:canonicalUrlname(person),key:creatorKey(person)}));
 for(const {name,key} of candidates){if(!name)continue;root('name:'+name);if(key)join('name:'+name,'key:'+key)}
 const excluded=root('name:fuku444'),seen=new Set();
 return candidates.filter(({name})=>{if(!name)return false;const identity=root('name:'+name);if(identity===excluded||seen.has(identity))return false;seen.add(identity);return true}).map(({person,name})=>({...person,urlname:name}))
}
function sameCreator(first,second){
 const firstKey=creatorKey(first),secondKey=creatorKey(second);
 return !!(firstKey&&secondKey&&firstKey===secondKey)||!!(canonicalUrlname(first)&&canonicalUrlname(first)===canonicalUrlname(second))
}
function validateFixedRows(rows,expectedCount=null){
 if(!Array.isArray(rows)||rows.length<1||rows.length>HISTORY_CANDIDATE_CAP+1||expectedCount!=null&&rows.length!==expectedCount+1)throw new Error('保存済みの指定件数＋実績1件の一覧を確認できません');
 const count=rows.length-1,creators=rows.slice(0,count),final=rows[count];
 if(uniquePeople(creators).length!==count||creators.some((row,index)=>row.finalMarker||Number(row.index)!==index+1))throw new Error('保存済み一覧にクリエイターの重複・不足・順序の不一致があります。「最初に戻る」で一覧を作り直してください');
 if(!final?.finalMarker)throw new Error('最後の実績の算数を含む'+(rows.length+1)+'件の一覧を確認できません。「最初に戻る」で一覧を作り直してください');
 if(Number(final.index)!==rows.length||canonicalUrlname(final)!=='fuku444'||norm(final.url)!==norm(FINAL_URL))throw new Error('最後の実績の算数を確認できません。「最初に戻る」で一覧を作り直してください');
 if(creators.some(row=>sameCreator(row,final)))throw new Error('実績の算数が'+count+'人の一覧にも含まれています。「最初に戻る」で一覧を作り直してください');
 return rows
}
function completedImagePrefix(rows,images){
 if(images.length>rows.length)throw new Error('保存済み画像が一覧の件数を超えています。本文を確認してください');
 for(let index=0;index<images.length;index++){
  if(!rows[index]?.url||norm(images[index]?.node?.attrs?.link)!==norm(rows[index].url))throw new Error('画像の不足・順序の変更を検出しました。'+(index+1)+'人目から本文を確認し、「① 最初から」で作り直してください');
 }
 return images.length
}
async function buildRows(target=300){
 const bridge=await Promise.resolve(GM_getValue(BRIDGE_KEY,null));
 const people=uniquePeople(Array.isArray(bridge?.people)?bridge.people:[]);
 if(!people.length)throw new Error('スキ履歴の取得データがありません。「① 最初から」で取得してください');
 const targetKey=target===Infinity?'all':target;
 const signature=String(bridge?.at||0)+'|'+targetKey+'|eligible-v251';
 const previousSignature=String(bridge?.at||0)+'|'+targetKey+'|exact-v250';
 let saved;
 saved=readPrep()
 const compatible=saved?.signature===signature||saved?.signature===previousSignature;
 let rows=Array.isArray(saved?.rows)&&compatible?saved.rows:[];
 let skipped=Array.isArray(saved?.skipped)&&saved.signature===signature?saved.skipped:[];
 let index=compatible?Number(saved.index||0):0;
 const removed=rows.filter(excludedCreator);
 if(removed.length){rows=rows.filter(row=>!excludedCreator(row));for(const row of removed)if(!skipped.some(person=>sameCreator(person,row)))skipped.push({urlname:canonicalUrlname(row),likerKey:creatorKey(row),reason:'指定クリエイターを除外'});}
 let accepted=0;
 const validCheckpoint=Number.isInteger(index)&&index===rows.length+skipped.length&&index<=people.length&&rows.length<=target&&uniquePeople([...rows,...skipped]).length===index&&skipped.every(person=>String(person.reason||'').trim())&&people.slice(0,index).every(person=>skipped.some(entry=>sameCreator(entry,person))||sameCreator(rows[accepted++],person))&&accepted===rows.length;
 if(!validCheckpoint)throw new Error('確認途中の保存データに重複・順序の不一致があります。スキ履歴を取得し直してください');
 if(saved?.signature===previousSignature||removed.length){writePrep({...saved,signature,index,rows,skipped,updatedAt:Date.now()});await flushPrepBackup();}

 while(index<people.length&&rows.length<target){
  if(stopRequested)throw new Error('停止しました');
  const batch=people.slice(index,index+Math.min(6,target-rows.length));
  setStatus('スキ履歴｜確認 '+rows.length+'/'+(target===Infinity?'取得分全数':target)+'｜候補 '+(index+batch.length)+'/'+people.length+'｜除外 '+skipped.length);
  const results=await Promise.allSettled(batch.map(preparePerson));
  const stopped=results.find(result=>result.status==='rejected'&&/停止しました|手動停止/.test(String(result.reason?.message||result.reason)));
  if(stopRequested||stopped)throw stopped?.reason||new Error('停止しました');
  const prepared=[],rejected=[];
  for(let position=0;position<results.length;position++){
   const result=results[position],person=batch[position];
   if(result.status==='fulfilled'&&result.value&&sameCreator(result.value,person)){prepared.push(result.value);continue}
   const error=result.status==='rejected'?result.reason:new Error('公開記事・クリエイター情報を確認できません');
   rejected.push({urlname:canonicalUrlname(person),likerKey:creatorKey(person),reason:error?.code==='NO_PUBLIC_ARTICLE'?'公開記事なし':String(error?.message||error)})
  }
  if(uniquePeople([...rows,...prepared,...skipped,...rejected]).length!==rows.length+prepared.length+skipped.length+rejected.length)throw new Error('クリエイターの重複を検出しました。スキ履歴を取得し直してください');
  rows.push(...prepared);skipped.push(...rejected);index+=batch.length;
  writePrep({signature,index,rows,skipped,updatedAt:Date.now()});await flushPrepBackup();
 }
 if(target!==Infinity&&rows.length<target)throw new Error('貼り付け可能なクリエイター '+rows.length+'/'+target+'人｜公開記事なし・取得不可 '+skipped.length+'人を除外。指定件数に不足しています。スキ履歴を取得し直してください');
 if(!rows.length)throw new Error('貼り付け可能なクリエイターがありません。公開記事なし・取得不可の候補を除外しました');
 return rows.slice(0,target).map((row,index)=>({...row,index:index+1}))
}
function replacementDesignChoices(rows,position){
 const start=Math.floor(position/HISTORY_DESIGN_COUNT)*HISTORY_DESIGN_COUNT;
 const used=new Set(rows.slice(start,start+HISTORY_DESIGN_COUNT).filter((row,offset)=>start+offset!==position&&Number.isInteger(row.designIndex)&&row.designIndex>=0&&row.designIndex<HISTORY_DESIGN_COUNT).map(row=>row.designIndex));
 const available=Array.from({length:HISTORY_DESIGN_COUNT},(_,style)=>style).filter(style=>!used.has(style));
 const separated=available.filter(style=>style!==rows[position-1]?.designIndex&&style!==rows[position+1]?.designIndex);
 return separated.length?separated:available;
}
async function replaceUnavailableCreator(rows,index,error,mode='number'){
 validateFixedRows(rows);
 const count=rows.length-1,target=mode==='all'?Infinity:count;
 if(stopRequested||/停止しました|手動停止/.test(String(error?.message||error)))throw error||new Error('停止しました');
 if(!Number.isInteger(index)||index<0||index>=count)throw new Error('最後の実績の算数は除外できません。画像の取得を再試行してください');
 const failed=rows[index],bridge=await Promise.resolve(GM_getValue(BRIDGE_KEY,null)),people=uniquePeople(Array.isArray(bridge?.people)?bridge.people:[]);
 if(!people.length)throw new Error('追加候補の保存データがありません。現在の貼り付けは保持しました');
 const targetKey=target===Infinity?'all':target;
 const signature=String(bridge?.at||0)+'|'+targetKey+'|eligible-v251',previousSignature=String(bridge?.at||0)+'|'+targetKey+'|exact-v250';
 let checkpoint;
 checkpoint=readPrep()
 let selected,skipped,scanned;
 if(checkpoint?.signature===signature||checkpoint?.signature===previousSignature){
  selected=Array.isArray(checkpoint.rows)?checkpoint.rows:[];
  skipped=checkpoint.signature===signature&&Array.isArray(checkpoint.skipped)?checkpoint.skipped:[];
  scanned=Number(checkpoint.index||0);
  let accepted=0;
  const valid=Number.isInteger(scanned)&&scanned===selected.length+skipped.length&&scanned<=people.length&&selected.length<=target&&uniquePeople([...selected,...skipped]).length===scanned&&skipped.every(person=>String(person.reason||'').trim())&&people.slice(0,scanned).every(person=>skipped.some(entry=>sameCreator(entry,person))||sameCreator(selected[accepted++],person))&&accepted===selected.length;
  if(!valid)throw new Error('追加候補の保存順序を確認できません。現在の貼り付けは保持しました');
  if(!selected.some(person=>sameCreator(person,failed))&&!skipped.some(person=>sameCreator(person,failed)))throw new Error('取得できなかったクリエイターと保存済み一覧が一致しません。現在の貼り付けは保持しました');
 }else{
  const creators=rows.slice(0,count),positions=[];
  let cursor=0;
  for(const creator of creators){
   let found=-1;
   for(let candidate=cursor;candidate<people.length;candidate++){if(sameCreator(creator,people[candidate])){found=candidate;break}}
   if(found<0)throw new Error('現在の一覧に対応する追加候補を確認できません。現在の貼り付けは保持しました');
   positions.push(found);cursor=found+1;
  }
  scanned=cursor;selected=creators;
  const included=new Set(positions);
  skipped=people.slice(0,scanned).filter((person,position)=>!included.has(position)).map(person=>({urlname:canonicalUrlname(person),likerKey:creatorKey(person),reason:'前回の一覧で除外'}));
 }
 selected=selected.filter(person=>!sameCreator(person,failed));
 if(!skipped.some(person=>sameCreator(person,failed)))skipped.push({urlname:canonicalUrlname(failed),likerKey:creatorKey(failed),reason:String(error?.message||error||'画像取得不可')});
 writePrep({...checkpoint,signature,index:scanned,rows:selected,skipped,updatedAt:Date.now()});await flushPrepBackup();
 const filled=await buildRows(target);
 if(rows.slice(0,index).some((row,position)=>!sameCreator(row,filled[position])))throw new Error('貼り付け済みの順序を維持できません。現在の貼り付けは保持しました');
 const refreshed=filled.map((person,position)=>{if(position<index)return rows[position];const previous=rows.slice(0,count).find(row=>sameCreator(row,person));return previous?{...person,...previous,index:position+1}:{...person,index:position+1}});
 refreshed.push({...rows[count],index:filled.length+1});
 for(let position=index;position<refreshed.length;position++){
  const row=refreshed[position],before=refreshed[position-1]?.designIndex;
  if(Number.isInteger(row.designIndex)&&row.designIndex>=0&&row.designIndex<HISTORY_DESIGN_COUNT&&row.designIndex!==before)continue;
  const choices=replacementDesignChoices(refreshed,position);
  refreshed[position]={...row,designIndex:choices[Math.floor(Math.random()*choices.length)]};
 }
 validateFixedRows(refreshed);
 const latest=readPrep();if(latest?.signature===signature){writePrep({...latest,rows:refreshed.slice(0,-1),updatedAt:Date.now()});await flushPrepBackup();}
 return refreshed
}
async function recoverCompatibleRun(view,existing){
 if(!existing||existing.articleKey!==editorArticleKey())throw new Error('現在の記事に対応する保存データを確認できません。本文は保持しています');
 let originalPlan=null;
 try{if(Array.isArray(existing.rows))originalPlan=validateFixedRows(existing.rows)}catch{}
 const options=historyOptions({...existing,likesHistory:true}),target=options.target;
 const currentFragment=/^2\.[567]\.\d+(?:$|\b)/.test(String(existing.version||''));
 const knownHistory=existing.likesHistory===true&&originalPlan;
 if(!currentFragment&&!knownHistory)throw new Error('この保存データをスキ'+options.count+'人の履歴貼り付けとして確認できません。本文は保持しています');
 const records=Array.isArray(existing.items)?existing.items:[],all=imageNodes(view),matched=new Map();
 for(const record of records){
  const byId=record.id?all.find(hit=>String(hit.node.attrs?.id||'')===String(record.id)):null;
  if(byId&&norm(byId.node.attrs?.link)!==norm(record.url))throw new Error('保存済み画像のリンクが変更されています。本文は保持しています');
  const bySrc=!byId&&record.src?all.filter(hit=>String(hit.node.attrs?.src||'')===String(record.src)&&norm(hit.node.attrs?.link)===norm(record.url)):[];
  if(bySrc.length>1)throw new Error('保存済み画像を一つに特定できません。本文は保持しています');
  const hit=byId||bySrc[0];
  if(hit)matched.set(hit.pos,{...hit,record})
 }
 const owned=[...matched.values()].sort((first,second)=>first.pos-second.pos);
 if(!owned.length&&(!originalPlan||records.length))throw new Error('現在の本文に対応する貼り付け済み画像を確認できません。本文は保持しています');
 const verify=plan=>{
  const verified=plan.map(row=>({...row}));
  if(owned.length>verified.length)throw new Error('貼り付け済み画像が一覧を超えています');
  for(let position=0;position<owned.length;position++){
   const {node,record}=owned[position],row=verified[position];
   if(norm(node.attrs?.link)!==norm(row.url)){
    const owner=canonicalUrlname({actorUrl:record.url}),caption=String(node.textContent||'').trim();
    if(!owner||owner!==canonicalUrlname(row)||!noteKey(record.url)||!record.creator||caption!==record.creator+'さん')throw new Error('貼り付け済み画像と保存済み一覧の順序が一致しません');
    verified[position]={...row,url:norm(record.url),key:noteKey(record.url),creator:String(record.creator)};
   }
   if(record.creator&&String(node.textContent||'').trim()===record.creator+'さん')verified[position].creator=String(record.creator);
   const previous=(Array.isArray(existing.rows)?existing.rows:[]).find(person=>sameCreator(person,verified[position])&&norm(person.url)===norm(verified[position].url));
   if(previous&&Number.isInteger(previous.designIndex))verified[position].designIndex=previous.designIndex;
  }
  completedImagePrefix(verified,owned);return validateFixedRows(verified)
 };
 let rows;
 if(originalPlan){try{rows=verify(originalPlan)}catch{}}
 if(!rows){
  let checkpoint;
  checkpoint=readPrep()
  const checkpointOptions=checkpointHistoryOptions(checkpoint);
  if(Array.isArray(checkpoint?.rows)&&checkpoint.rows.length&&(target===Infinity||checkpoint.rows.length===target)&&checkpointOptions.target===target){
   const final=originalPlan?.at(-1)||await enrichFinal(checkpoint.rows.length+1);
   try{rows=verify(validateFixedRows([...checkpoint.rows.map((row,position)=>({...row,index:position+1})),{...final,index:checkpoint.rows.length+1}]))}catch{}
  }
 }
 if(!rows){const creators=await buildRows(target);rows=verify(validateFixedRows([...creators,await enrichFinal(creators.length+1)]))}
 for(let position=0;position<rows.length;position++){
  const row=rows[position],before=rows[position-1]?.designIndex;
  if(position<owned.length&&(Array.isArray(existing.rows)?existing.rows:[]).some(person=>sameCreator(person,row)&&norm(person.url)===norm(row.url)&&person.designIndex===row.designIndex)&&Number.isInteger(row.designIndex)&&row.designIndex>=0&&row.designIndex<HISTORY_DESIGN_COUNT)continue;
  if(Number.isInteger(row.designIndex)&&row.designIndex>=0&&row.designIndex<HISTORY_DESIGN_COUNT&&row.designIndex!==before)continue;
  const choices=replacementDesignChoices(rows,position);
  rows[position]={...row,designIndex:choices[Math.floor(Math.random()*choices.length)]}
 }
 const blocks=[];
 if(typeof view.state.doc.forEach==='function')view.state.doc.forEach((node,pos)=>blocks.push({node,pos}));
 else view.state.doc.descendants((node,pos)=>{blocks.push({node,pos});return false});
 const headings=new Set(existing.sectionHeadings||[]),activities=new Set(existing.activityTexts||[]),dividers=new Set(existing.dividerUrls||[]);
 let anchor=owned[0]?.pos??(Number(existing.imageAnchorPos)||0);
 const recoverProfile=(block,row)=>{
  if(block?.node?.type?.name==='paragraph'&&row.profileLayout==='compact-v272'&&String(block.node.textContent||'')===activityText(row)){activities.add(String(block.node.textContent));return true}
  const prefix='プロフィール｜'+row.creator+'さん：';
  if(block?.node?.type?.name!=='paragraph'||!String(block.node.textContent||'').startsWith(prefix))return false;
  const text=String(block.node.textContent),profile=text.slice(prefix.length);
  activities.add(text);row.profileText=profile==='プロフィール未設定'?'':profile;return true
 };
 for(let position=0;position<owned.length;position++){
  const image=owned[position],blockIndex=blocks.findIndex(block=>block.pos===image.pos),row=rows[position];
  if(blockIndex<0)throw new Error('貼り付け済み画像の本文位置を確認できません。本文は保持しています');
  let before=blockIndex-1;
  if(!row.finalMarker&&recoverProfile(blocks[before],row)){if(position===0)anchor=blocks[before].pos;before--}
  const expected=row.finalMarker?'最後に｜実績の算数':position%10===0?headingText(Math.floor(position/10),rows.length-1):'';
  if(expected&&blocks[before]?.node?.type?.name==='heading'&&String(blocks[before].node.textContent||'')===expected){headings.add(expected);if(position===0)anchor=blocks[before].pos}
  if(isDivider(view,blocks[blockIndex+1]?.node))dividers.add(row.url);
 }
 if(owned.length&&owned.length<rows.length){
  const last=owned[owned.length-1],at=blocks.findIndex(block=>block.pos===last.pos),row=rows[owned.length];
  let after=at+1;if(isDivider(view,blocks[after]?.node))after++;
  const expected=row.finalMarker?'最後に｜実績の算数':owned.length%10===0?headingText(Math.floor(owned.length/10),rows.length-1):'';
  if(expected&&blocks[after]?.node?.type?.name==='heading'&&String(blocks[after].node.textContent||'')===expected){headings.add(expected);after++}
  if(!row.finalMarker)recoverProfile(blocks[after],row)
 }
 return{...existing,version:VERSION,articleKey:editorArticleKey(),likesHistoryFix230:true,likesHistory:true,rows,items:records,count:rows.length-1,choice:'latest',mode:options.mode,stage:owned.length===rows.length?(['images_ready','cards_building','complete'].includes(existing.stage)?existing.stage:'images_ready'):'images_building',imageAnchorPos:Number.isFinite(Number(existing.imageAnchorPos))&&Number(existing.imageAnchorPos)>=0&&Number(existing.imageAnchorPos)<=anchor?Number(existing.imageAnchorPos):anchor,sectionHeadings:[...headings],activityTexts:[...activities],dividerUrls:[...dividers],cardKeys:Array.isArray(existing.cardKeys)?existing.cardKeys:[],cardBaselineKeys:Array.isArray(existing.cardBaselineKeys)?existing.cardBaselineKeys:embedNodes(view).map(cardKey).filter(Boolean),sources:existing.sources||'スキ履歴（読み取りのみ）',recoveredAt:Date.now(),updatedAt:Date.now()}
}
async function ensureCardsRunReady(view,anchors=null){
 await Promise.all([hydrateRunBackup(),hydratePrepBackup()]);
 let run=readRun();
 if(!run)return null;
 if(run.articleKey===editorArticleKey()&&!run.gallery126&&Array.isArray(run.rows)){
  const selected=excludePendingCreatorRows(run.rows,run);
  if(selected!==run.rows){run={...run,rows:selected,count:selected.length-1,updatedAt:Date.now()};writeRun(run);await flushRunBackup();}
 }
 if(run.gallery126){
  if(run.articleKey!==editorArticleKey())throw new Error('別の記事の保存記録です');
  if(galleryNeedsParticipantUpgrade(run))throw new Error('記事なしの参加者1人を追加します。画像の「再開」で126人を完成させてください');
  const rows=validateGalleryRows(run.rows);
  if(!rows.at(-1)?.finalMarker)throw new Error('最後の実績の算数が未追加です。「続きから」で末尾の画像を完成させてください');
  assertGalleryTracking(view,run);repairGalleryProfileParagraphs(view,run,rows,anchors);await flushRunBackup();run=readRun();
  const images=ownedImagesForRun(view,run);
  const count=completedImagePrefix(rows,images);
  if(count!==rows.length)throw new Error('ハロウィン画像の照合 '+count+'/'+rows.length+'件。先に画像の続きを完成させてください');
  if(reconcileGalleryHeadings(view,run,rows)){await flushRunBackup();run=readRun()}
  assertGalleryPaste(view,rows);
  if(!['images_ready','cards_building','complete'].includes(run.stage)){
   writeRun({...run,stage:'images_ready',updatedAt:Date.now()});await flushRunBackup();
  }
  return readRun();
 }
 if(Array.isArray(run.rows)&&run.rows.length&&['images_ready','cards_building','complete'].includes(run.stage))return run;
 const checkpoint=readPrep();
 const currentVersion=/^2\.[56]\.\d+(?:$|\b)/.test(String(run.version||''));
 const fragment=currentVersion&&!Array.isArray(run.rows)&&Array.isArray(checkpoint?.rows)&&checkpoint.rows.length>0;
 const savedPlan=currentVersion&&Array.isArray(run.rows)&&run.rows.at(-1)?.finalMarker;
 if(!run.likesHistoryFix230&&!run.likesHistory&&!fragment&&!savedPlan)return run;
 if(!run.likesHistoryFix230){run=await recoverCompatibleRun(view,run);}
 let rows;try{rows=validateFixedRows(run.rows)}catch{run=await recoverCompatibleRun(view,run);rows=validateFixedRows(run.rows)}
 const images=ownedImagesForRun(view,run);
 const count=completedImagePrefix(rows,images);
 if(count!==rows.length)throw new Error('本文の画像を照合しました：'+count+'/'+rows.length+'件。完成分は保持しています');
 run={...run,rows,stage:'images_ready',imagesCompletedAt:run.imagesCompletedAt||Date.now(),updatedAt:Date.now()};
 writeRun(run);await flushRunBackup();return readRun()
}
async function enrichFinal(index=301){
 const person={urlname:'fuku444',creator:'実績の算数',actorUrl:'https://note.com/fuku444',actorImageUrl:'',likerKey:'final-performance-math'};
 const row={...person,url:FINAL_URL,key:FINAL_KEY,title:'実績の算数│3日半で0→1達成',thumbUrl:'',publishAt:null};
 try{
  const [notePayload,profilePayload]=await Promise.all([
   xhrJSON('https://note.com/api/v3/notes/'+FINAL_KEY).catch(()=>({})),
   xhrJSON('https://note.com/api/v2/creators/fuku444').catch(()=>({}))
  ]);
  const note=notePayload?.data||notePayload||{};
  const profile=profilePayload?.data?.creator||profilePayload?.data?.user||profilePayload?.data||profilePayload||{};
  const user=note.user||note.author||{};
  const avatar=avatarUrl(profile)||avatarUrl(user);
  const thumb=thumbnailUrl(note)||await articleMetaImage(FINAL_URL);

  return{...row,creator:String(profile.nickname||profile.name||user.nickname||user.name||'実績の算数'),actorImageUrl:avatar,thumbUrl:thumb,finalMarker:true,index}
 }catch{return{...row,finalMarker:true,index}}
}

async function bitmapFromUrl(url){
 if(!url)return null;
 const response=await xhr(url,'blob',45000);
 // Normalize the extension's Blob into the page realm before decoding.
 const blob=new page.Blob([await response.arrayBuffer()],{type:response.type||'image/jpeg'});
 if(typeof page.createImageBitmap==='function'){
  try{return await page.createImageBitmap(blob)}catch{}
 }
 return new Promise((resolve,reject)=>{
  const image=new page.Image(),objectUrl=page.URL.createObjectURL(blob);
  const timer=setTimeout(()=>finish(new Error('画像のデコード待ちタイムアウト')),15000);
  function finish(error){clearTimeout(timer);page.URL.revokeObjectURL(objectUrl);error?reject(error):resolve(image)}
  image.onload=()=>finish();image.onerror=()=>finish(new Error('画像読込失敗'));
  image.src=objectUrl
 })
}
function rounded(ctx,x,y,w,h,r){
 const radius=Math.min(r,w/2,h/2);
 ctx.beginPath();ctx.moveTo(x+radius,y);
 ctx.arcTo(x+w,y,x+w,y+h,radius);ctx.arcTo(x+w,y+h,x,y+h,radius);
 ctx.arcTo(x,y+h,x,y,radius);ctx.arcTo(x,y,x+w,y,radius);ctx.closePath()
}
function circle(ctx,x,y,r){ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.closePath()}
function fit(ctx,text,maxWidth){
 let value=String(text||'');
 if(ctx.measureText(value).width<=maxWidth)return value;
 while(value&&ctx.measureText(value+'…').width>maxWidth)value=[...value].slice(0,-1).join('');
 return value+'…'
}
function textLines(ctx,text,maxWidth,maxLines){
 const chars=[...String(text||'')],out=[];
 let line='';
 for(let i=0;i<chars.length;i++){
  const test=line+chars[i];
  if(line&&ctx.measureText(test).width>maxWidth){
   out.push(line);line=chars[i];
   if(out.length===maxLines-1){line=chars.slice(i).join('');break}
  }else line=test
 }
 if(line&&out.length<maxLines){
  while(line&&ctx.measureText(line+(line.length<String(text||'').length?'…':'')).width>maxWidth)line=[...line].slice(0,-1).join('');
  out.push(line+(out.length===maxLines-1&&line.length<String(text||'').length?'…':''))
 }
 return out.slice(0,maxLines)
}
function hash(value){
 let h=2166136261;
 for(const ch of String(value||'')){h^=ch.codePointAt(0)||0;h=Math.imul(h,16777619)}
 return h>>>0
}
const HISTORY_DESIGN_COUNT=200;
function assignDesigns(rows){
 // Keep every saved gallery choice: retries and asset recovery must not restyle
 // images that have already been pasted. The gallery uses one finite set.
 if(rows.some(row=>row.gallery126===true)){
  const gallery=rows.filter(row=>row.gallery126===true);
  if(gallery.length>126)throw new Error('参加者用の126デザインを超えています');
  const seen=new Set(),keep=new Set();
  for(const row of gallery){
   if(Number.isInteger(row.designIndex)&&row.designIndex>=0&&row.designIndex<126&&!seen.has(row.designIndex)){seen.add(row.designIndex);keep.add(row)}
  }
  if(keep.size===gallery.length)return rows;
  const pool=Array.from({length:126},(_,i)=>i).filter(index=>!seen.has(index));
  for(let i=pool.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]]}
  return rows.map(row=>row.gallery126===true&&!keep.has(row)?{...row,designIndex:pool.pop()}:row)
 }
 const valid=rows.every((row,i)=>Number.isInteger(row.designIndex)&&row.designIndex>=0&&row.designIndex<HISTORY_DESIGN_COUNT&&(i===0||row.designIndex!==rows[i-1].designIndex));
 if(valid)return rows;
 // Saved choices, including older 50-style batches, remain frozen. A new
 // batch draws every one of the 200 styles once before opening another pool.
 let pool=[],last=-1;
 return rows.map((row,position)=>{
  if(position%HISTORY_DESIGN_COUNT===0){
   const saved=new Set(rows.slice(position,position+HISTORY_DESIGN_COUNT).filter(entry=>Number.isInteger(entry.designIndex)&&entry.designIndex>=0&&entry.designIndex<HISTORY_DESIGN_COUNT).map(entry=>entry.designIndex));
   pool=Array.from({length:HISTORY_DESIGN_COUNT},(_,i)=>i).filter(index=>!saved.has(index));
   for(let i=pool.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
  }
  if(Number.isInteger(row.designIndex)&&row.designIndex>=0&&row.designIndex<HISTORY_DESIGN_COUNT){last=row.designIndex;return row;}
  if(pool.length>1&&pool[pool.length-1]===last)[pool[0],pool[pool.length-1]]=[pool[pool.length-1],pool[0]];
  last=pool.pop();return{...row,designIndex:last};
 });
}
const palettes=[
 {bg:'#ffffff',panel:'#ffffff',ink:'#101827',muted:'#64748b',line:'#d8e1ea',accent:'#22c3ee',soft:'#edfaff'},
 {bg:'#fff8fb',panel:'#ffffff',ink:'#3b1d2c',muted:'#866176',line:'#efcbdc',accent:'#d95a9c',soft:'#ffe8f3'},
 {bg:'#f7fff8',panel:'#ffffff',ink:'#173525',muted:'#68806f',line:'#cfe6d5',accent:'#3aaa68',soft:'#e8f7ec'},
 {bg:'#fffaf2',panel:'#fffefa',ink:'#39291b',muted:'#846e5a',line:'#ead7bf',accent:'#d99240',soft:'#fff0da'},
 {bg:'#f8f5ff',panel:'#ffffff',ink:'#2e2141',muted:'#78688e',line:'#ddd2ec',accent:'#8062c9',soft:'#eee8fb'}
];
// Four visibly different content compositions × ten decorative motifs ×
// five palettes. Indices 0–49 retain the original renderer without restyling
// any saved image; 50–199 add thumbnail/portrait placements and square frames.
const historyLayouts=[
 {avatar:[50,70,34],text:[100,18,455],name:[100,86,455],brand:[100,110],thumb:[590,8,262,124],shape:'circle'},
 {avatar:[810,70,32],text:[304,18,448],name:[304,88,448],brand:[304,111],thumb:[8,8,270,124],shape:'square'},
 {avatar:[49,70,32],text:[374,18,462],name:[374,88,462],brand:[374,111],thumb:[104,12,246,116],shape:'circle'},
 {avatar:[499,70,29],text:[20,18,432],name:[20,88,432],brand:[20,111],thumb:[548,8,304,124],shape:'square'}
];
function historyDesign(index){
 if(!Number.isInteger(index)||index<0||index>=HISTORY_DESIGN_COUNT)throw new Error('極薄デザイン番号が不正です');
 return{layoutIndex:Math.floor(index/50),motif:index%10,paletteIndex:Math.floor(index/10)%5,layout:historyLayouts[Math.floor(index/50)],theme:palettes[Math.floor(index/10)%5]};
}
function drawDecor(ctx,index,theme){
 ctx.fillStyle=theme.bg;ctx.fillRect(0,0,W,H);
 ctx.strokeStyle=theme.line;ctx.lineWidth=1.5;rounded(ctx,1,1,W-2,H-2,12);ctx.stroke();
 const pattern=index%10;
 ctx.save();ctx.globalAlpha=.24;ctx.strokeStyle=theme.accent;ctx.fillStyle=theme.accent;
 if(pattern===0){ctx.fillRect(0,0,7,H);ctx.beginPath();ctx.arc(540,25,48,0,Math.PI*2);ctx.fill()}
 else if(pattern===1){for(let x=-80;x<590;x+=34){ctx.beginPath();ctx.moveTo(x,H);ctx.lineTo(x+90,0);ctx.stroke()}}
 else if(pattern===2){for(let y=18;y<H;y+=22){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(570,y);ctx.stroke()}}
 else if(pattern===3){for(let y=14;y<H;y+=20)for(let x=14;x<570;x+=20){ctx.beginPath();ctx.arc(x,y,2.4,0,Math.PI*2);ctx.fill()}}
 else if(pattern===4){for(const r of [20,38,56,74]){ctx.beginPath();ctx.arc(515,70,r,0,Math.PI*2);ctx.stroke()}}
 else if(pattern===5){ctx.setLineDash([7,6]);rounded(ctx,14,12,542,H-24,14);ctx.stroke();ctx.setLineDash([])}
 else if(pattern===6){for(let x=395;x<570;x+=24)ctx.fillRect(x,10,12,H-20)}
 else if(pattern===7){ctx.beginPath();ctx.moveTo(0,118);for(let x=0;x<570;x+=32)ctx.lineTo(x,118-(x/32%3)*17);ctx.stroke()}
 else if(pattern===8){for(let y=12;y<132;y+=24)for(let x=400;x<570;x+=24)ctx.strokeRect(x,y,18,18)}
 else{for(let a=0;a<Math.PI*2;a+=Math.PI/18){ctx.beginPath();ctx.moveTo(520,70);ctx.lineTo(520+Math.cos(a)*100,70+Math.sin(a)*68);ctx.stroke()}}
 ctx.restore()
}
// 9 compositions × 7 motifs × 2 palette families = 126 distinct gallery
// designs. Motifs, image placement and framing all change at visible scale.
const galleryLayouts=[
 {avatar:[50,70,32],text:[100,18,452],name:[100,91,452],thumb:[590,8,262,124],shape:'circle'},
 {avatar:[302,70,30],text:[350,18,490],name:[350,96,490],thumb:[8,8,250,124],shape:'square'},
 {avatar:[48,70,31],text:[358,20,478],name:[358,96,478],thumb:[98,12,236,116],shape:'circle'},
 {avatar:[488,70,30],text:[20,18,414],name:[20,96,414],thumb:[536,8,316,124],shape:'square'},
 {avatar:[800,70,36],text:[286,20,442],name:[286,96,442],thumb:[8,8,252,124],shape:'circle'},
 {avatar:[42,42,24],text:[82,16,390],name:[20,98,452],thumb:[500,8,352,124],shape:'square'},
 {avatar:[42,106,22],text:[20,14,468],name:[84,99,412],thumb:[530,8,322,124],shape:'circle'},
 {avatar:[74,70,44],text:[140,20,414],name:[140,96,414],thumb:[578,12,274,116],shape:'square'},
 {avatar:[353,70,31],text:[408,20,430],name:[408,96,430],thumb:[8,8,300,124],shape:'circle'}
];
const galleryPalettes=[
 {bg:'#fff7eb',panel:'#fffefd',ink:'#392319',muted:'#72513d',line:'#d7ac75',accent:'#bd591e',soft:'#ffe5bd',detail:'#67409a'},
 {bg:'#f6f0ff',panel:'#ffffff',ink:'#312143',muted:'#665079',line:'#bca6da',accent:'#7950b3',soft:'#e6d6ff',detail:'#bc6482'},
 {bg:'#edf9f1',panel:'#ffffff',ink:'#163b2c',muted:'#426954',line:'#94c5a7',accent:'#25805b',soft:'#ccebd9',detail:'#b77c34'},
 {bg:'#edf6ff',panel:'#ffffff',ink:'#18314e',muted:'#476782',line:'#9dbed9',accent:'#286caa',soft:'#cfe6fc',detail:'#845baf'},
 {bg:'#fff0f4',panel:'#ffffff',ink:'#482437',muted:'#805369',line:'#d8a4bb',accent:'#b24d7a',soft:'#f8d8e6',detail:'#688d70'},
 {bg:'#fffbed',panel:'#ffffff',ink:'#413417',muted:'#7b663c',line:'#cebd7d',accent:'#947018',soft:'#f5e6ad',detail:'#49868a'},
 {bg:'#f0f5f7',panel:'#ffffff',ink:'#273940',muted:'#536d77',line:'#a6bec7',accent:'#397e91',soft:'#d3e6ec',detail:'#ad6c55'},
 {bg:'#171d37',panel:'#202c49',ink:'#f8f7ff',muted:'#ded4ff',line:'#65618f',accent:'#b3dbef',soft:'#334564',detail:'#e7acda'},
 {bg:'#30203e',panel:'#432d51',ink:'#fff4ff',muted:'#e7cde9',line:'#906a9e',accent:'#e0a8ee',soft:'#614276',detail:'#f1c38a'},
 {bg:'#142f2a',panel:'#23473e',ink:'#f3fff8',muted:'#c6e6d4',line:'#4f8b75',accent:'#8ed2a5',soft:'#355e4e',detail:'#e2ba7f'},
 {bg:'#3b202b',panel:'#512e3c',ink:'#fff4f6',muted:'#edc7d0',line:'#a96c82',accent:'#efacc6',soft:'#6b3f54',detail:'#a7cbdc'},
 {bg:'#2c2a20',panel:'#3e3b2e',ink:'#fff9e5',muted:'#e4d8b2',line:'#92845a',accent:'#e8c975',soft:'#5a5137',detail:'#9ec1bb'},
 {bg:'#13323a',panel:'#244a54',ink:'#effdff',muted:'#bcdee5',line:'#4b8a99',accent:'#84d4df',soft:'#32616c',detail:'#dbb4e9'},
 {bg:'#292538',panel:'#3c354d',ink:'#fff5ff',muted:'#ded0e7',line:'#81708f',accent:'#d4b5ee',soft:'#574765',detail:'#efa9bd'}
];
function galleryDesign(index){
 if(!Number.isInteger(index)||index<0||index>=126)throw new Error('参加者デザイン番号が不正です');
 return{layoutIndex:index%9,motif:Math.floor(index/9)%7,paletteIndex:Math.floor(index/9),familyIndex:Math.floor(index/63),layout:galleryLayouts[index%9],theme:galleryPalettes[Math.floor(index/9)]}
}
function drawGalleryDecor(ctx,design){
 const {layoutIndex,motif,theme}=design;
 ctx.fillStyle=theme.bg;ctx.fillRect(0,0,W,H);
 ctx.save();ctx.strokeStyle=theme.line;ctx.fillStyle=theme.accent;ctx.lineWidth=1.5;
 rounded(ctx,1.5,1.5,W-3,H-3,12);ctx.stroke();
 ctx.globalAlpha=.18;
 if(motif===0){
  // Ornamental corners and a long double frame.
  ctx.lineWidth=3;rounded(ctx,7,7,W-14,H-14,9);ctx.stroke();
  for(const x of [18,W-18])for(const y of [18,H-18]){circle(ctx,x,y,11);ctx.fill();circle(ctx,x,y,5);ctx.stroke()}
 }else if(motif===1){
  // Broad angled ribbons, rather than a tiny identifier.
  for(let x=-160;x<W+160;x+=95){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x+35,0);ctx.lineTo(x+155,H);ctx.lineTo(x+120,H);ctx.closePath();ctx.fill()}
 }else if(motif===2){
  // Stitched scrapbook frame with a translucent horizontal paper strip.
  ctx.fillRect(0,82,W,44);ctx.globalAlpha=.42;ctx.setLineDash([8,5]);rounded(ctx,10,10,W-20,H-20,7);ctx.stroke();ctx.setLineDash([])
 }else if(motif===3){
  // A field of large geometric diamonds.
  for(let y=-4;y<H+28;y+=42)for(let x=20;x<W;x+=64){ctx.beginPath();ctx.moveTo(x,y-14);ctx.lineTo(x+19,y);ctx.lineTo(x,y+14);ctx.lineTo(x-19,y);ctx.closePath();ctx.stroke()}
 }else if(motif===4){
  // Concentric moonlike orbits on opposite sides.
  ctx.lineWidth=2.5;for(const [x,y] of [[30,20],[W-40,H-10]])for(const r of [22,44,66,88,110]){circle(ctx,x,y,r);ctx.stroke()}
 }else if(motif===5){
  // Scalloped upper and lower borders with a solid lower ribbon.
  ctx.fillRect(0,H-9,W,9);for(let x=12;x<W;x+=32){circle(ctx,x,0,16);ctx.fill();circle(ctx,x,H,16);ctx.stroke()}
 }else{
  // Stars and a bold constellation running across the full banner.
  ctx.strokeStyle=theme.detail;ctx.fillStyle=theme.detail;
  ctx.beginPath();ctx.moveTo(0,110);for(let x=45;x<W;x+=90)ctx.lineTo(x,25+(Math.floor(x/90)%2)*68);ctx.stroke();
  for(let x=36;x<W;x+=82){const y=24+(Math.floor(x/82)%3)*41;ctx.beginPath();for(let n=0;n<10;n++){const angle=-Math.PI/2+n*Math.PI/5,r=n%2?4:10;const px=x+Math.cos(angle)*r,py=y+Math.sin(angle)*r;n?ctx.lineTo(px,py):ctx.moveTo(px,py)}ctx.closePath();ctx.fill()}
 }
 ctx.restore();
 // Each composition has its own substantial accent placement.
 ctx.save();ctx.fillStyle=theme.accent;ctx.globalAlpha=.65;
 if(layoutIndex===0)ctx.fillRect(0,0,7,H);
 else if(layoutIndex===1)ctx.fillRect(268,14,4,H-28);
 else if(layoutIndex===2)ctx.fillRect(342,14,4,H-28);
 else if(layoutIndex===3)ctx.fillRect(18,78,398,3);
 else if(layoutIndex===4)ctx.fillRect(748,14,4,H-28);
 else if(layoutIndex===5){ctx.fillRect(17,78,448,3);ctx.fillRect(17,H-6,448,6)}
 else if(layoutIndex===6)ctx.fillRect(82,85,408,3);
 else if(layoutIndex===7){ctx.fillRect(134,15,4,H-30);ctx.fillRect(145,H-6,400,6)}
 else ctx.fillRect(396,14,4,H-28);
 ctx.restore()
}
function fitGalleryCreatorName(ctx,creator,maxWidth,maxSize=14){
 const name=String(creator||''),full=name+'さん';
 for(let size=maxSize;size>=10;size-=.5){
  ctx.font='700 '+size+'px system-ui,-apple-system,sans-serif';
  if(ctx.measureText(full).width<=maxWidth)return{text:full,size,truncated:false};
 }
 // The native caption keeps the complete name. The image label always keeps
 // the honorific, even when an unusually long name cannot fit at 10px.
 const parts=typeof Intl?.Segmenter==='function'?Array.from(new Intl.Segmenter('ja',{granularity:'grapheme'}).segment(name),part=>part.segment):Array.from(name);
 while(parts.length&&ctx.measureText(parts.join('')+'…さん').width>maxWidth)parts.pop();
 return{text:parts.join('')+'…さん',size:10,truncated:true};
}
function confirmedGalleryThumbnailMissing(row){
 return row.gallery126===true&&row.articleThumbnailMissing===true&&Boolean(row.key)&&Boolean(row.url)&&row.thumbnailMissingEvidence?.key===row.key&&row.thumbnailMissingEvidence?.articleUrl===row.url;
}
function confirmedGalleryProfileOnly(row){
 const id=String(row.urlname||'').trim().toLowerCase(),profileUrl='https://note.com/'+id,proof=row.noPublicArticleEvidence;
 return row.gallery126===true&&row.profileOnly===true&&/^[a-z0-9_\-]+$/.test(id)&&row.url===profileUrl&&row.actorUrl===profileUrl&&row.key===''&&row.thumbUrl===''&&row.title===''&&row.publishAt===null&&row.articleSelection==='profile-only-confirmed'&&row.oldestVerified===false&&row.oldestEvidence===null&&proof?.creator===id&&proof.profileUrl===profileUrl&&proof.noteCount===0&&proof.contentsTotal===0&&proof.isLastPage===true&&proof.source==='note-public-api'&&Number.isFinite(Date.parse(proof.checkedAt||''));
}
function drawGalleryCard(ctx,index,row,avatar,thumb){
 const design=galleryDesign(index),{layout,theme}=design;
 drawGalleryDecor(ctx,design);
 const profileOnly=confirmedGalleryProfileOnly(row);
 const [ix,iy,iw,ih]=layout.thumb,[ax,originalAy,originalAr]=layout.avatar,ay=profileOnly?70:originalAy,ar=profileOnly?Math.max(32,originalAr):originalAr;
 const frame=()=>layout.shape==='square'?rounded(ctx,ax-ar,ay-ar,ar*2,ar*2,10):circle(ctx,ax,ay,ar);
 ctx.fillStyle=theme.soft;frame();ctx.fill();ctx.strokeStyle=theme.accent;ctx.lineWidth=2;frame();ctx.stroke();
 if(avatar){
  const sw=avatar.width||avatar.naturalWidth||1,sh=avatar.height||avatar.naturalHeight||1,scale=Math.max(ar*2/sw,ar*2/sh),dw=sw*scale,dh=sh*scale;
  ctx.save();frame();ctx.clip();ctx.drawImage(avatar,ax-dw/2,ay-dh/2,dw,dh);ctx.restore()
 }else{
  ctx.save();ctx.fillStyle=theme.ink;ctx.font='800 '+Math.min(28,ar)+'px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText([...String(row.creator||'n')][0]||'n',ax,ay);ctx.restore()
 }
 if(profileOnly){
  // No article is invented for a participant whose public article count is zero.
  // Keep just their real icon (or initial) and full creator label on this design.
  const nx=ax>=W/2?24:ax+ar+24,nw=ax>=W/2?ax-ar-48:W-nx-24;
  ctx.fillStyle=theme.bg;rounded(ctx,nx-4,46,nw+8,48,6);ctx.fill();
  const name=fitGalleryCreatorName(ctx,row.creator,nw,24);
  ctx.fillStyle=theme.ink;ctx.textAlign='start';ctx.textBaseline='middle';ctx.fillText(name.text,nx,70);
  return;
 }
 // Keep text on a solid panel so every motif remains readable on mobile.
 const [tx,ty,tw]=layout.text,[nx,ny,nw]=layout.name;
 ctx.fillStyle=theme.bg;rounded(ctx,tx-3,ty-3,tw+6,57,5);ctx.fill();rounded(ctx,nx-3,ny-2,nw+6,23,5);ctx.fill();
 ctx.textAlign='start';ctx.textBaseline='top';ctx.fillStyle=theme.ink;ctx.font='700 18px system-ui,-apple-system,sans-serif';
 textLines(ctx,row.title,tw,2).forEach((line,i)=>ctx.fillText(line,tx,ty+i*25));
 const name=fitGalleryCreatorName(ctx,row.creator,nw);ctx.fillStyle=theme.muted;ctx.fillText(name.text,nx,ny);
 ctx.fillStyle=theme.panel;rounded(ctx,ix,iy,iw,ih,9);ctx.fill();
 if(thumb){
  const sw=thumb.width||thumb.naturalWidth||1,sh=thumb.height||thumb.naturalHeight||1,scale=Math.max(iw/sw,ih/sh),dw=sw*scale,dh=sh*scale;
  ctx.save();rounded(ctx,ix,iy,iw,ih,9);ctx.clip();ctx.drawImage(thumb,ix+(iw-dw)/2,iy+(ih-dh)/2,dw,dh);ctx.restore();
 }else{
  if(!confirmedGalleryThumbnailMissing(row))throw new Error('記事画像未設定の確認記録がありません');
  // Keep the article's image area blank when no thumbnail is configured.
  // The creator, title, native caption and first-article link stay intact.
 }
 ctx.strokeStyle=theme.line;ctx.lineWidth=2;rounded(ctx,ix,iy,iw,ih,9);ctx.stroke()
}
function drawHistoryCard(ctx,index,row,avatar,thumb){
 const design=historyDesign(index),{layout,theme}=design;
 drawDecor(ctx,index,theme);
 const [ax,ay,ar]=layout.avatar,[tx,ty,tw]=layout.text,[nx,ny,nw]=layout.name,[bx,by]=layout.brand,[ix,iy,iw,ih]=layout.thumb;
 const frame=radius=>layout.shape==='square'?rounded(ctx,ax-radius,ay-radius,radius*2,radius*2,10):circle(ctx,ax,ay,radius);
 // Solid text panels keep every composition legible over its large motif.
 ctx.fillStyle=theme.bg;rounded(ctx,tx-3,ty-3,tw+6,57,5);ctx.fill();rounded(ctx,nx-3,ny-3,nw+6,22,5);ctx.fill();
 ctx.save();ctx.fillStyle=theme.accent;ctx.globalAlpha=.7;
 if(design.layoutIndex===1)ctx.fillRect(288,13,4,H-26);
 else if(design.layoutIndex===2)ctx.fillRect(360,13,4,H-26);
 else{ctx.fillRect(17,78,435,3);ctx.fillRect(532,13,4,H-26)}
 ctx.restore();
 ctx.fillStyle=theme.soft;frame(ar+3);ctx.fill();ctx.strokeStyle=theme.accent;ctx.lineWidth=2;frame(ar+3);ctx.stroke();
 if(avatar){
  const sw=avatar.width||avatar.naturalWidth||1,sh=avatar.height||avatar.naturalHeight||1,scale=Math.max(ar*2/sw,ar*2/sh),dw=sw*scale,dh=sh*scale;
  ctx.save();frame(ar);ctx.clip();ctx.drawImage(avatar,ax-dw/2,ay-dh/2,dw,dh);ctx.restore();
 }else{
  ctx.save();ctx.fillStyle=theme.muted;ctx.font='800 24px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText([...String(row.creator||'n')][0]||'n',ax,ay);ctx.restore();
 }
 ctx.textAlign='start';ctx.textBaseline='top';ctx.fillStyle=theme.ink;ctx.font='700 18px system-ui,-apple-system,sans-serif';
 textLines(ctx,row.title,tw,2).forEach((line,i)=>ctx.fillText(line,tx,ty+i*25));
 const name=fitGalleryCreatorName(ctx,row.creator,nw);ctx.fillStyle=theme.muted;ctx.fillText(name.text,nx,ny);
 ctx.fillStyle=theme.accent;ctx.font='700 12px system-ui,-apple-system,sans-serif';ctx.fillText('note',bx,by);
 ctx.fillStyle=theme.panel;rounded(ctx,ix,iy,iw,ih,8);ctx.fill();ctx.strokeStyle=theme.line;ctx.lineWidth=1;rounded(ctx,ix,iy,iw,ih,8);ctx.stroke();
 if(thumb){
  const sw=thumb.width||thumb.naturalWidth||1,sh=thumb.height||thumb.naturalHeight||1,scale=Math.max(iw/sw,ih/sh),dw=sw*scale,dh=sh*scale;
  ctx.save();rounded(ctx,ix,iy,iw,ih,8);ctx.clip();ctx.drawImage(thumb,ix+(iw-dw)/2,iy+(ih-dh)/2,dw,dh);ctx.restore();
 }
}
function galleryAssetUrl(value,width){
 try{
  const url=new URL(String(value||''));
  if(url.protocol==='https:'&&url.hostname==='assets.st-note.com'){
   const current=Number(url.searchParams.get('width'));
   url.searchParams.set('width',String(current>0?Math.min(current,width):width));
   return url.href;
  }
 }catch{}
 return value;
}
async function makeFile(row){
 const profileOnly=confirmedGalleryProfileOnly(row);
 if(row.profileOnly===true&&!profileOnly){const error=new Error('公開記事なしの参加者確認記録が一致しません');error.code='PROFILE_ONLY_UNVERIFIED';throw error;}
 const avatarRequired=Boolean(mediaUrl(row.actorImageUrl)),thumbnailMissing=profileOnly||confirmedGalleryThumbnailMissing(row);
 const avatarSource=row.gallery126?galleryAssetUrl(row.actorImageUrl,180):row.actorImageUrl,thumbSource=row.gallery126?galleryAssetUrl(row.thumbUrl,720):row.thumbUrl;
 const images=await Promise.allSettled([avatarRequired?bitmapFromUrl(avatarSource):Promise.resolve(null),thumbnailMissing?Promise.resolve(null):bitmapFromUrl(thumbSource)]);
 const [avatar,thumb]=images.map(result=>result.status==='fulfilled'?result.value:null);
 const avatarUnavailable=avatarRequired&&!avatar;
 if(avatarUnavailable||!thumb&&!thumbnailMissing){
  try{avatar?.close?.();thumb?.close?.()}catch{}
  const reason=images.find(result=>result.status==='rejected')?.reason?.message;
  const error=new Error(row.creator+'さん：'+(avatarUnavailable?'アイコン':'記事サムネイル')+'を表示できません'+(reason?'（'+reason+'）':''));
  error.code='ASSET_UNAVAILABLE';throw error;
 }
 const limit=row.gallery126===true?126:HISTORY_DESIGN_COUNT;
 const index=Number.isInteger(row.designIndex)&&row.designIndex>=0&&row.designIndex<limit?row.designIndex:assignDesigns([row])[0].designIndex;
 const theme=palettes[Math.floor(index/10)%palettes.length];
 const canvas=document.createElement('canvas');
 canvas.width=W;canvas.height=H;
 const ctx=canvas.getContext('2d');
 if(row.gallery126===true){drawGalleryCard(ctx,index,row,avatar,thumb)}else if(index>=50){drawHistoryCard(ctx,index,row,avatar,thumb)}else{
 drawDecor(ctx,index,theme);

 const ax=50,ay=70,ar=34;
 ctx.fillStyle=theme.soft;circle(ctx,ax,ay,ar+3);ctx.fill();
 ctx.strokeStyle=theme.accent;ctx.lineWidth=2;circle(ctx,ax,ay,ar+3);ctx.stroke();
 if(avatar){
  const iw=avatar.width||avatar.naturalWidth||1,ih=avatar.height||avatar.naturalHeight||1;
  const scale=Math.max((ar*2)/iw,(ar*2)/ih),dw=iw*scale,dh=ih*scale;
  ctx.save();circle(ctx,ax,ay,ar);ctx.clip();ctx.drawImage(avatar,ax-dw/2,ay-dh/2,dw,dh);ctx.restore()
 }else{
  ctx.fillStyle=theme.muted;ctx.font='800 24px system-ui';ctx.textAlign='center';
  ctx.fillText([...String(row.creator||'n')][0]||'n',ax,62);ctx.textAlign='start'
 }

 const tx=100,tw=455;
 ctx.textBaseline='top';ctx.fillStyle=theme.ink;ctx.font='700 18px system-ui,-apple-system,sans-serif';
 textLines(ctx,row.title,tw,2).forEach((line,i)=>ctx.fillText(line,tx,18+i*25));
 ctx.fillStyle=theme.muted;ctx.font='700 14px system-ui,-apple-system,sans-serif';
 ctx.fillText(fit(ctx,row.creator+'さん',tw),tx,86);
 ctx.fillStyle=theme.accent;ctx.font='700 12px system-ui,-apple-system,sans-serif';ctx.fillText('note',tx,110);

 const ix=590,iy=8,iw=262,ih=124;
 ctx.fillStyle=theme.panel;rounded(ctx,ix,iy,iw,ih,8);ctx.fill();
 ctx.strokeStyle=theme.line;ctx.lineWidth=1;rounded(ctx,ix,iy,iw,ih,8);ctx.stroke();
 if(thumb){
  const sw=thumb.width||thumb.naturalWidth||1,sh=thumb.height||thumb.naturalHeight||1;
  const scale=Math.max(iw/sw,ih/sh),dw=sw*scale,dh=sh*scale;
  ctx.save();rounded(ctx,ix,iy,iw,ih,8);ctx.clip();
  ctx.drawImage(thumb,ix+(iw-dw)/2,iy+(ih-dh)/2,dw,dh);ctx.restore()
 }else{
  ctx.fillStyle=theme.muted;ctx.font='800 24px system-ui';ctx.textAlign='center';ctx.fillText('note',ix+iw/2,55);ctx.textAlign='start'
 }

 }
 try{avatar?.close?.()}catch{}
 try{if(thumb!==avatar)thumb?.close?.()}catch{}
 const blob=await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('画像生成失敗')),'image/png',1));
 return new page.File([blob],'mumei_profile_note_v22_'+String(row.index).padStart(3,'0')+'.png',{type:'image/png'})
}

function headingText(group,count=300){
 const from=group*10+1,to=Math.min(from+9,count);
 return String(group+1).padStart(2,'0')+'｜'+from+'人目〜'+to+'人目のクリエイター様'
}
function refreshHistoryHeadings(view,count){
 const run=readRun();if(!run)return;
 const known=new Set(run.sectionHeadings||[]),changes=[];
 view.state.doc.descendants((node,pos)=>{
  if(node.type?.name!=='heading'||!known.has(String(node.textContent||'')))return;
  const match=String(node.textContent||'').match(/^(\d+)｜\d+人目〜\d+人目のクリエイター様$/);
  if(!match)return;
  const group=Number(match[1])-1,text=group*10+1>count?'':headingText(group,count);
  if(text!==node.textContent)changes.push({node,pos,text});
 });
 if(!changes.length)return;
 let tr=view.state.tr;
 for(const {node,pos,text} of changes.sort((first,second)=>second.pos-first.pos))tr=text?tr.replaceWith(pos,pos+node.nodeSize,node.type.create(node.attrs,view.state.schema.text(text),node.marks)):tr.delete(pos,pos+node.nodeSize);
 view.dispatch(tr);
 const replacements=new Map(changes.map(({node,text})=>[String(node.textContent),text]));
 writeRun({...run,sectionHeadings:(run.sectionHeadings||[]).map(text=>replacements.has(text)?replacements.get(text):text).filter(Boolean),updatedAt:Date.now()});
 return tr.mapping;
}
function galleryProfileGraphemes(value){
 const text=String(value??'');
 if(typeof Intl?.Segmenter==='function')return Array.from(new Intl.Segmenter('ja',{granularity:'grapheme'}).segment(text),part=>part.segment);
 const parts=[];
 for(const char of Array.from(text)){
  const previous=parts[parts.length-1]||'',code=char.codePointAt(0),regional=code>=0x1f1e6&&code<=0x1f1ff;
  if(previous&&(/\p{Mark}/u.test(char)||char==='\u200d'||previous.endsWith('\u200d')||code>=0xfe00&&code<=0xfe0f||code>=0x1f3fb&&code<=0x1f3ff||regional&&Array.from(previous).length===1&&previous.codePointAt(0)>=0x1f1e6&&previous.codePointAt(0)<=0x1f1ff))parts[parts.length-1]+=char;
  else parts.push(char);
 }
 return parts;
}
// Rounded-up KaTeX Main-Regular advances for printable ASCII. CJK fallback
// glyphs use one em; the two literal quote characters rendered by \verb use
// its wider monospace advance. Unlike a flat ASCII estimate, this also budgets
// wide W/m characters and real URL punctuation before choosing a font size.
const galleryProfileAsciiWidths=[.25,.28,.5,.84,.5,.84,.78,.53,.39,.39,.5,.78,.28,.34,.28,.5,.5,.5,.5,.5,.5,.5,.5,.5,.5,.5,.28,.28,.78,.78,.78,.48,.78,.75,.71,.73,.77,.69,.66,.79,.75,.37,.52,.78,.63,.92,.75,.78,.69,.78,.74,.56,.73,.75,.75,1.03,.75,.75,.62,.28,.5,.28,.5,.5,.53,.5,.56,.45,.56,.45,.31,.5,.56,.28,.31,.53,.28,.84,.56,.5,.56,.53,.4,.4,.39,.56,.53,.73,.53,.53,.45,.5,.28,.5,.5];
function galleryProfileWidth(value){
 return galleryProfileGraphemes(value).reduce((sum,part)=>sum+(part==='\t'?1:part.length===1&&part.charCodeAt(0)>=32&&part.charCodeAt(0)<=126?galleryProfileAsciiWidths[part.charCodeAt(0)-32]:/^[\uff61-\uff9f]$/.test(part)?.55:1),0);
}
const galleryProfileNoStart=/^[、。，．・：；？！ー…‥）〕］｝〉》」』】〙〗〟’”｠»ヽヾ々〻ゝゞぁぃぅぇぉっゃゅょゎゕゖァィゥェォッャュョヮヵヶ,.:;!?\)\]\}]/u;
const galleryProfileNoEnd=/[（〔［｛〈《「『【〘〖〝‘“｟«\(\[\{]$/u;
function galleryProfileKinsoku(units){
 const chunks=[];
 for(const unit of units){
  const previous=chunks[chunks.length-1];
  if(previous&&(galleryProfileNoStart.test(unit)||galleryProfileNoEnd.test(previous)))chunks[chunks.length-1]+=unit;
  else chunks.push(unit);
 }
 return chunks;
}
function galleryProfileBudgetChunks(value){
 // Preserve the established font selection: only a whole URL or a forbidden
 // line-break pair can trigger tiny, never the semantic wrapping preferences.
 const units=[],text=String(value??''),urls=/https?:\/\/[^\s\u3000<>「」『』《》【】（）〔〕［］｛｝]+/giu;
 let offset=0;
 for(const match of text.matchAll(urls)){
  units.push(...galleryProfileGraphemes(text.slice(offset,match.index)),match[0]);
  offset=match.index+match[0].length;
 }
 units.push(...galleryProfileGraphemes(text.slice(offset)));
 return galleryProfileKinsoku(units);
}
function galleryProfileChunks(value,maxWidth=Infinity){
 const units=[],text=String(value??''),protectedWords=/https?:\/\/[^\s\u3000<>「」『』《》【】（）〔〕［］｛｝]+|[\p{Script=Latin}\p{Mark}\p{Number}_]+(?:[+.'’/\-][\p{Script=Latin}\p{Mark}\p{Number}_]+)*(?:\+\+|#)?/giu;
 const kind=part=>/^[\p{Script=Han}々〆ヵヶ]+$/u.test(part)?'han':/^[\p{Script=Han}々〆ヵヶ]+[\p{Script=Hiragana}\p{Mark}ー]+$/u.test(part)?'inflected':/^[\p{Script=Hiragana}\p{Mark}ー]+$/u.test(part)?'hiragana':/^[\p{Script=Katakana}\p{Mark}ー・\uff9e\uff9f]+$/u.test(part)?'katakana':/^\s+$/u.test(part)?'space':'other';
 const append=(part,type=kind(part))=>{
  const previous=units[units.length-1];
  // Build the same script runs and inflections on every device. Mobile ICU
  // versions can return an entire Japanese clause as one word, so those
  // spans must not become indivisible units. Keep ITエンジニア together too.
  if(previous&&(type==='han'&&previous.kind==='han'||type==='hiragana'&&['han','inflected','hiragana','katakana','latin'].includes(previous.kind)&&!/(?:ので|けれど|けど|ですが|ながら|ならば|そして|または)$/u.test(previous.text)||type==='katakana'&&['katakana','latin'].includes(previous.kind)||type==='space'&&previous.kind==='space')){
   previous.text+=part;previous.parts.push(part);
   previous.kind=type==='hiragana'&&previous.kind!=='hiragana'?'inflected':type;
  }else units.push({text:part,kind:type,parts:[part]});
 };
 const words=fragment=>{
  for(const part of galleryProfileGraphemes(fragment)){
   const previous=units[units.length-1];
   append(part,part==='ー'&&previous&&['katakana','latin'].includes(previous.kind)?'katakana':kind(part));
  }
 };
 let offset=0;
 for(const match of text.matchAll(protectedWords)){
  words(text.slice(offset,match.index));
  append(match[0],/^https?:\/\//i.test(match[0])?'url':'latin');
  offset=match.index+match[0].length;
 }
 words(text.slice(offset));
 const bounded=[];
 for(const [index,unit] of units.entries()){
  // Use word boundaries only as optional hints for an unusually long Kanji
  // run, after deterministic grouping. Ordinary Japanese wrapping never
  // depends on a browser's word dictionary. URLs/Latin/Katakana stay whole.
  // Reserve the surrounding forbidden-break punctuation before fitting a
  // Kanji run. Adding a closing quote/full stop afterwards must not turn an
  // exactly-full line into an oversized indivisible group.
  let reserve=0;
  for(let before=index-1;before>=0&&galleryProfileNoEnd.test(units[before].text);before--)reserve+=galleryProfileWidth(units[before].text);
  for(let after=index+1;after<units.length&&galleryProfileNoStart.test(units[after].text);after++)reserve+=galleryProfileWidth(units[after].text);
  const budget=Math.max(1,maxWidth-reserve);
  if(unit.kind==='han'&&unit.parts.length>1&&typeof Intl?.Segmenter==='function'&&galleryProfileWidth(unit.text)>budget){
   const parts=Array.from(new Intl.Segmenter('ja',{granularity:'word'}).segment(unit.text),part=>part.segment);
   let phrase='';
   for(const word of parts){if(phrase&&galleryProfileWidth(phrase+word)>budget){bounded.push(phrase);phrase=''}phrase+=word}
   if(phrase)bounded.push(phrase);
  }else bounded.push(unit.text);
 }
 return galleryProfileKinsoku(bounded);
}
function galleryProfileSemanticParts(value,maxWidth){
 const text=String(value??''),chunks=galleryProfileChunks(text,maxWidth),sentenceEnds=new Set();
 if(typeof Intl?.Segmenter==='function')for(const part of new Intl.Segmenter('ja',{granularity:'sentence'}).segment(text))sentenceEnds.add(part.index+part.segment.length);
 const terminal=/[。！？!?][\s）〕］｝〉》」』】’”\)\]\}]*$/u,clause=/[、，,；;：:][\s）〕］｝〉》」』】’”\)\]\}]*$/u;
 const sentences=[];
 let offset=0,sentence=[];
 for(const chunk of chunks){
  sentence.push(chunk);offset+=chunk.length;
  if(sentenceEnds.has(offset)||terminal.test(chunk)){sentences.push(sentence);sentence=[]}
 }
 if(sentence.length)sentences.push(sentence);
 const parts=[];
 for(const words of sentences){
  if(galleryProfileWidth(words.join(''))<=maxWidth+.00001){parts.push(words.join(''));continue}
  let phrase=[];
  const flush=()=>{if(!phrase.length)return;const whole=phrase.join('');parts.push(...(galleryProfileWidth(whole)<=maxWidth+.00001?[whole]:phrase));phrase=[]};
  for(const word of words){phrase.push(word);if(clause.test(word))flush()}
  flush();
 }
 return parts;
}
function galleryProfileLines(value,maxWidth=16,allowWide=false){
 const lines=[];
 for(const original of String(value??'').replace(/\r\n?/g,'\n').split('\n')){
  const start=lines.length;
  let line='',used=0;
  for(const part of galleryProfileSemanticParts(original,maxWidth)){
   const size=galleryProfileWidth(part);
   if(size>maxWidth+.00001){
    if(!allowWide)throw new Error('プロフィールに表示幅を超える単語またはURLがあります。全文を保ったまま表示幅を確認してください');
    // Keep an exceptionally long URL/word intact on its own smallest-font
    // row. A layout preference must not discard a creator or truncate text.
    if(line){lines.push(line);line='';used=0}
    lines.push(part);continue;
   }
   if(line&&used+size>maxWidth+.00001){lines.push(line);line='';used=0}
   line+=part;used+=size;
  }
  if(line||!original||lines.length===start)lines.push(line);
 }
 return lines;
}
function galleryProfileLayout(value){
 // At scriptsize, sixteen CJK em plus array margins leaves room on a phone.
 // A whole URL stays in one row. Only profiles whose indivisible URL/bracket
 // group needs extra room use tiny (0.5/0.7 of scriptsize), never truncation.
 const text=String(value??''),widest=Math.max(0,...text.replace(/\r\n?/g,'\n').split('\n').flatMap(line=>galleryProfileBudgetChunks(line).map(galleryProfileWidth)));
 const tiny=widest>16,font=tiny?'tiny':'scriptsize',maxWidth=tiny?22.4:16;
 return{font,maxWidth,lines:galleryProfileLines(text,maxWidth)};
}
function escapeGalleryProfileTex(value){
 const escapes={'\\':'\\textbackslash{}','{':'\\{','}':'\\}','$':'\\$','&':'\\&','#':'\\#','%':'\\%','_':'\\_','^':'\\textasciicircum{}','~':'\\textasciitilde{}','\t':'\\quad ',' ':'\\space ','`':'\\verb+`+',"'":"\\verb+'+"};
 // Raw combining marks can become unsupported TeX accents; Unicode double
 // punctuation can expand to math-only macros even inside \text. \char keeps
 // every original code point while bypassing both implicit transformations.
 // {} terminates its hexadecimal argument without adding a visible character.
 return Array.from(String(value??''),char=>{
  if(Object.prototype.hasOwnProperty.call(escapes,char))return escapes[char];
  // note processes ruby syntax (｜base《reading》) before KaTeX. Encode its
  // delimiters as well, including the ASCII bar, so a biography stays literal.
  if(/[‼⁇⁈⁉｜|《》-]|\p{Mark}/u.test(char)||char.normalize('NFD')!==char)return'\\char"'+char.codePointAt(0).toString(16).toUpperCase()+'{}';
  return char;
 }).join('');
}
function historyProfileLayout(value){
 const text=String(value??''),widest=Math.max(0,...text.replace(/\r\n?/g,'\n').split('\n').flatMap(line=>galleryProfileChunks(line,16).map(galleryProfileWidth)));
 const tiny=widest>16,font=tiny?'tiny':'scriptsize',maxWidth=tiny?22.4:16;
 return{font,maxWidth,lines:galleryProfileLines(text,maxWidth,true)};
}
function compactHistoryRows(rows){return rows.map(row=>row.finalMarker?row:{...row,profileLayout:'compact-v272'})}
function activityText(row){
 const text='プロフィール｜'+row.creator+'さん：'+(row.profileText||'プロフィール未設定');
 if(!row.gallery126&&row.profileLayout!=='compact-v272')return text;
 // note accepts $${...}$$ in an ordinary paragraph. Keep a single source string
 // so saved activityTexts can identify this exact profile when resuming/resetting.
 const layout=row.gallery126?galleryProfileLayout(text):historyProfileLayout(text),lines=layout.lines.map(line=>'\\text{'+escapeGalleryProfileTex(line)+'}');
 return'$${\\'+layout.font+'\\begin{array}{l}'+lines.join('\\\\')+'\\end{array}}$$';
}
function insertHeadingAt(view,text,pos){
 const type=view.state.schema.nodes.heading;
 if(!type)throw new Error('note見出しノードを取得できません');
 const at=Math.max(0,Math.min(view.state.doc.content.size,Number(pos)||0));
 let node;
 try{node=type.create({level:2},view.state.schema.text(text))}
 catch{node=type.create(null,view.state.schema.text(text))}
 view.dispatch(view.state.tr.insert(at,node));
 const actual=view.state.doc.nodeAt(at);
 if(!actual||actual.type?.name!=='heading'||String(actual.textContent||'')!==text)throw new Error('見出し挿入に失敗しました');
 return{pos:at,nextPos:at+actual.nodeSize}
}
function insertActivityAt(view,row,pos){
 const type=view.state.schema.nodes.paragraph;
 if(!type)throw new Error('note段落を取得できません');
 const at=Math.max(0,Math.min(view.state.doc.content.size,Number(pos)||0));
 const text=activityText(row);
 const small=!row.gallery126&&row.profileLayout!=='compact-v272'&&view.state.schema.marks?.small;
 const marks=small?[small.create()]:[];
 const node=type.create(null,view.state.schema.text(text,marks));
 view.dispatch(view.state.tr.insert(at,node));
 const actual=view.state.doc.nodeAt(at);
 if(!actual||actual.type?.name!=='paragraph'||String(actual.textContent||'')!==text)throw new Error('プロフィールテキスト挿入に失敗しました');
 return{text,pos:at,nextPos:at+actual.nodeSize}
}
function dividerType(view){
 const nodes=view.state.schema.nodes;
 for(const name of ['horizontal_rule','horizontalRule','horizontal-rule','divider','separator','hr'])if(nodes[name])return nodes[name];
 for(const type of Object.values(nodes)){try{const node=type.createAndFill?.();const dom=node&&type.spec?.toDOM?.(node);if(Array.isArray(dom)&&dom[0]==='hr')return type;}catch{}}
 return null;
}
function isDivider(view,node){return !!node&&(node.type===dividerType(view)||node.type?.name==='paragraph'&&node.textContent==='────────────');}
function addDivider(view,hit,row){
 const pos=hit.pos+hit.node.nodeSize,existing=view.state.doc.nodeAt(pos);
 if(isDivider(view,existing))return pos+existing.nodeSize;
 const type=dividerType(view),node=type?(type.createAndFill?.()||type.create()):view.state.schema.nodes.paragraph.create(null,view.state.schema.text('────────────'));
 view.dispatch(view.state.tr.insert(pos,node));
 const run=readRun();if(run)writeRun({...run,dividerUrls:[...new Set([...(run.dividerUrls||[]),row.url])]});
 return pos+node.nodeSize;
}
function clearCurrentPaste(view,run){
 if(!run?.likesHistoryFix230)return 0;
 const images=ownedImages(view),hits=[...images],dividerUrls=new Set(run.dividerUrls||[]);
 for(const image of images){if(!dividerUrls.has(String(image.node.attrs?.link||'')))continue;const pos=image.pos+image.node.nodeSize,node=view.state.doc.nodeAt(pos);if(isDivider(view,node))hits.push({node,pos});}
 const texts=new Set(run.activityTexts||[]),headings=new Set(run.sectionHeadings||[]),keys=new Set((run.cardKeys||[]).map(card=>typeof card==='string'?card:String(card.key||''))),anchor=Math.max(0,Number(run.imageAnchorPos)||0);
 view.state.doc.descendants((node,pos)=>{
  if(pos<anchor)return;
  if(node.type?.name==='paragraph'&&texts.has(String(node.textContent||'')))hits.push({node,pos});
  if(node.type?.name==='heading'&&headings.has(String(node.textContent||'')))hits.push({node,pos});
  if(node.type?.name==='embed'&&keys.has(cardKey({node,pos})))hits.push({node,pos});
 });
 return deleteHits(view,hits);
}
async function restartFixed300(){
 if(busy||exportWaiter||coreBusy()){setStatus('実行中です。先に「停止」を押してください',true);return;}
 try{
  await Promise.all([hydrateRunBackup(),hydratePrepBackup()]);
  const options=historyOptions(),run=readRun();
  if(run?.likesHistoryFix230&&Array.isArray(run.rows)&&run.rows.length>1){
   validateFixedRows(run.rows);
   const view=findView();if(!view){setStatus('note本文編集欄を取得できません',true);return;}
   const previous=historyOptions(run),same=previous.mode===options.mode&&(options.mode==='all'||previous.count===options.count);
   let rows=run.rows;
   if(!same){
    await prepareInsightExport(options);
    const creators=await buildRows(options.target);
    rows=validateFixedRows([...creators,await enrichFinal(creators.length+1)]);
   }
   rows=compactHistoryRows(rows);
   clearCurrentPaste(view,run);
   writeRun({...run,version:VERSION,mode:options.mode,count:rows.length-1,historyRequestedCount:options.mode==='number'?options.count:null,rows,items:[],cardKeys:[],sectionHeadings:[],activityTexts:[],dividerUrls:[],stage:'images_building',imageAnchorPos:Math.min(view.state.doc.content.size,Math.max(0,Number(run.imageAnchorPos)||0)),cardBaselineKeys:embedNodes(view).map(cardKey).filter(Boolean),createdAt:Date.now()});
   return createFixed300();
  }
  return startFixed300(options);
 }catch(error){setStatus('取得停止：'+(error?.message||String(error)),true);}
}
async function resumeFixed300(){
 if(busy||exportWaiter||coreBusy()){setStatus('実行中です。先に「停止」を押してください',true);return;}
 try{
  await Promise.all([hydrateRunBackup(),hydratePrepBackup()]);
  const run=readRun();
  if(run?.pauseStage==='cards'&&!galleryNeedsParticipantUpgrade(run)&&typeof page.__MUMEI_PROFILE_CARD_CREATE_CARDS_AT_TAP__==='function')return page.__MUMEI_PROFILE_CARD_CREATE_CARDS_AT_TAP__();
  if(!run?.gallery126&&run?.coreImageRun&&typeof page.__MUMEI_PROFILE_CARD_RESUME_CORE_IMAGES__==='function')return page.__MUMEI_PROFILE_CARD_RESUME_CORE_IMAGES__();
  if(run?.items?.length||run?.rows?.length)return createFixed300();
  const bridge=await Promise.resolve(GM_getValue(BRIDGE_KEY,null));
  if(!Array.isArray(bridge?.people)||!bridge.people.length){setStatus('読み込みの続きがありません。「① 最初から」でスキ履歴を取得してください',true);return;}
  let saved;saved=readPrep()
  setStatus('読み込みの続きから｜確認済み '+(saved?.rows?.length||0)+'人｜取得できない人は飛ばします');
  return createFixed300(checkpointHistoryOptions(saved));
 }catch(error){setStatus('読み込み再開停止：'+(error?.message||String(error)),true);}
}
function findHeading(view,text){
 let hit=null;
 view.state.doc.descendants((node,pos)=>{if(!hit&&node.type?.name==='heading'&&String(node.textContent||'')===text)hit={node,pos}});
 return hit
}
function findActivity(view,text,minPos=0){
 let hit=null;
 view.state.doc.descendants((node,pos)=>{
  if(!hit&&pos>=minPos&&node.type?.name==='paragraph'&&String(node.textContent||'')===text)hit={node,pos}
 });
 return hit
}
function recordHeading(text){
 const run=readRun();if(!run)return;
 const list=Array.isArray(run.sectionHeadings)?run.sectionHeadings:[];
 if(!list.includes(text))list.push(text);
 writeRun({...run,sectionHeadings:list,updatedAt:Date.now()})
}
function recordActivity(text){
 const run=readRun();if(!run)return;
 const list=Array.isArray(run.activityTexts)?run.activityTexts:[];
 list.push(text);
 writeRun({...run,activityTexts:list,updatedAt:Date.now()})
}
function recordImage(hit,row){
 const run=readRun()||{version:VERSION,articleKey:editorArticleKey(),items:[],createdAt:Date.now()};
 const record={id:String(hit?.node?.attrs?.id||''),src:String(hit?.node?.attrs?.src||''),url:norm(row.url),creator:String(row.creator||''),at:Date.now()};
 const items=Array.isArray(run.items)?run.items:[];
 const key=item=>String(item.id||'')+'|'+String(item.src||'')+'|'+norm(item.url);
 if(!items.some(item=>key(item)===key(record)))items.push(record);
 writeRun({...run,version:VERSION,articleKey:editorArticleKey(),items,updatedAt:Date.now()})
}
function ownedImages(view){return ownedImagesForRun(view,readRun())}
function ownedImagesForRun(view,run){
 const records=Array.isArray(run?.items)?run.items:[],all=imageNodes(view),owned=new Map();
 for(const record of records){
  const byId=record.id?all.find(x=>String(x.node.attrs?.id||'')===String(record.id)):null;
  if(byId&&norm(byId.node.attrs?.link)===norm(record.url)){owned.set(byId.pos,byId);continue}
  if(record.src){
   const matches=all.filter(x=>String(x.node.attrs?.src||'')===String(record.src)&&norm(x.node.attrs?.link)===norm(record.url));
   if(matches.length===1)owned.set(matches[0].pos,matches[0])
  }
 }
 return[...owned.values()].sort((a,b)=>a.pos-b.pos)
}
function deleteHits(view,hits){
 const unique=[...new Map((hits||[]).map(hit=>[hit.pos,hit])).values()].sort((a,b)=>b.pos-a.pos);
 if(!unique.length)return 0;
 let tr=view.state.tr;
 for(const hit of unique){
  const node=view.state.doc.nodeAt(hit.pos);
  if(node)tr=tr.delete(hit.pos,hit.pos+node.nodeSize)
 }
 view.dispatch(tr);
 return unique.length
}
function removeActivityLines(){
 const view=findView(),run=readRun();
 if(!view||!Array.isArray(run?.activityTexts)||!run.activityTexts.length)return;
 const wanted=new Set(run.activityTexts),hits=[];
 view.state.doc.descendants((node,pos)=>{if(node.type?.name==='paragraph'&&wanted.has(String(node.textContent||'')))hits.push({node,pos})});
 deleteHits(view,hits)
}

function galleryManifest(){
 const manifest=page.__MUMEI_PROFILE_CARD_GALLERY_MANIFEST__;
 const api=page.__MUMEI_PROFILE_CARD_GALLERY__;
 if(!manifest||!api)throw new Error('ハロウィン126人の一覧を読み込めません。最新版へ更新してください');
 api.validateParticipants(manifest.people,126);
 return manifest;
}
function galleryNeedsParticipantUpgrade(run){
 const creators=Array.isArray(run?.rows)?run.rows.filter(row=>!row?.finalMarker):[];
 return Boolean(run?.gallery126&&creators.length===125&&(run.galleryAvailableOnly||creators.every(row=>row.galleryAvailableOnly===true)));
}
function galleryImagePlan(view,run,rows=run.rows){
 const byUrl=new Map(rows.map((row,index)=>[norm(row.url),index])),entries=[],byIndex=new Map();let previous=-1;
 if(byUrl.size!==rows.length)throw new Error('ハロウィン画像のリンクに重複があります');
 const images=ownedImagesForRun(view,run),records=Array.isArray(run.items)?run.items:[];
 if(images.length!==records.length)throw new Error('画像の保存記録と本文の件数が一致しません。欠けた画像を確認してください');
 const upgrade=run.galleryParticipantUpgrade,allowed=new Set(upgrade?.fromCount===125&&Array.isArray(upgrade.addedParticipantUrls)?upgrade.addedParticipantUrls.map(norm).filter(url=>rows.some(row=>norm(row.url)===url&&galleryKnownNoArticle(canonicalUrlname(row)))):[]);
 let expected=0;
 for(const hit of images){
  const index=byUrl.get(norm(hit.node.attrs?.link));
  if(index===undefined||index<=previous||byIndex.has(index))throw new Error('ハロウィン画像の人物・順序が保存記録と一致しません');
  while(expected<index&&allowed.has(norm(rows[expected].url)))expected++;
  if(index!==expected)throw new Error('追加対象以外の画像に不足・順序の変更があります。本文は保持しました');
  expected=index+1;
  const row=rows[index];
  if(String(hit.node.textContent||'').trim()!==row.creator+'さん')throw new Error((index+1)+'人目のキャプションが一致しません');
  const entry={index,row,hit};entries.push(entry);byIndex.set(index,entry);previous=index;
 }
 return{entries,byIndex};
}
function galleryProfileMap(run){
 if(run.galleryProfileTexts&&typeof run.galleryProfileTexts==='object'&&!Array.isArray(run.galleryProfileTexts))return{...run.galleryProfileTexts};
 const rows=(run.rows||[]).filter(row=>!row.finalMarker),saved=run.activityTexts||[];
 if(!Array.isArray(saved)||saved.length>rows.length)throw new Error('プロフィールの保存記録を確認できません');
 return Object.fromEntries(saved.map((text,index)=>[norm(rows[index].url),String(text)]));
}
function recordGalleryActivity(row,text){
 const run=readRun();if(!run?.gallery126)throw new Error('プロフィールの作成記録を確認できません');
 const records=galleryProfileMap(run);records[norm(row.url)]=text;
 writeRun({...run,galleryProfileTexts:records,activityTexts:run.rows.filter(person=>!person.finalMarker&&Object.prototype.hasOwnProperty.call(records,norm(person.url))).map(person=>records[norm(person.url)]),updatedAt:Date.now()});
}
async function upgradeGalleryParticipants(view,run){
 if(!galleryNeedsParticipantUpgrade(run))return run;
 validateGalleryRows(run.rows);assertGalleryTracking(view,run);
 const oldRows=run.rows.filter(row=>!row.finalMarker),oldImages=ownedImagesForRun(view,run);
 completedImagePrefix(run.rows,oldImages);
 if(oldImages.length&&(oldRows.some(row=>!Number.isInteger(row.designIndex)||row.designIndex<0||row.designIndex>=126)||new Set(oldRows.map(row=>row.designIndex)).size!==oldRows.length))throw new Error('既存125人のデザイン記録が一致しません。画像は保持しました');
 const manifest=galleryManifest(),existing=new Map(oldRows.map(row=>[canonicalUrlname(row),row])),beforeDoc=view.state.doc,rows=[];
 for(let index=0;index<manifest.people.length;index++){
  const person=manifest.people[index],old=existing.get(person.urlname.toLowerCase());
  if(old){const{galleryAvailableOnly,gallerySourceIndex,...kept}=old;rows.push({...kept,index:index+1})}
  else rows.push(await prepareGalleryPerson(person,index));
 }
 if(stopRequested)throw new Error('停止しました');
 if(view.state.doc!==beforeDoc&&!view.state.doc.eq?.(beforeDoc))throw new Error('追加の確認中に本文が変更されました。完成分は保持しています。「再開」で照合してください');
 const final=run.rows.at(-1)?.finalMarker?{...run.rows.at(-1),index:127}:null;
 const complete=validateGalleryRows(final?[...rows,final]:rows),profiles=galleryProfileMap(run);
 const addedParticipantUrls=rows.filter(row=>!existing.has(canonicalUrlname(row))).map(row=>row.url);
 const upgraded={...run,rows:complete,count:126,galleryAvailableOnly:false,pendingPeople:[],galleryProfileTexts:profiles,stage:'images_building',galleryParticipantUpgrade:{fromCount:125,headingSourceCount:125,addedParticipantUrls,pendingHeadings:true,previousPauseStage:run.pauseStage||null,preparedAt:new Date().toISOString()},updatedAt:Date.now()};
 writeRun(upgraded);await flushRunBackup();return readRun();
}
function repairGalleryProfileParagraphs(view,run,rows=run.rows,anchors=null){
 if(!run?.gallery126||run.articleKey!==editorArticleKey())throw new Error('この記事のハロウィン作成記録を確認できません');
 const plan=galleryImagePlan(view,run,rows),saved=galleryProfileMap(run),known=new Set(rows.filter(row=>!row.finalMarker).map(row=>norm(row.url)));
 if(Object.keys(saved).some(url=>!known.has(url)))throw new Error('プロフィールの保存記録に別の人物が含まれています');
 const paragraphs=[];
 view.state.doc.descendants((node,pos)=>{if(node.type?.name==='paragraph')paragraphs.push({node,pos})});
 const replacements=[],texts={};let mapping=null;
 // Match both exact saved source and its replacement, so interruption between
 // the native transaction and checkpoint cannot duplicate or lose a profile.
 for(let i=0;i<rows.length;i++){
  const row=rows[i];if(row.finalMarker)continue;
  const url=norm(row.url),own=plan.byIndex.get(i),record=Object.prototype.hasOwnProperty.call(saved,url);
  if(!record){if(own)throw new Error((i+1)+'人目のプロフィール保存記録がありません。本文は保持しました');continue}
  const earlier=plan.entries.filter(entry=>entry.index<i).at(-1),nextImage=plan.entries.find(entry=>entry.index>=i);
  const from=earlier?earlier.hit.pos+earlier.hit.node.nodeSize:Math.max(0,Number(run.imageAnchorPos)||0);
  const to=nextImage?nextImage.hit.pos:view.state.doc.content.size;
  const next=activityText(row),matches=paragraphs.filter(hit=>hit.pos>=from&&hit.pos<to&&(String(hit.node.textContent||'')===saved[url]||String(hit.node.textContent||'')===next));
  if(matches.length!==1)throw new Error((i+1)+'人目のプロフィールを一意に照合できません。手編集と画像は保持しました');
  const hit=matches[0];texts[url]=next;
  if(String(hit.node.textContent||'')!==next)replacements.push({...hit,text:next});
 }
 if(replacements.length){
  let tr=view.state.tr;
  for(const {node,pos,text} of replacements.sort((first,second)=>second.pos-first.pos))tr=tr.replaceWith(pos,pos+node.nodeSize,node.type.create(node.attrs,view.state.schema.text(text),node.marks));
  view.dispatch(tr);mapping=tr.mapping;
 }
 if(mapping&&anchors&&Number.isFinite(Number(anchors.tappedAnchor)))anchors.tappedAnchor=mapping.map(Number(anchors.tappedAnchor),1);
 const hasCardAnchor=run.cardAnchorPos!=null&&run.cardAnchorPos!==''&&Number.isFinite(Number(run.cardAnchorPos));
 writeRun({...run,rows,galleryProfileTexts:texts,activityTexts:rows.filter(row=>!row.finalMarker&&Object.prototype.hasOwnProperty.call(texts,norm(row.url))).map(row=>texts[norm(row.url)]),...(mapping&&hasCardAnchor?{cardAnchorPos:mapping.map(Number(run.cardAnchorPos),1)}:{}),profileLayoutVersion:VERSION,updatedAt:Date.now()});
 return replacements.length;
}
async function repairGalleryProfiles(){
 if(busy||exportWaiter||coreBusy()){setStatus('実行中です。先に「停止」を押してください',true);return;}
 busy=true;stopRequested=false;pauseRequested=false;notifyFixedState();
 try{
  await hydrateRunBackup();
  const run=readRun();
  if(!run?.gallery126)throw new Error('この記事のハロウィン作成記録がありません');
  const view=findView();if(!view)throw new Error('note本文編集欄を取得できません');
  const rows=validateGalleryRows(run.rows);
  assertGalleryTracking(view,run);
  if(stopRequested)throw new Error('停止しました');
  const count=repairGalleryProfileParagraphs(view,run,rows);
  await flushRunBackup();
  if(typeof page.__MUMEI_PROFILE_CARD_SAVE_DRAFT__==='function')await page.__MUMEI_PROFILE_CARD_SAVE_DRAFT__('プロフィール整形 '+count+'件｜下書き保存中…');
  setStatus('プロフィール整形 '+count+'件完了｜画像・通知カードは保持。プレビューを確認してください');
 }catch(error){setStatus('プロフィール整形停止：'+(error?.message||String(error)),true)}
 finally{busy=false;notifyFixedState()}
}
function galleryKnownNoArticle(id,manifest=galleryManifest()){
 return (manifest.pendingPeople||[]).some(person=>String(person.urlname||'').toLowerCase()===id&&person.reason==='NO_PUBLIC_ARTICLE'&&person.noteCount===0);
}
function galleryRowVerified(row,index,manifest=galleryManifest(),outputIndex=index+1){
 if(!row)return false;
 const id=manifest.people[index]?.urlname.toLowerCase(),proof=row.oldestEvidence,key=noteKey(row.url);
 if(row.profileOnly===true){
  const evidence=row.noPublicArticleEvidence,profileUrl='https://note.com/'+id;
  return Boolean(galleryKnownNoArticle(id,manifest)&&row.gallery126&&!row.finalMarker&&row.index===outputIndex&&canonicalUrlname(row)===id&&row.url===profileUrl&&row.actorUrl===profileUrl&&row.key===''&&row.title===''&&row.thumbUrl===''&&row.publishAt===null&&row.articleSelection==='profile-only-confirmed'&&row.oldestVerified===false&&row.oldestEvidence===null&&typeof row.profileText==='string'&&String(row.creator||'').trim()&&evidence&&evidence.creator===id&&evidence.profileUrl===profileUrl&&evidence.noteCount===0&&evidence.contentsTotal===0&&evidence.isLastPage===true&&evidence.source==='note-public-api'&&Number.isFinite(Date.parse(evidence.checkedAt)));
 }
 let owner='';try{const u=new URL(row.url);if(u.origin==='https://note.com'&&!u.username&&!u.password)owner=u.pathname.match(/^\/([^/]+)\/n\/n[a-f0-9]{12}\/?$/i)?.[1]?.toLowerCase()||''}catch{}
 return Boolean(row.gallery126&&!row.finalMarker&&row.index===outputIndex&&canonicalUrlname(row)===id&&owner===id&&key&&row.key===key&&row.articleSelection==='oldest-confirmed'&&row.oldestVerified===true&&proof&&String(proof.creator).toLowerCase()===id&&proof.key===key&&proof.publishAt===row.publishAt&&Number.isFinite(Date.parse(row.publishAt))&&Number.isInteger(proof.terminalPage)&&proof.terminalPage>=1&&Array.isArray(proof.pagesChecked)&&proof.pagesChecked.includes(1)&&proof.pagesChecked.includes(proof.terminalPage+1)&&Number.isFinite(Date.parse(proof.verifiedAt)));
}
function validateGalleryRows(rows){
 const manifest=galleryManifest();
 const final=Array.isArray(rows)&&rows.at(-1)?.finalMarker?rows.at(-1):null;
 const creators=final?rows.slice(0,-1):rows;
 const pending=new Set((manifest.pendingPeople||[]).filter(person=>person.reason==='NO_PUBLIC_ARTICLE'&&person.noteCount===0).map(person=>String(person.urlname).toLowerCase()));
 const available=Array.isArray(creators)&&creators.length===126-pending.size&&pending.size>0&&creators.every(row=>row?.galleryAvailableOnly===true);
 const expected=manifest.people.map((person,index)=>({person,index})).filter(({person})=>!available||!pending.has(person.urlname.toLowerCase()));
 if(!Array.isArray(creators)||creators.length!==expected.length)throw new Error('ハロウィン参加者の一覧に不足があります');
 const keys=new Set();
 creators.forEach((row,index)=>{
  if(!galleryRowVerified(row,expected[index].index,manifest,index+1)||available&&row.gallerySourceIndex!==expected[index].index+1||!row.profileOnly&&keys.has(noteKey(row.url)))throw new Error((index+1)+'人目の最初の記事・人物・順序を確認できません');
  if(!row.profileOnly)keys.add(noteKey(row.url));
 });
 if(final&&(final.gallery126===true||Number(final.index)!==rows.length||canonicalUrlname(final)!=='fuku444'||norm(final.url)!==norm(FINAL_URL)||final.key!==FINAL_KEY||keys.has(FINAL_KEY)))throw new Error('最後の実績の算数の記事・人物・順序を確認できません');
 return rows;
}
async function prepareGalleryPerson(person,index){
 const id=person.urlname.toLowerCase(),creator={...person,urlname:id,likerKey:id,actorUrl:'https://note.com/'+id};
 const [selected,payload]=await Promise.all([
  page.__MUMEI_PROFILE_CARD_GALLERY__.chooseOldestArticle(creator,{requestJSON:xhrJSON,articleFromRaw,stopRequested:()=>stopRequested}).catch(error=>{if(error?.code==='NO_PUBLIC_ARTICLE'&&galleryKnownNoArticle(id))return null;throw error}),
  xhrJSON('https://note.com/api/v2/creators/'+encodeURIComponent(id))
 ]);
 if(stopRequested)throw new Error('停止しました');
 const profile=payload?.data?.creator||payload?.data?.user||payload?.data;
 if(!profile||typeof profile!=='object'||String(profile.urlname||'').toLowerCase()!==id||!String(profile.nickname||profile.name||'').trim()||!['profile','description','bio','introduction','self_introduction','note_intro'].some(key=>Object.prototype.hasOwnProperty.call(profile,key)))throw new Error(id+'さんのプロフィールを確認できません');
 const biography=profile.profile??profile.description??profile.bio??profile.introduction??profile.self_introduction??profile.note_intro??'';
 if(typeof biography!=='string')throw new Error(id+'さんのプロフィール本文の形式を確認できません');
 if(!selected){
  if(profile.noteCount!==0)throw new Error(id+'さんの公開記事数を確認できません');
  const checks=await Promise.all([true,false].map(disabled=>xhrJSON('https://note.com/api/v2/creators/'+encodeURIComponent(id)+'/contents?kind=note&page=1&disabled_pinned='+(disabled?'true':'false')+'&with_notes=false')));
  if(!checks.every(check=>Array.isArray(check?.data?.contents)&&check.data.contents.length===0&&check.data.totalCount===0&&check.data.isLastPage===true))throw new Error(id+'さんの記事なしの確認結果が一致しません');
  const avatar=avatarUrl(profile),profileUrl=creator.actorUrl;
  return{...creator,index:index+1,creator:String(profile.nickname||profile.name).trim(),url:profileUrl,key:'',title:'',publishAt:null,thumbUrl:'',actorImageUrl:avatar,avatarMissing:!avatar,profileText:biography.replace(/\r\n?/g,'\n').trim(),gallery126:true,profileOnly:true,finalMarker:false,articleSelection:'profile-only-confirmed',oldestVerified:false,oldestEvidence:null,noPublicArticleEvidence:{creator:id,profileUrl,noteCount:0,contentsTotal:0,isLastPage:true,checkedAt:new Date().toISOString(),source:'note-public-api'}};
 }
 let thumb=selected.thumbUrl,thumbnailMissingEvidence=null;
 if(!thumb){
  const p=await xhrJSON('https://note.com/api/v3/notes/'+encodeURIComponent(selected.key));
  const note=p?.data||p||{},owner=note.user?.urlname||note.author?.urlname;
  if(note.key&&note.key!==selected.key||owner&&String(owner).toLowerCase()!==id)throw new Error(id+'さんの記事情報が一致しません');
  thumb=thumbnailUrl(note);
  if(!thumb&&note.key===selected.key&&owner&&String(owner).toLowerCase()===id&&Object.prototype.hasOwnProperty.call(note,'eyecatch')&&(note.eyecatch===null||note.eyecatch==='')){
   thumbnailMissingEvidence={key:selected.key,articleUrl:selected.url,checkedAt:new Date().toISOString(),reason:'The verified article API reports an unconfigured eyecatch'};
  }else if(!thumb)thumb=await articleMetaImage(selected.url);
 }
 if(!thumb&&!thumbnailMissingEvidence)throw new Error(id+'さんの最初の記事サムネイルを確認できません');
 const avatar=avatarUrl(profile)||selected.actorImageUrl||'';
 return{...selected,index:index+1,urlname:id,likerKey:id,actorUrl:creator.actorUrl,creator:String(profile.nickname||profile.name||person.creator||id).trim(),actorImageUrl:avatar,avatarMissing:!avatar,thumbUrl:thumb||'',articleThumbnailMissing:Boolean(thumbnailMissingEvidence),thumbnailMissingEvidence,profileText:biography.replace(/\r\n?/g,'\n').trim(),gallery126:true,finalMarker:false};
}
async function buildGalleryRows({availableOnly=false}={}){
 const manifest=galleryManifest(),signature=manifest.sourceBlob+'|'+manifest.people.map(person=>person.urlname.toLowerCase()).join('|');
 await galleryStore.hydrate();
 const saved=galleryStore.read();
 const rows=saved?.signature===signature&&Array.isArray(saved.rows)?saved.rows.slice(0,126):Array(126).fill(null);
 while(rows.length<126)rows.push(null);
 for(let i=0;i<rows.length;i++){
  // A not-yet-pasted zero-article snapshot can become outdated. Recheck that
  // one account live; completed runs keep their already selected image/link.
  if(rows[i]?.profileOnly)rows[i]=null;
  if(rows[i]&&!galleryRowVerified(rows[i],i,manifest))rows[i]=null;
  if(!rows[i]&&!manifest.preparedRows?.[i]?.profileOnly&&galleryRowVerified(manifest.preparedRows?.[i],i,manifest))rows[i]=JSON.parse(JSON.stringify(manifest.preparedRows[i]));
 }
 const pending=new Set((manifest.pendingPeople||[]).filter(person=>person.reason==='NO_PUBLIC_ARTICLE'&&person.noteCount===0).map(person=>String(person.urlname).toLowerCase()));
 const missing=rows.map((row,index)=>row?null:index).filter(index=>index!==null);
 for(let offset=0;offset<missing.length;offset+=6){
  if(stopRequested)throw new Error('停止しました');
  const results=await Promise.allSettled(missing.slice(offset,offset+6).map(async index=>{
   const row=await prepareGalleryPerson(manifest.people[index],index);
   rows[index]=row;
   galleryStore.write({signature,rows,updatedAt:Date.now()});await galleryStore.flush();
   setStatus('ハロウィン｜最初の記事・プロフィール '+rows.filter(Boolean).length+'/126人を確認');
   return row;
  }));
  const failed=results.find(result=>result.status==='rejected');
  if(failed)throw failed.reason;
 }
 return validateGalleryRows(rows);
}
function assertGalleryTracking(view,run=readRun()){
 if(!Array.isArray(run?.imageBaselineRecords))throw new Error('貼り付け前の画像記録を確認できません');
 const owned=new Set(ownedImagesForRun(view,run).map(hit=>hit.pos));
 for(const hit of imageNodes(view)){
  if(owned.has(hit.pos))continue;
  const id=String(hit.node.attrs?.id||''),src=String(hit.node.attrs?.src||''),link=norm(hit.node.attrs?.link||'');
  const original=run.imageBaselineRecords.some(record=>id?record.id===id:src&&record.src===src&&norm(record.link||'')===link);
  if(!original)throw new Error('保存記録のない画像を検出しました。二重貼り付けを防ぐため停止しました。本文の直前の画像を確認してください');
 }
}
function reconcileGalleryHeadings(view,run=readRun(),rows=run.rows){
 if(!run?.galleryParticipantUpgrade?.pendingHeadings)return false;
 const plan=galleryImagePlan(view,run,rows);
 if(plan.entries.length!==rows.length)return false;
 const creators=rows.filter(row=>!row.finalMarker),variants=new Map(),hits=[],targets=[];
 for(let block=0;block<Math.ceil(creators.length/10);block++)for(const count of [125,126])variants.set(headingText(block,count),block);
 const lower=Math.max(0,Number(run.imageAnchorPos)||0),upper=plan.entries.at(-1).hit.pos;
 view.state.doc.descendants((node,pos)=>{if(pos>=lower&&pos<upper&&node.type?.name==='heading'&&variants.has(String(node.textContent||'')))hits.push({node,pos,block:variants.get(String(node.textContent))})});
 const exact=new Set();for(const hit of hits){const text=String(hit.node.textContent);if(exact.has(text))throw new Error('移行する見出しが重複しています。本文は保持しました');exact.add(text)}
 for(let block=0;block<Math.ceil(creators.length/10);block++){
  if(!hits.some(hit=>hit.block===block))throw new Error('移行する見出しの保存位置を確認できません。本文は保持しました');
  const index=block*10,entry=plan.byIndex.get(index),previous=plan.entries.filter(item=>item.index<index).at(-1),from=previous?previous.hit.pos+previous.hit.node.nodeSize:lower;
  const profile=findActivity(view,activityText(rows[index]),from);
  if(!profile||profile.pos>=entry.hit.pos)throw new Error('見出しを置くプロフィール位置を確認できません');
  targets.push({pos:profile.pos,text:headingText(block,creators.length)});
 }
 const type=view.state.schema.nodes.heading;if(!type)throw new Error('note見出しノードを取得できません');
 let tr=view.state.tr;
 for(const hit of hits.sort((first,second)=>second.pos-first.pos))tr=tr.delete(hit.pos,hit.pos+hit.node.nodeSize);
 for(const target of targets){let node;try{node=type.create({level:2},view.state.schema.text(target.text))}catch{node=type.create(null,view.state.schema.text(target.text))}tr=tr.insert(tr.mapping.map(target.pos,1),node)}
 view.dispatch(tr);
 const current=readRun()||run,shift=value=>value!=null&&value!==''&&Number.isFinite(Number(value))?tr.mapping.map(Number(value),1):value;
 writeRun({...current,cardAnchorPos:shift(current.cardAnchorPos),pendingCard:current.pendingCard?{...current.pendingCard,pos:shift(current.pendingCard.pos)}:current.pendingCard,sectionHeadings:[...targets.map(target=>target.text),...(findHeading(view,'最後に｜実績の算数')?['最後に｜実績の算数']:[])],galleryParticipantUpgrade:{...current.galleryParticipantUpgrade,pendingHeadings:false,completedAt:new Date().toISOString()},updatedAt:Date.now()});
 return true;
}
function assertGalleryPaste(view,rows){
 validateGalleryRows(rows);
 if(!rows.at(-1)?.finalMarker)throw new Error('最後の実績の算数が未追加です。「続きから」で末尾の画像を完成させてください');
 const creators=rows.slice(0,-1);
 assertGalleryTracking(view);
 const images=ownedImages(view);
 if(completedImagePrefix(rows,images)!==rows.length)throw new Error('本文の極薄画像が'+rows.length+'件そろっていません');
 for(let i=0;i<rows.length;i++){
  const row=rows[i],hit=images[i];
  if(String(hit.node.textContent||'').trim()!==row.creator+'さん')throw new Error((i+1)+'人目のキャプションが一致しません');
  if(!isDivider(view,view.state.doc.nodeAt(hit.pos+hit.node.nodeSize)))throw new Error((i+1)+'人目の区切り線がありません');
  if(row.finalMarker){if(!findHeading(view,'最後に｜実績の算数'))throw new Error('最後の実績の算数の見出しを確認できません');continue;}
  const profile=findActivity(view,activityText(row),i?images[i-1].pos+images[i-1].node.nodeSize:0);
  if(!profile||profile.pos>=hit.pos)throw new Error((i+1)+'人目のプロフィールを確認できません');
  if(i%10===0&&!findHeading(view,headingText(Math.floor(i/10),creators.length)))throw new Error('10人単位の見出しを確認できません');
 }
 if(new Set(creators.map(row=>row.designIndex)).size!==creators.length)throw new Error('デザインに重複があります');
}
function checkPause(){if(pauseRequested)throw Object.assign(new Error('一時停止しました｜途中記録を保存済み。「再開」で続けられます'),{code:'PAUSED'})}
function pauseFix(){
 if(busy||exportWaiter){
  pauseRequested=true;setStatus('一時停止を受付｜処理中の1件を保存してから止まります');
 }else if(page.__MUMEI_PROFILE_CARD_PAUSE__?.()!==true){
  setStatus(readRun()?.paused?'一時停止中です｜「再開」で続けられます':'現在は実行していません｜保存済みの続きは「再開」');
 }
 notifyFixedState();
}
let lastPauseGestureAt=-Infinity;
function pausePanelGesture(event){
 const target=event.target?.closest?.('[data-gallery-action="pause"],[data-a="pause"]');
 const panel=document.getElementById(PANEL);
 if(!target||!panel?.contains(target)||target.disabled)return;
 event.preventDefault();event.stopImmediatePropagation();
 const now=Date.now();if(now-lastPauseGestureAt<650)return;
 lastPauseGestureAt=now;pauseFix();
}
async function startGallery126(availableOnly=false){return createFixed300({gallery126:true,galleryAvailableOnly:availableOnly})}
async function resumeGallery126(){
 if(busy||exportWaiter||coreBusy()){setStatus('実行中です。一時停止が完了するまでお待ちください',true);return;}
 await hydrateRunBackup();
 const saved=readRun(),needsParticipant=galleryNeedsParticipantUpgrade(saved);
 if(saved?.pauseStage==='cards'&&!needsParticipant){const resume=page.__MUMEI_PROFILE_CARD_CREATE_CARDS_AT_TAP__;if(typeof resume==='function')return resume();}
 if(!saved?.gallery126&&saved?.coreImageRun&&typeof page.__MUMEI_PROFILE_CARD_RESUME_CORE_IMAGES__==='function')return page.__MUMEI_PROFILE_CARD_RESUME_CORE_IMAGES__();
 return startGallery126(true);
}

function mapGalleryCardAnchorsAfterInsert(snapshot){
 if(!snapshot)return;
 const run=readRun();if(!run?.gallery126||run.articleKey!==snapshot.articleKey)return;
 const delta=snapshot.view.state.doc.content.size-snapshot.docSize;
 if(!delta)return;
 const shift=value=>value!=null&&value!==''&&Number.isFinite(Number(value))&&Number(value)>=snapshot.from?Number(value)+delta:value;
 const cardAnchorPos=shift(run.cardAnchorPos),pendingCard=run.pendingCard?{...run.pendingCard,pos:shift(run.pendingCard.pos)}:run.pendingCard;
 if(cardAnchorPos!==run.cardAnchorPos||pendingCard?.pos!==run.pendingCard?.pos)writeRun({...run,cardAnchorPos,pendingCard,updatedAt:Date.now()});
}
async function createFixed300(options=null){
 if(busy||exportWaiter||coreBusy()){setStatus('実行中です。先に「停止」を押してください',true);return;}
 busy=true;stopRequested=false;pauseRequested=false;notifyFixedState();
 let pendingAnchorMap=null;
 await keepAwake();
 try{
  await Promise.all([hydrateRunBackup(),hydratePrepBackup()]);
  if(stopRequested)throw new Error('停止しました');
  setStatus('修正版を開始｜実アイコン・記事サムネ・外部プロフィール文を確認中');
  const view=findView();
  if(!view)throw new Error('note本文編集欄を取得できません');
  nativeImageCommand();selectionApi();

  checkPause();
  let existing=readRun();
  const gallery=Boolean(options?.gallery126||existing?.gallery126);
  const availableOnly=false;
  if(gallery&&!editorArticleKey())throw new Error('記事の保存先を確認できません。下書きを保存して編集画面を開き直してください');
  if(gallery&&existing&&!existing.gallery126)throw new Error('別の作成分が保存されています。先に「最初に戻る」で整理してください');
  if(existing?.articleKey&&existing.articleKey!==editorArticleKey())throw new Error('別の記事の保存記録です');
  const initialAnchor=gallery&&!existing?cardAnchorFromSelection(view):null,initialDoc=view.state.doc;
  if(existing&&!existing.likesHistoryFix230&&!existing.gallery126){
   setStatus('保存済みの画像・プロフィールと途中記録を照合中｜貼り付けは保持');
   existing=await recoverCompatibleRun(view,existing);
   writeRun(existing);await flushRunBackup();
  }
  if(gallery&&galleryNeedsParticipantUpgrade(existing))existing=await upgradeGalleryParticipants(view,existing);

  const requested=gallery?{mode:'number',count:126,target:126}:existing?.likesHistoryFix230?historyOptions(existing):(options||historyOptions());
  let rows;
  if(existing?.gallery126)rows=validateGalleryRows(existing.rows);
  else if(gallery)rows=await buildGalleryRows({availableOnly});
  else if(existing?.likesHistoryFix230)rows=validateFixedRows(existing.rows);
  else{
   const creators=await buildRows(requested.target);
   const finalRow=await enrichFinal(creators.length+1);
   rows=validateFixedRows([...creators,finalRow])
  }
  if(!gallery)rows=excludePendingCreatorRows(rows,existing||{});
  if(gallery&&!rows.at(-1)?.finalMarker){
   const finalRow=await enrichFinal(rows.length+1);
   if(stopRequested)throw new Error('停止しました');
   if(!mediaUrl(finalRow.thumbUrl))throw new Error('最後の実績の算数のサムネイルを取得できません。完成分は保持しています。「続きから」で再取得してください');
   rows=validateGalleryRows([...rows,{...finalRow,urlname:'fuku444',finalMarker:true,gallery126:false,index:rows.length+1,designIndex:0}]);
  }
  checkPause();
  rows=assignDesigns(rows);
  if(!gallery&&!existing?.likesHistoryFix230)rows=compactHistoryRows(rows);
  if(gallery&&existing?.gallery126){assertGalleryTracking(view,existing);repairGalleryProfileParagraphs(view,existing,rows);await flushRunBackup();existing=readRun();}
  const galleryCount=gallery?rows.length-1:0;

  let run=readRun();
  if(!run?.likesHistoryFix230&&!run?.gallery126){
   if(gallery&&view.state.doc!==initialDoc&&!view.state.doc.eq?.(initialDoc))throw new Error('読み込み中に本文が変更されました。本文位置を選んで「126人の続き」を押してください');
   run={
    version:VERSION,articleKey:editorArticleKey(),items:[],cardKeys:[],sectionHeadings:[],activityTexts:[],rows,
    contentBaselineNodes:gallery&&typeof view.state.doc.forEach==='function'?(()=>{const nodes=[];view.state.doc.forEach((node,pos)=>nodes.push({pos,json:node.toJSON()}));return nodes})():null,
    cardBaselineKeys:embedNodes(view).map(cardKey).filter(Boolean),
    cardBaselineNodes:gallery?embedNodes(view).map(hit=>({key:cardKey(hit),src:String(hit.node.attrs?.src||''),json:hit.node.toJSON?.()||null})):[],
    imageBaselineRecords:gallery?imageNodes(view).map(hit=>({id:String(hit.node.attrs?.id||''),src:String(hit.node.attrs?.src||''),link:String(hit.node.attrs?.link||'')})):[],
    createdAt:Date.now(),stage:'images_building',likesHistory:!gallery,likesHistoryFix230:!gallery,gallery126:gallery,galleryAvailableOnly:false,pendingPeople:[],...(gallery?{galleryProfileTexts:{}}:{}),
    imageAnchorPos:gallery?initialAnchor:cardAnchorFromSelection(view),sources:gallery?galleryManifest().source:'スキ履歴（読み取りのみ）',mode:requested.mode,count:gallery?galleryCount:rows.length-1,historyRequestedCount:!gallery&&requested.mode==='number'?requested.count:null,choice:gallery?'oldest':'latest'
   };
   writeRun(run)
  }else{
   run={...run,rows,count:gallery?galleryCount:rows.length-1,stage:'images_building',paused:false,pauseStage:null,updatedAt:Date.now()};
   writeRun(run)
  }
  await flushRunBackup();

  if(gallery)assertGalleryTracking(view,run);
  let doneImages=ownedImages(view);
  let done=gallery?galleryImagePlan(view,run,rows).entries.length:completedImagePrefix(rows,doneImages);
  if(gallery&&done){
   // An interrupted transaction may have recorded its image immediately
   // before the following divider. Repair that boundary before moving on.
   for(const entry of galleryImagePlan(view,readRun()||run,rows).entries){
    const hit=galleryImagePlan(view,readRun()||run,rows).byIndex.get(entry.index).hit;
    if(!isDivider(view,view.state.doc.nodeAt(hit.pos+hit.node.nodeSize)))addDivider(view,hit,entry.row);
   }
   const current=readRun()||run;
   writeRun({...current,dividerUrls:[...new Set([...(current.dividerUrls||[]),...galleryImagePlan(view,current,rows).entries.map(entry=>entry.row.url)])],updatedAt:Date.now()});
   await flushRunBackup();doneImages=ownedImages(view);
  }
  let insertPos=done?doneImages[done-1].pos+doneImages[done-1].node.nodeSize:Number(run.imageAnchorPos);
  if(!Number.isFinite(insertPos))insertPos=cardAnchorFromSelection(view);
  const nextNode=view.state.doc.nodeAt(insertPos);if(done&&isDivider(view,nextNode))insertPos+=nextNode.nodeSize;

  setStatus((gallery?'ハロウィン'+galleryCount+'人'+(availableOnly?'・記事待ち1人':''):'極薄')+'｜'+done+'/'+rows.length+'件済み。続きから貼り付け');
  // Prepare one next PNG while the current native upload finishes. Only one
  // image upload is ever in flight; rejected prefetches are consumed in order.
  let prepared=null;
  const prepareNext=index=>({index,promise:Promise.resolve().then(()=>makeFile(rows[index])).then(file=>({file}),error=>({error}))});
  for(let i=gallery?0:done;i<rows.length;i++){
   checkPause();
   if(stopRequested)throw new Error('停止しました');
   const row=rows[i];
   assertCreatorAllowed(row);
   if(gallery){
    const imagePlan=galleryImagePlan(view,readRun()||run,rows);
    if(imagePlan.byIndex.has(i))continue;
    const previous=imagePlan.entries.filter(entry=>entry.index<i).at(-1);
    insertPos=previous?previous.hit.pos+previous.hit.node.nodeSize:Number((readRun()||run).imageAnchorPos);
    if(!Number.isFinite(insertPos))throw new Error('追加する画像の本文位置を確認できません');
    const divider=view.state.doc.nodeAt(insertPos);if(previous&&isDivider(view,divider))insertPos+=divider.nodeSize;
   }
   setStatus('画像確認｜'+(i+1)+'/'+rows.length+'｜'+row.creator);
   let file;
   try{
    if(gallery){const result=await(prepared?.index===i?prepared:prepareNext(i)).promise;if(result.error)throw result.error;file=result.file;}
    else file=await makeFile(row);
   }catch(error){
    if(stopRequested||/停止しました|手動停止/.test(String(error?.message||error)))throw new Error('停止しました');
    if(gallery||row.finalMarker||error?.code!=='ASSET_UNAVAILABLE')throw error;
    setStatus(row.creator+'さんの画像を取得できないため除外｜次の候補を補充中');
    const nextRows=validateFixedRows(await replaceUnavailableCreator(rows,i,error,run.mode));
    completedImagePrefix(nextRows,ownedImages(view));
    rows=nextRows;
    run=readRun()||run;
    writeRun({...run,version:VERSION,rows,count:rows.length-1,imageSkipped:[...(run.imageSkipped||[]),{urlname:row.urlname,likerKey:row.likerKey,reason:error.message}],updatedAt:Date.now()});
    if(run.mode==='all'){
     const mapping=refreshHistoryHeadings(view,rows.length-1);
     if(mapping)insertPos=mapping.map(insertPos);
    }
    await flushRunBackup();
    i--;continue;
   }
   if(stopRequested)throw new Error('停止しました');

   checkPause();
   if(gallery)pendingAnchorMap={view,from:insertPos,docSize:view.state.doc.content.size,articleKey:editorArticleKey()};
   if(row.finalMarker){
    const text='最後に｜実績の算数';
    const existingHeading=findHeading(view,text);
    if(existingHeading&&existingHeading.pos>=insertPos)insertPos=existingHeading.pos+existingHeading.node.nodeSize;
    else if(!existingHeading){const h=insertHeadingAt(view,text,insertPos);insertPos=h.nextPos;recordHeading(text)}
   }else if(i%10===0){
    const text=headingText(Math.floor(i/10),gallery?galleryCount:rows.length-1);
    const existingHeading=findHeading(view,text);
    if(existingHeading&&existingHeading.pos>=insertPos)insertPos=existingHeading.pos+existingHeading.node.nodeSize;
    else if(!existingHeading){const h=insertHeadingAt(view,text,insertPos);insertPos=h.nextPos;recordHeading(text)}
   }

   if(!row.finalMarker){
    const text=activityText(row);
    const existingActivity=findActivity(view,text,insertPos);
    if(existingActivity&&existingActivity.pos>=insertPos){insertPos=existingActivity.pos+existingActivity.node.nodeSize;if(gallery)recordGalleryActivity(row,text)}
    else if(!existingActivity){const a=insertActivityAt(view,row,insertPos);insertPos=a.nextPos;if(gallery)recordGalleryActivity(row,a.text);else recordActivity(a.text)}
   }

   setStatus('修正版｜'+(i+1)+'/'+rows.length+'｜'+row.creator+'｜アイコン＋サムネ');
   if(stopRequested)throw new Error('停止しました');
   if(gallery&&i+1<rows.length){const imagePlan=galleryImagePlan(view,readRun()||run,rows),next=rows.findIndex((person,index)=>index>i&&!imagePlan.byIndex.has(index));if(next>=0)prepared=prepareNext(next)}
   const made=await uploadOne(view,row,file,insertPos);
   insertPos=made.nextPos;
   recordImage(made.hit,row);
   insertPos=addDivider(view,made.hit,row);
   mapGalleryCardAnchorsAfterInsert(pendingAnchorMap);pendingAnchorMap=null;
   await flushRunBackup();
   checkPause();
   await sleep(gallery?20:IMAGE_GAP)
  }

  if(gallery){reconcileGalleryHeadings(view,readRun()||run,rows);assertGalleryPaste(view,rows)}
  run=readRun()||run;
  writeRun({...run,stage:'images_ready',paused:false,pauseStage:null,rows,imagesCompletedAt:Date.now(),updatedAt:Date.now()});
  await flushRunBackup();
   const saved=typeof page.__MUMEI_PROFILE_CARD_SAVE_DRAFT__==='function'?await page.__MUMEI_PROFILE_CARD_SAVE_DRAFT__((gallery?'ハロウィン極薄'+galleryCount+'人・'+galleryCount+'種類＋実績1件':'極薄'+(rows.length-1)+'人＋実績1件')+'｜画像貼付完了。下書き保存中…'):{confirmed:false};
   setStatus(saved?.confirmed===false?'画像 '+rows.length+'件は貼付済み｜下書き保存は未確認。note画面で保存完了を確認してください':'極薄'+rows.length+'件完了 ✅ '+(gallery&&availableOnly?'やとさん1人は記事公開待ち。':'')+'カードを置く本文位置をタップ→②カード続き/開始')
 }catch(error){
  if(pendingAnchorMap){mapGalleryCardAnchorsAfterInsert(pendingAnchorMap);await flushRunBackup();}
  let pauseNotice='';
  if(error?.code==='PAUSED'){
   const saved=readRun();
   if(saved){
    writeRun({...saved,paused:true,pauseStage:'images',pausedAt:Date.now()});
    try{
     await flushRunBackup();
     const result=await page.__MUMEI_PROFILE_CARD_SAVE_DRAFT__?.('一時停止｜完成分の下書き保存中…');
     if(result?.confirmed===false)pauseNotice='｜下書き保存の完了は画面で確認してください';
    }catch(saveError){pauseNotice='｜下書き保存を確認してください：'+(saveError?.message||String(saveError))}
   }
  }
  setStatus(error?.code==='PAUSED'?error.message+pauseNotice:'修正版停止：'+(error?.message||String(error)),error?.code!=='PAUSED')
 }finally{busy=false;notifyFixedState();await releaseAwake()}
}
function stopFix(){
 if(exportWaiter){const waiting=exportWaiter;exportWaiter=null;clearTimeout(waiting.timer);try{waiting.popup.close()}catch{}waiting.reject(new Error('停止しました'));}
 stopRequested=true;
 notifyFixedState();
 abortRequests();
 setStatus('修正版を停止しました｜完成分は保持')
}

const panelBindings=new WeakMap();
function bindPanelAction(control,key,listener,options){
 if(!control)return;
 let keys=panelBindings.get(control);if(!keys){keys=new Set();panelBindings.set(control,keys)}
 if(keys.has(key))return;keys.add(key);control.addEventListener(key.split(':')[0],listener,options);
}
function patchPanel(){
 const panel=document.getElementById(PANEL);
 if(!panel||!panel.querySelector('.body')||!panel.querySelector('details[data-like300]'))return false;
 const title=panel.querySelector('.title');
 if(title&&title.textContent!=='紹介貼付 v'+VERSION)title.textContent='紹介貼付 v'+VERSION;

 if(!panel.querySelector('[data-gallery126]')){
  const gallery=document.createElement('details');gallery.dataset.gallery126='1';gallery.open=true;
  gallery.innerHTML='<summary>🎃 ハロウィンアート2026</summary><div class="hint">126人・126種類｜記事なしもアイコン＋名前で掲載｜最初の記事｜プロフィール小文字</div><div class="special-actions"><button type="button" data-gallery-action="images">①126人の極薄</button><button type="button" data-gallery-action="pause">一時停止</button><button type="button" data-gallery-action="resume">再開</button><button type="button" data-gallery-action="cards">②通知カード</button><button type="button" data-gallery-action="delete">通知カードのみ削除</button><button type="button" data-gallery-action="delete-all">今回分を全削除</button><button type="button" data-gallery-action="profiles">プロフィールを整える</button><button type="button" data-gallery-action="all">126人全員を再確認</button></div>';

  panel.querySelector('.body')?.prepend(gallery);
 }

 const gallery=panel.querySelector('[data-gallery126]');
  bindPanelAction(gallery.querySelector('[data-gallery-action="images"]'), 'click:gallery',event=>{event.preventDefault();void startGallery126(true)});
  bindPanelAction(gallery.querySelector('[data-gallery-action="resume"]'), 'click:gallery',event=>{event.preventDefault();void resumeGallery126()});
  bindPanelAction(gallery.querySelector('[data-gallery-action="pause"]'), 'click:gallery',event=>{event.preventDefault();pauseFix()});
  bindPanelAction(gallery.querySelector('[data-gallery-action="profiles"]'), 'click:gallery',event=>{event.preventDefault();void repairGalleryProfiles()});
  bindPanelAction(gallery.querySelector('[data-gallery-action="all"]'), 'click:gallery',event=>{event.preventDefault();void startGallery126(false)});
  bindPanelAction(gallery.querySelector('[data-gallery-action="cards"]'), 'click:gallery',event=>{event.preventDefault();const run=readRun();if(!run?.gallery126){setStatus('先にハロウィン126人の画像を完成させてください',true);return;}void page.__MUMEI_PROFILE_CARD_CREATE_CARDS_AT_TAP__?.()});
  bindPanelAction(gallery.querySelector('[data-gallery-action="delete-all"]'),'click:gallery',event=>{event.preventDefault();void page.__MUMEI_PROFILE_CARD_DELETE_ALL__?.()});
  bindPanelAction(gallery.querySelector('[data-gallery-action="delete"]'), 'click:gallery',event=>{event.preventDefault();void page.__MUMEI_PROFILE_CARD_DELETE_CARDS__?.()});
 const detail=panel.querySelector('details[data-like300]');
 if(!detail)return false;
 const summary=detail.querySelector('summary');
 if(summary&&summary.textContent!=='＋ スキ履歴から紹介')summary.textContent='＋ スキ履歴から紹介';
 const hint=detail.querySelector('.hint');
 if(hint&&hint.textContent!=='直近順・同じ人は1回｜200種ランダム（200人までは全て別）｜プロフィール小文字｜上の件数・全数を使用｜実績1件を追加｜10人ごと大見出し')hint.textContent='直近順・同じ人は1回｜200種ランダム（200人までは全て別）｜プロフィール小文字｜上の件数・全数を使用｜実績1件を追加｜10人ごと大見出し';

 let preset=detail.querySelector('[data-a="like200-preset"]');
 if(!preset){preset=document.createElement('button');preset.type='button';preset.dataset.a='like200-preset';preset.textContent='直近200人に設定';(detail.querySelector('.special-actions')||detail).prepend(preset);}
 bindPanelAction(preset,'click:recent200',event=>{
  event.preventDefault();
  const mode=panel.querySelector('[data-mode]'),count=panel.querySelector('[data-count]');
  if(!mode||!count)return;
  mode.value='number';count.value='200';count.disabled=false;
  mode.dispatchEvent(new Event('change',{bubbles:true}));count.dispatchEvent(new Event('change',{bubbles:true}));
  setStatus('直近200人・人物重複なし・200種に設定しました｜① 最初からで取得開始');
 });

 const oldButton=detail.querySelector('[data-a="like300-images"],[data-a="like300-fixed"]');
 if(oldButton&&!panelBindings.get(oldButton)?.has('click:history')){
  const button=oldButton.cloneNode(true);
  button.dataset.a='like300-fixed';
  button.textContent='① 最初から';
  button.style.background='#176b54';
  button.style.borderColor='#5bd7a7';
  oldButton.replaceWith(button);
  bindPanelAction(button,'click:history',event=>{event.preventDefault();void restartFixed300()})
 }

 let resume=detail.querySelector('[data-a="like300-resume"]');
 if(!resume){resume=document.createElement('button');resume.dataset.a='like300-resume';resume.textContent='続きから';resume.style.cssText='background:#244c66;border-color:#69bfe8';
 (detail.querySelector('.special-actions')||detail).appendChild(resume);}
 bindPanelAction(resume,'click:resume',event=>{event.preventDefault();void resumeFixed300();});
 const prep=detail.querySelector('[data-a="like300-prep"]');
 prep?.remove();
 const actions=detail.querySelector('.special-actions');if(actions)actions.style.gridTemplateColumns='1fr';
 const cards=panel.querySelector('[data-a="cards"]');
 if(cards){
  if(cards.textContent!=='② カード続き／開始')cards.textContent='② カード続き／開始';
  cards.style.cssText='background:#34518a;border-color:#7897df';
  if(cards.parentNode!==(actions||detail))(actions||detail).appendChild(cards);
  if(!panelBindings.get(cards)?.has('click:cards')){
   cards.dataset.currentCardHandler='1';
   bindPanelAction(cards,'click:cards',event=>{
    const create=page.__MUMEI_PROFILE_CARD_CREATE_CARDS_AT_TAP__;
    if(typeof create!=='function')return;
    event.preventDefault();event.stopImmediatePropagation();void create();
   },{capture:true});
  }
 }
 let audit=detail.querySelector('[data-a="check-duplicates"]');
 if(!audit){
  audit=document.createElement('button');audit.dataset.a='check-duplicates';audit.textContent='重複確認';
  audit.addEventListener('click',event=>{
   event.preventDefault();
   const check=page.__MUMEI_PROFILE_CARD_AUDIT_DUPLICATES__;
   if(typeof check==='function')void check();
   else setStatus('重複確認には最新版へ更新してください',true);
  });
 }
 if(audit.parentNode!==(actions||detail))(actions||detail).appendChild(audit);
 const deleteCards=panel.querySelector('[data-a="delete"]');
 if(deleteCards&&!panelBindings.get(deleteCards)?.has('click:delete')){
  deleteCards.dataset.currentDeleteHandler='1';
  bindPanelAction(deleteCards,'click:delete',event=>{
   const remove=page.__MUMEI_PROFILE_CARD_DELETE_CARDS__;
   if(typeof remove!=='function')return;
   event.preventDefault();event.stopImmediatePropagation();void remove();
  },{capture:true});
 }

 panel.querySelectorAll('button').forEach(button=>button.type='button');
 const stop=panel.querySelector('[data-a="stop"]');
 bindPanelAction(stop,'pointerdown:stop',()=>stopFix(),{capture:true});
 bindPanelAction(stop,'touchstart:stop',()=>stopFix(),{capture:true,passive:true});
 return true
}
let attempts=0;
window.addEventListener('mumei-profile-card-start',()=>void restartFixed300());
window.addEventListener('mumei-profile-card-stop',()=>stopFix());
for(const type of ['pointerdown','touchstart','click'])window.addEventListener(type,pausePanelGesture,{capture:true,passive:false});
let observedPanel=null,observedBody=null,observedGallery=null,repairQueued=false;
function rememberPanel(){
 observedPanel=document.getElementById(PANEL);observedBody=observedPanel?.querySelector('.body');observedGallery=observedPanel?.querySelector('[data-gallery126]');
}
function restorePanelControls(reveal=false){
 page.__MUMEI_PROFILE_CARD_RESTORE_PANEL__?.();
 if(!patchPanel())return false;
 rememberPanel();
 if(reveal&&observedGallery){observedGallery.open=true;observedBody.scrollTop=0;}
 page.__MUMEI_PROFILE_CARD_REFRESH_UI__?.();
 return true;
}
function panelControlsMissing(){
 const panel=document.getElementById(PANEL),body=panel?.querySelector('.body'),gallery=panel?.querySelector('[data-gallery126]');
 return !panel||!document.getElementById(PANEL+'-mini')||panel!==observedPanel||!body||body!==observedBody||!gallery||gallery!==observedGallery||!gallery.querySelector('[data-gallery-action="resume"]');
}
window.addEventListener('mumei-profile-card-panel-ready',()=>restorePanelControls(true));
window.addEventListener('pageshow',()=>restorePanelControls());
const timer=setInterval(()=>{
 attempts++;
 if(restorePanelControls()||attempts>240)clearInterval(timer)
},250);
restorePanelControls();
if(typeof window.MutationObserver==='function'){
 const observer=new window.MutationObserver(()=>{
  if(repairQueued||!panelControlsMissing())return;
  repairQueued=true;
  Promise.resolve().then(()=>{repairQueued=false;restorePanelControls()});
 });
 observer.observe(document.documentElement||document,{childList:true,subtree:true});
}

})();


