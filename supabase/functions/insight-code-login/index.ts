import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
const ORIGIN = "https://mumei-s.github.io";
const SESSION_MS = 1000 * 60 * 60 * 24 * 365 * 10;

function cors(req: Request) {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": origin === ORIGIN ? origin : ORIGIN,
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Content-Type": "application/json; charset=utf-8",
    "Vary": "Origin",
  };
}
function json(req: Request, data: unknown, status = 200) { return new Response(JSON.stringify(data), { status, headers: cors(req) }); }
function clean(value: unknown, max = 120) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
async function sha256(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map((value) => value.toString(16).padStart(2, "0")).join("");
}
function randomHex(bytes = 36) {
  const values = crypto.getRandomValues(new Uint8Array(bytes));
  return [...values].map((value) => value.toString(16).padStart(2, "0")).join("");
}
function safeApp(app: any) {
  return { id: app.id, noteId: app.note_id, displayName: app.display_name, imageUrl: app.image_url, status: app.status, approvedAt: app.approved_at, verifiedAt: app.verified_at };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  try {
    if (req.method !== "POST") return json(req, { ok: false, error: "METHOD_NOT_ALLOWED" }, 405);
    const body = await req.json().catch(() => ({}));
    const passcode = clean(body?.passcode).toUpperCase();
    if (!/^INSIGHT-[A-F0-9]{8}$/.test(passcode)) throw new Error("LOGIN_CODE_INVALID");

    const hash = await sha256(passcode);
    const { data: rows, error } = await sb.from("insight_access_applications").select("*").eq("verification_code_hash", hash).eq("status", "active").limit(2);
    if (error) throw error;
    if (!rows?.length) throw new Error("LOGIN_INVALID");
    if (rows.length !== 1) throw new Error("LOGIN_CODE_CONFLICT");

    const app = rows[0];
    const rawToken = randomHex();
    const now = Date.now();
    const { error: sessionError } = await sb.from("insight_member_sessions").insert({
      application_id: app.id,
      token_hash: await sha256(rawToken),
      expires_at: new Date(now + SESSION_MS).toISOString(),
      last_seen_at: new Date(now).toISOString(),
    });
    if (sessionError) throw sessionError;
    return json(req, { ok: true, memberToken: rawToken, application: safeApp(app) });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = /LOGIN_CODE_INVALID|LOGIN_INVALID/.test(message) ? 401 : /LOGIN_CODE_CONFLICT/.test(message) ? 409 : 500;
    return json(req, { ok: false, error: message }, status);
  }
});
