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
 const log=r.quality.snapshot().records.filter(record=>record.stage==='区切り');
 assert.ok(log.length>=3);assert.equal(new Set(log.map(record=>record.target)).size,3);assert.ok(log.every(record=>record.findings.every(item=>item.status==='confirmed')));
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
 const checks=r.quality.snapshot().records.filter(record=>record.stage==='区切り'&&record.target===fixture.row.urlname);
 assert.ok(checks.length>0,'the actual fallback boundary is inspected after its ownership checkpoint');
 assert.ok(checks.every(record=>record.findings.every(finding=>finding.status==='confirmed')),'a valid owned fallback cannot become a native-rule mismatch');
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

test('a rule transaction that fails before application checkpoints the image and retries only its missing boundary',async t=>{
 const r=await rt();t.after(()=>r.close());const dispatch=r.view.dispatch.bind(r.view);let failed=false;
 r.view.dispatch=transaction=>{let before=0,after=0;r.view.state.doc.forEach(node=>{if(node.type.name==='horizontal_rule')before++});transaction.doc.forEach(node=>{if(node.type.name==='horizontal_rule')after++});if(!failed&&after>before){failed=true;throw Error('rule fixture failure')}return dispatch(transaction)};
 await r.normal();assert.equal(r.state.images.length,1);assert.equal(r.editor.readRun().items.length,1);assert.equal(rules(r).length,0);assert.equal(r.editor.readRun().pendingCoreDivider.phase,'retryable');assert.notEqual(r.editor.readRun().stage,'images_ready');
 r.view.dispatch=dispatch;await r.core.pasteSavedSpecial();completed(r);assert.equal(r.state.images.length,3);assert.equal(rules(r).length,3);
});

test('a rule adapter throwing after application keeps ownership and resumes after that rule',async t=>{
 const r=await rt();t.after(()=>r.close());const dispatch=r.view.dispatch.bind(r.view);let failed=false;
 r.view.dispatch=transaction=>{let before=0,after=0;r.view.state.doc.forEach(node=>{if(node.type.name==='horizontal_rule')before++});transaction.doc.forEach(node=>{if(node.type.name==='horizontal_rule')after++});dispatch(transaction);if(!failed&&after>before){failed=true;throw Error('post-apply fixture failure')}};
 await r.normal();assert.equal(r.state.images.length,1);assert.equal(r.editor.readRun().items.length,1);assert.equal(rules(r).length,1);assert.equal(r.editor.readRun().pendingCoreDivider??null,null);assert.equal(r.editor.readRun().coreDividerRecords.length,1);
 r.view.dispatch=dispatch;await r.core.pasteSavedSpecial();completed(r);assert.equal(r.state.images.length,3);assert.equal(rules(r).length,3);
});

test('unconfirmed post-insert persistence never adopts a possibly manual rule after reloading',async t=>{
 const r=await rt();t.after(()=>r.close());
 r.state.storageFailure=(kind,key)=>key.includes('_run_')&&r.editor.readRun()?.coreDividerRecords?.length>0;
 await r.normal();assert.equal(r.state.images.length,1);assert.equal(rules(r).length,1);assert.notEqual(r.editor.readRun().stage,'images_ready');
 r.state.storageFailure=null;
 const next=await rt({localStorageMap:r.local,gmStorageMap:r.gm,restore:restore(r)});t.after(()=>next.close());
 const pending=next.editor.readRun().pendingCoreDivider;assert.equal(pending.phase,'prepared');const doc=next.doc();
 await next.core.pasteSavedSpecial();assert.deepEqual(next.doc(),doc);assert.equal(next.state.images.length,1);assert.ok(next.editor.readRun().pendingCoreDivider);assert.ok(next.state.statuses.at(-1).text.includes('保存記録が未確定'));
});

test('notification-only deletion preserves all owned boundaries while full current deletion removes them',async t=>{
 const r=await rt();t.after(()=>r.close());const original=r.doc();await r.normal();completed(r);const imagesOnly=r.doc();
 await r.core.createCardsAtTap();assert.equal(r.state.cards.length,3);await r.core.deleteNotificationCards({confirm:false,save:false});assert.deepEqual(r.doc(),imagesOnly);assert.equal(rules(r).length,3);
 const removed=await r.core.deleteAllGenerated({save:false});assert.equal(removed.removedDividers,3);assert.deepEqual(r.doc(),original);
});

