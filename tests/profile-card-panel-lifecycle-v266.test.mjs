import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const {JSDOM}=require(process.env.JSDOM_TEST_MODULE||'jsdom');
const files=['public/note-profile-card-paster-v1.user.js','public/note-profile-card-likes300-fix-v220.user.js'];
const PANEL='mumei-profile-card-paster-v1';
const ARTICLE='n123456789abc';
const RUN_KEY='mumei_profile_card_paster_run_v15:'+ARTICLE;
const BACKUP_KEY='mumei_profile_card_run_backup_v253:'+ARTICLE;
const pausedRun={articleKey:ARTICLE,gallery126:true,galleryAvailableOnly:true,stage:'images_building',paused:true,pauseStage:'images',count:125,rows:[],items:[],cardKeys:[],updatedAt:12345};

async function runtime(t,path=files[0],{saved=pausedRun,prefs=null}={}){
 const dom=new JSDOM('<!doctype html><html><body><div id="note-editor" contenteditable="true" tabindex="0">Existing article text stays here.</div></body></html>',{url:'https://editor.note.com/notes/'+ARTICLE+'/edit',runScripts:'outside-only',pretendToBeVisual:true});
 const observers=[];
 t.after(()=>{for(const observer of observers)observer.disconnect();dom.window.close()});
 const w=dom.window,intervals=new Map(),gm=new Map(),errors=[],counts={network:0,backupWrites:0};let nextInterval=1;
 // jsdom tears down its document before pending observer delivery on close.
 // Disconnect test-owned observers first, without changing normal delivery.
 const NativeMutationObserver=w.MutationObserver;
 w.MutationObserver=class extends NativeMutationObserver{constructor(callback){super(callback);observers.push(this)}};
 w.unsafeWindow=w;
 w.setInterval=callback=>{const id=nextInterval++;intervals.set(id,callback);return id};
 w.clearInterval=id=>intervals.delete(id);
 w.GM_getValue=(key,fallback)=>gm.has(key)?gm.get(key):fallback;
 w.GM_setValue=(key,value)=>{counts.backupWrites++;gm.set(key,structuredClone(value))};
 w.GM_xmlhttpRequest=()=>{counts.network++;throw Error('Panel lifecycle must not start a network request')};
 w.confirm=()=>{throw Error('Panel lifecycle must not request document changes')};
 w.addEventListener('error',event=>{errors.push(event.error||event.message);event.preventDefault()});
 if(saved){w.localStorage.setItem(RUN_KEY,JSON.stringify(saved));gm.set(BACKUP_KEY,{value:structuredClone(saved),updatedAt:saved.updatedAt,deleted:false,articleKey:ARTICLE})}
 if(prefs)w.localStorage.setItem('mumei_profile_card_paster_v1',JSON.stringify(prefs));
 const code=readFileSync(path,'utf8');
 assert.match(code,/@version\s+2\.7\.4\b/,'exercise the rebuilt publication, including its real startup and lifecycle code');
 w.eval(code);
 w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
 for(const callback of [...intervals.values()])callback();
 const flush=async()=>{for(let i=0;i<4;i++)await new Promise(resolve=>setTimeout(resolve,0));assert.deepEqual(errors,[],'lifecycle events must not throw')};
 await flush();
 const panel=()=>w.document.getElementById(PANEL);
 const gallery=()=>panel()?.querySelector('[data-gallery126]');
 const click=element=>{assert.ok(element,'the requested control must exist');element.dispatchEvent(new w.MouseEvent('click',{bubbles:true,cancelable:true}))};
 const ready=()=>w.dispatchEvent(new w.Event('mumei-profile-card-panel-ready'));
 const snapshots=()=>({local:w.localStorage.getItem(RUN_KEY),backup:JSON.stringify(gm.get(BACKUP_KEY))});
 assert.ok(gallery(),'Halloween controls must be available after initial startup');
 return{w,panel,gallery,click,ready,flush,counts,snapshots};
}

