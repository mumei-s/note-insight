import fs from 'node:fs';
import assert from 'node:assert/strict';
const root = 'supabase/functions/';
const guard = 'import { checkedFetch, backgroundGate, rpcValue, batchUpsert, quotaError } from "../_shared/egress-20260930.ts";\n';
function once(text, from, to) { assert.equal(text.split(from).length - 1, 1, 'Expected exactly one patch target: ' + from.slice(0, 100)); return text.replace(from, to); }
function replaceLine(text, prefix, replacement) { const lines=text.split('\n'); const ids=lines.map((x,i)=>x.startsWith(prefix)?i:-1).filter(i=>i>=0); assert.equal(ids.length,1,'Function boundary mismatch: '+prefix); lines[ids[0]]=replacement; return lines.join('\n'); }
function load(name) { let s=fs.readFileSync(root+name+'/index.ts','utf8'); assert(!s.includes('egress-20260930.ts'), 'Already patched; refusing to run twice: '+name); s=guard+s; return once(s,'{auth:{persistSession:false}}','{auth:{persistSession:false},global:{fetch:checkedFetch}}'); }
function save(name,s) { fs.writeFileSync(root+name+'/index.ts',s); }

let likes=load('insight-like-backfill');
likes=replaceLine(likes,'async function discoverCatalog',String.raw`async function discoverCatalog(memberId:string,noteId:string){
  if(!(await rpcValue(db,"insight_egress_catalog_due",{p_member:memberId})))return{pages:0,articles:0,cached:true};
  const found=new Map<string,any>();let pages=0,complete=false;
  for(let page=1;page<=200;page++){const p=await noteJson("/api/v2/creators/"+encodeURIComponent(noteId)+"/contents?kind=note&page="+page+"&disabled_pinned=true&with_notes=false"),q=articlePage(p,noteId);pages=page;for(const row of q.rows)found.set(row.article_key,row);if(q.last){complete=true;break}await sleep(25)}
  const now=new Date().toISOString(),rows=[...found.values()].map(x=>({member_id:memberId,...x,publish_at:x.publish_at&&!Number.isNaN(Date.parse(x.publish_at))?new Date(x.publish_at).toISOString():null,last_seen_at:now}));
  const changed=await batchUpsert(db,"insight_public_articles",rows);
  if(complete)await rpcValue(db,"insight_egress_catalog_complete",{p_member:memberId});
  return{pages,articles:rows.length,changed,cached:false,complete};
}`);
likes=replaceLine(likes,'async function missingArticles',String.raw`async function missingArticles(memberId:string){return(await rpcValue(db,"insight_missing_like_articles",{p_member:memberId,p_limit:20}))||[]}`);
likes=once(likes,'const{error}=await db.from("insight_public_likes").upsert(rows,{onConflict:"member_id,article_key,liker_key"});if(error)throw error','await batchUpsert(db,"insight_public_likes",rows)');
likes=once(likes,'if(!(await authorized(req)))throw new Error("CRON_SECRET_INVALID");','if(await backgroundGate(db,req))return{ok:true,paused:true,reason:"maintenance"};');
likes=once(likes,'catch(e){result.push({articleKey:art.article_key,ok:false','catch(e){if(quotaError(e))throw e;result.push({articleKey:art.article_key,ok:false');
likes=once(likes,'/CRON_SECRET/.test(msg)?401:500','quotaError(e)?402:/CRON_SECRET/.test(msg)?401:500');
assert(!likes.includes('count:"exact",head:true'));
save('insight-like-backfill',likes);

