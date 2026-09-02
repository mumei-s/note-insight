import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
const ORIGIN = "https://mumei-s.github.io";
const SESSION_MS = 1000 * 60 * 60 * 24 * 365 * 10;

function headers(req: Request) {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": origin === ORIGIN ? origin : ORIGIN,
    "Access-Control-Allow-Headers": "content-type,x-insight-token",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Content-Type": "application/json; charset=utf-8",
    "Vary": "Origin",
  };
}
function json(req: Request, data: unknown, status = 200) { return new Response(JSON.stringify(data), { status, headers: headers(req) }); }
async function sha256(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map((value) => value.toString(16).padStart(2, "0")).join("");
}
async function session(req: Request) {
  const raw = req.headers.get("X-Insight-Token") || "";
  if (!raw) throw new Error("INSIGHT_LOGIN_REQUIRED");
  const { data: row, error } = await sb.from("insight_member_sessions").select("id,application_id,expires_at,revoked_at").eq("token_hash", await sha256(raw)).maybeSingle();
  if (error || !row || row.revoked_at || Date.parse(row.expires_at) <= Date.now()) throw new Error("INSIGHT_SESSION_INVALID");
  const { data: app, error: appError } = await sb.from("insight_access_applications").select("*").eq("id", row.application_id).maybeSingle();
  if (appError || !app || app.status !== "active") throw new Error("INSIGHT_MEMBER_INACTIVE");
  return { raw, row, app };
}
async function setPublic(app: any, active: boolean) {
  await sb.from("insight_participants_public").upsert({ member_id: String(app.id), note_id: app.note_id, display_name: app.display_name || `@${app.note_id}`, image_url: app.image_url || null, role: "member", active, synced_at: new Date().toISOString() }, { onConflict: "member_id" });
  await sb.from("insight_notification_profiles").upsert({ member_id: String(app.id), note_urlname: app.note_id, note_nickname: app.display_name || app.note_id, role: "member", verified_at: active ? (app.verified_at || new Date().toISOString()) : null, verification_code: null, public_watch_enabled: active, watch_error: null, updated_at: new Date().toISOString() }, { onConflict: "member_id" });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: headers(req) });
  try {
    if (req.method !== "POST") return json(req, { ok: false, error: "METHOD_NOT_ALLOWED" }, 405);
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "touch").trim();
    const current = await session(req);
    const now = new Date().toISOString();

    if (action === "touch") {
      const expiresAt = new Date(Date.now() + SESSION_MS).toISOString();
      const { error } = await sb.from("insight_member_sessions").update({ last_seen_at: now, expires_at: expiresAt }).eq("id", current.row.id);
      if (error) throw error;
      return json(req, { ok: true, noteId: current.app.note_id, expiresAt });
    }

    if (action === "logout") {
      const { error } = await sb.from("insight_member_sessions").update({ revoked_at: now, last_seen_at: now }).eq("id", current.row.id).is("revoked_at", null);
      if (error) throw error;
      return json(req, { ok: true });
    }

    if (action === "leave") {
      const memberId = String(current.app.id);
      await sb.from("insight_member_sessions").update({ revoked_at: now, last_seen_at: now }).eq("application_id", current.app.id).is("revoked_at", null);
      await sb.from("insight_notification_ingest_tokens").update({ revoked_at: now }).eq("member_id", memberId).is("revoked_at", null);
      await sb.from("insight_notification_pair_codes").delete().eq("member_id", memberId).is("used_at", null);
      const { data: next, error } = await sb.from("insight_access_applications").update({ status: "revoked", verification_code_plain: null, verification_code_hash: null, revoked_at: now, updated_at: now }).eq("id", current.app.id).select().single();
      if (error) throw error;
      await setPublic(next, false);
      return json(req, { ok: true, application: { id: next.id, noteId: next.note_id, status: next.status } });
    }

    throw new Error("ACTION_NOT_SUPPORTED");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = /LOGIN_REQUIRED|SESSION_INVALID|MEMBER_INACTIVE/.test(message) ? 401 : /ACTION_NOT_SUPPORTED/.test(message) ? 400 : 500;
    return json(req, { ok: false, error: message }, status);
  }
});
