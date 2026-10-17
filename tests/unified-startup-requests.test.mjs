import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as React from 'react';
import {flushSync} from 'react-dom';
import * as jsx from 'react/jsx-runtime';
import {sceneFixture,pause} from './react-scene-fixture.mjs';

const source=readFileSync(process.env.INSIGHT_UNIFIED_AUDIT_SOURCE||'src/member-insight-unified-v4.tsx','utf8');
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve}};
const articleUrl='https://note.com/tester/n/narticle';
const snapshot=(likes=901)=>({ok:true,latestDashboard:{likes,comments:12,summary:{articles:1}},topArticles:[{url:articleUrl,likes,comments:12}]});
async function settle(fn=()=>{}){await React.act(async()=>{fn();for(let i=0;i<4;i++)await pause()})}

async function fixture(t,{tab='likes',respond}={}){
  let now=Date.now(),h;const calls=[];
  class Clock extends Date{static now(){return now}}
  const account=()=>h.w.localStorage.getItem('token')==='b'?'second':'tester';
  const dependencies={
    './insight-account-store':{INSIGHT_TOKEN_KEY:'token',currentStoredInsightAccount:()=>({noteId:account(),memberToken:'fixture',status:'active'}),setAccessIntent:()=>{}},
    './creator-avatar':{CreatorAvatar:()=>null,creatorImage:()=>null},
    './member-insight-dm':{MemberInsightDm:()=>null},
    './member-insight-magazines':{MemberInsightMagazines:()=>null},
  };
  h=await sceneFixture(t,{globals:{Date:Clock,requestAnimationFrame:()=>{}},dependencies,fetch:async(url,init)=>{
    const body=JSON.parse(init.body||'{}'),call={url:String(url),...body,token:init.headers['X-Insight-Token'],signal:init.signal};calls.push(call);
    const custom=respond?.(call,calls);if(custom)return custom;
    if(String(url).includes('/rest/'))return Response.json({ok:false},{status:503});
    if(body.action==='summary')return Response.json({ok:true,member:{noteId:account(),displayName:account(),imageUrl:null},summary:{articleCount:1,identifiedLikeCount:25},analysis:{},counts:{comments:2,followers:3,followings:4,notifications:5},articles:[{article_key:'narticle',title:account()+'の記事',url:articleUrl,publish_at:'2026-10-17T00:00:00Z'}]});
    if(body.action==='analysis')return Response.json(snapshot());
    if(body.action==='sync')return Response.json({ok:true});
    if(body.action==='resolve')return Response.json({ok:true,rows:[{key:'narticle',thumbnail:null}]});
    return Response.json({ok:true,rows:[{article_key:'narticle',liker_key:'person',actor_name:account()+'のスキ',article_title:'保存記事',confirmed:false}],total:1});
  }});
  h.w.localStorage.setItem('token','a');h.w.history.replaceState({insightTab:tab},'',h.w.location.href);
  const exports={};vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{
    exports,require:name=>name==='react'?React:name==='react-dom'?{flushSync}:name==='react/jsx-runtime'?jsx:name.endsWith('.css')?{}:dependencies[name]||h.load('src/'+name.replace(/^\.\//,'')+'.ts'),
    window:h.w,document:h.w.document,localStorage:h.w.localStorage,location:h.w.location,fetch:()=>{throw new Error('Use the bounded request helper')},AbortController,URL,URLSearchParams,Date:Clock,setTimeout,clearTimeout,requestAnimationFrame:()=>{},console,
  });
  const C=exports.MemberInsightUnifiedV4;
  return{...h,calls,show:props=>h.render(C,{active:true,revision:0,...props}),count:action=>calls.filter(c=>c.action===action).length,
    go:tab=>settle(()=>{h.w.history.replaceState({...h.w.history.state,insightTab:tab},'',h.w.location.href);h.w.dispatchEvent(new h.w.Event('mumei-insight-navigation'))}),
    advance:ms=>{now+=ms},text:()=>h.w.document.body.textContent,
    update:()=>h.click(h.w.document.querySelector('.miu-topactions .sync')),
  };
}

test('スキ初回表示はsummaryと現在100件ページだけ取得し、未表示の全分析を実行しない',async t=>{
  const h=await fixture(t);await h.show();assert.deepEqual(h.calls.map(c=>c.action).sort(),['likes','summary']);
  assert.equal(h.calls.find(c=>c.action==='likes').page,1);assert.equal(h.calls.find(c=>c.action==='likes').pageSize,100);
  assert.match(h.text(),/testerのスキ/);assert.equal(h.count('analysis'),0);assert.match(h.w.document.querySelector('.miu-stats').textContent,/保存スキ25/);
});

test('非表示shellは取得せず、表示後も現在ページ以外の分析を起動しない',async t=>{
  const h=await fixture(t);await h.show({active:false});assert.equal(h.calls.length,0);await h.show();assert.equal(h.count('summary'),1);assert.equal(h.count('likes'),1);assert.equal(h.count('analysis'),0);
});

for(const tab of ['comments','favorites','social','notifications','articles'])test(`非表示の旧${tab}タブは全履歴・人物・サムネイル通信を起動しない`,async t=>{
  const h=await fixture(t,{tab});await h.show({active:false});assert.deepEqual(h.calls,[]);
});

test('記事画面で初めて公式値を取得し、public全履歴scanを除くdashboardOnlyを指定する',async t=>{
  const h=await fixture(t);await h.show();await h.go('articles');const calls=h.calls.filter(c=>c.action==='analysis');assert.equal(calls.length,1);assert.equal(calls[0].dashboardOnly,true);
  assert.match(h.w.document.querySelector('.miu-self-article-grid').textContent,/公式 ♡ 901/);await h.go('likes');await h.go('articles');assert.equal(h.count('analysis'),1);
});

test('記事を一度開いた後も非表示中のcatalog更新でサムネイル取得を始めない',async t=>{
  let changed=false;const h=await fixture(t,{tab:'articles',respond:c=>changed&&c.action==='summary'?Response.json({ok:true,member:{noteId:'tester',displayName:'tester'},summary:{},analysis:{},counts:{comments:0,followers:0,followings:0,notifications:0},articles:[{article_key:'nnew',title:'新しく保存された記事',url:'https://note.com/tester/n/nnew'}]}):undefined});
  await h.show();assert.equal(h.count('resolve'),1);await h.go('likes');changed=true;await h.show({revision:1});assert.equal(h.count('resolve'),1);
  await h.go('articles');assert.equal(h.count('resolve'),2);assert.match(h.w.document.querySelector('.miu-self-article-grid').textContent,/新しく保存された記事/);
});

test('記事の期限超確認中も同sessionの公式値を保持し、最新応答で更新する',async t=>{
  const next=deferred();let wait=false;const h=await fixture(t,{tab:'articles',respond:c=>wait&&c.action==='analysis'?next.promise:undefined});await h.show();await h.go('likes');h.advance(60001);wait=true;await h.go('articles');
  assert.equal(h.count('analysis'),2);assert.match(h.w.document.querySelector('.miu-self-article-grid').textContent,/公式 ♡ 901/);
  await settle(()=>next.resolve(Response.json(snapshot(902))));assert.match(h.w.document.querySelector('.miu-self-article-grid').textContent,/公式 ♡ 902/);
});

test('スキでの明示更新は現在ページを再確認し、公式データは次に記事を開く時に更新する',async t=>{
  const h=await fixture(t);await h.show();await h.go('articles');await h.go('likes');await h.update();assert.equal(h.count('sync'),1);assert.equal(h.count('summary'),2);assert.equal(h.count('likes'),2);assert.equal(h.count('analysis'),1);
  await h.go('articles');assert.equal(h.count('analysis'),2);await h.update();assert.equal(h.count('analysis'),3);assert.ok(h.calls.filter(c=>c.action==='analysis').every(c=>c.dashboardOnly===true));
});

test('記事確認はrevision更新を反映し、本人切替後に前の遅延応答を採用しない',async t=>{
  const old=deferred();const h=await fixture(t,{tab:'articles',respond:(c,calls)=>c.action==='analysis'?(calls.filter(c=>c.action==='analysis').length===1?old.promise:Response.json(snapshot(c.token==='b'?222:111))):undefined});await h.show();
  const first=h.calls.find(c=>c.action==='analysis');h.w.localStorage.setItem('token','b');await h.show();assert.equal(first.signal.aborted,true);assert.equal(h.count('analysis'),2);assert.match(h.w.document.querySelector('.miu-top').textContent,/second/);
  await settle(()=>old.resolve(Response.json(snapshot(999))));assert.doesNotMatch(h.text(),/999/);assert.match(h.text(),/222/);await h.show({revision:1});assert.equal(h.count('analysis'),3);
});

test('不正な公式応答を確認済みにせず保持値のまま次の訪問で再試行する',async t=>{
  let malformed=false;const h=await fixture(t,{tab:'articles',respond:c=>malformed&&c.action==='analysis'?Response.json({}):undefined});await h.show();malformed=true;await h.update();assert.equal(h.count('analysis'),2);assert.match(h.w.document.querySelector('.miu-self-article-grid').textContent,/公式 ♡ 901/);
  await h.go('likes');malformed=false;await h.go('articles');assert.equal(h.count('analysis'),3);
});
