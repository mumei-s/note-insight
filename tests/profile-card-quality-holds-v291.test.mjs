import nodeTest from 'node:test';
import assert from 'node:assert/strict';
import {runtime,dependencies,baselineCode} from './fixtures/profile-card-quality-runtime.mjs';

const test=(name,fn)=>nodeTest(name,{skip:!dependencies?'Real PM/canvas dependencies are required':false},fn);
const clone=value=>JSON.parse(JSON.stringify(value));
const selected=run=>Array.from(run.rows,row=>({urlname:row.urlname,key:row.key,url:row.url,index:row.index,designIndex:row.designIndex}));
const wrongOwner=(index,isWrong=()=>true)=>(url,payload)=>{
 if(isWrong()&&new URL(url).pathname==='/api/v3/notes/n'+(index+1).toString(16).padStart(12,'0'))payload.data.user.urlname='unrelated_account';
 return payload;
};
function successful(r,run=r.editor.readRun()){
 assert.equal(run?.stage,'images_ready',r.state.statuses.at(-1)?.text);
 assert.equal(run.rows.length,r.state.images.length);
 assert.equal(run.qualityHold??null,null);
 assert.equal(new Set(run.items.map(item=>item.url)).size,run.rows.length);
}
function held(r,{index,phase='images',kind='source',images=index,cards=0}={}){
 const run=r.editor.readRun(),hold=run?.qualityHold;
 assert.ok(hold,'the original durable run checkpoint must retain the quality hold');
 assert.equal(hold.index,index);assert.equal(hold.phase,phase);assert.equal(hold.kind,kind);
 assert.equal(hold.identity.account,run.rows[index].urlname);
 assert.equal(hold.identity.key,run.rows[index].key);
 assert.equal(hold.identity.url,run.rows[index].url);
 assert.equal(hold.runId,run.createdAt);
 assert.ok(hold.reasons.length);
 assert.equal(r.state.images.length,images);assert.equal(r.state.cards.length,cards);
 assert.notEqual(run.stage,'complete');
 if(phase==='images'){assert.equal(run.stage,'images_building');assert.ok(!run.imagesCompletedAt)}
 assert.ok(!run.imageSkipped?.length,'a held participant must never enter asset replacement');
 return run;
}
function injectCardMismatch(r,index){
 const run=r.editor.readRun(),row=run.rows[index];
 const changed=r.quality.acquired({...row},{target:row.urlname,note:{...r.note(row.urlname),user:{...r.note(row.urlname).user,urlname:'unrelated_account'}},profile:{urlname:row.urlname},selected:row});
 const rows=run.rows.slice();rows[index]=changed;r.editor.writeRun({...run,rows});
 return selected(r.editor.readRun());
}
async function acquisitionOnlyPlan(r){
 await r.history();successful(r);const template=clone(r.editor.readRun());await r.core.deleteAllGenerated({save:false});
 const row=template.rows[0],note=r.note(row.urlname),bad=r.quality.acquired({...row},{target:row.urlname,note:{...note,user:{...note.user,urlname:'unrelated_account'}},profile:{urlname:row.urlname},selected:row});
 const rows=[bad,...template.rows.slice(1)],run={...template,createdAt:++r.state.clock,stage:'images_building',rows,items:[],cardKeys:[],sectionHeadings:[],activityTexts:[],dividerUrls:[],paused:false,pauseStage:null};
 for(const name of ['qualityHold','imagesCompletedAt','cardsCompletedAt','draftSaveState'])delete run[name];
 r.state.images=[];r.state.cards=[];r.state.nativeCardRequests=[];r.state.serial=0;r.state.canvasCount=0;r.state.requests=[];
 return{bad,run};
}

