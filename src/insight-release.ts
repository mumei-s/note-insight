export const CURRENT_INSIGHT_APP_VERSION = "2026.09.07.2";
export const NOTIFICATION_VERSION_STORAGE_KEY = "mumei-notification-tool-version";

export type InsightRelease = {
  appVersion: string;
  notificationVersion: string;
  releasedAt?: string;
  appLabel?: string;
  notificationLabel?: string;
};

export function versionDiffers(current: string, latest: string) {
  return Boolean(current && latest && current !== latest);
}

export async function fetchInsightRelease(): Promise<InsightRelease> {
  const url = `${import.meta.env.BASE_URL}insight-release.json?ts=${Date.now()}`;
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`RELEASE_MANIFEST_${response.status}`);
  const payload = (await response.json()) as Partial<InsightRelease>;
  if (!payload.appVersion || !payload.notificationVersion) {
    throw new Error("RELEASE_MANIFEST_INVALID");
  }
  return {
    appVersion: String(payload.appVersion),
    notificationVersion: String(payload.notificationVersion),
    releasedAt: payload.releasedAt ? String(payload.releasedAt) : undefined,
    appLabel: payload.appLabel ? String(payload.appLabel) : undefined,
    notificationLabel: payload.notificationLabel
      ? String(payload.notificationLabel)
      : undefined,
  };
}
