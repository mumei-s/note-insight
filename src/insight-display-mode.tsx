import { useLayoutEffect, useSyncExternalStore } from "react";

export type InsightDisplayMode = "pc" | "mobile";
export const DISPLAY_MODE_KEY = "mumei-insight-display-mode-v1";
const CHANGE = "mumei-insight-display-mode";
let fallback: InsightDisplayMode | null = null;

export function readDisplayMode(): InsightDisplayMode {
  let saved: string | null = fallback;
  try { saved = localStorage.getItem(DISPLAY_MODE_KEY) || saved; } catch { /* private browsing */ }
  if (saved === "pc" || saved === "mobile") return saved;
  return window.matchMedia?.("(min-width: 1024px)").matches ? "pc" : "mobile";
}

export function setDisplayMode(mode: InsightDisplayMode) {
  fallback = mode;
  try { localStorage.setItem(DISPLAY_MODE_KEY, mode); } catch { /* keep the current selection in memory */ }
  window.dispatchEvent(new window.Event(CHANGE));
}

function subscribe(listener: () => void) {
  const storage = (event: StorageEvent) => { if (event.key === DISPLAY_MODE_KEY || event.key === null) listener(); };
  window.addEventListener(CHANGE, listener);
  window.addEventListener("resize", listener);
  window.addEventListener("storage", storage);
  return () => {
    window.removeEventListener(CHANGE, listener);
    window.removeEventListener("resize", listener);
    window.removeEventListener("storage", storage);
  };
}

export function useInsightDisplayMode() {
  const mode = useSyncExternalStore(subscribe, readDisplayMode, () => "mobile" as const);
  useLayoutEffect(() => { document.documentElement.dataset.insightLayout = mode; }, [mode]);
  return mode;
}

export function DisplayModeSwitch() {
  const mode = useInsightDisplayMode();
  return <div className="insight-display-switch" role="group" aria-label="表示切り替え">
    <span>表示</span>
    <button type="button" aria-pressed={mode === "mobile"} onClick={() => setDisplayMode("mobile")}>スマホ版</button>
    <button type="button" aria-pressed={mode === "pc"} onClick={() => setDisplayMode("pc")}>PC版</button>
  </div>;
}
