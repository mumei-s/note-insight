import nodeTest from 'node:test';
import assert from 'node:assert/strict';
import {runtime,dependencies} from './fixtures/profile-card-quality-runtime.mjs';

const test=(name,fn)=>nodeTest(name,{skip:!dependencies?'Real PM/canvas dependencies are required':false},fn);
const range=(start,end)=>Array.from({length:end-start},(_,index)=>start+index);
const ids=run=>Array.from(run.rows,row=>row.urlname);
function complete(r,people){
 const run=r.editor.readRun();assert.equal(run?.stage,'images_ready',r.state.statuses.at(-1)?.text);assert.equal(run.qualityHold??null,null);assert.equal(run.draftSaveState,'confirmed');
 assert.deepEqual(ids(run),[...people.map(index=>typeof index==='number'?'quality_person_'+index:index),'fuku444']);
 assert.equal(run.rows.filter(row=>row.finalMarker).length,1);assert.equal(run.rows.at(-1).key,'nb4f6934381e9');assert.equal(r.state.images.length,people.length+1);
 assert.equal(new Set(run.items.map(item=>item.url)).size,people.length+1);return run;
}

test('generic tags traverse actual cursor pages and deduplicate repeated creators without moving the final math row',async t=>{
 const values=[...range(0,20),7,...range(20,40),2,...range(40,47)],r=await runtime({count:47,render:false,sourceFixtures:{tags:{fixture:values}}});t.after(()=>r.close());
 await r.normal();complete(r,range(0,47));assert.equal(r.state.apiStats.byKind.search,3);
 assert.deepEqual(r.state.requests.filter(url=>new URL(url).pathname.endsWith('/searches')).map(url=>new URL(url).searchParams.get('start')),['0','20','40']);
 assert.equal(r.quality.snapshot().counts.mismatch||0,0);
});

test('composite tags, magazine and article likes preserve first-seen order across exhausted and overlapping sources',async t=>{
 const sourceFixtures={tags:{alpha:[0,1,2,'fuku444',2],beta:[1,4,5,6]},magazines:{mfixture:[2,3,4]},likes:{n000000000099:[6,7,8,9,10,11]}};
 const r=await runtime({count:12,render:false,sourceFixtures,searchPageSize:3});t.after(()=>r.close());
 await r.normal({sources:'#alpha #alpha\nhttps://note.com/fixture/m/mfixture, #beta\nhttps://note.com/fixture/n/n000000000099'});complete(r,range(0,12));
 assert.equal(r.state.apiStats.byKind.search,4);assert.equal(r.state.apiStats.byKind.magazine,1);assert.equal(r.state.apiStats.byKind.likes,1);assert.ok(r.state.apiStats.byKind.creatorContents>=5);
 assert.equal(r.state.requests.filter(url=>new URL(url).pathname==='/api/v3/notes/nb4f6934381e9').length,1,'the final math participant is enriched exactly once');
});

test('full-width tags and hashtag URLs retain token order and repeated magazine identities are read once',async t=>{
 const r=await runtime({count:3,render:false,sourceFixtures:{tags:{alpha:[0],beta:[1]},magazines:{mfixture:[2]}}});t.after(()=>r.close());
 await r.normal({sources:'＃alpha, https://note.com/hashtag/beta #alpha\nhttps://note.com/fixture/m/mfixture?first=1 https://note.com/fixture/m/mfixture?second=2'});complete(r,[0,1,2]);
 assert.equal(r.state.apiStats.byKind.search,2);assert.equal(r.state.apiStats.byKind.magazine,1);
});

