import test from 'node:test';
import assert from 'node:assert/strict';
import * as React from 'react';
import {sceneFixture,pause} from './react-scene-fixture.mjs';

const tokenKey='magazine-fixture-token';
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return{promise,resolve,reject}};
const article=title=>({key:title,title,url:'https://note.com/fictional_writer/n/'+encodeURIComponent(title),publishAt:'2026-10-27T00:00:00Z',author:{urlname:'fictional_writer'}});
const magazine=title=>({key:'fictional_magazine',title,url:'https://note.com/tester/m/fictional_magazine',relation:'owner',owner:{urlname:'tester'},recentArticles:[]});
async function settle(work=()=>{}){await React.act(async()=>{work();for(let i=0;i<5;i++)await pause()})}
async function fixture(t,{history,search}={}){
 let now=Date.now();const initialAt=now;class Clock extends Date{static now(){return now}}
 const h=await sceneFixture(t,{globals:{Date:Clock,Error},dependencies:{'./creator-avatar':{CreatorAvatar:()=>null,creatorNoteId:row=>row?.urlname||''},'./insight-account-store':{INSIGHT_TOKEN_KEY:tokenKey}}});
 Object.defineProperty(h.w.document,'visibilityState',{value:'visible',writable:true});h.w.localStorage.setItem(tokenKey,'token-a');
 const C=h.load('src/member-insight-magazines.tsx').MemberInsightMagazines,cache=h.load('src/insight-saved-view.ts');let historyCalls=0,searchCalls=0;
 const props={revision:0,accountKey:'tester',active:true,history:()=>{historyCalls++;return history?.(historyCalls)||Promise.resolve({rows:[magazine('架空のマガジン')]})},search:(params,signal)=>{searchCalls++;return search?.(params,signal,searchCalls)||Promise.resolve({rows:[article('検索した架空の記事')]})}};
 const show=async next=>{await h.render(C,{...props,...next});await settle()};
 return{...h,show,initialAt,advance:ms=>{now+=ms},empty:()=>h.render(()=>null,{}),text:()=>h.w.document.body.textContent,toggle:()=>h.w.document.querySelector('.miu-mag-actions button'),searchButton:()=>[...h.w.document.querySelectorAll('.miu-calendar-tools button')].find(button=>button.textContent==='検索'),saved:()=>cache.readSavedInsightView('magazines-last',{account:'tester',token:h.w.localStorage.getItem(tokenKey)}),get historyCalls(){return historyCalls},get searchCalls(){return searchCalls}};
}

test('長時間後の戻る・focus・pageshowは一覧も同条件検索も再取得せず時刻を変えない',async t=>{
 const h=await fixture(t);await h.show();await h.click(h.toggle());await h.click(h.searchButton());const originalStamp=h.saved().savedAt;
 h.advance(600001);await h.show({active:false});await h.show();await settle(()=>{h.w.dispatchEvent(new h.w.Event('focus'));h.w.dispatchEvent(new h.w.Event('pageshow'))});await h.click(h.searchButton());
 assert.equal(h.historyCalls,1);assert.equal(h.searchCalls,1);assert.match(h.text(),/検索した架空の記事/);assert.equal(h.saved().savedAt,originalStamp);
});

test('同じdocumentでunmount後に戻っても一覧・絞込・展開・検索結果を即座に復元する',async t=>{
 const h=await fixture(t);await h.show();await h.click([...h.w.document.querySelectorAll('.miu-tabs button')].find(button=>button.textContent==='自分がオーナー'));await h.click(h.toggle());await h.click(h.searchButton());
 const stamp=h.saved().savedAt;await h.empty();h.advance(600001);await h.show();
 assert.equal(h.historyCalls,1);assert.equal(h.searchCalls,1);assert.equal(h.toggle().getAttribute('aria-expanded'),'true');assert.equal(h.w.document.querySelector('.miu-tabs button.active').textContent,'自分がオーナー');assert.match(h.text(),/検索した架空の記事/);assert.equal(h.saved().savedAt,stamp);
});

test('同じdocumentの取得中にunmount/remountしても同じhistory通信をまとめる',async t=>{
 const pending=deferred(),h=await fixture(t,{history:()=>pending.promise});await h.show();await h.empty();await h.show();assert.equal(h.historyCalls,1);
 await settle(()=>pending.resolve({rows:[magazine('取得が完了したマガジン')]}));assert.match(h.text(),/取得が完了したマガジン/);assert.equal(h.historyCalls,1);
});

