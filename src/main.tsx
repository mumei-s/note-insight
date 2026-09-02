import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { installApiBridge, registerServiceWorker } from "./api";
import { INSIGHT_TOKEN_KEY } from "./insight-account-store";
import "./styles.css";

const SELF_ACCOUNT = "https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-self-account";

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
