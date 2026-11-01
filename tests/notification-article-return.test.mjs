import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

const source=readFileSync('public/note-insight-notification-return-v1.js','utf8');
const STORAGE='mumei_insight_return_bell_tab_v2',ENTRY='__mumeiNotificationReturnV2';
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(check,message){for(let i=0;i<60&&!check();i++)await wait(20);assert.ok(check(),message)}
function fixture(t,{url='https://note.com/',state={router:{key:'native'}},records,load=true,outer=false}={}){
 const dom=new JSDOM('<header><button aria-label="通知" id="bell">🔔</button></header><main></main>',{url,runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
 t.after(()=>w.close());
 w.history.replaceState(state,'',url);if(records)w.sessionStorage.setItem(STORAGE,records);
 w.HTMLElement.prototype.getBoundingClientRect=function(){return{width:360,height:this.hidden?0:400,top:0,bottom:400}};
 let clicks=0,maxHeight=1400,scrollCalls=0;
 w.scrollTo=()=>{scrollCalls++};
 const mount=()=>{
  if(w.document.querySelector('#panel'))return w.document.querySelector('#panel');
  const shell=w.document.createElement('aside');shell.id='shell';
  const panel=w.document.createElement('section');panel.id='panel';panel.innerHTML='<button>通知</button><button>お知らせ</button><div><a id="article" href="/creator/n/n123abc">あなたの記事にスキしました</a><a id="profile" href="/creator">作者</a></div>';
  shell.append(panel);w.document.querySelector('main').append(shell);
  const scroll=outer?shell:panel;scroll.style.overflowY='auto';
  Object.defineProperties(scroll,{clientHeight:{get:()=>400},scrollHeight:{get:()=>maxHeight}});
  let top=0;Object.defineProperty(scroll,'scrollTop',{get:()=>top,set:value=>{top=Math.max(0,Math.min(value,maxHeight-400))}});
  return panel;
 };
 w.__mumeiNotificationReaderV4={findPanel:()=>w.document.querySelector('#panel')};
 w.document.querySelector('#bell').addEventListener('click',()=>{clicks++;mount()});
 const evaluate=()=>w.eval(source);if(load)evaluate();
 const click=(id,options={})=>{const node=w.document.getElementById(id);node.addEventListener('click',event=>event.preventDefault(),{once:true});node.dispatchEvent(new w.MouseEvent('click',{bubbles:true,cancelable:true,button:0,...options}))};
 return{w,mount,evaluate,click,clicks:()=>clicks,scrollCalls:()=>scrollCalls,height:value=>{maxHeight=value},panel:()=>w.document.querySelector('#panel'),scroll:()=>w.document.querySelector(outer?'#shell':'#panel'),navigate:path=>w.history.replaceState({article:true},'',path),back:(state,path='/')=>{w.history.replaceState(state,'',path);w.dispatchEvent(new w.PopStateEvent('popstate',{state}))}};
}

test('article click keeps native navigation and tags only the originating entry; SPA Back restores bell and position',async t=>{
 const f=fixture(t);f.mount();f.scroll().scrollTop=620;
 f.click('article');const marked=f.w.history.state;
 assert.deepEqual(marked.router,{key:'native'});assert.equal(typeof marked[ENTRY],'string');
 assert.equal(f.w.location.pathname,'/');assert.equal(f.clicks(),0);
 f.navigate('/creator/n/n123abc');f.w.document.querySelector('#shell').remove();
 f.back(marked);await until(()=>f.panel()&&f.scroll().scrollTop===620,'restored bell at saved scroll');
 await wait(300);assert.equal(f.clicks(),1);assert.equal(f.w.__mumeiNotificationReturnDone,true);
});

test('native pushState/back/forward/back traversal keeps the original notification entry',async t=>{
 const f=fixture(t);f.mount();f.scroll().scrollTop=520;f.click('article');const marked=f.w.history.state;
 f.w.history.pushState({article:true},'', '/creator/n/n123abc');f.w.document.querySelector('#shell').remove();f.w.history.back();
 await until(()=>f.w.location.pathname==='/'&&f.scroll()?.scrollTop===520,'browser Back restores the source');await wait(300);
 assert.equal(f.w.history.state[ENTRY],marked[ENTRY]);
 f.w.history.forward();await until(()=>f.w.location.pathname==='/creator/n/n123abc');f.w.document.querySelector('#shell').remove();
 f.w.history.back();await until(()=>f.w.location.pathname==='/'&&f.scroll()?.scrollTop===520,'another Back keeps the same source');
 assert.equal(f.clicks(),2);
});

test('Back from a full-document article reload restores a tab-local source entry with outer native scroller',async t=>{
 const first=fixture(t,{outer:true});first.mount();first.scroll().scrollTop=730;first.click('article');
 const f=fixture(t,{outer:true,state:first.w.history.state,records:first.w.sessionStorage.getItem(STORAGE)});
 await until(()=>f.scroll()?.scrollTop===730,'outer scroll ancestor restored after reload');
 await wait(300);assert.equal(f.clicks(),1);
});

test('bfcache pageshow uses the open bell and does not toggle it or erase the filter setting',async t=>{
 const f=fixture(t);f.mount();f.scroll().scrollTop=450;f.w.localStorage.setItem('filter','on');f.click('article');
 f.scroll().scrollTop=0;f.w.dispatchEvent(new f.w.PageTransitionEvent('pageshow',{persisted:true}));
 await until(()=>f.scroll().scrollTop===450,'existing panel position restored');
 await wait(300);assert.equal(f.clicks(),0);assert.equal(f.w.localStorage.getItem('filter'),'on');
});

test('filter/layout changes after the bell opens settle before the final scroll restore',async t=>{
 const first=fixture(t);first.mount();first.scroll().scrollTop=610;first.click('article');
 const f=fixture(t,{state:first.w.history.state,records:first.w.sessionStorage.getItem(STORAGE)});
 await until(()=>f.scroll()?.scrollTop===610);f.scroll().scrollTop=90;
 await until(()=>f.scroll()?.scrollTop===610,'later filter pass does not lose the restored position');
});

test('a delayed filter first pass completes before the final return position settles',async t=>{
 const first=fixture(t);first.mount();first.scroll().scrollTop=610;first.click('article');
 const f=fixture(t,{state:first.w.history.state,records:first.w.sessionStorage.getItem(STORAGE),load:false});let ready=false;
 f.w.__mumeiNotificationFilterV4={findPanel:()=>f.panel(),getState:()=>ready?{enabled:true}:null};f.evaluate();
 await wait(600);assert.equal(f.w.__mumeiNotificationReturnDone,undefined,'does not finish ahead of asynchronous filter state');
 f.scroll().scrollTop=80;ready=true;f.w.dispatchEvent(new f.w.CustomEvent('mumei-notification-filter-status'));
 await until(()=>f.w.__mumeiNotificationReturnDone);assert.equal(f.scroll().scrollTop,610);
});

test('malformed session fields cannot throw or leave the return stuck',async t=>{
 const first=fixture(t);first.mount();first.click('article');const records=JSON.parse(first.w.sessionStorage.getItem(STORAGE));
 records[0].scroll={bad:true};records[0].page={bad:true};
 const f=fixture(t,{state:first.w.history.state,records:JSON.stringify(records)});
 await until(()=>f.w.__mumeiNotificationReturnDone);assert.equal(f.clicks(),1);
});

test('closing the restored bell explicitly removes its source marker before an ordinary reload',async t=>{
 const first=fixture(t);first.mount();first.click('article');
 const f=fixture(t,{state:first.w.history.state,records:first.w.sessionStorage.getItem(STORAGE)});await until(()=>f.w.__mumeiNotificationReturnDone);
 f.w.document.querySelector('#bell').dispatchEvent(new f.w.MouseEvent('click',{bubbles:true,button:0}));
 assert.equal(f.w.history.state[ENTRY],undefined);
 const reload=fixture(t,{state:f.w.history.state,records:f.w.sessionStorage.getItem(STORAGE)});await wait(200);assert.equal(reload.clicks(),0);
});

test('an unrelated history entry at the same URL never opens the bell',async t=>{
 const first=fixture(t);first.mount();first.click('article');
 const f=fixture(t,{records:first.w.sessionStorage.getItem(STORAGE)});
 f.w.dispatchEvent(new f.w.PopStateEvent('popstate'));f.w.dispatchEvent(new f.w.PageTransitionEvent('pageshow',{persisted:true}));
 await wait(300);assert.equal(f.clicks(),0);assert.equal(f.panel(),null);
});

test('another tab, stale records, future records and DM routes never borrow a return',async t=>{
 const first=fixture(t);first.mount();first.click('article');const state=first.w.history.state,original=JSON.parse(first.w.sessionStorage.getItem(STORAGE));
 const cases=[{state},{state,records:JSON.stringify(original.map(r=>({...r,at:Date.now()-7*60*60*1000})))},{state,records:JSON.stringify(original.map(r=>({...r,at:Date.now()+60000})))},{url:'https://note.com/messages/rooms/room',state,records:JSON.stringify(original.map(r=>({...r,source:'https://note.com/messages/rooms/room'})))}];
 for(const args of cases){const f=fixture(t,args);await wait(40);assert.equal(f.clicks(),0)}
});

test('profile links, modified clicks and new-tab/download article links never mark the source',async t=>{
 for(const [id,options,attribute]of [['profile',{}],['article',{ctrlKey:true}],['article',{metaKey:true}],['article',{shiftKey:true}],['article',{},['target','_blank']],['article',{},['download','']]]){
  const f=fixture(t);f.mount();if(attribute)f.w.document.getElementById(id).setAttribute(...attribute);f.click(id,options);
  assert.equal(f.w.history.state[ENTRY],undefined);assert.equal(f.w.sessionStorage.getItem(STORAGE),null);
 }
});

test('scroll restoration stops immediately when the reader starts interacting',async t=>{
 const first=fixture(t);first.mount();first.scroll().scrollTop=600;first.click('article');
 const f=fixture(t,{state:first.w.history.state,records:first.w.sessionStorage.getItem(STORAGE)});
 await until(()=>f.scroll()?.scrollTop===600);f.w.dispatchEvent(new f.w.WheelEvent('wheel',{deltaY:30}));f.scroll().scrollTop=200;
 await wait(400);assert.equal(f.scroll().scrollTop,200);
});

test('pending return cancels on a different route and never reopens its bell there',async t=>{
 const first=fixture(t);first.mount();first.click('article');
 const f=fixture(t,{state:first.w.history.state,records:first.w.sessionStorage.getItem(STORAGE)});
 const clicks=f.clicks();f.navigate('/creator/n/n999abc');f.w.document.querySelector('#shell')?.remove();
 await wait(300);assert.equal(f.clicks(),clicks);assert.equal(f.panel(),null);
});

test('explicit return remains compatible without making hidden bell controls undetectable',async t=>{
 const f=fixture(t,{url:'https://note.com/?mumei_filter_return=bell&keep=1'});
 await until(()=>f.w.__mumeiNotificationReturnDone,'explicit return completes');
 assert.equal(f.clicks(),1);assert.equal(f.w.location.search,'?keep=1');
 assert.equal(f.w.document.documentElement.style.opacity,'');assert.equal(f.w.document.documentElement.getAttribute('data-mumei-bell-return-cloak'),null);
});

test('pageshow during a pending mount keeps one opener attempt',async t=>{
 const f=fixture(t,{url:'https://note.com/?mumei_filter_return=bell',load:false});
 const bell=f.w.document.querySelector('#bell');bell.replaceWith(bell.cloneNode(true));let clicks=0;
 f.w.document.querySelector('#bell').addEventListener('click',()=>{clicks++;f.w.setTimeout(f.mount,150)});
 f.evaluate();f.w.dispatchEvent(new f.w.PageTransitionEvent('pageshow',{persisted:false}));
 await until(()=>f.w.__mumeiNotificationReturnDone);assert.equal(clicks,1);
});

test('return attempt with no bell is bounded and leaves page visibility untouched',async t=>{
 const first=fixture(t);first.mount();first.click('article');
 const f=fixture(t,{state:first.w.history.state,records:first.w.sessionStorage.getItem(STORAGE),load:false});f.w.document.querySelector('#bell').remove();
 let now=Date.now();f.w.Date.now=()=>now;f.evaluate();now+=15000;await wait(160);
 f.mount();await wait(200);assert.equal(f.w.__mumeiNotificationReturnDone,undefined);assert.equal(f.w.document.documentElement.style.visibility,'');
});
