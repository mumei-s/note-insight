import { createClient } from "npm:@supabase/supabase-js@2";

const U=Deno.env.get("SUPABASE_URL")!;
const K=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db=createClient(U,K,{auth:{persistSession:false}});
const NOTE="https://note.com";
const H={"Content-Type":"application/json; charset=utf-8","Access-Control-Allow-Origin":"https://mumei-s.github.io","Access-Control-Allow-Headers":"content-type,x-cron-secret","Access-Control-Allow-Methods":"POST,OPTIONS"};
const out=(x:unknown,s=200)=>new Response(JSON.stringify(x),{status:s,headers:H});
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
function noteId(url:string){try{const u=new URL(url);if(u.hostname!=="note.com"&&u.hostname!=="www.note.com")return"";return(u.pathname.split("/").filter(Boolean)[0]||"").toLowerCase()}catch{return""}}
async function creatorImage(id:string){const c=new AbortController(),t=setTimeout(()=>c.abort(),10000);try{const r=await fetch(`${NOTE}/api/v2/creators/${encodeURIComponent(id)}`,{headers:{Accept:"application/json","User-Agent":"Mumei-S-note-INSIGHT/3.4 (+relation-avatar-refresh)"},signal:c.signal});if(!r.ok)return null;const p=await r.json().catch(()=>({})),d=p?.data||{};const image=d.profileImageUrl??d.profile_image_url??d.user_profile_image_url;return typeof image==="string"&&image?image:null}finally{clearTimeout(t)}}
async function missingRelationUrls(){const {data,error}=await db.from("insight_relations").select("actor_url").eq("active",true).is("actor_image_url",null).not("actor_url","is",null).limit(220);if(error)throw error;return[...new Set((data||[]).map((x:any)=>String(x.actor_url||"")).filter(url=>url&&noteId(url)))]}
async function fillRelation(url:string,image:string){const [{data:relations,error:re},{data:events,error:ee}]=await Promise.all([db.from("insight_relations").update({actor_image_url:image}).eq("actor_url",url).is("actor_image_url",null).select("person_key"),db.from("insight_relation_events").update({actor_image_url:image}).eq("actor_url",url).is("actor_image_url",null).select("person_key")]);if(re)throw re;if(ee)console.error("relation-event-avatar",ee);return(relations||[]).length+(events||[]).length}
Deno.serve(async req=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:H});
  try{
    if(req.method!=="POST")return out({ok:false,error:"METHOD_NOT_ALLOWED"},405);
    const supplied=req.headers.get("X-Cron-Secret")||"",{data:secret}=await db.from("insight_notification_cron_secret").select("secret").eq("singleton",true).maybeSingle();
    if(!secret?.secret||supplied!==secret.secret)return out({ok:false,error:"CRON_SECRET_INVALID"},401);
    const urls=await missingRelationUrls();let creators=0,rows=0;
    for(let i=0;i<urls.length;i+=8){const done=await Promise.all(urls.slice(i,i+8).map(async url=>{const id=noteId(url);if(!id)return{creators:0,rows:0};try{const image=await creatorImage(id);if(!image)return{creators:0,rows:0};return{creators:1,rows:await fillRelation(url,image)}}catch(e){console.error("relation-avatar-refresh",id,e instanceof Error?e.message:e);return{creators:0,rows:0}}}));for(const x of done){creators+=x.creators;rows+=x.rows}await sleep(50)}
    return out({ok:true,candidates:urls.length,creators,rows});
  }catch(e){const msg=e instanceof Error?e.message:String(e);console.error(msg);return out({ok:false,error:msg},500)}
});