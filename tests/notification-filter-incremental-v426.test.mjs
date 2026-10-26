import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

const source=readFileSync(process.env.FILTER_INCREMENTAL_SOURCE||'public/note-insight-notification-filter-v4.js','utf8');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(check){for(let i=0;i<80&&!check();i++)await pause(10);assert.ok(check(),'filter settles');}
const row=(id,{muted=true,name=muted?'登録人物':'別の人物',actor=muted?'actor':'other'}={})=>`<li class="native-notice" id="${id}"><a href="/${actor}">${name}</a>さんが${muted?'共同マガジンに新しい記事を1本追加しました':'あなたの記事にスキしました'} 1分前</li>`;

function fixture(t,{mode='modern',initial=Array.from({length:12},(_,i)=>row('old-'+i)).join(''),prefix=0}={}){
 const dom=new JSDOM(`<body style="overflow:hidden"><style>.native-notice{height:60px}</style><ul id="notices" class="notificationList" style="height:400px;overflow-y:auto">${prefix?`<div id="native-prefix" style="height:${prefix}px"></div>`:''}${initial}<li id="native-loading"></li><div id="native-sentinel" class="h-px"></div></ul></body>`,{url:'https://note.com/',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window;t.after(()=>w.close());
 const list=w.document.getElementById('notices'),loading=w.document.getElementById('native-loading'),sentinel=w.document.getElementById('native-sentinel');
 const values=new Map([['mumei_insight_magazine_filter_enabled_v3:tester',true],['mumei_insight_notification_groups_v1:tester',[{enabled:true,ids:['actor']}]],['mumei_insight_magazine_mute_profiles_v5:tester',[{id:'actor',name:'登録人物'}]]]);
 if(mode==='modern')w.GM={getValue:async(key,fallback)=>values.get(key)??fallback,setValue:async(key,value)=>values.set(key,value)};
 else{w.GM_getValue=(key,fallback)=>values.get(key)??fallback;w.GM_setValue=(key,value)=>values.set(key,value)}
 const measure={refreshes:0,classifications:0,requests:0};w.__filterMeasure=measure;
 w.fetch=async()=>{measure.requests++;return Response.json({data:{urlname:'tester'}})};
 function height(el){
  if(el.hidden||w.getComputedStyle(el).display==='none')return 0;
  if(el.id==='native-prefix')return prefix;
  if(el.id==='mumei-notification-filter-continuation-v4')return parseFloat(el.style.minHeight)||118;
  if(el.classList.contains('native-notice'))return 60;
  return el===loading?16:el===sentinel?1:0;
 }
 Object.defineProperties(list,{clientHeight:{get:()=>400},scrollHeight:{get:()=>Math.max(400,[...list.children].reduce((total,el)=>total+height(el),0))}});
 let top=0;Object.defineProperty(list,'scrollTop',{get:()=>top,set:value=>{top=Math.max(0,Math.min(Number(value)||0,list.scrollHeight-list.clientHeight))}});
 const rect=(top,height)=>({top,bottom:top+height,left:0,right:360,width:360,height});
 w.HTMLElement.prototype.getBoundingClientRect=function(){
  if(this===list)return rect(100,400);
  if(this===w.document.body||this===w.document.documentElement)return rect(0,w.innerHeight);
  if(this.parentElement===list){let offset=0;for(const el of list.children){if(el===this)break;offset+=height(el)}return rect(100+offset-list.scrollTop,height(this))}
  return rect(100,30);
 };
 w.__mumeiNotificationReaderV4={findPanel:()=>list};
 w.eval(source.replace('async function refresh(forceState=false){','async function refresh(forceState=false){window.__filterMeasure.refreshes++;').replace('function magazineNoise(t){','function magazineNoise(t){window.__filterMeasure.classifications++;'));
 const append=(count=12)=>{const fragment=w.document.createDocumentFragment();for(let i=0;i<count;i++){const box=w.document.createElement('div');box.innerHTML=row('new-'+i);fragment.append(box.firstElementChild)}list.insertBefore(fragment,loading)};
 const ready=async()=>{await until(()=>list.querySelector('#mumei-notification-filter-continuation-v4'));await pause(130)};
 return{w,list,loading,sentinel,values,measure,append,ready,hidden:id=>w.document.getElementById(id).classList.contains('mumei-muted-v2939'),set:(key,value)=>values.set(key,value)};
}

for(const mode of ['modern','legacy'])test(`12件追加では新しい12件だけを分類し、own runway移動による2回目の再処理をしない (${mode})`,async t=>{
 const f=fixture(t,{mode});await f.ready();
 const original=[...f.list.querySelectorAll('.native-notice')],sentinel=f.sentinel,before={...f.measure};
 f.append();await until(()=>f.list.querySelectorAll('.native-notice.mumei-muted-v2939').length===24);await pause(180);
 assert.equal(f.measure.refreshes-before.refreshes,1,'one native append causes one filter pass');
 assert.equal(f.measure.classifications-before.classifications,12,'unchanged loaded rows keep their decisions');
 assert.equal(f.measure.requests,1,'filter state keeps the checked account');
 assert.equal(f.sentinel,sentinel);for(const node of original)assert.equal(f.w.document.getElementById(node.id),node);
 assert.equal(f.list.querySelectorAll('#mumei-notification-filter-continuation-v4').length,1);
});

test('同じ行の本文・href変更とnative再描画は分類キャッシュを使い回さない',async t=>{
 const f=fixture(t,{initial:row('target',{name:'新しい名前'})+row('last')});await f.ready();assert.equal(f.hidden('target'),true);
 const before=f.measure.classifications,target=f.w.document.getElementById('target');
 target.querySelector('a').href='/other';await until(()=>!f.hidden('target'));assert.equal(f.measure.classifications-before,1);
 target.lastChild.textContent='さんがあなたの記事にスキしました 1分前';await f.w.__mumeiNotificationFilterV4.refresh();assert.equal(f.hidden('target'),false);
 const clone=target.cloneNode(true);clone.querySelector('a').href='/actor';clone.lastChild.textContent='さんが共同マガジンに新しい記事を2本追加しました 1分前';target.replaceWith(clone);
 await until(()=>f.hidden('target'));assert.equal(f.w.document.getElementById('target'),clone);
});

test('行全体の文とhrefが同じでも、人物リンクの表示名が変われば再判定する',async t=>{
 const f=fixture(t,{initial:row('target',{name:'新しい名前'})+row('last')});await f.ready();assert.equal(f.hidden('target'),true);
 const target=f.w.document.getElementById('target'),text=target.textContent;
 target.innerHTML='新しい名前<a href="/actor"></a>さんが共同マガジンに新しい記事を1本追加しました 1分前';
 assert.equal(target.textContent,text);await until(()=>!f.hidden('target'));
});

test('listenerがない設定変更・プロフィール名の後着も同じDOMを再判定する',async t=>{
 const f=fixture(t,{initial:row('target',{name:'新しい名前',actor:'unrelated'})+row('last')});await f.ready();assert.equal(f.hidden('target'),false);
 f.set('mumei_insight_magazine_mute_profiles_v5:tester',[{id:'actor',name:'新しい名前'}]);
 await f.w.__mumeiNotificationFilterV4.refresh(true);assert.equal(f.hidden('target'),true);
 f.set('mumei_insight_notification_groups_v1:tester',[{enabled:false,ids:['actor']}]);
 await f.w.__mumeiNotificationFilterV4.refresh(true);assert.equal(f.hidden('target'),false);
 f.set('mumei_insight_notification_groups_v1:tester',[{enabled:true,ids:['actor']}]);
 await f.w.__mumeiNotificationFilterV4.refresh(true);assert.equal(f.hidden('target'),true);
 f.set('mumei_insight_magazine_filter_enabled_v3:tester',false);
 await f.w.__mumeiNotificationFilterV4.refresh(true);assert.equal(f.hidden('target'),false);assert.equal(f.list.querySelector('#mumei-notification-filter-continuation-v4'),null);
});

test('own要素だけのDOM変更は無視し、native行と混在した追加は取りこぼさない',async t=>{
 const f=fixture(t);await f.ready();const before=f.measure.refreshes;
 const helper=f.w.document.createElement('div');helper.id='mumei-owned-test';f.list.insertBefore(helper,f.loading);helper.remove();await pause(130);assert.equal(f.measure.refreshes,before);
 const fragment=f.w.document.createDocumentFragment();fragment.append(helper);const box=f.w.document.createElement('div');box.innerHTML=row('native-mixed');fragment.append(box.firstElementChild);f.list.insertBefore(fragment,f.loading);
 await until(()=>f.hidden('native-mixed'));assert.ok(f.measure.refreshes>before);
});

test('runwayの末尾移動でも、閲覧中の既存native行の画面上の位置を保つ',async t=>{
 const f=fixture(t,{prefix:800,initial:row('muted')+row('visible',{muted:false})});await f.ready();
 const visible=f.w.document.getElementById('visible');f.list.scrollTop=1100;const before=visible.getBoundingClientRect().top;
 assert.ok(before>=100&&before<500,'the native row is currently visible');
 f.append();await until(()=>f.list.querySelectorAll('.native-notice.mumei-muted-v2939').length===13);await pause(100);
 assert.equal(visible.getBoundingClientRect().top,before,'moving the owned runway must not displace the viewed row');
 assert.equal(f.w.getComputedStyle(f.list.querySelector('#mumei-notification-filter-continuation-v4')).overflowAnchor,'none');
 assert.equal(f.w.getComputedStyle(f.list.querySelector('[data-mumei-filter-page-edge]')).overflowAnchor,'none');
 assert.notEqual(f.w.getComputedStyle(visible).overflowAnchor,'none','native visible rows retain browser anchoring');
});

test('フィルター自身のstyle抑止後でも、本物のnative表示変更・再表示を検知する',async t=>{
 const f=fixture(t);await f.ready();const before=f.measure.refreshes;
 f.list.style.display='none';await pause(100);f.list.style.display='block';
 await until(()=>f.measure.refreshes>before+1);assert.equal(f.hidden('old-0'),true);
});
