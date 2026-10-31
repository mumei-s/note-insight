// Generic core image boundaries. The historical sources and the history/gallery
// renderer stay unchanged; only the standalone core gets these checkpoints.
function once(source,from,to){
 if(source.split(from).length!==2)throw Error('Divider hook must match once: '+from.slice(0,105));
 return source.replace(from,()=>to);
}
function editFunction(source,name,edit){
 const start=source.search(new RegExp('^(?:async )?function '+name+'\\(','m'));
 if(start<0)throw Error('Missing divider integration function '+name);
 const close=/\n}\r?\n/.exec(source.slice(start));
 if(!close)throw Error('Missing divider integration boundary '+name);
 const end=start+close.index+close[0].length;
 return source.slice(0,start)+edit(source.slice(start,end))+source.slice(end);
}

const helpers=String.raw`
const CORE_DIVIDER_FALLBACK='────────────';
let coreDividerAnchorWork=null;
function coreDividerType(view){
 const nodes=view.state.schema.nodes;
 for(const name of ['horizontal_rule','horizontalRule','horizontal-rule','divider','separator','hr'])if(nodes[name])return nodes[name];
 for(const type of Object.values(nodes))try{const node=type.createAndFill?.(),dom=node&&type.spec?.toDOM?.(node);if(Array.isArray(dom)&&dom[0]==='hr')return type}catch{}
 return null;
}
function isCoreDivider(view,node){
 if(!node)return false;
 const type=coreDividerType(view);
 return type?node.type===type:node.type?.name==='paragraph'&&node.textContent===CORE_DIVIDER_FALLBACK;
}
function createCoreDivider(view){
 const type=coreDividerType(view);
 // A present native type that fails to construct is an error; the paragraph
 // fallback is used only when this schema has no native rule at all.
 const node=type?(type.createAndFill?.()||type.create()):view.state.schema.nodes.paragraph?.create(null,view.state.schema.text(CORE_DIVIDER_FALLBACK));
 if(!node||!isCoreDivider(view,node))throw new Error('区切り線を作成できません。画像は再送しません');
 return node;
}
function coreDividerImage(hit,row=null){return{id:String(hit?.node?.attrs?.id||''),src:String(hit?.node?.attrs?.src||''),url:norm(row?.url||hit?.node?.attrs?.link||'')}}
function sameCoreDividerImage(first,second){
 if(!first||!second)return false;
 // Reject different stable identities before parsing either URL. Stored image
 // records already carry canonical URLs, so their equal strings need no parse.
 const bothIds=Boolean(first.id&&second.id);
 if(bothIds?first.id!==second.id:!(first.src&&second.src&&first.src===second.src))return false;
 return first.url===second.url||norm(first.url)===norm(second.url);
}
function coreDividerRecord(row,hit,node,run=readRun()){
 const image=coreDividerImage(hit,row);
 if(!run||run.articleKey!==editorArticleKey()||norm(hit?.node?.attrs?.link)!==image.url||!image.url||!image.id&&!image.src)throw new Error('区切り線と画像の対応を確認できません');
 return{version:1,image,kind:node.type?.name==='paragraph'?'fallback':'native',node:node.toJSON(),runId:run.createdAt,articleKey:run.articleKey,at:Date.now()};
}
function coreDividerRecordFor(image,records,run){
 if(!Array.isArray(records)||!records.length)return null;
 const identity=coreDividerImage(image);
 return records.find(record=>record?.version===1&&record.runId===run.createdAt&&record.articleKey===run.articleKey&&sameCoreDividerImage(record.image,identity))||null;
}
function coreDividerEqualsJSON(view,node,json){try{return !!node&&node.eq(view.state.schema.nodeFromJSON(json))}catch{return false}}
function legacyCoreDividerNodeMatches(view,node,json){
 let planned;try{planned=view.state.schema.nodeFromJSON(json)}catch{return false}
 if(!node||!isCoreDivider(view,node))return false;
 const native=coreDividerType(view);
 return native&&planned.type===native&&planned.isLeaf&&node.type===native&&node.isLeaf||node.eq(planned);
}
function legacyCoreDividerProof(view,row,hit,node,run){
 const pending=run?.pendingCoreDivider,identity=coreDividerImage(hit,row);
 if(!run||run.articleKey!==editorArticleKey()||!pending||pending.version!==1||pending.evidence||!['prepared','uncertain'].includes(pending.phase)||pending.runId!==run.createdAt||pending.articleKey!==run.articleKey||!sameCoreDividerImage(pending.image,identity))return false;
 if(norm(hit.node.attrs?.link)!==identity.url||!legacyCoreDividerNodeMatches(view,node,pending.node)||!view.state.doc.nodeAt(hit.pos+hit.node.nodeSize)?.eq(node))return false;
 const rows=(run.rows||[]).filter(item=>norm(item.url)===identity.url);
 if(rows.length!==1||rows[0].key!==row.key||rows[0].urlname!==row.urlname)return false;
 let url;try{url=new URL(identity.url)}catch{return false}
 if(!['note.com','www.note.com'].includes(url.hostname)||url.pathname.split('/')[1]?.toLowerCase()!==String(row.urlname||'').toLowerCase()||noteKey(identity.url)!==row.key)return false;
 // The ownership resolver chooses one by ID. Count the raw nodes independently
 // so duplicated IDs or URLs cannot be collapsed into false uniqueness.
 const matches=imageNodes(view).filter(image=>sameCoreDividerImage(coreDividerImage(image),identity));
 const owned=resolveOwnedImageHits(view).sort((a,b)=>a.pos-b.pos);
 return matches.length===1&&matches[0].pos===hit.pos&&owned.at(-1)?.pos===hit.pos&&(run.items||[]).some(item=>sameCoreDividerImage({id:item.id,src:item.src,url:item.url},identity));
}
function externalCoreDividerRecord(view,row,hit,node,run=readRun()){
 if(!legacyCoreDividerProof(view,row,hit,node,run))throw new Error('既存の区切り線を未確認の境界として保持する根拠が不足しています');
 return{version:1,ownership:'unconfirmed',source:'legacy-pending-v293',plannedMatch:coreDividerEqualsJSON(view,node,run.pendingCoreDivider.node)?'exact':'native-attributes-unconfirmed',image:coreDividerImage(hit,row),kind:node.type?.name==='paragraph'?'fallback':'native',node:node.toJSON(),runId:run.createdAt,articleKey:run.articleKey,at:Date.now()};
}
function externalCoreDivider(view,image,run=readRun()){
 if(!run||!Array.isArray(run.coreExternalDividerRecords)||!run.coreExternalDividerRecords.length)return null;
 const record=coreDividerRecordFor(image,run.coreExternalDividerRecords,run);if(!record)return null;
 const pos=image.pos+image.node.nodeSize,node=view.state.doc.nodeAt(pos);
 const matches=imageNodes(view).filter(hit=>sameCoreDividerImage(coreDividerImage(hit),record.image));
 if(matches.length!==1||matches[0].pos!==image.pos)throw new Error('保持した既存区切り線の画像を一つに特定できません。画像と区切り線は再送しません');
 if(record.ownership!=='unconfirmed'||!isCoreDivider(view,node)||!coreDividerEqualsJSON(view,node,record.node))throw new Error('保持した既存区切り線が移動・変更されています。画像と区切り線は再送しません');
 return{node,pos,record,ownership:'unconfirmed'};
}
function coreDividerBoundary(view,image,run=readRun()){
 const owned=ownedCoreDivider(view,image,run);if(owned)return owned;
 return externalCoreDivider(view,image,run);
}
function validateCoreDividerBoundaries(view,images,run=readRun()){
 if(!run)return;
 const actual=imageNodes(view).map(hit=>({hit,identity:coreDividerImage(hit)}));
 for(const record of [...(run.coreDividerRecords||[]),...(run.coreExternalDividerRecords||[])]){
  if(record.runId!==run.createdAt||record.articleKey!==run.articleKey)continue;
  const hit=images.find(image=>sameCoreDividerImage(coreDividerImage(image),record.image));
  if(!hit)throw new Error('保存済み区切り線に対応する画像を確認できません。画像は再送しません');
  const matches=actual.filter(item=>sameCoreDividerImage(item.identity,record.image));
  if(matches.length!==1||matches[0].hit.pos!==hit.pos)throw new Error('保存済み区切り線に対応する画像を一つに確認できません。画像は再送しません');
  coreDividerBoundary(view,hit,run);
 }
}
function prepareCoreImageAnchor(view,position){
 const pos=Math.max(0,Math.min(view.state.doc.content.size,Number(position)||0)),Selection=selectionApi(),resolved=view.state.doc.resolve(pos);
 const candidate=typeof Selection.near==='function'?Selection.near(resolved):Selection.atEnd(view.state.doc),from=candidate.$from;
 let effective=candidate.from;
 if(from?.depth)effective=from.parentOffset===from.parent.content.size?from.after(1):from.before(1);
 if(effective===pos)return{selected:setSelectionForInsert(view,pos),work:null};
 // Selection.near falls backwards at a trailing native rule. A private empty
 // text block gives note's native uploader an exact insertion position. It is
 // removed only by reference, in the same transaction as this image's rule.
 const node=view.state.schema.nodes.paragraph?.create();if(!node)throw new Error('画像の挿入位置を確保できません');
 const before=view.state.doc,transaction=view.state.tr.insert(pos,node),expected=transaction.doc;let dispatchError=null;
 try{view.dispatch(transaction)}catch(error){
  dispatchError=error;
 }
 let actualPos=pos,actual=view.state.doc.nodeAt(pos);
 let proven=view.state.doc===expected&&actual===node;
 if(!proven){
  const previous=coreEmptyAnchorNeighborhood(before,pos);
  if(actual!==node){
   const matches=[];view.state.doc.descendants((value,at)=>{if(value===node)matches.push({node:value,pos:at})});
   if(matches.length===1){actualPos=matches[0].pos;actual=matches[0].node;}
  }
  const current=coreEmptyAnchorNeighborhood(view.state.doc,actualPos),preserved=previous.nodes.every((value,index)=>current.nodes.includes(value)?current.nodes[index+1]===value:current.nodes[index+1]?.eq(value));
  proven=actual?.type===node.type&&actual.content.size===0&&current.nodes.length===previous.nodes.length+1&&preserved&&(!previous.tail||current.tail===previous.tail||current.tail?.eq(previous.tail));
 }
 if(!proven)throw dispatchError||new Error('画像の挿入位置を確認できません');
 const anchor={selected:0,work:{node:actual,pos:actualPos,before}};
 if(dispatchError){cleanupCoreImageAnchor(view,anchor);throw dispatchError;}
 anchor.selected=setSelectionForInsert(view,actualPos+1);return anchor;
}
function coreEmptyAnchorNeighborhood(doc,pos){
 let at=pos,node=doc.nodeAt(at);const nodes=[];
 while(node?.type?.name==='paragraph'&&node.content.size===0&&nodes.length<1502){nodes.push(node);at+=node.nodeSize;node=doc.nodeAt(at)}
 return{nodes,tail:node};
}
function cleanupCoreImageAnchor(view,anchor){
 const work=anchor?.work;if(!work||view.state.doc.nodeAt(work.pos)!==work.node)return;
 const transaction=view.state.tr.delete(work.pos,work.pos+work.node.nodeSize),expected=transaction.doc;view.dispatch(transaction);
 if(view.state.doc.nodeAt(work.pos)===work.node)throw new Error('画像用の一時段落の解除を確認できません。元の段落は変更していません');
}
function ownedCoreDivider(view,image,run=readRun()){
 if(!run)return null;
 const record=coreDividerRecordFor(image,run.coreDividerRecords,run);
 if(!record)return null;
 const pos=image.pos+image.node.nodeSize,node=view.state.doc.nodeAt(pos);
 if(!isCoreDivider(view,node)||!coreDividerEqualsJSON(view,node,record.node))throw new Error('所有記録のある区切り線が移動・変更されています。画像と区切り線は再送しません');
 return{node,pos,record};
}
function observeCoreDivider(view,row,hit){
 const boundary=coreDividerBoundary(view,hit);if(!boundary)return;
 if(typeof qualityCall==='function'){
  if(boundary.ownership==='unconfirmed'&&typeof quality?.externalBoundary==='function')qualityCall('externalBoundary',[row,view,hit,{isDivider:node=>isCoreDivider(view,node)}]);
  else if(typeof quality?.imageBoundary==='function')qualityCall('imageBoundary',[row,view,hit,{dividerRequired:true,isDivider:node=>isCoreDivider(view,node)}]);
  else qualityCall('divider',[row,boundary.node,node=>isCoreDivider(view,node)]);
 }
}
function coreDividerNeighborhood(view,doc,pos){
 let at=pos,node=doc.nodeAt(at);const rules=[];
 while(isCoreDivider(view,node)&&rules.length<1502){rules.push(node);at+=node.nodeSize;node=doc.nodeAt(at)}
 return{count:rules.length,rules,tail:node,first:doc.nodeAt(pos)};
}
function coreDividerCurrentImage(view,identity,preferred,caption){
 const at=view.state.doc.nodeAt(preferred);
 const valid=node=>node?.type?.name==='image'&&sameCoreDividerImage(coreDividerImage({node}),identity)&&node.textContent===caption;
 if(valid(at))return{node:at,pos:preferred};
 const matches=imageNodes(view).filter(image=>valid(image.node));return matches.length===1?matches[0]:null;
}
function coreDividerInsertionProof(view,identity,preferred,caption,planned,neighborhood){
 const hit=coreDividerCurrentImage(view,identity,preferred,caption);if(!hit)return null;
 const pos=hit.pos+hit.node.nodeSize,node=view.state.doc.nodeAt(pos),current=coreDividerNeighborhood(view,view.state.doc,pos);
 if(!isCoreDivider(view,node)||node.type!==planned.type||!node.content.eq(planned.content)||current.count!==neighborhood.count+1)return null;
 if(!neighborhood.rules.every((previous,index)=>current.rules.includes(previous)?current.rules[index+1]===previous:current.rules[index+1]?.eq(previous)))return null;
 // Existing right-hand nodes must survive after the new rule. Attribute-only
 // normalization of the new rule is allowed; its actual JSON is then recorded.
 if(neighborhood.tail&&current.tail!==neighborhood.tail&&!current.tail?.eq(neighborhood.tail))return null;
 return{hit,node,pos};
}
async function appendCoreDivider(view,row,hit,{explicitRepair=false,node=null,work=null}={}){
 const run=readRun(),identity=coreDividerImage(hit,row),before=view.state.doc,pos=hit.pos+hit.node.nodeSize;
 if(!run||run.articleKey!==editorArticleKey()||norm(hit.node.attrs?.link)!==identity.url)throw new Error('区切り線の保存先を確認できません。完成した画像は保持しています');
 const actual=view.state.doc.nodeAt(hit.pos);if(!actual||!actual.eq(hit.node))throw new Error('画像の位置が変わったため区切り線を保留しました');
 const owned=coreDividerBoundary(view,hit,run);if(owned)return{hit,nextPos:owned.pos+owned.node.nodeSize,divider:owned};
 const prior=run.pendingCoreDivider;
 if(prior&&(prior.runId!==run.createdAt||prior.articleKey!==run.articleKey||!sameCoreDividerImage(prior.image,identity)))throw new Error('別の画像の区切り線が保留中です。途中記録は保持しています');
 if(prior&&!explicitRepair&&prior.phase!=='retryable'&&isCoreDivider(view,view.state.doc.nodeAt(pos)))throw new Error('区切り線の保存記録が未確定です。画像は再送しません。修復のプレビューで確認してください');
 const planned=node||createCoreDivider(view),pending={version:2,evidence:{kind:'fresh-before-insert'},image:identity,runId:run.createdAt,articleKey:run.articleKey,node:planned.toJSON(),phase:'prepared',at:Date.now()};
 const anchorWork=work||(coreDividerAnchorWork?.view===view&&sameCoreDividerImage(coreDividerAnchorWork.image,identity)?coreDividerAnchorWork.work:null);
 if(anchorWork)coreDividerAnchorWork={view,image:identity,work:anchorWork};
 // One original image checkpoint owns the completed upload and its incomplete
 // boundary. Normal processing still awaits only its existing row-end flush.
 recordImage(hit,row,{coreDividerFormat:1,pendingCoreDivider:pending});
 try{
  let transaction=view.state.tr;
  if(anchorWork){
   const workPos=[pos,anchorWork.pos].find(at=>view.state.doc.nodeAt(at)===anchorWork.node);
   if(workPos!==undefined)transaction=transaction.delete(workPos,workPos+anchorWork.node.nodeSize);
  }
  const imagePos=transaction.mapping.map(hit.pos,-1),dividerPos=transaction.mapping.map(pos,-1);
  const beforeInsert=transaction.doc;
  transaction=transaction.insert(dividerPos,planned);const expected=transaction.doc;let dispatchError=null;
  try{view.dispatch(transaction)}catch(error){dispatchError=error}
  let proof=null;
  // Reference identity proves the exact requested transaction document is the
  // current one. A merely equal document must take the complete local proof:
  // identical-looking manual rules can otherwise have exchanged positions.
  if(view.state.doc===expected){
   const image=view.state.doc.nodeAt(imagePos),inserted=view.state.doc.nodeAt(dividerPos);
   if(image?.eq(hit.node)&&inserted?.eq(planned))proof={hit:{node:image,pos:imagePos},node:inserted,pos:dividerPos};
  }else proof=coreDividerInsertionProof(view,identity,imagePos,hit.node.textContent,planned,coreDividerNeighborhood(view,beforeInsert,dividerPos));
  if(!proof){
   const current=readRun();if(current?.createdAt===run.createdAt&&current.articleKey===run.articleKey)writeRun({...current,pendingCoreDivider:{...pending,phase:view.state.doc.eq(before)?'retryable':'uncertain'},updatedAt:Date.now()});
   throw dispatchError||new Error('区切り線の挿入を確認できません。画像と途中記録は保持しています');
  }
  const current=readRun();if(current?.createdAt!==run.createdAt||current.articleKey!==run.articleKey)throw new Error('区切り線の挿入中に作成記録が変わりました');
  const actualHit=proof.hit,inserted=proof.node,record=coreDividerRecord(row,actualHit,inserted,current),records=(current.coreDividerRecords||[]).filter(item=>!sameCoreDividerImage(item.image,identity));
  writeRun({...current,coreDividerFormat:1,coreDividerRecords:[...records,record],dividerUrls:[...new Set([...(current.dividerUrls||[]),row.url])],pendingCoreDivider:null,updatedAt:Date.now()});
  if(coreDividerAnchorWork?.view===view&&sameCoreDividerImage(coreDividerAnchorWork.image,identity))coreDividerAnchorWork=null;
  // Even an adapter that throws after applying the correct transaction must
  // retain ownership before reporting the original failure.
  if(dispatchError)throw dispatchError;
  return{hit:actualHit,nextPos:proof.pos+inserted.nodeSize,divider:{node:inserted,pos:proof.pos,record}};
 }catch(error){
  try{await page.__MUMEI_PROFILE_CARD_RUN_STORE__?.flush?.()}catch{throw new Error('区切り線の途中記録を保存できません。画像は保持し、後続の貼り付けを停止しました')}
  throw error;
 }
}
async function resumePendingCoreDivider(view,run=readRun()){
 const pending=run?.pendingCoreDivider;if(!pending)return false;
 if(pending.runId!==run.createdAt||pending.articleKey!==run.articleKey||run.articleKey!==editorArticleKey())throw new Error('区切り線の途中記録の保存先を確認できません');
 const images=resolveOwnedImageHits(view).sort((a,b)=>a.pos-b.pos),hit=images.find(image=>sameCoreDividerImage(pending.image,coreDividerImage(image)));
 const rows=(run.rows||[]).filter(item=>norm(item.url)===norm(pending.image?.url)),row=rows[0];
 const matches=imageNodes(view).filter(image=>sameCoreDividerImage(pending.image,coreDividerImage(image)));
 if(!hit||rows.length!==1||matches.length!==1||matches[0].pos!==hit.pos)throw new Error('保留中の区切り線に対応する画像を一つに確認できません。画像は再送しません');
 if(images.at(-1)!==hit)throw new Error('保留中の区切り線より後に画像があります。修復のプレビューで確認してください');
 if(typeof qualityGate==='function')await qualityGate(row,null,'images');
 const owned=coreDividerBoundary(view,hit,run);
 if(owned){writeRun({...run,pendingCoreDivider:null,updatedAt:Date.now()})}
 else{
  const adjacent=view.state.doc.nodeAt(hit.pos+hit.node.nodeSize);
  if(legacyCoreDividerProof(view,row,hit,adjacent,run)){
   const record=externalCoreDividerRecord(view,row,hit,adjacent,run),records=(run.coreExternalDividerRecords||[]).filter(item=>!sameCoreDividerImage(item.image,record.image));
   writeRun({...run,coreExternalDividerRecords:[...records,record].slice(-1501),pendingCoreDivider:null,updatedAt:Date.now()});
  }else await appendCoreDivider(view,row,hit);
 }
 await page.__MUMEI_PROFILE_CARD_RUN_STORE__?.flush?.();
 observeCoreDivider(view,row,hit);
 return true;
}
page.__MUMEI_PROFILE_CARD_DIVIDERS__={append:appendCoreDivider,owned:ownedCoreDivider,external:externalCoreDivider,externalRecord:externalCoreDividerRecord,boundary:coreDividerBoundary,isDivider:isCoreDivider,create:createCoreDivider,record:coreDividerRecord,identity:coreDividerImage,sameImage:sameCoreDividerImage,observe:observeCoreDivider,pending:()=>readRun()?.pendingCoreDivider||null};
`;
export const coreDividerRuntime=helpers;

