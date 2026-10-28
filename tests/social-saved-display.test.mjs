import test from 'node:test';
import assert from 'node:assert/strict';
import * as React from 'react';
import {sceneFixture,pause} from './react-scene-fixture.mjs';

const tokenKey='fixture-token',scope={account:'tester',token:'token-a'};
const row=name=>({person_key:'person',actor_name:name,actor_url:'https://note.com/peer',relation:'mutual'});
const comparison={action:'comparison',window:'latest',relationship:'mutual',query:'',page:2,pageSize:50};
async function settle(work=()=>{}){await React.act(async()=>{work();await new Promise(r=>setTimeout(r,5));for(let i=0;i<3;i++)await pause()})}
async function fixture(t,query=comparison,{fallback=async()=>{throw new Error('offline')},delayed=false,historyWindowVersion,historyEvidenceVersion=4}={}){
 let now=Date.now();class Clock extends Date{static now(){return now}}
 const calls=[],timers=[];let deliver,iconCalls=0;
 const fetch=async(_url,init)=>{if(String(_url).endsWith('creator-icons')){iconCalls++;return Response.json({items:[]})}calls.push({body:JSON.parse(init.body),token:init.headers['X-Insight-Token']});return new Promise(resolve=>{deliver=(value,status=200)=>resolve(Response.json(value,{status}))})};
 const h=await sceneFixture(t,{fetch,globals:{Date:Clock},dependencies:{
  './insight-view-lifecycle':{fetchInsightResource:fetch,canRetainInsightView:at=>Number(at)<=now},
  './creator-avatar':{CreatorAvatar:()=>React.createElement('span')},
  './insight-account-store':{INSIGHT_TOKEN_KEY:tokenKey,readStoredInsightAccounts:()=>[{noteId:'tester',memberToken:'token-a'},{noteId:'other',memberToken:'token-b'}]},
  './insight-member-db-fallback':{memberReadAuthFailure:message=>/INSIGHT_(SESSION_INVALID|LOGIN_REQUIRED|MEMBER_INACTIVE)|HTTP_40[13]/.test(message),memberDbReadFallback:fallback},
 }});
 Object.defineProperty(h.w.document,'visibilityState',{value:'visible',writable:true});h.w.localStorage.setItem(tokenKey,'token-a');
 const saved=h.load('src/insight-saved-view.ts');saved.writeSavedInsightView('social-last',scope,{historyWindowVersion,historyEvidenceVersion,query,payload:{ok:true,noteId:'tester',rows:[row('前回の人物')],total:150}},Date.now()-600000);
 const savedKey=saved.savedInsightViewKey('social-last',scope),copy=h.w.localStorage.getItem(savedKey);if(delayed)h.w.localStorage.removeItem(savedKey);
 h.w.setInterval=(fn,ms)=>{const timer={fn,ms,cancelled:false};timers.push(timer);return timer};h.w.clearInterval=timer=>{if(timer)timer.cancelled=true};
 const Component=h.load('src/member-insight-social-v2.tsx').MemberInsightSocialV2;await h.render(Component,{});await settle();
 return{...h,Component,calls,copy,iconCount:()=>iconCalls,advance:ms=>{now+=ms},poll:()=>settle(()=>timers.findLast(timer=>timer.ms===60000&&!timer.cancelled).fn()),hydrate:()=>settle(()=>{h.w.localStorage.setItem(savedKey,copy);h.w.dispatchEvent(new h.w.Event('mumei-insight-storage-hydrated'))}),deliver:(value,status)=>deliver(value,status),pending:()=>deliver,body:()=>h.w.document.querySelector('.mis2-social-root,.mis2').textContent};
}

test('前回の条件とページを先に表示し、50件の最新確認を1回行う',async t=>{
 const h=await fixture(t);assert.match(h.body(),/前回の人物/);assert.match(h.body(),/前回表示分・最新確認中/);assert.equal(h.calls.length,1);assert.deepEqual(h.calls[0].body,comparison);
 assert.equal(h.w.document.querySelector('.mis2-relationship-filter select').value,'mutual');assert.match(h.body(),/2 \/ 3/);
 await settle(()=>h.deliver({ok:true,noteId:'tester',rows:[row('最新の人物')],total:150}));
 assert.match(h.body(),/最新の人物/);assert.doesNotMatch(h.body(),/前回の人物|前回表示分/);
});

test('個別履歴の前回ページを復元し、先頭へ戻して取得し直さない',async t=>{
 const query={action:'people',window:'oldest',query:'',page:3,pageSize:50,direction:'followings'};
 const h=await fixture(t,query);assert.match(h.body(),/前回の人物/);assert.match(h.body(),/前回表示分・最新確認中/);assert.equal(h.calls.length,1);assert.deepEqual(h.calls[0].body,query);
 assert.equal(h.w.document.querySelector('.mis2-pager select').value,'3');
});

test('tokenを切り替えると保存表示を消し、前tokenの遅い応答を表示しない',async t=>{
 const h=await fixture(t),old=h.pending();h.w.localStorage.setItem(tokenKey,'token-b');await h.render(h.Component,{});await settle();assert.doesNotMatch(h.body(),/前回の人物/);
 await settle(()=>old({ok:true,noteId:'tester',rows:[row('旧tokenの応答')],total:1}));assert.doesNotMatch(h.body(),/旧tokenの応答/);
 await settle(()=>h.deliver({ok:true,noteId:'other',rows:[],total:0}));
});

test('401と403は任意のエラー本文でも保存表示とコピーを破棄する',async t=>{
 for(const status of [401,403]){
  const h=await fixture(t);assert.match(h.body(),/前回の人物/);
  await settle(()=>h.deliver({ok:false,error:'アクセス拒否の応答'},status));
  assert.doesNotMatch(h.body(),/前回の人物|前回表示分/);assert.match(h.body(),/アクセスを確認できませんでした/);
  assert.equal(h.load('src/insight-saved-view.ts').readSavedInsightView('social-last',scope),null);
  const before=h.calls.length;await settle(()=>h.w.dispatchEvent(new h.w.Event('focus')));assert.equal(h.calls.length,before);
 }
});

