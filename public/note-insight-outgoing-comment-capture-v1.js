(function (root) {
'use strict';
// Staged module, not loaded by the public userscript until archive authorization
// and the server acknowledgement contract are reviewed. Never posts to note.
const VERSION = '0.1.0-staged';
const COMMENT = /^nc[a-zA-Z0-9]{1,126}$/;
function requestMeta(input, init, origin) {
  try {
    const url = new URL(typeof input === 'string' || input instanceof URL ? String(input) : input.url, origin);
    const method = String(init?.method || input?.method || 'GET').toUpperCase();
    const match = url.pathname.match(/^\/api\/v3\/notes\/(n[a-zA-Z0-9]{1,127})\/note_comments$/);
    if (url.origin !== 'https://note.com' || method !== 'POST' || !match || url.search) return null;
    // The verified note frontend sends JSON strings. Unknown request forms fail
    // closed rather than reading arbitrary streams or retaining all traffic.
    const body = init?.body;
    if (typeof body !== 'string' || body.length > 100000) return null;
    const data = JSON.parse(body);
    const parent = data.parent_key ?? null;
    if (parent !== null && (typeof parent !== 'string' || !COMMENT.test(parent))) return null;
    if (!data.comment || typeof data.comment !== 'object') return null;
    const page = new URL(origin);
    const article = page.pathname.match(/^\/([a-zA-Z0-9_-]+)\/n\/(n[a-zA-Z0-9]+)(?:\/comments)?\/?$/);
    const articleUrl = page.origin === 'https://note.com' && article?.[2] === match[1] ? `https://note.com/${article[1]}/n/${match[1]}` : null;
    return { articleKey: match[1], parentKey: parent, articleUrl };
  } catch { return null; }
}
function commentText(node, depth = 0) {
  if (!node || typeof node !== 'object' || depth > 30) throw new Error('UNSUPPORTED_COMMENT');
  if (node.type === 'text' && typeof node.value === 'string') return node.value;
  if (node.type === 'element' && node.tag_name === 'br') return '\n';
  if (!Array.isArray(node.children)) throw new Error('UNSUPPORTED_COMMENT');
  const text = node.children.map(child => commentText(child, depth + 1)).join('');
  return text + (node.type === 'element' && ['p', 'li'].includes(node.tag_name) ? '\n' : '');
}
function normalize(meta, response, self) {
  const c = response?.data;
  if (!c || !COMMENT.test(c.key || '') || c.note_key !== meta.articleKey || c.user?.urlname !== self || meta.parentKey === c.key) return null;
  if (typeof c.is_root !== 'boolean' || c.is_root !== (meta.parentKey === null)) return null;
  if (c.parent_key != null && c.parent_key !== meta.parentKey) return null;
  if (typeof c.created_at !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(c.created_at) || !Number.isFinite(Date.parse(c.created_at))) return null;
  let body;
  try { body = commentText(c.comment).replace(/\n$/, ''); } catch { return null; }
  if (!body.trim() || body.includes('\u0000') || body.length > 100000) return null;
  return { schema: 1, id: [self, meta.articleKey, c.key].join(':'), account: self,
    articleKey: meta.articleKey, commentKey: c.key, parentKey: meta.parentKey, articleUrl: meta.articleUrl || null,
    author: { urlname: self, key: typeof c.user.key === 'string' ? c.user.key : null },
    body, createdAt: c.created_at, source: 'successful-note-comment-post', state: 'pending' };
}
function create({ page, account, store, send, enabled = () => false, onError = () => {} }) {
  let original, wrapped, draining = null, drainAgain = false;
  const pending = new Set();
  const report = e => { try { onError(e); } catch {} };
  function install() {
    if (wrapped || typeof page.fetch !== 'function') return false;
    original = page.fetch;
    wrapped = function (input, init) {
      const promise = Reflect.apply(original, this, arguments);
      try {
      if (!enabled()) return promise;
      const meta = requestMeta(input, init, page.location.href);
      if (!meta) return promise;
      // Snapshot the paired account at request time. Never infer it from an
      // untrusted page event; the loader must supply its existing paired account.
      const self = account();
      if (typeof self !== 'string' || !/^[a-z0-9_-]{1,128}$/.test(self)) return promise;
      const task = Promise.resolve(promise).then(async res => {
        if (!enabled() || !res?.ok || res.status < 200 || res.status >= 300 || account() !== self) return;
        const json = await res.clone().json();
        if (!enabled() || account() !== self) return;
        const record = normalize(meta, json, self);
        if (record) await store.put(record);
      }).catch(report);
      pending.add(task); task.finally(() => pending.delete(task));
      } catch (e) { report(e); }
      return promise; // Preserve the exact native promise and original response.
    };
    try { page.fetch = wrapped; } catch (e) { wrapped = null; report(e); return false; }
    return page.fetch === wrapped;
  }
  function uninstall() {
    if (page.fetch === wrapped) page.fetch = original;
    wrapped = null;
  }
  async function settled() { await Promise.all([...pending]); }
  function drain() {
    if (draining) { drainAgain = true; return draining; }
    if (typeof send !== 'function') return Promise.resolve({ sent: 0, staged: true });
    draining = (async () => {
      await settled();
      const self = account(); let sent = 0, firstError = null; const attempted = new Set();
      if (!enabled() || !self) return { sent };
      do {
      drainAgain = false;
      for (const row of await store.pending(self)) {
        if (!enabled() || account() !== self) break;
        if (attempted.has(row.id)) continue;
        attempted.add(row.id);
        try {
        const ack = await send(row);
        // Server must acknowledge the exact persisted ID, not merely HTTP 200.
        if (!ack || ack.id !== row.id || ack.persisted !== true) throw new Error('ARCHIVE_NOT_ACKNOWLEDGED');
        await store.ack(row.id); sent++;
        } catch (error) {
          // A permanently malformed row remains pending and visible, but must
          // not block unrelated valid posts. Network/auth failures stop this
          // trigger to avoid a burst of pointless retries.
          if (error?.retryable !== false) throw error;
          firstError ||= error;
        }
      }
      } while (drainAgain && enabled() && account() === self);
      if (firstError) throw firstError;
      return { sent };
    })().finally(() => { draining = null; });
    return draining;
  }
  return { install, uninstall, settled, drain };
}
function indexedStore(indexedDB) {
  let opening;
  function open() {
    if (!opening) opening = new Promise((resolve, reject) => {
      const req = indexedDB.open('mumei-insight-outgoing-comments-v1', 1);
      req.onupgradeneeded = () => { const s = req.result.createObjectStore('comments', { keyPath: 'id' }); s.createIndex('account', 'account'); };
      req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('ARCHIVE_STORAGE_BLOCKED'));
    }).catch(e => { opening = null; throw e; });
    return opening;
  }
  async function transaction(mode, action) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('comments', mode), store = tx.objectStore('comments'); let result;
      tx.oncomplete = () => resolve(result); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error || new Error('ARCHIVE_STORAGE_ABORTED'));
      action(store, value => { result = value; });
    });
  }
  return {
    // Atomic per-key transactions preserve records from simultaneous tabs. A
    // repeat delivery cannot overwrite already archived text or its ack state.
    put: row => transaction('readwrite', s => { const r = s.get(row.id); r.onsuccess = () => { if (!r.result) s.add(row); }; }),
    pending: account => transaction('readonly', (s, done) => { const r = s.index('account').getAll(account); r.onsuccess = () => done(r.result.filter(x => x.state === 'pending')); }),
    ack: id => transaction('readwrite', s => { const r = s.get(id); r.onsuccess = () => { if (r.result) s.put({ ...r.result, state: 'archived' }); }; })
  };
}
root.__mumeiOutgoingCommentCaptureV1 = { VERSION, create, indexedStore, normalize, requestMeta };
})(globalThis);
