import test from 'node:test';
import assert from 'node:assert/strict';
import * as React from 'react';
import {sceneFixture,pause} from './react-scene-fixture.mjs';
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve}};
const row=(name='保存済み順位',id='person')=>({liker_key:id,actor_key:id,actor_name:name,like_count:50,initial_comment_count:6,article_count:4,last_comment_at:'2026-10-18T11:55:00Z'});
const summary=id=>({member:{noteId:id,displayName:id,imageUrl:null},summary:{},analysis:{},counts:{comments:0,followers:0,followings:0,notifications:0},articles:[]});
async function settle(fn){await React.act(async()=>{fn?.();for(let i=0;i<4;i++)await pause()})}
async function fixture(t,{kind='supporters',respond}={}){
 let h;const calls=[],account=()=>h.w.localStorage.getItem('token')==='b'?'second':'tester';
 h=await sceneFixture(t,{globals:{requestAnimationFrame:()=>{}},dependencies:{'./insight-account-store':{INSIGHT_TOKEN_KEY:'token',currentStoredInsightAccount:()=>({noteId:account(),displayName:account(),memberToken:h.w.localStorage.getItem('token'),status:'active'}),setAccessIntent:()=>{}},'./creator-avatar':{CreatorAvatar:()=>null,creatorImage:()=>null},'./member-insight-dm':{MemberInsightDm:()=>null},'./member-insight-magazines':{MemberInsightMagazines:()=>null}},fetch:async(url,init)=>{
 const body=JSON.parse(init.body||'{}'),call={url:String(url),...body,token:init.headers['X-Insight-Token'],signal:init.signal};calls.push(call);const custom=respond?.(call,calls);if(custom)return custom;
 if(String(url).includes('/rest/'))return Response.json({ok:false},{status:503});if(body.action==='summary')return Response.json(summary(account()));if(body.action==='favorite_toggle')return Response.json({ok:true});if(body.action==='supporter_articles'||body.action==='commenter_comments')return Response.json({rows:[{article_key:'n1',root_key:'c1',article_title:account()+'詳細',article_url:'https://note.com/tester/n/n1',body:'本文'}]});return Response.json({rows:[row(account()+'最新順位')],total:250});
 }});h.w.localStorage.setItem('token','a');h.w.history.replaceState({insightTab:kind==='supporters'?'supporters':'commentRanking'},'',h.w.location.href);
 const cache=h.load('src/insight-saved-view.ts'),C=h.load('src/member-insight-unified-v4.tsx').MemberInsightUnifiedV4;
 return{...h,calls,cache,show:props=>h.render(C,{revision:0,active:true,...props}),text:()=>h.w.document.body.textContent,count:action=>calls.filter(c=>c.action===action).length,
 seed:(overrides={},scope={account:'tester',token:'a'})=>cache.writeSavedInsightView('ranking-'+kind,scope,{rows:[row()],total:250,page:2,open:null,detailRows:[],detailAt:0,...overrides},Date.now()-86400000),
 read:()=>cache.readSavedInsightView('ranking-'+kind,{account:account(),token:h.w.localStorage.getItem('token')})};
}

for(const kind of ['supporters','comment_ranking'])test(kind+' は保存ページを先に表示し、100人の同じページだけ最新確認する',async t=>{
 const next=deferred();const h=await fixture(t,{kind,respond:c=>c.action===kind?next.promise:undefined});h.seed();await h.show();assert.match(h.text(),/保存済み順位/);assert.match(h.w.document.querySelector('.miu-pager').textContent,/2 \/ 3/);assert.match(h.w.document.querySelector('[data-insight-saved-view]').textContent,/前回表示分.*最新を確認中/);
 assert.equal(h.count(kind),1);const call=h.calls.find(c=>c.action===kind);assert.equal(call.page,2);assert.equal(call.pageSize,100);assert.equal(h.calls.filter(c=>c.action==='likes'||c.action==='analysis').length,0);
 await settle(()=>next.resolve(Response.json({rows:[row('同件数でも更新された順位')],total:250})));assert.match(h.text(),/同件数でも更新された順位/);assert.doesNotMatch(h.text(),/保存済み順位/);assert.equal(h.w.document.querySelector('[data-insight-saved-view]'),null);assert.equal(h.read().value.page,2);
});

