function once(source,from,to){
 if(source.split(from).length!==2)throw new Error('Empty batch hook must match once: '+from.slice(0,100));
 return source.replace(from,()=>to);
}
function edit(source,name,apply){
 const start=source.search(new RegExp('^(?:async )?function '+name+'\\(','m'));
 if(start<0)throw new Error('Missing empty batch function: '+name);
 const rest=source.slice(start),next=/\n(?:async )?function [A-Za-z]/.exec(rest);
 const end=next?start+next.index+1:source.length;
 return source.slice(0,start)+apply(source.slice(start,end))+source.slice(end);
}
export const emptyRunRuntime=String.raw`
function profileRunOnlyFinal(run,finalUrl){
 if(!run?.articleKey||run.gallery126||run.purchasedReview||!Array.isArray(run.rows)||run.rows.length!==1)return false;
 const [row]=run.rows;
 return row?.finalMarker===true&&row.url===finalUrl&&
  (run.items||[]).every(item=>item?.url===finalUrl)&&
  (run.cardKeys||[]).every(item=>item?.url===finalUrl)&&
  (run.sectionHeadings||[]).every(text=>text==='最後に｜実績の算数')&&!(run.activityTexts||[]).length;
}
`;
const replaceFooter=String.raw`
async function replaceFinalOnlyProfileRun(view,previous,before,position){
 const result=await deleteAllGenerated({save:false,replacement:{view,previous,before,position}});
 return result.position;
}
page.__MUMEI_PROFILE_CARD_REPLACE_FINAL_ONLY__=replaceFinalOnlyProfileRun;
`;
export function transformCoreEmptyRun(source){
 for(const name of ['buildRows','buildRowsFromSavedSpecial'])source=edit(source,name,part=>{
  const notice=name==='buildRows'?" + (!special&&!workmom&&!parenting?sourceSelectionNotice({sourceSelection:page.__MUMEI_PROFILE_CARD_SOURCE_SELECTION__}):'')":"";
  return once(part,' rows.push({\n  likerKey:'," if(!rows.length)throw new Error('条件に合うクリエイターが0人です'"+notice+");\n rows.push({\n  likerKey:");
 });
 source=edit(source,'deleteVerifiedGeneratedHits',part=>{
  part=once(part,'function deleteVerifiedGeneratedHits(view,hits){','function deleteVerifiedGeneratedHits(view,hits,mapPosition){');
  return once(part,' return unique.length;',' mapPosition?.(tr.mapping);\n return unique.length;');
 });
 source=edit(source,'deleteAllGenerated',part=>{
  part=once(part,'async function deleteAllGenerated({save=true}={}){','async function deleteAllGenerated({save=true,replacement=null}={}){');
  part=once(part,' if(!run)return empty;',` if(replacement&&(!profileRunOnlyFinal(run,FINAL_URL)||run.createdAt!==replacement.previous.createdAt||run.articleKey!==replacement.previous.articleKey))throw new Error('作成記録が変更されました。読み込み直してください');
 if(!run)return empty;`);
  part=once(part," const view=findView();if(!view)throw new Error('note本文編集欄を取得できません');",` const view=findView();if(!view)throw new Error('note本文編集欄を取得できません');
 if(replacement&&(view!==replacement.view||!view.state.doc.eq(replacement.before)))throw new Error('読み込み中に本文が変更されました。貼り付け位置を選び直してください');`);
  part=once(part,' const cards=[...new Map(', ' let cards=[...new Map(');
  part=once(part,' if(run.pendingCard?.sessionId===CARD_SESSION',` if(replacement)cards=cards.filter(hit=>trackedKeys.has(cardKey(hit)));
 if(run.pendingCard?.sessionId===CARD_SESSION`);
  part=once(part,' const removed=deleteVerifiedGeneratedHits(view,[...cards,...images,...headings,...activities,...dividers]);',` let position=replacement?.position;
 const mapPosition=replacement?mapping=>{position=mapping.map(position)}:undefined;
 const removed=deleteVerifiedGeneratedHits(view,[...cards,...images,...headings,...activities,...dividers],mapPosition);`);
  return once(part,' return result;\n}', ' return replacement?{...result,position}:result;\n}\n'+replaceFooter);
 });
 source=edit(source,'createImageList',part=>{
  part=once(part,'parenting=false}={}){','parenting=false,savedInput=null}={}){');
  part=once(part,'  const input=inputValues();','  const input=savedInput||inputValues();');
  part=once(part,'  const heldPlan=await qualityMigrateKnown(readRun());','  const heldPlan=await qualityMigrateKnown(readRun());\n  const replacement=heldPlan?.articleKey===editorArticleKey()&&profileRunOnlyFinal(heldPlan,FINAL_URL)?heldPlan:null;');
  part=once(part,'  let imageInsertPos=cardAnchorFromSelection(view);','  const before=view.state.doc;\n  let imageInsertPos=cardAnchorFromSelection(view);');
  part=once(part,'  if(leftover.images||leftover.cards||leftover.headings||leftover.activities){','  if(!replacement&&(leftover.images||leftover.cards||leftover.headings||leftover.activities)){');
  return once(part,"  if(!rows.length)throw new Error('貼り付け対象が0件です');",`  if(!rows.length)throw new Error('貼り付け対象が0件です');
  if(stopRequested)throw new Error('手動停止');
  if(replacement)imageInsertPos=await replaceFinalOnlyProfileRun(view,replacement,before,imageInsertPos);`);
 });
 source=edit(source,'pasteSavedSpecial',part=>once(part,'async function pasteSavedSpecial(){',`async function pasteSavedSpecial(){
 const previous=readRun();
 if(previous?.articleKey===editorArticleKey()&&profileRunOnlyFinal(previous,FINAL_URL)){
  const {sources,mode,count,choice,special,workmom,parenting}=previous;
  if(!previous.coreImageRun||special||workmom||parenting||!parseUnifiedSources(sources).length||mode!=='all'&&!(Number(count)>0)){
   setStatus('対象が0人だった保存分です。上のURL・#を確認して「① 画像を貼る」を押してください',true);
   return;
  }
  return createImageList({savedInput:{sources,mode,count,choice}});
 }`));
 return edit(source,'createCardsAtTap',part=>once(part,"  if(!run||!rows.length)throw new Error('先に紹介する記事を読み込んでください');",`  if(!run||!rows.length)throw new Error('先に紹介する記事を読み込んでください');
  if(!run.gallery126&&rows.every(row=>row.finalMarker))throw new Error('対象が0人だった保存分です。「再開」で読み込み直してください');`));
}
const coreRunMessage=JSON.stringify('URL・#・マガジンから作った一覧があります。画像の続きは「再開」、カードは「② 通知カード」を使ってください');
export function transformEditorEmptyRun(source){
 source=edit(source,'restartFixed300',part=>once(part,'  stopRequested=false;\n  if(run?.likesHistoryFix230','  stopRequested=false;\n  if(run?.coreImageRun&&!profileRunOnlyFinal(run,FINAL_URL))throw new Error('+coreRunMessage+');\n  if(run?.likesHistoryFix230'));
 source=edit(source,'resumeFixed300',part=>{
  part=once(part,"  if(run?.pauseStage==='cards'&&", "  const onlyFinal=profileRunOnlyFinal(run,FINAL_URL);\n  if(run?.pauseStage==='cards'&&!onlyFinal&&");
  return once(part,'  if(run?.items?.length||run?.rows?.length)return createFixed300();',`  if(onlyFinal){
   const options=historyOptions({...run,likesHistory:true,rows:undefined});
   const bridge=await Promise.resolve(GM_getValue(BRIDGE_KEY,null));
   return bridge?.people?.length&&sameHistoryFilter(bridge.historyFilter,options.historyFilter)?createFixed300(options):startFixed300(options);
  }
  if(run?.items?.length||run?.rows?.length)return createFixed300();`);
 });
 return edit(source,'createFixed300',part=>{
  part=once(part,'  existing=await summaryRepairCompleted(view,existing);',`  const replacement=!options?.gallery126&&existing?.articleKey===editorArticleKey()&&profileRunOnlyFinal(existing,FINAL_URL)?existing:null;
  if(replacement)existing=null;
  if(existing?.coreImageRun&&!options?.gallery126)throw new Error(`+coreRunMessage+`);
  existing=await summaryRepairCompleted(view,existing);`);
  part=once(part,'  const initialAnchor=gallery&&!existing?cardAnchorFromSelection(view):null,initialDoc=view.state.doc;',`  const initialAnchor=(gallery&&!existing||replacement)?cardAnchorFromSelection(view):null,initialDoc=view.state.doc;`);
  part=once(part,'  if(!gallery)rows=excludePendingCreatorRows(rows,existing||{});',`  if(!gallery){
   rows=excludePendingCreatorRows(rows,existing||{});
   if(rows.every(row=>row.finalMarker))throw new Error('条件に合うクリエイターが0人です');
  }`);
  part=once(part,'  let run=readRun();\n  if(!run?.likesHistoryFix230',`  let run=readRun(),replacementPosition=null;
  if(replacement){
   checkPause();
   if(stopRequested)throw new Error('停止しました');
   replacementPosition=await page.__MUMEI_PROFILE_CARD_REPLACE_FINAL_ONLY__(view,replacement,initialDoc,initialAnchor);
   run=null;
  }
  if(!run?.likesHistoryFix230`);
  return once(part,'imageAnchorPos:gallery?initialAnchor:cardAnchorFromSelection(view)', 'imageAnchorPos:gallery?initialAnchor:replacementPosition??cardAnchorFromSelection(view)');
 });
}
