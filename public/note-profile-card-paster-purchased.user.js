// ==UserScript==
// @name         無名S note 購入記事紹介
// @namespace    https://github.com/mumei-s/note-insight/purchased-review
// @version      2.8.1
// @description  購入記事紹介専用。小さめの通常サムネ・無料部分の要約紹介・記事リンク。
// @match        https://editor.note.com/*
// @noframes
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        unsafeWindow
// @connect      assets.st-note.com
// @updateURL    https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-profile-card-paster-purchased.user.js
// @downloadURL  https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-profile-card-paster-purchased.user.js
// ==/UserScript==

(function(){
'use strict';
if(location.hostname!=='editor.note.com')return;
const page=typeof unsafeWindow!=='undefined'?unsafeWindow:window;
const VERSION='2.8.1';
if(page.__MUMEI_PURCHASE_REVIEW_VERSION__===VERSION)return;
page.__MUMEI_PURCHASE_REVIEW_VERSION__=VERSION;
const PANEL='mumei-purchased-review-panel',STATUS=PANEL+'-status';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const norm=value=>{try{const url=new URL(String(value||''),location.href);url.search='';url.hash='';return url.href}catch{return String(value||'').trim()}};
const editorArticleKey=()=>location.pathname.match(/^\/notes\/(n[a-z0-9]{8,})\/edit\/?$/i)?.[1]||'';
const runKey=()=> 'mumei_purchase_review_run_v1:'+(editorArticleKey()||'unknown');
let busy=false,stopRequested=false,pauseRequested=false,nativeImageUploadActive=false,wakeLock=null,exportWaiter=null;
let viewCache=null,imageCommandCache=null,selectionCache=null;
const activeRequests=new Set();
function coreBusy(){try{return Boolean(page.__MUMEI_PROFILE_CARD_CORE_BUSY__?.()||page.__MUMEI_PROFILE_CARD_FIXED_BUSY__?.())}catch{return false}}
async function keepAwake(){try{if(page.navigator?.wakeLock?.request&&!document.hidden)wakeLock=await page.navigator.wakeLock.request('screen')}catch{}}
async function releaseAwake(){try{await wakeLock?.release?.()}catch{}wakeLock=null}
function setStatus(text,bad=false){const node=document.getElementById(STATUS);if(node){node.textContent=text;node.dataset.bad=bad?'1':'0'}}
function notifyFixedState(){
 const panel=document.getElementById(PANEL);if(!panel)return;
 for(const node of panel.querySelectorAll('[data-purchase-import],[data-purchase-start],[data-purchase-delete],[data-purchase-file]'))node.disabled=busy;
 const pause=panel.querySelector('[data-purchase-pause]');if(pause){pause.disabled=false;pause.textContent=busy&&pauseRequested?'停止受付中…':'一時停止'}
}
function checkPause(){if(pauseRequested)throw Object.assign(new Error('一時停止しました。貼り付け／再開で続けられます'),{code:'PAUSED'})}
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

function purchaseAssetUrl(value,width){
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

function completedImagePrefix(rows,images){
 if(images.length>rows.length)throw new Error('保存済み画像が一覧の件数を超えています。本文を確認してください');
 for(let index=0;index<images.length;index++){
  if(!rows[index]?.url||norm(images[index]?.node?.attrs?.link)!==norm(rows[index].url))throw new Error('画像の不足・順序の変更を検出しました。'+(index+1)+'人目から本文を確認し、「① 最初から」で作り直してください');
 }
 return images.length
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

function assertPurchaseTracking(view,run=readRun()){
 if(!Array.isArray(run?.imageBaselineRecords))throw new Error('貼り付け前の画像記録を確認できません');
 const owned=new Set(ownedImagesForRun(view,run).map(hit=>hit.pos));
 for(const hit of imageNodes(view)){
  if(owned.has(hit.pos))continue;
  const id=String(hit.node.attrs?.id||''),src=String(hit.node.attrs?.src||''),link=norm(hit.node.attrs?.link||'');
  const original=run.imageBaselineRecords.some(record=>id?record.id===id:src&&record.src===src&&norm(record.link||'')===link);
  if(!original)throw new Error('保存記録のない画像を検出しました。二重貼り付けを防ぐため停止しました。本文の直前の画像を確認してください');
 }
}

function nativeDraftSaveButton(allowDisabled=false){
 const matches=[...document.querySelectorAll('button')].filter(button=>{
  if(!/^(一時保存|下書き保存)$/.test(String(button.textContent||'').trim())||!button.getClientRects?.().length)return false;
  if(button.closest?.('#'+PANEL+',[id^="mumei-"],.ProseMirror,a,[role="link"],[role="dialog"]'))return false;
  if(button.hasAttribute?.('formaction')||button.hasAttribute?.('href'))return false;
  return allowDisabled||!button.disabled&&button.getAttribute?.('aria-disabled')!=='true';
 });
 const headerMatches=matches.filter(button=>button.closest?.('header,[role="banner"]'));
 if(headerMatches.length)return headerMatches.length===1?headerMatches[0]:null;
 return matches.length===1?matches[0]:null;
}
function draftSaveNotices(){
 return [...document.querySelectorAll('[role="status"],[aria-live]')].filter(node=>node.getClientRects?.().length&&!node.closest?.('#'+PANEL+',[id^="mumei-"],.ProseMirror')).map(node=>String(node.textContent||'').trim()).filter(text=>text.length<100&&/(?:下書き|記事)?(?:を)?保存(?:しました|されました|済み)/.test(text));
}
async function saveOnce(label='貼り付け完了｜下書き保存を1回だけ実行中…'){
 const articleKey=editorArticleKey(),run=readRun();
 const checkpoint=async(state,error=null)=>{
  const current=readRun();
  if(!run||!current||editorArticleKey()!==articleKey||current.articleKey!==articleKey)return;
  writeRun({...current,draftSaveState:state,draftSaveError:error,draftSaveRequestedAt:state==='pending'?Date.now():current.draftSaveRequestedAt,...(state==='confirmed'?{draftSavedAt:Date.now()}:{}),updatedAt:Date.now()});
  await flushRunBackup();
 };
 await checkpoint('pending');
 try{
  const result=await saveNativeDraftOnce(label);
  if(result===true||result?.confirmed===true)await checkpoint('confirmed');
  return result;
 }catch(error){
  await checkpoint('pending',error?.message||String(error));
  throw error;
 }
}
async function saveNativeDraftOnce(label){
 setStatus(label);
 const articleKey=editorArticleKey();
 if(!articleKey)throw new Error('下書きの保存先を確認できません。本文は保持しています');
 const sameArticle=()=>{if(editorArticleKey()!==articleKey)throw new Error('保存中に記事画面が変わりました。保存操作は再送しません')};
 const beforeNotices=new Set(draftSaveNotices());
 let button=nativeDraftSaveButton(),savingSeen=false,idleTicks=0;
 // The editor's existing draft method saves in place. Do not create an API
 // or invoke a navigation control when this capability is unavailable.
 if(typeof page.noteEditor?.registerNoteDraft==='function'){
  const result=page.noteEditor.registerNoteDraft('manual');
  if(result===false||result?.result===false)throw new Error('noteの下書き保存を開始できません。本文は保持しています');
  if(result&&typeof result.then==='function'){
   let timer,saved;
   try{saved=await Promise.race([result,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Object.assign(new Error('下書き保存の確認が時間切れです。保存操作は再送しません'),{code:'DRAFT_SAVE_TIMEOUT'})),5000)})]);if(saved===false||saved?.result===false)throw new Error('noteの下書き保存に失敗しました。本文は保持しています')}
   catch(error){if(error?.code!=='DRAFT_SAVE_TIMEOUT')throw error;sameArticle();setStatus('保存操作を実行しました｜保存完了は画面で確認してください');return{requested:true,confirmed:false}}
   finally{clearTimeout(timer)}
   sameArticle();
   if(saved===true||saved?.result===true)return true;
  }
  else if(result===true||result?.result===true){sameArticle();return true}
 }else{
  if(!button)throw new Error('noteの下書き保存ボタンを一意に確認できません。本文は保持しています');
  const originalType=button.getAttribute('type');
  try{button.setAttribute('type','button');button.click()}
  finally{if(originalType==null)button.removeAttribute('type');else button.setAttribute('type',originalType)}
 }
 // A completed request or an idle button can also follow a failed save.
 // Only a positive native result or a fresh saved notice confirms persistence.
 for(let tick=0;tick<50;tick++){
  sameArticle();
  if(button?.isConnected===false)button=nativeDraftSaveButton(true);
  const text=String(button?.textContent||'').trim();
  const saving=Boolean(button&&(button.disabled||button.getAttribute?.('aria-busy')==='true'||button.getAttribute?.('aria-disabled')==='true'||/保存中|保存しています/.test(text)));
  if(saving){savingSeen=true;idleTicks=0}
  else if(savingSeen)idleTicks++;
  if(draftSaveNotices().some(text=>!beforeNotices.has(text)))return true;
  if(!savingSeen&&tick>=3||savingSeen&&idleTicks>=3){setStatus('保存操作を実行しました｜保存完了は画面で確認してください');return{requested:true,confirmed:false}}
  await sleep(100);
 }
 setStatus('保存操作を実行しました｜保存完了は画面で確認してください');
 return{requested:true,confirmed:false};
}

