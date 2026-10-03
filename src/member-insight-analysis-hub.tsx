import { InsightColumns } from "./member-insight-analysis-charts";
import { InsightDonut } from "./insight-donut";
import { useEffect, useRef, useState } from "react";
import { useVisibleMotion } from "./insight-visible-motion";
import { loadNotificationSummary } from "./member-insight-analysis-summary-client";
import { MemberInsightAnalyticsProV3 } from "./member-insight-analytics-pro-v3";
import "./member-insight-analysis-hub.css";
import "./member-insight-analysis-menu.css";

const nf=new Intl.NumberFormat("ja-JP");
const n=(v:any)=>nf.format(Number(v||0));
const TYPE_LABEL:Record<string,string>={like:"スキ",comment_like:"コメント♡",comment:"コメント",reply:"返信",reply_self:"自分の記事返信",reply_other:"相手の記事返信",reply_unknown:"返信先確認待ち",membership_reaction_unknown:"メンシプ所有者確認待ち",follow:"フォロー",creator_article_posted:"記事投稿",magazine_follow:"マガジンフォロー",my_article_magazine_added:"自分の記事追加",magazine_article_added:"マガジン記事追加",magazine_join:"マガジン参加",membership_board:"メンシプ掲示板",membership_board_reply:"掲示板返信",membership_reaction:"メンシプ反応",membership_reaction_self:"自分のメンシプ反応",membership_reaction_joined:"参加中メンシプ反応",membership_started:"メンシプ開始",membership_plan:"プラン追加",membership_join:"メンシプ参加",purchase:"購入",tip:"チップ・サポート",buzz:"話題",rating:"高評価",points:"ポイント",quote:"引用・紹介",question_box_started:"質問箱開始",question_answer:"質問箱回答",image_used:"画像の使用",stock_photo:"画像の使用",purchased_article_updated:"購入した記事の更新",other:"その他"};

