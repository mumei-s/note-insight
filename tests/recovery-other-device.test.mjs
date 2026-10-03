import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import ts from 'typescript';

const source = readFileSync('supabase/functions/insight-recovery/index.ts', 'utf8').replace(/^import[^\n]+\n/, '');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const hash = async value => Buffer.from(await webcrypto.subtle.digest('SHA-256', new TextEncoder().encode(value))).toString('hex');

function fixture(status = 'approved') {
  const originalSession = { application_id: 'same-member', token_hash: 'existing-device', expires_at: '2099-01-01' };
  const app = { id: 'same-member', note_id: 'approved_member', display_name: '参加者', status, approved_at: '2026-10-02', verified_at: status === 'active' ? '2026-10-02' : null, applicant_token_hash: 'old-applicant', verification_code_hash: null, verification_code_plain: null, verification_attempts: 0 };
  const tables = { insight_access_applications: status ? [app] : [], insight_member_sessions: status === 'active' ? [originalSession] : [], insight_participants_public: status ? [{ member_id: 'same-member', note_id: app.note_id, role: 'member', active: status === 'active' }] : [] };
  const state = { tables, app, originalSession, profile: '', responseId: app.note_id, beforeFetch: null, fetchCount: 0 };
  const db = { from(table) {
    assert.ok(table in tables, `unexpected table: ${table}`);
    let operation = 'select', payload = null;
    const filters = [];
    const query = {
      select: () => query,
      eq: (key, value) => { filters.push(row => row[key] === value); return query; },
      ilike: (key, value) => { filters.push(row => String(row[key]).toLowerCase() === value.toLowerCase()); return query; },
      in: (key, values) => { filters.push(row => values.includes(row[key])); return query; },
      update: value => { operation = 'update'; payload = value; return query; },
      insert: value => { operation = 'insert'; payload = value; return query; },
    };
    const run = () => {
      let rows = tables[table].filter(row => filters.every(filter => filter(row)));
      if (operation === 'update') rows.forEach(row => Object.assign(row, payload));
      if (operation === 'insert') { const row = structuredClone(payload); tables[table].push(row); rows = [row]; }
      return { data: structuredClone(rows), error: null };
    };
    query.maybeSingle = async () => { const result = run(); assert.ok(result.data.length <= 1); return { ...result, data: result.data[0] || null }; };
    query.then = (resolve, reject) => Promise.resolve(run()).then(resolve, reject);
    return query;
  } };
  let handler;
  const context = vm.createContext({
    createClient: () => db, crypto: webcrypto, TextEncoder, URL, Response, AbortController, setTimeout, clearTimeout, console,
    Deno: { env: { get: () => '' }, serve: callback => { handler = callback; } },
    fetch: async () => {
      state.fetchCount++;
      if (state.beforeFetch) await state.beforeFetch(state.fetchCount);
      return new Response(JSON.stringify({ data: { urlname: state.responseId, nickname: '参加者', profile: state.profile } }), { status: 200 });
    },
  });
  vm.runInContext(compiled, context);
  state.call = async (action, extra = {}, token = '') => {
    const response = await handler(new Request('https://example.test/insight-recovery', {
      method: 'POST', headers: { 'content-type': 'application/json', 'origin': 'https://mumei-s.github.io', ...(token ? { 'X-Insight-Recovery': token } : {}) }, body: JSON.stringify({ action, ...extra }),
    }));
    return { status: response.status, body: await response.json() };
  };
  state.start = () => state.call('start', { noteInput: 'https://note.com/approved_member' });
  return state;
}

