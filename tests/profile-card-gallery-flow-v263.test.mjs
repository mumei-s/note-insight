import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync('public/note-profile-card-paster-v22.user.js','utf8');
const helper=readFileSync('public/note-profile-card-gallery-v263.js','utf8');
const committedManifest=JSON.parse(readFileSync('public/note-profile-card-halloween126.json','utf8'));
const manifest={...committedManifest,preparedRows:[],pendingPeople:[]};
const ARTICLE='n123456789abc',RUN='mumei_profile_card_paster_run_v15:'+ARTICLE;
const FINAL_URL='https://note.com/fuku444/n/nb4f6934381e9';
const final=index=>({index,urlname:'fuku444',creator:'実績の算数',key:'nb4f6934381e9',url:FINAL_URL,finalMarker:true});
const plan=()=>manifest.people.map((person,index)=>{
 const key='n'+(index+1).toString(16).padStart(12,'0'),publishAt='2025-01-01T00:00:00+09:00';
 return{...person,index:index+1,likerKey:person.urlname,url:'https://note.com/'+person.urlname+'/n/'+key,key,publishAt,thumbUrl:'https://assets.st-note.com/'+key+'.png',actorImageUrl:'',profileText:'本人のプロフィール '+index,gallery126:true,finalMarker:false,articleSelection:'oldest-confirmed',oldestVerified:true,oldestEvidence:{creator:person.urlname,key,publishAt,terminalPage:2,pagesChecked:[1,2,3],verifiedAt:'2026-10-18T07:00:00Z'}};
});
const missingIndex=87;
const profileOnly=()=>{const person=manifest.people[missingIndex],url='https://note.com/'+person.urlname;return{...person,index:missingIndex+1,likerKey:person.urlname,actorUrl:url,url,key:'',title:'',publishAt:null,thumbUrl:'',actorImageUrl:'https://assets.st-note.com/yato.png',avatarMissing:false,profileText:'本人のプロフィール全文',gallery126:true,profileOnly:true,finalMarker:false,articleSelection:'profile-only-confirmed',oldestVerified:false,oldestEvidence:null,noPublicArticleEvidence:{creator:person.urlname,profileUrl:url,noteCount:0,contentsTotal:0,isLastPage:true,checkedAt:'2026-10-19T01:00:00Z',source:'note-public-api'}}};
const fullPlan=()=>plan().map((row,index)=>index===missingIndex?profileOnly():row);
const knownPending=()=>[{urlname:manifest.people[missingIndex].urlname,reason:'NO_PUBLIC_ARTICLE',noteCount:0}];
const legacyPlan=()=>plan().flatMap((row,index)=>index===missingIndex?[]:[{...row,gallerySourceIndex:index+1,galleryAvailableOnly:true}]).map((row,index)=>({...row,index:index+1}));
function runtime(){
 const local=new Map(),gm=new Map(),page={__MUMEI_PROFILE_CARD_GALLERY_MANIFEST__:manifest};
 const context=vm.createContext({unsafeWindow:page,window:{addEventListener(){},dispatchEvent(){},Event},document:{getElementById:()=>null},location:new URL('https://editor.note.com/notes/'+ARTICLE+'/edit'),URL,Event,Intl,localStorage:{getItem:key=>local.get(key)??null,setItem:(key,value)=>local.set(key,String(value)),removeItem:key=>local.delete(key)},GM_getValue:(key,fallback)=>gm.get(key)??fallback,GM_setValue:(key,value)=>gm.set(key,value),GM_xmlhttpRequest(){throw Error('unexpected network')},setTimeout,clearTimeout,setInterval:()=>1,clearInterval(){},console});
 vm.runInContext(helper,context);
 const code=source.replace('const sleep=','let sleep=').replace(/let attempts=0;[\s\S]*?\n\}\)\(\);\s*$/,`globalThis.api={patch:code=>eval(code),startGallery126,createFixed300,validateGalleryRows,buildGalleryRows,prepareGalleryPerson,activityText,readRun,writeRun,assignDesigns,assertGalleryPaste,assertGalleryTracking,ensureCardsRunReady,galleryAssetUrl,galleryNeedsParticipantUpgrade,galleryImagePlan,galleryRowVerified};})();`);
 vm.runInContext(code,context);
 const blocks=[],events=[];let generation=0;
 const node=(type,text='',attrs={})=>({type:{name:type},attrs,textContent:text,nodeSize:1,toJSON(){return{type,attrs,text}}});
 const makeDoc=()=>({generation:generation++,content:{size:blocks.length},nodeAt:pos=>blocks[pos]||null,descendants(fn){blocks.forEach((block,pos)=>fn(block,pos))}});
 const transaction=()=>{const values=blocks.slice(),operations=[];return{values,mapping:{map(pos,assoc=1){for(const{from,to,size}of operations){if(pos<from)continue;if(pos>to||pos===to&&to!==from)pos+=size-(to-from);else if(pos===from&&from===to)pos+=assoc>0?size:0;else pos=from+(assoc>0?size:0)}return pos}},delete(from,to){values.splice(from,to-from);operations.push({from,to,size:0});return this},insert(from,value){values.splice(from,0,value);operations.push({from,to:from,size:value.nodeSize});return this},replaceWith(from,to,value){values.splice(from,to-from,value);operations.push({from,to,size:value.nodeSize});return this}}};
 const view={state:{doc:makeDoc(),selection:{from:0},schema:{text:value=>value,nodes:{heading:{create:(attrs,text)=>node('heading',text,attrs)}}},get tr(){return transaction()}},dispatch(tr){blocks.splice(0,blocks.length,...tr.values);view.state.doc=makeDoc()}};
 const insert=(pos,value)=>{blocks.splice(pos,0,value);view.state.doc=makeDoc();return{pos,nextPos:pos+1,node:value}};
 context.view=view;context.events=events;context.rows=plan();context.insert=insert;context.node=node;context.blocks=blocks;context.statuses=[];context.imageSerial=0;
 context.api.patch(`
 sleep=async()=>{};findView=()=>view;nativeImageCommand=()=>{};selectionApi=()=>{};cardAnchorFromSelection=()=>0;
 setStatus=text=>statuses.push(text);buildGalleryRows=async()=>rows;
 enrichFinal=async index=>{events.push('prepare-final');return{index,urlname:'fuku444',creator:'実績の算数',key:'nb4f6934381e9',url:'${FINAL_URL}',thumbUrl:'https://assets.st-note.com/final.png',finalMarker:true}};
 insertHeadingAt=(view,text,pos)=>insert(pos,node('heading',text));
 insertActivityAt=(view,row,pos)=>({...insert(pos,node('paragraph',activityText(row))),text:activityText(row)});
 isDivider=(view,n)=>n?.type?.name==='horizontal_rule';
 addDivider=(view,hit,row)=>insert(hit.pos+1,node('horizontal_rule')).nextPos;
 makeFile=async row=>{events.push('render-'+row.index);return{index:row.index}};
 uploadOne=async(view,row,file,pos)=>{if(file.index!==row.index)throw Error('prefetch order mismatch');events.push('upload-'+row.index);await new Promise(resolve=>setTimeout(resolve,1));const result=insert(pos,node('image',row.creator+'さん',{id:'image-'+row.index+'-'+(++imageSerial),src:'https://assets.st-note.com/'+row.index+'.png',link:row.url}));events.push('uploaded-'+row.index);return{hit:{pos:result.pos,node:result.node},nextPos:result.nextPos}};
 `);
 return{api:context.api,c:context,page,local,gm,blocks,view,insert,node,events};
}

