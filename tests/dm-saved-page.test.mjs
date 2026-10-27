import test from 'node:test';
import assert from 'node:assert/strict';
import * as React from 'react';
import {sceneFixture,pause} from './react-scene-fixture.mjs';

const tokenKey='mumei-insight-access-token',accountKey='fixture-account',savedPrefix='mumei-insight-data-cache-v1:saved:';
const response=value=>Response.json({ok:true,...value});
const person=(key='peer')=>({person_key:'note:'+key,peer_note_id:key,peer_name:'相手 '+key,room_count:2});
const rows=(n,body='保存本文')=>Array.from({length:n},(_,i)=>({message_key:'m'+i,body:body+i,sent_at:new Date(Date.UTC(2026,9,17,0,0,n-i)).toISOString(),direction:i%2?'outbound':'inbound',...(i===0?{attachment_url:'https://note.test/file',attachment_name:'添付の名前'}:{})}));
async function settle(fn=()=>{}){await React.act(async()=>{fn();for(let i=0;i<6;i++)await pause()})}
async function fixture(t,{storage={},token='token-a',account='account_a',count=1200,messages=rows(count),handle}={}){
 let now=Date.now();class Clock extends Date{static now(){return now}}
 const calls=[],timers=[];
 const normal=body=>body.action==='people'?response({rows:[person()]}):body.action==='person_messages'?response({rows:messages.slice((body.page-1)*500,body.page*500),total:messages.length}):body.action==='stats'?response({paired:true}):response({messages:messages.length,threads:1,lastMessageSavedAt:messages.length?'2026-10-17T00:00:00Z':null,lastSync:{created_at:'2026-10-17T00:00:00Z',upserted_count:messages.length},readerStatus:[]});
 const h=await sceneFixture(t,{globals:{Date:Clock},dependencies:{
  './creator-avatar':{CreatorAvatar:()=>React.createElement('span')},
  './insight-account-store':{INSIGHT_TOKEN_KEY:tokenKey,currentStoredInsightAccount:()=>({noteId:localStorage.getItem(accountKey)})},
  './insight-release':{CURRENT_DM_VERSION:'1.4.11',fetchInsightRelease:async()=>({dmVersion:'1.4.11'}),versionDiffers:()=>false},
 },fetch:async(url,init)=>{const body=JSON.parse(init.body),call={url,body,signal:init.signal,token:init.headers['X-Insight-Token']};calls.push(call);return handle?handle(call,normal):normal(body)}});
 for(const[key,value]of Object.entries(storage))h.w.localStorage.setItem(key,value);
 h.w.localStorage.setItem(tokenKey,token);h.w.localStorage.setItem(accountKey,account);
 h.w.setInterval=(fn,ms)=>{const timer={fn,ms,cancelled:false};timers.push(timer);return timer};h.w.clearInterval=timer=>{if(timer)timer.cancelled=true};
 const C=h.load('src/member-insight-dm.tsx').MemberInsightDm;
 return{...h,calls,timers,normal,start:props=>h.render(C,{active:true,revision:0,...props}),open:()=>h.click(h.w.document.querySelector('.midm-threads button')),text:()=>h.w.document.body.textContent,
  button:label=>[...h.w.document.querySelectorAll('button')].find(button=>button.textContent===label),
  copy:()=>Object.fromEntries(Object.keys(h.w.localStorage).map(key=>[key,h.w.localStorage.getItem(key)])),
  setMessages:next=>{messages=next},advance:ms=>{now+=ms},poll:()=>settle(()=>{now+=61000;timers.findLast(timer=>timer.ms===60000&&!timer.cancelled).fn()})};
}
async function saved(t,{count=1200,page=1}={}){
 const h=await fixture(t,{count});await h.start();await h.open();if(page>1)await h.click(h.button('過去のDM'));await settle();
 const storage=h.copy();await h.render(()=>null);return{h,storage};
}

