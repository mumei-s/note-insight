import { createClient } from "npm:@supabase/supabase-js@2";

const URL = Deno.env.get("SUPABASE_URL")!;
const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const INSIGHT = "https://note-like-tracker.sabosan0404.chatgpt.site";
const db = createClient(URL, KEY, { auth: { persistSession: false } });
const CORS = {
  "Access-Control-Allow-Origin": "https://mumei-s.github.io",
  "Access-Control-Allow-Headers": "content-type,x-insight-member,x-insight-device,x-owner-token",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store, max-age=0",
};
const modes = ["choice", "tap", "puzzle", "shoot"] as const;
const out = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status, headers: CORS });
const publicUrl = (path: string | null | undefined) =>
  path ? URL + "/storage/v1/object/public/creator-images/" + path : null;
const inverse = (result: string) =>
  result === "win" ? "lose" : result === "lose" ? "win" : "draw";
const rate = (wins: number, games: number) =>
  games ? Math.round((wins / games) * 1000) / 10 : 0;

async function sha(value: string) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(hash)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function owner(req: Request) {
  const raw = req.headers.get("X-Owner-Token") || "";
  if (!raw) return false;
  const { data } = await db
    .from("unified_owner_sessions")
    .select("id")
    .eq("token_hash", await sha(raw))
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  return Boolean(data?.id);
}

async function member(req: Request) {
  if (await owner(req)) return { noteUrlname: "ss_yr", status: "active", role: "owner" };
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

async function ownSubmission(req: Request) {
  const current = await member(req);
  const { data, error } = await db
    .from("creator_submissions")
    .select("id,note_id,display_name,status,battle_opt_in")
    .eq("series_id", "adventure")
    .eq("note_id", current.noteUrlname)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("DIRECTORY_INVITE_REQUIRED");
  if (data.status !== "approved") throw new Error("DIRECTORY_APPROVAL_REQUIRED");
  if (data.battle_opt_in !== true) throw new Error("BATTLE_OPT_IN_REQUIRED");
  return data;
}

function blankByGame() {
  return {
    choice: { wins: 0, draws: 0, losses: 0, games: 0, winRate: 0 },
    tap: { wins: 0, draws: 0, losses: 0, games: 0, winRate: 0 },
    puzzle: { wins: 0, draws: 0, losses: 0, games: 0, winRate: 0 },
    shoot: { wins: 0, draws: 0, losses: 0, games: 0, winRate: 0 },
  };
}

async function ranking() {
  const [
    { data: duels, error: duelError },
    { data: creators, error: creatorError },
  ] = await Promise.all([
    db
      .from("creator_duels")
      .select("challenger_id,defender_id,game_mode,result,score,created_at")
      .eq("series_id", "adventure")
      .order("created_at", { ascending: false })
      .limit(50000),
    db
      .from("creator_submissions")
      .select("id,note_id,display_name,status,battle_opt_in")
      .eq("series_id", "adventure")
      .eq("status", "approved")
      .eq("is_demo", false),
  ]);
  if (duelError) throw duelError;
  if (creatorError) throw creatorError;

  const people = new Map((creators || []).map((creator: any) => [String(creator.id), creator]));
  const creatorIds = [...people.keys()];
  const { data: cardRows, error: cardError } = creatorIds.length
    ? await db
        .from("creator_images")
        .select("submission_id,storage_path,position")
        .in("submission_id", creatorIds)
        .eq("position", 0)
    : { data: [] as any[], error: null };
  if (cardError) throw cardError;
  const mainCards = new Map(
    (cardRows || []).map((card: any) => [String(card.submission_id), publicUrl(card.storage_path)]),
  );

  const stats = new Map<string, any>();
  const add = (id: string, result: string, score: number, at: string, gameMode: string) => {
    const person = people.get(id);
    if (!person || !modes.includes(gameMode as any)) return;
    if (!stats.has(id)) {
      stats.set(id, {
        participantId: id,
        noteId: person.note_id,
        displayName: person.display_name || person.note_id,
        mainCardUrl: mainCards.get(id) || null,
        wins: 0,
        draws: 0,
        losses: 0,
        games: 0,
        winRate: 0,
        points: 0,
        bestScore: 0,
        lastBattleAt: null,
        byGame: blankByGame(),
      });
    }
    const row = stats.get(id);
    const mode = row.byGame[gameMode];
    row.games += 1;
    mode.games += 1;
    if (result === "win") {
      row.wins += 1;
      mode.wins += 1;
      row.points += 3;
    } else if (result === "draw") {
      row.draws += 1;
      mode.draws += 1;
      row.points += 1;
    } else {
      row.losses += 1;
      mode.losses += 1;
    }
    row.bestScore = Math.max(row.bestScore, Number(score || 0));
    if (!row.lastBattleAt || at > row.lastBattleAt) row.lastBattleAt = at;
  };

  for (const duel of duels || []) {
    add(
      String(duel.challenger_id),
      duel.result,
      Number(duel.score || 0),
      duel.created_at,
      duel.game_mode,
    );
    if (duel.defender_id) {
      add(
        String(duel.defender_id),
        inverse(duel.result),
        0,
        duel.created_at,
        duel.game_mode,
      );
    }
  }

  const rows = [...stats.values()]
    .map((row) => {
      row.winRate = rate(row.wins, row.games);
      for (const mode of modes) {
        row.byGame[mode].winRate = rate(row.byGame[mode].wins, row.byGame[mode].games);
      }
      return row;
    })
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.wins - a.wins ||
        b.bestScore - a.bestScore ||
        a.losses - b.losses,
    )
    .map((row, index) => ({ rank: index + 1, ...row }));

  return {
    total: rows.length,
    rows: rows.slice(0, 100),
    rule: "勝利3点・引分1点",
    detailedHistoryPublic: false,
  };
}

