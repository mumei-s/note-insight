import { createClient } from "npm:@supabase/supabase-js@2.112.4";
const U=Deno.env.get("SUPABASE_URL")!,K=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,NOTE="https://note.com";
const db=createClient(U,K,{auth:{persistSession:false}}),ORIGIN="https://mumei-s.github.io",H={"Access-Control-Allow-Origin":ORIGIN,"Access-Control-Allow-Headers":"content-type,x-insight-token","Access-Control-Allow-Methods":"POST,OPTIONS","Content-Type":"application/json; charset=utf-8","Vary":"Origin"},out=(x:unknown,s=200)=>new Response(JSON.stringify(x),{status:s,headers:H});
async function sha(v:string){const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(v));return[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("")}
async function auth(req:Request){const raw=req.headers.get("X-Insight-Token")||"";if(!raw)throw new Error("INSIGHT_LOGIN_REQUIRED");const{data:s}=await db.from("insight_member_sessions").select("application_id,expires_at,revoked_at").eq("token_hash",await sha(raw)).maybeSingle();if(!s||s.revoked_at||Date.parse(s.expires_at)<=Date.now())throw new Error("INSIGHT_SESSION_INVALID");const{data:a}=await db.from("insight_access_applications").select("id,note_id,status").eq("id",s.application_id).maybeSingle();if(!a||a.status!=="active")throw new Error("INSIGHT_MEMBER_INACTIVE");const noteId=String(a.note_id||"").toLowerCase();return{id:String(a.id),scope:noteId==="ss_yr"?"owner":String(a.id),noteId}}
function valid(v:any){if(!v)return null;const d=new Date(String(v));return Number.isNaN(d.getTime())?null:d.toISOString()}
const num=(v:any)=>Number.isFinite(Number(v))?Number(v):0;
async function liveCounts(noteId:string){const c=new AbortController(),timer=setTimeout(()=>c.abort(),12000);try{const r=await fetch(`${NOTE}/api/v2/creators/${encodeURIComponent(noteId)}`,{headers:{Accept:"application/json","User-Agent":"Mumei-S-note-INSIGHT/6.0 (+live-social-counts)"},cache:"no-store",signal:c.signal});if(!r.ok)throw new Error(`NOTE_${r.status}`);const j:any=await r.json(),d=j?.data??j??{};return{followers:num(d.followerCount??d.follower_count),followings:num(d.followingCount??d.following_count),at:new Date().toISOString()}}catch{return null}finally{clearTimeout(timer)}}
async function latestRuns(scope:string,noteId:string){const{data,error}=await db.from("insight_relation_sync_runs").select("direction,expected_count,received_count,complete,baseline,error,created_at,added_count,removed_count").eq("member_id",scope).order("created_at",{ascending:false}).limit(20);if(error)throw error;const latest:any={followers:null,followings:null};for(const r of data||[]){const d=String(r.direction||"");if((d==="followers"||d==="followings")&&!latest[d])latest[d]=r}const live=await liveCounts(noteId);if(live){for(const d of ["followers","followings"] as const){const count=live[d];latest[d]={...(latest[d]||{direction:d,received_count:0,complete:false,baseline:true,error:"RELATION_SCAN_PENDING",created_at:null,added_count:0,removed_count:0}),live_expected_count:count,live_count_at:live.at}}}return latest}
const PERSON_FIELDS="person_key,actor_name,actor_url,actor_image_url,active,last_seen_at,first_seen_at,last_changed_at,source_rank,direction";
function searchText(v:any){return String(v||"").normalize("NFKC").replace(/[^\p{L}\p{N}_@ -]/gu,"").replace(/^@/,"").slice(0,100)}
function evidence(row:any,run:any){const unknown=String(row.person_key||"").startsWith("unknown:");return{...row,evidence:unknown?"count_only":run?.complete===true?"complete_snapshot":"window_candidate",identity_exact:!unknown&&run?.complete===true,comparison_at:run?.created_at||null,comparison_complete:run?.complete===true}}
async function annotate(scope:string,rows:any[]){const ids=[...new Set(rows.map(r=>r.run_id).filter(Boolean))];if(!ids.length)return rows.map(r=>evidence(r,null));const{data,error}=await db.from("insight_relation_sync_runs").select("id,complete,created_at").eq("member_id",scope).in("id",ids);if(error)throw error;const runs=new Map((data||[]).map(r=>[String(r.id),r]));return rows.map(r=>evidence(r,runs.get(String(r.run_id))))}
async function investigate(scope:string,key:string){
 if(!key||key.length>400||key.startsWith("unknown:"))throw new Error("PERSON_REQUIRED");
 const [relations,events]=await Promise.all([
  db.from("insight_relations").select(PERSON_FIELDS).eq("member_id",scope).eq("person_key",key),
  db.from("insight_relation_events").select("id,run_id,direction,event_type,person_key,actor_name,actor_url,actor_image_url,detected_at,change_count").eq("member_id",scope).eq("person_key",key).order("detected_at",{ascending:false}).order("id",{ascending:false}).limit(100)
 ]);if(relations.error)throw relations.error;if(events.error)throw events.error;
 return{ok:true,personKey:key,relations:relations.data||[],events:await annotate(scope,events.data||[]),basis:"saved_comparisons",note:"全件照合の前後で確認できた関係の変化です。解除・退会・ブロックなどの原因は断定しません。"};
}
async function windowPeople(scope:string,direction:string,window:string){
 let q=db.from("insight_relations").select(PERSON_FIELDS).eq("member_id",scope).eq("direction",direction);
 q=q.eq("active",true);
 q=q.order("source_rank",{ascending:window!=="oldest"}).order("person_key");
 const{data,error}=await q.limit(1000);if(error)throw error;return data||[];
}
const EVENT_FIELDS="id,run_id,direction,event_type,person_key,actor_name,actor_url,actor_image_url,detected_at,change_count";
async function windowEvents(scope:string,b:any,keys:string[]|null,offset:number,size:number){
 const direction=String(b.direction||"all"),change=b.action==="investigation"?"removed":String(b.change||"all"),from=valid(b.dateFrom),to=valid(b.dateTo),term=searchText(b.query);
 const chunks:(string[]|null)[]=keys===null?[null]:Array.from({length:Math.ceil(keys.length/80)},(_,i)=>keys.slice(i*80,(i+1)*80));
 let total=0;const rows:any[]=[];
 for(let i=0;i<chunks.length;i+=3){
  const results=await Promise.all(chunks.slice(i,i+3).map(async chunk=>{
   let q=db.from("insight_relation_events").select(EVENT_FIELDS,{count:"exact"}).eq("member_id",scope).not("person_key","like","aggregate:%");
   if(chunk)q=q.in("person_key",chunk);
   if(b.action==="investigation")q=q.not("person_key","like","unknown:%");
   if(direction==="followers"||direction==="followings")q=q.eq("direction",direction);
   if(change==="added"||change==="removed")q=q.eq("event_type",change);
   if(term)q=q.or(`actor_name.ilike.%${term}%,actor_url.ilike.%${term}%`);
   if(from)q=q.gte("detected_at",from);if(to)q=q.lt("detected_at",to);
   q=q.order("detected_at",{ascending:false}).order("id",{ascending:false});
   if(chunk===null)return await q.range(offset,offset+size-1);
   const result=await q.range(0,Math.min(999,offset+size-1));if(result.error)return result;
   const data=[...(result.data||[])],needed=Math.min(result.count||0,offset+size);
   for(let start=data.length;start<needed;start+=1000){const next=await q.range(start,Math.min(start+999,needed-1));if(next.error)return next;if(!next.data?.length)break;data.push(...next.data)}
   return{...result,data};
  }));
  for(const r of results){if(r.error)throw r.error;total+=r.count||0;rows.push(...(r.data||[]))}
 }
 rows.sort((a,b)=>String(b.detected_at).localeCompare(String(a.detected_at))||Number(b.id)-Number(a.id));
 return{total,rows:await annotate(scope,keys===null?rows:rows.slice(offset,offset+size))};
}
function comparisonRows(relations:any[],verified:any[],latest:any){
 const following=new Map(relations.filter(x=>x.direction==="followings").map(x=>[x.person_key,x]));
 const followers=new Map(relations.filter(x=>x.direction==="followers").map(x=>[x.person_key,x]));
 const exact=new Map(verified.map(x=>[x.person_key,x]));
 const keys=new Set([...following.keys(),...followers.keys(),...exact.keys()]);
 return [...keys].map(key=>{
  const a=following.get(key),b=followers.get(key),v=exact.get(key),person=v||a||b;
  const value=(direction:string,row:any,field:string)=>{
   const run=latest[direction],newer=run?.complete&&Date.parse(run.created_at)>Date.parse(v?.checked_at||'1970-01-01');
   if(newer)return Boolean(row);
   if(row&&Date.parse(row.last_seen_at)>Date.parse(v?.checked_at||'1970-01-01'))return true;
   if(typeof v?.[field]==="boolean")return v[field];
   return row?true:run?.complete?false:null;
  };
  const isFollowing=value('followings',a,'is_following'),isFollower=value('followers',b,'is_follower');
  const relation=isFollowing===true&&isFollower===true?'mutual':isFollowing===true&&isFollower===false?'following_only':isFollowing===false&&isFollower===true?'follower_only':isFollowing===false&&isFollower===false?'none':'unknown';
  return{...person,person_key:key,is_following:isFollowing,is_follower:isFollower,relation,
   following_rank:a?.source_rank??v?.following_rank??null,follower_rank:b?.source_rank??v?.follower_rank??null,
   lost_at:relation==='following_only'?v?.lost_at||null:null,gained_at:relation==='mutual'?v?.gained_at||null:null,
   checked_at:v?.checked_at||[a?.last_seen_at,b?.last_seen_at].filter(Boolean).sort()[0]||null,
   evidence:v?'authenticated_relationship':'saved_lists',identity_exact:isFollowing!==null&&isFollower!==null};
 }).filter(x=>x.relation!=='none');
}
async function comparison(scope:string,noteId:string,b:any,page:number,pageSize:number){
 const allRows=async(table:string,fields:string,active=false)=>{const rows:any[]=[];for(let from=0;from<20000;from+=1000){let q=db.from(table).select(fields).eq('member_id',scope);if(active)q=q.eq('active',true);const{data,error}=await q.order('person_key').range(from,from+999);if(error)throw error;rows.push(...(data||[]));if(!data||data.length<1000)break}return rows};
 const [relations,verified,runs,statusResult]=await Promise.all([
  allRows('insight_relations',PERSON_FIELDS,true),allRows('insight_social_comparisons','*'),
  db.from('insight_relation_sync_runs').select('direction,expected_count,received_count,complete,created_at,error').eq('member_id',scope).order('created_at',{ascending:false}).limit(20),
  db.from('insight_social_comparison_status').select('checked_at,complete,following_total,follower_total,following_checked,follower_checked,error').eq('member_id',scope).maybeSingle()
 ]);
 if(runs.error)throw runs.error;if(statusResult.error)throw statusResult.error;
 const latest:any={};for(const r of runs.data||[])if(!latest[r.direction])latest[r.direction]=r;
 const window=b.window==='latest'?'latest':'oldest',ascending=window==='latest',rank=(r:any)=>Number(r.following_rank??r.follower_rank??0);
 const all=comparisonRows(relations,verified,latest).sort((a,b)=>Number(b.is_following===true)-Number(a.is_following===true)||(ascending?rank(a)-rank(b):rank(b)-rank(a))||a.person_key.localeCompare(b.person_key));
 // The comparison window is selected before filtering, so every tab uses
 // the same people. The initial window starts with my own oldest followings.
 const selected=all.slice(0,1000),counts:any={all:selected.length,lost:0,following_only:0,mutual:0,follower_only:0,unknown:0,gained:0};
 for(const r of selected){counts[r.relation]=(counts[r.relation]||0)+1;if(r.lost_at)counts.lost++;if(r.gained_at)counts.gained++}
 const filter=String(b.relationship||'following_only'),term=searchText(b.query).toLowerCase();
 const rows=selected.filter(r=>(filter==='all'||filter==='lost'&&r.lost_at||filter==='gained'&&r.gained_at||r.relation===filter)&&(!term||String(r.actor_name||'').normalize('NFKC').toLowerCase().includes(term)||String(r.actor_url||'').toLowerCase().includes(term)));
 return{ok:true,rows:rows.slice((page-1)*pageSize,page*pageSize),total:rows.length,counts,page,pageSize,window,windowTotal:selected.length,latest,status:statusResult.data,noteId,basis:'mutual_relationship',selfFollowingCount:all.filter(r=>r.is_following===true).length};
}
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:H});
 try{
  if(req.method!=="POST")return out({ok:false,error:"METHOD_NOT_ALLOWED"},405);
  const m=await auth(req),b=await req.json().catch(()=>({})),action=String(b.action||"events"),page=Math.max(1,Number(b.page||1)),pageSize=Math.min(100,Math.max(20,Number(b.pageSize||50))),offset=(page-1)*pageSize;
  if(action==="comparison")return out(await comparison(m.scope,m.noteId,b,page,pageSize));
  if(action==="investigate")return out(await investigate(m.scope,String(b.personKey||"")));
  const window=["latest","oldest"].includes(b.window)?String(b.window):action==="people"?"latest":"all",direction=b.direction==="followings"?"followings":"followers";
  const [latest,people]=await Promise.all([latestRuns(m.scope,m.noteId),window==="all"?Promise.resolve(null):windowPeople(m.scope,direction,window)]);
  if(action==="people"){
   const term=searchText(b.query).toLowerCase(),list=(people||[]).filter((r:any)=>!term||String(r.actor_name||"").normalize("NFKC").toLowerCase().includes(term)||String(r.actor_url||"").toLowerCase().includes(term));
   return out({ok:true,page,pageSize,total:list.length,windowTotal:people?.length||0,rows:list.slice(offset,offset+pageSize),direction,run:latest[direction],latest,noteId:m.noteId,window,basis:window==="oldest"?"source_order_bottom":"latest_snapshot"});
  }
  const result=await windowEvents(m.scope,{...b,action,direction:window==="all"?String(b.direction||"all"):direction},people?.map((r:any)=>r.person_key)||null,offset,pageSize);
  return out({ok:true,...result,page,pageSize,latest,noteId:m.noteId,window,windowTotal:people?.length??null});
 }catch(e){const msg=e instanceof Error?e.message:String(e);console.error(msg);return out({ok:false,error:msg},/LOGIN|SESSION|INACTIVE/.test(msg)?401:500)}
});
