const ROOT="https://note.com";
const o=(v:any)=>v&&typeof v==="object"&&!Array.isArray(v)?v:{};
const a=(v:any)=>Array.isArray(v)?v:[];
const s=(v:any,d="")=>typeof v==="string"?v:d;
const n=(v:any,d=0)=>typeof v==="number"&&Number.isFinite(v)?v:d;
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));

async function get(path:string){
  const c=new AbortController(),t=setTimeout(()=>c.abort(),12000);
  try{
    const r=await fetch(ROOT+path,{headers:{Accept:"application/json","User-Agent":"Mumei-S-note-INSIGHT/3.4"},signal:c.signal});
    if(!r.ok)throw new Error(`NOTE_PUBLIC_${r.status}`);
    return o(await r.json());
  }finally{clearTimeout(t)}
}

export async function creator(id:string){
  const d=o((await get(`/api/v2/creators/${encodeURIComponent(id)}`)).data);
  return{noteId:s(d.urlname,id),name:s(d.nickname,id),image:s(d.profileImageUrl??d.profile_image_url)||null,followers:n(d.followerCount??d.follower_count),following:n(d.followingCount??d.following_count),notes:n(d.noteCount??d.note_count)};
}

export type Article={key:string;title:string;url:string;published:string|null;likes:number;comments:number};
export async function articles(id:string,page:number){
  const p=await get(`/api/v2/creators/${encodeURIComponent(id)}/contents?kind=note&page=${page}`),d=o(p.data),rows=a(d.contents??d.notes).map((x:any)=>{
    const v=o(o(x).note??x),key=s(v.key);
    return key?{key,title:s(v.name??v.title,"無題の記事"),url:s(v.noteUrl??v.url,`${ROOT}/${id}/n/${key}`),published:s(v.publishAt??v.publish_at)||null,likes:n(v.likeCount??v.like_count),comments:n(v.commentCount??v.comment_count)}:null;
  }).filter(Boolean) as Article[];
  return{rows,last:Boolean(d.isLastPage??d.is_last_page)||rows.length===0};
}

function likePage(payload:any){
  const root=o(payload),data=root.data,box=Array.isArray(data)?{}:o(data),rows=Array.isArray(data)?data:a(box.likes??box.users??box.contents);
  const next=root.next_page??root.nextPage??box.next_page??box.nextPage;
  const explicitLast=box.isLastPage??box.is_last_page??root.isLastPage??root.is_last_page;
  const extra=o(box.extra_fields??root.extra_fields),total=n(root.total_count??root.totalCount??box.total_count??box.totalCount??extra.like_count,0);
  return{rows,last:explicitLast===true||rows.length===0||(next===null||next===false||next==="")&&explicitLast!==false,next,total};
}
function addLikes(all:Map<string,any>,rows:any[]){
  for(const x of rows){
    const r=o(x),u=o(r.user??r),urlname=s(u.urlname)||null,userKey=s(u.key)||(u.id!=null?String(u.id):urlname||"");
    if(!userKey)continue;
    all.set(userKey,{key:userKey,name:s(u.nickname??u.name,"noteユーザー"),url:urlname?`${ROOT}/${urlname}`:null,image:s(u.profileImageUrl??u.profile_image_url??u.user_profile_image_url)||null,at:s(r.created_at??r.createdAt)||null});
  }
}

export async function likes(key:string){
  const all=new Map<string,any>();let expected=0;
  for(let page=1;page<=100;page++){
    const p=await get(`/api/v3/notes/${encodeURIComponent(key)}/likes?page=${page}&per_page=100`),lp=likePage(p),before=all.size;
    expected=Math.max(expected,lp.total);addLikes(all,lp.rows);
    if((expected&&all.size>=expected)||lp.last||all.size===before)break;
    await sleep(35);
  }
  if(expected&&all.size<expected){
    for(let start=all.size;start<expected&&start<5000;start+=100){
      const p=await get(`/api/v3/notes/${encodeURIComponent(key)}/likes?size=100&start=${start}`),lp=likePage(p),before=all.size;
      expected=Math.max(expected,lp.total);addLikes(all,lp.rows);
      if(all.size===before||all.size>=expected)break;
      await sleep(35);
    }
  }
  return[...all.values()];
}

function commentText(v:any):string{
  if(typeof v==="string")return v;
  if(Array.isArray(v))return v.map(commentText).filter(Boolean).join("\n");
  const d=o(v);
  if(typeof d.value==="string")return d.value;
  const parts=[...a(d.children),...a(d.content)].map(commentText).filter(Boolean);
  return parts.join("\n");
}

function commentPage(p:any){
  const payload=p?.data,d=o(payload),rows=Array.isArray(payload)?payload:a(d.comments??d.note_comments??d.contents);
  const next=p?.next_page??p?.nextPage??d.next_page??d.nextPage;
  const last=next==null||next===false||next==="";
  return{rows,last};
}

function normalizeComment(r:any,parent:string|null=null){
  const row=o(r),u=o(row.user??row.author),urlname=s(u.urlname)||null,key=s(row.key??row.comment_key);
  return key?{
    key,
    parent:s(row.parent_key??row.parentKey)||parent,
    name:s(u.nickname??u.name,"noteユーザー"),
    url:urlname?`${ROOT}/${urlname}`:null,
    urlname,
    image:s(u.profileImageUrl??u.profile_image_url)||null,
    body:commentText(row.comment??row.body??row.text).replace(/\s+/g," ").trim().slice(0,1000),
    at:s(row.created_at??row.createdAt)||null,
    liked:Boolean(row.is_creator_liked??row.isCreatorLiked??row.is_liked_by_note_owner),
    likeCount:n(row.like_count??row.likeCount)
  }:null;
}

async function commentPages(articleKey:string,parentKey:string|null=null){
  const out:any[]=[];
  for(let page=1;page<=20;page++){
    const parent=parentKey?`&parent_key=${encodeURIComponent(parentKey)}`:"";
    const p=await get(`/api/v3/notes/${encodeURIComponent(articleKey)}/note_comments?order=oldest&per_page=100&page=${page}${parent}`),cp=commentPage(p);
    out.push(...cp.rows);
    if(cp.last)break;
    await sleep(60);
  }
  return out;
}

export async function comments(key:string){
  const all=new Map<string,any>(),roots=await commentPages(key);
  for(const raw of roots){
    const root=o(raw),base=normalizeComment(root,null);
    if(!base)continue;
    all.set(base.key,base);
    const latest=o(root.latest_creator_reply),embedded=normalizeComment(latest,base.key);
    if(embedded)all.set(embedded.key,embedded);
    const replyCount=n(root.reply_count??root.replyCount),known=embedded?1:0;
    if(replyCount>known){
      try{
        const replies=await commentPages(key,base.key);
        for(const item of replies){const row=normalizeComment(item,base.key);if(row&&row.key!==base.key)all.set(row.key,row)}
      }catch(e){console.error("comment replies",key,base.key,e)}
    }
  }
  return[...all.values()];
}

export async function followers(id:string,page:number){
  const p=await get(`/api/v2/creators/${encodeURIComponent(id)}/followers?page=${page}&per=20`),d=o(p.data);
  const rows=a(d.follows??d.followers??d.users??d.contents??p.data).map((x:any)=>{const u=o(o(x).user??x),urlname=s(u.urlname)||null;return{key:s(u.key)||(u.id!=null?String(u.id):urlname||"unknown"),name:s(u.nickname??u.name,"noteユーザー"),url:urlname?`${ROOT}/${urlname}`:null}});
  return{rows,last:Boolean(d.isLastPage??d.is_last_page)||rows.length===0};
}