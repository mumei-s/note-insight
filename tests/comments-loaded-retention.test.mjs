import test from 'node:test';
import assert from 'node:assert/strict';
import * as React from 'react';
import {sceneFixture,pause} from './react-scene-fixture.mjs';

const tokenKey='mumei-insight-access-token';
const events=Array.from({length:1200},(_,i)=>({comment_key:'fictional-c'+i,body:'架空コメント本文'+i,actor_name:'架空の相手',actor_url:'https://note.com/fictional_peer',actor_image_url:'https://images.test/avatar.png',occurred_at:new Date(Date.parse('2026-10-17T00:00:00Z')-i*1000).toISOString()}));
const response=(rows,total=1200)=>Response.json({ok:true,rows,total});
async function settle(work=()=>{}){await React.act(async()=>{work();for(let i=0;i<6;i++)await pause()})}
async function fixture(t,{stored=null}={}){
 let now=Date.now(),mode='success',failPage=1,collectionReads=0,sourceRows=events;class Clock extends Date{static now(){return now}}
 const calls=[],waiting=[],legacyWrites=[];
 const h=await sceneFixture(t,{globals:{Date:Clock,IntersectionObserver:class{observe(){}disconnect(){}}},dependencies:{
  './creator-avatar':{CreatorAvatar:()=>React.createElement('span')},
  './insight-member-db-fallback':{memberReadAuthFailure:message=>/HTTP_40[13]/.test(message),memberDbReadFallback:async()=>{throw new Error('offline')}},
  './insight-persistent-cache':{readInsightSnapshot:async()=>null,writeInsightSnapshot:async(_key,value)=>legacyWrites.push(value)},
 },fetch:async(url,init)=>{
  if(String(url).includes('/insight-comment-refresh')){collectionReads++;return Response.json({ok:true,paused:true})}
  const body=JSON.parse(init.body);calls.push({body,token:init.headers['X-Insight-Token'],signal:init.signal});
  if(mode==='deny')return new Response('denied',{status:403});
  if(mode==='hold'&&body.page===failPage)return new Promise(resolve=>waiting.push({resolve,body}));
  return response(sourceRows.slice((body.page-1)*body.pageSize,body.page*body.pageSize));
 }});
 h.w.localStorage.setItem(tokenKey,'token-a');
 const copies=h.load('src/insight-saved-view.ts');if(stored)copies.writeSavedInsightView('comments-default',{account:'account_a',token:'token-a'},stored.value,stored.savedAt);
 const C=h.load('src/member-insight-comments-final.tsx').MemberInsightCommentsFinal;
 return{...h,calls,waiting,legacyWrites,replace:rows=>{sourceRows=rows},clock:()=>{now+=61000},hold:page=>{mode='hold';failPage=page},success:()=>{mode='success'},deny:()=>{mode='deny'},collections:()=>collectionReads,
  start:props=>h.render(C,{noteId:'account_a',...props}),text:()=>h.w.document.body.textContent,
  more:()=>h.w.document.querySelector('.micf-more button'),saved:()=>copies.readSavedInsightView('comments-default',{account:'account_a',token:'token-a'})};
}
async function load1000(h){await h.start();await settle();for(let i=0;i<10;i++)await h.click(h.more());await settle();assert.equal(h.w.document.querySelectorAll('.micf-event-list article').length,1000);assert.match(h.text(),/架空コメント本文999/)}

// These cases deliberately use the same document's verified pages. A persisted
// offline display remains bounded and does not authorize skipping a new read.
test('コメント1000件の確認後は61秒経過して戻っても本文・収集を読み直さない',async t=>{
 const h=await fixture(t);await load1000(h);const before={calls:h.calls.length,collections:h.collections(),saved:JSON.stringify(h.saved())};
 await h.render(()=>null);h.clock();await h.start();await settle();
 assert.equal(h.calls.length,before.calls);assert.equal(h.collections(),before.collections);assert.equal(JSON.stringify(h.saved()),before.saved,'表示復元で確認時刻を進めない');
 assert.equal(h.w.document.querySelectorAll('.micf-event-list article').length,1000);assert.match(h.text(),/架空コメント本文999/);assert.equal(h.more().disabled,false);assert.deepEqual(h.calls.map(c=>c.body.page),[1,2]);
});

