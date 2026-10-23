import { createClient } from "npm:@supabase/supabase-js@2.112.4";
const db=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false}});
const H={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"content-type,x-ingest-token","Access-Control-Allow-Methods":"POST,OPTIONS","Content-Type":"application/json; charset=utf-8"};
const out=(x:unknown,s=200)=>new Response(JSON.stringify(x),{status:s,headers:H});
const PURPOSE="note_notification_and_own_comment_sync",SOURCE="successful-note-comment-post";
const ARTICLE=/^n[A-Za-z0-9]{1,127}$/,COMMENT=/^nc[A-Za-z0-9]{1,126}$/,ACCOUNT=/^[a-z0-9_-]{1,128}$/;
async function sha(v:string){const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(v));return[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("")}
async function identity(req:Request){
 const raw=req.headers.get("X-Ingest-Token")||"";if(!raw||raw.length>256)throw new Error("INGEST_TOKEN_INVALID");
 const tokenHash=await sha(raw),{data:t,error}=await db.from("insight_notification_ingest_tokens").select("id,member_id,own_comment_account").eq("token_hash",tokenHash).eq("purpose",PURPOSE).is("revoked_at",null).gt("expires_at",new Date().toISOString()).maybeSingle();
 if(error)throw new Error("AUTH_CHECK_UNAVAILABLE");if(!t?.id)throw new Error("OWN_COMMENT_SCOPE_REQUIRED");
 const memberId=String(t.member_id);let q=db.from("insight_access_applications").select("note_id,status,verified_at,revoked_at");q=memberId==="owner"?q.eq("note_id","ss_yr"):q.eq("id",memberId);
 const{data:a,error:ae}=await q.eq("status","active").is("revoked_at",null).not("verified_at","is",null).limit(1).maybeSingle();
 if(ae)throw new Error("AUTH_CHECK_UNAVAILABLE");if(!a?.verified_at)throw new Error("OWN_COMMENT_PROFILE_VERIFICATION_REQUIRED");
 const noteId=String(a.note_id).toLowerCase();if(!ACCOUNT.test(noteId)||t.own_comment_account!==noteId)throw new Error("OWN_COMMENT_ACCOUNT_INVALID");
 return{memberId,noteId,tokenHash};
}
// Bound bytes while reading, before JSON parsing. Never persist arbitrary metadata,
// request bodies, cookies, credentials, or client-provided member IDs.
async function boundedJson(req:Request){
 if(Number(req.headers.get("content-length")||0)>512_000)throw new Error("PAYLOAD_TOO_LARGE");
 if(!req.body)throw new Error("INVALID_PAYLOAD");const reader=req.body.getReader(),chunks:Uint8Array[]=[];let size=0;
 try{while(true){const{done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>512_000){await reader.cancel();throw new Error("PAYLOAD_TOO_LARGE")}chunks.push(value)}}finally{reader.releaseLock()}
 const bytes=new Uint8Array(size);let offset=0;for(const part of chunks){bytes.set(part,offset);offset+=part.byteLength}
 try{return JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes))}catch{throw new Error("INVALID_PAYLOAD")}
}
function validateRecord(r:any,account:string){
 if(!r||r.schema!==1||r.source!==SOURCE||r.account!==account||r.author?.urlname!==account)throw new Error("OWN_COMMENT_ACCOUNT_MISMATCH");
 if(typeof r.articleKey!=="string"||!ARTICLE.test(r.articleKey)||typeof r.commentKey!=="string"||!COMMENT.test(r.commentKey))throw new Error("INVALID_COMMENT_ID");
 if(r.parentKey!==null&&(typeof r.parentKey!=="string"||!COMMENT.test(r.parentKey)||r.parentKey===r.commentKey))throw new Error("INVALID_PARENT_ID");
 const id=[account,r.articleKey,r.commentKey].join(":");if(r.id!==id)throw new Error("INVALID_CLIENT_ID");
 if(typeof r.body!=="string"||!r.body.trim()||r.body.length>100_000||r.body.includes("\u0000"))throw new Error("INVALID_COMMENT_BODY");
 if(typeof r.createdAt!=="string"||!/^\d{4}-\d{2}-\d{2}T/.test(r.createdAt)||!Number.isFinite(Date.parse(r.createdAt))||Date.parse(r.createdAt)>Date.now()+300_000)throw new Error("INVALID_COMMENT_TIME");
 let articleUrl:string|null=null;
 if(r.articleUrl!=null){try{const u=new URL(r.articleUrl);if(u.protocol!=="https:"||u.hostname!=="note.com"||u.username||u.password||u.port||!new RegExp(`^/[A-Za-z0-9_-]+/n/${r.articleKey}(?:/comments)?$`).test(u.pathname))throw new Error();u.pathname=u.pathname.replace(/\/comments$/,"");u.search="";u.hash="";articleUrl=u.toString()}catch{throw new Error("INVALID_ARTICLE_URL")}}
 return {id,account,articleUrl,articleKey:r.articleKey,commentKey:r.commentKey,parentKey:r.parentKey,body:r.body,createdAt:new Date(r.createdAt).toISOString()};
}
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:H});if(req.method!=="POST")return out({ok:false,error:"METHOD_NOT_ALLOWED"},405);
 try{
  const who=await identity(req),body=await boundedJson(req);
  if(!Array.isArray(body?.records)||!body.records.length||body.records.length>20)throw new Error("INVALID_RECORDS");
  const records=body.records.map((r:any)=>validateRecord(r,who.noteId));
  if(new Set(records.map((r:any)=>r.id)).size!==records.length)throw new Error("DUPLICATE_RECORD_IDS");
  // The RPC rechecks and locks this token, then inserts and acknowledges in one
  // transaction. A downgrade/revocation cannot race the authorization check.
  const{data,error}=await db.rpc("insight_archive_own_comments",{p_token_hash:who.tokenHash,p_account:who.noteId,p_records:records});
  if(error)throw new Error("OWN_COMMENT_SAVE_FAILED");
  if(data?.ok!==true||!Array.isArray(data.acks))throw new Error("OWN_COMMENT_NOT_ACKNOWLEDGED");
  const ids=new Set(records.map((r:any)=>r.id));
  if(data.acks.length!==records.length||data.acks.some((a:any)=>!ids.has(a.id)||a.persisted!==true)||new Set(data.acks.map((a:any)=>a.id)).size!==records.length)throw new Error("OWN_COMMENT_NOT_ACKNOWLEDGED");
  return out({ok:true,acks:data.acks.map((a:any)=>({id:a.id,persisted:true}))});
 }catch(e){const error=e instanceof Error?e.message:"OWN_COMMENT_SAVE_FAILED";const status=error==="PAYLOAD_TOO_LARGE"?413:/REQUIRED|TOKEN|MISMATCH/.test(error)?401:/INVALID|DUPLICATE/.test(error)?400:503;return out({ok:false,error},status)}
});