test('初手コメ275位は3ページ目の75人目として表示し、親コメント・記事数と詳細APIを使う',async t=>{
 const rows=Array.from({length:100},(_,i)=>row(i===74?'最新親コメントの人物':`人物${201+i}`,`actor${201+i}`));const h=await fixture(t,{kind:'comment_ranking',respond:c=>c.action==='comment_ranking'?Response.json({rows,total:742}):undefined});h.seed({page:3,total:742});await h.show();
 const target=[...h.w.document.querySelectorAll('.miu-comment-rank-row')].find(el=>el.textContent.includes('最新親コメントの人物'));assert.equal(target.querySelector('em').textContent,'275');assert.match(target.textContent,/6初手コメ4対象記事\+2重複初手/);assert.match(h.w.document.querySelector('.miu-pager').textContent,/3 \/ 8/);
 await h.click(target.querySelector('button'));const detail=h.calls.find(c=>c.action==='commenter_comments');assert.equal(detail.actorKey,'actor275');assert.equal(detail.page,1);assert.equal(detail.pageSize,100);assert.match(h.text(),/tester詳細/);assert.equal(h.count('supporters'),0);
});

test('保存した開いた詳細を先表示し、現在人物の100件だけ裏で再確認する',async t=>{
 const next=deferred();const h=await fixture(t,{respond:c=>c.action==='supporter_articles'?next.promise:undefined});h.seed({open:'person',detailRows:[{article_key:'old',article_title:'前回開いた詳細'}],detailAt:Date.now()-86400000});await h.show();assert.match(h.text(),/前回開いた詳細/);assert.equal(h.count('supporter_articles'),1);assert.equal(h.calls.find(c=>c.action==='supporter_articles').pageSize,100);
 await settle(()=>next.resolve(Response.json({rows:[{article_key:'new',article_title:'最新の詳細'}]})));assert.match(h.text(),/最新の詳細/);assert.doesNotMatch(h.text(),/前回開いた詳細/);
});

for(const body of [{error:{message:'保存先の応答エラー',code:'DB_ERROR'}},{error:{error:{message:'nested error'}}},{error:'[object Object]'}])test('summary の構造化エラーをObject文字列で表示しない '+JSON.stringify(body),async t=>{
 const h=await fixture(t,{respond:c=>c.action==='summary'?Response.json({ok:false,...body},{status:500}):undefined});await h.show();assert.doesNotMatch(h.text(),/\[object Object\]/);assert.match(h.text(),/最新確認に失敗/);if(typeof body.error==='object')assert.match(h.text(),new RegExp(body.error.message||'nested error'));else assert.match(h.text(),/HTTP 500/);
});

test('DB集計タイムアウトは具体的な失敗を日本語で示し、保存済み順位を保持する',async t=>{
 const h=await fixture(t,{respond:c=>c.action==='summary'?Response.json({ok:false,error:{code:'57014',message:'canceling statement due to statement timeout'}},{status:500}):undefined});h.seed();await h.show();assert.match(h.text(),/保存先の集計が時間切れ/);assert.doesNotMatch(h.text(),/\[object Object\]|canceling statement/);assert.match(h.text(),/tester最新順位/);
});

for(const denied of ['primary','fallback'])test(denied+' の認証拒否は本文形式に依存せず保存順位を破棄する',async t=>{
 const h=await fixture(t,{respond:c=>c.action==='supporters'?Response.json({ok:false,error:{message:'custom denial'}},{status:denied==='primary'?403:503}):c.url.includes('/rest/')?Response.json({error:{message:'custom denial'}},{status:401}):undefined});h.seed();await h.show();assert.doesNotMatch(h.text(),/保存済み順位/);assert.equal(h.read(),null);assert.equal(h.w.document.querySelector('[data-insight-saved-view]'),null);assert.match(h.text(),/INSIGHT_SESSION_INVALID/);
});

for(const invalid of [{rows:[null],total:1},{rows:Array(101).fill(row()),total:200},{rows:[],total:1.5}])test('不正な順位応答を確認済みにせず保存結果に戻す '+invalid.total,async t=>{
 const h=await fixture(t,{respond:c=>c.action==='comment_ranking'?Response.json(invalid):undefined,kind:'comment_ranking'});h.seed();const before=h.read().savedAt;await h.show();assert.match(h.text(),/保存済み順位/);assert.match(h.text(),/最新確認に失敗/);assert.equal(h.read().savedAt,before);assert.ok(h.w.document.querySelector('[data-insight-saved-view]'));
});

