import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

const room='11111111-1111-1111-1111-111111111111';
const source=readFileSync('public/note-insight-dm-reader-v1.js','utf8');
const settle=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(t,{visualViewport=true,contenteditable=false,list=false}={}){
 const editor=contenteditable?'<div id="editor" contenteditable="'+(contenteditable==='plaintext-only'?'plaintext-only':'true')+'" role="textbox" tabindex="0"></div>':'<textarea id="editor"></textarea>';
 const dom=new JSDOM('<header>相手との会話</header><main><section id="conversation" style="overflow-y:auto"><div class="messageText" data-message-id="m1">受信した本文</div></section><form id="composer">'+editor+'<button id="send" type="button">送信</button></form></main>',{url:'https://note.com/messages/rooms/'+(list?'':room),runScripts:'outside-only'}),w=dom.window;
 const observers=[],timers=new Map(),resizeObservers=[],gm=new Map(),sent=[];let nextTimer=0,layoutHeight=800,composerTop=680,editorTop=694,editorHeight=56,scrollWrites=0;
 t.after(()=>{observers.forEach(o=>o.disconnect());dom.window.close()});
 const Observer=w.MutationObserver;w.MutationObserver=class extends Observer{constructor(fn){super(fn);observers.push(this)}};
 w.ResizeObserver=class{constructor(fn){this.fn=fn;resizeObservers.push(this)}observe(el){this.el=el}disconnect(){this.el=null}};
 const rect=(top,height,left=8,width=359)=>({top,bottom:top+height,left,right:left+width,width,height,x:left,y:top});
 Object.defineProperty(w,'innerHeight',{get:()=>layoutHeight});Object.defineProperty(w.document.documentElement,'clientHeight',{get:()=>layoutHeight});
 w.HTMLElement.prototype.getBoundingClientRect=function(){if(this.hidden||this.style.display==='none')return rect(0,0,0,0);if(this.id==='editor')return rect(editorTop,editorHeight,24,270);if(this.id==='composer')return rect(composerTop,editorTop+editorHeight+30-composerTop);if(this.id==='send')return rect(composerTop+4,64,310,50);if(this.id==='mumei-dm-reader-status'){const bottom=Number((this.style.bottom||'8px').match(/[\d.]+/)?.[0]||8);return rect(layoutHeight-bottom-18,18)}if(this.classList.contains('messageText'))return rect(120,64,24,260);return rect(0,layoutHeight,0,375)};
 w.setTimeout=(fn,ms=0)=>{const id=++nextTimer;timers.set(id,{fn,ms});return id};w.clearTimeout=id=>timers.delete(id);w.setInterval=()=>0;w.clearInterval=()=>{};
 const vv=new w.EventTarget();Object.assign(vv,{height:800,offsetTop:0,scale:1});Object.defineProperty(w,'visualViewport',{value:visualViewport?vv:undefined});
 const host=w.document.getElementById('conversation');Object.defineProperty(host,'scrollHeight',{value:2000});Object.defineProperty(host,'clientHeight',{value:500});Object.defineProperty(host,'scrollTop',{get:()=>600,set:()=>{scrollWrites++}});
 gm.set('mumei_insight_dm_sync_token_v1:tester','fixture');
 w.fetch=async()=>({ok:true,json:async()=>({data:{urlname:'tester'}})});
 w.GM={getValue:async(k,d)=>gm.get(k)??d,setValue:async(k,v)=>gm.set(k,structuredClone(v)),xmlHttpRequest:opts=>{const body=JSON.parse(opts.data);sent.push(...body.messages);opts.onload({status:200,responseText:JSON.stringify({ok:true,confirmedMessageKeys:body.messages.map(m=>m.message_key)})})}};
 const end=source.lastIndexOf('{let timer=0,running=false;');assert.ok(end>0);
 w.eval(source.slice(0,end)+'window.__dmComposerTest={showStatus,statusLayout,composing,isManuallyPaused:()=>manualPaused};'+source.slice(end));
 const ui=w.__dmComposerTest;
 async function flushLayout(){await settle();for(let cycle=0;cycle<4;cycle++){const ready=[...timers].filter(([,v])=>v.ms<=32);if(!ready.length)break;for(const [id,v] of ready){timers.delete(id);v.fn()}await settle()}}
 return{w,ui,gm,sent,vv,get editor(){return w.document.getElementById('editor')},get panel(){return w.document.getElementById('mumei-dm-reader-status')},show:state=>ui.showStatus({threadCount:20,lastReadCount:40,lastSavedCount:20,storedMessageCount:20,...state}),flushLayout,geometry(v){if(v.composerTop!==undefined)composerTop=v.composerTop;if(v.editorTop!==undefined)editorTop=v.editorTop;if(v.editorHeight!==undefined)editorHeight=v.editorHeight;if(v.layoutHeight!==undefined)layoutHeight=v.layoutHeight},resize(){resizeObservers.forEach(o=>{if(o.el)o.fn()})},scrollWrites:()=>scrollWrites};
}
function safeComposer(h){const r=h.panel.getBoundingClientRect(),composer=h.w.document.getElementById('composer').getBoundingClientRect(),send=h.w.document.getElementById('send').getBoundingClientRect();assert.ok(r.bottom<=composer.top-8||r.top>=composer.bottom+3);assert.ok(r.bottom<send.top||r.top>send.bottom);assert.equal(h.panel.hidden,false);assert.equal(h.panel.style.display,'flex')}