test('an already completed v292 generic prefix is unchanged until explicit repair is chosen',async t=>{
 const oldCode=execFileSync('git',['show','410c7d4:public/note-profile-card-likes300-fix-v220.user.js'],{encoding:'utf8',maxBuffer:2e6});
 const old=await runtime({count:1,moduleCode:oldCode});t.after(()=>old.close());await old.normal();assert.equal(rules(old).length,0);
 await old.page.__MUMEI_PROFILE_CARD_RUN_STORE__.flush();
 const r=await rt({count:1,localStorageMap:old.local,gmStorageMap:old.gm,restore:restore(old)});t.after(()=>r.close());const doc=r.doc();
 await r.core.pasteSavedSpecial();assert.deepEqual(r.doc(),doc);assert.equal(rules(r).length,0);
});

test('an old partial prefix is preserved while new continuation images each receive their own rule',async t=>{
 const oldCode=execFileSync('git',['show','410c7d4:public/note-profile-card-likes300-fix-v220.user.js'],{encoding:'utf8',maxBuffer:2e6});
 const old=await runtime({count:2,moduleCode:oldCode});t.after(()=>old.close());old.state.pauseAt=1;await old.normal();assert.equal(old.editor.readRun().items.length,1);assert.equal(rules(old).length,0);await old.page.__MUMEI_PROFILE_CARD_RUN_STORE__.flush();
 const r=await rt({localStorageMap:old.local,gmStorageMap:old.gm,restore:restore(old)});t.after(()=>r.close());await r.core.pasteSavedSpecial();
 assert.equal(r.editor.readRun().stage,'images_ready');assert.equal(r.state.images.length,3);assert.equal(rules(r).length,2);assert.equal(r.editor.readRun().coreDividerRecords.length,2);
 assert.equal(r.page.__MUMEI_PROFILE_CARD_DIVIDERS__.owned(r.view,images(r)[0]),null);
});

test('divider identity keeps URL safety and avoids URL parsing for 200 canonical image records',async t=>{
 const r=await rt();t.after(()=>r.close());let parsed=0;
 r.c.URL=class extends URL{constructor(...args){parsed++;super(...args)}};
 const source=coreDividerRuntime.match(/function sameCoreDividerImage\(first,second\)\{[\s\S]*?\n}/)?.[0];assert.ok(source);
 r.core.patch('globalThis.optimizedDividerIdentity='+source);
 const same=r.c.optimizedDividerIdentity,url='https://note.com/person/n/n333333333333';
 assert.equal(same({id:'one',src:'old',url},{id:'one',src:'new',url}),true);
 assert.equal(same({id:'one',src:'same',url},{id:'two',src:'same',url}),false);
 assert.equal(same({src:'one',url},{src:'two',url}),false);
 assert.equal(same({id:'one',url},{id:'one',url:'https://note.com/another/n/n333333333333'}),false,'matching image IDs do not excuse a different target URL');
 assert.equal(same({id:'one',url:url+'?width=200#part'},{id:'one',url}),true,'URL normalization still handles query and fragment differences');
 assert.equal(same({src:'one',url:url+'?x=1'},{src:'one',url}),true);
 assert.equal(same(null,{id:'one',url}),false);
 parsed=0;const records=[];
 for(let index=0;index<200;index++){
  const identity={id:'image-'+index,src:'https://assets.st-note.com/'+index+'.png',url:'https://note.com/person_'+index+'/n/n'+index.toString(16).padStart(12,'0')};
  assert.equal(records.filter(record=>!same(record,identity)).length,index);records.push(identity);
  assert.equal(records.find(record=>same(record,identity)),identity);
 }
 assert.equal(parsed,0,'different stable IDs and equal canonical URL strings require no URL construction');
});

test('a native trailing paragraph does not invalidate a successful local rule insertion',async t=>{
 const r=await rt();t.after(()=>r.close());const dispatch=r.view.dispatch.bind(r.view);let appended=false;
 r.view.dispatch=transaction=>{const adds=transaction.doc.content.size>r.view.state.doc.content.size&&transaction.doc.lastChild?.type.name==='horizontal_rule';dispatch(transaction);if(adds&&!appended){appended=true;dispatch(r.view.state.tr.insert(r.view.state.doc.content.size,r.schema.nodes.paragraph.create()));}};
 await r.normal();completed(r);assert.equal(rules(r).length,3);assert.ok(appended);assert.equal(r.editor.readRun().pendingCoreDivider??null,null);
});

test('unrelated edits before the image preserve the locally verified image and rule',async t=>{
 const r=await rt();t.after(()=>r.close());const dispatch=r.view.dispatch.bind(r.view);let changed=false;
 r.view.dispatch=transaction=>{const adds=transaction.doc.lastChild?.type.name==='horizontal_rule'&&transaction.doc.content.size>r.view.state.doc.content.size;dispatch(transaction);if(adds&&!changed){changed=true;dispatch(r.view.state.tr.insertText('追記',1));}};
 await r.normal();completed(r);assert.ok(r.doc().content[0].content[0].text.includes('追記'));assert.equal(r.state.images.length,3);
});

