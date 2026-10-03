import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { JSDOM } from 'jsdom';
import * as React from 'react';
import * as jsx from 'react/jsx-runtime';
import { createRoot } from 'react-dom/client';

const pause = () => new Promise(resolve => setImmediate(resolve));
async function fixture(t, initialRows) {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://mumei-s.github.io/note-insight/#dashboard' }), w = dom.window;
  for (const key of ['window', 'document', 'localStorage', 'HTMLElement', 'Element']) globalThis[key] = w[key];
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  w.localStorage.setItem('fixture-token', 'fixture-session');
  Object.defineProperty(w.document, 'visibilityState', { value: 'visible' });
  const intervals = []; w.setInterval = (fn, ms) => { intervals.push({ fn, ms }); return intervals.length; }; w.clearInterval = () => {};
  let hold = false, finish;
  const dependencies = {
    react: React, 'react/jsx-runtime': jsx, './member-insight-dm.css': {},
    './creator-avatar': { CreatorAvatar: () => React.createElement('span', { className: 'midm-avatar' }) },
    './insight-account-store': { INSIGHT_TOKEN_KEY: 'fixture-token', currentStoredInsightAccount: () => ({ noteId: 'tester' }) },
    './insight-release': { CURRENT_DM_VERSION: '1.4.10', fetchInsightRelease: async () => ({ dmVersion: '1.4.10' }), versionDiffers: () => false },
  };
  const fetch = async (_url, init) => {
    const body = JSON.parse(init.body);
    if (body.action === 'person_messages') {
      if (hold) return new Promise(resolve => { finish = rows => resolve(Response.json({ ok: true, total: rows.length, rows })); });
      return Response.json({ ok: true, total: initialRows.length, rows: initialRows });
    }
    return Response.json(body.action === 'people' ? { ok: true, rows: [{ person_key: 'person-a', peer_name: '相手A', peer_note_id: 'person_a' }] } : { ok: true, paired: true, messages: initialRows.length, readerStatus: [] });
  };
  const source = ts.transpileModule(readFileSync('src/member-insight-dm.tsx', 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports = {};
  vm.runInNewContext(source, { exports, require: name => dependencies[name], window: w, document: w.document, location: w.location, localStorage: w.localStorage, fetch, AbortController, console });
  const root = createRoot(w.document.getElementById('root'));
  t.after(async () => { await React.act(async () => root.unmount()); w.close(); });
  await React.act(async () => { root.render(React.createElement(exports.MemberInsightDm)); await pause(); });
  await React.act(async () => { w.document.querySelector('.midm-threads button').click(); await pause(); });
  return { w, refresh: async () => { hold = true; await React.act(async () => { intervals.filter(x => x.ms === 2500).at(-1).fn(); await pause(); }); },
    finish: async rows => { await React.act(async () => { finish(rows); await pause(); }); } };
}

for (const rows of [[], [{ message_key: 'saved-a', body: '保存済みの本文' }]]) test('DM定期更新は' + (rows.length ? '保存済み本文' : '確認済みの空の履歴') + 'を読み込み表示へ戻さず保つ', async t => {
  const h = await fixture(t, rows), view = h.w.document.querySelector('.midm-messages'), before = view.textContent;
  await h.refresh();
  assert.equal(h.w.document.querySelector('.midm-messages'), view);
  assert.equal(view.textContent, before, '2500msの再確認で本文を消したり読込表示を再点灯させない');
  assert.doesNotMatch(view.textContent, /読み込み中/);
  await h.finish([...rows, { message_key: 'new-a', body: '新しく保存した本文' }]);
  assert.match(view.textContent, /新しく保存した本文/);
  assert.equal(h.w.localStorage.getItem('fixture-token'), 'fixture-session');
});
