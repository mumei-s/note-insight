import nodeTest from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {transformEditorSpeed} from '../scripts/profile-card-speed-v292.mjs';
import {runtime,dependencies} from './fixtures/profile-card-quality-runtime.mjs';
const test=(name,fn)=>nodeTest(name,{skip:!dependencies?'Real PM/canvas required':false},fn);

const ARTICLE='n123456789abc',LOCAL='canonical-speed-local',BACKUP='canonical-speed-backup:'+ARTICLE;
const speedSource=transformEditorSpeed(readFileSync('public/note-profile-card-paster-v22.user.js','utf8'));
function storageRuntime(options={}){
 const local=options.local||new Map(),gm=options.gm||new Map(),writes=[],page={addEventListener(){},dispatchEvent(){return true},Event};
 let context;
 const localStorage={getItem:key=>local.get(key)??null,setItem(key,value){if(options.localFailure)throw Error('local checkpoint failure');options.onLocalWrite?.(key,value,context.api.store);local.set(key,String(value));},removeItem(key){if(options.localFailure)throw Error('local checkpoint failure');local.delete(key);}};
 context=vm.createContext({unsafeWindow:page,window:page,document:{getElementById:()=>null},location:new URL('https://editor.note.com/notes/'+ARTICLE+'/edit'),localStorage,GM_getValue:(key,fallback)=>gm.has(key)?JSON.parse(JSON.stringify(gm.get(key))):fallback,GM_setValue:(key,value)=>{if(options.backupFailure)throw Error('backup checkpoint failure');writes.push({key,value});return options.set?options.set(key,value,gm):gm.set(key,value);},GM_xmlhttpRequest(){throw Error('Unexpected network')},URL,Event,setTimeout,clearTimeout,setInterval:()=>1,clearInterval(){}});
 const exposed=speedSource.replace(/let attempts=0;[\s\S]*?\n\}\)\(\);\s*$/,`globalThis.api={patch:code=>eval(code),store:createStoredState(()=>${JSON.stringify(LOCAL)},'canonical-speed-backup:'),readRun,writeRun,hydrateRunBackup,flushRunBackup,ordinary:value=>Object.getPrototypeOf(value)===Object.prototype};})();`);
 assert.notEqual(exposed,speedSource);vm.runInContext(exposed,context);return{context,api:context.api,store:context.api.store,local,gm,writes,options};
}
const plain=value=>JSON.parse(JSON.stringify(value));
function assertNoSharedObjects(source,copy){
 const objects=new WeakSet(),pending=[source];while(pending.length){const item=pending.pop();if(item&&typeof item==='object'&&!objects.has(item)){objects.add(item);for(const key of Object.keys(item))pending.push(item[key]);}}
 const seen=new WeakSet(),copies=[copy];while(copies.length){const item=copies.pop();if(item&&typeof item==='object'&&!seen.has(item)){assert.equal(objects.has(item),false,'checkpoint copies cannot share any source container');seen.add(item);for(const key of Object.keys(item))copies.push(item[key]);}}
}

nodeTest('canonical checkpoint copies retain JSON normalization with one stringify and one normal-path parse',async()=>{
 const r=storageRuntime();r.api.patch(`globalThis.serializationCounts={stringify:0,parse:0};const actualStringify=JSON.stringify,actualParse=JSON.parse;JSON.stringify=function(...args){serializationCounts.stringify++;return actualStringify.apply(this,args)};JSON.parse=function(...args){serializationCounts.parse++;return actualParse.apply(this,args)};`);
 let normalized=0;const input={omitted:undefined,nan:NaN,infinite:Infinity,minusZero:-0,date:new Date('2026-10-31T00:00:00Z'),rows:[undefined,,NaN,{omitted:undefined,value:true}],custom:{toJSON(){normalized++;return{canonical:true}}}};
 r.store.write(input);await r.store.flush();
 assert.equal(normalized,1);assert.deepEqual(plain(r.context.serializationCounts),{stringify:1,parse:1});
 const expected={nan:null,infinite:null,minusZero:0,date:'2026-10-31T00:00:00.000Z',rows:[null,null,null,{value:true}],custom:{canonical:true},updatedAt:r.store.read().updatedAt};
 assert.deepEqual(plain(r.store.read()),expected);assert.deepEqual(plain(r.gm.get(BACKUP).value),expected);assert.deepEqual(JSON.parse(r.local.get(LOCAL)),expected);assertNoSharedObjects(r.store.read(),r.gm.get(BACKUP).value);
});

nodeTest('canonical backup containers stay independent of given input and read() mutations before and after flush',async()=>{
 const r=storageRuntime(),given={rows:[{name:'original',nested:{tags:['tag']}}],items:[]};r.store.write(given);
 given.rows[0].nested.tags.push('input mutation');r.store.read().rows[0].name='read mutation';r.store.read().items.push({id:'later'});
 await r.store.flush();const backup=r.gm.get(BACKUP).value;
 assert.equal(backup.rows[0].name,'original');assert.deepEqual(plain(backup.rows[0].nested.tags),['tag']);assert.deepEqual(plain(backup.items),[]);
 r.store.read().rows[0].nested.tags.push('after flush');assert.deepEqual(plain(backup.rows[0].nested.tags),['tag']);assertNoSharedObjects(given,backup);assertNoSharedObjects(r.store.read(),backup);
});