export function transformCoreDividers(source){
 source=once(source,'async function uploadOne(view,row,file,insertPos){',helpers+'\nasync function uploadOne(view,row,file,insertPos){');
 source=editFunction(source,'uploadOne',part=>{
  part=once(part,' assertCreatorAllowed(row);',' assertCreatorAllowed(row);\n const dividerNode=createCoreDivider(view);');
  part=once(part,' const selected=setSelectionForInsert(view,insertPos);',' const anchor=prepareCoreImageAnchor(view,insertPos),selected=anchor.selected;');
  part=once(part," if(nativeImageCommand()(view,dt.files,Math.max(0,selected-1),'image')!==true)throw new Error(row.index+'番 画像アップロードを開始できません');",String.raw` let requested;try{requested=nativeImageCommand()(view,dt.files,Math.max(0,selected-1),'image')}catch(error){cleanupCoreImageAnchor(view,anchor);throw error}
 if(requested!==true){cleanupCoreImageAnchor(view,anchor);throw new Error(row.index+'番 画像アップロードを開始できません')}`);
  return once(part,' return{hit:actual,nextPos:actual.pos+actual.node.nodeSize}',' return appendCoreDivider(view,row,actual,{node:dividerNode,work:anchor.work});');
 });
 source=editFunction(source,'recordImage',part=>{
  part=once(part,'function recordImage(hit,row){','function recordImage(hit,row,extra={}){');
  return once(part,'writeRun({...run,version:VERSION,articleKey:editorArticleKey(),items,updatedAt:Date.now()})','writeRun({...run,version:VERSION,articleKey:editorArticleKey(),items,...extra,updatedAt:Date.now()})');
 });
 for(const name of ['createImageList','pasteSavedSpecial'])source=editFunction(source,name,part=>{
  part=once(part,'   recordImage(made.hit,row);\n   await page.__MUMEI_PROFILE_CARD_RUN_STORE__?.flush?.();','   await page.__MUMEI_PROFILE_CARD_RUN_STORE__?.flush?.();\n   observeCoreDivider(view,row,made.hit);');
  if(name==='pasteSavedSpecial'){
   part=once(part,'  run=await qualityPrepareRun(run);','  run=await qualityPrepareRun(run);\n  const recoveredBoundary=await resumePendingCoreDivider(view,run);run=readRun()||run;');
   part=once(part,'  const ownedImages=resolveOwnedImageHits(view).sort((a,b)=>a.pos-b.pos);','  const ownedImages=resolveOwnedImageHits(view).sort((a,b)=>a.pos-b.pos);\n  validateCoreDividerBoundaries(view,ownedImages,run);');
   part=once(part,'   imageInsertPos=last.pos+last.node.nodeSize;','   const boundary=coreDividerBoundary(view,last);\n   imageInsertPos=boundary?boundary.pos+boundary.node.nodeSize:last.pos+last.node.nodeSize;');
   part=once(part,"   setStatus('画像はすでに '+done+'/'+total+' 件あります ✅ 次は本文位置をタップ→②ここから通知カード');",String.raw`   const recoveredSave=recoveredBoundary?await saveOnce('区切り線の再開完了｜下書き保存中…'):null;
   if(recoveredBoundary&&recoveredSave!==true&&recoveredSave?.confirmed!==true)setStatus('画像 '+done+'/'+total+'件は貼付済み｜下書き保存は未確認。note画面で保存完了を確認してください',true);
   else setStatus('画像はすでに '+done+'/'+total+' 件あります ✅ 次は本文位置をタップ→②ここから通知カード');`);
  }
  return part;
 });
 source=editFunction(source,'resolveOwnedDividerHits',part=>once(part,' const run=readRun(),marked=',` const tracked=readRun();
 if(tracked?.coreImageRun&&tracked.coreDividerFormat===1)return images.map(image=>ownedCoreDivider(view,image,tracked)).filter(Boolean);
 const run=readRun(),marked=`));
 return source;
}