test('並行した取得の認証拒否後は古い200応答でもコピーと人物を復活させない',async t=>{
 const h=await fixture(t),old=h.pending(),select=h.w.document.querySelector('.mis2-relationship-filter select');
 await React.act(async()=>{select.value='following_only';select.dispatchEvent(new h.w.Event('change',{bubbles:true}));await pause()});await settle();
 assert.equal(h.calls.length,2);await settle(()=>h.deliver({ok:false,error:'denied'},403));
 await settle(()=>old({ok:true,noteId:'tester',rows:[row('拒否後の古い応答')],total:1}));
 assert.doesNotMatch(h.body(),/前回の人物|拒否後の古い応答/);assert.equal(h.load('src/insight-saved-view.ts').readSavedInsightView('social-last',scope),null);
});

test('一時的な500では保存表示を残し、接続回復時に最新確認できる',async t=>{
 const h=await fixture(t);await settle(()=>h.deliver({ok:false,error:'保存先が一時停止中'},500));
 assert.match(h.body(),/前回の人物/);assert.match(h.body(),/前回表示分・最新確認できず/);assert.ok(h.load('src/insight-saved-view.ts').readSavedInsightView('social-last',scope));
 await settle(()=>h.w.dispatchEvent(new h.w.Event('focus')));assert.equal(h.calls.length,2);
 await settle(()=>h.deliver({ok:true,noteId:'tester',rows:[row('回復後の人物')],total:1}));assert.match(h.body(),/回復後の人物/);assert.doesNotMatch(h.body(),/前回表示分/);
});

test('代替の保存先読取で認証拒否された場合も前回表示へ戻さない',async t=>{
 const h=await fixture(t,comparison,{fallback:async()=>{throw new Error('HTTP_401')}});await settle(()=>h.deliver({ok:false,error:'一時的なAPI障害'},500));
 assert.doesNotMatch(h.body(),/前回の人物|前回表示分/);assert.equal(h.load('src/insight-saved-view.ts').readSavedInsightView('social-last',scope),null);
});


const defaultComparison={action:'comparison',window:'oldest',relationship:'following_only',query:'',page:1,pageSize:50};
test('遅い保管庫から照合中と同じ条件のコピーだけ復元し通信や確認時刻を増やさない',async t=>{
 const h=await fixture(t,defaultComparison,{delayed:true});assert.doesNotMatch(h.body(),/前回の人物/);assert.equal(h.calls.length,1);
 await h.hydrate();assert.match(h.body(),/前回の人物/);assert.match(h.body(),/前回表示分・最新確認中/);assert.equal(h.calls.length,1);
 const original=JSON.parse(h.copy);assert.equal(h.load('src/insight-saved-view.ts').readSavedInsightView('social-last',scope).savedAt,original.savedAt);
 await h.hydrate();assert.equal(h.calls.length,1);
 await settle(()=>h.deliver({ok:true,noteId:'tester',rows:[row('最新の人物')],total:1}));assert.match(h.body(),/最新の人物/);assert.doesNotMatch(h.body(),/前回の人物|前回表示分/);
});

for(const rows of [[],[row('先に届いた最新の人物')]])test(`照合の最新${rows.length?'成功':'空結果'}後に遅いコピーで上書きしない`,async t=>{
 const h=await fixture(t,defaultComparison,{delayed:true});await settle(()=>h.deliver({ok:true,noteId:'tester',rows,total:rows.length}));await h.hydrate();assert.doesNotMatch(h.body(),/前回の人物|前回表示分/);assert.equal(h.calls.length,1);
 if(rows.length)assert.match(h.body(),/先に届いた最新の人物/);
});

for(const status of [401,403])test(`照合のHTTP ${status}後に遅いコピーで人物を復活させない`,async t=>{
 const h=await fixture(t,defaultComparison,{delayed:true});await settle(()=>h.deliver({ok:false,error:'denied'},status));await h.hydrate();assert.doesNotMatch(h.body(),/前回の人物|前回表示分/);assert.match(h.body(),/アクセスを確認できませんでした/);
});

test('遅い保存条件は現在の照合のフィルターや履歴タブを変更しない',async t=>{
 for(const query of [comparison,{action:'people',window:'oldest',query:'',page:3,pageSize:50,direction:'followings'}]){
  const h=await fixture(t,query,{delayed:true});await h.hydrate();assert.doesNotMatch(h.body(),/前回の人物|前回表示分/);assert.equal(h.calls.length,1);assert.deepEqual(h.calls[0].body,defaultComparison);assert.equal(h.w.document.querySelector('.mis2-relationship-filter select').value,'following_only');
 }
});

for(const transition of ['filter','route','token','revision'])test(`照合の${transition}変更後に遅いコピーを挿し込まない`,async t=>{
 const h=await fixture(t,defaultComparison,{delayed:true});
 if(transition==='filter')await React.act(async()=>{const select=h.w.document.querySelector('.mis2-relationship-filter select');select.value='mutual';select.dispatchEvent(new h.w.Event('change',{bubbles:true}));await pause()});
 if(transition==='route')await h.click([...h.w.document.querySelectorAll('button')].find(button=>button.textContent==='個別の履歴'));
 if(transition==='token')h.w.localStorage.setItem(tokenKey,'token-b');
 if(transition==='revision')await h.render(h.Component,{revision:1});
 await settle();const count=h.calls.length;await h.hydrate();assert.doesNotMatch(h.body(),/前回の人物|前回表示分/);assert.equal(h.calls.length,count);
});


test('一時的な照合失敗後の遅いコピーは確認失敗のまま表示し新しい通信を起こさない',async t=>{
 const h=await fixture(t,defaultComparison,{delayed:true});await settle(()=>h.deliver({ok:false,error:'TEMPORARILY_OFFLINE'},500));await h.hydrate();assert.match(h.body(),/前回の人物/);assert.match(h.body(),/前回表示分・最新確認できず/);assert.match(h.body(),/TEMPORARILY_OFFLINE/);assert.equal(h.calls.length,1);
});


