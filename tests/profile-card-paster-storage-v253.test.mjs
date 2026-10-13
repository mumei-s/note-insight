import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../public/note-profile-card-paster-v22.user.js',import.meta.url),'utf8');
const ARTICLE='n123456789abc';
const RUN_KEY='mumei_profile_card_paster_run_v15:'+ARTICLE;
const PREP_KEY='mumei_profile_like300_fix_v230:'+ARTICLE;
const RUN_BACKUP='mumei_profile_card_run_backup_v253:'+ARTICLE;
const PREP_BACKUP='mumei_profile_card_prep_backup_v253:'+ARTICLE;
const clone=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
function fixedRun(){
 const rows=Array.from({length:300},(_,index)=>({index:index+1,urlname:'person'+index,likerKey:'key-'+index,creator:'人'+index,url:'https://note.com/person'+index+'/n/n'+index.toString(16).padStart(12,'0'),profileText:'プロフィールの全文'+index}));
 rows.push({index:301,urlname:'fuku444',creator:'実績の算数',likerKey:'final-performance-math',url:'https://note.com/fuku444/n/nb4f6934381e9',finalMarker:true});
 return{version:'2.5.3',articleKey:ARTICLE,likesHistoryFix230:true,rows,items:[],stage:'images_building',imageAnchorPos:0,updatedAt:1};
}
function preparation(){return{signature:'7|300|eligible-v251',index:300,rows:fixedRun().rows.slice(0,300),skipped:[],updatedAt:1}}
function runtime(options={}){
 const local=options.local||new Map(),gm=options.gm||new Map(),writes=[];
 const localStorage={getItem:key=>local.get(key)??null,setItem(key,value){if(options.quota&&String(value).length>500)throw Object.assign(Error('Local quota exceeded'),{name:'QuotaExceededError'});local.set(key,String(value))},removeItem(key){if(options.removeFailure)throw Error('Local removal unavailable');local.delete(key)}};
 const window={addEventListener(){},dispatchEvent(){return true},Event};
 const get=options.get||((key,fallback)=>clone(gm.has(key)?gm.get(key):fallback));
 const set=options.set||((key,value)=>{writes.push({key,value:clone(value)});gm.set(key,clone(value))});
 const c=vm.createContext({window,unsafeWindow:options.page||{},document:{getElementById:()=>null},location:{hostname:'editor.note.com',href:'https://editor.note.com/notes/'+ARTICLE+'/edit',pathname:'/notes/'+ARTICLE+'/edit'},localStorage,GM_getValue:get,GM_setValue:set,GM_xmlhttpRequest(){throw Error('Unexpected network')},setTimeout,clearTimeout,setInterval:()=>1,clearInterval(){},URL,console});
 const exposed=source.replace(/let attempts=0;[\s\S]*?\n\}\)\(\);\s*$/,`globalThis.api={patch:code=>eval(code),readRun,writeRun,recordImage,hydrateRunBackup,flushRunBackup,readPrep,writePrep,hydratePrepBackup,flushPrepBackup};})();`);
 assert.notEqual(exposed,source,'storage regression harness must replace the actual bootstrap');
 vm.runInContext(exposed,c);c.local=local;c.gm=gm;c.writes=writes;return c;
}

test('a local quota failure cannot turn a complete fixed run into a partial legacy record',async()=>{
 const c=runtime({quota:true});await c.api.hydrateRunBackup();
 c.api.writeRun(fixedRun());
 assert.equal(c.api.readRun().likesHistoryFix230,true);assert.equal(c.api.readRun().rows.length,301);
 c.api.recordImage({node:{attrs:{id:'actual-owned',src:'https://assets.st-note.com/owned.png'}}},c.api.readRun().rows[0]);
 const cached=c.api.readRun();
 assert.equal(cached.likesHistoryFix230,true);assert.equal(cached.rows.length,301);assert.equal(cached.items.length,1);
 await c.api.flushRunBackup();
 const backup=c.gm.get(RUN_BACKUP);
 assert.equal(backup.deleted,false);assert.equal(backup.value.likesHistoryFix230,true);assert.equal(backup.value.rows.length,301);assert.equal(backup.value.items[0].id,'actual-owned');
 assert.ok(backup.updatedAt>0);assert.equal(c.local.has(RUN_KEY),false);
});

