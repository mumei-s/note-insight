import test from 'node:test';
import assert from 'node:assert/strict';
import * as React from 'react';
import {sceneFixture,pause} from './react-scene-fixture.mjs';

const reply=(key,parent,body)=>({comment_key:key,parent_key:parent,is_creator:true,is_root:false,body,actor_image_url:'https://images.test/avatar.png'});
const evidence=(root,replyKey,props={})=>({rootKey:root,replyKey,counterpartName:'架空の読者',status:'creator_reply_last',exact:true,counterpartHearted:true,...props});

test('全コメントは相手の♡を最後の返信の行だけに表示し、同じ会話の照合を再発行しない',async t=>{
 let afterReply=false;
 const reads=[];
 const rows=[reply('new','root','最後の本文'),reply('old','root','前の本文'),reply('third','third-root','別人の♡だけ'),reply('reopened','reopened-root','その後に相手が返信'),{comment_key:'root',is_root:true,is_creator:false,is_creator_liked:true,body:'あなたの♡付き親コメント',actor_image_url:'https://images.test/avatar.png'}];
 const h=await sceneFixture(t,{globals:{IntersectionObserver:class{observe(){}disconnect(){}}},dependencies:{
  './creator-avatar':{CreatorAvatar:()=>React.createElement('span')},
  './insight-member-db-fallback':{memberReadAuthFailure:()=>false,memberDbReadFallback:async()=>{throw new Error('offline')}},
  './insight-persistent-cache':{readInsightSnapshot:async()=>null,writeInsightSnapshot:async()=>{}},
 },fetch:async(url,init)=>{
  if(String(url).endsWith('insight-comment-refresh'))return Response.json({ok:true,paused:true});
  if(String(url).endsWith('insight-comment-hearts')){
   reads.push(JSON.parse(init.body).rootKeys);
   return Response.json({ok:true,rows:[evidence('root','new',afterReply?{status:'counterpart_replied_after_creator',counterpartHearted:false}:{}),evidence('third-root','third',{exact:false,counterpartHearted:null}),evidence('reopened-root','reopened',{status:'counterpart_replied_after_creator'})]});
  }
  return Response.json({ok:true,total:rows.length,rows});
 }});
 h.w.localStorage.setItem('mumei-insight-access-token','test-only');
 const C=h.load('src/member-insight-comments-final.tsx').MemberInsightCommentsFinal;
 const settle=async()=>await React.act(async()=>{for(let i=0;i<8;i++)await pause()});
 await h.render(C,{noteId:'sample',revision:0});await settle();
 const badges=()=>[...h.w.document.querySelectorAll('.micf-event-heart.counterpart')];
 assert.deepEqual(reads,[['root','third-root','reopened-root']]);
 assert.equal(badges().length,1);
 assert.match(badges()[0].textContent,/架空の読者さんの♡あり/);
 assert.match(badges()[0].closest('article').textContent,/最後の本文/);
 assert.match(h.w.document.querySelector('.micf-event-heart:not(.counterpart)').textContent,/あなたの♡/);
 afterReply=true;
 await h.render(C,{noteId:'sample',revision:1});await settle();
 assert.equal(badges().length,0);
 assert.equal(reads.length,2);
});