function Bars({items,total}:{items:{k:string;v:number}[];total?:number}){const safe=Array.isArray(items)?items:[],max=Math.max(1,...safe.map(x=>Number(x.v||0)));return <>{safe.map(x=><div className="miah-bar" key={x.k}><span>{x.k}</span><i><b style={{width:`${Math.max(0,Math.min(100,Number(x.v||0)/max*100))}%`}}/></i><em>{n(x.v)}件{total?` ${(Number(x.v||0)/Math.max(1,total)*100).toFixed(0)}%`:""}</em></div>)}</>}
function NotificationDeepAnalysis({revision=0}:{revision?:number}){
  const[period,setPeriod]=useState(0);
  const[data,setData]=useState<any>(null),[loading,setLoading]=useState(true),[error,setError]=useState(""),requestSeq=useRef(0);
  async function load(force=false){const seq=++requestSeq.current;setLoading(true);setError("");try{const next=await loadNotificationSummary(period,force);if(seq===requestSeq.current)setData(next)}catch(e){if(seq===requestSeq.current)setError(e instanceof Error?e.message:"本人通知分析に失敗しました")}finally{if(seq===requestSeq.current)setLoading(false)}}
  useEffect(()=>{void load();return()=>{requestSeq.current++}},[period,revision]);
  if(loading&&!data)return <section className="miah-notification"><b>🔔 本人通知分析を集計中…</b><span>保存済み通知の件数・日付・反応者を確認しています。</span></section>;
  if(error&&!data)return <section className="miah-notification error"><b>⚠ 本人通知分析</b><span>{error}</span><button className="miah-reload" onClick={()=>void load(true)}>再読込</button></section>;
  if(!data?.sample)return <section className="miah-notification"><b>🔔 本人通知分析</b><span>選択期間の本人通知はありません。</span><label>対象期間 <select value={period} onChange={e=>{setData(null);setPeriod(Number(e.target.value))}}><option value={0}>全保存履歴</option><option value={7}>直近7日</option><option value={30}>直近30日</option><option value={90}>直近90日</option></select></label><button onClick={()=>void load(true)}>↻ 再集計</button></section>;
  const delta=data.prev7?((data.recent7-data.prev7)/data.prev7*100):data.recent7?100:0,topTypes=Array.isArray(data.topTypes)?data.topTypes:[],topActors=Array.isArray(data.topActors)?data.topActors:[],last14=Array.isArray(data.last14)?data.last14:[],timeBands=Array.isArray(data.timeBands)?data.timeBands:[];
  return <section className="miah-notification"><header><div><small>NOTIFICATION DEEP ANALYSIS V5</small><h3>本人通知の人物・交流分析</h3></div><div className="miah-head-actions"><span>{data.truncated?`取得${n(data.sample)} / 元データ${n(data.sourceTotal)}`:`保存${n(data.sample)}件を全件分析`}</span><button onClick={()=>void load(true)}>↻ 再集計</button></div></header>
    {loading?<p role="status">最新の通知を確認中… 前回の分析は操作できます。</p>:null}{error?<p role="alert">{error} <button onClick={()=>void load(true)}>再読込</button></p>:null}<label className="miah-period">対象期間 <select value={period} onChange={e=>{setData(null);setPeriod(Number(e.target.value))}}><option value={0}>全保存履歴</option><option value={7}>直近7日</option><option value={30}>直近30日</option><option value={90}>直近90日</option></select></label><div className="miah-kpis"><article><small>直近7日</small><b>{n(data.recent7)}件</b><span>{data.prev7?`前7日比 ${delta>=0?"+":""}${delta.toFixed(0)}%`:"前7日が0件のため比率なし"}</span></article><article><small>反応者</small><b>{n(data.people)}人</b><span>通知内ユニーク</span></article><article><small>コメント系</small><b>{n(data.comments)}件</b><span>コメント・返信・掲示板返信</span></article><article><small>メンシプ系</small><b>{n(data.membership)}件</b><span>参加・反応・掲示板</span></article><article><small>購入/支援</small><b>{n(data.money)}件</b><span>購入＋チップ</span></article><article><small>自記事のマガジン追加</small><b>{n(data.ownArticleAdds)}件</b><span>お返し確認の対象</span></article><article><small>メンシプ参加</small><b>{n(data.membershipJoins)}件</b><span>保存された参加通知</span></article><article><small>複数回反応した人</small><b>{n(data.repeatPeople)}人</b><span>対象期間で2件以上</span></article><article><small>分類済み率</small><b>{Number(data.classifiedRate||0).toFixed(1)}%</b><span>その他 {n(data.other)}件</span></article></div>
    <InsightDonut label="本人通知の項目別構成比" items={[...topTypes.map(([k,v]:[string,number])=>({label:TYPE_LABEL[k]||k,value:Number(v)})),...(Number(data.sample)>topTypes.reduce((n:number,x:any)=>n+Number(x[1]),0)?[{label:"残りの項目",value:Number(data.sample)-topTypes.reduce((n:number,x:any)=>n+Number(x[1]),0)}]:[])]}/><div className="miah-grid"><article><h4>通知カテゴリ構成</h4>{topTypes.map(([k,v]:[string,number])=><div className="miah-bar" key={k}><span>{TYPE_LABEL[k]||k}</span><i><b style={{width:`${Math.max(0,Math.min(100,Number(v||0)/Math.max(1,Number(data.sample||0))*100))}%`}}/></i><em>{n(v)}件</em></div>)}</article><article><h4>反応が多い人</h4>{topActors.slice(0,10).map((a:any,i:number)=><a key={`${a.url||a.name}-${i}`} href={a.url||undefined} target="_blank" rel="noreferrer"><b>{i+1}</b><span>{a.name}</span><em>{n(a.count)}件</em></a>)}</article><article><h4>直近14日の保存通知（選択期間内）</h4><InsightColumns label="14日の通知推移" items={last14.map((x:any)=>({label:x.label,value:x.v}))}/></article><article><h4>時間帯別の件数（日本時間）</h4><Bars items={timeBands}/></article><article><h4>曜日別の件数（日本時間）</h4><InsightColumns label="通知が届いた曜日" items={(data.week||[]).map((x:any)=>({label:x.k,value:x.v}))}/></article></div>
    <div className="miah-insights"><span><b>{n(data.peakHour)}時台</b>に通知が最も集中</span><span><b>{data.weekName||"—"}曜日</b>が最多</span><span><b>{Number(data.topActorShare||0).toFixed(1)}%</b>最多反応者への集中率</span><span><b>{Number(data.coverage||0).toFixed(1)}%</b>保存件数に対する分析取得率</span></div><p>本人通知では<strong>「誰が・何に・いつ反応したか」</strong>を分析します。相対日時は概算、日時未取得分は保存日時で集計します。直近7日の比較は対象期間にかかわらず前7日と比較します。分類済み率は分類の正答率ではありません。Dashboard同期が無くても利用できます。</p></section>;
}

