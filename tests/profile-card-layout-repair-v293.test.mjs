import nodeTest from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {runtime,dependencies} from './fixtures/profile-card-quality-runtime.mjs';
import {contentRuntime} from '../scripts/profile-card-content-v292.mjs';
import {coreDividerRuntime} from '../scripts/profile-card-dividers-v293.mjs';
import {layoutRepairRuntime,transformCoreLayoutRepair} from '../scripts/profile-card-layout-repair-v293.mjs';

let oldCode,legacy293Code;try{oldCode=execFileSync('git',['show','410c7d4:public/note-profile-card-likes300-fix-v220.user.js'],{encoding:'utf8',maxBuffer:3e6});legacy293Code=execFileSync('git',['show','9a2f79d:public/note-profile-card-likes300-fix-v220.user.js'],{encoding:'utf8',maxBuffer:3e6})}catch{}
const test=(name,fn)=>nodeTest(name,{skip:!dependencies||!oldCode?'Real PM/canvas and the published v2.9.2 baseline required':false},fn);
const clone=value=>JSON.parse(JSON.stringify(value));
const images=r=>r.doc().content.filter(node=>node.type==='image');
const cards=r=>r.doc().content.filter(node=>node.type==='embed');
const paragraphs=r=>r.doc().content.filter(node=>node.type==='paragraph').map(node=>(node.content||[]).map(child=>child.text||'').join(''));
async function existing({count=2,cardsReady=false}={}){
 const r=await runtime({count,moduleCode:oldCode});
 r.local.set('mumei_profile_card_presentation_v292',JSON.stringify({size:'thin',content:'profile'}));await r.normal();
 assert.equal(r.core.readRun()?.stage,'images_ready',r.state.statuses.at(-1)?.text);
 if(cardsReady)await r.core.createCardsAtTap();
 const before=r.doc();vm.runInContext(contentRuntime,r.c);r.core.patch(coreDividerRuntime+'\n'+layoutRepairRuntime);
 assert.deepEqual(r.doc(),before,'loading repair must never edit the old article');
 return r;
}
async function legacyPending({phase='prepared'}={}){
 assert.ok(legacy293Code,'the published v2.9.3 script is required');
 const r=await runtime({count:2,moduleCode:legacy293Code});
 // Reproduce the old post-HR/pre-final-checkpoint failure in the real compiled
 // path. One real owned image and its visible HR survive with legacy pending.
 r.core.patch("globalThis.legacyBoundaryWriter=writeRun;writeRun=function(value){if(value?.coreDividerRecords?.length&&!state.legacyBoundaryFailure){state.legacyBoundaryFailure=true;throw Error('legacy boundary finalization failure')}return legacyBoundaryWriter(value)};");
 await r.normal();r.core.patch('writeRun=legacyBoundaryWriter');
 assert.equal(r.state.images.length,1);assert.equal(r.doc().content.filter(node=>node.type==='horizontal_rule').length,1);assert.equal(r.core.readRun().pendingCoreDivider.phase,'prepared');
 if(phase!=='prepared'){const run=r.core.readRun();run.pendingCoreDivider.phase=phase;r.core.writeRun(run)}
 vm.runInContext(contentRuntime,r.c);r.core.patch(coreDividerRuntime+'\n'+layoutRepairRuntime);return r;
}

test('the repair transform only registers an explicit API and fails on an ambiguous hook',()=>{
 const source="const safe=1;\nif(document.readyState==='loading')start();";
 assert.ok(transformCoreLayoutRepair(source).includes('__MUMEI_PROFILE_CARD_LAYOUT_REPAIR__'));
 assert.throws(()=>transformCoreLayoutRepair(source+source),/match once/);
 assert.doesNotThrow(()=>new vm.Script(transformCoreLayoutRepair(source)));
});

