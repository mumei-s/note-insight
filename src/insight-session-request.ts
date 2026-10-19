import { INSIGHT_TOKEN_KEY, currentStoredInsightAccount } from "./insight-account-store";
import { fetchInsightResource } from "./insight-view-lifecycle";

const ACCESS = "https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-access";
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