nodeTest('backup is cloned before a synchronous localStorage callback can mutate exposed memory',async()=>{
 const r=storageRuntime({onLocalWrite(key,value,store){store.read().rows[0].name='changed during local write';store.read().rows[0].nested.push('changed');}});
 r.store.write({rows:[{name:'original',nested:['original']}],items:[]});await r.store.flush();
 assert.equal(r.store.read().rows[0].name,'changed during local write');assert.equal(r.gm.get(BACKUP).value.rows[0].name,'original');assert.deepEqual(plain(r.gm.get(BACKUP).value.rows[0].nested),['original']);assert.equal(JSON.parse(r.local.get(LOCAL)).rows[0].name,'original');assertNoSharedObjects(r.store.read(),r.gm.get(BACKUP).value);
});

nodeTest('canonical __proto__ data remains an own property on ordinary objects without prototype pollution',async()=>{
 const r=storageRuntime(),input=JSON.parse('{"__proto__":{"polluted":true},"constructor":{"value":3},"rows":[{"__proto__":{"nested":true}}]}');
 r.store.write(input);await r.store.flush();const backup=r.gm.get(BACKUP).value;
 assert.equal(r.api.ordinary(backup),true);assert.equal(r.api.ordinary(backup.rows[0]),true);assert.equal(Object.hasOwn(backup,'__proto__'),true);assert.equal(backup.polluted,undefined);assert.equal(backup.rows[0].nested,undefined);assert.equal(backup.__proto__.polluted,true);assert.equal(backup.rows[0].__proto__.nested,true);assert.deepEqual(plain(backup),plain(r.store.read()));assertNoSharedObjects(r.store.read(),backup);
});

nodeTest('depth guard and unexpected recursive-copy exceptions use the unchanged independent JSON fallback',async()=>{
 for(const forced of [false,true]){
  const r=storageRuntime();r.api.patch(`globalThis.fallbackParses=0;const actualParse=JSON.parse;JSON.parse=function(...args){fallbackParses++;return actualParse.apply(this,args)};`);
  if(forced)r.api.patch('cloneCanonicalCheckpoint=()=>{throw Error("injected clone failure")}');
  let nested={leaf:'value'};for(let index=0;index<(forced?2:300);index++)nested={next:nested};r.store.write({rows:[nested],items:[]});await r.store.flush();
  assert.equal(r.context.fallbackParses,2);assert.deepEqual(plain(r.gm.get(BACKUP).value),plain(r.store.read()));assertNoSharedObjects(r.store.read(),r.gm.get(BACKUP).value);
 }
});

nodeTest('canonical-copy checkpoints preserve serialized queue order and one backend call for each original write',async()=>{
 const order=[];let active=0,maxActive=0;const r=storageRuntime({async set(key,value,gm){active++;maxActive=Math.max(maxActive,active);await new Promise(resolve=>setTimeout(resolve,value.value?.marker==='first'?8:1));order.push(value.value?.marker);gm.set(key,value);active--;}});
 const first={marker:'first',rows:[{nested:{name:'first'}}]};r.store.write(first);first.rows[0].nested.name='input changed';r.store.read().rows[0].nested.name='memory changed';r.store.write({marker:'second',rows:[]});await r.store.flush();
 assert.deepEqual(order,['first','second']);assert.equal(r.writes.length,2);assert.equal(maxActive,1);assert.equal(r.writes[0].value.value.rows[0].nested.name,'first');assert.equal(r.gm.get(BACKUP).value.marker,'second');
});

nodeTest('canonical-copy storage keeps original backup keys, object envelopes, hydration and deletion tombstones',async()=>{
 const r=storageRuntime();r.api.writeRun({articleKey:ARTICLE,rows:[{name:'original'}],items:[]});await r.api.flushRunBackup();
 const key='mumei_profile_card_run_backup_v253:'+ARTICLE,envelope=r.gm.get(key);assert.equal(typeof envelope.value,'object');assert.equal(envelope.deleted,false);assert.equal(envelope.articleKey,ARTICLE);assert.deepEqual(Object.keys(envelope).sort(),['articleKey','deleted','updatedAt','value']);assert.ok(r.local.has('mumei_profile_card_paster_run_v15:'+ARTICLE));
 const restored=storageRuntime({gm:r.gm,local:new Map()});await restored.api.hydrateRunBackup();assert.equal(restored.api.readRun().rows[0].name,'original');restored.api.writeRun(null);await restored.api.flushRunBackup();assert.equal(restored.gm.get(key).deleted,true);assert.equal(restored.gm.get(key).value,null);
});

