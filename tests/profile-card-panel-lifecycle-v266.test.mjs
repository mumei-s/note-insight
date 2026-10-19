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
 assert.match(code,/@version\s+2\.6\.6\b/,'exercise the rebuilt publication, including its real startup and lifecycle code');
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
 const r=await runtime(t,files[0],{saved:{...pausedRun,pauseStage:'cards'},prefs:{tiny:true,collapsed:false}}),before=r.snapshots();
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
