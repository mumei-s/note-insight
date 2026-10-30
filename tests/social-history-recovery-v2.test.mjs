import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

function migrationSql(){
 const supplied=process.env.HISTORY_RECOVERY_SQL;
 if(supplied)return readFileSync(supplied,'utf8');
 const name=readdirSync('supabase/migrations').filter(name=>name.endsWith('_social_historical_recovery.sql')).sort().at(-1);
 assert.ok(name,'the canonical social historical recovery migration must exist');
 return readFileSync('supabase/migrations/'+name,'utf8');
}

function preservationSql(){
 const supplied=process.env.HISTORY_PRESERVATION_SQL;
 if(supplied)return readFileSync(supplied,'utf8');
 const name=readdirSync('supabase/migrations').filter(name=>name.endsWith('_social_historical_preservation.sql')).sort().at(-1);
 assert.ok(name,'the canonical social historical preservation migration must exist');
 return readFileSync('supabase/migrations/'+name,'utf8');
}

test('historical view restores named evidence, preserves ambiguity and never rewrites source records',async t=>{
 const db=new PGlite();
 try{
  await db.exec(`
   create role anon; create role authenticated; create role service_role bypassrls;
   create table public.insight_relations (
    member_id text not null,direction text not null,person_key text not null,
    actor_name text,actor_url text,actor_image_url text,active boolean,
    first_seen_at timestamptz,last_seen_at timestamptz,last_changed_at timestamptz,
    primary key(member_id,direction,person_key)
   );
   create table public.insight_relation_events (
    id bigint generated always as identity primary key,member_id text not null,
    run_id bigint,direction text,event_type text,person_key text,
    actor_name text,actor_url text,actor_image_url text,detected_at timestamptz,
    change_count integer
   );
   create table public.insight_relation_sync_runs (
    id bigint primary key,member_id text not null,complete boolean
   );
   create table public.insight_social_comparisons (
    member_id text not null,person_key text not null,actor_name text,actor_url text,
    actor_image_url text,is_following boolean,is_follower boolean,
    checked_at timestamptz,lost_at timestamptz,primary key(member_id,person_key)
   );
   create table public.insight_social_comparison_history (
    id bigint generated always as identity primary key,member_id text not null,
    person_key text not null,actor_name text,actor_url text,
    previous_following boolean,previous_follower boolean,is_following boolean,
    is_follower boolean,observed_at timestamptz,observation_kind text,
    unique(member_id,person_key,observed_at)
   );
   alter table public.insight_relations enable row level security;
   alter table public.insight_relation_events enable row level security;
   alter table public.insight_relation_sync_runs enable row level security;
   alter table public.insight_social_comparisons enable row level security;
   alter table public.insight_social_comparison_history enable row level security;
   grant select on all tables in schema public to service_role;
   insert into public.insight_relation_sync_runs values(1,'a',true),(2,'a',false),(3,'b',true);
  `);
  const at=day=>`2026-01-${String(day).padStart(2,'0')}T00:00:00Z`;
  const relation=async(key,{member='a',direction='followers',first=1,last=5,changed=10,active=false}={})=>db.query(
   'insert into public.insight_relations values($1,$2,$3,$3,$4,null,$5,$6,$7,$8)',
   [member,direction,key,'https://note.com/'+key,active,at(first),at(last),at(changed)]);
  const comparison=async(key,{member='a',checked=10,lost=null,follower=false,following=true}={})=>db.query(
   'insert into public.insight_social_comparisons values($1,$2,$2,$3,null,$4,$5,$6,$7)',
   [member,key,'https://note.com/'+key,following,follower,at(checked),lost===null?null:at(lost)]);
  const history=async(key,{member='a',day=10,kind='changed',previous=true,next=false,previousFollowing=null,nextFollowing=true}={})=>db.query(
   'insert into public.insight_social_comparison_history(member_id,person_key,actor_name,actor_url,previous_following,previous_follower,is_following,is_follower,observed_at,observation_kind) values($1,$2,$2,$3,$4,$5,$6,$7,$8,$9)',
   [member,key,'https://note.com/'+key,previousFollowing,previous,nextFollowing,next,at(day),kind]);
  const event=async(key,{member='a',run=2,day=10,change='removed',count=1,direction='followers'}={})=>db.query(
   'insert into public.insight_relation_events(member_id,run_id,direction,event_type,person_key,actor_name,actor_url,detected_at,change_count) values($1,$2,$3,$4,$5,$5,$6,$7,$8)',
   [member,run,direction,change,key,key.startsWith('unknown:')?null:'https://note.com/'+key,at(day),count]);

  await relation('archive-only');
  await relation('legacy-loss');await comparison('legacy-loss',{checked:12,lost:10});
  await history('legacy-loss',{day:12,kind:'baseline',previous:null});
  await relation('changed-loss');await comparison('changed-loss',{lost:10});await history('changed-loss');
  await relation('baseline-prior-positive');await comparison('baseline-prior-positive');
  await history('baseline-prior-positive',{kind:'baseline',previous:null});
  await comparison('never-follower');await history('never-follower',{kind:'baseline',previous:null});
  await relation('future-positive',{first:11,last:11,changed:11,active:true});
  await comparison('future-positive');await history('future-positive',{kind:'baseline',previous:null});
  await relation('refollowed',{last:15,changed:15,active:true});
  await comparison('refollowed',{checked:15,follower:true});await history('refollowed');
  await history('refollowed',{day:15,previous:false,next:true});
  await relation('second-disappearance',{last:15,changed:16});await history('second-disappearance');
  await relation('complete-event');await event('complete-event',{run:1});await history('complete-event');
  await relation('zero-candidate');await event('zero-candidate',{run:1,count:0});await history('zero-candidate');
  await relation('raw-candidate');await event('raw-candidate');
  await relation('added-only',{active:true,last:10,changed:10});await event('added-only',{change:'added'});
  await event('unknown:drop',{day:20,count:3});await event('aggregate:obsolete',{day:20,count:99});
  await relation('same-key');await event('same-key',{member:'b',run:3});
  await relation('following-lost',{direction:'followings'});
  await history('following-lost',{previous:null,next:true,previousFollowing:true,nextFollowing:false});
  await relation('two-losses',{last:15,changed:18});await history('two-losses');
  await history('two-losses',{day:15,previous:false,next:true});
  await history('two-losses',{day:18,previous:true,next:false});
  await comparison('two-losses',{checked:18,lost:18});
  await relation('baseline-after-list-positive',{last:15,changed:18});
  await history('baseline-after-list-positive');
  await history('baseline-after-list-positive',{day:18,kind:'baseline',previous:null});
  await relation('baseline-after-auth-positive',{last:5,changed:18});
  await history('baseline-after-auth-positive');
  await history('baseline-after-auth-positive',{day:15,previous:false,next:true});
  await history('baseline-after-auth-positive',{day:18,kind:'baseline',previous:null});

  const snapshot=async()=> (await db.query(`select jsonb_build_object(
   'relations',(select jsonb_agg(to_jsonb(t) order by member_id,direction,person_key) from public.insight_relations t),
   'events',(select jsonb_agg(to_jsonb(t) order by id) from public.insight_relation_events t),
   'comparisons',(select jsonb_agg(to_jsonb(t) order by member_id,person_key) from public.insight_social_comparisons t),
   'history',(select jsonb_agg(to_jsonb(t) order by id) from public.insight_social_comparison_history t)
  ) as snapshot`)).rows[0].snapshot;
  const before=await snapshot(),sql=migrationSql();await db.exec(sql);
  await db.exec(preservationSql());await db.exec(preservationSql());
  const rows=(await db.query("select * from public.insight_relation_history_rows where member_id='a' order by detected_at desc,id desc")).rows;
  const named=key=>rows.filter(r=>r.person_key===key),one=key=>{const rs=named(key);assert.equal(rs.length,1,key+' occurs once');return rs[0]};
  const candidate=one('archive-only');assert.equal(candidate.source,'saved_archive');assert.equal(candidate.evidence,'window_candidate');assert.equal(candidate.identity_exact,false);assert.equal(candidate.change_count,0);
  for(const key of ['legacy-loss','changed-loss','baseline-prior-positive','refollowed','following-lost']){
   const r=one(key);assert.equal(r.evidence,'authenticated_relationship',key);assert.equal(r.identity_exact,true,key);assert.equal(r.change_count,1,key);
  }
  assert.equal(new Date(one('legacy-loss').detected_at).toISOString(),new Date(at(10)).toISOString());
  assert.equal(named('never-follower').length,0,'negative baseline alone invents no loss');
  assert.equal(named('future-positive').length,0,'later positive is not evidence of earlier following');
  const twice=named('second-disappearance');assert.equal(twice.length,2);assert.deepEqual(twice.map(r=>r.source),['saved_archive','authenticated_history']);
  assert.equal(one('complete-event').evidence,'complete_snapshot','exact same-time raw/history observations are one event');
  const zero=named('zero-candidate');assert.equal(zero.length,2);
  assert.equal(zero.find(r=>r.source==='relation_event').evidence,'window_candidate','zero count observation is never an exact loss');
  assert.equal(zero.find(r=>r.source==='relation_event').identity_exact,false);
  assert.equal(zero.find(r=>r.source==='authenticated_history').identity_exact,true,'independent proof is retained');
  assert.equal(one('raw-candidate').source,'relation_event');assert.equal(one('raw-candidate').identity_exact,false);
  assert.equal(one('unknown:drop').change_count,3);assert.equal(one('unknown:drop').evidence,'count_only');assert.equal(one('unknown:drop').identity_exact,false);
  assert.equal(named('aggregate:obsolete').length,0);
  assert.equal(one('same-key').source,'saved_archive','another member event does not suppress this member candidate');
  assert.equal(one('following-lost').direction,'followings');
  assert.equal(named('two-losses').length,2,'re-follow preserves distinct historical losses');
  assert.equal(named('baseline-after-list-positive').length,2,'a later saved-list positive supports a distinct later baseline loss');
  assert.equal(named('baseline-after-auth-positive').length,2,'a later authenticated positive supports a distinct later baseline loss');
  assert.equal(rows.filter(r=>r.source==='saved_archive').reduce((n,r)=>n+r.change_count,0),0,'archive candidates add no claimed losses');
  const sourceCount=(await db.query('select count(*)::int as n from public.insight_relation_events')).rows[0].n;
  assert.equal(sourceCount,7,'saved raw rows are not replaced by the recovery view');
  assert.deepEqual(await snapshot(),before,'all source histories remain byte-value identical');
  assert.equal(new Set(rows.map(r=>r.id)).size,rows.length,'all projected IDs are stable and unique');

  // Actual database pagination/search/date/scope, rather than mirroring JS logic.
  const first=(await db.query("select id from public.insight_relation_history_rows where member_id='a' order by detected_at desc,id desc limit 4")).rows;
  const second=(await db.query("select id from public.insight_relation_history_rows where member_id='a' order by detected_at desc,id desc offset 4 limit 4")).rows;
  assert.equal(new Set([...first,...second].map(r=>r.id)).size,8);
  assert.deepEqual([...first,...second].map(r=>r.id),rows.slice(0,8).map(r=>r.id));
  const filtered=(await db.query("select person_key from public.insight_relation_history_rows where member_id='a' and event_type='removed' and detected_at >= '2026-01-18T00:00:00Z'::timestamptz and detected_at < '2026-01-19T00:00:00Z'::timestamptz and actor_name ilike '%two-losses%'" )).rows;
  assert.deepEqual(filtered,[{person_key:'two-losses'}]);
  assert.equal((await db.query("select count(*)::int as n from public.insight_relation_history_rows where member_id='b'")).rows[0].n,1);
  const privileges=(await db.query("select has_table_privilege('anon','public.insight_relation_history_rows','SELECT') as anonymous,has_table_privilege('authenticated','public.insight_relation_history_rows','SELECT') as browser,has_table_privilege('service_role','public.insight_relation_history_rows','SELECT') as service")).rows[0];
  assert.deepEqual(privileges,{anonymous:false,browser:false,service:true});
  assert.ok((await db.query("select reloptions from pg_class where oid='public.insight_relation_history_rows'::regclass")).rows[0].reloptions.includes('security_invoker=true'));
  await db.exec('set role service_role');
  assert.equal((await db.query("select count(*)::int as n from public.insight_relation_history_rows where member_id='a'")).rows[0].n,rows.length);
  await db.exec('reset role');
  // A scoped page must not materialize every tenant's authenticated history.
  await db.exec(`
   create index history_member_person_time on public.insight_social_comparison_history(member_id,person_key,observed_at);
   create index events_member_person_time on public.insight_relation_events(member_id,direction,person_key,detected_at);
   insert into public.insight_relations(member_id,direction,person_key,actor_name,active,first_seen_at,last_seen_at,last_changed_at)
    select 'b','followers','foreign-'||n,'Foreign '||n,false,'2026-01-01','2026-01-02','2026-01-10' from generate_series(1,3000) n;
   insert into public.insight_social_comparison_history(member_id,person_key,previous_follower,is_follower,observed_at,observation_kind)
    select 'b','foreign-'||n,true,false,'2026-01-10','changed' from generate_series(1,3000) n;
   analyze public.insight_relations; analyze public.insight_social_comparison_history;
   analyze public.insight_relation_events; analyze public.insight_social_comparisons;
  `);
  const plan=(await db.query("explain (analyze,format json) select * from public.insight_relation_history_rows where member_id='a' and direction='followers' order by detected_at desc,id desc limit 20")).rows[0]['QUERY PLAN'][0];
  const nodes=[];function visit(node){nodes.push(node);for(const child of node.Plans||[])visit(child)}visit(plan.Plan);
  assert.ok(!nodes.some(node=>node['Node Type']==='CTE Scan'),'no globally materialized evidence CTE');
  const evidenceScans=nodes.filter(node=>node['Relation Name']==='insight_social_comparison_history');
  assert.ok(evidenceScans.length>0);
  for(const scan of evidenceScans){
   assert.ok(scan['Actual Rows']<100,'another tenant history is not projected before filtering');
   assert.ok((scan['Rows Removed by Filter']||0)<100,'scope is pushed into history access before full tenant scan');
   assert.match(JSON.stringify(scan),/member_id/,'history access retains an account predicate');
  }
  console.log('Scoped historical view: '+plan['Execution Time']+' ms; '+evidenceScans.length+' bounded evidence scans, no CTE materialization.');

  await t.test('owner-only preservation appends once and survives a later re-follow without changing official unknown counts',async()=>{
   await relation('owner-legacy',{member:'owner'});
   await comparison('owner-legacy',{member:'owner',checked:12,lost:10});
   await history('owner-legacy',{member:'owner',day:12,kind:'baseline',previous:null});
   await relation('owner-archive',{member:'owner'});
   await comparison('owner-negative-only',{member:'owner'});
   await event('unknown:owner-drop',{member:'owner',day:20,count:48});
   await relation('other-archive',{member:'b'});
   await comparison('other-legacy',{member:'b',checked:12,lost:10});
   const dump=async(scope)=> (await db.query(`select jsonb_build_object(
    'people',(select jsonb_agg(to_jsonb(x) order by direction,person_key) from public.insight_relations x where member_id=$1),
    'comparisons',(select jsonb_agg(to_jsonb(x) order by person_key) from public.insight_social_comparisons x where member_id=$1),
    'events',(select jsonb_agg(to_jsonb(x) order by id) from public.insight_relation_events x where member_id=$1),
    'history',(select jsonb_agg(to_jsonb(x) order by id) from public.insight_social_comparison_history x where member_id=$1)
   ) as value`,[scope])).rows[0].value;
   const bBefore=await dump('b'),ownerBefore=await dump('owner'),preserve=preservationSql();
   await db.exec(preserve);const afterFirst=await dump('owner');await db.exec(preserve);
   assert.deepEqual(await dump('owner'),afterFirst,'reapplying adds no duplicate observations');
   assert.deepEqual(await dump('b'),bBefore,'other members receive no repairs or writes');
   assert.deepEqual(afterFirst.people,ownerBefore.people,'saved people are unchanged');
   assert.deepEqual(afterFirst.comparisons,ownerBefore.comparisons,'current comparison state is unchanged');
   const proof=afterFirst.history.filter(r=>r.person_key==='owner-legacy'&&r.observation_kind==='changed');
   assert.equal(proof.length,1);assert.equal(proof[0].previous_following,true);assert.equal(proof[0].previous_follower,true);
   assert.equal(proof[0].is_following,true);assert.equal(proof[0].is_follower,false);
   assert.equal(new Date(proof[0].observed_at).toISOString(),new Date(at(10)).toISOString());
   assert.equal(afterFirst.history.filter(r=>r.person_key==='owner-negative-only').length,0,'false alone supplies no loss proof');
   const archived=afterFirst.events.filter(r=>r.person_key==='owner-archive');assert.equal(archived.length,1);
   assert.equal(archived[0].run_id,null);assert.equal(archived[0].change_count,0);
   assert.deepEqual(afterFirst.events.filter(r=>r.person_key==='unknown:owner-drop'),ownerBefore.events.filter(r=>r.person_key==='unknown:owner-drop'));

   // Simulate the normal positive observations replacing the mutable current
   // snapshots. Preserved observations must remain historical evidence.
   await db.exec("update public.insight_social_comparisons set is_following=true,is_follower=true,lost_at=null,checked_at='2026-01-21' where member_id='owner' and person_key='owner-legacy'; update public.insight_relations set active=true,last_seen_at='2026-01-21',last_changed_at='2026-01-21' where member_id='owner' and person_key in ('owner-legacy','owner-archive');");
   const repaired=(await db.query("select * from public.insight_relation_history_rows where member_id='owner' order by detected_at,id")).rows;
   const oldProof=repaired.filter(r=>r.person_key==='owner-legacy');assert.equal(oldProof.length,1);assert.equal(oldProof[0].identity_exact,true);
   assert.equal(oldProof[0].evidence,'authenticated_relationship');assert.equal(new Date(oldProof[0].detected_at).toISOString(),new Date(at(10)).toISOString());
   const oldCandidate=repaired.filter(r=>r.person_key==='owner-archive');assert.equal(oldCandidate.length,1);assert.equal(oldCandidate[0].identity_exact,false);
   assert.equal(oldCandidate[0].evidence,'window_candidate');assert.equal(oldCandidate[0].change_count,0);
   const unchangedUnknown=repaired.filter(r=>r.person_key==='unknown:owner-drop');assert.equal(unchangedUnknown.length,1);assert.equal(unchangedUnknown[0].change_count,48);
   await db.exec(preserve);assert.equal((await dump('owner')).events.length,afterFirst.events.length,'later positive does not add or remove preserved records');

   // Never overwrite an existing baseline to resolve a timestamp collision.
   await comparison('collision-loss',{member:'owner',checked:12,lost:10});
   await history('collision-loss',{member:'owner',day:10,kind:'baseline',previous:null});
   const conflictBefore=await dump('owner');
   await assert.rejects(db.exec(preserve),/SOCIAL_LEGACY_LOSS_TIMESTAMP_CONFLICT/);
   assert.deepEqual(await dump('owner'),conflictBefore,'conflicting legacy evidence stops without modifying existing data');
  });
 }finally{await db.close()}
});
