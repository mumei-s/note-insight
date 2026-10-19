import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {webcrypto,createHash} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';

const source=readFileSync('supabase/functions/insight-dm-feed/index.ts','utf8');
const fields='thread_key,peer_note_id,peer_name,peer_url,peer_image_url,last_message_at,last_synced_at';
const hash=value=>createHash('sha256').update(value).digest('hex');
const quote=value=>'"'+value.replaceAll('"','""')+'"';
const bytes=value=>Buffer.byteLength(JSON.stringify(value),'utf8');

async function fixture(t,{scope='owner',noteId='ss_yr'}={}){
  const sql=new PGlite();t.after(()=>sql.close());
  await sql.exec(`
    create table insight_notification_profiles(member_id text primary key);
    create table insight_member_sessions(application_id text,token_hash text,expires_at timestamptz,revoked_at timestamptz);
    create table insight_access_applications(id text,note_id text,status text);
  `);
  await sql.query('insert into insight_notification_profiles values ($1),($2)',[scope,'other-member']);
  await sql.query('insert into insight_member_sessions values ($1,$2,$3,null)',['application',hash('fixture'),'2099-01-01']);
  await sql.query('insert into insight_access_applications values ($1,$2,$3)',['application',noteId,'active']);
  await sql.exec(readFileSync('supabase/migrations/20260921035000_insight_dm_history.sql','utf8'));
  if(scope!=='owner'){
    await sql.query('update insight_member_sessions set application_id=$1',[scope]);
    await sql.query('update insight_access_applications set id=$1',[scope]);
  }

  async function insert(table,row){
    const keys=Object.keys(row);
    await sql.query(`insert into ${quote(table)} (${keys.map(quote).join(',')}) values (${keys.map((_,i)=>'$'+(i+1)).join(',')})`,keys.map(key=>row[key]));
  }
  const unusedMeta={reader_status:{checked_at:'2026-10-17T00:00:00Z',complete:true},diagnostics:'unused thread diagnostic '.repeat(1024)};
  const thread=(thread_key,extra={})=>({member_id:scope,thread_key,room_url:'https://note.com/messages/rooms/'+thread_key,peer_note_id:null,peer_name:null,peer_url:null,peer_image_url:null,last_message_at:null,last_synced_at:'2026-10-15T00:00:00Z',meta:unusedMeta,...extra});
  const threads=[
    thread('room-a',{peer_note_id:'@PEER',peer_name:'以前の名前',peer_url:'https://note.com/peer',last_message_at:'2026-10-15T01:00:00Z'}),
    thread('room-b',{peer_name:'最新の名前',peer_url:'https://note.com/peer?from=dm',peer_image_url:'https://example.test/peer.png',last_message_at:'2026-10-17T01:00:00Z'}),
    thread('room-c',{peer_note_id:'peer',peer_name:'同じ相手',last_message_at:'2026-10-16T01:00:00Z'}),
    thread('room-unknown'),
    thread('room-invalid',{peer_note_id:'invalid id',peer_name:'名前だけ',peer_url:'https://example.test/peer'}),
    thread('room-a',{member_id:'other-member',peer_note_id:'foreign',peer_name:'別本人の相手',last_message_at:'2090-01-01T00:00:00Z'}),
  ];
  for(const row of threads)await insert('insight_dm_threads',row);
  const message=(id,thread_key,extra={})=>({id,member_id:scope,thread_key,message_key:'message-'+id,direction:id%2?'inbound':'outbound',sender_name:'相手 '+id,sender_url:'https://note.com/peer',sender_image_url:'https://example.test/peer.png',body:'保存本文 '+id+'\n2行目',sent_at:'2026-10-17T01:00:00Z',raw_text:'元の本文 '+id,attachment_name:'添付 '+id,attachment_url:'https://example.test/attachment-'+id,attachment_type:'image/png',captured_at:'2026-10-17T02:00:00Z',meta:{keep:'message meta '+id},...extra});
  const messages=[message(1,'room-a'),message(2,'room-b'),message(3,'room-c'),message(4,'room-a',{sent_at:null}),message(5,'room-unknown'),message(6,'room-a',{meta:{superseded_by:'message-1'}}),message(7,'room-a',{member_id:'other-member',body:'別本人の本文'})];
  for(const row of messages)await insert('insight_dm_messages',row);

  function backend(code){
    const reads=[];let handle,failThreads=false;
    const db={from(table){
      const filters=[],params=[],orders=[];let columns='*',head=false,counted=false,offset=0,limit=null;
      const field=key=>key==='meta->>superseded_by'?"meta->>'superseded_by'":quote(key);
      const condition=(key,operator,value)=>{params.push(value);filters.push(field(key)+' '+operator+' $'+params.length)};
      const read=async()=>{
        if(failThreads&&table==='insight_dm_threads')return{data:null,count:null,error:{code:'57014',message:'fixture read failure'}};
        const where=filters.length?' where '+filters.join(' and '):'';
        const count=counted?Number((await sql.query(`select count(*) as count from ${quote(table)}${where}`,params)).rows[0].count):null;
        const selected=columns==='*'?'*':columns.split(',').map(key=>key==='meta->reader_status'?"meta->'reader_status' as reader_status":quote(key)).join(',');
        const tail=(orders.length?' order by '+orders.join(','):'')+(limit===null?'':' limit '+limit)+' offset '+offset;
        const result=await sql.query(`select ${selected} from ${quote(table)}${where}${tail}`,params);
        const data=head?null:result.rows;
        reads.push({table,columns,rows:data,bytes:head?0:bytes(data),filters:[...filters]});
        return{data,count,error:null};
      };
      const query={select(value='*',options={}){columns=value;head=Boolean(options.head);counted=options.count==='exact';return query},eq(key,value){condition(key,'=',value);return query},is(key,value){assert.equal(value,null);filters.push(field(key)+' is null');return query},in(key,values){const slots=values.map(value=>{params.push(value);return'$'+params.length});filters.push(field(key)+' in ('+slots.join(',')+')');return query},order(key,options={}){orders.push(field(key)+(options.ascending===false?' desc':' asc')+(options.nullsFirst===false?' nulls last':''));return query},limit(value){limit=value;return query},range(from,to){offset=from;limit=to-from+1;return query},async maybeSingle(){const result=await read();return{...result,data:result.data?.[0]||null}},then:(resolve,reject)=>read().then(resolve,reject)};
      return query;
    }};
    const context=vm.createContext({URL,Request,Response,TextEncoder,crypto:webcrypto,createClient:()=>db,Deno:{env:{get:()=>''},serve:fn=>handle=fn}});
    vm.runInContext(ts.transpileModule(code.replace(/^import[^\n]+\n/,''),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);
    return{reads,failThreads:()=>{failThreads=true},async call(body,token='fixture'){
      const response=await handle(new Request('https://example.test/fixture',{method:'POST',headers:{'X-Insight-Token':token},body:JSON.stringify(body)}));
      return{status:response.status,body:await response.json()};
    }};
  }
  const legacy=source.replaceAll('.select(PERSON_THREAD_FIELDS)','.select("*")');
  return{sql,backend:()=>backend(source),legacy:()=>backend(legacy)};
}

test('DM人物一覧のDB取得列を絞り、複数会話・別名・未確定人物を旧応答と一致させる',async t=>{
  const h=await fixture(t),current=h.backend(),legacy=h.legacy();
  const actual=await current.call({action:'people',member_id:'other-member'}),before=await legacy.call({action:'people'});
  assert.equal(actual.status,200);assert.deepEqual(actual,before);
  assert.equal(actual.body.total,3);assert.equal(actual.body.rows[0].person_key,'note:peer');
  assert.equal(actual.body.rows[0].peer_name,'最新の名前');assert.equal(actual.body.rows[0].room_count,3);
  assert.deepEqual(actual.body.rows[0].thread_keys,['room-b','room-c','room-a']);
  assert.ok(actual.body.rows.some(row=>row.person_key==='room:room-unknown'&&row.peer_name==='DM会話'));
  assert.doesNotMatch(JSON.stringify(actual.body),/別本人|foreign|diagnostics/);
  const read=current.reads.find(row=>row.table==='insight_dm_threads'),oldRead=legacy.reads.find(row=>row.table==='insight_dm_threads');
  assert.equal(read.columns,fields);assert.equal(read.rows.length,oldRead.rows.length);
  assert.ok(read.rows.every(row=>!('meta'in row)&&!('room_url'in row)&&!('member_id'in row)));
  assert.ok(read.bytes<oldRead.bytes*0.05,'未使用metaを除いたDB→Edge JSON bytesを95%以上削減する合成fixture');
  t.diagnostic(`Synthetic thread projection: ${oldRead.bytes} -> ${read.bytes} JSON bytes; response bytes unchanged at ${bytes(actual.body)}`);
});

test('DM本文の全ページ・順序・添付・metaを維持し、各ページで不要な会話metaを取得しない',async t=>{
  const h=await fixture(t),current=h.backend(),legacy=h.legacy(),ids=[];
  for(const page of [1,2,3]){
    const body={action:'person_messages',personKey:'note:peer',page,pageSize:2,member_id:'other-member'};
    const actual=await current.call(body);assert.deepEqual(actual,await legacy.call(body));
    assert.equal(actual.body.total,4);assert.equal(actual.body.person.room_count,3);
    for(const row of actual.body.rows){ids.push(row.id);assert.equal(row.body,'保存本文 '+row.id+'\n2行目');assert.equal(row.attachment_name,'添付 '+row.id);assert.deepEqual(row.meta,{keep:'message meta '+row.id})}
  }
  assert.deepEqual(ids,[3,2,1,4]);
  assert.equal(current.reads.filter(row=>row.table==='insight_dm_threads').length,3);
  assert.ok(current.reads.filter(row=>row.table==='insight_dm_threads').every(row=>row.columns===fields));
  assert.ok(current.reads.filter(row=>row.table==='insight_dm_messages').every(row=>row.columns==='*'));
  assert.deepEqual(await current.call({action:'person_messages',personKey:'note:foreign'}),await legacy.call({action:'person_messages',personKey:'note:foreign'}));
});

test('従来のthreads・messages・summary応答と会話metaを変えない',async t=>{
  const h=await fixture(t),current=h.backend(),legacy=h.legacy();
  for(const body of [{action:'threads',pageSize:2},{action:'messages',threadKey:'room-a',pageSize:2},{action:'summary'}]){
    assert.deepEqual(await current.call(body),await legacy.call(body));
  }
  const threadRead=current.reads.find(row=>row.table==='insight_dm_threads'&&row.columns==='*');
  assert.ok(threadRead.rows[0].meta.reader_status.complete);assert.ok(threadRead.rows[0].room_url);
});

test('一般参加者の本人境界と読取失敗を維持し、空の成功へ置換しない',async t=>{
  const h=await fixture(t,{scope:'member-a',noteId:'participant'}),current=h.backend(),legacy=h.legacy();
  for(const body of [{action:'people'},{action:'person_messages',personKey:'note:peer'}]){
    const actual=await current.call(body);assert.deepEqual(actual,await legacy.call(body));
    assert.equal(actual.body.noteId,'participant');assert.doesNotMatch(JSON.stringify(actual.body),/別本人/);
  }
  assert.equal((await current.call({action:'people'},'')).status,401);
  assert.equal((await current.call({action:'people'},'invalid')).status,401);
  current.failThreads();legacy.failThreads();
  for(const body of [{action:'people'},{action:'person_messages',personKey:'note:peer'}]){
    const result=await current.call(body);assert.equal(result.status,500);assert.deepEqual(result,await legacy.call(body));
  }
});
