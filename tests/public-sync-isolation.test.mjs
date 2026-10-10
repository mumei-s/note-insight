import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync('supabase/functions/insight-member-api/index.ts', 'utf8').replace(/^import .*\n/gm, '');
const artifact = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
const at = '2026-10-01T00:00:00.000Z';
const article = { key: 'n1', title: 'Article', url: 'https://note.com/tester/n/n1', published: at, likes: 1, comments: 1 };
const like = { key: 'reader', name: 'Reader', url: 'https://note.com/reader', image: null, at };
const comment = { key: 'c1', parent: null, name: 'Reader', url: 'https://note.com/reader', urlname: 'reader', image: null, body: 'Comment', at, liked: false, likeCount: 0 };

function fixture(options = {}) {
  const member = options.member || { id: 'member-a', noteId: 'tester', displayName: 'Tester' };
  const scope = member.noteId === 'ss_yr' ? 'owner' : member.id;
  const store = new Map([
    ['insight_notification_profiles', [{ member_id: scope, watch_cursor: 7, public_watch_initialized_at: options.baseline ? null : at }]],
    ['insight_public_articles', [{ member_id: scope, article_key: 'n1', like_count: 0, comment_count: 0 }]],
    ['insight_public_likes', []], ['insight_public_comments', []], ['insight_public_followers', []], ['insight_notifications', []],
  ]);
  if (options.seed) for (const [table, rows] of Object.entries(options.seed)) store.set(table, rows);
  const calls = { likes: [], comments: [], followers: [], writes: [], logs: [] };
  const keys = {
    insight_notification_profiles: ['member_id'], insight_public_articles: ['member_id', 'article_key'],
    insight_public_likes: ['member_id', 'article_key', 'liker_key'], insight_public_comments: ['member_id', 'article_key', 'comment_key'],
    insight_public_followers: ['member_id', 'person_key'], insight_notifications: ['member_id', 'fingerprint'],
  };
  function query(table) {
    const filters = []; let fields = '', settings = {}, single = false;
    const q = {
      select(value, config = {}) { fields = value; settings = config; return q; },
      eq(key, value) { filters.push(row => row[key] === value); return q; },
      in(key, values) { filters.push(row => values.includes(row[key])); return q; },
      maybeSingle() { single = true; return q; },
      async upsert(input) {
        for (const row of Array.isArray(input) ? input : [input]) {
          calls.writes.push({ table, row: { ...row } });
          const failure = options.writeError?.(table, row);
          if (failure) return { error: failure };
          // Enforce the actual parent relationship in the mock database: detail
          // inserts must follow a confirmed article write for this tenant.
          if (['insight_public_likes', 'insight_public_comments'].includes(table) && !store.get('insight_public_articles').some(parent => parent.member_id === row.member_id && parent.article_key === row.article_key)) return { error: { code: '23503' } };
          const rows = store.get(table) || [], index = rows.findIndex(existing => keys[table].every(key => existing[key] === row[key]));
          if (index < 0) rows.push({ ...row }); else rows[index] = { ...rows[index], ...row };
          store.set(table, rows);
        }
        return { error: null };
      },
      async insert(row) {
        const failure = options.writeError?.(table, row); if (failure) return { error: failure };
        const rows = store.get(table) || [];
        if (rows.some(existing => keys[table].every(key => existing[key] === row[key]))) return { error: { code: '23505' } };
        rows.push({ ...row }); store.set(table, rows); return { error: null };
      },
      then(resolve, reject) {
        const failure = options.readError?.(table, fields, settings);
        if (failure) return Promise.resolve({ data: null, error: failure, count: null }).then(resolve, reject);
        const rows = (store.get(table) || []).filter(row => filters.every(filter => filter(row)));
        return Promise.resolve({ data: settings.head ? null : single ? rows[0] || null : rows.map(row => ({ ...row })), count: settings.count ? rows.length : null, error: null }).then(resolve, reject);
      },
    };
    return q;
  }
  let handler;
  const context = vm.createContext({
    console: { error: (...args) => calls.logs.push(args) }, Request, Response,
    db: { from: query, rpc: async () => ({ data: [], error: null }) },
    member: async () => { if (options.authError) throw new Error(options.authError); return member; },
    headers: () => ({}), reply: (_req, value, status = 200) => Response.json(value, { status }),
    creator: async () => { if (options.catalogError) throw new Error(options.catalogError); return { notes: 1 }; },
    articles: async (_id, page) => ({ rows: page === 1 ? options.articles || [article] : [], last: true }),
    likes: async key => { calls.likes.push(key); if (options.likeError) throw new Error(options.likeError); return options.likes || [like]; },
    comments: async key => { calls.comments.push(key); if (options.commentError) throw new Error(options.commentError); return options.comments || [comment]; },
    followers: async (_id, page) => { calls.followers.push(page); if (options.followerError) throw new Error(options.followerError); return { rows: [{ key: 'f1', name: 'Follower', url: 'https://note.com/follower' }], last: true }; },
    Deno: { serve: value => { handler = value; } },
  });
  vm.runInContext(artifact, context);
  return {
    calls, store, scope,
    async run() { const response = await handler(new Request('https://example.test', { method: 'POST', body: JSON.stringify({ action: 'sync' }) })); return { status: response.status, body: await response.json() }; },
  };
}

