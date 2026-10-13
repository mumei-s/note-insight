import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../public/note-profile-card-paster-core-v232.js',import.meta.url),'utf8');
function runtime(pageProps={}){
 const storage=new Map(),events=[];
 const window={addEventListener(){},dispatchEvent(event){events.push(event.type);return true}};
 Object.assign(window,pageProps);
 const document={readyState:'loading',addEventListener(){},getElementById(){return null}};
 const context=vm.createContext({window,unsafeWindow:window,document,location:new URL('https://editor.note.com/notes/n123456789abc/edit'),localStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},GM_getValue:()=>null,GM_xmlhttpRequest(){throw Error('Unexpected network')},URL,Event,setTimeout,clearTimeout,console});
 const end="if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();";
 assert.ok(source.includes(end),'core test must replace the actual mount entry');
 vm.runInContext(source.replace('const sleep=','let sleep=').replace(end,"globalThis.api={patch:code=>eval(code),collectUnified,buildRows,stop,resetAll,createImageList,createInsightLikes300,createCardsAtTap,bulkDelete,pasteSavedSpecial,resolveOwnedActivityHits,resolveOwnedDividerHits,deleteAllGenerated};"),context);
 context.events=events;
 return context;
}
const raw=(key,urlname)=>({key,name:urlname+'記事',user:{urlname,nickname:urlname}});

test('a legacy installed core cannot prevent the current card action from being exported',()=>{
 const stale=()=>{throw Error('legacy card handler')};
 const c=runtime({__MUMEI_PROFILE_CARD_PASTER_V1__:true,__MUMEI_PROFILE_CARD_CREATE_CARDS_AT_TAP__:stale});
 assert.equal(c.window.__MUMEI_PROFILE_CARD_CORE_VERSION__,'2.5.6');
 assert.equal(c.window.__MUMEI_PROFILE_CARD_CREATE_CARDS_AT_TAP__,c.api.createCardsAtTap);
});

test('card creation reconciles image readiness before checking the stored stage',async()=>{
 const c=runtime();c.saved={stage:'images_building',cardAnchorPos:10,rows:[{url:'a'},{url:'b'}],cardKeys:[{},{}]};c.statuses=[];let healed=0;
 c.window.__MUMEI_PROFILE_CARD_ENSURE_CARDS_READY__=async()=>{healed++;c.saved={...c.saved,stage:'images_ready'}};
 c.api.patch(`readRun=()=>saved;writeRun=value=>saved=value;reconcileCompletedCards=async(view,run)=>run;assertUniqueGeneratedCards=()=>{};embedNodes=()=>[];findView=()=>({state:{doc:{content:{size:100}}}});cardAnchorFromSelection=()=>50;resolveOwnedImageHits=()=>[{},{}];resolveOwnedCardHits=()=>[{url:'a',pos:10,node:{nodeSize:1}},{url:'b',pos:20,node:{nodeSize:1}}];genuineCard=(hit,url)=>hit.url===url;setStatus=text=>statuses.push(text);createNativeCard=async()=>{throw Error('must not insert completed cards')}`);
 await c.api.createCardsAtTap();assert.equal(healed,1);assert.equal(c.saved.stage,'complete');assert.match(c.statuses.at(-1),/すでに 2\/2/);
});

test('cards hydrate durable progress and preserve the tapped position before hydration changes selection',async()=>{
 const c=runtime();c.saved=null;c.cards=[];c.statuses=[];c.checkpoints=[];c.tap=42;
 c.window.__MUMEI_PROFILE_CARD_RUN_STORE__={
  read:()=>c.saved,write:value=>{c.saved=value},
  hydrate:async()=>{await Promise.resolve();c.tap=999;c.saved={stage:'images_ready',cardAnchorPos:null,rows:[{url:'https://note.com/a/n/n111111111111',creator:'a'},{url:'https://note.com/b/n/n222222222222',creator:'b'}],cardKeys:[]}},
  flush:async()=>{c.checkpoints.push([c.saved.stage,c.saved.cardKeys.length])}
 };
 c.api.patch(`findView=()=>({state:{doc:{content:{size:1000}}}});reconcileCompletedCards=async(view,run)=>run;assertUniqueGeneratedCards=()=>{};embedNodes=()=>[];cardAnchorFromSelection=()=>tap;resolveOwnedImageHits=()=>[{},{}];resolveOwnedCardHits=()=>cards;genuineCard=(hit,url)=>hit.url===url;setStatus=text=>statuses.push(text);sleep=async()=>{};saveOnce=async()=>{};createNativeCard=async(view,row,pos)=>{cards.push({url:row.url,pos,node:{nodeSize:1}});const run=readRun();writeRun({...run,cardKeys:[...run.cardKeys,{url:row.url}]});return{nextPos:pos+1}}`);
 await c.api.createCardsAtTap();
 assert.equal(c.cards[0].pos,42);assert.equal(c.saved.stage,'complete');
 assert.deepEqual(c.checkpoints,[['cards_building',0],['cards_building',1],['cards_building',2],['complete',2]]);
 assert.match(c.statuses.at(-1),/完了/);
});

