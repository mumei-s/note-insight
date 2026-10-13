import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import ts from 'typescript';

const code = ts.transpileModule(readFileSync('src/insight-browser-storage.ts', 'utf8').replace(/export /g, ''), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
const cacheKey = 'mumei-insight-data-cache-v1:ss_yr:likes';
const cacheValue = 'saved-history'.repeat(120);

// The test backend models commit/abort boundaries and survives a new page realm.
function database(records = new Map(), options = {}) {
  return { records, open() {
    const request = {};
    queueMicrotask(() => {
      request.result = {
        objectStoreNames: { contains: () => true }, close() {},
        transaction(_name, mode) {
          const tx = {}, operations = []; let scheduled = false;
          function schedule(request, result) {
            if (scheduled) return; scheduled = true;
            queueMicrotask(() => {
              if (mode === 'readwrite' && options.failWrite) { tx.error = new Error('commit rejected'); tx.onabort?.(); return; }
              options.beforeCommit?.(mode);
              for (const operation of operations) operation();
              if (request) { request.result = result; request.onsuccess?.(); }
              tx.oncomplete?.();
            });
          }
          tx.objectStore = () => ({
            getAll() { const request = {}; schedule(request, [...records.values()].map(row => ({ ...row }))); return request; },
            put(row) { operations.push(() => records.set(row.key, { ...row })); schedule(); },
            delete(key) { operations.push(() => records.delete(key)); schedule(); },
            clear() { operations.push(() => records.clear()); schedule(); }
          });
          return tx;
        }
      };
      request.onsuccess?.();
    });
    return request;
  } };
}

function page(db, seed) {
  const dom = new JSDOM('', { url: 'https://mumei-s.github.io/note-insight/', runScripts: 'outside-only', storageQuota: 2000 });
  const w = dom.window, get = w.Storage.prototype.getItem, set = w.Storage.prototype.setItem, key = w.Storage.prototype.key;
  const length = Object.getOwnPropertyDescriptor(w.Storage.prototype, 'length').get;
  for (const [name, value] of seed || [[cacheKey, cacheValue], ['mumei-insight-access-token', 'saved-member'], ['unrelated', 'x'.repeat(200)]]) set.call(w.localStorage, name, value);
  w.indexedDB = db;
  w.eval(code + '\nwindow.prepareStorage=prepareBrowserStorage;window.hasPending=hasPendingBrowserWrites;');
  return { w, get, set, rawEntries() { return Array.from({ length: length.call(w.localStorage) }, (_, i) => { const name = key.call(w.localStorage, i); return [name, get.call(w.localStorage, name)]; }); } };
}

test('actual full Web Storage becomes writable after a committed cache move, and reload retains the exact history', async () => {
  const db = database(), first = page(db), w = first.w;
  try {
    w.localStorage.setItem('preferences', 'p'.repeat(500));
    assert.ok(w.hasPending());
    await w.prepareStorage();
    assert.equal(w.hasPending(), false);
    assert.equal(first.get.call(w.localStorage, 'preferences'), 'p'.repeat(500));
    assert.equal(first.get.call(w.localStorage, 'mumei-insight-access-token'), 'saved-member');
    assert.equal(first.get.call(w.localStorage, cacheKey), null);
    assert.equal(db.records.get(cacheKey).value, cacheValue);
    assert.equal(w.localStorage.getItem(cacheKey), cacheValue);
    assert.ok(Array.from({ length: w.localStorage.length }, (_, i) => w.localStorage.key(i)).includes(cacheKey));
    const second = page(db, first.rawEntries());
    try {
      await second.w.prepareStorage();
      assert.equal(second.w.localStorage.getItem(cacheKey), cacheValue);
      second.w.localStorage.setItem(cacheKey, 'new-history'.repeat(170));
      await second.w.prepareStorage();
      assert.equal(second.w.hasPending(), false);
      assert.equal(db.records.get(cacheKey).value, 'new-history'.repeat(170));
      assert.equal(second.get.call(second.w.localStorage, cacheKey), null);
      second.w.localStorage.removeItem(cacheKey);
      await second.w.prepareStorage();
      assert.equal(db.records.has(cacheKey), false);
      assert.equal(second.w.localStorage.getItem(cacheKey), null);
    } finally { second.w.close(); }
  } finally { w.close(); }
});

test('an aborted archive transaction never removes the original history or claims successful saving', async () => {
  const db = database(new Map(), { failWrite: true }), first = page(db), w = first.w;
  try {
    w.localStorage.setItem('preferences', 'p'.repeat(500));
    await w.prepareStorage();
    assert.ok(w.hasPending());
    assert.equal(first.get.call(w.localStorage, cacheKey), cacheValue);
    assert.equal(first.get.call(w.localStorage, 'mumei-insight-access-token'), 'saved-member');
    assert.equal(db.records.size, 0);
  } finally { w.close(); }
});

test('cache changes made while the archive commits are not deleted as stale snapshots', async () => {
  let first;
  const db = database(new Map(), { beforeCommit(mode) { if (mode === 'readwrite') first.set.call(first.w.localStorage, cacheKey, 'newer-history'); } });
  first = page(db);
  try {
    first.w.localStorage.setItem('preferences', 'p'.repeat(500));
    await first.w.prepareStorage();
    assert.equal(first.get.call(first.w.localStorage, cacheKey), 'newer-history');
    assert.equal(first.w.localStorage.getItem(cacheKey), 'newer-history');
    assert.equal(first.w.hasPending(), false);
  } finally { first.w.close(); }
});
