import { createClient } from "npm:@supabase/supabase-js@2";

const URL = Deno.env.get("SUPABASE_URL")!;
const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db = createClient(URL, KEY, { auth: { persistSession: false } });
const CORS = {
  "Access-Control-Allow-Origin": "https://mumei-s.github.io",
  "Access-Control-Allow-Headers": "content-type,x-owner-token",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store, max-age=0",
};
const out = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: CORS });

async function sha(value: string) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function isOwner(req: Request) {
  const token = req.headers.get("X-Owner-Token") || "";
  if (!token) return false;
  const { data } = await db.from("unified_owner_sessions").select("id")
    .eq("token_hash", await sha(token)).is("revoked_at", null)
    .gt("expires_at", new Date().toISOString()).maybeSingle();
  return Boolean(data?.id);
}

function publicMember(value: any) {
  const noteId = String(value?.noteUrlname || "").trim();
  const id = String(value?.id || "").trim();
  if (value?.status !== "active" || !id || !/^[A-Za-z0-9_-]{2,64}$/.test(noteId)) return null;
  return {
    member_id: id.slice(0, 100),
    note_id: noteId,
    display_name: String(value?.noteNickname || noteId).slice(0, 160),
    image_url: typeof value?.noteImageUrl === "string" && /^https:\/\//.test(value.noteImageUrl) ? value.noteImageUrl.slice(0, 1200) : null,
    role: value?.role === "owner" ? "owner" : "member",
    active: true,
  };
}

async function readPublic() {
  const { data, error } = await db.from("insight_participants_public")
    .select("member_id,note_id,display_name,image_url,role,synced_at")
    .eq("active", true).order("role", { ascending: false }).order("display_name");
  if (error) throw error;
  const participants = (data || []).map((row: any) => ({
    id: row.member_id,
    note_id: row.note_id,
    display_name: row.display_name,
    image_url: row.image_url,
    role: row.role,
  }));
  const items = participants.map((participant: any) => ({
    id: participant.id,
    noteUrlname: participant.note_id,
    noteNickname: participant.display_name,
    noteImageUrl: participant.image_url,
    role: participant.role,
    profileUrl: `https://note.com/${participant.note_id}`,
  }));
  return { ok: true, count: participants.length, participants, items };
}

async function sync(body: any) {
  const rows = (Array.isArray(body?.members) ? body.members : []).slice(0, 500).map(publicMember).filter(Boolean);
  if (!rows.some((row: any) => row.role === "owner" && row.note_id === "ss_yr")) throw new Error("OWNER_ROW_REQUIRED");
  const stamp = new Date().toISOString();
  const values = rows.map((row: any) => ({ ...row, synced_at: stamp }));
  const { error: upsertError } = await db.from("insight_participants_public").upsert(values, { onConflict: "member_id" });
  if (upsertError) throw upsertError;
  const { error: staleError } = await db.from("insight_participants_public").update({ active: false }).lt("synced_at", stamp);
  if (staleError) throw staleError;
  return readPublic();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return out({ error: "METHOD_NOT_ALLOWED" }, 405);
  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "public");
    if (action === "public") return out(await readPublic());
    if (action === "sync") {
      if (!(await isOwner(req))) return out({ error: "OWNER_LOGIN_REQUIRED" }, 401);
      return out(await sync(body));
    }
    return out({ error: "UNKNOWN_ACTION" }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "INSIGHT_PARTICIPANTS_ERROR";
    return out({ error: message }, message.includes("REQUIRED") ? 400 : 500);
  }
});
