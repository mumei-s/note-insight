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
 return{id,type:{name:type},attrs,nodeSize,textContent,eq(other){return other===this},toJSON(){return{type,attrs,textContent}}};
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
 const positions=blocks=>{let pos=0;return blocks.map(block=>{const hit={pos,node:block};pos+=block.nodeSize;return hit})};
 const makeDoc=blocks=>({blocks:blocks.slice(),content:{size:blocks.reduce((sum,block)=>sum+block.nodeSize,0)},descendants(fn){for(const hit of positions(this.blocks))fn(hit.node,hit.pos)},nodeAt(pos){return positions(this.blocks).find(hit=>hit.pos===pos)?.node||null},eq(other){return this.blocks.length===other?.blocks?.length&&this.blocks.every((block,index)=>block.eq(other.blocks[index]))}});
 const state={doc:makeDoc(c.blocks)};
 Object.defineProperty(state,'tr',{get:()=>({doc:state.doc,ranges:[],delete(from,to){this.ranges.push([from,to]);this.doc=makeDoc(positions(this.doc.blocks).filter(hit=>!(hit.pos>=from&&hit.pos+hit.node.nodeSize<=to)).map(hit=>hit.node));return this}})});
 c.replaceBlocks=blocks=>{c.blocks=blocks.slice();state.doc=makeDoc(c.blocks)};
 c.view={state,dispatch(tr){c.dispatches.push(tr);c.deletions.push(...tr.ranges);c.replaceBlocks(tr.doc.blocks)}};
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
 const profile=node('profile','paragraph',{formula:'\\footnotesize\\text{actual profile}'},7,'$${\\footnotesize\\text{actual profile}}$$');
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

test('linked-image recovery preserves an untracked original card before a valid notification-card anchor',async()=>{
 const original=card('emboriginal123');
 const image=node('image','image',{link:alpha},4);
 const generated=card('embgenerated123');
 const saved=checkpoint({cardAnchorPos:5,cardKeys:[{key:'embgenerated123',url:alpha}]});
 const c=runtime([original,image,generated],saved);
 assert.equal(await c.api.deleteNotificationCards({confirm:false,save:false}),1);
 assert.deepEqual(c.blocks,[original,image]);
});

test('a metadata-less original card fingerprint protects its earliest occurrence while removing an identical generated card',async()=>{
 const original=node('original','embed',{src:'https://note.com/embed/notes/n111111111111',layout:'card'},1);
 const image=node('image','image',{link:alpha},4);
 const generated=node('generated','embed',{layout:'card',src:'https://note.com/embed/notes/n111111111111'},1);
 const saved=checkpoint({cardAnchorPos:9999,cardBaselineNodes:[{key:'',src:original.attrs.src,json:original.toJSON()}]});
 const c=runtime([original,image,generated],saved);
 assert.equal(await c.api.deleteNotificationCards({confirm:false,save:false}),1);
 assert.deepEqual(c.blocks,[original,image]);
 assert.deepEqual(c.saved.cardBaselineNodes,saved.cardBaselineNodes);
});

test('incomplete native-card deletion rejects without clearing progress or reporting a save',async()=>{
 const image=node('image','image',{link:alpha},4);
 const first=card('embfirst123'),second=card('embsecond123');
 const saved=checkpoint({cardKeys:[{key:'embfirst123',url:alpha},{key:'embsecond123',url:alpha}]});
 const c=runtime([image,first,second],saved);
 c.view.dispatch=()=>c.replaceBlocks([image,second]);
 await assert.rejects(c.api.deleteNotificationCards({confirm:false,save:true}),/削除結果を確認できません/);
 assert.equal(c.saved,saved);assert.equal(c.writes.length,0);
 assert.ok(!c.events.includes('save'));assert.deepEqual(c.blocks,[image,second]);
});

test('native-card deletion rejects any accidental change to a profile formula, image, heading or divider',async()=>{
 const preserved=[node('heading','heading',{},5,'1〜10人目のクリエイター様'),node('formula','paragraph',{formula:'\\footnotesize\\text{プロフィール}'},7,'$${\\footnotesize\\text{プロフィール}}$$'),node('image','image',{link:alpha},4),node('divider','horizontal_rule',{},1)];
 for(let changed=0;changed<preserved.length;changed++){
  const generated=card('embgenerated123');
  const saved=checkpoint({cardKeys:[{key:'embgenerated123',url:alpha}]});
  const c=runtime([...preserved,generated],saved);
  c.view.dispatch=()=>c.replaceBlocks(preserved.filter((_,index)=>index!==changed));
  await assert.rejects(c.api.deleteNotificationCards({confirm:false,save:false}),/削除結果を確認できません/);
  assert.equal(c.saved,saved);assert.equal(c.writes.length,0);
 }
});

test('a nonempty final profile or divider does not cause deletion to append a cursor paragraph',async()=>{
 const profile=node('profile','paragraph',{},5,'$${\\footnotesize\\text{紹介}}$$'),divider=node('divider','horizontal_rule',{},1),current=card('embcurrent123');
 const c=runtime([profile,divider,current],checkpoint({cardKeys:[{key:'embcurrent123',url:alpha}]}));
 c.api.patch('ensureEndSelection=()=>{throw Error("must not append a paragraph after deletion")};');
 assert.equal(await c.api.deleteNotificationCards({confirm:false,save:false}),1);
 assert.deepEqual(c.blocks,[profile,divider]);
});

test('a document edit during confirmation fails preflight before any card deletion',async()=>{
 const generated=card('embgenerated123'),replacement=card('embreplacement123');
 const saved=checkpoint({cardKeys:[{key:'embgenerated123',url:alpha}]});
 const c=runtime([generated],saved);
 c.page.confirm=()=>{c.replaceBlocks([replacement]);return true};
 await assert.rejects(c.api.deleteNotificationCards({confirm:true,save:false}),/位置が変わったため削除を停止/);
 assert.deepEqual(c.blocks,[replacement]);assert.equal(c.dispatches.length,0);assert.equal(c.writes.length,0);assert.equal(c.saved,saved);
});

