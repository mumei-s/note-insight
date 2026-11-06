import nodeTest from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {awakeRuntime} from '../scripts/profile-card-continuous-v295.mjs';
import {runtime,dependencies} from './fixtures/profile-card-quality-runtime.mjs';
const test=(name,fn)=>nodeTest(name,{skip:!dependencies?'PM/canvas dependencies required':false},fn);
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const blocks=(r,type)=>{const out=[];r.view.state.doc.forEach((node,pos)=>{if(node.type.name===type)out.push({node,pos})});return out};
const remove=(r,hit)=>r.view.dispatch(r.view.state.tr.delete(hit.pos,hit.pos+hit.node.nodeSize));
function complete(r){const run=r.editor.readRun();assert.equal(run.stage,'images_ready',r.state.statuses.at(-1)?.text);assert.equal(run.items.length,run.rows.length);assert.equal(run.qualityHold??null,null);return run}

for(const change of ['remove','edit','move'])test('manual '+change+' of a completed divider allows resume without restoring it',async t=>{
 const r=await runtime({count:3});t.after(()=>r.close());r.state.pauseAt=1;await r.normal();
 assert.equal(r.editor.readRun().items.length,1);assert.equal(r.editor.readRun().paused,true);
 const rule=blocks(r,'horizontal_rule')[0];assert.ok(rule);remove(r,rule);
 if(change==='edit')r.view.dispatch(r.view.state.tr.insert(rule.pos,r.para('手で変更した部分')));
 if(change==='move')r.view.dispatch(r.view.state.tr.insert(r.view.state.doc.content.size,rule.node));
 r.state.pauseAt=0;await r.core.pasteSavedSpecial();complete(r);
 assert.equal(r.state.images.length,4);assert.equal(blocks(r,'horizontal_rule').length,change==='move'?4:3);
 if(change==='edit')assert.ok(r.view.state.doc.textContent.includes('手で変更した部分'));
 const doc=r.doc();await r.core.pasteSavedSpecial();assert.deepEqual(r.doc(),doc);
});

test('a removed completed image and its boundary are not uploaded again',async t=>{
 const r=await runtime({count:2});t.after(()=>r.close());r.state.pauseAt=1;await r.normal();
 remove(r,blocks(r,'horizontal_rule')[0]);remove(r,blocks(r,'image')[0]);
 r.state.pauseAt=0;await r.core.pasteSavedSpecial();const run=complete(r);
 assert.equal(r.state.images.length,3);assert.equal(blocks(r,'image').length,2);
 assert.ok(!blocks(r,'image').some(hit=>hit.node.attrs.link===run.rows[0].url));
});

test('hand-deleted profile text stays deleted and layout helper is absent',async t=>{
 const local=new Map([['mumei_profile_card_presentation_v292',JSON.stringify({size:'thin',content:'profile'})]]);
 const r=await runtime({count:2,localStorageMap:local});t.after(()=>r.close());r.state.pauseAt=1;await r.normal();
 const literal=r.editor.readRun().presentationTexts[r.editor.readRun().rows[0].url];
 const profile=blocks(r,'paragraph').find(hit=>hit.node.textContent===literal);assert.ok(profile);remove(r,profile);
 r.state.pauseAt=0;await r.core.pasteSavedSpecial();complete(r);
 assert.equal(r.page.__MUMEI_PROFILE_CARD_LAYOUT_REPAIR__,undefined);
 const code=readFileSync('public/note-profile-card-likes300-fix-v220.user.js','utf8');
 assert.ok(code.includes('function mountUI(){}'));
 assert.ok(!code.includes('ctx.fillText=function'));
 const literals=new Set(Object.values(r.editor.readRun().presentationTexts));
 assert.equal(blocks(r,'paragraph').filter(hit=>literals.has(hit.node.textContent)).length,1);
});