test('native normalization of the new rule and image attributes is recorded from actual nodes',async t=>{
 const r=await rt();t.after(()=>r.close());const fixture=installOwnedImage(r,{nativeAttrs:true,manual:true}),dispatch=r.view.dispatch.bind(r.view),api=r.page.__MUMEI_PROFILE_CARD_DIVIDERS__;let normalized=false;
 r.view.dispatch=transaction=>{dispatch(transaction);if(!normalized){normalized=true;dispatch(r.view.state.tr.setNodeMarkup(fixture.image.pos,null,{...fixture.image.node.attrs,nativeState:'normalized'}));const pos=fixture.image.pos+fixture.image.node.nodeSize;dispatch(r.view.state.tr.setNodeMarkup(pos,null,{noteId:'native-generated'}));}};
 const result=await api.append(r.view,fixture.row,fixture.image);await r.page.__MUMEI_PROFILE_CARD_RUN_STORE__.flush();
 assert.equal(result.hit.node.attrs.nativeState,'normalized');assert.equal(result.divider.node.attrs.noteId,'native-generated');assert.equal(r.editor.readRun().coreDividerRecords[0].node.attrs.noteId,'native-generated');
 assert.equal(rules(r).length,2);assert.notEqual(result.divider.node,fixture.manual);
});

test('reordered pre-existing manual rules are never claimed as the new inserted rule',async t=>{
 for(const nativeAttrs of [false,true]){
  const r=await rt();t.after(()=>r.close());const fixture=installOwnedImage(r,{nativeAttrs,manual:true}),dispatch=r.view.dispatch.bind(r.view),api=r.page.__MUMEI_PROFILE_CARD_DIVIDERS__;let reordered=false;
  r.view.dispatch=transaction=>{dispatch(transaction);if(!reordered){reordered=true;const pos=fixture.image.pos+fixture.image.node.nodeSize,newNode=r.view.state.doc.nodeAt(pos),oldNode=r.view.state.doc.nodeAt(pos+newNode.nodeSize);dispatch(r.view.state.tr.replaceWith(pos,pos+newNode.nodeSize+oldNode.nodeSize,[oldNode,newNode]));}};
  await assert.rejects(api.append(r.view,fixture.row,fixture.image),/区切り線の挿入を確認できません/);
  assert.equal(r.editor.readRun().pendingCoreDivider.version,2);assert.equal(r.editor.readRun().coreDividerRecords?.length||0,0);assert.equal(rules(r)[0].node,fixture.manual);
 }
});

test('a fresh failed dispatcher cannot excuse an existing manual rule via legacy recovery',async t=>{
 const r=await rt();t.after(()=>r.close());const fixture=installOwnedImage(r,{manual:true}),api=r.page.__MUMEI_PROFILE_CARD_DIVIDERS__,dispatch=r.view.dispatch;
 r.view.dispatch=()=>{throw Error('fresh dispatch failed')};await assert.rejects(api.append(r.view,fixture.row,fixture.image),/fresh dispatch failed/);r.view.dispatch=dispatch;
 const run=r.editor.readRun();assert.equal(run.pendingCoreDivider.version,2);assert.equal(run.coreExternalDividerRecords?.length||0,0);assert.equal(api.external(r.view,fixture.image),null);
 // A fresh v2 prepared/uncertain checkpoint is not eligible even after reload.
 r.editor.writeRun({...run,pendingCoreDivider:{...run.pendingCoreDivider,phase:'uncertain'}});const before=r.doc();await r.core.pasteSavedSpecial();assert.deepEqual(r.doc(),before);assert.ok(r.editor.readRun().pendingCoreDivider);assert.equal(r.editor.readRun().coreExternalDividerRecords?.length||0,0);
});

test('legacy pending with a matching visible rule continues as explicitly unowned, without upload or duplicate',async t=>{
 const r=await rt();t.after(()=>r.close());const fixture=installOwnedImage(r,{manual:true});legacyPending(r,fixture);const before=r.doc();
 await r.core.pasteSavedSpecial();assert.deepEqual(r.doc(),before);assert.equal(r.state.images.length,0);assert.equal(r.editor.readRun().pendingCoreDivider??null,null);assert.equal(r.editor.readRun().coreDividerRecords?.length||0,0);assert.equal(r.editor.readRun().coreExternalDividerRecords.length,1);assert.equal(rules(r).length,1);
 const snapshots=r.quality.snapshot().records.filter(record=>record.stage==='区切りの所有');assert.ok(snapshots.length);assert.ok(snapshots.every(record=>record.findings.some(finding=>finding.status==='insufficient')));
 const writes=r.state.saves;await r.core.pasteSavedSpecial();assert.deepEqual(r.doc(),before);assert.equal(r.state.saves,writes,'a completed duplicate resume does not request another save');
 const removed=await r.core.deleteAllGenerated({save:false});assert.equal(removed.removedDividers,0);assert.equal(rules(r).length,1);assert.equal(rules(r)[0].node,fixture.manual);
});

