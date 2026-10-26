import test from 'node:test';
import assert from 'node:assert/strict';
import * as React from 'react';
import { sceneFixture, pause } from './react-scene-fixture.mjs';

const tokenKey='mumei-insight-access-token';
const event=(key,body,extra={})=>({comment_key:key,body,actor_name:'相手',actor_url:'https://note.com/peer',occurred_at:'2026-10-08T09:00:00Z',...extra});
const saved=rows=>({version:1,rows,total:rows.length,latestAt:rows[0]?.occurred_at||null,savedAt:1});
const response=(rows,total=rows.length)=>Response.json({ok:true,rows,total});
async function settle(work=()=>{}){await React.act(async()=>{work();for(let i=0;i<5;i++)await pause()})}
async function fixture(t,{snapshot=null,stored=null,storedToken="token-a",fetch,refreshFetch=async()=>Response.json({ok:true,paused:true,reason:'maintenance'}),globals={},fallback=async()=>{throw new Error('offline')}}={}){
 const writes=[],reads=[];
 const h=await sceneFixture(t,{fetch:(url,init)=>String(url).includes('/insight-comment-refresh')?refreshFetch(url,init):fetch(url,init),globals:{IntersectionObserver:class{observe(){}disconnect(){}},...globals},dependencies:{
  './creator-avatar':{CreatorAvatar:()=>React.createElement('span',{className:'fixture-avatar'})},
  './insight-member-db-fallback':{memberReadAuthFailure:message=>/INSIGHT_(SESSION_INVALID|LOGIN_REQUIRED)|HTTP_40[13]/.test(message),memberDbReadFallback:fallback},
  './insight-persistent-cache':{readInsightSnapshot:async key=>{reads.push(key);return typeof snapshot==='function'?snapshot(key):snapshot},writeInsightSnapshot:async(key,value)=>{writes.push({key,value})}},
 }});
 h.w.localStorage.setItem(tokenKey,'token-a');
 const copies=h.load('src/insight-saved-view.ts');
 if(stored)copies.writeSavedInsightView('comments-default',{account:'account_a',token:storedToken},{rows:stored.rows,total:stored.total},stored.savedAt||1);
 const Component=h.load(process.env.COMMENTS_REPRO_SOURCE||'src/member-insight-comments-final.tsx').MemberInsightCommentsFinal;
 return{...h,Component,writes,reads,savedView:()=>copies.readSavedInsightView('comments-default',{account:'account_a',token:'token-a'}),start:props=>h.render(Component,{noteId:'account_a',...props}),body:()=>h.w.document.querySelector('.micf')?.textContent||''};
}

