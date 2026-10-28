import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

function sql(){
 if(process.env.SOCIAL_CURRENT_RECONCILIATION_SQL)return readFileSync(process.env.SOCIAL_CURRENT_RECONCILIATION_SQL,'utf8');
 const name=readdirSync('supabase/migrations').filter(x=>x.endsWith('_social_current_reconciliation.sql')).sort().at(-1);
 assert.ok(name,'canonical current relationship reconciliation migration exists');
 return readFileSync('supabase/migrations/'+name,'utf8');
}

function performanceSql(){
 if(process.env.SOCIAL_CURRENT_PERFORMANCE_SQL)return readFileSync(process.env.SOCIAL_CURRENT_PERFORMANCE_SQL,'utf8');
 const name=readdirSync('supabase/migrations').filter(x=>x.endsWith('_social_current_performance.sql')).sort().at(-1);
 assert.ok(name,'canonical current relationship performance migration exists');
 return readFileSync('supabase/migrations/'+name,'utf8');
}

function restorationSql(){
 if(process.env.SOCIAL_KNOWN_POSITIVE_RESTORE_SQL)return readFileSync(process.env.SOCIAL_KNOWN_POSITIVE_RESTORE_SQL,'utf8');
 const name=readdirSync('supabase/migrations').filter(x=>x.endsWith('_social_known_positive_restore.sql')).sort().at(-1);
 assert.ok(name,'canonical latest-known positive restoration migration exists');
 return readFileSync('supabase/migrations/'+name,'utf8');
}

