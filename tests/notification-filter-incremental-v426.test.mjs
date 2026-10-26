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

for(const mode of ['modern','legacy'])test(`記事追加だけを隠し、マガジン参加・自分の記事追加・話題・紹介・埋込・購入・交流通知を保持する (${mode})`,async t=>{
 const cases=[
  ['grouped','さん他35名が共同マガジンに新しい記事を1,234本追加しました 1分前',true],
  ['single','さんが「書きたい」気持ちをそ...に記事を追加し\nました 31分前',true],
  ['no-count','さんが作品集に新しい記事を追加しました 7秒前',true],
  ['join','さんが共同運営マガジンに仲間入りしました 1分前',false],
  ['member-join','さんがメンバーシップに参加しました 1分前',false],
  ['own-added','さんがあなたの記事をマガジン「作品集」に追加しました 1分前',false],
  ['own-passive','さんのマガジンにあなたの記事が追加されました 1分前',false],
  ['buzz','さんの記事であなたの記事が紹介されて話題になりました 1分前',false],
  ['introduced','さんが記事内であなたの記事を紹介しました 1分前',false],
  ['embedded','さんが自分の記事にあなたの記事を埋め込みました 1分前',false],
  ['article-inside','さんが記事内にあなたの記事を追加しました 1分前',false],
  ['purchase','さんがあなたの記事を購入しました 1分前',false],
  ['like','さんがあなたの記事にスキしました 1分前',false],
  ['reply','さんがあなたのコメントに返信しました 1分前',false],
  ['comment','さんがあなたの記事にコメントしました 1分前',false],
  ['follow','さんがあなたをフォローしました 1分前',false],
  ['uncertain','さんが「作品集に新しい記事を1本追加しました 1分前',false],
 ];
 const initial=cases.map(([id,text])=>`<li class="native-notice" id="${id}"><a href="/actor">登録人物</a>${text}</li>`).join('');
 const f=fixture(t,{mode,initial});await f.ready();
 for(const [id,,hide] of cases)assert.equal(f.hidden(id),hide,id);
 assert.equal(f.measure.requests,1);const nodes=cases.map(([id])=>f.w.document.getElementById(id));
 f.set('mumei_insight_magazine_filter_enabled_v3:tester',false);await f.w.__mumeiNotificationFilterV4.refresh(true);
 for(let i=0;i<cases.length;i++){assert.equal(f.hidden(cases[i][0]),false);assert.equal(f.w.document.getElementById(cases[i][0]),nodes[i])}
});

test('記事タイトルに非表示対象の文言があっても、購入・スキ・返信・紹介・埋込を隠さない',async t=>{
 const title='共同マガジンに新しい記事を1本追加しました',linked=`<a href="/someone/n/n123456789abc">${title}</a>`;
 const cases=[
  ['quoted-like',`さんが「${title}」という記事にスキしました 1分前`],
  ['quoted-purchase',`さんが「${title}」という記事を購入しました 1分前`],
  ['quoted-introduced',`さんが「${title}」という記事であなたの記事を紹介しました 1分前`],
  ['quoted-embedded',`さんが「${title}」という記事にあなたの記事を埋め込みました 1分前`],
  ['linked-like',`さんが「${linked}」という記事にスキしました 1分前`],
  ['linked-reply',`さんが「${linked}」であなたのコメントに返信しました 1分前`],
  ['unquoted-ambiguous',`さんが${title}という記事にスキしました 1分前`],
  ['preview-purchase',`さんがあなたの記事を購入しました<p>登録人物さんが${title}</p><time>1分前</time>`],
  ['preview-buzz',`さんの記事であなたの記事が紹介されて話題になりました<p>登録人物さんが${title}</p><time>1分前</time>`],
 ];
 const initial=row('real-add')+cases.map(([id,text])=>`<li class="native-notice" id="${id}"><a href="/actor">登録人物</a>${text}</li>`).join('');
 const f=fixture(t,{initial});await f.ready();assert.equal(f.hidden('real-add'),true);
 for(const [id] of cases)assert.equal(f.hidden(id),false,id);
});

test('平坦な本文・リンクが同じでも、動作文をpreviewへ移したDOM変更を再判定する',async t=>{
 const f=fixture(t,{initial:row('target')+row('last')});await f.ready();assert.equal(f.hidden('target'),true);
 const target=f.w.document.getElementById('target'),text=target.textContent,link=target.querySelector('a').outerHTML,body=target.lastChild.textContent;
 target.innerHTML=link+'<p class="article-preview">'+body+'</p>';assert.equal(target.textContent,text);
 await until(()=>!f.hidden('target'));assert.equal(f.w.document.getElementById('target'),target);
});

