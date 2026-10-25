import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync('public/note-profile-card-paster-v22.user.js','utf8');
const ARTICLE='n123456789abc',RUN='mumei_profile_card_paster_run_v15:'+ARTICLE;
const people=count=>Array.from({length:count},(_,index)=>({urlname:'person'+index,likerKey:'key-'+index,creator:'人'+index,url:'https://note.com/person'+index+'/n/n'+index.toString(16).padStart(12,'0')}));
const final=index=>({index,urlname:'fuku444',creator:'実績の算数',likerKey:'final-performance-math',finalMarker:true,url:'https://note.com/fuku444/n/nb4f6934381e9'});
const plan=count=>[...people(count).map((row,index)=>({...row,index:index+1})),final(count+1)];
function runtime(count=10,mode='number',candidates=people(30)){
 const local=new Map(),gm=new Map([['mumei_profile_card_likes_300_v2',{at:123,people:candidates}]]);
 const panel={querySelector(selector){return selector==='[data-count]'?{value:String(count)}:selector==='[data-mode]'?{value:mode}:null}};
 const page={},context=vm.createContext({unsafeWindow:page,window:{addEventListener(){},dispatchEvent(){},Event},document:{getElementById:id=>id==='mumei-profile-card-paster-v1'?panel:null},location:new URL('https://editor.note.com/notes/'+ARTICLE+'/edit'),URL,Event,localStorage:{getItem:key=>local.get(key)??null,setItem:(key,value)=>local.set(key,String(value)),removeItem:key=>local.delete(key)},GM_getValue:(key,fallback)=>gm.get(key)??fallback,GM_setValue:(key,value)=>gm.set(key,value),GM_xmlhttpRequest(){throw Error('unexpected network')},setTimeout,clearTimeout,setInterval:()=>1,clearInterval(){},console});
 const code=source.replace('const sleep=','let sleep=').replace(/let attempts=0;[\s\S]*?\n\}\)\(\);\s*$/,`globalThis.api={patch:code=>eval(code),historyOptions,checkpointHistoryOptions,historyExportCount,uniquePeople,validateFixedRows,buildRows,replaceUnavailableCreator,createFixed300,restartFixed300,resumeFixed300,headingText,preparePerson,makeFile,refreshHistoryHeadings};})();`);
 vm.runInContext(code,context);
 context.final=final;context.statuses=[];context.headings=[];context.images=[];context.prepares=[];context.profileLines=[];
 context.view={state:{doc:{content:{size:100},nodeAt:()=>null,descendants(){}},selection:{from:0}}};
 context.api.patch(`sleep=async()=>{};preparePerson=async person=>({...person,profileText:'紹介'});findView=()=>view;nativeImageCommand=()=>{};selectionApi=()=>{};isDivider=()=>false;cardAnchorFromSelection=()=>0;ownedImages=()=>images;enrichFinal=async index=>final(index);makeFile=async()=>({});findHeading=()=>null;findActivity=()=>null;insertHeadingAt=(view,text,pos)=>{headings.push(text);return{nextPos:pos+1}};insertActivityAt=(view,row,pos)=>{profileLines.push(row.creator);return{text:activityText(row),nextPos:pos+1}};uploadOne=async(view,row,file,pos)=>{const hit={pos,node:{nodeSize:1,attrs:{id:'img-'+row.index,src:'https://assets.st-note.com/'+row.index+'.png',link:row.url}}};images.push(hit);return{hit,nextPos:pos+1}};addDivider=(view,hit)=>hit.pos+hit.node.nodeSize;setStatus=text=>statuses.push(text);`);
 return{context,api:context.api,page,local,gm,panel};
}
const plain=value=>JSON.parse(JSON.stringify(value));

for(const count of [2,12])test('the selected '+count+' creators plus one reserved article are uploaded in order',async()=>{
 const {context:c,api,local}=runtime(count);
 await api.createFixed300();
 const run=JSON.parse(local.get(RUN));
 assert.equal(run.count,count);assert.equal(run.rows.length,count+1);assert.equal(run.rows.at(-1).index,count+1);assert.equal(run.stage,'images_ready');
 assert.deepEqual(Array.from(c.images,hit=>hit.node.attrs.link),run.rows.map(row=>row.url));
 assert.equal(c.profileLines.length,count);
 assert.equal(c.headings[0],'01｜1人目〜'+Math.min(10,count)+'人目のクリエイター様');
 if(count===12)assert.equal(c.headings[1],'02｜11人目〜12人目のクリエイター様');
 assert.match(c.statuses.at(-1),new RegExp('極薄'+(count+1)+'件完了'));
});

