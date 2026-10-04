import { useEffect, useState } from "react";
import { AccessPortalV6 } from "./access-portal-v6";
import { ArticleLikesPageV2 } from "./article-likes-page-v2";
import { CombinedAnalyticsApp } from "./combined-analytics-app";
import { EvidenceV2 } from "./evidence-v2";
import "./fast-insight-v6-override.css";
import { FeaturePage } from "./feature-page";
import { HubHome } from "./hub-home";
import { ManagementPage } from "./management-page";
import { MemberInsightLiveV2 } from "./member-insight-live-v2";
import { OwnerGate } from "./owner-gate";
import {
  INSIGHT_TOKEN_KEY,
  readStoredInsightAccounts,
  rememberApplicant,
  rememberMemberSession,
  restoreStoredMemberSession,
} from "./insight-account-store";
import "./insight-polish-v1.css";
import { useInsightDisplayMode } from "./insight-display-mode";
import "./insight-pc-layout.css";
import "./insight-device-scale.css";

// Maintenance is reserved for login/main-wide participant outages only.
const PARTICIPANT_MAINTENANCE = false;
const OWNER_KEY = "mumei-unified-owner-token";
const MEMBER_KEY = INSIGHT_TOKEN_KEY;
const OWNER_VIEW_KEY = "mumei-owner-insight-view";
const ACCESS_ENDPOINT = "https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-access";
const REACTIVATE_ENDPOINT = "https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-access-reactivate";
const NOTIFICATION_TOOL_VERSION = "3.6.1";
const NOTIFICATION_TOOL_VERSION_KEY = "mumei-notification-tool-version";
const NOTIFICATION_AUTO_ONCE_KEY = "mumei-notification-auto-once-v2924";
const NOTIFICATION_AUTO_RESULT_KEY = "mumei-notification-auto-result-v2924";
const ADMIN_ROUTES = new Set(["owner", "manage", "owner-insight"]);
const PARTICIPANT_CHILD_ROUTES = new Set(["dashboard", "evidence", "article-likes", "dashboard-legacy"]);
const INSIGHT_BOTTOM_ITEMS=[["likes","スキ履歴"],["supporters","スキ順位"],["comments","コメント"],["commentRanking","コメント順位"],["magazines","マガジン"],["favorites","お気に入り"],["social","フォロー"],["notifications","本人通知"],["dm","DM"],["articles","記事"]] as const;
const DETACHED_ROUTES = new Set(["catalog", "catalog-admin", "member", "battle", "game-admin", "insight-admin", "access/catalog"]);

