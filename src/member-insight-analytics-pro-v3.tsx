import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { INSIGHT_TOKEN_KEY, currentStoredInsightAccount } from "./insight-account-store";
import { CURRENT_DASHBOARD_VERSION, CURRENT_INSIGHT_APP_VERSION, CURRENT_NOTIFICATION_VERSION } from "./insight-release";
import "./member-insight-analytics-pro-v3.css";

const DASH="https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-dashboard-data";
const FEED="https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-notification-feed-final";
const CACHE_PREFIX="mumei-insight-pro-cache-v2:";
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
function percentile(a:number[],v:number){const x=a.filter(Number.isFinite);if(!x.length)return 50;return x.filter(z=>z<=v).length/x.length*100}
function deltaPct(now:number,prev:number){if(!prev)return now?100:0;return (now-prev)/Math.abs(prev)*100}
function jtime(v:any){const d=new Date(String(v||""));if(Number.isNaN(d.getTime()))return"—";return new Intl.DateTimeFormat("ja-JP",{timeZone:"Asia/Tokyo",month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"}).format(d)}
function jstDay(v:any){const d=new Date(String(v||""));if(Number.isNaN(d.getTime()))return"";return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit"}).format(d)}
function pearson(xs:number[],ys:number[]){if(xs.length!==ys.length||xs.length<7)return null;const ax=avg(xs),ay=avg(ys),dx=xs.map(x=>x-ax),dy=ys.map(y=>y-ay),den=Math.sqrt(sum(dx.map(x=>x*x))*sum(dy.map(y=>y*y)));if(!den)return null;return sum(dx.map((x,i)=>x*dy[i]))/den}
async function api(endpoint:string,body:Record<string,unknown>){const token=localStorage.getItem(INSIGHT_TOKEN_KEY)||"";if(!token)throw new Error("INSIGHT_LOGIN_REQUIRED");const c=new AbortController(),timer=window.setTimeout(()=>c.abort(),60000);try{const r=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json","X-Insight-Token":token},body:JSON.stringify(body),cache:"no-store",signal:c.signal}),p=await r.json().catch(()=>({}));if(!r.ok||p?.ok===false)throw new Error(p?.error||"分析データを取得できませんでした");return p}finally{window.clearTimeout(timer)}}
async function notificationSample(){try{const first=await api(FEED,{kind:"all",page:1,pageSize:100}),total=Math.max(0,num(first.total)),pages=Math.min(10,Math.max(1,Math.ceil(total/100))),rows:Row[]=[...(first.rows||[])];for(let p=2;p<=pages;p++){const x=await api(FEED,{kind:"all",page:p,pageSize:100});rows.push(...(x.rows||[]))}return{rows,total,truncated:pages<Math.ceil(Math.max(1,total)/100)}}catch{return{rows:[] as Row[],total:0,truncated:false}}}
async function loadAll(){const[dash,notifications]=await Promise.all([api(DASH,{action:"analysis",days:365}),notificationSample()]);return{...dash,notifications}}
function cacheKey(){const id=String(currentStoredInsightAccount()?.noteId||"").toLowerCase();return id?CACHE_PREFIX+id:""}
function readCache(){const key=cacheKey();if(!key)return null;try{const raw=localStorage.getItem(key);if(!raw)return null;const x=JSON.parse(raw);if(!x?.data||!Number.isFinite(Number(x?.cachedAt)))return null;if(Date.now()-Number(x.cachedAt)>CACHE_MAX_AGE)return null;return x}catch{return null}}
function cachePayload(data:any){const notices=data?.notifications||{};return{...data,notifications:{...notices,rows:(notices.rows||[]).slice(0,1000).map((r:Row)=>({occurred_at:r.occurred_at||null,captured_at:r.captured_at||null}))}}}
function writeCache(data:any){const key=cacheKey();if(!key)return;try{localStorage.setItem(key,JSON.stringify({cachedAt:Date.now(),data:cachePayload(data)}))}catch{}}

function dashboardHref(noteId:string){const role=String(noteId||"").toLowerCase()==="ss_yr"?"owner":"member",u=new URL(`${import.meta.env.BASE_URL}dashboard-setup.html`,window.location.origin);u.searchParams.set("role",role);u.searchParams.set("auto","1");if(noteId)u.searchParams.set("account",noteId.toLowerCase());u.searchParams.set("return",window.location.href);return u.href}
function normalizeArticles(rows:Row[]):Article[]{const raw=(rows||[]).map(r=>{const pageViews=num(r.pageViews??r.views),impressions=num(r.impressions),likes=num(r.likes),comments=num(r.comments),salesYen=num(r.salesYen??r.sales_yen),comparable=impressions>0&&pageViews>=0&&pageViews<=impressions,conversion=comparable?pageViews/impressions*100:null,reactionsPer1k=pageViews>0?(likes+comments)/pageViews*1000:null,revenuePer1k=pageViews>0?salesYen/pageViews*1000:null;return{...r,pageViews,impressions,likes,comments,salesYen,conversion,reactionsPer1k,revenuePer1k,score:0} as Article});const pv=raw.map(r=>r.pageViews),react=raw.map(r=>r.reactionsPer1k??0),rev=raw.map(r=>r.revenuePer1k??0),sales=raw.map(r=>r.salesYen),conv=raw.filter(r=>r.conversion!=null).map(r=>r.conversion as number);return raw.map(r=>{const c=r.conversion==null?50:percentile(conv,r.conversion);const score=Math.round(percentile(pv,r.pageViews)*.35+percentile(react,r.reactionsPer1k??0)*.25+percentile(rev,r.revenuePer1k??0)*.20+percentile(sales,r.salesYen)*.10+c*.10);return{...r,score}})}
const metricValue=(v:any)=>v==null||v===""||!Number.isFinite(Number(v))?null:Number(v);
function normalizeMetrics(src:Row[]){const byDay=new Map<string,Row>();for(const r of src){const date=String(r.date||r.day||r.at||"").slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(date))continue;byDay.set(date,{date,pageViews:metricValue(r.pageViews??r.pv??r.views),impressions:metricValue(r.impressions),likes:metricValue(r.likes),comments:metricValue(r.comments),salesYen:metricValue(r.salesYen??r.sales_yen??r.sales)})}return[...byDay.values()].sort((a,b)=>a.date.localeCompare(b.date)).slice(-366)}
function metricRows(data:any){return normalizeMetrics(data?.latestDashboard?.metricSeries||[])}
function snapshotRows(data:any){return normalizeMetrics(data?.dashboard||[])}
function calendarWindow(rows:Row[],days:number,offset=0){const end=rows.at(-1)?.date;if(!end)return[];const max=Date.parse(end+'T00:00:00Z')-offset*86400000,min=max-(days-1)*86400000;return rows.filter(r=>{const t=Date.parse(r.date+'T00:00:00Z');return t>=min&&t<=max})}
function TrendChart({rows,cumulative=false}:{rows:Row[];cumulative?:boolean}){
 const[metric,setMetric]=useState<"pageViews"|"salesYen"|"likes"|"comments">("pageViews"),[days,setDays]=useState<7|30|90>(30),[focus,setFocus]=useState<number|null>(null),uid=useId().replace(/:/g,"");
 const labels={pageViews:"ページビュー",salesYen:"売上",likes:"スキ",comments:"コメント"},units={pageViews:"PV",salesYen:"円",likes:"件",comments:"件"},label=labels[metric],unit=units[metric],view=calendarWindow(rows,days),vals=view.map(r=>r[metric]).filter(v=>v!=null),max=Math.max(1,...vals),ceil=Math.pow(10,Math.floor(Math.log10(max))),high=Math.ceil(max/ceil/2)*ceil*2;
 const W=440,H=244,left=64,right=420,top=32,bottom=204,first=view[0]?.date,last=view.at(-1),lastTime=Date.parse((last?.date||'2000-01-01')+'T00:00:00Z'),firstTime=Date.parse((first||'2000-01-01')+'T00:00:00Z'),span=Math.max(86400000,lastTime-firstTime),x=(r:Row)=>view.length===1?(left+right)/2:left+(Date.parse(r.date+'T00:00:00Z')-firstTime)/span*(right-left),y=(v:number)=>bottom-Math.max(0,v)/high*(bottom-top);
 const fmt=(v:any)=>v==null?'未取得':metric==='salesYen'?money(v):n(v),date=(v:string)=>v?.slice(5).replace('-','/')||'—';
 const segments:Row[][]=[];for(const r of view){if(r[metric]==null){segments.push([]);continue}let segment=segments.at(-1);if(!segment||segment.length&&Date.parse(r.date)-Date.parse(segment.at(-1)!.date)>86400000){segment=[];segments.push(segment)}segment.push(r)}
 const focused=view[focus==null?view.length-1:Math.min(focus,view.length-1)],sumValue=vals.reduce((a,b)=>a+Number(b),0),previous=view.at(-2),difference=last?.[metric]!=null&&previous?.[metric]!=null?last[metric]-previous[metric]:null;
 if(!view.length)return <div className="mipro-note">日別データ・保存時点の集計値がまだありません。</div>;
 return <div className="mipro-trend">
  <div className="mipro-trend-head"><div><b>{label}の推移 <em>単位：{unit}</em></b><small>{cumulative?'保存時点の集計値（日別の増加数ではありません）':'公式の日別実績'} · {first}〜{last?.date}</small></div></div>
  <div className="mipro-trend-toggle">{(Object.keys(labels) as Array<keyof typeof labels>).map(k=><button key={k} className={metric===k?'active':''} aria-pressed={metric===k} onClick={()=>{setMetric(k);setFocus(null)}}>{labels[k]}</button>)}</div>
  <div className="mipro-trend-range"><span>期間</span>{([7,30,90] as const).map(d=><button key={d} className={days===d?'active':''} onClick={()=>{setDays(d);setFocus(null)}}>{d}日</button>)}</div>
  <div className="mipro-trend-kpis"><span><small>最新 {date(last?.date)}</small><b>{fmt(last?.[metric])}</b></span><span><small>{cumulative?'前回保存との差':'取得済み日別の合計'}</small><b>{fmt(cumulative?difference:sumValue)}</b></span><span><small>データがある日</small><b>{vals.length} / {Math.round(span/86400000)+1}日</b></span></div>
  <div className="mipro-chart mipro-chart-pro"><svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label}の推移、縦軸${unit}、横軸日付`}>
   <defs><linearGradient id={uid+'line'} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#d4fdff"/><stop offset="1" stopColor="#22b9e8"/></linearGradient><linearGradient id={uid+'area'} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#39cce9" stopOpacity=".3"/><stop offset="1" stopColor="#39cce9" stopOpacity="0"/></linearGradient></defs>
   {[0,.25,.5,.75,1].map(t=><g key={t}><line x1={left} x2={right} y1={y(high*t)} y2={y(high*t)} className="grid"/><text x={left-8} y={y(high*t)+4} textAnchor="end" className="ylabel">{n(high*t)}</text></g>)}
   <text x={left} y="18" className="ylabel">{label}（{unit}）</text>
   {segments.filter(a=>a.length>1).map((segment,i)=>{const points=segment.map(r=>`${x(r)},${y(r[metric])}`).join(' ');return <g key={i}><polygon points={`${x(segment[0])},${bottom} ${points} ${x(segment.at(-1)!)},${bottom}`} fill={`url(#${uid}area)`}/><polyline points={points} className="line-depth"/><polyline points={points} className="line" style={{stroke:`url(#${uid}line)`}}/></g>})}
   {view.filter(r=>r[metric]!=null).map(r=><circle key={r.date} cx={x(r)} cy={y(r[metric])} r={focused===r?5:3} className="point" tabIndex={0} onClick={()=>setFocus(view.indexOf(r))} onFocus={()=>setFocus(view.indexOf(r))}><title>{r.date} {label} {fmt(r[metric])}{unit}</title></circle>)}
   {[view[0],...(view.length>2?[view[Math.floor(view.length/2)]]:[]),...(view.length>1?[last!]:[])].map(r=><text key={r.date} x={x(r)} y="228" textAnchor={r===view[0]?'start':r===last?'end':'middle'} className="xlabel">{date(r.date)}</text>)}
  </svg></div>
  <div className="mipro-chart-tip" aria-live="polite"><b>{focused?.date}</b><span>{label} <strong>{fmt(focused?.[metric])}{focused?.[metric]!=null?' '+unit:''}</strong></span></div>
  <label className="mipro-date-slider">日付を選択<input aria-label="グラフの日付" type="range" min="0" max={Math.max(0,view.length-1)} value={focus==null?view.length-1:Math.min(focus,view.length-1)} onChange={e=>setFocus(Number(e.target.value))}/></label>
  <small className="mipro-chart-source">出典：note公式ダッシュボードの保存データ。欠損日は線を切り、取得済みの0件は0として表示します。</small>
 </div>
}
function Bars({items}:{items:{label:string;value:number;sub?:string}[]}){const mx=Math.max(1,...items.map(x=>x.value));return <div className="mipro-bars">{items.map((x,i)=><div key={`${x.label}-${i}`}><span>{x.label}</span><i><b style={{width:`${Math.max(0,x.value/mx*100)}%`}}/></i><strong>{n(x.value)}</strong>{x.sub?<small>{x.sub}</small>:null}</div>)}</div>}
function Fold({title,sub,children}:{title:string;sub:string;children:ReactNode}){return <details className="mipro-fold"><summary><span><b>{title}</b><small>{sub}</small></span><em>開く</em></summary><div className="mipro-fold-body">{children}</div></details>}
function Kpis({items}:{items:{label:string;value:string;sub:string}[]}){return <div className="mipro-kpis">{items.map(x=><article key={x.label}><small>{x.label}</small><b>{x.value}</b><span>{x.sub}</span></article>)}</div>}

export function MemberInsightAnalyticsProV3({revision=0,onBack}:{revision?:number;onBack?:()=>void}){
  const initial=readCache();
  const[data,setData]=useState<any>(initial?.data||null),[loading,setLoading]=useState(!initial?.data),[refreshing,setRefreshing]=useState(false),[cachedAt,setCachedAt]=useState<number>(Number(initial?.cachedAt||0)),[error,setError]=useState("");const root=useRef<HTMLElement>(null);
  async function refresh(background=Boolean(data)){if(background)setRefreshing(true);else setLoading(true);setError("");try{const next=await loadAll();setData(next);setCachedAt(Date.now());writeCache(next)}catch(e){setError(e instanceof Error?e.message:"分析データを取得できませんでした")}finally{setLoading(false);setRefreshing(false)}}
  useEffect(()=>{void refresh(Boolean(data))},[revision]);
  const articles=useMemo(()=>normalizeArticles(data?.topArticles||[]),[data]);
  if(loading)return <section className="mipro-state">公式Dashboard＋本人通知を統合分析中…</section>;
  if(error&&!data)return <section className="mipro-state error">⚠ {error}<button onClick={()=>void refresh()}>再試行</button></section>;
  const latest=data?.latestDashboard||{},noteId=String(data?.noteId||"").replace(/^@/,"").toLowerCase(),metrics=metricRows(data),followers:Row[]=data?.followers||[],latestFollower=followers.at(-1),trafficRows:Row[]=data?.traffic?.rows||[],trafficTotal=Math.max(0,num(data?.traffic?.total)||sum(trafficRows.map(r=>num(r.pv)))),notifications:Row[]=data?.notifications?.rows||[];
  const comparable=articles.filter(r=>r.conversion!=null),invalid=articles.filter(r=>r.impressions>0&&r.pageViews>r.impressions),convVals=comparable.map(r=>r.conversion as number),convMed=median(convVals),conv75=q75(convVals),pvVals=articles.map(r=>r.pageViews),pvMed=median(pvVals),reactVals=articles.filter(r=>r.reactionsPer1k!=null).map(r=>r.reactionsPer1k as number),reactMed=median(reactVals),react75=q75(reactVals);
  const improvementPv=comparable.length>=5?Math.round(sum(comparable.map(r=>Math.max(0,r.impressions*convMed/100-r.pageViews)))):null;
  const impMed=median(comparable.map(r=>r.impressions)),leaks=comparable.filter(r=>r.impressions>=impMed&&(r.conversion as number)<convMed).sort((a,b)=>(b.impressions*(convMed-(b.conversion as number)))-(a.impressions*(convMed-(a.conversion as number)))).slice(0,6),gems=articles.filter(r=>r.pageViews>0&&r.pageViews<=pvMed&&(r.reactionsPer1k??0)>=react75).sort((a,b)=>(b.reactionsPer1k??0)-(a.reactionsPer1k??0)).slice(0,6);
  const totalPv=sum(articles.map(r=>r.pageViews)),top5Pv=sum([...articles].sort((a,b)=>b.pageViews-a.pageViews).slice(0,5).map(r=>r.pageViews)),pvConcentration=totalPv?top5Pv/totalPv*100:0,totalSales=sum(articles.map(r=>r.salesYen)),top5Sales=sum([...articles].sort((a,b)=>b.salesYen-a.salesYen).slice(0,5).map(r=>r.salesYen)),salesConcentration=totalSales?top5Sales/totalSales*100:0;
  const last7=calendarWindow(metrics,7),prev7=calendarWindow(metrics,7,7),pv7=sum(last7.map(r=>r.pageViews)),pvPrev=sum(prev7.map(r=>r.pageViews)),sales7=sum(last7.map(r=>r.salesYen)),salesPrev=sum(prev7.map(r=>r.salesYen));
  const weekdays=["日","月","火","水","木","金","土"].map((label,idx)=>{const rows=metrics.filter(r=>{const d=new Date(`${r.date}T12:00:00+09:00`);return !Number.isNaN(d.getTime())&&d.getDay()===idx});return{label:`${label}曜`,value:avg(rows.map(r=>r.pageViews)),sub:`${rows.length}日`}});
  const groups:Record<string,number>=data?.traffic?.groups||{},shares=Object.entries(groups).map(([k,v])=>({k,value:num(v)})).filter(x=>x.value>0),hhi=trafficTotal?sum(shares.map(x=>Math.pow(x.value/trafficTotal,2))):1,diversity=shares.length>1?Math.max(0,Math.min(100,(1-hhi)/(1-1/shares.length)*100)):0,groupLabel:Record<string,string>={note:"note内",notification:"通知",search:"検索",social:"SNS",direct:"直接/不明",external:"外部"};
  const notifByDay=new Map<string,number>();for(const r of notifications){const d=jstDay(r.occurred_at||r.captured_at);if(d)notifByDay.set(d,(notifByDay.get(d)||0)+1)}const pairs=metrics.map(r=>({date:r.date,pv:r.pageViews,notif:notifByDay.get(r.date)||0})).filter(r=>r.pv||r.notif),corr=pearson(pairs.map(x=>x.notif),pairs.map(x=>x.pv)),notifMedian=median(pairs.map(x=>x.notif)),highNotif=pairs.filter(x=>x.notif>notifMedian),lowNotif=pairs.filter(x=>x.notif<=notifMedian),highPv=avg(highNotif.map(x=>x.pv)),lowPv=avg(lowNotif.map(x=>x.pv));
  const qualityChecks=[Boolean(latest.pageViews||latest.views),articles.length>0,metrics.length>=7,trafficTotal>0,followers.length>0,notifications.length>0],quality=qualityChecks.filter(Boolean).length;
  const ranked=[...articles].sort((a,b)=>b.score-a.score);
  const syncHref=dashboardHref(noteId);
  const openAll=(open:boolean)=>root.current?.querySelectorAll<HTMLDetailsElement>("details.mipro-fold").forEach(x=>x.open=open);
  const cacheAge=cachedAt?Date.now()-cachedAt:0,cacheStale=Boolean(cachedAt&&cacheAge>6*60*60*1000);
  return <section className="mipro" ref={root}>
    <header className="mipro-head"><div><small>INSIGHT PRO ANALYTICS V3</small><h2>公式Dashboardを超えて「意味のある判断」まで</h2><p><strong>@{noteId||"—"}</strong> の公式値＋本人通知を統合。保存済み分析は即表示し、最新取得は画面を止めずに更新します。</p>{cachedAt?<span className={`mipro-cache-state ${cacheStale?"stale":""}`}>{refreshing?"↻ 最新データをバックグラウンド更新中":cacheStale?"保存済み表示・更新待ち":`保存済み即表示 ${jtime(new Date(cachedAt).toISOString())}`}</span>:null}</div><div className="mipro-head-actions">{onBack?<button onClick={onBack}>←戻る</button>:null}<a href={syncHref}>Dashboard更新</a><button disabled={refreshing} onClick={()=>void refresh(true)}>{refreshing?"更新中…":"再分析"}</button></div></header>
    {error?<p className="mipro-warning">更新失敗・保存済みの分析を表示中：{error}</p>:null}
    <div className="mipro-release"><span>本体 {CURRENT_INSIGHT_APP_VERSION}</span><span>Dashboard {CURRENT_DASHBOARD_VERSION}</span><span>本人通知 {CURRENT_NOTIFICATION_VERSION}</span><span>照合 @{noteId||"—"}</span></div>
    <div className="mipro-fold-controls"><button onClick={()=>openAll(true)}>分析をすべて開く</button><button onClick={()=>openAll(false)}>すべて収納</button></div>

    <Fold title="① 公式Dashboard 現在値" sub="PV・Imp・スキ・コメント・売上・フォロワー">
      <Kpis items={[{label:"ページビュー(PV)",value:n(latest.pageViews??latest.views),sub:"note公式Dashboard"},{label:"インプレッション(Imp)",value:n(latest.impressions),sub:"note内表示回数"},{label:"スキ",value:n(latest.likes),sub:"公式集計"},{label:"コメント",value:n(latest.comments),sub:"公式集計"},{label:"売上",value:money(latest.salesYen),sub:"公式集計"},{label:"フォロワー",value:`${n(latestFollower?.count)}人`,sub:"最新保存値"}]}/>
      <div className="mipro-note">公式取得 {jtime(latest.officialCollectedAt||latest.capturedAt)} ／ INSIGHT保存 {jtime(latest.capturedAt)}</div>
    </Fold>

    <Fold title="② データ品質・数値の意味" sub={`充足 ${quality}/6 ・ PV化比較可能 ${comparable.length}/${articles.length}記事`}>
      <Kpis items={[{label:"データ充足",value:`${quality}/6`,sub:"公式総計・記事別・時系列・流入・フォロワー・本人通知"},{label:"PV化比較可能",value:`${comparable.length}記事`,sub:"PVがImp以下で同一比較できる記事だけ"},{label:"比較除外",value:`${invalid.length}記事`,sub:"PV>Impは集計範囲不一致として率計算しない"},{label:"日別系列",value:`${metrics.length}日`,sub:"成長・曜日分析に使用"}]}/>
      <p className="mipro-warning"><b>重要:</b> PVとImpは記事によって集計範囲が一致しない場合があります。<strong>PV÷Impが100%を超える行は「高性能」と解釈せず、PV化率・潜在PVの計算から除外</strong>します。以前の572%・1431.9%のような表示は出しません。</p>
    </Fold>

    <Fold title="③ 成長推移" sub={`直近7日PV ${n(pv7)} / 前7日比 ${pct(deltaPct(pv7,pvPrev),0)}`}>
      <Kpis items={[{label:"直近7日PV",value:metrics.length?n(pv7):"日別未取得",sub:`前7日比 ${pct(deltaPct(pv7,pvPrev),0)}`},{label:"直近7日売上",value:metrics.length?money(sales7):"日別未取得",sub:`前7日比 ${pct(deltaPct(sales7,salesPrev),0)}`},{label:"記事PV中央値",value:n(pvMed),sub:"外れ値に強い本人内基準"},{label:"上位5記事PV集中",value:pct(pvConcentration),sub:pvConcentration>=65?"上位依存が強い":"分散できている"}]}/>
      <TrendChart rows={metrics.length?metrics:snapshotRows(data)} cumulative={!metrics.length}/>
    </Fold>

    <Fold title="④ 記事ベンチマーク" sub="中央値・上位25%・反応効率を本人内で比較">
      <Kpis items={[{label:"記事PV中央値",value:n(pvMed),sub:"全記事の中央水準"},{label:"反応/1,000PV 中央値",value:n(reactMed),sub:"(スキ+コメント)÷PV×1,000"},{label:"PV化中央値",value:comparable.length>=5?pct(convMed):"算出停止",sub:"比較可能記事のみ"},{label:"PV化 上位25%境界",value:comparable.length>=5?pct(conv75):"算出停止",sub:"比較可能記事のみ"}]}/>
      <p className="mipro-note">「反応率」ではなく<strong>1,000PVあたり何件の反応があるか</strong>で表示。確率と誤解しない単位に変更しています。</p>
    </Fold>

    <Fold title="⑤ 改善余地・隠れた強記事" sub={improvementPv==null?"PV化の比較可能記事が不足":`比較可能記事だけのPV改善余地 +${n(improvementPv)}`}>
      <Kpis items={[{label:"PV改善余地",value:improvementPv==null?"算出停止":`+${n(improvementPv)}`,sub:improvementPv==null?"比較可能記事5件以上で算出":"PV化中央値まで改善した場合の差分"},{label:"取りこぼし候補",value:`${leaks.length}件`,sub:"Imp多・PV化が本人中央値未満"},{label:"隠れた強記事",value:`${gems.length}件`,sub:"PV少なめ・反応/1,000PVが上位25%"},{label:"分析母数",value:`${articles.length}記事`,sub:"公式記事別データ"}]}/>
      <div className="mipro-twocol"><section><h4>⚠ 露出の取りこぼし</h4>{leaks.length?leaks.map(r=><a href={r.url||undefined} target="_blank" rel="noreferrer" key={r.article_key||r.url||r.title}><b>{short(r.title)}</b><span>Imp {n(r.impressions)} / PV {n(r.pageViews)} / PV化 {pct(r.conversion)}</span></a>):<p>比較可能データ内では大きな取りこぼしなし。</p>}</section><section><h4>💎 隠れた強記事</h4>{gems.length?gems.map(r=><a href={r.url||undefined} target="_blank" rel="noreferrer" key={r.article_key||r.url||r.title}><b>{short(r.title)}</b><span>PV {n(r.pageViews)} / 反応 {n(r.reactionsPer1k)}件/1,000PV</span></a>):<p>条件に合う記事はまだありません。</p>}</section></div>
    </Fold>

    <Fold title="⑥ 流入分析" sub={`流入PV ${n(trafficTotal)} ・ 分散度 ${diversity.toFixed(0)}/100`}>
      <Kpis items={[{label:"流入分散度",value:`${diversity.toFixed(0)}/100`,sub:"1媒体への偏りが少ないほど高い"},{label:"検索",value:pct(trafficTotal?num(groups.search)/trafficTotal*100:0),sub:`${n(groups.search)} PV`},{label:"通知",value:pct(trafficTotal?num(groups.notification)/trafficTotal*100:0),sub:`${n(groups.notification)} PV`},{label:"外部",value:pct(trafficTotal?num(groups.external)/trafficTotal*100:0),sub:`${n(groups.external)} PV`}]}/>
      <Bars items={shares.map(x=>({label:groupLabel[x.k]||x.k,value:x.value,sub:trafficTotal?pct(x.value/trafficTotal*100):"—"}))}/>
    </Fold>

    <Fold title="⑦ 収益分析" sub={`売上 ${money(latest.salesYen)} ・ 1,000PV売上 ${money(num(latest.pageViews??latest.views)>0?num(latest.salesYen)/num(latest.pageViews??latest.views)*1000:0)}`}>
      <Kpis items={[{label:"公式売上",value:money(latest.salesYen),sub:"Dashboard総計"},{label:"1,000PV売上",value:money(num(latest.pageViews??latest.views)>0?num(latest.salesYen)/num(latest.pageViews??latest.views)*1000:0),sub:"PVあたり収益効率"},{label:"売上あり記事",value:`${articles.filter(r=>r.salesYen>0).length}件`,sub:`全${articles.length}記事`},{label:"上位5記事売上集中",value:pct(salesConcentration),sub:salesConcentration>=70?"上位依存が強い":"分散あり"}]}/>
      <Bars items={[...articles].filter(r=>r.salesYen>0).sort((a,b)=>b.salesYen-a.salesYen).slice(0,10).map(r=>({label:short(r.title,28),value:r.salesYen,sub:r.pageViews>0?`${money(r.revenuePer1k)}/1,000PV`:"PVなし"}))}/>
    </Fold>

    <Fold title="⑧ 曜日別パフォーマンス" sub="公式日別PVを曜日ごとの平均PVで比較">
      <Bars items={weekdays}/>
      <p className="mipro-note">曜日ごとの<strong>平均PV/日</strong>です。「平均」が何の平均か分からない表示は使いません。</p>
    </Fold>

    <Fold title="⑨ 本人通知 × PV クロス分析" sub={corr==null?"重なる日別データ7日以上で算出":`同日相関 ${corr.toFixed(2)}`}>
      <Kpis items={[{label:"通知サンプル",value:`${n(notifications.length)}件`,sub:data?.notifications?.truncated?"直近1,000件まで":"取得範囲内"},{label:"重複日",value:`${pairs.length}日`,sub:"通知件数と公式PVを日単位で照合"},{label:"通知↔PV 同日相関",value:corr==null?"算出待ち":corr.toFixed(2),sub:"相関であり因果ではありません"},{label:"通知多い日/少ない日",value:highNotif.length&&lowNotif.length?`${n(highPv)} / ${n(lowPv)} PV`:"—",sub:"それぞれの平均PV/日"}]}/>
      {pairs.length?<div className="mipro-scatter">{pairs.slice(-45).map((x,i)=>{const maxN=Math.max(1,...pairs.map(p=>p.notif)),maxP=Math.max(1,...pairs.map(p=>p.pv));return <i key={`${x.date}-${i}`} title={`${x.date} 通知${x.notif} / PV${x.pv}`} style={{left:`${Math.min(96,2+x.notif/maxN*92)}%`,bottom:`${Math.min(92,4+x.pv/maxP*84)}%`}}/>})}<span>横=通知件数 / 縦=PV</span></div>:null}
      <p className="mipro-note">本人通知は「誰が・何に反応したか」、公式DashboardはPV・売上。別ソースを混同せず、<strong>日付で照合して関係を見る</strong>分析です。</p>
    </Fold>

    <Fold title="⑩ 記事総合ランキング" sub="最大値依存をやめ、本人内パーセンタイルで評価">
      <div className="mipro-table"><div className="head"><span>記事</span><span>指数</span><span>PV</span><span>PV化</span><span>反応/1kPV</span><span>売上</span></div>{ranked.slice(0,40).map(r=><a href={r.url||undefined} target="_blank" rel="noreferrer" key={r.article_key||r.url||r.title}><span>{short(r.title,34)}</span><b>{r.score}</b><em>{n(r.pageViews)}</em><em>{pct(r.conversion)}</em><em>{r.reactionsPer1k==null?"—":n(r.reactionsPer1k)}</em><em>{money(r.salesYen)}</em></a>)}</div>
      <p className="mipro-note">INSIGHT指数はPV 35%・反応効率25%・1,000PV売上20%・売上10%・比較可能なPV化10%を<strong>本人内順位</strong>で合成。1本の極端な記事に全体評価を引っ張られにくくしています。</p>
    </Fold>
  </section>
}