test('the latest 200 distinct creators are selected before the cutoff, with aliases and the reserved final excluded',async()=>{
 const latest=people(260).map((person,index)=>({...person,creator:'同じ表示名',likedAt:new Date(Date.UTC(2026,9,25)-index*10000).toISOString()}));
 // Each newer row is followed immediately by two older records for the same
 // person, including a changed note ID and a differently cased profile URL.
 // Duplicated activity entries must not consume the 200-person quota.
 const candidates=latest.flatMap((person,index)=>[
  person,
  {...person,urlname:'former'+index,likedAt:new Date(Date.parse(person.likedAt)-1000).toISOString()},
  {...person,urlname:person.urlname.toUpperCase(),likerKey:'secondary-'+index,likedAt:new Date(Date.parse(person.likedAt)-2000).toISOString()}
 ]);
 candidates.unshift({urlname:'renamed-final',likerKey:'reserved',likedAt:'2026-10-25T00:01:00Z'});
 candidates.push({urlname:'FUKU444',likerKey:'reserved',likedAt:'2026-10-01T00:00:00Z'});
 const {context:c,api,local}=runtime(200,'number',candidates);
 assert.equal(api.historyExportCount(api.historyOptions()),600);
 assert.equal(api.uniquePeople(candidates).length,260);
 await api.createFixed300();
 const run=JSON.parse(local.get(RUN));
 assert.equal(run.count,200);assert.equal(run.rows.length,201);assert.equal(run.stage,'images_ready');
 assert.deepEqual(run.rows.slice(0,-1).map(row=>row.urlname),latest.slice(0,200).map(row=>row.urlname));
 assert.deepEqual(run.rows.slice(0,-1).map(row=>row.likedAt),latest.slice(0,200).map(row=>row.likedAt));
 assert.equal(new Set(run.rows.slice(0,-1).map(row=>row.likerKey)).size,200);
 assert.equal(new Set(run.rows.slice(0,-1).map(row=>row.urlname)).size,200);
 assert.equal(run.rows.at(-1).urlname,'fuku444');assert.equal(run.rows.at(-1).index,201);
 assert.equal(c.images.length,201);assert.equal(c.profileLines.length,200);
 assert.ok(run.rows.slice(0,-1).every(row=>row.profileLayout==='compact-v272'));
 assert.equal(run.activityTexts.length,200);
 assert.ok(run.activityTexts.every(text=>text.startsWith('$${\\scriptsize\\begin{array}{l}')||text.startsWith('$${\\tiny\\begin{array}{l}')));
 assert.equal(c.headings.length,21);
 assert.equal(c.headings[0],'01｜1人目〜10人目のクリエイター様');
 assert.equal(c.headings[19],'20｜191人目〜200人目のクリエイター様');
 assert.equal(c.headings[20],'最後に｜実績の算数');
 const prep=JSON.parse(local.get('mumei_profile_like300_fix_v230:'+ARTICLE));
 assert.equal(prep.index,200);assert.equal(prep.rows.length,200);
});

test('continue preserves a saved 200-person plan and its completed images when the input changes',async()=>{
 const {context:c,api,local}=runtime(12),rows=plan(200);
 local.set(RUN,JSON.stringify({articleKey:ARTICLE,version:'2.6.8',likesHistoryFix230:true,likesHistory:true,count:200,mode:'number',rows,items:[],imageAnchorPos:0,stage:'images_building'}));
 c.images=rows.map((row,pos)=>({pos,node:{nodeSize:1,attrs:{link:row.url}}}));
 c.api.patch(`buildRows=async()=>{throw Error('must not rebuild a resumed 200-person plan')};prepareInsightExport=async()=>{throw Error('must not export on resume')};uploadOne=async()=>{throw Error('must not repeat a completed image')};`);
 await api.resumeFixed300();
 const run=JSON.parse(local.get(RUN));
 assert.equal(run.count,200);assert.equal(run.rows.length,201);assert.equal(run.stage,'images_ready');
 assert.deepEqual(run.rows.map(row=>row.url),rows.map(row=>row.url));
 assert.equal(c.images.length,201);
});

