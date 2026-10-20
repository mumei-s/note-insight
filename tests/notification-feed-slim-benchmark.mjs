
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import ts from 'typescript';
import {PGlite} from '@electric-sql/pglite';

// The frozen oracle runs in the UTC Edge runtime, including Date.parse(0).
process.env.TZ='UTC';
const root='supabase/functions/insight-notification-feed-final/index.ts';
const migration=readFileSync('supabase/migrations/'+readdirSync('supabase/migrations').find(n=>n.endsWith('_insight_notification_feed_page.sql')),'utf8');
const preparedName=readdirSync('supabase/migrations').find(n=>n.endsWith('_insight_notification_prepared_key.sql'));
assert.ok(preparedName,'the prepared-key migration is required by the feed RPC contract');
const preparedMigration=readFileSync('supabase/migrations/'+preparedName,'utf8');
const prunedName=readdirSync('supabase/migrations').find(n=>n.endsWith('_insight_notification_displayable_groups.sql'));
assert.ok(prunedName,'the excluded-only semantic-group pruning migration is required');
const prunedMigration=readFileSync('supabase/migrations/'+prunedName,'utf8');
const customPlanName=readdirSync('supabase/migrations').find(n=>n.endsWith('_insight_notification_custom_plans.sql'));
assert.ok(customPlanName,'the function-scoped custom-plan migration is required');
const customPlanMigration=readFileSync('supabase/migrations/'+customPlanName,'utf8');
const storeName=readdirSync('supabase/migrations').find(n=>n.endsWith('_insight_notification_store_started.sql'));
assert.ok(storeName,'the observed store-create notification migration is required');
const storeMigration=readFileSync('supabase/migrations/'+storeName,'utf8');
const context=vm.createContext({URL,Date,Intl,Set,Map});
vm.runInContext(ts.transpileModule(readFileSync('tests/fixtures/notification-feed-before.ts','utf8')+'\nglobalThis.oracle={dedupe,decorateHandling,selectHandling,explicitManual,useful,semanticKey};',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);
const oracle=context.oracle;
const member={id:'owner-app',scope:'owner',noteId:'ss_yr'},other={id:'participant',scope:'participant',noteId:'participant'};
const columns='id,member_id,notification_type,raw_text,actor_name,actor_url,actor_image_url,target_title,target_url,source_url,occurred_at,captured_at,is_read,meta';
 const db=new PGlite();
 await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;
  CREATE TABLE public.insight_notifications(id bigint PRIMARY KEY,member_id text,notification_type text,raw_text text,actor_name text,actor_url text,actor_image_url text,target_title text,target_url text,source_url text,occurred_at timestamptz,captured_at timestamptz,is_read boolean,meta jsonb);
  CREATE INDEX feed_scope_order ON public.insight_notifications(member_id,captured_at DESC,id);
  CREATE TABLE public.insight_manual_completions(member_id text,creator_urlname text,item_type text,item_key text,PRIMARY KEY(member_id,creator_urlname,item_type,item_key));
  CREATE TABLE public.insight_favorite_creators(member_id text,creator_key text,actor_url text);
  CREATE TABLE public.insight_notification_sync_runs(member_id text,created_at timestamptz,inserted_count integer,received_count integer,source text);
 `);
 await db.exec(migration);
 await db.exec(preparedMigration);
 await db.exec(prunedMigration);
 await db.exec(customPlanMigration);
 await db.exec(storeMigration);

// Manual local-only benchmark. Never points at a Supabase project.
// Run: node tests/notification-feed-slim-benchmark.mjs [report.json]
const replacement=readFileSync('supabase/migrations/20261020195704_insight_notification_slim_groups.sql','utf8');
const report={engine:'PGlite',rows:60000,scenarios:[]};
for(const [name,count,kind,identity] of [
 ['mostly-excluded',60000,"CASE WHEN i%10=0 THEN 'badge' ELSE 'like' END","'notice:'||i"],
 ['mostly-visible',60000,"CASE WHEN i%10<>0 THEN 'badge' ELSE 'like' END","'notice:'||i"],
 ['three-row-duplicates',60000,"'badge'","'notice:'||(i/3)"],
 ['one-skewed-group',1000,"'badge'","'notice:1'"]
]){
 await db.exec('TRUNCATE public.insight_notifications');
 await db.exec(`INSERT INTO public.insight_notifications(id,member_id,notification_type,raw_text,actor_name,actor_url,target_url,occurred_at,captured_at,meta)
 SELECT i,'owner',${kind},'notice '||i,'actor '||i,'https://note.com/peer'||i,'https://note.com/ss_yr/n/nArticle','2026-10-20'::timestamptz,'2026-10-20'::timestamptz-i*interval '1 second',jsonb_build_object('source','note-notification-reader-v3','event_identity',${identity},'classifier','action-v28-context','recovery_version','evidence-v2-articles') FROM generate_series(1,${count})i; ANALYZE;`);
 let baseline;const entry={name,rows:count};
 for(const [label,sql] of [['baseline',storeMigration],['candidate',replacement]]){
  if(label==='candidate' && report.scenarios.length>0)await db.exec(sql.slice(sql.indexOf('CREATE OR REPLACE FUNCTION public.insight_notification_feed_page(')));else await db.exec(sql); const times=[];
  for(let i=0;i<4;i++){
   const started=performance.now();const result=(await db.query("SELECT public.insight_notification_feed_page(ARRAY['owner','owner-app'],'owner','ss_yr','all','','all',1,100,false) AS r")).rows[0].r;
   const elapsed=performance.now()-started;delete result.feedAt;
   if(!baseline)baseline=result;else assert.deepEqual(result,baseline,name+' complete response parity');
   if(i)times.push(Math.round(elapsed*1000)/1000);
  }
  entry[label]={milliseconds:times,medianMs:[...times].sort((a,b)=>a-b)[1]};
 }
 entry.ratio=entry.candidate.medianMs/entry.baseline.medianMs;report.scenarios.push(entry);console.log(JSON.stringify(entry));
}
await db.close();
writeFileSync(process.argv[2]||'/tmp/notification-feed-slim-benchmark.json',JSON.stringify(report,null,2)+'\n');
