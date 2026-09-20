import { createClient } from "npm:@supabase/supabase-js@2.112.4";
const U=Deno.env.get("SUPABASE_URL")!,K=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db=createClient(U,K,{auth:{persistSession:false}}),ORIGIN="https://mumei-s.github.io";
const H={"Access-Control-Allow-Origin":ORIGIN,"Access-Control-Allow-Headers":"content-type,x-insight-token","Access-Control-Allow-Methods":"POST,OPTIONS","Content-Type":"application/json; charset=utf-8","Vary":"Origin"};
const out=(x:unknown,s=200)=>new Response(JSON.stringify(x),{status:s,headers:H});
async function sha(v:string){const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(v));return[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("")}
async function auth(req:Request){const raw=req.headers.get("X-Insight-Token")||"";if(!raw)throw new Error("INSIGHT_LOGIN_REQUIRED");const{data:s}=await db.from("insight_member_sessions").select("application_id,expires_at,revoked_at").eq("token_hash",await sha(raw)).maybeSingle();if(!s||s.revoked_at||Date.parse(s.expires_at)<=Date.now())throw new Error("INSIGHT_SESSION_INVALID");const{data:a}=await db.from("insight_access_applications").select("id,note_id,status").eq("id",s.application_id).maybeSingle();if(!a||a.status!=="active")throw new Error("INSIGHT_MEMBER_INACTIVE");const noteId=String(a.note_id||"").toLowerCase();return{id:String(a.id),scope:noteId==="ss_yr"?"owner":String(a.id),noteId}}
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:H});
 try{
  if(req.method!=="POST")return out({ok:false,error:"METHOD_NOT_ALLOWED"},405);
  const who=await auth(req),b=await req.json().catch(()=>({})),action=String(b.action||"summary");
  if(action==="summary"){
    const[{count:threads},{count:messages},{data:last}]=await Promise.all([
      db.from("insight_dm_threads").select("id",{count:"exact",head:true}).eq("member_id",who.scope),
      db.from("insight_dm_messages").select("id",{count:"exact",head:true}).eq("member_id",who.scope),
      db.from("insight_dm_sync_runs").select("created_at,received_count,upserted_count,thread_count").eq("member_id",who.scope).order("created_at",{ascending:false}).limit(1).maybeSingle()
    ]);
    return out({ok:true,noteId:who.noteId,threads:threads||0,messages:messages||0,lastSync:last||null})
  }
  if(action==="threads"){
    const page=Math.max(1,Number(b.page||1)),size=Math.min(100,Math.max(1,Number(b.pageSize||50))),from=(page-1)*size,to=from+size-1;
    let q=db.from("insight_dm_threads").select("*",{count:"exact"}).eq("member_id",who.scope).order("last_message_at",{ascending:false,nullsFirst:false}).range(from,to);
    const{data,error,count}=await q;if(error)throw error;return out({ok:true,noteId:who.noteId,rows:data||[],total:count||0,page,pageSize:size})
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