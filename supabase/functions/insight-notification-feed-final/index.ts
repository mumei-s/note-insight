import { createClient } from "npm:@supabase/supabase-js@2.112.4";
const U=Deno.env.get("SUPABASE_URL")!,K=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db=createClient(U,K,{auth:{persistSession:false}}),ORIGIN="https://mumei-s.github.io";
const H={"Access-Control-Allow-Origin":ORIGIN,"Access-Control-Allow-Headers":"content-type,x-insight-token","Access-Control-Allow-Methods":"POST,OPTIONS","Content-Type":"application/json; charset=utf-8","Vary":"Origin"};
const out=(x:unknown,s=200)=>new Response(JSON.stringify(x),{status:s,headers:H});
async function sha(v:string){const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(v));return[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("")}
async function auth(req:Request){const raw=req.headers.get("X-Insight-Token")||"";if(!raw)throw new Error("INSIGHT_LOGIN_REQUIRED");const{data:s,error:sessionError}=await db.from("insight_member_sessions").select("id,application_id,expires_at,revoked_at").eq("token_hash",await sha(raw)).maybeSingle();if(sessionError)throw new Error("AUTH_CHECK_UNAVAILABLE");if(!s||s.revoked_at||Date.parse(s.expires_at)<=Date.now())throw new Error("INSIGHT_SESSION_INVALID");const{data:a,error:accountError}=await db.from("insight_access_applications").select("id,note_id,status").eq("id",s.application_id).maybeSingle();if(accountError)throw new Error("AUTH_CHECK_UNAVAILABLE");if(!a||a.status!=="active")throw new Error("INSIGHT_MEMBER_INACTIVE");const noteId=String(a.note_id||"").toLowerCase();return{id:String(a.id),scope:noteId==="ss_yr"?"owner":String(a.id),noteId}}
const txt=(v:any,d="")=>typeof v==="string"?v:d;
const ts=(r:any)=>Date.parse(r.occurred_at||r.captured_at||0)||0;
const canon=(v:any)=>String(v||"").replace(/\s+/g," ").replace(/\s(?:たった今|昨日|\d+\s*(?:秒|分|時間|日|週|か月|ヶ月|月|年)前)$/u,"").trim();
const urlKey=(v:any)=>String(v||"").split(/[?#]/)[0].replace(/\/$/,"").toLowerCase();
function jstDay(v:any){const ms=Date.parse(String(v||""));if(!Number.isFinite(ms))return"";return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(ms))}
function actorKey(r:any){return urlKey(r.actor_url)||String(r.actor_name||"").toLowerCase()}
function explicitManual(source:string){return /^note-notification-(?:bottom-up-v(?:2970|3)|reader-v\d+|manual-sync-v\d+|explicit-sync(?:-v\d+)?|continuous-sync-v\d+)$/.test(source)}
function useful(r:any){if(r?.meta?.noise_reason==="non-notification-api-capture")return false;const source=String(r?.meta?.source||""),type=String(r.notification_type||"other"),raw=canon(r.raw_text);if(source==="canonical-public-comments")return false;if(type==="capture_noise")return false;if(!raw)return false;if(explicitManual(source))return true;if(type==="other")return true;if(["badge","purchase_message","store_started","my_article_magazine_added","tip","membership_reaction","membership_join","membership_article_added","membership_article_updated","membership_magazine_added","membership_started","membership_plan","membership_board","membership_board_reply","creator_article_posted"].includes(type))return true;if(type==="follow"&&/フォロー|フォロワー/u.test(raw))return true;const action=/(?:さん(?:他\d+名)?(?:が|に)|あなた(?:の|を|に)|新しい(?:スキ|コメント|フォロワー)).{0,320}(?:スキしました|コメントしました|返信しました|フォローしました|フォローされました|追加しました|追加されました|仲間入りしました|参加しました|購入されました|購入しました|投稿しました|話題|高評価|ポイント)|(?:メンバーシップ|メンシプ|Member\s*Ship|掲示板).{0,200}(?:投稿しました|開始しました|始めました|はじめました|追加しました|追加されました|公開しました|参加しました|加入しました|入会しました|メンバーになりました)|(?:購入がありました|返信がありました|コメントがありました)|(?:チップ|サポート|支援|応援金).{0,180}(?:届きました|届いた|受け取りました|受け取った|もらいました|いただきました|贈られました|送られました)/iu.test(raw);return action}
function semanticKey(r:any){if(String(r.meta?.event_identity||"").startsWith("notice:"))return `notice|${r.meta.event_identity}`;if(r.meta?.client_signature)return `client|${r.meta.client_signature}`;if(r.meta?.client_signature&&/^(notice:|time:)/.test(String(r.meta?.event_identity||"")))return `precise|${r.meta.client_signature}`;const type=String(r.notification_type||"other"),actor=actorKey(r),target=urlKey(r.target_url)||urlKey(r.source_url),raw=canon(r.raw_text),time=ts(r),five=time?Math.floor(time/(5*60_000)):Math.floor((Date.parse(r.captured_at||0)||0)/(5*60_000));if(type==="follow"){const half=time?Math.floor(time/(30*60_000)):Math.floor((Date.parse(r.captured_at||0)||0)/(30*60_000));return`follow|${actor}|${half}`}if(type==="reply"||type==="comment")return`${type}|${actor}|${raw}|${five}`;const base=`${type==="store_started"?"other":type}|${actor}|${target}|${raw}|${five}`;if(type==="my_article_magazine_added"&&!target)return`${base}|${r.target_title||raw}`;if(type==="tip"&&!actor&&!target)return`${base}|${raw}`;if(["magazine_follow","magazine_article_added","my_article_magazine_added","magazine_join","membership_board","membership_board_reply","membership_reaction","membership_article_added","membership_article_updated","membership_magazine_added","membership_started","membership_plan","membership_join","purchase","tip","buzz","rating","points","quote","comment_like","like","creator_article_posted"].includes(type))return base;return`${base}|${raw}`}
function score(x:any){return(x?.meta?.body?32:0)+(x.actor_image_url?16:0)+(x.actor_url?8:0)+(x.actor_name?4:0)+(x.target_url?4:0)+(x.target_title?2:0)+(x.occurred_at?1:0)}
function mergeMeta(a:any,b:any){const am=a&&typeof a==="object"?a:{},bm=b&&typeof b==="object"?b:{},body=bm.body||bm.comment_body||am.body||am.comment_body||null;return{...am,...bm,...(body?{body}:{})}}
function dedupe(rows:any[]){const map=new Map<string,any>();for(const r of(rows||[]).filter(useful)){const source=String(r?.meta?.source||""),k=source==="canonical-public-comments"?String(r.id):semanticKey(r),prev=map.get(k);if(!prev){map.set(k,r);continue}const rich=score(r)>score(prev)?r:prev,other=rich===r?prev:r;map.set(k,{...other,...rich,meta:mergeMeta(other.meta,rich.meta),actor_image_url:rich.actor_image_url||other.actor_image_url||null,actor_name:rich.actor_name||other.actor_name||null,actor_url:rich.actor_url||other.actor_url||null,target_title:rich.target_title||other.target_title||null,target_url:rich.target_url||other.target_url||null,source_url:rich.source_url||other.source_url||null,occurred_at:rich.occurred_at||other.occurred_at||null,captured_at:(Date.parse(rich.captured_at)||0)>=(Date.parse(other.captured_at)||0)?rich.captured_at||other.captured_at||null:other.captured_at})}return[...map.values()].sort((a,b)=>(Date.parse(b.captured_at)||0)-(Date.parse(a.captured_at)||0)||ts(b)-ts(a)||String(b.id||" ").localeCompare(String(a.id||" ")))}
function ownerFromUrl(url:any){try{return(new URL(String(url||""))).pathname.split("/").filter(Boolean)[0]?.toLowerCase()||""}catch{return""}}
function articleOwner(url:any){try{const u=new URL(String(url||"")),m=u.pathname.match(/^\/([^/]+)\/n\//);return m?.[1]?.toLowerCase()||""}catch{return""}}
// Apply newly supported formats to saved rows immediately while repair persists them.
function currentFormat(r:any){
 const m=r.meta||{},a=(m.action_users||m.actionUsers||[])[0]||{};
 const text=String(m.body||r.raw_text||"");
 let type=r.notification_type;if(type==="other"&&m.kind==="user_badge")type="badge";if(type==="other"&&m.kind==="thank_you_message")type="purchase_message";if(type==="other"&&m.kind==="store_create")type="store_started";
 if(m.kind==="stock_photo"||((type==="other")&&/記事であなたの画像を使用しました/u.test(text)))type="image_used";
 else if((type==="quote"||m.kind==="embed_note")&&/あなたの記事\s*が\s*話題(?:です|になりました)/u.test(text))type="buzz";
 if(type==="other"&&/さん(?:他\d+名)?が.{0,500}?記事を(?:投稿|更新)しました/u.test(text))type="creator_article_posted";
 const image=String(a.user_profile_image_path||a.profile_image_url||a.profileImageUrl||a.avatarUrl||"");
 return{...r,notification_type:type,target_title:r.target_title||m.featured_content_name||null,actor_url:r.actor_url||a.url||a.profile_url||null,actor_name:r.actor_name||a.name||a.nickname||null,actor_image_url:r.actor_image_url||(/^https:\/\//.test(image)?image:null)};
}
function decorate(r:any,noteId:string){r=currentFormat(r);const article=articleOwner(r.target_url),targetOwner=/^https:\/\/note\.com\/[^/]+\/membership(?:[/?#]|$)/i.test(String(r.target_url||""))?ownerFromUrl(r.target_url):"",source=String(r?.meta?.source||""),selfArticle=source==="canonical-public-comments"||(article&&article===noteId),type=String(r.notification_type||""),structured=type==="other"&&String(r?.meta?.kind||"")==="qa_answer"?"question_answer":type;let contextLabel=structured==="question_answer"?"質問箱への回答":"",displayCategory=structured,articleContext=selfArticle?"self":article?"other":"unknown";if(type==="comment"){contextLabel=selfArticle?"自分の記事へのコメント":article?`@${article} の記事へのコメント`:"コメント"}else if(type==="reply"){displayCategory=selfArticle?"reply_self":article?"reply_other":"reply_unknown";contextLabel=selfArticle?"自分の記事のコメントへの返信":article?`@${article} の記事で自分のコメントへの返信`:"返信先の記事を確認待ち"}else if(type==="comment_like"){contextLabel=selfArticle?"自分の記事のコメントへの♡":article?`@${article} の記事コメントへの♡`:"コメントへの♡"}else if(type==="like"){contextLabel=selfArticle?"自分の記事へのスキ":article?`@${article} の記事へのスキ`:"記事へのスキ"}else if(type==="membership_reaction"){displayCategory=targetOwner===noteId?"membership_reaction_self":targetOwner?"membership_reaction_joined":"membership_reaction_unknown";contextLabel=displayCategory==="membership_reaction_self"?"自分のメンシプ反応":targetOwner?"参加中のメンシプ反応":"メンシプ所有者を確認待ち"}return{...r,comment_body:actualCommentBody(r)||null,comment_identity:commentIdentity(r),article_context:articleContext,article_owner:article||null,membership_owner:targetOwner||null,display_category:displayCategory,context_label:contextLabel}}
async function commentRows(scope:string,kind:string|null,limit:number,offset=0){let q=db.from("insight_public_comments").select("comment_key,article_key,actor_name,actor_url,actor_image_url,body,occurred_at,is_root",{count:"exact"}).eq("member_id",scope).eq("is_creator",false);if(kind==="comment"||kind==="reply")q=q.eq("is_root",kind==="comment");const{data,error,count}=await q.order("occurred_at",{ascending:false}).range(offset,offset+limit-1);if(error)throw error;const keys=[...new Set((data||[]).map((r:any)=>r.article_key).filter(Boolean))];const{data:arts}=keys.length?await db.from("insight_public_articles").select("article_key,title,url").eq("member_id",scope).in("article_key",keys):{data:[] as any[]};const am=new Map((arts||[]).map((a:any)=>[a.article_key,a]));const rows=(data||[]).map((r:any)=>{const a:any=am.get(r.article_key)||{},type=r.is_root?"comment":"reply";return{id:`public-comment:${r.comment_key}`,member_id:scope,notification_type:type,raw_text:`${r.actor_name||"noteユーザー"}さんが「${a.title||"記事"}」に${type==="reply"?"返信":"コメント"}しました`,actor_name:r.actor_name,actor_url:r.actor_url,actor_image_url:r.actor_image_url,target_title:a.title||null,target_url:a.url||null,occurred_at:r.occurred_at,captured_at:r.occurred_at,is_read:false,meta:{source:"canonical-public-comments",comment_key:r.comment_key,body:r.body}}});return{rows,total:Number(count||0)}}
async function status(scope:string,ids:string[]){const[n,s]=await Promise.all([db.from("insight_notifications").select("captured_at").in("member_id",ids).order("captured_at",{ascending:false}).limit(1).maybeSingle(),db.from("insight_notification_sync_runs").select("created_at,inserted_count,received_count,source").in("member_id",ids).eq("source","browser-notification-stable-v3-confirmed").order("created_at",{ascending:false}).limit(1).maybeSingle()]);const last=Date.parse(String(n.data?.captured_at||""))||0,source=String(s.data?.source||""),count=Number(s.data?.inserted_count||0);return{lastUpdatedAt:last?new Date(last).toISOString():null,lastSyncAt:s.data?.created_at||null,lastSyncSource:source||null,lastSyncInserted:count,lastSyncConfirmed:source==="browser-notification-stable-v3-confirmed"?count:0,lastSyncReceived:Number(s.data?.received_count||0)}}
// The service-only RPC performs exact classification/counting and returns a bounded page.
// Do not fall back to a full notification scan when the migration is missing or unavailable.
async function feedPage(m:any,b:any){
 const pageValue=Math.floor(Number(b.page)||1),sizeValue=Math.floor(Number(b.pageSize)||100);
 const page=Number.isFinite(pageValue)?Math.min(1_000_000,Math.max(1,pageValue)):1;
 const pageSize=Number.isFinite(sizeValue)?Math.min(100,Math.max(20,sizeValue)):100;
 const{data,error}=await db.rpc("insight_notification_feed_page",{
  p_member_ids:scopedIds(m),p_scope:m.scope,p_note_id:m.noteId,
  p_kind:txt(b.kind,"all"),p_day:/^\d{4}-\d{2}-\d{2}$/.test(txt(b.day))?txt(b.day):"",
  p_handling_status:["pending","completed"].includes(txt(b.handlingStatus))?txt(b.handlingStatus):"all",
  p_page:page,p_page_size:pageSize,p_preview:Boolean(b.includeCategoryPreview)
 });
 if(error)throw new Error("NOTIFICATION_FEED_READ_FAILED:"+String(error.code||error.message||"RPC"));
 if(!data||data.ok!==true||!Array.isArray(data.rows))throw new Error("NOTIFICATION_FEED_READ_INVALID");
 return data;
}
function baseKind(kind:string){if(kind==="reply_self"||kind==="reply_other"||kind==="reply_unknown")return"reply";if(kind==="membership_reaction_self"||kind==="membership_reaction_joined"||kind==="membership_reaction_unknown")return"membership_reaction";return kind==="all"?null:kind}
function filterDisplay(rows:any[],kind:string,noteId:string){const decorated=rows.map(r=>decorate(r,noteId));if(kind==="all")return decorated;if(kind==="reply_self"||kind==="reply_other"||kind==="reply_unknown"||kind==="membership_reaction_self"||kind==="membership_reaction_joined"||kind==="membership_reaction_unknown")return decorated.filter(r=>String(r.display_category||"")===kind);return decorated}
const completionKey=(r:any)=>/^notice:\d+$/.test(String(r.meta?.event_identity||""))?String(r.meta.event_identity):`row:${r.id}`;
const scopedIds=(m:any)=>m.scope===m.id?[m.id]:[m.scope,m.id];
async function notificationRow(m:any,id:unknown){if(!/^\d+$/.test(String(id)))throw new Error("INVALID_NOTIFICATION");const{data,error}=await db.from("insight_notifications").select("*").in("member_id",scopedIds(m)).eq("id",String(id)).maybeSingle();if(error)throw error;if(!data)throw new Error("NOTIFICATION_NOT_FOUND");return data}
async function notificationCompletion(m:any,b:any){const row=await notificationRow(m,b.id);if(typeof b.completed!=="boolean")throw new Error("INVALID_COMPLETION");const key={member_id:m.scope,creator_urlname:m.noteId,item_type:"notification",item_key:completionKey(row)};const result=b.completed?await db.from("insight_manual_completions").upsert({...key,completed_at:new Date().toISOString()},{onConflict:"member_id,creator_urlname,item_type,item_key"}):await db.from("insight_manual_completions").delete().match(key);if(result.error)throw result.error;return{ok:true,completed:b.completed}}
async function completionKeys(m:any,rows:any[]){
 const requested=[...new Set(rows.map(completionKey))],keys=new Set<string>();
 // Recent contains at most 300 rows. Never page through unrelated completion history.
 for(let offset=0;offset<requested.length;offset+=100){
  const{data,error}=await db.from("insight_manual_completions").select("item_key").eq("member_id",m.scope).eq("creator_urlname",m.noteId).eq("item_type","notification").in("item_key",requested.slice(offset,offset+100));
  if(error)throw error;for(const r of data||[])keys.add(r.item_key);
 }
 return keys;
}
function favoriteCreator(r:any){try{const u=new URL(String(r.actor_url||"")),id=u.pathname.split("/").filter(Boolean)[0]||"";return u.hostname==="note.com"&&/^https?:$/.test(u.protocol)&&/^[A-Za-z0-9_-]+$/.test(id)&&!["m","n","messages","membership","settings"].includes(id)?{id:id.toLowerCase(),url:`https://note.com/${id.toLowerCase()}`}:null}catch{return null}}
async function favoriteRows(m:any){const{data,error}=await db.from("insight_favorite_creators").select("creator_key,actor_url").eq("member_id",m.scope);if(error)throw error;return data||[]}
function favoriteCandidateFilter(ids:string[]){
 const alternatives=ids.map(id=>id.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")).join("|");
 // JS lowercasing also maps the Kelvin sign to ASCII k; database collations may not.
 const keyAlternatives=alternatives.replace(/k/g,"[kK]");
 const quote=(value:string)=>`"${value.replace(/\\/g,"\\\\").replace(/"/g,'\\"')}"`;
 // A superset, not a replacement for favoriteCreator: URL normalizes host case,
 // credentials, ports, backslashes and dot segments. Match any whole path segment.
 // It also removes embedded TAB/LF/CR, so retain those unusual URLs for JS validation.
 return`creator_key.imatch.${quote(`^(${keyAlternatives})$`)},actor_url.imatch.${quote(`[/\\\\](${alternatives})([/\\\\?#]|[[:space:][:cntrl:]]*$)`)},actor_url.match.${quote("[\\t\\r\\n]")}`;
}
async function recentFavoriteRows(m:any,rows:any[]){
 const ids=[...new Set(rows.map(r=>favoriteCreator(currentFormat(r))?.id).filter((id):id is string=>Boolean(id)))],favorites:any[]=[];
 // Bound both creator count and encoded filter length; long legacy IDs must not
 // turn a 300-row recent response into an oversized PostgREST GET request.
 for(let offset=0;offset<ids.length;){
  const batch=[ids[offset++]];
  while(offset<ids.length&&batch.length<50&&encodeURIComponent(favoriteCandidateFilter([...batch,ids[offset]])).length<=6000)batch.push(ids[offset++]);
  const requested=new Set(batch),{data,error}=await db.from("insight_favorite_creators").select("creator_key,actor_url").eq("member_id",m.scope).or(favoriteCandidateFilter(batch));
  if(error)throw error;
  // A candidate may match another path segment or a key overridden by its URL.
  // Keep all aliases for this batch in their returned order, exactly as before.
  for(const f of data||[])if(requested.has(favoriteCreator(f)?.id||String(f.creator_key).toLowerCase()))favorites.push(f);
 }
 return favorites;
}
function decorateHandling(rows:any[],m:any,completed:Set<string>,favorites:any[]){const byId=new Map<string,string>();for(const f of favorites){const c=favoriteCreator(f);byId.set(c?.id||String(f.creator_key).toLowerCase(),String(f.creator_key))}return rows.map(r=>{const row=decorate(r,m.noteId),creator=favoriteCreator(row);return{...row,confirmed:completed.has(completionKey(r)),favorite:!!creator&&byId.has(creator.id),favorite_creator_key:creator?(byId.get(creator.id)||creator.id):null}})}
async function notificationFavorite(m:any,b:any){
 const row=decorate(await notificationRow(m,b.id),m.noteId),creator=favoriteCreator(row);if(!creator)throw new Error("CREATOR_NOT_FOUND");if(typeof b.favorite!=="boolean")throw new Error("INVALID_FAVORITE");
 const existing=await favoriteRows(m),matched=existing.filter((r:any)=>favoriteCreator(r)?.id===creator.id||String(r.creator_key).toLowerCase()===creator.id),creatorKey=String(matched[0]?.creator_key||creator.id);
 if(b.favorite){const{error}=await db.from("insight_favorite_creators").upsert({member_id:m.scope,creator_key:creatorKey,actor_name:row.actor_name||creator.id,actor_url:creator.url,actor_image_url:row.actor_image_url||null},{onConflict:"member_id,creator_key"});if(error)throw error}
 else{const{error}=await db.from("insight_favorite_creators").delete().eq("member_id",m.scope).in("creator_key",matched.length?matched.map((r:any)=>r.creator_key):[creatorKey]);if(error)throw error}
 return{ok:true,favorite:b.favorite,creatorKey,actorUrl:creator.url};
}
function handlingMatch(r:any,status:string){return status==="completed"?Boolean(r.confirmed):status==="pending"?!r.confirmed:true}
function selectHandling(rows:any[],kind:string,day:string,status:string){const dated=day?rows.filter(r=>jstDay(r.occurred_at||r.captured_at)===day):rows,category=kind==="all"?dated:dated.filter(r=>r.display_category===kind),statusCounts={all:category.length,pending:category.filter(r=>!r.confirmed).length,completed:category.filter(r=>r.confirmed).length},handled=dated.filter(r=>handlingMatch(r,status));return{dated:handled,statusCounts,selected:kind==="all"?handled:handled.filter(r=>r.display_category===kind)}}
function commentIdentity(r:any){
 const candidates:any[]=[];
 for(const raw of [r.target_url,r.meta?.all_area_url,r.meta?.featured_area_url]){try{const u=new URL(String(raw||"")),match=u.pathname.match(/^\/([A-Za-z0-9_-]+)\/n\/(n[A-Za-z0-9]+)$/),key=u.searchParams.get("c");if(u.protocol==="https:"&&u.hostname==="note.com"&&!u.port&&!u.username&&!u.password&&match&&key&&/^nc[A-Za-z0-9]+$/.test(key))candidates.push({articleKey:match[2],commentKey:key,url:`https://note.com/${match[1]}/n/${match[2]}?scrollpos=comment&c=${key}`})}catch{}}
 const meta=r.meta||{},articleKey=String(meta.article_key||meta.articleKey||""),commentKey=String(meta.comment_key||meta.commentKey||"");
 if(/^(exact-comment-id|canonical-public-comments|comment-refresh)$/.test(String(meta.comment_body_source||meta.source||""))&&/^n[A-Za-z0-9]+$/.test(articleKey)&&/^nc[A-Za-z0-9]+$/.test(commentKey))candidates.push({articleKey,commentKey,url:null});
 const first=candidates[0];if(!first||candidates.some(x=>x.articleKey!==first.articleKey||x.commentKey!==first.commentKey))return null;
 return first;
}
function validConversation(value:any,identity:any){
 if(!value||value.articleKey!==identity.articleKey||!Array.isArray(value.messages)||!value.messages.length)return false;
 const root=value.threadKey;if(root!==null&&!/^nc[A-Za-z0-9]+$/.test(String(root||"")))return false;
 return value.messages.some((r:any)=>r.commentKey===identity.commentKey&&r.body)&&value.messages.every((r:any)=>/^nc[A-Za-z0-9]+$/.test(String(r.commentKey))&&typeof r.body==="string"&&r.body.trim()&&(root===null?r.commentKey===identity.commentKey&&r.parentKey===null:r.commentKey===root?r.parentKey===null:r.parentKey===root));
}

function retainedCommentText(value:any){return typeof value==="string"&&value.trim()&&!/^(?:削除済み|削除されたコメント|このコメントは削除されました[。.]?|\[deleted\]|\[removed\])$/i.test(value.trim())?value:""}
function actualCommentBody(r:any){for(const value of [r.meta?.comment_body,r.meta?.reply_body,r.meta?.source==="canonical-public-comments"?r.meta?.body:""]){const body=retainedCommentText(value);if(body)return body}return ""}

function commentText(v:any):string{if(typeof v==="string")return v;if(Array.isArray(v))return v.map(commentText).join("");if(!v||typeof v!=="object")return"";if(typeof v.value==="string")return v.value;if(typeof v.text==="string")return v.text;return commentText(v.children||v.content||[])}
function threadMessage(r:any,parentKey:string|null,noteId:string){
 const user=r.user||r.author||{},actor=String(user.urlname||r.actor_url?.match(/^https:\/\/note\.com\/([^/?#]+)\/?$/)?.[1]||"");
 return{commentKey:String(r.key||r.comment_key||""),parentKey,body:retainedCommentText(commentText(r.comment??r.body??r.text).trim()),author:user.nickname||user.name||r.actor_name||null,authorUrl:actor?`https://note.com/${actor}`:null,occurredAt:r.created_at||r.createdAt||r.occurred_at||null,isSelf:!!actor&&actor.toLowerCase()===noteId.toLowerCase()};
}
function mergeConversation(old:any,next:any){
 // A late body-only lookup must never downgrade a concurrently saved proven thread.
 if(old?.articleKey===next.articleKey&&old.threadKey&&next.threadKey===null)return old;
 if(!old||old.articleKey!==next.articleKey||old.threadKey!==next.threadKey)old={messages:[],complete:false};
 const map=new Map<string,any>();for(const r of [...(old.messages||[]),...(next.messages||[])]){const prior=map.get(r.commentKey);if(r.commentKey&&retainedCommentText(r.body))map.set(r.commentKey,{...prior,...r,body:prior?.body||r.body})}
 return{...next,complete:Boolean(old.complete||next.complete),messages:[...map.values()].sort((a,b)=>String(a.occurredAt||"").localeCompare(String(b.occurredAt||""))||a.commentKey.localeCompare(b.commentKey))};
}
const commentPageCache=new Map<string,{at:number;result:{rows:any[];next:any}}>();
// Exact-ID lookup is bounded across the entire request, not per root thread.
async function fetchExactComment(articleKey:string,commentKey:string,noteId:string){
 const deadline=Date.now()+20000,roots:any[]=[];let requests=0;
 const page=async(parent:string|null,p:number)=>{if(++requests>24)throw new Error("COMMENT_LOOKUP_PAUSED");const cacheKey=`${articleKey}:${parent||"roots"}:${p}`,cached=commentPageCache.get(cacheKey);if(cached&&Date.now()-cached.at<120000)return cached.result;const remaining=deadline-Date.now();if(remaining<=0)throw new Error("COMMENT_LOOKUP_PAUSED");const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),Math.min(remaining,5000));try{const url=`https://note.com/api/v3/notes/${encodeURIComponent(articleKey)}/note_comments?order=oldest&per_page=100&page=${p}${parent?`&parent_key=${encodeURIComponent(parent)}`:""}`,response=await fetch(url,{headers:{Accept:"application/json"},signal:controller.signal});if(!response.ok)throw new Error(`NOTE_PUBLIC_${response.status}`);const payload=await response.json(),data=payload.data,rows=Array.isArray(data)?data:data?.comments||data?.note_comments||[];const result={rows,next:payload.next_page??data?.next_page};commentPageCache.set(cacheKey,{at:Date.now(),result});if(commentPageCache.size>24)commentPageCache.delete(commentPageCache.keys().next().value!);return result}finally{clearTimeout(timer)}};
 const key=(r:any)=>String(r?.key||r?.comment_key||""),nested=(r:any)=>[r.latest_creator_reply,...(Array.isArray(r.replies)?r.replies:[])].filter(Boolean);
 const collect=async(root:any,initial:any[]=[])=>{
  const threadKey=key(root),messages=[threadMessage(root,null,noteId),...nested(root).map(r=>threadMessage(r,threadKey,noteId)),...initial.map(r=>threadMessage(r,threadKey,noteId))];let complete=(root.reply_count??root.replyCount)===0;
  try{if(!complete)for(let p=1;p<=20;p++){const result=await page(threadKey,p);messages.push(...result.rows.map((r:any)=>threadMessage(r,threadKey,noteId)));if(!result.next){complete=true;break}}}catch{/* Keep acquired exact bodies even if the rest of the thread is unavailable. */}
  return mergeConversation(null,{articleKey,threadKey,complete,messages:messages.filter(r=>r.body&&/^nc[A-Za-z0-9]+$/.test(r.commentKey))});
 };
 for(let p=1;p<=20;p++){const result=await page(null,p);roots.push(...result.rows);for(const root of result.rows)if(key(root)===commentKey||nested(root).some(r=>key(r)===commentKey))return collect(root);if(!result.next)break}
 for(const root of roots){if(!Number(root.reply_count||root.replyCount))continue;for(let p=1;p<=20;p++){const result=await page(key(root),p);if(result.rows.some((r:any)=>key(r)===commentKey))return collect(root,result.rows);if(!result.next)break}}
 return null;
}
async function notificationComment(m:any,b:any){
 const row=await notificationRow(m,b.id),identity=commentIdentity(row),saved=actualCommentBody(row);
 if(!identity)return{ok:true,status:"missing_id",body:saved||null,persisted:!!saved,conversation:null};
 if(saved&&row.meta?.comment_key&&row.meta.comment_key!==identity.commentKey)return{ok:true,status:"identity_conflict",body:null,...identity,conversation:null,persisted:false};
 const previous=row.meta?.comment_conversation;
 if(b.includeConversation!==true&&b.refreshConversation!==true&&validConversation(previous,identity))return{ok:true,status:"saved",body:saved||previous.messages.find((r:any)=>r.commentKey===identity.commentKey).body,author:row.meta?.comment_author||null,...identity,conversation:previous,persisted:true};
 const{data:local,error}=await db.from("insight_public_comments").select("body,actor_name,actor_url,comment_key,parent_key,occurred_at,is_root").eq("member_id",m.scope).eq("article_key",identity.articleKey).eq("comment_key",identity.commentKey).maybeSingle();if(error)throw error;
 let body=saved||retainedCommentText(local?.body),author=row.meta?.comment_author||local?.actor_name||null,conversation:any=null;
 if(local?.body){const threadKey=local.parent_key||(local.is_root?local.comment_key:null);if(threadKey&&/^nc[A-Za-z0-9]+$/.test(threadKey)){const{data:related,error:re}=await db.from("insight_public_comments").select("body,actor_name,actor_url,comment_key,parent_key,occurred_at").eq("member_id",m.scope).eq("article_key",identity.articleKey).or(`comment_key.eq.${threadKey},parent_key.eq.${threadKey}`).limit(500);if(re)throw re;conversation={articleKey:identity.articleKey,threadKey,complete:false,messages:[...(related||[]),local].filter((r:any)=>r.body).map((r:any)=>threadMessage(r,r.parent_key||null,m.noteId))}}}
 if(!conversation||b.includeConversation===true||b.refreshConversation===true){try{const live=await fetchExactComment(identity.articleKey,identity.commentKey,m.noteId);if(live&&(!conversation?.threadKey||conversation.threadKey===live.threadKey))conversation=mergeConversation(conversation,live)}catch{/* A source failure must not erase an already archived body. */}}
 const hit=conversation?.messages?.find((r:any)=>r.commentKey===identity.commentKey);body=body||hit?.body||"";author=author||hit?.author||null;
 if(!body)return{ok:true,status:"unavailable",body:null,...identity,conversation:null,persisted:false};
 // A deleted root can have surviving replies. Keep its archived exact body in that proven thread.
 if(conversation&&!conversation.messages.some((r:any)=>r.commentKey===identity.commentKey)&&conversation.threadKey===identity.commentKey){conversation=mergeConversation(conversation,{...conversation,messages:[{commentKey:identity.commentKey,parentKey:null,body,author,authorUrl:local?.actor_url||row.meta?.comment_author_url||null,occurredAt:local?.occurred_at||row.occurred_at||null,isSelf:String(local?.actor_url||row.meta?.comment_author_url||"").replace(/\/$/,"").toLowerCase()===`https://note.com/${m.noteId}`.toLowerCase()}]})}
 if(conversation&&!conversation.messages.some((r:any)=>r.commentKey===identity.commentKey))conversation=null;
 if(!conversation&&validConversation(previous,identity))conversation=previous;
 if(!conversation)conversation={articleKey:identity.articleKey,threadKey:null,complete:false,messages:[{commentKey:identity.commentKey,parentKey:null,body,author,authorUrl:local?.actor_url||row.meta?.comment_author_url||null,occurredAt:local?.occurred_at||row.occurred_at||null,isSelf:String(local?.actor_url||row.meta?.comment_author_url||"").replace(/\/$/,"").toLowerCase()===`https://note.com/${m.noteId}`.toLowerCase()}]};
 // Compare-and-swap protects concurrent metadata / archive updates. Never replace a captured body with emptiness.
 for(let attempt=0;attempt<3;attempt++){
  const current=attempt?await notificationRow(m,b.id):row,currentIdentity=commentIdentity(current);if(!currentIdentity||currentIdentity.articleKey!==identity.articleKey||currentIdentity.commentKey!==identity.commentKey)throw new Error("COMMENT_IDENTITY_CHANGED");
  if(validConversation(current.meta?.comment_conversation,identity)&&current.meta.comment_conversation.threadKey&&conversation.threadKey&&current.meta.comment_conversation.threadKey!==conversation.threadKey)throw new Error("COMMENT_THREAD_CONFLICT");
  const retained=actualCommentBody(current)||body,merged=mergeConversation(validConversation(current.meta?.comment_conversation,identity)?current.meta.comment_conversation:null,conversation),meta={...current.meta,comment_body:retained,article_key:identity.articleKey,comment_key:identity.commentKey,comment_author:current.meta?.comment_author||author,comment_author_url:current.meta?.comment_author_url||local?.actor_url||hit?.authorUrl||null,comment_body_source:"exact-comment-id",comment_conversation:merged,comment_resolved_at:new Date().toISOString(),comment_archive_revision:crypto.randomUUID()};
  let query=db.from("insight_notifications").update({meta}).eq("id",row.id).in("member_id",scopedIds(m));query=current.captured_at==null?query.is("captured_at",null):query.eq("captured_at",current.captured_at);query=current.meta?.comment_archive_revision==null?query.is("meta->>comment_archive_revision",null):query.eq("meta->>comment_archive_revision",current.meta.comment_archive_revision);
  const{data:updated,error:save}=await query.select("id");if(save)throw save;if(updated?.length)return{ok:true,status:saved?"saved":"resolved",body:retained,author:meta.comment_author,...identity,conversation:merged,persisted:true};
 }
 throw new Error("COMMENT_SAVE_CONFLICT");
}

async function recentRows(m:any,b:any){
 const ids=m.scope===m.id?[m.id]:[m.scope,m.id],since=typeof b.since==="string"&&Number.isFinite(Date.parse(b.since))?new Date(b.since).toISOString():"";
 let q=db.from("insight_notifications").select("id,member_id,notification_type,raw_text,actor_name,actor_url,actor_image_url,target_title,target_url,source_url,occurred_at,captured_at,is_read,meta").in("member_id",ids).not("notification_type","in","(like,follow,comment,capture_noise)");
 if(since)q=q.or(`captured_at.gte.${since},meta->>last_reclassified_at.gte.${since}`);
 const{data,error}=await q.order("captured_at",{ascending:false}).order("id").limit(300);if(error)throw error;
 const selected=dedupe(data||[]),[completed,favorites]=await Promise.all([completionKeys(m,selected),recentFavoriteRows(m,selected)]),rows=decorateHandling(selected,m,completed,favorites);
 const watermark=(data||[]).reduce((at,r)=>[at,String(r.captured_at||""),String(r.meta?.last_reclassified_at||"")].sort().at(-1)!,since);
 return{ok:true,noteId:m.noteId,rows,watermark,partial:true,feedAt:new Date().toISOString()};
}
Deno.serve(async req=>{if(req.method==="OPTIONS")return new Response("ok",{headers:H});try{
 if(req.method!=="POST")return out({ok:false,error:"METHOD_NOT_ALLOWED"},405);
 const m=await auth(req),b=await req.json().catch(()=>({}));
 if(b.action==="completion")return out(await notificationCompletion(m,b));
 if(b.action==="favorite_toggle")return out(await notificationFavorite(m,b));
 if(b.action==="comment_detail")return out(await notificationComment(m,b));
 if(b.action==="recent")return out(await recentRows(m,b));
 return out(await feedPage(m,b));
 }catch(e){const msg=e instanceof Error?e.message:String(e);console.error(msg);return out({ok:false,error:msg},/LOGIN|SESSION|INACTIVE/.test(msg)?401:500)}});
