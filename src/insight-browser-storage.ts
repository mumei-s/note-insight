// Keep small session/settings values in Web Storage and overflow cache snapshots
// in IndexedDB. Copy commits before freeing the original cache slot.
type StorageState = { store: Storage; pending: Map<string, string> };
const states: StorageState[] = [];
const CHANGE = "mumei-insight-storage-quota";
const archived = new Map<string, string>();
let hydrateArchive = async () => {};
let recoverQuota = async () => 0;
let retryPendingWrites = () => {};
const CACHE_PREFIXES = ["mumei-insight-data-cache-v1:", "mumei-insight-summary-cache-v1:", "mumei-insight-pro-cache-v3:", "mumei-social-view-cache-v1:", "mumei-notification-board:", "mumei-notification-board-meta:", "mumei-notification-recent-watermark:"];
const CACHE_KEYS = new Set(["mumei-public-creator-icons-v2", "mumei-insight-self-thumbs-v1"]);
function isCacheKey(key: string) { return CACHE_KEYS.has(key) || CACHE_PREFIXES.some(prefix => key.startsWith(prefix)); }

export async function prepareBrowserStorage() { await hydrateArchive(); await recoverQuota(); retryPendingWrites(); await archiveQueue.catch(() => {}); }
export async function retryBrowserStorage() { if (hasPendingBrowserWrites()) await prepareBrowserStorage(); }

function openArchive(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") { reject(new Error("ARCHIVE_UNAVAILABLE")); return; }
    const request = indexedDB.open("mumei-insight-storage-overflow-v1", 1); let expired = false;
    const timeout = window.setTimeout(() => { expired = true; reject(new Error("ARCHIVE_TIMEOUT")); }, 1500);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("values")) request.result.createObjectStore("values", { keyPath: "key" });
    };
    request.onsuccess = () => { window.clearTimeout(timeout); if (expired) request.result.close(); else resolve(request.result); };
    request.onerror = request.onblocked = () => { window.clearTimeout(timeout); reject(request.error || new Error("ARCHIVE_BLOCKED")); };
  });
}

async function archiveTransaction(action: (store: IDBObjectStore) => void, read = false): Promise<void> {
  const db = await openArchive();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("values", read ? "readonly" : "readwrite");
      const timeout = window.setTimeout(() => { try { tx.abort(); } catch {} reject(new Error("ARCHIVE_COMMIT_TIMEOUT")); }, 3000);
      tx.oncomplete = () => { window.clearTimeout(timeout); resolve(); };
      tx.onerror = tx.onabort = () => { window.clearTimeout(timeout); reject(tx.error || new Error("ARCHIVE_COMMIT_FAILED")); };
      action(tx.objectStore("values"));
    });
  } finally { db.close(); }
}

let archiveQueue: Promise<unknown> = Promise.resolve();
function queueArchive(action: () => Promise<void>) {
  const next = archiveQueue.catch(() => {}).then(action);
  archiveQueue = next;
  return next;
}

function isQuotaError(error: unknown) {
  const e = error as { name?: string; code?: number } | null;
  return e?.name === "QuotaExceededError" || e?.name === "NS_ERROR_DOM_QUOTA_REACHED" || e?.code === 22 || e?.code === 1014;
}

export function hasPendingBrowserWrites() { return states.some(state => state.pending.size > 0); }
export function pendingBrowserWriteStatus() {
  let cacheCount = 0, changeCount = 0;
  for (const state of states) for (const key of state.pending.keys()) {
    let isLocal = false; try { isLocal = state.store === window.localStorage; } catch {}
    if (isLocal && isCacheKey(key)) cacheCount++; else changeCount++;
  }
  return { cacheCount, changeCount };
}

