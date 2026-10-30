import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { JSDOM } from 'jsdom';

const source = readFileSync('public/note-insight-dashboard-save-queue-v1.js', 'utf8');
const payload = { action: 'ingest', noteId: 'tester', articles: [], metricSeries: [], chartSeries: [], totals: { pageViews: 0 } };
async function settle() { for (let i = 0; i < 12; i++) await new Promise(resolve => setImmediate(resolve)); }
async function until(check, message) { for (let i = 0; i < 200 && !check(); i++) await new Promise(resolve => setTimeout(resolve, 5)); assert.ok(check(), message); }
function deferred() { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; }

async function fixture(t) {
  const dom = new JSDOM('', { url: 'https://note.com/tester', runScripts: 'outside-only' }), w = dom.window;
  t.after(() => w.close());
  Object.defineProperty(w.crypto, 'subtle', { value: webcrypto.subtle }); w.TextEncoder = TextEncoder;
  let now = 0, sequence = 0, identity = 'normal', transport = 'normal', delayedIdentity;
  const timers = new Map(), identities = [], requests = [], values = new Map();
  w.setTimeout = (fn, ms = 0) => { const key = ++sequence; timers.set(key, { fn, at: now + ms }); return key; };
  w.clearTimeout = key => timers.delete(key);
  w.fetch = async (_url, init) => {
    identities.push(init);
    if (identity === 'fetch-hang') return delayedIdentity.promise;
    if (identity === 'json-hang') return { ok: true, json: () => delayedIdentity.promise };
    return Response.json({ data: { urlname: 'tester' } });
  };
  w.GM = {
    getValue: async (key, fallback) => values.get(key) ?? fallback,
    setValue: async (key, value) => values.set(key, value),
    xmlHttpRequest: options => {
      const body = JSON.parse(options.data), entry = { body, options, aborted: false };
      requests.push(entry);
      const result = body.action === 'ingest' ? { ok: true, snapshotId: 7 } : { ok: true, noteId: 'tester', snapshotId: 7, confirmed: true, articleCount: 0, dailyMetricCount: 0, dailyPvDays: 0, totals: { pageViews: 0 } };
      const response = { status: 200, responseText: JSON.stringify(result) };
      entry.response = response;
      if (transport === body.action + '-hang') return { abort() { entry.aborted = true; } };
      if (transport === 'promise-only') return Object.assign(Promise.resolve(response), { abort() { entry.aborted = true; } });
      queueMicrotask(() => options.onload(response));
      return { abort() { entry.aborted = true; } };
    },
  };
  w.eval(source);
  w.localStorage.setItem('mumei-dashboard-note-id-v1', 'tester');
  w.localStorage.setItem('mumei-dashboard-ingest-token-v1', 'fixture-token');
  const api = w.__mumeiDashboardSaveQueueV1, key = await api.prepare('tester', 'fixture-token'), pending = { payload };
  api.stage(key, pending); await settle();
  return { w, api, key, pending, identities, requests,
    identity(mode) { identity = mode; delayedIdentity = deferred(); return delayedIdentity; },
    transport(mode) { transport = mode; },
    async advance(ms) { const target = now + ms; await settle(); for (;;) { const next = [...timers].filter(([, timer]) => timer.at <= target).sort((a, b) => a[1].at - b[1].at)[0]; if (!next) break; timers.delete(next[0]); now = next[1].at; next[1].fn(); await settle(); } now = target; await settle(); },
    rows() { return JSON.parse(w.localStorage.getItem(key) || '[]'); },
  };
}

for (const mode of ['fetch-hang', 'json-hang']) test('Dashboard queue releases its lock after an unresponsive identity ' + mode + ' and preserves the captured save', async t => {
  const h = await fixture(t), delayed = h.identity(mode);
  let result;
  const job = h.api.flush(h.key, h.pending.queueId).then(value => { result = { value }; }, error => { result = { error }; });
  await until(() => h.identities.length, 'identity request starts'); const identityRequest = h.identities.at(-1);
  await h.advance(9999); assert.equal(result, undefined);
  await h.advance(1); assert.ok(result?.error, 'identity has its own deadline even when fetch/body ignore abort');
  await job; assert.equal(result.error.message, 'DASHBOARD_ACCOUNT_TIMEOUT');
  assert.equal(identityRequest.signal.aborted, true); assert.equal(h.requests.length, 0);
  assert.equal(h.rows().length, 1);
  delayed.resolve(mode === 'fetch-hang' ? Response.json({ data: { urlname: 'tester' } }) : { data: { urlname: 'tester' } });
  await settle(); assert.equal(h.requests.length, 0, 'late identity does not restart the abandoned job');
  h.identity('normal'); const recovered = await h.api.flush(h.key, h.pending.queueId);
  assert.equal(recovered.verified.confirmed, true); assert.equal(h.rows().length, 0);
});

for (const action of ['ingest', 'sync-status']) test('Dashboard queue times out a silent ' + action + ' callback, ignores late success and retries the retained stage', async t => {
  const h = await fixture(t); h.transport(action + '-hang');
  let result;
  const job = h.api.flush(h.key, h.pending.queueId).then(value => { result = { value }; }, error => { result = { error }; });
  await until(() => h.requests.some(request => request.body.action === action), 'save stage starts'); const request = h.requests.at(-1);
  assert.equal(request.body.action, action);
  await h.advance(45000); assert.ok(result?.error, 'manager silence must not hold the queue lock forever');
  await job; assert.equal(result.error.message, 'TIMEOUT'); assert.equal(request.aborted, true);
  assert.equal(h.rows().length, 1); assert.equal(Boolean(h.rows()[0].saved), action === 'sync-status');
  request.options.onload(request.response); await settle(); assert.equal(h.rows().length, 1, 'late manager callback cannot confirm a timed-out save');
  h.transport('normal'); assert.equal((await h.api.flush(h.key, h.pending.queueId)).verified.confirmed, true);
  const actions = h.requests.map(row => row.body.action);
  assert.deepEqual(actions, action === 'ingest' ? ['ingest', 'ingest', 'sync-status'] : ['ingest', 'sync-status', 'sync-status']);
  assert.equal(h.rows().length, 0);
});

test('Dashboard queue consumes Promise-only manager replies for ingest and confirmation', async t => {
  const h = await fixture(t); h.transport('promise-only'); let result;
  const job = h.api.flush(h.key, h.pending.queueId).then(value => { result = value; });
  await until(() => result?.verified?.confirmed, 'modern manager promise replies are complete responses');
  await job; assert.deepEqual(h.requests.map(row => row.body.action), ['ingest', 'sync-status']); assert.equal(h.rows().length, 0);
});