test('同じ本人の既読DMページは60秒以内なら本文とページを即復元して通信しない',async t=>{
 const h=await fixture(t);await h.start();await h.open();await h.click(h.button('過去のDM'));
 const before=h.calls.length;await h.click(h.button('新しいDM'));
 assert.equal(h.calls.length,before);assert.match(h.text(),/1 \/ 3ページ/);assert.match(h.text(),/保存本文499/);assert.doesNotMatch(h.text(),/保存本文999/);
 await h.click(h.button('過去のDM'));assert.equal(h.calls.length,before);assert.match(h.text(),/2 \/ 3ページ/);assert.match(h.text(),/保存本文999/);
});

test('DM相手一覧から同じ相手を開き直すと前回ページを通信なしで即表示する',async t=>{
 const h=await fixture(t);await h.start();await h.open();await h.click(h.button('過去のDM'));await h.click(h.button('← DM履歴一覧'));
 const before=h.calls.length;await h.open();assert.equal(h.calls.length,before);assert.match(h.text(),/2 \/ 3ページ/);assert.match(h.text(),/保存本文999/);assert.equal(h.w.document.querySelectorAll('.midm-message').length,500);
});

test('60秒経過だけでは既読DMページ戻りと同じ相手の再選択で通信しない',async t=>{
 const h=await fixture(t);await h.start();await h.open();await h.click(h.button('過去のDM'));h.advance(61000);
 const before=h.calls.length;await h.click(h.button('新しいDM'));assert.equal(h.calls.length,before);assert.match(h.text(),/保存本文499/);
 await h.click(h.button('← DM履歴一覧'));await h.open();assert.equal(h.calls.length,before);assert.match(h.text(),/保存本文499/);
});

test('保存変更後の既読ページは即表示したまま裏で確認し、遅い別ページ応答を適用しない',async t=>{
 let hold=false;const waiting=[];
 const h=await fixture(t,{handle:async(call,normal)=>hold&&call.body.action==='person_messages'?new Promise(resolve=>waiting.push({call,resolve})):normal(call.body)});
 await h.start();await h.open();await h.click(h.button('過去のDM'));hold=true;h.setMessages(rows(1201));await h.poll();assert.equal(waiting.length,1);
 await h.click(h.button('新しいDM'));assert.match(h.text(),/1 \/ 3ページ/);assert.match(h.text(),/保存本文499/);assert.equal(h.button('過去のDM').disabled,false);assert.equal(waiting.length,2);
 await h.click(h.button('過去のDM'));assert.match(h.text(),/2 \/ 3ページ/);assert.match(h.text(),/保存本文999/);assert.equal(h.button('新しいDM').disabled,false);assert.equal(waiting.length,3);assert.equal(waiting[1].call.signal.aborted,true);
 await settle(()=>waiting[1].resolve(response({rows:rows(1201,'遅い別ページ').slice(0,500),total:1201})));
 assert.match(h.text(),/2 \/ 3ページ/);assert.doesNotMatch(h.text(),/遅い別ページ/);
 await settle(()=>waiting[2].resolve(response({rows:rows(1201,'確認後の本文').slice(500,1000),total:1201})));
 assert.match(h.text(),/確認後の本文999/);assert.doesNotMatch(h.text(),/前回表示分/);
});

test('取得中にsummaryの保存stampが変わったら旧応答を中断し新しい本文を確認する',async t=>{
 let stamp='2026-10-17T00:00:00Z';const waiting=[];
 const h=await fixture(t,{handle:async(call,normal)=>call.body.action==='summary'?response({messages:1200,threads:1,lastMessageSavedAt:stamp,lastSync:{created_at:stamp,upserted_count:1200},readerStatus:[]}):call.body.action==='person_messages'&&call.body.page===2?new Promise(resolve=>waiting.push({call,resolve})):normal(call.body)});
 await h.start();await h.open();await h.click(h.button('過去のDM'));assert.equal(waiting.length,1);
 stamp='2026-10-17T00:00:01Z';await h.poll();assert.equal(waiting.length,2);assert.equal(waiting[0].call.signal.aborted,true);
 await settle(()=>waiting[1].resolve(response({rows:rows(1200,'新stampの本文').slice(500,1000),total:1200})));
 await settle(()=>waiting[0].resolve(response({rows:rows(1200,'古stampの本文').slice(500,1000),total:1200})));
 assert.match(h.text(),/新stampの本文999/);assert.doesNotMatch(h.text(),/古stampの本文/);
 const before=h.calls.length;await settle(()=>h.w.dispatchEvent(new h.w.Event('focus')));assert.equal(h.calls.length,before);
});

