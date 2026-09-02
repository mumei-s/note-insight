import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { installApiBridge, registerServiceWorker } from "./api";
import { INSIGHT_TOKEN_KEY } from "./insight-account-store";
import "./styles.css";

const SELF_ACCOUNT = "https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-self-account";
const rawInitialRoute = window.location.hash.replace(/^#\/?/, "");
const adminDirect = rawInitialRoute === "owner" || rawInitialRoute === "manage" || rawInitialRoute === "owner-insight" || rawInitialRoute.startsWith("owner-features/");

// The distributed participant URL always starts at the public TOP.
// Internal navigation after startup still uses history/hash without reload.
if (rawInitialRoute && !adminDirect) {
  const clean = new URL(window.location.href);
  clean.hash = "";
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
