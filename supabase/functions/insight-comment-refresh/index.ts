import { createClient } from "npm:@supabase/supabase-js@2";

const U=Deno.env.get("SUPABASE_URL")!;
const K=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db=createClient(U,K,{auth:{persistSession:false}});
const NOTE="https://note.com";
const HEADERS={"Content-Type":"application/json; charset=utf-8","Access-Control-Allow-Origin":"https://mumei-s.github.io","Access-Control-Allow-Headers":"content-type,x-cron-secret","Access-Control-Allow-Methods":"POST,OPTIONS"};
const o=(v:any)=>v&&typeof v==="object"&&!Array.isArray(v)?v:{};
const a=(v:any)=>Array.isArray(v)?v:[];
const s=(v:any,d="")=>typeof v==="string"?v:d;
const n=(v:any,d=0)=>typeof v==="number"&&Number.isFinite(v)?v:d;
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
const out=(x:unknown,status=200)=>new Response(JSON.stringify(x),{status,headers:HEADERS});
const iso=(v:any)=>typeof v==="string"&&!Number.isNaN(Date.parse(v))?new Date(v).toISOString():null;

async function noteJson(path:string){
  const c=new AbortController(),t=setTimeout(()=>c.abort(),12000);
  try{
    const r=await fetch(NOTE+path,{headers:{Accept:"application/json","User-Agent":"Mumei-S-note-INSIGHT/3.2 (+comment-refresh)"},signal:c.signal});
    if(!r.ok)throw new Error(`NOTE_PUBLIC_${r.status}`);
    return await r.json();
  }finally{clearTimeout(t)}
}

type Article={key:string;title:string;url:string;publishAt:string|null;commentCount:number};
async function recentArticles(noteId:string){
  const p=o(await noteJson(`/api/v2/creators/${encodeURIComponent(noteId)}/contents?kind=note&page=1`)),d=o(p.data);
  return a(d.contents??d.notes).map((x:any):Article|null=>{
    const v=o(o(x).note??x),key=s(v.key);if(!key)return null;
    return{key,title:s(v.name??v.title,"無題の記事"),url:s(v.noteUrl??v.url,`${NOTE}/${noteId}/n/${key}`),publishAt:s(v.publishAt??v.publish_at)||null,commentCount:n(v.commentCount??v.comment_count)};
  }).filter(Boolean) as Article[];
}

function commentText(v:any):string{
  if(typeof v==="string")return v;
  if(Array.isArray(v))return v.map(commentText).filter(Boolean).join("\n");
  const d=o(v);
  if(typeof d.value==="string")return d.value;
  return[...a(d.children),...a(d.content)].map(commentText).filter(Boolean).join("\n");
}

function pageRows(p:any){
  const payload=p?.data,d=o(payload),rows=Array.isArray(payload)?payload:a(d.comments??d.note_comments??d.contents);
  const next=p?.next_page??p?.nextPage??d.next_page??d.nextPage;
  return{rows,last:next==null||next===false||next===""};
}

function normalize(r:any,parent:string|null=null){
  const row=o(r),u=o(row.user??row.author),urlname=s(u.urlname)||null,key=s(row.key??row.comment_key);
  if(!key)return null;
  return{
    key,
    parent:s(row.parent_key??row.parentKey)||parent,
    urlname,
    name:s(u.nickname??u.name,"noteユーザー"),
    url:urlname?`${NOTE}/${urlname}`:null,
    image:s(u.profileImageUrl??u.profile_image_url)||null,
    body:commentText(row.comment??row.body??row.text).replace(/\s+/g," ").trim().slice(0,1000),
    at:s(row.created_at??row.createdAt)||null,
    liked:Boolean(row.is_creator_liked??row.isCreatorLiked??row.is_liked_by_note_owner),
    likeCount:n(row.like_count??row.likeCount)
  };
}

async function commentPages(articleKey:string,parentKey:string|null=null){
  const rows:any[]=[];
  for(let page=1;page<=20;page++){
    const parent=parentKey?`&parent_key=${encodeURIComponent(parentKey)}`:"";
    const p=await noteJson(`/api/v3/notes/${encodeURIComponent(articleKey)}/note_comments?order=oldest&per_page=100&page=${page}${parent}`),cp=pageRows(p);
    rows.push(...cp.rows);
    if(cp.last)break;
    await sleep(60);
  }
  return rows;
}

async function comments(articleKey:string){
  const all=new Map<string,any>(),roots=await commentPages(articleKey);
  for(const raw of roots){
    const root=o(raw),base=normalize(root,null);if(!base)continue;
    all.set(base.key,base);
    const embedded=normalize(root.latest_creator_reply,base.key);
    if(embedded)all.set(embedded.key,embedded);
    const replyCount=n(root.reply_count??root.replyCount),known=embedded?1:0;
    if(replyCount>known){
      try{
        const replies=await commentPages(articleKey,base.key);
        for(const rawReply of replies){const reply=normalize(rawReply,base.key);if(reply&&reply.key!==base.key)all.set(reply.key,reply)}
      }catch(e){console.error("reply-fetch",articleKey,base.key,e instanceof Error?e.message:e)}
    }
  }
  return[...all.values()];
}

