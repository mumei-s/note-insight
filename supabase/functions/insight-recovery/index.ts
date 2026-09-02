import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
const ORIGIN = "https://mumei-s.github.io";
const NOTE_ORIGIN = "https://note.com";
const SESSION_MS = 1000 * 60 * 60 * 24 * 365 * 10;

function headers(req: Request) {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": origin === ORIGIN ? origin : ORIGIN,
    "Access-Control-Allow-Headers": "content-type,x-insight-recovery",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Content-Type": "application/json; charset=utf-8",
    "Vary": "Origin",
  };
}
function json(req: Request, data: unknown, status = 200) { return new Response(JSON.stringify(data), { status, headers: headers(req) }); }
function clean(value: unknown, max = 300) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
function noteId(value: unknown) {
  const raw = clean(value, 300);
  let id = raw;
  if (/^https?:\/\//i.test(raw)) {
    try {
      const url = new URL(raw);
      if (url.hostname !== "note.com" && url.hostname !== "www.note.com") return "";
      id = url.pathname.split("/").filter(Boolean)[0] || "";
    } catch { return ""; }
  }
  id = id.replace(/^@/, "").trim();
  return /^[A-Za-z0-9_-]{1,80}$/.test(id) ? id.toLowerCase() : "";
}
async function sha256(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map((item) => item.toString(16).padStart(2, "0")).join("");
}
function randomHex(bytes = 32) {
  const value = crypto.getRandomValues(new Uint8Array(bytes));
  return [...value].map((item) => item.toString(16).padStart(2, "0")).join("");
}
function randomCode() {
  const value = crypto.getRandomValues(new Uint8Array(4));
  return "INSIGHT-" + [...value].map((item) => item.toString(16).padStart(2, "0")).join("").toUpperCase();
}
async function fetchCreator(id: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(`${NOTE_ORIGIN}/api/v2/creators/${encodeURIComponent(id)}`, {
      headers: { Accept: "application/json", "User-Agent": "Mumei-S-note-INSIGHT/4.0 (+recovery-profile-verification)" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(response.status === 404 ? "NOTE_ACCOUNT_NOT_FOUND" : "NOTE_PROFILE_UNAVAILABLE");
    const payload = await response.json().catch(() => ({}));
    const data = payload?.data || {};
    return {
      noteId: String(data.urlname || id).toLowerCase(),
      displayName: String(data.nickname || id).slice(0, 300),
      imageUrl: typeof (data.profileImageUrl ?? data.profile_image_url) === "string" ? (data.profileImageUrl ?? data.profile_image_url) : null,
      profile: String(data.profile || data.description || ""),
    };
  } finally { clearTimeout(timer); }
}
async function issueSession(applicationId: string) {
  const raw = randomHex(36);
  const now = Date.now();
  const { error } = await sb.from("insight_member_sessions").insert({ application_id: applicationId, token_hash: await sha256(raw), expires_at: new Date(now + SESSION_MS).toISOString() });
  if (error) throw error;
  return raw;
}
function safeApp(app: any) {
  return { id: app.id, noteId: app.note_id, displayName: app.display_name, imageUrl: app.image_url, status: app.status };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: headers(req) });
  try {
    if (req.method !== "POST") return json(req, { ok: false, error: "METHOD_NOT_ALLOWED" }, 405);
    const body = await req.json().catch(() => ({}));
    const action = clean(body?.action, 80);

    if (action === "start") {
      const id = noteId(body?.noteInput);
      if (!id) throw new Error("NOTE_ID_INVALID");
      const creator = await fetchCreator(id);
      const { data: app, error } = await sb.from("insight_access_applications").select("*").ilike("note_id", creator.noteId).maybeSingle();
      if (error) throw error;
      if (!app || app.status !== "active") throw new Error("INSIGHT_MEMBER_NOT_ACTIVE");

      const recoveryToken = randomHex(32);
      const code = randomCode();
      const now = new Date().toISOString();
      const { data: next, error: updateError } = await sb.from("insight_access_applications").update({
        display_name: creator.displayName,
        image_url: creator.imageUrl,
        applicant_token_hash: await sha256(recoveryToken),
        verification_code_hash: await sha256(code),
        verification_code_plain: code,
        verification_attempts: 0,
        updated_at: now,
      }).eq("id", app.id).select().single();
      if (updateError) throw updateError;
      return json(req, { ok: true, recoveryToken, verificationCode: code, application: safeApp(next) });
    }

    if (action === "verify") {
      const raw = req.headers.get("X-Insight-Recovery") || "";
      if (!raw) throw new Error("RECOVERY_TOKEN_REQUIRED");
      const { data: app, error } = await sb.from("insight_access_applications").select("*").eq("applicant_token_hash", await sha256(raw)).maybeSingle();
      if (error || !app) throw new Error("RECOVERY_TOKEN_INVALID");
      if (app.status !== "active" || !app.verification_code_plain) throw new Error("RECOVERY_NOT_READY");

      const attempts = Number(app.verification_attempts || 0) + 1;
      if (attempts > 30) throw new Error("VERIFICATION_ATTEMPTS_EXCEEDED");
      await sb.from("insight_access_applications").update({ verification_attempts: attempts, updated_at: new Date().toISOString() }).eq("id", app.id);

      const creator = await fetchCreator(app.note_id);
      if (!creator.profile.includes(app.verification_code_plain)) throw new Error("PROFILE_CODE_NOT_FOUND");

      const now = new Date().toISOString();
      const { data: verified, error: verifyError } = await sb.from("insight_access_applications").update({
        display_name: creator.displayName,
        image_url: creator.imageUrl,
        verification_code_plain: null,
        verification_code_hash: null,
        verified_at: now,
        updated_at: now,
      }).eq("id", app.id).select().single();
      if (verifyError) throw verifyError;
      const memberToken = await issueSession(verified.id);
      return json(req, { ok: true, memberToken, application: safeApp(verified), message: "PROFILE_VERIFIED_RESTORE_BIO" });
    }

    throw new Error("ACTION_NOT_SUPPORTED");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = /NOT_FOUND/.test(message) ? 404 : /INVALID|REQUIRED|NOT_ACTIVE|NOT_READY|PROFILE_CODE|ATTEMPTS/.test(message) ? 401 : /ACTION_NOT_SUPPORTED/.test(message) ? 400 : 500;
    return json(req, { ok: false, error: message }, status);
  }
});
