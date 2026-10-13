import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

const source=readFileSync('public/note-insight-dm-network-v2.js','utf8');
const room='11111111-1111-4111-8111-111111111111';
const endpoint='https://dm-api.note.com/api/v1/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/rooms/'+room+'/messages';
const stateKey='mumei_insight_dm_history_v144:tester:'+room;
const queueKey='mumei_dm_network_outbox_v140:durable:tester';
const savedKey='mumei_insight_dm_saved_v1:tester:'+room;
const settle=async()=>{for(let i=0;i<15;i++)await new Promise(resolve=>setImmediate(resolve))};

async function fixture(t){
  const gm=new Map([['mumei_insight_dm_sync_token_v1:tester','fixture-token']]),serverSaved=new Set(),posts=[];
  let ids=['5','4','3','2','1'],failed=false,partialCommit=false,bodyFor=id=>'本文 '+id,current;
  function open(){
    const dom=new JSDOM('<main/>',{url:'https://note.com/messages/rooms/'+room,runScripts:'outside-only'}),w=dom.window;
    w.setTimeout=()=>0;w.clearTimeout=()=>{};
    w.fetch=async(input)=>{
      const u=new URL(String(input),w.location.href);
      if(u.pathname==='/api/v2/current_user')return Response.json({data:{user:{urlname:'tester'}}});
      assert.equal(u.origin,'https://dm-api.note.com');
      const before=u.searchParams.get('before')||'',start=before?ids.indexOf(before)+1:0;
      return Response.json({data:ids.slice(start,start+2).map(id=>({id,body:bodyFor(id),created_at:'2026-10-13T00:00:00Z',sender:{urlname:'peer'}}))});
    };
    w.GM={getValue:async(k,d)=>gm.get(k)??d,setValue:async(k,v)=>gm.set(k,structuredClone(v)),xmlHttpRequest:options=>{
      const messages=JSON.parse(options.data).messages||[],keys=messages.map(row=>row.message_key);posts.push({failed,keys,bytes:options.data.length});
      if(failed){if(partialCommit&&keys.length)serverSaved.add(keys[0]);options.onload({status:500,responseText:JSON.stringify({ok:false,error:'DM_INGEST_FAILED'})});return}
      keys.forEach(key=>serverSaved.add(key));options.onload({status:200,responseText:JSON.stringify({ok:true,confirmedMessageKeys:keys})});
    }};
    w.eval(source);current={w,dom,api:w.__mumeiDmNetworkV2};return current;
  }
  open();t.after(()=>current.dom.window.close());
  await current.w.fetch(endpoint);await settle();await current.api.readHistory(room,'tester');
  return{gm,posts,serverSaved,get api(){return current.api},ids:value=>{ids=value},body:value=>{bodyFor=value},fail(value,partial=false){failed=value;partialCommit=partial},async reopen(){current.dom.window.close();open();await current.w.fetch(endpoint);await settle()}};
}

test('保存500の同じ長文batchは未確認のまま保持し、復旧時だけ保存境界を更新する',async t=>{
  const h=await fixture(t),oldHead=h.gm.get(stateKey).headKeys.slice();h.ids(['7','6','5','4','3','2','1']);h.body(id=>Number(id)>5?'長文'.repeat(5000)+id:'本文 '+id);h.fail(true,true);
  for(let i=0;i<2;i++)await assert.rejects(h.api.readHistory(room,'tester'),error=>error.message==='DM_INGEST_FAILED'&&error.dmProgress.complete===false);
  assert.deepEqual(h.posts.at(-1).keys,h.posts.at(-2).keys);assert.ok(h.posts.at(-1).bytes>20000);
  assert.deepEqual(h.gm.get(stateKey).headKeys,oldHead);assert.equal(h.gm.get(queueKey).length,2);assert.equal(h.gm.get(savedKey).length,5);
  assert.equal(h.serverSaved.size,6,'サーバー側の途中保存もackなしでは端末の保存確認にしない');
  h.fail(false);const result=await h.api.readHistory(room,'tester');
  assert.equal(result.complete,true);assert.equal(h.gm.get(queueKey).length,0);assert.equal(h.gm.get(savedKey).length,7);assert.equal(h.serverSaved.size,7);
  assert.deepEqual(h.gm.get(stateKey).headKeys,['api:'+room+':7','api:'+room+':6']);
});

test('停止とページ再訪でも未確認キューを消さず、同じ本人の再読取で再送する',async t=>{
  const h=await fixture(t),oldHead=h.gm.get(stateKey).headKeys.slice();h.ids(['7','6','5','4','3','2','1']);h.fail(true);
  await assert.rejects(h.api.readHistory(room,'tester'),/DM_INGEST_FAILED/);
  const pending=structuredClone(h.gm.get(queueKey)),attempts=h.posts.length;
  const stopped=await h.api.readHistory(room,'tester',{shouldStop:()=>true});
  assert.equal(stopped.stopped,true);assert.equal(stopped.complete,false);assert.equal(h.posts.length,attempts);assert.deepEqual(h.gm.get(queueKey),pending);assert.deepEqual(h.gm.get(stateKey).headKeys,oldHead);
  h.fail(false);await h.reopen();const resumed=await h.api.readHistory(room,'tester');
  assert.equal(resumed.complete,true);assert.equal(h.gm.get(queueKey).length,0);assert.equal(h.gm.get(savedKey).length,7);assert.equal(h.serverSaved.size,7);
});

test('本文12000文字は保存し、12001文字は切り詰めず未検証として境界を進めない',async t=>{
  const h=await fixture(t),oldHead=h.gm.get(stateKey).headKeys.slice();h.ids(['long','5','4','3','2','1']);h.body(id=>id==='long'?'x'.repeat(12001):'本文 '+id);
  await assert.rejects(h.api.readHistory(room,'tester'),error=>error.message==='DM_HISTORY_MESSAGE_UNVERIFIED'&&error.dmProgress.complete===false);
  assert.deepEqual(h.gm.get(stateKey).headKeys,oldHead);assert.equal(h.serverSaved.has('api:'+room+':long'),false);
  h.body(id=>id==='long'?'x'.repeat(12000):'本文 '+id);const result=await h.api.readHistory(room,'tester');
  assert.equal(result.complete,true);assert.equal(h.serverSaved.has('api:'+room+':long'),true);
  const row=h.api.snapshot(room).find(message=>message.message_key==='api:'+room+':long');assert.equal(row.body.length,12000);
});
