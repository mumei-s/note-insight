import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const migration=fs.readFileSync('supabase/retention/insight_profile_history_guard.sql','utf8');
const tables=['insight_notifications','insight_public_articles','insight_public_comments','insight_public_likes','insight_public_followers','insight_relations','insight_relation_events','insight_relation_history_rows','insight_dm_threads','insight_dm_messages','insight_dashboard_snapshots'];
async function fixture(t) {
  const db=new PGlite();t.after(()=>db.close());
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls; create schema private;');
  await db.exec('create table public.insight_notification_profiles(member_id text primary key);');
  await db.exec('create table private.insight_comment_body_versions(member_id text, prior_body text);');
  for(const name of tables) await db.exec('create table public.'+name+' (member_id text not null references public.insight_notification_profiles(member_id) on delete cascade, event text);');
  await db.exec(migration);
  return db;
}
test('退会後の本人通知を保持した会員プロフィールはDELETE CASCADEでも消せない',async t=>{
 const db=await fixture(t);
 await db.exec("insert into public.insight_notification_profiles values ('withdrawn'); insert into public.insight_notifications values ('withdrawn','保存通知');");
 await assert.rejects(db.exec("delete from public.insight_notification_profiles where member_id='withdrawn'"),/INSIGHT_HISTORY_REQUIRES_VERIFIED_ERASURE/);
 const result=(await db.query("select count(*)::int n from public.insight_notifications where member_id='withdrawn'")).rows[0];
 assert.equal(result.n,1);
 assert.equal((await db.query("select count(*)::int n from public.insight_notification_profiles where member_id='withdrawn'")).rows[0].n,1);
});
test('コメント・DM・スキ・関係履歴など各種類に保持済み履歴がある場合は削除を拒否',async t=>{
 const db=await fixture(t);
 for(const name of tables){
   await db.exec("insert into public.insight_notification_profiles(member_id) values ('with_history');");
   await db.exec("insert into public."+name+" values ('with_history','保存済み');");
   await assert.rejects(db.exec("delete from public.insight_notification_profiles where member_id='with_history'"),/INSIGHT_HISTORY_REQUIRES_VERIFIED_ERASURE/,name);
   await db.exec('delete from public.'+name+" where member_id='with_history'; delete from public.insight_notification_profiles where member_id='with_history';");
 }
});
test('本人確認後に明示的な保存履歴削除が済んだプロフィールは削除可能',async t=>{
 const db=await fixture(t);
 await db.exec("insert into public.insight_notification_profiles values ('empty');");
 await db.exec("delete from public.insight_notification_profiles where member_id='empty';");
 assert.equal((await db.query('select count(*)::int n from public.insight_notification_profiles')).rows[0].n,0);
});
test('保存済み履歴のある状態でプロフィール全件TRUNCATEを拒否する',async t=>{
 const db=await fixture(t);
 await db.exec("insert into public.insight_notification_profiles values ('member');");
 await assert.rejects(db.exec('truncate public.insight_notification_profiles cascade'),/INSIGHT_HISTORY_TRUNCATE_PROTECTED/);
 assert.equal((await db.query('select count(*)::int n from public.insight_notification_profiles')).rows[0].n,1);
});