test('承認済み・本人確認前の参加者は別PCでコードを発行し、本人確認後だけ同じ申請を有効化する', async () => {
  const f = fixture();
  const started = await f.start();
  assert.equal(started.status, 200);
  assert.equal(started.body.application.status, 'approved');
  assert.equal(f.app.id, 'same-member');
  assert.equal(f.app.verified_at, null);
  assert.equal(f.tables.insight_member_sessions.length, 0);
  assert.equal(f.tables.insight_participants_public[0].active, false);
  assert.match(started.body.verificationCode, /^INSIGHT-[A-F0-9]{8}$/);
  const notYet = await f.call('verify', {}, started.body.recoveryToken);
  assert.equal(notYet.status, 401);
  assert.equal(notYet.body.error, 'PROFILE_CODE_NOT_FOUND');
  assert.equal(f.app.status, 'approved');
  assert.equal(f.tables.insight_member_sessions.length, 0);
  f.profile = `自己紹介\n${started.body.verificationCode}`;
  const verified = await f.call('verify', {}, started.body.recoveryToken);
  assert.equal(verified.status, 200);
  assert.equal(verified.body.application.id, 'same-member');
  assert.equal(verified.body.application.status, 'active');
  assert.equal(f.app.approved_at, '2026-10-02');
  assert.ok(f.app.verified_at);
  assert.equal(f.app.verification_code_plain, null);
  assert.equal(f.app.verification_code_hash, null);
  assert.equal(f.tables.insight_participants_public.length, 1);
  assert.equal(f.tables.insight_participants_public[0].active, true);
  assert.equal(f.tables.insight_member_sessions[0].application_id, 'same-member');
  assert.equal(f.tables.insight_member_sessions[0].token_hash, await hash(verified.body.memberToken));
  const replay = await f.call('verify', {}, started.body.recoveryToken);
  assert.equal(replay.body.error, 'RECOVERY_NOT_READY');
  assert.equal(f.tables.insight_member_sessions.length, 1);
});

test('承認待ち・却下・利用停止・未申請は別端末の入口から本人確認や利用開始へ進めない', async () => {
  for (const status of ['pending', 'rejected', 'revoked', null]) {
    const f = fixture(status);
    const result = await f.start();
    assert.equal(result.status, 401, String(status));
    assert.equal(result.body.error, 'INSIGHT_MEMBER_NOT_ACTIVE');
    assert.equal(f.app.applicant_token_hash, 'old-applicant');
    assert.equal(f.app.verification_code_plain, null);
    assert.equal(f.tables.insight_member_sessions.length, 0);
  }
});

test('入力のnote IDと違うプロフィール応答ではコードを発行しない', async () => {
  const f = fixture(); f.responseId = 'different_member';
  const result = await f.start();
  assert.equal(result.body.error, 'NOTE_ACCOUNT_MISMATCH');
  assert.equal(f.app.applicant_token_hash, 'old-applicant');
  assert.equal(f.tables.insight_member_sessions.length, 0);
});

test('有効な参加者はPC2台とスマホのセッションを追加でき、他端末のログインを失効させない', async () => {
  const f = fixture('active');
  const newTokens = [];
  for (let device = 0; device < 3; device++) {
    const started = await f.start();
    f.profile = started.body.verificationCode;
    const verified = await f.call('verify', {}, started.body.recoveryToken);
    assert.equal(verified.status, 200);
    newTokens.push(verified.body.memberToken);
  }
  assert.equal(new Set(newTokens).size, 3);
  assert.equal(f.tables.insight_member_sessions.length, 4);
  assert.deepEqual(f.tables.insight_member_sessions[0], f.originalSession);
  assert.ok(f.tables.insight_member_sessions.every(row => !row.revoked_at && row.application_id === 'same-member'));
});

test('本人確認中にOWNERが利用停止にした申請を再度有効化しない', async () => {
  const f = fixture();
  const started = await f.start(); f.profile = started.body.verificationCode;
  f.beforeFetch = count => { if (count === 2) f.app.status = 'revoked'; };
  const result = await f.call('verify', {}, started.body.recoveryToken);
  assert.equal(result.body.error, 'RECOVERY_NOT_READY');
  assert.equal(f.app.status, 'revoked');
  assert.equal(f.app.verified_at, null);
  assert.equal(f.tables.insight_member_sessions.length, 0);
});

test('後から発行した確認コードを、古い確認操作で消費しない', async () => {
  const f = fixture();
  const old = await f.start(); f.profile = old.body.verificationCode;
  f.beforeFetch = async count => {
    if (count === 2) {
      f.app.applicant_token_hash = await hash('new-device-token');
      f.app.verification_code_hash = await hash('INSIGHT-NEWCODE');
      f.app.verification_code_plain = 'INSIGHT-NEWCODE';
    }
  };
  const result = await f.call('verify', {}, old.body.recoveryToken);
  assert.equal(result.body.error, 'RECOVERY_NOT_READY');
  assert.equal(f.app.status, 'approved');
  assert.equal(f.app.verification_code_plain, 'INSIGHT-NEWCODE');
  assert.equal(f.tables.insight_member_sessions.length, 0);
});
