import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
import vm from 'node:vm';
import ts from 'typescript';
import {PGlite} from '@electric-sql/pglite';

const quote=s=>s==='meta->>comment_archive_revision'?"(meta->>'comment_archive_revision')":'"'+s.replaceAll('"','""')+'"';
const sha=async value=>Buffer.from(await webcrypto.subtle.digest('SHA-256',new TextEncoder().encode(value))).toString('hex');
const url='https://note.com/other/n/nabc?scrollpos=comment&c=nc222';
const notice=(extra={})=>({raw_text:'相手さんがあなたのコメントに返信しました',actor_name:'相手',actor_url:'https://note.com/other',target_url:url,occurred_at:'2026-10-14T00:00:00Z',meta:{source:'note-notification-reader-v4',kind:'note_comment_reply',event_identity:'notice:111',client_signature:'fixture-signature',body:'相手さんがあなたのコメントに返信しました'},...extra});
const resolved={comment_body:'取得済みの実返信\n2行目',comment_key:'nc222',comment_author:'返信者',comment_body_source:'exact-comment-id',comment_resolved_at:'2026-10-14T00:01:00Z'};

async function fixture(t,options={}){
  const sql=new PGlite();t.after(()=>sql.close());
  await sql.exec(`
    create table insight_notification_ingest_tokens(token_hash text,member_id text,expires_at timestamptz,revoked_at timestamptz);
    create table insight_access_applications(id text,note_id text,status text,verified_at timestamptz);
    create table insight_notifications(id bigint generated always as identity primary key,member_id text,fingerprint text,notification_type text,raw_text text,actor_name text,actor_url text,actor_image_url text,target_title text,target_url text,source_url text,occurred_at timestamptz,captured_at timestamptz,meta jsonb,unique(member_id,fingerprint));
    create table insight_notification_sync_runs(member_id text,inserted_count integer,received_count integer,source text);
  `);
  await sql.query('insert into insight_notification_ingest_tokens values($1,$2,$3,null)',[await sha('fixture-token'),'member-a','2099-01-01']);
  await sql.query('insert into insight_access_applications values($1,$2,$3,$4)',['member-a','tester','active','2026-01-01']);
  const db={from(table){
    let columns='*',mode='select',payload,size;const predicates=[],params=[];
    const condition=(key,operator,value)=>{params.push(value);predicates.push(quote(key)+' '+operator+' $'+params.length)};
    const run=async()=>{
      try{
        const where=predicates.length?' where '+predicates.join(' and '):'';
        if(mode==='insert'){
          const keys=Object.keys(payload),values=keys.map(k=>payload[k]);
          await sql.query('insert into '+quote(table)+' ('+keys.map(quote).join(',')+') values ('+keys.map((_,i)=>'$'+(i+1)).join(',')+')',values);
          return{data:null,error:null};
        }
        if(mode==='update'){
          if(options.beforeUpdate)await options.beforeUpdate(sql);
          const keys=Object.keys(payload),values=keys.map(k=>payload[k]),shifted=where.replace(/\$(\d+)/g,(_,n)=>'$'+(Number(n)+values.length));
          const result=await sql.query('update '+quote(table)+' set '+keys.map((k,i)=>quote(k)+'=$'+(i+1)).join(',')+shifted+' returning id',[...values,...params]);
          return{data:result.rows,error:null};
        }
        if(mode==='delete'){const result=await sql.query('delete from '+quote(table)+where+' returning id',params);return{data:result.rows,error:null}}
        const selected=columns==='*'?'*':columns.split(',').map(quote).join(',');
        return{data:(await sql.query('select '+selected+' from '+quote(table)+where+(size===undefined?'':' limit '+size),params)).rows,error:null};
      }catch(error){return{data:null,error}}
    };
    const q={select(value='*'){columns=value;return q},eq(k,v){condition(k,'=',v);return q},gt(k,v){condition(k,'>',v);return q},is(k,v){assert.equal(v,null);predicates.push(quote(k)+' is null');return q},in(k,values){if(!values.length){predicates.push('false');return q}const slots=values.map(v=>{params.push(v);return'$'+params.length});predicates.push(quote(k)+' in ('+slots.join(',')+')');return q},contains(k,v){params.push(JSON.stringify(v));predicates.push(quote(k)+' @> $'+params.length+'::jsonb');return q},limit(n){size=n;return q},insert(value){mode='insert';payload=value;return q},update(value){mode='update';payload=value;return q},delete(){mode='delete';return q},async maybeSingle(){const result=await run();return{...result,data:result.data?.[0]||null}},then:(resolve,reject)=>run().then(resolve,reject)};
    return q;
  }};
  let handler;const logs=[];
  const context=vm.createContext({URL,Request,Response,TextEncoder,crypto:webcrypto,console:{error:value=>logs.push(value)},createClient:()=>db,Deno:{env:{get:()=>''},serve:fn=>handler=fn}});
  const source=readFileSync('supabase/functions/insight-notification-ingest-v2/index.ts','utf8').replace(/^import[^\n]+\n/,'');
  vm.runInContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);
  const send=async(notifications,extra={})=>{const response=await handler(new Request('https://example.test/fixture',{method:'POST',headers:{'Content-Type':'application/json','X-Ingest-Token':'fixture-token'},body:JSON.stringify({noteId:'tester',notifications,...extra})}));return{status:response.status,body:await response.json()}};
  const stableFingerprint=await sha('event-v2|client|fixture-signature');
  const seed=async({memberId='member-a',fingerprint=stableFingerprint,target=url,meta={...notice().meta,...resolved,old_only:'discard'}}={})=>sql.query('insert into insight_notifications(member_id,fingerprint,notification_type,raw_text,target_url,meta) values($1,$2,$3,$4,$5,$6)',[memberId,fingerprint,'reply',notice().raw_text,target,meta]);
  const rows=async()=> (await sql.query('select * from insight_notifications order by id')).rows;
  return{sql,send,seed,rows,logs};
}