test('DMは入力欄の下の隙間へ薄型進捗を置き、続き読込ボタンを出さない',t=>{const h=fixture(t);h.show();safeComposer(h);assert.match(h.panel.textContent,/過去分を取得中.*本文保存 20件/);assert.equal(h.panel.querySelector('button'),null)});
for(const contenteditable of [false,true,'plaintext-only'])test((contenteditable==='plaintext-only'?'plaintext-only':contenteditable?'contenteditable':'textarea')+'入力中は即座に隠れ、遅い保存応答でも復活せず下書きを保持する',async t=>{
 const h=fixture(t,{contenteditable});h.show();if(contenteditable)h.editor.textContent='編集中の下書き\n二行目';else h.editor.value='編集中の下書き\n二行目';h.editor.focus();
 assert.equal(h.panel.hidden,true);assert.equal(h.panel.style.display,'none');h.show({lastSavedCount:25,storedMessageCount:25});await h.flushLayout();assert.equal(h.panel.hidden,true);assert.equal(h.ui.isManuallyPaused(),false);assert.equal(contenteditable?h.editor.textContent:h.editor.value,'編集中の下書き\n二行目');
 h.editor.blur();await h.flushLayout();safeComposer(h);assert.match(h.panel.textContent,/本文保存 25件/);
});
test('キーボード・拡大表示中は隠し、閉じた後に安全な位置へ戻す',async t=>{
 const h=fixture(t);h.show();h.vv.height=450;h.vv.dispatchEvent(new h.w.Event('resize'));await h.flushLayout();assert.equal(h.panel.hidden,true);h.show({lastSavedCount:27});assert.equal(h.panel.hidden,true);
 h.vv.height=800;h.vv.scale=1.5;h.vv.dispatchEvent(new h.w.Event('resize'));await h.flushLayout();assert.equal(h.panel.hidden,true);h.vv.scale=1;h.vv.dispatchEvent(new h.w.Event('resize'));await h.flushLayout();safeComposer(h);
});
test('入力欄の高さ変更と横向き画面でもパネルが入力欄へ重ならない',async t=>{
 const h=fixture(t);h.show();h.geometry({composerTop:590,editorTop:604,editorHeight:130});h.resize();await h.flushLayout();safeComposer(h);
 h.geometry({layoutHeight:400,composerTop:280,editorTop:294,editorHeight:56});h.vv.height=400;h.w.dispatchEvent(new h.w.Event('orientationchange'));await h.flushLayout();safeComposer(h);
});
test('入力欄を検出できない時や上に場所がない時は表示を控える',async t=>{
 const h=fixture(t);h.show();h.editor.remove();await h.flushLayout();assert.equal(h.panel.hidden,true);h.w.document.getElementById('composer').insertAdjacentHTML('afterbegin','<textarea id="editor"></textarea>');h.geometry({layoutHeight:120,composerTop:25,editorTop:35});h.vv.height=120;await h.flushLayout();assert.equal(h.panel.hidden,true);
 h.geometry({layoutHeight:800,composerTop:680,editorTop:694});h.vv.height=800;h.resize();await h.flushLayout();safeComposer(h);
});
test('VisualViewportがないブラウザでも入力中は隠れ、復帰後は入力欄の上に置く',async t=>{const h=fixture(t,{visualViewport:false});h.show();safeComposer(h);h.editor.focus();assert.equal(h.panel.hidden,true);h.editor.blur();await h.flushLayout();safeComposer(h)});
test('DM一覧では小さな取得表示だけを残し、通知画面では遅い進捗でも復活させない',async t=>{
 const h=fixture(t,{list:true});h.w.document.querySelector('form').remove();h.show();assert.equal(h.panel.hidden,false);assert.equal(h.panel.querySelector('button'),null);assert.match(h.panel.textContent,/0\/20人.*本文保存 20件/);
 const bell=h.w.document.createElement('section');bell.innerHTML='<button role="tab">通知</button><button role="tab">お知らせ</button><div class="m-navbarNoticeItem">通知</div>';h.w.document.body.append(bell);await h.flushLayout();assert.equal(h.panel,null);h.show({lastSavedCount:50});assert.equal(h.panel,null);
});
test('文字入力中も取得済み本文を保存し、本人の会話をスクロールせず途中状態を保持する',async t=>{
 const h=fixture(t);h.editor.value='送信前の下書き';h.editor.focus();const result=await h.w.__mumeiInsightDmReaderV1Api.scanRoom({id:'tester'},room,h.w.document,h.w.location.href);
 assert.equal(result.saved,1);assert.equal(result.complete,false);assert.equal(result.pausedForInput,true);assert.equal(h.scrollWrites(),0);assert.equal(h.editor.value,'送信前の下書き');assert.equal(h.sent[0].body,'受信した本文');assert.ok(h.sent.every(m=>!m.body.includes('下書き')));assert.equal(h.panel.hidden,true);assert.equal(h.ui.isManuallyPaused(),false);
});
test('form外のplaintext-only入力とその子要素を送信済みDM本文として保存しない',async t=>{
 const h=fixture(t,{contenteditable:'plaintext-only'}),form=h.w.document.getElementById('composer'),replacement=h.w.document.createElement('div');replacement.id='composer';replacement.append(...form.childNodes);form.replaceWith(replacement);h.editor.removeAttribute('role');h.editor.innerHTML='<span class="messageText">まだ送信していない下書き</span>';h.editor.focus();
 const result=await h.w.__mumeiInsightDmReaderV1Api.scanRoom({id:'tester'},room,h.w.document,h.w.location.href);assert.equal(result.saved,1);assert.equal(h.sent.length,1);assert.equal(h.sent[0].body,'受信した本文');assert.equal(h.scrollWrites(),0);assert.equal(h.editor.textContent,'まだ送信していない下書き');
});

