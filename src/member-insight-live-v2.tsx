import { useEffect, useRef, useState } from "react";
import { INSIGHT_TOKEN_KEY } from "./insight-account-store";
import {
  CURRENT_INSIGHT_APP_VERSION,
  NOTIFICATION_VERSION_STORAGE_KEY,
  DASHBOARD_VERSION_STORAGE_KEY,
  fetchInsightRelease,
  type InsightRelease,
  versionDiffers,
} from "./insight-release";
import { MemberInsightUnifiedV4 } from "./member-insight-unified-v4";
import { MemberInsightSocialV2 } from "./member-insight-social-v2";
import { MemberInsightNotificationsFinal } from "./member-insight-notifications-final";
import { MemberInsightAnalysisHub } from "./member-insight-analysis-hub";
import { MemberInsightCommentsFinal } from "./member-insight-comments-final";
import { MemberInsightFavoritesFinal } from "./member-insight-favorites-final";
import { MemberInsightCompleteness } from "./member-insight-completeness";
import "./member-insight-hotfix.css";
import "./member-insight-live-v2.css";
import "./insight-ux-v12";

const MEMBER="https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-member-api";
const RELATIONS="https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-relations";
const AUTO_MS=120_000;
const RELATION_MS=180_000;
const QUIET_MS=2_500;
const ENTRY_MODE_KEY="mumei-insight-entry-mode";
const APP_UPDATE_RESULT_KEY="mumei-insight-app-update-result";
type Mode="normal"|"comments"|"favorites"|"social"|"notifications"|"analysis";
const MODES=new Set<Mode>(["normal","comments","favorites","social","notifications","analysis"]);
function requestedMode(){const q=new URLSearchParams(window.location.search).get("insightMode");if(q&&MODES.has(q as Mode))return q as Mode;const stored=sessionStorage.getItem(ENTRY_MODE_KEY);return stored&&MODES.has(stored as Mode)?stored as Mode:null}

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
const timeNow=()=>new Intl.DateTimeFormat("ja-JP",{timeZone:"Asia/Tokyo",hour:"2-digit",minute:"2-digit"}).format(new Date());