test('DMの明示再確認は他の既読ページも無効化し同件数の編集を取得する',async t=>{
 const h=await fixture(t);await h.start();await h.open();await h.click(h.button('過去のDM'));h.setMessages(rows(1200,'明示確認後の本文'));
 await h.click(h.button('保存先を再確認'));assert.match(h.text(),/明示確認後の本文999/);
 const before=h.calls.length;await h.click(h.button('新しいDM'));assert.equal(h.calls.length,before+1);assert.match(h.text(),/明示確認後の本文499/);
});

test('定期確認で同stampの本文編集を検出したら同じ相手の他ページだけ再確認する',async t=>{
 let hold=false,finish;const h=await fixture(t,{handle:async(call,normal)=>call.body.action==='people'?response({rows:[person(),person('other')]}):call.body.action==='person_messages'&&call.body.personKey==='note:other'?response({rows:rows(1200,'別の相手本文').slice((call.body.page-1)*500,call.body.page*500),total:1200}):call.body.action==='person_messages'&&call.body.page===1&&hold?new Promise(resolve=>{finish=()=>resolve(normal(call.body))}):normal(call.body)});
 await h.start();await h.click([...h.w.document.querySelectorAll('.midm-threads button')].find(button=>button.textContent.includes('相手 other')));await h.click(h.button('← DM履歴一覧'));await h.open();await h.click(h.button('過去のDM'));
 h.setMessages(rows(1200,'定期確認後の本文'));await h.poll();assert.match(h.text(),/定期確認後の本文999/);
 hold=true;const before=h.calls.length;await h.click(h.button('新しいDM'));assert.equal(h.calls.length,before+1);assert.match(h.text(),/保存本文499/);assert.match(h.text(),/前回表示分・最新確認中/);assert.equal(h.button('過去のDM').disabled,false);
 await settle(finish);assert.match(h.text(),/定期確認後の本文499/);assert.doesNotMatch(h.text(),/前回表示分/);
 await h.click(h.button('← DM履歴一覧'));const beforeOther=h.calls.length;await h.click([...h.w.document.querySelectorAll('.midm-threads button')].find(button=>button.textContent.includes('相手 other')));
 assert.equal(h.calls.length,beforeOther);assert.match(h.text(),/別の相手本文499/);
});

test('Readerの新規保存signalは既読DMページも無効化して最新本文を読む',async t=>{
 const h=await fixture(t);await h.start();await h.open();await h.click(h.button('過去のDM'));
 const send=lastSaveAt=>h.w.dispatchEvent(new h.w.MessageEvent('message',{source:h.w,origin:h.w.location.origin,data:{source:'mumei-dm-status-bridge',noteId:'account_a',status:{lastSaveAt}}}));
 await settle(()=>send(100));h.setMessages(rows(1200,'Reader保存後の本文'));await settle(()=>send(200));assert.match(h.text(),/Reader保存後の本文999/);
 const before=h.calls.length;await h.click(h.button('新しいDM'));assert.equal(h.calls.length,before+1);assert.match(h.text(),/Reader保存後の本文499/);
});

test('DM本文キャッシュは直近6ページだけ保持し未表示の過去を先読みしない',async t=>{
 const h=await fixture(t,{count:4000});await h.start();await h.open();for(let i=0;i<6;i++)await h.click(h.button('過去のDM'));
 assert.deepEqual(h.calls.filter(call=>call.body.action==='person_messages').map(call=>call.body.page),[1,2,3,4,5,6,7]);
 const before=h.calls.length;for(let i=0;i<5;i++)await h.click(h.button('新しいDM'));assert.equal(h.calls.length,before);assert.match(h.text(),/2 \/ 8ページ/);
 await h.click(h.button('新しいDM'));assert.equal(h.calls.length,before+1);assert.match(h.text(),/1 \/ 8ページ/);
});

