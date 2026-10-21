import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { readSavedInsightView, writeSavedInsightView, removeSavedInsightView } from "./insight-saved-view";
import { canRetainInsightView, fetchInsightResource, isFreshInsightView } from "./insight-view-lifecycle";
import { pendingCompletion, queueCompletion } from "./insight-completion-queue";
import { CreatorAvatar, creatorImage } from "./creator-avatar";
import { MemberInsightMagazines } from "./member-insight-magazines";
import { INSIGHT_TOKEN_KEY, currentStoredInsightAccount, setAccessIntent } from "./insight-account-store";
import { MemberInsightDm } from "./member-insight-dm";
import "./member-insight-unified.css";
import "./member-insight-unified-v4.css";

const HISTORY="https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-member-history";
const EXTRAS="https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-member-extras";
const MEMBER="https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-member-api";
const ICON="https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/creator-icons";
const THUMBS="https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-article-thumbnails";
const NOTIFY="https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-notification-history-v2";
const DASH="https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-dashboard-data";
const PAGE=100;
const SELF_THUMB_CACHE="mumei-insight-self-thumbs-v1";
const SUMMARY_CACHE_PREFIX="mumei-insight-summary-cache-v1:";
const DB_FALLBACK="https://xxhaerjvrgmnadxjqetz.supabase.co/rest/v1/rpc/insight_member_read_fallback";
const DB_ANON="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4aGFlcmp2cmdtbmFkeGpxZXR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwNTMxMTQsImV4cCI6MjEwMTYyOTExNH0.DtoUvuMTrW7rA3jLThLD4zijvluuTB_LmEBIjWJs-jA";
type Row=Record<string,any>;
type Tab="likes"|"supporters"|"comments"|"commentRanking"|"magazines"|"favorites"|"social"|"notifications"|"dm"|"articles";
type Summary={summaryMode?:"navigation";member:{noteId:string;displayName:string;imageUrl:string|null};summary:Record<string,any>;analysis:Record<string,any>;counts:{comments:number;followers:number;followings:number;notifications:number};articles:Row[]};
type VerifiedView={signature:string;at:number};
function viewSignature(revision:number,selection:unknown){return JSON.stringify([localStorage.getItem(INSIGHT_TOKEN_KEY),cachedAccountId(),revision,selection])}
function freshView(view:VerifiedView|null,signature:string){return view?.signature===signature&&isFreshInsightView(view.at)}
function recordValue(value:any){return Boolean(value&&typeof value==="object"&&!Array.isArray(value))}
function apiErrorMessage(value:unknown,fallback="保存先の確認に失敗しました。",depth=0):string{
 if(depth>4)return fallback;
 if(typeof value==="string"){const text=value.trim();if(/statement timeout|canceling statement due/i.test(text))return "保存先の集計が時間切れになりました。";return text&&text!=="[object Object]"?text:fallback}
 if(value&&typeof value==="object"){
  const object=value as Record<string,unknown>;if(object.code==="57014")return "保存先の集計が時間切れになりました。";
  for(const field of ["message","error_description","error"]){const message=apiErrorMessage(object[field],"",depth+1);if(message){const code=typeof object.code==="string"?object.code.trim():"";return code&&code!==message?`${message} (${code})`:message}}
  if(typeof object.code==="string"&&object.code.trim())return `${fallback} (${object.code.trim()})`;
 }
 return fallback;
}
function apiErrorCode(value:unknown,depth=0):string{
 if(depth>4||!value||typeof value!=="object")return "";const error=value as Record<string,unknown>;
 return typeof error.code==="string"?error.code:apiErrorCode(error.error,depth+1);
}
function apiFailure(value:unknown,fallback:string){const error=new Error(apiErrorMessage(value,fallback)) as Error&{code?:string};const code=apiErrorCode(value);if(code)error.code=code;return error}
function deniedError(value:unknown){return /INSIGHT_(?:SESSION_INVALID|LOGIN_REQUIRED|MEMBER_INACTIVE)/.test(apiErrorMessage(value,""))}
function validDataPayload(endpoint:string,action:string,payload:any){
  if(!recordValue(payload)||!Object.keys(payload).length||payload.ok===false)return false;
  if(action==="summary")return recordValue(payload.member)&&String(payload.member.noteId||"").toLowerCase()===cachedAccountId()&&recordValue(payload.summary)&&recordValue(payload.analysis)&&recordValue(payload.counts)&&Array.isArray(payload.articles);
  if(endpoint===HISTORY&&action==="articles")return Array.isArray(payload.rows)&&payload.rows.length<=1000&&payload.rows.every(recordValue)&&Number.isSafeInteger(payload.total)&&payload.total>=0;
  if(endpoint===DASH&&action==="analysis")return Object.prototype.hasOwnProperty.call(payload,"latestDashboard")&&(payload.latestDashboard===null||recordValue(payload.latestDashboard));
  if(["likes","supporters","comment_ranking","magazines"].includes(action))return Array.isArray(payload.rows)&&payload.rows.every(recordValue)&&(!["supporters","comment_ranking"].includes(action)||payload.rows.length<=PAGE)&&payload.total!==null&&payload.total!==undefined&&Number.isSafeInteger(Number(payload.total))&&Number(payload.total)>=0;
  if(["supporter_articles","commenter_comments"].includes(action))return Array.isArray(payload.rows)&&payload.rows.length<=PAGE&&payload.rows.every(recordValue);
  return true;
}
function cachedAccountId(){return String(currentStoredInsightAccount()?.noteId||"").toLowerCase()}
function summaryCacheKey(id=cachedAccountId()){return id?SUMMARY_CACHE_PREFIX+id:""}
function readSummaryCache(allowStale=false):Summary|null{const saved=readSavedSummary();return saved&&(allowStale||canRetainInsightView(saved.savedAt))?saved.value:null}
function emergencySummary():Summary|null{const account=currentStoredInsightAccount();if(!account?.noteId||!account.memberToken||account.status==="logged-out")return null;return{member:{noteId:account.noteId,displayName:account.displayName||account.noteId,imageUrl:account.imageUrl||null},summary:{},analysis:{},counts:{comments:0,followers:0,followings:0,notifications:0},articles:[]}}
function savedViewScope(){return{account:cachedAccountId(),token:localStorage.getItem(INSIGHT_TOKEN_KEY)||""}}
function readSavedSummary(){const saved=readSavedInsightView<Summary>("unified-summary",savedViewScope());return saved&&validDataPayload(HISTORY,"summary",saved.value)?saved:null}
function savedDashboardDisplay(){const saved=readSavedInsightView<any>("article-dashboard",savedViewScope());return saved&&validDataPayload(DASH,"analysis",saved.value)?{...saved.value,__savedViewAt:saved.savedAt}:null}
function readSavedArticles(){const saved=readSavedInsightView<{rows:Row[];total:number}>("article-archive",savedViewScope());return saved&&validDataPayload(HISTORY,"articles",saved.value)?saved:null}
function initialSummary(){return readSavedSummary()?.value||emergencySummary()}
function writeSummaryCache(data:Summary){writeSavedInsightView("unified-summary",savedViewScope(),data);const key=summaryCacheKey(String(data?.member?.noteId||"").toLowerCase());if(!key)return;try{localStorage.setItem(key,JSON.stringify({cachedAt:Date.now(),data}))}catch{}}

