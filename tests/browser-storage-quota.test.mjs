import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import ts from 'typescript';

const code = ts.transpileModule(readFileSync('src/insight-browser-storage.ts', 'utf8').replace(/export /g, ''), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
function fixture() {
  const dom = new JSDOM('', { url: 'https://mumei-s.github.io/note-insight/', runScripts: 'outside-only' }), w = dom.window;
  const nativeGet = w.Storage.prototype.getItem, nativeSet = w.Storage.prototype.setItem;
  let refuse = true;
  nativeSet.call(w.localStorage, 'history', 'keep-history');
  w.Storage.prototype.setItem = function(key, value) {
    if (key === 'security-denied') throw new w.DOMException('Denied', 'SecurityError');
    if (refuse) throw new w.DOMException('Full', 'QuotaExceededError');
    return nativeSet.call(this, key, value);
  };
  w.eval(code + '\nwindow.pendingQuotaWrites=hasPendingBrowserWrites;');
  return { dom, w, nativeGet, nativeSet, allow: () => { refuse = false; } };
}
test('quota writes remain readable in this tab while stored history stays untouched', () => {
  const f = fixture(), w = f.w;
  try {
    w.localStorage.setItem('member-token', 'restored-member');
    assert.equal(w.localStorage.getItem('member-token'), 'restored-member');
    assert.equal(f.nativeGet.call(w.localStorage, 'member-token'), null);
    assert.equal(f.nativeGet.call(w.localStorage, 'history'), 'keep-history');
    w.sessionStorage.setItem('route-flag', '1');
    assert.equal(w.sessionStorage.getItem('route-flag'), '1');
    assert.ok(w.pendingQuotaWrites());
    assert.throws(() => w.localStorage.setItem('security-denied', 'value'), /Denied/);
  } finally { w.close(); }
});
test('later storage success retries changes without deleting unrelated data', () => {
  const f = fixture(), w = f.w;
  try {
    w.localStorage.setItem('member-token', 'member');
    f.allow();
    w.localStorage.setItem('last-access', '1');
    assert.equal(f.nativeGet.call(w.localStorage, 'member-token'), 'member');
    assert.equal(f.nativeGet.call(w.localStorage, 'history'), 'keep-history');
    assert.equal(w.pendingQuotaWrites(), false);
  } finally { w.close(); }
});
test('explicit remove, clear and another-tab changes cannot resurrect pending old identities', () => {
  const f = fixture(), w = f.w;
  try {
    w.localStorage.setItem('member-token', 'old-member');
    w.localStorage.removeItem('member-token');
    assert.equal(w.localStorage.getItem('member-token'), null);
    w.localStorage.setItem('member-token', 'old-member');
    f.nativeSet.call(w.localStorage, 'member-token', 'new-member');
    w.dispatchEvent(new w.StorageEvent('storage', { key: 'member-token', newValue: 'new-member', storageArea: w.localStorage }));
    assert.equal(w.localStorage.getItem('member-token'), 'new-member');
    w.sessionStorage.setItem('route-flag', '1');
    w.sessionStorage.clear();
    assert.equal(w.sessionStorage.getItem('route-flag'), null);
    assert.equal(f.nativeGet.call(w.localStorage, 'history'), 'keep-history');
  } finally { w.close(); }
});