function rawRoute() { return window.location.hash.replace(/^#\/?/, "") || "home"; }
function currentRoute() {
  const route = rawRoute();
  return DETACHED_ROUTES.has(route) || route.startsWith("catalog/") ? "home" : route;
}
function isAdminRoute(route: string) { return ADMIN_ROUTES.has(route) || route.startsWith("owner-features/"); }
function routeUrl(route: string) { const url = new URL(window.location.href); url.hash = route === "home" ? "" : route; return url.toString(); }
function memberRoute(route: string) { return route === "owner-insight" || PARTICIPANT_CHILD_ROUTES.has(route) || route.startsWith("features/"); }
function initialMemberToken() {
  const current = localStorage.getItem(MEMBER_KEY) || "";
  if (current) return current;
  return restoreStoredMemberSession()?.memberToken || "";
}
function isTransientSessionError(code: string, status: number) {
  if (status === 402 || status >= 500 || status === 408 || status === 425 || status === 429) return true;
  return /NETWORK|TIMEOUT|TEMPORARY|FETCH|ACCESS_ERROR|INTERNAL/i.test(code);
}
function isSessionInvalid(code: string) {
  return /INSIGHT_SESSION_INVALID|INSIGHT_LOGIN_REQUIRED/i.test(code);
}
function isMembershipInactive(code: string) {
  return /INSIGHT_MEMBER_INACTIVE|INSIGHT_MEMBER_NOT_ACTIVE|REACTIVATION_NOT_ALLOWED|WAITING_OWNER_APPROVAL/i.test(code);
}

// These styles must exist while BottomNav is hidden during the session check.
// Presentation only: no extra wait, session mutation, or route interception.
const SESSION_TRANSITION_CSS = `
  .app-session-check{position:relative;isolation:isolate;display:grid;place-items:center;min-height:100svh;padding:32px 20px;overflow:hidden;background:#03070b;color:#dce9f5}
  .app-session-check::before{content:"";position:absolute;inset:0;z-index:-1;pointer-events:none;background:radial-gradient(ellipse at 50% 46%,rgba(47,150,179,.12),transparent 58%)}
  .app-session-scene{position:relative;width:min(440px,100%);text-align:center}
  .app-session-mark{position:relative;display:grid;align-content:center;min-height:180px;padding:24px 18px}
  .app-session-mark::before,.app-session-mark::after{content:"";position:absolute;inset:8px 0;border:1px solid rgba(108,218,242,.18);border-radius:50%;pointer-events:none}
  .app-session-mark::before{animation:insightEntryOrbit 1.7s ease-out both}
  .app-session-mark::after{inset:21px 17px;border-color:rgba(108,218,242,.07);animation:insightEntryOrbit 1.7s ease-out .12s both}
  .app-session-brand{position:relative;z-index:1;display:grid;gap:6px;line-height:1;color:#e8faff;font-family:system-ui,sans-serif;animation:insightEntryBrand .55s ease-out both}
  .app-session-brand span:first-child{font-size:clamp(18px,5vw,25px);font-weight:750;letter-spacing:.13em}
  .app-session-brand span:last-child{font-size:clamp(36px,11vw,60px);font-weight:950;letter-spacing:.17em;text-indent:.17em;text-shadow:0 0 26px rgba(111,225,249,.24)}
  .app-session-beam{position:absolute;z-index:2;top:50%;left:0;width:32%;height:1px;background:linear-gradient(90deg,transparent,#95ecff,#fff,transparent);box-shadow:0 0 16px rgba(106,225,250,.5);opacity:0;pointer-events:none;animation:insightEntryBeam 1.35s ease-out .15s both}
  .app-session-caption{margin:16px 0 0;color:#9cbdcc;font:500 11px/1.8 system-ui,sans-serif;animation:insightEntryBrand .4s ease-out .12s both}
  .app-session-caption span{display:block;color:#637e8b;font-size:10px}
  .app-session-progress{display:block;width:86px;height:2px;margin:20px auto 0;overflow:hidden;border-radius:999px;background:#142b37}
  .app-session-progress::after{content:"";display:block;width:40%;height:100%;border-radius:inherit;background:#88e6fa;animation:insightEntryProgress 1.5s ease-in-out infinite}
  .app-route-shell.is-ready>.app-route-page{animation:insightPageReady .24s ease-out both}
  .app-route-light{position:fixed;inset:0 0 150px;z-index:90;pointer-events:none;overflow:hidden;contain:strict}
  .app-route-light::before{content:"";position:absolute;left:-35%;top:42%;width:150%;height:1px;background:linear-gradient(90deg,transparent,#a8fcae,#d3fbff,#73dbe5,transparent);box-shadow:0 0 22px 3px #78e4ee35;opacity:0;transform:rotate(-14deg);animation:insightRouteLight .65s ease-out both}
  .app-route-light::after{content:"";position:absolute;inset:10% 10% 20%;border:1px solid #96e5ec1c;clip-path:polygon(0 25%,78% 0,100% 75%,22% 100%);opacity:0;animation:insightRouteDepth .55s ease-out both}
  @keyframes insightRouteLight{0%{opacity:0;translate:-70% 0}25%{opacity:.8}100%{opacity:0;translate:75% 0}}
  @keyframes insightRouteDepth{0%{opacity:0;transform:scale(.9)}30%{opacity:.7}100%{opacity:0;transform:scale(1.08)}}
  @keyframes insightEntryBrand{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
  @keyframes insightEntryOrbit{from{opacity:0;transform:scale(.85)}to{opacity:1;transform:scale(1)}}
  @keyframes insightEntryBeam{0%{opacity:0;transform:translateX(-100%)}20%{opacity:1}100%{opacity:0;transform:translateX(350%)}}
  @keyframes insightEntryProgress{0%{transform:translateX(-110%)}100%{transform:translateX(350%)}}
  @keyframes insightPageReady{from{opacity:.65}to{opacity:1}}
  @media(prefers-reduced-motion:reduce){
    .app-session-brand,.app-session-caption,.app-session-mark::before,.app-session-mark::after,.app-session-progress::after,.app-route-shell.is-ready>.app-route-page{animation:none!important}
    .app-session-beam{display:none}
    .app-session-progress::after{width:100%}
    .app-route-light{display:none}
  }
`;

export function InsightSessionTransition() {
  return <section className="app-session-check" aria-label="INSIGHTへの切替">
    <div className="app-session-scene">
      <div className="app-session-mark" aria-hidden="true">
        <strong className="app-session-brand"><span>無名 S note</span><span>INSIGHT</span></strong>
        <i className="app-session-beam" />
      </div>
      <p className="app-session-caption" role="status">ログイン状態を確認しています<span>保存済み参加者は自動復帰します</span></p>
      <i className="app-session-progress" aria-hidden="true" />
    </div>
  </section>;
}

export function goTo(route: string) {
  const next = route || "home";
  if (currentRoute() === next) { window.scrollTo({ top: 0, behavior: "auto" }); return; }
  window.history.pushState({ route: next }, "", routeUrl(next));
  window.dispatchEvent(new Event("mumei-route"));
  window.scrollTo({ top: 0, behavior: "auto" });
}

export function focusMainAnalysis() {
  if(new URLSearchParams(window.location.search).get("insightFocus")!=="analysis")return ()=>{};
  let done=false;
  const finish=()=>{
    const button=document.querySelector<HTMLButtonElement>('.miv5.mode-normal .miv5-launcher-item.analysis > button');
    if(!button||done)return;
    done=true;observer.disconnect();window.clearTimeout(timer);
    button.scrollIntoView({block:"start",behavior:"auto"});button.focus({preventScroll:true});
    const url=new URL(window.location.href);url.searchParams.delete("insightFocus");window.history.replaceState(window.history.state,"",url.href);
  };
  const observer=new window.MutationObserver(finish),timer=window.setTimeout(()=>observer.disconnect(),30000);
  observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:["class"]});finish();
  return ()=>{done=true;observer.disconnect();window.clearTimeout(timer)};
}

