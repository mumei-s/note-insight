import {db,headers,reply,member} from "./auth.ts";
import {creator,articles,likes,comments,followers,type Article} from "./note.ts";

const validDate=(x:any)=>typeof x==="string"&&!Number.isNaN(Date.parse(x))?new Date(x).toISOString():null;
const scope=(m:any)=>String(m.noteId||"").toLowerCase()==="ss_yr"?"owner":String(m.id);

async function notice(mid:string,fp:string,type:string,text:string,name:string|null,url:string|null,title:string|null,target:string|null,at:string|null,meta:any={}){
  const {error}=await db.from("insight_notifications").insert({member_id:mid,fingerprint:fp,notification_type:type,raw_text:text,actor_name:name,actor_url:url,target_title:title,target_url:target,source_url:target,occurred_at:validDate(at),meta:{source:"member-public-watch",derived:true,...meta}});
  if(error&&error.code!=="23505")throw error;
  return !error;
}

async function syncArticleCatalog(noteId:string,dataMember:string,force=false){
  const [{count,error:countError},profile]=await Promise.all([
    db.from("insight_public_articles").select("article_key",{count:"exact",head:true}).eq("member_id",dataMember),
    creator(noteId),
  ]);
  if(countError)throw countError;
  const stored=Number(count||0),official=Number(profile.notes||0);
  if(!force&&official>0&&stored>=official)return{refreshed:false,stored,official,pages:0};
  if(!force&&official<=0&&stored>18)return{refreshed:false,stored,official,pages:0};
  const found=new Map<string,Article>();let pages=0;
  for(let page=1;page<=200;page++){
    const x=await articles(noteId,page);pages=page;
    for(const row of x.rows)found.set(row.key,row);
    if(x.last)break;
  }
  const now=new Date().toISOString(),rows=[...found.values()].map(art=>({member_id:dataMember,article_key:art.key,title:art.title,url:art.url,publish_at:validDate(art.published),like_count:art.likes,comment_count:art.comments,last_seen_at:now}));
  for(let i=0;i<rows.length;i+=400){const {error}=await db.from("insight_public_articles").upsert(rows.slice(i,i+400),{onConflict:"member_id,article_key"});if(error)throw error}
  return{refreshed:true,stored:rows.length,official,pages};
}

async function addPendingCommentArticles(dataMember:string,cursor:number,seenArticles:Map<string,Article>,refreshComments:Set<string>,report:(source:string,error:any)=>void){
  const offset=((Math.max(1,cursor)-1)%10)*10;
  const [{data:recent,error:recentError},{data:rotating,error:rotatingError}]=await Promise.all([
    db.rpc("insight_fast_comment_threads",{p_member:dataMember,p_offset:0,p_limit:5,p_query:"",p_status:"pending"}),
    db.rpc("insight_fast_comment_threads",{p_member:dataMember,p_offset:offset,p_limit:10,p_query:"",p_status:"pending"}),
  ]);
  if(recentError)report("comments",recentError);
  if(rotatingError)report("comments",rotatingError);
  for(const row of [...(recent||[]),...(rotating||[])]){
    const key=String(row?.article_key||"");
    if(key)refreshComments.add(key);
  }
  const missing=[...refreshComments].filter(key=>!seenArticles.has(key)).slice(0,20);
  if(!missing.length)return;
  const {data,error}=await db.from("insight_public_articles").select("article_key,title,url,publish_at,like_count,comment_count").eq("member_id",dataMember).in("article_key",missing);
  if(error){report("comments",error);return}
  for(const row of data||[]){
    const key=String(row.article_key||"");
    if(!key)continue;
    seenArticles.set(key,{key,title:String(row.title||"無題の記事"),url:String(row.url||""),published:row.publish_at?String(row.publish_at):null,likes:Number(row.like_count||0),comments:Number(row.comment_count||0)});
  }
}