test('revision更新は新しく確認し、token・本人切替のremountに前の結果を混ぜない',async t=>{
 const h=await fixture(t,{history:count=>Promise.resolve({rows:[magazine('マガジン'+count)]})});await h.show();await h.show({revision:1});assert.equal(h.historyCalls,2);assert.match(h.text(),/マガジン2/);
 await h.empty();h.w.localStorage.setItem(tokenKey,'token-b');await h.show({accountKey:'other'});assert.equal(h.historyCalls,3);assert.match(h.text(),/マガジン3/);assert.equal(h.w.document.querySelector("[data-magazine-key] > div > b").textContent,"マガジン3");
});

test('wrapperの確認済み再利用は元の成功時刻を保存し、前回の検索を自動巡回しない',async t=>{
 let stamp;const h=await fixture(t,{history:()=>Promise.resolve({rows:[magazine('保持済みマガジン')],__retainedView:true,__cachedAt:stamp})});stamp=h.initialAt;h.advance(600001);await h.show();assert.equal(h.saved().savedAt,stamp);assert.equal(h.historyCalls,1);assert.equal(h.searchCalls,0);
});

test('確認拒否は同じtokenの旧revisionも失効させ、遅い旧応答を確認済みに戻さない',async t=>{
 const old=deferred(),h=await fixture(t,{history:count=>count===1?old.promise:count===2?Promise.reject(new Error('INSIGHT_SESSION_INVALID')):Promise.resolve({rows:[magazine('再確認した本人のマガジン')]})});await h.show();await h.show({revision:1});assert.equal(h.historyCalls,2);
 await settle(()=>old.resolve({rows:[magazine('拒否前の古いマガジン')]}));assert.doesNotMatch(h.text(),/拒否前の古いマガジン/);await h.empty();await h.show();assert.equal(h.historyCalls,3);assert.match(h.text(),/再確認した本人のマガジン/);
});

test('記事検索の本人確認拒否後はdocument cacheから一覧を再表示しない',async t=>{
 const h=await fixture(t,{search:()=>Promise.reject(new Error('INSIGHT_SESSION_INVALID'))});await h.show();await h.click(h.toggle());await h.click(h.searchButton());assert.doesNotMatch(h.text(),/架空のマガジン/);await h.empty();await h.show();assert.equal(h.historyCalls,2);
});

test('新しいdocumentの保存コピーは確認済み扱いにせずサーバーを一度確認する',async t=>{
 const pending=deferred(),h=await fixture(t,{history:()=>pending.promise});const saved=h.load('src/insight-saved-view.ts');saved.writeSavedInsightView('magazines-last',{account:'tester',token:'token-a'},{mode:'all',query:'',open:null,rows:[magazine('前documentの表示コピー')],total:1,visibleTotal:1,refreshed:'',states:{}},h.initialAt-86400000);
 await h.show();assert.equal(h.historyCalls,1);assert.match(h.text(),/前回表示分/);await settle(()=>pending.resolve({rows:[magazine('サーバーで確認した現在のマガジン')]}));assert.match(h.text(),/サーバーで確認した現在/);assert.doesNotMatch(h.text(),/前回表示分/);
});


test('検索結果は24条件に制限し、保持した同条件は時間経過後も使える',async t=>{
 const h=await fixture(t,{search:params=>Promise.resolve({rows:[article(String(params.query))]})});await h.show();await h.click(h.toggle());const input=h.w.document.querySelector('input[aria-label="記事タイトル・投稿者"]');
 for(let i=0;i<25;i++){await h.change(input,'条件'+i);await h.click(h.searchButton())}assert.equal(h.searchCalls,25);h.advance(600001);await h.click(h.searchButton());assert.equal(h.searchCalls,25);
 await h.change(input,'条件0');await h.click(h.searchButton());assert.equal(h.searchCalls,26,'上限から外れた最古の条件だけ再確認');
 await h.change(input,'条件24');await h.click(h.searchButton());assert.equal(h.searchCalls,26);
});

test('不正なhistoryを確認済みにせず再試行し、構造化された確認拒否もキャッシュを失効させる',async t=>{
 const h=await fixture(t,{history:count=>Promise.resolve(count===1?{rows:[null]}:count===2?{rows:[magazine('検証したマガジン')]}:{ok:false,error:{code:'INSIGHT_SESSION_INVALID',message:'アクセスを確認してください'}})});await h.show();assert.match(h.text(),/更新を確認できません/);await settle(()=>h.w.dispatchEvent(new h.w.Event('focus')));assert.equal(h.historyCalls,2);assert.match(h.text(),/検証したマガジン/);
 await h.show({revision:1});assert.doesNotMatch(h.text(),/検証したマガジン/);assert.equal(h.saved(),null);await h.empty();await h.show();assert.equal(h.historyCalls,4);assert.doesNotMatch(h.text(),/検証したマガジン/);
});
