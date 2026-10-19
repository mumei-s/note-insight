import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync('public/note-profile-card-paster-core-v232.js','utf8');
function runtime(){
 const values=new Map(),page={addEventListener(){},dispatchEvent(){}},document={readyState:'loading',addEventListener(){},getElementById:()=>null};
 const c=vm.createContext({unsafeWindow:page,window:page,document,location:new URL('https://editor.note.com/notes/n123456789abc/edit'),localStorage:{getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)},GM_getValue:()=>null,URL,Event,setTimeout,clearTimeout});
 const entry="if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();";
 vm.runInContext(source.replace('const sleep=','let sleep=').replace(entry,'globalThis.api={patch:code=>eval(code),createImageList,pasteSavedSpecial,pauseCards,stop,update};'),c);
 c.saved=null;c.images=[];c.calls=[];c.statuses=[];c.saves=[];c.flushes=[];c.headings=[];c.aborts=0;c.fetches=0;
 c.input={sources:'#test',mode:'number',count:2,choice:'oldest',specialMode:'number',specialCount:2,specialTags:['自己紹介']};
 c.rows=Array.from({length:3},(_,index)=>({index:index+1,url:'https://note.com/person'+index+'/n/n'+String(index+1).repeat(12),creator:'person'+index,finalMarker:index===2}));
 page.__MUMEI_PROFILE_CARD_RUN_STORE__={hydrate:async()=>{},flush:async()=>c.flushes.push(c.saved?.items?.length||0)};
 c.api.patch(`readRun=()=>saved;writeRun=value=>saved=value;inputValues=()=>input;parseUnifiedSources=()=>[{}];findView=()=>({state:{doc:{content:{size:100}}}});nativeImageCommand=()=>{};noteUrlCommandFactory=()=>{};selectionApi=()=>{};cardAnchorFromSelection=()=>10;trackedContentCount=()=>({images:0,cards:0,headings:0,activities:0});embedNodes=()=>[];imageNodes=()=>images;resolveOwnedCardHits=()=>[];buildRows=async()=>{fetches++;return rows};makeFile=async()=>({});keepAwake=async()=>{};releaseAwake=async()=>{};sleep=async()=>{};saveOnce=async text=>{saves.push(text);return true};setStatus=(text,bad)=>statuses.push({text,bad});abortActiveRequests=()=>{aborts++};saveSpecialLast=()=>{};commitSpecialLast=()=>0;insertHeadingAt=(view,text,pos)=>{headings.push({text,pos});return{nextPos:pos+1}};findHeadingByText=(view,text)=>{const hit=headings.find(hit=>hit.text===text);return hit?{pos:hit.pos,node:{nodeSize:1}}:null};uploadOne=async(view,row,file,pos)=>{calls.push(row.url);await new Promise(resolve=>{globalThis.finishUpload=resolve});const hit={pos,node:{nodeSize:1,attrs:{id:'image-'+row.index,src:'https://assets.st-note.com/'+row.index+'.png',link:row.url}}};images.push(hit);return{hit,nextPos:pos+1}};`);
 return c;
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));

test('ordinary URL/tag images pause after the in-flight image and resume the same plan without reuploads',async()=>{
 const c=runtime(),creating=c.api.createImageList();await tick();assert.equal(c.calls.length,1);
 assert.equal(c.window.__MUMEI_PROFILE_CARD_PAUSE__(),true);assert.equal(c.aborts,0);assert.equal(c.saved.items.length,0);
 c.finishUpload();await creating;
 assert.equal(c.saved.paused,true);assert.equal(c.saved.pauseStage,'core-images');assert.equal(c.saved.items.length,1);assert.equal(c.saves.length,1);
 assert.equal(c.window.__MUMEI_PROFILE_CARD_CORE_BUSY__(),false);assert.match(c.statuses.at(-1).text,/一時停止中.*1\/3/);
 c.input.count=1;
 const resuming=c.window.__MUMEI_PROFILE_CARD_RESUME_CORE_IMAGES__();await tick();assert.equal(c.calls.length,2);
 c.finishUpload();await tick();assert.equal(c.calls.length,3);c.finishUpload();await resuming;
 assert.equal(c.saved.stage,'images_ready');assert.equal(c.saved.paused,false);assert.equal(c.saved.pauseStage,null);
 assert.equal(c.fetches,1);assert.deepEqual(c.calls,c.rows.map(row=>row.url));assert.deepEqual(c.images.map(hit=>hit.pos),[10,11,12]);assert.equal(c.headings.length,0);
});

