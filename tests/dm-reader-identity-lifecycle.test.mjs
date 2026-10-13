import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const source = readFileSync('public/note-insight-dm-reader-v1.js', 'utf8');
const room = '11111111-1111-4111-8111-111111111111';
const stateKey = 'mumei_insight_dm_checkpoint_v1:tester';
const settle = async () => { for (let i = 0; i < 8; i++) await new Promise(resolve => setImmediate(resolve)); };
function deferred() { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; }

function fixture(t) {
  const dom = new JSDOM('<main></main>', { url: 'https://note.com/messages/rooms/' + room, runScripts: 'outside-only' }), w = dom.window;
  const observers = [], Observer = w.MutationObserver;
  w.MutationObserver = class extends Observer { constructor(fn) { super(fn); observers.push(this); } };
  t.after(() => { observers.forEach(o => o.disconnect()); w.close(); });
  const before = { lastRunComplete: false, storedMessageCount: 12, lastError: 'previous-error' };
  const gm = new Map([[stateKey, structuredClone(before)], ['mumei_insight_dm_sync_token_v1:tester', 'fixture-token']]);
  const timers = new Map(), identityCalls = [], posts = [], historyCalls = [];
  let next = 0, mode = 'normal', delayed;
  w.setTimeout = (fn, ms = 0) => { const id = ++next; timers.set(id, { fn, ms }); return id; };
  w.clearTimeout = id => timers.delete(id); w.setInterval = () => 0; w.clearInterval = () => {};
  w.fetch = async (_url, init) => {
    identityCalls.push({ mode, init });
    if (mode === 'fetch-hang') return new Promise(() => {});
    if (mode === 'json-hang') return { ok: true, json: () => new Promise(() => {}) };
    if (mode === 'delay') return delayed.promise;
    return { ok: true, json: async () => ({ data: { user: { urlname: 'tester' } } }) };
  };
  w.GM = {
    getValue: async (key, fallback) => gm.get(key) ?? fallback,
    setValue: async (key, value) => gm.set(key, structuredClone(value)),
    xmlHttpRequest: options => { posts.push(JSON.parse(options.data)); options.onload({ status: 200, responseText: '{"ok":true}' }); },
  };
  w.__mumeiDmNetworkV2 = { readHistory: async key => { historyCalls.push(key); return { read: 1, saved: 0, stored: 12, complete: true }; } };
  w.eval(source); timers.clear();
  return { api: w.__mumeiInsightDmReaderV1Api, gm, before, identityCalls, posts, historyCalls,
    identity(value) { mode = value; if (value === 'delay') delayed = deferred(); return delayed; },
    async expireIdentity() { const entry = [...timers].find(([, value]) => value.ms === 12000); assert.ok(entry, '本人確認には期限を設定する'); timers.delete(entry[0]); entry[1].fn(); await settle(); },
  };
}

for (const mode of ['fetch-hang', 'json-hang']) test('Reader起動時の' + (mode === 'fetch-hang' ? 'fetchがabortを無視' : 'JSONが停止') + 'しても12秒で読込待ちを解放し再試行できる', async t => {
  const h = fixture(t); h.identity(mode);
  assert.equal(h.api.run(), true); await settle();
  assert.equal(h.api.run(), false, '同じ本人確認を重複開始しない');
  assert.equal(h.identityCalls.length, 1); assert.ok(h.identityCalls[0].init.signal);
  await h.expireIdentity();
  assert.equal(h.identityCalls[0].init.signal.aborted, true);
  assert.equal(h.historyCalls.length, 0); assert.equal(h.posts.length, 0);
  assert.deepEqual(h.gm.get(stateKey), h.before, '期限切れを保存完了として上書きしない');
  h.identity('normal'); assert.equal(h.api.run(), true); await settle();
  assert.deepEqual(h.historyCalls, [room]); assert.equal(h.gm.get(stateKey).lastRunComplete, true);
});

test('Reader起動時の本人確認中に停止したら遅い応答後も取得と保存を開始しない', async t => {
  const h = fixture(t), delayed = h.identity('delay');
  assert.equal(h.api.run(), true); await settle(); h.api.stop();
  delayed.resolve({ ok: true, json: async () => ({ data: { user: { urlname: 'tester' } } }) });
  await settle();
  assert.equal(h.historyCalls.length, 0); assert.equal(h.posts.length, 0);
  assert.deepEqual(h.gm.get(stateKey), h.before);
  assert.equal(h.api.run(), true, '終了した旧通信は実行枠を占有しない'); await settle();
  assert.equal(h.historyCalls.length, 0, '明示停止中は次の読込も開始しない');
});
