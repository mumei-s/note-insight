import { createClient } from "npm:@supabase/supabase-js@2.112.4";

const U = Deno.env.get("SUPABASE_URL")!;
const K = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const NOTE = "https://note.com";
const MEMBER = "owner";
const db = createClient(U, K, { auth: { persistSession: false } });

const H = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type,x-owner-token",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};
const out = (x: unknown, s = 200) => new Response(JSON.stringify(x), { status: s, headers: H });
const obj = (v: any) => v && typeof v === "object" && !Array.isArray(v) ? v : {};
const arr = (v: any) => Array.isArray(v) ? v : [];
const txt = (v: any, f = "") => typeof v === "string" ? v : f;
const num = (v: any, f = 0) => typeof v === "number" && Number.isFinite(v) ? v : f;

async function sha(v: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

async function auth(req: Request) {
  const raw = req.headers.get("X-Owner-Token") || "";
  if (!raw) return false;
  const { data } = await db.from("unified_owner_sessions").select("id")
    .eq("token_hash", await sha(raw)).is("revoked_at", null)
    .gt("expires_at", new Date().toISOString()).maybeSingle();
  return !!data?.id;
}

function urlname(v: any) {
  try {
    const s = txt(v);
    if (!s) return "";
    if (/^https?:\/\//.test(s)) return new URL(s).pathname.split("/").filter(Boolean)[0] || "";
    return s.replace(/^@/, "").split("/")[0];
  } catch {
    return "";
  }
}

function normalize(payload: any, fallback: string) {
  const d = obj(payload?.data ?? payload);
  const raw = arr(d.contents ?? d.notes ?? d.items ?? d.data);
  const rows = raw.map((item: any) => {
    const x = obj(item?.note ?? item?.content ?? item);
    const user = obj(x.user ?? x.creator);
    const key = txt(x.key ?? x.noteKey ?? x.note_key ?? x.id);
    const un = txt(user.urlname, fallback);
    const url = txt(x.noteUrl ?? x.note_url ?? x.url) || (key && un ? `${NOTE}/${un}/n/${key}` : "");
    const desc = txt(x.description ?? x.excerpt ?? x.introduction ?? x.bodyText ?? x.body_text).replace(/\s+/g, " ").trim().slice(0, 180);
    return url ? {
      key: key || url,
      title: txt(x.name ?? x.title, "無題の記事"),
      url,
      publishedAt: txt(x.publishAt ?? x.publish_at ?? x.publishedAt ?? x.published_at ?? x.createdAt ?? x.created_at) || null,
      thumbnail: txt(x.eyecatch ?? x.eyecatchUrl ?? x.eyecatch_url ?? x.imageUrl ?? x.image_url ?? x.thumbnailUrl ?? x.thumbnail_url) || null,
      likeCount: num(x.likeCount ?? x.like_count),
      commentCount: num(x.commentsCount ?? x.commentCount ?? x.comment_count),
      excerpt: desc || null,
    } : null;
  }).filter(Boolean);
  const last = Boolean(d.isLastPage ?? d.is_last_page ?? payload?.isLastPage ?? payload?.is_last_page) || raw.length === 0;
  return { rows, last, total: num(d.total_count ?? d.totalCount ?? payload?.total_count ?? payload?.totalCount) };
}

async function fetchPage(un: string, p: number) {
  const endpoints = [
    `${NOTE}/api/v2/creators/${encodeURIComponent(un)}/contents?kind=note&page=${p}&per=20`,
    `${NOTE}/api/v2/creators/${encodeURIComponent(un)}/contents?kind=note&page=${p}`,
  ];
  for (const endpoint of endpoints) {
    try {
      const r = await fetch(endpoint, { headers: { Accept: "application/json", "User-Agent": "Mumei-S-note-INSIGHT-favorites/2.0" } });
      if (!r.ok) continue;
      const x = normalize(await r.json(), un);
      if (x.rows.length || x.last) return x;
    } catch {
      // Try the next compatible note endpoint.
    }
  }
  return { rows: [], last: true, total: 0 };
}

async function readMap(creatorKey: string, rows: any[]) {
  const keys = rows.map((x) => String(x.key || x.url || "")).filter(Boolean);
  if (!keys.length) return new Map<string, string>();
  const { data, error } = await db.from("insight_favorite_article_reads").select("article_key,read_at")
    .eq("member_id", MEMBER).eq("creator_key", creatorKey).in("article_key", keys);
  if (error) throw error;
  return new Map((data || []).map((x: any) => [String(x.article_key), String(x.read_at || "")]));
}

async function articles(b: any) {
  const un = urlname(b?.creatorUrl || b?.creatorKey);
  if (!un) throw new Error("CREATOR_URL_REQUIRED");
  const creatorKey = txt(b?.creatorKey) || un;
  const batch = Math.max(1, Number(b?.page || 1));
  const first = (batch - 1) * 3 + 1;
  const pages = [first, first + 1, first + 2];
  const results = await Promise.all(pages.map((p) => fetchPage(un, p)));
  const map = new Map<string, any>();
  for (const r of results) for (const x of r.rows) if (!map.has(x.url)) map.set(x.url, x);
  const rows = [...map.values()].sort((a, b) => String(b.publishedAt || "").localeCompare(String(a.publishedAt || "")));
  const reads = await readMap(creatorKey, rows);
  const withReadState = rows.map((x) => {
    const readAt = reads.get(String(x.key || x.url)) || null;
    return { ...x, read: Boolean(readAt), readAt };
  });
  const hasNext = !results[results.length - 1].last && rows.length > 0;
  return { ok: true, creatorUrlname: un, creatorKey, page: batch, rows: withReadState, hasNext, total: Math.max(...results.map((x) => x.total || 0), 0), sourcePages: pages };
}

async function readSet(b: any) {
  const creatorKey = txt(b?.creatorKey) || urlname(b?.creatorUrl);
  const articleKey = txt(b?.articleKey) || txt(b?.articleUrl);
  const articleUrl = txt(b?.articleUrl) || null;
  if (!creatorKey) throw new Error("CREATOR_KEY_REQUIRED");
  if (!articleKey) throw new Error("ARTICLE_KEY_REQUIRED");
  const read = b?.read !== false;
  if (read) {
    const { error } = await db.from("insight_favorite_article_reads").upsert({ member_id: MEMBER, creator_key: creatorKey, article_key: articleKey, article_url: articleUrl, read_at: new Date().toISOString() }, { onConflict: "member_id,creator_key,article_key" });
    if (error) throw error;
  } else {
    const { error } = await db.from("insight_favorite_article_reads").delete().eq("member_id", MEMBER).eq("creator_key", creatorKey).eq("article_key", articleKey);
    if (error) throw error;
  }
  return { ok: true, creatorKey, articleKey, read };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: H });
  if (req.method !== "POST") return out({ ok: false, error: "METHOD_NOT_ALLOWED" }, 405);
  if (!(await auth(req))) return out({ ok: false, error: "OWNER_LOGIN_REQUIRED" }, 401);
  try {
    const b = await req.json().catch(() => ({}));
    const action = String(b?.action || "articles");
    if (action === "articles") return out(await articles(b));
    if (action === "read_set") return out(await readSet(b));
    return out({ ok: false, error: "UNKNOWN_ACTION" }, 400);
  } catch (e) {
    console.error(e);
    return out({ ok: false, error: e instanceof Error ? e.message : "FAVORITE_ARTICLES_ERROR" }, 500);
  }
});
