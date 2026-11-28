// Server only. Cloudflare Workers + D1. All database timestamps use Unix seconds.
const OWNER = 'ss_yr';
const SESSION = '__Host-editor_session';
const CHALLENGE = '__Host-editor_challenge';
const SESSION_LIFETIME = 90 * 24 * 3600;
const CHALLENGE_LIFETIME = 20 * 60;
const TOKEN = /^[a-f0-9]{64}$/;
const HANDLE = /^[a-z0-9_]{1,32}$/;
const unixNow = () => Math.floor(Date.now() / 1000);
const iso = seconds => new Date(seconds * 1000).toISOString();
const hex = bytes => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
const randomHex = count => hex(crypto.getRandomValues(new Uint8Array(count)));
const paths = new Map([
  ['/api/session', ['GET']],
  ['/api/auth/start', ['POST']],
  ['/api/auth/confirm', ['POST']],
  ['/api/auth/logout', ['POST']],
  ['/api/admin/access', ['GET', 'POST']],
]);

class AuthError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
function fail(status, message) { throw new AuthError(status, message); }

async function digest(value) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
}
async function tokenHash(value) { return hex(await digest(value)); }

async function validSecret(value, expected) {
  if (typeof expected !== 'string' || !expected.length) fail(503, '認証の準備中です。');
  if (typeof value !== 'string' || !value.length) return false;
  const [actual, wanted] = await Promise.all([digest(value), digest(expected)]);
  let difference = 0;
  for (let i = 0; i < actual.length; i++) difference |= actual[i] ^ wanted[i];
  return difference === 0;
}

function reply(body, status = 200, cookies = []) {
  const headers = new Headers({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
  });
  for (const cookie of cookies) headers.append('Set-Cookie', cookie);
  return new Response(JSON.stringify(body), {status, headers});
}
function setCookie(name, token, lifetime) {
  return `${name}=${token}; Path=/; Max-Age=${lifetime}; HttpOnly; Secure; SameSite=Lax`;
}
function readCookie(request, name) {
  const values = (request.headers.get('Cookie') || '').split(';').map(v => v.trim())
    .filter(v => v.startsWith(name + '=')).map(v => v.slice(name.length + 1));
  return values.length === 1 && TOKEN.test(values[0]) ? values[0] : null;
}
export function isSameOriginJson(request) {
  return request.headers.get('Origin') === new URL(request.url).origin
    && request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() === 'application/json';
}

async function readBoundedText(message, maxBytes) {
  const tooBig = () => fail(413, '入力の文字数を減らしてください。');
  if (Number(message.headers.get('Content-Length')) > maxBytes) tooBig();
  if (!message.body) fail(400, '入力内容を確認してください。');
  const reader = message.body.getReader();
  const decoder = new TextDecoder('utf-8', {fatal:true});
  let length = 0;
  let text = '';
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maxBytes) {
        await reader.cancel().catch(() => {});
        tooBig();
      }
      text += decoder.decode(value, {stream:true});
    }
    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}
export async function readLimitedJson(message, maxBytes) {
  try {
    const data = JSON.parse(await readBoundedText(message, maxBytes));
    if (data && typeof data === 'object' && !Array.isArray(data)) return data;
  } catch (err) {
    if (err instanceof AuthError) throw err;
  }
  fail(400, '入力内容を確認してください。');
}

// Per-identifier fixed windows. D1 serializes the conditional increment in one statement.
export async function allowRate(db, scope, identifier, maximum, windowSeconds) {
  const now = unixNow();
  const end = now - now % windowSeconds + windowSeconds;
  const bucket = await tokenHash(JSON.stringify([scope, identifier]));
  const [counter] = await db.batch([
    db.prepare(`INSERT INTO auth_rate_windows (bucket, ends_at, hits) VALUES (?, ?, 1)
      ON CONFLICT (bucket, ends_at) DO UPDATE SET hits = hits + 1 WHERE hits < ?`)
      .bind(bucket, end, maximum),
    db.prepare(`DELETE FROM auth_rate_windows WHERE rowid IN
      (SELECT rowid FROM auth_rate_windows WHERE ends_at <= ? LIMIT 32)`).bind(now),
  ]);
  return counter.meta.changes === 1;
}
async function guardRate(request, env, scope, maximum, windowSeconds) {
  const ip = request.headers.get('CF-Connecting-IP') || 'local';
  if (!await allowRate(env.DB, scope, ip, maximum, windowSeconds))
    fail(429, '試行回数の上限です。少し時間をおいてお試しください。');
}

