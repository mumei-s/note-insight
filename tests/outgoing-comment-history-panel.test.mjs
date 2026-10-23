import test from 'node:test';
import assert from 'node:assert/strict';
import * as React from 'react';
import { sceneFixture, pause } from './react-scene-fixture.mjs';

const tokenKey = 'mumei-insight-access-token';
const row = (change = {}) => ({ id: 'self:n123:nc1', articleKey: 'n123', commentKey: 'nc1', parentKey: null,
  bodyPreview: '自分が投稿した本文', occurredAt: '2026-10-23T00:00:00Z', authorUrl: 'https://note.com/self',
  articleUrl: 'https://note.com/peer/n/n123', commentUrl: 'https://note.com/peer/n/n123?c=nc1', ...change });
const listing = (rows = [row()], change = {}) => ({ ok: true, noteId: 'self', page: 1, pageSize: 20, hasMore: false, rows, permission: { enabled: false, activeDeviceCount: 0 }, ...change });
const detail = (change = {}) => ({ ok: true, noteId: 'self', row: { ...row(), body: '自分が投稿した本文の全体' },
  conversation: { articleKey: 'n123', threadKey: 'nc1', complete: false, source: 'saved-only', messages: [
    { commentKey: 'nc1', parentKey: null, body: '自分が投稿した本文の全体', author: '自分', authorUrl: 'https://note.com/self', isSelf: true, occurredAt: '2026-10-23T00:00:00Z' },
    { commentKey: 'nc2', parentKey: 'nc1', body: '相手からの保存済み返信', author: '相手', authorUrl: 'https://note.com/peer', isSelf: false, occurredAt: '2026-10-23T00:01:00Z' },
  ] }, replyState: 'unknown', ...change });
const consentResult = (change = {}) => ({ ok: true, noteId: 'self', pairingCode: '1234567890abcdef1234567890abcdef', expiresAt: new Date(Date.now() + 600000).toISOString(), noteUrl: 'https://note.com/self?mumei_own_comment_scope=1234567890abcdef1234567890abcdef&mumei_account=self', ...change });
async function settle(work = () => {}) { await React.act(async () => { work(); for (let i = 0; i < 5; i++) await pause(); }); }
async function fixture(t, { respond, saved, savedToken = 'token-a' } = {}) {
  const calls = [];
  const h = await sceneFixture(t, { fetch: (url, init) => new Promise((resolve, reject) => {
    const call = { url: String(url), body: JSON.parse(init.body), headers: init.headers, signal: init.signal,
      resolve: (value, status = 200) => resolve(Response.json(value, { status })), reject };
    calls.push(call);
    if (respond) Promise.resolve(respond(call)).then(value => { if (value !== undefined) call.resolve(value); }, reject);
  }) });
  h.w.localStorage.setItem(tokenKey, 'token-a');
  const copies = h.load('src/insight-saved-view.ts');
  if (saved) copies.writeSavedInsightView('outgoing-comments', { account: 'self', token: savedToken }, saved, 1);
  const Component = h.load('src/member-insight-outgoing-comments.tsx').MemberInsightOutgoingComments;
  const start = props => h.render(Component, { noteId: 'self', ...props });
  const toggle = async (element, open = true) => React.act(async () => { element.open = open; await new Promise(resolve => h.w.setTimeout(resolve, 0)); await pause(); });
  await start();
  return { ...h, calls, start, text: () => h.w.document.body.textContent,
    open: () => toggle(h.w.document.querySelector('.mioc')), close: () => toggle(h.w.document.querySelector('.mioc'), false),
    openEntry: (index = 0) => toggle(h.w.document.querySelectorAll('.mioc-entry')[index]),
    button: text => [...h.w.document.querySelectorAll('button')].find(element => element.textContent === text),
    checkbox: () => h.w.document.querySelector('input[type=checkbox]'),
    resolve: (index, value) => settle(() => calls[index].resolve(value)),
    savedView: (account = 'self', token = 'token-a') => copies.readSavedInsightView('outgoing-comments', { account, token }),
    unmount: () => h.render(() => null, {}),
  };
}

