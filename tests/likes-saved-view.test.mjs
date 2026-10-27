import test from 'node:test';
import assert from 'node:assert/strict';
import * as React from 'react';
import {sceneFixture,pause} from './react-scene-fixture.mjs';

const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve}};
const summary=(id='tester',likes=250)=>({member:{noteId:id,displayName:id,imageUrl:null},summary:{identifiedLikeCount:likes},analysis:{},counts:{comments:0,followers:0,followings:0,notifications:0},articles:[]});
const selection=(overrides={})=>({status:'all',scope:'all',day:'',month:'',year:'2026',sort:'newest',query:'',page:1,...overrides});
const row=(name='前回表示のスキ')=>({article_key:'n1',liker_key:'person',actor_name:name,article_title:name,confirmed:false,liked_at:'2026-10-17T00:00:00Z'});
async function settle(fn){await React.act(async()=>{fn();for(let i=0;i<4;i++)await pause()})}
async function fixture(t,{respond}={}){
 let h,now=Date.now();class Clock extends Date{static now(){return now}}
 const account=()=>h.w.localStorage.getItem('token')==='b'?'second':'tester',calls=[];
 h=await sceneFixture(t,{globals:{Date:Clock,requestAnimationFrame:()=>{}},dependencies:{
  './insight-account-store':{INSIGHT_TOKEN_KEY:'token',currentStoredInsightAccount:()=>({noteId:account(),displayName:account(),memberToken:h.w.localStorage.getItem('token'),status:'active'}),setAccessIntent:()=>{}},
  './creator-avatar':{CreatorAvatar:()=>null,creatorImage:()=>null},'./member-insight-dm':{MemberInsightDm:()=>null},'./member-insight-magazines':{MemberInsightMagazines:()=>null},
 },fetch:async(url,init)=>{const body=JSON.parse(init.body||'{}'),call={url:String(url),...body,token:init.headers['X-Insight-Token'],signal:init.signal};calls.push(call);const answer=respond?.(call,calls);if(answer)return answer;if(call.url.includes('/rest/'))return Response.json({ok:false},{status:503});if(body.action==='summary')return Response.json(summary(account()));if(body.action==='sync'||body.action==='like_completion'||body.action==='favorite_toggle')return Response.json({ok:true});return Response.json({rows:[row(account()+'最新スキ')],total:250})}});
 h.w.localStorage.setItem('token','a');
 const cache=h.load('src/insight-saved-view.ts'),C=h.load('src/member-insight-unified-v4.tsx').MemberInsightUnifiedV4;
 return{...h,calls,cache,show:props=>h.render(C,{revision:0,active:true,...props}),text:()=>h.w.document.body.textContent,
  seed:(value,at=now-86400000,scope={account:'tester',token:'a'})=>cache.writeSavedInsightView('likes-last',scope,value,at),
  seedSummary:(at=now-86400000)=>cache.writeSavedInsightView('unified-summary',{account:'tester',token:'a'},summary('tester',123),at),
  read:()=>cache.readSavedInsightView('likes-last',{account:account(),token:h.w.localStorage.getItem('token')}),advance:ms=>{now+=ms},
  count:action=>calls.filter(c=>c.action===action).length};
}

