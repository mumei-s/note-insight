import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
function migration(env,suffix){if(process.env[env])return readFileSync(process.env[env],'utf8');const name=readdirSync('supabase/migrations').filter(name=>name.endsWith(suffix)).sort().at(-1);assert.ok(name,'canonical '+suffix+' migration exists');return readFileSync('supabase/migrations/'+name,'utf8')}
test('SQLの代替経路も確認済みの減少と未確認を分離し、現在の相互・再フォローと会員権限を保つ',async()=>{
 const db=new PGlite();try{
  await db.exec(`
   set timezone='UTC';
   create role anon;create role authenticated;create role service_role bypassrls;
   create schema extensions;
   create function extensions.digest(text,text) returns bytea language sql immutable as $$select convert_to('fixture:'||$1,'UTF8')$$;
   create table public.insight_access_applications(id uuid primary key,note_id text,status text);
   create table public.insight_member_sessions(application_id uuid,token_hash text,revoked_at timestamptz,expires_at timestamptz);
   create table public.insight_relations(member_id text,direction text,person_key text,actor_name text,actor_url text,actor_image_url text,active boolean,source_rank int,first_seen_at timestamptz,last_seen_at timestamptz,last_changed_at timestamptz,primary key(member_id,direction,person_key));
   create table public.insight_social_comparisons(member_id text,person_key text,actor_name text,actor_url text,actor_image_url text,is_following boolean,is_follower boolean,checked_at timestamptz,first_checked_at timestamptz,following_rank int,follower_rank int,lost_at timestamptz,gained_at timestamptz,primary key(member_id,person_key));
   create table public.insight_social_comparison_history(id bigint generated always as identity primary key,member_id text,person_key text,is_following boolean,is_follower boolean,observed_at timestamptz);
   create table public.insight_relation_sync_runs(id bigint generated always as identity primary key,member_id text,direction text,received_count int,expected_count int,complete boolean,created_at timestamptz);
   create table public.insight_relation_history_rows(id text,member_id text,run_id bigint,direction text,event_type text,person_key text,actor_name text,actor_url text,actor_image_url text,detected_at timestamptz,change_count int,evidence text,identity_exact boolean,source text,evidence_window_start timestamptz);
   create table public.insight_social_comparison_status(member_id text,checked_at timestamptz,complete boolean,following_total int,follower_total int,following_checked int,follower_checked int,error text);
   insert into public.insight_access_applications values
    ('00000000-0000-4000-8000-000000000001','ss_yr','active'),
    ('00000000-0000-4000-8000-000000000002','member_b','active'),
    ('00000000-0000-4000-8000-000000000003','inactive','pending');
   insert into public.insight_member_sessions select id,encode(extensions.digest(note_id,'sha256'),'hex'),null,now()+interval '1 day' from public.insight_access_applications;
   insert into public.insight_member_sessions values
    ('00000000-0000-4000-8000-000000000001',encode(extensions.digest('expired','sha256'),'hex'),null,now()-interval '1 day'),
    ('00000000-0000-4000-8000-000000000001',encode(extensions.digest('revoked','sha256'),'hex'),now(),now()+interval '1 day');
   insert into public.insight_relation_sync_runs(member_id,direction,received_count,expected_count,complete,created_at) values('owner','followers',1000,2306,false,'2026-01-25');
   insert into public.insight_social_comparison_status values('owner','2026-01-20',false,900,2306,20,20,null);
  `);
  const person=async(key,direction='followers',{member='owner',last='2026-01-20',active=true}={})=>db.query('insert into public.insight_relations values($1,$2,$3,$3,$4,null,$5,1,\'2026-01-01\',$6,$6)',[member,direction,key,'https://note.com/'+key,active,last]);
  const event=async(key,{id=key,member='owner',day='2026-01-10',exact=false,count=0,type='removed'}={})=>db.query('insert into public.insight_relation_history_rows values($1,$2,null,\'followers\',$3,$4,$4,$5,null,$6,$7,$8,$9,\'relation_event\',null)',[id,member,type,key,key.startsWith('unknown:')?null:'https://note.com/'+key,day,count,key.startsWith('unknown:')?'count_only':exact?'authenticated_relationship':'window_candidate',exact]);
  await person('refollow');await person('refollow','followings');await event('refollow',{exact:true,count:1});
  await db.exec(`insert into public.insight_social_comparisons values('owner','refollow','refollow','https://note.com/refollow',null,true,false,'2026-01-10','2026-01-01',1,1,'2026-01-10',null);`);
  await person('resolved');await event('resolved');
  await person('pending','followers',{last:'2026-01-05',active:false});await event('pending');
  await event('unknown:drop',{day:'2026-01-12',count:48});
  await person('newboth');await person('newboth','followings');await event('newboth',{day:'2026-01-20',count:1,type:'added'});
  await person('null-opposite','followings');
  await db.exec(`insert into public.insight_social_comparisons values('owner','null-opposite','null-opposite','https://note.com/null_opposite',null,true,null,'2026-01-20','2026-01-20',1,null,null,null);`);
  const other='00000000-0000-4000-8000-000000000002';await person('foreign','followers',{member:other});await event('foreign',{member:other,exact:true,count:99});
  await db.exec(migration('SOCIAL_CURRENT_RECONCILIATION_SQL','_social_current_reconciliation.sql'));
  const old=readFileSync('supabase/migrations/20261027183919_social_fallback_read_repair.sql','utf8');await db.exec(old.slice(old.indexOf('CREATE OR REPLACE FUNCTION public.insight_social_events_fallback')));
  await db.exec('revoke all on function public.insight_social_events_fallback(text,text,jsonb) from public;grant execute on function public.insight_social_events_fallback(text,text,jsonb) to authenticated;');
  const metadata=async()=>(await db.query("select proowner,proacl,prosecdef,proconfig from pg_proc where oid='public.insight_social_events_fallback(text,text,jsonb)'::regprocedure")).rows[0];
  const before=await metadata(),sql=migration('SOCIAL_CURRENT_FALLBACK_SQL','_social_current_fallback.sql');await db.exec(sql);await db.exec(sql);assert.deepEqual(await metadata(),before,'replacement and replay retain owner, ACL, SECURITY DEFINER and search_path');
  const read=async(action,extra={},token='ss_yr')=>(await db.query('select public.insight_social_events_fallback($1,$2,$3::jsonb) as result',[token,action,JSON.stringify(extra)])).rows[0].result;
  const decreases=await read('events',{change:'removed',direction:'followers'});assert.equal(decreases.total,1);assert.equal(decreases.rows[0].person_key,'refollow');assert.equal(decreases.rows[0].current_direction_present,true,'a true historical decrease survives a verified re-follow');assert.equal(decreases.rows[0].current_relation,'mutual');assert.equal(decreases.rows[0].identity_exact,true);
  const all=await read('events');assert.equal(all.total,2);assert.ok(all.rows.some(row=>row.person_key==='newboth'));assert.ok(!all.rows.some(row=>row.person_key==='pending'||row.person_key==='resolved'||row.person_key==='unknown:drop'));
  const pending=await read('investigation',{change:'added'});assert.equal(pending.total,2);assert.deepEqual(pending.rows.map(row=>row.person_key).sort(),['pending','unknown:drop']);assert.equal(pending.rows.find(row=>row.person_key==='unknown:drop').change_count,48);assert.ok(pending.rows.every(row=>row.candidate_resolved===false));
  assert.equal(pending.historySummary.confirmedRemoved,1);assert.equal(pending.historySummary.unknownDecrease,48);assert.equal(pending.historySummary.unresolvedCandidates,1);assert.equal(pending.historySummary.resolvedCandidates,1);
  const mutual=await read('comparison',{relationship:'mutual'});assert.ok(mutual.rows.some(row=>row.person_key==='refollow'&&row.lost_at===null));assert.ok(mutual.rows.some(row=>row.person_key==='newboth'),'two positive lists identify mutual even without an authenticated comparison record');assert.equal(mutual.counts.lost,0);assert.ok(!mutual.rows.some(row=>row.person_key==='null-opposite'));
  const unknown=await read('comparison',{relationship:'unknown'});assert.ok(unknown.rows.some(row=>row.person_key==='null-opposite'&&row.is_follower===null));assert.ok(!unknown.rows.some(row=>row.person_key==='newboth'||row.person_key==='refollow'));
  assert.equal((await read('comparison',{relationship:'lost'})).total,0,'current mutual cannot remain in current-lost view');
  assert.equal((await read('events',{change:'removed',query:'refollow',dateFrom:'2026-01-10',dateTo:'2026-01-11'})).total,1);assert.equal((await read('events',{change:'removed',dateFrom:'2026-01-11'})).total,0);
  const foreign=await read('events',{},'member_b');assert.equal(foreign.total,1);assert.equal(foreign.rows[0].person_key,'foreign');assert.equal(foreign.historySummary.confirmedRemoved,99);assert.ok(!decreases.rows.some(row=>row.person_key==='foreign'));
  for(const token of ['bad','expired','revoked',''])await assert.rejects(read('events',{},token),/INSIGHT_SESSION_INVALID/);await assert.rejects(read('events',{},'inactive'),/INSIGHT_MEMBER_INACTIVE/);
 }finally{await db.close()}
});
