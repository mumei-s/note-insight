import { useEffect, useState } from "react";
import { INSIGHT_TOKEN_KEY } from "./insight-account-store";
import { MemberInsightFull } from "./member-insight-full";

const MEMBER = "https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-member-api";

export function MemberInsightLive() {
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const token = localStorage.getItem(INSIGHT_TOKEN_KEY) || "";
    if (!token) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 45000);
    void fetch(MEMBER, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Insight-Token": token },
      body: JSON.stringify({ action: "sync" }),
      cache: "no-store",
      signal: controller.signal,
    }).then(async (response) => {
      const payload = await response.json().catch(() => ({}));
      if (response.ok && payload?.ok !== false) setRevision((value) => value + 1);
    }).catch(() => {
      // Saved full history stays usable even when the background refresh is unavailable.
    }).finally(() => clearTimeout(timer));
    return () => { clearTimeout(timer); controller.abort(); };
  }, []);

  return <MemberInsightFull key={revision} />;
}
