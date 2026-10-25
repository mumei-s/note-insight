import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const base='public/note-profile-card-paster-';
const person=(id,index=1)=>({urlname:id,likerKey:id,actorUrl:'https://note.com/'+id,creator:'同じ表示名',url:'https://note.com/'+id+'/n/n'+index.toString(16).padStart(12,'0'),index});
const final=index=>({...person('fuku444',index),url:'https://note.com/fuku444/n/nb4f6934381e9',finalMarker:true});
function runtime(kind){
 const state={run:null,prep:null,status:[],uploaded:[],created:[],hits:[],cards:[],unrecordedCards:[],prepared:[],requests:0,saves:0};
 const page={addEventListener(){},dispatchEvent(){},Event};
 const document={readyState:'loading',addEventListener(){},getElementById:()=>null};
 const c=vm.createContext({unsafeWindow:page,window:page,document,location:new URL('https://editor.note.com/notes/n123456789abc/edit'),localStorage:{getItem:()=>null,setItem(){},removeItem(){}},GM_getValue:()=>({at:7,people:state.people||[]}),URL,Event,setTimeout,clearTimeout,state,view:{state:{doc:{content:{size:1000},nodeAt:()=>null}}}});
 let source=readFileSync(base+(kind==='core'?'core-v232.js':'v22.user.js'),'utf8').replace('const sleep=','let sleep=');
 const exports='globalThis.api={patch:code=>eval(code),excludedCreator,excludePendingCreatorRows,uploadOne,'+(kind==='core'?'createNativeCard,createCardsAtTap,buildRows,buildRowsFromSavedSpecial,prepareInsightLikePerson':'preparePerson,buildRows,createFixed300,validateFixedRows,uniquePeople')+'};';
 if(kind==='core')source=source.replace("if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();",exports);
 else source=source.slice(0,source.indexOf("window.addEventListener('mumei-profile-card-panel-ready'"))+exports+'\n})();';
 vm.runInContext(source,c);
 c.api.patch('setStatus=text=>state.status.push(text);sleep=async()=>{};readRun=()=>state.run;writeRun=value=>{state.run=value};findView=()=>view;');
 return{state,page,api:c.api};
}

for(const kind of ['core','v22']){
 test(kind+' excludes only the confirmed canonical account, including saved URL-only rows',()=>{
  const {api}=runtime(kind);
  for(const row of [{urlname:'cinephileangel'},{urlname:' CINEPHILEANGEL '},{urlname:'https://note.com/cinephileangel'},{actorUrl:'https://note.com/cinephileangel'},{url:'https://note.com/cinephileangel/n/n123456789abc?x=1'},{url:'https://www.note.com/%63inephileangel'}])assert.equal(api.excludedCreator(row),true);
  for(const row of [{urlname:'cinephileangel2',creator:'だんちゃん'},{urlname:'other',creator:'cinephileangel'},{actorUrl:'https://note.com.evil/cinephileangel'},{url:'https://example.com/cinephileangel'}])assert.equal(api.excludedCreator(row),false);
 });
 test(kind+' filters pending rows while preserving inserted excluded rows and tracking records',()=>{
  const {api}=runtime(kind),excluded=person('cinephileangel'),allowed=person('other',2),last=final(3),rows=[excluded,allowed,last];
  assert.deepEqual(Array.from(api.excludePendingCreatorRows(rows),r=>r.urlname),['other','fuku444']);
  const records={items:[{id:'old',url:excluded.url}],cardKeys:[{key:'old-card',url:excluded.url}],manual:'preserve'};
  const before=JSON.stringify(records);
  assert.equal(api.excludePendingCreatorRows(rows,records),rows);
  assert.equal(JSON.stringify(records),before);assert.equal(rows[0],excluded);
 });
 test(kind+' upload guard rejects excluded rows before native upload or selection mutation',async()=>{
  const {api}=runtime(kind);
  await assert.rejects(api.uploadOne(null,person('cinephileangel'),null,0),error=>error.code==='CREATOR_EXCLUDED');
 });
}

