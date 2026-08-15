const STORAGE_PREFIX = "mumei-note-insight";
const ENTRY_KEY = `${STORAGE_PREFIX}:entry`;
const MEMBER_KEY = `${STORAGE_PREFIX}:member`;
const DEVICE_KEY = `${STORAGE_PREFIX}:device`;
const OWNER_KEY = "mumei-unified-owner-token";

const API_ORIGIN = atob(
  "aHR0cHM6Ly9ub3RlLWxpa2UtdHJhY2tlci5zYWJvc2FuMDQwNC5jaGF0Z3B0LnNpdGU=",
);
const OWNER_COMPAT_ORIGIN =
  "https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-owner-compat";
const ICON_ENDPOINT =
  "https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/creator-icons";
const OWNER_TOOL_ENDPOINTS: Record<string, string> = {
  "/owner/evidence-upload":
    "https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-evidence-upload",
  "/owner/creator-upload":
    "https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/creator-owner-upload",
  "/owner/game-data":
    "https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/creator-game-data",
};
const OWNER_COMPAT_PATHS = new Set([
  "/api/member/me",
  "/api/member/creators",
  "/api/member/settings",
  "/api/analytics",
]);
const iconCache = new Map<string, string | null>();

function randomId() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function getDeviceId() {
  let value = localStorage.getItem(DEVICE_KEY);
  if (!value) {
    value = randomId();
    localStorage.setItem(DEVICE_KEY, value);
  }
  return value;
}

export function hasEntrySession() {
  return Boolean(localStorage.getItem(ENTRY_KEY));
}

export function hasMemberSession() {
  return Boolean(localStorage.getItem(MEMBER_KEY));
}

export function clearLocalSession() {
  localStorage.removeItem(ENTRY_KEY);
  localStorage.removeItem(MEMBER_KEY);
}

function rememberTokens(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return;
  const value = payload as Record<string, unknown>;
  if (typeof value.entryToken === "string" && value.entryToken) {
    localStorage.setItem(ENTRY_KEY, value.entryToken);
  }
  if (typeof value.memberToken === "string" && value.memberToken) {
    localStorage.setItem(MEMBER_KEY, value.memberToken);
  }
}

function inputUrl(input: RequestInfo | URL) {
  if (typeof input === "string") return new URL(input, window.location.origin);
  if (input instanceof URL) return input;
  if (input instanceof Request) return new URL(input.url, window.location.origin);
  return null;
}

function apiParts(input: RequestInfo | URL) {
  const url = inputUrl(input);
  if (!url || !url.pathname.startsWith("/api/")) return null;
  return { path: url.pathname, search: url.search };
}

function apiTarget(input: RequestInfo | URL) {
  const directUrl = inputUrl(input);
  const ownerTool = directUrl ? OWNER_TOOL_ENDPOINTS[directUrl.pathname] : undefined;
  const ownerToken = localStorage.getItem(OWNER_KEY);
  if (ownerTool && ownerToken) {
    return { target: ownerTool, ownerCompat: true, enrich: false };
  }

  const parts = apiParts(input);
  if (!parts) return { target: input, ownerCompat: false, enrich: false };

  if (ownerToken && OWNER_COMPAT_PATHS.has(parts.path)) {
    const target = new URL(OWNER_COMPAT_ORIGIN);
    target.searchParams.set("path", parts.path);
    const sourceParams = new URLSearchParams(parts.search);
    sourceParams.forEach((value, key) => target.searchParams.append(key, value));
    return {
      target: target.toString(),
      ownerCompat: true,
      enrich: parts.path === "/api/analytics",
    };
  }

  return {
    target: `${API_ORIGIN}${parts.path}${parts.search}`,
    ownerCompat: false,
    enrich: false,
  };
}

function eachSocialPerson(payload: any, fn: (person: any) => void) {
  for (const side of [payload?.followers, payload?.followings]) {
    for (const person of Array.isArray(side?.people) ? side.people : []) fn(person);
    for (const person of Array.isArray(side?.added) ? side.added : []) fn(person);
    for (const person of Array.isArray(side?.removed) ? side.removed : []) fn(person);
  }
}

