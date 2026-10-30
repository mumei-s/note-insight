import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const source = readFileSync('public/note-insight-dm-reader-v1.js', 'utf8');
const room = '11111111-1111-4111-8111-111111111111';
async function settle() { for (let i = 0; i < 10; i++) await new Promise(resolve => setImmediate(resolve)); }
function fixture(t) {
  const dom = new JSDOM('<main></main>', { url: 'https://note.com/messages/rooms/' + room, runScripts: 'outside-only', pretendToBeVisual: true }), w = dom.window;
  const observers = [], Observer = w.MutationObserver;
  w.MutationObserver = class extends Observer { constructor(callback) { super(callback); observers.push(this); } };
  t.after(async () => { observers.forEach(observer => observer.disconnect()); w.close(); await settle(); });
  const values = new Map([['mumei_insight_dm_sync_token_v1:tester', 'fixture-token']]), timers = new Map(), identities = [], reads = [], posts = [];
  let sequence = 0, visible = true;
  Object.defineProperty(w.document, 'visibilityState', { configurable: true, get: () => visible ? 'visible' : 'hidden' });
  w.setTimeout = (fn, ms = 0) => { const key = ++sequence; timers.set(key, { fn, ms }); return key; };
  w.clearTimeout = key => timers.delete(key); w.setInterval = () => 0; w.clearInterval = () => {};
  w.fetch = async () => { identities.push(true); return Response.json({ data: { urlname: 'tester' } }); };
  w.GM = { getValue: async (key, fallback) => values.get(key) ?? fallback, setValue: async (key, value) => values.set(key, structuredClone(value)), xmlHttpRequest: options => { posts.push(JSON.parse(options.data)); options.onload({ status: 200, responseText: '{"ok":true}' }); } };
  w.__mumeiDmNetworkV2 = { readHistory: async thread => { reads.push(thread); return { read: 0, saved: 0, stored: 0, complete: true }; } };
  w.eval(source); timers.clear();
  return { w, values, identities, reads, posts, api: w.__mumeiInsightDmReaderV1Api,
    visibility(value) { visible = value; w.document.dispatchEvent(new w.Event('visibilitychange')); },
    async automatic() { const next = [...timers].find(([, timer]) => [0, 100, 180, 220].includes(timer.ms)); if (!next) return false; timers.delete(next[0]); next[1].fn(); await settle(); return true; },
    automaticCount() { return [...timers.values()].filter(timer => [0, 100, 180, 220].includes(timer.ms)).length; },
  };
}

test('native mutations and an already queued DM timer do not start new reads while the tab is hidden', async t => {
  const h = fixture(t); h.w.dispatchEvent(new h.w.Event('focus')); h.visibility(false);
  h.w.document.querySelector('main').append(h.w.document.createElement('p'));
  await settle(); for (let i = 0; i < 3; i++) await h.automatic();
  assert.equal(h.identities.length, 0, 'hidden DOM changes never restart account or message reads');
  assert.equal(h.reads.length, 0); assert.equal(h.posts.length, 0); assert.equal(h.automaticCount(), 0);
  assert.equal(h.api.run(), false, 'explicit start also respects background suspension'); await settle(); assert.equal(h.identities.length, 0);
});

test('visible, focus and pageshow coalesce into one resumed DM read for the same panel', async t => {
  const h = fixture(t); h.visibility(false); h.visibility(true);
  h.w.dispatchEvent(new h.w.Event('focus')); h.w.dispatchEvent(new h.w.PageTransitionEvent('pageshow', { persisted: true }));
  await settle(); await h.automatic(); await h.automatic();
  assert.deepEqual(h.reads, [room]); assert.equal(h.identities.length, 1);
});

test('an explicit DM stop survives browser restore and only explicit resume restarts it', async t => {
  const h = fixture(t); h.api.stop(); h.visibility(false); h.visibility(true);
  h.w.dispatchEvent(new h.w.Event('focus')); h.w.dispatchEvent(new h.w.PageTransitionEvent('pageshow', { persisted: true }));
  await settle(); for (let i = 0; i < 3; i++) await h.automatic();
  assert.equal(h.identities.length, 0); assert.equal(h.reads.length, 0);
  assert.equal(h.api.resume(), true); await h.automatic();
  assert.deepEqual(h.reads, [room]);
});
