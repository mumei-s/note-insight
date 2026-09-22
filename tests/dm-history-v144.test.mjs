import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const source=readFileSync('public/note-insight-dm-network-v2.js','utf8');
const room='11111111-1111-1111-1111-111111111111',second='22222222-2222-2222-2222-222222222222';
const endpoint=`https://dm-api.note.com/api/v1/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/rooms/${room}/messages?perPage=20&sort=desc&width=2000`;
const stateKey='mumei_insight_dm_history_v144:tester:'+room;
const settle=()=>new Promise(r=>setImmediate(r));
async function fixture(t){
 const dom=new JSDOM('<main></main>',{url:'https://note.com/messages/rooms/'+room,runScripts:'outside-only'}),w=dom.window;
 t.after(()=>dom.window.close());
 const gm=new Map([['mumei_insight_dm_sync_token_v1:tester','test-ingest']]),calls=[],writes=[],saved=new Set();
 let ids=['5','4','3','2','1'],account='tester',omit='',invalid=false,failStorage=false;
 w.setTimeout=()=>0;w.clearTimeout=()=>{};
 w.fetch=async(input,init={})=>{
  const u=new URL(String(input),w.location.href);
  if(u.pathname==='/api/v2/current_user')return new Response(JSON.stringify({data:{user:{urlname:account}}}));
  if(u.pathname==='/api/v3/notices')return new Response(JSON.stringify({data:[{id:'notice',body:'message という記事の通知',sender:{name:'相手'}}]}));
  assert.equal(u.origin,'https://dm-api.note.com');assert.equal(init.method||'GET','GET');
  const before=u.searchParams.get('before')||'';calls.push({before,room:u.pathname.match(/rooms\/([^/]+)/)[1]});
  const start=before?ids.indexOf(before)+1:0,data=ids.slice(start,start+2).map(id=>({id,body:'本文 '+id,created_at:'2026-09-22T00:00:00Z',sender:{urlname:'peer',name:'相手'}}));
  return new Response(JSON.stringify(invalid?{data:{error:'bad'}}:{data}));
 };
 w.GM={getValue:async(k,d)=>gm.has(k)?gm.get(k):d,setValue:async(k,v)=>{if(failStorage&&k.startsWith('mumei_insight_dm_history'))throw new Error('storage-full');gm.set(k,v)},xmlHttpRequest:o=>{const body=JSON.parse(o.data),keys=(body.messages||[]).map(m=>m.message_key).filter(k=>!k.endsWith(':'+omit));writes.push(body);for(const k of keys)saved.add(k);o.onload({status:200,responseText:JSON.stringify({ok:true,confirmedMessageKeys:keys})})}};
 w.eval(source);
 await w.fetch(endpoint,{headers:{Authorization:'fixture-secret'}});
 for(let i=0;i<12;i++)await settle();
 calls.length=0;writes.length=0;
 return{w,gm,calls,writes,saved,api:w.__mumeiDmNetworkV2,setIds:v=>ids=v,setAccount:v=>account=v,omit:v=>omit=v,setInvalid:v=>invalid=v,failStorage:v=>failStorage=v};
}

test('実際のdm-apiルートから会話を識別し、初回は自動で過去まで保存する',async t=>{
 const h=await fixture(t),r=await h.api.readHistory(room,'tester');
 assert.equal(r.complete,true);assert.deepEqual(h.calls.map(x=>x.before),['','4','2','1']);assert.equal(h.saved.size,5);
 assert.equal(h.gm.get(stateKey).complete,true);assert.equal(h.gm.get(stateKey).before,null);
 assert.equal(JSON.stringify([...h.gm.values()]).includes('fixture-secret'),false);
});
test('初回保存後は新着だけを追加し、保存境界に届けば過去を再読込しない',async t=>{
 const h=await fixture(t);await h.api.readHistory(room,'tester');h.calls.length=0;h.writes.length=0;h.setIds(['7','6','5','4','3','2','1']);
 const r=await h.api.readHistory(room,'tester');assert.equal(r.complete,true);assert.equal(r.saved,2);assert.deepEqual(h.calls.map(x=>x.before),['','6']);assert.equal(h.saved.size,7);assert.equal(h.writes.flatMap(x=>x.messages).length,2);
});
test('途中で離れたら保存済みcursorを保持し、次回はその先から自動再開',async t=>{
 const h=await fixture(t);let stop=false;const first=await h.api.readHistory(room,'tester',{shouldStop:()=>stop,onProgress:async()=>{stop=true}});
 assert.equal(first.complete,false);assert.equal(h.gm.get(stateKey).before,'4');h.calls.length=0;
 const second=await h.api.readHistory(room,'tester');assert.equal(second.complete,true);assert.deepEqual(h.calls.map(x=>x.before),['','4','2','1']);
});
test('新着の途中保存は古い確定境界を動かさず、未保存区間を取りこぼさない',async t=>{
 const h=await fixture(t);await h.api.readHistory(room,'tester');h.setIds(['9','8','7','6','5','4','3','2','1']);let stop=false;
 await h.api.readHistory(room,'tester',{shouldStop:()=>stop,onProgress:async()=>{stop=true}});
 assert.deepEqual([...h.gm.get(stateKey).headKeys],['api:'+room+':5','api:'+room+':4']);h.calls.length=0;
 const r=await h.api.readHistory(room,'tester');assert.equal(r.complete,true);assert.equal(h.saved.size,9);assert.deepEqual(h.calls.map(x=>x.before),['','8','6']);
});
test('保存未確認の本文があるページではcursorを進めない',async t=>{
 const h=await fixture(t);h.omit('3');await assert.rejects(h.api.readHistory(room,'tester'),/DM_SAVE_UNCONFIRMED/);assert.equal(h.gm.get(stateKey).before,'4');assert.notEqual(h.gm.get(stateKey).complete,true);
 h.omit('');const r=await h.api.readHistory(room,'tester');assert.equal(r.complete,true);assert.equal(h.saved.size,5);
});
test('不明な応答・保存位置の書込失敗を全件完了と表示しない',async t=>{
 const h=await fixture(t);h.setInvalid(true);await assert.rejects(h.api.readHistory(room,'tester'),/UNVERIFIED/);assert.equal(h.gm.has(stateKey),false);
 h.setInvalid(false);h.failStorage(true);await assert.rejects(h.api.readHistory(room,'tester'),/storage-full/);assert.equal(h.gm.has(stateKey),false);
});
test('認証済みnoteアカウントが切り替わったら旧会話の保存を停止する',async t=>{
 const h=await fixture(t);h.setAccount('other');await assert.rejects(h.api.readHistory(room,'tester'),/NOTE_ACCOUNT_CHANGED/);assert.equal(h.calls.length,0);
});
test('通知APIはDM本文として保存せず、別会話のAPI URLを現在の会話に混ぜない',async t=>{
 const h=await fixture(t);const rows=h.api.extract({data:[{id:'x',body:'別の会話',sender:{name:'相手'}}]},endpoint.replace(room,second),'tester');assert.equal(rows[0].thread_key,second);
 const before=h.writes.length;await h.w.fetch('https://note.com/api/v3/notices');for(let i=0;i<8;i++)await settle();assert.equal(h.writes.length,before);
});