function normalizeNoteId(input) {
  if (typeof input !== 'string') fail(400, 'note IDを入力してください。');
  const id = input.trim().replace(/^@/, '').toLowerCase();
  if (!HANDLE.test(id)) fail(400, 'note IDを半角英数字とアンダースコアで入力してください。');
  return id;
}
async function publicAccount(noteId) {
  const url = new URL('https://note.com/api/v2/creators/' + noteId);
  url.searchParams.set('_', randomHex(8));
  let data;
  try {
    const response = await fetch(url, {
      headers: {Accept:'application/json', 'Cache-Control':'no-cache'},
      redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(6500),
    });
    if (response.status === 404) fail(404, 'このnote IDの公開プロフィールを確認できません。');
    if (!response.ok) throw new Error();
    data = (await readLimitedJson(response, 256 * 1024)).data;
  } catch (err) {
    if (err instanceof AuthError && err.status === 404) throw err;
    fail(503, 'noteの公開プロフィールを取得できません。少し待ってお試しください。');
  }
  // The numeric creator ID survives handle changes. Nicknames are only display names.
  if (!Number.isSafeInteger(data?.id) || data.id < 1 || typeof data.urlname !== 'string'
      || data.urlname.toLowerCase() !== noteId || (data.profile != null && typeof data.profile !== 'string'))
    fail(503, 'note IDと公開プロフィールを照合できません。');
  return {subject:String(data.id), profile:data.profile || ''};
}

function describeAccess(account, owner) {
  const membership = account.entitlement === 'membership';
  const expired = membership && account.expires_at <= unixNow();
  const active = owner || account.entitlement === 'purchase' || (membership && !expired);
  const state = active ? 'active' : expired ? 'expired' : account.entitlement;
  const kind = owner ? 'owner' : account.entitlement === 'purchase' || membership ? account.entitlement : null;
  return {noteId:account.note_id, owner, active, kind, state, expiresAt:membership ? iso(account.expires_at) : null};
}
async function accessByHash(db, hash) {
  const row = await db.prepare(`SELECT a.*, s.owner_proof FROM auth_sessions s
    JOIN auth_accounts a ON a.subject = s.subject WHERE s.token_hash = ? AND s.expires_at > ?`)
    .bind(hash, unixNow()).first();
  if (!row) return null;
  return {subject:row.subject, ...describeAccess(row, row.owner_proof === 1 && row.note_id === OWNER)};
}
export async function getAccessContext(request, env) {
  const cookie = readCookie(request, SESSION);
  return cookie ? accessByHash(env.DB, await tokenHash(cookie)) : null;
}
function publicViewer(access) {
  if (!access) return null;
  const {subject, ...viewer} = access;
  return viewer;
}
export async function getViewer(request, env) { return publicViewer(await getAccessContext(request, env)); }

