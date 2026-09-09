import { useEffect, useState } from "react";
import { INSIGHT_TOKEN_KEY } from "./insight-account-store";
import {
  CURRENT_DASHBOARD_VERSION,
  CURRENT_NOTIFICATION_VERSION,
} from "./insight-release";
import { MemberInsightAnalyticsBase } from "./member-insight-analytics-base";
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
const TYPE_LABEL:Record<string,string>={like:"スキ",comment_like:"コメント♡",comment:"コメント",reply_self:"自分の記事返信",reply_other:"相手の記事返信",follow:"フォロー",creator_article_posted:"記事投稿",magazine_follow:"マガジンフォロー",my_article_magazine_added:"自分の記事追加",magazine_article_added:"マガジン記事追加",magazine_join:"マガジン参加",membership_board:"メンシプ掲示板",membership_board_reply:"掲示板返信",membership_reaction_self:"自分のメンシプ反応",membership_reaction_joined:"参加中メンシプ反応",membership_started:"メンシプ開始",membership_plan:"プラン追加",membership_join:"メンシプ参加",purchase:"購入",tip:"チップ・サポート",buzz:"話題",rating:"高評価",points:"ポイント",quote:"引用・紹介",other:"その他"};

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
  const total=Math.max(0,Number(first.total||0)),pages=Math.min(50,Math.max(1,Math.ceil(total/PAGE))),rows:Row[]=[...(first.rows||[])];
  for(let start=2;start<=pages;start+=4){
    const nums=Array.from({length:Math.min(4,pages-start+1)},(_,i)=>start+i);
    const packs=await Promise.all(nums.map(page=>postFeed({kind:"all",page,pageSize:PAGE})));
    for(const p of packs)rows.push(...(p.rows||[]));
  }
  const seen=new Set<string>(),unique:Row[]=[];
  for(const r of rows){const k=String(r.id||`${typeOf(r)}|${clean(r.raw_text)}|${r.actor_url||""}|${r.occurred_at||r.captured_at||""}`);if(seen.has(k))continue;seen.add(k);unique.push(r)}
  return{rows:unique,total,lastUpdatedAt:first.lastUpdatedAt||null,lastSyncAt:first.lastSyncAt||null,truncated:pages<Math.ceil(Math.max(1,total)/PAGE)};
}