function accountMenu(h,{semantic=false}={}){
 const menu=h.w.document.createElement('section');
 if(semantic)menu.setAttribute('role','menu');else menu.style.position='fixed';
 menu.innerHTML='<a href="/dashboard">ダッシュボード</a><a href="/settings">設定</a><a href="/notes">自分の記事</a><a href="/notes/drafts">下書き</a><a href="/purchases">購入した</a><a href="/likes">スキした</a><a href="/recent">最近見た</a>';
 h.w.document.body.append(menu);return menu;
}
for(const semantic of [false,true])test(`DM一覧のアカウントメニュー中は完了帯だけを隠し、遅い進捗と開閉を安全に扱う (${semantic?'role':'mobile'})`,async t=>{
 const h=fixture(t,{list:true});h.w.document.querySelector('form').remove();
 h.show({lastRunComplete:true,currentThread:41,threadCount:41,storedMessageCount:5257});
 const panel=h.panel,menu=accountMenu(h,{semantic});await h.flushLayout();
 assert.equal(h.w.location.pathname,'/messages/rooms/');assert.equal(h.panel,panel);assert.equal(panel.hidden,true);assert.equal(panel.style.display,'none');
 h.show({lastRunComplete:true,currentThread:41,threadCount:41,storedMessageCount:5258});await h.flushLayout();
 assert.equal(panel.hidden,true);assert.equal(h.ui.isManuallyPaused(),false);assert.equal(h.gm.get('mumei_insight_dm_sync_token_v1:tester'),'fixture');
 for(let i=0;i<3;i++){menu.hidden=true;await h.flushLayout();assert.equal(panel.hidden,false);assert.match(panel.textContent,/41\/41人.*5258件/);menu.hidden=false;await h.flushLayout();assert.equal(panel.hidden,true)}
 menu.remove();await h.flushLayout();assert.equal(panel.hidden,false);assert.equal(h.panel,panel);
});
test('メニューを開く前に届く完了応答も表示せず、同期の保存内容を変更しない',async t=>{
 const h=fixture(t);const menu=accountMenu(h);h.editor.value='送信前の下書き';h.editor.focus();
 h.show({lastRunComplete:true,storedMessageCount:5257});assert.equal(h.panel.hidden,true);
 const result=await h.w.__mumeiInsightDmReaderV1Api.scanRoom({id:'tester'},room,h.w.document,h.w.location.href,()=>true);
 assert.equal(result.saved,1);assert.equal(h.sent[0].body,'受信した本文');assert.equal(h.editor.value,'送信前の下書き');assert.equal(h.panel.hidden,true);assert.equal(h.ui.isManuallyPaused(),false);
 menu.style.display='none';h.editor.blur();await h.flushLayout();assert.equal(h.panel.hidden,false);
});
test('非表示メニューと通常本文・静的リンクをメニューとして扱わない',async t=>{
 const h=fixture(t,{list:true});h.w.document.querySelector('form').remove();h.show();const menu=accountMenu(h);menu.hidden=true;await h.flushLayout();assert.equal(h.panel.hidden,false);
 const article=h.w.document.createElement('aside');article.innerHTML='<a>自分の記事</a><a>下書き</a><a>購入した</a><p>スキした 最近見た</p>';h.w.document.querySelector('main').append(article);await h.flushLayout();assert.equal(h.panel.hidden,false);
 menu.hidden=false;menu.setAttribute('aria-hidden','true');await h.flushLayout();assert.equal(h.panel.hidden,false);
 menu.removeAttribute('aria-hidden');await h.flushLayout();assert.equal(h.panel.hidden,true);
 h.w.history.pushState({},'', '/settings');await h.flushLayout();h.ui.statusLayout();assert.equal(h.panel,null);h.show();assert.equal(h.panel,null);
});