async function start(request, env, body) {
  await guardRate(request, env, 'auth-start', 12, 900);
  const noteId = normalizeNoteId(body.noteId);
  if (!await validSecret(body.passcode, env.ENTRY_CODE)) fail(403, '入力した合言葉を確認してください。');
  const isOwner = noteId === OWNER;
  if (isOwner && !await validSecret(body.ownerKey, env.OWNER_KEY)) fail(403, '管理用の合言葉を確認してください。');
  const {subject} = await publicAccount(noteId);
  const browserKey = randomHex(32);
  const code = 'NV-' + randomHex(10).toUpperCase();
  const now = unixNow();
  const expires = now + CHALLENGE_LIFETIME;
  const previous = readCookie(request, CHALLENGE);
  const batch = [
    env.DB.prepare('INSERT INTO auth_challenges (token_hash, subject, note_id, proof_code, owner_proof, expires_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(await tokenHash(browserKey), subject, noteId, code, Number(isOwner), expires),
    env.DB.prepare('DELETE FROM auth_challenges WHERE rowid IN (SELECT rowid FROM auth_challenges WHERE expires_at <= ? LIMIT 32)').bind(now),
    env.DB.prepare('DELETE FROM auth_sessions WHERE rowid IN (SELECT rowid FROM auth_sessions WHERE expires_at <= ? LIMIT 32)').bind(now),
  ];
  if (previous) batch.push(env.DB.prepare('DELETE FROM auth_challenges WHERE token_hash = ?').bind(await tokenHash(previous)));
  await env.DB.batch(batch);
  return reply({noteId,code,expiresAt:iso(expires)}, 200, [setCookie(CHALLENGE, browserKey, CHALLENGE_LIFETIME)]);
}

async function confirm(request, env) {
  await guardRate(request, env, 'auth-confirm', 36, 900);
  const browserKey = readCookie(request, CHALLENGE);
  const challengeError = () => fail(409, '確認コードの期限または試行回数の上限です。認証を最初から行ってください。');
  if (!browserKey) challengeError();
  const hash = await tokenHash(browserKey);
  const proof = await env.DB.prepare(`UPDATE auth_challenges SET attempts = attempts + 1
    WHERE token_hash = ? AND used_by IS NULL AND expires_at > ? AND attempts < 10
    RETURNING subject, note_id, proof_code`).bind(hash, unixNow()).first();
  if (!proof) challengeError();
  const account = await publicAccount(proof.note_id);
  // Only the public profile field counts. The code contains only server-generated ASCII.
  const code = new RegExp('(^|[^A-Za-z0-9-])' + proof.proof_code + '($|[^A-Za-z0-9-])');
  if (account.subject !== proof.subject || !code.test(account.profile))
    fail(409, '公開プロフィール本文の確認コードを読み取れません。保存後にもう一度お試しください。');
  const session = randomHex(32);
  const sessionHash = await tokenHash(session);
  const now = unixNow();
  const db = env.DB;
  // One transaction claims the proof, opens a pending account if needed, then issues a session.
  // Binding used_by to this specific session makes concurrent confirmation idempotently lose.
  const [claim] = await db.batch([
    db.prepare(`UPDATE auth_challenges SET used_by = ?
      WHERE token_hash = ? AND used_by IS NULL AND expires_at > ?`).bind(sessionHash, hash, now),
    db.prepare(`INSERT INTO auth_accounts (subject, note_id, requested_at)
      SELECT subject, note_id, ? FROM auth_challenges WHERE token_hash = ? AND used_by = ?
      ON CONFLICT (subject) DO UPDATE SET note_id = excluded.note_id`).bind(now, hash, sessionHash),
    db.prepare(`INSERT INTO auth_sessions (token_hash, subject, owner_proof, expires_at)
      SELECT used_by, subject, owner_proof, ? FROM auth_challenges WHERE token_hash = ? AND used_by = ?`)
      .bind(now + SESSION_LIFETIME, hash, sessionHash),
  ]);
  if (claim.meta.changes !== 1) challengeError();
  const viewer = publicViewer(await accessByHash(db, sessionHash));
  return reply({viewer}, 200, [setCookie(SESSION, session, SESSION_LIFETIME), setCookie(CHALLENGE, '', 0)]);
}

async function logout(request, env) {
  const deletes = [];
  const session = readCookie(request, SESSION);
  const challenge = readCookie(request, CHALLENGE);
  if (session) deletes.push(env.DB.prepare('DELETE FROM auth_sessions WHERE token_hash = ?').bind(await tokenHash(session)));
  if (challenge) deletes.push(env.DB.prepare('DELETE FROM auth_challenges WHERE token_hash = ?').bind(await tokenHash(challenge)));
  if (deletes.length) await env.DB.batch(deletes);
  return reply({ok:true}, 200, [setCookie(SESSION, '', 0), setCookie(CHALLENGE, '', 0)]);
}

async function admin(request, env, body) {
  if (!(await getAccessContext(request, env))?.owner) fail(403, '管理者の本人確認が必要です。');
  const db = env.DB;
  if (request.method === 'GET') {
    const text = new URL(request.url).searchParams.get('cursor') || '0';
    const after = Number(text);
    if (!/^\d{1,16}$/.test(text) || !Number.isSafeInteger(after)) fail(400, '一覧の開始位置を確認してください。');
    const {results} = await db.prepare(`SELECT rowid AS cursor, * FROM auth_accounts
      WHERE rowid > ? AND note_id <> ? ORDER BY rowid LIMIT 101`).bind(after, OWNER).all();
    const entries = results.slice(0,100).map(row => {
      const {noteId, state, kind, expiresAt} = describeAccess(row, false);
      return {subject:row.subject, noteId, state, kind, expiresAt, requestedAt:iso(row.requested_at)};
    });
    return reply({entries,nextCursor:results.length > 100 ? String(results[99].cursor) : null});
  }
  const {subject, action} = body;
  if (typeof subject !== 'string' || !/^[1-9][0-9]{0,15}$/.test(subject)
      || !['purchase','membership','revoke'].includes(action)) fail(400, '対象者と手続きを確認してください。');
  const target = await db.prepare('SELECT subject, note_id FROM auth_accounts WHERE subject = ? AND note_id <> ?')
    .bind(subject, OWNER).first();
  if (!target) fail(404, '対象の申請を確認できません。');
  if (action === 'revoke') {
    await db.batch([
      db.prepare("UPDATE auth_accounts SET entitlement = 'revoked', expires_at = NULL WHERE subject = ?").bind(subject),
      db.prepare('DELETE FROM auth_sessions WHERE subject = ?').bind(subject),
      db.prepare('DELETE FROM auth_challenges WHERE subject = ?').bind(subject),
    ]);
    return reply({ok:true});
  }
  let expires = null;
  if (action === 'membership') {
    if (typeof body.expiresAt !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d{1,3})?)?(?:Z|[+-]\d\d:\d\d)$/.test(body.expiresAt))
      fail(400, 'メンバー利用の終了日時が必要です。');
    expires = Math.floor(Date.parse(body.expiresAt) / 1000);
    if (!Number.isSafeInteger(expires) || expires <= unixNow()) fail(400, '将来の終了日時を指定してください。');
  }
  // An old handle may now belong to another person. Check the stable identity again before granting.
  if ((await publicAccount(target.note_id)).subject !== subject) fail(409, 'note IDが変わりました。本人に再認証を依頼してください。');
  const grant = await db.prepare(`UPDATE auth_accounts SET entitlement = ?, expires_at = ?
    WHERE subject = ? AND note_id = ? AND (? <> 'membership' OR entitlement <> 'purchase')`)
    .bind(action, expires, subject, target.note_id, action).run();
  if (!grant.meta.changes) fail(409, '現在の利用権を確認し、一覧を更新してください。');
  return reply({ok:true});
}

export async function handleAuth(request, env, path = new URL(request.url).pathname) {
  if (!paths.has(path)) return null;
  try {
    if (!paths.get(path).includes(request.method)) fail(405, 'この操作は利用できません。');
    let body;
    if (request.method === 'POST') {
      if (!isSameOriginJson(request)) fail(403, 'ツールの画面を開いて操作してください。');
      body = await readLimitedJson(request, 4096);
    }
    switch (path) {
      case '/api/session': return reply({viewer:await getViewer(request, env)});
      case '/api/auth/start': return await start(request, env, body);
      case '/api/auth/confirm': return await confirm(request, env);
      case '/api/auth/logout': return await logout(request, env);
      case '/api/admin/access': return await admin(request, env, body);
    }
  } catch (err) {
    if (err instanceof AuthError) return reply({error:err.message}, err.status);
    return reply({error:'認証の準備が整っていません。時間をおいてお試しください。'}, 503);
  }
}
