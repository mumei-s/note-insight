import { useVisibleMotion } from "./insight-visible-motion";
import { InsightColumns, InsightScatter } from "./member-insight-analysis-charts";
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { INSIGHT_TOKEN_KEY, currentStoredInsightAccount } from "./insight-account-store";
import { CURRENT_DASHBOARD_VERSION, CURRENT_INSIGHT_APP_VERSION, CURRENT_NOTIFICATION_VERSION } from "./insight-release";
import "./member-insight-analytics-pro-v3.css";
import { loadNotificationSummary } from "./member-insight-analysis-summary-client";
import { InsightDonut } from "./member-insight-analysis-donut";
import { ArticleRanking } from "./member-insight-analysis-ranking";
import { SavedHistory } from "./member-insight-analysis-history";
import { GrowthAnalysis } from "./member-insight-analysis-growth";

const DASH="https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-dashboard-data";
const CACHE_PREFIX="mumei-insight-pro-cache-v3:";
type Period="week"|"month"|"all";
const PERIODS:Record<Period,string>={week:"7日",month:"28日",all:"全期間"};
function preferredPeriod():Period{try{const q=new URL(location.href).searchParams.get("insightPeriod")||localStorage.getItem("mumei-analysis-period:"+currentStoredInsightAccount()?.noteId);return q==="all"||q==="week"?q:"month"}catch{return"month"}}
const CACHE_MAX_AGE=7*24*60*60*1000;
type Row=Record<string,any>;
type Article=Row&{pageViews:number;impressions:number;likes:number;comments:number;salesYen:number;conversion:number|null;reactionsPer1k:number|null;revenuePer1k:number|null;score:number};
const nf=new Intl.NumberFormat("ja-JP");
const yen=new Intl.NumberFormat("ja-JP",{style:"currency",currency:"JPY",maximumFractionDigits:0});
const num=(v:any)=>Number.isFinite(Number(v))?Number(v):0;
const n=(v:any)=>nf.format(Math.round(num(v)));
const money=(v:any)=>yen.format(Math.round(num(v)));
const pct=(v:any,d=1)=>v==null||!Number.isFinite(Number(v))?"—":`${Number(v).toFixed(d)}%`;
const short=(v:any,len=40)=>{const s=String(v||"無題").replace(/\s+/g," ").trim();return s.length>len?s.slice(0,len-1)+"…":s};
const avg=(a:number[])=>a.length?a.reduce((s,v)=>s+v,0)/a.length:0;
const sum=(a:number[])=>a.reduce((s,v)=>s+v,0);
function median(a:number[]){const x=a.filter(Number.isFinite).sort((p,q)=>p-q);if(!x.length)return 0;const m=Math.floor(x.length/2);return x.length%2?x[m]:(x[m-1]+x[m])/2}
function q75(a:number[]){const x=a.filter(Number.isFinite).sort((p,q)=>p-q);if(!x.length)return 0;return x[Math.min(x.length-1,Math.floor((x.length-1)*.75))]}
function percentile(a:number[],v:number){if(!a.length)return 50;let lo=0,hi=a.length;while(lo<hi){const mid=(lo+hi)>>>1;if(a[mid]<=v)lo=mid+1;else hi=mid}return lo/a.length*100}
function deltaPct(now:number,prev:number){if(!prev)return now?100:0;return (now-prev)/Math.abs(prev)*100}
function jtime(v:any){const d=new Date(String(v||""));if(Number.isNaN(d.getTime()))return"—";return new Intl.DateTimeFormat("ja-JP",{timeZone:"Asia/Tokyo",month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"}).format(d)}
function jstDay(v:any){const d=new Date(String(v||""));if(Number.isNaN(d.getTime()))return"";return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit"}).format(d)}
function pearson(xs:number[],ys:number[]){if(xs.length!==ys.length||xs.length<7)return null;const ax=avg(xs),ay=avg(ys),dx=xs.map(x=>x-ax),dy=ys.map(y=>y-ay),den=Math.sqrt(sum(dx.map(x=>x*x))*sum(dy.map(y=>y*y)));if(!den)return null;return sum(dx.map((x,i)=>x*dy[i]))/den}
async function api(endpoint:string,body:Record<string,unknown>){const token=localStorage.getItem(INSIGHT_TOKEN_KEY)||"";if(!token)throw new Error("INSIGHT_LOGIN_REQUIRED");const c=new AbortController(),timer=window.setTimeout(()=>c.abort(),60000);try{const r=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json","X-Insight-Token":token},body:JSON.stringify(body),cache:"no-store",signal:c.signal}),p=await r.json().catch(()=>({}));if(!r.ok||p?.ok===false)throw new Error(p?.error||"分析データを取得できませんでした");return p}finally{window.clearTimeout(timer)}}
async function notificationSample(onPartial:(data:any)=>void){
 const summary=await loadNotificationSummary();
 const result={rows:[],dailyCounts:summary.dailyCounts||[],total:summary.total,truncated:false};
 onPartial(result);return result;
}
function cacheKey(period:Period="month"){const id=String(currentStoredInsightAccount()?.noteId||"").toLowerCase();return id?CACHE_PREFIX+id+(period==="month"?"":":"+period):""}
function readCache(period:Period="month"){const key=cacheKey(period);if(!key)return null;try{const raw=localStorage.getItem(key);if(!raw)return null;const x=JSON.parse(raw);if(!x?.data||!Number.isFinite(Number(x?.cachedAt)))return null;const latest=x.data.latestDashboard,span=latest?.periodStart&&latest?.periodEnd?Math.round((Date.parse(latest.periodEnd)-Date.parse(latest.periodStart))/86400000)+1:0,actual=x.data.selectedPeriod||(latest?.periodType==="all"?"all":span===7?"week":span===28?"month":null);if(actual&&actual!==period)return null;if(Date.now()-Number(x.cachedAt)>CACHE_MAX_AGE)return null;return x}catch{return null}}
function cachePayload(data:any){const notices=data?.notifications||{};return{...data,notifications:{...notices,rows:(notices.rows||[]).slice(0,1000).map((r:Row)=>({occurred_at:r.occurred_at||null,captured_at:r.captured_at||null}))}}}
function writeCache(data:any,period:Period="month"){const key=cacheKey(period);if(!key)return;try{localStorage.setItem(key,JSON.stringify({cachedAt:Date.now(),data:cachePayload(data)}))}catch{}}

function dashboardHref(noteId:string,period:Period="month"){const role=String(noteId||"").toLowerCase()==="ss_yr"?"owner":"member",u=new URL(`${import.meta.env.BASE_URL}dashboard-setup.html`,window.location.origin);u.searchParams.set("role",role);u.searchParams.set("auto","1");if(noteId)u.searchParams.set("account",noteId.toLowerCase());u.searchParams.set("period",period);u.searchParams.set("v",CURRENT_DASHBOARD_VERSION);const back=new URL(window.location.href);back.searchParams.set("insightPeriod",period);u.searchParams.set("return",back.href);return u.href}
function normalizeArticles(rows:Row[]):Article[]{const raw=(rows||[]).map(r=>{const pageViews=num(r.pageViews??r.views),impressions=num(r.impressions),likes=num(r.likes),comments=num(r.comments),salesYen=num(r.salesYen??r.sales_yen),comparable=impressions>0&&pageViews>=0&&pageViews<=impressions,conversion=comparable?pageViews/impressions*100:null,reactionsPer1k=pageViews>0?(likes+comments)/pageViews*1000:null,revenuePer1k=pageViews>0?salesYen/pageViews*1000:null;return{...r,pageViews,impressions,likes,comments,salesYen,conversion,reactionsPer1k,revenuePer1k,score:0} as Article});const pv=raw.map(r=>r.pageViews),react=raw.map(r=>r.reactionsPer1k??0),rev=raw.map(r=>r.revenuePer1k??0),sales=raw.map(r=>r.salesYen),conv=raw.filter(r=>r.conversion!=null).map(r=>r.conversion as number);for(const values of [pv,react,rev,sales,conv])values.sort((a,b)=>a-b);return raw.map(r=>{const c=r.conversion==null?50:percentile(conv,r.conversion);const score=Math.round(percentile(pv,r.pageViews)*.35+percentile(react,r.reactionsPer1k??0)*.25+percentile(rev,r.revenuePer1k??0)*.20+percentile(sales,r.salesYen)*.10+c*.10);return{...r,score}})}
const metricValue=(v:any)=>v==null||v===""||!Number.isFinite(Number(v))?null:Number(v);
function normalizeMetrics(src:Row[]){const byDay=new Map<string,Row&{date:string}>();for(const r of src){const date=String(r.date||r.day||r.at||"").slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(date))continue;byDay.set(date,{date,pageViews:metricValue(r.pageViews??r.pv??r.views),impressions:metricValue(r.impressions),likes:metricValue(r.likes),comments:metricValue(r.comments),salesYen:metricValue(r.salesYen??r.sales_yen??r.sales)})}return[...byDay.values()].sort((a,b)=>a.date.localeCompare(b.date))}
function metricRows(data:any){return normalizeMetrics(data?.dailyMetrics||data?.latestDashboard?.metricSeries||[])}
function weekdayMetrics(metrics:Row[]){return ["日","月","火","水","木","金","土"].map((label,idx)=>{const rows=metrics.filter(r=>r.pageViews!=null&&Number.isFinite(Number(r.pageViews))&&new Date(r.date+"T00:00:00Z").getUTCDay()===idx);return{label:`${label}曜`,value:rows.length?avg(rows.map(r=>Number(r.pageViews))):null,sub:rows.length?`${rows.length}日分`:"未取得"}})}
function snapshotRows(data:any){return normalizeMetrics(data?.dashboard||[])}
function calendarWindow(rows:Row[],days:number,offset=0){const end=rows.at(-1)?.date;if(!end)return[];const max=Date.parse(end+'T00:00:00Z')-offset*86400000,min=max-(days-1)*86400000;return rows.filter(r=>{const t=Date.parse(r.date+'T00:00:00Z');return t>=min&&t<=max})}
function TrendChart({rows,period="month",latest={}}:{rows:Row[];period?:Period;latest?:Row}){
 const scene=useVisibleMotion();
 const[metric,setMetric]=useState<"pageViews"|"salesYen"|"likes"|"comments">("pageViews"),[focus,setFocus]=useState<number|null>(null),uid=useId().replace(/:/g,"");
 const labels={pageViews:"ページビュー",salesYen:"売上",likes:"スキ",comments:"コメント"},units={pageViews:"PV",salesYen:"円",likes:"件",comments:"件"},label=labels[metric],unit=units[metric];
 const buckets:Row[]=latest.chartSeries?.length?latest.chartSeries:rows.map(r=>({...r,startDate:r.date,endDate:r.date,granularity:"DAY"}));
 const view=[...buckets].sort((a,b)=>a.startDate.localeCompare(b.startDate)),granularity=view[0]?.granularity||"DAY",stepLabel=granularity==="MONTH"?"月別":granularity==="WEEK"?"週別":"日別";
 const vals=view.filter(r=>r[metric]!=null),max=Math.max(1,...vals.map(r=>Number(r[metric]))),power=10**Math.floor(Math.log10(max)),high=Math.ceil(max/power/2)*power*2;
 const W=480,H=252,left=57,right=459,top=26,bottom=213,first=latest.periodStart||view[0]?.startDate,last=latest.periodEnd||view.at(-1)?.endDate,firstTime=Date.parse(first),span=Math.max(86400000,Date.parse(last)-firstTime),x=(r:Row)=>left+(Date.parse(r.startDate)-firstTime)/span*(right-left),y=(v:number)=>bottom-v/high*(bottom-top);
 const fmt=(v:any)=>v==null?'未取得':metric==='salesYen'?money(v):n(v),picked=view[focus==null?view.length-1:Math.min(focus,view.length-1)],selectedTotal=latest.availableTotals?.[metric]===false?null:latest[metric],expected=first&&last?granularity==="MONTH"?(Number(last.slice(0,4))-Number(first.slice(0,4)))*12+Number(last.slice(5,7))-Number(first.slice(5,7))+1:granularity==="WEEK"?Math.ceil((Date.parse(last)-Date.parse(first)+86400000)/(7*86400000)):Math.round((Date.parse(last)-Date.parse(first))/86400000)+1:0;
 const segments:Row[][]=[];for(const row of view){if(row[metric]==null){segments.push([]);continue}let segment=segments.at(-1);if(!segment||segment.length&&Date.parse(row.startDate)>Date.parse(segment.at(-1)!.endDate)+86400000){segment=[];segments.push(segment)}segment.push(row)}
 const rangeLabel=(r:Row)=>r.startDate===r.endDate?r.startDate:`${r.startDate}〜${r.endDate}`;
 return <div ref={scene.ref} className="mipro-trend insight-chart-scene" data-motion={scene.motion?"on":"off"}>
  <div className="mipro-trend-head"><div><small>{PERIODS[period]} · 公式{stepLabel}実績</small><b>{label}の推移</b></div><span>{unit}</span></div>
  <div className="mipro-trend-toggle">{(Object.keys(labels) as Array<keyof typeof labels>).map(k=><button key={k} className={metric===k?'active':''} aria-pressed={metric===k} onClick={()=>{setMetric(k);setFocus(null)}}>{labels[k]}</button>)}</div>
  <div className="mipro-trend-kpis"><span><small>{PERIODS[period]}の公式合計</small><b>{fmt(selectedTotal)}<em>{unit}</em></b></span><span className="mipro-coverage-count"><small>{stepLabel}グラフの取得状況</small><b>{vals.length} / {expected || '—'}<em>{granularity==='DAY'?'日':'点'}</em></b></span></div>
  {view.length?<><p className="mipro-chart-period">{first} — {last}</p><div className="mipro-chart mipro-chart-pro"><svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label}の${stepLabel}推移、縦軸${unit}、横軸日付`}>
   <defs><linearGradient id={uid+'area'} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#73e1f0" stopOpacity=".38"/><stop offset="1" stopColor="#73cdd0" stopOpacity=".01"/></linearGradient><linearGradient id={uid+"line"} x1="0" y1="0" x2="1" y2="0"><stop stopColor="#bcf49a"/><stop offset=".5" stopColor="#88edff"/><stop offset="1" stopColor="#b8b0ff"/></linearGradient></defs>
   {[0,.25,.5,.75,1].map(t=><g key={t}><line x1={left} x2={right} y1={y(high*t)} y2={y(high*t)} className="grid"/><text x={left-10} y={y(high*t)+4} textAnchor="end" className="ylabel">{n(high*t)}</text></g>)}
   {segments.filter(a=>a.length>1).map((segment,i)=>{const points=segment.map(r=>`${x(r)},${y(r[metric])}`).join(' ');return <g key={metric+"-"+i}><polygon points={`${x(segment[0])},${bottom} ${points} ${x(segment.at(-1)!)},${bottom}`} fill={`url(#${uid}area)`}/><polyline points={points} className="line-depth" transform="translate(0 4)"/><polyline points={points} className="line" pathLength="1" style={{stroke:`url(#${uid}line)`}}/><polyline points={points} className="line-flow" pathLength="1" aria-hidden="true"/></g>})}
   {picked?.[metric]!=null?<line x1={x(picked)} x2={x(picked)} y1={top} y2={bottom} className="selected-guide"/>:null}
   {vals.map(r=><g key={r.startDate} role="button" aria-label={`${rangeLabel(r)} ${label} ${fmt(r[metric])}${unit}`} tabIndex={0} onClick={()=>setFocus(view.indexOf(r))} onFocus={()=>setFocus(view.indexOf(r))} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setFocus(view.indexOf(r))}}}><circle cx={x(r)} cy={y(r[metric])} r="14" className="point-hit"/><circle cx={x(r)} cy={y(r[metric])} r={picked===r?4:vals.length<3?3:0} className="point"/><title>{`${rangeLabel(r)} ${fmt(r[metric])}${unit}`}</title></g>)}
   {[...new Set([0,Math.floor((view.length-1)/2),view.length-1])].map((idx,i)=><text key={idx} x={x(view[idx])} y="241" textAnchor={i===0?'start':i===2?'end':'middle'} className="xlabel">{granularity==='DAY'?view[idx].startDate.slice(5).replace('-','/'):view[idx].startDate.slice(0,7).replace('-','/')}</text>)}
  </svg></div><div className="mipro-chart-tip" aria-live="polite"><span>{picked?rangeLabel(picked):'—'}</span><b>{fmt(picked?.[metric])} <small>{unit}</small></b></div>
  <label className="mipro-date-slider">日付を選択<input aria-label="グラフの日付" type="range" min="0" max={Math.max(0,view.length-1)} value={focus==null?view.length-1:Math.min(focus,view.length-1)} onChange={e=>setFocus(Number(e.target.value))}/></label><div className="mipro-date-actions"><button disabled={!view.length||(focus??view.length-1)===0} onClick={()=>setFocus(Math.max(0,(focus??view.length-1)-1))}>← 前の点</button><button disabled={!view.length||(focus??view.length-1)>=view.length-1} onClick={()=>setFocus(Math.min(view.length-1,(focus??view.length-1)+1))}>次の点 →</button></div></>:null}
  <p className={vals.length<expected||!view.length?'mipro-warning mipro-coverage':'mipro-note mipro-coverage'}>{!view.length?'この期間の推移は未取得です。期間合計があっても、推移は補完しません。':`${stepLabel} ${vals.length} / ${expected} ${granularity==='DAY'?'日':'点'}を保存済み。`}{vals.length<expected?' 未取得を0とは扱いません。':''}{granularity!=='DAY'?' 公式が返した週・月の集計を表示しています。日別や曜日の数値には分解しません。':''}{last&&last>=jstDay(new Date())?' 末尾の期間は保存時点の途中値です。':''}</p>
 </div>
}
function Bars({items,title,unit}:{items:{label:string;value:number|null;sub?:string}[];title:string;unit:string}){const scene=useVisibleMotion<HTMLElement>();const mx=Math.max(1,...items.map(x=>x.value??0));return <figure ref={scene.ref} className="mipro-bars insight-chart-scene" data-motion={scene.motion?"on":"off"}><figcaption><b>{title}</b><small>横の長さ＝{unit}・最大 {n(mx)}{unit}</small></figcaption>{items.map((x,i)=><div key={`${x.label}-${i}`}><span>{x.label}</span><i aria-hidden="true"><b style={{width:`${Math.max(0,(x.value??0)/mx*100)}%`}}/></i><strong>{x.value==null?"—":n(x.value)+" "+unit}</strong>{x.sub?<small>{x.sub}</small>:null}</div>)}</figure>}
function Fold({title,sub,children,defaultOpen=false}:{title:string;sub:string;children:ReactNode;defaultOpen?:boolean}){return <details className="mipro-fold" open={defaultOpen}><summary><span><b>{title}</b><small>{sub}</small></span><em>開く</em></summary><div className="mipro-fold-body">{children}</div></details>}
function Kpis({items}:{items:{label:string;value:string;sub:string}[]}){return <div className="mipro-kpis">{items.map(x=><article key={x.label}><small>{x.label}</small><b>{x.value}</b><span>{x.sub}</span></article>)}</div>}

export function MemberInsightAnalyticsProV3({revision=0,onBack,view="dashboard"}:{revision?:number;onBack?:()=>void;view?:"dashboard"|"verdict"}){
  const[period,setPeriod]=useState<Period>(preferredPeriod);
  const initial=useMemo(()=>readCache(period),[]);
  const[data,setData]=useState<any>(initial?.data||null),[loading,setLoading]=useState(!initial?.data),[refreshing,setRefreshing]=useState(false),[cachedAt,setCachedAt]=useState<number>(Number(initial?.cachedAt||0)),[error,setError]=useState("");const root=useRef<HTMLElement>(null);
  const requestSeq=useRef(0),refreshState=useRef({busy:false,at:0}),[noticesLoading,setNoticesLoading]=useState(false);
  async function refresh(background=Boolean(data),passive=false){
    if(passive&&(refreshState.current.busy||Date.now()-refreshState.current.at<60000))return;
    refreshState.current={busy:true,at:Date.now()};
    const seq=++requestSeq.current,owner=cacheKey(period),token=localStorage.getItem(INSIGHT_TOKEN_KEY);
    const current=()=>seq===requestSeq.current&&owner===cacheKey(period)&&token===localStorage.getItem(INSIGHT_TOKEN_KEY);
    if(background)setRefreshing(true);else setLoading(true);setNoticesLoading(view==="verdict");setError("");
    let dashboard:any=null,followerCount:any=data?.followerCount||null,notifications=data?.notifications||{rows:[],total:0,truncated:false};
    const publish=()=>{if(!dashboard||!current())return;const next={...dashboard,notifications,followerCount};setData(next);setCachedAt(Date.now());writeCache(next,period)};
    const followerTask=api(DASH,{action:"follower-count"}).then(result=>{if(current()){followerCount=result.followerCount||null;publish()}}).catch(()=>{if(current()&&followerCount){followerCount={...followerCount,stale:true};publish()}});
    const noticeTask=view==="verdict"?notificationSample(next=>{if(current()){notifications=next;publish()}}).catch(()=>{if(current())setError("通知との照合を更新できませんでした。ダッシュボードは表示できます。")}).finally(()=>{if(current())setNoticesLoading(false)}):Promise.resolve();
    try{dashboard=await api(DASH,{action:"analysis",days:365,dashboardOnly:true,period});publish()}
    catch(e){if(current())setError(e instanceof Error?e.message:"分析データを取得できませんでした")}
    finally{if(current()){setLoading(false);setRefreshing(false);refreshState.current.busy=false}}
    await Promise.all([noticeTask,followerTask]);
  }
  useEffect(()=>{void refresh(Boolean(data));return()=>{requestSeq.current++}},[revision,period,view]);
  useEffect(()=>{const resume=()=>{if(document.visibilityState==='visible')void refresh(true,true)};window.addEventListener('focus',resume);return()=>window.removeEventListener('focus',resume)},[period,view]);
  const articles=useMemo(()=>normalizeArticles((data?.topArticles||[]).filter((r:Row)=>!r.contentType||r.contentType==='article')),[data?.topArticles]);


  const latest=data?.latestDashboard||{},noteId=String(data?.noteId||currentStoredInsightAccount()?.noteId||"").replace(/^@/,"").toLowerCase(),selectedMetrics=metricRows(data),metrics=normalizeMetrics(data?.dailyHistory||selectedMetrics),followers:Row[]=data?.followers||[],latestFollower=data?.followerCount||null,trafficRows:Row[]=data?.traffic?.rows||[],trafficTotal=Math.max(0,num(data?.traffic?.total)||sum(trafficRows.map(r=>num(r.pv)))),notifications:Row[]=data?.notifications?.rows||[];
  const comparable=articles.filter(r=>r.conversion!=null),invalid=articles.filter(r=>r.impressions>0&&r.pageViews>r.impressions),convVals=comparable.map(r=>r.conversion as number),convMed=median(convVals),conv75=q75(convVals),pvVals=articles.map(r=>r.pageViews),pvMed=median(pvVals),reactVals=articles.filter(r=>r.reactionsPer1k!=null).map(r=>r.reactionsPer1k as number),reactMed=median(reactVals),react75=q75(reactVals);
  const improvementPv=comparable.length>=5?Math.round(sum(comparable.map(r=>Math.max(0,r.impressions*convMed/100-r.pageViews)))):null;
  const impMed=median(comparable.map(r=>r.impressions)),leaks=comparable.filter(r=>r.impressions>=impMed&&(r.conversion as number)<convMed).sort((a,b)=>(b.impressions*(convMed-(b.conversion as number)))-(a.impressions*(convMed-(a.conversion as number)))).slice(0,6),gems=articles.filter(r=>r.pageViews>0&&r.pageViews<=pvMed&&(r.reactionsPer1k??0)>=react75).sort((a,b)=>(b.reactionsPer1k??0)-(a.reactionsPer1k??0)).slice(0,6);
  const totalPv=sum(articles.map(r=>r.pageViews)),top5Pv=sum([...articles].sort((a,b)=>b.pageViews-a.pageViews).slice(0,5).map(r=>r.pageViews)),pvConcentration=totalPv?top5Pv/totalPv*100:0,totalSales=sum(articles.map(r=>r.salesYen)),top5Sales=sum([...articles].sort((a,b)=>b.salesYen-a.salesYen).slice(0,5).map(r=>r.salesYen)),salesConcentration=totalSales?top5Sales/totalSales*100:0;
  const last7=calendarWindow(metrics,7),prev7=calendarWindow(metrics,7,7),pv7=sum(last7.map(r=>r.pageViews)),pvPrev=sum(prev7.map(r=>r.pageViews)),sales7=sum(last7.map(r=>r.salesYen)),salesPrev=sum(prev7.map(r=>r.salesYen));
  const completeMetrics=metrics.filter(r=>r.date<jstDay(new Date())),weekdays=weekdayMetrics(completeMetrics);
  const pvDays7=last7.filter(r=>r.pageViews!=null),previousPvDays=prev7.filter(r=>r.pageViews!=null),salesDays7=last7.filter(r=>r.salesYen!=null),previousSalesDays=prev7.filter(r=>r.salesYen!=null);
  const pvChange=pvDays7.length===7&&previousPvDays.length===7&&pvPrev>0?pct(deltaPct(pv7,pvPrev),0):"比較待ち";
  const salesChange=salesDays7.length===7&&previousSalesDays.length===7&&salesPrev>0?pct(deltaPct(sales7,salesPrev),0):"比較待ち";
  const groups:Record<string,number>=data?.traffic?.groups||{},shares=Object.entries(groups).map(([k,v])=>({k,value:num(v)})).filter(x=>x.value>0),hhi=trafficTotal?sum(shares.map(x=>Math.pow(x.value/trafficTotal,2))):1,diversity=shares.length>1?Math.max(0,Math.min(100,(1-hhi)/(1-1/shares.length)*100)):0,groupLabel:Record<string,string>={note:"note内",notification:"通知",search:"検索",social:"SNS",direct:"直接/不明",external:"外部"};
  const notifByDay=new Map<string,number>((data?.notifications?.dailyCounts||[]).map((r:Row)=>[String(r.date),num(r.count)]));for(const r of notifications){const d=jstDay(r.occurred_at||r.captured_at);if(d)notifByDay.set(d,(notifByDay.get(d)||0)+1)}const pairs=metrics.filter(r=>r.pageViews!=null).map(r=>({date:r.date,pv:r.pageViews,notif:notifByDay.get(r.date)||0})).filter(r=>notifByDay.has(r.date)),corr=pearson(pairs.map(x=>x.notif),pairs.map(x=>x.pv)),notifMedian=median(pairs.map(x=>x.notif)),highNotif=pairs.filter(x=>x.notif>notifMedian),lowNotif=pairs.filter(x=>x.notif<=notifMedian),highPv=avg(highNotif.map(x=>x.pv)),lowPv=avg(lowNotif.map(x=>x.pv));
  const hasOfficial=(key:string,value:any)=>latest.availableTotals?.[key]!==false&&metricValue(value)!==null;
  const qualityChecks=[hasOfficial('pageViews',latest.pageViews??latest.views),articles.length>0,metrics.filter(r=>r.pageViews!=null).length>=7,trafficRows.length>0,Boolean(latestFollower),num(data?.notifications?.total)>0],quality=qualityChecks.filter(Boolean).length;
  const ranked=[...articles].sort((a,b)=>b.score-a.score);
  const syncHref=dashboardHref(noteId,period);
  function changePeriod(next:Period){if(next===period)return;requestSeq.current++;const saved=readCache(next);setData(saved?.data||null);setCachedAt(saved?.cachedAt||0);setLoading(!saved?.data);setError("");setPeriod(next);try{localStorage.setItem("mumei-analysis-period:"+noteId,next);const u=new URL(location.href);u.searchParams.set("insightPeriod",next);history.replaceState(history.state,"",u)}catch{}}
  const official=(key:string,value:any,currency=false)=>!hasOfficial(key,value)?"未取得":currency?money(value):n(value);
  const savedPeriod=latest.periodType==="all"?"全期間（note公式の集計）":latest.periodStart&&latest.periodEnd?`${latest.periodStart}〜${latest.periodEnd}`:'対象期間は未取得';
  const missingSources=[!articles.length?'記事別データ':null,!trafficRows.length?'流入元':null,!latestFollower?'現在のフォロワー数':null].filter(Boolean);
  const openAll=(open:boolean)=>root.current?.querySelectorAll<HTMLDetailsElement>("details.mipro-fold").forEach(x=>x.open=open);
  const cacheAge=cachedAt?Date.now()-cachedAt:0,cacheStale=Boolean(cachedAt&&cacheAge>6*60*60*1000);
  return <section className={`mipro mipro-view-${view}`} ref={root}>
    <header className="mipro-head"><div><small>YOUR NOTE / INSIGHT</small><h2>{view==="verdict"?"総合判定":<>数字を、<br/>次のアイデアに。</>}</h2><p><strong>@{noteId||"—"}</strong> の保存済みデータから分析を表示します。分析を開く・期間を切り替えるだけでは、noteの全記事を読み直しません。</p>{cachedAt?<span className={`mipro-cache-state ${cacheStale?"stale":""}`}>{refreshing?"↻ サーバーの保存済みデータを確認中":`公式データ保存 ${jtime(latest.capturedAt)}`}</span>:null}</div><div className="mipro-head-actions">{onBack?<button onClick={onBack}>←戻る</button>:null}<a href={syncHref}>⚙ 設定・数値の更新</a><button disabled={refreshing} onClick={()=>void refresh(true)}>{refreshing?"確認中…":"保存データを再表示"}</button></div></header>
    <div className="mipro-period-picker" role="group" aria-label="分析全体の期間"><div><span>分析する期間</span><small>集計・記事・グラフを一緒に切替</small></div><div>{(Object.keys(PERIODS) as Period[]).map(p=><button key={p} aria-pressed={period===p} onClick={()=>changePeriod(p)}>{PERIODS[p]}{data?.availablePeriods&&!data.availablePeriods.includes(p)?<small>未取得</small>:null}</button>)}</div></div>
    {loading?<p className="mipro-note" role="status">{PERIODS[period]}の保存済みデータを確認中…</p>:!data?.latestDashboard?<div className="mipro-empty-period"><small>{PERIODS[period]}</small><h3>この期間は、まだ取り込まれていません。</h3><p>{error||"期間を混ぜず、この期間の公式集計・記事別数値・推移を取得します。"}</p><a href={syncHref}>{PERIODS[period]}を自動で取り込む</a></div>:null}
    {data?.latestDashboard?<>
    <div className="mipro-note mipro-saved-scope"><b>保存済み：{articles.length}件 ／ {jtime(latest.capturedAt)}</b><span>集計対象：{savedPeriod}</span><span>全記事を最新にする時は、過去記事に増えたビューも含めて全件取得します。記事数とnoteの応答によって時間がかかります。分析を見るだけなら再取得は不要です。</span></div>
    {error?<p className="mipro-warning">更新失敗・保存済みの分析を表示中：{error}</p>:null}
    {noticesLoading?<p className="mipro-note" role="status">通知との照合を更新中… ダッシュボードは操作できます。</p>:null}
    <div className="mipro-release"><span>本体 {CURRENT_INSIGHT_APP_VERSION}</span><span>Dashboard {CURRENT_DASHBOARD_VERSION}</span><span>本人通知 {CURRENT_NOTIFICATION_VERSION}</span><span>照合 @{noteId||"—"}</span></div>
    <div className="mipro-fold-controls"><button onClick={()=>openAll(true)}>分析をすべて開く</button><button onClick={()=>openAll(false)}>すべて収納</button></div>

    {view==="dashboard"?<>
    <Fold defaultOpen title="① 公式Dashboard 保存時点の値" sub={`${savedPeriod} ／ 保存 ${jtime(latest.capturedAt)}`}>
      <p className="mipro-note">対象：{savedPeriod}。以下は保存時点の公式集計です。noteで現在表示される値との差は、保存後の増加や選択期間の違いを含みます。</p>
      <Kpis items={[{label:"ページビュー(PV)",value:official("pageViews",latest.pageViews??latest.views),sub:"note公式Dashboard"},{label:"インプレッション(Imp)",value:official("impressions",latest.impressions),sub:"note内表示回数"},{label:"スキ",value:official("likes",latest.likes),sub:"公式集計"},{label:"コメント",value:official("comments",latest.comments),sub:"公式集計"},{label:"売上",value:official("salesYen",latest.salesYen,true),sub:"公式集計"},{label:"フォロワー",value:latestFollower?`${n(latestFollower.count)}人`:"未取得",sub:latestFollower?`${latestFollower.stale?"更新待ち・保存値":"公開プロフィール"} ${jtime(latestFollower.at)}`:"公開プロフィールを確認中／未取得"}]}/>
      <InsightDonut label="スキ・コメント構成比" items={[{label:"スキ",value:num(latest.likes)},{label:"コメント",value:num(latest.comments)}]}/>
      <div className="mipro-note">公式取得 {jtime(latest.officialCollectedAt||latest.capturedAt)} ／ INSIGHT保存 {jtime(latest.capturedAt)}</div>
    </Fold>

    <Fold defaultOpen={period!=="all"} title="INSIGHT分析：伸びの内訳" sub="一日の突出か、日々の底上げか。前週の同じ曜日で比較">
      <p className="mipro-note">日別保存履歴 {metrics[0]?.date||"—"}〜{metrics.at(-1)?.date||"—"} を使用。上の公式集計期間とは別に蓄積しています。</p><GrowthAnalysis rows={metrics} today={jstDay(new Date())}/>
    </Fold>

    <Fold title="② データ品質・数値の意味" sub={`取得済みの分析材料 ${quality}/6 ・ PV化比較可能 ${comparable.length}/${articles.length}記事`}>
      <p className="mipro-note">{missingSources.length?`未取得：${missingSources.join('・')}。`:'記事別・流入元・フォロワーの保存データがあります。'} 日別は指標ごとに取得範囲が異なる場合があります。note公式グラフは31日以内なら日単位、32〜181日は週単位、182日以上は月単位です。週・月の値から日別値を推測しません。</p>
      <Kpis items={[{label:"分析材料の取得",value:`${quality}/6`,sub:"公式総計・記事別・日別PV7日以上・流入・現在のフォロワー・本人通知"},{label:"PV化比較可能",value:`${comparable.length}記事`,sub:"PVがImp以下で同一比較できる記事だけ"},{label:"比較除外",value:`${invalid.length}記事`,sub:"PV>Impは集計範囲不一致として率計算しない"},{label:"日別PV",value:`${metrics.filter(r=>r.pageViews!=null).length}日`,sub:"成長・曜日分析に使用"}]}/>
      <p className="mipro-warning"><b>重要:</b> PVとImpは記事によって集計範囲が一致しない場合があります。<strong>PV÷Impが100%を超える行は「高性能」と解釈せず、PV化率・潜在PVの計算から除外</strong>します。対象外の記事は件数を上に示します。</p>
    </Fold>

    <Fold defaultOpen title="③ 成長推移" sub={`${PERIODS[period]}の公式グラフと記事別の分布`}>
      <Kpis items={[{label:PERIODS[period]+"のPV",value:official("pageViews",latest.pageViews),sub:"選択期間の公式合計"},{label:PERIODS[period]+"の売上",value:official("salesYen",latest.salesYen,true),sub:"選択期間の公式合計"},{label:"記事PV中央値",value:n(pvMed),sub:"外れ値に強い本人内基準"},{label:"上位5記事PV集中",value:pct(pvConcentration),sub:pvConcentration>=65?"上位依存が強い":"分散できている"}]}/>
      <TrendChart key={period} rows={selectedMetrics} period={period} latest={latest}/>
    </Fold>

    <Fold defaultOpen title="④ 記事ベンチマーク" sub="中央値・上位25%・反応効率を本人内で比較">
      <Kpis items={[{label:"記事PV中央値",value:n(pvMed),sub:"全記事の中央水準"},{label:"1,000回閲覧あたりの反応",value:n(reactMed),sub:"(スキ+コメント)÷PV×1,000"},{label:"PV化中央値",value:comparable.length>=5?pct(convMed):"算出停止",sub:"比較可能記事のみ"},{label:"PV化 上位25%境界",value:comparable.length>=5?pct(conv75):"算出停止",sub:"比較可能記事のみ"}]}/>
      <p className="mipro-note">「反応率」ではなく<strong>1,000PVあたり何件の反応があるか</strong>で表示。確率と誤解しない単位に変更しています。</p>
    </Fold>

    <Fold defaultOpen title="⑤ 改善余地・隠れた強記事" sub={improvementPv==null?"PV化の比較可能記事が不足":`比較可能記事だけのPV改善余地 +${n(improvementPv)}`}>
      <Kpis items={[{label:"PV改善余地",value:improvementPv==null?"算出停止":`+${n(improvementPv)}`,sub:improvementPv==null?"比較可能記事5件以上で算出":"PV化中央値まで改善した場合の差分"},{label:"読まれ方の改善候補",value:`${leaks.length}件`,sub:"Imp多・PV化が本人中央値未満"},{label:"隠れた強記事",value:`${gems.length}件`,sub:"PV少なめ・閲覧あたりの反応が上位25%"},{label:"分析母数",value:`${articles.length}記事`,sub:"公式記事別データ"}]}/>
      <p className="mipro-note">取得済みの記事から、表示回数に対して読まれた回数が本人の中央値より少ない記事を抽出します。改善余地は中央値に届いた場合の仮定値で、将来のPVを保証するものではありません。</p><div className="mipro-twocol"><section><h4>閲覧につながる余地</h4>{leaks.length?leaks.map(r=><a href={r.url||undefined} target="_blank" rel="noreferrer" key={r.article_key||r.url||r.title}><b>{short(r.title)}</b><span>Imp {n(r.impressions)} / PV {n(r.pageViews)} / PV化 {pct(r.conversion)}</span></a>):<p>比較可能な記事に、この条件の候補はありません。</p>}</section><section><h4>💎 隠れた強記事</h4>{gems.length?gems.map(r=><a href={r.url||undefined} target="_blank" rel="noreferrer" key={r.article_key||r.url||r.title}><b>{short(r.title)}</b><span>PV {n(r.pageViews)} / 反応 {n(r.reactionsPer1k)}件/1,000PV</span></a>):<p>条件に合う記事はまだありません。</p>}</section></div>
    </Fold>

    <Fold defaultOpen title="⑥ 流入分析" sub={trafficRows.length?`流入PV ${n(trafficTotal)} ・ 分散度 ${diversity.toFixed(0)}/100`:"流入データ未取得"}>
      {trafficRows.length?<>
      <Kpis items={[{label:"流入分散度",value:`${diversity.toFixed(0)}/100`,sub:"1媒体への偏りが少ないほど高い"},{label:"検索",value:pct(trafficTotal?num(groups.search)/trafficTotal*100:0),sub:`${n(groups.search)} PV`},{label:"通知",value:pct(trafficTotal?num(groups.notification)/trafficTotal*100:0),sub:`${n(groups.notification)} PV`},{label:"外部",value:pct(trafficTotal?num(groups.external)/trafficTotal*100:0),sub:`${n(groups.external)} PV`}]}/>
      <InsightDonut label="流入元の構成比" unit="PV" items={shares.map(x=>({label:groupLabel[x.k]||x.k,value:x.value}))}/>
      <Bars title="流入元ごとのページビュー" unit="PV" items={shares.map(x=>({label:groupLabel[x.k]||x.k,value:x.value,sub:trafficTotal?pct(x.value/trafficTotal*100):"—"}))}/></>:<p className="mipro-note">流入元はまだ保存されていません。検索・通知・外部の割合と分散度は算出できません。未取得は0%ではありません。</p>}
    </Fold>

    <Fold title="⑦ 収益分析" sub={hasOfficial("salesYen",latest.salesYen)?`売上 ${money(latest.salesYen)}`:"公式売上は未取得"}>
      {hasOfficial("salesYen",latest.salesYen)?<>
      <Kpis items={[{label:"公式売上",value:official("salesYen",latest.salesYen,true),sub:"Dashboard総計"},{label:"1,000回閲覧あたりの売上",value:money(num(latest.pageViews??latest.views)>0?num(latest.salesYen)/num(latest.pageViews??latest.views)*1000:0),sub:"PVあたり収益効率"},{label:"売上あり記事",value:`${articles.filter(r=>r.salesYen>0).length}件`,sub:`全${articles.length}記事`},{label:"上位5記事売上集中",value:pct(salesConcentration),sub:salesConcentration>=70?"上位依存が強い":"分散あり"}]}/>
      <Bars title="記事別の売上（上位10記事）" unit="円" items={[...articles].filter(r=>r.salesYen>0).sort((a,b)=>b.salesYen-a.salesYen).slice(0,10).map(r=>({label:short(r.title,28),value:r.salesYen,sub:r.pageViews>0?`${money(r.revenuePer1k)}/1,000PV`:"PVなし"}))}/></>:<p className="mipro-note">公式売上をまだ取得できていないため、収益効率・売上集中度は算出できません。売上0円とは異なります。</p>}
    </Fold>

    <Fold defaultOpen title="保存履歴・最高と最低の記録" sub="PV・スキ・コメント・売上・1日の保存通知数"><SavedHistory rows={metrics} notifications={data?.notifications?.dailyCounts||[]} today={jstDay(new Date())}/></Fold>

    <Fold title="⑧ 曜日別パフォーマンス" sub="保存済みの公式日別PV ÷ 取得日数で、曜日ごとの平均を計算">
      {completeMetrics.some(r=>r.pageViews!=null)?<><p className="mipro-note">{completeMetrics[0]?.date}〜{completeMetrics.at(-1)?.date}。各曜日のPV合計を、その曜日の取得日数で割ります。当日の途中値を除きます。</p><InsightColumns label="曜日ごとの平均ページビュー" unit="PV/日" items={weekdays}/></>:null}
      {!metrics.some(r=>r.pageViews!=null)?<p className="mipro-note">公式の日別PVがまだ保存されていません。<a href={syncHref}>noteで数値を更新</a>すると、選択期間のグラフも自動で読み込みます。公式が週・月単位で返す長期の値から、日別や曜日の値は推測しません。</p>:null}
    </Fold>

    <Fold title="⑩ 記事総合ランキング" sub="最大値依存をやめ、本人内パーセンタイルで評価">
      <ArticleRanking articles={ranked}/>
      <p className="mipro-note">INSIGHT指数はPV 35%・反応効率25%・1,000回閲覧あたりの売上20%・売上10%・比較可能なPV化10%を<strong>本人内順位</strong>で合成。1本の極端な記事に全体評価を引っ張られにくくしています。</p>
    </Fold>
    </>:<>
      <Kpis items={[{label:"取得済みの分析材料",value:`${quality}/6`,sub:"未取得項目を0や不調と判定しません"},{label:"記事比較",value:`${articles.length}記事`,sub:"本人内順位で評価"},{label:"照合対象の通知",value:`${n(data?.notifications?.total)}件`,sub:"保存済み本人通知"},{label:"日付の重なり",value:`${pairs.length}日`,sub:"公式PVと通知件数を日単位で照合"}]}/>
      <Fold defaultOpen title="伸びの総合判定" sub="突出した1日と、日々の底上げを区別"><GrowthAnalysis rows={metrics} today={jstDay(new Date())}/></Fold>
      <Fold defaultOpen title="本人通知 × PV クロス分析" sub={corr==null?"重なる日別データ7日以上で算出":`同日相関 ${corr.toFixed(2)}`}>
        <Kpis items={[{label:"通知↔PV 同日相関",value:corr==null?"算出待ち":corr.toFixed(2),sub:"相関であり因果ではありません"},{label:"通知多い日/少ない日",value:highNotif.length&&lowNotif.length?`${n(highPv)} / ${n(lowPv)} PV`:"—",sub:"それぞれの平均PV/日"}]}/>
        {pairs.length?<InsightScatter items={pairs}/>:null}
        <p className="mipro-note">本人通知と公式PVを日付で照合します。{corr==null?"重なる日付が7日未満、または値に変化がないため相関を算出できません。":"保存履歴上の関連を示し、通知がPVを増やしたとは判定しません。"}</p>
      </Fold>
      <Fold defaultOpen title="記事総合ランキング" sub="PV・反応効率・収益を本人内順位で評価"><ArticleRanking articles={ranked}/></Fold>
    </>}
    </>:null}
  </section>
}