test('preview is read-only, bounded, and identifies already pasted v2.9.2 paragraphs and missing owned rules',async t=>{
 const r=await existing({count:5});t.after(()=>r.close());const before=r.doc(),run=clone(r.core.readRun()),requests=r.state.requests.length,canvas=r.state.canvasCount,saves=r.state.saves;
 const plan=r.page.__MUMEI_PROFILE_CARD_LAYOUT_REPAIR__.preview();
 assert.equal(plan.paragraphs,5);assert.equal(plan.dividers,6);assert.equal(plan.changeCount,11);assert.equal(plan.samples.length,3);
 assert.ok(plan.samples.every(sample=>sample.beforeText===sample.afterText));assert.deepEqual(r.doc(),before);assert.deepEqual(clone(r.core.readRun()),run);
 assert.equal(r.state.requests.length,requests);assert.equal(r.state.canvasCount,canvas);assert.equal(r.state.saves,saves);
});

test('explicit repair changes only owned paragraphs/rules in one transaction and preserves images, links, captions, cards and same-text manual content',async t=>{
 const r=await existing();t.after(()=>r.close());const oldText=r.core.readRun().activityTexts[0];
 let firstImage;r.view.state.doc.forEach((node,pos)=>{if(!firstImage&&node.type.name==='image')firstImage={node,pos}});
 const manualRule=r.schema.nodes.horizontal_rule.create();r.view.dispatch(r.view.state.tr.insert(firstImage.pos+firstImage.node.nodeSize,manualRule));
 r.view.dispatch(r.view.state.tr.insert(r.view.state.doc.content.size,r.para(oldText)));
 // The native card anchor is established after these preexisting manual nodes.
 await r.core.createCardsAtTap();const originalRun=clone(r.core.readRun());
 const beforeImages=images(r),beforeCards=cards(r),beforeRequests=r.state.requests.length,beforeCanvas=r.state.canvasCount;
 let transactions=0;const originalDispatch=r.view.dispatch.bind(r.view);r.view.dispatch=transaction=>{transactions++;originalDispatch(transaction)};
 const api=r.page.__MUMEI_PROFILE_CARD_LAYOUT_REPAIR__,plan=api.preview(),result=await api.apply(plan.token),run=r.core.readRun();
 assert.equal(result.applied,true);assert.equal(result.saved,'confirmed');assert.equal(transactions,1);
 assert.deepEqual(images(r),beforeImages);assert.deepEqual(cards(r),beforeCards);assert.equal(r.state.requests.length,beforeRequests);assert.equal(r.state.canvasCount,beforeCanvas);
 assert.equal(paragraphs(r).filter(text=>text===oldText).length,1,'the identical manual formula remains');
 assert.deepEqual(clone(run.rows),originalRun.rows);assert.deepEqual(clone(run.items),originalRun.items);assert.deepEqual(clone(run.cardKeys),originalRun.cardKeys);
 assert.equal(r.doc().content.filter(node=>node.type==='horizontal_rule').length,4);
 const blocks=[];r.view.state.doc.forEach((node,pos)=>blocks.push({node,pos}));const first=blocks.findIndex(block=>block.node.type.name==='image');
 assert.equal(blocks[first+1].node.type.name,'horizontal_rule');assert.equal(blocks[first+2].node,manualRule,'a newly owned HR is inserted before the manual HR');
 for(const [url,text] of Object.entries(run.presentationTexts)){const position=run.presentationPositions[url];assert.equal(r.view.state.doc.nodeAt(position).textContent,text);assert.match(text,/\\tiny/);assert.equal(run.presentationLayouts[url].version,2)}
 assert.equal(api.preview().changeCount,0,'a second preview does not plan duplicate owned rules or paragraphs');
 await assert.rejects(api.apply(plan.token),/古く/);
 const requests=r.state.nativeCardRequests.length;await r.core.createCardsAtTap();assert.equal(r.state.nativeCardRequests.length,requests);assert.notEqual(r.state.statuses.at(-1).bad,true,r.state.statuses.at(-1).text);
});

