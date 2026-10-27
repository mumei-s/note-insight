import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

function migration(){
 const override=process.env.SOCIAL_FALLBACK_REPAIR_SQL;
 if(override)return readFileSync(override,'utf8');
 const name=readdirSync('supabase/migrations').filter(x=>x.endsWith('_social_fallback_read_repair.sql')).sort().at(-1);
 assert.ok(name,'canonical social fallback repair migration exists');
 return readFileSync('supabase/migrations/'+name,'utf8');
}

test('authenticated SQL fallbacks preserve recovered evidence, historical windows and exact change counts',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`
   create role anon; create role authenticated; create role service_role;
   create schema extensions;
   create function extensions.digest(text,text) returns bytea language sql immutable as $$select convert_to('fixture:'||$1,'UTF8')$$;
   create table public.insight_access_applications(id uuid primary key,note_id text,status text,display_name text,image_url text);
   create table public.insight_member_sessions(application_id uuid,token_hash text,revoked_at timestamptz,expires_at timestamptz);
   create table public.insight_relation_sync_runs(id bigint,member_id text,direction text,created_at timestamptz,complete boolean);
   create table public.insight_relations(member_id text,direction text,person_key text,actor_name text,actor_url text,actor_image_url text,active boolean,source_rank int,first_seen_at timestamptz,last_seen_at timestamptz,last_changed_at timestamptz);
   create table public.insight_relation_events(id bigint,member_id text,run_id bigint,direction text,event_type text,person_key text,actor_name text,actor_url text,actor_image_url text,detected_at timestamptz,change_count int);
   -- Recovery itself has separate real-view tests; this fixture isolates its
   -- consumer RPC and deliberately includes rows absent from the raw events.
   create table public.insight_relation_history_rows(id text,member_id text,run_id bigint,direction text,event_type text,person_key text,actor_name text,actor_url text,actor_image_url text,detected_at timestamptz,change_count int,evidence text,identity_exact boolean,source text,evidence_window_start timestamptz);
   insert into public.insight_access_applications values
    ('00000000-0000-4000-8000-000000000001','ss_yr','active','Owner',null),
    ('00000000-0000-4000-8000-000000000002','member_b','active','Other',null),
    ('00000000-0000-4000-8000-000000000003','inactive','pending','Inactive',null);
   insert into public.insight_member_sessions select id,encode(extensions.digest(note_id,'sha256'),'hex'),null,now()+interval '1 day' from public.insight_access_applications;
   insert into public.insight_member_sessions values
    ('00000000-0000-4000-8000-000000000001',encode(extensions.digest('expired','sha256'),'hex'),null,now()-interval '1 day'),
    ('00000000-0000-4000-8000-000000000001',encode(extensions.digest('revoked','sha256'),'hex'),now(),now()+interval '1 day');
   insert into public.insight_relation_sync_runs values(1,'owner','followers','2026-01-20',false);
   insert into public.insight_relations values
    ('owner','followers','archive','Archive person','https://note.com/archive',null,false,999,'2026-01-01','2026-01-05','2026-01-10'),
    ('owner','followers','latest','Latest person','https://note.com/latest',null,true,1,'2026-01-02','2026-01-20','2026-01-20');
   insert into public.insight_relations
    select 'owner','followers','p'||lpad(n::text,4,'0'),'Person '||n,'https://note.com/p'||n,null,true,n+1,'2026-01-03','2026-01-20','2026-01-20'
    from generate_series(1,1000) n;
   insert into public.insight_relation_history_rows values
    ('archive:followers:archive','owner',null,'followers','removed','archive','Archive person','https://note.com/archive',null,'2026-01-10',0,'window_candidate',false,'saved_archive','2026-01-05'),
    ('verified:lost','owner',null,'followers','removed','proven','Proven former follower','https://note.com/proven',null,'2026-01-11',1,'authenticated_relationship',true,'authenticated_history',null),
    ('event:unknown','owner',1,'followers','removed','unknown:drop','Unknown',null,null,'2026-01-12',48,'count_only',false,'relation_event',null),
    ('event:added','owner',1,'followers','added','latest','Latest person','https://note.com/latest',null,'2026-01-13',1,'window_candidate',false,'relation_event',null),
    ('event:other','00000000-0000-4000-8000-000000000002',2,'followers','removed','other','Other member history',null,null,'2026-01-12',1,'complete_snapshot',true,'relation_event',null);
   insert into public.insight_relation_events values
    (1,'owner',null,'followers','removed','archive','Archive person','https://note.com/archive',null,'2026-01-10',0),
    (2,'owner',1,'followers','removed','named','Named person','https://note.com/named',null,'2026-01-11',1),
    (3,'owner',1,'followers','removed','unknown:drop','Unknown',null,null,'2026-01-12',48),
    (4,'00000000-0000-4000-8000-000000000002',2,'followers','removed','other','Other member history',null,null,'2026-01-12',1);
  `);
  const sql=migration();
  // Bootstrap the exact replacement definitions in the empty fixture. The full
  // migration guard is exercised on every subsequent real replacement/replay.
  await db.exec(sql.slice(sql.indexOf('CREATE OR REPLACE FUNCTION')));
  await db.exec(`revoke all on function public.insight_member_read_fallback(text,text,text,jsonb) from public; grant execute on function public.insight_member_read_fallback(text,text,text,jsonb) to authenticated; revoke all on function public.insight_social_events_fallback(text,text,jsonb) from public; grant execute on function public.insight_social_events_fallback(text,text,jsonb) to authenticated;`);
  const metadata=async()=> (await db.query("select oid::regprocedure::text as name,proowner,prosecdef,proconfig,proacl from pg_proc where pronamespace='public'::regnamespace and proname in ('insight_member_read_fallback','insight_social_events_fallback') order by proname")).rows;
  const before=await metadata();await db.exec(sql);assert.deepEqual(await metadata(),before,'CREATE OR REPLACE retains existing owner, security, config and ACL');
  const social=async(action,extra={},token='ss_yr')=>(await db.query('select public.insight_social_events_fallback($1,$2,$3::jsonb) as result',[token,action,JSON.stringify(extra)])).rows[0].result;
  const member=async(action,extra={},token='ss_yr')=>(await db.query('select public.insight_member_read_fallback($1,$2,$3,$4::jsonb) as result',[token,'insight-social-events',action,JSON.stringify(extra)])).rows[0].result;
  const events=await social('events');assert.equal(events.window,'all');assert.equal(events.total,4);
  assert.equal(events.rows.find(r=>r.person_key==='proven').identity_exact,true);
  assert.equal(events.rows.find(r=>r.person_key==='proven').evidence,'authenticated_relationship');
  assert.equal(events.rows.find(r=>r.person_key==='archive').change_count,0);
  assert.equal(events.rows.find(r=>r.person_key==='unknown:drop').change_count,48);
  const decreases=await social('investigation',{change:'added'});assert.equal(decreases.total,3);assert.ok(decreases.rows.every(r=>r.event_type==='removed'));
  const oldest=await social('people',{window:'oldest'});assert.equal(oldest.total,1000);assert.equal(oldest.windowTotal,1000);assert.equal(oldest.rows[0].person_key,'archive');assert.equal(oldest.basis,'first_saved_people');
  const latest=await social('people',{window:'latest'});assert.equal(latest.total,1000);assert.equal(latest.rows[0].person_key,'latest');assert.ok(!latest.rows.some(r=>r.person_key==='archive'));
  assert.equal((await social('people',{window:'all'})).total,1002);
  assert.equal((await social('people',{window:'oldest',query:'p1000'})).total,0,'search does not refill historical window from later people');
  const oldEvents=await social('events',{window:'oldest',change:'removed'});assert.equal(oldEvents.total,1);assert.equal(oldEvents.rows[0].person_key,'archive');
  const currentEvents=await social('events',{window:'latest'});assert.equal(currentEvents.total,1);assert.equal(currentEvents.rows[0].person_key,'latest');
  const byDate=await social('events',{dateFrom:'2026-01-11',dateTo:'2026-01-12',query:'proven',change:'removed'});assert.equal(byDate.total,1);assert.equal(byDate.rows[0].person_key,'proven');
  for(const action of ['changes','social_changes']){const result=await member(action);assert.equal(result.total,2);assert.ok(result.rows.every(r=>r.person_key!=='archive'));}
  assert.equal((await member('changes',{dateFrom:'2026-01-12',dateTo:'2026-01-13'})).total,1);
  assert.equal((await social('events',{},'member_b')).total,1,'scope comes only from the authenticated application');
  for(const token of ['bad','expired','revoked']){
   await assert.rejects(social('events',{},token),/INSIGHT_SESSION_INVALID/);
   await assert.rejects(member('changes',{},token),/INSIGHT_SESSION_INVALID/);
  }
  await assert.rejects(social('events',{},'inactive'),/INSIGHT_MEMBER_INACTIVE/);
  await assert.rejects(member('changes',{},'inactive'),/INSIGHT_MEMBER_INACTIVE/);
  await assert.rejects(member('changes',{},''),/INSIGHT_LOGIN_REQUIRED/);
  assert.ok(before.every(r=>r.prosecdef===true));
 }finally{await db.close()}
});
