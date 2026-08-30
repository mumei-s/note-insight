import { useEffect, useRef, useState } from "react";
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
const ADMIN_ROUTES = new Set(["owner", "manage", "catalog-admin", "insight-admin", "game-admin"]);
const INSIGHT_CHILD_ROUTES = new Set(["evidence", "article-likes", "dashboard-legacy"]);

function currentRoute() {
  return window.location.hash.replace(/^#\/?/, "") || "home";
}

function isAdminRoute(route: string) {
  return ADMIN_ROUTES.has(route);
}

function catalogNoteId(route: string) {
  if (!route.startsWith("catalog/")) return undefined;
  try { return decodeURIComponent(route.slice("catalog/".length)); }
  catch { return undefined; }
}

function routeUrl(route: string) {
  const url = new URL(window.location.href);
  url.hash = route === "home" ? "" : route;
  return url.toString();
}

function backTarget(route: string) {
  if (route.startsWith("catalog/") || route === "member") return "catalog";
  if (INSIGHT_CHILD_ROUTES.has(route) || route.startsWith("features/")) return "dashboard";
  if (route === "dashboard" || route === "catalog" || route === "battle") return "home";
  if (route.startsWith("access/")) return "home";
  return "home";
}

export function goTo(route: string) {
  const next = route === "" ? "home" : route;
  if (currentRoute() === next) {
    window.scrollTo({ top: 0, behavior: "auto" });
    return;
  }
  window.history.pushState({ mumeiGuard: true, route: next }, "", routeUrl(next));
  window.dispatchEvent(new Event("mumei-route"));
  window.scrollTo({ top: 0, behavior: "auto" });
}

function ExitDialog({ open, onCancel, onExit }: { open: boolean; onCancel: () => void; onExit: () => void }) {
  if (!open) return null;
  return <div className="app-exit-backdrop" role="dialog" aria-modal="true" aria-labelledby="app-exit-title">
    <section className="app-exit-dialog">
      <small>CREATOR HUB</small>
      <h2 id="app-exit-title">終了しますか？</h2>
      <p>INSIGHT・名鑑・ゲームを終了します。</p>
      <div><button onClick={onCancel}>キャンセル</button><button className="danger" onClick={onExit}>終了</button></div>
    </section>
  </div>;
}

function BottomNav({ route, onExit }: { route: string; onExit: () => void }) {
  const items = [
    { route: "home", label: route === "home" ? "終了" : "TOP", icon: route === "home" ? "×" : "⌂" },
    { route: "dashboard", label: "INSIGHT", icon: "◫" },
    { route: "catalog", label: "名鑑", icon: "▦" },
    { route: "battle", label: "ゲーム", icon: "◆" },
  ];
  return <>
    <nav className="app-bottom-nav" aria-label="メインナビゲーション">
      {items.map((item) => {
        const active = route === item.route || (item.route === "catalog" && (route.startsWith("catalog/") || route === "member")) || (item.route === "dashboard" && (INSIGHT_CHILD_ROUTES.has(route) || route.startsWith("features/")));
        return <button key={item.route} className={active ? "active" : ""} onClick={() => item.route === "home" && route === "home" ? onExit() : goTo(item.route)}>
          <span aria-hidden="true">{item.icon}</span><b>{item.label}</b>
        </button>;
      })}
    </nav>
    <style>{`
      html{scroll-padding-bottom:calc(124px + env(safe-area-inset-bottom,0px))}
      .app-route-shell{min-height:100vh;padding-bottom:calc(124px + env(safe-area-inset-bottom,0px))}
      .app-route-shell>*{scroll-margin-bottom:calc(124px + env(safe-area-inset-bottom,0px))}
      .app-route-shell.is-member .iv8-apprefresh{display:none!important}
      .app-route-shell.is-admin{padding-bottom:24px!important}.app-route-shell.is-admin>*{scroll-margin-bottom:0!important}
      .app-bottom-nav{position:fixed;left:50%;bottom:0;transform:translateX(-50%);z-index:9999;width:min(720px,100%);display:grid;grid-template-columns:repeat(4,1fr);gap:0;padding:6px 8px calc(6px + env(safe-area-inset-bottom,0px));background:rgba(7,10,16,.96);backdrop-filter:blur(16px);border-top:1px solid #2b394c;box-shadow:0 -10px 30px rgba(0,0,0,.28)}
      .app-bottom-nav button{min-width:0;min-height:54px;border:0;background:transparent;color:#8796aa;display:grid;place-items:center;align-content:center;gap:2px;font:inherit;border-radius:12px}
      .app-bottom-nav button span{font-size:19px;line-height:1}.app-bottom-nav button b{font-size:10px;line-height:1.15;white-space:nowrap}
      .app-bottom-nav button.active{background:#172235;color:#8feaff}.app-bottom-nav button.active b{color:#fff}
      .app-exit-backdrop{position:fixed;z-index:12000;inset:0;display:grid;place-items:center;padding:20px;background:rgba(1,4,9,.78);backdrop-filter:blur(12px)}
      .app-exit-dialog{width:min(390px,100%);padding:24px;border:1px solid #3d4f67;border-radius:22px;background:linear-gradient(180deg,#111a28,#090e16);box-shadow:0 30px 90px rgba(0,0,0,.65);color:#f5f8fc;text-align:center}
      .app-exit-dialog small{color:#7fe8ff;font-weight:950;letter-spacing:.16em}.app-exit-dialog h2{font-size:28px;margin:8px 0}.app-exit-dialog p{color:#96a7ba}.app-exit-dialog>div{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:20px}
      .app-exit-dialog button{min-height:46px;border:1px solid #40536b;border-radius:12px;background:#132033;color:#dceaf7;font-weight:950}.app-exit-dialog button.danger{border-color:#7d3948;background:#3b1720;color:#ffbcc7}
      @media(min-width:760px){.app-bottom-nav{bottom:12px;border:1px solid #2b394c;border-radius:16px;padding-bottom:6px;width:420px}.app-route-shell{padding-bottom:108px}}
    `}</style>
  </>;
}

export function App() {
  const [route, setRoute] = useState(currentRoute);
  const [exitOpen, setExitOpen] = useState(false);
  const routeRef = useRef(route);
  const exitingRef = useRef(false);

  useEffect(() => { routeRef.current = route; }, [route]);

  useEffect(() => {
    const update = () => {
      const next = currentRoute();
      routeRef.current = next;
      setRoute(next);
      if (next !== "home") setExitOpen(false);
    };
    window.addEventListener("hashchange", update);
    window.addEventListener("mumei-route", update);

    if (!isAdminRoute(currentRoute()) && !window.history.state?.mumeiGuard) {
      window.history.replaceState({ mumeiBase: true, route: currentRoute() }, "", window.location.href);
      window.history.pushState({ mumeiGuard: true, route: currentRoute() }, "", window.location.href);
    }

    const onPopState = () => {
      if (exitingRef.current) return;
      const current = routeRef.current;
      if (isAdminRoute(current)) return;

      if (current === "battle") {
        const gameBack = document.querySelector<HTMLButtonElement>(".g5-active .mode-back");
        if (gameBack) {
          window.history.pushState({ mumeiGuard: true, route: "battle" }, "", routeUrl("battle"));
          gameBack.click();
          setExitOpen(false);
          window.scrollTo({ top: 0, behavior: "auto" });
          return;
        }
      }

      if (current === "home") {
        setExitOpen(true);
        window.history.pushState({ mumeiGuard: true, route: "home" }, "", routeUrl("home"));
        return;
      }

      const target = backTarget(current);
      window.history.replaceState({ mumeiGuard: true, route: target }, "", routeUrl(target));
      routeRef.current = target;
      setRoute(target);
      setExitOpen(false);
      window.scrollTo({ top: 0, behavior: "auto" });
    };
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("hashchange", update);
      window.removeEventListener("mumei-route", update);
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  function exitApp() {
    exitingRef.current = true;
    setExitOpen(false);
    window.location.replace(`${import.meta.env.BASE_URL}exit.html`);
  }

  let page;
  if (route === "access/insight") page = <AccessPortal target="insight" />;
  else if (route === "access/catalog") page = <AccessPortal target="catalog" />;
  else if (route === "catalog" || route.startsWith("catalog/")) page = <CatalogIconsPage initialNoteId={catalogNoteId(route)} />;
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

  const admin = isAdminRoute(route);
  const hideBottomNav = route.startsWith("access/") || admin;
  const isOwner = Boolean(localStorage.getItem(OWNER_KEY));
  return <>
    <div className={`app-route-shell ${isOwner ? "is-owner" : "is-member"} ${admin ? "is-admin" : ""}`}>{page}</div>
    {hideBottomNav ? null : <BottomNav route={route} onExit={() => setExitOpen(true)} />}
    <ExitDialog open={exitOpen} onCancel={() => setExitOpen(false)} onExit={exitApp} />
  </>;
}