test('mount is read-only and page-generated consent clicks cannot issue a code', async t => {
  const h = await fixture(t);
  assert.equal(h.calls.length, 0); assert.equal(h.checkbox(), null);
  await h.open(); await h.resolve(0, listing());
  await h.click(h.button('同意してnoteへ進む'));
  assert.equal(h.calls.length, 1); assert.equal(h.w.document.querySelector('.mioc-handoff'), null);
  assert.match(h.text(), /下書き・投稿失敗・旧形式のコメント欄・note公式アプリ/);
  assert.match(h.text(), /アカウント・記事・コメント・親コメントのID、投稿日時/);
  assert.match(h.text(), /非公開INSIGHT/);
});


test('same-account prior archive is immediate, not a fresh check, and another token cannot reuse it', async t => {
  const saved = { rows: [row({ bodyPreview: '前回の保存本文' })], details: {}, hasMore: false };
  const h = await fixture(t, { saved });
  assert.match(h.text(), /前回の保存本文/); assert.match(h.text(), /前回保存分・最新未確認/); assert.equal(h.calls.length, 0);
  await h.open(); assert.match(h.text(), /前回の保存本文/);
  await settle(() => h.calls[0].reject(new Error('offline')));
  assert.match(h.text(), /前回の保存本文/); assert.match(h.text(), /保存済みの内容は保持/);
  assert.equal(h.savedView().savedAt, 1);
  h.w.localStorage.setItem(tokenKey, 'token-b'); await h.start();
  assert.doesNotMatch(h.text(), /前回の保存本文/); assert.equal(h.checkbox(), null);
});

test('list is previews only; detail obtains exact keys and shows a chronological self/other chat', async t => {
  const h = await fixture(t);
  await h.open(); await h.resolve(0, listing());
  assert.equal(h.calls.length, 1); assert.doesNotMatch(h.text(), /相手からの保存済み返信/);
  await h.openEntry(); assert.equal(h.calls.length, 2);
  assert.deepEqual(h.calls[1].body, { action: 'detail', articleKey: 'n123', commentKey: 'nc1' });
  await h.resolve(1, detail());
  const bubbles = [...h.w.document.querySelectorAll('.mioc-message')];
  assert.equal(bubbles.length, 2); assert.ok(bubbles[0].classList.contains('self')); assert.ok(bubbles[1].classList.contains('other'));
  assert.match(bubbles[0].textContent, /自分が投稿した本文の全体/); assert.match(bubbles[1].textContent, /相手からの保存済み返信/);
  assert.match(h.text(), /返信の取得状況は未確認/); assert.doesNotMatch(h.text(), /返信なし/);
  assert.equal(h.w.document.querySelector('.mioc-entry a').href, 'https://note.com/peer/n/n123?c=nc1');
  assert.equal(h.savedView().value.details['n123:nc1'].row.body, '自分が投稿した本文の全体');
  assert.equal(h.checkbox(), null);
});

test('only proven same-thread IDs are grouped, never same author or article alone', async t => {
  const h = await fixture(t);
  await h.open(); await h.resolve(0, listing()); await h.openEntry();
  const data = detail();
  data.conversation.messages.push({ commentKey: 'ncUnrelated', parentKey: 'ncElsewhere', body: '混ぜない別会話', author: '相手', isSelf: false });
  await h.resolve(1, data); assert.doesNotMatch(h.text(), /混ぜない別会話/);
  assert.equal(h.w.document.querySelectorAll('.mioc-message').length, 2);
  await h.click(h.button('保存した会話を更新'));
  await h.resolve(2, detail({ conversation: { ...data.conversation, articleKey: 'nOther' } }));
  assert.equal(h.w.document.querySelectorAll('.mioc-message').length, 2, '以前に確認した正しい会話は保持する');
  assert.match(h.text(), /自分が投稿した本文の全体/);
});

test('bad roots and a reply not connected to selected anchor cannot create a false conversation', async t => {
  const h = await fixture(t);
  await h.open(); await h.resolve(0, listing()); await h.openEntry();
  const data = detail(); data.conversation.threadKey = 'ncOtherRoot'; data.conversation.messages.push({ commentKey: 'ncOtherRoot', parentKey: null, body: '無関係なルート本文' });
  await h.resolve(1, data); assert.equal(h.w.document.querySelectorAll('.mioc-message').length, 1);
  assert.doesNotMatch(h.text(), /無関係なルート本文|相手からの保存済み返信/);
});

