import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { JSDOM, VirtualConsole } from 'jsdom';

const bundle = readFileSync('dist/assets/' + readdirSync('dist/assets').find(n => /^index-.*\.js$/.test(n)), 'utf8').replace(/export\{[^}]+\};?\s*$/, '');
const html = readFileSync('index.html', 'utf8');

async function boot(mode) {
  const console = new VirtualConsole();
  const dom = new JSDOM(html, { url: 'https://mumei-s.github.io/note-insight/', runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: console });
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
  if (mode === 'quota' || mode === 'quota-missing-token' || mode === 'session-quota') {
    if (mode !== 'quota-missing-token') w.localStorage.setItem('mumei-insight-access-token', 'saved-session');
    w.localStorage.setItem('mumei-insight-saved-accounts-v3', JSON.stringify([{ noteId: 'SS_YR', memberToken: 'saved-session' }]));
    const set = w.Storage.prototype.setItem;
    w.Storage.prototype.setItem = function(key, value) {
      if ((mode === 'quota-missing-token' && this === w.localStorage) || (mode === 'session-quota' && this === w.sessionStorage) || (mode === 'quota' && key === 'mumei-insight-saved-accounts-v3')) throw new w.DOMException('Quota full', 'QuotaExceededError');
      return set.call(this, key, value);
    };
  }
  w.__nativeStorageGet = w.Storage.prototype.getItem;
  for (const script of w.document.querySelectorAll('script:not([src])')) w.eval(script.textContent);
  if (mode === 'early-error-overlay') {
    // Model a promise failing after React clears the static markup but before
    // its concurrent commit fills the root. The fallback is outside React.
    w.document.getElementById('root').replaceChildren();
    w.dispatchEvent(new w.ErrorEvent('error', { error: new w.Error('optional startup task failed') }));
    assert.ok(w.document.body.querySelector(':scope > #insight-static-boot'));
  }
  w.eval(bundle);
  await new Promise(resolve => setTimeout(resolve, 120));
  return dom;
}

for (const mode of ['normal', 'quota', 'quota-missing-token', 'session-quota', 'legacy-media', 'missing-media', 'optional-install-failure']) {
  test(`built TOP still renders under ${mode}`, async () => {
    const dom = await boot(mode), w = dom.window;
    try {
      assert.ok(w.document.querySelector('.hub-page'), 'TOP must render');
      assert.equal(w.document.getElementById('insight-runtime-failure'), null);
      if (mode === 'quota' || mode === 'quota-missing-token' || mode === 'session-quota') {
        assert.equal(w.localStorage.getItem('mumei-insight-access-token'), 'saved-session');
        assert.equal(JSON.parse(w.localStorage.getItem('mumei-insight-saved-accounts-v3'))[0].noteId, 'ss_yr');
        if (mode !== 'session-quota') assert.equal(JSON.parse(w.__nativeStorageGet.call(w.localStorage, 'mumei-insight-saved-accounts-v3'))[0].noteId, 'SS_YR', 'persisted original must remain intact');
        assert.ok(w.document.getElementById('insight-storage-notice'), 'temporary changes must be identified');
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

test('an early body fallback is removed when the real app commits and never covers a live route', async () => {
  const dom = await boot('early-error-overlay'), w = dom.window;
  try {
    const top = w.document.querySelector('.hub-page');
    assert.ok(top, 'real TOP must render beneath the startup handoff');
    assert.equal(w.document.getElementById('insight-static-boot'), null, 'recovery overlay must leave the DOM');
    w.dispatchEvent(new w.ErrorEvent('error', { error: new w.Error('late optional task failed') }));
    assert.equal(w.document.querySelector('.hub-page'), top, 'late failure must preserve the live app');
    assert.equal(w.document.getElementById('insight-static-boot'), null);
  } finally { w.close(); }
});
