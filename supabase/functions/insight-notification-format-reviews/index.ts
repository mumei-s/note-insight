import { createClient } from "npm:@supabase/supabase-js@2.112.4";

const db=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false}});
const H={"Access-Control-Allow-Origin":"https://mumei-s.github.io","Access-Control-Allow-Headers":"content-type,x-insight-token,x-owner-token","Access-Control-Allow-Methods":"POST,OPTIONS","Content-Type":"application/json; charset=utf-8","Vary":"Origin"};
const out=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:H});
async function hash(value:string){return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value))),x=>x.toString(16).padStart(2,"0")).join("")}

async function requireOwner(req:Request){
  const ownerToken=req.headers.get("X-Owner-Token"),memberToken=req.headers.get("X-Insight-Token");
  if(ownerToken){
    const {data,error}=await db.from("unified_owner_sessions").select("note_urlname,expires_at,revoked_at").eq("token_hash",await hash(ownerToken)).maybeSingle();
    if(!error&&data&&!data.revoked_at&&Date.parse(data.expires_at)>Date.now()&&data.note_urlname==="ss_yr")return;
  }else if(memberToken){
    const {data:s,error}=await db.from("insight_member_sessions").select("application_id,expires_at,revoked_at").eq("token_hash",await hash(memberToken)).maybeSingle();
    if(!error&&s&&!s.revoked_at&&Date.parse(s.expires_at)>Date.now()){
      const {data:a,error:e}=await db.from("insight_access_applications").select("note_id,status,verified_at").eq("id",s.application_id).maybeSingle();
      if(!e&&a?.note_id==="ss_yr"&&a.status==="active"&&a.verified_at)return;
    }
  }
  throw new Error("OWNER_AUTH_REQUIRED");
}

Deno.serve(async req=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:H});
  if(req.method!=="POST")return out({ok:false,error:"METHOD_NOT_ALLOWED"},405);
  try{
    await requireOwner(req);
    const body=await req.json().catch(()=>({})),action=body.action||"list";
    if(action==="read"||action==="unread"){
      const kind=String(body.kind||"");
      if(!/^[a-zA-Z0-9_:-]{1,120}$/.test(kind))return out({ok:false,error:"INVALID_FORMAT"},400);
      const {error}=await db.from("insight_notification_format_reads").upsert({kind,read_at:action==="read"?new Date().toISOString():null},{onConflict:"kind"});
      if(error)throw error;
    }else if(action!=="list")return out({ok:false,error:"INVALID_ACTION"},400);
    // Return format names and counts only, never other participants' notification bodies.
    const {data,error}=await db.rpc("insight_notification_format_summary");
    if(error)throw error;
    return out({ok:true,alerts:data||[],unread:(data||[]).filter((r:any)=>!r.read_at).length});
  }catch(e){const message=e instanceof Error?e.message:String(e);return out({ok:false,error:message},message==="OWNER_AUTH_REQUIRED"?403:500)}
});