test('legacy native-rule attribute normalization remains unowned while malformed or fallback changes stop',async t=>{
 const r=await rt();t.after(()=>r.close());const fixture=installOwnedImage(r,{nativeAttrs:true,manual:true}),planned=r.page.__MUMEI_PROFILE_CARD_DIVIDERS__.create(r.view).toJSON(),pos=fixture.image.pos+fixture.image.node.nodeSize;
 r.view.dispatch(r.view.state.tr.setNodeMarkup(pos,null,{noteId:'native-old'}));legacyPending(r,fixture,{planned});await r.core.pasteSavedSpecial();
 assert.equal(r.editor.readRun().coreExternalDividerRecords[0].plannedMatch,'native-attributes-unconfirmed');assert.equal(r.editor.readRun().coreExternalDividerRecords[0].node.attrs.noteId,'native-old');assert.equal(r.editor.readRun().coreDividerRecords?.length||0,0);
 for(const plannedNode of [{type:'does_not_exist'},{type:'paragraph',content:[{type:'text',text:'not a rule'}]}]){
  const bad=await rt();t.after(()=>bad.close());const item=installOwnedImage(bad,{manual:true});legacyPending(bad,item,{planned:plannedNode});const doc=bad.doc();await bad.core.pasteSavedSpecial();assert.deepEqual(bad.doc(),doc);assert.ok(bad.editor.readRun().pendingCoreDivider);assert.equal(bad.editor.readRun().coreExternalDividerRecords?.length||0,0);
 }
 const fallback=await rt();t.after(()=>fallback.close());const item=installOwnedImage(fallback,{fallback:true,manual:true});legacyPending(fallback,item,{planned:{type:'paragraph',content:[{type:'text',text:'───────────'}]}});const doc=fallback.doc();await fallback.core.pasteSavedSpecial();assert.deepEqual(fallback.doc(),doc);assert.ok(fallback.editor.readRun().pendingCoreDivider);
});

test('duplicate actual image IDs cannot collapse into legacy external-boundary uniqueness',async t=>{
 const r=await rt();t.after(()=>r.close());const fixture=installOwnedImage(r,{manual:true});legacyPending(r,fixture);
 r.view.dispatch(r.view.state.tr.insert(fixture.image.pos,fixture.image.node));const doc=r.doc();await r.core.pasteSavedSpecial();assert.deepEqual(r.doc(),doc);assert.ok(r.editor.readRun().pendingCoreDivider);assert.equal(r.editor.readRun().coreExternalDividerRecords?.length||0,0);assert.equal(r.state.images.length,0);
});

test('changed accepted external or owned boundaries stop instead of silently inserting another rule',async t=>{
 for(const external of [true,false]){
  const r=await rt();t.after(()=>r.close());const fixture=installOwnedImage(r,{manual:external}),api=r.page.__MUMEI_PROFILE_CARD_DIVIDERS__;
  if(external){legacyPending(r,fixture);await r.core.pasteSavedSpecial();}else{await api.append(r.view,fixture.row,fixture.image);await r.page.__MUMEI_PROFILE_CARD_RUN_STORE__.flush();}
  const pos=fixture.image.pos+fixture.image.node.nodeSize;r.view.dispatch(r.view.state.tr.delete(pos,pos+1));const doc=r.doc();await r.core.pasteSavedSpecial();assert.deepEqual(r.doc(),doc);assert.ok(r.state.statuses.at(-1).text.includes('移動・変更'));assert.equal(r.state.images.length,0);
 }
});

