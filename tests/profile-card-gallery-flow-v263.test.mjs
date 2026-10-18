import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync('public/note-profile-card-paster-v22.user.js','utf8');
const helper=readFileSync('public/note-profile-card-gallery-v263.js','utf8');
const committedManifest=JSON.parse(readFileSync('public/note-profile-card-halloween126.json','utf8'));
const manifest={...committedManifest,preparedRows:[],pendingPeople:[]};
const ARTICLE='n123456789abc',RUN='mumei_profile_card_paster_run_v15:'+ARTICLE;
const plan=()=>manifest.people.map((person,index)=>{
 const key='n'+(index+1).toString(16).padStart(12,'0'),publishAt='2025-01-01T00:00:00+09:00';
 return{...person,index:index+1,likerKey:person.urlname,url:'https://note.com/'+person.urlname+'/n/'+key,key,publishAt,thumbUrl:'https://assets.st-note.com/'+key+'.png',actorImageUrl:'',profileText:'本人のプロフィール '+index,gallery126:true,finalMarker:false,articleSelection:'oldest-confirmed',oldestVerified:true,oldestEvidence:{creator:person.urlname,key,publishAt,terminalPage:2,pagesChecked:[1,2,3],verifiedAt:'2026-10-18T07:00:00Z'}};
});
function runtime(){
 const local=new Map(),gm=new Map(),page={__MUMEI_PROFILE_CARD_GALLERY_MANIFEST__:manifest};
 const context=vm.createContext({unsafeWindow:page,window:{addEventListener(){},dispatchEvent(){},Event},document:{getElementById:()=>null},location:new URL('https://editor.note.com/notes/'+ARTICLE+'/edit'),URL,Event,Intl,localStorage:{getItem:key=>local.get(key)??null,setItem:(key,value)=>local.set(key,String(value)),removeItem:key=>local.delete(key)},GM_getValue:(key,fallback)=>gm.get(key)??fallback,GM_setValue:(key,value)=>gm.set(key,value),GM_xmlhttpRequest(){throw Error('unexpected network')},setTimeout,clearTimeout,setInterval:()=>1,clearInterval(){},console});
 vm.runInContext(helper,context);
 const code=source.replace('const sleep=','let sleep=').replace(/let attempts=0;[\s\S]*?\n\}\)\(\);\s*$/,`globalThis.api={patch:code=>eval(code),startGallery126,createFixed300,validateGalleryRows,buildGalleryRows,prepareGalleryPerson,activityText,readRun,writeRun,assignDesigns,assertGalleryPaste,assertGalleryTracking,ensureCardsRunReady,galleryAssetUrl};})();`);
 vm.runInContext(code,context);
 const blocks=[],events=[];let generation=0;
 const node=(type,text='',attrs={})=>({type:{name:type},attrs,textContent:text,nodeSize:1,toJSON(){return{type,attrs,text}}});
 const makeDoc=()=>({generation:generation++,content:{size:blocks.length},nodeAt:pos=>blocks[pos]||null,descendants(fn){blocks.forEach((block,pos)=>fn(block,pos))}});
 const view={state:{doc:makeDoc(),selection:{from:0}}};
 const insert=(pos,value)=>{blocks.splice(pos,0,value);view.state.doc=makeDoc();return{pos,nextPos:pos+1,node:value}};
 context.view=view;context.events=events;context.rows=plan();context.insert=insert;context.node=node;context.blocks=blocks;context.statuses=[];
 context.api.patch(`
 sleep=async()=>{};findView=()=>view;nativeImageCommand=()=>{};selectionApi=()=>{};cardAnchorFromSelection=()=>0;
 setStatus=text=>statuses.push(text);buildGalleryRows=async()=>rows;
 insertHeadingAt=(view,text,pos)=>insert(pos,node('heading',text));
 insertActivityAt=(view,row,pos)=>({...insert(pos,node('paragraph',activityText(row))),text:activityText(row)});
 isDivider=(view,n)=>n?.type?.name==='horizontal_rule';
 addDivider=(view,hit,row)=>insert(hit.pos+1,node('horizontal_rule')).nextPos;
 makeFile=async row=>{events.push('render-'+row.index);return{index:row.index}};
 uploadOne=async(view,row,file,pos)=>{if(file.index!==row.index)throw Error('prefetch order mismatch');events.push('upload-'+row.index);await new Promise(resolve=>setTimeout(resolve,1));const result=insert(pos,node('image',row.creator+'さん',{id:'image-'+row.index,src:'https://assets.st-note.com/'+row.index+'.png',link:row.url}));events.push('uploaded-'+row.index);return{hit:{pos:result.pos,node:result.node},nextPos:result.nextPos}};
 `);
 return{api:context.api,c:context,page,local,gm,blocks,view,insert,node,events};
}

