import test from 'node:test';
import assert from 'node:assert/strict';
import * as React from 'react';
import {sceneFixture,pause} from './react-scene-fixture.mjs';
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve}};
const article=(account='tester',key='first')=>({article_key:key,title:account+' article '+key,url:'https://note.com/'+account+'/n/'+key,publish_at:'2026-10-20T00:00:00Z'});
async function settle(work=()=>{}){await React.act(async()=>{work();for(let i=0;i<8;i++)await pause()})}
async function fixture(t,{tab='likes',respond}={}){
 let h,now=Date.now();const calls=[];class Clock extends Date{static now(){return now}}
 const account=()=>h.w.localStorage.getItem('token')==='second-token'?'second':'tester';
 h=await sceneFixture(t,{globals:{Date:Clock,requestAnimationFrame:()=>{}},dependencies:{
  './insight-account-store':{INSIGHT_TOKEN_KEY:'token',currentStoredInsightAccount:()=>({noteId:account(),memberToken:'fixture',status:'active'}),setAccessIntent:()=>{}},
  './creator-avatar':{CreatorAvatar:()=>null,creatorImage:()=>null},'./member-insight-dm':{MemberInsightDm:()=>null},'./member-insight-magazines':{MemberInsightMagazines:()=>null},
 },fetch:async(url,init)=>{
  const call={url:String(url),...JSON.parse(init.body||'{}'),token:init.headers['X-Insight-Token'],signal:init.signal};calls.push(call);
  const custom=respond?.(call,calls,account());if(custom)return custom;
  if(call.url.includes('/rest/'))return Response.json({ok:false},{status:503});
  if(call.action==='summary')return Response.json({ok:true,summaryMode:'navigation',member:{noteId:account(),displayName:account()},summary:{articleCount:1,identifiedLikeCount:10,supporterCount:2},analysis:{uniqueSupporters:2},counts:{comments:3,followers:4,followings:5,notifications:6},articles:[]});
  if(call.action==='articles')return Response.json({ok:true,rows:[article(account())],total:1});
  if(call.action==='analysis')return Response.json({ok:true,latestDashboard:null,topArticles:[]});
  if(call.action==='resolve')return Response.json({ok:true,rows:call.articles.map(a=>({key:a.key,thumbnail:null}))});
  if(call.action==='sync')return Response.json({ok:true});
  return Response.json({ok:true,rows:[],total:0});
 }});
 h.w.localStorage.setItem('token','first-token');h.w.history.replaceState({insightTab:tab},'',h.w.location.href);
 const C=h.load('src/member-insight-unified-v4.tsx').MemberInsightUnifiedV4,cache=h.load('src/insight-saved-view.ts');
 return{...h,calls,cache,show:props=>h.render(C,{active:true,revision:0,...props}),count:a=>calls.filter(c=>c.action===a).length,text:()=>h.w.document.body.textContent,
  advance:ms=>{now+=ms},go:next=>settle(()=>{h.w.history.replaceState({insightTab:next},'',h.w.location.href);h.w.dispatchEvent(new h.w.Event('mumei-insight-navigation'))}),
  update:()=>h.click(h.w.document.querySelector('.miu-topactions .sync'))};
}
test('light summary requests only visible likes, then lazily loads articles once on opening',async t=>{
 const h=await fixture(t);await h.show();assert.deepEqual(h.calls.map(c=>c.action).sort(),['likes','summary']);assert.equal(h.calls.find(c=>c.action==='summary').view,'navigation');
 await h.go('articles');assert.equal(h.count('articles'),1);assert.equal(h.count('analysis'),1);assert.match(h.text(),/tester article first/);
 await h.go('likes');await h.go('articles');assert.equal(h.count('articles'),1);
 h.advance(60001);await h.go('likes');await h.go('articles');assert.equal(h.count('articles'),2);
});
test('initial article entry does not present an unverified empty archive as a successful zero',async t=>{
 const pending=deferred();const h=await fixture(t,{tab:'articles',respond:c=>c.action==='articles'?pending.promise:undefined});await h.show();assert.equal(h.count('articles'),1);assert.match(h.text(),/未確認/);assert.match(h.text(),/記事の最新データを確認中/);
 await settle(()=>pending.resolve(Response.json({ok:true,rows:[],total:0})));assert.doesNotMatch(h.text(),/未確認/);assert.match(h.w.document.querySelector('.miu-self-article-grid').parentElement.textContent,/0件/);
});
test('new saves and revisions refresh the visible archive but do not read it while hidden',async t=>{
 let fresh=false;const h=await fixture(t,{tab:'articles',respond:c=>fresh&&c.action==='articles'?Response.json({ok:true,rows:[article('tester','new')],total:1}):undefined});await h.show();assert.equal(h.count('articles'),1);
 await h.go('likes');fresh=true;await h.show({revision:1});assert.equal(h.count('articles'),1);await h.go('articles');assert.equal(h.count('articles'),2);assert.match(h.text(),/tester article new/);
 await h.update();assert.equal(h.count('articles'),3,'manual save refresh triggers exactly one archive recheck');
});
test('an account switch aborts and rejects the previous archive response and saved scope',async t=>{
 const pending=deferred();const h=await fixture(t,{tab:'articles',respond:c=>c.action==='articles'&&c.token==='first-token'?pending.promise:undefined});await h.show();const first=h.calls.find(c=>c.action==='articles');h.w.localStorage.setItem('token','second-token');await h.show();assert.equal(first.signal.aborted,true);assert.match(h.text(),/second article first/);
 await settle(()=>pending.resolve(Response.json({ok:true,rows:[article('tester','old')],total:1})));assert.doesNotMatch(h.text(),/tester article old/);
});
test('failed archive rechecks retain labelled saved rows and retry rather than mark a failed response fresh',async t=>{
 let broken=false;const h=await fixture(t,{tab:'articles',respond:c=>broken&&c.action==='articles'?Response.json({ok:false,error:'fixture failure'},{status:503}):undefined});await h.show();await h.go('likes');h.advance(60001);broken=true;await h.go('articles');assert.match(h.text(),/tester article first/);assert.match(h.text(),/前回保存分|前回表示分/);assert.equal(h.count('articles'),2);
 await h.go('likes');broken=false;await h.go('articles');assert.equal(h.count('articles'),3);
});
test('malformed or denied archive results cannot silently become a verified empty archive',async t=>{
 let mode='malformed';const h=await fixture(t,{tab:'articles',respond:c=>c.action==='articles'?mode==='malformed'?Response.json({ok:true,rows:[]}):Response.json({ok:false,error:'INSIGHT_SESSION_INVALID'},{status:401}):undefined});await h.show();assert.match(h.text(),/未確認/);assert.match(h.text(),/INSIGHT_INVALID_RESPONSE/);
 mode='denied';await h.go('likes');await h.go('articles');assert.match(h.text(),/INSIGHT_SESSION_INVALID/);assert.equal(h.cache.readSavedInsightView('article-archive',{account:'tester',token:'first-token'}),null);
});
test('cached article history is scoped to both account and token and does not suppress a fresh server check',async t=>{
 const pending=deferred();const h=await fixture(t,{tab:'articles',respond:c=>c.action==='articles'?pending.promise:undefined});h.cache.writeSavedInsightView('article-archive',{account:'tester',token:'first-token'},{rows:[article('tester','saved')],total:1},Date.now()-86400000);await h.show();assert.match(h.text(),/tester article saved/);assert.match(h.text(),/前回表示分/);assert.equal(h.count('articles'),1);
 await settle(()=>pending.resolve(Response.json({ok:true,rows:[article('tester','latest')],total:1})));assert.match(h.text(),/tester article latest/);
});
test('legacy full summaries keep their archive without a second articles request',async t=>{
 const h=await fixture(t,{tab:'articles',respond:c=>c.action==='summary'?Response.json({ok:true,member:{noteId:'tester',displayName:'tester'},summary:{articleCount:1},analysis:{},counts:{},articles:[article('tester','legacy')]}):undefined});await h.show();assert.match(h.text(),/tester article legacy/);assert.equal(h.count('articles'),0);assert.equal(h.count('summary'),1);
});
const notice=(target_title=null)=>({id:'notice',member_id:'member',notification_type:'like',actor_name:'reader',target_url:article().url,target_title,occurred_at:'2026-10-20T00:00:00Z'});
test('legacy notification cards lazily preserve the stored article-title fallback',async t=>{
 const h=await fixture(t,{respond:c=>c.action==='list'?Response.json({ok:true,rows:[notice()],total:1}):undefined});await h.show();assert.equal(h.count('articles'),0);await h.go('notifications');assert.match(h.text(),/tester article first/);assert.equal(h.count('articles'),1);await h.go('likes');await h.go('notifications');assert.equal(h.count('articles'),1,'fresh scoped archive supplies the title without another read');
});
test('notification cards with explicit titles do not fetch the article archive',async t=>{
 const h=await fixture(t,{tab:'notifications',respond:c=>c.action==='list'?Response.json({ok:true,rows:[notice('notice title')],total:1}):undefined});await h.show();assert.match(h.text(),/notice title/);assert.equal(h.count('articles'),0);
});
test('manual update refreshes missing notification titles once after reloading visible rows',async t=>{
 let renamed=false;const h=await fixture(t,{tab:'notifications',respond:c=>c.action==='list'?Response.json({ok:true,rows:[notice()],total:1}):renamed&&c.action==='articles'?Response.json({ok:true,rows:[{...article(),title:'renamed saved article'}],total:1}):undefined});await h.show();assert.match(h.text(),/tester article first/);assert.equal(h.count('articles'),1);renamed=true;await h.update();assert.match(h.text(),/renamed saved article/);assert.equal(h.count('articles'),2,'manual refresh must not query titles both before and after rows reload');
});

