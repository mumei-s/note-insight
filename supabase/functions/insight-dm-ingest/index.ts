import { createClient } from "npm:@supabase/supabase-js@2.112.4";

const U=Deno.env.get("SUPABASE_URL")!,K=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db=createClient(U,K,{auth:{persistSession:false}});
const H={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"content-type,x-ingest-token","Access-Control-Allow-Methods":"POST,OPTIONS","Content-Type":"application/json; charset=utf-8"};
const out=(x:unknown,s=200)=>new Response(JSON.stringify(x),{status:s,headers:H});
async function sha(v:string){const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(v));return[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("")}
const clean=(v:unknown,max=4000)=>typeof v==="string"?v.replace(/\u0000/g,"").replace(/\s+/g," ").trim().slice(0,max):null;
const cleanUrl=(v:unknown)=>{const s=clean(v,1600);if(!s)return null;try{const u=new URL(s);if(!u.hostname.endsWith("note.com"))return s;u.hash="";return u.toString()}catch{return s}};
async function identity(req:Request){
  const raw=req.headers.get("X-Ingest-Token")||"";if(!raw)throw new Error("DM_INGEST_TOKEN_REQUIRED");
  const now=new Date().toISOString();
  const{data,error}=await db.from("insight_dm_ingest_tokens").select("member_id,expires_at").eq("token_hash",await sha(raw)).is("revoked_at",null).gt("expires_at",now).maybeSingle();
  if(error||!data?.member_id)throw new Error("DM_INGEST_TOKEN_INVALID");
  const memberId=String(data.member_id);
  if(memberId==="owner")return{memberId,noteId:"ss_yr"};
  const{data:app}=await db.from("insight_access_applications").select("note_id,status,verified_at").eq("id",memberId).maybeSingle();
  if(app?.note_id&&app.status==="active"&&app.verified_at)return{memberId,noteId:String(app.note_id).toLowerCase()};
  const{data:profile}=await db.from("insight_notification_profiles").select("note_urlname").eq("member_id",memberId).maybeSingle();
  const noteId=String(profile?.note_urlname||"").toLowerCase();if(!noteId)throw new Error("DM_ACCOUNT_UNKNOWN");return{memberId,noteId}
}
Deno.serve(async req=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:H});
  try{
    if(req.method!=="POST")return out({ok:false,error:"METHOD_NOT_ALLOWED"},405);
    const who=await identity(req),body=await req.json().catch(()=>({}));
    const noteId=String(body?.noteId||"").trim().replace(/^@/,"").toLowerCase();
    if(noteId&&noteId!==who.noteId)throw new Error("NOTE_ACCOUNT_MISMATCH");
    const threads=Array.isArray(body?.threads)?body.threads.slice(0,800):[];
    const messages=Array.isArray(body?.messages)?body.messages.slice(0,5000):[];
    let upsertedThreads=0,upsertedMessages=0;const confirmed:string[]=[];
    for(const x of threads){
      const roomUrl=cleanUrl(x?.room_url),threadKey=clean(x?.thread_key,400)||roomUrl;
      if(!threadKey)continue;
      const row={member_id:who.memberId,thread_key:threadKey,room_url:roomUrl,peer_note_id:clean(x?.peer_note_id,120),peer_name:clean(x?.peer_name,300),peer_url:cleanUrl(x?.peer_url),peer_image_url:cleanUrl(x?.peer_image_url),last_message_at:x?.last_message_at||null,last_synced_at:new Date().toISOString(),meta:x?.meta&&typeof x.meta==="object"?x.meta:{}};
      const{error}=await db.from("insight_dm_threads").upsert(row,{onConflict:"member_id,thread_key"});if(error)throw error;upsertedThreads++
    }
    for(const x of messages){
      const threadKey=clean(x?.thread_key,400),messageKey=clean(x?.message_key,800),direction=["inbound","outbound","unknown"].includes(String(x?.direction))?String(x.direction):"unknown";
      if(!threadKey||!messageKey)continue;
      const row={member_id:who.memberId,thread_key:threadKey,message_key:messageKey,direction,sender_name:clean(x?.sender_name,300),sender_url:cleanUrl(x?.sender_url),sender_image_url:cleanUrl(x?.sender_image_url),body:clean(x?.body,12000),sent_at:x?.sent_at||null,raw_text:clean(x?.raw_text,16000),attachment_name:clean(x?.attachment_name,800),attachment_url:cleanUrl(x?.attachment_url),attachment_type:clean(x?.attachment_type,200),captured_at:new Date().toISOString(),meta:x?.meta&&typeof x.meta==="object"?x.meta:{}};
      const{error}=await db.from("insight_dm_messages").upsert(row,{onConflict:"member_id,message_key"});if(error)throw error;upsertedMessages++;confirmed.push(messageKey)
    }
    await db.from("insight_dm_sync_runs").insert({member_id:who.memberId,received_count:messages.length,upserted_count:upsertedMessages,thread_count:threads.length,source:"note-dm-reader-v1"});
    return out({ok:true,noteId:who.noteId,threadCount:upsertedThreads,messageCount:upsertedMessages,confirmedMessageKeys:[...new Set(confirmed)]})
  }catch(e){const m=e instanceof Error?e.message:String(e);console.error(m);return out({ok:false,error:m},/REQUIRED|INVALID|UNKNOWN|MISMATCH/.test(m)?401:500)}
});