function summarize(input:{rows:Row[];total:number;lastUpdatedAt?:string|null;lastSyncAt?:string|null;truncated?:boolean}){
  const rows=input.rows,now=Date.now(),day=86400000,types=new Map<string,number>(),actors=new Map<string,{name:string;url:string;count:number;last:number}>(),hours=Array(24).fill(0),week=Array(7).fill(0);
  let recent7=0,prev7=0,comments=0,membership=0,money=0,likes=0,follows=0;
  for(const r of rows){
    const t=typeOf(r),at=eventAt(r);types.set(t,(types.get(t)||0)+1);
    if(at>=now-7*day)recent7++;else if(at>=now-14*day)prev7++;
    if(/comment|reply|membership_board_reply/.test(t))comments++;
    if(t.startsWith("membership_"))membership++;
    if(t==="purchase"||t==="tip")money++;
    if(t==="like"||t==="comment_like"||t.startsWith("membership_reaction"))likes++;
    if(t==="follow")follows++;
    const k=actorKey(r);if(k){const prev=actors.get(k),name=clean(r.actor_name)||"noteユーザー",url=String(r.actor_url||"");if(prev){prev.count++;prev.last=Math.max(prev.last,at)}else actors.set(k,{name,url,count:1,last:at})}
    if(at){const d=new Date(at),parts=new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Tokyo",hour:"2-digit",hour12:false,weekday:"short"}).formatToParts(d),h=Number(parts.find(x=>x.type==="hour")?.value||0),wd=parts.find(x=>x.type==="weekday")?.value||"Sun",wi=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].indexOf(wd);if(Number.isFinite(h)&&h>=0&&h<24)hours[h]++;if(wi>=0)week[wi]++}
  }
  const topTypes=[...types.entries()].sort((a,b)=>b[1]-a[1]).slice(0,8),topActors=[...actors.values()].sort((a,b)=>b.count-a.count||b.last-a.last).slice(0,10),peakHour=hours.indexOf(Math.max(...hours)),peakWeek=week.indexOf(Math.max(...week)),weekName=["日","月","火","水","木","金","土"][Math.max(0,peakWeek)],sample=Math.max(1,rows.length),topActorShare=Math.max(0,Math.min(100,topActors.length?topActors[0].count/sample*100:0));
  return{...input,sample,recent7,prev7,comments,membership,money,likes,follows,people:actors.size,topTypes,topActors,peakHour,weekName,topActorShare};
}

function NotificationDeepAnalysis(){
  const[data,setData]=useState<any>(null),[loading,setLoading]=useState(true),[error,setError]=useState("");
  async function load(){setLoading(true);setError("");try{setData(summarize(await loadAllNotifications()))}catch(e){setError(e instanceof Error?e.message:"本人通知追加分析に失敗しました")}finally{setLoading(false)}}
  useEffect(()=>{void load()},[]);
  if(loading)return <section className="miah-notification"><b>🔔 本人通知の追加分析を作成中…</b><span>保存済み通知を分類・人物・時間帯まで再集計しています。</span></section>;
  if(error)return <section className="miah-notification error"><b>⚠ 本人通知追加分析</b><span>{error}</span></section>;
  if(!data?.sample)return <section className="miah-notification"><b>🔔 本人通知追加分析</b><span>保存済み本人通知がまだありません。本人通知を導入してnoteの通知を保存すると、ここへ追加分析が出ます。</span></section>;
  const delta=data.prev7?((data.recent7-data.prev7)/data.prev7*100):data.recent7?100:0;
  return <section className="miah-notification">
    <header><div><small>NOTIFICATION DEEP ANALYSIS</small><h3>本人通知で追加する分析</h3></div><span>{data.truncated?`直近${n(data.sample)}件を分析`:`保存${n(data.sample)}件を分析`}</span></header>
    <div className="miah-kpis"><article><small>直近7日</small><b>{n(data.recent7)}件</b><span>前7日比 {delta>=0?"+":""}{delta.toFixed(0)}%</span></article><article><small>反応者</small><b>{n(data.people)}人</b><span>通知内ユニーク</span></article><article><small>コメント系</small><b>{n(data.comments)}件</b><span>コメント・返信・掲示板返信</span></article><article><small>メンシプ系</small><b>{n(data.membership)}件</b><span>参加・反応・掲示板</span></article><article><small>購入/支援</small><b>{n(data.money)}件</b><span>購入＋チップ</span></article><article><small>リアクション</small><b>{n(data.likes)}件</b><span>スキ・コメント♡等</span></article></div>
    <div className="miah-grid"><article><h4>通知カテゴリ構成</h4>{data.topTypes.map(([k,v]:[string,number])=><div className="miah-bar" key={k}><span>{TYPE_LABEL[k]||k}</span><i><b style={{width:`${Math.max(4,Math.min(100,v/data.sample*100))}%`}}/></i><em>{n(v)}件</em></div>)}</article><article><h4>反応が多い人</h4>{data.topActors.slice(0,8).map((a:any,i:number)=><a key={`${a.url||a.name}-${i}`} href={a.url||undefined} target="_blank" rel="noreferrer"><b>{i+1}</b><span>{a.name}</span><em>{n(a.count)}件</em></a>)}</article></div>
    <div className="miah-insights"><span><b>{data.peakHour}時台</b>に通知が最も集中</span><span><b>{data.weekName}曜日</b>が最多</span><span><b>{data.topActorShare.toFixed(1)}%</b>が最多反応者への集中率</span><span><b>{n(data.follows)}件</b>人物フォロー</span></div>
    <p>本人通知は公式PV・売上を上書きせず、<strong>「誰が・何に・いつ反応したか」</strong>だけを追加して、交流・メンシプ・購入/支援・コメント反応の解像度を上げます。</p>
  </section>
}

export function MemberInsightAnalysisHub({revision=0,onBack,noteId="",dashboardInstalled="",notificationInstalled="",dashboardLatest="",notificationLatest=""}:{revision?:number;onBack?:()=>void;noteId?:string;dashboardInstalled?:string;notificationInstalled?:string;dashboardLatest?:string;notificationLatest?:string}){
  const role=String(noteId||"").toLowerCase()==="ss_yr"?"owner":"member";
  const common=`./dashboard-setup.html?from=analysis&role=${role}&account=${encodeURIComponent(String(noteId||"").toLowerCase())}&return=${encodeURIComponent(window.location.href)}&auto=1`;
  const baseDashboardHref=`${common}&scope=base`;
  const withDashboardHref=`${common}&scope=with`;
  const notificationHref=`./notification-update.html?from=analysis&role=${role}&latest=${encodeURIComponent(notificationLatest||CURRENT_NOTIFICATION_VERSION)}&return=${encodeURIComponent(window.location.href)}`;
  const dashboardReady=dashboardInstalled===CURRENT_DASHBOARD_VERSION||Boolean(dashboardInstalled&&!dashboardLatest),notificationReady=notificationInstalled===CURRENT_NOTIFICATION_VERSION||Boolean(notificationInstalled&&!notificationLatest),dashboardNeedsUpdate=Boolean(dashboardLatest&&dashboardInstalled!==dashboardLatest),notificationNeedsUpdate=Boolean(notificationLatest&&notificationInstalled!==notificationLatest);
  return <section className="miah">
    <div className="miah-paths">
      <article className="active"><a className="miah-path-main" href={baseDashboardHref}><strong>📊 Dashboard同期だけで更新</strong><small>本人通知ツールは不要</small><span>公式Dashboard＋通常データを更新し、下の「本人通知なし分析」を再計算します。</span></a><span className="miah-ready">{dashboardReady&&!dashboardNeedsUpdate?`✓ Dashboard v${dashboardInstalled} 利用可能`:dashboardInstalled?"Dashboard同期の更新が必要":"Dashboard同期ツールの導入が必要"}</span></article>
      <article className="notice"><a className="miah-path-main" href={withDashboardHref}><strong>🔔 Dashboard＋本人通知で更新</strong><small>通知由来の追加分析を重ねる</small><span>通常分析を残したまま、人物・コメント/返信・メンシプ・購入/支援などを追加します。</span></a>{notificationReady&&!notificationNeedsUpdate?<span className="miah-ready">✓ 本人通知 v{notificationInstalled} 利用可能</span>:<a className="notice-install" href={notificationHref}>{notificationInstalled?"本人通知を更新":"本人通知をインストール"}</a>}</article>
    </div>
    <p className="miah-rule"><b>分析は2層に完全分離：</b><strong>上段＝本人通知なしでできる分析</strong>、<strong>下段＝本人通知がある場合だけ追加する分析</strong>。本人通知の数字で公式DashboardのPV・売上・率を上書きしません。</p>

    <section className="miah-analysis-layer base">
      <header className="miah-layer-head"><div><small>BASE ANALYSIS</small><h2>📊 本人通知なしでできる分析</h2><p>公式Dashboard＋通常データだけで完結。公式Dashboard以上に、PV化率・反応率・流入分解・収益効率・潜在PV・星図・波形・改善候補まで分析します。</p></div><span>本人通知 不要</span></header>
      <div className="miah-layer-tags"><span>PV/Imp</span><span>PV化率</span><span>反応率</span><span>流入</span><span>売上効率</span><span>潜在PV</span><span>記事星図</span><span>成長波形</span><span>改善候補</span></div>
      <MemberInsightAnalyticsBase revision={revision} onBack={onBack}/>
    </section>

    <section className="miah-analysis-layer notice">
      <header className="miah-layer-head"><div><small>OPTIONAL NOTIFICATION ANALYSIS</small><h2>🔔 本人通知がある場合だけ追加する分析</h2><p>公式Dashboardでは取れない「誰が・何に・いつ反応したか」を追加。通常分析とは混ぜず、人物・交流・メンシプ・購入/支援だけを別レイヤーで深掘りします。</p></div><span>本人通知 追加</span></header>
      <div className="miah-layer-tags notice"><span>人物別反応</span><span>コメント/返信</span><span>コメント♡</span><span>メンシプ</span><span>購入/支援</span><span>時間帯</span><span>曜日</span><span>反応集中率</span></div>
      {notificationReady&&!notificationNeedsUpdate?<NotificationDeepAnalysis/>:<div className="miah-notification-locked"><b>本人通知を使わなくても上の分析はすべて利用できます。</b><span>この追加レイヤーを使う場合だけ本人通知ツールを導入してください。</span><a href={notificationHref}>{notificationInstalled?"本人通知を更新して追加分析":"本人通知をインストールして追加分析"}</a></div>}
    </section>
  </section>
}
