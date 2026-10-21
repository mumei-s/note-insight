import test from 'node:test';
import assert from 'node:assert/strict';
import * as React from 'react';
import {sceneFixture,pause} from './react-scene-fixture.mjs';
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return{promise,resolve,reject}};
const magazine=(title='前回のマガジン',key='mA')=>({key,title,url:`https://note.com/tester/m/${key}`,relation:'owner',owner:{urlname:'tester',nickname:'本人'},recentArticles:[]});
const copy=(overrides={})=>({mode:'owner',query:'マガジン',open:null,rows:[magazine()],total:12,visibleTotal:1,refreshed:'2026-10-17T00:00:00Z',states:{},...overrides});
async function settle(fn=()=>{}){await React.act(async()=>{fn();for(let i=0;i<4;i++)await pause()})}
async function fixture(t,{respond,answerSearch}={}){
 const h=await sceneFixture(t,{globals:{Error},dependencies:{'./creator-avatar':{CreatorAvatar:()=>null,creatorNoteId:r=>r?.urlname||''},'./insight-account-store':{INSIGHT_TOKEN_KEY:'token'}}});
 h.w.localStorage.setItem('token','a');Object.defineProperty(h.w.document,'visibilityState',{value:'visible',writable:true});
 const cache=h.load('src/insight-saved-view.ts'),C=h.load('src/member-insight-magazines.tsx').MemberInsightMagazines,calls=[],searches=[];
 const history=()=>{calls.push(h.w.localStorage.getItem('token'));return respond?.(calls)||Promise.resolve({rows:[magazine('最新のマガジン')]})},search=(params,signal)=>{searches.push({params,signal});return answerSearch?.(params)||Promise.resolve({rows:[]})};
 return{...h,calls,searches,cache,show:props=>h.render(C,{revision:0,active:true,accountKey:'tester',history,search,...props}),text:()=>h.w.document.body.textContent,
 seed:(value,scope={account:'tester',token:'a'})=>cache.writeSavedInsightView('magazines-last',scope,value,Date.now()-86400000),read:()=>cache.readSavedInsightView('magazines-last',{account:'tester',token:h.w.localStorage.getItem('token')})};
}

test('マガジンの前回表示・条件・件数を先に表示し、保存先の確認だけを1回実行する',async t=>{
 const next=deferred();const h=await fixture(t,{respond:()=>next.promise});h.seed(copy());await h.show();
 assert.match(h.text(),/前回のマガジン/);assert.match(h.text(),/1 \/ 12誌/);assert.match(h.w.document.querySelector('[data-insight-saved-view="magazines"]').textContent,/前回表示分.*最新を確認中/);assert.doesNotMatch(h.w.document.querySelector('[data-insight-saved-view="magazines"]').textContent,/確認 —/);
 assert.equal(h.w.document.querySelector('.miu-tabs button.active').textContent,'自分がオーナー');assert.equal(h.w.document.querySelector('input').value,'マガジン');assert.equal(h.calls.length,1);assert.equal(h.searches.length,0);
 await settle(()=>next.resolve({rows:[magazine('最新のマガジン')]}));assert.match(h.text(),/最新のマガジン/);assert.equal(h.w.document.querySelector('[data-insight-saved-view="magazines"]'),null);
});

test('前回の記事検索結果は表示するが、開き直しただけでnote記事検索を再巡回しない',async t=>{
 const next=deferred(),article={url:'https://note.com/tester/n/n1',title:'前回の記事検索結果'};const h=await fixture(t,{respond:()=>next.promise});
 h.seed(copy({open:'mA',states:{mA:{day:'',query:'',rows:[article],searched:true,busy:false,error:'',signature:'[]',total:1}}}));await h.show();assert.match(h.text(),/前回の記事検索結果/);assert.equal(h.searches.length,0);
 await settle(()=>next.resolve({rows:[magazine('最新のマガジン')]}));assert.equal(h.searches.length,0);assert.match(h.text(),/前回表示分です。最新確認は検索/);
 await h.click([...h.w.document.querySelectorAll('.miu-calendar-tools button')].find(b=>b.textContent==='検索'));assert.equal(h.searches.length,1);
});

test('保存済み0誌を空白の読込画面へ戻さず、成功するまで確認済みにしない',async t=>{
 const next=deferred();const h=await fixture(t,{respond:()=>next.promise});h.seed(copy({rows:[],total:0,visibleTotal:0,query:''}));await h.show();assert.match(h.text(),/0 \/ 0誌/);assert.equal(h.w.document.querySelector('.miu-load-scene'),null);assert.match(h.text(),/前回表示分/);
 await settle(()=>next.resolve({rows:[]}));assert.equal(h.w.document.querySelector('[data-insight-saved-view="magazines"]'),null);
});

