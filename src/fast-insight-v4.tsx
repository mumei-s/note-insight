import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FastInsightV3 } from "./fast-insight-v3";

export function FastInsightV4(){
  const[target,setTarget]=useState<HTMLElement|null>(null);
  useEffect(()=>{
    const find=()=>setTarget(document.querySelector<HTMLElement>(".iv3-toptools"));
    find();
    const observer=new MutationObserver(find);
    observer.observe(document.body,{childList:true,subtree:true});
    return()=>observer.disconnect();
  },[]);
  return <>{<FastInsightV3/>}{target?createPortal(<a href="#article-likes" style={{borderColor:"#6d5dfc",color:"#c9c2ff"}}>記事別スキ分析</a>,target):null}</>;
}
