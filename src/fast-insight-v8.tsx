import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FastInsightV6 } from "./fast-insight-v6";
import { FavoriteReader } from "./favorite-reader";

const OWNER="mumei-unified-owner-token";
const FOLLOW_LOSS="https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-follow-loss-summary";
const MAG_RESYNC="https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-magazine-resync";
const MAG_SYNC_KEY="mumei-magazine-last-sync";

function AppRefresh(){
  const[busy,setBusy]=useState(false);
  async function refresh(){
    if(busy)return;
    setBusy(true);
    try{
      if("caches" in window){
        const keys=await caches.keys();
        await Promise.all(keys.filter(k=>k.startsWith("mumei-note-insight")).map(k=>caches.delete(k)));
      }
      if("serviceWorker" in navigator){
        const regs=await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.filter(r=>r.scope.startsWith(location.origin)).map(r=>r.unregister()));
      }
    }finally{
      const u=new URL(location.href);
      u.searchParams.set("refresh",String(Date.now()));
      u.hash="dashboard";
      location.replace(u.toString());
    }
  }
  return <button className="iv8-apprefresh" disabled={busy} onClick={()=>void refresh()}>{busy?"更新中…":"最新版に更新"}</button>;
}

function MagazineRefresh(){
  const[busy,setBusy]=useState(false),[message,setMessage]=useState("マガジン一覧を表示中");
  async function refresh(auto=false){
    if(busy)return;
    const token=localStorage.getItem(OWNER)||"";
    if(!token){setMessage("OWNER本人認証が必要です");return}
    setBusy(true);setMessage(auto?"古い一覧を自動再同期中…":"マガジンを再同期中…");
    try{
      const r=await fetch(MAG_RESYNC,{method:"POST",headers:{"Content-Type":"application/json","X-Owner-Token":token},body:"{}",cache:"no-store"});
      const p=await r.json().catch(()=>({}));
      if(!r.ok||!p?.ok)throw new Error(p?.error||"再同期できませんでした");
      localStorage.setItem(MAG_SYNC_KEY,String(Date.now()));
      setMessage(`${Number(p.count||0)}件 再同期済み・オーナー${Number(p.counts?.owner||0)} / 参加${Number(p.counts?.participant||0)}`);
      window.setTimeout(()=>window.location.reload(),650);
    }catch(e){setMessage(e instanceof Error?e.message:"再同期できませんでした");setBusy(false)}
  }
  useEffect(()=>{const last=Number(localStorage.getItem(MAG_SYNC_KEY)||0);if(!last||Date.now()-last>6*60*60*1000)void refresh(true)},[]);
  return <div className="iv8-magrefresh"><span>{message}</span><button disabled={busy} onClick={()=>void refresh(false)}>{busy?"再同期中…":"マガジン再同期"}</button></div>;
}