for(const action of ['comparison','people'])test(`確認済み${action}は時間経過後のページ戻りと画面戻りでも通信せず条件を維持する`,async t=>{
 const query=action==='comparison'?{...defaultComparison}:{action:'people',window:'latest',query:'',page:1,pageSize:50,direction:'followers'};
 const pageRows=name=>Array.from({length:50},(_,i)=>({...row(name+'-'+i),person_key:'person-'+i}));
 const h=await fixture(t,query);await settle(()=>h.deliver({ok:true,noteId:'tester',rows:pageRows('確認済みページ1'),total:150}));
 const pager=label=>[...h.w.document.querySelectorAll('.mis2-pager button')].find(button=>button.textContent===label);
 await h.click(pager('→'));await settle();assert.equal(h.calls.length,2);
 await settle(()=>h.deliver({ok:true,noteId:'tester',rows:pageRows('確認済みページ2'),total:150}));
 h.advance(86400000);await h.click(pager('←'));await settle();assert.equal(h.calls.length,2);assert.match(h.body(),/確認済みページ1/);
 await h.render(()=>null);await h.render(h.Component,{});await settle();assert.equal(h.calls.length,2);assert.match(h.body(),/確認済みページ1/);assert.equal(h.iconCount(),action==='people'?2:0);
 await settle(()=>{h.w.dispatchEvent(new h.w.Event('focus'));h.w.dispatchEvent(new h.w.Event('pageshow'))});assert.equal(h.calls.length,2);
 await h.poll();assert.equal(h.calls.length,3,'定期的な最新確認は保持済みcacheで止めない');assert.match(h.body(),/確認済みページ1/);
 await settle(()=>h.deliver({ok:true,noteId:'tester',rows:pageRows('最新確認後のページ1'),total:150}));assert.match(h.body(),/最新確認後のページ1/);
 await h.render(h.Component,{revision:1});await settle();assert.equal(h.calls.length,4,'明示更新は同条件でも再確認する');
 await settle(()=>h.deliver({ok:true,noteId:'tester',rows:pageRows('明示更新後のページ1'),total:150}));assert.match(h.body(),/明示更新後のページ1/);
});

test('増減履歴へ入ると最新人物の枠を引き継がず全履歴を表示し、ページ戻りは再取得しない',async t=>{
 const query={action:'people',window:'latest',query:'',page:1,pageSize:50,direction:'followers'};
 const h=await fixture(t,query);await settle(()=>h.deliver({ok:true,noteId:'tester',rows:[row('現在の人物')],total:1}));
 await h.click(h.w.document.querySelector('button[aria-label="【増】【減】履歴"]'));await settle();
 assert.equal(h.calls.length,2);assert.deepEqual(h.calls[1].body,{action:'events',window:'all',query:'',page:1,pageSize:50,direction:'followers',change:'all',dateFrom:null,dateTo:null});
 const events=Array.from({length:50},(_,i)=>({id:i+1,person_key:'former-'+i,actor_name:'保存済みの減少人物'+i,actor_url:'https://note.com/former_'+i,direction:'followers',event_type:'removed',identity_exact:true,evidence:'authenticated_relationship'}));
 await settle(()=>h.deliver({ok:true,noteId:'tester',rows:events,total:51}));assert.match(h.body(),/保存済みの減少人物0/);
 const pager=label=>[...h.w.document.querySelectorAll('.mis2-pager button')].find(button=>button.textContent===label);
 await h.click(pager('→'));await settle();assert.equal(h.calls.length,3);
 await settle(()=>h.deliver({ok:true,noteId:'tester',rows:[{...events[0],id:51,person_key:'former-50',actor_name:'保存済みの減少人物50'}],total:51}));
 h.advance(86400000);await h.click(pager('←'));await settle();assert.equal(h.calls.length,3);assert.match(h.body(),/保存済みの減少人物0/);
});

test('過去から1000人は現在一覧の下端ではなく保存開始時の人物として案内する',async t=>{
 const query={action:'people',window:'oldest',query:'',page:1,pageSize:50,direction:'followers'};
 const h=await fixture(t,query);await settle(()=>h.deliver({ok:true,noteId:'tester',rows:[{...row('過去の保存人物'),active:false}],total:1}));
 assert.match(h.body(),/保存開始時からの1,000人/);assert.match(h.body(),/現在の一覧から外れた人も含みます/);assert.match(h.body(),/過去の保存人物/);assert.equal(h.calls.length,1);
});

test('関係確認で復元した人物と全件照合の確認済み減少を表示する',async t=>{
 const query={action:'events',window:'all',query:'',page:1,pageSize:50,direction:'followers',change:'removed',dateFrom:null,dateTo:null};
 const h=await fixture(t,query),removed={event_type:'removed',direction:'followers',change_count:1};
 await settle(()=>h.deliver({ok:true,noteId:'tester',rows:[
  {...removed,id:1,person_key:'verified',actor_name:'履歴から復元した人物',actor_url:'https://note.com/verified',identity_exact:true,evidence:'authenticated_relationship'},
  {...removed,id:2,person_key:'complete',actor_name:'全件確認した人物',actor_url:'https://note.com/complete',identity_exact:true,evidence:'complete_snapshot'}
 ],total:2}));
 const articles=[...h.w.document.querySelectorAll('.mis2-list article')];assert.equal(articles.length,2);
 assert.match(articles[0].textContent,/履歴から復元した人物/);assert.match(articles[0].textContent,/関係確認履歴で確認/);assert.doesNotMatch(articles[0].textContent,/全件照合/);
 assert.match(articles[1].textContent,/全件照合で確認/);assert.match(h.body(),/確認済み 2件/);assert.match(h.body(),/減った全人数ではありません/);
});