test('late archive hydration shows matching account copy without restarting archive read; live empty wins',async t=>{
 const pending=deferred(),h=await fixture(t,{tab:'articles',respond:c=>c.action==='articles'?pending.promise:undefined});await h.show();const scope={account:'tester',token:'first-token'};
 await settle(()=>{h.cache.writeSavedInsightView('article-archive',scope,{rows:[article('tester','cached')],total:1},1);h.w.dispatchEvent(new h.w.Event('mumei-insight-storage-hydrated'))});
 assert.match(h.text(),/tester article cached/);assert.match(h.text(),/前回表示分/);assert.equal(h.count('articles'),1);
 await settle(()=>pending.resolve(Response.json({ok:true,rows:[],total:0})));
 await settle(()=>{h.cache.writeSavedInsightView('article-archive',scope,{rows:[article('tester','old')],total:1},1);h.w.dispatchEvent(new h.w.Event('mumei-insight-storage-hydrated'))});assert.doesNotMatch(h.text(),/tester article old/);
});

test('article official dashboard explicit denial clears previously displayed values and its scoped cache',async t=>{
 let denied=false;const h=await fixture(t,{tab:'articles',respond:c=>c.action==='analysis'?(denied?Response.json({ok:false,error:'INSIGHT_SESSION_INVALID'},{status:401}):Response.json({ok:true,latestDashboard:null,topArticles:[{url:article().url,likes:999,comments:42}]})):undefined});await h.show();assert.match(h.text(),/公式 ♡ 999/);
 denied=true;h.advance(60001);await h.go('likes');await h.go('articles');assert.doesNotMatch(h.text(),/公式 ♡ 999/);assert.equal(h.cache.readSavedInsightView('article-dashboard',{account:'tester',token:'first-token'}),null);
});

for(const late of [false,true])test(`article official values restore before network with original saved stamp (late=${late})`,async t=>{
 const pending=deferred(),h=await fixture(t,{tab:'articles',respond:c=>c.action==='analysis'?pending.promise:undefined});const scope={account:'tester',token:'first-token'},seed=()=>h.cache.writeSavedInsightView('article-dashboard',scope,{latestDashboard:null,topArticles:[{url:article().url,likes:777,comments:9}]},1);
 if(!late)seed();await h.show();if(late)await settle(()=>{seed();h.w.dispatchEvent(new h.w.Event('mumei-insight-storage-hydrated'))});
 assert.match(h.text(),/公式 ♡ 777/);assert.match(h.text(),/公式値は前回表示分/);assert.equal(h.count('analysis'),1);assert.equal(h.cache.readSavedInsightView('article-dashboard',scope).savedAt,1);
 await settle(()=>pending.resolve(Response.json({ok:true,latestDashboard:null,topArticles:[]})));await settle(()=>{seed();h.w.dispatchEvent(new h.w.Event('mumei-insight-storage-hydrated'))});assert.doesNotMatch(h.text(),/公式 ♡ 777|公式値は前回表示分/);
});