async function seedLegacy125(r,{withoutFinal=false}={}){
 r.page.__MUMEI_PROFILE_CARD_GALLERY_MANIFEST__={...manifest,pendingPeople:knownPending()};r.c.rows=legacyPlan();
 await r.api.startGallery126(true);const seeded=r.api.readRun();assert.equal(seeded.items.length,126);
 if(withoutFinal){const at=r.blocks.findIndex(block=>block.type.name==='heading'&&block.textContent==='最後に｜実績の算数');r.blocks.splice(at);r.insert(r.blocks.length,r.node('embed','既存通知カード',{src:seeded.rows[0].url}));}
 r.api.writeRun({...seeded,version:'2.6.6',galleryAvailableOnly:true,rows:withoutFinal?Array.from(seeded.rows).slice(0,-1):seeded.rows,items:withoutFinal?Array.from(seeded.items).slice(0,-1):seeded.items,sectionHeadings:withoutFinal?Array.from(seeded.sectionHeadings).filter(text=>text!=='最後に｜実績の算数'):seeded.sectionHeadings,dividerUrls:withoutFinal?Array.from(seeded.dividerUrls||[]).filter(url=>url!==FINAL_URL):seeded.dividerUrls,stage:'complete',paused:true,pauseStage:'cards',cardKeys:['existing-card']});
 r.c.rows=fullPlan();r.c.api.patch(`prepareGalleryPerson=async(person,index)=>rows[index]`);r.events.length=0;
 return r.api.readRun();
}

