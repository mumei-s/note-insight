import "./insight-dashboard-label-v19";
import "./insight-notification-enhancements-v17";
import "./insight-notification-ui-v18";
import "./insight-inline-updates-v1";
import "./insight-top-install-v16";
import "./insight-notification-update-route-v1";
import "./insight-update-guide-v18";

export const CURRENT_INSIGHT_APP_VERSION = "2026.09.19.1";
export const CURRENT_NOTIFICATION_VERSION = "3.2.81";
export const CURRENT_DASHBOARD_VERSION = "1.4.4";
export const NOTIFICATION_VERSION_STORAGE_KEY = "mumei-notification-tool-version";
export const DASHBOARD_VERSION_STORAGE_KEY = "mumei-dashboard-tool-version";

export type InsightRelease = {
  appVersion: string;
  notificationVersion: string;
  dashboardVersion: string;
  releasedAt?: string;
  appLabel?: string;
  notificationLabel?: string;
  dashboardLabel?: string;
};

export function compareVersions(a: string, b: string) {
  const pa=String(a||"").split(".").map(v=>Number((v.match(/\d+/)||["0"])[0]));
  const pb=String(b||"").split(".").map(v=>Number((v.match(/\d+/)||["0"])[0]));
  const n=Math.max(pa.length,pb.length);
  for(let i=0;i<n;i++){const av=pa[i]||0,bv=pb[i]||0;if(av!==bv)return av>bv?1:-1}
  return 0;
}

export function versionDiffers(current: string, latest: string) {
  return Boolean(current && latest && compareVersions(current,latest)<0);
}

export async function fetchInsightRelease(): Promise<InsightRelease> {
  const url = `${import.meta.env.BASE_URL}insight-release.json?ts=${Date.now()}`;
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`RELEASE_MANIFEST_${response.status}`);
  const payload = (await response.json()) as Partial<InsightRelease>;
  if (!payload.appVersion || !payload.notificationVersion || !payload.dashboardVersion) {
    throw new Error("RELEASE_MANIFEST_INVALID");
  }
  return {
    appVersion: String(payload.appVersion),
    notificationVersion: String(payload.notificationVersion),
    dashboardVersion: String(payload.dashboardVersion),
    releasedAt: payload.releasedAt ? String(payload.releasedAt) : undefined,
    appLabel: payload.appLabel ? String(payload.appLabel) : undefined,
    notificationLabel: payload.notificationLabel ? String(payload.notificationLabel) : undefined,
    dashboardLabel: payload.dashboardLabel ? String(payload.dashboardLabel) : undefined,
  };
}