for(const mutation of ['body','run','source','draft'])test('apply refuses stale '+mutation+' snapshots before any write',async t=>{
 const r=await existing();t.after(()=>r.close());const api=r.page.__MUMEI_PROFILE_CARD_LAYOUT_REPAIR__,plan=api.preview();
 if(mutation==='body')r.view.dispatch(r.view.state.tr.insert(r.view.state.doc.content.size,r.para('後から書いた本文')));
 else if(mutation==='draft')r.page.location.pathname='/notes/nbbbbbbbbbbbb/edit';
 else{const run=r.core.readRun();if(mutation==='source')run.rows[0].presentation.text='書き換えた内容';else run.changedAfterPreview=true;r.core.writeRun(run)}
 const before=r.doc(),run=clone(r.core.readRun()),saves=r.state.saves;await assert.rejects(api.apply(plan.token),/確認後/);
 assert.deepEqual(r.doc(),before);assert.deepEqual(clone(r.core.readRun()),run);assert.equal(r.state.saves,saves);
});

for(const unknown of ['intro-position','intro-source','missing-image','pending-card'])test('unclear '+unknown+' ownership aborts the preview without mutation',async t=>{
 const r=await existing();t.after(()=>r.close());const run=r.core.readRun();
 if(unknown==='intro-position'){let pos;r.view.state.doc.forEach((node,at)=>{if(pos===undefined&&node.type.name==='image')pos=at});r.view.dispatch(r.view.state.tr.insert(pos,r.para('手動で挿入した文章')))}
 else if(unknown==='intro-source'){run.rows[0].presentation.text='別の内容';r.core.writeRun(run)}
 else if(unknown==='missing-image'){run.items[0].id='missing-id';run.items[0].src='missing-src';r.core.writeRun(run)}
 else{run.pendingCard={url:run.rows[0].url,sessionId:'uncertain'};r.core.writeRun(run)}
 const before=r.doc(),saved=clone(r.core.readRun());assert.throws(()=>r.page.__MUMEI_PROFILE_CARD_LAYOUT_REPAIR__.preview(),/停止/);
 assert.deepEqual(r.doc(),before);assert.deepEqual(clone(r.core.readRun()),saved);
});

test('known source holds survive explicit layout repair unchanged',async t=>{
 const r=await existing();t.after(()=>r.close());const run=r.core.readRun();run.qualityHold={version:1,kind:'source',runId:run.createdAt,articleKey:run.articleKey,identity:{account:run.rows[0].urlname,key:run.rows[0].key,url:run.rows[0].url},reasons:[{code:'ARTICLE_ACCOUNT',expected:run.rows[0].urlname,actual:'wrong_account'}]};r.core.writeRun(run);
 const known=clone(r.core.readRun().qualityHold),api=r.page.__MUMEI_PROFILE_CARD_LAYOUT_REPAIR__,plan=api.preview();await api.apply(plan.token);assert.deepEqual(clone(r.core.readRun().qualityHold),known);
});

for(const failure of ['checkpoint','save-pending','save-error'])test(failure+' never reports repaired output as saved',async t=>{
 const r=await existing();t.after(()=>r.close());const api=r.page.__MUMEI_PROFILE_CARD_LAYOUT_REPAIR__,plan=api.preview(),before=images(r);
 if(failure==='checkpoint')r.state.storageFailure=()=>true;else if(failure==='save-pending')r.state.saveResult={confirmed:false};else r.state.saveError=new Error('fixture save failed');
 const result=await api.apply(plan.token);assert.equal(result.applied,true);assert.equal(result.saved,'pending');assert.match(result.message,/未確認/);assert.deepEqual(images(r),before);assert.equal(r.core.readRun().layoutRepair.saveState,'pending');
});

test('a shared old image-end/next-intro position maps the repaired paragraph after its new divider',async t=>{
 const r=await existing({count:3});t.after(()=>r.close());const api=r.page.__MUMEI_PROFILE_CARD_LAYOUT_REPAIR__,plan=api.preview();await api.apply(plan.token);const run=r.core.readRun();
 for(const [url,text] of Object.entries(run.presentationTexts))assert.equal(r.view.state.doc.nodeAt(run.presentationPositions[url]).textContent,text);
});

