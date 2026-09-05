import { useEffect, useRef, useState } from "react";
import { INSIGHT_TOKEN_KEY } from "./insight-account-store";
import { MemberInsightUnifiedV4 } from "./member-insight-unified-v4";
import { MemberInsightSocialV2 } from "./member-insight-social-v2";
import { MemberInsightNotificationsFinal } from "./member-insight-notifications-final";
import { MemberInsightAnalyticsFinal } from "./member-insight-analytics-final";
import { MemberInsightCommentsFinal } from "./member-insight-comments-final";
import { MemberInsightFavoritesFinal } from "./member-insight-favorites-final";
import { MemberInsightCompleteness } from "./member-insight-completeness";
import "./member-insight-hotfix.css";
import "./member-insight-live-v2.css";

const MEMBER="https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-member-api";
const RELATIONS="https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-relations";
const AUTO_MS=120_000;
const RELATION_MS=600_000;
const QUIET_MS=2_500;
type Mode="normal"|"comments"|"favorites"|"social"|"notifications"|"analysis";

async function post(endpoint:string,action:string,extra:Record<string,unknown>={},timeout=45_000){
  const token=localStorage.getItem(INSIGHT_TOKEN_KEY)||"";
  if(!token)throw new Error("INSIGHT_LOGIN_REQUIRED");
  const c=new AbortController(),timer=window.setTimeout(()=>c.abort(),timeout);
  try{
    const r=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json","X-Insight-Token":token},body:JSON.stringify({action,...extra}),cache:"no-store",signal:c.signal});
    const p=await r.json().catch(()=>({}));
    if(!r.ok||p?.ok===false)throw new Error(p?.error||"INSIGHT_API_ERROR");
    return p;
  }finally{window.clearTimeout(timer)}
}
const fmt=(v:any)=>new Intl.NumberFormat("ja-JP").format(Number(v||0));

export function MemberInsightLiveV2(){
  const[revision,setRevision]=useState(0),[status,setStatus]=useState("公開データは自動更新中"),[manualBusy,setManualBusy]=useState(false),[mode,setMode]=useState<Mode>("normal"),[official,setOfficial]=useState<any>(null);
  const running=useRef(false),relationRunning=useRef(false),lastInteraction=useRef(Date.now()),lastRun=useRef(0),lastRelationRun=useRef(0);
  async function loadOfficial(){try{setOfficial(await post(MEMBER,"dashboard",{},45_000))}catch{/* 個別パネルは利用可能 */}}
  async function relationSync(force=false){
    const now=Date.now();if(relationRunning.current||(!force&&now-lastRelationRun.current<RELATION_MS))return false;
    relationRunning.current=true;lastRelationRun.current=now;
    try{await post(RELATIONS,"sync",{},120_000);setRevision(v=>v+1);return true}catch{return false}finally{relationRunning.current=false}
  }
  async function publicSync(force=false){
    if(running.current)return false;
    const now=Date.now();
    if(!force&&(document.visibilityState!=="visible"||now-lastInteraction.current<QUIET_MS||now-lastRun.current<AUTO_MS))return false;
    running.current=true;lastRun.current=now;
    try{
      const p=await post(MEMBER,"sync",{},75_000);
      setStatus(`自動更新済み・記事確認${fmt(p.scannedArticles||0)}件 / 保存記事${fmt(p.catalog?.stored||p.catalog?.official||0)}件`);
      setRevision(v=>v+1);void loadOfficial();void relationSync(force);return true;
    }catch(e){setStatus(`自動更新は次回再試行：${e instanceof Error?e.message:"一時エラー"}`);return false}
    finally{running.current=false}
  }
  async function manualRefresh(){
    if(manualBusy)return;
    setManualBusy(true);setStatus("公開履歴を更新中…");
    try{
      await publicSync(true);
      setStatus("フォロー・フォロワーを照合中…");
      const ok=await relationSync(true);if(!ok)setStatus("フォロー照合は次回も自動継続します");
      setRevision(v=>v+1);await loadOfficial();
      setStatus("最新版アプリを確認中…");
      if("serviceWorker" in navigator){const regs=await navigator.serviceWorker.getRegistrations();await Promise.all(regs.filter(r=>r.scope.includes("/note-insight/")).map(r=>r.update().catch(()=>undefined)))}
      await fetch(`./?app-check=${Date.now()}`,{cache:"no-store"}).catch(()=>undefined);
      setStatus("データ・アプリ最新版を更新しました");
    }catch(e){setStatus(e instanceof Error?`更新エラー：${e.message}`:"更新エラー")}
    finally{setManualBusy(false)}
  }
  useEffect(()=>{
    void loadOfficial();
    const touch=()=>{lastInteraction.current=Date.now()};
    window.addEventListener("pointerdown",touch,{passive:true});window.addEventListener("touchstart",touch,{passive:true});window.addEventListener("wheel",touch,{passive:true});window.addEventListener("scroll",touch,{passive:true});
    const first=window.setTimeout(()=>void publicSync(true),3000),timer=window.setInterval(()=>void publicSync(false),15_000),relationTimer=window.setInterval(()=>{if(document.visibilityState==="visible")void relationSync(false)},60_000),visible=()=>{if(document.visibilityState==="visible")window.setTimeout(()=>void publicSync(false),QUIET_MS)};
    document.addEventListener("visibilitychange",visible);
    return()=>{window.clearTimeout(first);window.clearInterval(timer);window.clearInterval(relationTimer);window.removeEventListener("pointerdown",touch);window.removeEventListener("touchstart",touch);window.removeEventListener("wheel",touch);window.removeEventListener("scroll",touch);document.removeEventListener("visibilitychange",visible)};
  },[]);
  function capture(e:React.MouseEvent){
    const t=e.target as HTMLElement;if(!t.closest(".miu-nav"))return;
    const label=t.closest("button")?.textContent?.trim()||"";
    if(label==="コメント")setMode("comments");
    else if(label==="お気に入り")setMode("favorites");
    else if(label==="フォロー")setMode("social");
    else if(label==="通知")setMode("notifications");
    else setMode("normal");
  }
  return <div className={`miv5 mode-${mode}`} onClickCapture={capture}>
    <section className="miv5-update"><div><b>AUTO SYNC</b><span>{status}</span><small>総数はnote公式値。公開APIで人物まで確認できる範囲は別表示します。</small></div><div><button className={mode==="analysis"?"active":""} onClick={()=>setMode(v=>v==="analysis"?"normal":"analysis")}>{mode==="analysis"?"✓ 分析表示中":"📊 分析"}</button><button className="primary" disabled={manualBusy} onClick={()=>void manualRefresh()}>{manualBusy?"更新中…":"データ＋最新版 更新"}</button></div></section>
    <MemberInsightCompleteness revision={revision}/>
    <MemberInsightUnifiedV4 revision={revision}/>
    {mode==="comments"?<div className="miv5-final-slot"><MemberInsightCommentsFinal revision={revision}/></div>:null}
    {mode==="favorites"?<div className="miv5-final-slot"><MemberInsightFavoritesFinal revision={revision}/></div>:null}
    {mode==="social"?<div className="miv5-final-slot"><MemberInsightSocialV2 revision={revision}/></div>:null}
    {mode==="notifications"?<div className="miv5-final-slot"><MemberInsightNotificationsFinal revision={revision} noteId={String(official?.member?.noteId||"")}/></div>:null}
    {mode==="analysis"?<div className="miv5-final-slot"><MemberInsightAnalyticsFinal revision={revision} onBack={()=>setMode("normal")}/></div>:null}
  </div>;
}