test('preflight accepts only validated identity contradictions and preserves missing-material fallbacks',async t=>{
 const r=await runtime();t.after(()=>r.close());const q=r.quality;
 const base={urlname:'person_a',key:'n000000000001',url:'https://note.com/person_a/n/n000000000001',creator:'表示名🌸',profileText:'改行を\n保持',actorImageUrl:'',thumbUrl:''};
 const source=(article,profile={urlname:'person_a'})=>{
  const selected=q.rawRow(base,article,{urlname:'person_a'});
  return q.acquired({...selected},{target:'person_a',note:article,profile,selected});
 };
 const good=source({key:base.key,user:{urlname:'person_a',nickname:'以前の名前'}});
 assert.equal(q.preflight(base),null,'legacy rows without independent provenance must retain the old path');
 assert.equal(q.preflight(good),null);
 assert.equal(q.preflight(good,{file:{name:'untracked-file.png'}}),null,'unobserved file provenance is insufficient, not a proven swap');
 assert.equal(q.preflight(source({key:'unavailable',user:{urlname:'person_a'}})),null,'malformed article IDs are not independent contradictory IDs');
 assert.equal(q.preflight(source({key:base.key,user:{urlname:'invalid account'}})),null,'malformed accounts are insufficient');
 assert.equal(q.preflight(source({key:base.key,user:{urlname:'person_a'}},{})),null,'a missing profile ID cannot become a hold');
 const profileOnly=q.acquired({...base,key:'',url:'https://note.com/person_a',profileOnly:true},{target:'person_a',profile:{urlname:'person_a'}});
 assert.equal(q.preflight(profileOnly),null);
 for(const creator of ['別名🐰','同名の作者さん','装飾した表示名'])assert.equal(q.preflight(source({key:base.key,name:'関係ない話題',user:{urlname:'person_a',nickname:creator}})),null);
 const bad=source({key:base.key,user:{urlname:'person_b'}}),result=q.preflight(bad);
 assert.equal(result.hold,true);assert.equal(result.kind,'source');assert.ok(result.reasons.some(reason=>reason.expected==='person_a'&&reason.actual==='person_b'));
 q.failed();assert.equal(q.preflight(bad),null,'a failed inspector must not create a new diagnosis');
});

for(const flow of ['history','special'])test('a first-row source hold precedes all '+flow+' headings, profiles and native uploads',async t=>{
 const r=await runtime({count:3,requestMutator:wrongOwner(0)});t.after(()=>r.close());
 const original=r.doc();await(flow==='history'?r.history():r.normal({flow}));
 const run=held(r,{index:0});assert.deepEqual(r.doc(),original);assert.equal(r.state.canvasCount,0,'source contradictions must gate rendering');
 assert.deepEqual(Array.from(run.rows.slice(0,3),row=>row.urlname),['quality_person_0','quality_person_1','quality_person_2']);
 assert.equal(run.rows.at(-1).urlname,'fuku444');assert.equal(run.sectionHeadings.length,0);assert.equal(run.activityTexts?.length||0,0);
 const plan=selected(run),batch=r.quality.snapshot().batchId;
 await(flow==='history'?r.history():r.core.pasteSavedSpecial());
 held(r,{index:0});assert.deepEqual(r.doc(),original);assert.deepEqual(selected(r.editor.readRun()),plan);assert.equal(r.quality.snapshot().batchId,batch);
 await r.core.createCardsAtTap();assert.equal(r.state.nativeCardRequests.length,0);assert.deepEqual(r.doc(),original);assert.notEqual(r.editor.readRun().stage,'complete');
});

for(const flow of ['normal','special'])for(const disable of ['off','fault','missing'])test('initial core '+flow+' action cannot overwrite a first-row hold after reload with inspector '+disable,async t=>{
 const r=await runtime({count:3,requestMutator:wrongOwner(0)});t.after(()=>r.close());await r.normal({flow});
 const run=held(r,{index:0}),known=clone(run.qualityHold),plan=selected(run),stopped=r.doc();assert.equal(run.items.length,0);
 const next=await r.reload({record:disable!=='off'});t.after(()=>next.close());
 if(disable==='fault')next.quality.failed();
 if(disable==='missing'){delete next.quality.preflight;delete next.page.__MUMEI_PROFILE_CARD_QUALITY__}
 await next.normal({flow});const retained=held(next,{index:0});
 assert.equal(retained.createdAt,run.createdAt);assert.deepEqual(clone(retained.qualityHold),known);assert.deepEqual(selected(retained),plan);assert.deepEqual(next.doc(),stopped);
 assert.equal(next.state.canvasCount,0);assert.equal(next.state.requests.length,0,'the initial action must honor a saved hold before starting a new acquisition batch');
});