test('調査画面に古い27人と直近の保存人物と人数だけの不明を表示し、減少とは断定しない',async t=>{
 const query={action:'investigation',window:'all',query:'',page:1,pageSize:50,direction:'followers',change:'removed',dateFrom:null,dateTo:null};
 const h=await fixture(t,query),removed={event_type:'removed',direction:'followers',detected_at:'2026-10-28T01:00:00Z'};
 const old=Array.from({length:27},(_,i)=>({...removed,id:'event-'+i,person_key:'old-'+i,actor_name:'過去の保存人物'+i,actor_url:'https://note.com/old_'+i,evidence:'window_candidate',identity_exact:false,change_count:1,source:'relation_event'}));
 const recent={...removed,id:'archive-recent',person_key:'recent',actor_name:'直近の保存人物',actor_url:'https://note.com/recent',evidence:'window_candidate',identity_exact:false,change_count:0,source:'saved_archive',evidence_window_start:'2026-10-27T01:00:00Z'};
 const unknown={...removed,id:'count',person_key:'unknown:drop',evidence:'count_only',identity_exact:false,change_count:48};
 const rows=[...old,recent,unknown];await settle(()=>h.deliver({ok:true,noteId:'tester',rows,total:rows.length}));
 const articles=[...h.w.document.querySelectorAll('.mis2-list article')];assert.equal(articles.length,29);assert.match(h.body(),/調査記録 29件/);
 assert.equal(articles.filter(article=>article.classList.contains('candidate')).length,28);
 for(const article of articles.slice(0,28)){assert.match(article.textContent,/範囲外・要確認/);assert.doesNotMatch(article.textContent,/【減】|変化を検知|関係確認履歴で確認/)}
 assert.match(articles[0].textContent,/範囲外を検知/);assert.doesNotMatch(articles[0].textContent,/最終確認/);
 assert.match(articles[27].textContent,/直近の保存人物/);assert.match(articles[27].textContent,/過去の存在確認 2026\/10\/27 10:00/);assert.match(articles[27].textContent,/減少人数には含めません/);assert.doesNotMatch(articles[27].textContent,/不明 −1/);
 assert.match(articles[28].textContent,/不明 −48/);assert.doesNotMatch(articles[28].textContent,/直近の保存人物|範囲外・要確認/);assert.doesNotMatch(h.w.document.querySelector('.mis2-list').textContent,/【減】/);
});

test('今後の範囲外観測は人数0のまま候補と表示し、検知日時を過去の最終確認日時と混同しない',async t=>{
 const query={action:'investigation',window:'all',query:'',page:1,pageSize:50,direction:'followers',change:'removed',dateFrom:null,dateTo:null};
 const h=await fixture(t,query);await settle(()=>h.deliver({ok:true,noteId:'tester',rows:[{id:'window:new',event_type:'removed',direction:'followers',person_key:'new-window',actor_name:'新しく範囲外になった人物',actor_url:'https://note.com/new_window',source:'window_observation',evidence:'window_candidate',identity_exact:false,change_count:0,detected_at:'2026-10-28T01:00:00Z'}],total:1}));
 const article=h.w.document.querySelector('.mis2-list article');assert.match(article.textContent,/範囲外・要確認/);assert.match(article.textContent,/範囲外を検知/);assert.doesNotMatch(article.textContent,/【減】|最終確認|不明 −1/);assert.ok(article.classList.contains('candidate'));
});

test('スマホ用の短いラベルでも方向と履歴の意味をアクセシブル名に残す',async t=>{
 const query={action:'people',window:'latest',query:'',page:1,pageSize:50,direction:'followers'},h=await fixture(t,query);
 const following=h.w.document.querySelector('button[aria-label="あなたが相手をフォロー"]'),followers=h.w.document.querySelector('button[aria-label="相手があなたをフォロー"]');
 assert.equal(following.textContent,'フォロー中');assert.equal(followers.textContent,'フォロワー');
 assert.equal(h.w.document.querySelector('button[aria-label="【増】【減】履歴"]').textContent,'増減履歴');
 assert.equal(h.w.document.querySelector('button[aria-label="拾えなかった減少・不明人物を再調査"]').textContent,'未確認・人数のみ');
 assert.equal(following.title,'あなたが相手をフォロー');assert.equal(followers.title,'相手があなたをフォロー');
 await settle(()=>h.deliver({ok:true,noteId:'tester',rows:[row('確認済みの人物')],total:1}));
 await h.click(following);await settle();assert.equal(h.calls.at(-1).body.direction,'followings');
});

for(const action of ['events','investigation'])test(`旧保存の${action}・最新枠だけを初回更新で全履歴へ移し、古い枠の本文は流用しない`,async t=>{
 const query={action,window:'latest',query:'対象',page:3,pageSize:50,direction:'followings',change:'removed',dateFrom:'2026-10-01T00:00:00+09:00',dateTo:'2026-10-01T15:00:00.000Z'},h=await fixture(t,query);
 assert.doesNotMatch(h.body(),/前回の人物|前回表示分/);await React.act(async()=>{await new Promise(resolve=>setTimeout(resolve,270));await pause()});assert.equal(h.calls.length,1);assert.deepEqual(h.calls[0].body,{...query,window:'all',page:1});
 await settle(()=>h.deliver({ok:true,noteId:'tester',rows:[{...row('対象・全履歴で復元'),event_type:'removed',direction:'followings',identity_exact:true,evidence:'authenticated_relationship'}],total:1}));
 assert.match(h.body(),/対象・全履歴で復元/);
 const saved=h.load('src/insight-saved-view.ts').readSavedInsightView('social-last',scope);assert.equal(saved.value.historyWindowVersion,2);assert.equal(saved.value.query.window,'all');assert.equal(saved.value.query.page,1);
 h.advance(86400000);await h.render(()=>null);await h.render(h.Component,{});await React.act(async()=>{await new Promise(resolve=>setTimeout(resolve,270));await pause()});assert.equal(h.calls.length,1);assert.match(h.body(),/対象・全履歴で復元/);
});

test('更新後に明示選択した最新枠と2ページ目は再表示でも変更せず、確認済み本文を再取得しない',async t=>{
 const query={action:'events',window:'latest',query:'',page:2,pageSize:50,direction:'followers',change:'removed',dateFrom:null,dateTo:null},h=await fixture(t,query,{historyWindowVersion:2});
 assert.match(h.body(),/前回の人物/);assert.equal(h.calls.length,1);assert.deepEqual(h.calls[0].body,query);
 const rows=Array.from({length:50},(_,i)=>({...row('選択した最新枠2ページ-'+i),id:i,person_key:'selected-'+i,event_type:'removed',direction:'followers',identity_exact:true,evidence:'complete_snapshot'}));
 await settle(()=>h.deliver({ok:true,noteId:'tester',rows,total:150}));h.advance(86400000);await h.render(()=>null);await h.render(h.Component,{});await settle();
 assert.equal(h.calls.length,1);assert.match(h.body(),/選択した最新枠2ページ-0/);assert.equal(h.w.document.querySelector('.mis2-pager select').value,'2');assert.equal(h.w.document.querySelector('button[aria-pressed="true"]').textContent,'個別の履歴');
 const saved=h.load('src/insight-saved-view.ts').readSavedInsightView('social-last',scope);assert.equal(saved.value.historyWindowVersion,2);assert.equal(saved.value.query.window,'latest');assert.equal(saved.value.query.page,2);
});