test('history continues after hand deletion and still appends the final article',async t=>{
 const r=await runtime({count:3});t.after(()=>r.close());r.state.pauseAt=1;await r.history();
 remove(r,blocks(r,'horizontal_rule')[0]);remove(r,blocks(r,'image')[0]);
 r.state.pauseAt=0;await r.history();const run=complete(r);
 assert.equal(r.state.images.length,4);assert.equal(run.items.at(-1).url,'https://note.com/fuku444/n/nb4f6934381e9');
});

test('normal image and notification actions hold screen awake only while running',async t=>{
 const r=await runtime({count:2});t.after(()=>r.close());const states=[];
 r.page.navigator.wakeLock={async request(kind){assert.equal(kind,'screen');const lock=new EventTarget();lock.released=false;lock.release=async()=>{lock.released=true;lock.dispatchEvent(new Event('release'))};states.push(lock);return lock}};
 r.core.patch('const continuousOriginalUpload=uploadOne;uploadOne=async function(...args){state.awakeDuringUpload=window.__MUMEI_PROFILE_CARD_AWAKE__.status().held;return continuousOriginalUpload(...args)};');
 await r.normal();complete(r);assert.equal(r.state.awakeDuringUpload,true);assert.equal(states.length,1);assert.equal(states[0].released,true);
 assert.equal(r.page.__MUMEI_PROFILE_CARD_AWAKE__.status().active,false);
 await r.core.createCardsAtTap();assert.equal(r.editor.readRun().stage,'complete');assert.equal(states.length,2);assert.equal(states[1].released,true);
});

nodeTest('wake lock reacquires on a system release and visibility return, and releases after all owners end',async()=>{
 const document=new EventTarget(),page=new EventTarget(),locks=[];document.hidden=false;
 page.navigator={wakeLock:{async request(){const lock=new EventTarget();lock.released=false;lock.release=async()=>{lock.released=true;lock.dispatchEvent(new Event('release'))};locks.push(lock);return lock}}};
 vm.runInNewContext(awakeRuntime,{owner:page,document,setTimeout,clearTimeout,Set});
 const api=page.__MUMEI_PROFILE_CARD_AWAKE__;document.dispatchEvent(new Event('visibilitychange'));assert.equal(locks.length,0);
 await api.acquire('core');await api.acquire('history');assert.equal(locks.length,1);
 await locks[0].release();await delay(290);assert.equal(locks.length,2);
 document.hidden=true;await locks[1].release();await delay(270);assert.equal(locks.length,2);
 document.hidden=false;document.dispatchEvent(new Event('visibilitychange'));await delay(0);assert.equal(locks.length,3);
 await api.release('core');assert.equal(locks[2].released,false);await api.release('history');assert.equal(locks[2].released,true);
 document.dispatchEvent(new Event('visibilitychange'));await delay(0);assert.equal(locks.length,3);
});

nodeTest('unsupported or denied screen locks do not abort or claim success',async()=>{
 for(const navigator of [{},{wakeLock:{request:async()=>{throw Object.assign(new Error('denied'),{name:'NotAllowedError'})}}}]){
  const page=new EventTarget(),document=new EventTarget();document.hidden=false;page.navigator=navigator;
  vm.runInNewContext(awakeRuntime,{owner:page,document,setTimeout,clearTimeout,Set});
  const api=page.__MUMEI_PROFILE_CARD_AWAKE__;assert.equal(await api.acquire('core'),false);assert.equal(api.status().held,false);assert.ok(api.status().lastError);await api.release('core');
 }
});