for(const choice of ['latest','fixed','oldest','pinned'])test('generic tag selection keeps '+choice+' inside actual assigned-tag articles',async t=>{
 const r=await runtime({count:3,render:false,sourceFixtures:{tags:{fixture:range(0,6)}}});t.after(()=>r.close());const articles=new Map();
 const article=(personIndex,variant)=>{
  const id='quality_person_'+personIndex,key='n'+(1000+personIndex*3+variant).toString(16).padStart(12,'0');
  const row={...r.note(id),key,noteUrl:'https://note.com/'+id+'/n/'+key,name:['最新','固定','最古'][variant]+'の記事 '+personIndex,publishAt:variant===2?'2020-01-01T00:00:00Z':'2026-01-01T00:00:00Z',...(variant===1&&personIndex!==0?{isPinned:true}:{})};articles.set(key,row);return row;
 };
 for(let person=0;person<6;person++)for(let variant=0;variant<3;variant++)article(person,variant);
 r.state.requestMutator=(url,payload)=>{
  const u=new URL(url),creator=u.pathname.match(/^\/api\/v2\/creators\/quality_person_(\d+)\/contents$/),key=u.pathname.match(/^\/api\/v3\/notes\/(n[a-f0-9]{12})$/)?.[1];
  if(creator){const person=Number(creator[1]),fixed=u.searchParams.get('disabled_pinned')==='false',page=Number(u.searchParams.get('page'))||1;return{data:{contents:fixed?[article(person,0),article(person,1)]:[article(person,page===1?0:2)],totalCount:2,isLastPage:fixed||page===2}}}
  return key&&articles.has(key)?{data:articles.get(key)}:payload;
 };
 await r.normal({choice});const expected=choice==='pinned'?[1,2,3]:[0,1,2],run=complete(r,expected);
 for(const row of run.rows.slice(0,-1)){const person=Number(row.urlname.split('_').at(-1)),pinned=choice==='pinned'||choice==='fixed'&&person!==0,expected=pinned?article(person,1):r.note(row.urlname);assert.equal(row.key,expected.key);assert.equal(row.title,expected.name);assert.equal(row.sourceScope.kind,'tag');assert.equal(row.sourceScope.tag,'fixture')}
 if(choice==='pinned'){assert.equal(run.sourceSelection.unavailable,1);assert.ok(run.sourceSelection.issues.some(issue=>issue.account==='quality_person_0'&&issue.reason.includes('固定')))}
});

test('compiled history design allocation stays unique beyond 200 and preserves every saved choice',async t=>{
 const r=await runtime();t.after(()=>r.close());const rows=range(0,601).map(index=>({index:index+1,urlname:'pattern_person_'+index,key:'n'+(index+1).toString(16).padStart(12,'0'),finalMarker:index===600})),assigned=r.editor.assignDesigns(rows);
 assert.equal(new Set(Array.from(assigned,row=>row.designIndex)).size,601);assert.ok(assigned.every(row=>Number.isSafeInteger(row.designIndex)&&row.designIndex>=0));assert.ok(assigned.some(row=>row.designIndex>=600));
 const saved=Array.from(assigned,row=>row.designIndex),resumed=r.editor.assignDesigns(assigned);assert.deepEqual(Array.from(resumed,row=>row.designIndex),saved);
});

