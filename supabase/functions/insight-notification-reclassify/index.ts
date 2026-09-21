import { createClient } from "npm:@supabase/supabase-js@2.112.4";
const U=Deno.env.get("SUPABASE_URL")!,K=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db=createClient(U,K,{auth:{persistSession:false}}),ORIGIN="https://mumei-s.github.io";
const H={"Access-Control-Allow-Origin":ORIGIN,"Access-Control-Allow-Headers":"content-type,x-insight-token","Access-Control-Allow-Methods":"POST,OPTIONS","Content-Type":"application/json; charset=utf-8","Vary":"Origin"};
const out=(x:unknown,s=200)=>new Response(JSON.stringify(x),{status:s,headers:H});
async function sha(v:string){const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(v));return[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("")}
async function auth(req:Request){const raw=req.headers.get("X-Insight-Token")||"";if(!raw)throw new Error("INSIGHT_LOGIN_REQUIRED");const{data:s}=await db.from("insight_member_sessions").select("id,application_id,expires_at,revoked_at").eq("token_hash",await sha(raw)).maybeSingle();if(!s||s.revoked_at||Date.parse(s.expires_at)<=Date.now())throw new Error("INSIGHT_SESSION_INVALID");const{data:a}=await db.from("insight_access_applications").select("id,note_id,status").eq("id",s.application_id).maybeSingle();if(!a||a.status!=="active")throw new Error("INSIGHT_MEMBER_INACTIVE");const noteId=String(a.note_id||"").toLowerCase();return{id:String(a.id),scope:noteId==="ss_yr"?"owner":String(a.id),noteId}}
const clean=(v:unknown)=>String(v||"").replace(/\s+/g," ").trim();
const actionText=(v:unknown)=>clean(v).replace(/(?:たった今|昨日|\d+\s*(?:秒|分|時間|日|週|か月|ヶ月|月|年)前)/gu," ").replace(/\s+/g," ").trim();
const KIND_TYPES:Record<string,string>={
 like:"like",follow:"follow",super_follow:"follow",note_comment:"comment",note_comment_like:"comment_like",note_comment_reply:"reply",
 board_like_post:"membership_reaction",board_like_comment:"membership_reaction",board_reply_comment:"membership_board_reply",board_reply_post:"membership_board_reply",board_new_post:"membership_board",
 circle_plan_join:"membership_join",circle_publish:"membership_started",circle_plan_publish:"membership_plan",circle_plan_magazine_note_add:"magazine_article_added",
 magazine_follow:"magazine_follow",magazine_note_add:"my_article_magazine_added",magazine_note_add_follow:"magazine_article_added",jm_magazine_add:"magazine_article_added",jm_magazine_joined:"magazine_join",
 embed_note:"quote",purchase_note_update:"purchased_article_updated",qa_answer:"question_answer",note_publish:"creator_article_posted",purchase:"purchase",purchase_note:"purchase",note_purchase:"purchase",note_rating:"rating",note_recommend:"rating",support:"tip",tip:"tip"
};
function astText(v:any):string{if(typeof v==="string")return v;if(Array.isArray(v))return v.map(astText).join("");if(!v||typeof v!=="object")return "";return typeof v.value==="string"?v.value:typeof v.text==="string"?v.text:astText(v.children||v.content||[])}
function structuredType(meta:any,target:string|null){const candidates=[meta?.kind];for(const raw of [meta?.all_area_url,meta?.featured_area_url,target]){try{candidates.push(new URL(String(raw)).searchParams.get("kind"))}catch{}}for(const kind of candidates)if(kind&&KIND_TYPES[String(kind)])return KIND_TYPES[String(kind)];return null}

