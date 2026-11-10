import test from 'node:test';
import assert from 'node:assert/strict';
import {runtime,dependencies} from './fixtures/profile-card-quality-runtime.mjs';

const compiled=(name,fn)=>test(name,{skip:!dependencies?'PM and canvas are required':false},fn);
const unavailable=row=>({...row,presentation:{...row.presentation,status:'unavailable',text:'無料公開本文を取得できません'}});
const imageNodes=r=>{const nodes=[];r.view.state.doc.descendants(node=>{if(node.type.name==='image')nodes.push(node)});return nodes};
const cardNodes=r=>{const nodes=[];r.view.state.doc.descendants(node=>{if(node.type.name==='embed')nodes.push(node)});return nodes};
const resume=async(r,flow)=>{await(flow==='normal'?r.core.pasteSavedSpecial():r.editor.createFixed300());return r.editor.readRun()};

for(const flow of ['normal','history'])for(const size of ['thin','medium'])compiled(flow+' '+size+' resume repairs already completed legacy error images',async()=>{
 const r=await runtime({count:3,localStorageMap:new Map([['mumei_profile_card_presentation_v292',JSON.stringify({size,content:'summary'})]])});
 let fresh;
 try{
  const previous=await r[flow](),oldIds=new Set(previous.items.map(item=>item.id));
  r.editor.writeRun({...previous,version:'2.9.7',rows:previous.rows.map(unavailable)});
  fresh=await r.reload();
  const run=await resume(fresh,flow);
  assert.equal(run.stage,'images_ready',fresh.state.statuses.at(-1)?.text);
  assert.ok(run.rows.every(row=>row.presentation.status==='available'));
  assert.equal(imageNodes(fresh).length,4);assert.equal(run.items.length,4);
  assert.ok(run.items.every(item=>!oldIds.has(item.id)));
  assert.ok(fresh.view.state.doc.textContent.includes('元の文章です。'));
  assert.ok(!fresh.view.state.doc.textContent.includes('無料公開本文を取得できません'));
  assert.equal(new Set(run.items.map(item=>item.url)).size,4);
  const uploads=fresh.state.images.length;await resume(fresh,flow);
  assert.equal(fresh.state.images.length,uploads,'a second resume must not upload again');
 }finally{fresh?.close();r.close()}
});

for(const flow of ['normal','history'])compiled(flow+' retains the successful prefix, user text and existing matching cards',async()=>{
 const r=await runtime({count:3,localStorageMap:new Map([['mumei_profile_card_presentation_v292',JSON.stringify({size:'medium',content:'summary'})]])});
 try{
  await r[flow]();await r.core.createCardsAtTap();
  const previous=r.editor.readRun(),first=previous.items[0],cards=cardNodes(r).map(node=>node.toJSON());
  r.view.dispatch(r.view.state.tr.insert(r.view.state.doc.content.size,r.para('手書きで追加した文章')));
  r.editor.writeRun({...previous,version:'2.9.8',rows:previous.rows.map((row,index)=>index===1?unavailable(row):row)});
  const run=await resume(r,flow);
  assert.equal(run.stage,'images_ready',r.state.statuses.at(-1)?.text);
  assert.deepEqual(run.items[0],first);assert.equal(imageNodes(r).length,4);
  assert.deepEqual(cardNodes(r).map(node=>node.toJSON()),cards);
  assert.ok(r.view.state.doc.textContent.includes('元の文章です。'));
  assert.ok(r.view.state.doc.textContent.includes('手書きで追加した文章'));
  await r.core.createCardsAtTap();assert.equal(cardNodes(r).length,4);assert.equal(r.editor.readRun().stage,'complete',r.state.statuses.at(-1)?.text);
 }finally{r.close()}
});

