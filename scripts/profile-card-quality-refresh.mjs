// Included inside each existing implementation IIFE by the standalone builder.
// Only an explicit resume of a pending source hold may request fresh metadata.
export const qualityRefreshHelpers=String.raw`
async function qualityRetryHeldRun(run){
 const hold=run?.qualityHold;
 if(!hold)return run;
 // A swapped generated File is resolved by regeneration and the file gate.
 // It must never trigger article/profile requests.
 if(hold.kind==='file')return run;
 const runId=run.createdAt,articleKey=run.articleKey,holdJSON=JSON.stringify(hold);
 const stale=()=>{throw Object.assign(new Error('品質保留の再確認中に作成記録が変わりました。本文と現在の途中記録は保持しています'),{code:'QUALITY_HOLD',hold,qualityHold:hold})};
 const blocked=()=>{
  const current=readRun();
  if(!current||current.articleKey!==editorArticleKey()||current.articleKey!==articleKey||current.createdAt!==runId||JSON.stringify(current.qualityHold)!==holdJSON)return stale();
  return qualityBlock(hold);
 };
 if(hold.kind!=='source'||hold.phase!=='images'||qualityCall('enabled',[],false)!==true)return await blocked();
 const account=value=>/^[a-z0-9_-]+$/i.test(String(value||'').trim())?String(value).trim().toLowerCase():'';
 const noteIdentity=value=>{
  try{
   const url=new URL(String(value||''));
   if(url.protocol!=='https:'||!['note.com','www.note.com'].includes(url.hostname)||url.username||url.password)return null;
   const match=url.pathname.match(/^\/([a-z0-9_-]+)(?:\/n\/(n[a-f0-9]{12}))?\/?$/i);
   return match?{account:account(match[1]),key:String(match[2]||'').toLowerCase()}:null;
  }catch{return null}
 };
 const rowIdentity=row=>({account:account(row?.urlname),key:String(row?.key||'').toLowerCase(),url:noteIdentity(row?.url)});
 const sameIdentity=(first,second)=>Boolean(first&&second&&first.account===second.account&&first.key===second.key);
 const expected={account:account(hold.identity?.account),key:String(hold.identity?.key||'').toLowerCase(),url:noteIdentity(hold.identity?.url)};
 const matches=row=>{const actual=rowIdentity(row);return actual.account===expected.account&&actual.key===expected.key&&sameIdentity(actual.url,expected.url)};
 const itemsContain=(saved,row)=>{const wanted=noteIdentity(row.url);return !wanted||(saved.items||[]).some(item=>sameIdentity(noteIdentity(item?.url),wanted))};
 const current=readRun();
 if(!current||current.articleKey!==editorArticleKey()||articleKey!==current.articleKey||runId!==current.createdAt||hold.runId!==runId||hold.articleKey!==current.articleKey||JSON.stringify(current.qualityHold)!==holdJSON)return stale();
 if(!Array.isArray(run.rows)||!Array.isArray(run.items))return await blocked();
 const at=Number.isInteger(hold.index)&&matches(run.rows[hold.index])?hold.index:run.rows.findIndex(matches);
 if(at<0||!matches(run.rows[at])||itemsContain(run,run.rows[at]))return await blocked();
 const original=run.rows[at],originalJSON=JSON.stringify(original);
 if(!Array.isArray(current.rows)||JSON.stringify(current.rows[at])!==originalJSON)return stale();
 const id=account(original.urlname),key=String(original.key||'').toLowerCase(),urlIdentity=noteIdentity(original.url);
 if(!id||!sameIdentity(urlIdentity,{account:id,key})||(!original.profileOnly&&!/^n[a-f0-9]{12}$/i.test(key)))return await blocked();
 const originalItemsJSON=JSON.stringify(run.items||[]);
 try{
  // A profile-only participant has no article endpoint. Its existing verified
  // no-article evidence remains required, together with the fresh profile ID.
  const [notePayload,profilePayload]=await Promise.all([
   original.profileOnly?Promise.resolve(null):xhrJSON('https://note.com/api/v3/notes/'+encodeURIComponent(original.key)),
   xhrJSON('https://note.com/api/v2/creators/'+encodeURIComponent(original.urlname))
  ]);
  const note=notePayload?.data||notePayload||null;
  const profile=profilePayload?.data?.creator||profilePayload?.data?.user||profilePayload?.data||profilePayload||null;
  if(!profile||typeof profile!=='object'||account(profile.urlname||profile.urlName)!==id||!String(profile.nickname||profile.name||'').trim())return await blocked();
  const user=note?.user||note?.author||{};
  if(!original.profileOnly&&(!note||typeof note!=='object'||String(note.key||'').toLowerCase()!==key||account(user.urlname||user.urlName)!==id))return await blocked();
  if(!original.profileOnly&&(note.noteUrl||note.url)&&!sameIdentity(noteIdentity(note.noteUrl||note.url),{account:id,key}))return await blocked();
  if(!original.profileOnly&&!['name','title'].some(field=>Object.prototype.hasOwnProperty.call(note,field)))return await blocked();
  const profileFields=['profile','description','bio','introduction','self_introduction','note_intro'];
  const hasProfileText=Object.prototype.hasOwnProperty.call(original,'profileText');
  if(hasProfileText&&typeof original.profileText!=='string')return await blocked();
  if(hasProfileText&&!profileFields.some(field=>Object.prototype.hasOwnProperty.call(profile,field)))return await blocked();
  const biography=profile.profile??profile.description??profile.bio??profile.introduction??profile.self_introduction??profile.note_intro??'';
  if(original.gallery126&&hasProfileText&&typeof biography!=='string')return await blocked();
  if(original.profileOnly){
   const proof=original.noPublicArticleEvidence,profileUrl='https://note.com/'+id;
   if(profile.noteCount!==0||key||!original.gallery126||original.url!==profileUrl||original.actorUrl!==profileUrl||original.title!==''||original.thumbUrl!==''||original.publishAt!==null||original.articleSelection!=='profile-only-confirmed'||original.oldestVerified!==false||original.oldestEvidence!==null||!proof||proof.creator!==id||proof.profileUrl!==profileUrl||proof.noteCount!==0||proof.contentsTotal!==0||proof.isLastPage!==true||proof.source!=='note-public-api'||!Number.isFinite(Date.parse(proof.checkedAt||'')))return await blocked();
  }
  const editorSource=Boolean(run.likesHistoryFix230||run.gallery126||original.likesHistory||original.gallery126);
  const avatar=value=>mediaUrl(value?.profileImageUrl||value?.userProfileImagePath||value?.user_profile_image_url||value?.profile_image_url||value?.user_profile_image_path||value?.profile_image_path||value?.profileImagePath||value?.icon_url||value?.image_url||'');
  const editorThumb=value=>mediaUrl(value?.eyecatch||value?.eyecatch_url||value?.spEyecatch||value?.thumbnailExternalUrl||value?.image_url||value?.imageUrl||value?.thumbnail_url||value?.thumbnailUrl||value?.eyecatch_image||value?.eyecatchImage||value?.image||value?.thumbnail||'');
  const coreThumb=value=>mediaUrl(value?.eyecatch_url||value?.image_url||value?.imageUrl||value?.thumbnail_url||value?.thumbnailUrl||value?.eyecatch?.url||value?.eyecatch_image?.url||value?.eyecatchImage?.url||value?.image?.url||value?.thumbnail?.url||'');
  const actorImageUrl=editorSource?(avatar(profile)||avatar(user)):(mediaUrl(user.user_profile_image_url||user.profileImageUrl||user.profile_image_url||user.user_profile_image_path||user.profile_image_path||user.profileImagePath||'')||mediaUrl(profile.user_profile_image_url||profile.profile_image_url||profile.profileImageUrl||profile.user_profile_image_path||profile.profile_image_path||profile.profileImagePath||profile.icon_url||profile.image_url||''));
  let thumbUrl=original.profileOnly?'':editorSource?editorThumb(note):coreThumb(note),thumbnailMissingEvidence=null;
  if(!original.profileOnly&&!thumbUrl){
   if(original.gallery126&&Object.prototype.hasOwnProperty.call(note,'eyecatch')&&(note.eyecatch===null||note.eyecatch==='')){
    thumbnailMissingEvidence={key:original.key,articleUrl:original.url,checkedAt:new Date().toISOString(),reason:'The verified article API reports an unconfigured eyecatch'};
   }else thumbUrl=mediaUrl(await articleMetaImage(original.url));
  }
  // Core has always allowed its absent-thumbnail fallback. The editor's
  // existing required-thumbnail path stays held when freshness is uncertain.
  if(editorSource&&!original.profileOnly&&!thumbUrl&&!thumbnailMissingEvidence)return await blocked();
  const freshCreator=String(profile.nickname||profile.name);
  let pending={...original,creator:editorSource&&original.finalMarker?freshCreator:freshCreator.trim(),actorImageUrl,thumbUrl,title:original.profileOnly?original.title:String(note.name||note.title||'無題の記事').trim()};
  if(editorSource||Object.prototype.hasOwnProperty.call(original,'avatarMissing'))pending.avatarMissing=!actorImageUrl;
  if(hasProfileText){
   if(original.gallery126)pending.profileText=biography.replace(/\r\n?/g,'\n').trim();
   else{
    const doc=new DOMParser().parseFromString(String(biography).replace(/<br\s*\/?\s*>/gi,'\n'),'text/html');
    pending.profileText=String(doc.body.textContent||'').replace(/\r\n?/g,'\n').replace(/[ \t]+/g,' ').trim();
   }
  }
  if(original.gallery126&&!original.profileOnly){pending.articleThumbnailMissing=Boolean(thumbnailMissingEvidence);pending.thumbnailMissingEvidence=thumbnailMissingEvidence}
  pending=qualityCall('refreshed',[pending,{target:id,note,profile}],null);
  if(!pending||qualityCall('hasVerifiedFreshIdentity',[pending],false)!==true||qualityCall('preflight',[pending,{phase:'images'}],null)||qualityCall('enabled',[],false)!==true)return await blocked();
  // The response may only replace pending metadata. Selection, order, designs,
  // article/profile URLs and all native ownership data remain the saved plan.
  for(const field of ['urlname','key','url','actorUrl','index','designIndex','likerKey','finalMarker','gallery126','profileOnly'])if(JSON.stringify(pending[field])!==JSON.stringify(original[field]))return await blocked();
  const changesOwnedIntroduction=saved=>{
   if(typeof activityText!=='function'||!hasProfileText)return false;
   const before=activityText(original),after=activityText(pending),galleryOwned=saved.galleryProfileTexts?.[original.url]||saved.galleryProfileTexts?.[id];
   return before!==after&&((saved.activityTexts||[]).includes(before)||typeof galleryOwned==='string'&&galleryOwned!==after);
  };
  // An older interrupted version may already have written a pending profile.
  // Keep the known hold if changing metadata could leave that owned text stale;
  // never infer ownership from nearby paragraphs or rewrite existing text.
  if(changesOwnedIntroduction(run))return await blocked();
  const latest=readRun();
  if(!latest||latest.articleKey!==editorArticleKey()||latest.articleKey!==articleKey||latest.createdAt!==runId||JSON.stringify(latest.qualityHold)!==holdJSON||!Array.isArray(latest.rows)||JSON.stringify(latest.rows[at])!==originalJSON||JSON.stringify(latest.items||[])!==originalItemsJSON||itemsContain(latest,original)||changesOwnedIntroduction(latest))return stale();
  const rows=latest.rows.slice();rows[at]=pending;
  const {qualityHold:clearedHold,...retained}=latest;
  try{
   writeRun({...retained,rows,updatedAt:Date.now()});
   await page.__MUMEI_PROFILE_CARD_RUN_STORE__?.flush?.();
   qualityCall('resolved',[pending,hold]);
  }catch(error){
   // A failed checkpoint cannot turn a previously known mismatch into an
   // unheld run. Restore the exact prior row before retaining its hold.
   writeRun(latest);
   return await blocked();
  }
  return readRun();
 }catch(error){
  if(error?.code==='QUALITY_HOLD')throw error;
  return await blocked();
 }
}
`;
