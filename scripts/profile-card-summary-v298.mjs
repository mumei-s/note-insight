// Migrate old introductions on the standalone tool's resume paths, using
// the saved article URL for both the introduction and its linked thumbnail.
function once(source,from,to){if(source.split(from).length!==2)throw Error('Summary hook must match once: '+from.slice(0,110));return source.replace(from,()=>to)}
function changeFunction(source,name,edit){
 const start=source.search(new RegExp('^(?:async )?function '+name+'\\(','m'));if(start<0)throw Error('Missing summary function '+name);
 const match=/\n(?:async )?function [A-Za-z]/.exec(source.slice(start)),end=match?start+match.index+1:source.length;
 return source.slice(0,start)+edit(source.slice(start,end))+source.slice(end);
}
const helpers=String.raw`
function legacySummary(row){
 return row.presentation?.version===1&&row.presentation.content==='summary';
}
function summaryNeedsRefresh(row){
 return legacySummary(row)&&(row.presentation.status!=='available'||String(row.presentation.text||'').includes('無料公開本文を取得できません'));
}
async function summaryRefreshRows(rows,completed=0,ownedTexts={},selection=null){
 const outdated=row=>selection
  ?row.presentation?.version!==3||row.presentation.content!==selection.content||row.presentation.size!==selection.size
  :legacySummary(row);
 const canRefresh=(row,index)=>index>=completed&&outdated(row)&&!ownedTexts[norm(row.url)];
 if(!rows.some(canRefresh))return rows;
 const refreshed=rows.slice();
 for(let index=completed;index<rows.length;index++){
  if(stopRequested)throw new Error('停止しました');
  const row=rows[index];if(!canRefresh(row,index))continue;
  const selected=selection||row.presentation;
  let note=null,profile=null;
  if(selected.content==='summary'||selected.content==='lead'){
   try{const response=await xhrJSON('https://note.com/api/v3/notes/'+encodeURIComponent(row.key));note=response?.data||response||null}
   catch(error){if(stopRequested)throw error}
  }
  const profileAccount=qualityCall('provenance',[row],null)?.profile?.account;
  const savedProfile=row.profileText&&profileAccount?{profileText:row.profileText,urlname:profileAccount}:null;
  let presentation=contentApi.compose(row,note||{},savedProfile,selected);
  if(selected.content!=='name'&&presentation.display==='name'&&!row.finalMarker){
   try{
    const response=await xhrJSON('https://note.com/api/v2/creators/'+encodeURIComponent(row.urlname));
    const data=response?.data||response||{};
    profile=data.creator||data.user||data;
   }catch(error){if(stopRequested)throw error}
   presentation=contentApi.compose(row,note||{},profile,selected);
  }
  const updated={...row,presentation};
  refreshed[index]=note||profile?qualityCall('acquired',[updated,{target:row.urlname,note,profile,selected:row}],updated):updated;
 }
 return refreshed;
}
async function summaryRepairCompleted(view,run){
 if(!run?.rows?.length||run.articleKey!==editorArticleKey()||run.gallery126)return run;
 const completed=new Set((run.items||[]).map(item=>norm(item.url)));
 const first=run.rows.findIndex(row=>completed.has(norm(row.url))&&summaryNeedsRefresh(row));
 if(first<0)return run;
 contentApi.clearListedArticles();
 setStatus('保存済みの要約エラーを再取得中｜完成済みの画像も作り直します');
 const before=view.state.doc,signature=JSON.stringify({rows:run.rows,items:run.items,cardKeys:run.cardKeys});
 const rows=await summaryRefreshRows(run.rows,first);
 for(const row of rows.slice(first))await qualityGate(row,null,'images');
 if(stopRequested)throw new Error('停止しました');
 const current=readRun();
 if(!current||current.createdAt!==run.createdAt||current.articleKey!==run.articleKey||signature!==JSON.stringify({rows:current.rows,items:current.items,cardKeys:current.cardKeys})||!view.state.doc.eq(before))throw new Error('再取得中に本文か作成記録が変更されました。再開で確認し直します');
 return page.__MUMEI_PROFILE_CARD_SUMMARY_REBUILD__(view,current,rows,first);
}
function summarySyncCardAnchor(view){
 const run=readRun();if(!run?.summaryRebuiltAt||!run.cardKeys?.length)return;
 const keys=new Set(run.cardKeys.map(record=>String(record.key||'')));
 const first=embedNodes(view).filter(hit=>keys.has(cardKey(hit))).sort((a,b)=>a.pos-b.pos)[0];
 if(first&&run.cardAnchorPos!==first.pos)writeRun({...run,cardAnchorPos:first.pos,updatedAt:Date.now()});
}
`;
// A completed PNG cannot be fixed by replacing its cached text. Rewind only
// this tool's owned output from the first failed summary, then let the normal
// serial uploader rebuild it. The earlier successful prefix and original note
// content survive. The original article and its card retain the same URL.
const rebuild=String.raw`
async function summaryRebuildTail(view,run,rows,first){
 const tail=new Set(run.rows.slice(first).map(row=>norm(row.url))),baseline=generatedContentBaselinePositions(view,run);
 const images=resolveOwnedImageHits(view).filter(hit=>tail.has(norm(hit.node.attrs?.link))&&!baseline.has(hit.pos));
 const hits=[...images,...resolveOwnedDividerHits(view,images)];
 const blocks=[];view.state.doc.forEach((node,pos)=>blocks.push({node,pos}));
 const removedTexts=new Map();
 const imageByUrl=new Map(images.map(image=>[norm(image.node.attrs?.link),image]));
 for(const [url,text] of Object.entries(run.presentationTexts||{})){
  if(!tail.has(norm(url)))continue;
  const image=imageByUrl.get(norm(url));
  const above=image?blocks[blocks.findIndex(block=>block.pos===image.pos)-1]:blocks.find(block=>block.pos===run.presentationPositions?.[url]);
  if(!above||above.node.type?.name!=='paragraph'||above.node.textContent!==text||baseline.has(above.pos))throw new Error('作り直す紹介文の位置を確認できません');
  hits.push(above);
  removedTexts.set(text,(removedTexts.get(text)||0)+1);
 }
 const from=hits.length?Math.min(...hits.map(hit=>hit.pos)):view.state.doc.content.size,headings=new Set(run.sectionHeadings||[]),removedHeadings=new Set();
 for(const hit of blocks)if(hit.pos>=from&&!baseline.has(hit.pos)&&hit.node.type?.name==='heading'&&headings.has(hit.node.textContent)){hits.push(hit);removedHeadings.add(hit.node.textContent)}
 const retainedActivity=(run.activityTexts||[]).filter(text=>{
  const count=removedTexts.get(text)||0;
  if(count)removedTexts.set(text,count-1);
  return !count;
 });
 const before=view.state.doc,unique=[...new Map(hits.map(hit=>[hit.pos,hit])).values()].sort((a,b)=>b.pos-a.pos);
 let transaction=view.state.tr;
 for(const hit of unique){if(!before.nodeAt(hit.pos)?.eq(hit.node))throw new Error('要約画像の位置を確認できません');transaction=transaction.delete(hit.pos,hit.pos+hit.node.nodeSize)}
 const map=value=>value!=null&&value!==''&&Number.isFinite(Number(value))?transaction.mapping.map(Number(value)):value;
 const retained=value=>Object.fromEntries(Object.entries(value||{}).filter(([url])=>!tail.has(norm(url))));
 const positions=Object.fromEntries(Object.entries(retained(run.presentationPositions)).map(([url,pos])=>[url,map(pos)]));
 const updated={...run,version:VERSION,rows,items:(run.items||[]).filter(item=>!tail.has(norm(item.url))),
  presentationTexts:retained(run.presentationTexts),presentationPositions:positions,presentationLayouts:retained(run.presentationLayouts),
  activityTexts:retainedActivity,sectionHeadings:(run.sectionHeadings||[]).filter(text=>!removedHeadings.has(text)),
  dividerUrls:(run.dividerUrls||[]).filter(url=>!tail.has(norm(url))),
  coreDividerRecords:(run.coreDividerRecords||[]).filter(record=>!tail.has(norm(record.image?.url))),coreExternalDividerRecords:(run.coreExternalDividerRecords||[]).filter(record=>!tail.has(norm(record.image?.url))),
  imageAnchorPos:map(run.imageAnchorPos),cardAnchorPos:map(run.cardAnchorPos),stage:'images_building',paused:false,pauseStage:null,pendingCoreDivider:null,
  summaryRebuiltAt:Date.now(),updatedAt:Date.now(),...(run.likesHistoryFix230?{count:rows.length-1}:{})};
 delete updated.imagesCompletedAt;
 view.dispatch(transaction);
 writeRun(updated);await page.__MUMEI_PROFILE_CARD_RUN_STORE__?.flush?.();
 setStatus('紹介文を確認しました｜エラー画像から続けて作り直します');
 return readRun();
}
page.__MUMEI_PROFILE_CARD_SUMMARY_REBUILD__=summaryRebuildTail;
`;
function common(source){
 source=once(source,'const contentApi=page.__MUMEI_PROFILE_CARD_CONTENT__;','const contentApi=page.__MUMEI_PROFILE_CARD_CONTENT__;\n'+helpers);
 return source;
}
export function transformCoreSummary(source){
 source=common(source);
 source=once(source,'async function summaryRepairCompleted(view,run){',rebuild+'\nasync function summaryRepairCompleted(view,run){');
 source=changeFunction(source,'pasteSavedSpecial',part=>{
  part=once(part,'  const recoveredBoundary=await resumePendingCoreDivider(view,run);run=readRun()||run;','  run=await summaryRepairCompleted(view,run);\n  const recoveredBoundary=await resumePendingCoreDivider(view,run);run=readRun()||run;');
  part=once(part,"  if(ownedCards.length)throw new Error('通知カードがすでにあります。画像の続き貼り付けはできません');","  if(ownedCards.length&&!run.summaryRebuiltAt)throw new Error('通知カードがすでにあります。画像の続き貼り付けはできません');");
  part=once(part,"  await saveOnce('保存分の続き '+rows.length+'/'+rows.length+' 完了｜保存中…');","  summarySyncCardAnchor(view);\n  await saveOnce('保存分の続き '+rows.length+'/'+rows.length+' 完了｜保存中…');");
  return once(part,'  const allowedRows=excludePendingCreatorRows(rows,run);','  const summaryRows=await summaryRefreshRows(rows,run.items?.length||0,run.presentationTexts);\n  if(summaryRows!==rows){rows=summaryRows;run={...run,rows,updatedAt:Date.now()};writeRun(run);await page.__MUMEI_PROFILE_CARD_RUN_STORE__?.flush?.();}\n  const allowedRows=excludePendingCreatorRows(rows,run);');
 });
 return source;
}
export function transformEditorSummary(source){
 source=common(source);
 // A compatible preparation can contain skips made by the former summary-only
 // requirement. Retry those preparations under the current fallback policy.
 source=changeFunction(source,'buildRows',part=>{
  part=once(part,' let rows=Array.isArray(saved?.rows)&&compatible?saved.rows:[];', ' const retryLegacySkips=compatible&&saved.skipped?.some(person=>person.code===\'SUMMARY_UNAVAILABLE\');\n let rows=Array.isArray(saved?.rows)&&compatible&&!retryLegacySkips?saved.rows:[];');
  part=once(part,'saved.signature===signature?saved.skipped:[]','saved.signature===signature&&!retryLegacySkips?saved.skipped:[]');
  return once(part,'let index=compatible?Number(saved.index||0):0;','let index=compatible&&!retryLegacySkips?Number(saved.index||0):0;');
 });
 source=changeFunction(source,'createFixed300',part=>{
  part=once(part,'  existing=await qualityPrepareRun(existing);','  existing=await qualityPrepareRun(existing);\n  existing=await summaryRepairCompleted(view,existing);');
  part=once(part,"  writeRun({...run,stage:'images_ready',paused:false,pauseStage:null,rows,imagesCompletedAt:Date.now(),updatedAt:Date.now()});","  writeRun({...run,stage:'images_ready',paused:false,pauseStage:null,rows,imagesCompletedAt:Date.now(),updatedAt:Date.now()});\n  summarySyncCardAnchor(view);");
  return once(part,'  rows=assignDesigns(rows);','  rows=await summaryRefreshRows(rows,existing?.items?.length||0,existing?.presentationTexts);\n  rows=assignDesigns(rows);');
 });
 source=changeFunction(source,'resumeFixed300',part=>once(part,"if(run?.pauseStage==='cards'&&!galleryNeedsParticipantUpgrade(run)","if(run?.pauseStage==='cards'&&!(run.rows||[]).some(summaryNeedsRefresh)&&!galleryNeedsParticipantUpgrade(run)"));
 return changeFunction(source,'restartFixed300',part=>{
  part=once(part,'  const options=historyOptions(),run=readRun();','  const options=historyOptions(),run=readRun(),selection=contentApi.readOptions();\n  stopRequested=false;');
  part=once(part,'   const previous=historyOptions(run),same=','   const before=view.state.doc;\n   contentOptions=selection;\n   const previous=historyOptions(run),same=');
  part=once(part,'   rows=compactHistoryRows(rows);',`   rows=await summaryRefreshRows(rows,0,{},selection);
   if(stopRequested||readRun()?.createdAt!==run.createdAt||!view.state.doc.eq(before))throw new Error('紹介文の取得中に本文か作成記録が変わりました');
   rows=compactHistoryRows(rows);`);
  return once(part,'writeRun({...run,version:VERSION,mode:options.mode','writeRun({...run,version:VERSION,showCreatorRanges:selection.showCreatorRanges,mode:options.mode');
 });
}
