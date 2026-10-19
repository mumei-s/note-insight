import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../public/note-profile-card-paster-core-v232.js',import.meta.url),'utf8');
const articleKey='n123456789abc',url='https://note.com/alpha/n/n111111111111',profileUrl='https://note.com/no_article';
const headingText='01｜1〜10人目のクリエイター様',profileText='$${\\scriptsize\\text{プロフィール｜alphaさん：紹介}}$$';
function node(id,type,attrs={},nodeSize=2,textContent=''){
 return{id,type:{name:type},attrs,nodeSize,textContent,eq(other){return other===this},toJSON(){return{type,attrs,textContent}}};
}
const card=(id,src=url)=>node(id,'embed',{embeddedContentKey:id,src,htmlForEmbed:'<div class="note-embed">article</div>'},1);
const positions=blocks=>{let pos=0;return blocks.map(block=>{const hit={pos,node:block};pos+=block.nodeSize;return hit})};
const baseline=blocks=>positions(blocks).map(hit=>({pos:hit.pos,json:hit.node.toJSON()}));
const makeDoc=blocks=>({blocks:blocks.slice(),content:{size:blocks.reduce((sum,block)=>sum+block.nodeSize,0)},forEach(fn){for(const hit of positions(this.blocks))fn(hit.node,hit.pos)},descendants(fn){this.forEach(fn)},nodeAt(pos){return positions(this.blocks).find(hit=>hit.pos===pos)?.node||null},eq(other){return this.blocks.length===other?.blocks?.length&&this.blocks.every((block,index)=>block.eq(other.blocks[index]))}});
function runtime(blocks,initial,durable=null){
 const c={blocks:blocks.slice(),saved:initial,durable,events:[],writes:[],statuses:[],flushImpl:async()=>{}};
 const page={addEventListener(){},confirm:()=>true,__MUMEI_PROFILE_CARD_RUN_STORE__:{read:()=>c.saved,write:value=>{c.writes.push(value);c.saved=value;c.events.push('write')},hydrate:async()=>{c.events.push('hydrate');await Promise.resolve();if(c.durable)c.saved=c.durable},flush:async()=>{c.events.push('flush:start');await c.flushImpl();c.events.push('flush:done')}}};
 const window={addEventListener(){},dispatchEvent(){return true}},document={readyState:'loading',addEventListener(){},getElementById(){return null}};
 const state={doc:makeDoc(c.blocks)};
 Object.defineProperty(state,'tr',{get:()=>({doc:state.doc,delete(from,to){this.doc=makeDoc(positions(this.doc.blocks).filter(hit=>!(hit.pos>=from&&hit.pos+hit.node.nodeSize<=to)).map(hit=>hit.node));return this}})});
 c.replaceBlocks=next=>{c.blocks=next.slice();state.doc=makeDoc(c.blocks)};
 c.view={state,dispatch:tr=>c.replaceBlocks(tr.doc.blocks)};
 const context=vm.createContext({unsafeWindow:page,window,document,location:new URL('https://editor.note.com/notes/'+articleKey+'/edit'),localStorage:{getItem:()=>null,setItem(){},removeItem(){}},GM_getValue:()=>null,URL,Event,setTimeout,clearTimeout,console});
 const entry="if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();";
 assert.ok(source.includes(entry));
 vm.runInContext(source.replace(entry,'globalThis.api={patch:code=>eval(code),deleteAllGenerated,resetAll,sessionId:CARD_SESSION};'),context);
 context.view=c.view;context.events=c.events;context.statuses=c.statuses;
 context.api.patch('findView=()=>view;saveOnce=async()=>events.push("save");setStatus=text=>statuses.push(text);resetFields=()=>{};');
 c.api=context.api;c.page=page;return c;
}
function run(overrides={}){return{articleKey,rows:[{url,creator:'alpha'}],imageAnchorPos:0,cardAnchorPos:null,items:[],activityTexts:[],sectionHeadings:[],dividerUrls:[],cardKeys:[],cardBaselineKeys:[],stage:'complete',...overrides}}

test('full delete removes generated media, native cards, headings and profile formulas while preserving identical original content on both sides',async()=>{
 const originalHeading=node('before-heading','heading',{},5,headingText),originalProfile=node('before-profile','paragraph',{},7,profileText),originalImage=node('before-image','image',{id:'original-image',link:url,alt:'mumei_profile_note_v1'},4),originalDivider=node('before-divider','horizontal_rule',{},1),originalCard=card('emboriginal123');
 const suffixHeading=node('after-heading','heading',{},5,headingText),suffixProfile=node('after-profile','paragraph',{},7,profileText),suffixCard=card('embsuffix123');
 const before=[originalHeading,originalProfile,originalImage,originalDivider,originalCard],after=[suffixHeading,suffixProfile,suffixCard],original=[...before,...after],anchor=before.reduce((sum,block)=>sum+block.nodeSize,0);
 const heading=node('generated-heading','heading',{},5,headingText),profile=node('generated-profile','paragraph',{},7,profileText),image=node('generated-image','image',{id:'owned-image',src:'owned.png',link:url},4),divider=node('generated-divider','horizontal_rule',{},1),native=card('embgenerated123'),duplicate=card('embduplicate123');
 const saved=run({imageAnchorPos:anchor,cardAnchorPos:anchor+17,items:[{id:'owned-image',src:'owned.png',url}],activityTexts:[profileText],sectionHeadings:[headingText],dividerUrls:[url],cardKeys:[{key:'embgenerated123',url}],cardBaselineKeys:['emboriginal123','embsuffix123'],contentBaselineNodes:baseline(original),imageBaselineRecords:[{id:'original-image',src:'',link:url}]});
 const c=runtime([...before,heading,profile,image,divider,native,duplicate,...after],saved);
 const result=await c.api.deleteAllGenerated({save:false});
 assert.deepEqual({...result},{removedCards:2,removedImages:1,removedHeadings:1,removedActivities:1,removedDividers:1});
 assert.deepEqual(c.blocks,original);assert.equal(c.saved,null);assert.deepEqual(c.events,['hydrate','write','flush:start','flush:done']);
});

