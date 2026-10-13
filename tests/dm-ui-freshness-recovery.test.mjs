import test from 'node:test';
import assert from 'node:assert/strict';
import * as React from 'react';
import { sceneFixture, pause } from './react-scene-fixture.mjs';

const tokenKey='mumei-insight-access-token';
const deferred=()=>{let resolve;return{promise:new Promise(done=>{resolve=done}),resolve:value=>resolve(value)}};
const response=value=>Response.json({ok:true,...value});
const person=(name='相手A')=>({person_key:'note:peer',peer_name:name,peer_note_id:'peer'});
const message=(body='保存済みの本文')=>({message_key:'saved',body,sent_at:'2026-10-12T22:11:00Z'});
const summary=(messages=1)=>({messages,threads:1,readerStatus:[]});
async function settle(fn=()=>{}){await React.act(async()=>{fn();for(let i=0;i<5;i++)await pause()})}
async function fixture(t,handler,{globals={}}={}){
 let releaseChecks=0;
 const calls=[],intervals=[],h=await sceneFixture(t,{globals,dependencies:{
  './creator-avatar':{CreatorAvatar:()=>React.createElement('span')},
  './insight-account-store':{INSIGHT_TOKEN_KEY:tokenKey,currentStoredInsightAccount:()=>({noteId:localStorage.getItem(tokenKey)==='token-b'?'account_b':'account_a'})},
  './insight-release':{CURRENT_DM_VERSION:'1.4.10',fetchInsightRelease:async()=>{releaseChecks++;return {dmVersion:'1.4.10'}},versionDiffers:()=>false},
 },fetch:async(url,init)=>{const body=JSON.parse(init.body);calls.push({url,body,token:init.headers['X-Insight-Token'],signal:init.signal});return handler(body,init,url)}});
 Object.defineProperty(h.w.document,'visibilityState',{value:'visible',writable:true,configurable:true});
 h.w.localStorage.setItem(tokenKey,'token-a');
 h.w.setInterval=(fn,ms)=>{const timer={fn,ms,cancelled:false};intervals.push(timer);return timer};
 h.w.clearInterval=timer=>{if(timer)timer.cancelled=true};
 const Component=h.load('src/member-insight-dm.tsx').MemberInsightDm;
 return{...h,calls,intervals,releaseChecks:()=>releaseChecks,start:(props={})=>h.render(Component,{active:true,revision:0,...props}),text:()=>h.w.document.body.textContent,
  open:()=>h.click(h.w.document.querySelector('.midm-threads button')),
  poll:()=>settle(()=>intervals.filter(timer=>timer.ms===2500&&!timer.cancelled).at(-1).fn())};
}
function normal(body){
 if(body.action==='people')return response({rows:[person()]});
 if(body.action==='person_messages')return response({rows:[message()],total:1});
 if(body.action==='stats')return response({paired:true});
 return response(summary());
}

test('DMの不正な成功応答は保存済み相手・本文・件数を空へ置き換えない',async t=>{
 let broken=false;
 const h=await fixture(t,async body=>broken&&body.action!=='stats'?new Response('{bad json',{status:200}):normal(body));
 await h.start();await h.open();assert.match(h.text(),/保存済みの本文/);
 broken=true;await h.poll();
 assert.match(h.text(),/相手A/);assert.match(h.text(),/保存済みの本文/);
 assert.match(h.text(),/DM_RESPONSE_INVALID|保存先.*確認できません/);
 assert.doesNotMatch(h.text(),/本文は未保存|この人との保存済みDMはありません/);
});

test('明示更新が遅いDM取得と重なっても最新版を読み古い結果で上書きしない',async t=>{
 const oldPeople=deferred(),oldMessages=deferred();let peopleCalls=0,messageCalls=0;
 const h=await fixture(t,async body=>{
  if(body.action==='people'){peopleCalls++;return peopleCalls===2?oldPeople.promise:response({rows:[person(peopleCalls>=3?'最新版の相手':'相手A')]})}
  if(body.action==='person_messages'){messageCalls++;return messageCalls===2?oldMessages.promise:response({rows:[message(messageCalls>=3?'新しく保存された本文':'保存済みの本文')],total:1})}
  return normal(body);
 });
 await h.start();await h.open();await h.poll();
 await h.start({revision:1});await settle();
 assert.match(h.text(),/最新版の相手/);assert.match(h.text(),/新しく保存された本文/);
 await settle(()=>{oldPeople.resolve(response({rows:[person('古い相手応答')]}));oldMessages.resolve(response({rows:[message('古い本文応答')],total:1}))});
 assert.match(h.text(),/新しく保存された本文/);assert.doesNotMatch(h.text(),/古い相手応答|古い本文応答/);
});

