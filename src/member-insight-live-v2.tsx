import { CreatorAvatar } from "./creator-avatar";
import { useEffect, useRef, useState } from "react";
import { INSIGHT_TOKEN_KEY, currentStoredInsightAccount, setAccessIntent } from "./insight-account-store";
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
import "./member-insight-hotfix.css";
import "./member-insight-live-v2.css";
import "./insight-cinematic-shell-v1.css";
import "./insight-cinematic-shell-v2.css";
import "./insight-live-scan-theater.css";
import "./insight-visual-overhaul-v3.css";
import "./insight-integrated-hero-v6.css";
import "./insight-cinematic-overdrive-v7.css";
import "./insight-motion-discipline-v8.css";
import "./insight-creator-first-v9.css";
import "./insight-launcher-v10.css";
import "./insight-thumb-dock-v11.css";
import "./insight-ux-v12";
import "./member-insight-analysis-scene.css";
import { useVisibleMotion } from "./insight-visible-motion";

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
const INSIGHT_NAV_ITEMS=[["likes","スキ履歴"],["supporters","スキ順位"],["comments","コメント"],["commentRanking","コメント順位"],["magazines","マガジン"],["favorites","お気に入り"],["social","フォロー"],["notifications","本人通知"],["dm","DM"],["articles","記事"]] as const;
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
  const creatorMotion=useVisibleMotion<HTMLElement>();
  const explicitMode=requestedMode();
  const initialMode:Mode=explicitMode||"normal";
  const initialNavTab=String(explicitMode&&["comments","favorites","social","notifications"].includes(explicitMode)?explicitMode:"likes");
  const[revision,setRevision]=useState(0),[status,setStatus]=useState("保存済み公開データを表示中・自動更新待機"),[appBusy,setAppBusy]=useState(false),[dataBusy,setDataBusy]=useState(false),[mode,setMode]=useState<Mode>(initialMode),[navTab,setNavTab]=useState(initialNavTab),[official,setOfficial]=useState<any>(null),[autoSyncEnabled]=useState(true);
  const[release,setRelease]=useState<InsightRelease|null>(null),[releaseChecked,setReleaseChecked]=useState(false),[releaseError,setReleaseError]=useState(false),[notificationInstalled,setNotificationInstalled]=useState(()=>localStorage.getItem(NOTIFICATION_VERSION_STORAGE_KEY)||""),[dashboardInstalled,setDashboardInstalled]=useState(()=>localStorage.getItem(DASHBOARD_VERSION_STORAGE_KEY)||"");
  const releaseRequest=useRef(0);
  const[appFeedback,setAppFeedback]=useState(()=>{const expected=sessionStorage.getItem(APP_UPDATE_RESULT_KEY)||"";if(expected&&!versionDiffers(CURRENT_INSIGHT_APP_VERSION,expected)){sessionStorage.removeItem(APP_UPDATE_RESULT_KEY);return`✅ INSIGHT本体 v${CURRENT_INSIGHT_APP_VERSION} 更新完了・最新版`;}if(expected)return`⚠ 更新を完了できていません。現在 v${CURRENT_INSIGHT_APP_VERSION}／更新先 v${expected}。通信を確認して本体更新を再試行してください。`;return""});
  const running=useRef(false),manualRefreshRunning=useRef(false),relationRunning=useRef(false),lastInteraction=useRef(Date.now()),lastRun=useRef(Number(localStorage.getItem(AUTO_SYNC_KEY)||0)),lastRelationRun=useRef(Number(localStorage.getItem(RELATION_SYNC_KEY)||0)),appFeedbackTimer=useRef(0),publicSyncController=useRef<AbortController|null>(null),publicSyncRun=useRef(0),notificationEntryY=useRef<number|null>(null),autoSyncEnabledRef=useRef(autoSyncEnabled);
  function showAppFeedback(text:string,ms=5000){setAppFeedback(text);if(appFeedbackTimer.current)window.clearTimeout(appFeedbackTimer.current);appFeedbackTimer.current=ms>0?window.setTimeout(()=>setAppFeedback(""),ms):0}
  useEffect(()=>{autoSyncEnabledRef.current=autoSyncEnabled;try{localStorage.setItem(AUTO_SYNC_ENABLED_KEY,autoSyncEnabled?"1":"0")}catch{}},[autoSyncEnabled]);
  useEffect(()=>{
    const select=(event:Event)=>{
      const tab=String((event as CustomEvent).detail||"");
      if(INSIGHT_NAV_ITEMS.some(([key])=>key===tab))handleUnifiedTab(tab);
    };
    window.addEventListener("mumei-insight-select-item",select as EventListener);
    return()=>window.removeEventListener("mumei-insight-select-item",select as EventListener);
  },[mode]);
  function openMode(next:Mode){
    window.dispatchEvent(new Event("mumei-insight-close-items"));
    if(mode===next){
      if(next==="analysis")window.dispatchEvent(new Event("mumei-insight-analysis-menu"));
      if(next!=="notifications")requestAnimationFrame(()=>document.querySelector<HTMLElement>(next==="analysis"?".miah,.mia2,.miaf":".miu")?.scrollIntoView({block:"start",behavior:"auto"}));
      return;
    }
    const y=window.scrollY;
    if(next==="notifications")notificationEntryY.current=y;
    window.history.replaceState({...window.history.state,insightScrollY:y},"",window.location.href);
    const modeUrl=new URL(window.location.href);modeUrl.searchParams.delete("analysisPanel");modeUrl.searchParams.delete("insightMode");
    window.history.pushState({...window.history.state,route:"dashboard",insightMode:next,insightTab:["comments","favorites","social","notifications"].includes(next)?next:window.history.state?.insightTab||"likes",insightScrollY:y},"",modeUrl.href);
    if(["comments","favorites","social","notifications"].includes(next))setNavTab(next);setMode(next);window.dispatchEvent(new Event("mumei-insight-navigation"));
    if(next!=="notifications")requestAnimationFrame(()=>window.scrollTo({top:y,behavior:"auto"}));
  }
  function backMode(){if(mode!=="normal"){window.history.back();return}window.history.back()}
  function handleUnifiedTab(tab:string){
    const next:Mode=tab==="comments"?"comments":tab==="favorites"?"favorites":tab==="social"?"social":tab==="notifications"?"notifications":"normal";
    const current=window.history.state||{};
    if(mode===next&&current.insightTab===tab){setNavTab(tab);return}
    window.history.replaceState({...current,insightScrollY:window.scrollY},"",window.location.href);
    window.history.pushState({...current,route:"dashboard",insightMode:next,insightTab:tab,insightScrollY:window.scrollY},"",window.location.href);
    setNavTab(tab);setMode(next);window.dispatchEvent(new Event("mumei-insight-close-items"));window.dispatchEvent(new Event("mumei-insight-navigation"));
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
    if(requested){sessionStorage.removeItem(ENTRY_MODE_KEY);const u=new URL(window.location.href);u.searchParams.delete("insightMode");const tab=["comments","favorites","social","notifications"].includes(requested)?requested:"likes";window.history.replaceState({...window.history.state,route:"dashboard",insightMode:requested,insightTab:tab,insightScrollY:0},"",u.href);setNavTab(tab);setMode(requested);window.dispatchEvent(new Event("mumei-insight-navigation"))}
    else{window.history.replaceState({...window.history.state,route:"dashboard",insightMode:"normal",insightTab:"likes",insightScrollY:0},"",window.location.href);setNavTab("likes");setMode("normal");window.dispatchEvent(new Event("mumei-insight-navigation"))}
    const pop=()=>{const next=history.state?.insightMode;const tab=String(history.state?.insightTab||(["comments","favorites","social","notifications"].includes(next)?next:"likes"));const y=Number(history.state?.insightScrollY);setNavTab(tab);setMode(MODES.has(next)?next:"normal");if(Number.isFinite(y))requestAnimationFrame(()=>requestAnimationFrame(()=>window.scrollTo({top:y,behavior:"auto"})))};
    window.addEventListener("popstate",pop);return()=>window.removeEventListener("popstate",pop)
  },[]);
  useEffect(()=>{
    const handler=(event:Event)=>{const next=(event as CustomEvent).detail;if(typeof next==="string"&&MODES.has(next as Mode))openMode(next as Mode)};
    window.addEventListener("mumei-insight-open-mode",handler as EventListener);return()=>window.removeEventListener("mumei-insight-open-mode",handler as EventListener)
  },[mode]);
  useEffect(()=>{
    const root=()=>{
      window.history.replaceState({...window.history.state,route:"dashboard",insightMode:"normal",insightTab:"likes",insightScrollY:0},"",window.location.href);
      setNavTab("likes");setMode("normal");
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
  const noteId=String(official?.member?.noteId||currentStoredInsightAccount()?.noteId||"").toLowerCase();
  const dashboardSetupHref=`./dashboard-setup.html?from=analysis${noteId?`&account=${encodeURIComponent(noteId)}`:""}&return=${encodeURIComponent(window.location.href)}`;
  const notificationConnectionHref=`./notification-connection.html?from=insight${noteId?`&notificationAccount=${encodeURIComponent(noteId)}`:""}&return=${encodeURIComponent(window.location.href)}`;
  const dashboardCardContent=<><strong>📊 分析</strong><small>{dashboardInstalled?`ダッシュボード v${dashboardInstalled}`:"ダッシュボード同期は未導入"}{dashboardUpdateAvailable&&dashboardLatest?` → v${dashboardLatest}`:""}</small><span>{releaseError?"更新確認に失敗｜再確認できます":"公式ダッシュボード＋INSIGHT"}</span></>;
  const account=currentStoredInsightAccount();
  const creatorId=String(official?.member?.noteId||account?.noteId||noteId||"").replace(/^@/,"");
  const creatorName=String(official?.member?.displayName||official?.member?.nickname||account?.displayName||creatorId||"noteクリエイター");
  const creatorImage=String(official?.member?.imageUrl||official?.member?.profileImageUrl||account?.imageUrl||"");
  const modeMeta={
    normal:{title:"",sub:""},
    comments:{title:"コメント解析",sub:"返信の抜けと会話の続きまで追跡"},
    favorites:{title:"お気に入り",sub:"追いたいクリエイターを見失わない"},
    social:{title:"フォロー解析",sub:"フォロー関係の変化を照合"},
    notifications:{title:"本人通知",sub:"本人通知を履歴として残す"},
    analysis:{title:"分析",sub:"公式値と保存履歴を重ねて読む"},
  }[mode];
  return <div className={`miv5 mode-${mode}`}><div key={`light:${mode}:${navTab}`} className="miv5-page-light" aria-hidden="true"/>
    <section ref={creatorMotion.ref} data-motion={creatorMotion.motion?"on":"off"} className="miv5-creator-first" aria-label="現在のクリエイター"><div key={`${mode}:${navTab}`} className="miv5-hero-signature" aria-hidden="true"><strong><span>無名 S note</span><span>INSIGHT</span></strong><i/></div>
      <div className="miv5-creator-avatar"><CreatorAvatar name={creatorName} image={creatorImage} noteId={creatorId} eager/></div>
      <div className="miv5-creator-copy">
        <h1>{creatorName}</h1>
        {creatorId?<a href={`https://note.com/${creatorId}`} target="_blank" rel="noreferrer">@{creatorId} ↗</a>:null}
      </div>
      <div className="miv5-creator-actions">
        <div className="miv5-creator-brand"><span>◇</span><small>v{CURRENT_INSIGHT_APP_VERSION}</small></div>
        <button type="button" onClick={()=>{sessionStorage.setItem("mumei-insight-account-switch-lock-v1","1");setAccessIntent("switch");location.hash="access/insight"}}>アカウント切替</button>
      </div>
    </section>
    <section className={`miv5-command-stage ${mode==="normal"?"main":""}`} aria-label="INSIGHT主要機能">
      {mode!=="normal"?<header className="miv5-mode-label"><h2>{modeMeta.title}</h2><p>{modeMeta.sub}</p></header>:null}
      <nav className="miv5-launcher" aria-label="INSIGHTランチャー"><div key={`${mode}:${navTab}`} className="miv5-launcher-halo" aria-hidden="true"><i/><i/></div>
        <a className="miv5-launcher-item caution" href="./insight-data-notice.html"><span className="icon">⚠</span><b>注意</b></a>
        <div className={`miv5-launcher-item analysis ${mode==="analysis"?"active ":""}${dashboardUpdateAvailable||notificationUpdateAvailable?"needs-update":dashboardMissing?"needs-install":""}`}>
          <button type="button" onClick={()=>openMode("analysis")} aria-label="分析を開く"><span className="icon">📊</span><b>分析</b></button>
          <a className="gear" href={dashboardSetupHref} aria-label="分析設定">⚙</a>
        </div>
        <div className={`miv5-launcher-item notification ${mode==="notifications"?"active":""}`}>
          <button type="button" onClick={()=>{window.location.href=notificationConnectionHref}} aria-label="本人通知の連携と履歴を開く"><span className="icon">🔔</span><b>本人通知</b></button>
        </div>
      </nav>
    </section>
    {appFeedback?<section className={`miv5-app-feedback ${appFeedback.startsWith("⚠")?"error":""}`} role="status">{appFeedback}</section>:null}
    <div className="miv5-unified-slot" hidden={mode!=="normal"}><MemberInsightUnifiedV4 revision={revision} active={true} onTabChange={handleUnifiedTab}/></div>
    {mode==="comments"?<div className="miv5-final-slot"><MemberInsightCommentsFinal revision={revision} noteId={noteId}/></div>:null}
    {mode==="favorites"?<div className="miv5-final-slot"><MemberInsightFavoritesFinal revision={revision}/></div>:null}
    {mode==="social"?<div className="miv5-final-slot"><MemberInsightSocialV2 revision={revision}/></div>:null}
    {mode==="notifications"?<div className="miv5-final-slot"><MemberInsightNotificationsFinal revision={revision} noteId={String(official?.member?.noteId||"")}/></div>:null}
    {mode==="analysis"?<div className="miv5-final-slot"><MemberInsightAnalysisHub revision={revision} onBack={backMode} noteId={noteId} dashboardInstalled={dashboardInstalled} notificationInstalled={notificationInstalled} dashboardLatest={dashboardLatest} notificationLatest={notificationLatest}/></div>:null}
  </div>;
}
