import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

let db;
const names=['insight_fast_summary','insight_fast_analysis_v2','insight_fast_like_page_scoped_status','insight_fast_like_count_scoped_status'];
const migration=()=>readFileSync('supabase/migrations/'+readdirSync('supabase/migrations').find(f=>f.endsWith('_insight_rpc_read_performance.sql')),'utf8');
let rights;
before(async()=>{
 db=new PGlite();
 await db.exec(`
  CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
  CREATE TABLE insight_public_articles(member_id text,article_key text,title text,url text,like_count integer,comment_count integer,last_seen_at timestamptz,PRIMARY KEY(member_id,article_key));
  CREATE TABLE insight_public_likes(member_id text,article_key text,liker_key text,actor_name text,actor_url text,actor_image_url text,liked_at timestamptz,PRIMARY KEY(member_id,article_key,liker_key));
  CREATE TABLE insight_public_comments(member_id text,article_key text,comment_key text,parent_key text,is_root boolean,is_creator boolean,is_creator_liked boolean,occurred_at timestamptz,PRIMARY KEY(member_id,article_key,comment_key));
  CREATE TABLE insight_manual_completions(member_id text,creator_urlname text,item_type text,item_key text,PRIMARY KEY(member_id,creator_urlname,item_type,item_key));
  CREATE TABLE insight_relation_sync_runs(member_id text,direction text,expected_count integer,added_count integer,removed_count integer,created_at timestamptz);
  CREATE INDEX parent_lookup ON insight_public_comments(member_id,parent_key,occurred_at DESC,comment_key) WHERE parent_key IS NOT NULL;
  INSERT INTO insight_public_articles SELECT 'owner','article-'||i,'title '||i,'https://example.invalid/'||i,1000+i,i,'2026-10-10'::timestamptz+i*interval '1 minute' FROM generate_series(1,12) i;
  INSERT INTO insight_public_articles SELECT 'participant','article-'||i,'other title '||i,NULL,100+i,i,NULL FROM generate_series(1,3) i;
  INSERT INTO insight_public_likes
   SELECT 'owner','article-'||i,'peer-'||j,
    CASE WHEN j%11=0 THEN NULL WHEN j%13=0 THEN 'wild%_actor' WHEN j%7=0 THEN 'ALPHA' ELSE 'actor '||j END,
    CASE WHEN j%5=0 THEN NULL ELSE 'https://example.invalid/peer/'||j END,NULL,
    CASE WHEN j%17=0 THEN NULL ELSE '2026-10-01'::timestamptz+(j%7)*interval '1 day' END
   FROM generate_series(1,12) i CROSS JOIN LATERAL generate_series(1,(13-i)*15) j;
  INSERT INTO insight_public_likes SELECT 'participant','article-'||i,'peer-'||j,'other actor '||j,NULL,NULL,'2026-10-03' FROM generate_series(1,3) i CROSS JOIN generate_series(1,45) j;
  INSERT INTO insight_public_likes VALUES('owner','missing-article','orphan',NULL,NULL,NULL,NULL),('owner','a:b','c','colon peer',NULL,NULL,'2026-10-02'),('owner','a','b:c','colon peer',NULL,NULL,'2026-10-02');
  INSERT INTO insight_manual_completions VALUES
   ('owner','ss_yr','like','article-1:peer-1'),('owner','ss_yr','like','a:b:c'),
   ('owner','other_creator','like','article-1:peer-2'),('owner','ss_yr','notification','article-1:peer-3'),
   ('participant','ss_yr','like','article-1:peer-1'),('participant','participant','like','article-1:peer-2'),
   ('owner','ss_yr','comment_thread','completed');
  INSERT INTO insight_public_comments VALUES
   ('owner','article-1','unreplied',NULL,true,false,false,'2026-10-01'),
   ('owner','article-1','root-heart',NULL,true,false,true,'2026-10-01'),
   ('owner','article-1','replied',NULL,true,false,false,'2026-10-01'),
   ('owner','article-1','reply-c','replied',false,true,false,'2026-10-03'),
   ('owner','article-1','followup',NULL,true,false,false,'2026-10-01'),
   ('owner','article-1','followup-c','followup',false,true,false,'2026-10-02'),
   ('owner','article-1','followup-x','followup',false,false,false,'2026-10-03'),
   ('owner','article-1','heart-followup',NULL,true,false,false,'2026-10-01'),
   ('owner','article-1','heart-c','heart-followup',false,true,false,'2026-10-02'),
   ('owner','article-1','heart-a','heart-followup',false,false,false,'2026-10-03'),
   ('owner','article-1','heart-z','heart-followup',false,false,true,'2026-10-03'),
   ('owner','article-1','completed',NULL,true,false,true,'2026-10-01'),
   ('owner','article-1','null-time',NULL,true,false,false,'2026-10-01'),
   ('owner','article-1','null-c','null-time',false,true,false,'2026-10-03'),
   ('owner','article-1','null-x','null-time',false,false,true,NULL),
   ('owner','article-1','creator-root',NULL,true,true,false,'2026-10-01'),
   ('participant','article-1','unreplied',NULL,true,false,false,'2026-10-01'),
   ('participant','article-1','other-reply','unreplied',false,true,false,'2026-10-02');
  INSERT INTO insight_relation_sync_runs VALUES
   ('owner','followers',20,2,1,'2026-10-01'),('owner','followers',23,4,1,'2026-10-02'),
   ('owner','followings',8,1,0,'2026-10-02'),('participant','followers',4,0,0,'2026-10-03');
 `);
 const old=readFileSync('tests/fixtures/insight-rpc-read-before.sql','utf8');
 await db.exec(old);
 await db.exec(old.replace(/CREATE OR REPLACE FUNCTION public\.(insight_fast_[a-z0-9_]+)/g,'CREATE OR REPLACE FUNCTION public.before_$1'));
 for(const name of names){
  const signature=(await db.query('select oid::regprocedure::text as signature from pg_proc where proname=$1',[name])).rows[0].signature;
  await db.exec(`REVOKE ALL ON FUNCTION ${signature} FROM PUBLIC; GRANT EXECUTE ON FUNCTION ${signature} TO service_role;`);
 }
 rights=(await db.query(`select proname,proacl::text as rights,prosecdef,provolatile,proconfig from pg_proc where proname=any($1) order by proname`,[names])).rows;
 await db.exec(migration());
});
after(async()=>{await db?.close()});

