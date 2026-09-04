import { useEffect, useRef, useState } from "react";
import { INSIGHT_TOKEN_KEY } from "./insight-account-store";
import { MemberInsightUnifiedV4 } from "./member-insight-unified-v4";
import { MemberInsightAnalyticsV2 } from "./member-insight-analytics-v2";
import "./member-insight-hotfix.css";

const MEMBER = "https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-member-api";
const RESYNC_AFTER_MS = 120_000;
const QUIET_AFTER_INTERACTION_MS = 2_500;

export function MemberInsightLive() {
  const [revision, setRevision] = useState(0);
  const [screen, setScreen] = useState<"insight" | "analytics">("insight");
  const lastRun = useRef(0);
  const lastInteraction = useRef(Date.now());
  const running = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const deferred = useRef<number | null>(null);

  async function refresh(force = false) {
    const token = localStorage.getItem(INSIGHT_TOKEN_KEY) || "";
    if (!token || running.current) return;
    const now = Date.now();
    if (!force && now - lastRun.current < RESYNC_AFTER_MS) return;
    if (now - lastInteraction.current < QUIET_AFTER_INTERACTION_MS) {
      if (deferred.current) window.clearTimeout(deferred.current);
      deferred.current = window.setTimeout(() => { void refresh(force); }, QUIET_AFTER_INTERACTION_MS);
      return;
    }
    lastRun.current = now;
    running.current = true;
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    const timer = window.setTimeout(() => current.abort(), 45_000);
    try {
      const response = await fetch(MEMBER, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Insight-Token": token },
        body: JSON.stringify({ action: "sync" }),
        cache: "no-store",
        signal: current.signal,
      });
      const payload = await response.json().catch(() => ({}));
      if (response.ok && payload?.ok !== false) setRevision((value) => value + 1);
    } catch {
      // Saved history remains usable even when a live refresh is unavailable.
    } finally {
      window.clearTimeout(timer);
      if (controller.current === current) controller.current = null;
      running.current = false;
    }
  }

  useEffect(() => {
    const interacted = () => { lastInteraction.current = Date.now(); };
    const schedule = (force = false) => {
      if (deferred.current) window.clearTimeout(deferred.current);
      deferred.current = window.setTimeout(() => { void refresh(force); }, QUIET_AFTER_INTERACTION_MS);
    };
    window.addEventListener("pointerdown", interacted, { passive: true });
    window.addEventListener("touchstart", interacted, { passive: true });
    window.addEventListener("wheel", interacted, { passive: true });
    window.addEventListener("scroll", interacted, { passive: true });
    const onVisible = () => { if (document.visibilityState === "visible") schedule(false); };
    const onFocus = () => schedule(false);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);
    schedule(true);
    return () => {
      window.removeEventListener("pointerdown", interacted);
      window.removeEventListener("touchstart", interacted);
      window.removeEventListener("wheel", interacted);
      window.removeEventListener("scroll", interacted);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
      if (deferred.current) window.clearTimeout(deferred.current);
      controller.current?.abort();
    };
  }, []);

  return <>
    <div className="mia-switcher" role="navigation" aria-label="INSIGHT表示切替">
      <button className={screen === "insight" ? "active" : ""} onClick={() => setScreen("insight")}>INSIGHT</button>
      <button className={screen === "analytics" ? "active" : ""} onClick={() => setScreen("analytics")}>📊 分析</button>
    </div>
    {screen === "analytics"
      ? <MemberInsightAnalyticsV2 revision={revision} onBack={() => setScreen("insight")} />
      : <MemberInsightUnifiedV4 revision={revision} />}
  </>;
}