for(const mode of ['modern','legacy'])test(`省略人物名・複数登録人物のマガジン追加を、DIVプレビューや分割段落でも隠す (${mode})`,async t=>{
 const people=[{id:'actor',name:'架空のEC運用ノート',short:'架空のEC運用ノー…'},{id:'writer_b',name:'架空の週末エッセイ帳',short:'架空の週末エッセ…'},{id:'writer_c',name:'架空の学びと記録',short:'架空の学びと記録'}];
 const [a,b,c]=people,actor=(person,count)=>`${person.short}さん他${count}名が`,added=(magazine,count)=>`${magazine}に新しい記事を${count}本追加しました`,preview='【架空のEC運用】競合商品の見出しを比べる…',time='<time>1分前</time>';
 const cases=[
  ['div-preview',`<li class="native-notice" id="div-preview"><span>${actor(a,35)}</span><span>${added('【共同運営マガジン】頑…',36)}</span><div>${preview}</div>${time}</li>`],
  ['whole-row-link',`<a class="native-notice" id="whole-row-link" href="/magazine/mfictional"><span>${actor(b,24)}</span><span>${added('【創作仲間の棚】続…',25)}</span><div>架空の週末に見つけたこと…</div>${time}</a>`],
  ['split-paragraphs',`<li class="native-notice" id="split-paragraphs"><p>${actor(c,2)}</p><p>${added('学びの記録を集める棚…',3)}</p><div>架空の記事プレビュー</div>${time}</li>`],
  ['nested-blocks',`<li class="native-notice" id="nested-blocks"><div><div><span>${actor(a,35)}</span><div><span>【共同運営マガジン】頑…</span>に新しい記事を36本追加しました</div></div><div>${preview}</div></div>${time}</li>`],
  ['inline-div',`<a class="native-notice" id="inline-div" href="/writer_b/m/mfictional">${actor(b,24)}${added('【創作仲間の棚】続…',25)}<div>架空の週末の記事プレビュー</div><span>1分前</span></a>`],
  ['three-paragraphs',`<li class="native-notice" id="three-paragraphs"><p>${actor(c,2)}</p><p>学びの記録を集める棚…</p><p>に新しい記事を3本追加しました</p><div>架空の記事プレビュー</div>${time}</li>`],
 ];
 const control=`<li class="native-notice" id="control-added"><a href="/actor">${a.name}</a>さんが共同マガジンに新しい記事を1本追加しました 1分前</li>`;
 const f=fixture(t,{mode,initial:control+cases.map(([,markup])=>markup).join('')});
 f.set('mumei_insight_notification_groups_v1:tester',[{enabled:true,ids:people.map(person=>person.id)}]);
 f.set('mumei_insight_magazine_mute_profiles_v5:tester',people.map(person=>({id:person.id,name:person.name})));
 const originals=cases.map(([id])=>f.w.document.getElementById(id));await f.ready();
 assert.deepEqual(cases.map(([id])=>f.hidden(id)),cases.map(()=>true),'every native layout keeps the registered actor and article-add action');
 assert.equal(f.measure.requests,1);assert.equal(f.w.document.querySelectorAll('#mumei-notification-filter-continuation-v4').length,1);
 f.set('mumei_insight_magazine_filter_enabled_v3:tester',false);await f.w.__mumeiNotificationFilterV4.refresh(true);
 for(let i=0;i<cases.length;i++){assert.equal(f.hidden(cases[i][0]),false);assert.equal(f.w.document.getElementById(cases[i][0]),originals[i])}
});

test('ブロック境界で対象文言のタイトルが終わっても、その後の購入・スキ・紹介を隠さない',async t=>{
 const phrase='共同マガジンに新しい記事を36本追加しました',lead='<span>登録人物さんが</span>';
 const cases=[
  ['title-purchase',`${lead}<div>${phrase}</div><div>という記事を購入しました</div>`],
  ['title-like',`${lead}<div>${phrase}</div><div>にスキしました</div>`],
  ['title-introduced',`${lead}<div>${phrase}</div><div>という記事であなたの記事を紹介しました</div>`],
  ['title-reply',`${lead}<p>${phrase}</p><p>の記事に返信しました</p>`],
  ['quoted-title',`${lead}<div>「${phrase}</div><div>」という記事にスキしました</div>`],
  ['linked-title',`${lead}<a href="/fictional/n/n123456789abc">${phrase}</a><div>という記事を購入しました</div>`],
  ['article-inside',`${lead}<div>記事内にあなたの記事を追加しました</div><div>紹介された架空の記事</div>`],
  ['buzz-div-title',`<div>登録人物さんの記事であなたの記事が紹介されて話題になりました</div><div>登録人物さんが${phrase}</div>`],
  ['from-div-title',`<div>登録人物さんからコメントが届きました</div><div>登録人物さんが${phrase}</div>`],
  ['by-div-title',`<div>登録人物さんよりあなたの記事が紹介されました</div><div>登録人物さんが${phrase}</div>`],
  ['to-div-title',`<div>登録人物さんにあなたの記事が紹介されました</div><div>登録人物さんが${phrase}</div>`],
 ];
 const f=fixture(t,{initial:row('real-add')+cases.map(([id,body])=>`<li class="native-notice" id="${id}">${body}<time>1分前</time></li>`).join('')});await f.ready();
 assert.equal(f.hidden('real-add'),true);for(const [id] of cases)assert.equal(f.hidden(id),false,id);
});