for(const kind of ['tag','history'])test(kind+' prepares next assets during one serial native upload and finishes without pause',async t=>{
 const r=await runtime({count:3,realWaits:true});t.after(()=>r.close());r.state.pipeline=[];r.state.activeUploads=0;r.state.peakUploads=0;
 for(const api of [r.core,r.editor])api.patch(`const continuousOriginalBitmap=bitmapFromUrl;bitmapFromUrl=async url=>{state.pipeline.push({kind:'asset',url:String(url),active:state.activeUploads});await new Promise(resolve=>setTimeout(resolve,25));state.pipeline.push({kind:'asset-ready',active:state.activeUploads});return continuousOriginalBitmap(url)};
 const continuousOriginalCommand=nativeImageCommand;nativeImageCommand=()=>{const command=continuousOriginalCommand();return(v,files,...args)=>{state.activeUploads++;state.peakUploads=Math.max(state.peakUploads,state.activeUploads);state.pipeline.push({kind:'upload-start'});setTimeout(()=>{command(v,files,...args);state.pipeline.push({kind:'upload-end'});state.activeUploads--},25);return true}};`);
 // Observer fixture models PM DOM mutation; the fallback heartbeat must not add a per-image 500ms wait.
 const observers=new Set();r.view.dom={};r.page.MutationObserver=class{constructor(fn){this.fn=fn}observe(){observers.add(this)}disconnect(){observers.delete(this)}};
 const dispatch=r.view.dispatch.bind(r.view);r.view.dispatch=tr=>{dispatch(tr);for(const observer of observers)observer.fn()};
 if(kind==='tag')await r.normal();else await r.history();complete(r);
 assert.equal(r.state.peakUploads,1);assert.equal(r.state.images.length,4);
 assert.ok(r.state.pipeline.some(event=>event.kind==='asset-ready'&&event.active===1),'next asset fetch overlaps upload');
 assert.equal(r.state.pipeline.filter(event=>event.kind==='asset').length,8,'each requested asset is decoded once');
 assert.equal(r.editor.readRun().paused,false);assert.equal(observers.size,0);
});

test('background time does not consume upload deadline and foreground mutation completes it once',async t=>{
 const r=await runtime({count:1,realWaits:true});t.after(()=>r.close());const listeners=new Map();
 r.c.document.hidden=true;r.c.document.addEventListener=(type,fn)=>listeners.set(type,fn);r.c.document.removeEventListener=(type,fn)=>{if(listeners.get(type)===fn)listeners.delete(type)};
 r.core.patch('globalThis.continuousWait=waitNewNoteImage;');
 const pending=r.c.continuousWait(r.view,new Set(),25);
 await delay(45);r.c.document.hidden=false;listeners.get('visibilitychange')();
 const image=r.schema.nodes.image.create({id:'late-success',src:'https://assets.st-note.com/late.png'});r.view.dispatch(r.view.state.tr.insert(r.view.state.doc.content.size,image));
 r.page.dispatchEvent(new Event('online'));const hit=await pending;assert.equal(hit.node.attrs.id,'late-success');assert.equal(listeners.size,0);
});

test('native upload exception preserves the prefix and explicit retry sends only the unfinished images',async t=>{
 const r=await runtime({count:3});t.after(()=>r.close());r.state.failAt=2;await r.normal();
 assert.equal(r.editor.readRun().items.length,1);assert.equal(r.editor.readRun().stage,'images_building');
 r.state.failAt=0;await r.core.pasteSavedSpecial();complete(r);assert.equal(r.state.images.length,4);
});

test('a real author contradiction still blocks before the first native upload',async t=>{
 const r=await runtime({count:2,requestMutator:(url,payload)=>{if(url.includes('/api/v3/notes/n000000000001'))payload.data.user.urlname='wrong_person';return payload}});t.after(()=>r.close());await r.normal();
 assert.equal(r.state.images.length,0);assert.equal(r.editor.readRun().qualityHold.index,0);
});

test('a normal 200-person run finishes all 201 images in order without an automatic pause',async t=>{
 const r=await runtime({count:200,render:false});t.after(()=>r.close());await r.normal();const run=complete(r);
 assert.equal(run.rows.length,201);assert.equal(r.state.images.length,201);assert.equal(run.paused,false);
 assert.deepEqual(Array.from(run.items,item=>item.url),Array.from(run.rows,row=>row.url));
 assert.equal(blocks(r,'horizontal_rule').length,201);assert.equal(run.rows.at(-1).finalMarker,true);
});
