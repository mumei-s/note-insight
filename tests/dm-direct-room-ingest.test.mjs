import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {webcrypto} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {sceneFixture} from './react-scene-fixture.mjs';

const room='11111111-1111-4111-8111-111111111111';
const quote=s=>'"'+s.replaceAll('"','""')+'"';
const message=(key='one',extra={})=>({thread_key:room,message_key:'api:'+room+':'+key,direction:'inbound',sender_name:'相手',sender_url:'https://note.com/peer',body:'保存した本文\n2行目',sent_at:'2026-10-10T00:00:00Z',meta:{request_url:'https://dm-api.note.com/api/v1/session/rooms/'+room+'/messages'},...extra});
async function fixture(t,{memberId='member-a',noteId='tester',failThread=false,threadError=new Error('fixture-thread-write-failed')}={}){
  const sql=new PGlite();t.after(()=>sql.close());
  await sql.exec('create table public.insight_notification_profiles(member_id text primary key);');
  await sql.query('insert into public.insight_notification_profiles values ($1),($2)',[memberId,'other-member']);
  await sql.exec(readFileSync('supabase/migrations/20260921035000_insight_dm_history.sql','utf8'));
  let beforeThreadInsert=null;const logs=[];
  const db={from(table){
    const filters=[],params=[];let head=false,offset=0,size=null,sort=[];
    const field=k=>k==='meta->>superseded_by'?"meta->>'superseded_by'":quote(k);
    const condition=(k,op,v)=>{params.push(v);filters.push(field(k)+' '+op+' $'+params.length)};
    const select=async()=>{
      if(table==='insight_dm_ingest_tokens')return{data:[{member_id:memberId}],error:null};
      if(table==='insight_member_sessions')return{data:[{application_id:memberId,expires_at:'2099-01-01',revoked_at:null}],error:null};
      if(table==='insight_access_applications')return{data:[{id:memberId,note_id:noteId,status:'active',verified_at:'2026-01-01'}],error:null};
      const base='select * from public.'+quote(table)+(filters.length?' where '+filters.join(' and '):''),all=await sql.query(base,params);
      const tail=(sort.length?' order by '+sort.join(','):'')+(size===null?'':' limit '+size)+' offset '+offset;
      const result=await sql.query(base+tail,params);return{data:head?null:result.rows,count:all.rows.length,error:null};
    };
    const write=async(row,options,insert=false)=>{
      if(table==='insight_dm_threads'&&options?.ignoreDuplicates){if(failThread)return{error:threadError};if(beforeThreadInsert){const hook=beforeThreadInsert;beforeThreadInsert=null;await hook()}}
      const columns=Object.keys(row),args=columns.map(k=>row[k]);let command='insert into public.'+quote(table)+' ('+columns.map(quote).join(',')+') values ('+args.map((_,i)=>'$'+(i+1)).join(',')+')';
      if(!insert){command+=' on conflict ('+options.onConflict.split(',').map(quote).join(',')+') do '+(options.ignoreDuplicates?'nothing':'update set '+columns.map(k=>quote(k)+'=excluded.'+quote(k)).join(','))}
      try{await sql.query(command,args);return{error:null}}catch(error){return{error}}
    };
    const q={select(_columns,options={}){head=Boolean(options.head);return q},eq(k,v){condition(k,'=',v);return q},gt(k,v){condition(k,'>',v);return q},is(k,v){assert.equal(v,null);filters.push(field(k)+' is null');return q},like(k,v){condition(k,'like',v);return q},in(k,values){const slots=values.map(v=>{params.push(v);return'$'+params.length});filters.push(field(k)+' in ('+slots.join(',')+')');return q},order(k,options={}){sort.push(field(k)+(options.ascending===false?' desc':' asc')+(options.nullsFirst===false?' nulls last':''));return q},limit(n){size=n;return q},range(from,to){offset=from;size=to-from+1;return q},async maybeSingle(){const r=await select();return{...r,data:r.data?.[0]||null}},upsert:(row,options)=>write(row,options),insert:row=>write(row,null,true),then:(resolve,reject)=>select().then(resolve,reject)};return q;
  }};
  function handler(file){let handle;const context=vm.createContext({URL,Request,Response,TextEncoder,crypto:webcrypto,console:{error:value=>logs.push(value)},createClient:()=>db,Deno:{env:{get:()=>''},serve:fn=>handle=fn}});const source=readFileSync(file,'utf8').replace(/^import[^\n]+\n/,'');vm.runInContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);return handle}
  const ingest=handler('supabase/functions/insight-dm-ingest/index.ts'),feed=handler('supabase/functions/insight-dm-feed/index.ts');
  const request=(body)=>new Request('https://example.test/fixture',{method:'POST',headers:{'Content-Type':'application/json','X-Ingest-Token':'fixture','X-Insight-Token':'fixture'},body:JSON.stringify(body)});
  return{sql,logs,send:async(messages,extra={})=>{const response=await ingest(request({noteId,threads:[],messages,...extra}));return{status:response.status,body:await response.json()}},feed:async body=>(await feed(request(body))).json(),feedResponse:body=>feed(request(body)),race:fn=>{beforeThreadInsert=fn},recover:()=>{failThread=false}};
}

