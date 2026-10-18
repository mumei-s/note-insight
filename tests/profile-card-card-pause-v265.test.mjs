import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync('public/note-profile-card-paster-core-v232.js','utf8');
function runtime(count=3){
 const page={addEventListener(){},dispatchEvent(){}},document={readyState:'loading',addEventListener(){},getElementById:()=>null};
 const c=vm.createContext({unsafeWindow:page,window:page,document,location:new URL('https://editor.note.com/notes/n123456789abc/edit'),localStorage:{getItem:()=>null,setItem(){},removeItem(){}},GM_getValue:()=>null,URL,Event,setTimeout,clearTimeout});
 const entry="if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();";
 vm.runInContext(source.replace('const sleep=','let sleep=').replace(entry,'globalThis.api={patch:code=>eval(code),createCardsAtTap,pauseCards,stop,update};'),c);
 c.saved={stage:'images_ready',rows:Array.from({length:count},(_,index)=>({url:'https://note.com/person'+index+'/n/n'+String(index+1).repeat(12),creator:'person'+index})),cardKeys:[],cardAnchorPos:null};
 c.cards=[];c.calls=[];c.statuses=[];c.saves=[];c.flushes=[];c.aborts=0;
 page.__MUMEI_PROFILE_CARD_RUN_STORE__={hydrate:async()=>{},flush:async()=>{c.flushes.push({cards:c.saved.cardKeys.length,paused:c.saved.paused===true})}};
 c.api.patch(`readRun=()=>saved;writeRun=value=>saved=value;findView=()=>({state:{doc:{content:{size:100}}}});cardAnchorFromSelection=()=>10;cardAnchor=(run,pos)=>pos;reconcileCompletedCards=async(view,run)=>run;assertUniqueGeneratedCards=()=>{};resolveOwnedImageHits=()=>saved.rows.map(()=>({}));resolveOwnedCardHits=()=>cards;genuineCard=(hit,url)=>hit.url===url;sleep=async()=>{};setStatus=(text,bad)=>statuses.push({text,bad});saveOnce=async text=>saves.push(text);abortActiveRequests=()=>{aborts++};createNativeCard=async(view,row,pos)=>{calls.push(row.url);await new Promise(resolve=>{globalThis.finishCard=resolve});const hit={url:row.url,pos,node:{nodeSize:1}};cards.push(hit);writeRun({...saved,cardKeys:[...saved.cardKeys,{url:row.url,key:'key-'+calls.length}],pendingCard:null});return{nextPos:pos+1}};`);
 return c;
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));

test('pause completes and saves the in-flight card, then resume sends each remaining card exactly once',async()=>{
 const c=runtime(),originalRows=JSON.parse(JSON.stringify(c.saved.rows));
 const creating=c.api.createCardsAtTap();await tick();assert.equal(c.calls.length,1);
 assert.equal(c.window.__MUMEI_PROFILE_CARD_PAUSE__(),true);assert.equal(c.aborts,0);
 await tick();assert.equal(c.calls.length,1);assert.equal(c.saved.paused,false);assert.equal(c.saves.length,0);
 c.finishCard();await creating;
 assert.equal(c.saved.stage,'cards_building');assert.equal(c.saved.paused,true);assert.equal(c.saved.pauseStage,'cards');
 assert.equal(c.saved.cardKeys.length,1);assert.equal(c.cards[0].pos,10);assert.equal(c.saves.length,1);
 assert.match(c.statuses.at(-1).text,/一時停止中.*1\/3/);assert.equal(c.window.__MUMEI_PROFILE_CARD_CORE_BUSY__(),false);
 const resuming=c.api.createCardsAtTap();await tick();assert.equal(c.calls.length,2);assert.equal(c.saved.paused,false);
 c.finishCard();await tick();assert.equal(c.calls.length,3);c.finishCard();await resuming;
 assert.equal(c.saved.stage,'complete');assert.equal(c.saved.paused,false);assert.equal(c.saved.pauseStage,null);
 assert.deepEqual(c.calls,originalRows.map(row=>row.url));assert.deepEqual(c.cards.map(hit=>hit.pos),[10,11,12]);
 assert.deepEqual(JSON.parse(JSON.stringify(c.saved.rows)),originalRows);assert.equal(c.aborts,0);
});

test('a pause while hydrating saves a zero-card checkpoint before any native conversion',async()=>{
 const c=runtime();c.window.__MUMEI_PROFILE_CARD_RUN_STORE__.hydrate=()=>new Promise(resolve=>{c.finishHydration=resolve});
 const creating=c.api.createCardsAtTap();assert.equal(c.api.pauseCards(),true);c.finishHydration();await creating;
 assert.equal(c.calls.length,0);assert.equal(c.saved.paused,true);assert.equal(c.saved.cardKeys.length,0);
 assert.equal(c.saves.length,1);assert.match(c.statuses.at(-1).text,/0\/3/);
});

test('finishing the final in-flight card completes the batch instead of leaving a false paused state',async()=>{
 const c=runtime(1),creating=c.api.createCardsAtTap();await tick();c.api.pauseCards();c.finishCard();await creating;
 assert.equal(c.saved.stage,'complete');assert.equal(c.saved.paused,false);assert.equal(c.saved.cardKeys.length,1);
 assert.match(c.statuses.at(-1).text,/完了/);assert.equal(c.api.pauseCards(),false);
});

test('explicit stop takes precedence over a requested pause and prevents another card',async()=>{
 const c=runtime(),creating=c.api.createCardsAtTap();await tick();c.api.pauseCards();c.api.stop();c.finishCard();await creating;
 assert.equal(c.calls.length,1);assert.equal(c.saved.cardKeys.length,1);assert.equal(c.aborts,1);
 assert.match(c.statuses.at(-1).text,/通知カード停止：手動停止/);assert.equal(c.saves.length,0);
});

test('the pause control stays usable while card actions are busy',async()=>{
 const c=runtime(),pause={dataset:{galleryAction:'pause'},disabled:false},cards={dataset:{galleryAction:'cards'},disabled:false,matches:()=>false};
 c.document.getElementById=()=>({querySelectorAll:()=>[pause,cards]});
 const creating=c.api.createCardsAtTap();await tick();assert.equal(pause.disabled,false);assert.equal(cards.disabled,true);
 c.api.pauseCards();c.finishCard();await creating;assert.equal(cards.disabled,false);
});
