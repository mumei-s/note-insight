import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

const source=readFileSync('public/note-insight-dm-network-v2.js','utf8');
const room='11111111-1111-1111-1111-111111111111';
const endpoint=`https://dm-api.note.com/api/v1/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/rooms/${room}/messages?sort=desc`;
const historyKey='mumei_insight_dm_history_v144:tester:'+room;
const outboxKey='mumei_dm_network_outbox_v140:durable:tester';
const savedKey='mumei_insight_dm_saved_v1:tester:'+room;
const message={id:'one',body:'保存する本文',created_at:'2026-10-13T00:00:00Z',sender:{urlname:'peer',name:'相手'}};
const settle=()=>new Promise(resolve=>setImmediate(resolve));
async function flush(){for(let i=0;i<12;i++)await settle()}
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no});return{promise,resolve,reject}}
const response=rows=>new Response(JSON.stringify({data:rows}));

function fixture(t,{ordinary=false}={}){
 const dom=new JSDOM('<main></main>',{url:ordinary?'https://note.com/tester':'https://note.com/messages/rooms/'+room,runScripts:'outside-only'}),w=dom.window;
 t.after(()=>dom.window.close());
 const gm=new Map([['mumei_insight_dm_sync_token_v1:tester','fixture-token'],['mumei_insight_dm_sync_token_v1:other','other-fixture-token']]);
 const posts=[],gets=[],identities=[],fetchCalls=[],xhrCalls=[],timers=new Map();
 let account='tester',identityMode='normal',identityDelay=null,apiDelay=null,apiRows=[message],now=0,nextTimer=0;
 const nativeFetchError=new Error('native fetch failure'),nativeXhrError=new Error('native xhr failure');
 const throwInput={url:'https://note.com/api/v3/ordinary-throw'},throwBody={ordinary:'throw'};
 const ordinaryFetchResult=Promise.resolve({ordinary:true});
 w.setTimeout=(fn,ms=0)=>{const id=++nextTimer;timers.set(id,{fn,at:now+Number(ms)});return id};
 w.clearTimeout=id=>timers.delete(id);
 w.fetch=function(input,init){
  fetchCalls.push({input,init,thisValue:this});
  if(input===throwInput)throw nativeFetchError;
  const u=new URL(typeof input==='string'||input instanceof w.URL?String(input):input.url,w.location.href);
  if(u.pathname==='/api/v2/current_user'){
   identities.push({init,mode:identityMode});
   if(identityMode==='fetch-hang')return new Promise(()=>{});
   if(identityMode==='fetch-delay')return identityDelay.promise;
   if(identityMode==='json-hang')return Promise.resolve({ok:true,json:()=>new Promise(()=>{}),clone(){return this},text:async()=>''});
   return Promise.resolve(new Response(JSON.stringify({data:{urlname:account}})));
  }
  if(u.origin==='https://dm-api.note.com'){
   gets.push({url:u.href,init});
   return apiDelay?apiDelay.promise:Promise.resolve(response(u.searchParams.has('before')?[]:apiRows));
  }
  return ordinaryFetchResult;
 };
 class NativeXHR extends w.EventTarget{
  open(...args){xhrCalls.push({method:'open',args});return 'native-open'}
  setRequestHeader(...args){xhrCalls.push({method:'setRequestHeader',args});return 'native-header'}
  send(...args){xhrCalls.push({method:'send',args});if(args[0]===throwBody)throw nativeXhrError;return 'native-send'}
 }
 w.XMLHttpRequest=NativeXHR;
 w.GM={
  getValue:async(k,d)=>gm.has(k)?structuredClone(gm.get(k)):d,
  setValue:async(k,v)=>gm.set(k,structuredClone(v)),
  xmlHttpRequest:o=>{const body=JSON.parse(o.data);posts.push(body);o.onload({status:200,responseText:JSON.stringify({ok:true,confirmedMessageKeys:body.messages.map(m=>m.message_key)})})}
 };
 w.eval(source);
 async function advance(ms){
  const target=now+ms;
  await flush();
  for(;;){
   const ready=[...timers].filter(([,timer])=>timer.at<=target).sort((a,b)=>a[1].at-b[1].at||a[0]-b[0]);
   if(!ready.length)break;
   const [id,timer]=ready[0];timers.delete(id);now=timer.at;timer.fn();await flush();
  }
  now=target;await flush();
 }
 return{w,gm,posts,gets,identities,fetchCalls,xhrCalls,advance,api:w.__mumeiDmNetworkV2,
  nativeFetchError,nativeXhrError,throwInput,throwBody,ordinaryFetchResult,
  setAccount:id=>account=id,setRows:rows=>apiRows=rows,
  identity:mode=>{identityMode=mode;identityDelay=mode==='fetch-delay'?deferred():null;return identityDelay},
  delayApi:()=>{apiDelay=deferred();return apiDelay},resumeApi:()=>apiDelay=null};
}