test('deleted/unavailable detail never replaces archived body with empty content', async t => {
  const h = await fixture(t);
  await h.open(); await h.resolve(0, listing()); await h.openEntry(); await h.resolve(1, detail());
  await h.click(h.button('保存した会話を更新'));
  await h.resolve(2, detail({ row: { ...row(), body: '' }, conversation: null }));
  assert.match(h.text(), /自分が投稿した本文の全体/); assert.match(h.text(), /相手からの保存済み返信/);
  assert.match(h.text(), /保存済みの内容は保持/);
  assert.equal(h.savedView().value.details['n123:nc1'].row.body, '自分が投稿した本文の全体');
});

test('full cached conversation is immediate after remount and details reread only when opened', async t => {
  const h = await fixture(t);
  await h.open(); await h.resolve(0, listing()); await h.openEntry(); await h.resolve(1, detail());
  await h.unmount(); await h.start();
  assert.match(h.text(), /自分が投稿した本文の全体/); assert.match(h.text(), /相手からの保存済み返信/);
  assert.equal(h.calls.length, 2);
  await h.open(); assert.equal(h.calls.length, 3); await h.resolve(2, listing());
  assert.match(h.text(), /相手からの保存済み返信/);
  await h.openEntry(); assert.equal(h.calls.length, 4);
  await h.resolve(3, detail());
});

test('no interval/focus polling, repeated opening reuses completed page, refresh is explicit', async t => {
  const h = await fixture(t);
  await h.open(); await h.resolve(0, listing());
  await settle(() => { h.w.dispatchEvent(new h.w.Event('focus')); h.w.document.dispatchEvent(new h.w.Event('visibilitychange')); });
  await h.close(); await h.open(); assert.equal(h.calls.length, 1);
  await h.click(h.button('履歴を更新')); assert.equal(h.calls.length, 2); await h.resolve(1, listing());
});

test('pagination is bounded, click-deduplicated, keeps previous rows, and copies only first page', async t => {
  const h = await fixture(t);
  const rows = Array.from({ length: 20 }, (_, i) => row({ id: 'self:n123:nc' + i, commentKey: 'nc' + i, bodyPreview: '履歴' + i, commentUrl: null }));
  await h.open(); await h.resolve(0, listing(rows, { hasMore: true }));
  await h.click(h.button('続きの履歴を表示')); await h.click(h.button('続きの履歴を表示'));
  assert.equal(h.calls.length, 2); assert.equal(h.calls[1].body.page, 2); assert.equal(h.w.document.querySelectorAll('.mioc-entry').length, 20);
  await h.resolve(1, listing([row({ commentKey: 'nc20', id: 'self:n123:nc20', bodyPreview: '履歴20' })], { page: 2 }));
  assert.equal(h.w.document.querySelectorAll('.mioc-entry').length, 21);
  assert.equal(h.savedView().value.rows.length, 20); assert.equal(h.savedView().value.hasMore, true);
});

test('session switch aborts list and detail and rejects their late results', async t => {
  const h = await fixture(t);
  await h.open(); await h.resolve(0, listing()); await h.openEntry();
  h.w.localStorage.setItem(tokenKey, 'token-b'); await h.start({ noteId: 'second' });
  assert.equal(h.calls[1].signal.aborted, true); assert.doesNotMatch(h.text(), /自分が投稿した本文/);
  await h.resolve(1, detail()); assert.doesNotMatch(h.text(), /自分が投稿した本文の全体|相手からの保存済み返信/);
  await h.open(); assert.equal(h.calls[2].headers['X-Insight-Token'], 'token-b');
  await h.resolve(2, listing([row({ bodyPreview: '別アカウントの履歴', id: 'second:n123:nc1', authorUrl: 'https://note.com/second' })], { noteId: 'second' }));
  assert.match(h.text(), /別アカウントの履歴/);
});

test('closing aborts unfinished list, clears consent, and reopening makes one fresh read', async t => {
  const h = await fixture(t);
  await h.open(); await h.close();
  assert.equal(h.calls[0].signal.aborted, true); assert.equal(h.checkbox(), null);
  await h.open(); assert.equal(h.calls.length, 2); await h.resolve(1, listing());
  await h.resolve(0, listing([row({ bodyPreview: '閉じる前の古い応答' })]));
  assert.doesNotMatch(h.text(), /閉じる前の古い応答/);
});





