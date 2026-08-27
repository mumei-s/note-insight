import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FastInsightV6 } from "./fast-insight-v6";

const NOTIFY="https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-notifications";
const OWNER="mumei-unified-owner-token";

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

function AutoNotice({message}:{message:string}){
  return <div className="iv8-autonotify"><b>自動取得</b><span>{message}</span><small>スキ・コメント・フォローなど公開反応は自動更新</small></div>;
}

export function FastInsightV8(){
  const[magTarget,setMagTarget]=useState<HTMLElement|null>(null),[notifyTarget,setNotifyTarget]=useState<HTMLElement|null>(null),[notifyMessage,setNotifyMessage]=useState("確認中…");
  useEffect(()=>{
    const token=localStorage.getItem(OWNER)||"";
    if(token){void fetch(NOTIFY,{method:"POST",headers:{"Content-Type":"application/json","X-Owner-Token":token},body:JSON.stringify({action:"watch-now"}),cache:"no-store"}).then(async r=>{const p=await r.json().catch(()=>({}));if(!r.ok)throw new Error(p?.error||"自動取得エラー");setNotifyMessage(`最終確認 ${new Intl.DateTimeFormat("ja-JP",{hour:"2-digit",minute:"2-digit"}).format(new Date(p.lastWatchAt||Date.now()))}・新規 ${Number(p.newNotifications||0)}件`)}).catch(e=>setNotifyMessage(e instanceof Error?e.message:"自動取得エラー"))}
  },[]);
  useEffect(()=>{
    const tune=()=>{
      document.querySelectorAll<HTMLAnchorElement>(".iv3-toptools a").forEach(a=>{const t=a.textContent?.trim()||"";if(t.includes("本人通知")||t.includes("note通知"))a.style.display="none"});
      document.querySelectorAll<HTMLButtonElement>(".iv3-nav button").forEach(b=>{if(b.textContent?.trim()==="本人通知")b.textContent="通知"});
      const heads=[...document.querySelectorAll<HTMLElement>(".iv6-head")];
      const mag=heads.find(x=>x.querySelector("b")?.textContent?.trim()==="マガジン")??null;
      const notify=heads.find(x=>["本人通知","通知"].includes(x.querySelector("b")?.textContent?.trim()||""))??null;
      if(notify){const b=notify.querySelector("b");if(b)b.textContent="通知"}
      document.querySelectorAll<HTMLButtonElement>(".iv6-tabs button").forEach(b=>{if(b.textContent?.trim()==="運営中")b.textContent="自分がオーナー";if(b.textContent?.trim()==="共同参加")b.textContent="参加中"});
      setMagTarget(mag);setNotifyTarget(document.querySelector<HTMLElement>(".iv6-noticebar"));
    };
    tune();const observer=new MutationObserver(tune);observer.observe(document.body,{childList:true,subtree:true});return()=>observer.disconnect();
  },[]);
  return <><FastInsightV6/>{magTarget?createPortal(<MagazineRefresh/>,magTarget):null}{notifyTarget?createPortal(<AutoNotice message={notifyMessage}/>,notifyTarget):null}<style>{`
  .iv6-noticebar>a{display:none!important}.iv8-autonotify{width:100%;display:grid;gap:2px}.iv8-autonotify b{color:#8dffad}.iv8-autonotify span{color:#eef5fc;font-weight:850}.iv8-autonotify small{color:#7f90a5}.iv8-magrefresh{width:100%;display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:8px;padding:7px 8px;border:1px solid #315069;border-radius:9px;background:#0b1721}.iv8-magrefresh span{color:#9fb1c4;font-size:10px}.iv8-magrefresh button{border:1px solid #39728e;border-radius:8px;background:#102b3b;color:#8feaff;min-height:32px;padding:5px 9px;font-weight:900;white-space:nowrap}.iv8-magrefresh button:disabled{opacity:.55}@media(max-width:650px){.iv8-magrefresh{display:grid}.iv8-magrefresh button{width:100%}}
  `}</style></>;
}
