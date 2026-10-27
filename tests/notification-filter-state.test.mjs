import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

const read=path=>readFileSync('public/'+path,'utf8');
const TOOLBAR='mumei-inline-notification-controls-v1',DIALOG=TOOLBAR+'-filter-state';
const FIL='mumei_insight_magazine_filter_enabled_v3:tester',GRP='mumei_insight_notification_groups_v1:tester';
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(check,message='UI settles'){for(let i=0;i<100;i++){if(check())return;await pause(10)}assert.ok(check(),message)}
const added='さん他35名が架空の共同マガジンに新しい記事を36本追加しました';
const markup='<section id="panel" class="notificationList"><button>通知</button><button>お知らせ</button>'+
 '<div class="m-navbarNoticeItem"><a href="/fictional_actor">架空の登録人物</a>'+added+'<time>1分前</time></div>'+
 '<div class="m-navbarNoticeItem"><a href="/fictional_other">架空の別人物</a>'+added+'<time>2分前</time></div>'+
 '<div class="m-navbarNoticeItem"><a href="/fictional_actor">架空の登録人物</a>さんがあなたの記事にスキしました<time>3分前</time></div>'+
 '<div class="m-navbarNoticeItem">人物を確認できない架空の名前'+added+'<time>4分前</time></div></section>';

