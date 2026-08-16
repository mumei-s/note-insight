import { useEffect, useState } from "react";
import { AccessPortal } from "./access-portal";
import { BattleArenaPage } from "./battle-arena-page";
import { CatalogIconsPage } from "./catalog-icons-page";
import { CombinedAnalyticsApp } from "./combined-analytics-app";
import { EvidencePage } from "./evidence-page";
import { FastInsightV2 } from "./fast-insight-v2";
import { FeaturePage } from "./feature-page";
import { GameAdminPage } from "./game-admin-page";
import { HubHome } from "./hub-home";
import { ManagementPage } from "./management-page";
import { MemberPortal } from "./member-portal";

function currentRoute() {
  return window.location.hash.replace(/^#\/?/, "") || "home";
}

export function goTo(route: string) {
  window.location.hash = route === "home" ? "" : route;
  window.scrollTo({ top: 0, behavior: "auto" });
}

export function App() {
  const [route, setRoute] = useState(currentRoute);
  useEffect(() => {
    const update = () => setRoute(currentRoute());
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  if (route === "access/insight") return <AccessPortal target="insight" />;
  if (route === "access/catalog") return <AccessPortal target="catalog" />;
  if (route === "catalog") return <CatalogIconsPage />;
  if (route === "battle") return <BattleArenaPage />;
  if (route === "game-admin") return <GameAdminPage />;
  if (route === "evidence") return <EvidencePage />;
  if (route === "manage" || route === "catalog-admin" || route.startsWith("manage/")) return <ManagementPage />;
  if (route === "member") return <MemberPortal />;
  if (route === "dashboard") return <FastInsightV2 />;
  if (route === "dashboard-legacy") return <CombinedAnalyticsApp />;
  if (route.startsWith("features/")) return <FeaturePage slug={route.slice("features/".length)} />;
  return <HubHome />;
}
