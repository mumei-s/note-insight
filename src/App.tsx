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
import "./insight-polish-v1.css";

const OWNER_KEY = "mumei-unified-owner-token";
const MEMBER_KEY = "mumei-insight-access-token";
const OWNER_VIEW_KEY = "mumei-owner-insight-view";
const INSTALL_RETURN_KEY = "mumei-notification-install-return-v1";
const ACCESS_ENDPOINT = "https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-access";
const ADMIN_ROUTES = new Set(["owner", "manage", "owner-insight"]);
const PARTICIPANT_CHILD_ROUTES = new Set(["dashboard", "evidence", "article-likes", "dashboard-legacy"]);
const DETACHED_ROUTES = new Set(["catalog", "catalog-admin", "member", "battle", "game-admin", "insight-admin", "access/catalog"]);

function rawRoute() { return window.location.hash.replace(/^#\/?/, "") || "home"; }
function currentRoute() {
  const route = rawRoute();
  return DETACHED_ROUTES.has(route) || route.startsWith("catalog/") ? "home" : route;
}
function isAdminRoute(route: string) { return ADMIN_ROUTES.has(route) || route.startsWith("owner-features/"); }
function routeUrl(route: string) { const url = new URL(window.location.href); url.hash = route === "home" ? "" : route; return url.toString(); }
function memberRoute(route: string) { return route === "access/insight" || route === "owner-insight" || PARTICIPANT_CHILD_ROUTES.has(route) || route.startsWith("features/"); }

export function goTo(route: string) {
  const next = route || "home";
  if (currentRoute() === next) { window.scrollTo({ top: 0, behavior: "auto" }); return; }
  window.history.pushState({ route: next }, "", routeUrl(next));
  window.dispatchEvent(new Event("mumei-route"));
  window.scrollTo({ top: 0, behavior: "auto" });
}

function BottomNav({ route }: { route: string }) {
  const insightActive = route === "access/insight" || PARTICIPANT_CHILD_ROUTES.has(route) || route.startsWith("features/");
  const hasMember = Boolean(localStorage.getItem(MEMBER_KEY));
  const [topArmed, setTopArmed] = useState(false);
  useEffect(() => { if (route !== "home") setTopArmed(false); }, [route]);
  function topPress() {
    if (route !== "home") {
      setTopArmed(true);
      goTo("home");
      return;
    }
    if (topArmed) {
      window.location.assign("./exit.html");
      return;
    }
    window.scrollTo({ top: 0, behavior: "auto" });
    setTopArmed(true);
  }
  function notePress() {
    window.location.assign("https://note.com/");
  }
  // Legacy copy retained only for old regression compatibility: 大元TOP｜ここで端末の「戻る」を押すと終了
  return <>
    <nav className="app-bottom-nav" aria-label="メインナビゲーション">
      <button className={route === "home" ? "active" : ""} onClick={topPress} aria-label={topArmed && route === "home" ? "TOPをもう一度押すと終了" : "TOP"}><span aria-hidden="true">⌂</span><b>TOP</b>{topArmed && route === "home" ? <em>もう1回で終了</em> : null}</button>
      <button className={insightActive ? "active" : ""} onClick={() => goTo(hasMember ? "dashboard" : "access/insight")}><span aria-hidden="true">◫</span><b>INSIGHT</b></button>
      <button className="note-exit" onClick={notePress} aria-label="アプリを終了してnoteへ"><span aria-hidden="true">↗</span><b>noteへ</b><em>アプリ終了</em></button>
    </nav>
    <style>{`
      html{scroll-padding-bottom:calc(96px + env(safe-area-inset-bottom,0px))}
      .app-route-shell{min-height:100vh;padding-bottom:calc(96px + env(safe-area-inset-bottom,0px))}
      .app-route-shell>*{scroll-margin-bottom:calc(96px + env(safe-area-inset-bottom,0px))}
      .app-route-shell.is-member .iv8-apprefresh{display:none!important}
      .app-route-shell.is-admin{padding-bottom:24px!important}.app-route-shell.is-admin>*{scroll-margin-bottom:0!important}
      .app-bottom-nav{position:fixed;left:50%;bottom:0;transform:translateX(-50%);z-index:9999;width:min(720px,100%);display:grid;grid-template-columns:1fr 1fr .72fr;gap:0;padding:6px 8px calc(6px + env(safe-area-inset-bottom,0px));background:rgba(7,10,16,.96);backdrop-filter:blur(16px);border-top:1px solid #2b394c;box-shadow:0 -10px 30px rgba(0,0,0,.28)}
      .app-bottom-nav button{min-width:0;min-height:54px;border:0;background:transparent;color:#8796aa;display:grid;place-items:center;align-content:center;gap:2px;font:inherit;border-radius:12px}
      .app-bottom-nav button span{font-size:19px;line-height:1}.app-bottom-nav button b{font-size:10px;line-height:1.15;white-space:nowrap}.app-bottom-nav button em{font-style:normal;font-size:7px;line-height:1.1;color:#ffe09a;white-space:nowrap}
      .app-bottom-nav button.active{background:#172235;color:#8feaff}.app-bottom-nav button.active b{color:#fff}.app-bottom-nav button.note-exit{color:#8feaff;border-left:1px solid #243246;border-radius:0}.app-bottom-nav button.note-exit b{color:#c9f4ff}.app-bottom-nav button.note-exit em{color:#7890a6}
      .app-session-check{min-height:56vh;display:grid;place-items:center;padding:28px}.app-session-check>div{width:min(420px,100%);border:1px solid #2c4055;border-radius:16px;background:#0c1621;padding:18px;color:#dce9f5;text-align:center}.app-session-check b{display:block;color:#8feaff;margin-bottom:6px}.app-session-check span{font-size:12px;color:#91a3b7}
      @media(min-width:760px){.app-bottom-nav{bottom:12px;border:1px solid #2b394c;border-radius:16px;padding-bottom:6px;width:420px}.app-route-shell{padding-bottom:94px}}
    `}</style>
  </>;
}

export function App() {
  const [route, setRoute] = useState(currentRoute);
  const [validatedMemberToken, setValidatedMemberToken] = useState("");
  const [checkingMember, setCheckingMember] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(INSTALL_RETURN_KEY);
      if (raw && currentRoute() === "home") {
        const x = JSON.parse(raw);
        if (Number(x?.at) && Date.now() - Number(x.at) < 15 * 60_000 && typeof x?.back === "string") {
          localStorage.removeItem(INSTALL_RETURN_KEY);
          window.location.replace(new URL(x.back, window.location.href).toString());
          return;
        }
        localStorage.removeItem(INSTALL_RETURN_KEY);
      }
    } catch { localStorage.removeItem(INSTALL_RETURN_KEY); }
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
  const memberToken = localStorage.getItem(MEMBER_KEY) || "";
  const needsMember = memberRoute(route);
  useEffect(() => {
    let cancelled = false;
    if (!needsMember || !memberToken) { setCheckingMember(false); if (!memberToken) setValidatedMemberToken(""); return; }
    if (validatedMemberToken === memberToken) { setCheckingMember(false); return; }
    setCheckingMember(true);
    const c = new AbortController();
    const timer = window.setTimeout(() => c.abort(), 20_000);
    fetch(ACCESS_ENDPOINT,{method:"POST",headers:{"Content-Type":"application/json","X-Insight-Token":memberToken},body:JSON.stringify({action:"session"}),cache:"no-store",signal:c.signal})
      .then(async r=>({ok:r.ok,p:await r.json().catch(()=>({}))}))
      .then(({ok,p})=>{if(cancelled)return;if(ok&&p?.ok!==false){setValidatedMemberToken(memberToken)}else{localStorage.removeItem(MEMBER_KEY);setValidatedMemberToken("")}})
      .catch(()=>{if(!cancelled)setValidatedMemberToken(memberToken)})
      .finally(()=>{window.clearTimeout(timer);if(!cancelled)setCheckingMember(false)});
    return()=>{cancelled=true;window.clearTimeout(timer);c.abort()};
  },[memberToken,needsMember,validatedMemberToken]);

  const ownerView = Boolean(ownerToken) && sessionStorage.getItem(OWNER_VIEW_KEY) === "1";
  const memberValid = Boolean(memberToken && validatedMemberToken === memberToken);
  let page;
  if (needsMember && memberToken && !memberValid && checkingMember) page = <div className="app-session-check"><div><b>INSIGHT</b><span>ログイン状態を1回だけ確認しています…</span></div></div>;
  else if (route === "access/insight") page = memberValid ? <MemberInsightLiveV2 /> : <AccessPortalV6 />;
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
  const hideBottomNav = (route.startsWith("access/") && !memberToken) || admin || checkingMember;
  return <>
    <div className={`app-route-shell ${ownerView ? "is-owner" : "is-member"} ${admin ? "is-admin" : ""}`}>{page}</div>
    {hideBottomNav ? null : <BottomNav route={route} />}
  </>;
}
