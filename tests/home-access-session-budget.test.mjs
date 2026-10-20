import test from 'node:test';
import assert from 'node:assert/strict';
import * as React from 'react';
import { sceneFixture, pause } from './react-scene-fixture.mjs';

const tokenKey = 'mumei-insight-access-token';
const account = { id: 'account-a', noteId: 'creator_a', displayName: '保存した本人', status: 'active', memberToken: 'token-a', applicantToken: 'applicant-a', updatedAt: 1 };
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const session = (app = {}) => Response.json({ ok: true, application: { ...account, displayName: '今回確認した本人', ...app } });
async function settle(work = () => {}) { await React.act(async () => { work(); for (let i = 0; i < 7; i++) await pause(); }); }
async function fixture(t, respond = () => session(), extraDependencies = {}) {
  const calls = [], globals = {}, h = await sceneFixture(t, { globals, dependencies: {
    './insight-visible-motion': { useVisibleMotion: () => ({ ref: null, motion: false }) }, './creator-avatar': { CreatorAvatar: () => null }, './hub-participant-showcase': { ParticipantShowcase: () => null }, './insight-display-mode': { DisplayModeSwitch: () => null }, ...extraDependencies,
  }, fetch: async (url, init) => { const call = { url, init, body: JSON.parse(init.body), token: init.headers?.['X-Insight-Token'] }; calls.push(call); return call.body.action === 'public-participants' ? Response.json({ participants: [] }) : respond(call); } });
  globals.Event = h.w.Event; globals.CustomEvent = h.w.CustomEvent;
  h.w.localStorage.setItem(tokenKey, account.memberToken); h.w.localStorage.setItem('mumei-insight-saved-accounts-v3', JSON.stringify([account])); h.w.localStorage.setItem('mumei-insight-active-account-v3', account.noteId);
  return { ...h, calls, store: h.load('src/insight-account-store.ts'), api: h.load('src/insight-session-request.ts'), home: h.load('src/hub-home-v2.tsx').HubHome, portal: h.load('src/access-portal-v6.tsx').AccessPortalV6 };
}

for (const screen of ['home', 'portal']) test(`${screen} StrictMode shares an unfinished automatic session check and later mounting checks again`, async t => {
  const pending = deferred(), h = await fixture(t, call => call.body.action === 'touch' ? Response.json({ ok: true }) : pending.promise);
  const independent = h.api.readInsightSession('token-a'); await settle(() => h.root.render(React.createElement(React.StrictMode, null, React.createElement(h[screen]))));
  assert.equal(h.calls.filter(x => x.body.action === 'session').length, 1);
  await settle(() => pending.resolve(session())); await independent;
  assert.equal(h.store.currentStoredInsightAccount().displayName, '今回確認した本人');
  await settle(() => h.root.render(null)); await h.render(h[screen]); await settle(); assert.equal(h.calls.filter(x => x.body.action === 'session').length, 2);
});

test('TOP joins an unfinished startup touch, but a later mount renews and authenticates independently', async t => {
  const touch = deferred(), h = await fixture(t, call => call.body.action === 'touch' ? touch.promise : session());
  const startup = h.api.touchInsightSession('token-a'); await h.render(h.home); await settle();
  assert.equal(h.calls.filter(x => x.body.action === 'touch').length, 1); assert.equal(h.calls.filter(x => x.body.action === 'session').length, 1, 'touch is never an authentication substitute');
  await settle(() => touch.resolve(Response.json({ ok: true }))); await startup;
  await settle(() => h.root.render(null)); await h.render(h.home); await settle();
  assert.equal(h.calls.filter(x => x.body.action === 'touch').length, 2); assert.equal(h.calls.filter(x => x.body.action === 'session').length, 2);
});

for (const screen of ['home', 'portal']) for (const action of ['switch', 'logout', 'unmount']) test(`${screen} ignores a delayed session after ${action}`, async t => {
  const pending = deferred(), h = await fixture(t, () => pending.promise); await h.render(h[screen]);
  await settle(() => {
    if (action === 'switch') h.store.rememberMemberSession({ ...account, noteId: 'creator_b', displayName: '切替先の本人' }, 'token-b');
    else if (action === 'logout') { h.w.localStorage.setItem('mumei-insight-explicit-logout:' + account.noteId, '1'); h.store.forgetMemberSession(account.noteId); }
    else h.root.render(null);
  });
  await settle(() => pending.resolve(session({ displayName: '遅い旧本人' })));
  assert.equal(h.w.localStorage.getItem(tokenKey), action === 'switch' ? 'token-b' : action === 'logout' ? null : 'token-a');
  assert.doesNotMatch(h.w.document.body.textContent, /遅い旧本人/); assert.equal(h.calls.filter(x => x.body.action === 'touch').length, 0);
  if (action !== 'unmount') assert.notEqual(h.w.location.hash, '#dashboard');
});

for (const failure of ['401', '402', 'wrong-account']) test(`TOP ${failure} never promotes unverified identity or clears saved login`, async t => {
  const h = await fixture(t, () => failure === 'wrong-account' ? session({ noteId: 'wrong_account' }) : Response.json({ ok: false, error: failure === '401' ? 'INSIGHT_SESSION_INVALID' : 'BACKEND_RESTRICTED_402' }, { status: Number(failure) }));
  await h.render(h.home); await settle(); assert.equal(h.w.localStorage.getItem(tokenKey), 'token-a'); assert.equal(h.store.currentStoredInsightAccount().noteId, 'creator_a'); assert.equal(h.calls.filter(x => x.body.action === 'touch').length, 0); assert.match(h.w.document.body.textContent, /ログイン情報は保持/);
});

test('TOP rechecks current token at the consumer continuation even after the shared helper resolved', async t => {
  const ready = deferred(), h = await fixture(t, () => Response.json({ ok: true }), { './insight-session-request': { readInsightSession: () => ready.promise, verifiedInsightSessionIdentity: () => ({ member: { noteId: account.noteId } }), touchInsightSession: () => { throw new Error('stale touch'); } } });
  ready.promise.then(() => h.store.rememberMemberSession({ ...account, noteId: 'creator_b', displayName: '切替先の本人' }, 'token-b'));
  await h.render(h.home); await settle(() => ready.resolve({ payload: { application: { ...account, displayName: '遅い旧本人' } } }));
  assert.equal(h.w.localStorage.getItem(tokenKey), 'token-b'); assert.equal(h.store.currentStoredInsightAccount().noteId, 'creator_b'); assert.doesNotMatch(h.w.document.body.textContent, /遅い旧本人/);
});

test('manual saved-account switching verifies its selected target separately from another account’s pending session', async t => {
  const old = deferred(), other = { ...account, noteId: 'creator_b', memberToken: 'token-b', displayName: '別の保存済み本人' }, h = await fixture(t, call => call.token === 'token-a' ? old.promise : session(other));
  h.w.localStorage.setItem('mumei-insight-saved-accounts-v3', JSON.stringify([account, other])); h.store.setAccessIntent('switch'); h.w.location.hash = '#access/insight';
  const previous = h.api.readInsightSession('token-a'); const rejected = assert.rejects(previous, /ACCOUNT_CHANGED/); await h.render(h.portal);
  await h.click([...h.w.document.querySelectorAll('.access2-account')].find(x => x.textContent.includes('creator_b')));
  assert.deepEqual(h.calls.filter(x => x.body.action === 'session').map(x => x.token), ['token-a', 'token-b']); assert.equal(h.w.localStorage.getItem(tokenKey), 'token-b'); assert.equal(h.w.location.hash, '#dashboard');
  old.resolve(session()); await rejected;
});