test('最新1ページ目と一致する保存表示だけを先に表示し、裏では最新確認する',async t=>{
 const latest=deferred(),sum=deferred();const h=await fixture(t,{respond:c=>c.action==='likes'?latest.promise:c.action==='summary'?sum.promise:undefined});
 const state=selection();
 const savedAt=Date.parse('2026-10-01T12:34:00+09:00');h.seed({selection:state,rows:[{...row(),confirmed:true}],total:250},savedAt);h.seedSummary(savedAt);await h.show();
 assert.match(h.text(),/前回表示のスキ/);assert.match(h.text(),/保存スキ123/);assert.match(h.w.document.querySelector('.miu-pager').textContent,/1 \/ 3/);
 assert.equal(h.w.document.querySelector('.miu-tabs button.active').textContent,'すべて');assert.equal(h.w.document.querySelector('input[type="month"]'),null);
 assert.equal(h.w.document.querySelector('select').value,'newest');assert.equal(h.w.document.querySelector('input[placeholder="名前・ID・記事"]').value,'');
 assert.match(h.w.document.querySelector('[data-insight-saved-view="likes"]').textContent,/前回表示分.*最新を確認中/);assert.match(h.w.document.querySelector('[data-insight-saved-view="summary"]').textContent,/前回表示分.*最新を確認中/);
 for(const kind of ['likes','summary']){const label=h.w.document.querySelector(`[data-insight-saved-view="${kind}"]`).textContent;assert.match(label,/2026\/10\/1/);assert.match(label,/12:34/);assert.ok(!label.includes(String(savedAt)));}
 assert.deepEqual(h.calls.map(c=>c.action).sort(),['likes','summary']);const call=h.calls.find(c=>c.action==='likes');assert.equal(call.page,1);assert.equal(call.pageSize,100);assert.equal(call.query,'');assert.equal(call.status,'all');
 await settle(()=>{latest.resolve(Response.json({rows:[{...row('同件数でも最新本文を採用'),confirmed:true}],total:250}));sum.resolve(Response.json(summary()))});
 assert.match(h.text(),/同件数でも最新本文を採用/);assert.doesNotMatch(h.text(),/前回表示のスキ/);assert.equal(h.w.document.querySelector('[data-insight-saved-view="likes"]'),null);assert.equal(h.w.document.querySelector('[data-insight-saved-view="summary"]'),null);
});

test('保存済み0件も読込画面に戻さず表示し、確認成功まで最新扱いしない',async t=>{
 const latest=deferred();const h=await fixture(t,{respond:c=>c.action==='likes'?latest.promise:undefined});h.seed({selection:selection(),rows:[],total:0});await h.show();
 assert.equal(h.w.document.querySelector('.miu-load-scene'),null);assert.match(h.w.document.querySelector('.miu-section-head').textContent,/0件/);assert.match(h.text(),/前回表示分/);assert.equal(h.count('likes'),1);
 await settle(()=>latest.resolve(Response.json({rows:[],total:0})));assert.equal(h.w.document.querySelector('[data-insight-saved-view="likes"]'),null);
});

test('保存ページの条件を変えた時は別条件の前回表示を流用しない',async t=>{
 const next=deferred();const h=await fixture(t,{respond:c=>c.action==='likes'&&c.status==='pending'?next.promise:undefined});h.seed({selection:selection(),rows:[row()],total:250});await h.show();
 await h.click([...h.w.document.querySelectorAll('.miu-tabs button')].find(b=>b.textContent==='未対応'));
 assert.doesNotMatch(h.text(),/tester最新スキ/);assert.ok(h.w.document.querySelector('.miu-load-scene'));assert.equal(h.calls.filter(c=>c.action==='likes').at(-1).page,1);
 await settle(()=>next.resolve(Response.json({rows:[row('未対応の確認結果')],total:1})));assert.match(h.text(),/未対応の確認結果/);
});

for(const token of ['b','c',''])test(`別本人・同本人新token・ログアウトで前回表示を引き継がない (${token||'logout'})`,async t=>{
 const latest=deferred();const h=await fixture(t,{respond:c=>c.action==='likes'?latest.promise:undefined});h.seed({selection:selection(),rows:[row('旧token専用履歴')],total:1});h.seedSummary();h.w.localStorage.setItem('token',token);await h.show();
 assert.doesNotMatch(h.text(),/旧token専用履歴/);assert.doesNotMatch(h.text(),/保存スキ123/);assert.equal(h.w.document.querySelector('[data-insight-saved-view]'),null);
 await settle(()=>latest.resolve(Response.json({rows:[row('新tokenの取得結果')],total:1})));
});

test('遅い旧本人応答で現在本人の保存ページを上書きしない',async t=>{
 const old=deferred();const h=await fixture(t,{respond:c=>c.action==='likes'&&c.token==='a'?old.promise:undefined});h.seed({selection:selection(),rows:[row('本人a保存')],total:1});await h.show();
 h.w.localStorage.setItem('token','b');await h.show();assert.match(h.text(),/second最新スキ/);assert.doesNotMatch(h.text(),/本人a保存/);
 await settle(()=>old.resolve(Response.json({rows:[row('遅い本人a')],total:1})));assert.doesNotMatch(h.text(),/遅い本人a/);assert.equal(h.read().value.rows[0].actor_name,'second最新スキ');
});