test('a pause accepted during metadata preparation checkpoints the complete plan before the first image',async()=>{
 const c=runtime();c.api.patch('buildRows=()=>new Promise(resolve=>{globalThis.finishMetadata=()=>resolve(rows)})');
 const creating=c.api.createImageList();await tick();assert.equal(c.api.pauseCards(),true);assert.match(c.statuses.at(-1).text,/一時停止を受付/);
 c.finishMetadata();await creating;
 assert.equal(c.calls.length,0);assert.equal(c.saved.rows.length,3);assert.equal(c.saved.paused,true);assert.equal(c.saved.pauseStage,'core-images');
});

test('special saved-image continuation can itself pause, retains headings, and resumes without duplicate images',async()=>{
 const c=runtime(),creating=c.api.createImageList({special:true});await tick();c.api.pauseCards();c.finishUpload();await creating;
 assert.equal(c.headings.length,1);assert.equal(c.saved.items.length,1);
 const resuming=c.api.pasteSavedSpecial();await tick();c.api.pauseCards();c.finishUpload();await resuming;
 assert.equal(c.saved.items.length,2);assert.equal(c.saved.paused,true);assert.equal(c.headings.length,1);
 const finishing=c.api.pasteSavedSpecial();await tick();c.finishUpload();await finishing;
 assert.deepEqual(c.calls,c.rows.map(row=>row.url));assert.equal(c.headings.length,2);assert.equal(c.saved.stage,'images_ready');
});

test('core-image pause updates the control immediately instead of claiming the workflow is idle',async()=>{
 const c=runtime(),pause={dataset:{a:'pause'},disabled:false};c.document.getElementById=()=>({querySelectorAll:()=>[pause]});
 const creating=c.api.createImageList();await tick();c.api.pauseCards();assert.equal(pause.textContent,'停止受付中…');
 c.finishUpload();await creating;assert.equal(pause.textContent,'一時停止中');
});

test('explicit stop overrides a queued image pause and keeps the completed image checkpoint',async()=>{
 const c=runtime(),creating=c.api.createImageList();await tick();c.api.pauseCards();c.api.stop();c.finishUpload();await creating;
 assert.equal(c.calls.length,1);assert.equal(c.saved.items.length,1);assert.equal(c.saved.paused,false);assert.equal(c.aborts,1);
 assert.match(c.statuses.at(-1).text,/手動停止/);
});

test('a changed or missing recorded image prevents resume from inserting a replacement',async()=>{
 const c=runtime(),creating=c.api.createImageList();await tick();c.api.pauseCards();c.finishUpload();await creating;
 c.images[0].node.attrs.link=c.rows[2].url;
 await c.api.pasteSavedSpecial();assert.equal(c.calls.length,1);assert.match(c.statuses.at(-1).text,/保存記録のある画像/);
});

test('an unrecorded late native image is detected before sending a duplicate',async()=>{
 const c=runtime(),creating=c.api.createImageList();await tick();c.api.pauseCards();c.finishUpload();await creating;
 c.images.push({pos:11,node:{nodeSize:1,attrs:{id:'late-image',src:'https://assets.st-note.com/late.png',link:c.rows[1].url}}});
 await c.api.pasteSavedSpecial();assert.equal(c.calls.length,1);assert.match(c.statuses.at(-1).text,/保存記録のない作成画像/);
});
