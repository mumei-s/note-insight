import { useState } from 'react';
import { InsightColumns } from './member-insight-analysis-charts';
type Row=Record<string,any>;
const METRICS={pageViews:['ページビュー','PV'],likes:['スキ','件'],comments:['コメント','件'],salesYen:['売上','円'],notifications:['保存通知','件']} as const;
type Metric=keyof typeof METRICS;
const number=(v:number)=>new Intl.NumberFormat('ja-JP',{maximumFractionDigits:1}).format(v);
export function historyStats(rows:Row[],field:string,today:string,span=0){
 const byDate=new Map<string,number>();for(const r of rows){const v=r[field];if(/^\d{4}-\d{2}-\d{2}$/.test(r.date)&&r.date<today&&v!==null&&v!==undefined&&Number.isFinite(Number(v))&&Number(v)>=0)byDate.set(r.date,Number(v));}
 const all=[...byDate].sort(([a],[b])=>a.localeCompare(b)).map(([date,value])=>({date,value}));
 const end=all.at(-1)?.date,cutoff=end&&span?new Date(Date.parse(end+'T00:00:00Z')-(span-1)*86400000).toISOString().slice(0,10):'';
 const selected=all.filter(r=>!cutoff||r.date>=cutoff),max=all.length?Math.max(...all.map(r=>r.value)):null,min=all.length?Math.min(...all.map(r=>r.value)):null;
 return{all,selected,max,min,maxDays:all.filter(r=>r.value===max).map(r=>r.date),minDays:all.filter(r=>r.value===min).map(r=>r.date),total:selected.reduce((s,r)=>s+r.value,0),average:selected.length?selected.reduce((s,r)=>s+r.value,0)/selected.length:null};
}
export function SavedHistory({rows,notifications,today}:{rows:Row[];notifications:Row[];today:string}){
 const[metric,setMetric]=useState<Metric>('pageViews'),[span,setSpan]=useState(28);
 const source=metric==='notifications'?notifications.map(r=>({date:r.date,notifications:r.count})):rows;
 const stats=historyStats(source,metric,today,span),[label,unit]=METRICS[metric];
 // Long ranges use calendar-month sums of observed days, never fabricated daily values.
 const monthly=stats.selected.length>35,groups=new Map<string,{value:number;days:number}>();
 for(const r of stats.selected){const key=monthly?r.date.slice(0,7):r.date;const g=groups.get(key)||{value:0,days:0};g.value+=r.value;g.days++;groups.set(key,g)}
 const items=[...groups].map(([date,g])=>({label:monthly?date:date.slice(5).replace('-','/'),value:g.value,sub:monthly?`${g.days}日分の合計`:date}));
 const dates=(xs:string[])=>xs.slice(0,2).join('・')+(xs.length>2?` ほか${xs.length-2}日`:'');
 return <section className="mipro-history" aria-label="保存履歴と最高・最低記録">
  <div className="mipro-history-controls"><label>記録を見る<select value={metric} onChange={e=>setMetric(e.target.value as Metric)}>{Object.entries(METRICS).map(([key,[text]])=><option value={key} key={key}>{text}</option>)}</select></label><label>表示期間<select value={span} onChange={e=>setSpan(Number(e.target.value))}><option value={7}>7日</option><option value={28}>28日</option><option value={365}>365日</option><option value={0}>保存済み全期間</option></select></label></div>
  <p className="mipro-note">{stats.all.length?`保存範囲 ${stats.all[0].date}〜${stats.all.at(-1)!.date}・${stats.all.length}日分`:'この指標の日別履歴は未取得です。'}。今日の途中値は記録比較から除きます。期間を切り替えても最高・最低記録は保存済み全期間から表示します。</p>
  <div className="mipro-kpis mipro-history-records"><div><small>保存済み全期間の最多</small><b>{stats.max==null?'未取得':`${number(stats.max)} ${unit}`}</b><em>{dates(stats.maxDays)||'—'}</em></div><div><small>保存済み全期間の最少</small><b>{stats.min==null?'未取得':`${number(stats.min)} ${unit}`}</b><em>{dates(stats.minDays)||'—'}</em></div><div><small>表示期間の1日平均</small><b>{stats.average==null?'未取得':`${number(stats.average)} ${unit}`}</b><em>取得済み{stats.selected.length}日で計算</em></div><div><small>表示期間の合計</small><b>{stats.selected.length?`${number(stats.total)} ${unit}`:'未取得'}</b><em>{stats.selected[0]?.date}〜{stats.selected.at(-1)?.date}</em></div></div>
  {items.length?<InsightColumns label={`${label}の保存履歴${monthly?'（月別）':'（日別）'}`} unit={unit} items={items}/>:null}
  {metric==='notifications'?<p className="mipro-note">通知数＝本人通知一覧に保存した通知を、日本時間の日付ごとに数えた件数です。未取得の通知は含みません。記録のない日を「実際の通知0件」とは扱いません。</p>:<p className="mipro-note">日別の公式実績だけを集約しています。週・月単位の公式グラフは別に保存し、日別値へ分割しません。取得していない日は合計・平均・最少記録に含めません。</p>}
  {stats.selected.length?<details className="mipro-history-list"><summary>日ごとの値を見る（{stats.selected.length}日）</summary><dl>{[...stats.selected].reverse().map(r=><div key={r.date}><dt>{r.date}</dt><dd>{number(r.value)} {unit}</dd></div>)}</dl></details>:null}
 </section>
}
