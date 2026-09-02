import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { installApiBridge, registerServiceWorker } from "./api";
import { INSIGHT_TOKEN_KEY } from "./insight-account-store";
import "./styles.css";

const SELF_ACCOUNT = "https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-self-account";
const initialUrl = new URL(window.location.href);
const pwaTopLaunch = initialUrl.searchParams.get("launch") === "top";

// Only an explicit PWA/distribution launch marker forces the public TOP.
// Browser back/forward and explicit INSIGHT deep links such as #dashboard must keep their route and session.
if (pwaTopLaunch) {
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
