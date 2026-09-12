import { useEffect, useRef, useState } from "react";
import { INSIGHT_TOKEN_KEY } from "./insight-account-store";
import {
  CURRENT_DASHBOARD_VERSION,
  CURRENT_NOTIFICATION_VERSION,
} from "./insight-release";
import { MemberInsightAnalyticsProV3 } from "./member-insight-analytics-pro-v3";
import "./member-insight-analysis-hub.css";

const NOTIFICATION_ANALYSIS="https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-notification-analysis-summary";
// Regression marker: the old client path used kind:"all"; V5 replaces that multi-page loop with one server-side summary request.
const nf=new Intl.NumberFormat("ja-JP");
const n=(v:any)=>nf.format(Number(v||0));
const TYPE_LABEL:Record<string,string>={like:"スキ",comment_like:"コメント♡",comment:"コメント",reply:"返信",reply_self:"自分の記事返信",reply_other:"相手の記事返信",follow:"フォロー",creator_article_posted:"記事投稿",magazine_follow:"マガジンフォロー",my_article_magazine_added:"自分の記事追加",magazine_article_added:"マガジン記事追加",magazine_join:"マガジン参加",membership_board:"メンシプ掲示板",membership_board_reply:"掲示板返信",membership_reaction:"メンシプ反応",membership_reaction_self:"自分のメンシプ反応",membership_reaction_joined:"参加中メンシプ反応",membership_started:"メンシプ開始",membership_plan:"プラン追加",membership_join:"メンシプ参加",purchase:"購入",tip:"チップ・サポート",buzz:"話題",rating:"高評価",points:"ポイント",quote:"引用・紹介",question_box_started:"質問箱開始",other:"その他"};

async function loadNotificationSummary(){
  const token=localStorage.getItem(INSIGHT_TOKEN_KEY)||"";
  if(!token)throw new Error("INSIGHT_LOGIN_REQUIRED");
  const controller=new AbortController(),timer=window.setTimeout(()=>controller.abort(),30000);
  try{
    const response=await fetch(NOTIFICATION_ANALYSIS,{method:"POST",headers:{"Content-Type":"application/json","X-Insight-Token":token},body:"{}",cache:"no-store",signal:controller.signal});
    const payload=await response.json().catch(()=>({}));
    if(!response.ok||payload?.ok===false)throw new Error(payload?.error||"本人通知分析データを取得できませんでした");
    return payload;
  }catch(error){
    if(error instanceof DOMException&&error.name==="AbortError")throw new Error("本人通知分析が30秒以内に完了しませんでした。再読込してください。");
    throw error;
  }finally{window.clearTimeout(timer)}
}
function Bars({items,total}:{items:{k:string;v:number}[];total?:number}){const safe=Array.isArray(items)?items:[],max=Math.max(1,...safe.map(x=>Number(x.v||0)));return <>{safe.map(x=><div className="miah-bar" key={x.k}><span>{x.k}</span><i><b style={{width:`${Math.max(3,Math.min(100,Number(x.v||0)/max*100))}%`}}/></i><em>{n(x.v)}件{total?` ${(Number(x.v||0)/Math.max(1,total)*100).toFixed(0)}%`:""}</em></div>)}</>}
function NotificationDeepAnalysis(){
  const[data,setData]=useState<any>(null),[loading,setLoading]=useState(true),[error,setError]=useState(""),requestSeq=useRef(0);
  async function load(){const seq=++requestSeq.current;setLoading(true);setError("");try{const next=await loadNotificationSummary();if(seq===requestSeq.current)setData(next)}catch(e){if(seq===requestSeq.current)setError(e instanceof Error?e.message:"本人通知分析に失敗しました")}finally{if(seq===requestSeq.current)setLoading(false)}}
  useEffect(()=>{void load();return()=>{requestSeq.current++}},[]);
  if(loading)return <section className="miah-notification"><b>🔔 本人通知分析を集計中…</b><span>保存済み通知はサーバー側で1回だけ集計しています。全ページをブラウザで巡回しません。</span></section>;
  if(error)return <section className="miah-notification error"><b>⚠ 本人通知分析</b><span>{error}</span><button className="miah-reload" onClick={()=>void load()}>再読込</button></section>;
  if(!data?.sample)return <section className="miah-notification"><b>🔔 本人通知分析</b><span>保存済み本人通知がまだありません。</span></section>;
  const delta=data.prev7?((data.recent7-data.prev7)/data.prev7*100):data.recent7?100:0,topTypes=Array.isArray(data.topTypes)?data.topTypes:[],topActors=Array.isArray(data.topActors)?data.topActors:[],last14=Array.isArray(data.last14)?data.last14:[],timeBands=Array.isArray(data.timeBands)?data.timeBands:[];
  return <section className="miah-notification"><header><div><small>NOTIFICATION DEEP ANALYSIS V5</small><h3>本人通知の人物・交流分析</h3></div><div className="miah-head-actions"><span>{data.truncated?`取得${n(data.sample)} / 元データ${n(data.sourceTotal)}`:`保存${n(data.sample)}件を全件分析`}</span><button onClick={()=>void load()}>↻ 再集計</button></div></header>
    <div className="miah-kpis"><article><small>直近7日</small><b>{n(data.recent7)}件</b><span>前7日比 {delta>=0?"+":""}{delta.toFixed(0)}%</span></article><article><small>反応者</small><b>{n(data.people)}人</b><span>通知内ユニーク</span></article><article><small>コメント系</small><b>{n(data.comments)}件</b><span>コメント・返信・掲示板返信</span></article><article><small>メンシプ系</small><b>{n(data.membership)}件</b><span>参加・反応・掲示板</span></article><article><small>購入/支援</small><b>{n(data.money)}件</b><span>購入＋チップ</span></article><article><small>分類精度</small><b>{Number(data.classifiedRate||0).toFixed(1)}%</b><span>その他 {n(data.other)}件</span></article></div>
    <div className="miah-grid"><article><h4>通知カテゴリ構成</h4>{topTypes.map(([k,v]:[string,number])=><div className="miah-bar" key={k}><span>{TYPE_LABEL[k]||k}</span><i><b style={{width:`${Math.max(4,Math.min(100,Number(v||0)/Math.max(1,Number(data.sample||0))*100))}%`}}/></i><em>{n(v)}件</em></div>)}</article><article><h4>反応が多い人</h4>{topActors.slice(0,10).map((a:any,i:number)=><a key={`${a.url||a.name}-${i}`} href={a.url||undefined} target="_blank" rel="noreferrer"><b>{i+1}</b><span>{a.name}</span><em>{n(a.count)}件</em></a>)}</article><article><h4>直近14日・日別推移</h4><Bars items={last14.map((x:any)=>({k:x.label,v:x.v}))}/></article><article><h4>時間帯の偏り</h4><Bars items={timeBands}/></article></div>
    <div className="miah-insights"><span><b>{n(data.peakHour)}時台</b>に通知が最も集中</span><span><b>{data.weekName||"—"}曜日</b>が最多</span><span><b>{Number(data.topActorShare||0).toFixed(1)}%</b>最多反応者への集中率</span><span><b>{Number(data.coverage||0).toFixed(1)}%</b>保存件数に対する分析取得率</span></div><p>本人通知は公式PV・売上を上書きせず、<strong>「誰が・何に・いつ反応したか」</strong>を追加します。Dashboard同期が無くても、この通知分析単体は利用できます。</p></section>;
}

