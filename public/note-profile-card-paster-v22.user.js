// ==UserScript==
// @name         無名S note アイコン＋キャプション 貼り付け装置
// @namespace    https://github.com/mumei-s/note-insight/profile-card-paster
// @version      2.5.8
// @description  取得不可は飛ばし、スキ履歴から重複なし300人＋実績1件。実アイコン・最新記事サムネイル・画像外のプロフィール全文・極薄50種。
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
const IMAGE_GAP=560;

let busy=false;
let wakeLock=null;
let stopRequested=false;
let viewCache=null;
let imageCommandCache=null;
let selectionCache=null;
const activeRequests=new Set();
page.__MUMEI_PROFILE_CARD_FIXED_BUSY__=()=>busy||!!exportWaiter;
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
function prepareInsightExport(){
 if(exportWaiter)return exportWaiter.promise;
 const requestId='likes300-'+Date.now()+'-'+Math.random().toString(36).slice(2),url=new URL('https://mumei-s.github.io/note-insight/note-profile-card-paster-history-export.html');
 url.searchParams.set('request',requestId);url.searchParams.set('count','1000');url.searchParams.set('unique','1');url.searchParams.set('scope','recent-likes');
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
function startFixed300(){
 if(busy||exportWaiter||coreBusy()){setStatus('実行中です。先に「停止」を押してください',true);return;}
 const run=readRun();
 if(run?.likesHistoryFix230&&Array.isArray(run.rows)&&run.rows.length===301)return createFixed300();
 return prepareInsightExport().then(()=>createFixed300()).catch(error=>setStatus('取得停止：'+(error?.message||String(error)),true));
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
function xhr(url,responseType='text',timeout=60000){
 return new Promise((resolve,reject)=>{
  let request=null;
  const done=()=>{if(request)activeRequests.delete(request)};
  request=GM_xmlhttpRequest({
   method:'GET',
   url,
   responseType,
   timeout,
   headers:{Accept:responseType==='blob'?'image/avif,image/webp,image/png,image/jpeg,*/*':'application/json,text/html,*/*'},
   onload:r=>{
    done();
    if(stopRequested){reject(new Error('停止しました'));return}
    if(r.status>=200&&r.status<300)resolve(r.response);
    else reject(new Error('GET '+r.status+' '+url))
   },
   onerror:()=>{done();reject(new Error(stopRequested?'停止しました':'通信失敗 '+url))},
   ontimeout:()=>{done();reject(new Error(stopRequested?'停止しました':'通信タイムアウト '+url))},
   onabort:()=>{done();reject(new Error('停止しました'))}
  });
  if(request)activeRequests.add(request)
 })
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
 const requireFn=webpackRequire();
 let command;
 try{command=requireFn?.(94928)?.CwN}catch{}
 const src=typeof command==='function'?Function.prototype.toString.call(command):'';
 if(!(command?.length===4&&/Array\.from/.test(src)&&/imageUploading/.test(src)&&/entries/.test(src)))throw new Error('note正規画像処理を取得できません');
 return imageCommandCache=command
}
function selectionApi(){
 if(selectionCache)return selectionCache;
 const requireFn=webpackRequire();
 let mod;
 try{mod=requireFn?.(44044)}catch{}
 const Selection=mod?.Y1;
 if(typeof Selection?.atEnd!=='function')throw new Error('note内部Selectionを取得できません');
 return selectionCache=Selection
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
  await sleep(260)
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
 const before=new Set(imageNodes(view).map(x=>String(x.node.attrs?.id||'')).filter(Boolean));
 const selected=setSelectionForInsert(view,insertPos);
 const dt=new page.DataTransfer();
 dt.items.add(file);
 if(nativeImageCommand()(view,dt.files,Math.max(0,selected-1),'image')!==true)throw new Error(row.index+'番 画像アップロードを開始できません');
 const hit=await waitNewNoteImage(view,before);
 const linked=relinkCaption(view,hit,row);
 const actual=imageNodes(view).find(x=>{
  const id=String(linked?.node?.attrs?.id||'');
  return (id&&String(x.node.attrs?.id||'')===id)||x.pos===linked.pos
 })||linked;
 return{hit:actual,nextPos:actual.pos+actual.node.nodeSize}
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

  const [notePayload,metaThumb]=await Promise.all([
   xhrJSON('https://note.com/api/v3/notes/'+encodeURIComponent(latest.key)).catch(()=>({})),
   articleMetaImage(latest.url)
  ]);
  const note=notePayload?.data||notePayload||{};
  const user=note.user||note.author||{};

  const avatar=avatarUrl(profile)||avatarUrl(user)||baseCreator.actorImageUrl||latest.actorImageUrl;
  const thumb=thumbnailUrl(note)||latest.thumbUrl||metaThumb;
  if(!avatar)throw new Error('アイコンURLを確認できません：'+id);
  if(!thumb)throw new Error('記事サムネイルが未設定：'+id);
  const biography=profileText(profile);

  return{
   ...latest,
   creator:String(profile.nickname||profile.name||user.nickname||user.name||person.creator||id).trim(),
   actorImageUrl:avatar,
   thumbUrl:thumb,
   title:String(note.name||note.title||latest.title||'無題の記事').trim(),
   profileText:biography,
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
function validateFixedRows(rows){
 if(!Array.isArray(rows)||rows.length!==301)throw new Error('保存済み一覧が300人＋実績の算数の301件ではありません');
 const creators=rows.slice(0,300),final=rows[300];
 if(uniquePeople(creators).length!==300||creators.some((row,index)=>row.finalMarker||Number(row.index)!==index+1))throw new Error('保存済み一覧にクリエイターの重複・不足・順序の不一致があります。「最初に戻る」で一覧を作り直してください');
 if(!final?.finalMarker||Number(final.index)!==301||canonicalUrlname(final)!=='fuku444'||norm(final.url)!==norm(FINAL_URL))throw new Error('最後の実績の算数を確認できません。「最初に戻る」で一覧を作り直してください');
 if(creators.some(row=>sameCreator(row,final)))throw new Error('実績の算数が300人の一覧にも含まれています。「最初に戻る」で一覧を作り直してください');
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
 const signature=String(bridge?.at||0)+'|'+target+'|eligible-v251';
 const previousSignature=String(bridge?.at||0)+'|'+target+'|exact-v250';
 let saved;
 saved=readPrep()
 const compatible=saved?.signature===signature||saved?.signature===previousSignature;
 let rows=Array.isArray(saved?.rows)&&compatible?saved.rows:[];
 let skipped=Array.isArray(saved?.skipped)&&saved.signature===signature?saved.skipped:[];
 let index=compatible?Number(saved.index||0):0;
 let accepted=0;
 const validCheckpoint=Number.isInteger(index)&&index===rows.length+skipped.length&&index<=people.length&&rows.length<=target&&uniquePeople([...rows,...skipped]).length===index&&skipped.every(person=>String(person.reason||'').trim())&&people.slice(0,index).every(person=>skipped.some(entry=>sameCreator(entry,person))||sameCreator(rows[accepted++],person))&&accepted===rows.length;
 if(!validCheckpoint)throw new Error('確認途中の保存データに重複・順序の不一致があります。スキ履歴を取得し直してください');
 if(saved?.signature===previousSignature){writePrep({...saved,signature,index,rows,skipped,updatedAt:Date.now()});await flushPrepBackup();}

 while(index<people.length&&rows.length<target){
  if(stopRequested)throw new Error('停止しました');
  const batch=people.slice(index,index+Math.min(4,target-rows.length));
  setStatus('スキ履歴300｜確認 '+rows.length+'/'+target+'｜候補 '+(index+batch.length)+'/'+people.length+'｜除外 '+skipped.length);
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
  await sleep(60)
 }
 if(rows.length<target)throw new Error('貼り付け可能なクリエイター '+rows.length+'/'+target+'人｜公開記事なし・取得不可 '+skipped.length+'人を除外。300人に不足しています。スキ履歴を取得し直してください');
 return rows.slice(0,target).map((row,index)=>({...row,index:index+1}))
}
async function replaceUnavailableCreator(rows,index,error){
 validateFixedRows(rows);
 if(stopRequested||/停止しました|手動停止/.test(String(error?.message||error)))throw error||new Error('停止しました');
 if(!Number.isInteger(index)||index<0||index>=300)throw new Error('最後の実績の算数は除外できません。画像の取得を再試行してください');
 const failed=rows[index],bridge=await Promise.resolve(GM_getValue(BRIDGE_KEY,null)),people=uniquePeople(Array.isArray(bridge?.people)?bridge.people:[]);
 if(!people.length)throw new Error('追加候補の保存データがありません。現在の貼り付けは保持しました');
 const signature=String(bridge?.at||0)+'|300|eligible-v251',previousSignature=String(bridge?.at||0)+'|300|exact-v250';
 let checkpoint;
 checkpoint=readPrep()
 let selected,skipped,scanned;
 if(checkpoint?.signature===signature||checkpoint?.signature===previousSignature){
  selected=Array.isArray(checkpoint.rows)?checkpoint.rows:[];
  skipped=checkpoint.signature===signature&&Array.isArray(checkpoint.skipped)?checkpoint.skipped:[];
  scanned=Number(checkpoint.index||0);
  let accepted=0;
  const valid=Number.isInteger(scanned)&&scanned===selected.length+skipped.length&&scanned<=people.length&&selected.length<=300&&uniquePeople([...selected,...skipped]).length===scanned&&skipped.every(person=>String(person.reason||'').trim())&&people.slice(0,scanned).every(person=>skipped.some(entry=>sameCreator(entry,person))||sameCreator(selected[accepted++],person))&&accepted===selected.length;
  if(!valid)throw new Error('追加候補の保存順序を確認できません。現在の貼り付けは保持しました');
  if(!selected.some(person=>sameCreator(person,failed))&&!skipped.some(person=>sameCreator(person,failed)))throw new Error('取得できなかったクリエイターと保存済み一覧が一致しません。現在の貼り付けは保持しました');
 }else{
  const creators=rows.slice(0,300),positions=[];
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
 const filled=await buildRows(300);
 if(rows.slice(0,index).some((row,position)=>!sameCreator(row,filled[position])))throw new Error('貼り付け済みの順序を維持できません。現在の貼り付けは保持しました');
 const refreshed=filled.map((person,position)=>{if(position<index)return rows[position];const previous=rows.slice(0,300).find(row=>sameCreator(row,person));return previous?{...person,...previous,index:position+1}:{...person,index:position+1}});
 refreshed.push({...rows[300],index:301});
 for(let position=index;position<refreshed.length;position++){
  const row=refreshed[position],before=refreshed[position-1]?.designIndex,next=refreshed[position+1]?.designIndex;
  if(Number.isInteger(row.designIndex)&&row.designIndex>=0&&row.designIndex<50&&row.designIndex!==before)continue;
  const choices=Array.from({length:50},(_,style)=>style).filter(style=>style!==before&&style!==next);
  refreshed[position]={...row,designIndex:choices[Math.floor(Math.random()*choices.length)]};
 }
 validateFixedRows(refreshed);
 const latest=readPrep();if(latest?.signature===signature){writePrep({...latest,rows:refreshed.slice(0,300),updatedAt:Date.now()});await flushPrepBackup();}
 return refreshed
}
async function recoverCompatibleRun(view,existing){
 if(!existing||existing.articleKey!==editorArticleKey())throw new Error('現在の記事に対応する保存データを確認できません。本文は保持しています');
 let originalPlan=null;
 try{if(Array.isArray(existing.rows)&&existing.rows.length===301)originalPlan=validateFixedRows(existing.rows)}catch{}
 const currentFragment=/^2\.5\.\d+(?:$|\b)/.test(String(existing.version||''));
 const knownHistory=existing.likesHistory===true&&Number(existing.count)===300&&originalPlan;
 if(!currentFragment&&!knownHistory)throw new Error('この保存データをスキ300人の貼り付けとして確認できません。本文は保持しています');
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
  if(Array.isArray(checkpoint?.rows)&&checkpoint.rows.length===300&&/\|300\|(?:eligible-v251|exact-v250)$/.test(String(checkpoint.signature||''))){
   const final=originalPlan?.[300]||await enrichFinal();
   try{rows=verify(validateFixedRows([...checkpoint.rows.map((row,position)=>({...row,index:position+1})),{...final,index:301}]))}catch{}
  }
 }
 if(!rows){const creators=await buildRows(300);rows=verify(validateFixedRows([...creators,await enrichFinal()]))}
 for(let position=0;position<rows.length;position++){
  const row=rows[position],before=rows[position-1]?.designIndex,next=rows[position+1]?.designIndex;
  if(position<owned.length&&(Array.isArray(existing.rows)?existing.rows:[]).some(person=>sameCreator(person,row)&&norm(person.url)===norm(row.url)&&person.designIndex===row.designIndex)&&Number.isInteger(row.designIndex)&&row.designIndex>=0&&row.designIndex<50)continue;
  if(Number.isInteger(row.designIndex)&&row.designIndex>=0&&row.designIndex<50&&row.designIndex!==before)continue;
  const choices=Array.from({length:50},(_,style)=>style).filter(style=>style!==before&&style!==next);
  rows[position]={...row,designIndex:choices[Math.floor(Math.random()*choices.length)]}
 }
 const blocks=[];
 if(typeof view.state.doc.forEach==='function')view.state.doc.forEach((node,pos)=>blocks.push({node,pos}));
 else view.state.doc.descendants((node,pos)=>{blocks.push({node,pos});return false});
 const headings=new Set(existing.sectionHeadings||[]),activities=new Set(existing.activityTexts||[]),dividers=new Set(existing.dividerUrls||[]);
 let anchor=owned[0]?.pos??(Number(existing.imageAnchorPos)||0);
 const recoverProfile=(block,row)=>{
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
  const expected=row.finalMarker?'最後に｜実績の算数':position%10===0?headingText(Math.floor(position/10)):'';
  if(expected&&blocks[before]?.node?.type?.name==='heading'&&String(blocks[before].node.textContent||'')===expected){headings.add(expected);if(position===0)anchor=blocks[before].pos}
  if(isDivider(view,blocks[blockIndex+1]?.node))dividers.add(row.url);
 }
 if(owned.length&&owned.length<rows.length){
  const last=owned[owned.length-1],at=blocks.findIndex(block=>block.pos===last.pos),row=rows[owned.length];
  let after=at+1;if(isDivider(view,blocks[after]?.node))after++;
  const expected=row.finalMarker?'最後に｜実績の算数':owned.length%10===0?headingText(Math.floor(owned.length/10)):'';
  if(expected&&blocks[after]?.node?.type?.name==='heading'&&String(blocks[after].node.textContent||'')===expected){headings.add(expected);after++}
  if(!row.finalMarker)recoverProfile(blocks[after],row)
 }
 return{...existing,version:VERSION,articleKey:editorArticleKey(),likesHistoryFix230:true,likesHistory:true,rows,items:records,count:300,choice:'latest',mode:'number',stage:owned.length===301?(['images_ready','cards_building','complete'].includes(existing.stage)?existing.stage:'images_ready'):'images_building',imageAnchorPos:Number.isFinite(Number(existing.imageAnchorPos))&&Number(existing.imageAnchorPos)>=0&&Number(existing.imageAnchorPos)<=anchor?Number(existing.imageAnchorPos):anchor,sectionHeadings:[...headings],activityTexts:[...activities],dividerUrls:[...dividers],cardKeys:Array.isArray(existing.cardKeys)?existing.cardKeys:[],cardBaselineKeys:Array.isArray(existing.cardBaselineKeys)?existing.cardBaselineKeys:embedNodes(view).map(cardKey).filter(Boolean),sources:existing.sources||'スキ履歴（読み取りのみ）',recoveredAt:Date.now(),updatedAt:Date.now()}
}
async function ensureCardsRunReady(view){
 await Promise.all([hydrateRunBackup(),hydratePrepBackup()]);
 let run=readRun();
 if(!run)return null;
 if(Array.isArray(run.rows)&&run.rows.length&&['images_ready','cards_building','complete'].includes(run.stage))return run;
 const checkpoint=readPrep();
 const currentVersion=/^2\.5\.\d+(?:$|\b)/.test(String(run.version||''));
 const fragment=currentVersion&&!Array.isArray(run.rows)&&Array.isArray(checkpoint?.rows)&&checkpoint.rows.length===300;
 const savedPlan=currentVersion&&Array.isArray(run.rows)&&run.rows.length===301;
 if(!run.likesHistoryFix230&&!(run.likesHistory&&Number(run.count)===300)&&!fragment&&!savedPlan)return run;
 if(!run.likesHistoryFix230){run=await recoverCompatibleRun(view,run);}
 let rows;try{rows=validateFixedRows(run.rows)}catch{run=await recoverCompatibleRun(view,run);rows=validateFixedRows(run.rows)}
 const images=ownedImagesForRun(view,run);
 const count=completedImagePrefix(rows,images);
 if(count!==301)throw new Error('本文の画像を照合しました：'+count+'/301件。完成分は保持しています');
 run={...run,rows,stage:'images_ready',imagesCompletedAt:run.imagesCompletedAt||Date.now(),updatedAt:Date.now()};
 writeRun(run);await flushRunBackup();return readRun()
}
async function enrichFinal(){
 const person={urlname:'fuku444',creator:'実績の算数',actorUrl:'https://note.com/fuku444',actorImageUrl:'',likerKey:'final-performance-math'};
 const row={...person,url:FINAL_URL,key:FINAL_KEY,title:'実績の算数│3日半で0→1達成',thumbUrl:'',publishAt:null};
 try{
  const [notePayload,profilePayload,metaThumb]=await Promise.all([
   xhrJSON('https://note.com/api/v3/notes/'+FINAL_KEY).catch(()=>({})),
   xhrJSON('https://note.com/api/v2/creators/fuku444').catch(()=>({})),
   articleMetaImage(FINAL_URL)
  ]);
  const note=notePayload?.data||notePayload||{};
  const profile=profilePayload?.data?.creator||profilePayload?.data?.user||profilePayload?.data||profilePayload||{};
  const user=note.user||note.author||{};
  const avatar=avatarUrl(profile)||avatarUrl(user);
  const thumb=thumbnailUrl(note)||metaThumb;

  return{...row,creator:String(profile.nickname||profile.name||user.nickname||user.name||'実績の算数'),actorImageUrl:avatar,thumbUrl:thumb,finalMarker:true,index:301}
 }catch{return{...row,finalMarker:true,index:301}}
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
function assignDesigns(rows){
 const valid=rows.every((row,i)=>Number.isInteger(row.designIndex)&&row.designIndex>=0&&row.designIndex<50&&(i===0||row.designIndex!==rows[i-1].designIndex));
 if(valid)return rows;
 let pool=[],last=-1;
 return rows.map(row=>{
  if(!pool.length){
   pool=Array.from({length:50},(_,i)=>i);
   for(let i=pool.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
   if(pool[pool.length-1]===last)[pool[0],pool[pool.length-1]]=[pool[pool.length-1],pool[0]];
  }
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
async function makeFile(row){
 const images=await Promise.allSettled([bitmapFromUrl(row.actorImageUrl),bitmapFromUrl(row.thumbUrl)]);
 const [avatar,thumb]=images.map(result=>result.status==='fulfilled'?result.value:null);
 if(!avatar||!thumb){
  try{avatar?.close?.();thumb?.close?.()}catch{}
  const reason=images.find(result=>result.status==='rejected')?.reason?.message;
  const error=new Error(row.creator+'さん：'+(!avatar?'アイコン':'記事サムネイル')+'を表示できません'+(reason?'（'+reason+'）':''));
  error.code='ASSET_UNAVAILABLE';throw error;
 }
 const index=Number.isInteger(row.designIndex)?row.designIndex:assignDesigns([row])[0].designIndex;
 const theme=palettes[Math.floor(index/10)%palettes.length];
 const canvas=document.createElement('canvas');
 canvas.width=W;canvas.height=H;
 const ctx=canvas.getContext('2d');
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

 try{avatar?.close?.()}catch{}
 try{if(thumb!==avatar)thumb?.close?.()}catch{}
 const blob=await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('画像生成失敗')),'image/png',1));
 return new page.File([blob],'mumei_profile_note_v22_'+String(row.index).padStart(3,'0')+'.png',{type:'image/png'})
}

function headingText(group){
 const from=group*10+1,to=Math.min(from+9,300);
 return String(group+1).padStart(2,'0')+'｜'+from+'人目〜'+to+'人目のクリエイター様'
}
function activityText(row){return'プロフィール｜'+row.creator+'さん：'+(row.profileText||'プロフィール未設定')}
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
 const small=view.state.schema.marks?.small;
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
function restartFixed300(){
 if(busy||exportWaiter||coreBusy()){setStatus('実行中です。先に「停止」を押してください',true);return;}
 const run=readRun();
 if(run?.likesHistoryFix230&&Array.isArray(run.rows)&&run.rows.length===301){
  try{validateFixedRows(run.rows)}catch(error){setStatus(error?.message||String(error),true);return;}
  const view=findView();if(!view){setStatus('note本文編集欄を取得できません',true);return;}
  clearCurrentPaste(view,run);
  writeRun({...run,version:VERSION,items:[],cardKeys:[],sectionHeadings:[],activityTexts:[],dividerUrls:[],stage:'images_building',imageAnchorPos:Math.min(view.state.doc.content.size,Math.max(0,Number(run.imageAnchorPos)||0)),cardBaselineKeys:embedNodes(view).map(cardKey).filter(Boolean),createdAt:Date.now()});
  return createFixed300();
 }
 return startFixed300();
}
async function resumeFixed300(){
 if(busy||exportWaiter||coreBusy()){setStatus('実行中です。先に「停止」を押してください',true);return;}
 try{
  await Promise.all([hydrateRunBackup(),hydratePrepBackup()]);
  const run=readRun();
  if(run?.items?.length||run?.rows?.length)return createFixed300();
  const bridge=await Promise.resolve(GM_getValue(BRIDGE_KEY,null));
  if(!Array.isArray(bridge?.people)||!bridge.people.length){setStatus('読み込みの続きがありません。「① 最初から」でスキ履歴を取得してください',true);return;}
  let saved;saved=readPrep()
  setStatus('読み込みの続きから｜確認済み '+(saved?.rows?.length||0)+'人｜取得できない人は飛ばします');
  return createFixed300();
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

async function createFixed300(){
 if(busy||coreBusy()){setStatus('実行中です。先に「停止」を押してください',true);return;}
 busy=true;stopRequested=false;notifyFixedState();
 await keepAwake();
 try{
  await Promise.all([hydrateRunBackup(),hydratePrepBackup()]);
  if(stopRequested)throw new Error('停止しました');
  setStatus('修正版を開始｜実アイコン・記事サムネ・外部プロフィール文を確認中');
  const view=findView();
  if(!view)throw new Error('note本文編集欄を取得できません');
  nativeImageCommand();selectionApi();

  let existing=readRun();
  if(existing&&!existing.likesHistoryFix230){
   setStatus('保存済みの画像・プロフィールと途中記録を照合中｜貼り付けは保持');
   existing=await recoverCompatibleRun(view,existing);
   writeRun(existing);await flushRunBackup();
  }

  let rows;
  if(existing?.likesHistoryFix230)rows=validateFixedRows(existing.rows);
  else{
   const creators=await buildRows(300);
   const finalRow=await enrichFinal();
   rows=validateFixedRows([...creators,finalRow])
  }
  rows=assignDesigns(rows);

  let run=readRun();
  if(!run?.likesHistoryFix230){
   run={
    version:VERSION,articleKey:editorArticleKey(),items:[],cardKeys:[],sectionHeadings:[],activityTexts:[],rows,
    cardBaselineKeys:embedNodes(view).map(cardKey).filter(Boolean),
    createdAt:Date.now(),stage:'images_building',likesHistory:true,likesHistoryFix230:true,
    imageAnchorPos:cardAnchorFromSelection(view),sources:'スキ履歴（読み取りのみ）',mode:'number',count:300,choice:'latest'
   };
   writeRun(run)
  }else{
   run={...run,rows,stage:'images_building',updatedAt:Date.now()};
   writeRun(run)
  }
  await flushRunBackup();

  const doneImages=ownedImages(view);
  let done=completedImagePrefix(rows,doneImages);
  let insertPos=done?doneImages[done-1].pos+doneImages[done-1].node.nodeSize:Number(run.imageAnchorPos);
  if(!Number.isFinite(insertPos))insertPos=cardAnchorFromSelection(view);
  const nextNode=view.state.doc.nodeAt(insertPos);if(done&&isDivider(view,nextNode))insertPos+=nextNode.nodeSize;

  setStatus('修正版｜'+done+'/'+rows.length+'件済み。続きから貼り付け');
  for(let i=done;i<rows.length;i++){
   if(stopRequested)throw new Error('停止しました');
   const row=rows[i];
   setStatus('画像確認｜'+(i+1)+'/'+rows.length+'｜'+row.creator);
   let file;
   try{file=await makeFile(row)}catch(error){
    if(stopRequested||/停止しました|手動停止/.test(String(error?.message||error)))throw new Error('停止しました');
    if(row.finalMarker||error?.code!=='ASSET_UNAVAILABLE')throw error;
    setStatus(row.creator+'さんの画像を取得できないため除外｜次の候補を補充中');
    const nextRows=validateFixedRows(await replaceUnavailableCreator(rows,i,error));
    completedImagePrefix(nextRows,ownedImages(view));
    rows=nextRows;
    run=readRun()||run;
    writeRun({...run,version:VERSION,rows,imageSkipped:[...(run.imageSkipped||[]),{urlname:row.urlname,likerKey:row.likerKey,reason:error.message}],updatedAt:Date.now()});
    await flushRunBackup();
    i--;continue;
   }
   if(stopRequested)throw new Error('停止しました');

   if(row.finalMarker){
    const text='最後に｜実績の算数';
    const existingHeading=findHeading(view,text);
    if(existingHeading&&existingHeading.pos>=insertPos)insertPos=existingHeading.pos+existingHeading.node.nodeSize;
    else if(!existingHeading){const h=insertHeadingAt(view,text,insertPos);insertPos=h.nextPos;recordHeading(text)}
   }else if(i%10===0){
    const text=headingText(Math.floor(i/10));
    const existingHeading=findHeading(view,text);
    if(existingHeading&&existingHeading.pos>=insertPos)insertPos=existingHeading.pos+existingHeading.node.nodeSize;
    else if(!existingHeading){const h=insertHeadingAt(view,text,insertPos);insertPos=h.nextPos;recordHeading(text)}
   }

   if(!row.finalMarker){
    const text=activityText(row);
    const existingActivity=findActivity(view,text,insertPos);
    if(existingActivity&&existingActivity.pos>=insertPos)insertPos=existingActivity.pos+existingActivity.node.nodeSize;
    else if(!existingActivity){const a=insertActivityAt(view,row,insertPos);insertPos=a.nextPos;recordActivity(a.text)}
   }

   setStatus('修正版｜'+(i+1)+'/'+rows.length+'｜'+row.creator+'｜アイコン＋サムネ');
   if(stopRequested)throw new Error('停止しました');
   const made=await uploadOne(view,row,file,insertPos);
   insertPos=made.nextPos;
   recordImage(made.hit,row);
   insertPos=addDivider(view,made.hit,row);
   await flushRunBackup();
   await sleep(IMAGE_GAP)
  }

  run=readRun()||run;
  writeRun({...run,stage:'images_ready',rows,imagesCompletedAt:Date.now(),updatedAt:Date.now()});
  await flushRunBackup();
  if(typeof page.__MUMEI_PROFILE_CARD_SAVE_DRAFT__==='function')await page.__MUMEI_PROFILE_CARD_SAVE_DRAFT__('極薄300人＋実績1件｜画像貼付完了。下書き保存中…');
  setStatus('極薄301件完了 ✅ カードを置く本文位置をタップ→②カード続き/開始')
 }catch(error){
  setStatus('修正版停止：'+(error?.message||String(error)),true)
 }finally{busy=false;notifyFixedState();await releaseAwake()}
}
function stopFix(){
 if(exportWaiter){const waiting=exportWaiter;exportWaiter=null;clearTimeout(waiting.timer);try{waiting.popup.close()}catch{}waiting.reject(new Error('停止しました'));}
 stopRequested=true;
 notifyFixedState();
 abortRequests();
 setStatus('修正版を停止しました｜完成分は保持')
}

function patchPanel(){
 const panel=document.getElementById(PANEL);
 if(!panel)return false;
 const title=panel.querySelector('.title');
 if(title)title.textContent='紹介貼付 v'+VERSION;

 const detail=panel.querySelector('details[data-like300]');
 if(!detail)return false;
 const summary=detail.querySelector('summary');
 if(summary)summary.textContent='＋ スキ履歴から300人';
 const hint=detail.querySelector('.hint');
 if(hint)hint.textContent='取得不可は飛ばす｜300人＋実績1件｜50種ランダム｜10人ごと大見出し';

 const oldButton=detail.querySelector('[data-a="like300-images"],[data-a="like300-fixed"]');
 if(oldButton){
  const button=oldButton.cloneNode(true);
  button.dataset.a='like300-fixed';
  button.textContent='① 最初から';
  button.style.background='#176b54';
  button.style.borderColor='#5bd7a7';
  oldButton.replaceWith(button);
  button.addEventListener('click',event=>{event.preventDefault();void restartFixed300()})
 }

 let resume=detail.querySelector('[data-a="like300-resume"]');
 if(resume)resume.remove();
 resume=document.createElement('button');resume.dataset.a='like300-resume';resume.textContent='続きから';resume.style.cssText='background:#244c66;border-color:#69bfe8';
 (detail.querySelector('.special-actions')||detail).appendChild(resume);resume.addEventListener('click',event=>{event.preventDefault();void resumeFixed300();});
 const prep=detail.querySelector('[data-a="like300-prep"]');
 prep?.remove();
 const actions=detail.querySelector('.special-actions');if(actions)actions.style.gridTemplateColumns='1fr';
 const cards=panel.querySelector('[data-a="cards"]');
 if(cards){
  cards.textContent='② カード続き／開始';
  cards.style.cssText='background:#34518a;border-color:#7897df';
  (actions||detail).appendChild(cards);
  if(!cards.dataset.currentCardHandler){
   cards.dataset.currentCardHandler='1';
   cards.addEventListener('click',event=>{
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
 (actions||detail).appendChild(audit);
 const deleteCards=panel.querySelector('[data-a="delete"]');
 if(deleteCards&&!deleteCards.dataset.currentDeleteHandler){
  deleteCards.dataset.currentDeleteHandler='1';
  deleteCards.addEventListener('click',event=>{
   const remove=page.__MUMEI_PROFILE_CARD_DELETE_CARDS__;
   if(typeof remove!=='function')return;
   event.preventDefault();event.stopImmediatePropagation();void remove();
  },{capture:true});
 }

 const stop=panel.querySelector('[data-a="stop"]');
 stop?.addEventListener('pointerdown',()=>stopFix(),{capture:true});
 stop?.addEventListener('touchstart',()=>stopFix(),{capture:true,passive:true});
 return true
}
let attempts=0;
window.addEventListener('mumei-profile-card-start',()=>void restartFixed300());
window.addEventListener('mumei-profile-card-stop',()=>stopFix());
const timer=setInterval(()=>{
 attempts++;
 if(patchPanel()||attempts>240)clearInterval(timer)
},250);
patchPanel();

})();