function fmt(v:unknown){return new Intl.NumberFormat("ja-JP").format(Number(v||0))}
function when(v:unknown){const d=new Date(String(v||""));return Number.isNaN(d.getTime())?"日時不明":new Intl.DateTimeFormat("ja-JP",{timeZone:"Asia/Tokyo",month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"}).format(d)}

type NamedLoss={name:string;url:string|null;image:string|null;personKey:string;firstSeenAt?:string|null};
type Loss={at:string;previousTotal:number;currentTotal:number;officialNetLoss:number;namedRemoved:NamedLoss[];namedRemovedCount:number;scopeCandidates?:NamedLoss[];scopeCandidateCount?:number;unidentifiedNetLoss:number;complete:boolean;receivedCount:number};
type FollowData={officialTotal:number;namedScopeCount:number;complete:boolean;scannedAt:string|null;scopeLabel?:string;losses:Loss[]};

function PersonPills({people}:{people:NamedLoss[]}){return <>{people.map((p,j)=>{const inner=<>{p.image?<img src={p.image} alt="" referrerPolicy="no-referrer"/>:<span className="iv8-person-fallback">{[...String(p.name||"?")][0]||"?"}</span>}<span>{p.name}</span></>;return p.url?<a href={p.url} target="_blank" rel="noreferrer" key={`${p.personKey}-${j}`}>{inner}</a>:<b key={`${p.personKey}-${j}`}>{inner}</b>})}</>}

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
  const seen=new Set<string>(),recentNames:NamedLoss[]=[];
  for(const loss of data.losses){for(const p of [...(loss.namedRemoved||[]),...(loss.scopeCandidates||[])]){const k=p.personKey||p.url||p.name;if(!seen.has(k)){seen.add(k);recentNames.push(p)}if(recentNames.length>=20)break}if(recentNames.length>=20)break}
  return <section className="iv8-loss"><div className="iv8-loss-head"><div><b>フォロワー減少・直近7日</b><span>公式総数 {fmt(data.officialTotal)}人 / 最新1000人追跡 {fmt(data.namedScopeCount)}人</span></div><button onClick={()=>void load()}>再読込</button></div><small>{data.complete?"全件の名前を照合済み":"名前は最新側1,000人を追跡。1,000位境界で外れた人は解除確定ではなく候補として表示します。"}</small>{recentNames.length?<div className="iv8-name-summary"><strong>直近で名前まで追えた減少・候補</strong><div><PersonPills people={recentNames}/></div></div>:null}{data.losses.length?<div className="iv8-loss-list">{data.losses.map((x,i)=><article key={`${x.at}-${i}`}><div className="iv8-loss-row"><time>{when(x.at)}</time><strong>{fmt(x.previousTotal)} → {fmt(x.currentTotal)} <em>-{fmt(x.officialNetLoss)}</em></strong></div>{x.namedRemoved?.length?<div className="iv8-known"><span>解除を特定：</span><PersonPills people={x.namedRemoved}/></div>:null}{x.scopeCandidates?.length?<div className="iv8-known candidate"><span>名前候補：</span><PersonPills people={x.scopeCandidates}/>{Number(x.scopeCandidateCount||0)>x.scopeCandidates.length?<small>ほか {fmt(Number(x.scopeCandidateCount||0)-x.scopeCandidates.length)}人</small>:null}</div>:null}{x.unidentifiedNetLoss>0?<div className="iv8-unknown">公式純減 -{fmt(x.unidentifiedNetLoss)}人 <small>（1000人外を含み名前確定不可）</small></div>:null}</article>)}</div>:<div className="iv8-no-loss">保存済み履歴では直近7日に公式総数の純減はありません。</div>}<div className="iv8-loss-foot">最終照合 {when(data.scannedAt)}</div></section>;
}

export function FastInsightV8(){
  const[magTarget,setMagTarget]=useState<HTMLElement|null>(null),[followTarget,setFollowTarget]=useState<HTMLElement|null>(null),[favoriteTarget,setFavoriteTarget]=useState<HTMLElement|null>(null),[updateTarget,setUpdateTarget]=useState<HTMLElement|null>(null);
  useEffect(()=>{
    const tune=()=>{
      const topTools=document.querySelector<HTMLElement>(".iv3-toptools");
      if(topTools){
        let mount=topTools.querySelector<HTMLElement>("[data-iv8-app-refresh]");
        if(!mount){mount=document.createElement("span");mount.dataset.iv8AppRefresh="1";topTools.appendChild(mount)}
        setUpdateTarget(mount);
      }else setUpdateTarget(null);
      document.querySelectorAll<HTMLAnchorElement>(".iv3-toptools a").forEach(a=>{const t=a.textContent?.trim()||"";if(t.includes("本人通知")||t.includes("note通知"))a.style.display="none"});
      document.querySelectorAll<HTMLButtonElement>(".iv3-nav button").forEach(b=>{if(b.textContent?.trim()==="本人通知")b.textContent="通知"});
      const heads=[...document.querySelectorAll<HTMLElement>(".iv6-head")];
      const mag=heads.find(x=>x.querySelector("b")?.textContent?.trim()==="マガジン")??null;
      const notify=heads.find(x=>["本人通知","通知"].includes(x.querySelector("b")?.textContent?.trim()||""))??null;
      if(notify){const b=notify.querySelector("b");if(b)b.textContent="通知"}
      const notice=document.querySelector<HTMLElement>(".iv6-noticebar");
      if(notice){const link=notice.querySelector<HTMLAnchorElement>("a");if(link){link.style.display="";link.textContent="通知同期を更新・設定";link.href="./notification-import.html?v=5"}}
      document.querySelectorAll<HTMLButtonElement>(".iv6-tabs button").forEach(b=>{const t=b.textContent?.trim()||"";if(t==="運営中")b.textContent="自分がオーナー";if(t==="共同参加")b.textContent="参加中";if(t==="追跡")b.style.display="none"});
      setMagTarget(mag);
      const followHead=heads.find(x=>x.querySelector("b")?.textContent?.trim()==="フォロー")??null;
      if(followHead){const panel=followHead.closest<HTMLElement>(".iv6-panel");if(panel){let mount=panel.querySelector<HTMLElement>("[data-iv8-follow-loss]");if(!mount){mount=document.createElement("div");mount.dataset.iv8FollowLoss="1";followHead.insertAdjacentElement("afterend",mount)}setFollowTarget(mount)}}else setFollowTarget(null);
      document.querySelectorAll<HTMLElement>(".iv8-favorite-mode").forEach(x=>x.classList.remove("iv8-favorite-mode"));
      const favoriteHead=heads.find(x=>x.querySelector("b")?.textContent?.trim()==="お気に入り")??null;
      if(favoriteHead){const panel=favoriteHead.closest<HTMLElement>(".iv6-panel");if(panel){panel.classList.add("iv8-favorite-mode");let mount=panel.querySelector<HTMLElement>("[data-iv8-favorite-reader]");if(!mount){mount=document.createElement("div");mount.dataset.iv8FavoriteReader="1";favoriteHead.insertAdjacentElement("afterend",mount)}setFavoriteTarget(mount)}}else setFavoriteTarget(null);
    };
    tune();const observer=new MutationObserver(tune);observer.observe(document.body,{childList:true,subtree:true});return()=>observer.disconnect();
  },[]);
  return <><FastInsightV6/>{updateTarget?createPortal(<AppRefresh/>,updateTarget):null}{magTarget?createPortal(<MagazineRefresh/>,magTarget):null}{followTarget?createPortal(<FollowLossSummary/>,followTarget):null}{favoriteTarget?createPortal(<FavoriteReader/>,favoriteTarget):null}<style>{`
  .iv8-apprefresh{border:1px solid #586f8b;border-radius:10px;background:#172434;color:#a9e9ff;padding:9px 12px;font-weight:900;min-height:40px}.iv8-apprefresh:disabled{opacity:.55}.iv8-magrefresh{width:100%;display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:8px;padding:8px;border:1px solid #315069;border-radius:9px;background:#0b1721}.iv8-magrefresh span{color:#9fb1c4;font-size:10px}.iv8-magrefresh button,.iv8-loss button{border:1px solid #39728e;border-radius:8px;background:#102b3b;color:#8feaff;min-height:34px;padding:5px 10px;font-weight:900;white-space:nowrap}.iv8-magrefresh button:disabled{opacity:.55}.iv8-loss{display:grid;gap:8px;border:1px solid #5a3f43;border-radius:10px;background:#151014;padding:10px;margin:0 0 10px}.iv8-loss-head{display:flex;justify-content:space-between;gap:8px;align-items:flex-start}.iv8-loss-head>div{display:grid;gap:2px}.iv8-loss-head b{font-size:14px;color:#ffb6be}.iv8-loss-head span,.iv8-loss>small,.iv8-loss-foot{color:#8f9daf;font-size:10px}.iv8-name-summary{border:1px solid #70522f;border-radius:9px;background:#1d160d;padding:9px}.iv8-name-summary>strong{display:block;color:#ffd078;font-size:11px;margin-bottom:7px}.iv8-name-summary>div{display:flex;gap:6px;flex-wrap:wrap}.iv8-loss-list{display:grid;gap:6px}.iv8-loss-list article{border:1px solid #3b3038;border-radius:8px;background:#0c1016;padding:8px}.iv8-loss-row{display:flex;justify-content:space-between;gap:8px;align-items:center}.iv8-loss-row time{color:#95a4b6;font-size:10px}.iv8-loss-row strong{font-size:12px}.iv8-loss-row em{font-style:normal;color:#ff8996}.iv8-known{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:7px;font-size:10px}.iv8-known>span{color:#8f9daf;font-weight:900}.iv8-known a,.iv8-known b,.iv8-name-summary a,.iv8-name-summary b{display:inline-flex;align-items:center;gap:5px;border:1px solid #3b4e63;border-radius:999px;padding:4px 7px;color:#dfeaf6;text-decoration:none;background:#111a24;font-size:10px}.iv8-known img,.iv8-name-summary img,.iv8-person-fallback{width:21px;height:21px;border-radius:50%;object-fit:cover}.iv8-person-fallback{display:grid;place-items:center;background:#26384d;color:#bfeaff;font-weight:950}.iv8-known.candidate{border-top:1px dashed #4a4b4f;padding-top:7px}.iv8-known.candidate>span{color:#ffd078}.iv8-known.candidate>small{color:#8e9aaa}.iv8-unknown{margin-top:6px;color:#ffd078;font-weight:900;font-size:11px}.iv8-unknown small{color:#9b8a70;font-weight:500}.iv8-no-loss{color:#8dffad;font-size:11px}.iv8-loss .err{color:#ff9faa}.iv8-loss-foot{text-align:right}.iv8-favorite-mode .iv3-row,.iv8-favorite-mode .iv3-empty,.iv8-favorite-mode .v3-pager,.iv8-favorite-mode .iv3-search{display:none!important}@media(max-width:650px){.iv8-magrefresh{display:grid}.iv8-magrefresh button,.iv8-apprefresh{width:100%}.iv8-loss-row{align-items:flex-start;flex-direction:column;gap:2px}.iv8-loss-head span{font-size:10px}}
  `}</style></>;
}