for(const action of ['events','investigation'])test(`旧判定の${action}の保存本文は再表示せず、同じ条件で一度だけ読み直す`,async t=>{
 const query={action,window:'all',query:'',page:2,pageSize:50,direction:'followers',change:'removed',dateFrom:null,dateTo:null};
 const h=await fixture(t,query,{historyWindowVersion:2,historyEvidenceVersion:3});
 assert.doesNotMatch(h.body(),/前回の人物|前回表示分/);assert.equal(h.calls.length,1);assert.deepEqual(h.calls[0].body,query);
 const actual={id:'proof',person_key:'proof',actor_name:'新判定の人物',direction:'followers',event_type:'removed',identity_exact:action==='events',evidence:action==='events'?'authenticated_relationship':'window_candidate'};
 await settle(()=>h.deliver({ok:true,noteId:'tester',rows:[actual],total:51}));
 assert.match(h.body(),/新判定の人物/);await h.render(()=>null);await h.render(h.Component,{});await settle();assert.equal(h.calls.length,1);
 const saved=h.load('src/insight-saved-view.ts').readSavedInsightView('social-last',scope);assert.equal(saved.value.historyEvidenceVersion,4);assert.equal(saved.value.query.page,2);
});

test('旧判定の相互から減の保存本文を起動時・最新確認失敗時に復活させず、条件とページは保持する',async t=>{
 const query={action:'comparison',window:'oldest',relationship:'lost',query:'',page:2,pageSize:50},h=await fixture(t,query,{historyEvidenceVersion:3});
 assert.doesNotMatch(h.body(),/前回の人物|前回表示分/);assert.equal(h.calls.length,1);assert.deepEqual(h.calls[0].body,query);assert.equal(h.w.document.querySelector('.mis2-relationship-filter select').value,'lost');
 await settle(()=>h.deliver({ok:false,error:'保存先が一時的に利用できません'},500));assert.doesNotMatch(h.body(),/前回の人物|前回表示分/);assert.match(h.body(),/保存先が一時的に利用できません/);
 await settle(()=>h.w.dispatchEvent(new h.w.Event('focus')));assert.equal(h.calls.length,2);assert.deepEqual(h.calls[1].body,query);
 await settle(()=>h.deliver({ok:true,noteId:'tester',rows:[{person_key:'confirmed-loss',actor_name:'新判定で確認した架空の人物',relation:'following_only',is_following:true,is_follower:false,lost_at:'2026-10-28T00:00:00Z'}],total:51}));
 assert.match(h.body(),/新判定で確認した架空の人物/);assert.doesNotMatch(h.body(),/前回の人物|前回表示分/);
 const saved=h.load('src/insight-saved-view.ts').readSavedInsightView('social-last',scope);assert.equal(saved.value.historyEvidenceVersion,4);assert.equal(saved.value.query.relationship,'lost');assert.equal(saved.value.query.page,2);
 await h.render(()=>null);await h.render(h.Component,{});await settle();assert.equal(h.calls.length,2,'新判定の同じ照合ページへ戻る時は通信しない');assert.match(h.body(),/新判定で確認した架空の人物/);assert.equal(h.w.document.querySelector('.mis2-pager span').textContent,'2 / 2');
});

test('確認済みの過去の減少と後日の相互・再フォローを同じ人物カードで区別する',async t=>{
 const query={action:'events',window:'all',query:'',page:1,pageSize:50,direction:'followers',change:'removed',dateFrom:null,dateTo:null},h=await fixture(t,query);
 await settle(()=>h.deliver({ok:true,noteId:'tester',rows:[{id:'loss',person_key:'returned',actor_name:'再フォローした架空の人物',direction:'followers',event_type:'removed',identity_exact:true,evidence:'authenticated_relationship',detected_at:'2026-09-10T00:00:00Z',current_is_following:true,current_is_follower:true,current_relation:'mutual',current_verified_at:'2026-10-28T00:00:00Z',current_direction_verified_at:'2026-10-28T00:00:00Z',current_following_verified_at:'2026-10-27T00:00:00Z',current_follower_verified_at:'2026-10-28T00:00:00Z'}],total:1}));
 const article=h.w.document.querySelector('.mis2-list article');assert.match(article.textContent,/過去の【減】/);assert.match(article.textContent,/最新確認：相互フォロー/);assert.match(article.textContent,/相手からのフォロー確認 2026\/10\/28 09:00/);assert.match(article.textContent,/あなたのフォロー確認 2026\/10\/27 09:00/);assert.match(article.textContent,/再フォロー確認済み/);assert.match(article.textContent,/変化を検知 2026\/9\/10 09:00/);
 assert.equal(h.calls.length,1,'最新の関係をカード別の追加通信で読まない');
});

test('最新の確認日時がない人物を相互・現在フォロー中と断定しない',async t=>{
 const query={action:'events',window:'all',query:'',page:1,pageSize:50,direction:'followers',change:'removed',dateFrom:null,dateTo:null},h=await fixture(t,query);
 await settle(()=>h.deliver({ok:true,noteId:'tester',rows:[{id:'loss',person_key:'missing-time',actor_name:'確認日時がない架空の人物',direction:'followers',event_type:'removed',identity_exact:true,evidence:'authenticated_relationship',detected_at:'2026-09-10T00:00:00Z',current_is_following:true,current_is_follower:true}],total:1}));
 const article=h.w.document.querySelector('.mis2-list article');assert.match(article.textContent,/最新の関係：未確認/);assert.doesNotMatch(article.textContent,/最新確認：相互フォロー|再フォロー確認済み|過去の【減】/);
});