test('the separate history reader defaults to 200 and requests only recent likes without changing saved account data',async()=>{
 const html=readFileSync('public/note-profile-card-paster-history-export.html','utf8'),script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
 assert.ok(script);
 for(const query of ['request=recent-200','request=recent-200&count=600&unique=1']){
  const storage=new Map([['mumei-insight-active-account-v3','tester'],['mumei-insight-access-token','test-token']]),before=Array.from(storage),requests=[],messages=[];
  const status={textContent:'',className:''},close={hidden:true},rows=people(200).map((person,index)=>({...person,likedAt:new Date(Date.UTC(2026,9,25)-index*1000).toISOString()}));
  const context=vm.createContext({
   document:{getElementById:id=>id==='status'?status:close},location:new URL('https://mumei-s.github.io/note-insight/note-profile-card-paster-history-export.html?'+query),URLSearchParams,
   localStorage:{getItem:key=>storage.get(key)??null,setItem(){throw Error('history export must not change account state')},removeItem(){throw Error('history export must not erase account state')}},
   window:{opener:{closed:false,postMessage:(message,origin)=>messages.push({message,origin})},close(){throw Error('unexpected synchronous close')}},
   fetch:async(url,options)=>{requests.push({url,options});return{ok:true,json:async()=>({ok:true,rows,member:{noteId:'tester'}})}},setTimeout:()=>1
  });
  vm.runInContext(script,context);await new Promise(resolve=>setImmediate(resolve));
  assert.equal(requests.length,1);
  assert.match(requests[0].url,/\/functions\/v1\/insight-likes-export$/);
  assert.deepEqual(JSON.parse(requests[0].options.body),{count:query.includes('count=600')?600:200,unique:true,scope:'recent-likes'});
  assert.equal(messages.length,1);assert.equal(messages[0].origin,'https://editor.note.com');
  assert.equal(messages[0].message.type,'MUMEI_INSIGHT_LIKES_V1');assert.equal(messages[0].message.count,200);
  assert.deepEqual(plain(messages[0].message.rows),rows);
  assert.deepEqual(Array.from(storage),before);
 }
});

test('whole history uses every eligible fetched creator and drops an unavailable image without requiring a replacement',async()=>{
 const {context:c,api,local}=runtime(10,'all',people(7));
 c.api.patch(`preparePerson=async person=>{if(person.urlname==='person1')throw Error('公開記事なし');return{...person,profileText:'紹介'}};makeFile=async row=>{if(row.urlname==='person5'){const error=Error('画像取得不可');error.code='ASSET_UNAVAILABLE';throw error}return{}};`);
 await api.createFixed300();
 const run=JSON.parse(local.get(RUN));
 assert.equal(run.mode,'all');assert.equal(run.count,5);assert.equal(run.rows.length,6);assert.equal(run.rows.at(-1).index,6);assert.equal(run.stage,'images_ready');
 assert.deepEqual(run.rows.slice(0,-1).map(row=>row.urlname),['person0','person2','person3','person4','person6']);
 assert.equal(run.imageSkipped[0].urlname,'person5');assert.match(c.statuses.at(-1),/極薄6件完了/);
});

test('continue preserves a saved twelve-person plan when the input has changed to two',async()=>{
 const {context:c,api,local}=runtime(2),rows=plan(12);
 local.set(RUN,JSON.stringify({articleKey:ARTICLE,version:'2.5.8',likesHistoryFix230:true,likesHistory:true,count:12,mode:'number',rows,items:[],imageAnchorPos:0,stage:'images_building'}));
 c.images=rows.map((row,pos)=>({pos,node:{nodeSize:1,attrs:{link:row.url}}}));
 c.api.patch(`buildRows=async()=>{throw Error('must not rebuild a resumed plan')};prepareInsightExport=async()=>{throw Error('must not export on resume')};`);
 await api.resumeFixed300();
 const run=JSON.parse(local.get(RUN));assert.equal(run.count,12);assert.equal(run.rows.length,13);assert.equal(run.stage,'images_ready');assert.match(c.statuses.at(-1),/極薄13件完了/);
});

test('first from twelve to two acquires a new valid plan before clearing only its owned paste',async()=>{
 const {context:c,api,local}=runtime(2),rows=plan(12);
 local.set(RUN,JSON.stringify({articleKey:ARTICLE,version:'2.5.8',likesHistoryFix230:true,likesHistory:true,count:12,mode:'number',rows,items:[],imageAnchorPos:0,stage:'images_ready'}));
 c.events=[];
 c.api.patch(`prepareInsightExport=async options=>{events.push('export-'+options.count)};clearCurrentPaste=(view,run)=>{events.push('clear-'+run.count);images.length=0;return 0};createFixed300=async()=>{events.push('create')};`);
 await api.restartFixed300();
 const run=JSON.parse(local.get(RUN));assert.equal(run.count,2);assert.equal(run.rows.length,3);assert.equal(run.rows.at(-1).index,3);assert.deepEqual(Array.from(c.events),['export-2','clear-12','create']);
 assert.ok(run.rows.slice(0,-1).every(row=>row.profileLayout==='compact-v272'));
});