async function sync(req:Request){
  const m=await member(req),dataMember=scope(m),watchMember=dataMember;
  const partialErrors:{source:string;code:string;articleKey?:string;page?:number}[]=[],failedSources=new Set<string>();
  let failedOperations=0;
  const report=(source:string,error:any,detail:{articleKey?:string;page?:number}={})=>{
    failedOperations++;failedSources.add(source);
    const raw=String(error?.code||error?.message||error||"PUBLIC_SYNC_ERROR");
    const code=/^[A-Z0-9][A-Z0-9_:-]{0,100}$/.test(raw)?raw:"PUBLIC_SYNC_ERROR";
    if(partialErrors.length<20)partialErrors.push({source,code,...detail});
    console.error("public-sync-partial",source,code);
  };
  const savedCounts={articles:0,likes:0,comments:0,followers:0},confirmedCounts={likes:0,comments:0,followers:0};
  let p:any=null,profileError:any=null;
  try{const result=await db.from("insight_notification_profiles").select("watch_cursor,public_watch_initialized_at").eq("member_id",watchMember).maybeSingle();p=result.data;profileError=result.error;if(profileError)report("watch",profileError)}catch(e){profileError=e;report("watch",e)}
  const baseline=Boolean(profileError)||!p?.public_watch_initialized_at,cursor=Math.max(1,Number(p?.watch_cursor||1));
  let catalog:any=null;
  try{catalog=await syncArticleCatalog(m.noteId,dataMember,baseline)}catch(e){report("catalog",e)}
  const historyPage=3+((cursor-1)%198);
  const pages=[1,2,historyPage],seenArticles=new Map<string,Article>(),refreshComments=new Set<string>();

  for(const page of [...new Set(pages)]){
    try{
      const x=await articles(m.noteId,page);
      for(const row of x.rows){seenArticles.set(row.key,row);if(page===1)refreshComments.add(row.key)}
    }catch(e){report("articles",e,{page})}
  }
  try{await addPendingCommentArticles(dataMember,cursor,seenArticles,refreshComments,report)}catch(e){report("comments",e)}

  let added=0;
  for(const art of seenArticles.values()){
    const detail={articleKey:art.key};
    let old:any=null;
    try{const result=await db.from("insight_public_articles").select("like_count,comment_count").eq("member_id",dataMember).eq("article_key",art.key).maybeSingle();old=result.data;if(result.error)report("articles",result.error,detail)}catch(e){report("articles",e,detail)}
    // A newly discovered article must exist before its like/comment FK rows.
    try{const {error}=await db.from("insight_public_articles").upsert({member_id:dataMember,article_key:art.key,title:art.title,url:art.url,publish_at:validDate(art.published),like_count:art.likes,comment_count:art.comments,last_seen_at:new Date().toISOString()},{onConflict:"member_id,article_key"});if(error)throw error;savedCounts.articles++}catch(e){report("articles",e,detail);if(!old)continue}

    try{
      const {count,error}=await db.from("insight_public_likes").select("liker_key",{count:"exact",head:true}).eq("member_id",dataMember).eq("article_key",art.key);
      if(error)throw error;
      if(!old||art.likes!==Number(old.like_count??-1)||Number(count||0)<art.likes){
        const rows=await likes(art.key),{data:known,error:knownError}=await db.from("insight_public_likes").select("liker_key").eq("member_id",dataMember).eq("article_key",art.key);
        if(knownError)throw knownError;
        const keys=new Set((known||[]).map((x:any)=>String(x.liker_key)));
        for(const x of rows){
          if(keys.has(x.key)){confirmedCounts.likes++;continue}
          const {error:saveError}=await db.from("insight_public_likes").upsert({member_id:dataMember,article_key:art.key,liker_key:x.key,actor_name:x.name,actor_url:x.url,actor_image_url:x.image,liked_at:validDate(x.at)},{onConflict:"member_id,article_key,liker_key"});
          if(saveError){report("likes",saveError,detail);continue}
          savedCounts.likes++;confirmedCounts.likes++;keys.add(x.key);
          if(!baseline)try{if(await notice(watchMember,`like|${art.key}|${x.key}`,"like",`${x.name}さんが「${art.title}」にスキしました`,x.name,x.url,art.title,art.url,x.at,{articleKey:art.key}))added++}catch(e){report("notifications",e,detail)}
        }
      }
    }catch(e){report("likes",e,detail)}

    try{
      const {count,error}=await db.from("insight_public_comments").select("comment_key",{count:"exact",head:true}).eq("member_id",dataMember).eq("article_key",art.key);
      if(error)throw error;
      if(!old||art.comments!==Number(old.comment_count??-1)||refreshComments.has(art.key)||Number(count||0)<art.comments){
        const rows:any[]=await comments(art.key),{data:known,error:knownError}=await db.from("insight_public_comments").select("comment_key,parent_key,actor_key,actor_name,actor_url,actor_image_url,body,occurred_at,is_root,is_creator,is_creator_liked,like_count").eq("member_id",dataMember).eq("article_key",art.key);
        if(knownError)throw knownError;
        const saved=new Map<string,any>((known||[]).map((x:any)=>[String(x.comment_key),x]));
        for(const x of rows){
          const previous=saved.get(x.key),creatorComment=String(x.urlname||"").toLowerCase()===m.noteId.toLowerCase();
          const row={member_id:dataMember,article_key:art.key,comment_key:x.key,parent_key:x.parent,actor_key:x.urlname||x.key,actor_name:x.name,actor_url:x.url,actor_image_url:x.image||previous?.actor_image_url||null,body:x.body,occurred_at:validDate(x.at),is_root:!x.parent,is_creator:creatorComment,is_creator_liked:x.liked,like_count:x.likeCount};
          const changed=!previous||Object.entries(row).some(([key,value])=>key!=="member_id"&&key!=="article_key"&&(previous[key]??null)!==(value??null));
          if(changed){
            const {error:saveError}=await db.from("insight_public_comments").upsert(row,{onConflict:"member_id,article_key,comment_key"});
            if(saveError){report("comments",saveError,detail);continue}
            savedCounts.comments++;
          }
          confirmedCounts.comments++;saved.set(x.key,row);
          if(!previous&&!baseline&&!creatorComment)try{if(await notice(watchMember,`comment|${art.key}|${x.key}`,x.parent?"reply":"comment",`${x.name}さんが「${art.title}」に${x.parent?"返信":"コメント"}しました`,x.name,x.url,art.title,art.url,x.at,{articleKey:art.key,commentKey:x.key,parentKey:x.parent||null}))added++}catch(e){report("notifications",e,detail)}
        }
      }
    }catch(e){report("comments",e,detail)}
  }

  try{
    const {data:knownF,error:knownError}=await db.from("insight_public_followers").select("person_key").eq("member_id",dataMember);
    if(knownError)throw knownError;
    const fkeys=new Set((knownF||[]).map((x:any)=>String(x.person_key)));
    for(let page=1;page<=3;page++){
      try{
        const x=await followers(m.noteId,page);
        for(const f of x.rows){
          const fresh=!fkeys.has(f.key);
          const {error:saveError}=await db.from("insight_public_followers").upsert({member_id:dataMember,person_key:f.key,actor_name:f.name,actor_url:f.url,last_seen_at:new Date().toISOString()},{onConflict:"member_id,person_key"});
          if(saveError){report("followers",saveError,{page});continue}
          savedCounts.followers++;confirmedCounts.followers++;fkeys.add(f.key);
          if(fresh&&!baseline)try{if(await notice(watchMember,`follow|${f.key}`,"follow",`${f.name}さんにフォローされました`,f.name,f.url,null,null,null,{personKey:f.key}))added++}catch(e){report("notifications",e,{page})}
        }
        if(x.last)break;
      }catch(e){report("followers",e,{page})}
    }
  }catch(e){report("followers",e)}

  const now=new Date().toISOString(),complete=failedOperations===0;
  // A failed state read must not replace an existing initialization/cursor with
  // guessed defaults. The response still reports that the watch state failed.
  if(!profileError)try{const {error}=await db.from("insight_notification_profiles").upsert({member_id:watchMember,note_urlname:m.noteId,note_nickname:m.displayName,role:watchMember==="owner"?"owner":"member",verified_at:now,public_watch_enabled:true,public_watch_initialized_at:p?.public_watch_initialized_at||(complete?now:null),last_watch_at:now,watch_error:complete?null:`PUBLIC_SYNC_PARTIAL:${[...failedSources].join(",")}`,watch_cursor:complete?cursor+1:cursor,updated_at:now},{onConflict:"member_id"});if(error)throw error}catch(e){report("watch",e)}
  return{ok:true,complete:failedOperations===0,partial:failedOperations>0,failedSources:[...failedSources],partialErrors,failedOperations,savedCounts,confirmedCounts,baseline,catalog,scannedArticles:seenArticles.size,refreshedCommentThreads:refreshComments.size,newNotifications:added,lastWatchAt:now,dataScope:dataMember,historyPage};
}