function fallback({none=false}={}){
 let alternate;
 return(url,payload)=>{
  const path=new URL(url).pathname;
  if(path.endsWith('/creators/quality_person_1/contents')&&!none){
   alternate={...payload.data.contents[0],key:'n000000100001',noteUrl:'https://note.com/quality_person_1/n/n000000100001',name:'別の記事',price:0,body:'<p>別の記事の無料本文です。</p>',eyecatch_url:'https://assets.st-note.com/alternate.png',eyecatch:{url:'https://assets.st-note.com/alternate.png'}};
   payload.data.contents.push(alternate);
  }
  if(path.endsWith('/notes/n000000000002'))Object.assign(payload.data,{body:'',description:'',price:0});
  if(path.endsWith('/notes/n000000100001'))payload.data={...alternate};
  return payload;
 };
}
for(const flow of ['normal','history'])for(const none of [false,true])compiled(flow+' repairs completed unavailable article by '+(none?'skipping':'switching')+' and keeps cards consistent',async()=>{
 const r=await runtime({count:3,localStorageMap:new Map([['mumei_profile_card_presentation_v292',JSON.stringify({size:'medium',content:'summary'})]])});
 try{
  await r[flow]();await r.core.createCardsAtTap();
  const previous=r.editor.readRun();
  r.editor.writeRun({...previous,rows:previous.rows.map((row,index)=>index===1?unavailable(row):row)});
  r.state.requestMutator=fallback({none});
  const run=await resume(r,flow);
  assert.equal(run.stage,'images_ready',r.state.statuses.at(-1)?.text);
  assert.ok(run.rows.every(row=>row.presentation.status==='available'));
  assert.equal(run.rows.length,none?3:4);assert.equal(imageNodes(r).length,run.rows.length);
  if(none)assert.ok(run.rows.every(row=>row.urlname!=='quality_person_1'));
  else{assert.equal(run.rows[1].key,'n000000100001');assert.equal(run.rows[1].thumbUrl,'https://assets.st-note.com/alternate.png');assert.equal(run.rows[1].presentation.text,'別の記事の無料本文です。')}
  assert.deepEqual(imageNodes(r).map(node=>node.attrs.link),Array.from(run.rows,row=>row.url));
  await r.core.createCardsAtTap();
  assert.equal(r.editor.readRun().stage,'complete',r.state.statuses.at(-1)?.text);
  assert.deepEqual(cardNodes(r).map(node=>node.attrs.src),Array.from(run.rows,row=>row.url));
  assert.ok(r.view.state.doc.textContent.includes('元の文章です。'));
 }finally{r.close()}
});

compiled('legacy failure text is refreshed even if the saved status incorrectly says available',async()=>{
 const r=await runtime({count:2,localStorageMap:new Map([['mumei_profile_card_presentation_v292',JSON.stringify({size:'medium',content:'summary'})]])});
 try{
  const previous=await r.normal();r.editor.writeRun({...previous,rows:previous.rows.map((row,index)=>index===0?{...unavailable(row),presentation:{...unavailable(row).presentation,status:'available'}}:row)});
  const run=await resume(r,'normal');assert.equal(run.stage,'images_ready');
  assert.ok(run.rows.every(row=>!row.presentation.text.includes('無料公開本文を取得できません')));
 }finally{r.close()}
});

for(const flow of ['normal','history'])compiled(flow+' repair can pause, reload and resume without duplicating images',async()=>{
 const r=await runtime({count:3,localStorageMap:new Map([['mumei_profile_card_presentation_v292',JSON.stringify({size:'medium',content:'summary'})]])});let fresh;
 try{
  const previous=await r[flow]();r.editor.writeRun({...previous,rows:previous.rows.map((row,index)=>index===1?unavailable(row):row)});
  r.state.pauseAt=r.state.serial+1;await resume(r,flow);
  const paused=r.editor.readRun();assert.equal(paused.paused,true);assert.equal(paused.items.length,2);
  fresh=await r.reload();fresh.state.pauseAt=0;const run=await resume(fresh,flow);
  assert.equal(run.stage,'images_ready',fresh.state.statuses.at(-1)?.text);assert.equal(imageNodes(fresh).length,4);assert.equal(run.items.length,4);
  assert.equal(run.items[0].id,previous.items[0].id);assert.equal(new Set(run.items.map(item=>item.id)).size,4);
 }finally{fresh?.close();r.close()}
});

compiled('contradictory fresh article identity holds before deleting any completed image',async()=>{
 const r=await runtime({count:2,localStorageMap:new Map([['mumei_profile_card_presentation_v292',JSON.stringify({size:'medium',content:'summary'})]])});
 try{
  const previous=await r.normal();r.editor.writeRun({...previous,rows:previous.rows.map((row,index)=>index===0?unavailable(row):row)});
  const before=r.doc();r.state.requestMutator=(url,payload)=>{if(new URL(url).pathname.endsWith('/notes/n000000000001'))payload.data.user.urlname='different_account';return payload};
  await resume(r,'normal');assert.ok(r.editor.readRun().qualityHold);assert.deepEqual(r.doc(),before);assert.equal(imageNodes(r).length,3);
 }finally{r.close()}
});
