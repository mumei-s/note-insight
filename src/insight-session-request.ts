import { EXPLICIT_LOGOUT_KEY_PREFIX, INSIGHT_TOKEN_KEY, currentStoredInsightAccount, getStoredInsightAccount, type StoredInsightAccount } from "./insight-account-store";
import { fetchInsightResource } from "./insight-view-lifecycle";

const ACCESS = "https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-access";
const REACTIVATE = "https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-access-reactivate";
const SELF_ACCOUNT = "https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-self-account";
export type InsightSessionResult = { response: Response; payload: any; token: string; scope: string; checkedAt: number };
export type InsightSessionIdentity = {
  token: string; scope: string; checkedAt: number;
  member: { noteId: string; displayName: string; imageUrl: string | null };
};
type Flight = { key: string; controller: AbortController; consumers: number; request: Promise<InsightSessionResult> };
let pending: Flight | null = null;
const accountScope = () => String(currentStoredInsightAccount()?.noteId || "").toLowerCase();
const identity = () => JSON.stringify([localStorage.getItem(INSIGHT_TOKEN_KEY) || "", accountScope()]);
const abortError = () => Object.assign(new Error("通信を中断しました"), { name: "AbortError" });
type ResumeResult = { response: Response; payload: any };
const resumeFlights = new Map<string, Promise<ResumeResult>>();
const touchFlights = new Map<string, Promise<void>>();

