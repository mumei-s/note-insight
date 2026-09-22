import { createClient } from "npm:@supabase/supabase-js@2.112.4";
const U=Deno.env.get("SUPABASE_URL")!,K=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db=createClient(U,K,{auth:{persistSession:false}}),ORIGIN="https://mumei-s.github.io";
const H={"Access-Control-Allow-Origin":ORIGIN,"Access-Control-Allow-Headers":"content-type,x-insight-token","Access-Control-Allow-Methods":"POST,OPTIONS","Content-Type":"application/json; charset=utf-8","Vary":"Origin"};
const out=(x:unknown,s=200)=>new Response(JSON.stringify(x),{status:s,headers:H});
async function sha(v:string){const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(v));return[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("")}
async function auth(req:Request){const raw=req.headers.get("X-Insight-Token")||"";if(!raw)throw new Error("INSIGHT_LOGIN_REQUIRED");const{data:s}=await db.from("insight_member_sessions").select("application_id,expires_at,revoked_at").eq("token_hash",await sha(raw)).maybeSingle();if(!s||s.revoked_at||Date.parse(s.expires_at)<=Date.now())throw new Error("INSIGHT_SESSION_INVALID");const{data:a}=await db.from("insight_access_applications").select("id,note_id,status").eq("id",s.application_id).maybeSingle();if(!a||a.status!=="active")throw new Error("INSIGHT_MEMBER_INACTIVE");const noteId=String(a.note_id||"").toLowerCase();return{id:String(a.id),scope:noteId==="ss_yr"?"owner":String(a.id),noteId}}
const clean=(v:unknown)=>String(v||"").replace(/\s+/g," ").trim();
function personKey(r:any){
 const id=clean(r?.peer_note_id).replace(/^@/,"").toLowerCase();
 if(/^[a-z0-9_-]+$/.test(id))return "note:"+id;
 try{const u=new URL(String(r?.peer_url||""));const x=u.pathname.split("/").filter(Boolean)[0]||"";if(/^[a-z0-9_-]+$/.test(x))return "note:"+x.toLowerCase()}catch{}
 const name=clean(r?.peer_name).toLowerCase();return "name:"+(name||clean(r?.thread_key)||"unknown")
}
function personRow(rows:any[]){
 const sorted=[...rows].sort((a,b)=>new Date(b?.last_message_at||b?.last_synced_at||0).getTime()-new Date(a?.last_message_at||a?.last_synced_at||0).getTime());
 const best=sorted.find(r=>r?.peer_note_id||r?.peer_url||r?.peer_name)||sorted[0]||{};
 return{person_key:personKey(best),peer_note_id:best.peer_note_id||null,peer_name:best.peer_name||best.peer_note_id||"DM相手",peer_url:best.peer_url||null,peer_image_url:best.peer_image_url||null,last_message_at:best.last_message_at||best.last_synced_at||null,room_count:rows.length,thread_keys:rows.map(r=>r.thread_key).filter(Boolean)}
}
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:H});
 try{
  if(req.method!=="POST")return out({ok:false,error:"METHOD_NOT_ALLOWED"},405);
  const who=await auth(req),b=await req.json().catch(()=>({})),action=String(b.action||"summary");
  if(action==="summary"){
    const[threadResult,messageResult,runResult,statusResult]=await Promise.all([
      db.from("insight_dm_threads").select("id",{count:"exact",head:true}).eq("member_id",who.scope),
      db.from("insight_dm_messages").select("id",{count:"exact",head:true}).eq("member_id",who.scope),
      db.from("insight_dm_sync_runs").select("created_at,received_count,upserted_count,thread_count").eq("member_id",who.scope).order("created_at",{ascending:false}).limit(1).maybeSingle(),
      db.from("insight_dm_threads").select("thread_key,peer_name,meta->reader_status").eq("member_id",who.scope).limit(500)
    ]);
    for(const r of [threadResult,messageResult,runResult,statusResult])if(r.error)throw r.error;
    const readerStatus=(statusResult.data||[]).filter((r:any)=>r.reader_status).map((r:any)=>({threadKey:r.thread_key,peerName:r.peer_name,...r.reader_status})).sort((a:any,b:any)=>String(b.checked_at).localeCompare(String(a.checked_at)));
    return out({ok:true,noteId:who.noteId,threads:threadResult.count||0,messages:messageResult.count||0,lastSync:runResult.data||null,readerStatus})
  }
  if(action==="threads"){
    const page=Math.max(1,Number(b.page||1)),size=Math.min(100,Math.max(1,Number(b.pageSize||50))),from=(page-1)*size,to=from+size-1;
    let q=db.from("insight_dm_threads").select("*",{count:"exact"}).eq("member_id",who.scope).order("last_message_at",{ascending:false,nullsFirst:false}).range(from,to);
    const{data,error,count}=await q;if(error)throw error;return out({ok:true,noteId:who.noteId,rows:data||[],total:count||0,page,pageSize:size})
  }
  if(action==="people"){
    const{data,error}=await db.from("insight_dm_threads").select("*").eq("member_id",who.scope).order("last_message_at",{ascending:false,nullsFirst:false}).limit(5000);
    if(error)throw error;
    const groups=new Map<string,any[]>();for(const r of data||[]){const k=personKey(r),a=groups.get(k)||[];a.push(r);groups.set(k,a)}
    const rows=[...groups.values()].map(personRow).sort((a,b)=>new Date(b.last_message_at||0).getTime()-new Date(a.last_message_at||0).getTime());
    return out({ok:true,noteId:who.noteId,rows,total:rows.length})
  }
  if(action==="person_messages"){
    const key=String(b.personKey||"");if(!key)throw new Error("PERSON_REQUIRED");
    const{data:threads,error:te}=await db.from("insight_dm_threads").select("*").eq("member_id",who.scope).limit(5000);if(te)throw te;
    const mine=(threads||[]).filter(r=>personKey(r)===key),threadKeys=mine.map(r=>String(r.thread_key||"")).filter(Boolean);
    if(!threadKeys.length)return out({ok:true,noteId:who.noteId,person:null,rows:[],total:0});
    const page=Math.max(1,Number(b.page||1)),size=Math.min(500,Math.max(1,Number(b.pageSize||200))),from=(page-1)*size,to=from+size-1;
    const{data,error,count}=await db.from("insight_dm_messages").select("*",{count:"exact"}).eq("member_id",who.scope).in("thread_key",threadKeys).order("sent_at",{ascending:false,nullsFirst:false}).order("id",{ascending:false}).range(from,to);
    if(error)throw error;return out({ok:true,noteId:who.noteId,person:personRow(mine),rows:data||[],total:count||0,page,pageSize:size})
  }
  if(action==="messages"){
    const threadKey=String(b.threadKey||"");if(!threadKey)throw new Error("THREAD_REQUIRED");
    const page=Math.max(1,Number(b.page||1)),size=Math.min(200,Math.max(1,Number(b.pageSize||100))),from=(page-1)*size,to=from+size-1;
    const{data,error,count}=await db.from("insight_dm_messages").select("*",{count:"exact"}).eq("member_id",who.scope).eq("thread_key",threadKey).order("sent_at",{ascending:false,nullsFirst:false}).order("id",{ascending:false}).range(from,to);
    if(error)throw error;return out({ok:true,noteId:who.noteId,rows:data||[],total:count||0,page,pageSize:size})
  }
  return out({ok:false,error:"UNKNOWN_ACTION"},400)
 }catch(e){const m=e instanceof Error?e.message:String(e);return out({ok:false,error:m},/LOGIN|SESSION|INACTIVE/.test(m)?401:/REQUIRED/.test(m)?400:500)}
});