// Keep legacy numeric fields for existing clients, and expose validated counts
// separately so the public analysis can distinguish missing counts from zero.
async function dashboardCreator(noteId:string){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
  try{
    const response=await fetch(`https://note.com/api/v2/creators/${encodeURIComponent(noteId)}`,{headers:{Accept:"application/json","User-Agent":"Mumei-S-note-INSIGHT/3.6"},cache:"no-store",signal:controller.signal});
    if(!response.ok)throw new Error(`NOTE_PUBLIC_${response.status}`);
    const payload=await response.json(),d=payload?.data||{},id=String(d.urlname||"").toLowerCase();
    if(id!==String(noteId).toLowerCase())throw new Error("NOTE_PUBLIC_PROFILE_MISMATCH");
    const count=(v:unknown)=>typeof v==="number"&&Number.isSafeInteger(v)&&v>=0?v:null;
    const followers=count(d.followerCount??d.follower_count),following=count(d.followingCount??d.following_count);
    return{noteId:id,name:typeof d.nickname==="string"?d.nickname:noteId,image:d.profileImageUrl??d.profile_image_url??null,followers:followers??0,following:following??0,notes:count(d.noteCount??d.note_count)??0,
      publicCounts:{followers,following,checkedAt:new Date().toISOString(),source:"note-profile"}};
  }finally{clearTimeout(timer)}
}

async function dashboard(req:Request){
  const m=await member(req),dataMember=scope(m),watchMember=dataMember;
  const [profile,{data:arts},{data:watch}]=await Promise.all([
    dashboardCreator(m.noteId),
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