test('actual asset replacement beyond 200 preserves the owned prefix and every remaining saved pattern',async t=>{
 const r=await runtime({count:230});t.after(()=>r.close());r.state.pauseAt=220;await r.history();
 const paused=r.editor.readRun();assert.equal(paused.paused,true);assert.equal(r.state.images.length,220);
 const plan=JSON.parse(JSON.stringify(paused.rows)),prefixImages=JSON.parse(JSON.stringify(r.state.images)),prefixItems=JSON.parse(JSON.stringify(paused.items)),savedDesigns=new Map(plan.map(row=>[row.urlname,row.designIndex]));
 assert.ok(plan.some(row=>row.designIndex>=200));r.state.pauseAt=0;
 r.editor.patch(`const replacementTestBitmap=bitmapFromUrl;bitmapFromUrl=async url=>{if(!state.failedExtendedAsset&&String(url).includes('iconquality_person_220.png')){state.failedExtendedAsset=true;return null}return replacementTestBitmap(url)};`);
 await r.history();const run=complete(r,[...range(0,220),...range(221,231)]);
 assert.equal(r.state.failedExtendedAsset,true);assert.deepEqual(r.state.images.slice(0,220),prefixImages);assert.deepEqual(JSON.parse(JSON.stringify(run.items.slice(0,220))),prefixItems);
 assert.deepEqual(Array.from(run.rows.slice(0,220),row=>row.urlname),plan.slice(0,220).map(row=>row.urlname));
 for(const row of run.rows)if(savedDesigns.has(row.urlname))assert.equal(row.designIndex,savedDesigns.get(row.urlname),'asset replacement must retain the saved pattern for '+row.urlname);
 assert.equal(new Set(Array.from(run.rows,row=>row.designIndex)).size,231);assert.equal(new Set(r.state.images.map(image=>image.png)).size,231);
 assert.equal(run.imageSkipped.length,1);assert.equal(run.imageSkipped[0].urlname,'quality_person_220');assert.equal(run.rows.at(-1).urlname,'fuku444');assert.equal(run.rows.at(-1).finalMarker,true);
});

for(const flow of ['normal','history'])for(const size of ['thin','medium'])for(const content of ['name','profile','summary'])test('compiled '+flow+' '+size+'/'+content+' keeps source identity, actual PNG dimensions and the final math participant',async t=>{
 const r=await runtime({count:2,render:false});t.after(()=>r.close());r.local.set('mumei_profile_card_presentation_v292',JSON.stringify({size,content}));
 await(flow==='history'?r.history():r.normal());const run=complete(r,[0,1]);
 assert.deepEqual(r.state.imageDimensions,Array.from({length:3},()=>({width:860,height:size==='medium'?360:140})));
 for(const row of run.rows){assert.equal(row.presentation.size,size);assert.equal(row.presentation.content,content);assert.equal(row.presentation.status,'available');
  if(content==='name')assert.equal(row.presentation.text,'');
  else{assert.equal(row.presentation.source.account,row.urlname);assert.ok(row.presentation.text);if(content==='summary'){assert.equal(row.presentation.source.key,row.key);assert.equal(row.presentation.source.kind,'note-free')}}
 }
 const paragraphs=r.doc().content.filter(node=>node.type==='paragraph'&&JSON.stringify(node).includes('\\boxed'));
 assert.equal(paragraphs.length,size==='thin'&&content!=='name'?2:0,'thin introductions are above their own image; medium introductions stay inside the PNG');
 const captions=r.doc().content.filter(node=>node.type==='image').map(node=>(node.content||[]).map(part=>part.text||'').join(''));
 assert.deepEqual(captions,Array.from(run.rows,row=>row.creator+'さん'));
});

test('presentation choices and owned introductions survive a native upload retry and notification-card deletion',async t=>{
 const r=await runtime({count:2});t.after(()=>r.close());r.local.set('mumei_profile_card_presentation_v292',JSON.stringify({size:'thin',content:'profile'}));r.state.failAt=2;
 await r.normal();assert.equal(r.state.images.length,1);assert.equal(r.editor.readRun().stage,'images_building');r.state.failAt=0;
 r.local.set('mumei_profile_card_presentation_v292',JSON.stringify({size:'medium',content:'summary'}));await r.core.pasteSavedSpecial();const run=complete(r,[0,1]);
 assert.ok(run.rows.every(row=>row.presentation.size==='thin'&&row.presentation.content==='profile'),'resume keeps the pending run choices rather than reading newly changed controls');
 assert.equal(Object.keys(run.presentationTexts||{}).length,2);assert.equal(run.activityTexts.length,2);const imagesAndIntroductions=r.doc();
 await r.core.createCardsAtTap();assert.equal(r.editor.readRun().stage,'complete');await r.core.deleteNotificationCards({confirm:false,save:false});assert.deepEqual(r.doc(),imagesAndIntroductions);
 await r.core.createCardsAtTap();assert.equal(r.editor.readRun().stage,'complete');assert.equal(r.doc().content.filter(node=>node.type==='embed').length,3);
});

