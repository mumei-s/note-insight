import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {JSDOM} from 'jsdom';
import * as React from 'react';
import {sceneFixture,pause} from './react-scene-fixture.mjs';

const key='mumei-notification-board:tester',tokenKey='mumei-insight-access-token';
const row=(id,extra={})=>({id:String(id),notification_type:'tip',display_category:'tip',actor_name:'相手'+id,actor_url:'https://note.com/peer'+id,actor_image_url:'https://images.test/peer.png',raw_text:'保存された本文'+id,captured_at:'2026-10-13T00:00:00Z',confirmed:false,favorite:false,...extra});
function boardFixture(t,{quota=5000000}={}){
 const d=new JSDOM('',{url:'https://mumei-s.github.io/note-insight/',storageQuota:quota}),w=d.window,writes=[];
 t.after(()=>w.close());const nativeSet=w.Storage.prototype.setItem,nativeGet=w.Storage.prototype.getItem;
 w.Storage.prototype.setItem=function(name,value){if(String(name).startsWith('mumei-notification-board:'))writes.push({key:String(name),value:String(value)});return nativeSet.call(this,name,value)};
 const source=readFileSync('src/member-insight-notifications-final.tsx','utf8'),compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const exports={},dependencies={react:React,'react/jsx-runtime':{},'react-dom':{},'./creator-avatar':{},'./insight-completion-queue':{},'./insight-account-store':{INSIGHT_TOKEN_KEY:tokenKey},'./insight-view-lifecycle':{canRetainInsightView:at=>Number(at)>0}};
 vm.runInNewContext(compiled+'\nexports.boardFixture={readBoard,retainBoard,filterBoard,views:NOTIFICATION_VIEW_CACHE};',{exports,require:name=>dependencies[name]||{},window:w,document:w.document,localStorage:w.localStorage,location:w.location,URL,URLSearchParams,Date});
 return{w,writes,...exports.boardFixture,nativeGet:name=>nativeGet.call(w.localStorage,name),seed:(name,value)=>nativeSet.call(w.localStorage,name,value)};
}

test('同じ通知boardと空の新着を繰り返しても保存を増やさず、内容変更は保存する',t=>{
 const h=boardFixture(t),first=row('1',{meta:{body:'本文',evidence:{source:'そのまま残す'}}});
 h.retainBoard('tester',[first]);for(let i=0;i<35;i++)h.retainBoard('tester',[structuredClone(first)]);h.retainBoard('tester',[]);
 assert.equal(h.writes.length,1,'同じ最大2000件のboardを全カテゴリ/新着ごとに書き直さない');
 h.retainBoard('tester',[{...first,confirmed:true,favorite:true,raw_text:'更新された本文',meta:{body:'更新本文',evidence:{source:'そのまま残す'}}}]);
 assert.equal(h.writes.length,2);
 const saved=JSON.parse(h.nativeGet(key))[0];assert.equal(saved.confirmed,true);assert.equal(saved.favorite,true);assert.equal(saved.raw_text,'更新された本文');assert.deepEqual(saved.meta,{body:'更新本文',evidence:{source:'そのまま残す'}});
});

test('同じboardの保存を省いても表示キャッシュの分類・対応状況は更新する',t=>{
 const h=boardFixture(t),r=row('1',{confirmed:true});h.retainBoard('tester',[r]);
 h.views.set('tester|tip||1|pending',{rows:[{...r,confirmed:false}],total:1});
 h.views.set('tester|tip||1|completed',{rows:[],total:1});
 h.retainBoard('tester',[r]);
 assert.equal(h.writes.length,1);assert.equal(h.views.get('tester|tip||1|pending').rows.length,0);assert.equal(h.views.get('tester|tip||1|completed').rows[0].confirmed,true);
});

test('未取得分類の部分表示はMap順ではなく最後に確認した同一通知の本文を使う',t=>{
 const h=boardFixture(t),old=row('1',{raw_text:'以前に確認した本文'}),latest={...old,raw_text:'今回確認した最新本文',meta:{reply_body:'最新の実本文'}};
 h.seed(tokenKey,'current-token');
 h.views.set('tester|all||1|all',{rows:[old],cachedAt:100,token:'current-token'});
 h.views.set('tester|tip||1|pending',{rows:[old],cachedAt:150,token:'current-token'});
 h.views.set('tester|all||1|all',{rows:[latest],cachedAt:200,token:'current-token'});
 h.views.set('other|all||1|all',{rows:[{...latest,raw_text:'別の本人'}],cachedAt:999,token:'current-token'});
 h.views.set('tester|tip||1|completed',{rows:[{...latest,raw_text:'別のsession'}],cachedAt:999,token:'old-token'});
 const partial=h.filterBoard('tester','tip','');
 assert.equal(partial.length,1);assert.equal(partial[0].raw_text,'今回確認した最新本文');assert.equal(partial[0].meta.reply_body,'最新の実本文');
});