for(const disable of ['fault','missing'])test('an acquisition-only negative survives inspector '+disable+' before the first image gate',async t=>{
 const r=await runtime({count:2});t.after(()=>r.close());const {bad,run}=await acquisitionOnlyPlan(r);
 assert.ok(bad.qualitySourceIssue,'a validated acquisition contradiction must travel with its pending row');
 assert.ok(run.rows.slice(1).every(row=>!row.qualitySourceIssue),'ordinary acquired rows need no durable issue field');
 r.editor.writeRun(run);assert.equal(r.editor.readRun().qualityHold??null,null);const stopped=r.doc();
 if(disable==='fault')r.quality.failed();
 else{delete r.quality.preflight;delete r.page.__MUMEI_PROFILE_CARD_QUALITY__}
 await r.history();held(r,{index:0});assert.deepEqual(r.doc(),stopped);assert.equal(r.state.canvasCount,0);assert.equal(r.state.requests.length,0);
});

test('an acquisition-only negative survives source/log eviction and an OFF reload before any paste',async t=>{
 const r=await runtime({count:2});t.after(()=>r.close());const {bad,run}=await acquisitionOnlyPlan(r);
 assert.ok(bad.qualitySourceIssue);assert.ok(!bad.qualitySource);
 for(let i=0;i<1200;i++){
  const id='eviction_person_'+i,key='n'+(i+100).toString(16).padStart(12,'0'),raw={key,user:{urlname:id}},row={urlname:id,key,url:'https://note.com/'+id+'/n/'+key};
  const selected=r.quality.rawRow(row,raw,{urlname:id});r.quality.acquired(selected,{target:id,note:raw,profile:{urlname:id},selected});
 }
 assert.equal(r.quality.provenance(bad),null,'the negative fixture must exceed the actual provenance cache capacity');
 assert.ok(!r.quality.snapshot().records.some(record=>record.target===bad.urlname),'its acquisition log must also be evicted');
 r.editor.writeRun(run);assert.equal(r.editor.readRun().qualityHold??null,null);const stopped=r.doc(),plan=selected(r.editor.readRun());
 const next=await r.reload({record:false});t.after(()=>next.close());assert.equal(next.editor.readRun().qualityHold??null,null);
 await next.history();held(next,{index:0});assert.deepEqual(next.doc(),stopped);assert.deepEqual(selected(next.editor.readRun()),plan);assert.equal(next.state.canvasCount,0);assert.equal(next.state.requests.length,0);
});

test('a 2.9.0 recorded contradiction migrates while OFF and stays resolved after a verified repair and reload',async t=>{
 const r=await runtime({count:2});t.after(()=>r.close());const {run}=await acquisitionOnlyPlan(r);
 run.version='2.9.0';run.rows=run.rows.map(({qualitySourceIssue,...row})=>row);r.editor.writeRun(run);
 r.quality.saved({confirmed:false});r.quality.flush();const snapshot=r.quality.snapshot();
 assert.equal(snapshot.runId,run.createdAt);assert.ok(snapshot.batchId);
 assert.ok(snapshot.records.some(record=>record.batchId===snapshot.batchId&&record.target===run.rows[0].urlname&&record.stage==='取得'&&record.findings.some(finding=>finding.status==='mismatch'&&finding.check==='対象と投稿者')));
 assert.ok(!r.editor.readRun().qualityHold);assert.ok(r.editor.readRun().rows.every(row=>!row.qualitySourceIssue));const stopped=r.doc(),plan=selected(r.editor.readRun());
 const off=await r.reload({record:false});t.after(()=>off.close());await off.history();const migrated=held(off,{index:0});
 assert.ok(migrated.rows[0].qualitySourceIssue);assert.deepEqual(off.doc(),stopped);assert.deepEqual(selected(migrated),plan);assert.equal(off.state.canvasCount,0);assert.equal(off.state.requests.length,0);
 off.local.set('mumei_profile_quality_mode_v1','on');const repaired=await off.reload();t.after(()=>repaired.close());await repaired.history();successful(repaired);
 assert.ok(!repaired.editor.readRun().rows[0].qualitySourceIssue);
 assert.ok(repaired.quality.snapshot().records.some(record=>record.target===run.rows[0].urlname&&record.findings.some(finding=>finding.status==='mismatch')&&Number.isFinite(record.resolvedAt)),'verified checkpoint repair retains the old evidence with a resolution timestamp');
 const completed=repaired.doc(),again=await repaired.reload();t.after(()=>again.close());await again.history();successful(again);assert.deepEqual(again.doc(),completed);assert.equal(again.state.requests.length,0,'resolved legacy evidence must not trigger a perpetual migration/refetch loop');
});

