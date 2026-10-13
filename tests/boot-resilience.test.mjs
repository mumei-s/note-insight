import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { JSDOM, VirtualConsole } from 'jsdom';

const bundle = readFileSync('dist/assets/' + readdirSync('dist/assets').find(n => /^index-.*\.js$/.test(n)), 'utf8').replace(/export\{[^}]+\};?\s*$/, '');

async function boot(mode) {
  const console = new VirtualConsole();
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://mumei-s.github.io/note-insight/', runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: console });
  const w = dom.window;
  w.fetch = async () => ({ ok: false, status: 401, json: async () => ({ error: 'INSIGHT_LOGIN_REQUIRED' }) });
  w.matchMedia = query => {
    if (mode === 'optional-install-failure' && query.includes('display-mode')) throw new Error('optional install unavailable');
    if (mode === 'app-failure' && query.includes('min-width')) throw new TypeError('matchMedia unavailable');
    return mode === 'legacy-media' ? { matches: false, addListener() {}, removeListener() {} } : { matches: false, addEventListener() {}, removeEventListener() {} };
  };
  if (mode === 'missing-media') delete w.matchMedia;
  w.scrollTo = () => {};
  w.ResizeObserver = class { observe() {} disconnect() {} };
  w.requestIdleCallback = cb => w.setTimeout(cb, 0);
  w.HTMLElement.prototype.scrollIntoView = () => {};
  if (mode === 'quota') {
    w.localStorage.setItem('mumei-insight-access-token', 'saved-session');
    w.localStorage.setItem('mumei-insight-saved-accounts-v3', JSON.stringify([{ noteId: 'SS_YR', memberToken: 'saved-session' }]));
    const set = w.Storage.prototype.setItem;
    w.Storage.prototype.setItem = function(key, value) {
      if (key === 'mumei-insight-saved-accounts-v3') throw new w.DOMException('Quota full', 'QuotaExceededError');
      return set.call(this, key, value);
    };
  }
  w.eval(bundle);
  await new Promise(resolve => setTimeout(resolve, 120));
  return dom;
}

for (const mode of ['normal', 'quota', 'legacy-media', 'missing-media', 'optional-install-failure']) {
  test(`built TOP still renders under ${mode}`, async () => {
    const dom = await boot(mode), w = dom.window;
    try {
      assert.ok(w.document.querySelector('.hub-page'), 'TOP must render');
      assert.equal(w.document.getElementById('insight-runtime-failure'), null);
      if (mode === 'quota') {
        assert.equal(w.localStorage.getItem('mumei-insight-access-token'), 'saved-session');
        assert.equal(JSON.parse(w.localStorage.getItem('mumei-insight-saved-accounts-v3'))[0].noteId, 'SS_YR');
      }
      if (mode === 'optional-install-failure') assert.equal(w.document.querySelector('.insight-home-install'), null);
    } finally { w.close(); }
  });
}

test('a render exception shows the failure reason and retry controls instead of an empty root', async () => {
  const dom = await boot('app-failure'), w = dom.window;
  try {
    const failure = w.document.getElementById('insight-runtime-failure');
    assert.ok(failure);
    assert.match(failure.textContent, /E_BROWSER_API/);
    assert.match(failure.textContent, /再表示/);
    assert.equal(new URL(failure.querySelector('a').href).hash, '');
    assert.ok(w.document.getElementById('root').children.length);
  } finally { w.close(); }
});