for(const failPage of [1,2])test(`明示再確認の${failPage}ページ失敗でも取得済み1000件と次ページ位置を保持する`,async t=>{
 const h=await fixture(t);await load1000(h);const stored=JSON.stringify(h.saved());await h.render(()=>null);h.clock();h.hold(failPage);await h.start({revision:1});await settle();
 assert.equal(h.w.document.querySelectorAll('.micf-event-list article').length,1000);assert.match(h.text(),/架空コメント本文999/);
 assert.equal(h.waiting.length,1);await settle(()=>h.waiting.shift().resolve(Response.json({ok:false,error:'TEMPORARILY_OFFLINE'},{status:500})));
 assert.equal(h.w.document.querySelectorAll('.micf-event-list article').length,1000);assert.match(h.text(),/架空コメント本文999/);assert.match(h.text(),/TEMPORARILY_OFFLINE/);assert.equal(h.more().disabled,false);
 assert.equal(JSON.stringify(h.saved()),stored,'失敗した再確認は保存済み本文・確認時刻を書き換えない');
 h.success();await h.click(h.more());await settle();assert.equal(h.calls.at(-1).body.page,3,'保持済み2ページの次を取得する');
 for(let i=0;i<2;i++)if(h.more())await h.click(h.more());await settle();assert.match(h.text(),/架空コメント本文1199/);assert.equal(h.saved().value.rows.length,500,'永続表示コピーの上限は維持');
});

test('別documentの500件コピーは即表示するが、確認済み1000件として扱わず取得する',async t=>{
 const first=await fixture(t);await load1000(first);const stored=first.saved();assert.equal(stored.value.rows.length,500);
 const second=await fixture(t,{stored});second.hold(1);await second.start();await settle();assert.equal(second.calls.length,1);assert.equal(second.calls[0].body.page,1);
 assert.match(second.text(),/前回保存分を表示・最新確認中/);assert.doesNotMatch(second.text(),/架空コメント本文999/);
 await settle(()=>second.waiting.shift().resolve(Response.json({ok:false,error:'OFFLINE'},{status:500})));assert.equal(second.more().disabled,true,'未確認の永続コピーから続き取得を始めない');
});

test('明示再確認で認証拒否されたら同tokenの履歴を表示復帰に使わない',async t=>{
 const h=await fixture(t);await load1000(h);h.deny();await h.start({revision:1});await settle();assert.doesNotMatch(h.text(),/架空コメント本文999|架空コメント本文0/);assert.equal(h.saved(),null);
 const before=h.calls.length;await h.render(()=>null);await h.start();await settle();assert.equal(h.calls.length,before+1,'拒否済みscopeの以前の検証結果は再利用しない');assert.doesNotMatch(h.text(),/架空コメント本文999|架空コメント本文0/);
});

test('再確認中のtoken切替後は古い1000件と遅い応答を新アカウントへ混ぜない',async t=>{
 const h=await fixture(t);await load1000(h);h.hold(1);await h.start({revision:1});await settle();const old=h.waiting.shift();
 h.w.localStorage.setItem(tokenKey,'token-b');await h.start({noteId:'account_b',revision:1});await settle();assert.doesNotMatch(h.text(),/架空コメント本文999/);
 await settle(()=>old.resolve(response(events.slice(0,500))));assert.doesNotMatch(h.text(),/架空コメント本文999|架空コメント本文0/);
 const newer=h.waiting.shift();await settle(()=>newer.resolve(response([{...events[0],comment_key:'other',body:'切替後だけの架空本文'}],1)));assert.match(h.text(),/切替後だけの架空本文/);assert.doesNotMatch(h.text(),/架空コメント本文999/);
});

