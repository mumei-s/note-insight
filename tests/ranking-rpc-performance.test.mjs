import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
let db,rights;
const names=['insight_fast_ranking','insight_fast_ranking_count','insight_fast_summary'];
const migration=readFileSync('supabase/migrations/'+readdirSync('supabase/migrations').find(x=>x.endsWith('_insight_ranking_read_performance.sql')),'utf8');
const old=readFileSync('tests/fixtures/ranking-rpc-before.sql','utf8');
before(async()=>{
 db=new PGlite();
 await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
 CREATE TABLE insight_public_likes(member_id text,article_key text,liker_key text,actor_name text,actor_url text,actor_image_url text,liked_at timestamptz,PRIMARY KEY(member_id,article_key,liker_key));
 CREATE TABLE insight_public_articles(member_id text,article_key text,like_count integer,last_seen_at timestamptz,PRIMARY KEY(member_id,article_key));
 INSERT INTO insight_public_likes SELECT 'owner','article-'||a,'peer-'||p,
  CASE WHEN a%7=0 THEN NULL WHEN a%5=0 THEN 'Wild%_actor' ELSE 'Person '||p||'-'||a END,
  CASE WHEN a%6=0 THEN NULL ELSE 'https://note.com/peer_'||p END,
  CASE WHEN a%4=0 THEN NULL ELSE 'https://example.invalid/'||p||'/'||a END,
  CASE WHEN p%13=0 OR a%9=0 THEN NULL ELSE '2026-10-01'::timestamptz+(p*100+a)*interval '1 second' END
 FROM generate_series(1,140) p CROSS JOIN LATERAL generate_series(1,1+p%19) a;
 INSERT INTO insight_public_likes SELECT 'participant','article-'||a,'peer-'||p,'Other Person '||p,NULL,NULL,'2026-09-01'::timestamptz+(p*100+a)*interval '1 second' FROM generate_series(1,20) p CROSS JOIN generate_series(1,3) a;
 INSERT INTO insight_public_likes VALUES ('owner','single','null-profile',NULL,NULL,NULL,NULL),('owner','single','zero-time','Epoch',NULL,NULL,'1970-01-01');
 INSERT INTO insight_public_articles VALUES ('owner','a',42,'2026-10-20'),('owner','b',NULL,NULL),('participant','a',9,'2026-10-01');`);
 await db.exec(old);
 await db.exec(old.replaceAll('FUNCTION public.insight_fast_','FUNCTION public.before_insight_fast_'));
 for(const name of names){const sig=(await db.query('select oid::regprocedure::text as s from pg_proc where proname=$1',[name])).rows[0].s; await db.exec(`REVOKE ALL ON FUNCTION ${sig} FROM PUBLIC; GRANT EXECUTE ON FUNCTION ${sig} TO service_role;`)}
 rights=(await db.query('select proname,proacl::text,prosecdef,provolatile,proconfig,pg_get_function_identity_arguments(oid) args,pg_get_function_result(oid) result from pg_proc where proname=any($1) order by proname',[names])).rows;
 await db.exec(migration);
});
after(async()=>db?.close());
const rows=async(name,args)=>(await db.query(`select * from ${name}($1,$2,$3,$4)`,args)).rows;
const canonical=a=>[...a].sort((x,y)=>x.liker_key.localeCompare(y.liker_key));
async function normalizeAmbiguousProfiles(result,scope,query){
 const out=[];
 for(const r of result){
  const candidates=(await db.query(`select actor_name,actor_url,actor_image_url from insight_public_likes where member_id=$1 and liker_key=$2 and liked_at is not distinct from $3 and (coalesce($4,'')='' or coalesce(actor_name,'') ilike '%'||$4||'%' or coalesce(actor_url,'') ilike '%'||$4||'%')`,[scope,r.liker_key,r.last_liked_at,query])).rows;
  if(candidates.length>1){
   for(const f of ['actor_name','actor_url','actor_image_url'])assert.ok(candidates.some(c=>(f==='actor_name'?(c[f]??'noteユーザー'):c[f])===r[f]),`tied latest ${f} must come from an eligible latest row`);
   out.push({...r,actor_name:'<unspecified tie>',actor_url:null,actor_image_url:null});
  }else out.push(r);
 }
 return out;
}
test('ranking preserves complete counts, latest profiles, null timestamps and scoped searches',async()=>{
 for(const scope of ['owner','participant','empty',null])for(const query of ['',null,'Person 1','Wild%_','%','_','peer_2','NO-MATCH']){
  const args=[scope,0,100,query], a=await rows('insight_fast_ranking',args),b=await rows('before_insight_fast_ranking',args);
  assert.deepEqual(canonical(await normalizeAmbiguousProfiles(a,scope,query)),canonical(await normalizeAmbiguousProfiles(b,scope,query)),JSON.stringify(args));
  for(let i=1;i<a.length;i++)assert.ok(a[i-1].like_count>=a[i].like_count);
 }
});
test('rank pagination and parameter clamping preserve untied results',async()=>{
 for(const offset of [0,1,30,100,999,-3,null])for(const limit of [1,30,100,101,0,-1,null]){
  // Exclude all-NULL timestamp peers: their complete tie ordering is unspecified in both contracts.
  const args=['owner',offset,limit,'Person'];
  assert.deepEqual(await normalizeAmbiguousProfiles(await rows('insight_fast_ranking',args),args[0],args[3]),await normalizeAmbiguousProfiles(await rows('before_insight_fast_ranking',args),args[0],args[3]),JSON.stringify(args));
 }
});
test('unchanged summary and count retain exact empty, null and member results after index',async()=>{
 for(const scope of ['owner','participant','empty',null]){
  const x=(await db.query('select insight_fast_summary($1) a,before_insight_fast_summary($1) b',[scope])).rows[0];assert.deepEqual(x.a,x.b);
  for(const query of ['',null,'Person','%','_','NO-MATCH']){const c=(await db.query('select insight_fast_ranking_count($1,$2) a,before_insight_fast_ranking_count($1,$2) b',[scope,query])).rows[0];assert.equal(c.a,c.b)}
 }
});
test('new index and bodies preserve identity, security, grants and fresh updates',async()=>{
 assert.deepEqual((await db.query('select proname,proacl::text,prosecdef,provolatile,proconfig,pg_get_function_identity_arguments(oid) args,pg_get_function_result(oid) result from pg_proc where proname=any($1) order by proname',[names])).rows,rights);
 assert.doesNotMatch(migration,/\b(?:GRANT|REVOKE|statement_timeout|SET\s+ROLE|ALTER\s+ROLE)\b/i);
 const idx=(await db.query("select indexdef from pg_indexes where indexname='insight_public_likes_member_liker_liked_idx'")).rows[0];assert.match(idx.indexdef,/member_id, liker_key, liked_at DESC NULLS LAST/);
 await db.exec("insert into insight_public_likes values('owner','new','new-peer','New',NULL,NULL,'2026-10-21');");
 assert.deepEqual(await rows('insight_fast_ranking',['owner',0,100,'New']),await rows('before_insight_fast_ranking',['owner',0,100,'New']));
 assert.equal((await db.query("select insight_fast_summary('owner')->>'supporterCount' n")).rows[0].n,'143');
});
