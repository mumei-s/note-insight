import { useEffect, useState } from "react";
import { INSIGHT_TOKEN_KEY } from "./insight-account-store";
import {
  CURRENT_DASHBOARD_VERSION,
  CURRENT_NOTIFICATION_VERSION,
} from "./insight-release";
import { MemberInsightAnalyticsProV3 } from "./member-insight-analytics-pro-v3";
import "./member-insight-analysis-hub.css";

const FEED="https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-notification-feed-final";
const PAGE=100;
type Row=Record<string,any>;
const nf=new Intl.NumberFormat("ja-JP");
const n=(v:any)=>nf.format(Number(v||0));
const clean=(v:any)=>String(v||"").replace(/\s+/g," ").trim();
const typeOf=(r:Row)=>String(r.display_category||r.notification_type||"other");
const eventAt=(r:Row)=>Date.parse(String(r.occurred_at||r.captured_at||""))||0;
const actorKey=(r:Row)=>String(r.actor_url||r.actor_name||"").toLowerCase();
const TYPE_LABEL:Record<string,string>={like:"スキ",comment_like:"コメント♡",comment:"コメント",reply:"返信",reply_self:"自分の記事返信",reply_other:"相手の記事返信",follow:"フォロー",creator_article_posted:"記事投稿",magazine_follow:"マガジンフォロー",my_article_magazine_added:"自分の記事追加",magazine_article_added:"マガジン記事追加",magazine_join:"マガジン参加",membership_board:"メンシプ掲示板",membership_board_reply:"掲示板返信",membership_reaction:"メンシプ反応",membership_reaction_self:"自分のメンシプ反応",membership_reaction_joined:"参加中メンシプ反応",membership_started:"メンシプ開始",membership_plan:"プラン追加",membership_join:"メンシプ参加",purchase:"購入",tip:"チップ・サポート",buzz:"話題",rating:"高評価",points:"ポイント",quote:"引用・紹介",other:"その他"};
const dayKey=(ms:number)=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(ms));