test('current relationship resolves disproven candidates while retaining true historical losses and uncertainty',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`
   set timezone='UTC';
   create role anon; create role authenticated; create role service_role bypassrls;
   create table public.insight_relations(member_id text,direction text,person_key text,actor_name text,actor_url text,actor_image_url text,active boolean,source_rank int,first_seen_at timestamptz,last_seen_at timestamptz,last_changed_at timestamptz,primary key(member_id,direction,person_key));
   create table public.insight_social_comparisons(member_id text,person_key text,actor_name text,actor_url text,actor_image_url text,is_following boolean,is_follower boolean,checked_at timestamptz,first_checked_at timestamptz,following_rank int,follower_rank int,lost_at timestamptz,gained_at timestamptz,primary key(member_id,person_key));
   create table public.insight_social_comparison_history(id bigint generated always as identity primary key,member_id text,person_key text,is_following boolean,is_follower boolean,observed_at timestamptz);
   create index comparison_history_scope_person_time on public.insight_social_comparison_history(member_id,person_key,observed_at desc);
   create table public.insight_relation_sync_runs(id bigint generated always as identity primary key,member_id text,direction text,received_count int,expected_count int,complete boolean,created_at timestamptz);
   create index sync_runs_scope_direction_time on public.insight_relation_sync_runs(member_id,direction,created_at desc);
   -- Historical recovery is tested separately; these rows isolate current-state reconciliation.
   create table public.insight_relation_history_rows(id text,member_id text,run_id bigint,direction text,event_type text,person_key text,actor_name text,actor_url text,actor_image_url text,detected_at timestamptz,change_count int,evidence text,identity_exact boolean,source text,evidence_window_start timestamptz);
   alter table public.insight_relations enable row level security;
   alter table public.insight_social_comparisons enable row level security;
   alter table public.insight_social_comparison_history enable row level security;
   alter table public.insight_relation_sync_runs enable row level security;
   alter table public.insight_relation_history_rows enable row level security;
   grant select on all tables in schema public to service_role;
   insert into public.insight_relation_sync_runs(member_id,direction,received_count,expected_count,complete,created_at) values('a','followers',1000,2306,false,'2026-01-25'),('a','followings',886,886,true,'2026-01-25'),('complete','followers',9,9,true,'2026-01-12');
  `);
  const at=day=>`2026-01-${String(day).padStart(2,'0')}T00:00:00Z`;
  const person=async(key,{member='a',direction='followers',last=20,changed=last,active=true}={})=>db.query('insert into public.insight_relations values($1,$2,$3,$3,$4,null,$5,5,$6,$7,$8)',[member,direction,key,'https://note.com/'+key,active,at(1),at(last),at(changed)]);
  const comparison=async(key,{member='a',day=20,following=true,follower=true,lost=null}={})=>db.query('insert into public.insight_social_comparisons values($1,$2,$2,$3,null,$4,$5,$6,$7,5,5,$8,null)',[member,key,'https://note.com/'+key,following,follower,at(day),at(1),lost===null?null:at(lost)]);
  const observation=async(key,{member='a',day=20,following=true,follower=true}={})=>db.query('insert into public.insight_social_comparison_history(member_id,person_key,is_following,is_follower,observed_at) values($1,$2,$3,$4,$5)',[member,key,following,follower,at(day)]);
  const event=async(key,{member='a',day=10,exact=false,count=0,direction='followers'}={})=>db.query('insert into public.insight_relation_history_rows values($1,$2,null,$3,\'removed\',$4,$4,$5,null,$6,$7,$8,$9,\'relation_event\',null)',[member+':'+direction+':'+key,member,direction,key,key.startsWith('unknown:')?null:'https://note.com/'+key,at(day),count,key.startsWith('unknown:')?'count_only':exact?'authenticated_relationship':'window_candidate',exact]);

  await person('resolved-list');await event('resolved-list');
  await person('resolved-auth',{last:5,changed:10,active:false});await comparison('resolved-auth');await event('resolved-auth');
  await person('older-positive',{last:5,changed:10,active:false});await comparison('older-positive',{day:8});await event('older-positive');
  await person('later-negative',{last:20,changed:25,active:false});await comparison('later-negative',{day:23,follower:false,lost:23});await event('later-negative');
  await person('exact-refollow');await comparison('exact-refollow',{day:20,lost:10});await event('exact-refollow',{exact:true,count:1});
  await person('tie-positive');await comparison('tie-positive',{day:20,follower:false,lost:20});await event('tie-positive',{day:20});
  await person('partial-null',{last:5,changed:10,active:false});await comparison('partial-null',{day:24,follower:null});await observation('partial-null',{day:15,follower:false});await event('partial-null');
  await person('old-null-presence',{last:5,changed:10,active:false});await comparison('old-null-presence',{day:24,follower:null});await observation('old-null-presence',{day:8,follower:true});await event('old-null-presence');
  await person('direction-only',{direction:'followers'});await comparison('direction-only',{following:null,follower:true});
  await event('unknown:drop',{day:22,count:3});
  await person('resolved-list',{member:'b',last:5,active:false});await comparison('resolved-list',{member:'b',follower:false});await event('resolved-list',{member:'b',exact:true,count:99});
  await person('complete-absent',{member:'complete',last:5,changed:10,active:false});await event('complete-absent',{member:'complete'});
  await person('complete-present',{member:'complete',last:11,active:true});await event('complete-present',{member:'complete'});
  await person('after-cap',{member:'complete',last:20,changed:23,active:false});await event('after-cap',{member:'complete',day:15});
  await person('tie-complete',{member:'complete',last:12,changed:12,active:false});await event('tie-complete',{member:'complete'});
  await person('unknown-opposite',{member:'unobserved'});await event('unknown-opposite',{member:'unobserved'});
  await event('missing-person',{member:'unobserved'});
  await person('following-older',{member:'direction-test',direction:'followings',last:5,changed:10,active:false});await comparison('following-older',{member:'direction-test',day:8,following:true,follower:false});await event('following-older',{member:'direction-test',direction:'followings'});

  const dump=async()=>(await db.query(`select jsonb_build_object('people',(select jsonb_agg(to_jsonb(x) order by member_id,direction,person_key) from public.insight_relations x),'history',(select jsonb_agg(to_jsonb(x) order by id) from public.insight_relation_history_rows x),'comparisons',(select jsonb_agg(to_jsonb(x) order by member_id,person_key) from public.insight_social_comparisons x)) as value`)).rows[0].value;
  const before=await dump();const migration=sql();await db.exec(migration);await db.exec(migration);await db.exec(performanceSql());await db.exec(performanceSql());await db.exec(restorationSql());await db.exec(restorationSql());
  assert.deepEqual(await dump(),before,'reconciliation never writes or deletes source evidence');
  const rows=(await db.query("select * from public.insight_relation_history_current where member_id='a' order by person_key")).rows;
  const row=key=>rows.find(r=>r.person_key===key);
  for(const key of ['resolved-list','resolved-auth','tie-positive','older-positive','old-null-presence']){assert.equal(row(key).candidate_resolved,true,key);assert.equal(row(key).current_direction_present,true,key);}
  for(const key of ['later-negative','partial-null'])assert.equal(row(key).candidate_resolved,false,key);
  assert.equal(row('later-negative').current_direction_present,false,'newer authenticated absence defeats older list presence');
  assert.equal(row('older-positive').current_direction_present,true,'last proven positive remains a positive, not a current removal');
  assert.equal(row('exact-refollow').identity_exact,true);assert.equal(row('exact-refollow').candidate_resolved,false,'a real past loss survives re-follow');assert.equal(row('exact-refollow').current_direction_present,true);
  assert.equal(row('partial-null').current_direction_present,false,'partial null does not erase previous directional evidence');
  assert.equal(new Date(row('partial-null').current_following_verified_at).toISOString(),new Date(at(25)).toISOString());
  assert.equal(new Date(row('partial-null').current_follower_verified_at).toISOString(),new Date(at(15)).toISOString(),'each relationship direction keeps its own real observation date');
  assert.equal(new Date(row('partial-null').current_direction_verified_at).toISOString(),new Date(at(15)).toISOString(),'preserved directional value retains its original observation time');
  assert.equal(new Date(row('old-null-presence').current_direction_verified_at).toISOString(),new Date(at(8)).toISOString(),'restoration must retain the original positive date instead of using a partial payload or window exit time');
  assert.equal(row('unknown:drop').current_direction_present,null);assert.equal(row('unknown:drop').candidate_resolved,false);assert.equal(row('unknown:drop').change_count,3);
  const complete=(await db.query("select person_key,is_follower,follower_verified_at from public.insight_social_current_people where member_id='complete' order by person_key")).rows;
  assert.equal(complete.find(r=>r.person_key==='complete-absent').is_follower,false,'complete snapshot supplies negative evidence for known absent person');
  assert.equal(complete.find(r=>r.person_key==='complete-present').is_follower,true,'active membership is not absence merely because run is committed after collection');
  assert.equal(complete.find(r=>r.person_key==='after-cap').is_follower,true,'later capped-window absence cannot turn an older complete run into newer proof');
  assert.equal(complete.find(r=>r.person_key==='tie-complete').is_follower,true,'positive observation wins a timestamp tie with complete-snapshot absence');
  const unobserved=(await db.query("select * from public.insight_social_current_people where member_id='unobserved'")).rows[0];assert.equal(unobserved.is_following,null);assert.equal(unobserved.is_follower,true);assert.equal(unobserved.relation,'unknown','unobserved opposite-direction state remains unknown instead of false');
  const social=(await db.query("select * from public.insight_social_current_people where member_id='a' and person_key='tie-positive'")).rows[0];assert.equal(social.lost_at,null,'newer/tied positive clears current loss label without deleting past history');
  const summary=async(extra=[])=> (await db.query('select public.insight_social_history_summary($1,$2,$3,$4,$5) as value',['a','followers',null,null,null,...extra].slice(0,5))).rows[0].value;
  const totals=await summary();assert.equal(totals.confirmedRemoved,1);assert.equal(totals.unknownDecrease,3);assert.equal(totals.unresolvedCandidates,2);assert.equal(totals.resolvedCandidates,5);assert.equal(totals.savedPeople,9);assert.deepEqual(totals.coverage.followers,{received:1000,expected:2306,complete:false,at:'2026-01-25T00:00:00+00:00'});
  const filtered=(await db.query("select public.insight_social_history_summary('a','followers','2026-01-09','2026-01-11','resolved') as value")).rows[0].value;assert.equal(filtered.resolvedCandidates,2);assert.equal(filtered.unknownDecrease,0);assert.equal(filtered.confirmedRemoved,0);
  const unknownOnly=(await db.query("select public.insight_social_history_summary('a','followers','2026-01-22','2026-01-23',null) as value")).rows[0].value;assert.equal(unknownOnly.unknownDecrease,3);assert.equal(unknownOnly.unresolvedCandidates,0);
  const keys=(await db.query("select person_key from public.insight_relation_history_current where member_id='a' and event_type='removed' and identity_exact is true")).rows;assert.deepEqual(keys,[{person_key:'exact-refollow'}],'confirmed decrease page excludes window candidates and count-only uncertainty');
  for(const name of ['insight_social_current_people','insight_relation_history_current']){
   const grants=(await db.query('select has_table_privilege(\'anon\',$1,\'SELECT\') as anon,has_table_privilege(\'authenticated\',$1,\'SELECT\') as browser,has_table_privilege(\'service_role\',$1,\'SELECT\') as service',['public.'+name])).rows[0];assert.deepEqual(grants,{anon:false,browser:false,service:true});
   assert.ok((await db.query('select reloptions from pg_class where oid=$1::regclass',['public.'+name])).rows[0].reloptions.includes('security_invoker=true'));
  }
  const directionRestored=(await db.query("select * from public.insight_relation_history_current where member_id='direction-test'")).rows[0];assert.equal(directionRestored.current_direction_present,true);assert.equal(directionRestored.candidate_resolved,true,'following direction uses its own latest saved positive');assert.equal(new Date(directionRestored.current_direction_verified_at).toISOString(),new Date(at(8)).toISOString());
  const missing=(await db.query("select * from public.insight_relation_history_current where member_id='unobserved' and person_key='missing-person'")).rows[0];assert.equal(missing.candidate_resolved,false,'no directional evidence remains unknown');assert.equal(missing.current_direction_present,null);
  const refresh=(await db.query("select public.insight_social_pending_history_candidates('a','',100) as value")).rows[0].value;assert.deepEqual(refresh.rows.map(r=>r.person_key).sort(),['old-null-presence','older-positive','tie-positive'],'explicit refresh retains older or same-time positives without keeping them in the unresolved display, and excludes fresh positives or proven negatives');
  const permission=(await db.query("select has_function_privilege('anon','public.insight_social_history_summary(text,text,timestamptz,timestamptz,text)','EXECUTE') as anon,has_function_privilege('authenticated','public.insight_social_history_summary(text,text,timestamptz,timestamptz,text)','EXECUTE') as browser,has_function_privilege('service_role','public.insight_social_history_summary(text,text,timestamptz,timestamptz,text)','EXECUTE') as service")).rows[0];assert.deepEqual(permission,{anon:false,browser:false,service:true});
  await db.exec('set role service_role');assert.equal((await db.query("select public.insight_social_history_summary('a','followers') as value")).rows[0].value.confirmedRemoved,1);await db.exec('reset role');

  // Tenant filters must reach the original relation/history scans before projection.
  await db.exec(`insert into public.insight_relations select 'b','followers','foreign-'||n,'Foreign '||n,null,null,false,n,'2026-01-01','2026-01-05','2026-01-10' from generate_series(1,3000)n;insert into public.insight_social_comparison_history(member_id,person_key,is_following,is_follower,observed_at) select 'b','foreign-'||n,true,false,'2026-01-11' from generate_series(1,3000)n;analyze public.insight_relations;analyze public.insight_social_comparison_history;`);
  const plan=(await db.query("explain (analyze,format json) select * from public.insight_relation_history_current where member_id='a' and direction='followers' order by detected_at desc,id desc limit 20")).rows[0]['QUERY PLAN'][0];
  const nodes=[];function visit(n){nodes.push(n);for(const c of n.Plans||[])visit(c)}visit(plan.Plan);
  assert.ok(!nodes.some(n=>n['Node Type']==='CTE Scan'),'no global materialized evidence CTE');
  const scans=nodes.filter(n=>n['Relation Name']==='insight_social_comparison_history');assert.ok(scans.length>0);
  for(const scan of scans){assert.ok(scan['Actual Rows']<100,'another account history is not projected');assert.ok((scan['Rows Removed by Filter']||0)<100,'account restriction precedes broad scan');}
  for(const scan of nodes.filter(n=>n['Relation Name']==='insight_relations')){assert.ok(scan['Actual Rows']<100,'relation population is scoped before projection');assert.ok((scan['Rows Removed by Filter']||0)<100,'another tenant relation population is not scanned');}
  console.log('Scoped current reconciliation: '+plan['Execution Time']+' ms; '+scans.length+' bounded comparison-history scans.');
  // A missing complete follower scan is common for capped accounts. Looking it
  // up inside each person's LATERAL repeats thousands of run scans; it must be
  // resolved once per account/direction even when there is no matching run.
  await db.exec(`insert into public.insight_relations select 'a','followers','own-'||n,'Own '||n,null,null,false,n,'2026-01-01','2026-01-05','2026-01-10' from generate_series(1,2157)n;
   insert into public.insight_relation_sync_runs(member_id,direction,received_count,expected_count,complete,created_at) select 'a','followers',1000,2306,false,'2026-01-01'::timestamptz+n*interval '1 minute' from generate_series(1,1895)n;
   insert into public.insight_relation_sync_runs(member_id,direction,received_count,expected_count,complete,created_at) select 'b','followers',1000,1000,true,'2026-01-01'::timestamptz+n*interval '1 minute' from generate_series(1,500)n;
   analyze public.insight_relations;analyze public.insight_relation_sync_runs;`);
  const largePlan=(await db.query("explain (analyze,format json) select * from public.insight_social_current_people where member_id='a' order by person_key")).rows[0]['QUERY PLAN'][0];
  const largeNodes=[];function visitLarge(n){largeNodes.push(n);for(const c of n.Plans||[])visitLarge(c)}visitLarge(largePlan.Plan);
  const runScans=largeNodes.filter(n=>n['Relation Name']==='insight_relation_sync_runs');assert.equal(runScans.length,2,'one lookup per relationship direction');
  for(const scan of runScans)assert.equal(scan['Actual Loops'],1,'complete-run lookup is performed once, not once per person');
  const beforeLargeQuery=await dump();assert.equal((await db.query("select count(*)::int n from public.insight_social_current_people where member_id='a'")).rows[0].n,2166);assert.deepEqual(await dump(),beforeLargeQuery,'performance projection stays read-only');
  console.log('Large saved people reconciliation: '+largePlan['Execution Time']+' ms; '+runScans.length+' complete-run scans, each exactly once for 2,166 people/1,895 partial runs.');

 }finally{await db.close()}
});
