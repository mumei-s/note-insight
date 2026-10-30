import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

const source=readFileSync('public/note-insight-notification-checkpoint-v325.js','utf8');
const CHECK='mumei_insight_notification_checkpoint_v2922:',LOCAL='mumei_insight_notification_checkpoint_local_v325:',LINE='mumei-v3-saved-boundary-v3223';
const body='人物さんがあなたの記事にスキしました記事',target='https://note.com/person/n/article';
const row=(id,{noticeId=id,article=target,text=body}={})=>'<div id="'+id+'" class="m-navbarNoticeItem"'+(noticeId?' data-notice-id="'+noticeId+'"':'')+'><a href="https://note.com/person">人物</a>'+text.slice(2,-2)+'<a href="'+article+'">記事</a><time>1分前</time></div>';
const cp=(id,extra={})=>({boundaryEventIdentity:'notice:'+id,boundaryDisplayText:body,boundaryTargetUrl:target,boundaryAt:100,...extra});
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done});return{promise,resolve}};
async function fixture(t,{rows=row('old'),values=new Map([[CHECK+'a',cp('old')]]),account='a'}={}){
 const dom=new JSDOM('<section id="panel">'+rows+'</section>',{url:'https://note.com/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;t.after(()=>w.close());
 // Keep the initial browser pageshow outside the fixture's explicit lifecycle.
 await wait(0);w.HTMLElement.prototype.getBoundingClientRect=()=>({width:360,height:100,top:0,bottom:100,left:0,right:360});
 let active=account,readHook=null,fetchHook=null;const reads=[],writes=[],fetches=[];
 w.fetch=async()=>{fetches.push(active);return fetchHook?fetchHook(active):Response.json({data:{urlname:active}})};
 w.GM={getValue:async(key,fallback)=>{reads.push(key);return readHook?readHook(key,fallback):values.has(key)?values.get(key):fallback},setValue:async(key,value)=>{writes.push({key,value:structuredClone(value)});values.set(key,structuredClone(value))}};
 w.__mumeiNotificationReaderV4={findPanel:()=>w.document.getElementById('panel')};w.eval(source);const api=w.__mumeiV3Checkpoint325;await api.ready;
 return{w,api,values,reads,writes,fetches,setAccount:value=>{active=value},onRead:fn=>{readHook=fn},onFetch:fn=>{fetchHook=fn},line:()=>w.document.getElementById(LINE),before:()=>w.document.getElementById(LINE)?.nextElementSibling?.id};
}

test('exact native saved notice ID wins over an earlier identical body and target',async t=>{
 const h=await fixture(t,{rows:row('new')+row('old')});assert.equal(h.api.mark(),true);assert.equal(h.before(),'old');
});

test('300-row saved-boundary checks avoid comparing every notification pair',async t=>{
 const values=new Map([[CHECK+'a',cp('n299')]]),h=await fixture(t,{values,rows:Array.from({length:300},(_,i)=>row('n'+i)).join('')});
 const contains=h.w.Node.prototype.contains;let comparisons=0;h.w.Node.prototype.contains=function(node){comparisons++;return contains.call(this,node)};
 assert.equal(h.api.mark(),true);assert.equal(h.before(),'n299');assert.ok(comparisons<5000,'300 siblings must not perform about 90,000 containment comparisons: '+comparisons);
});

test('an exposed different notice ID never becomes the saved marker through a body fallback',async t=>{
 const h=await fixture(t,{rows:row('new')});assert.equal(h.api.mark(),false);assert.equal(h.line(),null);
});

test('older DOM without native IDs keeps a unique acknowledged body and target fallback',async t=>{
 const h=await fixture(t,{rows:row('legacy',{noticeId:''})});assert.equal(h.api.mark(),true);assert.equal(h.before(),'legacy');
});

test('repeated ID-free notification bodies remain ambiguous and show no invented saved boundary',async t=>{
 const h=await fixture(t,{rows:row('first',{noticeId:''})+row('second',{noticeId:''})});assert.equal(h.api.mark(),false);assert.equal(h.line(),null);
});

test('a legacy signature without an event ID still identifies its unique saved row',async t=>{
 const legacy=[body,target,'https://note.com/person'].join('|'),values=new Map([[CHECK+'a',{boundarySignature:'old-capture',boundaryLegacySignature:legacy,boundaryAt:100}]]);
 const h=await fixture(t,{rows:row('legacy',{noticeId:''}),values});assert.equal(h.api.mark(),true);assert.equal(h.before(),'legacy');
});

test('same text on another article is not a legacy saved boundary',async t=>{
 const h=await fixture(t,{rows:row('legacy',{noticeId:'',article:'https://note.com/person/n/another'})});assert.equal(h.api.mark(),false);assert.equal(h.line(),null);
});

test('restore rechecks the note account and selects only the new account checkpoint',async t=>{
 const values=new Map([[CHECK+'a',cp('old')],[CHECK+'b',cp('new')]]),h=await fixture(t,{values,rows:row('new')+row('old')});h.api.mark();assert.equal(h.before(),'old');
 h.setAccount('b');await h.api.restore();assert.equal(h.api.getCached().boundaryEventIdentity,'notice:new');h.api.mark();assert.equal(h.before(),'new');assert.deepEqual(h.fetches,['a','b']);
 assert.equal(JSON.parse(h.w.localStorage.getItem(LOCAL+'b')).boundaryEventIdentity,'notice:new');assert.equal(JSON.parse(h.w.localStorage.getItem(LOCAL+'a')).boundaryEventIdentity,'notice:old');
});

test('a delayed old-account storage response cannot replace or mirror the new account checkpoint',async t=>{
 const values=new Map([[CHECK+'a',cp('old')],[CHECK+'b',cp('new')]]),h=await fixture(t,{values,rows:row('new')+row('old')}),held=deferred();
 h.onRead((key,fallback)=>key===CHECK+'a'?held.promise:values.get(key)||fallback);const old=h.api.restore();await wait(0);h.setAccount('b');await h.api.restore();h.api.mark();assert.equal(h.before(),'new');
 held.resolve(cp('old',{boundaryAt:9999}));assert.equal(await old,null);assert.equal(h.api.getCached().boundaryEventIdentity,'notice:new');assert.equal(h.before(),'new');assert.equal(JSON.parse(h.w.localStorage.getItem(LOCAL+'a')).boundaryAt,100);assert.deepEqual(h.writes,[]);
});

test('a delayed current_user response from the old account cannot revive its marker after a newer restore',async t=>{
 const values=new Map([[CHECK+'a',cp('old')],[CHECK+'b',cp('new')]]),h=await fixture(t,{values,rows:row('new')+row('old')}),held=deferred();
 h.onFetch(id=>id==='a'?held.promise:Response.json({data:{urlname:id}}));const old=h.api.restore();await wait(0);h.setAccount('b');await h.api.restore();h.api.mark();
 held.resolve(Response.json({data:{urlname:'a'}}));assert.equal(await old,null);assert.equal(h.api.getCached().boundaryEventIdentity,'notice:new');assert.equal(h.before(),'new');
});

test('a checkpoint event persists the verified current account rather than a prior account cache',async t=>{
 const values=new Map([[CHECK+'a',cp('old')],[CHECK+'b',cp('new')]]),h=await fixture(t,{values,rows:row('new')+row('old')});h.setAccount('b');await h.api.persist();assert.equal(h.api.getCached().boundaryEventIdentity,'notice:new');assert.equal(h.before(),'new');
 assert.equal(JSON.parse(h.w.localStorage.getItem(LOCAL+'b')).boundaryEventIdentity,'notice:new');assert.equal(JSON.parse(h.w.localStorage.getItem(LOCAL+'a')).boundaryEventIdentity,'notice:old');
});

test('foreground lifecycle signals share one account recheck while DOM marker calls add none',async t=>{
 const values=new Map([[CHECK+'a',cp('old')],[CHECK+'b',cp('new')]]),h=await fixture(t,{values,rows:row('new')+row('old')});h.api.mark();const before=h.fetches.length;
 for(let i=0;i<8;i++)h.api.mark();assert.equal(h.fetches.length,before);
 Object.defineProperty(h.w.document,'visibilityState',{value:'hidden',configurable:true});h.w.document.dispatchEvent(new h.w.Event('visibilitychange'));h.w.dispatchEvent(new h.w.Event('focus'));await wait(20);assert.equal(h.fetches.length,before);assert.equal(h.line(),null);
 h.setAccount('b');Object.defineProperty(h.w.document,'visibilityState',{value:'visible',configurable:true});h.w.document.dispatchEvent(new h.w.Event('visibilitychange'));h.w.dispatchEvent(new h.w.Event('focus'));h.w.dispatchEvent(new h.w.Event('pageshow'));await wait(120);
 assert.equal(h.fetches.length,before+1);assert.equal(h.before(),'new');
});

test('backgrounding cancels a queued recheck and ignores checkpoint events until the next foreground',async t=>{
 const h=await fixture(t);h.api.mark();const before=h.fetches.length;h.w.dispatchEvent(new h.w.Event('focus'));
 Object.defineProperty(h.w.document,'visibilityState',{value:'hidden',configurable:true});h.w.document.dispatchEvent(new h.w.Event('visibilitychange'));h.w.document.dispatchEvent(new h.w.Event('mumei-notification-checkpoint'));await wait(30);
 assert.equal(h.fetches.length,before);assert.equal(h.line(),null);assert.equal(await h.api.restore(),null);assert.equal(await h.api.persist(),null);
});