test('別方向の後日の確認だけでフォロワーの再フォロー確認と断定しない',async t=>{
 const query={action:'events',window:'all',query:'',page:1,pageSize:50,direction:'followers',change:'removed',dateFrom:null,dateTo:null},h=await fixture(t,query);
 await settle(()=>h.deliver({ok:true,noteId:'tester',rows:[{id:'loss',person_key:'different-direction',actor_name:'方向別確認の架空の人物',direction:'followers',event_type:'removed',identity_exact:true,evidence:'authenticated_relationship',detected_at:'2026-09-10T00:00:00Z',current_is_following:true,current_is_follower:true,current_verified_at:'2026-10-28T00:00:00Z',current_direction_verified_at:'2026-09-01T00:00:00Z'}],total:1}));
 const article=h.w.document.querySelector('.mis2-list article');assert.doesNotMatch(article.textContent,/再フォロー確認済み|過去の【減】/);assert.match(article.textContent,/変化を検知 2026\/9\/10 09:00/);
});

test('調査画面は未確認の保存人物を明示操作で再確認でき、自動でnoteへ通信しない',async t=>{
 const query={action:'investigation',window:'all',query:'',page:1,pageSize:50,direction:'followers',change:'removed',dateFrom:null,dateTo:null},h=await fixture(t,query);
 const link=h.w.document.querySelector('.mis2-comparison-status a');assert.ok(link);assert.equal(link.href,'https://note.com/tester?mumei_social_scan=history');assert.match(link.textContent,/保存人物の関係をnoteで確認/);assert.equal(h.calls.length,1);assert.equal(h.calls[0].body.action,'investigation');
 await settle(()=>h.deliver({ok:true,noteId:'tester',rows:[],total:0}));assert.equal(h.calls.length,1);
});

test('確認済みの少ない表示件数を全減少人数と混同せず、人数差分と未確認の候補人数を別集計する',async t=>{
 const query={action:'events',window:'oldest',query:'',page:1,pageSize:50,direction:'followers',change:'removed',dateFrom:null,dateTo:null},h=await fixture(t,query,{historyWindowVersion:2});
 const historySummary={confirmedRemoved:2,unknownDecrease:48,unresolvedCandidates:419,resolvedCandidates:52,savedPeople:1485,coverage:{followers:{received:1000,expected:2306,complete:false,at:'2026-10-28T00:00:00Z'}}};
 await settle(()=>h.deliver({ok:true,noteId:'tester',rows:[{id:'loss',person_key:'proof',actor_name:'確認済みの架空の人物',direction:'followers',event_type:'removed',identity_exact:true,evidence:'authenticated_relationship'}],total:1,historySummary}));
 const summary=h.w.document.querySelector('.mis2-history-summary');assert.ok(summary);const pairs=[...summary.querySelectorAll('dl>div')].map(el=>el.textContent);assert.deepEqual(pairs,['人物確認済みの減少2件','人物未特定の減少48人分','関係未確認419人','保存人物1,485人']);
 assert.match(h.body(),/確認済み 1件/);assert.match(summary.textContent,/人物範囲の選択にかかわらず全履歴/);assert.match(summary.textContent,/1,000 \/ 2,306人（一部）/);assert.match(summary.textContent,/2026\/10\/28 09:00/);assert.doesNotMatch(summary.textContent,/419人.*減少/);assert.equal(h.calls.length,1);
 await h.render(()=>null);await h.render(h.Component,{});await settle();assert.equal(h.calls.length,1);assert.match(h.w.document.querySelector('.mis2-history-summary').textContent,/人物未特定の減少48人分/);
});

const detailQuery={action:'people',window:'oldest',query:'',page:1,pageSize:50,direction:'followers'};
const detailPerson={person_key:'detail-person',actor_name:'調査する架空の人物',actor_url:'https://note.com/detail_person',direction:'followers',active:false,first_seen_at:'2026-09-01T00:00:00Z',last_seen_at:'2026-09-02T00:00:00Z'};
const freshMutual={person_key:'detail-person',current_relation:'mutual',current_is_following:true,current_is_follower:true,current_verified_at:'2026-10-28T00:00:00Z',current_following_verified_at:'2026-10-27T00:00:00Z',current_follower_verified_at:'2026-10-28T00:00:00Z'};
async function inspectDetail(h,person,payload){
 await settle(()=>h.deliver({ok:true,noteId:'tester',rows:[person],total:1}));
 await h.click(h.w.document.querySelector('.mis2-list article button'));await settle();
 assert.deepEqual(h.calls.at(-1).body,{action:'investigate',personKey:person.person_key,page:1});
 await settle(()=>h.deliver({ok:true,noteId:'tester',personKey:person.person_key,relations:[],events:[],relationshipHistory:[],...payload}));
 return h.w.document.querySelector('.mis2-inspection');
}

test('人物一覧からの調査は履歴がなくても新しい関係確認を表示し、保存一覧の範囲外を現在未確認と混同しない',async t=>{
 const h=await fixture(t,detailQuery),inspection=await inspectDetail(h,detailPerson,{currentRelationship:freshMutual,relations:[detailPerson]});
 assert.match(inspection.textContent,/最新確認：相互フォロー/);assert.match(inspection.textContent,/あなたのフォロー確認 2026\/10\/27 09:00/);assert.match(inspection.textContent,/相手からのフォロー確認 2026\/10\/28 09:00/);
 assert.match(inspection.textContent,/過去の保存一覧/);assert.doesNotMatch(inspection.textContent,/現在の関係は未確定|最新の関係：未確認/);assert.equal(h.calls.length,2,'一覧と明示した人物調査だけを取得する');
});

test('解決済みの範囲外記録は人物調査でも要確認候補に戻さず、存在確認日時と範囲外の記録を区別する',async t=>{
 const h=await fixture(t,detailQuery),event={...detailPerson,id:'resolved-window',event_type:'removed',identity_exact:false,evidence:'window_candidate',change_count:0,source:'saved_archive',candidate_resolved:true,evidence_window_start:'2026-09-01T00:00:00Z',detected_at:'2026-09-10T00:00:00Z'};
 const inspection=await inspectDetail(h,detailPerson,{currentRelationship:freshMutual,events:[event]});
 const record=inspection.querySelector('ol li');assert.match(record.textContent,/範囲外の記録・保存関係で確認済み/);assert.match(record.textContent,/解決済みの範囲外記録/);assert.match(record.textContent,/過去の存在確認 2026\/9\/1 09:00/);assert.doesNotMatch(record.textContent,/範囲外・要確認|候補・未確定|【減】|存在確認 2026\/9\/10/);
 assert.match(inspection.textContent,/最新確認：相互フォロー/);assert.equal(h.calls.length,2);
});

