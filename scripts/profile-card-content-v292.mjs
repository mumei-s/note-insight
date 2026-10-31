import {readFileSync} from 'node:fs';
export const contentRuntime=readFileSync(new URL('../public/note-profile-card-paster-content-v292.js',import.meta.url),'utf8');
function once(source,from,to){if(source.split(from).length!==2)throw Error('Presentation hook no longer matches once: '+from.slice(0,100));return source.replace(from,()=>to)}
function changeFunction(source,name,edit){
 const start=source.search(new RegExp('^(?:async )?function '+name+'\\(','m'));if(start<0)throw Error('Missing presentation function '+name);
 const rest=source.slice(start),match=/\n(?:async )?function [A-Za-z]/.exec(rest),end=match?start+match.index+1:source.length;
 return source.slice(0,start)+edit(source.slice(start,end))+source.slice(end);
}
const adapters=`
const contentApi=page.__MUMEI_PROFILE_CARD_CONTENT__;
let contentOptions=contentApi?.readOptions?.()||{size:'thin',content:'name'};
function composePresentation(row,note,profile){return contentOptions?contentApi?.compose?.(row,note,profile,contentOptions):undefined}
`;
const scopedInsert=`
function insertPresentationAt(view,row,pos){
 const run=readRun();if(!run||run.articleKey!==editorArticleKey())throw new Error('紹介文の保存先を確認できません');
 const key=norm(row.url),owned=run.presentationTexts?.[key],at=Math.max(0,Math.min(view.state.doc.content.size,Number(pos)||0)),actual=view.state.doc.nodeAt(at);
 if(owned){
  const contract=run.presentationLayouts?.[key];
  if(contentApi?.matchesAboveText?.(row,owned,contract)!==true)throw new Error('保存済みの紹介文と内容が変わっています。完成分は保持しています');
  if(actual?.type?.name==='paragraph'&&actual.textContent===owned){const result={text:owned,pos:at,nextPos:at+actual.nodeSize,layout:contract||{version:1,font:'scriptsize',maxFontPx:14,maxHeightPx:140}};if(typeof qualityCall==='function')qualityCall('activity',[row,result,actual.textContent]);return result;}
  throw new Error('保存済みの紹介文の位置を確認できません。二重挿入を停止しました');
 }
 if(!row.presentation||row.presentation.size!=='thin'||row.presentation.content==='name'||row.finalMarker)return{nextPos:pos};
 const context=contentApi?.presentationContext?.(view),layout=contentApi?.aboveLayout?.(row,context?.bodyWidthPx,context?.fontBasePx),text=layout?.text||'';if(!text)return{nextPos:pos};
 const type=view.state.schema.nodes.paragraph;if(!type)throw new Error('紹介文用の段落を取得できません');
 const node=type.create(null,view.state.schema.text(text));view.dispatch(view.state.tr.insert(at,node));
 const inserted=view.state.doc.nodeAt(at);if(inserted?.type?.name!=='paragraph'||inserted.textContent!==text)throw new Error('紹介文の挿入を確認できません');
 const contract=contentApi?.layoutContract?.(layout);
 writeRun({...run,presentationTexts:{...(run.presentationTexts||{}),[key]:text},presentationPositions:{...(run.presentationPositions||{}),[key]:at},presentationLayouts:{...(run.presentationLayouts||{}),...(contract?{[key]:contract}:{})},activityTexts:[...(run.activityTexts||[]),text],updatedAt:Date.now()});
 const result={text,pos:at,nextPos:at+inserted.nodeSize,layout:contract};if(typeof qualityCall==='function')qualityCall('activity',[row,result,inserted.textContent]);return result;
}
`;
const coreInsert=scopedInsert+`
function presentationActivityHits(view,run){
 const owned=run.presentationTexts;if(!owned||!Object.keys(owned).length)return null;
 const images=typeof resolveOwnedImageHits==='function'?resolveOwnedImageHits(view):ownedImagesForRun(view,run),blocks=[];view.state.doc.forEach((node,pos)=>blocks.push({node,pos}));
 const result=[],used=new Set();
 for(const [url,text] of Object.entries(owned)){
  const image=images.find(hit=>norm(hit.node.attrs?.link)===url);let hit;
  if(image){const index=blocks.findIndex(block=>block.pos===image.pos);hit=index>0?blocks[index-1]:null;}
  else{const pos=run.presentationPositions?.[url];hit=Number.isFinite(pos)?blocks.find(block=>block.pos===pos):null;}
  if(!hit||hit.node.type?.name!=='paragraph'||hit.node.textContent!==text||used.has(hit.pos))throw new Error('紹介文と作成画像の対応を確認できないため全削除を停止しました。本文と途中記録は保持しています');
  used.add(hit.pos);result.push(hit);
 }
 if(result.length!==(run.activityTexts||[]).length)throw new Error('紹介文の作成記録が一致しないため全削除を停止しました');
 return result;
}
`;
export function transformCoreContent(source){
 source=once(source,"const STATUS='mumei-profile-card-paster-status-v1';", "const STATUS='mumei-profile-card-paster-status-v1';"+adapters);
 source=once(source,' bindPanelInputEvents(p);',' bindPanelInputEvents(p);\n contentApi?.mount?.(p);');
 source=changeFunction(source,'creatorProfile',part=>once(part,'   creator:String(u.nickname||u.name||id).trim(),',"   profileText:contentOptions?.content==='profile'?(contentApi?.clean?.(u.profile??u.description??u.bio??u.introduction??u.self_introduction??u.note_intro??'')||''):'',presentationAccount:String(u.urlname||u.urlName||u.url_name||'').toLowerCase(),\n   creator:String(u.nickname||u.name||id).trim(),"));
 source=changeFunction(source,'enrich',part=>once(part,'  ...row,',"  ...row,profileText:String(profile?.profileText||''),presentation:composePresentation(row,note,profile),"));
 source=changeFunction(source,'createImageList',part=>once(part,'  const input=inputValues();','  const input=inputValues();\n  contentOptions=contentApi?.readOptions?.()||contentOptions;'));
 source=changeFunction(source,'uploadOne',part=>once(part,' assertCreatorAllowed(row);',' assertCreatorAllowed(row);\n insertPos=insertPresentationAt(view,row,insertPos).nextPos;'));
 source=changeFunction(source,'resolveOwnedActivityHits',part=>once(part,' const run=readRun(),counts=new Map(),out=[];',' const run=readRun(),counts=new Map(),out=[];\n const presentation=presentationActivityHits(view,run||{});if(presentation)return presentation;'));
 source=changeFunction(source,'deleteAllGenerated',part=>{
  part=once(part," const view=findView();if(!view)throw new Error('note本文編集欄を取得できません');", " const view=findView();if(!view)throw new Error('note本文編集欄を取得できません');\n const presentationHits=presentationActivityHits(view,run),presentationPositions=presentationHits?new Set(presentationHits.map(hit=>hit.pos)):null;");
  return once(part,"  if(node.type?.name==='paragraph'&&activityCounts.has(text))textCandidates.activities.push({node,pos});","  if(node.type?.name==='paragraph'&&activityCounts.has(text)&&(!presentationPositions||presentationPositions.has(pos)))textCandidates.activities.push({node,pos});");
 });
 return once(source,'function sectionHeadingText(groupIndex){',coreInsert+'\nfunction sectionHeadingText(groupIndex){');
}
export function transformEditorContent(source){
 source=once(source,"const STATUS='mumei-profile-card-paster-status-v1';", "const STATUS='mumei-profile-card-paster-status-v1';"+adapters);
 source=changeFunction(source,'preparePerson',part=>once(part,'   ...latest,','   ...latest,presentation:composePresentation(latest,note,profile),'));
 source=changeFunction(source,'buildRows',part=>{
  part=once(part,' const compatible=saved?.signature===signature||saved?.signature===previousSignature;',` const compatible=saved?.signature===signature||saved?.signature===previousSignature;
 if(compatible){
  if(Object.prototype.hasOwnProperty.call(saved,'presentationOptions'))contentOptions=saved.presentationOptions===null?null:contentApi?.options?.(saved.presentationOptions)||saved.presentationOptions;
  else if(Array.isArray(saved.rows)&&saved.rows.length)contentOptions=saved.rows.find(row=>row.presentation)?.presentation||null;
  if(Array.isArray(saved.rows)&&saved.rows.some(row=>Boolean(row.presentation)!==Boolean(contentOptions)||row.presentation&&(row.presentation.size!==contentOptions.size||row.presentation.content!==contentOptions.content)))throw new Error('保存済みの紹介形式が混在しています。本文と取得済み情報は保持しています');
 }`);
  return once(part,'  writePrep({signature,index,rows,skipped,updatedAt:Date.now()});await flushPrepBackup();',"  writePrep({signature,index,rows,skipped,presentationOptions:contentOptions?{size:contentOptions.size,content:contentOptions.content}:null,updatedAt:Date.now()});await flushPrepBackup();");
 });
 source=changeFunction(source,'enrichFinal',part=>once(part,"  return{...row,creator:","  row.presentation=composePresentation(row,note,profile);\n  return{...row,creator:"));
 source=changeFunction(source,'createFixed300',part=>{
  part=once(part,'  let existing=readRun();','  let existing=readRun();\n  contentOptions=existing?.rows?.find(row=>row.presentation)?.presentation||(existing?.rows?.length?null:contentApi?.readOptions?.()||contentOptions);');
  return once(part,'   if(!row.finalMarker){\n    const text=activityText(row);',"   if(!row.finalMarker&&row.presentation){\n    insertPos=insertPresentationAt(view,row,insertPos).nextPos;\n   }else if(!row.finalMarker){\n    const text=activityText(row);");
 });
 source=changeFunction(source,'activityText',part=>once(part,'function activityText(row){','function activityText(row){\n if(row.presentation)return contentApi?.aboveText?.(row)||\'\';'));
 source=changeFunction(source,'clearCurrentPaste',part=>{
  part=once(part,' if(!run?.likesHistoryFix230)return 0;',' if(!run?.likesHistoryFix230)return 0;\n const presentation=presentationActivityHits(view,run),presentationPositions=presentation?new Set(presentation.map(hit=>hit.pos)):null;');
  return once(part,"  if(node.type?.name==='paragraph'&&texts.has(String(node.textContent||'')))hits.push({node,pos});","  if(node.type?.name==='paragraph'&&texts.has(String(node.textContent||''))&&(!presentationPositions||presentationPositions.has(pos)))hits.push({node,pos});");
 });
 source=changeFunction(source,'restartFixed300',part=>once(part,'sectionHeadings:[],activityTexts:[],dividerUrls:[]','sectionHeadings:[],activityTexts:[],presentationTexts:{},presentationPositions:{},presentationLayouts:{},dividerUrls:[]'));
 return once(source,'function insertHeadingAt(view,text,pos){',coreInsert+'\nfunction insertHeadingAt(view,text,pos){');
}