async function postFeed(body:Record<string,unknown>){
  const token=localStorage.getItem(INSIGHT_TOKEN_KEY)||"";
  if(!token)throw new Error("INSIGHT_LOGIN_REQUIRED");
  const c=new AbortController(),timer=window.setTimeout(()=>c.abort(),45000);
  try{
    const r=await fetch(FEED,{method:"POST",headers:{"Content-Type":"application/json","X-Insight-Token":token},body:JSON.stringify(body),cache:"no-store",signal:c.signal});
    const p=await r.json().catch(()=>({}));
    if(!r.ok||p?.ok===false)throw new Error(p?.error||"本人通知分析データを取得できませんでした");
    return p;
  }finally{window.clearTimeout(timer)}
}
async function loadAllNotifications(){
  const first=await postFeed({kind:"all",page:1,pageSize:PAGE});
  const total=Math.max(0,Number(first.total||0)),actualPages=Math.max(1,Math.ceil(total/PAGE)),pages=Math.min(120,actualPages),rows:Row[]=[...(first.rows||[])];
  for(let start=2;start<=pages;start+=6){
    const nums=Array.from({length:Math.min(6,pages-start+1)},(_,i)=>start+i),packs=await Promise.all(nums.map(page=>postFeed({kind:"all",page,pageSize:PAGE})));
    for(const p of packs)rows.push(...(p.rows||[]));
  }
  const seen=new Set<string>(),unique:Row[]=[];
  for(const r of rows){const k=String(r.id||`${typeOf(r)}|${clean(r.raw_text)}|${r.actor_url||""}|${r.target_url||""}|${r.occurred_at||r.captured_at||""}`);if(seen.has(k))continue;seen.add(k);unique.push(r)}
  return{rows:unique,total,lastUpdatedAt:first.lastUpdatedAt||null,lastSyncAt:first.lastSyncAt||null,truncated:pages<actualPages};
}
function summarize(input:{rows:Row[];total:number;lastUpdatedAt?:string|null;lastSyncAt?:string|null;truncated?:boolean}){
  const rows=input.rows,now=Date.now(),day=86400000,types=new Map<string,number>(),actors=new Map<string,{name:string;url:string;count:number;last:number}>(),hours=Array(24).fill(0),week=Array(7).fill(0),days=new Map<string,number>();
  let recent7=0,prev7=0,comments=0,membership=0,money=0,likes=0,follows=0,other=0;
  for(const r of rows){
    const t=typeOf(r),at=eventAt(r);types.set(t,(types.get(t)||0)+1);if(t==="other")other++;
    if(at>=now-7*day)recent7++;else if(at>=now-14*day)prev7++;
    if(/comment|reply|membership_board_reply/.test(t))comments++;
    if(t.startsWith("membership_"))membership++;
    if(t==="purchase"||t==="tip")money++;
    if(t==="like"||t==="comment_like"||t.startsWith("membership_reaction"))likes++;
    if(t==="follow")follows++;
    const k=actorKey(r);if(k){const prev=actors.get(k),name=clean(r.actor_name)||"noteユーザー",url=String(r.actor_url||"");if(prev){prev.count++;prev.last=Math.max(prev.last,at)}else actors.set(k,{name,url,count:1,last:at})}
    if(at){
      days.set(dayKey(at),(days.get(dayKey(at))||0)+1);
      const d=new Date(at),parts=new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Tokyo",hour:"2-digit",hour12:false,weekday:"short"}).formatToParts(d),h=Number(parts.find(x=>x.type==="hour")?.value||0),wd=parts.find(x=>x.type==="weekday")?.value||"Sun",wi=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].indexOf(wd);
      if(Number.isFinite(h)&&h>=0&&h<24)hours[h]++;if(wi>=0)week[wi]++;
    }
  }
  const topTypes=[...types.entries()].sort((a,b)=>b[1]-a[1]).slice(0,10),topActors=[...actors.values()].sort((a,b)=>b.count-a.count||b.last-a.last).slice(0,12),peakHour=hours.indexOf(Math.max(...hours)),peakWeek=week.indexOf(Math.max(...week)),weekName=["日","月","火","水","木","金","土"][Math.max(0,peakWeek)],sample=Math.max(1,rows.length),topActorShare=Math.max(0,Math.min(100,topActors.length?topActors[0].count/sample*100:0));
  const last14=Array.from({length:14},(_,i)=>{const ms=now-(13-i)*day,k=dayKey(ms);return{k,label:k.slice(5).replace("-","/"),v:days.get(k)||0}});
  const timeBands=[{k:"深夜 0–5",v:hours.slice(0,6).reduce((a,b)=>a+b,0)},{k:"朝 6–11",v:hours.slice(6,12).reduce((a,b)=>a+b,0)},{k:"昼 12–17",v:hours.slice(12,18).reduce((a,b)=>a+b,0)},{k:"夜 18–23",v:hours.slice(18,24).reduce((a,b)=>a+b,0)}];
  const coverage=input.total?Math.min(100,rows.length/input.total*100):100,classifiedRate=sample?Math.max(0,100-other/sample*100):100;
  return{...input,sample,recent7,prev7,comments,membership,money,likes,follows,people:actors.size,topTypes,topActors,peakHour,weekName,topActorShare,last14,timeBands,coverage,classifiedRate,other};
}
function Bars({items,total}:{items:{k:string;v:number}[];total?:number}){const max=Math.max(1,...items.map(x=>x.v));return <>{items.map(x=><div className="miah-bar" key={x.k}><span>{x.k}</span><i><b style={{width:`${Math.max(3,Math.min(100,x.v/max*100))}%`}}/></i><em>{n(x.v)}件{total?` ${(x.v/Math.max(1,total)*100).toFixed(0)}%`:""}</em></div>)}</>}
function NotificationDeepAnalysis(){
  const[data,setData]=useState<any>(null),[loading,setLoading]=useState(true),[error,setError]=useState("");
  async function load(){setLoading(true);setError("");try{setData(summarize(await loadAllNotifications()))}catch(e){setError(e instanceof Error?e.message:"本人通知分析に失敗しました")}finally{setLoading(false)}}
  useEffect(()=>{void load()},[]);
  if(loading)return <section className="miah-notification"><b>🔔 本人通知分析を作成中…</b><span>保存済み通知を全ページから分類・人物・日別・時間帯まで再集計しています。</span></section>;
  if(error)return <section className="miah-notification error"><b>⚠ 本人通知分析</b><span>{error}</span><button className="miah-reload" onClick={()=>void load()}>再読込</button></section>;
  if(!data?.sample)return <section className="miah-notification"><b>🔔 本人通知分析</b><span>保存済み本人通知がまだありません。</span></section>;
  const delta=data.prev7?((data.recent7-data.prev7)/data.prev7*100):data.recent7?100:0;
  return <section className="miah-notification"><header><div><small>NOTIFICATION DEEP ANALYSIS V4</small><h3>本人通知の人物・交流分析</h3></div><div className="miah-head-actions"><span>{data.truncated?`取得${n(data.sample)} / 保存${n(data.total)}`:`保存${n(data.sample)}件を全件分析`}</span><button onClick={()=>void load()}>↻ 再集計</button></div></header>
    <div className="miah-kpis"><article><small>直近7日</small><b>{n(data.recent7)}件</b><span>前7日比 {delta>=0?"+":""}{delta.toFixed(0)}%</span></article><article><small>反応者</small><b>{n(data.people)}人</b><span>通知内ユニーク</span></article><article><small>コメント系</small><b>{n(data.comments)}件</b><span>コメント・返信・掲示板返信</span></article><article><small>メンシプ系</small><b>{n(data.membership)}件</b><span>参加・反応・掲示板</span></article><article><small>購入/支援</small><b>{n(data.money)}件</b><span>購入＋チップ</span></article><article><small>分類精度</small><b>{data.classifiedRate.toFixed(1)}%</b><span>その他 {n(data.other)}件</span></article></div>
    <div className="miah-grid"><article><h4>通知カテゴリ構成</h4>{data.topTypes.map(([k,v]:[string,number])=><div className="miah-bar" key={k}><span>{TYPE_LABEL[k]||k}</span><i><b style={{width:`${Math.max(4,Math.min(100,v/data.sample*100))}%`}}/></i><em>{n(v)}件</em></div>)}</article><article><h4>反応が多い人</h4>{data.topActors.slice(0,10).map((a:any,i:number)=><a key={`${a.url||a.name}-${i}`} href={a.url||undefined} target="_blank" rel="noreferrer"><b>{i+1}</b><span>{a.name}</span><em>{n(a.count)}件</em></a>)}</article><article><h4>直近14日・日別推移</h4><Bars items={data.last14.map((x:any)=>({k:x.label,v:x.v}))}/></article><article><h4>時間帯の偏り</h4><Bars items={data.timeBands}/></article></div>
    <div className="miah-insights"><span><b>{data.peakHour}時台</b>に通知が最も集中</span><span><b>{data.weekName}曜日</b>が最多</span><span><b>{data.topActorShare.toFixed(1)}%</b>最多反応者への集中率</span><span><b>{data.coverage.toFixed(1)}%</b>保存件数に対する分析取得率</span></div><p>本人通知は公式PV・売上を上書きせず、<strong>「誰が・何に・いつ反応したか」</strong>を追加します。Dashboard同期が無くても、この通知分析単体は利用できます。</p></section>;
}

