import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const access = readFileSync('supabase/functions/insight-access/index.ts', 'utf8');
const publicDirectory = readFileSync('supabase/functions/insight-participants/index.ts', 'utf8');

function participantWriter(existing) {
  let row = existing ? { ...existing } : null;
  const calls = [];
  const db = {
    from(table) {
      assert.equal(table, 'insight_participants_public');
      return {
        select() {
          return {
            eq(field, value) {
              assert.equal(field, 'note_id');
              calls.push(['find', value]);
              return { maybeSingle: async () => ({ data: row ? { ...row } : null, error: null }) };
            },
          };
        },
        update(value) {
          return {
            async eq(field, key) {
              assert.equal(field, 'member_id');
              assert.equal(key, row?.member_id);
              row = { ...row, ...value };
              calls.push(['update', { ...value }]);
              return { error: null };
            },
          };
        },
        async insert(value) {
          assert.equal(row, null);
          row = { ...value };
          calls.push(['insert', { ...value }]);
          return { error: null };
        },
        delete() {
          throw new Error('WITHDRAWAL_MUST_NOT_DELETE_HISTORY');
        },
      };
    },
  };
  const start = access.indexOf('async function publicParticipantUpsert(');
  const end = access.indexOf('async function notificationProfileUpsert(', start);
  assert.ok(start >= 0 && end > start, 'test the real participant writer');
  const isolated = access.slice(start, end) + '\nthis.writeParticipant=publicParticipantUpsert;';
  const code = ts.transpileModule(isolated, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  const context = vm.createContext({ supabase: db, Date });
  vm.runInContext(code, context);
  return { write: context.writeParticipant, calls, get row() { return row; } };
}

const member = {
  id: 'verified-uuid-1',
  note_id: 'member_note',
  display_name: '保存当時の名前',
  image_url: 'https://example.test/avatar.png',
};

test('INSIGHT退会は本人の過去の公開ディレクトリIDを維持して非表示にする', async () => {
  const h = participantWriter({
    member_id: member.id, note_id: member.note_id, role: 'member',
    display_name: member.display_name, image_url: member.image_url,
    active: true, synced_at: '2026-11-01T00:00:00Z',
  });
  await h.write(member, false);
  assert.equal(h.row.active, false);
  assert.equal(h.row.member_id, member.id);
  assert.equal(h.row.note_id, member.note_id);
  assert.equal(h.row.display_name, member.display_name);
  assert.deepEqual(h.calls.map(x => x[0]), ['find', 'update']);
});

test('INSIGHT再参加は同じIDを再利用し、過去の記録と紐づけたまま公開状態だけ戻す', async () => {
  const h = participantWriter({
    member_id: member.id, note_id: member.note_id, role: 'member',
    display_name: '以前の名前', active: false,
  });
  await h.write(member, true);
  assert.equal(h.row.member_id, member.id);
  assert.equal(h.row.active, true);
  assert.equal(h.row.display_name, member.display_name);
  assert.deepEqual(h.calls.map(x => x[0]), ['find', 'update']);
});

test('退会時に公開一覧のレコードがなければ、非公開状態で識別情報を作る', async () => {
  const h = participantWriter(null);
  await h.write(member, false);
  assert.equal(h.row.member_id, member.id);
  assert.equal(h.row.active, false);
  assert.deepEqual(h.calls.map(x => x[0]), ['find', 'insert']);
});

test('管理者の退会処理は認証停止・収集停止・非公開化を行い、履歴の物理削除は行わない', () => {
  assert.match(access, /if\(action==="owner-reject"\|\|action==="owner-revoke"\|\|action==="owner-remove"\)/);
  assert.match(access, /insight_member_sessions"\)\.update\(\{revoked_at:now\}\)/);
  assert.match(access, /if\(action==="owner-remove"\)await supabase\.from\("insight_notification_ingest_tokens"\)\.update\(\{revoked_at:now\}\)/);
  assert.match(access, /await publicParticipantUpsert\(next,false\);await notificationProfileUpsert\(next,false\);return json\(req,\{ok:true,application:safeApp\(next\)\}\)/);
  assert.match(access, /await notificationProfileUpsert\(next,false\)/);
  assert.doesNotMatch(access, /from\("insight_participants_public"\)\.delete\(/);
  assert.doesNotMatch(access, /from\("insight_(?:notifications|public_comments|public_likes|relations|relation_events|dm_messages)"\)\.delete\(/);
});

test('公開一覧は退会者を非表示にしたまま履歴を残せる', () => {
  assert.match(access, /if\(action==="public-participants"\)[\s\S]*?\.eq\("active",true\)/);
  assert.match(publicDirectory, /async function readPublic\(\)[\s\S]*?\.eq\("active", true\)/);
});