test('最新確認失敗時は前回表示を保持して失敗を明示し、成功時だけ保存を差し替える',async t=>{
 let failed=true;const h=await fixture(t,{respond:c=>c.action==='likes'&&failed?Response.json({ok:false,error:'offline'},{status:503}):undefined});h.seed({selection:selection(),rows:[row('保持するページ1')],total:250});await h.show();
 assert.match(h.text(),/保持するページ1/);assert.match(h.text(),/最新確認に失敗/);assert.match(h.text(),/前回表示分/);assert.match(h.w.document.querySelector('.miu-pager').textContent,/1 \/ 3/);
 failed=false;await h.show({revision:1});assert.match(h.text(),/tester最新スキ/);assert.equal(h.read().value.selection.page,1);assert.equal(h.w.document.querySelector('[data-insight-saved-view="likes"]'),null);
});

test('対応済みの保存成功を表示コピーへ反映し、未保存の押下は保存結果と混同しない',async t=>{
 const saved=deferred();const h=await fixture(t,{respond:c=>c.action==='like_completion'?saved.promise:undefined});await h.show();
 await h.click(h.w.document.querySelector('.miu-handled'));assert.equal(h.read().value.rows[0].confirmed,false);
 await settle(()=>saved.resolve(Response.json({ok:true})));assert.equal(h.read().value.rows[0].confirmed,true);assert.equal(h.count('likes'),1);
});

test('同じdocumentの画面往復・復帰・TOPからの再mountは選択を保持する',async t=>{
 let wait=false;const next=deferred();const h=await fixture(t,{respond:c=>c.action==='likes'?(wait?next.promise:Response.json({rows:[{...row(`確認済みページ${c.page}`),confirmed:c.status==='completed'}],total:250})):undefined});
 await h.show();await h.click([...h.w.document.querySelectorAll('.miu-tabs button')].find(b=>b.textContent==='対応済み'));await h.click(h.w.document.querySelector('.miu-pager button:last-child'));
 assert.equal(h.read().value.selection.page,2);assert.equal(h.read().value.selection.status,'completed');
 const count=h.count('likes');await h.show({active:false});await h.show();
 await settle(()=>{h.w.dispatchEvent(new h.w.Event('pagehide'));h.w.document.dispatchEvent(new h.w.Event('visibilitychange'));h.w.dispatchEvent(new h.w.PageTransitionEvent('pageshow',{persisted:true}));});
 assert.equal(h.count('likes'),count);assert.match(h.text(),/確認済みページ2/);assert.match(h.w.document.querySelector('.miu-pager').textContent,/2 \/ 3/);assert.equal(h.w.document.querySelector('.miu-tabs button.active').textContent,'対応済み');
 wait=true;await h.show({key:'reopened'});
 assert.equal(h.count('likes'),count,'same-document remount reuses the verified page without HTTP');
 await h.show({key:'reopened',revision:1});
 assert.match(h.text(),/確認済みページ2/);assert.equal(h.calls.filter(c=>c.action==='likes').at(-1).page,2);assert.equal(h.calls.filter(c=>c.action==='likes').at(-1).status,'completed');
 await settle(()=>next.resolve(Response.json({rows:[{...row('最新のページ2'),confirmed:true}],total:250})));assert.match(h.text(),/最新のページ2/);assert.equal(h.w.document.querySelector('.miu-handled').getAttribute('aria-pressed'),'true');
 const fresh=await fixture(t);fresh.seed(JSON.parse(JSON.stringify(h.read().value)));await fresh.show();assert.equal(fresh.calls.find(c=>c.action==='likes').page,1);assert.equal(fresh.calls.find(c=>c.action==='likes').status,'all');
});

