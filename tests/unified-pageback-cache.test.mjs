import test from 'node:test';
import assert from 'node:assert/strict';
import * as React from 'react';
import {sceneFixture,pause} from './react-scene-fixture.mjs';
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve}};
const settle=async fn=>React.act(async()=>{fn?.();for(let i=0;i<6;i++)await pause()});
const row=(page=1,account='tester')=>({article_key:'n'+page,liker_key:'person'+page,actor_key:'person'+page,actor_name:account+' page'+page,article_title:account+' page'+page,title:account+' article'+page,url:'https://note.com/'+account+'/n/n'+page,article_url:'https://note.com/'+account+'/n/n'+page,publish_at:'2026-10-20T00:00:00Z',like_count:1,initial_comment_count:1,article_count:1,confirmed:false});
async function fixture(t,{tab='likes',respond}={}){
 let now=Date.now(),h;class Clock extends Date{static now(){return now}}
 const calls=[],account=()=>h.w.localStorage.getItem('token')==='b'?'second':'tester';
 h=await sceneFixture(t,{globals:{Date:Clock,requestAnimationFrame:()=>{}},dependencies:{'./insight-account-store':{INSIGHT_TOKEN_KEY:'token',currentStoredInsightAccount:()=>({noteId:account(),memberToken:'fixture',status:'active'}),setAccessIntent:()=>{}},'./creator-avatar':{CreatorAvatar:()=>null,creatorImage:()=>null},'./member-insight-dm':{MemberInsightDm:()=>null},'./member-insight-magazines':{MemberInsightMagazines:()=>null}},fetch:async(url,init)=>{
  const c={url:String(url),...JSON.parse(init.body||'{}'),token:init.headers['X-Insight-Token'],signal:init.signal};calls.push(c);const custom=respond?.(c,calls);if(custom)return custom;
  if(c.url.includes('/rest/'))return Response.json({ok:false},{status:503});
  if(c.action==='summary')return Response.json({summaryMode:'navigation',member:{noteId:account(),displayName:account()},summary:{},analysis:{},counts:{},articles:[]});
  if(c.action==='analysis')return Response.json({latestDashboard:null,topArticles:[]});
  if(c.action==='resolve')return Response.json({rows:c.articles.map(a=>({key:a.key,thumbnail:null}))});
  if(['sync','favorite_toggle','like_completion'].includes(c.action))return Response.json({ok:true});
  if(['supporter_articles','commenter_comments'].includes(c.action))return Response.json({rows:[{article_key:'detail',article_title:'detail '+account(),root_key:'root',body:'reply'}]});
  return Response.json({rows:[row(c.page||1,account())],total:250});
 }});
 h.w.localStorage.setItem('token','a');h.w.history.replaceState({insightTab:tab},'',h.w.location.href);
 const C=h.load('src/member-insight-unified-v4.tsx').MemberInsightUnifiedV4,cache=h.load('src/insight-saved-view.ts');
 return{...h,calls,cache,show:props=>h.render(C,{active:true,revision:0,...props}),count:a=>calls.filter(c=>c.action===a).length,pages:a=>calls.filter(c=>c.action===a).map(c=>c.page),advance:v=>now+=v,panel:()=>h.w.document.querySelector('.miu-tab-stage > div:not([hidden]) .miu-panel'),go:next=>settle(()=>{h.w.history.replaceState({insightTab:next},'',h.w.location.href);h.w.dispatchEvent(new h.w.Event('mumei-insight-navigation'))})};
}
const actions=[['likes','likes'],['supporters','supporters'],['commentRanking','comment_ranking']];
const next=h=>h.panel().querySelector('.miu-pager button:last-child');
const back=h=>h.panel().querySelector('.miu-pager button:first-child');
const read=(h,action)=>h.cache.readSavedInsightView(action==='likes'?'likes-last':'ranking-'+action,{account:'tester',token:'a'});
const timeout=()=>Response.json({ok:false,error:{code:'57014',message:'statement timeout'}},{status:500});
for(const[tab,action]of actions){
 test(tab+' 1→2→3→2→1 restores known pages without HTTP even after61 seconds and preserves actual check stamps',async t=>{
  const h=await fixture(t,{tab});await h.show();const page1at=read(h,action).savedAt;h.advance(10);await h.click(next(h));const page2at=read(h,action).savedAt;h.advance(10);await h.click(next(h));h.advance(61001);
  await h.click(back(h));assert.match(h.panel().textContent,/tester page2/);assert.match(h.panel().querySelector('.miu-pager').textContent,/2 \/ 3/);assert.equal(h.panel().querySelector('.miu-load-scene'),null);assert.equal(read(h,action).savedAt,page2at);
  await h.click(back(h));assert.match(h.panel().textContent,/tester page1/);assert.equal(read(h,action).savedAt,page1at);assert.deepEqual(h.pages(action),[1,2,3]);assert.equal(h.count('summary'),1);assert.equal(h.count('analysis'),0);
  const before=h.calls.length;await h.show({active:false});await h.show();await h.show({key:'reopened'});assert.equal(h.calls.length,before);assert.match(h.panel().querySelector('.miu-pager').textContent,/1 \/ 3/);
 });
 test(tab+' revision checks exactly the selected page; cached target stays visible while its necessary update is pending',async t=>{
  let held=false;const pending=deferred(),h=await fixture(t,{tab,respond:c=>held&&c.action===action?pending.promise.then(response=>response.clone()):undefined});await h.show();await h.click(next(h));await h.click(next(h));held=true;
  await h.show({revision:1});assert.deepEqual(h.pages(action),[1,2,3,3]);assert.match(h.panel().textContent,/tester page3/);
  await h.click(back(h));assert.deepEqual(h.pages(action),[1,2,3,3,2]);assert.match(h.panel().textContent,/tester page2/);assert.equal(h.panel().querySelector('.miu-load-scene'),null);
  await settle(()=>pending.resolve(Response.json({rows:[row(2)],total:250})));assert.match(h.panel().querySelector('.miu-pager').textContent,/2 \/ 3/);
 });
 test(tab+' failed unknown page retains last successful rows/count/page and retries the failed target',async t=>{
  let fail=true;const h=await fixture(t,{tab,respond:c=>c.action===action&&c.page===2&&fail?timeout():undefined});await h.show();const stamp=read(h,action).savedAt;await h.click(next(h));
  assert.match(h.panel().textContent,/tester page1/);assert.match(h.panel().querySelector('.miu-pager').textContent,/1 \/ 3/);assert.equal(read(h,action).savedAt,stamp);assert.match(h.panel().textContent,/集計が時間切れ/);
  fail=false;await h.click(h.panel().querySelector('.miu-error button'));assert.deepEqual(h.pages(action),[1,2,2]);assert.match(h.panel().textContent,/tester page2/);assert.equal(read(h,action).value[action==='likes'?'selection':'page']?.page??read(h,action).value.page,2);
 });
 test(tab+' same-account new token and different account cannot reuse document verification',async t=>{
  const pending=deferred();let switched=false;const h=await fixture(t,{tab,respond:c=>switched&&c.action===action?pending.promise.then(response=>response.clone()):undefined});await h.show();await h.click(next(h));switched=true;h.w.localStorage.setItem('token','c');await h.show();assert.equal(h.count(action),3);assert.doesNotMatch(h.panel().textContent,/tester page2/);
  h.w.localStorage.setItem('token','b');await h.show();assert.equal(h.count(action),4);assert.doesNotMatch(h.panel().textContent,/tester page2/);await settle(()=>pending.resolve(Response.json({rows:[row(1,'second')],total:250})));assert.match(h.panel().textContent,/second page1/);
 });
 test(tab+' a denied current request clears all formerly verified pages for that session',async t=>{
  let deny=false;const h=await fixture(t,{tab,respond:c=>deny&&c.action===action?Response.json({error:'denied'},{status:403}):undefined});await h.show();await h.click(next(h));deny=true;await h.show({revision:1});assert.doesNotMatch(h.panel().textContent,/tester page/);assert.equal(read(h,action),null);
  await h.show({key:'reopened',revision:0});assert.equal(h.count(action),4,'old revision verification cannot restore denied rows');assert.doesNotMatch(h.panel().textContent,/tester page/);
 });
}
test('like filter changes reuse only the exact query/status/sort selection, and mutation invalidates verified pages',async t=>{
 const h=await fixture(t);await h.show();await h.click([...h.panel().querySelectorAll('.miu-tabs button')].find(b=>b.textContent==='未対応'));assert.equal(h.count('likes'),2);await h.click([...h.panel().querySelectorAll('.miu-tabs button')].find(b=>b.textContent==='すべて'));assert.equal(h.count('likes'),2);
 await h.click(h.panel().querySelector('.miu-handled'));assert.equal(h.count('like_completion'),1);await h.show({active:false});await h.show();assert.equal(h.count('likes'),3,'a saved status change invalidates the affected list verification');
});
for(const[tab,action]of [['supporters','supporter_articles'],['commentRanking','commenter_comments']])test(tab+' expanded details restore after61 seconds and scene remount without repeat reads',async t=>{
 const h=await fixture(t,{tab});await h.show();const toggle=()=>h.panel().querySelector(tab==='supporters'?'.miu-rank-row button:last-child':'.miu-rank-metrics button');await h.click(toggle());assert.equal(h.count(action),1);h.advance(61001);await h.click(toggle());await h.click(toggle());assert.equal(h.count(action),1);await h.show({key:'remount'});assert.equal(h.count(action),1);assert.match(h.panel().textContent,/detail tester/);
});
test('summary/articles/dashboard keep verified current-document data on return and remount; revision and explicit update still check',async t=>{
 const h=await fixture(t,{tab:'articles'});await h.show();const old=h.cache.readSavedInsightView('article-archive',{account:'tester',token:'a'}).savedAt;await h.go('likes');h.advance(61001);await h.go('articles');assert.equal(h.count('articles'),1);assert.equal(h.count('analysis'),1);assert.equal(h.count('summary'),1);
 const count=h.calls.length;await h.show({key:'remount'});assert.equal(h.calls.length,count);assert.equal(h.cache.readSavedInsightView('article-archive',{account:'tester',token:'a'}).savedAt,old);
 await h.show({key:'remount',revision:1});assert.equal(h.count('articles'),2);assert.equal(h.count('analysis'),2);assert.equal(h.count('summary'),2);
 await h.click(h.w.document.querySelector('.miu-topactions .sync'));assert.equal(h.count('sync'),1);assert.equal(h.count('articles'),3);assert.equal(h.count('analysis'),3);assert.equal(h.count('summary'),3);const afterUpdate=h.calls.length;await h.show({key:'after-update',revision:1});assert.equal(h.calls.length,afterUpdate,'a scene remount preserves the explicit-update generation');
});
test('a new document still displays saved rows and checks the current page instead of reusing verification metadata',async t=>{
 const h=await fixture(t);await h.show();const saved=read(h,'likes'),pending=deferred(),fresh=await fixture(t,{respond:c=>c.action==='likes'?pending.promise.then(response=>response.clone()):undefined});fresh.cache.writeSavedInsightView('likes-latest',{account:'tester',token:'a'},saved.value,saved.savedAt);await fresh.show();assert.equal(fresh.count('likes'),1);assert.match(fresh.panel().textContent,/tester page1/);assert.match(fresh.panel().textContent,/前回表示分/);await settle(()=>pending.resolve(Response.json({rows:[row()],total:250})));
});
for(const[tab,action]of actions){
 test(tab+' rapid identical next-page taps share one pending request, and failure still permits retry',async t=>{
  const pending=deferred();let hold=true;const h=await fixture(t,{tab,respond:c=>hold&&c.action===action&&c.page===2?pending.promise.then(response=>response.clone()):undefined});await h.show();
  await settle(()=>{const button=next(h);button.click();button.click();button.click()});assert.deepEqual(h.pages(action),[1,2]);const first=h.calls.filter(c=>c.action===action).at(-1);assert.equal(first.signal.aborted,false,'duplicate taps do not abort the shared target');
  await settle(()=>pending.resolve(timeout()));assert.match(h.panel().textContent,/集計が時間切れ/);hold=false;await h.click(h.panel().querySelector('.miu-error button'));assert.deepEqual(h.pages(action),[1,2,2]);assert.match(h.panel().textContent,/tester page2/);
 });
 test(tab+' a cached different target remains immediately usable while a new page is pending, and late response is rejected',async t=>{
  const pending=deferred();const h=await fixture(t,{tab,respond:c=>c.action===action&&c.page===3?pending.promise:undefined});await h.show();await h.click(next(h));await settle(()=>{const button=next(h);button.click();button.click()});assert.deepEqual(h.pages(action),[1,2,3]);const target=h.calls.filter(c=>c.action===action).at(-1);assert.equal(target.signal.aborted,false);
  await h.click(back(h));assert.equal(target.signal.aborted,true);assert.match(h.panel().textContent,/tester page1/);assert.deepEqual(h.pages(action),[1,2,3]);await settle(()=>pending.resolve(Response.json({rows:[row(3)],total:250})));assert.match(h.panel().textContent,/tester page1/);assert.doesNotMatch(h.panel().textContent,/tester page3/);
 });
}
for(const[tab,action]of [['supporters','supporter_articles'],['commentRanking','commenter_comments']])test(tab+' authentication denial clears retained detail verification as well as its rows',async t=>{
 let denied=false;const h=await fixture(t,{tab,respond:c=>c.action===action&&(c.likerKey||c.actorKey)==='person2'&&!denied?(denied=true,Response.json({error:'denied'},{status:403})):undefined});await h.show();const toggle=()=>h.panel().querySelector(tab==='supporters'?'.miu-rank-row button:last-child':'.miu-rank-metrics button');
 await h.click(toggle());assert.equal(h.count(action),1);await h.click(next(h));await h.click(toggle());assert.equal(h.count(action),2);assert.match(h.panel().textContent,/INSIGHT_SESSION_INVALID/);assert.equal(h.panel().querySelector('.miu-expand'),null);
 await h.click(h.panel().querySelector('.miu-error button'));await h.click(back(h));await h.click(toggle());assert.equal(h.count(action),3,'a cleared person detail cannot be skipped by stale local verification');assert.match(h.panel().textContent,/detail tester/);
});
test('favorite change signal is dispatched once only after the successful acknowledgement',async t=>{
 const pending=deferred();const h=await fixture(t,{respond:c=>c.action==='favorite_toggle'?pending.promise:undefined});let events=0;h.w.addEventListener('mumei-insight-favorites-changed',()=>events++);await h.show();await h.click(h.panel().querySelector('.miu-star'));assert.equal(h.count('favorite_toggle'),1);assert.equal(events,0);await settle(()=>pending.resolve(Response.json({ok:true})));assert.equal(events,1);
});
