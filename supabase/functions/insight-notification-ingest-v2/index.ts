import { createClient } from "npm:@supabase/supabase-js@2.112.4";

const U=Deno.env.get("SUPABASE_URL")!,K=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db=createClient(U,K,{auth:{persistSession:false}});
const H={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"content-type,x-ingest-token",
  "Access-Control-Allow-Methods":"POST,OPTIONS",
  "Content-Type":"application/json; charset=utf-8",
};
const out=(x:unknown,s=200)=>new Response(JSON.stringify(x),{status:s,headers:H});

async function sha(v:string){
  const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(v));
  return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("");
}
function clean(v:unknown,max=2000){return typeof v==="string"?v.replace(/\u0000/g,"").replace(/\s+/g," ").trim().slice(0,max):null}
function cleanRaw(v:unknown){const x=clean(v,800);return x?x.replace(/保完(?=(?:【|\s|$|\d))/gu,"").replace(/\s+/g," ").trim():null}
function cleanTarget(v:unknown){
  const raw=clean(v,1200); if(!raw)return null;
  try{const u=new URL(raw);u.hash="";u.searchParams.delete("from");return u.toString()}catch{return raw}
}
function canonicalText(v:string){return v.replace(/保完(?=(?:【|\s|$|\d))/gu,"").replace(/\s+/g," ").replace(/\s(?:たった今|昨日|\d+\s*(?:秒|分|時間|日|週|か月|ヶ月|月|年)前)$/u,"").trim()}
function actorFromText(v:string){const m=canonicalText(v).match(/^(.{1,160}?)\s*さん(?:他\d+名)?(?:が|の|から|より|に)/u);return m?.[1]?.trim()||null}
function jstDay(v:unknown){const ms=Date.parse(String(v||"")),d=Number.isFinite(ms)?new Date(ms):new Date();return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit"}).format(d)}

function classify(text:string,targetUrl:string|null){
  const t=text.replace(/\s+/g," ").trim(),target=targetUrl||"";
  if(/[?&]kind=board_reply_comment(?:&|$)/i.test(target))return"membership_board_reply";
  if(/[?&]kind=(?:board_like_comment|board_like_post)(?:&|$)/i.test(target))return"membership_reaction";
  if(/[?&]kind=circle_plan_join(?:&|$)/i.test(target))return"membership_join";
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
  if((/\/m\//.test(target)&&/をフォローしました/.test(t))||/マガジンをフォローしました/.test(t))return"magazine_follow";
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

async function identity(req:Request){
  const raw=req.headers.get("X-Ingest-Token")||"";
  if(!raw)throw new Error("INGEST_TOKEN_REQUIRED");
  const now=new Date().toISOString();
  const{data,error}=await db.from("insight_notification_ingest_tokens").select("member_id,expires_at").eq("token_hash",await sha(raw)).is("revoked_at",null).gt("expires_at",now).maybeSingle();
  if(error||!data?.member_id)throw new Error("INGEST_TOKEN_INVALID");
  const memberId=String(data.member_id);
  if(memberId==="owner")return{memberId,noteId:"ss_yr"};
  const{data:app}=await db.from("insight_access_applications").select("note_id,status,verified_at").eq("id",memberId).maybeSingle();
  if(app?.note_id&&app.status==="active"&&app.verified_at)return{memberId,noteId:String(app.note_id).toLowerCase()};
  const{data:profile}=await db.from("insight_notification_profiles").select("note_urlname").eq("member_id",memberId).maybeSingle();
  const noteId=String(profile?.note_urlname||"").toLowerCase();
  if(!noteId)throw new Error("INGEST_ACCOUNT_UNKNOWN");
  return{memberId,noteId};
}

function legacySemantic(type:string,actor:string,target:string|null,raw:string,bucket:string){
  const compact=["follow","magazine_follow","magazine_article_added","my_article_magazine_added","magazine_join","membership_board","membership_board_reply","membership_reaction","membership_started","membership_plan","membership_join","purchase","tip","buzz","rating","points","quote","comment_like","like","creator_article_posted"].includes(type)&&!(type==="my_article_magazine_added"&&!target);
  return compact?`${type}|${actor}|${target||""}|${bucket}`:`${type}|${canonicalText(raw)}|${actor}|${target||""}|${bucket}`;
}
function stableSemantic(clientSignature:string,actor:string,target:string|null,raw:string,bucket:string){
  return clientSignature?`event-v2|client|${clientSignature}`:`event-v2|${canonicalText(raw)}|${actor}|${target||""}|${bucket}`;
}
function allowedExplicitSource(source:string){
  if(["note-notification-auto-sync","note-notification-visible-sync","note-notification-passive-sync"].includes(source))return false;
  return /^note-notification-(?:reader-v\d+|explicit-sync(?:-v\d+)?|manual-sync-v\d+|continuous-sync-v\d+|resume-upward-v\d+|resume-downward-v\d+)$/.test(source);
}
function storedSource(source:string){return /^note-notification-resume-(?:upward|downward)-v\d+$/.test(source)?"note-notification-manual-sync-v2959":source}

type ExistingRow={id:string;fingerprint:string;notification_type:string|null;meta:any};
Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:H});
  if(req.method!=="POST")return out({ok:false,error:"METHOD_NOT_ALLOWED"},405);
  try{
    const who=await identity(req),body=await req.json().catch(()=>({}));
    const suppliedNoteId=String(body?.noteId||"").trim().replace(/^@/,"").toLowerCase();
    if(!suppliedNoteId||suppliedNoteId!==who.noteId)return out({ok:false,error:"NOTIFICATION_ACCOUNT_MISMATCH",expectedNoteId:who.noteId},409);
    const incoming=Array.isArray(body?.notifications)?body.notifications.slice(0,1000):[];
    let inserted=0,updated=0,blocked=0,skipped=0,deduped=0;
    const sources=new Set<string>(),confirmedClientSignatures:string[]=[];
    for(const item of incoming){
      const meta=item?.meta&&typeof item.meta==="object"?item.meta:{},source=String(meta?.source||""),clientSignature=String(meta?.client_signature||"");
      sources.add(source||"(empty)");
      if(!allowedExplicitSource(source)){blocked++;continue}
      const raw=cleanRaw(item?.raw_text??item?.text);
      if(!raw||raw.length<5||raw.length>700){skipped++;continue}
      const sourceUrl=cleanTarget(item?.source_url),targetUrl=cleanTarget(item?.target_url),actorUrl=cleanTarget(item?.actor_url),actorImage=cleanTarget(item?.actor_image_url),occurred=clean(item?.occurred_at,80),type=classify(raw,targetUrl);
      const actorName=clean(item?.actor_name,200)||actorFromText(raw);
      const at=occurred&&!Number.isNaN(Date.parse(occurred))?new Date(occurred).toISOString():null;
      const eventDay=jstDay(at||new Date().toISOString());
      const bucket=new Date(Math.floor(Date.parse(at||new Date().toISOString())/(5*60_000))*(5*60_000)).toISOString();
      const actor=actorUrl||actorName||"",stableFingerprint=await sha(stableSemantic(clientSignature,actor,targetUrl,raw,bucket)),legacyFingerprint=await sha(legacySemantic(type,actor,targetUrl,raw,bucket)),legacyOtherFingerprint=await sha(legacySemantic("other",actor,targetUrl,raw,bucket)),classifiedAt=new Date().toISOString();
      const fingerprints=[...new Set([stableFingerprint,legacyFingerprint,legacyOtherFingerprint])];
      const{data:byFingerprint,error:findError}=await db.from("insight_notifications").select("id,fingerprint,notification_type,meta").eq("member_id",who.memberId).in("fingerprint",fingerprints);
      if(findError)throw findError;
      let candidates=(byFingerprint||[]) as ExistingRow[];
      if(clientSignature){
        const{data:bySignature,error:signatureError}=await db.from("insight_notifications").select("id,fingerprint,notification_type,meta").eq("member_id",who.memberId).contains("meta",{client_signature:clientSignature}).limit(8);
        if(signatureError)throw signatureError;
        const seen=new Set(candidates.map(x=>x.id));for(const x of (bySignature||[]) as ExistingRow[])if(!seen.has(x.id)){seen.add(x.id);candidates.push(x)}
      }
      const preferred=candidates.find(x=>x.fingerprint===stableFingerprint)||candidates.find(x=>x.notification_type&&x.notification_type!=="other")||candidates[0]||null;
      const row={member_id:who.memberId,fingerprint:stableFingerprint,notification_type:type,raw_text:raw,actor_name:actorName,actor_url:actorUrl,actor_image_url:actorImage,target_title:clean(item?.target_title,500),target_url:targetUrl,source_url:sourceUrl,occurred_at:at,meta:{...meta,source:storedSource(source),capture_source:source,synced_note_id:who.noteId,classifier:"action-v21-reader-source",event_day_jst:eventDay,reclassify_pending:type==="other",classified_at:classifiedAt,event_identity:"classification-independent-v2"}};
      if(preferred){
        const duplicateIds=candidates.filter(x=>x.id!==preferred.id).map(x=>x.id);
        if(duplicateIds.length){const{error:deleteError}=await db.from("insight_notifications").delete().in("id",duplicateIds);if(deleteError)throw deleteError;deduped+=duplicateIds.length}
        const{error:updateError}=await db.from("insight_notifications").update(row).eq("id",preferred.id);if(updateError)throw updateError;updated++;
      }else{
        const{error:insertError}=await db.from("insight_notifications").insert(row);if(insertError)throw insertError;inserted++;
      }
      if(clientSignature)confirmedClientSignatures.push(clientSignature);
    }
    await db.from("insight_notification_sync_runs").insert({member_id:who.memberId,inserted_count:inserted,received_count:incoming.length,source:"browser-notification-stable-v2"});
    const result={ok:true,noteId:who.noteId,memberId:who.memberId,received:incoming.length,accepted:incoming.length-blocked-skipped,inserted,updated,deduped,blocked,skipped,sources:[...sources],confirmedClientSignatures:[...new Set(confirmedClientSignatures)]};
    if(incoming.length>0&&blocked===incoming.length)return out({...result,ok:false,error:"NOTIFICATION_SOURCE_BLOCKED"},422);
    return out(result);
  }catch(e){
    const message=e instanceof Error?e.message:"INGEST_ERROR";
    console.error(message);
    return out({ok:false,error:message},/REQUIRED|INVALID|UNKNOWN/.test(message)?401:500);
  }
});
