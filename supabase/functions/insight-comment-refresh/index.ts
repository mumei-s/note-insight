import { checkedFetch, backgroundGate, rpcValue, quotaError } from "../_shared/egress-20260930.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
const U=Deno.env.get("SUPABASE_URL")!,K=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,db=createClient(U,K,{auth:{persistSession:false},global:{fetch:checkedFetch}}),NOTE="https://note.com";
const HEADERS={"Content-Type":"application/json; charset=utf-8","Access-Control-Allow-Origin":"https://mumei-s.github.io","Access-Control-Allow-Headers":"content-type,x-cron-secret,x-insight-token","Access-Control-Allow-Methods":"POST,OPTIONS"};
const o=(v:any)=>v&&typeof v==="object"&&!Array.isArray(v)?v:{},a=(v:any)=>Array.isArray(v)?v:[],s=(v:any,d="")=>typeof v==="string"?v:d,n=(v:any,d=0)=>typeof v==="number"&&Number.isFinite(v)?v:d,sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms)),out=(x:unknown,status=200)=>new Response(JSON.stringify(x),{status,headers:HEADERS}),iso=(v:any)=>typeof v==="string"&&!Number.isNaN(Date.parse(v))?new Date(v).toISOString():null;
async function noteJson(path:string,deadline=Infinity){const remaining=deadline-Date.now();if(remaining<=0)throw new Error("COMMENT_REFRESH_DEADLINE");const c=new AbortController(),t=setTimeout(()=>c.abort(),Math.min(12000,remaining));try{const r=await fetch(NOTE+path,{headers:{Accept:"application/json","User-Agent":"Mumei-S-note-INSIGHT/3.6 (+comment-refresh)"},signal:c.signal});if(!r.ok)throw new Error(`NOTE_PUBLIC_${r.status}`);return await r.json()}finally{clearTimeout(t)}}
type Article={key:string;title:string;url:string;publishAt:string|null;commentCount:number};
async function recentArticles(noteId:string,deadline=Infinity){const p=o(await noteJson(`/api/v2/creators/${encodeURIComponent(noteId)}/contents?kind=note&page=1&disabled_pinned=true`,deadline)),d=o(p.data);return a(d.contents??d.notes).map((x:any):Article|null=>{const v=o(o(x).note??x),key=s(v.key);return key?{key,title:s(v.name??v.title,"無題の記事"),url:s(v.noteUrl??v.url,`${NOTE}/${noteId}/n/${key}`),publishAt:s(v.publishAt??v.publish_at)||null,commentCount:n(v.commentCount??v.comment_count)}:null}).filter(Boolean) as Article[]}
function commentText(v:any):string{if(typeof v==="string")return v;if(Array.isArray(v))return v.map(commentText).filter(Boolean).join("\n");const d=o(v);if(typeof d.value==="string")return d.value;return[...a(d.children),...a(d.content)].map(commentText).filter(Boolean).join("\n")}
function pageRows(p:any){const payload=p?.data,d=o(payload),rows=Array.isArray(payload)?payload:a(d.comments??d.note_comments??d.contents),next=p?.next_page??p?.nextPage??d.next_page??d.nextPage;return{rows,last:next==null||next===false||next===""}}
function normalize(r:any,parent:string|null=null){const row=o(r),u=o(row.user??row.author),urlname=s(u.urlname)||null,key=s(row.key??row.comment_key);if(!key)return null;return{key,parent:s(row.parent_key??row.parentKey)||parent,urlname,name:s(u.nickname??u.name,"noteユーザー"),url:urlname?`${NOTE}/${urlname}`:null,image:s(u.user_profile_image_url??u.profile_image_url??u.profileImageUrl)||null,body:commentText(row.comment??row.body??row.text).replace(/\s+/g," ").trim().slice(0,1000),at:s(row.created_at??row.createdAt)||null,liked:Boolean(row.is_creator_liked??row.isCreatorLiked??row.is_liked_by_note_owner),likeCount:n(row.like_count??row.likeCount)}}
async function commentPages(articleKey:string,parentKey:string|null=null,deadline=Infinity){const rows:any[]=[];for(let page=1;page<=20;page++){const parent=parentKey?`&parent_key=${encodeURIComponent(parentKey)}`:"",p=await noteJson(`/api/v3/notes/${encodeURIComponent(articleKey)}/note_comments?order=oldest&per_page=100&page=${page}${parent}`,deadline),cp=pageRows(p);rows.push(...cp.rows);if(cp.last)break;await sleep(40)}return rows}
async function comments(articleKey:string,deadline=Infinity){const all=new Map<string,any>(),roots=await commentPages(articleKey,null,deadline);for(const raw of roots){const root=o(raw),base=normalize(root,null);if(!base)continue;all.set(base.key,base);const embedded=normalize(root.latest_creator_reply,base.key);if(embedded)all.set(embedded.key,embedded);const replyCount=n(root.reply_count??root.replyCount),known=embedded?1:0;if(replyCount>known){for(const rr of await commentPages(articleKey,base.key,deadline)){const reply=normalize(rr,base.key);if(reply&&reply.key!==base.key)all.set(reply.key,reply)}}}return[...all.values()]}
async function notificationMember(noteId:string,dataMember:string){
 // The owner has an application UUID but its canonical profile is "owner".
 // Use the same verified scope as comments instead of selecting an alias UUID
 // that has no profile FK target (and cannot share the unique note ID).
 const {data:profile,error}=await db.from("insight_notification_profiles").select("member_id,note_urlname").eq("member_id",dataMember).maybeSingle();if(error)throw error;
 if(profile&&String(profile.note_urlname||"").toLowerCase()===noteId)return String(profile.member_id);
 const {data:app,error:ae}=await db.from("insight_access_applications").select("id,note_id,display_name,verified_at").eq("id",dataMember).eq("note_id",noteId).eq("status","active").maybeSingle();if(ae)throw ae;
 if(!app?.verified_at)throw new Error("COMMENT_NOTIFICATION_PROFILE_MISSING");
 const {error:pe}=await db.from("insight_notification_profiles").upsert({member_id:String(app.id),note_urlname:noteId,note_nickname:String(app.display_name||noteId),role:"member",verified_at:app.verified_at,public_watch_enabled:false},{onConflict:"member_id",ignoreDuplicates:true});if(pe)throw pe;
 return String(app.id);
}
async function memberProfile(req:Request){
 const token=req.headers.get("X-Insight-Token")||"";if(!token)throw new Error("INSIGHT_LOGIN_REQUIRED");
 const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(token)),hash=[...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,"0")).join("");
 const {data:session,error:se}=await db.from("insight_member_sessions").select("application_id,expires_at,revoked_at").eq("token_hash",hash).maybeSingle();if(se)throw se;
 if(!session||session.revoked_at||!Number.isFinite(Date.parse(session.expires_at))||Date.parse(session.expires_at)<=Date.now())throw new Error("INSIGHT_SESSION_INVALID");
 const {data:app,error:ae}=await db.from("insight_access_applications").select("id,note_id,status,verified_at").eq("id",session.application_id).maybeSingle();if(ae)throw ae;
 if(!app||app.status!=="active"||!app.verified_at)throw new Error("INSIGHT_MEMBER_INACTIVE");
 return{member_id:String(app.id),note_urlname:String(app.note_id||"").toLowerCase()};
}
async function pendingArticles(dataMember:string){const {data,error}=await db.rpc("insight_fast_comment_threads",{p_member:dataMember,p_offset:0,p_limit:8,p_query:"",p_status:"pending"});if(error)return[] as Article[];const keys=[...new Set((data||[]).map((r:any)=>String(r.article_key||"")).filter(Boolean))];if(!keys.length)return[];const {data:rows}=await db.from("insight_public_articles").select("article_key,title,url,publish_at,comment_count").eq("member_id",dataMember).in("article_key",keys);return(rows||[]).map((r:any)=>({key:String(r.article_key),title:String(r.title||"記事"),url:String(r.url||""),publishAt:r.publish_at?String(r.publish_at):null,commentCount:Number(r.comment_count||0)}))}
async function missingArticles(dataMember:string,rotationTick:number){
 const {data,error}=await db.rpc("insight_missing_comment_articles",{p_member:dataMember,p_limit:100});if(error)return[] as Article[];
 const pool=(data||[]).map((r:any)=>({key:String(r.article_key),title:String(r.title||"記事"),url:String(r.url||""),publishAt:r.publish_at?String(r.publish_at):null,commentCount:Number(r.comment_count||0)}));
 // Inaccessible old articles must not permanently occupy all six repair slots.
 const start=pool.length>6?rotationTick%pool.length:0;
 return [...pool.slice(start),...pool.slice(0,start)].slice(0,6) as Article[];
}
async function refreshProfile(profile:any,hardDeadline:number,articleKey="",manual=false){
 const started=Date.now(),noteId=String(profile.note_urlname||"").toLowerCase();if(!noteId)return{ok:false,error:"NOTE_ID_REQUIRED"};
 const dataMember=noteId==="ss_yr"?"owner":String(profile.member_id);
 if(!await rpcValue(db,"insight_comment_refresh_claim",{p_member:dataMember}))return{ok:true,skipped:true,reason:"recent"};
 const notifyMember=await notificationMember(noteId,dataMember);
 const [recent,pending,missing]=await Promise.all([recentArticles(noteId,hardDeadline),pendingArticles(dataMember),missingArticles(dataMember,Math.floor(Date.now()/(manual?60000:900000)))]),map=new Map<string,Article>(),notifyKeys=new Set<string>();
 if(articleKey){const {data:article,error}=await db.from("insight_public_articles").select("article_key,title,url,publish_at,comment_count").eq("member_id",dataMember).eq("article_key",articleKey).maybeSingle();if(error)throw error;if(article)map.set(articleKey,{key:articleKey,title:String(article.title||"記事"),url:String(article.url||`${NOTE}/${noteId}/n/${articleKey}`),publishAt:article.publish_at||null,commentCount:Number(article.comment_count||0)})}
 for(const art of recent.filter(x=>x.commentCount>0).slice(0,5)){map.set(art.key,art);notifyKeys.add(art.key)}for(const art of pending){map.set(art.key,art);notifyKeys.add(art.key)}for(const art of missing)map.set(art.key,art);
 let inserted=0,scanned=0,changed=0,unchanged=0,failed=0,latest:string|null=null,truncated=false;const errors:string[]=[];
 for(const art of map.values()){
  if(Date.now()>hardDeadline-3000){truncated=true;break}
  try{
   const rows=(await comments(art.key,hardDeadline)).map((x:any)=>({member_id:dataMember,article_key:art.key,comment_key:x.key,parent_key:x.parent,actor_key:x.urlname||x.key,actor_name:x.name,actor_url:x.url,actor_image_url:x.image,body:x.body,occurred_at:iso(x.at),is_root:!x.parent,is_creator:String(x.urlname||"").toLowerCase()===noteId,is_creator_liked:x.liked,like_count:x.likeCount}));
   for(let i=0;i<rows.length;i+=400){
    const batch=rows.slice(i,i+400),events=notifyKeys.has(art.key)?batch.filter((x:any)=>!x.is_creator).map((x:any)=>({member_id:notifyMember,fingerprint:"comment-refresh|"+art.key+"|"+x.comment_key,notification_type:x.parent_key?"reply":"comment",raw_text:x.actor_name+"さんが「"+art.title+"」に"+(x.parent_key?"返信":"コメント")+"しました",actor_name:x.actor_name,actor_url:x.actor_url,actor_image_url:x.actor_image_url,target_title:art.title,target_url:art.url,source_url:art.url,occurred_at:x.occurred_at,meta:{source:"comment-refresh",derived:true,articleKey:art.key,commentKey:x.comment_key,parentKey:x.parent_key}})):[];
    const result=await rpcValue(db,"insight_comment_refresh_batch",{p_member:dataMember,p_article:art.key,p_rows:batch,p_notifications:events});
    inserted+=Number(result.newNotifications||0);changed+=Number(result.changed||0);unchanged+=Number(result.unchanged||0);
    for(const row of batch)if(row.occurred_at&&(!latest||row.occurred_at>latest))latest=row.occurred_at;
   }
   const {error}=await db.from("insight_public_articles").update({comment_count:art.commentCount,last_seen_at:new Date().toISOString()}).eq("member_id",dataMember).eq("article_key",art.key);if(error)throw error;
   scanned++;
  }catch(error){if(quotaError(error))throw error;if(Date.now()>=hardDeadline){truncated=true;break}failed++;const message=error instanceof Error?error.message:"COMMENT_SAVE_FAILED";errors.push(message);console.error("comment-refresh-article",message)}
  await sleep(40);
 }
 return{ok:failed===0,noteId,dataMember,articles:scanned,failedArticles:failed,errors:[...new Set(errors)],missingCandidates:missing.length,newNotifications:inserted,changedComments:changed,unchangedComments:unchanged,latestCommentAt:latest,truncated,elapsedMs:Date.now()-started};
}
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:HEADERS});
 try{
  if(req.method!=="POST")return out({ok:false,error:"METHOD_NOT_ALLOWED"},405);
  const body=await req.json().catch(()=>({}));
  if(body.action==="refresh"){
   const profile=await memberProfile(req);
   if(await rpcValue(db,"insight_background_maintenance"))return out({ok:true,paused:true,reason:"maintenance"});
   const articleKey=typeof body.articleKey==="string"&&/^n[0-9a-f]+$/i.test(body.articleKey)?body.articleKey:"";
   const result=await refreshProfile(profile,Date.now()+25000,articleKey,true);
   return out(result);
  }
  if(await backgroundGate(db,req))return out({ok:true,paused:true,reason:"maintenance"});
  let profileQuery=db.from("insight_notification_profiles").select("member_id,note_urlname").eq("public_watch_enabled",true).not("verified_at","is",null);
  // A cron-authenticated repair may target one scope without crawling others.
  const requested=typeof body.memberId==="string"&&/^(?:owner|[0-9a-f-]{36})$/i.test(body.memberId)?body.memberId:"";if(requested)profileQuery=profileQuery.eq("member_id",requested);
  const {data:raw,error}=await profileQuery.limit(100);if(error)throw error;
  const profiles=raw||[],globalDeadline=Date.now()+85000,slot=Math.floor(Date.now()/900000),start=profiles.length?slot%profiles.length:0,ordered=profiles.length?[...profiles.slice(start),...profiles.slice(0,start)]:[],results=[] as any[];
  for(const p of ordered){
   if(Date.now()>globalDeadline-5000)break;
   try{results.push(await refreshProfile(p,Math.min(globalDeadline,Date.now()+30000)))}catch(error){if(quotaError(error))throw error;const message=error instanceof Error?error.message:"COMMENT_REFRESH_FAILED";console.error("comment-refresh-profile",message);results.push({ok:false,error:message})}
   await sleep(80);
  }
  return out({ok:results.every(r=>r.ok!==false),profiles:results.length,totalProfiles:profiles.length,rotatedStart:start,results});
 }catch(e){const msg=e instanceof Error?e.message:String(e);return out({ok:false,error:msg},quotaError(e)?402:/CRON_SECRET|LOGIN_REQUIRED|SESSION_INVALID|MEMBER_INACTIVE/.test(msg)?401:500)}
});