// Startup and TOP may renew the same session concurrently. Renewal is not an
// authentication result: never substitute it for readInsightSession.
export function touchInsightSession(token: string): Promise<void> {
  const key = JSON.stringify([token, accountScope()]);
  if (!token || identity() !== key) return Promise.reject(new Error("INSIGHT_ACCOUNT_CHANGED"));
  const existing = touchFlights.get(key);
  if (existing) return existing;
  const request = Promise.resolve().then(async () => {
    if (identity() !== key) throw new Error("INSIGHT_ACCOUNT_CHANGED");
    const response = await fetch(SELF_ACCOUNT, {
      method: "POST", headers: { "Content-Type": "application/json", "X-Insight-Token": token },
      body: JSON.stringify({ action: "touch" }), cache: "no-store",
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.ok !== true) throw new Error(payload?.error || "ACCESS_ERROR");
    if (identity() !== key) throw new Error("INSIGHT_ACCOUNT_CHANGED");
  }).finally(() => { if (touchFlights.get(key) === request) touchFlights.delete(key); });
  touchFlights.set(key, request);
  return request;
}

// Resume issues a new server token. Keep an already-sent operation in flight
// even if every consumer leaves: aborting it would not undo the mutation, and
// effect replay must not submit a second one while its outcome is unknown.
// Nothing is cached after settlement and no failure is automatically retried.
export function resumeInsightSession(account: Pick<StoredInsightAccount, "noteId" | "applicantToken">, signal?: AbortSignal): Promise<ResumeResult> {
  if (signal?.aborted) return Promise.reject(abortError());
  const noteId = account.noteId.trim().toLowerCase(), applicantToken = account.applicantToken || "";
  const sourceIdentity = identity(), joinId = localStorage.getItem("mumei-insight-current-join-v5") || "";
  const current = () => identity() === sourceIdentity
    && (localStorage.getItem("mumei-insight-current-join-v5") || "") === joinId
    && localStorage.getItem(EXPLICIT_LOGOUT_KEY_PREFIX + noteId) !== "1"
    && getStoredInsightAccount(noteId)?.applicantToken === applicantToken;
  if (!applicantToken || !current()) return Promise.reject(new Error("INSIGHT_ACCOUNT_CHANGED"));
  const key = JSON.stringify([sourceIdentity, joinId, noteId, applicantToken]);
  let request = resumeFlights.get(key);
  if (!request) {
    request = Promise.resolve().then(async () => {
      if (!current()) throw new Error("INSIGHT_ACCOUNT_CHANGED");
      const response = await fetch(REACTIVATE, {
        method: "POST", headers: { "Content-Type": "application/json", "X-Insight-Applicant": applicantToken },
        body: JSON.stringify({ action: "resume" }), cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (response.ok && (payload?.ok !== true || !payload?.memberToken || payload?.application?.noteId?.toLowerCase() !== noteId || payload?.application?.status !== "active")) throw new Error("INSIGHT_ACCOUNT_MISMATCH");
      return { response, payload };
    }).finally(() => { if (resumeFlights.get(key) === request) resumeFlights.delete(key); });
    resumeFlights.set(key, request);
  }
  return new Promise((resolve, reject) => {
    let finished = false;
    const release = () => {
      if (finished) return false;
      finished = true; signal?.removeEventListener("abort", abort); return true;
    };
    const abort = () => { if (release()) reject(abortError()); };
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
    request.then(result => {
      if (!release()) return;
      if (!current()) reject(new Error("INSIGHT_ACCOUNT_CHANGED")); else resolve(result);
    }, error => { if (release()) reject(error); });
  });
}

// Only unfinished reads are shared. A later focus, refresh, or mount verifies
// the server again; no successful or failed authentication response is cached.
export function readInsightSession(token: string, signal?: AbortSignal): Promise<InsightSessionResult> {
  if (signal?.aborted) return Promise.reject(abortError());
  if (!token) return Promise.reject(new Error("INSIGHT_LOGIN_REQUIRED"));
  const scope = accountScope(), key = JSON.stringify([token, scope]);
  if (identity() !== key) return Promise.reject(new Error("INSIGHT_ACCOUNT_CHANGED"));
  if (pending && (pending.key !== key || pending.controller.signal.aborted)) {
    pending.controller.abort(); pending = null;
  }
  if (!pending) {
    const controller = new AbortController();
    const entry = { key, controller, consumers: 0 } as Flight;
    entry.request = (async () => {
      try {
        const response = await fetchInsightResource(ACCESS, {
          method: "POST", headers: { "Content-Type": "application/json", "X-Insight-Token": token },
          body: JSON.stringify({ action: "session" }), cache: "no-store", signal: controller.signal,
        }, 30_000);
        const payload = await response.json().catch(() => ({}));
        if (controller.signal.aborted) throw abortError();
        if (identity() !== key) throw new Error("INSIGHT_ACCOUNT_CHANGED");
        return { response, payload, token, scope, checkedAt: Date.now() };
      } finally { if (pending === entry) pending = null; }
    })();
    pending = entry;
  }
  const entry = pending;
  entry.consumers++;
  return new Promise((resolve, reject) => {
    let finished = false;
    const release = () => {
      if (finished) return false;
      finished = true; signal?.removeEventListener("abort", abort); entry.consumers--;
      if (!entry.consumers && pending === entry) { pending = null; entry.controller.abort(); }
      return true;
    };
    const abort = () => { if (release()) reject(abortError()); };
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
    entry.request.then(result => {
      if (!release()) return;
      if (identity() !== key) reject(new Error("INSIGHT_ACCOUNT_CHANGED")); else resolve(result);
    }, error => { if (release()) reject(error); });
  });
}

// The App may hand its just-verified identity to the shell it is about to mount.
// This is not an authentication decision and never trusts saved profile data.
export function verifiedInsightSessionIdentity(result: InsightSessionResult): InsightSessionIdentity | null {
  const { response, payload, token, scope, checkedAt } = result, app = payload?.application;
  const noteId = typeof app?.noteId === "string" ? app.noteId.trim().toLowerCase() : "";
  if (!response.ok || payload?.ok !== true || app?.status !== "active" || !/^[a-z0-9_-]{1,80}$/.test(noteId) || (scope && noteId !== scope)) return null;
  return { token, scope, checkedAt, member: { noteId, displayName: typeof app.displayName === "string" && app.displayName.trim() ? app.displayName : noteId, imageUrl: typeof app.imageUrl === "string" ? app.imageUrl : null } };
}
