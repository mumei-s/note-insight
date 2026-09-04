import { useEffect, useMemo, useState } from "react";
import { INSIGHT_TOKEN_KEY } from "./insight-account-store";
import "./member-insight-analysis-v2.css";

const DASHBOARD="https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-dashboard-data";
type Row=Record<string,any>;
type RangeDays=30|90|180;
type LineDef={key:string;label:string;color:string};

async function post(action:string,extra:Record<string,unknown>={}){
  const token=localStorage.getItem(INSIGHT_TOKEN_KEY)||"";
  if(!token)throw new Error("INSIGHT_LOGIN_REQUIRED");
  const c=new AbortController(),timer=window.setTimeout(()=>c.abort(),40_000);
  try{
    const r=await fetch(DASHBOARD,{method:"POST",headers:{"Content-Type":"application/json","X-Insight-Token":token},body:JSON.stringify({action,...extra}),cache:"no-store",signal:c.signal});
    const p=await r.json().catch(()=>({}));
    if(!r.ok||p?.ok===false)throw new Error(p?.error||"INSIGHT_API_ERROR");
    return p;
  }finally{window.clearTimeout(timer)}
}

const fmt=(v:any)=>new Intl.NumberFormat("ja-JP").format(Number(v||0));
const compact=(v:number)=>new Intl.NumberFormat("ja-JP",{notation:"compact",maximumFractionDigits:1}).format(v);
const when=(v:any)=>{if(!v)return"—";const d=new Date(String(v));return Number.isNaN(d.getTime())?String(v):new Intl.DateTimeFormat("ja-JP",{timeZone:"Asia/Tokyo",month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"}).format(d)};
const shortDay=(v:string)=>{const d=new Date(`${v}T12:00:00+09:00`);return Number.isNaN(d.getTime())?v:new Intl.DateTimeFormat("ja-JP",{timeZone:"Asia/Tokyo",month:"numeric",day:"numeric"}).format(d)};
const jstKey=(ms:number)=>new Date(ms+9*60*60*1000).toISOString().slice(0,10);

function Delta({now,prev}:{now:number;prev:number}){
  const d=now-prev,pct=prev>0?(d/prev)*100:null;
  return <span className={d>0?"iad-up":d<0?"iad-down":"iad-flat"}>{d>0?"▲ ":d<0?"▼ ":"— "}{d>0?"+":""}{fmt(d)}{pct!=null?` (${pct>0?"+":""}${pct.toFixed(0)}%)`:""}</span>;
}

function fillDaily(raw:Row[],days:number){
  const map=new Map(raw.map(r=>[String(r.date),r]));
  const out:Row[]=[];
  const today=Date.now();
  for(let i=days-1;i>=0;i--){const date=jstKey(today-i*86400000),r=map.get(date)||{};out.push({date,likes:Number(r.likes||0),comments:Number(r.comments||0),replies:Number(r.replies||0)});}
  return out;
}

function LineChart({rows,defs,zeroBase=true,aria}:{rows:Row[];defs:LineDef[];zeroBase?:boolean;aria:string}){
  const clean=rows.filter(r=>r?.date&&defs.some(d=>Number.isFinite(Number(r[d.key]))));
  if(clean.length<2)return <div className="iad-empty-chart">推移データを蓄積中</div>;
  const W=760,H=280,L=54,R=16,T=18,B=42;
  const vals=clean.flatMap(r=>defs.map(d=>Number(r[d.key])).filter(Number.isFinite));
  let min=zeroBase?0:Math.min(...vals),max=Math.max(...vals);
  if(!zeroBase){const pad=Math.max(1,(max-min)*.12);min=Math.max(0,min-pad);max+=pad;}
  if(max<=min)max=min+1;
  const x=(i:number)=>L+(W-L-R)*(i/Math.max(1,clean.length-1));
  const y=(v:number)=>T+(H-T-B)*(1-(v-min)/(max-min));
  const tickCount=4;
  const xTicks=[0,Math.floor((clean.length-1)*.25),Math.floor((clean.length-1)*.5),Math.floor((clean.length-1)*.75),clean.length-1].filter((v,i,a)=>a.indexOf(v)===i);
  return <div className="iad-line-wrap"><svg className="iad-line" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={aria}>
    {Array.from({length:tickCount+1},(_,i)=>{const v=min+(max-min)*(i/tickCount),yy=y(v);return <g key={i}><line x1={L} x2={W-R} y1={yy} y2={yy} className="iad-gridline"/><text x={L-8} y={yy+4} textAnchor="end" className="iad-axis">{compact(v)}</text></g>})}
    {xTicks.map(i=><text key={i} x={x(i)} y={H-12} textAnchor="middle" className="iad-axis">{shortDay(String(clean[i].date))}</text>)}
    {defs.map(def=>{const pts=clean.map((r,i)=>`${x(i)},${y(Number(r[def.key]||0))}`).join(" ");return <g key={def.key}><polyline points={pts} fill="none" stroke={def.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>{clean.map((r,i)=>{const v=Number(r[def.key]||0);return <circle key={i} cx={x(i)} cy={y(v)} r="5" fill="transparent"><title>{`${shortDay(String(r.date))} ${def.label}: ${fmt(v)}`}</title></circle>})}</g>})}
  </svg><div className="iad-legend">{defs.map(d=><span key={d.key}><i style={{background:d.color}}/>{d.label}</span>)}</div></div>;
}

function Donut({items}:{items:{label:string;value:number;color:string}[]}){
  const total=items.reduce((s,x)=>s+x.value,0);
  if(total<=0)return <div className="iad-donut-empty">直近7日の反応を蓄積中</div>;
  let cursor=0;
  const stops=items.filter(x=>x.value>0).map(x=>{const from=cursor,to=cursor+(x.value/total)*360;cursor=to;return `${x.color} ${from}deg ${to}deg`;}).join(",");
  return <div className="iad-donut-block"><div className="iad-donut" style={{background:`conic-gradient(${stops})`}}><div><b>{fmt(total)}</b><small>反応</small></div></div><div className="iad-donut-legend">{items.map(x=><div key={x.label}><span><i style={{background:x.color}}/>{x.label}</span><b>{fmt(x.value)}</b><small>{total?`${Math.round(x.value/total*100)}%`:"0%"}</small></div>)}</div></div>;
}

function Kpi({label,value,sub,accent}:{label:string;value:string;sub:string;accent?:string}){
  return <article className="iad-kpi" style={accent?{"--accent":accent} as React.CSSProperties:undefined}><small>{label}</small><b>{value}</b><span>{sub}</span></article>;
}

export function AnalysisDashboardV2({revision}:{revision:number}){
  const[days,setDays]=useState<RangeDays>(90),[data,setData]=useState<any>(null),[loading,setLoading]=useState(true),[error,setError]=useState("");
  async function load(){setLoading(true);setError("");try{setData(await post("analysis",{days}))}catch(e){setError(e instanceof Error?e.message:"分析を読み込めませんでした")}finally{setLoading(false)}}
  useEffect(()=>{void load()},[revision,days]);
  const daily=useMemo(()=>fillDaily(data?.series||[],days),[data,days]);
  const followers=useMemo(()=>{const cutoff=Date.now()-days*86400000;return (data?.followers||[]).filter((r:Row)=>Date.parse(String(r.at||`${r.date}T12:00:00+09:00`))>=cutoff);},[data,days]);
  const dash=useMemo(()=>{const cutoff=Date.now()-days*86400000;return (data?.dashboard||[]).filter((r:Row)=>Date.parse(String(r.at||`${r.date}T12:00:00+09:00`))>=cutoff);},[data,days]);
  if(loading&&!data)return <section className="miv5-analysis iad"><p>分析ダッシュボードを集計中…</p></section>;
  if(error&&!data)return <section className="miv5-analysis iad"><p className="err">{error}</p><button onClick={()=>void load()}>再読込</button></section>;
  const c=data?.comparison||{},latest=data?.latestDashboard||null,latestFollower=followers.at(-1)?.count??data?.followers?.at(-1)?.count??null;
  const latestViewDelta=dash.length>=2?Number(dash.at(-1)?.views||0)-Number(dash.at(-2)?.views||0):0;
  const reactionItems=[{label:"スキ",value:Number(c.likes7||0),color:"#65d7ff"},{label:"コメント",value:Number(c.comments7||0),color:"#b6ff38"},{label:"返信",value:Number(c.replies7||0),color:"#ffb463"}];
  const maxView=Math.max(1,...(data?.topArticles||[]).slice(0,10).map((r:Row)=>Number(r.views||0)));
  return <section className="miv5-analysis iad">
    <header className="iad-head"><div><small>INSIGHT ANALYTICS</small><h2>データ分析ダッシュボード</h2><p>note統計とINSIGHT履歴を分けて、同じ時間軸で確認できます。</p></div><div className="iad-actions"><div className="iad-range">{([30,90,180] as RangeDays[]).map(x=><button key={x} className={days===x?"active":""} onClick={()=>setDays(x)}>{x}日</button>)}</div><button onClick={()=>void load()}>再集計</button></div></header>

    <div className="iad-kpis">
      <Kpi label="TOTAL VIEW" value={latest?fmt(latest.views):"未同期"} sub={latest?`最終同期 ${when(latest.capturedAt)}`:"通知・統計同期後に表示"} accent="#65d7ff"/>
      <Kpi label="DASHBOARD ♡" value={latest?fmt(latest.likes):"—"} sub="noteダッシュボード累計" accent="#ff7fae"/>
      <Kpi label="DASHBOARD 💬" value={latest?fmt(latest.comments):"—"} sub="noteダッシュボード累計" accent="#ffb463"/>
      <Kpi label="FOLLOWERS" value={latestFollower!=null?fmt(latestFollower):"—"} sub="公式総数の最新同期" accent="#b6ff38"/>
    </div>

    <div className="iad-compare">
      <article><span><small>直近7日 スキ</small><b>{fmt(c.likes7)}</b></span><Delta now={Number(c.likes7||0)} prev={Number(c.likesPrev7||0)}/></article>
      <article><span><small>直近7日 コメント</small><b>{fmt(c.comments7)}</b></span><Delta now={Number(c.comments7||0)} prev={Number(c.commentsPrev7||0)}/></article>
      <article><span><small>直近7日 返信</small><b>{fmt(c.replies7)}</b></span><Delta now={Number(c.replies7||0)} prev={Number(c.repliesPrev7||0)}/></article>
      <article><span><small>最新VIEW増分</small><b>{latestViewDelta>0?`+${fmt(latestViewDelta)}`:fmt(latestViewDelta)}</b></span><em>前回統計同期との差</em></article>
    </div>

    <div className="iad-main-grid">
      <article className="iad-chart-card wide"><header><div><b>反応の日別推移</b><small>スキ・初手コメント・返信を同じ日付軸で比較</small></div></header><LineChart rows={daily} defs={[{key:"likes",label:"スキ",color:"#65d7ff"},{key:"comments",label:"コメント",color:"#b6ff38"},{key:"replies",label:"返信",color:"#ffb463"}]} aria="日別のスキ・コメント・返信推移"/></article>
      <article className="iad-chart-card"><header><div><b>直近7日の反応構成</b><small>反応の割合を円グラフで表示</small></div></header><Donut items={reactionItems}/></article>
      <article className="iad-chart-card"><header><div><b>フォロワー推移</b><small>完全同期で取得した公式総数</small></div></header><LineChart rows={followers} defs={[{key:"count",label:"フォロワー",color:"#b6ff38"}]} zeroBase={false} aria="フォロワー総数推移"/></article>
      <article className="iad-chart-card wide"><header><div><b>VIEW累計推移</b><small>noteダッシュボード保存値。右肩上がりが正常です</small></div></header><LineChart rows={dash} defs={[{key:"views",label:"VIEW累計",color:"#65d7ff"}]} zeroBase={false} aria="VIEW累計推移"/></article>
    </div>

    {(data?.topArticles||[]).length?<section className="iad-top"><header><div><small>ARTICLE PERFORMANCE</small><h3>記事パフォーマンス TOP10</h3></div><span>最新ダッシュボード基準</span></header><div>{data.topArticles.slice(0,10).map((r:Row,i:number)=><a key={r.article_key||i} href={r.url||undefined} target={r.url?"_blank":undefined} rel="noreferrer"><em>{i+1}</em><div><b>{r.title||"記事"}</b><span className="iad-bar"><i style={{width:`${Math.max(2,Number(r.views||0)/maxView*100)}%`}}/></span><small>VIEW {fmt(r.views)}　♡ {fmt(r.likes)}　💬 {fmt(r.comments)}</small></div></a>)}</div></section>:null}
    {error?<p className="err">{error}</p>:null}
  </section>;
}
