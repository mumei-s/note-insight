import { createClient } from "npm:@supabase/supabase-js@2";

const U=Deno.env.get("SUPABASE_URL")!;
const K=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db=createClient(U,K,{auth:{persistSession:false}});
const NOTE="https://note.com";
const H={"Content-Type":"application/json; charset=utf-8","Access-Control-Allow-Origin":"https://mumei-s.github.io","Access-Control-Allow-Headers":"content-type,x-cron-secret","Access-Control-Allow-Methods":"POST,OPTIONS"};
const out=(x:unknown,s=200)=>new Response(JSON.stringify(x),{status:s,headers:H});
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
function noteId(url:string){try{const u=new URL(url);if(u.hostname!=="note.com"&&u.hostname!=="www.note.com")return"";return(u.pathname.split("/").filter(Boolean)[0]||"").toLowerCase()}catch{return""}}
async function creatorImage(id:string){const c=new AbortController(),t=setTimeout(()=>c.abort(),10000);try{const r=await fetch(`${NOTE}/api/v2/creators/${encodeURIComponent(id)}`,{headers:{Accept:"application/json","User-Agent":"Mumei-S-note-INSIGHT/3.3 (+avatar-refresh)"},signal:c.signal});if(!r.ok)return null;const p=await r.json().catch(()=>({})),d=p?.data||{};const image=d.profileImageUrl??d.profile_image_url??d.user_profile_image_url;return typeof image==="string"&&image?image:null}finally{clearTimeout(t)}}
const tables=["insight_relations","insight_relation_events","insight_public_likes","insight_public_comments","insight_favorite_creators"] as const;
async function missingUrls(){const urls=new Set<string>();for(const table of tables){const {data,error}=await db.from(table).select("actor_url").is("actor_image_url",null).not("actor_url","is",null).limit(250);if(error){console.error("avatar-select",table,error);continue}for(const x of data||[]){const url=String((x as any).actor_url||"");if(url&&noteId(url))urls.add(url);if(urls.size>=250)return[...urls]}}return[...urls]}
async function updateUrl(url:string,image:string){let rows=0;for(const table of tables){const {data,error}=await db.from(table).update({actor_image_url:image}).eq("actor_url",url).is("actor_image_url",null).select("actor_url");if(error){console.error("avatar-update",table,error);continue}rows+=(data||[]).length}return rows}
Deno.serve(async req=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:H});
  try{
    if(req.method!=="POST")return out({ok:false,error:"METHOD_NOT_ALLOWED"},405);
    const supplied=req.headers.get("X-Cron-Secret")||"",{data:secret}=await db.from("insight_notification_cron_secret").select("secret").eq("singleton",true).maybeSingle();
    if(!secret?.secret||supplied!==secret.secret)return out({ok:false,error:"CRON_SECRET_INVALID"},401);
    const urls=await missingUrls();let creators=0,rows=0;
    for(let i=0;i<urls.length;i+=8){const batch=urls.slice(i,i+8),done=await Promise.all(batch.map(async url=>{const id=noteId(url);if(!id)return{creators:0,rows:0};try{const image=await creatorImage(id);if(!image)return{creators:0,rows:0};return{creators:1,rows:await updateUrl(url,image)}}catch(e){console.error("avatar-refresh",id,e instanceof Error?e.message:e);return{creators:0,rows:0}}}));for(const x of done){creators+=x.creators;rows+=x.rows}await sleep(50)}
    return out({ok:true,candidates:urls.length,creators,rows});
  }catch(e){const msg=e instanceof Error?e.message:String(e);console.error(msg);return out({ok:false,error:msg},500)}
});