test('日付の記事一覧も戻りでは読み直さず、変更を伴う取得後だけ表示を保って再確認する',async t=>{
 let now=Date.now(),collections=0,changed=false,deliverArticles;class Clock extends Date{static now(){return now}}
 const calls=[];
 const h=await sceneFixture(t,{globals:{Date:Clock,IntersectionObserver:class{observe(){}disconnect(){}}},dependencies:{
  './creator-avatar':{CreatorAvatar:()=>React.createElement('span')},
  './insight-member-db-fallback':{memberReadAuthFailure:()=>false,memberDbReadFallback:async()=>{throw new Error('offline')}},
  './insight-persistent-cache':{readInsightSnapshot:async()=>null,writeInsightSnapshot:async()=>{}},
 },fetch:async(url,init)=>{
  if(String(url).includes('/insight-comment-refresh')){collections++;if(collections===1)return Response.json({ok:true,paused:true});changed=true;return Response.json({ok:true,articles:1,changedComments:1,failedArticles:0})}
  const body=JSON.parse(init.body);calls.push(body);
  if(body.action==='comment_articles')return changed?new Promise(resolve=>{deliverArticles=()=>resolve(response([{article_key:'nabc',title:'更新後の架空記事',comment_count_day:2}],1))}):response([{article_key:'nabc',title:'取得時点の架空記事',comment_count_day:1}],1);
  return response([events[0]],1);
 }});
 h.w.localStorage.setItem(tokenKey,'token-a');const C=h.load('src/member-insight-comments-final.tsx').MemberInsightCommentsFinal;const start=()=>h.render(C,{noteId:'account_a'});
 await start();await h.change(h.w.document.querySelector('input[type="date"]'),'2026-10-17');await settle();assert.match(h.w.document.querySelector('.micf-tools select').textContent,/取得時点の架空記事/);
 const before={calls:calls.length,collections};await h.render(()=>null);now+=61000;await start();await settle();assert.equal(calls.length,before.calls);assert.equal(collections,before.collections);
 await h.click([...h.w.document.querySelectorAll('.micf-tools button')].find(button=>button.textContent==='noteからコメントを取得'));await settle();
 assert.equal(calls.filter(call=>call.action==='comment_articles').length,2,'実際の変更後だけ日付の記事を再確認');assert.match(h.w.document.querySelector('.micf-tools select').textContent,/取得時点の架空記事/,'確認途中も前の一覧を保持');
 await settle(deliverArticles);assert.match(h.w.document.querySelector('.micf-tools select').textContent,/更新後の架空記事/);
 const final=calls.length;await h.render(()=>null);now+=61000;await start();await settle();assert.equal(calls.length,final,'更新後の検証結果も戻るだけでは再取得しない');
});

test('コメント取得で実データが変わったら以前見た別条件の本文と会話も再確認する',async t=>{
 let changed=false,collections=0,deliverFiltered;const calls=[];
 const h=await sceneFixture(t,{globals:{IntersectionObserver:class{observe(){}disconnect(){}}},dependencies:{
  './creator-avatar':{CreatorAvatar:()=>React.createElement('span')},
  './insight-member-db-fallback':{memberReadAuthFailure:()=>false,memberDbReadFallback:async()=>{throw new Error('offline')}},
  './insight-persistent-cache':{readInsightSnapshot:async()=>null,writeInsightSnapshot:async()=>{}},
 },fetch:async(url,init)=>{
  if(String(url).includes('/insight-comment-refresh')){collections++;if(collections===1)return Response.json({ok:true,paused:true});changed=true;return Response.json({ok:true,articles:1,changedComments:1,failedArticles:0})}
  const body=JSON.parse(init.body);calls.push(body);
  if(body.action==='comments_filtered'){
   const answer=()=>response([{root_key:'fictional-root',root_body:changed?'更新後の条件別本文':'取得時点の条件別本文',actor_name:'架空の相手',actor_image_url:'https://images.test/avatar.png',status:'unreplied'}],1);
   return changed?new Promise(resolve=>{deliverFiltered=()=>resolve(answer())}):answer();
  }
  if(body.action==='comment_thread')return response([{...events[0],body:changed?'更新後の会話本文':'取得時点の会話本文'}],1);
  return response([{...events[0],body:changed?'更新後の一覧本文':'取得時点の一覧本文'}],1);
 }});
 h.w.localStorage.setItem(tokenKey,'token-a');const C=h.load('src/member-insight-comments-final.tsx').MemberInsightCommentsFinal;await h.render(C,{noteId:'account_a'});await settle();
 const tab=label=>[...h.w.document.querySelectorAll('.micf-tabs button')].find(button=>button.textContent===label);
 const open=async()=>{const details=h.w.document.querySelector('.micf-thread-list details'),before=calls.filter(call=>call.action==='comment_thread').length;await settle(()=>{details.open=true});if(calls.filter(call=>call.action==='comment_thread').length===before)await settle(()=>details.dispatchEvent(new h.w.Event('toggle')))};
 await h.click(tab('未返信'));await settle();await open();assert.match(h.w.document.body.textContent,/取得時点の会話本文/);
 await h.click(tab('すべて（全コメント）'));await h.click([...h.w.document.querySelectorAll('.micf-tools button')].find(button=>button.textContent==='noteからコメントを取得'));await settle();assert.match(h.w.document.body.textContent,/更新後の一覧本文/);
 await h.click(tab('未返信'));await settle();assert.equal(calls.filter(call=>call.action==='comments_filtered').length,2,'他条件の古い検証結果を新しい実データ確認に使わない');assert.match(h.w.document.body.textContent,/取得時点の条件別本文/,'再確認前も取得済み表示を保持');
 await settle(deliverFiltered);assert.match(h.w.document.body.textContent,/更新後の条件別本文/);await open();assert.match(h.w.document.body.textContent,/更新後の会話本文/);assert.equal(calls.filter(call=>call.action==='comment_thread').length,2,'別条件の古い詳細も失効させる');
 const before=calls.length;await h.click(tab('すべて（全コメント）'));await h.click(tab('未返信'));await settle();assert.equal(calls.length,before,'再確認済みになった条件を戻るだけでは再取得しない');
});

