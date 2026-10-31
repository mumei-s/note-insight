import nodeTest from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {runtime,dependencies} from './fixtures/profile-card-quality-runtime.mjs';
import {contentRuntime} from '../scripts/profile-card-content-v292.mjs';
import {coreDividerRuntime} from '../scripts/profile-card-dividers-v293.mjs';
import {layoutRepairRuntime,transformCoreLayoutRepair} from '../scripts/profile-card-layout-repair-v293.mjs';

let oldCode;try{oldCode=execFileSync('git',['show','410c7d4:public/note-profile-card-likes300-fix-v220.user.js'],{encoding:'utf8',maxBuffer:3e6})}catch{}
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

test('a pending boundary is cleared only after a new matching owned rule and a manual rule is kept',async t=>{
 const r=await existing();t.after(()=>r.close());const run=r.core.readRun();let image;r.view.state.doc.forEach((node,pos)=>{if(!image&&node.type.name==='image')image={node,pos}});
 const divider=r.schema.nodes.horizontal_rule.create();r.view.dispatch(r.view.state.tr.insert(image.pos+image.node.nodeSize,divider));
 run.pendingCoreDivider={version:1,image:r.page.__MUMEI_PROFILE_CARD_DIVIDERS__.identity(image),runId:run.createdAt,articleKey:run.articleKey,node:divider.toJSON(),phase:'uncertain'};r.core.writeRun(run);
 const api=r.page.__MUMEI_PROFILE_CARD_LAYOUT_REPAIR__,plan=api.preview();await api.apply(plan.token);
 assert.equal(r.core.readRun().pendingCoreDivider,undefined);assert.equal(r.doc().content.filter(node=>node.type==='horizontal_rule').length,4);
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