test('fresh metadata cannot release a hold when an older version already owns the pending introduction',async t=>{
 const r=await runtime({count:3,requestMutator:wrongOwner(0)});t.after(()=>r.close());await r.history();const run=held(r,{index:0});
 // This case explicitly reproduces a pre-presentation version's owned profile.
 run.rows=run.rows.map(({presentation,...row})=>row);r.editor.writeRun(run);
 const original=clone(run.rows[0]),known=clone(run.qualityHold),text=r.editor.activityText(run.rows[0]);
 r.view.dispatch(r.view.state.tr.insert(run.imageAnchorPos,r.para(text)));r.editor.writeRun({...run,activityTexts:[text]});
 const legacyDoc=r.doc(),saves=r.state.saves;
 r.state.requestMutator=(url,payload)=>{if(new URL(url).pathname==='/api/v2/creators/quality_person_0')payload.data.creator.profile='新しいプロフィールへ変更されました。';return payload};
 for(let retry=0;retry<2;retry++){
  await r.history();const retained=held(r,{index:0});assert.deepEqual(clone(retained.qualityHold),known);assert.deepEqual(clone(retained.rows[0]),original);
  assert.deepEqual(Array.from(retained.activityTexts),[text]);assert.deepEqual(r.doc(),legacyDoc);assert.equal(r.state.canvasCount,0);assert.equal(r.state.saves,saves);
  assert.equal(r.doc().content.filter(node=>node.type==='paragraph'&&node.content?.some(part=>part.text===text)).length,1,'the existing introduction remains exact and is never duplicated');
 }
});

test('a middle source hold keeps the exact prefix, makes no row-11 heading and repairs only the same pending person',async t=>{
 let wrong=true;const r=await runtime({count:12,requestMutator:wrongOwner(10,()=>wrong)});t.after(()=>r.close());
 await r.history();const run=held(r,{index:10}),plan=selected(run),prefix=clone(r.state.images),pausedDoc=r.doc(),batch=r.quality.snapshot().batchId;
 assert.equal(pausedDoc.content.filter(node=>node.type==='heading').length,1);
 assert.ok(!pausedDoc.content.some(node=>node.type==='paragraph'&&JSON.stringify(node).includes('quality_person_10')));
 assert.equal(r.state.canvasCount,10);assert.equal(run.rows.length,13);
 await r.history();held(r,{index:10});assert.deepEqual(r.doc(),pausedDoc);assert.deepEqual(selected(r.editor.readRun()),plan);
 const retryStart=r.state.requests.length;wrong=false;await r.history();successful(r);
 assert.ok(!r.editor.readRun().rows[10].qualitySourceIssue,'fully verified fresh identities must clear the pending row diagnostic');
 assert.deepEqual(selected(r.editor.readRun()),plan);assert.deepEqual(r.state.images.slice(0,10),prefix);assert.equal(r.quality.snapshot().batchId,batch);
 const retries=r.state.requests.slice(retryStart);
 assert.ok(retries.some(url=>new URL(url).pathname==='/api/v3/notes/n00000000000b'));
 assert.ok(retries.every(url=>{const path=new URL(url).pathname;return path.includes('/quality_person_10')||path==='/api/v3/notes/n00000000000b'}),'source repair may only refetch the pending selected account/article');
 assert.ok(!r.state.requests.some(url=>/quality_person_(?:1[2-9]|[2-9]\d)/.test(url)),'a hold never replenishes from later candidates');
});

test('core special resume repairs a held row before adding its section heading',async t=>{
 let wrong=true;const r=await runtime({count:12,requestMutator:wrongOwner(10,()=>wrong)});t.after(()=>r.close());
 await r.normal({flow:'special'});const run=held(r,{index:10}),plan=selected(run),stopped=r.doc();
 assert.equal(stopped.content.filter(node=>node.type==='heading').length,1);
 await r.core.pasteSavedSpecial();held(r,{index:10});assert.deepEqual(r.doc(),stopped);
 wrong=false;await r.core.pasteSavedSpecial();successful(r);assert.deepEqual(selected(r.editor.readRun()),plan);assert.ok(!r.editor.readRun().rows[10].qualitySourceIssue);
});

