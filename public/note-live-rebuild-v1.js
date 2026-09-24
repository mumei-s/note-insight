(function(){
'use strict';
const page=typeof unsafeWindow!=='undefined'?unsafeWindow:window;
if(page.__MUMEI_LIVE_REBUILD_V1__)return;
page.__MUMEI_LIVE_REBUILD_V1__=true;

const VERSION='18.9.0';
const PANEL='mumei-note-source-picker-v163';
const STATUS='mumei-note-source-status-v163';
const DATA_KEY='mumei_likers_thin_dataset_v160';
const RUN_PREFIX='mumei_likers_thin_run_v160';
const MANIFEST='https://raw.githubusercontent.com/mumei-s/note-insight/main/public/note-live-batch/manifest.json';
const META='https://raw.githubusercontent.com/mumei-s/note-insight/main/data/note-live-batch-live.json';
const RAW_BASE='https://raw.githubusercontent.com/mumei-s/note-insight/main/public';
const FINAL='https://note.com/fuku444/n/nb4f6934381e9';

let busy=false,viewCache=null,coreCache=null,noteUrlCommand=null,resumeTimer=null;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
class FatalError extends Error{}
const safety=()=>{if(!page.__MUMEI_CARD_SAFETY__)throw new FatalError('本文保護機能を読み込めません');return page.__MUMEI_CARD_SAFETY__;};
const articleKey=()=>location.pathname.match(/^\/notes\/(n[a-z0-9]{8,})\/edit\/?$/i)?.[1]||'';
const runKey=()=>RUN_PREFIX+':'+articleKey();
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
function selectionApi(){
  const req=webpackRequire();if(!req)throw new FatalError('note編集APIを取得できません');
  let api;try{api=req(35130)?.sW}catch(_){}
  if(!api?.atEnd)throw new FatalError('note選択APIを取得できません');
  return api;
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
  view.dispatch(view.state.tr.setSelection(selectionApi().atEnd(view.state.doc)).scrollIntoView());view.focus();
}
function exactUrlParagraphs(view,url){
  const wanted=normalize(url),out=[];
  view.state.doc.forEach((node,pos)=>{if(node.type===view.state.schema.nodes.paragraph&&normalize((node.textContent||'').trim())===wanted)out.push({node,pos})});
  return out;
}
function removeHits(view,hits){if(hits.length)safety().remove(view,hits.sort((a,b)=>b.pos-a.pos));}
function currentRun(){return read(runKey(),null);}
function currentData(){return read(DATA_KEY,null);}

function oldOwnedHits(view,oldRun,oldData,newUrls){
  const images=[],cards=[];
  const imageRecords=oldRun?.images||{};
  for(const [url,rec] of Object.entries(imageRecords)){
    const hit=safety().tracked(view,rec,url);if(hit)images.push(hit);
  }
  const knownCardKeys=new Set((oldRun?.cardKeys||[]).map(x=>String(x.key||'')).filter(Boolean));
  for(const hit of embedNodes(view))if(knownCardKeys.has(cardKey(hit)))cards.push(hit);
  // New architecture owns its raw-hosted images by src/id even if local progress was lost.
  for(const hit of imageNodes(view)){
    const src=String(hit.node.attrs?.src||''),id=String(hit.node.attrs?.id||'');
    if((id.startsWith('mumei-live-')||src.includes('/note-live-batch/cards/'))&&!images.some(x=>x.pos===hit.pos))images.push(hit);
  }
  // If an old recorded dataset exists, exact target cards from that generated batch can be cleared on explicit rebuild.
  const oldUrls=new Set((oldData?.rows||[]).map(x=>normalize(x.url)).filter(Boolean));
  for(const hit of embedNodes(view)){
    const u=cardUrl(hit);
    if((oldUrls.has(u)||newUrls.has(u))&&!cards.some(x=>x.pos===hit.pos)){
      const key=cardKey(hit);
      if(knownCardKeys.has(key)||oldRun?.stage?.startsWith?.('cards'))cards.push(hit);
    }
  }
  return {images:[...new Map(images.map(x=>[x.pos,x])).values()],cards:[...new Map(cards.map(x=>[x.pos,x])).values()]};
}

async function rebuildImages(){
  if(busy||!enabled())return;
  busy=true;let token;
  try{
    const view=findView();if(!view)throw new FatalError('編集画面の準備ができていません');
    try{if(safety().networkHold?.())safety().resumeNetwork()}catch(e){throw new FatalError(e.message)}
    token=safety().begin('最新から再構築',view);
    setStatus('最新のスキ・記事・極薄データを取得中…');
    const [manifest,meta]=await Promise.all([requestJSON(MANIFEST),requestJSON(META)]);
    validate(manifest,meta);
    const newUrls=new Set(manifest.items.map(x=>normalize(x.url)));
    const oldRun=currentRun(),oldData=currentData();
    const owned=oldOwnedHits(view,oldRun,oldData,newUrls);
    if(owned.cards.length||owned.images.length){
      setStatus('旧ツールの生成物を整理中…');
      removeHits(view,[...owned.cards,...owned.images]);
    }
    // Clear only old generated-progress state; user body outside tracked nodes stays intact.
    localStorage.removeItem(runKey());localStorage.removeItem(DATA_KEY);
    const datasetId='live-current:'+meta.generatedAt;
    const rows=manifest.items.map((item,i)=>({
      index:i+1,url:item.url,creator:item.creator,title:item.title,key:item.key,
      cardPath:item.cardPath,src:imageSrc(item),caption:item.creator+'さん',
      urlname:meta.rows[i]?.urlname||'',source:meta.rows[i]?.source||'',finalMarker:Boolean(meta.rows[i]?.finalMarker)
    }));
    const dataset={version:'18.9.0',datasetId,count:rows.length,rows,preparedBatch:false,liveBatch:true,
      extractedAt:meta.generatedAt,sourceMode:'live-current',confirmationUrl:FINAL,meta:{tagArticles:meta.tagArticles,likeCounts:meta.likeCounts,rules:meta.rules}};
    const run={version:'18.9.0',articleKey:articleKey(),datasetId,stage:'images_building',images:{},cardKeys:[],savedCardCount:0,pendingCard:null,cardBaselineKeys:embedNodes(view).map(cardKey).filter(Boolean)};
    write(DATA_KEY,dataset);write(runKey(),run);

    const imageType=view.state.schema.nodes.image;if(!imageType)throw new FatalError('note画像ノードを取得できません');
    for(let start=0;start<rows.length;start+=30){
      safety().check(view);
      let tr=view.state.tr;
      for(let i=start;i<Math.min(start+30,rows.length);i++){
        const row=rows[i],id='mumei-live-'+String(i+1).padStart(3,'0')+'-'+String(row.key||'').replace(/[^a-z0-9_-]/gi,'');
        const attrs={...(imageType.defaultAttrs||{}),id,src:row.src,link:row.url};
        const node=imageType.create(attrs,view.state.schema.text(row.caption));
        tr=tr.insert(tr.doc.content.size,node);
        run.images[row.url]={id,src:row.src,link:row.url};
      }
      view.dispatch(tr);write(runKey(),run);
      setStatus('極薄サムネイル '+Object.keys(run.images).length+'/'+rows.length+' を本文へ配置中…');
      if(start+30<rows.length)await sleep(120);
      if((start+30)%90===0||start+30>=rows.length){
        await safety().save(view,'極薄 '+Object.keys(run.images).length+'/'+rows.length+' 保存確認中…');
      }
    }
    const actual=rows.filter(row=>safety().tracked(view,run.images[row.url],row.url)).length;
    if(actual!==rows.length)throw new FatalError('極薄画像の実体不足 '+actual+'/'+rows.length);
    run.stage='images_ready';write(runKey(),run);
    setStatus('極薄サムネイル '+rows.length+'/'+rows.length+' 保存済み ✅ 次は「カード開始」');
  }catch(error){
    setStatus('再構築停止：'+(error?.message||String(error)),true);
  }finally{
    if(token)safety().end(token);
    busy=false;updateButtons();
  }
}
function insertWorkUrl(view,url){
  ensureEnd(view);
  const p=view.state.schema.nodes.paragraph,pos=view.state.doc.content.size;
  view.dispatch(view.state.tr.insert(pos,p.create(null,view.state.schema.text(url))));
  const node=view.state.doc.nodeAt(pos);
  if(node?.type!==p||node.textContent!==url)throw new FatalError('作業用URLを配置できません');
  view.dispatch(view.state.tr.setSelection(selectionApi().atEnd(view.state.doc)).scrollIntoView());view.focus();
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
        if(run.cardKeys.length>run.savedCardCount){
          await safety().save(view,'カード '+run.cardKeys.length+'/'+dataset.count+' まで保存中…');
          run.savedCardCount=run.cardKeys.length;write(runKey(),run);
        }
        const attempts=run.pendingCard.attempts||1;
        const wait=code===429?180000:code===403?180000:90000;
        setStatus('カード '+run.cardKeys.length+'/'+dataset.count+' 保存済み｜'+row.creator+' は '+(code?'HTTP '+code:'通信待ち')+'。'+Math.ceil(wait/1000)+'秒休止して同じ1件から再開',true);
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

      if(run.cardKeys.length-run.savedCardCount>=5){
        await safety().save(view,'カード '+run.cardKeys.length+'/'+dataset.count+' 保存確認中…');
        run.savedCardCount=run.cardKeys.length;write(runKey(),run);
      }
      setStatus('通知カード '+run.cardKeys.length+'/'+dataset.count+'｜保存済み '+run.savedCardCount);
      await sleep(3000);
      if(run.cardKeys.length>0&&run.cardKeys.length%20===0&&run.cardKeys.length<dataset.count){
        await safety().save(view,'カード '+run.cardKeys.length+'/'+dataset.count+' 区切り保存…');
        run.savedCardCount=run.cardKeys.length;write(runKey(),run);
        const longRest = run.cardKeys.length % 60 === 0;
        const restMs = longRest ? 180000 : 60000;
        setStatus('カード '+run.cardKeys.length+'/'+dataset.count+' 保存済み｜403予防の'+Math.ceil(restMs/1000)+'秒休止中…');
        await sleep(restMs);
      }
    }
    await safety().save(view,'通知カード最終保存…');
    run.savedCardCount=run.cardKeys.length;
    if(run.cardKeys.length!==dataset.count)throw new FatalError('カード件数不足 '+run.cardKeys.length+'/'+dataset.count);
    const unique=new Set(run.cardKeys.map(x=>x.key));
    if(unique.size!==dataset.count)throw new FatalError('カードキー重複');
    run.stage='cards_ready';run.pendingCard=null;write(runKey(),run);
    setStatus('極薄 '+dataset.count+'/'+dataset.count+'｜通知カード '+dataset.count+'/'+dataset.count+' 保存済み ✅');
  }catch(error){
    const run=currentRun();if(run){run.stage='cards_paused';write(runKey(),run)}
    setStatus('カード停止：'+(error?.message||String(error))+'｜完成分は保持しています',true);
  }finally{
    if(token)safety().end(token);
    busy=false;updateButtons();
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
    p.style.cssText='position:fixed;right:6px;bottom:8px;z-index:2147483646;width:min(360px,calc(100vw - 12px));background:#071018;color:#eef7ff;border:1px solid #2d526b;border-radius:12px;padding:8px;font:12px/1.4 system-ui;box-shadow:0 8px 30px #0008';
    p.innerHTML='<div class="title" style="font-weight:900;margin-bottom:6px">極薄＋通知 Fresh <span style="font-size:10px">v'+VERSION+'</span></div>'+
      '<div style="display:grid;grid-template-columns:1.3fr 1fr 1fr;gap:4px">'+
      '<button data-a="fresh" type="button">最新から再構築</button><button data-a="cards" type="button">カード開始</button><button data-a="delete" type="button">カード削除</button></div>'+
      '<div data-progress style="margin-top:5px;font-size:10px;color:#9fdcff">極薄 0/0｜カード 0/0</div>'+
      '<div id="'+STATUS+'" style="margin-top:4px;font-size:10px">最新のスキ・記事で最初から作り直せます</div>';
    p.addEventListener('click',e=>{
      const a=e.target.closest('button[data-a]')?.dataset.a;if(!a)return;
      if(a==='fresh')void rebuildImages();
      if(a==='cards')void buildCards();
      if(a==='delete')void deleteOwnedCards();
    });
    document.body.appendChild(p);
  }
  updateButtons();
}
page.__MUMEI_LIVE_REBUILD__={rebuildImages,buildCards,deleteOwnedCards};
setInterval(mount,800);mount();
})();