const DATA_CACHE_PREFIX="mumei-insight-data-cache-v1:";
const scopedDataOwners=new Map<string,string>();
function cacheHash(input:string){let h=2166136261;for(let i=0;i<input.length;i++){h^=input.charCodeAt(i);h=Math.imul(h,16777619)}return(h>>>0).toString(36)}
function stable(v:any):any{if(Array.isArray(v))return v.map(stable);if(v&&typeof v==="object")return Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])]));return v}
function dataCacheKey(endpoint:string,action:string,extra:Record<string,unknown>,account=cachedAccountId()||"unknown"){const path=(()=>{try{return new URL(endpoint).pathname}catch{return endpoint}})();return DATA_CACHE_PREFIX+account+":"+cacheHash(JSON.stringify([path,action,stable(extra)]))}
function cacheableAction(action:string){return !/(?:completion|toggle|set|create|delete|rename|assign|update|sync|mark|remove|write|save)$/i.test(action)}
function readDataCache(endpoint:string,action:string,extra:Record<string,unknown>,allowStale=false){
 if(!cacheableAction(action))return null;
 if(endpoint===DASH&&action==="analysis"){const saved=readSavedInsightView<any>("article-dashboard",savedViewScope());return saved&&validDataPayload(endpoint,action,saved.value)&&(allowStale||canRetainInsightView(saved.savedAt))?{...saved.value,__cachedAt:saved.savedAt}:null}
 if(endpoint===HISTORY&&action==="summary"){const saved=readSavedSummary();return saved&&(allowStale||canRetainInsightView(saved.savedAt))?{...saved.value,__cachedAt:saved.savedAt}:null}
 if(endpoint===HISTORY&&action==="articles"){const saved=readSavedArticles();return saved&&(allowStale||canRetainInsightView(saved.savedAt))?{...saved.value,__cachedAt:saved.savedAt}:null}
 if(endpoint===HISTORY&&action==="likes"){
  const current=documentLikesViews.get(likesViewScope());
  if(current&&JSON.stringify(stable(likeParams(current.value.selection)))===JSON.stringify(stable(extra)))return{rows:current.value.rows,total:current.value.total,__cachedAt:current.savedAt};
 }
 const key=dataCacheKey(endpoint,action,extra);
 if(endpoint===HISTORY&&["likes","supporters","comment_ranking","supporter_articles","commenter_comments"].includes(action)&&scopedDataOwners.get(key)!==viewSignature(0,{})){
  if(action==="likes"){const last=readSavedLikes(),saved=last&&JSON.stringify(stable(likeParams(last.value.selection)))===JSON.stringify(stable(extra))?last:readDefaultLikes();return saved&&JSON.stringify(stable(likeParams(saved.value.selection)))===JSON.stringify(stable(extra))&&(allowStale||canRetainInsightView(saved.savedAt))?{rows:saved.value.rows,total:saved.value.total,__cachedAt:saved.savedAt}:null}
  if(action==="supporter_articles"||action==="commenter_comments"){const saved=readSavedRanking(action==="supporter_articles"?"supporters":"comment_ranking"),key=action==="supporter_articles"?extra.likerKey:extra.actorKey;return saved&&saved.value.open===key&&saved.value.detailAt>0&&extra.page===1&&extra.pageSize===PAGE&&(allowStale||canRetainInsightView(saved.value.detailAt))?{rows:saved.value.detailRows,__cachedAt:saved.value.detailAt}:null;}
  const saved=readSavedRanking(action as RankingKind);return saved&&saved.value.page===extra.page&&extra.pageSize===PAGE&&(allowStale||canRetainInsightView(saved.savedAt))?{rows:saved.value.rows,total:saved.value.total,__cachedAt:saved.savedAt}:null;
 }
 try{const x=JSON.parse(localStorage.getItem(key)||"null");return validDataPayload(endpoint,action,x?.payload)&&(allowStale||canRetainInsightView(x.cachedAt))&&Date.now()-Number(x.cachedAt||0)<1000*60*60*24*30?{...x.payload,__cachedAt:x.cachedAt}:null}catch{return null}
}
function writeDataCache(endpoint:string,action:string,extra:Record<string,unknown>,payload:any,account=cachedAccountId()){if(!cacheableAction(action)||!payload||cachedAccountId()!==account)return;try{if(endpoint===DASH&&action==="analysis"){writeSavedInsightView("article-dashboard",savedViewScope(),payload);return}if(endpoint===HISTORY&&action==="articles"){writeSavedInsightView("article-archive",savedViewScope(),payload);return}const key=dataCacheKey(endpoint,action,extra,account);localStorage.setItem(key,JSON.stringify({cachedAt:Date.now(),extra,payload}));if(endpoint===HISTORY&&["likes","supporters","comment_ranking","supporter_articles","commenter_comments"].includes(action))scopedDataOwners.set(key,viewSignature(0,{}))}catch{}}
async function dbFallback(endpoint:string,action:string,extra:Record<string,unknown>,token:string,signal?:AbortSignal){
  const source=(()=>{try{return new URL(endpoint).pathname.split("/").filter(Boolean).at(-1)||""}catch{return""}})();
  const r=await fetchInsightResource(DB_FALLBACK,{method:"POST",headers:{"Content-Type":"application/json","apikey":DB_ANON,"Authorization":`Bearer ${DB_ANON}`},body:JSON.stringify({p_token:token,p_source:source,p_action:action,p_extra:extra}),cache:"no-store",signal},15_000);
  const p=await r.json().catch(()=>null);
  if(r.status===401||r.status===403)throw new Error(`INSIGHT_SESSION_INVALID: ${apiErrorMessage(p,"本人確認が拒否されました。")}`);
  if(!r.ok||!validDataPayload(endpoint,action,p))throw apiFailure(p,`保存先の確認に失敗しました（HTTP ${r.status}）。`);
  return{...p,__dbFallback:true};
}
async function post(endpoint:string,action:string,extra:Record<string,unknown>={},externalSignal?:AbortSignal){
 const token=localStorage.getItem(INSIGHT_TOKEN_KEY)||"";if(!token)throw new Error("INSIGHT_LOGIN_REQUIRED");
 const account=cachedAccountId(),valid=()=>localStorage.getItem(INSIGHT_TOKEN_KEY)===token&&cachedAccountId()===account,controller=new AbortController(),timer=window.setTimeout(()=>controller.abort(),30000),abort=()=>controller.abort();
 if(externalSignal?.aborted)controller.abort();externalSignal?.addEventListener("abort",abort,{once:true});
 try{
  try{
   const r=await fetchInsightResource(endpoint,{method:"POST",headers:{"Content-Type":"application/json","X-Insight-Token":token},body:JSON.stringify({action,...extra}),cache:"no-store",signal:controller.signal},30_000),p=await r.json().catch(()=>null);
   if(r.status===401||r.status===403)throw new Error(`INSIGHT_SESSION_INVALID: ${apiErrorMessage(p,"本人確認が拒否されました。")}`);
   if(r.status===402)throw new Error("BACKEND_RESTRICTED_402");
   if(!r.ok||p?.ok===false)throw apiFailure(p,`保存先の確認に失敗しました（HTTP ${r.status}）。`);
   if(!validDataPayload(endpoint,action,p))throw new Error("INSIGHT_INVALID_RESPONSE");
   if(externalSignal?.aborted)throw new Error("通信を中断しました");if(!valid())throw new Error("INSIGHT_ACCOUNT_CHANGED");
   writeDataCache(endpoint,action,extra,p,account);return p;
  }catch(error){
   if(externalSignal?.aborted||!valid()||!cacheableAction(action)||deniedError(error))throw error;
   if(apiErrorCode(error)!=="57014")try{
    const db=await dbFallback(endpoint,action,extra,token,externalSignal);
    if(externalSignal?.aborted)throw new Error("通信を中断しました");if(!valid())throw new Error("INSIGHT_ACCOUNT_CHANGED");
    writeDataCache(endpoint,action,extra,db,account);return db;
   }catch(fallbackError){if(externalSignal?.aborted||!valid()||deniedError(fallbackError))throw fallbackError}
   if(!valid())throw new Error("INSIGHT_ACCOUNT_CHANGED");const cached=readDataCache(endpoint,action,extra,true);if(cached)return{...cached,__offlineCache:true,__offlineError:apiErrorMessage(error,"保存先の確認に失敗しました。")};
   throw apiFailure(error,"保存先の確認に失敗しました。");
  }
 }finally{clearTimeout(timer);externalSignal?.removeEventListener("abort",abort)}
}
const hist=(action:string,extra:Record<string,unknown>={},signal?:AbortSignal)=>post(HISTORY,action,extra,signal);
const extra=(action:string,extra:Record<string,unknown>={})=>post(EXTRAS,action,extra);
const notify=(extra:Record<string,unknown>={})=>post(NOTIFY,"list",extra);
const dashboard=(extra:Record<string,unknown>={})=>post(DASH,"analysis",extra);
const n=(v:any)=>new Intl.NumberFormat("ja-JP").format(Number(v||0));
const date=(v:any,withTime=true)=>{if(!v)return"—";const d=new Date(typeof v==="number"?v:String(v));if(Number.isNaN(d.getTime()))return String(v);return new Intl.DateTimeFormat("ja-JP",withTime?{timeZone:"Asia/Tokyo",year:"numeric",month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"}:{timeZone:"Asia/Tokyo",year:"numeric",month:"numeric",day:"numeric"}).format(d)};
const isoDay=(v:string)=>v?`${v}T00:00:00+09:00`:null;
function nextDay(v:string){if(!v)return null;const d=new Date(`${v}T00:00:00+09:00`);return new Date(d.getTime()+86400000).toISOString()}
function monthRange(v:string){if(!v)return{dateFrom:null,dateTo:null};const[y,m]=v.split("-").map(Number),ny=m===12?y+1:y,nm=m===12?1:m+1;return{dateFrom:`${v}-01T00:00:00+09:00`,dateTo:`${ny}-${String(nm).padStart(2,"0")}-01T00:00:00+09:00`}}
function yearRange(v:string){const y=Number(v);return Number.isFinite(y)?{dateFrom:`${y}-01-01T00:00:00+09:00`,dateTo:`${y+1}-01-01T00:00:00+09:00`}:{dateFrom:null,dateTo:null}}
function jstDay(v:any){if(!v)return"";const d=new Date(String(v));if(Number.isNaN(d.getTime()))return String(v).slice(0,10);const p=new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(d),m=Object.fromEntries(p.map(x=>[x.type,x.value]));return`${m.year}-${m.month}-${m.day}`}
function noteId(url:any){try{return url?new URL(String(url)).pathname.split("/").filter(Boolean)[0]||"":""}catch{return""}}
function cleanUrl(v:any){try{const u=new URL(String(v||""));u.search="";u.hash="";return u.toString().replace(/\/$/,"")}catch{return String(v||"").split("?")[0].replace(/\/$/,"")}}
async function enrich(rows:Row[]){return rows.map(row=>({...row,actor_image_url:creatorImage(row)||null}))}

function Avatar({name,image,noteId}:{name:string;image?:string|null;noteId?:string}){return <CreatorAvatar name={name} image={image} noteId={noteId} className="miu-avatar"/>}
function Person({row}:{row:Row}){const name=row.actor_name||row.name||row.nickname||noteId(row.actor_url||row.url||row.profileUrl)||"noteユーザー",url=row.actor_url||row.url||row.profileUrl,image=row.actor_image_url||row.image||row.profileImageUrl;return <span className="miu-person"><CreatorAvatar person={row} name={name} image={image} className="miu-avatar"/><span><b>{name}</b>{url?<a href={url} target="_blank" rel="noreferrer">プロフィール ↗</a>:null}</span></span>}
function Pager({page,total,onPage}:{page:number;total:number;onPage:(x:number)=>void}){const pages=Math.max(1,Math.ceil(total/PAGE));if(pages<=1)return null;return <div className="miu-pager"><button disabled={page<=1} onClick={()=>onPage(page-1)}>←</button><b>{page} / {pages}</b><button disabled={page>=pages} onClick={()=>onPage(page+1)}>→</button></div>}
function SectionHead({k,title,count,children}:{k:string;title:string;count?:string;children?:React.ReactNode}){return <header className="miu-section-head"><div><small>{k}</small><h2>{title}</h2></div><div>{count?<strong>{count}</strong>:null}{children}</div></header>}
function FavoriteStar({row,onChange}:{row:Row;onChange:(favorite:boolean)=>void}){const[busy,setBusy]=useState(false);async function toggle(){if(busy)return;setBusy(true);try{const favorite=!Boolean(row.favorite);await hist("favorite_toggle",{creatorKey:String(row.liker_key||row.actor_key||row.creator_key||""),actorName:row.actor_name,actorUrl:row.actor_url,actorImageUrl:row.actor_image_url,favorite});onChange(favorite)}finally{setBusy(false)}}return <button className={`miu-star ${row.favorite?"active":""}`} disabled={busy} onClick={()=>void toggle()} aria-label={row.favorite?"お気に入り解除":"お気に入り登録"}>{row.favorite?"★":"☆"}</button>}

type LikesSelection={status:string;scope:string;day:string;month:string;year:string;sort:string;query:string;page:number};
type SavedLikes={selection:LikesSelection;rows:Row[];total:number};
function defaultLikesSelection():LikesSelection{return{status:"all",scope:"all",day:"",month:"",year:String(new Date().getFullYear()),sort:"newest",query:"",page:1}}
function validSavedLikes(value:any):value is SavedLikes{
 const x=value?.selection;if(!recordValue(value)||!recordValue(x)||!["all","pending","completed"].includes(x.status)||!["all","day","month","year"].includes(x.scope)||!["newest","oldest","name"].includes(x.sort))return false;
 if(!["day","month","year","query"].every(k=>typeof x[k]==="string")||x.query.length>10000)return false;
 if(x.day&&(!/^\d{4}-\d{2}-\d{2}$/.test(x.day)||!Number.isFinite(new Date(isoDay(x.day)!).getTime())))return false;
 if(x.month&&!/^\d{4}-(0[1-9]|1[0-2])$/.test(x.month))return false;
 if(x.year&&(!/^\d{1,4}$/.test(x.year)||Number(x.year)<1))return false;
 return Number.isSafeInteger(x.page)&&x.page>=1&&Array.isArray(value.rows)&&value.rows.length<=PAGE&&value.rows.every(recordValue)&&Number.isSafeInteger(value.total)&&value.total>=0;
}
function readSavedLikes(kind="likes-last"){const saved=readSavedInsightView<SavedLikes>(kind,savedViewScope());return saved&&validSavedLikes(saved.value)?saved:null}
function defaultLikesView(value:SavedLikes){return JSON.stringify(stable(likeParams(value.selection)))===JSON.stringify(stable(likeParams(defaultLikesSelection())))}
function readDefaultLikes(){const saved=readSavedLikes("likes-latest")||readSavedLikes();return saved&&defaultLikesView(saved.value)?saved:null}
function updateDefaultLikesRows(update:(rows:Row[])=>Row[]){const saved=readDefaultLikes();if(saved)writeSavedInsightView("likes-latest",savedViewScope(),{...saved.value,rows:update(saved.value.rows)},saved.savedAt)}
function likeRange(selection:LikesSelection){return selection.scope==="day"?{dateFrom:isoDay(selection.day),dateTo:nextDay(selection.day)}:selection.scope==="month"?monthRange(selection.month):selection.scope==="year"?yearRange(selection.year):{dateFrom:null,dateTo:null}}
function likeParams(selection:LikesSelection){return{page:selection.page,pageSize:PAGE,status:selection.status,sort:selection.sort,query:selection.query,...likeRange(selection)}}
function likeSelectionKey(selection:LikesSelection){return JSON.stringify([selection.status,selection.scope,selection.day,selection.month,selection.year,selection.sort,selection.query])}
function likeRows(rows:Row[]){return rows.map(row=>({...row,actor_image_url:creatorImage(row)||null}))}
const documentLikesViews=new Map<string,{value:SavedLikes;savedAt:number}>();
function likesViewScope(){return JSON.stringify(savedViewScope())}
function saveLikesView(value:SavedLikes,savedAt:number){
 documentLikesViews.set(likesViewScope(),{value,savedAt});
 writeSavedInsightView("likes-last",savedViewScope(),value,savedAt);
 if(defaultLikesView(value))writeSavedInsightView("likes-latest",savedViewScope(),value,savedAt);
}
function removeLikesView(){documentLikesViews.delete(likesViewScope());removeSavedInsightView("likes-last",savedViewScope());removeSavedInsightView("likes-latest",savedViewScope())}
function initialSavedLikes(){
 // A new entry starts at the latest page. Only reuse a matching display copy;
 // same-document TOP/back navigation can remount the scene, so retain its copy
 // in memory separately from cross-document browser storage.
 const current=documentLikesViews.get(likesViewScope());if(current)return current;
 const saved=readDefaultLikes(),selection=defaultLikesSelection();
 return saved&&JSON.stringify(stable(likeParams(saved.value.selection)))===JSON.stringify(stable(likeParams(selection)))?{...saved,value:{...saved.value,selection}}:null;
}

function Likes({revision,active=true}:{revision:number;active?:boolean}){
 const[initial]=useState(initialSavedLikes),selection=initial?.value.selection||defaultLikesSelection();
 const[rows,setRows]=useState<Row[]>(()=>likeRows(initial?.value.rows||[])),[total,setTotal]=useState(initial?.value.total||0),[page,setPage]=useState(selection.page),[status,setStatus]=useState(selection.status),[scope,setScope]=useState(selection.scope),[day,setDay]=useState(selection.day),[month,setMonth]=useState(selection.month),[year,setYear]=useState(selection.year),[sort,setSort]=useState(selection.sort),[draft,setDraft]=useState(selection.query),[query,setQuery]=useState(selection.query),[loading,setLoading]=useState(!initial),[error,setError]=useState(""),[completing,setCompleting]=useState<Set<string>>(new Set()),[savedDisplay,setSavedDisplay]=useState(Boolean(initial)),[checkedAt,setCheckedAt]=useState(initial?.savedAt||0),[checking,setChecking]=useState(false);
 const pending=useRef(new Map<string,Row>()),mutationVersion=useRef(0),loadId=useRef(0),loadController=useRef<AbortController|null>(null),verified=useRef<VerifiedView|null>(null),currentStatus=useRef(status),savedSnapshot=useRef<SavedLikes|null>(initial?.value||null),savedSnapshotAt=useRef(initial?.savedAt||0),passiveDenied=useRef(false),passiveTouched=useRef(false),passiveRevision=useRef(revision),loadedSelection=useRef(likeSelectionKey(selection));
 currentStatus.current=status;
 const range=useMemo(()=>likeRange({status,scope,day,month,year,sort,query,page}),[scope,day,month,year]);
 const currentSelection=():LikesSelection=>({status,scope,day,month,year,sort,query,page});
 async function load(p=1){
  const id=++loadId.current,version=mutationVersion.current,token=localStorage.getItem(INSIGHT_TOKEN_KEY),account=cachedAccountId(),nextSelection={...currentSelection(),page:p};
  verified.current=null;loadController.current?.abort();const controller=new AbortController();loadController.current=controller;
  const valid=()=>id===loadId.current&&!controller.signal.aborted&&localStorage.getItem(INSIGHT_TOKEN_KEY)===token&&cachedAccountId()===account;
  const overlay=(list:Row[])=>list.map(r=>pending.current.get(r.article_key+":"+r.liker_key)||r),params=likeParams(nextSelection),cached=readDataCache(HISTORY,"likes",params);
  if(cached){setRows(overlay(likeRows(cached.rows||[])));setTotal(Number(cached.total||0));setPage(p);setLoading(false);setCheckedAt(Number(cached.__cachedAt||0));setSavedDisplay(true)}else if(likeSelectionKey(nextSelection)!==loadedSelection.current||p!==page){setRows([]);setTotal(0);setPage(p);setSavedDisplay(false);setLoading(true)}else setLoading(!rows.length&&!savedSnapshot.current);
  setChecking(true);setError("");
  try{const signature=viewSignature(revision,params),x=await hist("likes",params,controller.signal);if(!valid()||version!==mutationVersion.current)return;
   const list=likeRows(x.rows||[]);setRows(overlay(list));setTotal(Number(x.total||0));setPage(p);
   if(!x.__offlineCache){const at=Date.now();verified.current={signature,at};setCheckedAt(at);setSavedDisplay(false);const snapshot={selection:nextSelection,rows:x.rows||[],total:Number(x.total||0)};savedSnapshot.current=snapshot;savedSnapshotAt.current=at;saveLikesView(snapshot,at)}else{setSavedDisplay(true);setCheckedAt(Number(x.__cachedAt||checkedAt));setError("最新確認に失敗したため前回保存分を表示しています。")}
  }catch(e){if(valid()){const message=e instanceof Error?e.message:"読込失敗";if(/LOGIN|SESSION|INACTIVE/.test(message)){passiveDenied.current=true;removeLikesView();savedSnapshot.current=null;setRows([]);setTotal(0);setSavedDisplay(false)}setError(message)}}finally{if(valid()){setLoading(false);setChecking(false)}}
 }
 function complete(r:Row){
 const key=r.article_key+":"+r.liker_key,token=localStorage.getItem(INSIGHT_TOKEN_KEY),account=cachedAccountId(),queueKey=`${token}|like|${key}`;
 const before=Boolean(pendingCompletion(queueKey)??r.confirmed),confirmed=!before,updated={...r,confirmed},clickedStatus=currentStatus.current;
 pending.current.set(key,updated);mutationVersion.current++;
 flushSync(()=>{setCompleting(v=>new Set(v).add(key));setError("");setRows(v=>v.map(x=>x.article_key+":"+x.liker_key===key?updated:x));if(clickedStatus!=="all")setTotal(v=>Math.max(0,v+Number((clickedStatus==="completed")===confirmed)-Number((clickedStatus==="completed")===before)))});
 queueCompletion(queueKey,Boolean(r.confirmed),confirmed,
  completed=>hist("like_completion",{articleKey:r.article_key,likerKey:r.liker_key,completed}),
  ()=>localStorage.getItem(INSIGHT_TOKEN_KEY)===token&&cachedAccountId()===account,
  (saved,failed)=>{
   mutationVersion.current++;pending.current.delete(key);
   updateDefaultLikesRows(rows=>rows.map(x=>x.article_key+":"+x.liker_key===key?{...x,confirmed:saved}:x));
   const snapshot=savedSnapshot.current;
   if(snapshot){const old=snapshot.rows.find(x=>x.article_key+":"+x.liker_key===key);if(old){const selected=snapshot.selection.status,keep=(row:Row)=>selected==="all"||(selected==="completed")===Boolean(row.confirmed);const next={...snapshot,rows:snapshot.rows.map(x=>x.article_key+":"+x.liker_key===key?{...x,confirmed:saved}:x).filter(keep),total:Math.max(0,snapshot.total+(Boolean(old.confirmed)===saved?0:Number(keep({...old,confirmed:saved}))-Number(keep(old))))};savedSnapshot.current=next;saveLikesView(next,savedSnapshotAt.current)}}
   // Update only saved pages containing this row; do not reload the history.
   for(let i=localStorage.length-1;i>=0;i--){const cacheKey=localStorage.key(i);if(!cacheKey?.startsWith(DATA_CACHE_PREFIX+account+":"))continue;try{const cached=JSON.parse(localStorage.getItem(cacheKey)||"null"),list:Row[]=cached?.payload?.rows;if(!Array.isArray(list))continue;const previous=list.find(x=>x.article_key+":"+x.liker_key===key);if(!previous)continue;const cachedStatus=cached.extra?.status;cached.payload.rows=list.map(x=>x.article_key+":"+x.liker_key===key?{...x,confirmed:saved}:x).filter(x=>!cachedStatus||cachedStatus==="all"||(cachedStatus==="completed")===Boolean(x.confirmed));if(cachedStatus&&cachedStatus!=="all"&&Boolean(previous.confirmed)!==saved)cached.payload.total=Math.max(0,Number(cached.payload.total||0)-1);localStorage.setItem(cacheKey,JSON.stringify(cached))}catch{}}
   setRows(v=>v.some(x=>x.article_key+":"+x.liker_key===key)?v.map(x=>x.article_key+":"+x.liker_key===key?{...x,confirmed:saved}:x):[{...r,confirmed:saved},...v]);
   if(failed){if(currentStatus.current===clickedStatus&&clickedStatus!=="all")setTotal(v=>Math.max(0,v+Number((clickedStatus==="completed")===saved)-Number((clickedStatus==="completed")===confirmed)));setError("対応状況を保存できませんでした。元に戻しました。");}
   setCompleting(v=>{const next=new Set(v);next.delete(key);return next});
  });
}
 useEffect(()=>{
  const token=localStorage.getItem(INSIGHT_TOKEN_KEY),account=cachedAccountId();
  const restore=()=>{if(savedSnapshot.current||verified.current||passiveDenied.current||passiveTouched.current||mutationVersion.current||revision!==passiveRevision.current||localStorage.getItem(INSIGHT_TOKEN_KEY)!==token||cachedAccountId()!==account)return;const saved=defaultLikesView({selection:currentSelection(),rows:[],total:0})?readDefaultLikes():readSavedLikes();if(!saved||JSON.stringify(stable(likeParams(saved.value.selection)))!==JSON.stringify(stable(likeParams(currentSelection()))))return;savedSnapshot.current=saved.value;savedSnapshotAt.current=saved.savedAt;setRows(likeRows(saved.value.rows));setTotal(saved.value.total);setCheckedAt(saved.savedAt);setSavedDisplay(true);setLoading(false)};
  window.addEventListener("mumei-insight-storage-hydrated",restore);return()=>window.removeEventListener("mumei-insight-storage-hydrated",restore);
 },[revision,status,scope,day,month,year,sort,query,page]);
 useEffect(()=>{if(!active)return;const selection=likeSelectionKey(currentSelection()),reset=loadedSelection.current!==selection;const p=reset?1:page,signature=viewSignature(revision,{page:p,pageSize:PAGE,status,sort,query,...range});if(!freshView(verified.current,signature))void load(p);loadedSelection.current=selection;return()=>{loadId.current++;loadController.current?.abort()}},[status,scope,day,month,year,sort,query,revision,active]);
 return <section className="miu-panel" onClickCapture={()=>{passiveTouched.current=true}} onInputCapture={()=>{passiveTouched.current=true}}> <SectionHead k="LIKE HISTORY" title="スキ全履歴" count={`${n(total)}件`}/><div className="miu-tabs">{[["all","すべて"],["pending","未対応"],["completed","対応済み"]].map(x=><button key={x[0]} className={status===x[0]?"active":""} onClick={()=>setStatus(x[0])}>{x[1]}</button>)}</div><div className="miu-tools"><div className="miu-tabs mini">{[["all","全期間"],["day","日ごと"],["month","月ごと"],["year","年ごと"]].map(x=><button key={x[0]} className={scope===x[0]?"active":""} onClick={()=>setScope(x[0])}>{x[1]}</button>)}</div>{scope==="day"?<input type="date" value={day} onChange={e=>setDay(e.target.value)}/>:scope==="month"?<input type="month" value={month} onChange={e=>setMonth(e.target.value)}/>:scope==="year"?<input type="number" value={year} onChange={e=>setYear(e.target.value)}/>:null}<select value={sort} onChange={e=>setSort(e.target.value)}><option value="newest">新しい順</option><option value="oldest">古い順</option><option value="name">名前順</option></select><input value={draft} onChange={e=>setDraft(e.target.value)} placeholder="名前・ID・記事" onKeyDown={e=>{if(e.key==="Enter")setQuery(draft)}}/><button onClick={()=>setQuery(draft)}>検索</button></div>{savedDisplay?<p className="miu-source" data-insight-saved-view="likes">前回表示分（確認 {date(checkedAt)}）{checking?"・最新を確認中":""}</p>:null}{error?<p className="miu-error">{error}</p>:null}{loading&&!rows.length?<div className="miu-load-scene"><b>スキ履歴を確認中</b><span>最新の保存データを取得</span><i/></div>:<div className="miu-card-grid">{rows.filter(r=>status==="all"||(status==="completed")===Boolean(r.confirmed)).map(r=><article className="miu-like" key={`${r.article_key}:${r.liker_key}`}><div className="miu-like-person"><Person row={r}/></div><div className="miu-like-actions"><FavoriteStar row={r} onChange={favorite=>{mutationVersion.current++;updateDefaultLikesRows(rows=>rows.map(x=>x.liker_key===r.liker_key?{...x,favorite}:x));setRows(v=>v.map(x=>x.liker_key===r.liker_key?{...x,favorite}:x));const snapshot=savedSnapshot.current;if(snapshot){const next={...snapshot,rows:snapshot.rows.map(x=>x.liker_key===r.liker_key?{...x,favorite}:x)};savedSnapshot.current=next;saveLikesView(next,savedSnapshotAt.current)}}}/><button className={`miu-handled ${r.confirmed?"active":""} ${completing.has(r.article_key+":"+r.liker_key)?"is-saving is-flashing":""}`} aria-pressed={Boolean(r.confirmed)} aria-busy={completing.has(r.article_key+":"+r.liker_key)} aria-label={r.confirmed?"未対応に戻す":"対応済みにする"} title={r.confirmed?"未対応に戻す":"対応済みにする"} onClick={()=>void complete(r)}>{r.confirmed?"✓ 対応済み":"対応済み"}</button></div><a href={r.article_url} target="_blank" rel="noreferrer">{r.article_title}</a><time>{date(r.liked_at)}</time></article>)}</div>}<Pager page={page} total={total} onPage={p=>void load(p)}/></section>}

type RankingKind="supporters"|"comment_ranking";
type SavedRanking={page:number;rows:Row[];total:number;open:string|null;detailRows:Row[];detailAt:number};
function rankingKey(kind:RankingKind){return kind==="supporters"?"liker_key":"actor_key"}
function readSavedRanking(kind:RankingKind){
 const saved=readSavedInsightView<SavedRanking>(`ranking-${kind}`,savedViewScope()),x=saved?.value,key=rankingKey(kind);
 return saved&&recordValue(x)&&Number.isSafeInteger(x!.page)&&x!.page>=1&&Number.isSafeInteger(x!.total)&&x!.total>=0&&Array.isArray(x!.rows)&&x!.rows.length<=PAGE&&x!.rows.every(row=>recordValue(row)&&String(row[key]||""))&&(x!.open===null||typeof x!.open==="string")&&Array.isArray(x!.detailRows)&&x!.detailRows.length<=PAGE&&x!.detailRows.every(recordValue)&&Number.isFinite(x!.detailAt)&&x!.detailAt>=0&&x!.detailAt<=Date.now()?saved:null;
}
function useRankingPage(kind:RankingKind,revision:number,active:boolean){
 // null means unverified, not a successful empty ranking. Keep the displayed page until its replacement is available.
 const [initial]=useState(()=>readSavedRanking(kind)),[rows,setRows]=useState<Row[]>(()=>likeRows(initial?.value.rows||[])),[total,setTotal]=useState<number|null>(initial?.value.total??null),[page,setPage]=useState(initial?.value.page||1),[open,setOpen]=useState<string|null>(initial?.value.open||null),[details,setDetails]=useState<Record<string,Row[]>>(()=>initial?.value.open?{[initial.value.open]:initial.value.detailRows}:{}),[loading,setLoading]=useState(!initial),[checking,setChecking]=useState(false),[error,setError]=useState(""),[savedDisplay,setSavedDisplay]=useState(Boolean(initial)),[checkedAt,setCheckedAt]=useState(initial?.savedAt||0),[detailSaved,setDetailSaved]=useState(Boolean(initial?.value.open));
 const passiveDenied=useRef(false),passiveTouched=useRef(false),passiveRevision=useRef(revision),mutationVersion=useRef(0),verified=useRef<VerifiedView|null>(null),detailVerified=useRef(new Map<string,VerifiedView>()),request=useRef({id:0,controller:null as AbortController|null}),detailRequest=useRef({id:0,controller:null as AbortController|null}),snapshot=useRef(initial?.value||null),snapshotAt=useRef(initial?.savedAt||0),scope=JSON.stringify(savedViewScope()),shownScope=useRef(scope),state=useRef({rows,total,page,open,details});state.current={rows,total,page,open,details};
 const requestedPage=useRef(page);
 const validScope=()=>JSON.stringify(savedViewScope())===scope;
 function save(value:SavedRanking,at=snapshotAt.current){if(!validScope())return;snapshot.current=value;snapshotAt.current=at;writeSavedInsightView(`ranking-${kind}`,savedViewScope(),value,at)}
 function deny(){passiveDenied.current=true;removeSavedInsightView(`ranking-${kind}`,savedViewScope());snapshot.current=null;setRows([]);setTotal(null);setCheckedAt(0);setDetails({});setOpen(null);setSavedDisplay(false);setDetailSaved(false)}
 async function load(p=requestedPage.current){
  requestedPage.current=p;
  const id=++request.current.id,version=mutationVersion.current;verified.current=null;request.current.controller?.abort();const controller=new AbortController();request.current.controller=controller;
  const valid=()=>id===request.current.id&&!controller.signal.aborted&&validScope(),params={page:p,pageSize:PAGE},cached=readDataCache(HISTORY,kind,params);
  if(cached){setRows(likeRows(cached.rows));setTotal(Number(cached.total));setPage(p);setCheckedAt(Number(cached.__cachedAt||0));setSavedDisplay(true);setLoading(false)}else{setLoading(state.current.total===null);if(state.current.total!==null)setSavedDisplay(true)}
  setChecking(true);setError("");
  try{const signature=viewSignature(revision,params),x=await hist(kind,params,controller.signal);if(!valid())return;if(version!==mutationVersion.current){const key=dataCacheKey(HISTORY,kind,params);scopedDataOwners.delete(key);try{localStorage.removeItem(key)}catch{}return;}
   setRows(likeRows(x.rows));setTotal(Number(x.total));setPage(p);
   if(x.__offlineCache){setSavedDisplay(true);setError(`最新確認に失敗したため前回保存分を表示しています。${x.__offlineError||""}`)}else{const at=Date.now();verified.current={signature,at};setCheckedAt(at);setSavedDisplay(false);const selected=state.current.open,keepOpen=selected&&x.rows.some((row:Row)=>String(row[rankingKey(kind)])===selected)?selected:null;save({page:p,rows:x.rows,total:Number(x.total),open:keepOpen,detailRows:keepOpen?state.current.details[keepOpen]||[]:[],detailAt:keepOpen?snapshot.current?.detailAt||0:0},at);if(!keepOpen)setOpen(null)}
  }catch(error){if(valid()){if(deniedError(error))deny();setError(apiErrorMessage(error,"最新確認に失敗しました。"))}}finally{if(valid()){setLoading(false);setChecking(false)}}
 }
 async function loadDetail(key:string){
  if(!key||!active||!validScope())return;const signature=viewSignature(revision,{key}),current=detailVerified.current.get(key);if(freshView(current||null,signature))return;
  const id=++detailRequest.current.id;detailRequest.current.controller?.abort();const controller=new AbortController();detailRequest.current.controller=controller;const valid=()=>id===detailRequest.current.id&&!controller.signal.aborted&&validScope();
  setDetailSaved(Boolean(state.current.details[key]));
  try{const action=kind==="supporters"?"supporter_articles":"commenter_comments",params=kind==="supporters"?{likerKey:key,page:1,pageSize:PAGE}:{actorKey:key,page:1,pageSize:PAGE},x=await hist(action,params,controller.signal);if(!valid())return;
   setDetails(previous=>({...previous,[key]:x.rows}));if(!x.__offlineCache){const at=Date.now();detailVerified.current.set(key,{signature,at});setDetailSaved(false);if(snapshot.current&&state.current.open===key)save({...snapshot.current,open:key,detailRows:x.rows,detailAt:at})}else setError("最新確認に失敗したため前回保存分を表示しています。");
  }catch(error){if(valid()){if(deniedError(error))deny();setError(apiErrorMessage(error,"詳細の確認に失敗しました。"))}}
 }
 useEffect(()=>{
  const restore=()=>{if(snapshot.current||verified.current||passiveDenied.current||passiveTouched.current||mutationVersion.current||revision!==passiveRevision.current||!validScope())return;const saved=readSavedRanking(kind);if(!saved||saved.value.page!==state.current.page)return;const value={...saved.value,open:state.current.open,detailRows:[],detailAt:0};snapshot.current=value;snapshotAt.current=saved.savedAt;setRows(likeRows(value.rows));setTotal(value.total);setCheckedAt(saved.savedAt);setSavedDisplay(true);setLoading(false)};
  window.addEventListener("mumei-insight-storage-hydrated",restore);return()=>window.removeEventListener("mumei-insight-storage-hydrated",restore);
 },[revision,scope,page]);
 useEffect(()=>{if(active&&!freshView(verified.current,viewSignature(revision,{page,pageSize:PAGE})))void load(page);return()=>{request.current.id++;request.current.controller?.abort()}},[revision,active,scope]);
 useEffect(()=>{if(active&&open)void loadDetail(open);return()=>{detailRequest.current.id++;detailRequest.current.controller?.abort()}},[revision,active,scope,open]);
 useEffect(()=>{if(!snapshot.current||!validScope())return;const current=snapshot.current,selected=open&&rows.some(row=>String(row[rankingKey(kind)])===open)?open:null;save({...current,open:selected,rows:current.page===page?rows:current.rows,detailRows:selected?details[selected]||[]:[],detailAt:selected?detailVerified.current.get(selected)?.at||current.detailAt:0})},[rows,open,details]);
 function touch(){passiveTouched.current=true}
 function toggle(row:Row){touch();const key=String(row[rankingKey(kind)]);setOpen(previous=>previous===key?null:key)}
 function updateRows(update:Row[]|((previous:Row[])=>Row[])){mutationVersion.current++;setRows(update)}
 return{kind,rows,setRows:updateRows,total,page,open,details,loading,error,checking,savedDisplay,checkedAt,detailSaved,load,toggle,touch,valid:shownScope.current===scope};
}
function Supporters({revision,active=true}:{revision:number;active?:boolean}){const{kind,rows,setRows,total,page,open,details:articles,loading,error,checking,savedDisplay,checkedAt,detailSaved,load,toggle,touch,valid}=useRankingPage("supporters",revision,active);if(!valid)return <p>スキ順位の保存状態を確認中…</p>;
return <section className="miu-panel" onClickCapture={touch} onInputCapture={touch}><SectionHead k="SUPPORTER RANKING" title="全記事スキランキング" count={total===null?"—人":`${n(total)}人`}/>{savedDisplay?<p className="miu-source" data-insight-saved-view={kind}>前回表示分（確認 {date(checkedAt)}）{checking?"・最新を確認中":""}</p>:null}{error?<p className="miu-error">{error}<button onClick={()=>void load()}>再確認</button></p>:null}{loading&&!rows.length?<div className="miu-load-scene"><b>スキ順位を集計中</b><span>表示中の100人と件数を確認</span><i/></div>:<div className="miu-rank-list">{rows.map((r,i)=><article key={r.liker_key}><div className="miu-rank-row"><em>{(page-1)*PAGE+i+1}</em><Person row={r}/><FavoriteStar row={r} onChange={favorite=>setRows(v=>v.map(x=>x===r?{...x,favorite}:x))}/><button onClick={()=>void toggle(r)}><b>{n(r.like_count)}</b><small>記事</small></button></div>{open===String(r.liker_key)?<div className="miu-expand">{detailSaved?<small className="miu-source">前回表示分・詳細を確認中</small>:null}{(articles[String(r.liker_key)]||[]).map(a=><a key={a.article_key} href={a.url||a.article_url} target="_blank" rel="noreferrer"><span>{a.title||a.article_title}</span><time>{date(a.liked_at,false)}</time></a>)}</div>:null}</article>)}</div>}{total!==null?<Pager page={page} total={total} onPage={p=>void load(p)}/>:null}</section>}

function commentState(r:Row,filter:string){if(filter==="heart_closed"||(r.heart_on_last_external&&(r.status==="unreplied"||r.status==="followup_pending")))return{key:"heart_closed",label:"♡で終了"};if(r.status==="unreplied")return{key:"unreplied",label:"未返信"};if(r.status==="followup_pending")return{key:"followup_pending",label:"相手の返信で停止"};if(r.status==="replied")return{key:"replied",label:"自分の返信で終了"};return{key:String(r.status||""),label:String(r.status||"")}}
function Comments({revision}:{revision:number}){const[rows,setRows]=useState<Row[]>([]),[articles,setArticles]=useState<Row[]>([]),[articleKey,setArticleKey]=useState(""),[day,setDay]=useState(""),[draft,setDraft]=useState(""),[query,setQuery]=useState(""),[total,setTotal]=useState(0),[page,setPage]=useState(1),[status,setStatus]=useState("all"),[detail,setDetail]=useState<Record<string,Row[]>>({}),[loading,setLoading]=useState(true),[error,setError]=useState("");const range=useMemo(()=>day?{dateFrom:isoDay(day),dateTo:nextDay(day)}:{dateFrom:null,dateTo:null},[day]);async function loadArticles(){setArticleKey("");if(!day){setArticles([]);return}try{const x=await extra("comment_articles",range);setArticles(x.rows||[])}catch{setArticles([])}}async function load(p=1){setLoading(true);setError("");try{const x=await extra("comments_filtered",{page:p,pageSize:PAGE,status,query,articleKey:articleKey||null,...range});setRows(await enrich(x.rows||[]));setTotal(Number(x.total||0));setPage(p)}catch(e){setError(e instanceof Error?e.message:"読込失敗")}finally{setLoading(false)}}async function open(k:string){if(detail[k])return;const x=await hist("comment_thread",{rootKey:k});setDetail(v=>({...v,[k]:x.rows||[]}))}useEffect(()=>{void loadArticles()},[day]);useEffect(()=>{setDetail({});void load(1)},[status,day,articleKey,query,revision]);return <section className="miu-panel"><SectionHead k="COMMENT HISTORY" title="コメント・返信履歴" count={`${n(total)}件`}/><div className="miu-tabs scroll">{[["all","すべて"],["pending","要対応"],["unreplied","未返信"],["followup_pending","相手返信"],["heart_closed","♡で終了"],["replied","自分返信"]].map(x=><button key={x[0]} className={status===x[0]?"active":""} onClick={()=>setStatus(x[0])}>{x[1]}</button>)}</div><div className="miu-calendar-tools"><label><span>コメント日</span><input type="date" value={day} onChange={e=>setDay(e.target.value)}/></label><select value={articleKey} onChange={e=>setArticleKey(e.target.value)} disabled={!day}><option value="">{day?`この日の記事すべて (${articles.length})`:"日付を選択すると記事一覧"}</option>{articles.map(a=><option key={a.article_key} value={a.article_key}>{a.title}（{n(a.comment_count_day)}件）</option>)}</select><input value={draft} onChange={e=>setDraft(e.target.value)} placeholder="名前・記事・コメント本文" onKeyDown={e=>{if(e.key==="Enter")setQuery(draft)}}/><button onClick={()=>setQuery(draft)}>検索</button>{day?<button onClick={()=>{setDay("");setArticleKey("")}}>日付解除</button>:null}</div>{day&&articles.length?<div className="miu-day-articles">{articles.slice(0,12).map(a=><button className={articleKey===a.article_key?"active":""} key={a.article_key} onClick={()=>setArticleKey(articleKey===a.article_key?"":a.article_key)}><b>{a.title}</b><small>{n(a.comment_count_day)}コメント</small></button>)}</div>:null}{error?<p className="miu-error">{error}</p>:loading&&!rows.length?<p className="miu-empty">履歴を読み込み中…</p>:<div className="miu-comment-list">{rows.map(r=>{const s=commentState(r,status);return <details key={r.root_key} onToggle={e=>{if((e.currentTarget as HTMLDetailsElement).open)void open(r.root_key)}}><summary><Person row={r}/><span className={`miu-state ${s.key}`}>{s.label}</span><p>{String(r.root_body||"").slice(0,120)}</p><a href={r.article_url} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()}>{r.article_title}</a><time>{date(r.last_at||r.root_at)}</time></summary><div className="miu-thread">{detail[r.root_key]?.map(m=><article key={m.comment_key} className={m.is_creator?"mine":""}><b>{m.is_creator?"あなた":m.actor_name}</b><small>{date(m.occurred_at)}</small><p>{m.body}</p></article>)||<p>会話を読み込み中…</p>}</div></details>})}</div>}<Pager page={page} total={total} onPage={p=>void load(p)}/></section>}

function CommentRanking({revision,active=true}:{revision:number;active?:boolean}){const{kind,rows,total,page,open,details:comments,loading,error,checking,savedDisplay,checkedAt,detailSaved,load,toggle,touch,valid}=useRankingPage("comment_ranking",revision,active);if(!valid)return <p>コメント順位の保存状態を確認中…</p>;
return <section className="miu-panel" onClickCapture={touch} onInputCapture={touch}><SectionHead k="COMMENT RANKING" title="初手コメント順位" count={total===null?"—人":`${n(total)}人`}/>{savedDisplay?<p className="miu-source" data-insight-saved-view={kind}>前回表示分（確認 {date(checkedAt)}）{checking?"・最新を確認中":""}</p>:null}{error?<p className="miu-error">{error}<button onClick={()=>void load()}>再確認</button></p>:null}<p className="miu-source">初手コメ＝親コメント件数。対象記事＝重複を除いた記事数。差分は「重複初手」に表示します。</p>{loading&&!rows.length?<div className="miu-load-scene"><b>コメント順位を集計中</b><span>最新の集計を確認</span><i/></div>:<div className="miu-rank-list miu-comment-ranks">{rows.map((r,i)=>{const duplicate=Math.max(0,Number(r.initial_comment_count||0)-Number(r.article_count||0));return <article key={r.actor_key}><div className="miu-comment-rank-row"><em>{(page-1)*PAGE+i+1}</em><Person row={r}/><div className="miu-rank-metrics"><button onClick={()=>void toggle(r)}><b>{n(r.initial_comment_count)}</b><small>初手コメ</small></button><span><b>{n(r.article_count)}</b><small>対象記事</small></span><span className={duplicate?"mismatch":""}><b>{duplicate?`+${n(duplicate)}`:"0"}</b><small>重複初手</small></span><time><b>{date(r.last_comment_at,false)}</b><small>最終コメント</small></time></div></div>{open===String(r.actor_key)?<div className="miu-expand">{detailSaved?<small className="miu-source">前回表示分・詳細を確認中</small>:null}{(comments[String(r.actor_key)]||[]).map(c=><a key={c.root_key||c.comment_key} href={c.article_url} target="_blank" rel="noreferrer"><span><b>{c.article_title}</b><small>{String(c.body||"").slice(0,90)}</small></span><time>{date(c.occurred_at,false)}</time></a>)}</div>:null}</article>})}</div>}{total!==null?<Pager page={page} total={total} onPage={p=>void load(p)}/>:null}</section>}

const magazineSearch=(params:Record<string,unknown>,signal:AbortSignal)=>post(EXTRAS,"magazine_articles",params,signal);
function Magazines({revision,active=true}:{revision:number;active?:boolean}){const verified=useRef<(VerifiedView&{payload:any})|null>(null),signature=viewSignature(revision,{});const history=useMemo(()=>async()=>{if(freshView(verified.current,signature))return verified.current!.payload;const payload=await hist("magazines");if(viewSignature(revision,{})===signature&&!payload.__offlineCache)verified.current={signature,at:Date.now(),payload};return payload},[signature]);return <MemberInsightMagazines key={cachedAccountId()} revision={revision} accountKey={cachedAccountId()} active={active} history={history} search={magazineSearch} cached={readDataCache(HISTORY,"magazines",{})}/>}

function Favorites({revision}:{revision:number}){const[rows,setRows]=useState<Row[]>([]),[open,setOpen]=useState<string|null>(null),[day,setDay]=useState(""),[query,setQuery]=useState(""),[articles,setArticles]=useState<Record<string,Row[]>>({}),[loading,setLoading]=useState(true),[searching,setSearching]=useState(false);useEffect(()=>{setLoading(true);void hist("favorites").then(x=>setRows(x.rows||[])).finally(()=>setLoading(false))},[revision]);async function loadArticles(r:Row,dayValue=day,queryValue=query){const key=String(r.creator_key);setOpen(key);setSearching(true);try{const range=dayValue?{dateFrom:isoDay(dayValue),dateTo:nextDay(dayValue)}:{dateFrom:null,dateTo:null};const x=await extra("favorite_articles",{creatorKey:key,creatorUrl:r.actor_url,query:queryValue,...range,page:1});setArticles(v=>({...v,[key]:x.rows||[]}))}finally{setSearching(false)}}async function setRead(r:Row,a:Row,read:boolean){await extra("favorite_read_set",{creatorKey:r.creator_key,creatorUrl:r.actor_url,articleKey:a.key,articleUrl:a.url,read});setArticles(v=>({...v,[String(r.creator_key)]:(v[String(r.creator_key)]||[]).map(x=>x.key===a.key?{...x,read}:x)}))}return <section className="miu-panel"><SectionHead k="FAVORITE READER" title="お気に入り・記事Reader" count={`${n(rows.length)}人`}/>{loading&&!rows.length?<p className="miu-empty">読み込み中…</p>:<div className="miu-fav-reader">{rows.map(r=>{const key=String(r.creator_key),list=articles[key]||[];return <article className="miu-fav-creator" key={key}><div className="miu-fav-head"><Person row={{actor_name:r.actor_name,actor_url:r.actor_url,actor_image_url:r.actor_image_url}}/><div><button onClick={()=>{const opening=open!==key;setOpen(opening?key:null);if(opening){setDay("");setQuery("");if(!list.length)void loadArticles(r,"","")}}}>{open===key?"閉じる":"記事を見る"}</button><a href={r.actor_url} target="_blank" rel="noreferrer">プロフィール ↗</a></div></div>{open===key?<div className="miu-fav-body"><div className="miu-calendar-tools"><label><span>投稿日</span><input type="date" value={day} onChange={e=>{const v=e.target.value;setDay(v);void loadArticles(r,v,query)}}/></label><input value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")void loadArticles(r,day,query)}} placeholder="記事タイトル・本文"/><button disabled={searching} onClick={()=>void loadArticles(r)}>{searching?"検索中…":"検索"}</button></div>{searching?<p className="miu-empty">記事を検索中…</p>:list.length?<div className="miu-fav-articles">{list.map(a=><article className={a.read?"read":"unread"} key={a.key}><a href={a.url} target="_blank" rel="noreferrer" onClick={()=>void setRead(r,a,true)}>{a.thumbnail?<img src={a.thumbnail} alt="" referrerPolicy="no-referrer"/>:<span className="miu-fav-thumb"/>}<div><small>{a.read?"既読":"● 未読"}・{date(a.publishedAt,false)}</small><b>{a.title}</b><em>♡ {n(a.likeCount)}　💬 {n(a.commentCount)}</em>{a.excerpt?<p>{a.excerpt}</p>:null}</div></a><button onClick={()=>void setRead(r,a,!a.read)}>{a.read?"未読に戻す":"既読にする"}</button></article>)}</div>:<p className="miu-empty">条件に合う記事はありません。</p>}</div>:null}</article>})}</div>}</section>}

function Social({revision}:{revision:number}){const[direction,setDirection]=useState("followers"),[mode,setMode]=useState("current"),[change,setChange]=useState("all"),[day,setDay]=useState(""),[rows,setRows]=useState<Row[]>([]),[total,setTotal]=useState(0),[page,setPage]=useState(1),[loading,setLoading]=useState(true);const range=useMemo(()=>day?{dateFrom:isoDay(day),dateTo:nextDay(day)}:{dateFrom:null,dateTo:null},[day]);async function load(p=1){setLoading(true);try{const x=mode==="changes"?await extra("social_changes",{page:p,pageSize:PAGE,direction,change,...range}):await hist("social",{page:p,pageSize:PAGE,direction});setRows(await enrich(x.rows||[]));setTotal(Number(x.total||0));setPage(p)}finally{setLoading(false)}}useEffect(()=>{void load(1)},[direction,mode,change,day,revision]);return <section className="miu-panel"><SectionHead k="SOCIAL HISTORY" title="フォロー・フォロワー" count={`${n(total)}件`}/><div className="miu-tabs"><button className={direction==="followers"?"active":""} onClick={()=>setDirection("followers")}>フォロワー</button><button className={direction==="followings"?"active":""} onClick={()=>setDirection("followings")}>フォロー中</button><button className={mode==="current"?"active":""} onClick={()=>{setMode("current");setDay("")}}>現在一覧</button><button className={mode==="changes"?"active":""} onClick={()=>setMode("changes")}>増減履歴</button></div><div className="miu-calendar-tools"><label><span>増減日</span><input type="date" value={day} onChange={e=>{setDay(e.target.value);if(e.target.value)setMode("changes")}}/></label>{mode==="changes"?<div className="miu-tabs mini">{[["all","すべて"],["added","増えた"],["removed","減った"]].map(x=><button key={x[0]} className={change===x[0]?"active":""} onClick={()=>setChange(x[0])}>{x[1]}</button>)}</div>:null}</div>{loading&&!rows.length?<p className="miu-empty">履歴を読み込み中…</p>:<div className="miu-card-grid">{rows.map((r,i)=><article className="miu-social" key={r.id||r.person_key||i}><Person row={r}/>{mode==="changes"?<b className={r.event_type==="removed"?"removed":"added"}>{r.event_type==="removed"?"減少":"追加"}</b>:null}<time>{mode==="changes"?`増減日 ${date(r.detected_at,false)}`:`最終確認 ${date(r.last_seen_at,false)}`}</time></article>)}</div>}<Pager page={page} total={total} onPage={p=>void load(p)}/></section>}

const noticeLabels:Record<string,string>={reply:"返信",comment:"コメント",comment_like:"コメントスキ",like:"記事スキ",follow:"フォロー",purchase:"購入",tip:"チップ",membership:"メンシプ",buzz:"話題",magazine:"マガジン",rating:"高評価",points:"ポイント",other:"その他"};
function cleanNotice(v:any){return String(v||"").replace(/\s+/g," ").replace(/\s+\d+\s*(?:秒|分|時間|日)前\s*$/," ").trim()}
function shortDay(v:string){if(!v)return"";const[y,m,d]=v.split("-");return`${Number(y)}/${Number(m)}/${Number(d)}`}
function Notifications({revision,noteId:memberNoteId,articles,navigation=false}:{revision:number;noteId:string;articles:Row[];navigation?:boolean}){const[kind,setKind]=useState("all"),[from,setFrom]=useState(""),[to,setTo]=useState(""),[rows,setRows]=useState<Row[]>([]),[total,setTotal]=useState(0),[page,setPage]=useState(1),[loading,setLoading]=useState(true),[error,setError]=useState("");const range=useMemo(()=>({dateFrom:from?isoDay(from):null,dateTo:to?nextDay(to):null}),[from,to]);async function load(p=1){setLoading(true);setError("");try{const x=await notify({page:p,pageSize:PAGE,kind,...range});setRows(await enrich(x.rows||[]));setTotal(Number(x.total||0));setPage(p)}catch(e){setError(e instanceof Error?e.message:"通知読込失敗")}finally{setLoading(false)}}useEffect(()=>{void load(1)},[kind,from,to,revision]);const [titleArticles,setTitleArticles]=useState<Row[]>([]);
 // Navigation summaries omit the archive, but legacy browser notices may still
 // need its stored title. Read it only when a visible card actually needs it.
 useEffect(()=>{
  if(!navigation)return;
  const known=new Map((articles||[]).map(a=>[cleanUrl(a.url),String(a.title||"")]));
  const missing=rows.filter(r=>!r.target_title&&/\/n\//.test(String(r.target_url||""))&&!known.get(cleanUrl(r.target_url)));
  if(!missing.length)return;
  const saved=readSavedArticles(),savedTitles=new Map((saved?.value.rows||[]).map(a=>[cleanUrl(a.url),String(a.title||"")]));
  if(saved)setTitleArticles(saved.value.rows);
  if(saved&&revision===0&&Date.now()-saved.savedAt<60_000&&missing.every(r=>savedTitles.get(cleanUrl(r.target_url))))return;
  let live=true;const controller=new AbortController(),token=localStorage.getItem(INSIGHT_TOKEN_KEY),account=cachedAccountId();
  void hist("articles",{},controller.signal).then(result=>{if(live&&!controller.signal.aborted&&localStorage.getItem(INSIGHT_TOKEN_KEY)===token&&cachedAccountId()===account)setTitleArticles(result.rows)}).catch(()=>{});
  return()=>{live=false;controller.abort()};
 },[navigation,rows]);
 const articleTitles=useMemo(()=>new Map([...titleArticles,...(articles||[])].map(a=>[cleanUrl(a.url),String(a.title||"")])),[articles,titleArticles]),tabs:[string,string][]=[["all","すべて"],["reply","返信"],["comment","コメント"],["comment_like","コメントスキ"],["like","記事スキ"],["follow","フォロー"],["purchase","購入"],["tip","チップ"],["membership","メンシプ"],["buzz","話題"],["magazine","マガジン"],["rating","高評価"],["other","その他"]],role=String(memberNoteId||"").toLowerCase()==="ss_yr"?"owner":"member",kindLabel=noticeLabels[kind]||"通知",period=(from||to)?`${from?shortDay(from):"最初"}〜${to?shortDay(to):"現在"}`:"全期間";return <section className="miu-panel"><SectionHead k="NOTIFICATIONS" title="本人通知・反応履歴" count={`${n(total)}件`}><a className="miu-setup" href={`./notification-setup.html?from=insight&role=${role}`} target="_blank" rel="noopener noreferrer">通知同期を設定</a></SectionHead><div className="miu-tabs scroll miu-notice-tabs">{tabs.map(x=><button key={x[0]} className={kind===x[0]?"active":""} onClick={()=>setKind(x[0])}>{x[1]}</button>)}</div><div className="miu-calendar-tools"><label><span>開始日</span><input type="date" value={from} max={to||undefined} onChange={e=>setFrom(e.target.value)}/></label><label><span>終了日</span><input type="date" value={to} min={from||undefined} onChange={e=>setTo(e.target.value)}/></label>{from||to?<button onClick={()=>{setFrom("");setTo("")}}>期間解除</button>:null}</div><p className="miu-source"><b>{period}</b> に届いた {kindLabel}：<b>{n(total)}件</b>{kind==="comment"||kind==="reply"?"（実コメント履歴から集計）":""}</p>{kind==="comment_like"&&!total?<p className="miu-source">コメントスキは本人通知同期で今後取得した「あなたのコメントへのスキ」を表示します。過去保存分に該当がない場合は0件です。</p>:null}{error?<p className="miu-error">{error}</p>:loading&&!rows.length?<p className="miu-empty">通知履歴を読み込み中…</p>:<div className="miu-notice-cards">{rows.map(r=>{const actorName=r.actor_name||noteId(r.actor_url)||"note通知",label=noticeLabels[String(r.notification_type||"")]||String(r.notification_type||"通知"),targetUrl=String(r.target_url||""),targetTitle=String(r.target_title||articleTitles.get(cleanUrl(targetUrl))||""),isArticle=/\/n\//.test(targetUrl),body=cleanNotice(r.raw_text);return <article className="miu-notice-card" key={`${r.member_id}:${r.id}`}><header><Avatar name={actorName} image={r.actor_image_url}/><div><span className={`miu-notice-kind ${r.notification_type||"other"}`}>{label}</span>{r.actor_url?<a href={r.actor_url} target="_blank" rel="noreferrer"><b>{actorName}</b><small>プロフィール ↗</small></a>:<b>{actorName}</b>}<time>{date(r.occurred_at||r.captured_at)}</time></div></header>{targetTitle?<a className="miu-notice-target" href={targetUrl||undefined} target={targetUrl?"_blank":undefined} rel={targetUrl?"noreferrer":undefined}><b>{targetTitle}</b>{targetUrl?<small>{isArticle?"記事を開く ↗":"リンクを開く ↗"}</small>:null}</a>:targetUrl?<a className="miu-notice-target compact" href={targetUrl} target="_blank" rel="noreferrer"><b>{isArticle?"対象記事":"対象ページ"}</b><small>{isArticle?"記事を開く ↗":"リンクを開く ↗"}</small></a>:null}{body?<p className="miu-notice-text">{body}</p>:null}</article>})}</div>}<Pager page={page} total={total} onPage={p=>void load(p)}/></section>}

function loadThumbCache(){try{const x=JSON.parse(localStorage.getItem(SELF_THUMB_CACHE)||"{}");return x&&typeof x==="object"?x:{}}catch{return{}}}
function Articles({data,dashboardData,active=true,revision=0}:{data:Summary;dashboardData?:any;active?:boolean;revision?:number}){
 const navigation=data.summaryMode==="navigation",[saved]=useState(readSavedArticles);
 const[archive,setArchive]=useState<Row[]>(()=>saved?.value.rows||data.articles),[archiveKnown,setArchiveKnown]=useState(Boolean(saved||data.articles.length)),[archiveChecking,setArchiveChecking]=useState(false),[archiveError,setArchiveError]=useState(""),[archiveSavedAt,setArchiveSavedAt]=useState(saved?.savedAt||0);
 const archivePassive=useRef(Boolean(saved||data.articles.length));
 const archiveRequest=useRef({id:0,controller:null as AbortController|null}),archiveVerified=useRef<VerifiedView|null>(null);
 async function loadArchive(){
  const signature=viewSignature(revision,{});if(freshView(archiveVerified.current,signature))return;
  const token=localStorage.getItem(INSIGHT_TOKEN_KEY),account=cachedAccountId(),id=++archiveRequest.current.id;
  archiveRequest.current.controller?.abort();const controller=new AbortController();archiveRequest.current.controller=controller;
  const valid=()=>id===archiveRequest.current.id&&!controller.signal.aborted&&localStorage.getItem(INSIGHT_TOKEN_KEY)===token&&cachedAccountId()===account;
  setArchiveChecking(true);setArchiveError("");archiveVerified.current=null;
  try{const result=await hist("articles",{},controller.signal);if(!valid())return;archivePassive.current=true;setArchive(result.rows);setArchiveKnown(true);if(result.__offlineCache){setArchiveSavedAt(Number(result.__cachedAt||0));setArchiveError("最新確認に失敗したため前回保存分を表示しています。")}else{archiveVerified.current={signature,at:Date.now()};setArchiveSavedAt(0)}}
  catch(error){if(valid()){if(deniedError(error)){archivePassive.current=true;setArchive([]);setArchiveKnown(false);setArchiveSavedAt(0);removeSavedInsightView("article-archive",savedViewScope())}setArchiveError(apiErrorMessage(error,"記事を確認できませんでした。"))}}
  finally{if(valid())setArchiveChecking(false);if(archiveRequest.current.controller===controller)archiveRequest.current.controller=null}
 }
 useEffect(()=>{
  const token=localStorage.getItem(INSIGHT_TOKEN_KEY),account=cachedAccountId();
  const restore=()=>{if(archivePassive.current||!navigation||localStorage.getItem(INSIGHT_TOKEN_KEY)!==token||cachedAccountId()!==account)return;const saved=readSavedArticles();if(!saved)return;archivePassive.current=true;setArchive(saved.value.rows);setArchiveKnown(true);setArchiveSavedAt(saved.savedAt)};
  window.addEventListener("mumei-insight-storage-hydrated",restore);restore();return()=>window.removeEventListener("mumei-insight-storage-hydrated",restore);
 },[navigation,revision]);
 useEffect(()=>{if(active&&navigation)void loadArchive();return()=>{archiveRequest.current.id++;archiveRequest.current.controller?.abort()}},[active,navigation,revision]);
 // Older servers and the read-only DB fallback still return the full summary.
 // Keep that contract without adding a second article read during staged rollout.
 const articleRows=navigation?archive:data.articles;
 const[query,setQuery]=useState(""),[day,setDay]=useState(""),[month,setMonth]=useState("all"),[sort,setSort]=useState("newest"),[limit,setLimit]=useState(40),[thumbs,setThumbs]=useState<Record<string,string|null>>(loadThumbCache);const months=useMemo(()=>[...new Set((articleRows||[]).map(r=>jstDay(r.publish_at).slice(0,7)).filter(Boolean))].sort().reverse(),[articleRows]);const visible=useMemo(()=>{const q=query.trim().toLowerCase();return [...(articleRows||[])].filter(r=>{const d=jstDay(r.publish_at);return(!day||d===day)&&(month==="all"||d.startsWith(month))&&(!q||String(r.title||"").toLowerCase().includes(q))}).sort((a,b)=>(sort==="oldest"?1:-1)*(new Date(a.publish_at||0).getTime()-new Date(b.publish_at||0).getTime()))},[articleRows,query,day,month,sort]);const officialByUrl=useMemo(()=>new Map((dashboardData?.topArticles||[]).map((r:Row)=>[cleanUrl(r.url),r])),[dashboardData]);useEffect(()=>setLimit(40),[query,day,month,sort]);const shown=visible.slice(0,limit),signature=shown.map(r=>String(r.article_key||r.url)).join("|");useEffect(()=>{if(!active)return;let dead=false;const missing=shown.filter(r=>!Object.prototype.hasOwnProperty.call(thumbs,String(r.article_key||r.url))).slice(0,40);if(!missing.length)return()=>{dead=true};void post(THUMBS,"resolve",{articles:missing.map(r=>({key:r.article_key,url:r.url}))}).then(x=>{if(dead)return;setThumbs(prev=>{const next={...prev};for(const r of x.rows||[])next[String(r.key||r.url)]=r.thumbnail||null;try{const entries=Object.entries(next).slice(-400);localStorage.setItem(SELF_THUMB_CACHE,JSON.stringify(Object.fromEntries(entries)))}catch{}return next})}).catch(()=>{});return()=>{dead=true}},[signature,active]);return <section className="miu-panel"><SectionHead k="ARTICLE ARCHIVE" title="自分の記事・過去アーカイブ" count={navigation&&!archiveKnown?"未確認":`${n(visible.length)}件`}/>{navigation&&archiveChecking?<p role="status">記事の最新データを確認中…</p>:null}{navigation&&archiveSavedAt?<p className="miu-source">前回表示分（確認 {date(archiveSavedAt)}）</p>:null}{navigation&&archiveError?<p className="miu-error" role="alert">{archiveError} <button onClick={()=>void loadArchive()}>再確認</button></p>:null}<div className="miu-tools"><input type="date" value={day} onChange={e=>setDay(e.target.value)}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="記事タイトルを検索"/><select value={month} onChange={e=>setMonth(e.target.value)}><option value="all">全期間</option>{months.map(m=><option value={m} key={m}>{m.replace("-","年")}月</option>)}</select><select value={sort} onChange={e=>setSort(e.target.value)}><option value="newest">新しい順</option><option value="oldest">古い順</option></select></div><div className="miu-self-article-grid">{shown.map(r=>{const key=String(r.article_key||r.url),thumb=thumbs[key];return <a key={key} href={r.url} target="_blank" rel="noreferrer">{thumb?<img src={thumb} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer"/>:<span className="miu-self-thumb"/>}<div><time>{date(r.publish_at,false)}</time><b>{r.title}</b>{(()=>{const o=officialByUrl.get(cleanUrl(r.url)) as Row|undefined;return <span>{o?`公式 ♡ ${n(o.likes)}　💬 ${n(o.comments)}`:"公式 ♡ —　💬 —"}</span>})()}</div></a>})}</div>{shown.length<visible.length?<button className="miu-more" onClick={()=>setLimit(v=>v+40)}>さらに40件表示（残り {n(visible.length-shown.length)}件）</button>:null}</section>}

const INSIGHT_TABS=new Set(["likes","supporters","comments","commentRanking","magazines","favorites","social","notifications","dm","articles"]);
function historyTab():Tab{const state=window.history.state||{};if(INSIGHT_TABS.has(state.insightTab))return state.insightTab;return (["comments","favorites","social","notifications"].includes(state.insightMode)?state.insightMode:"likes") as Tab}
export function MemberInsightUnifiedV4({revision=0,onTabChange,active=true}:{revision?:number;onTabChange?:(tab:Tab)=>void;active?:boolean}){
  const[initialSaved]=useState(readSavedSummary),[initial]=useState(initialSummary),[initialDashboard]=useState(savedDashboardDisplay);
  const[summarySavedAt,setSummarySavedAt]=useState(initialSaved?.savedAt||0),[summaryChecking,setSummaryChecking]=useState(false);
  const initialTab=historyTab();
  const sessionKey=JSON.stringify([localStorage.getItem(INSIGHT_TOKEN_KEY),cachedAccountId()]);
  const[data,setData]=useState<Summary|null>(initial),[dashboardData,setDashboardData]=useState<any>(initialDashboard),[tab,setTab]=useState<Tab>(initialTab),[loading,setLoading]=useState(!initial),[error,setError]=useState(""),[syncing,setSyncing]=useState(false);
  const[visited,setVisited]=useState<Set<Tab>>(()=>new Set<Tab>(["likes",initialTab])),[refreshVersion,setRefreshVersion]=useState(0);
  const sceneRevision=revision+refreshVersion;
  const persistent=new Set<Tab>(["likes","supporters","commentRanking","magazines","dm","articles"]);
  const dashboardKnown=useRef(Boolean(initialDashboard)),dashboardDenied=useRef(false);
  const summaryRequest=useRef({id:0,controller:null as AbortController|null}),dashboardRequest=useRef({id:0,controller:null as AbortController|null});
  const summaryView=useRef<VerifiedView|null>(null),dashboardView=useRef<VerifiedView|null>(null),shownSession=useRef(sessionKey),ownedSummary=useRef({session:sessionKey,value:initial}),summaryKnown=useRef(Boolean(initialSaved)),summaryDenied=useRef(false),summaryPassiveRevision=useRef(revision),summaryTouched=useRef(false);
  async function load(preserve=true,force=true){
    const signature=viewSignature(revision,{});
    if(!force&&freshView(summaryView.current,signature))return;
    summaryView.current=null;
    const y=window.scrollY,token=localStorage.getItem(INSIGHT_TOKEN_KEY),account=cachedAccountId(),id=++summaryRequest.current.id;
    summaryRequest.current.controller?.abort();const controller=new AbortController();summaryRequest.current.controller=controller;
    const valid=()=>id===summaryRequest.current.id&&!controller.signal.aborted&&localStorage.getItem(INSIGHT_TOKEN_KEY)===token&&cachedAccountId()===account;
    setError("");setSummaryChecking(true);
    try{const summary=await post(HISTORY,"summary",{view:"navigation"},controller.signal);if(!valid())return;summaryKnown.current=true;ownedSummary.current={session:sessionKey,value:summary};setData(summary);if(!summary.__offlineCache){summaryView.current={signature,at:Date.now()};writeSummaryCache(summary);setSummarySavedAt(0)}if(summary.__offlineCache)setError(`最新確認に失敗したため前回保存分を表示しています。${summary.__offlineError||""}`);if(preserve)requestAnimationFrame(()=>window.scrollTo({top:y,behavior:"auto"}))}
    catch(e){if(!valid())return;const msg=e instanceof Error?e.message:"INSIGHT_API_ERROR";if(/LOGIN|SESSION|INACTIVE/.test(msg)&&!/BACKEND_RESTRICTED_402/.test(msg)){summaryDenied.current=true;removeSavedInsightView("unified-summary",savedViewScope());removeLikesView();localStorage.removeItem(INSIGHT_TOKEN_KEY);location.hash="access/insight";return}const fallback=readSummaryCache(true)||(ownedSummary.current.session===sessionKey?ownedSummary.current.value:null)||emergencySummary();if(fallback){setData(fallback);setError(`${readSummaryCache(true)?"最新確認に失敗したため前回保存分を表示しています。":"最新確認に失敗しました。ログイン状態を維持しています。"}${apiErrorMessage(e,"保存先の確認に失敗しました。")}`)}else setError(msg)}
    finally{if(valid()){setLoading(false);setSummaryChecking(false)}}
  }
  async function loadDashboard(force=false){
    // Article cards need official snapshot values; other tabs need only their own saved page.
    // dashboardOnly also excludes the public like/comment history scans in analysis().
    if(!active||tab!=="articles")return;
    const signature=viewSignature(revision,{});if(!force&&freshView(dashboardView.current,signature))return;
    dashboardView.current=null;
    const token=localStorage.getItem(INSIGHT_TOKEN_KEY),account=cachedAccountId(),id=++dashboardRequest.current.id;
    dashboardRequest.current.controller?.abort();const controller=new AbortController();dashboardRequest.current.controller=controller;
    const valid=()=>id===dashboardRequest.current.id&&!controller.signal.aborted&&localStorage.getItem(INSIGHT_TOKEN_KEY)===token&&cachedAccountId()===account;
    try{const dash=await post(DASH,"analysis",{days:365,dashboardOnly:true},controller.signal);if(!valid())return;dashboardKnown.current=true;setDashboardData(dash.__offlineCache?{...dash,__savedViewAt:dash.__cachedAt}:dash);if(!dash.__offlineCache)dashboardView.current={signature,at:Date.now()}}
    catch(error){if(valid()&&deniedError(error)){dashboardDenied.current=true;dashboardKnown.current=false;setDashboardData(null);removeSavedInsightView("article-dashboard",savedViewScope());dashboardView.current=null;setError(apiErrorMessage(error,"本人確認が拒否されました。"))}/* Transient failures keep previously verified values. */}
    finally{if(dashboardRequest.current.controller===controller)dashboardRequest.current.controller=null}
  }
  useEffect(()=>{
    const token=localStorage.getItem(INSIGHT_TOKEN_KEY),account=cachedAccountId();
    const restore=()=>{if(summaryKnown.current||summaryDenied.current||summaryTouched.current||revision!==summaryPassiveRevision.current||shownSession.current!==sessionKey||localStorage.getItem(INSIGHT_TOKEN_KEY)!==token||cachedAccountId()!==account)return;const saved=readSavedSummary();if(!saved)return;summaryKnown.current=true;ownedSummary.current={session:sessionKey,value:saved.value};setData(saved.value);setSummarySavedAt(saved.savedAt);setLoading(false)};
    window.addEventListener("mumei-insight-storage-hydrated",restore);return()=>window.removeEventListener("mumei-insight-storage-hydrated",restore);
  },[sessionKey,revision]);
  useEffect(()=>{
    const token=localStorage.getItem(INSIGHT_TOKEN_KEY),account=cachedAccountId();
    const restore=()=>{if(dashboardKnown.current||dashboardDenied.current||shownSession.current!==sessionKey||localStorage.getItem(INSIGHT_TOKEN_KEY)!==token||cachedAccountId()!==account)return;const saved=savedDashboardDisplay();if(!saved)return;dashboardKnown.current=true;setDashboardData(saved)};
    window.addEventListener("mumei-insight-storage-hydrated",restore);return()=>window.removeEventListener("mumei-insight-storage-hydrated",restore);
  },[sessionKey]);
  useEffect(()=>{if(shownSession.current!==sessionKey){shownSession.current=sessionKey;const next=initialSummary();summaryKnown.current=Boolean(readSavedSummary());summaryDenied.current=false;summaryTouched.current=false;summaryPassiveRevision.current=revision;ownedSummary.current={session:sessionKey,value:next};setData(next);const dashboard=savedDashboardDisplay();dashboardKnown.current=Boolean(dashboard);dashboardDenied.current=false;setDashboardData(dashboard);setError("");setSummarySavedAt(readSavedSummary()?.savedAt||0);setSummaryChecking(false);summaryView.current=null;dashboardView.current=null;setLoading(!next)}if(active)void load(false,false);return()=>{summaryRequest.current.id++;summaryRequest.current.controller?.abort()}},[revision,active,sessionKey]);
  useEffect(()=>{if(active&&tab==="articles")void loadDashboard();return()=>{dashboardRequest.current.id++;dashboardRequest.current.controller?.abort()}},[revision,active,sessionKey,tab]);
  async function sync(){summaryTouched.current=true;setSyncing(true);setError("");try{const token=localStorage.getItem(INSIGHT_TOKEN_KEY)||"";const r=await fetchInsightResource(MEMBER,{method:"POST",headers:{"Content-Type":"application/json","X-Insight-Token":token},body:JSON.stringify({action:"sync"}),cache:"no-store"});const p=await r.json().catch(()=>({}));if(r.status===402)throw new Error("BACKEND_RESTRICTED_402");if(!r.ok||p?.ok===false)throw new Error(p?.error||"同期失敗");if(localStorage.getItem(INSIGHT_TOKEN_KEY)!==token)return;dashboardView.current=null;void loadDashboard(true);await load(true);if(localStorage.getItem(INSIGHT_TOKEN_KEY)===token)setRefreshVersion(v=>v+1)}catch(e){const msg=e instanceof Error?e.message:"同期失敗";setError(/BACKEND_RESTRICTED_402|Failed to fetch|NetworkError/i.test(msg)?"INSIGHT保存先が一時停止中です。ログイン状態は維持しています。":msg)}finally{setSyncing(false)}}
  function switchAccount(){setAccessIntent("switch");location.hash="access/insight"}
  function markVisited(next:Tab){if(!persistent.has(next))return;setVisited(prev=>{if(prev.has(next))return prev;const copy=new Set(prev);copy.add(next);return copy})}
  function chooseTab(next:Tab){markVisited(next);setTab(next);onTabChange?.(next)}
  useEffect(()=>{const restore=()=>{const next=historyTab();markVisited(next);setTab(next)};window.addEventListener("popstate",restore);window.addEventListener("mumei-insight-navigation",restore);return()=>{window.removeEventListener("popstate",restore);window.removeEventListener("mumei-insight-navigation",restore)}},[]);
  if(loading||shownSession.current!==sessionKey||data&&String(data.member.noteId).toLowerCase()!==cachedAccountId())return <div className="miu-loading">INSIGHTの保存状態を確認しています…</div>;
  if(!data)return <div className="miu-loading"><p>{error||"読み込めませんでした"}</p><button onClick={()=>{setLoading(true);void load(false)}}>再読込</button></div>;
  const summary=data.summary||{},analysis=data.analysis||{},officialDash=dashboardData?.latestDashboard||null,officialLikes=officialDash&&officialDash.availableTotals?.likes!==false?Number(officialDash.likes||0):null,officialComments=officialDash&&officialDash.availableTotals?.comments!==false?Number(officialDash.comments||0):null,officialArticles=officialDash?Number(officialDash.summary?.articles||0):null;
  return <div className="miu"><main>
    <header className="miu-top"><Avatar name={data.member.displayName} image={data.member.imageUrl} noteId={data.member.noteId}/><div><small>MY NOTE INSIGHT</small><h1>{data.member.displayName}</h1><a href={`https://note.com/${data.member.noteId}`} target="_blank" rel="noreferrer">@{data.member.noteId} ↗</a></div><div className="miu-topactions"><button onClick={switchAccount}>アカウント切替</button><button className="sync" disabled={syncing} onClick={()=>void sync()}>{syncing?"更新中…":"データ更新"}</button></div></header>
    {summarySavedAt?<p className="miu-source" data-insight-saved-view="summary">前回表示分（確認 {date(summarySavedAt)}）{summaryChecking?"・最新を確認中":""}</p>:null}
    {dashboardData?.__savedViewAt?<p className="miu-source" data-insight-saved-view="article-dashboard">公式値は前回表示分（確認 {date(dashboardData.__savedViewAt)}）</p>:null}
    {error?<p className="miu-error">{error}</p>:null}
    <div className="miu-stats"><button onClick={()=>chooseTab("articles")}><small>{officialArticles!==null?"公式記事":"記事"}</small><strong>{n(officialArticles!==null&&officialArticles>0?officialArticles:(summary.articleCount||data.articles.length))}</strong></button><button onClick={()=>chooseTab("likes")}><small>{officialLikes!==null?"公式スキ":"保存スキ"}</small><strong>{n(officialLikes!==null?officialLikes:summary.identifiedLikeCount)}</strong></button><button onClick={()=>chooseTab("supporters")}><small>スキした人数</small><strong>{n(summary.supporterCount||analysis.uniqueSupporters)}</strong></button><button onClick={()=>chooseTab("comments")}><small>{officialComments!==null?"公式コメント":"コメント"}</small><strong>{n(officialComments!==null?officialComments:data.counts.comments)}</strong></button><button onClick={()=>chooseTab("social")}><small>フォロワー</small><strong>{n(data.counts.followers)}</strong></button><button onClick={()=>chooseTab("notifications")}><small>本人通知</small><strong>{n(data.counts.notifications)}</strong></button></div>
    <div className="miu-tab-stage">
      {<>
        {visited.has("likes")?<div hidden={tab!=="likes"}><Likes key={sessionKey} revision={sceneRevision} active={active&&tab==="likes"}/></div>:null}
        {visited.has("supporters")?<div hidden={tab!=="supporters"}><Supporters key={sessionKey} revision={sceneRevision} active={active&&tab==="supporters"}/></div>:null}
        {visited.has("commentRanking")?<div hidden={tab!=="commentRanking"}><CommentRanking key={sessionKey} revision={sceneRevision} active={active&&tab==="commentRanking"}/></div>:null}
        {visited.has("magazines")?<div hidden={tab!=="magazines"}><Magazines key={sessionKey} revision={sceneRevision} active={active&&tab==="magazines"}/></div>:null}
        {visited.has("dm")?<div hidden={tab!=="dm"}><MemberInsightDm revision={revision} active={active&&tab==="dm"}/></div>:null}
        {visited.has("articles")?<div hidden={tab!=="articles"}><Articles key={sessionKey} data={data} dashboardData={dashboardData} active={active&&tab==="articles"} revision={sceneRevision}/></div>:null}
        {active&&tab==="comments"?<Comments revision={revision}/>:null}
        {active&&tab==="favorites"?<Favorites revision={revision}/>:null}
        {active&&tab==="social"?<Social revision={revision}/>:null}
        {active&&tab==="notifications"?<Notifications key={sessionKey} revision={sceneRevision} noteId={data.member.noteId} articles={data.articles} navigation={data.summaryMode==="navigation"}/>:null}
      </>}
    </div>
  </main></div>
}
