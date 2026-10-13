// ==UserScript==
// @name         無名S note アイコン＋キャプション 貼り付け装置
// @namespace    https://github.com/mumei-s/note-insight/profile-card-paster
// @version      2.3.3
// @description  INSIGHTスキ履歴300人修正版。実アイコン・最新記事サムネイルを極薄へ表示し、プロフィール本文を画像外の上段テキストとして挿入。
// @match        https://editor.note.com/*
// @match        https://mumei-s.github.io/note-insight/*
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        unsafeWindow
// @connect      note.com
// @connect      assets.st-note.com
// @connect      *
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-profile-card-paster-core-v232.js
// @updateURL    https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-profile-card-paster-v22.user.js
// @downloadURL  https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-profile-card-paster-v22.user.js
// ==/UserScript==

(function(){
'use strict';

const page=typeof unsafeWindow!=='undefined'?unsafeWindow:window;
if(location.hostname==='mumei-s.github.io'){
 if(!page.__MUMEI_LIKES_PANEL_CLEANUP_V232__){
  page.__MUMEI_LIKES_PANEL_CLEANUP_V232__=true;
  const ids=['mumei-like300-bridge','mumei-like300-fix','mumei-like300-fix-editor','mumei-like300-fix-editor-v221'];
  const style=document.createElement('style');style.id='mumei-like300-panel-off-v232';style.textContent=ids.map(id=>'#'+id).join(',')+'{display:none!important}';(document.head||document.documentElement).appendChild(style);
  const doc=document,remove=()=>{for(const id of ids)doc.getElementById(id)?.remove();};
  remove();new MutationObserver(remove).observe(document.documentElement,{childList:true,subtree:true});
 }
 return;
}
if(location.hostname!=='editor.note.com')return;
if(page.__MUMEI_LIKE300_FIX_V233__)return;
page.__MUMEI_LIKE300_FIX_V233__=true;

const VERSION='2.3.3';
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
function readRun(){try{return JSON.parse(localStorage.getItem(runKey())||'null')}catch{return null}}
function writeRun(value){try{if(value==null)localStorage.removeItem(runKey());else localStorage.setItem(runKey(),JSON.stringify(value))}catch{}}
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
 const requestId='likes300-'+Date.now()+'-'+Math.random().toString(36).slice(2),url=new URL('https://mumei-s.github.io/note-insight/insight-likes-export.html');
 url.searchParams.set('request',requestId);url.searchParams.set('count','500');url.searchParams.set('unique','1');url.searchParams.set('scope','recent-articles');
 const popup=window.open(url.href,'_blank');
 if(!popup)return Promise.reject(new Error('スキ履歴取得画面を開けません。ブラウザのポップアップを確認してください'));
 let resolve,reject;const promise=new Promise((ok,fail)=>{resolve=ok;reject=fail});
 const timer=setTimeout(()=>{if(exportWaiter?.requestId===requestId){exportWaiter=null;reject(new Error('スキ履歴の取得待ちが時間切れになりました'));}},120000);
 exportWaiter={requestId,popup,promise,resolve,reject,timer};setStatus('以前の方式でスキ履歴を取得中｜保存済みログインを使用');return promise;
}
window.addEventListener('message',async event=>{
 const waiting=exportWaiter,payload=event.data;
 if(!waiting||event.origin!=='https://mumei-s.github.io'||event.source!==waiting.popup||payload?.type!=='MUMEI_INSIGHT_LIKES_V1'||payload.requestId!==waiting.requestId)return;
 exportWaiter=null;clearTimeout(waiting.timer);
 try{
  if(payload.ok!==true)throw new Error(String(payload.error||'スキ履歴取得失敗'));
  const people=uniquePeople(Array.isArray(payload.rows)?payload.rows:[]);
  if(!people.length)throw new Error('スキ履歴に対象のクリエイターがありません');
  await Promise.resolve(GM_setValue(BRIDGE_KEY,{version:231,scope:'recent-articles',at:Date.now(),people}));
  setStatus('スキ履歴 '+people.length+'人を受け取りました');waiting.resolve(people);
 }catch(error){waiting.reject(error);}
});
function startFixed300(){
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
  if(fresh.length>1)return fresh.at(-1);
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
 const id=String(person?.urlname||'').trim();
 if(!id)return null;
 try{
  const [contents,profilePayload]=await Promise.all([
   creatorContents(id),
   xhrJSON('https://note.com/api/v2/creators/'+encodeURIComponent(id))
  ]);
  const list=contentList(contents);
  const baseCreator={
   likerKey:String(person.likerKey||id),
   urlname:id,
   creator:String(person.creator||id),
   actorUrl:String(person.actorUrl||('https://note.com/'+id)),
   actorImageUrl:mediaUrl(person.actorImageUrl||'')
  };
  const latest=articleFromRaw(list[0],baseCreator);
  if(!latest)return null;

  const [notePayload,metaThumb]=await Promise.all([
   xhrJSON('https://note.com/api/v3/notes/'+encodeURIComponent(latest.key)).catch(()=>({})),
   articleMetaImage(latest.url)
  ]);
  const profile=profilePayload?.data?.creator||profilePayload?.data?.user||profilePayload?.data||profilePayload||{};
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
 }catch{return null}
}
function uniquePeople(people){
 const seen=new Set(['fuku444']);
 return people.filter(person=>{
  const id=String(person?.urlname||'').trim().toLowerCase();
  if(!id||seen.has(id))return false;
  seen.add(id);return true
 })
}
async function buildRows(target=300){
 const bridge=await Promise.resolve(GM_getValue(BRIDGE_KEY,null));
 const people=uniquePeople(Array.isArray(bridge?.people)?bridge.people:[]);
 if(!people.length)throw new Error('INSIGHT側の準備データがありません。「INSIGHTで準備」を先に押してください');
 const signature=String(bridge?.at||0)+'|'+target;
 let saved;
 try{saved=JSON.parse(localStorage.getItem(prepKey())||'null')}catch{saved=null}
 let rows=uniquePeople(Array.isArray(saved?.rows)&&saved.signature===signature?saved.rows:[]);
 let index=saved?.signature===signature?Number(saved.index||0):0;
 const seen=new Set(rows.map(x=>String(x.urlname||'').toLowerCase()).filter(Boolean));

 while(index<people.length&&rows.length<target){
  if(stopRequested)throw new Error('停止しました');
  const batch=people.slice(index,index+4);
  index+=batch.length;
  setStatus('スキ履歴300｜アイコン・サムネ・プロフィール確認 '+rows.length+'/'+target+'｜候補 '+index+'/'+people.length);
  const prepared=await Promise.all(batch.map(preparePerson));
  for(const row of prepared){
   const id=String(row?.urlname||'').toLowerCase();
   if(!row||!id||seen.has(id))continue;
   seen.add(id);
   rows.push(row);
   if(rows.length>=target)break
  }
  try{localStorage.setItem(prepKey(),JSON.stringify({signature,index,rows,updatedAt:Date.now()}))}catch{}
  await sleep(60)
 }
 if(rows.length<target)throw new Error('公開記事を確認できたクリエイターが '+rows.length+'人でした。INSIGHT側で再準備してください');
 return rows.slice(0,target).map((row,index)=>({...row,index:index+1}))
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
  throw new Error(row.creator+'さん：'+(!avatar?'アイコン':'記事サムネイル')+'を表示できません'+(reason?'（'+reason+'）':''))
 }
 const index=hash(row.key||row.url||row.creator)%50;
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
 if(busy||exportWaiter){setStatus('実行中です。先に「停止」を押してください',true);return;}
 const run=readRun();
 if(run?.likesHistoryFix230&&Array.isArray(run.rows)&&run.rows.length===301){
  const view=findView();if(!view){setStatus('note本文編集欄を取得できません',true);return;}
  clearCurrentPaste(view,run);
  writeRun({...run,version:VERSION,items:[],cardKeys:[],sectionHeadings:[],activityTexts:[],dividerUrls:[],stage:'images_building',imageAnchorPos:Math.min(view.state.doc.content.size,Math.max(0,Number(run.imageAnchorPos)||0)),cardBaselineKeys:embedNodes(view).map(cardKey).filter(Boolean),createdAt:Date.now()});
  return createFixed300();
 }
 return startFixed300();
}
function resumeFixed300(){
 const run=readRun();
 if(!run?.likesHistoryFix230||!Array.isArray(run.rows)||run.rows.length!==301){setStatus('続きのデータがありません。「① 最初から」を押してください',true);return;}
 return createFixed300();
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
function ownedImages(view){
 const run=readRun(),records=Array.isArray(run?.items)?run.items:[],all=imageNodes(view),owned=new Map();
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
 if(busy)return;
 busy=true;stopRequested=false;
 await keepAwake();
 try{
  setStatus('修正版を開始｜実アイコン・記事サムネ・外部プロフィール文を確認中');
  const view=findView();
  if(!view)throw new Error('note本文編集欄を取得できません');
  nativeImageCommand();selectionApi();

  const existing=readRun();
  if(!existing?.likesHistoryFix230&&((existing?.items?.length||0)||(existing?.cardKeys?.length||0)))throw new Error('旧版の作成分が残っています。「最初に戻る」で消してから修正版を実行してください');

  let rows;
  if(existing?.likesHistoryFix230&&Array.isArray(existing.rows)&&existing.rows.length===301)rows=existing.rows;
  else{
   const creators=await buildRows(300);
   const finalRow=await enrichFinal();
   rows=[...creators,finalRow]
  }

  let run=readRun();
  if(!run?.likesHistoryFix230){
   run={
    version:VERSION,articleKey:editorArticleKey(),items:[],cardKeys:[],sectionHeadings:[],activityTexts:[],rows,
    cardBaselineKeys:embedNodes(view).map(cardKey).filter(Boolean),
    createdAt:Date.now(),stage:'images_building',likesHistory:true,likesHistoryFix230:true,
    imageAnchorPos:cardAnchorFromSelection(view),sources:'INSIGHT スキ履歴',mode:'number',count:300,choice:'latest'
   };
   writeRun(run)
  }else{
   run={...run,rows,stage:'images_building',updatedAt:Date.now()};
   writeRun(run)
  }

  const doneImages=ownedImages(view);
  let done=Math.min(doneImages.length,rows.length);
  let insertPos=done?doneImages[done-1].pos+doneImages[done-1].node.nodeSize:Number(run.imageAnchorPos);
  if(!Number.isFinite(insertPos))insertPos=cardAnchorFromSelection(view);
  const nextNode=view.state.doc.nodeAt(insertPos);if(done&&isDivider(view,nextNode))insertPos+=nextNode.nodeSize;

  setStatus('修正版｜'+done+'/'+rows.length+'件済み。続きから貼り付け');
  for(let i=done;i<rows.length;i++){
   if(stopRequested)throw new Error('停止しました');
   const row=rows[i];
   setStatus('画像確認｜'+(i+1)+'/'+rows.length+'｜'+row.creator);
   const file=await makeFile(row);
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
   await sleep(IMAGE_GAP)
  }

  run=readRun()||run;
  writeRun({...run,stage:'images_ready',rows,imagesCompletedAt:Date.now(),updatedAt:Date.now()});
  setStatus('修正版完了 ✅ アイコン・記事サムネ・外部プロフィール文｜次は②カード続き/開始')
 }catch(error){
  setStatus('修正版停止：'+(error?.message||String(error)),true)
 }finally{busy=false;await releaseAwake()}
}
function stopFix(){
 if(exportWaiter){const waiting=exportWaiter;exportWaiter=null;clearTimeout(waiting.timer);waiting.reject(new Error('停止しました'));}
 stopRequested=true;
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
 if(hint)hint.textContent='プロフィール全文・通常本文｜区切り線あり';

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
 const reset=panel.querySelector('[data-a="reset"]');
 reset?.addEventListener('click',()=>removeActivityLines(),{capture:true});
 const stop=panel.querySelector('[data-a="stop"]');
 stop?.addEventListener('pointerdown',()=>stopFix(),{capture:true});
 stop?.addEventListener('touchstart',()=>stopFix(),{capture:true,passive:true});
 return true
}
let attempts=0;
const timer=setInterval(()=>{
 attempts++;
 if(patchPanel()||attempts>240)clearInterval(timer)
},250);
patchPanel();

})();