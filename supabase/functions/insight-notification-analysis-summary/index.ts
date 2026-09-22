import { createClient } from "npm:@supabase/supabase-js@2.112.4";

const U=Deno.env.get("SUPABASE_URL")!,K=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db=createClient(U,K,{auth:{persistSession:false}}),ORIGIN="https://mumei-s.github.io";
const H={"Access-Control-Allow-Origin":ORIGIN,"Access-Control-Allow-Headers":"content-type,x-insight-token","Access-Control-Allow-Methods":"POST,OPTIONS","Content-Type":"application/json; charset=utf-8","Vary":"Origin"};
const out=(x:unknown,s=200)=>new Response(JSON.stringify(x),{status:s,headers:H});

async function sha(v:string){const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(v));return[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("")}
async function auth(req:Request){
  const raw=req.headers.get("X-Insight-Token")||"";if(!raw)throw new Error("INSIGHT_LOGIN_REQUIRED");
  const{data:s}=await db.from("insight_member_sessions").select("id,application_id,expires_at,revoked_at").eq("token_hash",await sha(raw)).maybeSingle();
  if(!s||s.revoked_at||Date.parse(s.expires_at)<=Date.now())throw new Error("INSIGHT_SESSION_INVALID");
  const{data:a}=await db.from("insight_access_applications").select("id,note_id,status").eq("id",s.application_id).maybeSingle();
  if(!a||a.status!=="active")throw new Error("INSIGHT_MEMBER_INACTIVE");
  const noteId=String(a.note_id||"").toLowerCase();return{id:String(a.id),scope:noteId==="ss_yr"?"owner":String(a.id),noteId};
}
Deno.serve(async req=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:H});
  try{
    if(req.method!=="POST")return out({ok:false,error:"METHOD_NOT_ALLOWED"},405);
    const m=await auth(req),b=await req.json().catch(()=>({}));
    const period=[7,30,90].includes(Number(b.period))?Number(b.period):0;
    const {data,error}=await db.rpc("insight_notification_analysis_summary",{
      p_member_ids:m.scope===m.id?[m.id]:[m.scope,m.id],p_note_id:m.noteId,p_period:period,
    });
    if(error)throw new Error("本人通知の集計を取得できませんでした。再読込してください。");
    return out({ok:true,noteId:m.noteId,...data});
  }catch(e){const msg=e instanceof Error?e.message:String(e);return out({ok:false,error:msg},/LOGIN|SESSION|INACTIVE/.test(msg)?401:500)}
});
