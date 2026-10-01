// ==UserScript==
// @name         無名S note アイコン＋キャプション 貼り付け装置
// @namespace    https://github.com/mumei-s/note-insight/profile-card-paster
// @version      1.5.0
// @description  常用版。画像一覧を自動作成後、任意位置から正規通知カード一覧を作成。初投稿者特別案件・成功確定式重複除外に対応。
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

const VERSION='1.5.0';
const PANEL='mumei-profile-card-paster-v1';
const STATUS='mumei-profile-card-paster-status-v1';
const PREF='mumei_profile_card_paster_v1';
const POS='mumei_profile_card_paster_pos_v1';
const RUN_PREFIX='mumei_profile_card_paster_run_v15:';
const SPECIAL_LAST='mumei_profile_card_paster_special_last_v15';
const SPECIAL_EXCLUDED='mumei_profile_card_paster_special_excluded_v15';
const FIRST_TAGS=['はじめてのnote','初めてのnote'];
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
  creators:new Set(arr.map(x=>String(x?.urlname||'').toLowerCase()).filter(Boolean))
 }
}
function specialBlockedReason(text){
 const t=String(text||'');
 for(const rule of SPECIAL_NG)if(rule.re.test(t))return rule.label;
 return''
}
async function creatorSinglePublicArticle(row){
 if(!row?.urlname)return false;
 try{
  const p=await creatorContents(row.urlname,1,true);
  const d=p?.data&&typeof p.data==='object'?p.data:{};
  const list=contentList(p);
  const totalRaw=d.totalCount??d.total_count??d.count??d.noteCount??d.note_count;
  if(totalRaw!==undefined&&totalRaw!==null&&String(totalRaw)!==''){
   const total=Number(totalRaw);
   if(Number.isFinite(total)&&total!==1)return false
  }else{
   if(list.length!==1)return false;
   const p2=await creatorContents(row.urlname,2,true);
   if(contentList(p2).length)return false
  }
  const only=articleFromRaw(list[0],{});
  return Boolean(only&&noteKey(only.url)===noteKey(row.url))
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
async function collectFirstNoteSpecial(mode,count){
 const limit=targetLimit(mode,count);
 if(limit===0)return[];
 const excluded=specialExcludedSets();
 const states=FIRST_TAGS.map(tag=>({tag,cursor:'0',done:false,page:0}));
 const candidates=new Map(),tested=new Set(),out=[];
 let rounds=0;
 while(out.length<limit&&states.some(x=>!x.done)&&rounds++<250){
  for(const st of states){
   if(st.done)continue;
   st.page++;
   setStatus('特別案件｜#'+st.tag+' 新着 '+st.page+'ページ｜採用 '+out.length+(mode==='all'?' / 全数':' / '+limit));
   const p=await xhrJSON('https://note.com/api/v3/searches?context=note&q='+encodeURIComponent(st.tag)+'&size=20&start='+encodeURIComponent(st.cursor)+'&sort=new');
   const q=normalizeSearch(p);
   if(!q.arr.length){st.done=true;continue}
   for(const raw of q.arr){
    const row=articleFromRaw(raw,{});
    if(!row)continue;
    const u=norm(row.url);
    if(!u||u===norm(FINAL_URL))continue;
    const prev=candidates.get(u);
    if(!prev)candidates.set(u,row)
   }
   if(q.last||q.cursor==null||String(q.cursor)===String(st.cursor))st.done=true;
   else st.cursor=String(q.cursor);
   await sleep(80)
  }
  const ordered=[...candidates.values()]
    .filter(row=>!tested.has(norm(row.url)))
    .sort((a,b)=>new Date(b.publishAt||0).getTime()-new Date(a.publishAt||0).getTime());
  for(const row of ordered){
   if(out.length>=limit)break;
   const u=norm(row.url),creator=String(row.urlname||'').toLowerCase();
   tested.add(u);
   if(excluded.urls.has(u)||excluded.creators.has(creator))continue;
   setStatus('特別案件｜初投稿確認 '+(tested.size)+'件目｜採用 '+out.length+(mode==='all'?' / 全数':' / '+limit));
   if(!(await creatorSinglePublicArticle(row)))continue;
   const text=await specialArticleText(row);
   const reason=specialBlockedReason(text);
   if(reason)continue;
   out.push({...row,specialFirstNote:true});
   await sleep(120)
  }
 }
 return out
}
function saveSpecialLast(rows){
 const list=(rows||[]).filter(x=>x?.specialFirstNote).map(x=>({url:norm(x.url),urlname:String(x.urlname||''),creator:String(x.creator||''),key:String(x.key||''),at:Date.now()}));
 writeJSONKey(SPECIAL_LAST,{at:Date.now(),count:list.length,items:list,committed:false})
}
function commitSpecialLast(){
 const last=readJSONKey(SPECIAL_LAST,null);
 const items=Array.isArray(last?.items)?last.items:[];
 if(!items.length){setStatus('前回の特別案件成功候補がありません',true);return}
 const current=specialExcluded(),seen=new Set(current.map(x=>norm(x.url)+'|'+String(x.urlname||'').toLowerCase()));
 let added=0;
 for(const item of items){
  const k=norm(item.url)+'|'+String(item.urlname||'').toLowerCase();
  if(seen.has(k))continue;
  seen.add(k);current.push({...item,confirmedAt:Date.now()});added++
 }
 writeJSONKey(SPECIAL_EXCLUDED,current);
 writeJSONKey(SPECIAL_LAST,{...last,committed:true,committedAt:Date.now()});
 updateExcludedCount();
 setStatus('前回成功分 '+added+'件を次回以降の除外対象へ登録しました ✅')
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
async function buildRows(input,special=false){
 const raw=special?await collectFirstNoteSpecial(input.mode,input.count):await collectUnified(input.sources,input.mode,input.count,input.choice);
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
 return new page.File([blob],'mumei_profile_note_v13_'+String(row.index).padStart(3,'0')+'.png',{type:'image/png'})
}
async function uploadOne(view,row,file){
 ensureEndSelection(view);
 const before=new Set(imageNodes(view).map(h=>String(h.node.attrs?.id||'')).filter(Boolean));
 const dt=new page.DataTransfer();dt.items.add(file);const pos=view.state.selection.from;
 if(nativeImageCommand()(view,dt.files,Math.max(0,pos-1),'image')!==true)throw new Error(row.index+'番 画像アップロードを開始できません');
 const hit=await waitNewNoteImage(view,before,150000);
 const linked=relinkCaption(view,hit,row);
 ensureEndSelection(view);
 return linked
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
 if(!readRun())return{images:0,cards:0};
 return{images:resolveOwnedImageHits(view).length,cards:resolveOwnedCardHits(view).length}
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
 const cards=resolveOwnedCardHits(view),images=resolveOwnedImageHits(view);
 const removedCards=cards.length,removedImages=images.length;
 deleteHits(view,[...cards,...images]);
 writeRun(null);
 if(save&&(removedCards||removedImages))await saveOnce('最初に戻る｜通知'+removedCards+'・画像'+removedImages+'を削除して保存中…');
 return{removedCards,removedImages}
}

function inputValues(save=true){
 const p=document.getElementById(PANEL),g=getPrefs();if(!p)return g;
 const sources=String(p.querySelector('[data-sources]')?.value||'').trim();
 const mode=p.querySelector('[data-mode]')?.value==='all'?'all':'number';
 const count=Math.max(0,Math.min(5000,Number(p.querySelector('[data-count]')?.value||0)));
 const choice=p.querySelector('button[data-choice].on')?.dataset.choice||g.choice||'latest';
 const specialMode=p.querySelector('[data-special-mode]')?.value==='all'?'all':'number';
 const specialCount=Math.max(1,Math.min(1000,Number(p.querySelector('[data-special-count]')?.value||g.specialCount||100)));
 const v={sources,mode,count,choice,specialMode,specialCount,collapsed:Boolean(g.collapsed),tiny:Boolean(g.tiny)};
 if(save)setPrefs(v);return v
}
function choiceLabel(c){return c==='oldest'?'最初の記事':c==='fixed'?'固定→最新':'最新記事'}
function amountLabel(mode,count){return mode==='all'?'全数':String(count)+'件'}
async function createImageList({special=false}={}){
 if(busy)return;busy=true;stopRequested=false;update();
 try{
  const input=inputValues();
  if(!special){
   const sources=parseUnifiedSources(input.sources);
   if(!sources.length)throw new Error('記事URL・マガジンURL・#タグを1つ以上入れてください');
   if(input.mode==='number'&&input.count<=0)throw new Error('件数を1以上にするか「全数」を選んでください');
  }
  const view=findView();if(!view)throw new Error('note本文編集欄を取得できません');
  nativeImageCommand();noteUrlCommandFactory();selectionApi();

  const leftover=trackedContentCount(view);
  if(leftover.images||leftover.cards){
   throw new Error('このページに今回作成分が残っています。「正規通知カード一括削除」または「最初に戻る」で整理してから新規実行してください')
  }

  const effective=special
   ?{...input,mode:input.specialMode,count:input.specialCount}
   :input;

  const rows=await buildRows(effective,special);
  if(!rows.length)throw new Error('貼り付け対象が0件です');

  // 指定件数は実績の算数を含まない。buildRows が最後に +1件する。
  const requestedCount=special?(input.specialMode==='all'?null:input.specialCount):(input.mode==='all'?null:input.count);
  writeRun({
   version:VERSION,articleKey:editorArticleKey(),items:[],cardKeys:[],rows,
   cardBaselineKeys:embedNodes(view).map(cardKey).filter(Boolean),
   createdAt:Date.now(),stage:'images_building',special:Boolean(special),
   sources:special?FIRST_TAGS.map(x=>'#'+x).join(' '):input.sources,
   mode:effective.mode,count:requestedCount,choice:input.choice
  });

  setStatus((special?'特別案件':'通常')+'｜①画像一覧 '+rows.length+'件（指定'+(requestedCount??'全数')+'＋実績の算数1件）を作成');
  for(let i=0;i<rows.length;i++){
   if(stopRequested)throw new Error('手動停止');
   const row=rows[i];
   setStatus('① 画像🔗＋名前キャプション '+(i+1)+'/'+rows.length+'｜'+row.creator);
   const file=await makeFile(row);
   const imageHit=await uploadOne(view,row,file);
   recordImage(imageHit,row);
   await sleep(1200)
  }

  const runNow=readRun()||{};
  writeRun({...runNow,stage:'images_ready',rows,imagesCompletedAt:Date.now(),updatedAt:Date.now()});
  if(special)saveSpecialLast(rows);
  await saveOnce('① 画像🔗＋名前キャプション '+rows.length+'/'+rows.length+' 完了｜保存中…');
  setStatus('①画像一覧 完了 ✅ '+rows.length+'件｜カードを置く位置を本文でタップ →「②ここから通知カード」')
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
  writeRun({...run,stage:'cards_building',cardAnchorPos:insertPos,cardKeys:[],updatedAt:Date.now()});
  setStatus('② 正規通知カード開始｜タップ位置から '+rows.length+'件');

  for(let i=0;i<rows.length;i++){
   if(stopRequested)throw new Error('手動停止');
   const row=rows[i];
   setStatus('② 正規通知カード '+(i+1)+'/'+rows.length+'｜'+row.creator);
   const made=await createNativeCard(view,row,insertPos);
   insertPos=made.nextPos;
   await sleep(3000);
   if((i+1)%10===0&&i+1<rows.length){
    setStatus('② 正規通知カード '+(i+1)+'/'+rows.length+'｜403回避 30秒休止');
    await sleep(30000)
   }
  }
  const done=readRun()||{};
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
 p.querySelectorAll('button[data-choice]').forEach(x=>x.classList.toggle('on',x.dataset.choice==='latest'));
 applyAmountMode();applySpecialAmountMode()
}
async function resetAll(){
 if(busy)return;
 if(!page.confirm('今回作った紹介画像＋正規通知カードを削除し、入力・件数・途中記録を最初に戻します。元本文・元画像・元カードは残します。実行しますか？'))return;
 busy=true;stopRequested=true;update();
 try{
  const result=await deleteAllGenerated({save:false});
  localStorage.removeItem(PREF);writeRun(null);resetFields();
  if(result.removedCards||result.removedImages)await saveOnce('最初に戻る｜通知'+result.removedCards+'・画像'+result.removedImages+'を削除して保存中…');
  setStatus('最初に戻しました ✅ 今回画像 '+result.removedImages+' / 通知カード '+result.removedCards+' を削除｜元本文は保持')
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
 const end=e=>{clear();if(dragging){e.preventDefault();savePos(panel);suppressClickUntil=Date.now()+650}dragging=false;pid=null};
 handle.addEventListener('pointerup',end);handle.addEventListener('pointercancel',end)
}
function escAttr(v){return String(v||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;')}
function mount(){
 if(!document.body||document.getElementById(PANEL))return;
 const g=getPrefs(),p=document.createElement('div');p.id=PANEL;
 p.innerHTML=`
 <style>
 #${PANEL}{position:fixed;right:5px;top:66px;z-index:2147483647;width:min(228px,calc(100vw - 10px));padding:5px;border:1px solid #365b70;border-radius:10px;background:#07131d;color:#edf8ff;box-shadow:0 7px 20px #0008;font:9px/1.25 system-ui;max-height:48vh}
 #${PANEL}.tiny{display:none}#${PANEL}.collapsed .body{display:none}#${PANEL}.collapsed{width:154px;padding:4px}
 #${PANEL} .head{display:grid;grid-template-columns:1fr 25px 25px;gap:2px;align-items:center;touch-action:none;user-select:none}
 #${PANEL} .title{font-weight:950;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:grab}
 #${PANEL} .body{max-height:calc(48vh - 30px);overflow:auto;padding-right:1px}
 #${PANEL} label{display:block;margin-top:4px;font-size:8px;color:#b9d8e8}
 #${PANEL} textarea{width:100%;height:48px;resize:vertical;margin-top:2px;padding:4px;border:1px solid #35576b;border-radius:6px;background:#0b1d28;color:#fff;font:8.5px/1.25 system-ui}
 #${PANEL} input,#${PANEL} select{width:100%;height:26px;padding:2px 4px;border:1px solid #35576b;border-radius:6px;background:#0b1d28;color:#fff;font-size:9px}
 #${PANEL} .amount{display:grid;grid-template-columns:67px 1fr;gap:3px;margin-top:2px}.choices{display:grid;grid-template-columns:repeat(3,1fr);gap:2px;margin-top:2px}
 #${PANEL} button{min-height:25px;border:1px solid #3b6378;border-radius:6px;background:#102b3b;color:#eaf9ff;font-weight:850;font-size:8.5px;touch-action:manipulation;pointer-events:auto;padding:2px 3px}
 #${PANEL} .choices button.on{background:#145c73;border-color:#63d7f1;color:#fff}
 #${PANEL} .hint{margin-top:2px;font-size:7.5px;color:#91b5c8;line-height:1.25}
 #${PANEL} .phase{display:grid;grid-template-columns:1fr 1fr;gap:3px;margin-top:4px}
 #${PANEL} [data-a="images"],#${PANEL} [data-a="special-images"]{background:#0b6176;border-color:#64d8ef}
 #${PANEL} [data-a="cards"]{background:#34518a;border-color:#7897df}
 #${PANEL} .tools{display:grid;grid-template-columns:1fr 1fr;gap:3px;margin-top:3px}#${PANEL} [data-a="delete"]{background:#5d1b25;border-color:#b95b68}#${PANEL} [data-a="reset"]{background:#4a3514;border-color:#a9833e}
 #${PANEL} details{margin-top:4px;border:1px solid #29485b;border-radius:6px;background:#091923;padding:3px}
 #${PANEL} summary{cursor:pointer;font-weight:900;font-size:8.5px;color:#dff6ff;list-style:none}#${PANEL} summary::-webkit-details-marker{display:none}
 #${PANEL} .special-actions{display:grid;grid-template-columns:1fr 1fr;gap:3px;margin-top:3px}
 #${STATUS}{margin-top:4px;padding-top:4px;border-top:1px solid #284555;font-size:7.8px;color:#bfe8ff;word-break:break-word}#${STATUS}[data-bad="1"]{color:#ffb8b8}
 #${PANEL}-mini{position:fixed;right:7px;top:80px;z-index:2147483647;width:36px;height:36px;border:1px solid #5fd4ee;border-radius:50%;background:#082333;color:#fff;font:950 9px system-ui;display:none;align-items:center;justify-content:center;box-shadow:0 5px 16px #0008;touch-action:none;user-select:none}
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
   <div class="hint">#はじめてのnote / #初めてのnote の新着 → 公開記事1件のみ → NG記事除外</div>
   <div class="amount"><select data-special-mode><option value="number">件数</option><option value="all">全数</option></select><input data-special-count type="text" inputmode="numeric" pattern="[0-9]*" value="${Number(g.specialCount??100)}"></div>
   <button data-a="special-images" style="width:100%;margin-top:3px">① 初投稿者画像一覧</button>
   <div class="special-actions"><button data-a="commit-excluded">前回成功→除外</button><button data-a="clear-excluded"><span data-excluded-count>除外 0件</span> 解除</button></div>
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
 applyAmountMode();applySpecialAmountMode();updateExcludedCount();

 p.querySelectorAll('button[data-choice]').forEach(btn=>btn.addEventListener('click',e=>{
  e.preventDefault();e.stopPropagation();
  p.querySelectorAll('button[data-choice]').forEach(x=>x.classList.remove('on'));btn.classList.add('on');saveUiState({choice:btn.dataset.choice})
 }));
 p.querySelector('[data-mode]').addEventListener('change',()=>{applyAmountMode();saveUiState()});
 p.querySelector('[data-special-mode]').addEventListener('change',()=>{applySpecialAmountMode();saveUiState()});

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
 for(const sel of ['[data-count]','[data-special-count]']){
  const el=p.querySelector(sel);
  el?.addEventListener('input',()=>{const d=String(el.value||'').replace(/\D+/g,'').slice(0,4);if(el.value!==d)el.value=d})
 }

 p.querySelector('[data-ui="collapse"]').addEventListener('click',e=>{e.preventDefault();setCollapsed(!p.classList.contains('collapsed'))});
 p.querySelector('[data-ui="tiny"]').addEventListener('click',e=>{e.preventDefault();setTiny(true)});
 p.querySelector('[data-a="images"]').addEventListener('click',e=>{e.preventDefault();void createImageList({special:false})});
 p.querySelector('[data-a="special-images"]').addEventListener('click',e=>{e.preventDefault();void createImageList({special:true})});
 p.querySelector('[data-a="cards"]').addEventListener('click',e=>{e.preventDefault();void createCardsAtTap()});
 p.querySelector('[data-a="commit-excluded"]').addEventListener('click',e=>{e.preventDefault();commitSpecialLast()});
 p.querySelector('[data-a="clear-excluded"]').addEventListener('click',e=>{e.preventDefault();clearSpecialExcluded()});
 p.querySelector('[data-a="delete"]').addEventListener('click',e=>{e.preventDefault();void bulkDelete()});
 p.querySelector('[data-a="reset"]').addEventListener('click',e=>{e.preventDefault();void resetAll()});
 p.querySelector('[data-a="stop"]').addEventListener('click',e=>{e.preventDefault();stop()});

 mini.addEventListener('click',e=>{if(dragging||Date.now()<suppressClickUntil){e.preventDefault();return}e.preventDefault();setTiny(false)});
 bindLongDrag(p.querySelector('.title'),p);bindLongDrag(mini,mini);restorePos(p);
 if(g.collapsed)p.classList.add('collapsed');if(g.tiny){p.classList.add('tiny');mini.style.display='flex'}update()
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();