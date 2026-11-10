import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runtime,dependencies} from './fixtures/profile-card-quality-runtime.mjs';

const compiled=(name,fn)=>test(name,{skip:!dependencies?'Real PM/canvas dependencies required':false},fn);
const blocks=(r,type)=>{const out=[];r.view.state.doc.forEach((node,pos)=>{if(node.type.name===type)out.push({node,pos})});return out};
function displacedNearest(r,{json=true,invalidJSON=false}={}){
 r.core.patch(`selectionApi=()=>({near:resolved=>Selection.near(resolved.doc.resolve(1)),fromJSON:${json?invalidJSON?'doc=>Selection.near(doc.resolve(1))':'(doc,value)=>Selection.fromJSON(doc,value)':'undefined'}});`);
}
function complete(r,count){
 const run=r.editor.readRun();assert.equal(run.stage,'complete',r.state.statuses.at(-1)?.text);
 assert.equal(blocks(r,'embed').length,count);assert.equal(new Set(r.state.nativeCardRequests).size,count);
 assert.deepEqual(Array.from(run.cardKeys,item=>item.url),Array.from(run.rows,row=>row.url));
}
const original=readFileSync('public/note-profile-card-paster-core-v232.js','utf8');
const start=original.indexOf('function insertWorkUrlAt('),end=original.indexOf('\nasync function waitNewCard(',start);
const legacyInsert=original.slice(start,end);

compiled('reproduces the reported cursor error before any native card request with the old nearest-selection code',async()=>{
 const r=await runtime({count:2});
 try{
  await r.normal();const before=r.doc();
  r.core.patch('insertWorkUrlAt='+legacyInsert+';');displacedNearest(r);
  await r.core.createCardsAtTap();
  assert.match(r.state.statuses.at(-1).text,/通知カード用URLのカーソル位置を確認できません/);
  assert.equal(r.state.nativeCardRequests.length,0);assert.equal(r.editor.readRun().pendingCard,null);assert.deepEqual(r.doc(),before);
 }finally{r.close()}
});

for(const flow of ['normal','history'])compiled(flow+' exact text selection converts all cards despite nearest cursor relocation',async()=>{
 const r=await runtime({count:3});
 try{
  await r[flow]();const images=blocks(r,'image').map(hit=>hit.node.toJSON()),uploads=r.state.images.length;
  displacedNearest(r);await r.core.createCardsAtTap();complete(r,4);
  assert.equal(r.state.images.length,uploads);assert.deepEqual(blocks(r,'image').map(hit=>hit.node.toJSON()),images);
  assert.ok(r.view.state.doc.textContent.includes('元の文章です。'));
  const requests=r.state.nativeCardRequests.length;await r.core.createCardsAtTap();assert.equal(r.state.nativeCardRequests.length,requests);
 }finally{r.close()}
});

compiled('mobile focus restoring a prior cursor is corrected before native conversion',async()=>{
 const r=await runtime({count:2});
 try{
  await r.normal();displacedNearest(r);
  r.view.focus=()=>r.view.dispatch(r.view.state.tr.setSelection(dependencies.TextSelection.create(r.view.state.doc,1)));
  await r.core.createCardsAtTap();complete(r,3);
 }finally{r.close()}
});

compiled('a block-selection subclass uses the base text-selection registry rather than its own fromJSON',async()=>{
 const r=await runtime({count:2});
 try{
  await r.normal();
  r.state.cursorType=class BlockCursor extends dependencies.Selection{
   static fromJSON(doc){return dependencies.TextSelection.create(doc,1)}
   static near(resolved){return dependencies.Selection.near(resolved.doc.resolve(1))}
  };
  r.core.patch('selectionApi=()=>state.cursorType;');
  await r.core.createCardsAtTap();complete(r,3);
 }finally{r.close()}
});

compiled('an editor without fromJSON retains the verified exact nearest-selection fallback',async()=>{
 const r=await runtime({count:2});
 try{
  await r.normal();r.core.patch('selectionApi=()=>({near:(...args)=>Selection.near(...args)});');
  await r.core.createCardsAtTap();complete(r,3);
 }finally{r.close()}
});

compiled('unverifiable selection still stops before changing the draft or sending a card',async()=>{
 const r=await runtime({count:2});
 try{
  await r.normal();const before=r.doc();displacedNearest(r,{invalidJSON:true});
  await r.core.createCardsAtTap();assert.equal(r.state.nativeCardRequests.length,0);assert.deepEqual(r.doc(),before);
  assert.equal(r.editor.readRun().pendingCard,null);
 }finally{r.close()}
});

compiled('notification cards stay at the tapped middle of body text',async()=>{
 const r=await runtime({count:2});
 try{
  await r.normal();const text='元の文章です。',offset=3;
  r.view.dispatch(r.view.state.tr.setSelection(dependencies.TextSelection.create(r.view.state.doc,1+offset)));
  displacedNearest(r);await r.core.createCardsAtTap();complete(r,3);
  const paragraphs=blocks(r,'paragraph'),cards=blocks(r,'embed');
  assert.equal(paragraphs[0].node.textContent,text.slice(0,offset));
  assert.ok(paragraphs[0].pos<cards[0].pos);
  assert.ok(paragraphs.some(hit=>hit.pos>cards.at(-1).pos&&hit.node.textContent===text.slice(offset)));
 }finally{r.close()}
});

compiled('a failed cursor attempt can retry notification cards without restarting images',async()=>{
 const r=await runtime({count:2});
 try{
  await r.normal();const uploads=r.state.images.length;
  displacedNearest(r,{invalidJSON:true});await r.core.createCardsAtTap();assert.equal(r.state.nativeCardRequests.length,0);
  displacedNearest(r);await r.core.createCardsAtTap();complete(r,3);assert.equal(r.state.images.length,uploads);
 }finally{r.close()}
});
