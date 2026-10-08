import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { JSDOM } from 'jsdom';
import * as React from 'react';
import * as jsx from 'react/jsx-runtime';
import { createRoot } from 'react-dom/client';

const pause = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const response = value => Response.json({ ok: true, ...value });

async function fixture(t, file, component, props, handler, saved = {}) {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://mumei-s.github.io/note-insight/#dashboard' }), w = dom.window;
  for (const key of ['window', 'document', 'localStorage', 'HTMLElement', 'Element']) globalThis[key] = w[key];
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  w.localStorage.setItem('fixture-token', 'session-a');
  for (const [key, value] of Object.entries(saved)) w.localStorage.setItem(key, value);
  Object.defineProperty(w.document, 'visibilityState', { value: 'visible', writable: true });
  const intervals = [], calls = [];
  w.setInterval = (fn, ms) => { const timer = { fn, ms, cancelled: false }; intervals.push(timer); return timer; };
  w.clearInterval = timer => { if (timer) timer.cancelled = true; };
  const fetch = async (url, init) => { const body = JSON.parse(init.body || '{}'); calls.push({ url, body }); return handler(url, body, init); };
  const scope = { window: w, document: w.document, location: w.location, localStorage: w.localStorage, fetch, AbortController, console, setTimeout, clearTimeout, URL };
  const lifecycleExports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync('src/insight-view-lifecycle.ts', 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText, { ...scope, exports: lifecycleExports });
  const dependencies = {
    react: React, 'react/jsx-runtime': jsx,
    './creator-avatar': { CreatorAvatar: () => React.createElement('span'), creatorNoteId: row => row?.urlname || '' },
    './insight-account-store': { INSIGHT_TOKEN_KEY: 'fixture-token', currentStoredInsightAccount: () => ({ noteId: 'tester' }), readStoredInsightAccounts: () => [{ noteId: 'tester', memberToken: 'session-a' }] },
    './insight-release': { CURRENT_DM_VERSION: '1.4.10', fetchInsightRelease: async () => ({ dmVersion: '1.4.10' }), versionDiffers: () => false },
    './insight-view-lifecycle': lifecycleExports,
    './insight-member-db-fallback': { memberDbReadFallback: async () => { throw new Error('fallback unavailable'); }, memberReadAuthFailure: msg => /LOGIN|SESSION|401|403/.test(msg) },
  };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, { ...scope, exports, require: name => dependencies[name] || {} });
  const root = createRoot(w.document.getElementById('root'));
  const render = async next => { await React.act(async () => { root.render(React.createElement(exports[component], next)); await pause(); }); };
  const act = async fn => { await React.act(async () => { await fn(); await pause(); }); };
  t.after(async () => { await React.act(async () => root.unmount()); w.close(); });
  await render(props);
  return { w, calls, intervals, render, act, text: () => w.document.body.textContent };
}

test('お気に入りの開いた記事はデータ更新と手動再読込の両方で新着へ更新する', async t => {
  let articleTitle = '初回の記事';
  const h = await fixture(t, 'src/member-insight-favorites-final.tsx', 'MemberInsightFavoritesFinal', { revision: 0 }, async (_url, body) => {
    if (body.action === 'favorites') return response({ rows: [{ creator_key: 'a', actor_name: '作者A', actor_url: 'https://note.com/a' }] });
    if (body.action === 'favorite_articles') return response({ rows: [{ key: 'article', title: articleTitle, url: 'https://note.com/a/n/article' }] });
    return response({ definitions: [], assignments: [] });
  });
  await h.act(() => [...h.w.document.querySelectorAll('button')].find(x => x.textContent === '記事を見る').click());
  assert.match(h.text(), /初回の記事/);
  articleTitle = '更新後の記事'; await h.render({ revision: 1 });
  assert.match(h.text(), /更新後の記事/); assert.doesNotMatch(h.text(), /初回の記事/);
  articleTitle = '手動確認後の記事'; await h.act(() => [...h.w.document.querySelectorAll('button')].find(x => x.textContent === '再読込').click());
  assert.match(h.text(), /手動確認後の記事/);
  assert.equal(h.calls.filter(x => x.body.action === 'favorite_articles').length, 3);
});

test('お気に入りの古い遅延応答が新しい更新結果を上書きしない', async t => {
  const old = deferred(); let count = 0;
  const h = await fixture(t, 'src/member-insight-favorites-final.tsx', 'MemberInsightFavoritesFinal', { revision: 0 }, async (_url, body) => {
    if (body.action === 'favorites') return ++count === 1 ? old.promise : response({ rows: [{ creator_key: 'new', actor_name: '最新の作者' }] });
    return response({ definitions: [], assignments: [] });
  });
  await h.render({ revision: 1 }); assert.match(h.text(), /最新の作者/);
  await h.act(() => old.resolve(response({ rows: [{ creator_key: 'old', actor_name: '古い作者' }] })));
  assert.match(h.text(), /最新の作者/); assert.doesNotMatch(h.text(), /古い作者/);
});

