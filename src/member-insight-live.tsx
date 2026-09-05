import { useEffect, useRef, useState } from "react";
import { INSIGHT_TOKEN_KEY } from "./insight-account-store";
import { MemberInsightUnifiedV4 } from "./member-insight-unified-v4";
import { MemberInsightAnalyticsV3 } from "./member-insight-analytics-v3";
import { MemberInsightSocialV2 } from "./member-insight-social-v2";
import { MemberInsightCommentsFinal } from "./member-insight-comments-final";
import { MemberInsightNotificationsFinal } from "./member-insight-notifications-final";
import "./member-insight-hotfix.css";

const MEMBER = "https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-member-api";
const RELATIONS = "https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-relations";
const RESYNC_AFTER_MS = 120_000;
const QUIET_AFTER_INTERACTION_MS = 2_500;
type Override = "social" | "comments" | "notifications" | null;

export function MemberInsightLive() {
  const [revision, setRevision] = useState(0);
  const [screen, setScreen] = useState<"insight" | "analytics">("insight");
  const [panelOverride, setPanelOverride] = useState<Override>(null);
  const lastRun = useRef(0);
  const lastInteraction = useRef(Date.now());
  const running = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const deferred = useRef<number | null>(null);

  async function call(endpoint:string, action:string, timeoutMs=45_000) {
    const token = localStorage.getItem(INSIGHT_TOKEN_KEY) || "";
    if (!token) return null;
    const current = new AbortController();
    const timer = window.setTimeout(() => current.abort(), timeoutMs);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Insight-Token": token },
        body: JSON.stringify({ action }),
        cache: "no-store",
        signal: current.signal,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok === false) throw new Error(payload?.error || "INSIGHT_API_ERROR");
      return payload;
    } finally { window.clearTimeout(timer); }
  }

  async function refresh(force = false, includeRelations = false) {
    const token = localStorage.getItem(INSIGHT_TOKEN_KEY) || "";
    if (!token || running.current) return;
    const now = Date.now();
    if (!force && now - lastRun.current < RESYNC_AFTER_MS) return;
    if (now - lastInteraction.current < QUIET_AFTER_INTERACTION_MS) {
      if (deferred.current) window.clearTimeout(deferred.current);
      deferred.current = window.setTimeout(() => { void refresh(force, includeRelations); }, QUIET_AFTER_INTERACTION_MS);
      return;
    }
    lastRun.current = now;
    running.current = true;
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    const timer = window.setTimeout(() => current.abort(), 50_000);
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
      if (includeRelations) {
        try { await call(RELATIONS, "sync", 115_000); setRevision((value) => value + 1); } catch { /* previous exact snapshot remains authoritative */ }
      }
    } catch {
      // Saved history remains usable even when a live refresh is unavailable.
    } finally {
      window.clearTimeout(timer);
      if (controller.current === current) controller.current = null;
      running.current = false;
    }
  }

  useEffect(() => {
    const interacted = (event:Event) => {
      lastInteraction.current = Date.now();
      const button = (event.target as HTMLElement | null)?.closest?.("button");
      const text = (button?.textContent || "").replace(/\s+/g," ").trim();
      if (button && /データ更新|全データ更新|最新データ/.test(text)) {
        window.setTimeout(() => { void refresh(true, true); }, 80);
      }
    };
    const schedule = (force = false) => {
      if (deferred.current) window.clearTimeout(deferred.current);
      deferred.current = window.setTimeout(() => { void refresh(force, false); }, QUIET_AFTER_INTERACTION_MS);
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

  useEffect(() => {
    if (!panelOverride) return;
    const id = panelOverride === "social" ? "mis2-social" : panelOverride === "comments" ? "micf-comments" : "minf-notifications";
    const timer = window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ block: "start", behavior: "auto" }), 30);
    return () => window.clearTimeout(timer);
  }, [panelOverride]);

  function captureInsightNavigation(event: React.MouseEvent<HTMLDivElement>) {
    const button = (event.target as HTMLElement | null)?.closest?.("button");
    if (!button) return;
    const text = (button.textContent || "").replace(/\s+/g," ").trim();
    if (button.closest(".miu-nav")) {
      if (text.includes("フォロー")) setPanelOverride("social");
      else if (text.includes("コメント")) setPanelOverride("comments");
      else if (text.includes("通知")) setPanelOverride("notifications");
      else setPanelOverride(null);
    } else if (button.closest(".miu-stats")) {
      if (text.includes("フォロワー") || text.includes("フォロー")) setPanelOverride("social");
      else if (text.includes("コメント")) setPanelOverride("comments");
      else if (text.includes("通知")) setPanelOverride("notifications");
    }
  }

  const overrideClass = panelOverride ? `mia-${panelOverride}-override` : "";
  return <>
    <div className="mia-switcher" role="navigation" aria-label="INSIGHT表示切替">
      <button className={screen === "insight" ? "active" : ""} onClick={() => setScreen("insight")}>INSIGHT</button>
      <button className={screen === "analytics" ? "active" : ""} onClick={() => setScreen("analytics")}>📊 分析</button>
    </div>
    {screen === "analytics"
      ? <MemberInsightAnalyticsV3 revision={revision} onBack={() => setScreen("insight")} />
      : <div className={overrideClass} onClickCapture={captureInsightNavigation}>
          <MemberInsightUnifiedV4 revision={revision} />
          {panelOverride === "social" ? <MemberInsightSocialV2 revision={revision} /> : null}
          {panelOverride === "comments" ? <MemberInsightCommentsFinal revision={revision} /> : null}
          {panelOverride === "notifications" ? <MemberInsightNotificationsFinal revision={revision} /> : null}
        </div>}
  </>;
}
