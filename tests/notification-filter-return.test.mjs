import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

const source=readFileSync('public/note-insight-notification-filter-v4.js','utf8');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const hidden=el=>el.classList.contains('mumei-muted-v2939');
const row=(id='muted',text='登録人物さん他35名が共同マガジンに新しい記事を44本追加しました')=>`<div class="m-navbarNoticeItem" id="${id}"><a href="/actor"><img></a>${text}</div>`;
async function until(fn,message){for(let i=0;i<60;i++){if(fn())return;await wait(20)}assert.ok(fn(),message)}
function setup(t,mode='modern',realReader=false){
 const dom=new JSDOM('<button id="bell">🔔</button><main id="page"></main>',{url:'https://note.com/',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window;t.after(()=>w.close());
 w.HTMLElement.prototype.getBoundingClientRect=()=>({width:360,height:300});
 let user='tester',requests=0;
 const values=new Map([
  ['mumei_insight_magazine_filter_enabled_v3:tester',true],
  ['mumei_insight_notification_groups_v1:tester',[{enabled:true,ids:['actor']}]],
  ['mumei_insight_magazine_mute_profiles_v5:tester',[{id:'actor',name:'登録人物'}]],
 ]),listeners=[];
 const get=(k,d)=>values.has(k)?values.get(k):d;
 const set=(k,v)=>{const old=values.get(k);values.set(k,v);for(const l of listeners)if(l.k===k)l.fn(k,old,v,true)};
 const listen=(k,fn)=>listeners.push({k,fn});
 if(mode==='legacy'){w.GM_getValue=get;w.GM_setValue=set;w.GM_addValueChangeListener=listen}else w.GM={getValue:async(...a)=>get(...a),setValue:async(...a)=>set(...a),addValueChangeListener:listen};
 w.fetch=async()=>{requests++;return Response.json({data:{urlname:user}})};
 if(realReader)w.eval(readFileSync('public/note-insight-notification-reader-v4.js','utf8'));
 else w.__mumeiNotificationReaderV4={findPanel:()=>{const p=w.document.querySelector('#panel');return p&&!p.hidden&&p.style.display!=='none'?p:null}};
 const mount=(body=row())=>{const p=w.document.createElement('section');p.id='panel';p.className='m-navbarNotice';p.innerHTML='<button>通知</button><button>お知らせ</button>'+body;w.document.querySelector('#page').append(p);return p};
 const panel=mount();w.eval(source);
 return {w,panel,mount,set,values,user:v=>user=v,requests:()=>requests};
}

for(const mode of ['modern','legacy'])test(`🔔を離れて遅れて再生成された一覧にもONを再適用する (${mode})`,async t=>{
 const e=setup(t,mode);await until(()=>hidden(e.panel.querySelector('#muted')),'初回を非表示');await wait(200);
 e.panel.remove();e.w.document.querySelector('#bell').click();await wait(180);
 const next=e.mount();await until(()=>hidden(next.querySelector('#muted')),'戻った後も自動で非表示');
 assert.equal(e.values.get('mumei_insight_magazine_filter_enabled_v3:tester'),true);
});

test('BEMの子要素ではなく通知一行全体を判定し、別の先頭人物・スキを残す',async t=>{
 const e=setup(t);e.panel.innerHTML='<button>通知</button><button>お知らせ</button><div class="m-navbarNoticeItem" id="nested"><div class="m-navbarNoticeItem__body"><span class="m-navbarNoticeItem__name">登録人物さん他35名が</span><span class="m-navbarNoticeItem__title">共同マガジンに新しい記事を44本追加しました</span></div></div>'+row('like','登録人物さんがあなたの記事にスキしました')+row('other','別の人物さん他35名が共同マガジンに新しい記事を44本追加しました');
 await until(()=>hidden(e.w.document.querySelector('#nested')),'通知の外枠全体を非表示');
 assert.ok(!hidden(e.w.document.querySelector('#like')));assert.ok(!hidden(e.w.document.querySelector('#other')));
});

test('同じ一覧の再表示・後着通知・本文の差替えを反映し、OFFとグループ無効を維持する',async t=>{
 const e=setup(t);await until(()=>hidden(e.panel.querySelector('#muted')));
 e.panel.hidden=true;await wait(120);e.panel.querySelector('#muted').className='m-navbarNoticeItem';e.panel.hidden=false;
 await until(()=>hidden(e.panel.querySelector('#muted')),'再利用された一覧に再適用');
 e.panel.insertAdjacentHTML('beforeend',row('later'));await until(()=>hidden(e.panel.querySelector('#later')));
 const later=e.panel.querySelector('#later');later.lastChild.textContent='登録人物さんがあなたの記事にスキしました';await until(()=>!hidden(later),'通知本文の更新を反映');
 e.set('mumei_insight_notification_groups_v1:tester',[{enabled:false,ids:['actor']}]);await until(()=>!hidden(e.panel.querySelector('#muted')));
 e.set('mumei_insight_notification_groups_v1:tester',[{enabled:true,ids:['actor']}]);await until(()=>hidden(e.panel.querySelector('#muted')));
 e.set('mumei_insight_magazine_filter_enabled_v3:tester',false);await until(()=>!hidden(e.panel.querySelector('#muted')));
 e.panel.remove();await wait(150);const next=e.mount();await wait(250);assert.ok(!hidden(next.querySelector('#muted')),'OFFも再入場で維持');
 const requests=e.requests();for(let i=0;i<50;i++)e.w.document.querySelector('#page').append(e.w.document.createElement('span'));await wait(200);assert.equal(e.requests(),requests,'無関係の更新で本人APIを繰り返さない');
});

test('親画面ごと非表示になった一覧も復帰し、待機中に表示変更を繰り返さない',async t=>{
 const e=setup(t);await until(()=>hidden(e.panel.querySelector('#muted')));const parent=e.panel.parentElement;
 parent.style.display='none';await wait(150);parent.style.display='';await until(()=>hidden(e.panel.querySelector('#muted'))&&e.panel.querySelector('#mumei-notification-filter-continuation-v4'));
 let changes=0;const observer=new e.w.MutationObserver(ms=>changes+=ms.length);observer.observe(e.panel,{attributes:true,subtree:true});
 await wait(300);observer.disconnect();assert.equal(changes,0,'待機中に書き換えループがない');
});

test('再入場で本人を再確認し、別アカウントに前の人のフィルターを適用しない',async t=>{
 const e=setup(t);await until(()=>hidden(e.panel.querySelector('#muted')));
 e.panel.remove();await wait(150);e.user('another');const next=e.mount();await wait(250);assert.ok(!hidden(next.querySelector('#muted')));
 assert.ok(e.requests()>=2,'新しい一覧で本人を再確認');
});

test('🔔を開いていないDM画面で通知フィルターの本人取得や非表示処理を始めない',async t=>{
 const e=setup(t);e.panel.remove();e.w.history.replaceState({},'', '/messages/rooms/room-one');
 e.w.document.querySelector('#page').innerHTML=row('message');await wait(250);
 assert.equal(e.requests(),0);assert.ok(!hidden(e.w.document.querySelector('#message')));
});

test('実Reader併用：再入場後に人物・人数・本数の間へ改行が入っても同じ通知を隠す',async t=>{
 const e=setup(t,'modern',true);e.panel.querySelector('#muted').append(' 7秒前');
 await until(()=>hidden(e.panel.querySelector('#muted')));
 e.panel.remove();await wait(180);
 const next=e.mount(row('spaced','登録人物 さん 他 35 名 が 【新規募集中】みんな…に新しい記事を\n44 本追加しました 7秒前'));
 await until(()=>hidden(next.querySelector('#spaced')),'空白を含む通知にも保存設定を適用');
});

test('実Reader併用：リンク全体が通知行の一覧と既知クラスが混在しても全行を判定する',async t=>{
 const e=setup(t,'modern',true);e.panel.innerHTML='<button>通知</button><button>お知らせ</button>'+row('like','登録人物さんがスキしました 1分前')+'<a href="/magazine/m123" id="linked"><span>登録人物さん他83名が</span><span>共同マガジンに新しい記事を102本追加しました</span><time>38秒前</time></a>';
 await until(()=>hidden(e.panel.querySelector('#linked')),'Readerが認識するリンク通知もフィルター対象');
 assert.ok(!hidden(e.panel.querySelector('#like')));
});

test('実Reader併用：全行が非表示になりリストの高さが0になっても解除・再適用を繰り返さない',async t=>{
 const e=setup(t,'modern',true);e.panel.innerHTML='<div id="tabs"><button>通知</button><button>お知らせ</button></div><div class="notificationList" id="list">'+row('all','登録人物さんが共同マガジンに新しい記事を3本追加しました 1分前')+'</div>';
 e.w.HTMLElement.prototype.getBoundingClientRect=function(){const zero=this.id==='list'&&hidden(e.w.document.querySelector('#all'));return {width:360,height:zero?0:300}};
 await until(()=>hidden(e.panel.querySelector('#all')));
 e.w.document.querySelector('#bell').click();await wait(350);
 assert.ok(hidden(e.panel.querySelector('#all')),'0高さになっても判定済み行を復活させない');
 const requests=e.requests();await wait(350);assert.equal(e.requests(),requests,'自分の非表示操作で本人APIを反復しない');
});

test('本人APIが一度失敗しても再入場のフィルターを自動回復し、待機中に取り続けない',async t=>{
 const e=setup(t);let calls=0;e.w.fetch=async()=>{calls++;return calls===1?new Response('',{status:503}):Response.json({data:{urlname:'tester'}})};
 await until(()=>hidden(e.panel.querySelector('#muted')),'一時エラー後に自動適用');
 const done=calls;await wait(300);assert.equal(calls,done);
});

test('通信障害では自動再試行を2回で止め、通知を離れると予約を打ち切る',async t=>{
 const e=setup(t);let calls=0;e.w.fetch=async()=>{calls++;return new Response('',{status:503})};
 await wait(1600);assert.equal(calls,3);await wait(500);assert.equal(calls,3,'無限再試行しない');
 e.panel.remove();await wait(120);e.mount();await until(()=>calls===4);e.w.document.querySelector('#panel').remove();
 await wait(600);assert.equal(calls,4,'離脱後に予約した本人取得を始めない');
});

test('保存対象が先頭人物でない通知・スキ・コメントは、空白やリンク行でも隠さない',async t=>{
 const e=setup(t,'modern',true);e.panel.innerHTML='<button>通知</button><button>お知らせ</button>'+row('like','登録人物 さん が あなたの記事にスキしました 3分前')+row('comment','登録人物 さん が コメントしました 4分前')+'<a href="/magazine/m123" id="other-lead">別の人物 さん 他 83 名 が共同マガジンに新しい記事を 102 本追加しました 38秒前</a>';
 await wait(350);for(const id of ['like','comment','other-lead'])assert.ok(!hidden(e.panel.querySelector('#'+id)),id);
});

test('実Reader併用：🔔再入場で後から追加された名前付きクラスのない一覧も自動認識する',async t=>{
 const e=setup(t,'modern',true);e.panel.querySelector('#muted').append(' 3分前');await until(()=>hidden(e.panel.querySelector('#muted')));
 e.panel.remove();e.w.document.querySelector('#bell').click();await wait(220);
 const next=e.w.document.createElement('aside');next.innerHTML='<header><button>通知</button><button>お知らせ</button></header><a href="/magazine/m123" id="late-link">登録人物さんが共同マガジンに新しい記事を3本追加しました 1分前</a>';e.w.document.querySelector('#page').append(next);
 await until(()=>hidden(next.querySelector('#late-link')),'後着のリンク通知一覧を自動認識');
});

test('実操作パネル：ON/OFFを押した結果が保存され、戻った一覧でも表示と適用が一致する',async t=>{
 const e=setup(t,'modern',true);e.panel.querySelector('#muted').append(' 3分前');e.w.eval(readFileSync('public/note-insight-notification-controls-v1.js','utf8'));
 const button=()=>e.w.document.querySelector('[data-action="filter"]');
 await until(()=>button()?.dataset.on==='1'&&hidden(e.panel.querySelector('#muted')));
 button().click();await until(()=>button()?.dataset.on==='0'&&!hidden(e.panel.querySelector('#muted')));assert.equal(e.values.get('mumei_insight_magazine_filter_enabled_v3:tester'),false);
 button().click();await until(()=>button()?.dataset.on==='1'&&hidden(e.panel.querySelector('#muted')));
 e.panel.remove();await wait(250);const next=e.mount(row('returned','登録人物 さん 他 35 名 が共同マガジンに新しい記事を 44 本追加しました 7秒前'));
 await until(()=>button()?.dataset.on==='1'&&hidden(next.querySelector('#returned')),'表示ONと実際の非表示が復帰後も一致');
});

for(const mode of ['modern','legacy'])for(const count of [1,3])test(`実Reader併用：単独人物の本数なし記事追加を全件隠す (${mode}, 通知${count}件)`,async t=>{
 const e=setup(t,mode,true);
 e.set('mumei_insight_magazine_mute_profiles_v5:tester',[{id:'actor',name:'ぱぐぱぱん 絵本作家×作詞家'}]);
 const notice=(id,title)=>`<a href="/magazine/m${id}" id="single-${id}"><img alt="マガジン"><img alt=""><span>ぱぐぱぱん　絵本作家×... さんが</span><span>${title}に記事を追加し\nました</span><p>カロリーファーム②｜600g減！やってき…</p><time>31分前</time></a>`;
 e.panel.innerHTML='<header><a href="#notices">通知</a><a href="#news">お知らせ</a></header>'+Array.from({length:count},(_,i)=>notice(i,i===0?'「書きたい」気持ちをそ...':'【参加者募集中】NOT...')).join('');
 const rows=()=>[...e.panel.querySelectorAll('[id^="single-"]')];
 await until(()=>rows().every(hidden),'1人・1件でも、複数マガジンでも全対象を非表示');
 for(const el of rows())assert.equal(e.w.getComputedStyle(el).display,'none');
 e.set('mumei_insight_magazine_filter_enabled_v3:tester',false);await until(()=>rows().every(el=>!hidden(el)),'OFFで全行を戻す');
 e.set('mumei_insight_magazine_filter_enabled_v3:tester',true);await until(()=>rows().every(hidden),'ONで全行に再適用');
 e.panel.hidden=true;await wait(120);e.panel.hidden=false;await until(()=>rows().every(hidden),'🔔再表示でも単独通知を隠す');
});

test('単独通知の対応後も、スキ・返信・自分の記事追加・未登録人物を表示する',async t=>{
 const e=setup(t,'modern',true);
 e.panel.innerHTML='<button>通知</button><button>お知らせ</button>'+[
  row('own','登録人物さんがあなたの記事をマガジン「作品集」に追加しました 31分前'),
  row('like','登録人物さんがあなたの記事にスキしました 31分前'),
  row('reply','登録人物さんがあなたのコメントに返信しました 31分前'),
  row('unlisted','別の人物さんが作品集に記事を追加しました 31分前'),
  row('quoted','登録人物さんが「作品集に記事を追加しました」という記事にスキしました 31分前'),
  row('target','登録人物さんが作品集に新しい記事を追加しました 31分前'),
 ].join('');
 await until(()=>hidden(e.panel.querySelector('#target')));
 for(const id of ['own','like','reply','unlisted','quoted'])assert.ok(!hidden(e.panel.querySelector('#'+id)),id);
});

test('通知を複数含むnoticeItems外枠を隠さず、対象の一行だけを隠す',async t=>{
 const e=setup(t);
 e.panel.innerHTML='<header><button>通知</button><button>お知らせ</button></header><div class="noticeItems" id="collection">'+row('target')+row('like','登録人物さんがあなたの記事にスキしました')+row('unlisted','別の人物さんが共同マガジンに新しい記事を3本追加しました')+'</div>';
 await until(()=>hidden(e.panel.querySelector('#target')),'一覧の親ではなく対象の一行を非表示');
 assert.ok(!hidden(e.panel.querySelector('#collection')));
 for(const id of ['like','unlisted'])assert.notEqual(e.w.getComputedStyle(e.panel.querySelector('#'+id)).display,'none',id);
 e.set('mumei_insight_magazine_filter_enabled_v3:tester',false);
 await until(()=>!hidden(e.panel.querySelector('#target')),'OFFで対象行も復元');
});

test('以前のフィルターで隠れた一覧の外枠も、混在する通知を復元する',async t=>{
 const e=setup(t);
 e.panel.innerHTML='<header><button>通知</button><button>お知らせ</button></header><div class="noticeItems mumei-muted-v2939" id="collection">'+row('target')+row('like','登録人物さんがあなたの記事にスキしました')+'</div>';
 await until(()=>!hidden(e.panel.querySelector('#collection'))&&hidden(e.panel.querySelector('#target')),'古い外枠の非表示を解き、行ごとに判定し直す');
 assert.notEqual(e.w.getComputedStyle(e.panel.querySelector('#like')).display,'none');
});

test('全件がフィルター対象でもOFFボタンが残り、高さ0の一覧から全件を復元する',async t=>{
 const e=setup(t);
 e.panel.innerHTML='<header><button>通知</button><button>お知らせ</button></header><div class="notificationList" id="list">'+row('only','登録人物さんが共同マガジンに新しい記事を3本追加しました 1分前')+'</div>';
 const list=e.panel.querySelector('#list'),only=e.panel.querySelector('#only');
 e.w.__mumeiNotificationReaderV4.findPanel=()=>list;
 e.w.HTMLElement.prototype.getBoundingClientRect=function(){return {width:360,height:this===list&&hidden(only)?0:300}};
 e.w.eval(readFileSync('public/note-insight-notification-controls-v1.js','utf8'));
 const button=()=>e.w.document.querySelector('[data-action="filter"]');
 await until(()=>hidden(only)&&button()?.isConnected,'全件を隠してもOFF操作を残す');
 assert.match(e.w.document.querySelector('.read-status').textContent,/すべてフィルター対象/);
 button().click();await until(()=>!hidden(only)&&button()?.dataset.on==='0','高さ0でもOFFで一覧全件を表示');
 assert.notEqual(e.w.getComputedStyle(only).display,'none');
});

for(const mode of ['modern','legacy'])test(`先頭12件が対象でもネイティブの続きを読めるスクロール領域を保つ (${mode})`,async t=>{
 const e=setup(t,mode,true);
 e.panel.innerHTML='<header><button>通知</button><button>お知らせ</button></header><div class="notificationList" id="list">'+Array.from({length:12},(_,i)=>row('first-'+i,'登録人物さんが共同マガジンに新しい記事を3本追加しました 1分前')).join('')+'<div id="native-loader"></div></div>';
 await until(()=>e.panel.querySelectorAll('.mumei-muted-v2939').length===12);
 const bridge=e.panel.querySelector('#mumei-notification-filter-continuation-v4');
 assert.ok(bridge,'空白だけの画面にしない');
 assert.ok(Number.parseFloat(bridge.style.minHeight)>e.w.innerHeight,'一覧が短くなってもネイティブ読込位置へ進める');
 assert.equal(bridge.nextElementSibling.id,'native-loader','noteの読込位置の手前に領域を残す');
 assert.match(bridge.textContent,/12件.*下へスクロール/);
 const wheel=new e.w.WheelEvent('wheel',{bubbles:true,cancelable:true,deltaY:400});bridge.dispatchEvent(wheel);assert.equal(wheel.defaultPrevented,false,'ページ本体のスクロールを妨げない');
 for(const [type,y] of [['touchstart',400],['touchmove',100]]){const ev=new e.w.Event(type,{bubbles:true,cancelable:true});Object.defineProperty(ev,'touches',{value:[{clientY:y}]});bridge.dispatchEvent(ev);assert.equal(ev.defaultPrevented,false,'スマホのスワイプを妨げない')}
 e.panel.querySelector('#native-loader').insertAdjacentHTML('beforebegin',row('next-visible','別の人物さんがあなたの記事にスキしました 2分前'));
 await until(()=>!e.panel.querySelector('#mumei-notification-filter-continuation-v4'),'対象外が届けば補助領域を消す');
 assert.equal(hidden(e.panel.querySelector('#next-visible')),false);
 assert.notEqual(e.w.getComputedStyle(e.panel.querySelector('#next-visible')).display,'none');
 assert.equal(e.panel.querySelectorAll('.mumei-muted-v2939').length,12,'先頭の対象通知は復活させない');
 assert.equal(e.values.get('mumei_insight_magazine_filter_enabled_v3:tester'),true);
});

test('続きのページも全件対象なら領域を1つだけ保ち、OFF・離脱・機能OFFで片付ける',async t=>{
 const e=setup(t);await until(()=>e.panel.querySelector('#mumei-notification-filter-continuation-v4'));
 e.panel.insertAdjacentHTML('beforeend',row('second'));
 await until(()=>hidden(e.panel.querySelector('#second'))&&e.panel.querySelector('#mumei-notification-filter-continuation-v4')?.textContent.startsWith('2件'));
 assert.equal(e.panel.querySelectorAll('#mumei-notification-filter-continuation-v4').length,1);
 let changes=0;const observer=new e.w.MutationObserver(ms=>changes+=ms.length);observer.observe(e.panel,{attributes:true,childList:true,characterData:true,subtree:true});await wait(300);observer.disconnect();assert.equal(changes,0,'スクロール待ちで書換えループを起こさない');
 e.set('mumei_insight_magazine_filter_enabled_v3:tester',false);await until(()=>!e.panel.querySelector('#mumei-notification-filter-continuation-v4'));
 assert.ok([...e.panel.querySelectorAll('.m-navbarNoticeItem')].every(el=>!hidden(el)));
 e.set('mumei_insight_magazine_filter_enabled_v3:tester',true);await until(()=>e.panel.querySelector('#mumei-notification-filter-continuation-v4'));
 e.panel.hidden=true;await until(()=>!e.panel.querySelector('#mumei-notification-filter-continuation-v4'),'閉じたパネルに領域を残さない');
 e.panel.hidden=false;await until(()=>e.panel.querySelector('#mumei-notification-filter-continuation-v4'));
 e.w.__mumeiNotificationFeatureV1={isEnabled:()=>false};e.w.dispatchEvent(new e.w.Event('mumei-notification-feature-changed'));
 assert.equal(e.panel.querySelector('#mumei-notification-filter-continuation-v4'),null);
});

test('自動高さのスクロール枠でも補助領域が膨らみ続けず、固定高さの枠には合わせる',async t=>{
 const e=setup(t);e.panel.style.overflowY='auto';
 Object.defineProperty(e.panel,'clientHeight',{configurable:true,get:()=>Number.parseFloat(e.panel.querySelector('#mumei-notification-filter-continuation-v4')?.style.minHeight)||900});
 await until(()=>e.panel.querySelector('#mumei-notification-filter-continuation-v4'));
 const bridge=e.panel.querySelector('#mumei-notification-filter-continuation-v4'),height=bridge.style.minHeight;
 for(let i=0;i<4;i++)await e.w.__mumeiNotificationFilterV4.refresh();
 assert.equal(bridge.style.minHeight,height);
 assert.ok(Number.parseFloat(height)<=e.w.innerHeight+96);
 Object.defineProperty(e.panel,'clientHeight',{value:400,configurable:true});await e.w.__mumeiNotificationFilterV4.refresh();
 assert.equal(bridge.style.minHeight,'496px');assert.equal(e.panel.scrollTop,0,'読込位置へ強制スクロールしない');
});