test('保持したDM viewで本人tokenが変わったら旧相手・本文・状態を消して新しい本人を確認する',async t=>{
 const next=deferred();
 const h=await fixture(t,async(body,init)=>init.headers['X-Insight-Token']==='token-b'?next.promise:normal(body));
 await h.start();await h.open();
 await settle(()=>h.w.dispatchEvent(new h.w.MessageEvent('message',{source:h.w,origin:h.w.location.origin,data:{source:'mumei-dm-status-bridge',noteId:'account_a',status:{lastRunComplete:true,storedMessageCount:99}}})));
 assert.match(h.text(),/本文保存 99件/);
 h.w.localStorage.setItem(tokenKey,'token-b');await h.start();
 assert.doesNotMatch(h.text(),/相手A|保存済みの本文|本文保存 99件/);
 assert.ok(h.calls.some(call=>call.token==='token-b'));
 await settle(()=>next.resolve(new Response(JSON.stringify({ok:false,error:'unavailable'}),{status:500})));
 assert.doesNotMatch(h.text(),/相手A|保存済みの本文|本文保存 99件/);
 await settle(()=>h.w.dispatchEvent(new h.w.MessageEvent('message',{source:h.w,origin:h.w.location.origin,data:{source:'mumei-dm-status-bridge',noteId:'account_a',status:{lastRunComplete:true,storedMessageCount:99}}})));
 assert.doesNotMatch(h.text(),/本文保存 99件/);
});

test('DM件数を確認できない時に本文未保存と判定しない',async t=>{
 const h=await fixture(t,async body=>body.action==='summary'?new Response(JSON.stringify({ok:false,error:'DB_READ_FAILED'}),{status:500}):normal(body));
 await h.start();await settle();
 assert.match(h.text(),/相手A/);assert.match(h.text(),/DB_READ_FAILED/);
 assert.doesNotMatch(h.text(),/相手一覧のみ取得・本文は未保存/);
});

test('DMの本文ページ欠損は全件の空成功とせず保存済み本文を保持する',async t=>{
 let refresh=false;
 const h=await fixture(t,async body=>body.action==='person_messages'&&refresh?response({rows:body.page===1?[message('新しい先頭本文')]:[],total:620}):normal(body));
 await h.start();await h.open();refresh=true;await h.poll();
 assert.match(h.text(),/DM_HISTORY_INCOMPLETE|保存先.*一部/);
 assert.match(h.text(),/保存済みの本文/);
});

test('Readerの直前の完了印が残っていても保存エラーを完了より優先する',async t=>{
 const h=await fixture(t,async body=>normal(body));await h.start();
 await settle(()=>h.w.dispatchEvent(new h.w.MessageEvent('message',{source:h.w,origin:h.w.location.origin,data:{source:'mumei-dm-status-bridge',noteId:'account_a',status:{scope:'all',lastRunComplete:true,lastError:'DM_STORAGE_54000',storedMessageCount:99}}})));
 const reader=h.w.document.querySelector('.midm-read-status');
 assert.match(reader.textContent,/途中保存・自動再試行待ち/);assert.match(reader.textContent,/DM_STORAGE_54000/);
 assert.doesNotMatch(reader.textContent,/全会話保存完了/);
});

test('保存先の手動再確認で新しい本文を表示し相手と開いた履歴を維持する',async t=>{
 let updated=false;
 const h=await fixture(t,async body=>body.action==='person_messages'?response({rows:[message(updated?'手動確認後の新しい本文':'保存済みの本文')],total:1}):normal(body));
 await h.start();await h.open();const history=h.w.document.querySelector('.midm-history-panel');history.open=true;
 updated=true;await h.click([...h.w.document.querySelectorAll('button')].find(button=>button.textContent==='保存先を再確認'));
 assert.equal(h.w.document.querySelector('.midm-history-panel'),history);assert.equal(history.open,true);
 assert.match(h.text(),/手動確認後の新しい本文/);assert.match(h.text(),/相手A/);
 assert.doesNotMatch(h.text(),/この人との保存済みDMはありません/);
 assert.equal(h.calls.filter(call=>call.body.action==='person_messages').length,2);
});

