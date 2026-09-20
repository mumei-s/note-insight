import { createClient } from "npm:@supabase/supabase-js@2.112.4";
const U=Deno.env.get("SUPABASE_URL")!,K=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db=createClient(U,K,{auth:{persistSession:false}});
const H={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"content-type,x-owner-token,x-insight-token","Access-Control-Allow-Methods":"POST,OPTIONS","Content-Type":"application/json; charset=utf-8"};
const out=(x:unknown,s=200)=>new Response(JSON.stringify(x),{status:s,headers:H});
async function sha(v:string){const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(v));return[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("")}
const ownerIdentity=()=>({id:"owner",noteId:"ss_yr",name:"無名S note",role:"owner",authorized:true,verifiedAt:new Date().toISOString()});
async function owner(req:Request){const raw=req.headers.get("X-Owner-Token")||"";if(!raw)return false;const{data}=await db.from("unified_owner_sessions").select("id").eq("token_hash",await sha(raw)).is("revoked_at",null).gt("expires_at",new Date().toISOString()).maybeSingle();return!!data?.id}
async function participant(req:Request){
 const raw=req.headers.get("X-Insight-Token")||"";if(!raw)return null;const now=new Date().toISOString();
 const{data:s}=await db.from("insight_member_sessions").select("application_id").eq("token_hash",await sha(raw)).is("revoked_at",null).gt("expires_at",now).maybeSingle();
 if(!s?.application_id)return null;
 const{data:app}=await db.from("insight_access_applications").select("id,note_id,display_name,status,verified_at").eq("id",s.application_id).maybeSingle();
 if(!app?.id||app.status!=="active")return null;
 return{id:String(app.id),noteId:String(app.note_id||"").toLowerCase(),name:app.display_name||app.note_id,role:"member",authorized:true,verifiedAt:app.verified_at||null}
}
async function identity(req:Request){
 const p=await participant(req);if(p?.noteId==="ss_yr"&&p.verifiedAt)return ownerIdentity();if(p)return p;if(await owner(req))return ownerIdentity();throw new Error("DM_LOGIN_REQUIRED")
}
async function identityByMemberId(memberId:string){
 if(memberId==="owner")return ownerIdentity();
 const{data:app}=await db.from("insight_access_applications").select("id,note_id,display_name,status,verified_at").eq("id",memberId).maybeSingle();
 if(app?.id&&app.status==="active"){const noteId=String(app.note_id||"").toLowerCase();if(noteId==="ss_yr"&&app.verified_at)return ownerIdentity();return{id:String(app.id),noteId,name:app.display_name||app.note_id,role:"member",authorized:true,verifiedAt:app.verified_at||null}}
 const{data:p}=await db.from("insight_notification_profiles").select("note_urlname,note_nickname,verified_at,role").eq("member_id",memberId).maybeSingle();
 if(p?.note_urlname){const noteId=String(p.note_urlname).toLowerCase();if(noteId==="ss_yr"&&p.verified_at)return ownerIdentity();return{id:memberId,noteId,name:p.note_nickname||p.note_urlname,role:p.role||"member",authorized:Boolean(p.verified_at),verifiedAt:p.verified_at||null}}
 throw new Error("DM_ACCOUNT_UNKNOWN")
}
function token(){return crypto.randomUUID().replaceAll("-","")+crypto.randomUUID().replaceAll("-","")}
function pairCode(){const n=crypto.getRandomValues(new Uint32Array(1))[0]%100000000;return String(n).padStart(8,"0")}
async function issue(memberId:string,noteId:string){
 const raw=token(),now=new Date(),exp=new Date(now.getTime()+3650*24*60*60*1000).toISOString();
 await db.from("insight_dm_ingest_tokens").update({revoked_at:now.toISOString()}).eq("member_id",memberId).is("revoked_at",null);
 const{error}=await db.from("insight_dm_ingest_tokens").insert({member_id:memberId,token_hash:await sha(raw),purpose:"note_dm_auto_sync",expires_at:exp});if(error)throw error;
 return{dmIngestToken:raw,expiresAt:exp,memberId,noteId}
}
async function paired(memberId:string){const now=new Date().toISOString();const{data,error}=await db.from("insight_dm_ingest_tokens").select("expires_at,created_at").eq("member_id",memberId).is("revoked_at",null).gt("expires_at",now).order("created_at",{ascending:false}).limit(1).maybeSingle();if(error)throw error;return{paired:Boolean(data?.expires_at),pairedExpiresAt:data?.expires_at||null}}
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:H});
 if(req.method!=="POST")return out({ok:false,error:"METHOD_NOT_ALLOWED"},405);
 try{
  const b=await req.json().catch(()=>({})),action=String(b?.action||"stats");
  if(action==="pair-exchange"){
   const code=String(b?.code||"").replace(/\D/g,"").slice(0,8);if(code.length!==8)return out({ok:false,error:"DM_PAIR_CODE_INVALID"},400);
   const now=new Date().toISOString(),hash=await sha(code);
   const{data,error}=await db.from("insight_dm_pair_codes").select("id,member_id,expires_at,used_at").eq("code_hash",hash).is("used_at",null).gt("expires_at",now).maybeSingle();
   if(error)throw error;if(!data?.id)return out({ok:false,error:"DM_PAIR_CODE_EXPIRED"},401);
   const who=await identityByMemberId(String(data.member_id));if(!who.authorized)return out({ok:false,error:"DM_PROFILE_VERIFICATION_REQUIRED"},401);
   const issued=await issue(who.id,who.noteId);await db.from("insight_dm_pair_codes").update({used_at:now}).eq("id",data.id);
   return out({ok:true,...issued,paired:true})
  }
  const who=await identity(req);
  if(action==="pair-start"){
   const code=pairCode(),now=new Date(),exp=new Date(now.getTime()+10*60*1000).toISOString();
   await db.from("insight_dm_pair_codes").delete().eq("member_id",who.id).is("used_at",null);
   const{error}=await db.from("insight_dm_pair_codes").insert({member_id:who.id,code_hash:await sha(code),expires_at:exp});if(error)throw error;
   const account=encodeURIComponent(who.noteId||""),state=await paired(who.id);
   return out({ok:true,memberId:who.id,noteId:who.noteId,pairingCode:code,expiresAt:exp,noteUrl:`https://note.com/messages/rooms?mumei_dm_pair=${code}&mumei_account=${account}`,...state})
  }
  if(action==="stats"){
   const[{count:messages},{count:threads},state]=await Promise.all([
    db.from("insight_dm_messages").select("id",{count:"exact",head:true}).eq("member_id",who.id),
    db.from("insight_dm_threads").select("id",{count:"exact",head:true}).eq("member_id",who.id),
    paired(who.id)
   ]);
   return out({ok:true,memberId:who.id,noteId:who.noteId,messages:messages||0,threads:threads||0,...state})
  }
  if(action==="issue")return out({ok:true,...await issue(who.id,who.noteId),paired:true});
  return out({ok:false,error:"UNKNOWN_ACTION"},400)
 }catch(e){const m=e instanceof Error?e.message:String(e);console.error(m);return out({ok:false,error:m},/REQUIRED|INVALID|UNKNOWN|LOGIN|EXPIRED/.test(m)?401:500)}
});