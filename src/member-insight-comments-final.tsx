import { CreatorAvatar } from "./creator-avatar";
import { useEffect, useMemo, useRef, useState } from "react";
import { INSIGHT_TOKEN_KEY } from "./insight-account-store";
import { memberDbReadFallback, memberReadAuthFailure } from "./insight-member-db-fallback";
import { readInsightSnapshot, writeInsightSnapshot } from "./insight-persistent-cache";
import { canRetainInsightView, fetchInsightResource } from "./insight-view-lifecycle";
import { readSavedInsightView, writeSavedInsightView, removeSavedInsightView } from "./insight-saved-view";
import "./member-insight-comments-final.css";

const HISTORY="https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-member-history";
const EXTRAS="https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-member-extras";
const EVENTS="https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-comment-events";
const HEARTS="https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-comment-hearts";
const COMMENT_REFRESH="https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-comment-refresh";
const ICON="https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/creator-icons";
const PAGE=100;
const EVENT_PAGE=500;
const EVENT_GROUP=3;
const SAVED_COMMENTS="comments-default";
type Row=Record<string,any>;type Heart=Record<string,any>;
type CapturedRequest={token:string;signal:AbortSignal};
type CommentRequest=CapturedRequest&{seq:number};
type CommentCache={rows:Row[];total:number;at:number;revision:number;page?:number;invalidated?:boolean};
type SavedComments={rows:Row[];total:number};
const COMMENT_CACHE=new Map<string,CommentCache>();
type CommentView={status:string;day:string;articleKey:string;draft:string;query:string;renderLimit:number};
const COMMENT_VIEWS=new Map<string,CommentView>();
const COMMENT_ARTICLES=new Map<string,{rows:Row[];at:number;revision:number;invalidated?:boolean}>();
type ArticleFailure={articleKey:string;title:string;url:string;stage:"note"|"save";code:string;retryable:boolean};
const COMMENT_COLLECTION=new Map<string,{at:number;revision:number;message:string;failures?:ArticleFailure[];retryAt?:number}>();
const COMMENT_AUX=new Map<string,{detail:Record<string,Row[]>;hearts:Record<string,Heart>}>();
let lastVerifiedScope="";
function savedComments(scope:{account:string;token:string}){
 const saved=readSavedInsightView<SavedComments>(SAVED_COMMENTS,scope),value=saved?.value;
 return value&&Array.isArray(value.rows)&&value.rows.length<=EVENT_PAGE&&Number.isSafeInteger(value.total)&&value.total>=value.rows.length&&value.rows.every(row=>row&&String(row.comment_key||""))?saved:null;
}
const defaultView=():CommentView=>({status:"all",day:"",articleKey:"",draft:"",query:"",renderLimit:120});
function viewCacheKey(scope:string,view:Pick<CommentView,"status"|"day"|"articleKey"|"query">){return`${scope}|${view.status}|${view.day}|${view.articleKey}|${view.status==="all"?"":view.query}`}
function remember<T>(map:Map<string,T>,key:string,value:T){map.set(key,value);if(map.size>40)map.delete(map.keys().next().value!)}
function bounded<T>(work:Promise<T>,signal:AbortSignal,timeoutMs=15000):Promise<T>{
 return new Promise((resolve,reject)=>{
  let timer=0;
  const cleanup=()=>{window.clearTimeout(timer);signal.removeEventListener("abort",abort)};
  const abort=()=>{cleanup();reject(new Error("INSIGHT_REQUEST_CANCELLED"))};
  if(signal.aborted){void work.catch(()=>{});abort();return}
  signal.addEventListener("abort",abort,{once:true});
  timer=window.setTimeout(()=>{cleanup();reject(new Error("INSIGHT_NETWORK_TIMEOUT"))},timeoutMs);
  work.then(value=>{cleanup();resolve(value)},error=>{cleanup();reject(error)});
 });
}
function readPayload(endpoint:string,body:Record<string,unknown>,payload:any){
 if(!payload||!Array.isArray(payload.rows))throw new Error("COMMENT_RESPONSE_INVALID");
 if((endpoint===EVENTS||body.action==="comments_filtered")&&(!Number.isSafeInteger(payload.total)||payload.total<0||payload.total<payload.rows.length))throw new Error("COMMENT_RESPONSE_INVALID");
 const key=endpoint===EVENTS||body.action==="comment_thread"?"comment_key":body.action==="comments_filtered"?"root_key":null;
 if(key&&payload.rows.some((row:any)=>!row||!String(row[key]||"")))throw new Error("COMMENT_RESPONSE_INVALID");
 return payload;
}
async function post(endpoint:string,body:Record<string,unknown>,request:CapturedRequest){
 const {token,signal}=request;
 if(!token)throw new Error("INSIGHT_LOGIN_REQUIRED");
 if(signal.aborted||token!==(localStorage.getItem(INSIGHT_TOKEN_KEY)||""))throw new Error("INSIGHT_REQUEST_CANCELLED");
 try{
  const r=await fetchInsightResource(endpoint,{method:"POST",headers:{"Content-Type":"application/json","X-Insight-Token":token},body:JSON.stringify(body),cache:"no-store",signal},15000);
  if(r.status===401||r.status===403)throw new Error(`HTTP_${r.status}`);
  const p=await bounded(r.json(),signal);
  if(r.status===402)throw new Error("BACKEND_RESTRICTED_402");
  if(!r.ok||p?.ok===false)throw new Error(p?.error||"INSIGHT_API_ERROR");
  return readPayload(endpoint,body,p);
 }catch(e){
  if(signal.aborted||token!==(localStorage.getItem(INSIGHT_TOKEN_KEY)||""))throw e;
  const msg=e instanceof Error?e.message:String(e);
  if(!memberReadAuthFailure(msg))try{return readPayload(endpoint,body,await bounded(memberDbReadFallback(endpoint,body,token),signal))}catch{}
  throw e;
 }
}
const n=(v:any)=>new Intl.NumberFormat("ja-JP").format(Number(v||0));
function articleFailures(result:Row,account:string):ArticleFailure[]{
 const found=new Map<string,ArticleFailure>();
 for(const item of Array.isArray(result.articleFailures)?result.articleFailures:[]){
  const key=String(item?.articleKey||"");if(!/^n[0-9a-f]{1,63}$/i.test(key)||found.has(key))continue;
  let url="";try{const u=new URL(String(item.url||""));if(u.origin==="https://note.com"&&!u.username&&!u.password)url=u.href}catch{}
  found.set(key,{articleKey:key,title:String(item.title||"確認できなかった記事").slice(0,180),url,stage:item.stage==="save"?"save":"note",code:String(item.code||"COMMENT_REFRESH_FAILED"),retryable:item.retryable===true});
 }
 for(const raw of Array.isArray(result.pendingArticleKeys)?result.pendingArticleKeys:[]){
  const key=String(raw||"");if(!/^n[0-9a-f]{1,63}$/i.test(key)||found.has(key))continue;
  found.set(key,{articleKey:key,title:"今回の取得時間内に確認できなかった記事",url:/^[a-z0-9_-]+$/i.test(account)?`https://note.com/${account}/n/${key}`:"",stage:"note",code:"COMMENT_REFRESH_DEADLINE",retryable:true});
 }
 return [...found.values()];
}
function articleFailureReason(f:ArticleFailure){
 if(f.stage==="save")return"取得後の保存を確認できませんでした";
 if(f.code==="NOTE_COMMENTS_DISABLED")return"記事のコメント欄が無効になっているため、noteから取得できません";
 if(f.code==="NOTE_PUBLIC_403")return"note側で公開取得が許可されていません";
 if(/NOTE_PUBLIC_(404|410)/.test(f.code)||f.code==="ARTICLE_NOT_FOUND"||f.code==="COMMENT_ARTICLE_NOT_FOUND")return"記事を確認できません。非公開・削除などの可能性があります";
 if(f.code==="NOTE_PUBLIC_429")return"note側の回数制限です。時間をおいて再取得してください";
 if(f.code==="COMMENT_REFRESH_DEADLINE")return"今回は時間内に確認できませんでした";
 if(/RESPONSE|PAGINATION|PAGE_LIMIT/.test(f.code))return"コメントの応答を最後まで確認できませんでした";
 return"noteとの通信を確認できませんでした";
}
const unavailableArticle=(f:ArticleFailure)=>f.code==="NOTE_COMMENTS_DISABLED"||/^NOTE_PUBLIC_(403|404|410)$/.test(f.code)||f.code==="COMMENT_ARTICLE_NOT_FOUND";
const date=(v:any,withTime=true)=>{if(!v)return"—";const d=new Date(String(v));if(Number.isNaN(d.getTime()))return"—";return new Intl.DateTimeFormat("ja-JP",{timeZone:"Asia/Tokyo",...(withTime?{year:"numeric",month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"}:{year:"numeric",month:"numeric",day:"numeric"})}).format(d)};
const isoDay=(v:string)=>v?`${v}T00:00:00+09:00`:null;function nextDay(v:string){return v?new Date(new Date(`${v}T00:00:00+09:00`).getTime()+86400000).toISOString():null}function noteId(url:any){try{return new URL(String(url||"")).pathname.split("/").filter(Boolean)[0]||""}catch{return""}}
async function enrich(rows:Row[],signal:AbortSignal):Promise<Row[]>{
 const ids=[...new Set(rows.filter(r=>!r.actor_image_url).map(r=>noteId(r.actor_url)).filter(Boolean).map(x=>String(x).toLowerCase()))];
 if(!ids.length||signal.aborted)return rows;
 const icons=new Map<string,string>();
 try{
  for(let i=0;i<ids.length;i+=100){
   const response=await fetchInsightResource(ICON,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({noteIds:ids.slice(i,i+100)}),cache:"no-store",signal},5000);
   const payload=await bounded(response.json(),signal,5000);
   if(signal.aborted)return rows;
   for(const icon of payload.items||[])if(icon?.noteId&&icon?.image)icons.set(String(icon.noteId).toLowerCase(),String(icon.image));
  }
 }catch{}
 return rows.map(row=>({...row,actor_image_url:row.actor_image_url||icons.get(noteId(row.actor_url).toLowerCase())||null}));
}
function stateOf(r:Row,filter:string){if(filter==="heart_closed"||(r.heart_on_last_external&&(r.status==="unreplied"||r.status==="followup_pending")))return{key:"heart_closed",label:"あなたの♡で終了"};if(r.status==="unreplied")return{key:"unreplied",label:"未返信"};if(r.status==="followup_pending")return{key:"followup_pending",label:"相手の返信で停止"};if(r.status==="replied")return{key:"replied",label:"自分の返信で終了"};return{key:String(r.status||""),label:String(r.status||"")}}
function Avatar({row}:{row:Row}){return <CreatorAvatar person={row} name={String(row.actor_name||"noteユーザー")} className="micf-avatar"/>}
function HeartState({row,heart}:{row:Row,heart?:Heart}){const s=stateOf(row,"all");if(s.key!=="replied")return null;const name=String(heart?.counterpartName||row.actor_name||"相手");if(heart?.exact&&heart.counterpartHearted===true)return <div className="micf-heart yes">♥ 最終返信に{name}さんの♡あり {heart.heartAt?<small>{date(heart.heartAt)}</small>:null}</div>;if(heart?.exact&&heart.counterpartHearted===false)return <div className="micf-heart no">♡ 最終返信に{name}さんの♡なし</div>;return <div className="micf-heart checking">↻ 最終返信の♡送信者を照合中</div>}
function Person({row}:{row:Row}){return <span className="micf-person"><Avatar row={row}/><span><b>{row.actor_name||"noteユーザー"}</b>{row.actor_url?<a href={row.actor_url} target="_blank" rel="noreferrer">プロフィール ↗</a>:null}</span></span>}
function EventPerson({row}:{row:Row}){if(row.is_creator)return <span className="micf-person mine"><Avatar row={row}/><span><b>あなた</b>{row.actor_url?<a href={row.actor_url} target="_blank" rel="noreferrer">プロフィール ↗</a>:null}</span></span>;return <Person row={row}/>}
function uniqueRows(rows:Row[],key="root_key"){const seen=new Set<string>(),out:Row[]=[];for(const r of rows){const k=String(r[key]||"");if(!k||seen.has(k))continue;seen.add(k);out.push(r)}return out}
type CommentSnapshot={version:1;rows:Row[];total:number;latestAt:string|null;savedAt:number};
function snapshotKey(note:string){const id=String(note||"").trim().toLowerCase();return id?`comments-all:${id}`:""}
function latestAt(rows:Row[]){return rows.map(r=>String(r.occurred_at||"")).filter(Boolean).sort().reverse()[0]||null}
function mergeEvents(base:Row[],incoming:Row[]){
  const map=new Map<string,Row>();
  for(const row of [...base,...incoming]){const key=String(row.comment_key||"");if(!key)continue;const previous=map.get(key);map.set(key,{...previous,...row,actor_image_url:row.actor_image_url||previous?.actor_image_url||null})}
  return [...map.values()].sort((a,b)=>Date.parse(String(b.occurred_at||0))-Date.parse(String(a.occurred_at||0)))
}
export function MemberInsightCommentsFinal({revision=0,noteId:memberNoteId=""}:{revision?:number;noteId?:string}){
 const token=localStorage.getItem(INSIGHT_TOKEN_KEY)||"",viewScope=`${memberNoteId.trim().toLowerCase()}|${token}`,savedView=COMMENT_VIEWS.get(viewScope)||defaultView(),initialKey=viewCacheKey(viewScope,savedView),initialCached=COMMENT_CACHE.get(initialKey),initialRetained=initialCached&&canRetainInsightView(initialCached.at)?initialCached:null,initialAux=initialRetained?COMMENT_AUX.get(initialKey):null,storageScope={account:memberNoteId,token},initialSaved=!initialRetained&&savedView.status==="all"&&!savedView.day&&!savedView.articleKey?savedComments(storageScope):null,initialSavedRows=Array.isArray(initialSaved?.value.rows)?initialSaved.value.rows.slice(0,EVENT_PAGE):[];
 const[rows,setRows]=useState<Row[]>(initialRetained?.rows||initialSavedRows),[articles,setArticles]=useState<Row[]>([]),[articleKey,setArticleKey]=useState(savedView.articleKey),[day,setDay]=useState(savedView.day),[draft,setDraft]=useState(savedView.draft),[query,setQuery]=useState(savedView.query),[total,setTotal]=useState(initialRetained?.total||Number(initialSaved?.value.total)||0),[status,setStatus]=useState(savedView.status),[detail,setDetail]=useState<Record<string,Row[]>>(initialAux?.detail||{}),[hearts,setHearts]=useState<Record<string,Heart>>(initialAux?.hearts||{}),[loading,setLoading]=useState(!initialRetained),[error,setError]=useState(""),[syncPhase,setSyncPhase]=useState<"initial"|"delta"|"result"|"idle">(initialRetained?"idle":"initial"),[syncMessage,setSyncMessage]=useState("保存履歴を構築中"),[renderLimit,setRenderLimit]=useState(savedView.renderLimit),[collecting,setCollecting]=useState(false),[collectionMessage,setCollectionMessage]=useState("");
 const [savedDisplay,setSavedDisplay]=useState(initialSaved?.savedAt||0),[loadedPage,setLoadedPage]=useState(initialRetained?.page||1),[moreLoading,setMoreLoading]=useState(false);
 const [articleRefresh,setArticleRefresh]=useState(0);
 const [collectionFailures,setCollectionFailures]=useState<ArticleFailure[]>([]),[collectionRetryAt,setCollectionRetryAt]=useState(0),[collectionNow,setCollectionNow]=useState(Date.now());
 const loadSeq=useRef(0),pageBusy=useRef(false),syncTimer=useRef(0),moreRef=useRef<HTMLDivElement|null>(null),activeRequest=useRef<AbortController|null>(null),articleSeq=useRef(0),collectionSeq=useRef(0),collectionController=useRef<AbortController|null>(null),reloadSaved=useRef<(()=>void)|null>(null);
 const articleController=useRef<AbortController|null>(null),detailLoads=useRef(new Set<string>());
 const range=useMemo(()=>day?{dateFrom:isoDay(day),dateTo:nextDay(day)}:{dateFrom:null,dateTo:null},[day]);
 const stateScope=useRef(viewScope),controlsReady=stateScope.current===viewScope;
 const cacheKey=viewCacheKey(viewScope,{status,day,articleKey,query}),persistKey=snapshotKey(memberNoteId);
 useEffect(()=>{
  if(stateScope.current===viewScope)return;
  stateScope.current=viewScope;const next=COMMENT_VIEWS.get(viewScope)||defaultView();
  setStatus(next.status);setDay(next.day);setArticleKey(next.articleKey);setDraft(next.draft);setQuery(next.query);setRenderLimit(next.renderLimit);setRows([]);setTotal(0);setDetail({});setHearts({});setSavedDisplay(0);setLoadedPage(1);
 },[viewScope]);
 useEffect(()=>{if(controlsReady)remember(COMMENT_VIEWS,viewScope,{status,day,articleKey,draft,query,renderLimit})},[viewScope,controlsReady,status,day,articleKey,draft,query,renderLimit]);
 const passiveDisplay=useRef({key:"",blocked:false,shown:false});
 const globalAll=status==="all"&&!day&&!articleKey;
 function current(request:CommentRequest){return request.seq===loadSeq.current&&!request.signal.aborted&&request.token===(localStorage.getItem(INSIGHT_TOKEN_KEY)||"")}
 function beginLoad():CommentRequest{detailLoads.current.clear();pageBusy.current=false;setMoreLoading(false);activeRequest.current?.abort();window.clearTimeout(syncTimer.current);const controller=new AbortController();activeRequest.current=controller;return{seq:++loadSeq.current,token,signal:controller.signal}}
 function finishSync(request:CommentRequest,message:string,delay=1200){if(!current(request))return;window.clearTimeout(syncTimer.current);setSyncMessage(message);setSyncPhase("result");syncTimer.current=window.setTimeout(()=>{if(current(request))setSyncPhase("idle")},delay)}
 function publish(request:CommentRequest,list:Row[],count:number){if(!current(request))return;setRows(previous=>{if(!current(request))return previous;const images=new Map(previous.map(row=>[String(row.comment_key||row.root_key),row.actor_image_url]));return list.map(row=>({...row,actor_image_url:row.actor_image_url||images.get(String(row.comment_key||row.root_key))||null}))});setTotal(count)}
 function cache(request:CommentRequest,list:Row[],count:number,page=1,unverifiedBase?:CommentCache){
  if(!current(request))return;
  if(unverifiedBase){remember(COMMENT_CACHE,cacheKey,{...unverifiedBase,rows:list,total:count,page,invalidated:true});return}
  lastVerifiedScope=viewScope;remember(COMMENT_CACHE,cacheKey,{rows:list,total:count,at:Date.now(),revision,page});
  if(globalAll)writeSavedInsightView<SavedComments>(SAVED_COMMENTS,storageScope,{rows:list.slice(0,EVENT_PAGE),total:count});
 }
 async function saveSnapshot(request:CommentRequest,list:Row[],count:number){if(!persistKey||!current(request))return;await writeInsightSnapshot<CommentSnapshot>(persistKey,{version:1,rows:list.slice(0,EVENT_PAGE),total:count,latestAt:latestAt(list),savedAt:Date.now()})}
 function enrichLater(list:Row[],request:CommentRequest){
  void enrich(list,request.signal).then(enriched=>{
   if(!current(request))return;
   const icons=new Map(enriched.filter(row=>row.actor_image_url).map(row=>[noteId(row.actor_url).toLowerCase(),row.actor_image_url]));
   if(!icons.size)return;
   const apply=(items:Row[])=>items.map(row=>({...row,actor_image_url:row.actor_image_url||icons.get(noteId(row.actor_url).toLowerCase())||null}));
   setRows(items=>current(request)?apply(items):items);
   const saved=COMMENT_CACHE.get(cacheKey);if(saved)COMMENT_CACHE.set(cacheKey,{...saved,rows:apply(saved.rows)});
  });
 }
 async function loadHearts(list:Row[],request:CommentRequest){
  const keys=list.filter(r=>stateOf(r,status).key==="replied").map(r=>String(r.root_key||"")).filter(Boolean);
  for(let i=0;i<keys.length&&current(request);i+=80){try{
   const h=await post(HEARTS,{action:"batch",rootKeys:keys.slice(i,i+80)},request);
   if(!current(request))return;
   const map:Record<string,Heart>={};for(const item of h.rows||[])map[String(item.rootKey)]=item;
   setHearts(v=>{if(!current(request))return v;const next={...v,...map};remember(COMMENT_AUX,cacheKey,{detail:COMMENT_AUX.get(cacheKey)?.detail||{},hearts:next});return next});
  }catch{if(!current(request))return}}
 }
 function discardVerifiedScope(){
  loadSeq.current++;activeRequest.current?.abort();detailLoads.current.clear();pageBusy.current=false;
  articleSeq.current++;articleController.current?.abort();articleController.current=null;
  collectionSeq.current++;collectionController.current?.abort();collectionController.current=null;
  window.clearTimeout(syncTimer.current);setLoading(false);setMoreLoading(false);setSyncPhase("idle");
  setArticles([]);setDetail({});setHearts({});setCollecting(false);setCollectionMessage("");setCollectionFailures([]);setCollectionRetryAt(0);
  for(const key of COMMENT_CACHE.keys())if(key.startsWith(viewScope+"|"))COMMENT_CACHE.delete(key);
  for(const key of COMMENT_AUX.keys())if(key.startsWith(viewScope+"|"))COMMENT_AUX.delete(key);
  for(const key of COMMENT_ARTICLES.keys())if(key.startsWith(viewScope+"|"))COMMENT_ARTICLES.delete(key);
  COMMENT_COLLECTION.delete(viewScope);lastVerifiedScope="";
 }
 function currentFallback():CommentCache|CommentSnapshot|undefined{
  const retained=COMMENT_CACHE.get(cacheKey);
  if(retained&&canRetainInsightView(retained.at))return retained;
  return savedDisplay?{version:1,rows,total,latestAt:latestAt(rows),savedAt:savedDisplay}:undefined;
 }
 async function loadAll(background=false,fallback?:CommentCache|CommentSnapshot,exhaustive=status==="all"&&Boolean(query.trim())){
  const request=beginLoad();let received=false;
  const retained=background&&fallback&&"at" in fallback&&canRetainInsightView(fallback.at)?fallback:null;
  if(retained)remember(COMMENT_CACHE,cacheKey,{...retained,invalidated:true});
  pageBusy.current=false;setMoreLoading(false);
  setLoading(true);setError("");setSyncPhase(background?"delta":"initial");setSyncMessage(exhaustive?"全履歴を検索中… 検索結果は確認途中です":"保存先のコメント履歴を確認中");
  try{
   const events=status==="all",pageSize=events?EVENT_PAGE:PAGE;
   const params=events?{pageSize,articleKey:articleKey||null,...range}:{action:"comments_filtered",pageSize,status,query,articleKey:articleKey||null,...range};
   const first=await post(events?EVENTS:EXTRAS,{...params,page:1},request);
   if(!current(request))return;
   const expected=Math.max(0,Number(first.total||0));
   const images=new Map((fallback?.rows||[]).map(row=>[String(row.comment_key||row.root_key),row.actor_image_url]));
   const firstRows=first.rows.map((row:Row)=>({...row,actor_image_url:row.actor_image_url||images.get(String(row.comment_key||row.root_key))||null}));
   let collected=events?mergeEvents([],firstRows):uniqueRows(firstRows),page=1;
   const pages=exhaustive?Math.ceil(expected/pageSize):retained?Math.min(Math.ceil(retained.rows.length/pageSize),Math.ceil(expected/pageSize)):1;
   const displayed=(list:Row[])=>retained&&page<pages?(events?mergeEvents(retained.rows,list):uniqueRows([...list,...retained.rows])):list;
   if(collected.length!==Math.min(expected,pageSize))throw new Error("COMMENT_HISTORY_INCOMPLETE");
   received=true;passiveDisplay.current.blocked=true;setSavedDisplay(0);setLoadedPage(1);publish(request,displayed(collected),expected);enrichLater(collected,request);if(!events)void loadHearts(collected,request);
   if(pages>1){
    for(let start=2;start<=pages;start+=EVENT_GROUP){
     const nums=Array.from({length:Math.min(EVENT_GROUP,pages-start+1)},(_,i)=>start+i),packets=await Promise.all(nums.map(next=>post(events?EVENTS:EXTRAS,{...params,page:next},request)));
     if(!current(request))return;
     for(const packet of packets)collected=events?mergeEvents(collected,packet.rows):uniqueRows([...collected,...packet.rows]);
     page=nums.at(-1)!;publish(request,displayed(collected),expected);setLoadedPage(page);
    }
    if(collected.length!==Math.min(expected,page*pageSize))throw new Error("COMMENT_HISTORY_INCOMPLETE");
   }
   cache(request,collected,expected,page);
   if(globalAll&&collected.length===expected)void saveSnapshot(request,collected,expected);
   finishSync(request,exhaustive?"全履歴の検索完了":collected.length===expected?"保存先の全履歴を確認しました":"表示分を確認しました。続きは下へ進むと読み込みます");
  }catch(e){
   if(!current(request))return;
   const message=e instanceof Error?e.message:"コメント履歴の読込に失敗しました";
   const lateSaved=!fallback&&globalAll?savedComments(storageScope):null;
   const displayFallback=fallback||(lateSaved?{...lateSaved.value,savedAt:lateSaved.savedAt}:null);
   if(memberReadAuthFailure(message)){passiveDisplay.current.blocked=true;setRows([]);setTotal(0);setSavedDisplay(0);removeSavedInsightView(SAVED_COMMENTS,storageScope);discardVerifiedScope();finishSync(request,"コメント履歴を確認できませんでした")}
   else if(retained){
    // A failed recheck must not replace this document's verified loaded pages
    // with its smaller offline copy, or leave the cursor at a partial recheck.
    publish(request,retained.rows,retained.total);setLoadedPage(retained.page||1);setSavedDisplay(0);
    finishSync(request,"最新確認に失敗しました。読み込み済み履歴を保持しています");
   }
   else if(!received&&displayFallback){publish(request,displayFallback.rows.slice(0,EVENT_PAGE),displayFallback.total);setLoadedPage(1);setSavedDisplay("at" in displayFallback?displayFallback.at:displayFallback.savedAt);finishSync(request,"通信を確認できないため保存済み履歴を表示中")}
   else if(!received&&globalAll&&persistKey){
    const previous=await bounded(readInsightSnapshot<CommentSnapshot>(persistKey),request.signal,1000).catch(()=>null);
    if(!current(request))return;
    if(previous?.version===1&&Array.isArray(previous.rows)&&previous.rows.every(row=>row&&String(row.comment_key||""))){publish(request,previous.rows.slice(0,EVENT_PAGE),Math.max(previous.rows.length,Number(previous.total)||0));setSavedDisplay(previous.savedAt||1);finishSync(request,"通信を確認できないため保存済み履歴を表示中")}
    else finishSync(request,"コメント履歴を確認できませんでした");
   }else finishSync(request,"コメント履歴を確認できませんでした");
   setError(message);
  }finally{if(current(request))setLoading(false)}
 }
 async function loadNextPage(){
  if(pageBusy.current||loading||savedDisplay||rows.length>=total)return;
  const controller=activeRequest.current;if(!controller)return;
  const request={seq:loadSeq.current,token,signal:controller.signal},page=loadedPage+1,events=status==="all",pageSize=events?EVENT_PAGE:PAGE;
  const previous=COMMENT_CACHE.get(cacheKey),unverifiedBase=previous&&(previous.invalidated||previous.revision!==revision)?previous:undefined;
  pageBusy.current=true;setMoreLoading(true);if(!unverifiedBase)setError("");
  try{
   const params=events?{pageSize,articleKey:articleKey||null,...range}:{action:"comments_filtered",pageSize,status,query,articleKey:articleKey||null,...range};
   const packet=await post(events?EVENTS:EXTRAS,{...params,page},request);
   if(!current(request))return;
   const count=Number(packet.total);
   if(count!==total){void loadAll(true,currentFallback());return}
   const list=events?mergeEvents(rows,packet.rows):uniqueRows([...rows,...packet.rows]);
   if(list.length!==Math.min(page*pageSize,count))throw new Error("COMMENT_HISTORY_INCOMPLETE");
   publish(request,list,count);setLoadedPage(page);cache(request,list,count,page,unverifiedBase);enrichLater(packet.rows,request);if(!events)void loadHearts(packet.rows,request);
   if(globalAll&&!unverifiedBase&&list.length===count)void saveSnapshot(request,list,count);
  }catch(e){if(current(request)){const message=e instanceof Error?e.message:"続きの読込に失敗しました";setError(message);if(memberReadAuthFailure(message)){passiveDisplay.current.blocked=true;setRows([]);setTotal(0);setSavedDisplay(0);removeSavedInsightView(SAVED_COMMENTS,storageScope);discardVerifiedScope()}}}
  finally{if(current(request)){pageBusy.current=false;setMoreLoading(false)}}
 }
 async function open(k:string){
  if(detail[k])return;
  const controller=activeRequest.current;if(!controller)return;
  const request={seq:loadSeq.current,token,signal:controller.signal},requestKey=`${request.seq}|${k}`;
  if(detailLoads.current.has(requestKey))return;detailLoads.current.add(requestKey);
  try{const x=await post(HISTORY,{action:"comment_thread",rootKey:k},request);if(current(request))setDetail(v=>{if(!current(request))return v;const next={...v,[k]:x.rows||[]};remember(COMMENT_AUX,cacheKey,{detail:next,hearts:COMMENT_AUX.get(cacheKey)?.hearts||{}});return next})}catch(e){detailLoads.current.delete(requestKey);if(current(request))setError(e instanceof Error?e.message:"会話の読込に失敗しました")}
 }
 reloadSaved.current=()=>{
  for(const[key,value]of COMMENT_CACHE)if(key.startsWith(viewScope+"|"))COMMENT_CACHE.set(key,{...value,invalidated:true});
  for(const key of COMMENT_AUX.keys())if(key.startsWith(viewScope+"|"))COMMENT_AUX.delete(key);
  setDetail({});setHearts({});
  for(const[key,value]of COMMENT_ARTICLES)if(key.startsWith(viewScope+"|"))COMMENT_ARTICLES.set(key,{...value,invalidated:true});
  setArticleRefresh(value=>value+1);void loadAll(true,currentFallback());
 };
 async function collectComments(selectedArticle:string|null=null,force=false,retryKeys?:string[]){
  if(collectionController.current||!token||!persistKey)return;
  const controller=new AbortController(),seq=++collectionSeq.current,capturedToken=token;
  collectionController.current=controller;
  const active=()=>seq===collectionSeq.current&&!controller.signal.aborted&&capturedToken===(localStorage.getItem(INSIGHT_TOKEN_KEY)||"");
  const announce=(message:string,failures:ArticleFailure[]=[],retryAt=0)=>{setCollectionMessage(message);setCollectionFailures(failures);setCollectionRetryAt(retryAt);remember(COMMENT_COLLECTION,viewScope,{at:Date.now(),revision,message,failures,retryAt})};
  setCollecting(true);setCollectionMessage("noteのコメントを取得中… 保存済み履歴はそのまま表示しています。");
  try{
   const response=await fetchInsightResource(COMMENT_REFRESH,{method:"POST",headers:{"Content-Type":"application/json","X-Insight-Token":capturedToken},body:JSON.stringify(retryKeys?{action:"refresh",articleKeys:retryKeys.slice(0,6)}:{action:"refresh",articleKey:selectedArticle}),cache:"no-store",signal:controller.signal},40000);
   const result=await bounded(response.json(),controller.signal,40000);
   if(!active())return;
   if(!response.ok)throw new Error(result?.error||`HTTP_${response.status}`);
   const partial=Number.isSafeInteger(result?.failedArticles)&&result.failedArticles>0;
   if(result?.ok!==true&&!partial)throw new Error(result?.error||"COMMENT_REFRESH_FAILED");
   if(result.paused){announce("noteのコメント取得は一時停止中です。保存済み履歴を表示しています。",collectionFailures,collectionRetryAt);return}
   const untouched=retryKeys?collectionFailures.filter(f=>!retryKeys.includes(f.articleKey)):[],failures=[...untouched,...articleFailures(result,memberNoteId)],retryAt=Date.now()+Math.max(0,Math.min(60,Number.isFinite(result.retryAfterSeconds)?result.retryAfterSeconds:60))*1000;
   if(result.skipped){announce("直前の取得があるため、保存先の履歴を表示しています。",collectionFailures,retryAt)}
   else if(partial||untouched.length){
    const count=Number(result.failedArticles||0)+untouched.length,unavailable=failures.length===count&&failures.every(unavailableArticle);
    announce(unavailable&&failures.every(f=>f.code==="NOTE_COMMENTS_DISABLED")?`${n(count)}記事はコメント欄が無効のため、noteから再取得できません。保存済みの本文は保持しています。`:unavailable?`${n(count)}記事はnote側でコメントを確認できないため、保存済み履歴を表示しています。対象記事から理由を確認できます。`:`${n(count)}記事のコメントを取得できませんでした。保存済み履歴は保持しています。対象記事と理由を確認し、失敗分だけ再取得できます。`,failures,retryAt);
   }
   else if(result.truncated){announce("今回取得できたコメントを反映しています。残りはもう一度取得できます。",failures,retryAt)}
   else if(Number.isSafeInteger(result.articles)&&result.articles>=0){announce(`noteから${n(result.articles)}記事のコメントを取得しました。保存先の履歴を表示しています。`)}
   else throw new Error("COMMENT_REFRESH_RESPONSE_INVALID");
   // A skipped/unchanged automatic collection adds nothing to the initial DB
   // check. Explicit collection still verifies the current selected history.
   if(force||(!result.skipped&&result.changedComments!==0))reloadSaved.current?.();
  }catch(e){
   if(active())setCollectionMessage(`noteのコメント取得を確認できませんでした。保存済み履歴を表示しています。${e instanceof Error?e.message:"取得失敗"}`);
  }finally{
   if(seq===collectionSeq.current){collectionController.current=null;setCollecting(false)}
  }
 }
 useEffect(()=>{
  if(!controlsReady)return;
  const cleanup=()=>{collectionSeq.current++;collectionController.current?.abort();collectionController.current=null};
  setCollectionMessage("");setCollectionFailures([]);setCollectionRetryAt(0);setCollecting(false);
  const saved=COMMENT_COLLECTION.get(viewScope);
  if(saved&&lastVerifiedScope===viewScope&&saved.revision===revision&&canRetainInsightView(saved.at)){setCollectionMessage(saved.message);setCollectionFailures(saved.failures||[]);setCollectionRetryAt(saved.retryAt||0);return cleanup}
  if(persistKey&&token)void collectComments();
  return cleanup;
 },[persistKey,token,viewScope,revision,controlsReady]);
 useEffect(()=>{if(!collectionRetryAt)return;let timer=0;const tick=()=>{setCollectionNow(Date.now());if(Date.now()<collectionRetryAt)timer=window.setTimeout(tick,1000)};tick();return()=>window.clearTimeout(timer)},[collectionRetryAt]);
 useEffect(()=>{
  if(!controlsReady)return;
  const controller=new AbortController(),seq=++articleSeq.current,capturedToken=token;articleController.current=controller;
  const key=`${viewScope}|${day}`,saved=COMMENT_ARTICLES.get(key);
  setArticles(saved&&canRetainInsightView(saved.at)?saved.rows:[]);
  if(day&&!(saved&&lastVerifiedScope===viewScope&&saved.revision===revision&&!saved.invalidated&&canRetainInsightView(saved.at)))void post(EXTRAS,{action:"comment_articles",...range},{token:capturedToken,signal:controller.signal}).then(x=>{if(!controller.signal.aborted&&seq===articleSeq.current&&capturedToken===(localStorage.getItem(INSIGHT_TOKEN_KEY)||"")){setArticles(x.rows||[]);remember(COMMENT_ARTICLES,key,{rows:x.rows||[],at:Date.now(),revision})}}).catch(()=>{});
  return()=>{controller.abort();if(articleController.current===controller)articleController.current=null;articleSeq.current++};
 },[day,token,viewScope,revision,controlsReady,articleRefresh]);
 useEffect(()=>{
  if(!controlsReady)return;
  passiveDisplay.current={key:JSON.stringify([viewScope,cacheKey,query,revision]),blocked:false,shown:false};
  const cleanup=()=>{loadSeq.current++;activeRequest.current?.abort();window.clearTimeout(syncTimer.current)};
  const cached=COMMENT_CACHE.get(cacheKey),retained=cached&&canRetainInsightView(cached.at),aux=retained?COMMENT_AUX.get(cacheKey):null;
  const stored=!retained&&globalAll?savedComments(storageScope):null;
  const savedRows=Array.isArray(stored?.value.rows)?stored.value.rows.slice(0,EVENT_PAGE):[];
  passiveDisplay.current.shown=Boolean(retained||stored);
  setError("");setRows(retained?cached.rows:savedRows);setTotal(retained?cached.total:Number(stored?.value.total)||0);setLoadedPage(retained?cached.page||1:1);setSavedDisplay(stored?.savedAt||0);
  setDetail(aux?.detail||{});setHearts(aux?.hearts||{});
  const exhaustive=status==="all"&&Boolean(query.trim());
  if(cached&&lastVerifiedScope===viewScope&&cached.revision===revision&&!cached.invalidated&&canRetainInsightView(cached.at)&&(!exhaustive||cached.rows.length>=cached.total)){
   beginLoad();setLoading(false);setSyncPhase("idle");return cleanup;
  }
  COMMENT_AUX.delete(cacheKey);setDetail({});setHearts({});
  const fallback=retained?cached:stored?{rows:savedRows,total:Number(stored.value.total)||savedRows.length,savedAt:stored.savedAt,version:1 as const,latestAt:latestAt(savedRows)}:undefined;
  // A bounded, token-scoped saved view is visible immediately. It stays labelled
  // as saved until the server confirms the current page; counts never prove body freshness.
  if(fallback)void loadAll(true,fallback,exhaustive);
  else void loadAll(false,undefined,exhaustive);
  return cleanup;
 },[status,day,articleKey,query,revision,persistKey,token,controlsReady]);
 // Overflow copies may become available after the bounded startup attempt.
 // Restore display only: never restart a request or let a late copy beat live data.
 useEffect(()=>{
  if(!controlsReady||!globalAll)return;
  const key=JSON.stringify([viewScope,cacheKey,query,revision]);
  const restore=()=>{
   const state=passiveDisplay.current;
   if(state.key!==key||state.blocked||state.shown||stateScope.current!==viewScope||localStorage.getItem(INSIGHT_TOKEN_KEY)!==token)return;
   const saved=savedComments(storageScope);if(!saved)return;
   state.shown=true;setRows(saved.value.rows);setTotal(saved.value.total);setLoadedPage(1);setSavedDisplay(saved.savedAt);setSyncPhase("delta");
  };
  window.addEventListener("mumei-insight-storage-hydrated",restore);restore();
  return()=>window.removeEventListener("mumei-insight-storage-hydrated",restore);
 },[controlsReady,globalAll,viewScope,cacheKey,query,revision,token]);
 useEffect(()=>()=>{activeRequest.current?.abort();window.clearTimeout(syncTimer.current)},[]);
 const renderedCriteria=useRef(JSON.stringify([viewScope,status,day,articleKey,query]));
 useEffect(()=>{const key=JSON.stringify([viewScope,status,day,articleKey,query]);if(controlsReady&&renderedCriteria.current!==key){renderedCriteria.current=key;setRenderLimit(120)}},[viewScope,controlsReady,status,day,articleKey,query]);
 function revealMore(){
  const displayed=status==="all"&&query.trim()?eventRows.length:rows.length;
  if(renderLimit<displayed)setRenderLimit(v=>Math.min(v+120,displayed));
  else void loadNextPage();
 }
 useEffect(()=>{
  const el=moreRef.current;if(!el)return;
  const io=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting))revealMore()},{rootMargin:"360px 0px"});
  io.observe(el);return()=>io.disconnect()
 },[rows.length,status,query,renderLimit,loading,loadedPage,savedDisplay]);
 const eventRows=useMemo(()=>{if(status!=="all")return rows;const q=query.trim().toLowerCase();if(!q)return rows;return rows.filter(r=>[r.actor_name,r.actor_url,r.article_title,r.body].some(v=>String(v||"").toLowerCase().includes(q)))},[rows,status,query]);
 const visibleEventRows=useMemo(()=>eventRows.slice(0,renderLimit),[eventRows,renderLimit]);
 const visibleThreadRows=useMemo(()=>rows.slice(0,renderLimit),[rows,renderLimit]);
 const complete=!loading&&!error&&!savedDisplay&&rows.length>=total,shownTotal=status==="all"&&query.trim()?eventRows.length:total;
 const visibleCount=status==="all"?visibleEventRows.length:visibleThreadRows.length;
 const previousCount=Boolean(savedDisplay||error),knownCount=Boolean(savedDisplay||total||rows.length||(!loading&&!error));
 const countLabel=previousCount?(knownCount?status==="all"?"前回確認":"前回確認した会話":"保存件数を確認できません"):status!=="all"?"条件に合う会話":query.trim()?"検索対象の保存履歴":day||articleKey?"条件に合う保存履歴":"保存先";
 const retrySeconds=Math.max(0,Math.ceil((collectionRetryAt-collectionNow)/1000)),selectedArticle=articles.find(a=>String(a.article_key)===articleKey);
 if(!controlsReady)return <section className="micf"><h2>コメント・返信履歴</h2><p className="micf-empty">コメント履歴を確認中…</p></section>;
 return <section className="micf" aria-busy={syncPhase==="initial"&&loading}>
  <header className="micf-head"><div><small>COMMENT HISTORY</small><h2>コメント・返信履歴</h2><p>{status==="all"?"保存先のコメント・返信を1件ずつ表示します。続きは必要な分だけ読み込みます。":"対応状況ごとの会話一覧です。「自分の返信で終了」は最後の返信への相手本人の♡も照合します。"}</p></div><strong>{status==="all"&&query.trim()&&!complete?<small>検索中（暫定）</small>:null}{n(shownTotal)}件</strong></header>
  {savedDisplay?<div className="micf-load-state" role="status"><b>{error?"前回保存分を表示・最新未確認":"前回保存分を表示・最新確認中"}</b><span>保存 {date(new Date(savedDisplay).toISOString())}</span></div>:null}
  {syncPhase!=="idle"?<div className={`micf-sync-scene ${syncPhase}`}><div className="micf-sync-track"><i/><i/><i/><i/></div><b>{syncMessage}</b><span>{syncPhase==="initial"?`読み込み済み ${n(rows.length)}件`:"保存済み表示はそのまま"}</span></div>:<div className={`micf-load-state micf-history-counts${previousCount?"":" done"}`} role="status" aria-live="polite"><div className="micf-storage-count"><b>{countLabel}</b><strong>{knownCount?`${n(total)}件`:"—"}</strong></div><div className="micf-display-counts"><span className="micf-loaded-count">読み込み済み <b>{n(rows.length)}件</b></span><span className="micf-visible-count">表示中 <b>{n(visibleCount)}件</b></span></div>{rows.length<total&&!savedDisplay?<small>下へ進むと続きを読み込みます。</small>:null}</div>}
  <div className="micf-tabs">{[["all","すべて（全コメント）"],["pending","要対応"],["unreplied","未返信"],["followup_pending","相手返信"],["heart_closed","あなたの♡で終了"],["replied","自分返信"]].map(x=><button key={x[0]} className={status===x[0]?"active":""} onClick={()=>setStatus(x[0])}>{x[1]}</button>)}</div>
  <div className="micf-tools"><label><span>コメント日</span><input type="date" value={day} onChange={e=>{setDay(e.target.value);setArticleKey("")}}/></label><select aria-label="コメント日の記事" value={articleKey} onChange={e=>setArticleKey(e.target.value)} disabled={!day}><option value="">{day?`この日の記事すべて (${articles.length})`:"日付を選択すると記事一覧"}</option>{articles.map(a=><option key={a.article_key} value={a.article_key}>{a.title}（{n(a.comment_count_day)}件）</option>)}</select><input value={draft} onChange={e=>setDraft(e.target.value)} placeholder="名前・記事・コメント本文" onKeyDown={e=>{if(e.key==="Enter")setQuery(draft)}}/><button onClick={()=>setQuery(draft)}>検索</button>{day?<button onClick={()=>{setDay("");setArticleKey("")}}>日付解除</button>:null}<button type="button" onClick={()=>void collectComments(articleKey||null,true)} disabled={collecting||!persistKey}>{collecting?"noteから取得中…":"noteからコメントを取得"}</button></div>
  {selectedArticle?<p className="micf-selected-article">選択中：{selectedArticle.title}</p>:null}
  {collectionMessage?<div className={`micf-load-state${collectionFailures.length&&collectionFailures.every(unavailableArticle)?" unavailable":""}`} role="status" aria-live="polite"><b>{collectionMessage}</b></div>:null}
  {collectionFailures.length?<div className="micf-recovery"><details><summary>確認できなかった記事（{n(collectionFailures.length)}件）</summary><ul>{collectionFailures.map(f=><li key={f.articleKey}><b>{f.title}</b><p>{articleFailureReason(f)}</p>{f.url?<a href={f.url} target="_blank" rel="noreferrer">noteで記事を確認 ↗</a>:null}</li>)}</ul></details><button type="button" disabled={collecting||retrySeconds>0} onClick={()=>void collectComments(null,true,collectionFailures.slice(0,6).map(f=>f.articleKey))}>{collecting?"noteから取得中…":retrySeconds?`再取得まで ${retrySeconds}秒`:collectionFailures.length>6?"失敗分だけ再取得（先頭6記事）":"失敗分だけ再取得"}</button></div>:null}
  {error?<p className="micf-error">{error}</p>:null}{loading&&!rows.length&&!savedDisplay?<p className="micf-empty">コメント履歴を読み込み中…</p>:status==="all"?eventRows.length?<><div className="micf-event-list">{visibleEventRows.map(r=>{const label=r.is_creator?(r.is_root?"あなたのコメント":"あなたの返信"):(r.is_root?"コメント":"返信");return <article key={r.comment_key} className={r.is_creator?"mine":""}><EventPerson row={r}/><span className="micf-event-kind">{label}</span><p>{r.body||"（本文なし）"}</p>{r.article_url?<a href={r.article_url} target="_blank" rel="noreferrer">{r.article_title||"対象記事"} ↗</a>:<span className="micf-event-article">{r.article_title||"記事"}</span>}<time>{date(r.occurred_at)}</time>{r.is_creator_liked?<small className="micf-event-heart">♥ あなたの♡</small>:null}</article>})}</div>{visibleEventRows.length<eventRows.length||(!query.trim()&&rows.length<total)?<div ref={moreRef} className="micf-more"><b>{n(visibleEventRows.length)} / {n(query.trim()?eventRows.length:total)}件を表示</b><span>下へ進むと続きを表示します</span><button type="button" disabled={loading||moreLoading||Boolean(savedDisplay)} onClick={revealMore}>{moreLoading?"続きを読み込み中…":"続きを表示"}</button></div>:null}</>:<p className="micf-empty">{query.trim()&&!complete?(loading?"全履歴を検索中…":"全履歴の検索を完了できませんでした"):"この条件のコメント履歴はありません。"}</p>:rows.length?<><div className="micf-thread-list">{visibleThreadRows.map(r=>{const st=stateOf(r,status),heart=hearts[String(r.root_key||"")];return <details key={r.root_key} onToggle={e=>{if((e.currentTarget as HTMLDetailsElement).open)void open(String(r.root_key))}}><summary><Person row={r}/><span className={`micf-state ${st.key}`}>{st.label}</span><p>{String(r.root_body||"").slice(0,140)}</p><a href={r.article_url} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()}>{r.article_title}</a><time>{date(r.last_at||r.root_at)}</time><HeartState row={r} heart={heart}/></summary><div className="micf-thread">{detail[String(r.root_key)]?.map(m=><article key={m.comment_key} className={m.is_creator?"mine":""}><div><b>{m.is_creator?"あなた":m.actor_name}</b><small>{date(m.occurred_at)}</small></div><p>{m.body}</p></article>)||<p>会話を読み込み中…</p>}</div></details>})}</div>{visibleThreadRows.length<rows.length||rows.length<total?<div ref={moreRef} className="micf-more"><b>{n(visibleThreadRows.length)} / {n(total)}件を表示</b><span>下へ進むと続きを表示します</span><button type="button" disabled={loading||moreLoading||Boolean(savedDisplay)} onClick={revealMore}>{moreLoading?"続きを読み込み中…":"続きを表示"}</button></div>:null}</>:<p className="micf-empty">この条件のコメント履歴はありません。</p>}
 </section>
}

