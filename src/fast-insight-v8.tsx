import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FastInsightV6 } from "./fast-insight-v6";

function MagazineRefresh(){
  const[busy,setBusy]=useState(false),[message,setMessage]=useState("保存済みのマガジン全件を表示します。");
  async function refresh(){
    if(busy)return;
    setBusy(true);setMessage("noteからマガジン一覧を再取得しています…");
    try{
      const r=await fetch("/api/analytics",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"refresh_magazines"}),cache:"no-store"});
      const p=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(p?.error||"更新できませんでした");
      const count=Array.isArray(p?.magazines)?p.magazines.length:0;
      setMessage(`${count}件を再取得しました。`);
      window.location.reload();
    }catch(e){setMessage(e instanceof Error?e.message:"更新できませんでした");setBusy(false)}
  }
  return <div className="iv8-magrefresh"><span>{message}</span><button disabled={busy} onClick={()=>void refresh()}>{busy?"再取得中…":"マガジン全件を再取得"}</button></div>;
}

export function FastInsightV8(){
  const[target,setTarget]=useState<HTMLElement|null>(null),[magTarget,setMagTarget]=useState<HTMLElement|null>(null);
  useEffect(()=>{
    const find=()=>{
      setTarget(document.querySelector<HTMLElement>(".iv3-toptools"));
      const head=[...document.querySelectorAll<HTMLElement>(".iv6-head")].find(x=>x.querySelector("b")?.textContent?.trim()==="マガジン")??null;
      setMagTarget(head);
    };
    find();
    const observer=new MutationObserver(find);
    observer.observe(document.body,{childList:true,subtree:true});
    return()=>observer.disconnect();
  },[]);
  return <><FastInsightV6/>{target?createPortal(<nav className="iv8-hubnav" aria-label="CREATOR HUB navigation"><a href="#">TOP</a><a href="#catalog">名鑑</a><a href="#battle">ゲーム</a></nav>,target):null}{magTarget?createPortal(<MagazineRefresh/>,magTarget):null}<style>{`
  .iv8-hubnav{display:flex;gap:6px;flex-wrap:wrap;order:-1;width:100%;padding-bottom:2px}.iv8-hubnav a{border:1px solid #3b5068!important;border-radius:10px!important;background:#0d1823!important;color:#eef6ff!important;text-decoration:none!important;padding:9px 13px!important;font-weight:950!important}.iv8-hubnav a:nth-child(2){border-color:#3b7188!important;color:#8feaff!important}.iv8-hubnav a:nth-child(3){border-color:#665b37!important;color:#ffd76b!important}.iv8-magrefresh{width:100%;display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:8px;padding:8px 9px;border:1px solid #315069;border-radius:9px;background:#0b1721}.iv8-magrefresh span{color:#9fb1c4;font-size:10px}.iv8-magrefresh button{border:1px solid #39728e;border-radius:8px;background:#102b3b;color:#8feaff;min-height:34px;padding:6px 9px;font-weight:900;white-space:nowrap}.iv8-magrefresh button:disabled{opacity:.55}@media(max-width:650px){.iv8-hubnav{position:sticky;top:0;z-index:60;background:#070a10;padding:7px 0}.iv8-hubnav a{flex:1;text-align:center;padding:8px!important}.iv8-magrefresh{display:grid}.iv8-magrefresh button{width:100%}}
  `}</style></>;
}
