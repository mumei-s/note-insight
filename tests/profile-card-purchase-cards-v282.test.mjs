import nodeTest from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
let Schema,EditorState,TextSelection;
try{({Schema}=require(process.env.PM_MODEL_TEST_MODULE||'prosemirror-model'));({EditorState,TextSelection}=require(process.env.PM_STATE_TEST_MODULE||'prosemirror-state'))}catch{}
const test=(name,fn)=>nodeTest(name,{skip:!Schema||!EditorState?'Set PM_MODEL_TEST_MODULE and PM_STATE_TEST_MODULE to installed ProseMirror packages':false},fn);
const code=readFileSync('public/note-profile-card-paster-purchased.user.js','utf8');
const schema=Schema&&new Schema({nodes:{doc:{content:'block+'},paragraph:{content:'inline*',group:'block',attrs:{id:{default:null}}},image:{content:'text*',group:'block',attrs:{id:{default:''},src:{default:''},link:{default:''}}},embed:{group:'block',atom:true,attrs:{embeddedContentKey:{default:''},src:{default:''},htmlForEmbed:{default:''}}},horizontal_rule:{group:'block'},text:{group:'inline'}},marks:{strong:{}}});
const paragraph=(value='')=>schema.nodes.paragraph.create(null,value?schema.text(value):null);
const url=index=>'https://note.com/person'+index+'/n/n'+(index+1).toString(16).padStart(12,'0');
const card=(key,src)=>schema.nodes.embed.create({embeddedContentKey:key,src,htmlForEmbed:'<div class="note-embed"></div>'});
const image=(id,src)=>schema.nodes.image.create({id,src:'https://assets.st-note.com/'+id+'.jpg',link:src},schema.text(id+'さん'));
const blocks=doc=>{const out=[];doc.forEach(node=>out.push(node));return out};
const json=value=>JSON.parse(JSON.stringify(value));

async function runtime(count=3,{selection=null,terminal=false,uncertain=false,hold=false}={}){
 const originalImage=image('original',url(0)),originalCard=card('emboriginal',url(0)),manualCard=card('embmanual',url(1));
 const nodes=[paragraph('前半後半'),originalImage,originalCard];
 for(let i=0;i<count;i++)nodes.push(image('generated'+i,url(i)),schema.nodes.horizontal_rule.create());
 nodes.push(paragraph('元の後ろ'),manualCard,paragraph('貼付場所'));
 const doc=schema.nodes.doc.create(null,nodes),view={state:EditorState.create({schema,doc,selection:selection==null?TextSelection.atEnd(doc):TextSelection.create(doc,selection)}),focus(){},dispatch(tr){this.state=this.state.apply(tr)}};
 const state={run:null,requests:[],statuses:[],waits:[],saves:0,clock:10000,terminal,uncertain,hold};
 class Clock extends Date{static now(){return state.clock}}
 const storage=new Map(),gm=new Map();
 const page={navigator:{},addEventListener(){},noteEditor:{registerNoteDraft(){state.saves++;return true}}};
 const document={readyState:'loading',addEventListener(){},getElementById(){return null},querySelectorAll(){return[]}};
 const c=vm.createContext({unsafeWindow:page,window:page,document,location:new URL('https://editor.note.com/notes/naaaaaaaaaaaa/edit'),URL,Date:Clock,console,setTimeout,clearTimeout,localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},GM_getValue:(key,fallback)=>gm.get(key)??fallback,GM_setValue:(key,value)=>gm.set(key,structuredClone(value)),view,state});
 const at=code.lastIndexOf('})();');
 const expose=`globalThis.api={patch:code=>eval(code),paste:pastePurchaseNotificationCards,deleteCards:deletePurchaseNotificationCards,deleteAll:deletePurchasedReview,readRun,writeRun,flushRunBackup,validatePurchasedReview,embedNodes,imageNodes,cardKey,genuineCard,constants:{IMAGE_GAP,CARD_GAP_FAST,CARD_BLOCK_PAUSE}};`;
 vm.runInContext((code.slice(0,at)+expose+code.slice(at)).replace('const sleep=','let sleep='),c);
 c.api.patch(`
 findView=()=>view;setStatus=(text,bad)=>state.statuses.push({text,bad});
 sleep=async ms=>{state.waits.push(ms);state.clock+=ms;if(state.holdGap&&ms===600)await new Promise(resolve=>{state.finishGap=resolve})};
 const originalWait=waitNewCard;
 waitNewCard=async(...args)=>{if(state.uncertain)throw Error('正規通知カード生成タイムアウト');if(state.holding)await new Promise(resolve=>{state.releaseCard=resolve});return originalWait(...args)};
 noteUrlCommandFactory=()=>target=>(editorState,dispatch)=>{
  state.requests.push(target);
  if(state.terminal)return false;
  if(state.uncertain)return true;
  const resolved=editorState.selection.$from,pos=resolved.before(1),work=editorState.doc.nodeAt(pos);
  const made=editorState.schema.nodes.embed.create({embeddedContentKey:'embgenerated'+state.requests.length,src:target,htmlForEmbed:'<div class="note-embed"></div>'});
  const tr=editorState.tr.replaceWith(pos,pos+work.nodeSize,made);
  const finish=()=>{state.clock+=state.duration||0;dispatch(tr,work);state.holding=false;state.releaseCard?.();state.afterNative?.()};
  if(state.hold){state.holding=true;state.finishNative=finish}else finish();return true;
 };
 `);
 const input={format:'mumei-note-purchase-review-v1',items:Array.from({length:count},(_,i)=>({urlname:'person'+i,key:'n'+(i+1).toString(16).padStart(12,'0'),url:url(i),creator:'作者'+i,displayCreator:'作者'+i+'さん',title:'記事'+i,summary:'無料公開部分に基づいた紹介です。',thumbUrl:'https://assets.st-note.com/thumb.jpg',sourceScope:'public-free-section',sourceCheckedAt:'2026-10-27T00:00:00Z'}))};
 const rows=c.api.validatePurchasedReview(input),items=[];
 view.state.doc.descendants(node=>{if(node.type.name==='image'&&node.attrs.id.startsWith('generated'))items.push({id:node.attrs.id,src:node.attrs.src,url:node.attrs.link})});
 c.api.writeRun({version:'2.8.1',articleKey:'naaaaaaaaaaaa',purchasedReview:true,stage:'images_ready',rows,count,items,cardKeys:[],cardBaselineKeys:['emboriginal'],imageBaselineRecords:[{id:'original',src:originalImage.attrs.src,link:originalImage.attrs.link}],imageAnchorPos:nodes[0].nodeSize+originalImage.nodeSize+originalCard.nodeSize,dividerUrls:rows.map(row=>row.url)});await c.api.flushRunBackup();
 return{c,api:c.api,view,state,originalImage,originalCard,manualCard};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const generated=view=>blocks(view.state.doc).filter(node=>node.type.name==='embed'&&node.attrs.embeddedContentKey.startsWith('embgenerated'));

