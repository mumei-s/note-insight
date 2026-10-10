import { createClient } from "npm:@supabase/supabase-js@2.112.4";

const U=Deno.env.get("SUPABASE_URL")!,K=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db=createClient(U,K,{auth:{persistSession:false}});
const H={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"content-type,x-ingest-token","Access-Control-Allow-Methods":"POST,OPTIONS","Content-Type":"application/json; charset=utf-8"};
const out=(x:unknown,s=200)=>new Response(JSON.stringify(x),{status:s,headers:H});
async function sha(v:string){const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(v));return[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("")}
const clean=(v:unknown,max=4000)=>typeof v==="string"?v.replace(/\u0000/g,"").replace(/\s+/g," ").trim().slice(0,max):null;
const bodyText=(v:unknown,max=12000)=>typeof v==="string"?v.replace(/\u0000/g,"").replace(/\r\n?/g,"\n").trim().slice(0,max):null;
const cleanUrl=(v:unknown)=>{const s=clean(v,1600);if(!s)return null;try{const u=new URL(s);if(!u.hostname.endsWith("note.com"))return s;u.hash="";return u.toString()}catch{return s}};
function profileNoteId(v:unknown){try{const u=new URL(String(v||"")),parts=u.pathname.split("/").filter(Boolean);return u.hostname==="note.com"&&parts.length===1&&/^[a-z0-9_-]+$/i.test(parts[0])?parts[0].toLowerCase():null}catch{return null}}
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
    if(body.readerStatus){
      const x=body.readerStatus,threadKey=clean(x.threadKey,400);if(!threadKey)throw new Error("THREAD_REQUIRED");
      const {data:thread,error}=await db.from("insight_dm_threads").select("meta").eq("member_id",who.memberId).eq("thread_key",threadKey).maybeSingle();if(error)throw error;
      if(thread){const {error:e}=await db.from("insight_dm_threads").update({meta:{...(thread.meta||{}),reader_status:{checked_at:new Date().toISOString(),version:clean(x.version,30),read:Math.max(0,Math.min(5000,Number(x.read)||0)),saved:Math.max(0,Number(x.saved)||0),stored:Math.max(0,Number(x.stored)||0),mode:clean(x.mode,30),complete:x.complete===true,error:clean(x.error,200)}}}).eq("member_id",who.memberId).eq("thread_key",threadKey);if(e)throw e}
      return out({ok:true,statusRecorded:Boolean(thread)});
    }
    const threads=Array.isArray(body?.threads)?body.threads.slice(0,800):[];
    const messages=Array.isArray(body?.messages)?body.messages.slice(0,5000):[];
    let upsertedThreads=0,upsertedMessages=0;const confirmed:string[]=[],registeredThreads=new Set<string>();
    for(const x of threads){
      const roomUrl=cleanUrl(x?.room_url),threadKey=clean(x?.thread_key,400)||roomUrl;
      if(!threadKey)continue;
      const {data:existing,error:lookupError}=await db.from("insight_dm_threads").select("meta,peer_note_id,peer_name,peer_url,peer_image_url,last_message_at").eq("member_id",who.memberId).eq("thread_key",threadKey).maybeSingle();if(lookupError)throw lookupError;
      const row={member_id:who.memberId,thread_key:threadKey,room_url:roomUrl,peer_note_id:clean(x?.peer_note_id,120)||existing?.peer_note_id||null,peer_name:clean(x?.peer_name,300)||existing?.peer_name||null,peer_url:cleanUrl(x?.peer_url)||existing?.peer_url||null,peer_image_url:cleanUrl(x?.peer_image_url)||existing?.peer_image_url||null,last_message_at:x?.last_message_at||null,last_synced_at:new Date().toISOString(),meta:{...(existing?.meta||{}),...(x?.meta&&typeof x.meta==="object"?x.meta:{})}};
      const{error}=await db.from("insight_dm_threads").upsert(row,{onConflict:"member_id,thread_key"});if(error)throw error;upsertedThreads++;registeredThreads.add(threadKey)
    }
    for(const x of messages){
      const threadKey=clean(x?.thread_key,400),messageKey=clean(x?.message_key,800),direction=["inbound","outbound","unknown"].includes(String(x?.direction))?String(x.direction):"unknown";
      if(!threadKey||!messageKey)continue;
      const sourceUrl=String(x?.meta?.request_url||x?.meta?.room_url||"");
      let sourceRoom="";try{const u=new URL(sourceUrl);if(u.hostname==="dm-api.note.com"||u.hostname==="note.com")sourceRoom=u.pathname.match(/\/rooms\/([0-9a-f-]{36})(?:\/messages)?(?:\/|$)/i)?.[1]||""}catch{}
      if(sourceRoom&&sourceRoom!==threadKey)throw new Error("DM_THREAD_MISMATCH");
      if(messageKey.startsWith("api:")&&!messageKey.startsWith("api:"+threadKey+":"))throw new Error("DM_THREAD_MISMATCH");
      const row={member_id:who.memberId,thread_key:threadKey,message_key:messageKey,direction,sender_name:clean(x?.sender_name,300),sender_url:cleanUrl(x?.sender_url),sender_image_url:cleanUrl(x?.sender_image_url),body:bodyText(x?.body,12000),sent_at:x?.sent_at||null,raw_text:bodyText(x?.raw_text,16000),attachment_name:clean(x?.attachment_name,800),attachment_url:cleanUrl(x?.attachment_url),attachment_type:clean(x?.attachment_type,200),captured_at:new Date().toISOString(),meta:x?.meta&&typeof x.meta==="object"?x.meta:{}};
      const{error}=await db.from("insight_dm_messages").upsert(row,{onConflict:"member_id,message_key"});if(error)throw error;
      if(!registeredThreads.has(threadKey)){
        // Direct-room reads may never visit the room list. Register the room
        // before acknowledging its message so the saved body is feed-reachable.
        const senderId=profileNoteId(row.sender_url),isPeer=direction!=="outbound"&&senderId!==who.noteId&&(direction==="inbound"||Boolean(senderId));
        const thread={member_id:who.memberId,thread_key:threadKey,room_url:/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(threadKey)?"https://note.com/messages/rooms/"+threadKey:null,peer_note_id:isPeer?senderId:null,peer_name:isPeer?(row.sender_name||senderId):null,peer_url:isPeer&&senderId?row.sender_url:null,peer_image_url:isPeer?row.sender_image_url:null,last_message_at:row.sent_at,last_synced_at:new Date().toISOString(),meta:{source:"note-dm-message-thread"}};
        // A simultaneous room-list read may already have richer peer metadata.
        const{error:threadError}=await db.from("insight_dm_threads").upsert(thread,{onConflict:"member_id,thread_key",ignoreDuplicates:true});if(threadError)throw threadError;
        registeredThreads.add(threadKey);upsertedThreads++;
      }
      if(messageKey.startsWith("api:")&&row.sent_at&&row.body){
        const{data:legacy,error:le}=await db.from("insight_dm_messages").select("id,message_key,meta").eq("member_id",who.memberId).eq("thread_key",threadKey).like("message_key","api-sig:%").eq("sent_at",row.sent_at).eq("body",clean(row.body,12000)).is("meta->>superseded_by",null).limit(2);if(le)throw le;
        if(legacy?.length===1){const{error:se}=await db.from("insight_dm_messages").update({meta:{...(legacy[0].meta||{}),superseded_by:messageKey}}).eq("id",legacy[0].id).eq("member_id",who.memberId);if(se)throw se}
      }
      upsertedMessages++;confirmed.push(messageKey)
    }
    await db.from("insight_dm_sync_runs").insert({member_id:who.memberId,received_count:messages.length,upserted_count:upsertedMessages,thread_count:threads.length,source:"note-dm-reader-v1"});
    return out({ok:true,noteId:who.noteId,threadCount:upsertedThreads,messageCount:upsertedMessages,confirmedMessageKeys:[...new Set(confirmed)]})
  }catch(e){
    const issue=e&&typeof e==="object"?e as{code?:unknown,message?:unknown}:null;
    const message=e instanceof Error?e.message:typeof issue?.message==="string"?issue.message:"";
    const code=typeof issue?.code==="string"&&/^[A-Z0-9_]{1,40}$/i.test(issue.code)?issue.code.toUpperCase():"";
    const known=new Set(["DM_INGEST_TOKEN_REQUIRED","DM_INGEST_TOKEN_INVALID","DM_ACCOUNT_UNKNOWN","NOTE_ACCOUNT_MISMATCH","THREAD_REQUIRED","DM_THREAD_MISMATCH"]);
    const safe=known.has(message)?message:code?"DM_STORAGE_"+code:"DM_INGEST_FAILED";
    console.error(safe);return out({ok:false,error:safe},known.has(message)?401:500)
  }
});
