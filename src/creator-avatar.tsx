import { useEffect, useState, type CSSProperties } from "react";

const ENDPOINT = "https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/creator-icons";
const CACHE_KEY = "mumei-public-creator-icons-v2";
const TTL = 7 * 86400000;
type Person = Record<string, any>;
type Icon = { image: string; at: number };
const icons = new Map<string, Icon>();
const waiting = new Map<string, Set<(image: string) => void>>();
const pending = new Set<string>();
let timer: ReturnType<typeof setTimeout> | undefined;
let restored = false;

export function creatorNoteId(person: Person | string | null | undefined): string {
  const p = typeof person === "string" ? { profileUrl: person } : person || {};
  for (const value of [p.actor_url, p.actorUrl, p.profileUrl, p.profile_url, p.peer_profile_url, p.sender_url, p.url, p.noteId, p.note_id, p.urlname, p.peer_note_id, p.sender_note_id]) {
    if (typeof value !== "string" || !value.trim()) continue;
    const raw = value.trim();
    if (/^https?:/i.test(raw)) {
      try {
        const u = new URL(raw), id = u.pathname.split("/").filter(Boolean)[0] || "";
        if (u.hostname === "note.com" && /^[a-z0-9_-]+$/i.test(id) && !["api", "search", "settings", "notifications", "assets"].includes(id)) return id.toLowerCase();
      } catch { /* try the next identity field */ }
    } else if (/^@?[a-z0-9_-]+$/i.test(raw)) return raw.replace(/^@/, "").toLowerCase();
  }
  return "";
}

export function creatorImage(person: Person | null | undefined): string {
  const p = person || {};
  for (const value of [p.actor_image_url, p.actorImageUrl, p.profileImageUrl, p.user_profile_image_url, p.profile_image_url, p.profile_image_path, p.imageUrl, p.image_url, p.image, p.peer_image_url, p.sender_image_url]) {
    if (typeof value !== "string" || !value.trim()) continue;
    try {
      const u = new URL(value);
      if (!/^https?:$/.test(u.protocol) || /\/assets\/(?:notices|icons)|(?:icon_comment|icon_magazine|magazine_cover|default_ogp)/i.test(u.pathname)) continue;
      return u.href;
    } catch { /* malformed or non-image field */ }
  }
  return "";
}

function restore() {
  if (restored) return;
  restored = true;
  try {
    const data = JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
    for (const [id, item] of Object.entries(data) as [string, Icon][]) if (Date.now() - item.at < TTL && creatorImage(item)) icons.set(id, item);
  } catch { /* an unavailable cache must never block an avatar */ }
}
function remember(id: string, image: string) {
  icons.set(id, { image, at: Date.now() });
  for (const listener of waiting.get(id) || []) listener(image);
  waiting.delete(id);
}
async function flush() {
  timer = undefined;
  const ids = [...pending].slice(0, 50);
  ids.forEach(id => pending.delete(id));
  if (!ids.length) return;
  const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ noteIds: ids }), signal: controller.signal });
    if (!response.ok) throw new Error("ICON_LOOKUP_FAILED");
    const payload = await response.json(), found = new Map<string, string>();
    for (const item of payload.items || []) {
      const id = creatorNoteId({ noteId: item.noteId || item.note_id }), image = creatorImage(item);
      if (id && image) found.set(id, image);
    }
    ids.forEach(id => remember(id, found.get(id) || ""));
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries([...icons].filter(([, v]) => v.image).slice(-500)))); } catch { /* storage can be full */ }
  } catch { ids.forEach(id => remember(id, "")); }
  finally {
    clearTimeout(timeout);
    if (pending.size && !timer) timer = setTimeout(() => void flush(), 25);
  }
}
function subscribe(id: string, listener: (image: string) => void) {
  restore();
  const cached = icons.get(id);
  if (cached && Date.now() - cached.at < (cached.image ? TTL : 60000)) { listener(cached.image); return () => {}; }
  if (!waiting.has(id)) { waiting.set(id, new Set()); pending.add(id); }
  waiting.get(id)!.add(listener);
  if (!timer && pending.size) timer = setTimeout(() => void flush(), 25);
  return () => { waiting.get(id)?.delete(listener); };
}

/** A real creator image when identity is known; one batched lookup serves every panel. */
export function CreatorAvatar({ person, name, image, noteId, className = "", style, eager = false }: {
  person?: Person; name?: string; image?: string | null; noteId?: string; className?: string; style?: CSSProperties; eager?: boolean;
}) {
  const id = creatorNoteId({ ...person, noteId: noteId || person?.noteId }), supplied = creatorImage({ ...person, imageUrl: image || person?.imageUrl });
  const [lookup, setLookup] = useState({ id: "", image: "" }), [failed, setFailed] = useState<string[]>([]);
  const resolved = lookup.id === id ? lookup.image : "", src = supplied && !failed.includes(supplied) ? supplied : resolved && !failed.includes(resolved) ? resolved : "";
  const label = name || person?.actor_name || person?.nickname || person?.displayName || person?.peer_name || person?.sender_name || id || "noteユーザー";
  useEffect(() => {
    if (!id || supplied && !failed.includes(supplied)) return;
    return subscribe(id, next => setLookup({ id, image: next }));
  }, [id, supplied, failed]);
  const sizing = { objectFit: "cover", flexShrink: 0, ...style } as CSSProperties;
  return src ? <img className={className} src={src} alt={`${label}のアイコン`} loading={eager ? "eager" : "lazy"} decoding="async" referrerPolicy="no-referrer" style={sizing} onError={() => setFailed(old => old.includes(src) ? old : [...old, src])} />
    : <span className={`${className} fallback`} role="img" aria-label={`${label}のアイコン${id ? "を確認中" : ""}`} style={sizing}>{[...String(label)][0] || "人"}</span>;
}
