import nodeTest from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {transformCoreDividers,coreDividerRuntime} from '../scripts/profile-card-dividers-v293.mjs';
import {runtime,dependencies} from './fixtures/profile-card-quality-runtime.mjs';

const test=(name,fn)=>nodeTest(name,{skip:!dependencies?'Real PM/canvas dependencies are required':false},fn);
const clone=value=>JSON.parse(JSON.stringify(value));
const current=readFileSync('public/note-profile-card-likes300-fix-v220.user.js','utf8');
function withDividers(code){
 if(code.includes('const CORE_DIVIDER_FALLBACK='))return code;
 const start=code.indexOf('// BEGIN INCLUDED EDITOR CORE'),end=code.indexOf('// BEGIN INCLUDED PROFILE IMPLEMENTATION');
 assert.ok(start>0&&end>start);
 return code.slice(0,start)+transformCoreDividers(code.slice(start,end))+code.slice(end);
}
const moduleCode=withDividers(current);
const rt=options=>runtime({count:2,moduleCode,...options});
const blocks=r=>{const out=[];r.view.state.doc.forEach((node,pos)=>out.push({node,pos}));return out};
const images=r=>blocks(r).filter(hit=>hit.node.type.name==='image');
const rules=r=>blocks(r).filter(hit=>hit.node.type.name==='horizontal_rule');
function completed(r,run=r.editor.readRun()){
 assert.equal(run?.stage,'images_ready',r.state.statuses.at(-1)?.text);
 assert.equal(run.items.length,run.rows.length);
 assert.equal(run.pendingCoreDivider??null,null);
 assert.equal(run.coreDividerRecords.length,run.rows.length);
 for(const image of images(r))assert.ok(r.page.__MUMEI_PROFILE_CARD_DIVIDERS__.owned(r.view,image),image.node.attrs.link);
}
function restore(r){
 return{doc:r.doc(),selection:r.view.state.selection.from,url:r.page.location.href,state:clone({images:r.state.images,imageDimensions:r.state.imageDimensions,cards:r.state.cards,nativeCardRequests:r.state.nativeCardRequests,serial:r.state.serial,clock:r.state.clock,targetCount:r.state.targetCount,fixturePrefix:r.state.fixturePrefix,keyOffset:r.state.keyOffset})};
}
function installOwnedImage(r,{fallback=false,manual=false,nativeAttrs=false}={}){
 let schema=r.schema;
 if(fallback||nativeAttrs){
  let nodes=r.schema.spec.nodes;
  if(fallback)nodes=nodes.remove('horizontal_rule');
  if(nativeAttrs)nodes=nodes.update('horizontal_rule',{...nodes.get('horizontal_rule'),attrs:{noteId:{default:null}}}).update('image',{...nodes.get('image'),attrs:{...nodes.get('image').attrs,nativeState:{default:null}}});
  schema=new dependencies.Schema({nodes,marks:r.schema.spec.marks});r.view.state=dependencies.EditorState.create({schema,doc:schema.nodeFromJSON(r.doc())});
 }
 const row={index:1,urlname:'manual_fixture',key:'n333333333333',url:'https://note.com/manual_fixture/n/n333333333333',creator:'本人'},image=schema.nodes.image.create({id:'owned-manual-fixture',src:'https://assets.st-note.com/owned.png',link:row.url},schema.text('本人さん'));
 const pos=r.view.state.doc.content.size,tail=manual?(fallback?schema.nodes.paragraph.create(null,schema.text('────────────')):schema.nodes.horizontal_rule.create()):null;
 r.view.dispatch(r.view.state.tr.insert(pos,tail?[image,tail]:image));
 const run={version:'2.9.3',articleKey:r.page.location.pathname.match(/\/notes\/(.*?)\/edit/)[1],coreImageRun:true,createdAt:1700000000000,imageAnchorPos:pos,rows:[row],items:[{id:image.attrs.id,src:image.attrs.src,url:row.url,creator:row.creator}],cardKeys:[],sectionHeadings:[],activityTexts:[],dividerUrls:[],imageBaselineRecords:[],stage:'images_building'};
 r.editor.writeRun(run);return{row,image:{node:image,pos},manual:tail};
}
function legacyPending(r,fixture,{version=1,phase='uncertain',planned=null}={}){
 const run=r.editor.readRun(),node=r.view.state.doc.nodeAt(fixture.image.pos+fixture.image.node.nodeSize);
 r.editor.writeRun({...run,pendingCoreDivider:{version,...(version===2?{evidence:{kind:'fresh-before-insert'}}:{}),phase,image:{id:fixture.image.node.attrs.id,src:fixture.image.node.attrs.src,url:fixture.row.url},node:planned||node?.toJSON(),runId:run.createdAt,articleKey:run.articleKey,at:1}});
}

