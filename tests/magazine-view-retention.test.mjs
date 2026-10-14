import test from 'node:test';
import assert from 'node:assert/strict';
import * as React from 'react';
import {sceneFixture,pause} from './react-scene-fixture.mjs';

const tokenKey='fixture-token';
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return{promise,resolve,reject}};
const article=title=>({key:'article',title,url:'https://note.com/author/n/article',publishAt:'2026-10-14T09:00:00+09:00',author:{urlname:'author',nickname:'作者'}});
const magazine=(title='現在のマガジン',articleTitle='最近の記事')=>({key:'mA',title,url:'https://note.com/creator/m/mA',relation:'owner',owner:{urlname:'tester',nickname:'本人'},recentArticles:[article(articleTitle)]});
async function settle(work=()=>{}){await React.act(async()=>{work();for(let i=0;i<5;i++)await pause()})}
async function fixture(t,{history=async()=>({rows:[magazine()]}),search=async()=>({rows:[]}),cached,active=true}={}){
 let now=Date.now();class Clock extends Date{static now(){return now}}
 const h=await sceneFixture(t,{globals:{Date:Clock},dependencies:{'./creator-avatar':{CreatorAvatar:()=>React.createElement('span'),creatorNoteId:r=>r?.urlname||''},'./insight-account-store':{INSIGHT_TOKEN_KEY:tokenKey}}});
 Object.defineProperty(h.w.document,'visibilityState',{value:'visible',writable:true});h.w.localStorage.setItem(tokenKey,'token-a');
 const Component=h.load('src/member-insight-magazines.tsx').MemberInsightMagazines,props={revision:0,accountKey:'tester',history,search,cached,active};
 const start=next=>h.render(Component,{...props,...next});await start();await settle();
 return{...h,start,advance:ms=>{now+=ms},body:()=>h.w.document.querySelector('.mimag')?.textContent||'',toggle:()=>h.w.document.querySelector('.miu-mag-actions button'),searchButton:()=>[...h.w.document.querySelectorAll('.miu-calendar-tools button')].find(b=>b.textContent==='検索')};
}

test('同じセッションの新鮮な戻りは全履歴を再取得せず、条件と検索結果を維持する',async t=>{
 let historyCalls=0,searchCalls=0;
 const h=await fixture(t,{history:async()=>{historyCalls++;return{rows:[magazine()]}},search:async()=>{searchCalls++;return{rows:[article('検索で取得した記事')]}}});
 await h.click(h.toggle());await h.click(h.searchButton());assert.equal(historyCalls,1);assert.equal(searchCalls,1);assert.match(h.body(),/検索で取得した記事/);
 await h.start({active:false});await h.start({active:true});await settle(()=>{h.w.dispatchEvent(new h.w.Event('focus'));h.w.dispatchEvent(new h.w.Event('pageshow'))});
 assert.equal(historyCalls,1);assert.equal(searchCalls,1);assert.equal(h.toggle().getAttribute('aria-expanded'),'true');assert.match(h.body(),/検索で取得した記事/);
});

test('TTL超過後は保持した一覧を表示したまま最新を確認する',async t=>{
 let calls=0;const next=deferred();const h=await fixture(t,{history:()=>++calls===1?Promise.resolve({rows:[magazine('保存されたマガジン')]}):next.promise});
 h.advance(61001);await settle(()=>h.w.dispatchEvent(new h.w.Event('focus')));assert.equal(calls,2);assert.match(h.body(),/保存されたマガジン/);
 await settle(()=>next.resolve({rows:[magazine('再確認後のマガジン')]}));assert.match(h.body(),/再確認後のマガジン/);assert.doesNotMatch(h.body(),/保存されたマガジン/);
});

test('revision変更時は古いhistoryFlightを使わず、古い完了で最新を上書きしない',async t=>{
 const old=deferred();let calls=0;const h=await fixture(t,{history:()=>++calls===1?old.promise:Promise.resolve({rows:[magazine('明示更新後のマガジン')]})});
 await h.start({revision:1});await settle();assert.equal(calls,2);assert.match(h.body(),/明示更新後のマガジン/);
 await settle(()=>old.resolve({rows:[magazine('更新前の古いマガジン')]}));assert.doesNotMatch(h.body(),/更新前の古いマガジン/);assert.match(h.body(),/明示更新後のマガジン/);
});

