import test from 'node:test';
import assert from 'node:assert/strict';
import * as React from 'react';
import {sceneFixture,pause} from './react-scene-fixture.mjs';

const tokenKey='fixture-token',scope={account:'tester',token:'token-a'};
const creator=(key,name)=>({creator_key:key,actor_name:name,actor_url:'https://note.com/'+key});
const snapshot={rows:[creator('old','前回の作者')],groups:['読む'],assigned:{old:'読む'},filter:'読む',total:125};
async function settle(work=()=>{}){await React.act(async()=>{work();for(let i=0;i<5;i++)await pause()})}
async function fixture(t,{saved=snapshot,handler}={}){
 const calls=[],pending=[],fallbackCalls=[];
 const fetch=async(url,init)=>{const body=JSON.parse(init.body);calls.push(body);return handler?handler(body,init,url):new Promise(resolve=>pending.push({body,signal:init.signal,response:resolve,resolve:value=>resolve(Response.json({ok:true,...value}))}))};
 const h=await sceneFixture(t,{fetch,dependencies:{
  './creator-avatar':{CreatorAvatar:()=>React.createElement('span')},
  './insight-account-store':{INSIGHT_TOKEN_KEY:tokenKey,currentStoredInsightAccount:()=>({noteId:h.w.localStorage.getItem(tokenKey)==='token-a'?'tester':'other'})},
  './insight-view-lifecycle':{fetchInsightResource:fetch},
  './insight-member-db-fallback':{memberReadAuthFailure:message=>/INSIGHT_SESSION_INVALID|INSIGHT_LOGIN_REQUIRED|INSIGHT_MEMBER_INACTIVE|HTTP_401|HTTP_403/i.test(message),memberDbReadFallback:async(...args)=>{fallbackCalls.push(args);throw new Error('offline')}},
 }});
 h.w.localStorage.setItem(tokenKey,'token-a');const helper=h.load('src/insight-saved-view.ts');if(saved)helper.writeSavedInsightView('favorites-last',scope,saved,Date.now()-600000);
 const Component=h.load('src/member-insight-favorites-final.tsx').MemberInsightFavoritesFinal;await h.render(Component,{});await settle();
 return{...h,Component,helper,calls,pending,fallbackCalls,body:()=>h.w.document.querySelector('.miff').textContent};
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

for(const status of [401,403])for(const action of ['favorites','list'])for(const json of [true,false])test(`${action}のHTTP ${status} (${json?'任意error':'非JSON'})は保存表示を消し遅い並列成功で復活させない`,async t=>{
 const h=await fixture(t),old=[...h.pending];assert.match(h.body(),/前回の作者/);
 await settle(()=>old.find(call=>call.body.action===action).response(new Response(json?JSON.stringify({ok:false,error:'CUSTOM_DENIED'}):'Blocked by service',{status})));
 assert.doesNotMatch(h.body(),/前回の作者|前回表示分|読む 1/);assert.equal(h.w.document.querySelectorAll('.miff-creator').length,0);assert.equal(h.w.document.querySelectorAll('.miff-group-manage article').length,0);assert.equal(h.helper.readSavedInsightView('favorites-last',scope),null);assert.equal(h.fallbackCalls.length,0);assert.ok(old.every(call=>call.signal.aborted));
 await settle(()=>old.filter(call=>call.body.action!==action).forEach(call=>call.resolve(call.body.action==='favorites'?{rows:[creator('late','拒否前の遅い作者')]}:{definitions:[{name:'拒否前のグループ'}],assignments:[]})));
 assert.doesNotMatch(h.body(),/拒否前の遅い作者|拒否前のグループ|前回の作者|前回表示分/);assert.equal(h.helper.readSavedInsightView('favorites-last',scope),null);
});

test('HTTP 500は最新確認失敗として前回の作者・グループとコピーを保持する',async t=>{
 const h=await fixture(t,{handler:async body=>body.action==='favorites'?new Response(JSON.stringify({ok:false,error:'TEMPORARILY_UNAVAILABLE'}),{status:500}):Response.json({ok:true,definitions:[{name:'読む'}],assignments:[]})});
 assert.match(h.body(),/前回の作者/);assert.match(h.body(),/前回表示分 1 \/ 125人・最新確認できず/);assert.match(h.body(),/TEMPORARILY_UNAVAILABLE/);assert.notEqual(h.helper.readSavedInsightView('favorites-last',scope),null);assert.equal(h.fallbackCalls.length,1);
});

test('グループ認証拒否で記事のruntimeコピーも消し、再確認後にも旧記事応答を戻さない',async t=>{
 let phase='normal',articleReads=0,lateArticle;
 const h=await fixture(t,{handler:async(body,init)=>{
  if(body.action==='favorites')return Response.json({ok:true,rows:[creator('old',phase==='retry'?'再確認した作者':'確認済み作者')]});
  if(body.action==='list')return phase==='denied'?new Response('forbidden',{status:403}):Response.json({ok:true,definitions:[{name:'読む'}],assignments:[{creatorKey:'old',groupName:'読む'}]});
  if(body.action==='favorite_articles'){articleReads++;return articleReads===1?Response.json({ok:true,rows:[{key:'article',title:'私的な記事表示',url:'https://note.test/article'}]}):new Promise(resolve=>{lateArticle={resolve,signal:init.signal}})}
  throw new Error('Unexpected '+body.action);
 }});
 await h.click([...h.w.document.querySelectorAll('button')].find(button=>button.textContent==='記事を見る'));assert.match(h.body(),/私的な記事表示/);
 phase='denied';await h.render(h.Component,{revision:1});await settle();assert.doesNotMatch(h.body(),/私的な記事表示|確認済み作者|前回表示分/);assert.equal(h.helper.readSavedInsightView('favorites-last',scope),null);
 if(lateArticle)assert.equal(lateArticle.signal.aborted,true);
 phase='retry';await h.click([...h.w.document.querySelectorAll('button')].find(button=>button.textContent==='再読込'));assert.match(h.body(),/再確認した作者/);
 if(lateArticle)await settle(()=>lateArticle.resolve(Response.json({ok:true,rows:[{key:'late',title:'遅れてきた私的記事',url:'https://note.test/late'}]})));
 assert.doesNotMatch(h.body(),/遅れてきた私的記事|私的な記事表示/);
});

test('グループ変更の認証拒否後は楽観状態のrollbackで旧グループを復活させない',async t=>{
 const h=await fixture(t,{handler:async body=>body.action==='assign'?new Response(JSON.stringify({ok:false,error:'CUSTOM_DENIED'}),{status:401}):Response.json({ok:true,...(body.action==='favorites'?{rows:[creator('old','確認済み作者')]}:{definitions:[{name:'読む'}],assignments:[{creatorKey:'old',groupName:'読む'}]})})});
 const select=h.w.document.querySelector('.miff-actions select');await React.act(async()=>{select.value='';select.dispatchEvent(new h.w.Event('change',{bubbles:true}));await pause()});await settle();
 assert.doesNotMatch(h.body(),/確認済み作者|前回表示分|読む 1/);assert.equal(h.w.document.querySelectorAll('.miff-creator').length,0);assert.equal(h.helper.readSavedInsightView('favorites-last',scope),null);assert.equal(h.fallbackCalls.length,0);
});

test('遅いoverflow復元は前回作者を追加通信なしで表示し最新結果には勝たない',async t=>{
 const h=await fixture(t,{saved:null});const count=h.calls.length;
 await settle(()=>{h.helper.writeSavedInsightView('favorites-last',scope,snapshot,1);h.w.dispatchEvent(new h.w.Event('mumei-insight-storage-hydrated'))});
 assert.match(h.body(),/前回の作者/);assert.equal(h.calls.length,count);
 await settle(()=>{h.pending.find(x=>x.body.action==='favorites').resolve({rows:[]});h.pending.find(x=>x.body.action==='list').resolve({definitions:[],assignments:[]})});
 await settle(()=>{h.helper.writeSavedInsightView('favorites-last',scope,snapshot,1);h.w.dispatchEvent(new h.w.Event('mumei-insight-storage-hydrated'))});assert.doesNotMatch(h.body(),/前回の作者/);
});

for(const mode of ['other-token','denied','edited'])test(`お気に入りの遅い復元を拒否 ${mode}`,async t=>{
 const h=await fixture(t,{saved:null,handler:mode==='denied'?async()=>Response.json({ok:false,error:'INSIGHT_SESSION_INVALID'},{status:401}):undefined});
 if(mode==='edited')await h.change(h.w.document.querySelector('.miff-create input'),'作成途中');
 await settle(()=>{h.helper.writeSavedInsightView('favorites-last',{...scope,token:mode==='other-token'?'other':scope.token},snapshot,1);h.w.dispatchEvent(new h.w.Event('mumei-insight-storage-hydrated'))});assert.doesNotMatch(h.body(),/前回の作者/);
});
