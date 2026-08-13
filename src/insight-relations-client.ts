const RELATIONS_ENDPOINT =
  "https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-relations";

const MEMBER_KEY = "mumei-note-insight:member";
const DEVICE_KEY = "mumei-note-insight:device";

export type RelationSyncRun = {
  id: number;
  direction: "followers" | "followings";
  expected_count: number;
  received_count: number;
  page_count: number;
  complete: boolean;
  baseline: boolean;
  added_count: number;
  removed_count: number;
  error: string | null;
  created_at: string;
};

export type RelationDashboard = {
  ok: boolean;
  runs: RelationSyncRun[];
  events: Array<{
    id: number;
    direction: "followers" | "followings";
    event_type: "added" | "removed";
    person_key: string;
    actor_name: string | null;
    actor_url: string | null;
    detected_at: string;
  }>;
};

function headers() {
  return {
    "Content-Type": "application/json",
    "X-Insight-Member": window.localStorage.getItem(MEMBER_KEY) ?? "",
    "X-Insight-Device": window.localStorage.getItem(DEVICE_KEY) ?? "",
  };
}

async function call<T>(action: "dashboard" | "sync"): Promise<T> {
  const response = await fetch(RELATIONS_ENDPOINT, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ action }),
  });
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? "関係データを取得できませんでした。");
  return payload;
}

export async function readRelationDashboard() {
  return call<RelationDashboard>("dashboard");
}

export async function syncRelationsNow() {
  return call("sync");
}

export async function syncRelationsIfDue(maxAgeMs = 6 * 60 * 60 * 1000) {
  const member = window.localStorage.getItem(MEMBER_KEY);
  const device = window.localStorage.getItem(DEVICE_KEY);
  if (!member || !device) return;

  try {
    const dashboard = await readRelationDashboard();
    const latest = dashboard.runs
      .map((run) => Date.parse(run.created_at))
      .filter(Number.isFinite)
      .sort((a, b) => b - a)[0];
    if (latest && Date.now() - latest < maxAgeMs) return;
    await syncRelationsNow();
  } catch {
    // 元INSIGHT本体の表示を止めない。自動同期は次回また試す。
  }
}
