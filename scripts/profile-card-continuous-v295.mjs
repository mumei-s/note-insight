// Standalone-only changes: hand edits are allowed, uploads stay serial,
// and at most the next person's two decoded assets are prepared in advance.
function once(source,from,to){
 if(source.split(from).length!==2)throw Error('Continuous hook must match once: '+from.slice(0,100));
 return source.replace(from,()=>to);
}
function replaceFunction(source,name,replacement){
 const start=source.search(new RegExp('^(?:async )?function '+name+'\\(','m'));
 if(start<0)throw Error('Missing continuous function '+name);
 const open=source.indexOf('){',start)+1;if(open<=start)throw Error('Missing body '+name);
 let depth=1,quote='',escape=false,line=false,block=false,end=open+1;
 for(;end<source.length&&depth;end++){
  const char=source[end],next=source[end+1];
  if(line){if(char==='\n')line=false;continue}
  if(block){if(char==='*'&&next==='/'){block=false;end++}continue}
  if(quote){if(escape)escape=false;else if(char==='\\')escape=true;else if(char===quote)quote='';continue}
  if(char==='/'&&next==='/'){line=true;end++;continue}
  if(char==='/'&&next==='*'){block=true;end++;continue}
  if(char==='"'||char==="'"||char==='`'){quote=char;continue}
  if(char==='{')depth++;else if(char==='}')depth--;
 }
 if(depth)throw Error('Unclosed continuous function '+name);
 return source.slice(0,start)+replacement+source.slice(end);
}

export const awakeRuntime=String.raw`
(function(page){
 const owners=new Set();let lock=null,pending=null,retry=null,lastError='';
 const visible=()=>!document.hidden;
 async function ensure(){
  if(!owners.size||!visible())return false;
  if(lock&&!lock.released)return true;
  if(pending)return pending;
  if(typeof page.navigator?.wakeLock?.request!=='function'){lastError='unsupported';return false}
  pending=(async()=>{
   try{
    const held=await page.navigator.wakeLock.request('screen');
    if(!owners.size||!visible()){await held.release?.();return false}
    lock=held;lastError='';
    held.addEventListener?.('release',()=>{
     if(lock===held)lock=null;
     clearTimeout(retry);
     if(owners.size&&visible())retry=setTimeout(()=>void ensure(),250);
    },{once:true});
    return true;
   }catch(error){lastError=String(error?.name||'denied');return false}
   finally{pending=null}
  })();
  return pending;
 }
 async function release(owner){
  owners.delete(owner);if(owners.size)return;
  clearTimeout(retry);retry=null;
  const held=lock;lock=null;try{await held?.release?.()}catch{}
 }
 document.addEventListener?.('visibilitychange',()=>{if(visible()&&owners.size)void ensure()});
 page.addEventListener?.('pageshow',()=>{if(owners.size)void ensure()});
 page.__MUMEI_PROFILE_CARD_AWAKE__={acquire:owner=>{owners.add(owner);return ensure()},release,ensure,status:()=>({active:owners.size>0,held:Boolean(lock&&!lock.released),lastError})};
})(owner);
`;

