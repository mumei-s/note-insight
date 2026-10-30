import { CreatorAvatar } from "./creator-avatar";
import { useEffect, useMemo, useRef, useState } from "react";
import { INSIGHT_TOKEN_KEY, currentStoredInsightAccount } from "./insight-account-store";
import { memberDbReadFallback, memberReadAuthFailure } from "./insight-member-db-fallback";
import { fetchInsightResource } from "./insight-view-lifecycle";
import { readSavedInsightView, removeSavedInsightView, writeSavedInsightView } from "./insight-saved-view";
import "./member-insight-favorites-final.css";

const HISTORY="https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-member-history";
const EXTRAS="https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-member-extras";
const GROUPS="https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-favorite-groups";
type Row=Record<string,any>;
const clean=(v:any)=>String(v||"").replace(/\s+/g," ").trim().slice(0,40);
const date=(v:any)=>{const d=new Date(String(v||""));return Number.isNaN(d.getTime())?"—":new Intl.DateTimeFormat("ja-JP",{timeZone:"Asia/Tokyo",year:"numeric",month:"numeric",day:"numeric"}).format(d)};
function favoriteAuthFailure(error:unknown){return [401,403].includes(Number((error as {status?:number})?.status))||memberReadAuthFailure(error instanceof Error?error.message:String(error))}
async function requestFavorite(endpoint:string,body:Record<string,unknown>,signal?:AbortSignal){
 const token=localStorage.getItem(INSIGHT_TOKEN_KEY)||"";if(!token)throw new Error("INSIGHT_LOGIN_REQUIRED");
 try{try{const r=await fetchInsightResource(endpoint,{method:"POST",headers:{"Content-Type":"application/json","X-Insight-Token":token},body:JSON.stringify(body),cache:"no-store",signal}),p=await r.json().catch(()=>({}));if(r.status===401||r.status===403)throw Object.assign(new Error(p?.error||`HTTP_${r.status}`),{status:r.status});if(r.status===402)throw new Error("BACKEND_RESTRICTED_402");if(!r.ok||p?.ok===false)throw new Error(p?.error||"INSIGHT_API_ERROR");if(signal?.aborted)throw Object.assign(new Error("通信を中断しました"),{name:"AbortError"});if(localStorage.getItem(INSIGHT_TOKEN_KEY)!==token)throw new Error("アカウントが切り替わりました");return p}catch(e){if(signal?.aborted||localStorage.getItem(INSIGHT_TOKEN_KEY)!==token)throw e;if(!favoriteAuthFailure(e))try{return await memberDbReadFallback(endpoint,body,token)}catch(fallbackError){if(favoriteAuthFailure(fallbackError))throw fallbackError}throw e}}
 catch(e){if(e instanceof Error&&e.name==='AbortError'&&!signal?.aborted)throw new Error('お気に入りの通信が30秒以内に完了しませんでした');throw e}
}
function Avatar({row}:{row:Row}){return <CreatorAvatar person={row} name={String(row.actor_name||"noteユーザー")}/>}
type FavoriteSnapshot={rows:Row[];groups:string[];assigned:Record<string,string>;filter:string;total:number};
type FavoriteArticlePage={page:number;hasNext:boolean};
type FavoriteRuntime={revision:number;at:number;rows:Row[];groups:string[];assigned:Record<string,string>;filter:string;open:string|null;articles:Record<string,Row[]>;articlePages:Record<string,FavoriteArticlePage>;query:string};
const FAVORITE_RUNTIME=new Map<string,FavoriteRuntime>(),FAVORITE_SCOPE_LIMIT=4,FAVORITE_ARTICLE_LIMIT=12;
function retainFavoriteRuntime(key:string,value:FavoriteRuntime){FAVORITE_RUNTIME.delete(key);FAVORITE_RUNTIME.set(key,value);if(FAVORITE_RUNTIME.size>FAVORITE_SCOPE_LIMIT)FAVORITE_RUNTIME.delete(FAVORITE_RUNTIME.keys().next().value!)}
function favoriteScope(){return{account:String(currentStoredInsightAccount()?.noteId||'').toLowerCase(),token:localStorage.getItem(INSIGHT_TOKEN_KEY)||''}}
window.addEventListener("mumei-insight-favorites-changed",()=>FAVORITE_RUNTIME.delete(JSON.stringify(favoriteScope())));
export function MemberInsightFavoritesFinal({revision=0}:{revision?:number}){
  return <FavoriteView key={JSON.stringify(favoriteScope())} revision={revision}/>;
}
function FavoriteView({revision}:{revision:number}){
  const scope=favoriteScope(),runtimeKey=JSON.stringify(scope),[runtime]=useState(()=>{const value=FAVORITE_RUNTIME.get(runtimeKey);return value?.revision===revision?value:null}),readSaved=()=>{const saved=readSavedInsightView<FavoriteSnapshot>('favorites-last',scope),v=saved?.value;return v&&Array.isArray(v.rows)&&v.rows.length<=100&&Array.isArray(v.groups)&&v.assigned&&typeof v.assigned==='object'?saved:null},[initial,setInitial]=useState(readSaved);
  const passiveDisplay=useRef(Boolean(runtime||initial));
  const[rows,setRows]=useState<Row[]>(runtime?.rows||initial?.value.rows||[]),[groups,setGroups]=useState<string[]>(runtime?.groups||initial?.value.groups||[]),[assigned,setAssigned]=useState<Record<string,string>>(runtime?.assigned||initial?.value.assigned||{}),[filter,setFilter]=useState(runtime?.filter||initial?.value.filter||"all"),[newGroup,setNewGroup]=useState(""),[busy,setBusy]=useState(""),[error,setError]=useState(""),[loading,setLoading]=useState(!runtime&&!initial),[open,setOpen]=useState<string|null>(runtime?.open||null),[articles,setArticles]=useState<Record<string,Row[]>>(runtime?.articles||{}),[articlePages,setArticlePages]=useState<Record<string,FavoriteArticlePage>>(runtime?.articlePages||{}),[articleLoading,setArticleLoading]=useState(false),[query,setQuery]=useState(runtime?.query||""),[savedAt,setSavedAt]=useState(runtime?0:initial?.savedAt||0),[savedTotal,setSavedTotal]=useState(runtime?.rows.length||Number(initial?.value.total||0)),[checking,setChecking]=useState(!runtime),[verifiedAt,setVerifiedAt]=useState(runtime?.at||0);
  const verifiedRevision=useRef(runtime?.revision??null),articleVerified=useRef(new Set(Object.keys(runtime?.articles||{})));
  const mounted=useRef(true),request=useRef(0),articleRequest=useRef(0),openRef=useRef(open),accessEpoch=useRef(0),accessDenied=useRef(false),controllers=useRef(new Set<AbortController>());openRef.current=open;
  const sameScope=()=>mounted.current&&JSON.stringify(favoriteScope())===JSON.stringify(scope);
  const current=()=>sameScope()&&!accessDenied.current;
  const operationCurrent=()=>{const epoch=accessEpoch.current;return()=>current()&&accessEpoch.current===epoch};
  function discardDeniedView(error:unknown){
    passiveDisplay.current=true;FAVORITE_RUNTIME.delete(runtimeKey);articleVerified.current.clear();verifiedRevision.current=null;
    accessDenied.current=true;accessEpoch.current++;request.current++;articleRequest.current++;controllers.current.forEach(controller=>controller.abort());controllers.current.clear();openRef.current=null;
    removeSavedInsightView('favorites-last',scope);setInitial(null);setRows([]);setGroups([]);setAssigned({});setArticles({});setArticlePages({});setFilter("all");setOpen(null);setQuery("");setNewGroup("");setSavedAt(0);setSavedTotal(0);setVerifiedAt(0);setLoading(false);setChecking(false);setArticleLoading(false);setBusy("");setError(error instanceof Error?error.message:"INSIGHT_LOGIN_REQUIRED");
  }
  async function post(endpoint:string,body:Record<string,unknown>){
    if(!current())throw Object.assign(new Error("通信を中断しました"),{name:"AbortError"});
    const controller=new AbortController(),epoch=accessEpoch.current;controllers.current.add(controller);
    try{const value=await requestFavorite(endpoint,body,controller.signal);if(!current()||controller.signal.aborted||epoch!==accessEpoch.current)throw Object.assign(new Error("通信を中断しました"),{name:"AbortError"});return value}
    catch(error){if(sameScope()&&epoch===accessEpoch.current&&favoriteAuthFailure(error))discardDeniedView(error);throw error}
    finally{controllers.current.delete(controller)}
  }
  function invalidateSaved(){FAVORITE_RUNTIME.delete(runtimeKey);verifiedRevision.current=null;passiveDisplay.current=true;request.current++;setLoading(false);setChecking(false);setVerifiedAt(0);removeSavedInsightView('favorites-last',scope)}
  useEffect(()=>{if(!verifiedAt||!current())return;const kept=rows.slice(0,100),keys=new Set(kept.map(r=>String(r.creator_key)));writeSavedInsightView('favorites-last',scope,{rows:kept,groups:groups.slice(0,100),assigned:Object.fromEntries(Object.entries(assigned).filter(([key])=>keys.has(key))),filter,total:rows.length},verifiedAt)},[verifiedAt,rows,groups,assigned,filter]);
  async function refreshArticles(r:Row,force=false,nextPage?:number){
    if(!current())return;
    const key=String(r.creator_key),page=Math.max(1,Math.floor(nextPage??articlePages[key]?.page??1));
    if(!force&&articleVerified.current.has(key)&&page===(articlePages[key]?.page||1))return;
    articleVerified.current.delete(key);
    const id=++articleRequest.current,token=localStorage.getItem(INSIGHT_TOKEN_KEY),epoch=accessEpoch.current,valid=()=>current()&&epoch===accessEpoch.current&&id===articleRequest.current&&localStorage.getItem(INSIGHT_TOKEN_KEY)===token;
    setArticleLoading(true);setError("");
    try{
      const p=await post(EXTRAS,{action:"favorite_articles",creatorKey:key,creatorUrl:r.actor_url,page});
      if(valid()){
        if(!Array.isArray(p?.rows))throw new Error("記事の応答を確認できませんでした");
        articleVerified.current.add(key);
        setArticles(v=>{const entries=Object.entries({...v,[key]:p.rows});while(entries.length>FAVORITE_ARTICLE_LIMIT){const removed=entries.shift();if(removed)articleVerified.current.delete(removed[0]);}return Object.fromEntries(entries)});
        setArticlePages(v=>Object.fromEntries(Object.entries({...v,[key]:{page,hasNext:p.hasNext===true}}).slice(-FAVORITE_ARTICLE_LIMIT)));
      }
    }catch(e){if(valid())setError(e instanceof Error?e.message:"記事を取得できませんでした")}
    finally{if(valid())setArticleLoading(false)}
  }
  async function load(force=false){
    if(!sameScope())return;if(!force&&verifiedRevision.current===revision)return;FAVORITE_RUNTIME.delete(runtimeKey);verifiedRevision.current=null;articleVerified.current.clear();setVerifiedAt(0);accessDenied.current=false;
    const id=++request.current,token=localStorage.getItem(INSIGHT_TOKEN_KEY),epoch=accessEpoch.current,valid=()=>current()&&epoch===accessEpoch.current&&id===request.current&&localStorage.getItem(INSIGHT_TOKEN_KEY)===token;
    articleRequest.current++;setArticleLoading(false);setLoading(true);setChecking(true);setError("");
    const groupResult=post(GROUPS,{action:"list"}).then(value=>({value}),()=>({value:null}));
    try{
      const f=await post(HISTORY,{action:"favorites",page:1,pageSize:100});if(!valid())return;
      if(!Array.isArray(f?.rows))throw new Error('お気に入りの応答を確認できませんでした');const list=f.rows;passiveDisplay.current=true;setRows(list);setLoading(false);
      const selected=list.find((r:Row)=>String(r.creator_key)===openRef.current);if(selected)void refreshArticles(selected,true);else if(openRef.current){openRef.current=null;setOpen(null)}
      const {value:g}=await groupResult;if(!valid())return;if(!g||!Array.isArray(g.definitions)||!Array.isArray(g.assignments))throw new Error('グループの更新を確認できませんでした');
      setGroups((Array.isArray(g?.definitions)?g.definitions:[]).map((x:any)=>clean(x?.name)).filter(Boolean));
      setAssigned(Object.fromEntries((Array.isArray(g?.assignments)?g.assignments:[]).map((x:any)=>[String(x?.creatorKey||""),clean(x?.groupName)]).filter((x:any)=>x[0]&&x[1])));
      verifiedRevision.current=revision;setSavedAt(0);setSavedTotal(list.length);setVerifiedAt(Date.now());
    }catch(e){if(valid())setError(e instanceof Error?e.message:"お気に入りを取得できませんでした")}finally{if(valid()){setLoading(false);setChecking(false)}}
  }
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;request.current++;articleRequest.current++;controllers.current.forEach(controller=>controller.abort());controllers.current.clear()}},[]);
  useEffect(()=>{void load()},[revision]);
  useEffect(()=>{const refresh=()=>{if(current())void load(true)};window.addEventListener("mumei-insight-favorites-changed",refresh);return()=>window.removeEventListener("mumei-insight-favorites-changed",refresh)},[revision]);
  useEffect(()=>{if(runtime?.open){const selected=runtime.rows.find(row=>String(row.creator_key)===runtime.open);if(selected)void refreshArticles(selected)}},[]);
  useEffect(()=>{if(!verifiedAt||verifiedRevision.current!==revision||!current())return;retainFavoriteRuntime(runtimeKey,{revision,at:verifiedAt,rows,groups,assigned,filter,open,articles:Object.fromEntries(Object.entries(articles).filter(([key])=>articleVerified.current.has(key))),articlePages:Object.fromEntries(Object.entries(articlePages).filter(([key])=>articleVerified.current.has(key))),query})},[verifiedAt,rows,groups,assigned,filter,open,articles,articlePages,query,revision]);
  useEffect(()=>{
    const restore=()=>{if(passiveDisplay.current||!current())return;const saved=readSaved();if(!saved)return;passiveDisplay.current=true;setInitial(saved);setRows(saved.value.rows);setGroups(saved.value.groups);setAssigned(saved.value.assigned);setFilter(saved.value.filter||"all");setSavedAt(saved.savedAt);setSavedTotal(Number(saved.value.total||0));setLoading(false)};
    window.addEventListener("mumei-insight-storage-hydrated",restore);restore();
    return()=>window.removeEventListener("mumei-insight-storage-hydrated",restore);
  },[]);

  const counts=useMemo(()=>Object.fromEntries(groups.map(g=>[g,rows.filter(r=>assigned[String(r.creator_key)]===g).length])),[groups,rows,assigned]);
  const visible=useMemo(()=>rows.filter(r=>filter==="all"||(filter==="ungrouped"?!assigned[String(r.creator_key)]:assigned[String(r.creator_key)]===filter)),[rows,filter,assigned]);
  async function create(){const valid=operationCurrent();if(!valid())return;const name=clean(newGroup);if(!name)return;invalidateSaved();setBusy("create");setError("");try{await post(GROUPS,{action:"create",name});if(!valid())return;if(!groups.includes(name))setGroups(v=>[...v,name]);setNewGroup("");setFilter(name)}catch(e){if(valid())setError(e instanceof Error?e.message:"グループを作れませんでした")}finally{if(valid())setBusy("")}}
  async function assign(r:Row,name:string){const valid=operationCurrent();if(!valid())return;const key=String(r.creator_key),prev=assigned[key]||"",next=clean(name);invalidateSaved();setAssigned(v=>{const x={...v};if(next)x[key]=next;else delete x[key];return x});setBusy(`assign:${key}`);try{await post(GROUPS,{action:"assign",creatorKey:key,groupName:next||null});if(!valid())return;if(next&&!groups.includes(next))setGroups(v=>[...v,next])}catch(e){if(valid()){setAssigned(v=>{const x={...v};if(prev)x[key]=prev;else delete x[key];return x});setError(e instanceof Error?e.message:"グループ割当を保存できませんでした")}}finally{if(valid())setBusy("")}}
  async function rename(name:string){const valid=operationCurrent();if(!valid())return;const to=clean(prompt("新しいグループ名",name)||"");if(!to||to===name)return;invalidateSaved();setBusy(`rename:${name}`);try{await post(GROUPS,{action:"rename",from:name,to});if(!valid())return;setGroups(v=>v.map(x=>x===name?to:x));setAssigned(v=>Object.fromEntries(Object.entries(v).map(([k,g])=>[k,g===name?to:g])));if(filter===name)setFilter(to)}catch(e){if(valid())setError(e instanceof Error?e.message:"名称変更できませんでした")}finally{if(valid())setBusy("")}}
  async function removeGroup(name:string){const valid=operationCurrent();if(!valid())return;if(!confirm(`「${name}」を削除しますか？\n所属クリエイターは未分類に戻ります。`))return;invalidateSaved();setBusy(`delete:${name}`);try{await post(GROUPS,{action:"delete",name});if(!valid())return;setGroups(v=>v.filter(x=>x!==name));setAssigned(v=>Object.fromEntries(Object.entries(v).filter(([,g])=>g!==name)));if(filter===name)setFilter("all")}catch(e){if(valid())setError(e instanceof Error?e.message:"グループ削除できませんでした")}finally{if(valid())setBusy("")}}
  async function removeFavorite(r:Row){const valid=operationCurrent();if(!valid())return;const key=String(r.creator_key);if(busy)return;invalidateSaved();setBusy(`remove:${key}`);setError("");try{await post(HISTORY,{action:"favorite_toggle",creatorKey:key,favorite:false});if(!valid())return;setRows(v=>v.filter(x=>String(x.creator_key)!==key));setAssigned(v=>{const next={...v};delete next[key];return next});setArticles(v=>{const next={...v};delete next[key];return next});setArticlePages(v=>{const next={...v};delete next[key];return next});if(open===key)setOpen(null)}catch(e){if(valid())setError(e instanceof Error?e.message:"お気に入りを解除できませんでした")}finally{if(valid())setBusy("")}}
  async function loadArticles(r:Row){if(!current())return;const key=String(r.creator_key);if(openRef.current===key){openRef.current=null;setOpen(null);articleRequest.current++;setArticleLoading(false);return}openRef.current=key;setOpen(key);await refreshArticles(r)}
  async function setRead(r:Row,a:Row,read:boolean){const valid=operationCurrent();if(!valid())return;invalidateSaved();articleRequest.current++;setArticleLoading(false);articleVerified.current.delete(String(r.creator_key));const key=String(r.creator_key),previous=Boolean(a.read);setError("");setArticles(v=>({...v,[key]:(v[key]||[]).map(x=>x.key===a.key?{...x,read}:x)}));try{await post(EXTRAS,{action:"favorite_read_set",creatorKey:key,creatorUrl:r.actor_url,articleKey:a.key,articleUrl:a.url,read})}catch{if(valid()){setArticles(v=>({...v,[key]:(v[key]||[]).map(x=>x.key===a.key?{...x,read:previous}:x)}));setError("既読状態を保存できませんでした。もう一度お試しください。")}}}
  return <section className="miff" onClickCapture={()=>{passiveDisplay.current=true}} onInputCapture={()=>{passiveDisplay.current=true}}><header className="miff-head"><div><small>FAVORITE CREATOR GROUPS</small><h2>お気に入り・グループ管理</h2><p>通知フィルターのグループとは別。お気に入りクリエイターをグループ分けし、INSIGHTアカウントごとにサーバー保存します。</p></div><button disabled={loading} onClick={()=>void load(true)}>再読込</button></header>
    <div className="miff-create"><input value={newGroup} onChange={e=>setNewGroup(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();void create()}}} placeholder="例：必ず読む / AI / 仲間"/><button disabled={busy==="create"||!clean(newGroup)} onClick={()=>void create()}>{busy==="create"?"作成中…":"＋ グループ作成"}</button></div>
    <div className="miff-tabs"><button className={filter==="all"?"active":""} onClick={()=>setFilter("all")}>すべて <b>{rows.length}</b></button><button className={filter==="ungrouped"?"active":""} onClick={()=>setFilter("ungrouped")}>未分類 <b>{rows.filter(r=>!assigned[String(r.creator_key)]).length}</b></button>{groups.map(g=><button key={g} className={filter===g?"active":""} onClick={()=>setFilter(g)}>{g} <b>{counts[g]||0}</b></button>)}</div>
    {groups.length?<section className="miff-group-manage"><header><b>グループ管理</b><small>削除すると所属クリエイターは「未分類」に戻ります。</small></header><div>{groups.map(g=><article key={g}><button className="group-open" onClick={()=>setFilter(g)}><b>{g}</b><small>{counts[g]||0}人</small></button><div><button disabled={busy===`rename:${g}`} onClick={()=>void rename(g)}>名前変更</button><button className="danger" disabled={busy===`delete:${g}`} onClick={()=>void removeGroup(g)}>{busy===`delete:${g}`?"削除中…":"グループ削除"}</button></div></article>)}</div></section>:null}
    {savedAt?<p className="miff-empty" role="status">前回表示分 {rows.length} / {savedTotal}人・{checking?'最新確認中':'最新確認できず'}（確認 {date(new Date(savedAt).toISOString())}）</p>:null}
    {error?<p className="miff-error">{error}</p>:null}
    {loading&&!rows.length&&!savedAt?<p className="miff-empty">お気に入りを読み込み中…</p>:visible.length?<div className="miff-list">{visible.map(r=>{const key=String(r.creator_key),g=assigned[key]||"",list=(articles[key]||[]).filter(a=>!query||String(a.title||"").toLowerCase().includes(query.toLowerCase())||String(a.excerpt||"").toLowerCase().includes(query.toLowerCase()));return <article className="miff-creator" key={key}><div className="miff-person"><Avatar row={r}/><div><b>{r.actor_name||"noteユーザー"}</b>{r.actor_url?<a href={r.actor_url} target="_blank" rel="noreferrer">プロフィール ↗</a>:null}<em className={g?"":"none"}>{g||"未分類"}</em></div></div><div className="miff-actions"><label><span>グループ</span><select value={g} disabled={busy===`assign:${key}`} onChange={e=>void assign(r,e.target.value)}><option value="">未分類</option>{groups.map(x=><option key={x} value={x}>{x}</option>)}</select></label><button className="miff-remove" disabled={Boolean(busy)} aria-label={`${r.actor_name||"この人"}をお気に入りから外す`} onClick={()=>void removeFavorite(r)}>{busy===`remove:${key}`?"解除中…":"★ 解除"}</button><button onClick={()=>void loadArticles(r)}>{open===key?"記事を閉じる":"記事を見る"}</button></div>{open===key?<div className="miff-articles"><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="このページの記事を検索" aria-label="このページの記事を検索"/>{articleLoading&&!articles[key]?<p className="miff-empty">記事を取得中…</p>:list.length?<div>{list.map(a=><article key={a.key}><a href={a.url} target="_blank" rel="noreferrer" onClick={()=>void setRead(r,a,true)}>{a.thumbnail?<img src={a.thumbnail} alt="" referrerPolicy="no-referrer"/>:<span/>}<div><small>{a.read?"既読":"● 未読"}・{date(a.publishedAt)}</small><b>{a.title}</b><em>♡ {Number(a.likeCount||0)}　💬 {Number(a.commentCount||0)}</em></div></a><button onClick={()=>void setRead(r,a,!a.read)}>{a.read?"未読に戻す":"既読にする"}</button></article>)}</div>:<p className="miff-empty">{query?"このページに条件に合う記事はありません。":"このページの記事はありません。"}</p>}<nav className="miff-article-pager" aria-label="お気に入り記事のページ送り"><button disabled={articleLoading||(articlePages[key]?.page||1)<=1} onClick={()=>void refreshArticles(r,true,(articlePages[key]?.page||1)-1)}>← 新しい記事</button><span role="status">{articleLoading?"確認中…":`記事ページ ${articlePages[key]?.page||1}`}</span><button disabled={articleLoading||!articlePages[key]?.hasNext} onClick={()=>void refreshArticles(r,true,(articlePages[key]?.page||1)+1)}>古い記事 →</button></nav></div>:null}</article>})}</div>:<p className="miff-empty">{rows.length?"このグループにはまだクリエイターがいません。":"お気に入りはまだありません。スキ履歴やランキングの☆から登録できます。"}</p>}
  </section>;
}