test('実容量超過でも元の通知・本人tokenを残し、容量回復後は同じ内容を再保存する',t=>{
 const h=boardFixture(t,{quota:3000}),old=row('old',{confirmed:true,favorite:true,meta:{original:'保持'}});
 h.seed(tokenKey,'saved-member-token');h.retainBoard('tester',[old]);const previous=h.nativeGet(key);
 h.seed('unrelated','x'.repeat(2000));const incoming=row('new',{raw_text:'新しい本文'.repeat(90),meta:{body_ast:{children:[{value:'原文'.repeat(100)}]},unknown:{deep:'切り捨てない'}}});
 h.retainBoard('tester',[incoming]);
 assert.equal(h.nativeGet(key),previous,'失敗前の永続履歴を削除/縮小しない');assert.equal(h.nativeGet(tokenKey),'saved-member-token');
 assert.equal(h.readBoard('tester').length,2,'このタブの取得した行も維持する');
 h.w.localStorage.removeItem('unrelated');h.retainBoard('tester',[incoming]);
 const saved=JSON.parse(h.nativeGet(key));assert.equal(saved.length,2);assert.equal(saved.find(r=>r.id==='old').confirmed,true);assert.equal(saved.find(r=>r.id==='old').favorite,true);assert.deepEqual(saved.find(r=>r.id==='new').meta,incoming.meta);
 assert.equal(h.writes.length,3,'quota失敗を保存成功として記録せず再試行する');
});

test('別タブの更新や明示削除後は同一メモリーboardでも永続値を再確認する',t=>{
 const h=boardFixture(t),r=row('1');h.retainBoard('tester',[r]);
 h.seed(key,'[]');h.retainBoard('tester',[r]);assert.equal(JSON.parse(h.nativeGet(key)).length,1);
 h.w.localStorage.removeItem(key);h.retainBoard('tester',[r]);assert.equal(JSON.parse(h.nativeGet(key)).length,1);assert.equal(h.writes.length,3);
});

test('2000件上限でも保持する各通知の本文・メタ・対応済み・★を切り詰めない',t=>{
 const h=boardFixture(t),rows=Array.from({length:2010},(_,i)=>row(i,{captured_at:new Date(Date.parse('2026-10-13T00:00:00Z')+i*1000).toISOString(),confirmed:i%2===0,favorite:i%3===0,meta:{nested:{exact:'原データ'+i}}}));
 h.retainBoard('tester',rows);const saved=JSON.parse(h.nativeGet(key));
 assert.equal(saved.length,2000);assert.equal(saved[0].id,'2009');assert.equal(saved.at(-1).id,'10');
 const r=saved.find(r=>r.id==='12');assert.equal(r.confirmed,true);assert.equal(r.favorite,true);assert.deepEqual(r.meta,{nested:{exact:'原データ12'}});
});

test('baseからpreview順でまとめても重複通知の最新内容と以前のアイコンを維持する',t=>{
 const sequential=boardFixture(t),batched=boardFixture(t),prior=row('1',{actor_image_url:'https://images.test/known.png',meta:{original:'前回'}}),base={...row('1'),actor_image_url:null,raw_text:'base本文',meta:{source:'base'}},preview={...base,confirmed:true,favorite:true,raw_text:'preview本文',meta:{source:'preview',unknown:{exact:'そのまま'}}};
 sequential.retainBoard('tester',[prior]);batched.retainBoard('tester',[prior]);
 sequential.retainBoard('tester',[base]);sequential.retainBoard('tester',[preview]);batched.retainBoard('tester',[base,preview]);
 assert.equal(batched.nativeGet(key),sequential.nativeGet(key));const saved=JSON.parse(batched.nativeGet(key))[0];
 assert.equal(saved.raw_text,'preview本文');assert.equal(saved.actor_image_url,'https://images.test/known.png');assert.equal(saved.confirmed,true);assert.equal(saved.favorite,true);assert.deepEqual(saved.meta,preview.meta);
});

