// Only the standalone thumbnail tool uses these adapters. Article selection
// finishes before PNG generation, preserving each image/text/link association.
function once(source,from,to){if(source.split(from).length!==2)throw Error('Summary hook must match once: '+from.slice(0,110));return source.replace(from,()=>to)}
function changeFunction(source,name,edit){
 const start=source.search(new RegExp('^(?:async )?function '+name+'\\(','m'));if(start<0)throw Error('Missing summary function '+name);
 const match=/\n(?:async )?function [A-Za-z]/.exec(source.slice(start)),end=match?start+match.index+1:source.length;
 return source.slice(0,start)+edit(source.slice(start,end))+source.slice(end);
}
const helpers=String.raw`
function summaryIdentity(value){
 try{const url=new URL(String(value||''));if(url.protocol!=='https:'||!['note.com','www.note.com'].includes(url.hostname))return{};const match=url.pathname.match(/^\/([a-z0-9_-]+)\/n\/(n[a-f0-9]{12})\/?$/i);return match?{account:match[1].toLowerCase(),key:match[2].toLowerCase()}:{}}catch{return{}}
}
function summaryMismatch(row,note){
 const user=note?.user||note?.author||{},account=String(user.urlname||user.urlName||'').toLowerCase(),key=String(note?.key||'').toLowerCase(),expected=String(row.urlname||'').toLowerCase();
 const urls=[summaryIdentity(row.url),summaryIdentity(note?.note_url||note?.noteUrl||note?.url)];
 return Boolean(account&&account!==expected||key&&key!==String(row.key).toLowerCase()||urls.some(id=>id.account&&id.account!==expected||id.key&&id.key!==String(row.key).toLowerCase()));
}
function summaryHasBody(row,note){return contentApi?.compose?.(row,note,{},row.presentation||contentOptions)?.status==='available'}
function summaryRequested(row){return (row.presentation||contentOptions)?.content==='summary'}
function summaryInScope(row,note){
 const scope=row.sourceScope;if(!scope)return true;
 if(scope.kind==='mag')return Array.isArray(note.belonging_magazine_keys)&&note.belonging_magazine_keys.includes(scope.magazineKey);
 if(scope.kind!=='tag')return false;
 const names=[];for(const field of ['hashtags','tags','hashtag_names','tag_names','note_hashtags','hashtag_notes'])for(const entry of Array.isArray(note[field])?note[field]:[]){const name=typeof entry==='string'?entry:entry?.name??entry?.hashtag?.name??entry?.tag?.name;if(typeof name==='string')names.push(name.trim().replace(/^[#＃]+/,'').normalize('NFC'))}
 return names.includes(String(scope.tag||'').normalize('NFC'));
}
function summaryImage(note){return mediaUrl(note?.eyecatch_url||note?.image_url||note?.imageUrl||note?.thumbnail_url||note?.thumbnailUrl||note?.eyecatch||note?.eyecatch_image||note?.eyecatchImage||note?.image||note?.thumbnail||'')}
async function summarySelectArticle(row,note,firstPage=null){
 if(!summaryRequested(row)||summaryHasBody(row,note)||row.finalMarker||norm(row.url)===norm(FINAL_URL))return{row,note};
 // A known contradiction still belongs to the existing identity gate. A
 // missing summary must not hide an account, article or tag mismatch.
 if(summaryMismatch(row,note)||typeof qualityRecordedReasons==='function'&&qualityRecordedReasons(row).length)return{row,note};
 if(row.specialFirstNote)return null;
 const account=String(row.urlname||'').toLowerCase(),seen=new Set([String(row.key).toLowerCase()]);let checked=0;
 if(!/^[a-z0-9_-]+$/.test(account))return null;
 for(let pageNo=1;pageNo<=3&&checked<12;pageNo++){
  if(stopRequested)throw new Error('停止しました');
  let payload;
  try{payload=pageNo===1&&firstPage?firstPage:await xhrJSON('https://note.com/api/v2/creators/'+encodeURIComponent(account)+'/contents?kind=note&page='+pageNo+'&disabled_pinned=true&with_notes=false')}
  catch(error){if(stopRequested)throw error;break}
  const list=contentList(payload);if(!list.length)break;
  for(const raw of list){
   if(stopRequested)throw new Error('停止しました');
   const candidate=articleFromRaw(raw,{urlname:account,creator:row.creator,actorUrl:row.actorUrl,actorImageUrl:row.actorImageUrl,likerKey:row.likerKey});
   if(!candidate||seen.has(candidate.key)||checked>=12)continue;seen.add(candidate.key);checked++;
   const selected={...row,...candidate,sourceScope:row.sourceScope?{...row.sourceScope,articleKey:candidate.key}:undefined};
   const listed=raw?.note||raw;
   if(summaryMismatch(selected,listed))continue;
   let detail;try{const response=await xhrJSON('https://note.com/api/v3/notes/'+encodeURIComponent(candidate.key));detail=response?.data||response||{}}catch(error){if(stopRequested)throw error;continue}
   const user=detail.user||detail.author||{},actualAccount=String(user.urlname||user.urlName||'').toLowerCase();
   if(actualAccount!==account||String(detail.key||'').toLowerCase()!==candidate.key.toLowerCase()||summaryMismatch(selected,detail)||detail.is_draft===true||detail.is_published===false||!summaryInScope(row,detail)||!summaryHasBody(selected,detail))continue;
   if(row.workmom&&typeof workmomArticleAudit==='function'&&!(await workmomArticleAudit(selected)).ok)continue;
   if(row.parenting&&typeof parentingArticleAudit==='function'&&!(await parentingArticleAudit(selected)).ok)continue;
   setStatus((row.creator||account)+'さん｜要約を取得できる別の記事に切り替え');
   return{row:{...selected,summaryFallback:{fromKey:row.key,fromUrl:row.url,reason:'summary-unavailable'}},note:detail};
  }
  const data=payload?.data||{};if(data.isLastPage===true||data.is_last_page===true)break;
 }
 setStatus((row.creator||account)+'さん｜要約に使える記事がないため次へ');return null;
}
async function summaryRefreshRows(rows,completed=0){
 if(!rows.some((row,index)=>index>=completed&&row.presentation?.content==='summary'&&row.presentation.status!=='available'))return rows;
 const refreshed=[];
 for(let index=0;index<rows.length;index++){
  if(stopRequested)throw new Error('停止しました');
  const original=rows[index];
  if(index<completed||original.presentation?.content!=='summary'||original.presentation.status==='available'){refreshed.push(original);continue}
  let note={};try{const response=await xhrJSON('https://note.com/api/v3/notes/'+encodeURIComponent(original.key));note=response?.data||response||{}}catch(error){if(stopRequested)throw error}
  const selected=await summarySelectArticle(original,note);if(!selected)continue;
  const row=selected.row;note=selected.note;
  let presentation=contentApi.compose(row,note,{},original.presentation);
  if(presentation.status!=='available'&&(row.finalMarker||norm(row.url)===norm(FINAL_URL)))presentation={...presentation,content:'name',text:'',status:'available',source:{kind:'name'}};
  const value={...row,presentation,thumbUrl:summaryImage(note)||row.thumbUrl||'',title:String(note.name||note.title||row.title||'無題の記事')};
  refreshed.push(typeof qualityCall==='function'?qualityCall('acquired',[value,{target:row.urlname,note,selected:row}],value):value);
 }
 return refreshed.map((row,index)=>({...row,index:index+1}));
}
`;
function common(source){
 source=once(source,'const contentApi=page.__MUMEI_PROFILE_CARD_CONTENT__;','const contentApi=page.__MUMEI_PROFILE_CARD_CONTENT__;\n'+helpers);
 return once(source,'function composePresentation(row,note,profile){return contentOptions?contentApi?.compose?.(row,note,profile,contentOptions):undefined}',String.raw`function composePresentation(row,note,profile){
 const value=contentOptions?contentApi?.compose?.(row,note,profile,contentOptions):undefined;
 if(value?.content==='summary'&&value.status!=='available'&&(row.finalMarker||norm(row.url)===norm(FINAL_URL)))return{...value,content:'name',text:'',status:'available',source:{kind:'name'}};
 return value;
}`);
}
export function transformCoreSummary(source){
 source=common(source);
 source=changeFunction(source,'enrich',part=>once(part," profile=row.urlname?selectedProfile:await creatorProfile(String(user.urlname||'')).catch(()=>null);",String.raw` profile=row.urlname?selectedProfile:await creatorProfile(String(user.urlname||'')).catch(()=>null);
 const summarySelection=await summarySelectArticle(row,note);if(!summarySelection)return null;
 row=summarySelection.row;note=summarySelection.note;user=note.user||note.author||{};`));
 for(const name of ['buildRows','buildRowsFromSavedSpecial'])source=changeFunction(source,name,part=>{
  const pattern=/out\.push\(\.\.\.await Promise\.all\((rows\.slice\(i,i\+\d+\)\.map\(enrich\))\)\)/g;
  if([...part.matchAll(pattern)].length!==1)throw Error('Missing summary skip hook: '+name);
  part=part.replace(pattern,'out.push(...(await Promise.all($1)).filter(Boolean))');
  return name==='buildRows'?once(part,'rows.push({...row,url:u})','rows.push({...row,url:u,specialFirstNote:special||Boolean(row.specialFirstNote)})'):part;
 });
 source=changeFunction(source,'pasteSavedSpecial',part=>once(part,'  const allowedRows=excludePendingCreatorRows(rows,run);','  const summaryRows=await summaryRefreshRows(rows,run.items?.length||0);\n  if(summaryRows!==rows){rows=summaryRows;run={...run,rows,updatedAt:Date.now()};writeRun(run);await page.__MUMEI_PROFILE_CARD_RUN_STORE__?.flush?.();}\n  const allowedRows=excludePendingCreatorRows(rows,run);'));
 return source;
}
export function transformEditorSummary(source){
 source=common(source);
 source=changeFunction(source,'preparePerson',part=>{
  part=once(part,'  const latest=candidates[0];','  let latest=candidates[0];');
  return once(part,'  const note=notePayload?.data||notePayload||{};',String.raw`  let note=notePayload?.data||notePayload||{};
  const summarySelection=await summarySelectArticle(latest,note,contents);
  if(!summarySelection){const error=new Error('要約に使える公開記事なし');error.code='SUMMARY_UNAVAILABLE';throw error;}
  latest=summarySelection.row;note=summarySelection.note;`);
 });
 source=changeFunction(source,'buildRows',part=>{
  part=once(part,"rejected.push({urlname:canonicalUrlname(person),likerKey:creatorKey(person),reason:","rejected.push({urlname:canonicalUrlname(person),likerKey:creatorKey(person),code:error?.code||'',reason:");
  part=once(part," if(target!==Infinity&&rows.length<target)throw", " if(target!==Infinity&&rows.length<target&&!skipped.some(person=>person.code==='SUMMARY_UNAVAILABLE'))throw");
  return once(part," if(!rows.length)throw", " if(!rows.length&&!skipped.some(person=>person.code==='SUMMARY_UNAVAILABLE'))throw");
 });
 source=changeFunction(source,'createFixed300',part=>once(part,'  rows=assignDesigns(rows);','  rows=await summaryRefreshRows(rows,existing?.items?.length||0);\n  rows=assignDesigns(rows);'));
 return changeFunction(source,'restartFixed300',part=>once(part,'   rows=compactHistoryRows(rows);','   rows=await summaryRefreshRows(rows,0);\n   rows=compactHistoryRows(rows);'));
}
