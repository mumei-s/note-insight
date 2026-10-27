import test from 'node:test';
import assert from 'node:assert/strict';
import * as React from 'react';
import {sceneFixture,pause} from './react-scene-fixture.mjs';

const tokenKey='fixture-token',scope={account:'tester',token:'token-a'};
const row=name=>({person_key:'person',actor_name:name,actor_url:'https://note.com/peer',relation:'mutual'});
const comparison={action:'comparison',window:'latest',relationship:'mutual',query:'',page:2,pageSize:50};
async function settle(work=()=>{}){await React.act(async()=>{work();await new Promise(r=>setTimeout(r,5));for(let i=0;i<3;i++)await pause()})}
async function fixture(t,query=comparison,{fallback=async()=>{throw new Error('offline')},delayed=false}={}){
 let now=Date.now();class Clock extends Date{static now(){return now}}
 const calls=[],timers=[];let deliver,iconCalls=0;
 const fetch=async(_url,init)=>{if(String(_url).endsWith('creator-icons')){iconCalls++;return Response.json({items:[]})}calls.push({body:JSON.parse(init.body),token:init.headers['X-Insight-Token']});return new Promise(resolve=>{deliver=(value,status=200)=>resolve(Response.json(value,{status}))})};
 const h=await sceneFixture(t,{fetch,globals:{Date:Clock},dependencies:{
  './insight-view-lifecycle':{fetchInsightResource:fetch,canRetainInsightView:at=>Number(at)<=now},
  './creator-avatar':{CreatorAvatar:()=>React.createElement('span')},
  './insight-account-store':{INSIGHT_TOKEN_KEY:tokenKey,readStoredInsightAccounts:()=>[{noteId:'tester',memberToken:'token-a'},{noteId:'other',memberToken:'token-b'}]},
  './insight-member-db-fallback':{memberReadAuthFailure:message=>/INSIGHT_(SESSION_INVALID|LOGIN_REQUIRED|MEMBER_INACTIVE)|HTTP_40[13]/.test(message),memberDbReadFallback:fallback},
 }});
 Object.defineProperty(h.w.document,'visibilityState',{value:'visible',writable:true});h.w.localStorage.setItem(tokenKey,'token-a');
 const saved=h.load('src/insight-saved-view.ts');saved.writeSavedInsightView('social-last',scope,{query,payload:{ok:true,noteId:'tester',rows:[row('前回の人物')],total:150}},Date.now()-600000);
 const savedKey=saved.savedInsightViewKey('social-last',scope),copy=h.w.localStorage.getItem(savedKey);if(delayed)h.w.localStorage.removeItem(savedKey);
 h.w.setInterval=(fn,ms)=>{const timer={fn,ms,cancelled:false};timers.push(timer);return timer};h.w.clearInterval=timer=>{if(timer)timer.cancelled=true};
 const Component=h.load('src/member-insight-social-v2.tsx').MemberInsightSocialV2;await h.render(Component,{});await settle();
 return{...h,Component,calls,copy,iconCount:()=>iconCalls,advance:ms=>{now+=ms},poll:()=>settle(()=>timers.findLast(timer=>timer.ms===60000&&!timer.cancelled).fn()),hydrate:()=>settle(()=>{h.w.localStorage.setItem(savedKey,copy);h.w.dispatchEvent(new h.w.Event('mumei-insight-storage-hydrated'))}),deliver:(value,status)=>deliver(value,status),pending:()=>deliver,body:()=>h.w.document.querySelector('.mis2-social-root,.mis2').textContent};
}

test('前回の条件とページを先に表示し、50件の最新確認を1回行う',async t=>{
 const h=await fixture(t);assert.match(h.body(),/前回の人物/);assert.match(h.body(),/前回表示分・最新確認中/);assert.equal(h.calls.length,1);assert.deepEqual(h.calls[0].body,comparison);
 assert.equal(h.w.document.querySelector('.mis2-relationship-filter select').value,'mutual');assert.match(h.body(),/2 \/ 3/);
 await settle(()=>h.deliver({ok:true,noteId:'tester',rows:[row('最新の人物')],total:150}));
 assert.match(h.body(),/最新の人物/);assert.doesNotMatch(h.body(),/前回の人物|前回表示分/);
});

test('個別履歴の前回ページを復元し、先頭へ戻して取得し直さない',async t=>{
 const query={action:'people',window:'oldest',query:'',page:3,pageSize:50,direction:'followings'};
 const h=await fixture(t,query);assert.match(h.body(),/前回の人物/);assert.match(h.body(),/前回表示分・最新確認中/);assert.equal(h.calls.length,1);assert.deepEqual(h.calls[0].body,query);
 assert.equal(h.w.document.querySelector('.mis2-pager select').value,'3');
});