test('a new runtime restores the complete run from synchronous GM backup after local quota failure',async()=>{
 const gm=new Map(),first=runtime({quota:true,gm});await first.api.hydrateRunBackup();first.api.writeRun(fixedRun());await first.api.flushRunBackup();
 const second=runtime({quota:true,gm});await second.api.hydrateRunBackup();
 const restored=second.api.readRun();assert.equal(restored.likesHistoryFix230,true);assert.equal(restored.rows.length,301);assert.equal(restored.rows[300].finalMarker,true);
});

test('preparation checkpoints remain authoritative in memory and survive local quota failure via GM backup',async()=>{
 const gm=new Map(),first=runtime({quota:true,gm});await first.api.hydratePrepBackup();first.api.writePrep(preparation());
 assert.equal(first.api.readPrep().rows.length,300);assert.equal(first.api.readPrep().signature,'7|300|eligible-v251');
 await first.api.flushPrepBackup();const envelope=gm.get(PREP_BACKUP);
 assert.equal(envelope.deleted,false);assert.equal(envelope.value.index,300);assert.equal(first.local.has(PREP_KEY),false);
 const second=runtime({quota:true,gm});await second.api.hydratePrepBackup();
 assert.equal(second.api.readPrep().rows.length,300);assert.equal(second.api.readPrep().skipped.length,0);
});

test('promise-based GM APIs hydrate the same complete run without requiring synchronous GM_getValue',async()=>{
 const stored={value:fixedRun(),updatedAt:Date.now(),deleted:false,articleKey:ARTICLE};
 const c=runtime({quota:true,get:async(key,fallback)=>key===RUN_BACKUP?clone(stored):fallback,set:async()=>{}});
 await c.api.hydrateRunBackup();
 assert.equal(c.api.readRun().likesHistoryFix230,true);assert.equal(c.api.readRun().rows.length,301);
});

test('asynchronous run snapshots are serialized and preserve their value when later input objects change',async()=>{
 const gm=new Map(),observed=[];let active=0,maxActive=0;
 const c=runtime({quota:true,gm,set:async(key,envelope)=>{active++;maxActive=Math.max(maxActive,active);await new Promise(resolve=>setTimeout(resolve,envelope.value?.marker==='first'?12:1));observed.push(clone(envelope));gm.set(key,clone(envelope));active--}});
 await c.api.hydrateRunBackup();
 const first={...fixedRun(),marker:'first'};c.api.writeRun(first);first.marker='mutated after enqueue';
 c.api.writeRun({...fixedRun(),marker:'second'});await c.api.flushRunBackup();
 assert.equal(maxActive,1);assert.deepEqual(observed.map(snapshot=>snapshot.value.marker),['first','second']);assert.equal(gm.get(RUN_BACKUP).value.marker,'second');
});

test('a persisted run deletion tombstone prevents a stale local run from resurrecting after reload',async()=>{
 const gm=new Map(),local=new Map(),first=runtime({gm,local,removeFailure:true});await first.api.hydrateRunBackup();
 first.api.writeRun(fixedRun());await first.api.flushRunBackup();
 await new Promise(resolve=>setTimeout(resolve,2));first.api.writeRun(null);await first.api.flushRunBackup();
 assert.equal(first.api.readRun(),null);assert.equal(gm.get(RUN_BACKUP).deleted,true);assert.ok(local.has(RUN_KEY));
 const second=runtime({gm,local,removeFailure:true});await second.api.hydrateRunBackup();assert.equal(second.api.readRun(),null);
});

test('a persisted preparation deletion tombstone prevents stale local preparation from restoring',async()=>{
 const gm=new Map(),local=new Map(),first=runtime({gm,local,removeFailure:true});await first.api.hydratePrepBackup();
 first.api.writePrep(preparation());await first.api.flushPrepBackup();
 await new Promise(resolve=>setTimeout(resolve,2));first.api.writePrep(null);await first.api.flushPrepBackup();
 assert.equal(first.api.readPrep(),null);assert.equal(gm.get(PREP_BACKUP).deleted,true);assert.ok(local.has(PREP_KEY));
 const second=runtime({gm,local,removeFailure:true});await second.api.hydratePrepBackup();assert.equal(second.api.readPrep(),null);
});