test('同本人のtoken変更時に旧順位・詳細・遅延応答を混ぜない',async t=>{
 const old=deferred();const h=await fixture(t,{respond:c=>c.action==='supporters'&&c.token==='a'?old.promise:undefined});h.seed();await h.show();h.w.localStorage.setItem('token','c');await h.show();assert.match(h.text(),/tester最新順位/);assert.doesNotMatch(h.text(),/保存済み順位/);await settle(()=>old.resolve(Response.json({rows:[row('旧token遅延順位')],total:1})));assert.doesNotMatch(h.text(),/旧token遅延順位/);
});

test('保存済み0人も読み込みへ戻さず、確認完了まで前回表示として扱う',async t=>{
 const next=deferred();const h=await fixture(t,{respond:c=>c.action==='supporters'?next.promise:undefined});h.seed({page:1,total:0,rows:[]});await h.show();const section=[...h.w.document.querySelectorAll('.miu-panel')].find(el=>el.textContent.includes('SUPPORTER RANKING'));assert.match(section.querySelector('.miu-section-head').textContent,/0人/);assert.equal(section.querySelector('.miu-load-scene'),null);assert.match(h.text(),/前回表示分/);await settle(()=>next.resolve(Response.json({rows:[],total:0})));assert.equal(h.w.document.querySelector('[data-insight-saved-view]'),null);
});

test('順位確認中の★保存成功を遅い旧応答で戻さず、保存コピーへ反映する',async t=>{
 let hold=false;const next=deferred();const h=await fixture(t,{respond:c=>hold&&c.action==='supporters'?next.promise:undefined});await h.show();hold=true;await h.show({revision:1});
 const star=[...h.w.document.querySelectorAll('.miu-rank-list button')].find(el=>el.getAttribute('aria-label')==='お気に入り登録');await h.click(star);assert.equal(h.read().value.rows[0].favorite,true);
 await settle(()=>next.resolve(Response.json({rows:[{...row('遅い同人物の応答'),favorite:false}],total:250})));assert.equal(h.read().value.rows[0].favorite,true);assert.ok([...h.w.document.querySelectorAll('.miu-rank-list button')].find(el=>el.getAttribute('aria-label')==='お気に入り解除'));
});

test('既知57014は同じDB処理へ直ちに再送せず、保存順位を保持して手動の再確認だけ受け付ける',async t=>{
 let fail=true;const h=await fixture(t,{respond:c=>c.action==='supporters'&&fail?Response.json({ok:false,error:{message:'statement timeout',code:'57014'}},{status:500}):undefined});h.seed();const before=h.read().savedAt;await h.show();
 assert.match(h.text(),/保存済み順位/);assert.match(h.text(),/集計が時間切れ/);assert.equal(h.calls.filter(c=>c.url.includes('/rest/')).length,0);assert.equal(h.read().savedAt,before);assert.equal(h.count('supporters'),1);
 fail=false;await h.click([...h.w.document.querySelectorAll('.miu-rank-list')][0].parentElement.querySelector('.miu-error button'));assert.equal(h.count('supporters'),2);assert.match(h.text(),/tester最新順位/);assert.equal(h.count('sync'),0);
});

test('summaryの既知57014もDBへ重複再送せず、前回summaryと確認日時を保持する',async t=>{
 const h=await fixture(t,{respond:c=>c.action==='summary'?Response.json({ok:false,code:'57014',error:'保存先の集計が時間切れです'},{status:500}):undefined});h.cache.writeSavedInsightView('unified-summary',{account:'tester',token:'a'},{...summary('tester'),summary:{identifiedLikeCount:7122}},Date.now()-86400000);await h.show();assert.equal(h.calls.filter(c=>c.url.includes('/rest/')).length,0);assert.match(h.w.document.querySelector('.miu-stats').textContent,/保存スキ7,122/);assert.match(h.text(),/集計が時間切れ/);assert.ok(h.w.document.querySelector('[data-insight-saved-view="summary"]'));
});

