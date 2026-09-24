(function(){
'use strict';
const page=typeof unsafeWindow!=='undefined'?unsafeWindow:window;
if(page.__MUMEI_LIVE_REBUILD_V1__)return;
page.__MUMEI_LIVE_REBUILD_V1__=true;

const VERSION='18.9.8';
const PANEL='mumei-note-source-picker-v163';
const STATUS='mumei-note-source-status-v163';
const DATA_KEY='mumei_likers_thin_dataset_v160';
const RUN_PREFIX='mumei_likers_thin_run_v160';
const MANIFEST='https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-live-batch/manifest.json';
const META='https://raw.githubusercontent.com/mumei-s/note-insight/main/data/note-live-batch-live.json';
const RAW_BASE='https://raw.githubusercontent.com/mumei-s/note-insight/main/public';
const FINAL='https://note.com/fuku444/n/nb4f6934381e9';

let busy=false,viewCache=null,coreCache=null,noteUrlCommand=null,resumeTimer=null,wakeLock=null;
async function keepAwake(){
  if(!page.navigator?.wakeLock?.request||document.hidden)return false;
  try{
    if(wakeLock&&!wakeLock.released)return true;
    wakeLock=await page.navigator.wakeLock.request('screen');
    wakeLock.addEventListener?.('release',()=>{wakeLock=null},{once:true});
    return true;
  }catch(_){return false}
}
async function releaseAwake(){try{await wakeLock?.release?.()}catch(_){}wakeLock=null;}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
class FatalError extends Error{}
const safety=()=>{if(!page.__MUMEI_CARD_SAFETY__)throw new FatalError('本文保護機能を読み込めません');return page.__MUMEI_CARD_SAFETY__;};
const articleKey=()=>location.pathname.match(/^\/notes\/(n[a-z0-9]{8,})\/edit\/?$/i)?.[1]||'';
const runKey=()=>RUN_PREFIX+':'+articleKey();
const stageDataKey=()=>`mumei_live_stage_dataset_v1:${articleKey()}`;
const stageRunKey=()=>`mumei_live_stage_run_v1:${articleKey()}`;
const overnightKey=()=>`mumei_live_overnight_v1:${articleKey()}`;
const read=(k,f=null)=>{try{return JSON.parse(localStorage.getItem(k)||'null')??f}catch(_){return f}};
const write=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const normalize=value=>{try{const u=new URL(String(value||''),location.href);u.search='';u.hash='';return u.href}catch(_){return String(value||'')}};
function setStatus(text,bad=false){const e=document.getElementById(STATUS);if(e){e.textContent=text;e.dataset.bad=bad?'1':'0';}safety().status(text,bad);}
function enabled(){return Boolean(articleKey());}

function webpackRequire(){
  const chunks=page.webpackChunk_N_E;
  if(!chunks||typeof chunks.push!=='function')return null;
  let req=null;const id=994000000+Math.floor(Math.random()*1000000);
  try{chunks.push([[id],{},r=>{req=r}]);}catch(_){}
  return req;
}
function selectionAtEnd(view){
  const current=view?.state?.selection?.constructor;
  if(typeof current?.atEnd==='function')return current.atEnd(view.state.doc);
  const req=webpackRequire();let api;
  try{api=req?.(35130)?.sW}catch(_){}
  if(typeof api?.atEnd==='function')return api.atEnd(view.state.doc);
  if(typeof current?.near==='function')return current.near(view.state.doc.resolve(view.state.doc.content.size));
  throw new FatalError('note末尾位置を取得できません');
}
function looksLikeView(value){
  try{return Boolean(value&&typeof value==='object'&&value.state?.doc&&value.state?.schema&&typeof value.dispatch==='function'&&value.dom&&typeof value.posAtDOM==='function');}catch(_){return false}
}
function findView(){
  if(looksLikeView(viewCache)&&viewCache.dom?.isConnected)return safety().attach(viewCache);
  const root=document.querySelector('.ProseMirror[contenteditable="true"]')||document.querySelector('.ProseMirror');
  if(!root)return null;
  const seen=new Set(),queue=[];let seed=root;
  for(let i=0;i<6&&seed;i++,seed=seed.parentElement)queue.push([seed,0]);
  let steps=0;
  while(queue.length&&steps++<14000){
    const [value,depth]=queue.shift();
    if(!value||seen.has(value))continue;seen.add(value);
    if(looksLikeView(value))return safety().attach(viewCache=value);
    let keys=[];try{keys=Object.getOwnPropertyNames(value)}catch(_){continue}
    for(const key of keys){
      if(['window','document','ownerDocument','parentNode','children','childNodes','style'].includes(key))continue;
      let next;try{next=value[key]}catch(_){continue}
      if(looksLikeView(next))return safety().attach(viewCache=next);
      if(depth<7&&next&&(typeof next==='object'||typeof next==='function')&&next!==page&&next!==document)queue.push([next,depth+1]);
    }
  }
  return null;
}
function core(){
  if(coreCache)return coreCache;
  const req=webpackRequire();if(!req)throw new FatalError('note保存処理を取得できません');
  let schemaModule,htmlModule;
  try{schemaModule=req(35130)}catch(_){}
  try{htmlModule=req(51910)}catch(_){}
  const serialize=schemaModule?.BF,normalizeDOM=htmlModule?.zc,cleanHTML=htmlModule?.jF;
  if(typeof serialize!=='function'||typeof normalizeDOM!=='function'||typeof cleanHTML!=='function')throw new FatalError('note保存HTML検証処理を取得できません');
  return coreCache={serialize,normalizeDOM,cleanHTML};
}
function serializedHtml(view){
  const c=core(),fragment=c.serialize(view.state),holder=document.createElement('div');
  holder.appendChild(fragment);c.normalizeDOM(holder);return c.cleanHTML(holder.innerHTML);
}
function parseSavedDraft(note){
  const req=webpackRequire();if(!req)throw new FatalError('下書き解析処理を取得できません');
  const schema=req(35130)?.fK,parser=req(9119)?.aw,helpers=req(51910),hydrate=req(94928)?.thC;
  if(!schema||!parser?.fromSchema||typeof helpers?.CO!=='function'||typeof helpers?.p6!=='function'||typeof hydrate!=='function')throw new FatalError('下書き解析処理を確認できません');
  const holder=document.createElement('div');holder.innerHTML=note.body;helpers.CO(holder);helpers.p6(holder);
  const embeddedContents=(note.embedded_contents||note.embeddedContents||[]).map(item=>({...item,htmlForEmbed:item.html_for_embed??item.htmlForEmbed}));
  return parser.fromSchema(schema).parse(hydrate(holder,{...note,embeddedContents}));
}
safety().setSerializer(serializedHtml);
safety().setDraftParser(parseSavedDraft);

function requestJSON(url){
  return new Promise((resolve,reject)=>GM_xmlhttpRequest({
    method:'GET',url:url+(url.includes('?')?'&':'?')+'_='+Date.now(),responseType:'text',timeout:120000,
    onload:r=>{try{if(r.status!==200)throw new Error('HTTP '+r.status);resolve(JSON.parse(r.responseText))}catch(e){reject(e)}},
    onerror:()=>reject(new Error('通信失敗')),
    ontimeout:()=>reject(new Error('通信タイムアウト'))
  }));
}
function requestBlob(url){
  return new Promise((resolve,reject)=>GM_xmlhttpRequest({
    method:'GET',url,responseType:'blob',timeout:120000,
    onload:r=>{if(r.status===200&&r.response)resolve(r.response);else reject(new Error('画像取得 HTTP '+r.status))},
    onerror:()=>reject(new Error('画像取得通信失敗')),
    ontimeout:()=>reject(new Error('画像取得タイムアウト'))
  }));
}
function remoteImage(node){
  const src=String(node?.attrs?.src||'');
  return /^https:\/\//i.test(src)&&!src.includes('raw.githubusercontent.com')&&!src.includes('/note-live-batch/cards/');
}
let imageCommandCache=null;
function nativeImageCommand(){
  if(imageCommandCache)return imageCommandCache;
  const req=webpackRequire();let command;
  try{command=req?.(94928)?.CwN}catch(_){}
  const code=typeof command==='function'?Function.prototype.toString.call(command):'';
  if(!(command?.length===4&&/Array\.from/.test(code)&&/imageUploading/.test(code)&&/entries/.test(code)))throw new FatalError('note正規画像処理が見つかりません');
  return imageCommandCache=command;
}
async function waitNewNoteImage(view,beforeIds,timeout=150000){
  const deadline=Date.now()+timeout;
  while(Date.now()<deadline){
    safety().check(view);
    const fresh=imageNodes(view).filter(hit=>{
      const id=String(hit.node.attrs?.id||'');
      return id&&!beforeIds.has(id)&&remoteImage(hit.node);
    }).sort((a,b)=>a.pos-b.pos);
    if(fresh.length===1)return fresh[0];
    if(fresh.length>1)throw new FatalError('新規画像が複数入りました。順序保護のため停止');
    await sleep(400);
  }
  throw new FatalError('note画像アップロード待ちタイムアウト');
}
function relinkCaption(view,hit,row){
  const fresh=safety().tracked(view,hit.node.attrs,row.url)||hit;
  const node=fresh.node;
  if(node.type?.name!=='image'||node.type.spec?.content!=='inline*')throw new FatalError('note画像形式が変わりました');
  const replacement=node.type.create({...node.attrs,link:row.url},view.state.schema.text(row.caption),node.marks);
  view.dispatch(view.state.tr.replaceWith(fresh.pos,fresh.pos+node.nodeSize,replacement));
  const after=safety().index(view).images.find(x=>String(x.node.attrs?.id||'')===String(replacement.attrs?.id||''));
  if(!after||normalize(after.node.attrs?.link)!==normalize(row.url)||after.node.textContent!==row.caption||!remoteImage(after.node))throw new FatalError('極薄の🔗・名前確認に失敗: '+row.index);
  return after;
}
function validate(manifest,meta){
  if(!manifest||!Array.isArray(manifest.items)||!Number.isInteger(manifest.count)||manifest.items.length!==manifest.count)throw new FatalError('最新極薄データの件数が不正です');
  if(!meta||meta.format!=='mumei-live-batch-v2'||meta.count!==manifest.count||!Array.isArray(meta.rows)||meta.rows.length!==manifest.count)throw new FatalError('最新対象一覧の照合に失敗しました');
  const urls=new Set();
  for(let i=0;i<manifest.items.length;i++){
    const a=manifest.items[i],b=meta.rows[i];
    if(a.index!==i+1||b.index!==i+1||normalize(a.url)!==normalize(b.url)||urls.has(normalize(a.url)))throw new FatalError('最新対象一覧の順序・重複を確認できません: '+(i+1));
    if(!/^\/note-live-batch\/cards\/\d{3,4}\.png$/.test(String(a.cardPath||'')))throw new FatalError('極薄画像パス不正: '+(i+1));
    urls.add(normalize(a.url));
  }
  if(normalize(manifest.items.at(-1)?.url)!==FINAL||!meta.rows.at(-1)?.finalMarker)throw new FatalError('最後の実績の算数が一致しません');
  return true;
}
function imageSrc(item){return RAW_BASE+item.cardPath;}
function cardKey(hit){return String(hit?.node?.attrs?.embeddedContentKey||'');}
function cardUrl(hit){return normalize(hit?.node?.attrs?.src);}
function embedNodes(view){return safety().index(view).embeds;}
function imageNodes(view){return safety().index(view).images;}
function genuineCard(hit,url){
  const key=cardKey(hit),html=String(hit?.node?.attrs?.htmlForEmbed||'');
  if(!/^emb[a-z0-9]+$/i.test(key)||!html.includes('note-embed'))return false;
  if(cardUrl(hit)===normalize(url))return true;
  try{
    const src=new URL(cardUrl(hit)),expected=new URL(url);
    const embeddedKey=src.pathname.match(/^\/embed\/notes\/(n[a-f0-9]{12})\/?$/i)?.[1];
    const wanted=expected.pathname.match(/\/n\/(n[a-f0-9]{12})/i)?.[1];
    return src.origin==='https://note.com'&&embeddedKey&&wanted&&embeddedKey===wanted;
  }catch(_){return false}
}
function nativeUrlCommand(){
  if(noteUrlCommand)return noteUrlCommand;
  const req=webpackRequire();if(!req)throw new FatalError('note内部URL処理を取得できません');
  let candidate;try{candidate=req(94928)?.fjT}catch(_){}
  const right=value=>{
    if(typeof value!=='function')return false;
    let source='';try{source=Function.prototype.toString.call(value)}catch(_){}
    return source.includes('state.selection')&&source.includes('nodeBefore')&&source.includes('replaceRangeWith')&&source.includes('.then');
  };
  if(!right(candidate)){
    const loaded=Object.values(req.c||{}).flatMap(entry=>{const exp=entry?.exports;if(typeof exp==='function')return[exp];return exp&&typeof exp==='object'?Object.values(exp):[]});
    candidate=loaded.find(right)||null;
  }
  if(!right(candidate))throw new FatalError('note正規URLカード処理が見つかりません');
  return noteUrlCommand=candidate;
}
function ensureEnd(view){
  const p=view.state.schema.nodes.paragraph;if(!p)throw new FatalError('paragraph nodeなし');
  if(view.state.doc.lastChild?.type!==p||view.state.doc.lastChild.textContent!=='')view.dispatch(view.state.tr.insert(view.state.doc.content.size,p.create()));
  view.dispatch(view.state.tr.setSelection(selectionAtEnd(view)).scrollIntoView());view.focus();
}
function exactUrlParagraphs(view,url){
  const wanted=normalize(url),out=[];
  view.state.doc.forEach((node,pos)=>{if(node.type===view.state.schema.nodes.paragraph&&normalize((node.textContent||'').trim())===wanted)out.push({node,pos})});
  return out;
}
function removeHits(view,hits){if(hits.length)safety().remove(view,hits.sort((a,b)=>b.pos-a.pos));}
function currentRun(){return read(runKey(),null);}
function currentData(){return read(DATA_KEY,null);}

const PARTICIPANT_HEADING='【イケメングランプリ参加者様】';
const TAG_HEADING='#イケメングランプリ宵空カップ';
const LIKE_HEADING='【スキをありがとう(* ᴗ ᴗ)⁾⁾】';
const DIVIDER_FALLBACK='━━━━━━━━━━━━━━━━━━━━━━━━';

function hasExactText(view,text){
  let found=false;
  view.state.doc.descendants(node=>{if(String(node.textContent||'').trim()===text)found=true;});
  return found;
}
function headingNode(view,text){
  const schema=view.state.schema,heading=schema.nodes.heading,content=schema.text(text);
  if(heading){
    for(const attrs of [{level:2},{level:1},null]){
      try{
        const node=typeof heading.createAndFill==='function'?heading.createAndFill(attrs,content):heading.create(attrs,content);
        if(node)return node;
      }catch(_){}
    }
  }
  return schema.nodes.paragraph.create(null,content);
}
function dividerNode(view){
  const schema=view.state.schema;
  for(const name of ['horizontal_rule','horizontalRule','divider','hr']){
    const type=schema.nodes[name];
    if(!type)continue;
    try{
      const node=typeof type.createAndFill==='function'?type.createAndFill():type.create();
      if(node)return node;
    }catch(_){}
  }
  return schema.nodes.paragraph.create(null,schema.text(DIVIDER_FALLBACK));
}
function appendNodes(view,nodes){
  let tr=view.state.tr;
  for(const node of nodes)tr=tr.insert(tr.doc.content.size,node);
  view.dispatch(tr);
}
function trailingDividerCount(view){
  const list=[];
  view.state.doc.forEach(node=>list.push(node));
  let count=0;
  for(let i=list.length-1;i>=0;i--){
    const node=list[i],name=node.type?.name||'',text=String(node.textContent||'').trim();
    if(['horizontal_rule','horizontalRule','divider','hr'].includes(name)||text===DIVIDER_FALLBACK)count++;
    else if(node.type===view.state.schema.nodes.paragraph&&!text)continue;
    else break;
  }
  return count;
}
function ensureParticipantIntro(view){
  const nodes=[];
  if(!hasExactText(view,PARTICIPANT_HEADING))nodes.push(headingNode(view,PARTICIPANT_HEADING));
  if(!hasExactText(view,TAG_HEADING))nodes.push(view.state.schema.nodes.paragraph.create(null,view.state.schema.text(TAG_HEADING)));
  if(nodes.length)appendNodes(view,nodes);
}
async function ensureLikeBoundary(view,run){
  if(hasExactText(view,LIKE_HEADING)){run.likeBoundaryInserted=true;write(stageRunKey(),run);return;}
  appendNodes(view,[dividerNode(view),dividerNode(view),headingNode(view,LIKE_HEADING)]);
  run.likeBoundaryInserted=true;write(stageRunKey(),run);
  await safety().save(view,'スキ見出しと仕切り線を保存確認中…');
}
async function ensureFinalBoundary(view,run){
  if(run.finalBoundaryInserted&&trailingDividerCount(view)>=2)return;
  if(trailingDividerCount(view)<2)appendNodes(view,[dividerNode(view),dividerNode(view)]);
  run.finalBoundaryInserted=true;write(stageRunKey(),run);
  await safety().save(view,'実績の算数前の仕切り線を保存確認中…');
}

function oldOwnedHits(view,oldRun,oldData,newUrls){
  const images=[],cards=[];
  for(const [url,rec] of Object.entries(oldRun?.images||{})){
    const hit=safety().tracked(view,rec,url);if(hit)images.push(hit);
  }
  const knownCardKeys=new Set((oldRun?.cardKeys||[]).map(x=>String(x.key||'')).filter(Boolean));
  for(const hit of embedNodes(view))if(knownCardKeys.has(cardKey(hit)))cards.push(hit);
  const oldUrls=new Set((oldData?.rows||[]).map(x=>normalize(x.url)).filter(Boolean));
  for(const hit of embedNodes(view)){
    const u=cardUrl(hit),key=cardKey(hit);
    if((oldUrls.has(u)||newUrls.has(u))&&knownCardKeys.has(key)&&!cards.some(x=>x.pos===hit.pos))cards.push(hit);
  }
  return {
    images:[...new Map(images.map(x=>[x.pos,x])).values()],
    cards:[...new Map(cards.map(x=>[x.pos,x])).values()]
  };
}
function makeLiveDataset(manifest,meta){
  const datasetId='live-current:'+meta.generatedAt;
  const rows=manifest.items.map((item,i)=>({
    index:i+1,url:item.url,creator:item.creator,title:item.title,key:item.key,
    cardPath:item.cardPath,sourceImage:imageSrc(item),caption:item.creator+'さん',
    urlname:meta.rows[i]?.urlname||'',source:meta.rows[i]?.source||'',finalMarker:Boolean(meta.rows[i]?.finalMarker)
  }));
  return {version:'18.9.8',datasetId,count:rows.length,rows,preparedBatch:false,liveBatch:true,
    extractedAt:meta.generatedAt,sourceMode:'live-current',confirmationUrl:FINAL,
    meta:{tagArticles:meta.tagArticles,likeCounts:meta.likeCounts,rules:meta.rules}};
}
function reconcileStageImages(view,dataset,run){
  const next={};
  for(const row of dataset.rows){
    const rec=run.images?.[row.url];
    const hit=rec&&safety().tracked(view,rec,row.url);
    if(hit&&remoteImage(hit.node)&&normalize(hit.node.attrs?.link)===normalize(row.url)&&hit.node.textContent===row.caption){
      next[row.url]={id:String(hit.node.attrs?.id||''),src:String(hit.node.attrs?.src||''),link:row.url};
    }
  }
  run.images=next;write(stageRunKey(),run);
  return Object.keys(next).length;
}
async function uploadOneThin(view,row,run,dataset){
  ensureEnd(view);
  const before=new Set(imageNodes(view).map(hit=>String(hit.node.attrs?.id||'')).filter(Boolean));
  const blob=await requestBlob(row.sourceImage);
  const file=new page.File([blob],String(row.index).padStart(3,'0')+'_thin.png',{type:'image/png'});
  const transfer=new page.DataTransfer();transfer.items.add(file);
  const pos=view.state.selection.from;
  if(nativeImageCommand()(view,transfer.files,pos-1,'image')!==true)throw new FatalError('note正規画像アップロードを開始できません');
  const hit=await waitNewNoteImage(view,before,150000);
  const linked=relinkCaption(view,hit,row);
  run.images[row.url]={id:String(linked.node.attrs?.id||''),src:String(linked.node.attrs?.src||''),link:row.url};
  run.pendingImage=null;
  write(stageRunKey(),run);
}
async function rebuildImages(autoCards=false){
  if(busy||!enabled())return false;
  busy=true;let token,ok=false,continueCards=false;
  try{
    const view=findView();if(!view)throw new FatalError('編集画面の準備ができていません');
    try{if(safety().networkHold?.())safety().resumeNetwork()}catch(e){throw new FatalError(e.message)}
    token=safety().begin('最新から再構築',view);
    setStatus('最新327件の極薄データを確認中…');
    const [manifest,meta]=await Promise.all([requestJSON(MANIFEST),requestJSON(META)]);
    validate(manifest,meta);
    const dataset=makeLiveDataset(manifest,meta);
    let stagedData=read(stageDataKey(),null),run=read(stageRunKey(),null);
    if(!stagedData||stagedData.datasetId!==dataset.datasetId||!run||run.datasetId!==dataset.datasetId){
      stagedData=dataset;
      run={version:'18.9.8',articleKey:articleKey(),datasetId:dataset.datasetId,stage:'images_building',images:{},pendingImage:null,cardKeys:[],savedCardCount:0};
      write(stageDataKey(),stagedData);write(stageRunKey(),run);
    }
    const oldRun=currentRun(),oldData=currentData();
    const newUrls=new Set(dataset.rows.map(x=>normalize(x.url)));
    const stagedCount=reconcileStageImages(view,dataset,run);
    if(stagedCount===0){
      ensureParticipantIntro(view);
      await safety().save(view,'参加者見出しを保存確認中…');
    }
    for(let i=0;i<dataset.rows.length;i++){
      const row=dataset.rows[i];
      if(run.images[row.url])continue;
      if(i===Number(dataset.meta?.tagArticles||0))await ensureLikeBoundary(view,run);
      if(i===dataset.rows.length-1)await ensureFinalBoundary(view,run);
      run.pendingImage={url:row.url,index:i+1,at:Date.now()};write(stageRunKey(),run);
      setStatus('極薄 '+Object.keys(run.images).length+'/'+dataset.count+'｜'+(i+1)+'番 '+row.creator+' をnoteへアップロード中…');
      await uploadOneThin(view,row,run,dataset);
      const done=Object.keys(run.images).length;
      if(done%40===0||done===dataset.count){
        await safety().save(view,'極薄 '+done+'/'+dataset.count+' 保存確認中…');
      }
      setStatus('極薄 '+done+'/'+dataset.count+'｜note画像確認済み・高速連続処理中…');
      await sleep(40);
    }
    const actual=reconcileStageImages(view,dataset,run);
    if(actual!==dataset.count)throw new FatalError('極薄画像の実体不足 '+actual+'/'+dataset.count);
    await safety().save(view,'新しい極薄 '+dataset.count+'/'+dataset.count+' 最終保存確認中…');

    const owned=oldOwnedHits(view,oldRun,oldData,newUrls);
    if(owned.cards.length||owned.images.length){
      setStatus('新しい極薄は保存済み。旧ツール生成物だけ整理中…');
      removeHits(view,[...owned.cards,...owned.images]);
      await safety().save(view,'旧生成物を整理して保存確認中…');
    }
    run={...run,stage:'images_ready',cardKeys:[],savedCardCount:0,pendingCard:null,
      cardBaselineKeys:embedNodes(view).map(cardKey).filter(Boolean)};
    write(DATA_KEY,dataset);write(runKey(),run);
    localStorage.removeItem(stageDataKey());localStorage.removeItem(stageRunKey());
    setStatus('極薄 '+dataset.count+'/'+dataset.count+' 🔗・名前・保存確認済み ✅ '+(autoCards?'カードを自動開始します':'次は「カード開始」'));
    ok=true;continueCards=autoCards||read(overnightKey(),false)===true;
    return true;
  }catch(error){
    setStatus('再構築停止：'+(error?.message||String(error))+'｜成功済み極薄は保持しています',true);
    return false;
  }finally{
    if(token)safety().end(token);
    busy=false;updateButtons();
    if(ok&&continueCards)setTimeout(()=>{if(!busy&&enabled())void buildCards()},2500);
  }
}
async function startOvernight(){
  write(overnightKey(),true);
  if(busy){setStatus('夜間一括ON｜現在の処理が終わり次第、そのまま極薄→カードまで継続します');return;}
  const awake=await keepAwake();
  setStatus('夜間一括を開始：極薄→保存→通知カードまで自動で進めます'+(awake?'｜画面スリープ抑止ON':'｜スリープ抑止は端末非対応'));
  await rebuildImages(true);
}
function maybeResumeOvernight(){
  if(read(overnightKey(),false)!==true||busy||!enabled())return;
  const run=currentRun(),stage=read(stageRunKey(),null);
  if(stage?.stage==='images_building'||!run?.liveBatch){
    setTimeout(()=>{if(!busy&&enabled())void rebuildImages(true)},1500);
    return;
  }
  if(['images_ready','cards_building','cards_waiting','cards_paused'].includes(run.stage)){
    setTimeout(()=>{if(!busy&&enabled())void buildCards()},1500);
  }
}
function insertWorkUrl(view,url){
  ensureEnd(view);
  const p=view.state.schema.nodes.paragraph,pos=view.state.doc.content.size;
  view.dispatch(view.state.tr.insert(pos,p.create(null,view.state.schema.text(url))));
  const node=view.state.doc.nodeAt(pos);
  if(node?.type!==p||node.textContent!==url)throw new FatalError('作業用URLを配置できません');
  view.dispatch(view.state.tr.setSelection(selectionAtEnd(view)).scrollIntoView());view.focus();
  return {node,pos};
}
async function waitCard(view,url,beforeKeys,attempt,timeout=30000){
  const deadline=Date.now()+timeout;
  while(Date.now()<deadline){
    if(attempt.error)throw attempt.error;
    const hit=embedNodes(view).find(h=>{const k=cardKey(h);return k&&!beforeKeys.has(k)&&genuineCard(h,url)});
    if(hit)return hit;
    safety().check(view);
    if(safety().stopped())throw new FatalError('停止しました');
    await sleep(100);
  }
  throw new FatalError('カード生成待ちタイムアウト');
}
function statusCode(error){
  return Number(error?.response?.status||error?.status||String(error?.message||'').match(/\b(401|403|429)\b/)?.[1]||0);
}
async function buildCards(){
  if(busy||!enabled())return;
  busy=true;let token;
  try{
    const dataset=currentData(),run=currentRun(),view=findView();
    if(!dataset?.liveBatch||!run||run.datasetId!==dataset.datasetId)throw new FatalError('先に「最新から再構築」で極薄を作ってください');
    const imageCount=dataset.rows.filter(row=>safety().tracked(view,run.images?.[row.url],row.url)).length;
    if(imageCount!==dataset.count)throw new FatalError('極薄不足 '+imageCount+'/'+dataset.count);
    try{if(safety().networkHold?.())safety().resumeNetwork()}catch(e){throw new FatalError(e.message)}
    token=safety().begin('通知カード作成',view);
    run.stage='cards_building';write(runKey(),run);
    const baseline=new Set(run.cardBaselineKeys||[]);
    // Reconcile current cards from this run only.
    run.cardKeys=(run.cardKeys||[]).filter(rec=>embedNodes(view).some(h=>cardKey(h)===rec.key&&genuineCard(h,rec.url)));
    write(runKey(),run);

    for(let i=0;i<dataset.rows.length;i++){
      const row=dataset.rows[i];
      if((run.cardKeys||[]).some(x=>normalize(x.url)===normalize(row.url)))continue;
      // Do not adopt pre-existing body cards that were present before this run.
      const existing=embedNodes(view).find(h=>genuineCard(h,row.url)&&!baseline.has(cardKey(h)));
      if(existing){
        run.cardKeys.push({url:row.url,key:cardKey(existing)});write(runKey(),run);continue;
      }
      const beforeKeys=new Set(embedNodes(view).map(cardKey).filter(Boolean));
      const beforeRaw=exactUrlParagraphs(view,row.url).length;
      const work=insertWorkUrl(view,row.url);
      run.pendingCard={url:row.url,index:i+1,beforeKeys:[...beforeKeys],rawBeforeCount:beforeRaw,attempts:Number(run.pendingCard?.url===row.url?run.pendingCard.attempts:0)+1};
      write(runKey(),run);
      setStatus('通知カード '+run.cardKeys.length+'/'+dataset.count+'｜'+(i+1)+'番 '+row.creator+' を作成中…');
      const attempt={error:null};
      const command=nativeUrlCommand()(row.url,error=>{attempt.error=error});
      const handled=command(view.state,(tr,consumed=work.node)=>{
        try{
          if(attempt.error)return;
          if(consumed!==work.node&&!consumed?.eq?.(work.node))throw new FatalError('作業用URLが変更されました');
          safety().dispatch(view,tr,[work.node]);
        }catch(e){attempt.error=e}
      },view);
      if(!handled)throw new FatalError('note正規URLカード処理が未処理');
      let hit;
      try{
        hit=await waitCard(view,row.url,beforeKeys,attempt,30000);
      }catch(error){
        const code=statusCode(error);
        // Remove only the extra raw work URL if it survived.
        const raws=exactUrlParagraphs(view,row.url);
        if(raws.length===beforeRaw+1)removeHits(view,[raws.at(-1)]);
        run.pendingCard={...run.pendingCard,lastError:error?.message||String(error),status:code,at:Date.now()};
        run.stage='cards_waiting';write(runKey(),run);
        const attempts=run.pendingCard.attempts||1;
        const wait=code===429?600000:code===403?600000:180000;
        setStatus('カード '+run.cardKeys.length+'/'+dataset.count+'｜'+row.creator+' は '+(code?'HTTP '+code:'通信待ち')+'。連打せず '+Math.ceil(wait/60000)+'分休止 → 同じ1件から再開',true);
        if(attempts<4){
          clearTimeout(resumeTimer);
          resumeTimer=setTimeout(()=>{if(!busy&&enabled())void buildCards()},wait);
        }
        return;
      }
      // Remove any raw paragraph left after successful conversion.
      const raws=exactUrlParagraphs(view,row.url);
      if(raws.length>beforeRaw)removeHits(view,[raws.at(-1)]);
      run.cardKeys.push({url:row.url,key:cardKey(hit)});
      run.pendingCard=null;run.stage='cards_building';write(runKey(),run);

      // Manual-mimic mode: do not hammer note's draft-save/readback API.
      // Let note's own autosave run while we keep a local checkpoint after every card.
      setStatus('通知カード '+run.cardKeys.length+'/'+dataset.count+'｜note自動保存待ち');
      await sleep(5500);
      if(run.cardKeys.length>0&&run.cardKeys.length%15===0&&run.cardKeys.length<dataset.count){
        const restMs = run.cardKeys.length % 60 === 0 ? 180000 : 45000;
        setStatus('カード '+run.cardKeys.length+'/'+dataset.count+'｜手動操作相当の休止 '+Math.ceil(restMs/1000)+'秒（note自動保存待ち）');
        await sleep(restMs);
      }
    }
    await sleep(12000);
    await safety().save(view,'通知カード最終保存…');
    run.savedCardCount=run.cardKeys.length;
    if(run.cardKeys.length!==dataset.count)throw new FatalError('カード件数不足 '+run.cardKeys.length+'/'+dataset.count);
    const unique=new Set(run.cardKeys.map(x=>x.key));
    if(unique.size!==dataset.count)throw new FatalError('カードキー重複');
    run.stage='cards_ready';run.pendingCard=null;write(runKey(),run);
    localStorage.removeItem(overnightKey());
    await releaseAwake();
    setStatus('極薄 '+dataset.count+'/'+dataset.count+'｜通知カード '+dataset.count+'/'+dataset.count+' 保存済み ✅ 夜間一括完了');
  }catch(error){
    const run=currentRun();if(run){run.stage='cards_paused';write(runKey(),run)}
    setStatus('カード停止：'+(error?.message||String(error))+'｜完成分は保持しています',true);
  }finally{
    if(token)safety().end(token);
    busy=false;updateButtons();
  }
}
async function resumeWork(){
  if(busy){setStatus('現在の処理中です。終了後に不足位置から再開します');return false;}
  const view=findView();
  if(!view){setStatus('編集画面の準備ができていません',true);return false;}
  const staged=read(stageRunKey(),null);
  const stagedData=read(stageDataKey(),null);
  const run=currentRun(),data=currentData();
  const overnight=read(overnightKey(),false)===true;
  try{
    if(staged&&stagedData&&staged.datasetId===stagedData.datasetId){
      const present=reconcileStageImages(view,stagedData,staged);
      setStatus('再開確認：極薄 '+present+'/'+stagedData.count+'｜不足から続けます');
      return await rebuildImages(overnight);
    }
    if(data?.liveBatch&&run&&run.datasetId===data.datasetId){
      const missingImages=data.rows.filter(row=>{
        const rec=run.images?.[row.url];
        const hit=rec&&safety().tracked(view,rec,row.url);
        return !(hit&&remoteImage(hit.node)&&normalize(hit.node.attrs?.link)===normalize(row.url)&&hit.node.textContent===row.caption);
      });
      if(missingImages.length){
        write(stageDataKey(),data);
        write(stageRunKey(),{...run,version:'18.9.8',stage:'images_building',pendingImage:null});
        setStatus('再開確認：極薄不足 '+missingImages.length+'件を検出｜不足だけ復旧します');
        return await rebuildImages(overnight);
      }
      const presentCards=(run.cardKeys||[]).filter(rec=>embedNodes(view).some(h=>cardKey(h)===rec.key&&genuineCard(h,rec.url)));
      if(presentCards.length!==(run.cardKeys||[]).length){
        run.cardKeys=presentCards;
        run.savedCardCount=Math.min(Number(run.savedCardCount||0),presentCards.length);
        run.pendingCard=null;
        run.stage='cards_paused';
        write(runKey(),run);
      }
      if(run.stage==='cards_ready'&&presentCards.length===data.count){
        setStatus('全件そろっています｜極薄 '+data.count+'/'+data.count+'｜カード '+data.count+'/'+data.count+' ✅');
        return true;
      }
      setStatus('再開確認：極薄 '+data.count+'/'+data.count+'｜カード '+presentCards.length+'/'+data.count+'｜不足から続けます');
      return await buildCards();
    }
    setStatus('旧記録または未開始状態です。最新327件の極薄から再構築して続けます');
    return await rebuildImages(overnight);
  }catch(error){
    setStatus('再開確認停止：'+(error?.message||String(error))+'｜本文は保持しています',true);
    return false;
  }
}

async function deleteOwnedCards(){
  if(busy)return;
  busy=true;let token;
  try{
    const dataset=currentData(),run=currentRun(),view=findView();
    if(!dataset?.liveBatch||!run)throw new FatalError('今回の記録がありません');
    token=safety().begin('今回カード削除',view);
    const keys=new Set((run.cardKeys||[]).map(x=>String(x.key||'')));
    const hits=embedNodes(view).filter(h=>keys.has(cardKey(h)));
    removeHits(view,hits);
    await safety().save(view,'今回の通知カードを削除して保存中…');
    run.cardKeys=[];run.savedCardCount=0;run.pendingCard=null;run.stage='cards_deleted';write(runKey(),run);
    setStatus('今回の通知カード '+hits.length+'件を削除・保存済み｜極薄サムネイルは保持');
  }catch(error){setStatus('カード削除停止：'+(error?.message||String(error)),true)}
  finally{if(token)safety().end(token);busy=false;updateButtons()}
}
function updateButtons(){
  const p=document.getElementById(PANEL);if(!p)return;
  const run=currentRun(),data=currentData();
  const count=data?.count||0,cards=run?.cardKeys?.length||0,images=run?.images?Object.keys(run.images).length:0;
  p.querySelector('[data-a="overnight"]')?.removeAttribute('disabled');
  p.querySelector('[data-a="resume"]')?.toggleAttribute('disabled',busy);
  p.querySelector('[data-a="fresh"]')?.toggleAttribute('disabled',busy);
  p.querySelector('[data-a="cards"]')?.toggleAttribute('disabled',busy||images!==count||!count);
  p.querySelector('[data-a="delete"]')?.toggleAttribute('disabled',busy||!cards);
  const mini=p.querySelector('[data-progress]');
  if(mini)mini.textContent='極薄 '+images+'/'+count+'｜カード '+cards+'/'+count;
}
function mount(){
  if(!enabled()||!document.body)return;
  let p=document.getElementById(PANEL);
  if(!p){
    p=document.createElement('div');p.id=PANEL;
    p.style.cssText='position:fixed;right:6px;top:86px;z-index:2147483646;width:min(330px,calc(100vw - 12px));background:#071018;color:#eef7ff;border:1px solid #2d526b;border-radius:12px;padding:7px;font:12px/1.35 system-ui;box-shadow:0 8px 30px #0008;touch-action:auto';
    p.innerHTML='<div class="title" style="display:flex;align-items:center;gap:6px;font-weight:900;margin-bottom:6px;cursor:grab;user-select:none"><span style="flex:1">極薄＋通知 Fresh <span style="font-size:10px">v'+VERSION+'</span></span><button data-a="min" type="button" style="width:32px;min-height:28px;padding:2px 6px">−</button></div>'+
      '<div data-body><div style="display:grid;grid-template-columns:1fr 1fr;gap:4px">'+
      '<button data-a="overnight" type="button">夜間一括</button><button data-a="resume" type="button">再開</button><button data-a="fresh" type="button">最新から再構築</button><button data-a="cards" type="button">カード開始</button><button data-a="delete" type="button">カード削除</button></div>'+
      '<div data-progress style="margin-top:5px;font-size:10px;color:#9fdcff">極薄 0/0｜カード 0/0</div>'+
      '<div id="'+STATUS+'" style="margin-top:4px;font-size:10px">最新のスキ・記事で最初から作り直せます</div></div>';
    const body=p.querySelector('[data-body]'),min=p.querySelector('[data-a="min"]'),title=p.querySelector('.title');
    const posKey='mumei_live_fresh_panel_pos_v1',minKey='mumei_live_fresh_panel_min_v1';
    try{
      const saved=JSON.parse(localStorage.getItem(posKey)||'null');
      if(saved&&Number.isFinite(saved.left)&&Number.isFinite(saved.top)){
        p.style.left=saved.left+'px';p.style.top=saved.top+'px';p.style.right='auto';
      }
    }catch(_){}
    const applyMin=()=>{
      const on=localStorage.getItem(minKey)==='1';
      body.style.display=on?'none':'block';
      min.textContent=on?'＋':'−';
      p.style.width=on?'190px':'min(330px,calc(100vw - 12px))';
    };
    min.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();localStorage.setItem(minKey,body.style.display==='none'?'0':'1');applyMin();});
    let drag=null;
    title.addEventListener('pointerdown',e=>{
      if(e.target.closest('button'))return;
      const r=p.getBoundingClientRect();
      drag={id:e.pointerId,x:e.clientX,y:e.clientY,left:r.left,top:r.top};
      try{title.setPointerCapture(e.pointerId)}catch(_){}
    });
    title.addEventListener('pointermove',e=>{
      if(!drag||e.pointerId!==drag.id)return;
      e.preventDefault();
      const vw=page.visualViewport?.width||page.innerWidth||360;
      const vh=page.visualViewport?.height||page.innerHeight||640;
      const r=p.getBoundingClientRect();
      const left=Math.max(4,Math.min(drag.left+e.clientX-drag.x,vw-r.width-4));
      const top=Math.max(56,Math.min(drag.top+e.clientY-drag.y,vh-Math.min(r.height,vh-64)-4));
      p.style.left=Math.round(left)+'px';p.style.top=Math.round(top)+'px';p.style.right='auto';
    });
    const finish=e=>{
      if(!drag||e.pointerId!==drag.id)return;
      const r=p.getBoundingClientRect();
      localStorage.setItem(posKey,JSON.stringify({left:Math.round(r.left),top:Math.round(r.top)}));
      drag=null;
    };
    title.addEventListener('pointerup',finish);title.addEventListener('pointercancel',finish);
    p.addEventListener('click',e=>{
      const a=e.target.closest('button[data-a]')?.dataset.a;if(!a||a==='min')return;
      if(a==='overnight')void startOvernight();
      if(a==='resume')void resumeWork();
      if(a==='fresh')void rebuildImages(false);
      if(a==='cards')void buildCards();
      if(a==='delete')void deleteOwnedCards();
    });
    document.body.appendChild(p);
    applyMin();
  }
  updateButtons();
}
page.__MUMEI_LIVE_REBUILD__={rebuildImages,buildCards,deleteOwnedCards,startOvernight,resumeWork};
page.addEventListener('pageshow',()=>setTimeout(maybeResumeOvernight,1200));
document.addEventListener('visibilitychange',()=>{if(!document.hidden){if(read(overnightKey(),false)===true)void keepAwake();setTimeout(maybeResumeOvernight,1200)}});
setInterval(mount,800);mount();setTimeout(maybeResumeOvernight,1800);
})();