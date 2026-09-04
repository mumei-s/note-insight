import { createClient } from "npm:@supabase/supabase-js@2.112.4";
const U=Deno.env.get("SUPABASE_URL")!;
const K=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db=createClient(U,K,{auth:{persistSession:false}});
const ORIGIN="https://mumei-s.github.io";
const H={"Access-Control-Allow-Origin":ORIGIN,"Access-Control-Allow-Headers":"content-type,x-insight-token","Access-Control-Allow-Methods":"POST,OPTIONS","Content-Type":"application/json; charset=utf-8","Vary":"Origin"};
const out=(x:unknown,s=200)=>new Response(JSON.stringify(x),{status:s,headers:H});
async function sha(v:string){const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(v));return[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("")}
async function auth(req:Request){const raw=req.headers.get("X-Insight-Token")||"";if(!raw)throw new Error("INSIGHT_LOGIN_REQUIRED");const{data:s}=await db.from("insight_member_sessions").select("application_id,expires_at,revoked_at").eq("token_hash",await sha(raw)).maybeSingle();if(!s||s.revoked_at||Date.parse(s.expires_at)<=Date.now())throw new Error("INSIGHT_SESSION_INVALID");const{data:a}=await db.from("insight_access_applications").select("status").eq("id",s.application_id).maybeSingle();if(!a||a.status!=="active")throw new Error("INSIGHT_MEMBER_INACTIVE")}
const txt=(v:any)=>typeof v==="string"?v:"";
function esc(v:string){return v.replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;/g,"'")}
function fromJson(x:any){const d=x?.data?.note??x?.data??x?.note??x??{};return txt(d.eyecatch_url||d.eyecatchUrl||d.eyecatch||d.image_url||d.imageUrl||d.thumbnail_url||d.thumbnailUrl)}
async function one(item:any){const key=txt(item?.key).trim(),url=txt(item?.url).trim();let thumbnail="";if(key){try{const r=await fetch(`https://note.com/api/v3/notes/${encodeURIComponent(key)}`,{headers:{Accept:"application/json","User-Agent":"Mumei-S-note-INSIGHT/1.0"}});if(r.ok)thumbnail=fromJson(await r.json())}catch{}}
 if(!thumbnail&&/^https:\/\/note\.com\//.test(url)){try{const r=await fetch(url,{headers:{Accept:"text/html","User-Agent":"Mumei-S-note-INSIGHT/1.0"}});if(r.ok){const h=await r.text();const m=h.match(/<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]+content=["']([^"']+)["']/i)||h.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:image|twitter:image)["']/i);if(m)thumbnail=esc(m[1])}}catch{}}
 return{key:key||url,url,thumbnail:thumbnail||null}}
Deno.serve(async req=>{if(req.method==="OPTIONS")return new Response("ok",{headers:H});try{if(req.method!=="POST")return out({ok:false,error:"METHOD_NOT_ALLOWED"},405);await auth(req);const b=await req.json().catch(()=>({})),items=Array.isArray(b.articles)?b.articles.slice(0,40):[];const rows:any[]=[];for(let i=0;i<items.length;i+=8){rows.push(...await Promise.all(items.slice(i,i+8).map(one)))}return out({ok:true,rows})}catch(e){const msg=e instanceof Error?e.message:String(e);return out({ok:false,error:msg},/LOGIN|SESSION|INACTIVE/.test(msg)?401:500)}});
