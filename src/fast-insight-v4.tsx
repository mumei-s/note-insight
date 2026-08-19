import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FastInsightV3 } from "./fast-insight-v3";

const SOCIAL_API="https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-period-social";
const OWNER_KEY="mumei-unified-owner-token";

type Delta={at:string;total:number;delta:number;complete:boolean;addedCount:number;removedCount:number};

async function socialDelta(direction:"followers"|"followings"){
  const token=localStorage.getItem(OWNER_KEY)||"";
  if(!token)return null;
  const r=await fetch(SOCIAL_API,{method:"POST",headers:{"Content-Type":"application/json","X-Owner-Token":token},body:JSON.stringify({action:"social_changes",direction,page:1,pageSize:30,kind:"all"})});
  if(!r.ok)return null;
  return await r.json();
}

function SocialSummary(){
  const[followers,setFollowers]=useState<any>(null),[followings,setFollowings]=useState<any>(null);
  useEffect(()=>{void Promise.all([socialDelta("followers"),socialDelta("followings")]).then(([a,b])=>{setFollowers(a);setFollowings(b)})},[]);
  const fd:Delta|undefined=followers?.timeline?.[0];
  const gd:Delta|undefined=followings?.timeline?.[0];
  const sign=(n:number)=>n>0?`+${n}`:String(n||0);
  return <div style={{marginTop:10,borderTop:"1px solid #2a3a4f",paddingTop:10,display:"grid",gap:7}}>
    <div><b>フォロワー総数の前回比：</b> <strong style={{color:(fd?.delta??0)>=0?"#86ffad":"#ff9ca9"}}>{fd?sign(fd.delta):"―"}</strong>{fd?<span> （現在 {fd.total.toLocaleString()}）</span>:null}</div>
    <div><b>フォロー中の前回比：</b> <strong style={{color:(gd?.delta??0)>=0?"#86ffad":"#ff9ca9"}}>{gd?sign(gd.delta):"―"}</strong>{gd?<span> （現在 {gd.total.toLocaleString()}）</span>:null}</div>
    <small style={{color:"#aab7c7",lineHeight:1.55}}>「増減履歴」→「増えた／減った」で人物を確認できます。フォロー中は全件照合できるため人物名まで確定表示。フォロワーはnote公開一覧が1,000人で止まるため、人物を確定できない解除は推測表示しません。</small>
  </div>;
}

export function FastInsightV4(){
  const[topTarget,setTopTarget]=useState<HTMLElement|null>(null);
  const[socialTarget,setSocialTarget]=useState<HTMLElement|null>(null);
  useEffect(()=>{
    const tune=()=>{
      setTopTarget(document.querySelector<HTMLElement>(".iv3-toptools"));
      const scope=document.querySelector<HTMLElement>(".iv3-scope");
      if(scope){scope.style.border="2px solid #54d8ff";scope.style.background="#0b1822";scope.style.boxShadow="0 0 0 1px rgba(84,216,255,.12)";}
      document.querySelectorAll<HTMLButtonElement>(".iv3-scopetabs button").forEach((button)=>{
        if(button.textContent==="日付")button.textContent="日ごと";
        if(button.textContent==="月")button.textContent="月ごと";
        if(button.textContent==="年")button.textContent="年ごと";
        button.style.minHeight="42px";
        button.style.fontSize="14px";
      });
      const heading=[...document.querySelectorAll<HTMLElement>(".iv3-panel h2")].find(x=>x.textContent?.trim()==="フォロー");
      const panel=heading?.closest<HTMLElement>(".iv3-panel")??null;
      const meta=panel?.querySelector<HTMLElement>(".iv3-socialmeta")??null;
      setSocialTarget(meta);
      if(panel){
        [...panel.querySelectorAll<HTMLButtonElement>(".iv3-tabs button")].forEach(button=>{
          if(["現在一覧","増減履歴","すべて","増えた","減った"].includes(button.textContent?.trim()||"")){
            button.style.minHeight="42px";
            button.style.fontSize="14px";
          }
        });
      }
    };
    tune();
    const observer=new MutationObserver(tune);
    observer.observe(document.body,{childList:true,subtree:true});
    return()=>observer.disconnect();
  },[]);
  return <><FastInsightV3/>{topTarget?createPortal(<><a href="#article-likes" style={{borderColor:"#6d5dfc",color:"#c9c2ff"}}>記事別スキ分析</a><a href="./notification-import.html" style={{borderColor:"#54d8ff",color:"#8feaff"}}>note通知を取り込む</a></>,topTarget):null}{socialTarget?createPortal(<SocialSummary/>,socialTarget):null}</>;
}