function BottomNav({ route }: { route: string }) {
  const insightActive = route === "access/insight" || PARTICIPANT_CHILD_ROUTES.has(route) || route.startsWith("features/");
  const hasMember = Boolean(localStorage.getItem(MEMBER_KEY));
  const showItemLauncher = route === "dashboard";
  const currentTab=()=>String(window.history.state?.insightTab||"likes");
  const [itemOpen,setItemOpen]=useState(false);
  const [itemTab,setItemTab]=useState(currentTab);
  useEffect(()=>{
    const sync=()=>{setItemTab(currentTab())};
    const close=()=>setItemOpen(false);
    sync();
    window.addEventListener("mumei-insight-navigation",sync);
    window.addEventListener("popstate",sync);
    window.addEventListener("mumei-insight-close-items",close);
    return()=>{window.removeEventListener("mumei-insight-navigation",sync);window.removeEventListener("popstate",sync);window.removeEventListener("mumei-insight-close-items",close)}
  },[route]);
  useEffect(()=>{if(!showItemLauncher)setItemOpen(false)},[showItemLauncher]);

  function chooseItem(tab:string){
    setItemOpen(false);setItemTab(tab);
    window.dispatchEvent(new CustomEvent("mumei-insight-select-item",{detail:tab}));
  }

  function topPress() {
    if (route !== "home") { goTo("home"); return; }
    window.scrollTo({ top: 0, behavior: "auto" });
  }
  function insightPress() {
    if (!hasMember) { goTo("access/insight"); return; }
    if (route !== "dashboard") { goTo("dashboard"); return; }
    sessionStorage.removeItem("mumei-insight-entry-mode");
    window.dispatchEvent(new Event("mumei-insight-root"));
  }
  function notePress() { window.location.assign("https://note.com/"); }

  return <>
    <nav className={`app-bottom-nav ${showItemLauncher?"has-items":""}`} aria-label="メインナビゲーション">
      {showItemLauncher?<button type="button" className="app-bottom-item-toggle" aria-expanded={itemOpen} onClick={()=>setItemOpen(v=>!v)}>
        <span aria-hidden="true">{itemOpen?"⌄":"▦"}</span><b>{itemOpen?"項目を閉じる":"項目を選ぶ"}</b><small>現在：{INSIGHT_BOTTOM_ITEMS.find(([key])=>key===itemTab)?.[1]||"スキ履歴"}</small>
      </button>:null}
      {showItemLauncher&&itemOpen?<div className="app-bottom-item-sheet" aria-label="INSIGHT各項目">
        {INSIGHT_BOTTOM_ITEMS.map(([key,label])=><button type="button" key={key} className={itemTab===key?"active":""} onClick={()=>chooseItem(key)}>{label}</button>)}
      </div>:null}
      <button className={route === "home" ? "active" : ""} onClick={topPress} aria-label="TOP"><span aria-hidden="true">⌂</span><b>TOP</b></button>
      <button className={insightActive ? "active" : ""} onClick={insightPress} aria-label="INSIGHT メイン"><small className="app-main-label">メイン</small><span aria-hidden="true">◫</span><b>INSIGHT</b></button>
      <button className="note-exit" onClick={notePress} aria-label="noteへ"><span aria-hidden="true">↗</span><b>noteへ</b></button>
    </nav>
    <style>{`
      html{scroll-padding-bottom:calc(118px + env(safe-area-inset-bottom,0px))}
      .app-route-shell{min-height:100vh;padding-bottom:calc(96px + env(safe-area-inset-bottom,0px))}.app-route-shell.is-dashboard{padding-bottom:calc(118px + env(safe-area-inset-bottom,0px))}
      .app-route-shell>*{scroll-margin-bottom:calc(96px + env(safe-area-inset-bottom,0px))}
      .app-route-shell.is-member .iv8-apprefresh{display:none!important}
      .app-route-shell.is-admin{padding-bottom:24px!important}.app-route-shell.is-admin>*{scroll-margin-bottom:0!important}
      .app-bottom-nav{position:fixed;left:50%;bottom:0;transform:translateX(-50%);z-index:9999;width:min(720px,100%);display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:0;padding:6px 8px calc(6px + env(safe-area-inset-bottom,0px));background:rgba(7,10,16,.96);backdrop-filter:blur(16px);border:1px solid #2b394c;border-bottom:0;border-radius:20px 20px 0 0;box-shadow:0 -10px 30px rgba(0,0,0,.28)}
      .app-bottom-nav button{min-width:0;min-height:54px;border:0;background:transparent;color:#8796aa;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:2px;font:inherit;border-radius:12px;overflow:hidden}
      .app-bottom-nav.has-items{padding-top:5px}
      .app-bottom-item-toggle{grid-column:1/-1!important;display:grid!important;grid-template-columns:auto minmax(0,1fr) auto!important;min-height:36px!important;margin:0 8px 4px!important;padding:0 11px!important;border:1px solid rgba(107,218,243,.48)!important;border-radius:999px!important;background:linear-gradient(145deg,rgba(13,45,60,.96),rgba(8,27,39,.96))!important;color:#e8fbff!important;box-shadow:0 0 18px rgba(74,200,230,.12),inset 0 1px rgba(255,255,255,.04)!important}
      .app-bottom-item-toggle span{font-size:15px!important;color:#9ceeff}.app-bottom-item-toggle b{font-size:9px!important;text-align:left!important}.app-bottom-item-toggle small{font-size:6.5px;color:#91adbc;white-space:nowrap}
      .app-bottom-item-sheet{position:absolute;left:8px;right:8px;bottom:calc(100% + 6px);display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:4px;padding:6px;border:1px solid rgba(103,210,237,.28);border-radius:15px;background:rgba(5,17,26,.985);backdrop-filter:blur(18px);box-shadow:0 18px 48px rgba(0,0,0,.46),0 0 28px rgba(67,190,220,.08)}
      .app-bottom-item-sheet button{min-height:38px!important;padding:4px 2px!important;border:1px solid rgba(101,199,225,.28)!important;border-radius:9px!important;background:#0f2736!important;color:#d9edf6!important;font-size:7px!important;font-weight:900!important}
      .app-bottom-item-sheet button.active{border-color:#83eaff!important;background:linear-gradient(145deg,#246681,#17475e)!important;color:#fff!important;box-shadow:0 0 16px rgba(83,211,242,.24)!important}
      .app-bottom-nav button span{font-size:19px;line-height:1}.app-bottom-nav button b{font-size:10px;line-height:1.15;max-width:100%;text-align:center;white-space:nowrap}
      .app-bottom-nav .app-main-label{font-size:8px;line-height:1.1;color:#b8dce9;letter-spacing:.1em}
      .miv5-launcher-item.analysis:focus-within{outline:1px solid #9ae9ff;outline-offset:3px}
      .app-bottom-nav button.active{background:#172235;color:#8feaff}.app-bottom-nav button.active b{color:#fff}
      .app-bottom-nav button.note-exit{color:#8feaff;border-left:1px solid rgba(43,57,76,.45)}
      .app-bottom-nav button.note-exit b{color:#c9f4ff}
      @media(min-width:760px){.app-bottom-nav{bottom:12px;border:1px solid #2b394c;border-radius:18px;padding-bottom:6px;width:460px}.app-route-shell{padding-bottom:104px}}
    `}</style>
  </>;
}

