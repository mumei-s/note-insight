import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as React from 'react';
import * as jsx from 'react/jsx-runtime';
import {sceneFixture,pause} from './react-scene-fixture.mjs';

const source=ts.createSourceFile('member-insight-notifications-final.tsx',readFileSync(process.env.NOTIFICATION_COMMENT_REPRO_SOURCE||'src/member-insight-notifications-final.tsx','utf8'),ts.ScriptTarget.ES2022,true,ts.ScriptKind.TSX);
const functions=new Map(source.statements.filter(ts.isFunctionDeclaration).filter(node=>node.name).map(node=>[node.name.text,node]));
function componentSource(){
 const names=new Set(),nodes=[];
 function include(name){if(names.has(name)||name==='post'||name==='href')return;const node=functions.get(name);if(!node)return;names.add(name);ts.forEachChild(node,function visit(child){if(ts.isIdentifier(child)&&functions.has(child.text))include(child.text);ts.forEachChild(child,visit)});nodes.push(node.getText(source))}
 include('NotificationComment');assert.ok(names.has('NotificationComment'),'実NotificationComment関数を抽出する');return nodes.join('\n');
}
const row=(change={})=>({id:'same-notification',member_id:'member-a',notification_type:'reply',comment_identity:{articleKey:'article-a',commentKey:'comment-a',url:'https://note.com/owner/n/article-a#comment-a'},meta:{comment_key:'comment-a',all_area_url:'https://note.com/owner/n/article-a#all',featured_area_url:'https://note.com/owner/n/article-a#featured'},target_url:'https://note.com/owner/n/article-a',source_url:'https://note.com/owner/n/article-a#source',...change});
const result=(body='取得した本文A')=>({ok:true,body,articleKey:'article-a',commentKey:'comment-a',url:'https://note.com/owner/n/article-a#comment-a',author:'本人確認済みの投稿者'});
async function settle(work=()=>{}){await React.act(async()=>{work();for(let i=0;i<5;i++)await pause()})}
async function fixture(t,initial=row()){
 const h=await sceneFixture(t),calls=[],saved=[];h.w.localStorage.setItem('fixture-token','token-a');
 const exports={},scope={exports,require:name=>{assert.equal(name,'react/jsx-runtime');return jsx},React,...Object.fromEntries(Object.entries(React).filter(([name])=>/^use[A-Z]/.test(name))),window:h.w,document:h.w.document,location:h.w.location,localStorage:h.w.localStorage,AbortController,INSIGHT_TOKEN_KEY:'fixture-token',href:r=>r.target_url||r.all_area_url||r.featured_area_url||'',post:(body,signal)=>new Promise((resolve,reject)=>calls.push({body,signal,resolve,reject}))};
 vm.runInNewContext(ts.transpileModule(componentSource()+'\nexports.Component=NotificationComment;',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,scope);
 const render=r=>h.render(exports.Component,{row:r,onSaved:patch=>saved.push(patch)});await render(initial);
 return{...h,calls,saved,render,text:()=>h.w.document.body.textContent,open:()=>React.act(async()=>{h.w.document.querySelector('details').open=true;await new Promise(resolve=>h.w.setTimeout(resolve,0));await pause()}),resolve:(i,value=result())=>settle(()=>calls[i].resolve(value)),reject:i=>settle(()=>calls[i].reject(new Error('OLD_LOOKUP_FAILED'))),unmount:()=>h.render(()=>null,{})};
}

test('同じ通知ID・locatorの空props再同期は取得済み本文を保持し追加lookupしない',async t=>{
 const initial=row(),h=await fixture(t,initial);await h.open();assert.equal(h.calls.length,1);await h.resolve(0);assert.match(h.text(),/取得した本文A/);
 await h.render({...initial,meta:{...initial.meta},comment_identity:{...initial.comment_identity},comment_body:'',reply_body:''});assert.match(h.text(),/取得した本文A/);assert.equal(h.calls.length,1);assert.equal(h.saved.length,1);
});

test('同IDでも各locatorが変われば旧本文を消し、開いたdetailsで新lookupを自動開始する',async t=>{
 const changes=[['identity.commentKey',r=>({...r,comment_identity:{...r.comment_identity,commentKey:'comment-b'}})],['identity.articleKey',r=>({...r,comment_identity:{...r.comment_identity,articleKey:'article-b'}})],['identity.url',r=>({...r,comment_identity:{...r.comment_identity,url:'https://note.com/other/n/b#reply'}})],['comment_key',r=>({...r,comment_key:'comment-b'})],['member_id',r=>({...r,member_id:'member-b'})],...['comment_key','all_area_url','featured_area_url'].map(field=>['meta.'+field,r=>({...r,meta:{...r.meta,[field]:'changed-'+field}})]),...['target_url','source_url'].map(field=>[field,r=>({...r,[field]:'https://note.com/other/n/b#'+field})])];
 for(const [name,change]of changes){
  const initial=row(),h=await fixture(t,initial);await h.open();await h.resolve(0);const details=h.w.document.querySelector('details');await h.render(change(initial));
  assert.equal(h.w.document.querySelector('details'),details,name);assert.equal(details.open,true,name);assert.doesNotMatch(h.text(),/取得した本文A/,name);assert.equal(h.calls.length,2,name);assert.equal(h.calls[1].body.action,'comment_detail',name);assert.equal(h.calls[1].body.id,initial.id,name);assert.equal(h.calls[1].signal?.aborted,false,name);
  await h.resolve(1,result('locator変更後の本文'));assert.match(h.text(),/locator変更後の本文/,name);await h.unmount();
 }
});

test('A→B→Aの古い成功応答は新しいA本文とonSavedを汚染しない',async t=>{
 const a=row(),b=row({comment_identity:{...a.comment_identity,commentKey:'comment-b'}}),h=await fixture(t,a);await h.open();await h.render(b);await h.render(a);assert.equal(h.calls.length,3);assert.equal(h.calls[0].signal?.aborted,true);assert.equal(h.calls[1].signal?.aborted,true);
 await h.resolve(2,result('今回のA本文'));await h.resolve(0,result('古いA本文'));await h.resolve(1,result('古いB本文'));assert.match(h.text(),/今回のA本文/);assert.doesNotMatch(h.text(),/古いA本文|古いB本文/);assert.deepEqual(h.saved.map(patch=>patch.comment_body),['今回のA本文']);
});

test('A→B→Aの古い失敗は新要求のbusyや成功本文を上書きしない',async t=>{
 const a=row(),h=await fixture(t,a);await h.open();await h.render(row({target_url:'https://note.com/other/n/b'}));await h.render(a);assert.equal(h.calls.length,3);
 await h.reject(0);assert.ok(h.w.document.querySelector('[aria-busy="true"]'));assert.doesNotMatch(h.text(),/もう一度読み込めます/);await h.resolve(2,result('今回の成功本文'));await h.reject(1);assert.match(h.text(),/今回の成功本文/);assert.doesNotMatch(h.text(),/もう一度読み込めます/);assert.deepEqual(h.saved.map(patch=>patch.comment_body),['今回の成功本文']);
});

test('本人token切替とunmount後の遅い成功は本文・onSavedへ採用しない',async t=>{
 for(const mode of ['token','unmount']){
  const initial=row(),h=await fixture(t,initial);await h.open();if(mode==='token'){h.w.localStorage.setItem('fixture-token','token-b');await h.render({...initial})}else await h.unmount();
  assert.equal(h.calls[0].signal?.aborted,true,mode);await h.resolve(0,result('旧本人の本文'));assert.doesNotMatch(h.text(),/旧本人の本文/,mode);assert.equal(h.saved.length,0,mode);await h.unmount();
 }
});

test('掲示板の通知raw_textや汎用meta.bodyを返信本文にせず専用本文だけ表示する',async t=>{
 const initial=row({notification_type:'membership_board_reply',display_category:'membership_board_reply',raw_text:'通知案内だけの文章',meta:{comment_key:'comment-a',body:'通知案内だけの文章',source:'note-notification-dom'}}),h=await fixture(t,initial);assert.doesNotMatch(h.text(),/通知案内だけの文章/);await h.open();await h.resolve(0,{ok:true,body:'',status:'missing_id'});assert.doesNotMatch(h.text(),/通知案内だけの文章/);assert.match(h.text(),/掲示板の本文はまだ取得/);assert.equal(h.saved.length,0);
 await h.render({...initial,meta:{...initial.meta,comment_body:'取得確認済みの掲示板返信'}});assert.match(h.text(),/取得確認済みの掲示板返信/);assert.equal(h.calls.length,1);
});

test('保存済み本文は即時表示し、明示した会話確認が失敗しても残す',async t=>{
 const h=await fixture(t,row({meta:{comment_key:'comment-a',comment_body:'保存済み本文'}}));await h.open();assert.equal(h.calls.length,0);assert.match(h.text(),/保存済み本文/);
 await settle(()=>h.w.document.querySelector('button').click());assert.equal(h.calls.length,1);assert.match(h.text(),/保存済み本文/);await h.reject(0);assert.match(h.text(),/保存済み本文/);assert.match(h.text(),/保存済みの内容は保持/);
});
test('削除などで本文が取得できなくても保存済み本文を空にしない',async t=>{
 const h=await fixture(t,row({meta:{comment_key:'comment-a',comment_body:'消してはいけない本文'}}));await h.open();await settle(()=>h.w.document.querySelector('button').click());await h.resolve(0,{ok:true,body:null,status:'unavailable'});assert.match(h.text(),/消してはいけない本文/);assert.equal(h.saved[0].comment_body,'消してはいけない本文');
});
test('旧通知のmissing_idは再試行ボタンと再開時の無意味な要求を出さない',async t=>{
 const h=await fixture(t,row({comment_identity:null,meta:{}}));await h.open();await h.resolve(0,{ok:true,status:'missing_id',body:null});assert.match(h.text(),/会話を特定できません/);assert.equal(h.w.document.querySelector('button'),null);
 await settle(()=>{h.w.document.querySelector('details').open=false});await h.open();assert.equal(h.calls.length,1);
});
test('確実な同一threadだけを時系列の自分・相手の吹き出しにする',async t=>{
 const h=await fixture(t);await h.open();await h.resolve(0,{...result('返信本文'),conversation:{articleKey:'article-a',threadKey:'root',complete:false,messages:[{commentKey:'comment-a',parentKey:'root',body:'相手の返信',author:'相手',isSelf:false,occurredAt:'2026-10-23T00:02:00Z'},{commentKey:'root',parentKey:null,body:'自分のコメント',author:'自分',isSelf:true,occurredAt:'2026-10-23T00:01:00Z'},{commentKey:'unrelated',parentKey:'different',body:'混ぜない本文',author:'相手',occurredAt:'2026-10-23T00:03:00Z'}]}});
 const bubbles=[...h.w.document.querySelectorAll('.minf-message')];assert.equal(bubbles.length,2);assert.match(bubbles[0].textContent,/自分のコメント/);assert.ok(bubbles[0].classList.contains('self'));assert.match(bubbles[1].textContent,/相手の返信/);assert.doesNotMatch(h.text(),/混ぜない本文/);
});

test('対象コメントがthreadへ繋がらない時は無関係なrootだけを会話にしない',async t=>{
 for(const [parentKey,rootParent] of [['other',null],['root','other']]){
 const h=await fixture(t);await h.open();await h.resolve(0,{...result('対象だけの本文'),conversation:{articleKey:'article-a',threadKey:'root',complete:false,messages:[{commentKey:'comment-a',parentKey,body:'対象だけの本文'},{commentKey:'root',parentKey:rootParent,body:'不正なroot本文'}]}});
 assert.match(h.text(),/対象だけの本文/);assert.doesNotMatch(h.text(),/不正なroot本文/);await h.unmount();
 }
});
