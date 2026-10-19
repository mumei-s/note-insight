import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {PGlite} from '@electric-sql/pglite';
const read=path=>readFileSync(path,'utf8');
const migration=suffix=>read('supabase/migrations/'+readdirSync('supabase/migrations').find(name=>name.endsWith(suffix)));
const shopMigration=migration('_insight_notification_store_started.sql');
function classifier(name){const source=read(`supabase/functions/insight-notification-${name}/index.ts`),end=name==='ingest-v2'?source.indexOf('\nasync function identity'):source.indexOf('\nfunction noise');const context=vm.createContext({URL,actionText:v=>String(v),canonicalText:v=>String(v)});vm.runInContext(ts.transpileModule(source.slice(source.indexOf('const KIND_TYPES'),end)+'\nthis.classify=classify;',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);return context.classify}
for(const name of ['ingest-v2','reclassify'])test(name+': exact observed store_create kind is supported without shop-word guessing',()=>{
 const classify=classifier(name),text='テストさんがnoteでお店 をはじめました';
 assert.equal(classify(text,'https://note.com/test/store',{kind:'store_create'}),'store_started');
 assert.equal(classify('保存済み通知本文','https://note.com/test/store?kind=store_create',{}),'store_started');
 assert.equal(classify(text,'https://note.com/test/store',{}),'other');
 assert.equal(classify('お店の記事を紹介します',null,{}),'other');
 assert.equal(classify(text,'https://note.com/test/store',{kind:'store_create_unknown'}),'other');
 assert.equal(classify('お店の記事をマガジンに追加しました','https://note.com/test/m/mTest',{kind:'magazine_note_add_follow'}),'magazine_article_added');
});

test('recent-feed projection and completion identities retain IDs and handled flags for saved shop notices',()=>{
 const source=read('supabase/functions/insight-notification-feed-final/index.ts'),context=vm.createContext({URL,Date,Intl,Set,Map,actualCommentBody:()=>'',commentIdentity:()=>null});
 vm.runInContext(ts.transpileModule(source.slice(source.indexOf('const txt='),source.indexOf('async function commentRows('))+'\n'+source.slice(source.indexOf('const completionKey='),source.indexOf('async function notificationRow('))+'\nthis.api={currentFormat,completionKey,semanticKey};',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);
 for(const confirmed of [true,false])for(const identity of ['notice:9010','classification-independent-v2']){
  const row={id:9010,notification_type:'other',confirmed,raw_text:'テストさんがnoteでお店 をはじめました',target_url:'https://note.com/test/store',meta:{kind:'store_create',event_identity:identity}};
  const key=context.api.completionKey(row),next=context.api.currentFormat(row);
  assert.equal(next.notification_type,'store_started');assert.equal(next.id,row.id);assert.equal(next.confirmed,confirmed);assert.equal(next.meta.event_identity,identity);assert.equal(context.api.completionKey(next),key);assert.equal(context.api.semanticKey(next),context.api.semanticKey(row));
 }
});

test('DB migration backfills exact shop kinds and preserves handled flags, raw captures, event IDs and semantic keys',async t=>{
 const db=new PGlite();t.after(()=>db.close());
 await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;
 CREATE TABLE public.insight_notifications(id bigint PRIMARY KEY,member_id text,notification_type text,raw_text text,actor_name text,actor_url text,actor_image_url text,target_title text,target_url text,source_url text,occurred_at timestamptz,captured_at timestamptz,is_read boolean,meta jsonb,fingerprint text);
 CREATE TABLE public.insight_manual_completions(member_id text,creator_urlname text,item_type text,item_key text,PRIMARY KEY(member_id,creator_urlname,item_type,item_key));
 CREATE TABLE public.insight_favorite_creators(member_id text,creator_key text,actor_url text);
 CREATE TABLE public.insight_notification_sync_runs(member_id text,created_at timestamptz,inserted_count integer,received_count integer,source text);`);
 for(const name of ['_insight_notification_feed_page.sql','_insight_notification_prepared_key.sql','_insight_notification_displayable_groups.sql','_insight_notification_custom_plans.sql','_notification_context_classification_v28.sql'])await db.exec(migration(name));
 await db.exec('CREATE TRIGGER final_classification BEFORE INSERT OR UPDATE ON public.insight_notifications FOR EACH ROW EXECUTE FUNCTION public.apply_insight_notification_classification_v25();');
 const rows=[
  {id:9010,identity:'notice:9010',source:'note-notification-reader-v3'},
  {id:9011,identity:'notice:9011',source:'note-notification-reader-v3'},
  {id:9012,identity:'classification-independent-v2',source:'note-notification-reader-v3'}
 ].map(({id,identity,signature,source})=>({id,member_id:'owner',notification_type:'other',raw_text:`テスト${id}さんがnoteでお店 をはじめました`,actor_name:`テスト${id}`,actor_url:`https://note.com/test${id}`,target_url:`https://note.com/test${id}/store`,occurred_at:'2026-10-11T22:32:45.509Z',captured_at:'2026-10-11T22:32:45.509Z',is_read:id===9010,fingerprint:'unchanged-'+id,meta:{source,kind:'store_create',event_identity:identity,...(signature?{client_signature:signature}:{}),classifier:'action-v28-context',classified_type:'other',classification_status:'unmatched',reclassify_pending:false}}));
 rows.push({...rows[0],id:9013,raw_text:'お店に関する記事です',fingerprint:'unrelated',meta:{source:'note-notification-reader-v3',event_identity:'notice:9013',classifier:'action-v28-context',classified_type:'other'}},
  {...rows[0],id:9014,member_id:'foreign',fingerprint:'foreign-shop',meta:{...rows[0].meta,event_identity:'notice:9014'}},
  {...rows[0],id:9015,notification_type:'capture_noise',fingerprint:'noise-shop',meta:{...rows[0].meta,event_identity:'notice:9015',noise_reason:'non-notification-api-capture'}},
  {...rows[0],id:9016,notification_type:'capture_noise',fingerprint:'unverified-shell',meta:{...rows[0].meta,event_identity:'notice:9016',classified_type:'capture_noise',verified_shell:false}});
 await db.query(`INSERT INTO public.insight_notifications(id,member_id,notification_type,raw_text,actor_name,actor_url,target_url,occurred_at,captured_at,is_read,meta,fingerprint) SELECT id,member_id,notification_type,raw_text,actor_name,actor_url,target_url,occurred_at,captured_at,is_read,meta,fingerprint FROM jsonb_populate_recordset(NULL::public.insight_notifications,$1::jsonb)`,[JSON.stringify(rows)]);
 await db.exec("INSERT INTO public.insight_manual_completions VALUES ('owner','ss_yr','notification','notice:9010'),('owner','ss_yr','notification','row:9012'),('foreign','foreign','notification','notice:9014'); INSERT INTO public.insight_favorite_creators VALUES ('owner','test9010','https://note.com/test9010');");
 const stableSnapshot=async()=>({rows:(await db.query("SELECT id,member_id,fingerprint,raw_text,actor_name,actor_url,target_url,occurred_at,captured_at,is_read,meta->>'source' AS source,meta->>'event_identity' AS event_identity,insight_feed_key FROM public.insight_notifications ORDER BY id")).rows,completed:(await db.query('SELECT * FROM public.insight_manual_completions ORDER BY member_id,item_key')).rows,favorites:(await db.query('SELECT * FROM public.insight_favorite_creators ORDER BY member_id,creator_key')).rows});
 const page=async(kind='all',handling='all')=>(await db.query("SELECT public.insight_notification_feed_page(ARRAY['owner'],'owner','ss_yr',$1,'',$2,1,100,false) AS value",[kind,handling])).rows[0].value;
 const before=await stableSnapshot(),beforeAll=await page();await db.exec(shopMigration);assert.deepEqual(await stableSnapshot(),before);
 const afterAll=await page();assert.equal(afterAll.total,beforeAll.total);assert.deepEqual(afterAll.statusCounts,beforeAll.statusCounts);assert.deepEqual(afterAll.rows.filter(r=>r.id===9013),beforeAll.rows.filter(r=>r.id===9013));
 const unaffected=value=>Object.fromEntries(Object.entries(value).filter(([key])=>!['feedAt','rows','categoryCounts','unresolved','reclassifyPending'].includes(key)));assert.deepEqual(unaffected(afterAll),unaffected(beforeAll));
 const shops=await page('store_started');assert.equal(shops.total,3);assert.equal(shops.categoryCounts.store_started,3);assert.equal(shops.categoryCounts.other,1);assert.deepEqual(shops.statusCounts,{all:3,pending:1,completed:2});
 assert.equal(shops.rows.find(r=>r.id===9010).confirmed,true);assert.equal(shops.rows.find(r=>r.id===9011).confirmed,false);assert.equal(shops.rows.find(r=>r.id===9012).confirmed,true);assert.equal(shops.rows.find(r=>r.id===9010).favorite,true);
 assert.deepEqual(shops.rows.map(r=>r.id).sort(),[9010,9011,9012]);assert.equal((await page('store_started','completed')).total,2);assert.equal((await page('store_started','pending')).total,1);
 for(const id of [9015,9016])assert.equal((await db.query('SELECT notification_type FROM public.insight_notifications WHERE id=$1',[id])).rows[0].notification_type,'capture_noise');
 await db.exec('UPDATE public.insight_notifications SET is_read=NOT is_read WHERE id=9016');
 assert.equal((await db.query('SELECT notification_type FROM public.insight_notifications WHERE id=9016')).rows[0].notification_type,'capture_noise','ordinary updates must not revive an unverified capture shell');
 const foreign=(await db.query("SELECT public.insight_notification_feed_page(ARRAY['foreign'],'foreign','foreign','store_started','','all',1,100,false) AS value")).rows[0].value;assert.equal(foreign.total,1);assert.equal(foreign.rows[0].confirmed,true);
 // Fresh captures must survive the final trigger even when older classifiers supplied other.
 await db.exec("INSERT INTO public.insight_notifications(id,member_id,notification_type,raw_text,target_url,captured_at,meta) VALUES (9020,'owner','other','テストさんがnoteでお店 をはじめました','https://note.com/new/store','2026-10-19','{\"kind\":\"store_create\",\"event_identity\":\"notice:9020\",\"classifier\":\"action-v28-context\",\"classified_type\":\"other\"}');");
 const fresh=(await db.query('SELECT notification_type,insight_feed_key FROM public.insight_notifications WHERE id=9020')).rows[0];assert.equal(fresh.notification_type,'store_started');assert.equal(fresh.insight_feed_key,'notice|notice:9020');
 const config=(await db.query("SELECT proconfig FROM pg_proc WHERE proname='insight_notification_feed_page'")).rows[0].proconfig;assert.deepEqual(config,['search_path=""','plan_cache_mode=force_custom_plan']);
});
