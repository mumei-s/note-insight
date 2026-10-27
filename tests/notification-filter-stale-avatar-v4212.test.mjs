import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

const source=readFileSync(process.env.FILTER_STALE_AVATAR_SOURCE||'public/note-insight-notification-filter-v4.js','utf8');
const FIL='mumei_insight_magazine_filter_enabled_v3:',GRP='mumei_insight_notification_groups_v1:',PRO='mumei_insight_magazine_mute_profiles_v5:';
const ids=['actor',...Array.from({length:105},(_,i)=>'known_'+i)],oldName='架空の以前の名前',newName='架空の現在の名前';
const added='さん他46名が架空の共同作品棚【...に新しい記事を52本追加しました';
const avatar=id=>`<a href="/${id}"><img alt=""></a>`,avatars=visible=>visible.map(avatar).join('');
const visibleIds=['actor',...Array.from({length:7},(_,i)=>'unregistered_'+i)];
const row=(name=newName,action=added,visible=visibleIds)=>`<li id="target" class="m-navbarNoticeItem">${avatars(visible)}${name}${action}<time>2分前</time></li>`;
const knownProfiles=name=>ids.map(id=>({id,name:id==='actor'?name:'既知の架空人物 '+id}));
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(check,message){for(let i=0;i<100;i++){if(check())return;await pause(10)}assert.ok(check(),message)}
function fixture(t,{mode='modern',body=row(),enabled=true,folder=true}={}){
 const dom=new JSDOM('<!doctype html><html><body><ul id="panel" class="notificationList" style="height:420px;overflow:auto">'+body+'</ul></body></html>',{url:'https://note.com/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;t.after(()=>w.close());
 const values=new Map([[FIL+'tester',enabled],[GRP+'tester',[{enabled:folder,ids}]],[PRO+'tester',knownProfiles(oldName)]]),calls=[],pending=[];let currentAccount='tester';
 if(mode==='modern')w.GM={getValue:async(k,d)=>values.get(k)??d,setValue:async(k,v)=>values.set(k,v)};else{w.GM_getValue=(k,d)=>values.get(k)??d;w.GM_setValue=(k,v)=>values.set(k,v)}
 w.fetch=async url=>{const value=String(url);calls.push(value);if(value==='/api/v2/current_user')return Response.json({data:{urlname:currentAccount}});if(value.startsWith('/api/v2/creators/'))return new Promise(resolve=>pending.push({id:value.split('/').at(-1),resolve}));throw Error('unexpected fixture network')};
 w.HTMLElement.prototype.getBoundingClientRect=()=>({top:80,bottom:140,left:0,right:360,width:360,height:60});w.__mumeiNotificationReaderV4={findPanel:()=>w.document.getElementById('panel')};w.eval(source);
 return{w,values,calls,pending,refresh:()=>w.__mumeiNotificationFilterV4.refresh(true),profiles:()=>calls.filter(u=>u.startsWith('/api/v2/creators/')),hidden:()=>w.document.getElementById('target').classList.contains('mumei-muted-v2939'),reply:(request,name)=>request.resolve(Response.json({data:{nickname:name,urlname:request.id}})),switchAccount(account,name){currentAccount=account;values.set(FIL+account,true);values.set(GRP+account,[{enabled:true,ids}]);values.set(PRO+account,knownProfiles(oldName));const old=w.document.getElementById('panel'),next=old.cloneNode(false);next.innerHTML=row(name);old.replaceWith(next)}};
}

for(const mode of ['modern','legacy'])test(`既知106人のうち画面にいる登録IDだけ再確認し、現在名を照合してから隠す (${mode})`,async t=>{
 const f=fixture(t,{mode});await f.refresh();await until(()=>f.pending.length===1,'visible registered candidate starts');
 assert.equal(f.hidden(),false,'集合avatarだけでは先頭人物の証明にしない');assert.deepEqual(f.profiles(),['/api/v2/creators/actor']);
 const original=f.w.document.getElementById('target');f.reply(f.pending[0],newName);await until(f.hidden,'current name matches the visible lead');
 assert.equal(f.w.document.getElementById('target'),original);assert.equal(f.values.get(PRO+'tester').length,106,'他の保存名を落とさない');assert.equal(f.values.get(PRO+'tester').find(p=>p.id==='actor').name,newName);
 for(let i=0;i<6;i++)await f.refresh();await pause(160);assert.equal(f.profiles().length,1,'通常再判定で同じ人物や他の105人を取り直さない');assert.equal(f.calls.filter(u=>u==='/api/v2/current_user').length,1);
});

for(const mode of ['modern','legacy'])test(`候補の現在名が先頭名と違えば表示を保ち、自動再試行せず明示切替後の一回だけ許す (${mode})`,async t=>{
 const f=fixture(t,{mode});await f.refresh();await until(()=>f.pending.length===1);f.reply(f.pending[0],'別の架空の現在名');await pause(160);assert.equal(f.hidden(),false);
 for(let i=0;i<5;i++)await f.refresh();await pause(80);assert.equal(f.profiles().length,1);
 f.values.set(FIL+'tester',false);f.w.dispatchEvent(new f.w.Event('mumei-insight-filter-refresh-v2939'));await f.refresh();assert.equal(f.hidden(),false);
 f.values.set(FIL+'tester',true);f.w.dispatchEvent(new f.w.Event('mumei-insight-filter-refresh-v2939'));await f.refresh();await until(()=>f.pending.length===2);f.reply(f.pending[1],'まだ別の架空名');await pause(160);
 for(let i=0;i<4;i++){f.w.dispatchEvent(new f.w.Event('mumei-insight-filter-refresh-v2939'));await f.refresh()}
 assert.equal(f.profiles().length,2,'一人につき一ページで自動一回と明示再試行一回まで');assert.equal(f.hidden(),false);
});

for(const mode of ['modern','legacy'])test(`既知名で先頭を照合済み、OFF、非対象通知、未登録avatarは既知106人を再取得しない (${mode})`,async t=>{
 const configurations=[
  {body:row(oldName),hidden:true},
  {enabled:false,hidden:false},
  {folder:false,hidden:false},
  {body:row(newName,added,Array.from({length:8},(_,i)=>'unregistered_'+i)),hidden:false},
  ...['さんがあなたの記事にスキしました','さんがあなたのコメントに返信しました','さんがあなたの記事を購入しました','さんが記事内であなたの記事を紹介しました','さんがあなたの記事をマガジンに追加しました'].map(action=>({body:row(newName,action),hidden:false})),
 ];
 for(const configuration of configurations){const f=fixture(t,{mode,...configuration});await f.refresh();await pause(25);assert.equal(f.hidden(),configuration.hidden);assert.equal(f.profiles().length,0,'対象でない時は再確認不要')}
});

test('複数の既知候補でも四人までを並列確認し、先頭判明後は次の候補を取り消す',async t=>{
 const visible=['actor',...Array.from({length:7},(_,i)=>'known_'+i)],f=fixture(t,{body:row(newName,added,visible)});await f.refresh();await until(()=>f.pending.length===4,'bounded first batch');assert.equal(f.profiles().length,4);assert.equal(f.pending[0].id,'actor');
 f.reply(f.pending[0],newName);await until(f.hidden,'the fast matching name applies');for(const request of f.pending.slice(1))f.reply(request,'既知の架空人物 '+request.id);await pause(160);
 assert.equal(f.profiles().length,4,'残った既知候補や他の98人を取得しない');
});

test('別アカウントの再確認予算と保存先は分け、前の遅い応答を混ぜない',async t=>{
 const f=fixture(t);await f.refresh();await until(()=>f.pending.length===1);const requestA=f.pending[0];
 f.switchAccount('other','Bの架空の現在名');await f.refresh();assert.equal(f.hidden(),false);assert.equal(f.w.__mumeiNotificationFilterV4.getState().unresolved,1);
 f.reply(requestA,'Aの架空の現在名');await until(()=>f.pending.length===2,'other account gets its own bounded recheck');assert.equal(f.values.get(PRO+'tester').find(p=>p.id==='actor').name,'Aの架空の現在名');assert.equal(f.values.get(PRO+'other').find(p=>p.id==='actor').name,oldName);
 f.reply(f.pending[1],'Bの架空の現在名');await until(f.hidden);assert.equal(f.values.get(PRO+'other').find(p=>p.id==='actor').name,'Bの架空の現在名');assert.equal(f.values.get(PRO+'tester').find(p=>p.id==='actor').name,'Aの架空の現在名');assert.equal(f.profiles().length,2);
});
