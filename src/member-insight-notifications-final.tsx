import { MemberInsightOutgoingComments } from "./member-insight-outgoing-comments";
import { CreatorAvatar, creatorNoteId } from "./creator-avatar";
import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { canRetainInsightView, fetchInsightResource, isFreshInsightView } from "./insight-view-lifecycle";
import { pendingCompletion, queueCompletion } from "./insight-completion-queue";
import { readSavedInsightView, writeSavedInsightView, removeSavedInsightView } from "./insight-saved-view";
import { INSIGHT_TOKEN_KEY, currentStoredInsightAccount } from "./insight-account-store";
import "./member-insight-notifications-final.css";

const FEED="https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-notification-feed-final";
const ICON="https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/creator-icons";
const PAGE=100;
const CLASSIFIER_VERSION="action-v28-context:evidence-v2-articles";
type Row=Record<string,any>;
type CachedView={rows:Row[];statusCounts?:Record<string,number>;total:number;categoryCounts:Record<string,number>;updatedAt:string;syncAt:string;serverSync:{received:number;confirmed:number;source:string};cachedAt:number;complete?:boolean;revision?:number;token?:string};
const NOTIFICATION_VIEW_CACHE=new Map<string,CachedView>();
type NotificationSelection={kind:string;handlingStatus:string;selectedDay:string;page:number};
type SavedNotificationView={selection:NotificationSelection;rows:Row[];statusCounts:Record<string,number>;total:number;categoryCounts:Record<string,number>;updatedAt:string;syncAt:string;serverSync:{received:number;confirmed:number;source:string}};
const NOTIFICATION_SELECTION_CACHE=new Map<string,NotificationSelection>();
const selectionId=(selection:NotificationSelection)=>JSON.stringify([selection.kind,selection.handlingStatus,selection.selectedDay,selection.page]);
function savedNotificationView(account:string,token:string){
 const saved=readSavedInsightView<SavedNotificationView>("notifications",{account,token}),value=saved?.value,selection=value?.selection;
 const counts=(v:unknown)=>v&&typeof v==="object"&&!Array.isArray(v)&&Object.values(v).every(n=>typeof n==="number"&&Number.isFinite(n)&&n>=0);
 if(!saved||!value||!selection||!CATS.some(([id])=>id===selection.kind)||!["all","pending","completed"].includes(selection.handlingStatus)||typeof selection.selectedDay!=="string"||!/^$|^\d{4}-\d{2}-\d{2}$/.test(selection.selectedDay)||!Number.isSafeInteger(selection.page)||selection.page<1||!Array.isArray(value.rows)||value.rows.length>PAGE||!value.rows.every(row=>row&&typeof row==="object"&&!Array.isArray(row))||!Number.isFinite(value.total)||value.total<0||!counts(value.categoryCounts)||!counts(value.statusCounts)||!value.serverSync||typeof value.serverSync.received!=="number"||typeof value.serverSync.confirmed!=="number"||typeof value.serverSync.source!=="string"||typeof value.updatedAt!=="string"||typeof value.syncAt!=="string")return null;
 if(value.total>0&&!value.rows.length)return null;
 return saved;
}
const NOTIFICATION_RECENT_ALL=new Map<string,Row[]>();
type BoardMeta={serverCheckedAt:number;serverUpdatedAt:string;serverSyncAt:string};
function boardMetaKey(account:string){return `mumei-notification-board-meta:${account}`}
function markBoardFresh(account:string,updatedAt="",syncAt=""){if(!account)return;try{localStorage.setItem(boardMetaKey(account),JSON.stringify({serverCheckedAt:Date.now(),serverUpdatedAt:String(updatedAt||""),serverSyncAt:String(syncAt||"")}))}catch{}}
function accountKey(memberId=""){return (requestedNotificationAccount()||memberId||currentStoredInsightAccount()?.noteId||"").toLowerCase()}
function hasFreshBoard(account:string){try{return isFreshInsightView(JSON.parse(localStorage.getItem(boardMetaKey(account))||"null")?.serverCheckedAt)}catch{return false}}
function boardRow(r:Row){return r.meta?.noise_reason!=="non-notification-api-capture"&&r.notification_type!=="capture_noise"&&!(!r.target_url&&!r.meta?.kind&&/^(?:[\d,.万]+件){1,2}\d{1,2}月\d{1,2}日まで$/u.test(String(r.raw_text||"").replace(/\s+/g,"")))}
function notificationBoardOrder(a:Row,b:Row){return (Date.parse(b.captured_at)||0)-(Date.parse(a.captured_at)||0)||(Date.parse(b.occurred_at)||0)-(Date.parse(a.occurred_at)||0)||String(b.id||'').localeCompare(String(a.id||''))}
function readBoard(account:string):Row[]{if(!account)return[];const cached=NOTIFICATION_RECENT_ALL.get(account);if(cached)return cached.filter(boardRow).sort(notificationBoardOrder);try{const rows=JSON.parse(localStorage.getItem(`mumei-notification-board:${account}`)||"[]");if(Array.isArray(rows)){NOTIFICATION_RECENT_ALL.set(account,rows.filter(boardRow).sort(notificationBoardOrder));return rows.filter(boardRow).sort(notificationBoardOrder)}}catch{}return[]}
function retainBoard(account:string,rows:Row[]){if(!account||!rows.length)return readBoard(account);const map=new Map(readBoard(account).map(r=>[String(r.id||rowKey(r)),r]));for(const r of rows){const id=String(r.id||rowKey(r));map.set(id,keepIcon(r,map.get(id)))}const merged=[...map.values()].sort(notificationBoardOrder).slice(0,2000);NOTIFICATION_RECENT_ALL.set(account,merged);
 for(const [key,view] of NOTIFICATION_VIEW_CACHE){if(!key.startsWith(account+"|"))continue;const[,kind,day,page,status="all"]=key.split("|"),values=new Map(view.rows.map(r=>[String(r.id||rowKey(r)),r]));for(const r of rows){const id=String(r.id||rowKey(r));if(page!=="1"&&!values.has(id))continue;const match=boardRow(r)&&matchesHandling(r,status)&&(kind==="all"||displayType(r)===kind)&&(!day||new Date(r.occurred_at||r.captured_at).toLocaleDateString("sv-SE",{timeZone:"Asia/Tokyo"})===day);if(match)values.set(id,keepIcon(r,values.get(id)||map.get(id)));else values.delete(id)}NOTIFICATION_VIEW_CACHE.set(key,{...view,rows:[...values.values()].sort(notificationBoardOrder).slice(0,PAGE)})}
 try{const key=`mumei-notification-board:${account}`,value=JSON.stringify(merged);if(localStorage.getItem(key)!==value)localStorage.setItem(key,value)}catch{}return merged}
function matchesHandling(r:Row,status:string){return status==="completed"?Boolean(r.confirmed):status==="pending"?!r.confirmed:true}
function notificationRevision(r:Row){return JSON.stringify([r.notification_type,displayType(r),r.raw_text,r.actor_name,r.actor_url,r.target_url,r.target_title,r.source_url,r.occurred_at,r.captured_at,Boolean(r.confirmed),Boolean(r.favorite),r.favorite_creator_key,r.context_label,r.article_context,r.article_owner,r.membership_owner,r.meta?.classification_status,r.meta?.comment_body||r.comment_body||"",r.meta?.reply_body||r.reply_body||"",r.meta?.source==="canonical-public-comments"?r.meta?.body||"":"",r.meta?.comment_key||"",r.meta?.comment_author||r.comment_author||"",r.meta?.comment_body_source||"",r.meta?.comment_resolved_at||"",r.comment_identity?.articleKey,r.comment_identity?.commentKey,r.comment_identity?.url,r.meta?.comment_conversation])}
function filterBoard(account:string,kind:string,day:string,status="all"){
 const token=localStorage.getItem(INSIGHT_TOKEN_KEY)||"",verified=new Map<string,{row:Row;checkedAt:number}>();
 // A check of one page cannot verify unseen rows retained from a previous launch.
 for(const [key,view] of NOTIFICATION_VIEW_CACHE)if(key.startsWith(account+"|")&&view.token===token&&canRetainInsightView(view.cachedAt))for(const row of view.rows){const id=String(row.id||rowKey(row)),prior=verified.get(id);if(!prior||view.cachedAt>=prior.checkedAt)verified.set(id,{row,checkedAt:view.cachedAt})}
 return [...verified.values()].map(value=>value.row).filter(r=>matchesHandling(r,status)&&(kind==="all"||displayType(r)===kind)&&(!day||new Date(r.occurred_at||r.captured_at).toLocaleDateString("sv-SE",{timeZone:"Asia/Tokyo"})===day)).sort(notificationBoardOrder).slice(0,PAGE)
}


const CATS=[["all","すべて"],["creator_article_posted","記事投稿・更新"],["badge","バッジ獲得"],["purchase_message","購入記事のメッセージ"],["my_article_magazine_added","自分の記事追加"],["comment_like","コメント♡"],["reply_self","自分の記事返信"],["reply_other","相手の記事返信"],["reply_unknown","返信先確認待ち"],["magazine_follow","マガジンフォロー"],["magazine_article_added","マガジン記事追加"],["magazine_join","マガジン参加"],["membership_board","メンシプ掲示板"],["membership_board_reply","掲示板返信"],["membership_reaction_self","自分のメンシプ反応"],["membership_reaction_joined","参加中のメンシプ反応"],["membership_reaction_unknown","メンシプ所有者確認待ち"],["membership_article_added","メンシプ記事追加"],["membership_article_updated","メンシプ記事更新"],["membership_magazine_added","メンシプ特典マガジン追加"],["membership_started","メンシプ開始"],["membership_plan","プラン追加"],["membership_join","メンシプ参加"],["question_box_started","質問箱開始"],["store_started","お店をはじめました"],["question_answer","質問への回答"],["purchased_article_updated","購入した記事の更新"],["purchase","購入"],["tip","チップ・サポート"],["buzz","話題"],["rating","高評価"],["points","ポイント"],["quote","引用・紹介"],["image_used","画像の使用"],["other","その他・未分類"]] as const;
const LABEL:Record<string,string>=Object.fromEntries(CATS);
const ICON_FALLBACK:Record<string,string>={like:"♥",comment_like:"♡",comment:"💬",reply_self:"↩",reply_other:"↩",reply:"↩",follow:"＋",creator_article_posted:"📝",store_started:"🛍",magazine_follow:"📚",my_article_magazine_added:"📚",magazine_article_added:"📚",magazine_join:"📚",membership_board:"📌",membership_board_reply:"↩",membership_reaction_self:"♥",membership_reaction_joined:"♥",membership_reaction:"♥",membership_started:"🚀",membership_plan:"＋",membership_join:"👤",question_box_started:"？",purchase:"🛒",tip:"🎁",buzz:"🔥",rating:"🏆",points:"P",quote:"↗",image_used:"🖼",other:"🔔"};

