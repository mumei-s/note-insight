import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

const migration=readFileSync('supabase/retention/insight_comment_notification_backfill_candidates.sql','utf8');
async function fixture(t){
 const db=new PGlite();t.after(()=>db.close());
 await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
 await db.exec('create table public.insight_notification_profiles(member_id text primary key,note_urlname text not null);');
 await db.exec('create table public.insight_public_articles(member_id text not null,article_key text not null,title text not null,url text not null,publish_at timestamptz,comment_count integer not null default 0, primary key(member_id,article_key));');
 await db.exec('create table public.insight_notifications(member_id text not null,notification_type text not null,target_url text,occurred_at timestamptz not null default now());');
 await db.exec('create table public.insight_public_comments(member_id text not null,article_key text not null,comment_key text not null,primary key(member_id,article_key,comment_key));');
 await db.exec("insert into public.insight_notification_profiles values ('owner','ss_yr'),('other','other');");
 await db.exec("insert into public.insight_public_articles values ('owner','na663378740e1','過去の記事','https://note.com/ss_yr/n/na663378740e1',now()-interval '2 months',36),('owner','naaaaaaaa','別の記事','https://note.com/ss_yr/n/naaaaaaaa',now()-interval '1 month',3),('other','na663378740e1','他会員の記事','https://note.com/other/n/na663378740e1',now(),1);");
 await db.exec(migration);
 return db;
}
test('古い自分の記事に新しく来たコメント通知から、欠落コメントを優先取得候補へ出す',async t=>{
 const db=await fixture(t);
 await db.exec("insert into public.insight_notifications values ('owner','comment','https://note.com/ss_yr/n/na663378740e1?scrollpos=comment&c=nc2e6aa28ad86a',now());");
 const rows=(await db.query("select article_key,comment_count from public.insight_comment_notification_backfill_candidates('owner',3)")).rows;
 assert.deepEqual(rows,[{article_key:'na663378740e1',comment_count:36}]);
});
test('コメントを保存した後は、同じ通知では無駄に記事を巡回させない',async t=>{
 const db=await fixture(t);
 await db.exec("insert into public.insight_notifications values ('owner','comment','https://note.com/ss_yr/n/na663378740e1?scrollpos=comment&c=nc2e6aa28ad86a',now());");
 await db.exec("insert into public.insight_public_comments values ('owner','na663378740e1','nc2e6aa28ad86a');");
 assert.deepEqual((await db.query("select article_key from public.insight_comment_notification_backfill_candidates('owner',3)")).rows,[]);
});
test('他人の記事の返信や、別会員のコメント通知を自分の記事として取得しない',async t=>{
 const db=await fixture(t);
 await db.exec("insert into public.insight_notifications values ('owner','reply','https://note.com/someone/n/na663378740e1?c=nc3aaeee1',now()),('other','comment','https://note.com/other/n/na663378740e1?c=nc4bbddd1',now());");
 assert.deepEqual((await db.query("select article_key from public.insight_comment_notification_backfill_candidates('owner',3)")).rows,[]);
});
test('新しい通知を優先し、重複通知があっても同じ記事は1回だけ選ぶ',async t=>{
 const db=await fixture(t);
 await db.exec("insert into public.insight_notifications values ('owner','comment','https://note.com/ss_yr/n/naaaaaaaa?c=nc1eeee1',now()-interval '1 hour'),('owner','comment','https://note.com/ss_yr/n/na663378740e1?c=nc2eeee1',now()),('owner','comment','https://note.com/ss_yr/n/na663378740e1?c=nc3eeee1',now()-interval '1 minute');");
 assert.deepEqual((await db.query("select article_key from public.insight_comment_notification_backfill_candidates('owner',3)")).rows.map(r=>r.article_key),['na663378740e1','naaaaaaaa']);
});
test('履歴比較RPCはservice_roleだけが使える',async t=>{
 const db=await fixture(t);
 const row=(await db.query("select has_function_privilege('anon','public.insight_comment_notification_backfill_candidates(text,integer)','EXECUTE') as anon,has_function_privilege('authenticated','public.insight_comment_notification_backfill_candidates(text,integer)','EXECUTE') as authenticated,has_function_privilege('service_role','public.insight_comment_notification_backfill_candidates(text,integer)','EXECUTE') as service")).rows[0];
 assert.deepEqual(row,{anon:false,authenticated:false,service:true});
});
