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

const OWNER_KEY = "mumei-unified-owner-token";
const OWNER_VIEW_KEY = "mumei-owner-insight-view";
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

export function goTo(route: string) {
  const next = route || "home";
  if (currentRoute() === next) { window.scrollTo({ top: 0, behavior: "auto" }); return; }
  window.history.pushState({ route: next }, "", routeUrl(next));
  window.dispatchEvent(new Event("mumei-route"));
  window.scrollTo({ top: 0, behavior: "auto" });
}

function BottomNav({ route }: { route: string }) {
  const insightActive = route === "access/insight" || PARTICIPANT_CHILD_ROUTES.has(route) || route.startsWith("features/");
  return <>
    <nav className="app-bottom-nav" aria-label="メインナビゲーション">
      <button className={route === "home" ? "active" : ""} onClick={() => goTo("home")}><span aria-hidden="true">⌂</span><b>TOP</b></button>
      <button className={insightActive ? "active" : ""} onClick={() => goTo("access/insight")}><span aria-hidden="true">◫</span><b>INSIGHT</b></button>
    </nav>
    <style>{`
      html{scroll-padding-bottom:calc(96px + env(safe-area-inset-bottom,0px))}
      .app-route-shell{min-height:100vh;padding-bottom:calc(96px + env(safe-area-inset-bottom,0px))}
      .app-route-shell>*{scroll-margin-bottom:calc(96px + env(safe-area-inset-bottom,0px))}
      .app-route-shell.is-member .iv8-apprefresh{display:none!important}
      .app-route-shell.is-admin{padding-bottom:24px!important}.app-route-shell.is-admin>*{scroll-margin-bottom:0!important}
      .app-bottom-nav{position:fixed;left:50%;bottom:0;transform:translateX(-50%);z-index:9999;width:min(720px,100%);display:grid;grid-template-columns:repeat(2,1fr);gap:0;padding:6px 8px calc(6px + env(safe-area-inset-bottom,0px));background:rgba(7,10,16,.96);backdrop-filter:blur(16px);border-top:1px solid #2b394c;box-shadow:0 -10px 30px rgba(0,0,0,.28)}
      .app-bottom-nav button{min-width:0;min-height:54px;border:0;background:transparent;color:#8796aa;display:grid;place-items:center;align-content:center;gap:2px;font:inherit;border-radius:12px}
      .app-bottom-nav button span{font-size:19px;line-height:1}.app-bottom-nav button b{font-size:10px;line-height:1.15;white-space:nowrap}
      .app-bottom-nav button.active{background:#172235;color:#8feaff}.app-bottom-nav button.active b{color:#fff}
      @media(min-width:760px){.app-bottom-nav{bottom:12px;border:1px solid #2b394c;border-radius:16px;padding-bottom:6px;width:320px}.app-route-shell{padding-bottom:94px}}
    `}</style>
  </>;
}

export function App() {
  const [route, setRoute] = useState(currentRoute);

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
  const memberToken = localStorage.getItem("mumei-insight-access-token") || "";
  const ownerView = Boolean(ownerToken) && sessionStorage.getItem(OWNER_VIEW_KEY) === "1";
  let page;
  if (route === "access/insight") page = <AccessPortalV6 />;
  else if (route === "owner") page = <OwnerGate />;
  else if (route === "manage") page = <ManagementPage />;
  else if (route === "owner-insight") page = memberToken ? <MemberInsightLiveV2 /> : <AccessPortalV6 />;
  else if (route.startsWith("owner-features/")) page = ownerToken ? <FeaturePage slug={route.slice("owner-features/".length)} /> : <OwnerGate />;
  else if (route === "dashboard") page = <MemberInsightLiveV2 />;
  else if (route === "evidence") page = ownerView ? <EvidenceV2 /> : <MemberInsightLiveV2 />;
  else if (route === "article-likes") page = ownerView ? <ArticleLikesPageV2 /> : <MemberInsightLiveV2 />;
  else if (route === "dashboard-legacy") page = ownerView ? <CombinedAnalyticsApp /> : <MemberInsightLiveV2 />;
  else if (route.startsWith("features/")) page = ownerView ? <FeaturePage slug={route.slice("features/".length)} /> : <MemberInsightLiveV2 />;
  else page = <HubHome />;

  const admin = isAdminRoute(route) || ownerView;
  const hideBottomNav = route.startsWith("access/") || admin;
  return <>
    <div className={`app-route-shell ${ownerView ? "is-owner" : "is-member"} ${admin ? "is-admin" : ""}`}>{page}</div>
    {hideBottomNav ? null : <BottomNav route={route} />}
  </>;
}
