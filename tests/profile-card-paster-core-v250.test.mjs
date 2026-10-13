import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../public/note-profile-card-paster-core-v232.js',import.meta.url),'utf8');
function runtime(){
 const storage=new Map(),events=[];
 const window={addEventListener(){},dispatchEvent(event){events.push(event.type);return true}};
 const document={readyState:'loading',addEventListener(){},getElementById(){return null}};
 const context=vm.createContext({window,unsafeWindow:window,document,location:new URL('https://editor.note.com/notes/n123456789abc/edit'),localStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},GM_getValue:()=>null,GM_xmlhttpRequest(){throw Error('Unexpected network')},URL,Event,setTimeout,clearTimeout,console});
 const end="if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();";
 assert.ok(source.includes(end),'core test must replace the actual mount entry');
 vm.runInContext(source.replace(end,"globalThis.api={patch:code=>eval(code),collectUnified,buildRows,stop,resetAll,createImageList,createInsightLikes300,createCardsAtTap,bulkDelete,pasteSavedSpecial,resolveOwnedActivityHits,resolveOwnedDividerHits,deleteAllGenerated};"),context);
 context.events=events;
 return context;
}
const raw=(key,urlname)=>({key,name:urlname+'記事',user:{urlname,nickname:urlname}});

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
