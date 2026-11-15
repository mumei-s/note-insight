import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const migration = readFileSync('supabase/retention/insight_observed_history.sql', 'utf8');

async function fixture(t) {
  const db = new PGlite();
  t.after(async () => db.close());
  await db.exec('create role anon; create role authenticated; create role service_role;');
  await db.exec("create table public.insight_public_comments(member_id text,article_key text,comment_key text,body text,actor_name text,actor_url text,actor_image_url text,actor_key text,primary key(member_id,article_key,comment_key));");
  await db.exec("create table public.insight_public_likes(member_id text,article_key text,liker_key text,actor_name text,actor_url text,actor_image_url text,primary key(member_id,article_key,liker_key));");
  await db.exec("create table public.insight_public_followers(member_id text,person_key text,actor_name text,actor_url text,primary key(member_id,person_key));");
  await db.exec("create table public.insight_relations(member_id text,direction text,person_key text,actor_name text,actor_url text,actor_image_url text,active boolean,primary key(member_id,direction,person_key));");
  await db.exec(migration);
  return db;
}
async function scalar(db, sql, params) { return (await db.query(sql, params)).rows[0]; }

test('取得済みコメントは削除表示・空応答・退会済み名で上書きされない', async t => {
  const db=await fixture(t);
  await db.query("insert into public.insight_public_comments values ($1,$2,$3,$4,$5,$6,$7,$8)",['person','n001','nc001','初回本文','元の名前','https://note.com/old','https://example.test/old.png','old']);
  await db.exec("update public.insight_public_comments set body='このコメントは削除されました。',actor_name='退会済み',actor_url=null,actor_image_url=null,actor_key=null where comment_key='nc001';");
  let row=await scalar(db,"select body,actor_name,actor_url,actor_image_url,actor_key from public.insight_public_comments where comment_key='nc001'");
  assert.equal(row.body,'初回本文');
  assert.equal(row.actor_name,'元の名前');
  assert.equal(row.actor_url,'https://note.com/old');
  assert.equal(row.actor_image_url,'https://example.test/old.png');
  assert.equal(row.actor_key,'old');
  await db.exec("update public.insight_public_comments set body=null,actor_name=null where comment_key='nc001';");
  row=await scalar(db,"select body,actor_name from public.insight_public_comments where comment_key='nc001'");
  assert.equal(row.body,'初回本文'); assert.equal(row.actor_name,'元の名前');
  assert.equal((await scalar(db,'select count(*)::int n from private.insight_comment_body_versions')).n,0);
});

test('本物の本文編集は表示を更新し、以前の本文・人物名を別の履歴として残す', async t => {
  const db=await fixture(t);
  await db.exec("insert into public.insight_public_comments values ('m','n2','nc2','初稿','初稿の名前','https://note.com/a',null,'a');");
  await db.exec("update public.insight_public_comments set body='編集後',actor_name='現在の名前' where comment_key='nc2';");
  const now=await scalar(db,"select body,actor_name from public.insight_public_comments where comment_key='nc2'");
  assert.deepEqual(now,{body:'編集後',actor_name:'現在の名前'});
  const old=await scalar(db,"select prior_body,prior_actor_name,prior_actor_url from private.insight_comment_body_versions where comment_key='nc2'");
  assert.deepEqual(old,{prior_body:'初稿',prior_actor_name:'初稿の名前',prior_actor_url:'https://note.com/a'});
  await db.exec("update public.insight_public_comments set body='編集後' where comment_key='nc2';");
  assert.equal((await scalar(db,'select count(*)::int n from private.insight_comment_body_versions')).n,1);
});

test('スキ・フォロワー・相互関係の退会者情報は欠損で消えないが、正常な変更は更新できる', async t => {
  const db=await fixture(t);
  await db.exec("insert into public.insight_public_likes values ('m','n3','liker','過去の名前','https://note.com/old','https://example.test/a.png');");
  await db.exec("insert into public.insight_public_followers values ('m','follower','過去の名前','https://note.com/old');");
  await db.exec("insert into public.insight_relations values ('m','followers','follower','過去の名前','https://note.com/old','https://example.test/a.png',true);");
  await db.exec("update public.insight_public_likes set actor_name='noteユーザー',actor_url=null,actor_image_url=null;");
  await db.exec("update public.insight_public_followers set actor_name='退会済み',actor_url=null;");
  await db.exec("update public.insight_relations set actor_name=null,actor_url=null,actor_image_url=null,active=false;");
  const like=await scalar(db,'select actor_name,actor_url,actor_image_url from public.insight_public_likes');
  assert.equal(like.actor_name,'過去の名前');assert.equal(like.actor_url,'https://note.com/old');assert.equal(like.actor_image_url,'https://example.test/a.png');
  const follower=await scalar(db,'select actor_name,actor_url from public.insight_public_followers');
  assert.equal(follower.actor_name,'過去の名前');assert.equal(follower.actor_url,'https://note.com/old');
  const relation=await scalar(db,'select actor_name,actor_url,actor_image_url,active from public.insight_relations');
  assert.equal(relation.actor_name,'過去の名前');assert.equal(relation.actor_url,'https://note.com/old');assert.equal(relation.active,false);
  await db.exec("update public.insight_public_likes set actor_name='新しい有効な名前' where liker_key='liker';");
  assert.equal((await scalar(db,'select actor_name from public.insight_public_likes')).actor_name,'新しい有効な名前');
});

test('旧本文履歴は非公開スキーマ・RLSの下で保持し、一般ロールに直接公開しない', async t => {
  const db=await fixture(t);
  const row=await scalar(db,"select c.relrowsecurity,has_table_privilege('anon','private.insight_comment_body_versions','SELECT') as anon,has_table_privilege('authenticated','private.insight_comment_body_versions','SELECT') as authenticated from pg_class c where c.oid='private.insight_comment_body_versions'::regclass");
  assert.deepEqual(row,{relrowsecurity:true,anon:false,authenticated:false});
  const triggers=(await db.query("select tgname from pg_trigger where tgname like 'insight_preserve_%_v1' and not tgisinternal")).rows.map(x=>x.tgname);
  assert.equal(triggers.length,4);
});
