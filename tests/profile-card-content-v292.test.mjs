import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {JSDOM} from 'jsdom';
import {contentRuntime,transformCoreContent,transformEditorContent} from '../scripts/profile-card-content-v292.mjs';
import {readFileSync} from 'node:fs';
import {instrumentCore,instrumentEditor} from '../scripts/profile-card-quality-instrument.mjs';
import {runtime,dependencies,baselineCode} from './fixtures/profile-card-quality-runtime.mjs';
const require=createRequire(import.meta.url);
function helper(){const dom=new JSDOM(''),store=new Map(),page={};vm.runInNewContext(contentRuntime,{window:page,document:dom.window.document,DOMParser:dom.window.DOMParser,localStorage:{getItem:key=>store.get(key)||null,setItem:(key,value)=>store.set(key,value)}});return{api:page.__MUMEI_PROFILE_CARD_CONTENT__,dom,store}}
const row={urlname:'person_a',key:'n000000000001',url:'https://note.com/person_a/n/n000000000001',creator:'名前✨'};
const source={...row,name:'タイトルは要約として使わない',user:{urlname:'person_a'}};
test('presentation default is name-only, with no guessed source or outside body',()=>{
 const h=helper(),value=h.api.compose(row,source,{});assert.equal(value.size,'thin');assert.equal(value.content,'name');assert.equal(value.text,'');assert.equal(h.api.aboveText({...row,presentation:value}),'');h.dom.window.close();
});
test('free article body and manual newlines are read without inventing a summary',()=>{
 const h=helper(),value=h.api.compose(row,{...source,price:0,body:'<p>一文目です。</p><p>二文目です。<br>手動改行です。</p>'},{},{content:'summary',size:'medium'});
 assert.equal(value.text,'一文目です。\n二文目です。\n手動改行です。');assert.equal(value.source.account,'person_a');assert.equal(value.source.key,row.key);assert.equal(value.status,'available');assert.equal(value.source.field,'free-article-body');h.dom.window.close();
});
test('paid body is cut before the independent paywall marker even when authenticated body includes paid text',()=>{
 const h=helper(),value=h.api.compose(row,{...source,price:100,separator:'paid-boundary',can_read:true,body:'<p>誰でも読める公開部分。</p><p id="paid-boundary">購入者限定の本文。</p><p>秘密の有料本文。</p>'},{},{content:'summary'});
 assert.equal(value.text,'誰でも読める公開部分。');assert.equal(value.source.field,'body-before-separator');assert.ok(!value.text.includes('購入者'));assert.ok(!value.text.includes('秘密'));h.dom.window.close();
});
test('unknown or missing paid boundary is not treated as a free article, and a title is not a summary',()=>{
 const h=helper();for(const note of [{...source,body:'非公開かも知れない本文。'},{...source,price:100,separator:'missing',body:'有料本文。'},{...source,price:0,is_limited:true,body:'限定本文。'}]){
  const value=h.api.compose(row,note,{},{content:'summary'});assert.equal(value.status,'unavailable');assert.equal(value.text,'無料公開本文を取得できません');
 }h.dom.window.close();
});
test('explicit free body and public publisher lead are allowed independently of paid access',()=>{
 const h=helper(),free=h.api.compose(row,{...source,price:100,free_body:'無料本文。',body:'有料本文。'},{},{content:'summary'}),lead=h.api.compose(row,{...source,price:100,description:'公開された冒頭の説明。',body:'有料本文。'},{},{content:'summary'});
 assert.equal(free.text,'無料本文。');assert.equal(lead.text,'公開された冒頭の説明。');assert.equal(lead.source.kind,'note-public-lead');assert.equal(lead.source.field,'description');h.dom.window.close();
});
test('profile source identity is independent, long visible copy is labelled excerpt and original stays intact',()=>{
 const h=helper(),original='手動の改行。\n'+('長いプロフィールです。'.repeat(40)),profile={urlname:'different_account',profile:original};
 const value=h.api.compose(row,source,profile,{content:'profile',size:'thin'});assert.equal(value.source.account,'different_account');assert.equal(profile.profile,original);assert.equal(value.truncated,true);assert.ok(value.text.endsWith('…（抜粋）'));assert.ok(Array.from(value.text).length<=118);h.dom.window.close();
});
test('missing sources remain unverified instead of copying target identifiers into evidence',()=>{
 const h=helper(),profile=h.api.compose(row,source,{profile:'内容あり'},{content:'profile'}),summary=h.api.compose(row,{price:0,body:'内容あり'},{},{content:'summary'});
 assert.equal(profile.source.account,'');assert.equal(summary.source.account,'');assert.equal(summary.source.key,'');assert.equal(summary.source.url,'');h.dom.window.close();
});
test('formatted above copy escapes literal formula text and does not repeat the image name',()=>{
 const h=helper(),value=h.api.compose(row,source,{urlname:'person_a',profile:'A & B #タグ | 100% $ {例} \\ 元の文字'},{content:'profile'}),text=h.api.aboveText({...row,presentation:value});
 assert.ok(text.includes('\\boxed'));assert.ok(text.includes('\\&'));assert.ok(text.includes('\\#'));assert.ok(text.includes('\\%'));assert.ok(!text.includes('名前✨'));
 let katex;try{katex=require(process.env.KATEX_TEST_MODULE||'katex')}catch{}
 if(katex)assert.doesNotThrow(()=>katex.renderToString(text.slice(2,-2),{throwOnError:true,strict:'ignore'}));h.dom.window.close();
});
test('build adapters preserve all independently asserted quality integration markers',()=>{
 for(const [file,transform,instrument] of [['public/note-profile-card-paster-core-v232.js',transformCoreContent,instrumentCore],['public/note-profile-card-paster-v22.user.js',transformEditorContent,instrumentEditor]])assert.doesNotThrow(()=>new vm.Script(instrument(transform(readFileSync(file,'utf8')))));
});
const compiled=(name,fn)=>test(name,{skip:!dependencies?'PM and canvas dependencies are required':false},fn);
for(const size of ['thin','medium'])for(const content of ['name','profile','summary'])compiled('actual compiled '+size+'/'+content+' keeps selected sources and completes the final article',async()=>{
 const local=new Map([['mumei_profile_card_presentation_v292',JSON.stringify({size,content})]]),r=await runtime({count:2,localStorageMap:local,requestMutator:(url,payload)=>{if(url.includes('/api/v3/notes/')){payload.data.price=0;payload.data.body='<p>記事の無料本文から読んだ説明です。</p><p>この文は体験を紹介しています。</p>'}return payload}});
 const run=await r.normal();assert.equal(run.stage,'images_ready',r.state.statuses.at(-1)?.text);assert.equal(run.rows.length,3);assert.equal(r.state.images.length,3);assert.equal(run.rows.at(-1).finalMarker,true);
 for(const person of run.rows){assert.equal(person.presentation.size,size);assert.equal(person.presentation.content,content);if(content!=='name'){assert.equal(person.presentation.status,'available');assert.equal(person.presentation.source.account,person.urlname)}}
 const own=(run.activityTexts||[]).length;assert.equal(own,size==='thin'&&content!=='name'?2:0);
 const base=r.doc();await r.core.deleteNotificationCards({confirm:false,save:false});assert.deepEqual(r.doc(),base);await r.core.deleteAllGenerated({save:false});assert.equal(r.view.state.doc.textContent,'元の文章です。挿入位置');r.close();
});
compiled('pending thin paragraph is reused after image upload failure and stored options survive UI changes',async()=>{
 const local=new Map([['mumei_profile_card_presentation_v292',JSON.stringify({size:'thin',content:'profile'})]]),r=await runtime({count:3,localStorageMap:local});r.state.failAt=2;await r.normal();
 const pending=r.core.readRun();assert.equal(pending.stage,'images_building');assert.equal(pending.items.length,1);assert.equal(pending.activityTexts.length,2);
 local.set('mumei_profile_card_presentation_v292',JSON.stringify({size:'medium',content:'summary'}));r.state.failAt=0;await r.core.pasteSavedSpecial();const done=r.core.readRun();assert.equal(done.stage,'images_ready',r.state.statuses.at(-1)?.text);assert.equal(done.items.length,4);assert.equal(done.activityTexts.length,3);assert.ok(done.rows.every(row=>row.presentation.size==='thin'&&row.presentation.content==='profile'));const text=r.view.state.doc.textContent,counts=new Map();for(const value of done.activityTexts)counts.set(value,(counts.get(value)||0)+1);for(const [value,count] of counts)assert.equal(text.split(value).length-1,count);r.close();
});
compiled('deleting new presentation paragraphs preserves an identical manual paragraph elsewhere',async()=>{
 const local=new Map([['mumei_profile_card_presentation_v292',JSON.stringify({size:'thin',content:'profile'})]]),r=await runtime({count:2,localStorageMap:local});await r.normal();
 const text=r.core.readRun().activityTexts[0];r.view.dispatch(r.view.state.tr.insert(r.view.state.doc.content.size,r.para(text)));
 await r.core.deleteAllGenerated({save:false});assert.equal(r.view.state.doc.textContent,'元の文章です。挿入位置'+text);r.close();
});
compiled('unclear adjacency between a generated image and its presentation stops whole deletion before writes',async()=>{
 const local=new Map([['mumei_profile_card_presentation_v292',JSON.stringify({size:'thin',content:'profile'})]]),r=await runtime({count:2,localStorageMap:local});await r.normal();
 let pos;r.view.state.doc.forEach((node,at)=>{if(pos===undefined&&node.type.name==='image')pos=at});r.view.dispatch(r.view.state.tr.insert(pos,r.para('利用者が後から書いた文章')));
 const before=r.doc(),run=JSON.stringify(r.core.readRun());await assert.rejects(r.core.deleteAllGenerated({save:false}),/紹介文と作成画像の対応/);assert.deepEqual(r.doc(),before);assert.equal(JSON.stringify(r.core.readRun()),run);r.close();
});
test('an actual legacy partial history keeps its stored format even if the new controls choose medium summary',{skip:!dependencies||!baselineCode()?'Recorded legacy baseline is required':false},async()=>{
 const old=await runtime({baseline:true,count:3});old.state.failAt=2;await old.history();assert.equal(old.editor.readRun().items.length,1);
 const current=await old.reload({baseline:false,moduleCode:readFileSync('public/note-profile-card-likes300-fix-v220.user.js','utf8')});current.local.set('mumei_profile_card_presentation_v292',JSON.stringify({size:'medium',content:'summary'}));await current.history();
 const run=current.editor.readRun();assert.equal(run.stage,'images_ready',current.state.statuses.at(-1)?.text);assert.ok(run.rows.every(row=>!row.presentation));assert.equal(run.activityTexts.length,3);assert.equal(current.state.images.length,4);old.close();current.close();
});
compiled('history inserts its own new presentation at the tap without adopting an identical later manual paragraph',async()=>{
 const local=new Map([['mumei_profile_card_presentation_v292',JSON.stringify({size:'thin',content:'profile'})]]),r=await runtime({count:1,localStorageMap:local}),person=r.person(0),api=r.page.__MUMEI_PROFILE_CARD_CONTENT__;
 const manual=api.aboveText({...person,presentation:api.compose(person,{}, {urlname:person.urlname,profile:'原文です。\n自然な折り返しと手動改行を区別します。AIも美容も書きます。'},{size:'thin',content:'profile'})});
 r.view.dispatch(r.view.state.tr.insert(r.view.state.doc.content.size,r.para(manual)));const original=r.doc();await r.history();const run=r.editor.readRun();assert.equal(run.stage,'images_ready',r.state.statuses.at(-1)?.text);
 assert.equal(run.activityTexts.length,1);assert.equal(run.presentationTexts[run.rows[0].url],manual);
 const blocks=[];r.view.state.doc.forEach((node,pos)=>blocks.push({node,pos}));const imageIndex=blocks.findIndex(hit=>hit.node.type.name==='image'&&hit.node.attrs.link===run.rows[0].url),copies=blocks.filter(hit=>hit.node.type.name==='paragraph'&&hit.node.textContent===manual);
 assert.equal(copies.length,2);assert.equal(blocks[imageIndex-1].node.textContent,manual);assert.ok(copies.at(-1).pos>blocks[imageIndex].pos,'the manual paragraph stays after the generated image');
 await r.core.deleteAllGenerated({save:false});assert.deepEqual(r.doc(),original);r.close();
});
compiled('history reuses only its recorded pending presentation after native upload failure',async()=>{
 const local=new Map([['mumei_profile_card_presentation_v292',JSON.stringify({size:'thin',content:'profile'})]]),r=await runtime({count:2,localStorageMap:local});r.state.failAt=2;await r.history();const pending=r.editor.readRun();
 assert.equal(pending.items.length,1);assert.equal(pending.activityTexts.length,2);assert.equal(Object.keys(pending.presentationTexts).length,2);
 r.state.failAt=0;local.set('mumei_profile_card_presentation_v292',JSON.stringify({size:'medium',content:'summary'}));await r.history();const run=r.editor.readRun();assert.equal(run.stage,'images_ready',r.state.statuses.at(-1)?.text);assert.equal(run.items.length,3);assert.equal(run.activityTexts.length,2);assert.equal(Object.keys(run.presentationTexts).length,2);
 const text=r.view.state.doc.textContent,counts=new Map();for(const value of run.activityTexts)counts.set(value,(counts.get(value)||0)+1);for(const [value,count] of counts)assert.equal(text.split(value).length-1,count);r.close();
});
compiled('fresh source repair cannot rewrite a history presentation already owned by the pending row',async()=>{
 const local=new Map([['mumei_profile_card_presentation_v292',JSON.stringify({size:'thin',content:'profile'})]]),r=await runtime({count:2,localStorageMap:local});r.state.failAt=2;await r.history();const pending=r.editor.readRun(),rows=pending.rows.map((row,index)=>index===1?{...row,presentation:{...row.presentation,source:{...row.presentation.source,account:'wrong_account'}}}:row);
 assert.equal(Object.keys(pending.presentationTexts).length,2);r.editor.writeRun({...pending,rows});r.state.failAt=0;await r.history();const held=r.editor.readRun();assert.equal(held.qualityHold?.kind,'source');assert.equal(held.qualityHold?.index,1);const before=r.doc(),text=held.presentationTexts[held.rows[1].url];
 r.state.requestMutator=(url,payload)=>{if(url.includes('/api/v2/creators/')&&!url.includes('/contents'))payload.data.creator.profile='後から変わったプロフィール本文です。';return payload};await r.history();const stillHeld=r.editor.readRun();assert.ok(stillHeld.qualityHold);assert.equal(stillHeld.items.length,1);assert.equal(stillHeld.presentationTexts[stillHeld.rows[1].url],text);assert.deepEqual(r.doc(),before);r.close();
});
compiled('explicit history restart clears presentation ownership and preserves identical manual text',async()=>{
 const local=new Map([['mumei_profile_card_presentation_v292',JSON.stringify({size:'thin',content:'profile'})]]),r=await runtime({count:1,localStorageMap:local});await r.history();const text=r.editor.readRun().activityTexts[0];r.view.dispatch(r.view.state.tr.insert(r.view.state.doc.content.size,r.para(text)));r.state.clock++;
 r.editor.patch("const savedContentHistoryOptions=historyOptions;historyOptions=run=>run?savedContentHistoryOptions(run):{mode:'number',count:state.targetCount,target:state.targetCount};globalThis.restartContentHistory=restartFixed300;");
 await r.c.restartContentHistory();const run=r.editor.readRun();assert.equal(run.stage,'images_ready',r.state.statuses.at(-1)?.text);assert.equal(run.items.length,2);assert.equal(run.activityTexts.length,1);assert.equal(Object.keys(run.presentationTexts).length,1);assert.equal(r.view.state.doc.textContent.split(text).length-1,2);
 await r.core.deleteAllGenerated({save:false});assert.equal(r.view.state.doc.textContent,'元の文章です。挿入位置'+text);r.close();
});
compiled('compatible history acquisition checkpoint freezes selected output before a run exists',async()=>{
 const local=new Map([['mumei_profile_card_presentation_v292',JSON.stringify({size:'thin',content:'profile'})]]),r=await runtime({count:8,localStorageMap:local});
 r.editor.patch('globalThis.originalContentWritePrep=writePrep;writePrep=value=>{originalContentWritePrep(value);if(value.rows?.length===6)stopRequested=true};');await r.history();assert.equal(r.editor.readRun(),null);const saved=JSON.parse(local.get('mumei_profile_like300_fix_v230:naaaaaaaaaaaa'));assert.equal(saved.rows.length,6);assert.equal(saved.presentationOptions.content,'profile');
 r.editor.patch('writePrep=originalContentWritePrep');local.set('mumei_profile_card_presentation_v292',JSON.stringify({size:'medium',content:'summary'}));await r.history();const run=r.editor.readRun();assert.equal(run.stage,'images_ready',r.state.statuses.at(-1)?.text);assert.equal(run.rows.length,9);assert.ok(run.rows.every(row=>row.presentation.size==='thin'&&row.presentation.content==='profile'));r.close();
});
compiled('an incompatible history bridge does not reuse an earlier acquisition presentation selection',async()=>{
 const local=new Map([['mumei_profile_card_presentation_v292',JSON.stringify({size:'thin',content:'profile'})]]),r=await runtime({count:8,localStorageMap:local});
 r.editor.patch('globalThis.originalContentWritePrep=writePrep;writePrep=value=>{originalContentWritePrep(value);if(value.rows?.length===6)stopRequested=true};');await r.history();assert.equal(r.editor.readRun(),null);r.editor.patch('writePrep=originalContentWritePrep');
 const bridge=r.gm.get('mumei_profile_card_likes_300_v2');r.gm.set('mumei_profile_card_likes_300_v2',{...bridge,at:bridge.at+1});local.set('mumei_profile_card_presentation_v292',JSON.stringify({size:'medium',content:'summary'}));await r.history();const run=r.editor.readRun();assert.equal(run.stage,'images_ready',r.state.statuses.at(-1)?.text);assert.ok(run.rows.every(row=>row.presentation.size==='medium'&&row.presentation.content==='summary'));r.close();
});
test('a compatible legacy acquisition checkpoint remains legacy when resumed with new output controls',{skip:!dependencies||!baselineCode()?'Recorded legacy baseline is required':false},async()=>{
 const old=await runtime({baseline:true,count:8});old.editor.patch('globalThis.originalContentWritePrep=writePrep;writePrep=value=>{originalContentWritePrep(value);if(value.rows?.length===6)stopRequested=true};');await old.history();assert.equal(old.editor.readRun(),null);
 const current=await old.reload({baseline:false,moduleCode:readFileSync('public/note-profile-card-likes300-fix-v220.user.js','utf8')});current.local.set('mumei_profile_card_presentation_v292',JSON.stringify({size:'medium',content:'summary'}));await current.history();const run=current.editor.readRun();assert.equal(run.stage,'images_ready',current.state.statuses.at(-1)?.text);assert.ok(run.rows.every(row=>!row.presentation));assert.equal(run.activityTexts.length,8);old.close();current.close();
});
