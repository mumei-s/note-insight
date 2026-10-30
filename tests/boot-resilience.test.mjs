import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { JSDOM, VirtualConsole } from 'jsdom';

const html = readFileSync('dist/index.html', 'utf8');
const site = 'https://mumei-s.github.io/note-insight/';

// Execute the actual build as ES modules so lazy route chunks retain their
// real imports, shared React runtime, and error handling. CSS has no layout in
// JSDOM; acknowledge only files that were emitted by the production build.
async function evaluateBuild(dom) {
  const w = dom.window, context = dom.getInternalVMContext(), modules = new Map(), evaluations = new Map();
  const localFile = url => {
    const resolved = new URL(url, site);
    assert.equal(resolved.origin, new URL(site).origin);
    assert.ok(resolved.pathname.startsWith('/note-insight/assets/'));
    return 'dist/' + resolved.pathname.slice('/note-insight/'.length);
  };
  const appendChild = w.Node.prototype.appendChild;
  w.Node.prototype.appendChild = function(child) {
    const appended = appendChild.call(this, child);
    if (child.tagName === 'LINK' && child.rel === 'stylesheet') {
      readFileSync(localFile(child.href));
      w.setTimeout(() => child.dispatchEvent(new w.Event('load')), 0);
    }
    return appended;
  };
  const getModule = identifier => {
    if (modules.has(identifier)) return modules.get(identifier);
    const module = new vm.SourceTextModule(readFileSync(localFile(identifier), 'utf8'), {
      context,
      identifier,
      initializeImportMeta: meta => { meta.url = identifier; },
      importModuleDynamically: async (specifier, referencingModule) => {
        const imported = getModule(new URL(specifier, referencingModule.identifier).href);
        await evaluate(imported);
        return imported;
      },
    });
    (w.__builtModules ||= []).push(identifier);
    modules.set(identifier, module);
    return module;
  };
  const link = (specifier, referencingModule) => getModule(new URL(specifier, referencingModule.identifier).href);
  const evaluate = module => {
    if (!evaluations.has(module.identifier)) evaluations.set(module.identifier, (async () => {
      if (module.status === 'unlinked') await module.link(link);
      if (module.status === 'linked') await module.evaluate();
      if (module.status === 'errored') throw module.error;
    })());
    return evaluations.get(module.identifier);
  };
  const entry = getModule(new URL(w.document.querySelector('script[type="module"][src]').getAttribute('src'), site).href);
  await evaluate(entry);
}

async function boot(mode, { url = site, fetcher, prepare } = {}) {
  const console = new VirtualConsole();
  const dom = new JSDOM(html, { url, runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: console });
  const w = dom.window;
  w.fetch = fetcher || (async () => ({ ok: false, status: 401, json: async () => ({ error: 'INSIGHT_LOGIN_REQUIRED' }) }));
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
  prepare?.(w);
  if (mode === 'notification-cache-quota') {
    const boardKey = 'mumei-notification-board:tester';
    w.__storedNotificationBoard = JSON.stringify([{ id: 'saved', raw_text: '保存済みの通知本文', meta: { exact: '以前の履歴' } }]);
    w.__pendingNotificationBoard = JSON.stringify([{ id: 'new', raw_text: '新しい通知本文', meta: { exact: '取得した履歴' } }]);
    w.localStorage.setItem(boardKey, w.__storedNotificationBoard);
    w.localStorage.setItem('mumei-insight-access-token', 'saved-session');
    w.localStorage.setItem('mumei-insight-saved-accounts-v3', JSON.stringify([{ noteId: 'tester', memberToken: 'saved-session' }]));
    w.localStorage.setItem('mumei-insight-auto-sync-enabled', '1');
    w.__rejectSettingWrite = false;
    w.__quotaWriteAttempts = [];
    const set = w.Storage.prototype.setItem;
    w.Storage.prototype.setItem = function(key, value) {
      if (this === w.localStorage && (key === boardKey || key === 'mumei-insight-auto-sync-enabled')) w.__quotaWriteAttempts.push(key);
      if (this === w.localStorage && (key === boardKey || (key === 'mumei-insight-auto-sync-enabled' && w.__rejectSettingWrite))) {
        throw new w.DOMException('Quota full', 'QuotaExceededError');
      }
      return set.call(this, key, value);
    };
    // Durable cache overflow is unavailable; the notice must describe a view
    // copy waiting on this device rather than failed server notification saving.
    Object.defineProperty(w, 'indexedDB', { value: undefined, configurable: true });
  }
  w.__nativeStorageGet = w.Storage.prototype.getItem;
  for (const script of w.document.querySelectorAll('script:not([src])')) w.eval(script.textContent);
  if (mode === 'early-error-overlay') {
    // Model a promise failing after React clears the static markup but before
    // its concurrent commit fills the root. No independent fallback is allowed.
    w.document.getElementById('root').replaceChildren();
    w.dispatchEvent(new w.ErrorEvent('error', { error: new w.Error('optional startup task failed') }));
    assert.equal(w.document.getElementById('insight-static-boot'), null, 'handoff errors must never create a second screen');
  }
  await evaluateBuild(dom);
  if (mode === 'notification-cache-quota') w.localStorage.setItem('mumei-notification-board:tester', w.__pendingNotificationBoard);
  await new Promise(resolve => setTimeout(resolve, 120));
  return dom;
}