test('不完全なDMページを確認済みにせず再操作で取得をやり直す',async t=>{
 let incomplete=true;const h=await fixture(t,{handle:async(call,normal)=>call.body.action==='person_messages'&&call.body.page===2&&incomplete?response({rows:rows(10),total:1200}):normal(call.body)});
 await h.start();await h.open();await h.click(h.button('過去のDM'));assert.match(h.text(),/DM_HISTORY_INCOMPLETE/);assert.match(h.text(),/1 \/ 3ページ/);
 incomplete=false;await h.click(h.button('過去のDM'));assert.match(h.text(),/2 \/ 3ページ/);assert.match(h.text(),/保存本文999/);
 assert.deepEqual(h.calls.filter(call=>call.body.action==='person_messages').map(call=>call.body.page),[1,2,2]);
});

test('既読DMの最新確認失敗を新しい成功扱いせず、戻りで本文を保持して再確認する',async t=>{
 let fail=false,hold=false,finish;const h=await fixture(t,{handle:async(call,normal)=>call.body.action==='person_messages'&&call.body.page===2&&fail?new Response(JSON.stringify({ok:false,error:'BODY_UNAVAILABLE'}),{status:500}):call.body.action==='person_messages'&&call.body.page===2&&hold?new Promise(resolve=>{finish=()=>resolve(normal(call.body))}):normal(call.body)});
 await h.start();await h.open();await h.click(h.button('過去のDM'));fail=true;await h.poll();assert.match(h.text(),/BODY_UNAVAILABLE/);assert.match(h.text(),/保存本文999/);
 await h.click(h.button('新しいDM'));fail=false;hold=true;const before=h.calls.length;await h.click(h.button('過去のDM'));
 assert.equal(h.calls.length,before+1);assert.match(h.text(),/保存本文999/);assert.match(h.text(),/前回表示分・最新確認中/);assert.equal(h.button('新しいDM').disabled,false);
 await settle(finish);assert.doesNotMatch(h.text(),/BODY_UNAVAILABLE|前回表示分/);
});

for(const transition of ['account','token'])test(`既読DMページも${transition}切替後には再利用しない`,async t=>{
 const h=await fixture(t);await h.start();await h.open();await h.click(h.button('過去のDM'));h.setMessages(rows(1200,'切替後の本文'));
 h.w.localStorage.setItem(transition==='account'?accountKey:tokenKey,transition==='account'?'account_b':'token-b');await h.start();await settle();await h.open();
 assert.match(h.text(),/切替後の本文499/);assert.doesNotMatch(h.text(),/保存本文/);const before=h.calls.length;await h.click(h.button('過去のDM'));
 assert.equal(h.calls.length,before+1);assert.match(h.text(),/切替後の本文999/);assert.doesNotMatch(h.text(),/保存本文/);
});

test('新しいdocumentで前回の相手と表示500件を即表示し、最新照合は1ページだけ裏で行う',async t=>{
 const {storage}=await saved(t),waiting=[];
 const h=await fixture(t,{storage,handle:call=>new Promise(resolve=>waiting.push({call,resolve}))});await h.start();
 assert.match(h.text(),/相手 peer/);assert.match(h.text(),/保存本文499/);assert.match(h.text(),/前回表示分・最新確認中/);assert.doesNotMatch(h.w.document.querySelector(".midm-previous").textContent,/—/);assert.doesNotMatch(h.text(),/DM履歴を読み込み中/);
 assert.deepEqual(h.calls.filter(call=>call.body.action==='person_messages').map(call=>call.body.page),[1]);
 const copies=Object.entries(storage).filter(([key])=>key.startsWith(savedPrefix));assert.equal(copies.length,1);const copy=JSON.parse(copies[0][1]);assert.equal(copy.value.messages.length,500);assert.equal(copy.value.messageTotal,1200);assert.equal(copy.value.selected.room_count,2);assert.doesNotMatch(copies[0][0],/token-a/);
 await settle(()=>waiting.filter(entry=>entry.call.body.action!=='person_messages').forEach(entry=>entry.resolve(h.normal(entry.call.body))));
 await settle(()=>waiting.filter(entry=>entry.call.body.action==='person_messages').forEach(entry=>entry.resolve(h.normal(entry.call.body))));
 assert.equal(h.w.document.querySelectorAll('.midm-message').length,500);assert.match(h.text(),/添付の名前/);assert.equal(h.w.document.querySelector('.midm-message a').href,'https://note.test/file');assert.doesNotMatch(h.text(),/前回表示分/);
 assert.equal(h.calls.filter(call=>call.body.action==='person_messages').length,1);
});