test('a swapped generated PNG holds before the next heading/profile and a correct regeneration resumes without source requests',async t=>{
 const r=await runtime({count:12});t.after(()=>r.close());r.state.swapFile=true;
 r.editor.patch(`const heldTestMakeFile=makeFile;makeFile=async row=>{const file=await heldTestMakeFile(row);if(row.urlname==='quality_person_0')state.firstGeneratedFile=file;return row.urlname==='quality_person_10'&&state.swapFile?state.firstGeneratedFile:file};`);
 await r.history();const run=held(r,{index:10,kind:'file'}),plan=selected(run),stopped=r.doc(),prefix=clone(r.state.images),requests=r.state.requests.length;
 assert.equal(stopped.content.filter(node=>node.type==='heading').length,1);
 await r.history();held(r,{index:10,kind:'file'});assert.deepEqual(r.doc(),stopped);
 r.state.swapFile=false;await r.history();successful(r);assert.deepEqual(selected(r.editor.readRun()),plan);assert.deepEqual(r.state.images.slice(0,10),prefix);assert.equal(r.state.requests.length,requests);
});

test('a durable file hold remains blocked while OFF after reload, then clears on a fresh matching PNG',async t=>{
 const r=await runtime({count:3});t.after(()=>r.close());
 r.editor.patch(`const reloadTestMakeFile=makeFile;makeFile=async row=>{const file=await reloadTestMakeFile(row);if(row.urlname==='quality_person_0')state.reloadFirstFile=file;return row.urlname==='quality_person_1'?state.reloadFirstFile:file};`);
 await r.history();held(r,{index:1,kind:'file'});const stopped=r.doc(),plan=selected(r.editor.readRun());
 const off=await r.reload({record:false});t.after(()=>off.close());await off.history();held(off,{index:1,kind:'file'});assert.deepEqual(off.doc(),stopped);
 off.local.set('mumei_profile_quality_mode_v1','record');const enabled=await off.reload();t.after(()=>enabled.close());await enabled.history();successful(enabled);assert.deepEqual(selected(enabled.editor.readRun()),plan);assert.equal(enabled.state.requests.length,0,'a file hold is repaired by regeneration without API refetching');
});

for(const disable of ['off','fault','missing','throws'])test('a known checkpoint hold survives '+disable+' and a fresh VM reload',async t=>{
 const r=await runtime({count:4,requestMutator:wrongOwner(2)});t.after(()=>r.close());await r.history();const run=held(r,{index:2}),plan=selected(run),stopped=r.doc();
 if(disable==='off')r.local.set('mumei_profile_quality_mode_v1','off');
 const next=await r.reload();t.after(()=>next.close());
 if(disable==='fault')next.quality.failed();
 if(disable==='missing'){delete next.quality.preflight;delete next.page.__MUMEI_PROFILE_CARD_QUALITY__}
 if(disable==='throws')next.quality.preflight=()=>{throw Error('fixture inspector failure')};
 await next.history();held(next,{index:2});assert.deepEqual(next.doc(),stopped);assert.deepEqual(selected(next.editor.readRun()),plan);
 await next.core.createCardsAtTap();assert.equal(next.state.nativeCardRequests.length,0);assert.deepEqual(next.doc(),stopped);assert.ok(next.editor.readRun().qualityHold);
});

test('an incomplete fresh retry cannot clear a known source hold or relabel it successful',async t=>{
 const r=await runtime({count:3,requestMutator:wrongOwner(1)});t.after(()=>r.close());await r.history();held(r,{index:1});const stopped=r.doc();
 r.state.requestMutator=(url,payload)=>{if(new URL(url).pathname==='/api/v3/notes/n000000000002')delete payload.data.user.urlname;return payload};
 await r.history();held(r,{index:1});assert.deepEqual(r.doc(),stopped);assert.ok(!r.state.statuses.at(-1).text.includes('完了 ✅'));
});

test('native upload failure and pause resume to a later quality hold without duplicating the prefix',async t=>{
 for(const interruption of ['failure','pause']){
  const r=await runtime({count:5,requestMutator:wrongOwner(3)});t.after(()=>r.close());
  if(interruption==='failure')r.state.failAt=2;else r.state.pauseAt=2;
  await r.history();assert.equal(r.state.images.length,interruption==='failure'?1:2);r.state.failAt=0;r.state.pauseAt=0;
  await r.history();held(r,{index:3});assert.equal(new Set(r.editor.readRun().items.map(item=>item.url)).size,3);
  const stopped=r.doc();await r.history();held(r,{index:3});assert.deepEqual(r.doc(),stopped);
 }
});

