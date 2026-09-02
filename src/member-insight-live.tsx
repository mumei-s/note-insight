import { useEffect, useRef, useState } from "react";
import { INSIGHT_TOKEN_KEY } from "./insight-account-store";
import { MemberInsightFull } from "./member-insight-full";

const MEMBER = "https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-member-api";
const RESYNC_AFTER_MS = 120_000;

export function MemberInsightLive() {
  const [revision, setRevision] = useState(0);
  const lastRun = useRef(0);
  const running = useRef(false);
  const controller = useRef<AbortController | null>(null);

  async function refresh(force = false) {
    const token = localStorage.getItem(INSIGHT_TOKEN_KEY) || "";
    if (!token || running.current) return;
    const now = Date.now();
    if (!force && now - lastRun.current < RESYNC_AFTER_MS) return;
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
      // Saved full history stays usable even when a live refresh is unavailable.
    } finally {
      window.clearTimeout(timer);
      if (controller.current === current) controller.current = null;
      running.current = false;
    }
  }

  useEffect(() => {
    void refresh(true);
    const onVisible = () => { if (document.visibilityState === "visible") void refresh(false); };
    const onFocus = () => { void refresh(false); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
      controller.current?.abort();
    };
  }, []);

  return <MemberInsightFull revision={revision} />;
}