test('starting the same prepared 200-person plan again selects compact profiles without refetching people',async()=>{
 const {context:c,api,local}=runtime(200),rows=plan(200);
 local.set(RUN,JSON.stringify({articleKey:ARTICLE,version:'2.7.1',likesHistoryFix230:true,likesHistory:true,count:200,mode:'number',rows,items:[],activityTexts:[],imageAnchorPos:0,stage:'images_building'}));
 c.events=[];
 c.api.patch(`prepareInsightExport=async()=>{throw Error('the same prepared plan must not refetch history')};clearCurrentPaste=()=>{events.push('clear');return 0};createFixed300=async()=>{events.push('create')};`);
 await api.restartFixed300();
 const run=JSON.parse(local.get(RUN));
 assert.deepEqual(Array.from(c.events),['clear','create']);
 assert.equal(run.rows.length,201);
 assert.ok(run.rows.slice(0,-1).every(row=>row.profileLayout==='compact-v272'));
 assert.deepEqual(run.rows.map(row=>row.url),rows.map(row=>row.url));
 assert.equal(run.rows.at(-1).finalMarker,true);assert.deepEqual(run.activityTexts,[]);
});

test('candidate requests include bounded headroom, and excessive requested counts are refused',()=>{
 const {api}=runtime(2);assert.equal(api.historyExportCount(api.historyOptions()),22);
 assert.equal(runtime(12).api.historyExportCount({mode:'number',count:12}),36);
 assert.equal(api.historyExportCount({mode:'number',count:1400}),1500);assert.equal(api.historyExportCount({mode:'all',count:10}),1500);
 assert.throws(()=>runtime(1501).api.historyOptions(),/1〜1500/);
 assert.equal(runtime().api.historyOptions().count,10);
 assert.equal(api.validateFixedRows(plan(300)).length,301);
 assert.equal(api.checkpointHistoryOptions({signature:'123|12|eligible-v251'}).count,12);
});

test('a replacement creator uses the freed design without repeating another of the 200 styles',async()=>{
 const {api}=runtime(200,'number',people(201));
 const rows=plan(200).map((row,index)=>({...row,designIndex:index%200}));
 const refreshed=await api.replaceUnavailableCreator(rows,70,new Error('画像取得不可'));
 assert.equal(refreshed.length,201);
 assert.deepEqual(Array.from(refreshed.slice(0,70),row=>[row.urlname,row.designIndex]),rows.slice(0,70).map(row=>[row.urlname,row.designIndex]));
 assert.equal(refreshed[199].urlname,'person200');
 assert.equal(refreshed[199].designIndex,70);
 assert.equal(new Set(Array.from(refreshed.slice(0,200),row=>row.designIndex)).size,200);
 assert.equal(refreshed[200].finalMarker,true);
});

test('parallel loading is capped at six, preserves input order, and checkpoints after skipped candidates',async()=>{
 const {context:c,api,local}=runtime(12,'number',people(20));c.active=0;c.maxActive=0;
 c.api.patch(`preparePerson=async person=>{active++;maxActive=Math.max(maxActive,active);await new Promise(resolve=>setTimeout(resolve,person.urlname==='person0'?12:1));active--;if(person.urlname==='person1')throw Error('公開記事なし');return person};`);
 const rows=await api.buildRows(12);
 assert.equal(c.maxActive,6);assert.deepEqual(Array.from(rows,row=>row.urlname),people(20).filter(row=>row.urlname!=='person1').slice(0,12).map(row=>row.urlname));
 const prep=JSON.parse(local.get('mumei_profile_like300_fix_v230:'+ARTICLE));assert.equal(prep.index,13);assert.equal(prep.skipped.length,1);assert.equal(prep.rows.length,12);
});