test('新しい人物調査はクリック前の減少判定を更新し、後日の再フォローと実際の過去の減少を残す',async t=>{
 const query={action:'events',window:'all',query:'',page:1,pageSize:50,direction:'followers',change:'removed',dateFrom:null,dateTo:null},h=await fixture(t,query);
 const event={...detailPerson,id:'confirmed-loss',event_type:'removed',identity_exact:true,evidence:'authenticated_relationship',change_count:1,detected_at:'2026-09-10T00:00:00Z',current_is_following:true,current_is_follower:false,current_direction_verified_at:'2026-09-10T00:00:00Z',current_follower_verified_at:'2026-09-10T00:00:00Z'};
 const inspection=await inspectDetail(h,event,{currentRelationship:freshMutual,events:[event]});
 assert.match(inspection.querySelector('.mis2-current-relation').textContent,/最新確認：相互フォロー/);assert.match(inspection.querySelector('.mis2-current-relation').textContent,/再フォロー確認済み/);
 const record=inspection.querySelector('ol li');assert.match(record.textContent,/過去の【減】/);assert.match(record.textContent,/関係確認履歴で確認/);assert.match(record.textContent,/変化を検知 2026\/9\/10 09:00/);assert.equal(h.calls.length,2);
});

for(const currentRelationship of [null,{person_key:'detail-person',current_relation:'unknown',current_is_following:null,current_is_follower:null,current_verified_at:null,current_following_verified_at:null,current_follower_verified_at:null}])test(`新しい人物調査の${currentRelationship?'不明':'null'}は古いカードや履歴の相互表示へ戻さない`,async t=>{
 const h=await fixture(t,detailQuery),person={...detailPerson,...freshMutual},event={...person,id:'old-event',event_type:'added',detected_at:'2026-09-01T00:00:00Z'};
 const inspection=await inspectDetail(h,person,{currentRelationship,events:[event]});
 const current=inspection.querySelector('.mis2-current-relation');assert.match(current.textContent,/最新の関係：未確認/);assert.doesNotMatch(current.textContent,/相互フォロー|フォローされています|再フォロー|2026\/10\/28/);assert.equal(h.calls.length,2);
});

test('旧APIの人物調査は応答内の同じ人物の関係を使い、カードの古い状態や別人の履歴を使わない',async t=>{
 const h=await fixture(t,detailQuery),person={...detailPerson,current_is_follower:false,current_follower_verified_at:'2026-09-01T00:00:00Z'};
 const inspection=await inspectDetail(h,person,{events:[{...freshMutual,person_key:'another-person',id:'other',event_type:'added'}, {...freshMutual,id:'matching',event_type:'added',detected_at:'2026-09-02T00:00:00Z'}]});
 assert.match(inspection.querySelector('.mis2-current-relation').textContent,/最新確認：相互フォロー/);assert.match(inspection.querySelector('.mis2-current-relation').textContent,/相手からのフォロー確認 2026\/10\/28 09:00/);assert.equal(h.calls.length,2);
});

test('人物調査でも反対方向の後日の確認だけでは再フォローと断定しない',async t=>{
 const query={action:'events',window:'all',query:'',page:1,pageSize:50,direction:'followers',change:'removed',dateFrom:null,dateTo:null},h=await fixture(t,query),event={...detailPerson,id:'old-loss',event_type:'removed',identity_exact:true,evidence:'authenticated_relationship',detected_at:'2026-09-10T00:00:00Z'};
 const inspection=await inspectDetail(h,event,{currentRelationship:{...freshMutual,current_follower_verified_at:'2026-09-01T00:00:00Z'},events:[event]});
 assert.doesNotMatch(inspection.querySelector('.mis2-current-relation').textContent,/再フォロー確認済み/);assert.doesNotMatch(inspection.querySelector('ol li').textContent,/過去の【減】/);assert.match(inspection.querySelector('ol li').textContent,/変化を検知 2026\/9\/10 09:00/);
});

test('存在確認日時のない過去の範囲外記録は検知日時を存在確認として表示しない',async t=>{
 const h=await fixture(t,detailQuery),inspection=await inspectDetail(h,detailPerson,{currentRelationship:freshMutual,events:[{id:'archive-no-time',person_key:detailPerson.person_key,direction:'followers',event_type:'removed',source:'saved_archive',identity_exact:false,evidence:'window_candidate',detected_at:'2026-09-10T00:00:00Z'}]});
 const record=inspection.querySelector('ol li');assert.match(record.textContent,/範囲外の記録 2026\/9\/10 09:00/);assert.doesNotMatch(record.textContent,/存在確認|最終確認/);
});


