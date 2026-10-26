export type InsightReturnContext = { mode?: string; tab?: string; account?: string };
export type InsightReturnFallback = { fallbackMode?: string; fallbackTab?: string; account?: string };

declare global {
  interface Window {
    MumeiInsightUpdateReturn?: {
      capture(options?: InsightReturnContext): string;
      resolve(raw: unknown, options?: InsightReturnFallback): string;
    };
  }
}

// The shared helper is loaded before the app. If its request fails, keep the
// application usable without carrying arbitrary query parameters into updates.
const safeDefault = () => window.location.origin + "/note-insight/#dashboard";
export function captureInsightReturn(options: InsightReturnContext = {}): string {
  return window.MumeiInsightUpdateReturn?.capture(options) || safeDefault();
}
export function resolveInsightReturn(raw: unknown, options: InsightReturnFallback = {}): string {
  return window.MumeiInsightUpdateReturn?.resolve(raw, options) || safeDefault();
}