test('明示更新では開いた同条件の検索を再確認し、旧revisionの検索cacheを使わない',async t=>{
 let histories=0,searches=0;const h=await fixture(t,{history:async()=>({rows:[magazine('マガジン',++histories===1?'前の記事':'今の記事')]}),search:async()=>({rows:[article(++searches===1?'前の検索記事':'更新した検索記事')]})});
 await h.click(h.toggle());await h.click(h.searchButton());await h.click(h.searchButton());assert.equal(searches,1);
 await h.start({revision:1});await settle();assert.equal(histories,2);assert.equal(searches,2);assert.equal(h.toggle().getAttribute('aria-expanded'),'true');
 assert.match(h.body(),/更新した検索記事/);assert.doesNotMatch(h.body(),/前の検索記事/);
});

test('revisionが変わった後の遅い検索応答は最新の記事へ混ざらない',async t=>{
 const old=deferred();let searches=0;const h=await fixture(t,{search:()=>++searches===1?old.promise:Promise.resolve({rows:[article('現在の検索記事')]})});
 await h.click(h.toggle());await h.click(h.searchButton());await h.start({revision:1});await settle();assert.equal(searches,2);
 await settle(()=>old.resolve({rows:[article('遅い旧検索記事')]}));assert.match(h.body(),/現在の検索記事/);assert.doesNotMatch(h.body(),/遅い旧検索記事/);
});

test('同じnote IDでもtokenを切り替えたら再確認し、前tokenの遅い履歴を拒否する',async t=>{
 const old=deferred();let calls=0;const h=await fixture(t,{history:()=>++calls===1?old.promise:Promise.resolve({rows:[magazine('切替後のマガジン')]})});
 h.w.localStorage.setItem(tokenKey,'token-b');await h.start();await settle();assert.equal(calls,2);assert.match(h.body(),/切替後のマガジン/);
 await settle(()=>old.resolve({rows:[magazine('前tokenのマガジン')]}));assert.doesNotMatch(h.body(),/前tokenのマガジン/);
});

test('別アカウントの確認失敗で、前アカウントの表示やcached fallbackを復元しない',async t=>{
 let calls=0;const h=await fixture(t,{cached:{rows:[magazine('前アカウントの保存履歴')],__cachedAt:Date.now()-600000},history:async()=>{
  if(++calls===1)return{rows:[magazine('前アカウントの表示')]};throw new Error('offline');
 }});
 assert.match(h.body(),/前アカウントの表示/);await h.start({accountKey:'other'});await settle();assert.equal(calls,2);
 assert.doesNotMatch(h.body(),/前アカウントの表示|前アカウントの保存履歴/);
});

test('古い起動cacheは通信失敗時だけ表示し、次の確認で最新へ戻る',async t=>{
 const first=deferred();let calls=0;const h=await fixture(t,{cached:{rows:[magazine('前回ページの保存履歴')],__cachedAt:Date.now()-600000},history:()=>++calls===1?first.promise:Promise.resolve({rows:[magazine('最新確認済みの履歴')]})});
 assert.doesNotMatch(h.body(),/前回ページの保存履歴/);await settle(()=>first.reject(new Error('offline')));assert.match(h.body(),/前回ページの保存履歴/);
 await settle(()=>h.w.dispatchEvent(new h.w.Event('focus')));assert.equal(calls,2);assert.match(h.body(),/最新確認済みの履歴/);assert.doesNotMatch(h.body(),/前回ページの保存履歴/);
});

test('offline fallbackを最新扱いせず、復帰時には再確認できる',async t=>{
 let calls=0;const h=await fixture(t,{history:async()=>++calls===1?{rows:[magazine('前回のマガジン')],__offlineCache:true}:{rows:[magazine('接続回復後のマガジン')]}});
 assert.match(h.body(),/保存済みのマガジン/);await settle(()=>h.w.dispatchEvent(new h.w.Event('focus')));assert.equal(calls,2);assert.match(h.body(),/接続回復後のマガジン/);
});

test('offline検索結果をfresh cacheにせず、同条件の再検索を止めない',async t=>{
 let searches=0;const h=await fixture(t,{search:async()=>({rows:[article(++searches===1?'前回の検索記事':'再検索後の記事')],__offlineCache:searches===1})});
 await h.click(h.toggle());await h.click(h.searchButton());assert.match(h.body(),/保存済みの検索結果/);await h.click(h.searchButton());assert.equal(searches,2);assert.match(h.body(),/再検索後の記事/);
});