const rankingTimeout=()=>Response.json({ok:false,error:{code:'57014',message:'statement timeout'}},{status:500});
const rankingPanel=h=>h.w.document.querySelector('.miu-tab-stage > div:not([hidden]) .miu-panel');
const rankingCount=h=>rankingPanel(h).querySelector('.miu-section-head').textContent;
for(const kind of ['supporters','comment_ranking']){
 test(kind+': never verified is unknown during loading and timeout, but a successful empty retry is zero',async t=>{
  const pending=deferred();let fail=true;
  const h=await fixture(t,{kind,respond:c=>c.action===kind?(fail?pending.promise:Response.json({rows:[],total:0})):undefined});
  await h.show();assert.match(rankingCount(h),/—人/);assert.doesNotMatch(rankingCount(h),/0人/);
  await settle(()=>pending.resolve(rankingTimeout()));
  assert.match(rankingCount(h),/—人/);assert.match(rankingPanel(h).textContent,/集計が時間切れ/);assert.equal(h.read(),null);
  assert.equal(rankingPanel(h).querySelector('.miu-pager'),null);assert.equal(rankingPanel(h).querySelector('[data-insight-saved-view]'),null);
  fail=false;await h.click(rankingPanel(h).querySelector('.miu-error button'));
  assert.match(rankingCount(h),/0人/);assert.equal(h.read().value.total,0);assert.equal(rankingPanel(h).querySelector('.miu-error'),null);
 });
 test(kind+': a failed refresh preserves verified zero and does not manufacture an unknown count',async t=>{
  let fail=false;const h=await fixture(t,{kind,respond:c=>c.action===kind?(fail?rankingTimeout():Response.json({rows:[],total:0})):undefined});
  await h.show();const before=h.read().savedAt;fail=true;await h.show({revision:1});
  assert.match(rankingCount(h),/0人/);assert.match(rankingPanel(h).textContent,/前回表示分/);assert.equal(h.read().savedAt,before);
 });
 test(kind+': failed pagination retains the last successful page, count and rank numbers, and retry targets the failed page',async t=>{
  const pending=deferred();let fail=true;
  const h=await fixture(t,{kind,respond:c=>c.action===kind&&c.page===2?(fail?pending.promise:Response.json({rows:[row('次ページ確認済み')],total:250})):undefined});
  await h.show();const before=h.read().savedAt;
  await h.click(rankingPanel(h).querySelector('.miu-pager button:last-child'));
  assert.match(rankingPanel(h).textContent,/tester最新順位/);assert.match(rankingPanel(h).querySelector('.miu-pager').textContent,/1 \/ 3/);assert.equal(rankingPanel(h).querySelector('em').textContent,'1');
  await settle(()=>pending.resolve(rankingTimeout()));
  assert.match(rankingCount(h),/250人/);assert.match(rankingPanel(h).textContent,/tester最新順位/);assert.match(rankingPanel(h).textContent,/前回表示分/);
  assert.equal(h.read().value.page,1);assert.equal(h.read().savedAt,before);assert.equal(h.read().value.rows.length,1);
  fail=false;await h.click(rankingPanel(h).querySelector('.miu-error button'));
  assert.equal(h.calls.filter(c=>c.action===kind).at(-1).page,2);assert.match(rankingPanel(h).textContent,/次ページ確認済み/);assert.equal(rankingPanel(h).querySelector('em').textContent,'101');assert.equal(h.read().value.page,2);
 });
 test(kind+': authorization denial discards the formerly verified count instead of showing zero',async t=>{
  let denied=false;const h=await fixture(t,{kind,respond:c=>c.action===kind&&denied?Response.json({error:'denied'},{status:403}):undefined});
  await h.show();assert.match(rankingCount(h),/250人/);denied=true;await h.show({revision:1});
  assert.match(rankingCount(h),/—人/);assert.doesNotMatch(rankingPanel(h).textContent,/tester最新順位|250人/);assert.equal(h.read(),null);
 });
 for(const token of ['b','c'])test(kind+': '+(token==='b'?'account change':'same-account token change')+' does not retain the old verified count when the new request fails',async t=>{
  const h=await fixture(t,{kind,respond:c=>c.action===kind&&c.token!=='a'?rankingTimeout():undefined});
  await h.show();assert.match(rankingCount(h),/250人/);h.w.localStorage.setItem('token',token);await h.show();
  assert.match(rankingCount(h),/—人/);assert.doesNotMatch(rankingPanel(h).textContent,/tester最新順位|250人/);assert.equal(h.read(),null);
 });
}
