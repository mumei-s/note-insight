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
 assert.match(code,/@version\s+2\.9\.2\b/,'exercise the rebuilt publication, including its real startup and lifecycle code');
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
 assert.equal(gallery(),null,'removed Halloween controls must never be recreated');
 assert.ok(panel().querySelector('[data-a="resume"]'));assert.ok(panel().querySelector('[data-a="cards"]'));assert.ok(panel().querySelector('[data-presentation-size]'));
 return{w,panel,gallery,click,ready,flush,counts,snapshots};
}


test('a fresh panel defaults to 200 and the recent-200 preset preserves a saved run',async t=>{
 const fresh=await runtime(t,files[0],{saved:null});assert.equal(fresh.panel().querySelector('[data-count]').value,'200');
 const r=await runtime(t,files[1],{prefs:{mode:'all',count:12}}),before=r.snapshots();
 for(let i=0;i<4;i++)r.ready();await r.flush();
 assert.equal(r.panel().querySelectorAll('[data-a="like200-preset"]').length,1);r.click(r.panel().querySelector('[data-a="like200-preset"]'));await r.flush();
 assert.equal(r.panel().querySelector('[data-mode]').value,'number');assert.equal(r.panel().querySelector('[data-count]').value,'200');
 assert.deepEqual(r.snapshots(),before);assert.equal(r.counts.network,0);
});
for(const path of files)test('normal controls remain live after repeated close and expansion: '+path,async t=>{
 const r=await runtime(t,path),initial=r.panel();
 for(let i=0;i<4;i++){
  r.panel().querySelector('.body').scrollTop=300;r.click(r.panel().querySelector('[data-ui="tiny"]'));
  r.click(r.w.document.getElementById(PANEL+'-mini'));await r.flush();
  assert.equal(r.panel(),initial);assert.ok(!r.panel().classList.contains('tiny'));assert.equal(r.gallery(),null);
  assert.equal(r.panel().querySelector('.body').scrollTop,0);
  r.click(r.panel().querySelector('[data-ui="collapse"]'));r.click(r.panel().querySelector('[data-ui="collapse"]'));await r.flush();
  assert.ok(!r.panel().classList.contains('collapsed'));assert.equal(r.panel().querySelectorAll('[data-a="resume"]').length,1);
 }
});
test('replacing the panel, body or launcher restores exactly one normal panel and preserves progress',async t=>{
 const r=await runtime(t),before=r.snapshots();
 for(const target of ['panel','body','launcher']){
  if(target==='panel')r.panel().replaceWith(r.panel().cloneNode(true));
  else if(target==='body')r.panel().querySelector('.body').replaceWith(r.panel().querySelector('.body').cloneNode(true));
  else r.w.document.getElementById(PANEL+'-mini').remove();
  await r.flush();assert.equal(r.w.document.querySelectorAll('#'+PANEL).length,1);assert.equal(r.w.document.querySelectorAll('#'+PANEL+'-mini').length,1);
  assert.equal(r.gallery(),null);assert.equal(r.panel().querySelectorAll('[data-presentation-size]').length,1);
  let calls=0;r.w.__MUMEI_PROFILE_CARD_CREATE_CARDS_AT_TAP__=()=>{calls++};r.click(r.panel().querySelector('[data-a="cards"]'));assert.equal(calls,1);
 }
 assert.deepEqual(r.snapshots(),before);assert.equal(r.counts.network,0);
});
test('repeated ready events preserve focused unsaved source input and bind cards once',async t=>{
 const r=await runtime(t),field=r.panel().querySelector('[data-sources]');field.value='#料理 #旅行';field.focus();field.setSelectionRange(2,5);
 for(let i=0;i<12;i++)r.ready();await r.flush();
 assert.equal(r.panel().querySelector('[data-sources]'),field);assert.equal(r.w.document.activeElement,field);assert.equal(field.value,'#料理 #旅行');assert.equal(field.selectionStart,2);assert.equal(field.selectionEnd,5);
 let calls=0;r.w.__MUMEI_PROFILE_CARD_CREATE_CARDS_AT_TAP__=()=>{calls++};r.click(r.panel().querySelector('[data-a="cards"]'));assert.equal(calls,1);assert.equal(r.counts.network,0);
});
test('missing supplemental controls repair without replacing focused input or discarding live edits',async t=>{
 const r=await runtime(t),field=r.panel().querySelector('[data-sources]');field.value='#任意のタグ';field.focus();field.setSelectionRange(1,3);
 for(const selector of ['[data-a="resume"]','[data-a="cards"]','details[data-like300]']){
  r.panel().querySelector(selector).remove();r.ready();await r.flush();assert.ok(r.panel().querySelector(selector));
  assert.equal(r.panel().querySelector('[data-sources]'),field);assert.equal(r.w.document.activeElement,field);assert.equal(field.value,'#任意のタグ');assert.equal(field.selectionStart,1);assert.equal(field.selectionEnd,3);
 }
 assert.equal(r.gallery(),null);assert.equal(r.counts.network,0);
});
test('reopening a paused old batch changes no progress and performs no automatic restart or request',async t=>{
 const r=await runtime(t),before=r.snapshots();let starts=0;r.w.addEventListener('mumei-profile-card-start',()=>starts++);
 for(let i=0;i<3;i++){r.click(r.panel().querySelector('[data-ui="tiny"]'));r.click(r.w.document.getElementById(PANEL+'-mini'));r.ready();await r.flush()}
 assert.deepEqual(r.snapshots(),before);assert.equal(r.w.__MUMEI_PROFILE_CARD_RUN_STORE__.read().paused,true);assert.equal(starts,0);assert.equal(r.counts.network,0);assert.equal(r.counts.backupWrites,0);
});
for(const pauseStage of ['cards','core-images'])test('one normal resume selects the saved phase without preparing removed campaigns: '+pauseStage,async t=>{
 const saved={articleKey:ARTICLE,coreImageRun:true,gallery126:false,stage:pauseStage==='cards'?'cards_building':'images_building',paused:true,pauseStage,count:1,rows:[{index:1,creator:'Example',urlname:'example',url:'https://note.com/example/n/nabcdefabcdef'}],items:[],cardKeys:[],updatedAt:12345};
 const r=await runtime(t,files[0],{saved,prefs:{tiny:true}}),before=r.snapshots();let cards=0,images=0;
 r.w.__MUMEI_PROFILE_CARD_CREATE_CARDS_AT_TAP__=()=>{cards++};r.w.__MUMEI_PROFILE_CARD_RESUME_CORE_IMAGES__=()=>{images++};
 r.click(r.w.document.getElementById(PANEL+'-mini'));r.click(r.panel().querySelector('[data-a="resume"]'));await r.flush();
 assert.equal(cards,pauseStage==='cards'?1:0);assert.equal(images,pauseStage==='core-images'?1:0);assert.deepEqual(r.snapshots(),before);assert.equal(r.counts.network,0);
});
test('button taps preserve article selection and panel actions never trigger host navigation',async t=>{
 const r=await runtime(t);let host=0;r.w.document.addEventListener('click',()=>host++);
 const editor=r.w.document.getElementById('note-editor'),selection=r.w.getSelection(),range=r.w.document.createRange();editor.focus();range.setStart(editor.firstChild,2);range.setEnd(editor.firstChild,9);selection.removeAllRanges();selection.addRange(range);
 const down=new r.w.MouseEvent('mousedown',{bubbles:true,cancelable:true});r.panel().querySelector('[data-a="cards"]').dispatchEvent(down);
 assert.equal(down.defaultPrevented,true);assert.equal(selection.anchorOffset,2);assert.equal(selection.focusOffset,9);assert.equal(r.w.document.activeElement,editor);
 let pauses=0;r.w.__MUMEI_PROFILE_CARD_PAUSE__=()=>{pauses++;return true};r.click(r.panel().querySelector('[data-a="pause"]'));assert.equal(pauses,1);
 const details=r.panel().querySelector('details[data-like300]'),open=details.open;details.querySelector('summary').click();assert.equal(details.open,!open);
 r.click(r.panel().querySelector('[data-ui="collapse"]'));assert.equal(host,0);assert.equal(r.counts.network,0);
});
test('mobile pause accepts pointerdown and compatibility events invoke pause once',async t=>{
 const r=await runtime(t);let pauses=0;r.w.__MUMEI_PROFILE_CARD_PAUSE__=()=>{pauses++;return true};const button=r.panel().querySelector('[data-a="pause"]');
 button.dispatchEvent(new r.w.Event('pointerdown',{bubbles:true,cancelable:true}));button.dispatchEvent(new r.w.Event('touchstart',{bubbles:true,cancelable:true}));r.click(button);assert.equal(pauses,1);assert.equal(r.counts.network,0);
});
test('busy state keeps pause enabled, prevents new work and preserves saved settings',async t=>{
 const r=await runtime(t),before=r.snapshots();r.w.__MUMEI_PROFILE_CARD_FIXED_BUSY__=()=>true;r.w.__MUMEI_PROFILE_CARD_REFRESH_UI__();
 assert.equal(r.panel().querySelector('[data-a="pause"]').disabled,false);assert.equal(r.panel().querySelector('[data-a="images"]').disabled,true);assert.equal(r.panel().querySelector('[data-sources]').disabled,true);
 assert.deepEqual(r.snapshots(),before);assert.equal(r.counts.network,0);
});
test('all actions use non-submit buttons and notification-only delete dispatches once',async t=>{
 const r=await runtime(t),before=r.snapshots();for(const button of r.panel().querySelectorAll('button'))assert.equal(button.type,'button',button.outerHTML);
 assert.equal(r.w.document.getElementById(PANEL+'-mini').type,'button');let deletes=0;r.w.__MUMEI_PROFILE_CARD_DELETE_CARDS__=()=>{deletes++};r.click(r.panel().querySelector('[data-a="delete"]'));assert.equal(deletes,1);
 assert.match(r.panel().querySelector('[data-a="reset"]').textContent,/今回分を全削除/);assert.deepEqual(r.snapshots(),before);assert.equal(r.counts.network,0);
});
