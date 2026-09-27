import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

const source=readFileSync('public/note-insight-notification-filter-v4.js','utf8');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const hidden=el=>el.classList.contains('mumei-muted-v2939');
const row=(id='muted',text='登録人物さん他35名が共同マガジンに新しい記事を44本追加しました')=>`<div class="m-navbarNoticeItem" id="${id}"><a href="/actor"><img></a>${text}</div>`;
async function until(fn,message){for(let i=0;i<60;i++){if(fn())return;await wait(20)}assert.ok(fn(),message)}
function setup(t,mode='modern'){
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
 w.__mumeiNotificationReaderV4={findPanel:()=>{const p=w.document.querySelector('#panel');return p&&!p.hidden&&p.style.display!=='none'?p:null}};
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
 parent.style.display='none';await wait(150);parent.style.display='';await until(()=>hidden(e.panel.querySelector('#muted')));
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