type AnalysisPanel = "menu" | "dashboard" | "notifications" | "verdict";
function requestedPanel(): AnalysisPanel {
  const value = new URL(window.location.href).searchParams.get("analysisPanel");
  return value === "dashboard" || value === "notifications" || value === "verdict" ? value : "menu";
}
export function MemberInsightAnalysisHub({revision=0,noteId=""}:{revision?:number;onBack?:()=>void;noteId?:string;dashboardInstalled?:string;notificationInstalled?:string;dashboardLatest?:string;notificationLatest?:string}){
  const scene = useVisibleMotion<HTMLElement>(), [panel, setPanel] = useState<AnalysisPanel>(requestedPanel);
  const cleanNoteId=String(noteId||"").match(/[A-Za-z0-9_-]+/)?.[0]?.toLowerCase()||"",role=cleanNoteId==="ss_yr"?"owner":"member";
  const returnUrl = new URL(window.location.href); returnUrl.searchParams.set("insightMode", "analysis"); returnUrl.searchParams.delete("analysisPanel"); returnUrl.hash = "dashboard";
  const setupHref=`./dashboard-setup.html?from=analysis&role=${role}&account=${encodeURIComponent(cleanNoteId)}&return=${encodeURIComponent(returnUrl.href)}&auto=0`;
  const normalHref=`./install-free-analysis-v3.html?account=${encodeURIComponent(cleanNoteId)}&return=${encodeURIComponent(returnUrl.href)}`;
  useEffect(() => { const restore = () => setPanel(requestedPanel()); window.addEventListener("popstate", restore); return () => window.removeEventListener("popstate", restore); }, []);
  function openPanel(next: AnalysisPanel) {
    if (next === panel) return;
    const url = new URL(window.location.href); url.searchParams.set("insightMode", "analysis");
    if (next === "menu") url.searchParams.delete("analysisPanel"); else url.searchParams.set("analysisPanel", next);
    window.history.pushState({...window.history.state,route:"dashboard",insightMode:"analysis",analysisPanel:next,insightScrollY:window.scrollY}, "", url.href);
    setPanel(next);
  }
  useEffect(() => { const menu = () => openPanel("menu"); window.addEventListener("mumei-insight-analysis-menu", menu); return () => window.removeEventListener("mumei-insight-analysis-menu", menu); }, [panel]);
  const choices = [
    { id: "normal", title: "通常分析", icon: "◈", copy: "公開記事・スキ・コメント", hint: "本人通知なしで利用", settings: "" },
    { id: "dashboard", title: "ダッシュボード INSIGHTプロ", icon: "▥", copy: "公式値・成長・流入・収益", hint: "使用・設定は⚙から", settings: "#dashboardTitle" },
    { id: "notifications", title: "本人通知分析", icon: "🔔", copy: "人物・交流・反応の履歴", hint: "使用・設定は⚙から", settings: "#noticeTitle" },
    { id: "verdict", title: "総合判定", icon: "✦", copy: "伸び・記事評価・通知との照合", hint: "使用・設定は⚙から", settings: "" },
  ];
  return <section ref={scene.ref} className="miah" data-panel={panel} data-motion={scene.motion ? "on" : "off"} aria-label="分析メニュー">
    <nav className="miah-menu" aria-label="4つの分析">{choices.map((choice, order) => <article key={choice.id} className={`miah-menu-card ${choice.id}`} data-selected={panel===choice.id} style={{ "--card-order": order } as React.CSSProperties}>
      {choice.id === "normal" ? <a className="miah-menu-main" href={normalHref}><i aria-hidden="true">{choice.icon}</i><strong>{choice.title}</strong><span>{choice.copy}</span><small>{choice.hint}</small></a> : <button className="miah-menu-main" onClick={() => openPanel(choice.id as AnalysisPanel)} aria-pressed={panel===choice.id}><i aria-hidden="true">{choice.icon}</i><strong>{choice.title}</strong><span>{choice.copy}</span><small>{choice.hint}</small></button>}
      {choice.id !== "normal" && <a className="miah-menu-settings" href={setupHref+choice.settings} aria-label={`${choice.title}の設定`}>⚙</a>}
    </article>)}</nav>
    {panel !== "menu" && <section key={`${cleanNoteId}:${panel}`} className={`miah-selected ${panel}`} aria-label={choices.find(choice=>choice.id===panel)?.title}>
      <button className="miah-menu-back" onClick={() => openPanel("menu")}>← 分析一覧</button>
      {panel === "notifications" ? <NotificationDeepAnalysis revision={revision}/> : <MemberInsightAnalyticsProV3 revision={revision} view={panel === "verdict" ? "verdict" : "dashboard"}/>}
    </section>}
  </section>;
}
