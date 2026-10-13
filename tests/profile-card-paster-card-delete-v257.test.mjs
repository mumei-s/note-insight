import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../public/note-profile-card-paster-core-v232.js',import.meta.url),'utf8');
const alpha='https://note.com/alpha/n/n111111111111';
const beta='https://note.com/beta/n/n222222222222';
const row={url:alpha,creator:'alpha'};
test('recovers saved native cards using linked introduction images despite stale anchor and changed embed metadata',async()=>{
 const image=node('image','image',{src:'https://assets.st-note.com/image.jpg',link:alpha});
 const original=card('embbaseline123');
 const restored=node('restored','embed',{src:'https://note.com/embed/notes/n111111111111'},1);
 const unrelated=card('embother123',beta);
 const c=runtime([original,restored,image,unrelated],checkpoint({cardAnchorPos:9999,cardKeys:[],cardBaselineKeys:['embbaseline123']}));
 assert.equal(await c.api.deleteNotificationCards({confirm:false,save:false}),1);
 assert.deepEqual(c.blocks,[original,image,unrelated]);
});
const card=(id,src=alpha)=>node(id,'embed',{embeddedContentKey:id,src,htmlForEmbed:'<div class="note-embed">article</div>'},1);
function node(id,type,attrs={},nodeSize=2,textContent=''){
 return{id,type:{name:type},attrs,nodeSize,textContent,eq(other){return other===this}};
}
function checkpoint(overrides={}){
 return{articleKey:'n123456789abc',stage:'complete',rows:[row,{url:beta,creator:'beta'}],items:[{id:'image',url:alpha,src:'https://assets.st-note.com/image.jpg'}],activityTexts:['actual profile'],groupHeadings:['1〜10人目のクリエイター様'],dividerUrls:[alpha],cardAnchorPos:0,cardBaselineKeys:[],cardKeys:[],pendingCard:null,...overrides};
}
function runtime(nodes,initial=checkpoint(),durable=null){
 const c={saved:initial,durable,writes:[],events:[],confirmed:[],dispatches:[],deletions:[],blocks:nodes.slice(),flushImpl:async()=>{}};
 const page={addEventListener(){},confirm:text=>{c.confirmed.push(text);return true},__MUMEI_PROFILE_CARD_RUN_STORE__:{
  read:()=>c.saved,
  write:value=>{c.writes.push(value);c.saved=value;c.events.push('write')},
  hydrate:async()=>{c.events.push('hydrate');await Promise.resolve();if(c.durable)c.saved=c.durable},
  flush:async()=>{c.events.push('flush:start');await c.flushImpl();c.events.push('flush:done')}
 }};
 const window={addEventListener(){},dispatchEvent(){return true}};
 const document={readyState:'loading',addEventListener(){},getElementById(){return null}};
 const context=vm.createContext({unsafeWindow:page,window,document,location:new URL('https://editor.note.com/notes/n123456789abc/edit'),localStorage:{getItem:()=>null,setItem(){},removeItem(){}},GM_getValue:()=>null,URL,Event,setTimeout,clearTimeout,console});
 const positions=()=>{let pos=0;return c.blocks.map(block=>{const hit={pos,node:block};pos+=block.nodeSize;return hit})};
 const doc={descendants(fn){for(const hit of positions())fn(hit.node,hit.pos)},nodeAt:pos=>positions().find(hit=>hit.pos===pos)?.node||null};
 Object.defineProperty(doc,'content',{get:()=>({size:c.blocks.reduce((sum,block)=>sum+block.nodeSize,0)})});
 const state={doc};
 Object.defineProperty(state,'tr',{get:()=>({ranges:[],delete(from,to){this.ranges.push([from,to]);return this}})});
 c.view={state,dispatch(tr){c.dispatches.push(tr);c.deletions.push(...tr.ranges);const old=positions();c.blocks=old.filter(hit=>!tr.ranges.some(([from,to])=>hit.pos>=from&&hit.pos+hit.node.nodeSize<=to)).map(hit=>hit.node)}};
 const entry="if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();";
 assert.ok(source.includes(entry));
 vm.runInContext(source.replace(entry,'globalThis.api={patch:code=>eval(code),deleteNotificationCards};'),context);
 context.view=c.view;context.events=c.events;
 context.api.patch('findView=()=>view;ensureEndSelection=()=>events.push("selection");saveOnce=async()=>events.push("save");');
 c.api=context.api;c.page=page;
 return c;
}

