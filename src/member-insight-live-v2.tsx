import { useEffect, useMemo, useRef, useState } from "react";
import { INSIGHT_TOKEN_KEY } from "./insight-account-store";
import { MemberInsightUnifiedV4 } from "./member-insight-unified-v4";
import { AnalysisDashboardV2 } from "./member-insight-analysis-v2";
import "./member-insight-hotfix.css";
import "./member-insight-live-v2.css";

const MEMBER="https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-member-api";
const RELATIONS="https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-relations";
const SOCIAL="https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-social-v2";
const DASHBOARD="https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-dashboard-data";
const AUTO_MS=120_000;
const QUIET_MS=2_500;

type Row=Record<string,any>;
async function post(endpoint:string,action:string,extra:Record<string,unknown>={},timeout=45_000){
  const token=localStorage.getItem(INSIGHT_TOKEN_KEY)||"";
  if(!token)throw new Error("INSIGHT_LOGIN_REQUIRED");
  const c=new AbortController(),timer=window.setTimeout(()=>c.abort(),timeout);
  try{
    const r=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json","X-Insight-Token":token},body:JSON.stringify({action,...extra}),cache:"no-store",signal:c.signal});
    const p=await r.json().catch(()=>({}));
    if(!r.ok||p?.ok===false)throw new Error(p?.error||"INSIGHT_API_ERROR");
    return p;
  }finally{window.clearTimeout(timer)}
}
const fmt=(v:any)=>new Intl.NumberFormat("ja-JP").format(Number(v||0));
const when=(v:any)=>{if(!v)return"—";const d=new Date(String(v));return Number.isNaN(d.getTime())?String(v):new Intl.DateTimeFormat("ja-JP",{timeZone:"Asia/Tokyo",month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"}).format(d)};

function Sparkline({rows,field}:{rows:Row[];field:string}){
  const data=rows.map(r=>Number(r[field])).filter(Number.isFinite);
  if(data.length<2)return <div className="miv5-chart-empty">推移データを蓄積中</div>;
  const min=Math.min(...data),max=Math.max(...data),span=Math.max(1,max-min),w=520,h=150,p=10;
  const points=data.map((v,i)=>`${p+(w-p*2)*(i/Math.max(1,data.length-1))},${h-p-(h-p*2)*((v-min)/span)}`).join(" ");
  return <svg className="miv5-chart" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`${field} 推移`}><polyline points={points} fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
function Delta({now,prev}:{now:number;prev:number}){const d=now-prev;return <span className={d>0?"up":d<0?"down":"flat"}>{d>0?"+":""}{fmt(d)}</span>}

function AnalysisPanel({revision}:{revision:number}){
  const[data,setData]=useState<any>(null),[loading,setLoading]=useState(true),[error,setError]=useState("");
  async function load(){setLoading(true);setError("");try{setData(await post(DASHBOARD,"analysis",{days:90},40_000))}catch(e){setError(e instanceof Error?e.message:"分析を読み込めませんでした")}finally{setLoading(false)}}
  useEffect(()=>{void load()},[revision]);
  if(loading&&!data)return <section className="miv5-analysis"><p>分析グラフを集計中…</p></section>;
  if(error&&!data)return <section className="miv5-analysis"><p className="err">{error}</p><button onClick={()=>void load()}>再読込</button></section>;
  const c=data?.comparison||{},series=data?.series||[],followers=data?.followers||[],dash=data?.dashboard||[],latest=data?.latestDashboard;
  return <section className="miv5-analysis">
    <header><div><small>INSIGHT ANALYTICS</small><h2>推移グラフ分析</h2></div><button onClick={()=>void load()}>再集計</button></header>
    <div className="miv5-compare">
      <article><small>直近7日 スキ</small><b>{fmt(c.likes7)}</b><Delta now={Number(c.likes7||0)} prev={Number(c.likesPrev7||0)}/></article>
      <article><small>直近7日 コメント</small><b>{fmt(c.comments7)}</b><Delta now={Number(c.comments7||0)} prev={Number(c.commentsPrev7||0)}/></article>
      <article><small>直近7日 返信</small><b>{fmt(c.replies7)}</b><Delta now={Number(c.replies7||0)} prev={Number(c.repliesPrev7||0)}/></article>
      <article><small>ダッシュボード VIEW</small><b>{latest?fmt(latest.views):"未同期"}</b><span>{latest?when(latest.capturedAt):"note統計同期後に表示"}</span></article>
    </div>
    <div className="miv5-graphs">
      <article><div><b>スキ推移</b><small>日別の新規スキ</small></div><Sparkline rows={series} field="likes"/></article>
      <article><div><b>コメント推移</b><small>日別の初手コメント</small></div><Sparkline rows={series} field="comments"/></article>
      <article><div><b>フォロワー推移</b><small>完全同期・公式総数</small></div><Sparkline rows={followers} field="count"/></article>
      <article><div><b>VIEW推移</b><small>noteダッシュボード保存値</small></div><Sparkline rows={dash} field="views"/></article>
    </div>
    {(data?.topArticles||[]).length?<div className="miv5-toparticles"><h3>記事パフォーマンス TOP</h3>{data.topArticles.slice(0,12).map((r:Row,i:number)=><a key={r.article_key||i} href={r.url||undefined} target={r.url?"_blank":undefined} rel="noreferrer"><em>{i+1}</em><span><b>{r.title||"記事"}</b><small>VIEW {fmt(r.views)}　♡ {fmt(r.likes)}　💬 {fmt(r.comments)}</small></span></a>)}</div>:null}
  </section>;
}

function SocialV2Panel({revision}:{revision:number}){
  const[direction,setDirection]=useState("followers"),[mode,setMode]=useState("current"),[change,setChange]=useState("all"),[rows,setRows]=useState<Row[]>([]),[meta,setMeta]=useState<any>(null),[page,setPage]=useState(1),[loading,setLoading]=useState(true),[error,setError]=useState("");
  async function load(p=1){setLoading(true);setError("");try{const x=await post(SOCIAL,mode==="changes"?"changes":"current",{direction,change,page:p,pageSize:100},35_000);setRows(x.rows||[]);setMeta(x);setPage(p)}catch(e){setError(e instanceof Error?e.message:"フォロー情報を読めませんでした")}finally{setLoading(false)}}
  useEffect(()=>{void load(1)},[direction,mode,change,revision]);
  const pages=Math.max(1,Math.ceil(Number(meta?.total||0)/100));
  return <section className="miv5-social">
    <header><div><small>SOCIAL LIVE</small><h2>フォロー・フォロワー 最新</h2></div><button onClick={()=>void load(page)}>再読込</button></header>
    <div className="miv5-tabs"><button className={direction==="followers"?"active":""} onClick={()=>setDirection("followers")}>フォロワー</button><button className={direction==="followings"?"active":""} onClick={()=>setDirection("followings")}>フォロー中</button><button className={mode==="current"?"active":""} onClick={()=>setMode("current")}>現在</button><button className={mode==="changes"?"active":""} onClick={()=>setMode("changes")}>増減</button>{mode==="changes"?<><button className={change==="added"?"active":""} onClick={()=>setChange("added")}>増えた</button><button className={change==="removed"?"active":""} onClick={()=>setChange("removed")}>減った</button></>:null}</div>
    {meta?<div className="miv5-socialmeta"><b>公式総数 {fmt(meta.officialTotal)}</b><span>名前取得 {fmt(meta.namedCount??meta.total)}人</span><span>前回比 {Number(meta.netDelta||0)>0?"+":""}{fmt(meta.netDelta||0)}</span><span>最終同期 {when(meta.scannedAt)}</span></div>:null}
    {meta?.message?<p className="miv5-note">{meta.message}</p>:null}{error?<p className="err">{error}</p>:null}
    {loading&&!rows.length?<p>読込中…</p>:<div className="miv5-people">{rows.map((r,i)=>{const name=r.actor_name||"noteユーザー",url=r.actor_url,image=r.actor_image_url;return <article key={r.id||r.person_key||i}>{image?<img src={image} alt="" loading="lazy" referrerPolicy="no-referrer"/>:<span className="face">{[...name][0]}</span>}<div><b>{name}</b>{url?<a href={url} target="_blank" rel="noreferrer">プロフィール ↗</a>:null}<small>{mode==="changes"?`${r.event_type==="removed"?"減少":"追加"}・${when(r.detected_at)}`:`確認 ${when(r.last_seen_at)}`}</small></div></article>})}</div>}
    {pages>1?<div className="miv5-pager"><button disabled={page<=1} onClick={()=>void load(page-1)}>←</button><b>{page}/{pages}</b><button disabled={page>=pages} onClick={()=>void load(page+1)}>→</button></div>:null}
  </section>;
}

export function MemberInsightLiveV2(){
  const[revision,setRevision]=useState(0),[status,setStatus]=useState("公開データは自動更新中"),[manualBusy,setManualBusy]=useState(false),[analysis,setAnalysis]=useState(false),[social,setSocial]=useState(false);
  const running=useRef(false),lastInteraction=useRef(Date.now()),lastRun=useRef(0);
  async function publicSync(force=false){
    if(running.current)return false;
    const now=Date.now();
    if(!force&&(document.visibilityState!=="visible"||now-lastInteraction.current<QUIET_MS||now-lastRun.current<AUTO_MS))return false;
    running.current=true;lastRun.current=now;
    try{const p=await post(MEMBER,"sync",{},75_000);setStatus(`自動更新済み・記事${fmt(p.scannedArticles||0)}件 / 履歴ページ${fmt(p.historyPage||0)}`);setRevision(v=>v+1);return true}
    catch(e){setStatus(`自動更新は次回再試行：${e instanceof Error?e.message:"一時エラー"}`);return false}
    finally{running.current=false}
  }
  async function manualRefresh(){
    if(manualBusy)return;setManualBusy(true);setStatus("公開履歴を更新中…");
    try{
      await publicSync(true);
      setStatus("フォロー・フォロワーを最新照合中…");
      try{await post(RELATIONS,"sync",{},120_000)}catch{/* relation cron remains a safety net */}
      setRevision(v=>v+1);
      setStatus("最新版アプリを確認中…");
      if("serviceWorker" in navigator){const regs=await navigator.serviceWorker.getRegistrations();await Promise.all(regs.filter(r=>r.scope.includes("/note-insight/")).map(r=>r.update().catch(()=>undefined)))}
      await fetch(`./?app-check=${Date.now()}`,{cache:"no-store"}).catch(()=>undefined);
      setStatus("データ・アプリ最新版を更新しました");
      window.setTimeout(()=>{const u=new URL(location.href);u.searchParams.set("refresh",String(Date.now()));u.hash="dashboard";location.replace(u.toString())},450);
    }catch(e){setStatus(e instanceof Error?`更新エラー：${e.message}`:"更新エラー");setManualBusy(false)}
  }
  useEffect(()=>{
    const touch=()=>{lastInteraction.current=Date.now()};
    window.addEventListener("pointerdown",touch,{passive:true});window.addEventListener("touchstart",touch,{passive:true});window.addEventListener("wheel",touch,{passive:true});window.addEventListener("scroll",touch,{passive:true});
    const first=window.setTimeout(()=>void publicSync(true),3000);
    const timer=window.setInterval(()=>void publicSync(false),15_000);
    const visible=()=>{if(document.visibilityState==="visible")window.setTimeout(()=>void publicSync(false),QUIET_MS)};
    document.addEventListener("visibilitychange",visible);
    return()=>{window.clearTimeout(first);window.clearInterval(timer);window.removeEventListener("pointerdown",touch);window.removeEventListener("touchstart",touch);window.removeEventListener("wheel",touch);window.removeEventListener("scroll",touch);document.removeEventListener("visibilitychange",visible)};
  },[]);
  function capture(e:React.MouseEvent){const t=e.target as HTMLElement;if(!t.closest(".miu-nav"))return;const label=t.closest("button")?.textContent?.trim()||"";setAnalysis(false);setSocial(label==="フォロー")}
  const mode=analysis?"analysis":social?"social":"normal";
  return <div className={`miv5 ${mode}`} onClickCapture={capture}>
    <section className="miv5-update"><div><b>AUTO SYNC</b><span>{status}</span><small>公開データはバックグラウンド＋画面表示中2分ごとに継続取得。本人限定の購入・メンシプ等は通知ベル同期。</small></div><div><button className={analysis?"active":""} onClick={()=>{setAnalysis(v=>!v);setSocial(false)}}>推移分析</button><button className="primary" disabled={manualBusy} onClick={()=>void manualRefresh()}>{manualBusy?"更新中…":"データ＋最新版 更新"}</button></div></section>
    <MemberInsightUnifiedV4 revision={revision}/>
    {analysis?<AnalysisDashboardV2 revision={revision}/>:social?<SocialV2Panel revision={revision}/>:null}
  </div>;
}
