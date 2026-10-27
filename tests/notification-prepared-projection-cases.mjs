import assert from 'node:assert/strict';

// Runs inside the existing RPC test database, avoiding another large WASM
// database. All synthetic data, grants and fixture triggers roll back together.
export async function assertPreparedProjectionBehavior(db){
 const id=-770000001,moved=id-1,orphan=id-2;
 const table='insight_notification_internal.prepared_rows';
 const current=async(key=id)=>(await db.query(`SELECT p.*,ctid::text AS location FROM ${table} p WHERE id=$1`,[key])).rows[0];
 const ready=()=>db.query('SELECT insight_notification_internal.assert_prepared_rows_complete()');
 const rejected=async(sql,params,pattern)=>{
  await db.exec('SAVEPOINT expected_projection_rejection');
  try{await assert.rejects(db.query(sql,params),pattern)}
  finally{await db.exec('ROLLBACK TO SAVEPOINT expected_projection_rejection; RELEASE SAVEPOINT expected_projection_rejection')}
 };
 await db.exec('BEGIN');
 try{
  await ready();
  await db.query(`INSERT INTO public.insight_notifications
   (id,member_id,notification_type,raw_text,actor_name,actor_url,target_url,occurred_at,captured_at,is_read,meta)
   VALUES ($1,'prepared-fictional','other','架空の通知','架空の人','https://note.com/fictional_prepared',
    'https://note.com/fictional_prepared/n/test','2026-10-20T01:00:00Z','2026-10-20T01:00:01Z',false,
    '{"source":"note-notification-reader-v3","event_identity":"notice:770000001","classifier":"action-v28-context","recovery_version":"evidence-v2-articles"}')`,[id]);
  const initial=await current();
  assert.ok(initial.semantic_key);
  assert.equal(initial.completion_key,'notice:770000001');
  assert.equal(initial.format_type,'other');
  assert.equal(initial.reclassify_pending,false);
  await db.query('UPDATE public.insight_notifications SET is_read=true WHERE id=$1',[id]);
  assert.equal((await current()).location,initial.location,'read-only updates do not rewrite the projection');
  await db.query(`UPDATE public.insight_notifications SET meta=meta||'{"unrelated":"changed"}' WHERE id=$1`,[id]);
  assert.equal((await current()).location,initial.location,'unchanged derived tuple avoids even an UPSERT rewrite');

  await db.query(`UPDATE public.insight_notifications SET member_id=NULL,target_url='https://note.com/fictional_prepared/n/changed',
   captured_at='2026-10-21T01:02:03Z',occurred_at=NULL WHERE id=$1`,[id]);
  const scoped=await current();
  assert.equal(scoped.member_id,null);
  assert.equal(scoped.target_url,'https://note.com/fictional_prepared/n/changed');
  assert.equal(scoped.occurred_at,null);
  assert.equal(new Date(scoped.captured_at).toISOString(),'2026-10-21T01:02:03.000Z');
  assert.equal(scoped.completion_key,initial.completion_key);
  await ready();

  // Simulates the crucial backfill ordering: old eligible data reaches INSERT
  // after a newer UPDATE has written an ineligible tombstone. This is not a
  // concurrency emulator; the production script additionally holds KEY SHARE.
  const oldProjection=(await db.query(`SELECT to_jsonb(p) AS value FROM ${table} p WHERE id=$1`,[id])).rows[0].value;
  await db.query(`UPDATE public.insight_notifications SET notification_type='reply',
   meta=meta||'{"source":"canonical-public-comments"}' WHERE id=$1`,[id]);
  const tombstone=await current();
  assert.equal(tombstone.semantic_key,null);
  assert.equal(tombstone.member_id,null);
  for(const key of ['raw_type','target_url','occurred_at','captured_at','format_type','completion_key',
   'is_question_answer','is_canonical','insufficient','reclassify_pending'])assert.equal(tombstone[key],null,key);
  await db.query(`INSERT INTO ${table} SELECT p.* FROM jsonb_populate_record(NULL::${table},$1::jsonb) p
   ON CONFLICT(id) DO NOTHING`,[JSON.stringify(oldProjection)]);
  assert.equal((await current()).semantic_key,null,'stale backfill cannot resurrect eligibility');
  await db.query(`UPDATE public.insight_notifications SET notification_type='other',member_id='prepared-fictional',
   meta=meta||'{"source":"note-notification-reader-v3"}' WHERE id=$1`,[id]);
  assert.ok((await current()).semantic_key,'eligible again is prepared rather than reusing a tombstone');

  await db.query(`UPDATE public.insight_notifications SET meta=meta||'{"kind":"stock_photo"}' WHERE id=$1`,[id]);
  assert.equal((await current()).format_type,'image_used');
  // Source BEFORE classifiers may change fields absent from the incoming SET.
  await db.exec(`CREATE FUNCTION public.insight_prepared_fixture_before() RETURNS trigger
   LANGUAGE plpgsql SET search_path='' AS $fixture$ BEGIN
    IF NEW.id=-770000001 THEN NEW.meta=NEW.meta||'{"kind":"user_badge"}'::jsonb; END IF;
    RETURN NEW; END $fixture$;
   CREATE TRIGGER insight_prepared_fixture_before BEFORE UPDATE OF is_read
    ON public.insight_notifications FOR EACH ROW EXECUTE FUNCTION public.insight_prepared_fixture_before();`);
  await db.query('UPDATE public.insight_notifications SET is_read=false WHERE id=$1',[id]);
  assert.equal((await current()).format_type,'badge','generic AFTER UPDATE sees BEFORE-classifier side effects');
  await db.exec('DROP TRIGGER insight_prepared_fixture_before ON public.insight_notifications; DROP FUNCTION public.insight_prepared_fixture_before()');

  await db.query(`UPDATE public.insight_notifications SET id=$2,notification_type=NULL,raw_text=NULL,
   meta=NULL,target_url=NULL WHERE id=$1`,[id,moved]);
  assert.equal(await current(),undefined,'old mutable identity is removed');
  const nullLegacy=await current(moved);
  assert.ok(nullLegacy,'nullable legacy source has a projection or tombstone');
  assert.equal(nullLegacy.raw_type,null);
  if(nullLegacy.semantic_key!==null)assert.equal(nullLegacy.completion_key,'row:'+moved);
  await ready();

  // Missing/extra/identity corruption are rejected by the deploy-only gate.
  await db.query(`DELETE FROM ${table} WHERE id=$1`,[moved]);
  await rejected('SELECT insight_notification_internal.assert_prepared_rows_complete()',[],/NOTIFICATION_PREPARED_ROWS_INCOMPLETE/);
  await db.query('UPDATE public.insight_notifications SET is_read=is_read WHERE id=$1',[moved]);
  assert.ok(await current(moved),'an update repairs a cache entry absent during backfill');
  await db.query(`INSERT INTO ${table}(id,member_id) VALUES($1,'prepared-fictional')`,[orphan]);
  await rejected('SELECT insight_notification_internal.assert_prepared_rows_complete()',[],/NOTIFICATION_PREPARED_ROWS_INCOMPLETE/);
  await db.query(`DELETE FROM ${table} WHERE id=$1`,[orphan]);
  await db.query(`UPDATE ${table} SET member_id='incorrect-fictional-scope' WHERE id=$1`,[moved]);
  await rejected('SELECT insight_notification_internal.assert_prepared_rows_complete()',[],/NOTIFICATION_PREPARED_ROWS_INCOMPLETE/);
  await db.query('UPDATE public.insight_notifications SET is_read=is_read WHERE id=$1',[moved]);
  await ready();
  await db.query('DELETE FROM public.insight_notifications WHERE id=$1',[moved]);
  assert.equal(await current(moved),undefined,'source DELETE atomically removes private derived data');
  for(const type of ['like','follow','comment']){
   await db.query(`INSERT INTO public.insight_notifications
    (id,member_id,notification_type,raw_text,actor_name,actor_url,target_url,captured_at,meta)
    VALUES($1,'prepared-fictional',$2,'架空の通知','架空の人','https://note.com/fictional_prepared',
     'https://note.com/fictional_prepared/n/excluded','2026-10-22T01:00:00Z',
     '{"source":"note-notification-reader-v3","event_identity":"notice:770000003","body":[["unused"]]}')`,[orphan,type]);
   const excluded=await current(orphan);
   assert.ok(excluded.semantic_key,'eligible excluded row still contributes its grouping key');
   for(const key of ['format_type','completion_key','is_question_answer','is_canonical','insufficient','reclassify_pending'])
    assert.equal(excluded[key],null,'excluded singleton '+type+' '+key);
   await ready();
   await db.query('DELETE FROM public.insight_notifications WHERE id=$1',[orphan]);
  }

  const rights=(await db.query(`SELECT relrowsecurity AS rls,
   has_table_privilege('anon',oid,'SELECT') AS anon,
   has_table_privilege('authenticated',oid,'SELECT') AS authenticated,
   has_table_privilege('service_role',oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE') AS service
   FROM pg_class WHERE oid='${table}'::regclass`)).rows[0];
  assert.deepEqual(rights,{rls:true,anon:false,authenticated:false,service:true});
  const functions=(await db.query(`SELECT proname,prosecdef,
   has_function_privilege('anon',oid,'EXECUTE') AS anon,
   has_function_privilege('authenticated',oid,'EXECUTE') AS authenticated,
   has_function_privilege('service_role',oid,'EXECUTE') AS service,proconfig
   FROM pg_proc WHERE pronamespace='insight_notification_internal'::regnamespace
   AND proname IN ('project_row','sync_prepared_row','truncate_prepared_rows','assert_prepared_rows_complete')`)).rows;
  assert.equal(functions.length,4);
  for(const f of functions){assert.equal(f.prosecdef,false);assert.equal(f.anon,false);assert.equal(f.authenticated,false);assert.equal(f.service,true);assert.deepEqual(f.proconfig,['search_path=""'])}
  await db.exec('SET LOCAL ROLE service_role');
  await db.query(`SELECT count(*) FROM ${table}`);
  await db.exec('RESET ROLE');
  await db.exec('SAVEPOINT anonymous_projection_access; SET LOCAL ROLE anon');
  await assert.rejects(db.query(`SELECT * FROM ${table}`),/permission denied/);
  await db.exec('ROLLBACK TO SAVEPOINT anonymous_projection_access; RELEASE SAVEPOINT anonymous_projection_access');

  // Preserve the already-authorized source TRUNCATE command: no new CASCADE
  // keyword is needed, and no private rows survive it. Rollback restores fixture.
  await db.exec('TRUNCATE public.insight_notifications');
  assert.equal(Number((await db.query(`SELECT count(*) AS n FROM ${table}`)).rows[0].n),0);
  await ready();
 }finally{await db.exec('ROLLBACK')}
}