test('core fresh generic and saved-special selection omit the exact excluded creator before enrichment',async()=>{
 const {api}=runtime('core');
 api.patch(`collectUnified=async()=>[${JSON.stringify(person('cinephileangel'))},${JSON.stringify(person('other',2))}];enrich=async row=>row;readScan=()=>({out:[${JSON.stringify(person('cinephileangel'))},${JSON.stringify(person('other',2))}]});`);
 const rows=await api.buildRows({sources:'demo',mode:'all',choice:'latest'});
 const saved=await api.buildRowsFromSavedSpecial(2);
 for(const result of [rows,saved])assert.deepEqual(Array.from(result,r=>r.urlname),['other','fuku444']);
 assert.equal(await api.prepareInsightLikePerson(person('cinephileangel')),null);
 await assert.rejects(api.createNativeCard(null,person('cinephileangel'),0),error=>error.code==='CREATOR_EXCLUDED');
});

test('v22 new preparation skips excluded account without requesting its public data',async()=>{
 const {api,state}=runtime('v22');
 api.patch('xhrJSON=async()=>{state.requests++;throw Error("must not request excluded account")};');
 await assert.rejects(api.preparePerson(person('cinephileangel')),error=>error.code==='CREATOR_EXCLUDED');
 assert.equal(state.requests,0);
});

test('v22 saved preparation migrates excluded pending selection and fills from the next allowed candidate',async()=>{
 const {api,state}=runtime('v22');
 state.people=[person('cinephileangel'),person('first',2),person('second',3)];
 state.prep={signature:'7|2|eligible-v251',index:2,rows:state.people.slice(0,2),skipped:[]};
 api.patch('readPrep=()=>state.prep;writePrep=value=>{state.prep=value};flushPrepBackup=async()=>{};preparePerson=async person=>{assertCreatorAllowed(person);state.prepared.push(person.urlname);return person};');
 const rows=await api.buildRows(2);
 assert.deepEqual(Array.from(rows,r=>r.urlname),['first','second']);
 assert.deepEqual(state.prepared,['second']);
 assert.equal(state.prep.skipped[0].urlname,'cinephileangel');assert.equal(state.prep.index,3);
 assert.equal(api.uniquePeople([person('cinephileangel'),person('other',2)]).length,2);
});