test('実handlerは通知文の再同期で同一通知・同一コメントの取得済み本文と証跡を保持する',async t=>{
  const h=await fixture(t);await h.seed();
  const incoming=notice({meta:{...notice().meta,body:'通知の新しい案内文',scan_mode:'fresh'}}),result=await h.send([incoming]);
  assert.equal(result.status,200);assert.equal(result.body.updated,1);assert.deepEqual(result.body.confirmedClientSignatures,['fixture-signature']);
  const [row]=await h.rows();for(const[key,value]of Object.entries(resolved))assert.equal(row.meta[key],value);
  assert.equal(row.meta.body,'通知の新しい案内文');assert.equal(row.meta.scan_mode,'fresh');assert.equal(row.meta.old_only,undefined);assert.equal(row.meta.classifier,'action-v28-context');assert.deepEqual(h.logs,[]);
});

test('実handlerは新しい明示本文を優先し、以前の本文取得証跡を混ぜない',async t=>{
  const h=await fixture(t);await h.seed();
  const meta={...notice().meta,comment_body:'更新された実返信',comment_key:'nc222',comment_author:'新しい返信者'};
  assert.equal((await h.send([notice({meta})])).status,200);
  const [row]=await h.rows();assert.equal(row.meta.comment_body,meta.comment_body);assert.equal(row.meta.comment_author,meta.comment_author);assert.equal(row.meta.comment_key,'nc222');assert.equal(row.meta.comment_body_source,undefined);assert.equal(row.meta.comment_resolved_at,undefined);
});

test('実handlerはコメントID・記事ID・掲示板URLへの変更や矛盾したlocatorへ旧本文を持ち越さない',async t=>{
  const h=await fixture(t);
  const targets=[url.replace('nc222','nc333'),url.replace('/nabc','/nother'),'https://note.com/other/membership/boards/board/posts/post?kind=board_reply_comment','https://evil.test/other/n/nabc?c=nc222'];
  for(const target of targets){
    await h.sql.exec('delete from insight_notifications');await h.seed();
    assert.equal((await h.send([notice({target_url:target,meta:{...notice().meta,all_area_url:url}})])).status,200);
    const [row]=await h.rows();for(const key of Object.keys(resolved))assert.equal(row.meta[key],undefined,target);
  }
  await h.sql.exec('delete from insight_notifications');await h.seed();
  assert.equal((await h.send([notice({meta:{...notice().meta,comment_key:'nc333'}})])).status,200);
  assert.equal((await h.rows())[0].meta.comment_body,undefined);
});

test('実handlerは同じclient signatureでも明示通知IDが違えば旧本文を引き継がない',async t=>{
  const h=await fixture(t);await h.seed();
  assert.equal((await h.send([notice({meta:{...notice().meta,event_identity:'notice:222'}})])).status,200);
  const [row]=await h.rows();assert.equal(row.meta.event_identity,'notice:222');assert.equal(row.meta.comment_body,undefined);assert.equal(row.meta.comment_body_source,undefined);
});

test('実handlerは同一通知の重複行を整理するとき別候補の取得済み本文を失わない',async t=>{
  const h=await fixture(t);await h.seed({meta:notice().meta});await h.seed({fingerprint:'legacy-fingerprint'});
  const result=await h.send([notice()]);assert.equal(result.status,200);assert.equal(result.body.deduped,1);
  const rows=await h.rows();assert.equal(rows.length,1);assert.equal(rows[0].meta.comment_body,resolved.comment_body);assert.equal(rows[0].meta.comment_body_source,'exact-comment-id');
});

