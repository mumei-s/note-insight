import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const code=ts.transpileModule(fs.readFileSync('src/insight-persistent-cache.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function fixture(options={}){
 const records=new Map(), timers=new Map(),opens=[];let next=0,closed=0;
 const indexedDB={open(){const req={};opens.push(req);queueMicrotask(()=>{
  if(options.openHang)return;if(options.blocked){req.onblocked?.();return}
  req.result={close(){closed++},transaction(_name,mode){
   if(options.throwTransaction)throw Error('transaction');
   const tx={abort(){tx.onabort?.()}},ops=[];let scheduled=false;
   const schedule=(request,result)=>{if(scheduled)return;scheduled=true;queueMicrotask(()=>{
    if(options.txHang)return;request.result=result;request.onsuccess?.();
    if(options.abort){tx.onabort?.();return}for(const op of ops)op();tx.oncomplete?.();
   })};
   tx.objectStore=()=>({get(key){const req={};schedule(req,records.get(key));return req},put(row){const req={};ops.push(()=>records.set(row.key,row));schedule(req,row.key);return req},delete(key){const req={};ops.push(()=>records.delete(key));schedule(req,undefined);return req}});return tx;
  }};req.onsuccess?.();});return req}};
 const context={exports:{},indexedDB,Map,Promise,Date,setTimeout(fn){const id=++next;timers.set(id,fn);return id},clearTimeout(id){timers.delete(id)}};vm.runInNewContext(code,context);
 return{api:context.exports,records,opens,options,timers,get closed(){return closed},flush(){for(const [id,fn]of [...timers]){timers.delete(id);fn()}}};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('snapshot commit survives reopening, explicit remove follows earlier writes',async()=>{const f=fixture();const a=f.api.writeInsightSnapshot('accountA',{rows:[1]});const b=f.api.writeInsightSnapshot('accountA',{rows:[2]});const c=f.api.removeInsightSnapshot('accountA');await Promise.all([a,b,c]);assert.equal(await f.api.readInsightSnapshot('accountA'),null);await f.api.writeInsightSnapshot('accountB',{rows:[3]});assert.deepEqual(JSON.parse(JSON.stringify(await f.api.readInsightSnapshot('accountB'))),{rows:[3]});assert.equal(f.timers.size,0);assert.equal(f.closed,f.opens.length)});
test('request success followed by transaction abort does not publish uncommitted snapshot',async()=>{const f=fixture({abort:true});f.records.set('A',{key:'A',value:'stale'});assert.equal(await f.api.readInsightSnapshot('A'),null);assert.equal(f.closed,1);assert.equal(f.timers.size,0)});
test('blocked opening resolves optional cache and late connection closes',async()=>{const f=fixture({blocked:true});assert.equal(await f.api.readInsightSnapshot('A'),null);let lateClosed=0;f.opens[0].result={close(){lateClosed++}};f.opens[0].onsuccess();assert.equal(lateClosed,1);f.options.blocked=false;await f.api.writeInsightSnapshot('A','new');assert.equal(await f.api.readInsightSnapshot('A'),'new')});
test('hung opening is bounded and next attempt can recover',async()=>{const f=fixture({openHang:true});const read=f.api.readInsightSnapshot('A');await tick();f.flush();assert.equal(await read,null);f.options.openHang=false;await f.api.writeInsightSnapshot('A','new');assert.equal(await f.api.readInsightSnapshot('A'),'new')});
test('hung transaction aborts, closes and releases same-key queue',async()=>{const f=fixture({txHang:true});const write=f.api.writeInsightSnapshot('A','uncommitted');await tick();f.flush();await write;assert.equal(f.closed,1);assert.equal(f.records.has('A'),false);f.options.txHang=false;await f.api.writeInsightSnapshot('A','valid');assert.equal(await f.api.readInsightSnapshot('A'),'valid')});
test('transaction creation failure still closes database',async()=>{const f=fixture({throwTransaction:true});assert.equal(await f.api.readInsightSnapshot('A'),null);assert.equal(f.closed,1)});
test('unavailable IndexedDB and empty keys remain optional without opening',async()=>{const f=fixture();assert.equal(await f.api.readInsightSnapshot(''),null);assert.equal(f.opens.length,0);const context={exports:{},Map,Promise,Date,setTimeout,clearTimeout};vm.runInNewContext(code,context);assert.equal(await context.exports.readInsightSnapshot('A'),null)});