test('非表示で遅いDM取得を中断し通信を止め、復帰時の最新本文を旧応答で覆わない',async t=>{
 const old=deferred();let reads=0;
 const h=await fixture(t,async body=>{
  if(body.action==='person_messages'){reads++;return reads===2?old.promise:response({rows:[message(reads>=3?'復帰後の新しい本文':'保存済みの本文')],total:1})}
  return normal(body);
 });
 await h.start();await h.open();await h.poll();
 const pending=h.calls.filter(call=>call.body.action==='person_messages').at(-1);
 await settle(()=>{h.w.document.visibilityState='hidden';h.w.document.dispatchEvent(new h.w.Event('visibilitychange'))});
 assert.equal(pending.signal.aborted,true);const before={calls:h.calls.length,releases:h.releaseChecks()};
 await h.poll();await settle(()=>h.w.dispatchEvent(new h.w.Event('focus')));
 assert.equal(h.calls.length,before.calls);assert.equal(h.releaseChecks(),before.releases);
 await h.start({active:false});
 await settle(()=>{h.w.document.visibilityState='visible';h.w.document.dispatchEvent(new h.w.Event('visibilitychange'));h.w.dispatchEvent(new h.w.Event('focus'))});
 assert.equal(h.calls.length,before.calls);assert.equal(h.releaseChecks(),before.releases);
 await h.start({active:true});await settle();assert.match(h.text(),/復帰後の新しい本文/);
 await settle(()=>old.resolve(response({rows:[message('非表示前の遅い本文')],total:1})));
 assert.match(h.text(),/復帰後の新しい本文/);assert.doesNotMatch(h.text(),/非表示前の遅い本文/);
});

test('500件を超える保存DMを全ページ表示して日時順を維持する',async t=>{
 const rows=Array.from({length:620},(_,i)=>({message_key:'m'+i,body:'本文'+i,sent_at:new Date(Date.parse('2026-10-12T22:11:00Z')-i*1000).toISOString()}));
 const h=await fixture(t,async body=>body.action==='person_messages'?response({rows:rows.slice((body.page-1)*500,body.page*500),total:620}):normal(body));
 await h.start();await h.open();await settle();
 const displayed=[...h.w.document.querySelectorAll('.midm-message p')].map(row=>row.textContent);
 assert.equal(displayed.length,620);assert.equal(displayed[0],'本文619');assert.equal(displayed.at(-1),'本文0');
 assert.deepEqual(h.calls.filter(call=>call.body.action==='person_messages').map(call=>call.body.page),[1,2]);
 assert.equal(h.w.document.querySelector('.midm-error'),null);
});

test('保存先の相手一覧が失敗した時は確認済みの0人と表示しない',async t=>{
 const h=await fixture(t,async body=>body.action==='people'?new Response(JSON.stringify({ok:false,error:'PEOPLE_READ_FAILED'}),{status:500}):normal(body));
 await h.start();await settle();
 assert.match(h.text(),/保存先のDM相手一覧を確認できませんでした/);assert.match(h.text(),/PEOPLE_READ_FAILED/);
 assert.match(h.w.document.querySelector('.midm-control-state').textContent,/—人/);
 assert.equal(h.w.document.querySelector('.midm-history-panel'),null);
});

test('DM本文取得が中断を無視しても時間切れを表示し既存本文を維持する',async t=>{
 let hold=false;
 const h=await fixture(t,async body=>hold&&body.action==='person_messages'?new Promise(()=>{}):normal(body),{globals:{Error,setTimeout:(fn,ms,...args)=>setTimeout(fn,ms===30000?10:ms,...args)}});
 await h.start();await h.open();hold=true;await h.poll();
 await React.act(async()=>{await new Promise(resolve=>setTimeout(resolve,30));await pause()});
 assert.match(h.text(),/保存済みの本文/);assert.match(h.text(),/30秒以内に完了しませんでした/);
 assert.doesNotMatch(h.text(),/この人との保存済みDMはありません/);
});

test('本文保存時刻は直接保存したDMの時刻を優先し、新しい相手一覧だけのrun時刻を使わない',async t=>{
 const h=await fixture(t,async body=>body.action==='summary'?response({messages:5312,threads:20,lastMessageSavedAt:'2026-10-12T22:11:00Z',lastSync:{created_at:'2026-10-13T00:50:00Z',thread_count:20,received_count:0,upserted_count:0},readerStatus:[{saved:1,checked_at:'2026-10-09T00:00:00Z'}]}):normal(body));
 await h.start();await settle();
 const state=h.w.document.querySelector('.midm-control-state .last');
 assert.match(state.textContent,/本文保存 2026\/10\/13 07:11/);
 assert.doesNotMatch(state.textContent,/09:50|2026\/10\/9/);
 assert.match(h.w.document.querySelector('.midm-control-state').textContent,/5,312件/);
});

test('新しい本文保存時刻がない旧API応答は成功した本文Reader時刻へ戻る',async t=>{
 const h=await fixture(t,async body=>body.action==='summary'?response({messages:1,threads:20,lastSync:{created_at:'2026-10-13T00:50:00Z',thread_count:20,received_count:0,upserted_count:0},readerStatus:[{saved:1,checked_at:'2026-10-09T00:00:00Z'}]}):normal(body));
 await h.start();await settle();
 const state=h.w.document.querySelector('.midm-control-state .last');
 assert.match(state.textContent,/本文保存 2026\/10\/9 09:00/);assert.doesNotMatch(state.textContent,/2026\/10\/13|09:50/);
});