test('過去ページを明示した時だけ取得し、定期照合は選択した過去ページを維持する',async t=>{
 const h=await fixture(t);await h.start();await h.open();assert.deepEqual(h.calls.filter(call=>call.body.action==='person_messages').map(call=>call.body.page),[1]);
 await h.click(h.button('過去のDM'));assert.equal(h.w.document.querySelectorAll('.midm-message').length,500);assert.match(h.text(),/2 \/ 3ページ/);assert.match(h.text(),/保存本文999/);assert.doesNotMatch(h.w.document.querySelector('.midm-messages').textContent,/保存本文0(?:あなた|相手|$)/);
 await h.poll();assert.deepEqual(h.calls.filter(call=>call.body.action==='person_messages').map(call=>call.body.page),[1,2,2]);assert.match(h.text(),/2 \/ 3ページ/);assert.match(h.text(),/保存本文999/);
 await h.click(h.button('過去のDM'));assert.equal(h.w.document.querySelectorAll('.midm-message').length,200);assert.equal(h.button('過去のDM').disabled,true);
 const copy=JSON.parse(Object.entries(h.copy()).find(([key])=>key.startsWith(savedPrefix))[1]);assert.equal(copy.value.messages.length,200);assert.equal(copy.value.messagePage,3);
 await h.click(h.button('新しいDM'));assert.match(h.text(),/2 \/ 3ページ/);
});

test('前回が過去ページでも新しい起動では表示コピーを保ちながら最新ページだけ確認する',async t=>{
 const {storage}=await saved(t,{page:2}),waiting=[];
 const h=await fixture(t,{storage,handle:call=>new Promise(resolve=>waiting.push({call,resolve}))});await h.start();assert.match(h.text(),/保存本文999/);assert.match(h.text(),/前回表示分・最新確認中/);
 assert.deepEqual(h.calls.filter(call=>call.body.action==='person_messages').map(call=>call.body.page),[1]);
 await settle(()=>waiting.filter(entry=>entry.call.body.action!=='person_messages').forEach(entry=>entry.resolve(h.normal(entry.call.body))));
 assert.deepEqual(h.calls.filter(call=>call.body.action==='person_messages').map(call=>call.body.page),[1]);
 await settle(()=>waiting.filter(entry=>entry.call.body.action==='person_messages').forEach(entry=>entry.resolve(h.normal(entry.call.body))));assert.match(h.text(),/1 \/ 3ページ/);assert.match(h.text(),/保存本文499/);assert.doesNotMatch(h.text(),/保存本文999/);
});

for(const scope of [{token:'token-b',account:'account_a'},{token:'token-a',account:'account_b'}])test(`前回DMのコピーは本人とtoken両方の一致が必要 (${scope.token}/${scope.account})`,async t=>{
 const {storage}=await saved(t,{count:1});const h=await fixture(t,{storage,...scope,handle:async()=>new Promise(()=>{})});await h.start();assert.doesNotMatch(h.text(),/保存本文|相手 peer|前回表示分/);assert.equal(h.w.document.querySelectorAll('.midm-message').length,0);
});

test('最新の空の会話で前回本文を消し、次の起動でも削除済み本文を戻さない',async t=>{
 const {storage}=await saved(t,{count:1}),h=await fixture(t,{storage,messages:[]});await h.start();await settle();assert.doesNotMatch(h.text(),/保存本文|前回表示分/);assert.match(h.text(),/この人との保存済みDMはありません/);
 const copy=JSON.parse(Object.entries(h.copy()).find(([key])=>key.startsWith(savedPrefix))[1]);assert.equal(copy.value.messageTotal,0);assert.deepEqual(copy.value.messages,[]);
});

test('同じ件数・保存時刻でも新しい起動の実本文を確認し編集を表示する',async t=>{
 const {storage}=await saved(t,{count:1}),h=await fixture(t,{storage,messages:rows(1,'編集された本文')});await h.start();await settle();assert.match(h.text(),/編集された本文0/);assert.doesNotMatch(h.text(),/保存本文0/);assert.equal(h.calls.filter(call=>call.body.action==='person_messages').length,1);
});

