// A previous page's snapshot is an offline fallback, not a verified current view.
const sessionStartedAt = Date.now();

export function isFreshInsightView(cachedAt: unknown, maxAge = 60_000) {
  const savedAt = Number(cachedAt), now = Date.now();
  return Number.isFinite(savedAt) && savedAt >= sessionStartedAt && savedAt <= now && now - savedAt <= maxAge;
}

type RequestRecord = { source: string; action: string; durationMs: number; status: number; outcome: string };
const requests: RequestRecord[] = [];
export function insightRequestDiagnostics() { return requests.map(record => ({ ...record })); }

export async function fetchInsightResource(endpoint: string, init: RequestInit = {}, timeoutMs = 30_000): Promise<Response> {
  const controller = new AbortController();
  const external = init.signal;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let rejectAbort: (reason: Error) => void = () => {};
  const abortError = () => Object.assign(new Error("通信を中断しました"), { name: "AbortError" });
  const abort = () => { controller.abort(); rejectAbort(abortError()); };
  const startedAt = Date.now();
  let status = 0, outcome = "error";
  try {
    if (external?.aborted) throw abortError();
    const stopped = new Promise<never>((_, reject) => {
      rejectAbort = reject;
      timer = setTimeout(() => {
        controller.abort();
        reject(Object.assign(new Error("通信が時間切れになりました"), { name: "TimeoutError" }));
      }, timeoutMs);
    });
    external?.addEventListener("abort", abort, { once: true });
    const response = await Promise.race([(async () => {
      const response = await fetch(endpoint, { ...init, signal: controller.signal });
      // Include the response body in the deadline; headers alone are not completion.
      const text = typeof response.text === "function" ? await response.text() : null;
      const payload = text === null ? await response.json() : undefined;
      return new Proxy(response, { get(target, property) {
        if (property === "json") return async () => text === null ? payload : JSON.parse(text);
        if (property === "text") return async () => text === null ? JSON.stringify(payload) : text;
        const value = Reflect.get(target, property, target);
        return typeof value === "function" ? value.bind(target) : value;
      } });
    })(), stopped]);
    status = response.status;
    outcome = response.ok ? "ok" : "http-error";
    return response;
  } catch (error) {
    outcome = error instanceof Error ? error.name : "error";
    throw error;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    external?.removeEventListener("abort", abort);
    let source = endpoint, action = "";
    try { source = new URL(endpoint).pathname.split("/").filter(Boolean).at(-1) || "request"; } catch {}
    try { action = String(JSON.parse(String(init.body || "{}"))?.action || ""); } catch {}
    requests.push({ source, action, durationMs: Date.now() - startedAt, status, outcome });
    if (requests.length > 40) requests.splice(0, requests.length - 40);
  }
}
