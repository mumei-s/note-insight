import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = readFileSync('public/sw.js', 'utf8');
const scope = 'https://mumei-s.github.io/note-insight/';

function worker() {
  const handlers = new Map(), entries = new Map(), calls = [];
  let network = async () => new Response('downloaded');
  let storageFailure = false;
  vm.runInNewContext(source, {
    URL, Response,
    self: { registration: { scope }, addEventListener: (type, handler) => handlers.set(type, handler) },
    caches: { open: async () => {
      if (storageFailure) throw new Error('cache unavailable');
      return {
        match: async key => entries.get(key)?.clone(),
        put: async (key, response) => { entries.set(key, response.clone()); },
      };
    } },
    fetch: async (request, options) => { calls.push({ request, options }); return network(request); },
  });
  return {
    calls, entries,
    network: value => { network = value; },
    storageFailure: () => { storageFailure = true; },
    async request(path, options = {}) {
      let result;
      const pending = [];
      handlers.get('fetch')({
        request: { url: new URL(path, scope).href, method: 'GET', mode: 'cors', ...options },
        respondWith: promise => { result = promise; }, waitUntil: promise => pending.push(promise),
      });
      const response = await result;
      await Promise.all(pending);
      return response;
    },
  };
}

test('an already downloaded fingerprinted bundle uses zero further network requests', async () => {
  const w = worker();
  for (const path of ['assets/index-qUlhhYsX.js', 'assets/index-BTGEb3Vh.css', 'assets/scene-A1b2C3d4.js']) {
    const start = w.calls.length;
    assert.equal(await (await w.request(path)).text(), 'downloaded');
    assert.equal(w.calls.length, start + 1);
    w.network(async () => { throw new Error('offline'); });
    assert.equal(await (await w.request(path)).text(), 'downloaded');
    assert.equal(w.calls.length, start + 1, 'opening again does not even attempt a fetch');
    w.network(async () => new Response('downloaded'));
  }
});

test('new release HTML and a changed asset fingerprint fetch the new files', async () => {
  const w = worker();
  w.entries.set(scope + 'index.html', new Response('old HTML'));
  w.entries.set(scope + 'assets/index-AAAAAAAA.js', new Response('old JS'));
  w.network(async request => new Response(request.url.includes('BBBBBBBB') ? 'new JS' : 'new HTML'));
  assert.equal(await (await w.request('./', { mode: 'navigate' })).text(), 'new HTML');
  assert.equal(await (await w.request('./?v=next', { mode: 'navigate' })).text(), 'new HTML');
  assert.equal(await (await w.request('index.html', { mode: 'navigate' })).text(), 'new HTML');
  assert.equal(await (await w.request('assets/index-BBBBBBBB.js')).text(), 'new JS');
  assert.equal(w.calls.length, 4);
  assert.ok(w.calls.every(call => call.options.cache === 'no-store'));
});

test('release checks, installers and mutable files never use a warmed response instead of the network', async () => {
  const w = worker();
  for (const path of ['insight-release.json', 'notification-update.html', 'note-insight-dm.user.js', 'assets/runtime.js', 'manifest.webmanifest']) {
    w.entries.set(scope + path, new Response('old'));
    assert.equal(await (await w.request(path)).text(), 'downloaded');
  }
  assert.equal(w.calls.length, 5);
});

test('cross-origin, out-of-scope and write requests are left to the browser', async () => {
  const w = worker();
  assert.equal(await w.request('https://xxhaerjvrgmnadxjqetz.supabase.co/functions/v1/insight-notification-feed-final'), undefined);
  assert.equal(await w.request('/other/assets/index-AAAAAAAA.js'), undefined);
  assert.equal(await w.request('assets/index-AAAAAAAA.js', { method: 'POST' }), undefined);
  assert.equal(w.calls.length, 0);
});

test('a failed bundle response is not cached, and storage failure still allows online startup', async () => {
  const w = worker(), path = 'assets/index-AAAAAAAA.js';
  w.network(async () => new Response('missing', { status: 404 }));
  assert.equal((await w.request(path)).status, 404);
  assert.equal(w.entries.has(scope + path), false);
  w.network(async () => new Response('working'));
  assert.equal(await (await w.request(path)).text(), 'working');
  assert.equal(w.calls.length, 2);
  w.storageFailure();
  assert.equal(await (await w.request(path)).text(), 'working');
});

test('offline navigation retains the saved shell fallback', async () => {
  const w = worker();
  w.entries.set(scope + 'index.html', new Response('offline shell'));
  w.network(async () => { throw new Error('offline'); });
  assert.equal(await (await w.request('./', { mode: 'navigate' })).text(), 'offline shell');
  assert.equal(w.calls.length, 1);
});
