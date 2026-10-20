import test from 'node:test';
import assert from 'node:assert/strict';
import { sceneFixture, pause } from './react-scene-fixture.mjs';

const tokenKey = 'mumei-insight-access-token', joinKey = 'mumei-insight-current-join-v5';
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const account = { noteId: 'creator_a', applicantToken: 'applicant-a', memberToken: 'token-a', status: 'active', updatedAt: 1 };
const response = (extra = {}) => Response.json({ ok: true, application: { noteId: account.noteId, status: 'active' }, memberToken: 'restored-a', ...extra });
async function fixture(t, respond) {
  const calls = [], globals = {}, h = await sceneFixture(t, { globals, fetch: async (url, init) => { const call = { url, init, body: JSON.parse(init.body) }; calls.push(call); return respond(call, calls.length); } });
  globals.Event = h.w.Event;
  h.w.localStorage.setItem(tokenKey, account.memberToken); h.w.localStorage.setItem('mumei-insight-saved-accounts-v3', JSON.stringify([account])); h.w.localStorage.setItem('mumei-insight-active-account-v3', account.noteId);
  return { ...h, calls, api: h.load('src/insight-session-request.ts'), store: h.load('src/insight-account-store.ts') };
}

test('same applicant and current account share exactly one complete resume operation; later calls recheck server', async t => {
  const body = deferred(), h = await fixture(t, (_call, n) => n === 1 ? { ok: true, json: () => body.promise } : response());
  const a = h.api.resumeInsightSession(account), b = h.api.resumeInsightSession(account); await pause(); assert.equal(h.calls.length, 1);
  const c = h.api.resumeInsightSession(account); await pause(); assert.equal(h.calls.length, 1, 'body still pending');
  body.resolve({ ok: true, application: { noteId: account.noteId, status: 'active' }, memberToken: 'restored-a' });
  const results = await Promise.all([a, b, c]); assert.ok(results.every(x => x.payload.memberToken === 'restored-a'));
  await h.api.resumeInsightSession(account); assert.equal(h.calls.length, 2); assert.equal(h.calls[0].init.headers['X-Insight-Applicant'], account.applicantToken);
});

test('cancelling one resume consumer leaves its peer active', async t => {
  const pending = deferred(), h = await fixture(t, () => pending.promise), a = new AbortController(), b = new AbortController();
  const first = h.api.resumeInsightSession(account, a.signal), second = h.api.resumeInsightSession(account, b.signal); await pause(); a.abort();
  await assert.rejects(first, e => e.name === 'AbortError'); assert.equal(h.calls.length, 1); assert.equal(h.calls[0].init.signal, undefined);
  pending.resolve(response()); assert.equal((await second).payload.memberToken, 'restored-a');
});

test('all consumers cancelling never aborts or retries a sent mutation of uncertain outcome', async t => {
  const pending = deferred(), h = await fixture(t, () => pending.promise), controller = new AbortController();
  const first = h.api.resumeInsightSession(account, controller.signal); await pause(); controller.abort(); await assert.rejects(first, e => e.name === 'AbortError');
  const replay = h.api.resumeInsightSession(account); await pause(); assert.equal(h.calls.length, 1, 'remount joins the already-sent mutation'); assert.equal(h.calls[0].init.signal, undefined);
  pending.resolve(response()); assert.equal((await replay).payload.memberToken, 'restored-a');
});

for (const change of ['logout', 'token', 'scope', 'applicant', 'join']) test(`resume result is rejected across ${change} boundary`, async t => {
  const pending = deferred(), h = await fixture(t, () => pending.promise), read = h.api.resumeInsightSession(account); await pause();
  if (change === 'logout') h.w.localStorage.setItem('mumei-insight-explicit-logout:' + account.noteId, '1');
  else if (change === 'token') h.w.localStorage.setItem(tokenKey, 'token-b');
  else if (change === 'scope') h.w.localStorage.setItem('mumei-insight-saved-accounts-v3', JSON.stringify([{ ...account, noteId: 'creator_b' }]));
  else if (change === 'applicant') h.w.localStorage.setItem('mumei-insight-saved-accounts-v3', JSON.stringify([{ ...account, applicantToken: 'new-applicant' }]));
  else h.w.localStorage.setItem(joinKey, 'creator_b');
  pending.resolve(response()); await assert.rejects(read, /ACCOUNT_CHANGED/); assert.equal(h.calls.length, 1);
});

