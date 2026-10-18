import test from 'node:test';
import assert from 'node:assert/strict';
import * as React from 'react';
import {sceneFixture,pause} from './react-scene-fixture.mjs';
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve}};
const summary=likes=>({member:{noteId:'tester',displayName:'本人',imageUrl:null},summary:{identifiedLikeCount:likes},analysis:{},counts:{comments:0,followers:0,followings:0,notifications:0},articles:[]});
const row=()=>({article_key:'n1',liker_key:'person',actor_key:'person',actor_name:'遅れて復元する履歴',article_title:'遅れて復元する履歴',confirmed:false,like_count:10,initial_comment_count:2,article_count:1});
const selection=()=>({status:'all',scope:'all',day:'',month:'',year:String(new Date().getFullYear()),sort:'newest',query:'',page:1});
async function settle(fn){await React.act(async()=>{fn();for(let i=0;i<4;i++)await pause()})}
async function fixture(t,{kind='likes',respond}={}){
 let h;const calls=[];
 h=await sceneFixture(t,{globals:{requestAnimationFrame:()=>{}},dependencies:{'./insight-account-store':{INSIGHT_TOKEN_KEY:'token',currentStoredInsightAccount:()=>({noteId:'tester',memberToken:'a',status:'active'}),setAccessIntent:()=>{}},'./creator-avatar':{CreatorAvatar:()=>null,creatorImage:()=>null},'./member-insight-dm':{MemberInsightDm:()=>null},'./member-insight-magazines':{MemberInsightMagazines:()=>null}},fetch:async(url,init)=>{const call={url:String(url),...JSON.parse(init.body||'{}')};calls.push(call);const custom=respond?.(call);if(custom)return custom;if(call.url.includes('/rest/'))return Response.json({ok:false},{status:503});if(call.action==='summary')return Response.json(summary(0));return Response.json({rows:[],total:0})}});
 h.w.localStorage.setItem('token','a');h.w.history.replaceState({insightTab:kind==='comment_ranking'?'commentRanking':kind},'',h.w.location.href);
 const cache=h.load('src/insight-saved-view.ts'),C=h.load('src/member-insight-unified-v4.tsx').MemberInsightUnifiedV4,scope={account:'tester',token:'a'};
 return{...h,calls,show:props=>h.render(C,{revision:0,active:true,...props}),text:()=>h.w.document.body.textContent,
 inject:()=>{cache.writeSavedInsightView('unified-summary',scope,summary(999),Date.now()-86400000);cache.writeSavedInsightView(kind==='likes'?'likes-last':'ranking-'+kind,scope,kind==='likes'?{selection:selection(),rows:[row()],total:1}:{page:1,rows:[row()],total:1,open:null,detailRows:[],detailAt:0},Date.now()-86400000)},
 emit:()=>settle(()=>h.w.dispatchEvent(new h.w.Event('mumei-insight-storage-hydrated')))};
}

for(const kind of ['likes','supporters','comment_ranking'])test(kind+' は確認済み0件と新しいsummaryを遅い保存コピーで上書きしない',async t=>{
 const h=await fixture(t,{kind});await h.show();const calls=h.calls.length;h.inject();await h.emit();assert.doesNotMatch(h.text(),/遅れて復元する履歴/);assert.match(h.w.document.querySelector('.miu-stats').textContent,/保存スキ0/);assert.equal(h.w.document.querySelector('[data-insight-saved-view]'),null);assert.equal(h.calls.length,calls);
});

for(const kind of ['likes','supporters'])test(kind+' は認証拒否後の遅い保存コピーを復活させない',async t=>{
 const h=await fixture(t,{kind,respond:c=>c.action===kind?Response.json({ok:false,error:{message:'denied'}},{status:403}):undefined});await h.show();const calls=h.calls.length;h.inject();await h.emit();assert.doesNotMatch(h.text(),/遅れて復元する履歴/);assert.equal(h.w.document.querySelector('[data-insight-saved-view]'),null);assert.equal(h.calls.length,calls);
});

test('入力・条件変更後の遅い保存表示は現在の条件を戻さず、新しいAPI取得を追加しない',async t=>{
 const next=deferred();const h=await fixture(t,{respond:c=>c.action==='likes'?next.promise:undefined});await h.show();await h.click([...h.w.document.querySelectorAll('.miu-tabs button')].find(el=>el.textContent==='未対応'));const calls=h.calls.length;h.inject();await h.emit();assert.equal(h.calls.length,calls);assert.equal(h.w.document.querySelector('.miu-tabs button.active').textContent,'未対応');assert.doesNotMatch(h.text(),/遅れて復元する履歴/);
 await settle(()=>next.resolve(Response.json({rows:[],total:0})));
});
