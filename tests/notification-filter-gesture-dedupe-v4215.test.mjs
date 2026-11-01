import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

const source=readFileSync(process.env.FILTER_GESTURE_SOURCE||'public/note-insight-notification-filter-v4.js','utf8');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(check){for(let i=0;i<80&&!check();i++)await pause(10);assert.ok(check(),'filter settles');}
const mutedRow=id=>`<li class="m-navbarNoticeItem" id="${id}"><a href="/actor">登録人物</a>さんが共同マガジンに新しい記事を1本追加しました 1分前</li>`;
const likeRow=(id,{notice='',article='n123456789abc',action='あなたの記事にスキしました',date='1分前',avatars=['a','b'],comment=''}={})=>`<li class="m-navbarNoticeItem" id="${id}" ${notice?`data-notification-id="${notice}"`:''}><a href="/writer/n/${article}${comment}">${avatars.map(a=>`<img src="https://images.example/${a}.jpg">`).join('')}<span>登録人物さん他2名が${action}</span><p>同じ記事の見出し</p><time>${date}</time></a></li>`;

function fixture(t,{initial=Array.from({length:12},(_,i)=>mutedRow('old-'+i)).join(''),mode='modern',append=true}={}){
 const dom=new JSDOM(`<body style="overflow:hidden"><ul id="list" class="notificationList" style="height:400px;overflow-y:auto">${initial}<li id="loading"></li><div class="h-px" id="sentinel"></div></ul><aside id="outside">外部</aside></body>`,{url:'https://note.com/',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window;t.after(()=>w.close());const list=w.document.getElementById('list'),loading=w.document.getElementById('loading'),sentinel=w.document.getElementById('sentinel');
 const values=new Map([['mumei_insight_magazine_filter_enabled_v3:tester',true],['mumei_insight_notification_groups_v1:tester',[{enabled:true,ids:['actor']}]],['mumei_insight_magazine_mute_profiles_v5:tester',[{id:'actor',name:'登録人物'}]]]);
 if(mode==='modern')w.GM={getValue:async(k,d)=>values.get(k)??d,setValue:async(k,v)=>values.set(k,v)};else{w.GM_getValue=(k,d)=>values.get(k)??d;w.GM_setValue=(k,v)=>values.set(k,v)}
 const measure={refreshes:0,requests:0,pages:0};w.__measure=measure;w.fetch=async()=>{measure.requests++;return Response.json({data:{urlname:'tester'}})};
 const height=el=>{if(el.hidden||w.getComputedStyle(el).display==='none')return 0;if(el.id==='mumei-notification-filter-continuation-v4')return parseFloat(el.style.minHeight)||118;if(el===sentinel)return 1;if(el===loading)return 16;return el.classList.contains('m-navbarNoticeItem')?60:0};
 Object.defineProperties(list,{clientHeight:{get:()=>400},scrollHeight:{get:()=>Math.max(400,[...list.children].reduce((n,el)=>n+height(el),0))}});
 let offset=0;Object.defineProperty(list,'scrollTop',{get:()=>offset=Math.max(0,Math.min(offset,list.scrollHeight-400)),set:v=>{offset=Math.max(0,Math.min(Number(v)||0,list.scrollHeight-400))}});
 const rect=(top,h)=>({top,bottom:top+h,left:0,right:360,width:360,height:h});w.HTMLElement.prototype.getBoundingClientRect=function(){if(this===list)return rect(100,400);if(this.parentElement===list){let top=0;for(const el of list.children){if(el===this)break;top+=height(el)}return rect(100+top-list.scrollTop,height(this))}return rect(0,60)};
 const frames=new Map();let nextFrame=0;w.requestAnimationFrame=callback=>{frames.set(++nextFrame,callback);return nextFrame};w.cancelAnimationFrame=id=>frames.delete(id);
 let lastInside=false,appended=false;
 function sample(){const bounds=sentinel.getBoundingClientRect(),inside=bounds.bottom>=-100&&bounds.top<=700;if(inside===lastInside)return;lastInside=inside;if(!inside||!append)return;measure.pages++;for(let i=0;i<12;i++)loading.insertAdjacentHTML('beforebegin',mutedRow(`page-${measure.pages}-${i}`));appended=true}
 w.__mumeiNotificationReaderV4={findPanel:()=>list};w.eval(source.replace('async function refresh(forceState=false){','async function refresh(forceState=false){window.__measure.refreshes++;'));
 async function paint(){const callbacks=[...frames.values()];frames.clear();for(const callback of callbacks)callback(Date.now());sample();if(appended){appended=false;await w.__mumeiNotificationFilterV4.refresh()}await pause(0)}
 async function framesPaint(count=5){for(let i=0;i<count;i++)await paint()}
 const ready=async()=>{await until(()=>w.__mumeiNotificationFilterV4.getState());await pause(130)};
 const end=()=>{list.scrollTop=list.scrollHeight;sample()};
 const wheel=(delta=300,target=list)=>{const e=new w.WheelEvent('wheel',{bubbles:true,cancelable:true,deltaY:delta});target.dispatchEvent(e);assert.equal(e.defaultPrevented,false)};
 const touch=(type,y,target=list)=>{const e=new w.Event(type,{bubbles:true,cancelable:true});Object.defineProperty(e,'touches',{value:y===null?[]:[{clientY:y}]});target.dispatchEvent(e);assert.equal(e.defaultPrevented,false)};
 return{w,list,loading,sentinel,values,measure,ready,paint:framesPaint,end,wheel,touch,refresh:()=>w.__mumeiNotificationFilterV4.refresh(true),hidden:id=>w.document.getElementById(id).classList.contains('mumei-muted-v2939'),inside:()=>lastInside};
}

for(const mode of ['modern','legacy'])test(`下端の下向きスワイプはintersectingのままの公式sentinelを一度だけ再armする (${mode})`,async t=>{
 const f=fixture(t,{mode});await f.ready();f.end();assert.equal(f.measure.pages,1);await f.refresh();assert.equal(f.inside(),true);
 // Native scrolling cannot emit another IO transition after the appended page
 // collapses. A downward touch must provide that transition, without a button.
 f.list.dispatchEvent(new f.w.Event('scroll'));await f.paint();assert.equal(f.measure.pages,1);
 f.touch('touchstart',300);f.touch('touchmove',100);await f.paint();assert.equal(f.measure.pages,2);assert.equal(f.measure.requests,1);
 f.touch('touchmove',50);await f.paint();assert.equal(f.measure.pages,2,'one finger gesture cannot create an unbounded page loop');
 f.touch('touchend',null);f.end();f.touch('touchstart',300);f.touch('touchmove',100);await f.paint();assert.equal(f.measure.pages,3,'the next deliberate swipe can continue');
 assert.equal(f.sentinel,f.w.document.getElementById('sentinel'));assert.equal(f.values.get('mumei_insight_magazine_filter_enabled_v3:tester'),true);
});

test('下端のwheelだけが続きを再armし、上向き・外部操作・自動scroll・待機では増やさない',async t=>{
 const f=fixture(t);await f.ready();f.end();await f.refresh();assert.equal(f.measure.pages,1);
 f.wheel(-300);f.wheel(300,f.w.document.getElementById('outside'));f.list.dispatchEvent(new f.w.Event('scroll'));await f.paint();assert.equal(f.measure.pages,1);
 f.wheel();await f.paint();assert.equal(f.measure.pages,2);const pages=f.measure.pages;await pause(250);await f.paint();assert.equal(f.measure.pages,pages);
});

test('下端以外のスワイプやtouchmoveは通知位置を動かさず、フィルターOFFで補助処理を終了する',async t=>{
 const f=fixture(t);await f.ready();f.list.scrollTop=0;f.touch('touchstart',300);f.touch('touchmove',100);await f.paint();assert.equal(f.measure.pages,0);assert.equal(f.list.scrollTop,0);
 f.values.set('mumei_insight_magazine_filter_enabled_v3:tester',false);await f.refresh();f.end();const before=f.measure.pages;f.wheel();await f.paint();assert.equal(f.measure.pages,before);assert.equal(f.list.querySelector('#mumei-notification-filter-continuation-v4'),null);
});

test('同じ通知IDと添付例の同一groupedスキだけ重複を隠し、別記事・日時・コメント・人物群は残す',async t=>{
 const initial=[likeRow('first'),likeRow('same'),likeRow('article',{article:'nabcdef123456'}),likeRow('time',{date:'2分前'}),likeRow('avatars',{avatars:['a','c']}),likeRow('comment-a',{action:'書き手のあなたのコメントにスキしました',comment:'?c=10'}),likeRow('comment-same',{action:'書き手のあなたのコメントにスキしました',comment:'?c=10'}),likeRow('comment-b',{action:'書き手のあなたのコメントにスキしました',comment:'?c=11'}),likeRow('uncertain-comment-a',{action:'書き手のあなたのコメントにスキしました'}),likeRow('uncertain-comment-b',{action:'書き手のあなたのコメントにスキしました'}),likeRow('reply-a',{action:'あなたのコメントに返信しました'}),likeRow('reply-b',{action:'あなたのコメントに返信しました'}),likeRow('notice-a',{notice:'100'}),likeRow('notice-same',{notice:'100',date:'2分前'}),likeRow('notice-other',{notice:'101'})].join('');
 const f=fixture(t,{initial,append:false});await f.ready();
 for(const id of ['same','comment-same','notice-same'])assert.equal(f.hidden(id),true,id);
 for(const id of ['first','article','time','avatars','comment-a','comment-b','uncertain-comment-a','uncertain-comment-b','reply-a','reply-b','notice-a','notice-other'])assert.equal(f.hidden(id),false,id);
 assert.equal(f.measure.requests,1,'duplicate suppression has no additional network access');
 const before=f.measure.refreshes;await pause(250);assert.equal(f.measure.refreshes,before,'own hide operations do not loop');
 f.w.document.getElementById('first').remove();await until(()=>!f.hidden('same'));assert.equal(f.w.document.querySelectorAll('#same').length,1,'React-owned row nodes are never deleted or cloned');
 f.values.set('mumei_insight_magazine_filter_enabled_v3:tester',false);await f.refresh();assert.equal(f.hidden('comment-same'),false);assert.equal(f.hidden('notice-same'),false);
});

test('nativeが同じ行の通知ID・avatar・日時を差し替えたら重複判定も更新する',async t=>{
 const f=fixture(t,{initial:likeRow('first',{notice:'same'})+likeRow('duplicate',{notice:'same'})+likeRow('group')+likeRow('group-duplicate'),append:false});await f.ready();assert.equal(f.hidden('duplicate'),true);assert.equal(f.hidden('group-duplicate'),true);
 f.w.document.getElementById('duplicate').setAttribute('data-notification-id','different');await until(()=>!f.hidden('duplicate'));
 f.w.document.querySelector('#group-duplicate img').src='https://images.example/different.jpg';await until(()=>!f.hidden('group-duplicate'));
 f.w.document.querySelector('#group-duplicate img').src='https://images.example/a.jpg';await until(()=>f.hidden('group-duplicate'));
 f.w.document.querySelector('#group-duplicate time').setAttribute('datetime','2026-11-01T01:02:03Z');await until(()=>!f.hidden('group-duplicate'));
});