test('cards refuse a missing middle prefix without inserting or deleting existing cards',async()=>{
 const c=runtime();c.statuses=[];
 c.saved={stage:'cards_building',cardAnchorPos:10,rows:[{url:'a'},{url:'b'},{url:'c'}],cardKeys:[{},{}]};
 c.api.patch(`readRun=()=>saved;reconcileCompletedCards=async(view,run)=>run;assertUniqueGeneratedCards=()=>{};embedNodes=()=>[];findView=()=>({state:{doc:{content:{size:100}}}});cardAnchorFromSelection=()=>50;resolveOwnedImageHits=()=>[{},{},{}];resolveOwnedCardHits=()=>[{url:'a',pos:10,node:{nodeSize:1}},{url:'c',pos:20,node:{nodeSize:1}}];genuineCard=(hit,url)=>hit.url===url;setStatus=text=>statuses.push(text);createNativeCard=async()=>{throw Error('must not insert')};writeRun=()=>{throw Error('must not write')}`);
 await c.api.createCardsAtTap();
 assert.match(c.statuses.at(-1),/欠落または順序/);assert.equal(c.saved.cardKeys.length,2);
});

test('normal magazine and tag sources execute, deduplicate creators across sources, and reserve the final creator',async()=>{
 const c=runtime();
 c.magazine={data:{notes:[raw('n111111111111','alpha'),raw('n222222222222','ALPHA'),raw('n333333333333','fuku444')]}};
 c.tag={data:{notes:{contents:[raw('n444444444444','alpha'),raw('n555555555555','beta'),raw('n666666666666','gamma')],is_last_page:true}}};
 c.api.patch("xhrJSON=async url=>url.includes('/magazines/')?magazine:tag");
 const rows=await c.api.collectUnified('https://note.com/ss_yr/m/m123456789abc\n#テスト','number',3,'latest');
 assert.deepEqual(Array.from(rows,row=>row.urlname),['alpha','beta','gamma']);
});

test('normal article likes use creator identity even when liker IDs differ and stop at the requested count',async()=>{
 const c=runtime();
 c.likes={data:{likes:['alpha','ALPHA','fuku444','beta','gamma','delta'].map((urlname,index)=>({user:{urlname,key:String(index)}}))}};
 c.api.patch("xhrJSON=async()=>likes;chooseCreatorArticle=async creator=>({...creator,key:'n111111111111',url:'https://note.com/'+creator.urlname+'/n/n111111111111'})");
 const rows=await c.api.collectUnified('https://note.com/ss_yr/n/n123456789abc','number',3,'latest');
 assert.deepEqual(Array.from(rows,row=>row.urlname),['alpha','beta','gamma']);
});

test('normal rows append exactly one final extra entry outside the creator count',async()=>{
 const c=runtime();
 c.payload={data:{notes:[raw('n111111111111','alpha'),raw('n222222222222','ALPHA'),raw('n333333333333','fuku444'),raw('n444444444444','beta'),raw('n555555555555','gamma')]}};
 c.api.patch('xhrJSON=async()=>payload;enrich=async row=>row');
 const rows=await c.api.buildRows({sources:'https://note.com/ss_yr/m/m123456789abc',mode:'number',count:3,choice:'latest'});
 assert.equal(rows.length,4);
 assert.equal(rows.at(-1).urlname,'fuku444');
 assert.equal(rows.at(-1).finalMarker,true);
 assert.equal(rows.at(-1).index,4);
 assert.equal(new Set(rows.map(row=>row.urlname.toLowerCase())).size,4);
});

