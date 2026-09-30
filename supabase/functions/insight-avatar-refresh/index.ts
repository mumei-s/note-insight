import { checkedFetch, backgroundGate, rpcValue, batchUpsert, quotaError } from "../_shared/egress-20260930.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const U=Deno.env.get("SUPABASE_URL")!;
const K=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db=createClient(U,K,{auth:{persistSession:false},global:{fetch:checkedFetch}});
const NOTE="https://note.com";
const H={"Content-Type":"application/json; charset=utf-8","Access-Control-Allow-Origin":"https://mumei-s.github.io","Access-Control-Allow-Headers":"content-type,x-cron-secret","Access-Control-Allow-Methods":"POST,OPTIONS"};
const out=(x:unknown,s=200)=>new Response(JSON.stringify(x),{status:s,headers:H});
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
function noteId(url:string){try{const u=new URL(url);if(u.hostname!=="note.com"&&u.hostname!=="www.note.com")return"";return(u.pathname.split("/").filter(Boolean)[0]||"").toLowerCase()}catch{return""}}
async function creatorImage(id:string){const c=new AbortController(),t=setTimeout(()=>c.abort(),10000);try{const r=await fetch(`${NOTE}/api/v2/creators/${encodeURIComponent(id)}`,{headers:{Accept:"application/json","User-Agent":"Mumei-S-note-INSIGHT/3.4 (+relation-avatar-refresh)"},signal:c.signal});if(!r.ok)return null;const p=await r.json().catch(()=>({})),d=p?.data||{};const image=d.profileImageUrl??d.profile_image_url??d.user_profile_image_url;return typeof image==="string"&&image?image:null}finally{clearTimeout(t)}}
async function missingRelationUrls(){const data=await rpcValue(db,"insight_missing_avatar_urls",{p_limit:220});return(data||[]).map((x:any)=>String(x.actor_url||"")).filter((url:string)=>Boolean(noteId(url)))}
// Avatar propagation is performed by one database RPC per eight creators.
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:H});
 try{
  if(req.method!=="POST")return out({ok:false,error:"METHOD_NOT_ALLOWED"},405);
  if(await backgroundGate(db,req))return out({ok:true,paused:true,reason:"maintenance"});
  const urls=await missingRelationUrls(),deadline=Date.now()+70000;let creators=0,rows=0,processed=0,batches=0;
  for(let i=0;i<urls.length;i+=8){
   if(Date.now()>deadline)break;
   const found=await Promise.all(urls.slice(i,i+8).map(async(url:string)=>{try{return{url,image:await creatorImage(noteId(url))}}catch{return{url,image:null}}}));
   const result=await rpcValue(db,"insight_apply_avatar_batch",{p_rows:found});
   processed+=found.length;creators+=found.filter((x:any)=>x.image).length;rows+=Number(result.rows||0);batches++;await sleep(50);
  }
  return out({ok:true,candidates:urls.length,processed,creators,rows,batches,truncated:processed<urls.length});
 }catch(e){const msg=e instanceof Error?e.message:String(e);return out({ok:false,error:msg},quotaError(e)?402:/CRON_SECRET/.test(msg)?401:500)}
});