export function MemberInsightLiveV2(){
  const initialMode=requestedMode()||(MODES.has(history.state?.insightMode)?history.state.insightMode as Mode:"normal");
  const[revision,setRevision]=useState(0),[status,setStatus]=useState("公開データは自動更新中"),[appBusy,setAppBusy]=useState(false),[dataBusy,setDataBusy]=useState(false),[mode,setMode]=useState<Mode>(initialMode),[official,setOfficial]=useState<any>(null);
  const[release,setRelease]=useState<InsightRelease|null>(null),[releaseChecked,setReleaseChecked]=useState(false),[notificationInstalled,setNotificationInstalled]=useState(()=>localStorage.getItem(NOTIFICATION_VERSION_STORAGE_KEY)||""),[dashboardInstalled,setDashboardInstalled]=useState(()=>localStorage.getItem(DASHBOARD_VERSION_STORAGE_KEY)||"");
  const[appFeedback,setAppFeedback]=useState(()=>{const expected=sessionStorage.getItem(APP_UPDATE_RESULT_KEY)||"";if(expected&&expected===CURRENT_INSIGHT_APP_VERSION){sessionStorage.removeItem(APP_UPDATE_RESULT_KEY);return`✅ INSIGHT本体 v${CURRENT_INSIGHT_APP_VERSION} 更新完了・最新版`;}return""});
  const running=useRef(false),manualRefreshRunning=useRef(false),relationRunning=useRef(false),lastInteraction=useRef(Date.now()),lastRun=useRef(0),lastRelationRun=useRef(0),appFeedbackTimer=useRef(0);
  function showAppFeedback(text:string,ms=5000){setAppFeedback(text);if(appFeedbackTimer.current)window.clearTimeout(appFeedbackTimer.current);appFeedbackTimer.current=ms>0?window.setTimeout(()=>setAppFeedback(""),ms):0}
  function openMode(next:Mode){
    if(mode===next){requestAnimationFrame(()=>document.querySelector<HTMLElement>(next==="analysis"?".miah,.mia2,.miaf":next==="notifications"?"#minf-notifications":".miu")?.scrollIntoView({block:"start",behavior:"auto"}));return}
    const y=window.scrollY;
    window.history.pushState({...window.history.state,route:"dashboard",insightMode:next,insightScrollY:y},"",window.location.href);
    setMode(next);
    if(next!=="notifications")requestAnimationFrame(()=>window.scrollTo({top:y,behavior:"auto"}));
  }
  function backMode(){if(mode!=="normal"){window.history.back();return}window.history.back()}
  async function loadOfficial(){try{setOfficial(await post(MEMBER,"dashboard",{},45_000))}catch{/* 個別パネルは利用可能 */}}
  async function checkRelease(){
    try{
      const next=await fetchInsightRelease();
      setRelease(next);
      setNotificationInstalled(localStorage.getItem(NOTIFICATION_VERSION_STORAGE_KEY)||"");
      setDashboardInstalled(localStorage.getItem(DASHBOARD_VERSION_STORAGE_KEY)||"");
      setReleaseChecked(true);
      return next;
    }catch{
      setReleaseChecked(true);
      return null;
    }
  }
  async function relationSync(force=false){
    const now=Date.now();if(relationRunning.current||(!force&&now-lastRelationRun.current<RELATION_MS))return false;
    relationRunning.current=true;lastRelationRun.current=now;
    try{
      const results=await Promise.allSettled([
        post(RELATIONS,"sync",{direction:"followers"},120_000),
        post(RELATIONS,"sync",{direction:"followings"},120_000),
      ]);
      const ok=results.some(x=>x.status==="fulfilled");
      if(ok)setRevision(v=>v+1);
      return ok;
    }catch{return false}finally{relationRunning.current=false}
  }
  async function publicSync(force=false){
    if(running.current)return false;
    const now=Date.now();
    if(!force&&(document.visibilityState!=="visible"||now-lastInteraction.current<QUIET_MS||now-lastRun.current<AUTO_MS))return false;
    running.current=true;lastRun.current=now;
    try{
      const p=await post(MEMBER,"sync",{},75_000);
      setStatus(`更新済み ${timeNow()}・記事確認${fmt(p.scannedArticles||0)}件 / 保存${fmt(p.catalog?.stored||p.catalog?.official||0)}件`);
      setRevision(v=>v+1);void loadOfficial();void relationSync(force);return true;
    }catch(e){setStatus(`次回再試行：${e instanceof Error?e.message:"一時エラー"}`);return false}
    finally{running.current=false}
  }
  async function waitForPublicSyncIdle(timeout=80_000){
    const started=Date.now();
    while(running.current&&Date.now()-started<timeout)await new Promise<void>(resolve=>window.setTimeout(resolve,200));
    return !running.current;
  }
  async function manualDataRefresh(){
    if(manualRefreshRunning.current){setStatus("連携データを更新中…");return}
    manualRefreshRunning.current=true;setDataBusy(true);setStatus(running.current?"自動更新完了後に連携データを更新します…":"連携データを更新中…");
    try{
      const idle=await waitForPublicSyncIdle();
      if(!idle){setStatus("自動更新が長引いています。もう一度更新してください。");return}
      const ok=await publicSync(true);
      if(!ok)setStatus("連携データを更新できませんでした。もう一度お試しください。");
    }finally{manualRefreshRunning.current=false;setDataBusy(false)}
  }
  async function updateInsightApp(){
    if(appBusy)return;
    setAppBusy(true);
    const started=Date.now();
    try{
      setStatus("INSIGHT本体の最新版を確認中…");
      showAppFeedback("INSIGHT本体の最新版を確認中…",0);
      const latest=await checkRelease();
      const latestVersion=latest?.appVersion||CURRENT_INSIGHT_APP_VERSION;
      if(!versionDiffers(CURRENT_INSIGHT_APP_VERSION,latestVersion)){
        const wait=Math.max(0,650-(Date.now()-started));if(wait)await new Promise<void>(resolve=>window.setTimeout(resolve,wait));
        setStatus(`INSIGHT本体 v${CURRENT_INSIGHT_APP_VERSION} は最新版です。`);
        showAppFeedback(`✅ INSIGHT本体 v${CURRENT_INSIGHT_APP_VERSION}｜最新版です`,5000);
        return;
      }
      setStatus(`INSIGHT本体 v${latestVersion} を取得中…`);
      showAppFeedback(`INSIGHT本体 v${latestVersion} を読み込み中…`,0);
      if("serviceWorker" in navigator){
        const regs=await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.filter(r=>r.scope.includes("/note-insight/")).map(r=>r.update().catch(()=>undefined)));
      }
      await fetch(`${import.meta.env.BASE_URL}index.html?insight-app-update=${Date.now()}`,{cache:"no-store"}).catch(()=>undefined);
      sessionStorage.setItem(APP_UPDATE_RESULT_KEY,latestVersion);
      window.location.reload();
    }catch(e){
      const text=e instanceof Error?`INSIGHT本体更新エラー：${e.message}`:"INSIGHT本体更新エラー";
      setStatus(text);showAppFeedback(`⚠ ${text}`,7000);
    }finally{setAppBusy(false)}
  }
  useEffect(()=>{
    const requested=requestedMode();
    if(requested){sessionStorage.removeItem(ENTRY_MODE_KEY);const u=new URL(window.location.href);u.searchParams.delete("insightMode");window.history.replaceState({...window.history.state,route:"dashboard",insightMode:requested,insightScrollY:0},"",u.href);setMode(requested)}
    else if(!MODES.has(history.state?.insightMode))window.history.replaceState({...window.history.state,route:"dashboard",insightMode:"normal",insightScrollY:window.scrollY},"",window.location.href);
    const pop=()=>{const next=history.state?.insightMode;const y=Number(history.state?.insightScrollY);setMode(MODES.has(next)?next:"normal");if(Number.isFinite(y))requestAnimationFrame(()=>window.scrollTo({top:y,behavior:"auto"}))};
    window.addEventListener("popstate",pop);return()=>window.removeEventListener("popstate",pop)
  },[]);
  useEffect(()=>{
    const handler=(event:Event)=>{const next=(event as CustomEvent).detail;if(typeof next==="string"&&MODES.has(next as Mode))openMode(next as Mode)};
    window.addEventListener("mumei-insight-open-mode",handler as EventListener);return()=>window.removeEventListener("mumei-insight-open-mode",handler as EventListener)
  },[mode]);
  useEffect(()=>{
    if(mode!=="notifications")return;let stopped=false,tries=0;const jump=()=>{if(stopped)return;const el=document.getElementById("minf-notifications");if(el){el.scrollIntoView({block:"start",behavior:"auto"});return}if(tries++<12)window.setTimeout(jump,70)};requestAnimationFrame(jump);return()=>{stopped=true}
  },[mode]);
  useEffect(()=>{
    void loadOfficial();const touch=()=>{lastInteraction.current=Date.now()};
    window.addEventListener("pointerdown",touch,{passive:true});window.addEventListener("touchstart",touch,{passive:true});window.addEventListener("wheel",touch,{passive:true});window.addEventListener("scroll",touch,{passive:true});
    const relationFirst=window.setTimeout(()=>void relationSync(true),900),first=window.setTimeout(()=>void publicSync(true),3000),timer=window.setInterval(()=>void publicSync(false),15_000),relationTimer=window.setInterval(()=>{if(document.visibilityState==="visible")void relationSync(false)},60_000),visible=()=>{if(document.visibilityState==="visible")window.setTimeout(()=>{void publicSync(false);void relationSync(false)},QUIET_MS)};
    document.addEventListener("visibilitychange",visible);
    return()=>{window.clearTimeout(relationFirst);window.clearTimeout(first);window.clearInterval(timer);window.clearInterval(relationTimer);window.removeEventListener("pointerdown",touch);window.removeEventListener("touchstart",touch);window.removeEventListener("wheel",touch);window.removeEventListener("scroll",touch);document.removeEventListener("visibilitychange",visible)}
  },[]);
  useEffect(()=>{if(mode==="social")void relationSync(true)},[mode]);
  useEffect(()=>{
    void checkRelease();const timer=window.setInterval(()=>{if(document.visibilityState==="visible")void checkRelease()},60_000);const refresh=()=>{if(document.visibilityState==="visible")void checkRelease()};
    window.addEventListener("focus",refresh);window.addEventListener("pageshow",refresh);document.addEventListener("visibilitychange",refresh);
    return()=>{window.clearInterval(timer);window.removeEventListener("focus",refresh);window.removeEventListener("pageshow",refresh);document.removeEventListener("visibilitychange",refresh);if(appFeedbackTimer.current)window.clearTimeout(appFeedbackTimer.current)}
  },[]);
  function capture(e:React.MouseEvent){
    const t=e.target as HTMLElement;if(!t.closest(".miu-nav"))return;const label=t.closest("button")?.textContent?.trim()||"";
    if(label==="コメント")openMode("comments");else if(label==="お気に入り")openMode("favorites");else if(label==="フォロー")openMode("social");else if(label==="通知")openMode("notifications");else if(mode!=="normal")openMode("normal")
  }
  const appLatest=release?.appVersion||"";
  const appUpdateAvailable=Boolean(appLatest&&versionDiffers(CURRENT_INSIGHT_APP_VERSION,appLatest));
  const notificationLatest=release?.notificationVersion||"";
  const notificationUpdateAvailable=Boolean(notificationLatest&&notificationInstalled!==notificationLatest);
  const dashboardLatest=release?.dashboardVersion||"";
  const dashboardUpdateAvailable=Boolean(dashboardLatest&&dashboardInstalled!==dashboardLatest);
  const noteId=String(official?.member?.noteId||"").toLowerCase();
  return <div className={`miv5 mode-${mode}`} onClickCapture={capture}>
    <section className="miv5-update" aria-label="INSIGHT主要機能">
      <div className="miv5-source-grid">
        <div className={`miv5-source-card normal ${appUpdateAvailable?"needs-update":""}`}>
          <button className="miv5-source-main" aria-busy={dataBusy} aria-label="連携データを更新" onClick={()=>void manualDataRefresh()}><strong>{dataBusy?"↻ 更新中…":"✓ 通常データ"}</strong><small>本体 v{CURRENT_INSIGHT_APP_VERSION}{appUpdateAvailable&&appLatest?` → v${appLatest}`:""}</small><span>{dataBusy?"連携データを更新しています":status}</span>{appUpdateAvailable?<em>NEW</em>:null}</button>
          {appUpdateAvailable?<button className="miv5-install-link update-ready" disabled={appBusy} onClick={()=>void updateInsightApp()}>{appBusy?"確認中…":"本体を更新"}</button>:null}
        </div>
        <div className={`miv5-source-card notice ${notificationUpdateAvailable?"needs-update":""}`}>
          <button className="miv5-source-main" onClick={()=>openMode("notifications")}><strong>🔔 本人通知</strong><small>{notificationInstalled?`この端末 v${notificationInstalled}`:"未導入・必要な時だけ追加"}{notificationUpdateAvailable&&notificationLatest?` → v${notificationLatest}`:""}</small><span>通知履歴・追加分析</span>{notificationUpdateAvailable?<em>更新あり</em>:null}</button>
        </div>
        <div className={`miv5-source-card dashboard ${dashboardUpdateAvailable?"needs-update":""}`}>
          <button className="miv5-source-main" onClick={()=>openMode("analysis")}><strong>📊 分析</strong><small>{dashboardInstalled?`Dashboard同期 v${dashboardInstalled}`:"本人通知なしで分析可"}{dashboardUpdateAvailable&&dashboardLatest?` → v${dashboardLatest}`:""}</small><span>公式Dashboard＋INSIGHT</span>{dashboardUpdateAvailable?<em>更新あり</em>:null}</button>
        </div>
      </div>
    </section>
    {appFeedback?<section className={`miv5-app-feedback ${appFeedback.startsWith("⚠")?"error":""}`} role="status">{appFeedback}</section>:null}
    <MemberInsightCompleteness revision={revision}/>
    <MemberInsightUnifiedV4 revision={revision}/>
    {mode==="comments"?<div className="miv5-final-slot"><MemberInsightCommentsFinal revision={revision}/></div>:null}
    {mode==="favorites"?<div className="miv5-final-slot"><MemberInsightFavoritesFinal revision={revision}/></div>:null}
    {mode==="social"?<div className="miv5-final-slot"><MemberInsightSocialV2 revision={revision}/></div>:null}
    {mode==="notifications"?<div className="miv5-final-slot"><MemberInsightNotificationsFinal revision={revision} noteId={String(official?.member?.noteId||"")}/></div>:null}
    {mode==="analysis"?<div className="miv5-final-slot"><MemberInsightAnalysisHub revision={revision} onBack={backMode} noteId={noteId} dashboardInstalled={dashboardInstalled} notificationInstalled={notificationInstalled} dashboardLatest={dashboardLatest} notificationLatest={notificationLatest}/></div>:null}
  </div>;
}