async function fixture(t,{mode='modern',filter=true,pending=false,clipboard='success',nativeCapture}={}){
 const dom=new JSDOM(markup,{url:'https://note.com/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;t.after(()=>w.close());
 w.HTMLElement.prototype.getBoundingClientRect=()=>({width:360,height:320,top:0,bottom:320,left:0,right:360});
 const values=new Map([[FIL,true],[GRP,[{enabled:true,ids:['fictional_actor']}]],['mumei_insight_magazine_mute_profiles_v5:tester',[{id:'fictional_actor',name:'架空の登録人物'}]],['mumei_insight_notification_panel_enabled_v1',true]]),requests=[],writes=[],copies=[],gmReads=[];let outside=0;
 const get=(key,fallback)=>{gmReads.push(key);return values.get(key)??fallback},set=(key,value)=>{writes.push({key,value});values.set(key,value)};
 if(mode==='modern')w.GM={getValue:async(...args)=>get(...args),setValue:async(...args)=>set(...args)};
 else{w.GM_getValue=get;w.GM_setValue=set}
 w.fetch=async url=>{requests.push(String(url));assert.equal(url,'/api/v2/current_user','diagnostics do not request notifications, profiles, or a backend');if(pending)return new Promise(()=>{});return Response.json({data:{urlname:'tester'}})};
 Object.defineProperty(w.navigator,'clipboard',{value:{writeText:async value=>{if(clipboard==='failure')throw Error('clipboard unavailable');copies.push(value)}}});
 w.__mumeiNotificationReaderV4={findPanel:()=>w.document.getElementById('panel'),isPaused:()=>true};
 const installNativeOutside=()=>{for(const type of ['pointerdown','pointerup','mousedown','mouseup','touchstart','touchend','click','contextmenu','keydown'])w.document.addEventListener(type,event=>{const panel=w.document.getElementById('panel');if(!panel.contains(event.target)){outside++;panel.hidden=true}},true)};
 if(nativeCapture==='before')installNativeOutside();
 if(filter)w.eval(read('note-insight-notification-filter-v4.js'));
 w.eval(read('note-insight-notification-controls-v1.js'));
 if(nativeCapture==='after')installNativeOutside();
 if(filter&&!pending)await w.__mumeiNotificationFilterV4.refresh(true);
 await until(()=>w.document.querySelector('#'+TOOLBAR+' [data-action="filter-state"]'));
 if(!pending)await until(()=>w.document.querySelector('[data-action="filter"] small')?.textContent==='ON');
 const opener=()=>w.document.querySelector('#'+TOOLBAR+' [data-action="filter-state"]');
 const overlay=()=>w.document.getElementById(DIALOG),card=()=>overlay()?.querySelector('[role="dialog"]');
 const open=async()=>{opener().focus();opener().click();await until(()=>card());return card()};
 const button=name=>[...card().querySelectorAll('button')].find(el=>el.textContent===name);
 const rows=()=>Object.fromEntries([...card().querySelectorAll('dt')].map(el=>[el.textContent,el.nextElementSibling.textContent]));
 return{w,values,requests,writes,copies,gmReads,open,opener,overlay,card,button,rows,outside:()=>outside};
}

for(const mode of ['modern','legacy'])test(`実際のフィルター件数を匿名で確認・コピーし、設定や通信を増やさない (${mode})`,async t=>{
 const f=await fixture(t,{mode}),beforeRequests=f.requests.length,beforeWrites=f.writes.length;
 assert.equal(f.w.document.querySelectorAll('#'+TOOLBAR+'>button').length,6,'状態も既存の操作行に収める');assert.equal(f.opener().parentElement.id,TOOLBAR);assert.equal(f.w.document.querySelector('#'+TOOLBAR+' .panel-meta button'),null,'下段の高さを増やすボタンを置かない');assert.equal(f.w.getComputedStyle(f.opener()).height,'32px');assert.equal(f.w.getComputedStyle(f.opener()).boxSizing,'border-box');
 await f.open();const rows=f.rows(),version=f.w.__mumeiNotificationFilterV4.version;
 assert.deepEqual(rows,{'実行版':version,'フィルター':'ON','有効な登録人物':'1人','判定した通知':'4件','マガジン追加通知':'3件','非表示':'1件','人物未確認':'1件'});
 assert.equal(f.card().getAttribute('aria-modal'),'true');assert.equal(f.w.document.getElementById(f.card().getAttribute('aria-labelledby')).textContent,'フィルターの状態');
 f.button('状態をコピー').click();await until(()=>f.copies.length===1);
 assert.match(f.copies[0],/フィルターの状態（匿名）/);assert.match(f.copies[0],/非表示: 1件/);assert.doesNotMatch(f.copies[0],/tester|fictional_actor|架空の登録人物|共同マガジン|35名/);
 assert.equal(f.requests.length,beforeRequests);assert.equal(f.writes.length,beforeWrites,'閲覧・コピーでは設定を変更しない');
});

for(const mode of ['modern','legacy'])test(`保存設定がONでも未起動なら実行済みとせず案内する (${mode})`,async t=>{
 const f=await fixture(t,{mode,filter:false});assert.equal(f.w.document.querySelector('[data-action="filter"] small').textContent,'ON');
 await f.open();assert.equal(f.rows()['実行版'],'未起動');assert.equal(f.rows()['フィルター'],'未確認');assert.equal(f.rows()['非表示'],'未確認');assert.match(f.card().textContent,/フィルターが起動していません/);
});

test('ロード済みでも最初の判定前は前回の成功値を表示しない',async t=>{
 const f=await fixture(t,{pending:true});await f.open();assert.equal(f.rows()['実行版'],f.w.__mumeiNotificationFilterV4.version);assert.equal(f.rows()['判定した通知'],'未確認');assert.equal(f.rows()['非表示'],'未確認');assert.match(f.card().textContent,/判定待ち/);
});

test('コピーは将来の余分な状態項目や壊れた数値・版から個人情報を拾わない',async t=>{
 const f=await fixture(t),state=f.w.__mumeiNotificationFilterV4.getState();
 Object.assign(state,{account:'private-account-id',name:'PRIVATE-NAME',body:'PRIVATE-NOTIFICATION-BODY',token:'PRIVATE-TOKEN',version:'PRIVATE-VERSION',registered:'PRIVATE-COUNT',total:Infinity,hidden:-1,unresolved:NaN});
 await f.open();assert.equal(f.rows()['実行版'],'未確認');assert.equal(f.rows()['有効な登録人物'],'未確認');assert.equal(f.rows()['判定した通知'],'未確認');assert.equal(f.rows()['非表示'],'未確認');
 f.button('状態をコピー').click();await until(()=>f.copies.length===1);assert.doesNotMatch(f.copies[0],/PRIVATE|private|Infinity|NaN|-1|tester|fictional/);
});

test('閉じる・Escape・背景クリックが動き、フォーカスと元のスクロール設定を戻す',async t=>{
 const f=await fixture(t);f.w.document.body.style.setProperty('overflow','auto','important');
 await f.open();const close=f.button('閉じる'),copy=f.button('状態をコピー');assert.equal(f.w.document.activeElement,close);assert.equal(f.w.getComputedStyle(close).minHeight,'44px');
 close.dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true}));assert.equal(f.w.document.activeElement,copy,'末尾から先頭へフォーカスを閉じ込める');
 copy.dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'Tab',shiftKey:true,bubbles:true,cancelable:true}));assert.equal(f.w.document.activeElement,close);
 close.dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));assert.equal(f.overlay(),null);assert.equal(f.w.document.activeElement,f.opener());assert.equal(f.w.document.body.style.getPropertyValue('overflow'),'auto');assert.equal(f.w.document.body.style.getPropertyPriority('overflow'),'important');
 await f.open();f.overlay().click();assert.equal(f.overlay(),null);assert.equal(f.w.document.activeElement,f.opener());
 await f.open();f.button('閉じる').click();assert.equal(f.overlay(),null);assert.equal(f.w.document.activeElement,f.opener());
});

