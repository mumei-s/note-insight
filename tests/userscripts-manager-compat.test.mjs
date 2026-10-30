import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { JSDOM } from 'jsdom';

const read = name => readFileSync('public/' + name, 'utf8');
const turn = () => new Promise(resolve => setImmediate(resolve));
async function until(check, message) {
  for (let i = 0; i < 80 && !check(); i++) await turn();
  assert.ok(check(), message);
}
function fixture(t, { url = 'https://mumei-s.github.io/note-insight/', handler = 'Userscripts', legacy = false, onRequest } = {}) {
  const dom = new JSDOM('<main></main>', { url, runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window, values = new Map(), writes = [], requests = [];
  const observers = [], NativeObserver = w.MutationObserver;
  w.MutationObserver = class extends NativeObserver { constructor(callback) { super(callback); observers.push(this); } };
  t.after(async () => { await turn(); for (const observer of observers) observer.disconnect(); w.close(); });
  Object.defineProperty(w.crypto, 'subtle', { value: webcrypto.subtle });
  w.TextEncoder = TextEncoder;
  w.fetch = async url => {
    assert.equal(String(url), '/api/v2/current_user');
    return Response.json({ data: { urlname: 'tester' } });
  };
  const info = { scriptHandler: handler };
  const getValue = (key, fallback) => values.has(key) ? values.get(key) : fallback;
  const setValue = (key, value) => { writes.push({ key, value }); values.set(key, value); };
  const request = options => {
    requests.push(options);
    const body = JSON.parse(options.data || '{}');
    const result = onRequest ? onRequest(body, options) : { ok: true };
    const response = { status: 200, responseText: JSON.stringify(result) };
    queueMicrotask(() => options.onload?.(response));
    const promise = Promise.resolve(response);
    promise.abort = () => {};
    return promise;
  };
  const api = legacy ? {
    GM_info: info, GM_getValue: getValue, GM_setValue: setValue,
    GM_deleteValue: key => values.delete(key), GM_xmlhttpRequest: request,
  } : {
    GM: { info, getValue: async (...args) => getValue(...args), setValue: async (...args) => setValue(...args), deleteValue: async key => values.delete(key), xmlHttpRequest: request },
    GM_info: info, GM_xmlhttpRequest: request,
  };
  // Userscripts injectJS passes GM through Function's destructured argument.
  // The privileged API is deliberately absent from window/globalThis.
  function run(source) {
    return w.Function('{GM,GM_info,GM_xmlhttpRequest,GM_getValue,GM_setValue,GM_deleteValue}', source)(api);
  }
  function chain(wrapper) {
    const source = read(wrapper);
    const dependencies = [...source.matchAll(/^\/\/ @require\s+https:\/\/raw\.githubusercontent\.com\/mumei-s\/note-insight\/main\/public\/([^?\s]+)/gm)].map(match => read(match[1]));
    run([...dependencies, source].join('\n;\n'));
  }
  return { w, values, writes, requests, api, run, chain };
}

for (const [tool, wrapper, activeKey] of [
  ['notification', 'note-insight-notification-v3.user.js', 'mumei-notification-active-runtime-version-v1'],
  ['dm', 'note-insight-dm.user.js', 'mumei-dm-active-version-v1'],
]) {
  for (const legacy of [false, true]) test(`${tool}: lexical ${legacy ? 'legacy' : 'Userscripts async'} APIs save the active version without exposing GM globally`, async t => {
    const h = fixture(t, { legacy, handler: legacy ? 'Tampermonkey' : 'Userscripts' });
    h.chain(wrapper);
    const version = read(wrapper).match(/^\/\/ @version\s+(\S+)/m)[1];
    await until(() => h.values.get(activeKey) === version, 'active version is written through the manager API');
    assert.equal(h.w.document.documentElement.getAttribute('data-mumei-' + tool + '-live-version'), version);
    assert.equal(h.w.document.documentElement.getAttribute('data-mumei-' + tool + '-live-manager'), legacy ? 'Tampermonkey' : 'Userscripts');
    assert.equal(typeof h.w.GM, 'undefined');
    assert.equal(typeof h.w.GM_xmlhttpRequest, 'undefined');
  });
}

for (const legacy of [false, true]) test(`dashboard: lexical ${legacy ? 'legacy' : 'Userscripts async'} API confirms the saved pairing handoff`, async t => {
  const h = fixture(t, { legacy, handler: legacy ? 'Tampermonkey' : 'Userscripts', url: 'https://mumei-s.github.io/note-insight/dashboard-setup.html' });
  h.chain('note-insight-dashboard-sync.user.js');
  const payload = { code: '12345678', noteId: 'tester', requestId: 'fixture-handoff' };
  const node = h.w.document.createElement('div');
  node.id = 'mumei-dashboard-handoff';
  node.setAttribute('data-payload', JSON.stringify(payload));
  h.w.document.body.append(node);
  h.w.document.dispatchEvent(new h.w.Event('mumei-dashboard-handoff'));
  await until(() => h.w.document.documentElement.getAttribute('data-mumei-dashboard-handoff-saved') === '1', 'the saved handoff is read back before confirmation');
  const saved = JSON.parse(h.values.get('mumei-dashboard-handoff-v143'));
  assert.equal(saved.noteId, 'tester');
  assert.equal(saved.requestId, payload.requestId);
  assert.equal(saved.version, read('note-insight-dashboard-sync.user.js').match(/^\/\/ @version\s+(\S+)/m)[1]);
  assert.equal(h.w.document.documentElement.getAttribute('data-mumei-dashboard-live-manager'), legacy ? 'Tampermonkey' : 'Userscripts');
  assert.equal(typeof h.w.GM, 'undefined');
  assert.equal(typeof h.w.GM_xmlhttpRequest, 'undefined', 'the wrapper does not copy privileged requests into the global object');
});

for (const [tool, wrapper] of [['notification', 'note-insight-notification-v3.user.js'], ['dm', 'note-insight-dm.user.js'], ['dashboard', 'note-insight-dashboard-sync.user.js']]) {
  test(`${tool}: unknown manager metadata is not published as a recognised manager`, async t => {
    const h = fixture(t, { handler: 'unknown extension', url: 'https://mumei-s.github.io/note-insight/dashboard-setup.html' });
    h.run(read(wrapper));
    await turn();
    assert.equal(h.w.document.documentElement.hasAttribute('data-mumei-' + tool + '-live-manager'), false);
  });
}

for (const [tool, file, globalName, key] of [
  ['notification', 'note-insight-notification-feature-bridge-v1.js', '__mumeiNotificationFeatureV1', 'mumei_insight_notification_feature_enabled_v1'],
  ['dashboard', 'note-insight-dashboard-feature-bridge-v1.js', '__mumeiDashboardFeatureV1', 'mumei_insight_dashboard_feature_enabled_v1'],
]) test(`${tool}: setting writes and focus recovery work without legacy getters or GM change listeners`, async t => {
  const h = fixture(t, { url: 'https://note.com/tester' });
  h.run(read(file));
  const feature = h.w[globalName];
  await feature.ready;
  await feature.setEnabled(false);
  assert.equal(h.values.get(key), false);
  assert.equal(feature.isEnabled(), false);
  h.values.set(key, true);
  h.w.dispatchEvent(new h.w.Event('focus'));
  await until(() => feature.isEnabled(), 'focus refresh reads the changed manager storage without an unsupported listener');
  assert.equal(typeof h.api.GM.addValueChangeListener, 'undefined');
  assert.equal(typeof h.w.GM, 'undefined');
});

for (const [tool, file, query, tokenKey, response] of [
  ['notification', 'note-insight-notification-account-pair-v1.js', '?mumei_pair=12345678&mumei_account=tester', 'mumei_insight_notification_sync_token_v2:tester', { ok: true, ingestToken: 'fixture-notification-token' }],
  ['dm', 'note-insight-dm-account-pair-v1.js', '?mumei_dm_pair=12345678&mumei_account=tester', 'mumei_insight_dm_sync_token_v1:tester', { ok: true, dmIngestToken: 'fixture-dm-token' }],
]) test(`${tool}: pairing stores its token through lexical Userscripts GM storage`, async t => {
  const h = fixture(t, { url: 'https://note.com/' + (tool === 'dm' ? 'messages/rooms' : 'tester') + query, onRequest: () => response });
  h.run(read(file));
  await until(() => h.values.has(tokenKey), 'pairing token is persisted');
  assert.equal(h.values.get(tokenKey), response.ingestToken || response.dmIngestToken);
  assert.equal(h.requests.length, 1);
  assert.equal(h.w.location.search, '');
});

test('dashboard queue persists and confirms a save through Userscripts APIs when note storage is full', async t => {
  const payload = { action: 'ingest', noteId: 'tester', articles: [{ key: 'n1', title: '保存する記事' }], metricSeries: [{ date: '2026-10-30', pageViews: 0 }], chartSeries: [], totals: { pageViews: 0 } };
  const h = fixture(t, { url: 'https://note.com/tester', onRequest: body => body.action === 'ingest' ? { ok: true, snapshotId: 42 } : { ok: true, noteId: 'tester', snapshotId: 42, confirmed: true, articleCount: 1, dailyMetricCount: 1, dailyPvDays: 1, totals: { pageViews: 0 } } });
  h.w.localStorage.setItem('mumei-dashboard-note-id-v1', 'tester');
  h.w.localStorage.setItem('mumei-dashboard-ingest-token-v1', 'fixture-token');
  h.w.Storage.prototype.setItem = function () { throw new h.w.DOMException('Storage quota reached', 'QuotaExceededError'); };
  // Exercise the modern request route too; Userscripts also exposes this legacy
  // XHR alias, but does not supply legacy GM_getValue/GM_setValue aliases.
  delete h.api.GM_xmlhttpRequest;
  h.run(read('note-insight-dashboard-save-queue-v1.js'));
  const queue = h.w.__mumeiDashboardSaveQueueV1, key = await queue.prepare('tester', 'fixture-token'), pending = { payload };
  queue.stage(key, pending);
  await queue.settled(key);
  assert.equal(JSON.parse(h.values.get(key))[0].payload.noteId, 'tester');
  const result = await queue.flush(key, pending.queueId);
  assert.equal(result.verified.confirmed, true);
  assert.equal(h.values.get(key), '[]');
  assert.deepEqual(h.requests.map(options => JSON.parse(options.data).action), ['ingest', 'sync-status']);
  assert.equal(typeof h.w.GM, 'undefined');
});