test('feedのカテゴリpreviewをまとめ、同じfeedの再確認ではboardの保存を繰り返さない',async t=>{
 const a=row('a'),b=row('b',{notification_type:'purchase',display_category:'purchase'}),c=row('c',{notification_type:'badge',display_category:'badge'}),boardWrites=[];
 const h=await sceneFixture(t,{globals:{URLSearchParams},dependencies:{'./creator-avatar':{CreatorAvatar:()=>React.createElement('span'),creatorNoteId:()=>''},'./insight-account-store':{INSIGHT_TOKEN_KEY:tokenKey,currentStoredInsightAccount:()=>({noteId:'tester'})}},fetch:async(url,init)=>{
  const body=JSON.parse(init.body);
  if(body.action==='recent')return Response.json({ok:true,noteId:'tester',rows:[]});
  if(String(url).includes('creator-icons'))return Response.json({items:[]});
  return Response.json({ok:true,noteId:'tester',rows:[a],total:3,categoryCounts:{all:3,tip:1,purchase:1,badge:1},categoryPreview:{tip:[a],purchase:[b],badge:[c]}});
 }});
 const nativeSet=h.w.Storage.prototype.setItem;h.w.Storage.prototype.setItem=function(name,value){if(name===key)boardWrites.push(String(value));return nativeSet.call(this,name,value)};
 h.w.localStorage.setItem(tokenKey,'fixture');h.w.localStorage.setItem('mumei-notification-reclassify-version:tester','action-v28-context:evidence-v2-articles');
 const Component=h.load('src/member-insight-notifications-final.tsx').MemberInsightNotificationsFinal;
 await h.render(Component,{noteId:'tester'});await React.act(async()=>{for(let i=0;i<6;i++)await pause()});
 assert.equal(boardWrites.length,1,'baseと全previewを1回保存し、空recent/同値アイコン結果は書き込まない');
 assert.deepEqual(JSON.parse(h.w.localStorage.getItem(key)).map(r=>r.id).sort(),['a','b','c']);
 await h.render(Component,{noteId:'tester',revision:1});await React.act(async()=>{for(let i=0;i<6;i++)await pause()});
 assert.equal(boardWrites.length,1);assert.match(h.w.document.querySelector('.minf-list').textContent,/保存された本文a/);
});

test('通知の再取得で欠落・空本文が届いても同一コメントの保存本文を保持する',t=>{
 const h=boardFixture(t),r=row('reply',{member_id:'a',notification_type:'reply',comment_identity:{articleKey:'n1',commentKey:'nc1'},meta:{comment_body:'取得済み原文',comment_key:'nc1',comment_author:'相手'},confirmed:true,favorite:true});h.retainBoard('tester',[r]);
 h.views.set('tester|all||1|all',{rows:[r],total:1});h.retainBoard('tester',[{...r,meta:{comment_body:''},comment_body:null}]);
 assert.equal(h.readBoard('tester')[0].meta.comment_body,'取得済み原文');assert.equal(h.views.get('tester|all||1|all').rows[0].meta.comment_body,'取得済み原文');assert.equal(JSON.parse(h.nativeGet(key))[0].favorite,true);
 h.retainBoard('tester',[{...r,member_id:'b',meta:{},comment_body:''}]);assert.equal(h.readBoard('tester')[0].meta.comment_body,undefined,'別本人に本文を移さない');
});
test('同一通知でも別comment IDへ変われば旧本文を流用しない',t=>{
 const h=boardFixture(t),r=row('reply',{notification_type:'reply',comment_identity:{articleKey:'n1',commentKey:'nc1'},meta:{comment_body:'別コメントの本文',comment_key:'nc1'}});h.retainBoard('tester',[r]);h.retainBoard('tester',[{...r,comment_identity:{articleKey:'n1',commentKey:'nc2'},meta:{comment_key:'nc2'}}]);assert.equal(h.readBoard('tester')[0].meta.comment_body,undefined);
});

