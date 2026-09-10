import { createClient } from "npm:@supabase/supabase-js@2.112.4";

const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

const ORIGIN = "https://mumei-s.github.io";

function headers(req: Request) {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": origin === ORIGIN ? ORIGIN : ORIGIN,
    "Access-Control-Allow-Headers": "content-type,x-insight-token",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Content-Type": "application/json; charset=utf-8",
    "Vary": "Origin",
  };
}

function reply(req: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: headers(req) });
}

async function sha(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

async function member(req: Request) {
  const raw = req.headers.get("X-Insight-Token") || "";
  if (!raw) throw new Error("INSIGHT_LOGIN_REQUIRED");
  const { data: session, error: sessionError } = await db
    .from("insight_member_sessions")
    .select("id,application_id,expires_at,revoked_at")
    .eq("token_hash", await sha(raw))
    .maybeSingle();
  if (sessionError) throw sessionError;
  if (!session || session.revoked_at || Date.parse(session.expires_at) <= Date.now()) {
    throw new Error("INSIGHT_SESSION_INVALID");
  }
  const { data: application, error: applicationError } = await db
    .from("insight_access_applications")
    .select("id,note_id,display_name,status")
    .eq("id", session.application_id)
    .maybeSingle();
  if (applicationError) throw applicationError;
  if (!application || application.status !== "active") throw new Error("INSIGHT_MEMBER_INACTIVE");
  await db.from("insight_member_sessions").update({ last_seen_at: new Date().toISOString() }).eq("id", session.id);
  return {
    id: String(application.id),
    noteId: String(application.note_id || ""),
    displayName: String(application.display_name || application.note_id || ""),
  };
}

function urlnameFromUrl(value: unknown) {
  const match = String(value || "").match(/^https?:\/\/(?:www\.)?note\.com\/([^/?#]+)/i);
  return match ? decodeURIComponent(match[1]) : "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: headers(req) });
  if (req.method !== "POST") return reply(req, { ok: false, error: "METHOD_NOT_ALLOWED" }, 405);
  try {
    const m = await member(req);
    const body = await req.json().catch(() => ({}));
    const requested = Math.max(1, Math.min(300, Math.floor(Number(body?.count || 100))));
    const unique = body?.unique !== false;
    const dataMember = m.noteId.toLowerCase() === "ss_yr" ? "owner" : m.id;
    const scanLimit = Math.min(3000, Math.max(400, requested * 12));

    const { data, error } = await db
      .from("insight_public_likes")
      .select("article_key,liker_key,actor_name,actor_url,actor_image_url,liked_at")
      .eq("member_id", dataMember)
      .order("liked_at", { ascending: false, nullsFirst: false })
      .limit(scanLimit);
    if (error) throw error;

    const rows: Array<Record<string, unknown>> = [];
    const seen = new Set<string>();
    for (const raw of data || []) {
      const likerKey = String(raw?.liker_key || "").trim();
      const actorUrl = String(raw?.actor_url || "").trim();
      const urlname = urlnameFromUrl(actorUrl);
      const identity = likerKey || urlname;
      if (!identity || !urlname) continue;
      if (unique && seen.has(identity)) continue;
      seen.add(identity);
      rows.push({
        likerKey: identity,
        urlname,
        creator: String(raw?.actor_name || urlname),
        actorUrl: actorUrl || `https://note.com/${urlname}`,
        actorImageUrl: String(raw?.actor_image_url || ""),
        likedAt: raw?.liked_at ? String(raw.liked_at) : null,
        likedArticleKey: String(raw?.article_key || ""),
      });
      if (rows.length >= requested) break;
    }

    return reply(req, {
      ok: true,
      source: "insight_public_likes",
      member: { noteId: m.noteId, displayName: m.displayName },
      requested,
      unique,
      count: rows.length,
      rows,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("insight-likes-export", message);
    return reply(req, { ok: false, error: message }, /LOGIN|SESSION|INACTIVE/.test(message) ? 401 : 500);
  }
});
