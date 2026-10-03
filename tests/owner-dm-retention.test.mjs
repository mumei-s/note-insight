import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import vm from 'node:vm';
import ts from 'typescript';
import { webcrypto } from 'node:crypto';

const migrationFile = readdirSync('supabase/migrations').find(name => name.endsWith('_owner_dm_permanent_retention.sql'));
const migration = readFileSync('supabase/migrations/' + migrationFile, 'utf8');
async function fixture(t) {
  const db = new PGlite(); t.after(() => db.close());
  await db.exec("create table public.insight_notification_profiles(member_id text primary key); insert into public.insight_notification_profiles values ('owner'),('participant');");
  await db.exec(readFileSync('supabase/migrations/20260921035000_insight_dm_history.sql', 'utf8'));
  await db.exec(migration);
  return db;
}
async function seed(db, member = 'owner', key = 'saved') {
  await db.query('insert into public.insight_dm_threads(member_id,thread_key,peer_note_id,peer_name,last_message_at) values ($1,$2,$3,$4,$5)', [member, 'room-' + key, 'peer', '相手', '2026-09-20T01:00:00Z']);
  await db.query('insert into public.insight_dm_messages(member_id,thread_key,message_key,body,raw_text,direction,sender_name,attachment_url,sent_at,meta) values ($1,$2,$3,$4,$4,$5,$6,$7,$8,$9)', [member, 'room-' + key, key, '保存した本文\n2行目', 'inbound', '相手', 'https://example.test/saved.png', '2026-09-20T01:00:00Z', { source: 'captured' }]);
}
test('本人の本文・相手情報は削除後の空応答や置換本文で上書きされず、同期状態と重複整理は更新できる', async t => {
  const db = await fixture(t); await seed(db);
  await db.exec("update public.insight_dm_messages set body='削除されたメッセージ',raw_text=null,sender_name=null,attachment_url=null,sent_at=null,direction='unknown',meta='{\"superseded_by\":\"canonical-key\"}' where member_id='owner'; update public.insight_dm_threads set peer_note_id='',peer_name='退会済み',peer_url=null,last_message_at=null,meta='{\"reader_status\":{\"complete\":true}}' where member_id='owner';");
  const message = (await db.query("select * from public.insight_dm_messages where member_id='owner'")).rows[0];
  assert.equal(message.body, '保存した本文\n2行目'); assert.equal(message.raw_text, message.body); assert.equal(message.sender_name, '相手'); assert.equal(message.direction, 'inbound'); assert.equal(message.attachment_url, 'https://example.test/saved.png'); assert.ok(message.sent_at); assert.deepEqual(message.meta, { source: 'captured', superseded_by: 'canonical-key' });
  const thread = (await db.query("select * from public.insight_dm_threads where member_id='owner'")).rows[0];
  assert.equal(thread.peer_note_id, 'peer'); assert.equal(thread.peer_name, '相手'); assert.ok(thread.last_message_at); assert.equal(thread.meta.reader_status.complete, true);
  await db.exec("insert into public.insight_dm_messages(member_id,thread_key,message_key,body) values ('owner','room-saved','new','新着本文');");
  assert.equal((await db.query("select count(*)::int as n from public.insight_dm_messages where member_id='owner'")).rows[0].n, 2);
});
test('最初の未取得値は後から補完でき、会話・本人・メッセージIDを別のものへ移せない', async t => {
  const db = await fixture(t);
  await db.exec("insert into public.insight_dm_messages(member_id,thread_key,message_key) values ('owner','room-empty','empty'); update public.insight_dm_messages set body='後から取得した本文',direction='outbound',sender_name='あなた' where message_key='empty'; update public.insight_dm_messages set body=null,sender_name=null,direction='unknown' where message_key='empty';");
  const row = (await db.query("select body,sender_name,direction from public.insight_dm_messages where message_key='empty'")).rows[0];
  assert.deepEqual(row, { body: '後から取得した本文', sender_name: 'あなた', direction: 'outbound' });
  for (const update of ["member_id='participant'", "thread_key='different-room'", "message_key='different-message'"]) await assert.rejects(db.exec('update public.insight_dm_messages set ' + update + " where message_key='empty'"), /OWNER_DM_ARCHIVE_IDENTITY_IMMUTABLE/);
});
test('本人分の直接削除・プロフィール連鎖削除・TRUNCATEを止め、参加者の更新と削除は変更しない', async t => {
  const db = await fixture(t); await seed(db); await seed(db, 'participant', 'other');
  for (const sql of ["delete from public.insight_dm_messages where member_id='owner'", "delete from public.insight_dm_threads where member_id='owner'", "delete from public.insight_notification_profiles where member_id='owner'", 'truncate public.insight_dm_messages', 'truncate public.insight_notification_profiles cascade']) await assert.rejects(db.exec(sql), /OWNER_DM_RETENTION_PROTECTED/);
  await db.exec("update public.insight_dm_messages set body='参加者の更新本文' where member_id='participant';");
  assert.equal((await db.query("select body from public.insight_dm_messages where member_id='participant'")).rows[0].body, '参加者の更新本文');
  await db.exec("delete from public.insight_notification_profiles where member_id='participant';");
  assert.equal((await db.query("select count(*)::int as n from public.insight_dm_messages where member_id='owner'")).rows[0].n, 1);
  assert.equal((await db.query("select count(*)::int as n from public.insight_dm_messages where member_id='participant'")).rows[0].n, 0);
});
test('保護は権限を拡張せず、本人の履歴がないテーブルへの通常操作を妨げない', async t => {
  const db = await fixture(t); await seed(db, 'participant');
  await db.exec("create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema public to service_role; grant all on public.insight_dm_messages to service_role; grant usage on all sequences in schema public to service_role; set role service_role; update public.insight_dm_messages set body='参加者の更新' where member_id='participant'; reset role;");
  const permissions = (await db.query("select has_function_privilege('anon','public.protect_owner_dm_history_row()','EXECUTE') as anon,has_function_privilege('authenticated','public.protect_owner_dm_history_truncate()','EXECUTE') as authenticated,prosecdef from pg_proc where oid='public.protect_owner_dm_history_row()'::regprocedure")).rows[0];
  assert.deepEqual(permissions, { anon: false, authenticated: false, prosecdef: false });
  await db.exec('truncate public.insight_dm_messages;');
  assert.equal((await db.query('select count(*)::int as n from public.insight_dm_messages')).rows[0].n, 0);
  await seed(db, 'owner', 'role-check'); await db.exec("set role service_role; update public.insight_dm_messages set body=null where member_id='owner'; reset role;");
  assert.equal((await db.query("select body from public.insight_dm_messages where member_id='owner'")).rows[0].body, '保存した本文\n2行目');
});
test('再ログインはPC2台とスマホに別セッションを追加し、元のセッションを失効させない', async () => {
  const sessions = []; const db = { from(table) { assert.equal(table, 'insight_member_sessions'); return { insert: async row => { sessions.push(row); return { error: null }; } }; } };
  const context = vm.createContext({ createClient: () => db, crypto: webcrypto, TextEncoder, URL, console, Deno: { env: { get: () => '' }, serve: () => {} } });
  const source = readFileSync('supabase/functions/insight-recovery/index.ts', 'utf8').replace(/^import[^\n]+\n/, '');
  vm.runInContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
  const tokens = []; for (let device = 0; device < 3; device++) tokens.push(await context.issueSession('same-participant'));
  assert.equal(new Set(tokens).size, 3); assert.equal(new Set(sessions.map(row => row.token_hash)).size, 3); assert.ok(sessions.every(row => row.application_id === 'same-participant' && !row.revoked_at && Date.parse(row.expires_at) > Date.now()));
});
