// ==UserScript==
// @name         無名S note アイコン＋キャプション 貼り付け装置
// @namespace    https://github.com/mumei-s/note-insight/profile-card-paster
// @version      2.2.0
// @description  INSIGHTスキ履歴300人修正版。実アイコン・最新記事サムネイルを極薄へ表示し、活動内容は画像外の上段テキストとして挿入。
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
// @require      https://raw.githubusercontent.com/mumei-s/note-insight/ceca4b92ceda9ed1bc444ccc82b629bf3b5c5f3a/public/note-profile-card-paster-v1.user.js
// @updateURL    https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-profile-card-paster-v22.user.js
// @downloadURL  https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-profile-card-paster-v22.user.js
// ==/UserScript==

(function(){
'use strict';

const page=typeof unsafeWindow!=='undefined'?unsafeWindow:window;
if(location.hostname!=='editor.note.com')return;
if(page.__MUMEI_LIKE300_FIX_V220__)return;
page.__MUMEI_LIKE300_FIX_V220__=true;

const VERSION='2.2.0';
const PANEL='mumei-profile-card-paster-v1';
const STATUS='mumei-profile-card-paster-status-v1';
const BRIDGE_KEY='mumei_profile_card_likes_300_v2';
const RUN_PREFIX='mumei_profile_card_paster_run_v15:';
const PREP_PREFIX='mumei_profile_like300_fix_v220:';
const FINAL_URL='https://note.com/fuku444/n/nb4f6934381e9';
const FINAL_KEY='nb4f6934381e9';
const W=860,H=140;
const IMAGE_GAP=560;

let busy=false;
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
function setStatus(text,bad=false){
 const el=document.getElementById(STATUS);
 if(el){el.textContent=text;el.dataset.bad=bad?'1':'0'}
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
  actorImageUrl:mediaUrl(creator.actorImageUrl||user.user_profile_image_url||user.profileImageUrl||user.profile_image_url||user.user_profile_image_path||user.profile_image_path||user.profileImagePath||user.icon_url||user.image_url||''),
  url,
  title:String(note.name||note.title||'無題の記事').trim(),
  key,
  publishAt:String(note.publishAt||note.publish_at||note.published_at||note.created_at||'').trim()||null,
  thumbUrl:mediaUrl(note.eyecatch_url||note.image_url||note.imageUrl||note.thumbnail_url||note.thumbnailUrl||note.eyecatch?.url||note.eyecatch_image?.url||note.eyecatchImage?.url||note.image?.url||note.thumbnail?.url||'')
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
function activityLabelFromText(text){
 const t=String(text||'').replace(/\s+/g,' ');
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
 const scored=rules.map(([re,label])=>({label,count:(t.match(re)||[]).length})).filter(x=>x.count>0).sort((a,b)=>b.count-a.count);
 if(!scored.length)return'日々のことや気づきを発信';
 const labels=scored.slice(0,2).map(x=>x.label);
 return labels.join('／')+'を中心に発信'
}
async function preparePerson(person){
 const id=String(person?.urlname||'').trim();
 if(!id)return null;
 try{
  const [contents,profilePayload]=await Promise.all([
   creatorContents(id),
   xhrJSON('https://note.com/api/v2/creators/'+encodeURIComponent(id)).catch(()=>({}))
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

  const avatar=mediaUrl(
   profile.user_profile_image_url||profile.profile_image_url||profile.profileImageUrl||
   profile.user_profile_image_path||profile.profile_image_path||profile.profileImagePath||
   profile.icon_url||profile.image_url||
   user.user_profile_image_url||user.profile_image_url||user.profileImageUrl||
   user.user_profile_image_path||user.profile_image_path||user.profileImagePath||
   user.icon_url||user.image_url||
   person.actorImageUrl||latest.actorImageUrl||''
  );
  let thumb=mediaUrl(
   note.eyecatch_url||note.image_url||note.imageUrl||note.thumbnail_url||note.thumbnailUrl||
   note.eyecatch?.url||note.eyecatch_image?.url||note.eyecatchImage?.url||
   note.image?.url||note.thumbnail?.url||latest.thumbUrl||metaThumb||''
  );
  if(!thumb)thumb=avatar;

  const activitySource=[
   profile.profile,profile.description,profile.bio,profile.introduction,profile.self_introduction,profile.note_intro,
   ...list.slice(0,6).flatMap(x=>[x?.name,x?.title,x?.description,x?.body_text]),
   note.name,note.title,note.description,note.body_text
  ].filter(Boolean).join(' ');

  return{
   ...latest,
   creator:String(profile.nickname||profile.name||user.nickname||user.name||person.creator||id).trim(),
   actorImageUrl:avatar,
   thumbUrl:thumb,
   title:String(note.name||note.title||latest.title||'無題の記事').trim(),
   activityLabel:activityLabelFromText(activitySource),
   likesHistory:true,
   likedAt:String(person.likedAt||'')
  }
 }catch{return null}
}
async function buildRows(target=300){
 const bridge=await Promise.resolve(GM_getValue(BRIDGE_KEY,null));
 const people=Array.isArray(bridge?.people)?bridge.people:[];
 if(!people.length)throw new Error('INSIGHT側の準備データがありません。「INSIGHTで準備」を先に押してください');
 const signature=String(bridge?.at||0)+'|'+target;
 let saved;
 try{saved=JSON.parse(localStorage.getItem(prepKey())||'null')}catch{saved=null}
 let rows=Array.isArray(saved?.rows)&&saved.signature===signature?saved.rows:[];
 let index=saved?.signature===signature?Number(saved.index||0):0;
 const seen=new Set(rows.map(x=>String(x.urlname||'').toLowerCase()).filter(Boolean));

 while(index<people.length&&rows.length<target){
  if(stopRequested)throw new Error('停止しました');
  const batch=people.slice(index,index+4);
  index+=batch.length;
  setStatus('スキ履歴300｜アイコン・サムネ・活動確認 '+rows.length+'/'+target+'｜候補 '+index+'/'+people.length);
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
  const avatar=mediaUrl(profile.user_profile_image_url||profile.profile_image_url||profile.profileImageUrl||profile.user_profile_image_path||profile.profile_image_path||profile.profileImagePath||user.user_profile_image_url||user.profile_image_url||user.profileImageUrl||'');
  const thumb=mediaUrl(note.eyecatch_url||note.image_url||note.thumbnail_url||note.eyecatch?.url||note.image?.url||metaThumb||avatar||'');
  return{...row,creator:String(profile.nickname||profile.name||user.nickname||user.name||'実績の算数'),actorImageUrl:avatar,thumbUrl:thumb,finalMarker:true,index:301}
 }catch{return{...row,finalMarker:true,index:301}}
}

async function bitmapFromUrl(url){
 if(!url)return null;
 try{
  const blob=await xhr(url,'blob',45000);
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
 else if(pattern===4){for(const r of [20,38,56,74]){ctx.beginPath();ctx.arc(515,70,r,0,Math.PI*2);ctx.stroke()}}
 else if(pattern===5){ctx.setLineDash([7,6]);rounded(ctx,14,12,542,H-24,14);ctx.stroke();ctx.setLineDash([])}
 else if(pattern===6){for(let x=395;x<570;x+=24)ctx.fillRect(x,10,12,H-20)}
 else if(pattern===7){ctx.beginPath();ctx.moveTo(0,118);for(let x=0;x<570;x+=32)ctx.lineTo(x,118-(x/32%3)*17);ctx.stroke()}
 else if(pattern===8){for(let y=12;y<132;y+=24)for(let x=400;x<570;x+=24)ctx.strokeRect(x,y,18,18)}
 else{for(let a=0;a<Math.PI*2;a+=Math.PI/18){ctx.beginPath();ctx.moveTo(520,70);ctx.lineTo(520+Math.cos(a)*100,70+Math.sin(a)*68);ctx.stroke()}}
 ctx.restore()
}
async function makeFile(row){
 let [avatar,thumb]=await Promise.all([bitmapFromUrl(row.actorImageUrl),bitmapFromUrl(row.thumbUrl)]);
 if(!thumb&&avatar)thumb=avatar;
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
function activityText(row){return'活動内容｜'+String(row.activityLabel||'日々のことや気づきを発信')}
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
 const strong=view.state.schema.marks?.strong;
 const marks=strong?[strong.create()]:[];
 const node=type.create(null,view.state.schema.text(text,marks));
 view.dispatch(view.state.tr.insert(at,node));
 const actual=view.state.doc.nodeAt(at);
 if(!actual||actual.type?.name!=='paragraph'||String(actual.textContent||'')!==text)throw new Error('活動内容テキスト挿入に失敗しました');
 return{text,pos:at,nextPos:at+actual.nodeSize}
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
 try{
  setStatus('修正版を開始｜実アイコン・記事サムネ・外部活動文を確認中');
  const view=findView();
  if(!view)throw new Error('note本文編集欄を取得できません');
  nativeImageCommand();selectionApi();

  const existing=readRun();
  if((existing?.items?.length||0)||(existing?.cardKeys?.length||0))throw new Error('旧版の作成分が残っています。「最初に戻る」で消してから修正版を実行してください');

  let rows;
  if(existing?.likesHistoryFix220&&Array.isArray(existing.rows)&&existing.rows.length===301)rows=existing.rows;
  else{
   const creators=await buildRows(300);
   const finalRow=await enrichFinal();
   rows=[...creators,finalRow]
  }

  let run=readRun();
  if(!run?.likesHistoryFix220){
   run={
    version:VERSION,articleKey:editorArticleKey(),items:[],cardKeys:[],sectionHeadings:[],activityTexts:[],rows,
    cardBaselineKeys:embedNodes(view).map(cardKey).filter(Boolean),
    createdAt:Date.now(),stage:'images_building',likesHistory:true,likesHistoryFix220:true,
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

  setStatus('修正版｜'+done+'/'+rows.length+'件済み。続きから貼り付け');
  for(let i=done;i<rows.length;i++){
   if(stopRequested)throw new Error('停止しました');
   const row=rows[i];

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
   const file=await makeFile(row);
   const made=await uploadOne(view,row,file,insertPos);
   insertPos=made.nextPos;
   recordImage(made.hit,row);
   await sleep(IMAGE_GAP)
  }

  run=readRun()||run;
  writeRun({...run,stage:'images_ready',rows,imagesCompletedAt:Date.now(),updatedAt:Date.now()});
  setStatus('修正版完了 ✅ アイコン・記事サムネ・外部活動文｜次は②カード続き/開始')
 }catch(error){
  setStatus('修正版停止：'+(error?.message||String(error)),true)
 }finally{busy=false}
}
function stopFix(){
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
 if(summary)summary.textContent='＋ INSIGHTスキ履歴300人【修正版】';
 const hint=detail.querySelector('.hint');
 if(hint)hint.textContent='実アイコン＋最新記事サムネを極薄50種へ表示。活動内容は画像の外側・直上に太字テキストで挿入。';

 const oldButton=detail.querySelector('[data-a="like300-images"],[data-a="like300-fixed"]');
 if(oldButton){
  const button=oldButton.cloneNode(true);
  button.dataset.a='like300-fixed';
  button.textContent='① アイコン＋サムネ付300';
  button.style.background='#176b54';
  button.style.borderColor='#5bd7a7';
  oldButton.replaceWith(button);
  button.addEventListener('click',event=>{event.preventDefault();void createFixed300()})
 }

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