test('every newly generated generic image ends in one owned native rule, including the final article',async t=>{
 const r=await rt();t.after(()=>r.close());await r.normal();completed(r);
 assert.equal(rules(r).length,3);assert.equal(r.editor.readRun().rows.at(-1).finalMarker,true);
});

test('thin and medium name, profile, and summary content modes keep their image boundary',async t=>{
 for(const size of ['thin','medium'])for(const content of ['name','profile','summary']){
  const local=new Map([['mumei_profile_card_presentation_v292',JSON.stringify({size,content})]]),r=await rt({count:1,localStorageMap:local});t.after(()=>r.close());
  await r.normal();completed(r);assert.equal(rules(r).length,2,size+' '+content);
 }
});

test('an existing manual rule is preserved and is never adopted as the new owned boundary',async t=>{
 const r=await rt();t.after(()=>r.close());const fixture=installOwnedImage(r,{manual:true}),api=r.page.__MUMEI_PROFILE_CARD_DIVIDERS__;
 assert.equal(api.owned(r.view,fixture.image),null);
 await api.append(r.view,fixture.row,fixture.image);await r.page.__MUMEI_PROFILE_CARD_RUN_STORE__.flush();
 assert.equal(rules(r).length,2);const owned=api.owned(r.view,fixture.image);assert.ok(owned);assert.notEqual(owned.node,fixture.manual);
 const result=await r.core.deleteAllGenerated({save:false});assert.equal(result.removedDividers,1);assert.equal(rules(r).length,1);assert.equal(rules(r)[0].node,fixture.manual);
});

test('a schema without native rules uses and deletes only its own fallback paragraph',async t=>{
 const r=await rt();t.after(()=>r.close());const fixture=installOwnedImage(r,{fallback:true,manual:true}),api=r.page.__MUMEI_PROFILE_CARD_DIVIDERS__;
 await api.append(r.view,fixture.row,fixture.image);await r.page.__MUMEI_PROFILE_CARD_RUN_STORE__.flush();
 const records=r.editor.readRun().coreDividerRecords;assert.equal(records[0].kind,'fallback');assert.equal(blocks(r).filter(hit=>hit.node.textContent==='────────────').length,2);
 api.observe(r.view,fixture.row,fixture.image);
 const result=await r.core.deleteAllGenerated({save:false});assert.equal(result.removedDividers,1);
 const remaining=blocks(r).filter(hit=>hit.node.textContent==='────────────');assert.equal(remaining.length,1);assert.equal(remaining[0].node,fixture.manual);
});

test('pause and resume complete the pending image boundary before stopping and never duplicate it',async t=>{
 const r=await rt({count:3});t.after(()=>r.close());r.state.pauseAt=1;await r.normal();
 assert.equal(r.editor.readRun().paused,true);assert.equal(r.editor.readRun().items.length,1);assert.equal(rules(r).length,1);assert.equal(r.editor.readRun().pendingCoreDivider??null,null);
 r.state.pauseAt=0;await r.core.pasteSavedSpecial();completed(r);assert.equal(r.state.images.length,4);assert.equal(rules(r).length,4);
 const doc=r.doc();await r.core.pasteSavedSpecial();assert.deepEqual(r.doc(),doc);
});

test('a failed native image upload produces no divider or completed image checkpoint',async t=>{
 const r=await rt();t.after(()=>r.close());r.state.failAt=1;await r.normal();
 assert.equal(r.state.images.length,0);assert.equal(rules(r).length,0);assert.equal(r.editor.readRun().items.length,0);assert.equal(r.editor.readRun().pendingCoreDivider??null,null);
 r.state.failAt=0;await r.core.pasteSavedSpecial();completed(r);
});

test('a failed following upload removes its own temporary anchor and preserves the previous completed rule',async t=>{
 const r=await rt();t.after(()=>r.close());r.state.failAt=2;await r.normal();
 assert.equal(r.state.images.length,1);assert.equal(rules(r).length,1);assert.equal(blocks(r).filter(hit=>hit.node.type.name==='paragraph').length,2);
 assert.equal(r.editor.readRun().pendingCoreDivider??null,null);r.state.failAt=0;await r.core.pasteSavedSpecial();completed(r);
 assert.equal(blocks(r).filter(hit=>hit.node.type.name==='paragraph').length,2);
});

test('native insertion slots never delete an existing manual empty paragraph',async t=>{
 const r=await rt();t.after(()=>r.close());const manual=r.schema.nodes.paragraph.create();r.view.dispatch(r.view.state.tr.insert(r.view.state.doc.content.size,manual));
 const original=r.doc();await r.normal();completed(r);
 const empty=blocks(r).filter(hit=>hit.node.type.name==='paragraph'&&!hit.node.textContent);assert.equal(empty.length,1);assert.equal(empty[0].node,manual);
 await r.core.deleteAllGenerated({save:false});assert.deepEqual(r.doc(),original);
});

