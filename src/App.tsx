import { useEffect, useState } from "react";
import { AccessPortal } from "./access-portal";
import { ArticleLikesPageV2 } from "./article-likes-page-v2";
import { BattleArenaPage } from "./battle-arena-page";
import { CatalogAdminV2 } from "./catalog-admin-v2";
import { CatalogIconsPage } from "./catalog-icons-page";
import { CombinedAnalyticsApp } from "./combined-analytics-app";
import { EvidenceV2 } from "./evidence-v2";
import { FastInsightV8 } from "./fast-insight-v8";
import "./fast-insight-v6-override.css";
import { FeaturePage } from "./feature-page";
import { GameAdminPage } from "./game-admin-page";
import { HubHome } from "./hub-home";
import { InsightAdminV2 } from "./insight-admin-v2";
import { MemberPortal } from "./member-portal";
import { OwnerGate } from "./owner-gate";
import { OwnerHub } from "./owner-hub";

const OWNER_KEY = "mumei-unified-owner-token";

function currentRoute() {
  return window.location.hash.replace(/^#\/?/, "") || "home";
}

export function goTo(route: string) {
  window.location.hash = route === "home" ? "" : route;
  window.scrollTo({ top: 0, behavior: "auto" });
}

function BottomNav({ route }: { route: string }) {
  const items = [
    { route: "home", label: "TOP", icon: "⌂" },
    { route: "dashboard", label: "INSIGHT", icon: "◫" },
    { route: "catalog", label: "名鑑", icon: "▦" },
    { route: "battle", label: "ゲーム", icon: "◆" },
  ];
  return (
    <>
      <nav className="app-bottom-nav" aria-label="メインナビゲーション">
        {items.map((item) => {
          const active = route === item.route || (item.route === "dashboard" && ["evidence", "article-likes"].includes(route));
          return (
            <button key={item.route} className={active ? "active" : ""} onClick={() => goTo(item.route)}>
              <span aria-hidden="true">{item.icon}</span>
              <b>{item.label}</b>
            </button>
          );
        })}
      </nav>
      <style>{`
        .app-route-shell{min-height:100vh;padding-bottom:calc(72px + env(safe-area-inset-bottom,0px))}
        .app-route-shell.is-member .iv8-apprefresh{display:none!important}
        .app-bottom-nav{position:fixed;left:50%;bottom:0;transform:translateX(-50%);z-index:9999;width:min(720px,100%);display:grid;grid-template-columns:repeat(4,1fr);gap:0;padding:6px 8px calc(6px + env(safe-area-inset-bottom,0px));background:rgba(7,10,16,.96);backdrop-filter:blur(16px);border-top:1px solid #2b394c;box-shadow:0 -10px 30px rgba(0,0,0,.28)}
        .app-bottom-nav button{min-width:0;min-height:54px;border:0;background:transparent;color:#8796aa;display:grid;place-items:center;align-content:center;gap:2px;font:inherit;border-radius:12px}
        .app-bottom-nav button span{font-size:19px;line-height:1}.app-bottom-nav button b{font-size:10px;line-height:1.15;white-space:nowrap}
        .app-bottom-nav button.active{background:#172235;color:#8feaff}.app-bottom-nav button.active b{color:#fff}
        @media(min-width:760px){.app-bottom-nav{bottom:12px;border:1px solid #2b394c;border-radius:16px;padding-bottom:6px;width:420px}.app-route-shell{padding-bottom:84px}}
      `}</style>
    </>
  );
}

export function App() {
  const [route, setRoute] = useState(currentRoute);
  useEffect(() => {
    const update = () => setRoute(currentRoute());
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);

  let page;
  if (route === "access/insight") page = <AccessPortal target="insight" />;
  else if (route === "access/catalog") page = <AccessPortal target="catalog" />;
  else if (route === "catalog") page = <CatalogIconsPage />;
  else if (route === "battle") page = <BattleArenaPage />;
  else if (route === "game-admin") page = <GameAdminPage />;
  else if (route === "evidence") page = <EvidenceV2 />;
  else if (route === "article-likes") page = <ArticleLikesPageV2 />;
  else if (route === "owner") page = <OwnerGate />;
  else if (route === "manage") page = <OwnerHub />;
  else if (route === "catalog-admin") page = <CatalogAdminV2 />;
  else if (route === "insight-admin") page = <InsightAdminV2 />;
  else if (route === "member") page = <MemberPortal />;
  else if (route === "dashboard") page = <FastInsightV8 />;
  else if (route === "dashboard-legacy") page = <CombinedAnalyticsApp />;
  else if (route.startsWith("features/")) page = <FeaturePage slug={route.slice("features/".length)} />;
  else page = <HubHome />;

  const hideBottomNav = route.startsWith("access/") || route === "owner";
  const isOwner = Boolean(localStorage.getItem(OWNER_KEY));
  return <><div className={`app-route-shell ${isOwner ? "is-owner" : "is-member"}`}>{page}</div>{hideBottomNav ? null : <BottomNav route={route} />}</>;
}