test('最新本文の失敗は前回表示を保持し時刻を進めず、明示再試行で置換する',async t=>{
 const {storage}=await saved(t,{count:1});let fail=true;
 const h=await fixture(t,{storage,messages:rows(1,'再試行後の本文'),handle:async(call,normal)=>call.body.action==='person_messages'&&fail?new Response(JSON.stringify({ok:false,error:'BODY_UNAVAILABLE'}),{status:500}):normal(call.body)});await h.start();await settle();
 assert.match(h.text(),/保存本文0/);assert.match(h.text(),/前回表示分・最新確認できず/);assert.equal(h.calls.filter(call=>call.body.action==='person_messages').length,1);
 const key=Object.keys(storage).find(key=>key.startsWith(savedPrefix));assert.equal(JSON.parse(h.copy()[key]).savedAt,JSON.parse(storage[key]).savedAt);
 fail=false;await h.click(h.button('DM本文を再確認'));assert.match(h.text(),/再試行後の本文0/);assert.doesNotMatch(h.text(),/前回表示分|BODY_UNAVAILABLE/);assert.equal(h.calls.filter(call=>call.body.action==='person_messages').length,2);
});

test('相手を切替えた後の遅い過去ページで別人の本文を上書きしない',async t=>{
 let finish,held;const h=await fixture(t,{handle:async(call,normal)=>call.body.action==='people'?response({rows:[person(),person('other')]}):call.body.action==='person_messages'&&call.body.page===2?new Promise(resolve=>{finish=resolve;held=call}):call.body.action==='person_messages'&&call.body.personKey==='note:other'?response({rows:[{message_key:'other',body:'別人の本文'}],total:1}):normal(call.body)});
 await h.start();await h.open();await h.click(h.button('過去のDM'));await h.click(h.button('← DM履歴一覧'));await h.click([...h.w.document.querySelectorAll('.midm-threads button')].find(button=>button.textContent.includes('相手 other')));assert.equal(held.signal.aborted,true);assert.match(h.text(),/別人の本文/);
 await settle(()=>finish(response({rows:rows(500,'遅れた過去本文'),total:1200})));assert.match(h.text(),/別人の本文/);assert.doesNotMatch(h.text(),/遅れた過去本文/);
});

test('手動の過去ページが遅くても定期summary確認で最新ページに戻したり中断しない',async t=>{
 let finish,held;
 const h=await fixture(t,{handle:async(call,normal)=>call.body.action==='person_messages'&&call.body.page===2?new Promise(resolve=>{finish=resolve;held=call}):normal(call.body)});
 await h.start();await h.open();await h.click(h.button('過去のDM'));assert.equal(held.signal.aborted,false);await h.poll();assert.equal(held.signal.aborted,false);
 assert.deepEqual(h.calls.filter(call=>call.body.action==='person_messages').map(call=>call.body.page),[1,2]);
 await settle(()=>finish(response({rows:rows(1200).slice(500,1000),total:1200})));assert.match(h.text(),/2 \/ 3ページ/);assert.match(h.text(),/保存本文999/);
});

for(const status of [401,403])test(`保存先からHTTP ${status}が返ったら前回の私的DM表示と本人copyを消す`,async t=>{
 const {storage}=await saved(t,{count:1}),h=await fixture(t,{storage,handle:async()=>new Response(JSON.stringify({ok:false,error:'INSIGHT_LOGIN_REQUIRED'}),{status})});await h.start();await settle();
 assert.doesNotMatch(h.text(),/保存本文|相手 peer|前回表示分/);assert.equal(h.w.document.querySelectorAll('.midm-message').length,0);assert.match(h.text(),/INSIGHT_LOGIN_REQUIRED/);assert.equal(Object.keys(h.copy()).filter(key=>key.startsWith(savedPrefix)).length,0);
});

