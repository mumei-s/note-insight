import { createClient } from "npm:@supabase/supabase-js@2";

const U = Deno.env.get("SUPABASE_URL")!;
const K = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db = createClient(U, K, { auth: { persistSession: false } });
const H = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type,x-owner-token,x-insight-token",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};
const out = (x: unknown, s = 200) => new Response(JSON.stringify(x), { status: s, headers: H });

async function sha(v: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
async function owner(req: Request) {
  const raw = req.headers.get("X-Owner-Token") || "";
  if (!raw) return false;
  const { data } = await db.from("unified_owner_sessions").select("id").eq("token_hash", await sha(raw)).is("revoked_at", null).gt("expires_at", new Date().toISOString()).maybeSingle();
  return !!data?.id;
}
async function participant(req: Request) {
  const raw = req.headers.get("X-Insight-Token") || "";
  if (!raw) return null;
  const now = new Date().toISOString();
  const { data: s } = await db.from("insight_member_sessions").select("application_id").eq("token_hash", await sha(raw)).is("revoked_at", null).gt("expires_at", now).maybeSingle();
  if (!s?.application_id) return null;
  const { data: app } = await db.from("insight_access_applications").select("id,note_id,display_name,image_url,status,verified_at").eq("id", s.application_id).maybeSingle();
  if (!app?.id || app.status !== "active") return null;
  await db.from("insight_notification_profiles").upsert({
    member_id: String(app.id),
    note_urlname: app.note_id,
    note_nickname: app.display_name || app.note_id,
    role: "member",
    verified_at: app.verified_at || now,
    public_watch_enabled: true,
    updated_at: now,
  }, { onConflict: "member_id" });
  return { id: String(app.id), noteId: String(app.note_id), name: app.display_name || app.note_id, role: "member" };
}
async function identity(req: Request, preferred = "member") {
  if (preferred === "owner" && await owner(req)) return { id: "owner", noteId: "ss_yr", name: "無名S note", role: "owner" };
  const p = await participant(req);
  if (p) return p;
  if (await owner(req)) return { id: "owner", noteId: "ss_yr", name: "無名S note", role: "owner" };
  throw new Error("NOTIFICATION_LOGIN_REQUIRED");
}
function ingestToken() { return crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", ""); }
function pairCode() { const n = crypto.getRandomValues(new Uint32Array(1))[0] % 100000000; return String(n).padStart(8, "0"); }
async function profile(memberId: string) {
  const { data } = await db.from("insight_notification_profiles").select("note_urlname,note_nickname,verified_at").eq("member_id", memberId).maybeSingle();
  return data || null;
}
async function issueToken(memberId: string) {
  const raw = ingestToken(), now = new Date(), exp = new Date(now.getTime() + 3650 * 24 * 60 * 60 * 1000).toISOString();
  await db.from("insight_notification_ingest_tokens").update({ revoked_at: now.toISOString() }).eq("member_id", memberId).is("revoked_at", null);
  const { error } = await db.from("insight_notification_ingest_tokens").insert({ member_id: memberId, token_hash: await sha(raw), purpose: "note_notification_auto_sync", expires_at: exp });
  if (error) throw error;
  const p = await profile(memberId);
  return { ingestToken: raw, expiresAt: exp, memberId, noteId: p?.note_urlname || null };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: H });
  if (req.method !== "POST") return out({ ok: false, error: "METHOD_NOT_ALLOWED" }, 405);
  try {
    const b = await req.json().catch(() => ({})), action = String(b?.action || "stats"), preferred = String(b?.role || "member");

    if (action === "pair-exchange") {
      const code = String(b?.code || "").replace(/\D/g, "").slice(0, 8);
      if (code.length !== 8) return out({ ok: false, error: "PAIR_CODE_INVALID" }, 400);
      const hash = await sha(code), now = new Date().toISOString();
      const { data, error } = await db.from("insight_notification_pair_codes").select("id,member_id,expires_at,used_at").eq("code_hash", hash).is("used_at", null).gt("expires_at", now).maybeSingle();
      if (error) throw error;
      if (!data?.id) return out({ ok: false, error: "PAIR_CODE_EXPIRED" }, 401);
      const token = await issueToken(String(data.member_id));
      await db.from("insight_notification_pair_codes").update({ used_at: now }).eq("id", data.id);
      return out({ ok: true, ...token });
    }

    const who = await identity(req, preferred);
    if (action === "stats") {
      const { data, error } = await db.from("insight_notifications").select("notification_type,captured_at").eq("member_id", who.id).order("captured_at", { ascending: false }).limit(2000);
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const r of data || []) counts[r.notification_type] = (counts[r.notification_type] || 0) + 1;
      return out({ ok: true, memberId: who.id, noteId: who.noteId, name: who.name, role: who.role, total: (data || []).length, counts, last: (data || [])[0]?.captured_at ?? null });
    }
    if (action === "pair-start") {
      const p = await profile(who.id);
      if (who.role !== "owner" && !p?.verified_at) return out({ ok: false, error: "PROFILE_VERIFICATION_REQUIRED" }, 401);
      const code = pairCode(), now = new Date(), exp = new Date(now.getTime() + 10 * 60 * 1000).toISOString();
      await db.from("insight_notification_pair_codes").delete().eq("member_id", who.id).is("used_at", null);
      const { error } = await db.from("insight_notification_pair_codes").insert({ member_id: who.id, code_hash: await sha(code), expires_at: exp });
      if (error) throw error;
      const account = encodeURIComponent(who.noteId || "");
      return out({ ok: true, memberId: who.id, noteId: who.noteId, pairingCode: code, expiresAt: exp, noteUrl: `https://note.com/?mumei_notify=1&mumei_pair=${code}&mumei_account=${account}` });
    }
    if (action === "issue") return out({ ok: true, ...await issueToken(who.id) });
    return out({ ok: false, error: "UNKNOWN_ACTION" }, 400);
  } catch (e) {
    console.error(e);
    const message = e instanceof Error ? e.message : "IMPORT_TOKEN_ERROR";
    return out({ ok: false, error: message }, /REQUIRED|INVALID/.test(message) ? 401 : 500);
  }
});
