import { useEffect, useRef, useState } from "react";
import { INSIGHT_TOKEN_KEY } from "./insight-account-store";
import {
  CURRENT_INSIGHT_APP_VERSION,
  CURRENT_DASHBOARD_VERSION,
  CURRENT_NOTIFICATION_VERSION,
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
import "./insight-cinematic-shell-v1.css";
import "./insight-cinematic-shell-v2.css";
import "./insight-live-scan-theater.css";
import "./insight-visual-overhaul-v3.css";
import "./insight-ux-v12";

const MEMBER="https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-member-api";
const RELATIONS="https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-relations";
const AUTO_MS=15*60_000;
const RELATION_MS=30*60_000;
const QUIET_MS=5_000;
const PUBLIC_SYNC_TIMEOUT=60_000;
const MANUAL_UI_TIMEOUT=32_000;
const ENTRY_MODE_KEY="mumei-insight-entry-mode";
const APP_UPDATE_RESULT_KEY="mumei-insight-app-update-result";
const AUTO_SYNC_KEY="mumei-insight-last-auto-public-sync";
const AUTO_SYNC_ENABLED_KEY="mumei-insight-auto-sync-enabled";
const RELATION_SYNC_KEY="mumei-insight-last-auto-relation-sync";
type Mode="normal"|"comments"|"favorites"|"social"|"notifications"|"analysis";
const MODES=new Set<Mode>(["normal","comments","favorites","social","notifications","analysis"]);
function requestedMode(){const q=new URLSearchParams(window.location.search).get("insightMode");if(q&&MODES.has(q as Mode))return q as Mode;const stored=sessionStorage.getItem(ENTRY_MODE_KEY);return stored&&MODES.has(stored as Mode)?stored as Mode:null}

async function post(endpoint:string,action:string,extra:Record<string,unknown>={},timeout=45_000,externalSignal?:AbortSignal){
  const token=localStorage.getItem(INSIGHT_TOKEN_KEY)||"";
  if(!token)throw new Error("INSIGHT_LOGIN_REQUIRED");
  const c=new AbortController(),timer=window.setTimeout(()=>c.abort(),timeout),forwardAbort=()=>c.abort();
  if(externalSignal){if(externalSignal.aborted)c.abort();else externalSignal.addEventListener("abort",forwardAbort,{once:true})}
  try{
    const r=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json","X-Insight-Token":token},body:JSON.stringify({action,...extra}),cache:"no-store",signal:c.signal});
    const p=await r.json().catch(()=>({}));
    if(localStorage.getItem(INSIGHT_TOKEN_KEY)!==token)throw new Error("INSIGHT_ACCOUNT_CHANGED");
    if(r.status===402)throw new Error("INSIGHT保存先が一時停止中です（HTTP 402）");
    if(!r.ok||p?.ok===false)throw new Error(p?.error||"INSIGHT_API_ERROR");
    return p;
  }finally{
    window.clearTimeout(timer);
    externalSignal?.removeEventListener("abort",forwardAbort);
  }
}
const fmt=(v:any)=>new Intl.NumberFormat("ja-JP").format(Number(v||0));
const timeNow=()=>new Intl.DateTimeFormat("ja-JP",{timeZone:"Asia/Tokyo",hour:"2-digit",minute:"2-digit"}).format(new Date());
const sleep=(ms:number)=>new Promise<void>(resolve=>window.setTimeout(resolve,ms));

export function MemberInsightLiveV2(){
  const initialMode=requestedMode()||(MODES.has(history.state?.insightMode)?history.state.insightMode as Mode:"normal");
  const[revision,setRevision]=useState(0),[status,setStatus]=useState("保存済み公開データを表示中・自動更新待機"),[appBusy,setAppBusy]=useState(false),[dataBusy,setDataBusy]=useState(false),[mode,setMode]=useState<Mode>(initialMode),[official,setOfficial]=useState<any>(null),[autoSyncEnabled,setAutoSyncEnabled]=useState(()=>localStorage.getItem(AUTO_SYNC_ENABLED_KEY)!=="0");
  const[release,setRelease]=useState<InsightRelease|null>(null),[releaseChecked,setReleaseChecked]=useState(false),[releaseError,setReleaseError]=useState(false),[notificationInstalled,setNotificationInstalled]=useState(()=>localStorage.getItem(NOTIFICATION_VERSION_STORAGE_KEY)||""),[dashboardInstalled,setDashboardInstalled]=useState(()=>localStorage.getItem(DASHBOARD_VERSION_STORAGE_KEY)||"");
  const releaseRequest=useRef(0);
  const[appFeedback,setAppFeedback]=useState(()=>{const expected=sessionStorage.getItem(APP_UPDATE_RESULT_KEY)||"";if(expected&&!versionDiffers(CURRENT_INSIGHT_APP_VERSION,expected)){sessionStorage.removeItem(APP_UPDATE_RESULT_KEY);return`✅ INSIGHT本体 v${CURRENT_INSIGHT_APP_VERSION} 更新完了・最新版`;}if(expected)return`⚠ 更新を完了できていません。現在 v${CURRENT_INSIGHT_APP_VERSION}／更新先 v${expected}。通信を確認して本体更新を再試行してください。`;return""});
  const running=useRef(false),manualRefreshRunning=useRef(false),relationRunning=useRef(false),lastInteraction=useRef(Date.now()),lastRun=useRef(Number(localStorage.getItem(AUTO_SYNC_KEY)||0)),lastRelationRun=useRef(Number(localStorage.getItem(RELATION_SYNC_KEY)||0)),appFeedbackTimer=useRef(0),publicSyncController=useRef<AbortController|null>(null),publicSyncRun=useRef(0),notificationEntryY=useRef<number|null>(null),autoSyncEnabledRef=useRef(autoSyncEnabled);
  function showAppFeedback(text:string,ms=5000){setAppFeedback(text);if(appFeedbackTimer.current)window.clearTimeout(appFeedbackTimer.current);appFeedbackTimer.current=ms>0?window.setTimeout(()=>setAppFeedback(""),ms):0}
  useEffect(()=>{autoSyncEnabledRef.current=autoSyncEnabled;try{localStorage.setItem(AUTO_SYNC_ENABLED_KEY,autoSyncEnabled?"1":"0")}catch{}},[autoSyncEnabled]);
  function openMode(next:Mode){
    if(mode===next){
      if(next!=="notifications")requestAnimationFrame(()=>document.querySelector<HTMLElement>(next==="analysis"?".miah,.mia2,.miaf":".miu")?.scrollIntoView({block:"start",behavior:"auto"}));
      return;
    }
    const y=window.scrollY;
    if(next==="notifications")notificationEntryY.current=y;
    window.history.replaceState({...window.history.state,insightScrollY:y},"",window.location.href);
    window.history.pushState({...window.history.state,route:"dashboard",insightMode:next,insightTab:["comments","favorites","social","notifications"].includes(next)?next:window.history.state?.insightTab||"likes",insightScrollY:y},"",window.location.href);
    setMode(next);window.dispatchEvent(new Event("mumei-insight-navigation"));
    if(next!=="notifications")requestAnimationFrame(()=>window.scrollTo({top:y,behavior:"auto"}));
  }
  function backMode(){if(mode!=="normal"){window.history.back();return}window.history.back()}
  function handleUnifiedTab(tab:string){
    const next:Mode=tab==="comments"?"comments":tab==="favorites"?"favorites":tab==="social"?"social":tab==="notifications"?"notifications":"normal";
    const current=window.history.state||{};
    if(mode===next&&current.insightTab===tab)return;
    window.history.replaceState({...current,insightScrollY:window.scrollY},"",window.location.href);
    window.history.pushState({...current,route:"dashboard",insightMode:next,insightTab:tab,insightScrollY:window.scrollY},"",window.location.href);
    setMode(next);
  }
  async function loadOfficial(){try{setOfficial(await post(MEMBER,"dashboard",{},45_000))}catch{/* 個別パネルは利用可能 */}}
  async function checkRelease(){
    const request=++releaseRequest.current;
    setNotificationInstalled(localStorage.getItem(NOTIFICATION_VERSION_STORAGE_KEY)||"");
    setDashboardInstalled(localStorage.getItem(DASHBOARD_VERSION_STORAGE_KEY)||"");
    try{
      const next=await fetchInsightRelease();
      if(request!==releaseRequest.current)return null;
      setRelease(next);
      setReleaseError(false);
      setReleaseChecked(true);
      return next;
    }catch{
      if(request!==releaseRequest.current)return null;
      setReleaseError(true);
      setReleaseChecked(true);
      return null;
    }
  }
  async function relationSync(force=false){
    const now=Date.now();if(relationRunning.current||(!force&&now-lastRelationRun.current<RELATION_MS))return false;
    relationRunning.current=true;lastRelationRun.current=now;try{localStorage.setItem(RELATION_SYNC_KEY,String(now))}catch{}
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
    const now=Date.now();
    if(running.current&&!force)return false;
    if(!force&&!autoSyncEnabledRef.current)return false;
    if(!force&&(document.visibilityState!=="visible"||now-lastInteraction.current<QUIET_MS||now-lastRun.current<AUTO_MS))return false;
    if(force&&running.current)publicSyncController.current?.abort();
    const run=++publicSyncRun.current,controller=new AbortController();
    publicSyncController.current=controller;running.current=true;lastRun.current=now;try{localStorage.setItem(AUTO_SYNC_KEY,String(now))}catch{}
    setStatus(force?"公開データを更新中…（保存済みデータは表示中）":"公開データを確認中…（保存済みデータは表示中）");
    try{
      const p=await post(MEMBER,"sync",{},PUBLIC_SYNC_TIMEOUT,controller.signal);
      if(run!==publicSyncRun.current)return false;
      setStatus(`更新済み ${timeNow()}・記事確認${fmt(p.scannedArticles||0)}件 / 保存${fmt(p.catalog?.stored||p.catalog?.official||0)}件`);
      setRevision(v=>v+1);void loadOfficial();void relationSync(force);return true;
    }catch(e){
      if(run!==publicSyncRun.current)return false;
      const message=controller.signal.aborted?"更新を切り替えました":e instanceof Error?e.message:"一時エラー";
      setStatus(`保存済みデータを表示中・次回再試行：${message}`);return false;
    }finally{
      if(run===publicSyncRun.current){running.current=false;if(publicSyncController.current===controller)publicSyncController.current=null}
    }
  }
  async function waitForPublicSyncIdle(timeout=0){
    if(!running.current)return true;
    if(timeout<=0)return false;
    const started=Date.now();
    while(running.current&&Date.now()-started<timeout)await sleep(100);
    return !running.current;
  }
  // 旧挙動「自動更新完了後に連携データを更新します」は廃止。手動更新は待機せず古い実行を中断して再試行する。
  async function manualDataRefresh(){
    if(manualRefreshRunning.current){setStatus("更新処理は進行中です。保存済みデータはそのまま操作できます。");return}
    manualRefreshRunning.current=true;setDataBusy(true);
    try{
      const result=await Promise.race([
        publicSync(true).then(ok=>({settled:true,ok})),
        sleep(MANUAL_UI_TIMEOUT).then(()=>({settled:false,ok:false})),
      ]);
      if(!result.settled)setStatus("更新はバックグラウンドで継続中です。ボタンは再操作できます。");
      else if(!result.ok)setStatus("保存済みデータを表示中です。更新できなかった場合はもう一度押してください。");
    }finally{manualRefreshRunning.current=false;setDataBusy(false)}
  }
  async function refreshSavedData(showBusy=false){
    if(manualRefreshRunning.current)return;
    manualRefreshRunning.current=true;
    if(showBusy)setDataBusy(true);
    try{
      await loadOfficial();
      setRevision(v=>v+1);
      if(showBusy)setStatus(`保存済み最新データを反映 ${timeNow()}`);
    }finally{
      manualRefreshRunning.current=false;
      if(showBusy)setDataBusy(false);
    }
  }
  async function updateInsightApp(){
    if(appBusy)return;
    setAppBusy(true);
    const started=Date.now();
    try{
      showAppFeedback("INSIGHT本体の最新版を確認中…",0);
      const latest=await checkRelease();
      if(!latest)throw new Error("最新版を確認できませんでした。通信状態を確認して再試行してください。");
      const latestVersion=latest.appVersion;
      if(!versionDiffers(CURRENT_INSIGHT_APP_VERSION,latestVersion)){
        const wait=Math.max(0,650-(Date.now()-started));if(wait)await sleep(wait);
        showAppFeedback(`✅ INSIGHT本体 v${CURRENT_INSIGHT_APP_VERSION}｜最新版です`,5000);
        return;
      }
      showAppFeedback(`INSIGHT本体 v${latestVersion} を読み込み中…`,0);
      if("serviceWorker" in navigator){
        const regs=await navigator.serviceWorker.getRegistrations();
        await Promise.race([Promise.all(regs.filter(r=>r.scope===new URL(import.meta.env.BASE_URL,window.location.origin).href).map(r=>r.update().catch(()=>undefined))),sleep(6000)]);
      }
      const controller=new AbortController(),timer=window.setTimeout(()=>controller.abort(),12000);
      try{const fresh=await fetch(`${import.meta.env.BASE_URL}index.html?insight-app-update=${Date.now()}`,{cache:"no-store",signal:controller.signal});if(!fresh.ok)throw new Error("新しい画面を取得できませんでした。再試行してください。")}finally{window.clearTimeout(timer)}
      sessionStorage.setItem(APP_UPDATE_RESULT_KEY,latestVersion);
      const target=new URL(window.location.href);
      target.searchParams.set("insightAppVersion",latestVersion);
      window.location.replace(target.href);
    }catch(e){
      const text=e instanceof Error?`INSIGHT本体更新エラー：${e.message}`:"INSIGHT本体更新エラー";
      showAppFeedback(`⚠ ${text}`,7000);
    }finally{setAppBusy(false)}
  }
  useEffect(()=>{
    const requested=requestedMode();
    if(requested){sessionStorage.removeItem(ENTRY_MODE_KEY);const u=new URL(window.location.href);u.searchParams.delete("insightMode");window.history.replaceState({...window.history.state,route:"dashboard",insightMode:requested,insightTab:["comments","favorites","social","notifications"].includes(requested)?requested:window.history.state?.insightTab||"likes",insightScrollY:0},"",u.href);setMode(requested);window.dispatchEvent(new Event("mumei-insight-navigation"))}
    else if(!MODES.has(history.state?.insightMode))window.history.replaceState({...window.history.state,route:"dashboard",insightMode:"normal",insightScrollY:window.scrollY},"",window.location.href);
    const pop=()=>{const next=history.state?.insightMode;const y=Number(history.state?.insightScrollY);setMode(MODES.has(next)?next:"normal");if(Number.isFinite(y))requestAnimationFrame(()=>requestAnimationFrame(()=>window.scrollTo({top:y,behavior:"auto"})))};
    window.addEventListener("popstate",pop);return()=>window.removeEventListener("popstate",pop)
  },[]);
  useEffect(()=>{
    const handler=(event:Event)=>{const next=(event as CustomEvent).detail;if(typeof next==="string"&&MODES.has(next as Mode))openMode(next as Mode)};
    window.addEventListener("mumei-insight-open-mode",handler as EventListener);return()=>window.removeEventListener("mumei-insight-open-mode",handler as EventListener)
  },[mode]);
  useEffect(()=>{
    const root=()=>{
      window.history.replaceState({...window.history.state,route:"dashboard",insightMode:"normal",insightTab:"likes",insightScrollY:0},"",window.location.href);
      setMode("normal");
      window.dispatchEvent(new Event("mumei-insight-navigation"));
      requestAnimationFrame(()=>requestAnimationFrame(()=>document.querySelector<HTMLElement>(".miu")?.scrollIntoView({block:"start",behavior:"auto"})));
    };
    window.addEventListener("mumei-insight-root",root);
    return()=>window.removeEventListener("mumei-insight-root",root);
  },[]);
  useEffect(()=>{
    if(mode!=="notifications")return;
    let stopped=false,tries=0,timer=0,lastTop:number|null=null,stableFrames=0;
    const previousOverflow=document.documentElement.style.overflowY;
    document.documentElement.style.overflowY="hidden";
    const finish=(el:HTMLElement)=>{
      if(stopped)return;
      document.documentElement.style.overflowY=previousOverflow;
      const top=Math.max(0,window.scrollY+el.getBoundingClientRect().top-72);
      window.scrollTo({top,behavior:"auto"});
    };
    const waitForPanel=()=>{
      if(stopped)return;
      const el=document.getElementById("minf-notifications");
      if(el&&el.offsetHeight>80){
        const top=Math.round(el.getBoundingClientRect().top);
        stableFrames=lastTop===top?stableFrames+1:0;
        lastTop=top;
        if(stableFrames>=1){finish(el);return}
      }
      if(tries++<20)timer=window.setTimeout(()=>requestAnimationFrame(waitForPanel),80);
      else{
        document.documentElement.style.overflowY=previousOverflow;
        if(notificationEntryY.current!==null)window.scrollTo({top:notificationEntryY.current,behavior:"auto"});
      }
    };
    requestAnimationFrame(()=>requestAnimationFrame(waitForPanel));
    return()=>{stopped=true;if(timer)window.clearTimeout(timer);document.documentElement.style.overflowY=previousOverflow}
  },[mode]);
  useEffect(()=>{
    void loadOfficial();const touch=()=>{lastInteraction.current=Date.now()};
    window.addEventListener("pointerdown",touch,{passive:true});window.addEventListener("touchstart",touch,{passive:true});window.addEventListener("wheel",touch,{passive:true});window.addEventListener("scroll",touch,{passive:true});
    const first=window.setTimeout(()=>{if(autoSyncEnabledRef.current&&document.visibilityState==="visible")void refreshSavedData(false)},15000);
    const timer=window.setInterval(()=>{if(autoSyncEnabledRef.current&&document.visibilityState==="visible")void refreshSavedData(false)},15*60_000);
    const visible=()=>{if(document.visibilityState==="visible"&&autoSyncEnabledRef.current)window.setTimeout(()=>void refreshSavedData(false),QUIET_MS)};
    document.addEventListener("visibilitychange",visible);
    return()=>{window.clearTimeout(first);window.clearInterval(timer);window.removeEventListener("pointerdown",touch);window.removeEventListener("touchstart",touch);window.removeEventListener("wheel",touch);window.removeEventListener("scroll",touch);document.removeEventListener("visibilitychange",visible);publicSyncRun.current++;publicSyncController.current?.abort();publicSyncController.current=null;running.current=false}
  },[]);
  useEffect(()=>{
    void checkRelease();const timer=window.setInterval(()=>{if(document.visibilityState==="visible")void checkRelease()},15*60_000);const refresh=()=>{if(document.visibilityState==="visible")void checkRelease()};
    const storageRefresh=(event:StorageEvent)=>{if(event.key===NOTIFICATION_VERSION_STORAGE_KEY||event.key===DASHBOARD_VERSION_STORAGE_KEY)refresh()};
    window.addEventListener("online",refresh);window.addEventListener("storage",storageRefresh);
    window.addEventListener("focus",refresh);window.addEventListener("pageshow",refresh);window.addEventListener("mumei-notification-version-changed",refresh);document.addEventListener("visibilitychange",refresh);
    return()=>{window.clearInterval(timer);window.removeEventListener("online",refresh);window.removeEventListener("storage",storageRefresh);window.removeEventListener("focus",refresh);window.removeEventListener("pageshow",refresh);window.removeEventListener("mumei-notification-version-changed",refresh);document.removeEventListener("visibilitychange",refresh);if(appFeedbackTimer.current)window.clearTimeout(appFeedbackTimer.current)}
  },[]);
  const appLatest=release?.appVersion||"";
  const appUpdateAvailable=Boolean(appLatest&&versionDiffers(CURRENT_INSIGHT_APP_VERSION,appLatest));
  const notificationLatest=release?.notificationVersion||CURRENT_NOTIFICATION_VERSION;
  const notificationMissing=Boolean(releaseChecked&&notificationLatest&&!notificationInstalled);
  const notificationUpdateAvailable=Boolean(notificationLatest&&notificationInstalled&&versionDiffers(notificationInstalled,notificationLatest));
  const dashboardLatest=release?.dashboardVersion||CURRENT_DASHBOARD_VERSION;
  const dashboardMissing=Boolean(releaseChecked&&dashboardLatest&&!dashboardInstalled);
  const dashboardUpdateAvailable=Boolean(dashboardLatest&&dashboardInstalled&&versionDiffers(dashboardInstalled,dashboardLatest));
  const noteId=String(official?.member?.noteId||"").toLowerCase();
  const dashboardSetupHref=`./dashboard-setup.html?from=analysis${noteId?`&account=${encodeURIComponent(noteId)}`:""}&return=${encodeURIComponent(window.location.href)}`;
  const dashboardCardContent=<><strong>📊 分析</strong><small>{dashboardInstalled?`ダッシュボード v${dashboardInstalled}`:"ダッシュボード同期は未導入"}{dashboardUpdateAvailable&&dashboardLatest?` → v${dashboardLatest}`:""}</small><span>{releaseError?"更新確認に失敗｜再確認できます":"公式ダッシュボード＋INSIGHT"}</span></>;
  const modeMeta={
    normal:{eyebrow:"MUMEI S NOTE",title:"無名S note INSIGHT",sub:"保存・分析・通知をひとつの視界へ"},
    comments:{eyebrow:"無名S note INSIGHT",title:"コメント解析",sub:"返信の抜けと会話の続きまで追跡"},
    favorites:{eyebrow:"無名S note INSIGHT",title:"お気に入り",sub:"追いたいクリエイターを見失わない"},
    social:{eyebrow:"無名S note INSIGHT",title:"フォロー解析",sub:"フォロー関係の変化を照合"},
    notifications:{eyebrow:"無名S note INSIGHT",title:"本人通知",sub:"本人通知を履歴として残す"},
    analysis:{eyebrow:"無名S note INSIGHT",title:"分析",sub:"公式値と保存履歴を重ねて読む"},
  }[mode];
  return <div className={`miv5 mode-${mode}`}>
    <section className="ic2-masthead" aria-label="INSIGHT現在画面">
      <div className="ic2-atmosphere" aria-hidden="true"><i/><i/><i/></div>
      <div className="ic2-brandmark" aria-hidden="true"><span>INSIGHT</span><b>◈</b></div>
      <div className="ic2-mast-copy">
        <small>{modeMeta.eyebrow}</small>
        <h1>{modeMeta.title}</h1>
        <p>{modeMeta.sub}</p>
      </div>
      <div className="ic2-system-state">
        <span><i/>LIVE</span>
        <b>v{CURRENT_INSIGHT_APP_VERSION}</b>
      </div>
      <div className="ic2-horizon" aria-hidden="true"><span/><span/><span/></div>
    </section>
    {appUpdateAvailable?<section className="miv5-app-update" aria-label="INSIGHT本体の更新"><div><strong>INSIGHT本体の更新</strong><small>新しい画面・機能を適用します</small><small>現在 v{CURRENT_INSIGHT_APP_VERSION} ／ 新しい版 v{appLatest}</small></div><button disabled={appBusy} onClick={()=>void updateInsightApp()}>{appBusy?"確認中…":"INSIGHT本体を更新"}</button></section>:null}
    <section className="miv5-update" aria-label="INSIGHT主要機能">
      <div className="miv5-source-grid">
        <div className="miv5-source-card normal miv5-auto-card">
          <div className="miv5-source-main miv5-source-status" aria-busy={dataBusy}><strong>画面更新</strong><small>{autoSyncEnabled?"自動":"手動"}</small><span>{dataBusy?"保存済み最新値を反映中":"中央更新済みデータを表示"}</span></div>
          <div className="miv5-auto-actions"><button type="button" className={autoSyncEnabled?"active":""} aria-pressed={autoSyncEnabled} onClick={()=>setAutoSyncEnabled(true)}>自動</button><button type="button" className={!autoSyncEnabled?"active":""} aria-pressed={!autoSyncEnabled} onClick={()=>setAutoSyncEnabled(false)}>手動</button>{!autoSyncEnabled?<button type="button" className="refresh" disabled={dataBusy} onClick={()=>void refreshSavedData(true)}>{dataBusy?"反映中":"更新"}</button>:null}</div>
        </div>
        <div className={`miv5-source-card notice ${notificationUpdateAvailable?"needs-update":notificationMissing?"needs-install":""}`}>
          <button className="miv5-source-main" onClick={()=>openMode("notifications")}><strong>🔔 本人通知</strong><small>{notificationInstalled?`この端末 v${notificationInstalled}`:"この端末は未導入"}{notificationUpdateAvailable&&notificationLatest?` → v${notificationLatest}`:""}</small><span>通知履歴・追加分析</span></button>
          <a className={`miv5-install-link ${notificationUpdateAvailable||notificationMissing?"update-ready":""}`} href="./tool-setup.html?from=insight">{notificationUpdateAvailable?"本人通知を更新":notificationMissing?"＋ 本人通知を設定":"⚙ 設定・更新状態"}</a>
        </div>
        <div className={`miv5-source-card dashboard ${dashboardUpdateAvailable?"needs-update":dashboardMissing?"needs-install":""}`}>
          <button className="miv5-source-main" onClick={()=>openMode("analysis")} aria-label="分析を開く">{dashboardCardContent}</button>
          <div className="miv5-dashboard-links"><a className="miv5-install-link miv5-dashboard-settings" href={dashboardSetupHref}>{dashboardUpdateAvailable?"更新":"設定"}</a><a className="miv5-install-link miv5-detail-link" href="./install-free-analysis.html">詳細</a></div>
        </div>
      </div>
    </section>
    {appFeedback?<section className={`miv5-app-feedback ${appFeedback.startsWith("⚠")?"error":""}`} role="status">{appFeedback}</section>:null}
    <MemberInsightCompleteness revision={revision}/>
    <MemberInsightUnifiedV4 revision={revision} active={mode==="normal"} onTabChange={handleUnifiedTab}/>
    {mode==="comments"?<div className="miv5-final-slot"><MemberInsightCommentsFinal revision={revision}/></div>:null}
    {mode==="favorites"?<div className="miv5-final-slot"><MemberInsightFavoritesFinal revision={revision}/></div>:null}
    {mode==="social"?<div className="miv5-final-slot"><MemberInsightSocialV2 revision={revision}/></div>:null}
    {mode==="notifications"?<div className="miv5-final-slot"><MemberInsightNotificationsFinal revision={revision} noteId={String(official?.member?.noteId||"")}/></div>:null}
    {mode==="analysis"?<div className="miv5-final-slot"><MemberInsightAnalysisHub revision={revision} onBack={backMode} noteId={noteId} dashboardInstalled={dashboardInstalled} notificationInstalled={notificationInstalled} dashboardLatest={dashboardLatest} notificationLatest={notificationLatest}/></div>:null}
  </div>;
}
