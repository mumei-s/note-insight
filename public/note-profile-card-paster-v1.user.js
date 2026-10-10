// ==UserScript==
// @name         無名S note アイコン＋キャプション 貼り付け装置
// @namespace    https://github.com/mumei-s/note-insight/profile-card-paster
// @version      1.8.0
// @description  初投稿第二弾200件＋実績の算数1件。#はじめてのnote/#始めてのnoteは公開1記事のみ、#自己紹介は複数記事可。10人ごと見出しで目次対応、ランダム極薄20柄、健全な副業・在宅ワーク可、さらに高速化。
// @match        https://editor.note.com/*
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @connect      note.com
// @connect      assets.st-note.com
// @connect      *
// @updateURL    https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-profile-card-paster-v1.user.js
// @downloadURL  https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-profile-card-paster-v1.user.js
// ==/UserScript==

(function(){
'use strict';
const page=typeof unsafeWindow!=='undefined'?unsafeWindow:window;
if(page.__MUMEI_PROFILE_CARD_PASTER_V1__)return;
page.__MUMEI_PROFILE_CARD_PASTER_V1__=true;

const VERSION='1.8.0';
const PANEL='mumei-profile-card-paster-v1';
const STATUS='mumei-profile-card-paster-status-v1';
const PREF='mumei_profile_card_paster_v1';
const POS='mumei_profile_card_paster_pos_v1';
const RUN_PREFIX='mumei_profile_card_paster_run_v15:';
const SPECIAL_LAST='mumei_profile_card_paster_special_last_v15';
const SPECIAL_EXCLUDED='mumei_profile_card_paster_special_excluded_v15';
const SPECIAL_RECOVERY_IMPORTED='mumei_profile_card_paster_special_recovery_v171';
const SPECIAL_RECOVERY_URLS=['https://note.com/ss_yr/n/n1b6e30eb9e41'];
const FIRST_TAGS=['はじめてのnote','始めてのnote','自己紹介'];
const STRICT_FIRST_TAGS=new Set(['はじめてのnote','始めてのnote']);
const SELF_INTRO_TAG='自己紹介';
const WORKMOM_TAG='ワーママ';
const PARENTING_TAG='育児日記';
const WORKMOM_CONTEXT={
 explicit:/(?:ワーママ|働くママ|働くお母さん|働く母|仕事と育児|育児と仕事|仕事と子育て|子育てと仕事)/i,
 parent:/(?:ママ|お母さん|母親|母として|育児|子育て|子ども|子供|保育園|保育所|学童|育休|産休|授乳|出産|妊娠)/i,
 work:/(?:仕事|働|勤務|職場|会社|復職|時短|フルタイム|パート|正社員|キャリア|在宅ワーク|テレワーク|共働き|残業|転職|副業|フリーランス)/i
};
const PARENTING_CONTEXT={
 explicit:/(?:育児日記|育児記録|子育て日記|子育て記録|育児|子育て)/i,
 family:/(?:子ども|子供|赤ちゃん|乳児|幼児|園児|息子|娘|きょうだい|兄弟|姉妹|保育園|幼稚園|学童|小学生|離乳食|夜泣き|おむつ|寝かしつけ|育休|産休|出産)/i
};
const SPECIAL_NG=[
  {label:'ポルノ',re:/(?:ポルノ|アダルト|18禁|R-?18|エロ|性的|セックス|風俗|AV女優|ヌード|自慰|性行為|援助交際)/i},
  {label:'ギャンブル',re:/(?:ギャンブル|パチンコ|パチスロ|競馬|競艇|競輪|カジノ|賭け|ブックメーカー)/i},
  {label:'暴力',re:/(?:暴力|殺害|殺人|殴る|刺す|虐待|リンチ|銃撃|テロ|自傷|自殺)/i},
  {label:'投資',re:/(?:投資|株式|株価|FX|仮想通貨|暗号資産|NISA|iDeCo|資産運用|デイトレ|トレード|配当|証券)/i},
  {label:'その他NG',re:/(?:違法|詐欺|闇バイト|覚醒剤|大麻|薬物|ドラッグ|マルチ商法|ネットワークビジネス|宗教勧誘|ヘイト|差別煽動)/i}
];
const W=860,H=140;
const FINAL_URL='https://note.com/fuku444/n/nb4f6934381e9';
const FINAL_KEY='nb4f6934381e9';
const SPEED_FACTOR=1.65;
const IMAGE_PASTE_GAP=Math.round(1200/SPEED_FACTOR);
const CARD_GAP_FAST=Math.round(5000/SPEED_FACTOR);
const CARD_GAP_SLOW=Math.round(10000/SPEED_FACTOR);
const CARD_BLOCK_PAUSE=Math.round(30000/SPEED_FACTOR);
let busy=false,stopRequested=false,viewCache=null,imageCommandCache=null,noteUrlCommandCache=null,selectionCache=null,dragging=false,longTimer=0,suppressClickUntil=0;

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const norm=v=>{try{const u=new URL(String(v||''),location.href);u.search='';u.hash='';return u.href}catch{return String(v||'').trim()}};
const noteKey=url=>String(url||'').match(/\/n\/(n[a-f0-9]{12})(?:[/?#]|$)/i)?.[1]||'';
const magazineKey=url=>String(url||'').match(/\/(?:m|magazines)\/(m[a-z0-9]+)(?:[/?#]|$)/i)?.[1]||'';
const editorArticleKey=()=>location.pathname.match(/^\/notes\/(n[a-z0-9]{8,})\/edit\/?$/i)?.[1]||'';
const runKey=()=>RUN_PREFIX+(editorArticleKey()||'unknown');
function readRun(){try{return JSON.parse(localStorage.getItem(runKey())||'null')}catch{return null}}
function writeRun(v){try{if(v==null)localStorage.removeItem(runKey());else localStorage.setItem(runKey(),JSON.stringify(v))}catch{}}
function mediaUrl(v){
 let raw='';
 if(typeof v==='string')raw=v;
 else if(v&&typeof v==='object')raw=v.url||v.src||v.path||v.image_url||v.imageUrl||'';
 raw=String(raw||'').trim();if(!raw)return'';
 if(raw.startsWith('//'))return'https:'+raw;
 if(/^https?:\/\//i.test(raw))return raw;
 if(raw.startsWith('/'))return'https://assets.st-note.com'+raw;
 if(/^production\//i.test(raw))return'https://assets.st-note.com/'+raw;
 return raw
}
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
function relinkCaption(view,hit,row){
 const node=view.state.doc.nodeAt(hit.pos)||hit.node;
 if(node?.type?.name!=='image')throw new Error('画像ノードを確認できません');
 const caption=row.creator+'さん';
 const replacement=node.type.create({...node.attrs,link:row.url},view.state.schema.text(caption),node.marks);
 view.dispatch(view.state.tr.replaceWith(hit.pos,hit.pos+node.nodeSize,replacement));
 const id=String(replacement.attrs?.id||'');
 const after=imageNodes(view).find(h=>id&&String(h.node.attrs?.id||'')===id)||imageNodes(view).find(h=>h.pos===hit.pos);
 if(!after||norm(after.node.attrs?.link)!==norm(row.url)||String(after.node.textContent||'').trim()!==caption)throw new Error('画像リンク・名前キャプション設定に失敗しました');
 return after
}
function noteUrlCommandFactory(){
 if(noteUrlCommandCache)return noteUrlCommandCache;
 const req=webpackRequire();if(!req)throw new Error('note内部URL処理を取得できません');
 let candidate=null;try{candidate=req?.(94928)?.fjT}catch{}
 const right=v=>{
  if(typeof v!=='function')return false;
  let src='';try{src=Function.prototype.toString.call(v)}catch{}
  return src.includes('state.selection')&&src.includes('nodeBefore')&&src.includes('replaceRangeWith')&&src.includes('.then')
 };
 if(!right(candidate)){
  const loaded=Object.values(req.c||{}).flatMap(e=>{
   const x=e?.exports;
   if(typeof x==='function')return[x];
   return x&&typeof x==='object'?Object.values(x):[]
  });
  candidate=loaded.find(right)||null
 }
 if(!right(candidate))throw new Error('note正規URLカード処理が見つかりません');
 return noteUrlCommandCache=candidate
}
function embedNodes(view){const out=[];view.state.doc.descendants((node,pos)=>{if(node.type?.name==='embed')out.push({node,pos})});return out}
function cardKey(hit){return String(hit?.node?.attrs?.embeddedContentKey||'')}
function cardUrl(hit){return norm(hit?.node?.attrs?.src)}
function genuineCard(hit,url){
 const key=cardKey(hit),html=String(hit?.node?.attrs?.htmlForEmbed||'');
 if(!/^emb[a-z0-9]+$/i.test(key)||!html.includes('note-embed'))return false;
 if(cardUrl(hit)===norm(url))return true;
 try{
  const src=new URL(cardUrl(hit)),wanted=noteKey(url),embedded=src.pathname.match(/^\/embed\/notes\/(n[a-f0-9]{12})\/?$/i)?.[1];
  return src.origin==='https://note.com'&&Boolean(embedded)&&embedded===wanted
 }catch{return false}
}
function exactUrlParagraphs(view,url){
 const wanted=norm(url),out=[];
 view.state.doc.forEach((node,pos)=>{
  if(node.type===view.state.schema.nodes.paragraph&&norm((node.textContent||'').trim())===wanted)out.push({node,pos})
 });
 return out
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
function insertWorkUrlAt(view,url,pos){
 const p=view.state.schema.nodes.paragraph;
 const at=Math.max(0,Math.min(view.state.doc.content.size,Number(pos)));
 view.dispatch(view.state.tr.insert(at,p.create(null,view.state.schema.text(url))));
 const node=view.state.doc.nodeAt(at);
 if(node?.type!==p||node.textContent!==url)throw new Error('通知カード用URLを指定位置へ配置できません');
 const Selection=selectionApi(),near=typeof Selection.near==='function'?Selection.near(view.state.doc.resolve(Math.max(0,Math.min(view.state.doc.content.size,at+node.nodeSize-1)))):Selection.atEnd(view.state.doc);
 view.dispatch(view.state.tr.setSelection(near).scrollIntoView());view.focus();
 return{node,pos:at}
}
async function waitNewCard(view,url,beforeKeys,attempt,timeout=45000){
 const end=Date.now()+timeout,errorGrace=2500;let errorAt=0;
 while(Date.now()<end){
  const hit=embedNodes(view).find(h=>{const k=cardKey(h);return k&&!beforeKeys.has(k)&&genuineCard(h,url)});
  if(hit)return hit;
  if(attempt.error){if(!errorAt)errorAt=Date.now();if(Date.now()-errorAt>=errorGrace)throw attempt.error}
  if(stopRequested)throw new Error('停止しました');
  await sleep(140)
 }
 throw attempt.error||new Error('正規通知カード生成タイムアウト')
}
function deleteExtraWorkUrl(view,url,beforeCount){
 const list=exactUrlParagraphs(view,url);
 if(list.length<=beforeCount)return 0;
 const extra=list.slice(beforeCount).sort((a,b)=>b.pos-a.pos);
 return deleteHits(view,extra)
}
async function createNativeCard(view,row,insertPos){
 let run=readRun()||{},cards=Array.isArray(run.cardKeys)?run.cardKeys:[],baseline=new Set(run.cardBaselineKeys||[]);
 const beforeKeys=new Set(embedNodes(view).map(cardKey).filter(Boolean)),rawBefore=exactUrlParagraphs(view,row.url).length;
 const work=insertWorkUrlAt(view,row.url,insertPos),workNode=work.node,attempt={error:null};
 const command=noteUrlCommandFactory()(row.url,e=>{attempt.error=e});
 const handled=command(view.state,(tr,consumedNode=workNode)=>{
  try{
   if(consumedNode!==workNode&&!consumedNode?.eq?.(workNode))throw new Error('通知カード用URLが変更されました');
   view.dispatch(tr)
  }catch(e){attempt.error=e}
 },view);
 if(!handled)throw new Error('note正規URLカード処理が未処理です');
 let hit;
 try{hit=await waitNewCard(view,row.url,beforeKeys,attempt,45000)}
 catch(e){
  const recovered=embedNodes(view).find(h=>{const k=cardKey(h);return k&&!beforeKeys.has(k)&&genuineCard(h,row.url)});
  if(recovered)hit=recovered;else{deleteExtraWorkUrl(view,row.url,rawBefore);throw e}
 }
 deleteExtraWorkUrl(view,row.url,rawBefore);
 hit=embedNodes(view).find(h=>cardKey(h)===cardKey(hit))||hit;
 if(!genuineCard(hit,row.url))throw new Error('正規通知カードの照合に失敗しました');
 run=readRun()||run;cards=Array.isArray(run.cardKeys)?run.cardKeys:[];
 const rec={url:row.url,key:cardKey(hit),creator:row.creator};
 cards.push(rec);
 writeRun({...run,cardKeys:cards,updatedAt:Date.now()});
 return{rec,nextPos:hit.pos+hit.node.nodeSize}
}

function parseLiker(item){
 const u=item?.user||{},urlname=String(u.urlname||'').trim(),id=String(u.key??u.id??urlname).trim();
 if(!id||!urlname)return null;
 return{likerKey:id,urlname,creator:String(u.nickname||u.name||urlname).trim(),actorUrl:'https://note.com/'+urlname,actorImageUrl:mediaUrl(u.user_profile_image_url||u.profileImageUrl||u.profile_image_url||u.user_profile_image_path||u.profile_image_path||u.profileImagePath||u.icon_url||u.image_url||'')}
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
  actorImageUrl:mediaUrl(creator.actorImageUrl||user.user_profile_image_url||user.profileImageUrl||user.profile_image_url||user.user_profile_image_path||user.profile_image_path||user.profileImagePath||user.icon_url||user.image_url||''),
  url,title:String(note.name||note.title||'無題の記事').trim(),key,
  publishAt:String(note.publishAt||note.publish_at||note.published_at||note.created_at||'').trim()||null,
  thumbUrl:mediaUrl(note.eyecatch_url||note.image_url||note.imageUrl||note.thumbnail_url||note.thumbnailUrl||note.eyecatch?.url||note.eyecatch_image?.url||note.eyecatchImage?.url||note.image?.url||note.thumbnail?.url||'')
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
function parseUnifiedSources(raw){
 const out=[];
 for(const line0 of String(raw||'').split(/\r?\n/)){
  const line=line0.trim();if(!line)continue;
  const urls=line.match(/https?:\/\/[^\s,、]+/g)||[];
  for(const url of urls){
   if(noteKey(url))out.push({type:'note',value:norm(url),label:norm(url)});
   else if(magazineKey(url))out.push({type:'mag',value:norm(url),label:norm(url)})
  }
  const tags=[...line.matchAll(/#([^#\s,、]+)/g)].map(m=>m[1].trim()).filter(Boolean);
  for(const tag of tags)out.push({type:'tag',value:tag,label:'#'+tag});
  if(!urls.length&&!tags.length){
   const tag=line.replace(/^#+/,'').trim();
   if(tag)out.push({type:'tag',value:tag,label:'#'+tag})
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
async function collectUnified(raw,mode,count,choice){
 const sources=parseUnifiedSources(raw),limit=targetLimit(mode,count);
 if(!sources.length||limit===0)return[];
 const out=[],seenUrls=new Set(),seenCreators=new Set();
 const add=row=>{
  if(!row)return false;
  const u=norm(row.url);
  if(!u||u===norm(FINAL_URL)||seenUrls.has(u))return false;
  seenUrls.add(u);out.push({...row,url:u});return true
 };
 for(let si=0;si<sources.length&&out.length<limit;si++){
  const src=sources[si];
  if(stopRequested)throw new Error('停止しました');
  if(src.type==='note'){
   const key=noteKey(src.value);if(!key)continue;
   for(let pageNo=1;pageNo<=200&&out.length<limit;pageNo++){
    setStatus('入力 '+(si+1)+'/'+sources.length+'｜記事URLのスキ '+out.length+(mode==='all'?' / 全数':' / '+limit));
    const p=await xhrJSON('https://note.com/api/v3/notes/'+encodeURIComponent(key)+'/likes?page='+pageNo+'&per=50');
    const list=Array.isArray(p?.data?.likes)?p.data.likes:[],creators=[];
    for(const item of list){
     const c=parseLiker(item);if(!c||seenCreators.has(c.likerKey))continue;
     seenCreators.add(c.likerKey);creators.push(c)
    }
    for(let i=0;i<creators.length&&out.length<limit;i+=5){
     const chosen=await Promise.all(creators.slice(i,i+5).map(c=>chooseCreatorArticle(c,choice)));
     for(const row of chosen){add(row);if(out.length>=limit)break}
    }
    if(list.length<50)break
   }
  }else if(src.type==='mag'){
   const key=magazineKey(src.value);if(!key)continue;
   let start=0;
   while(out.length<limit&&start<10000){
    setStatus('入力 '+(si+1)+'/'+sources.length+'｜マガジン '+out.length+(mode==='all'?' / 全数':' / '+limit));
    const p=await xhrJSON('https://note.com/api/v1/magazines/'+encodeURIComponent(key)+'/notes?start='+start+'&limit=100');
    const d=p?.data&&typeof p.data==='object'?p.data:{},list=Array.isArray(d.notes)?d.notes:[];
    for(const rawNote of list){add(articleFromRaw(rawNote,{}));if(out.length>=limit)break}
    start+=list.length;if(!list.length||list.length<100)break
   }
  }else if(src.type==='tag'){
   let cursor='0';
   for(let pageNo=1;pageNo<=250&&out.length<limit;pageNo++){
    setStatus('入力 '+(si+1)+'/'+sources.length+'｜#'+src.value+' '+out.length+(mode==='all'?' / 全数':' / '+limit));
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
function readJSONKey(key,fallback){try{return JSON.parse(localStorage.getItem(key)||'null')??fallback}catch{return fallback}}
function writeJSONKey(key,value){try{if(value==null)localStorage.removeItem(key);else localStorage.setItem(key,JSON.stringify(value))}catch{}}
function specialExcluded(){
 const raw=readJSONKey(SPECIAL_EXCLUDED,[]);
 return Array.isArray(raw)?raw:[]
}
function specialExcludedSets(){
 const arr=specialExcluded();
 return{
  urls:new Set(arr.map(x=>norm(x?.url)).filter(Boolean)),
  creators:new Set(arr.map(x=>String(x?.urlname||'').toLowerCase()).filter(Boolean)),
  keys:new Set(arr.map(x=>String(x?.key||noteKey(x?.url)||'')).filter(Boolean))
 }
}
function extractNoteKeysFromRecovery(raw,sourceKey=''){
 const text=String(raw||'');
 const out=new Set();
 const patterns=[
  /https?:\/\/note\.com\/[A-Za-z0-9_.-]+\/n\/(n[a-f0-9]{12})/ig,
  /https?:\/\/note\.com\/embed\/notes\/(n[a-f0-9]{12})/ig,
  /\/n\/(n[a-f0-9]{12})/ig,
  /\/embed\/notes\/(n[a-f0-9]{12})/ig
 ];
 for(const re of patterns){
  let m;while((m=re.exec(text)))out.add(String(m[1]||''))
 }
 out.delete(String(sourceKey||''));out.delete(FINAL_KEY);
 return out
}
async function recoverSpecialExclusionsFromPublishedArticles(){
 const imported=readJSONKey(SPECIAL_RECOVERY_IMPORTED,{});
 const current=specialExcluded(),seenKeys=new Set(current.map(x=>String(x?.key||noteKey(x?.url)||'')).filter(Boolean));
 let added=0;
 for(const url of SPECIAL_RECOVERY_URLS){
  const sourceKey=noteKey(url);if(!sourceKey||imported?.[url])continue;
  setStatus('初投稿者｜前回公開記事から重複除外を復元中…');
  let combined='';
  try{
   const api=await xhrJSON('https://note.com/api/v3/notes/'+encodeURIComponent(sourceKey));
   combined+=JSON.stringify(api||{})
  }catch{}
  try{combined+=' '+String(await xhr(url,'text',60000)||'')}catch{}
  const keys=extractNoteKeysFromRecovery(combined,sourceKey);
  if(!keys.size)throw new Error('前回公開記事から掲載済み記事を確認できませんでした。重複防止のため初投稿案件を開始しません');
  for(const key of keys){
   if(seenKeys.has(key))continue;
   seenKeys.add(key);current.push({url:'',urlname:'',creator:'',key,confirmedAt:Date.now(),recoveredFrom:url});added++
  }
  writeJSONKey(SPECIAL_EXCLUDED,current);
  writeJSONKey(SPECIAL_RECOVERY_IMPORTED,{...(imported||{}),[url]:{at:Date.now(),count:keys.size}})
 }
 updateExcludedCount();
 if(added)setStatus('前回公開記事から '+added+'件を重複除外へ復元しました ✅');
 return added
}
function specialBlockedReason(text){
 const t=String(text||'');
 for(const rule of SPECIAL_NG)if(rule.re.test(t))return rule.label;
 return''
}
async function creatorSinglePublicArticle(row){
 if(!row?.urlname)return false;
 try{
  // 「1記事だけ」は公開note記事で厳密確認する。
  // 固定表示の有無で同一記事が重複して見えるケースもあるため、両方の一覧を照合する。
  const [plain,pinned,page2]=await Promise.all([
   creatorContents(row.urlname,1,true),
   creatorContents(row.urlname,1,false),
   creatorContents(row.urlname,2,true)
  ]);
  const d=plain?.data&&typeof plain.data==='object'?plain.data:{};
  const plainList=contentList(plain),pinnedList=contentList(pinned),secondList=contentList(page2);
  const totalRaw=d.totalCount??d.total_count??d.count??d.noteCount??d.note_count;
  if(totalRaw!==undefined&&totalRaw!==null&&String(totalRaw)!==''){
   const total=Number(totalRaw);
   if(!Number.isFinite(total)||total!==1)return false
  }
  if(plainList.length!==1||secondList.length!==0)return false;
  const keys=new Set(
   [...plainList,...pinnedList]
    .map(x=>articleFromRaw(x,{}))
    .filter(Boolean)
    .map(x=>noteKey(x.url))
    .filter(Boolean)
  );
  const wanted=noteKey(row.url);
  return Boolean(wanted&&keys.size===1&&keys.has(wanted))
 }catch{return false}
}
async function specialArticleText(row){
 let note={};
 try{const p=await xhrJSON('https://note.com/api/v3/notes/'+encodeURIComponent(row.key));note=p?.data||p||{}}catch{}
 const parts=[
  row.title,note.name,note.title,note.description,note.body,note.body_html,note.bodyText,note.body_text,
  JSON.stringify(note.hashtags||note.tags||note.hashtag_names||[])
 ];
 try{
  const html=await xhr(row.url,'text',45000),doc=new DOMParser().parseFromString(String(html||''),'text/html');
  parts.push(doc.querySelector('article')?.textContent||doc.querySelector('main')?.textContent||'')
 }catch{}
 return parts.map(v=>String(v||'')).join(' ').replace(/\s+/g,' ').trim()
}
function exactWorkmomTag(value){
 return /(?:^|[^一-龯ぁ-んァ-ヶ々ーA-Za-z0-9_])#?ワーママ(?:$|[^一-龯ぁ-んァ-ヶ々ーA-Za-z0-9_])/i.test(String(value||''))
}
async function workmomArticleAudit(row){
 let note={},doc=null;
 try{const p=await xhrJSON('https://note.com/api/v3/notes/'+encodeURIComponent(row.key));note=p?.data||p||{}}catch{}
 try{
  const html=String(await xhr(row.url,'text',45000)||'');
  doc=new DOMParser().parseFromString(html,'text/html')
 }catch{}
 const tagDump=JSON.stringify(note.hashtags||note.tags||note.hashtag_names||note.tag_names||note.note_hashtags||[]);
 let exactTag=exactWorkmomTag(tagDump);
 if(!exactTag&&doc){
  exactTag=[...doc.querySelectorAll('a')].some(a=>{
   const label=String(a.textContent||'').trim().replace(/^#/,'');
   let href=String(a.getAttribute('href')||'');try{href=decodeURIComponent(href)}catch{}
   return label===WORKMOM_TAG||href.includes('/hashtag/'+WORKMOM_TAG)
  })
 }
 if(!exactTag)return{ok:false,reason:'#ワーママタグ確認不可'};
 const parts=[
  row.title,note.name,note.title,note.description,note.body,note.body_html,note.bodyText,note.body_text,
  doc?.querySelector('article')?.textContent||doc?.querySelector('main')?.textContent||''
 ];
 const text=parts.map(v=>String(v||'')).join(' ').replace(/\s+/g,' ').trim();
 const blocked=specialBlockedReason(text);if(blocked)return{ok:false,reason:blocked};
 const relevant=WORKMOM_CONTEXT.explicit.test(text)||(WORKMOM_CONTEXT.parent.test(text)&&WORKMOM_CONTEXT.work.test(text));
 if(!relevant)return{ok:false,reason:'ワーママ文脈不足'};
 return{ok:true,reason:''}
}
async function collectWorkmom(mode,count){
 const limit=targetLimit(mode,count);if(limit===0)return[];
 let cursor='0',pageNo=0,scanned=0;const tested=new Set(),out=[];
 while(out.length<limit&&pageNo<250){
  if(stopRequested)throw new Error('停止しました');
  pageNo++;
  setStatus('#ワーママ案件｜新着 '+pageNo+'ページ｜確認 '+scanned+'｜採用 '+out.length+(mode==='all'?' / 全数':' / '+limit));
  const p=await xhrJSON('https://note.com/api/v3/searches?context=note&q='+encodeURIComponent(WORKMOM_TAG)+'&size=20&start='+encodeURIComponent(cursor)+'&sort=new');
  const q=normalizeSearch(p);if(!q.arr.length)break;
  for(const raw of q.arr){
   if(out.length>=limit)break;
   const row=articleFromRaw(raw,{}),u=norm(row?.url);
   if(!row||!u||u===norm(FINAL_URL)||tested.has(u))continue;
   tested.add(u);scanned++;
   setStatus('#ワーママ案件｜確認 '+scanned+'｜採用 '+out.length+(mode==='all'?' / 全数':' / '+limit)+'｜'+row.creator);
   const audit=await workmomArticleAudit({...row,url:u});
   if(!audit.ok)continue;
   out.push({...row,url:u,workmom:true});
   await sleep(80)
  }
  if(q.last||q.cursor==null||String(q.cursor)===String(cursor))break;
  cursor=String(q.cursor);await sleep(60)
 }
 return out
}

function exactParentingTag(value){
 return /(?:^|[^一-龯ぁ-んァ-ヶ々ーA-Za-z0-9_])#?育児日記(?:$|[^一-龯ぁ-んァ-ヶ々ーA-Za-z0-9_])/i.test(String(value||''))
}
async function parentingArticleAudit(row){
 let note={},doc=null;
 try{const p=await xhrJSON('https://note.com/api/v3/notes/'+encodeURIComponent(row.key));note=p?.data||p||{}}catch{}
 try{
  const html=String(await xhr(row.url,'text',45000)||'');
  doc=new DOMParser().parseFromString(html,'text/html')
 }catch{}
 const tagDump=JSON.stringify(note.hashtags||note.tags||note.hashtag_names||note.tag_names||note.note_hashtags||[]);
 let exactTag=exactParentingTag(tagDump);
 if(!exactTag&&doc){
  exactTag=[...doc.querySelectorAll('a')].some(a=>{
   const label=String(a.textContent||'').trim().replace(/^#/,'');
   let href=String(a.getAttribute('href')||'');try{href=decodeURIComponent(href)}catch{}
   return label===PARENTING_TAG||href.includes('/hashtag/'+PARENTING_TAG)
  })
 }
 if(!exactTag)return{ok:false,reason:'#育児日記タグ確認不可'};
 const parts=[
  row.title,note.name,note.title,note.description,note.body,note.body_html,note.bodyText,note.body_text,
  doc?.querySelector('article')?.textContent||doc?.querySelector('main')?.textContent||''
 ];
 const text=parts.map(v=>String(v||'')).join(' ').replace(/\s+/g,' ').trim();
 // 検閲は既存共通ルールを必ず通す。副業という語そのものはNG条件に含めない。
 const blocked=specialBlockedReason(text);if(blocked)return{ok:false,reason:blocked};
 const relevant=PARENTING_CONTEXT.explicit.test(text)||PARENTING_CONTEXT.family.test(text);
 if(!relevant)return{ok:false,reason:'育児文脈不足'};
 return{ok:true,reason:''}
}
async function collectParenting(mode,count){
 const limit=targetLimit(mode,count);if(limit===0)return[];
 let cursor='0',pageNo=0,scanned=0;const tested=new Set(),out=[];
 while(out.length<limit&&pageNo<250){
  if(stopRequested)throw new Error('停止しました');
  pageNo++;
  setStatus('#育児日記案件｜新着 '+pageNo+'ページ｜確認 '+scanned+'｜採用 '+out.length+(mode==='all'?' / 全数':' / '+limit));
  const p=await xhrJSON('https://note.com/api/v3/searches?context=note&q='+encodeURIComponent(PARENTING_TAG)+'&size=20&start='+encodeURIComponent(cursor)+'&sort=new');
  const q=normalizeSearch(p);if(!q.arr.length)break;
  for(const raw of q.arr){
   if(out.length>=limit)break;
   const row=articleFromRaw(raw,{}),u=norm(row?.url);
   if(!row||!u||u===norm(FINAL_URL)||tested.has(u))continue;
   tested.add(u);scanned++;
   setStatus('#育児日記案件｜確認 '+scanned+'｜採用 '+out.length+(mode==='all'?' / 全数':' / '+limit)+'｜'+row.creator);
   const audit=await parentingArticleAudit({...row,url:u});
   if(!audit.ok)continue;
   out.push({...row,url:u,parenting:true});
   await sleep(80)
  }
  if(q.last||q.cursor==null||String(q.cursor)===String(cursor))break;
  cursor=String(q.cursor);await sleep(60)
 }
 return out
}

async function specialTagAudit(row,tag){
 let note={},doc=null;
 try{const p=await xhrJSON('https://note.com/api/v3/notes/'+encodeURIComponent(row.key));note=p?.data||p||{}}catch{}
 try{const html=String(await xhr(row.url,'text',45000)||'');doc=new DOMParser().parseFromString(html,'text/html')}catch{}
 const tagDump=JSON.stringify(note.hashtags||note.tags||note.hashtag_names||note.tag_names||note.note_hashtags||[]);
 let exactTag=tagDump.includes(tag);
 if(!exactTag&&doc){
  exactTag=[...doc.querySelectorAll('a')].some(a=>{
   const label=String(a.textContent||'').trim().replace(/^#/,'');
   let href=String(a.getAttribute('href')||'');try{href=decodeURIComponent(href)}catch{}
   return label===tag||href.includes('/hashtag/'+tag)
  })
 }
 if(!exactTag)return{ok:false,reason:'#'+tag+'タグ確認不可'};
 const parts=[row.title,note.name,note.title,note.description,note.body,note.body_html,note.bodyText,note.body_text,doc?.querySelector('article')?.textContent||doc?.querySelector('main')?.textContent||''];
 const text=parts.map(v=>String(v||'')).join(' ').replace(/\s+/g,' ').trim();
 const blocked=specialBlockedReason(text);if(blocked)return{ok:false,reason:blocked};
 if(tag===SELF_INTRO_TAG){
  const relevant=/(?:自己紹介|はじめまして|初めまして|プロフィール|私について|わたしについて|noteを始め|noteはじめ|発信内容)/i.test(text);
  if(!relevant)return{ok:false,reason:'自己紹介文脈不足'}
 }
 return{ok:true,reason:''}
}
async function collectFirstNoteSpecial(mode,count,selectedTags){
 const limit=targetLimit(mode,count);
 if(limit===0)return[];
 const tags=(Array.isArray(selectedTags)?selectedTags:[]).filter(x=>FIRST_TAGS.includes(x));
 if(!tags.length)throw new Error('タグを1つ以上選んでください');
 await recoverSpecialExclusionsFromPublishedArticles();
 const excluded=specialExcludedSets();
 const states=tags.map(tag=>({tag,cursor:'0',done:false,page:0,buffer:[]}));
 const tested=new Set(),out=[];
 async function fill(st){
  while(!st.done&&!st.buffer.length&&st.page<250){
   st.page++;
   setStatus('第二弾｜#'+st.tag+' 新着 '+st.page+'ページ｜採用 '+out.length+(mode==='all'?' / 全数':' / '+limit));
   const p=await xhrJSON('https://note.com/api/v3/searches?context=note&q='+encodeURIComponent(st.tag)+'&size=20&start='+encodeURIComponent(st.cursor)+'&sort=new');
   const q=normalizeSearch(p),rows=[];
   for(const raw of q.arr){const row=articleFromRaw(raw,{}),u=norm(row?.url);if(row&&u&&u!==norm(FINAL_URL))rows.push({...row,url:u})}
   rows.sort((a,b)=>new Date(b.publishAt||0).getTime()-new Date(a.publishAt||0).getTime());
   st.buffer=rows;
   if(q.last||!q.arr.length||q.cursor==null||String(q.cursor)===String(st.cursor))st.done=true;else st.cursor=String(q.cursor);
   if(!st.buffer.length&&!st.done)await sleep(45)
  }
 }
 for(const st of states)await fill(st);
 let scanned=0;
 while(out.length<limit&&states.some(st=>st.buffer.length||!st.done)&&scanned<20000){
  for(const st of states)if(!st.buffer.length&&!st.done)await fill(st);
  let chosenState=null,chosenRow=null,chosenTime=-Infinity;
  for(const st of states){const row=st.buffer[0];if(!row)continue;const t=new Date(row.publishAt||0).getTime();if(!chosenRow||t>chosenTime){chosenState=st;chosenRow=row;chosenTime=t}}
  if(!chosenRow)break;
  chosenState.buffer.shift();scanned++;
  const u=norm(chosenRow.url),creator=String(chosenRow.urlname||'').toLowerCase(),key=noteKey(u);
  if(tested.has(u))continue;
  tested.add(u);
  if(excluded.urls.has(u)||excluded.creators.has(creator)||excluded.keys.has(key))continue;
  setStatus('第二弾｜#'+chosenState.tag+'｜確認 '+tested.size+'｜採用 '+out.length+(mode==='all'?' / 全数':' / '+limit));
  const audit=await specialTagAudit(chosenRow,chosenState.tag);
  if(!audit.ok)continue;
  if(STRICT_FIRST_TAGS.has(chosenState.tag)&&!(await creatorSinglePublicArticle(chosenRow)))continue;
  out.push({...chosenRow,specialFirstNote:true,specialSourceTag:chosenState.tag});
  await sleep(55)
 }
 return out
}
function saveSpecialLast(rows){
 const list=(rows||[]).filter(x=>x?.specialFirstNote).map(x=>({url:norm(x.url),urlname:String(x.urlname||''),creator:String(x.creator||''),key:String(x.key||''),at:Date.now()}));
 writeJSONKey(SPECIAL_LAST,{at:Date.now(),count:list.length,items:list,committed:false})
}
function commitSpecialLast({silent=false}={}){
 const last=readJSONKey(SPECIAL_LAST,null);
 const items=Array.isArray(last?.items)?last.items:[];
 if(!items.length){if(!silent)setStatus('前回の特別案件成功候補がありません',true);return 0}
 const current=specialExcluded(),seen=new Set(current.map(x=>String(x.key||noteKey(x.url)||'')+'|'+String(x.urlname||'').toLowerCase()));
 let added=0;
 for(const item of items){
  const k=String(item.key||noteKey(item.url)||'')+'|'+String(item.urlname||'').toLowerCase();
  if(seen.has(k))continue;
  seen.add(k);current.push({...item,confirmedAt:Date.now()});added++
 }
 writeJSONKey(SPECIAL_EXCLUDED,current);
 writeJSONKey(SPECIAL_LAST,{...last,committed:true,committedAt:Date.now()});
 updateExcludedCount();
 if(!silent)setStatus('成功分 '+added+'件を次回以降の除外対象へ登録しました ✅');
 return added
}
function clearSpecialExcluded(){
 const n=specialExcluded().length;
 if(!n){setStatus('除外登録は0件です');return}
 if(!page.confirm('初投稿者の除外登録 '+n+'件をすべて解除しますか？'))return;
 writeJSONKey(SPECIAL_EXCLUDED,[]);updateExcludedCount();setStatus('初投稿者の除外登録をクリアしました')
}
function updateExcludedCount(){
 const e=document.querySelector('[data-excluded-count]');if(e)e.textContent='除外 '+specialExcluded().length+'件'
}

async function articleMetaImage(url){
 try{
  const html=await xhr(url,'text',45000),doc=new DOMParser().parseFromString(String(html||''),'text/html');
  return mediaUrl(doc.querySelector('meta[property="og:image"]')?.content||doc.querySelector('meta[name="twitter:image"]')?.content||'')
 }catch{return''}
}
async function creatorProfile(id){
 if(!id)return null;
 try{
  const p=await xhrJSON('https://note.com/api/v2/creators/'+encodeURIComponent(id)),d=p?.data??p??{},u=d.creator||d.user||d;
  return{
   creator:String(u.nickname||u.name||id).trim(),
   avatar:mediaUrl(u.user_profile_image_url||u.profile_image_url||u.profileImageUrl||u.user_profile_image_path||u.profile_image_path||u.profileImagePath||u.icon_url||u.image_url||'')
  }
 }catch{return null}
}
async function enrich(row){
 let note={},user={},profile=null;
 try{
  const p=await xhrJSON('https://note.com/api/v3/notes/'+encodeURIComponent(row.key));
  note=p?.data||p||{};user=note.user||note.author||{}
 }catch{}
 profile=await creatorProfile(row.urlname||String(user.urlname||'')).catch(()=>null);
 let thumb=mediaUrl(note.eyecatch_url||note.image_url||note.imageUrl||note.thumbnail_url||note.thumbnailUrl||note.eyecatch?.url||note.eyecatch_image?.url||note.eyecatchImage?.url||note.image?.url||note.thumbnail?.url||row.thumbUrl||'');
 if(!thumb)thumb=await articleMetaImage(row.url);
 let avatar=mediaUrl(user.user_profile_image_url||user.profileImageUrl||user.profile_image_url||user.user_profile_image_path||user.profile_image_path||user.profileImagePath||profile?.avatar||row.actorImageUrl||'');
 return{
  ...row,
  creator:String(profile?.creator||user.nickname||user.name||row.creator||row.urlname||'noteクリエイター').trim(),
  actorImageUrl:avatar,
  thumbUrl:thumb,
  title:String(note.name||note.title||row.title||'無題の記事').trim()
 }
}
async function buildRows(input,special=false,workmom=false,parenting=false){
 const raw=parenting?await collectParenting(input.mode,input.count):workmom?await collectWorkmom(input.mode,input.count):special?await collectFirstNoteSpecial(input.mode,input.count,input.specialTags):await collectUnified(input.sources,input.mode,input.count,input.choice);
 const seen=new Set(),rows=[];
 for(const row of raw){
  const u=norm(row?.url);if(!u||u===norm(FINAL_URL)||seen.has(u))continue;
  seen.add(u);rows.push({...row,url:u})
 }
 rows.push({
  likerKey:'final-performance-math',urlname:'fuku444',creator:'実績の算数',
  actorUrl:'https://note.com/fuku444',actorImageUrl:'',url:FINAL_URL,
  title:'実績の算数│3日半で0→1達成',key:FINAL_KEY,publishAt:null,thumbUrl:'',finalMarker:true
 });
 const out=[];
 for(let i=0;i<rows.length;i+=5){
  if(stopRequested)throw new Error('停止しました');
  setStatus('画像情報 '+out.length+'/'+rows.length+'…');
  out.push(...await Promise.all(rows.slice(i,i+5).map(enrich)))
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
function designHash(value){
 let h=2166136261;
 for(const ch of String(value||'')){h^=ch.codePointAt(0)||0;h=Math.imul(h,16777619)}
 return h>>>0
}
function randomThinTheme(row){
 const themes=[
  {bg:'#ffffff',panel:'#ffffff',ink:'#101827',muted:'#64748b',line:'#d8e1ea',accent:'#22c3ee',soft:'#edfaff',kind:'minimal'},
  {bg:'#eef8ff',panel:'#ffffff',ink:'#10243a',muted:'#557086',line:'#b9d9ec',accent:'#5faee3',soft:'#dff3ff',kind:'wave'},
  {bg:'#fff8ed',panel:'#fffdf8',ink:'#33271e',muted:'#806b58',line:'#ead6ba',accent:'#e4a24d',soft:'#fff0d7',kind:'paper'},
  {bg:'#0b1622',panel:'#101f2e',ink:'#f5fbff',muted:'#9cc6da',line:'#294b60',accent:'#4ee6d6',soft:'#153544',kind:'cyber'},
  {bg:'#f7f7f7',panel:'#ffffff',ink:'#151515',muted:'#666666',line:'#cdcdcd',accent:'#111111',soft:'#eeeeee',kind:'mono'},
  {bg:'#effcf6',panel:'#fbfffd',ink:'#17352b',muted:'#58776b',line:'#bfe3d4',accent:'#37b98a',soft:'#dff7ed',kind:'ticket'},
  {bg:'#f7f1ff',panel:'#ffffff',ink:'#24143a',muted:'#745b8d',line:'#d9c5ee',accent:'#9c6ade',soft:'#eee2ff',kind:'orbit'},
  {bg:'#fff0f2',panel:'#fffafb',ink:'#3a1d27',muted:'#8a6170',line:'#efc5cf',accent:'#e76f91',soft:'#ffe1e8',kind:'stripe'},
  {bg:'#f3fbff',panel:'#ffffff',ink:'#12324a',muted:'#5d7587',line:'#c7ddea',accent:'#2b9ed8',soft:'#e5f5fc',kind:'grid'},
  {bg:'#fffdf3',panel:'#fffef8',ink:'#362f19',muted:'#7d7350',line:'#eadf9d',accent:'#d8b931',soft:'#fff6be',kind:'dots'},
  {bg:'#f4f8ff',panel:'#ffffff',ink:'#17243c',muted:'#65728b',line:'#ccd6eb',accent:'#5a74d6',soft:'#e7edff',kind:'diagonal'},
  {bg:'#fff5fa',panel:'#ffffff',ink:'#351a2b',muted:'#856278',line:'#eccdde',accent:'#d956a0',soft:'#ffe5f3',kind:'corner'},
  {bg:'#f3fff9',panel:'#ffffff',ink:'#15372a',muted:'#5f7d70',line:'#c5e7d7',accent:'#2da974',soft:'#e4f8ef',kind:'frame'},
  {bg:'#fff8f1',panel:'#fffdf9',ink:'#3b281a',muted:'#876d59',line:'#ead5c0',accent:'#e37b3d',soft:'#ffead8',kind:'split'},
  {bg:'#f9f6ff',panel:'#ffffff',ink:'#291c40',muted:'#75658a',line:'#d9cfeb',accent:'#7d5bc8',soft:'#eee6ff',kind:'ribbon'},
  {bg:'#effcff',panel:'#fbffff',ink:'#12343b',muted:'#5a7880',line:'#bfe4e8',accent:'#26afbd',soft:'#ddf7fa',kind:'bubbles'},
  {bg:'#fff7e8',panel:'#fffdfa',ink:'#382719',muted:'#88705a',line:'#efd9b7',accent:'#ef9c36',soft:'#ffebc8',kind:'sunrise'},
  {bg:'#f6fbf4',panel:'#ffffff',ink:'#22351c',muted:'#6f8069',line:'#d2e3cc',accent:'#69a850',soft:'#eaf5e4',kind:'zigzag'},
  {bg:'#eef5ff',panel:'#f9fbff',ink:'#16263d',muted:'#60738d',line:'#c3d3e9',accent:'#3f7fc5',soft:'#dce9f8',kind:'glass'},
  {bg:'#fffef7',panel:'#ffffff',ink:'#28251b',muted:'#77705d',line:'#ddd4b6',accent:'#b69443',soft:'#f6efd7',kind:'notebook'}
 ];
 return themes[designHash(row?.key||row?.url||row?.creator)%themes.length]
}
function drawThinDecor(ctx,t){
 ctx.fillStyle=t.bg;ctx.fillRect(0,0,W,H);
 ctx.strokeStyle=t.line;ctx.lineWidth=1.5;rounded(ctx,1,1,W-2,H-2,12);ctx.stroke();
 if(t.kind==='minimal'){
  ctx.fillStyle=t.accent;ctx.fillRect(0,0,6,H);
  ctx.fillStyle=t.soft;ctx.beginPath();ctx.arc(545,22,46,0,Math.PI*2);ctx.fill()
 }else if(t.kind==='wave'){
  const g=ctx.createLinearGradient(0,0,W,0);g.addColorStop(0,t.bg);g.addColorStop(1,t.soft);ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  ctx.strokeStyle=t.accent;ctx.globalAlpha=.35;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(0,118);ctx.bezierCurveTo(180,70,340,150,560,92);ctx.stroke();ctx.globalAlpha=1
 }else if(t.kind==='paper'){
  ctx.fillStyle=t.soft;ctx.fillRect(0,0,74,H);
  ctx.strokeStyle=t.line;ctx.setLineDash([4,5]);ctx.beginPath();ctx.moveTo(566,12);ctx.lineTo(566,H-12);ctx.stroke();ctx.setLineDash([])
 }else if(t.kind==='cyber'){
  ctx.fillStyle=t.panel;rounded(ctx,8,8,560,H-16,10);ctx.fill();
  ctx.strokeStyle=t.accent;ctx.globalAlpha=.32;for(let x=18;x<560;x+=38){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x+46,H);ctx.stroke()}ctx.globalAlpha=1
 }else if(t.kind==='mono'){
  ctx.fillStyle=t.accent;ctx.fillRect(0,0,12,H);
  ctx.strokeStyle='#d7d7d7';for(let y=18;y<H;y+=18){ctx.beginPath();ctx.moveTo(18,y);ctx.lineTo(565,y);ctx.stroke()}
 }else if(t.kind==='ticket'){
  ctx.fillStyle=t.soft;ctx.fillRect(0,0,W,H);
  ctx.fillStyle=t.panel;rounded(ctx,10,9,W-20,H-18,12);ctx.fill();
  ctx.strokeStyle=t.accent;ctx.setLineDash([6,5]);ctx.strokeRect(572,9,1,H-18);ctx.setLineDash([])
 }else if(t.kind==='orbit'){
  ctx.fillStyle=t.soft;ctx.beginPath();ctx.arc(526,72,74,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle=t.accent;ctx.globalAlpha=.45;ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(520,70,100,38,-.25,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1
 }else if(t.kind==='stripe'){
  ctx.fillStyle=t.soft;ctx.fillRect(0,0,W,H);
  ctx.strokeStyle=t.line;ctx.globalAlpha=.6;for(let x=-100;x<W;x+=32){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x+80,H);ctx.stroke()}ctx.globalAlpha=1
 }else if(t.kind==='grid'){
  ctx.strokeStyle=t.line;ctx.globalAlpha=.55;for(let x=0;x<570;x+=28){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke()}for(let y=0;y<H;y+=28){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(570,y);ctx.stroke()}ctx.globalAlpha=1
 }else if(t.kind==='dots'){
  ctx.fillStyle=t.accent;ctx.globalAlpha=.22;for(let y=14;y<H;y+=20)for(let x=14;x<570;x+=20){ctx.beginPath();ctx.arc(x,y,2.2,0,Math.PI*2);ctx.fill()}ctx.globalAlpha=1
 }else if(t.kind==='diagonal'){
  ctx.strokeStyle=t.accent;ctx.globalAlpha=.2;ctx.lineWidth=5;for(let x=-120;x<600;x+=44){ctx.beginPath();ctx.moveTo(x,H);ctx.lineTo(x+110,0);ctx.stroke()}ctx.globalAlpha=1
 }else if(t.kind==='corner'){
  ctx.strokeStyle=t.accent;ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(8,46);ctx.lineTo(8,8);ctx.lineTo(140,8);ctx.stroke();ctx.beginPath();ctx.moveTo(430,H-8);ctx.lineTo(566,H-8);ctx.lineTo(566,H-46);ctx.stroke()
 }else if(t.kind==='frame'){
  ctx.strokeStyle=t.accent;ctx.lineWidth=2;rounded(ctx,14,12,544,H-24,14);ctx.stroke();ctx.globalAlpha=.25;ctx.strokeStyle=t.line;rounded(ctx,21,19,530,H-38,11);ctx.stroke();ctx.globalAlpha=1
 }else if(t.kind==='split'){
  ctx.fillStyle=t.soft;ctx.fillRect(0,0,205,H);ctx.fillStyle=t.accent;ctx.globalAlpha=.18;ctx.beginPath();ctx.moveTo(205,0);ctx.lineTo(290,0);ctx.lineTo(205,H);ctx.closePath();ctx.fill();ctx.globalAlpha=1
 }else if(t.kind==='ribbon'){
  ctx.fillStyle=t.accent;ctx.globalAlpha=.16;ctx.beginPath();ctx.moveTo(0,18);ctx.lineTo(570,0);ctx.lineTo(570,28);ctx.lineTo(0,46);ctx.closePath();ctx.fill();ctx.globalAlpha=1
 }else if(t.kind==='bubbles'){
  ctx.fillStyle=t.accent;ctx.globalAlpha=.14;for(const p of [[505,25,40],[545,88,30],[455,105,22],[170,18,16]]){ctx.beginPath();ctx.arc(p[0],p[1],p[2],0,Math.PI*2);ctx.fill()}ctx.globalAlpha=1
 }else if(t.kind==='sunrise'){
  ctx.strokeStyle=t.accent;ctx.globalAlpha=.26;ctx.lineWidth=2;for(let a=0;a<Math.PI*2;a+=Math.PI/12){ctx.beginPath();ctx.moveTo(520,70);ctx.lineTo(520+Math.cos(a)*95,70+Math.sin(a)*95);ctx.stroke()}ctx.globalAlpha=1
 }else if(t.kind==='zigzag'){
  ctx.strokeStyle=t.accent;ctx.globalAlpha=.3;ctx.lineWidth=3;ctx.beginPath();for(let x=0;x<570;x+=24){const y=(x/24)%2?122:105;if(x===0)ctx.moveTo(x,y);else ctx.lineTo(x,y)}ctx.stroke();ctx.globalAlpha=1
 }else if(t.kind==='glass'){
  const g=ctx.createLinearGradient(0,0,570,H);g.addColorStop(0,'rgba(255,255,255,.8)');g.addColorStop(.5,'rgba(255,255,255,.15)');g.addColorStop(1,'rgba(255,255,255,.65)');ctx.fillStyle=g;rounded(ctx,10,9,552,H-18,14);ctx.fill();ctx.strokeStyle=t.line;ctx.stroke()
 }else if(t.kind==='notebook'){
  ctx.fillStyle=t.soft;ctx.fillRect(0,0,28,H);ctx.strokeStyle=t.line;for(let y=18;y<H;y+=18){ctx.beginPath();ctx.moveTo(34,y);ctx.lineTo(566,y);ctx.stroke()}ctx.fillStyle=t.accent;for(let y=15;y<H;y+=22){ctx.beginPath();ctx.arc(14,y,3,0,Math.PI*2);ctx.fill()}
 }
}
async function makeFile(row){
 const [avatar,thumb]=await Promise.all([bitmapFromUrl(row.actorImageUrl),bitmapFromUrl(row.thumbUrl)]);
 const c=document.createElement('canvas');c.width=W;c.height=H;const ctx=c.getContext('2d'),theme=randomThinTheme(row);
 drawThinDecor(ctx,theme);
 const ax=50,ay=70,ar=34;
 ctx.fillStyle=theme.soft;circle(ctx,ax,ay,ar+2);ctx.fill();
 ctx.strokeStyle=theme.accent;ctx.lineWidth=2;circle(ctx,ax,ay,ar+2);ctx.stroke();
 if(avatar){const iw=avatar.width||avatar.naturalWidth||1,ih=avatar.height||avatar.naturalHeight||1,scale=Math.max((ar*2)/iw,(ar*2)/ih),dw=iw*scale,dh=ih*scale;ctx.save();circle(ctx,ax,ay,ar);ctx.clip();ctx.drawImage(avatar,ax-dw/2,ay-dh/2,dw,dh);ctx.restore()}
 else{ctx.fillStyle=theme.muted;ctx.font='800 24px system-ui';ctx.textAlign='center';ctx.fillText('n',ax,57);ctx.textAlign='start'}
 const tx=100,tw=455;ctx.textBaseline='top';ctx.fillStyle=theme.ink;ctx.font='700 18px system-ui,-apple-system,sans-serif';lines(ctx,row.title,tw,2).forEach((v,i)=>ctx.fillText(v,tx,18+i*25));
 ctx.fillStyle=theme.muted;ctx.font='700 14px system-ui,-apple-system,sans-serif';ctx.fillText(fit(ctx,row.creator+'さん',tw),tx,86);
 ctx.fillStyle=theme.accent;ctx.font='700 12px system-ui,-apple-system,sans-serif';ctx.fillText('note',tx,110);
 const ix=590,iy=8,iw=262,ih=124;ctx.fillStyle=theme.panel;rounded(ctx,ix,iy,iw,ih,8);ctx.fill();ctx.strokeStyle=theme.line;ctx.lineWidth=1;rounded(ctx,ix,iy,iw,ih,8);ctx.stroke();
 if(thumb){const sw=thumb.width||thumb.naturalWidth||1,sh=thumb.height||thumb.naturalHeight||1,scale=Math.max(iw/sw,ih/sh),dw=sw*scale,dh=sh*scale;ctx.save();rounded(ctx,ix,iy,iw,ih,8);ctx.clip();ctx.drawImage(thumb,ix+(iw-dw)/2,iy+(ih-dh)/2,dw,dh);ctx.restore()}
 else{ctx.fillStyle=theme.muted;ctx.font='800 24px system-ui';ctx.textAlign='center';ctx.fillText('note',ix+iw/2,55);ctx.textAlign='start'}
 try{avatar?.close?.()}catch{}try{thumb?.close?.()}catch{}
 const blob=await new Promise((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(new Error('画像生成失敗')),'image/png',1));
 return new page.File([blob],'mumei_profile_note_v17_'+String(row.index).padStart(3,'0')+'.png',{type:'image/png'})
}
function sectionHeadingText(groupIndex){
 const from=groupIndex*10+1,to=from+9;
 return String(groupIndex+1).padStart(2,'0')+'｜'+from+'〜'+to+'人目の「はじめまして」'
}
function insertHeadingAt(view,text,pos){
 const type=view.state.schema.nodes.heading;if(!type)throw new Error('note見出しノードを取得できません');
 const at=Math.max(0,Math.min(view.state.doc.content.size,Number(pos)||0));
 let node;try{node=type.create({level:2},view.state.schema.text(text))}catch{node=type.create(null,view.state.schema.text(text))}
 view.dispatch(view.state.tr.insert(at,node));
 const actual=view.state.doc.nodeAt(at);
 if(!actual||actual.type?.name!=='heading'||String(actual.textContent||'')!==text)throw new Error('10人区切り見出しの挿入確認に失敗しました');
 return{pos:at,nextPos:at+actual.nodeSize}
}
function recordHeading(text){
 const run=readRun();if(!run)return;
 const headings=Array.isArray(run.sectionHeadings)?run.sectionHeadings:[];
 if(!headings.includes(text))headings.push(text);
 writeRun({...run,sectionHeadings:headings,updatedAt:Date.now()})
}
function resolveOwnedHeadingHits(view){
 const run=readRun(),wanted=new Set(Array.isArray(run?.sectionHeadings)?run.sectionHeadings:[]),out=[];
 if(!wanted.size)return out;
 view.state.doc.descendants((node,pos)=>{if(node.type?.name==='heading'&&wanted.has(String(node.textContent||'')))out.push({node,pos})});
 return out
}
function setSelectionForInsert(view,pos){
 const max=view.state.doc.content.size;
 const at=Math.max(0,Math.min(max,Number(pos)||0));
 const Selection=selectionApi();
 const resolved=view.state.doc.resolve(at);
 const sel=typeof Selection.near==='function'?Selection.near(resolved):Selection.atEnd(view.state.doc);
 view.dispatch(view.state.tr.setSelection(sel).scrollIntoView());
 view.focus();
 return view.state.selection.from
}
async function uploadOne(view,row,file,insertPos){
 const before=new Set(imageNodes(view).map(h=>String(h.node.attrs?.id||'')).filter(Boolean));
 const selected=setSelectionForInsert(view,insertPos);
 const dt=new page.DataTransfer();dt.items.add(file);
 if(nativeImageCommand()(view,dt.files,Math.max(0,selected-1),'image')!==true)throw new Error(row.index+'番 画像アップロードを開始できません');
 const hit=await waitNewNoteImage(view,before,150000);
 const linked=relinkCaption(view,hit,row);
 const actual=imageNodes(view).find(h=>{
  const id=String(linked?.node?.attrs?.id||'');
  return (id&&String(h.node.attrs?.id||'')===id)||h.pos===linked.pos
 })||linked;
 return{hit:actual,nextPos:actual.pos+actual.node.nodeSize}
}
function recordImage(hit,row){
 const run=readRun()||{version:VERSION,articleKey:editorArticleKey(),items:[],createdAt:Date.now()};
 const rec={id:String(hit?.node?.attrs?.id||''),src:String(hit?.node?.attrs?.src||''),url:norm(row.url),creator:String(row.creator||''),at:Date.now()};
 const items=Array.isArray(run.items)?run.items:[];
 const key=(x)=>String(x.id||'')+'|'+String(x.src||'')+'|'+norm(x.url);
 if(!items.some(x=>key(x)===key(rec)))items.push(rec);
 writeRun({...run,version:VERSION,articleKey:editorArticleKey(),items,updatedAt:Date.now()})
}
function legacyOwnedMarker(node){
 return Object.values(node?.attrs||{}).some(v=>/mumei_profile_note_v1/i.test(String(v||'')))
}
function resolveOwnedImageHits(view){
 const run=readRun(),records=Array.isArray(run?.items)?run.items:[],all=imageNodes(view),owned=new Map();
 for(const rec of records){
  const byId=rec.id?all.find(h=>String(h.node.attrs?.id||'')===String(rec.id)):null;
  if(byId&&norm(byId.node.attrs?.link)===norm(rec.url)){owned.set(byId.pos,byId);continue}
  if(rec.src){
   const matches=all.filter(h=>String(h.node.attrs?.src||'')===String(rec.src)&&norm(h.node.attrs?.link)===norm(rec.url));
   if(matches.length===1)owned.set(matches[0].pos,matches[0])
  }
 }
 for(const h of all)if(legacyOwnedMarker(h.node))owned.set(h.pos,h);
 return[...owned.values()]
}
function deleteHits(view,hits){
 const uniq=[...new Map((hits||[]).map(h=>[h.pos,h])).values()].sort((a,b)=>b.pos-a.pos);
 if(!uniq.length)return 0;
 let tr=view.state.tr;
 for(const h of uniq){
  const node=view.state.doc.nodeAt(h.pos);
  if(!node||!node.eq(h.node))throw new Error('本文位置が変わったため削除を停止しました');
  tr=tr.delete(h.pos,h.pos+h.node.nodeSize)
 }
 view.dispatch(tr);ensureEndSelection(view);return uniq.length
}
async function saveOnce(label='貼り付け完了｜下書き保存を1回だけ実行中…'){
 setStatus(label);await sleep(1500);
 const b=[...document.querySelectorAll('button')].find(x=>/^(一時保存|下書き保存)$/.test(x.textContent?.trim())&&x.getClientRects().length&&!x.disabled);
 if(b){b.click();await sleep(6000)}
}
function resolveOwnedCardHits(view){
 const run=readRun(),cards=Array.isArray(run?.cardKeys)?run.cardKeys:[],baseline=new Set(run?.cardBaselineKeys||[]),hits=[];
 for(const rec of cards){
  if(baseline.has(String(rec.key||'')))continue;
  const hit=embedNodes(view).find(h=>cardKey(h)===String(rec.key||'')&&genuineCard(h,rec.url));
  if(hit)hits.push(hit)
 }
 return hits
}
function trackedContentCount(view){
 if(!readRun())return{images:0,cards:0,headings:0};
 return{images:resolveOwnedImageHits(view).length,cards:resolveOwnedCardHits(view).length,headings:resolveOwnedHeadingHits(view).length}
}
async function deleteNotificationCards({confirm=true,save=true}={}){
 const view=findView();if(!view)throw new Error('note本文編集欄を取得できません');
 const hits=resolveOwnedCardHits(view);
 if(confirm&&!page.confirm('今回作った正規通知カード '+hits.length+'件だけ削除します。紹介画像は残します。実行しますか？'))return null;
 const removed=deleteHits(view,hits);
 const run=readRun();
 if(run)writeRun({...run,cardKeys:[],pendingCard:null,stage:'images_ready',updatedAt:Date.now()});
 if(save&&removed)await saveOnce('正規通知カード '+removed+'件を一括削除｜下書き保存中…');
 return removed
}
async function deleteAllGenerated({save=true}={}){
 const view=findView();if(!view)throw new Error('note本文編集欄を取得できません');
 const cards=resolveOwnedCardHits(view),images=resolveOwnedImageHits(view),headings=resolveOwnedHeadingHits(view);
 const removedCards=cards.length,removedImages=images.length,removedHeadings=headings.length;
 deleteHits(view,[...cards,...images,...headings]);
 writeRun(null);
 if(save&&(removedCards||removedImages||removedHeadings))await saveOnce('最初に戻る｜通知'+removedCards+'・画像'+removedImages+'・見出し'+removedHeadings+'を削除して保存中…');
 return{removedCards,removedImages,removedHeadings}
}

function inputValues(save=true){
 const p=document.getElementById(PANEL),g=getPrefs();if(!p)return g;
 const sources=String(p.querySelector('[data-sources]')?.value||'').trim();
 const mode=p.querySelector('[data-mode]')?.value==='all'?'all':'number';
 const count=Math.max(0,Math.min(5000,Number(p.querySelector('[data-count]')?.value||0)));
 const choice=p.querySelector('button[data-choice].on')?.dataset.choice||g.choice||'latest';
 const specialMode=p.querySelector('[data-special-mode]')?.value==='all'?'all':'number';
 const specialCount=Math.max(1,Math.min(1000,Number(p.querySelector('[data-special-count]')?.value||g.specialCount||100)));
 const specialTags=[...p.querySelectorAll('button[data-special-tag].on')].map(x=>String(x.dataset.specialTag||'')).filter(Boolean);
 const workmomMode=p.querySelector('[data-workmom-mode]')?.value==='all'?'all':'number';
 const workmomCount=Math.max(1,Math.min(1000,Number(p.querySelector('[data-workmom-count]')?.value||g.workmomCount||100)));
 const parentingMode=p.querySelector('[data-parenting-mode]')?.value==='all'?'all':'number';
 const parentingCount=Math.max(1,Math.min(1000,Number(p.querySelector('[data-parenting-count]')?.value||g.parentingCount||100)));
 const v={sources,mode,count,choice,specialMode,specialCount,specialTags,workmomMode,workmomCount,parentingMode,parentingCount,collapsed:Boolean(g.collapsed),tiny:Boolean(g.tiny)};
 if(save)setPrefs(v);return v
}
function choiceLabel(c){return c==='oldest'?'最初の記事':c==='fixed'?'固定→最新':'最新記事'}
function amountLabel(mode,count){return mode==='all'?'全数':String(count)+'件'}
async function createImageList({special=false,workmom=false,parenting=false}={}){
 if(busy)return;busy=true;stopRequested=false;update();
 try{
  const input=inputValues();
  if(!special&&!workmom&&!parenting){
   const sources=parseUnifiedSources(input.sources);
   if(!sources.length)throw new Error('記事URL・マガジンURL・#タグを1つ以上入れてください');
   if(input.mode==='number'&&input.count<=0)throw new Error('件数を1以上にするか「全数」を選んでください');
  }
  const view=findView();if(!view)throw new Error('note本文編集欄を取得できません');
  nativeImageCommand();noteUrlCommandFactory();selectionApi();

  // ①画像一覧も、開始ボタンを押した瞬間の本文タップ位置を固定して使う。
  // 以後の通信・画像生成中に選択位置が変わっても、最下部へ飛ばさない。
  let imageInsertPos=cardAnchorFromSelection(view);

  const leftover=trackedContentCount(view);
  if(leftover.images||leftover.cards||leftover.headings){
   throw new Error('このページに今回作成分が残っています。「正規通知カード一括削除」または「最初に戻る」で整理してから新規実行してください')
  }

  if(special&&(!Array.isArray(input.specialTags)||!input.specialTags.length))throw new Error('初投稿タグを1つ以上選んでください');
  const effective=parenting
   ?{...input,mode:input.parentingMode,count:input.parentingCount}
   :workmom
    ?{...input,mode:input.workmomMode,count:input.workmomCount}
    :special
     ?{...input,mode:input.specialMode,count:input.specialCount,specialTags:input.specialTags}
     :input;

  const rows=await buildRows(effective,special,workmom,parenting);
  if(!rows.length)throw new Error('貼り付け対象が0件です');

  // 指定件数は実績の算数を含まない。buildRows が最後に +1件する。
  const requestedCount=parenting?(input.parentingMode==='all'?null:input.parentingCount):workmom?(input.workmomMode==='all'?null:input.workmomCount):special?(input.specialMode==='all'?null:input.specialCount):(input.mode==='all'?null:input.count);
  writeRun({
   version:VERSION,articleKey:editorArticleKey(),items:[],cardKeys:[],sectionHeadings:[],rows,
   cardBaselineKeys:embedNodes(view).map(cardKey).filter(Boolean),
   createdAt:Date.now(),stage:'images_building',special:Boolean(special),workmom:Boolean(workmom),parenting:Boolean(parenting),
   imageAnchorPos:imageInsertPos,
   sources:parenting?'#'+PARENTING_TAG:workmom?'#'+WORKMOM_TAG:special?input.specialTags.map(x=>'#'+x).join(' '):input.sources,
   mode:effective.mode,count:requestedCount,choice:input.choice
  });

  setStatus((parenting?'#育児日記案件':workmom?'#ワーママ案件':special?'特別案件':'通常')+'｜ランダム極薄8種｜①画像一覧をタップ位置から '+rows.length+'件（指定'+(requestedCount??'全数')+'＋実績の算数1件）作成');
  for(let i=0;i<rows.length;i++){
   if(stopRequested)throw new Error('手動停止');
   const row=rows[i];
   if(special){
    if(row.finalMarker){
     const text='最後に｜実績の算数';
     const h=insertHeadingAt(view,text,imageInsertPos);imageInsertPos=h.nextPos;recordHeading(text)
    }else if(i%10===0){
     const text=sectionHeadingText(Math.floor(i/10));
     const h=insertHeadingAt(view,text,imageInsertPos);imageInsertPos=h.nextPos;recordHeading(text)
    }
   }
   setStatus('① 画像🔗＋名前キャプション '+(i+1)+'/'+rows.length+'｜'+row.creator);
   const file=await makeFile(row);
   const made=await uploadOne(view,row,file,imageInsertPos);
   imageInsertPos=made.nextPos;
   recordImage(made.hit,row);
   await sleep(IMAGE_PASTE_GAP)
  }

  const runNow=readRun()||{};
  writeRun({...runNow,stage:'images_ready',rows,imagesCompletedAt:Date.now(),updatedAt:Date.now()});
  if(special)saveSpecialLast(rows);
  await saveOnce('① 画像🔗＋名前キャプション '+rows.length+'/'+rows.length+' 完了｜保存中…');
  if(special){
   const autoAdded=commitSpecialLast({silent:true});
   setStatus('①初投稿者画像一覧 完了 ✅ '+rows.length+'件｜今回成功分 '+autoAdded+'件を次回重複除外へ自動登録｜カード位置をタップ →「②ここから通知カード」')
  }else{
   setStatus('①画像一覧 完了 ✅ '+rows.length+'件｜カードを置く位置を本文でタップ →「②ここから通知カード」')
  }
 }catch(e){
  setStatus('停止：'+(e?.message||String(e))+'｜完成分は本文に保持。自動再開はしません',true)
 }finally{busy=false;update()}
}
async function createCardsAtTap(){
 if(busy)return;busy=true;stopRequested=false;update();
 try{
  const view=findView();if(!view)throw new Error('note本文編集欄を取得できません');
  const run=readRun(),rows=Array.isArray(run?.rows)?run.rows:[];
  if(!run||run.stage!=='images_ready'||!rows.length)throw new Error('先に①画像一覧を完成させてください');
  if((run.cardKeys||[]).length)throw new Error('今回の通知カードが既にあります。続き作成はしません。通知カード一括削除後に新しく作成してください');
  const imageCount=resolveOwnedImageHits(view).length;
  if(imageCount!==rows.length)throw new Error('今回画像が '+imageCount+'/'+rows.length+' 件です。画像一覧を確認してください');

  // ユーザーが本文をタップした位置を、ボタンを押した瞬間のselectionから取得。
  let insertPos=cardAnchorFromSelection(view);
  let cardGapMs=CARD_GAP_FAST;
  writeRun({...run,stage:'cards_building',cardAnchorPos:insertPos,cardKeys:[],updatedAt:Date.now()});
  setStatus('② 正規通知カード開始｜約1.35倍速・通常間隔 '+(CARD_GAP_FAST/1000).toFixed(1)+'秒｜'+rows.length+'件');

  for(let i=0;i<rows.length;i++){
   if(stopRequested)throw new Error('手動停止');
   const row=rows[i];
   let made=null;
   setStatus('② 正規通知カード '+(i+1)+'/'+rows.length+'｜'+row.creator+'｜待機 '+(cardGapMs/1000)+'秒');
   try{
    made=await createNativeCard(view,row,insertPos)
   }catch(firstError){
    // 通常5秒/再試行10秒相当の安全設計を約1.35倍速化。エラー時だけ低速側へ昇格する。
    cardGapMs=CARD_GAP_SLOW;
    setStatus('② '+row.creator+'｜一時エラー → '+(CARD_GAP_SLOW/1000).toFixed(1)+'秒待って1回再試行',true);
    await sleep(CARD_GAP_SLOW);
    if(stopRequested)throw new Error('手動停止');
    try{
     made=await createNativeCard(view,row,Math.min(insertPos,view.state.doc.content.size))
    }catch(secondError){
     throw new Error(row.creator+' カード生成失敗（再試行済み）：'+(secondError?.message||firstError?.message||String(secondError)))
    }
   }
   insertPos=made.nextPos;

   // note側の非同期エラーが遅れて出ることがあるため、成功後も最初は5秒だけ観察。
   // 途中で失敗が出た場合のみ以後10秒になる。
   await sleep(cardGapMs);

   if((i+1)%10===0&&i+1<rows.length){
    setStatus('② 正規通知カード '+(i+1)+'/'+rows.length+'｜403回避 '+(CARD_BLOCK_PAUSE/1000).toFixed(1)+'秒休止');
    await sleep(CARD_BLOCK_PAUSE)
   }
  }

  // +1件の「実績の算数」は最後にカード実体まで必ず再確認する。
  const finalRow=rows.find(x=>x?.finalMarker||norm(x?.url)===norm(FINAL_URL));
  if(finalRow){
   let finalHit=embedNodes(view).find(h=>genuineCard(h,FINAL_URL));
   if(!finalHit){
    setStatus('② 実績の算数｜カード未確認 → '+(CARD_GAP_FAST/1000).toFixed(1)+'秒待って再生成');
    await sleep(CARD_GAP_FAST);
    const tracked=resolveOwnedCardHits(view).sort((a,b)=>a.pos-b.pos);
    const retryPos=tracked.length?tracked[tracked.length-1].pos+tracked[tracked.length-1].node.nodeSize:Math.min(insertPos,view.state.doc.content.size);
    const made=await createNativeCard(view,finalRow,retryPos);
    insertPos=made.nextPos;
    await sleep(CARD_GAP_FAST);
    finalHit=embedNodes(view).find(h=>genuineCard(h,FINAL_URL));
    if(!finalHit)throw new Error('実績の算数カードだけ最終確認できませんでした')
   }
  }

  const done=readRun()||{};
  const actualCards=resolveOwnedCardHits(view).length;
  if(actualCards!==rows.length)throw new Error('通知カード実数 '+actualCards+'/'+rows.length+'｜不足を検出したため完了にしません');
  writeRun({...done,stage:'complete',cardsCompletedAt:Date.now(),updatedAt:Date.now()});
  await saveOnce('② 正規通知カード '+rows.length+'/'+rows.length+' 完了｜最終保存中…');
  setStatus('完了 ✅ 画像一覧 '+rows.length+'件 → 指定位置から通知カード一覧 '+rows.length+'件')
 }catch(e){
  setStatus('通知カード停止：'+(e?.message||String(e))+'｜完成分は本文に保持。続き作成はしません',true)
 }finally{busy=false;update()}
}
async function bulkDelete(){
 if(busy)return;busy=true;stopRequested=true;update();
 try{
  const removed=await deleteNotificationCards({confirm:true,save:true});
  if(removed!==null)setStatus('正規通知カード '+removed+'件を一括削除しました ✅ 紹介画像は保持')
 }catch(e){setStatus('通知カード一括削除停止：'+(e?.message||String(e)),true)}
 finally{busy=false;stopRequested=false;update()}
}
function resetFields(){
 const p=document.getElementById(PANEL);if(!p)return;
 p.querySelector('[data-sources]').value='';
 p.querySelector('[data-mode]').value='number';
 p.querySelector('[data-count]').value='10';
 const sm=p.querySelector('[data-special-mode]'),sc=p.querySelector('[data-special-count]');
 if(sm)sm.value='number';if(sc)sc.value='100';
 const wm=p.querySelector('[data-workmom-mode]'),wc=p.querySelector('[data-workmom-count]');
 if(wm)wm.value='number';if(wc)wc.value='100';
 const pm=p.querySelector('[data-parenting-mode]'),pc=p.querySelector('[data-parenting-count]');
 if(pm)pm.value='number';if(pc)pc.value='100';
 p.querySelectorAll('button[data-special-tag]').forEach(x=>x.classList.add('on'));
 p.querySelectorAll('button[data-choice]').forEach(x=>x.classList.toggle('on',x.dataset.choice==='latest'));
 applyAmountMode();applySpecialAmountMode();applyWorkmomAmountMode();applyParentingAmountMode()
}
async function resetAll(){
 if(busy)return;
 if(!page.confirm('今回作った紹介画像＋正規通知カードを削除し、入力・件数・途中記録を最初に戻します。元本文・元画像・元カードは残します。実行しますか？'))return;
 busy=true;stopRequested=true;update();
 try{
  const result=await deleteAllGenerated({save:false});
  localStorage.removeItem(PREF);writeRun(null);resetFields();
  if(result.removedCards||result.removedImages||result.removedHeadings)await saveOnce('最初に戻る｜通知'+result.removedCards+'・画像'+result.removedImages+'・見出し'+result.removedHeadings+'を削除して保存中…');
  setStatus('最初に戻しました ✅ 画像 '+result.removedImages+' / 通知 '+result.removedCards+' / 見出し '+result.removedHeadings+' を削除｜元本文は保持')
 }catch(e){setStatus('最初に戻る停止：'+(e?.message||String(e)),true)}
 finally{busy=false;stopRequested=false;update()}
}
function stop(){stopRequested=true;setStatus('停止要求済み｜現在処理中の1件が終わったら停止')}
function update(){
 const p=document.getElementById(PANEL);if(!p)return;
 p.querySelectorAll('textarea,input,select,button').forEach(x=>{
  if(x.dataset.a==='stop'||x.dataset.ui)return;
  x.disabled=busy
 })
}
function saveUiState(extra={}){const cur=inputValues(false),old=getPrefs();setPrefs({...old,...cur,...extra})}
function applyAmountMode(){
 const p=document.getElementById(PANEL),sel=p?.querySelector('[data-mode]'),num=p?.querySelector('[data-count]');
 if(num)num.style.display=sel?.value==='all'?'none':'block'
}
function applySpecialAmountMode(){
 const p=document.getElementById(PANEL),sel=p?.querySelector('[data-special-mode]'),num=p?.querySelector('[data-special-count]');
 if(num)num.style.display=sel?.value==='all'?'none':'block'
}
function applyWorkmomAmountMode(){
 const p=document.getElementById(PANEL),sel=p?.querySelector('[data-workmom-mode]'),num=p?.querySelector('[data-workmom-count]');
 if(num)num.style.display=sel?.value==='all'?'none':'block'
}
function applyParentingAmountMode(){
 const p=document.getElementById(PANEL),sel=p?.querySelector('[data-parenting-mode]'),num=p?.querySelector('[data-parenting-count]');
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
  mini.style.top=Math.max(4,Math.min(innerHeight-46,r.top))+'px';mini.style.right='auto';
  p.classList.add('tiny');mini.style.display='flex'
 }else{
  const r=mini.getBoundingClientRect();
  p.style.left=Math.max(4,Math.min(innerWidth-p.offsetWidth-4,r.left))+'px';
  p.style.top=Math.max(4,Math.min(innerHeight-p.offsetHeight-4,r.top))+'px';p.style.right='auto';
  p.classList.remove('tiny','collapsed');mini.style.display='none';savePos(p)
 }
 saveUiState({tiny:Boolean(on),collapsed:false})
}
function restorePos(el){
 try{const v=JSON.parse(localStorage.getItem(POS)||'null');if(!v)return;const left=Math.max(4,Math.min(innerWidth-el.offsetWidth-4,Number(v.left)||4)),top=Math.max(24,Math.min(innerHeight-el.offsetHeight-4,Number(v.top)||84));el.style.left=left+'px';el.style.top=top+'px';el.style.right='auto'}catch{}
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
 const end=e=>{clear();if(dragging){e.preventDefault();savePos(panel);suppressClickUntil=Date.now()+650}dragging=false;pid=null};
 handle.addEventListener('pointerup',end);handle.addEventListener('pointercancel',end)
}
function bindDirectDrag(handle,panel){
 let pid=null,startX=0,startY=0,baseL=0,baseT=0,moved=false;
 handle.addEventListener('pointerdown',e=>{
  if(e.button!==undefined&&e.button!==0)return;
  e.preventDefault();e.stopPropagation();
  pid=e.pointerId;startX=e.clientX;startY=e.clientY;moved=false;
  const r=panel.getBoundingClientRect();baseL=r.left;baseT=r.top;
  try{handle.setPointerCapture(pid)}catch{}
 });
 handle.addEventListener('pointermove',e=>{
  if(pid==null||e.pointerId!==pid)return;
  const dx=e.clientX-startX,dy=e.clientY-startY;
  if(!moved&&Math.hypot(dx,dy)<3)return;
  moved=true;e.preventDefault();e.stopPropagation();
  const l=Math.max(4,Math.min(innerWidth-panel.offsetWidth-4,baseL+dx));
  const t=Math.max(24,Math.min(innerHeight-panel.offsetHeight-4,baseT+dy));
  panel.style.left=l+'px';panel.style.top=t+'px';panel.style.right='auto'
 });
 const end=e=>{
  if(pid==null||e.pointerId!==pid)return;
  if(moved){e.preventDefault();e.stopPropagation();savePos(panel);suppressClickUntil=Date.now()+300}
  pid=null;moved=false
 };
 handle.addEventListener('pointerup',end);handle.addEventListener('pointercancel',end)
}
function escAttr(v){return String(v||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;')}
function mount(){
 if(!document.body||document.getElementById(PANEL))return;
 const g=getPrefs(),p=document.createElement('div');p.id=PANEL;
 p.innerHTML=`
 <style>
 #${PANEL}{position:fixed;right:4px;top:76px;z-index:2147483647;width:min(132px,calc(100vw - 8px));padding:3px;border:1px solid #365b70;border-radius:8px;background:#07131d;color:#edf8ff;box-shadow:0 6px 16px #0008;font:7.2px/1.18 system-ui;max-height:34vh}
 #${PANEL}.tiny{display:none}#${PANEL}.collapsed .body{display:none}#${PANEL}.collapsed{width:108px;padding:3px}
 #${PANEL} .dragbar{position:absolute;left:0;right:0;top:-15px;height:15px;border:1px solid #365b70;border-bottom:0;border-radius:7px 7px 0 0;background:#0a2938;color:#c9f4ff;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:6.4px;letter-spacing:.05em;touch-action:none;user-select:none;cursor:grab;z-index:2}\n #${PANEL} .head{display:grid;grid-template-columns:1fr 20px 20px;gap:1px;align-items:center;touch-action:none;user-select:none}
 #${PANEL} .title{font-weight:950;font-size:7.6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:grab}
 #${PANEL} .body{max-height:calc(34vh - 23px);overflow:auto;padding-right:1px}
 #${PANEL} label{display:block;margin-top:2px;font-size:6.4px;color:#b9d8e8}
 #${PANEL} textarea{width:100%;height:34px;resize:vertical;margin-top:1px;padding:2px;border:1px solid #35576b;border-radius:5px;background:#0b1d28;color:#fff;font:6.7px/1.15 system-ui}
 #${PANEL} input,#${PANEL} select{width:100%;height:22px;padding:1px 2px;border:1px solid #35576b;border-radius:5px;background:#0b1d28;color:#fff;font-size:7px}
 #${PANEL} .amount{display:grid;grid-template-columns:43px 1fr;gap:2px;margin-top:1px}.choices{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;margin-top:1px}#${PANEL} .special-tags{grid-template-columns:1fr 1fr}#${PANEL} .special-tags button{font-size:5.8px}
 #${PANEL} button{min-height:22px;border:1px solid #3b6378;border-radius:5px;background:#102b3b;color:#eaf9ff;font-weight:850;font-size:6.8px;touch-action:manipulation;pointer-events:auto;padding:1px 2px}
 #${PANEL} .choices button.on{background:#145c73;border-color:#63d7f1;color:#fff}
 #${PANEL} .hint{margin-top:2px;font-size:6.1px;color:#91b5c8;line-height:1.18}
 #${PANEL} .phase{display:grid;grid-template-columns:1fr 1fr;gap:2px;margin-top:2px}
 #${PANEL} [data-a="images"],#${PANEL} [data-a="special-images"],#${PANEL} [data-a="workmom-images"],#${PANEL} [data-a="parenting-images"]{background:#0b6176;border-color:#64d8ef}
 #${PANEL} [data-a="cards"]{background:#34518a;border-color:#7897df}
 #${PANEL} .tools{display:grid;grid-template-columns:1fr 1fr;gap:2px;margin-top:2px}#${PANEL} [data-a="delete"]{background:#5d1b25;border-color:#b95b68}#${PANEL} [data-a="reset"]{background:#4a3514;border-color:#a9833e}
 #${PANEL} details{margin-top:2px;border:1px solid #29485b;border-radius:5px;background:#091923;padding:2px}
 #${PANEL} summary{cursor:pointer;font-weight:900;font-size:6.8px;color:#dff6ff;list-style:none}#${PANEL} summary::-webkit-details-marker{display:none}
 #${PANEL} .special-actions{display:grid;grid-template-columns:1fr 1fr;gap:2px;margin-top:2px}
 #${STATUS}{margin-top:2px;padding-top:2px;border-top:1px solid #284555;font-size:6.2px;color:#bfe8ff;word-break:break-word}#${STATUS}[data-bad="1"]{color:#ffb8b8}
 #${PANEL}-mini{position:fixed;right:7px;top:80px;z-index:2147483647;width:30px;height:30px;border:1px solid #5fd4ee;border-radius:50%;background:#082333;color:#fff;font:950 7px system-ui;display:none;align-items:center;justify-content:center;box-shadow:0 5px 16px #0008;touch-action:none;user-select:none}
 </style>
 <div class="head"><div class="title">紹介貼付 v${VERSION}</div><button data-ui="collapse">－</button><button data-ui="tiny">×</button></div>
 <div class="body">
  <label>URL / マガジン / #（上から優先）</label>
  <textarea data-sources placeholder="記事URL&#10;マガジンURL&#10;#タグ">${escAttr(g.sources||'')}</textarea>
  <div class="amount"><select data-mode><option value="number">件数</option><option value="all">全数</option></select><input data-count type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" value="${Number(g.count??10)}"></div>
  <div class="choices"><button data-choice="oldest">最初</button><button data-choice="fixed">固定→最新</button><button data-choice="latest">最新</button></div>
  <div class="hint">指定件数＋最後に「実績の算数」1件（件数外）</div>

  <div class="phase"><button data-a="images">①画像一覧</button><button data-a="cards">②ここからカード</button></div>

  <details data-special>
   <summary>＋ 特別案件：初投稿者</summary>
   <div class="hint">タグは個別ON/OFF。両方ON＝2タグを混ぜて公開日時の最新順 → 公開記事1件のみ → NG記事除外</div>
   <div class="choices special-tags"><button data-special-tag="はじめてのnote">#はじめてのnote</button><button data-special-tag="初めてのnote">#初めてのnote</button></div>
   <div class="amount"><select data-special-mode><option value="number">件数</option><option value="all">全数</option></select><input data-special-count type="text" inputmode="numeric" pattern="[0-9]*" value="${Number(g.specialCount??100)}"></div>
   <button data-a="special-images" style="width:100%;margin-top:3px">① 初投稿者画像一覧</button>
   <div class="special-actions"><button data-a="commit-excluded">成功分→除外</button><button data-a="clear-excluded"><span data-excluded-count>除外 0件</span> 解除</button></div>
  </details>

  <details data-workmom>
   <summary>＋ 案件：#ワーママ</summary>
   <div class="hint">新着→タグ実在＋本文文脈確認。疑わしいもの・NG除外。投稿数制限なし。</div>
   <div class="amount"><select data-workmom-mode><option value="number">件数</option><option value="all">全数</option></select><input data-workmom-count type="text" inputmode="numeric" pattern="[0-9]*" value="${Number(g.workmomCount??100)}"></div>
   <button data-a="workmom-images" style="width:100%;margin-top:2px">① #ワーママ</button>
  </details>

  <details data-parenting>
   <summary>＋ 案件：#育児日記</summary>
   <div class="hint">新着→#育児日記の実在＋育児文脈を確認。NG検閲あり。健全な副業は可。投稿数制限なし。</div>
   <div class="amount"><select data-parenting-mode><option value="number">件数</option><option value="all">全数</option></select><input data-parenting-count type="text" inputmode="numeric" pattern="[0-9]*" value="${Number(g.parentingCount??100)}"></div>
   <button data-a="parenting-images" style="width:100%;margin-top:2px">① #育児日記</button>
  </details>

  <div class="tools"><button data-a="delete">通知カード削除</button><button data-a="reset">最初に戻る</button></div>
  <button data-a="stop" style="width:100%;margin-top:3px">停止</button>
  <div id="${STATUS}">①画像一覧は自動。②は本文で置く場所をタップしてから押す。</div>
 </div>`;
 const mini=document.createElement('button');mini.id=PANEL+'-mini';mini.type='button';mini.textContent='紹介';
 document.body.append(p,mini);

 const choice=['oldest','fixed','latest'].includes(g.choice)?g.choice:'latest';
 p.querySelector('[data-choice="'+choice+'"]').classList.add('on');
 p.querySelector('[data-mode]').value=g.mode==='all'?'all':'number';
 p.querySelector('[data-special-mode]').value=g.specialMode==='all'?'all':'number';
 p.querySelector('[data-workmom-mode]').value=g.workmomMode==='all'?'all':'number';
 p.querySelector('[data-parenting-mode]').value=g.parentingMode==='all'?'all':'number';
 const savedSpecialTags=Array.isArray(g.specialTags)?g.specialTags:FIRST_TAGS;
 p.querySelectorAll('button[data-special-tag]').forEach(x=>x.classList.toggle('on',savedSpecialTags.includes(x.dataset.specialTag)));
 applyAmountMode();applySpecialAmountMode();applyWorkmomAmountMode();applyParentingAmountMode();updateExcludedCount();

 p.querySelectorAll('button[data-choice]').forEach(btn=>btn.addEventListener('click',e=>{
  e.preventDefault();e.stopPropagation();
  p.querySelectorAll('button[data-choice]').forEach(x=>x.classList.remove('on'));btn.classList.add('on');saveUiState({choice:btn.dataset.choice})
 }));
 p.querySelector('[data-mode]').addEventListener('change',()=>{applyAmountMode();saveUiState()});
 p.querySelector('[data-special-mode]').addEventListener('change',()=>{applySpecialAmountMode();saveUiState()});
 p.querySelector('[data-workmom-mode]').addEventListener('change',()=>{applyWorkmomAmountMode();saveUiState()});
 p.querySelector('[data-parenting-mode]').addEventListener('change',()=>{applyParentingAmountMode();saveUiState()});
 p.querySelectorAll('button[data-special-tag]').forEach(btn=>btn.addEventListener('click',e=>{
  e.preventDefault();e.stopPropagation();
  btn.classList.toggle('on');
  const on=[...p.querySelectorAll('button[data-special-tag].on')];
  if(!on.length){btn.classList.add('on');setStatus('初投稿タグは最低1つ選んでください',true);return}
  saveUiState({specialTags:on.map(x=>x.dataset.specialTag)})
 }));

 const formControls=p.querySelectorAll('textarea,input,select,button,summary');
 formControls.forEach(x=>{
  x.addEventListener('pointerdown',e=>{e.stopPropagation()});
  x.addEventListener('touchstart',e=>{e.stopPropagation()},{passive:true})
 });
 p.querySelectorAll('textarea,input').forEach(x=>{
  x.addEventListener('focus',e=>e.stopPropagation());
  x.addEventListener('click',e=>e.stopPropagation());
  x.addEventListener('change',()=>saveUiState())
 });
 for(const sel of ['[data-count]','[data-special-count]','[data-workmom-count]','[data-parenting-count]']){
  const el=p.querySelector(sel);
  el?.addEventListener('input',()=>{const d=String(el.value||'').replace(/\D+/g,'').slice(0,4);if(el.value!==d)el.value=d})
 }

 p.querySelector('[data-ui="collapse"]').addEventListener('click',e=>{e.preventDefault();setCollapsed(!p.classList.contains('collapsed'))});
 p.querySelector('[data-ui="tiny"]').addEventListener('click',e=>{e.preventDefault();setTiny(true)});
 p.querySelector('[data-a="images"]').addEventListener('click',e=>{e.preventDefault();void createImageList({special:false,workmom:false,parenting:false})});
 p.querySelector('[data-a="special-images"]').addEventListener('click',e=>{e.preventDefault();void createImageList({special:true,workmom:false,parenting:false})});
 p.querySelector('[data-a="workmom-images"]').addEventListener('click',e=>{e.preventDefault();void createImageList({special:false,workmom:true,parenting:false})});
 p.querySelector('[data-a="parenting-images"]').addEventListener('click',e=>{e.preventDefault();void createImageList({special:false,workmom:false,parenting:true})});
 p.querySelector('[data-a="cards"]').addEventListener('click',e=>{e.preventDefault();void createCardsAtTap()});
 p.querySelector('[data-a="commit-excluded"]').addEventListener('click',e=>{e.preventDefault();commitSpecialLast()});
 p.querySelector('[data-a="clear-excluded"]').addEventListener('click',e=>{e.preventDefault();clearSpecialExcluded()});
 p.querySelector('[data-a="delete"]').addEventListener('click',e=>{e.preventDefault();void bulkDelete()});
 p.querySelector('[data-a="reset"]').addEventListener('click',e=>{e.preventDefault();void resetAll()});
 p.querySelector('[data-a="stop"]').addEventListener('click',e=>{e.preventDefault();stop()});

 mini.addEventListener('click',e=>{if(dragging||Date.now()<suppressClickUntil){e.preventDefault();return}e.preventDefault();setTiny(false)});
 bindDirectDrag(p.querySelector('[data-dragbar]'),p);bindLongDrag(p.querySelector('.title'),p);bindLongDrag(mini,mini);restorePos(p);
 if(g.collapsed)p.classList.add('collapsed');if(g.tiny){p.classList.add('tiny');mini.style.display='flex'}update()
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();