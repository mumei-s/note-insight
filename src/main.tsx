import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { installApiBridge, registerServiceWorker } from "./api";
import { INSIGHT_TOKEN_KEY } from "./insight-account-store";
import "./styles.css";

const SELF_ACCOUNT = "https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-self-account";
const initialUrl = new URL(window.location.href);
const rawInitialRoute = window.location.hash.replace(/^#\/?/, "");
const adminDirect = rawInitialRoute === "owner" || rawInitialRoute === "manage" || rawInitialRoute === "owner-insight" || rawInitialRoute.startsWith("owner-features/");
const pwaTopLaunch = initialUrl.searchParams.get("launch") === "top";

// Distribution/PWA launches always start at the public TOP.
// Explicit OWNER deep links remain available when they are opened directly.
if (pwaTopLaunch || (rawInitialRoute && !adminDirect)) {
  const clean = new URL(window.location.href);
  clean.hash = "";
  clean.searchParams.delete("launch");
  window.history.replaceState({ route: "home" }, "", clean.toString());
}

installApiBridge();
registerServiceWorker();

const insightToken = localStorage.getItem(INSIGHT_TOKEN_KEY) || "";
if (insightToken) {
  void fetch(SELF_ACCOUNT, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Insight-Token": insightToken },
    body: JSON.stringify({ action: "touch" }),
    cache: "no-store",
  }).catch(() => { /* Long-session refresh must never block app startup. */ });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
