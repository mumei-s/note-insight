import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { installApiBridge, registerServiceWorker } from "./api";
import {
  EXPLICIT_LOGOUT_KEY_PREFIX,
  INSIGHT_TOKEN_KEY,
  currentStoredInsightAccount,
  getStoredInsightAccount,
  readStoredInsightAccounts,
  rememberApplication,
  rememberMemberSession,
} from "./insight-account-store";
import "./styles.css";
import "./insight-source-boundaries";

const SELF_ACCOUNT = "https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-self-account";
const ACCESS = "https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-access";
const REACTIVATE = "https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-access-reactivate";
const OWNER_KEY = "mumei-unified-owner-token";
const JOIN_NOTE_KEY = "mumei-insight-current-join-v5";
const OWNER_PENDING_SEEN_KEY = "mumei-owner-pending-seen-v1";
const ACCOUNT_ROUTE_REFRESH_KEY = "mumei-account-route-refresh-v1";
const initialUrl = new URL(window.location.href);
const pwaTopLaunch = initialUrl.searchParams.get("launch") === "top";
const requestedNotificationAccount = String(initialUrl.searchParams.get("notificationAccount") || "").trim().replace(/^@/, "").toLowerCase();
let memberResumeRunning = false;

// The public INSIGHT URL must stay inside INSIGHT. Notification capture runs from note itself;
// opening/reloading the app must never bounce the user to note or the installer.
sessionStorage.setItem("mumei-notification-auto-once-v2921", "1");

// Only an explicit PWA/distribution launch marker forces the public TOP.
// Browser back/forward and explicit INSIGHT deep links such as #dashboard must keep their route and session.
if (pwaTopLaunch) {
  const clean = new URL(window.location.href);
  clean.hash = "";
  clean.searchParams.delete("launch");
  window.history.replaceState({ route: "home" }, "", clean.toString());
}
if (!window.location.hash.includes("dashboard")) sessionStorage.removeItem(ACCOUNT_ROUTE_REFRESH_KEY);

installApiBridge();
registerServiceWorker();

function showAccessNotice(message: string) {
  let box = document.getElementById("mumei-access-notice");
  if (!box) {
    box = document.createElement("div");
    box.id = "mumei-access-notice";
    box.style.cssText = "position:fixed;left:50%;top:14px;transform:translateX(-50%);z-index:2147483600;width:min(92vw,560px);padding:12px 14px;border:1px solid #5c7d55;border-radius:14px;background:rgba(9,24,17,.97);color:#dfffe6;font:900 13px/1.45 system-ui;box-shadow:0 12px 34px rgba(0,0,0,.42);text-align:center";
    document.body.appendChild(box);
  }
  box.textContent = message;
  window.setTimeout(() => box?.remove(), 6500);
}

async function readJson(response: Response) {
  return response.json().catch(() => ({}));
}

function resumeCandidate() {
  const recoverableRoute = window.location.hash.includes("access/insight") || window.location.hash.includes("dashboard") || window.location.hash.includes("owner-insight");
  return recoverableRoute ? currentStoredInsightAccount() : null;
}

function resumeCandidates() {
  const out: ReturnType<typeof readStoredInsightAccounts> = [];
  const seen = new Set<string>();
  const add = (account: ReturnType<typeof getStoredInsightAccount> | null | undefined) => {
    if (!account?.noteId || seen.has(account.noteId)) return;
    seen.add(account.noteId);
    out.push(account);
  };
  const joinId = (localStorage.getItem(JOIN_NOTE_KEY) || "").trim().toLowerCase();
  if (requestedNotificationAccount) add(getStoredInsightAccount(requestedNotificationAccount));
  if (joinId) add(getStoredInsightAccount(joinId));
  add(resumeCandidate());
  for (const account of readStoredInsightAccounts()) add(account);
  return out;
}

function transientStatus(status: number) {
  return status >= 500 || status === 408 || status === 425 || status === 429;
}

async function validateCurrentMemberToken() {
  const token = localStorage.getItem(INSIGHT_TOKEN_KEY) || "";
  if (!token) return "missing" as const;
  try {
    const response = await fetch(ACCESS, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Insight-Token": token },
      body: JSON.stringify({ action: "session" }),
      cache: "no-store",
    });
    const payload = await readJson(response);
    if (response.ok && payload?.ok !== false && payload?.application) {
      const stored = readStoredInsightAccounts().find((item) => item.memberToken === token);
      rememberMemberSession(payload.application, token, stored?.passcode);
      if (window.location.hash.includes("access/insight")) window.location.hash = "dashboard";
      return "valid" as const;
    }
    if (transientStatus(response.status)) return "temporary" as const;
    const code = String(payload?.error || "");
    if (/INSIGHT_SESSION_INVALID|INSIGHT_LOGIN_REQUIRED|INSIGHT_MEMBER_INACTIVE/.test(code) || response.status === 401 || response.status === 403) return "invalid" as const;
    return "temporary" as const;
  } catch {
    return "temporary" as const;
  }
}

