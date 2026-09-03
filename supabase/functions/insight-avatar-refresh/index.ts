import { createClient } from "npm:@supabase/supabase-js@2";

const U=Deno.env.get("SUPABASE_URL")!;
const K=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db=createClient(U,K,{auth:{persistSession:false}});
const NOTE="https://note.com";
const H={"Content-Type":"application/json; charset=utf-8","Access-Control-Allow-Origin":"https://mumei-s.github.io","Access-Control-Allow-Headers":"content-type,x-cron-secret","Access-Control-Allow-Methods":"POST,OPTIONS"};
const out=(x:unknown,s=200)=>new Response(JSON.stringify(x),{status:s,headers:H});
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));

function noteId(url:string){try{const u=new URL(url);if(u.hostname!=="note.com"&&u.hostname!=="www.note.com")return"";return(u.pathname.split("/").filter(Boolean)[0]||"").toLowerCase()}catch{return""}}
async function creatorImage(id:string){const c=new AbortController(),t=setTimeout(()=>c.abort(),10000);try{const r=await fetch(`${NOTE}/api/v2/creators/${encodeURIComponent(id)}`,{headers:{Accept:"application/json","User-Agent":"Mumei-S-note-INSIGHT/3.2 (+avatar-refresh)"},signal:c.signal});if(!r.ok)return null;const p=await r.json().catch(()=>({})),d=p?.data||{};const image=d.profileImageUrl??d.profile_image_url;return typeof image==="string"&&image?image:null}finally{clearTimeout(t)}}

Deno.serve(async req=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:H});
  try{
    if(req.method!=="POST")return out({ok:false,error:"METHOD_NOT_ALLOWED"},405);
    const supplied=req.headers.get("X-Cron-Secret")||"",{data:secret}=await db.from("insight_notification_cron_secret").select("secret").eq("singleton",true).maybeSingle();
    if(!secret?.secret||supplied!==secret.secret)return out({ok:false,error:"CRON_SECRET_INVALID"},401);
    const {data,error}=await db.from("insight_public_likes").select("actor_url").eq("member_id","owner").is("actor_image_url",null).not("actor_url","is",null).order("liked_at",{ascending:false}).limit(150);
    if(error)throw error;
    const urls=[...new Set((data||[]).map((x:any)=>String(x.actor_url||"")).filter(Boolean))];
    let creators=0,rows=0;
    for(const url of urls){
      const id=noteId(url);if(!id)continue;
      try{const image=await creatorImage(id);if(!image)continue;const {data:updated,error:ue}=await db.from("insight_public_likes").update({actor_image_url:image}).eq("member_id","owner").eq("actor_url",url).is("actor_image_url",null).select("liker_key");if(ue)throw ue;creators++;rows+=(updated||[]).length}catch(e){console.error("avatar-refresh",id,e instanceof Error?e.message:e)}
      await sleep(70);
    }
    return out({ok:true,creators,rows});
  }catch(e){const msg=e instanceof Error?e.message:String(e);console.error(msg);return out({ok:false,error:msg},500)}
});