test('a fresh panel defaults to 200 and the recent-200 preset preserves a saved run',async t=>{
 const fresh=await runtime(t,files[0],{saved:null});
 assert.equal(fresh.panel().querySelector('[data-count]').value,'200');
 const r=await runtime(t,files[1],{prefs:{mode:'all',count:12}}),before=r.snapshots();
 assert.equal(r.panel().querySelector('[data-mode]').value,'all');
 for(let i=0;i<3;i++)r.ready();
 assert.equal(r.panel().querySelectorAll('[data-a="like200-preset"]').length,1);
 const preset=r.panel().querySelector('[data-a="like200-preset"]');
 assert.equal(preset.type,'button');
 r.click(preset);await r.flush();
 assert.equal(r.panel().querySelector('[data-mode]').value,'number');
 assert.equal(r.panel().querySelector('[data-count]').value,'200');
 assert.equal(r.panel().querySelector('[data-count]').disabled,false);
 const prefs=JSON.parse(r.w.localStorage.getItem('mumei_profile_card_paster_v1'));
 assert.equal(prefs.mode,'number');assert.equal(prefs.count,200);
 assert.deepEqual(r.snapshots(),before);
 assert.equal(r.counts.network,0,'setting the count cannot start a new batch');
});

for(const path of files)test('published tool restores Halloween controls after repeated close and expansion: '+path,async t=>{
 const r=await runtime(t,path),initialPanel=r.panel(),initialGallery=r.gallery();
 for(let i=0;i<4;i++){
  r.gallery().open=false;r.panel().querySelector('.body').scrollTop=300;
  r.click(r.panel().querySelector('[data-ui="tiny"]'));
  assert.ok(r.panel().classList.contains('tiny'));
  r.click(r.w.document.getElementById(PANEL+'-mini'));
  await r.flush();
  assert.equal(r.panel(),initialPanel,'reopening preserves the mounted panel');
  assert.equal(r.gallery(),initialGallery,'reopening does not recreate existing controls');
  assert.equal(r.gallery().open,true,'the Halloween resume controls are revealed');
  assert.equal(r.panel().querySelector('.body').scrollTop,0);
  r.click(r.panel().querySelector('[data-ui="collapse"]'));
  assert.ok(r.panel().classList.contains('collapsed'));
  r.click(r.panel().querySelector('[data-ui="collapse"]'));
  await r.flush();
  assert.ok(!r.panel().classList.contains('collapsed'));
  assert.equal(r.panel().querySelectorAll('[data-gallery126]').length,1);
 }
});

test('removing the panel or only its body restores one functional Halloween section',async t=>{
 const r=await runtime(t);
 r.panel().remove();await r.flush();
 assert.ok(r.panel(),'a removed panel is remounted');
 assert.equal(r.panel().querySelectorAll('[data-gallery126]').length,1);
 r.panel().querySelector('.body').remove();await r.flush();
 assert.ok(r.panel().querySelector('[data-sources]'),'missing base controls are restored');
 assert.equal(r.panel().querySelectorAll('[data-gallery126]').length,1);
 assert.equal(r.w.document.querySelectorAll('#'+PANEL).length,1);
 assert.equal(r.w.document.querySelectorAll('#'+PANEL+'-mini').length,1);
});

test('a removed minimized launcher is restored and reopens the Halloween resume controls',async t=>{
 const r=await runtime(t),before=r.snapshots();
 r.click(r.panel().querySelector('[data-ui="tiny"]'));
 r.w.document.getElementById(PANEL+'-mini').remove();await r.flush();
 const mini=r.w.document.getElementById(PANEL+'-mini');
 assert.ok(mini,'the minimized launcher must be recoverable without reloading the draft');
 r.click(mini);await r.flush();
 assert.ok(!r.panel().classList.contains('tiny'));
 assert.equal(r.gallery().open,true);
 assert.equal(r.panel().querySelectorAll('[data-gallery-action="resume"]').length,1);
 assert.deepEqual(r.snapshots(),before);assert.equal(r.counts.network,0);
});