test('画面外・透明な閉じたメニューはDM帯を隠さず、表示変更に追従する',async t=>{
 const h=fixture(t,{list:true});h.w.document.querySelector('form').remove();h.show();const menu=accountMenu(h);
 menu.style.opacity='0';await h.flushLayout();assert.equal(h.panel.hidden,false);
 menu.style.opacity='1';const original=menu.getBoundingClientRect;menu.getBoundingClientRect=()=>({top:0,bottom:800,left:1200,right:1575,width:375,height:800});await h.flushLayout();assert.equal(h.panel.hidden,false);
 menu.getBoundingClientRect=original;menu.style.transform='none';await h.flushLayout();assert.equal(h.panel.hidden,true);
 menu.remove();await h.flushLayout();assert.equal(h.panel.hidden,false);
 const modal=h.w.document.createElement('section');h.w.document.body.append(modal);await h.flushLayout();assert.equal(h.panel.hidden,false);
 modal.setAttribute('aria-modal','true');await h.flushLayout();assert.equal(h.panel.hidden,true);
 modal.removeAttribute('aria-modal');await h.flushLayout();assert.equal(h.panel.hidden,false);
 modal.setAttribute('role','dialog');await h.flushLayout();assert.equal(h.panel.hidden,true);
 modal.remove();await h.flushLayout();assert.equal(h.panel.hidden,false);
 const dialog=h.w.document.createElement('dialog');h.w.document.body.append(dialog);dialog.setAttribute('open','');await h.flushLayout();assert.equal(h.panel.hidden,true);
 dialog.removeAttribute('open');await h.flushLayout();assert.equal(h.panel.hidden,false);
});

test('スクロールしたメニューの項目が画面外でも帯を隠し、画面外のメニューから外側の固定枠へ判定を広げない',async t=>{
 const h=fixture(t,{list:true});h.w.document.querySelector('form').remove();h.show();const menu=accountMenu(h);
 for(const link of menu.querySelectorAll('a'))link.getBoundingClientRect=()=>({top:-300,bottom:-250,left:8,right:367,width:359,height:50});
 await h.flushLayout();assert.equal(h.panel.hidden,true);
 const outer=h.w.document.createElement('div');outer.style.position='fixed';h.w.document.body.append(outer);outer.append(menu);
 menu.getBoundingClientRect=()=>({top:0,bottom:800,left:1200,right:1575,width:375,height:800});menu.style.transform='translateX(1200px)';await h.flushLayout();assert.equal(h.panel.hidden,false);
});