const socialQuery = { action: 'comparison', window: 'oldest', relationship: 'following_only', query: '', page: 1, pageSize: 50 };
const socialSaved = { 'mumei-social-view-cache-v1:tester': JSON.stringify([{ key: 'tester|' + JSON.stringify(socialQuery), at: Date.now() - 600000, value: { noteId: 'tester', rows: [{ person_key: 'old', actor_name: '前回の人物', relation: 'following_only' }], total: 1 } }]) };

test('フォロー照合は前回ページの人物を先に出さず最新応答から開始する', async t => {
  const latest = deferred();
  const h = await fixture(t, 'src/member-insight-social-v2.tsx', 'MemberInsightSocialV2', {}, async () => latest.promise, socialSaved);
  await h.act(() => new Promise(resolve => setTimeout(resolve, 5)));
  assert.doesNotMatch(h.text(), /前回の人物/);
  await h.act(() => latest.resolve(response({ noteId: 'tester', rows: [{ person_key: 'new', actor_name: '最新の人物', relation: 'following_only' }], total: 1 })));
  assert.match(h.text(), /最新の人物/); assert.doesNotMatch(h.text(), /前回の人物/);
});

test('フォロー照合は通信に失敗した場合に保存済み人物を復元する', async t => {
  const h = await fixture(t, 'src/member-insight-social-v2.tsx', 'MemberInsightSocialV2', {}, async () => { throw new Error('通信失敗'); }, socialSaved);
  await h.act(() => new Promise(resolve => setTimeout(resolve, 5)));
  assert.match(h.text(), /前回の人物/); assert.match(h.text(), /読み込めませんでした/);
});

test('マガジンは非表示中に通信せず復帰と端末表示復帰で即時更新する', async t => {
  let calls = 0;
  const props = { revision: 0, accountKey: 'tester', active: false, cached: { rows: [{ key: 'old', title: '前回のマガジン' }], __cachedAt: Date.now() - 600000 }, history: async () => ({ rows: [{ key: 'new', title: `最新のマガジン${++calls}` }] }), search: async () => ({ rows: [] }) };
  const h = await fixture(t, 'src/member-insight-magazines.tsx', 'MemberInsightMagazines', props, async () => response({}));
  assert.equal(calls, 0); assert.doesNotMatch(h.text(), /前回のマガジン/);
  await h.render({ ...props, active: true }); assert.equal(calls, 1); assert.match(h.text(), /最新のマガジン1/);
  await h.act(() => { h.w.document.visibilityState = 'hidden'; h.w.document.dispatchEvent(new h.w.Event('visibilitychange')); });
  assert.equal(calls, 1);
  await h.act(() => { h.w.document.visibilityState = 'visible'; h.w.document.dispatchEvent(new h.w.Event('visibilitychange')); });
  assert.equal(calls, 2); assert.match(h.text(), /最新のマガジン2/);
  await h.render({ ...props, active: false }); await h.act(() => h.w.dispatchEvent(new h.w.Event('focus'))); assert.equal(calls, 2);
  await h.render({ ...props, active: true }); assert.equal(calls, 3); assert.match(h.text(), /最新のマガジン3/);
});

test('DMは画面を離れると定期通信を停止し復帰で本文を維持して再確認する', async t => {
  const h = await fixture(t, 'src/member-insight-dm.tsx', 'MemberInsightDm', { active: false }, async (_url, body) => {
    if (body.action === 'people') return response({ rows: [{ person_key: 'person-a', peer_name: '相手A', peer_note_id: 'a' }] });
    if (body.action === 'person_messages') return response({ rows: [{ message_key: 'saved', body: '保存された本文' }], total: 1 });
    return response({ paired: true, messages: 1, readerStatus: [] });
  });
  assert.equal(h.calls.length, 0);
  await h.render({ active: true }); assert.equal(h.calls.length, 3);
  await h.act(() => h.w.document.querySelector('.midm-threads button').click()); assert.match(h.text(), /保存された本文/);
  await h.render({ active: false }); const stoppedAt = h.calls.length;
  await h.act(() => { for (const timer of h.intervals.filter(x => !x.cancelled)) timer.fn(); h.w.dispatchEvent(new h.w.Event('focus')); });
  assert.equal(h.calls.length, stoppedAt);
  await h.render({ active: true }); assert.equal(h.calls.length, stoppedAt + 4); assert.match(h.text(), /保存された本文/);
  await h.act(() => { h.w.document.visibilityState = 'hidden'; h.w.document.dispatchEvent(new h.w.Event('visibilitychange')); });
  const hiddenAt = h.calls.length;
  await h.act(() => { for (const timer of h.intervals.filter(x => !x.cancelled && x.ms === 2500)) timer.fn(); });
  assert.equal(h.calls.length, hiddenAt);
  await h.act(() => { h.w.document.visibilityState = 'visible'; h.w.document.dispatchEvent(new h.w.Event('visibilitychange')); });
  assert.equal(h.calls.length, hiddenAt + 4); assert.match(h.text(), /保存された本文/);
});