test('restoring a removed Halloween section is idempotent and one card click starts one action',async t=>{
 const r=await runtime(t);r.gallery().remove();await r.flush();
 const gallery=r.gallery(),history=r.panel().querySelector('[data-a="like300-fixed"]'),resume=r.panel().querySelector('[data-a="like300-resume"]');
 for(let i=0;i<12;i++)r.ready();
 await r.flush();
 assert.equal(r.gallery(),gallery);
 assert.equal(r.panel().querySelector('[data-a="like300-fixed"]'),history,'ready events preserve the existing history control');
 assert.equal(r.panel().querySelector('[data-a="like300-resume"]'),resume,'ready events preserve the existing resume control');
 assert.equal(r.panel().querySelectorAll('[data-gallery126]').length,1);
 let calls=0;r.w.__MUMEI_PROFILE_CARD_CREATE_CARDS_AT_TAP__=()=>{calls++};
 r.click(gallery.querySelector('[data-gallery-action="cards"]'));
 assert.equal(calls,1,'one restored button click must call the current editor action once');
});

test('panel and body replacement cannot leave cloned binding markers with dead controls',async t=>{
 const r=await runtime(t);
 r.panel().replaceWith(r.panel().cloneNode(true));await r.flush();
 r.gallery().remove();await r.flush();
 let calls=0;r.w.__MUMEI_PROFILE_CARD_CREATE_CARDS_AT_TAP__=()=>{calls++};
 r.click(r.gallery().querySelector('[data-gallery-action="cards"]'));
 assert.equal(calls,1);
 r.panel().querySelector('.body').replaceWith(r.panel().querySelector('.body').cloneNode(true));await r.flush();
 r.click(r.gallery().querySelector('[data-gallery-action="cards"]'));
 assert.equal(calls,2,'replacement children receive live handlers even when serialized markers were copied');
 assert.equal(r.panel().querySelectorAll('[data-gallery126]').length,1);
});

test('reopening a paused batch changes no progress and performs no automatic restart or request',async t=>{
 const r=await runtime(t),before=r.snapshots();
 let starts=0;r.w.addEventListener('mumei-profile-card-start',()=>starts++);
 for(let i=0;i<3;i++){
  r.click(r.panel().querySelector('[data-ui="tiny"]'));
  r.click(r.w.document.getElementById(PANEL+'-mini'));
  r.ready();await r.flush();
 }
 assert.deepEqual(r.snapshots(),before,'UI restoration preserves both local and durable paused checkpoints');
 assert.equal(r.w.__MUMEI_PROFILE_CARD_RUN_STORE__.read().paused,true);
 assert.equal(starts,0);assert.equal(r.counts.network,0);assert.equal(r.counts.backupWrites,0);
 assert.equal(r.w.__MUMEI_PROFILE_CARD_CORE_BUSY__(),false);
 assert.equal(r.w.__MUMEI_PROFILE_CARD_FIXED_BUSY__(),false);
});

test('a persisted minimized panel reopens after startup and its resume button resumes the saved card phase once',async t=>{
 const completedRows=Array.from({length:126},(_,index)=>({gallery126:true,index:index+1}));
 const r=await runtime(t,files[0],{saved:{...pausedRun,rows:completedRows,galleryAvailableOnly:false,pauseStage:'cards'},prefs:{tiny:true,collapsed:false}}),before=r.snapshots();
 assert.ok(r.panel().classList.contains('tiny'));
 r.click(r.w.document.getElementById(PANEL+'-mini'));await r.flush();
 assert.ok(!r.panel().classList.contains('tiny'));assert.equal(r.gallery().open,true);
 let resumes=0;r.w.__MUMEI_PROFILE_CARD_CREATE_CARDS_AT_TAP__=()=>{resumes++};
 r.click(r.gallery().querySelector('[data-gallery-action="resume"]'));await r.flush();
 assert.equal(resumes,1,'resume reaches the saved card phase instead of restarting the gallery');
 assert.deepEqual(r.snapshots(),before);assert.equal(r.counts.network,0);
});

