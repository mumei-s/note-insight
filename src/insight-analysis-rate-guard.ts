const RATE_GUARD_KEY = "__mumeiInsightRateGuardV17";
const DASHBOARD_ENDPOINT = "insight-dashboard-data";

type AnyRecord = Record<string, any>;

function num(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function boundedPercent(a: any, b: any) {
  const denominator = num(b);
  if (denominator <= 0) return 0;
  const value = (num(a) / denominator) * 100;
  return Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
}

function normalizeAnalysisPayload(payload: AnyRecord) {
  if (!payload || payload.ok === false) return payload;
  const latest = payload.latestDashboard || {};
  const traffic = payload.traffic || {};
  const groups = traffic.groups || {};
  const trafficTotal = Math.max(0, num(traffic.total));
  const pageViews = num(latest.pageViews ?? latest.views);
  const impressions = num(latest.impressions);
  const likes = num(latest.likes);
  const comments = num(latest.comments);

  payload.derived = {
    ...(payload.derived || {}),
    openRate: boundedPercent(pageViews, impressions),
    likeRate: boundedPercent(likes, pageViews),
    commentRate: boundedPercent(comments, pageViews),
    reactionRate: boundedPercent(likes + comments, pageViews),
    externalRate: trafficTotal > 0 ? Math.max(0, Math.min(100, 100 - boundedPercent(groups.note || 0, trafficTotal))) : 0,
    searchRate: trafficTotal > 0 ? boundedPercent(groups.search || 0, trafficTotal) : 0,
    notificationRate: trafficTotal > 0 ? boundedPercent(groups.notification || 0, trafficTotal) : 0,
    directRate: trafficTotal > 0 ? boundedPercent(groups.direct || 0, trafficTotal) : 0,
  };

  return payload;
}

const g = window as typeof window & Record<string, any>;
if (!g[RATE_GUARD_KEY]) {
  g[RATE_GUARD_KEY] = true;
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (...args: Parameters<typeof fetch>) => {
    const response = await originalFetch(...args);
    try {
      const input = args[0];
      const init = args[1] as RequestInit | undefined;
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (!url.includes(DASHBOARD_ENDPOINT)) return response;
      const body = typeof init?.body === "string" ? JSON.parse(init.body) : null;
      if (body?.action !== "analysis") return response;
      const payload = await response.clone().json();
      normalizeAnalysisPayload(payload);
      const headers = new Headers(response.headers);
      headers.delete("content-length");
      return new Response(JSON.stringify(payload), {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    } catch {
      return response;
    }
  };
}
