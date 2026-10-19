import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync('public/note-profile-card-paster-core-v232.js','utf8');
function button({text='下書き保存',header=true,excluded=false,type=null,formaction=false}={}){
 const attrs=new Map();if(type!=null)attrs.set('type',type);if(formaction)attrs.set('formaction','/home');
 return {textContent:text,disabled:false,isConnected:true,clicks:0,clickTypes:[],getClientRects:()=>[{}],
  closest:selector=>selector==='header,[role="banner"]'?(header?{}:null):(excluded?{}:null),
  getAttribute:key=>attrs.get(key)??null,hasAttribute:key=>attrs.has(key),setAttribute:(key,value)=>attrs.set(key,value),removeAttribute:key=>attrs.delete(key),
  click(){this.clicks++;this.clickTypes.push(this.getAttribute('type'));this.onClick?.()}
 };
}
function runtime(buttons=[]){
 const page={addEventListener(){},dispatchEvent(){}},notices=[];
 const document={readyState:'loading',addEventListener(){},getElementById:()=>null,querySelectorAll:selector=>selector==='button'?buttons:notices};
 const c=vm.createContext({unsafeWindow:page,window:page,document,location:new URL('https://editor.note.com/notes/n123456789abc/edit'),localStorage:{getItem:()=>null,setItem(){},removeItem(){}},GM_getValue:()=>null,URL,Event,setTimeout,clearTimeout});
 const entry="if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();";
 vm.runInContext(source.replace('const sleep=','let sleep=').replace(entry,'globalThis.api={patch:code=>eval(code),saveOnce,nativeDraftSaveButton};'),c);
 c.waits=[];c.onSleep=()=>{};c.api.patch('setStatus=()=>{};sleep=async ms=>{waits.push(ms);onSleep(ms)}');
 return {c,page,api:c.api,notices};
}

test('native draft save selects only the unique visible header control and prevents form submission',async()=>{
 const home=button({text:'ホーム'}),tool=button({excluded:true}),body=button({header:false}),draft=button();
 const r=runtime([home,tool,body,draft]);draft.onClick=()=>{draft.disabled=true};r.c.onSleep=()=>{draft.disabled=false};
 assert.equal(await r.api.saveOnce(),true);
 assert.equal(draft.clicks,1);assert.deepEqual(draft.clickTypes,['button']);assert.equal(draft.getAttribute('type'),null);
 assert.equal(home.clicks+tool.clicks+body.clicks,0);assert.deepEqual(r.c.waits,[100]);
});

test('ambiguous, linked or explicit form-action controls never get clicked',async()=>{
 for(const controls of [[button(),button()],[button({excluded:true})],[button({formaction:true})]]){
  const r=runtime(controls);await assert.rejects(r.api.saveOnce(),/一意に確認/);
  assert.ok(controls.every(control=>control.clicks===0));
 }
});

test('a unique native save control works when the editor header uses ordinary div elements',async()=>{
 const draft=button({header:false}),r=runtime([draft]);draft.onClick=()=>{draft.disabled=true};r.c.onSleep=()=>{draft.disabled=false};
 assert.equal(await r.api.saveOnce(),true);assert.equal(draft.clicks,1);
});

test('an already exposed native draft method saves in place without clicking any control',async()=>{
 const draft=button(),r=runtime([draft]);let calls=0;
 r.page.noteEditor={registerNoteDraft(mode){calls++;assert.equal(mode,'manual');return Promise.resolve()}};
 assert.equal(await r.api.saveOnce(),true);assert.equal(calls,1);assert.equal(draft.clicks,0);assert.deepEqual(r.c.waits,[]);
});

test('a rejected native draft operation is not retried or replaced with a UI click',async()=>{
 const draft=button(),r=runtime([draft]);let calls=0;
 r.page.noteEditor={registerNoteDraft(){calls++;return Promise.reject(Error('HTTP 403'))}};
 await assert.rejects(r.api.saveOnce(),/HTTP 403/);assert.equal(calls,1);assert.equal(draft.clicks,0);
});

test('an unchanged native button returns an explicitly unconfirmed save after a short bounded wait',async()=>{
 const draft=button(),r=runtime([draft]);const result=await r.api.saveOnce();
 assert.equal(result.requested,true);assert.equal(result.confirmed,false);
 assert.equal(draft.clicks,1);assert.equal(r.c.waits.length,3);assert.ok(r.c.waits.every(ms=>ms===100));
});

test('an indefinitely busy native save returns unconfirmed without a second click',async()=>{
 const draft=button(),r=runtime([draft]);draft.onClick=()=>{draft.disabled=true};const result=await r.api.saveOnce();
 assert.equal(result.confirmed,false);assert.equal(draft.clicks,1);assert.equal(r.c.waits.length,50);
});

test('a fresh native saved notice confirms the operation without a fixed long wait',async()=>{
 const draft=button({type:'submit'}),r=runtime([draft]);
 draft.onClick=()=>r.notices.push({textContent:'下書きを保存しました',getClientRects:()=>[{}],closest:()=>null});
 assert.equal(await r.api.saveOnce(),true);assert.equal(draft.getAttribute('type'),'submit');assert.equal(r.c.waits.length,0);
});

test('a stale saved notice cannot confirm a new click and a changed article is not saved twice',async()=>{
 const draft=button(),r=runtime([draft]);r.notices.push({textContent:'保存しました',getClientRects:()=>[{}],closest:()=>null});
 r.c.onSleep=()=>{r.c.location.pathname='/notes/nabcdef123456/edit'};
 await assert.rejects(r.api.saveOnce(),/記事画面が変わりました/);assert.equal(draft.clicks,1);
});
