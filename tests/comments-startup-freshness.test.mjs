import test from 'node:test';
import assert from 'node:assert/strict';
import * as React from 'react';
import { sceneFixture, pause } from './react-scene-fixture.mjs';

const tokenKey='mumei-insight-access-token';
const event=(key,body,extra={})=>({comment_key:key,body,actor_name:'相手',actor_url:'https://note.com/peer',occurred_at:'2026-10-08T09:00:00Z',...extra});
const saved=rows=>({version:1,rows,total:rows.length,latestAt:rows[0]?.occurred_at||null,savedAt:1});
const response=(rows,total=rows.length)=>Response.json({ok:true,rows,total});
async function settle(work=()=>{}){await React.act(async()=>{work();for(let i=0;i<5;i++)await pause()})}
async function fixture(t,{snapshot=null,fetch,globals={},fallback=async()=>{throw new Error('offline')}}={}){
 const writes=[],reads=[];
 const h=await sceneFixture(t,{fetch,globals:{IntersectionObserver:class{observe(){}disconnect(){}},...globals},dependencies:{
  './creator-avatar':{CreatorAvatar:()=>React.createElement('span',{className:'fixture-avatar'})},
  './insight-member-db-fallback':{memberReadAuthFailure:message=>/INSIGHT_(SESSION_INVALID|LOGIN_REQUIRED)|HTTP_40[13]/.test(message),memberDbReadFallback:fallback},
  './insight-persistent-cache':{readInsightSnapshot:async key=>{reads.push(key);return typeof snapshot==='function'?snapshot(key):snapshot},writeInsightSnapshot:async(key,value)=>{writes.push({key,value})}},
 }});
 h.w.localStorage.setItem(tokenKey,'token-a');
 const Component=h.load('src/member-insight-comments-final.tsx').MemberInsightCommentsFinal;
 return{...h,Component,writes,reads,start:props=>h.render(Component,{noteId:'account_a',...props}),body:()=>h.w.document.querySelector('.micf')?.textContent||''};
}

test('起動時は保存済み本文を先に出さず、最新本文と♡をアイコン待ちなしで表示する',async t=>{
 let deliver,iconCalls=0;
 const old=event('c1','古い本文',{is_creator_liked:false,actor_image_url:'https://images.test/saved.png'});
 const h=await fixture(t,{snapshot:saved([old]),fetch:async(url)=>{
  if(String(url).includes('creator-icons')){iconCalls++;return new Promise(()=>{})}
  return new Promise(resolve=>{deliver=()=>resolve(response([event('c1','最新の本文',{is_creator_liked:true})]))});
 }});
 await h.start();
 assert.doesNotMatch(h.body(),/古い本文|最新の本文/);
 await settle(deliver);
 assert.match(h.body(),/最新の本文/);assert.doesNotMatch(h.body(),/古い本文/);
 assert.match(h.body(),/♥ あなたの♡/);assert.ok(iconCalls>0);
 assert.equal(h.writes.at(-1).value.rows[0].body,'最新の本文');
 assert.equal(h.writes.at(-1).value.rows[0].actor_image_url,'https://images.test/saved.png');
});

test('接続失敗時だけ同じアカウントの保存履歴を復元する',async t=>{
 const h=await fixture(t,{snapshot:saved([event('old','保存されたコメント')]),fetch:async()=>{throw new Error('offline')}});
 await h.start();await settle();
 assert.match(h.body(),/保存されたコメント/);assert.match(h.body(),/通信を確認できないため保存済み履歴を表示中/);
 assert.equal(h.writes.length,0,'失敗時は新しい取得時刻や空の履歴で保存を上書きしない');
});

