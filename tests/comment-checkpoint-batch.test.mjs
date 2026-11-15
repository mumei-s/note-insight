import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

const migration=fs.readFileSync('supabase/retention/insight_comment_mark_articles_checked.sql','utf8');
async function fixture(t) {
 const db=new PGlite();t.after(()=>db.close());
 await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
 await db.exec("create table public.insight_public_articles(member_id text not null,article_key text not null,title text not null,comment_count integer not null,last_seen_at timestamptz not null default now(),primary key(member_id,article_key));");
 await db.exec("insert into public.insight_public_articles values ('owner','naaa','記事A',1,'2026-01-01'),('owner','nbbb','記事B',2,'2026-01-01'),('other','naaa','他人の記事',9,'2026-01-01');");
 await db.exec(migration);
 return db;
}
test('確認済みの2記事を1 RPCで更新し、本人以外の記事やタイトルは変えない',async t=>{
 const db=await fixture(t),rows=[{article_key:'naaa',comment_count:3},{article_key:'nbbb',comment_count:4}];
 const response=await db.query('select public.insight_comment_mark_articles_checked($1,$2::jsonb) as n',['owner',JSON.stringify(rows)]);
 assert.equal(response.rows[0].n,2);
 const found=(await db.query('select member_id,article_key,title,comment_count,last_seen_at from public.insight_public_articles order by member_id,article_key')).rows;
 assert.deepEqual(found.map(r=>[r.member_id,r.article_key,r.comment_count]),[['other','naaa',9],['owner','naaa',3],['owner','nbbb',4]]);
 assert.equal(found[1].title,'記事A');
 assert.ok(Date.parse(found[1].last_seen_at)>Date.parse('2026-01-01T00:00:00Z'));
 assert.equal(new Date(found[0].last_seen_at).toISOString(),'2026-01-01T00:00:00.000Z');
});
test('空バッチは更新せず、異常値は拒否する',async t=>{
 const db=await fixture(t);
 assert.equal((await db.query("select public.insight_comment_mark_articles_checked('owner','[]'::jsonb) as n")).rows[0].n,0);
 for (const rows of [[{article_key:'bad',comment_count:3}],[{article_key:'naaa',comment_count:-1}],Array.from({length:301},()=>({article_key:'naaa',comment_count:1}))]) {
   await assert.rejects(db.query('select public.insight_comment_mark_articles_checked($1,$2::jsonb)',['owner',JSON.stringify(rows)]),/INVALID_COMMENT_CHECKPOINT/);
 }
});
test('バッチ更新RPCはservice_role専用で、一般ユーザーに実行権限を出さない',async t=>{
 const db=await fixture(t);
 const r=(await db.query("select has_function_privilege('anon','public.insight_comment_mark_articles_checked(text,jsonb)','EXECUTE') a, has_function_privilege('authenticated','public.insight_comment_mark_articles_checked(text,jsonb)','EXECUTE') m, has_function_privilege('service_role','public.insight_comment_mark_articles_checked(text,jsonb)','EXECUTE') s")).rows[0];
 assert.deepEqual(r,{a:false,m:false,s:true});
});