nodeTest('canonical-copy failure handling retains memory and reports both-backend failure without false success',async()=>{
 for(const [localFailure,backupFailure,reject] of [[true,false,false],[false,true,false],[true,true,true]]){
  const options={localFailure,backupFailure},r=storageRuntime(options);r.store.write({rows:[{name:'retained'}],items:[]});
  if(reject)await assert.rejects(r.store.flush(),/保存|記録/);else await r.store.flush();
  assert.equal(r.store.read().rows[0].name,'retained');if(!backupFailure)assert.equal(r.gm.get(BACKUP).value.rows[0].name,'retained');if(!localFailure)assert.equal(JSON.parse(r.local.get(LOCAL)).rows[0].name,'retained');
 }
});

test('standalone checkpoints serialize once and preserve isolated local/backup snapshots',async t=>{
 const r=await runtime();t.after(()=>r.close());
 r.editor.patch(`globalThis.speedTestStore=createStoredState(()=> 'speed-test-local','speed-test-backup:');
  globalThis.speedStringifyCount=0;const originalStringify=JSON.stringify;
  JSON.stringify=function(...args){globalThis.speedStringifyCount++;return originalStringify.apply(this,args)};`);
 const store=r.c.speedTestStore;
 store.write({rows:[{creator:'元の名前'}],items:[]});
 assert.equal(r.c.speedStringifyCount,1);
 store.read().rows[0].creator='呼び出し側が変更';
 await store.flush();
 assert.equal(JSON.parse(r.local.get('speed-test-local')).rows[0].creator,'元の名前');
 assert.equal(r.gm.get('speed-test-backup:naaaaaaaaaaaa').value.rows[0].creator,'元の名前');
 assert.equal(store.read().rows[0].creator,'呼び出し側が変更');
});

test('normal image/native-card pacing is shorter with no tenth-card block or final idle',async t=>{
 const r=await runtime({count:12});t.after(()=>r.close());
 await r.normal();assert.equal(r.editor.readRun()?.stage,'images_ready',r.state.statuses.at(-1)?.text);
 assert.equal(r.state.images.length,13);
 assert.deepEqual(Array.from(r.state.waits),Array(12).fill(0));
 r.state.waits=[];await r.core.createCardsAtTap();
 assert.equal(r.state.nativeCardRequests.length,13);assert.equal(r.editor.readRun().stage,'complete');
 assert.deepEqual(Array.from(r.state.waits),Array(12).fill(200));
});

test('final math article with unavailable bitmaps still completes its original image/link and reports missing materials',async t=>{
 const r=await runtime({count:2});t.after(()=>r.close());
 r.editor.patch(`const speedOriginalBitmap=bitmapFromUrl;bitmapFromUrl=async url=>String(url).includes('fuku444')||/thumb-1\\.png/.test(String(url))?null:speedOriginalBitmap(url);`);
 await r.history();const run=r.editor.readRun();
 assert.equal(run?.stage,'images_ready',r.state.statuses.at(-1)?.text);assert.equal(r.state.images.length,3);
 assert.equal(run.rows.at(-1).url,'https://note.com/fuku444/n/nb4f6934381e9');
 assert.equal(run.items.at(-1).url,run.rows.at(-1).url);assert.equal(run.rows.at(-1).finalMarker,true);
 assert.equal(run.rows.at(-1).renderAssetStatus.thumbnail,'failed');
 assert.ok(r.quality.snapshot().records.some(record=>record.target==='fuku444'&&record.findings.some(finding=>finding.status==='insufficient'||finding.status==='candidate')));
 assert.equal(run.qualityHold??null,null);
});

test('final math article identity contradiction still holds before its placeholder or upload',async t=>{
 const r=await runtime({count:2,requestMutator:(url,payload)=>{
  if(new URL(url).pathname==='/api/v3/notes/nb4f6934381e9')payload.data.user.urlname='wrong_final_account';return payload;
 }});t.after(()=>r.close());await r.history();const run=r.editor.readRun();
 assert.equal(run?.stage,'images_building');assert.equal(run.qualityHold?.index,2);
 assert.equal(r.state.images.length,2);assert.equal(run.rows.at(-1).urlname,'fuku444');
 assert.ok(!run.imagesCompletedAt);assert.ok(!run.imageSkipped?.length);
});

test('the normal whole-batch delete leaves source, count and presentation preferences available for the next run',async t=>{
 const r=await runtime({count:2});t.after(()=>r.close());
 const prefs=JSON.stringify({sources:'#料理 #旅',count:2,mode:'number',choice:'oldest'}),presentation=JSON.stringify({size:'medium',content:'profile'});
 r.local.set('mumei_profile_card_paster_v1',prefs);r.local.set('mumei_profile_card_presentation_v292',presentation);
 const original=r.doc();await r.normal();assert.equal(r.editor.readRun().stage,'images_ready');
 r.page.confirm=()=>true;r.core.patch('globalThis.speedResetAll=resetAll;');await r.c.speedResetAll();
 assert.equal(r.editor.readRun(),null);assert.deepEqual(r.doc(),original);
 assert.equal(r.local.get('mumei_profile_card_paster_v1'),prefs);assert.equal(r.local.get('mumei_profile_card_presentation_v292'),presentation);
});
