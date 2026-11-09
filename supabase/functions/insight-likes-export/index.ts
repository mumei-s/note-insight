import { createClient } from "npm:@supabase/supabase-js@2.112.4";

const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

const ORIGIN = "https://mumei-s.github.io";

type LikeRow = {
  article_key?: unknown;
  liker_key?: unknown;
  actor_name?: unknown;
  actor_url?: unknown;
  actor_image_url?: unknown;
  liked_at?: unknown;
};

type ArticleRow = {
  article_key?: unknown;
  title?: unknown;
  url?: unknown;
  publish_at?: unknown;
};

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
  try { return match ? decodeURIComponent(match[1]) : ""; } catch { return ""; }
}

function normalizeLike(raw: LikeRow) {
  const likerKey = String(raw?.liker_key || "").trim();
  const actorUrl = String(raw?.actor_url || "").trim();
  const urlname = urlnameFromUrl(actorUrl);
  const identity = likerKey || urlname;
  if (!identity || !urlname) return null;
  return {
    identity,
    row: {
      likerKey: identity,
      urlname,
      creator: String(raw?.actor_name || urlname),
      actorUrl: actorUrl || `https://note.com/${urlname}`,
      actorImageUrl: String(raw?.actor_image_url || ""),
      likedAt: raw?.liked_at ? String(raw.liked_at) : null,
      likedArticleKey: String(raw?.article_key || ""),
    },
  };
}

type HistoryFilter = { fromDate: string; toDate: string; articleKey: string; timezone: string };

function historyFilter(value: unknown): HistoryFilter {
  const raw = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const date = (value: unknown) => {
    const text = String(value || "");
    if (!text) return "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || !Number.isFinite(Date.parse(text + "T00:00:00Z")) || new Date(text + "T00:00:00Z").toISOString().slice(0, 10) !== text) throw new Error("HISTORY_FILTER_INVALID_DATE");
    return text;
  };
  const fromDate = date(raw.fromDate), toDate = date(raw.toDate);
  const articleKey = String(raw.articleKey || "");
  if (Boolean(fromDate) !== Boolean(toDate) || fromDate > toDate || articleKey && !/^n[a-f0-9]{12}$/i.test(articleKey) || raw.timezone && raw.timezone !== "Asia/Tokyo") throw new Error("HISTORY_FILTER_INVALID");
  if (!fromDate && !articleKey) throw new Error("HISTORY_FILTER_REQUIRED");
  return { fromDate, toDate, articleKey: articleKey.toLowerCase(), timezone: "Asia/Tokyo" };
}

