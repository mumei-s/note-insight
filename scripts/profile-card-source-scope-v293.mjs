// Keep # and magazine selection inside the requested article source. The
// historical modules remain unchanged for their independent distribution.
function once(source,from,to){if(source.split(from).length!==2)throw Error('Source-scope hook no longer matches once: '+from.slice(0,100));return source.replace(from,()=>to)}
function replaceFunction(source,name,replacement){
 const start=source.search(new RegExp('^(?:async )?function '+name+'\\(','m'));if(start<0)throw Error('Missing source-scope function '+name);
 const end=/\n}\r?\n/.exec(source.slice(start));if(!end)throw Error('Missing source-scope boundary '+name);
 return source.slice(0,start)+replacement.trimEnd()+'\n'+source.slice(start+end.index+end[0].length);
}
const helpers=String.raw`
let sourceScopeNotes=new Map();
function resetSourceScopeNotes(){sourceScopeNotes=new Map()}
function scopeNote(key){
 if(!sourceScopeNotes.has(key))sourceScopeNotes.set(key,xhrJSON('https://note.com/api/v3/notes/'+encodeURIComponent(key)));
 return sourceScopeNotes.get(key);
}
function normalizeAssignedTag(value){return String(value||'').trim().replace(/^[#＃]+/,'').normalize('NFC')}
function assignedTags(note){
 const names=new Set();let available=false,complete=true;
 for(const field of ['hashtags','tags','hashtag_names','tag_names','note_hashtags','hashtag_notes']){
  if(!Object.prototype.hasOwnProperty.call(note||{},field))continue;
  const values=note[field];if(!Array.isArray(values)){complete=false;continue}available=true;
  for(const entry of values){
   const value=typeof entry==='string'?entry:entry?.name??entry?.hashtag?.name??entry?.tag?.name;
   if(typeof value!=='string'){complete=false;continue}const name=normalizeAssignedTag(value);if(name)names.add(name);else complete=false;
  }
 }
 return{available,complete,names:[...names]};
}
function scopeAccount(value){const id=String(value||'').trim().toLowerCase();return /^[a-z0-9_-]+$/.test(id)?id:''}
function scopeArticleKey(value){const key=String(value||'').toLowerCase();return /^n[a-f0-9]{12}$/.test(key)?key:''}
function scopeUrlIdentity(value){try{const url=new URL(String(value||''));if(!['note.com','www.note.com'].includes(url.hostname))return{};const match=url.pathname.match(/^\/([a-z0-9_-]+)\/n\/(n[a-f0-9]{12})\/?$/i);return match?{account:scopeAccount(match[1]),key:scopeArticleKey(match[2])}:{}}catch{return{}}}
function scopeIdentityMismatch(row,note){
 const expected={account:scopeAccount(row.urlname),key:scopeArticleKey(row.key)},user=note?.user||note?.author||{},actual={account:scopeAccount(user.urlname||user.urlName),key:scopeArticleKey(note?.key)};
 const differs=(a,b)=>Boolean(a&&b&&a!==b),urls=[scopeUrlIdentity(row.url),scopeUrlIdentity(note?.note_url||note?.noteUrl||note?.url)];
 return differs(expected.account,actual.account)||differs(expected.key,actual.key)||urls.some(url=>differs(expected.account,url.account)||differs(expected.key,url.key));
}
function magazineMembership(note,key){return Array.isArray(note?.belonging_magazine_keys)&&note.belonging_magazine_keys.some(value=>typeof value==='string'&&value===key)}
`;
const collect=String.raw`async function collectUnified(raw,mode,count,choice){
 resetSourceScopeNotes();
 const sources=parseUnifiedSources(raw),limit=targetLimit(mode,count),out=[],seenUrls=new Set(),creators=new Set(['fuku444']),creatorKeys=new Set(),choices=new Map(),issues=[],issueKeys=new Set(),cappedSources=[];
 let unavailable=0,scopeUnavailable=0,scopeRejected=0,fixedSkipped=0;
 const creatorId=row=>scopeAccount(row?.urlname)||scopeUrlIdentity(row?.url).account||'';
 const issue=(row,reason,source,type='unavailable')=>{
  const account=creatorId(row),signature=[source?.type,source?.value,account||row?.key,reason].join('|');if(issueKeys.has(signature))return;issueKeys.add(signature);
  if(type==='scope-rejected')scopeRejected++;else{unavailable++;if(type==='scope-unavailable')scopeUnavailable++;if(type==='fixed')fixedSkipped++;}
  if(issues.length<160)issues.push({account,articleKey:String(row?.key||''),source:source?.label||source?.value||'',reason});
 };
 const add=row=>{
  if(!row)return false;const url=norm(row.url),id=creatorId(row),stable=String(row.likerKey||'').trim();
  if(!url||url===norm(FINAL_URL)||seenUrls.has(url)||id&&creators.has(id)||stable&&creatorKeys.has(stable))return false;
  seenUrls.add(url);if(id)creators.add(id);if(stable)creatorKeys.add(stable);out.push({...row,url});return true;
 };
 const selected=(creator,selectedChoice)=>{const id=creatorId(creator),key=id+'|'+selectedChoice;if(!choices.has(key))choices.set(key,chooseCreatorArticle({...creator,urlname:id},selectedChoice));return choices.get(key)};
 const verify=async(row,source,listed=new Set(),forceDetail=false)=>{
  if(!row)return{row:null,reason:'記事ID・投稿者情報なし',type:'scope-unavailable'};
  const sourceScope=source.type==='tag'?{kind:'tag',tag:normalizeAssignedTag(source.value),articleKey:row.key}:{kind:'mag',magazineKey:magazineKey(source.value),articleKey:row.key};
  if(source.type==='mag'&&listed.has(row.key)&&!forceDetail)return{row:{...row,sourceScope},date:Date.parse(row.publishAt||'')};
  let payload;try{payload=await scopeNote(row.key)}catch(error){
   if(stopRequested)throw error;
   // The magazine endpoint already proves this listed article's membership.
   // A missing detail response is insufficient identity evidence, not evidence
   // that the listed fallback is outside the magazine. Enrichment and quality
   // retain their normal missing-material handling for this cached failure.
   if(source.type==='mag'&&listed.has(row.key))return{row:{...row,sourceScope},date:Date.parse(row.publishAt||''),detailUnavailable:true};
   return{row:null,reason:source.type==='tag'?'タグ情報を取得できない・未確認':'マガジン所属を取得できない・未確認',type:'scope-unavailable'};
  }
  const note=payload?.data||payload||{},scoped={...row,sourceScope},date=Date.parse(note.publishAt||note.publish_at||note.published_at||row.publishAt||'');
  // A source mismatch cannot disguise a known identity error or trigger a
  // replacement article. The existing per-person gate must hold this row.
  if(scopeIdentityMismatch(row,note))return{row:scoped,date,identityMismatch:true};
  if(source.type==='mag')return listed.has(row.key)||magazineMembership(note,sourceScope.magazineKey)?{row:scoped,date}:{row:null,reason:'固定記事のマガジン所属なし・未確認',type:'fixed'};
  const tags=assignedTags(note);
  if(tags.names.includes(sourceScope.tag))return{row:scoped,date};
  return{row:null,reason:tags.available&&tags.complete?'指定タグが付いていない記事':'タグ情報なし・未確認',type:tags.available&&tags.complete?'scope-rejected':'scope-unavailable'};
 };
 const scopedChoice=async(row,source,listed)=>{
  const checked=await verify(row,source,listed,choice==='fixed'||choice==='pinned');if(!checked.row||checked.identityMismatch||!['fixed','pinned'].includes(choice))return checked;
  const id=creatorId(row);if(!id)return choice==='fixed'?checked:{row:null,reason:'固定記事の投稿者ID未確認',type:'fixed'};
  const pinned=await selected(row,'pinned');
  if(pinned){const verified=await verify(pinned,source,listed,true);if(verified.row)return verified;if(choice==='pinned')return{...verified,type:'fixed'};}
  if(choice==='fixed')return checked;
  return{row:null,reason:source.type==='tag'?'指定タグの固定記事なし・未確認':'マガジン内の固定記事なし・未確認',type:'fixed'};
 };
 const acceptScoped=async(rows,source,listed)=>{
  for(let offset=0;offset<rows.length&&out.length<limit;){
   if(stopRequested)throw new Error('停止しました');
   const batch=[];while(offset<rows.length&&batch.length<Math.min(6,Number.isFinite(limit)?Math.max(1,limit-out.length):6)){
    const row=rows[offset++];if(row&&!creators.has(creatorId(row))&&!seenUrls.has(norm(row.url)))batch.push(row);
   }
   const checked=await Promise.all(batch.map(row=>scopedChoice(row,source,listed)));
   for(let index=0;index<checked.length;index++){const result=checked[index];if(result.row)add(result.row);else issue(batch[index],result.reason,source,result.type);if(out.length>=limit)break;}
  }
 };
 const acceptLikers=async(rows,source)=>{
  const attempted=new Set(),fresh=rows.filter(row=>{const id=creatorId(row);if(!id||creators.has(id)||attempted.has(id))return false;attempted.add(id);return true});
  for(let offset=0;offset<fresh.length&&out.length<limit;){
   if(stopRequested)throw new Error('停止しました');const size=Math.min(6,Number.isFinite(limit)?Math.max(1,limit-out.length):6),batch=fresh.slice(offset,offset+size);offset+=batch.length;
   const selectedRows=await Promise.all(batch.map(row=>selected(row,choice)));
   for(let index=0;index<selectedRows.length;index++){if(selectedRows[index])add(selectedRows[index]);else issue(batch[index],choice==='pinned'?'固定記事なし・未確認':'公開記事なし・未確認',source);if(out.length>=limit)break;}
  }
 };
 for(let sourceIndex=0;sourceIndex<sources.length&&out.length<limit;sourceIndex++){
  const source=sources[sourceIndex],candidates=[],candidateKeys=new Set(),listed=new Set();let exhausted=false,capped=false;
  const status=label=>setStatus('入力 '+(sourceIndex+1)+'/'+sources.length+'｜'+label+' '+out.length+(mode==='all'?' / 全数':' / '+limit));
  const rowsFrom=list=>{const rows=[];for(const item of list){const row=articleFromRaw(item,{});if(!row||candidateKeys.has(row.key))continue;candidateKeys.add(row.key);listed.add(row.key);rows.push(row);}return rows};
  if(source.type==='note'){
   const key=noteKey(source.value);if(!key)continue;
   for(let page=1;page<=200&&out.length<limit;page++){
    if(stopRequested)throw new Error('停止しました');status('記事のスキ');
    const payload=await xhrJSON('https://note.com/api/v3/notes/'+encodeURIComponent(key)+'/likes?page='+page+'&per=50'),list=Array.isArray(payload?.data?.likes)?payload.data.likes:[];
    await acceptLikers(list.map(parseLiker).filter(Boolean),source);if(list.length<50)break;
   }continue;
  }
  if(source.type==='mag'){
   const key=magazineKey(source.value);if(!key)continue;let start=0;
   while(start<10000&&(choice==='oldest'||out.length<limit)){
    if(stopRequested)throw new Error('停止しました');status('マガジン内の記事');
    const payload=await xhrJSON('https://note.com/api/v1/magazines/'+encodeURIComponent(key)+'/notes?start='+start+'&limit=100'),data=payload?.data||{},list=Array.isArray(data.notes)?data.notes:[],rows=rowsFrom(list);start+=list.length;
    if(choice==='oldest')candidates.push(...rows);else await acceptScoped(rows,source,listed);
    if(!list.length||list.length<100){exhausted=true;break;}
   }
   capped=choice==='oldest'&&!exhausted&&start>=10000;
  }else if(source.type==='tag'){
   let cursor='0';const cursors=new Set([cursor]);
   for(let page=1;page<=250&&(choice==='oldest'||out.length<limit);page++){
    if(stopRequested)throw new Error('停止しました');status('#'+source.value+' が付いた記事');
    const payload=await xhrJSON('https://note.com/api/v3/searches?context=note&q='+encodeURIComponent(source.value)+'&size=20&start='+encodeURIComponent(cursor)+'&sort=new'),result=normalizeSearch(payload),rows=rowsFrom(result.arr);
    if(choice==='oldest')candidates.push(...rows);else await acceptScoped(rows,source,listed);
    if(result.last||!result.arr.length){exhausted=true;break;}
    if(result.cursor==null||cursors.has(String(result.cursor))){capped=choice==='oldest';break;}
    cursor=String(result.cursor);cursors.add(cursor);if(page===250)capped=choice==='oldest';
   }
  }
  if(choice==='oldest'){
   const verified=[];
   for(let offset=0;offset<candidates.length;offset+=6){
    if(stopRequested)throw new Error('停止しました');status('条件内の最古記事を照合 '+offset+'/'+candidates.length);
    const batch=candidates.slice(offset,offset+6),results=await Promise.all(batch.map(row=>verify(row,source,listed)));
    for(let index=0;index<results.length;index++){const result=results[index];if(result.row)verified.push({...result,order:offset+index});else issue(batch[index],result.reason,source,result.type);}
   }
   verified.sort((a,b)=>Number.isFinite(a.date)&&Number.isFinite(b.date)?a.date-b.date||a.order-b.order:a.order-b.order);
   for(const result of verified){if(!Number.isFinite(result.date))issue(result.row,'投稿日未確認：最古の順序は未確認',source,'scope-unavailable');add(result.row);if(out.length>=limit)break;}
   if(capped&&!exhausted&&cappedSources.length<160)cappedSources.push({kind:source.type,source:source.label||source.value,limit:source.type==='tag'?250:10000,reason:'取得上限または継続情報を確認できず、最古は確認できた範囲内'});
  }
 }
 page.__MUMEI_PROFILE_CARD_SOURCE_SELECTION__={choice,unavailable,scopeUnavailable,scopeRejected,fixedSkipped,issues,recorded:issues.length,cappedSources};
 if(unavailable||scopeRejected||cappedSources.length)setStatus('条件に合う記事 '+out.length+'人｜タグ対象外 '+scopeRejected+'件｜条件未確認 '+unavailable+'件'+(cappedSources.length?'｜最古は確認範囲内（取得上限あり）':''));
 return out;
}`;
const notice=String.raw`function sourceSelectionNotice(run=readRun()){
 const selection=run?.sourceSelection;if(!selection)return'';const parts=[];
 if(selection.scopeRejected)parts.push('タグ対象外 '+selection.scopeRejected+'件');
 if(selection.unavailable)parts.push('対象条件未確認・固定なし '+selection.unavailable+'件');
 if(selection.cappedSources?.length)parts.push('最古は確認範囲内（取得上限あり）');
 return parts.length?'｜'+parts.join('｜'):'';
}`;
export function transformCoreSourceScope(source){
 source=replaceFunction(source,'collectUnified',helpers+'\n'+collect);
 source=replaceFunction(source,'sourceSelectionNotice',notice);
 source=once(source," const notePromise=xhrJSON('https://note.com/api/v3/notes/'+encodeURIComponent(row.key)).catch(()=>({}));"," const notePromise=scopeNote(row.key).catch(()=>({}));");
 source=once(source,'async function buildRows(input,special=false,workmom=false,parenting=false){','async function buildRows(input,special=false,workmom=false,parenting=false){\n resetSourceScopeNotes();');
 source=once(source,'async function buildRowsFromSavedSpecial(maxCount){','async function buildRowsFromSavedSpecial(maxCount){\n resetSourceScopeNotes();');
 return source;
}