function collectUrlnames(payload: any) {
  const ids = new Set<string>();
  const add = (value: unknown) => {
    if (typeof value === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(value)) {
      ids.add(value);
    }
  };

  for (const event of Array.isArray(payload?.activityEvents) ? payload.activityEvents : []) {
    if (!event?.actorImageUrl) add(event?.actorUrlname);
  }
  for (const event of Array.isArray(payload?.cachedLikerEvents) ? payload.cachedLikerEvents : []) {
    if (!event?.user?.profileImageUrl) add(event?.user?.urlname);
  }
  for (const result of Array.isArray(payload?.cachedCommentResults) ? payload.cachedCommentResults : []) {
    for (const thread of Array.isArray(result?.threads) ? result.threads : []) {
      for (const message of Array.isArray(thread?.messages) ? thread.messages : []) {
        if (!message?.user?.profileImageUrl) add(message?.user?.urlname);
      }
    }
  }
  eachSocialPerson(payload, (person) => {
    if (!person?.profileImageUrl) add(person?.urlname);
  });
  return [...ids];
}

async function fillIconCache(ids: string[], nativeFetch: typeof window.fetch) {
  const missing = ids.filter((id) => !iconCache.has(id));
  const chunks: string[][] = [];
  for (let index = 0; index < missing.length; index += 200) {
    chunks.push(missing.slice(index, index + 200));
  }

  for (let start = 0; start < chunks.length; start += 4) {
    const group = chunks.slice(start, start + 4);
    await Promise.all(
      group.map(async (noteIds) => {
        try {
          const response = await nativeFetch(ICON_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ noteIds }),
            credentials: "omit",
          });
          const payload = await response.json().catch(() => ({}));
          for (const item of Array.isArray(payload?.items) ? payload.items : []) {
            if (typeof item?.noteId === "string") {
              iconCache.set(
                item.noteId,
                typeof item.image === "string" ? item.image : null,
              );
            }
          }
        } catch {}
      }),
    );
  }
}

function applyIcons(payload: any) {
  for (const event of Array.isArray(payload?.activityEvents) ? payload.activityEvents : []) {
    if (!event?.actorImageUrl && typeof event?.actorUrlname === "string") {
      event.actorImageUrl = iconCache.get(event.actorUrlname) ?? null;
    }
  }
  for (const event of Array.isArray(payload?.cachedLikerEvents) ? payload.cachedLikerEvents : []) {
    const id = event?.user?.urlname;
    if (event?.user && !event.user.profileImageUrl && typeof id === "string") {
      event.user.profileImageUrl = iconCache.get(id) ?? null;
    }
  }
  for (const result of Array.isArray(payload?.cachedCommentResults) ? payload.cachedCommentResults : []) {
    for (const thread of Array.isArray(result?.threads) ? result.threads : []) {
      for (const message of Array.isArray(thread?.messages) ? thread.messages : []) {
        const id = message?.user?.urlname;
        if (message?.user && !message.user.profileImageUrl && typeof id === "string") {
          message.user.profileImageUrl = iconCache.get(id) ?? null;
        }
      }
    }
  }
  eachSocialPerson(payload, (person) => {
    const id = person?.urlname;
    if (person && !person.profileImageUrl && typeof id === "string") {
      person.profileImageUrl = iconCache.get(id) ?? null;
    }
  });
}

async function enrichOwnerResponse(response: Response, nativeFetch: typeof window.fetch) {
  if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) {
    return response;
  }
  try {
    const payload = await response.clone().json();
    const ids = collectUrlnames(payload);
    if (!ids.length) return response;
    await fillIconCache(ids, nativeFetch);
    applyIcons(payload);
    const headers = new Headers(response.headers);
    headers.set("Content-Type", "application/json; charset=utf-8");
    return new Response(JSON.stringify(payload), {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch {
    return response;
  }
}

export function installApiBridge() {
  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const { target, ownerCompat, enrich } = apiTarget(input);
    if (target === input) return nativeFetch(input, init);

    const headers = new Headers(input instanceof Request ? input.headers : init.headers);
    if (ownerCompat) {
      const ownerToken = localStorage.getItem(OWNER_KEY);
      if (ownerToken) headers.set("X-Owner-Token", ownerToken);
      headers.delete("X-Insight-Device");
      headers.delete("X-Insight-Entry");
      headers.delete("X-Insight-Member");
    } else {
      const entryToken = localStorage.getItem(ENTRY_KEY);
      const memberToken = localStorage.getItem(MEMBER_KEY);
      headers.set("X-Insight-Device", getDeviceId());
      if (entryToken) headers.set("X-Insight-Entry", entryToken);
      if (memberToken) headers.set("X-Insight-Member", memberToken);
    }

    const response = await nativeFetch(target, {
      ...init,
      headers,
      credentials: "omit",
    });
    if (ownerCompat) {
      return enrich ? enrichOwnerResponse(response, nativeFetch) : response;
    }
    void response.clone().json().then(rememberTokens).catch(() => {});
    return response;
  };
}

export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
  });
}
