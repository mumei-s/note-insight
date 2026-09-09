import { useEffect, useMemo, useState } from "react";
import { INSIGHT_TOKEN_KEY } from "./insight-account-store";
import "./member-insight-completeness.css";

const ENDPOINT="https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-data-completeness";
const GRID_KEY="mumei-insight-completeness-grid-v1";
const DEFAULT_SLOTS=["articles","likes","comments","social","dashboard","notifications"];
const CANDIDATE_IDS=["articles","likes","comments","social","dashboard","notifications","favorites","magazines","supporters"];
type Row=Record<string,any>;
type Shortcut={id:string;label:string;value:string;tab?:string;mode?:string};
const n=(v:any)=>new Intl.NumberFormat("ja-JP").format(Number(v||0));
const date=(v:any)=>{if(!v)return"—";const d=new Date(String(v));if(Number.isNaN(d.getTime()))return"—";return new Intl.DateTimeFormat("ja-JP",{timeZone:"Asia/Tokyo",month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"}).format(d)};
async function load(){const token=localStorage.getItem(INSIGHT_TOKEN_KEY)||"";if(!token)throw new Error("INSIGHT_LOGIN_REQUIRED");const c=new AbortController(),timer=window.setTimeout(()=>c.abort(),30000);try{const r=await fetch(ENDPOINT,{method:"POST",headers:{"Content-Type":"application/json","X-Insight-Token":token},body:"{}",cache:"no-store",signal:c.signal});const p=await r.json().catch(()=>({}));if(!r.ok||p?.ok===false)throw new Error(p?.error||"取得状態を確認できませんでした");return p}finally{window.clearTimeout(timer)}}
function pick(items:Row[],pattern:RegExp){return items.find(x=>pattern.test(String(x.label||"")))||null}
function savedSlots(){try{const raw=JSON.parse(localStorage.getItem(GRID_KEY)||"[]");const valid=[...new Set((Array.isArray(raw)?raw:[]).map(String).filter(x=>CANDIDATE_IDS.includes(x)))];for(const id of DEFAULT_SLOTS)if(valid.length<6&&!valid.includes(id))valid.push(id);for(const id of CANDIDATE_IDS)if(valid.length<6&&!valid.includes(id))valid.push(id);return valid.slice(0,6)}catch{return DEFAULT_SLOTS}}
function openShortcut(x:Shortcut){if(x.mode){window.dispatchEvent(new CustomEvent("mumei-insight-open-mode",{detail:x.mode}));return}if(!x.tab)return;const buttons=[...document.querySelectorAll<HTMLButtonElement>(".miu-nav button")],b=buttons.find(v=>v.textContent?.trim()===x.tab);if(b)b.click();window.setTimeout(()=>document.querySelector<HTMLElement>(".miu")?.scrollIntoView({block:"start",behavior:"auto"}),60)}

export function MemberInsightCompleteness({revision=0}:{revision?:number}){
  const[data,setData]=useState<Row|null>(null),[error,setError]=useState(""),[slots,setSlots]=useState<string[]>(savedSlots),[pickerOpen,setPickerOpen]=useState(false),[noticeOpen,setNoticeOpen]=useState(false);
  useEffect(()=>{let dead=false;setError("");void load().then(x=>{if(!dead)setData(x)}).catch(e=>{if(!dead)setError(e instanceof Error?e.message:"取得状態の確認に失敗しました")});return()=>{dead=true}},[revision]);
  useEffect(()=>{try{localStorage.setItem(GRID_KEY,JSON.stringify(slots))}catch{}},[slots]);
  const shortcuts=useMemo<Shortcut[]>(()=>{if(!data)return[];const items:Row[]=data.items||[],article=pick(items,/記事/),likes=pick(items,/スキ/),comments=pick(items,/コメント/),followers=pick(items,/フォロワー/),followings=pick(items,/フォロー中|フォロー(?!ワー)/);return[
    {id:"articles",label:"記事",value:n(article?.stored),tab:"記事"},
    {id:"likes",label:"スキ",value:n(likes?.stored),tab:"スキ履歴"},
    {id:"comments",label:"コメント",value:n(comments?.stored),tab:"コメント"},
    {id:"social",label:"フォロー/フォロワー",value:`${n(followings?.stored)} / ${n(followers?.stored)}`,tab:"フォロー"},
    {id:"dashboard",label:"PV・分析",value:data.dashboard?.available?"取得済":"未取得",mode:"analysis"},
    {id:"notifications",label:"通知",value:data.notifications?.synced?"同期済":"未同期",tab:"通知"},
    {id:"favorites",label:"お気に入り",value:"履歴",tab:"お気に入り"},
    {id:"magazines",label:"マガジン",value:"履歴",tab:"マガジン"},
    {id:"supporters",label:"スキ順位",value:"順位",tab:"スキ順位"},
  ]},[data]);
  if(error)return <aside className="micmp error">取得状態：{error}</aside>;
  if(!data)return <aside className="micmp loading">公開データを照合中…</aside>;
  const byId=new Map(shortcuts.map(x=>[x.id,x]));
  function replaceSlot(index:number,id:string){if(slots.includes(id)&&slots[index]!==id)return;setSlots(v=>v.map((x,i)=>i===index?id:x))}
  function moveSlot(index:number,delta:number){const next=index+delta;if(next<0||next>=slots.length)return;setSlots(v=>{const copy=[...v],[a,b]=[copy[index],copy[next]];copy[index]=b;copy[next]=a;return copy})}
  return <aside className={data.publicExact?"micmp exact":"micmp incomplete"}>
    <header><b>{data.publicExact?"✓ 公開データ確認済み":"↻ 公開データ確認中"}</b><time>照合 {date(data.checkedAt)}</time></header>
    <div className="micmp-grid8">
      <button className={`micmp-fixed ${pickerOpen?"active":""}`} onClick={()=>{setPickerOpen(v=>!v);setNoticeOpen(false)}}><span>☰ 選択</span><b>6枠</b></button>
      <button className={`micmp-fixed warning ${noticeOpen?"active":""}`} onClick={()=>{setNoticeOpen(v=>!v);setPickerOpen(false)}}><span>⚠ 注意</span><b>説明</b></button>
      {slots.map(id=>{const x=byId.get(id);return x?<button key={id} onClick={()=>openShortcut(x)}><span>{x.label}</span><b>{x.value}</b></button>:null})}
    </div>
    {pickerOpen?<section className="micmp-picker" aria-label="表示項目の選択"><div className="micmp-picker-head"><b>表示する6枠</b><small>項目選択＋並び替えはこの端末に保存</small></div>{slots.map((id,i)=><div className="micmp-picker-row" key={`${i}-${id}`}><em>{i+1}</em><select value={id} onChange={e=>replaceSlot(i,e.target.value)}>{CANDIDATE_IDS.map(cid=>{const item=byId.get(cid);return <option value={cid} key={cid} disabled={slots.includes(cid)&&cid!==id}>{item?.label||cid}</option>})}</select><button disabled={i===0} onClick={()=>moveSlot(i,-1)}>↑</button><button disabled={i===slots.length-1} onClick={()=>moveSlot(i,1)}>↓</button></div>)}</section>:null}
    {noticeOpen?<section className="micmp-notice"><div><b>✓ 通常データ</b><span>公開記事・スキ・コメント・お気に入り・フォロー/フォロワー・公開プロフィールは本人通知なしでも利用できます。</span></div><div><b>🔔 本人通知</b><span>note通知欄にしかない履歴、メンシプ参加/反応、掲示板返信などを追加取得します。推定・補完を含むため大きな誤差が出る場合があります。</span></div><div><b>📊 ダッシュボード</b><span>公式値のPV・流入・分析を別経路で取得します。同期ツールの導入/更新は上段のダッシュボードから行えます。</span></div><div><b>公開データ確認済み</b><span>公開一覧とnote公式総数は分けて扱います。プロフィール非表示・限定公開など公開一覧外の記事があっても不足扱いにはしません。</span></div><div className="precision"><b>データ精度</b><span>取得条件・ブラウザ・note側表示により欠落・重複・時刻ずれが生じます。重要な確認はnote本体を優先してください。</span></div></section>:null}
  </aside>
}