test('実handlerは他tenantの同じ通知を本文の保持候補にせず、別note本人を拒否する',async t=>{
  const h=await fixture(t);await h.seed({memberId:'member-b'});const before=(await h.rows())[0];
  const denied=await h.send([notice()],{noteId:'other-account',member_id:'member-b'});assert.equal(denied.status,409);assert.equal(denied.body.error,'NOTIFICATION_ACCOUNT_MISMATCH');assert.deepEqual(await h.rows(),[before]);
  assert.equal((await h.send([notice()],{member_id:'member-b'})).status,200);
  const rows=await h.rows();assert.equal(rows.length,2);assert.deepEqual(rows.find(r=>r.member_id==='member-b'),before);assert.equal(rows.find(r=>r.member_id==='member-a').meta.comment_body,undefined);
});

const archivedConversation={articleKey:'nabc',threadKey:'nc111',complete:true,messages:[{commentKey:'nc111',parentKey:null,body:'自分の元コメント',author:'自分',isSelf:true},{commentKey:'nc222',parentKey:'nc111',body:resolved.comment_body,author:'相手',isSelf:false}]};
test('実handlerは再同期でも取得済み会話全体を保持する',async t=>{
  const h=await fixture(t);await h.seed({meta:{...notice().meta,...resolved,comment_conversation:archivedConversation}});
  assert.equal((await h.send([notice()])).status,200);
  assert.deepEqual((await h.rows())[0].meta.comment_conversation,archivedConversation);
});
test('実handlerは新しい明示本文があっても取得済み親コメントを消さない',async t=>{
  const h=await fixture(t);await h.seed({meta:{...notice().meta,...resolved,comment_conversation:archivedConversation}});
  assert.equal((await h.send([notice({meta:{...notice().meta,comment_key:'nc222',comment_body:'新しい本文'}})])) .status,200);
  const [row]=await h.rows();assert.equal(row.meta.comment_body,'新しい本文');assert.deepEqual(row.meta.comment_conversation,archivedConversation);
});
test('実handlerは記事または通知が異なる会話を引き継がない',async t=>{
  const h=await fixture(t);await h.seed({meta:{...notice().meta,...resolved,comment_conversation:archivedConversation}});
  assert.equal((await h.send([notice({meta:{...notice().meta,event_identity:'notice:different'}})])) .status,200);
  assert.equal((await h.rows())[0].meta.comment_conversation,undefined);
});


test('実handlerは取得処理と競合しても後から保存された本文と会話を失わない',async t=>{
  let fired=false;
  const h=await fixture(t,{beforeUpdate:async sql=>{
    if(fired)return;fired=true;
    await sql.query('update insight_notifications set meta=meta || $1::jsonb where member_id=$2',[JSON.stringify({...resolved,comment_conversation:archivedConversation,comment_archive_revision:"concurrent-save"}),'member-a']);
  }});
  await h.seed({meta:notice().meta});
  const response=await h.send([notice()]);assert.equal(response.status,200);assert.equal(response.body.updated,1);
  const [row]=await h.rows();assert.equal(row.meta.comment_body,resolved.comment_body);assert.deepEqual(row.meta.comment_conversation,archivedConversation);
});
test('実handlerは連続競合時に確認済みを返さず保存済み本文を残す',async t=>{
  let changes=0;
  const h=await fixture(t,{beforeUpdate:async sql=>{
    await sql.query('update insight_notifications set meta=meta || $1::jsonb where member_id=$2',[JSON.stringify({...resolved,comment_archive_revision:String(++changes)}),'member-a']);
  }});
  await h.seed();const response=await h.send([notice()]);
  assert.equal(response.status,500);assert.equal(response.body.confirmedClientSignatures,undefined);assert.equal(changes,3);
  assert.equal((await h.rows())[0].meta.comment_body,resolved.comment_body);
});

test('同じ通知IDのlocatorなし再取得は保存済み本文と会話を消さない',async t=>{
 const h=await fixture(t);await h.seed({meta:{...notice().meta,...resolved,article_key:'nabc',comment_conversation:archivedConversation}});
 assert.equal((await h.send([notice({target_url:null})])).status,200);
 const [row]=await h.rows();assert.equal(row.meta.comment_body,resolved.comment_body);assert.deepEqual(row.meta.comment_conversation,archivedConversation);
});

test('同じ記事URLからコメントIDだけ失われても本文を保持し削除マーカーで上書きしない',async t=>{
 const h=await fixture(t);await h.seed({meta:{...notice().meta,...resolved,article_key:'nabc',comment_conversation:archivedConversation}});
 assert.equal((await h.send([notice({target_url:'https://note.com/other/n/nabc',meta:{...notice().meta,comment_body:'削除済み'}})])).status,200);
 const [row]=await h.rows();assert.equal(row.meta.comment_body,resolved.comment_body);assert.equal(row.meta.comment_key,'nc222');assert.deepEqual(row.meta.comment_conversation,archivedConversation);
});

test('旧reply_bodyだけに保存された本文を同一IDの再同期でも維持する',async t=>{
 const h=await fixture(t);await h.seed({meta:{...notice().meta,reply_body:'旧形式の本文',comment_key:'nc222'}});
 assert.equal((await h.send([notice()])).status,200);assert.equal((await h.rows())[0].meta.comment_body,'旧形式の本文');
});