test('busy preview/apply are refused without adding a confirmation-driven automatic retry',async t=>{
 const r=await existing();t.after(()=>r.close());const api=r.page.__MUMEI_PROFILE_CARD_LAYOUT_REPAIR__,before=r.doc();
 r.core.patch('busy=true');assert.throws(()=>api.preview(),/実行中/);r.core.patch('busy=false');
 const plan=api.preview();r.core.patch('busy=true');await assert.rejects(api.apply(plan.token),/実行中/);assert.deepEqual(r.doc(),before);r.core.patch('busy=false');
 const result=await api.apply(plan.token);assert.equal(result.applied,true);
});

test('existing notification-card boundaries remain resumable after the owned text and rule transaction',async t=>{
 const r=await existing({cardsReady:true});t.after(()=>r.close());const before=cards(r),requests=r.state.nativeCardRequests.length,api=r.page.__MUMEI_PROFILE_CARD_LAYOUT_REPAIR__,plan=api.preview();await api.apply(plan.token);await r.core.createCardsAtTap();
 assert.deepEqual(cards(r),before);assert.equal(r.state.nativeCardRequests.length,requests);assert.notEqual(r.state.statuses.at(-1).bad,true,r.state.statuses.at(-1).text);
});

test('an image ID duplicated elsewhere cannot become a guessed repair target',async t=>{
 const r=await existing();t.after(()=>r.close());let image;r.view.state.doc.forEach(node=>{if(!image&&node.type.name==='image')image=node});r.view.dispatch(r.view.state.tr.insert(r.view.state.doc.content.size,image));
 const before=r.doc();assert.throws(()=>r.page.__MUMEI_PROFILE_CARD_LAYOUT_REPAIR__.preview(),/識別情報/);assert.deepEqual(r.doc(),before);
});

for(const phase of ['prepared','uncertain'])test('an explicit '+phase+' legacy recovery keeps the existing HR unowned without a duplicate or image resend',async t=>{
 const r=await legacyPending({phase});t.after(()=>r.close());const before=r.doc(),run=clone(r.core.readRun()),requests=r.state.requests.length,canvas=r.state.canvasCount;let dispatches=0;const dispatch=r.view.dispatch.bind(r.view);r.view.dispatch=tr=>{dispatches++;dispatch(tr)};
 const api=r.page.__MUMEI_PROFILE_CARD_LAYOUT_REPAIR__,plan=api.preview();assert.equal(plan.dividers,0);assert.equal(plan.reconciledDividers,1);assert.equal(plan.changeCount,1);assert.match(plan.message,/既存区切り線の記録復旧/);assert.match(plan.samples[0].after,/所有未確認/);
 assert.deepEqual(r.doc(),before);assert.deepEqual(clone(r.core.readRun()),run);const result=await api.apply(plan.token),repaired=r.core.readRun();
 assert.equal(result.saved,'confirmed');assert.equal(result.reconciledDividers,1);assert.equal(dispatches,0,'record-only recovery sends no editor transaction');assert.deepEqual(r.doc(),before);assert.equal(r.state.requests.length,requests);assert.equal(r.state.canvasCount,canvas);assert.equal(r.state.images.length,1);
 assert.equal(repaired.pendingCoreDivider,undefined);assert.equal(repaired.coreExternalDividerRecords.length,1);assert.equal(repaired.coreExternalDividerRecords[0].ownership,'unconfirmed');assert.ok(!repaired.coreDividerRecords?.length);
 let image;r.view.state.doc.forEach((node,pos)=>{if(node.type.name==='image')image={node,pos}});assert.equal(r.page.__MUMEI_PROFILE_CARD_DIVIDERS__.owned(r.view,image,repaired),null);assert.ok(r.page.__MUMEI_PROFILE_CARD_DIVIDERS__.external(r.view,image,repaired));assert.equal(api.preview().changeCount,0);
});