test('クリップボードが使えなければ匿名の内容だけを選択して手動コピーできる',async t=>{
 const f=await fixture(t,{clipboard:'failure'});await f.open();f.button('状態をコピー').click();await until(()=>!f.card().querySelector('textarea').hidden);
 const area=f.card().querySelector('textarea');assert.equal(area.readOnly,true);assert.match(area.value,/非表示: 1件/);assert.doesNotMatch(area.value,/tester|fictional|架空の登録人物/);assert.match(f.card().textContent,/下の内容を選択してコピー/);assert.equal(f.w.document.activeElement,area);
 area.dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));assert.equal(f.w.document.activeElement,f.opener());
});

test('開いている間のON・OFFと有効0人を実際の最新判定から更新する',async t=>{
 const f=await fixture(t);await f.open();f.values.set(FIL,false);await f.w.__mumeiNotificationFilterV4.refresh(true);await until(()=>f.rows()['フィルター']==='OFF');assert.equal(f.rows()['非表示'],'0件');
 f.values.set(GRP,[]);f.values.set(FIL,true);await f.w.__mumeiNotificationFilterV4.refresh(true);await until(()=>f.rows()['有効な登録人物']==='0人');assert.match(f.card().textContent,/有効な登録人物が0人/);
 f.values.set('mumei_insight_notification_panel_enabled_v1',false);await f.w.__mumeiNotificationControlsV1.refreshPanel();assert.equal(f.overlay(),null,'操作パネルをOFFにしたら状態画面も閉じる');
});

for(const nativeCapture of ['before','after'])test(`noteの外側クリック監視へ状態画面の操作を流さず、コピーを一回だけ実行する (${nativeCapture})`,async t=>{
 const f=await fixture(t,{nativeCapture});await f.open();const copy=f.button('状態をコピー');
 for(const type of ['pointerdown','pointerup','mousedown','mouseup','touchstart','touchend','contextmenu']){const event=new f.w.Event(type,{bubbles:true,cancelable:true});copy.dispatchEvent(event);assert.equal(event.defaultPrevented,false,type+'は既定のフォーカス・選択を妨げない')}
 copy.dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'a',bubbles:true,cancelable:true}));
 copy.click();await until(()=>f.copies.length===1);await pause(20);assert.equal(f.copies.length,1);assert.equal(f.outside(),0);assert.equal(f.w.document.getElementById('panel').hidden,false);assert.ok(f.overlay(),'noteの通知一覧が閉じられてもろとも消えない');
 f.button('閉じる').click();assert.equal(f.overlay(),null);assert.equal(f.outside(),0);
 await f.open();f.overlay().click();assert.equal(f.overlay(),null);assert.equal(f.outside(),0);
 await f.open();f.button('閉じる').dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));assert.equal(f.overlay(),null);assert.equal(f.outside(),0);assert.equal(f.w.document.getElementById('panel').hidden,false);
});