async function notificationMember(noteId:string,fallback:string){
  const {data}=await db.from("insight_access_applications").select("id").eq("note_id",noteId).eq("status","active").maybeSingle();
  return data?.id?String(data.id):fallback;
}

async function pendingArticles(dataMember:string){
  const {data,error}=await db.rpc("insight_fast_comment_threads",{p_member:dataMember,p_offset:0,p_limit:20,p_query:"",p_status:"pending"});
  if(error){console.error("pending-rpc",error);return[] as Article[]}
  const keys=[...new Set((data||[]).map((r:any)=>String(r.article_key||"")).filter(Boolean))];
  if(!keys.length)return[];
  const {data:rows,error:re}=await db.from("insight_public_articles").select("article_key,title,url,publish_at,comment_count").eq("member_id",dataMember).in("article_key",keys);
  if(re){console.error("pending-articles",re);return[]}
  return(rows||[]).map((r:any)=>({key:String(r.article_key),title:String(r.title||"記事"),url:String(r.url||""),publishAt:r.publish_at?String(r.publish_at):null,commentCount:Number(r.comment_count||0)}));
}

async function refreshProfile(profile:any){
  const noteId=String(profile.note_urlname||"").toLowerCase();
  if(!noteId)return{ok:false,error:"NOTE_ID_REQUIRED"};
  const dataMember=noteId==="ss_yr"?"owner":String(profile.member_id),notifyMember=await notificationMember(noteId,String(profile.member_id));
  const recent=await recentArticles(noteId),pending=await pendingArticles(dataMember),map=new Map<string,Article>();
  for(const art of recent.filter(x=>x.commentCount>0).slice(0,12))map.set(art.key,art);
  for(const art of pending)map.set(art.key,art);
  let inserted=0,scanned=0,latest:string|null=null;

  for(const art of map.values()){
    try{
      const [{data:known},rows]=await Promise.all([
        db.from("insight_public_comments").select("comment_key").eq("member_id",dataMember).eq("article_key",art.key),
        comments(art.key),
      ]);
      const before=new Set((known||[]).map((x:any)=>String(x.comment_key)));
      for(const x of rows){
        const creator=String(x.urlname||"").toLowerCase()===noteId;
        const row={member_id:dataMember,article_key:art.key,comment_key:x.key,parent_key:x.parent,actor_key:x.urlname||x.key,actor_name:x.name,actor_url:x.url,actor_image_url:x.image,body:x.body,occurred_at:iso(x.at),is_root:!x.parent,is_creator:creator,is_creator_liked:x.liked,like_count:x.likeCount};
        const {error}=await db.from("insight_public_comments").upsert(row,{onConflict:"member_id,article_key,comment_key"});
        if(error){console.error("comment-upsert",art.key,x.key,error);continue}
        if(row.occurred_at&&(!latest||row.occurred_at>latest))latest=row.occurred_at;
        if(!before.has(x.key)&&!creator){
          const fp=`comment-refresh|${art.key}|${x.key}`;
          const text=`${x.name}さんが「${art.title}」に${x.parent?"返信":"コメント"}しました`;
          const {error:ne}=await db.from("insight_notifications").insert({member_id:notifyMember,fingerprint:fp,notification_type:x.parent?"reply":"comment",raw_text:text,actor_name:x.name,actor_url:x.url,target_title:art.title,target_url:art.url,source_url:art.url,occurred_at:row.occurred_at,meta:{source:"comment-refresh",derived:true,articleKey:art.key,commentKey:x.key,parentKey:x.parent}});
          if(!ne)inserted++;else if(ne.code!=="23505")console.error("comment-notice",ne);
        }
      }
      await db.from("insight_public_articles").update({comment_count:art.commentCount,last_seen_at:new Date().toISOString()}).eq("member_id",dataMember).eq("article_key",art.key);
      scanned++;
    }catch(e){console.error("comment-refresh",art.key,e instanceof Error?e.message:e)}
    await sleep(80);
  }
  return{ok:true,noteId,dataMember,notifyMember,articles:scanned,newNotifications:inserted,latestCommentAt:latest};
}

Deno.serve(async req=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:HEADERS});
  try{
    if(req.method!=="POST")return out({ok:false,error:"METHOD_NOT_ALLOWED"},405);
    const supplied=req.headers.get("X-Cron-Secret")||"",{data:secret}=await db.from("insight_notification_cron_secret").select("secret").eq("singleton",true).maybeSingle();
    if(!secret?.secret||supplied!==secret.secret)return out({ok:false,error:"CRON_SECRET_INVALID"},401);
    const {data:profiles,error}=await db.from("insight_notification_profiles").select("member_id,note_urlname").eq("public_watch_enabled",true).not("verified_at","is",null).limit(100);
    if(error)throw error;
    const results=[] as any[];
    for(const p of profiles||[]){results.push(await refreshProfile(p));await sleep(120)}
    return out({ok:true,profiles:results.length,results});
  }catch(e){const msg=e instanceof Error?e.message:String(e);console.error(msg);return out({ok:false,error:msg},500)}
});