const PURCHASE_REVIEW_FORMAT='mumei-note-purchase-review-v1';
const PURCHASE_REVIEW_PREPARED='mumei_purchase_review_prepared_v1';
function validatePurchasedReview(data){
 if(data?.format!==PURCHASE_REVIEW_FORMAT||!Array.isArray(data.items)||!data.items.length||data.items.length>100)throw new Error('購入記事の紹介データを確認できません');
 const seen=new Set();
 return data.items.map((item,index)=>{
  let url,thumb;try{url=new URL(item.url);thumb=new URL(item.thumbUrl)}catch{throw new Error('記事・画像のURLを確認できません')}
  const match=url.pathname.match(/^\/([a-z0-9_\-]+)\/n\/(n[a-f0-9]{12})$/i);
  if(url.origin!=='https://note.com'||url.username||url.password||url.search||url.hash||!match||match[1]!==item.urlname||match[2]!==item.key||seen.has(item.key))throw new Error('記事の人物・URL・重複を確認してください');
  if(thumb.protocol!=='https:'||thumb.hostname!=='assets.st-note.com'||thumb.username||thumb.password)throw new Error('noteの記事サムネイルを指定してください');
  for(const [field,max] of [['creator',300],['displayCreator',80],['title',500],['summary',200]])if(typeof item[field]!=='string'||!item[field].trim()||item[field].length>max)throw new Error('紹介文の'+field+'を確認してください');
  if(item.sourceScope!=='public-free-section'||!Number.isFinite(Date.parse(item.sourceCheckedAt)))throw new Error('無料公開部分の確認記録がありません');
  seen.add(item.key);
  return{url:url.href,urlname:match[1],key:match[2],actorUrl:url.origin+'/'+match[1],creator:item.displayCreator.replace(/さん$/,''),displayCreator:item.displayCreator,title:item.title,summary:item.summary,thumbUrl:thumb.href,sourceScope:item.sourceScope,sourceCheckedAt:item.sourceCheckedAt,purchasedReview:true,index:index+1,finalMarker:false};
 });
}
function purchaseReviewLines(ctx,value,width){
 const lines=[];
 const segmenter=typeof Intl.Segmenter==='function'?new Intl.Segmenter('ja',{granularity:'word'}):null;
 for(const paragraph of String(value).split(/\r?\n/)){
  let line='';
  const tokens=segmenter?Array.from(segmenter.segment(paragraph),part=>part.segment):Array.from(paragraph);
  for(const token of tokens){
   if(ctx.measureText(token).width>width){
    if(line){lines.push(line);line=''}
    const graphemes=typeof Intl.Segmenter==='function'?Array.from(new Intl.Segmenter('ja',{granularity:'grapheme'}).segment(token),part=>part.segment):Array.from(token);
    for(const char of graphemes){if(line&&ctx.measureText(line+char).width>width){lines.push(line);line=''}line+=char}
   }else if(line&&ctx.measureText(line+token).width>width&&!/^[、。，．！？!?）」』】]/u.test(token)){lines.push(line);line=token}
   else line+=token;
  }
  if(line||!paragraph)lines.push(line);
 }
 return lines;
}
function drawPurchasedReview(canvas,row,thumb){
 const ctx=canvas.getContext('2d'),width=860,left=18,thumbWidth=420,textX=470,textWidth=372;
 const font='system-ui,-apple-system,"Noto Sans CJK JP",sans-serif';
 ctx.font='600 23px '+font;
 const names=purchaseReviewLines(ctx,row.displayCreator,textWidth);
 ctx.font='400 22px '+font;
 const descriptions=purchaseReviewLines(ctx,row.summary,textWidth);
 const textHeight=names.length*31+12+descriptions.length*33;
 const imageWidth=thumb.width||thumb.naturalWidth,imageHeight=thumb.height||thumb.naturalHeight;
 if(!(imageWidth>0&&imageHeight>0))throw new Error('サムネイルのサイズを確認できません');
 const scale=Math.min(thumbWidth/imageWidth,236/imageHeight),dw=imageWidth*scale,dh=imageHeight*scale;
 canvas.width=width;canvas.height=Math.max(252,textHeight+36);
 ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
 // The complete, original thumbnail is contained, never cropped or stretched.
 ctx.drawImage(thumb,left+(thumbWidth-dw)/2,(canvas.height-dh)/2,dw,dh);
 ctx.textBaseline='top';let y=(canvas.height-textHeight)/2;
 ctx.font='600 23px '+font;ctx.fillStyle='#45504a';
 for(const line of names){ctx.fillText(line,textX,y);y+=31}
 y+=12;ctx.font='400 22px '+font;ctx.fillStyle='#444';
 for(const line of descriptions){ctx.fillText(line,textX,y);y+=33}
 return{width:canvas.width,height:canvas.height,thumbnailWidth:dw,descriptionLines:descriptions.length};
}
async function makePurchasedReviewFile(row){
 await document.fonts?.ready;
 const thumb=await bitmapFromUrl(purchaseAssetUrl(row.thumbUrl,720));
 if(!thumb)throw new Error(row.creator+'さんの記事サムネイルを読み込めません');
 try{
  const canvas=document.createElement('canvas');drawPurchasedReview(canvas,row,thumb);
  const blob=await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('紹介画像を作成できません')),'image/png'));
  return new page.File([blob],'mumei_purchased_'+row.key+'.png',{type:'image/png'});
 }finally{try{thumb.close?.()}catch{}}
}
async function pastePurchasedReview(input=null){
 if(busy||exportWaiter||coreBusy()){setStatus('実行中です。一時停止が完了してから再開してください',true);return;}
 busy=true;stopRequested=false;pauseRequested=false;notifyFixedState();
 try{
  await hydrateRunBackup();
  let run=readRun();
  if(run&&!run.purchasedReview)throw new Error('別の作成記録があります。購入記事は新しい下書きで作成してください');
  if(!editorArticleKey())throw new Error('先にnoteの下書きを保存してください');
  const view=findView();if(!view)throw new Error('note本文編集欄を取得できません');
  if(run?.articleKey&&run.articleKey!==editorArticleKey())throw new Error('別の記事の作成記録です');
  nativeImageCommand();selectionApi();
  if(!run){
   const prepared=input||await Promise.resolve(GM_getValue(PURCHASE_REVIEW_PREPARED,null));
   const rows=validatePurchasedReview(prepared);
   run={version:VERSION,articleKey:editorArticleKey(),purchasedReview:true,purchaseFormat:PURCHASE_REVIEW_FORMAT,rows,count:rows.length,items:[],cardKeys:[],activityTexts:[],sectionHeadings:[],dividerUrls:[],imageBaselineRecords:imageNodes(view).map(hit=>({id:String(hit.node.attrs?.id||''),src:String(hit.node.attrs?.src||''),link:String(hit.node.attrs?.link||'')})),cardBaselineKeys:embedNodes(view).map(cardKey).filter(Boolean),imageAnchorPos:cardAnchorFromSelection(view),stage:'images_building',createdAt:Date.now()};
   writeRun(run);await flushRunBackup();
  }
  const rows=validatePurchasedReview({format:PURCHASE_REVIEW_FORMAT,items:run.rows});
  assertPurchaseTracking(view,run);
  const images=ownedImagesForRun(view,run),done=completedImagePrefix(rows,images);
  if(done===rows.length&&['images_ready','cards_building','complete'].includes(run.stage)){setStatus('購入記事 '+done+'件は貼り付け済みです');return;}
  let insertPos=done?addDivider(view,images.at(-1),rows[done-1]):Number(run.imageAnchorPos);
  if(!Number.isFinite(insertPos))throw new Error('貼り付け位置の記録を確認できません');
  writeRun({...readRun(),rows,stage:'images_building',paused:false,pauseStage:null});await flushRunBackup();
  await keepAwake();
  for(let index=done;index<rows.length;index++){
   checkPause();if(stopRequested)throw new Error('停止しました');
   const row=rows[index];setStatus('購入記事紹介 '+(index+1)+'/'+rows.length+'｜'+row.creator+'さん');
   const file=await makePurchasedReviewFile(row);
   checkPause();if(stopRequested)throw new Error('停止しました');
   const made=await uploadOne(view,row,file,insertPos);
   recordImage(made.hit,row);insertPos=addDivider(view,made.hit,row);await flushRunBackup();
  }
  writeRun({...readRun(),stage:'images_ready',paused:false,pauseStage:null,imagesCompletedAt:Date.now()});await flushRunBackup();
  const saved=await saveOnce('購入記事 '+rows.length+'件｜下書きを保存中…');
  setStatus('購入記事 '+rows.length+'件の紹介が完成'+((saved===true||saved?.confirmed)?'・下書き保存確認済み':'｜note画面で保存完了を確認してください'));
 }catch(error){
  const run=readRun();if(run?.purchasedReview){
   writeRun({...run,paused:true,pauseStage:'images'});await flushRunBackup();
   if(error?.code==='PAUSED')try{await saveOnce('購入記事紹介を一時停止｜完成分を保存中…')}catch{}
  }
  setStatus('購入記事紹介：'+(error?.message||String(error)),error?.code!=='PAUSED');
 }finally{busy=false;notifyFixedState();await releaseAwake()}
}

