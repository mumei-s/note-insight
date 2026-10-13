import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {webcrypto} from 'node:crypto';

async function summary({messages=[],failSavedRead=false}={}){
  const rows={
    insight_member_sessions:[{application_id:'owner-app',expires_at:'2099-01-01',revoked_at:null}],
    insight_access_applications:[{id:'owner-app',note_id:'ss_yr',status:'active'}],
    insight_dm_threads:[{id:1,member_id:'owner',thread_key:'room',peer_name:'相手'}],
    insight_dm_messages:messages,
    insight_dm_sync_runs:[{member_id:'owner',created_at:'2026-10-13T01:00:00Z',received_count:0,upserted_count:0,thread_count:20}],
  };
  const db={from(table){
    let data=rows[table]||[],columns='',head=false,bound=Infinity,sort=null;
    const result=async()=>{
      if(failSavedRead&&table==='insight_dm_messages'&&columns==='captured_at')return{data:null,error:{code:'57014'}};
      const count=data.length,ordered=sort?[...data].sort((a,b)=>String(b[sort]||'').localeCompare(String(a[sort]||''))):data;
      return{data:head?null:ordered.slice(0,bound),count,error:null};
    };
    const q={select(c,o={}){columns=c;head=!!o.head;return q},eq(k,v){if(k!=='token_hash')data=data.filter(r=>r[k]===v);return q},is(k,v){assert.equal(v,null);data=data.filter(r=>k==='meta->>superseded_by'?!r.meta?.superseded_by:r[k]==null);return q},order(k){sort=k;return q},limit(n){bound=n;return q},async maybeSingle(){const r=await result();return{...r,data:r.data?.[0]||null}},then:(resolve,reject)=>result().then(resolve,reject)};
    return q;
  }};
  let handle;
  const ctx=vm.createContext({URL,Request,Response,TextEncoder,crypto:webcrypto,createClient:()=>db,Deno:{env:{get:()=>''},serve:fn=>handle=fn}});
  const source=readFileSync('supabase/functions/insight-dm-feed/index.ts','utf8').replace(/^import[^\n]+\n/,'');
  vm.runInContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,ctx);
  const response=await handle(new Request('https://example.test/',{method:'POST',headers:{'X-Insight-Token':'fixture'},body:JSON.stringify({action:'summary'})}));
  return{status:response.status,body:await response.json()};
}

test('一覧だけの新しい同期時刻と本文の実保存時刻を分け、別本人と整理済みコピーを除外する',async()=>{
  const result=await summary({messages:[
    {id:1,member_id:'owner',captured_at:'2026-10-12T22:11:02Z',meta:{}},
    {id:2,member_id:'other',captured_at:'2026-10-13T00:59:00Z',meta:{}},
    {id:3,member_id:'owner',captured_at:'2026-10-13T00:58:00Z',meta:{superseded_by:'canonical'}},
  ]});
  assert.equal(result.status,200);assert.equal(result.body.messages,1);
  assert.equal(result.body.lastMessageSavedAt,'2026-10-12T22:11:02Z');assert.equal(result.body.lastSync.upserted_count,0);
});

test('本文が未保存なら別本人の保存日時を使わずnullを返す',async()=>{
  const result=await summary({messages:[{member_id:'other',captured_at:'2026-10-13T00:59:00Z',meta:{}}]});
  assert.equal(result.status,200);assert.equal(result.body.messages,0);assert.equal(result.body.lastMessageSavedAt,null);
});

test('本文保存日時の読取が失敗したら空の成功にしない',async()=>{
  assert.equal((await summary({failSavedRead:true})).status,500);
});
