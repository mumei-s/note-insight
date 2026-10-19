import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync,readdirSync} from 'node:fs';
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
const context=vm.createContext({URL,Date,Intl,Set,Map});
vm.runInContext(ts.transpileModule(readFileSync('tests/fixtures/notification-feed-before.ts','utf8')+'\nglobalThis.oracle={dedupe,decorateHandling,selectHandling,explicitManual,useful,semanticKey};',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);
const oracle=context.oracle;
const member={id:'owner-app',scope:'owner',noteId:'ss_yr'},other={id:'participant',scope:'participant',noteId:'participant'};
const columns='id,member_id,notification_type,raw_text,actor_name,actor_url,actor_image_url,target_title,target_url,source_url,occurred_at,captured_at,is_read,meta';
let db;
before(async()=>{
 db=new PGlite();
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
});
after(async()=>{await db?.close()});
async function insert(rows){
 await db.query(`INSERT INTO public.insight_notifications(${columns}) SELECT ${columns} FROM jsonb_populate_recordset(NULL::public.insight_notifications,$1::jsonb)`,[JSON.stringify(rows)]);
}
async function checkPreparedKeys(ids){
 const rows=(await db.query(`SELECT to_jsonb(n)-'insight_feed_key' AS n,insight_feed_key AS key FROM public.insight_notifications n WHERE member_id=ANY($1)`,[ids])).rows;
 for(const {n,key} of rows){
  const eligible=(!['comment','reply'].includes(n.notification_type)||oracle.explicitManual(String(n.meta?.source||'')))&&oracle.useful(n);
  assert.equal(key,eligible?oracle.semanticKey(n):null,'stored key '+n.id);
 }
}
const row=(id,patch={})=>({id,member_id:id%2?'owner':'owner-app',notification_type:'other',raw_text:'通知 '+id,actor_name:'actor '+id,actor_url:'https://note.com/peer'+id,actor_image_url:null,target_title:null,target_url:'https://note.com/ss_yr/n/nArticle',source_url:null,occurred_at:'2026-10-16T15:05:00.123Z',captured_at:new Date(Date.parse('2026-10-17T00:00:00Z')-id*1000).toISOString(),is_read:false,meta:{source:'note-notification-reader-v3',event_identity:'notice:'+id,classifier:'action-v28-context',recovery_version:'evidence-v2-articles'},...patch});
async function sqlPage(m=member,options={}){
 const {kind='all',day='',handlingStatus='all',page=1,pageSize=100,includeCategoryPreview=false}=options;
 return (await db.query('SELECT public.insight_notification_feed_page($1,$2,$3,$4,$5,$6,$7,$8,$9) AS result',[m.scope===m.id?[m.id]:[m.scope,m.id],m.scope,m.noteId,kind,day,handlingStatus,page,pageSize,includeCategoryPreview])).rows[0].result;
}
async function expected(m=member,options={}){
 const ids=m.scope===m.id?[m.id]:[m.scope,m.id];
 const raw=(await db.query(`SELECT to_jsonb(n) AS n FROM(SELECT ${columns} FROM public.insight_notifications WHERE member_id=ANY($1) ORDER BY captured_at DESC,id ASC) n`,[ids])).rows.map(r=>r.n);
 const completions=new Set((await db.query("SELECT item_key FROM public.insight_manual_completions WHERE member_id=$1 AND creator_urlname=$2 AND item_type='notification'",[m.scope,m.noteId])).rows.map(r=>r.item_key));
 const favorites=(await db.query('SELECT creator_key,actor_url FROM public.insight_favorite_creators WHERE member_id=$1',[m.scope])).rows;
 const rows=oracle.decorateHandling(oracle.dedupe(raw.filter(r=>!['comment','reply'].includes(r.notification_type)||oracle.explicitManual(String(r.meta?.source||'')))).filter(r=>!['like','follow','comment'].includes(r.notification_type)),m,completions,favorites);
 const {kind='all',day='',handlingStatus='all',page=1,pageSize=100,includeCategoryPreview=false}=options;
 const validDay=/^\d{4}-\d{2}-\d{2}$/.test(day||'')?day:'';
 const handling=['pending','completed'].includes(handlingStatus)?handlingStatus:'all';
 const {dated,selected,statusCounts}=oracle.selectHandling(rows,kind??'all',validDay,handling);
 const categoryCounts={all:dated.length},categoryPreview={};
 for(const r of dated){categoryCounts[r.display_category]=(categoryCounts[r.display_category]||0)+1;if(includeCategoryPreview){const group=categoryPreview[r.display_category]||=[];if(group.length<12)group.push(r)}}
 return JSON.parse(JSON.stringify({page,pageSize,total:selected.length,rows:selected.slice((page-1)*pageSize,page*pageSize),categoryCounts,categoryPreview,statusCounts,handlingStatus:handling,unknownKinds:[],unresolved:{remaining:rows.filter(r=>r.notification_type==='other').length,insufficient:rows.filter(r=>r.notification_type==='other'&&r.meta?.classification_status==='insufficient_evidence').length},reclassifyPending:rows.filter(r=>r.notification_type==='other'&&(r.meta?.reclassify_pending||r.meta?.classifier!=='action-v28-context'||r.meta?.recovery_version!=='evidence-v2-articles')).length,noteId:m.noteId,selectedDay:validDay||null}));
}
async function equivalent(m,options){
 const actual=await sqlPage(m,options),want=await expected(m,options);
 for(const key of Object.keys(want))assert.deepEqual(actual[key],want[key],key+' '+JSON.stringify(options));
 assert.equal(actual.ok,true);assert.equal(actual.classifierVersion,'action-v28-context');assert.ok(Number.isFinite(Date.parse(actual.feedAt)));
 return actual;
}

test('empty page contract, explicit bounds and service-only invoker privileges',async()=>{
 await equivalent(member,{});
 const {rows:[rights]}=await db.query("SELECT prosecdef,provolatile,proconfig,has_function_privilege('anon',oid,'EXECUTE') AS anon,has_function_privilege('authenticated',oid,'EXECUTE') AS authenticated,has_function_privilege('service_role',oid,'EXECUTE') AS service FROM pg_proc WHERE proname='insight_notification_feed_page'");
 assert.equal(rights.prosecdef,false);assert.equal(rights.provolatile,'s');assert.deepEqual(rights.proconfig,['search_path=""','plan_cache_mode=force_custom_plan']);assert.equal(rights.anon,false);assert.equal(rights.authenticated,false);assert.equal(rights.service,true);
 for(const params of [[[],member.scope,member.noteId,1,100],[['owner'],'wrong',member.noteId,1,100],[['owner'],'owner','',1,100],[['owner'],'owner','ss_yr',0,100],[['owner'],'owner','ss_yr',1000001,100],[['owner'],'owner','ss_yr',1,101],[['owner'],'owner','ss_yr',1,19]]){
  await assert.rejects(db.query("SELECT public.insight_notification_feed_page($1,$2,$3,'all','','all',$4,$5,false)",params),/INVALID_NOTIFICATION_FEED_PARAMETERS/);
 }
});

test('SQL matches the frozen JavaScript oracle for classification, scope, JST, status, favorites, comments and previews',async()=>{
 const types=['other','reply','comment_like','membership_reaction','badge','purchase_message','my_article_magazine_added','tip','membership_join','membership_board','membership_board_reply','creator_article_posted','like','follow','comment','capture_noise','quote'];
 const rows=Array.from({length:220},(_,i)=>row(i+1,{notification_type:types[i%types.length],target_url:i%4===0?'https://note.com/elsewhere/n/nOther':i%4===1?'https://note.com/ss_yr/membership':i%4===2?'https://note.com/joined/membership':null,occurred_at:i%7===0?'2026-10-16T14:59:59.999999Z':i%7===1?'2026-10-16T15:00:00.000001Z':null}));
 rows.push(
  row(1001,{raw_text:'   ',meta:{source:'note-notification-reader-v3'}}),
  row(1002,{meta:{source:'canonical-public-comments',comment_body:'not a browser notice'}}),
  row(1003,{meta:{noise_reason:'non-notification-api-capture'}}),
  row(1004,{notification_type:'reply',meta:{source:'automatic-capture'}}),
  row(1005,{notification_type:'other',meta:{kind:'qa_answer'}}),
  row(1006,{notification_type:'other',meta:{kind:'stock_photo',actionUsers:[{name:'Photo author',url:'https://note.com/photographer',profileImageUrl:'https://image.invalid/photo'}]}}),
  row(1007,{notification_type:'other',raw_text:'Aさんが記事を更新しました',meta:{featured_content_name:'New title',action_users:[{nickname:'Writer',profile_url:'https://note.com/writer'}]}}),
  row(1008,{notification_type:'quote',raw_text:'あなたの記事 が 話題になりました'}),
  row(1009,{notification_type:'other',meta:{kind:'user_badge'},raw_text:'記事であなたの画像を使用しました'}),
  row(1010,{notification_type:'other',meta:{kind:'thank_you_message'}}),
  row(1011,{notification_type:'reply',target_url:'https://note.com/ss_yr/n/nA?scrollpos=comment&c=ncA1',meta:{source:'note-notification-bottom-up-v2970',comment_body:'exact comment'}}),
  row(1012,{notification_type:'reply',target_url:'https://elsewhere.invalid/a/n/nA?c=ncWrong',meta:{source:'note-notification-explicit-sync',all_area_url:'https://note.com/a/n/nA?c=%6e%63A2'}}),
  row(1013,{notification_type:'reply',target_url:'https://note.com/a/n/nA?c=&c=ncWrong',meta:{source:'note-notification-reader-v11',body:'not exact comment text'}}),
  row(1014,{actor_url:'https://note.com/M',meta:null}),
  row(1015,{actor_url:'https://note.com/m',meta:{}}),
  row(1016,{notification_type:'other',occurred_at:null,captured_at:null,target_url:null,actor_url:null,actor_name:null,meta:null}),
  row(1017,{member_id:'participant',raw_text:'participant only',meta:{source:'note-notification-reader-v3',event_identity:'notice:1017'}}),
  row(1018,{member_id:'unrelated',raw_text:'must never appear'}),
  row(1019,{notification_type:'reply',target_url:'https://note.com/a/n/nA?C=ncWrong&c=ncRight'}),
  row(1020,{notification_type:'reply',target_url:'https://note.com/a/n/nA?c&c=ncWrong'}),
  row(1021,{notification_type:'other',raw_text:'Aさんが\n記事を更新しました'}),
  row(1022,{notification_type:'other',raw_text:'Aさんが\u2028記事を更新しました'}),
  row(1023,{notification_type:'quote',raw_text:'あなたの記事\u00a0が\ufeff話題です'}),
  row(1024,{actor_url:null,actor_name:null,meta:{action_users:[{url:0,profile_url:false,name:false,nickname:'Fallback',unused:'must remain in payload'},{name:'not first'}],unknown:{keep:['all','fields']}}}),
  row(1025,{meta:['array',{unknown:true}]}),
  row(1026,{raw_text:'duplicate array meta',actor_url:'https://note.com/array',meta:['first',{a:1}]}),
  row(1027,{raw_text:'duplicate array meta',actor_url:'https://note.com/array',meta:['second',{a:2}]}),
  row(1030,{meta:{body:{text:'記事であなたの画像を使用しました'},comment_body:{text:'object must use JS String'}}}),
  row(1031,{meta:{body:[{text:'記事であなたの画像を使用しました'}],comment_body:['first',null,['second',null],{text:'object'}]}}),
  row(1032,{meta:{body:[],comment_body:false},raw_text:'記事であなたの画像を使用しました'}),
  row(1033,{meta:{body:'ordinary body',comment_body:0}}),
  row(1034,{meta:{body:'ordinary body',comment_body:42}}),
  row(1035,{meta:{event_identity:['notice:333'],body:'array identity notice'}}),
  row(1036,{target_url:'',source_url:''})
 );
 // A grows richer after B is merged, so C must not replace A despite its larger raw score.
 rows.push(row(2001,{actor_name:'A',actor_url:'https://note.com/A',actor_image_url:'image A',target_url:'https://note.com/a/n/nA',occurred_at:null,meta:{client_signature:'greedy',unknown:'A',onlyA:{a:1},nullable:null}}),row(2002,{actor_name:null,actor_url:null,target_url:null,occurred_at:null,meta:{client_signature:'greedy',body:'B body',unknown:'B',onlyB:['b'],nullable:'B'}}),row(2003,{actor_name:null,actor_url:null,target_url:null,target_title:'C title',occurred_at:null,meta:{client_signature:'greedy',body:'C body',unknown:'C',onlyC:false,nullable:'C'}}));
 rows.push(row(2051,{actor_image_url:'image A',target_title:null,meta:{client_signature:'image-rich-switch'}}),row(2052,{actor_image_url:null,target_title:'B title',meta:{client_signature:'image-rich-switch',body:'B body'}}),row(2053,{actor_image_url:'image C',target_title:'C title',meta:{client_signature:'image-rich-switch',body:'C body'}}));
 rows.push(row(2061,{actor_image_url:'null-kind image',meta:{client_signature:'explicit-known-null',body:'ordinary body',kind:null}}),row(2062,{meta:{client_signature:'explicit-known-null',kind:'stock_photo'}}));
 rows.push(row(2011,{notification_type:'like',meta:{client_signature:'cross-type',source:'note-notification-reader-v3',body:'rich raw like'}}),row(2012,{notification_type:'other',meta:{client_signature:'cross-type'}}));
 rows.push(row(2021,{meta:{source:'note-notification-reader-v3',event_identity:'notice:777'}}),row(2022,{meta:{source:'note-notification-reader-v3',event_identity:'notice:777',comment_body:'merged body'}}));
 rows.push(...[[],{},['x',['y',null],'z'],false,0,''].flatMap((signature,i)=>[row(2031+i*2,{meta:{client_signature:signature}}),row(2032+i*2,{meta:{client_signature:signature}})]));
 await insert(rows);
 await checkPreparedKeys(['owner','owner-app','participant','unrelated']);
 await db.exec(`INSERT INTO public.insight_manual_completions VALUES ('owner','ss_yr','notification','notice:1'),('owner','ss_yr','notification','notice:333'),('owner','ss_yr','notification','row:1011'),('owner-app','ss_yr','notification','notice:2'),('owner','elsewhere','notification','notice:3'),('owner','ss_yr','like','notice:4'),('participant','participant','notification','notice:1017');
 INSERT INTO public.insight_favorite_creators VALUES ('owner','alias-a','https://note.com/A'),('owner','legacy-peer','https://note.com/peer1'),('owner','m','https://note.com/M'),('participant','peer2','https://note.com/peer2');
 INSERT INTO public.insight_notification_sync_runs VALUES ('owner','2026-10-17T00:10:00Z',4,12,'browser-notification-stable-v3-confirmed'),('owner-app','2026-10-17T00:11:00Z',2,8,'browser-notification-stable-v3-confirmed'),('unrelated','2026-10-18',999,999,'browser-notification-stable-v3-confirmed'),('owner','2026-10-19',999,999,'other-source');`);
 const options=[{}, {page:2,pageSize:20,includeCategoryPreview:true}, {page:99}, {kind:'reply_self'},{kind:'reply_other',day:'2026-10-17',includeCategoryPreview:true},{kind:'membership_reaction_self'},{kind:'membership_reaction_joined'},{kind:'membership_reaction_unknown'}, {kind:'question_answer'}, {kind:'badge'}, {kind:'not-known'}, {kind:''}, {kind:null,day:'2026-99-99'}, {handlingStatus:'pending',day:'2026-10-16',includeCategoryPreview:true},{handlingStatus:'completed',includeCategoryPreview:true},{kind:'reply_self',handlingStatus:'completed'},{day:'not a day'},{day:null}];
 for(const option of options)await equivalent(member,option);
 await equivalent(other,{includeCategoryPreview:true});await equivalent({id:'empty',scope:'empty',noteId:'empty'},{});
 const full=await equivalent(member,{pageSize:100,includeCategoryPreview:true});
 assert.equal(full.lastSyncInserted,2);assert.equal(full.lastSyncReceived,8);assert.equal(full.lastSyncSource,'browser-notification-stable-v3-confirmed');
 const greedy=(await sqlPage(member,{kind:'other'})).rows.find(r=>r.id===2001);
 assert.ok(greedy);assert.equal(greedy.meta.body,'B body');assert.equal(greedy.target_title,'C title');
 const cases=(await sqlPage(member,{kind:'other'})).rows;
 assert.equal(cases.find(r=>r.id===1030)?.comment_body,'[object Object]');
 assert.equal(cases.find(r=>r.id===1031)?.comment_body,'first,,second,,[object Object]');
 assert.equal(cases.find(r=>r.id===1032)?.comment_body,null);
 assert.equal(cases.find(r=>r.id===1033)?.comment_body,null);
 assert.equal(cases.find(r=>r.id===1034)?.comment_body,'42');
 assert.equal(cases.find(r=>r.id===1035)?.confirmed,true);assert.equal(cases.find(r=>r.id===1036)?.target_url,'');assert.equal(cases.find(r=>r.id===1036)?.source_url,'');assert.equal(cases.find(r=>r.id===2061)?.notification_type,'other');
 const switched=cases.find(r=>r.id===2052);assert.ok(switched);assert.equal(switched.actor_image_url,'image A');assert.equal(switched.meta.body,'B body');
});

test('prepared keys are stored, service-only, timezone independent and follow inserts, updates, deletion and BEFORE triggers',async()=>{
 const {rows:[schema]}=await db.query(`SELECT a.attgenerated,t.typname,c.collname,p.provolatile,p.prosecdef,p.proparallel,p.proconfig,
  has_function_privilege('anon',p.oid,'EXECUTE') AS anon,has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated,has_function_privilege('service_role',p.oid,'EXECUTE') AS service
  FROM pg_attribute a JOIN pg_type t ON t.oid=a.atttypid JOIN pg_collation c ON c.oid=a.attcollation
  CROSS JOIN pg_proc p WHERE a.attrelid='public.insight_notifications'::regclass AND a.attname='insight_feed_key' AND p.proname='insight_notification_feed_key'`);
 assert.equal(schema.attgenerated,'s');assert.equal(schema.typname,'text');assert.equal(schema.collname,'C');
 assert.equal(schema.provolatile,'i');assert.equal(schema.prosecdef,false);assert.equal(schema.proparallel,'s');assert.deepEqual(schema.proconfig,['search_path=""']);
 assert.equal(schema.anon,false);assert.equal(schema.authenticated,false);assert.equal(schema.service,true);
 const m={id:'prepared',scope:'prepared',noteId:'prepared'};
 let current=row(900001,{member_id:m.id,raw_text:'保存した通知',occurred_at:null,captured_at:'2026-10-17T00:00:00Z',meta:{source:'note-notification-reader-v3'}});
 await insert([current]);
 const key=async()=>{await checkPreparedKeys([m.id]);await equivalent(m,{includeCategoryPreview:true});return(await db.query('SELECT insight_feed_key AS key FROM public.insight_notifications WHERE id=$1',[current.id])).rows[0]?.key};
 let previous=await key();assert.ok(previous);
 const writable=columns.split(',').filter(n=>n!=='id').join(',');
 async function change(patch,shouldChange=true){
  current={...current,...patch};
  await db.query(`UPDATE public.insight_notifications SET (${writable})=(SELECT ${writable} FROM jsonb_populate_record(NULL::public.insight_notifications,$2::jsonb)) WHERE id=$1`,[current.id,JSON.stringify(current)]);
  const next=await key();if(shouldChange)assert.notEqual(next,previous);else assert.equal(next,previous);previous=next;
 }
 await change({raw_text:'通知の本文を変更しました'});
 await change({actor_url:'https://note.com/changed?x=1#part'});
 await change({actor_url:null,actor_name:'Fallback NAME'});
 await change({target_url:'https://note.com/another/n/nChanged'});
 await change({target_url:null,source_url:'https://note.com/source/n/nSource'});
 await change({notification_type:'my_article_magazine_added',source_url:null,target_title:'first magazine'});
 await change({target_title:'updated magazine'});
 await change({occurred_at:'2026-10-17T01:00:00Z'});
 await change({occurred_at:null,captured_at:'2026-10-17T02:00:00Z'});
 await change({meta:{source:'note-notification-reader-v3',event_identity:'notice:changed'}});
 await change({meta:{source:'note-notification-reader-v3',client_signature:['prepared',['nested',null]]}});
 await change({meta:{source:'canonical-public-comments'}});assert.equal(previous,null);
 await change({notification_type:'reply',meta:{source:'automatic-capture'}},false);
 await change({meta:{source:'note-notification-reader-v3',body:'new body'}});assert.ok(previous);
 await change({meta:{source:'note-notification-reader-v3',noise_reason:'non-notification-api-capture'}});assert.equal(previous,null);
 await change({notification_type:'other',meta:{source:'note-notification-reader-v3'}});assert.ok(previous);
 await change({meta:{source:'note-notification-reader-v3',body:'記事であなたの画像を使用しました'}},false);
 assert.equal((await sqlPage(m)).rows[0]?.notification_type,'image_used');
 await db.exec("SET TIME ZONE 'Asia/Tokyo'");
 const tokyo=(await db.query('SELECT public.insight_notification_feed_key(notification_type,raw_text,actor_name,actor_url,target_title,target_url,source_url,occurred_at,captured_at,meta) AS key FROM public.insight_notifications WHERE id=$1',[current.id])).rows[0].key;
 await db.exec("SET TIME ZONE 'America/New_York'");
 const ny=(await db.query('SELECT public.insight_notification_feed_key(notification_type,raw_text,actor_name,actor_url,target_title,target_url,source_url,occurred_at,captured_at,meta) AS key FROM public.insight_notifications WHERE id=$1',[current.id])).rows[0].key;
 assert.equal(tokyo,ny);assert.equal(tokyo,previous);await db.exec("SET TIME ZONE 'UTC'");
 await db.query('DELETE FROM public.insight_notifications WHERE id=$1',[current.id]);assert.equal((await equivalent(m,{})).total,0);
 await db.exec(`CREATE FUNCTION public.feed_test_before() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN IF NEW.member_id='prepared-trigger' THEN NEW.notification_type='other';NEW.meta=jsonb_build_object('source','note-notification-reader-v3','event_identity','notice:'||NEW.raw_text);END IF;RETURN NEW;END $$;
  CREATE TRIGGER feed_test_before BEFORE INSERT OR UPDATE ON public.insight_notifications FOR EACH ROW EXECUTE FUNCTION public.feed_test_before();`);
 await insert([row(900002,{member_id:'prepared-trigger',notification_type:'capture_noise',raw_text:'before-insert',meta:{source:'canonical-public-comments'}})]);
 assert.equal((await db.query('SELECT insight_feed_key AS key FROM public.insight_notifications WHERE id=900002')).rows[0].key,'notice|notice:before-insert');
 await db.exec("UPDATE public.insight_notifications SET raw_text='before-update' WHERE id=900002");
 assert.equal((await db.query('SELECT insight_feed_key AS key FROM public.insight_notifications WHERE id=900002')).rows[0].key,'notice|notice:before-update');
 await checkPreparedKeys(['prepared-trigger']);await db.exec('DROP TRIGGER feed_test_before ON public.insight_notifications;DROP FUNCTION public.feed_test_before();');
});

test('every visible notification category returns its counted rows, including high ratings outside the first all page',async()=>{
 const m={id:'category-fixture',scope:'category-fixture',noteId:'category_fixture'};
 const cats=JSON.parse(readFileSync('src/member-insight-notifications-final.tsx','utf8').match(/const CATS=(\[\[.*?\]\]) as const/s)[1]).map(([kind])=>kind).filter(kind=>kind!=='all');
 const counts=new Map(),rows=[];let id=810000;
 // Older rating rows deliberately fall outside the initial 100-row all view.
 for(const kind of ['rating',...cats.filter(kind=>kind!=='rating')]){
  const count=kind==='rating'?20:6;counts.set(kind,count);
  for(let i=0;i<count;i++){
   const type=kind.startsWith('reply_')?'reply':kind.startsWith('membership_reaction_')?'membership_reaction':kind;
   const target=kind==='reply_other'?'https://note.com/other/n/nOther':kind==='reply_unknown'?null:kind==='membership_reaction_self'?`https://note.com/${m.noteId}/membership`:kind==='membership_reaction_joined'?'https://note.com/other/membership':kind==='membership_reaction_unknown'?null:`https://note.com/${m.noteId}/n/nArticle`;
   rows.push(row(++id,{member_id:m.id,notification_type:type,raw_text:`保存済み ${kind} 通知 ${i}`,target_url:target,captured_at:new Date(Date.parse('2026-10-19T00:00:00Z')+id).toISOString()}));
  }
 }
 await insert(rows);
 const all=await equivalent(m,{includeCategoryPreview:true});
 assert.equal(all.total,rows.length);assert.equal(all.rows.length,100);assert.ok(all.rows.every(r=>r.display_category!=='rating'));
 for(const kind of cats){
  const result=await equivalent(m,{kind,includeCategoryPreview:true});
  assert.equal(result.categoryCounts[kind],counts.get(kind),kind+' category count');
  assert.equal(result.total,counts.get(kind),kind+' selected total');
  assert.equal(result.rows.length,counts.get(kind),kind+' nonempty selected page');
  assert.equal(result.statusCounts.all,counts.get(kind),kind+' selected status count');
  assert.ok(result.rows.every(r=>r.display_category===kind),kind+' display category');
 }
});

test('custom notification planning is function-scoped and restores the caller plan mode',async()=>{
 const m={id:'category-fixture',scope:'category-fixture',noteId:'category_fixture'};
 await db.exec('SET plan_cache_mode=force_generic_plan');
 try{
  const before=(await db.query("SELECT current_setting('plan_cache_mode') AS mode")).rows[0].mode;
  assert.equal(before,'force_generic_plan');
  const result=await equivalent(m,{kind:'rating',includeCategoryPreview:true});
  assert.equal(result.total,20);assert.equal(result.rows.length,20);
  assert.equal((await db.query("SELECT current_setting('plan_cache_mode') AS mode")).rows[0].mode,before);
 }finally{await db.exec('RESET plan_cache_mode')}
 assert.equal((await db.query("SELECT current_setting('plan_cache_mode') AS mode")).rows[0].mode,'auto');
});

test('early pruning skips excluded-only groups while retaining richer excluded rows in mixed groups and scope isolation',async()=>{
 const m={id:'prune-fixture',scope:'prune-fixture',noteId:'prune_fixture'};
 const meta=signature=>({source:'note-notification-reader-v3',client_signature:signature,classifier:'action-v28-context',recovery_version:'evidence-v2-articles'});
 await insert([
  row(820001,{member_id:m.id,notification_type:'rating',meta:{...meta('rating-wins'),body:'authoritative rating body'}}),
  row(820002,{member_id:m.id,notification_type:'like',actor_image_url:'https://images.invalid/retained.png',meta:meta('rating-wins')}),
  row(820003,{member_id:m.id,notification_type:'rating',actor_image_url:'https://images.invalid/weaker.png',meta:meta('excluded-wins')}),
  row(820004,{member_id:m.id,notification_type:'comment',meta:{...meta('excluded-wins'),body:'richer excluded winner'}}),
  row(820005,{member_id:m.id,notification_type:'follow',meta:meta('foreign-scope')}),
  row(820006,{member_id:'prune-foreign',notification_type:'rating',meta:meta('foreign-scope')})
 ]);
 await db.exec(`INSERT INTO public.insight_notifications(${columns}) SELECT 830000+i,'prune-fixture',CASE i%3 WHEN 0 THEN 'like' WHEN 1 THEN 'follow' ELSE 'comment' END,'保存済みの除外対象 '||i,'excluded peer','https://note.com/excluded',NULL,NULL,NULL,NULL,'2026-10-19'::timestamptz,'2026-10-19'::timestamptz-i*interval '1 second',false,jsonb_build_object('source','note-notification-reader-v3','client_signature','excluded-only-'||i) FROM generate_series(1,2000) i;`);
 const result=await equivalent(m,{includeCategoryPreview:true});
 assert.equal(result.total,1);assert.equal(result.rows[0].id,820001);
 assert.equal(result.rows[0].actor_image_url,'https://images.invalid/retained.png');
 assert.equal(result.rows[0].meta.body,'authoritative rating body');
 assert.equal((await equivalent({id:'prune-foreign',scope:'prune-foreign',noteId:'prune_foreign'},{})).total,1);
 // Inspect actual source cardinality rather than a timing threshold: history
 // consisting only of excluded kinds must not enter metadata decode/window work.
 let inner=prunedMigration.split('  RETURN (')[1].split('\n  );\nEND;')[0];
 const parameters={p_member_ids:"ARRAY['prune-fixture']::text[]",p_scope:"'prune-fixture'::text",p_note_id:"'prune_fixture'::text",v_kind:"'all'::text",v_day:"''::text",v_handling:"'all'::text",p_page_size:'100',p_page:'1',p_preview:'false'};
 for(const [name,value] of Object.entries(parameters))inner=inner.replace(new RegExp('\\b'+name+'\\b','g'),value);
 const plan=(await db.query('EXPLAIN (ANALYZE,FORMAT JSON) '+inner)).rows[0]['QUERY PLAN'][0].Plan;
 function findSource(node){return node['Subplan Name']==='CTE source_order'?node:(node.Plans||[]).map(findSource).find(Boolean)}
 assert.equal(findSource(plan)?.['Actual Rows'],4,'only both complete mixed semantic groups enter source metadata decode');
});

test('20k-row history has exact late pages and a bounded row payload',async()=>{
 await db.exec(`INSERT INTO public.insight_notifications(${columns}) SELECT 100000+i,'large','membership_board_reply','掲示板に返信がありました','large peer','https://note.com/large_peer',NULL,'board',NULL,NULL,'2026-10-17'::timestamptz-i*interval '1 second','2026-10-17'::timestamptz-i*interval '1 second',false,jsonb_build_object('source','note-notification-reader-v3','client_signature','large-'||((i-1)/2),'comment_body',repeat('body ',20),'unknown_payload',repeat('retained ',16)) FROM generate_series(1,20000) i;`);
 const m={id:'large',scope:'large',noteId:'large'};
 for(const options of [{page:1,pageSize:100},{page:71,pageSize:100,includeCategoryPreview:true},{kind:'membership_board_reply',page:100,pageSize:100}]){
  const result=await equivalent(m,options);assert.equal(result.total,10000);assert.equal(result.rows.length,100);
  const preview=Object.values(result.categoryPreview).flat();assert.ok(preview.length<=12);assert.ok(result.rows.length+preview.length<=112);
 }
});

test('Edge reads one RPC page with authenticated scope and fails without full-history fallback',async()=>{
 const source=readFileSync(root,'utf8').replace(/^import.*\n/,'');
 const calls=[];let callback,rpcError=null;
 const dbMock={from(table){assert.ok(['insight_member_sessions','insight_access_applications'].includes(table),'unexpected full-history read: '+table);const q={select(){return q},eq(){return q},async maybeSingle(){return {data:table==='insight_member_sessions'?{application_id:'owner-app',expires_at:'2099-01-01'}:{id:'owner-app',note_id:'ss_yr',status:'active'}}}};return q},async rpc(name,params){calls.push({name,params});return rpcError?{error:rpcError}:{data:{ok:true,rows:[{id:1}],total:1}}}};
 const sandbox=vm.createContext({createClient:()=>dbMock,Deno:{env:{get:()=>''},serve:f=>{callback=f}},Response,Request,URL,Date,Intl,Set,Map,crypto,TextEncoder,console:{error(){}}});
 vm.runInContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,sandbox);
 const request=body=>callback(new Request('https://example.invalid',{method:'POST',headers:{'X-Insight-Token':'valid'},body:JSON.stringify(body)}));
 const response=await request({action:'get',memberIds:['unrelated'],scope:'unrelated',noteId:'unrelated',page:2,pageSize:20,kind:'reply_self',day:'2026-10-17',handlingStatus:'pending',includeCategoryPreview:true});
 assert.equal(response.status,200);assert.equal(calls.length,1);assert.equal(calls[0].name,'insight_notification_feed_page');
 assert.deepEqual(JSON.parse(JSON.stringify(calls[0].params)),{p_member_ids:['owner','owner-app'],p_scope:'owner',p_note_id:'ss_yr',p_kind:'reply_self',p_day:'2026-10-17',p_handling_status:'pending',p_page:2,p_page_size:20,p_preview:true});
 rpcError={code:'PGRST202',message:'missing RPC'};
 const failed=await request({});assert.equal(failed.status,500);assert.equal((await failed.json()).error,'NOTIFICATION_FEED_READ_FAILED:PGRST202');assert.equal(calls.length,2);
 assert.doesNotMatch(source,/async function allRows|offset\+=1000.*insight_notifications/);
});
