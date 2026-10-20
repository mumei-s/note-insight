// Local-only synthetic benchmark; never connects to Supabase.
import {PGlite} from '@electric-sql/pglite';
import {readFileSync,readdirSync} from 'node:fs';
import assert from 'node:assert/strict';
const db=new PGlite();
const old=readFileSync('tests/fixtures/ranking-rpc-before.sql','utf8');
const migration=readFileSync('supabase/migrations/'+readdirSync('supabase/migrations').find(x=>x.endsWith('_insight_ranking_read_performance.sql')),'utf8');
const report={environment:{node:process.version,engine:'PGlite 0.5.8; synthetic, single-client, warm local benchmark'},rows:140000,samples:[],limitations:['Not production timings or quota savings.','No concurrent users or ingest.','No hosted Postgres planner/resource parity asserted.']};
try{
 await db.exec(`create table insight_public_likes(member_id text,article_key text,liker_key text,actor_name text,actor_url text,actor_image_url text,liked_at timestamptz,first_seen_at timestamptz,primary key(member_id,article_key,liker_key));
 create table insight_public_articles(member_id text,article_key text,like_count integer,last_seen_at timestamptz,primary key(member_id,article_key));
 create index insight_public_likes_member_liked_idx on insight_public_likes(member_id,liked_at desc);
 create index insight_public_likes_member_seen_idx on insight_public_likes(member_id,first_seen_at desc);
 insert into insight_public_articles select 'owner','article-'||i,400,'2026-10-20' from generate_series(0,999) i;
 insert into insight_public_likes select 'owner','article-'||(i%56),'liker-'||(i/56), 'Person '||(i/56), 'https://note.com/person_'||(i/56),'https://example.invalid/img/'||(i/56),'2026-10-01'::timestamptz + i*interval '1 second','2026-10-01'::timestamptz + i*interval '1 second' from generate_series(0,139999) i;
 analyze insight_public_likes; analyze insight_public_articles;`);
 await db.exec(old);await db.exec(old.replaceAll('FUNCTION public.insight_fast_','FUNCTION public.before_insight_fast_'));
 const jobs=[['ranking_page1',"select * from insight_fast_ranking('owner',0,100,'')"],['ranking_page10',"select * from insight_fast_ranking('owner',900,100,'')"],['search',"select * from insight_fast_ranking('owner',0,100,'Person 12')"],['count',"select insight_fast_ranking_count('owner','') as value"],['summary',"select insight_fast_summary('owner') as value"]];
 const beforeResults=new Map();
 async function run(phase){for(const [name,sql] of jobs){await db.query(sql);const times=[];for(let i=0;i<3;i++){const t=performance.now();const result=(await db.query(sql)).rows;times.push(+(performance.now()-t).toFixed(3));if(phase==='before')beforeResults.set(name,result);else assert.deepEqual(result,beforeResults.get(name),name)}report.samples.push({phase,name,ms:times,medianMs:[...times].sort((a,b)=>a-b)[1]})}}
 await run('before');await db.exec(migration);await db.exec('analyze insight_public_likes');await run('after');
 report.indexBytes=(await db.query("select pg_relation_size('insight_public_likes_member_liker_liked_idx') n")).rows[0].n;
 report.resultParity='Exact output parity on all benchmark queries';
 console.log(JSON.stringify(report,null,2));
}finally{await db.close()}