function assetRuntime(urlFunction){return String.raw`
const continuousAssets=new Map();
function clearContinuousAssets(){
 for(const entry of continuousAssets.values())entry.promise.then(image=>{if(!entry.claimed)try{image?.close?.()}catch{}});
 continuousAssets.clear();
}
function warmContinuousAssets(row){
 const run=readRun();if(!run?.rows?.length||run.gallery126||stopRequested)return;
 const position=run.rows.findIndex(person=>norm(person.url)===norm(row.url));
 clearContinuousAssets();
 const next=run.rows[position+1];if(position<0||!next)return;
 for(const [value,width]of[[next.actorImageUrl,180],[next.thumbUrl,860]]){
  if(!value)continue;
  const url=ASSET_URL(value,width);if(continuousAssets.has(url))continue;
  const entry={claimed:false,promise:null};
  entry.promise=Promise.resolve().then(()=>bitmapFromUrl(url)).catch(()=>null);
  continuousAssets.set(url,entry);
 }
}
async function continuousBitmap(url){
 const entry=continuousAssets.get(url);
 if(!entry)return bitmapFromUrl(url);
 continuousAssets.delete(url);entry.claimed=true;
 const image=await entry.promise;
 return image||bitmapFromUrl(url);
}
function completedContinuousCount(rows,records){
 const completed=new Set((Array.isArray(records)?records:[]).map(item=>norm(item.url)));
 let done=0;while(done<rows.length&&completed.has(norm(rows[done].url)))done++;
 if(rows.slice(done).some(row=>completed.has(norm(row.url))))throw new Error('途中記録の順序が一致しません。完成分は保持しています');
 return done;
}
function validateContinuousImageIds(view,records){
 const tracked=new Set((records||[]).map(item=>String(item.id||'')).filter(Boolean)),seen=new Set();
 for(const hit of imageNodes(view)){
  const id=String(hit.node.attrs?.id||'');if(!tracked.has(id))continue;
  if(seen.has(id))throw new Error('保存済み画像を一つに確認できません。完成分は保持しています');
  seen.add(id);
 }
}
async function continuousWaitForImage(view,beforeIds,timeout){
 return new Promise((resolve,reject)=>{
  let timer=null,observer=null,finished=false,deadline=Date.now()+timeout,hiddenAt=document.hidden?Date.now():null;
  const cleanup=()=>{clearTimeout(timer);observer?.disconnect();document.removeEventListener?.('visibilitychange',visibility);page.removeEventListener?.('online',signal)};
  const finish=(error,hit)=>{if(finished)return;finished=true;cleanup();error?reject(error):resolve(hit)};
  function visibility(){
   if(document.hidden){hiddenAt??=Date.now();return}
   if(hiddenAt!==null){deadline+=Date.now()-hiddenAt;hiddenAt=null}
   void page.__MUMEI_PROFILE_CARD_AWAKE__?.ensure();signal();
  }
  function signal(){if(!finished){clearTimeout(timer);timer=setTimeout(inspect,0)}}
  function inspect(){
   if(finished)return;
   try{
    const fresh=imageNodes(view).filter(hit=>{const id=String(hit.node.attrs?.id||'');return id&&!beforeIds.has(id)&&remoteImage(hit.node)});
    if(fresh.length===1){finish(null,fresh[0]);return}
    if(fresh.length>1){finish(new Error('複数の新しい画像を検出しました。完成分は保持しています'));return}
    if(stopRequested){finish(new Error('停止しました'));return}
    if(!document.hidden&&Date.now()>=deadline){finish(new Error('note画像アップロード待ちタイムアウト。完成分は保持しています'));return}
    timer=setTimeout(inspect,document.hidden?1000:Math.max(1,Math.min(500,deadline-Date.now())));
   }catch(error){finish(error)}
  }
  try{if(view.dom&&typeof page.MutationObserver==='function'){observer=new page.MutationObserver(signal);observer.observe(view.dom,{childList:true,subtree:true,attributes:true})}}catch{observer=null}
  document.addEventListener?.('visibilitychange',visibility);page.addEventListener?.('online',signal);
  inspect();
 });
}
`.replaceAll('ASSET_URL',urlFunction)}

export function transformQualityContinuous(source){
 // Source-account/article/file binding still runs. User-edited layout is no
 // longer measured or policed, and the optional repair/inspection panel goes.
 source=replaceFunction(source,'mountUI','function mountUI(){}');
 source=replaceFunction(source,'observeContext',String.raw`function observeContext(ctx,row,width,height){
  return safe(()=>{renderings.set(row,{samples:[],width,height,binding:sourceBinding(row)});return ctx},ctx);
 }`);
 source=replaceFunction(source,'generated',String.raw`function generated(row,file){
  return safe(()=>{
   state.runId=page.__MUMEI_PROFILE_CARD_RUN_STORE__?.read?.()?.createdAt??state.runId;
   const drawing=renderings.get(row)||{binding:sourceBinding(row)};files.set(file,drawing);
   record(row,'画像生成',[...assessIdentity(row),...assessBinding(row,provenance(row)?.binding,'取得→生成'),...assessAssets(row),...assessPresentation(row)]);
   return file;
  },file);
 }`);
 for(const name of ['activity','presentationAt','presentationPasted','imageBoundary','divider','externalBoundary'])source=replaceFunction(source,name,'function '+name+'(){}');
 return source;
}

