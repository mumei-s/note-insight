// ==UserScript==
// @name         無名S note アイコン＋キャプション 貼り付け装置
// @namespace    https://github.com/mumei-s/note-insight/profile-card-paster
// @version      1.1.0
// @description  複数の記事URL・#タグ・マガジンURLを上から優先して合算し、件数/全数を指定。アイコン＋画像内キャプション＋記事サムネを記事リンク付きで全自動貼付。
// @match        https://editor.note.com/*
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @connect      note.com
// @connect      assets.st-note.com
// @updateURL    https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-profile-card-paster-v1.user.js
// @downloadURL  https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-profile-card-paster-v1.user.js
// ==/UserScript==

(function(){
'use strict';
const page=typeof unsafeWindow!=='undefined'?unsafeWindow:window;
if(page.__MUMEI_PROFILE_CARD_PASTER_V1__)return;
page.__MUMEI_PROFILE_CARD_PASTER_V1__=true;

const VERSION='1.1.0';
const PANEL='mumei-profile-card-paster-v1';
const STATUS='mumei-profile-card-paster-status-v1';
const PREF='mumei_profile_card_paster_v1';
const POS='mumei_profile_card_paster_pos_v1';
const W=860,H=140;
const FINAL_URL='https://note.com/fuku444/n/nb4f6934381e9';
const FINAL_KEY='nb4f6934381e9';
let busy=false,stopRequested=false,viewCache=null,imageCommandCache=null,selectionCache=null,dragging=false,longTimer=0;

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const norm=v=>{try{const u=new URL(String(v||''),location.href);u.search='';u.hash='';return u.href}catch{return String(v||'').trim()}};
const noteKey=url=>String(url||'').match(/\/n\/(n[a-f0-9]{12})(?:[/?#]|$)/i)?.[1]||'';
const magazineKey=url=>String(url||'').match(/\/(?:m|magazines)\/(m[a-z0-9]+)(?:[/?#]|$)/i)?.[1]||'';
function getPrefs(){try{return JSON.parse(localStorage.getItem(PREF)||'{}')||{}}catch{return{}}}
function setPrefs(v){try{localStorage.setItem(PREF,JSON.stringify(v))}catch{}}
function setStatus(t,bad=false){const e=document.getElementById(STATUS);if(e){e.textContent=t;e.dataset.bad=bad?'1':'0'}}
function xhr(url,responseType='text',timeout=60000){
 return new Promise((resolve,reject)=>GM_xmlhttpRequest({
  method:'GET',url,responseType,timeout,
  headers:{Accept:responseType==='blob'?'image/avif,image/webp,image/png,image/jpeg,*/*':'application/json,text/html,*/*'},
  onload:r=>r.status>=200&&r.status<300?resolve(r.response):reject(new Error('GET '+r.status+' '+url)),
  onerror:()=>reject(new Error('通信失敗 '+url)),
  ontimeout:()=>reject(new Error('通信タイムアウト '+url))
 }))
}
async function xhrJSON(url){const raw=await xhr(url,'text');try{return JSON.parse(String(raw||''))}catch{throw new Error('JSON解析失敗 '+url)}}

function webpackRequire(){const chunks=page.webpackChunk_N_E;if(!chunks||typeof chunks.push!=='function')return null;let req=null;const id=996000000+Math.floor(Math.random()*900000);try{chunks.push([[id],{},r=>{req=r}])}catch{}return req}
function looksLikeView(v){try{return Boolean(v&&typeof v==='object'&&v.state?.doc&&v.state?.schema&&typeof v.dispatch==='function'&&v.dom&&typeof v.posAtDOM==='function')}catch{return false}}
function findView(){
 if(looksLikeView(viewCache)&&viewCache.dom?.isConnected)return viewCache;
 const root=document.querySelector('.ProseMirror[contenteditable="true"]')||document.querySelector('.ProseMirror');if(!root)return null;
 const seen=new Set(),q=[];let seed=root;for(let i=0;i<6&&seed;i++,seed=seed.parentElement)q.push([seed,0]);
 let n=0;while(q.length&&n++<14000){const[v,d]=q.shift();if(!v||seen.has(v))continue;seen.add(v);if(looksLikeView(v))return viewCache=v;let keys=[];try{keys=Object.getOwnPropertyNames(v)}catch{continue}for(const k of keys){if(['window','document','ownerDocument','parentNode','children','childNodes','style'].includes(k))continue;let x;try{x=v[k]}catch{continue}if(looksLikeView(x))return viewCache=x;if(d<7&&x&&(typeof x==='object'||typeof x==='function')&&x!==page&&x!==document)q.push([x,d+1])}}return null
}
function nativeImageCommand(){
 if(imageCommandCache)return imageCommandCache;
 const req=webpackRequire();let cmd;try{cmd=req?.(94928)?.CwN}catch{}
 const src=typeof cmd==='function'?Function.prototype.toString.call(cmd):'';
 if(!(cmd?.length===4&&/Array\.from/.test(src)&&/imageUploading/.test(src)&&/entries/.test(src)))throw new Error('note正規画像処理を取得できません');
 return imageCommandCache=cmd
}
function selectionApi(){
 if(selectionCache)return selectionCache;
 const req=webpackRequire();let mod;try{mod=req?.(44044)}catch{}
 const Selection=mod?.Y1;
 if(typeof Selection?.atEnd!=='function')throw new Error('note内部Selectionを取得できません');
 return selectionCache=Selection
}
function ensureEndSelection(view){
 const paragraph=view.state.schema.nodes.paragraph;
 if(!paragraph)throw new Error('note段落を取得できません');
 const last=view.state.doc.lastChild;
 if(!last||last.type!==paragraph||last.textContent!=='')view.dispatch(view.state.tr.insert(view.state.doc.content.size,paragraph.create()));
 view.dispatch(view.state.tr.setSelection(selectionApi().atEnd(view.state.doc)).scrollIntoView());
 view.focus()
}
function imageNodes(view){const out=[];view.state.doc.descendants((node,pos)=>{if(node.type?.name==='image')out.push({node,pos})});return out}
function remoteImage(node){const src=String(node?.attrs?.src||'');return /^https:\/\//i.test(src)&&!/raw\.githubusercontent\.com/i.test(src)}
async function waitNewNoteImage(view,beforeIds,timeout=150000){
 const end=Date.now()+timeout;
 while(Date.now()<end){
  const fresh=imageNodes(view).filter(h=>{const id=String(h.node.attrs?.id||'');return id&&!beforeIds.has(id)&&remoteImage(h.node)}).sort((a,b)=>a.pos-b.pos);
  if(fresh.length===1)return fresh[0];
  if(fresh.length>1)return fresh.at(-1);
  if(stopRequested)throw new Error('停止しました');
  await sleep(350)
 }
 throw new Error('note画像アップロード待ちタイムアウト')
}
function setImageLink(view,hit,row){
 const node=view.state.doc.nodeAt(hit.pos)||hit.node;
 if(node?.type?.name!=='image')throw new Error('画像ノードを確認できません');
 view.dispatch(view.state.tr.setNodeMarkup(hit.pos,node.type,{...node.attrs,link:row.url},node.marks));
 const id=String(node.attrs?.id||'');
 const after=imageNodes(view).find(h=>id&&String(h.node.attrs?.id||'')===id)||imageNodes(view).find(h=>h.pos===hit.pos);
 if(!after||norm(after.node.attrs?.link)!==norm(row.url))throw new Error('画像リンク設定に失敗しました');
 return after
}

function parseLiker(item){
 const u=item?.user||{},urlname=String(u.urlname||'').trim(),id=String(u.key??u.id??urlname).trim();
 if(!id||!urlname)return null;
 return{likerKey:id,urlname,creator:String(u.nickname||u.name||urlname).trim(),actorUrl:'https://note.com/'+urlname,actorImageUrl:String(u.user_profile_image_url||u.profileImageUrl||u.profile_image_url||'').trim()}
}
function contentList(p){const d=p?.data&&typeof p.data==='object'?p.data:{};return Array.isArray(d.contents)?d.contents:Array.isArray(d.notes)?d.notes:[]}
function articleFromRaw(raw,creator={}){
 const note=raw?.note&&typeof raw.note==='object'?raw.note:raw;if(!note||typeof note!=='object')return null;
 const key=String(note.key||'').trim();if(!/^n[a-f0-9]{12}$/i.test(key))return null;
 const user=note.user||note.author||{},urlname=String(creator.urlname||user.urlname||'').trim();
 const url=norm(note.noteUrl||note.url||(urlname?'https://note.com/'+urlname+'/n/'+key:''));
 if(!url)return null;
 return{
  likerKey:String(creator.likerKey||user.key||user.id||urlname||key),urlname,
  creator:String(creator.creator||user.nickname||user.name||urlname||'noteクリエイター').trim(),
  actorUrl:String(creator.actorUrl||(urlname?'https://note.com/'+urlname:'')),
  actorImageUrl:String(creator.actorImageUrl||user.user_profile_image_url||user.profileImageUrl||user.profile_image_url||'').trim(),
  url,title:String(note.name||note.title||'無題の記事').trim(),key,
  publishAt:String(note.publishAt||note.publish_at||note.published_at||note.created_at||'').trim()||null,
  thumbUrl:String(note.eyecatch_url||note.image_url||note.thumbnail_url||note.eyecatch?.url||'').trim()
 }
}
async function creatorContents(id,pageNo=1,disabledPinned=true){return xhrJSON('https://note.com/api/v2/creators/'+encodeURIComponent(id)+'/contents?kind=note&page='+pageNo+'&disabled_pinned='+(disabledPinned?'true':'false')+'&with_notes=false')}
async function chooseCreatorArticle(creator,choice){
 try{
  if(choice==='fixed'){
   const p=await creatorContents(creator.urlname,1,false);
   return articleFromRaw(contentList(p)[0],creator)
  }
  if(choice==='oldest'){
   const first=await creatorContents(creator.urlname,1,true),list=contentList(first);if(!list.length)return null;
   const d=first?.data&&typeof first.data==='object'?first.data:{},total=Number(d.totalCount||0),per=Math.max(1,list.length),lastPage=Math.min(500,total>0?Math.max(1,Math.ceil(total/per)):1);
   const lp=lastPage===1?first:await creatorContents(creator.urlname,lastPage,true),candidates=contentList(lp).map(x=>articleFromRaw(x,creator)).filter(Boolean);
   candidates.sort((a,b)=>new Date(a.publishAt||0)-new Date(b.publishAt||0));
   return candidates[0]||null
  }
  const p=await creatorContents(creator.urlname,1,true);
  return articleFromRaw(contentList(p)[0],creator)
 }catch{return null}
}
function parseSourceLines(raw,kind){
 const out=[];
 for(const line0 of String(raw||'').split(/\r?\n/)){
  const line=line0.trim();if(!line)continue;
  if(kind==='likes'){
   const urls=line.match(/https?:\/\/[^\s,、]+/g)||[];
   for(const url of urls){if(noteKey(url))out.push({type:'note',value:norm(url),label:norm(url)})}
   const tags=[...line.matchAll(/#([^#\s,、]+)/g)].map(m=>m[1].trim()).filter(Boolean);
   for(const tag of tags)out.push({type:'tag',value:tag,label:'#'+tag});
   if(!urls.length&&!tags.length){const tag=line.replace(/^#+/,'').trim();if(tag)out.push({type:'tag',value:tag,label:'#'+tag})}
  }else{
   const urls=line.match(/https?:\/\/[^\s,、]+/g)||[];
   for(const url of urls){if(magazineKey(url))out.push({type:'mag',value:norm(url),label:norm(url)})}
  }
 }
 const seen=new Set();
 return out.filter(x=>{const k=x.type+'|'+x.value;if(seen.has(k))return false;seen.add(k);return true})
}
function normalizeSearch(j){
 const d=j?.data??j??{},notes=d.notes||{},arr=notes.contents||notes.notes||d.contents||[];
 return{arr:Array.isArray(arr)?arr:[],cursor:d?.cursor?.note??d.note_cursor??notes.next_cursor??notes.cursor??null,last:notes.is_last_page===true||notes.isLastPage===true}
}
function targetLimit(mode,count){return mode==='all'?Infinity:Math.max(0,Number(count||0))}
async function collectLikesAndTags(raw,mode,count,choice){
 const sources=parseSourceLines(raw,'likes'),limit=targetLimit(mode,count);
 if(!sources.length||limit===0)return[];
 const out=[],seenUrls=new Set(),seenCreators=new Set();
 const add=row=>{if(!row)return false;const u=norm(row.url);if(!u||u===norm(FINAL_URL)||seenUrls.has(u))return false;seenUrls.add(u);out.push({...row,url:u});return true};
 for(let si=0;si<sources.length&&out.length<limit;si++){
  const src=sources[si];
  if(stopRequested)throw new Error('停止しました');
  if(src.type==='note'){
   const key=noteKey(src.value);if(!key)continue;
   for(let pageNo=1;pageNo<=200&&out.length<limit;pageNo++){
    setStatus('① '+(si+1)+'/'+sources.length+' '+src.label+'｜スキ '+out.length+(mode==='all'?' / 全数':' / '+limit));
    const p=await xhrJSON('https://note.com/api/v3/notes/'+encodeURIComponent(key)+'/likes?page='+pageNo+'&per=50');
    const list=Array.isArray(p?.data?.likes)?p.data.likes:[];
    const creators=[];
    for(const item of list){
     const c=parseLiker(item);if(!c||seenCreators.has(c.likerKey))continue;
     seenCreators.add(c.likerKey);creators.push(c)
    }
    for(let i=0;i<creators.length&&out.length<limit;i+=5){
     if(stopRequested)throw new Error('停止しました');
     const chosen=await Promise.all(creators.slice(i,i+5).map(c=>chooseCreatorArticle(c,choice)));
     for(const row of chosen){add(row);if(out.length>=limit)break}
    }
    if(list.length<50)break
   }
  }else if(src.type==='tag'){
   let cursor='0';
   for(let pageNo=1;pageNo<=250&&out.length<limit;pageNo++){
    setStatus('① '+(si+1)+'/'+sources.length+' #'+src.value+'｜記事 '+out.length+(mode==='all'?' / 全数':' / '+limit));
    const p=await xhrJSON('https://note.com/api/v3/searches?context=note&q='+encodeURIComponent(src.value)+'&size=20&start='+encodeURIComponent(cursor)+'&sort=new');
    const q=normalizeSearch(p);if(!q.arr.length)break;
    for(const rawNote of q.arr){add(articleFromRaw(rawNote,{}));if(out.length>=limit)break}
    if(q.last||q.cursor==null||String(q.cursor)===String(cursor))break;
    cursor=String(q.cursor);await sleep(70)
   }
  }
 }
 return out
}
async function collectMagazines(raw,mode,count){
 const sources=parseSourceLines(raw,'mag'),limit=targetLimit(mode,count);
 if(!sources.length||limit===0)return[];
 const out=[],seen=new Set();
 const add=row=>{if(!row)return;const u=norm(row.url);if(!u||u===norm(FINAL_URL)||seen.has(u))return;seen.add(u);out.push({...row,url:u})};
 for(let si=0;si<sources.length&&out.length<limit;si++){
  const key=magazineKey(sources[si].value);if(!key)continue;
  let start=0;
  while(out.length<limit&&start<10000){
   if(stopRequested)throw new Error('停止しました');
   setStatus('② '+(si+1)+'/'+sources.length+' マガジン｜'+out.length+(mode==='all'?' / 全数':' / '+limit));
   const p=await xhrJSON('https://note.com/api/v1/magazines/'+encodeURIComponent(key)+'/notes?start='+start+'&limit=100');
   const d=p?.data&&typeof p.data==='object'?p.data:{},list=Array.isArray(d.notes)?d.notes:[];
   for(const rawNote of list){add(articleFromRaw(rawNote,{}));if(out.length>=limit)break}
   start+=list.length;if(!list.length||list.length<100)break
  }
 }
 return out
}
async function enrich(row){
 try{
  const p=await xhrJSON('https://note.com/api/v3/notes/'+encodeURIComponent(row.key)),n=p?.data||p||{},u=n.user||n.author||{};
  let thumb=String(n.eyecatch_url||n.image_url||n.thumbnail_url||n.eyecatch?.url||row.thumbUrl||'').trim();if(thumb.startsWith('//'))thumb='https:'+thumb;
  let avatar=String(u.user_profile_image_url||u.profileImageUrl||u.profile_image_url||row.actorImageUrl||'').trim();if(avatar.startsWith('//'))avatar='https:'+avatar;
  return{...row,creator:String(u.nickname||u.name||row.creator||row.urlname||'noteクリエイター').trim(),actorImageUrl:avatar,thumbUrl:thumb,title:String(n.name||n.title||row.title||'無題の記事').trim()}
 }catch{return row}
}
async function buildRows(input){
 const likeRows=await collectLikesAndTags(input.likesSources,input.likesMode,input.likesCount,input.choice);
 const magRows=await collectMagazines(input.magSources,input.magMode,input.magCount);
 const seen=new Set(),raw=[];
 for(const row of [...likeRows,...magRows]){
  const u=norm(row?.url);
  if(!u||u===norm(FINAL_URL)||seen.has(u))continue;
  seen.add(u);raw.push({...row,url:u})
 }
 raw.push({
  likerKey:'final-performance-math',urlname:'fuku444',creator:'実績の算数',
  actorUrl:'https://note.com/fuku444',actorImageUrl:'',url:FINAL_URL,
  title:'実績の算数│3日半で0→1達成',key:FINAL_KEY,publishAt:null,thumbUrl:'',finalMarker:true
 });
 const out=[];
 for(let i=0;i<raw.length;i+=5){
  if(stopRequested)throw new Error('停止しました');
  setStatus('アイコン・サムネ情報 '+out.length+'/'+raw.length+'…');
  out.push(...await Promise.all(raw.slice(i,i+5).map(enrich)))
 }
 return out.map((x,i)=>({...x,index:i+1,finalMarker:Boolean(x.finalMarker||norm(x.url)===norm(FINAL_URL))}))
}

async function bitmapFromUrl(url){
 if(!url)return null;
 try{const blob=await xhr(url,'blob',45000);if('createImageBitmap'in page)return await page.createImageBitmap(blob);return await new Promise((resolve,reject)=>{const img=new page.Image(),u=page.URL.createObjectURL(blob);img.onload=()=>{page.URL.revokeObjectURL(u);resolve(img)};img.onerror=()=>{page.URL.revokeObjectURL(u);reject(new Error('画像読込失敗'))};img.src=u})}catch{return null}
}
function rounded(ctx,x,y,w,h,r){const rr=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+rr,y);ctx.arcTo(x+w,y,x+w,y+h,rr);ctx.arcTo(x+w,y+h,x,y+h,rr);ctx.arcTo(x,y+h,x,y,rr);ctx.arcTo(x,y,x+w,y,rr);ctx.closePath()}
function circle(ctx,x,y,r){ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.closePath()}
function fit(ctx,text,max){let s=String(text||'');if(ctx.measureText(s).width<=max)return s;while(s&&ctx.measureText(s+'…').width>max)s=[...s].slice(0,-1).join('');return s+'…'}
function lines(ctx,text,maxWidth,maxLines){const chars=[...String(text||'')],out=[];let line='';for(let i=0;i<chars.length;i++){const test=line+chars[i];if(line&&ctx.measureText(test).width>maxWidth){out.push(line);line=chars[i];if(out.length===maxLines-1){line=chars.slice(i).join('');break}}else line=test}if(line&&out.length<maxLines){while(line&&ctx.measureText(line+(line.length<String(text||'').length?'…':'')).width>maxWidth)line=[...line].slice(0,-1).join('');out.push(line+(out.length===maxLines-1&&line.length<String(text||'').length?'…':''))}return out.slice(0,maxLines)}
async function makeFile(row){
 const [avatar,thumb]=await Promise.all([bitmapFromUrl(row.actorImageUrl),bitmapFromUrl(row.thumbUrl)]);
 const c=document.createElement('canvas');c.width=W;c.height=H;const ctx=c.getContext('2d');
 ctx.fillStyle='#fff';ctx.fillRect(0,0,W,H);ctx.strokeStyle='#d9dde3';ctx.lineWidth=1.5;rounded(ctx,1,1,W-2,H-2,12);ctx.stroke();
 const ax=50,ay=70,ar=34;
 ctx.fillStyle='#eef2f6';circle(ctx,ax,ay,ar);ctx.fill();
 if(avatar){const iw=avatar.width||avatar.naturalWidth||1,ih=avatar.height||avatar.naturalHeight||1,scale=Math.max((ar*2)/iw,(ar*2)/ih),dw=iw*scale,dh=ih*scale;ctx.save();circle(ctx,ax,ay,ar);ctx.clip();ctx.drawImage(avatar,ax-dw/2,ay-dh/2,dw,dh);ctx.restore()}
 else{ctx.fillStyle='#64748b';ctx.font='800 24px system-ui';ctx.textAlign='center';ctx.fillText('n',ax,57);ctx.textAlign='start'}
 const tx=100,tw=455;ctx.textBaseline='top';ctx.fillStyle='#111827';ctx.font='700 18px system-ui,-apple-system,sans-serif';lines(ctx,row.title,tw,2).forEach((s,i)=>ctx.fillText(s,tx,18+i*25));
 ctx.fillStyle='#475569';ctx.font='700 14px system-ui,-apple-system,sans-serif';ctx.fillText(fit(ctx,row.creator+'さん',tw),tx,86);
 ctx.fillStyle='#94a3b8';ctx.font='12px system-ui,-apple-system,sans-serif';ctx.fillText('note',tx,110);
 const ix=590,iy=8,iw=262,ih=124;ctx.fillStyle='#f1f5f9';rounded(ctx,ix,iy,iw,ih,8);ctx.fill();
 if(thumb){const sw=thumb.width||thumb.naturalWidth||1,sh=thumb.height||thumb.naturalHeight||1,scale=Math.max(iw/sw,ih/sh),dw=sw*scale,dh=sh*scale;ctx.save();rounded(ctx,ix,iy,iw,ih,8);ctx.clip();ctx.drawImage(thumb,ix+(iw-dw)/2,iy+(ih-dh)/2,dw,dh);ctx.restore()}
 else{ctx.fillStyle='#64748b';ctx.font='800 24px system-ui';ctx.textAlign='center';ctx.fillText('note',ix+iw/2,55);ctx.textAlign='start'}
 try{avatar?.close?.()}catch{}try{thumb?.close?.()}catch{}
 const blob=await new Promise((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(new Error('画像生成失敗')),'image/png',1));
 return new page.File([blob],String(row.index).padStart(3,'0')+'_profile_note.png',{type:'image/png'})
}
async function uploadOne(view,row,file){
 ensureEndSelection(view);
 const before=new Set(imageNodes(view).map(h=>String(h.node.attrs?.id||'')).filter(Boolean));
 const dt=new page.DataTransfer();dt.items.add(file);const pos=view.state.selection.from;
 if(nativeImageCommand()(view,dt.files,Math.max(0,pos-1),'image')!==true)throw new Error(row.index+'番 画像アップロードを開始できません');
 const hit=await waitNewNoteImage(view,before,150000);
 setImageLink(view,hit,row);
 ensureEndSelection(view)
}
async function saveOnce(){
 setStatus('貼り付け完了｜下書き保存を1回だけ実行中…');await sleep(1500);
 const b=[...document.querySelectorAll('button')].find(x=>/^(一時保存|下書き保存)$/.test(x.textContent?.trim())&&x.getClientRects().length&&!x.disabled);
 if(b){b.click();await sleep(6000)}
}

function modeValue(name){
 const p=document.getElementById(PANEL);
 return p?.querySelector('[data-'+name+'-mode]')?.value==='all'?'all':'number'
}
function inputValues(save=true){
 const p=document.getElementById(PANEL),g=getPrefs();
 if(!p)return g;
 const likesSources=String(p.querySelector('[data-likes-sources]')?.value||'').trim();
 const magSources=String(p.querySelector('[data-mag-sources]')?.value||'').trim();
 const likesMode=modeValue('likes'),magMode=modeValue('mag');
 const likesCount=Math.max(0,Math.min(5000,Number(p.querySelector('[data-likes-count]')?.value||0)));
 const magCount=Math.max(0,Math.min(5000,Number(p.querySelector('[data-mag-count]')?.value||0)));
 const choice=p.querySelector('button[data-choice].on')?.dataset.choice||g.choice||'latest';
 const v={likesSources,magSources,likesMode,magMode,likesCount,magCount,choice,collapsed:Boolean(g.collapsed),tiny:Boolean(g.tiny)};
 if(save)setPrefs(v);
 return v
}
function choiceLabel(c){return c==='oldest'?'最初の記事':c==='fixed'?'固定→最新':'最新記事'}
function amountLabel(mode,count){return mode==='all'?'全数':String(count)+'件'}
async function run(){
 if(busy)return;busy=true;stopRequested=false;update();
 try{
  const input=inputValues();
  const likesSources=parseSourceLines(input.likesSources,'likes'),magSources=parseSourceLines(input.magSources,'mag');
  if(!likesSources.length&&!magSources.length)throw new Error('記事URL・#タグ・マガジンURLを1つ以上入れてください');
  if(input.likesMode==='number'&&likesSources.length&&input.likesCount<=0)throw new Error('①の件数を1以上にするか「全数」を選んでください');
  if(input.magMode==='number'&&magSources.length&&input.magCount<=0)throw new Error('②の件数を1以上にするか「全数」を選んでください');
  const view=findView();if(!view)throw new Error('note本文編集欄を取得できません');
  nativeImageCommand();selectionApi();
  setStatus('読み込み開始｜① '+amountLabel(input.likesMode,input.likesCount)+'｜② '+amountLabel(input.magMode,input.magCount)+'｜'+choiceLabel(input.choice));
  const rows=await buildRows(input);if(!rows.length)throw new Error('貼り付け対象が0件です');
  for(let i=0;i<rows.length;i++){
   if(stopRequested)throw new Error('手動停止');
   const row=rows[i];
   setStatus('全自動 '+(i+1)+'/'+rows.length+'｜画像生成 '+row.creator);
   const file=await makeFile(row);
   setStatus('全自動 '+(i+1)+'/'+rows.length+'｜noteへ貼付 '+row.creator);
   await uploadOne(view,row,file);
   await sleep(1200);
   if((i+1)%10===0&&i+1<rows.length){setStatus('全自動 '+(i+1)+'/'+rows.length+'｜10秒休止');await sleep(10000)}
  }
  await saveOnce();
  setStatus('完了 ✅ '+rows.length+'件｜＋操作不要｜最後：実績の算数')
 }catch(e){setStatus('停止：'+(e?.message||String(e))+'｜完成分は本文に保持',true)}
 finally{busy=false;update()}
}
function stop(){stopRequested=true;setStatus('停止要求済み｜現在処理中の1件が終わったら停止')}
function update(){
 const p=document.getElementById(PANEL);if(!p)return;
 p.querySelectorAll('textarea,input,select,button').forEach(x=>{if(x.dataset.a==='stop'||x.dataset.ui)return;x.disabled=busy})
}
function saveUiState(extra={}){
 const cur=inputValues(false),old=getPrefs();setPrefs({...old,...cur,...extra})
}
function applyAmountMode(kind){
 const p=document.getElementById(PANEL),sel=p?.querySelector('[data-'+kind+'-mode]'),num=p?.querySelector('[data-'+kind+'-count]');
 if(num)num.style.display=sel?.value==='all'?'none':'block'
}
function setCollapsed(on){
 const p=document.getElementById(PANEL);if(!p)return;
 p.classList.toggle('collapsed',Boolean(on));p.classList.remove('tiny');
 saveUiState({collapsed:Boolean(on),tiny:false})
}
function setTiny(on){
 const p=document.getElementById(PANEL),mini=document.getElementById(PANEL+'-mini');if(!p||!mini)return;
 if(on){
  const r=p.getBoundingClientRect();
  mini.style.left=Math.max(4,Math.min(innerWidth-46,r.left))+'px';
  mini.style.top=Math.max(4,Math.min(innerHeight-46,r.top))+'px';
  mini.style.right='auto';
  p.classList.add('tiny');mini.style.display='flex'
 }else{
  const r=mini.getBoundingClientRect();
  p.style.left=Math.max(4,Math.min(innerWidth-p.offsetWidth-4,r.left))+'px';
  p.style.top=Math.max(4,Math.min(innerHeight-p.offsetHeight-4,r.top))+'px';
  p.style.right='auto';
  p.classList.remove('tiny','collapsed');mini.style.display='none';savePos(p)
 }
 saveUiState({tiny:Boolean(on),collapsed:false})
}
function restorePos(el){
 try{const v=JSON.parse(localStorage.getItem(POS)||'null');if(!v)return;const left=Math.max(4,Math.min(innerWidth-el.offsetWidth-4,Number(v.left)||4)),top=Math.max(4,Math.min(innerHeight-el.offsetHeight-4,Number(v.top)||70));el.style.left=left+'px';el.style.top=top+'px';el.style.right='auto'}catch{}
}
function savePos(el){try{const r=el.getBoundingClientRect();localStorage.setItem(POS,JSON.stringify({left:Math.round(r.left),top:Math.round(r.top)}))}catch{}}
function bindLongDrag(handle,panel){
 let pid=null,startX=0,startY=0,baseL=0,baseT=0;
 const clear=()=>{clearTimeout(longTimer);longTimer=0};
 handle.addEventListener('pointerdown',e=>{
  if(e.button!==undefined&&e.button!==0)return;
  pid=e.pointerId;dragging=false;startX=e.clientX;startY=e.clientY;
  const r=panel.getBoundingClientRect();baseL=r.left;baseT=r.top;clear();
  longTimer=setTimeout(()=>{dragging=true;try{handle.setPointerCapture(pid)}catch{}},420)
 });
 handle.addEventListener('pointermove',e=>{
  if(!dragging||e.pointerId!==pid)return;e.preventDefault();
  const l=Math.max(4,Math.min(innerWidth-panel.offsetWidth-4,baseL+e.clientX-startX));
  const t=Math.max(4,Math.min(innerHeight-panel.offsetHeight-4,baseT+e.clientY-startY));
  panel.style.left=l+'px';panel.style.top=t+'px';panel.style.right='auto'
 });
 const end=e=>{clear();if(dragging){e.preventDefault();savePos(panel)}dragging=false;pid=null};
 handle.addEventListener('pointerup',end);handle.addEventListener('pointercancel',end)
}
function escAttr(v){return String(v||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;')}
function mount(){
 if(!document.body||document.getElementById(PANEL))return;
 const g=getPrefs(),p=document.createElement('div');p.id=PANEL;
 p.innerHTML=`
 <style>
 #${PANEL}{position:fixed;right:6px;top:70px;z-index:2147483647;width:min(276px,calc(100vw - 12px));padding:7px;border:1px solid #3d6178;border-radius:11px;background:#07131d;color:#edf8ff;box-shadow:0 8px 24px #0008;font:10px/1.3 system-ui;max-height:68vh}
 #${PANEL}.tiny{display:none}#${PANEL}.collapsed .body{display:none}#${PANEL}.collapsed{width:176px;padding:5px}
 #${PANEL} .head{display:grid;grid-template-columns:1fr 28px 28px;gap:3px;align-items:center;touch-action:none;user-select:none}
 #${PANEL} .title{font-weight:950;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:grab}
 #${PANEL} .body{max-height:calc(68vh - 36px);overflow:auto;padding-right:1px}
 #${PANEL} label{display:block;margin-top:5px;font-size:9px;color:#b9d8e8}
 #${PANEL} textarea{width:100%;height:44px;resize:vertical;margin-top:2px;padding:5px;border:1px solid #395970;border-radius:7px;background:#0b1d28;color:#fff;font:9px/1.3 system-ui}
 #${PANEL} input,#${PANEL} select{width:100%;height:30px;padding:3px 5px;border:1px solid #395970;border-radius:7px;background:#0b1d28;color:#fff;font-size:10px}
 #${PANEL} .amount{display:grid;grid-template-columns:74px 1fr;gap:4px;margin-top:3px}.choices{display:grid;grid-template-columns:repeat(3,1fr);gap:3px;margin-top:3px}
 #${PANEL} button{min-height:29px;border:1px solid #416a82;border-radius:7px;background:#102b3b;color:#eaf9ff;font-weight:850;font-size:9px;touch-action:manipulation;pointer-events:auto}
 #${PANEL} .choices button.on{background:#145c73;border-color:#63d7f1;color:#fff}
 #${PANEL} .hint{margin-top:3px;font-size:8px;color:#91b5c8;line-height:1.3}
 #${PANEL} .runrow{display:grid;grid-template-columns:1fr 54px;gap:4px;margin-top:6px}#${PANEL} [data-a="run"]{background:#0b6176;border-color:#64d8ef;color:#fff}
 #${STATUS}{margin-top:5px;padding-top:5px;border-top:1px solid #284555;font-size:8.5px;color:#bfe8ff;word-break:break-word}#${STATUS}[data-bad="1"]{color:#ffb8b8}
 #${PANEL}-mini{position:fixed;right:8px;top:84px;z-index:2147483647;width:42px;height:42px;border:1px solid #5fd4ee;border-radius:50%;background:#082333;color:#fff;font:950 11px system-ui;display:none;align-items:center;justify-content:center;box-shadow:0 6px 20px #0008;touch-action:none;user-select:none}
 </style>
 <div class="head"><div class="title">紹介貼付 v${VERSION}｜長押し移動</div><button data-ui="collapse">－</button><button data-ui="tiny">×</button></div>
 <div class="body">
  <label>① 記事URL / #タグ（複数行・上から優先）</label>
  <textarea data-likes-sources placeholder="https://note.com/.../n/...&#10;#タグ&#10;https://note.com/.../n/...">${escAttr(g.likesSources||g.likesUrl||'')}</textarea>
  <div class="amount"><select data-likes-mode><option value="number">件数指定</option><option value="all">全数</option></select><input data-likes-count type="number" min="1" max="5000" value="${Number(g.likesCount??10)}"></div>
  <label>スキした人の使用記事</label>
  <div class="choices"><button data-choice="oldest">最初</button><button data-choice="fixed">固定→最新</button><button data-choice="latest">最新</button></div>
  <div class="hint">#タグは検索結果の記事をそのまま採用。URL＋#は上から合算。</div>
  <label>② マガジンURL（複数行・上から優先）</label>
  <textarea data-mag-sources placeholder="https://note.com/.../m/...&#10;https://note.com/.../m/...">${escAttr(g.magSources||g.magazineUrl||'')}</textarea>
  <div class="amount"><select data-mag-mode><option value="number">件数指定</option><option value="all">全数</option></select><input data-mag-count type="number" min="1" max="5000" value="${Number(g.magCount??g.magazineCount??10)}"></div>
  <div class="hint">数字＝合計件数。全数＝並べた全ソースを最後まで。最後は実績の算数。</div>
  <div class="runrow"><button data-a="run">▶ 読み込み→全自動貼付</button><button data-a="stop">停止</button></div>
  <div id="${STATUS}">＋操作不要。1回押すと、読込→画像生成→アップロード→記事URL設定→保存まで全自動。</div>
 </div>`;
 const mini=document.createElement('button');mini.id=PANEL+'-mini';mini.type='button';mini.textContent='紹介';
 document.body.append(p,mini);
 const choice=['oldest','fixed','latest'].includes(g.choice)?g.choice:'latest';
 p.querySelector('[data-choice="'+choice+'"]').classList.add('on');
 p.querySelector('[data-likes-mode]').value=g.likesMode==='all'?'all':'number';
 p.querySelector('[data-mag-mode]').value=g.magMode==='all'?'all':'number';
 applyAmountMode('likes');applyAmountMode('mag');
 p.querySelectorAll('button[data-choice]').forEach(btn=>btn.addEventListener('click',e=>{
  e.preventDefault();e.stopPropagation();
  p.querySelectorAll('button[data-choice]').forEach(x=>x.classList.remove('on'));btn.classList.add('on');saveUiState({choice:btn.dataset.choice})
 }));
 p.querySelector('[data-likes-mode]').addEventListener('change',()=>{applyAmountMode('likes');saveUiState()});
 p.querySelector('[data-mag-mode]').addEventListener('change',()=>{applyAmountMode('mag');saveUiState()});
 p.querySelectorAll('textarea,input').forEach(x=>x.addEventListener('change',()=>saveUiState()));
 p.querySelector('[data-ui="collapse"]').addEventListener('click',e=>{e.preventDefault();setCollapsed(!p.classList.contains('collapsed'))});
 p.querySelector('[data-ui="tiny"]').addEventListener('click',e=>{e.preventDefault();setTiny(true)});
 p.querySelector('[data-a="run"]').addEventListener('click',e=>{e.preventDefault();void run()});
 p.querySelector('[data-a="stop"]').addEventListener('click',e=>{e.preventDefault();stop()});
 mini.addEventListener('click',e=>{if(dragging)return;e.preventDefault();setTiny(false)});
 bindLongDrag(p.querySelector('.title'),p);bindLongDrag(mini,mini);
 restorePos(p);
 if(g.collapsed)p.classList.add('collapsed');
 if(g.tiny){p.classList.add('tiny');mini.style.display='flex'}
 update()
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();