for(const mode of ['modern','legacy'])test(`同じ描画フレームの連続した判定は最新の一回だけ表示し、開く・コピーは最新値を読む (${mode})`,async t=>{
 const f=await fixture(t,{mode});await pause(220); // Drain initial discovery before measuring the next frame.
 const api=f.w.__mumeiNotificationFilterV4;let state={...api.getState(),total:200,magazineAdd:150},reads=0,formats=0,refreshes=0;
 const Format=f.w.Intl.NumberFormat;f.w.Intl.NumberFormat=function(...args){formats++;return new Format(...args)};
 api.getState=()=>{reads++;return state};api.refresh=()=>{refreshes++};
 const before={requests:f.requests.length,gmReads:f.gmReads.length,writes:f.writes.length};
 await f.open();assert.equal(reads,1,'opening reads the live state once');assert.ok(formats<=1,'one formatter is reused for all count values');
 const frames=[];f.w.requestAnimationFrame=callback=>{frames.push(callback);return frames.length};
 for(let i=0;i<100;i++){state={...state,hidden:i};f.w.dispatchEvent(new f.w.CustomEvent('mumei-notification-filter-status',{detail:state}))}
 assert.equal(frames.length,1,'the same frame does not queue repeated paints');assert.equal(reads,1,'a burst does not synchronously reread state');
 frames.shift()();assert.equal(reads,2,'one state read feeds both toolbar and dialog');assert.equal(f.rows()['非表示'],'99件');assert.ok(formats<=1);
 state={...state,hidden:147};f.button('状態をコピー').click();await until(()=>f.copies.length===1);
 assert.equal(reads,3,'copy uses the current state even before another UI event');assert.match(f.copies[0],/非表示: 147件/);
 assert.equal(f.requests.length,before.requests);assert.equal(f.gmReads.length,before.gmReads);assert.equal(f.writes.length,before.writes);assert.equal(refreshes,0);
});

test('外部から消えた状態画面へ描画を続けず、状態ボタンから新しい画面を開ける',async t=>{
 const f=await fixture(t);f.w.document.body.style.setProperty('overflow','auto','important');await f.open();
 const oldOverlay=f.overlay(),oldCard=f.card(),oldText=oldCard.textContent,api=f.w.__mumeiNotificationFilterV4,state={...api.getState(),hidden:2};
 oldOverlay.remove();api.getState=()=>state;
 f.w.dispatchEvent(new f.w.CustomEvent('mumei-notification-filter-status',{detail:state}));
 await new Promise(resolve=>f.w.requestAnimationFrame(resolve));
 assert.equal(f.overlay(),null);assert.equal(oldCard.textContent,oldText,'removed UI is not repainted');assert.equal(f.w.document.body.style.getPropertyValue('overflow'),'auto');assert.equal(f.w.document.body.style.getPropertyPriority('overflow'),'important');
 await f.open();assert.notEqual(f.overlay(),oldOverlay);assert.equal(f.rows()['非表示'],'2件');f.button('閉じる').click();assert.equal(f.w.document.body.style.getPropertyValue('overflow'),'auto');
});

test('状態画面が外部削除された直後も元のページのキー操作を遮らない',async t=>{
 const f=await fixture(t);f.w.document.body.style.setProperty('overflow','auto','important');await f.open();f.overlay().remove();
 let delivered=0;f.w.document.addEventListener('keydown',()=>delivered++);
 const event=new f.w.KeyboardEvent('keydown',{key:'a',bubbles:true,cancelable:true});f.w.document.querySelector('#panel button').dispatchEvent(event);
 assert.equal(delivered,1);assert.equal(event.defaultPrevented,false);assert.equal(f.w.document.body.style.getPropertyValue('overflow'),'auto');
 await f.open();assert.ok(f.card());f.button('閉じる').click();assert.equal(f.overlay(),null);
});