async function assertMessageDisplayed(t,h,name){
  const globals=['window','document','localStorage','HTMLElement','Element','navigator'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]);
  const scene=await sceneFixture(t,{dependencies:{'./creator-avatar':{CreatorAvatar:()=>null},'./insight-account-store':{INSIGHT_TOKEN_KEY:'fixture-token',currentStoredInsightAccount:()=>({noteId:'tester'})},'./insight-release':{CURRENT_DM_VERSION:'1.4.10',fetchInsightRelease:async()=>({dmVersion:'1.4.10'}),versionDiffers:()=>false}},fetch:async(url,init)=>String(url).endsWith('insight-dm-import-token')?Response.json({ok:true,paired:true}):h.feedResponse(JSON.parse(init.body))});
  t.after(()=>{for(const[key,descriptor]of globals){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key]}});
  scene.w.localStorage.setItem('fixture-token','fixture');await scene.render(scene.load('src/member-insight-dm.tsx').MemberInsightDm,{});
  for(let i=0;i<15&&!scene.w.document.querySelector('.midm-threads button');i++)await new Promise(resolve=>setImmediate(resolve));
  const person=scene.w.document.querySelector('.midm-threads button');assert.ok(person);assert.ok(person.textContent.includes(name));await scene.click(person);
  for(let i=0;i<15&&!scene.w.document.querySelector('.midm-message');i++)await new Promise(resolve=>setImmediate(resolve));
  assert.equal(scene.w.document.querySelector('.midm-message p').textContent,message().body);
}

test('一覧を開かず保存したDMが同じ本人のpeopleとperson_messagesから表示できる',async t=>{
  const h=await fixture(t),saved=await h.send([message()],{member_id:'other-member'});
  assert.equal(saved.status,200);assert.deepEqual(saved.body.confirmedMessageKeys,[message().message_key]);
  const people=await h.feed({action:'people'});assert.equal(people.rows.length,1);assert.equal(people.rows[0].person_key,'note:peer');
  const body=await h.feed({action:'person_messages',personKey:people.rows[0].person_key});assert.equal(body.rows[0].body,message().body);
  assert.equal((await h.sql.query("select count(*)::int as n from insight_dm_threads where member_id='other-member'")).rows[0].n,0);
  await assertMessageDisplayed(t,h,'相手');
});

test('最初の本文が自分の送信でも本人を相手にせず会話を一覧へ登録する',async t=>{
  const h=await fixture(t);assert.equal((await h.send([message('out',{direction:'outbound',sender_name:'あなた',sender_url:'https://note.com/tester'})])).status,200);
  assert.equal((await h.sql.query('select peer_name from insight_dm_threads')).rows[0].peer_name,null);
  const people=await h.feed({action:'people'});assert.equal(people.rows.length,1);assert.equal(people.rows[0].person_key,'room:'+room);assert.equal(people.rows[0].peer_name,'DM会話');assert.equal(people.rows[0].peer_note_id,null);
  assert.equal((await h.feed({action:'person_messages',personKey:people.rows[0].person_key})).rows.length,1);
  await assertMessageDisplayed(t,h,'DM会話');
});