export function MemberInsightAnalysisHub({revision=0,onBack,noteId="",dashboardInstalled="",notificationInstalled="",dashboardLatest="",notificationLatest=""}:{revision?:number;onBack?:()=>void;noteId?:string;dashboardInstalled?:string;notificationInstalled?:string;dashboardLatest?:string;notificationLatest?:string}){
  const cleanNoteId=String(noteId||"").match(/[A-Za-z0-9_-]+/)?.[0]?.toLowerCase()||"",role=cleanNoteId==="ss_yr"?"owner":"member",setupHref=`./dashboard-setup.html?from=analysis&role=${role}&account=${encodeURIComponent(cleanNoteId)}&return=${encodeURIComponent(window.location.href)}&auto=0`,dashboardReady=dashboardInstalled===CURRENT_DASHBOARD_VERSION||Boolean(dashboardInstalled&&!dashboardLatest),notificationReady=notificationInstalled===CURRENT_NOTIFICATION_VERSION||Boolean(notificationInstalled&&!notificationLatest),dashboardNeedsUpdate=Boolean(dashboardLatest&&dashboardInstalled!==dashboardLatest),notificationNeedsUpdate=Boolean(notificationLatest&&notificationInstalled!==notificationLatest),dashboardUsable=dashboardReady&&!dashboardNeedsUpdate,notificationUsable=notificationReady&&!notificationNeedsUpdate,allReady=dashboardUsable&&notificationUsable;
  return <section className="miah"><div className="miah-paths"><article className={allReady?"active":""}><a className="miah-path-main" href={setupHref}><strong>📊 Dashboard分析を準備 / 更新</strong><small>公式Dashboardクロス分析は2ツール使用</small><span>Dashboard同期＋本人通知をそろえるとPV・流入・収益と人物反応を横断分析します。</span></a><span className="miah-ready">{allReady?`✓ Dashboard v${dashboardInstalled} / 本人通知 v${notificationInstalled} 利用可能`:notificationUsable?`✓ 本人通知 v${notificationInstalled} 単体分析可能`:"ツール状態を確認してください"}</span></article></div><p className="miah-rule"><b>分析レイヤーを分離：</b><strong>本人通知だけでも人物・交流分析を実行</strong>。Dashboard同期が加わった場合のみ、公式PV・売上・流入とのクロス分析を追加します。インストール不要の公開データ分析は、アカウント切替横の「詳細分析」を使います。</p>
    <section className="miah-analysis-layer base"><header className="miah-layer-head"><div><small>DASHBOARD ANALYSIS V3</small><h2>📊 公式Dashboard＋INSIGHT Pro分析</h2><p>公式Dashboardの生値を正本にし、データ品質を判定してから本人内ベンチマーク・流入・収益・通知とのクロス分析まで行います。</p></div><span>{allReady?"2ツール準備済み":"Dashboardクロス分析は2ツール"}</span></header><div className="miah-layer-tags"><span>公式値</span><span>データ品質</span><span>成長推移</span><span>本人内ベンチマーク</span><span>流入</span><span>収益</span><span>曜日</span><span>通知×PV</span><span>記事指数</span></div>{allReady?<MemberInsightAnalyticsProV3 revision={revision} onBack={onBack}/>:<div className="miah-notification-locked"><b>公式Dashboardクロス分析は2つのツールを準備してください。</b><span>本人通知だけ導入済みなら、下の人物・交流分析はそのまま使えます。</span><a href={setupHref}>ブラウザ別パネルを開く</a></div>}</section>
    <details className="miah-analysis-layer notice miah-fold" open><summary><b>🔔 本人通知の人物・交流分析</b><span>人物別反応・14日推移・時間帯・コメント・メンシプ・購入/支援</span></summary><div className="miah-fold-body">{notificationUsable?<NotificationDeepAnalysis/>:<div className="miah-notification-locked"><b>本人通知ツールが未導入または旧版です。</b><span>本人通知だけ導入すれば、この分析はDashboard同期なしでも使えます。</span><a href={setupHref}>導入パネルを開く</a></div>}</div></details>
  </section>;
}