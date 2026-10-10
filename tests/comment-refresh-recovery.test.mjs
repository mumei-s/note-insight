import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
import {webcrypto} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';

const source=fs.readFileSync('supabase/functions/insight-comment-refresh/index.ts','utf8');
const shared=fs.readFileSync('supabase/functions/_shared/egress-20260930.ts','utf8');
function edge({member='owner',noteId='ss_yr',claim=true,maintenance=false,saveError=false,session=true,missingPool=[]}={}){
 const calls=[],saved=[],notes=[];let handler;
 const db={rpc:async(name,args)=>{
  calls.push({name,args});
  if(name==='insight_comment_refresh_claim')return{data:claim};
  if(name==='insight_background_maintenance')return{data:maintenance};
  if(name==='insight_egress_authorize')return{data:{authorized:true,maintenance}};
  if(name==='insight_fast_comment_threads')return{data:[]};
  if(name==='insight_missing_comment_articles')return{data:missingPool};
  if(name==='insight_comment_refresh_batch'){
   assert.equal(args.p_member,member);
   assert.equal(args.p_notifications[0].member_id,member,'通知は実在する正本profileを参照');
   if(saveError)return{error:{message:'WRITE_FAILED'}};
   saved.push(...args.p_rows);return{data:{changed:args.p_rows.length,newNotifications:args.p_notifications.length}};
  }
  throw Error('Unexpected RPC '+name);
 },from:table=>{
  let values={};const q={select:()=>q,eq:(key,value)=>{values[key]=value;return q},in:()=>q,not:()=>q,limit:()=>q,
   upsert:()=>{throw Error('Existing canonical profile must not be replaced')},
   update:()=>q,is:()=>q,maybeSingle:()=>resolve()};
  function resolve(){
   if(table==='insight_notification_profiles')return Promise.resolve({data:values.public_watch_enabled?[{member_id:member,note_urlname:noteId}]:{member_id:member,note_urlname:noteId}});
   if(table==='insight_member_sessions')return Promise.resolve({data:session?{application_id:'app-uuid',expires_at:'2099-01-01',revoked_at:null}:null});
   if(table==='insight_access_applications')return Promise.resolve({data:{id:member==='owner'?'app-uuid':member,note_id:noteId,status:'active',verified_at:'2026-01-01'}});
   if(table==='insight_public_articles')return Promise.resolve({data:[]});
   throw Error('Unexpected table '+table);
  }
  q.then=(a,b)=>resolve().then(a,b);return q;
 }};
 const context=vm.createContext({Request,Response,URL,TextEncoder,AbortController,Date,crypto:webcrypto,
  console:{error:()=>{}},setTimeout:(cb,ms)=>ms<100?(queueMicrotask(cb),0):setTimeout(cb,ms),clearTimeout,
  fetch:async url=>{notes.push(String(url));
   if(String(url).includes('/contents?'))return Response.json({data:{contents:[{key:'n123',name:'article',commentCount:1}]}});
   if(String(url).includes('/note_comments?'))return Response.json({data:[{key:'comment1',user:{urlname:'peer',nickname:'相手'},comment:'取得本文',created_at:'2026-10-10T00:00:00Z'}],next_page:null});
   throw Error('Unexpected fetch '+url);
  },createClient:()=>db,Deno:{env:{get:()=>''},serve:h=>handler=h}});
 const js=stripTypeScriptTypes(shared.replace(/^export /gm,'')+'\n'+source.replace(/^import .*;\s*$/gm,'')+'\nglobalThis.helpers={notificationMember,memberProfile,pageRows,comments,missingArticles};',{mode:'strip'});
 vm.runInContext(js,context);
 return{handler,calls,saved,notes,helpers:context.helpers};
}
function memberRequest(extra={}){return new Request('https://example.invalid',{method:'POST',headers:{'Content-Type':'application/json','X-Insight-Token':'fixture-only-token'},body:JSON.stringify({action:'refresh',memberId:'another-tenant',noteId:'another_note',...extra})})}

