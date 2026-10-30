// Build-time hooks. Fail the build if the verified original path changes.
// Sources stay usable by the independent purchase-only builder without quality hooks.
import {qualityRefreshHelpers} from './profile-card-quality-refresh.mjs';
function once(source,from,to){
 if(source.split(from).length!==2)throw Error('Quality hook no longer matches exactly once: '+from.slice(0,95));
 // A callback preserves literal $$ in note's existing formula paragraphs.
 return source.replace(from,()=>to);
}
function changeFunction(source,name,edit){
 const re=new RegExp('^(?:async )?function '+name+'\\(','m'),start=source.search(re);
 if(start<0)throw Error('Missing quality integration function '+name);
 const rest=source.slice(start),match=/\n(?:async )?function [A-Za-z]/.exec(rest),end=match?start+match.index+1:source.length;
 return source.slice(0,start)+edit(source.slice(start,end))+source.slice(end);
}
const common=`
// BEGIN READ-ONLY QUALITY ADAPTERS (validated pre-write holds; no automatic edits)
const quality=page.__MUMEI_PROFILE_CARD_QUALITY__;
function qualityCall(method,args,fallback){try{return quality?.[method]?.(...args)??fallback}catch{try{quality?.failed?.()}catch{}return fallback}}
function qualityAvailable(){return page.__MUMEI_PROFILE_CARD_QUALITY__===quality&&typeof quality?.preflight==='function'&&qualityCall('enabled',[],false)===true}
function qualityIdentity(row){return{account:String(row?.urlname||'').trim().toLowerCase(),key:String(row?.key||'').toLowerCase(),url:String(row?.url||'')}}
function qualityRecordedReasons(row){
 const value=row?.qualitySourceIssue;if(value?.version!==1||!Array.isArray(value.reasons))return[];
 const sourceCodes=new Set(['ROW_ACCOUNT','URL_ACCOUNT','URL_ARTICLE','ARTICLE_ACCOUNT','ARTICLE_KEY','ORIGINAL_URL_ACCOUNT','ORIGINAL_URL_ARTICLE','PROFILE_ACCOUNT','PROFILE_REQUEST','PRESENTATION_ACCOUNT','PRESENTATION_URL_ACCOUNT','PRESENTATION_ARTICLE','PRESENTATION_URL_ARTICLE','LEGACY_FILE_ACCOUNT','LEGACY_FILE_ARTICLE']);
 return value.reasons.filter(reason=>sourceCodes.has(reason?.code)&&reason.expected!==reason.actual&&[reason.expected,reason.actual].every(id=>typeof id==='string'&&(reason.code.endsWith('ARTICLE')||reason.code==='ARTICLE_KEY'?/^n[a-f0-9]{12}$/.test(id):/^[a-z0-9_-]+$/.test(id))));
}
function qualityHoldApplies(run){const hold=run?.qualityHold;return !!hold&&hold.runId===run.createdAt&&hold.articleKey===run.articleKey&&run.articleKey===editorArticleKey()}
function qualityHoldError(hold,note=''){
 const reason=(hold.reasons||[]).map(item=>item.code+' '+item.expected+' / '+item.actual).join('、');
 return Object.assign(new Error('品質保留：'+(hold.identity?.account||'対象')+'｜'+reason+'。順序と完成分は保持。「再開」でこの一件を再確認します'+note),{code:'QUALITY_HOLD',qualityHold:hold});
}
async function qualityBlock(hold){
 const run=readRun();
 if(!run||run.articleKey!==editorArticleKey()||hold.runId!==run.createdAt||hold.articleKey!==run.articleKey)throw qualityHoldError(hold,'｜作成記録が変わったため元の記録は書き換えません');
 const previous=run.qualityHold&&qualityHoldApplies(run)?run.qualityHold:null;
 const upgraded=previous?.kind==='file'&&hold.kind==='source'&&JSON.stringify(previous.identity)===JSON.stringify(hold.identity);
 const retained=upgraded?{...hold,reasons:[...previous.reasons,...hold.reasons]}:previous||hold;
 const checkpoint={...run,qualityHold:retained,stage:retained.phase==='cards'?'cards_building':'images_building',updatedAt:Date.now()};
 delete checkpoint.cardsCompletedAt;if(retained.phase==='images')delete checkpoint.imagesCompletedAt;
 writeRun(checkpoint);
 let note='';try{await page.__MUMEI_PROFILE_CARD_RUN_STORE__?.flush?.()}catch{note='｜途中記録の保存を確認できません。現在の保留は維持しています'}
 qualityCall('held',[retained]);
 throw qualityHoldError(retained,note);
}
async function qualityPrepareRun(run){
 run=await qualityMigrateKnown(run);
 if(!run?.qualityHold)return run;
 if(!qualityHoldApplies(run)){const {qualityHold:old,...retained}=run;writeRun(retained);await page.__MUMEI_PROFILE_CARD_RUN_STORE__?.flush?.();return readRun()}
 if(!qualityAvailable())return await qualityBlock(run.qualityHold);
 return await qualityRetryHeldRun(run);
}
async function qualityMigrateKnown(run){
 if(!Array.isArray(run?.rows)||run.articleKey!==editorArticleKey())return run;
 const diagnoses=qualityCall('knownDiagnoses',[run],[]);if(!Array.isArray(diagnoses)||!diagnoses.length)return run;
 let changed=false;const rows=run.rows.map(row=>{
  const identity=qualityIdentity(row),diagnosis=diagnoses.find(item=>JSON.stringify(item.identity)===JSON.stringify(identity));
  if(!diagnosis)return row;
  const reasons=[...qualityRecordedReasons(row),...diagnosis.reasons],unique=[...new Map(reasons.map(reason=>[JSON.stringify(reason),reason])).values()];
  if(JSON.stringify(unique)===JSON.stringify(row.qualitySourceIssue?.reasons))return row;
  changed=true;return{...row,qualitySourceIssue:{version:1,reasons:unique}};
 });
 if(!changed)return run;
 writeRun({...run,rows});await page.__MUMEI_PROFILE_CARD_RUN_STORE__?.flush?.();return readRun();
}
async function qualityGate(row,file=null,phase='images'){
 let run=readRun();
 if(run?.qualityHold&&!qualityHoldApplies(run)){run=await qualityPrepareRun(run)}
 const known=qualityHoldApplies(run)?run.qualityHold:null,identity=qualityIdentity(row);
 if(known){
  const same=JSON.stringify(known.identity)===JSON.stringify(identity);
  if(!same||known.phase!==phase||known.kind!=='file'||!qualityAvailable())return await qualityBlock(known);
 }
 const recorded=[...qualityRecordedReasons(row),...qualityCall('knownDiagnosis',[row,run],[])];
 const verdict=recorded.length?{hold:true,kind:'source',reasons:recorded}:qualityCall('preflight',[row,{file,phase}],null);
 if(verdict?.hold){
  const index=Array.isArray(run?.rows)?run.rows.findIndex(item=>JSON.stringify(qualityIdentity(item))===JSON.stringify(identity)):-1;
  const hold={version:1,kind:verdict.kind,phase,index,identity,runId:run?.createdAt,articleKey:editorArticleKey(),reasons:verdict.reasons,at:Date.now()};
  return await qualityBlock(hold);
 }
 if(known&&file){
  if(qualityCall('hasVerifiedFileIdentity',[row,file],false)!==true)return await qualityBlock(known);
  const current=readRun();if(!qualityHoldApplies(current)||JSON.stringify(current.qualityHold)!==JSON.stringify(known))throw qualityHoldError(known,'｜再確認中に作成記録が変わりました');
  const {qualityHold:resolved,...retained}=current;
  try{writeRun(retained);await page.__MUMEI_PROFILE_CARD_RUN_STORE__?.flush?.();qualityCall('resolved',[row,known])}
  catch{writeRun(current);return await qualityBlock(known)}
 }
}
const originalArticleFromRaw=articleFromRaw;
articleFromRaw=function(raw,creator={}){const row=originalArticleFromRaw(raw,creator);return qualityCall('rawRow',[row,raw,creator],row)};
const originalMakeFile=makeFile;
makeFile=async function(row){const file=await originalMakeFile(row);return qualityCall('generated',[row,file],file)};
const originalUploadOne=uploadOne;
uploadOne=async function(view,row,file,pos){await qualityGate(row,file,'images');qualityCall('beforePaste',[row,file]);const result=await originalUploadOne(view,row,file,pos);qualityCall('pasted',[row,file,result]);return result};
// END READ-ONLY QUALITY ADAPTERS
`;
export function instrumentCore(source){
 source=changeFunction(source,'createImageList',part=>{
  part=once(part,'  const input=inputValues();',"  const input=inputValues();\n  const heldPlan=await qualityMigrateKnown(readRun());\n  if(qualityHoldApplies(heldPlan))await qualityBlock(heldPlan.qualityHold);\n  const diagnosed=heldPlan?.rows?.find(row=>qualityRecordedReasons(row).length);\n  if(diagnosed)await qualityGate(diagnosed,null,'images');");
  return once(part,'  const rows=await buildRows(effective,special,workmom,parenting);',"  qualityCall('beginBatch',[{}]);\n  const rows=await buildRows(effective,special,workmom,parenting);");
 });
 source=changeFunction(source,'pasteSavedSpecial',part=>once(part,'  let run=readRun();',"  let run=readRun();\n  qualityCall('beginBatch',[{run,resume:true}]);\n  run=await qualityPrepareRun(run);"));
 for(const name of ['createImageList','pasteSavedSpecial'])source=changeFunction(source,name,part=>{
  part=once(part,'   assertCreatorAllowed(row);',"   assertCreatorAllowed(row);\n   await qualityGate(row,null,'images');\n   const file=await makeFile(row);\n   await qualityGate(row,file,'images');");
  return once(part,'   const file=await makeFile(row);\n   const made=await uploadOne(view,row,file,imageInsertPos);','   const made=await uploadOne(view,row,file,imageInsertPos);');
 });
 source=changeFunction(source,'createNativeCard',part=>once(part,' assertCreatorAllowed(row);'," assertCreatorAllowed(row);\n await qualityGate(row,null,'cards');"));
 source=changeFunction(source,'createCardsAtTap',part=>{
  part=once(part,'  const savedPlan=readRun();',"  const savedPlan=await qualityMigrateKnown(readRun());\n  if(qualityHoldApplies(savedPlan))await qualityBlock(savedPlan.qualityHold);");
  return once(part,'  let done=Math.min(existing.length,rows.length);',"  let done=Math.min(existing.length,rows.length);\n  for(let index=0;index<done;index++)await qualityGate(rows[index],null,'cards');");
 });
 source=changeFunction(source,'creatorProfile',part=>once(part,'creator:String(u.nickname||u.name||id).trim(),',"qualityProfile:qualityCall('profileEvidence',[u,id],null),\n   creator:String(u.nickname||u.name||id).trim(),"));
 source=changeFunction(source,'enrich',part=>{
  part=once(part,' return{\n  ...row,',' const result={\n  ...row,');
  return once(part,"  title:String(note.name||note.title||row.title||'無題の記事').trim()\n }", "  title:String(note.name||note.title||row.title||'無題の記事').trim()\n };\n return qualityCall('acquired',[result,{target:row.urlname,note,profile:profile?.qualityProfile,selected:row,normalizedProfile:true}],result)");
 });
 source=changeFunction(source,'makeFile',part=>once(part,"ctx=c.getContext('2d'),theme=", "ctx=qualityCall('observeContext',[c.getContext('2d'),row,W,H],c.getContext('2d')),theme="));
 source=changeFunction(source,'recordNativeCard',part=>once(part,'function recordNativeCard(hit,row){',"function recordNativeCard(hit,row){\n qualityCall('nativeCard',[row,{hit}]);"));
 source=changeFunction(source,'saveOnce',part=>{
  part=once(part,'  return result;',"  qualityCall('saved',[result]);\n  return result;");
  return once(part,'  throw error;',"  qualityCall('saved',[null,error]);\n  throw error;");
 });
 return once(source,"if(document.readyState==='loading')",common+qualityRefreshHelpers+"\nif(document.readyState==='loading')");
}
export function instrumentEditor(source){
 source=changeFunction(source,'restartFixed300',part=>once(part,'  await Promise.all([hydrateRunBackup(),hydratePrepBackup()]);',"  await Promise.all([hydrateRunBackup(),hydratePrepBackup()]);\n  const heldPlan=await qualityMigrateKnown(readRun());\n  if(qualityHoldApplies(heldPlan))await qualityBlock(heldPlan.qualityHold);\n  const diagnosed=heldPlan?.rows?.find(row=>qualityRecordedReasons(row).length);\n  if(diagnosed)await qualityGate(diagnosed,null,'images');"));
 source=changeFunction(source,'createFixed300',part=>{
  part=once(part,'  let existing=readRun();',"  let existing=readRun();\n  qualityCall('beginBatch',[{run:existing,resume:Boolean(existing?.rows?.length)}]);\n  existing=await qualityPrepareRun(existing);");
  part=once(part,'   assertCreatorAllowed(row);',"   assertCreatorAllowed(row);\n   await qualityGate(row,null,'images');");
  return once(part,'   if(stopRequested)throw new Error(\'停止しました\');\n\n   checkPause();',"   if(stopRequested)throw new Error('停止しました');\n   await qualityGate(row,file,'images');\n\n   checkPause();");
 });
 source=changeFunction(source,'preparePerson',part=>{
  part=once(part,'  return{\n   ...latest,','  const result={\n   ...latest,');
  return once(part,"   likedAt:String(person.likedAt||'')\n  }", "   likedAt:String(person.likedAt||'')\n  };\n  return qualityCall('acquired',[result,{target:id,note,profile,selected:latest}],result)");
 });
 source=changeFunction(source,'enrichFinal',part=>once(part,"  return{...row,creator:String(profile.nickname||profile.name||user.nickname||user.name||'実績の算数'),actorImageUrl:avatar,thumbUrl:thumb,finalMarker:true,index}","  const result={...row,creator:String(profile.nickname||profile.name||user.nickname||user.name||'実績の算数'),actorImageUrl:avatar,thumbUrl:thumb,finalMarker:true,index};\n  return qualityCall('acquired',[result,{target:'fuku444',note,profile,selected:row}],result)"));
 source=changeFunction(source,'prepareGalleryPerson',part=>{
  part=once(part,'  return{...creator,index:index+1,', '  const result={...creator,index:index+1,');
  part=once(part,"checkedAt:new Date().toISOString(),source:'note-public-api'}};", "checkedAt:new Date().toISOString(),source:'note-public-api'}};\n  return qualityCall('acquired',[result,{target:id,profile}],result);");
  part=once(part,' return{...selected,index:index+1,',' const result={...selected,index:index+1,');
  return once(part,"gallery126:true,finalMarker:false};", "gallery126:true,finalMarker:false};\n return qualityCall('acquired',[result,{target:id,profile,selected}],result);");
 });
 source=changeFunction(source,'makeFile',part=>once(part," const ctx=canvas.getContext('2d');", " const ctx=qualityCall('observeContext',[canvas.getContext('2d'),row,W,H],canvas.getContext('2d'));") );
 // The core owns native cards; v22 has no createNativeCard declaration.
 source=changeFunction(source,'activityText',part=>once(part," return'$${", " qualityCall('layout',[row,layout,text,galleryProfileWidth]);\n return'$${"));
 const adapters=common+qualityRefreshHelpers+`
const originalInsertActivityAt=insertActivityAt;
insertActivityAt=function(view,row,pos){const result=originalInsertActivityAt(view,row,pos);qualityCall('activity',[row,result,view.state.doc.nodeAt(result.pos)?.textContent]);return result};
const originalAddDivider=addDivider;
addDivider=function(view,hit,row){const result=originalAddDivider(view,hit,row);qualityCall('divider',[row,view.state.doc.nodeAt(hit.pos+hit.node.nodeSize),node=>isDivider(view,node)]);return result};
// END READ-ONLY QUALITY ADAPTERS
`;
 return once(source,'let attempts=0;',adapters+'\nlet attempts=0;');
}