test('a clear quality hold creates neither a new image nor a divider',async t=>{
 const r=await rt({requestMutator:(url,payload)=>{if(new URL(url).pathname==='/api/v3/notes/n000000000001')payload.data.user.urlname='unrelated_person';return payload}});t.after(()=>r.close());
 await r.normal();assert.ok(r.editor.readRun().qualityHold);assert.equal(r.state.images.length,0);assert.equal(rules(r).length,0);assert.equal(r.editor.readRun().pendingCoreDivider??null,null);
});


// v295 no longer stops or repairs hand-edited boundaries. The native ownership
// proof remains solely to keep whole-batch deletion away from manual content.
for(const afterApply of [false,true])test('a divider adapter failure does not stop completed image uploads: '+afterApply,async t=>{
 const r=await rt();t.after(()=>r.close());const dispatch=r.view.dispatch.bind(r.view);let failed=false;
 r.view.dispatch=transaction=>{let before=0,after=0;r.view.state.doc.forEach(node=>{if(node.type.name==='horizontal_rule')before++});transaction.doc.forEach(node=>{if(node.type.name==='horizontal_rule')after++});if(!failed&&after>before){failed=true;if(afterApply)dispatch(transaction);throw Error('rule adapter failure')}return dispatch(transaction)};
 await r.normal();const run=r.editor.readRun();assert.equal(run.stage,'images_ready');assert.equal(run.items.length,3);assert.equal(r.state.images.length,3);assert.equal(rules(r).length,afterApply?3:2);assert.equal(run.pendingCoreDivider??null,null);
 const doc=r.doc();await r.core.pasteSavedSpecial();assert.deepEqual(r.doc(),doc);
});

test('notification-only deletion preserves native boundaries and whole-batch deletion restores the original text',async t=>{
 const r=await rt();t.after(()=>r.close());const original=r.doc();await r.normal();completed(r);const imagesOnly=r.doc();
 await r.core.createCardsAtTap();assert.equal(r.state.cards.length,3);await r.core.deleteNotificationCards({confirm:false,save:false});assert.deepEqual(r.doc(),imagesOnly);
 const removed=await r.core.deleteAllGenerated({save:false});assert.equal(removed.removedDividers,3);assert.deepEqual(r.doc(),original);
});

for(const version of [1,2])test('old pending divider '+version+' is retired without recreating manually edited content',async t=>{
 const r=await rt();t.after(()=>r.close());const fixture=installOwnedImage(r,{manual:true});legacyPending(r,fixture,{version});
 const doc=r.doc();await r.core.pasteSavedSpecial();assert.deepEqual(r.doc(),doc);assert.equal(r.state.images.length,0);assert.equal(r.editor.readRun().pendingCoreDivider??null,null);assert.equal(r.editor.readRun().stage,'images_ready');
 const removed=await r.core.deleteAllGenerated({save:false});assert.equal(removed.removedDividers,0);assert.equal(rules(r).length,1);assert.equal(rules(r)[0].node,fixture.manual);
});

test('an ambiguous native replacement never makes a pre-existing manual divider owned',async t=>{
 const r=await rt();t.after(()=>r.close());const fixture=installOwnedImage(r,{manual:true}),api=r.page.__MUMEI_PROFILE_CARD_DIVIDERS__,dispatch=r.view.dispatch.bind(r.view);let reordered=false;
 r.view.dispatch=transaction=>{dispatch(transaction);if(!reordered){reordered=true;const pos=fixture.image.pos+fixture.image.node.nodeSize,newNode=r.view.state.doc.nodeAt(pos),oldNode=r.view.state.doc.nodeAt(pos+newNode.nodeSize);dispatch(r.view.state.tr.replaceWith(pos,pos+newNode.nodeSize+oldNode.nodeSize,[oldNode,newNode]));}};
 await api.append(r.view,fixture.row,fixture.image);assert.equal(r.editor.readRun().coreDividerRecords?.length||0,0);assert.equal(rules(r)[0].node,fixture.manual);
 const removed=await r.core.deleteAllGenerated({save:false});assert.equal(removed.removedDividers,0);assert.equal(rules(r)[0].node,fixture.manual);
});

test('duplicate actual owned image IDs still stop without claiming completion',async t=>{
 const r=await rt({count:1});t.after(()=>r.close());await r.normal();completed(r);
 const first=images(r)[0],rule=r.view.state.doc.nodeAt(first.pos+first.node.nodeSize);r.view.dispatch(r.view.state.tr.insert(first.pos,[first.node,rule]));
 r.editor.writeRun({...r.editor.readRun(),stage:'images_building'});const doc=r.doc(),run=clone(r.editor.readRun());
 await r.core.pasteSavedSpecial();assert.deepEqual(r.doc(),doc);assert.deepEqual(clone(r.editor.readRun()),run);assert.equal(r.state.statuses.at(-1).bad,true);assert.match(r.state.statuses.at(-1).text,/一つに確認できません/);
});
