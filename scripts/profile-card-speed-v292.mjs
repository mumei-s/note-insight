// Scoped to the standalone distribution. Native completion, checkpoint flushes,
// save confirmation, pause boundaries and quality gates remain authoritative.
function once(source,from,to){
 if(source.split(from).length!==2)throw Error('Speed hook must match once: '+from.slice(0,100));
 return source.replace(from,()=>to);
}
export function transformCoreSpeed(source){
 source=once(source,'const IMAGE_PASTE_GAP=180;','const IMAGE_PASTE_GAP=20;');
 source=once(source,'const CARD_GAP_FAST=600;','const CARD_GAP_FAST=200;');
 source=once(source,'const CARD_BLOCK_PAUSE=2500;','const CARD_BLOCK_PAUSE=0;');
 source=once(source,'await sleep(120)','await sleep(40)');
 source=once(source,'await sleep(140)','await sleep(60)');
 source=once(source,'if((i+1)%10===0&&i+1<rows.length){','if(CARD_BLOCK_PAUSE>0&&(i+1)%10===0&&i+1<rows.length){');
 source=source.replaceAll('await sleep(IMAGE_PASTE_GAP)','if(i+1<rows.length)await sleep(IMAGE_PASTE_GAP)');
 // Keep the original URL in each row and its provenance. Only request a bounded
 // size from note's own image service, as the existing gallery already does.
 source=once(source,'async function bitmapFromUrl(url){',`function speedAssetUrl(value,width){
 try{const u=new URL(String(value||''));if(u.protocol==='https:'&&u.hostname==='assets.st-note.com'){
  const current=Number(u.searchParams.get('width'));u.searchParams.set('width',String(current>0?Math.min(current,width):width));return u.href;
 }}catch{}return value;
}
async function bitmapFromUrl(url){`);
 source=once(source,'bitmapFromUrl(row.actorImageUrl),bitmapFromUrl(row.thumbUrl)','bitmapFromUrl(speedAssetUrl(row.actorImageUrl,180)),bitmapFromUrl(speedAssetUrl(row.thumbUrl,860))');
 return source;
}
export function transformEditorSpeed(source){
 source=once(source,'const IMAGE_GAP=50;','const IMAGE_GAP=20;');
 source=once(source,'await sleep(70)','await sleep(40)');
 source=once(source,'await sleep(gallery?20:IMAGE_GAP)','if(i+1<rows.length)await sleep(gallery?20:IMAGE_GAP)');
 // One serialization is reused for the local copy and two isolated snapshots.
 // The backup must not share objects with read(), whose callers update arrays.
 source=once(source,
  "  const snapshot=value==null?null:JSON.parse(JSON.stringify({...value,updatedAt:stamp}));memory=snapshot;\n  let localOk=false;try{if(snapshot==null)localStorage.removeItem(key);else localStorage.setItem(key,JSON.stringify(snapshot));localOk=true}catch{}\n  const envelope={value:snapshot==null?null:JSON.parse(JSON.stringify(snapshot)),updatedAt:stamp,deleted:snapshot==null,articleKey};",
  "  const serialized=value==null?null:JSON.stringify({...value,updatedAt:stamp});\n  const snapshot=serialized==null?null:JSON.parse(serialized);memory=snapshot;\n  let localOk=false;try{if(serialized==null)localStorage.removeItem(key);else localStorage.setItem(key,serialized);localOk=true}catch{}\n  const envelope={value:serialized==null?null:JSON.parse(serialized),updatedAt:stamp,deleted:snapshot==null,articleKey};");
 source=once(source,'row.gallery126?galleryAssetUrl(row.actorImageUrl,180):row.actorImageUrl,thumbSource=row.gallery126?galleryAssetUrl(row.thumbUrl,720):row.thumbUrl','galleryAssetUrl(row.actorImageUrl,180),thumbSource=galleryAssetUrl(row.thumbUrl,860)');
 // The final, fixed article is never removed or replaced because an optional
 // bitmap is unavailable. Its real identity/link still passes the same gates.
 source=once(source,' if(avatarUnavailable||!thumb&&!thumbnailMissing){',` if(row.finalMarker)row.renderAssetStatus={avatar:avatar?'loaded':avatarRequired?'failed':'missing',thumbnail:thumb?'loaded':mediaUrl(row.thumbUrl)?'failed':'missing'};
 if(!row.finalMarker&&(avatarUnavailable||!thumb&&!thumbnailMissing)){`);
 return source;
}