export function transformCoreContinuous(source){
 source=once(source,'async function uploadOne(view,row,file,insertPos){',assetRuntime('speedAssetUrl')+'\nasync function uploadOne(view,row,file,insertPos){');
 source=once(source,'bitmapFromUrl(speedAssetUrl(row.actorImageUrl,180)),bitmapFromUrl(speedAssetUrl(row.thumbUrl,860))','continuousBitmap(speedAssetUrl(row.actorImageUrl,180)),continuousBitmap(speedAssetUrl(row.thumbUrl,860))');
 source=replaceFunction(source,'keepAwake',`async function keepAwake(){if(!busy&&!readScan()?.active)return false;return page.__MUMEI_PROFILE_CARD_AWAKE__?.acquire('core')??false}`);
 source=replaceFunction(source,'releaseAwake',`async function releaseAwake(){clearContinuousAssets();await page.__MUMEI_PROFILE_CARD_AWAKE__?.release('core')}`);
 source=once(source,'  if(special)await keepAwake();','  await keepAwake();');
 source=once(source,'if(special)await releaseAwake();','await releaseAwake();');
 source=replaceFunction(source,'waitNewNoteImage','async function waitNewNoteImage(view,beforeIds,timeout=150000){return continuousWaitForImage(view,beforeIds,timeout)}');
 source=replaceFunction(source,'ownedCoreDivider',String.raw`function ownedCoreDivider(view,image,run=readRun()){
  if(!run)return null;
  const record=coreDividerRecordFor(image,run.coreDividerRecords,run);if(!record)return null;
  const pos=image.pos+image.node.nodeSize,node=view.state.doc.nodeAt(pos);
  return isCoreDivider(view,node)&&coreDividerEqualsJSON(view,node,record.node)?{node,pos,record}:null;
 }`);
 source=replaceFunction(source,'externalCoreDivider',String.raw`function externalCoreDivider(view,image,run=readRun()){
  if(!run)return null;
  const record=coreDividerRecordFor(image,run.coreExternalDividerRecords,run);if(!record)return null;
  const pos=image.pos+image.node.nodeSize,node=view.state.doc.nodeAt(pos);
  return record.ownership==='unconfirmed'&&isCoreDivider(view,node)&&coreDividerEqualsJSON(view,node,record.node)?{node,pos,record,ownership:'unconfirmed'}:null;
 }`);
 source=replaceFunction(source,'validateCoreDividerBoundaries','function validateCoreDividerBoundaries(){}');
 source=replaceFunction(source,'observeCoreDivider','function observeCoreDivider(){}');
 source=replaceFunction(source,'resumePendingCoreDivider',String.raw`async function resumePendingCoreDivider(view,run=readRun()){
  validateContinuousImageIds(view,run?.items);
  if(!run?.pendingCoreDivider)return false;
  if(run.articleKey!==editorArticleKey())throw new Error('別の記事の作成記録です');
  writeRun({...run,pendingCoreDivider:null,updatedAt:Date.now()});
  await page.__MUMEI_PROFILE_CARD_RUN_STORE__?.flush?.();return true;
 }`);
 source=replaceFunction(source,'appendCoreDivider',String.raw`async function appendCoreDivider(view,row,hit,{node=null,work=null}={}){
  const run=readRun(),identity=coreDividerImage(hit,row);
  if(!run||run.articleKey!==editorArticleKey()||norm(hit.node.attrs?.link)!==identity.url)throw new Error('画像の保存先を確認できません');
  let actual=coreDividerCurrentImage(view,identity,hit.pos,hit.node.textContent);
  if(!actual)throw new Error('完成した画像の位置・リンクを確認できません');
  const existing=ownedCoreDivider(view,actual,run);
  if(existing)return{hit:actual,nextPos:existing.pos+existing.node.nodeSize,divider:existing};
  const planned=node||createCoreDivider(view),pos=actual.pos+actual.node.nodeSize;
  let proof=null;
  try{
   let transaction=view.state.tr;
   if(work){const at=[pos,work.pos].find(at=>view.state.doc.nodeAt(at)===work.node);if(at!==undefined)transaction=transaction.delete(at,at+work.node.nodeSize)}
   const imagePos=transaction.mapping.map(actual.pos,-1),dividerPos=transaction.mapping.map(pos,-1),before=transaction.doc;
   transaction=transaction.insert(dividerPos,planned);const expected=transaction.doc;
   try{view.dispatch(transaction)}catch{}
   if(view.state.doc===expected){const image=view.state.doc.nodeAt(imagePos),divider=view.state.doc.nodeAt(dividerPos);if(image?.eq(actual.node)&&divider?.eq(planned))proof={hit:{node:image,pos:imagePos},node:divider,pos:dividerPos};}
   else proof=coreDividerInsertionProof(view,identity,imagePos,actual.node.textContent,planned,coreDividerNeighborhood(view,before,dividerPos));
   actual=coreDividerCurrentImage(view,identity,imagePos,hit.node.textContent)||actual;
  }catch{}
  const current=readRun();if(current?.createdAt!==run.createdAt||current.articleKey!==run.articleKey)throw new Error('作成記録が変わりました。完成分は保持しています');
  actual=coreDividerCurrentImage(view,identity,actual.pos,hit.node.textContent);
  if(!actual)throw new Error('完成した画像の位置・リンクを確認できません');
  const changes={coreDividerFormat:1,pendingCoreDivider:null};let divider=null;
  if(proof){
   actual=proof.hit;const record=coreDividerRecord(row,actual,proof.node,current);
   changes.coreDividerRecords=[...(current.coreDividerRecords||[]).filter(item=>!sameCoreDividerImage(item.image,identity)),record];
   changes.dividerUrls=[...new Set([...(current.dividerUrls||[]),row.url])];divider={node:proof.node,pos:proof.pos,record};
  }
  recordImage(actual,row,changes);
  coreDividerAnchorWork=null;
  const after=actual.pos+actual.node.nodeSize,next=view.state.doc.nodeAt(after);
  return{hit:actual,nextPos:after+(isCoreDivider(view,next)?next.nodeSize:0),divider};
 }`);
 // Completed upload records are the cursor. A user may remove or rearrange
 // already pasted blocks; neither action means that they should be sent again.
 source=once(source,"  if(run.coreImageRun&&Array.isArray(run.items)&&run.items.length!==ownedImages.length)throw new Error('保存記録のある画像を本文で確認できません。画像は再送しません');",'  const completedCount=completedContinuousCount(rows,run.items);');
 source=once(source,"urls=new Set(rows.map(row=>norm(row.url)));","urls=new Set(rows.slice(completedCount).map(row=>norm(row.url)));");
 source=once(source,"  if(ownedImages.length>total||ownedImages.some((hit,index)=>norm(hit.node?.attrs?.link)!==norm(rows[index]?.url)))throw new Error('保存済み画像の途中に欠落・重複・順序の違いがあります。画像は再送しません');\n  let done=Math.min(ownedImages.length,total);",'  let done=completedCount;');
 source=once(source,'  if(done>0){\n   const last=ownedImages[done-1];','  if(done>0&&ownedImages.length){\n   const completedUrls=new Set(rows.slice(0,done).map(row=>norm(row.url)));\n   const last=ownedImages.filter(hit=>completedUrls.has(norm(hit.node.attrs?.link))).at(-1);\n   if(!last)throw new Error(\'貼り付け位置を確認できません\');');
 source=once(source,'   imageInsertPos=Number(run?.imageAnchorPos);','   imageInsertPos=done?cardAnchorFromSelection(view):Number(run?.imageAnchorPos);');
 source=once(source,'区切り線の再開完了｜下書き保存中…','途中から再開｜下書き保存中…');
 source=once(source,'cardRunActive=true;update();','cardRunActive=true;update();\n await keepAwake();');
 source=once(source,'}finally{cardRunActive=false;busy=false;update()}','}finally{cardRunActive=false;await releaseAwake();busy=false;update()}');
 // Notification cards use the saved article plan. Images may have been
 // deliberately removed, and their count is unrelated to native URL cards.
 source=once(source,"  if(!run||!rows.length||!['images_ready','cards_building','complete'].includes(run.stage))throw new Error('先に①画像一覧を完成させてください');\n  const imageCount=resolveOwnedImageHits(view).length;\n  if(imageCount!==run.rows.length)throw new Error('今回画像が '+imageCount+'/'+run.rows.length+' 件です。画像一覧を確認してください');", "  if(!run||!rows.length)throw new Error('先に紹介する記事を読み込んでください');\n  if(run.articleKey!==editorArticleKey())throw new Error('別の記事の保存記録です');");
 return once(source,"if(document.readyState==='loading')",`const continuousMakeFile=makeFile;
makeFile=async function(row){const file=await continuousMakeFile(row);if(!imagePauseRequested&&!stopRequested)warmContinuousAssets(row);return file};
`+"if(document.readyState==='loading')");
}

