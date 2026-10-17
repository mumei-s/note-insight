import { pendingBrowserWriteStatus, prepareBrowserStorage, retryBrowserStorage } from "./insight-browser-storage";
import { Component, StrictMode, useEffect, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { HomeScreenInstall } from "./home-screen-install";
import { installApiBridge, registerServiceWorker } from "./api";
import {
  EXPLICIT_LOGOUT_KEY_PREFIX,
  INSIGHT_TOKEN_KEY,
  clearAccessIntent,
  setAccessIntent,
  hasManualAccessIntent,
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
function applyRequestedAccessIntent() {
  const url = new URL(window.location.href);
  if (!/^#\/?access\/insight$/.test(url.hash) || url.searchParams.get("accessIntent") !== "switch") return;
  setAccessIntent("switch");
  sessionStorage.setItem("mumei-insight-account-switch-lock-v1", "1");
  url.searchParams.delete("accessIntent");
  url.searchParams.delete("launch");
  window.history.replaceState(window.history.state, "", url.href);
}
applyRequestedAccessIntent();
const initialUrl = new URL(window.location.href);
const pwaTopLaunch = initialUrl.searchParams.get("launch") === "top";
const requestedNotificationAccount = String(initialUrl.searchParams.get("notificationAccount") || "").trim().replace(/^@/, "").toLowerCase();
let memberResumeRunning = false;
let memberResumeGeneration = 0;

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
if (!window.location.hash.includes("access/insight")) clearAccessIntent();

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

function memberSessionIdentity() {
  const token = localStorage.getItem(INSIGHT_TOKEN_KEY) || "";
  const account = token ? readStoredInsightAccounts().find((item) => item.memberToken === token) : null;
  return JSON.stringify([token, account?.noteId || ""]);
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
  return status === 402 || status >= 500 || status === 408 || status === 425 || status === 429;
}

function autoResumeAllowed() {
  const hash = window.location.hash;
  return hash.includes("access/insight") ? !hasManualAccessIntent() : hash.includes("dashboard") || hash.includes("owner-insight");
}

async function validateCurrentMemberToken() {
  const generation = memberResumeGeneration;
  const identity = memberSessionIdentity();
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
    if (generation !== memberResumeGeneration || identity !== memberSessionIdentity() || !autoResumeAllowed()) return "temporary" as const;
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
  const generation = memberResumeGeneration;
  const identity = memberSessionIdentity();
  const joinId = (localStorage.getItem(JOIN_NOTE_KEY) || "").trim().toLowerCase();
  if (!joinId || joinId !== account.noteId) return false;
  const statusResponse = await fetch(ACCESS, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Insight-Applicant": account.applicantToken || "" },
    body: JSON.stringify({ action: "application-status" }),
    cache: "no-store",
  });
  const statusPayload = await readJson(statusResponse);
  if (generation !== memberResumeGeneration || identity !== memberSessionIdentity() || !autoResumeAllowed()) return false;
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
  if (!autoResumeAllowed()) return;
  if (memberResumeRunning) return;
  memberResumeRunning = true;
  const generation = memberResumeGeneration;
  const identity = memberSessionIdentity();

  try {
    const tokenState = await validateCurrentMemberToken();
    if (generation !== memberResumeGeneration || identity !== memberSessionIdentity() || !autoResumeAllowed()) return;
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
        if (generation !== memberResumeGeneration || identity !== memberSessionIdentity() || !autoResumeAllowed() || localStorage.getItem(EXPLICIT_LOGOUT_KEY_PREFIX + account.noteId) === "1") return;
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

let knownMemberSession = memberSessionIdentity();
let accountRefreshTimer = 0;
window.addEventListener("mumei-insight-accounts", () => {
  window.clearTimeout(accountRefreshTimer);
  // Account-store events may precede their final token write. Compare the
  // completed operation, not profile updates from an ordinary session check.
  accountRefreshTimer = window.setTimeout(() => {
    accountRefreshTimer = 0;
    const next = memberSessionIdentity();
    if (next === knownMemberSession) return;
    knownMemberSession = next;
    memberResumeGeneration++;
    window.dispatchEvent(new Event("mumei-insight-accounts"));
    knownMemberSession = memberSessionIdentity();
    if (window.location.hash === "#dashboard" || window.location.hash === "#owner-insight") window.location.reload();
  }, 30);
});
window.addEventListener("hashchange", () => {
  memberResumeGeneration++;
  if (!window.location.hash.includes("access/insight")) clearAccessIntent();
  void tryReturningMemberResume();
});

void tryReturningMemberResume();
void pollOwnerPendingApplications();
window.setInterval(() => { if (document.visibilityState === "visible" && window.location.hash.includes("access/insight")) void tryReturningMemberResume(); }, 60_000);
window.setInterval(() => { if (document.visibilityState === "visible") void pollOwnerPendingApplications(); }, 120_000);
window.addEventListener("focus", () => { void tryReturningMemberResume(); void pollOwnerPendingApplications(); });
window.addEventListener("pageshow", () => { void tryReturningMemberResume(); void pollOwnerPendingApplications(); });

function startupFailureLabel(reason: unknown) {
  const error = reason as { name?: string; message?: string } | null;
  const name = String(error?.name || "Error"), message = String(error?.message || "");
  if (/QuotaExceeded/i.test(name)) return "ブラウザ内の保存枠への書き込みが拒否されました（QuotaExceededError）";
  if (/SecurityError/i.test(name)) return "ブラウザの保存領域へアクセスできません（SecurityError）";
  if (/addEventListener|matchMedia/.test(message)) return "ブラウザの表示機能で停止しました（E_BROWSER_API）";
  return `表示処理で停止しました（${/^[A-Za-z]+Error$/.test(name) ? name : "E_RENDER"}）`;
}

// Optional installation UI must never take the main app down with it.
class StartupBoundary extends Component<{ children: ReactNode; optional?: boolean }, { failure: string }> {
  state = { failure: "" };
  static getDerivedStateFromError(error: unknown) { return { failure: startupFailureLabel(error) }; }
  render() {
    if (!this.state.failure) return this.props.children;
    if (this.props.optional) return null;
    const top = new URL(window.location.href); top.hash = ""; top.searchParams.set("startupRetry", String(Date.now()));
    return <main id="insight-runtime-failure" role="alert" style={{ minHeight: "100vh", display: "grid", placeContent: "center", padding: 24, gap: 14, color: "#e8f6ff", background: "#03070b" }}>
      <h1 style={{ margin: 0 }}>INSIGHT</h1>
      <p style={{ margin: 0 }}>{this.state.failure}</p>
      <p style={{ margin: 0, fontSize: 12 }}>ログイン情報と保存済みデータは保持しています。</p>
      <button type="button" onClick={() => this.setState({ failure: "" })}>再表示</button>
      <a href={top.href} style={{ color: "#8feaff" }}>TOPを開き直す</a>
    </main>;
  }
}

function BrowserStorageNotice() {
  const [pending, setPending] = useState(pendingBrowserWriteStatus);
  const [retrying, setRetrying] = useState(false);
  useEffect(() => {
    const update = () => setPending(pendingBrowserWriteStatus());
    window.addEventListener("mumei-insight-storage-quota", update); update();
    return () => window.removeEventListener("mumei-insight-storage-quota", update);
  }, []);
  return pending.cacheCount || pending.changeCount ? <aside id="insight-storage-notice" role="status" style={{ margin: "8px 12px", padding: "8px 12px", border: "1px solid #b19a53", borderRadius: 12, background: "#231e10", color: "#fff3bf", font: "12px/1.5 system-ui" }}>
    <details>
      <summary style={{ cursor: "pointer" }}>{pending.changeCount ? "端末の変更を保存待ち" : "端末の表示用保存待ち"}</summary>
      <p style={{ margin: "8px 0" }}>{pending.changeCount
        ? "端末の変更をこのタブで一時保持しています。保存が完了する前に再読込すると、未保存の変更は戻ることがあります。保存済み履歴は残っています。"
        : "取得済み履歴の表示用コピーを、このタブで一時保持しています。サーバーへの保存結果とは別です。端末保存が完了する前に再読込すると、新しい表示用コピーは戻ることがあります。保存済み履歴は残っています。"}</p>
      <button type="button" disabled={retrying} onClick={async () => {
        setRetrying(true);
        try { await retryBrowserStorage(); } finally { setRetrying(false); }
      }}>{retrying ? "再試行中…" : "保存を再試行"}</button>
    </details>
  </aside> : null;
}

function mountInsight() { createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <StartupBoundary optional><HomeScreenInstall /></StartupBoundary>
    <BrowserStorageNotice />
    <StartupBoundary><App /></StartupBoundary>
  </StrictMode>,
); }
// Restore migrated cache values before any view reads them; failure leaves the
// original Web Storage values intact and still allows TOP to render.
void prepareBrowserStorage().finally(mountInsight);