test('アカウント切替後は前の本文・遅い応答・キャッシュを使わない',async t=>{
 let deliverA,deliverB;
 const requests=[];
 const h=await fixture(t,{fetch:async(_url,init)=>{
  requests.push({token:init.headers['X-Insight-Token'],signal:init.signal});
  return new Promise(resolve=>{
   if(init.headers['X-Insight-Token']==='token-a')deliverA=()=>resolve(response([event('a','前のアカウント本文')]));
   else deliverB=()=>resolve(response([event('b','切替後の本文')]));
  });
 }});
 await h.start();
 h.w.localStorage.setItem(tokenKey,'token-b');await h.start({noteId:'account_b'});
 assert.equal(requests[0].signal.aborted,true);
 await settle(deliverA);assert.doesNotMatch(h.body(),/前のアカウント本文/);assert.equal(h.writes.length,0);
 await settle(deliverB);assert.match(h.body(),/切替後の本文/);assert.doesNotMatch(h.body(),/前のアカウント本文/);
 assert.equal(h.writes.at(-1).key,'comments-all:account_b');
});

test('メモリキャッシュもアカウント別に分けて再取得を先に行う',async t=>{
 let deliverB;
 const h=await fixture(t,{fetch:async(_url,init)=>init.headers['X-Insight-Token']==='token-a'?response([event('a','アカウントAの履歴')]):new Promise(resolve=>{deliverB=()=>resolve(response([event('b','アカウントBの履歴')]))})});
 await h.start();assert.match(h.body(),/アカウントAの履歴/);
 h.w.localStorage.setItem(tokenKey,'token-b');await h.start({noteId:'account_b'});
 assert.doesNotMatch(h.body(),/アカウントAの履歴/);
 await settle(deliverB);assert.match(h.body(),/アカウントBの履歴/);
});

test('期限を過ぎたメモリ履歴と明示更新は新しい応答が届くまで表示しない',async t=>{
 let now=Date.now(),deliver,hold=false;
 class Clock extends Date{static now(){return now}}
 const h=await fixture(t,{globals:{Date:Clock},fetch:async()=>hold?new Promise(resolve=>{deliver=()=>resolve(response([event('new','更新後のコメント')]))}):response([event('old','前回のコメント')])});
 await h.start();assert.match(h.body(),/前回のコメント/);
 await h.render(()=>null,{});now+=61000;hold=true;await h.start();assert.doesNotMatch(h.body(),/前回のコメント/);
 await settle(deliver);assert.match(h.body(),/更新後のコメント/);
 await h.start({revision:1});assert.doesNotMatch(h.body(),/更新後のコメント/);
 await settle(deliver);assert.match(h.body(),/更新後のコメント/);
});

test('全履歴の複数ページを失わず保存し、アイコン不応答でも先に本文を表示する',async t=>{
 const events=Array.from({length:620},(_,i)=>event('c'+i,'履歴'+i,{occurred_at:new Date(Date.parse('2026-10-08T09:00:00Z')-i*1000).toISOString()}));
 let page2;
 const h=await fixture(t,{fetch:async(url,init)=>{
  if(String(url).includes('creator-icons'))return new Promise(()=>{});
  const body=JSON.parse(init.body);
  if(body.page===2)return new Promise(resolve=>{page2=()=>resolve(response(events.slice(500),620))});
  return response(events.slice(0,body.pageSize),620);
 }});
 await h.start();await settle();assert.match(h.body(),/履歴0/);assert.match(h.body(),/620件/);assert.equal(h.writes.length,0);
 await settle(page2);
 const list=h.writes.at(-1).value.rows;
 assert.equal(list.length,620);assert.equal(new Set(list.map(row=>row.comment_key)).size,620);
 assert.equal(list[0].comment_key,'c0');assert.equal(list.at(-1).comment_key,'c619');
});