const runStore=createStoredState(runKey,'mumei_purchase_review_backup_v1:');
function readRun(){return runStore.read()}
function writeRun(value){runStore.write(value)}
async function flushRunBackup(){await runStore.flush()}
async function hydrateRunBackup(){
 await runStore.hydrate();
 if(readRun())return readRun();
 const articleKey=editorArticleKey();let old=null;
 try{old=JSON.parse(localStorage.getItem('mumei_profile_card_paster_run_v15:'+articleKey)||'null')}catch{}
 if(old?.purchasedReview===true&&old.articleKey===articleKey){writeRun(old);await flushRunBackup()}
 return readRun();
}
async function deletePurchasedReview(){
 if(busy||coreBusy()){setStatus('一時停止が完了してから削除してください',true);return;}
 busy=true;notifyFixedState();
 try{
  await hydrateRunBackup();const run=readRun(),view=findView();
  if(!run?.purchasedReview||!view){setStatus('この記事の購入記事紹介はまだありません');return;}
  if(run.articleKey!==editorArticleKey())throw Error('別の記事の記録です');
  assertPurchaseTracking(view,run);
  const images=ownedImagesForRun(view,run),hits=[...images];
  for(const hit of images){const pos=hit.pos+hit.node.nodeSize,node=view.state.doc.nodeAt(pos);if((run.dividerUrls||[]).includes(hit.node.attrs?.link)&&isDivider(view,node))hits.push({node,pos})}
  let tr=view.state.tr;
  for(const hit of [...new Map(hits.map(hit=>[hit.pos,hit])).values()].sort((a,b)=>b.pos-a.pos)){
   if(!view.state.doc.nodeAt(hit.pos)?.eq(hit.node))throw Error('本文位置が変わりました。削除を停止しました');
   tr=tr.delete(hit.pos,hit.pos+hit.node.nodeSize);
  }
  const expected=tr.doc;view.dispatch(tr);
  if(!expected?.eq?.(view.state.doc))throw Error('削除結果を確認できません。作成記録は保持しました');
  writeRun(null);await flushRunBackup();await saveNativeDraftOnce('今回分を削除｜下書きを保存中…');setStatus('購入記事紹介 '+images.length+'件を削除しました');
 }catch(error){setStatus(error?.message||String(error),true)}finally{busy=false;notifyFixedState()}
}
function mount(){
 if(!document.body||document.getElementById(PANEL))return;
 const style=document.createElement('style');style.id=PANEL+'-style';
 style.textContent=`#mumei-profile-card-paster-v1,#mumei-profile-card-paster-v1-mini{display:none!important}#${PANEL}{position:fixed;z-index:2147483647;right:4px;top:76px;width:min(132px,calc(100vw - 8px));padding:3px;border:1px solid #365b70;border-radius:8px;background:#07131d;color:#edf8ff;box-shadow:0 6px 16px #0008;font:7.2px/1.3 system-ui}#${PANEL} .head{display:grid;grid-template-columns:1fr 20px 20px;gap:2px;align-items:center;touch-action:none}#${PANEL} .title{font-weight:900;font-size:7.6px}#${PANEL} button{min-height:22px;border:1px solid #3b6378;border-radius:5px;background:#102b3b;color:#eaf9ff;font-weight:800;font-size:6.8px;touch-action:manipulation;padding:2px}#${PANEL} .body{display:grid;gap:3px;margin-top:3px}#${PANEL} .row{display:grid;grid-template-columns:1fr 1fr;gap:3px}#${PANEL} .hint{font-size:6.4px;color:#b7d4e4}#${PANEL} [data-purchase-start]{background:#176b54}#${PANEL} [data-purchase-delete]{background:#55212b}#${PANEL} [disabled]{opacity:.55}#${PANEL} [hidden]{display:none!important}#${STATUS}{font-size:6.4px;color:#bfe8ff;overflow-wrap:anywhere}#${STATUS}[data-bad="1"]{color:#ffb8b8}#${PANEL}.collapsed .body{display:none}#${PANEL}.tiny{display:none}#${PANEL}-mini{position:fixed;z-index:2147483647;right:7px;top:80px;width:30px;height:30px;display:none;border:1px solid #5fd4ee;border-radius:50%;background:#082333;color:#fff;font:800 8px system-ui}`;
 document.getElementById(style.id)?.remove();document.head.appendChild(style);
 const panel=document.createElement('div');panel.id=PANEL;
 panel.innerHTML='<div class="head"><span class="title">購入記事 v'+VERSION+'</span><button type="button" data-collapse>－</button><button type="button" data-close>×</button></div><div class="body"><div class="hint">小さめ通常サムネ＋記事紹介</div><input data-purchase-file type="file" accept="application/json,.json" hidden><button type="button" data-purchase-import>① 紹介データを選ぶ</button><button type="button" data-purchase-start>② 貼り付け／再開</button><div class="row"><button type="button" data-purchase-pause>一時停止</button><button type="button" data-purchase-stop>停止</button></div><button type="button" data-purchase-delete>今回分を削除</button><div id="'+STATUS+'">データを選ぶ→本文の位置をタップ→②</div></div>';
 const file=panel.querySelector('[data-purchase-file]');
 panel.querySelector('[data-purchase-import]').addEventListener('click',()=>file.click());
 file.addEventListener('change',async()=>{
  try{
   if(busy)throw Error('実行中です。一時停止してから読み込んでください');
   const selected=file.files?.[0];if(!selected)return;if(selected.size>1024*1024)throw Error('紹介データは1MB以内にしてください');
   const rows=validatePurchasedReview(JSON.parse(await selected.text()));
   await Promise.resolve(GM_setValue(PURCHASE_REVIEW_PREPARED,{format:PURCHASE_REVIEW_FORMAT,items:rows}));
   setStatus(rows.length+'件を読込済み｜本文の位置をタップして②');
  }catch(error){setStatus(error?.message||String(error),true)}finally{file.value=''}
 });
 panel.querySelector('[data-purchase-start]').addEventListener('click',()=>void pastePurchasedReview());
 const pause=()=>{pauseRequested=true;setStatus(busy?'処理中の1件を記録して一時停止します':'停止中です。②で再開できます');notifyFixedState()};
 let pauseAt=-Infinity;
 for(const type of ['pointerdown','click'])panel.querySelector('[data-purchase-pause]').addEventListener(type,event=>{event.preventDefault();event.stopPropagation();if(Date.now()-pauseAt<650)return;pauseAt=Date.now();pause()});
 panel.querySelector('[data-purchase-stop]').addEventListener('click',()=>{stopRequested=true;abortRequests();setStatus('停止しました。完成分は記録済みです')});
 panel.querySelector('[data-purchase-delete]').addEventListener('click',()=>void deletePurchasedReview());
 panel.querySelector('[data-collapse]').addEventListener('click',()=>panel.classList.toggle('collapsed'));
 document.getElementById(PANEL+'-mini')?.remove();const mini=document.createElement('button');mini.id=PANEL+'-mini';mini.type='button';mini.textContent='記事';
 panel.querySelector('[data-close]').addEventListener('click',()=>{panel.classList.add('tiny');mini.style.display='block'});
 mini.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();panel.classList.remove('tiny','collapsed');mini.style.display='none'});
 for(const type of ['pointerdown','mousedown','touchstart','click','keydown','keyup','paste'])panel.addEventListener(type,event=>{event.stopPropagation();if(type==='mousedown'&&event.target.closest('button'))event.preventDefault()});
 let drag=null;const head=panel.querySelector('.head');
 head.addEventListener('pointerdown',event=>{if(event.target.closest('button'))return;const box=panel.getBoundingClientRect();drag={id:event.pointerId,x:event.clientX,y:event.clientY,left:box.left,top:box.top};head.setPointerCapture?.(event.pointerId)});
 head.addEventListener('pointermove',event=>{if(!drag||event.pointerId!==drag.id)return;event.preventDefault();panel.style.right='auto';panel.style.left=Math.max(4,Math.min(innerWidth-panel.offsetWidth-4,drag.left+event.clientX-drag.x))+'px';panel.style.top=Math.max(4,Math.min(innerHeight-panel.offsetHeight-4,drag.top+event.clientY-drag.y))+'px'});
 for(const type of ['pointerup','pointercancel'])head.addEventListener(type,()=>{drag=null});
 document.body.append(panel,mini);notifyFixedState();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
window.addEventListener('pageshow',mount);
if(typeof MutationObserver==='function'){
 const observer=new MutationObserver(()=>{if(!document.getElementById(PANEL))mount()});
 observer.observe(document.documentElement,{childList:true,subtree:true});
}
})();