for(const index of [0,2])test('notification-card preflight stops at row '+index+' before any native conversion or work URL insertion',async t=>{
 const r=await runtime({count:4});t.after(()=>r.close());await r.history();successful(r);const plan=injectCardMismatch(r,index),imageDoc=r.doc();
 await r.core.createCardsAtTap();const run=held(r,{index,phase:'cards',images:5,cards:index}),stopped=r.doc();
 assert.equal(r.state.nativeCardRequests.length,index);assert.deepEqual(r.state.nativeCardRequests,Array.from(run.rows.slice(0,index),row=>row.url));
 assert.ok(!run.pendingCard);assert.ok(!run.cardsCompletedAt);assert.deepEqual(selected(run),plan);
 if(index===0)assert.deepEqual(stopped,imageDoc);
 assert.ok(!stopped.content.some(node=>node.type==='paragraph'&&node.content?.some(part=>part.text===run.rows[index].url)));
 await r.core.createCardsAtTap();held(r,{index,phase:'cards',images:5,cards:index});assert.equal(r.state.nativeCardRequests.length,index);assert.deepEqual(r.doc(),stopped);
});

test('matching manually added native cards cannot reconcile past a durable source hold',async t=>{
 const r=await runtime({count:4});t.after(()=>r.close());await r.history();successful(r);injectCardMismatch(r,2);
 await r.core.createCardsAtTap();const run=held(r,{index:2,phase:'cards',images:5,cards:2}),known=clone(run.qualityHold),tracked=clone(run.cardKeys);
 const existing=[];r.view.state.doc.descendants((node,pos)=>{if(node.type.name==='embed')existing.push({node,pos})});
 assert.equal(existing.length,2);
 const last=existing.at(-1),manual=run.rows.slice(2).map((row,index)=>r.schema.nodes.embed.create({embeddedContentKey:'embmanualquality'+index,src:row.url,htmlForEmbed:'<div class="note-embed"></div>'}));
 r.view.dispatch(r.view.state.tr.insert(last.pos+last.node.nodeSize,manual));
 const urls=[];r.view.state.doc.descendants(node=>{if(node.type.name==='embed')urls.push(node.attrs.src)});
 assert.deepEqual(urls,Array.from(run.rows,row=>row.url),'the document now contains an adoptable full native-card sequence');
 const completedDoc=r.doc(),saves=r.state.saves;
 for(let retry=0;retry<2;retry++){
  await r.core.createCardsAtTap();const retained=held(r,{index:2,phase:'cards',images:5,cards:2});
  assert.deepEqual(clone(retained.qualityHold),known);assert.deepEqual(clone(retained.cardKeys),tracked);assert.ok(!retained.cardsCompletedAt);
  assert.equal(retained.stage,'cards_building');assert.equal(r.state.nativeCardRequests.length,2);assert.equal(r.state.saves,saves);assert.deepEqual(r.doc(),completedDoc);
 }
});

test('repeating a completed card action preflights contradictory evidence in its already-created prefix',async t=>{
 const r=await runtime({count:4});t.after(()=>r.close());await r.history();successful(r);await r.core.createCardsAtTap();
 const completed=r.editor.readRun();assert.equal(completed.stage,'complete');assert.equal(completed.draftSaveState,'confirmed');assert.ok(completed.cardsCompletedAt);
 const plan=injectCardMismatch(r,1);assert.equal(r.editor.readRun().qualityHold??null,null,'new evidence has not yet created a root checkpoint hold');
 const completedDoc=r.doc(),requests=clone(r.state.nativeCardRequests),saves=r.state.saves;
 for(let retry=0;retry<2;retry++){
  await r.core.createCardsAtTap();const retained=held(r,{index:1,phase:'cards',images:5,cards:5});
  assert.equal(retained.stage,'cards_building');assert.ok(!retained.cardsCompletedAt);assert.deepEqual(selected(retained),plan);
  assert.deepEqual(r.state.nativeCardRequests,requests);assert.equal(r.state.saves,saves);assert.deepEqual(r.doc(),completedDoc);
 }
});