test('126 real manifest identities produce exactly126 distinct introductions with earliest links, profiles and13 headings',async()=>{
 const r=runtime();await r.api.startGallery126();const run=JSON.parse(r.local.get(RUN));
 assert.equal(run.stage,'images_ready');assert.equal(run.count,126);assert.equal(run.rows.length,126);assert.equal(run.choice,'oldest');assert.equal(run.likesHistory,false);assert.equal(run.gallery126,true);
 assert.equal(new Set(run.rows.map(row=>row.designIndex)).size,126);
 assert.equal(r.blocks.filter(n=>n.type.name==='image').length,126);assert.equal(r.blocks.filter(n=>n.type.name==='paragraph').length,126);assert.equal(r.blocks.filter(n=>n.type.name==='horizontal_rule').length,126);
 const headings=r.blocks.filter(n=>n.type.name==='heading');assert.equal(headings.length,13);assert.equal(headings.at(-1).textContent,'13｜121人目〜126人目のクリエイター様');
 assert.deepEqual(r.blocks.filter(n=>n.type.name==='image').map(n=>n.attrs.link),plan().map(row=>row.url));
 assert.ok(r.blocks.filter(n=>n.type.name==='paragraph').every(n=>n.textContent.startsWith('$${\\footnotesize')&&n.textContent.endsWith('}$$')));
 assert.ok(r.blocks.filter(n=>n.type.name==='image').every((n,i)=>n.textContent===manifest.people[i].creator+'さん'));
 assert.ok(r.events.indexOf('render-2')<r.events.indexOf('uploaded-1'));
 for(let i=1;i<126;i++)assert.ok(r.events.indexOf('upload-'+(i+1))>r.events.indexOf('uploaded-'+i));
 const before=r.blocks.length,styles=run.rows.map(row=>row.designIndex);await r.api.startGallery126();
 assert.equal(r.blocks.length,before);assert.deepEqual(JSON.parse(r.local.get(RUN)).rows.map(row=>row.designIndex),styles);
});

test('gallery PNG failure stops at that creator and resumes without skips, extra rows or repeated completed uploads',async()=>{
 const r=runtime();r.c.api.patch(`const oldMakeFile=makeFile;makeFile=async row=>{if(row.index===4)throw Object.assign(Error('image failed'),{code:'ASSET_UNAVAILABLE'});return oldMakeFile(row)};`);
 await r.api.startGallery126();assert.equal(r.blocks.filter(n=>n.type.name==='image').length,3);assert.match(r.c.statuses.at(-1),/image failed/);
 r.c.api.patch(`makeFile=async row=>({index:row.index});`);await r.api.startGallery126();
 assert.equal(r.blocks.filter(n=>n.type.name==='image').length,126);assert.equal(JSON.parse(r.local.get(RUN)).rows.length,126);assert.equal(new Set(r.blocks.filter(n=>n.type.name==='image').map(n=>n.attrs.link)).size,126);
 assert.equal(r.events.filter(event=>event==='upload-1').length,1);assert.equal(JSON.parse(r.local.get(RUN)).stage,'images_ready');
});

