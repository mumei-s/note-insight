import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync('public/note-profile-card-paster-core-v232.js','utf8');
function runtime({count=3,createMs=100,checkpointMs=50,pauseAfterCard=0,failAfterCard=0}={}){
 const rows=Array.from({length:count},(_,i)=>({creator:'架空'+i,url:'https://note.com/sample/n/n'+i.toString(16).padStart(12,'0')}));
 const state={now:0,delays:[],starts:[],status:[],saved:0,finalSaved:0,run:{articleKey:'n123456789abc',stage:'images_ready',rows,items:rows.map((_,i)=>({id:'img'+i})),cardKeys:[],cardAnchorPos:0},checkpointMs,createMs,pauseAfterCard,failAfterCard};
 const page={addEventListener(){},dispatchEvent(){},__MUMEI_PROFILE_CARD_RUN_STORE__:{read:()=>state.run,write:run=>{state.run=run},async flush(){state.now+=checkpointMs}}};
 const document={readyState:'loading',addEventListener(){},getElementById:()=>null};
 const Clock=class extends Date{static now(){return state.now}};
 const c=vm.createContext({unsafeWindow:page,window:page,document,location:new URL('https://editor.note.com/notes/n123456789abc/edit'),localStorage:{getItem:()=>null,setItem(){},removeItem(){}},GM_getValue:()=>null,URL,Event,setTimeout,clearTimeout,Date:Clock,state,view:{state:{doc:{content:{size:1000}}}}});
 const entry="if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();";
 vm.runInContext(source.replace('const sleep=','let sleep=').replace(entry,'globalThis.api={patch:code=>eval(code),createCardsAtTap};'),c);
 c.api.patch(`
 setStatus=text=>state.status.push(text);update=()=>{};actionBlocked=()=>false;
 sleep=async ms=>{state.delays.push(ms);state.now+=ms};
 findView=()=>view;cardAnchorFromSelection=()=>0;cardAnchor=(run,pos)=>pos;
 resolveOwnedImageHits=()=>state.run.items;resolveOwnedCardHits=()=>state.run.cardKeys;
 genuineCard=()=>true;reconcileCompletedCards=async(v,r)=>r;assertUniqueGeneratedCards=()=>{};
 createNativeCard=async(v,row,pos)=>{
  state.starts.push(state.now);state.now+=state.createMs;
  if(state.failAfterCard===state.starts.length)throw Error('native card failure');
  state.run={...state.run,cardKeys:[...state.run.cardKeys,{pos,node:{nodeSize:1},url:row.url}]};
  if(state.pauseAfterCard===state.starts.length)cardPauseRequested=true;
  return{nextPos:pos+1};
 };
 saveOnce=async()=>{state.saved++;return true};
 saveCompletedCards=async()=>{state.finalSaved++;return true};
 `);
 return{state,api:c.api};
}

test('fast verified cards use the shorter 600ms minimum including checkpoint time',async()=>{
 const {state,api}=runtime();await api.createCardsAtTap();
 assert.deepEqual(state.starts,[50,650,1250]);
 assert.deepEqual(state.delays,[450,450]);
 assert.equal(state.finalSaved,1);assert.equal(state.run.cardKeys.length,3);
});

test('slow verified cards do not add a redundant 600ms wait',async()=>{
 const {state,api}=runtime({createMs:900});await api.createCardsAtTap();
 assert.deepEqual(state.starts,[50,1000,1950]);assert.deepEqual(state.delays,[]);
 assert.equal(state.finalSaved,1);
});

test('the last verified card has no trailing pacing idle',async()=>{
 const {state,api}=runtime({count:1});await api.createCardsAtTap();
 assert.deepEqual(state.delays,[]);assert.equal(state.now,200);
 assert.equal(state.finalSaved,1);
});

test('the ten-card 2500ms throttle is preserved in addition to minimum pacing',async()=>{
 const {state,api}=runtime({count:11});await api.createCardsAtTap();
 assert.deepEqual(state.delays,[...Array(10).fill(450),2500]);
 assert.equal(state.starts[10]-state.starts[9],3100);
 assert.equal(state.finalSaved,1);assert.equal(state.run.cardKeys.length,11);
});

test('a requested boundary pause saves the verified card before pacing or another insertion',async()=>{
 const {state,api}=runtime({pauseAfterCard:1});await api.createCardsAtTap();
 assert.equal(state.starts.length,1);assert.equal(state.run.cardKeys.length,1);
 assert.equal(state.run.paused,true);assert.equal(state.saved,1);
 assert.equal(state.finalSaved,0);assert.deepEqual(state.delays,[]);
});

test('native card failure still stops before pacing and final save',async()=>{
 const {state,api}=runtime({failAfterCard:1});await api.createCardsAtTap();
 assert.equal(state.starts.length,1);assert.equal(state.run.cardKeys.length,0);
 assert.equal(state.finalSaved,0);assert.deepEqual(state.delays,[]);
 assert.match(state.status.at(-1),/native card failure/);
});
