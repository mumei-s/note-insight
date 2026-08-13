import { useEffect, useState } from "react";
import { FeaturePage } from "./feature-page";
import { InsightApp } from "./insight-app";
import { MemberPortal } from "./member-portal";
import { PublicHome } from "./public-home";

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

  if (route === "member") return <MemberPortal />;
  if (route === "dashboard") return <InsightApp />;
  if (route.startsWith("features/")) {
    return <FeaturePage slug={route.slice("features/".length)} />;
  }
  return <PublicHome initialLoginOpen={false} />;
}