async function post(body:Record<string,unknown>,signal?:AbortSignal){const token=localStorage.getItem(INSIGHT_TOKEN_KEY)||"";if(!token)throw new Error("INSIGHT_LOGIN_REQUIRED");const c=new AbortController(),timer=window.setTimeout(()=>c.abort(),45000);const abort=()=>c.abort();signal?.addEventListener("abort",abort,{once:true});try{const r=await fetchInsightResource(FEED,{method:"POST",headers:{"Content-Type":"application/json","X-Insight-Token":token},body:JSON.stringify(body),cache:"no-store",signal:c.signal},45_000);const p=await r.json().catch(()=>{throw Object.assign(new Error("通知の応答内容を確認できませんでした"),{status:r.status})});if(localStorage.getItem(INSIGHT_TOKEN_KEY)!==token)throw new Error("INSIGHT_ACCOUNT_CHANGED");if(r.status===402)throw new Error("INSIGHT保存先がSupabaseの利用制限中です（HTTP 402）");if(!r.ok||p?.ok!==true)throw Object.assign(new Error(p?.error||"INSIGHT_API_ERROR"),{status:r.status});if((!body.action||body.action==="recent")&&(!Array.isArray(p.rows)||!p.noteId||(!body.action&&(!Number.isFinite(Number(p.total))||Number(p.total)<0))))throw new Error("通知一覧の応答が不完全です");return p}finally{window.clearTimeout(timer);signal?.removeEventListener("abort",abort)}}
const notificationDateFormat=new Intl.DateTimeFormat("ja-JP",{timeZone:"Asia/Tokyo",year:"numeric",month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"});
const date=(v:any)=>{if(!v)return"—";const d=new Date(String(v));return Number.isNaN(d.getTime())?"—":notificationDateFormat.format(d)};
const dayLabel=(v:string)=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(v))return"全期間";const[y,m,d]=v.split("-").map(Number);return`${y}/${m}/${d}`};
const canonical=(v:any)=>String(v||"").replace(/保完(?=\s|$)/g," ").replace(/\s+/g," ").replace(/\s(?:たった今|昨日|\d+\s*(?:秒|分|時間|日|週|か月|ヶ月|月|年)前)$/u,"").trim();
const short=(v:any,n=170)=>{const s=canonical(v);return s.length>n?s.slice(0,n-1)+"…":s};
function noteId(url:any){try{const id=new URL(String(url||"")).pathname.split("/").filter(Boolean)[0]||"";return new URL(String(url||"")).hostname==="note.com"&&/^[A-Za-z0-9_-]+$/.test(id)&&!["m","n","messages","settings","membership"].includes(id)?id.toLowerCase():""}catch{return""}}
function requestedNotificationAccount(){try{return String(new URLSearchParams(window.location.search).get("notificationAccount")||sessionStorage.getItem("mumei-insight-notification-account")||"").trim().replace(/^@/,"").toLowerCase()}catch{return""}}
function creatorTop(url:any,selfId=""){const id=noteId(url);return id&&id!==String(selfId||"").toLowerCase()?`https://note.com/${id}`:""}
function safeActorImage(v:any){const s=String(v||"");return s&&!/magazine_cover|ogp|cover|\/assets\/notices\/|notices\/icon_|icon_(?:comment|magazine|notification|notice)/i.test(s)?s:""}
function metaActor(r:Row){const xs=Array.isArray(r?.meta?.action_users)?r.meta.action_users:Array.isArray(r?.meta?.actionUsers)?r.meta.actionUsers:[],a=xs.find((x:any)=>x&&typeof x==="object")||null;if(!a)return{};const id=String(a.urlname||a.username||a.screen_name||"").replace(/^@/,""),url=String(a.url||a.profile_url||a.profileUrl||a.href||a.link||""),image=safeActorImage(a.user_profile_image_path||a.userProfileImagePath||a.profile_image_url||a.profileImageUrl||a.image_url||a.imageUrl||a.avatar_url||a.avatarUrl||a.icon_url||a.iconUrl),name=String(a.name||a.display_name||a.displayName||a.nickname||a.urlname||a.username||"");return{name:name||null,url:url||(id?("https://note.com/"+id):null),image:image||null}}

