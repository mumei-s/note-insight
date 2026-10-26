import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import ts from 'typescript';
import './notification-native-page-budget.test.mjs';
import './notification-filter-incremental-v426.test.mjs';
import './notification-filter-settings-v114.test.mjs';
const KEY='mumei_insight_notification_feature_enabled_v1';
const read=name=>readFileSync('public/note-insight-notification-'+name,'utf8');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn){for(let i=0;i<100&&!fn();i++)await pause(20);assert.ok(fn());}
for(const mode of ['modern','legacy','focus'])test(`別タブでOFFにするとパネル・読取・フィルターを止め、ONと再訪も反映する (${mode})`,async t=>{
 const values=new Map([[KEY,true],['mumei_insight_notification_controls_collapsed_v1',true],['mumei_insight_magazine_filter_enabled_v3:tester',true],['mumei_insight_notification_groups_v1:tester',[{name:'G',enabled:true,ids:['actor']}]],['mumei_insight_magazine_mute_profiles_v5:tester',[{id:'actor',name:'人物'}]]]),listeners=[];
 const create=(url,html)=>{const dom=new JSDOM(html,{url,runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;t.after(()=>w.close());w.HTMLElement.prototype.getBoundingClientRect=()=>({width:360,height:100,top:0,left:0,right:360,bottom:100});
  const get=(k,d)=>values.has(k)?values.get(k):d,set=(k,v)=>{const old=values.get(k);values.set(k,v);for(const l of listeners)if(l.key===k)l.fn(k,old,v,l.w!==w)},listen=(key,fn)=>listeners.push({w,key,fn});
  if(mode==='legacy'){w.GM_getValue=get;w.GM_setValue=set;w.GM_addValueChangeListener=listen}else w.GM={getValue:async(...args)=>get(...args),setValue:async(...args)=>set(...args),...(mode==='modern'?{addValueChangeListener:listen}:{})};
  w.fetch=async()=>Response.json({data:{urlname:'tester'}});w.matchMedia=()=>({matches:true});
  w.postMessage=data=>w.setTimeout(()=>w.dispatchEvent(new w.MessageEvent('message',{origin:w.location.origin,data})),0);
  w.eval(read('feature-bridge-v1.js'));return w;
 };
 const app=create('https://mumei-s.github.io/note-insight/','<div class="miv5-update"><div class="miv5-source-grid"><div class="miv5-source-card notice"><button class="miv5-source-main">本人通知</button></div></div></div>');
 app.eval('(()=>{'+ts.transpileModule(readFileSync('src/insight-top-install-v16.ts','utf8').replace('export {};',''),{compilerOptions:{module:ts.ModuleKind.None,target:ts.ScriptTarget.ES2022}}).outputText+'})()');
 const markup='<button aria-label="通知" id="bell">🔔</button><main id="native"><button>通知</button><button>お知らせ</button><div class="m-navbarNoticeItem"><a href="/actor">人物</a>さんがマガジンに新しい記事を1本追加しました 1分前</div><div class="m-navbarNoticeItem">別の人物さんがスキしました 2分前</div></main>';
 const note=create('https://note.com/',markup);let starts=0,stops=0,finish;
 note.__mumeiNotificationNetwork3300={syncCurrent:()=>{starts++;return new Promise(r=>finish=r)},stop:()=>{stops++;finish?.({saved:0});finish=null}};
 for(const name of ['reader-v4.js','controls-v1.js','filter-v4.js'])note.eval(read(name));
 const bar=()=>note.document.getElementById('mumei-inline-notification-controls-v1'),toggle=()=>app.document.querySelector('.mumei-notice-feature-toggle');
 await until(()=>bar()&&starts>0&&toggle()?.textContent==='note公式🔔パネル ON');
 assert.notEqual(note.getComputedStyle(bar().querySelector('[data-action="filter"]')).display,'none','旧収納設定が残っていても通知一覧の下部で操作できる');
 note.document.querySelectorAll('.m-navbarNoticeItem')[1].remove();
 await note.__mumeiNotificationFilterV4.refresh(true);await pause(250);
 assert.ok(bar(),'全件がフィルター対象でも解除用パネルを残す');
 const stoppedBefore=stops;toggle().click();await until(()=>toggle().textContent==='note公式🔔パネル OFF');
 if(mode==='focus')note.dispatchEvent(new note.Event('focus'));
 await until(()=>!bar()&&stops>stoppedBefore);
 assert.equal(note.document.querySelector('.mumei-muted-v2939'),null);assert.ok(note.document.querySelector('#native'));assert.ok(note.document.querySelector('#bell'));
 const before=starts;
 for(let i=0;i<3;i++){note.__mumeiNotificationControlsV1.mount();await note.__mumeiNotificationReaderV4.scan();note.document.querySelector('#native').append(note.document.createElement('span'))}
 await pause(250);assert.equal(bar(),null);assert.equal(starts,before,'OFF後に自動読取が再開しない');
 const revisited=create('https://note.com/',markup);revisited.__mumeiNotificationReaderV4={findPanel:()=>revisited.document.querySelector('#native')};revisited.eval(read('controls-v1.js'));await revisited.__mumeiNotificationFeatureV1.ready;revisited.__mumeiNotificationControlsV1.mount();assert.equal(revisited.document.getElementById('mumei-inline-notification-controls-v1'),null);
 toggle().click();await until(()=>toggle().textContent==='note公式🔔パネル ON');if(mode==='focus')note.dispatchEvent(new note.Event('focus'));await until(()=>bar()&&starts>before);
});

for(const retryable of [true,false])test(`保存エラー後は読込中を解除し、自動再試行を間引く（再試行可能=${retryable}）`,async t=>{
 const dom=new JSDOM('<main class="m-navbarNotice"><div class="m-navbarNoticeItem">人物さんがスキしました 1分前</div></main>',{url:'https://note.com/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;t.after(()=>w.close());
 w.HTMLElement.prototype.getBoundingClientRect=()=>({width:360,height:100,left:0,top:0});w.GM={getValue:async(k,d)=>d};
 let calls=0,now=Date.now(),states=[];w.Date.now=()=>now;
 w.__mumeiNotificationNetwork3300={syncCurrent:async()=>{calls++;throw Object.assign(new Error('保存先の応答がありません'),{retryable,progress:{readCount:69,savedCount:0,totalCount:69}})},stop(){}};
 w.addEventListener('mumei-notification-reader-status',e=>states.push(e.detail));w.eval(read('reader-v4.js'));
 await until(()=>states.at(-1)?.state==='error');assert.equal(states.at(-1).scanning,false);assert.equal(states.at(-1).readCount,69);assert.equal(calls,1);
 now+=10000;w.__mumeiNotificationReaderV4.scheduleAuto(0);await pause(30);assert.equal(calls,1,'5秒ごとに再開して表示を消さない');
 now+=21000;w.__mumeiNotificationReaderV4.scheduleAuto(0);await pause(30);assert.equal(calls,retryable?2:1);
 await w.__mumeiNotificationReaderV4.scan();assert.equal(calls,retryable?3:2,'手動は待ち時間を置かず再開');
});


test('複数フィルターIDを同時に全件判定し、ベル内スクロールを閉じ込める',async t=>{
 const html='<main id="panel"><button>通知</button><button>お知らせ</button>'+
  '<div class="m-navbarNoticeItem"><span>人物Aさんが共同マガジンに新しい記事を1本追加しました 1分前</span></div>'+
  '<div class="m-navbarNoticeItem"><span>人物Bさんが共同マガジンに新しい記事を2本追加しました 2分前</span></div></main>';
 const dom=new JSDOM(html,{url:'https://note.com/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;t.after(()=>w.close());
 w.HTMLElement.prototype.getBoundingClientRect=()=>({width:360,height:120,top:0,left:0,right:360,bottom:120});
 const values=new Map([
  ['mumei_insight_magazine_filter_enabled_v3:tester',true],
  ['mumei_insight_notification_groups_v1:tester',[{name:'G1',enabled:true,ids:['actor_a']},{name:'G2',enabled:true,ids:['actor_b']}]],
  ['mumei_insight_magazine_mute_profiles_v5:tester',[{id:'actor_a',name:'人物A'},{id:'actor_b',name:'人物B'}]]
 ]);
 w.GM={getValue:async(k,d)=>values.has(k)?values.get(k):d,setValue:async(k,v)=>values.set(k,v),addValueChangeListener:()=>1};
 w.fetch=async url=>Response.json(String(url).includes('current_user')?{data:{user:{urlname:'tester'}}}:{data:{}});
 w.__mumeiNotificationReaderV4={findPanel:()=>w.document.getElementById('panel')};
 w.eval(read('filter-v4.js'));
 await w.__mumeiNotificationFilterV4.refresh(true);await pause(30);
 const rows=[...w.document.querySelectorAll('.m-navbarNoticeItem')];
 assert.equal(rows.length,2);assert.ok(rows.every(el=>el.classList.contains('mumei-muted-v2939')),'グループ1以外も含め全有効グループのIDを判定');
 assert.equal(w.document.getElementById('panel').getAttribute('data-mumei-filter-scroll-guard'),'1');
 assert.equal(w.document.getElementById('panel').style.getPropertyValue('overscroll-behavior-y'),'contain');
});

for(const mode of ['modern','legacy'])test(`自動が初期値で、一時停止はベルの再表示・focus・pageshowでも維持し、再開で自動に戻る (${mode})`,async t=>{
 const dom=new JSDOM('<main id="native"><button>通知</button><button>お知らせ</button><div class="m-navbarNoticeItem">人物さんがスキしました 1分前</div></main>',{url:'https://note.com/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;t.after(()=>w.close());
 const values=new Map([[KEY,true]]),get=(k,d)=>values.get(k)??d,set=(k,v)=>values.set(k,v);
 if(mode==='modern')w.GM={getValue:async(...a)=>get(...a),setValue:async(...a)=>set(...a)};else{w.GM_getValue=get;w.GM_setValue=set}
 w.HTMLElement.prototype.getBoundingClientRect=()=>({width:360,height:100,top:0,left:0,right:360,bottom:100});w.fetch=async()=>Response.json({data:{urlname:'tester'}});w.matchMedia=()=>({matches:true});
 let starts=0,finish;w.__mumeiNotificationNetwork3300={syncCurrent:()=>{starts++;return new Promise(r=>finish=r)},stop:()=>{finish?.({saved:0});finish=null}};
 for(const name of ['feature-bridge-v1.js','reader-v4.js','controls-v1.js'])w.eval(read(name));
 const bar=()=>w.document.getElementById('mumei-inline-notification-controls-v1'),button=()=>bar()?.querySelector('[data-action=read]');await until(()=>starts===1&&button());assert.equal(button().textContent,'一時停止');assert.equal(bar().querySelector('.panel-settings').textContent,'ON/OFFはメイン🔔から');button().click();await until(()=>button()?.textContent==='再開');assert.equal(button().dataset.paused,'1');const before=starts;
 const native=w.document.getElementById('native');native.hidden=true;w.__mumeiNotificationControlsV1.mount();native.hidden=false;
 for(const event of ['focus','pageshow','mumei-notification-feature-changed'])w.dispatchEvent(event==='mumei-notification-feature-changed'?new w.CustomEvent(event,{detail:{enabled:true}}):new w.Event(event));
 w.document.dispatchEvent(new w.CustomEvent('mumei-notification-captured',{detail:{signature:'new'}}));w.__mumeiNotificationReaderV4.scheduleAuto(0);w.__mumeiNotificationControlsV1.mount();await pause(300);assert.equal(starts,before);assert.equal(button().textContent,'再開');
 button().click();await until(()=>starts===before+1);assert.equal(w.__mumeiNotificationReaderV4.isPaused(),false);finish({saved:0});await pause(30);
 bar().querySelector('[data-action=off]').click();await until(()=>!bar());assert.equal(values.get(KEY),false);assert.equal(w.document.getElementById('native'),native,'OFFはnote公式の機能を削除しない');
 await w.__mumeiNotificationFeatureV1.setEnabled(true);await until(()=>bar());assert.equal(values.get('mumei_insight_notification_panel_enabled_v1'),true);assert.equal(w.__mumeiNotificationReaderV4.isPaused(),false);
});

for(const mode of ['modern','legacy'])test(`ON/OFFの保存失敗を成功扱いにせず、失敗後も再試行できる (${mode})`,async t=>{
 const dom=new JSDOM('',{url:'https://mumei-s.github.io/note-insight/notification-connection.html',runScripts:'outside-only'}),w=dom.window;t.after(()=>w.close());const values=new Map([[KEY,true]]);let fail=true;
 const get=(k,d)=>values.get(k)??d,set=(k,v)=>{if(fail)throw new Error('GM保存失敗');values.set(k,v)};
 if(mode==='modern')w.GM={getValue:async(...a)=>get(...a),setValue:async(...a)=>set(...a)};else{w.GM_getValue=get;w.GM_setValue=set}
 w.eval(read('feature-bridge-v1.js'));const feature=w.__mumeiNotificationFeatureV1;await feature.ready;await assert.rejects(feature.setEnabled(false),/GM保存失敗/);assert.equal(feature.isEnabled(),true);fail=false;await feature.setEnabled(false);assert.equal(feature.isEnabled(),false);values.set('mumei_insight_notification_panel_enabled_v1',false);await feature.setEnabled(true);assert.equal(values.get('mumei_insight_notification_panel_enabled_v1'),true);assert.equal(feature.isEnabled(),true);
});

test('保存済み境界で自動通信を終了し、新しいキャプチャ・再表示・手動で差分を読む',async t=>{
 const dom=new JSDOM('<main class="m-navbarNotice"><div class="m-navbarNoticeItem">人物さんがスキしました 1分前</div></main>',{url:'https://note.com/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;t.after(()=>w.close());
 w.HTMLElement.prototype.getBoundingClientRect=()=>({width:360,height:100,left:0,top:0});w.GM={getValue:async(k,d)=>d};
 let calls=0,now=Date.now(),result={saved:0,historyComplete:true};w.Date.now=()=>now;
 w.__mumeiNotificationNetwork3300={syncCurrent:async()=>{calls++;return result},stop(){}};
 w.eval(read('reader-v4.js'));await until(()=>calls===1);await pause(30);
 const tick=async ms=>{now+=ms;w.__mumeiNotificationReaderV4.scheduleAuto(0);await pause(30)};
 await tick(5000);await tick(60000);assert.equal(calls,1,'完了後は同じパネルで再通信しない');
 w.document.dispatchEvent(new w.CustomEvent('mumei-notification-captured',{detail:{signature:'changed'}}));await until(()=>calls===2);
 w.document.dispatchEvent(new w.CustomEvent('mumei-notification-captured',{detail:{signature:'changed'}}));await tick(10000);assert.equal(calls,2,'同じキャプチャでは繰り返さない');
 await w.__mumeiNotificationReaderV4.scan();assert.equal(calls,3,'手動確認は即時');
 result={saved:0,historyComplete:false,partial:true};await w.__mumeiNotificationReaderV4.scan();assert.equal(calls,4);
 await tick(5000);assert.equal(calls,5,'未完了の次ウィンドウは自動継続');
 result={saved:1,historyComplete:true};await w.__mumeiNotificationReaderV4.scan();await tick(5000);assert.equal(calls,6,'保存件数があっても完了したら止まる');
 const panel=w.document.querySelector('main');panel.remove();await pause(200);await tick(5000);w.document.body.append(panel);await pause(200);await tick(5000);assert.equal(calls,7,'次回開いたら差分確認');
});
test('初回の複数ウィンドウ途中に来た新着は最後に先頭差分を読み、取り残さない',async t=>{
 const dom=new JSDOM('<main class="m-navbarNotice"><div class="m-navbarNoticeItem">人物さんがスキしました 1分前</div></main>',{url:'https://note.com/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;t.after(()=>w.close());
 w.HTMLElement.prototype.getBoundingClientRect=()=>({width:360,height:100,left:0,top:0});w.GM={getValue:async(k,d)=>d};let calls=0,finish;w.__mumeiNotificationNetwork3300={syncCurrent:()=>{calls++;return new Promise(r=>finish=r)},stop(){}};
 w.eval(read('reader-v4.js'));await until(()=>calls===1);
 w.document.dispatchEvent(new w.CustomEvent('mumei-notification-captured',{detail:{signature:'new-head-during-backfill'}}));finish({saved:300,partial:true,historyComplete:false});await until(()=>calls===2);
 finish({saved:650,partial:false,historyComplete:true});await until(()=>calls===3);finish({saved:1,partial:false,historyComplete:true});await pause(50);
 w.Date.now=()=>Date.now()+60000;w.__mumeiNotificationReaderV4.scheduleAuto(0);await pause(30);assert.equal(calls,3,'先頭の追加差分を確認したら通信を終える');
});

async function domReaderFixture(t){
 const dom=new JSDOM('<button id="bell">通知</button><main class="m-navbarNotice"><div class="m-navbarNoticeItem" data-notice-id="a"><a href="/actor">人物</a>さんがスキしました 1分前</div></main>',{url:'https://note.com/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;t.after(()=>w.close());
 w.HTMLElement.prototype.getBoundingClientRect=()=>({width:360,height:100,left:0,top:0});w.GM={getValue:async(k,d)=>d};let calls=0;
 w.__mumeiNotificationNetwork3300={syncCurrent:async()=>{calls++;return{saved:0,historyComplete:true}},stop(){}};w.eval(read('reader-v4.js'));await until(()=>calls===1);await pause(200);
 return{w,get calls(){return calls},settle:()=>pause(250)};
}
test('完了後に同内容のパネルDOMが何度差し替わっても再通信しない',async t=>{
 const h=await domReaderFixture(t);for(let i=0;i<4;i++){const p=h.w.document.querySelector('main');p.replaceWith(p.cloneNode(true));await h.settle();assert.equal(h.calls,1)}
});
test('同じパネルの並べ替え・時刻ラベル・フィルター変更は再通信せず、先頭の新着と本文変更を読む',async t=>{
 const h=await domReaderFixture(t),w=h.w,p=w.document.querySelector('main'),a=p.firstElementChild;
 a.classList.add('mumei-muted-v2939');a.style.display='none';a.lastChild.textContent='さんがスキしました 2分前';await h.settle();assert.equal(h.calls,1);
 const b=a.cloneNode(true);b.dataset.noticeId='b';b.lastChild.textContent='さんがコメントしました 1分前';p.prepend(b);await h.settle();assert.equal(h.calls,2,'非表示フィルター対象でも先頭の新着を取得');
 p.append(b);await h.settle();assert.equal(h.calls,2,'順序変更は新着ではない');
 b.lastChild.textContent='さんがコメントしました 追記があります 1分前';await h.settle();assert.equal(h.calls,3,'まとめ通知本文の変化を取得');
 b.remove();await h.settle();p.append(b);await h.settle();assert.equal(h.calls,3,'既知の行の除去と再配置では繰り返さない');
});
test('短い一時消失は再描画として扱い、実際の閉じ直しと素早いユーザー再表示は確認する',async t=>{
 const h=await domReaderFixture(t),w=h.w;let p=w.document.querySelector('main');p.remove();await pause(200);w.document.body.append(p.cloneNode(true));await h.settle();assert.equal(h.calls,1,'短い描画の空白で完了を解除しない');
 p=w.document.querySelector('main');p.remove();await pause(800);w.document.body.append(p);await h.settle();assert.equal(h.calls,2,'閉じて開いたら差分確認');
 p.remove();w.document.getElementById('bell').dispatchEvent(new w.MouseEvent('click',{bubbles:true}));w.document.body.append(p);await h.settle();assert.equal(h.calls,3,'明示的な素早い開き直しも取得');
});
test('識別子がない同一内容の通知でも件数が増えたら新着を読む',async t=>{
 const h=await domReaderFixture(t),p=h.w.document.querySelector('main');p.firstElementChild.removeAttribute('data-notice-id');await h.settle();const before=h.calls;p.append(p.firstElementChild.cloneNode(true));await h.settle();assert.equal(h.calls,before+1);
});
test('実DOMの新着が履歴取得途中に追加されても、履歴完了後に先頭差分を取り込む',async t=>{
 const dom=new JSDOM('<main class="m-navbarNotice"><div class="m-navbarNoticeItem" data-notice-id="a">人物さんがスキしました 1分前</div></main>',{url:'https://note.com/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;t.after(()=>w.close());
 w.HTMLElement.prototype.getBoundingClientRect=()=>({width:360,height:100,left:0,top:0});w.GM={getValue:async(k,d)=>d};let calls=0,finish;
 w.__mumeiNotificationNetwork3300={syncCurrent:()=>{calls++;return new Promise(r=>finish=r)},stop(){}};w.eval(read('reader-v4.js'));await until(()=>calls===1);
 const row=w.document.querySelector('.m-navbarNoticeItem').cloneNode(true);row.dataset.noticeId='b';w.document.querySelector('main').prepend(row);await pause(250);
 finish({saved:300,partial:true,historyComplete:false});await until(()=>calls===2);finish({saved:650,partial:false,historyComplete:true});await until(()=>calls===3);finish({saved:1,partial:false,historyComplete:true});await pause(250);
 const p=w.document.querySelector('main');p.replaceWith(p.cloneNode(true));await pause(250);assert.equal(calls,3,'新着確認後の同内容再描画で再開しない');
});
test('DOM差し替えで保存エラーの再試行待機を解除しない',async t=>{
 const dom=new JSDOM('<main class="m-navbarNotice"><div class="m-navbarNoticeItem">人物さんがスキしました 1分前</div></main>',{url:'https://note.com/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;t.after(()=>w.close());w.HTMLElement.prototype.getBoundingClientRect=()=>({width:360,height:100,left:0,top:0});w.GM={getValue:async(k,d)=>d};let calls=0;
 w.__mumeiNotificationNetwork3300={syncCurrent:async()=>{calls++;throw Object.assign(new Error('保存失敗'),{retryable:false})},stop(){}};w.eval(read('reader-v4.js'));await until(()=>calls===1);await pause(250);for(let i=0;i<3;i++){const p=w.document.querySelector('main');p.replaceWith(p.cloneNode(true));await pause(250)}assert.equal(calls,1);
});
test('公式の汎用li形式でも実DOMの新着を検出し、補助表示は通知と数えない',async t=>{
 const dom=new JSDOM('<main><button>通知</button><button>お知らせ</button><ul><li><a href="/actor">人物</a>さんがスキしました 1分前</li></ul></main>',{url:'https://note.com/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;t.after(()=>w.close());w.HTMLElement.prototype.getBoundingClientRect=()=>({width:360,height:100,left:0,top:0});w.GM={getValue:async(k,d)=>d};let calls=0;
 w.__mumeiNotificationNetwork3300={syncCurrent:async()=>{calls++;return{saved:0,historyComplete:true}},stop(){}};w.eval(read('reader-v4.js'));await until(()=>calls===1);await pause(200);
 const list=w.document.querySelector('ul'),row=w.document.createElement('li');row.innerHTML='<a href="/other">別の人物</a>さんがコメントしました 1分前';list.prepend(row);await pause(250);assert.equal(calls,2);
 const helper=w.document.createElement('li');helper.id='mumei-notification-filter-continuation-v4';helper.textContent='続きへ 1分前';list.append(helper);await pause(250);assert.equal(calls,2);
});
