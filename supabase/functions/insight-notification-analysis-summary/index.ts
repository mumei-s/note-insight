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
const clean=(v:any)=>String(v||"").replace(/\s+/g," ").trim();
const ts=(r:any)=>Date.parse(r.occurred_at||r.captured_at||0)||0;
const urlKey=(v:any)=>String(v||"").split(/[?#]/)[0].replace(/\/$/,"").toLowerCase();
const actorKey=(r:any)=>urlKey(r.actor_url)||clean(r.actor_name).toLowerCase();
const jstDay=(ms:number)=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(ms));
function targetOwner(url:any){try{return new URL(String(url||"")).pathname.split("/").filter(Boolean)[0]?.toLowerCase()||""}catch{return""}}
function displayType(r:any,noteId:string){const t=String(r.notification_type||"other");if(t==="membership_reaction")return targetOwner(r.target_url)===noteId?"membership_reaction_self":"membership_reaction_joined";if(t==="reply"&&String(r?.meta?.source||"")==="canonical-public-comments")return"reply_self";return t}
function useful(r:any){const t=String(r.notification_type||"other"),src=String(r?.meta?.source||""),raw=clean(r.raw_text);if(t==="capture_noise"||t==="other")return false;if(t==="comment"||t==="reply")return false;if(raw.length<3||raw.length>700)return false;if(src==="canonical-public-comments")return true;return true}
async function notificationPage(ids:string[],start:number){return db.from("insight_notifications").select("id,notification_type,raw_text,actor_name,actor_url,target_url,occurred_at,captured_at,meta",{count:start===0?"exact":undefined}).in("member_id",ids).order("captured_at",{ascending:false}).range(start,start+999)}
async function notificationRows(ids:string[]){
  const first=await notificationPage(ids,0);if(first.error)throw first.error;const rows=[...(first.data||[])],count=Number(first.count||rows.length),pages=Math.min(20,Math.max(1,Math.ceil(count/1000)));
  for(let p=1;p<pages;p+=4){const nums=Array.from({length:Math.min(4,pages-p)},(_,i)=>p+i),packs=await Promise.all(nums.map(x=>notificationPage(ids,x*1000)));for(const pack of packs){if(pack.error)throw pack.error;rows.push(...(pack.data||[]))}}
  return{rows:rows.filter(useful),count,truncated:pages*1000<count};
}
async function publicCommentPage(scope:string,start:number){return db.from("insight_public_comments").select("actor_name,actor_url,occurred_at,is_root",{count:start===0?"exact":undefined}).eq("member_id",scope).eq("is_creator",false).order("occurred_at",{ascending:false}).range(start,start+999)}
async function publicComments(scope:string){
  const first=await publicCommentPage(scope,0);if(first.error)throw first.error;const rows=[...(first.data||[])],count=Number(first.count||rows.length),pages=Math.min(12,Math.max(1,Math.ceil(count/1000)));
  for(let p=1;p<pages;p+=4){const nums=Array.from({length:Math.min(4,pages-p)},(_,i)=>p+i),packs=await Promise.all(nums.map(x=>publicCommentPage(scope,x*1000)));for(const pack of packs){if(pack.error)throw pack.error;rows.push(...(pack.data||[]))}}
  return{rows:rows.map((r:any)=>({notification_type:r.is_root?"comment":"reply",raw_text:r.is_root?"公開コメント":"公開返信",actor_name:r.actor_name,actor_url:r.actor_url,target_url:null,occurred_at:r.occurred_at,captured_at:r.occurred_at,meta:{source:"canonical-public-comments"}})),count,truncated:pages*1000<count};
}
function summarize(rows:any[],noteId:string,truncated:boolean,sourceTotal:number){
  const now=Date.now(),day=86400000,types=new Map<string,number>(),actors=new Map<string,{name:string;url:string;count:number;last:number}>(),hours=Array(24).fill(0),week=Array(7).fill(0),days=new Map<string,number>();
  let recent7=0,prev7=0,comments=0,membership=0,money=0,likes=0,follows=0,other=0;
  for(const r of rows){const t=displayType(r,noteId),at=ts(r);types.set(t,(types.get(t)||0)+1);if(t==="other")other++;if(at>=now-7*day)recent7++;else if(at>=now-14*day)prev7++;if(/comment|reply|membership_board_reply/.test(t))comments++;if(t.startsWith("membership_"))membership++;if(t==="purchase"||t==="tip")money++;if(t==="like"||t==="comment_like"||t.startsWith("membership_reaction"))likes++;if(t==="follow")follows++;
    const k=actorKey(r);if(k){const p=actors.get(k),name=clean(r.actor_name)||"noteユーザー",url=String(r.actor_url||"");if(p){p.count++;p.last=Math.max(p.last,at)}else actors.set(k,{name,url,count:1,last:at})}
    if(at){const dk=jstDay(at);days.set(dk,(days.get(dk)||0)+1);const parts=new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Tokyo",hour:"2-digit",hour12:false,weekday:"short"}).formatToParts(new Date(at)),h=Number(parts.find(x=>x.type==="hour")?.value||0),wd=parts.find(x=>x.type==="weekday")?.value||"Sun",wi=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].indexOf(wd);if(h>=0&&h<24)hours[h]++;if(wi>=0)week[wi]++}}
  const sample=rows.length,topTypes=[...types.entries()].sort((a,b)=>b[1]-a[1]).slice(0,10),topActors=[...actors.values()].sort((a,b)=>b.count-a.count||b.last-a.last).slice(0,12),peakHour=hours.indexOf(Math.max(...hours)),peakWeek=week.indexOf(Math.max(...week)),weekName=["日","月","火","水","木","金","土"][Math.max(0,peakWeek)],topActorShare=sample&&topActors[0]?topActors[0].count/sample*100:0,last14=Array.from({length:14},(_,i)=>{const ms=now-(13-i)*day,k=jstDay(ms);return{k,label:k.slice(5).replace("-","/"),v:days.get(k)||0}}),timeBands=[{k:"深夜 0–5",v:hours.slice(0,6).reduce((a,b)=>a+b,0)},{k:"朝 6–11",v:hours.slice(6,12).reduce((a,b)=>a+b,0)},{k:"昼 12–17",v:hours.slice(12,18).reduce((a,b)=>a+b,0)},{k:"夜 18–23",v:hours.slice(18,24).reduce((a,b)=>a+b,0)}],classifiedRate=sample?Math.max(0,100-other/sample*100):100;
  return{sample,total:sample,sourceTotal,truncated,recent7,prev7,comments,membership,money,likes,follows,people:actors.size,topTypes,topActors,peakHour,weekName,topActorShare,last14,timeBands,coverage:truncated?Math.min(99.9,sample/Math.max(1,sourceTotal)*100):100,classifiedRate,other};
}
Deno.serve(async req=>{if(req.method==="OPTIONS")return new Response("ok",{headers:H});try{if(req.method!=="POST")return out({ok:false,error:"METHOD_NOT_ALLOWED"},405);const m=await auth(req),ids=m.scope===m.id?[m.id]:[m.scope,m.id],[n,c]=await Promise.all([notificationRows(ids),publicComments(m.scope)]),rows=[...n.rows,...c.rows],summary=summarize(rows,m.noteId,n.truncated||c.truncated,n.count+c.count);return out({ok:true,noteId:m.noteId,...summary})}catch(e){const msg=e instanceof Error?e.message:String(e);console.error(msg);return out({ok:false,error:msg},/LOGIN|SESSION|INACTIVE/.test(msg)?401:500)}});