test('card deletion hydrates GM-only progress before resolving owned cards',async()=>{
 const image=node('image','image',{src:'https://assets.st-note.com/image.jpg',link:alpha});
 const current=card('embcurrent123');
 const saved=checkpoint({cardKeys:[{key:'embcurrent123',url:alpha,creator:'alpha'}]});
 const c=runtime([image,current],null,saved);
 const removed=await c.api.deleteNotificationCards({confirm:false,save:false});
 assert.equal(removed,1);assert.deepEqual(c.blocks,[image]);assert.equal(c.events[0],'hydrate');
 assert.equal(c.saved.stage,'images_ready');assert.equal(c.saved.cardKeys.length,0);
 assert.deepEqual(c.saved.items,saved.items);assert.ok(c.events.includes('flush:done'));
});

test('deletion removes tracked and untracked duplicate cards while preserving the baseline and all introduction nodes',async()=>{
 const heading=node('heading','heading',{},5,'1〜10人目のクリエイター様');
 const profile=node('profile','paragraph',{},7,'actual profile');
 const image=node('image','image',{src:'https://assets.st-note.com/image.jpg',link:alpha},4,'alphaさん');
 const divider=node('divider','horizontal_rule',{},1);
 const original=card('embbaseline123');
 const tracked=card('embtracked123');
 const duplicate=card('embduplicate123','https://note.com/embed/notes/n111111111111');
 const unrelated=card('embunrelated123','https://note.com/unrelated/n/n333333333333');
 const saved=checkpoint({cardBaselineKeys:['embbaseline123'],cardKeys:[{key:'embtracked123',url:alpha,creator:'alpha'}],pendingCard:{url:alpha,pos:18}});
 const c=runtime([heading,profile,image,divider,original,tracked,duplicate,unrelated],saved);
 assert.equal(await c.api.deleteNotificationCards({confirm:false,save:false}),2);
 assert.deepEqual(c.blocks,[heading,profile,image,divider,original,unrelated]);
 assert.deepEqual(c.deletions,[[19,20],[18,19]]);
 assert.equal(c.saved.cardKeys.length,0);assert.equal(c.saved.pendingCard,null);assert.equal(c.saved.stage,'images_ready');
 for(const key of ['items','activityTexts','groupHeadings','dividerUrls','rows','cardBaselineKeys'])assert.deepEqual(c.saved[key],saved[key]);
});

test('cancelling card deletion performs no document mutation or checkpoint write',async()=>{
 const current=card('embcurrent123');
 const saved=checkpoint({cardKeys:[{key:'embcurrent123',url:alpha}]});
 const c=runtime([current],saved);c.page.confirm=()=>false;
 assert.equal(await c.api.deleteNotificationCards(),null);
 assert.deepEqual(c.blocks,[current]);assert.equal(c.dispatches.length,0);assert.equal(c.writes.length,0);
 assert.equal(c.saved,saved);assert.deepEqual(c.events,['hydrate']);
});

test('no owned cards leaves the prior tracking and stage intact without inferring ownership from a null anchor',async()=>{
 const original=card('emboriginal123');
 const saved=checkpoint({cardAnchorPos:null,stage:'cards_building',cardKeys:[{key:'embmissing123',url:alpha}],pendingCard:{url:alpha,sessionId:'earlier'}});
 const c=runtime([original],saved);
 assert.equal(await c.api.deleteNotificationCards({confirm:false,save:false}),0);
 assert.deepEqual(c.blocks,[original]);assert.equal(c.dispatches.length,0);assert.equal(c.writes.length,0);
 assert.equal(c.saved,saved);assert.equal(c.saved.cardKeys[0].key,'embmissing123');assert.equal(c.saved.stage,'cards_building');
});

test('deletion awaits the durable metadata flush before saving or resolving',async()=>{
 const saved=checkpoint({cardKeys:[{key:'embcurrent123',url:alpha}]});
 const c=runtime([card('embcurrent123')],saved);
 let release;const wait=new Promise(resolve=>{release=resolve});c.flushImpl=()=>wait;
 let resolved=false;const result=c.api.deleteNotificationCards({confirm:false,save:true}).then(value=>{resolved=true;return value});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(c.blocks.length,0);assert.equal(c.saved.cardKeys.length,0);
 assert.ok(c.events.includes('flush:start'));assert.ok(!c.events.includes('save'));assert.equal(resolved,false);
 release();assert.equal(await result,1);assert.equal(resolved,true);
 assert.ok(c.events.indexOf('flush:done')<c.events.indexOf('save'));
});