test('legacy record recovery reports checkpoint failure without changing the existing document or claiming persistence',async t=>{
 const r=await legacyPending();t.after(()=>r.close());const before=r.doc(),requests=r.state.requests.length,api=r.page.__MUMEI_PROFILE_CARD_LAYOUT_REPAIR__,plan=api.preview();r.state.storageFailure=()=>true;
 const result=await api.apply(plan.token);assert.equal(result.applied,true);assert.equal(result.saved,'pending');assert.match(result.message,/未確認/);assert.deepEqual(r.doc(),before);assert.equal(r.state.requests.length,requests);assert.equal(r.state.images.length,1);
 assert.equal(r.core.readRun().coreExternalDividerRecords[0].ownership,'unconfirmed');assert.equal(api.preview().changeCount,0,'in-memory recovery cannot duplicate the existing line');
 const persisted=JSON.parse(r.local.get('mumei_profile_card_paster_run_v15:naaaaaaaaaaaa'));assert.ok(persisted.pendingCoreDivider);assert.ok(!persisted.coreExternalDividerRecords?.length,'failed persistence is not invented');
});

for(const unsupported of ['fresh-v2','retryable','different-planned-node'])test(unsupported+' cannot be treated as a legacy visible boundary',async t=>{
 const r=await legacyPending();t.after(()=>r.close());const run=r.core.readRun();
 if(unsupported==='fresh-v2')run.pendingCoreDivider.version=2;else if(unsupported==='retryable')run.pendingCoreDivider.phase='retryable';else run.pendingCoreDivider.node={type:'paragraph',content:[{type:'text',text:'different planned node'}]};r.core.writeRun(run);
 const before=r.doc(),saved=clone(r.core.readRun());assert.throws(()=>r.page.__MUMEI_PROFILE_CARD_LAYOUT_REPAIR__.preview(),/確認できません/);assert.deepEqual(r.doc(),before);assert.deepEqual(clone(r.core.readRun()),saved);
});

test('an acknowledged external HR remains excluded from whole-batch owned deletion',async t=>{
 const r=await legacyPending();t.after(()=>r.close());const api=r.page.__MUMEI_PROFILE_CARD_LAYOUT_REPAIR__,plan=api.preview();await api.apply(plan.token);await r.core.deleteAllGenerated({save:false});
 assert.equal(images(r).length,0);assert.equal(r.doc().content.filter(node=>node.type==='horizontal_rule').length,1,'the acknowledged line was never promoted to owned output');
});

test('a later moved external boundary stops a new repair preview instead of inserting a duplicate',async t=>{
 const r=await legacyPending();t.after(()=>r.close());const api=r.page.__MUMEI_PROFILE_CARD_LAYOUT_REPAIR__,plan=api.preview();await api.apply(plan.token);let image;r.view.state.doc.forEach((node,pos)=>{if(node.type.name==='image')image={node,pos}});
 r.view.dispatch(r.view.state.tr.insert(image.pos+image.node.nodeSize,r.para('手動で挿入した文章')));const before=r.doc();assert.throws(()=>api.preview(),/既存区切り線.*(?:移動|変更)/);assert.deepEqual(r.doc(),before);assert.equal(r.doc().content.filter(node=>node.type==='horizontal_rule').length,1);
});

test('a changed registered owned boundary stops preview rather than inserting a second line',async t=>{
 const r=await existing();t.after(()=>r.close());const api=r.page.__MUMEI_PROFILE_CARD_LAYOUT_REPAIR__,plan=api.preview();await api.apply(plan.token);let image;r.view.state.doc.forEach((node,pos)=>{if(!image&&node.type.name==='image')image={node,pos}});
 const at=image.pos+image.node.nodeSize,node=r.view.state.doc.nodeAt(at);r.view.dispatch(r.view.state.tr.replaceWith(at,at+node.nodeSize,r.para('利用者が変更した区切り線')));const before=r.doc();
 assert.throws(()=>api.preview(),/区切り線.*(?:確認|移動|変更)/);assert.deepEqual(r.doc(),before);assert.equal(r.doc().content.filter(node=>node.type==='horizontal_rule').length,2);
});