test('saved-only history never infers absence of replies or current-browser permission', async t => {
  const h = await fixture(t);
  await h.open(); await h.resolve(0, listing([], { permission: { enabled: true, activeDeviceCount: 2 } }));
  assert.match(h.text(), /連携済み端末あり（2台）/); assert.match(h.text(), /このブラウザの連携状態は未確認/);
  assert.match(h.text(), /保存されていない投稿や返信がないことを示すものではありません/);
  assert.equal(h.checkbox(), null); assert.doesNotMatch(h.text(), /返信なし/);
});

test('foreign article/comment URLs are suppressed rather than guessed from self account', async t => {
  const h = await fixture(t);
  await h.open(); await h.resolve(0, listing([row({ articleUrl: 'https://note.com/peer/n/nOther', commentUrl: 'https://note.com/peer/n/n123?c=ncWrong' })]));
  assert.equal(h.w.document.querySelector('.mioc-entry a'), null); assert.match(h.text(), /記事のリンクは未確認/);
  await h.openEntry(); await h.resolve(1, detail({ row: { ...row(), body: '本文', articleUrl: null, commentUrl: null } }));
  assert.equal(h.w.document.querySelector('.mioc-entry a'), null);
});


test('mismatched response account or stable archive owner is rejected and never cached', async t => {
  const h = await fixture(t);
  await h.open(); await h.resolve(0, listing([row({ bodyPreview: '表示してはいけない他人の本文' })], { noteId: 'other' }));
  assert.doesNotMatch(h.text(), /表示してはいけない他人の本文/); assert.equal(h.savedView(), null);
  await h.click(h.button('履歴を更新'));
  await h.resolve(1, listing([row({ id: 'other:n123:nc1', authorUrl: 'https://note.com/other', bodyPreview: '所有者が異なる本文' })]));
  assert.doesNotMatch(h.text(), /所有者が異なる本文/); assert.equal(h.savedView(), null);
});

test('auth rejection discards cached display and prevents another in-flight result reviving it', async t => {
  const h = await fixture(t);
  await h.open(); await h.resolve(0, listing()); await h.openEntry();
  await h.click(h.button('履歴を更新')); assert.equal(h.calls.length, 3);
  await settle(() => h.calls[1].resolve({ ok: false, error: 'INSIGHT_SESSION_INVALID' }, 401));
  assert.match(h.text(), /ログインし直してください/); assert.doesNotMatch(h.text(), /自分が投稿した本文/);
  assert.equal(h.calls[2].signal.aborted, true); assert.equal(h.savedView(), null);
  await h.resolve(2, listing([row({ bodyPreview: '失効後の遅い本文' })]));
  assert.doesNotMatch(h.text(), /失効後の遅い本文/); assert.equal(h.savedView(), null);
});

test('opening/closing nested entries cannot reset main-panel consent or trigger another list', async t => {
  const h = await fixture(t);
  await h.open(); await h.resolve(0, listing());
  await h.openEntry(); await h.resolve(1, detail());
  const entry = h.w.document.querySelector('.mioc-entry');
  await React.act(async () => { entry.open = false; await new Promise(resolve => h.w.setTimeout(resolve, 0)); await pause(); });
  assert.equal(h.checkbox(), null); assert.equal(h.calls.length, 2);
  assert.equal(h.w.document.querySelector('.mioc').open, true);
});


test('later omitted or deleted replies retain already verified saved conversation bodies', async t => {
  const h = await fixture(t);
  await h.open(); await h.resolve(0, listing()); await h.openEntry(); await h.resolve(1, detail());
  await h.click(h.button('保存した会話を更新'));
  const omitted = detail(); omitted.conversation.messages = omitted.conversation.messages.slice(0, 1);
  await h.resolve(2, omitted); assert.match(h.text(), /相手からの保存済み返信/);
  await h.click(h.button('保存した会話を更新'));
  const deleted = detail(); deleted.conversation.messages[1].body = 'このコメントは削除されました。';
  await h.resolve(3, deleted); assert.match(h.text(), /相手からの保存済み返信/);
  assert.doesNotMatch(h.text(), /このコメントは削除されました/);
  assert.equal(h.savedView().value.details['n123:nc1'].messages[1].body, '相手からの保存済み返信');
});