for(const action of ['summary','people','person_messages'])test(`並列取得の${action}が拒否されたら遅い成功応答でDMコピーを復活させない`,async t=>{
 const {storage}=await saved(t,{count:1}),waiting=[];
 const h=await fixture(t,{storage,handle:call=>call.body.action===action?new Response('Denied',{status:403}):new Promise(resolve=>waiting.push({call,resolve}))});await h.start();await settle();
 assert.doesNotMatch(h.text(),/保存本文|相手 peer|前回表示分/);assert.equal(Object.keys(h.copy()).filter(key=>key.startsWith(savedPrefix)).length,0);assert.ok(waiting.every(entry=>entry.call.signal.aborted));
 await settle(()=>waiting.forEach(entry=>entry.resolve(h.normal(entry.call.body))));assert.doesNotMatch(h.text(),/保存本文|相手 peer|前回表示分/);assert.equal(Object.keys(h.copy()).filter(key=>key.startsWith(savedPrefix)).length,0);
});

test('相手を選び直して取得待ちの空表示を確認済みのDMコピーとして保存しない',async t=>{
 const h=await fixture(t,{count:1,handle:async(call,normal)=>call.body.action==='people'?response({rows:[person(),person('other')]}):call.body.action==='person_messages'&&call.body.personKey==='note:other'?new Promise(()=>{}):normal(call.body)});
 await h.start();await h.open();await h.click(h.button('← DM履歴一覧'));await h.click([...h.w.document.querySelectorAll('.midm-threads button')].find(button=>button.textContent.includes('相手 other')));assert.match(h.text(),/DM本文を読み込み中/);
 const copy=JSON.parse(Object.entries(h.copy()).find(([key])=>key.startsWith(savedPrefix))[1]);assert.equal(copy.value.selected,null);assert.deepEqual(copy.value.messages,[]);
});

test('表示中に同じtokenのnote本人が切り替わった時も旧本文をすぐ隠す',async t=>{
 let changed=false;const h=await fixture(t,{count:1,handle:async(call,normal)=>changed?new Promise(()=>{}):normal(call.body)});await h.start();await h.open();assert.match(h.text(),/保存本文0/);
 changed=true;await settle(()=>{h.w.localStorage.setItem(accountKey,'account_b');h.w.dispatchEvent(new h.w.Event('mumei-insight-accounts'))});assert.doesNotMatch(h.text(),/保存本文|相手 peer|前回表示分/);
});

for(const action of ['summary','people','stats','person_messages'])test(`一時的な認証DB障害(${action})は保存済みDMを消さず、再確認で回復する`,async t=>{
 const {storage}=await saved(t,{count:1});let fail=true;
 const h=await fixture(t,{storage,handle:async(call,normal)=>call.body.action===action&&fail?new Response(JSON.stringify({ok:false,error:'AUTH_CHECK_UNAVAILABLE'}),{status:500}):normal(call.body)});
 await h.start();await settle();assert.match(h.text(),/保存本文0/);assert.match(h.text(),/AUTH_CHECK_UNAVAILABLE/);
 const key=Object.keys(storage).find(key=>key.startsWith(savedPrefix));assert.ok(h.copy()[key],'authorization database failure must not remove saved display');
 fail=false;await h.click(h.button('保存先を再確認'));await settle();assert.match(h.text(),/保存本文0/);assert.doesNotMatch(h.text(),/AUTH_CHECK_UNAVAILABLE/);assert.equal(h.w.localStorage.getItem(tokenKey),'token-a');
});


