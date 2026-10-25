import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../public/note-profile-card-paster-core-v232.js',import.meta.url),'utf8');
const url='https://note.com/alpha/n/n111111111111',nextUrl='https://note.com/beta/n/n222222222222';
const row={url,creator:'alpha'},next={url:nextUrl,creator:'beta'};
const card=(key,pos,target=url)=>({pos,node:{nodeSize:1,type:{name:'embed'},attrs:{embeddedContentKey:key,src:target,htmlForEmbed:'note-embed'}}});
function runtime(hits=[]){
 const page={addEventListener(){},__MUMEI_PROFILE_CARD_RUN_STORE__:{hydrate:async()=>{},flush:async()=>{}}},window={addEventListener(){},dispatchEvent(){return true},Event};
 const document={readyState:'loading',addEventListener(){},getElementById:()=>null};
 const c=vm.createContext({unsafeWindow:page,window,document,location:{hostname:'editor.note.com',href:'https://editor.note.com/notes/n123456789abc/edit',pathname:'/notes/n123456789abc/edit'},localStorage:{getItem:()=>null,setItem(){},removeItem(){}},GM_getValue:()=>null,setTimeout,clearTimeout,URL,Event,console});
 const entry="if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();";
 vm.runInContext(source.replace('const sleep=','let sleep=').replace(entry,'globalThis.api={patch:code=>eval(code),createNativeCard,createCardsAtTap,reconcileCompletedCards,auditGeneratedDuplicates};'),c);
 c.hits=hits;c.saved={rows:[row,next],items:[],cardKeys:[],cardBaselineKeys:[],cardAnchorPos:0,imageAnchorPos:0,stage:'images_ready'};c.calls=0;c.events=[];
 c.view={state:{doc:{content:{size:10},nodeAt:pos=>c.work?.pos===pos?c.work.node:c.hits.find(hit=>hit.pos===pos)?.node||null}},dispatch(){throw Error('Unexpected document mutation')}};
 c.api.patch(`readRun=()=>saved;writeRun=run=>saved=run;embedNodes=()=>hits;imageNodes=()=>[];findView=()=>view;setStatus=(text,bad)=>events.push({text,bad});exactUrlParagraphs=()=>[];deleteExtraWorkUrl=()=>0;insertWorkUrlAt=(view,url,pos)=>{globalThis.work={node:{nodeSize:2},pos};view.state.selection={from:pos+1,to:pos+1};return work};noteUrlCommandFactory=()=>()=>()=>{calls++;return true};sleep=async()=>{};waitNewCard=async()=>{throw Error('timeout')}`);
 return c;
}

test('a late current-row card is adopted before conversion rather than creating another card',async()=>{
 const c=runtime([card('emblate123',0)]);
 const result=await c.api.createNativeCard(c.view,row,0);
 assert.equal(c.calls,0);assert.equal(result.rec.key,'emblate123');assert.equal(c.saved.cardKeys.length,1);assert.equal(c.saved.pendingCard,null);
 await c.api.createNativeCard(c.view,row,0);assert.equal(c.saved.cardKeys.length,1);assert.equal(c.calls,0);
});

test('unknown timeout leaves a durable pending request and same-page resume refuses a second conversion',async()=>{
 const c=runtime();
 c.cleanups=0;c.api.patch('deleteExtraWorkUrl=()=>{cleanups++;return 0}');
 await assert.rejects(c.api.createNativeCard(c.view,row,0),/timeout/);
 assert.equal(c.calls,1);assert.equal(c.saved.pendingCard.url,url);assert.ok(c.saved.pendingCard.sessionId);
 assert.equal(c.cleanups,0);
 await assert.rejects(c.api.createNativeCard(c.view,row,0),/再送を停止/);assert.equal(c.calls,1);
 c.hits.push(card('embfinished123',0));
 await c.api.createNativeCard(c.view,row,0);assert.equal(c.calls,1);assert.equal(c.saved.pendingCard,null);assert.equal(c.saved.cardKeys.length,1);
});

test('a previously advanced resume anchor is restored to the first tracked card before adopting the next',async()=>{
 const c=runtime([card('embfirst123',0),card('embsecond123',1,nextUrl)]);
 c.saved.cardAnchorPos=2;c.saved.cardKeys=[{url,key:'embfirst123',creator:'alpha'}];
 await c.api.reconcileCompletedCards(c.view,c.saved,c.saved.rows);
 assert.equal(c.saved.cardAnchorPos,0);assert.equal(c.saved.cardKeys.length,2);assert.equal(c.calls,0);
});

test('audit failures are reported in status rather than escaping as an unhandled rejection',async()=>{
 const c=runtime();c.api.patch('findView=()=>null');
 const result=await c.api.auditGeneratedDuplicates();assert.ok(result.error);assert.equal(c.events.at(-1).bad,true);
});

test('baseline cards are preserved and excluded from current-row adoption',async()=>{
 const c=runtime([card('embbaseline123',0)]);c.saved.cardBaselineKeys=['embbaseline123'];
 await assert.rejects(c.api.createNativeCard(c.view,row,0),/timeout/);
 assert.equal(c.calls,1);assert.equal(c.saved.cardKeys.length,0);assert.equal(c.hits.length,1);
});

test('the read-only audit detects untracked duplicate cards but ignores original baseline cards',async()=>{
 const c=runtime([card('embone123',0),card('embtwo123',1),card('embbaseline123',2)]);c.saved.cardBaselineKeys=['embbaseline123'];
 const report=await c.api.auditGeneratedDuplicates();
 assert.equal(report.cardCount,2);assert.equal(report.duplicateCards[0].count,2);assert.deepEqual(Array.from(report.duplicateCreators),['alpha']);assert.equal(c.calls,0);assert.equal(c.saved.cardKeys.length,0);
 await assert.rejects(c.api.createNativeCard(c.view,row,0),/重複/);assert.equal(c.calls,0);
});

test('contiguous completed pending and untracked cards are recovered without sending another request',async()=>{
 const c=runtime([card('embfirst123',0),card('embsecond123',1,nextUrl)]);
 c.saved.cardKeys=[{url,key:'embfirst123',creator:'alpha'}];c.saved.pendingCard={url:nextUrl,pos:1,sessionId:'previous'};
 await c.api.reconcileCompletedCards(c.view,c.saved,c.saved.rows);
 assert.equal(c.saved.cardKeys.length,2);assert.equal(c.saved.pendingCard,null);assert.equal(c.calls,0);
});

test('a reordered or noncontiguous untracked card stops without adopting or sending',async()=>{
 const c=runtime([card('embwrong123',0,nextUrl)]);
 await assert.rejects(c.api.reconcileCompletedCards(c.view,c.saved,c.saved.rows),/欠落または順序/);assert.equal(c.saved.cardKeys.length,0);assert.equal(c.calls,0);
});

test('a known terminal HTTP failure clears pending and the card phase does not automatically retry',async()=>{
 const c=runtime();c.api.patch("waitNewCard=async()=>{const error=Error('HTTP 403');error.status=403;throw error}");
 await assert.rejects(c.api.createNativeCard(c.view,row,0),/HTTP 403/);assert.equal(c.saved.pendingCard,null);assert.equal(c.calls,1);
 c.calls=0;c.saved.stage='images_ready';
 c.api.patch('cardAnchorFromSelection=()=>0;resolveOwnedImageHits=()=>[{},{}];saveOnce=async()=>{}');
 await c.api.createCardsAtTap();assert.equal(c.calls,1);assert.match(c.events.at(-1).text,/HTTP 403/);
});
