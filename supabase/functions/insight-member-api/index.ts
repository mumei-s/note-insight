import {db,headers,reply,member} from "./auth.ts";
import {creator,articles,likes,comments,followers,type Article} from "./note.ts";

const validDate=(x:any)=>typeof x==="string"&&!Number.isNaN(Date.parse(x))?new Date(x).toISOString():null;
const scope=(m:any)=>String(m.noteId||"").toLowerCase()==="ss_yr"?"owner":String(m.id);

async function notice(mid:string,fp:string,type:string,text:string,name:string|null,url:string|null,title:string|null,target:string|null,at:string|null,meta:any={}){
  const {error}=await db.from("insight_notifications").insert({member_id:mid,fingerprint:fp,notification_type:type,raw_text:text,actor_name:name,actor_url:url,target_title:title,target_url:target,source_url:target,occurred_at:validDate(at),meta:{source:"member-public-watch",derived:true,...meta}});
  return !error;
}

async function addPendingCommentArticles(dataMember:string,cursor:number,seenArticles:Map<string,Article>,refreshComments:Set<string>){
  const offset=((Math.max(1,cursor)-1)%10)*10;
  const [{data:recent,error:recentError},{data:rotating,error:rotatingError}]=await Promise.all([
    db.rpc("insight_fast_comment_threads",{p_member:dataMember,p_offset:0,p_limit:5,p_query:"",p_status:"pending"}),
    db.rpc("insight_fast_comment_threads",{p_member:dataMember,p_offset:offset,p_limit:10,p_query:"",p_status:"pending"}),
  ]);
  if(recentError)console.error("pending-comment-recent",recentError);
  if(rotatingError)console.error("pending-comment-rotating",rotatingError);
  for(const row of [...(recent||[]),...(rotating||[])]){
    const key=String(row?.article_key||"");
    if(key)refreshComments.add(key);
  }
  const missing=[...refreshComments].filter(key=>!seenArticles.has(key)).slice(0,20);
  if(!missing.length)return;
  const {data,error}=await db.from("insight_public_articles").select("article_key,title,url,publish_at,like_count,comment_count").eq("member_id",dataMember).in("article_key",missing);
  if(error){console.error("pending-comment-articles",error);return}
  for(const row of data||[]){
    const key=String(row.article_key||"");
    if(!key)continue;
    seenArticles.set(key,{key,title:String(row.title||"無題の記事"),url:String(row.url||""),published:row.publish_at?String(row.publish_at):null,likes:Number(row.like_count||0),comments:Number(row.comment_count||0)});
  }
}

async function sync(req:Request){
  const m=await member(req),dataMember=scope(m),watchMember=dataMember;
  const {data:p}=await db.from("insight_notification_profiles").select("watch_cursor,public_watch_initialized_at").eq("member_id",watchMember).maybeSingle();
  const baseline=!p?.public_watch_initialized_at,cursor=Math.max(1,Number(p?.watch_cursor||1));
  const historyPage=3+((cursor-1)%18);
  const pages=[1,2,historyPage],seenArticles=new Map<string,Article>(),refreshComments=new Set<string>();

  for(const page of [...new Set(pages)]){
    const x=await articles(m.noteId,page);
    for(const row of x.rows){
      seenArticles.set(row.key,row);
      if(page===1)refreshComments.add(row.key);
    }
  }

  await addPendingCommentArticles(dataMember,cursor,seenArticles,refreshComments);

  let added=0;
  for(const art of seenArticles.values()){
    const {data:old}=await db.from("insight_public_articles").select("like_count,comment_count").eq("member_id",dataMember).eq("article_key",art.key).maybeSingle();
    const oldLikes=Number(old?.like_count??-1),oldComments=Number(old?.comment_count??-1);

    if(!old||art.likes!==oldLikes){
      const rows=await likes(art.key),{data:known}=await db.from("insight_public_likes").select("liker_key").eq("member_id",dataMember).eq("article_key",art.key),keys=new Set((known||[]).map((x:any)=>String(x.liker_key)));
      for(const x of rows){
        if(keys.has(x.key))continue;
        await db.from("insight_public_likes").upsert({member_id:dataMember,article_key:art.key,liker_key:x.key,actor_name:x.name,actor_url:x.url,actor_image_url:x.image,liked_at:validDate(x.at)},{onConflict:"member_id,article_key,liker_key"});
        if(!baseline&&await notice(m.id,`like|${art.key}|${x.key}`,"like",`${x.name}さんが「${art.title}」にスキしました`,x.name,x.url,art.title,art.url,x.at,{articleKey:art.key}))added++;
      }
    }

    if(!old||art.comments!==oldComments||refreshComments.has(art.key)){
      try{
        const rows:any[]=await comments(art.key),{data:known}=await db.from("insight_public_comments").select("comment_key").eq("member_id",dataMember).eq("article_key",art.key),keys=new Set((known||[]).map((x:any)=>String(x.comment_key)));
        for(const x of rows){
          if(keys.has(x.key))continue;
          const creatorComment=String(x.urlname||"").toLowerCase()===m.noteId.toLowerCase();
          await db.from("insight_public_comments").upsert({member_id:dataMember,article_key:art.key,comment_key:x.key,parent_key:x.parent,actor_key:x.urlname||x.key,actor_name:x.name,actor_url:x.url,actor_image_url:x.image,body:x.body,occurred_at:validDate(x.at),is_root:!x.parent,is_creator:creatorComment},{onConflict:"member_id,article_key,comment_key"});
          if(!baseline&&!creatorComment&&await notice(m.id,`comment|${art.key}|${x.key}`,x.parent?"reply":"comment",`${x.name}さんが「${art.title}」に${x.parent?"返信":"コメント"}しました`,x.name,x.url,art.title,art.url,x.at,{articleKey:art.key,commentKey:x.key,parentKey:x.parent||null}))added++;
        }
      }catch(e){console.error("comments",art.key,e)}
    }

    await db.from("insight_public_articles").upsert({member_id:dataMember,article_key:art.key,title:art.title,url:art.url,publish_at:validDate(art.published),like_count:art.likes,comment_count:art.comments,last_seen_at:new Date().toISOString()},{onConflict:"member_id,article_key"});
  }

  const {data:knownF}=await db.from("insight_public_followers").select("person_key").eq("member_id",dataMember),fkeys=new Set((knownF||[]).map((x:any)=>String(x.person_key)));
  for(let page=1;page<=3;page++){
    const x=await followers(m.noteId,page);
    for(const f of x.rows){
      const fresh=!fkeys.has(f.key);
      await db.from("insight_public_followers").upsert({member_id:dataMember,person_key:f.key,actor_name:f.name,actor_url:f.url,last_seen_at:new Date().toISOString()},{onConflict:"member_id,person_key"});
      if(fresh&&!baseline&&await notice(m.id,`follow|${f.key}`,"follow",`${f.name}さんにフォローされました`,f.name,f.url,null,null,null,{personKey:f.key}))added++;
    }
    if(x.last)break;
  }

  const now=new Date().toISOString();
  await db.from("insight_notification_profiles").upsert({member_id:watchMember,note_urlname:m.noteId,note_nickname:m.displayName,role:watchMember==="owner"?"owner":"member",verified_at:now,public_watch_enabled:true,public_watch_initialized_at:p?.public_watch_initialized_at||now,last_watch_at:now,watch_error:null,watch_cursor:cursor+1,updated_at:now},{onConflict:"member_id"});
  return{ok:true,baseline,scannedArticles:seenArticles.size,refreshedCommentThreads:refreshComments.size,newNotifications:added,lastWatchAt:now,dataScope:dataMember,historyPage};
}