test('a rejected like request leaves comments and followers independently collectible', async () => {
  const f = fixture({ likeError: 'NOTE_PUBLIC_403' }), { status, body } = await f.run();
  assert.equal(status, 200); assert.equal(body.partial, true); assert.equal(body.complete, false);
  assert.deepEqual(body.failedSources, ['likes']); assert.equal(body.partialErrors[0].code, 'NOTE_PUBLIC_403');
  assert.deepEqual(f.calls.comments, ['n1']); assert.deepEqual(f.calls.followers, [1]);
  assert.equal(body.savedCounts.comments, 1); assert.equal(body.savedCounts.followers, 1); assert.equal(body.savedCounts.likes, 0);
  assert.equal(f.store.get('insight_notification_profiles')[0].watch_cursor, 7);
  assert.equal(f.store.get('insight_notification_profiles')[0].watch_error, 'PUBLIC_SYNC_PARTIAL:likes');
});

test('a failed like write is not acknowledged or notified and does not discard later valid rows', async () => {
  const f = fixture({ likes: [{ ...like, key: 'bad' }, like], writeError: (table, row) => table === 'insight_public_likes' && row.liker_key === 'bad' ? { code: '23503' } : null });
  const { body } = await f.run();
  assert.equal(body.partial, true); assert.equal(body.savedCounts.likes, 1); assert.equal(body.confirmedCounts.likes, 1);
  assert.deepEqual(f.store.get('insight_public_likes').map(row => row.liker_key), ['reader']);
  assert.equal(f.store.get('insight_notifications').some(row => row.fingerprint === 'like|n1|bad'), false);
  assert.equal(body.savedCounts.comments, 1);
});

test('new article detail is saved after its tenant parent even when catalog count is unchanged', async () => {
  const f = fixture({ articles: [{ ...article, key: 'n2' }] }), { body } = await f.run();
  assert.equal(body.complete, true); assert.equal(body.savedCounts.likes, 1); assert.equal(body.savedCounts.comments, 1);
  assert.equal(f.calls.writes[0].table, 'insight_public_articles'); assert.equal(f.calls.writes[0].row.article_key, 'n2');
  assert.equal(f.store.get('insight_public_comments')[0].article_key, 'n2');
});

test('known comments replace edited body and heart without duplicating notifications or unchanged writes', async () => {
  const stored = { member_id: 'member-a', article_key: 'n1', comment_key: 'c1', parent_key: null, actor_key: 'reader', actor_name: 'Reader', actor_url: comment.url, actor_image_url: null, body: 'Before', occurred_at: at, is_root: true, is_creator: false, is_creator_liked: false, like_count: 0 };
  const f = fixture({ comments: [{ ...comment, body: 'After', liked: true }], seed: { insight_public_comments: [stored] } });
  const first = await f.run();
  assert.equal(first.body.savedCounts.comments, 1); assert.equal(first.body.confirmedCounts.comments, 1);
  assert.equal(f.store.get('insight_public_comments')[0].body, 'After'); assert.equal(f.store.get('insight_public_comments')[0].is_creator_liked, true);
  assert.equal(f.store.get('insight_notifications').some(row => row.notification_type === 'comment'), false);
  const second = await f.run(); assert.equal(second.body.savedCounts.comments, 0); assert.equal(second.body.confirmedCounts.comments, 1);
});