for(const oldSelection of [selection({page:19}),selection({page:19,status:'completed',scope:'month',month:'2026-09',sort:'oldest',query:'保存した検索'}),selection({status:'completed'}),selection({sort:'oldest'}),selection({query:'過去の記事'}),selection({scope:'day',day:'2026-10-09'}),selection({scope:'month',month:'2026-09'}),selection({scope:'year',year:'2025'})])test('新しいdocumentは古いページや絞り込みを表示せず最新の初期条件を取得する',async t=>{
 const latest=deferred();const h=await fixture(t,{respond:c=>c.action==='likes'?latest.promise:undefined});
 const saved={selection:oldSelection,rows:[{...row('昔の19ページ目'),confirmed:true}],total:2000};h.seed(saved);await h.show();
 assert.doesNotMatch(h.text(),/昔の19ページ目/);assert.equal(h.w.document.querySelector('[data-insight-saved-view="likes"]'),null);assert.ok(h.w.document.querySelector('.miu-load-scene'));
 assert.equal(h.w.document.querySelector('.miu-tabs button.active').textContent,'すべて');assert.equal(h.w.document.querySelector('.mini button.active').textContent,'全期間');assert.equal(h.w.document.querySelector('select').value,'newest');assert.equal(h.w.document.querySelector('input[placeholder="名前・ID・記事"]').value,'');
 const call=h.calls.find(c=>c.action==='likes');assert.deepEqual([call.page,call.pageSize,call.status,call.sort,call.query,call.dateFrom,call.dateTo],[1,100,'all','newest','',null,null]);
 assert.deepEqual(JSON.parse(JSON.stringify(h.read().value)),saved,'古いコピーや対応済みデータを削除しない');
 await settle(()=>h.w.dispatchEvent(new h.w.Event('mumei-insight-storage-hydrated')));assert.doesNotMatch(h.text(),/昔の19ページ目/);assert.equal(h.count('likes'),1);
 await settle(()=>latest.resolve(Response.json({rows:[{...row('今日の最新'),confirmed:true}],total:2000})));
 assert.match(h.text(),/今日の最新/);assert.equal(h.read().value.selection.page,1);assert.equal(h.w.document.querySelector('.miu-handled').getAttribute('aria-pressed'),'true');assert.equal(h.count('like_completion'),0);assert.equal(h.count('sync'),0);
});

for(const invalid of [{selection:selection({scope:'day',day:'壊れた日付'}),rows:[row()],total:1},{selection:selection(),rows:Array(101).fill(row()),total:101},{selection:selection({status:'unknown'}),rows:[row()],total:1}])test('不正な保存ページを初期表示せず、現在100件を確認する',async t=>{
 const next=deferred();const h=await fixture(t,{respond:c=>c.action==='likes'?next.promise:undefined});h.seed(invalid);await h.show();assert.doesNotMatch(h.text(),/前回表示のスキ/);assert.equal(h.w.document.querySelector('[data-insight-saved-view="likes"]'),null);assert.equal(h.calls.find(c=>c.action==='likes').pageSize,100);
 await settle(()=>next.resolve(Response.json({rows:[],total:0})));
});

test('同じ本人のtoken切替後に通信が失敗しても前tokenの集計・履歴へ戻さない',async t=>{
 const h=await fixture(t,{respond:c=>c.token==='c'?Response.json({ok:false,error:'offline'},{status:503}):undefined});await h.show();assert.match(h.w.document.querySelector('.miu-stats').textContent,/保存スキ250/);
 h.w.localStorage.setItem('token','c');await h.show();assert.match(h.w.document.querySelector('.miu-stats').textContent,/保存スキ0/);assert.doesNotMatch(h.text(),/tester最新スキ/);assert.equal(h.read(),null);
});

test('本人確認を拒否された時は保存履歴を残して表示し続けない',async t=>{
 const h=await fixture(t,{respond:c=>c.action==='likes'?Response.json({ok:false,error:'INSIGHT_SESSION_INVALID'},{status:401}):undefined});h.seed({selection:selection(),rows:[row('拒否後は隠す保存履歴')],total:1});await h.show();
 assert.doesNotMatch(h.text(),/拒否後は隠す保存履歴/);assert.equal(h.w.document.querySelector('[data-insight-saved-view="likes"]'),null);assert.equal(h.read(),null);
});

test('同じ最新データを指す保存コピーでも過去の未使用条件を初期コントロールへ持ち越さない',async t=>{
 const next=deferred();const h=await fixture(t,{respond:c=>c.action==='likes'?next.promise:undefined});h.seed({selection:selection({scope:'day',day:'',month:'2025-09',year:'2025'}),rows:[row()],total:1});await h.show();
 assert.match(h.text(),/前回表示のスキ/);assert.equal(h.w.document.querySelector('.mini button.active').textContent,'全期間');assert.equal(h.w.document.querySelector('input[type="date"]'),null);
 await settle(()=>next.resolve(Response.json({rows:[row()],total:1})));assert.equal(h.read().value.selection.year,String(new Date().getFullYear()));assert.equal(h.read().value.selection.month,'');
});

