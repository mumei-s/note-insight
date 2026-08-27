import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FastInsightV6 } from "./fast-insight-v6";

export function FastInsightV8(){
  const[target,setTarget]=useState<HTMLElement|null>(null);
  useEffect(()=>{
    const find=()=>setTarget(document.querySelector<HTMLElement>(".iv3-toptools"));
    find();
    const observer=new MutationObserver(find);
    observer.observe(document.body,{childList:true,subtree:true});
    return()=>observer.disconnect();
  },[]);
  return <><FastInsightV6/>{target?createPortal(<nav className="iv8-hubnav" aria-label="CREATOR HUB navigation"><a href="#">TOP</a><a href="#catalog">名鑑</a><a href="#battle">ゲーム</a></nav>,target):null}<style>{`
  .iv8-hubnav{display:flex;gap:6px;flex-wrap:wrap;order:-1;width:100%;padding-bottom:2px}.iv8-hubnav a{border:1px solid #3b5068!important;border-radius:10px!important;background:#0d1823!important;color:#eef6ff!important;text-decoration:none!important;padding:9px 13px!important;font-weight:950!important}.iv8-hubnav a:nth-child(2){border-color:#3b7188!important;color:#8feaff!important}.iv8-hubnav a:nth-child(3){border-color:#665b37!important;color:#ffd76b!important}@media(max-width:650px){.iv8-hubnav{position:sticky;top:0;z-index:60;background:#070a10;padding:7px 0}.iv8-hubnav a{flex:1;text-align:center;padding:8px!important}}
  `}</style></>;
}
