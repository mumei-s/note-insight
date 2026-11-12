function once(source,from,to){
 if(source.split(from).length!==2)throw new Error('Draft hook must match once: '+from.slice(0,110));
 return source.replace(from,()=>to);
}
function edit(source,name,apply){
 const start=source.search(new RegExp('^(?:async )?function '+name+'\\(','m'));
 if(start<0)throw new Error('Missing draft function '+name);
 const next=/\n(?:async )?function [A-Za-z]/.exec(source.slice(start)),end=next?start+next.index+1:source.length;
 return source.slice(0,start)+apply(source.slice(start,end))+source.slice(end);
}

const draftHelpers=String.raw`
function cardsForImageProgress(run){
 const all=Array.isArray(run?.rows)?run.rows:[];
 if(run?.gallery126||run?.imagesCompletedAt||!(run?.stage==='images_building'||run?.partialCardCount))return {rows:all,partialCount:null};
 const completed=completedContinuousCount(all,run.items);
 if(!completed||completed>=all.length)return {rows:all,partialCount:null};
 const rows=all.slice(0,completed),allowed=new Set(rows.map(row=>norm(row.url)));
 const started=[...(run.cardKeys||[]),...(run.pendingCard?[run.pendingCard]:[])];
 if(started.some(card=>!allowed.has(norm(card.url))))return {rows:all,partialCount:null};
 return {rows,partialCount:completed};
}
async function normalizeOwnedIntroductions(view,run,anchors=null){
 if(!run?.presentationTexts||run.articleKey!==editorArticleKey()||run.gallery126||run.pendingCard)return run;
 const before=view.state.doc,records=new Map((run.items||[]).map(item=>[norm(item.url),item])),adjacent=new Map(),positions={...run.presentationPositions};
 let previous=null;
 before.forEach((node,pos)=>{
  if(node.type?.name==='image'){
   const url=norm(node.attrs?.link),record=records.get(url);
   if(record&&(record.id?String(node.attrs?.id||'')===String(record.id):record.src&&String(node.attrs?.src||'')===String(record.src))){
    adjacent.set(url,adjacent.has(url)?null:previous);
   }
  }
  previous={node,pos};
 });
 const rows=new Map((run.rows||[]).map(row=>[norm(row.url),row])),activityTexts=[...(run.activityTexts||[])],activityIndices=new Map();
 for(const [index,text] of activityTexts.entries()){
  const indices=activityIndices.get(text)||[];indices.push(index);activityIndices.set(text,indices);
 }
 const changes=[],used=new Set();
 for(const [url,literal] of Object.entries(run.presentationTexts)){
  const row=rows.get(url);
  if(!row||typeof literal!=='string'||!literal.startsWith('$'+'$'+'{')||!contentApi.matchesAboveText(row,literal,run.presentationLayouts?.[url]))continue;
  const layout=contentApi.aboveLayout(row),text=layout.text;
  if(!text||text===literal)continue;
  let hit=adjacent.get(url);
  if(!records.has(url)&&Number(row.index)===(run.items||[]).length+1&&Number.isSafeInteger(positions[url])){
   hit={pos:positions[url],node:before.nodeAt(positions[url])};
  }
  const indices=activityIndices.get(literal);
  if(hit?.node?.type?.name!=='paragraph'||hit.node.textContent!==literal||used.has(hit.pos)||!indices?.length)continue;
  used.add(hit.pos);
  changes.push({...hit,url,text,activityIndex:indices.shift(),contract:contentApi.layoutContract(layout)});
 }
 if(!changes.length)return run;
 let tr=view.state.tr;
 for(const change of changes.sort((a,b)=>b.pos-a.pos)){
  const {node,pos,text}=change,replacement=node.type.create(node.attrs,view.state.schema.text(text,node.firstChild?.marks),node.marks);
  tr=tr.replaceWith(pos,pos+node.nodeSize,replacement);
 }
 const map=(pos,assoc=1)=>pos!==null&&pos!==''&&Number.isFinite(Number(pos))?tr.mapping.map(Number(pos),assoc):pos;
 const updated={...run,presentationTexts:{...run.presentationTexts},presentationLayouts:{...run.presentationLayouts},presentationPositions:{},activityTexts,updatedAt:Date.now()};
 if(updated.draftSaveState==='confirmed')updated.draftSaveState='pending';
 for(const [url,pos] of Object.entries(positions))updated.presentationPositions[url]=map(pos);
 for(const change of changes){
  updated.presentationTexts[change.url]=change.text;
  updated.presentationLayouts[change.url]=change.contract;
  updated.presentationPositions[change.url]=map(change.pos,-1);
  activityTexts[change.activityIndex]=change.text;
 }
 updated.imageAnchorPos=map(run.imageAnchorPos,-1);
 updated.cardAnchorPos=map(run.cardAnchorPos);
 for(const key of ['cardBaselineNodes','contentBaselineNodes']){
  if(Array.isArray(run[key]))updated[key]=run[key].map(entry=>Number.isFinite(entry?.pos)?{...entry,pos:map(entry.pos)}:entry);
 }
 const expected=tr.doc;
 view.dispatch(tr);
 if(!view.state.doc.eq(expected))throw new Error('紹介文の表示を更新できませんでした');
 if(anchors)anchors.tappedAnchor=map(anchors.tappedAnchor,-1);
 writeRun(updated);
 await page.__MUMEI_PROFILE_CARD_RUN_STORE__?.flush?.();
 return readRun()||updated;
}
page.__MUMEI_PROFILE_CARD_NORMALIZE_INTROS__=normalizeOwnedIntroductions;
`;

