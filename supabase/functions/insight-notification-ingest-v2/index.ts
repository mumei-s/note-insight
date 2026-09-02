import { createClient } from "npm:@supabase/supabase-js@2";

const U = Deno.env.get("SUPABASE_URL")!;
const K = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db = createClient(U, K, { auth: { persistSession: false } });
const H = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type,x-ingest-token",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};
const out = (x: unknown, s = 200) => new Response(JSON.stringify(x), { status: s, headers: H });
async function sha(v: string) { const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v)); return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join(""); }
function clean(v: unknown, max = 2000) { return typeof v === "string" ? v.replace(/\u0000/g, "").trim().slice(0, max) : null; }
function classify(text: string) {
  const t = text.replace(/\s+/g, " ");
  if (/チップ|サポートされ|サポートを受け/.test(t)) return "tip";
  if (/購入され|購入しました|売れました|購入があり/.test(t)) return "purchase";
  if (/マガジン.{0,30}追加|マガジンに追加/.test(t)) return "magazine";
  if (/返信/.test(t)) return "reply";
  if (/コメント/.test(t)) return "comment";
  if (/スキ/.test(t)) return "like";
  if (/フォロー/.test(t)) return "follow";
  if (/高評価/.test(t)) return "rating";
  if (/ポイント/.test(t)) return "points";
  return "other";
}
async function identity(req: Request) {
  const raw = req.headers.get("X-Ingest-Token") || "";
  if (!raw) throw new Error("INGEST_TOKEN_REQUIRED");
  const now = new Date().toISOString();
  const { data, error } = await db.from("insight_notification_ingest_tokens").select("member_id,expires_at").eq("token_hash", await sha(raw)).is("revoked_at", null).gt("expires_at", now).maybeSingle();
  if (error || !data?.member_id) throw new Error("INGEST_TOKEN_INVALID");
  const memberId = String(data.member_id);
  const { data: profile } = await db.from("insight_notification_profiles").select("note_urlname").eq("member_id", memberId).maybeSingle();
  const noteId = String(profile?.note_urlname || (memberId === "owner" ? "ss_yr" : "")).toLowerCase();
  if (!noteId) throw new Error("INGEST_ACCOUNT_UNKNOWN");
  return { memberId, noteId };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: H });
  if (req.method !== "POST") return out({ ok: false, error: "METHOD_NOT_ALLOWED" }, 405);
  try {
    const who = await identity(req);
    const body = await req.json().catch(() => ({}));
    const suppliedNoteId = String(body?.noteId || "").trim().replace(/^@/, "").toLowerCase();
    if (!suppliedNoteId || suppliedNoteId !== who.noteId) return out({ ok: false, error: "NOTIFICATION_ACCOUNT_MISMATCH", expectedNoteId: who.noteId }, 409);
    const incoming = Array.isArray(body?.notifications) ? body.notifications.slice(0, 1000) : [];
    let inserted = 0;
    for (const item of incoming) {
      const raw = clean(item?.raw_text ?? item?.text, 3000);
      if (!raw || raw.length < 2) continue;
      const sourceUrl = clean(item?.source_url, 1200), occurred = clean(item?.occurred_at, 80);
      const fingerprint = clean(item?.fingerprint, 128) || await sha(`${raw}|${sourceUrl || ""}|${occurred || ""}`);
      const { error } = await db.from("insight_notifications").insert({
        member_id: who.memberId,
        fingerprint,
        notification_type: clean(item?.notification_type, 40) || classify(raw),
        raw_text: raw,
        actor_name: clean(item?.actor_name, 200),
        actor_url: clean(item?.actor_url, 1200),
        target_title: clean(item?.target_title, 500),
        target_url: clean(item?.target_url, 1200),
        source_url: sourceUrl,
        occurred_at: occurred && !Number.isNaN(Date.parse(occurred)) ? new Date(occurred).toISOString() : null,
        meta: { ...(item?.meta && typeof item.meta === "object" ? item.meta : {}), synced_note_id: who.noteId },
      });
      if (!error) inserted++;
      else if (error.code !== "23505") throw error;
    }
    await db.from("insight_notification_sync_runs").insert({ member_id: who.memberId, inserted_count: inserted, received_count: incoming.length, source: "browser-account-verified" });
    return out({ ok: true, noteId: who.noteId, received: incoming.length, inserted });
  } catch (e) {
    const message = e instanceof Error ? e.message : "INGEST_ERROR";
    return out({ ok: false, error: message }, /REQUIRED|INVALID|UNKNOWN/.test(message) ? 401 : 500);
  }
});