async function handleIdentityReverify(account: ReturnType<typeof readStoredInsightAccounts>[number]) {
  const joinId = (localStorage.getItem(JOIN_NOTE_KEY) || "").trim().toLowerCase();
  if (!joinId || joinId !== account.noteId) return false;
  const statusResponse = await fetch(ACCESS, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Insight-Applicant": account.applicantToken || "" },
    body: JSON.stringify({ action: "application-status" }),
    cache: "no-store",
  });
  const statusPayload = await readJson(statusResponse);
  if (!statusResponse.ok || statusPayload?.application?.status !== "approved") return false;
  rememberApplication(statusPayload.application, statusPayload.application?.verificationCode || account.passcode);
  showAccessNotice("OWNERが参加を許可しました。本人確認へ進んでください。");
  const reloadKey = `mumei-approved-reload:${joinId}`;
  if (window.location.hash.includes("access/insight") && sessionStorage.getItem(reloadKey) !== "1") {
    sessionStorage.setItem(reloadKey, "1");
    window.setTimeout(() => window.location.reload(), 350);
  }
  return true;
}

async function tryReturningMemberResume() {
  const onAccessScreen = window.location.hash.includes("access/insight");
  const onMemberScreen = window.location.hash.includes("dashboard") || window.location.hash.includes("owner-insight");
  if (!onAccessScreen && !onMemberScreen) return;
  if (memberResumeRunning) return;
  memberResumeRunning = true;

  try {
    const tokenState = await validateCurrentMemberToken();
    if (tokenState === "valid" || tokenState === "temporary") return;

    for (const account of resumeCandidates()) {
      if (!account.applicantToken) continue;
      if (localStorage.getItem(EXPLICIT_LOGOUT_KEY_PREFIX + account.noteId) === "1") continue;
      try {
        const response = await fetch(REACTIVATE, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Insight-Applicant": account.applicantToken },
          body: JSON.stringify({ action: "resume" }),
          cache: "no-store",
        });
        const payload = await readJson(response);
        if (response.ok && payload?.memberToken && payload?.application) {
          rememberMemberSession(payload.application, payload.memberToken, account.passcode);
          localStorage.removeItem(JOIN_NOTE_KEY);
          sessionStorage.removeItem(`mumei-approved-reload:${account.noteId}`);
          showAccessNotice(`@${account.noteId} のログイン状態を復旧しました。`);
          if (window.location.hash !== "#dashboard") window.location.hash = "dashboard";
          return;
        }
        if (transientStatus(response.status)) return;
        if (payload?.error === "IDENTITY_REVERIFY_REQUIRED" && await handleIdentityReverify(account)) return;
        // One stale/inactive saved account must never block another active saved account.
        continue;
      } catch {
        // A network failure is temporary; do not churn all saved identities while offline.
        return;
      }
    }
  } finally {
    memberResumeRunning = false;
  }
}

async function pollOwnerPendingApplications() {
  const ownerToken = localStorage.getItem(OWNER_KEY) || "";
  if (!ownerToken) return;
  try {
    const response = await fetch(REACTIVATE, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Owner-Token": ownerToken },
      body: JSON.stringify({ action: "owner-pending" }),
      cache: "no-store",
    });
    const payload = await readJson(response);
    if (!response.ok || !payload?.ok) return;
    const items = Array.isArray(payload.items) ? payload.items : [];
    const signature = items.map((item: any) => `${item.id}:${item.updatedAt || ""}`).join("|");
    const previous = localStorage.getItem(OWNER_PENDING_SEEN_KEY) || "";
    if (Number(payload.count || 0) > 0 && signature && signature !== previous) {
      const first = items[0];
      const label = first?.displayName || (first?.noteId ? `@${first.noteId}` : "参加希望者");
      showAccessNotice(`🔔 INSIGHT参加申請 ${Number(payload.count || 0)}件｜${label}`);
      if ("Notification" in window && Notification.permission === "granted") {
        try { new Notification("INSIGHT 参加申請", { body: `${label} から参加申請があります。` }); } catch { /* optional system notification */ }
      }
    }
    localStorage.setItem(OWNER_PENDING_SEEN_KEY, signature);
  } catch {
    // Owner notification polling is best-effort and never blocks INSIGHT.
  }
}

const insightToken = localStorage.getItem(INSIGHT_TOKEN_KEY) || "";
if (insightToken) {
  void fetch(SELF_ACCOUNT, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Insight-Token": insightToken },
    body: JSON.stringify({ action: "touch" }),
    cache: "no-store",
  }).catch(() => { /* Long-session refresh must never block app startup. */ });
}

window.addEventListener("mumei-insight-accounts", () => {
  if (window.location.hash === "#dashboard" && localStorage.getItem(INSIGHT_TOKEN_KEY) && sessionStorage.getItem(ACCOUNT_ROUTE_REFRESH_KEY) !== "1") {
    sessionStorage.setItem(ACCOUNT_ROUTE_REFRESH_KEY, "1");
    window.setTimeout(() => window.location.reload(), 30);
  }
});
window.addEventListener("hashchange", () => {
  if (!window.location.hash.includes("dashboard")) sessionStorage.removeItem(ACCOUNT_ROUTE_REFRESH_KEY);
  void tryReturningMemberResume();
});

void tryReturningMemberResume();
void pollOwnerPendingApplications();
window.setInterval(() => { void tryReturningMemberResume(); }, 5000);
window.setInterval(() => { if (document.visibilityState === "visible") void pollOwnerPendingApplications(); }, 15000);
window.addEventListener("focus", () => { void tryReturningMemberResume(); void pollOwnerPendingApplications(); });
window.addEventListener("pageshow", () => { void tryReturningMemberResume(); void pollOwnerPendingApplications(); });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