export function transformCoreDraft(source){
 source=once(source,'async function saveCompletedCards(total,label){',draftHelpers+'\nasync function saveCompletedCards(total,label){');
 source=edit(source,'saveCompletedCards',part=>{
  part=once(part,"stage:'complete',draftSaveState:'confirmed'","stage:current.partialCardCount?'images_building':'complete',draftSaveState:'confirmed'");
  return once(part,"setStatus('完了 ✅ 画像一覧 '+run.rows.length+'件 → 通知カード '+total+'件');","setStatus(current.partialCardCount?'貼り付け済みの通知カード '+total+'件を保存｜「再開」で画像の続き':'完了 ✅ 通知カード '+total+'件を保存');");
 });
 source=edit(source,'createCardsAtTap',part=>{
  part=once(part,' await keepAwake();\n try{',' await keepAwake();\n let converting=false;\n try{');
  part=once(part,'  const tappedAnchor=anchors.tappedAnchor;', '  await normalizeOwnedIntroductions(view,readRun(),anchors);\n  const tappedAnchor=anchors.tappedAnchor;');
  part=once(part,'  let run=readRun(),rows=Array.isArray(run?.rows)?run.rows.filter(row=>!row.profileOnly):[];',`  let run=readRun();
  const {rows:planned,partialCount}=cardsForImageProgress(run),previousPartial=run?.partialCardCount??null;
  let rows=planned.filter(row=>!row.profileOnly);`);
  part=once(part,'  run=await reconcileCompletedCards(view,run,rows);',`  if(previousPartial){
   const first=resolveOwnedCardHits(view).sort((a,b)=>a.pos-b.pos)[0];
   if(first&&genuineCard(first,rows[0].url))run={...run,cardAnchorPos:first.pos};
  }
  if(previousPartial!==partialCount)run={...run,partialCardCount:partialCount,cardsCompletedAt:null};
  run=await reconcileCompletedCards(view,run,rows);`);
  part=once(part,"   if(run.stage==='complete'&&run.draftSaveState==='confirmed'){","   if((run.stage==='complete'||run.partialCardCount&&run.cardsCompletedAt)&&run.draftSaveState==='confirmed'){");
  part=once(part,"   }else await saveCompletedCards(rows.length,'通知カードは作成済み｜下書き保存を再確認中…');",`   }else{
    writeRun(run);
    await saveCompletedCards(rows.length,'通知カードは作成済み｜下書き保存を再確認中…');
   }`);
  part=once(part,"  setStatus('② 通知カードの続き｜'+done+'/'+rows.length+' 件済み');",`  converting=true;
  setStatus('② 通知カード｜'+done+'/'+rows.length+'件済み'+(partialCount?'（画像の貼り付け済み分）':''));`);
  return once(part,"  setStatus('通知カード停止：'+(e?.message||String(e))+'｜完成分は保持。もう一度②で続きから再開できます',true)","  setStatus((converting?'通知カードを中断｜':'②を開始できません｜')+(e?.message||String(e))+(converting?'｜②でカードの続き':''),true)");
 });
 source=edit(source,'pasteSavedSpecial',part=>{
  part=once(part,'  run=await summaryRepairCompleted(view,run);','  run=await summaryRepairCompleted(view,run);\n  run=await normalizeOwnedIntroductions(view,run);');
  return once(part,'if(ownedCards.length&&!run.summaryRebuiltAt)', 'if(run?.pendingCard||ownedCards.length&&!run.summaryRebuiltAt&&!run.partialCardCount)');
 });
 for(const name of ['createImageList','pasteSavedSpecial'])source=edit(source,name,part=>{
  const suffix=name==='createImageList'?'｜完成分は本文に保持。自動再開はしません':'｜完成分は本文に保持';
  return once(part,"setStatus('停止：'+(e?.message||String(e))+'"+suffix+"',true)","setStatus('画像を中断｜'+(e?.message||String(e))+((readRun()?.items||[]).length?'｜②で貼り付け済み分のカード。「再開」で画像の続き':''),true)");
 });
 source=edit(source,'pauseCoreImagesAtBoundary',part=>once(part,
  "setStatus('一時停止中｜画像 '+done+'/'+total+' 件を確定。'+(saved?.confirmed===false?'保存完了は画面で確認してください。':'保存済み。')+'「再開」で続きから');",
  "setStatus('画像を一時停止｜'+done+'/'+total+'件。②で'+(done?'貼り付け済み分の':'')+'カード。「再開」で画像の続き'+(saved?.confirmed===false?'｜下書き保存を確認してください':''));"
 ));
 source=edit(source,'stop',part=>once(part,"setStatus('停止しました｜途中保存は保持。自動再開もしません')","setStatus(imageRunActive?'画像を停止｜②で貼り付け済み分のカード。「再開」で画像の続き':cardRunActive?'通知カードを停止｜②でカードの続き':'停止しました')"));
 source=once(source,"const POS='mumei_profile_card_paster_pos_v1';","const POS='mumei_profile_card_paster_pos_v1';\nconst mobilePanelQuery='(max-width:700px), (pointer:coarse)';\nfunction panelPositionKey(){return typeof matchMedia==='function'&&matchMedia(mobilePanelQuery).matches?POS+'_mobile_left':POS}");
 source=once(source,"localStorage.getItem(POS)","localStorage.getItem(panelPositionKey())");
 source=once(source,"localStorage.setItem(POS,","localStorage.setItem(panelPositionKey(),");
 const panel=String.fromCharCode(36)+'{PANEL}',mobile=String.fromCharCode(36)+'{mobilePanelQuery}';
 source=once(source,' </style>\n <div class="head">',' @media '+mobile+'{#'+panel+',#'+panel+'-mini{left:max(14px,env(safe-area-inset-left,0px));right:auto;top:max(84px,calc(env(safe-area-inset-top,0px) + 76px))}}\n </style>\n <div class="head">');
 return once(source,"if(g.tiny){p.classList.add('tiny');mini.style.display='flex'}","if(g.tiny){p.classList.add('tiny');mini.style.display='flex';restorePos(mini)}");
}