test('a slow upload fully completes before the next image begins even with the shorter gap',async()=>{
 const {context:c,api,local}=runtime(2);c.activeUploads=0;c.maxUploads=0;c.events=[];
 c.api.patch(`uploadOne=async(view,row,file,pos)=>{activeUploads++;maxUploads=Math.max(maxUploads,activeUploads);events.push('start-'+row.index);await new Promise(resolve=>setTimeout(resolve,6));const hit={pos,node:{nodeSize:1,attrs:{id:'img-'+row.index,src:'https://assets.st-note.com/'+row.index+'.png',link:row.url}}};images.push(hit);events.push('done-'+row.index);activeUploads--;return{hit,nextPos:pos+1}};`);
 await api.createFixed300();
 assert.equal(c.maxUploads,1);assert.deepEqual(Array.from(c.events),['start-1','done-1','start-2','done-2','start-3','done-3']);assert.equal(JSON.parse(local.get(RUN)).stage,'images_ready');
 assert.match(source,/const IMAGE_GAP=80/);assert.match(source,/await sleep\(70\)/);
});

test('whole-history reindexing maps the next insertion after a preceding group heading shrinks',async()=>{
 const {context:c,api,local}=runtime(10,'all',people(100)),rows=plan(100);
 local.set(RUN,JSON.stringify({articleKey:ARTICLE,version:'2.5.8',likesHistoryFix230:true,likesHistory:true,count:100,mode:'all',rows,items:[],imageAnchorPos:0,stage:'images_building'}));
 c.images=rows.slice(0,99).map((row,pos)=>({pos,node:{nodeSize:1,attrs:{link:row.url}}}));c.insertionPositions=[];
 c.api.patch(`makeFile=async row=>{if(row.urlname==='person99'){const error=Error('画像取得不可');error.code='ASSET_UNAVAILABLE';throw error}return{}};refreshHistoryHeadings=()=>({map:pos=>pos-1});uploadOne=async(view,row,file,pos)=>{insertionPositions.push(pos);const hit={pos,node:{nodeSize:1,attrs:{id:'final',src:'https://assets.st-note.com/final.png',link:row.url}}};images.push(hit);return{hit,nextPos:pos+1}};`);
 await api.createFixed300();
 assert.deepEqual(Array.from(c.insertionPositions),[99]);assert.equal(JSON.parse(local.get(RUN)).count,99);assert.equal(JSON.parse(local.get(RUN)).stage,'images_ready');
});

test('a creator with a public article and no configured icon remains eligible',async()=>{
 const {context:c,api}=runtime();
 c.DOMParser=class{parseFromString(value){return{body:{textContent:value},querySelector:()=>null}}};
 c.api.patch(`xhrJSON=async url=>url.includes('/contents?')?{data:{contents:[{key:'n123456789abc',name:'公開記事',eyecatch:'https://assets.st-note.com/thumb.png'}]}}:url.includes('/api/v3/')?{data:{name:'公開記事',eyecatch:'https://assets.st-note.com/thumb.png'}}:{data:{nickname:'花',profile:'本人の紹介',noteCount:1}};articleMetaImage=async()=>{throw Error('must not fetch article HTML when its thumbnail is already known')};`);
 const row=await api.preparePerson({urlname:'flower'});
 assert.equal(row.actorImageUrl,'');assert.equal(row.avatarMissing,true);assert.equal(row.thumbUrl,'https://assets.st-note.com/thumb.png');assert.equal(row.creator,'花');
});

test('an unset icon renders its initial beside the real thumbnail while a configured inaccessible icon still fails',async()=>{
 const {context:c,api,page}=runtime();c.paint=[];c.thumb={width:200,height:100,close(){}};
 const ctx=new Proxy({measureText:text=>({width:String(text).length*8}),fillText:(...args)=>c.paint.push({kind:'text',args}),drawImage:(...args)=>c.paint.push({kind:'image',image:args[0]})},{get(target,key){return key in target?target[key]:(()=>{})}});
 c.document.createElement=()=>({getContext:()=>ctx,toBlob:callback=>callback({png:true})});page.File=class{constructor(blobs,name,options){this.name=name;this.type=options.type;this.blobs=blobs}};
 c.api.patch(`bitmapFromUrl=async url=>url==='thumb'?thumb:null;`);
 const file=await api.makeFile({creator:'花',title:'公開記事',index:1,designIndex:0,actorImageUrl:'',thumbUrl:'thumb'});
 assert.equal(file.type,'image/png');assert.equal(c.paint.filter(item=>item.kind==='image').length,1);assert.equal(c.paint.find(item=>item.kind==='image').image,c.thumb);
 assert.ok(c.paint.some(item=>item.kind==='text'&&item.args[0]==='花'&&item.args[1]===50));
 await assert.rejects(api.makeFile({creator:'花',title:'公開記事',index:1,actorImageUrl:'https://assets.st-note.com/unavailable.png',thumbUrl:'thumb'}),error=>error.code==='ASSET_UNAVAILABLE'&&/アイコン/.test(error.message));
});