test('別本人の同じroomや同時保存済みの詳しい相手情報を上書きしない',async t=>{
  const h=await fixture(t);
  await h.sql.query('insert into insight_dm_threads(member_id,thread_key,peer_name) values ($1,$2,$3)',['other-member',room,'別本人の相手']);
  h.race(()=>h.sql.query('insert into insight_dm_threads(member_id,thread_key,peer_note_id,peer_name,meta) values ($1,$2,$3,$4,$5)',['member-a',room,'richer','詳しい相手',{reader_status:{complete:true}}]));
  await h.send([message(),message('two')]);const rows=(await h.sql.query('select member_id,peer_name,meta from insight_dm_threads order by member_id')).rows;
  assert.deepEqual(rows,[{member_id:'member-a',peer_name:'詳しい相手',meta:{reader_status:{complete:true}}},{member_id:'other-member',peer_name:'別本人の相手',meta:{}}]);
  const people=await h.feed({action:'people'});assert.equal(people.rows[0].person_key,'note:richer');assert.equal((await h.feed({action:'person_messages',personKey:'note:richer'})).rows.length,2);
});

test('会話一覧の登録に失敗した本文は保存確認を返さず、次回登録へ再試行できる',async t=>{
  const h=await fixture(t,{failThread:true}),response=await h.send([message()]);assert.equal(response.status,500);assert.equal(response.body.error,'DM_INGEST_FAILED');assert.equal(response.body.confirmedMessageKeys,undefined);
  assert.equal((await h.sql.query('select count(*)::int as n from insight_dm_messages')).rows[0].n,1);assert.equal((await h.sql.query('select count(*)::int as n from insight_dm_threads')).rows[0].n,0);
  h.recover();assert.equal((await h.send([message()])).status,200);assert.equal((await h.feed({action:'people'})).rows.length,1);assert.equal((await h.sql.query('select count(*)::int as n from insight_dm_messages')).rows[0].n,1);
});

test('会話不一致を拒否した本文から新しい一覧行を作らない',async t=>{
  const h=await fixture(t),response=await h.send([message('bad',{thread_key:'22222222-2222-4222-8222-222222222222'})]);assert.equal(response.status,401);assert.equal(response.body.error,'DM_THREAD_MISMATCH');assert.equal((await h.sql.query('select count(*)::int as n from insight_dm_threads')).rows[0].n,0);
});

test('ownerの名前未取得はDBのnullを保ち、後から確実な相手情報を補完できる',async t=>{
  const h=await fixture(t,{memberId:'owner',noteId:'ss_yr'});await h.sql.exec(readFileSync('supabase/migrations/20261003152059_owner_dm_permanent_retention.sql','utf8'));
  await h.send([message('out',{direction:'outbound',sender_name:'あなた',sender_url:'https://note.com/ss_yr'})]);
  assert.equal((await h.sql.query('select peer_name from insight_dm_threads')).rows[0].peer_name,null);assert.equal((await h.feed({action:'people'})).rows[0].peer_name,'DM会話');
  assert.equal((await h.send([],{threads:[{thread_key:room,peer_note_id:'peer',peer_name:'確かな相手',peer_url:'https://note.com/peer'}]})).status,200);
  const people=await h.feed({action:'people'});assert.equal(people.rows[0].peer_name,'確かな相手');assert.equal(people.rows[0].person_key,'note:peer');assert.equal((await h.feed({action:'person_messages',personKey:'note:peer'})).rows[0].body,message().body);
});

test('PostgRESTのplain objectエラーから安全なcodeだけを返し本文やdetailをログへ出さない',async t=>{
  const secret='PRIVATE_BODY https://example.test/?credential=secret',h=await fixture(t,{failThread:true,threadError:{code:'23503',message:secret,details:secret,hint:secret}}),response=await h.send([message()]);
  assert.equal(response.status,500);assert.equal(response.body.error,'DM_STORAGE_23503');assert.deepEqual(h.logs,['DM_STORAGE_23503']);assert.doesNotMatch(JSON.stringify(response.body)+JSON.stringify(h.logs),/PRIVATE_BODY|credential|object Object/);
});