export function MemberInsightAnalysisHub({revision=0,onBack,noteId="",dashboardInstalled="",notificationInstalled="",dashboardLatest="",notificationLatest=""}:{revision?:number;onBack?:()=>void;noteId?:string;dashboardInstalled?:string;notificationInstalled?:string;dashboardLatest?:string;notificationLatest?:string}){
  const cleanNoteId=String(noteId||"").match(/[A-Za-z0-9_-]+/)?.[0]?.toLowerCase()||"",role=cleanNoteId==="ss_yr"?"owner":"member",setupHref=`./dashboard-setup.html?from=analysis&role=${role}&account=${encodeURIComponent(cleanNoteId)}&return=${encodeURIComponent(window.location.href)}&auto=0`,dashboardReady=dashboardInstalled===CURRENT_DASHBOARD_VERSION||Boolean(dashboardInstalled&&!dashboardLatest),notificationReady=notificationInstalled===CURRENT_NOTIFICATION_VERSION||Boolean(notificationInstalled&&!notificationLatest),dashboardNeedsUpdate=Boolean(dashboardLatest&&dashboardInstalled!==dashboardLatest),notificationNeedsUpdate=Boolean(notificationLatest&&notificationInstalled!==notificationLatest),dashboardUsable=dashboardReady&&!dashboardNeedsUpdate,notificationUsable=notificationReady&&!notificationNeedsUpdate,allReady=dashboardUsable&&notificationUsable;
  return <section className="miah"><div className="miah-paths"><article className={allReady?"active":""}><a className="miah-path-main" href={setupHref}><strong>📊 Dashboard分析を準備 / 更新</strong><small>公式Dashboardクロス分析は2ツール使用</small><span>Dashboard同期＋本人通知をそろえるとPV・流入・収益と人物反応を横断分析します。</span></a><span className="miah-ready">{allReady?`✓ Dashboard v${dashboardInstalled} / 本人通知 v${notificationInstalled} 利用可能`:notificationUsable?`✓ 本人通知 v${notificationInstalled} 単体分析可能`:"ツール状態を確認してください"}</span></article></div><p className="miah-rule"><b>分析レイヤーを分離：</b><strong>本人通知だけでも人物・交流分析を実行</strong>。Dashboard同期が加わった場合のみ、公式PV・売上・流入とのクロス分析を追加します。インストール不要の公開データ分析は、アカウント切替横の「詳細分析」を使います。</p>
    <section className="miah-analysis-layer base"><header className="miah-layer-head"><div><small>DASHBOARD ANALYSIS V3</small><h2>📊 公式Dashboard＋INSIGHT Pro分析</h2><p>公式Dashboardの生値を正本にし、データ品質を判定してから本人内ベンチマーク・流入・収益・通知とのクロス分析まで行います。</p></div><span>{allReady?"2ツール準備済み":"Dashboardクロス分析は2ツール"}</span></header><div className="miah-layer-tags"><span>公式値</span><span>データ品質</span><span>成長推移</span><span>本人内ベンチマーク</span><span>流入</span><span>収益</span><span>曜日</span><span>通知×PV</span><span>記事指数</span></div>{allReady?<MemberInsightAnalyticsProV3 revision={revision} onBack={onBack}/>:<div className="miah-notification-locked"><b>公式Dashboardクロス分析は2つのツールを準備してください。</b><span>本人通知だけ導入済みなら、下の人物・交流分析はそのまま使えます。</span><a href={setupHref}>ブラウザ別パネルを開く</a></div>}</section>
    <details className="miah-analysis-layer notice miah-fold" open><summary><b>🔔 本人通知の人物・交流分析</b><span>人物別反応・14日推移・時間帯・コメント・メンシプ・購入/支援</span></summary><div className="miah-fold-body">{notificationUsable?<NotificationDeepAnalysis/>:<div className="miah-notification-locked"><b>本人通知ツールが未導入または旧版です。</b><span>本人通知だけ導入すれば、この分析はDashboard同期なしでも使えます。</span><a href={setupHref}>導入パネルを開く</a></div>}</div></details>
  </section>;
}