async function privateHistory(submission: any) {
  const { data, error } = await db
    .from("creator_duels")
    .select(
      "id,challenger_id,defender_id,official_opponent_id,game_mode,result,score,challenger_card_position,opponent_card_position,created_at,challenger:creator_submissions!creator_duels_challenger_id_fkey(id,note_id,display_name),defender:creator_submissions!creator_duels_defender_id_fkey(id,note_id,display_name),official:battle_opponents(id,name,image_path)",
    )
    .eq("series_id", "adventure")
    .or("challenger_id.eq." + submission.id + ",defender_id.eq." + submission.id)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;

  const ids = new Set<string>([String(submission.id)]);
  for (const duel of data || []) {
    if (duel.challenger_id) ids.add(String(duel.challenger_id));
    if (duel.defender_id) ids.add(String(duel.defender_id));
  }
  const { data: images, error: imageError } = ids.size
    ? await db
        .from("creator_images")
        .select("submission_id,storage_path,position")
        .in("submission_id", [...ids])
        .order("position")
    : { data: [] as any[], error: null };
  if (imageError) throw imageError;

  const cards = new Map<string, string | null>();
  const firstCards = new Map<string, { position: number; url: string | null }>();
  for (const image of images || []) {
    const id = String(image.submission_id);
    const position = Number(image.position);
    const url = publicUrl(image.storage_path);
    cards.set(id + ":" + position, url);
    if (!firstCards.has(id)) firstCards.set(id, { position, url });
  }

  return (data || []).map((duel: any) => {
    const challenged = String(duel.challenger_id) === String(submission.id);
    const playerPosition = Number(
      challenged ? duel.challenger_card_position : duel.opponent_card_position,
    ) || 0;
    const opponentPosition = Number(
      challenged ? duel.opponent_card_position : duel.challenger_card_position,
    ) || 0;
    const opponent = challenged ? (duel.defender || duel.official) : duel.challenger;
    const opponentId = opponent?.id ? String(opponent.id) : null;
    const isOfficial = Boolean(duel.official_opponent_id);
    const opponentCardUrl = isOfficial
      ? publicUrl(duel.official?.image_path)
      : opponentId
        ? cards.get(opponentId + ":" + opponentPosition) ??
          firstCards.get(opponentId)?.url ??
          null
        : null;
    const playerCard =
      cards.get(String(submission.id) + ":" + playerPosition) ??
      firstCards.get(String(submission.id))?.url ??
      null;

    return {
      id: duel.id,
      gameMode: duel.game_mode,
      result: challenged ? duel.result : inverse(duel.result),
      score: duel.score,
      createdAt: duel.created_at,
      opponentType: isOfficial ? "official" : "creator",
      playerCard: { position: playerPosition, url: playerCard },
      opponent: opponent
        ? {
            id: opponent.id,
            noteId: opponent.note_id || null,
            name:
              opponent.display_name ||
              opponent.name ||
              opponent.note_id ||
              "対戦相手",
            cardPosition: opponentPosition,
            cardUrl: opponentCardUrl,
          }
        : {
            id: null,
            noteId: null,
            name: "公開終了した対戦相手",
            cardPosition: opponentPosition,
            cardUrl: null,
          },
    };
  });
}