test('再確認失敗後に続きを取得しても、古い前半まで最新確認済みに昇格させない',async t=>{
 const h=await fixture(t);await load1000(h);const copy=JSON.stringify(h.saved()),current=events.map((row,i)=>i===0?{...row,body:'現在確認された修正本文'}:row);
 h.replace(current);h.hold(2);h.clock();await h.start({revision:1});await settle();assert.match(h.text(),/現在確認された修正本文/,'成功した先頭ページは確認途中に表示');
 await settle(()=>h.waiting.shift().resolve(Response.json({ok:false,error:'RECHECK_FAILED'},{status:500})));assert.doesNotMatch(h.text(),/現在確認された修正本文/);assert.match(h.text(),/架空コメント本文999/);
 h.success();await h.click(h.more());await settle();assert.equal(h.calls.at(-1).body.page,3);assert.equal(JSON.stringify(h.saved()),copy,'続きだけの成功で未再確認の前半の保存時刻を進めない');assert.equal(h.legacyWrites.length,0,'混在した全件を全履歴確認済みsnapshotとして保存しない');assert.match(h.text(),/RECHECK_FAILED/);
 const before=h.calls.length;await h.render(()=>null);h.hold(1);await h.start({revision:1});await settle();assert.equal(h.calls.length,before+1,'失敗した実更新の照合を表示復帰キャッシュで迂回しない');assert.match(h.text(),/架空コメント本文999/);
 await settle(()=>h.waiting.shift().resolve(response(current.slice(0,500))));assert.match(h.text(),/現在確認された修正本文/);assert.deepEqual(h.calls.slice(before).map(call=>call.body.page),[1,2,3],'読み込み済み範囲すべての再確認後に証明を更新');
 const final=h.calls.length;await h.render(()=>null);await h.start({revision:1});await settle();assert.equal(h.calls.length,final,'再確認の成功後は同じページを読み直さない');
});

