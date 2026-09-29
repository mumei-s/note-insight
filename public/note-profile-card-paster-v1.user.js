// ==UserScript==
// @name         無名S note アイコン＋キャプション 貼り付け装置
// @namespace    https://github.com/mumei-s/note-insight/profile-card-paster
// @version      1.0.0
// @description  記事URLのスキした人＋マガジン記事を件数指定で取得し、アイコン・キャプション・記事サムネ入り画像を記事リンク付きでnote本文へ貼り付けます。
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

const VERSION='1.0.0';
const PANEL='mumei-profile-card-paster-v1';
const STATUS='mumei-profile-card-paster-status-v1';
const PREF='mumei_profile_card_paster_v1';
const W=860,H=140;
const FINAL_URL='https://note.com/fuku444/n/nb4f6934381e9';
const FINAL_KEY='nb4f6934381e9';
let busy=false,stopRequested=false,viewCache=null,imageCommandCache=null;

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
function relinkCaption(view,hit,row){
 const node=view.state.doc.nodeAt(hit.pos)||hit.node;
 if(node?.type?.name!=='image')throw new Error('画像ノードを確認できません');
 const replacement=node.type.create({...node.attrs,link:row.url},view.state.schema.text(row.creator+'さん'),node.marks);
 view.dispatch(view.state.tr.replaceWith(hit.pos,hit.pos+node.nodeSize,replacement));
 const after=imageNodes(view).find(h=>String(h.node.attrs?.id||'')===String(replacement.attrs?.id||''));
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
async function collectLikers(sourceUrl,count,choice){
 if(!sourceUrl||count<=0)return[];
 const key=noteKey(sourceUrl);if(!key)throw new Error('スキ元の記事URLが正しくありません');
 const creators=[],seen=new Set();
 for(let pageNo=1;creators.length<count&&pageNo<=100;pageNo++){
  if(stopRequested)throw new Error('停止しました');
  setStatus('スキした人 '+creators.length+'/'+count+' 取得中…');
  const p=await xhrJSON('https://note.com/api/v3/notes/'+encodeURIComponent(key)+'/likes?page='+pageNo+'&per=50'),list=Array.isArray(p?.data?.likes)?p.data.likes:[];
  for(const item of list){const c=parseLiker(item);if(!c||seen.has(c.likerKey))continue;seen.add(c.likerKey);creators.push(c);if(creators.length>=count)break}
  if(list.length<50)break
 }
 const rows=[];
 for(let i=0;i<creators.length;i+=5){
  if(stopRequested)throw new Error('停止しました');
  setStatus('スキ側の記事選択 '+rows.length+'/'+creators.length+'…');
  const chosen=await Promise.all(creators.slice(i,i+5).map(c=>chooseCreatorArticle(c,choice)));
  rows.push(...chosen.filter(Boolean));
 }
 return rows.slice(0,count)
}
async function collectMagazine(sourceUrl,count){
 if(!sourceUrl||count<=0)return[];
 const key=magazineKey(sourceUrl);if(!key)throw new Error('マガジンURLが正しくありません');
 const rows=[];let start=0;
 while(rows.length<count&&start<5000){
  if(stopRequested)throw new Error('停止しました');
  setStatus('マガジン記事 '+rows.length+'/'+count+' 取得中…');
  const p=await xhrJSON('https://note.com/api/v1/magazines/'+encodeURIComponent(key)+'/notes?start='+start+'&limit=100'),d=p?.data&&typeof p.data==='object'?p.data:{},list=Array.isArray(d.notes)?d.notes:[];
  for(const raw of list){const row=articleFromRaw(raw,{});if(row)rows.push(row);if(rows.length>=count)break}
  start+=list.length;if(!list.length||list.length<100)break
 }
 return rows.slice(0,count)
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
 const [likeRows,magRows]=await Promise.all([collectLikers(input.likesUrl,input.likesCount,input.choice),collectMagazine(input.magazineUrl,input.magazineCount)]);
 const seen=new Set(),raw=[];
 for(const row of [...likeRows,...magRows]){
  const u=norm(row?.url);
  if(!u||u===norm(FINAL_URL)||seen.has(u))continue;
  seen.add(u);raw.push({...row,url:u});
 }
 // 「実績の算数」は件数指定とは別枠。途中に含まれていても除外し、
 // 必ず最後の1件として固定する。
 raw.push({
  likerKey:'final-performance-math',
  urlname:'fuku444',
  creator:'実績の算数',
  actorUrl:'https://note.com/fuku444',
  actorImageUrl:'',
  url:FINAL_URL,
  title:'実績の算数│3日半で0→1達成',
  key:FINAL_KEY,
  publishAt:null,
  thumbUrl:'',
  finalMarker:true
 });
 const out=[];
 for(let i=0;i<raw.length;i+=5){if(stopRequested)throw new Error('停止しました');setStatus('アイコン・サムネ情報 '+out.length+'/'+raw.length+'…');out.push(...await Promise.all(raw.slice(i,i+5).map(enrich)))}
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
 const before=new Set(imageNodes(view).map(h=>String(h.node.attrs?.id||'')).filter(Boolean));
 const dt=new page.DataTransfer();dt.items.add(file);const pos=view.state.selection.from;
 if(nativeImageCommand()(view,dt.files,Math.max(0,pos-1),'image')!==true)throw new Error(row.index+'番 画像アップロードを開始できません');
 const hit=await waitNewNoteImage(view,before,150000);relinkCaption(view,hit,row)
}
async function saveOnce(){
 setStatus('貼り付け完了｜下書き保存を1回だけ実行中…');await sleep(1500);
 const b=[...document.querySelectorAll('button')].find(x=>/^(一時保存|下書き保存)$/.test(x.textContent?.trim())&&x.getClientRects().length&&!x.disabled);
 if(b){b.click();await sleep(6000)}
}

function inputValues(){
 const p=document.getElementById(PANEL),g=getPrefs();
 const likesUrl=String(p.querySelector('[data-likes-url]').value||'').trim(),magazineUrl=String(p.querySelector('[data-mag-url]').value||'').trim();
 const likesCount=Math.max(0,Math.min(500,Number(p.querySelector('[data-likes-count]').value||0))),magazineCount=Math.max(0,Math.min(500,Number(p.querySelector('[data-mag-count]').value||0)));
 const choice=p.querySelector('button[data-choice].on')?.dataset.choice||'latest';
 const v={likesUrl,magazineUrl,likesCount,magazineCount,choice};setPrefs(v);return v
}
function choiceLabel(c){return c==='oldest'?'最初の記事':c==='fixed'?'固定（なければ最新）':'最新記事'}
async function run(){
 if(busy)return;busy=true;stopRequested=false;update();
 try{
  const input=inputValues();if((!input.likesUrl||input.likesCount<=0)&&(!input.magazineUrl||input.magazineCount<=0))throw new Error('記事URLかマガジンURLを1つ以上指定してください');
  const view=findView();if(!view)throw new Error('note本文編集欄を取得できません');
  nativeImageCommand();
  setStatus('取得開始｜スキ '+input.likesCount+'件＋マガジン '+input.magazineCount+'件｜'+choiceLabel(input.choice)+'｜最後は実績の算数');
  const rows=await buildRows(input);if(!rows.length)throw new Error('貼り付け対象が0件です');
  if(!page.confirm('取得 '+rows.length+'件\n\nこのまま現在のカーソル位置から画像を貼り付けますか？')){setStatus('取得 '+rows.length+'件まで完了｜貼り付けはキャンセル');return}
  for(let i=0;i<rows.length;i++){
   if(stopRequested)throw new Error('手動停止');
   const row=rows[i];setStatus('画像生成 '+(i+1)+'/'+rows.length+'｜'+row.creator);
   const file=await makeFile(row);setStatus('貼り付け '+(i+1)+'/'+rows.length+'｜'+row.creator);
   await uploadOne(view,row,file);
   await sleep(1200);
   if((i+1)%10===0&&i+1<rows.length){setStatus('貼り付け '+(i+1)+'/'+rows.length+'｜10件区切り10秒休止');await sleep(10000)}
  }
  await saveOnce();setStatus('完了 ✅ '+rows.length+'件｜最後：実績の算数｜アイコン＋キャプション＋記事サムネ＋URLリンク');
 }catch(e){setStatus('停止：'+(e?.message||String(e))+'｜完成分は本文に保持',true)}
 finally{busy=false;update()}
}
function stop(){stopRequested=true;setStatus('停止要求済み｜現在処理中の1件が終わったら停止')}
function update(){const p=document.getElementById(PANEL);if(!p)return;p.querySelectorAll('input,button').forEach(x=>{if(x.dataset.a==='stop')return;x.disabled=busy})}
function mount(){
 if(!document.body||document.getElementById(PANEL))return;
 const g=getPrefs(),p=document.createElement('div');p.id=PANEL;
 p.innerHTML=`
 <style>
 #${PANEL}{position:fixed;right:7px;top:76px;z-index:2147483647;width:min(340px,calc(100vw - 14px));padding:10px;border:1px solid #3d6178;border-radius:13px;background:#07131d;color:#edf8ff;box-shadow:0 10px 32px #0008;font:12px/1.4 system-ui}
 #${PANEL} .title{font-weight:950;font-size:14px;margin-bottom:7px}#${PANEL} label{display:block;margin-top:7px;font-size:10px;color:#b9d8e8}
 #${PANEL} input{width:100%;margin-top:3px;padding:8px;border:1px solid #395970;border-radius:8px;background:#0b1d28;color:#fff;font-size:11px}
 #${PANEL} .row{display:grid;grid-template-columns:1fr 78px;gap:5px}.choices{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin-top:5px}
 #${PANEL} button{min-height:34px;border:1px solid #416a82;border-radius:8px;background:#102b3b;color:#eaf9ff;font-weight:850;font-size:10px}.choices button.on{background:#145c73;border-color:#63d7f1}
 #${STATUS}{margin-top:8px;padding-top:7px;border-top:1px solid #284555;font-size:10px;color:#bfe8ff}#${STATUS}[data-bad="1"]{color:#ffb8b8}
 </style>
 <div class="title">アイコン＋キャプション 貼り付け装置 v${VERSION}</div>
 <label>① 記事URL → スキした人</label><div class="row"><input data-likes-url placeholder="https://note.com/.../n/..." value="${String(g.likesUrl||'').replace(/"/g,'&quot;')}"><input data-likes-count type="number" min="0" max="500" value="${Number(g.likesCount??10)}"></div>
 <label>スキした人のどの記事を使う？</label><div class="choices"><button data-choice="oldest">最初の記事</button><button data-choice="fixed">固定→最新</button><button data-choice="latest">最新記事</button></div>
 <label>② マガジンURL → 掲載記事</label><div class="row"><input data-mag-url placeholder="https://note.com/.../m/..." value="${String(g.magazineUrl||'').replace(/"/g,'&quot;')}"><input data-mag-count type="number" min="0" max="500" value="${Number(g.magazineCount??10)}"></div>
 <div style="display:grid;grid-template-columns:1fr 78px;gap:5px;margin-top:9px"><button data-a="run">取得 → ここに貼り付け</button><button data-a="stop">停止</button></div>
 <div id="${STATUS}">カーソルを貼りたい位置へ置いてから実行｜アイコン＋「さん」キャプション＋記事サムネ＋URLリンク</div>`;
 p.addEventListener('click',e=>{const c=e.target.closest('button[data-choice]');if(c){p.querySelectorAll('button[data-choice]').forEach(x=>x.classList.toggle('on',x===c));setPrefs({...inputValues(),choice:c.dataset.choice});return}const a=e.target.closest('button[data-a]')?.dataset.a;if(a==='run')void run();if(a==='stop')stop()});
 document.body.appendChild(p);const choice=['oldest','fixed','latest'].includes(g.choice)?g.choice:'latest';p.querySelector('[data-choice="'+choice+'"]').classList.add('on');update()
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();