test('a divider missing after an interruption is repaired before moving to the next creator',async()=>{
 const r=runtime();r.c.api.patch(`const originalDivider=addDivider;let fail=true;addDivider=(view,hit,row)=>{if(fail){fail=false;throw Error('interrupted before divider')}return originalDivider(view,hit,row)};`);
 await r.api.startGallery126();assert.equal(r.blocks.filter(n=>n.type.name==='image').length,1);assert.equal(r.blocks.filter(n=>n.type.name==='horizontal_rule').length,0);
 await r.api.startGallery126();assert.equal(r.blocks.filter(n=>n.type.name==='horizontal_rule').length,126);assert.equal(r.events.filter(event=>event==='upload-1').length,1);assert.equal(JSON.parse(r.local.get(RUN)).stage,'images_ready');
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

test('the explicitly selected available125 course keeps the zero-article creator pending and preserves original identities',async()=>{
 const r=runtime(),missingIndex=87,seed=plan();seed[missingIndex]=null;
 r.page.__MUMEI_PROFILE_CARD_GALLERY_MANIFEST__={...manifest,pendingPeople:[{urlname:manifest.people[missingIndex].urlname,reason:'NO_PUBLIC_ARTICLE',noteCount:0}],preparedRows:seed};
 const start=source.indexOf('async function buildGalleryRows('),end=source.indexOf('\nfunction assertGalleryTracking',start);
 r.c.api.patch(`buildGalleryRows=globalThis.api.buildGalleryRows;prepareGalleryPerson=async()=>{throw Error('available125 must not fetch the confirmed zero-article creator')};`);
 await r.api.startGallery126(true);const run=JSON.parse(r.local.get(RUN));
 assert.equal(run.rows.length,125);assert.equal(run.count,125);assert.equal(run.pendingPeople.length,1);assert.equal(run.galleryAvailableOnly,true);assert.equal(run.stage,'images_ready');
 assert.equal(run.rows[87].urlname,manifest.people[88].urlname);assert.equal(run.rows[87].index,88);assert.equal(run.rows[87].gallerySourceIndex,89);
 assert.ok(run.rows.every(row=>row.urlname!==manifest.people[missingIndex].urlname));
 assert.equal(new Set(run.rows.map(row=>row.designIndex)).size,125);assert.equal(r.blocks.filter(n=>n.type.name==='image').length,125);
 assert.equal(r.blocks.filter(n=>n.type.name==='heading').at(-1).textContent,'13｜121人目〜125人目のクリエイター様');
 assert.match(r.c.statuses.at(-1),/やとさん1人は記事公開待ち/);
 const before=r.blocks.length;await r.api.startGallery126(false);assert.equal(r.blocks.length,before);assert.match(r.c.statuses.at(-1),/125人の作成分を保持/);
});

test('the committed live snapshot keeps125 audited first articles, one known pending creator and the exact image-unset proof',()=>{
 const r=runtime();r.page.__MUMEI_PROFILE_CARD_GALLERY_MANIFEST__=committedManifest;
 const active=committedManifest.preparedRows.flatMap((row,index)=>row?[{...row,gallerySourceIndex:index+1,galleryAvailableOnly:true}]:[]).map((row,index)=>({...row,index:index+1}));
 assert.equal(r.api.validateGalleryRows(active).length,125);assert.equal(new Set(active.map(row=>row.key)).size,125);
 assert.equal(committedManifest.pendingPeople.length,1);assert.equal(committedManifest.pendingPeople[0].urlname,'noted_yatoasuter');assert.equal(committedManifest.pendingPeople[0].noteCount,0);
 assert.ok(active.every(row=>Number.isFinite(Date.parse(row.firstPageFreshAuditAt))));
 const missing=active.filter(row=>row.articleThumbnailMissing);assert.equal(missing.length,1);assert.equal(missing[0].urlname,'furikakemen');assert.equal(missing[0].thumbnailMissingEvidence.key,missing[0].key);assert.equal(missing[0].thumbnailMissingEvidence.articleUrl,missing[0].url);
});
