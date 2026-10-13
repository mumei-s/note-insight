import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync('public/note-profile-card-paster-v22.user.js','utf8');
const PREP_KEY='mumei_profile_like300_fix_v230:n123456789abc';
const assetFailure=()=>Object.assign(Error('アイコンを表示できません（通信失敗）'),{code:'ASSET_UNAVAILABLE'});
function people(count){return Array.from({length:count},(_,index)=>({urlname:'person'+index,likerKey:'creator-key-'+index,creator:'人'+index,url:'https://note.com/person'+index+'/n/n'+index.toString(16).padStart(12,'0'),profileText:'本人の紹介',actorImageUrl:'https://assets.st-note.com/avatar'+index+'.png',thumbUrl:'https://assets.st-note.com/thumb'+index+'.png'}))}
function plan(candidates){return [...candidates.slice(0,300).map((person,index)=>({...person,index:index+1,designIndex:index%50})),{index:301,urlname:'fuku444',likerKey:'final-performance-math',creator:'実績の算数',finalMarker:true,url:'https://note.com/fuku444/n/nb4f6934381e9',designIndex:0}]}
function runtime(candidates,at=10){
 const values=new Map(),localStorage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)};
 const context=vm.createContext({window:{addEventListener(){},dispatchEvent(){},Event},document:{getElementById:()=>null},location:{hostname:'editor.note.com',href:'https://editor.note.com/notes/n123456789abc/edit',pathname:'/notes/n123456789abc/edit'},localStorage,GM_getValue:()=>({at,people:candidates}),GM_xmlhttpRequest(){throw Error('unexpected network')},unsafeWindow:{},setTimeout,clearTimeout,setInterval:()=>1,clearInterval(){},URL,console});
 const exposed=source.replace('const sleep=','let sleep=').replace(/let attempts=0;[\s\S]*?\n\}\)\(\);\s*$/,`globalThis.api={patch:code=>eval(code),replaceUnavailableCreator};})();`);
 vm.runInContext(exposed,context);context.calls=[];
 context.api.patch(`preparePerson=async person=>{calls.push(person.urlname);return person};sleep=async()=>{};readRun=()=>{throw Error('must not read or mutate the current run')};writeRun=()=>{throw Error('must not alter the current run')};`);
 return context;
}
function save(c,rows,signature='10|300|eligible-v251'){c.localStorage.setItem(PREP_KEY,JSON.stringify({signature,index:300,rows:rows.slice(0,300),skipped:[],updatedAt:123}))}

test('asset replacement preserves every already pasted creator and final while refilling from the saved candidate tail',async()=>{
 const candidates=people(305),rows=plan(candidates),c=runtime(candidates);save(c,rows);
 const refreshed=await c.api.replaceUnavailableCreator(rows,5,assetFailure());
 assert.equal(refreshed.length,301);assert.deepEqual(Array.from(refreshed.slice(0,5)),rows.slice(0,5));
 for(let index=0;index<5;index++)assert.equal(refreshed[index],rows[index]);
 assert.equal(refreshed[5].urlname,'person6');assert.equal(refreshed[299].urlname,'person300');assert.deepEqual(JSON.parse(JSON.stringify(refreshed[300])),rows[300]);
 assert.deepEqual(Array.from(c.calls),['person300']);
 const saved=JSON.parse(c.localStorage.getItem(PREP_KEY));assert.equal(saved.index,301);assert.equal(saved.rows.length,300);assert.equal(saved.skipped[0].urlname,'person5');assert.match(saved.skipped[0].reason,/アイコン/);
});

test('two unavailable images are replaced without duplicate creators or changing the current pasted prefix',async()=>{
 const candidates=people(307),original=plan(candidates),c=runtime(candidates);save(c,original);
 const first=await c.api.replaceUnavailableCreator(original,5,assetFailure());
 const second=await c.api.replaceUnavailableCreator(first,7,assetFailure());
 assert.deepEqual(Array.from(second.slice(0,7)),Array.from(first.slice(0,7)));assert.equal(new Set(second.slice(0,300).map(row=>row.likerKey)).size,300);
 assert.ok(!second.some(row=>row.urlname==='person5'||row.urlname==='person8'));assert.equal(second[299].urlname,'person301');assert.ok(second[300].finalMarker);
 const saved=JSON.parse(c.localStorage.getItem(PREP_KEY));assert.equal(saved.index,302);assert.deepEqual(saved.skipped.map(row=>row.urlname),['person5','person8']);
});