test('126 manifest identities produce126 introductions plus the one final article, profiles and14 headings',async()=>{
 const r=runtime();await r.api.startGallery126();const run=JSON.parse(r.local.get(RUN));
 assert.equal(run.stage,'images_ready');assert.equal(run.count,126);assert.equal(run.rows.length,127);assert.equal(run.choice,'oldest');assert.equal(run.likesHistory,false);assert.equal(run.gallery126,true);
 assert.equal(new Set(run.rows.filter(row=>row.gallery126).map(row=>row.designIndex)).size,126);
 assert.equal(r.blocks.filter(n=>n.type.name==='image').length,127);assert.equal(r.blocks.filter(n=>n.type.name==='paragraph').length,126);assert.equal(r.blocks.filter(n=>n.type.name==='horizontal_rule').length,127);
 const headings=r.blocks.filter(n=>n.type.name==='heading');assert.equal(headings.length,14);assert.equal(headings.at(-2).textContent,'13｜121人目〜126人目のクリエイター様');assert.equal(headings.at(-1).textContent,'最後に｜実績の算数');
 assert.deepEqual(r.blocks.filter(n=>n.type.name==='image').map(n=>n.attrs.link),[...plan().map(row=>row.url),FINAL_URL]);
 assert.ok(r.blocks.filter(n=>n.type.name==='paragraph').every(n=>/^\$\$\{\\(?:footnotesize|scriptsize)/.test(n.textContent)&&n.textContent.endsWith('}$$')));
 assert.ok(r.blocks.filter(n=>n.type.name==='image').every((n,i)=>n.textContent===(manifest.people[i]?.creator||'実績の算数')+'さん'));
 assert.ok(r.events.indexOf('render-2')<r.events.indexOf('uploaded-1'));
 for(let i=1;i<126;i++)assert.ok(r.events.indexOf('upload-'+(i+1))>r.events.indexOf('uploaded-'+i));
 const before=r.blocks.length,styles=run.rows.map(row=>row.designIndex);await r.api.startGallery126();
 assert.equal(r.blocks.length,before);assert.deepEqual(JSON.parse(r.local.get(RUN)).rows.map(row=>row.designIndex),styles);
 assert.equal(r.events.filter(event=>event==='prepare-final').length,1);
});

test('gallery PNG failure stops at that creator and resumes without skips, extra rows or repeated completed uploads',async()=>{
 const r=runtime();r.c.api.patch(`const oldMakeFile=makeFile;makeFile=async row=>{if(row.index===4)throw Object.assign(Error('image failed'),{code:'ASSET_UNAVAILABLE'});return oldMakeFile(row)};`);
 await r.api.startGallery126();assert.equal(r.blocks.filter(n=>n.type.name==='image').length,3);assert.match(r.c.statuses.at(-1),/image failed/);
 r.c.api.patch(`makeFile=async row=>({index:row.index});`);await r.api.startGallery126();
 assert.equal(r.blocks.filter(n=>n.type.name==='image').length,127);assert.equal(JSON.parse(r.local.get(RUN)).rows.length,127);assert.equal(new Set(r.blocks.filter(n=>n.type.name==='image').map(n=>n.attrs.link)).size,127);
 assert.equal(r.events.filter(event=>event==='upload-1').length,1);assert.equal(JSON.parse(r.local.get(RUN)).stage,'images_ready');
});

test('a divider missing after an interruption is repaired before moving to the next creator',async()=>{
 const r=runtime();r.c.api.patch(`const originalDivider=addDivider;let fail=true;addDivider=(view,hit,row)=>{if(fail){fail=false;throw Error('interrupted before divider')}return originalDivider(view,hit,row)};`);
 await r.api.startGallery126();assert.equal(r.blocks.filter(n=>n.type.name==='image').length,1);assert.equal(r.blocks.filter(n=>n.type.name==='horizontal_rule').length,0);
 await r.api.startGallery126();assert.equal(r.blocks.filter(n=>n.type.name==='horizontal_rule').length,127);assert.equal(r.events.filter(event=>event==='upload-1').length,1);assert.equal(JSON.parse(r.local.get(RUN)).stage,'images_ready');
});

test('an uploaded but unrecorded image stops resume before any second native upload',async()=>{
 const r=runtime();r.c.api.patch(`recordImage=()=>{throw Error('interrupted before record')};`);
 await r.api.startGallery126();assert.equal(r.blocks.filter(n=>n.type.name==='image').length,1);
 await r.api.startGallery126();assert.equal(r.blocks.filter(n=>n.type.name==='image').length,1);assert.equal(r.events.filter(event=>event.startsWith('upload-')).length,1);assert.match(r.c.statuses.at(-1),/保存記録のない画像/);
});

test('saved proof is bound to the creator, key and publication date rather than a truthy flag',()=>{
 const r=runtime();assert.equal(r.api.validateGalleryRows(plan()).length,126);
 for(const mutate of [row=>row.oldestEvidence={},row=>row.key='n000000000999',row=>row.oldestEvidence.creator='other',row=>row.oldestEvidence.key='n000000000999',row=>row.oldestEvidence.publishAt='2025-02-01T00:00:00Z',row=>row.oldestVerified=false]){
  const rows=plan();mutate(rows[0]);assert.throws(()=>r.api.validateGalleryRows(rows),/1人目/);
 }
});

test('the gallery permits only the exact performance article as its one final row',()=>{
 const r=runtime(),rows=[...plan(),final(127)];
 assert.equal(r.api.validateGalleryRows(rows).length,127);
 for(const mutate of [row=>row.index=126,row=>row.urlname='other',row=>row.key='n000000000999',row=>row.url='https://note.com/fuku444/n/n000000000999',row=>row.gallery126=true]){
  const candidate=[...plan(),final(127)];mutate(candidate.at(-1));assert.throws(()=>r.api.validateGalleryRows(candidate),/最後の実績の算数/);
 }
 assert.throws(()=>r.api.validateGalleryRows([...rows,final(128)]),/不足|最初の記事/);
 assert.throws(()=>r.api.assertGalleryPaste(r.view,plan()),/最後の実績の算数/);
});

test('a completed125 plus final run adds only the missing profile image in source position88',async()=>{
 const r=runtime();const old=await seedLegacy125(r),beforeImages=r.blocks.filter(block=>block.type.name==='image'),oldStyles=new Map(Array.from(old.rows).filter(row=>!row.finalMarker).map(row=>[row.url,row.designIndex]));
 const card=r.insert(r.blocks.length,r.node('embed','通知カード',{src:old.rows[0].url})).node;
 await assert.rejects(r.api.ensureCardsRunReady(r.view),/126人|記事なし/);
 await r.api.startGallery126(false);const run=r.api.readRun();
 assert.equal(run.rows.length,127);assert.equal(run.count,126);assert.equal(run.galleryAvailableOnly,false);assert.equal(run.items.length,127);assert.equal(run.activityTexts.length,126);
 assert.equal(run.rows[87].profileOnly,true);assert.equal(run.rows[87].url,profileOnly().url);assert.equal(run.rows.at(-1).index,127);
 assert.deepEqual(r.events.filter(event=>event.startsWith('upload-')),['upload-88']);assert.equal(r.events.filter(event=>event==='prepare-final').length,0);
 for(const image of beforeImages)assert.ok(r.blocks.includes(image));assert.ok(r.blocks.includes(card));assert.deepEqual(Array.from(run.cardKeys),['existing-card']);
 for(const row of run.rows)if(oldStyles.has(row.url))assert.equal(row.designIndex,oldStyles.get(row.url));
 assert.equal(new Set(run.rows.filter(row=>row.gallery126).map(row=>row.designIndex)).size,126);
 assert.deepEqual(r.blocks.filter(block=>block.type.name==='image').map(block=>block.attrs.link),[...fullPlan().map(row=>row.url),FINAL_URL]);
 assert.equal(r.blocks.filter(block=>block.type.name==='heading').at(-2).textContent,'13｜121人目〜126人目のクリエイター様');
 for(let block=0;block<13;block++){const row=run.rows[block*10],imageAt=r.blocks.findIndex(node=>node.type.name==='image'&&node.attrs.link===row.url);assert.equal(r.blocks[imageAt-1].type.name,'paragraph');assert.equal(r.blocks[imageAt-2].textContent,String(block+1).padStart(2,'0')+'｜'+(block*10+1)+'人目〜'+Math.min(126,(block+1)*10)+'人目のクリエイター様')}
 assert.equal(run.galleryParticipantUpgrade.previousPauseStage,'cards');assert.equal(run.galleryParticipantUpgrade.pendingHeadings,false);assert.equal((await r.api.ensureCardsRunReady(r.view)).rows.length,127);
 const count=r.blocks.length;await r.api.startGallery126();assert.equal(r.blocks.length,count);assert.deepEqual(r.events.filter(event=>event.startsWith('upload-')),['upload-88']);
});

test('legacy125 without a final image adds only profile88 and the one fixed final',async()=>{
 const r=runtime();await seedLegacy125(r,{withoutFinal:true});await r.api.startGallery126();const run=r.api.readRun();
 assert.equal(run.rows.length,127);assert.equal(run.items.length,127);assert.deepEqual(r.events.filter(event=>event.startsWith('upload-')),['upload-88','upload-127']);assert.equal(r.events.filter(event=>event==='prepare-final').length,1);assert.equal(run.rows.at(-1).url,FINAL_URL);
});

test('a failed migration image keeps existing125 images and retries only its missing source position',async()=>{
 const r=runtime();await seedLegacy125(r);const images=r.blocks.filter(node=>node.type.name==='image');r.c.api.patch(`globalThis.readyMakeFile=makeFile;makeFile=async row=>{if(row.profileOnly)throw Error('profile render failed');return readyMakeFile(row)}`);
 await r.api.startGallery126();assert.equal(r.api.readRun().rows.length,127);assert.equal(r.api.readRun().items.length,126);assert.match(r.c.statuses.at(-1),/profile render failed/);assert.deepEqual(r.blocks.filter(node=>node.type.name==='image'),images);
 r.c.api.patch(`makeFile=readyMakeFile`);await r.api.startGallery126();assert.deepEqual(r.events.filter(event=>event.startsWith('upload-')),['upload-88']);assert.equal(r.api.readRun().stage,'images_ready');
});

test('deleting an ordinary recorded middle image stops before any replacement upload',async()=>{
 for(const removeRecord of [false,true]){
  const r=runtime();await r.api.startGallery126();const run=r.api.readRun(),at=r.blocks.findIndex(node=>node.type.name==='image'&&node.attrs.link===run.rows[3].url),removed=r.blocks[at];
  r.blocks.splice(at,2);r.insert(r.blocks.length,r.node('paragraph','手編集は保持'));
  if(removeRecord)r.api.writeRun({...run,items:Array.from(run.items).filter(item=>item.id!==removed.attrs.id)});
  const before=r.blocks.slice();r.events.length=0;await r.api.startGallery126();assert.deepEqual(r.blocks,before);assert.equal(r.events.filter(event=>event.startsWith('upload-')).length,0);assert.match(r.c.statuses.at(-1),/件数が一致|追加対象以外/);
 }
});

test('partial old125 migration preserves its completed tail and uploads the new source88 only once',async()=>{
 const r=runtime();await seedLegacy125(r);const saved=r.api.readRun(),images=r.blocks.filter(node=>node.type.name==='image'),last=images[87],lastAt=r.blocks.indexOf(last);
 r.blocks.splice(lastAt+2);r.insert(r.blocks.length,r.node('paragraph','元の後続本文'));
 const oldProfileKeys=new Set(saved.rows.slice(0,88).map(row=>row.url)),profiles=Object.fromEntries(Object.entries(saved.galleryProfileTexts).filter(([url])=>oldProfileKeys.has(url)));
 r.api.writeRun({...saved,items:Array.from(saved.items).slice(0,88),activityTexts:Array.from(saved.activityTexts).slice(0,88),galleryProfileTexts:profiles,stage:'images_building',sectionHeadings:Array.from(saved.sectionHeadings).filter(text=>!text.startsWith('10｜')&&!text.startsWith('11｜')&&!text.startsWith('12｜')&&!text.startsWith('13｜')&&text!=='最後に｜実績の算数')});
 const preserved=images.slice(0,88);r.events.length=0;await r.api.startGallery126();const run=r.api.readRun();assert.equal(run.stage,'images_ready');assert.equal(run.items.length,127);
 for(const image of preserved)assert.ok(r.blocks.includes(image));assert.equal(r.events.filter(event=>event==='upload-88').length,1);assert.equal(r.events.filter(event=>event==='upload-89').length,0);assert.ok(r.blocks.some(node=>node.textContent==='元の後続本文'));
});

test('pause immediately after the added profile image resumes heading migration without another upload',async()=>{
 const r=runtime();await seedLegacy125(r);r.c.api.patch(`globalThis.savedMigrationUpload=uploadOne;uploadOne=async(view,row,file,pos)=>{const made=await savedMigrationUpload(view,row,file,pos);if(row.profileOnly)pauseFix();return made}`);
 await r.api.startGallery126();assert.equal(r.api.readRun().paused,true);assert.equal(r.api.readRun().items.length,127);assert.equal(r.api.readRun().galleryParticipantUpgrade.pendingHeadings,true);
 await r.api.startGallery126();assert.equal(r.api.readRun().stage,'images_ready');assert.equal(r.api.readRun().galleryParticipantUpgrade.pendingHeadings,false);assert.deepEqual(r.events.filter(event=>event.startsWith('upload-')),['upload-88']);
});

test('a failed final image keeps every creator and prevents notification card completion until retry',async()=>{
 const r=runtime();r.c.api.patch(`globalThis.savedFinalMakeFile=makeFile;makeFile=async row=>{if(row.finalMarker)throw Error('final image unavailable');return savedFinalMakeFile(row)};`);
 await r.api.startGallery126();assert.equal(r.api.readRun().rows.length,127);assert.equal(r.blocks.filter(block=>block.type.name==='image').length,126);
 await assert.rejects(r.api.ensureCardsRunReady(r.view),/126\/127/);
 r.c.api.patch(`makeFile=savedFinalMakeFile;`);await r.api.startGallery126();
 assert.equal(r.blocks.filter(block=>block.type.name==='image').length,127);assert.equal(r.events.filter(event=>event==='upload-1').length,1);assert.equal(r.events.filter(event=>event==='prepare-final').length,1);
 assert.equal((await r.api.ensureCardsRunReady(r.view)).rows.at(-1).url,FINAL_URL);
});

test('pausing during a native upload saves that image and divider before stopping and resumes only the remaining rows',async()=>{
 const r=runtime();r.c.api.patch(`globalThis.beforePauseUpload=uploadOne;uploadOne=async(view,row,file,pos)=>{const made=await beforePauseUpload(view,row,file,pos);if(row.index===2)pauseFix();return made};`);
 await r.api.startGallery126();
 const paused=r.api.readRun();assert.equal(paused.paused,true);assert.equal(paused.pauseStage,'images');assert.equal(paused.items.length,2);
 assert.equal(r.blocks.filter(block=>block.type.name==='image').length,2);assert.equal(r.blocks.filter(block=>block.type.name==='horizontal_rule').length,2);assert.match(r.c.statuses.at(-1),/一時停止/);
 await r.api.startGallery126();
 assert.equal(r.api.readRun().stage,'images_ready');assert.equal(r.blocks.filter(block=>block.type.name==='image').length,127);assert.equal(r.events.filter(event=>event==='upload-1').length,1);assert.equal(r.events.filter(event=>event==='upload-2').length,1);
});

test('unavailable final metadata is retried without saving an unrecoverable empty thumbnail or disturbing completed creators',async()=>{
 const r=runtime();r.c.api.patch(`globalThis.beforeFinalMetadata= enrichFinal;globalThis.beforeFinalRender=makeFile;makeFile=async row=>{if(row.index===2)throw Error('pause creator preparation');return beforeFinalRender(row)};`);
 await r.api.startGallery126();
 const saved=r.api.readRun();assert.equal(saved.items.length,1);r.api.writeRun({...saved,version:'2.6.4',rows:Array.from(saved.rows).slice(0,-1)});
 r.c.api.patch(`enrichFinal=async index=>({index,urlname:'fuku444',creator:'実績の算数',key:'nb4f6934381e9',url:'${FINAL_URL}',thumbUrl:'',finalMarker:true});makeFile=beforeFinalRender;`);
 await r.api.startGallery126();assert.equal(r.api.readRun().rows.length,126);assert.equal(r.api.readRun().items.length,1);assert.match(r.c.statuses.at(-1),/実績の算数のサムネイルを取得できません/);
 r.c.api.patch(`enrichFinal=beforeFinalMetadata;`);await r.api.startGallery126();
 assert.equal(r.api.readRun().rows.length,127);assert.equal(r.api.readRun().stage,'images_ready');assert.equal(r.events.filter(event=>event==='upload-1').length,1);
});

test('six-person article preparation checkpoints completed creators and retries only missing ones',async()=>{
 const r=runtime();r.c.active=0;r.c.maxActive=0;r.c.failed=true;r.c.calls=[];
 // Restore the actual preparation/checkpoint workflow after replacing it only
 // for the native-paste tests above.
 const start=source.indexOf('async function buildGalleryRows('),end=source.indexOf('\nfunction assertGalleryTracking',start);
 r.c.api.patch(`buildGalleryRows=globalThis.api.buildGalleryRows;prepareGalleryPerson=async(person,index)=>{active++;maxActive=Math.max(maxActive,active);calls.push(index);await new Promise(resolve=>setTimeout(resolve,index%2?1:3));active--;if(failed&&index===2)throw Error('read failed');return rows[index]};`);
 await assert.rejects(r.api.buildGalleryRows(),/read failed/);assert.equal(r.c.maxActive,6);
 const checkpoint=JSON.parse(r.local.get('mumei_profile_gallery126_v263:'+ARTICLE));assert.equal(checkpoint.rows.filter(Boolean).length,5);
 r.c.failed=false;const rows=await r.api.buildGalleryRows();assert.equal(rows.length,126);assert.equal(r.c.calls.filter(index=>index===0).length,1);assert.equal(r.c.calls.filter(index=>index===2).length,2);
});

test('another saved batch is kept intact and no likes-history bridge is used for gallery126',async()=>{
 const r=runtime(),existing={articleKey:ARTICLE,rows:[{url:'old'}],items:[],likesHistoryFix230:true};r.api.writeRun(existing);
 await r.api.startGallery126();assert.deepEqual(JSON.parse(r.local.get(RUN)).rows,existing.rows);assert.match(r.c.statuses.at(-1),/別の作成分/);
});

test('verified embedded participant data starts without repeating126 profile and publication lookups',async()=>{
 const r=runtime();r.page.__MUMEI_PROFILE_CARD_GALLERY_MANIFEST__={...manifest,preparedRows:plan()};
 const start=source.indexOf('async function buildGalleryRows('),end=source.indexOf('\nfunction assertGalleryTracking',start);
 r.c.api.patch(`buildGalleryRows=globalThis.api.buildGalleryRows;prepareGalleryPerson=async()=>{throw Error('metadata must not be refetched')};`);
 const rows=await r.api.buildGalleryRows();assert.equal(rows.length,126);assert.deepEqual(Array.from(rows,row=>row.key),plan().map(row=>row.key));
});

test('gallery image downloads use a bounded CDN size while retaining the exact image path and other parameters',()=>{
 const {api}=runtime(),raw='https://assets.st-note.com/production/image.png?width=2400&format=png&fit=bounds';
 const sized=new URL(api.galleryAssetUrl(raw,720));assert.equal(sized.pathname,new URL(raw).pathname);assert.equal(sized.searchParams.get('width'),'720');assert.equal(sized.searchParams.get('format'),'png');assert.equal(sized.searchParams.get('fit'),'bounds');
 assert.equal(new URL(api.galleryAssetUrl(raw.replace('2400','100'),180)).searchParams.get('width'),'100');
 assert.equal(api.galleryAssetUrl('https://example.com/image.png?width=2400',720),'https://example.com/image.png?width=2400');
});

test('live preparation preserves a plaintext biography and rejects malformed or mismatched account responses',async()=>{
 const r=runtime(),person=manifest.people[0];r.c.selected=plan()[0];
 r.c.profileFixture={data:{urlname:person.urlname,nickname:'現在の表示名',profile:'<AI> の作品 & 50% \\ 記号\n本文',profileImageUrl:''}};
 r.c.api.patch(`page.__MUMEI_PROFILE_CARD_GALLERY__.chooseOldestArticle=async()=>selected;xhrJSON=async()=>profileFixture;`);
 const row=await r.api.prepareGalleryPerson(person,0);assert.equal(row.creator,'現在の表示名');assert.equal(row.profileText,r.c.profileFixture.data.profile);assert.equal(row.key,plan()[0].key);assert.equal(row.avatarMissing,true);
 for(const data of [{urlname:'other',nickname:'別人',profile:'文'},{nickname:'本人か不明',profile:'文'},{error:'temporarily unavailable'},{urlname:person.urlname,nickname:'本人',profile:{bad:'value'}}]){
  r.c.profileFixture={data};await assert.rejects(r.api.prepareGalleryPerson(person,0),/プロフィール/);
 }
 r.c.profileFixture={data:{urlname:person.urlname,nickname:'本人',profile:''}};
 assert.equal((await r.api.prepareGalleryPerson(person,0)).profileText,'');
});

test('gallery refuses an editor page without a unique draft identity before inserting or saving any batch',async()=>{
 const r=runtime();r.c.location=new URL('https://editor.note.com/notes/new');await r.api.startGallery126();
 assert.equal(r.blocks.length,0);assert.equal(r.local.size,0);assert.match(r.c.statuses.at(-1),/保存先を確認できません/);
});

test('a verified first article without a configured thumbnail stays eligible with a blank image area',async()=>{
 const r=runtime(),person=manifest.people[0];r.c.selected={...plan()[0],thumbUrl:''};
 r.c.profileFixture={data:{urlname:person.urlname,nickname:'本人',profile:'実際の紹介'}};
 r.c.noteFixture={data:{key:r.c.selected.key,user:{urlname:person.urlname},eyecatch:null}};
 r.c.api.patch(`page.__MUMEI_PROFILE_CARD_GALLERY__.chooseOldestArticle=async()=>selected;xhrJSON=async url=>url.includes('/api/v3/notes/')?noteFixture:profileFixture;articleMetaImage=async()=>{throw Error('an unconfigured image must not need another download')};`);
 const row=await r.api.prepareGalleryPerson(person,0);
 assert.equal(row.url,r.c.selected.url);assert.equal(row.key,r.c.selected.key);assert.equal(row.profileText,'実際の紹介');assert.equal(row.thumbUrl,'');assert.equal(row.articleThumbnailMissing,true);
 assert.equal(row.thumbnailMissingEvidence.key,row.key);assert.equal(row.thumbnailMissingEvidence.articleUrl,row.url);
 r.c.noteFixture={data:{eyecatch:null}};
 await assert.rejects(r.api.prepareGalleryPerson(person,0),/unconfigured image must not need another download/);
});

test('new gallery builds include the verified zero-article participant rather than silently using available125',async()=>{
 const r=runtime(),seed=plan();seed[missingIndex]=null;
 r.page.__MUMEI_PROFILE_CARD_GALLERY_MANIFEST__={...manifest,pendingPeople:knownPending(),preparedRows:seed};r.c.rows=fullPlan();
 r.c.api.patch(`buildGalleryRows=globalThis.api.buildGalleryRows;prepareGalleryPerson=async(person,index)=>{if(index!==87)throw Error('completedmetadata refetched');return rows[index]}`);
 await r.api.startGallery126(true);const run=r.api.readRun();assert.equal(run.count,126);assert.equal(run.rows.length,127);assert.equal(run.galleryAvailableOnly,false);assert.equal(run.pendingPeople.length,0);assert.equal(run.rows[87].profileOnly,true);assert.equal(run.stage,'images_ready');
 assert.equal(r.blocks.filter(node=>node.type.name==='image').length,127);assert.equal(r.blocks.filter(node=>node.type.name==='paragraph').length,126);assert.equal(new Set(run.rows.filter(row=>row.gallery126).map(row=>row.designIndex)).size,126);
});

test('profile-only proof cannot fabricate an article, another creator or an unverified empty account',()=>{
 const r=runtime();r.page.__MUMEI_PROFILE_CARD_GALLERY_MANIFEST__={...manifest,pendingPeople:knownPending()};assert.equal(r.api.validateGalleryRows(fullPlan()).length,126);
 for(const change of [row=>row.key='n000000000999',row=>row.title='fake article',row=>row.url='https://note.com/other',row=>row.noPublicArticleEvidence.noteCount=1,row=>row.noPublicArticleEvidence.creator='other',row=>row.noPublicArticleEvidence.source='assumed',row=>row.noPublicArticleEvidence.checkedAt='invalid',row=>row.oldestVerified=true]){const rows=fullPlan();change(rows[87]);assert.throws(()=>r.api.validateGalleryRows(rows),/88人目/)}
 r.page.__MUMEI_PROFILE_CARD_GALLERY_MANIFEST__=manifest;assert.throws(()=>r.api.validateGalleryRows(fullPlan()),/88人目/);
});

test('only a live matched zero profile and both empty lists can create the icon-name-only row',async()=>{
 const r=runtime(),person=manifest.people[87];r.page.__MUMEI_PROFILE_CARD_GALLERY_MANIFEST__={...manifest,pendingPeople:knownPending()};r.c.profileFixture={data:{urlname:person.urlname,nickname:'やと',profile:'<AI> の紹介全文',profileImageUrl:'https://assets.st-note.com/live.png',noteCount:0}};r.c.emptyFixture={data:{contents:[],totalCount:0,isLastPage:true}};r.c.requests=[];
 r.c.api.patch(`page.__MUMEI_PROFILE_CARD_GALLERY__.chooseOldestArticle=async()=>{throw Object.assign(Error('no article'),{code:'NO_PUBLIC_ARTICLE'})};xhrJSON=async url=>{requests.push(url);return url.includes('/contents?')?emptyFixture:profileFixture}`);
 const row=await r.api.prepareGalleryPerson(person,87);assert.equal(row.profileOnly,true);assert.equal(row.key,'');assert.equal(row.url,'https://note.com/'+person.urlname);assert.equal(row.thumbUrl,'');assert.equal(row.title,'');assert.equal(row.profileText,'<AI> の紹介全文');assert.equal(row.actorImageUrl,'https://assets.st-note.com/live.png');assert.equal(row.noPublicArticleEvidence.contentsTotal,0);assert.ok(r.c.requests.some(url=>url.includes('disabled_pinned=false')));
 r.c.profileFixture.data.noteCount=1;await assert.rejects(r.api.prepareGalleryPerson(person,87),/公開記事数/);r.c.profileFixture.data.noteCount=0;r.c.emptyFixture={data:{contents:[],totalCount:0,isLastPage:false}};await assert.rejects(r.api.prepareGalleryPerson(person,87),/確認結果/);
 await assert.rejects(r.api.prepareGalleryPerson(manifest.people[0],0),error=>error.code==='NO_PUBLIC_ARTICLE');
 r.c.emptyFixture={data:{contents:[],totalCount:0,isLastPage:true}};r.c.selected=plan()[87];r.c.profileFixture.data.noteCount=1;r.c.api.patch(`page.__MUMEI_PROFILE_CARD_GALLERY__.chooseOldestArticle=async()=>selected`);const posted=await r.api.prepareGalleryPerson(person,87);assert.equal(posted.key,r.c.selected.key);assert.equal(posted.profileOnly,undefined);
});

test('the committed live snapshot keeps125 audited first articles, one known pending creator and the exact image-unset proof',()=>{
 const r=runtime();r.page.__MUMEI_PROFILE_CARD_GALLERY_MANIFEST__=committedManifest;
 const active=committedManifest.preparedRows.flatMap((row,index)=>row?[{...row,gallerySourceIndex:index+1,galleryAvailableOnly:true}]:[]).map((row,index)=>({...row,index:index+1}));
 assert.equal(r.api.validateGalleryRows(active).length,125);assert.equal(new Set(active.map(row=>row.key)).size,125);
 assert.equal(committedManifest.pendingPeople.length,1);assert.equal(committedManifest.pendingPeople[0].urlname,'noted_yatoasuter');assert.equal(committedManifest.pendingPeople[0].noteCount,0);
 assert.ok(active.every(row=>Number.isFinite(Date.parse(row.firstPageFreshAuditAt))));
 const missing=active.filter(row=>row.articleThumbnailMissing);assert.equal(missing.length,1);assert.equal(missing[0].urlname,'furikakemen');assert.equal(missing[0].thumbnailMissingEvidence.key,missing[0].key);assert.equal(missing[0].thumbnailMissingEvidence.articleUrl,missing[0].url);
});
