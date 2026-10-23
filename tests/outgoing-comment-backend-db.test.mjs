import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const migration=readFileSync('supabase/migrations/20261023080349_insight_own_comment_scope_archive.sql','utf8');
const appA='00000000-0000-4000-8000-000000000001',appB='00000000-0000-4000-8000-000000000002';
const h=n=>String(n).repeat(64);
async function fixture(){
 const db=new PGlite();
 await db.exec(`create role service_role;create role anon;create role authenticated;
 create table insight_access_applications(id uuid primary key,note_id text,status text,verified_at timestamptz,revoked_at timestamptz);
 create table insight_notification_ingest_tokens(id uuid primary key default gen_random_uuid(),member_id text,token_hash text unique,purpose text,expires_at timestamptz,revoked_at timestamptz,created_at timestamptz default now());
 create table insight_notification_pair_codes(id uuid primary key default gen_random_uuid(),member_id text,code_hash text unique,purpose text,expires_at timestamptz,used_at timestamptz,created_at timestamptz default now());
 create table insight_outgoing_activity(id bigserial primary key,member_id text,event_key text,event_type text,actor_key text,actor_url text,subject_key text,subject_url text,message text,occurred_at timestamptz,source text,raw_data jsonb,created_at timestamptz default now(),unique(member_id,event_key));
 create table insight_notifications(id bigserial primary key,member_id text,notification_type text,meta jsonb,target_url text,captured_at timestamptz);
 create table insight_public_comments(member_id text,article_key text,comment_key text,parent_key text,body text,actor_name text,actor_url text,occurred_at timestamptz);
 insert into insight_access_applications values ('${appA}','me','active',now(),null),('${appB}','them','active',now(),null);
 insert into insight_notification_ingest_tokens(member_id,token_hash,purpose,expires_at) values('${appA}','${h(1)}','note_notification_auto_sync',now()+interval '1 day'),('${appA}','${h(2)}','note_notification_auto_sync',now()+interval '1 day'),('${appB}','${h(3)}','note_notification_auto_sync',now()+interval '1 day'),('${appA}','${h(4)}','note_dashboard_sync',now()+interval '1 day');`);
 await db.exec(migration);
 await db.exec('grant select,insert,update on insight_notification_ingest_tokens,insight_notification_pair_codes,insight_access_applications,insight_outgoing_activity to service_role; grant select on insight_notifications,insight_public_comments to service_role; grant usage on sequence insight_outgoing_activity_id_seq to service_role;');
 const code=async(n,{member=appA,account='me',purpose='own_comment_scope_upgrade',used=false,expired=false}={})=>db.query(`insert into insight_notification_pair_codes(member_id,code_hash,purpose,expires_at,used_at,own_comment_account) values($1,$2,$3,now()+$4::interval,$5,$6)`,[member,h(n),purpose,expired?'-1 minute':'10 minutes',used?'2026-01-01':null,account]);
 const exchange=async(token,consent,account='me')=>(await db.query('select insight_upgrade_own_comment_scope($1,$2,$3) result',[h(token),h(consent),account])).rows[0].result;
 const record=(comment='ncOwn',extra={})=>({id:`me:nArticle:${comment}`,account:'me',articleKey:'nArticle',commentKey:comment,parentKey:null,body:'original saved\n日本語',createdAt:'2026-01-01T00:00:00.000Z',...extra});
 const ingest=async(records,token=1,account='me')=>(await db.query('select insight_archive_own_comments($1,$2,$3) result',[h(token),account,JSON.stringify(records)])).rows[0].result;
 return{db,code,exchange,record,ingest};
}
test('scope migration is service-only invoker, explicit single-use and device/account isolated',async()=>{
 const f=await fixture();try{
 const acl=await f.db.query("select proname,prosecdef,has_function_privilege('anon',oid,'EXECUTE') anon,has_function_privilege('authenticated',oid,'EXECUTE') authenticated,has_function_privilege('service_role',oid,'EXECUTE') service from pg_proc where proname in ('insight_upgrade_own_comment_scope','insight_archive_own_comments','insight_own_comment_history_page','insight_own_comment_saved_thread')");
 assert.equal(acl.rows.length,4);for(const a of acl.rows){assert.equal(a.prosecdef,false);assert.equal(a.anon,false);assert.equal(a.authenticated,false);assert.equal(a.service,true)}
 await f.code(5);await f.db.exec('set role service_role');assert.equal((await f.exchange(3,5,'them')).ok,false);assert.equal((await f.exchange(4,5)).ok,false);assert.equal((await f.exchange(1,5,'them')).ok,false);
 assert.equal((await f.exchange(1,5)).ok,true);assert.equal((await f.exchange(2,5)).ok,false);
 const tokens=(await f.db.query('select token_hash,purpose,own_comment_account from insight_notification_ingest_tokens order by token_hash')).rows;
 assert.deepEqual(tokens.map(t=>t.purpose),['note_notification_and_own_comment_sync','note_notification_auto_sync','note_notification_auto_sync','note_dashboard_sync']);assert.equal(tokens[0].own_comment_account,'me');
 await f.db.exec('reset role');await f.code(6,{purpose:'notification'});assert.equal((await f.exchange(2,6)).ok,false);
 await f.code(7,{expired:true});assert.equal((await f.exchange(2,7)).ok,false);
 await f.code(8,{account:'old-account'});assert.equal((await f.exchange(2,8)).ok,false);
 await f.code(9);await f.db.exec(`update insight_access_applications set status='revoked' where id='${appA}'`);assert.equal((await f.exchange(2,9)).ok,false);
 assert.equal((await f.db.query('select count(*) n from insight_notification_pair_codes where used_at is not null')).rows[0].n,1);
 }finally{await f.db.close()}
});
test('archive keeps first body, ACKs exact stored IDs, and fails atomically for malformed/conflicting batches',async()=>{
 const f=await fixture();try{
 await assert.rejects(f.ingest([f.record()]),/SCOPE_REQUIRED/);await f.code(5);await f.exchange(1,5);
 const first=await f.ingest([f.record()]);assert.deepEqual(first,{ok:true,acks:[{id:'me:nArticle:ncOwn',persisted:true}]});
 await f.ingest([f.record('ncOwn',{body:'edited or deleted source'})]);assert.equal((await f.db.query('select message from insight_outgoing_activity')).rows[0].message,'original saved\n日本語');
 await assert.rejects(f.ingest([f.record('ncNew'),f.record('ncWrong',{id:'someone-else:nArticle:ncWrong'})]),/INVALID_ARCHIVE_ID/);
 assert.equal((await f.db.query('select count(*) n from insight_outgoing_activity')).rows[0].n,1);
 await assert.rejects(f.ingest([f.record('ncOwn',{parentKey:'ncDifferent'})]),/ARCHIVE_CONFLICT/);
 await assert.rejects(f.ingest([f.record('ncBad',{account:'them'})]),/INVALID_ARCHIVE_RECORD/);
 await assert.rejects(f.ingest([f.record('ncBad',{body:'x'.repeat(100001)})]),/INVALID_ARCHIVE_RECORD/);
 await assert.rejects(f.ingest([f.record('ncBad',{parentKey:'ncBad'})]),/INVALID_ARCHIVE_RECORD/);
 await assert.rejects(f.ingest([f.record('ncBad',{createdAt:'infinity'})]),/INVALID_ARCHIVE_TIME/);
 await f.db.exec("update insight_notification_ingest_tokens set purpose='note_notification_auto_sync',own_comment_account=null where token_hash='"+h(1)+"'");
 await assert.rejects(f.ingest([f.record('ncAfterDisable')]),/SCOPE_REQUIRED/);
 assert.equal((await f.db.query('select count(*) n from insight_outgoing_activity')).rows[0].n,1);
 }finally{await f.db.close()}
});
test('history stays lightweight, ordered and scoped after disable; expired/revoked/account-changed tokens fail',async()=>{
 const f=await fixture();try{
 await f.code(5);await f.exchange(1,5);
 await f.ingest([f.record('ncOne',{body:'x'.repeat(100000)}),f.record('ncTwo',{createdAt:'2026-01-02T00:00:00Z'}),f.record('ncThree',{createdAt:'2026-01-03T00:00:00Z'})]);
 const page=async(ids,account,p=1)=>(await f.db.query('select insight_own_comment_history_page($1,$2,$3,2) result',[ids,account,p])).rows[0].result;
 const first=await page([appA],'me');assert.equal(first.hasMore,true);assert.deepEqual(first.rows.map(r=>r.commentKey),['ncThree','ncTwo']);assert.equal(Object.hasOwn(first.rows[0],'body'),false);
 const second=await page([appA],'me',2);assert.equal(second.hasMore,false);assert.equal(second.rows[0].bodyPreview.length,180);assert.ok(JSON.stringify(second).length<600);
 assert.equal((await page([appB],'me')).rows.length,0);assert.equal((await page([appA],'them')).rows.length,0);
 await f.db.exec(`update insight_notification_ingest_tokens set expires_at=now()-interval '1 second' where token_hash='${h(1)}'`);await assert.rejects(f.ingest([f.record('ncExpired')]),/SCOPE_REQUIRED/);
 await f.db.exec(`update insight_notification_ingest_tokens set expires_at=now()+interval '1 day',revoked_at=now() where token_hash='${h(1)}'`);await assert.rejects(f.ingest([f.record('ncRevoked')]),/SCOPE_REQUIRED/);
 await f.db.exec(`update insight_notification_ingest_tokens set revoked_at=null where token_hash='${h(1)}';update insight_access_applications set note_id='changed' where id='${appA}'`);await assert.rejects(f.ingest([f.record('ncChanged')]),/VERIFICATION_REQUIRED/);
 assert.equal((await page([appA],'me')).rows.length,2);
 }finally{await f.db.close()}
});
test('saved thread RPC exact-joins, retains oldest captured bodies and deduplicates repeated notification archives before egress',async()=>{
 const f=await fixture();try{
 await f.code(5);await f.exchange(1,5);await f.ingest([f.record('ncOwn'),f.record('ncOwnReply',{parentKey:'ncOwn',body:'own reply'})]);
 const notice=async(member,article,root,messages,date)=>f.db.query('insert into insight_notifications(member_id,notification_type,meta,target_url,captured_at) values($1,\'reply\',$2,$3,$4)',[member,JSON.stringify({comment_conversation:{articleKey:article,threadKey:root,messages}}),`https://note.com/them/n/${article}?c=ncIncoming`,date]);
 await notice(appA,'nArticle','ncOwn',[{commentKey:'ncIncoming',parentKey:'ncOwn',body:'first reply saved'},{commentKey:'ncOldDeleted',parentKey:'ncOwn',body:'old reply now deleted'}],'2026-01-01');
 for(let i=0;i<30;i++)await notice(appA,'nArticle','ncOwn',[{commentKey:'ncIncoming',parentKey:'ncOwn',body:'later edited reply'},{commentKey:'ncNew',parentKey:'ncOwn',body:'new reply'},{commentKey:'ncUnrelated',parentKey:'ncWrong',body:'wrong thread'}],'2026-02-01');
 await notice(appB,'nArticle','ncOwn',[{commentKey:'ncLeak',parentKey:'ncOwn',body:'private other member'}],'2026-01-01');
 await notice(appA,'nOther','ncOwn',[{commentKey:'ncLeak2',parentKey:'ncOwn',body:'wrong article'}],'2026-01-01');
 await f.db.query('insert into insight_public_comments values($1,$2,$3,$4,$5,$6,$7,$8)',[appA,'nArticle','ncOwn',null,'changed own text','Me','https://note.com/me','2026-01-01']);
 const thread=async(root)=>(await f.db.query('select insight_own_comment_saved_thread($1,$2,$3,$4,$5) result',[[appA],appA,'me','nArticle',root])).rows[0].result;
 const r=await thread('ncOwn');assert.equal(r.truncated,false);assert.equal(r.messages.length,5);assert.equal(r.messages.find(x=>x.commentKey==='ncOwn').body,'original saved\n日本語');assert.equal(r.messages.find(x=>x.commentKey==='ncIncoming').body,'first reply saved');assert.ok(r.messages.some(x=>x.commentKey==='ncOldDeleted'));assert.equal(r.messages.some(x=>/^ncLeak|Unrelated/.test(x.commentKey)),false);assert.ok(JSON.stringify(r).length<1800);
 await f.ingest([f.record('ncBigRoot',{body:'あ'.repeat(100000)})]);await f.ingest([f.record('ncBigReply',{parentKey:'ncBigRoot',body:'あ'.repeat(100000)})]);const bounded=await thread('ncBigRoot');assert.equal(bounded.truncated,true);assert.equal(bounded.messages.length,1);assert.ok(Buffer.byteLength(JSON.stringify(bounded))<401000);
 }finally{await f.db.close()}
});
