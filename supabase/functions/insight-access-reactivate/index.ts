import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL=Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const sb=createClient(SUPABASE_URL,SERVICE_ROLE,{auth:{persistSession:false}});
const ORIGIN="https://mumei-s.github.io";
const SESSION_MS=1000*60*60*24*365*5;

function cors(req:Request){const origin=req.headers.get("origin")||"";return {"Access-Control-Allow-Origin":origin===ORIGIN?origin:ORIGIN,"Access-Control-Allow-Headers":"content-type,x-insight-applicant,x-owner-token","Access-Control-Allow-Methods":"POST,OPTIONS","Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer","Vary":"Origin"}}
function json(req:Request,data:unknown,status=200){return new Response(JSON.stringify(data),{status,headers:cors(req)})}
function clean(v:unknown,max=300){return typeof v==="string"?v.trim().slice(0,max):""}
async function sha256(s:string){const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("")}
function randomHex(bytes=32){const b=crypto.getRandomValues(new Uint8Array(bytes));return [...b].map(x=>x.toString(16).padStart(2,"0")).join("")}
function originAllowed(req:Request){const origin=req.headers.get("origin")||"";return !origin||origin===ORIGIN}
async function isOwner(token:string){if(!token)return false;const {data,error}=await sb.rpc("is_owner_token",{p_token:token});return !error&&data===true}
function safeApp(a:any){return {id:a.id,noteId:a.note_id,displayName:a.display_name,imageUrl:a.image_url,status:a.status,approvedAt:a.approved_at,verifiedAt:a.verified_at,createdAt:a.created_at,updatedAt:a.updated_at}}
async function appByApplicant(req:Request){const raw=req.headers.get("X-Insight-Applicant")||"";if(!raw)throw new Error("APPLICANT_TOKEN_REQUIRED");const {data,error}=await sb.from("insight_access_applications").select("*").eq("applicant_token_hash",await sha256(raw)).maybeSingle();if(error||!data)throw new Error("APPLICANT_TOKEN_INVALID");return data}
async function issueSession(applicationId:string){const raw=randomHex(36),now=Date.now();const {error}=await sb.from("insight_member_sessions").insert({application_id:applicationId,token_hash:await sha256(raw),expires_at:new Date(now+SESSION_MS).toISOString()});if(error)throw error;return raw}
async function activatePublic(a:any){const now=new Date().toISOString();const {data:existing}=await sb.from("insight_participants_public").select("member_id").eq("note_id",a.note_id).maybeSingle();const payload={note_id:a.note_id,display_name:a.display_name||`@${a.note_id}`,image_url:a.image_url||null,active:true,synced_at:now};if(existing?.member_id){const {error}=await sb.from("insight_participants_public").update(payload).eq("member_id",existing.member_id);if(error)throw error}else{const {error}=await sb.from("insight_participants_public").insert({member_id:String(a.id),role:"member",...payload});if(error)throw error}const {error:profileError}=await sb.from("insight_notification_profiles").upsert({member_id:String(a.id),note_urlname:a.note_id,note_nickname:a.display_name||a.note_id,role:"member",verified_at:a.verified_at||now,verification_code:null,public_watch_enabled:true,watch_error:null,updated_at:now},{onConflict:"member_id"});if(profileError)throw profileError}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors(req)});
  try{
    if(!originAllowed(req))return json(req,{ok:false,error:"ORIGIN_NOT_ALLOWED"},403);
    if(req.method!=="POST")return json(req,{ok:false,error:"METHOD_NOT_ALLOWED"},405);
    const body=await req.json().catch(()=>({})),action=clean(body?.action,80);

    if(action==="resume"){
      const a=await appByApplicant(req);
      if(a.status==="pending")return json(req,{ok:false,error:"WAITING_OWNER_APPROVAL",application:safeApp(a)},409);
      if(a.status!=="approved"&&a.status!=="active")return json(req,{ok:false,error:"REACTIVATION_NOT_ALLOWED",application:safeApp(a)},409);
      if(!a.verified_at)return json(req,{ok:false,error:"IDENTITY_REVERIFY_REQUIRED",application:safeApp(a)},409);
      const now=new Date().toISOString(),rotated=await sha256(randomHex(32));
      const {data:active,error}=await sb.from("insight_access_applications").update({status:"active",revoked_at:null,verification_code_plain:null,verification_code_hash:null,verification_attempts:0,applicant_token_hash:rotated,updated_at:now}).eq("id",a.id).select().single();
      if(error)throw error;
      await activatePublic(active);
      const memberToken=await issueSession(active.id);
      return json(req,{ok:true,reactivated:true,memberToken,application:safeApp(active),message:"RETURNING_MEMBER_REACTIVATED"});
    }

    if(action==="state"){
      const a=await appByApplicant(req);
      return json(req,{ok:true,application:safeApp(a),canResume:Boolean((a.status==="approved"||a.status==="active")&&a.verified_at)});
    }

    if(action==="owner-pending"){
      const token=req.headers.get("X-Owner-Token")||"";
      if(!(await isOwner(token)))throw new Error("OWNER_LOGIN_REQUIRED");
      const {data,error,count}=await sb.from("insight_access_applications").select("id,note_id,display_name,image_url,status,created_at,updated_at",{count:"exact"}).eq("status","pending").order("updated_at",{ascending:false}).limit(8);
      if(error)throw error;
      return json(req,{ok:true,count:Number(count||0),items:(data||[]).map((x:any)=>({id:x.id,noteId:x.note_id,displayName:x.display_name,imageUrl:x.image_url,status:x.status,createdAt:x.created_at,updatedAt:x.updated_at}))});
    }

    throw new Error("ACTION_NOT_SUPPORTED");
  }catch(e){const message=e instanceof Error?e.message:String(e);console.error(message);const status=/NOT_ALLOWED|WAITING|REVERIFY/.test(message)?409:/REQUIRED|INVALID|OWNER_LOGIN/.test(message)?401:/ORIGIN/.test(message)?403:/ACTION_NOT_SUPPORTED/.test(message)?400:500;return json(req,{ok:false,error:message},status)}
});
