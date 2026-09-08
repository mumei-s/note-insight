import "./member-insight-opportunity-engine.css";

type Row=Record<string,any>;
const num=(v:any)=>Number.isFinite(Number(v))?Number(v):0;
const nf=new Intl.NumberFormat("ja-JP");
const n=(v:any)=>nf.format(Math.round(num(v)));
const pct=(v:any)=>`${num(v).toFixed(1)}%`;
const short=(v:any,len=34)=>{const s=String(v||"無題").replace(/\s+/g," ").trim();return s.length>len?s.slice(0,len-1)+"…":s};
function median(values:number[]){const a=values.filter(Number.isFinite).sort((x,y)=>x-y);if(!a.length)return 0;const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2}
function q75(values:number[]){const a=values.filter(Number.isFinite).sort((x,y)=>x-y);if(!a.length)return 0;return a[Math.min(a.length-1,Math.floor((a.length-1)*.75))]}

export function OpportunityEngine({rows,data}:{rows:Row[];data:any}){
  const usable=(rows||[]).filter(r=>num(r.impressions)>0||num(r.pageViews)>0);
  if(!usable.length)return <article className="mioe"><header><div><small>INSIGHT OPPORTUNITY ENGINE</small><h3>公式値を「次の打ち手」へ変換</h3></div><span>本人内ベンチマーク</span></header><p className="mioe-empty">記事別Dashboardデータを同期すると、潜在PV・取りこぼし・隠れた強記事を自動判定します。</p></article>;
  const openVals=usable.filter(r=>num(r.impressions)>0).map(r=>num(r.openRate)),reactionVals=usable.filter(r=>num(r.pageViews)>0).map(r=>num(r.reactionRate)),pvVals=usable.map(r=>num(r.pageViews)),impVals=usable.map(r=>num(r.impressions));
  const medOpen=median(openVals),medReaction=median(reactionVals),medPv=median(pvVals),medImp=median(impVals),topOpen=q75(openVals),topReaction=q75(reactionVals);
  const totalPv=usable.reduce((s,r)=>s+num(r.pageViews),0),top5Pv=[...usable].sort((a,b)=>num(b.pageViews)-num(a.pageViews)).slice(0,5).reduce((s,r)=>s+num(r.pageViews),0),concentration=totalPv?top5Pv/totalPv*100:0;
  const potentialPv=Math.round(usable.reduce((s,r)=>{if(num(r.impressions)<=0)return s;return s+Math.max(0,num(r.impressions)*medOpen/100-num(r.pageViews))},0));
  const potentialReactions=Math.round(usable.reduce((s,r)=>{if(num(r.pageViews)<=0)return s;return s+Math.max(0,num(r.pageViews)*medReaction/100-(num(r.likes)+num(r.comments)))},0));
  const leaks=[...usable].filter(r=>num(r.impressions)>=medImp&&num(r.openRate)<medOpen).sort((a,b)=>(num(b.impressions)*(medOpen-num(b.openRate)))-(num(a.impressions)*(medOpen-num(a.openRate)))).slice(0,4);
  const gems=[...usable].filter(r=>num(r.reactionRate)>=topReaction&&num(r.impressions)<=medImp).sort((a,b)=>num(b.reactionRate)-num(a.reactionRate)).slice(0,4);
  const scale=[...usable].filter(r=>num(r.openRate)>=topOpen&&num(r.reactionRate)>=medReaction).sort((a,b)=>num(b.pageViews)-num(a.pageViews)).slice(0,4);
  const latest=data?.latestDashboard||{},trafficTotal=num(data?.traffic?.total),coverage=[num(latest.impressions)>0,num(latest.pageViews)>0,usable.length>0,trafficTotal>0,Array.isArray(latest.metricSeries)&&latest.metricSeries.length>1].filter(Boolean).length;
  const confidence=Math.round(coverage/5*100);
  return <article className="mioe"><header><div><small>INSIGHT OPPORTUNITY ENGINE</small><h3>公式値を「伸びしろ」に変換</h3></div><span>他人比較なし・本人内基準</span></header><div className="mioe-kpis"><div><small>潜在PV</small><b>+{n(potentialPv)}</b><span>PV化率を自分の中央値まで改善した場合の推定</span></div><div><small>潜在反応</small><b>+{n(potentialReactions)}</b><span>反応率を自分の中央値まで改善した場合の推定</span></div><div><small>上位5記事集中率</small><b>{pct(concentration)}</b><span>{concentration>=65?"上位依存強め":concentration>=45?"やや集中":"分散型"}</span></div><div><small>分析信頼度</small><b>{confidence}%</b><span>公式系列・流入・記事別データの充足度</span></div></div><div className="mioe-bench"><span><small>自分のPV化中央値</small><b>{pct(medOpen)}</b></span><span><small>自分の反応中央値</small><b>{pct(medReaction)}</b></span><span><small>自分の記事PV中央値</small><b>{n(medPv)}</b></span><span><small>上位25% PV化</small><b>{pct(topOpen)}</b></span></div><div className="mioe-cols"><section><h4>⚠ 露出の取りこぼし</h4><p>表示はされているのに、自分の通常水準より開かれていない記事。</p>{leaks.length?leaks.map((r,i)=><a href={r.url||undefined} target="_blank" rel="noreferrer" key={`${r.url||r.title}-${i}`}><b>{short(r.title)}</b><span>Imp {n(r.impressions)} / PV化 {pct(r.openRate)}</span></a>):<em>大きな取りこぼしは見つかりません。</em>}</section><section><h4>💎 隠れた強記事</h4><p>露出は少ないのに、読まれた後の反応が自分の上位水準。</p>{gems.length?gems.map((r,i)=><a href={r.url||undefined} target="_blank" rel="noreferrer" key={`${r.url||r.title}-${i}`}><b>{short(r.title)}</b><span>反応 {pct(r.reactionRate)} / Imp {n(r.impressions)}</span></a>):<em>条件に合う記事はまだありません。</em>}</section><section><h4>🚀 再展開候補</h4><p>開かれやすさと反応の両方が自分基準を超える記事。</p>{scale.length?scale.map((r,i)=><a href={r.url||undefined} target="_blank" rel="noreferrer" key={`${r.url||r.title}-${i}`}><b>{short(r.title)}</b><span>PV化 {pct(r.openRate)} / 反応 {pct(r.reactionRate)}</span></a>):<em>条件に合う記事はまだありません。</em>}</section></div><footer>※ 潜在値は将来を保証する予測ではなく、現在の記事群を基準にした「取りこぼし量」の推定です。</footer></article>;
}