test('部分的な会話再取得や削除表示で保存済み発言を失わず別threadは混ぜない',t=>{
 const h=boardFixture(t),conversation={articleKey:'n1',threadKey:'root',complete:false,messages:[{commentKey:'root',parentKey:null,body:'自分の原文'},{commentKey:'nc1',parentKey:'root',body:'相手の原文'}]},r=row('reply',{notification_type:'reply',comment_identity:{articleKey:'n1',commentKey:'nc1'},meta:{comment_body:'相手の原文',comment_key:'nc1',comment_conversation:conversation}});h.retainBoard('tester',[r]);
 h.retainBoard('tester',[{...r,meta:{comment_body:'[deleted]',comment_key:'nc1',comment_conversation:{...conversation,messages:[{commentKey:'nc1',parentKey:'root',body:''}]}}}]);const saved=h.readBoard('tester')[0];assert.equal(saved.meta.comment_body,'相手の原文');assert.deepEqual(Array.from(saved.meta.comment_conversation.messages,m=>m.body),['自分の原文','相手の原文']);
 h.retainBoard('tester',[{...r,meta:{comment_body:'別の内容',comment_key:'nc1',comment_conversation:{...conversation,threadKey:'other',messages:[{commentKey:'nc1',parentKey:'other',body:'別の内容'}]}}}]);assert.equal(h.readBoard('tester')[0].meta.comment_conversation.messages.length,1);
});

test('identity欠落でもURL・meta記事IDの訂正先へ旧本文を流用せず、単なるlocator欠落なら保持する',t=>{
 for(const change of [{target_url:'https://note.com/owner/n/n2?c=nc1'},{meta:{article_key:'n2'}},{target_url:'https://note.com/owner/n/n1?c=nc2'}]){
 const h=boardFixture(t),r=row('reply',{notification_type:'reply',target_url:'https://note.com/owner/n/n1?c=nc1',comment_identity:null,meta:{article_key:'n1',comment_key:'nc1',comment_body:'旧対象の本文'}});h.retainBoard('tester',[r]);h.retainBoard('tester',[{...r,meta:{},...change}]);assert.equal(h.readBoard('tester')[0].meta.comment_body,undefined);
 }
 const h=boardFixture(t),r=row('reply',{notification_type:'reply',target_url:'https://note.com/owner/n/n1?c=nc1',meta:{comment_body:'保持する本文'}});h.retainBoard('tester',[r]);h.retainBoard('tester',[{...r,target_url:null,meta:{}}]);assert.equal(h.readBoard('tester')[0].meta.comment_body,'保持する本文');
});

test('記事から明示された非記事URLへの変更とcamelCaseのidentity訂正へ旧本文を運ばない',t=>{
 for(const change of [{target_url:'https://note.com/owner/membership/posts/123',meta:{}},{target_url:null,meta:{articleKey:'nB',commentKey:'ncA'}},{target_url:null,meta:{articleKey:'nA',commentKey:'ncB'}}]){
 const h=boardFixture(t),r=row('reply',{notification_type:'reply',target_url:'https://note.com/owner/n/nA?c=ncA',comment_identity:{articleKey:'nA',commentKey:'ncA'},meta:{comment_body:'記事の原文'}});h.retainBoard('tester',[r]);h.retainBoard('tester',[{...r,comment_identity:null,...change}]);const current=h.readBoard('tester')[0];assert.equal(current.meta.comment_body,undefined);assert.equal(current.comment_identity,null);
 }
});

test('保存直後の遅い単発本文feedで証明済みroot会話を単発へ巻き戻さない',t=>{
 const h=boardFixture(t),conversation={articleKey:'nA',threadKey:'root',complete:false,messages:[{commentKey:'root',parentKey:null,body:'自分の本文'},{commentKey:'ncA',parentKey:'root',body:'返信本文'}]},r=row('reply',{notification_type:'reply',comment_identity:{articleKey:'nA',commentKey:'ncA'},meta:{comment_body:'返信本文',comment_conversation:conversation}});h.retainBoard('tester',[r]);h.views.set('tester|all||1|all',{rows:[r],total:1});
 h.retainBoard('tester',[{...r,meta:{comment_body:'返信本文',comment_conversation:{articleKey:'nA',threadKey:null,complete:false,messages:[{commentKey:'ncA',parentKey:null,body:'返信本文'}]}}}]);
 for(const saved of [h.readBoard('tester')[0],h.views.get('tester|all||1|all').rows[0],JSON.parse(h.nativeGet(key))[0]]){assert.equal(saved.meta.comment_conversation.threadKey,'root');assert.equal(saved.meta.comment_conversation.messages.length,2)}
});