export function transformEditorContinuous(source){
 source=once(source,'async function uploadOne(view,row,file,insertPos){',assetRuntime('galleryAssetUrl')+'\nasync function uploadOne(view,row,file,insertPos){');
 source=once(source,"avatarRequired?bitmapFromUrl(avatarSource):Promise.resolve(null),thumbnailMissing?Promise.resolve(null):bitmapFromUrl(thumbSource)","avatarRequired?continuousBitmap(avatarSource):Promise.resolve(null),thumbnailMissing?Promise.resolve(null):continuousBitmap(thumbSource)");
 source=replaceFunction(source,'keepAwake',`async function keepAwake(){if(!busy)return false;return page.__MUMEI_PROFILE_CARD_AWAKE__?.acquire('history')??false}`);
 source=replaceFunction(source,'releaseAwake',`async function releaseAwake(){clearContinuousAssets();await page.__MUMEI_PROFILE_CARD_AWAKE__?.release('history')}`);
 source=replaceFunction(source,'waitNewNoteImage','async function waitNewNoteImage(view,beforeIds,timeout=150000){return continuousWaitForImage(view,beforeIds,timeout)}');
 // The legacy event-specific gallery keeps its migration path. Normal history
 // follows the same saved-completion cursor as # and magazine runs.
 const match=/function completedImagePrefix\(rows,images\)\{/.exec(source);if(!match)throw Error('Missing history completion cursor');
 source=once(source,match[0],match[0]+"\n const continuousRun=readRun();if(!continuousRun?.gallery126&&Array.isArray(continuousRun?.items)&&continuousRun.items.length)return completedContinuousCount(rows,continuousRun.items);");
 source=once(source,'  let doneImages=ownedImages(view);','  validateContinuousImageIds(view,run?.items);\n  let doneImages=ownedImages(view);');
 source=once(source,'  let insertPos=done?doneImages[done-1].pos+doneImages[done-1].node.nodeSize:Number(run.imageAnchorPos);','  const lastCompleted=doneImages.at(-1);\n  let insertPos=done&&lastCompleted?lastCompleted.pos+lastCompleted.node.nodeSize:done?cardAnchorFromSelection(view):Number(run.imageAnchorPos);');
 return once(source,'let attempts=0;',`const continuousMakeFile=makeFile;
makeFile=async function(row){const file=await continuousMakeFile(row);if(!pauseRequested&&!stopRequested)warmContinuousAssets(row);return file};
const continuousEnsureCardsReady=ensureCardsRunReady;
ensureCardsRunReady=async function(view,anchors=null){
 await Promise.all([hydrateRunBackup(),hydratePrepBackup()]);
 const run=readRun();
 if(run?.articleKey&&run.articleKey!==editorArticleKey())throw new Error('別の記事の保存記録です');
 if(Array.isArray(run?.rows)&&run.rows.length)return run;
 return continuousEnsureCardsReady(view,anchors);
};
let attempts=0;`);
}
