// ==UserScript==
// @name         無名S note INSIGHTスキ300 修正版
// @namespace    https://github.com/mumei-s/note-insight/likes300-fix
// @version      2.2.1
// @description  INSIGHTスキ履歴から同一人物を除外した300人を取得。実アイコンと最新記事サムネを極薄50種へ表示し、活動内容は画像外の直上へ太字で挿入。
// @match        https://mumei-s.github.io/note-insight/*
// @match        https://editor.note.com/*
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        unsafeWindow
// @connect      note.com
// @connect      assets.st-note.com
// @connect      *
// @updateURL    https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-profile-card-likes300-fix-v220.user.js
// @downloadURL  https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-profile-card-likes300-fix-v220.user.js
// ==/UserScript==

(function(){
'use strict';

const page=typeof unsafeWindow!=='undefined'?unsafeWindow:window;
const VERSION='2.2.1';
const BRIDGE_KEY='mumei_profile_card_likes_300_fix_v220';
const RUN_PREFIX='mumei_profile_card_paster_run_v15:';
const PREP_PREFIX='mumei_profile_like300_fix_v221:';
const PANEL_ID='mumei-like300-fix-editor-v221';
const FINAL_URL='https://note.com/fuku444/n/nb4f6934381e9';
const FINAL_KEY='nb4f6934381e9';
const TARGET=300,W=860,H=140,IMAGE_GAP=560;

let busy=false;
let stopping=false;
let wakeLock=null;
let viewCache=null;
let imageCommandCache=null;
let selectionCache=null;
const requests=new Set();

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const norm=value=>{
 try{
  const u=new URL(String(value||''),location.href);
  u.search='';u.hash='';
  return u.href
 }catch{return String(value||'').trim()}
};
const editorArticleKey=()=>location.pathname.match(/^\/notes\/(n[a-z0-9]{8,})\/edit\/?$/i)?.[1]||'';
const runKey=()=>RUN_PREFIX+(editorArticleKey()||'unknown');
const prepKey=()=>PREP_PREFIX+(editorArticleKey()||'unknown');
function readRun(){try{return JSON.parse(localStorage.getItem(runKey())||'null')}catch{return null}}
function writeRun(value){try{if(value==null)localStorage.removeItem(runKey());else localStorage.setItem(runKey(),JSON.stringify(value))}catch{}}
const gmGet=(key,fallback=null)=>Promise.resolve(GM_getValue(key,fallback));
const gmSet=(key,value)=>Promise.resolve(GM_setValue(key,value));

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
function request(url,responseType='text',timeout=60000){
 return new Promise((resolve,reject)=>{
  let req=null;
  const finish=()=>{if(req)requests.delete(req)};
  req=GM_xmlhttpRequest({
   method:'GET',
   url,
   responseType,
   timeout,
   headers:{Accept:responseType==='blob'?'image/avif,image/webp,image/png,image/jpeg,*/*':'application/json,text/html,*/*'},
   onload:r=>{
    finish();
    if(stopping){reject(new Error('停止しました'));return}
    if(r.status>=200&&r.status<300)resolve(r.response);
    else reject(new Error('GET '+r.status+' '+url))
   },
   onerror:()=>{finish();reject(new Error(stopping?'停止しました':'通信失敗 '+url))},
   ontimeout:()=>{finish();reject(new Error(stopping?'停止しました':'通信タイムアウト '+url))},
   onabort:()=>{finish();reject(new Error('停止しました'))}
  });
  if(req)requests.add(req)
 })
}
async function requestJSON(url){
 const text=await request(url,'text');
 try{return JSON.parse(String(text||''))}
 catch{throw new Error('JSON解析失敗 '+url)}
}
function abortRequests(){
 for(const req of [...requests]){try{req.abort?.()}catch{}}
 requests.clear()
}
async function keepAwake(){
 if(!navigator.wakeLock?.request||document.hidden)return;
 try{
  if(wakeLock&&!wakeLock.released)return;
  wakeLock=await navigator.wakeLock.request('screen');
  wakeLock.addEventListener?.('release',()=>{
   wakeLock=null;
   if(busy&&!document.hidden)setTimeout(()=>void keepAwake(),300)
  },{once:true})
 }catch{}
}
async function releaseAwake(){try{await wakeLock?.release?.()}catch{}wakeLock=null}

if(location.hostname==='mumei-s.github.io'){
 const HISTORY='https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-member-history';
 const TOKEN_KEY='mumei-insight-access-token';

 function bridgeStatus(text){
  const el=document.getElementById('mumei-like300-fix-status');
  if(el)el.textContent=text
 }
 async function collectCandidates(){
  const token=localStorage.getItem(TOKEN_KEY)||'';
  if(!token){bridgeStatus('INSIGHTへログインしてから実行');return}
  const seen=new Set(),people=[];
  let pageNo=1,total=Infinity;
  try{
   while(people.length<500&&(pageNo-1)*100<total&&pageNo<=100){
    bridgeStatus('履歴候補 '+people.length+'人｜'+pageNo+'ページ');
    const response=await fetch(HISTORY,{
     method:'POST',
     headers:{'Content-Type':'application/json','X-Insight-Token':token},
     body:JSON.stringify({action:'likes',page:pageNo,pageSize:100,status:'all',sort:'newest',query:'',dateFrom:null,dateTo:null}),
     cache:'no-store'
    });
    const payload=await response.json().catch(()=>({}));
    if(!response.ok||payload?.ok===false)throw new Error(payload?.error||('HTTP '+response.status));
    const rows=Array.isArray(payload.rows)?payload.rows:[];
    total=Number(payload.total||total);
    if(!rows.length)break;
    for(const row of rows){
     const actorUrl=String(row.actor_url||'');
     const urlname=(actorUrl.match(/note\.com\/([^/?#]+)/i)?.[1]||'').trim();
     const key=String(row.liker_key||urlname||actorUrl).trim().toLowerCase();
     if(!key||!urlname||seen.has(key))continue;
     seen.add(key);
     people.push({
      likerKey:String(row.liker_key||key),
      urlname,
      creator:String(row.actor_name||urlname||'noteクリエイター').trim(),
      actorUrl,
      actorImageUrl:String(row.actor_image_url||''),
      likedAt:String(row.liked_at||'')
     });
     if(people.length>=500)break
    }
    await gmSet(BRIDGE_KEY,{version:221,at:Date.now(),people});
    pageNo++
   }
   await gmSet(BRIDGE_KEY,{version:221,at:Date.now(),people});
   bridgeStatus('準備完了 ✅ 候補'+people.length+'人｜note編集画面へ')
  }catch(error){
   bridgeStatus('停止：'+(error?.message||String(error)))
  }
 }
 function mountBridge(){
  document.getElementById('mumei-like300-bridge')?.remove();
  document.getElementById('mumei-like300-fix')?.remove();
  if(!document.body||document.getElementById('mumei-like300-fix-v221'))return;
  const box=document.createElement('div');
  box.id='mumei-like300-fix-v221';
  box.style.cssText='position:fixed;right:8px;bottom:120px;z-index:2147483647;width:176px;padding:8px;border:1px solid #62e2c4;border-radius:11px;background:#071923;color:#efffff;font:800 9px/1.45 system-ui;box-shadow:0 8px 26px #0009';
  box.innerHTML='<b style="display:block;margin-bottom:5px">極薄サム修正版 v2.2.1</b><button id="mumei-like300-fix-go" style="width:100%;min-height:32px;border:1px solid #65ebca;border-radius:7px;background:#176b54;color:#fff;font-weight:950">300人を準備</button><div id="mumei-like300-fix-status" style="margin-top:5px;color:#baf8e9">同一人物を除外・新しい順</div>';
  document.body.appendChild(box);
  box.querySelector('#mumei-like300-fix-go').addEventListener('click',()=>void collectCandidates());
  const url=new URL(location.href);
  if(url.searchParams.get('like300fix')==='1'){
   url.searchParams.delete('like300fix');
   history.replaceState(history.state,'',url.toString());
   setTimeout(()=>void collectCandidates(),500)
  }
 }
 const observer=new MutationObserver(()=>{
  document.getElementById('mumei-like300-bridge')?.remove();
  const old=document.getElementById('mumei-like300-fix');
  if(old&&old.id!=='mumei-like300-fix-v221')old.remove()
 });
 observer.observe(document.documentElement,{childList:true,subtree:true});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mountBridge,{once:true});
 else mountBridge();
 return
}

if(location.hostname!=='editor.note.com')return;
if(page.__MUMEI_LIKE300_FIX_V221__)return;
page.__MUMEI_LIKE300_FIX_V221__=true;

function setStatus(text,bad=false){
 const el=document.getElementById('mumei-like300-fix-editor-status-v221');
 if(el){el.textContent=text;el.style.color=bad?'#ffb5b5':'#bff5e8'}
}
function webpackRequire(){
 const chunks=page.webpackChunk_N_E;
 if(!chunks||typeof chunks.push!=='function')return null;
 let req=null;
 const id=996900000+Math.floor(Math.random()*90000);
 try{chunks.push([[id],{},r=>{req=r}])}catch{}
 return req
}
function looksLikeView(value){
 try{return Boolean(value?.state?.doc&&value?.state?.schema&&typeof value.dispatch==='function'&&value.dom&&typeof value.posAtDOM==='function')}
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
 const req=webpackRequire();
 let command;
 try{command=req?.(94928)?.CwN}catch{}
 const src=typeof command==='function'?Function.prototype.toString.call(command):'';
 if(!(command?.length===4&&/imageUploading/.test(src)))throw new Error('note画像処理を取得できません');
 return imageCommandCache=command
}
function selectionApi(){
 if(selectionCache)return selectionCache;
 const req=webpackRequire();
 let mod;
 try{mod=req?.(44044)}catch{}
 const Selection=mod?.Y1;
 if(typeof Selection?.atEnd!=='function')throw new Error('Selection取得失敗');
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
function cardAnchor(view){
 const selection=view.state.selection,$from=selection.$from;
 try{
  if($from?.depth>=1){
   const node=$from.node(1),before=$from.before(1);
   return node?.type===view.state.schema.nodes.paragraph&&!String(node.textContent||'')?before:before+node.nodeSize
  }
 }catch{}
 return Math.max(0,Math.min(view.state.doc.content.size,Number(selection.from)||view.state.doc.content.size))
}
function setSelection(view,pos){
 const at=Math.max(0,Math.min(view.state.doc.content.size,Number(pos)||0));
 const Selection=selectionApi();
 const selection=typeof Selection.near==='function'?Selection.near(view.state.doc.resolve(at)):Selection.atEnd(view.state.doc);
 view.dispatch(view.state.tr.setSelection(selection).scrollIntoView());
 view.focus();
 return view.state.selection.from
}
async function waitImage(view,before,timeout=150000){
 const end=Date.now()+timeout;
 while(Date.now()<end){
  if(stopping)throw new Error('停止しました');
  const fresh=imageNodes(view).filter(hit=>{
   const id=String(hit.node.attrs?.id||'');
   return id&&!before.has(id)&&/^https:/i.test(String(hit.node.attrs?.src||''))
  }).sort((a,b)=>a.pos-b.pos);
  if(fresh.length)return fresh.at(-1);
  await sleep(260)
 }
 throw new Error('画像アップロード待ちタイムアウト')
}
function relink(view,hit,row){
 const node=view.state.doc.nodeAt(hit.pos)||hit.node;
 if(node?.type?.name!=='image')throw new Error('画像ノードを確認できません');
 const caption=row.creator+'さん';
 const replacement=node.type.create({...node.attrs,link:row.url},view.state.schema.text(caption),node.marks);
 view.dispatch(view.state.tr.replaceWith(hit.pos,hit.pos+node.nodeSize,replacement));
 const id=String(replacement.attrs?.id||'');
 return imageNodes(view).find(x=>id&&String(x.node.attrs?.id||'')===id)||{node:replacement,pos:hit.pos}
}
async function upload(view,row,file,pos){
 const before=new Set(imageNodes(view).map(x=>String(x.node.attrs?.id||'')).filter(Boolean));
 const selected=setSelection(view,pos);
 const dt=new page.DataTransfer();
 dt.items.add(file);
 if(nativeImageCommand()(view,dt.files,Math.max(0,selected-1),'image')!==true)throw new Error('画像アップロード開始失敗');
 const hit=await waitImage(view,before);
 const linked=relink(view,hit,row);
 return{hit:linked,nextPos:linked.pos+linked.node.nodeSize}
}

function contentList(payload){
 const data=payload?.data&&typeof payload.data==='object'?payload.data:{};
 return Array.isArray(data.contents)?data.contents:Array.isArray(data.notes)?data.notes:[]
}
async function creatorContents(id){
 return requestJSON('https://note.com/api/v2/creators/'+encodeURIComponent(id)+'/contents?kind=note&page=1&disabled_pinned=true&with_notes=false')
}
function articleFromRaw(raw,creator){
 const note=raw?.note&&typeof raw.note==='object'?raw.note:raw;
 const key=String(note?.key||'');
 if(!/^n[a-f0-9]{12}$/i.test(key))return null;
 const url=norm(note.noteUrl||note.url||('https://note.com/'+creator.urlname+'/n/'+key));
 return{
  ...creator,
  url,
  key,
  title:String(note.name||note.title||'無題の記事'),
  thumbUrl:mediaUrl(note.eyecatch_url||note.image_url||note.imageUrl||note.thumbnail_url||note.thumbnailUrl||note.eyecatch?.url||note.image?.url||'')
 }
}
async function pageMeta(url){
 try{
  const html=String(await request(url,'text',45000)||'');
  const doc=new DOMParser().parseFromString(html,'text/html');
  return{
   image:mediaUrl(doc.querySelector('meta[property="og:image"]')?.content||doc.querySelector('meta[name="twitter:image"]')?.content||doc.querySelector('article img')?.src||''),
   description:String(doc.querySelector('meta[name="description"]')?.content||'').replace(/\s+/g,' ').trim()
  }
 }catch{return{image:'',description:''}}
}
function activityLabel(text){
 const value=String(text||'').replace(/\s+/g,' ');
 const rules=[
  [/(?:生成AI|ChatGPT|AI画像|AIイラスト|人工知能|プロンプト)/ig,'AI・創作'],
  [/(?:小説|詩|短歌|俳句|エッセイ|創作|物語|漫画|イラスト)/ig,'創作・表現'],
  [/(?:子育て|育児|家族|暮らし|日常|生活)/ig,'暮らし・日常'],
  [/(?:仕事|働き方|キャリア|副業|フリーランス|転職|ビジネス)/ig,'仕事・働き方'],
  [/(?:勉強|学習|資格|読書|本|教育|学び)/ig,'学び・読書'],
  [/(?:写真|カメラ|旅行|旅|散歩|観光)/ig,'写真・旅'],
  [/(?:料理|レシピ|食事|グルメ|カフェ)/ig,'食・料理'],
  [/(?:音楽|映画|アニメ|ゲーム|舞台|ドラマ)/ig,'エンタメ'],
  [/(?:プログラミング|開発|Web|アプリ|デザイン|IT)/ig,'IT・デザイン'],
  [/(?:お金|家計|資産運用|投資|NISA|株)/ig,'お金・暮らし']
 ];
 const scored=rules.map(([re,label])=>({label,count:(value.match(re)||[]).length})).filter(x=>x.count>0).sort((a,b)=>b.count-a.count);
 if(!scored.length)return'日々のことや気づきを発信';
 return scored.slice(0,2).map(x=>x.label).join('／')+'を中心に発信'
}
async function preparePerson(person){
 const id=String(person?.urlname||'').trim();
 if(!id)return null;
 try{
  const [contents,profilePayload]=await Promise.all([
   creatorContents(id),
   requestJSON('https://note.com/api/v2/creators/'+encodeURIComponent(id)).catch(()=>({}))
  ]);
  const list=contentList(contents);
  const creator={
   likerKey:String(person.likerKey||id),
   urlname:id,
   creator:String(person.creator||id),
   actorUrl:String(person.actorUrl||('https://note.com/'+id)),
   actorImageUrl:mediaUrl(person.actorImageUrl||'')
  };
  const latest=articleFromRaw(list[0],creator);
  if(!latest)return null;
  const [notePayload,meta]=await Promise.all([
   requestJSON('https://note.com/api/v3/notes/'+encodeURIComponent(latest.key)).catch(()=>({})),
   pageMeta(latest.url)
  ]);
  const profile=profilePayload?.data?.creator||profilePayload?.data?.user||profilePayload?.data||profilePayload||{};
  const note=notePayload?.data||notePayload||{};
  const user=note.user||note.author||{};

  const avatar=mediaUrl(
   profile.user_profile_image_url||profile.profile_image_url||profile.profileImageUrl||
   profile.user_profile_image_path||profile.profile_image_path||profile.profileImagePath||
   profile.icon_url||profile.image_url||
   user.user_profile_image_url||user.profile_image_url||user.profileImageUrl||
   user.user_profile_image_path||user.profile_image_path||user.profileImagePath||
   user.icon_url||user.image_url||
   person.actorImageUrl||latest.actorImageUrl||''
  );
  let thumbnail=mediaUrl(
   note.eyecatch_url||note.image_url||note.imageUrl||note.thumbnail_url||note.thumbnailUrl||
   note.eyecatch?.url||note.eyecatch_image?.url||note.eyecatchImage?.url||
   note.image?.url||note.thumbnail?.url||latest.thumbUrl||meta.image||''
  );
  if(!thumbnail)thumbnail=avatar;

  const source=[
   profile.profile,profile.description,profile.bio,profile.introduction,profile.self_introduction,profile.note_intro,
   ...list.slice(0,6).flatMap(x=>[x?.name,x?.title,x?.description,x?.body_text]),
   note.name,note.title,note.description,note.body_text,meta.description
  ].filter(Boolean).join(' ');

  return{
   ...latest,
   creator:String(profile.nickname||profile.name||user.nickname||user.name||person.creator||id).trim(),
   actorImageUrl:avatar,
   thumbUrl:thumbnail,
   title:String(note.name||note.title||latest.title||'無題の記事').trim(),
   activityLabel:activityLabel(source),
   likesHistory:true
  }
 }catch{return null}
}
async function buildRows(){
 const bridge=await gmGet(BRIDGE_KEY,null);
 const people=Array.isArray(bridge?.people)?bridge.people:[];
 if(!people.length)throw new Error('INSIGHT側の準備データがありません。「INSIGHTで準備」を先に押してください');
 const signature=String(bridge?.at||0)+'|'+TARGET;
 let saved;
 try{saved=JSON.parse(localStorage.getItem(prepKey())||'null')}catch{saved=null}
 let rows=Array.isArray(saved?.rows)&&saved.signature===signature?saved.rows:[];
 let index=saved?.signature===signature?Number(saved.index||0):0;
 const seen=new Set(rows.map(x=>String(x.urlname||'').toLowerCase()).filter(Boolean));

 while(index<people.length&&rows.length<TARGET){
  if(stopping)throw new Error('停止しました');
  const batch=people.slice(index,index+4);
  index+=batch.length;
  setStatus('アイコン・記事サムネ・活動確認 '+rows.length+'/'+TARGET+'｜候補 '+index+'/'+people.length);
  const prepared=await Promise.all(batch.map(preparePerson));
  for(const row of prepared){
   const id=String(row?.urlname||'').toLowerCase();
   if(!row||!id||seen.has(id))continue;
   seen.add(id);
   rows.push(row);
   if(rows.length>=TARGET)break
  }
  try{localStorage.setItem(prepKey(),JSON.stringify({signature,index,rows,updatedAt:Date.now()}))}catch{}
  await sleep(60)
 }
 if(rows.length<TARGET)throw new Error('公開記事を確認できたクリエイターが '+rows.length+'人でした。INSIGHT側で再準備してください');
 return rows.slice(0,TARGET).map((row,index)=>({...row,index:index+1}))
}
async function finalRow(){
 const row={likerKey:'final-performance-math',urlname:'fuku444',creator:'実績の算数',actorUrl:'https://note.com/fuku444',actorImageUrl:'',url:FINAL_URL,key:FINAL_KEY,title:'実績の算数│3日半で0→1達成',thumbUrl:'',finalMarker:true,index:301};
 try{
  const [notePayload,profilePayload,meta]=await Promise.all([
   requestJSON('https://note.com/api/v3/notes/'+FINAL_KEY).catch(()=>({})),
   requestJSON('https://note.com/api/v2/creators/fuku444').catch(()=>({})),
   pageMeta(FINAL_URL)
  ]);
  const note=notePayload?.data||notePayload||{};
  const profile=profilePayload?.data?.creator||profilePayload?.data?.user||profilePayload?.data||profilePayload||{};
  const user=note.user||note.author||{};
  const avatar=mediaUrl(profile.user_profile_image_url||profile.profile_image_url||profile.profileImageUrl||profile.user_profile_image_path||profile.profile_image_path||profile.profileImagePath||user.user_profile_image_url||user.profile_image_url||user.profileImageUrl||'');
  const thumbnail=mediaUrl(note.eyecatch_url||note.image_url||note.thumbnail_url||note.eyecatch?.url||note.image?.url||meta.image||avatar||'');
  return{...row,creator:String(profile.nickname||profile.name||user.nickname||user.name||'実績の算数'),actorImageUrl:avatar,thumbUrl:thumbnail}
 }catch{return row}
}

async function bitmap(url){
 if(!url)return null;
 try{
  const blob=await request(url,'blob',45000);
  if('createImageBitmap'in page)return await page.createImageBitmap(blob);
  return await new Promise((resolve,reject)=>{
   const image=new page.Image(),objectUrl=page.URL.createObjectURL(blob);
   image.onload=()=>{page.URL.revokeObjectURL(objectUrl);resolve(image)};
   image.onerror=()=>{page.URL.revokeObjectURL(objectUrl);reject(new Error('画像読込失敗'))};
   image.src=objectUrl
  })
 }catch{return null}
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
 else if(pattern===4){for(const radius of [20,38,56,74]){ctx.beginPath();ctx.arc(515,70,radius,0,Math.PI*2);ctx.stroke()}}
 else if(pattern===5){ctx.setLineDash([7,6]);rounded(ctx,14,12,542,H-24,14);ctx.stroke();ctx.setLineDash([])}
 else if(pattern===6){for(let x=395;x<570;x+=24)ctx.fillRect(x,10,12,H-20)}
 else if(pattern===7){ctx.beginPath();ctx.moveTo(0,118);for(let x=0;x<570;x+=32)ctx.lineTo(x,118-(x/32%3)*17);ctx.stroke()}
 else if(pattern===8){for(let y=12;y<132;y+=24)for(let x=400;x<570;x+=24)ctx.strokeRect(x,y,18,18)}
 else{for(let a=0;a<Math.PI*2;a+=Math.PI/18){ctx.beginPath();ctx.moveTo(520,70);ctx.lineTo(520+Math.cos(a)*100,70+Math.sin(a)*68);ctx.stroke()}}
 ctx.restore()
}
async function makeImage(row){
 let [avatar,thumbnail]=await Promise.all([bitmap(row.actorImageUrl),bitmap(row.thumbUrl)]);
 if(!thumbnail&&avatar)thumbnail=avatar;
 const styleIndex=hash(row.key||row.url||row.creator)%50;
 const theme=palettes[Math.floor(styleIndex/10)%palettes.length];
 const canvas=document.createElement('canvas');
 canvas.width=W;canvas.height=H;
 const ctx=canvas.getContext('2d');
 drawDecor(ctx,styleIndex,theme);

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
 textLines(ctx,row.title,tw,2).forEach((line,index)=>ctx.fillText(line,tx,18+index*25));
 ctx.fillStyle=theme.muted;ctx.font='700 14px system-ui,-apple-system,sans-serif';
 ctx.fillText(fit(ctx,row.creator+'さん',tw),tx,86);
 ctx.fillStyle=theme.accent;ctx.font='700 12px system-ui,-apple-system,sans-serif';ctx.fillText('note',tx,110);

 const ix=590,iy=8,iw=262,ih=124;
 ctx.fillStyle=theme.panel;rounded(ctx,ix,iy,iw,ih,8);ctx.fill();
 ctx.strokeStyle=theme.line;ctx.lineWidth=1;rounded(ctx,ix,iy,iw,ih,8);ctx.stroke();
 if(thumbnail){
  const sw=thumbnail.width||thumbnail.naturalWidth||1,sh=thumbnail.height||thumbnail.naturalHeight||1;
  const scale=Math.max(iw/sw,ih/sh),dw=sw*scale,dh=sh*scale;
  ctx.save();rounded(ctx,ix,iy,iw,ih,8);ctx.clip();
  ctx.drawImage(thumbnail,ix+(iw-dw)/2,iy+(ih-dh)/2,dw,dh);ctx.restore()
 }else{
  ctx.fillStyle=theme.muted;ctx.font='800 24px system-ui';ctx.textAlign='center';ctx.fillText('note',ix+iw/2,55);ctx.textAlign='start'
 }

 try{avatar?.close?.()}catch{}
 try{if(thumbnail!==avatar)thumbnail?.close?.()}catch{}
 const blob=await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('画像生成失敗')),'image/png',1));
 return new page.File([blob],'mumei_profile_note_v221_'+String(row.index).padStart(3,'0')+'.png',{type:'image/png'})
}

function insertNode(view,node,pos){
 const at=Math.max(0,Math.min(view.state.doc.content.size,Number(pos)||0));
 view.dispatch(view.state.tr.insert(at,node));
 return{pos:at,nextPos:at+node.nodeSize}
}
function headingText(group){
 const from=group*10+1,to=Math.min(from+9,TARGET);
 return String(group+1).padStart(2,'0')+'｜'+from+'人目〜'+to+'人目のクリエイター様'
}
function activityText(row){return'活動内容｜'+String(row.activityLabel||'日々のことや気づきを発信')}
function insertHeading(view,text,pos){
 const type=view.state.schema.nodes.heading;
 let node;
 try{node=type.create({level:2},view.state.schema.text(text))}
 catch{node=type.create(null,view.state.schema.text(text))}
 return insertNode(view,node,pos)
}
function insertActivity(view,row,pos){
 const paragraph=view.state.schema.nodes.paragraph;
 const strong=view.state.schema.marks?.strong;
 const marks=strong?[strong.create()]:[];
 const node=paragraph.create(null,view.state.schema.text(activityText(row),marks));
 return insertNode(view,node,pos)
}
function findText(view,type,text,minPos=0){
 let hit=null;
 view.state.doc.descendants((node,pos)=>{
  if(!hit&&pos>=minPos&&node.type?.name===type&&String(node.textContent||'')===text)hit={node,pos}
 });
 return hit
}
function recordImage(hit,row){
 const run=readRun()||{version:VERSION,articleKey:editorArticleKey(),items:[],createdAt:Date.now()};
 const record={id:String(hit?.node?.attrs?.id||''),src:String(hit?.node?.attrs?.src||''),url:norm(row.url),creator:String(row.creator||''),at:Date.now()};
 const items=Array.isArray(run.items)?run.items:[];
 const key=item=>String(item.id||'')+'|'+String(item.src||'')+'|'+norm(item.url);
 if(!items.some(item=>key(item)===key(record)))items.push(record);
 writeRun({...run,items,updatedAt:Date.now()})
}
function recordText(field,text){
 const run=readRun();if(!run)return;
 const values=Array.isArray(run[field])?run[field]:[];
 values.push(text);
 writeRun({...run,[field]:values,updatedAt:Date.now()})
}
function ownedImages(view){
 const run=readRun(),records=Array.isArray(run?.items)?run.items:[],all=imageNodes(view),owned=[];
 for(const record of records){
  const byId=record.id?all.find(x=>String(x.node.attrs?.id||'')===String(record.id)):null;
  if(byId&&norm(byId.node.attrs?.link)===norm(record.url)){owned.push(byId);continue}
  if(record.src){
   const matches=all.filter(x=>String(x.node.attrs?.src||'')===String(record.src)&&norm(x.node.attrs?.link)===norm(record.url));
   if(matches.length===1)owned.push(matches[0])
  }
 }
 return[...new Map(owned.map(x=>[x.pos,x])).values()].sort((a,b)=>a.pos-b.pos)
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
async function cleanup(){
 const view=findView(),run=readRun();
 if(!view||!run){setStatus('今回分はありません');return}
 const hits=[...ownedImages(view)];
 const headings=new Set(run.sectionHeadings||[]);
 const activities=new Set(run.activityTexts||[]);
 const cardKeys=new Set((run.cardKeys||[]).map(x=>String(x.key||'')));
 view.state.doc.descendants((node,pos)=>{
  if(node.type?.name==='heading'&&headings.has(String(node.textContent||'')))hits.push({node,pos});
  if(node.type?.name==='paragraph'&&(activities.has(String(node.textContent||''))||/^活動内容｜/.test(String(node.textContent||''))))hits.push({node,pos});
  if(node.type?.name==='embed'&&cardKeys.has(cardKey({node,pos})))hits.push({node,pos})
 });
 const removed=deleteHits(view,hits);
 writeRun(null);
 setStatus('今回分 '+removed+'件を削除しました')
}

async function create(){
 if(busy)return;
 busy=true;stopping=false;
 await keepAwake();
 try{
  const view=findView();
  if(!view)throw new Error('note本文編集欄を取得できません');
  nativeImageCommand();selectionApi();

  let run=readRun();
  if(run&&!run.likesHistoryFix221&&((run.items?.length||0)||(run.cardKeys?.length||0)))throw new Error('旧版の作成分が残っています。修正版パネルの「今回分削除」を押してから実行してください');

  let rows;
  if(run?.likesHistoryFix221&&Array.isArray(run.rows)&&run.rows.length===301)rows=run.rows;
  else{
   const creators=await buildRows();
   rows=[...creators,await finalRow()]
  }

  if(!run?.likesHistoryFix221){
   run={
    version:VERSION,
    articleKey:editorArticleKey(),
    items:[],
    cardKeys:[],
    sectionHeadings:[],
    activityTexts:[],
    rows,
    cardBaselineKeys:embedNodes(view).map(cardKey).filter(Boolean),
    createdAt:Date.now(),
    stage:'images_building',
    likesHistory:true,
    likesHistoryFix221:true,
    imageAnchorPos:cardAnchor(view),
    sources:'INSIGHT スキ履歴',
    mode:'number',
    count:TARGET,
    choice:'latest'
   };
   writeRun(run)
  }else{
   run={...run,rows,stage:'images_building',updatedAt:Date.now()};
   writeRun(run)
  }

  const completed=ownedImages(view);
  const done=Math.min(completed.length,rows.length);
  let insertPos=done?completed[done-1].pos+completed[done-1].node.nodeSize:Number(run.imageAnchorPos);
  if(!Number.isFinite(insertPos))insertPos=cardAnchor(view);
  setStatus('続きから開始｜'+done+'/'+rows.length+'件済み');

  for(let index=done;index<rows.length;index++){
   if(stopping)throw new Error('停止しました');
   const row=rows[index];

   if(row.finalMarker){
    const text='最後に｜実績の算数';
    const existing=findText(view,'heading',text,insertPos);
    if(existing)insertPos=existing.pos+existing.node.nodeSize;
    else{const hit=insertHeading(view,text,insertPos);insertPos=hit.nextPos;recordText('sectionHeadings',text)}
   }else if(index%10===0){
    const text=headingText(Math.floor(index/10));
    const existing=findText(view,'heading',text,insertPos);
    if(existing)insertPos=existing.pos+existing.node.nodeSize;
    else{const hit=insertHeading(view,text,insertPos);insertPos=hit.nextPos;recordText('sectionHeadings',text)}
   }

   if(!row.finalMarker){
    const text=activityText(row);
    const existing=findText(view,'paragraph',text,insertPos);
    if(existing)insertPos=existing.pos+existing.node.nodeSize;
    else{const hit=insertActivity(view,row,insertPos);insertPos=hit.nextPos;recordText('activityTexts',text)}
   }

   setStatus((index+1)+'/'+rows.length+'｜'+row.creator+'｜アイコン＋記事サムネ');
   const file=await makeImage(row);
   const result=await upload(view,row,file,insertPos);
   insertPos=result.nextPos;
   recordImage(result.hit,row);
   await sleep(560)
  }

  run=readRun()||run;
  writeRun({...run,stage:'images_ready',rows,imagesCompletedAt:Date.now(),updatedAt:Date.now()});
  setStatus('完了 ✅ 実アイコン・記事サムネ・外部活動文｜次は旧パネルの②カード続き/開始')
 }catch(error){
  setStatus('停止：'+(error?.message||String(error)),true)
 }finally{
  busy=false;
  await releaseAwake()
 }
}
function stop(){
 stopping=true;
 abortRequests();
 setStatus('停止しました｜完成分は保持')
}

function mountEditor(){
 document.getElementById('mumei-like300-fix-editor')?.remove();
 if(!document.body||document.getElementById(PANEL_ID))return;
 const panel=document.createElement('div');
 panel.id=PANEL_ID;
 panel.style.cssText='position:fixed;left:6px;bottom:92px;z-index:2147483647;width:170px;padding:7px;border:1px solid #62e2c4;border-radius:11px;background:#071923;color:#efffff;font:800 8px/1.4 system-ui;box-shadow:0 8px 26px #0009';
 panel.innerHTML='<b style="display:block;margin-bottom:5px">INSIGHTスキ300 修正版 v2.2.1</b><div style="display:grid;grid-template-columns:1fr 1fr;gap:4px"><button data-fix="prep">INSIGHTで準備</button><button data-fix="start">①画像300</button><button data-fix="stop">停止</button><button data-fix="clear">今回分削除</button></div><div id="mumei-like300-fix-editor-status-v221" style="margin-top:6px;color:#bff5e8">活動内容は画像の外側・直上へ挿入</div>';
 document.body.appendChild(panel);
 panel.querySelectorAll('button').forEach(button=>button.style.cssText='min-height:28px;border:1px solid #4f917f;border-radius:6px;background:#104238;color:#fff;font:900 7px system-ui');
 panel.querySelector('[data-fix="prep"]').addEventListener('click',()=>window.open('https://mumei-s.github.io/note-insight/?like300fix=1#dashboard','_blank','noopener'));
 panel.querySelector('[data-fix="start"]').addEventListener('click',()=>void create());
 panel.querySelector('[data-fix="stop"]').addEventListener('pointerdown',event=>{event.preventDefault();stop()},{capture:true});
 panel.querySelector('[data-fix="clear"]').addEventListener('click',()=>void cleanup());
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mountEditor,{once:true});
else mountEditor();

})();