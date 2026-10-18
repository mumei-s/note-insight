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

test('前回表示100件とページ・選択条件を先に表示し、裏ではそのページだけ最新確認する',async t=>{
 const latest=deferred(),sum=deferred();const h=await fixture(t,{respond:c=>c.action==='likes'?latest.promise:c.action==='summary'?sum.promise:undefined});
 const state=selection({status:'completed',scope:'month',month:'2026-09',sort:'oldest',query:'保存した検索',page:2});
 h.seed({selection:state,rows:[{...row(),confirmed:true}],total:250});h.seedSummary();await h.show();
 assert.match(h.text(),/前回表示のスキ/);assert.match(h.text(),/保存スキ123/);assert.match(h.w.document.querySelector('.miu-pager').textContent,/2 \/ 3/);
 assert.equal(h.w.document.querySelector('.miu-tabs button.active').textContent,'対応済み');assert.equal(h.w.document.querySelector('input[type="month"]').value,'2026-09');
 assert.equal(h.w.document.querySelector('select').value,'oldest');assert.equal(h.w.document.querySelector('input[placeholder="名前・ID・記事"]').value,'保存した検索');
 assert.match(h.w.document.querySelector('[data-insight-saved-view="likes"]').textContent,/前回表示分.*最新を確認中/);assert.match(h.w.document.querySelector('[data-insight-saved-view="summary"]').textContent,/前回表示分.*最新を確認中/);
 assert.deepEqual(h.calls.map(c=>c.action).sort(),['likes','summary']);const call=h.calls.find(c=>c.action==='likes');assert.equal(call.page,2);assert.equal(call.pageSize,100);assert.equal(call.query,'保存した検索');assert.equal(call.status,'completed');
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
 let failed=true;const h=await fixture(t,{respond:c=>c.action==='likes'&&failed?Response.json({ok:false,error:'offline'},{status:503}):undefined});h.seed({selection:selection({page:2}),rows:[row('保持するページ2')],total:250});await h.show();
 assert.match(h.text(),/保持するページ2/);assert.match(h.text(),/最新確認に失敗/);assert.match(h.text(),/前回表示分/);assert.match(h.w.document.querySelector('.miu-pager').textContent,/2 \/ 3/);
 failed=false;await h.show({revision:1});assert.match(h.text(),/tester最新スキ/);assert.equal(h.read().value.selection.page,2);assert.equal(h.w.document.querySelector('[data-insight-saved-view="likes"]'),null);
});

test('対応済みの保存成功を表示コピーへ反映し、未保存の押下は保存結果と混同しない',async t=>{
 const saved=deferred();const h=await fixture(t,{respond:c=>c.action==='like_completion'?saved.promise:undefined});await h.show();
 await h.click(h.w.document.querySelector('.miu-handled'));assert.equal(h.read().value.rows[0].confirmed,false);
 await settle(()=>saved.resolve(Response.json({ok:true})));assert.equal(h.read().value.rows[0].confirmed,true);assert.equal(h.count('likes'),1);
});

test('確認できた表示ページを保存し、コンポーネントを開き直しても同じページから表示する',async t=>{
 let wait=false;const next=deferred();const h=await fixture(t,{respond:c=>c.action==='likes'?(wait?next.promise:Response.json({rows:[{...row(`確認済みページ${c.page}`),confirmed:c.status==='completed'}],total:250})):undefined});
 await h.show();await h.click([...h.w.document.querySelectorAll('.miu-tabs button')].find(b=>b.textContent==='対応済み'));await h.click(h.w.document.querySelector('.miu-pager button:last-child'));
 assert.equal(h.read().value.selection.page,2);assert.equal(h.read().value.selection.status,'completed');wait=true;await h.show({key:'reopened'});
 assert.match(h.text(),/確認済みページ2/);assert.match(h.w.document.querySelector('.miu-pager').textContent,/2 \/ 3/);assert.match(h.text(),/前回表示分.*最新を確認中/);assert.equal(h.calls.filter(c=>c.action==='likes').at(-1).page,2);
 await settle(()=>next.resolve(Response.json({rows:[{...row('最新のページ2'),confirmed:true}],total:250})));assert.match(h.text(),/最新のページ2/);
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