function classify(text:string,targetUrl:string|null,meta:any={}){
  const known=structuredType(meta,targetUrl);if(known)return known;
  text=[meta.body,astText(meta.body_ast),text].filter(Boolean).join(" ");
  const t=actionText(text),target=targetUrl||"";
  if(/^あなたの記事[がを].{0,500}(?:追加されました|追加しました)/u.test(t))return "my_article_magazine_added";
  if(/[?&]kind=board_reply_(?:comment|post)(?:&|$)/i.test(target))return "membership_board_reply";
  if(/さん(?:他\d+名)?があなたのコメントに返信しました/u.test(t))return /kind=board_|\/membership\//.test(target)?"membership_board_reply":"reply";
  if(/^(?:.{0,160}さんが)?あなたのメンバーシップ.{0,100}(?:参加|加入|入会|メンバーになりました)/u.test(t))return "membership_join";
  if(/[?&]kind=board_reply_comment(?:&|$)/i.test(target))return"membership_board_reply";
  if(/[?&]kind=(?:board_like_comment|board_like_post)(?:&|$)/i.test(target))return"membership_reaction";
  if(/[?&]kind=circle_plan_join(?:&|$)/i.test(target))return"membership_join";
  if(/さんが質問箱を(?:始め|はじめ)ました/u.test(t))return"question_box_started";
  const membershipTarget=/\/membership(?:[/?#]|$)|\/memberships?\//i.test(target);
  const membershipContext=membershipTarget||/(?:メンバーシップ|メンシプ|掲示板|メンバー特典|Member\s*Ship)/iu.test(t);
  if(membershipContext&&/(?:スキ|リアクション|いいね|反応)/.test(t)&&/(?:しました|されました|がありました|ありました|付きました|つきました)/.test(t))return"membership_reaction";
  if(/(?:あなたのコメント.{0,80}(?:に|へ).{0,20}スキ(?:しました|されました)|コメントにスキしました|コメントをスキしました)/.test(t))return"comment_like";
  if(/(?:あなたの記事にスキしました|あなたの投稿にスキしました|「[^」]{0,500}」にスキしました|新しいスキが\d*件?増えました|さん他?\d*名?があなたの記事にスキしました)/.test(t))return"like";
  if(/(?:あなたのコメント.{0,80}返信|コメントへの返信|コメントに返信しました|返信がありました)/.test(t)&&(/\/membership\/boards\//.test(target)||/[?&]kind=board_reply_comment(?:&|$)/.test(target)))return"membership_board_reply";
  if(/(?:あなたのコメント.{0,80}返信|コメントへの返信|コメントに返信しました|返信がありました)/.test(t))return"reply";
  if(/(?:あなたの記事.{0,80}コメントしました|新しいコメントが\d*件?増えました|コメントがありました)/.test(t))return"comment";
  if(/(?:メンバーシップ|メンシプ|Member\s*Ship).{0,100}掲示板.{0,50}投稿しました/iu.test(t))return"membership_board";
  if(/(?:メンバーシップ|メンシプ|Member\s*Ship)を(?:はじめ|始め|開始し)ました/iu.test(t))return"membership_started";
  if(/(?:メンバーシップ|メンシプ|Member\s*Ship).{0,100}(?:新しいプラン.{0,30}(?:追加|公開)しました|新プラン.{0,30}(?:追加|公開)しました|プラン.{0,30}(?:追加|公開)しました)/iu.test(t))return"membership_plan";
  const joinAction=/(?:参加しました|参加されました|加入しました|加入されました|入会しました|入会されました|メンバーになりました|メンバーが増えました|新しいメンバー)/.test(t);
  if((membershipContext&&joinAction)||/(?:あなたの)?(?:メンバーシップ|メンシプ|Member\s*Ship).{0,180}(?:参加|加入|入会|メンバーにな|新しいメンバー)/iu.test(t)||/さん(?:他\d+名)?が.{0,180}(?:メンバーシップ|メンシプ|Member\s*Ship|メンバー).{0,120}(?:参加|加入|入会|なりました)/iu.test(t)||/(?:参加|加入|入会).{0,100}(?:メンバーシップ|メンシプ|Member\s*Ship)/iu.test(t))return"membership_join";
  if(/(?:運営メンバーに仲間入りしました|マガジン.{0,80}参加しました|共同マガジン.{0,80}仲間入りしました)/.test(t))return"magazine_join";
  if(/(?:あなたの記事が.{0,260}に追加されました|あなたの記事を.{0,180}マガジン.{0,80}追加)/.test(t))return"my_article_magazine_added";
  if((/\/m\//.test(target)&&/をフォローしました/.test(t))||/マガジン.{0,120}をフォローしました/.test(t))return"magazine_follow";
  if(/(?:あなたをフォローしました|フォローされました|新しいフォロワー(?:が|です|のお知らせ)?|さん(?:他\d+名)?が(?:あなたを)?フォローしました)/.test(t))return"follow";
  if(/(?:に新しい記事を\d*本?追加しました|に記事を追加しました|マガジン.{0,80}(?:記事|新しい記事).{0,30}追加しました|メンバー特典マガジンに記事)/.test(t))return"magazine_article_added";
  if(/(?:さんが(?:新しい)?記事を投稿しました|さんが(?:[^。]{0,120}メンバー特典マガジンの)?記事を更新しました)/.test(t))return"creator_article_posted";
  if(/(?:あなたの記事.{0,20}話題です|あなたの記事.{0,20}話題になりました|あなたの記事\s*が話題です)/.test(t))return"buzz";
  if(/(?:あなたの記事が購入されました|あなたの有料記事が購入されました|購入がありました|さん(?:他\d+名)?が(?:あなたの)?(?:有料)?記事を購入しました[！!]?)/.test(t))return"purchase";
  if(t.length<350&&/(?:さん(?:から|より).{0,30}(?:チップ|サポート).{0,80}(?:届きました|届いた|届き|受け取りました|受け取った|受け取り|もらいました|もらい|いただきました|いただき|贈られました|送られました)|(?:チップ|サポート).{0,100}(?:が届きました|が届いた|を受け取りました|を受け取った|をもらいました|をいただきました|を贈られました|を送られました)|(?:支援|応援金).{0,100}(?:届きました|受け取りました|もらいました|いただきました))/.test(t))return"tip";
  if(/(?:あなたの記事.{0,40}引用され|あなたの記事.{0,40}紹介され)/.test(t))return"quote";
  if(/(?:あなたの記事を高評価しました|.{0,180}さん(?:他\d+名)?が(?:あなたの)?記事を高評価しました)/.test(t))return"rating";
  if(/(?:あなたにポイント|ポイントが付与|ポイントを獲得)/.test(t))return"points";
  return"other";
}

function noise(text:string,targetUrl:string|null,actorName:string|null,source:string){const t=clean(text);if(targetUrl)return false;if(/(?:スキ|いいね|コメント|返信|フォロー|フォロワー|追加しました|追加されました|参加しました|加入しました|購入|チップ|サポート|メンバーシップ|メンシプ|掲示板|投稿しました|質問箱|話題|高評価|ポイント)/u.test(t))return false;if(actorName&&actorName!=="note")return false;if(/note質問箱FacebookYouTubeストア|フォロワーフォロー質問する/u.test(t))return true;if(/^note-notification-(?:manual-sync-v29(?:4[5-8]|5[0-9])|continuous-sync-v291[5-9])$/.test(source)&&t.length>=6)return true;return false}
function jstDay(v:unknown){const ms=Date.parse(String(v||""));if(!Number.isFinite(ms))return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(ms))}
Deno.serve(async req=>{if(req.method==="OPTIONS")return new Response("ok",{headers:H});try{
 if(req.method!=="POST")return out({ok:false,error:"METHOD_NOT_ALLOWED"},405);
 const m=await auth(req),ids=m.scope===m.id?[m.id]:[m.scope,m.id],b=await req.json().catch(()=>({})),cursor=String(b.cursor||""),onlyPending=b.onlyPending===true,now=new Date().toISOString();
 let q=db.from("insight_notifications").select("id,notification_type,raw_text,target_url,occurred_at,captured_at,meta").in("member_id",ids).order("id").limit(100);if(onlyPending)q=q.eq("notification_type","other");if(cursor)q=q.gt("id",cursor);
 const{data,error}=await q;if(error)throw error;let checked=0,moved=0,dayStamped=0,pending=0;
 const evidence=new Map<string,any>();
 if((data||[]).some(r=>!r.meta?.kind&&String(r.meta?.event_identity||"").startsWith("notice:"))){
  const {data:probes}=await db.from("insight_notification_network_probes").select("response_sample").in("member_id",ids).order("captured_at",{ascending:false}).limit(200);
  for(const p of probes||[])for(const n of Array.isArray(p.response_sample?.data)?p.response_sample.data:[])if(n?.id&&n?.kind&&!evidence.has("notice:"+n.id))evidence.set("notice:"+n.id,n);
 }
 for(const r of data||[]){if(r.notification_type==="capture_noise"&&!r.meta?.verified_shell){checked++;continue}if(r.meta?.classifier==="action-v23-structured"){checked++;if(r.notification_type==="other")pending++;continue}const type=String(r.notification_type||"other"),meta={...(r.meta&&typeof r.meta==="object"?r.meta:{}),...(evidence.get(String(r.meta?.event_identity||""))||{})},day=jstDay(r.occurred_at||r.captured_at),nextMeta={...meta,event_day_jst:day,last_reclassified_at:now,reclassify_version:"full-cursor-v4",classifier:"action-v23-structured"};
 const classified=classify(String(r.raw_text||""),r.target_url,meta),nextType=classified==="other"&&type!=="capture_noise"?type:classified,finalMeta={...nextMeta,reclassify_pending:nextType==="other",classification_status:nextType==="other"?"unmatched":"matched"};
 const actor=meta.action_users?.[0],repair:Record<string,unknown>={};
 if(actor&&/^https:\/\/note\.com\/[^/?#]+\/?$/.test(String(actor.url||""))){repair.actor_url=actor.url;if(typeof actor.name==="string")repair.actor_name=actor.name;if(/^https:\/\//.test(String(actor.user_profile_image_path||"")))repair.actor_image_url=actor.user_profile_image_path}
 if(meta.body)repair.raw_text=String(meta.body).replace(/<[^>]*>/g," ").slice(0,4000);
 const{data:saved,error:up}=await db.from("insight_notifications").update({...repair,notification_type:nextType,meta:finalMeta}).eq("id",r.id).in("member_id",ids).select("notification_type").single();if(up)throw up;checked++;if(saved.notification_type!==type)moved++;if(saved.notification_type==="other")pending++;if(meta.event_day_jst!==day)dayStamped++}
 return out({ok:true,noteId:m.noteId,checked,moved,dayStamped,pending,onlyPending,classifiedAt:now,nextCursor:data?.length===100?data[data.length-1].id:null});
 }catch(e){const msg=e instanceof Error?e.message:String(e);return out({ok:false,error:msg},/LOGIN|SESSION|INACTIVE/.test(msg)?401:500)}});
