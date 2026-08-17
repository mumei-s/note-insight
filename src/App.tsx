import { useEffect, useState } from "react";
import { AccessPortal } from "./access-portal";
import { BattleArenaPage } from "./battle-arena-page";
import { CatalogAdminV2 } from "./catalog-admin-v2";
import { CatalogIconsPage } from "./catalog-icons-page";
import { CombinedAnalyticsApp } from "./combined-analytics-app";
import { EvidenceV2 } from "./evidence-v2";
import { FastInsightV3 } from "./fast-insight-v3";
import { FeaturePage } from "./feature-page";
import { GameAdminPage } from "./game-admin-page";
import { HubHome } from "./hub-home";
import { InsightAdminV2 } from "./insight-admin-v2";
import { MemberPortal } from "./member-portal";
import { OwnerGate } from "./owner-gate";
import { OwnerHub } from "./owner-hub";

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
  if (route === "evidence") return <EvidenceV2 />;
  if (route === "owner") return <OwnerGate />;
  if (route === "manage") return <OwnerHub />;
  if (route === "catalog-admin") return <CatalogAdminV2 />;
  if (route === "insight-admin") return <InsightAdminV2 />;
  if (route === "member") return <MemberPortal />;
  if (route === "dashboard") return <FastInsightV3 />;
  if (route === "dashboard-legacy") return <CombinedAnalyticsApp />;
  if (route.startsWith("features/")) return <FeaturePage slug={route.slice("features/".length)} />;
  return <HubHome />;
}