test('full delete handles a profile-only creator with icon/name image and no native article card',async()=>{
 const original=card('emboriginal123'),heading=node('heading','heading',{},5,headingText),profile=node('profile','paragraph',{},7,profileText),image=node('profile-only','image',{id:'profile-image',src:'profile.png',link:profileUrl},4),divider=node('divider','horizontal_rule',{},1);
 const saved=run({imageAnchorPos:1,rows:[{url:profileUrl,profileOnly:true}],items:[{id:'profile-image',src:'profile.png',url:profileUrl}],activityTexts:[profileText],sectionHeadings:[headingText],dividerUrls:[profileUrl],cardBaselineKeys:['emboriginal123'],contentBaselineNodes:baseline([original])});
 const c=runtime([original,heading,profile,image,divider],saved);
 assert.equal((await c.api.deleteAllGenerated({save:false})).removedImages,1);
 assert.deepEqual(c.blocks,[original]);assert.equal(c.saved,null);
});

test('full delete hydrates durable progress and rejects a different article without mutation',async()=>{
 const image=node('image','image',{id:'image',src:'owned.png',link:url},4),saved=run({articleKey:'n999999999999',items:[{id:'image',src:'owned.png',url}]});
 const c=runtime([image],null,saved);
 await assert.rejects(c.api.deleteAllGenerated({save:false}),/この記事の作成記録を確認できない/);
 assert.deepEqual(c.blocks,[image]);assert.equal(c.saved,saved);assert.equal(c.writes.length,0);assert.deepEqual(c.events,['hydrate']);
});

test('full delete preserves the run when a native transaction incompletely deletes content',async()=>{
 const image=node('image','image',{id:'image',src:'owned.png',link:url},4),saved=run({items:[{id:'image',src:'owned.png',url}]});
 const c=runtime([image],saved);c.view.dispatch=()=>{};
 await assert.rejects(c.api.deleteAllGenerated({save:true}),/全削除結果を確認できません/);
 assert.deepEqual(c.blocks,[image]);assert.equal(c.saved,saved);assert.equal(c.writes.length,0);assert.ok(!c.events.includes('save'));
});

test('full delete without a run never deletes an untracked legacy-marked image',async()=>{
 const original=node('image','image',{alt:'mumei_profile_note_v1',link:url},4),c=runtime([original],null);
 assert.equal((await c.api.deleteAllGenerated({save:false})).removedImages,0);assert.deepEqual(c.blocks,[original]);assert.equal(c.writes.length,0);
});

test('ambiguous unrecorded duplicate headings stop full deletion with the original run intact',async()=>{
 const first=node('original','heading',{},5,headingText),second=node('generated','heading',{},5,headingText),saved=run({sectionHeadings:[headingText]}),c=runtime([first,second],saved);
 await assert.rejects(c.api.deleteAllGenerated({save:false}),/同じ見出し・プロフィールが元本文にもある/);
 assert.deepEqual(c.blocks,[first,second]);assert.equal(c.saved,saved);assert.equal(c.writes.length,0);
});

test('full delete retains ownership until a current-session native card request has a confirmed result',async()=>{
 const image=node('image','image',{id:'image',src:'owned.png',link:url},4),saved=run({items:[{id:'image',src:'owned.png',url}],pendingCard:{url,sessionId:''}}),c=runtime([image],saved);
 saved.pendingCard.sessionId=c.api.sessionId;
 await assert.rejects(c.api.deleteAllGenerated({save:false}),/生成結果がまだ確定していない/);
 assert.deepEqual(c.blocks,[image]);assert.equal(c.saved,saved);assert.equal(c.writes.length,0);
});

test('full delete refuses an unfinished native image upload or an unrecorded related image',async()=>{
 for(const pending of [node('upload','imageUploading',{src:'blob:upload'},1),node('unrecorded','image',{id:'unrecorded',src:'late.png',link:url},4)]){
  const saved=run(),c=runtime([pending],saved);
  await assert.rejects(c.api.deleteAllGenerated({save:false}),/アップロードがまだ完了していない|画像の保存記録がまだ確認できない/);
  assert.deepEqual(c.blocks,[pending]);assert.equal(c.saved,saved);assert.equal(c.writes.length,0);
 }
});

test('the public full-delete action confirms once and awaits checkpoint clearing before save',async()=>{
 const image=node('image','image',{id:'image',src:'owned.png',link:url},4),saved=run({items:[{id:'image',src:'owned.png',url}]});
 const c=runtime([image],saved);let confirmations=0,release;
 c.page.confirm=()=>{confirmations++;return true};const wait=new Promise(resolve=>{release=resolve});c.flushImpl=()=>wait;
 assert.equal(c.page.__MUMEI_PROFILE_CARD_DELETE_ALL__,c.api.resetAll);
 const pending=c.page.__MUMEI_PROFILE_CARD_DELETE_ALL__();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(confirmations,1);assert.equal(c.saved,null);assert.ok(!c.events.includes('save'));
 release();const result=await pending;assert.equal(result.removedImages,1);assert.ok(c.events.indexOf('flush:done')<c.events.indexOf('save'));assert.match(c.statuses.at(-1),/今回分を全削除しました/);
});
