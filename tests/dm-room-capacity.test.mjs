import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const source = readFileSync('public/note-insight-dm-reader-v1.js', 'utf8');
const id = i => '00000000-0000-4000-8000-' + i.toString(16).padStart(12, '0');
const rooms = count => Array.from({ length: count }, (_, i) => ({ key: id(i + 1), url: 'https://note.com/messages/rooms/' + id(i + 1) }));
const settle = async () => { for (let i = 0; i < 8; i++) await new Promise(resolve => setImmediate(resolve)); };

function fixture(t, count) {
  const html = '<main><ul>' + rooms(count).map(r => '<li><a href="' + r.url + '">相手とのメッセージ</a></li>').join('') + '</ul></main>';
  const dom = new JSDOM(html, { url: 'https://note.com/messages/rooms', runScripts: 'outside-only' }), w = dom.window;
  const observers = [], Observer = w.MutationObserver;
  w.MutationObserver = class extends Observer { constructor(fn) { super(fn); observers.push(this); } };
  t.after(() => { observers.forEach(o => o.disconnect()); w.close(); });
  const gm = new Map([['mumei_insight_dm_sync_token_v1:tester', 'fixture-token']]), calls = [], threadBatches = [], statuses = [];
  let now = Date.now(), rejectRooms = false;
  w.Date.now = () => now;
  w.HTMLElement.prototype.getBoundingClientRect = function () { return { width: 300, height: 50, left: 0, right: 300, top: 0, bottom: 50 }; };
  w.setTimeout = () => 0; w.setInterval = () => 0;
  w.fetch = async () => ({ ok: true, json: async () => ({ data: { user: { urlname: 'tester' } } }) });
  w.GM = {
    getValue: async (key, fallback) => gm.get(key) ?? fallback,
    setValue: async (key, value) => { gm.set(key, structuredClone(value)); if (key === 'mumei_insight_dm_checkpoint_v1:tester') statuses.push(structuredClone(value)); },
    xmlHttpRequest: options => {
      const body = JSON.parse(options.data);
      if (body.threads?.length) threadBatches.push(body.threads);
      options.onload({ status: 200, responseText: JSON.stringify({ ok: true, confirmedMessageKeys: [] }) });
    },
  };
  w.__mumeiDmNetworkV2 = { readHistory: async key => {
    // The queue owns the discovered keys; its work does not depend on the list
    // retaining every rendered row while a room's history is fetched.
    w.document.querySelector('main').replaceChildren();
    calls.push(key);
    if (rejectRooms) throw new Error('DM_HISTORY_HTTP_403');
    return { read: 1, saved: 1, stored: 1, complete: true };
  } };
  w.eval(source);
  return { api: w.__mumeiInsightDmReaderV1Api, calls, threadBatches, statuses, advance: () => { now += 16000; }, rejectRooms: value => { rejectRooms = value; },
    panel: () => w.document.getElementById('mumei-dm-reader-status'),
    status: () => gm.get('mumei_insight_dm_checkpoint_v1:tester'), checkpoint: () => gm.get('mumei_insight_dm_queue_v1:tester') };
}

test('501件目の会話を捨てず、500件の途中保存から残りだけを続けて完了する', async t => {
  const h = fixture(t, 501), discovered = h.api.roomAnchors();
  assert.equal(discovered.length, 501);
  await h.api.syncRoomsInBackground({ id: 'tester' }, discovered);
  assert.equal(h.calls.length, 500); assert.equal(h.status().threadCount, 501);
  assert.equal(h.status().lastRunComplete, false); assert.equal(h.checkpoint().completed.length, 500);
  h.advance();
  await h.api.syncRoomsInBackground({ id: 'tester' }, discovered);
  assert.deepEqual(h.calls, rooms(501).map(r => r.key));
  assert.equal(h.status().lastRunComplete, true); assert.equal(h.status().currentThread, 501);
  assert.equal(h.status().storedMessageCount, 501);
});

test('先頭500件の取得が失敗しても次の会話を再試行の後ろへ永久に閉じ込めない', async t => {
  const h = fixture(t, 501), discovered = h.api.roomAnchors();
  h.rejectRooms(true);
  await h.api.syncRoomsInBackground({ id: 'tester' }, discovered);
  assert.equal(h.calls.length, 500); assert.equal(h.status().lastRunComplete, false);
  h.advance(); h.rejectRooms(false);
  await h.api.syncRoomsInBackground({ id: 'tester' }, discovered);
  assert.equal(h.calls[500], id(501)); assert.equal(h.calls.length, 1000);
  assert.equal(h.status().lastRunComplete, false, '未取得の会話が1件残る');
  h.advance();
  await h.api.syncRoomsInBackground({ id: 'tester' }, discovered);
  assert.equal(h.calls.at(-1), id(500)); assert.equal(h.status().lastRunComplete, true);
});

test('次の一覧がまだ空でも本人の保存候補から501件目を再開できる', async t => {
  const h = fixture(t, 501), discovered = h.api.roomAnchors();
  await h.api.syncRoomsInBackground({ id: 'tester' }, discovered);
  assert.equal(h.status().lastRunComplete, false);
  h.advance();
  await h.api.syncRoomsInBackground({ id: 'tester' }, []);
  assert.equal(h.calls.at(-1), id(501)); assert.equal(h.calls.length, 501);
  assert.equal(h.status().threadCount, 501); assert.equal(h.status().lastRunComplete, true);
});

test('一覧登録も500件ずつ送信し、サーバーの800件入力上限で後半を落とさない', async t => {
  const h = fixture(t, 801);
  assert.equal(h.api.run(), true); await settle();
  assert.deepEqual(h.threadBatches.map(batch => batch.length), [500, 301]);
  assert.deepEqual(h.threadBatches.flat().map(row => row.thread_key), rooms(801).map(r => r.key));
  for (let i = 0; i < 40 && h.calls.length < 500; i++) await settle();
  assert.equal(h.calls.length, 500);
  assert.equal(h.status().lastRunComplete, false); assert.equal(h.status().threadCount, 801);
});

test('前回は全会話完了でも今回の失敗を完了状態と同時に保存・表示しない', async t => {
  const h = fixture(t, 2), discovered = h.api.roomAnchors();
  await h.api.syncRoomsInBackground({ id: 'tester' }, discovered);
  assert.equal(h.status().lastRunComplete, true);
  h.statuses.length = 0; h.advance(); h.advance(); h.rejectRooms(true);
  await h.api.syncRoomsInBackground({ id: 'tester' }, discovered);
  assert.ok(h.statuses.some(value => value.lastError));
  assert.ok(h.statuses.filter(value => value.lastError).every(value => value.lastRunComplete === false));
  assert.doesNotMatch(h.panel().textContent, /全会話保存完了/);
  assert.match(h.panel().textContent, /再試行待ち/);
});
