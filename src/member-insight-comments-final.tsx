import { CreatorAvatar } from "./creator-avatar";
import { useEffect, useMemo, useRef, useState } from "react";
import { INSIGHT_TOKEN_KEY } from "./insight-account-store";
import { memberDbReadFallback, memberReadAuthFailure } from "./insight-member-db-fallback";
import { readInsightSnapshot, writeInsightSnapshot } from "./insight-persistent-cache";
import { fetchInsightResource, isFreshInsightView } from "./insight-view-lifecycle";
import "./member-insight-comments-final.css";

const HISTORY="https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-member-history";
const EXTRAS="https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-member-extras";
const EVENTS="https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-comment-events";
const HEARTS="https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-comment-hearts";
const ICON="https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/creator-icons";
const PAGE=100;
const FETCH_GROUP=4;
const EVENT_PAGE=500;
const EVENT_GROUP=3;
type Row=Record<string,any>;type Heart=Record<string,any>;
type CapturedRequest={token:string;signal:AbortSignal};
type CommentRequest=CapturedRequest&{seq:number};
type CommentCache={rows:Row[];total:number;at:number;revision:number};
const COMMENT_CACHE=new Map<string,CommentCache>();
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
async function post(endpoint:string,body:Record<string,unknown>,request:CapturedRequest){
 const {token,signal}=request;
 if(!token)throw new Error("INSIGHT_LOGIN_REQUIRED");
 if(signal.aborted||token!==(localStorage.getItem(INSIGHT_TOKEN_KEY)||""))throw new Error("INSIGHT_REQUEST_CANCELLED");
 try{
  const r=await fetchInsightResource(endpoint,{method:"POST",headers:{"Content-Type":"application/json","X-Insight-Token":token},body:JSON.stringify(body),cache:"no-store",signal},15000);
  const p=await bounded(r.json().catch(()=>({})),signal);
  if(r.status===401||r.status===403)throw new Error(p?.error||`HTTP_${r.status}`);
  if(r.status===402)throw new Error("BACKEND_RESTRICTED_402");
  if(!r.ok||p?.ok===false)throw new Error(p?.error||"INSIGHT_API_ERROR");
  return p;
 }catch(e){
  if(signal.aborted||token!==(localStorage.getItem(INSIGHT_TOKEN_KEY)||""))throw e;
  const msg=e instanceof Error?e.message:String(e);
  if(!memberReadAuthFailure(msg))try{return await bounded(memberDbReadFallback(endpoint,body,token),signal)}catch{}
  throw e;
 }
}
const n=(v:any)=>new Intl.NumberFormat("ja-JP").format(Number(v||0));
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
 const[rows,setRows]=useState<Row[]>([]),[articles,setArticles]=useState<Row[]>([]),[articleKey,setArticleKey]=useState(""),[day,setDay]=useState(""),[draft,setDraft]=useState(""),[query,setQuery]=useState(""),[total,setTotal]=useState(0),[status,setStatus]=useState("all"),[detail,setDetail]=useState<Record<string,Row[]>>({}),[hearts,setHearts]=useState<Record<string,Heart>>({}),[loading,setLoading]=useState(true),[error,setError]=useState(""),[syncPhase,setSyncPhase]=useState<"initial"|"delta"|"result"|"idle">("initial"),[syncMessage,setSyncMessage]=useState("保存履歴を構築中"),[renderLimit,setRenderLimit]=useState(120);
 const loadSeq=useRef(0),syncTimer=useRef(0),moreRef=useRef<HTMLDivElement|null>(null),activeRequest=useRef<AbortController|null>(null),articleSeq=useRef(0);
 const range=useMemo(()=>day?{dateFrom:isoDay(day),dateTo:nextDay(day)}:{dateFrom:null,dateTo:null},[day]);
 const token=localStorage.getItem(INSIGHT_TOKEN_KEY)||"";
 const cacheKey=`${memberNoteId.trim().toLowerCase()}|${token}|${status}|${day}|${articleKey}|${status==="all"?"":query}`,persistKey=snapshotKey(memberNoteId);
 const globalAll=status==="all"&&!day&&!articleKey;
 function current(request:CommentRequest){return request.seq===loadSeq.current&&!request.signal.aborted&&request.token===(localStorage.getItem(INSIGHT_TOKEN_KEY)||"")}
 function beginLoad():CommentRequest{activeRequest.current?.abort();window.clearTimeout(syncTimer.current);const controller=new AbortController();activeRequest.current=controller;return{seq:++loadSeq.current,token,signal:controller.signal}}
 function finishSync(request:CommentRequest,message:string,delay=1200){if(!current(request))return;window.clearTimeout(syncTimer.current);setSyncMessage(message);setSyncPhase("result");syncTimer.current=window.setTimeout(()=>{if(current(request))setSyncPhase("idle")},delay)}
 function publish(request:CommentRequest,list:Row[],count:number){if(!current(request))return;setRows(list);setTotal(count);setLoading(false)}
 function cache(request:CommentRequest,list:Row[],count:number){if(!current(request))return;COMMENT_CACHE.set(cacheKey,{rows:list,total:count,at:Date.now(),revision});if(COMMENT_CACHE.size>40)COMMENT_CACHE.delete(COMMENT_CACHE.keys().next().value!)}
 async function saveSnapshot(request:CommentRequest,list:Row[],count:number){if(!persistKey||!current(request))return;await writeInsightSnapshot<CommentSnapshot>(persistKey,{version:1,rows:list,total:count,latestAt:latestAt(list),savedAt:Date.now()})}
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
   setHearts(v=>current(request)?({...v,...map}):v);
  }catch{if(!current(request))return}}
 }
 async function loadAll(background=false,fallback?:CommentCache|CommentSnapshot){
  const request=beginLoad();let received=false;
  setLoading(true);setError("");setSyncPhase(background?"delta":"initial");setSyncMessage("最新のコメント履歴を確認中");
  try{
   if(status==="all"){
    const params={pageSize:EVENT_PAGE,articleKey:articleKey||null,...range},first=await post(EVENTS,{...params,page:1},request);
    if(!current(request))return;
    const expected=Math.max(0,Number(first.total||0));
    let collected:Row[]=mergeEvents([],first.rows||[]),seen=new Set(collected.map(r=>String(r.comment_key||"")));
    received=true;publish(request,collected,expected);enrichLater(collected,request);
    const pages=Math.ceil(expected/EVENT_PAGE);
    for(let start=2;start<=pages;start+=EVENT_GROUP){
     const nums=Array.from({length:Math.min(EVENT_GROUP,pages-start+1)},(_,i)=>start+i),packets=await Promise.all(nums.map(page=>post(EVENTS,{...params,page},request)));
     if(!current(request))return;
     const added:Row[]=[];
     for(const packet of packets)for(const row of packet.rows||[]){const k=String(row.comment_key||"");if(!k||seen.has(k))continue;seen.add(k);added.push(row)}
     if(added.length){collected=mergeEvents(collected,added);publish(request,collected,expected);enrichLater(added,request)}
    }
    cache(request,collected,expected);
    if(globalAll)void saveSnapshot(request,collected,expected);
    finishSync(request,background?"最新状態に更新":"全履歴 読込完了");return;
   }
   const params={pageSize:PAGE,status,query,articleKey:articleKey||null,...range},first=await post(EXTRAS,{action:"comments_filtered",...params,page:1},request);
   if(!current(request))return;
   const expected=Math.max(0,Number(first.total||0)),firstList=uniqueRows(first.rows||[]);
   let collected:Row[]=[...firstList],seen=new Set(collected.map(r=>String(r.root_key||"")));
   received=true;publish(request,collected,expected);enrichLater(firstList,request);void loadHearts(firstList,request);
   const pages=Math.ceil(expected/PAGE);
   for(let start=2;start<=pages;start+=FETCH_GROUP){
    const nums=Array.from({length:Math.min(FETCH_GROUP,pages-start+1)},(_,i)=>start+i),packets=await Promise.all(nums.map(page=>post(EXTRAS,{action:"comments_filtered",...params,page},request)));
    if(!current(request))return;
    const added:Row[]=[];
    for(const packet of packets)for(const row of packet.rows||[]){const k=String(row.root_key||"");if(!k||seen.has(k))continue;seen.add(k);added.push(row)}
    if(added.length){collected=[...collected,...added];publish(request,collected,expected);enrichLater(added,request);void loadHearts(added,request)}
   }
   cache(request,collected,expected);finishSync(request,"集計完了");
  }catch(e){
   if(!current(request))return;
   const message=e instanceof Error?e.message:"コメント履歴の読込に失敗しました";
   if(!received&&fallback&&!memberReadAuthFailure(message)){publish(request,fallback.rows,fallback.total);finishSync(request,"通信を確認できないため保存済み履歴を表示中")}
   setError(message);
  }finally{if(current(request))setLoading(false)}
 }
 async function refreshDelta(snapshot:CommentSnapshot,background=false,verifiedProbe?:Record<string,any>){
  const request=beginLoad();let verified=false,merged=snapshot.rows,serverTotal=snapshot.total;
  setLoading(!background);setError("");setSyncPhase(background?"delta":"initial");setSyncMessage("最新のコメント履歴を確認中");
  try{
   const probe=verifiedProbe||await post(EVENTS,{page:1,pageSize:50},request);
   if(!current(request))return;
   serverTotal=Math.max(0,Number(probe.total||0));const probeRows=(probe.rows||[]) as Row[];
   if(serverTotal<snapshot.total){void loadAll(background,snapshot);return}
   merged=mergeEvents(snapshot.rows,probeRows);verified=true;publish(request,merged,serverTotal);enrichLater(probeRows,request);
   if(serverTotal>snapshot.total){
    const from=snapshot.latestAt||latestAt(snapshot.rows);
    if(!from){void loadAll(true,snapshot);return}
    const first=await post(EVENTS,{page:1,pageSize:EVENT_PAGE,dateFrom:from},request);
    if(!current(request))return;
    const deltaExpected=Math.max(0,Number(first.total||0));
    merged=mergeEvents(merged,first.rows||[]);publish(request,merged,serverTotal);enrichLater(first.rows||[],request);
    const pages=Math.ceil(deltaExpected/EVENT_PAGE);
    for(let start=2;start<=pages;start+=EVENT_GROUP){
     const nums=Array.from({length:Math.min(EVENT_GROUP,pages-start+1)},(_,i)=>start+i),packets=await Promise.all(nums.map(page=>post(EVENTS,{page,pageSize:EVENT_PAGE,dateFrom:from},request)));
     if(!current(request))return;
     const added=packets.flatMap(packet=>packet.rows||[]) as Row[];merged=mergeEvents(merged,added);publish(request,merged,serverTotal);enrichLater(added,request);
    }
   }
   if(merged.length!==serverTotal){void loadAll(true,snapshot);return}
   cache(request,merged,serverTotal);void saveSnapshot(request,merged,serverTotal);
   const newCount=Math.max(0,merged.length-snapshot.rows.length);finishSync(request,newCount?`＋${n(newCount)}件を追加`:"最新状態に更新");
  }catch(e){
   if(!current(request))return;
   const message=e instanceof Error?e.message:"コメント履歴の読込に失敗しました";
   if(!verified&&!memberReadAuthFailure(message))publish(request,snapshot.rows,snapshot.total);
   finishSync(request,verified?"追加分の通信を確認できませんでした":"通信を確認できないため保存済み履歴を表示中");setError(message);
  }finally{if(current(request))setLoading(false)}
 }
 async function open(k:string){
  if(detail[k])return;
  const controller=activeRequest.current;if(!controller)return;
  const request={seq:loadSeq.current,token,signal:controller.signal};
  try{const x=await post(HISTORY,{action:"comment_thread",rootKey:k},request);if(current(request))setDetail(v=>current(request)?({...v,[k]:x.rows||[]}):v)}catch(e){if(current(request))setError(e instanceof Error?e.message:"会話の読込に失敗しました")}
 }
 useEffect(()=>{
  const controller=new AbortController(),seq=++articleSeq.current,capturedToken=token;
  setArticleKey("");setArticles([]);
  if(day)void post(EXTRAS,{action:"comment_articles",...range},{token:capturedToken,signal:controller.signal}).then(x=>{if(!controller.signal.aborted&&seq===articleSeq.current&&capturedToken===(localStorage.getItem(INSIGHT_TOKEN_KEY)||""))setArticles(x.rows||[])}).catch(()=>{});
  return()=>{controller.abort();articleSeq.current++};
 },[day,token]);
 const threadQuery=status==="all"?"":query;
 useEffect(()=>{
  setDetail({});setHearts({});setRows([]);setTotal(0);setLoading(true);setError("");setSyncPhase("initial");setSyncMessage("最新のコメント履歴を確認中");
  let cancelled=false;
  const cached=COMMENT_CACHE.get(cacheKey);
  const cachedSnapshot=cached?{version:1 as const,rows:cached.rows,total:cached.total,latestAt:latestAt(cached.rows),savedAt:cached.at}:null;
  if(cached){
   const fresh=cached.revision===revision&&isFreshInsightView(cached.at);
   if(fresh){setRows(cached.rows);setTotal(cached.total);setLoading(false)}
   if(globalAll)void refreshDelta(cachedSnapshot!,fresh);else void loadAll(fresh,cached);
  }else if(globalAll&&persistKey){
   // Reading the saved snapshot and checking the server run together. A slow local
   // database must not delay the first fresh response.
   const request=beginLoad();
   let snapshotReady=false,saved:CommentSnapshot|null=null;
   const savedRead=readInsightSnapshot<CommentSnapshot>(persistKey).then(snapshot=>{snapshotReady=true;saved=snapshot;return snapshot});
   void post(EVENTS,{page:1,pageSize:50},request).then(async probe=>{
    if(cancelled||!current(request))return;
    const list=mergeEvents([],probe.rows||[]),count=Math.max(0,Number(probe.total||0));
    publish(request,list,count);enrichLater(list,request);
    const snapshot=snapshotReady?saved:await bounded(savedRead,request.signal,1000).catch(()=>null);
    if(cancelled||!current(request))return;
    if(snapshot?.version===1&&Array.isArray(snapshot.rows)&&snapshot.rows.length&&count>=snapshot.total){
     // The server already verified these rows; keep them visible during the delta.
     const merged=mergeEvents(snapshot.rows,list);publish(request,merged,count);
     void refreshDelta(snapshot,true,probe);
    }else if(count>list.length)void loadAll(true);
    else{cache(request,list,count);void saveSnapshot(request,list,count);finishSync(request,"全履歴 読込完了")}
   }).catch(async e=>{
    if(cancelled||!current(request))return;
    const message=e instanceof Error?e.message:"コメント履歴の読込に失敗しました";
    const snapshot=snapshotReady?saved:await bounded(savedRead,request.signal,1000).catch(()=>null);
    if(cancelled||!current(request))return;
    if(snapshot?.version===1&&Array.isArray(snapshot.rows)&&!memberReadAuthFailure(message)){publish(request,snapshot.rows,Number(snapshot.total||snapshot.rows.length));finishSync(request,"通信を確認できないため保存済み履歴を表示中")}
    else setLoading(false);
    setError(message);
   });
  }else void loadAll(false);
  return()=>{cancelled=true;loadSeq.current++;activeRequest.current?.abort();window.clearTimeout(syncTimer.current)};
 },[status,day,articleKey,threadQuery,revision,persistKey,token]);
 useEffect(()=>()=>{activeRequest.current?.abort();window.clearTimeout(syncTimer.current)},[]);
 useEffect(()=>{setRenderLimit(120)},[status,day,articleKey,query]);
 useEffect(()=>{
  const el=moreRef.current;if(!el)return;
  const io=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting))setRenderLimit(v=>Math.min(v+120,Math.max(rows.length,120)))},{rootMargin:"360px 0px"});
  io.observe(el);return()=>io.disconnect()
 },[rows.length,status,query]);
 const eventRows=useMemo(()=>{if(status!=="all")return rows;const q=query.trim().toLowerCase();if(!q)return rows;return rows.filter(r=>[r.actor_name,r.actor_url,r.article_title,r.body].some(v=>String(v||"").toLowerCase().includes(q)))},[rows,status,query]);
 const visibleEventRows=useMemo(()=>eventRows.slice(0,renderLimit),[eventRows,renderLimit]);
 const visibleThreadRows=useMemo(()=>rows.slice(0,renderLimit),[rows,renderLimit]);
 const complete=!loading&&rows.length>=total,shownTotal=status==="all"&&query.trim()?eventRows.length:total;
 return <section className="micf" aria-busy={syncPhase==="initial"&&loading}>
  <header className="micf-head"><div><small>COMMENT HISTORY</small><h2>コメント・返信履歴</h2><p>{status==="all"?"保存済みの全コメント・全返信を、会話数ではなく1件ずつ全部表示します。":"対応状況ごとの会話一覧です。「自分の返信で終了」は最後の返信への相手本人の♡も照合します。"}</p></div><strong>{n(shownTotal)}件</strong></header>
  {syncPhase!=="idle"?<div className={`micf-sync-scene ${syncPhase}`}><div className="micf-sync-track"><i/><i/><i/><i/></div><b>{syncMessage}</b><span>{syncPhase==="initial"?`${n(rows.length)} / ${total?n(total):"…"}件`:"保存済み表示はそのまま"}</span></div>:<div className="micf-load-state done"><b>{complete?"全履歴 保存済み":"保存済み履歴"}</b><span>{n(rows.length)} / {n(total)}件</span></div>}
  <div className="micf-tabs">{[["all","すべて（全コメント）"],["pending","要対応"],["unreplied","未返信"],["followup_pending","相手返信"],["heart_closed","あなたの♡で終了"],["replied","自分返信"]].map(x=><button key={x[0]} className={status===x[0]?"active":""} onClick={()=>setStatus(x[0])}>{x[1]}</button>)}</div>
  <div className="micf-tools"><label><span>コメント日</span><input type="date" value={day} onChange={e=>setDay(e.target.value)}/></label><select value={articleKey} onChange={e=>setArticleKey(e.target.value)} disabled={!day}><option value="">{day?`この日の記事すべて (${articles.length})`:"日付を選択すると記事一覧"}</option>{articles.map(a=><option key={a.article_key} value={a.article_key}>{a.title}（{n(a.comment_count_day)}件）</option>)}</select><input value={draft} onChange={e=>setDraft(e.target.value)} placeholder="名前・記事・コメント本文" onKeyDown={e=>{if(e.key==="Enter")setQuery(draft)}}/><button onClick={()=>setQuery(draft)}>検索</button>{day?<button onClick={()=>{setDay("");setArticleKey("")}}>日付解除</button>:null}</div>
  {error?<p className="micf-error">{error}</p>:null}{loading&&!rows.length?<p className="micf-empty">コメント全履歴を読み込み中…</p>:status==="all"?eventRows.length?<><div className="micf-event-list">{visibleEventRows.map(r=>{const label=r.is_creator?(r.is_root?"あなたのコメント":"あなたの返信"):(r.is_root?"コメント":"返信");return <article key={r.comment_key} className={r.is_creator?"mine":""}><EventPerson row={r}/><span className="micf-event-kind">{label}</span><p>{r.body||"（本文なし）"}</p>{r.article_url?<a href={r.article_url} target="_blank" rel="noreferrer">{r.article_title||"対象記事"} ↗</a>:<span className="micf-event-article">{r.article_title||"記事"}</span>}<time>{date(r.occurred_at)}</time>{r.is_creator_liked?<small className="micf-event-heart">♥ あなたの♡</small>:null}</article>})}</div>{visibleEventRows.length<eventRows.length?<div ref={moreRef} className="micf-more"><b>{n(visibleEventRows.length)} / {n(eventRows.length)}件を表示</b><span>下へ進むと続きを表示します</span></div>:null}</>:<p className="micf-empty">この条件のコメント履歴はありません。</p>:rows.length?<><div className="micf-thread-list">{visibleThreadRows.map(r=>{const st=stateOf(r,status),heart=hearts[String(r.root_key||"")];return <details key={r.root_key} onToggle={e=>{if((e.currentTarget as HTMLDetailsElement).open)void open(String(r.root_key))}}><summary><Person row={r}/><span className={`micf-state ${st.key}`}>{st.label}</span><p>{String(r.root_body||"").slice(0,140)}</p><a href={r.article_url} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()}>{r.article_title}</a><time>{date(r.last_at||r.root_at)}</time><HeartState row={r} heart={heart}/></summary><div className="micf-thread">{detail[String(r.root_key)]?.map(m=><article key={m.comment_key} className={m.is_creator?"mine":""}><div><b>{m.is_creator?"あなた":m.actor_name}</b><small>{date(m.occurred_at)}</small></div><p>{m.body}</p></article>)||<p>会話を読み込み中…</p>}</div></details>})}</div>{visibleThreadRows.length<rows.length?<div ref={moreRef} className="micf-more"><b>{n(visibleThreadRows.length)} / {n(rows.length)}件を表示</b><span>下へ進むと続きを表示します</span></div>:null}</>:<p className="micf-empty">この条件のコメント履歴はありません。</p>}
 </section>
}