test('DMの最初のAPI応答をpageshowより前でも保存する',async t=>{
 const h=fixture(t);
 await h.w.fetch(endpoint,{headers:{Authorization:'fixture-auth'}});await flush();
 assert.equal(h.api.snapshot(room).length,1);
 assert.deepEqual(h.posts.flatMap(body=>body.messages.map(row=>row.message_key)),['api:'+room+':one']);
 assert.deepEqual(h.gm.get(savedKey),['api:'+room+':one']);
 assert.equal((await h.api.readHistory(room,'tester')).complete,true);
});

test('通常note画面からpushStateでDMへ移っても最初のAPI応答を保存する',async t=>{
 const h=fixture(t,{ordinary:true});
 h.w.dispatchEvent(new h.w.Event('pageshow'));await h.advance(1200);
 assert.equal(h.identities.length,0);assert.equal(h.posts.length,0);
 h.w.history.pushState({},'', '/messages/rooms/'+room);
 await h.w.fetch(endpoint);await flush();
 assert.equal(h.api.snapshot(room).length,1);assert.equal(h.posts.length,1);
 assert.equal((await h.api.readHistory(room,'tester')).complete,true);
});

test('通常のfetchは引数・戻り値・例外を保持し本人確認や保存を始めない',async t=>{
 const h=fixture(t,{ordinary:true}),input={url:'https://note.com/api/v3/ordinary',headers:new Map([['X-Fixture','plain']])},init={method:'POST',body:{ordinary:true}};
 const returned=h.w.fetch(input,init);
 assert.equal(returned,h.ordinaryFetchResult);
 assert.equal(h.fetchCalls[0].input,input);assert.equal(h.fetchCalls[0].init,init);assert.equal(h.fetchCalls[0].thisValue,h.w);
 assert.deepEqual(await returned,{ordinary:true});
 const request=new Request('https://note.com/api/v3/ordinary-request',{method:'POST',body:'ordinary request body'});
 assert.equal(h.w.fetch(request),h.ordinaryFetchResult);assert.equal(h.fetchCalls.at(-1).input,request);assert.equal(request.bodyUsed,false);
 assert.throws(()=>h.w.fetch(h.throwInput),error=>error===h.nativeFetchError);
 assert.equal(h.fetchCalls.filter(call=>call.input===h.throwInput).length,1);
 for(const path of ['/api/v3/text_notes','/api/v3/notes/draft','/api/v1/auth/login']){
  const options={method:'POST',body:'private editor/auth fixture'};
  assert.equal(h.w.fetch(path,options),h.ordinaryFetchResult);assert.equal(h.fetchCalls.at(-1).init,options);
 }
 const authReply=await h.w.fetch('/api/v2/current_user');assert.equal(authReply.bodyUsed,false);
 assert.equal((await authReply.json()).data.urlname,'tester');
 await flush();assert.equal(h.identities.length,1);assert.equal(h.posts.length,0);
});

test('通常のXHRはopen・header・sendの引数と戻り値を保持し例外でも一度だけ送信する',async t=>{
 const h=fixture(t,{ordinary:true}),xhr=new h.w.XMLHttpRequest(),body={ordinary:'body'};
 assert.equal(xhr.open('post','/api/v3/ordinary',false),'native-open');
 assert.equal(xhr.setRequestHeader('X-Fixture','plain'),'native-header');
 assert.equal(xhr.send(body),'native-send');
 assert.deepEqual(h.xhrCalls[0],{method:'open',args:['post','/api/v3/ordinary',false]});
 assert.deepEqual(h.xhrCalls[1],{method:'setRequestHeader',args:['X-Fixture','plain']});
 assert.equal(h.xhrCalls[2].args[0],body);
 const originalText=JSON.stringify({data:[message]});let loads=0;
 xhr.responseText=originalText;xhr.addEventListener('load',function(event){loads++;assert.equal(this,xhr);assert.equal(event.target,xhr);assert.equal(this.responseText,originalText)});
 xhr.dispatchEvent(new h.w.Event('load'));assert.equal(loads,1);assert.equal(xhr.responseText,originalText);
 const failing=new h.w.XMLHttpRequest();failing.open('GET','/api/v3/ordinary-throw',true);
 assert.throws(()=>failing.send(h.throwBody),error=>error===h.nativeXhrError);
 assert.equal(h.xhrCalls.filter(call=>call.method==='send'&&call.args[0]===h.throwBody).length,1);
 await flush();assert.equal(h.identities.length,0);assert.equal(h.posts.length,0);
});