test('durable backup failure is surfaced by flush rather than reporting a successful checkpoint',async()=>{
 const c=runtime({quota:true,set:async()=>{throw Error('Durable backup unavailable')}});await c.api.hydrateRunBackup();
 c.api.writeRun(fixedRun());
 await assert.rejects(c.api.flushRunBackup(),/backup|保存|記録|unavailable/i);
 assert.equal(c.api.readRun().likesHistoryFix230,true);assert.equal(c.api.readRun().rows.length,301);
});

test('a pending older GM hydration cannot overwrite a run written in the current page',async()=>{
 let deliver;
 const pending=new Promise(resolve=>{deliver=resolve});
 const c=runtime({quota:true,get:(key,fallback)=>key===RUN_BACKUP?pending:fallback});
 const hydration=c.api.hydrateRunBackup();
 c.api.writeRun({...fixedRun(),marker:'written-now'});
 deliver({value:{...fixedRun(),marker:'older-backup'},updatedAt:1,deleted:false,articleKey:ARTICLE});
 await hydration;await c.api.flushRunBackup();
 assert.equal(c.api.readRun().marker,'written-now');assert.equal(c.gm.get(RUN_BACKUP).value.marker,'written-now');
});

test('an unavailable GM backend does not reject a checkpoint successfully written to local storage',async()=>{
 const c=runtime({get:()=>{throw Error('GM unavailable')},set:()=>{throw Error('GM unavailable')}});
 await c.api.hydrateRunBackup();c.api.writeRun(fixedRun());await c.api.flushRunBackup();
 assert.equal(c.api.readRun().likesHistoryFix230,true);assert.equal(JSON.parse(c.local.get(RUN_KEY)).rows.length,301);
});

test('the core run adapter reads and updates the same authoritative fixed workflow state',async()=>{
 const c=runtime({quota:true});await c.api.hydrateRunBackup();c.api.writeRun(fixedRun());
 const adapter=c.unsafeWindow.__MUMEI_PROFILE_CARD_RUN_STORE__;
 assert.equal(typeof adapter.read,'function');assert.equal(typeof adapter.write,'function');assert.equal(typeof adapter.hydrate,'function');assert.equal(typeof adapter.flush,'function');
 const core=readFileSync(new URL('../public/note-profile-card-paster-core-v232.js',import.meta.url),'utf8');
 const window={addEventListener(){},dispatchEvent(){return true},Event};
 const document={readyState:'loading',addEventListener(){},getElementById:()=>null};
 const context=vm.createContext({window,document,unsafeWindow:{addEventListener(){},__MUMEI_PROFILE_CARD_RUN_STORE__:adapter},location:{hostname:'editor.note.com',href:'https://editor.note.com/notes/'+ARTICLE+'/edit',pathname:'/notes/'+ARTICLE+'/edit'},localStorage:{getItem:()=>null,setItem(){throw Error('Core should use the shared store')},removeItem(){}},GM_getValue:()=>null,URL,Event,setTimeout,clearTimeout,console});
 const entry="if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();";
 assert.ok(core.includes(entry),'core adapter harness must replace the actual bootstrap');
 vm.runInContext(core.replace(entry,'globalThis.api={readRun,writeRun};'),context);
 assert.equal(context.api.readRun().likesHistoryFix230,true);assert.equal(context.api.readRun().rows.length,301);
 context.api.writeRun({...context.api.readRun(),stage:'cards_building',cardKeys:[{key:'embactual123',url:fixedRun().rows[0].url}]});
 assert.equal(c.api.readRun().stage,'cards_building');assert.equal(c.api.readRun().cardKeys.length,1);
 await c.api.flushRunBackup();assert.equal(c.gm.get(RUN_BACKUP).value.cardKeys[0].key,'embactual123');
});