test('lifecycle repair preserves the focused URL control and button taps preserve article selection',async t=>{
 const r=await runtime(t),field=r.panel().querySelector('[data-sources]');
 field.value='#ハロウィンアート2026';field.focus();field.setSelectionRange(2,5);
 r.gallery().remove();r.ready();await r.flush();
 assert.equal(r.panel().querySelector('[data-sources]'),field);
 assert.equal(r.w.document.activeElement,field);
 assert.equal(field.value,'#ハロウィンアート2026');assert.equal(field.selectionStart,2);assert.equal(field.selectionEnd,5);
 const editor=r.w.document.getElementById('note-editor'),selection=r.w.getSelection(),range=r.w.document.createRange();
 editor.focus();range.setStart(editor.firstChild,2);range.setEnd(editor.firstChild,9);selection.removeAllRanges();selection.addRange(range);
 const button=r.gallery().querySelector('[data-gallery-action="cards"]'),event=new r.w.MouseEvent('mousedown',{bubbles:true,cancelable:true});
 button.dispatchEvent(event);
 assert.equal(event.defaultPrevented,true,'action button down preserves the editor focus');
 assert.equal(r.w.document.activeElement,editor);
 assert.equal(selection.anchorNode,editor.firstChild);assert.equal(selection.anchorOffset,2);assert.equal(selection.focusOffset,9);
 const inputEvent=new r.w.MouseEvent('mousedown',{bubbles:true,cancelable:true});field.dispatchEvent(inputEvent);
 assert.equal(inputEvent.defaultPrevented,false);assert.equal(r.w.document.activeElement,field);
 assert.equal(r.counts.network,0);
});

test('panel actions and disclosure taps never reach the host navigation click handler',async t=>{
 const r=await runtime(t);let homeNavigations=0,pauseCalls=0;
 r.w.document.addEventListener('click',()=>{homeNavigations++});
 r.w.__MUMEI_PROFILE_CARD_PAUSE__=()=>{pauseCalls++;return true};
 r.click(r.gallery().querySelector('[data-gallery-action="pause"]'));
 assert.equal(pauseCalls,1);
 assert.equal(homeNavigations,0,'pause must not bubble into note navigation');
 const summary=r.gallery().querySelector('summary'),wasOpen=r.gallery().open;
 summary.click();
 assert.equal(r.gallery().open,!wasOpen,'the event shield preserves native disclosure toggling');
 assert.equal(homeNavigations,0);
 r.click(r.panel().querySelector('[data-ui="collapse"]'));
 assert.equal(homeNavigations,0,'panel UI actions must not reach note navigation');
 assert.equal(r.counts.network,0);
});

test('every mounted action is a non-submit button, including controls created after the base panel',async t=>{
 const r=await runtime(t);
 for(const button of r.panel().querySelectorAll('button'))assert.equal(button.type,'button',button.outerHTML);
 assert.equal(r.w.document.getElementById(PANEL+'-mini').type,'button');
});

test('a mobile pause gesture is accepted before click and its compatibility events invoke pause once',async t=>{
 const r=await runtime(t),button=r.gallery().querySelector('[data-gallery-action="pause"]');let pauseCalls=0,hostDowns=0;
 r.w.__MUMEI_PROFILE_CARD_PAUSE__=()=>{pauseCalls++;return true};
 for(const type of ['pointerdown','touchstart','click'])r.w.document.addEventListener(type,()=>{hostDowns++});
 button.dispatchEvent(new r.w.Event('pointerdown',{bubbles:true,cancelable:true}));
 assert.equal(pauseCalls,1,'mobile pause must acknowledge the initial pointer contact');
 button.dispatchEvent(new r.w.Event('touchstart',{bubbles:true,cancelable:true}));
 r.click(button);
 assert.equal(pauseCalls,1,'compatibility touch/click events belong to the same pause gesture');
 assert.equal(hostDowns,0);assert.equal(r.counts.network,0);
});