function MaintenanceScreen() {
  return <main className="insight-maintenance" role="status" aria-live="polite">
    <section>
      <small>INSIGHT / SYSTEM MAINTENANCE</small>
      <h1>システムメンテナンス中</h1>
      <p>現在、データ基盤の緊急メンテナンスを行っています。</p>
      <p>参加者情報・保存済み履歴は保持されています。復旧までしばらくお待ちください。</p>
      <strong>ご利用中の皆さまにはご不便をおかけします。</strong>
    </section>
    <style>{`
      .insight-maintenance{min-height:100dvh;display:grid;place-items:center;padding:24px;background:radial-gradient(circle at 50% 18%,#173142 0,#0a1722 38%,#050a10 100%);color:#eef8ff;font-family:system-ui,-apple-system,"Segoe UI",sans-serif}
      .insight-maintenance section{width:min(620px,100%);padding:28px 22px;border:1px solid #38566d;border-radius:18px;background:rgba(7,17,26,.94);box-shadow:0 18px 48px rgba(0,0,0,.36);text-align:center}
      .insight-maintenance small{display:block;color:#79d8ef;font-weight:900;letter-spacing:.12em;font-size:10px}
      .insight-maintenance h1{margin:10px 0 16px;font-size:clamp(28px,8vw,46px);line-height:1.08}
      .insight-maintenance p{margin:8px 0;color:#b8c9d8;font-size:14px;line-height:1.75}
      .insight-maintenance strong{display:block;margin-top:20px;padding-top:16px;border-top:1px solid #253a4a;color:#dff8ff;font-size:13px}
    `}</style>
  </main>;
}