function coreCardRuntime({preserved=false}={}){
 const r=runtime('core'),excluded=person('cinephileangel'),allowed=person('other',2),rows=[excluded,allowed];
 r.state.run={articleKey:'n123456789abc',stage:'images_ready',rows,items:rows.map((row,i)=>({id:'img'+i,url:row.url})),cardKeys:preserved?[{key:'existing',url:excluded.url}]:[],cardAnchorPos:0};
 if(preserved)r.state.cards=[{pos:0,key:'existing',node:{nodeSize:1},url:excluded.url}];
 r.api.patch(`update=()=>{};actionBlocked=()=>false;cardAnchorFromSelection=()=>0;cardAnchor=(run,pos)=>pos;resolveOwnedImageHits=()=>state.run.items;resolveOwnedCardHits=()=>state.cards;genuineCard=(hit,url)=>hit.url===url;generatedCardHits=()=>[...state.cards,...state.unrecordedCards].map(hit=>({...hit,targetUrl:hit.url}));cardKey=hit=>hit.key||hit.url;emptyCardGap=()=>true;assertUniqueGeneratedCards=()=>{};createNativeCard=async(v,row,pos)=>{assertCreatorAllowed(row);state.created.push(row.urlname);state.cards.push({pos,node:{nodeSize:1},url:row.url});state.run={...state.run,cardKeys:[...state.run.cardKeys,{key:row.url,url:row.url}]};return{nextPos:pos+1}};saveCompletedCards=async()=>{state.saves++};`);
 return r;
}
test('core skips a pending excluded card even when its earlier image already exists',async()=>{
 const {api,state}=coreCardRuntime();const before=JSON.stringify(state.run.items);await api.createCardsAtTap();
 assert.deepEqual(state.created,['other']);assert.equal(state.saves,1);
 assert.equal(JSON.stringify(state.run.items),before);assert.equal(state.run.rows[0].urlname,'cinephileangel');
});
test('core preserves an inserted excluded card and only creates the allowed remaining card',async()=>{
 const {api,state}=coreCardRuntime({preserved:true});const card=state.cards[0];await api.createCardsAtTap();
 assert.deepEqual(state.created,['other']);assert.equal(state.cards[0],card);assert.equal(state.cards.length,2);assert.equal(state.saves,1);
});
test('core removes excluded missing-image rows before the readiness override inspects the saved queue',async()=>{
 const {api,state,page}=coreCardRuntime();
 state.run.items=state.run.items.slice(1);
 page.__MUMEI_PROFILE_CARD_ENSURE_CARDS_READY__=async()=>{assert.deepEqual(Array.from(state.run.rows,r=>r.urlname),['other'])};
 await api.createCardsAtTap();
 assert.deepEqual(state.created,['other']);assert.equal(state.saves,1);
});
test('core recovers an excluded card inserted before its tracking checkpoint without inserting it again',async()=>{
 const {api,state}=coreCardRuntime();
 const existing={pos:0,key:'native-before-checkpoint',node:{nodeSize:1},url:state.run.rows[0].url};
 state.unrecordedCards=[existing];state.run.pendingCard={url:existing.url};
 api.patch('resolveOwnedCardHits=()=>[...state.cards,...state.unrecordedCards].filter(hit=>state.run.cardKeys.some(record=>record.key===cardKey(hit)));');
 await api.createCardsAtTap();
 assert.deepEqual(state.created,['other']);assert.equal(state.unrecordedCards[0],existing);
 assert.ok(state.run.cardKeys.some(record=>record.key===existing.key));assert.equal(state.run.pendingCard,null);
 assert.equal(state.run.rows[0].urlname,'cinephileangel');assert.equal(state.saves,1);
});

test('v22 image resume removes only an uninserted excluded row and preserves the existing prefix',async()=>{
 const {api,state,page}=runtime('v22'),first=person('first'),excluded=person('cinephileangel',2),other=person('other',3),last=final(4);
 state.run={articleKey:'n123456789abc',stage:'images_building',likesHistoryFix230:true,rows:[first,excluded,other,last],items:[{id:'img0',url:first.url}],cardKeys:[],imageAnchorPos:0,mode:'number'};
 const oldHit={pos:0,node:{nodeSize:1,attrs:{id:'img0',src:'old',link:first.url}}};state.hits=[oldHit];
 api.patch(`hydrateRunBackup=async()=>{};hydratePrepBackup=async()=>{};flushRunBackup=async()=>{};keepAwake=async()=>{};releaseAwake=async()=>{};nativeImageCommand=()=>{};selectionApi=()=>{};assignDesigns=rows=>rows;ownedImages=()=>state.hits;isDivider=()=>false;makeFile=async row=>{assertCreatorAllowed(row);return{}};findHeading=()=>null;insertHeadingAt=(v,text,pos)=>({nextPos:pos});recordHeading=()=>{};activityText=()=>'';findActivity=()=>null;insertActivityAt=(v,row,pos)=>({nextPos:pos,text:''});recordActivity=()=>{};uploadOne=async(v,row,file,pos)=>{assertCreatorAllowed(row);state.uploaded.push(row.urlname);const hit={pos,node:{nodeSize:1,attrs:{id:'img'+state.hits.length,src:'new',link:row.url}}};state.hits.push(hit);return{hit,nextPos:pos+1}};addDivider=(v,hit)=>hit.pos+1;`);
 page.__MUMEI_PROFILE_CARD_SAVE_DRAFT__=async()=>true;
 await api.createFixed300();
 assert.deepEqual(state.uploaded,['other','fuku444']);assert.equal(state.hits[0],oldHit);
 assert.deepEqual(Array.from(state.run.rows,r=>r.urlname),['first','other','fuku444']);
 assert.equal(state.run.stage,'images_ready');assert.equal(state.run.items[0].id,'img0');
});