async function record(req: Request, body: any) {
  const submission = await ownSubmission(req);
  const mode = String(body?.gameMode || "");
  const result = String(body?.result || "");
  const type = String(body?.opponentType || "");
  const opponentId = String(body?.opponentId || "");
  const matchKey = String(body?.matchKey || "");
  const playerCardPosition = Number(body?.playerCardPosition);
  const opponentCardPosition = Number(body?.opponentCardPosition);

  if (!modes.includes(mode as any) || !["win", "draw", "lose"].includes(result)) {
    throw new Error("INVALID_BATTLE_RESULT");
  }
  if (!/^[A-Za-z0-9_-]{12,100}$/.test(matchKey)) throw new Error("INVALID_MATCH_KEY");
  if (
    !Number.isInteger(playerCardPosition) ||
    playerCardPosition < 0 ||
    playerCardPosition > 2 ||
    !Number.isInteger(opponentCardPosition) ||
    opponentCardPosition < 0 ||
    opponentCardPosition > 2
  ) {
    throw new Error("INVALID_CARD_POSITION");
  }

  const { data: ownCard, error: ownCardError } = await db
    .from("creator_images")
    .select("id")
    .eq("submission_id", submission.id)
    .eq("position", playerCardPosition)
    .maybeSingle();
  if (ownCardError) throw ownCardError;
  if (!ownCard) throw new Error("PLAYER_CARD_NOT_AVAILABLE");

  const row: Record<string, unknown> = {
    series_id: "adventure",
    challenger_id: submission.id,
    game_mode: mode,
    result,
    score: Math.min(1000000, Math.max(0, Math.round(Number(body?.score || 0)))),
    match_key: matchKey,
    challenger_card_position: playerCardPosition,
    opponent_card_position: opponentCardPosition,
  };

  if (type === "creator") {
    const { data: opponent } = await db
      .from("creator_submissions")
      .select("id")
      .eq("id", opponentId)
      .eq("series_id", "adventure")
      .eq("status", "approved")
      .eq("battle_opt_in", true)
      .maybeSingle();
    if (!opponent || opponent.id === submission.id) {
      throw new Error("OPPONENT_NOT_AVAILABLE");
    }
    const { data: opponentCard, error: opponentCardError } = await db
      .from("creator_images")
      .select("id")
      .eq("submission_id", opponent.id)
      .eq("position", opponentCardPosition)
      .maybeSingle();
    if (opponentCardError) throw opponentCardError;
    if (!opponentCard) throw new Error("OPPONENT_CARD_NOT_AVAILABLE");
    row.defender_id = opponent.id;
  } else if (type === "official") {
    if (opponentCardPosition !== 0) throw new Error("INVALID_CARD_POSITION");
    const { data: opponent } = await db
      .from("battle_opponents")
      .select("id")
      .eq("id", opponentId)
      .eq("series_id", "adventure")
      .eq("enabled", true)
      .maybeSingle();
    if (!opponent) throw new Error("OPPONENT_NOT_AVAILABLE");
    row.official_opponent_id = opponent.id;
  } else {
    throw new Error("INVALID_OPPONENT_TYPE");
  }

  const { data, error } = await db
    .from("creator_duels")
    .insert(row)
    .select("id")
    .single();
  if (error && error.code !== "23505") throw error;
  return {
    saved: !error,
    duplicate: error?.code === "23505",
    id: data?.id ?? null,
    history: await privateHistory(submission),
    ranking: await ranking(),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return out({ error: "METHOD_NOT_ALLOWED" }, 405);
  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "ranking");
    if (action === "ranking") return out({ ok: true, ranking: await ranking() });
    if (action === "me") {
      const submission = await ownSubmission(req);
      return out({
        ok: true,
        participant: submission,
        history: await privateHistory(submission),
        ranking: await ranking(),
      });
    }
    if (action === "record") return out({ ok: true, ...(await record(req, body)) });
    if (action === "owner-reset") {
      if (!(await owner(req))) return out({ error: "OWNER_LOGIN_REQUIRED" }, 401);
      const participantId = String(body?.participantId || "");
      if (participantId) {
        await db
          .from("creator_duels")
          .delete()
          .or("challenger_id.eq." + participantId + ",defender_id.eq." + participantId);
      } else {
        if (body?.confirm !== "RESET_ALL") {
          return out({ error: "RESET_CONFIRM_REQUIRED" }, 400);
        }
        await db.from("creator_duels").delete().eq("series_id", "adventure");
      }
      return out({ ok: true, ranking: await ranking() });
    }
    return out({ error: "UNKNOWN_ACTION" }, 400);
  } catch (error) {
    console.error(error);
    const raw = error && typeof error === "object" ? error as Record<string, unknown> : null;
    const message =
      error instanceof Error
        ? error.message
        : typeof raw?.message === "string"
          ? raw.message
          : "BATTLE_LEDGER_ERROR";
    const status = /LOGIN|SESSION/.test(message)
      ? 401
      : /APPROVAL|INVITE|OPT_IN|NOT_AVAILABLE/.test(message)
        ? 403
        : /INVALID|REQUIRED/.test(message)
          ? 400
          : 500;
    return out({ error: message }, status);
  }
});
