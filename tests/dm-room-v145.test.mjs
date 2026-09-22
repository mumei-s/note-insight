import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import ts from 'typescript';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';

const roomA='11111111-1111-4111-8111-111111111111',roomB='22222222-2222-4222-8222-222222222222';
function ingest(){
 const writes=[];let handle;
 const db={from(table){const q={select(){return q},eq(){return q},is(){return q},gt(){return q},like(){return q},limit(){return q},
  maybeSingle:async()=>({data:table==='insight_dm_ingest_tokens'?{member_id:'member-a'}:table==='insight_access_applications'?{note_id:'tester',status:'active',verified_at:'2026-01-01'}:null,error:null}),
  upsert:async row=>{writes.push({table,row});return{error:null}},insert:async()=>({error:null}),then(resolve){resolve({data:[],error:null})}};return q}};
 const ctx=vm.createContext({URL,Request,Response,TextEncoder,crypto:webcrypto,console:{error(){}},createClient:()=>db,Deno:{env:{get:()=>''},serve:fn=>handle=fn}});
 const src=readFileSync('supabase/functions/insight-dm-ingest/index.ts','utf8').replace(/^import[^\n]+\n/,'');
 vm.runInContext(ts.transpileModule(src,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,ctx);
 return{writes,send:async messages=>{const r=await handle(new Request('https://example.test/ingest',{method:'POST',headers:{'Content-Type':'application/json','X-Ingest-Token':'fixture-token'},body:JSON.stringify({noteId:'tester',member_id:'other-member',messages})}));return{status:r.status,body:await r.json()}}};
}
test('DMは取得元の会話と保存先が違う本文を受け付けない',async()=>{
 const h=ingest(),r=await h.send([{thread_key:roomA,message_key:'api:'+roomA+':one',body:'fixture',meta:{request_url:'https://dm-api.note.com/api/v1/session/rooms/'+roomB+'/messages'}}]);
 assert.equal(r.body.error,'DM_THREAD_MISMATCH');assert.equal(h.writes.length,0);
});
test('DM識別子の会話が保存先と違う場合も拒否する',async()=>{
 const h=ingest(),r=await h.send([{thread_key:roomA,message_key:'api:'+roomB+':one',body:'fixture'}]);assert.equal(r.body.error,'DM_THREAD_MISMATCH');assert.equal(h.writes.length,0);
});
test('DM本文の改行を保ち、認証した本人の保存先だけに書く',async()=>{
 const h=ingest(),r=await h.send([{thread_key:roomA,message_key:'api:'+roomA+':one',body:' first\r\nsecond  line ',meta:{request_url:'https://dm-api.note.com/api/v1/session/rooms/'+roomA+'/messages'}}]);
 assert.equal(r.status,200);assert.equal(h.writes[0].row.member_id,'member-a');assert.equal(h.writes[0].row.body,'first\nsecond  line');assert.deepEqual(r.body.confirmedMessageKeys,['api:'+roomA+':one']);
});
test('同じ表示名だけでは別のDM会話をまとめず、同じnote IDならまとめる',()=>{
 const s=readFileSync('supabase/functions/insight-dm-feed/index.ts','utf8'),part=s.slice(s.indexOf('const clean='),s.indexOf('Deno.serve(')),ctx=vm.createContext({URL});
 vm.runInContext(ts.transpileModule(part+'this.key=personKey;',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,ctx);
 assert.notEqual(ctx.key({peer_name:'同じ名前',thread_key:roomA}),ctx.key({peer_name:'同じ名前',thread_key:roomB}));
 assert.equal(ctx.key({peer_note_id:'person',thread_key:roomA}),ctx.key({peer_url:'https://note.com/person',thread_key:roomB}));
 assert.equal(ctx.key({peer_url:'https://note.com/messages/rooms/'+roomA,thread_key:roomA}),'room:'+roomA);
});