test('対応状況フィルター・会話詳細・最後の返信への♡照合を維持する',async t=>{
 const calls=[];
 const root={root_key:'root-1',root_body:'返信済み会話',actor_name:'相手',actor_url:'https://note.com/peer',status:'replied',root_at:'2026-10-08T09:00:00Z'};
 const h=await fixture(t,{fetch:async(url,init)=>{
  const body=JSON.parse(init.body);calls.push(body);
  if(String(url).includes('creator-icons'))return new Promise(()=>{});
  if(body.action==='comments_filtered')return response([root]);
  if(body.action==='batch')return response([{rootKey:'root-1',exact:true,counterpartHearted:true,counterpartName:'相手'}]);
  if(body.action==='comment_thread')return response([event('reply','会話の返信本文',{is_creator:true})]);
  return response([]);
 }});
 await h.start();const tab=[...h.w.document.querySelectorAll('.micf-tabs button')].find(button=>button.textContent==='自分返信');await h.click(tab);
 assert.match(h.body(),/返信済み会話/);assert.match(h.body(),/最終返信に相手さんの♡あり/);
 assert.equal(calls.find(call=>call.action==='comments_filtered').status,'replied');
 const details=h.w.document.querySelector('.micf-thread-list details');await settle(()=>{details.open=true;details.dispatchEvent(new h.w.Event('toggle'))});
 assert.match(h.body(),/会話の返信本文/);assert.equal(h.w.document.querySelector('.micf-tabs .active').textContent,'自分返信');
});

test('画面を離れたら読込を中断し遅延した応答を保存しない',async t=>{
 let deliver,signal;
 const h=await fixture(t,{fetch:async(_url,init)=>{signal=init.signal;return new Promise(resolve=>{deliver=()=>resolve(response([event('late','離脱後の本文')]))})}});
 await h.start();await h.render(()=>React.createElement('p',null,'別の画面'),{});
 assert.equal(signal.aborted,true);await settle(deliver);assert.equal(h.writes.length,0);assert.doesNotMatch(h.w.document.body.textContent,/離脱後の本文/);
});

test('新規行が古い日時へ追加された場合は差分件数の不足を検出して全行を回収する',async t=>{
 const latest=event('latest','最新の既存コメント'),backfill=event('backfill','過去へ追加されたコメント',{occurred_at:'2026-09-01T00:00:00Z'});
 const calls=[];
 const h=await fixture(t,{snapshot:saved([latest]),fetch:async(url,init)=>{
  if(String(url).includes('creator-icons'))return Response.json({items:[]});
  const body=JSON.parse(init.body);calls.push(body);
  if(body.pageSize===50||body.dateFrom)return response([latest],2);
  return response([latest,backfill],2);
 }});
 await h.start();await settle();
 assert.match(h.body(),/過去へ追加されたコメント/);
 assert.equal(h.writes.at(-1).value.rows.length,2);
 assert.ok(calls.some(call=>call.pageSize===500&&!call.dateFrom),'差分で欠けた古い行は最新全件から回収する');
});

test('削除と追加が同件数でも古い行を残さず現在の全件へ置き換える',async t=>{
 const old=event('deleted','削除済みコメント'),current=event('new','現在のコメント');
 const h=await fixture(t,{snapshot:saved([old]),fetch:async(url)=>String(url).includes('creator-icons')?Response.json({items:[]}):response([current],1)});
 await h.start();await settle();
 assert.match(h.body(),/現在のコメント/);assert.doesNotMatch(h.body(),/削除済みコメント/);
 assert.deepEqual(Array.from(h.writes.at(-1).value.rows,row=>row.comment_key),['new']);
});

test('取得とDB代替が中断を無視しても時間切れ後に保存履歴へ戻る',async t=>{
 const h=await fixture(t,{snapshot:saved([event('old','通信停止中の保存履歴')]),fetch:async()=>new Promise(()=>{}),fallback:async()=>new Promise(()=>{}),globals:{setTimeout:(fn,ms,...args)=>setTimeout(fn,ms===15000?10:ms,...args)}});
 const nativeTimer=h.w.setTimeout.bind(h.w);h.w.setTimeout=(fn,ms,...args)=>nativeTimer(fn,ms===15000?10:ms,...args);
 await h.start();
 await React.act(async()=>{await new Promise(resolve=>setTimeout(resolve,45));await pause()});
 assert.match(h.body(),/通信停止中の保存履歴/);assert.match(h.body(),/通信を確認できないため保存済み履歴を表示中/);
 assert.equal(h.w.document.querySelector('.micf').getAttribute('aria-busy'),'false');assert.equal(h.writes.length,0);
});
