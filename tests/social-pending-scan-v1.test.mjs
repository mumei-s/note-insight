import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {PGlite} from '@electric-sql/pglite';

function sql(){
 if(process.env.SOCIAL_PENDING_SCAN_SQL)return readFileSync(process.env.SOCIAL_PENDING_SCAN_SQL,'utf8');
 const name=readdirSync('supabase/migrations').filter(name=>name.endsWith('_social_pending_scan.sql')).sort().at(-1);
 assert.ok(name,'canonical pending-only social scan migration exists');
 return readFileSync('supabase/migrations/'+name,'utf8');
}

test('過去人物だけの照合は未確認キューを使い、全件照合・旧クライアントは従来の対象を維持する',async()=>{
 const source=readFileSync('supabase/functions/insight-social-compare/index.ts','utf8');
 const part=source.slice(source.indexOf('async function archivedCandidates('),source.indexOf('async function acceptedRows('));
 const calls=[];let failure=null;
 const context=vm.createContext({db:{rpc:async(name,args)=>{calls.push({name,args});return{data:{rows:[{person_key:'a'}],remaining:1,nextCursor:null},error:failure}}}});
 vm.runInContext(ts.transpileModule(part+'\nthis.read=archivedCandidates',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);
 assert.equal((await context.read('member-a','cursor',true)).rows[0].person_key,'a');
 await context.read('member-a','cursor',false);await context.read('member-a','cursor');
 assert.deepEqual(calls.map(call=>call.name),['insight_social_pending_history_candidates','insight_social_history_candidates','insight_social_history_candidates']);
 for(const call of calls)assert.deepEqual(JSON.parse(JSON.stringify(call.args)),{p_member:'member-a',p_after:'cursor',p_limit:20});
 failure=new Error('pending helper unavailable');await assert.rejects(context.read('member-a','cursor',true),/pending helper unavailable/);
 assert.equal(calls.at(-1).name,'insight_social_pending_history_candidates','a failed pending helper must not silently fetch all people');
 assert.match(source,/body\.pendingOnly===true/,'only an explicit boolean enables pending-only mode');
});

test('未確認人物の取得は名前あり未解決候補と不明関係だけに絞り、新しい確認を再読込しない',async()=>{
 const db=new PGlite();try{
  await db.exec(`
   create role anon;create role authenticated;create role service_role;
   -- These projections have separate real-view tests; here the actual SQL helper
   -- is exercised against duplicate/current/foreign rows in those contracts.
   create table public.insight_relation_history_current(member_id text,person_key text,actor_name text,actor_url text,detected_at timestamptz,event_type text,identity_exact boolean,candidate_resolved boolean);
   create table public.insight_social_current_people(member_id text,person_key text,actor_name text,actor_url text,relation text);
   create table public.insight_social_comparisons(member_id text,person_key text,is_following boolean,is_follower boolean,checked_at timestamptz,primary key(member_id,person_key));
   grant select on all tables in schema public to service_role;
   insert into public.insight_relation_history_current
    select 'owner','p'||lpad(n::text,3,'0'),'Pending '||n,'https://note.com/p'||lpad(n::text,3,'0'),now()-interval '2 days','removed',false,false from generate_series(1,53)n;
   insert into public.insight_relation_history_current values
    ('owner','p001','Older duplicate','https://note.com/p001',now()-interval '3 days','removed',false,false),
    ('owner','resolved','Now followed','https://note.com/resolved',now()-interval '2 days','removed',false,true),
    ('owner','confirmed','Confirmed old loss','https://note.com/confirmed',now()-interval '2 days','removed',true,false),
    ('owner','unknown:drop','Unidentified decrease',null,now()-interval '2 days','removed',false,false),
    ('owner','only-added','Newly followed','https://note.com/only_added',now()-interval '2 days','added',false,false),
    ('owner','bad-url','Bad URL','https://example.com/bad',now()-interval '2 days','removed',false,false),
    ('other','foreign','Foreign member','https://note.com/foreign',now()-interval '2 days','removed',false,false),
    ('owner','fresh-before-later','Needs newer confirmation','https://note.com/fresh_before_later',now()-interval '30 minutes','removed',false,false);
   insert into public.insight_social_current_people values
    ('owner','unknown-relation','Opposite direction not verified','https://note.com/unknown_relation','unknown'),
    ('owner','p002','Duplicate through unknown relation','https://note.com/p002','unknown'),
    ('other','foreign-unknown','Foreign unknown','https://note.com/foreign_unknown','unknown');
   -- All 1,000 active known people are stale but irrelevant to this pending queue.
   insert into public.insight_social_current_people select 'owner','known-'||n,'Known '||n,'https://note.com/known_'||n,'mutual' from generate_series(1,1000)n;
   insert into public.insight_social_comparisons select 'owner','known-'||n,true,true,now()-interval '2 days' from generate_series(1,1000)n;
   insert into public.insight_social_comparisons values
    ('owner','p001',true,false,now()),
    ('owner','p002',true,null,now()),
    ('owner','p003',true,true,now()-interval '2 days'),
    ('owner','fresh-before-later',true,true,now()-interval '1 hour'),
    ('other','p004',true,true,now());
  `);
  await db.exec(sql());await db.exec(sql());
  const fetch=async(after='',limit=20)=>(await db.query('select public.insight_social_pending_history_candidates($1,$2,$3) as payload',['owner',after,limit])).rows[0].payload;
  const first=await fetch();assert.equal(first.remaining,54);assert.equal(first.rows.length,20);assert.equal(first.rows[0].person_key,'fresh-before-later');
  const second=await fetch(first.nextCursor),third=await fetch(second.nextCursor);
  assert.equal(second.rows.length,20);assert.equal(third.rows.length,14);assert.equal(third.nextCursor,null);
  const rows=[...first.rows,...second.rows,...third.rows],keys=rows.map(row=>row.person_key);
  assert.equal(new Set(keys).size,54,'same person is returned once across events, relationship projection and pages');
  for(const key of ['p001','resolved','confirmed','unknown:drop','only-added','bad-url','foreign','foreign-unknown'])assert.ok(!keys.includes(key),key+' is outside this pending queue');
  assert.ok(!keys.some(key=>key.startsWith('known-')),'known active people do not cause profile reads in history-only mode');
  for(const key of ['p002','p003','p004','fresh-before-later','unknown-relation'])assert.ok(keys.includes(key),key+' still needs a relationship check');
  assert.equal((await fetch('',1)).rows.length,1);assert.equal((await fetch('',200)).rows.length,54);
  assert.deepEqual((await fetch('zzzz')).rows,[]);
  const permissions=(await db.query("select has_function_privilege('anon','public.insight_social_pending_history_candidates(text,text,integer)','EXECUTE') as anon,has_function_privilege('authenticated','public.insight_social_pending_history_candidates(text,text,integer)','EXECUTE') as authenticated,has_function_privilege('service_role','public.insight_social_pending_history_candidates(text,text,integer)','EXECUTE') as service")).rows[0];
  assert.deepEqual(permissions,{anon:false,authenticated:false,service:true});
  await db.exec('set role service_role');assert.equal((await fetch()).remaining,54);await db.exec('reset role');
  await db.exec("insert into public.insight_social_current_people select 'owner','zpending-'||n,'Still unknown '||n,'https://note.com/zpending_'||n,'unknown' from generate_series(1,110)n");
  const bounded=await fetch('',200);assert.equal(bounded.remaining,164);assert.equal(bounded.rows.length,100,'service callers cannot request more than100 profile identities');assert.ok(bounded.nextCursor);
  const rest=await fetch(bounded.nextCursor,200);assert.equal(rest.rows.length,64);assert.equal(rest.nextCursor,null);
 }finally{await db.close()}
});