test('core actions cannot start while the fixed creator workflow is active',async()=>{
 const c=runtime();
 c.window.__MUMEI_PROFILE_CARD_FIXED_BUSY__=()=>true;
 c.api.patch('findView=()=>{throw Error("Concurrent action reached the editor")};inputValues=()=>{throw Error("Concurrent action read inputs")}');
 for(const action of ['resetAll','createImageList','createInsightLikes300','createCardsAtTap','bulkDelete','pasteSavedSpecial'])await c.api[action]();
 assert.equal(c.window.__MUMEI_PROFILE_CARD_CORE_BUSY__(),false);
 assert.equal(typeof c.window.__MUMEI_PROFILE_CARD_SAVE_DRAFT__,'function');
});

test('core stop emits the shared stop event consumed by the fixed creator workflow',()=>{
 const c=runtime();
 c.api.stop();
 assert.deepEqual(c.events,['mumei-profile-card-stop']);
});

test('cancelling reset leaves the document and tracked biography paragraphs untouched',async()=>{
 const c=runtime();let confirmations=0;
 c.window.confirm=()=>{confirmations++;return false};
 c.api.patch('findView=()=>{throw Error("Cancelled reset accessed the document")};readRun=()=>({activityTexts:["プロフィール｜alphaさん：紹介"],imageAnchorPos:10})');
 await c.api.resetAll();
 assert.equal(confirmations,1);
 assert.equal(c.window.__MUMEI_PROFILE_CARD_CORE_BUSY__(),false);
});

test('biography ownership excludes earlier text and limits matching paragraphs to the recorded count',()=>{
 const c=runtime();
 c.api.patch('readRun=()=>({activityTexts:["プロフィール｜alphaさん：紹介"],imageAnchorPos:10})');
 const paragraph=text=>({type:{name:'paragraph'},textContent:text});
 const hits=c.api.resolveOwnedActivityHits({state:{doc:{descendants(fn){fn(paragraph('プロフィール｜alphaさん：紹介'),1);fn(paragraph('original'),11);fn(paragraph('プロフィール｜alphaさん：紹介'),12);fn(paragraph('プロフィール｜alphaさん：紹介'),13)}}}});
 assert.deepEqual(Array.from(hits,hit=>hit.pos),[12]);
});

test('reset removes only marked native dividers immediately after owned images',async()=>{
 const c=runtime();
 const image=(pos,url)=>({pos,node:{nodeSize:2,attrs:{link:url}}});
 const alpha='https://note.com/alpha/n/n111111111111',beta='https://note.com/beta/n/n222222222222',gamma='https://note.com/gamma/n/n333333333333',delta='https://note.com/delta/n/n444444444444';
 c.trackedImages=[image(10,alpha),image(20,beta),image(30,gamma),image(40,delta)];
 const native={nodeSize:1,type:{name:'horizontal_rule'}};
 const original={nodeSize:1,type:{name:'horizontal_rule'}};
 const textLine={nodeSize:3,type:{name:'paragraph'},textContent:'────────────'};
 const custom={nodeSize:1,type:{name:'noteSeparator',spec:{toDOM:()=>['hr']}}};
 const nodes=new Map([[12,native],[22,original],[32,textLine],[42,custom]]);
 c.view={state:{doc:{nodeAt:pos=>nodes.get(pos)}}};
 c.saved={dividerUrls:[alpha,gamma,delta]};
 c.api.patch('findView=()=>view;readRun=()=>saved;writeRun=value=>saved=value;resolveOwnedImageHits=()=>trackedImages;resolveOwnedCardHits=()=>[];resolveOwnedHeadingHits=()=>[];resolveOwnedActivityHits=()=>[];deleteHits=(view,hits)=>{globalThis.deleted=hits;return hits.length}');
 const result=await c.api.deleteAllGenerated({save:false});
 assert.equal(result.removedImages,4);
 assert.equal(result.removedDividers,2);
 assert.deepEqual(Array.from(c.deleted,hit=>hit.pos).sort((a,b)=>a-b),[10,12,20,30,40,42]);
 assert.equal(c.saved,null);
});