function richness(r:Row){let n=0;if(r.actor_url)n+=8;if(safeActorImage(r.actor_image_url))n+=8;else if(r.actor_image_url)n+=1;if(r.target_url)n+=4;if(r.occurred_at)n+=2;if(r.target_title)n+=1;return n}
function mergePair(a:Row,b:Row){const p=richness(b)>richness(a)?b:a,o=p===b?a:b,pi=safeActorImage(p.actor_image_url)||safeActorImage(o.actor_image_url)||null;return{...o,...p,actor_name:p.actor_name||o.actor_name||null,actor_url:p.actor_url||o.actor_url||null,actor_image_url:pi,target_url:p.target_url||o.target_url||null,target_title:p.target_title||o.target_title||null,source_url:p.source_url||o.source_url||null,occurred_at:p.occurred_at||o.occurred_at||null,captured_at:(Date.parse(p.captured_at)||0)>=(Date.parse(o.captured_at)||0)?p.captured_at||o.captured_at||null:o.captured_at}}
function mergeActorIdentity(r:Row,known:Row):Row{return{...r,actor_name:r.actor_name||known.actor_name||null,actor_url:r.actor_url||known.actor_url||null,actor_image_url:safeActorImage(r.actor_image_url)||safeActorImage(known.actor_image_url)||null}}
function mergeMagazineJoinRows(rows:Row[]){const out:Row[]=[],map=new Map<string,number>();for(const r of rows){if(String(r.notification_type||"")!=="magazine_join"){out.push(r);continue}const day=String(r.captured_at||r.occurred_at||"").slice(0,10),k=`magazine_join|${canonical(r.raw_text)}|${day}`;const i=map.get(k);if(i==null){map.set(k,out.length);out.push(r)}else out[i]=mergePair(out[i],r)}return out}
function actorStem(r:Row){const raw=canonical(r.raw_text),type=String(r.notification_type||"");if(type==="my_article_magazine_added"){const end=raw.indexOf("に追加されました");return end>=0?raw.slice(0,end+8):""}if(type==="reply"){const token="さんがあなたのコメントに返信しました",end=raw.indexOf(token);return end>=0?raw.slice(0,end+token.length):""}if(type==="comment"){const token="さんがあなたの記事にコメントしました",end=raw.indexOf(token);return end>=0?raw.slice(0,end+token.length):""}return""}
function eventMs(r:Row){return Date.parse(String(r.captured_at||r.occurred_at||""))||0}
function savedCommentText(row:Row){for(const value of [row.meta?.comment_body,row.meta?.reply_body,row.comment_body,row.reply_body,row.meta?.source==="canonical-public-comments"?row.meta.body:""]){if(typeof value==="string"&&value.trim()&&!/^(?:削除済み|削除されたコメント|このコメントは削除されました[。.]?|\[deleted\]|\[removed\])$/i.test(value.trim()))return value}return ""}
function savedCommentLocator(row:Row){
 const articles=new Set<string>(),comments=new Set<string>();
 for(const value of [row.comment_identity?.articleKey,row.meta?.article_key,row.meta?.articleKey])if(value)articles.add(String(value));
 for(const value of [row.comment_identity?.commentKey,row.meta?.comment_key,row.meta?.commentKey,row.comment_key])if(value)comments.add(String(value));
 for(const value of [row.comment_identity?.url,row.target_url,row.source_url,row.meta?.all_area_url,row.meta?.featured_area_url]){const url=String(value||""),article=url.match(/^https:\/\/note\.com\/[^/?#]+\/n\/([^/?#]+)(?:[?#]|$)/i);if(article){articles.add(article[1]);const comment=url.match(/[?&]c=([^&#]+)/);if(comment)comments.add(comment[1])}}
 return {articles:[...articles],comments:[...comments]};
}
function retainComment(row:Row,prior?:Row):Row{
 if(!prior||!row.id||String(row.id)!==String(prior.id)||row.member_id&&prior.member_id&&row.member_id!==prior.member_id)return row;
 const current=savedCommentLocator(row),previousLocator=savedCommentLocator(prior);
 if(previousLocator.articles.length&&row.target_url&&String(row.target_url)!==String(prior.target_url||"")&&!/^https:\/\/note\.com\/[^/?#]+\/n\/[^/?#]+(?:[?#]|$)/i.test(String(row.target_url)))return row;
 for(const field of ["articles","comments"] as const){if(current[field].length>1||previousLocator[field].length>1||current[field].length&&previousLocator[field].length&&current[field][0]!==previousLocator[field][0])return row}
 const body=savedCommentText(row),previous=savedCommentText(prior);let next=row;
 if(!body&&previous){const meta={...row.meta};for(const field of ["comment_body","reply_body","comment_key","comment_author","comment_body_source","comment_resolved_at"])if(prior.meta?.[field])meta[field]=prior.meta[field];meta.comment_body=previous;next={...row,comment_body:previous,meta,comment_identity:row.comment_identity||prior.comment_identity}}
 const conversation=prior.meta?.comment_conversation,incoming=row.meta?.comment_conversation;
 const target=current.comments[0],sameTarget=Boolean(target&&target===previousLocator.comments[0]);
 const rootedDowngrade=conversation?.threadKey&&!incoming?.threadKey&&sameTarget&&conversation.articleKey===incoming?.articleKey&&commentConversation(conversation,conversation.articleKey,target)&&Array.isArray(incoming?.messages)&&incoming.messages.every((m:any)=>m.commentKey===target);
 if(conversation&&(!incoming||rootedDowngrade))next={...next,meta:{...next.meta,comment_conversation:conversation}};
 else if(conversation&&incoming&&conversation.articleKey===incoming.articleKey&&conversation.threadKey===incoming.threadKey&&Array.isArray(conversation.messages)&&Array.isArray(incoming.messages)){
 const messages=new Map<string,any>(conversation.messages.map((m:any)=>[m.commentKey,m]));for(const m of incoming.messages){const previous=messages.get(m.commentKey);messages.set(m.commentKey,{...previous,...m,body:savedCommentText({comment_body:m.body})||previous?.body||""})}next={...next,meta:{...next.meta,comment_conversation:{...incoming,messages:[...messages.values()]}}};
 }
 return next;
}
function keepIcon(row:Row,prior?:Row):Row{const retained=retainComment(row,prior);if(!prior||row.actor_url&&prior.actor_url&&row.actor_url!==prior.actor_url)return retained;return{...retained,actor_image_url:safeActorImage(row.actor_image_url)||safeActorImage(prior.actor_image_url)||null}}
function retainEnrichedIcons(account:string,enriched:Row[]){const icons=new Map(enriched.map(row=>[String(row.id||rowKey(row)),row])),changes:Row[]=[];for(const row of readBoard(account)){const updated=keepIcon(row,icons.get(String(row.id||rowKey(row))));if(updated.actor_image_url!==row.actor_image_url)changes.push(updated)}if(changes.length)retainBoard(account,changes)}
function repairActorRows(rows:Row[]){const work:Row[]=rows.map((r:Row):Row=>{const m=metaActor(r);return{...r,actor_name:r.actor_name||m.name||null,actor_url:r.actor_url||m.url||null,actor_image_url:safeActorImage(r.actor_image_url)||m.image||null}});const alias=new Map<string,Row>();for(const r of work){const name=canonical(r.actor_name).toLowerCase();if(name&&r.actor_url){const prev=alias.get(name);if(!prev||richness(r)>richness(prev))alias.set(name,r)}}for(let i=0;i<work.length;i++){let r:Row=work[i];const type=String(r.notification_type||"");if(["my_article_magazine_added","buzz","quote","image_used"].includes(type)&&!r.actor_url){const id=noteId(r.target_url);if(id)r={...r,actor_url:`https://note.com/${id}`,actor_name:r.actor_name||(type==="my_article_magazine_added"?`追加先の運営者 @${id}`:`@${id}`)}}const name=canonical(r.actor_name).toLowerCase(),known=name?alias.get(name):null;if(known)r=mergeActorIdentity(r,known);const stem=actorStem(r),at=eventMs(r);if(stem){let best:Row|null=null,bestGap=Infinity;for(let j=0;j<work.length;j++){if(i===j)continue;const q=work[j];if(String(q.notification_type||"")!==type||actorStem(q)!==stem)continue;const gap=Math.abs(at-eventMs(q));if(gap<=180000&&gap<bestGap&&(q.actor_url||q.target_url||safeActorImage(q.actor_image_url))){best=q;bestGap=gap}}if(best)r=mergeActorIdentity(r,best)}if(["my_article_magazine_added","buzz","quote","image_used"].includes(type)&&!r.actor_url){const id=noteId(r.target_url);if(id)r={...r,actor_url:`https://note.com/${id}`,actor_name:r.actor_name||(type==="my_article_magazine_added"?`追加先の運営者 @${id}`:`@${id}`)}}work[i]=r}return work}
async function enrich(rows:Row[]):Promise<Row[]>{const ids=[...new Set(rows.filter(r=>!safeActorImage(r.actor_image_url)).map(r=>noteId(r.actor_url)).filter(Boolean))];if(!ids.length)return rows.map(r=>({...r,actor_image_url:safeActorImage(r.actor_image_url)||null}));try{const res=await fetchInsightResource(ICON,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({noteIds:ids}),cache:"no-store"}),p=await res.json(),m=new Map((p.items||[]).map((x:any)=>[String(x.noteId||"").toLowerCase(),x.image]));return rows.map(r=>({...r,actor_image_url:safeActorImage(r.actor_image_url)||String(m.get(noteId(r.actor_url))||"")||null}))}catch{return rows.map(r=>({...r,actor_image_url:safeActorImage(r.actor_image_url)||null}))}}
function actorName(r:Row){if(r.actor_name)return r.meta?.classification_status==="insufficient_evidence"?String(r.actor_name).replace(/(?:たった今|昨日|\d+\s*(?:秒|分|時間|日|週|か月|ヶ月|月|年)前)$/u,"").trim():String(r.actor_name);const m=canonical(r.raw_text).match(/^(.{1,120}?)\s*さん(?:他\d+名)?(?:が|の|から|より|に)/u);return m?.[1]?.trim()||"note通知"}
function displayType(r:Row){return String(r.display_category||r.notification_type||"other")}
function context(r:Row){if(r.context_label)return String(r.context_label);const u=String(r.target_url||r.source_url||"");const id=noteId(u);if(/\/n\//.test(u))return id?`@${id}の記事`:"記事";if(/\/m\//.test(u))return"マガジン";if(/\/membership/.test(u))return"メンシプ";return""}
function presentation(r:Row){const raw=canonical(r.raw_text),type=displayType(r),ctx=context(r);if(type==="other"&&r.meta?.classification_status==="insufficient_evidence")return{title:"通知本文が保存されていません",subject:"旧読込の人物名・時刻のみ",detail:"保存済み履歴では種別を特定できません。原記録は保持しています。"};if(type==="magazine_article_added"){const m=raw.match(/^(.+?)さん(?:他(\d+)名)?が\s*(.+?)\s*に新しい記事を(\d+)本追加しました\s*(.*)$/u);if(m)return{title:`新しい記事を${m[4]}本追加`,subject:m[3],detail:short(m[5]||"",120)}}if(type==="my_article_magazine_added")return{title:"自分の記事がマガジンに追加",subject:r.target_title||ctx||"追加先マガジン",detail:short(raw,130)};if(type==="creator_article_posted")return{title:/記事を更新しました/u.test(raw)?"記事更新":"記事投稿",subject:r.target_title||actorName(r),detail:short(raw,140)};if(type==="follow")return{title:"人物フォロー",subject:actorName(r),detail:short(raw,130)};if(type==="comment_like")return{title:"コメントに♡",subject:ctx||r.target_title||"コメントへのリアクション",detail:short(raw,150)};if(type==="comment")return{title:"コメント",subject:ctx||r.target_title||"記事へのコメント",detail:short(raw,150)};if(type==="reply_self")return{title:"自分の記事返信",subject:ctx||r.target_title||"自分の記事のコメントへの返信",detail:short(raw,150)};if(type==="reply_other")return{title:"相手の記事返信",subject:ctx||r.target_title||"相手の記事で自分のコメントへの返信",detail:short(raw,150)};if(type==="membership_board_reply")return{title:"メンシプ掲示板返信",subject:r.target_title||"メンシプ掲示板",detail:short(raw,150)};if(type==="membership_board")return{title:"メンシプ掲示板",subject:r.target_title||"掲示板への投稿",detail:short(raw,150)};if(type==="membership_reaction_self")return{title:"自分のメンシプ反応",subject:actorName(r),detail:short(raw,150)};if(type==="membership_reaction_joined")return{title:"参加中のメンシプ反応",subject:actorName(r),detail:short(raw,150)};if(type==="membership_join")return{title:"メンシプ参加",subject:actorName(r),detail:short(raw,150)};if(type==="membership_started")return{title:"メンバーシップ開始",subject:r.target_title||actorName(r),detail:short(raw,130)};if(type==="tip")return{title:"チップ・サポート",subject:ctx||r.target_title||actorName(r),detail:short(raw,150)};return{title:LABEL[type]||"通知",subject:ctx||r.target_title||"",detail:short(raw,160)}}
function href(r:Row){return String(r.target_url||r.source_url||r.actor_url||"")}
function targetLabel(r:Row){const u=String(r.target_url||"");if(/\/membership/.test(u))return"メンシプを開く ↗";if(/\/m\//.test(u))return"対象マガジン ↗";if(/\/n\//.test(u))return"対象記事 ↗";return u?"対象ページ ↗":r.actor_url?"相手ページ ↗":""}
function rowKey(r:Row){return`${displayType(r)}|${canonical(r.raw_text)}|${String(r.actor_url||"").split("?")[0]}|${String(r.occurred_at||"")}`}
function Avatar({row,selfId}:{row:Row;selfId:string}){
 const name=actorName(row),top=creatorTop(row.actor_url,selfId),image=safeActorImage(row.actor_image_url),visual=creatorNoteId(row)||image?<CreatorAvatar person={{...row,actor_image_url:image}} name={name} className="minf-avatar"/>:<span className="minf-avatar fallback" aria-label={name}>{ICON_FALLBACK[displayType(row)]||([...(name||"")][0]||"🔔")}</span>;
 return top?<a href={top} target="_blank" rel="noreferrer" aria-label={`${name}のクリエイターページ`}>{visual}</a>:visual;
}

export function NotificationFormatAlerts({ownerSession=false}:{ownerSession?:boolean}){
 const[alerts,setAlerts]=useState<Row[]>([]),[error,setError]=useState(""),[busy,setBusy]=useState("");
 const live=useRef(true);
 async function request(action="list",kind=""){
  const token=localStorage.getItem(ownerSession?"mumei-unified-owner-token":INSIGHT_TOKEN_KEY)||"";if(!token)return;
  try{const r=await fetchInsightResource(FEED.replace("feed-final","format-reviews"),{method:"POST",headers:{"Content-Type":"application/json",[ownerSession?"X-Owner-Token":"X-Insight-Token"]:token},body:JSON.stringify({action,kind}),cache:"no-store"});const p=await r.json();if(!r.ok||!p.ok)throw new Error("分類案内を確認できません");if(live.current){setAlerts(p.alerts||[]);setError("")}}catch(e){if(live.current)setError(e instanceof Error?e.message:String(e))}finally{if(live.current)setBusy("")}
 }
 useEffect(()=>{live.current=true;void request();const refresh=()=>{if(document.visibilityState!=="hidden")void request()},timer=window.setInterval(refresh,300000);window.addEventListener("focus",refresh);window.addEventListener("mumei-notification-classified",refresh);return()=>{live.current=false;window.clearInterval(timer);window.removeEventListener("focus",refresh);window.removeEventListener("mumei-notification-classified",refresh)}},[ownerSession]);
 if(!alerts.length&&!error)return null;
 return <details className="minf-owner-formats" aria-label="運営者向け分類案内"><summary>運営者用：未対応の通知形式 {alerts.length}種類</summary><small>全参加者の新しい通知形式を集約しています。ルールの対応後、保存済み通知も自動で再分類します。</small>{error?<p role="status">{error}</p>:null}{alerts.map(a=><div className="minf-category-alert" key={a.kind}><span>{a.read_at?"既読":"● 未読"} · {a.kind}</span><small>{Number(a.notification_count||0)}件をその他に保存済み</small><button disabled={Boolean(busy)} onClick={()=>{setBusy(a.kind);void request(a.read_at?"unread":"read",a.kind)}}>{busy===a.kind?"保存中…":a.read_at?"未読に戻す":"既読にする"}</button></div>)}</details>
}


type SavePhase="pending"|"saved"|"rollback";
function NotificationCompletion({row,onSaved,onError=()=>{}}:{row:Row;onSaved:(row:Row,phase?:SavePhase)=>void;onError?:(message:string)=>void}){
 const[busy,setBusy]=useState(false),[failure,setFailure]=useState("");
 function toggle(){const token=localStorage.getItem(INSIGHT_TOKEN_KEY),key=`${token}|notification|${row.id}`,before=Boolean(pendingCompletion(key)??row.confirmed),completed=!before;flushSync(()=>{setBusy(true);setFailure("");onSaved({id:row.id,confirmed:completed},"pending")});queueCompletion(key,Boolean(row.confirmed),completed,
  value=>post({action:"completion",id:row.id,completed:value}),
  ()=>localStorage.getItem(INSIGHT_TOKEN_KEY)===token,
  (value,failed)=>{onSaved({id:row.id,confirmed:value},"saved");setBusy(false);if(failed){const message="保存できなかったため、未保存の変更を元に戻しました。";setFailure(message);onError(message)}});}

 return <div className="minf-completion"><button className={busy?"is-saving is-flashing":""} aria-pressed={Boolean(row.confirmed)} aria-busy={busy} aria-label={row.confirmed?"未対応に戻す":"対応済みにする"} title={row.confirmed?"未対応に戻す":"対応済みにする"} onClick={()=>toggle()}>{row.confirmed?"✓ 対応済み":"対応済み"}</button>{failure?<small role="alert">{failure}</small>:null}</div>
}
function NotificationFavorite({row,onSaved,onError}:{row:Row;onSaved:(row:Row,phase?:SavePhase)=>void;onError:(message:string)=>void}){
 const[busy,setBusy]=useState(false);
 if(!noteId(row.actor_url))return null;
 async function toggle(){if(busy||row.favorite_pending)return;const token=localStorage.getItem(INSIGHT_TOKEN_KEY),before=Boolean(row.favorite),favorite=!before;setBusy(true);onSaved({id:row.id,favorite},"pending");try{const x=await post({action:"favorite_toggle",id:row.id,favorite});if(localStorage.getItem(INSIGHT_TOKEN_KEY)===token){onSaved({id:row.id,favorite:x.favorite,favorite_creator_key:x.creatorKey},"saved");window.dispatchEvent(new Event("mumei-insight-favorites-changed"))}}catch{if(localStorage.getItem(INSIGHT_TOKEN_KEY)===token){onSaved({id:row.id,favorite:before},"rollback");onError("お気に入りを保存できなかったため元に戻しました。")}}finally{setBusy(false)}}
 return <button className={`minf-star ${row.favorite?"active":""} ${busy?"is-flashing":""}`} aria-pressed={Boolean(row.favorite)} aria-label={row.favorite?"お気に入り解除":"お気に入り登録"} aria-busy={busy||Boolean(row.favorite_pending)} disabled={busy||Boolean(row.favorite_pending)} onClick={()=>void toggle()}>{row.favorite?"★":"☆"}</button>
}
function commentConversation(value:any,articleKey:string,commentKey:string){
 if(!value||!articleKey||value.articleKey!==articleKey||!Array.isArray(value.messages))return null;
 const seen=new Set<string>(),messages=value.messages.filter((m:any)=>m&&typeof m.commentKey==="string"&&typeof m.body==="string"&&savedCommentText({comment_body:m.body})&&!seen.has(m.commentKey)&&(seen.add(m.commentKey),true));
 if(!messages.some((m:any)=>m.commentKey===commentKey))return null;
 const root=String(value.threadKey||"");
 if(root&&messages.some((m:any)=>m.commentKey===root&&m.parentKey!==null))return null;
 // Multiple messages need explicit parent links to the same proven root, never actor matching.
 const linked=new Set(root?[root]:[commentKey]);for(let n=0;n<messages.length;n++)for(const m of messages)if(m.parentKey&&linked.has(m.parentKey))linked.add(m.commentKey);
 const safe=messages.filter((m:any)=>root?linked.has(m.commentKey)&&(m.commentKey!==root||m.parentKey===null):m.commentKey===commentKey);
 if(!safe.some((m:any)=>m.commentKey===commentKey))return null;
 return {...value,messages:safe.sort((a:any,b:any)=>(Date.parse(a.occurredAt)||0)-(Date.parse(b.occurredAt)||0)||a.commentKey.localeCompare(b.commentKey))};
}
function NotificationComment({row,onSaved}:{row:Row;onSaved:(row:Row)=>void}){
 const identity=row.comment_identity,key=String(identity?.commentKey||row.meta?.comment_key||""),liked=row.notification_type==="comment_like",board=["membership_board","membership_board_reply"].includes(String(row.display_category||row.notification_type)),reply=row.notification_type==="reply"||String(row.display_category||row.notification_type)==="membership_board_reply";
 const token=localStorage.getItem(INSIGHT_TOKEN_KEY)||"",supplied=savedCommentText(row),suppliedConversation=commentConversation(row.meta?.comment_conversation,String(identity?.articleKey||row.meta?.comment_conversation?.articleKey||""),key);
 const locator=JSON.stringify([token,row.member_id||"",row.id,identity?.articleKey||"",identity?.commentKey||"",identity?.url||"",row.comment_key||"",row.meta?.comment_key||"",row.target_url||"",row.source_url||"",row.meta?.all_area_url||"",row.meta?.featured_area_url||""]);
 const[state,setState]=useState({locator,body:supplied,conversation:suppliedConversation,busy:false,message:"",missing:false,attempted:false}),details=useRef<HTMLDetailsElement|null>(null),currentLocator=useRef(locator),request=useRef<{seq:number;controller:AbortController|null}>({seq:0,controller:null});currentLocator.current=locator;
 const same=state.locator===locator,body=supplied||(same?state.body:""),conversation=suppliedConversation||(same?state.conversation:null),busy=same&&state.busy,message=same?state.message:"",missing=same&&state.missing;
 useEffect(()=>{
  request.current.seq++;request.current.controller?.abort();request.current.controller=null;
  setState(previous=>({locator,body:supplied||(previous.locator===locator?previous.body:""),conversation:suppliedConversation||(previous.locator===locator?previous.conversation:null),busy:false,message:previous.locator===locator?previous.message:"",missing:previous.locator===locator&&previous.missing,attempted:previous.locator===locator&&previous.attempted}));
  if(details.current?.open&&!body)void resolve();
  return()=>{request.current.seq++;request.current.controller?.abort();request.current.controller=null};
 },[locator,supplied]);
 async function resolve(explicit=false){
  if((!explicit&&(body||same&&state.attempted))||missing||request.current.controller||!token||token!==(localStorage.getItem(INSIGHT_TOKEN_KEY)||""))return;
  const controller=new AbortController(),seq=++request.current.seq;request.current.controller=controller;
  const valid=()=>seq===request.current.seq&&!controller.signal.aborted&&currentLocator.current===locator&&token===(localStorage.getItem(INSIGHT_TOKEN_KEY)||"");
  setState(previous=>valid()?{locator,body,conversation,busy:true,message:"",missing:false,attempted:true}:previous);
  try{
   const x=await post({action:"comment_detail",id:row.id,includeConversation:explicit,...(explicit&&conversation?{refreshConversation:true}:{})},controller.signal);if(!valid())return;
   const text=savedCommentText({comment_body:x.body})||body,thread=commentConversation(x.conversation,String(x.articleKey||identity?.articleKey||""),String(x.commentKey||key))||conversation;
   const message=x.status==="missing_id"?(board?"掲示板の本文はまだ取得・保存されていません。対象掲示板から確認できます。":"この旧通知には対象コメントIDが保存されていないため、会話を特定できません。保存済みの本文は保持しています。"):
    !x.body?"対象本文を取得できませんでした。保存済みの内容は保持しています。":x.persisted===false?"本文は表示中ですが、保存を確認できていません。":"";
   setState(previous=>valid()?{locator,body:text,conversation:thread,busy:false,message,missing:x.status==="missing_id",attempted:true}:previous);
   if(text||thread)onSaved({id:row.id,comment_body:text,...(x.articleKey&&x.commentKey?{comment_identity:{articleKey:x.articleKey,commentKey:x.commentKey,url:x.url}}:{}),meta:{...(text?{comment_body:text}:{}),...(x.commentKey?{comment_key:x.commentKey}:{}),...(x.author?{comment_author:x.author}:{}),...(thread?{comment_conversation:thread}:{}),...(x.commentKey&&savedCommentText({comment_body:x.body})?{comment_body_source:"exact-comment-id"}:{})}});
  }catch{if(valid())setState(previous=>valid()?{...previous,busy:false,message:"会話を取得できませんでした。保存済みの内容は保持しています。"}:previous)}
  finally{if(request.current.controller===controller)request.current.controller=null;if(valid())setState(previous=>valid()?{...previous,busy:false}:previous)}
 }
 const messages=conversation?.messages?.length?conversation.messages:body?[{commentKey:key||String(row.id),body,author:row.meta?.comment_author||null,isSelf:false,occurredAt:null}]:[];
 return <details ref={details} className="minf-comment-context" onToggle={e=>{if(e.currentTarget.open)void resolve()}}><summary>{liked?"スキされたコメント本文":reply?"返信本文・会話":board?"掲示板本文":"コメント本文・会話"}{key?` · ${key}`:""}</summary><div>
 {messages.length?<><ol className="minf-conversation" aria-label="保存したコメントの会話">{messages.map((m:any)=><li key={m.commentKey} className={m.isSelf?"minf-message self":"minf-message other"}><small>{m.isSelf?"自分":m.author||"投稿者未確認"}{m.occurredAt?` · ${new Date(m.occurredAt).toLocaleString("ja-JP",{timeZone:"Asia/Tokyo"})}`:""}</small><p>{m.body}</p></li>)}</ol><small>取得・保存できた範囲の履歴です。{messages.length===1?"会話全体はまだ確認できていません。":""}</small></>:null}
 {busy?<p role="status" aria-busy="true">本文を照合中…</p>:null}{message?<p role="status">{message}</p>:!messages.length&&!busy?<p>本文を読み込みます。</p>:null}
 {identity?.url||board&&href(row)?<a href={identity?.url||href(row)} target="_blank" rel="noreferrer">{board?"対象掲示板 ↗":"対象コメント ↗"}</a>:null}
 {!busy&&!missing?<button onClick={()=>void resolve(true)}>{conversation?"新しい返信を確認":body?"会話を確認":"本文を再読込"}</button>:null}</div></details>
}

export function MemberInsightNotificationsFinal({revision=0,noteId:memberNoteId=""}:{revision?:number;noteId?:string}){
  const account=accountKey(memberNoteId),sessionToken=localStorage.getItem(INSIGHT_TOKEN_KEY)||"",selectionKey=`${account}|${sessionToken}`;
  const[initial]=useState(()=>{
    const saved=savedNotificationView(account,sessionToken),selection=NOTIFICATION_SELECTION_CACHE.get(selectionKey)||saved?.value.selection||{kind:"all",handlingStatus:"all",selectedDay:"",page:1},cached=NOTIFICATION_VIEW_CACHE.get(`${account}|${selection.kind}|${selection.selectedDay}|${selection.page}|${selection.handlingStatus}`),usable=cached?.token===sessionToken&&cached.complete&&canRetainInsightView(cached.cachedAt)?cached:undefined,matchingSaved=saved&&selectionId(saved.value.selection)===selectionId(selection)?saved:null;
    return{selection,cached:usable,saved:matchingSaved,rows:usable?.rows||matchingSaved?.value.rows||[]};
  });
  const initialView=initial.cached||initial.saved?.value;
  const[rows,setRows]=useState<Row[]>(initial.rows),[kind,setKind]=useState(initial.selection.kind),[handlingStatus,setHandlingStatus]=useState(initial.selection.handlingStatus),[statusCounts,setStatusCounts]=useState<Record<string,number>>(initialView?.statusCounts||{}),[selectedDay,setSelectedDay]=useState(initial.selection.selectedDay),[page,setPage]=useState(initial.selection.page),[total,setTotal]=useState(initialView?.total??initial.rows.length),[loading,setLoading]=useState(!initialView),[error,setError]=useState(""),[updatedAt,setUpdatedAt]=useState<string>(initialView?.updatedAt||""),[checkedAt,setCheckedAt]=useState<Date|null>(null),[syncAt,setSyncAt]=useState<string>(initialView?.syncAt||"");
  const[visibleSelection,setVisibleSelection]=useState(initialView?selectionId(initial.selection):""),[visibleOwner,setVisibleOwner]=useState(selectionKey),[savedDisplayAt,setSavedDisplayAt]=useState(initial.cached?0:initial.saved?.savedAt||0);
  useEffect(()=>{NOTIFICATION_SELECTION_CACHE.set(selectionKey,{kind,handlingStatus,selectedDay,page})},[selectionKey,kind,handlingStatus,selectedDay,page]);
  const localEdits=useRef(new Map<string,Row>()),lastSnapshot=useRef("");
  const passiveDisplay=useRef({key:"",blocked:false});
  function overlayEdits(list:Row[],includeMissing=true):Row[]{const map=new Map(list.map(r=>[String(r.id),r]));for(const row of includeMissing?readBoard(accountKey(memberNoteId)):[])if(localEdits.current.has(String(row.id))&&!map.has(String(row.id)))map.set(String(row.id),row);return [...map.values()].map(r=>{const creator=noteId(r.actor_url),favorite=[...localEdits.current.values()].find(p=>"favorite" in p&&noteId(p.actor_url)===creator);return{...r,...(favorite?{favorite:favorite.favorite,favorite_pending:true}:{}),...localEdits.current.get(String(r.id))}})}
  function saveRow(patch:Row,phase:SavePhase="saved"){
    passiveDisplay.current.blocked=true;
    const handling="confirmed" in patch,favoriting="favorite" in patch;
    if(handling||favoriting){request.current.id++;request.current.controller?.abort();request.current.controller=null;recentRequest.current.controller?.abort();recentRequest.current.controller=null;setLoading(false)}
    const account=accountKey(memberNoteId),id=String(patch.id),saved=rows.find(r=>String(r.id)===id)||readBoard(account).find(r=>String(r.id)===id),prior={...saved,...localEdits.current.get(id)},row:Row={...prior,...patch,meta:{...prior?.meta,...patch.meta}};
    // Never revive a pre-mutation snapshot while an acknowledgement is pending.
    if(phase==="pending"){lastSnapshot.current="";removeSavedInsightView("notifications",{account,token:sessionToken});localEdits.current.set(id,{...localEdits.current.get(id),actor_url:row.actor_url,...patch})}
    else{const edits={...localEdits.current.get(id)};for(const key of Object.keys(patch))delete edits[key];if(Object.keys(edits).some(k=>k!=="id"&&k!=="actor_url"))localEdits.current.set(id,edits);else localEdits.current.delete(id)}
    if(phase==="saved"){
      const acknowledged={...saved,...patch,meta:{...saved?.meta,...patch.meta}};let changed:Row[]=[acknowledged];
      if(favoriting&&saved?.actor_url)changed=readBoard(account).filter(r=>noteId(r.actor_url)===noteId(saved.actor_url)).map(r=>({...r,favorite:patch.favorite,favorite_creator_key:patch.favorite_creator_key||r.favorite_creator_key}));
      retainBoard(account,changed);
      const current=view.current,matchesView=(current.kind==="all"||displayType(row)===current.kind)&&(!current.selectedDay||new Date(row.occurred_at||row.captured_at).toLocaleDateString("sv-SE",{timeZone:"Asia/Tokyo"})===current.selectedDay);
      if(handling&&matchesView&&Boolean(saved?.confirmed)!==Boolean(patch.confirmed)){
        const delta=patch.confirmed?1:-1;setStatusCounts(v=>({...v,pending:Math.max(0,(v.pending||0)-delta),completed:Math.max(0,(v.completed||0)+delta)}));
        const change=Number(matchesHandling(row,current.handlingStatus))-Number(matchesHandling(saved||{},current.handlingStatus));
        if(change){setTotal(v=>Math.max(0,v+change));setCategoryCounts(v=>({...v,all:Math.max(0,(v.all||0)+change),[displayType(row)]:Math.max(0,(v[displayType(row)]||0)+change)}))}
      }
      if(handling||favoriting)for(const key of NOTIFICATION_VIEW_CACHE.keys())if(key.startsWith(account+"|"))NOTIFICATION_VIEW_CACHE.delete(key);
    }
    setRows(v=>{const updated=v.map(r=>String(r.id)===id?{...row,favorite_pending:favoriting?phase==="pending":row.favorite_pending}:favoriting&&noteId(r.actor_url)===noteId(row.actor_url)?{...r,favorite:row.favorite,favorite_pending:phase==="pending"}:r);return updated.some(r=>String(r.id)===id)?updated:[row,...updated]});
  }

  const[serverSync,setServerSync]=useState(initialView?.serverSync||{received:0,confirmed:0,source:""});
  const[checking,setChecking]=useState(false),[loadFailed,setLoadFailed]=useState(false),pendingChecks=useRef(0);
  const visibleState=useRef({rows,total,selection:visibleSelection,failed:loadFailed});visibleState.current={rows,total,selection:visibleSelection,failed:loadFailed};
  const beginCheck=()=>{pendingChecks.current++;setChecking(true)},finishCheck=()=>{pendingChecks.current=Math.max(0,pendingChecks.current-1);if(!pendingChecks.current)setChecking(false)};
  const request=useRef<{id:number;controller:AbortController|null}>({id:0,controller:null});
  const recentRequest=useRef<{controller:AbortController|null;watermark:string}>({controller:null,watermark:localStorage.getItem(`mumei-notification-recent-watermark:${accountKey(memberNoteId)}`)||""});
  const recentDeferred=useRef(false);
  const lastReaderRun=useRef(0),repairRunning=useRef(false),repairStop=useRef(false),repairRevision=useRef(0),lastRepairSync=useRef("");
  const view=useRef({kind,selectedDay,handlingStatus,page});view.current={kind,selectedDay,handlingStatus,page};

  const[categoryCounts,setCategoryCounts]=useState<Record<string,number>>(initialView?.categoryCounts||{}),[reclassifying,setReclassifying]=useState(false),[repairStatus,setRepairStatus]=useState("");
  const[readerStatus,setReaderStatus]=useState<any>(null);
  const[unresolved,setUnresolved]=useState<{remaining:number;insufficient:number}|null>(null);
  function discardSavedDisplay(token:string){
    passiveDisplay.current.blocked=true;
    removeSavedInsightView("notifications",{account,token});NOTIFICATION_SELECTION_CACHE.delete(`${account}|${token}`);lastSnapshot.current="";
    for(const [key,cached] of NOTIFICATION_VIEW_CACHE)if(key.startsWith(account+"|")&&cached.token===token)NOTIFICATION_VIEW_CACHE.delete(key);
    setRows([]);setTotal(0);setStatusCounts({});setCategoryCounts({});setUpdatedAt("");setSyncAt("");setServerSync({received:0,confirmed:0,source:""});setVisibleSelection("");setSavedDisplayAt(0);
  }
  async function load(p=1,k=kind,silent=false,day=selectedDay,force=false){
    if(silent&&request.current.controller&&!force)return;
    setLoadFailed(false);
    recentRequest.current.controller?.abort();recentRequest.current.controller=null;
    const cacheKey=`${accountKey(memberNoteId)}|${k}|${day||""}|${p}|${handlingStatus}`,cached=NOTIFICATION_VIEW_CACHE.get(cacheKey),token=localStorage.getItem(INSIGHT_TOKEN_KEY)||"",pageChanged=p!==view.current.page;
    if(!force&&cached?.complete&&cached.token===token&&cached.revision===revision&&isFreshInsightView(cached.cachedAt)){
      request.current.id++;request.current.controller?.abort();request.current.controller=null;
      setRows(overlayEdits(cached.rows,p===1).filter(r=>(k==="all"||displayType(r)===k)&&(!day||new Date(r.occurred_at||r.captured_at).toLocaleDateString("sv-SE",{timeZone:"Asia/Tokyo"})===day)));setPage(p);setTotal(cached.total);setStatusCounts(cached.statusCounts||{});setCategoryCounts(cached.categoryCounts);setUpdatedAt(cached.updatedAt);setSyncAt(cached.syncAt);setServerSync(cached.serverSync);setVisibleSelection(selectionId({kind:k,selectedDay:day,handlingStatus,page:p}));setSavedDisplayAt(0);setLoading(false);setError("");
      if(pageChanged)document.querySelector("#minf-notifications .minf-filter-panel")?.scrollIntoView?.({block:"start"});return;
    }
    request.current.controller?.abort();const controller=new AbortController(),id=++request.current.id;request.current.controller=controller;
    const valid=()=>id===request.current.id&&!controller.signal.aborted&&localStorage.getItem(INSIGHT_TOKEN_KEY)===token;
    const visible=visibleState.current,retainingEmpty=!visible.failed&&visible.total===0&&visible.selection===selectionId({kind:k,selectedDay:day,handlingStatus,page:p});
    beginCheck();if(!silent||!retainingEmpty&&!visible.rows.some(r=>matchesHandling(r,handlingStatus)&&(k==="all"||displayType(r)===k)&&(!day||new Date(r.occurred_at||r.captured_at).toLocaleDateString("sv-SE",{timeZone:"Asia/Tokyo"})===day)))setLoading(true);setError("");
    // Fetch the selected page only; unseen category previews delay it and repeat on every refresh.
    try{const x=await post({kind:k,page:p,pageSize:PAGE,day:day||null,includeCategoryPreview:false,classificationRevision:repairRevision.current,handlingStatus},controller.signal);if(!valid())return;
      const feedId=String(x.noteId||"").toLowerCase(),expected=accountKey(memberNoteId).toLowerCase();
      if(expected&&feedId!==expected){discardSavedDisplay(token);setError(`通知アカウント不一致：@${expected} / @${feedId}。アカウント切替を確認してください。`);return}
      const lastPage=Math.max(1,Math.ceil(Number(x.total)/PAGE));if(p>lastPage){request.current.controller=null;await load(lastPage,k,silent,day,true);return}
      if(Number(x.total)>0&&!x.rows.length)throw new Error("通知一覧の応答が不完全です。件数を確認しましたが本文を取得できませんでした。");
      const stored=new Map(readBoard(accountKey(memberNoteId)).map(r=>[String(r.id||rowKey(r)),r]));const baseList=mergeMagazineJoinRows(repairActorRows(x.rows||[])).map(r=>keepIcon(r,stored.get(String(r.id||rowKey(r))))).sort(notificationBoardOrder);
      // Validate server rows before applying optimistic local completion changes.
      if(Number(x.total)>0&&!baseList.some(r=>matchesHandling(r,handlingStatus)&&(k==="all"||displayType(r)===k)&&(!day||new Date(r.occurred_at||r.captured_at).toLocaleDateString("sv-SE",{timeZone:"Asia/Tokyo"})===day)))throw new Error("通知一覧の応答が不完全です。指定した条件の本文を取得できませんでした。");
      const list=overlayEdits(baseList,p===1).filter(r=>(k==="all"||displayType(r)===k)&&(!day||new Date(r.occurred_at||r.captured_at).toLocaleDateString("sv-SE",{timeZone:"Asia/Tokyo"})===day)).sort(notificationBoardOrder);if(!valid())return;
      const nextCounts=x.categoryCounts||{},nextStatusCounts=x.statusCounts||{},nextServer={received:Number(x.lastSyncReceived||0),confirmed:Number(x.lastSyncConfirmed??x.lastSyncInserted??0),source:String(x.lastSyncSource||"")},cacheAccount=feedId||expected||"current",cacheKey=`${cacheAccount}|${k}|${day||""}|${p}|${handlingStatus}`;
      passiveDisplay.current.blocked=true;setRows(list);setVisibleSelection(selectionId({kind:k,selectedDay:day,handlingStatus,page:p}));setSavedDisplayAt(0);setStatusCounts(nextStatusCounts);if(x.unresolved)setUnresolved(x.unresolved);setTotal(Number(x.total||0));setCategoryCounts(nextCounts);setPage(p);setCheckedAt(new Date());setUpdatedAt(String(x.lastUpdatedAt||""));setSyncAt(String(x.lastSyncAt||""));setServerSync(nextServer);
      NOTIFICATION_VIEW_CACHE.set(cacheKey,{rows:baseList,statusCounts:nextStatusCounts,total:Number(x.total||0),categoryCounts:nextCounts,updatedAt:String(x.lastUpdatedAt||""),syncAt:String(x.lastSyncAt||""),serverSync:nextServer,cachedAt:Date.now(),complete:true,revision,token});
      const boardIncoming=[...baseList];
      for(const [category,preview] of Object.entries(x.categoryPreview||{})){
        const entries=mergeMagazineJoinRows(repairActorRows(preview as Row[])).sort(notificationBoardOrder);boardIncoming.push(...entries);
        const previewKey=`${cacheAccount}|${category}|${day||""}|1|${handlingStatus}`,prior=NOTIFICATION_VIEW_CACHE.get(previewKey);if(previewKey===cacheKey||prior?.complete&&prior.token===token)continue;
        NOTIFICATION_VIEW_CACHE.set(previewKey,{rows:entries,total:Number(nextCounts[category]||0),categoryCounts:nextCounts,updatedAt:String(x.lastUpdatedAt||""),syncAt:String(x.lastSyncAt||""),serverSync:nextServer,cachedAt:Date.now(),complete:entries.length>=Math.min(Number(nextCounts[category]||0),PAGE),revision,token});
      }
      retainBoard(cacheAccount,boardIncoming);markBoardFresh(cacheAccount,String(x.lastUpdatedAt||""),String(x.lastSyncAt||""));
      if(pageChanged&&!silent)document.querySelector("#minf-notifications .minf-filter-panel")?.scrollIntoView?.({block:"start"});
      if(Number(x.reclassifyPending)>0&&!repairRunning.current&&lastRepairSync.current!==String(x.lastSyncAt||"initial")){lastRepairSync.current=String(x.lastSyncAt||"initial");void reclassify(true)}
      // Identity enrichment never delays the notification text.
      void enrich(baseList).then(enriched=>{if(!valid())return;setRows(previous=>previous.map(row=>keepIcon(row,enriched.find(e=>e.id===row.id))));retainEnrichedIcons(cacheAccount,enriched);const cached=NOTIFICATION_VIEW_CACHE.get(cacheKey);if(cached)NOTIFICATION_VIEW_CACHE.set(cacheKey,{...cached,rows:cached.rows.map(row=>keepIcon(row,enriched.find(icon=>icon.id===row.id)))})});
    }catch(e){if(valid()){
      const failedAuth=[401,403].includes(Number((e as {status?:number})?.status));
      if(failedAuth)discardSavedDisplay(token);
      const saved=failedAuth?null:savedNotificationView(account,token),selection={kind:k,selectedDay:day,handlingStatus,page:p},fallback=saved&&selectionId(saved.value.selection)===selectionId(selection)?saved:null;
      if(fallback&&!rows.length){const value=fallback.value;setRows(value.rows);setVisibleSelection(selectionId(selection));setSavedDisplayAt(fallback.savedAt);setTotal(value.total);setPage(p);setCategoryCounts(value.categoryCounts);setStatusCounts(value.statusCounts);setUpdatedAt(value.updatedAt);setSyncAt(value.syncAt);setServerSync(value.serverSync)}
      const detail=e instanceof Error?e.message:"時間をおいて再試行してください",reason=/57014|statement timeout/i.test(detail)?"通知の取得が時間切れになりました。時間をおいて再試行してください。":detail;
      setLoadFailed(true);setError("通知履歴の読込に失敗しました："+reason+(fallback?"｜最新確認に失敗したため前回保存分を表示しています":""));
    }}
    finally{finishCheck();if(id===request.current.id){request.current.controller=null;setLoading(false);if(recentDeferred.current){recentDeferred.current=false;void refreshRecent()}}}
  }
  async function refreshRecent(allowDuringFull=false){
    if(view.current.page!==1||recentRequest.current.controller||document.visibilityState==="hidden")return;
    if(request.current.controller&&!allowDuringFull){recentDeferred.current=true;return}
    const controller=new AbortController(),token=localStorage.getItem(INSIGHT_TOKEN_KEY),account=accountKey(memberNoteId),selection=JSON.stringify(view.current);recentRequest.current.controller=controller;beginCheck();let paginationChanged=false;
    try{
      const x=await post({action:"recent",since:recentRequest.current.watermark||null},controller.signal);
      if(controller.signal.aborted||localStorage.getItem(INSIGHT_TOKEN_KEY)!==token||view.current.page!==1||JSON.stringify(view.current)!==selection)return;
      if(String(x.noteId||"").toLowerCase()!==account){discardSavedDisplay(token||"");request.current.id++;request.current.controller?.abort();request.current.controller=null;setLoading(false);setError("通知アカウントが一致しないため前回表示分を閉じました。");return}
      recentRequest.current.watermark=String(x.watermark||recentRequest.current.watermark);try{localStorage.setItem(`mumei-notification-recent-watermark:${account}`,recentRequest.current.watermark)}catch{}
      if(hasFreshBoard(account))markBoardFresh(account,String(x.lastUpdatedAt||""),String(x.lastSyncAt||""));
      const serverIncoming=mergeMagazineJoinRows(repairActorRows(x.rows||[])).filter(boardRow),incoming=overlayEdits(serverIncoming),prior=new Map([...readBoard(account),...rows].map(row=>[String(row.id||rowKey(row)),row]));paginationChanged=serverIncoming.some(row=>{const before=prior.get(String(row.id||rowKey(row)));return !before||displayType(before)!==displayType(row)||Boolean(before.confirmed)!==Boolean(row.confirmed)||Boolean(request.current.controller)&&notificationRevision(before)!==notificationRevision(row)});if(paginationChanged)for(const [key,cached] of NOTIFICATION_VIEW_CACHE)if(key.startsWith(account+"|"))NOTIFICATION_VIEW_CACHE.set(key,{...cached,complete:false});retainBoard(account,serverIncoming);
      if(incoming.length)setRows(previous=>{
        const map=new Map(previous.map(r=>[String(r.id||rowKey(r)),r]));for(const r of incoming){const id=String(r.id||rowKey(r));map.set(id,keepIcon(r,map.get(id)))}
        return [...map.values()].filter(r=>matchesHandling(r,handlingStatus)&&(kind==="all"||displayType(r)===kind)&&(!selectedDay||new Date(r.occurred_at||r.captured_at).toLocaleDateString("sv-SE",{timeZone:"Asia/Tokyo"})===selectedDay)).sort(notificationBoardOrder).slice(0,PAGE);
      });
      void enrich(serverIncoming).then(enriched=>{if(controller.signal.aborted||localStorage.getItem(INSIGHT_TOKEN_KEY)!==token)return;retainEnrichedIcons(account,enriched);setRows(previous=>previous.map(row=>keepIcon(row,enriched.find(e=>e.id===row.id))))});
      setCheckedAt(new Date());
    }catch(e){
      if(!controller.signal.aborted&&localStorage.getItem(INSIGHT_TOKEN_KEY)===token&&[401,403].includes(Number((e as {status?:number})?.status))){discardSavedDisplay(token||"");request.current.id++;request.current.controller?.abort();request.current.controller=null;setLoading(false);setError("ログインを確認できないため前回表示分を閉じました。")}
      // Network failures keep the explicitly labelled previous display.
    }
    finally{finishCheck();if(recentRequest.current.controller===controller)recentRequest.current.controller=null;if(paginationChanged&&!controller.signal.aborted&&localStorage.getItem(INSIGHT_TOKEN_KEY)===token&&JSON.stringify(view.current)===selection)void load(view.current.page,view.current.kind,true,view.current.selectedDay,true)}
  }
  async function reclassify(auto=true){
    if(repairRunning.current)return false;
    repairRunning.current=true;repairStop.current=false;setReclassifying(true);
    const account=accountKey(memberNoteId),progressKey=`mumei-notification-repair:${account}:${auto?"pending":"manual"}`,token=localStorage.getItem(INSIGHT_TOKEN_KEY)||"";
    let cursor:string|null=null,checked=0,moved=0,finished=false,remaining:{remaining:number;insufficient:number}|null=null;
    try{const saved=JSON.parse(localStorage.getItem(progressKey)||"null");if(auto&&saved?.version===CLASSIFIER_VERSION){cursor=saved.cursor;checked=saved.checked||0;moved=saved.moved||0}}catch{}
    setRepairStatus("その他・未分類の未処理分を確認中…");
    try{
      const seen=new Set<string>();
      do{
        if(repairStop.current||document.visibilityState==='hidden')break;
        if(localStorage.getItem(INSIGHT_TOKEN_KEY)!==token)throw new Error("アカウントが切り替わりました");
        const ac=new AbortController(),timer=window.setTimeout(()=>ac.abort(),30000);
        let x:any;
        try{const r=await fetchInsightResource(FEED.replace("feed-final","reclassify"),{method:"POST",headers:{"Content-Type":"application/json","X-Insight-Token":token},body:JSON.stringify({cursor,onlyPending:auto}),signal:ac.signal});x=await r.json();if(!r.ok||!x.ok)throw new Error(x.error||"再分類失敗")}
        finally{window.clearTimeout(timer)}
        checked+=Number(x.checked||0);moved+=Number(x.moved||0);if(x.unresolved){remaining=x.unresolved;setUnresolved(x.unresolved)}
        const next=x.nextCursor||null;if(next&&(next===cursor||seen.has(next)))throw new Error("分類位置が進まないため停止しました");if(next)seen.add(next);cursor=next;finished=!next;
        try{localStorage.setItem(progressKey,JSON.stringify({version:CLASSIFIER_VERSION,cursor,checked,moved}))}catch{/* Server progress remains acknowledged even if browser storage is full. */}
        setRepairStatus(`${checked}件確認・${moved}件修正${cursor?"・続きあり":""}`);
        if(Array.isArray(x.rows)&&x.rows.length){
          const repaired=repairActorRows(x.rows),current=view.current;retainBoard(account,repaired);repairRevision.current++;
          setRows(previous=>{const map=new Map(previous.map(r=>[String(r.id),r]));for(const r of repaired)if(map.has(String(r.id)))map.set(String(r.id),keepIcon(r,map.get(String(r.id))));return [...map.values()].filter(r=>current.kind==="all"||displayType(r)===current.kind)});
        }
        if(x.moved){repairRevision.current++;void load(view.current.page,view.current.kind,true,view.current.selectedDay,true);}
        if(cursor)await new Promise(r=>window.setTimeout(r,50));
      }while(cursor);
      if(!finished){setRepairStatus(`${checked}件まで確認・停止中（続きから再開できます）`);return false}
      try{localStorage.removeItem(progressKey);localStorage.setItem(`mumei-notification-reclassify-version:${account}`,CLASSIFIER_VERSION)}catch{}
      setRepairStatus(remaining?.remaining?`確認済み：今回${checked}件を確認・${moved}件を分類。未解決${remaining.remaining}件（本文不足${remaining.insufficient}件）。`:checked?`${checked}件を確認・${moved}件を分類。未解決はありません。`:"新たに再分類する通知はありません。");window.dispatchEvent(new Event("mumei-notification-classified"));
      void load(view.current.page,view.current.kind,true,view.current.selectedDay,true);return true;
    }catch(e){setRepairStatus(`途中保存済み・再開できます：${e instanceof Error?e.message:String(e)}`);return false}
    finally{repairRunning.current=false;setReclassifying(false)}
  }
  useEffect(()=>()=>{repairStop.current=true},[]);
  const loadedSelection=useRef(""),loadedRevision=useRef(revision);
  useEffect(()=>{
    const opening=!loadedSelection.current,account=accountKey(memberNoteId),selection=JSON.stringify([account,sessionToken,kind,selectedDay,handlingStatus]),changed=Boolean(loadedSelection.current&&loadedSelection.current!==selection),p=changed?1:page,force=loadedRevision.current!==revision;
    loadedSelection.current=selection;loadedRevision.current=revision;
    passiveDisplay.current={key:JSON.stringify([selectionKey,selectionId({kind,selectedDay,handlingStatus,page:p}),revision]),blocked:false};
    const identityChanged=visibleOwner!==selectionKey;if(identityChanged)localEdits.current.clear();
    const stored=NOTIFICATION_VIEW_CACHE.get(`${account}|${kind}|${selectedDay||""}|${p}|${handlingStatus}`),cached=stored?.token===sessionToken&&canRetainInsightView(stored.cachedAt)?stored:undefined,fresh=hasFreshBoard(account);
    const persisted=savedNotificationView(account,sessionToken),target={kind,selectedDay,handlingStatus,page:p},saved=persisted&&selectionId(persisted.value.selection)===selectionId(target)?persisted:null,verified=fresh&&p===1?filterBoard(account,kind,selectedDay,handlingStatus):[],instant=overlayEdits(cached?.rows||saved?.value.rows||verified,p===1).filter(r=>(kind==="all"||displayType(r)===kind)&&(!selectedDay||new Date(r.occurred_at||r.captured_at).toLocaleDateString("sv-SE",{timeZone:"Asia/Tokyo"})===selectedDay)),display=cached||saved?.value;
    setRows(instant);setVisibleOwner(selectionKey);setPage(p);setLoading(!display&&!verified.length);setVisibleSelection(display?selectionId(target):"");setSavedDisplayAt(cached?0:saved?.savedAt||0);
    if(display){setStatusCounts(display.statusCounts||{});setTotal(display.total);setCategoryCounts(display.categoryCounts);setUpdatedAt(display.updatedAt);setSyncAt(display.syncAt);setServerSync(display.serverSync)}else{setStatusCounts({});setTotal(identityChanged?instant.length:categoryCounts[kind]??instant.length);if(identityChanged){setCategoryCounts({});setUpdatedAt("");setSyncAt("");setServerSync({received:0,confirmed:0,source:""});setCheckedAt(null)}}
    recentRequest.current.watermark=fresh?(localStorage.getItem(`mumei-notification-recent-watermark:${account}`)||""):"";void load(p,kind,true,selectedDay,force);if(opening&&p===1&&!(cached?.complete&&cached.revision===revision&&isFreshInsightView(cached.cachedAt)))void refreshRecent(true);
    return()=>{recentRequest.current.controller?.abort();recentRequest.current.controller=null;request.current.id++;request.current.controller?.abort();request.current.controller=null}
  },[kind,handlingStatus,selectedDay,revision,memberNoteId,sessionToken]);
  useEffect(()=>{
    const target={kind,selectedDay,handlingStatus,page},selected=selectionId(target),key=JSON.stringify([selectionKey,selected,revision]);
    const restore=()=>{
      const state=passiveDisplay.current;
      if(state.key!==key||state.blocked||visibleState.current.selection||localEdits.current.size||localStorage.getItem(INSIGHT_TOKEN_KEY)!==sessionToken)return;
      const saved=savedNotificationView(account,sessionToken);if(!saved||selectionId(saved.value.selection)!==selected)return;
      state.blocked=true;const value=saved.value;
      setRows(value.rows);setVisibleOwner(selectionKey);setVisibleSelection(selected);setSavedDisplayAt(saved.savedAt);setTotal(value.total);setStatusCounts(value.statusCounts);setCategoryCounts(value.categoryCounts);setUpdatedAt(value.updatedAt);setSyncAt(value.syncAt);setServerSync(value.serverSync);setLoading(false);
    };
    window.addEventListener("mumei-insight-storage-hydrated",restore);restore();
    return()=>window.removeEventListener("mumei-insight-storage-hydrated",restore);
  },[selectionKey,account,sessionToken,kind,selectedDay,handlingStatus,page,revision]);
  // Persist only the last displayed page. This copy never makes a view fresh and
  // therefore cannot suppress the selected-page/recent server checks on reopening.
  useEffect(()=>{
    const selection={kind,handlingStatus,selectedDay,page};
    if(visibleOwner!==selectionKey||!visibleSelection||visibleSelection!==selectionId(selection)||localEdits.current.size||!sessionToken||localStorage.getItem(INSIGHT_TOKEN_KEY)!==sessionToken)return;
    const value={selection,rows:rows.filter(r=>matchesHandling(r,handlingStatus)).slice(0,PAGE),statusCounts,total,categoryCounts,updatedAt,syncAt,serverSync} satisfies SavedNotificationView,signature=JSON.stringify([selectionKey,savedDisplayAt,value]);
    if(signature===lastSnapshot.current)return;
    writeSavedInsightView("notifications",{account,token:sessionToken},value,savedDisplayAt||Date.now());lastSnapshot.current=signature;
  },[account,sessionToken,visibleOwner,visibleSelection,kind,handlingStatus,selectedDay,page,rows,statusCounts,total,categoryCounts,updatedAt,syncAt,serverSync,savedDisplayAt]);
  useEffect(()=>{
    const noteId=accountKey(memberNoteId);
    if(!noteId||!localStorage.getItem(INSIGHT_TOKEN_KEY))return;
    const key=`mumei-notification-reclassify-version:${noteId}`;
    let done="";
    try{done=localStorage.getItem(key)||""}catch{}
    if(done===CLASSIFIER_VERSION)return;
    const t=window.setTimeout(()=>{void reclassify(true)},700);
    return()=>window.clearTimeout(t)
  },[memberNoteId,revision]);

  useEffect(()=>{const refresh=()=>{if(document.visibilityState==="visible")void refreshRecent()},timer=window.setInterval(refresh,8000),full=window.setInterval(()=>{if(document.visibilityState==="visible")void load(page,kind,true,selectedDay,true)},120000);window.addEventListener("focus",refresh);window.addEventListener("pageshow",refresh);window.addEventListener("online",refresh);document.addEventListener("visibilitychange",refresh);return()=>{window.clearInterval(timer);window.clearInterval(full);window.removeEventListener("focus",refresh);window.removeEventListener("pageshow",refresh);window.removeEventListener("online",refresh);document.removeEventListener("visibilitychange",refresh)}},[kind,handlingStatus,selectedDay,page,memberNoteId]);
  useEffect(()=>{
    const noteId=accountKey(memberNoteId);
    if(!noteId)return;
    const PAGE_SOURCE="mumei-notification-status-ui-v1",BRIDGE="mumei-notification-status-bridge-v1";
    const receive=(e:MessageEvent)=>{if(e.origin!==location.origin||e.data?.source!==BRIDGE||e.data?.type!=="state"||String(e.data?.noteId||"").toLowerCase()!==noteId)return;const next=e.data?.status||null;setReaderStatus(next);const run=Number(next?.lastRunAt||0);if(run&&run!==lastReaderRun.current){lastReaderRun.current=run;void refreshRecent()}};
    const ask=()=>window.postMessage({source:PAGE_SOURCE,type:"read",noteId},location.origin);
    window.addEventListener("message",receive);ask();const timer=window.setInterval(ask,1000);
    return()=>{window.removeEventListener("message",receive);window.clearInterval(timer)}
  },[memberNoteId,revision,kind,selectedDay]);
  const pages=Math.max(1,Math.ceil(total/PAGE)),selfId=String(memberNoteId||"").toLowerCase(),latest=syncAt||updatedAt;
  const readerMode=String(readerStatus?.lastRunMode||"");
  const readerLabel=readerMode==="full"||readerMode==="window"?"取得範囲の保存完了":readerMode==="delta"?"差分完了":readerMode==="partial"?"途中保存":readerMode==="error"?"読取エラー":readerStatus?.historyComplete?"全履歴確認済み":"端末状態 未確認";
  const readerClass=readerMode==="error"?"error":readerMode==="partial"?"partial":readerMode==="full"||readerMode==="delta"?"done":"idle";
  const serverLabel=syncAt?"サーバー反映済み":"サーバー反映 未確認";
  const pageControls=()=>pages>1?<nav className="minf-pager" aria-label="本人通知のページ送り"><button disabled={page<=1||loading} onClick={()=>void load(page-1,kind,false,selectedDay)}>← 前</button><label><span>ページ</span><select value={page} disabled={loading} onChange={e=>void load(Number(e.target.value),kind,false,selectedDay)}>{Array.from({length:pages},(_,i)=><option key={i+1} value={i+1}>{i+1} / {pages}</option>)}</select></label><button disabled={page>=pages||loading} onClick={()=>void load(page+1,kind,false,selectedDay)}>次 →</button>{loading?<small role="status">ページを読み込み中…</small>:null}</nav>:null;
  if(visibleOwner!==selectionKey)return <section id="minf-notifications" className="minf" aria-busy="true"><p className="minf-empty">通知を読み込み中…</p></section>;
  return <section id="minf-notifications" className="minf" aria-busy={loading||checking}>
    <header className="minf-head"><div><small>PRIVATE NOTIFICATION HISTORY</small><h2>本人通知</h2><p>保存済み通知を即表示。分類・日付・精度確認は1パネルにまとめています。</p></div><div className="minf-actions"><a className="minf-note" href="https://note.com/">🔔 note通知</a></div></header>
    <div className={`minf-quick ${readerClass}`} role="status">
      <div className="minf-quick-save"><span>最終保存</span><strong>{latest?date(latest):"確認中…"}</strong><i>{readerLabel}</i></div>
      <div className="minf-quick-progress"><b>読込 {readerStatus?Number(readerStatus.lastRunReadCount||0):0}</b><b>保存 {readerStatus?Number(readerStatus.lastRunSavedCount||0):0}</b></div>
    </div>
    <nav className="minf-handling-tabs" aria-label="本人通知の対応状況">{[["all","すべて"],["pending","未対応"],["completed","対応済み"]].map(([id,label])=><button key={id} className={handlingStatus===id?"active":""} aria-pressed={handlingStatus===id} onClick={()=>{setPage(1);setHandlingStatus(id)}}>{label}{statusCounts[id]!==undefined?<small>{statusCounts[id]}</small>:null}</button>)}<a href="?insightMode=favorites#dashboard">★ お気に入り</a></nav>
    <div className="minf-filter-panel" aria-label="本人通知の表示条件">
      <label><span>分類</span><select value={kind} onChange={e=>{setPage(1);setKind(e.target.value)}}>{CATS.map(([id,label])=><option key={id} value={id}>{label}{categoryCounts[id]!==undefined?` (${categoryCounts[id]})`:""}</option>)}</select></label>
      <label><span>日付</span><input type="date" value={selectedDay} onChange={e=>{setPage(1);setSelectedDay(e.target.value)}}/></label>
      {selectedDay?<button type="button" onClick={()=>{setPage(1);setSelectedDay("")}}>全期間</button>:<span className="minf-filter-total">全期間</span>}
    </div>
    <MemberInsightOutgoingComments noteId={selfId} revision={revision}/>
    <details className="minf-detail">
      <summary>詳細・精度・再分類 <span>開く / 閉じる ▾</span></summary>
      <div className="minf-detail-body">
        <div className="minf-reader-server"><b>{serverLabel}</b><span>{syncAt?date(syncAt):"—"}</span></div>
        <dl>
          <div><dt>端末 最終読取</dt><dd>{readerStatus?.lastRunAt?date(new Date(Number(readerStatus.lastRunAt)).toISOString()):"—"}</dd></div>
          <div><dt>今回 読取</dt><dd>{readerStatus?Number(readerStatus.lastRunReadCount||0)+"件":"—"}</dd></div>
          <div><dt>今回 保存確認</dt><dd>{readerStatus?Number(readerStatus.lastRunSavedCount||0)+"件":"—"}</dd></div>
          <div><dt>サーバー 受信</dt><dd>{syncAt?serverSync.received+"件":"—"}</dd></div>
          <div><dt>サーバー 保存確認</dt><dd>{syncAt?serverSync.confirmed+"件":"—"}</dd></div>
          <div><dt>画面確認</dt><dd>{checkedAt?date(checkedAt.toISOString()):"—"}</dd></div>
        </dl>
        <p>取得条件やnote側表示により欠落・重複・時刻ずれが起こる場合があります。重要な確認はnote本体を優先してください。</p>
        <button onClick={()=>{if(reclassifying)repairStop.current=true;else void reclassify(false)}}>{reclassifying?"再分類を停止":"未分類を再分類"}</button>
        {repairStatus?<p role="status">{repairStatus}</p>:null}{unresolved?.remaining?<p className="minf-unresolved">未解決 {unresolved.remaining}件 · 本文不足 {unresolved.insufficient}件 · 形式確認待ち {unresolved.remaining-unresolved.insufficient}件。未処理0件でも、未解決が0件になった意味ではありません。</p>:null}
        {selfId==="ss_yr"?<NotificationFormatAlerts/>:null}
        {readerStatus?.lastError?<p className="minf-reader-error">⚠ {String(readerStatus.lastError)}</p>:null}
      </div>
    </details>
    {savedDisplayAt?<p className="minf-saved-status" role="status">{error?"前回表示分・最新確認に失敗":"前回表示分・最新確認中"}<small> · {date(new Date(savedDisplayAt).toISOString())}</small></p>:null}
    {error?<div className="minf-error" role="alert"><p>{error}</p>{loadFailed?<button type="button" style={{minHeight:44,padding:"6px 14px"}} disabled={loading} onClick={()=>void load(page,kind,false,selectedDay,true)}>再試行</button>:null}</div>:null}
    {pageControls()}
    {loading&&!rows.length?<p className="minf-empty">通知を読み込み中…</p>:rows.filter(r=>matchesHandling(r,handlingStatus)).length?<div className="minf-list">{rows.filter(r=>matchesHandling(r,handlingStatus)).map((r,i)=>{const h=href(r),actor=actorName(r),p=presentation(r),type=displayType(r),label=r.meta?.classification_status==="insufficient_evidence"?"本文不足・種別不明":LABEL[type]||"その他",actorTop=creatorTop(r.actor_url,selfId);return <article key={r.id||`${rowKey(r)}-${i}`} className={`type-${type}`} data-comment-context-native={["reply","comment_like","comment","membership_board","membership_board_reply"].includes(r.notification_type)||["membership_board","membership_board_reply"].includes(type)?"true":undefined}><div className="minf-meta"><span>{label}</span>{r.context_label?<b>{r.context_label}</b>:null}<time>{date(r.occurred_at||r.captured_at)}</time></div><div className="minf-who"><Avatar row={r} selfId={selfId}/><div>{actorTop?<a className="minf-actor" href={actorTop} target="_blank" rel="noreferrer">{actor}</a>:<span className="minf-actor static">{actor}</span>}</div></div><div className="minf-row-actions"><NotificationFavorite row={r} onSaved={saveRow} onError={setError}/><NotificationCompletion row={r} onSaved={saveRow} onError={setError}/></div>{h?<a className="minf-main" href={h} target="_blank" rel="noreferrer"><strong>{p.title}</strong>{p.subject?<span>{p.subject}</span>:null}{p.detail?<small>{p.detail}</small>:null}</a>:<div className="minf-main static"><strong>{p.title}</strong>{p.subject?<span>{p.subject}</span>:null}{p.detail?<small>{p.detail}</small>:null}</div>}{type==="my_article_magazine_added"?<div className="minf-return-links">{r.meta?.article_url?<a href={r.meta.article_url} target="_blank" rel="noreferrer">追加された自分の記事 ↗</a>:null}{r.meta?.magazine_url?<a href={r.meta.magazine_url} target="_blank" rel="noreferrer">追加先マガジン ↗</a>:null}</div>:null}{["reply","comment_like","comment","membership_board","membership_board_reply"].includes(r.notification_type)||["membership_board","membership_board_reply"].includes(type)?<NotificationComment row={r} onSaved={saveRow}/>:null}{targetLabel(r)&&h?<a className="minf-target" href={h} target="_blank" rel="noreferrer">{targetLabel(r)}</a>:null}</article>})}</div>:loadFailed?<p className="minf-empty" role="status">この分類の通知はまだ確認できていません。「再試行」で読み込み直せます。</p>:<p className="minf-empty">{selectedDay?`${dayLabel(selectedDay)} のこの分類には通知がありません。`:"この分類の通知はありません。"}</p>}
    {pageControls()}
    {kind==="other"?<p className="minf-other-note">「その他・未分類」は、現在の既知ルールに一致しなかった通知だけです。本文が欠けた旧記録は「本文不足」と明記して保持します。分類ルール更新時に「その他」の未処理分だけを自動再分類します。推測だけで別カテゴリには入れません。</p>:null}
  </section>
}
