import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync('public/note-profile-card-paster-core-v232.js','utf8');
function runtime({result={result:true},reject=null,native=true}={}){
 const run={articleKey:'n123456789abc',stage:'cards_building',rows:[{url:'https://note.com/sample/n/nabcdef123456'}],items:[{id:'image-1'}],cardKeys:[{key:'emb1'}],draftSaveState:'pending'};
 const state={run,calls:0,created:0,clicked:0,status:[],writes:[],flushes:0};
 const button={textContent:'下書き保存',disabled:false,isConnected:true,getClientRects:()=>[{}],closest:s=>s==='header,[role="banner"]'?{}:null,hasAttribute:()=>false,getAttribute:()=>null,setAttribute(){},removeAttribute(){},click(){state.clicked++}};
 const page={addEventListener(){},dispatchEvent(){},__MUMEI_PROFILE_CARD_RUN_STORE__:{read:()=>state.run,write:value=>{state.run=value;state.writes.push(value)},async flush(){state.flushes++}}};
 if(native)page.noteEditor={registerNoteDraft(){state.calls++;assert.equal(state.run.draftSaveState,'pending');if(reject)return Promise.reject(reject);return Promise.resolve(result)}};
 const document={readyState:'loading',addEventListener(){},getElementById:()=>null,querySelectorAll:s=>s==='button'?[button]:[]};
 const c=vm.createContext({unsafeWindow:page,window:page,document,location:new URL('https://editor.note.com/notes/n123456789abc/edit'),localStorage:{getItem:()=>null,setItem(){},removeItem(){}},GM_getValue:()=>null,URL,Event,setTimeout,clearTimeout,state,view:{}});
 const entry="if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();";
 vm.runInContext(source.replace('const sleep=','let sleep=').replace(entry,'globalThis.api={patch:code=>eval(code),saveOnce,saveCompletedCards,createCardsAtTap};'),c);
 c.api.patch('setStatus=(text)=>state.status.push(text);sleep=async()=>{};update=()=>{};actionBlocked=()=>false;findView=()=>view;cardAnchorFromSelection=()=>0;resolveOwnedImageHits=()=>state.run.items;resolveOwnedCardHits=()=>state.run.cardKeys;genuineCard=()=>true;reconcileCompletedCards=async(v,r)=>r;createNativeCard=async()=>{state.created++;throw Error("must not rebuild an existing card")};');
 return {state,page,api:c.api};
}

test('structured native save failure is not a successful save and retains checkpoint data',async()=>{
 const {api,state}=runtime({result:{result:false}});
 await assert.rejects(api.saveOnce(),/保存に失敗/);
 assert.equal(state.calls,1);assert.equal(state.clicked,0);
 assert.equal(state.run.draftSaveState,'pending');assert.match(state.run.draftSaveError,/保存に失敗/);
 assert.equal(state.run.items[0].id,'image-1');assert.equal(state.run.cardKeys[0].key,'emb1');
});

test('failed final save never commits complete and can be retried without rebuilding',async()=>{
 const r=runtime({result:{result:false}});
 await assert.rejects(r.api.saveCompletedCards(1,'save'),/保存に失敗/);
 assert.equal(r.state.run.stage,'cards_building');assert.equal(r.state.run.draftSaveState,'pending');
 r.page.noteEditor.registerNoteDraft=()=>{r.state.calls++;return Promise.resolve({result:true})};
 await r.api.createCardsAtTap();
 assert.equal(r.state.calls,2);assert.equal(r.state.created,0);assert.equal(r.state.run.stage,'complete');assert.equal(r.state.run.draftSaveState,'confirmed');
});

test('unconfirmed native UI save remains pending without a false completion status',async()=>{
 const {api,state}=runtime({native:false});
 const saved=await api.saveCompletedCards(1,'save');
 assert.equal(saved.confirmed,false);assert.equal(state.clicked,1);
 assert.equal(state.run.stage,'cards_building');assert.equal(state.run.draftSaveState,'pending');
 assert.ok(state.status.at(-1).includes('未確認'));assert.ok(!state.status.at(-1).includes('✅'));
});

test('already-built pending cards explicitly retry saving once without creating cards',async()=>{
 const {api,state}=runtime();await api.createCardsAtTap();
 assert.equal(state.calls,1);assert.equal(state.created,0);assert.equal(state.run.stage,'complete');
});

test('legacy completed runs explicitly confirm saving without rebuilding cards or changing rows',async()=>{
 const {api,state}=runtime();state.run.stage='complete';delete state.run.draftSaveState;
 const originalRows=JSON.stringify(state.run.rows),originalItems=JSON.stringify(state.run.items),originalCards=JSON.stringify(state.run.cardKeys);
 await api.createCardsAtTap();
 assert.equal(state.calls,1);assert.equal(state.created,0);assert.equal(state.run.stage,'complete');assert.equal(state.run.draftSaveState,'confirmed');
 assert.equal(JSON.stringify(state.run.rows),originalRows);assert.equal(JSON.stringify(state.run.items),originalItems);assert.equal(JSON.stringify(state.run.cardKeys),originalCards);
 await api.createCardsAtTap();
 assert.equal(state.calls,1);assert.equal(state.created,0);
});

test('rejected save is kept pending and is not replaced with another UI click',async()=>{
 const {api,state}=runtime({reject:Error('HTTP 403')});
 await assert.rejects(api.saveCompletedCards(1,'save'),/HTTP 403/);
 assert.equal(state.calls,1);assert.equal(state.clicked,0);assert.equal(state.run.stage,'cards_building');assert.equal(state.run.draftSaveState,'pending');
});

test('standalone sources preserve the same pending-save implementation after rebuilding',()=>{
 for(const path of ['public/note-profile-card-paster-v1.user.js','public/note-profile-card-likes300-fix-v220.user.js']){
  const built=readFileSync(path,'utf8');
  assert.ok(built.includes('saved===false||saved?.result===false'));
  assert.ok(built.includes("draftSaveState:'pending'"));
  assert.ok(built.includes('async function saveCompletedCards(total,label)'));
 }
});