test('ownerのapplication UUIDを通知FKへ流さず、正本ownerへ保存する',async()=>{
 const h=edge();const r=await h.handler(memberRequest());assert.equal(r.status,200);const p=await r.json();
 assert.equal(p.ok,true);assert.equal(p.changedComments,1);assert.equal(h.saved[0].member_id,'owner');assert.equal(h.saved[0].body,'取得本文');
 assert.equal(h.calls.find(x=>x.name==='insight_comment_refresh_claim').args.p_member,'owner');
 assert.ok(h.notes[0].includes('disabled_pinned=true'),'固定記事で最新記事が取得候補から落ちない');
});
test('参加者は本人のUUIDだけへ保存し、bodyの任意scope指定を採用しない',async()=>{
 const h=edge({member:'participant-uuid',noteId:'participant'});const r=await h.handler(memberRequest());
 assert.equal((await r.json()).ok,true);assert.equal(h.saved[0].member_id,'participant-uuid');
 assert.ok(h.notes[0].includes('/creators/participant/'));
});
test('無効sessionは公開note取得前に拒否する',async()=>{
 const h=edge({session:false});const r=await h.handler(memberRequest());assert.equal(r.status,401);assert.equal(h.notes.length,0);
});
test('maintenanceと同一scopeのcooldownでは公開noteを再取得しない',async()=>{
 for(const options of [{maintenance:true},{claim:false}]){
  const h=edge(options),r=await h.handler(memberRequest()),p=await r.json();
  assert.equal(p.ok,true);assert.ok(p.paused||p.skipped);assert.equal(h.notes.length,0);assert.equal(h.saved.length,0);
 }
});
test('保存失敗をokとして隠さず、失敗件数と原因を返す',async()=>{
 const h=edge({saveError:true}),r=await h.handler(memberRequest()),p=await r.json();
 assert.equal(p.ok,false);assert.equal(p.failedArticles,1);assert.deepEqual(p.errors,['insight_comment_refresh_batch: WRITE_FAILED']);assert.equal(h.saved.length,0);
});
test('cronも部分失敗をok:trueとして隠さない',async()=>{
 const h=edge({saveError:true});
 const r=await h.handler(new Request('https://example.invalid',{method:'POST',headers:{'Content-Type':'application/json','X-Cron-Secret':'fixture-only'},body:JSON.stringify({memberId:'owner'})}));
 const p=await r.json();assert.equal(p.ok,false);assert.equal(p.profiles,1);assert.equal(p.results[0].failedArticles,1);assert.equal(h.saved.length,0);
});

test('取得拒否の記事が先頭に残っても修復候補を巡回して後の履歴を取得できる',async()=>{
 const missingPool=Array.from({length:9},(_,i)=>({article_key:'n'+i,title:'記事',comment_count:1}));
 const h=edge({missingPool});
 const first=await h.helpers.missingArticles('owner',0),next=await h.helpers.missingArticles('owner',6);
 assert.deepEqual(Array.from(first,x=>x.key),['n0','n1','n2','n3','n4','n5']);
 assert.deepEqual(Array.from(next,x=>x.key),['n6','n7','n8','n0','n1','n2']);
 assert.equal(h.calls[0].args.p_limit,100);
});

test('本番batch SQLで通知FK違反の全巻戻しを再現し、正本scopeなら両方保存される',async()=>{
 const db=new PGlite();try{
  await db.exec(`create schema private; create role anon; create role authenticated; create role service_role;
   create table public.insight_notification_profiles(member_id text primary key,note_urlname text);
   create unique index note_id_unique on public.insight_notification_profiles(lower(note_urlname)) where note_urlname is not null;
   insert into public.insight_notification_profiles values ('owner','ss_yr');
   create table public.insight_public_comments(member_id text,article_key text,comment_key text,body text,primary key(member_id,article_key,comment_key));
   create table public.insight_notifications(id serial primary key,member_id text references public.insight_notification_profiles(member_id),fingerprint text,notification_type text,raw_text text,actor_name text,actor_url text,actor_image_url text,target_title text,target_url text,source_url text,occurred_at timestamptz,meta jsonb,unique(member_id,fingerprint));`);
  const migration=fs.readFileSync('supabase/migrations/20260930052907_insight_egress_batch_rpcs_20260930.sql','utf8');
  for(const name of ['insight_egress_upsert','insight_egress_insert_notifications','insight_comment_refresh_batch']){
   const start=migration.indexOf('CREATE OR REPLACE FUNCTION public.'+name+'('),end=migration.indexOf('END $fn$;',start);
   await db.exec(migration.slice(start,end+'END $fn$;'.length));
  }
  const rows=[{member_id:'owner',article_key:'n123',comment_key:'c1',body:'本文'}];
  const events=member=>[{member_id:member,fingerprint:'c1',notification_type:'comment',meta:{commentKey:'c1'}}];
  const call=member=>db.query('select public.insight_comment_refresh_batch($1,$2,$3::jsonb,$4::jsonb) as result',['owner','n123',JSON.stringify(rows),JSON.stringify(events(member))]);
  await assert.rejects(call('application-alias-uuid'),e=>e.code==='23503');
  assert.equal((await db.query('select count(*)::int as n from insight_public_comments')).rows[0].n,0,'通知失敗はコメントまで巻き戻す');
  assert.equal((await call('owner')).rows[0].result.changed,1);
  assert.equal((await db.query('select count(*)::int as n from insight_notifications')).rows[0].n,1);
  assert.equal((await call('owner')).rows[0].result.changed,0,'再取得は保存済み行を不要に書き直さない');
  await db.exec(fs.readFileSync('supabase/migrations/20261010121607_insight_comment_refresh_claim.sql','utf8'));
  const claim=member=>db.query('select insight_comment_refresh_claim($1) as claimed',[member]);
  assert.equal((await claim('owner')).rows[0].claimed,true);assert.equal((await claim('owner')).rows[0].claimed,false);assert.equal((await claim('participant-uuid')).rows[0].claimed,true);
  const rights=await db.query("select has_function_privilege('anon','public.insight_comment_refresh_claim(text)','execute') as anon,has_function_privilege('service_role','public.insight_comment_refresh_claim(text)','execute') as service");
  assert.equal(rights.rows[0].anon,false);assert.equal(rights.rows[0].service,true);
 }finally{await db.close()}
});