test('認証拒否後は保留中の記事一覧と収集結果を後着させても表示・保存しない',async t=>{
 let deny=false,articleReply,collectionReply,articleSignal,collectionSignal;const calls=[];
 const h=await sceneFixture(t,{globals:{IntersectionObserver:class{observe(){}disconnect(){}}},dependencies:{
  './creator-avatar':{CreatorAvatar:()=>React.createElement('span')},
  './insight-member-db-fallback':{memberReadAuthFailure:message=>/HTTP_40[13]/.test(message),memberDbReadFallback:async()=>{throw new Error('offline')}},
  './insight-persistent-cache':{readInsightSnapshot:async()=>null,writeInsightSnapshot:async()=>{}},
 },fetch:async(url,init)=>{
  if(String(url).includes('/insight-comment-refresh')){collectionSignal=init.signal;return new Promise(resolve=>{collectionReply=resolve})}
  const body=JSON.parse(init.body);calls.push(body);
  if(body.action==='comment_articles'){articleSignal=init.signal;return new Promise(resolve=>{articleReply=resolve})}
  return deny?new Response('denied',{status:403}):response([events[0]],1);
 }});
 h.w.localStorage.setItem(tokenKey,'token-a');const C=h.load('src/member-insight-comments-final.tsx').MemberInsightCommentsFinal;await h.render(C,{noteId:'account_a'});await settle();
 deny=true;await h.change(h.w.document.querySelector('input[type="date"]'),'2026-10-17');await settle();assert.match(h.w.document.body.textContent,/HTTP_403/);assert.doesNotMatch(h.w.document.body.textContent,/架空コメント本文0/);assert.equal(articleSignal.aborted,true);assert.equal(collectionSignal.aborted,true);
 const before=calls.length;await settle(()=>{articleReply(response([{article_key:'nabc',title:'後着した架空の非公開記事',comment_count_day:1}],1));collectionReply(Response.json({ok:true,failedArticles:1,articleFailures:[{articleKey:'nabc',title:'後着した架空の収集結果',code:'NOTE_PUBLIC_403',retryable:false}]}))});
 assert.doesNotMatch(h.w.document.body.textContent,/後着した架空|架空コメント本文0/);assert.equal(calls.length,before,'拒否後の収集応答で新たな履歴確認を始めない');assert.equal(h.w.document.querySelector('.micf').getAttribute('aria-busy'),'false');
});

test('同じ会話の保留中の開き直しを一つにまとめ、失敗時だけ明示操作で再試行する',async t=>{
 const waiting=[],calls=[];
 const h=await sceneFixture(t,{globals:{IntersectionObserver:class{observe(){}disconnect(){}}},dependencies:{
  './creator-avatar':{CreatorAvatar:()=>React.createElement('span')},
  './insight-member-db-fallback':{memberReadAuthFailure:()=>false,memberDbReadFallback:async()=>{throw new Error('offline')}},
  './insight-persistent-cache':{readInsightSnapshot:async()=>null,writeInsightSnapshot:async()=>{}},
 },fetch:async(url,init)=>{
  if(String(url).includes('/insight-comment-refresh'))return Response.json({ok:true,paused:true});const body=JSON.parse(init.body);calls.push(body);
  if(body.action==='comments_filtered')return response([{root_key:'fictional-root',root_body:'架空の会話',actor_name:'架空の相手',actor_image_url:'https://images.test/avatar.png',status:'unreplied'}],1);
  if(body.action==='comment_thread')return new Promise(resolve=>waiting.push(resolve));return response([events[0]],1);
 }});
 h.w.localStorage.setItem(tokenKey,'token-a');const C=h.load('src/member-insight-comments-final.tsx').MemberInsightCommentsFinal;await h.render(C,{noteId:'account_a'});await h.click([...h.w.document.querySelectorAll('.micf-tabs button')].find(button=>button.textContent==='未返信'));await settle();
 const details=h.w.document.querySelector('.micf-thread-list details');await settle(()=>{details.open=true;details.dispatchEvent(new h.w.Event('toggle'));details.dispatchEvent(new h.w.Event('toggle'))});assert.equal(calls.filter(call=>call.action==='comment_thread').length,1);
 await settle(()=>waiting.shift()(Response.json({ok:false,error:'THREAD_OFFLINE'},{status:500})));assert.match(h.w.document.body.textContent,/THREAD_OFFLINE/);
 await settle(()=>details.dispatchEvent(new h.w.Event('toggle')));assert.equal(calls.filter(call=>call.action==='comment_thread').length,2);await settle(()=>waiting.shift()(response([{...events[0],body:'確認済みの架空会話本文'}],1)));assert.match(h.w.document.body.textContent,/確認済みの架空会話本文/);
 await settle(()=>details.dispatchEvent(new h.w.Event('toggle')));assert.equal(calls.filter(call=>call.action==='comment_thread').length,2,'確認済みの本文は再取得しない');
});
