import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FastInsightV6 } from "./fast-insight-v6";
import { FavoriteReader } from "./favorite-reader";

const OWNER="mumei-unified-owner-token";
const FOLLOW_LOSS="https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-follow-loss-summary";

function MagazineRefresh(){
  const[busy,setBusy]=useState(false),[message,setMessage]=useState("保存済み一覧を表示中");
  async function refresh(){
    if(busy)return;
    setBusy(true);setMessage("再取得中…");
    try{
      const r=await fetch("/api/analytics",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"refresh_magazines"}),cache:"no-store"});
      const p=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(p?.error||"更新できませんでした");
      const count=Array.isArray(p?.magazines)?p.magazines.length:0;
      setMessage(`${count}件 更新済み`);
      window.setTimeout(()=>window.location.reload(),500);
    }catch(e){setMessage(e instanceof Error?e.message:"更新できませんでした");setBusy(false)}
  }
  return <div className="iv8-magrefresh"><span>{message}</span><button disabled={busy} onClick={()=>void refresh()}>{busy?"更新中…":"全件更新"}</button></div>;
}

function fmt(v:unknown){return new Intl.NumberFormat("ja-JP").format(Number(v||0))}
function when(v:unknown){const d=new Date(String(v||""));return Number.isNaN(d.getTime())?"日時不明":new Intl.DateTimeFormat("ja-JP",{timeZone:"Asia/Tokyo",month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"}).format(d)}

type NamedLoss={name:string;url:string|null;image:string|null;personKey:string;firstSeenAt?:string|null};
type Loss={at:string;previousTotal:number;currentTotal:number;officialNetLoss:number;namedRemoved:NamedLoss[];namedRemovedCount:number;scopeCandidates?:NamedLoss[];scopeCandidateCount?:number;unidentifiedNetLoss:number;complete:boolean;receivedCount:number};
type FollowData={officialTotal:number;namedScopeCount:number;complete:boolean;scannedAt:string|null;scopeLabel?:string;losses:Loss[]};

function PersonPills({people}:{people:NamedLoss[]}){return <>{people.map((p,j)=>p.url?<a href={p.url} target="_blank" rel="noreferrer" key={`${p.personKey}-${j}`}>{p.image?<img src={p.image} alt="" referrerPolicy="no-referrer"/>:null}{p.name}</a>:<b key={`${p.personKey}-${j}`}>{p.name}</b>)}</>}

function FollowLossSummary(){
  const[data,setData]=useState<FollowData|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState("");
  async function load(){
    const token=localStorage.getItem(OWNER)||"";
    if(!token){setError("OWNER本人認証が必要です");setLoading(false);return}
    setLoading(true);setError("");
    try{
      const r=await fetch(FOLLOW_LOSS,{method:"POST",headers:{"Content-Type":"application/json","X-Owner-Token":token},body:JSON.stringify({days:7}),cache:"no-store"});
      const p=await r.json().catch(()=>({}));
      if(!r.ok||!p?.ok)throw new Error(p?.error||"減少履歴を読み込めませんでした");
      setData(p.followers??null);
    }catch(e){setError(e instanceof Error?e.message:"減少履歴を読み込めませんでした")}finally{setLoading(false)}
  }
  useEffect(()=>{void load()},[]);
  if(loading)return <section className="iv8-loss"><b>フォロワー減少</b><span>直近7日を確認中…</span></section>;
  if(error)return <section className="iv8-loss"><b>フォロワー減少</b><span className="err">{error}</span><button onClick={()=>void load()}>再読込</button></section>;
  if(!data)return null;
  return <section className="iv8-loss"><div className="iv8-loss-head"><div><b>フォロワー減少・直近7日</b><span>公式総数 {fmt(data.officialTotal)}人 / 最新1000人追跡 {fmt(data.namedScopeCount)}人</span></div><button onClick={()=>void load()}>再読込</button></div><small>{data.complete?"全件の名前を照合済み":"noteの人物一覧は最新側から1,000人まで取得。現在一覧はこの最新1,000人だけを表示し、それより外側は公式総数で追跡します。"}</small>{data.losses.length?<div className="iv8-loss-list">{data.losses.map((x,i)=><article key={`${x.at}-${i}`}><div className="iv8-loss-row"><time>{when(x.at)}</time><strong>{fmt(x.previousTotal)} → {fmt(x.currentTotal)} <em>-{fmt(x.officialNetLoss)}</em></strong></div>{x.namedRemoved?.length?<div className="iv8-known"><span>解除を特定：</span><PersonPills people={x.namedRemoved}/></div>:null}{x.scopeCandidates?.length?<div className="iv8-known candidate"><span>最新1000人から消えた候補：</span><PersonPills people={x.scopeCandidates}/>{Number(x.scopeCandidateCount||0)>x.scopeCandidates.length?<small>ほか {fmt(Number(x.scopeCandidateCount||0)-x.scopeCandidates.length)}人</small>:null}</div>:null}{x.unidentifiedNetLoss>0?<div className="iv8-unknown">公式純減 -{fmt(x.unidentifiedNetLoss)}人 <small>（候補は解除確定ではありません）</small></div>:null}</article>)}</div>:<div className="iv8-no-loss">保存済み履歴では直近7日に公式総数の純減はありません。</div>}<div className="iv8-loss-foot">最終照合 {when(data.scannedAt)}</div></section>;
}

export function FastInsightV8(){
  const[magTarget,setMagTarget]=useState<HTMLElement|null>(null),[followTarget,setFollowTarget]=useState<HTMLElement|null>(null),[favoriteTarget,setFavoriteTarget]=useState<HTMLElement|null>(null);
  useEffect(()=>{
    const tune=()=>{
      document.querySelectorAll<HTMLAnchorElement>(".iv3-toptools a").forEach(a=>{const t=a.textContent?.trim()||"";if(t.includes("本人通知")||t.includes("note通知"))a.style.display="none"});
      document.querySelectorAll<HTMLButtonElement>(".iv3-nav button").forEach(b=>{if(b.textContent?.trim()==="本人通知")b.textContent="通知"});
      const heads=[...document.querySelectorAll<HTMLElement>(".iv6-head")];
      const mag=heads.find(x=>x.querySelector("b")?.textContent?.trim()==="マガジン")??null;
      const notify=heads.find(x=>["本人通知","通知"].includes(x.querySelector("b")?.textContent?.trim()||""))??null;
      if(notify){const b=notify.querySelector("b");if(b)b.textContent="通知"}
      const notice=document.querySelector<HTMLElement>(".iv6-noticebar");
      if(notice){const link=notice.querySelector<HTMLAnchorElement>("a");if(link){link.style.display="";link.textContent="自動同期設定";link.href="./notification-import.html?v=3"}}
      document.querySelectorAll<HTMLButtonElement>(".iv6-tabs button").forEach(b=>{if(b.textContent?.trim()==="運営中")b.textContent="自分がオーナー";if(b.textContent?.trim()==="共同参加")b.textContent="参加中"});
      setMagTarget(mag);
      const followHead=heads.find(x=>x.querySelector("b")?.textContent?.trim()==="フォロー")??null;
      if(followHead){const panel=followHead.closest<HTMLElement>(".iv6-panel");if(panel){let mount=panel.querySelector<HTMLElement>("[data-iv8-follow-loss]");if(!mount){mount=document.createElement("div");mount.dataset.iv8FollowLoss="1";followHead.insertAdjacentElement("afterend",mount)}setFollowTarget(mount)}}else setFollowTarget(null);
      document.querySelectorAll<HTMLElement>(".iv8-favorite-mode").forEach(x=>x.classList.remove("iv8-favorite-mode"));
      const favoriteHead=heads.find(x=>x.querySelector("b")?.textContent?.trim()==="お気に入り")??null;
      if(favoriteHead){const panel=favoriteHead.closest<HTMLElement>(".iv6-panel");if(panel){panel.classList.add("iv8-favorite-mode");let mount=panel.querySelector<HTMLElement>("[data-iv8-favorite-reader]");if(!mount){mount=document.createElement("div");mount.dataset.iv8FavoriteReader="1";favoriteHead.insertAdjacentElement("afterend",mount)}setFavoriteTarget(mount)}}else setFavoriteTarget(null);
    };
    tune();const observer=new MutationObserver(tune);observer.observe(document.body,{childList:true,subtree:true});return()=>observer.disconnect();
  },[]);
  return <><FastInsightV6/>{magTarget?createPortal(<MagazineRefresh/>,magTarget):null}{followTarget?createPortal(<FollowLossSummary/>,followTarget):null}{favoriteTarget?createPortal(<FavoriteReader/>,favoriteTarget):null}<style>{`
  .iv8-magrefresh{width:100%;display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:8px;padding:7px 8px;border:1px solid #315069;border-radius:9px;background:#0b1721}.iv8-magrefresh span{color:#9fb1c4;font-size:10px}.iv8-magrefresh button,.iv8-loss button{border:1px solid #39728e;border-radius:8px;background:#102b3b;color:#8feaff;min-height:32px;padding:5px 9px;font-weight:900;white-space:nowrap}.iv8-magrefresh button:disabled{opacity:.55}.iv8-loss{display:grid;gap:7px;border:1px solid #5a3f43;border-radius:10px;background:#151014;padding:10px;margin:0 0 10px}.iv8-loss-head{display:flex;justify-content:space-between;gap:8px;align-items:flex-start}.iv8-loss-head>div{display:grid;gap:2px}.iv8-loss-head b{font-size:14px;color:#ffb6be}.iv8-loss-head span,.iv8-loss>small,.iv8-loss-foot{color:#8f9daf;font-size:10px}.iv8-loss-list{display:grid;gap:6px}.iv8-loss-list article{border:1px solid #3b3038;border-radius:8px;background:#0c1016;padding:8px}.iv8-loss-row{display:flex;justify-content:space-between;gap:8px;align-items:center}.iv8-loss-row time{color:#95a4b6;font-size:10px}.iv8-loss-row strong{font-size:12px}.iv8-loss-row em{font-style:normal;color:#ff8996}.iv8-known{display:flex;align-items:center;gap:5px;flex-wrap:wrap;margin-top:6px;font-size:10px}.iv8-known>span{color:#8f9daf}.iv8-known a,.iv8-known b{display:inline-flex;align-items:center;gap:4px;border:1px solid #3b4e63;border-radius:999px;padding:3px 6px;color:#dfeaf6;text-decoration:none;background:#111a24}.iv8-known img{width:18px;height:18px;border-radius:50%;object-fit:cover}.iv8-known.candidate{border-top:1px dashed #3a4555;padding-top:6px}.iv8-known.candidate>span{color:#ffd078;font-weight:900}.iv8-known.candidate>small{color:#8e9aaa}.iv8-unknown{margin-top:6px;color:#ffd078;font-weight:900;font-size:11px}.iv8-unknown small{color:#9b8a70;font-weight:500}.iv8-no-loss{color:#8dffad;font-size:11px}.iv8-loss .err{color:#ff9faa}.iv8-loss-foot{text-align:right}.iv8-favorite-mode .iv3-row,.iv8-favorite-mode .iv3-empty,.iv8-favorite-mode .v3-pager,.iv8-favorite-mode .iv3-search{display:none!important}@media(max-width:650px){.iv8-magrefresh{display:grid}.iv8-magrefresh button{width:100%}.iv8-loss-row{align-items:flex-start;flex-direction:column;gap:2px}.iv8-loss-head span{font-size:10px}}
  `}</style></>;
}
