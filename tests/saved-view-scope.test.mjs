import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function fixture(storage = new Map()) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync('src/insight-saved-view.ts','utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key,value) => storage.set(key,value), removeItem: key => storage.delete(key) } });
  return { ...exports, storage };
}
const scope = { account: 'tester', token: 'private-member-session' };

test('scope digest matches independent SHA-256 UTF-16LE for block and Unicode boundaries', () => {
  const api = fixture();
  for (const token of ['', 'a', '😀日本語', ...Array.from({length:80},(_,i) => 't'.repeat(i * 13 + 1))]) {
    if (!token) { assert.equal(api.savedInsightViewKey('likes', { account: 'tester', token }), ''); continue; }
    const expected = createHash('sha256').update(Buffer.from(JSON.stringify(['tester',token]), 'utf16le')).digest('hex');
    assert.equal(api.savedInsightViewKey('likes', { account: 'TESTER', token }).split(':').at(-1), expected);
  }
});
test('a new document restores the saved copy with its original check time and no credential persisted', () => {
  const old = fixture(), savedAt = Date.now() - 86400000;
  old.writeSavedInsightView('likes-last', scope, { rows: [{body:'保存した本文'}], page: 2 }, savedAt);
  const api = fixture(old.storage), copy = api.readSavedInsightView('likes-last',scope);
  assert.equal(copy.savedAt, savedAt); assert.equal(copy.value.page,2); assert.equal(copy.value.rows[0].body,'保存した本文');
  assert.doesNotMatch(JSON.stringify([...api.storage]), /private-member-session/);
  assert.equal(api.readSavedInsightView('likes-last',{...scope,token:'another-session'}),null);
  assert.equal(api.readSavedInsightView('likes-last',{...scope,account:'another'}),null);
  assert.equal(api.readSavedInsightView('comments-last',scope),null);
  assert.equal(api.readSavedInsightView('likes-last',{...scope,token:''}),null);
});
test('empty verified results replace old rows, and removal cannot resurrect them', () => {
  const api=fixture(); api.writeSavedInsightView('likes-last',scope,{rows:[1]});
  api.writeSavedInsightView('likes-last',scope,{rows:[],total:0});
  assert.equal(api.readSavedInsightView('likes-last',scope).value.rows.length,0);
  api.removeSavedInsightView('likes-last',scope); assert.equal(api.readSavedInsightView('likes-last',scope),null);
});
test('invalid copies, future times and blocked storage do not become usable display data', () => {
  const api=fixture(), key=api.savedInsightViewKey('likes-last',scope);
  for (const value of ['{bad', '{}', JSON.stringify({version:1,key,account:'other',savedAt:1,value:{}}), JSON.stringify({version:1,key,account:'tester',savedAt:Date.now()+60000,value:{}})]) {
    api.storage.set(key,value); assert.equal(api.readSavedInsightView('likes-last',scope),null);
  }
  api.storage.set = () => { throw new Error('quota'); }; assert.doesNotThrow(()=>api.writeSavedInsightView('likes-last',scope,{}));
});