test('前回表示は最大100誌で正しい全件数を示し、条件を変えた時に不完全な別条件結果を表示しない',async t=>{
 const next=deferred();const h=await fixture(t,{respond:()=>next.promise});h.seed(copy({mode:'all',query:'',rows:Array.from({length:100},(_,i)=>magazine(`マガジン${i}`,`m${i}`)),total:150,visibleTotal:150}));await h.show();assert.match(h.text(),/150 \/ 150誌/);assert.match(h.text(),/先頭100誌を表示/);
 await h.click([...h.w.document.querySelectorAll('.miu-tabs button')].find(b=>b.textContent==='参加中'));assert.doesNotMatch(h.text(),/マガジン99/);assert.ok(h.w.document.querySelector('.miu-load-scene'));assert.equal(h.calls.length,1);
 await settle(()=>next.resolve({rows:[{...magazine('参加中の現在マガジン'),relation:'member'}]}));assert.match(h.text(),/参加中の現在マガジン/);
});

for(const [account,token]of[['other','b'],['tester','c'],['tester','']])test('本人・token・ログアウトの境界で前回表示を混ぜない '+account+token,async t=>{
 const next=deferred();const h=await fixture(t,{respond:()=>next.promise});h.seed(copy());h.w.localStorage.setItem('token',token);await h.show({accountKey:account});assert.doesNotMatch(h.text(),/前回のマガジン/);assert.equal(h.w.document.querySelector('[data-insight-saved-view]'),null);await settle(()=>next.resolve({rows:[]}));
});

test('確認失敗では保存表示を保持し、同じ本人のtoken切替後は旧表示へ戻らない',async t=>{
 const next=deferred();let fail=false;const h=await fixture(t,{respond:()=>fail?Promise.reject(new Error('offline')):next.promise});h.seed(copy());await h.show();await settle(()=>next.reject(new Error('offline')));assert.match(h.text(),/前回のマガジン/);assert.match(h.text(),/更新を確認できませんでした/);
 fail=true;h.w.localStorage.setItem('token','c');await h.show();assert.doesNotMatch(h.text(),/前回のマガジン/);
});

test('確認拒否と遅い旧本人応答で保存表示を復元しない',async t=>{
 const old=deferred();const h=await fixture(t,{respond:calls=>calls.length===1?old.promise:Promise.reject(new Error('INSIGHT_SESSION_INVALID'))});h.seed(copy());await h.show();h.w.localStorage.setItem('token','c');await h.show();await settle(()=>old.resolve({rows:[magazine('遅い前本人マガジン')]}));assert.doesNotMatch(h.text(),/前回のマガジン|遅い前本人/);assert.equal(h.read(),null);
});

test('確認したマガジンを100誌まで保存し、選択変更で確認時刻を新しくしない',async t=>{
 const h=await fixture(t,{respond:()=>Promise.resolve({rows:Array.from({length:150},(_,i)=>magazine(`マガジン${i}`,`m${i}`))})});await h.show();const first=h.read();assert.equal(first.value.rows.length,100);assert.equal(first.value.total,150);
 await h.click([...h.w.document.querySelectorAll('.miu-tabs button')].find(b=>b.textContent==='自分がオーナー'));assert.equal(h.read().savedAt,first.savedAt);assert.equal(h.read().value.mode,'owner');assert.equal(h.searches.length,0);
});

test('遅いoverflow復元はマガジンと保存条件を戻し検索巡回せず最新応答を優先する',async t=>{
 const next=deferred(),h=await fixture(t,{respond:()=>next.promise});await h.show();
 await settle(()=>{h.seed(copy());h.w.dispatchEvent(new h.w.Event('mumei-insight-storage-hydrated'))});assert.match(h.text(),/前回のマガジン/);assert.equal(h.calls.length,1);assert.equal(h.searches.length,0);
 await settle(()=>next.resolve({rows:[]}));await settle(()=>{h.seed(copy());h.w.dispatchEvent(new h.w.Event('mumei-insight-storage-hydrated'))});assert.doesNotMatch(h.text(),/前回のマガジン/);
});

for(const mode of ['other-token','denied','edited'])test(`マガジンの遅い復元を拒否 ${mode}`,async t=>{
 const next=deferred(),h=await fixture(t,{respond:()=>next.promise});await h.show();
 if(mode==='denied')await settle(()=>next.reject(new Error('INSIGHT_SESSION_INVALID')));
 if(mode==='edited')await h.change(h.w.document.querySelector('input'),'入力途中');
 await settle(()=>{h.seed(copy(),{account:'tester',token:mode==='other-token'?'other':'a'});h.w.dispatchEvent(new h.w.Event('mumei-insight-storage-hydrated'))});assert.doesNotMatch(h.text(),/前回のマガジン/);
});