test('tapping pause while no phase is active still acknowledges the tap without changing progress',async t=>{
 const r=await runtime(t),status=r.w.document.getElementById('mumei-profile-card-paster-status-v1'),beforeText=status.textContent,before=r.snapshots();
 r.click(r.gallery().querySelector('[data-gallery-action="pause"]'));await r.flush();
 assert.notEqual(status.textContent,beforeText,'an inactive card handler returning false must not leave pause silent');
 assert.match(status.textContent,/一時停止|停止|実行中/);
 assert.deepEqual(r.snapshots(),before);assert.equal(r.counts.network,0);
});

test('refreshing a busy panel keeps both pause controls enabled while blocking new batches',async t=>{
 const r=await runtime(t);
 r.w.__MUMEI_PROFILE_CARD_FIXED_BUSY__=()=>true;
 r.w.__MUMEI_PROFILE_CARD_REFRESH_UI__();
 assert.equal(r.gallery().querySelector('[data-gallery-action="pause"]').disabled,false);
 assert.equal(r.panel().querySelector('[data-a="pause"]').disabled,false);
 assert.equal(r.gallery().querySelector('[data-gallery-action="images"]').disabled,true);
 assert.equal(r.panel().querySelector('[data-sources]').disabled,true);
 assert.equal(r.counts.network,0);
});

test('the Halloween whole-batch delete control calls its current action once and never reaches host navigation',async t=>{
 const r=await runtime(t),before=r.snapshots();let calls=0,homeNavigations=0;
 assert.equal(typeof r.w.__MUMEI_PROFILE_CARD_DELETE_ALL__,'function','the visible delete control must have a current editor action');
 r.w.__MUMEI_PROFILE_CARD_DELETE_ALL__=()=>{calls++};
 r.w.document.addEventListener('click',()=>{homeNavigations++});
 for(let i=0;i<5;i++)r.ready();await r.flush();
 r.click(r.gallery().querySelector('[data-gallery-action="delete-all"]'));
 assert.equal(calls,1);assert.equal(homeNavigations,0);
 assert.deepEqual(r.snapshots(),before);assert.equal(r.counts.network,0);
});

for(const pauseStage of ['cards','core-images'])test('resume selects the saved generic core phase before gallery preparation: '+pauseStage,async t=>{
 const saved={articleKey:ARTICLE,coreImageRun:true,gallery126:false,stage:pauseStage==='cards'?'cards_building':'images_building',paused:true,pauseStage,count:1,rows:[{index:1,creator:'Example',urlname:'example',url:'https://note.com/example/n/nabcdefabcdef'}],items:[],cardKeys:[],updatedAt:12345};
 const r=await runtime(t,files[0],{saved}),before=r.snapshots();let cardResumes=0,imageResumes=0;
 assert.equal(typeof r.w.__MUMEI_PROFILE_CARD_RESUME_CORE_IMAGES__,'function');
 r.w.__MUMEI_PROFILE_CARD_CREATE_CARDS_AT_TAP__=()=>{cardResumes++};
 r.w.__MUMEI_PROFILE_CARD_RESUME_CORE_IMAGES__=()=>{imageResumes++};
 r.click(r.gallery().querySelector('[data-gallery-action="resume"]'));await r.flush();
 assert.equal(cardResumes,pauseStage==='cards'?1:0);
 assert.equal(imageResumes,pauseStage==='core-images'?1:0);
 assert.deepEqual(r.snapshots(),before,'choosing a resume handler leaves stored progress unchanged');
 assert.equal(r.counts.network,0,'generic resume never prepares or requests gallery participants');
});
