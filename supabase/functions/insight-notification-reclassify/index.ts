import { createClient } from "npm:@supabase/supabase-js@2.112.4";
const U=Deno.env.get("SUPABASE_URL")!,K=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db=createClient(U,K,{auth:{persistSession:false}}),ORIGIN="https://mumei-s.github.io";
const H={"Access-Control-Allow-Origin":ORIGIN,"Access-Control-Allow-Headers":"content-type,x-insight-token","Access-Control-Allow-Methods":"POST,OPTIONS","Content-Type":"application/json; charset=utf-8","Vary":"Origin"};
const out=(x:unknown,s=200)=>new Response(JSON.stringify(x),{status:s,headers:H});
async function sha(v:string){const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(v));return[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("")}
async function auth(req:Request){const raw=req.headers.get("X-Insight-Token")||"";if(!raw)throw new Error("INSIGHT_LOGIN_REQUIRED");const{data:s}=await db.from("insight_member_sessions").select("id,application_id,expires_at,revoked_at").eq("token_hash",await sha(raw)).maybeSingle();if(!s||s.revoked_at||Date.parse(s.expires_at)<=Date.now())throw new Error("INSIGHT_SESSION_INVALID");const{data:a}=await db.from("insight_access_applications").select("id,note_id,status").eq("id",s.application_id).maybeSingle();if(!a||a.status!=="active")throw new Error("INSIGHT_MEMBER_INACTIVE");const noteId=String(a.note_id||"").toLowerCase();return{id:String(a.id),scope:noteId==="ss_yr"?"owner":String(a.id),noteId}}
const clean=(v:unknown)=>String(v||"").replace(/\s+/g," ").trim();
function classify(text:string,targetUrl:string|null){
  const t=clean(text),target=targetUrl||"";
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
  if((/\/m\//.test(target)&&/をフォローしました/.test(t))||/マガジンをフォローしました/.test(t)||(/さんが.{1,180}をフォローしました/.test(t)&&!/あなたをフォローしました/.test(t)))return"magazine_follow";
  if(/(?:あなたをフォローしました|フォローされました|新しいフォロワー|さん(?:他\d+名)?が(?:あなたを)?フォローしました|さんがあなたをフォロー)/.test(t))return"follow";
  if(!/マガジン/.test(t)&&/(?:フォロー|フォロワー)/.test(t)&&/(?:しました|されました|増えました|新しい)/.test(t))return"follow";
  if(/(?:に新しい記事を\d*本?追加しました|に記事を追加しました|マガジン.{0,80}(?:記事|新しい記事).{0,30}追加しました|メンバー特典マガジンに記事)/.test(t))return"magazine_article_added";
  if(/(?:さんが(?:新しい)?記事を投稿しました|さんが(?:[^。]{0,120}メンバー特典マガジンの)?記事を更新しました)/.test(t))return"creator_article_posted";
  if(/(?:あなたの記事.{0,20}話題です|あなたの記事.{0,20}話題になりました|あなたの記事\s*が話題です)/.test(t))return"buzz";
  if(/(?:あなたの記事が購入されました|あなたの有料記事が購入されました|購入がありました|さんがあなたの記事を購入しました)/.test(t))return"purchase";
  if(t.length<350&&/(?:さん(?:から|より).{0,30}(?:チップ|サポート).{0,80}(?:届きました|届いた|届き|受け取りました|受け取った|受け取り|もらいました|もらい|いただきました|いただき|贈られました|送られました)|(?:チップ|サポート).{0,100}(?:が届きました|が届いた|を受け取りました|を受け取った|をもらいました|をいただきました|を贈られました|を送られました)|(?:支援|応援金).{0,100}(?:届きました|受け取りました|もらいました|いただきました))/.test(t))return"tip";
  if(/(?:あなたの記事.{0,40}引用され|あなたの記事.{0,40}紹介され)/.test(t))return"quote";
  if(/あなたの記事を高評価しました/.test(t))return"rating";
  if(/(?:あなたにポイント|ポイントが付与|ポイントを獲得)/.test(t))return"points";
  return"other";
}
function noise(text:string,targetUrl:string|null,actorName:string|null,source:string){const t=clean(text);if(targetUrl)return false;if(/(?:スキ|いいね|コメント|返信|フォロー|フォロワー|追加しました|追加されました|参加しました|加入しました|購入|チップ|サポート|メンバーシップ|メンシプ|掲示板|投稿しました|質問箱|話題|高評価|ポイント)/u.test(t))return false;if(actorName&&actorName!=="note")return false;if(/note質問箱FacebookYouTubeストア|フォロワーフォロー質問する/u.test(t))return true;if(/^note-notification-(?:manual-sync-v29(?:4[5-8]|5[0-9])|continuous-sync-v291[5-9])$/.test(source)&&t.length>=6)return true;return false}
function jstDay(v:unknown){const ms=Date.parse(String(v||""));if(!Number.isFinite(ms))return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(ms))}
Deno.serve(async req=>{if(req.method==="OPTIONS")return new Response("ok",{headers:H});try{if(req.method!=="POST")return out({ok:false,error:"METHOD_NOT_ALLOWED"},405);const m=await auth(req),ids=m.scope===m.id?[m.id]:[m.scope,m.id],now=new Date().toISOString();const rows:any[]=[];for(let start=0;start<12000;start+=1000){const{data,error}=await db.from("insight_notifications").select("id,notification_type,raw_text,target_url,actor_name,occurred_at,captured_at,meta").in("member_id",ids).order("captured_at",{ascending:false}).range(start,start+999);if(error)throw error;rows.push(...(data||[]));if((data||[]).length<1000)break}let checked=0,moved=0,dayStamped=0,pending=0,noisy=0;for(const r of rows){const type=String(r.notification_type||"other"),meta=r.meta&&typeof r.meta==="object"?r.meta:{},day=jstDay(r.occurred_at||r.captured_at),source=String((meta as any).source||""),classified=type==="other"?classify(String(r.raw_text||""),r.target_url?String(r.target_url):null):type,nextType=classified==="other"&&noise(String(r.raw_text||""),r.target_url?String(r.target_url):null,r.actor_name?String(r.actor_name):null,source)?"capture_noise":classified,needsDay=String((meta as any).event_day_jst||"")!==day,needsType=nextType!==type;if(type==="other")checked++;if(nextType==="other")pending++;if(nextType==="capture_noise")noisy++;if(!needsDay&&!needsType&&type!=="other")continue;const nextMeta={...meta,event_day_jst:day,last_reclassified_at:now,reclassify_version:"daily-v3-noise-and-kind",reclassify_pending:nextType==="other"};const{error:up}=await db.from("insight_notifications").update({notification_type:nextType,meta:nextMeta}).eq("id",r.id);if(up)throw up;if(needsType)moved++;if(needsDay)dayStamped++}return out({ok:true,noteId:m.noteId,checked,moved,dayStamped,pending,noisy,classifiedAt:now})}catch(e){const msg=e instanceof Error?e.message:String(e);console.error(msg);return out({ok:false,error:msg},/LOGIN|SESSION|INACTIVE/.test(msg)?401:500)}});