for(const [kind,count,sourceFixtures,path] of [
 ['mag',101,{magazines:{mfixture:range(0,101)}},'/magazines/'],
 ['note',51,{likes:{n000000000099:range(0,51)}},'/likes']
])test('generic '+kind+' pagination crosses its real API page size and ends on the terminal partial page',async t=>{
 const r=await runtime({count,render:false,sourceFixtures});t.after(()=>r.close());await r.normal({kind});complete(r,range(0,count));
 assert.equal(r.state.requests.filter(url=>new URL(url).pathname.includes(path)).length,2);
});

test('all-count generic mode exhausts source pages rather than stopping at the numeric input',async t=>{
 const r=await runtime({count:2,render:false,sourceFixtures:{tags:{fixture:range(0,7)}},searchPageSize:3});t.after(()=>r.close());await r.normal({mode:'all'});complete(r,range(0,7));assert.equal(r.state.apiStats.byKind.search,3);
});

test('nonzero simulated API latency is measured separately from original image pacing',async t=>{
 const r=await runtime({count:6,render:false,sourceFixtures:{tags:{fixture:range(0,6)}},apiLatencyMs:2});t.after(()=>r.close());await r.normal();complete(r,range(0,6));const metrics=r.metrics();
 assert.equal(metrics.api.started,r.state.requests.length);assert.equal(metrics.api.completed,metrics.api.started);assert.equal(metrics.api.active,0);assert.ok(metrics.api.peakActive>=2);
 assert.equal(metrics.api.scheduledLatencyMs,metrics.api.started*2);assert.ok(metrics.extractionMs>0);assert.ok(metrics.firstImageMs>=metrics.extractionMs);assert.ok(metrics.totalMs>=metrics.extractionMs);assert.ok(metrics.pasteMs>0);
 assert.equal(metrics.pasteWaitMs,0,'native completion and checkpoint confirmation need no extra image timer');assert.equal(metrics.scheduledWaitMs,metrics.sourceWaitMs+metrics.pasteWaitMs);assert.ok(r.state.requestEvents.every(event=>event.finishedAt>=event.startedAt));
});

test('quality OFF preserves composite selection, image order, captions, pixels and final math output',async t=>{
 const options={count:8,sourceFixtures:{tags:{alpha:[0,1,2]},magazines:{mfixture:[2,3,4,5]},likes:{n000000000099:[5,6,7]}}},on=await runtime(options),off=await runtime({...options,record:false});t.after(()=>on.close());t.after(()=>off.close());
 const sources='#alpha\nhttps://note.com/fixture/m/mfixture\nhttps://note.com/fixture/n/n000000000099';await on.normal({sources});await off.normal({sources});complete(on,range(0,8));complete(off,range(0,8));
 assert.deepEqual(off.doc(),on.doc());assert.deepEqual(off.state.images,on.state.images);assert.deepEqual(off.state.requests,on.state.requests);assert.equal(off.quality.snapshot().records.length,0);
});

test('generic paginated acquisition still holds a contradictory pending row and resumes the same plan after repair',async t=>{
 let wrong=true;const r=await runtime({count:25,render:false,sourceFixtures:{tags:{fixture:range(0,25)}},requestMutator:(url,payload)=>{if(wrong&&new URL(url).pathname==='/api/v3/notes/n000000000015')payload.data.user.urlname='unrelated_account';return payload}});t.after(()=>r.close());
 await r.normal();const held=r.editor.readRun();assert.equal(held.stage,'images_building');assert.equal(held.qualityHold?.index,20);assert.equal(r.state.images.length,20);assert.ok(!held.imageSkipped?.length);assert.ok(!held.imagesCompletedAt);const plan=ids(held);
 wrong=false;await r.core.pasteSavedSpecial();complete(r,range(0,25));assert.deepEqual(ids(r.editor.readRun()),plan);
});