async function filteredLikes(req: Request, m: { id: string; noteId: string; displayName: string }, body: Record<string, unknown>, dataMember: string, requested: number) {
  if (!Number.isInteger(requested) || requested < 1) throw new Error("HISTORY_FILTER_INVALID_COUNT");
  const filter = historyFilter(body.filter);
  const from = filter.fromDate ? new Date(filter.fromDate + "T00:00:00+09:00").toISOString() : "";
  const until = filter.toDate ? new Date(Date.parse(filter.toDate + "T00:00:00+09:00") + 86400000).toISOString() : "";
  const pageSize = 1000, scanLimit = 20000;
  // Filter before pagination and deduplication. Capture time / first_seen_at
  // must never stand in for the actual like time.
  const read = async (table: string, time: string, columns: string, notifications = false) => {
    const out: Record<string, unknown>[] = [];
    for (let offset = 0; offset < scanLimit; offset += pageSize) {
      let query = db.from(table).select(columns).eq("member_id", dataMember);
      if (from) query = query.gte(time, from).lt(time, until);
      if (notifications) query = query.eq("notification_type", "like");
      else if (filter.articleKey) query = query.eq("article_key", filter.articleKey);
      query = query.order(time, { ascending: false, nullsFirst: false });
      if (notifications) query = query.order("id", { ascending: false });
      else query = query.order("article_key").order("liker_key");
      const { data, error } = await query.range(offset, offset + pageSize - 1);
      if (error) throw error;
      const batch = data || [];
      out.push(...batch);
      if (batch.length < pageSize) return out;
    }
    throw new Error("HISTORY_FILTER_TOO_MANY_RESULTS");
  };
  const [likes, notifications] = await Promise.all([
    read("insight_public_likes", "liked_at", "article_key,liker_key,actor_name,actor_url,actor_image_url,liked_at"),
    read("insight_notifications", "occurred_at", "id,notification_type,actor_name,actor_url,actor_image_url,target_url,occurred_at,meta", true),
  ]);
  const candidates: LikeRow[] = [...likes];
  for (const event of notifications) {
    const match = String(event.target_url || "").match(/^https:\/\/(?:www\.)?note\.com\/([^/?#]+)\/n\/(n[a-f0-9]{12})(?:[/?#]|$)/i);
    if (!match || match[1].toLowerCase() !== m.noteId.toLowerCase() || filter.articleKey && match[2].toLowerCase() !== filter.articleKey) continue;
    if ((event.meta as Record<string, unknown> | null)?.summary === true) continue;
    candidates.push({ article_key: match[2].toLowerCase(), actor_name: event.actor_name, actor_url: event.actor_url, actor_image_url: event.actor_image_url, liked_at: event.occurred_at });
  }
  candidates.sort((a, b) => (Date.parse(String(b.liked_at || "")) || 0) - (Date.parse(String(a.liked_at || "")) || 0) || String(a.actor_url || "").localeCompare(String(b.actor_url || "")));
  const rows: Array<Record<string, unknown>> = [], keys = new Set<string>(), accounts = new Set<string>();
  for (const raw of candidates) {
    const person = normalizeLike(raw);
    if (!person) continue;
    const account = person.row.urlname.toLowerCase(), key = String(raw.liker_key || "").toLowerCase();
    const duplicate = accounts.has(account) || Boolean(key && keys.has(key));
    accounts.add(account); if (key) keys.add(key);
    if (!duplicate) rows.push(person.row);
  }
  return reply(req, {
    ok: true, apiVersion: 2, source: "insight-likes-and-article-like-notifications", scope: "filtered-likes", filter,
    member: { noteId: m.noteId, displayName: m.displayName }, requested, unique: true,
    scanned: likes.length + notifications.length, sourceArticles: [], total: rows.length,
    truncated: rows.length > requested, count: Math.min(rows.length, requested), rows: rows.slice(0, requested),
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: headers(req) });
  if (req.method !== "POST") return reply(req, { ok: false, error: "METHOD_NOT_ALLOWED" }, 405);
  try {
    const m = await member(req);
    const body = await req.json().catch(() => ({}));
    const requested = Math.max(1, Math.min(1500, Math.floor(Number(body?.count || 100))));
    const unique = body?.unique !== false;
    const scope = String(body?.scope || "recent-likes");
    const dataMember = m.noteId.toLowerCase() === "ss_yr" ? "owner" : m.id;
    if (scope === "filtered-likes") return await filteredLikes(req, m, body, dataMember, requested);
    const rows: Array<Record<string, unknown>> = [];
    const seen = new Set<string>();
    const sourceArticles: Array<Record<string, unknown>> = [];
    let scanned = 0;

    const pushBatch = (batch: LikeRow[]) => {
      for (const raw of batch) {
        const normalized = normalizeLike(raw);
        if (!normalized) continue;
        if (unique && seen.has(normalized.identity)) continue;
        seen.add(normalized.identity);
        rows.push(normalized.row);
        if (rows.length >= requested) break;
      }
    };

    if (scope === "recent-articles") {
      const { data: articles, error: articleError } = await db
        .from("insight_public_articles")
        .select("article_key,title,url,publish_at")
        .eq("member_id", dataMember)
        .order("publish_at", { ascending: false, nullsFirst: false })
        .limit(80);
      if (articleError) throw articleError;

      for (const article of (articles || []) as ArticleRow[]) {
        if (rows.length >= requested) break;
        const articleKey = String(article?.article_key || "").trim();
        if (!articleKey) continue;
        const { data: likes, error: likeError } = await db
          .from("insight_public_likes")
          .select("article_key,liker_key,actor_name,actor_url,actor_image_url,liked_at")
          .eq("member_id", dataMember)
          .eq("article_key", articleKey)
          .order("liked_at", { ascending: false, nullsFirst: false })
          .limit(Math.min(3000, Math.max(600, requested * 2)));
        if (likeError) throw likeError;
        const batch = (likes || []) as LikeRow[];
        scanned += batch.length;
        if (!batch.length) continue;
        const before = rows.length;
        pushBatch(batch);
        if (rows.length > before) {
          sourceArticles.push({
            articleKey,
            title: String(article?.title || ""),
            url: String(article?.url || ""),
            publishAt: article?.publish_at ? String(article.publish_at) : null,
            scannedLikes: batch.length,
            addedUnique: rows.length - before,
          });
        }
      }
    } else {
      const pageSize = 1000;
      const scanLimit = Math.min(20000, Math.max(2000, requested * 10));
      while (rows.length < requested && scanned < scanLimit) {
        const from = scanned;
        const to = Math.min(scanLimit, from + pageSize) - 1;
        const { data, error } = await db
          .from("insight_public_likes")
          .select("article_key,liker_key,actor_name,actor_url,actor_image_url,liked_at")
          .eq("member_id", dataMember)
          .order("liked_at", { ascending: false, nullsFirst: false })
          .range(from, to);
        if (error) throw error;
        const batch = (data || []) as LikeRow[];
        if (!batch.length) break;
        pushBatch(batch);
        scanned += batch.length;
        if (batch.length < pageSize) break;
      }
    }

    return reply(req, {
      ok: true,
      source: "insight_public_likes",
      scope,
      member: { noteId: m.noteId, displayName: m.displayName },
      requested,
      unique,
      scanned,
      sourceArticles,
      count: rows.length,
      rows,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("insight-likes-export", message);
    return reply(req, { ok: false, error: message }, /LOGIN|SESSION|INACTIVE/.test(message) ? 401 : /HISTORY_FILTER/.test(message) ? 400 : 500);
  }
});
