import nodeTest from 'node:test';
import assert from 'node:assert/strict';
import {runtime,dependencies} from './fixtures/profile-card-quality-runtime.mjs';
const test=(name,fn)=>nodeTest(name,{skip:!dependencies?'Real PM/canvas required':false},fn);

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
 assert.deepEqual(Array.from(r.state.waits),Array(12).fill(20));
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
