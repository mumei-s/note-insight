import { createClient } from "npm:@supabase/supabase-js@2";

const URL = Deno.env.get("SUPABASE_URL")!;
const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const INSIGHT = "https://note-like-tracker.sabosan0404.chatgpt.site";
const db = createClient(URL, KEY, { auth: { persistSession: false } });
const CORS = {
  "Access-Control-Allow-Origin": "https://mumei-s.github.io",
  "Access-Control-Allow-Headers": "content-type,x-owner-token,x-insight-member,x-insight-device",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store, max-age=0",
};
const out = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status, headers: CORS });
const publicUrl = (path: string | null | undefined) =>
  path ? URL + "/storage/v1/object/public/creator-images/" + path : null;

async function isOwner(req: Request) {
  const token = req.headers.get("X-Owner-Token") || "";
  if (!token) return false;
  const response = await fetch(URL + "/functions/v1/unified-owner-access", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Owner-Token": token },
    body: JSON.stringify({ action: "status" }),
  });
  const payload = await response.json().catch(() => ({}));
  return response.ok && payload?.authenticated === true;
}

async function member(req: Request) {
  const token = req.headers.get("X-Insight-Member") || "";
  const device = req.headers.get("X-Insight-Device") || "";
  if (!token || !device) throw new Error("INSIGHT_LOGIN_REQUIRED");
  const response = await fetch(INSIGHT + "/api/member/me", {
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "X-Insight-Member": token,
      "X-Insight-Device": device,
    },
  });
  if (!response.ok) throw new Error("INSIGHT_SESSION_INVALID");
  const value = (await response.json())?.member;
  if (!value?.noteUrlname || (value.status !== "active" && value.role !== "owner")) {
    throw new Error("INSIGHT_APPROVAL_REQUIRED");
  }
  return value;
}

async function requirePlayerCard(req: Request) {
  const current = (await isOwner(req))
    ? { noteUrlname: "ss_yr", status: "active", role: "owner" }
    : await member(req);
  const { data: participant, error } = await db
    .from("creator_submissions")
    .select("id,note_id,status,battle_opt_in")
    .eq("series_id", "adventure")
    .eq("note_id", current.noteUrlname)
    .maybeSingle();
  if (error) throw error;
  if (!participant) throw new Error("DIRECTORY_INVITE_REQUIRED");
  if (participant.status !== "approved") throw new Error("DIRECTORY_APPROVAL_REQUIRED");
  if (participant.battle_opt_in !== true) throw new Error("BATTLE_OPT_IN_REQUIRED");

  const { count, error: cardError } = await db
    .from("creator_images")
    .select("id", { count: "exact", head: true })
    .eq("submission_id", participant.id);
  if (cardError) throw cardError;
  if (!count) throw new Error("BATTLE_CARD_REQUIRED");
  return participant;
}

async function payload(admin = false) {
  let opponentQuery = db
    .from("battle_opponents")
    .select("id,series_id,slot,name,job,rarity,dialogue_pack,image_path,version,enabled,updated_at")
    .eq("series_id", "adventure")
    .order("slot");
  if (!admin) opponentQuery = opponentQuery.eq("enabled", true);

  let creatorQuery = db
    .from("creator_submissions")
    .select("id,note_id,display_name,job,rarity,status,battle_opt_in")
    .eq("series_id", "adventure")
    .eq("status", "approved")
    .eq("is_demo", false)
    .order("approved_at", { ascending: false });
  if (!admin) creatorQuery = creatorQuery.eq("battle_opt_in", true);

  const [
    { data: opponents, error: opponentError },
    { data: creators, error: creatorError },
  ] = await Promise.all([opponentQuery, creatorQuery]);
  if (opponentError) throw opponentError;
  if (creatorError) throw creatorError;

  const ids = (creators || []).map((creator) => creator.id);
  const { data: images, error: imageError } = ids.length
    ? await db
        .from("creator_images")
        .select("submission_id,storage_path,position")
        .in("submission_id", ids)
        .order("position")
    : { data: [] as any[], error: null };
  if (imageError) throw imageError;

  const byCreator = new Map<string, Array<{ position: number; url: string | null }>>();
  for (const image of images || []) {
    const id = String(image.submission_id);
    const current = byCreator.get(id) || [];
    current.push({ position: Number(image.position), url: publicUrl(image.storage_path) });
    byCreator.set(id, current);
  }

  return {
    opponents: (opponents || []).map((opponent) => {
      const imageUrl = publicUrl(opponent.image_path);
      return {
        ...opponent,
        type: "official",
        image_url: imageUrl,
        cards: imageUrl ? [{ position: 0, url: imageUrl }] : [],
      };
    }),
    creators: (creators || [])
      .map((creator) => ({
        ...creator,
        type: "creator",
        images: byCreator.get(String(creator.id)) || [],
      }))
      .filter((creator) => creator.images.length > 0),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return out({ error: "METHOD_NOT_ALLOWED" }, 405);
  try {
    const body = await req.json().catch(() => ({}));
    const admin = body?.action === "admin";
    if (admin) {
      if (!(await isOwner(req))) return out({ error: "OWNER_LOGIN_REQUIRED" }, 401);
    } else {
      await requirePlayerCard(req);
    }
    return out({ ok: true, ...(await payload(admin)) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "GAME_DATA_ERROR";
    const status = /LOGIN|SESSION/.test(message)
      ? 401
      : /APPROVAL|INVITE|OPT_IN|CARD_REQUIRED/.test(message)
        ? 403
        : 500;
    return out({ error: message }, status);
  }
});