for(const action of ['events','investigation'])test(`減少確認の${action}集計から保存人物の明示照合へ進め、戻った一度だけ更新する`,async t=>{
 const query={action,window:'all',query:'',page:1,pageSize:50,direction:'followers',change:'removed',dateFrom:null,dateTo:null},h=await fixture(t,query,{historyWindowVersion:2});
 const historySummary={confirmedRemoved:1,unknownDecrease:48,unresolvedCandidates:441,savedPeople:1486};
 await settle(()=>h.deliver({ok:true,noteId:'tester',rows:[],total:0,historySummary}));
 const link=h.w.document.querySelector('.mis2-history-summary a');assert.ok(link);assert.equal(link.href,'https://note.com/tester?mumei_social_scan=history');assert.match(link.textContent,/保存人物の関係をnoteで確認/);
 await settle(()=>{h.w.dispatchEvent(new h.w.Event('focus'));h.w.dispatchEvent(new h.w.Event('pageshow'))});assert.equal(h.calls.length,1,'通常のタブ戻りでは再取得しない');
 await h.click(link);const markerKey=[...Array(h.w.sessionStorage.length)].map((_,i)=>h.w.sessionStorage.key(i)).find(key=>key.includes('social-recheck-return'));assert.ok(markerKey);assert.doesNotMatch(h.w.sessionStorage.getItem(markerKey),/token-a|token-b/);
 await settle(()=>h.w.dispatchEvent(new h.w.Event('focus')));assert.equal(h.calls.length,1,'離れる前のfocusは照合戻りと扱わない');
 await settle(()=>{h.w.document.visibilityState='hidden';h.w.document.dispatchEvent(new h.w.Event('visibilitychange'));h.w.dispatchEvent(new h.w.Event('blur'))});
 await settle(()=>{h.w.document.visibilityState='visible';h.w.dispatchEvent(new h.w.Event('focus'));h.w.dispatchEvent(new h.w.Event('pageshow'));h.w.document.dispatchEvent(new h.w.Event('visibilitychange'))});
 assert.equal(h.calls.length,2,'戻りの複数イベントを一回の通信へまとめる');assert.equal(h.w.sessionStorage.getItem(markerKey),null);
 await settle(()=>h.deliver({ok:true,noteId:'tester',rows:[],total:0,historySummary:{...historySummary,unresolvedCandidates:0}}));assert.match(h.w.document.querySelector('.mis2-history-summary').textContent,/関係未確認0人/);
 await settle(()=>{h.w.dispatchEvent(new h.w.Event('focus'));h.w.dispatchEvent(new h.w.Event('pageshow'));h.w.document.dispatchEvent(new h.w.Event('visibilitychange'))});assert.equal(h.calls.length,2,'消費した戻り指示は繰り返し通信を起こさない');
});

test('明示照合の戻りは会員とtokenに紐づき、他の本人へ更新指示を流用しない',async t=>{
 const query={action:'events',window:'all',query:'',page:1,pageSize:50,direction:'followers',change:'removed',dateFrom:null,dateTo:null},h=await fixture(t,query);
 await settle(()=>h.deliver({ok:true,noteId:'tester',rows:[],total:0,historySummary:{confirmedRemoved:1,unknownDecrease:48,unresolvedCandidates:0,savedPeople:1486}}));
 await h.click(h.w.document.querySelector('.mis2-history-summary a'));await settle(()=>h.w.dispatchEvent(new h.w.Event('blur')));
 const markerKey=h.w.sessionStorage.key(0);h.w.localStorage.setItem(tokenKey,'token-b');await h.render(h.Component,{});await settle();assert.equal(h.calls.length,2);await settle(()=>h.deliver({ok:true,noteId:'other',rows:[],total:0}));
 await settle(()=>{h.w.dispatchEvent(new h.w.Event('focus'));h.w.dispatchEvent(new h.w.Event('pageshow'))});assert.equal(h.calls.length,2);assert.ok(h.w.sessionStorage.getItem(markerKey),'元の本人の未消費指示を他の本人が消費しない');
});

test('明示照合から戻る前の遅い応答は結果を復活させず、新しい読取を重複させない',async t=>{
 const query={action:'events',window:'all',query:'',page:1,pageSize:50,direction:'followers',change:'removed',dateFrom:null,dateTo:null},h=await fixture(t,query);
 await settle(()=>h.deliver({ok:true,noteId:'tester',rows:[],total:0,historySummary:{confirmedRemoved:1,unknownDecrease:48,unresolvedCandidates:441,savedPeople:1486}}));
 await h.poll();const old=h.pending();assert.equal(h.calls.length,2);
 await h.click(h.w.document.querySelector('.mis2-history-summary a'));await settle(()=>h.w.dispatchEvent(new h.w.Event('blur')));await settle(()=>h.w.dispatchEvent(new h.w.Event('focus')));assert.equal(h.calls.length,3);
 const current=h.pending();await settle(()=>old({ok:true,noteId:'tester',rows:[],total:0,historySummary:{confirmedRemoved:1,unknownDecrease:48,unresolvedCandidates:441,savedPeople:1486}}));
 await settle(()=>h.w.dispatchEvent(new h.w.Event('pageshow')));assert.equal(h.calls.length,3,'旧応答の完了で新しい通信の重複防止を消さない');
 await settle(()=>current({ok:true,noteId:'tester',rows:[],total:0,historySummary:{confirmedRemoved:1,unknownDecrease:48,unresolvedCandidates:0,savedPeople:1486}}));assert.match(h.w.document.querySelector('.mis2-history-summary').textContent,/関係未確認0人/);
});

test('範囲外検知より前の最新肯定確認も未確認・減少へ戻さず、後日確認とは表示しない',async t=>{
 const query={action:'investigation',window:'all',query:'',page:1,pageSize:50,direction:'followers',change:'removed',dateFrom:null,dateTo:null},h=await fixture(t,query),event={...detailPerson,id:'resolved-older-positive',event_type:'removed',identity_exact:false,evidence:'window_candidate',candidate_resolved:true,source:'saved_archive',detected_at:'2026-10-27T00:00:00Z',evidence_window_start:'2026-09-01T00:00:00Z',current_is_following:true,current_is_follower:true,current_relation:'mutual',current_following_verified_at:'2026-09-26T00:00:00Z',current_follower_verified_at:'2026-09-26T00:00:00Z',current_direction_verified_at:'2026-09-26T00:00:00Z'};
 await settle(()=>h.deliver({ok:true,noteId:'tester',rows:[event],total:1}));const article=h.w.document.querySelector('.mis2-list article');assert.match(article.textContent,/保存関係で確認済み|最新確認：相互フォロー/);assert.match(article.textContent,/相手からのフォロー確認 2026\/9\/26 09:00/);assert.doesNotMatch(article.textContent,/その後|後日|候補・未確定|範囲外・要確認|【減】|関係終了を検知/);assert.equal(article.querySelector('em'),null);
});

test('人物一覧でも保存済みの最新関係と方向別の確認日時を表示する',async t=>{
 const h=await fixture(t,detailQuery);await settle(()=>h.deliver({ok:true,noteId:'tester',rows:[{...detailPerson,...freshMutual}],total:1}));const article=h.w.document.querySelector('.mis2-list article');assert.match(article.textContent,/最新確認：相互フォロー/);assert.match(article.textContent,/相手からのフォロー確認 2026\/10\/28 09:00/);assert.match(article.textContent,/過去の保存/);assert.doesNotMatch(article.textContent,/最新の関係：未確認|その後|再フォロー/);
});