async function waitFor(predicate) {
  const deadline = Date.now() + 2000;
  while (!predicate() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 10));
  assert.ok(predicate(), 'the selected built scene must render');
}

test('built member entrance loads the selected notification scene and can open another lazy scene', async () => {
  const calls = [];
  const dom = await boot('member', {
    url: site + '?insightMode=notifications#dashboard',
    prepare(w) {
      w.localStorage.setItem('mumei-insight-access-token', 'saved-session');
      w.localStorage.setItem('mumei-insight-saved-accounts-v3', JSON.stringify([{ noteId: 'tester', memberToken: 'saved-session', status: 'active' }]));
    },
    fetcher: async (url, init = {}) => {
      const body = JSON.parse(init.body || '{}');
      calls.push({ url: String(url), body });
      const result = String(url).endsWith('/insight-access')
        ? { ok: true, application: { noteId: 'tester', displayName: '本人', status: 'active' } }
        : { ok: true, noteId: 'tester', rows: [], total: 0, pages: 0, page: 1, pageSize: 100, counts: {}, days: [], previewRows: [], hasMore: false };
      return { ok: true, status: 200, json: async () => result };
    },
  });
  const w = dom.window;
  try {
    // A concurrent commit can expose the scene before its passive effects run.
    // Wait for both the real DOM and its initial history request on Node 22/24.
    await waitFor(() => w.document.querySelector('.minf') && calls.some(call => call.url.endsWith('/insight-notification-feed-final')));
    assert.ok(w.__builtModules.some(url => /member-insight-notifications-final-/.test(url)));
    assert.ok(!w.__builtModules.some(url => /member-insight-(?:unified-v4|comments-final|analysis-hub|favorites-final|social-v2)-/.test(url)), 'unselected histories are not downloaded');
    assert.ok(calls.some(call => call.url.endsWith('/insight-notification-feed-final')));
    assert.ok(!calls.some(call => /insight-(?:dm-feed|comments|dashboard-data)$/.test(call.url)));
    w.dispatchEvent(new w.CustomEvent('mumei-insight-select-item', { detail: 'comments' }));
    await waitFor(() => w.document.querySelector('.micf'));
    assert.ok(w.__builtModules.some(url => /member-insight-comments-final-/.test(url)));
    assert.equal(w.document.getElementById('insight-runtime-failure'), null);
    assert.equal(w.localStorage.getItem('mumei-insight-access-token'), 'saved-session');
  } finally { w.close(); }
});

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
        await waitFor(() => w.document.getElementById('insight-storage-notice'));
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