test('a final-image recovered boundary requests one real save and never invents successful persistence',async t=>{
 for(const saved of [true,'unconfirmed',false,'error']){
  const r=await rt();t.after(()=>r.close());const fixture=installOwnedImage(r,{manual:true});legacyPending(r,fixture);r.state.saveResult=saved==='unconfirmed'?{}:saved===true;if(saved==='error')r.state.saveError=Error('native save failure');const imagesBefore=r.state.images.length;
  await r.core.pasteSavedSpecial();assert.equal(r.state.saves,1);assert.equal(r.state.images.length,imagesBefore);assert.equal(rules(r).length,1);assert.equal(r.editor.readRun().draftSaveState,saved===true?'confirmed':'pending');
  if(saved==='unconfirmed'){assert.ok(r.state.statuses.at(-1).text.includes('下書き保存は未確認'));assert.equal(r.state.statuses.at(-1).bad,true);}
  if(saved===false||saved==='error'){assert.ok(r.state.statuses.at(-1).text.includes('停止'));assert.equal(r.state.statuses.at(-1).bad,true);}
 }
});

test('a recovered first-image external boundary continues after the existing rule and survives reload',async t=>{
 const r=await rt();t.after(()=>r.close());r.state.pauseAt=1;await r.normal();const run=r.editor.readRun(),hit=images(r)[0],row=run.rows[0],node=r.view.state.doc.nodeAt(hit.pos+hit.node.nodeSize);
 r.editor.writeRun({...run,coreDividerRecords:[],pendingCoreDivider:{version:1,phase:'uncertain',image:{id:hit.node.attrs.id,src:hit.node.attrs.src,url:row.url},node:node.toJSON(),runId:run.createdAt,articleKey:run.articleKey,at:1}});r.state.pauseAt=0;
 await r.core.pasteSavedSpecial();assert.equal(r.state.images.length,3);assert.equal(rules(r).length,3);assert.equal(r.editor.readRun().coreExternalDividerRecords.length,1);assert.equal(r.editor.readRun().coreDividerRecords.length,2);
 const doc=r.doc(),next=await r.reload();t.after(()=>next.close());await next.core.pasteSavedSpecial();assert.deepEqual(next.doc(),doc);assert.equal(next.state.images.length,3);assert.equal(rules(next).length,3);
 const first=images(next)[0],pos=first.pos+first.node.nodeSize;next.view.dispatch(next.view.state.tr.delete(pos,pos+1));const changed=next.doc();await next.core.pasteSavedSpecial();assert.deepEqual(next.doc(),changed);assert.equal(next.state.images.length,3);assert.ok(next.state.statuses.at(-1).text.includes('移動・変更'));
});

test('duplicate ordinary owned image IDs cannot be collapsed into a falsely completed resume',async t=>{
 const r=await rt({count:1});t.after(()=>r.close());await r.normal();completed(r);
 const first=images(r)[0],rule=r.view.state.doc.nodeAt(first.pos+first.node.nodeSize);r.view.dispatch(r.view.state.tr.insert(first.pos,[first.node,rule]));
 const run=r.editor.readRun();r.editor.writeRun({...run,stage:'images_building'});const before=r.doc(),checkpoint=clone(r.editor.readRun()),uploads=r.state.images.length;
 await r.core.pasteSavedSpecial();assert.deepEqual(r.doc(),before);assert.deepEqual(clone(r.editor.readRun()),checkpoint);assert.equal(r.editor.readRun().stage,'images_building');assert.equal(r.state.images.length,uploads);assert.equal(r.state.statuses.at(-1).bad,true);assert.ok(r.state.statuses.at(-1).text.includes('一つに確認できません'));
});

test('exact transaction references avoid redundant fallback work while native changes still run the full proof',async t=>{
 for(const normalize of [false,true]){
  const r=await rt();t.after(()=>r.close());r.c.proofCalls={rules:0,anchor:0,proof:0};
  r.core.patch(`const originalRulesForCount=coreDividerNeighborhood,originalAnchorForCount=coreEmptyAnchorNeighborhood,originalProofForCount=coreDividerInsertionProof;
coreDividerNeighborhood=function(...args){proofCalls.rules++;return originalRulesForCount(...args)};
coreEmptyAnchorNeighborhood=function(...args){proofCalls.anchor++;return originalAnchorForCount(...args)};
coreDividerInsertionProof=function(...args){proofCalls.proof++;return originalProofForCount(...args)};`);
  if(normalize){const dispatch=r.view.dispatch.bind(r.view);let changed=false;r.view.dispatch=transaction=>{const rule=transaction.doc.lastChild?.type.name==='horizontal_rule';dispatch(transaction);if(rule&&!changed){changed=true;dispatch(r.view.state.tr.insert(r.view.state.doc.content.size,r.schema.nodes.paragraph.create()));}};}
  await r.normal();completed(r);
  if(normalize){assert.ok(r.c.proofCalls.rules>0);assert.ok(r.c.proofCalls.proof>0);}
  else assert.deepEqual(clone(r.c.proofCalls),{rules:0,anchor:0,proof:0});
 }
});
