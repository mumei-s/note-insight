import { createClient } from "npm:@supabase/supabase-js@2.112.4";

const db=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false}});
const H={"Access-Control-Allow-Origin":"https://note.com","Access-Control-Allow-Headers":"content-type,x-ingest-token,x-insight-reader","Access-Control-Allow-Methods":"POST,OPTIONS","Content-Type":"application/json; charset=utf-8","Vary":"Origin"};
const out=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:H});
const text=(v:unknown,max=300)=>typeof v==="string"?v.replace(/\u0000/g,"").trim().slice(0,max):null;
const bool=(v:unknown)=>typeof v==="boolean"?v:null;
const count=(v:unknown)=>Number.isFinite(Number(v))?Math.max(0,Math.min(10000000,Math.floor(Number(v)))):0;
function url(v:unknown){try{const u=new URL(String(v));return u.protocol==="https:"?u.href.slice(0,1600):null}catch{return null}}
async function hash(value:string){return [...new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value)))].map(x=>x.toString(16).padStart(2,"0")).join("")}
async function identity(req:Request){
  const kind=req.headers.get("X-Insight-Reader"),token=req.headers.get("X-Ingest-Token")||"";
  if(!token||!['notification','dm'].includes(kind||""))throw new Error("SOCIAL_TOKEN_REQUIRED");
  const table=kind==="dm"?"insight_dm_ingest_tokens":"insight_notification_ingest_tokens";
  const {data,error}=await db.from(table).select("member_id").eq("token_hash",await hash(token)).is("revoked_at",null).gt("expires_at",new Date().toISOString()).maybeSingle();
  if(error||!data?.member_id)throw new Error("SOCIAL_TOKEN_INVALID");
  const scope=String(data.member_id);if(scope==="owner")return{scope,noteId:"ss_yr"};
  const{data:app}=await db.from("insight_access_applications").select("note_id,status,verified_at").eq("id",scope).maybeSingle();
  if(!app?.verified_at||app.status!=="active")throw new Error("SOCIAL_MEMBER_INACTIVE");
  return{scope,noteId:String(app.note_id).toLowerCase()};
}
async function archivedCandidates(scope:string,after:string){
 const all=async(table:string,fields:string)=>{const rows:any[]=[];for(let from=0;;from+=1000){const r=await db.from(table).select(fields).eq("member_id",scope).order("person_key").range(from,from+999);if(r.error)throw r.error;rows.push(...(r.data||[]));if((r.data||[]).length<1000)break}return rows};
 const [people,verified]=await Promise.all([all("insight_relations","person_key,actor_name,actor_url,last_seen_at"),all("insight_social_comparisons","person_key,actor_name,actor_url,checked_at,is_following,is_follower")]);
 const seen=new Map(verified.map(r=>[r.person_key,typeof r.is_following==="boolean"&&typeof r.is_follower==="boolean"?Date.parse(r.checked_at):0])),cutoff=Date.now()-86400000,unique=new Map<string,any>();
 for(const r of [...people,...verified])if(r.person_key>after&&Number(seen.get(r.person_key)||0)<cutoff&&/^https:\/\/note\.com\/[A-Za-z0-9_-]+\/?$/.test(r.actor_url||""))unique.set(r.person_key,{person_key:r.person_key,actor_name:r.actor_name,actor_url:r.actor_url});
 const pending=[...unique.values()].sort((a,b)=>a.person_key<b.person_key?-1:a.person_key>b.person_key?1:0),rows=pending.slice(0,20);
 return{ok:true,rows,nextCursor:pending.length>20?rows.at(-1).person_key:null,remaining:pending.length};
}
async function acceptedRows(scope:string,input:any[]){
 const rows:any[]=[];
 for(const x of input){
  if(x.evidence!=="profile_flags"){if(x.is_following===true||x.is_follower===true)rows.push(x);continue}
  if(typeof x.is_following!=="boolean"||typeof x.is_follower!=="boolean")throw new Error("SOCIAL_PROFILE_FLAGS_UNVERIFIED");
  const [relations,comparison]=await Promise.all([db.from("insight_relations").select("actor_url").eq("member_id",scope).eq("person_key",x.person_key),db.from("insight_social_comparisons").select("actor_url").eq("member_id",scope).eq("person_key",x.person_key)]);
  if(relations.error||comparison.error)throw relations.error||comparison.error;
  if(![...(relations.data||[]),...(comparison.data||[])].some(r=>r.actor_url?.replace(/\/$/,"")===x.actor_url.replace(/\/$/,"")))throw new Error("SOCIAL_SAVED_PERSON_REQUIRED");
  rows.push(x);
 }
 return rows;
}
Deno.serve(async req=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:H});
  if(req.method!=="POST")return out({ok:false,error:"METHOD_NOT_ALLOWED"},405);
  try{
    const who=await identity(req),body=await req.json();
    if(String(body.noteId||"").toLowerCase()!==who.noteId)throw new Error("NOTE_ACCOUNT_MISMATCH");
    const observed=Date.parse(body.checkedAt||"");
    if(!Number.isFinite(observed)||Math.abs(observed-Date.now())>900000)throw new Error("SOCIAL_OBSERVATION_EXPIRED");
    const checkedAt=new Date(Math.min(observed,Date.now())).toISOString();
    if(body.action==="history_candidates")return out(await archivedCandidates(who.scope,text(body.after,200)||""));
    const normalized=(Array.isArray(body.rows)?body.rows:[]).slice(0,100).map((x:any)=>({
      evidence:text(x.evidence,30),person_key:text(x.person_key,200),actor_name:text(x.actor_name),actor_url:url(x.actor_url),actor_image_url:url(x.actor_image_url),
      is_following:bool(x.is_following),is_follower:bool(x.is_follower),
      following_rank:x.following_rank==null?null:count(x.following_rank),follower_rank:x.follower_rank==null?null:count(x.follower_rank)
    })).filter((x:any)=>x.person_key&&x.actor_url&&/^https:\/\/note\.com\/[A-Za-z0-9_-]+\/?$/.test(x.actor_url) );
    const rows=await acceptedRows(who.scope,normalized);
    let saved=0;
    if(rows.length){const{data,error}=await db.rpc("save_insight_social_comparison",{p_member:who.scope,p_rows:rows,p_checked:checkedAt});if(error)throw error;saved=Number(data||0)}
    if(body.status){const s=body.status,{error}=await db.from("insight_social_comparison_status").upsert({member_id:who.scope,checked_at:checkedAt,complete:s.complete===true,following_total:count(s.followingTotal),follower_total:count(s.followerTotal),following_checked:count(s.followingChecked),follower_checked:count(s.followerChecked),error:text(s.error,200)},{onConflict:"member_id"});if(error)throw error}
    return out({ok:true,confirmedPersonKeys:rows.map((x:any)=>x.person_key),saved});
  }catch(e){const message=e instanceof Error?e.message:String(e);return out({ok:false,error:message},/TOKEN|INACTIVE|MISMATCH/.test(message)?401:400)}
});