export function installBrowserStorageFallback() {
  const proto = typeof window !== "undefined" ? window.Storage?.prototype : undefined;
  if (!proto || (proto as Storage & { __mumeiQuotaFallback?: boolean }).__mumeiQuotaFallback) return;
  const get = proto.getItem, set = proto.setItem, remove = proto.removeItem, clear = proto.clear, keyAt = proto.key;
  const lengthOf = Object.getOwnPropertyDescriptor(proto, "length")!.get!;
  let local: Storage | null = null;
  try { local = window.localStorage; } catch { /* permission errors remain explicit */ }
  const stateFor = (store: Storage) => {
    let state = states.find(value => value.store === store);
    if (!state) { state = { store, pending: new Map() }; states.push(state); }
    return state;
  };
  let previous = "";
  const notify = () => {
    const { cacheCount, changeCount } = pendingBrowserWriteStatus();
    const pending = cacheCount + ":" + changeCount;
    if (pending !== previous) {
      previous = pending;
      window.dispatchEvent(new Event(CHANGE));
    }
  };
  // When a later write/removal frees room, retry smaller changes first. No data
  // is removed to make space; permanent storage succeeds before a change leaves memory.
  const retry = (state: StorageState) => {
    let full = false;
    for (const [key, value] of [...state.pending].sort((a, b) => a[1].length - b[1].length)) {
      if (state.store === local && isCacheKey(key)) { persistCache(state, key, value); continue; }
      if (full) continue;
      try { set.call(state.store, key, value); state.pending.delete(key); }
      catch { full = true; }
    }
    notify();
  };
  retryPendingWrites = () => { for (const state of states) retry(state); };
  const writing = new Map<string, { ticket: number; value: string }>(); let ticket = 0;
  function persistCache(state: StorageState, key: string, value: string) {
    if (writing.get(key)?.value === value) return;
    const revision = ++ticket, previousValue = get.call(state.store, key);
    writing.set(key, { ticket: revision, value });
    void queueArchive(() => archiveTransaction(store => { store.put({ key, value }); })).then(() => {
      // A newer queued write or explicit removal owns the in-memory state.
      if (writing.get(key)?.ticket !== revision) return;
      writing.delete(key); archived.set(key, value);
      if (previousValue !== null && get.call(state.store, key) === previousValue) remove.call(state.store, key);
      if (state.pending.get(key) === value) state.pending.delete(key);
      retry(state);
    }).catch(() => { if (writing.get(key)?.ticket === revision) writing.delete(key); notify(); });
  }
  let hydration: Promise<void> | null = null, recovery: Promise<number> | null = null;
  hydrateArchive = () => hydration ||= archiveTransaction(store => {
    const request = store.getAll();
    request.onsuccess = () => {
      for (const row of request.result || []) if (typeof row?.key === "string" && isCacheKey(row.key) && typeof row.value === "string") archived.set(row.key, row.value);
    };
  }, true).catch(() => {});
  recoverQuota = () => {
    if (recovery) return recovery;
    recovery = (async () => {
      await hydrateArchive();
      if (!local || !stateFor(local).pending.size) return 0;
      const candidates: Array<{ key: string; value: string }> = [];
      for (let i = 0; i < lengthOf.call(local); i++) {
        const key = keyAt.call(local, i), value = key && get.call(local, key);
        // A newer pending copy already owns its queued archive transaction.
        // Moving an older native value after that commit would overwrite it.
        if (key && isCacheKey(key) && value && !writing.has(key) && !stateFor(local).pending.has(key)) candidates.push({ key, value });
      }
      candidates.sort((a, b) => b.value.length - a.value.length);
      const moved: typeof candidates = []; let chars = 0;
      for (const row of candidates) { moved.push(row); chars += row.value.length; if (chars >= 512_000) break; }
      if (!moved.length) return 0;
      // On failure the originals stay in Web Storage and temporary state remains visible.
      await queueArchive(() => archiveTransaction(store => { for (const row of moved) store.put(row); }));
      let freed = 0;
      for (const row of moved) {
        if (get.call(local, row.key) === row.value && !writing.has(row.key) && !stateFor(local).pending.has(row.key)) {
          archived.set(row.key, row.value); remove.call(local, row.key); freed += row.value.length;
        }
      }
      retry(stateFor(local));
      return freed;
    })().catch(() => 0).finally(() => { recovery = null; });
    return recovery;
  };
  proto.getItem = function(key: string) {
    const pending = stateFor(this).pending, name = String(key);
    return pending.has(name) ? pending.get(name)! : get.call(this, name) ?? (this === local ? archived.get(name) ?? null : null);
  };
  proto.setItem = function(key: string, value: string) {
    const state = stateFor(this), name = String(key), text = String(value);
    if (this === local && archived.has(name)) { state.pending.set(name, text); notify(); persistCache(state, name, text); return; }
    try {
      set.call(this, name, text); state.pending.delete(name); retry(state);
    } catch (error) {
      if (!isQuotaError(error)) throw error;
      state.pending.set(name, text); notify();
      if (this === local) {
        if (isCacheKey(name)) persistCache(state, name, text);
        void recoverQuota();
      }
    }
  };
  proto.removeItem = function(key: string) {
    remove.call(this, String(key));
    const state = stateFor(this), name = String(key); state.pending.delete(name);
    if (this === local && isCacheKey(name)) {
      archived.delete(name); writing.delete(name);
      void queueArchive(() => archiveTransaction(store => { store.delete(name); })).catch(() => {});
    }
    retry(state);
  };
  proto.clear = function() {
    clear.call(this); stateFor(this).pending.clear(); notify();
    if (this === local) {
      archived.clear(); writing.clear();
      void queueArchive(() => archiveTransaction(store => { store.clear(); })).catch(() => {});
    }
  };
  const visibleKeys = (store: Storage) => {
    const keys = new Set<string>();
    for (let i = 0; i < lengthOf.call(store); i++) { const key = keyAt.call(store, i); if (key) keys.add(key); }
    if (store === local) for (const key of archived.keys()) keys.add(key);
    for (const key of stateFor(store).pending.keys()) keys.add(key);
    return [...keys];
  };
  proto.key = function(index: number) { return visibleKeys(this)[index] ?? null; };
  Object.defineProperty(proto, "length", { configurable: true, get() { return visibleKeys(this).length; } });
  window.addEventListener("storage", event => {
    const state = states.find(value => value.store === event.storageArea);
    if (!state) return;
    if (event.key === null) state.pending.clear();
    else state.pending.delete(event.key);
    notify();
  });
  window.addEventListener("focus", () => { void retryBrowserStorage(); });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") void retryBrowserStorage(); });
  Object.defineProperty(proto, "__mumeiQuotaFallback", { value: true });
}

installBrowserStorageFallback();