test('tokenを切り替えると保存表示を消し、前tokenの遅い応答を表示しない',async t=>{
 const h=await fixture(t),old=h.pending();h.w.localStorage.setItem(tokenKey,'token-b');await h.render(h.Component,{});await settle();assert.doesNotMatch(h.body(),/前回の人物/);
 await settle(()=>old({ok:true,noteId:'tester',rows:[row('旧tokenの応答')],total:1}));assert.doesNotMatch(h.body(),/旧tokenの応答/);
 await settle(()=>h.deliver({ok:true,noteId:'other',rows:[],total:0}));
});

test('401と403は任意のエラー本文でも保存表示とコピーを破棄する',async t=>{
 for(const status of [401,403]){
  const h=await fixture(t);assert.match(h.body(),/前回の人物/);
  await settle(()=>h.deliver({ok:false,error:'アクセス拒否の応答'},status));
  assert.doesNotMatch(h.body(),/前回の人物|前回表示分/);assert.match(h.body(),/アクセスを確認できませんでした/);
  assert.equal(h.load('src/insight-saved-view.ts').readSavedInsightView('social-last',scope),null);
  const before=h.calls.length;await settle(()=>h.w.dispatchEvent(new h.w.Event('focus')));assert.equal(h.calls.length,before);
 }
});

test('並行した取得の認証拒否後は古い200応答でもコピーと人物を復活させない',async t=>{
 const h=await fixture(t),old=h.pending(),select=h.w.document.querySelector('.mis2-relationship-filter select');
 await React.act(async()=>{select.value='following_only';select.dispatchEvent(new h.w.Event('change',{bubbles:true}));await pause()});await settle();
 assert.equal(h.calls.length,2);await settle(()=>h.deliver({ok:false,error:'denied'},403));
 await settle(()=>old({ok:true,noteId:'tester',rows:[row('拒否後の古い応答')],total:1}));
 assert.doesNotMatch(h.body(),/前回の人物|拒否後の古い応答/);assert.equal(h.load('src/insight-saved-view.ts').readSavedInsightView('social-last',scope),null);
});

test('一時的な500では保存表示を残し、接続回復時に最新確認できる',async t=>{
 const h=await fixture(t);await settle(()=>h.deliver({ok:false,error:'保存先が一時停止中'},500));
 assert.match(h.body(),/前回の人物/);assert.match(h.body(),/前回表示分・最新確認できず/);assert.ok(h.load('src/insight-saved-view.ts').readSavedInsightView('social-last',scope));
 await settle(()=>h.w.dispatchEvent(new h.w.Event('focus')));assert.equal(h.calls.length,2);
 await settle(()=>h.deliver({ok:true,noteId:'tester',rows:[row('回復後の人物')],total:1}));assert.match(h.body(),/回復後の人物/);assert.doesNotMatch(h.body(),/前回表示分/);
});

test('代替の保存先読取で認証拒否された場合も前回表示へ戻さない',async t=>{
 const h=await fixture(t,comparison,{fallback:async()=>{throw new Error('HTTP_401')}});await settle(()=>h.deliver({ok:false,error:'一時的なAPI障害'},500));
 assert.doesNotMatch(h.body(),/前回の人物|前回表示分/);assert.equal(h.load('src/insight-saved-view.ts').readSavedInsightView('social-last',scope),null);
});


const defaultComparison={action:'comparison',window:'oldest',relationship:'following_only',query:'',page:1,pageSize:50};
test('遅い保管庫から照合中と同じ条件のコピーだけ復元し通信や確認時刻を増やさない',async t=>{
 const h=await fixture(t,defaultComparison,{delayed:true});assert.doesNotMatch(h.body(),/前回の人物/);assert.equal(h.calls.length,1);
 await h.hydrate();assert.match(h.body(),/前回の人物/);assert.match(h.body(),/前回表示分・最新確認中/);assert.equal(h.calls.length,1);
 const original=JSON.parse(h.copy);assert.equal(h.load('src/insight-saved-view.ts').readSavedInsightView('social-last',scope).savedAt,original.savedAt);
 await h.hydrate();assert.equal(h.calls.length,1);
 await settle(()=>h.deliver({ok:true,noteId:'tester',rows:[row('最新の人物')],total:1}));assert.match(h.body(),/最新の人物/);assert.doesNotMatch(h.body(),/前回の人物|前回表示分/);
});

for(const rows of [[],[row('先に届いた最新の人物')]])test(`照合の最新${rows.length?'成功':'空結果'}後に遅いコピーで上書きしない`,async t=>{
 const h=await fixture(t,defaultComparison,{delayed:true});await settle(()=>h.deliver({ok:true,noteId:'tester',rows,total:rows.length}));await h.hydrate();assert.doesNotMatch(h.body(),/前回の人物|前回表示分/);assert.equal(h.calls.length,1);
 if(rows.length)assert.match(h.body(),/先に届いた最新の人物/);
});