test('catalog and all detail fetch failures remain explicit partial results without moving initialization', async () => {
  const f = fixture({ baseline: true, catalogError: 'NOTE_PUBLIC_503', likeError: 'NOTE_PUBLIC_403', commentError: 'NOTE_PUBLIC_403', followerError: 'NOTE_PUBLIC_403' });
  const { status, body } = await f.run();
  assert.equal(status, 200); assert.equal(body.ok, true); assert.equal(body.complete, false); assert.equal(body.partial, true);
  assert.deepEqual(new Set(body.failedSources), new Set(['catalog', 'likes', 'comments', 'followers']));
  assert.equal(body.savedCounts.likes + body.savedCounts.comments + body.savedCounts.followers, 0);
  const watch = f.store.get('insight_notification_profiles')[0]; assert.equal(watch.watch_cursor, 7); assert.equal(watch.public_watch_initialized_at, null); assert.match(watch.watch_error, /^PUBLIC_SYNC_PARTIAL:/);
});

test('failed count/key reads do not become empty history or suppress other collections', async () => {
  const f = fixture({ readError: (table, _fields, settings) => table === 'insight_public_likes' && settings.head ? { code: '57014' } : null });
  const { body } = await f.run();
  assert.equal(body.complete, false); assert.equal(body.partialErrors[0].code, '57014');
  assert.equal(body.savedCounts.likes, 0); assert.equal(body.savedCounts.comments, 1); assert.equal(body.savedCounts.followers, 1);
  assert.deepEqual(f.calls.likes, []);
});

test('a failed watch-state read leaves its saved cursor and initialized baseline untouched', async () => {
  const f = fixture({ readError: table => table === 'insight_notification_profiles' ? { code: '57014' } : null });
  const { body } = await f.run();
  assert.equal(body.partial, true); assert.equal(body.complete, false); assert.equal(body.baseline, true);
  const watch = f.store.get('insight_notification_profiles')[0]; assert.equal(watch.watch_cursor, 7); assert.equal(watch.public_watch_initialized_at, at);
  assert.equal(f.calls.writes.some(write => write.table === 'insight_notification_profiles'), false);
  assert.equal(body.savedCounts.comments, 1);
});

test('owner alias data and notifications share the preserved owner scope, other tenants keep their UUID', async () => {
  for (const member of [{ id: 'owner-alias-uuid', noteId: 'ss_yr', displayName: 'Owner' }, { id: 'member-b', noteId: 'other', displayName: 'Other' }]) {
    const f = fixture({ member }), { body } = await f.run();
    assert.equal(body.complete, true);
    for (const table of ['insight_public_articles', 'insight_public_likes', 'insight_public_comments', 'insight_public_followers', 'insight_notifications', 'insight_notification_profiles']) assert.ok(f.store.get(table).every(row => row.member_id === f.scope), table);
  }
});

test('notification or final watch save failures are visible and never acknowledge a complete run', async () => {
  for (const failedTable of ['insight_notifications', 'insight_notification_profiles']) {
    const f = fixture({ writeError: table => table === failedTable ? { code: '23503', message: 'private detail must not be logged' } : null }), { body } = await f.run();
    assert.equal(body.complete, false); assert.equal(body.partial, true); assert.equal(body.partialErrors[0].code, '23503');
    assert.equal(f.calls.logs.some(args => args.join(' ').includes('private detail')), false);
    if (failedTable === 'insight_notifications') assert.equal(body.newNotifications, 0);
  }
});

test('invalid authentication still stops before any public collection or database write', async () => {
  const f = fixture({ authError: 'INSIGHT_SESSION_INVALID' }), { status, body } = await f.run();
  assert.equal(status, 401); assert.equal(body.ok, false); assert.equal(f.calls.writes.length, 0); assert.equal(f.calls.likes.length, 0);
});