test('legacy boundary record recovery cannot release a separate known quality hold or mark images complete',async t=>{
 const r=await legacyPending();t.after(()=>r.close());const run=r.core.readRun();run.qualityHold={version:1,kind:'source',phase:'images',index:0,runId:run.createdAt,articleKey:run.articleKey,identity:{account:run.rows[0].urlname,key:run.rows[0].key,url:run.rows[0].url},reasons:[{code:'ARTICLE_ACCOUNT',expected:run.rows[0].urlname,actual:'wrong_account'}]};r.core.writeRun(run);
 const before=clone(r.core.readRun().qualityHold),api=r.page.__MUMEI_PROFILE_CARD_LAYOUT_REPAIR__,plan=api.preview();await api.apply(plan.token);
 assert.deepEqual(clone(r.core.readRun().qualityHold),before);assert.equal(r.core.readRun().stage,'images_building');assert.ok(!r.core.readRun().imagesCompletedAt);assert.equal(r.state.images.length,1);
});

test('legacy visible-boundary acknowledgement rejects a stale token before writing its new record',async t=>{
 const r=await legacyPending();t.after(()=>r.close());const api=r.page.__MUMEI_PROFILE_CARD_LAYOUT_REPAIR__,plan=api.preview();r.view.dispatch(r.view.state.tr.insert(r.view.state.doc.content.size,r.para('確認後の本文編集')));
 const before=r.doc(),run=clone(r.core.readRun());await assert.rejects(api.apply(plan.token),/確認後/);assert.deepEqual(r.doc(),before);assert.deepEqual(clone(r.core.readRun()),run);assert.ok(r.core.readRun().pendingCoreDivider);assert.ok(!r.core.readRun().coreExternalDividerRecords?.length);
});

test('legacy native HR attribute normalization is retained as unowned actual JSON with ownership and provenance unconfirmed',async t=>{
 const r=await legacyPending();t.after(()=>r.close());
 const nodes={},marks={};r.schema.spec.nodes.forEach((name,spec)=>{nodes[name]=spec});r.schema.spec.marks.forEach((name,spec)=>{marks[name]=spec});nodes.horizontal_rule={...nodes.horizontal_rule,attrs:{variant:{default:'normalized'}}};
 const schema=new dependencies.Schema({nodes,marks}),doc=schema.nodeFromJSON(r.doc());r.view.state=dependencies.EditorState.create({schema,doc});
 const run=r.core.readRun();run.pendingCoreDivider.node={type:'horizontal_rule',attrs:{variant:'planned-before-note-normalization'}};r.core.writeRun(run);
 delete r.page.__MUMEI_PROFILE_CARD_QUALITY__;vm.runInContext(readFileSync('public/note-profile-card-paster-quality-v290.js','utf8'),r.c);r.quality.externalBoundary=r.page.__MUMEI_PROFILE_CARD_QUALITY__.externalBoundary;
 const before=r.doc(),api=r.page.__MUMEI_PROFILE_CARD_LAYOUT_REPAIR__,plan=api.preview(),result=await api.apply(plan.token),record=r.core.readRun().coreExternalDividerRecords[0];
 assert.equal(result.saved,'confirmed');assert.deepEqual(r.doc(),before);assert.equal(record.ownership,'unconfirmed');assert.equal(record.plannedMatch,'native-attributes-unconfirmed');assert.equal(record.node.attrs.variant,'normalized');assert.ok(!r.core.readRun().coreDividerRecords?.length);
 const findings=r.page.__MUMEI_PROFILE_CARD_QUALITY__.snapshot().records.flatMap(item=>item.findings);assert.ok(findings.some(finding=>finding.check==='既存区切りの所有'&&finding.status==='insufficient'&&finding.evidence.deleteEligible===false));
});