for(const deniedAction of ['likes','summary'])test(`追加したdocument内の閲覧位置は${deniedAction}の認証拒否後に復元しない`,async t=>{
 let stage='ready';const held=deferred();const h=await fixture(t,{respond:c=>{
  if(stage==='denied'&&c.action===deniedAction)return Response.json({ok:false,error:'INSIGHT_SESSION_INVALID'},{status:401});
  if(stage==='held'&&c.action==='likes')return held.promise;
  if(c.action==='likes')return Response.json({rows:[row(`本人確認前のページ${c.page}`)],total:250});
 }});await h.show();await h.click(h.w.document.querySelector('.miu-pager button:last-child'));assert.equal(h.read().value.selection.page,2);
 stage='denied';await h.show({revision:1});assert.equal(h.read(),null);
 stage='held';h.w.localStorage.setItem('token','a');await h.show({key:'after-denial',revision:2});
 // This verifies document-local selection invalidation, not all legacy raw-cache behavior.
 assert.doesNotMatch(h.text(),/本人確認前のページ2/);assert.equal(h.calls.filter(c=>c.action==='likes').at(-1).page,1);
 await settle(()=>held.resolve(Response.json({rows:[],total:0})));
});

test('対応済みとお気に入りの保存結果は同じdocumentの再mountでも保持する',async t=>{
 let hold=false;const next=deferred();const h=await fixture(t,{respond:c=>hold&&c.action==='likes'?next.promise:undefined});await h.show();
 await h.click(h.w.document.querySelector('.miu-handled'));await h.click(h.w.document.querySelector('.miu-star'));
 assert.equal(h.read().value.rows[0].confirmed,true);assert.equal(h.read().value.rows[0].favorite,true);
 hold=true;await h.show({key:'after-edits'});assert.equal(h.w.document.querySelector('.miu-handled').getAttribute('aria-pressed'),'true');assert.equal(h.w.document.querySelector('.miu-star').getAttribute('aria-label'),'お気に入り解除');
 await settle(()=>next.resolve(Response.json({rows:[{...row(),confirmed:true,favorite:true}],total:250})));
});

test('最新ページの保存コピーは別ページ閲覧でも残り、新documentで即時表示する',async t=>{
 const h=await fixture(t,{respond:c=>c.action==='likes'?Response.json({rows:[row(`確認済みページ${c.page}`)],total:250}):undefined});
 await h.show();await h.click(h.w.document.querySelector('.miu-pager button:last-child'));
 const latest=h.cache.readSavedInsightView('likes-latest',{account:'tester',token:'a'});
 assert.equal(latest.value.selection.page,1);assert.equal(h.read().value.selection.page,2);
 const waiting=deferred(),fresh=await fixture(t,{respond:c=>c.action==='likes'?waiting.promise:undefined});fresh.seed(JSON.parse(JSON.stringify(h.read().value)));
 fresh.cache.writeSavedInsightView('likes-latest',{account:'tester',token:'a'},JSON.parse(JSON.stringify(latest.value)),latest.savedAt);
 await fresh.show();assert.match(fresh.text(),/確認済みページ1/);assert.doesNotMatch(fresh.text(),/確認済みページ2/);assert.equal(fresh.w.document.querySelector('.miu-load-scene'),null);assert.equal(fresh.count('likes'),1);
});

test('別条件で確定した対応済み・お気に入りを最新ページコピーにも反映し日時は進めない',async t=>{
 const h=await fixture(t);await h.show();const read=()=>h.cache.readSavedInsightView('likes-latest',{account:'tester',token:'a'}),at=read().savedAt;
 await h.click([...h.w.document.querySelectorAll('.miu-tabs button')].find(b=>b.textContent==='未対応'));h.advance(1000);
 await h.click(h.w.document.querySelector('.miu-star'));await h.click(h.w.document.querySelector('.miu-handled'));
 assert.equal(read().value.rows[0].favorite,true);assert.equal(read().value.rows[0].confirmed,true);assert.equal(read().savedAt,at);
});