export function App() {
  useInsightDisplayMode();
  const [route, setRoute] = useState(currentRoute);
  const [memberToken, setMemberToken] = useState(initialMemberToken);
  const [validatedMemberToken, setValidatedMemberToken] = useState("");
  const [checkingMember, setCheckingMember] = useState(false);

  useEffect(() => {
    const sync = () => {
      const next = localStorage.getItem(MEMBER_KEY) || restoreStoredMemberSession()?.memberToken || "";
      setMemberToken(next);
    };
    window.addEventListener("mumei-insight-accounts", sync);
    window.addEventListener("storage", sync);
    window.addEventListener("pageshow", sync);
    window.addEventListener("focus", sync);
    return () => {
      window.removeEventListener("mumei-insight-accounts", sync);
      window.removeEventListener("storage", sync);
      window.removeEventListener("pageshow", sync);
      window.removeEventListener("focus", sync);
    };
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    const installed = url.searchParams.get("notificationInstalled");
    if (installed) localStorage.setItem(NOTIFICATION_TOOL_VERSION_KEY, installed);
    const synced = url.searchParams.get("notificationAutoSynced");
    if (synced !== null) {
      const result = {
        ok: synced === "1",
        noteId: url.searchParams.get("notificationNoteId") || "",
        error: url.searchParams.get("notificationAutoError") || "",
        at: Number(url.searchParams.get("notificationAutoAt") || Date.now()),
        savedAt: Number(url.searchParams.get("notificationAutoSavedAt") || 0),
        boundaryLabel: url.searchParams.get("notificationBoundaryLabel") || "",
      };
      localStorage.setItem(NOTIFICATION_AUTO_RESULT_KEY, JSON.stringify(result));
      sessionStorage.setItem(NOTIFICATION_AUTO_ONCE_KEY, "1");
      for (const key of ["notificationAutoSynced", "notificationNoteId", "notificationAutoError", "notificationAutoAt", "notificationAutoSavedAt", "notificationBoundaryLabel", "notificationInstalled", "notificationCheckedAt"]) url.searchParams.delete(key);
      window.history.replaceState(window.history.state, "", url.toString());
    }
  }, []);

  useEffect(() => {
    // v3.6.1 safe mode: never move participants between INSIGHT and note automatically.
    sessionStorage.setItem(NOTIFICATION_AUTO_ONCE_KEY, "1");
  }, []);

  useEffect(() => {
    const update = () => {
      const raw = rawRoute();
      if (DETACHED_ROUTES.has(raw) || raw.startsWith("catalog/")) {
        window.history.replaceState({ route: "home" }, "", routeUrl("home"));
        sessionStorage.removeItem(OWNER_VIEW_KEY);
        setRoute("home");
        return;
      }
      const next = currentRoute();
      if (next.startsWith("owner-features/")) sessionStorage.setItem(OWNER_VIEW_KEY, "1");
      if (next === "access/insight" || next === "home" || next === "dashboard" || next === "owner-insight" || next === "manage") sessionStorage.removeItem(OWNER_VIEW_KEY);
      setRoute(next);
    };
    update();
    window.addEventListener("hashchange", update);
    window.addEventListener("popstate", update);
    window.addEventListener("mumei-route", update);
    return () => {
      window.removeEventListener("hashchange", update);
      window.removeEventListener("popstate", update);
      window.removeEventListener("mumei-route", update);
    };
  }, []);

  const ownerToken = localStorage.getItem(OWNER_KEY) || "";
  const needsMember = memberRoute(route);
  useEffect(() => {
    let cancelled = false;
    if (!needsMember || !memberToken) { setCheckingMember(false); if (!memberToken) setValidatedMemberToken(""); return; }
    if (validatedMemberToken === memberToken) { setCheckingMember(false); return; }
    setCheckingMember(true);
    const c = new AbortController();
    const timer = window.setTimeout(() => c.abort(), 20_000);

    async function recoverExpiredSession(code: string) {
      if (!isSessionInvalid(code)) return "";
      const account = readStoredInsightAccounts().find((item) => item.memberToken === memberToken);
      if (!account?.applicantToken) return "";
      try {
        const response = await fetch(REACTIVATE_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Insight-Applicant": account.applicantToken },
          body: JSON.stringify({ action: "resume" }),
          cache: "no-store",
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload?.ok === false || !payload?.memberToken) return "";
        if (payload?.applicantToken) rememberApplicant(payload.application, payload.applicantToken);
        rememberMemberSession(payload.application, payload.memberToken, account.passcode);
        return String(payload.memberToken);
      } catch {
        return "";
      }
    }

    void (async () => {
      try {
        const response = await fetch(ACCESS_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Insight-Token": memberToken },
          body: JSON.stringify({ action: "session" }),
          cache: "no-store",
          signal: c.signal,
        });
        const payload = await response.json().catch(() => ({}));
        if (cancelled) return;
        if (response.ok && payload?.ok !== false) {
          setValidatedMemberToken(memberToken);
          return;
        }
        const code = String(payload?.error || `HTTP_${response.status}`);
        if (isSessionInvalid(code)) {
          const recovered = await recoverExpiredSession(code);
          if (cancelled) return;
          if (recovered) {
            setMemberToken(recovered);
            setValidatedMemberToken(recovered);
            return;
          }
          setValidatedMemberToken("");
          return;
        }
        if (isMembershipInactive(code)) {
          setValidatedMemberToken("");
          return;
        }
        // Temporary API/server failures must never log participants out.
        if (isTransientSessionError(code, response.status) || !response.ok) {
          setValidatedMemberToken(memberToken);
          return;
        }
        setValidatedMemberToken(memberToken);
      } catch {
        if (!cancelled) setValidatedMemberToken(memberToken);
      } finally {
        window.clearTimeout(timer);
        if (!cancelled) setCheckingMember(false);
      }
    })();

    return () => { cancelled = true; window.clearTimeout(timer); c.abort(); };
  }, [memberToken, needsMember, validatedMemberToken]);

  const ownerView = Boolean(ownerToken) && sessionStorage.getItem(OWNER_VIEW_KEY) === "1";
  const memberValid = Boolean(memberToken && validatedMemberToken === memberToken);
  useEffect(() => {
    if (route !== "dashboard" || !memberValid || checkingMember) return;
    return focusMainAnalysis();
  }, [route, memberValid, checkingMember]);
  let page;
  if (needsMember && memberToken && !memberValid && checkingMember) page = <InsightSessionTransition />;
  else if (route === "access/insight") page = <AccessPortalV6 />;
  else if (route === "owner") page = <OwnerGate />;
  else if (route === "manage") page = <ManagementPage />;
  else if (route === "owner-insight") page = memberValid ? <MemberInsightLiveV2 /> : <AccessPortalV6 />;
  else if (route.startsWith("owner-features/")) page = ownerToken ? <FeaturePage slug={route.slice("owner-features/".length)} /> : <OwnerGate />;
  else if (route === "dashboard") page = memberValid ? <MemberInsightLiveV2 /> : <AccessPortalV6 />;
  else if (route === "evidence") page = ownerView ? <EvidenceV2 /> : memberValid ? <MemberInsightLiveV2 /> : <AccessPortalV6 />;
  else if (route === "article-likes") page = ownerView ? <ArticleLikesPageV2 /> : memberValid ? <MemberInsightLiveV2 /> : <AccessPortalV6 />;
  else if (route === "dashboard-legacy") page = ownerView ? <CombinedAnalyticsApp /> : memberValid ? <MemberInsightLiveV2 /> : <AccessPortalV6 />;
  else if (route.startsWith("features/")) page = ownerView ? <FeaturePage slug={route.slice("features/".length)} /> : memberValid ? <MemberInsightLiveV2 /> : <AccessPortalV6 />;
  else page = <HubHome />;

  const admin = isAdminRoute(route) || ownerView;
  const maintenanceBypass = route === "owner" || route === "manage" || route.startsWith("owner-features/") || ownerView;
  if (PARTICIPANT_MAINTENANCE && !maintenanceBypass) return <MaintenanceScreen />;
  const hideBottomNav = route.startsWith("access/") || admin || checkingMember;
  return <>
    <style>{SESSION_TRANSITION_CSS}</style>
    <div className={`app-route-shell ${ownerView ? "is-owner" : "is-member"} ${admin ? "is-admin" : ""} ${route==="dashboard"?"is-dashboard":""} ${checkingMember?"is-session-check":"is-ready"}`}><div key={route} className="app-route-light" aria-hidden="true"/><div className="app-route-page">{page}</div></div>
    {hideBottomNav ? null : <BottomNav route={route} />}
  </>;
}