test('replacement migrates an exact-v250 checkpoint while preserving previous successful metadata',async()=>{
 const candidates=people(305),rows=plan(candidates),c=runtime(candidates);save(c,rows,'10|300|exact-v250');
 const refreshed=await c.api.replaceUnavailableCreator(rows,12,assetFailure()),saved=JSON.parse(c.localStorage.getItem(PREP_KEY));
 assert.equal(saved.signature,'10|300|eligible-v251');assert.equal(saved.index,301);assert.deepEqual(Array.from(refreshed.slice(0,12)),rows.slice(0,12));assert.equal(refreshed[299].urlname,'person300');
});

test('a missing preparation checkpoint is reconstructed only from the same ordered saved creator plan and bridge',async()=>{
 const candidates=people(305),rows=plan(candidates),c=runtime(candidates);
 const refreshed=await c.api.replaceUnavailableCreator(rows,4,assetFailure());
 assert.deepEqual(Array.from(refreshed.slice(0,4)),rows.slice(0,4));assert.deepEqual(Array.from(c.calls),['person300']);
 const saved=JSON.parse(c.localStorage.getItem(PREP_KEY));assert.equal(saved.index,301);assert.equal(saved.skipped[0].urlname,'person4');
 const unrelated=runtime(people(305).reverse());
 await assert.rejects(unrelated.api.replaceUnavailableCreator(rows,4,assetFailure()),/追加候補/);assert.equal(unrelated.localStorage.getItem(PREP_KEY),null);
});

test('candidate exhaustion never returns a fake 300-creator plan and keeps the original pasted plan intact',async()=>{
 const candidates=people(300),rows=plan(candidates),before=structuredClone(rows),c=runtime(candidates);save(c,rows);
 await assert.rejects(c.api.replaceUnavailableCreator(rows,5,assetFailure()),/299\/300人/);
 assert.deepEqual(rows,before);const saved=JSON.parse(c.localStorage.getItem(PREP_KEY));assert.equal(saved.rows.length,299);assert.equal(saved.skipped.length,1);
 await assert.rejects(c.api.replaceUnavailableCreator(rows,5,assetFailure()),/299\/300人/);assert.equal(JSON.parse(c.localStorage.getItem(PREP_KEY)).skipped.length,1);
});

test('retrying the same failure after a filled checkpoint reuses the replacement and does not skip an extra creator',async()=>{
 const candidates=people(305),rows=plan(candidates),c=runtime(candidates);save(c,rows);
 const first=await c.api.replaceUnavailableCreator(rows,5,assetFailure());
 const retry=await c.api.replaceUnavailableCreator(rows,5,assetFailure());
 assert.deepEqual(Array.from(retry,row=>row.urlname),Array.from(first,row=>row.urlname));assert.deepEqual(Array.from(retry.slice(0,5)),rows.slice(0,5));assert.deepEqual(Array.from(c.calls),['person300']);
 const saved=JSON.parse(c.localStorage.getItem(PREP_KEY));assert.equal(saved.index,301);assert.equal(saved.skipped.length,1);
});

test('only unpasted conflicting designs are repaired and the refreshed plan has no adjacent repeated style',async()=>{
 const candidates=people(305),rows=plan(candidates),c=runtime(candidates);rows[6].designIndex=rows[4].designIndex;save(c,rows);
 const refreshed=await c.api.replaceUnavailableCreator(rows,5,assetFailure());
 assert.deepEqual(Array.from(refreshed.slice(0,5)),rows.slice(0,5));assert.notEqual(refreshed[5].designIndex,rows[6].designIndex);
 for(let index=6;index<299;index++)assert.equal(refreshed[index].designIndex,rows[index+1].designIndex);
 assert.ok(refreshed.every((row,index)=>index===0||row.designIndex!==refreshed[index-1].designIndex));assert.equal(refreshed[300].designIndex,rows[300].designIndex);
});

test('manual stop and the final extra article cannot be silently excluded',async()=>{
 const candidates=people(305),rows=plan(candidates),c=runtime(candidates);save(c,rows);const before=c.localStorage.getItem(PREP_KEY);
 await assert.rejects(c.api.replaceUnavailableCreator(rows,5,Error('停止しました')),/停止しました/);
 await assert.rejects(c.api.replaceUnavailableCreator(rows,300,assetFailure()),/実績の算数/);assert.equal(c.localStorage.getItem(PREP_KEY),before);
});
