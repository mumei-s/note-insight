import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const migration=readFileSync('supabase/migrations/'+readdirSync('supabase/migrations').find(x=>x.endsWith('_insight_ranking_count_search_branches.sql')),'utf8');
test('count search branches preserve exact scoped results, privileges, and fresh writes under custom and generic plans',async()=>{
 const db=new PGlite();try{
 await db.exec(`CREATE ROLE service_role; CREATE TABLE insight_public_likes(member_id text,article_key text,liker_key text,actor_name text,actor_url text,PRIMARY KEY(member_id,article_key,liker_key));
 INSERT INTO insight_public_likes SELECT 'owner','a-'||a,'p-'||p,CASE WHEN a%3=0 THEN NULL ELSE 'Person '||p||' 日本%_語' END,CASE WHEN a%4=0 THEN NULL ELSE 'https://note.com/person_'||p END FROM generate_series(1,150)p CROSS JOIN generate_series(1,9)a;
 INSERT INTO insight_public_likes VALUES ('other','a','p-1','Other',NULL),('owner','null-profile','null-profile',NULL,NULL);
 CREATE FUNCTION public.insight_fast_ranking_count(p_member text DEFAULT 'owner',p_query text DEFAULT '') RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $f$ SELECT count(DISTINCT l.liker_key) FROM insight_public_likes l WHERE l.member_id=p_member AND (coalesce(p_query,'')='' OR coalesce(l.actor_name,'') ILIKE '%'||p_query||'%' OR coalesce(l.actor_url,'') ILIKE '%'||p_query||'%') $f$;
 CREATE FUNCTION public.before_count(p_member text DEFAULT 'owner',p_query text DEFAULT '') RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $f$ SELECT count(DISTINCT l.liker_key) FROM insight_public_likes l WHERE l.member_id=p_member AND (coalesce(p_query,'')='' OR coalesce(l.actor_name,'') ILIKE '%'||p_query||'%' OR coalesce(l.actor_url,'') ILIKE '%'||p_query||'%') $f$;
 REVOKE ALL ON FUNCTION insight_fast_ranking_count(text,text) FROM PUBLIC; GRANT EXECUTE ON FUNCTION insight_fast_ranking_count(text,text) TO service_role;`);
 const metadata=()=>db.query("select oid,proacl::text,prosecdef,provolatile,proconfig,pg_get_function_identity_arguments(oid) args,pg_get_function_result(oid) result,pg_get_expr(proargdefaults,0) defaults from pg_proc where proname='insight_fast_ranking_count'");
 const before=(await metadata()).rows;await db.exec(migration);assert.deepEqual((await metadata()).rows,before);
 assert.doesNotMatch(migration,/\b(?:GRANT|REVOKE|statement_timeout|ALTER\s+ROLE)\b/i);
 for(const mode of ['force_custom_plan','force_generic_plan','auto']){
  await db.exec(`set plan_cache_mode='${mode}'`);
  for(let repeat=0;repeat<7;repeat++)for(const scope of ['owner','other','missing',null])for(const query of ['',null,'Person 1','person','%','_','日本','日本%_','person_2','NO-MATCH',' ']){
   const [r]=(await db.query('select insight_fast_ranking_count($1,$2) a,before_count($1,$2) b',[scope,query])).rows;assert.equal(r.a,r.b,JSON.stringify({mode,scope,query,repeat}));
  }
 }
 await db.exec("insert into insight_public_likes values('owner','fresh','fresh-peer','Fresh',NULL)");
 assert.equal((await db.query("select insight_fast_ranking_count('owner','Fresh') n")).rows[0].n,1);
 await db.exec("delete from insight_public_likes where liker_key='fresh-peer'");
 assert.equal((await db.query("select insight_fast_ranking_count('owner','Fresh') n")).rows[0].n,0);
 }finally{await db.close()}
});
