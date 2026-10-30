import nodeTest from 'node:test';
import assert from 'node:assert/strict';
import {runtime,dependencies,baselineCode} from './fixtures/profile-card-quality-runtime.mjs';
const test=(name,fn)=>nodeTest(name,{skip:!dependencies||!baselineCode()?'Real PM/canvas dependencies and the recorded baseline are required':false},fn);
const recordClone=value=>JSON.parse(JSON.stringify(value));
function successful(r,run){assert.equal(run?.stage,'images_ready',r.state.statuses.at(-1)?.text);assert.equal(run.rows.length,r.state.images.length);assert.equal(run.draftSaveState,'confirmed')}

for(const count of [3,200])test('quality ON/OFF preserves current pixels, paragraphs, links, captions, order and pacing for '+count+' people',async()=>{
 const before=await runtime({record:false,count,reverse:true}),after=await runtime({count,reverse:true});
 const a=await before.history(),b=await after.history();successful(before,a);successful(after,b);
 assert.deepEqual(after.doc(),before.doc());assert.deepEqual(after.state.images,before.state.images);assert.deepEqual(after.state.waits,before.state.waits);assert.deepEqual(after.state.requests,before.state.requests);
 assert.equal(b.rows.length,count+1);assert.equal(new Set(b.rows.slice(0,count).map(r=>r.urlname)).size,count);assert.equal(new Set(b.rows.slice(0,count).map(r=>r.designIndex)).size,count);
 assert.deepEqual(Array.from(b.rows.slice(0,count),r=>r.urlname),Array.from({length:count},(_,i)=>'quality_person_'+i));
 assert.ok(after.quality.snapshot().records.some(rec=>rec.stage==='貼付後'));
 assert.ok(after.quality.snapshot().records.some(rec=>rec.stage==='下書き保存'&&rec.findings[0].status==='confirmed'));
 assert.ok(after.local.has('mumei_profile_quality_log_v1:naaaaaaaaaaaa'),'the existing exported draft-save path flushes the independent evidence log');
 assert.ok(!after.quality.snapshot().records.some(rec=>rec.findings.some(f=>f.status==='mismatch')));
 before.close();after.close();
});
for(const kind of ['tag','mag','note'])for(const choice of ['latest','fixed','oldest'])test('normal '+kind+' / '+choice+' keeps the selected output and requests independent of quality ON/OFF',async()=>{
 const before=await runtime({record:false}),after=await runtime();const a=await before.normal({kind,choice}),b=await after.normal({kind,choice});successful(before,a);successful(after,b);
 assert.deepEqual(after.doc(),before.doc());assert.deepEqual(after.state.images,before.state.images);assert.deepEqual(after.state.requests,before.state.requests);assert.deepEqual(after.state.waits,before.state.waits);before.close();after.close();
});
test('all-count mode retains the same source exhaustion and final article',async()=>{
 const before=await runtime({record:false}),after=await runtime();successful(before,await before.normal({mode:'all'}));successful(after,await after.normal({mode:'all'}));assert.deepEqual(after.doc(),before.doc());before.close();after.close();
});
for(const flow of ['special','workmom','parenting'])test('the '+flow+' mode retains its existing selection, output, counts and pacing',async()=>{
 const before=await runtime({record:false}),after=await runtime();successful(before,await before.normal({flow}));successful(after,await after.normal({flow}));assert.deepEqual(after.doc(),before.doc());assert.deepEqual(after.state.images,before.state.images);assert.deepEqual(after.state.requests,before.state.requests);assert.deepEqual(after.state.waits,before.state.waits);before.close();after.close();
});
test('126-person gallery preserves all pixels, the profile-only participant, missing icon and verified missing thumbnail',async()=>{
 const args={count:126,noArticleIndex:87,noIconIndex:5,noThumbIndex:6},before=await runtime({record:false,...args}),after=await runtime(args);
 const a=await before.gallery(),b=await after.gallery();successful(before,a);successful(after,b);assert.equal(b.rows.length,127);assert.equal(b.rows[87].profileOnly,true);assert.equal(b.rows[5].avatarMissing,true);assert.equal(b.rows[6].articleThumbnailMissing,true);
 assert.deepEqual(after.doc(),before.doc());assert.deepEqual(after.state.images,before.state.images);assert.deepEqual(after.state.requests,before.state.requests);assert.deepEqual(after.state.waits,before.state.waits);assert.ok(!after.quality.snapshot().records.some(rec=>rec.findings.some(f=>f.status==='mismatch')));before.close();after.close();
});
test('reverse completion does occur, but acquisition still binds each raw profile/article to the requested person',async()=>{
 const r=await runtime({count:6,reverse:true});const run=await r.history();successful(r,run);
 assert.notDeepEqual(r.state.returned.slice(0,12),r.state.requests.slice(0,12),'fixture must exercise actual reordering');
 for(const row of run.rows.slice(0,6)){const source=r.quality.provenance(row);assert.equal(source.target,row.urlname);assert.equal(source.profile.account,row.urlname);assert.ok(source.articles.every(a=>a.account===row.urlname));assert.ok(!row.qualitySource)}r.close();
});
test('a mixed raw profile/article is held before writes, while an observer exception preserves the generated File',async()=>{
 const r=await runtime();r.c.requestWrong=async url=>{const payload=await r.c.requestJSON(url);if(url.includes('/api/v3/notes/'))payload.data.user.urlname='different_person';return payload};r.editor.patch('xhrJSON=requestWrong');
 const run=await r.history();assert.equal(run.stage,'images_building');assert.ok(run.qualityHold);assert.equal(r.state.images.length,0);assert.ok(r.quality.snapshot().records.some(rec=>rec.findings.some(f=>f.status==='mismatch'&&f.check==='対象と投稿者')));
 const old=r.quality.generated;r.quality.generated=()=>{throw Error('fault injected')};const output=await r.editor.makeFile(run.rows[0]);assert.equal(output.type,'image/png');assert.ok(r.quality.snapshot().fault);r.quality.generated=old;r.close();
});
test('pause/resume, failed native upload retry, and save failure match the baseline without duplication or false completion',async()=>{
 for(const baseline of [true,false]){
  const r=await runtime({baseline,count:4});r.state.failAt=3;await r.history();assert.equal(r.state.images.length,2);assert.equal(r.editor.readRun().stage,'images_building');r.state.failAt=0;
  r.state.pauseAt=3;await r.history();assert.equal(r.state.images.length,3);assert.equal(r.editor.readRun().paused,true);assert.equal(r.editor.readRun().pauseStage,'images');
  r.state.pauseAt=0;await r.history();assert.equal(r.state.images.length,5);assert.equal(new Set(r.editor.readRun().items.map(item=>item.url)).size,5);
  const done=r.doc();await r.history();assert.deepEqual(r.doc(),done);r.close();
  const saved=await runtime({baseline,count:2});saved.state.saveResult=false;await saved.history();assert.equal(saved.editor.readRun().draftSaveState,'pending');assert.equal(saved.state.images.length,3);saved.state.saveResult=true;await saved.history();assert.equal(saved.state.images.length,3);assert.equal(saved.editor.readRun().draftSaveState,'confirmed');saved.close();
 }
});
test('notification insertion at body tap and deletion preserve baseline nonowned content, links and quality-independent checkpoints',async()=>{
 const results=[];
 for(const record of [false,true]){
  const r=await runtime({record,count:3});successful(r,await r.history());
  const original=r.doc();await r.core.createCardsAtTap();assert.equal(r.state.cards.length,4,r.state.statuses.at(-1)?.text);assert.equal(r.editor.readRun().stage,'complete');
  await r.core.deleteNotificationCards({confirm:false,save:false});assert.deepEqual(r.doc(),original);assert.equal(r.editor.readRun().items.length,4);
  results.push(r.doc());r.close();
 }
 assert.deepEqual(results[0],results[1]);
});
test('disabling quality leaves acquired rows, caches and completion history intact and reproduces baseline output',async()=>{
 const before=await runtime({record:true}),after=await runtime({record:false});successful(before,await before.history());successful(after,await after.history());assert.deepEqual(after.doc(),before.doc());assert.equal(after.quality.snapshot().records.length,0);assert.ok(after.editor.readRun().items.length);before.close();after.close();
});
test('the previous version can continue a current partial checkpoint while preserving its owned prefix and original identities',async()=>{
 const current=await runtime({count:4});current.state.failAt=3;await current.history();assert.equal(current.state.images.length,2);
 const previous=await runtime({baseline:true,count:4});
 previous.view.state=dependencies.EditorState.create({schema:previous.schema,doc:previous.schema.nodeFromJSON(current.doc())});
 previous.editor.writeRun(recordClone(current.editor.readRun()));previous.state.serial=current.state.serial;previous.state.images.push(...recordClone(current.state.images));
 await previous.history();successful(previous,previous.editor.readRun());assert.equal(previous.editor.readRun().items.length,5);assert.equal(new Set(previous.editor.readRun().items.map(item=>item.url)).size,5);
 assert.deepEqual(previous.doc().content.filter(node=>node.type==='image').slice(0,2),current.doc().content.filter(node=>node.type==='image'));
 assert.deepEqual(Array.from(previous.editor.readRun().rows,row=>row.url),Array.from(current.editor.readRun().rows,row=>row.url));current.close();previous.close();
});
test('changing counts, people and source modes on successive drafts runs fresh checks for every pasted row',async()=>{
 const r=await runtime({count:2});let run=await r.history();successful(r,run);let previousBatch=r.quality.snapshot().batchId;
 for(const [draft,count,prefix,kind] of [[2,7,'different_writer_','tag'],[3,1,'new_account_','mag'],[4,4,'next_people_','history']]){
  const oldDoc=r.view.state.doc,oldJson=r.doc();r.retarget({draft,count,prefix});
  run=kind==='history'?await r.history():await r.normal({kind});successful(r,run);
  assert.deepEqual(Array.from(run.rows.slice(0,count),row=>row.urlname),Array.from({length:count},(_,i)=>prefix+i));
  const snapshot=r.quality.snapshot(),current=snapshot.records.filter(record=>record.batchId===snapshot.batchId);
  assert.notEqual(snapshot.batchId,previousBatch);previousBatch=snapshot.batchId;
  assert.equal(current.filter(record=>record.stage==='貼付後').length,count+1);
  assert.equal(snapshot.counts.mismatch||0,0);assert.ok(current.every(record=>!record.target||record.target==='fuku444'||record.target.startsWith(prefix)));
  assert.deepEqual(recordClone(oldDoc.toJSON()),oldJson,'navigating the test fixture cannot change the prior draft');
 }
 r.close();
});
test('a new batch in the same draft gets its own verdicts; resume retains that batch and previous evidence remains separate',async()=>{
 const r=await runtime({count:2});successful(r,await r.history());const first=r.quality.snapshot().batchId;
 r.quality.acquired({urlname:'previous_target',key:'n000000000001',url:'https://note.com/previous_target/n/n000000000001',creator:'以前の人'},{target:'previous_target',note:{key:'n000000000001',user:{urlname:'wrong_previous_owner'}}});
 assert.ok(r.quality.snapshot().counts.mismatch);
 await r.core.deleteAllGenerated({save:false});
 r.retarget({draft:null,count:5,prefix:'fresh_batch_',replaceDoc:false});successful(r,await r.history());
 const next=r.quality.snapshot();assert.notEqual(next.batchId,first);assert.equal(next.counts.mismatch||0,0);assert.ok(next.records.some(record=>record.batchId===first&&record.findings.some(f=>f.status==='mismatch')));
 await r.history();assert.equal(r.quality.snapshot().batchId,next.batchId);assert.equal(r.state.images.length,6);
 r.close();
});
