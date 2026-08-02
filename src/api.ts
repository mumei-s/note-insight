const STORAGE_PREFIX = "mumei-note-insight";
const ENTRY_KEY = `${STORAGE_PREFIX}:entry`;
const MEMBER_KEY = `${STORAGE_PREFIX}:member`;
const DEVICE_KEY = `${STORAGE_PREFIX}:device`;

// The API location is not a credential. It is encoded only to keep the old
// account label out of ordinary page text and casual link previews.
const API_ORIGIN = atob(
  "aHR0cHM6Ly9ub3RlLWxpa2UtdHJhY2tlci5zYWJvc2FuMDQwNC5jaGF0Z3B0LnNpdGU=",
);

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

function apiUrl(input: RequestInfo | URL) {
  if (typeof input === "string" && input.startsWith("/api/")) {
    return `${API_ORIGIN}${input}`;
  }
  if (input instanceof URL && input.pathname.startsWith("/api/")) {
    return `${API_ORIGIN}${input.pathname}${input.search}`;
  }
  return input;
}

export function installApiBridge() {
  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const target = apiUrl(input);
    if (target === input) return nativeFetch(input, init);

    const headers = new Headers(
      input instanceof Request ? input.headers : init.headers,
    );
    const entryToken = localStorage.getItem(ENTRY_KEY);
    const memberToken = localStorage.getItem(MEMBER_KEY);
    headers.set("X-Insight-Device", getDeviceId());
    if (entryToken) headers.set("X-Insight-Entry", entryToken);
    if (memberToken) headers.set("X-Insight-Member", memberToken);

    const response = await nativeFetch(target, {
      ...init,
      headers,
      credentials: "omit",
    });
    void response
      .clone()
      .json()
      .then(rememberTokens)
      .catch(() => {});
    return response;
  };
}

export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
  });
}