test('quality-log storage failure and record eviction cannot release an original checkpoint hold',async t=>{
 const r=await runtime({count:3,requestMutator:wrongOwner(1)});t.after(()=>r.close());r.state.storageFailure=(kind,key)=>kind==='local'&&key.startsWith('mumei_profile_quality_log_v1:');
 await r.history();held(r,{index:1});const stopped=r.doc();
 for(let i=0;i<180;i++)r.quality.acquired({urlname:'other_'+i,key:'n000000000099',url:'https://note.com/other_'+i+'/n/n000000000099'},{target:'other_'+i,note:{key:'n000000000099',user:{urlname:'other_'+i}}});
 r.quality.failed();await r.history();held(r,{index:1});assert.deepEqual(r.doc(),stopped);
 const next=await r.reload();t.after(()=>next.close());next.local.set('mumei_profile_quality_mode_v1','off');await next.history();held(next,{index:1});assert.deepEqual(next.doc(),stopped);
});

test('failure of both checkpoint stores retains an already diagnosed hold in memory',async t=>{
 const r=await runtime({count:3,requestMutator:wrongOwner(1)});t.after(()=>r.close());await r.history();held(r,{index:1});const stopped=r.doc(),plan=selected(r.editor.readRun());
 r.state.storageFailure=()=>true;r.quality.failed();await r.history();held(r,{index:1});assert.deepEqual(r.doc(),stopped);assert.deepEqual(selected(r.editor.readRun()),plan);
 await r.core.createCardsAtTap();assert.equal(r.state.nativeCardRequests.length,0);assert.deepEqual(r.doc(),stopped);assert.ok(r.editor.readRun().qualityHold);
});

test('failed saves preserve a quality hold and cannot turn the retained prefix into completion',async t=>{
 for(const result of [false,Error('fixture draft save failure')]){
  const r=await runtime({count:3,requestMutator:wrongOwner(1)});t.after(()=>r.close());await r.history();held(r,{index:1});const stopped=r.doc();
  if(result instanceof Error)r.state.saveError=result;else r.state.saveResult=result;
  await r.core.saveOnce('held-prefix save').catch(()=>{});await r.history();held(r,{index:1});assert.deepEqual(r.doc(),stopped);
  r.state.saveError=null;r.state.saveResult=true;await r.core.saveOnce('held-prefix save retry');await r.history();held(r,{index:1});assert.deepEqual(r.doc(),stopped);
 }
});

test('a hold is scoped to its draft and batch when counts, people and sources change',async t=>{
 const r=await runtime({count:3,requestMutator:wrongOwner(1)});t.after(()=>r.close());await r.history();held(r,{index:1});const heldBatch=r.quality.snapshot().batchId;
 r.state.requestMutator=null;await r.core.deleteAllGenerated({save:false});r.retarget({draft:null,count:5,prefix:'fresh_batch_',replaceDoc:false});await r.history();successful(r);assert.notEqual(r.quality.snapshot().batchId,heldBatch);
 assert.deepEqual(Array.from(r.editor.readRun().rows.slice(0,5),row=>row.urlname),Array.from({length:5},(_,i)=>'fresh_batch_'+i));
 const secondBatch=r.quality.snapshot().batchId;r.retarget({draft:2,count:1,prefix:'different_writer_'});await r.normal({kind:'mag'});successful(r);assert.notEqual(r.quality.snapshot().batchId,secondBatch);
});

test('legacy rows, missing identity fields and missing optional assets retain the existing fallback output',async t=>{
 const options={count:3,noIconIndex:0,noThumbIndex:1},r=await runtime({...options,requestMutator:(url,payload)=>{const path=new URL(url).pathname;if(path.includes('/api/v3/notes/'))delete payload.data.user.urlname;else if(/^\/api\/v2\/creators\/[^/]+$/.test(path))delete payload.data.creator.urlname;return payload}});t.after(()=>r.close());
 await r.history();successful(r);assert.ok(!r.editor.readRun().qualityHold);
 if(baselineCode()){
  const before=await runtime({record:false,...options});t.after(()=>before.close());await before.history();successful(before);assert.deepEqual(r.doc(),before.doc());assert.deepEqual(r.state.images,before.state.images);
 }
 const legacy=r.editor.readRun();legacy.rows=legacy.rows.map(({qualityRef,qualitySource,...row})=>row);r.editor.writeRun(legacy);
 await r.core.createCardsAtTap();assert.equal(r.editor.readRun().stage,'complete');assert.equal(r.state.nativeCardRequests.length,legacy.rows.length);
});