export function transformEditorDraft(source){
 // The exported function is registered before the continuous wrapper is
 // installed, so forward the call through the binding used by that wrapper.
 source=once(source,'page.__MUMEI_PROFILE_CARD_ENSURE_CARDS_READY__=ensureCardsRunReady;','page.__MUMEI_PROFILE_CARD_ENSURE_CARDS_READY__=(view,anchors)=>ensureCardsRunReady(view,anchors);');
 source=once(source,' if(Array.isArray(run?.rows)&&run.rows.length)return run;\n return continuousEnsureCardsReady',' if(!run?.gallery126&&Array.isArray(run?.rows)&&run.rows.length)return run;\n return continuousEnsureCardsReady');
 source=edit(source,'ensureCardsRunReady',part=>once(part," if(count!==rows.length)throw new Error('本文の画像を照合しました：'+count+'/'+rows.length+'件。完成分は保持しています');",` if(count!==rows.length){
  writeRun({...run,rows,stage:'images_building',updatedAt:Date.now()});
  await flushRunBackup();
  return readRun();
 }`));
 source=edit(source,'resumeFixed300',part=>once(part,"  if(run?.pauseStage==='cards'&&!onlyFinal","  if((run?.pauseStage==='cards'||run?.stage==='cards_building')&&!onlyFinal"));
 source=edit(source,'createFixed300',part=>{
  part=once(part,'  existing=await summaryRepairCompleted(view,existing);','  existing=await summaryRepairCompleted(view,existing);\n  existing=await page.__MUMEI_PROFILE_CARD_NORMALIZE_INTROS__?.(view,existing)||existing;');
  return once(part,"  setStatus(error?.code==='PAUSED'?error.message+pauseNotice:'修正版停止：'+(error?.message||String(error)),error?.code!=='PAUSED')",`  const saved=readRun(),images=(saved?.items||[]).length;
  const imageNotice=images&&!saved?.gallery126?'画像 '+images+'件で中断。②で貼り付け済み分のカード。「再開」で画像の続き':'';
  setStatus(error?.code==='PAUSED'?(imageNotice||error.message)+pauseNotice:'画像を中断｜'+(error?.message||String(error))+(imageNotice?'｜'+imageNotice:''),error?.code!=='PAUSED')`);
 });
 return source;
}
