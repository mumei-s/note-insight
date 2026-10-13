// Keep the app usable when Web Storage writes hit the browser's per-site quota.
// The persisted values remain untouched. Failed changes live in this tab only.
type StorageState = { store: Storage; pending: Map<string, string> };
const states: StorageState[] = [];
const CHANGE = "mumei-insight-storage-quota";

function isQuotaError(error: unknown) {
  const e = error as { name?: string; code?: number } | null;
  return e?.name === "QuotaExceededError" || e?.name === "NS_ERROR_DOM_QUOTA_REACHED" || e?.code === 22 || e?.code === 1014;
}

export function hasPendingBrowserWrites() { return states.some(state => state.pending.size > 0); }

export function installBrowserStorageFallback() {
  const proto = typeof window !== "undefined" ? window.Storage?.prototype : undefined;
  if (!proto || (proto as Storage & { __mumeiQuotaFallback?: boolean }).__mumeiQuotaFallback) return;
  const get = proto.getItem, set = proto.setItem, remove = proto.removeItem, clear = proto.clear;
  const stateFor = (store: Storage) => {
    let state = states.find(value => value.store === store);
    if (!state) { state = { store, pending: new Map() }; states.push(state); }
    return state;
  };
  let previous = false;
  const notify = () => {
    const pending = hasPendingBrowserWrites();
    if (pending !== previous) {
      previous = pending;
      window.dispatchEvent(new Event(CHANGE));
    }
  };
  // When a later write/removal frees room, retry smaller changes first. No data
  // is removed to make space; permanent storage succeeds before a change leaves memory.
  const retry = (state: StorageState) => {
    for (const [key, value] of [...state.pending].sort((a, b) => a[1].length - b[1].length)) {
      try { set.call(state.store, key, value); state.pending.delete(key); }
      catch { break; }
    }
    notify();
  };
  proto.getItem = function(key: string) {
    const pending = stateFor(this).pending, name = String(key);
    return pending.has(name) ? pending.get(name)! : get.call(this, name);
  };
  proto.setItem = function(key: string, value: string) {
    const state = stateFor(this), name = String(key), text = String(value);
    try {
      set.call(this, name, text); state.pending.delete(name); retry(state);
    } catch (error) {
      if (!isQuotaError(error)) throw error;
      state.pending.set(name, text); notify();
    }
  };
  proto.removeItem = function(key: string) {
    remove.call(this, String(key));
    const state = stateFor(this); state.pending.delete(String(key)); retry(state);
  };
  proto.clear = function() {
    clear.call(this); stateFor(this).pending.clear(); notify();
  };
  window.addEventListener("storage", event => {
    const state = states.find(value => value.store === event.storageArea);
    if (!state) return;
    if (event.key === null) state.pending.clear();
    else state.pending.delete(event.key);
    notify();
  });
  Object.defineProperty(proto, "__mumeiQuotaFallback", { value: true });
}

installBrowserStorageFallback();
