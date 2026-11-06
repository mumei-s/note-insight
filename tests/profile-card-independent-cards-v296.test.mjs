import nodeTest from 'node:test';
import assert from 'node:assert/strict';
import {runtime,dependencies} from './fixtures/profile-card-quality-runtime.mjs';
const test=(name,fn)=>nodeTest(name,{skip:!dependencies?'Real PM/canvas dependencies required':false},fn);
const blocks=(r,type)=>{const out=[];r.view.state.doc.forEach((node,pos)=>{if(node.type.name===type)out.push({node,pos})});return out};
const remove=(r,hit)=>r.view.dispatch(r.view.state.tr.delete(hit.pos,hit.pos+hit.node.nodeSize));
function cardsComplete(r,expected){const run=r.editor.readRun();assert.equal(run.stage,'complete',r.state.statuses.at(-1)?.text);assert.equal(run.draftSaveState,'confirmed');assert.equal(blocks(r,'embed').length,expected);assert.deepEqual(Array.from(run.cardKeys,item=>item.url),Array.from(run.rows,row=>row.url));return run}

for(const kind of ['normal','history'])test(kind+' notification cards work after manual image deletion without restoring the image',async t=>{
 const r=await runtime({count:3});t.after(()=>r.close());await(kind==='normal'?r.normal():r.history());
 remove(r,blocks(r,'image')[1]);const images=blocks(r,'image').map(hit=>hit.node.toJSON()),uploads=r.state.images.length,requests=r.state.requests.length;
 await r.core.createCardsAtTap();cardsComplete(r,4);
 assert.equal(r.state.images.length,uploads);assert.equal(r.state.requests.length,requests);assert.deepEqual(blocks(r,'image').map(hit=>hit.node.toJSON()),images);
 const converted=r.state.nativeCardRequests.length;await r.core.createCardsAtTap();assert.equal(r.state.nativeCardRequests.length,converted);
 await r.core.deleteNotificationCards({confirm:false,save:false});assert.equal(blocks(r,'embed').length,0);assert.deepEqual(blocks(r,'image').map(hit=>hit.node.toJSON()),images);
});

test('the reported 223/224 image case creates all saved notification cards',async t=>{
 const r=await runtime({count:223,render:false});t.after(()=>r.close());await r.normal();assert.equal(blocks(r,'image').length,224);
 remove(r,blocks(r,'image')[100]);await r.core.createCardsAtTap();cardsComplete(r,224);assert.equal(blocks(r,'image').length,223);assert.equal(r.state.images.length,224);
});

for(const stage of ['images_building','images_ready'])test('saved article plan permits notification cards with zero visible images at '+stage,async t=>{
 const r=await runtime({count:2});t.after(()=>r.close());r.state.failAt=1;await r.normal();const run=r.editor.readRun();assert.equal(blocks(r,'image').length,0);assert.equal(run.rows.length,3);
 r.editor.writeRun({...run,stage});const uploads=r.state.images.length;await r.core.createCardsAtTap();cardsComplete(r,3);assert.equal(r.state.images.length,uploads);assert.equal(blocks(r,'image').length,0);
});

test('known wrong-author holds still block notification cards before conversion',async t=>{
 const r=await runtime({count:2,requestMutator:(url,payload)=>{if(url.includes('/api/v3/notes/n000000000001'))payload.data.user.urlname='wrong_person';return payload}});t.after(()=>r.close());await r.normal();assert.ok(r.editor.readRun().qualityHold);
 await r.core.createCardsAtTap();assert.equal(r.state.nativeCardRequests.length,0);assert.equal(blocks(r,'embed').length,0);assert.ok(r.editor.readRun().qualityHold);
});

test('image-independent notification pause and resume convert only the remaining saved URLs',async t=>{
 const r=await runtime({count:4});t.after(()=>r.close());await r.normal();remove(r,blocks(r,'image')[2]);
 r.core.patch('const independentCardOriginal=createNativeCard;createNativeCard=async function(...args){const result=await independentCardOriginal(...args);if(state.cards.length===2)pauseCards();return result};');
 await r.core.createCardsAtTap();assert.equal(r.editor.readRun().paused,true);assert.equal(blocks(r,'embed').length,2);
 await r.core.createCardsAtTap();cardsComplete(r,5);assert.equal(r.state.nativeCardRequests.length,5);assert.equal(new Set(r.state.nativeCardRequests).size,5);
});

test('a different draft plan cannot use the relaxed image-count gate',async t=>{
 const r=await runtime({count:2});t.after(()=>r.close());await r.normal();r.editor.writeRun({...r.editor.readRun(),articleKey:'nffffffffffff'});
 const doc=r.doc();await r.core.createCardsAtTap();assert.deepEqual(r.doc(),doc);assert.equal(r.state.nativeCardRequests.length,0);assert.equal(r.state.statuses.at(-1).bad,true);
});
