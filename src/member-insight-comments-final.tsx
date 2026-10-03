import { CreatorAvatar } from "./creator-avatar";
import { useEffect, useMemo, useRef, useState } from "react";
import { INSIGHT_TOKEN_KEY } from "./insight-account-store";
import { memberDbReadFallback, memberReadAuthFailure } from "./insight-member-db-fallback";
import { readInsightSnapshot, writeInsightSnapshot } from "./insight-persistent-cache";
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
const COMMENT_CACHE=new Map<string,{rows:Row[];total:number;at:number}>();
async function post(endpoint:string,body:Record<string,unknown>){const token=localStorage.getItem(INSIGHT_TOKEN_KEY)||"";if(!token)throw new Error("INSIGHT_LOGIN_REQUIRED");const controller=new AbortController(),timer=window.setTimeout(()=>controller.abort(),45000);try{try{const r=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json","X-Insight-Token":token},body:JSON.stringify(body),cache:"no-store",signal:controller.signal});const p=await r.json().catch(()=>({}));if(r.status===401||r.status===403)throw new Error(p?.error||`HTTP_${r.status}`);if(r.status===402)throw new Error("BACKEND_RESTRICTED_402");if(!r.ok||p?.ok===false)throw new Error(p?.error||"INSIGHT_API_ERROR");return p}catch(e){const msg=e instanceof Error?e.message:String(e);if(!memberReadAuthFailure(msg))try{return await memberDbReadFallback(endpoint,body)}catch{}throw e}}finally{window.clearTimeout(timer)}}
const hist=(action:string,extra:Record<string,unknown>={})=>post(HISTORY,{action,...extra});const extra=(action:string,extra:Record<string,unknown>={})=>post(EXTRAS,{action,...extra});
const n=(v:any)=>new Intl.NumberFormat("ja-JP").format(Number(v||0));
const date=(v:any,withTime=true)=>{if(!v)return"—";const d=new Date(String(v));if(Number.isNaN(d.getTime()))return"—";return new Intl.DateTimeFormat("ja-JP",{timeZone:"Asia/Tokyo",...(withTime?{year:"numeric",month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"}:{year:"numeric",month:"numeric",day:"numeric"})}).format(d)};
const isoDay=(v:string)=>v?`${v}T00:00:00+09:00`:null;function nextDay(v:string){return v?new Date(new Date(`${v}T00:00:00+09:00`).getTime()+86400000).toISOString():null}function noteId(url:any){try{return new URL(String(url||"")).pathname.split("/").filter(Boolean)[0]||""}catch{return""}}
async function enrich(rows:Row[]):Promise<Row[]>{const ids=[...new Set(rows.map(r=>noteId(r.actor_url)).filter(Boolean).map(x=>String(x).toLowerCase()))];if(!ids.length)return rows;try{const m=new Map<string,string>();for(let i=0;i<ids.length;i+=100){const r=await fetch(ICON,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({noteIds:ids.slice(i,i+100)}),cache:"no-store"}),p=await r.json();for(const x of p.items||[])if(x?.noteId&&x?.image)m.set(String(x.noteId).toLowerCase(),String(x.image))}return rows.map((x:Row):Row=>({...x,actor_image_url:x.actor_image_url||m.get(String(noteId(x.actor_url)).toLowerCase())||null}))}catch{return rows}}
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
  for(const row of [...base,...incoming]){const key=String(row.comment_key||"");if(key&&!map.has(key))map.set(key,row)}
  return [...map.values()].sort((a,b)=>Date.parse(String(b.occurred_at||0))-Date.parse(String(a.occurred_at||0)))
}
export function MemberInsightCommentsFinal({revision=0,noteId:memberNoteId=""}:{revision?:number;noteId?:string}){
 const[rows,setRows]=useState<Row[]>([]),[articles,setArticles]=useState<Row[]>([]),[articleKey,setArticleKey]=useState(""),[day,setDay]=useState(""),[draft,setDraft]=useState(""),[query,setQuery]=useState(""),[total,setTotal]=useState(0),[status,setStatus]=useState("all"),[detail,setDetail]=useState<Record<string,Row[]>>({}),[hearts,setHearts]=useState<Record<string,Heart>>({}),[loading,setLoading]=useState(true),[error,setError]=useState(""),[syncPhase,setSyncPhase]=useState<"initial"|"delta"|"result"|"idle">("initial"),[syncMessage,setSyncMessage]=useState("保存履歴を構築中"),[renderLimit,setRenderLimit]=useState(120);
 const loadSeq=useRef(0),syncTimer=useRef(0),moreRef=useRef<HTMLDivElement|null>(null);
 const range=useMemo(()=>day?{dateFrom:isoDay(day),dateTo:nextDay(day)}:{dateFrom:null,dateTo:null},[day]);
 const cacheKey=`${status}|${day}|${articleKey}|${status==="all"?"":query}`,persistKey=snapshotKey(memberNoteId);
 const globalAll=status==="all"&&!day&&!articleKey;
 function finishSync(message:string,delay=1200){window.clearTimeout(syncTimer.current);setSyncMessage(message);setSyncPhase("result");syncTimer.current=window.setTimeout(()=>setSyncPhase("idle"),delay)}
 async function saveSnapshot(list:Row[],count:number){if(!persistKey)return;await writeInsightSnapshot<CommentSnapshot>(persistKey,{version:1,rows:list,total:count,latestAt:latestAt(list),savedAt:Date.now()})}
 async function loadArticles(){setArticleKey("");if(!day){setArticles([]);return}try{const x=await extra("comment_articles",range);setArticles(x.rows||[])}catch{setArticles([])}}
 async function loadHearts(list:Row[],seq:number){const keys=list.filter((r:Row)=>stateOf(r,status).key==="replied").map((r:Row)=>String(r.root_key||"")).filter(Boolean);for(let i=0;i<keys.length;i+=80){try{const h=await post(HEARTS,{action:"batch",rootKeys:keys.slice(i,i+80)});if(seq!==loadSeq.current)return;const map:Record<string,Heart>={};for(const item of h.rows||[])map[String(item.rootKey)]=item;setHearts(v=>({...v,...map}))}catch{}}}
 async function loadAll(background=false){
  const seq=++loadSeq.current;
  if(!background||!rows.length)setLoading(true);
  setError("");
  if(!background){setSyncPhase("initial");setSyncMessage("保存履歴を構築中")}
  try{
   if(status==="all"){
    const params={pageSize:EVENT_PAGE,articleKey:articleKey||null,...range},first=await post(EVENTS,{...params,page:1});
    if(seq!==loadSeq.current)return;
    const expected=Math.max(0,Number(first.total||0));
    let collected:Row[]=uniqueRows(await enrich(first.rows||[]),"comment_key"),seen=new Set(collected.map((r:Row)=>String(r.comment_key||"")));
    setTotal(expected);setRows(collected);
    const pages=Math.ceil(expected/EVENT_PAGE);
    for(let start=2;start<=pages;start+=EVENT_GROUP){
      const nums=Array.from({length:Math.min(EVENT_GROUP,pages-start+1)},(_,i)=>start+i),packets=await Promise.all(nums.map(page=>post(EVENTS,{...params,page})));
      if(seq!==loadSeq.current)return;
      const enriched=await Promise.all(packets.map(x=>enrich((x.rows||[]) as Row[])));
      if(seq!==loadSeq.current)return;
      const added:Row[]=[];
      for(const list of enriched)for(const row of list){const k=String(row.comment_key||"");if(!k||seen.has(k))continue;seen.add(k);added.push(row)}
      if(added.length){collected=[...collected,...added];setRows(collected)}
    }
    COMMENT_CACHE.set(cacheKey,{rows:collected,total:expected,at:Date.now()});
    if(globalAll)await saveSnapshot(collected,expected);
    finishSync(background?"最新状態に更新":"全履歴 読込完了");
    return;
   }
   const params={pageSize:PAGE,status,query,articleKey:articleKey||null,...range},first=await extra("comments_filtered",{...params,page:1});
   if(seq!==loadSeq.current)return;
   const expected=Math.max(0,Number(first.total||0)),firstList=uniqueRows(await enrich(first.rows||[]));
   let collected:Row[]=[...firstList],seen=new Set(collected.map((r:Row)=>String(r.root_key||"")));
   setTotal(expected);setRows(collected);void loadHearts(firstList,seq);
   const pages=Math.ceil(expected/PAGE);
   for(let start=2;start<=pages;start+=FETCH_GROUP){
    const nums=Array.from({length:Math.min(FETCH_GROUP,pages-start+1)},(_,i)=>start+i),packets=await Promise.all(nums.map(page=>extra("comments_filtered",{...params,page})));
    if(seq!==loadSeq.current)return;
    const enriched=await Promise.all(packets.map(x=>enrich((x.rows||[]) as Row[])));
    if(seq!==loadSeq.current)return;
    const added:Row[]=[];
    for(const list of enriched)for(const row of list){const k=String(row.root_key||"");if(!k||seen.has(k))continue;seen.add(k);added.push(row)}
    if(added.length){collected=[...collected,...added];setRows(collected);void loadHearts(added,seq)}
   }
   COMMENT_CACHE.set(cacheKey,{rows:collected,total:expected,at:Date.now()});
   finishSync("集計完了");
  }catch(e){if(seq===loadSeq.current)setError(e instanceof Error?e.message:"コメント履歴の読込に失敗しました")}
  finally{if(seq===loadSeq.current)setLoading(false)}
 }
 async function refreshDelta(snapshot:CommentSnapshot){
  const seq=++loadSeq.current;setLoading(false);setError("");setSyncPhase("delta");setSyncMessage("追加分を確認中");
  try{
   const probe=await post(EVENTS,{page:1,pageSize:50});
   if(seq!==loadSeq.current)return;
   const serverTotal=Math.max(0,Number(probe.total||0)),probeRows=await enrich((probe.rows||[]) as Row[]);
   if(serverTotal<snapshot.total){await loadAll(true);return}
   let merged=mergeEvents(snapshot.rows,probeRows),newCount=Math.max(0,merged.length-snapshot.rows.length);
   if(serverTotal>snapshot.total){
    const from=snapshot.latestAt||latestAt(snapshot.rows);
    if(!from){await loadAll(true);return}
    const first=await post(EVENTS,{page:1,pageSize:EVENT_PAGE,dateFrom:from});
    if(seq!==loadSeq.current)return;
    const deltaExpected=Math.max(0,Number(first.total||0));
    let delta:Row[]=uniqueRows(await enrich(first.rows||[]),"comment_key");
    const pages=Math.ceil(deltaExpected/EVENT_PAGE);
    for(let start=2;start<=pages;start+=EVENT_GROUP){
      const nums=Array.from({length:Math.min(EVENT_GROUP,pages-start+1)},(_,i)=>start+i),packets=await Promise.all(nums.map(page=>post(EVENTS,{page,pageSize:EVENT_PAGE,dateFrom:from})));
      if(seq!==loadSeq.current)return;
      const enriched=await Promise.all(packets.map(x=>enrich((x.rows||[]) as Row[])));
      for(const list of enriched)delta=uniqueRows([...delta,...list],"comment_key")
    }
    merged=mergeEvents(snapshot.rows,delta);newCount=Math.max(0,merged.length-snapshot.rows.length)
   }
   setRows(merged);setTotal(serverTotal);COMMENT_CACHE.set(cacheKey,{rows:merged,total:serverTotal,at:Date.now()});
   await saveSnapshot(merged,serverTotal);
   finishSync(newCount?`＋${n(newCount)}件を追加`:"追加なし");
  }catch{finishSync("保存済み履歴を表示中")}
 }
 async function open(k:string){if(detail[k])return;const x=await hist("comment_thread",{rootKey:k});setDetail(v=>({...v,[k]:x.rows||[]}))}
 useEffect(()=>{void loadArticles()},[day]);
 const threadQuery=status==="all"?"":query;
 useEffect(()=>{
  setDetail({});
  let cancelled=false;
  const cached=COMMENT_CACHE.get(cacheKey);
  if(cached){
    setRows(cached.rows);setTotal(cached.total);setLoading(false);
    if(globalAll){void refreshDelta({version:1,rows:cached.rows,total:cached.total,latestAt:latestAt(cached.rows),savedAt:cached.at})}
    else void loadAll(true);
    return()=>{cancelled=true;loadSeq.current++}
  }
  if(globalAll&&persistKey){
    setSyncPhase("initial");setSyncMessage("保存済み履歴を復元中");
    void readInsightSnapshot<CommentSnapshot>(persistKey).then(snapshot=>{
      if(cancelled)return;
      if(snapshot?.version===1&&Array.isArray(snapshot.rows)&&snapshot.rows.length){
        COMMENT_CACHE.set(cacheKey,{rows:snapshot.rows,total:Number(snapshot.total||snapshot.rows.length),at:Number(snapshot.savedAt||Date.now())});
        setRows(snapshot.rows);setTotal(Number(snapshot.total||snapshot.rows.length));setLoading(false);
        void refreshDelta(snapshot);
      }else void loadAll(false)
    });
  }else void loadAll(false);
  return()=>{cancelled=true;loadSeq.current++}
 },[status,day,articleKey,threadQuery,revision,persistKey]);
 useEffect(()=>()=>window.clearTimeout(syncTimer.current),[]);
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

