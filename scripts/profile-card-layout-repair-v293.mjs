// An explicitly requested, local repair of already owned output. Merely loading
// the distribution or opening the quality panel never edits an article.
function once(source,from,to){
 if(source.split(from).length!==2)throw Error('Layout repair hook must match once: '+from.slice(0,100));
 return source.replace(from,()=>to);
}
export const layoutRepairRuntime=String.raw`
// BEGIN EXPLICIT OWNED LAYOUT REPAIR
let layoutRepairPlan=null,layoutRepairSerial=0;
function layoutRepairBusy(){return busy||fixedRunBusy()}
function layoutRepairError(message){throw new Error('表示修正を停止：'+message+'。本文と保存記録は保持しています')}
function layoutRepairSnapshot(run){return JSON.stringify(run)}
function layoutRepairMeasure(view){
 let width=288,font=20;
 try{
  const dom=view.dom,style=dom&&page.getComputedStyle?.(dom),client=Number(dom?.clientWidth)||Number(dom?.getBoundingClientRect?.().width);
  if(client>0)width=client-(parseFloat(style?.paddingLeft)||0)-(parseFloat(style?.paddingRight)||0);
  if(parseFloat(style?.fontSize)>0)font=parseFloat(style.fontSize);
 }catch{}
 return{bodyWidthPx:Math.max(160,Math.min(1600,width)),fontBasePx:Math.max(10,Math.min(48,font)),version:2};
}
function layoutRepairLineCount(text){return(String(text||'').match(/\\text\{/g)||[]).length}
function layoutRepairImages(view,run){
 const records=Array.isArray(run.items)?run.items:[];
 if(!records.length)layoutRepairError('この下書きに作成済み画像の記録がありません');
 const all=imageNodes(view);
 for(const record of records){
  const matches=all.filter(hit=>norm(hit.node.attrs?.link)===norm(record.url)&&(record.id?String(hit.node.attrs?.id||'')===String(record.id):record.src&&String(hit.node.attrs?.src||'')===String(record.src)));
  if(matches.length!==1)layoutRepairError('作成画像の識別情報が不足または重複しています');
 }
 const urls=new Set(),result=[];
 for(const hit of resolveOwnedImageHits(view)){
  const attrs=hit.node.attrs||{},url=norm(attrs.link);
  const matched=records.filter(record=>norm(record.url)===url&&((record.id&&String(record.id)===String(attrs.id||''))||(record.src&&String(record.src)===String(attrs.src||''))));
  if(!matched.length)continue;
  if(matched.length!==1||urls.has(url))layoutRepairError('作成済み画像を一人分ずつ特定できません');
  const row=(run.rows||[]).filter(person=>norm(person.url)===url);
  if(row.length!==1)layoutRepairError('画像と人物の保存記録が一致しません');
  urls.add(url);result.push({hit,row:row[0],url});
 }
 if(result.length!==records.length)layoutRepairError('保存記録にある画像の一部を確認できません');
 return result.sort((a,b)=>a.hit.pos-b.hit.pos);
}
function previewLayoutRepair(){
 layoutRepairPlan=null;
 if(layoutRepairBusy())layoutRepairError('実行中の処理を一時停止してから確認してください');
 const view=findView(),run=readRun(),articleKey=editorArticleKey();
 if(!view||!run||!articleKey||run.articleKey!==articleKey||run.createdAt==null)layoutRepairError('この記事の本文・作成記録を確認できません');
 if(run.pendingCard)layoutRepairError('通知カードの変換結果が未確定です');
 const dividers=page.__MUMEI_PROFILE_CARD_DIVIDERS__,content=page.__MUMEI_PROFILE_CARD_CONTENT__;
 if(!dividers?.owned||!dividers?.create||!dividers?.record||!dividers?.isDivider||!content?.aboveText)layoutRepairError('表示修正の処理を読み込めません');
 const snapshot=layoutRepairSnapshot(run),saved=JSON.parse(snapshot),images=layoutRepairImages(view,saved),blocks=[];
 const pending=saved.pendingCoreDivider;
 if(pending){
  const same=(first,second)=>dividers.sameImage?.(first,second)??(first?.id&&first.id===second?.id&&norm(first.url)===norm(second.url));
  if(pending.runId!==saved.createdAt||pending.articleKey!==saved.articleKey||images.filter(image=>same(pending.image,dividers.identity?.(image.hit,image.row)||{id:image.hit.node.attrs?.id,src:image.hit.node.attrs?.src,url:image.url})).length!==1)layoutRepairError('区切り線の途中記録に対応する作成画像を確認できません');
 }
 view.state.doc.forEach((node,pos)=>blocks.push({node,pos}));
 const measure=content.presentationContext?.(view)||layoutRepairMeasure(view),changes=[],samples=[],activityIndices=new Set(),seenPresentation=new Set();
 let paragraphCount=0,dividerCount=0,reconciledDividerCount=0;
 for(const image of images){
  const {hit,row,url}=image,owned=saved.presentationTexts?.[url];
  if(owned!==undefined){
   if(typeof owned!=='string'||!row.presentation)layoutRepairError('紹介文の取得元と保存記録を確認できません');
   if(typeof content.matchesAboveText!=='function'||!content.matchesAboveText(row,owned,saved.presentationLayouts?.[url]))layoutRepairError('保存済みの紹介内容が変わっているため、表示だけの修正として確認できません');
   const blockIndex=blocks.findIndex(block=>block.pos===hit.pos),previous=blocks[blockIndex-1];
   if(!previous||previous.node.type?.name!=='paragraph'||previous.node.textContent!==owned)layoutRepairError('紹介文が対象画像の直前にあることを確認できません');
   const activityIndex=(saved.activityTexts||[]).findIndex((text,index)=>text===owned&&!activityIndices.has(index));
   if(activityIndex<0)layoutRepairError('紹介文の作成記録が不足しています');
   activityIndices.add(activityIndex);seenPresentation.add(url);
   const next=content.aboveText(row,measure.bodyWidthPx,measure.fontBasePx);
   if(typeof next!=='string'||!next)layoutRepairError('同じ紹介内容から修正後の表示を生成できません');
   if(next!==owned){
    const layout=content.aboveLayout?.(row,measure.bodyWidthPx,measure.fontBasePx);
    changes.push({kind:'paragraph',pos:previous.pos,node:previous.node,url,row,old:owned,text:next,activityIndex,layout,contract:content.layoutContract?.(layout)||{...measure,version:2}});paragraphCount++;
    if(samples.length<3){const source=Array.from(String(row.presentation.text||'')).slice(0,220).join('');samples.push({name:String(row.creator||''),before:'従来の紹介枠（'+layoutRepairLineCount(owned)+'行）',after:'コンパクトな紹介枠（'+(layout?.lineCount||layoutRepairLineCount(next))+'行）',beforeText:source,afterText:source});}
   }
  }else if(content.aboveText(row,measure.bodyWidthPx,measure.fontBasePx))layoutRepairError('紹介文の所有記録がないため推測で修正できません');
  const divider=dividers.owned(view,hit,saved);
  if(!divider){
   const imageIdentity=dividers.identity?.(hit,row)||{id:hit.node.attrs?.id,src:hit.node.attrs?.src,url};
   const matchesImage=identity=>dividers.sameImage?.(identity,imageIdentity)??(identity?.id&&identity.id===imageIdentity.id&&norm(identity.url)===url);
   if((saved.coreDividerRecords||[]).some(record=>record.runId===saved.createdAt&&record.articleKey===saved.articleKey&&matchesImage(record.image)))layoutRepairError('記録済みの区切り線の位置・内容を確認できません');
   const external=dividers.external?.(view,hit,saved);if(external)continue;
   if((saved.coreExternalDividerRecords||[]).some(record=>record.runId===saved.createdAt&&record.articleKey===saved.articleKey&&matchesImage(record.image)))layoutRepairError('記録済みの既存区切り線の位置・内容が変わっています');
   const nextPos=hit.pos+hit.node.nodeSize,nextNode=view.state.doc.nodeAt(nextPos);
   if(pending&&matchesImage(pending.image)&&dividers.isDivider(view,nextNode)){
    let record;try{record=dividers.externalRecord?.(view,row,hit,nextNode,saved)}catch{}
    if(!record||record.ownership!=='unconfirmed')layoutRepairError('保留中の既存区切り線を記録復旧の対象として確認できません');
    changes.push({kind:'external-divider',pos:nextPos,node:nextNode,image:hit,row,url,externalRecord:record});reconciledDividerCount++;
    samples.unshift({name:String(row.creator||''),before:'画像直後に既存の区切り線（記録未確定）',after:'既存の線を残し、所有未確認の対応記録だけ復旧',beforeText:'区切り線は追加・削除しません',afterText:'同じ画像・同じ区切り線を保持します'});samples.splice(3);
    continue;
   }
   const node=dividers.create(view);if(!node)layoutRepairError('区切り線を生成できません');
   changes.push({kind:'divider',pos:hit.pos+hit.node.nodeSize,node,image:hit,row,url});dividerCount++;
  }
 }
 for(const url of Object.keys(saved.presentationTexts||{}))if(!seenPresentation.has(url))layoutRepairError('紹介文に対応する作成画像を確認できません');
 const token='layout-'+Date.now().toString(36)+'-'+(++layoutRepairSerial),plan={token,view,doc:view.state.doc,runSnapshot:snapshot,articleKey,runId:run.createdAt,changes,images,measure,paragraphs:paragraphCount,dividers:dividerCount,reconciledDividers:reconciledDividerCount};
 layoutRepairPlan=plan;
 return{token,changeCount:changes.length,paragraphs:paragraphCount,dividers:dividerCount,reconciledDividers:reconciledDividerCount,samples,message:changes.length?'紹介文 '+paragraphCount+'件・区切り線の追加 '+dividerCount+'件'+(reconciledDividerCount?'・既存区切り線の記録復旧 '+reconciledDividerCount+'件（既存の線は追加・削除せず、所有未確認のまま保持）':'')+'を確認できます。画像・リンク・名前・本文内容はそのままです。':'修正が必要な作成分はありません。'};
}
function layoutRepairMatches(plan){
 const run=readRun();return!!plan&&findView()===plan.view&&plan.view.state.doc===plan.doc&&editorArticleKey()===plan.articleKey&&run?.articleKey===plan.articleKey&&run.createdAt===plan.runId&&layoutRepairSnapshot(run)===plan.runSnapshot;
}
function layoutRepairMapPosition(value,mapping,association=1){return value!==null&&value!==''&&Number.isFinite(Number(value))?mapping.map(Number(value),association):value}
async function applyLayoutRepair(token){
 const plan=layoutRepairPlan;
 if(!plan||token!==plan.token)layoutRepairError('確認結果が古くなりました。もう一度「修正内容を確認」を押してください');
 if(layoutRepairBusy())layoutRepairError('実行中の処理を一時停止してから修正してください');
 if(!layoutRepairMatches(plan))layoutRepairError('確認後に本文または作成記録が変わりました。もう一度確認してください');
 layoutRepairPlan=null;
 if(!plan.changes.length)return{applied:false,changeCount:0,paragraphs:0,dividers:0,reconciledDividers:0,saved:'unchanged',message:'修正が必要な作成分はありません。'};
 const view=plan.view,run=JSON.parse(plan.runSnapshot),dividers=page.__MUMEI_PROFILE_CARD_DIVIDERS__,paragraphChanges=plan.changes.filter(change=>change.kind==='paragraph');
 let transaction=view.state.tr;
 // At a shared boundary, replace the old paragraph before inserting the HR in
 // front of it. Higher original positions are always processed first.
 const ordered=plan.changes.filter(change=>change.kind!=='external-divider').sort((a,b)=>b.pos-a.pos||(a.kind==='paragraph'?-1:1));
 for(const change of ordered){
  if(change.kind==='paragraph'){
   const current=plan.doc.nodeAt(change.pos);if(!current?.eq?.(change.node))layoutRepairError('紹介文の位置が変わりました');
   const marks=current.firstChild?.marks||[],text=view.state.schema.text(change.text,marks),replacement=current.type.create(current.attrs,text,current.marks);
   transaction=transaction.replaceWith(change.pos,change.pos+current.nodeSize,replacement);
  }else transaction=transaction.insert(change.pos,change.node);
 }
 const expected=transaction.doc,mapping=transaction.mapping,updated={...run,presentationTexts:{...(run.presentationTexts||{})},presentationPositions:{...(run.presentationPositions||{})},presentationLayouts:{...(run.presentationLayouts||{})},activityTexts:[...(run.activityTexts||[])]};
 for(const [url,pos] of Object.entries(updated.presentationPositions))updated.presentationPositions[url]=layoutRepairMapPosition(pos,mapping,1);
 for(const change of paragraphChanges){updated.presentationTexts[change.url]=change.text;updated.presentationPositions[change.url]=mapping.map(change.pos,1);updated.presentationLayouts[change.url]=change.contract;updated.activityTexts[change.activityIndex]=change.text;}
 if(Object.prototype.hasOwnProperty.call(updated,'imageAnchorPos'))updated.imageAnchorPos=layoutRepairMapPosition(updated.imageAnchorPos,mapping,-1);
 if(Object.prototype.hasOwnProperty.call(updated,'cardAnchorPos'))updated.cardAnchorPos=layoutRepairMapPosition(updated.cardAnchorPos,mapping,1);
 for(const key of ['contentBaselineNodes','cardBaselineNodes'])if(Array.isArray(updated[key]))updated[key]=updated[key].map(record=>record&&typeof record==='object'&&Object.prototype.hasOwnProperty.call(record,'pos')?{...record,pos:layoutRepairMapPosition(record.pos,mapping,1)}:record);
 if(updated.pendingCard)updated.pendingCard={...updated.pendingCard,pos:layoutRepairMapPosition(updated.pendingCard.pos,mapping,-1)};
 const newDividerRecords=[];
 for(const change of plan.changes.filter(change=>change.kind==='divider')){
  const imagePos=mapping.map(change.image.pos,1),imageNode=expected.nodeAt(imagePos),dividerPos=imagePos+imageNode?.nodeSize,dividerNode=expected.nodeAt(dividerPos);
  if(imageNode?.type?.name!=='image'||norm(imageNode.attrs?.link)!==change.url||!dividerNode?.eq?.(change.node))layoutRepairError('修正後の画像と区切り線の対応を確認できません');
  newDividerRecords.push(dividers.record(change.row,{node:imageNode,pos:imagePos},dividerNode,updated));
 }
 const sameImage=(first,second)=>typeof dividers.sameImage==='function'?dividers.sameImage(first,second):String(first?.id||'')===String(second?.id||'')&&String(first?.src||'')===String(second?.src||'')&&norm(first?.url)===norm(second?.url);
 if(newDividerRecords.length){
  updated.coreDividerFormat=1;updated.coreDividerRecords=[...(updated.coreDividerRecords||[]).filter(record=>!newDividerRecords.some(next=>sameImage(next.image,record.image))),...newDividerRecords];updated.dividerUrls=[...new Set([...(updated.dividerUrls||[]),...newDividerRecords.map(record=>record.image.url)])];
  if(updated.pendingCoreDivider?.runId===run.createdAt&&updated.pendingCoreDivider?.articleKey===run.articleKey&&newDividerRecords.some(record=>sameImage(record.image,updated.pendingCoreDivider.image)))delete updated.pendingCoreDivider;
 }
 const externalRecords=[];
 for(const change of plan.changes.filter(change=>change.kind==='external-divider')){
  // This is an explicit acknowledgement of an existing legacy boundary, not
  // proof that the tool inserted it. It remains excluded from owned deletion.
  const verified=dividers.externalRecord?.(view,change.row,change.image,change.node,run);
  const imagePos=mapping.map(change.image.pos,1),imageNode=expected.nodeAt(imagePos),node=expected.nodeAt(imagePos+imageNode?.nodeSize);
  if(!verified||verified.ownership!=='unconfirmed'||imageNode?.type?.name!=='image'||norm(imageNode.attrs?.link)!==change.url||!node?.eq?.(change.node))layoutRepairError('復旧後の既存区切り線の対応を確認できません');
  externalRecords.push(verified);
 }
 if(externalRecords.length){
  updated.coreDividerFormat=1;updated.coreExternalDividerRecords=[...(updated.coreExternalDividerRecords||[]).filter(record=>!externalRecords.some(next=>sameImage(next.image,record.image))),...externalRecords].slice(-1501);
  if(updated.pendingCoreDivider?.runId===run.createdAt&&updated.pendingCoreDivider?.articleKey===run.articleKey&&externalRecords.some(record=>sameImage(record.image,updated.pendingCoreDivider.image)))delete updated.pendingCoreDivider;
 }
 updated.layoutRepair={version:1,at:Date.now(),paragraphs:plan.paragraphs,dividers:plan.dividers,reconciledDividers:plan.reconciledDividers||0,saveState:'pending'};updated.draftSaveState='pending';updated.draftSaveError=null;updated.updatedAt=Date.now();
 // Validation above builds a complete transaction and checkpoint without
 // writing either one. Recheck the exact preview snapshot immediately before it.
 if(!layoutRepairMatches(plan))layoutRepairError('確認後に本文または作成記録が変わりました');
 let dispatchError=null,dispatchFailed=false;if(transaction.docChanged)try{view.dispatch(transaction)}catch(error){dispatchError=error;dispatchFailed=true}
 if(view.state.doc!==expected&&!view.state.doc.eq?.(expected)){if(dispatchFailed)throw dispatchError;throw new Error('表示修正の結果を確認できません。本文を確認してください');}
 writeRun(updated);
 const response={applied:true,changeCount:plan.changes.length,paragraphs:plan.paragraphs,dividers:plan.dividers,reconciledDividers:plan.reconciledDividers||0,saved:'pending'};
 try{
  await page.__MUMEI_PROFILE_CARD_RUN_STORE__?.flush?.();
  if(dispatchFailed){response.message='表示の修正結果と作成記録を保持しました。下書き保存は未確認です：'+(dispatchError?.message||String(dispatchError));return response;}
  const afterFlush=readRun();if(findView()!==view||editorArticleKey()!==plan.articleKey||afterFlush?.createdAt!==plan.runId||afterFlush.articleKey!==plan.articleKey||view.state.doc!==expected)throw new Error('修正後に本文または記事が変わったため、保存操作は送信しませんでした');
  for(const change of paragraphChanges){const pos=updated.presentationPositions[change.url],actual=view.state.doc.nodeAt(pos);if(typeof qualityCall==='function')qualityCall('presentationAt',[change.row,view,{text:change.text,pos,nextPos:pos+actual.nodeSize,layout:change.layout}]);}
  for(const image of layoutRepairImages(view,readRun())){if(typeof dividers.observe==='function')dividers.observe(view,image.row,image.hit);else if(typeof qualityCall==='function')qualityCall('imageBoundary',[image.row,view,image.hit,{dividerRequired:true,isDivider:node=>dividers.isDivider(view,node)}]);}
  const saved=await saveOnce('作成済みの紹介表示・区切り線を修正｜下書き保存中…');
  if(saved===true||saved?.confirmed===true){const current=readRun();if(current?.createdAt===plan.runId&&current.articleKey===plan.articleKey){writeRun({...current,layoutRepair:{...current.layoutRepair,saveState:'confirmed'}});await page.__MUMEI_PROFILE_CARD_RUN_STORE__?.flush?.();response.saved='confirmed';}}
  const recovery=plan.reconciledDividers?'既存区切り線 '+plan.reconciledDividers+'件の対応記録を復旧しました（所有未確認の線として保持）。':'';
  response.message=recovery+(response.saved==='confirmed'?'紹介表示と区切り線の確認・下書き保存を確認しました。':'下書き保存の完了は未確認です。note画面で保存完了を確認してください。');
 }catch(error){response.message=(plan.reconciledDividers?'既存区切り線の対応記録をメモリーに保持しました。':'表示を修正しました。')+'保存は未確認です：'+(error?.message||String(error));}
 return response;
}
page.__MUMEI_PROFILE_CARD_LAYOUT_REPAIR__={preview:previewLayoutRepair,apply:applyLayoutRepair};
// END EXPLICIT OWNED LAYOUT REPAIR
`;
export function transformCoreLayoutRepair(source){
 return once(source,"if(document.readyState==='loading')",layoutRepairRuntime+"\nif(document.readyState==='loading')");
}