test('different applicants cannot share an in-flight resume and old completion cannot remove newer work', async t => {
  const old = deferred(), next = deferred(), h = await fixture(t, (_call, n) => n === 1 ? old.promise : next.promise);
  const first = h.api.resumeInsightSession(account); await pause(); const newer = { ...account, applicantToken: 'applicant-new' };
  h.w.localStorage.setItem('mumei-insight-saved-accounts-v3', JSON.stringify([newer])); const second = h.api.resumeInsightSession(newer); await pause(); assert.equal(h.calls.length, 2);
  old.resolve(response()); await assert.rejects(first, /ACCOUNT_CHANGED/); const third = h.api.resumeInsightSession(newer); await pause(); assert.equal(h.calls.length, 2);
  next.resolve(response()); await Promise.all([second, third]);
});

for (const failure of ['network', '401', 'malformed', 'wrong-account']) test(`resume ${failure} settles without automatic retries or local auth writes`, async t => {
  const pending = deferred(), h = await fixture(t, (_call, n) => n === 1 ? pending.promise : response());
  const first = h.api.resumeInsightSession(account), second = h.api.resumeInsightSession(account); await pause();
  if (failure === 'network') pending.reject(new Error('offline'));
  else if (failure === '401') pending.resolve(Response.json({ ok: false, error: 'APPLICANT_TOKEN_INVALID' }, { status: 401 }));
  else if (failure === 'malformed') pending.resolve(new Response('{'));
  else pending.resolve(response({ application: { noteId: 'wrong_account', status: 'active' } }));
  if (failure === '401') { const results = await Promise.all([first, second]); assert.ok(results.every(x => x.response.status === 401)); }
  else await Promise.all([assert.rejects(first), assert.rejects(second)]);
  await pause(); assert.equal(h.calls.length, 1); assert.equal(h.w.localStorage.getItem(tokenKey), account.memberToken);
  await h.api.resumeInsightSession(account); assert.equal(h.calls.length, 2, 'new caller after settlement is not served a cached result');
});

test('already-aborted consumer or explicit logout cannot submit resume', async t => {
  const h = await fixture(t, () => response()), controller = new AbortController(); controller.abort(); await assert.rejects(h.api.resumeInsightSession(account, controller.signal), e => e.name === 'AbortError');
  h.w.localStorage.setItem('mumei-insight-explicit-logout:' + account.noteId, '1'); await assert.rejects(h.api.resumeInsightSession(account), /ACCOUNT_CHANGED/); assert.equal(h.calls.length, 0);
});

test('touch shares only the same unfinished token/scope operation and never substitutes for session auth', async t => {
  const pending = deferred(), h = await fixture(t, (call, n) => call.body.action === 'touch' ? n === 1 ? pending.promise : Response.json({ ok: true }) : Response.json({ ok: true, application: { noteId: account.noteId, status: 'active' } }));
  const first = h.api.touchInsightSession(account.memberToken), second = h.api.touchInsightSession(account.memberToken); await pause(); assert.equal(h.calls.length, 1);
  await h.api.readInsightSession(account.memberToken); assert.deepEqual(h.calls.map(x => x.body.action), ['touch', 'session']);
  pending.resolve(Response.json({ ok: true })); await Promise.all([first, second]); await h.api.touchInsightSession(account.memberToken); assert.equal(h.calls.filter(x => x.body.action === 'touch').length, 2);
});

for (const failure of ['network', '401', 'malformed']) test(`touch ${failure} settles without cached success or an automatic retry`, async t => {
  const pending = deferred(), h = await fixture(t, (_call, n) => n === 1 ? pending.promise : Response.json({ ok: true }));
  const first = h.api.touchInsightSession(account.memberToken), second = h.api.touchInsightSession(account.memberToken); await pause();
  if (failure === 'network') pending.reject(new Error('offline')); else pending.resolve(failure === 'malformed' ? new Response('{') : Response.json({ ok: false }, { status: 401 }));
  await Promise.all([assert.rejects(first), assert.rejects(second)]); await pause(); assert.equal(h.calls.length, 1); await h.api.touchInsightSession(account.memberToken); assert.equal(h.calls.length, 2);
});

test('touch cannot share across token/account changes and rejects the old completion', async t => {
  const old = deferred(), h = await fixture(t, (_call, n) => n === 1 ? old.promise : Response.json({ ok: true }));
  const first = h.api.touchInsightSession(account.memberToken); await pause(); h.store.rememberMemberSession({ noteId: 'creator_b', status: 'active' }, 'token-b');
  await h.api.touchInsightSession('token-b'); assert.equal(h.calls.length, 2); assert.equal(h.calls[1].init.headers['X-Insight-Token'], 'token-b');
  old.resolve(Response.json({ ok: true })); await assert.rejects(first, /ACCOUNT_CHANGED/); assert.equal(h.w.localStorage.getItem(tokenKey), 'token-b');
});
