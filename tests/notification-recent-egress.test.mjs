import test,{before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {webcrypto,createHash} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';

// Frozen from f87785887c248cf4246d3571a7f6adde4fa3acbc, not reconstructed
// from the implementation under test. All SQL below is local synthetic data.
const baseline=readFileSync('tests/fixtures/notification-recent-before.ts','utf8');
const source=readFileSync(process.env.NOTIFICATION_RECENT_SOURCE||'supabase/functions/insight-notification-feed-final/index.ts','utf8');
const bytes=value=>Buffer.byteLength(JSON.stringify(value),'utf8');
const quote=value=>'"'+value.replaceAll('"','""')+'"';
const hash=value=>createHash('sha256').update(value).digest('hex');
const at='2026-10-20T10:00:00.000Z';
class FixedDate extends Date{constructor(...args){super(...(args.length?args:['2026-10-20T12:00:00.000Z']))}static now(){return Date.parse('2026-10-20T12:00:00.000Z')}}
let sql;
before(async()=>{
 sql=new PGlite();
 await sql.exec(`
  CREATE TABLE insight_member_sessions(id text,application_id text,token_hash text,expires_at timestamptz,revoked_at timestamptz);
  CREATE TABLE insight_access_applications(id text,note_id text,status text);
  CREATE TABLE insight_notifications(id bigint PRIMARY KEY,member_id text,notification_type text,raw_text text,actor_name text,actor_url text,actor_image_url text,target_title text,target_url text,source_url text,occurred_at timestamptz,captured_at timestamptz,is_read boolean,meta jsonb);
  CREATE TABLE insight_manual_completions(member_id text,creator_urlname text,item_type text,item_key text,PRIMARY KEY(member_id,creator_urlname,item_type,item_key));
  CREATE TABLE insight_favorite_creators(member_id text,creator_key text,actor_url text,PRIMARY KEY(member_id,creator_key));
 `);
 for(const [id,noteId,token] of [['owner-app','ss_yr','owner-token'],['participant','participant','participant-token']]){
  await sql.query("INSERT INTO insight_member_sessions VALUES ($1,$1,$2,'2099-01-01',null)",[id,hash(token)]);
  await sql.query("INSERT INTO insight_access_applications VALUES ($1,$2,'active')",[id,noteId]);
 }
});
after(async()=>{await sql?.close()});
beforeEach(async()=>{await sql.exec('TRUNCATE insight_notifications,insight_manual_completions,insight_favorite_creators')});
async function insert(table,rows){
 if(!rows.length)return;
 await sql.query(`INSERT INTO ${quote(table)} SELECT * FROM jsonb_populate_recordset(NULL::${quote(table)},$1::jsonb)`,[JSON.stringify(rows)]);
}
const row=(id,patch={})=>({id,member_id:'owner',notification_type:'other',raw_text:'保存済み通知 '+id,actor_name:'人物 '+id,actor_url:'https://note.com/person'+id,actor_image_url:null,target_title:'記事',target_url:'https://note.com/ss_yr/n/nExample',source_url:null,occurred_at:at,captured_at:at,is_read:false,meta:{source:'note-notification-reader-v3',event_identity:'notice:'+id,keep:{full:['body',id]}},...patch});
const completion=(item_key,patch={})=>({member_id:'owner',creator_urlname:'ss_yr',item_type:'notification',item_key,...patch});
const favorite=(creator_key,actor_url,patch={})=>({member_id:'owner',creator_key,actor_url,...patch});
const auxiliary=reads=>reads.filter(r=>['insight_manual_completions','insight_favorite_creators'].includes(r.table));
function splitFilters(text){
 const parts=[];let quoted=false,escaped=false,start=0;
 for(let i=0;i<text.length;i++){
  const char=text[i];
  if(escaped){escaped=false;continue}
  if(quoted&&char==='\\'){escaped=true;continue}
  if(char==='"')quoted=!quoted;
  if(char===','&&!quoted){parts.push(text.slice(start,i));start=i+1}
 }
 parts.push(text.slice(start));return parts;
}
function backend(code=source,failTable=null){
 const reads=[];let handle;
 const db={from(table){
  const filters=[],params=[],orders=[],rawFilters=[];let columns='*',offset=0,limit=1000;
  const field=key=>key==='meta->>last_reclassified_at'?"meta->>'last_reclassified_at'":quote(key);
  const param=value=>{params.push(value);return'$'+params.length};
  const run=async()=>{
   if(table===failTable){reads.push({table,error:true});return{data:null,error:{code:'FIXTURE_READ_FAILED',message:'fixture '+table}}}
   const selected=columns==='*'?'*':columns.split(',').map(quote).join(',');
   const query=`SELECT ${selected} FROM ${quote(table)}${filters.length?' WHERE '+filters.join(' AND '):''}${orders.length?' ORDER BY '+orders.join(','):''} LIMIT ${Math.min(limit,1000)} OFFSET ${offset}`;
   // PostgREST sends JSON timestamp strings, not PGlite's native Date objects.
   const rows=JSON.parse(JSON.stringify((await sql.query(query,params)).rows));
   reads.push({table,columns,rows,bytes:bytes(rows),filters:[...filters],params:[...params],rawFilters,offset,limit});
   return{data:rows,error:null};
  };
  const q={
   select(value){columns=value;return q},
   eq(key,value){filters.push(field(key)+'='+param(value));return q},
   in(key,values){filters.push(field(key)+' IN ('+values.map(param).join(',')+')');return q},
   not(key,op,value){assert.equal(op,'in');filters.push(field(key)+' NOT IN ('+value.slice(1,-1).split(',').map(param).join(',')+')');return q},
   or(value){
    rawFilters.push(value);
    const predicates=splitFilters(value).map(part=>{
     const match=part.match(/^([a-z_>-]+)\.(gte|imatch|match)\.(.*)$/s);assert.ok(match,part);
     const [,key,op,raw]=match,v=raw.startsWith('"')?JSON.parse(raw):raw;
     return field(key)+({gte:'>=',imatch:' ~* ',match:' ~ '}[op])+param(v);
    });
    filters.push('('+predicates.join(' OR ')+')');return q;
   },
   order(key,options={}){orders.push(field(key)+(options.ascending===false?' DESC':' ASC'));return q},
   limit(value){limit=value;return q},
   range(from,to){offset=from;limit=to-from+1;return q},
   async maybeSingle(){const result=await run();return{...result,data:result.data?.[0]||null}},
   then(resolve,reject){return run().then(resolve,reject)},
  };
  return q;
 }};
 const context=vm.createContext({URL,Request,Response,TextEncoder,crypto:webcrypto,console:{error(){}},Date:FixedDate,Intl,createClient:()=>db,Deno:{env:{get:()=>''},serve:fn=>handle=fn}});
 vm.runInContext(ts.transpileModule(code.replace(/^import[^\n]+\n/,''),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);
 return{reads,async call(body={action:'recent'},token='owner-token'){
  const response=await handle(new Request('https://fixture.invalid/recent',{method:'POST',headers:{'X-Insight-Token':token},body:JSON.stringify(body)}));
  return{status:response.status,body:await response.json()};
 }};
}
async function snapshot(){
 const result={};for(const table of ['insight_notifications','insight_manual_completions','insight_favorite_creators'])result[table]=(await sql.query(`SELECT * FROM ${quote(table)} ORDER BY 1,2`)).rows;
 return result;
}
async function parity(options={},token='owner-token'){
 const current=backend(),legacy=backend(baseline),before=await snapshot();
 const actual=await current.call({action:'recent',...options},token),expected=await legacy.call({action:'recent',...options},token);
 assert.deepEqual(actual,expected,'whole response, not only IDs or flags');
 assert.deepEqual(await snapshot(),before,'recent never changes saved rows, completions or favorites');
 return{current,legacy,actual};
}

test('empty recent skips every auxiliary read, even with thousands of historical completion keys',async t=>{
 await insert('insight_manual_completions',Array.from({length:2500},(_,i)=>completion('row:history-'+i)));
 await insert('insight_favorite_creators',Array.from({length:800},(_,i)=>favorite('history-'+i,'https://note.com/history'+i)));
 const {current,legacy,actual}=await parity({since:at});
 assert.deepEqual(actual.body.rows,[]);assert.equal(actual.body.watermark,at);
 assert.equal(auxiliary(current.reads).length,0);
 assert.equal(auxiliary(legacy.reads).length,4);
 assert.equal(current.reads.length,3,'authentication twice plus one bounded notification read');
 t.diagnostic(`Empty recent auxiliary DB JSON: ${auxiliary(legacy.reads).reduce((n,r)=>n+r.bytes,0)} -> 0 bytes; auxiliary queries 4 -> 0.`);
});

test('dedupe winners, notice/row completion keys, same-time boundaries and reclassifications exactly match',async t=>{
 const rows=[
  row(1,{meta:{event_identity:'notice:77'},actor_url:'https://note.com/Alias_A'}),
  row(2,{member_id:'owner-app',meta:{event_identity:'notice:77',body:'rich saved body'},actor_url:'https://note.com/Alias_A',actor_image_url:'saved-image'}),
  row(3,{meta:{client_signature:'same-event'},actor_url:null}),
  row(4,{meta:{client_signature:'same-event',comment_body:'saved exact comment'},actor_url:'https://note.com/fallback'}),
  row(5,{meta:{event_identity:'notice:non-numeric'},actor_url:null}),
  row(6,{meta:{event_identity:['notice:333'],actionUsers:[{profile_url:'https://note.com/Meta_Actor',nickname:'fallback name'}]},actor_url:null}),
  row(7,{meta:{last_reclassified_at:at,kind:'store_create'},captured_at:'2026-10-19T00:00:00Z'}),
  row(8,{captured_at:'2026-10-19T00:00:00Z'}),
  row(9,{notification_type:'like'}),row(10,{notification_type:'follow'}),row(11,{notification_type:'comment'}),
  row(12,{raw_text:' ',captured_at:'2026-10-20T10:01:00Z'}),
  row(13,{member_id:'unrelated',captured_at:'2090-01-01T00:00:00Z'}),
 ];
 await insert('insight_notifications',rows);
 await insert('insight_manual_completions',[
  ...Array.from({length:2100},(_,i)=>completion('row:historical-'+i)),
  completion('notice:77'),completion('row:4'),completion('row:5'),completion('notice:333'),
  completion('notice:7',{member_id:'owner-app'}),completion('notice:7',{creator_urlname:'someone-else'}),
  completion('notice:7',{item_type:'like'}),completion('notice:7',{member_id:'participant'}),
 ]);
 await insert('insight_favorite_creators',[
  ...Array.from({length:700},(_,i)=>favorite('history-'+i,'https://note.com/history'+i)),
  favorite('numeric-old','http://NOTE.com:8080/Alias_A/?from=saved#profile'),
  favorite('numeric-winning','https://note.com/alias_a'),
  favorite('FALLBACK',null),favorite('legacy-meta','https://note.com/Meta_Actor/extra'),
  favorite('person7','https://note.com/another-person'),
  favorite('foreign-only','https://note.com/person7',{member_id:'participant'}),
 ]);
 const {current,legacy,actual}=await parity({since:at,member_id:'participant',scope:'participant',noteId:'participant'});
 assert.equal(actual.status,200);assert.equal(actual.body.rows.length,5);
 assert.equal(actual.body.watermark,'2026-10-20T10:01:00.000Z');
 const result=new Map(actual.body.rows.map(r=>[r.id,r]));
 assert.equal(result.get(2).confirmed,true);assert.equal(result.get(2).favorite_creator_key,'numeric-winning');
 assert.equal(result.get(4).confirmed,true);assert.equal(result.get(4).favorite_creator_key,'FALLBACK');
 assert.equal(result.get(6).confirmed,true);assert.equal(result.get(6).favorite_creator_key,'legacy-meta');
 assert.equal(result.get(7).confirmed,false);assert.equal(result.get(7).favorite,false);
 assert.equal(result.get(7).notification_type,'store_started');
 const completions=current.reads.filter(r=>r.table==='insight_manual_completions');
 assert.equal(completions.length,1);assert.equal(completions[0].rows.length,4);assert.equal(completions[0].offset,0);
 assert.ok(!completions[0].params.includes('row:1'),'losing duplicate row keys are not requested');
 const oldBytes=auxiliary(legacy.reads).reduce((n,r)=>n+r.bytes,0),newBytes=auxiliary(current.reads).reduce((n,r)=>n+r.bytes,0);
 assert.ok(newBytes<oldBytes*.02,'synthetic auxiliary payload must drop by more than 98%');
 t.diagnostic(`Nonempty recent auxiliary DB JSON: ${oldBytes} -> ${newBytes} bytes; response unchanged at ${bytes(actual.body)} bytes.`);
});

test('favorites retain URL normalization, key fallback and aliases without wildcard collisions',async()=>{
 const variants=[
  ['mixed_case','HTTPS://NOTE.COM/MiXeD_CaSe/'],
  ['port_user','http://user:pass@note.com:8080/Port_User?x=1#keep'],
  ['back_slash',String.raw`https:\\note.com\\Back_Slash\\extra`],
  ['dot_segments','https://note.com/old/../Dot_Segments/./extra'],
  ['double_slash','https://note.com///Double_Slash?view=all'],
  ['trailing',' \u0001https://note.com/Trailing \u0001'],
  ['embedded','https://note.com/Embe\td\nd\red'],
  ['encoded_host','https://%6Eote.com/Encoded_Host'],
  ['fallback_key','not a profile URL'],
  ['kelvin_key','not a profile URL'],
  ['m','https://note.com/M'],
 ];
 await insert('insight_notifications',variants.map(([id],i)=>row(i+1,{actor_url:'https://note.com/'+(id==='m'?'M':id)})));
 await insert('insight_favorite_creators',[
  ...variants.map(([id,url],i)=>favorite(id==='fallback_key'?'FALLBACK_KEY':id==='kelvin_key'?'KELVIN_KEY':'legacy-'+i,url)),
  favorite('decoy-prefix','https://note.com/mixed_case_suffix'),
  favorite('decoy-underscore','https://note.com/mixedXcase'),
  favorite('wrong-domain','https://notnote.com/mixed_case'),
  favorite('other-path','https://note.com/other/mixed_case'),
  favorite('mixed_case','https://note.com/not_the_same_person'),
 ]);
 const {current,actual}=await parity();
 assert.ok(actual.body.rows.every(r=>r.favorite));
 assert.equal(actual.body.rows.find(r=>r.actor_url==='https://note.com/mixed_case').favorite_creator_key,'legacy-0');
 assert.ok(current.reads.filter(r=>r.table==='insight_favorite_creators').every(r=>r.rawFilters.length===1));
});

test('300-row boundary and long creator IDs use bounded filters, not all-history reads',async()=>{
 const name=i=>'creator_'+String(i).padStart(3,'0')+'_'+'x'.repeat(68);
 await insert('insight_notifications',Array.from({length:305},(_,i)=>row(i+1,{actor_url:'https://note.com/'+name(i)})));
 await insert('insight_manual_completions',[
  ...Array.from({length:2200},(_,i)=>completion('row:irrelevant-'+i)),
  ...Array.from({length:305},(_,i)=>completion('notice:'+(i+1))),
 ]);
 await insert('insight_favorite_creators',[
  ...Array.from({length:400},(_,i)=>favorite('irrelevant-'+i,'https://note.com/unrelated'+i)),
  ...Array.from({length:305},(_,i)=>favorite('old-key-'+i,'https://note.com/'+name(i))),
 ]);
 const {current,actual}=await parity({since:at});
 assert.equal(actual.body.rows.length,300);
 assert.ok(actual.body.rows.every(r=>r.id<=300&&r.confirmed&&r.favorite));
 const completionReads=current.reads.filter(r=>r.table==='insight_manual_completions');
 assert.equal(completionReads.length,3);
 assert.ok(completionReads.every(r=>r.rows.length===100&&r.params.length===103));
 const favoriteReads=current.reads.filter(r=>r.table==='insight_favorite_creators');
 assert.ok(favoriteReads.length>1&&favoriteReads.length<=20);
 assert.ok(favoriteReads.every(r=>r.rawFilters.every(f=>encodeURIComponent(f).length<=6000)));
 assert.equal(favoriteReads.reduce((n,r)=>n+r.rows.length,0),300,'no irrelevant favorites or omitted page-301 creators');
 assert.equal(current.reads.filter(r=>r.table==='insight_notifications').length,1);
 assert.equal(current.reads.find(r=>r.table==='insight_notifications').limit,300);
});

test('participant isolation, absent actors and deduped-away noise do not read unrelated favorites',async()=>{
 await insert('insight_notifications',[
  row(1,{member_id:'participant',actor_url:null,meta:{event_identity:'notice:1'}}),
  row(2,{member_id:'participant',actor_url:'https://elsewhere.invalid/a'}),
  row(3,{member_id:'participant',actor_url:'https://note.com/settings'}),
  row(4,{member_id:'participant',raw_text:' '}),
  row(5),
 ]);
 await insert('insight_manual_completions',[completion('notice:1'),completion('notice:2',{member_id:'participant',creator_urlname:'participant'})]);
 await insert('insight_favorite_creators',[favorite('person1','https://note.com/person1')]);
 const {current,actual}=await parity({},'participant-token');
 assert.equal(actual.body.noteId,'participant');assert.equal(actual.body.rows.length,3);
 assert.equal(actual.body.rows.find(r=>r.id===1).confirmed,false);assert.equal(actual.body.rows.find(r=>r.id===2).confirmed,true);
 assert.equal(current.reads.filter(r=>r.table==='insight_favorite_creators').length,0);
 await sql.exec("UPDATE insight_notifications SET raw_text=' ' WHERE member_id='participant'");
 const empty=await parity({},'participant-token');
 assert.equal(empty.actual.body.rows.length,0);assert.equal(auxiliary(empty.current.reads).length,0);
});

test('invalid/absent since keep the old response and authentication/read failures remain failures',async()=>{
 await insert('insight_notifications',[row(1)]);
 for(const since of [undefined,'not-a-date',123,at,'2026-10-20T19:00:00+09:00'])await parity({since});
 for(const token of ['', 'wrong-token']){
  const current=backend();assert.equal((await current.call({action:'recent'},token)).status,401);
  assert.equal(auxiliary(current.reads).length,0);
 }
 for(const table of ['insight_notifications','insight_manual_completions','insight_favorite_creators']){
  const current=backend(source,table),legacy=backend(baseline,table);
  const actual=await current.call();assert.equal(actual.status,500);assert.deepEqual(actual,await legacy.call());
  if(table==='insight_notifications')assert.equal(auxiliary(current.reads).length,0);
 }
});