test('起動時は前回保存本文を確認中として表示し、最新本文と♡へアイコン待ちなしで置換する',async t=>{
 let deliver,iconCalls=0;
 const old=event('c1','古い本文',{is_creator_liked:false,actor_image_url:'https://images.test/saved.png'});
 const h=await fixture(t,{stored:saved([old]),fetch:async(url)=>{
  if(String(url).includes('creator-icons')){iconCalls++;return new Promise(()=>{})}
  return new Promise(resolve=>{deliver=()=>resolve(response([event('c1','最新の本文',{is_creator_liked:true})]))});
 }});
 await h.start();
 assert.match(h.body(),/古い本文/);assert.match(h.body(),/前回保存分を表示・最新確認中/);assert.doesNotMatch(h.body(),/最新の本文/);
 await settle(deliver);
 assert.match(h.body(),/最新の本文/);assert.doesNotMatch(h.body(),/古い本文/);
 assert.match(h.body(),/♥ あなたの♡/);assert.equal(iconCalls,0,"保存済みアイコンを使い余分な取得をしない");
 assert.doesNotMatch(h.body(),/前回保存分を表示・最新確認中/);
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

test('期限を過ぎた同session履歴と明示更新は表示を保って新しい本文を確認する',async t=>{
 let now=Date.now(),deliver,hold=false;
 class Clock extends Date{static now(){return now}}
 const h=await fixture(t,{globals:{Date:Clock},fetch:async()=>hold?new Promise(resolve=>{deliver=()=>resolve(response([event('new','更新後のコメント')]))}):response([event('old','前回のコメント')])});
 await h.start();assert.match(h.body(),/前回のコメント/);
 await h.render(()=>null,{});now+=61000;hold=true;await h.start();assert.match(h.body(),/前回のコメント/);assert.match(h.body(),/保存先のコメント履歴を確認中/);
 await settle(deliver);assert.match(h.body(),/更新後のコメント/);
 await h.start({revision:1});assert.match(h.body(),/更新後のコメント/);assert.match(h.body(),/保存先のコメント履歴を確認中/);
 await settle(deliver);assert.match(h.body(),/更新後のコメント/);
});

test('起動は500件だけ確認し、続きの操作で次ページを読み保存コピーは500件に制限する',async t=>{
 const events=Array.from({length:620},(_,i)=>event('c'+i,'履歴'+i,{occurred_at:new Date(Date.parse('2026-10-08T09:00:00Z')-i*1000).toISOString()})),calls=[];
 let page2;
 const h=await fixture(t,{fetch:async(url,init)=>{
  if(String(url).includes('creator-icons'))return new Promise(()=>{});
  const body=JSON.parse(init.body);calls.push(body);
  if(body.page===2)return new Promise(resolve=>{page2=()=>resolve(response(events.slice(500),620))});
  return response(events.slice(0,body.pageSize),620);
 }});
 await h.start();await settle();assert.match(h.body(),/履歴0/);assert.match(h.body(),/620件/);
 assert.deepEqual(calls.map(x=>[x.page,x.pageSize]),[[1,500]]);assert.equal(h.savedView().value.rows.length,500);
 for(let i=0;i<5;i++)await h.click(h.w.document.querySelector('.micf-more button'));
 assert.deepEqual(calls.map(x=>x.page),[1,2]);await settle(page2);
 await h.click(h.w.document.querySelector('.micf-more button'));
 assert.equal(h.w.document.querySelectorAll('.micf-event-list article').length,620);assert.match(h.body(),/履歴619/);
 assert.equal(h.savedView().value.rows.length,500);assert.equal(h.savedView().value.total,620);
 assert.equal(h.writes.at(-1).value.rows.length,500,'legacy fallbackも全本文を複製しない');
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

test('件数が同じでも最新50件の外にある本文と♡の更新を保存履歴で覆わない',async t=>{
 const rows=Array.from({length:80},(_,i)=>event('c'+i,'保存本文'+i,{occurred_at:new Date(Date.parse('2026-10-08T09:00:00Z')-i*1000).toISOString(),actor_image_url:'https://images.test/peer.png'}));
 const current=rows.map(row=>row.comment_key==='c79'?{...row,body:'過去の本文も更新済み',is_creator_liked:true}:row),calls=[];
 const h=await fixture(t,{snapshot:saved(rows),fetch:async(_url,init)=>{
  const body=JSON.parse(init.body);calls.push(body);
  return response(current.slice((body.page-1)*body.pageSize,body.page*body.pageSize),current.length);
 }});
 await h.start();await settle();
 assert.match(h.body(),/過去の本文も更新済み/);assert.doesNotMatch(h.body(),/保存本文79/);
 assert.equal(h.writes.at(-1).value.rows.find(row=>row.comment_key==='c79').is_creator_liked,true);
 assert.ok(calls.some(call=>call.pageSize===500),'50件probeの件数一致だけで全件を確認済みにしない');
});

test('HTTP200の壊れた一覧を0件成功として保存せず前回履歴と取得失敗を残す',async t=>{
 const h=await fixture(t,{snapshot:saved([event('saved','壊れた応答時の保存本文')]),fetch:async()=>new Response('{broken json',{status:200,headers:{'content-type':'application/json'}})});
 await h.start();await settle();
 assert.match(h.body(),/壊れた応答時の保存本文/);assert.match(h.body(),/通信を確認できないため保存済み履歴を表示中/);
 assert.equal(h.writes.length,0,'一覧がない不正な成功応答で保存履歴を空にしない');
});

test('保存先の行を先に表示し、note取得後は同件数の古い本文も全件再読取する',async t=>{
 let deliverRefresh,updated=false;
 const requests=[],refreshRequests=[],rows=Array.from({length:80},(_,i)=>event('c'+i,'保存先本文'+i,{occurred_at:new Date(Date.parse('2026-10-08T09:00:00Z')-i*1000).toISOString(),actor_image_url:'https://images.test/peer.png'}));
 const h=await fixture(t,{fetch:async(_url,init)=>{
  const body=JSON.parse(init.body);requests.push({...body,updated});
  const current=rows.map(row=>updated&&row.comment_key==='c79'?{...row,body:'noteで編集された過去本文',is_creator_liked:true}:row);
  return response(current.slice((body.page-1)*body.pageSize,body.page*body.pageSize),current.length);
 },refreshFetch:async(_url,init)=>{
  refreshRequests.push({body:JSON.parse(init.body),token:init.headers['X-Insight-Token']});
  return new Promise(resolve=>{deliverRefresh=()=>{updated=true;resolve(Response.json({ok:true,articles:2,changedComments:1,failedArticles:0}))}});
 }});
 await h.start();await settle();
 assert.match(h.body(),/保存先本文79/);assert.doesNotMatch(h.body(),/noteで編集された過去本文|最新状態に更新/);
 assert.deepEqual(refreshRequests,[{body:{action:'refresh',articleKey:null},token:'token-a'}]);
 assert.equal([...h.w.document.querySelectorAll('.micf-tools button')].find(button=>button.textContent.includes('noteから')).disabled,true);
 await settle(deliverRefresh);
 assert.match(h.body(),/noteで編集された過去本文/);assert.doesNotMatch(h.body(),/保存先本文79/);
 assert.ok(requests.some(request=>request.updated&&request.pageSize===500&&!request.dateFrom),'取得後は最新50件だけでなく全件を読み直す');
 assert.equal(h.writes.at(-1).value.rows.length,80);
 assert.equal(h.writes.at(-1).value.rows.at(-1).is_creator_liked,true);
});

test('note取得中の対応状況切替を保ち、取得完了時はそのフィルターだけ再読取する',async t=>{
 let deliverRefresh,updated=false;
 const calls=[],root=()=>({root_key:'root-1',root_body:updated?'取得後の返信済み会話':'保存済み返信済み会話',actor_name:'相手',actor_image_url:'https://images.test/peer.png',status:'replied'});
 const h=await fixture(t,{fetch:async(_url,init)=>{
  const body=JSON.parse(init.body);calls.push({...body,updated});
  if(body.action==='comments_filtered')return response([root()]);
  if(body.action==='batch')return response([]);
  return response([]);
 },refreshFetch:async()=>new Promise(resolve=>{deliverRefresh=()=>{updated=true;resolve(Response.json({ok:true,articles:1,failedArticles:0}))}})});
 await h.start();await h.click([...h.w.document.querySelectorAll('.micf-tabs button')].find(button=>button.textContent==='自分返信'));
 assert.match(h.body(),/保存済み返信済み会話/);
 await settle(deliverRefresh);
 assert.equal(h.w.document.querySelector('.micf-tabs .active').textContent,'自分返信');
 assert.match(h.body(),/取得後の返信済み会話/);assert.doesNotMatch(h.body(),/保存済み返信済み会話/);
 assert.ok(calls.some(call=>call.updated&&call.action==='comments_filtered'&&call.status==='replied'));
 assert.ok(!calls.some(call=>call.updated&&!call.action),'現在の状況フィルターを全コメントへ戻さない');
});

test('一部記事のnote取得失敗は成功分を反映し、停止時は完了扱いせず保存先の行を保持する',async t=>{
 let deliverRefresh,updated=false,refreshCalls=0,reads=0;
 const h=await fixture(t,{fetch:async()=>{reads++;return response([event('c1',updated?'取得できた本文':'保存先の本文',{actor_image_url:'https://images.test/peer.png'})])},refreshFetch:async()=>{
  refreshCalls++;
  if(refreshCalls>1)return Response.json({ok:true,paused:true,reason:'maintenance'});
  return new Promise(resolve=>{deliverRefresh=()=>{updated=true;resolve(Response.json({ok:false,articles:1,changedComments:1,failedArticles:1,errors:['NOTE_PUBLIC_403']}))}});
 }});
 await h.start();await settle(deliverRefresh);
 assert.match(h.body(),/取得できた本文/);assert.match(h.body(),/1記事のコメントを取得できませんでした/);
 const before=reads;
 await h.click([...h.w.document.querySelectorAll('.micf-tools button')].find(button=>button.textContent==='noteからコメントを取得'));
 assert.equal(reads,before,'maintenanceを取得成功と扱わない');
 assert.match(h.body(),/noteのコメント取得は一時停止中/);assert.match(h.body(),/取得できた本文/);
});

test('note取得も画面離脱で中断し、遅い成功を後の画面や保存へ適用しない',async t=>{
 let deliverRefresh,refreshSignal,reads=0;
 const h=await fixture(t,{fetch:async()=>{reads++;return response([event('saved','画面離脱前の保存先本文',{actor_image_url:'https://images.test/peer.png'})])},refreshFetch:async(_url,init)=>{
  refreshSignal=init.signal;return new Promise(resolve=>{deliverRefresh=()=>resolve(Response.json({ok:true,articles:1,failedArticles:0}))});
 }});
 await h.start();await settle();const before={reads,writes:h.writes.length};
 await h.render(()=>React.createElement('p',null,'後の画面'),{});
 assert.equal(refreshSignal.aborted,true);
 await settle(deliverRefresh);
 assert.equal(reads,before.reads);assert.equal(h.writes.length,before.writes);
 assert.equal(h.w.document.body.textContent,'後の画面');
});

test('note取得はアカウントごとのtokenを送り、切替前の遅い成功で再読取しない',async t=>{
 let deliverA,deliverB;
 const reads=[],collections=[];
 const h=await fixture(t,{fetch:async(_url,init)=>{const token=init.headers['X-Insight-Token'];reads.push(token);return response([event(token,token==='token-a'?'Aの保存先本文':'Bの保存先本文',{actor_image_url:'https://images.test/peer.png'})])},refreshFetch:async(_url,init)=>{
  const token=init.headers['X-Insight-Token'];collections.push({token,signal:init.signal});
  return new Promise(resolve=>{const deliver=()=>resolve(Response.json({ok:true,articles:1,failedArticles:0}));if(token==='token-a')deliverA=deliver;else deliverB=deliver});
 }});
 await h.start();await settle();
 h.w.localStorage.setItem(tokenKey,'token-b');await h.start({noteId:'account_b'});await settle();
 assert.equal(collections[0].signal.aborted,true);assert.deepEqual(collections.map(item=>item.token),['token-a','token-b']);
 const count=reads.length;
 await settle(deliverA);assert.equal(reads.length,count);assert.match(h.body(),/Bの保存先本文/);assert.doesNotMatch(h.body(),/Aの保存先本文/);
 await settle(deliverB);assert.equal(reads.at(-1),'token-b');assert.equal(h.writes.at(-1).key,'comments-all:account_b');
});

test('note取得が中断を無視しても時間切れでボタンを戻し保存履歴を維持する',async t=>{
 let fallbackCalls=0,collectionCalls=0;
 const h=await fixture(t,{fetch:async()=>response([event('saved','note通信停止時の保存先本文',{actor_image_url:'https://images.test/peer.png'})]),refreshFetch:async()=>{collectionCalls++;return new Promise(()=>{})},fallback:async()=>{fallbackCalls++;throw new Error('read fallback must not collect')},globals:{setTimeout:(fn,ms,...args)=>setTimeout(fn,ms===40000?10:ms,...args)}});
 await h.start();
 await React.act(async()=>{await new Promise(resolve=>setTimeout(resolve,30));await pause()});
 assert.match(h.body(),/note通信停止時の保存先本文/);assert.match(h.body(),/noteのコメント取得を確認できませんでした/);
 const retry=[...h.w.document.querySelectorAll('.micf-tools button')].find(button=>button.textContent==='noteからコメントを取得');
 assert.equal(retry.disabled,false);assert.equal(fallbackCalls,0,'読取RPCを取得成功の代替にしない');
 await h.click(retry);assert.equal(collectionCalls,2,'時間切れ後は手動で再取得できる');
});

test('日付の記事を選んだ手動取得はarticleKeyを送り選択を保持する',async t=>{
 const collections=[];
 const h=await fixture(t,{fetch:async(_url,init)=>{
  const body=JSON.parse(init.body);
  if(body.action==='comment_articles')return response([{article_key:'nselected',title:'選択した記事',comment_count_day:1}]);
  return response([event('c1','日付の記事コメント',{article_key:'nselected',actor_image_url:'https://images.test/peer.png'})]);
 },refreshFetch:async(_url,init)=>{collections.push(JSON.parse(init.body));return Response.json({ok:true,skipped:true,reason:'recent'})}});
 await h.start();await settle();
 await h.change(h.w.document.querySelector('input[type="date"]'),'2026-10-09');await settle();
 const select=h.w.document.querySelector('.micf-tools select');
 await settle(()=>{Object.getOwnPropertyDescriptor(h.w.HTMLSelectElement.prototype,'value').set.call(select,'nselected');select.dispatchEvent(new h.w.Event('change',{bubbles:true}))});
 assert.equal(select.value,'nselected');assert.equal(h.w.document.querySelector('input[type="date"]').value,'2026-10-09');
 await h.click([...h.w.document.querySelectorAll('.micf-tools button')].find(button=>button.textContent==='noteからコメントを取得'));
 assert.deepEqual(collections.at(-1),{action:'refresh',articleKey:'nselected'});
 assert.equal(select.value,'nselected');assert.equal(h.w.document.querySelector('input[type="date"]').value,'2026-10-09');
 assert.match(h.body(),/直前の取得があるため/);assert.doesNotMatch(h.body(),/noteから1記事のコメントを取得しました/);
});

test('続きのページが欠けた時は全履歴成功とせず不完全な保存で上書きしない',async t=>{
 const rows=Array.from({length:500},(_,i)=>event('c'+i,'途中までのコメント'+i,{actor_image_url:'https://images.test/peer.png'}));
 const h=await fixture(t,{fetch:async(_url,init)=>{const body=JSON.parse(init.body);return response(body.page===1?rows.slice(0,body.pageSize):[],620)}});
 await h.start();await settle();
 for(let i=0;i<5;i++)await h.click(h.w.document.querySelector(".micf-more button"));
 assert.match(h.body(),/途中までのコメント0/);assert.match(h.body(),/COMMENT_HISTORY_INCOMPLETE/);
 assert.doesNotMatch(h.body(),/保存先の全履歴 読込完了/);assert.equal(h.writes.length,0);
});

test('本文を返さない401でも保存履歴やDB代替を認証の代わりに使わない',async t=>{
 let fallbackCalls=0;
 const h=await fixture(t,{snapshot:saved([event('old','失効セッションの保存本文')]),fetch:async()=>new Response('sign in',{status:401}),fallback:async()=>{fallbackCalls++;return {rows:[event('old','失効セッションの保存本文')],total:1}}});
 await h.start();await settle();
 assert.match(h.body(),/HTTP_401/);assert.doesNotMatch(h.body(),/失効セッションの保存本文/);
 assert.equal(fallbackCalls,0);assert.equal(h.writes.length,0);
});

test('620件中の先頭500件を確認した直後の戻りで追加通信しない',async t=>{
 const rows=Array.from({length:620},(_,i)=>event('c'+i,'保持した本文'+i,{occurred_at:new Date(Date.parse('2026-10-08T09:00:00Z')-i*1000).toISOString(),actor_image_url:'https://images.test/peer.png'})),calls=[];
 let collections=0;
 const h=await fixture(t,{fetch:async(_url,init)=>{const body=JSON.parse(init.body);calls.push(body);return response(rows.slice((body.page-1)*body.pageSize,body.page*body.pageSize),620)},refreshFetch:async()=>{collections++;return Response.json({ok:true,paused:true,reason:'maintenance'})}});
 await h.start();await settle();assert.equal(h.savedView().value.rows.length,500);
 const before={reads:calls.length,collections,writes:h.writes.length};
 await h.render(()=>null,{});await h.start();await settle();
 assert.equal(calls.length,before.reads);assert.equal(collections,before.collections);assert.equal(h.writes.length,before.writes);
 assert.match(h.body(),/保持した本文0/);assert.match(h.body(),/620件/);assert.doesNotMatch(h.body(),/全履歴を読み込み中|保存先のコメント履歴を確認中/);
});

test('戻りで日付・記事・検索・対応状況と確認済み♡を復元して読み直さない',async t=>{
 const calls=[],root={root_key:'root-1',root_body:'選択した会話',actor_name:'相手',actor_url:'https://note.com/peer',actor_image_url:'https://images.test/peer.png',status:'replied'};
 const h=await fixture(t,{fetch:async(_url,init)=>{
  const body=JSON.parse(init.body);calls.push(body);
  if(body.action==='comment_articles')return response([{article_key:'nselected',title:'選択記事',comment_count_day:1}]);
  if(body.action==='comments_filtered')return response([root]);
  if(body.action==='batch')return response([{rootKey:'root-1',exact:true,counterpartHearted:true,counterpartName:'相手'}]);
  return response([]);
 }});
 await h.start();await h.change(h.w.document.querySelector('input[type="date"]'),'2026-10-08');await settle();
 await settle(()=>{const select=h.w.document.querySelector('.micf-tools select');Object.getOwnPropertyDescriptor(h.w.HTMLSelectElement.prototype,'value').set.call(select,'nselected');select.dispatchEvent(new h.w.Event('change',{bubbles:true}))});
 await h.click([...h.w.document.querySelectorAll('.micf-tabs button')].find(button=>button.textContent==='自分返信'));
 await h.change(h.w.document.querySelector('.micf-tools input[placeholder]'),'選択');await h.click([...h.w.document.querySelectorAll('.micf-tools button')].find(button=>button.textContent==='検索'));await settle();
 assert.match(h.body(),/最終返信に相手さんの♡あり/);const before=calls.length;
 await h.render(()=>null,{});await h.start();await settle();
 assert.equal(calls.length,before);assert.equal(h.w.document.querySelector('.micf-tabs .active').textContent,'自分返信');
 assert.equal(h.w.document.querySelector('input[type="date"]').value,'2026-10-08');assert.equal(h.w.document.querySelector('.micf-tools select').value,'nselected');assert.equal(h.w.document.querySelector('.micf-tools input[placeholder]').value,'選択');
 assert.match(h.body(),/選択した会話/);assert.match(h.body(),/最終返信に相手さんの♡あり/);
});

test('期限超過でも現在の表示範囲だけ再確認し、表示中の古い末尾は更新完了まで保つ',async t=>{
 let now=Date.now(),updating=false,deliverPage2;
 class Clock extends Date{static now(){return now}}
 const rows=Array.from({length:620},(_,i)=>event('c'+i,'保存本文'+i,{occurred_at:new Date(Date.parse('2026-10-08T09:00:00Z')-i*1000).toISOString(),actor_image_url:'https://images.test/peer.png'})),current=rows.filter(row=>row.comment_key!=='c618').map(row=>row.comment_key==='c619'?{...row,body:'最新の末尾本文'}:row),calls=[];
 const h=await fixture(t,{globals:{Date:Clock},fetch:async(_url,init)=>{
  const body=JSON.parse(init.body),source=updating?current:rows;calls.push({...body,updating});
  if(updating&&body.page===2)return new Promise(resolve=>{deliverPage2=()=>resolve(response(current.slice(500),619))});
  return response(source.slice((body.page-1)*body.pageSize,body.page*body.pageSize),source.length);
 }});
 await h.start();await settle();for(let i=0;i<6;i++)await h.click(h.w.document.querySelector('.micf-more button'));
 assert.match(h.body(),/保存本文619/);
 await h.render(()=>null,{});now+=61000;updating=true;await h.start();await settle();
 assert.match(h.body(),/保存本文619/,'表示中の末尾は更新途中で消さない');assert.equal(h.w.document.querySelector('.micf-head strong').textContent,'619件');
 await settle(deliverPage2);assert.match(h.body(),/最新の末尾本文/);assert.doesNotMatch(h.body(),/保存本文618/);
 assert.deepEqual(calls.filter(x=>x.updating).map(x=>x.page),[1,2]);assert.equal(h.savedView().value.rows.length,500);
});

test('自動note確認が変更なしなら最初の表示ページをもう一度取得しない',async t=>{
 let deliverRefresh;
 const calls=[],rows=Array.from({length:620},(_,i)=>event('c'+i,'履歴'+i,{actor_image_url:'https://images.test/peer.png'}));
 const h=await fixture(t,{fetch:async(_url,init)=>{const body=JSON.parse(init.body);calls.push(body);return response(rows.slice((body.page-1)*body.pageSize,body.page*body.pageSize),620)},refreshFetch:async()=>new Promise(resolve=>{deliverRefresh=()=>resolve(Response.json({ok:true,articles:3,changedComments:0,unchangedComments:620,failedArticles:0}))})});
 await h.start();await settle();const before=calls.length;assert.equal(h.savedView().value.rows.length,500);
 await settle(deliverRefresh);assert.equal(calls.length,before);assert.match(h.body(),/履歴0/);
});

test('freshでも手動note取得とrevision更新は最新の保存先を再読取する',async t=>{
 let body='保存した本文';const reads=[],collections=[];
 const h=await fixture(t,{fetch:async(_url,init)=>{const params=JSON.parse(init.body);reads.push(params);return response([event('c1',body,{actor_image_url:'https://images.test/peer.png'})])},refreshFetch:async(_url,init)=>{collections.push(JSON.parse(init.body));return Response.json({ok:true,skipped:true,reason:'recent'})}});
 await h.start();await settle();const first=reads.length;body='手動確認した最新本文';
 await h.click([...h.w.document.querySelectorAll('.micf-tools button')].find(button=>button.textContent==='noteからコメントを取得'));await settle();
 assert.equal(reads.length,first+1);assert.match(h.body(),/手動確認した最新本文/);
 body='revisionで更新された本文';await h.start({revision:1});await settle();assert.match(h.body(),/revisionで更新された本文/);assert.ok(reads.length>first+1);assert.ok(collections.length>=3);
});

test('本人切替は以前の表示条件を混ぜず新scopeの最新確認を行う',async t=>{
 const requests=[];
 const h=await fixture(t,{fetch:async(_url,init)=>{const body=JSON.parse(init.body);requests.push({token:init.headers['X-Insight-Token'],body});if(body.action==='comments_filtered')return response([{root_key:'root',root_body:'Aの絞込み会話',status:'replied',actor_image_url:'https://images.test/peer.png'}]);return response([event('c1',init.headers['X-Insight-Token']==='token-a'?'Aの本文':'Bの本文',{actor_image_url:'https://images.test/peer.png'})])}});
 await h.start();await h.click([...h.w.document.querySelectorAll('.micf-tabs button')].find(button=>button.textContent==='自分返信'));await settle();
 h.w.localStorage.setItem(tokenKey,'token-b');await h.start({noteId:'account_b'});await settle();
 assert.equal(h.w.document.querySelector('.micf-tabs .active').textContent,'すべて（全コメント）');assert.equal(h.w.document.querySelector('input[type="date"]').value,'');assert.match(h.body(),/Bの本文/);assert.doesNotMatch(h.body(),/Aの本文|Aの絞込み会話/);
 assert.ok(requests.some(request=>request.token==='token-b'&&!request.body.action));assert.ok(!requests.some(request=>request.token==='token-b'&&request.body.action==='comments_filtered'));
});


test('4,464件の通常起動は先頭500件だけを取得し全履歴確認済みと表示しない',async t=>{
 const calls=[],rows=Array.from({length:500},(_,i)=>event('c'+i,'通常表示'+i,{actor_image_url:'https://images.test/peer.png'}));
 const h=await fixture(t,{fetch:async(_url,init)=>{calls.push(JSON.parse(init.body));return response(rows,4464)}});
 await h.start();await settle();assert.deepEqual(calls.map(p=>[p.page,p.pageSize]),[[1,500]]);
 assert.equal(h.savedView().value.rows.length,500);assert.equal(h.savedView().value.total,4464);
 assert.doesNotMatch(h.body(),/全履歴 保存済み|保存先の全履歴を確認しました/);
 assert.match(h.body(),/表示分を確認しました/);
});

test('新しいdocumentでも同じtokenの前回表示分を同期表示し現在ページを裏で確認する',async t=>{
 const first=await fixture(t,{fetch:async()=>response([event('c1','前回起動の本文',{actor_image_url:'https://images.test/peer.png'})])});
 await first.start();const entries=Object.keys(first.w.localStorage).map(key=>[key,first.w.localStorage.getItem(key)]);await first.render(()=>null,{});
 let deliver;const calls=[];
 const second=await fixture(t,{fetch:async(_url,init)=>{calls.push(JSON.parse(init.body));return new Promise(resolve=>{deliver=()=>resolve(response([event('c1','今回確認した本文',{is_creator_liked:true,actor_image_url:'https://images.test/peer.png'})]))})}});
 for(const [key,value]of entries)second.w.localStorage.setItem(key,value);
 await second.start();assert.match(second.body(),/前回起動の本文/);assert.match(second.body(),/前回保存分を表示・最新確認中/);
 assert.deepEqual(calls.map(p=>[p.page,p.pageSize]),[[1,500]]);
 await settle(deliver);assert.match(second.body(),/今回確認した本文/);assert.doesNotMatch(second.body(),/前回起動の本文|前回保存分を表示/);
});

test('同じnoteでも別tokenの保存コピーは表示しない',async t=>{
 const h=await fixture(t,{stored:saved([event('old','別tokenの私有本文')]),storedToken:'token-old',fetch:async()=>new Promise(()=>{})});
 await h.start();assert.doesNotMatch(h.body(),/別tokenの私有本文|前回保存分を表示/);assert.equal(h.savedView(),null);
});

const failedArticle=(articleKey,extra={})=>({articleKey,title:'確認対象 '+articleKey,url:'https://note.com/account_a/n/'+articleKey,stage:'note',code:'NOTE_PUBLIC_403',retryable:false,...extra});
const retryButton=h=>h.w.document.querySelector('.micf-recovery>button');
const retainedComment=()=>event('retained','取得失敗中も保持する本文',{actor_image_url:'https://images.test/peer.png'});

test('取得失敗の対象記事・note拒否と保存失敗の理由を示し、安全な記事リンクだけを出す',async t=>{
 const calls=[],failures=[failedArticle('n1'),failedArticle('n2',{code:'NOTE_PUBLIC_404',url:'https://evil.test/article'}),failedArticle('n3',{stage:'save',code:'COMMENT_SAVE_FAILED',retryable:true,url:'javascript:alert(1)'}),failedArticle('n4',{code:'NOTE_PUBLIC_429',retryable:true,url:''}),failedArticle('n5',{code:'NOTE_COMMENTS_DISABLED',url:''}),failedArticle('n6',{code:'COMMENT_ARTICLE_NOT_FOUND',url:''})];
 const h=await fixture(t,{fetch:async()=>response([retainedComment()]),refreshFetch:async(_url,init)=>{
  const body=JSON.parse(init.body);calls.push(body);
  return Response.json(calls.length===1?{ok:false,articles:1,changedComments:0,failedArticles:6,articleFailures:failures,retryAfterSeconds:0}:{ok:true,articles:6,changedComments:0,failedArticles:0});
 }});
 await h.start();await settle();
 const recovery=h.w.document.querySelector('.micf-recovery');
 assert.match(recovery.textContent,/確認できなかった記事（6件）/);assert.equal(recovery.querySelectorAll('li').length,6);
 assert.match(recovery.textContent,/note側で公開取得が許可されていません/);assert.match(recovery.textContent,/非公開・削除/);assert.match(recovery.textContent,/取得後の保存を確認できませんでした/);assert.match(recovery.textContent,/note側の回数制限/);
 assert.match(recovery.querySelectorAll('li')[4].textContent,/コメント欄.*(?:無効|停止|オフ|閉)/);assert.match(recovery.querySelectorAll('li')[5].textContent,/記事を確認できません/);assert.doesNotMatch(recovery.textContent,/NOTE_COMMENTS_DISABLED|COMMENT_ARTICLE_NOT_FOUND/);
 assert.equal(h.w.document.querySelector('.micf-load-state.unavailable'),null,'保存失敗と回数制限を含む結果を、公開できない記事だけの案内へ置き換えない');
 assert.deepEqual([...recovery.querySelectorAll('a')].map(a=>a.href),['https://note.com/account_a/n/n1']);
 assert.match(h.body(),/取得失敗中も保持する本文/);assert.equal(retryButton(h).disabled,false);
 await h.click(retryButton(h));await settle();
 assert.deepEqual(calls,[{action:'refresh',articleKey:null},{action:'refresh',articleKeys:['n1','n2','n3','n4','n5','n6']}]);
 assert.equal(h.w.document.querySelector('.micf-recovery'),null);assert.match(h.body(),/取得失敗中も保持する本文/);assert.equal(h.savedView().value.rows[0].body,'取得失敗中も保持する本文');
});

test('再取得待機中は通信せず、待機後の共有制限でも失敗対象と保存済み本文を保持する',async t=>{
 let now=Date.now();class Clock extends Date{static now(){return now}}
 const calls=[],ticks=[];
 const h=await fixture(t,{globals:{Date:Clock},fetch:async()=>response([retainedComment()]),refreshFetch:async(_url,init)=>{
  calls.push(JSON.parse(init.body));return Response.json(calls.length===1?{ok:false,articles:0,failedArticles:1,articleFailures:[failedArticle('n1')],changedComments:0,retryAfterSeconds:60}:{ok:true,skipped:true,reason:'recent',retryAfterSeconds:30});
 }});
 const originalTimeout=h.w.setTimeout.bind(h.w);h.w.setTimeout=(fn,ms,...args)=>ms===1000?(ticks.push(()=>fn(...args)),90000+ticks.length):originalTimeout(fn,ms,...args);
 await h.start();await settle();assert.equal(retryButton(h).disabled,true);assert.match(retryButton(h).textContent,/再取得まで 60秒/);
 await h.click(retryButton(h));assert.equal(calls.length,1,'disabled retry cannot repeat the shared refresh');
 now+=61000;await settle(()=>ticks.shift()());assert.equal(retryButton(h).disabled,false);
 await h.click(retryButton(h));await settle();
 assert.deepEqual(calls[1],{action:'refresh',articleKeys:['n1']});assert.match(h.body(),/直前の取得があるため/);assert.match(h.body(),/確認対象 n1/);assert.match(h.body(),/取得失敗中も保持する本文/);assert.equal(retryButton(h).disabled,true);assert.match(retryButton(h).textContent,/再取得まで 30秒/);
});

test('6記事を超える失敗は先頭6記事だけ再取得し、未送信の失敗を消さず次へ進める',async t=>{
 const calls=[],failures=Array.from({length:8},(_,i)=>failedArticle('n'+(i+1)));
 const h=await fixture(t,{fetch:async()=>response([retainedComment()]),refreshFetch:async(_url,init)=>{
  calls.push(JSON.parse(init.body));return Response.json(calls.length===1?{ok:false,articles:0,changedComments:0,failedArticles:8,articleFailures:failures,retryAfterSeconds:0}:{ok:true,articles:calls.length===2?6:2,changedComments:0,failedArticles:0,retryAfterSeconds:0});
 }});
 await h.start();await settle();assert.match(retryButton(h).textContent,/先頭6記事/);
 await h.click(retryButton(h));await settle();
 assert.deepEqual(calls[1],{action:'refresh',articleKeys:['n1','n2','n3','n4','n5','n6']});
 assert.deepEqual([...h.w.document.querySelectorAll('.micf-recovery li>b')].map(el=>el.textContent),['確認対象 n7','確認対象 n8']);const unavailable=h.w.document.querySelector('.micf-load-state.unavailable');assert.match(unavailable.textContent,/2記事.*note側/);assert.match(unavailable.textContent,/保存済み履歴/);assert.doesNotMatch(unavailable.textContent,/取得できませんでした/);
 await h.click(retryButton(h));await settle();assert.deepEqual(calls[2],{action:'refresh',articleKeys:['n7','n8']});assert.equal(h.w.document.querySelector('.micf-recovery'),null);assert.match(h.body(),/取得失敗中も保持する本文/);
});

test('時間内に未処理の記事も取得完了とせず、本人記事だけの再取得対象に残す',async t=>{
 const calls=[];
 const h=await fixture(t,{fetch:async()=>response([retainedComment()]),refreshFetch:async(_url,init)=>{
  calls.push(JSON.parse(init.body));return Response.json(calls.length===1?{ok:true,articles:1,failedArticles:0,truncated:true,pendingArticleKeys:['nabc','nabc','wrong-key'],changedComments:0,retryAfterSeconds:0}:{ok:true,articles:1,failedArticles:0,changedComments:0});
 }});
 await h.start();await settle();assert.match(h.body(),/残りはもう一度取得できます/);assert.match(h.body(),/今回は時間内に確認できませんでした/);
 const links=[...h.w.document.querySelectorAll('.micf-recovery a')];assert.deepEqual(links.map(a=>a.href),['https://note.com/account_a/n/nabc']);
 await h.click(retryButton(h));await settle();assert.deepEqual(calls[1],{action:'refresh',articleKeys:['nabc']});assert.equal(h.w.document.querySelector('.micf-recovery'),null);
});

test('選択記事名を省略されない読み出しに表示し、日付と記事選択を保持する',async t=>{
 const title='スマートフォンでも最後まで確認したい、とても長い確認対象の記事タイトルです';
 const h=await fixture(t,{fetch:async(_url,init)=>{
  const body=JSON.parse(init.body);return body.action==='comment_articles'?response([{article_key:'nabc',title,comment_count_day:1}]):response([retainedComment()]);
 }});
 await h.start();await h.change(h.w.document.querySelector('input[type="date"]'),'2026-10-26');await settle();
 const select=h.w.document.querySelector('.micf-tools select');await settle(()=>{Object.getOwnPropertyDescriptor(h.w.HTMLSelectElement.prototype,'value').set.call(select,'nabc');select.dispatchEvent(new h.w.Event('change',{bubbles:true}))});
 assert.equal(select.getAttribute('aria-label'),'コメント日の記事');assert.equal(h.w.document.querySelector('.micf-selected-article').textContent,'選択中：'+title);assert.equal(h.w.document.querySelector('input[type="date"]').value,'2026-10-26');assert.equal(h.w.document.querySelector('.micf-tools select').value,'nabc');
});

test('失敗分の再取得中に本人を切り替えても遅い応答で別本人の失敗や本文を変更しない',async t=>{
 const calls=[];let deliverRetry,signal;
 const h=await fixture(t,{fetch:async(_url,init)=>response([event('current',init.headers['X-Insight-Token']==='token-a'?'Aの保存済み本文':'Bの保存済み本文',{actor_image_url:'https://images.test/peer.png'})]),refreshFetch:async(_url,init)=>{
  const body=JSON.parse(init.body),token=init.headers['X-Insight-Token'];calls.push({body,token});
  if(token==='token-b')return Response.json({ok:false,articles:0,failedArticles:1,articleFailures:[failedArticle('nbb',{title:'Bだけの失敗記事'})],changedComments:0,retryAfterSeconds:0});
  if(body.articleKeys){signal=init.signal;return new Promise(resolve=>{deliverRetry=()=>resolve(Response.json({ok:true,articles:1,failedArticles:0,changedComments:1}))})}
  return Response.json({ok:false,articles:0,failedArticles:1,articleFailures:[failedArticle('naa',{title:'Aだけの失敗記事'})],changedComments:0,retryAfterSeconds:0});
 }});
 await h.start();await settle();await h.click(retryButton(h));assert.equal(signal.aborted,false);
 h.w.localStorage.setItem(tokenKey,'token-b');await h.start({noteId:'account_b'});await settle();assert.equal(signal.aborted,true);assert.match(h.body(),/Bだけの失敗記事/);assert.doesNotMatch(h.body(),/Aだけの失敗記事|Aの保存済み本文/);
 const writes=h.writes.length;await settle(deliverRetry);assert.match(h.body(),/Bだけの失敗記事/);assert.match(h.body(),/Bの保存済み本文/);assert.equal(h.writes.length,writes);assert.equal(calls.at(-1).token,'token-b');
});

test('保存した失敗一覧へ戻った後の手動再取得も、画面離脱で中断する',async t=>{
 const calls=[];let signal,deliverRetry,reads=0;
 const h=await fixture(t,{fetch:async()=>{reads++;return response([retainedComment()])},refreshFetch:async(_url,init)=>{
  const body=JSON.parse(init.body);calls.push(body);
  if(body.articleKeys){signal=init.signal;return new Promise(resolve=>{deliverRetry=()=>resolve(Response.json({ok:true,articles:1,failedArticles:0,changedComments:1}))})}
  return Response.json({ok:false,articles:0,failedArticles:1,articleFailures:[failedArticle('n1')],changedComments:0,retryAfterSeconds:0});
 }});
 await h.start();await settle();await h.render(()=>null,{});await h.start();await settle();assert.equal(calls.length,1,'fresh return restores failure details without repeating note reads');
 await h.click(retryButton(h));assert.equal(signal.aborted,false);const before={reads,writes:h.writes.length};
 await h.render(()=>React.createElement('p',null,'後の画面'),{});assert.equal(signal.aborted,true,'a manual collection after a cached return still belongs to the current component');
 await settle(deliverRetry);assert.equal(reads,before.reads);assert.equal(h.writes.length,before.writes);assert.equal(h.w.document.body.textContent,'後の画面');
});

test('失敗分の通信が再び失敗しても対象記事と保存済みコメントを保持する',async t=>{
 let calls=0;
 const h=await fixture(t,{fetch:async()=>response([retainedComment()]),refreshFetch:async()=>{
  if(calls++)throw new Error('OFFLINE');return Response.json({ok:false,articles:0,failedArticles:1,articleFailures:[failedArticle('n1')],changedComments:0,retryAfterSeconds:0});
 }});
 await h.start();await settle();await h.click(retryButton(h));await settle();assert.match(h.body(),/noteのコメント取得を確認できませんでした/);assert.match(h.body(),/確認対象 n1/);assert.match(h.body(),/取得失敗中も保持する本文/);assert.equal(retryButton(h).disabled,false);assert.equal(calls,2);
});

test('HTTP200でも取得結果の形が不明なら成功にせず保存済みコメントを保持する',async t=>{
 let reads=0;
 const h=await fixture(t,{fetch:async()=>{reads++;return response([retainedComment()])},refreshFetch:async()=>Response.json({ok:true,unknown:'missing confirmed article result'})});
 await h.start();await settle();assert.match(h.body(),/noteのコメント取得を確認できませんでした/);assert.match(h.body(),/COMMENT_REFRESH_RESPONSE_INVALID/);assert.match(h.body(),/取得失敗中も保持する本文/);assert.doesNotMatch(h.body(),/noteから0記事のコメントを取得しました/);assert.equal(reads,1,'an invalid collection response must not trigger a second saved-history read');assert.equal(h.w.document.querySelector('.micf-recovery'),null);
});

test('保存分を表示した後の401は本文と表示コピーを除き再利用しない',async t=>{
 let deliver;const h=await fixture(t,{stored:saved([event('old','失効後に見せない本文')]),fetch:async()=>new Promise(resolve=>{deliver=()=>resolve(new Response('invalid',{status:401}))})});
 await h.start();assert.match(h.body(),/失効後に見せない本文/);
 await settle(deliver);assert.doesNotMatch(h.body(),/失効後に見せない本文/);assert.match(h.body(),/HTTP_401/);assert.equal(h.savedView(),null);
});

test('全体検索の明示時だけ古いページまで確認し検索途中は暫定と示す',async t=>{
 const rows=Array.from({length:620},(_,i)=>event('c'+i,i===619?'末尾にある検索語':'通常本文'+i,{actor_image_url:'https://images.test/peer.png'})),calls=[];
 let deliver;
 const h=await fixture(t,{fetch:async(_url,init)=>{const body=JSON.parse(init.body);calls.push(body);if(body.page===2)return new Promise(resolve=>{deliver=()=>resolve(response(rows.slice(500),620))});return response(rows.slice(0,500),620)}});
 await h.start();assert.equal(calls.length,1);await h.change(h.w.document.querySelector('.micf-tools input[placeholder]'),'検索語');await h.click([...h.w.document.querySelectorAll('.micf-tools button')].find(x=>x.textContent==='検索'));await settle();
 assert.deepEqual(calls.map(p=>p.page),[1,1,2]);assert.match(h.body(),/全履歴を検索中/);assert.match(h.body(),/検索中（暫定）/);assert.doesNotMatch(h.body(),/この条件のコメント履歴はありません/);
 await settle(deliver);assert.match(h.body(),/末尾にある検索語/);assert.match(h.body(),/全履歴の検索完了/);assert.equal(h.w.document.querySelector('.micf-head strong').textContent,'1件');
});

test('対応状況の一覧も先頭100件だけ取得し続きを押した分だけ追加する',async t=>{
 const roots=Array.from({length:250},(_,i)=>({root_key:'r'+i,root_body:'未返信会話'+i,status:'unreplied',actor_image_url:'https://images.test/peer.png'})),calls=[];
 const h=await fixture(t,{fetch:async(_url,init)=>{const body=JSON.parse(init.body);calls.push(body);return body.action==='comments_filtered'?response(roots.slice((body.page-1)*100,body.page*100),250):response([])}});
 await h.start();await h.click([...h.w.document.querySelectorAll('.micf-tabs button')].find(x=>x.textContent==='未返信'));await settle();
 assert.deepEqual(calls.filter(p=>p.action==='comments_filtered').map(p=>[p.page,p.pageSize]),[[1,100]]);assert.equal(h.w.document.querySelectorAll('.micf-thread-list details').length,100);
 await h.click(h.w.document.querySelector('.micf-more button'));assert.deepEqual(calls.filter(p=>p.action==='comments_filtered').map(p=>p.page),[1,2]);
 assert.match(h.body(),/250件/);assert.doesNotMatch(h.body(),/全履歴 保存済み/);
});

test('続き取得中に確認済みの別フィルターへ移動しても続きボタンが固まらない',async t=>{
 const events=Array.from({length:500},(_,i)=>event('c'+i,'全コメント'+i,{actor_image_url:'https://images.test/peer.png'})),roots=Array.from({length:250},(_,i)=>({root_key:'r'+i,root_body:'未返信'+i,status:'unreplied',actor_image_url:'https://images.test/peer.png'})),calls=[];
 let deliver;
 const h=await fixture(t,{fetch:async(_url,init)=>{const p=JSON.parse(init.body);calls.push(p);if(p.action==='comments_filtered')return response(roots.slice((p.page-1)*100,p.page*100),250);if(p.page===2)return new Promise(resolve=>{deliver=()=>resolve(response([event('late','中断された続き')],620))});return response(events,620)}});
 const tab=name=>[...h.w.document.querySelectorAll('.micf-tabs button')].find(x=>x.textContent===name);
 await h.start();await h.click(tab('未返信'));await h.click(tab('すべて（全コメント）'));
 for(let i=0;i<5;i++)await h.click(h.w.document.querySelector('.micf-more button'));
 await h.click(tab('未返信'));assert.equal(h.w.document.querySelector('.micf-more button').disabled,false);
 await h.click(h.w.document.querySelector('.micf-more button'));assert.deepEqual(calls.filter(p=>p.action==='comments_filtered').map(p=>p.page),[1,2]);
 await settle(deliver);assert.doesNotMatch(h.body(),/中断された続き/);assert.match(h.body(),/未返信0/);
});

test('壊れた保存行は描画せず最新確認を行う',async t=>{
 const h=await fixture(t,{stored:{rows:[null],total:1,savedAt:1},fetch:async()=>new Promise(()=>{})});
 await h.start();assert.doesNotMatch(h.body(),/前回保存分を表示/);assert.match(h.body(),/コメント履歴を読み込み中/);
});


test('全体検索の途中ページが失敗した時は部分結果を検索0件の確定として扱わない',async t=>{
 const rows=Array.from({length:500},(_,i)=>event('c'+i,'先頭本文'+i,{actor_image_url:'https://images.test/peer.png'}));
 const h=await fixture(t,{fetch:async(_url,init)=>{const p=JSON.parse(init.body);if(p.page===2)throw new Error('offline');return response(rows,620)}});
 await h.start();await h.change(h.w.document.querySelector('.micf-tools input[placeholder]'),'未取得の検索語');await h.click([...h.w.document.querySelectorAll('.micf-tools button')].find(x=>x.textContent==='検索'));await settle();
 assert.match(h.body(),/全履歴の検索を完了できませんでした/);assert.match(h.body(),/検索中（暫定）/);assert.doesNotMatch(h.body(),/この条件のコメント履歴はありません/);
});

test('遅れて復元したtoken scoped保存表示を追加通信なしで表示し最新応答を優先する',async t=>{
 let deliver,calls=0;const h=await fixture(t,{fetch:async()=>{calls++;return new Promise(resolve=>{deliver=()=>resolve(response([event('live','最新応答',{actor_image_url:'https://images.test/peer.png'})]))})}});
 await h.start();assert.match(h.body(),/コメント履歴を読み込み中/);
 const copies=h.load('src/insight-saved-view.ts');
 await settle(()=>{copies.writeSavedInsightView('comments-default',{account:'account_a',token:'token-a'},{rows:[event('old','遅い保存表示')],total:1},1);h.w.dispatchEvent(new h.w.Event('mumei-insight-storage-hydrated'))});
 assert.match(h.body(),/遅い保存表示/);assert.match(h.body(),/前回保存分/);assert.equal(calls,1);
 await settle(deliver);assert.match(h.body(),/最新応答/);
 await settle(()=>{copies.writeSavedInsightView('comments-default',{account:'account_a',token:'token-a'},{rows:[event('old','上書き禁止')],total:1},1);h.w.dispatchEvent(new h.w.Event('mumei-insight-storage-hydrated'))});
 assert.match(h.body(),/最新応答/);assert.doesNotMatch(h.body(),/上書き禁止/);assert.equal(calls,1);
});

for(const variant of ['wrong-token','auth-denied','changed-filter'])test(`遅い保存表示を復元しない: ${variant}`,async t=>{
 const h=await fixture(t,{fetch:async()=>variant==='auth-denied'?Response.json({ok:false,error:'INSIGHT_SESSION_INVALID'},{status:401}):new Promise(()=>{})});await h.start();
 if(variant==='changed-filter')await h.click([...h.w.document.querySelectorAll('.micf-tabs button')].find(x=>x.textContent==='未返信'));
 await settle(()=>{h.load('src/insight-saved-view.ts').writeSavedInsightView('comments-default',{account:'account_a',token:variant==='wrong-token'?'other':'token-a'},{rows:[event('old','復元禁止本文')],total:1},1);h.w.dispatchEvent(new h.w.Event('mumei-insight-storage-hydrated'))});
 assert.doesNotMatch(h.body(),/復元禁止本文/);
});

test('遅い保存済み0件も読込表示に戻らず、失敗しても保存日時を保持する',async t=>{
 let fail;const h=await fixture(t,{fetch:async()=>new Promise(resolve=>{fail=()=>resolve(Response.json({ok:false},{status:503}))})});await h.start();
 await settle(()=>{h.load('src/insight-saved-view.ts').writeSavedInsightView('comments-default',{account:'account_a',token:'token-a'},{rows:[],total:0},1);h.w.dispatchEvent(new h.w.Event('mumei-insight-storage-hydrated'))});
 assert.doesNotMatch(h.body(),/コメント履歴を読み込み中/);assert.match(h.body(),/前回保存分/);
 await settle(fail);assert.match(h.body(),/前回保存分/);assert.equal(h.savedView().savedAt,1);
});

const countRows=count=>Array.from({length:count},(_,i)=>event('count-'+i,'件数確認の本文'+i,{actor_image_url:'https://images.test/peer.png'}));
async function countFixture(t,options){
 const h=await fixture(t,options),timeout=h.w.setTimeout.bind(h.w);
 h.w.setTimeout=(fn,ms,...args)=>timeout(fn,ms===1200?0:ms,...args);
 return h;
}
function historyCounts(h){
 const summary=h.w.document.querySelector('.micf-history-counts');assert.ok(summary,'保存先・読み込み・画面表示を区別する件数を表示する');
 return{summary,label:summary.querySelector('.micf-storage-count b')?.textContent,stored:summary.querySelector('.micf-storage-count strong')?.textContent,
  loaded:summary.querySelector('.micf-loaded-count')?.textContent||'',visible:summary.querySelector('.micf-visible-count')?.textContent||''};
}
async function settledHistoryCounts(h){
 await React.act(async()=>{for(let i=0;i<20&&!h.w.document.querySelector('.micf-history-counts');i++)await new Promise(resolve=>setTimeout(resolve,0))});
 return historyCounts(h);
}

test('保存先4,604件を読み込み500件・画面表示120件と区別し、表示を増やしても再取得しない',async t=>{
 const calls=[],rows=countRows(500),h=await countFixture(t,{fetch:async(_url,init)=>{calls.push(JSON.parse(init.body));return response(rows,4604)}});
 await h.start();await settle();let counts=await settledHistoryCounts(h);
 assert.equal(counts.label,'保存先');assert.equal(counts.stored,'4,604件');assert.match(counts.loaded,/読み込み済み\s*500件/);assert.match(counts.visible,/表示中\s*120件/);assert.ok(counts.summary.classList.contains('done'));
 assert.equal(h.w.document.querySelectorAll('.micf-event-list article').length,120);assert.deepEqual(calls.map(p=>[p.page,p.pageSize]),[[1,500]]);
 assert.doesNotMatch(h.w.document.querySelector('.micf-head p').textContent,/全部表示/);assert.match(h.w.document.querySelector('.micf-head p').textContent,/必要な分だけ/);
 await h.click(h.w.document.querySelector('.micf-more button'));counts=historyCounts(h);
 assert.equal(counts.stored,'4,604件');assert.match(counts.loaded,/読み込み済み\s*500件/);assert.match(counts.visible,/表示中\s*240件/);assert.equal(calls.length,1);
 assert.equal(h.savedView().value.rows.length,500);assert.equal(h.savedView().value.total,4604);
});

test('必要な続き500件だけを読み込み、戻った後も保存先総数・表示位置・取得済み本文を維持する',async t=>{
 const calls=[],rows=countRows(1000),h=await countFixture(t,{fetch:async(_url,init)=>{const p=JSON.parse(init.body);calls.push(p);return response(rows.slice((p.page-1)*p.pageSize,p.page*p.pageSize),4604)}});
 await h.start();await settle();
 for(let i=0;i<4;i++)await h.click(h.w.document.querySelector('.micf-more button'));
 assert.equal(calls.length,1);assert.match(historyCounts(h).visible,/表示中\s*500件/);
 await h.click(h.w.document.querySelector('.micf-more button'));await settle();let counts=await settledHistoryCounts(h);
 assert.deepEqual(calls.map(p=>[p.page,p.pageSize]),[[1,500],[2,500]]);assert.equal(counts.stored,'4,604件');assert.match(counts.loaded,/読み込み済み\s*1,000件/);assert.match(counts.visible,/表示中\s*500件/);
 const before={calls:calls.length,writes:h.writes.length,savedAt:h.savedView().savedAt};
 await h.render(()=>null,{});await h.start();await settle();counts=historyCounts(h);
 assert.equal(calls.length,before.calls);assert.equal(h.writes.length,before.writes);assert.equal(h.savedView().savedAt,before.savedAt);
 assert.equal(counts.label,'保存先');assert.equal(counts.stored,'4,604件');assert.match(counts.loaded,/読み込み済み\s*1,000件/);assert.match(counts.visible,/表示中\s*500件/);
 await h.click(h.w.document.querySelector('.micf-more button'));counts=historyCounts(h);assert.match(counts.visible,/表示中\s*620件/);assert.equal(calls.length,before.calls);
 assert.equal(h.savedView().value.rows.length,500);assert.equal(h.savedView().value.total,4604,'表示コピーの500件上限で保存先総数を切り下げない');
});

test('前回の500件コピーと総数4,604件は最新確認前も通信失敗後も前回確認と明示する',async t=>{
 const rows=countRows(500),calls=[];let fail;
 const h=await countFixture(t,{stored:{rows,total:4604,savedAt:1},fetch:async(_url,init)=>{calls.push(JSON.parse(init.body));return new Promise(resolve=>{fail=()=>resolve(Response.json({ok:false,error:'OFFLINE'},{status:503}))})}});
 await h.start();assert.match(h.body(),/前回保存分を表示・最新確認中/);assert.equal(h.w.document.querySelector('.micf-head strong').textContent,'4,604件');assert.equal(h.w.document.querySelector('.micf-load-state.done'),null);
 await settle(fail);const counts=await settledHistoryCounts(h);
 assert.equal(counts.label,'前回確認');assert.equal(counts.stored,'4,604件');assert.equal(counts.summary.classList.contains('done'),false);assert.match(h.body(),/最新未確認/);
 assert.match(counts.loaded,/読み込み済み\s*500件/);assert.match(counts.visible,/表示中\s*120件/);
 assert.deepEqual(calls.map(p=>[p.page,p.pageSize]),[[1,500]]);assert.equal(h.savedView().savedAt,1);assert.equal(h.writes.length,0);
});

test('次ページの失敗は保存総数や取得済み500件を減らさず、完了した保存確認に見せない',async t=>{
 const rows=countRows(500),calls=[],h=await countFixture(t,{fetch:async(_url,init)=>{const p=JSON.parse(init.body);calls.push(p);return p.page===2?Response.json({ok:false,error:'PAGE_OFFLINE'},{status:503}):response(rows,4604)}});
 await h.start();await settle();const before=h.savedView();
 for(let i=0;i<5;i++)await h.click(h.w.document.querySelector('.micf-more button'));
 await settle();const counts=await settledHistoryCounts(h);
 assert.equal(counts.label,'前回確認');assert.equal(counts.stored,'4,604件');assert.match(counts.loaded,/読み込み済み\s*500件/);assert.match(counts.visible,/表示中\s*500件/);assert.equal(counts.summary.classList.contains('done'),false);
 assert.match(h.w.document.querySelector('.micf-error').textContent,/PAGE_OFFLINE/);assert.deepEqual(calls.map(p=>p.page),[1,2]);
 assert.equal(h.savedView().savedAt,before.savedAt);assert.equal(h.savedView().value.total,4604);assert.equal(h.savedView().value.rows.length,500);assert.equal(h.writes.length,0);
});

test('保存件数を確認できない初回の通信失敗を、保存先0件の成功に置き換えない',async t=>{
 let calls=0;const h=await countFixture(t,{fetch:async()=>{calls++;return Response.json({ok:false,error:'UNAVAILABLE'},{status:503})}});
 await h.start();await settle();const counts=await settledHistoryCounts(h);
 assert.equal(counts.label,'保存件数を確認できません');assert.equal(counts.stored,'—');assert.equal(counts.summary.classList.contains('done'),false);assert.equal(calls,1);assert.equal(h.savedView(),null);assert.equal(h.writes.length,0);
});

test('保存先が確認できた0件は未確認表示と区別し、読み込み・画面表示も0件に揃える',async t=>{
 let calls=0;const h=await countFixture(t,{fetch:async()=>{calls++;return response([],0)}});
 await h.start();await settle();const counts=await settledHistoryCounts(h);
 assert.equal(counts.label,'保存先');assert.equal(counts.stored,'0件');assert.match(counts.loaded,/読み込み済み\s*0件/);assert.match(counts.visible,/表示中\s*0件/);assert.ok(counts.summary.classList.contains('done'));assert.equal(calls,1);
});