let comments=load('insight-comment-refresh');
comments=replaceLine(comments,'async function refreshProfile',String.raw`async function refreshProfile(profile:any,hardDeadline:number){
 const started=Date.now(),noteId=String(profile.note_urlname||"").toLowerCase();if(!noteId)return{ok:false,error:"NOTE_ID_REQUIRED"};
 const dataMember=noteId==="ss_yr"?"owner":String(profile.member_id),notifyMember=await notificationMember(noteId,String(profile.member_id));
 const [recent,pending,missing]=await Promise.all([recentArticles(noteId),pendingArticles(dataMember),missingArticles(dataMember)]),map=new Map<string,Article>(),notifyKeys=new Set<string>();
 for(const art of recent.filter(x=>x.commentCount>0).slice(0,5)){map.set(art.key,art);notifyKeys.add(art.key)}for(const art of pending){map.set(art.key,art);notifyKeys.add(art.key)}for(const art of missing)map.set(art.key,art);
 let inserted=0,scanned=0,changed=0,unchanged=0,failed=0,latest:string|null=null,truncated=false;
 for(const art of map.values()){
  if(Date.now()>hardDeadline-3000){truncated=true;break}
  try{
   const rows=(await comments(art.key)).map((x:any)=>({member_id:dataMember,article_key:art.key,comment_key:x.key,parent_key:x.parent,actor_key:x.urlname||x.key,actor_name:x.name,actor_url:x.url,actor_image_url:x.image,body:x.body,occurred_at:iso(x.at),is_root:!x.parent,is_creator:String(x.urlname||"").toLowerCase()===noteId,is_creator_liked:x.liked,like_count:x.likeCount}));
   for(let i=0;i<rows.length;i+=400){
    const batch=rows.slice(i,i+400),events=notifyKeys.has(art.key)?batch.filter((x:any)=>!x.is_creator).map((x:any)=>({member_id:notifyMember,fingerprint:"comment-refresh|"+art.key+"|"+x.comment_key,notification_type:x.parent_key?"reply":"comment",raw_text:x.actor_name+"さんが「"+art.title+"」に"+(x.parent_key?"返信":"コメント")+"しました",actor_name:x.actor_name,actor_url:x.actor_url,actor_image_url:x.actor_image_url,target_title:art.title,target_url:art.url,source_url:art.url,occurred_at:x.occurred_at,meta:{source:"comment-refresh",derived:true,articleKey:art.key,commentKey:x.comment_key,parentKey:x.parent_key}})):[];
    const result=await rpcValue(db,"insight_comment_refresh_batch",{p_member:dataMember,p_article:art.key,p_rows:batch,p_notifications:events});
    inserted+=Number(result.newNotifications||0);changed+=Number(result.changed||0);unchanged+=Number(result.unchanged||0);
    for(const row of batch)if(row.occurred_at&&(!latest||row.occurred_at>latest))latest=row.occurred_at;
   }
   const {error}=await db.from("insight_public_articles").update({comment_count:art.commentCount,last_seen_at:new Date().toISOString()}).eq("member_id",dataMember).eq("article_key",art.key);if(error)throw error;
   scanned++;
  }catch(error){if(quotaError(error))throw error;failed++}
  await sleep(40);
 }
 return{ok:failed===0,noteId,dataMember,articles:scanned,failedArticles:failed,missingCandidates:missing.length,newNotifications:inserted,changedComments:changed,unchangedComments:unchanged,latestCommentAt:latest,truncated,elapsedMs:Date.now()-started};
}`);
comments=once(comments,'const supplied=req.headers.get("X-Cron-Secret")||"",{data:secret}=await db.from("insight_notification_cron_secret").select("secret").eq("singleton",true).maybeSingle();if(!secret?.secret||supplied!==secret.secret)return out({ok:false,error:"CRON_SECRET_INVALID"},401);','if(await backgroundGate(db,req))return out({ok:true,paused:true,reason:"maintenance"});');
comments=once(comments,'return out({ok:false,error:msg},500)','return out({ok:false,error:msg},quotaError(e)?402:/CRON_SECRET/.test(msg)?401:500)');
assert(!comments.includes('.from("insight_public_comments").upsert'));
save('insight-comment-refresh',comments);

let avatars=load('insight-avatar-refresh');
avatars=replaceLine(avatars,'async function missingRelationUrls',String.raw`async function missingRelationUrls(){const data=await rpcValue(db,"insight_missing_avatar_urls",{p_limit:220});return(data||[]).map((x:any)=>String(x.actor_url||"")).filter((url:string)=>Boolean(noteId(url)))}`);
avatars=replaceLine(avatars,'async function fillRelation','// Avatar propagation is performed by one database RPC per eight creators.');
const serveAt=avatars.indexOf('Deno.serve(');assert(serveAt>0);avatars=avatars.slice(0,serveAt)+String.raw`Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:H});
 try{
  if(req.method!=="POST")return out({ok:false,error:"METHOD_NOT_ALLOWED"},405);
  if(await backgroundGate(db,req))return out({ok:true,paused:true,reason:"maintenance"});
  const urls=await missingRelationUrls(),deadline=Date.now()+70000;let creators=0,rows=0,processed=0,batches=0;
  for(let i=0;i<urls.length;i+=8){
   if(Date.now()>deadline)break;
   const found=await Promise.all(urls.slice(i,i+8).map(async(url:string)=>{try{return{url,image:await creatorImage(noteId(url))}}catch{return{url,image:null}}}));
   const result=await rpcValue(db,"insight_apply_avatar_batch",{p_rows:found});
   processed+=found.length;creators+=found.filter((x:any)=>x.image).length;rows+=Number(result.rows||0);batches++;await sleep(50);
  }
  return out({ok:true,candidates:urls.length,processed,creators,rows,batches,truncated:processed<urls.length});
 }catch(e){const msg=e instanceof Error?e.message:String(e);return out({ok:false,error:msg},quotaError(e)?402:/CRON_SECRET/.test(msg)?401:500)}
});
`;
assert(!avatars.includes('.update({actor_image_url:image})'));
save('insight-avatar-refresh',avatars);

let relations=load('insight-relations');
relations=once(relations,'if(!(await cronAuthorized(req)))throw new Error("CRON_SECRET_INVALID");','if(await backgroundGate(db,req))return{ok:true,paused:true,reason:"maintenance"};');
relations=once(relations,'catch(e){results.push({ok:false,member:{noteId:x.noteId},error:errText(e)})}','catch(e){if(quotaError(e))throw e;results.push({ok:false,member:{noteId:x.noteId},error:errText(e)})}');
relations=once(relations,'/LOGIN|SESSION|INACTIVE|CRON_SECRET/.test(msg)?401:500','quotaError(e)?402:/LOGIN|SESSION|INACTIVE|CRON_SECRET/.test(msg)?401:500');
assert(relations.includes('NOTE_IDENTITY_LIST_CAPPED_AT_1000:'));
assert(relations.includes('unknownRemoved'));
save('insight-relations',relations);
console.log('PASS: four isolated backend patches; missing-like counts batched; unchanged-comment upserts removed; avatars batched; capped/unknown relation logic preserved. No billing, maintenance release, schedule-frequency change, or data deletion.');