test('handoff errors never create a body fallback or cover a live route', async () => {
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

test('normal startup contains no emergency panel or extra navigation', () => {
  const dom = new JSDOM(html, { url: 'https://mumei-s.github.io/note-insight/', runScripts: 'outside-only' });
  try {
    const w = dom.window;
    for (const script of w.document.querySelectorAll('script:not([src])')) w.eval(script.textContent);
    const boot = w.document.getElementById('insight-static-boot');
    assert.ok(boot);
    assert.equal(boot.querySelector('nav, a, .boot-card'), null);
    assert.equal(w.document.getElementById('insight-display-repair').hidden, true);
    const module = w.document.querySelector('script[type="module"]');
    module.dispatchEvent(new w.Event('error'));
    assert.match(boot.textContent, /E_SCRIPT_LOAD/);
    assert.equal(w.document.getElementById('insight-display-repair').hidden, false);
  } finally { dom.window.close(); }
});

test('notification cache overflow uses a collapsed device-copy notice in normal flow ahead of the live app', async () => {
  const dom = await boot('notification-cache-quota'), w = dom.window;
  try {
    const top = w.document.querySelector('.hub-page'), notice = w.document.getElementById('insight-storage-notice');
    assert.ok(top, 'TOP remains available while the notification view copy is pending');
    assert.ok(notice);
    const details = notice.querySelector('details'), summary = details.querySelector('summary');
    assert.equal(summary.textContent, '端末の表示用保存待ち');
    assert.equal(details.open, false, 'long explanatory text starts collapsed');
    assert.match(details.querySelector('p').textContent, /サーバーへの保存結果とは別/);
    assert.match(details.querySelector('p').textContent, /保存済み履歴は残っています/);
    assert.equal(details.querySelector('button').textContent, '保存を再試行');
    assert.equal(notice.style.position, '');
    assert.equal(notice.style.zIndex, '');
    assert.ok(notice.compareDocumentPosition(top) & w.Node.DOCUMENT_POSITION_FOLLOWING, 'notice precedes App in document flow');
    assert.equal(w.document.getElementById('root').contains(notice), true);
    assert.equal(w.__nativeStorageGet.call(w.localStorage, 'mumei-notification-board:tester'), w.__storedNotificationBoard);
    assert.equal(w.localStorage.getItem('mumei-notification-board:tester'), w.__pendingNotificationBoard);
    assert.equal(w.localStorage.getItem('mumei-insight-access-token'), 'saved-session');
    assert.equal(w.document.getElementById('insight-runtime-failure'), null);
  } finally { w.close(); }
});

test('adding a pending setting changes the notice and retry saves it while an unavailable cache archive stays pending', async () => {
  const dom = await boot('notification-cache-quota'), w = dom.window;
  try {
    const top = w.document.querySelector('.hub-page'), notice = w.document.getElementById('insight-storage-notice');
    assert.equal(notice.querySelector('summary').textContent, '端末の表示用保存待ち');
    w.__rejectSettingWrite = true;
    w.localStorage.setItem('mumei-insight-auto-sync-enabled', '0');
    await new Promise(resolve => setTimeout(resolve, 35));
    assert.equal(notice.querySelector('summary').textContent, '端末の変更を保存待ち', 'cache-count/change-count changes update an already-visible notice');
    assert.match(notice.querySelector('p').textContent, /未保存の変更は戻ることがあります/);
    assert.equal(w.__nativeStorageGet.call(w.localStorage, 'mumei-insight-auto-sync-enabled'), '1');
    assert.equal(w.localStorage.getItem('mumei-insight-auto-sync-enabled'), '0');
    notice.querySelector('summary').click();
    assert.equal(notice.querySelector('details').open, true);
    w.__rejectSettingWrite = false;
    const attempts = w.__quotaWriteAttempts.length;
    notice.querySelector('button').click();
    await new Promise(resolve => setTimeout(resolve, 70));
    assert.ok(w.__quotaWriteAttempts.length > attempts, 'manual retry attempts to persist the now-writable setting');
    assert.equal(w.__nativeStorageGet.call(w.localStorage, 'mumei-insight-auto-sync-enabled'), '0', 'retry commits the now-writable setting');
    assert.equal(notice.querySelector('summary').textContent, '端末の表示用保存待ち', 'cache-only pending is distinguished after the setting commits');
    assert.equal(notice.querySelector('button').disabled, false);
    assert.equal(notice.querySelector('button').textContent, '保存を再試行');
    assert.equal(w.document.querySelector('.hub-page'), top, 'retry preserves the live App DOM');
    assert.equal(w.__nativeStorageGet.call(w.localStorage, 'mumei-notification-board:tester'), w.__storedNotificationBoard, 'failed archive retry keeps the original persisted history');
    assert.equal(w.localStorage.getItem('mumei-notification-board:tester'), w.__pendingNotificationBoard);
    assert.equal(w.localStorage.getItem('mumei-insight-access-token'), 'saved-session');
  } finally { w.close(); }
});