test('a native-rule-free schema gets an explicitly owned fallback without adopting equal manual text',async t=>{
 const r=await existing();t.after(()=>r.close());delete r.schema.nodes.horizontal_rule;
 // Load the actual new inspector while retaining the already-pasted v2.9.2
 // document; force the adapter fallback to exercise its isDivider predicate.
 delete r.page.__MUMEI_PROFILE_CARD_QUALITY__;vm.runInContext(readFileSync('public/note-profile-card-paster-quality-v290.js','utf8'),r.c);
 r.core.patch("qualityCall=(method,args,fallback)=>page.__MUMEI_PROFILE_CARD_QUALITY__?.[method]?.(...args)??fallback;");
 delete r.page.__MUMEI_PROFILE_CARD_DIVIDERS__.observe;
 let image;r.view.state.doc.forEach((node,pos)=>{if(!image&&node.type.name==='image')image={node,pos}});r.view.dispatch(r.view.state.tr.insert(image.pos+image.node.nodeSize,r.para('────────────')));
 const api=r.page.__MUMEI_PROFILE_CARD_LAYOUT_REPAIR__,plan=api.preview();await api.apply(plan.token);
 assert.equal(r.core.readRun().coreDividerRecords.length,3);assert.ok(r.core.readRun().coreDividerRecords.every(record=>record.kind==='fallback'));assert.equal(paragraphs(r).filter(text=>text==='────────────').length,4);assert.equal(api.preview().changeCount,0);
 const quality=r.page.__MUMEI_PROFILE_CARD_QUALITY__.snapshot(),boundaries=quality.records.flatMap(record=>record.findings).filter(finding=>finding.check==='直後の区切り');
 assert.equal(quality.fault,false);assert.equal(boundaries.filter(finding=>finding.status==='confirmed').length,3);assert.ok(!boundaries.some(finding=>finding.status==='mismatch'),'owned fallback paragraphs are valid boundaries, not false mismatches');
});

test('a dispatch adapter that throws after applying the exact repair still checkpoints ownership and reports save pending',async t=>{
 const r=await existing();t.after(()=>r.close());const api=r.page.__MUMEI_PROFILE_CARD_LAYOUT_REPAIR__,plan=api.preview(),beforeImages=images(r),saves=r.state.saves;
 const dispatch=r.view.dispatch.bind(r.view);let attempts=0;r.view.dispatch=transaction=>{attempts++;dispatch(transaction);throw new Error('fixture after-apply adapter failure')};
 const result=await api.apply(plan.token),run=r.core.readRun();assert.equal(attempts,1);assert.equal(result.applied,true);assert.equal(result.saved,'pending');assert.match(result.message,/未確認.*after-apply/);assert.equal(r.state.saves,saves);
 assert.deepEqual(images(r),beforeImages);assert.equal(run.coreDividerRecords.length,3);assert.equal(run.layoutRepair.saveState,'pending');assert.equal(run.draftSaveState,'pending','the old successful save must not describe the newly repaired body');
 for(const [url,text] of Object.entries(run.presentationTexts))assert.equal(r.view.state.doc.nodeAt(run.presentationPositions[url]).textContent,text);
 assert.equal(api.preview().changeCount,0,'verified ownership survives the adapter error without a second dispatch');
 const persisted=JSON.parse(r.local.get('mumei_profile_card_paster_run_v15:naaaaaaaaaaaa'));assert.deepEqual(persisted.presentationTexts,clone(run.presentationTexts));assert.equal(persisted.coreDividerRecords.length,3);
});

test('a dispatch failure before application leaves both the document and ownership checkpoint unchanged',async t=>{
 const r=await existing();t.after(()=>r.close());const api=r.page.__MUMEI_PROFILE_CARD_LAYOUT_REPAIR__,plan=api.preview(),before=r.doc(),run=clone(r.core.readRun()),saves=r.state.saves;let attempts=0;
 r.view.dispatch=()=>{attempts++;throw new Error('fixture before-apply adapter failure')};await assert.rejects(api.apply(plan.token),/before-apply/);
 assert.equal(attempts,1);assert.deepEqual(r.doc(),before);assert.deepEqual(clone(r.core.readRun()),run);assert.equal(r.state.saves,saves);
});
