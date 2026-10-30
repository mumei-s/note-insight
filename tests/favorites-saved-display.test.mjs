import test from 'node:test';
import assert from 'node:assert/strict';
import * as React from 'react';
import {sceneFixture,pause} from './react-scene-fixture.mjs';

const tokenKey='fixture-token',scope={account:'tester',token:'token-a'};
const creator=(key,name)=>({creator_key:key,actor_name:name,actor_url:'https://note.com/'+key});
const snapshot={rows:[creator('old','前回の作者')],groups:['読む'],assigned:{old:'読む'},filter:'読む',total:125};
async function settle(work=()=>{}){await React.act(async()=>{work();for(let i=0;i<5;i++)await pause()})}
async function fixture(t,{saved=snapshot,handler}={}){
 let now=Date.now();class Clock extends Date{static now(){return now}}
 const calls=[],pending=[],fallbackCalls=[];
 const fetch=async(url,init)=>{const body=JSON.parse(init.body);calls.push(body);return handler?handler(body,init,url):new Promise(resolve=>pending.push({body,signal:init.signal,response:resolve,resolve:value=>resolve(Response.json({ok:true,...value}))}))};
 const h=await sceneFixture(t,{fetch,globals:{Date:Clock},dependencies:{
  './creator-avatar':{CreatorAvatar:()=>React.createElement('span')},
  './insight-account-store':{INSIGHT_TOKEN_KEY:tokenKey,currentStoredInsightAccount:()=>({noteId:h.w.localStorage.getItem(tokenKey)==='token-a'?'tester':'other'})},
  './insight-view-lifecycle':{fetchInsightResource:fetch},
  './insight-member-db-fallback':{memberReadAuthFailure:message=>/INSIGHT_SESSION_INVALID|INSIGHT_LOGIN_REQUIRED|INSIGHT_MEMBER_INACTIVE|HTTP_401|HTTP_403/i.test(message),memberDbReadFallback:async(...args)=>{fallbackCalls.push(args);throw new Error('offline')}},
 }});
 h.w.localStorage.setItem(tokenKey,'token-a');const helper=h.load('src/insight-saved-view.ts');if(saved)helper.writeSavedInsightView('favorites-last',scope,saved,Date.now()-600000);
 const Component=h.load('src/member-insight-favorites-final.tsx').MemberInsightFavoritesFinal;await h.render(Component,{});await settle();
 return{...h,Component,helper,calls,pending,fallbackCalls,advance:ms=>{now+=ms},body:()=>h.w.document.querySelector('.miff').textContent};
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

test('再確認中に既読を保存した記事は、先に開始した遅い未読応答で戻さない',async t=>{
 let articleReads=0,lateArticles;
 const h=await fixture(t,{saved:null,handler:async body=>{
  if(body.action==='favorites')return Response.json({ok:true,rows:[creator('author','確認済み作者')]});
  if(body.action==='list')return Response.json({ok:true,definitions:[],assignments:[]});
  if(body.action==='favorite_articles'){
   articleReads++;const value={ok:true,rows:[{key:'article',title:'既読状態を保持する記事',url:'https://note.test/article',read:false}]};
   if(articleReads===1)return Response.json(value);
   return new Promise(resolve=>{lateArticles=()=>resolve(Response.json(value))});
  }
  if(body.action==='favorite_read_set')return Response.json({ok:true,read:body.read});
  throw new Error('Unexpected '+body.action);
 }});
 await h.click([...h.w.document.querySelectorAll('button')].find(button=>button.textContent==='記事を見る'));
 await h.render(h.Component,{revision:1});await settle();assert.ok(lateArticles);
 await h.click([...h.w.document.querySelectorAll('.miff-articles button')].find(button=>button.textContent==='既読にする'));
 assert.match(h.w.document.querySelector('.miff-articles').textContent,/未読に戻す/);
 await settle(lateArticles);
 assert.match(h.w.document.querySelector('.miff-articles').textContent,/未読に戻す/);
 assert.equal(h.calls.filter(body=>body.action==='favorite_read_set').length,1);
});

test('お気に入りの61件目以降は明示した記事ページだけを取得し、最後から前へ戻れる',async t=>{
 const h=await fixture(t,{saved:null,handler:async body=>{
  if(body.action==='favorites')return Response.json({ok:true,rows:[creator('author','記事の多い作者')]});
  if(body.action==='list')return Response.json({ok:true,definitions:[],assignments:[]});
  if(body.action==='favorite_articles')return Response.json({ok:true,page:body.page,hasNext:body.page===1,rows:Array.from({length:body.page===1?60:1},(_,i)=>({key:'article-'+((body.page-1)*60+i+1),title:'記事'+((body.page-1)*60+i+1),url:'https://note.test/'+((body.page-1)*60+i+1),read:body.page===2}))});
  throw new Error('Unexpected '+body.action);
 }});
 assert.equal(h.calls.filter(body=>body.action==='favorite_articles').length,0);
 await h.click([...h.w.document.querySelectorAll('button')].find(button=>button.textContent==='記事を見る'));
 const pager=()=>h.w.document.querySelector('.miff-article-pager');
 assert.equal(h.w.document.querySelectorAll('.miff-articles article').length,60);
 assert.equal(pager().querySelector('button').disabled,true);
 assert.equal(pager().querySelector('button:last-child').disabled,false);
 assert.match(h.w.document.querySelector('.miff-articles input').placeholder,/このページ/);
 assert.deepEqual(h.calls.filter(body=>body.action==='favorite_articles').map(body=>body.page),[1],'opening never preloads every page');
 await h.click(pager().querySelector('button:last-child'));
 assert.match(h.w.document.querySelector('.miff-articles').textContent,/記事61/);
 assert.equal(h.w.document.querySelectorAll('.miff-articles article').length,1);
 assert.match(pager().textContent,/記事ページ 2/);
 assert.equal(pager().querySelector('button:last-child').disabled,true);
 await h.click([...h.w.document.querySelectorAll('button')].find(button=>button.textContent==='記事を閉じる'));
 const reads=h.calls.filter(body=>body.action==='favorite_articles').length;
 await h.click([...h.w.document.querySelectorAll('button')].find(button=>button.textContent==='記事を見る'));
 assert.equal(h.calls.filter(body=>body.action==='favorite_articles').length,reads,'reopening retains the verified page');
 assert.match(pager().textContent,/記事ページ 2/);
 await h.render(()=>null);await h.render(h.Component,{});await settle();
 assert.match(pager().textContent,/記事ページ 2/);
 assert.match(h.w.document.querySelector('.miff-articles').textContent,/記事61/);
 assert.equal(h.calls.filter(body=>body.action==='favorite_articles').length,reads,'returning from another screen retains the verified page without another read');
 await h.click(pager().querySelector('button'));
 assert.match(pager().textContent,/記事ページ 1/);
 assert.deepEqual(h.calls.filter(body=>body.action==='favorite_articles').map(body=>body.page),[1,2,1]);
});

test('記事ページの取得失敗と古い遅延応答は確認済みページや別本人へ混ぜない',async t=>{
 let phase='fail',resolveOld;
 const h=await fixture(t,{saved:null,handler:async body=>{
  if(body.action==='favorites')return Response.json({ok:true,rows:[creator('author','記事の作者')]});
  if(body.action==='list')return Response.json({ok:true,definitions:[],assignments:[]});
  if(body.action==='favorite_articles'){
   if(body.page===1)return Response.json({ok:true,hasNext:true,rows:[{key:'first',title:'確認済みの記事',url:'https://note.test/first'}]});
   if(phase==='fail')return Response.json({ok:false,error:'TEMPORARY_ARTICLE_FAILURE'},{status:500});
   return new Promise(resolve=>{resolveOld=()=>resolve(Response.json({ok:true,hasNext:false,rows:[{key:'late',title:'前の本人の遅い古記事',url:'https://note.test/late'}]}))});
  }
  throw new Error('Unexpected '+body.action);
 }});
 await h.click([...h.w.document.querySelectorAll('button')].find(button=>button.textContent==='記事を見る'));
 await h.click(h.w.document.querySelector('.miff-article-pager button:last-child'));await settle();
 assert.match(h.body(),/確認済みの記事/);assert.match(h.w.document.querySelector('.miff-article-pager').textContent,/記事ページ 1/);
 phase='late';await h.click(h.w.document.querySelector('.miff-article-pager button:last-child'));assert.ok(resolveOld);
 assert.equal(h.w.document.querySelector('.miff-article-pager button:last-child').disabled,true);
 h.w.localStorage.setItem(tokenKey,'token-b');await h.render(h.Component,{});
 await settle(resolveOld);
 assert.doesNotMatch(h.body(),/前の本人の遅い古記事/);
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


test('確認済み一覧・記事・選択条件は時間経過後の画面戻りと記事再展開で再読取しない',async t=>{
 let articleVersion='確認済みの記事';
 const h=await fixture(t,{handler:async body=>Response.json({ok:true,...(body.action==='favorites'?{rows:[creator('old','確認済み作者')]}:body.action==='list'?{definitions:[{name:'読む'}],assignments:[{creatorKey:'old',groupName:'読む'}]}:{rows:[{key:'article',title:articleVersion,url:'https://note.test/article'}]})})});
 const articleButton=label=>[...h.w.document.querySelectorAll('button')].find(button=>button.textContent===label);
 await h.click(articleButton('記事を見る'));assert.equal(h.calls.length,3);await h.change(h.w.document.querySelector('.miff-articles input'),'記事');
 await h.click(articleButton('記事を閉じる'));h.advance(86400000);await h.click(articleButton('記事を見る'));assert.equal(h.calls.length,3);assert.match(h.body(),/確認済みの記事/);
 await h.render(()=>null);await h.render(h.Component,{});await settle();assert.equal(h.calls.length,3);assert.match(h.body(),/確認済み作者|確認済みの記事/);assert.ok(h.w.document.querySelector('.miff-articles'));assert.equal(h.w.document.querySelector('.miff-articles input').value,'記事');assert.doesNotMatch(h.body(),/前回表示分/);
 articleVersion='手動確認後の記事';await h.click(articleButton('再読込'));await settle();assert.equal(h.calls.length,6);assert.match(h.body(),/手動確認後の記事/);
 articleVersion='明示更新後の記事';await h.render(h.Component,{revision:1});await settle();assert.equal(h.calls.length,9);assert.match(h.body(),/明示更新後の記事/);
});

test('記事の失敗は確認済み扱いにせず再展開時に再試行し成功後は保持する',async t=>{
 let articles=0;const h=await fixture(t,{saved:null,handler:async body=>body.action==='favorite_articles'&&++articles===1?Response.json({ok:false,error:'ARTICLE_TEMPORARILY_OFFLINE'},{status:500}):Response.json({ok:true,...(body.action==='favorites'?{rows:[creator('old','確認済み作者')]}:body.action==='list'?{definitions:[],assignments:[]}:{rows:[{key:'article',title:'再試行で確認した記事',url:'https://note.test/article'}]})})});
 const button=label=>[...h.w.document.querySelectorAll('button')].find(button=>button.textContent===label);
 await h.click(button('記事を見る'));assert.match(h.body(),/ARTICLE_TEMPORARILY_OFFLINE/);await h.click(button('記事を閉じる'));await h.click(button('記事を見る'));assert.equal(articles,2);assert.match(h.body(),/再試行で確認した記事/);
 await h.click(button('記事を閉じる'));await h.click(button('記事を見る'));assert.equal(articles,2);
});

test('一覧だけ成功しグループ未確認の画面はruntime確認済みとして再利用しない',async t=>{
 const groups=[];const h=await fixture(t,{saved:null,handler:async(body,init)=>body.action==='list'?new Promise(resolve=>groups.push({resolve,signal:init.signal})):Response.json({ok:true,rows:[creator('old','一覧だけ確認した作者')]})});
 assert.equal(h.calls.length,2);await h.render(()=>null);assert.equal(groups[0].signal.aborted,true);await h.render(h.Component,{});await settle();assert.equal(h.calls.length,4);
 await settle(()=>groups.forEach(item=>item.resolve(Response.json({ok:true,definitions:[],assignments:[]}))));
});

test('確認済みruntimeも認証拒否後に画面を作り直して復活させない',async t=>{
 let denied=false;const h=await fixture(t,{saved:null,handler:async body=>denied?Response.json({ok:false,error:'DENIED'},{status:403}):Response.json({ok:true,...(body.action==='favorites'?{rows:[creator('old','私的な確認済み作者')]}:{definitions:[],assignments:[]})})});
 assert.match(h.body(),/私的な確認済み作者/);denied=true;await h.click([...h.w.document.querySelectorAll('button')].find(button=>button.textContent==='再読込'));await settle();assert.doesNotMatch(h.body(),/私的な確認済み作者/);
 await h.render(()=>null);await h.render(h.Component,{});assert.doesNotMatch(h.body(),/私的な確認済み作者/);assert.equal(h.helper.readSavedInsightView('favorites-last',scope),null);
});


test('別画面のお気に入り変更は非表示中のruntimeも失効させる',async t=>{
 const h=await fixture(t,{saved:null,handler:async body=>Response.json({ok:true,...(body.action==='favorites'?{rows:[creator('old','確認済み作者')]}:{definitions:[],assignments:[]})})});
 await h.render(()=>null);await settle(()=>h.w.dispatchEvent(new h.w.Event('mumei-insight-favorites-changed')));await h.render(h.Component,{});await settle();assert.equal(h.calls.length,4);
});
