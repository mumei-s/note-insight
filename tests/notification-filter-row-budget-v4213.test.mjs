import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

const source=readFileSync(process.env.FILTER_ROW_BUDGET_SOURCE||'public/note-insight-notification-filter-v4.js','utf8');
const FIL='mumei_insight_magazine_filter_enabled_v3:tester',GRP='mumei_insight_notification_groups_v1:tester',PRO='mumei_insight_magazine_mute_profiles_v5:tester';
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(check,message){for(let i=0;i<100;i++){if(check())return;await pause(10)}assert.ok(check(),message)}
const row=i=>`<li class="m-navbarNoticeItem" id="n${i}"><a href="/actor">架空の人物</a>さんが共同マガジンに新しい記事を1本追加しました<time>2分前</time></li>`;
const avatar=id=>`<a href="/${id}"><img alt=""></a>`,avatars=[avatar('actor'),...Array.from({length:7},(_,i)=>avatar('unregistered_'+i))].join('');
const unknown=i=>`<li class="m-navbarNoticeItem" id="n${i}">${avatars}現在の架空の人物さん他46名が共同マガジンに新しい記事を52本追加しました<time>2分前</time></li>`;
function fixture(t,{count=12,body,unresolved=false,ids=unresolved?['actor',...Array.from({length:105},(_,i)=>'known_'+i)]:['actor'],profileReply=id=>'別の架空の人物'+id}={}){
 const dom=new JSDOM('<!doctype html><html><body><ul id="panel" class="notificationList" style="height:420px;overflow:auto">'+(body??Array.from({length:count},(_,i)=>(unresolved?unknown:row)(i)).join(''))+'</ul></body></html>',{url:'https://note.com/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;t.after(()=>w.close());const panel=w.document.getElementById('panel'),values=new Map([[FIL,true],[GRP,[{enabled:true,ids}]],[PRO,ids.map(id=>({id,name:id==='actor'?'架空の人物':'既知の架空の人物'+id}))]]),measure={passes:0,rowScans:0,contains:0,classifications:0,creatorScans:0,gmReads:0,requests:0,profileRequests:0},urls=[];let gate=null;
 const native=w.Node.prototype.contains;w.Node.prototype.contains=function(...args){measure.contains++;return native.apply(this,args)};
 w.HTMLElement.prototype.getBoundingClientRect=()=>({top:80,bottom:140,left:0,right:360,width:360,height:60});
 w.GM={getValue:async(k,d)=>{measure.gmReads++;if(k===FIL&&gate){const active=gate;gate=null;active.started=true;await active.promise}return values.get(k)??d},setValue:async(k,v)=>values.set(k,v)};
 w.fetch=async url=>{measure.requests++;urls.push(String(url));if(String(url)==='/api/v2/current_user')return Response.json({data:{urlname:'tester'}});measure.profileRequests++;const id=String(url).split('/').at(-1);return Response.json({data:{nickname:profileReply(id),urlname:id}})};
 w.__mumeiNotificationReaderV4={findPanel:()=>panel};w.__rowBudget=measure;
 w.eval(source.replace('async function refresh(forceState=false){','async function refresh(forceState=false){window.__rowBudget.passes++;').replace('function rows(r){','function rows(r){window.__rowBudget.rowScans++;').replace('function magazineNoise(t){','function magazineNoise(t){window.__rowBudget.classifications++;').replace('function creatorLinks(el){','function creatorLinks(el){window.__rowBudget.creatorScans++;'));
 return{w,panel,values,measure,urls,api:w.__mumeiNotificationFilterV4,async settle(){await w.__mumeiNotificationFilterV4.refresh(true);await pause(250);for(const key of Object.keys(measure))measure[key]=0},append(start,n){const fragment=w.document.createDocumentFragment();for(let i=start;i<start+n;i++){const temp=w.document.createElement('div');temp.innerHTML=row(i);fragment.append(temp.firstElementChild)}panel.append(fragment)},hold(){let release;const active={promise:new Promise(resolve=>{release=resolve}),started:false,release:()=>release()};gate=active;return active}};
}

test('300件を保持した次の12件追加も一覧走査一回・新しい12件の判定だけで処理する',async t=>{
 const f=fixture(t,{count:300});await f.settle();f.append(300,12);await until(()=>f.api.getState()?.total===312,'new rows are processed');await pause(100);
 assert.equal(f.measure.passes,1);assert.equal(f.measure.rowScans,1,'候補一覧を同じ描画で取り直さない');assert.equal(f.measure.classifications,12);assert.ok(f.measure.contains<10_000,'保持件数の二乗でcontainsを比較しない: '+f.measure.contains);assert.equal(f.measure.gmReads,0);assert.equal(f.measure.requests,0);
 const before={...f.measure},own=f.w.document.createElement('div');own.id='mumei-row-budget-own';f.panel.append(own);own.remove();await pause(100);for(const key of['passes','rowScans','classifications','gmReads','requests'])assert.equal(f.measure[key],before[key],'補助要素だけの移動で一覧を再走査しない: '+key);assert.ok(f.measure.contains-before.contains<=4,'observerの所属確認だけにとどめる');
});

test('独立した通知を含む多段の外枠を消さず、単一通知の入れ子は重複させない',async t=>{
 const a=row('a'),b=row('b'),chain='<div class="m-navbarNoticeItem" id="chain"><a href="/magazine/mfictional">架空の人物さんが共同マガジンに新しい記事を1本追加しました</a></div>',keep='<li class="m-navbarNoticeItem" id="keep"><a href="/other">別の架空人物</a>さんが共同マガジンに新しい記事を1本追加しました<time>2分前</time></li>';
 const f=fixture(t,{body:'<div class="m-navbarNoticeItem" id="outer"><section class="m-navbarNoticeItem" id="nested">'+a+b+'</section>'+chain+keep+'</div>'});await f.api.refresh(true);
 assert.equal(f.api.getState().total,4);assert.equal(f.api.getState().hidden,3);for(const id of['outer','nested','keep'])assert.equal(f.w.document.getElementById(id).classList.contains('mumei-muted-v2939'),false,id);for(const id of['na','nb','chain'])assert.equal(f.w.document.getElementById(id).classList.contains('mumei-muted-v2939'),true,id);
 f.values.set(FIL,false);await f.api.refresh(true);assert.equal(f.api.getState().hidden,0);assert.equal(f.api.getState().total,4);
});

test('GM状態の応答待ちに追加された通知は、古い候補一覧を使わず同じ処理で反映する',async t=>{
 const f=fixture(t,{count:2});await f.settle();const gate=f.hold(),pending=f.api.refresh(true);await until(()=>gate.started,'GM read is held');f.append(2,12);await pause(0);gate.release();await pending;
 assert.equal(f.api.getState().total,14,'予約された次の処理を待たず追加行も判定する');assert.equal(f.api.getState().hidden,14);assert.equal(f.measure.rowScans,2,'native変更時だけ候補を取り直す');
});

test('再確認済みの未照合通知120件を再判定してもavatarを読み直さず通信しない',async t=>{
 const f=fixture(t,{count:120,unresolved:true});await f.settle();for(let i=0;i<3;i++)await f.api.refresh(true);
 assert.equal(f.measure.classifications,0);assert.equal(f.measure.creatorScans,0,'同じnative行の登録候補をキャッシュする');assert.equal(f.measure.requests,0);assert.equal(f.measure.rowScans,3);assert.ok(f.measure.contains<25_000,'候補の全組合せを比較しない: '+f.measure.contains);assert.equal(f.api.getState().unresolved,120);
});

test('avatarのhref変更と登録ID変更は、キャッシュした候補を取り替えて再確認する',async t=>{
 const f=fixture(t,{count:1,unresolved:true,profileReply:id=>id==='known_0'?'現在の架空の人物':'別の架空の人物'});await f.settle();f.w.document.querySelector('#n0 a').href='/known_0';await until(()=>f.w.document.getElementById('n0').classList.contains('mumei-muted-v2939'),'changed candidate current name matches');assert.equal(f.measure.profileRequests,1);assert.equal(f.urls.at(-1),'/api/v2/creators/known_0');
 const g=fixture(t,{count:1,unresolved:true,ids:['actor'],profileReply:id=>id==='known_0'?'現在の架空の人物':'別の架空の人物'});await g.settle();g.w.document.querySelector('#n0 a').href='/known_0';await g.api.refresh(true);assert.equal(g.measure.profileRequests,0,'未登録IDを読み込まない');g.values.set(GRP,[{enabled:true,ids:['known_0']}]);g.values.set(PRO,[{id:'known_0',name:'古い既知名'}]);await g.api.refresh(true);await until(()=>g.w.document.getElementById('n0').classList.contains('mumei-muted-v2939'),'new registered candidate is used');assert.equal(g.measure.profileRequests,1);assert.equal(g.urls.at(-1),'/api/v2/creators/known_0');
});