for(const mode of ['fetch-hang','json-hang'])test('本人確認の'+(mode==='fetch-hang'?'fetchがabortを無視':'JSONが停止')+'しても12秒で中断し保存位置と保留本文を動かさない',async t=>{
 const h=fixture(t);h.setRows([]);await h.advance(1200);await h.w.fetch(endpoint);await flush();
 const state={complete:false,before:'old-cursor',headKeys:['api:'+room+':old-head']},pending=[{thread_key:room,message_key:'api:'+room+':pending',body:'未確認の本文'}];
 h.gm.set(historyKey,structuredClone(state));h.gm.set(outboxKey,structuredClone(pending));
 h.identity(mode);const startedGets=h.gets.length,startedPosts=h.posts.length;
 let result=null;const job=h.api.readHistory(room,'tester').then(value=>{result={value}},error=>{result={error}});
 await flush();const request=h.identities.at(-1);assert.equal(request.mode,mode);assert.ok(request.init.signal);
 await h.advance(11999);assert.equal(result,null);
 await h.advance(1);assert.equal(result?.error?.message,'NOTE_ACCOUNT_CHANGED');assert.equal(result.error.dmProgress.complete,false);await job;
 assert.equal(request.init.signal.aborted,true);
 assert.equal(h.gets.length,startedGets);assert.equal(h.posts.length,startedPosts);
 assert.deepEqual(h.gm.get(historyKey),state);assert.deepEqual(h.gm.get(outboxKey),pending);assert.equal(h.gm.has(savedKey),false);
 h.identity('normal');assert.equal((await h.api.readHistory(room,'tester')).complete,true);
});

test('本人確認の応答待ちで停止したら遅い応答後も次のDM取得や完了更新を行わない',async t=>{
 const h=fixture(t);h.setRows([]);await h.advance(1200);await h.w.fetch(endpoint);await flush();
 const delayed=h.identity('fetch-delay');let stop=false;
 const startedGets=h.gets.length,job=h.api.readHistory(room,'tester',{shouldStop:()=>stop});
 await flush();stop=true;h.w.dispatchEvent(new h.w.Event('pagehide'));
 h.identity('normal');delayed.resolve(new Response(JSON.stringify({data:{urlname:'tester'}})));
 const result=await job;
 assert.equal(result.stopped,true);assert.equal(result.complete,false);
 assert.equal(h.gets.length,startedGets);assert.equal(h.gm.has(historyKey),false);assert.equal(h.posts.length,0);
});

test('API応答が遅れてnoteアカウントが変わったら旧アカウントの本文を保存しない',async t=>{
 const h=fixture(t),delayed=h.delayApi(),native=h.w.fetch(endpoint);
 await flush();h.setAccount('other');h.resumeApi();delayed.resolve(response([message]));await native;await flush();
 assert.equal(h.posts.length,0);assert.equal(h.api.snapshot(room).length,0);
 assert.equal(h.gm.has(outboxKey),false);assert.equal(h.gm.has('mumei_dm_network_outbox_v140:durable:other'),false);
 assert.equal(await h.api.readHistory(room,'other'),null);
});

test('要求開始時の本人確認がタイムアウトした本文を後の別アカウントへ保存しない',async t=>{
 const h=fixture(t,{ordinary:true});await h.advance(1200);h.w.history.pushState({},'', '/messages/rooms/'+room);
 h.identity('fetch-hang');const delayed=h.delayApi(),native=h.w.fetch(endpoint);await flush();
 await h.advance(12000);h.identity('normal');h.setAccount('other');h.resumeApi();delayed.resolve(response([message]));await native;await flush();
 assert.equal(h.posts.length,0);assert.equal(h.api.snapshot(room).length,0);
 assert.equal(h.gm.has(outboxKey),false);assert.equal(h.gm.has('mumei_dm_network_outbox_v140:durable:other'),false);
 assert.equal(await h.api.readHistory(room,'other'),null);
});