test('summary/analysis preserve results for populated, empty, null and other scopes',async()=>{
 for(const name of ['insight_fast_summary','insight_fast_analysis_v2'])for(const scope of ['owner','participant','empty',null]){
  const {rows}=await db.query(`select before_${name}($1) as before,${name}($1) as after`,[scope]);
  assert.deepEqual(rows[0].after,rows[0].before,`${name}/${scope}`);
 }
 const {rows}=await db.query("select insight_fast_analysis_v2('owner') as analysis");
 assert.equal(rows[0].analysis.unrepliedComments,2);
 assert.equal(rows[0].analysis.repliedComments,2,'a NULL date does not supersede a dated creator reply');
 assert.equal(rows[0].analysis.followupPendingComments,2);
 assert.equal(rows[0].analysis.heartClosedComments,2,'equal dates use descending comment_key');
 assert.equal(rows[0].analysis.completedCommentThreads,1);
 assert.equal(rows[0].analysis.completedLikes,3,'both concat-key collisions retain the existing completion contract');
 assert.equal(rows[0].analysis.followers.delta,3);
 assert.equal(rows[0].analysis.followings.delta,0,'a single relation snapshot has no prior delta');
});

test('likes page and count preserve NULL/unknown options, sorts, search, dates and pagination',async()=>{
 const sorts=['newest','oldest','name','name-desc',null,'unknown'],statuses=['all','pending','completed',null,'unknown'];
 const scopes=['owner','participant','empty',null],queries=['',null,'actor','title 2','%','_','wild%_','no match'],limits=[30,1,null,0,101],offsets=[0,1,30,null,-2];
 let i=0;
 for(const scope of scopes)for(const status of statuses)for(const sort of sorts){
  const query=queries[i%queries.length],offset=offsets[i%offsets.length],limit=limits[i%limits.length];
  const from=i%3===0?'2026-10-02T00:00:00Z':null,to=i%4===0?'2026-10-04T00:00:00Z':null;i++;
  const {rows}=await db.query(`select
   (select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from before_insight_fast_like_page_scoped_status($1,$2,$3,$4,$5,$6,$7,$8) x) as before_page,
   (select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from insight_fast_like_page_scoped_status($1,$2,$3,$4,$5,$6,$7,$8) x) as after_page,
   before_insight_fast_like_count_scoped_status($1,$4,$6,$7,$8) as before_count,
   insight_fast_like_count_scoped_status($1,$4,$6,$7,$8) as after_count`,[scope,offset,limit,query,sort,from,to,status]);
  assert.deepEqual(rows[0].after_page,rows[0].before_page,JSON.stringify({scope,status,sort,query,offset,limit,from,to}));
  assert.equal(rows[0].after_count,rows[0].before_count);
 }
});

test('orphan article fallbacks and ambiguous completion keys remain visible',async()=>{
 const {rows}=await db.query("select * from insight_fast_like_page_scoped_status('owner',0,100,'colon peer','newest',null,null,'completed')");
 assert.equal(rows.length,2);assert.ok(rows.every(r=>r.confirmed&&r.article_title==='記事'&&r.article_url===''));
 const orphan=await db.query("select * from insight_fast_like_page_scoped_status('owner',0,100,'','newest',null,null,'all') where liker_key='orphan'");
 assert.equal(orphan.rows.length,0,'NULL dates stay after the first 100 newest rows');
 const count=await db.query("select insight_fast_like_count_scoped_status('owner','','2026-10-02','2026-10-02','all') as n");
 assert.equal(Number(count.rows[0].n),0,'upper date boundary is exclusive');
});

test('replacing RPC bodies preserves signatures, security attributes and explicit grants',async()=>{
 const current=(await db.query(`select proname,proacl::text as rights,prosecdef,provolatile,proconfig from pg_proc where proname=any($1) order by proname`,[names])).rows;
 assert.deepEqual(current,rights);
 assert.doesNotMatch(migration(),/\b(?:GRANT|REVOKE|statement_timeout|SET\s+ROLE|ALTER\s+ROLE)\b/i);
});
