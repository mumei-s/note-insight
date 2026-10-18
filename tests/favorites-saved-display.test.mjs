import test from 'node:test';
import assert from 'node:assert/strict';
import * as React from 'react';
import {sceneFixture,pause} from './react-scene-fixture.mjs';

const tokenKey='fixture-token',scope={account:'tester',token:'token-a'};
const creator=(key,name)=>({creator_key:key,actor_name:name,actor_url:'https://note.com/'+key});
const snapshot={rows:[creator('old','前回の作者')],groups:['読む'],assigned:{old:'読む'},filter:'読む',total:125};
async function settle(work=()=>{}){await React.act(async()=>{work();for(let i=0;i<5;i++)await pause()})}
async function fixture(t,{saved=snapshot,handler}={}){
 const calls=[],pending=[];
 const fetch=async(url,init)=>{const body=JSON.parse(init.body);calls.push(body);return handler?handler(body):new Promise(resolve=>pending.push({body,resolve:value=>resolve(Response.json({ok:true,...value}))}))};
 const h=await sceneFixture(t,{fetch,dependencies:{
  './creator-avatar':{CreatorAvatar:()=>React.createElement('span')},
  './insight-account-store':{INSIGHT_TOKEN_KEY:tokenKey,currentStoredInsightAccount:()=>({noteId:h.w.localStorage.getItem(tokenKey)==='token-a'?'tester':'other'})},
  './insight-view-lifecycle':{fetchInsightResource:fetch},
  './insight-member-db-fallback':{memberReadAuthFailure:()=>true,memberDbReadFallback:async()=>{throw new Error('offline')}},
 }});
 h.w.localStorage.setItem(tokenKey,'token-a');const helper=h.load('src/insight-saved-view.ts');if(saved)helper.writeSavedInsightView('favorites-last',scope,saved,Date.now()-600000);
 const Component=h.load('src/member-insight-favorites-final.tsx').MemberInsightFavoritesFinal;await h.render(Component,{});await settle();
 return{...h,Component,helper,calls,pending,body:()=>h.w.document.querySelector('.miff').textContent};
}

test('保存した作者とグループを即表示し、一覧とグループだけを最新確認する',async t=>{
 const h=await fixture(t);assert.match(h.body(),/前回の作者/);assert.match(h.body(),/前回表示分 1 \/ 125人・最新確認中/);assert.equal(h.calls.length,2);assert.deepEqual(h.calls.map(c=>c.action).sort(),['favorites','list']);
 assert.equal([...h.w.document.querySelectorAll('.miff-tabs button')].find(b=>b.classList.contains('active')).textContent,'読む 1');
 await settle(()=>{h.pending.find(x=>x.body.action==='favorites').resolve({rows:[creator('new','最新の作者')]});h.pending.find(x=>x.body.action==='list').resolve({definitions:[{name:'読む'}],assignments:[{creatorKey:'new',groupName:'読む'}]})});
 assert.match(h.body(),/最新の作者/);assert.doesNotMatch(h.body(),/前回の作者|前回表示分/);
});

test('全登録者を再保存せず100件に限定し、解除時は古い表示コピーを無効にする',async t=>{
 const all=Array.from({length:125},(_,i)=>creator('p'+i,'作者'+i));
 const h=await fixture(t,{saved:null,handler:async body=>Response.json({ok:true,...(body.action==='favorites'?{rows:all}:body.action==='list'?{definitions:[],assignments:[]}:{})})});
 let saved=h.helper.readSavedInsightView('favorites-last',scope);assert.equal(saved.value.rows.length,100);assert.equal(saved.value.total,125);
 await h.click(h.w.document.querySelector('.miff-remove'));assert.equal(h.helper.readSavedInsightView('favorites-last',scope),null);assert.equal(h.w.document.querySelectorAll('.miff-creator').length,124);
 await h.click(h.w.document.querySelector('.miff-tabs button'));assert.equal(h.helper.readSavedInsightView('favorites-last',scope),null,'表示だけの操作で解除前のコピーを復活させない');
});

test('保存表示からグループ変更中は、成功前の楽観状態を再起動用コピーにしない',async t=>{
 const h=await fixture(t);
 const select=h.w.document.querySelector('.miff-actions select');
 await React.act(async()=>{select.value='';select.dispatchEvent(new h.w.Event('change',{bubbles:true}));await pause()});
 assert.equal(h.helper.readSavedInsightView('favorites-last',scope),null);assert.equal(h.calls.at(-1).action,'assign');
 await settle(()=>{h.pending.find(x=>x.body.action==='favorites').resolve({rows:[creator('old','解除前の遅い作者')]});h.pending.find(x=>x.body.action==='list').resolve({definitions:[{name:'読む'}],assignments:[{creatorKey:'old',groupName:'読む'}]})});
 assert.equal(h.helper.readSavedInsightView('favorites-last',scope),null);assert.doesNotMatch(h.body(),/解除前の遅い作者/);
 await settle(()=>h.pending.find(x=>x.body.action==='assign').resolve({}));
});

test('別tokenへ切替後に前の作者と遅い応答を持ち込まない',async t=>{
 const h=await fixture(t),old=[...h.pending];h.w.localStorage.setItem(tokenKey,'token-b');await h.render(h.Component,{});assert.doesNotMatch(h.body(),/前回の作者/);
 await settle(()=>old.forEach(x=>x.resolve(x.body.action==='favorites'?{rows:[creator('old','旧tokenの作者')]}:{definitions:[],assignments:[]})));
 assert.doesNotMatch(h.body(),/旧tokenの作者/);
});