for(const status of [401,403])test(`照合のHTTP ${status}後に遅いコピーで人物を復活させない`,async t=>{
 const h=await fixture(t,defaultComparison,{delayed:true});await settle(()=>h.deliver({ok:false,error:'denied'},status));await h.hydrate();assert.doesNotMatch(h.body(),/前回の人物|前回表示分/);assert.match(h.body(),/アクセスを確認できませんでした/);
});

test('遅い保存条件は現在の照合のフィルターや履歴タブを変更しない',async t=>{
 for(const query of [comparison,{action:'people',window:'oldest',query:'',page:3,pageSize:50,direction:'followings'}]){
  const h=await fixture(t,query,{delayed:true});await h.hydrate();assert.doesNotMatch(h.body(),/前回の人物|前回表示分/);assert.equal(h.calls.length,1);assert.deepEqual(h.calls[0].body,defaultComparison);assert.equal(h.w.document.querySelector('.mis2-relationship-filter select').value,'following_only');
 }
});

for(const transition of ['filter','route','token','revision'])test(`照合の${transition}変更後に遅いコピーを挿し込まない`,async t=>{
 const h=await fixture(t,defaultComparison,{delayed:true});
 if(transition==='filter')await React.act(async()=>{const select=h.w.document.querySelector('.mis2-relationship-filter select');select.value='mutual';select.dispatchEvent(new h.w.Event('change',{bubbles:true}));await pause()});
 if(transition==='route')await h.click([...h.w.document.querySelectorAll('button')].find(button=>button.textContent==='個別の履歴'));
 if(transition==='token')h.w.localStorage.setItem(tokenKey,'token-b');
 if(transition==='revision')await h.render(h.Component,{revision:1});
 await settle();const count=h.calls.length;await h.hydrate();assert.doesNotMatch(h.body(),/前回の人物|前回表示分/);assert.equal(h.calls.length,count);
});


test('一時的な照合失敗後の遅いコピーは確認失敗のまま表示し新しい通信を起こさない',async t=>{
 const h=await fixture(t,defaultComparison,{delayed:true});await settle(()=>h.deliver({ok:false,error:'TEMPORARILY_OFFLINE'},500));await h.hydrate();assert.match(h.body(),/前回の人物/);assert.match(h.body(),/前回表示分・最新確認できず/);assert.match(h.body(),/TEMPORARILY_OFFLINE/);assert.equal(h.calls.length,1);
});


for(const action of ['comparison','people'])test(`確認済み${action}は時間経過後のページ戻りと画面戻りでも通信せず条件を維持する`,async t=>{
 const query=action==='comparison'?{...defaultComparison}:{action:'people',window:'latest',query:'',page:1,pageSize:50,direction:'followers'};
 const pageRows=name=>Array.from({length:50},(_,i)=>({...row(name+'-'+i),person_key:'person-'+i}));
 const h=await fixture(t,query);await settle(()=>h.deliver({ok:true,noteId:'tester',rows:pageRows('確認済みページ1'),total:150}));
 const pager=label=>[...h.w.document.querySelectorAll('.mis2-pager button')].find(button=>button.textContent===label);
 await h.click(pager('→'));await settle();assert.equal(h.calls.length,2);
 await settle(()=>h.deliver({ok:true,noteId:'tester',rows:pageRows('確認済みページ2'),total:150}));
 h.advance(86400000);await h.click(pager('←'));await settle();assert.equal(h.calls.length,2);assert.match(h.body(),/確認済みページ1/);
 await h.render(()=>null);await h.render(h.Component,{});await settle();assert.equal(h.calls.length,2);assert.match(h.body(),/確認済みページ1/);assert.equal(h.iconCount(),action==='people'?2:0);
 await settle(()=>{h.w.dispatchEvent(new h.w.Event('focus'));h.w.dispatchEvent(new h.w.Event('pageshow'))});assert.equal(h.calls.length,2);
 await h.poll();assert.equal(h.calls.length,3,'定期的な最新確認は保持済みcacheで止めない');assert.match(h.body(),/確認済みページ1/);
 await settle(()=>h.deliver({ok:true,noteId:'tester',rows:pageRows('最新確認後のページ1'),total:150}));assert.match(h.body(),/最新確認後のページ1/);
 await h.render(h.Component,{revision:1});await settle();assert.equal(h.calls.length,4,'明示更新は同条件でも再確認する');
 await settle(()=>h.deliver({ok:true,noteId:'tester',rows:pageRows('明示更新後のページ1'),total:150}));assert.match(h.body(),/明示更新後のページ1/);
});
