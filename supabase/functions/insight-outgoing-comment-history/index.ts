import { createClient } from "npm:@supabase/supabase-js@2.112.4";
const db=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false}});
const H={"Access-Control-Allow-Origin":"https://mumei-s.github.io","Access-Control-Allow-Headers":"content-type,x-insight-token","Access-Control-Allow-Methods":"POST,OPTIONS","Content-Type":"application/json; charset=utf-8","Vary":"Origin"};
const out=(x:unknown,s=200)=>new Response(JSON.stringify(x),{status:s,headers:H});
const SOURCE="successful-note-comment-post",PURPOSE="note_notification_and_own_comment_sync",ARTICLE=/^n[A-Za-z0-9]{1,127}$/,COMMENT=/^nc[A-Za-z0-9]{1,126}$/;
async function sha(v:string){const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(v));return[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("")}
// The same member-session/account boundary as notification-feed-final. Ingest
// credentials never authorize reading history, and caller-supplied member IDs do not.
async function auth(req:Request){
 const raw=req.headers.get("X-Insight-Token")||"";if(!raw||raw.length>256)throw new Error("INSIGHT_LOGIN_REQUIRED");
 const{data:s,error}=await db.from("insight_member_sessions").select("application_id,expires_at,revoked_at").eq("token_hash",await sha(raw)).maybeSingle();
 if(error)throw new Error("AUTH_CHECK_UNAVAILABLE");if(!s||s.revoked_at||!Number.isFinite(Date.parse(s.expires_at))||Date.parse(s.expires_at)<=Date.now())throw new Error("INSIGHT_SESSION_INVALID");
 const{data:a,error:ae}=await db.from("insight_access_applications").select("id,note_id,status,verified_at,revoked_at").eq("id",s.application_id).maybeSingle();
 if(ae)throw new Error("AUTH_CHECK_UNAVAILABLE");if(!a||a.status!=="active"||!a.verified_at||a.revoked_at)throw new Error("INSIGHT_MEMBER_INACTIVE");
 const noteId=String(a.note_id||"").toLowerCase();return{id:String(a.id),scope:noteId==="ss_yr"?"owner":String(a.id),noteId};
}
const scopes=(m:any)=>m.scope===m.id?[m.id]:[m.scope,m.id];
function articleUrl(raw:any,articleKey:string){
 try{const u=new URL(raw);if(u.protocol!=="https:"||u.hostname!=="note.com"||u.username||u.password||u.port||!new RegExp(`^/[A-Za-z0-9_-]+/n/${articleKey}$`).test(u.pathname))return null;u.search="";u.hash="";return u.toString()}catch{return null}
}
function links(raw:any,articleKey:string,commentKey:string){const url=articleUrl(raw,articleKey);return{articleUrl:url,commentUrl:url?`${url}?scrollpos=comment&c=${encodeURIComponent(commentKey)}`:null}}
function ownRow(r:any,noteId:string){
 const d=r.raw_data||{};
 if(d.account!==noteId||r.actor_key!==noteId||!ARTICLE.test(d.article_key||"")||!COMMENT.test(d.comment_key||"")||r.event_key!==`note-comment:${d.article_key}:${d.comment_key}`||d.client_id!==`${noteId}:${d.article_key}:${d.comment_key}`)return null;
 if(d.parent_key!==null&&(!COMMENT.test(d.parent_key||"")||d.parent_key===d.comment_key))return null;
 return{id:d.client_id,articleKey:d.article_key,commentKey:d.comment_key,parentKey:d.parent_key,body:r.message,occurredAt:r.occurred_at,authorUrl:`https://note.com/${noteId}`,...links(r.subject_url,d.article_key,d.comment_key)};
}
function retained(v:any){return typeof v==="string"&&v.trim()&&!/^(?:削除済み|このコメントは削除されました[。.]?|コメントは削除されました[。.]?|削除されたコメント|\[deleted\]|\[removed\])$/i.test(v.trim())?v:""}
function savedMessage(r:any,root:string,noteId:string){
 if(!COMMENT.test(r.commentKey||"")||(r.commentKey===root?r.parentKey!==null:r.parentKey!==root))return null;
 const body=retained(r.body);if(!body||body.length>100_000)return null;
 let url:string|null=null;try{const u=new URL(r.authorUrl);if(u.protocol==="https:"&&u.hostname==="note.com"&&!u.username&&!u.password&&!u.port&&/^\/[A-Za-z0-9_-]+\/?$/.test(u.pathname))url=`https://note.com/${u.pathname.split("/")[1].toLowerCase()}`}catch{}
 return{commentKey:r.commentKey,parentKey:r.parentKey,body,author:typeof r.author==="string"?r.author.slice(0,160):null,authorUrl:url,occurredAt:typeof r.occurredAt==="string"&&Number.isFinite(Date.parse(r.occurredAt))?new Date(r.occurredAt).toISOString():null,isSelf:url===`https://note.com/${noteId}`};
}
async function permission(m:any){const{error,count}=await db.from("insight_notification_ingest_tokens").select("id",{count:"exact",head:true}).in("member_id",scopes(m)).eq("purpose",PURPOSE).eq("own_comment_account",m.noteId).is("revoked_at",null).gt("expires_at",new Date().toISOString());if(error)throw new Error("OWN_COMMENT_HISTORY_READ_FAILED");return{enabled:Number(count||0)>0,activeDeviceCount:Number(count||0)}}
async function list(m:any,b:any){
 const page=Math.min(1000,Math.max(1,Math.floor(Number(b.page)||1))),pageSize=Math.min(50,Math.max(1,Math.floor(Number(b.pageSize)||20)));
 // Preview truncation happens in Postgres, not after transferring entire bodies.
 const [{data,error},state]=await Promise.all([db.rpc("insight_own_comment_history_page",{p_member_ids:scopes(m),p_account:m.noteId,p_page:page,p_page_size:pageSize}),permission(m)]);
 if(error||!data||!Array.isArray(data.rows))throw new Error("OWN_COMMENT_HISTORY_READ_FAILED");
 const keys=[...new Set(data.rows.map((r:any)=>r.articleKey))];
 const{data:articles,error:ae}=keys.length?await db.from("insight_public_articles").select("article_key,url").eq("member_id",m.scope).in("article_key",keys).limit(50):{data:[],error:null};if(ae)throw new Error("OWN_COMMENT_HISTORY_READ_FAILED");
 const urls=new Map((articles||[]).map((a:any)=>[a.article_key,a.url]));
 return{ok:true,noteId:m.noteId,page,pageSize,hasMore:data.hasMore===true,rows:data.rows.map((r:any)=>({...r,...links(r.articleUrl||urls.get(r.articleKey),r.articleKey,r.commentKey)})),permission:state};
}
async function detail(m:any,b:any){
 if(!ARTICLE.test(b.articleKey||"")||!COMMENT.test(b.commentKey||""))throw new Error("INVALID_COMMENT_ID");
 const{data:saved,error}=await db.from("insight_outgoing_activity").select("event_key,actor_key,subject_url,message,occurred_at,raw_data").in("member_id",scopes(m)).eq("source",SOURCE).eq("event_type","commented").eq("actor_key",m.noteId).eq("event_key",`note-comment:${b.articleKey}:${b.commentKey}`).limit(1).maybeSingle();
 if(error)throw new Error("OWN_COMMENT_HISTORY_READ_FAILED");const row=saved&&ownRow(saved,m.noteId);if(!row)throw new Error("OWN_COMMENT_NOT_FOUND");
 const root=row.parentKey||row.commentKey;
 // Exact article + root/parent relationships only. Never fetch note or infer a
 // conversation from authors, times, titles, or notification text.
 const [thread,article]=await Promise.all([
  db.rpc("insight_own_comment_saved_thread",{p_member_ids:scopes(m),p_scope:m.scope,p_account:m.noteId,p_article:row.articleKey,p_root:root}),
  db.from("insight_public_articles").select("url").eq("member_id",m.scope).eq("article_key",row.articleKey).maybeSingle()
 ]);
 if(thread.error||article.error||!Array.isArray(thread.data?.messages))throw new Error("OWN_COMMENT_HISTORY_READ_FAILED");
 const messages=new Map<string,any>();let size=0,truncated=thread.data.truncated===true;
 function add(v:any){const x=savedMessage(v,root,m.noteId);if(!x||messages.has(x.commentKey))return;if(messages.size>=500||size+x.body.length>500_000){truncated=true;return}messages.set(x.commentKey,x);size+=x.body.length}
 // Own immutable requested capture always wins, including when the bounded
 // saved-thread projection is truncated. Projection deduplicates before egress.
 add({...row,author:m.noteId});for(const message of thread.data.messages.slice(0,500))add(message);
 const url=row.articleUrl||articleUrl(article.data?.url,row.articleKey)||articleUrl(thread.data.articleUrl,row.articleKey);
 return{ok:true,noteId:m.noteId,row:{...row,...links(url,row.articleKey,row.commentKey)},conversation:{articleKey:row.articleKey,threadKey:root,complete:false,source:"saved-only",truncated,messages:[...messages.values()].sort((a,b)=>String(a.occurredAt||"").localeCompare(String(b.occurredAt||""))||a.commentKey.localeCompare(b.commentKey))},replyState:"unknown"};
}
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:H});if(req.method!=="POST")return out({ok:false,error:"METHOD_NOT_ALLOWED"},405);
 try{const m=await auth(req),text=await req.text();if(text.length>4096)throw new Error("INVALID_PAYLOAD");let b:any;try{b=JSON.parse(text)}catch{throw new Error("INVALID_PAYLOAD")}if(b?.action==="detail")return out(await detail(m,b));if(b?.action==="list"||!b?.action)return out(await list(m,b||{}));throw new Error("INVALID_ACTION")}
 catch(e){const error=e instanceof Error?e.message:"OWN_COMMENT_HISTORY_READ_FAILED";return out({ok:false,error},/LOGIN|SESSION|INACTIVE/.test(error)?401:/NOT_FOUND/.test(error)?404:/INVALID/.test(error)?400:503)}
});