nodeTest('dedicated image and card pacing are read directly from the thin-thumbnail source',()=>{
 const core=readFileSync('public/note-profile-card-paster-core-v232.js','utf8'),editor=readFileSync('public/note-profile-card-paster-v22.user.js','utf8');
 for(const [name,source] of [['IMAGE_GAP',editor],['CARD_GAP_FAST',core],['CARD_BLOCK_PAUSE',core]]){
  const declaration=source.match(new RegExp('const '+name+'=\\d+;'))[0];assert.ok(code.includes(declaration));
 }
 assert.match(code,/recordImage\(made.hit,row\);insertPos=addDivider\(view,made.hit,row\);await flushRunBackup\(\);\s+await sleep\(IMAGE_GAP\)/);
});
test('all 27 native notification cards are created exactly once and current 2.8.1 image checkpoints remain usable',async()=>{
 const r=await runtime(27);await r.api.paste();
 assert.deepEqual(r.state.requests,Array.from({length:27},(_,i)=>url(i)));
 assert.equal(generated(r.view).length,27);assert.equal(r.api.readRun().stage,'complete');assert.equal(r.api.readRun().cardKeys.length,27);
 assert.equal(r.state.saves,1);await r.api.paste();assert.equal(r.state.requests.length,27);assert.equal(r.state.saves,1);
 assert.ok(blocks(r.view.state.doc).some(node=>node.eq(r.originalCard)));assert.ok(blocks(r.view.state.doc).some(node=>node.eq(r.manualCard)));
});
test('card pacing uses elapsed time and the same ten-card pause as thin thumbnails',async()=>{
 const r=await runtime(11);r.state.duration=200;await r.api.paste();
 assert.equal(r.state.waits.filter(ms=>ms===400).length,10);assert.deepEqual(r.state.waits.filter(ms=>ms===2500),[2500]);
 assert.equal(r.state.requests.length,11);
});
test('the selected position can split body text while retaining image captions and formatting',async()=>{
 const r=await runtime(2,{selection:3}),textBefore=r.view.state.doc.textContent;await r.api.paste();
 const out=blocks(r.view.state.doc);assert.equal(out[0].textContent,'前半');assert.equal(out[1].type.name,'embed');assert.equal(out[2].type.name,'embed');assert.equal(out[3].textContent,'後半');
 assert.equal(r.view.state.doc.textContent,textBefore);assert.ok(out.some(node=>node.eq(r.originalImage)));
});
test('a later manual attachment can be the insertion target without splitting its caption or blocking notification cards',async()=>{
 const r=await runtime(2),attached=image('laterattachment',url(5)),pos=r.view.state.doc.content.size;
 r.view.dispatch(r.view.state.tr.insert(pos,attached));r.view.dispatch(r.view.state.tr.setSelection(TextSelection.create(r.view.state.doc,pos+3)));
 await r.api.paste();const out=blocks(r.view.state.doc),index=out.findIndex(node=>node.eq(attached));
 assert.ok(index>=0);assert.equal(out[index+1].type.name,'embed');assert.equal(out[index+2].type.name,'embed');assert.equal(r.state.requests.length,2);
});
test('cards-only bulk deletion retains every non-card node plus pre-existing and later manual cards with identical URLs',async()=>{
 const r=await runtime();await r.api.paste();
 const late=card('emblatemanual',url(0));r.view.dispatch(r.view.state.tr.insert(r.view.state.doc.content.size,late));
 const before=blocks(r.view.state.doc).filter(node=>!node.attrs.embeddedContentKey?.startsWith('embgenerated')).map(node=>node.toJSON());
 await r.api.deleteCards();
 assert.deepEqual(blocks(r.view.state.doc).map(node=>node.toJSON()),before);
 assert.equal(r.api.readRun().items.length,3);assert.equal(r.api.readRun().cardKeys.length,0);assert.equal(r.api.readRun().stage,'images_ready');
 const saves=r.state.saves;await r.api.deleteCards();assert.equal(r.state.saves,saves);
});
test('bulk card deletion before the first card request cannot remove matching manual article cards',async()=>{
 const r=await runtime(),before=r.view.state.doc.toJSON();await r.api.deleteCards();
 assert.deepEqual(r.view.state.doc.toJSON(),before);assert.equal(r.state.saves,0);
});
test('pause records and saves the in-flight card, then resumes at its successor regardless of a new cursor position',async()=>{
 const r=await runtime(3,{hold:true}),pending=r.api.paste();await tick();assert.equal(r.state.requests.length,1);
 r.api.patch('pauseRequested=true;cardWaitWake?.()');r.state.finishNative();await pending;
 assert.equal(r.api.readRun().paused,true);assert.equal(r.api.readRun().pauseStage,'cards');assert.equal(r.api.readRun().cardKeys.length,1);assert.equal(r.state.saves,1);
 r.state.hold=false;r.view.dispatch(r.view.state.tr.setSelection(TextSelection.create(r.view.state.doc,1)));await r.api.paste();
 assert.deepEqual(r.state.requests,[url(0),url(1),url(2)]);assert.equal(r.api.readRun().stage,'complete');
});
test('pause immediately wakes the card delay without requesting another conversion',async()=>{
 const r=await runtime();r.state.holdGap=true;const pending=r.api.paste();await tick();assert.equal(r.state.requests.length,1);assert.ok(r.state.finishGap);
 r.api.patch('pauseRequested=true;cardWaitWake?.()');await pending;assert.equal(r.state.requests.length,1);assert.equal(r.api.readRun().paused,true);
});
test('an uncertain native request is not resent in the same session and cards-only deletion preserves its unresolved result',async()=>{
 const r=await runtime(2,{uncertain:true});await r.api.paste();assert.equal(r.state.requests.length,1);assert.ok(r.api.readRun().pendingCard);
 const before=r.view.state.doc.toJSON();await r.api.paste();assert.equal(r.state.requests.length,1);assert.deepEqual(r.view.state.doc.toJSON(),before);
 await r.api.deleteCards();assert.deepEqual(r.view.state.doc.toJSON(),before);assert.ok(r.api.readRun().pendingCard);
});
test('a terminal native failure removes its temporary URL without deleting an existing identical URL paragraph',async()=>{
 const r=await runtime(2,{terminal:true}),old=paragraph(url(0));r.view.dispatch(r.view.state.tr.insert(0,old));await r.api.paste();
 const urls=blocks(r.view.state.doc).filter(node=>node.type.name==='paragraph'&&node.textContent===url(0));
 assert.equal(urls.length,1);assert.ok(urls[0].eq(old));assert.equal(r.state.requests.length,1);assert.equal(r.api.readRun().pendingCard,null);
});
test('full deletion removes both generated images and their cards while retaining original media and text',async()=>{
 const r=await runtime(3);await r.api.paste();const before=blocks(r.view.state.doc).filter(node=>node.type.name!=='horizontal_rule'&&!node.attrs.id?.startsWith('generated')&&!node.attrs.embeddedContentKey?.startsWith('embgenerated')).map(node=>node.toJSON());
 await r.api.deleteAll();assert.equal(r.api.readRun(),null);assert.deepEqual(blocks(r.view.state.doc).map(node=>node.toJSON()),before);
});
