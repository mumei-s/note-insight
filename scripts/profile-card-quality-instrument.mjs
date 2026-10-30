// Build-time hooks. Fail the build if the verified original path changes.
// Sources stay usable by the independent purchase-only builder without quality hooks.
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
// BEGIN READ-ONLY QUALITY ADAPTERS (record-only; failures do not alter old paths)
const quality=page.__MUMEI_PROFILE_CARD_QUALITY__;
function qualityCall(method,args,fallback){try{return quality?.[method]?.(...args)??fallback}catch{try{quality?.failed?.()}catch{}return fallback}}
const originalArticleFromRaw=articleFromRaw;
articleFromRaw=function(raw,creator={}){const row=originalArticleFromRaw(raw,creator);return qualityCall('rawRow',[row,raw,creator],row)};
const originalMakeFile=makeFile;
makeFile=async function(row){const file=await originalMakeFile(row);return qualityCall('generated',[row,file],file)};
const originalUploadOne=uploadOne;
uploadOne=async function(view,row,file,pos){qualityCall('beforePaste',[row,file]);const result=await originalUploadOne(view,row,file,pos);qualityCall('pasted',[row,file,result]);return result};
// END READ-ONLY QUALITY ADAPTERS
`;
export function instrumentCore(source){
 source=changeFunction(source,'createImageList',part=>once(part,'  const rows=await buildRows(effective,special,workmom,parenting);',"  qualityCall('beginBatch',[{}]);\n  const rows=await buildRows(effective,special,workmom,parenting);"));
 source=changeFunction(source,'pasteSavedSpecial',part=>once(part,'  let run=readRun();',"  let run=readRun();\n  qualityCall('beginBatch',[{run,resume:true}]);"));
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
 return once(source,"if(document.readyState==='loading')",common+"\nif(document.readyState==='loading')");
}
export function instrumentEditor(source){
 source=changeFunction(source,'createFixed300',part=>once(part,'  let existing=readRun();',"  let existing=readRun();\n  qualityCall('beginBatch',[{run:existing,resume:Boolean(existing?.rows?.length)}]);"));
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
 const adapters=common+`
const originalInsertActivityAt=insertActivityAt;
insertActivityAt=function(view,row,pos){const result=originalInsertActivityAt(view,row,pos);qualityCall('activity',[row,result,view.state.doc.nodeAt(result.pos)?.textContent]);return result};
const originalAddDivider=addDivider;
addDivider=function(view,hit,row){const result=originalAddDivider(view,hit,row);qualityCall('divider',[row,view.state.doc.nodeAt(hit.pos+hit.node.nodeSize),node=>isDivider(view,node)]);return result};
// END READ-ONLY QUALITY ADAPTERS
`;
 return once(source,'let attempts=0;',adapters+'\nlet attempts=0;');
}