const hydrateDm=(h,storage)=>settle(()=>{for(const [key,value]of Object.entries(storage))if(key.startsWith(savedPrefix))h.w.localStorage.setItem(key,value);h.w.dispatchEvent(new h.w.Event('mumei-insight-storage-hydrated'))});
test('遅い保管庫の復元は待機中のDMを元の確認時刻で表示し追加通信を起こさない',async t=>{
 const {storage}=await saved(t,{count:1}),waiting=[];
 const h=await fixture(t,{messages:rows(1,'最新本文'),handle:call=>new Promise(resolve=>waiting.push({call,resolve}))});await h.start();assert.equal(h.calls.length,3);assert.doesNotMatch(h.text(),/保存本文/);const timer=h.timers.find(item=>item.ms===60000);
 await hydrateDm(h,storage);assert.match(h.text(),/保存本文0/);assert.match(h.text(),/相手 peer/);assert.equal(h.timers.filter(item=>item.ms===60000).length,1);assert.equal(timer.cancelled,false);assert.match(h.text(),/前回表示分・最新確認中/);assert.equal(h.w.document.querySelector('.midm-history-panel').open,true);assert.equal(h.calls.length,3);
 const key=Object.keys(storage).find(key=>key.startsWith(savedPrefix));assert.equal(JSON.parse(h.copy()[key]).savedAt,JSON.parse(storage[key]).savedAt);
 await hydrateDm(h,storage);assert.equal(h.calls.length,3);
 await settle(()=>waiting.filter(entry=>entry.call.body.action!=='person_messages').forEach(entry=>entry.resolve(h.normal(entry.call.body))));
 assert.equal(h.calls.filter(call=>call.body.action==='person_messages').length,1);
 await settle(()=>waiting.filter(entry=>entry.call.body.action==='person_messages').forEach(entry=>entry.resolve(h.normal(entry.call.body))));assert.match(h.text(),/最新本文0/);assert.doesNotMatch(h.text(),/保存本文0|前回表示分/);
 await hydrateDm(h,storage);assert.match(h.text(),/最新本文0/);assert.doesNotMatch(h.text(),/保存本文0/);
});

for(const action of ['people','summary'])test(`遅いDMコピーは先に成功した${action}の空結果を上書きしない`,async t=>{
 const {storage}=await saved(t,{count:1});
 const h=await fixture(t,{handle:async(call)=>call.body.action===action?response(action==='people'?{rows:[]}:{messages:0,threads:0,readerStatus:[]}):new Promise(()=>{})});await h.start();await settle();await hydrateDm(h,storage);
 assert.doesNotMatch(h.text(),/保存本文0/);assert.equal(h.calls.filter(call=>call.body.action==='person_messages').length,0);
 if(action==='people')assert.equal(h.w.document.querySelectorAll('.midm-threads button').length,0);
 else assert.equal(h.w.document.querySelectorAll('.midm-control-state > span b')[1].textContent,'0');
});

for(const status of [401,403])test(`HTTP ${status}後の遅い保管庫イベントでDMを復活させない`,async t=>{
 const {storage}=await saved(t,{count:1}),h=await fixture(t,{handle:async()=>Response.json({ok:false,error:'DENIED'},{status})});await h.start();await settle();await hydrateDm(h,storage);assert.doesNotMatch(h.text(),/保存本文|相手 peer|前回表示分/);
});

for(const transition of ['account','token','revision','inactive','user'])test(`遅いDMコピーは${transition}変更後の画面を巻き戻さない`,async t=>{
 const {storage}=await saved(t,{count:1}),h=await fixture(t,{handle:async()=>new Promise(()=>{})});await h.start();
 if(transition==='account')h.w.localStorage.setItem(accountKey,'account_b');
 if(transition==='token')h.w.localStorage.setItem(tokenKey,'token-b');
 if(transition==='revision')await h.start({revision:1});
 if(transition==='inactive')await h.start({active:false});
 if(transition==='user')await h.click(h.w.document.querySelector('.midm-control details summary'));
 const count=h.calls.length;await hydrateDm(h,storage);assert.doesNotMatch(h.text(),/保存本文|相手 peer|前回表示分/);assert.equal(h.calls.length,count);
});


test('一時的なDM取得失敗後の保管庫復旧もコピーだけ表示し次の通常照合を維持する',async t=>{
 const {storage}=await saved(t,{count:1}),h=await fixture(t,{handle:async()=>Response.json({ok:false,error:'TEMPORARILY_OFFLINE'},{status:500})});await h.start();await settle();const before=h.calls.length;
 await hydrateDm(h,storage);assert.match(h.text(),/保存本文0/);assert.match(h.text(),/前回表示分・最新確認できず/);assert.match(h.text(),/TEMPORARILY_OFFLINE/);assert.equal(h.calls.length,before);
 const key=Object.keys(storage).find(key=>key.startsWith(savedPrefix));assert.equal(JSON.parse(h.copy()[key]).savedAt,JSON.parse(storage[key]).savedAt);
});