async function dashboard(req:Request){
  const m=await member(req),dataMember=scope(m),watchMember=dataMember;
  const [profile,{data:arts},{data:watch}]=await Promise.all([
    creator(m.noteId),
    db.from("insight_public_articles").select("article_key,title,url,publish_at,like_count,comment_count,last_seen_at").eq("member_id",dataMember).order("publish_at",{ascending:false}).limit(1000),
    db.from("insight_notification_profiles").select("last_watch_at,public_watch_initialized_at,watch_error,watch_cursor").eq("member_id",watchMember).maybeSingle(),
  ]);
  const [{data:fast},{data:analysis}]=await Promise.all([
    db.rpc("insight_fast_summary",{p_member:dataMember}),
    db.rpc("insight_fast_analysis_v2",{p_member:dataMember}),
  ]);
  return{ok:true,member:m,creator:profile,stats:{storedArticles:Number(fast?.articleCount||0),identifiedLikes:Number(fast?.identifiedLikeCount||0),comments:Number(analysis?.unrepliedComments||0)+Number(analysis?.followupPendingComments||0)+Number(analysis?.repliedComments||0)+Number(analysis?.completedCommentThreads||0),trackedFollowers:Number(analysis?.followers?.total||0),officialFollowers:profile.followers,officialFollowing:profile.following,officialNotes:profile.notes},articles:arts||[],notifications:[],followers:[],comments:[],topSupporters:[],topCommenters:[],watch:{initialized:Boolean(watch?.public_watch_initialized_at),lastWatchAt:watch?.last_watch_at||null,error:watch?.watch_error||null,cursor:Number(watch?.watch_cursor||1)}};
}

Deno.serve(async req=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:headers(req)});
  try{
    if(req.method!=="POST")return reply(req,{ok:false,error:"METHOD_NOT_ALLOWED"},405);
    const body=await req.json().catch(()=>({})),action=typeof body?.action==="string"?body.action:"dashboard";
    if(action==="sync")return reply(req,await sync(req));
    if(action==="dashboard")return reply(req,await dashboard(req));
    if(action==="mark-read"){
      const m=await member(req),ids=Array.isArray(body?.ids)?body.ids.filter((x:any)=>Number.isInteger(x)).slice(0,1000):[];
      let q=db.from("insight_notifications").update({is_read:body?.read!==false}).eq("member_id",m.id);
      if(ids.length)q=q.in("id",ids);
      const {error}=await q;if(error)throw error;
      return reply(req,{ok:true});
    }
    return reply(req,{ok:false,error:"UNKNOWN_ACTION"},400);
  }catch(e){
    const msg=e instanceof Error?e.message:String(e);console.error(msg);
    return reply(req,{ok:false,error:msg},/LOGIN|SESSION|INACTIVE/.test(msg)?401:500);
  }
});
