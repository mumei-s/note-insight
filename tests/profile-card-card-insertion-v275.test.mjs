import nodeTest from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
let Schema,EditorState,TextSelection,NodeSelection,Plugin;
try{
 ({Schema}=require(process.env.PM_MODEL_TEST_MODULE||'prosemirror-model'));
 ({EditorState,TextSelection,NodeSelection,Plugin}=require(process.env.PM_STATE_TEST_MODULE||'prosemirror-state'));
}catch{}
// Optional integration dependencies, like the adjacent KaTeX checks. Set both
// module paths to run these cases without adding editor libraries to the app.
const test=(name,fn)=>nodeTest(name,{skip:!Schema||!EditorState?'Set PM_MODEL_TEST_MODULE and PM_STATE_TEST_MODULE to installed ProseMirror packages':false},fn);
const source=readFileSync('public/note-profile-card-paster-core-v232.js','utf8');
const url='https://note.com/alpha/n/n111111111111';
const other='https://note.com/beta/n/n222222222222';
const schema=Schema&&new Schema({
 nodes:{
  doc:{content:'block+'},
  paragraph:{content:'inline*',group:'block',attrs:{align:{default:null},id:{default:null}}},
  image:{content:'text*',group:'block',attrs:{id:{default:''},src:{default:''},link:{default:''}}},
  embed:{group:'block',atom:true,attrs:{embeddedContentKey:{default:''},src:{default:''},htmlForEmbed:{default:''},id:{default:null}}},
  text:{group:'inline'}
 },
 marks:{strong:{},link:{attrs:{href:{}}}}
});
const text=(value,marks=[])=>schema.text(value,marks);
const paragraph=(value='',attrs=null)=>schema.nodes.paragraph.create(attrs,typeof value==='string'?(value?text(value):null):value);
const image=(id,caption='元画像の説明')=>schema.nodes.image.create({id,src:'https://assets.st-note.com/'+id+'.png',link:other},text(caption));
const nativeCard=(key='embgenerated123')=>schema.nodes.embed.create({embeddedContentKey:key,src:url,htmlForEmbed:'<div class="note-embed">article</div>'});
const blocks=doc=>Array.from({length:doc.childCount},(_,index)=>doc.child(index));
const json=doc=>JSON.parse(JSON.stringify(doc.toJSON()));

function runtime(nodes,{selection=1,initialRun=null,native='success',customSchema=schema,plugins=[]}={}){
 const doc=customSchema.nodes.doc.create(null,nodes);
 const state={run:initialRun||{articleKey:'n123456789abc',stage:'cards_building',rows:[{url,creator:'alpha'}],cardKeys:[],cardBaselineKeys:[],cardAnchorPos:selection},dispatches:[],focuses:0,flushes:[],nativeCalls:0,nativeSnapshots:[]};
 const view={state:EditorState.create({schema:customSchema,doc,plugins,selection:typeof selection==='function'?selection(doc):TextSelection.create(doc,selection)}),dom:{isConnected:true},dispatch(tr){state.dispatches.push(tr);view.state=view.state.apply(tr)},focus(){state.focuses++}};
 const page={addEventListener(){},dispatchEvent(){},__MUMEI_PROFILE_CARD_RUN_STORE__:{read:()=>state.run,write:value=>state.run=value,async flush(){state.flushes.push(JSON.parse(JSON.stringify(state.run)));await state.onFlush?.(state.flushes.length,view)}}};
 const document={readyState:'loading',addEventListener(){},getElementById:()=>null};
 const context=vm.createContext({unsafeWindow:page,window:page,document,location:new URL('https://editor.note.com/notes/n123456789abc/edit'),localStorage:{getItem:()=>null,setItem(){},removeItem(){}},GM_getValue:()=>null,URL,Event,setTimeout,clearTimeout,console,view,state,schema:customSchema,nativeCard});
 const entry="if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();";
 assert.ok(source.includes(entry));
 vm.runInContext(source.replace(entry,'globalThis.api={patch:code=>eval(code),notificationCardAnchorFromSelection,insertWorkUrlAt,createNativeCard,deleteVerifiedNotificationCardHits,reconcileCompletedCards,embedNodes,exactUrlParagraphs};'),context);
 context.api.patch(`findView=()=>view;noteUrlCommandFactory=()=>value=>(current,dispatch,target)=>{state.nativeCalls++;state.nativeSnapshots.push(JSON.parse(JSON.stringify(state.run)));${native==='fail'?'return false;':`const cursor=target.state.selection.$cursor;if(!cursor)throw Error('native conversion requires a text cursor');const at=cursor.before(1),work=target.state.doc.nodeAt(at);if(work.textContent!==value)throw Error('wrong native URL paragraph');dispatch(target.state.tr.replaceWith(at,at+work.nodeSize,nativeCard()),work);return true;`}};`);
 return{api:context.api,view,state};
}

function insertAtSelection(r){const anchor=r.api.notificationCardAnchorFromSelection(r.view);return r.api.insertWorkUrlAt(r.view,url,anchor)}

// These tests use real ProseMirror transactions because fitting a block at a
// text cursor moves its actual start; a flat node-array mock cannot reproduce it.
test('a URL block at a paragraph cursor preserves both text halves, marks and paragraph attributes',()=>{
 const strong=schema.marks.strong.create(),link=schema.marks.link.create({href:'https://example.com/'});
 const original=paragraph([text('前半',[strong]),text('後半',[link])],{align:'center'});
 const r=runtime([original],{selection:3});
 assert.equal(r.api.notificationCardAnchorFromSelection(r.view),3);
 const work=insertAtSelection(r),after=blocks(r.view.state.doc);
 assert.equal(after.length,3);assert.equal(after[0].textContent,'前半');assert.equal(after[1].textContent,url);assert.equal(after[2].textContent,'後半');
 assert.deepEqual(after[0].firstChild.marks.map(mark=>mark.toJSON()),[strong.toJSON()]);
 assert.deepEqual(after[2].firstChild.marks.map(mark=>mark.toJSON()),[link.toJSON()]);
 assert.equal(after[0].attrs.align,'center');assert.equal(after[2].attrs.align,'center');
 assert.equal(work.pos,after[0].nodeSize);assert.strictEqual(r.view.state.doc.nodeAt(work.pos),work.node);
 assert.equal(r.view.state.selection.from,work.pos+work.node.nodeSize-1);assert.equal(r.view.state.selection.$cursor.parent.textContent,url);
});

test('the start and end of a paragraph use the corresponding block boundary without empty fragments',()=>{
 for(const [cursor,expectedIndex] of [[1,0],[5,1]]){
  const original=paragraph('本文です'),r=runtime([original],{selection:cursor});
  const anchor=r.api.notificationCardAnchorFromSelection(r.view);assert.equal(anchor,expectedIndex===0?0:original.nodeSize);
  insertAtSelection(r);const after=blocks(r.view.state.doc);
  assert.equal(after.length,2);assert.equal(after[expectedIndex].textContent,url);assert.ok(after[1-expectedIndex].eq(original));
 }
});

test('an empty paragraph remains intact when the URL block is placed at its start',()=>{
 const original=paragraph(),r=runtime([original],{selection:1});
 assert.equal(r.api.notificationCardAnchorFromSelection(r.view),0);const work=insertAtSelection(r);
 assert.equal(work.pos,0);assert.equal(r.view.state.doc.child(0).textContent,url);assert.ok(r.view.state.doc.child(1).eq(original));
});

test('a node selection at document position zero inserts before the first image',()=>{
 const original=image('first'),r=runtime([original,paragraph('最後')],{selection:doc=>NodeSelection.create(doc,0)});
 assert.equal(r.api.notificationCardAnchorFromSelection(r.view),0);const work=insertAtSelection(r);
 assert.equal(work.pos,0);assert.equal(r.view.state.doc.child(0).textContent,url);assert.ok(r.view.state.doc.child(1).eq(original));
});

test('a selection between attached images preserves their captions and order',()=>{
 const first=image('one'),second=image('two'),r=runtime([first,second],{selection:doc=>NodeSelection.create(doc,first.nodeSize)});
 const work=insertAtSelection(r),after=blocks(r.view.state.doc);
 assert.equal(work.pos,first.nodeSize);assert.equal(after.length,3);assert.ok(after[0].eq(first));assert.equal(after[1].textContent,url);assert.ok(after[2].eq(second));
});

test('a cursor inside an image caption inserts after the whole attachment without splitting it',()=>{
 const first=image('one','変更しないキャプション'),second=image('two'),r=runtime([first,second],{selection:4});
 assert.equal(r.api.notificationCardAnchorFromSelection(r.view),first.nodeSize);insertAtSelection(r);
 const after=blocks(r.view.state.doc);assert.equal(after.length,3);assert.ok(after[0].eq(first));assert.equal(after[1].textContent,url);assert.ok(after[2].eq(second));
});

test('inserting at the start of a text range never deletes the selected words',()=>{
 const original=paragraph('前半と後半を残す'),r=runtime([original],{selection:doc=>TextSelection.create(doc,3,7)});
 insertAtSelection(r);const after=blocks(r.view.state.doc).filter(node=>node.textContent!==url);
 assert.equal(after.map(node=>node.textContent).join(''),original.textContent);
});

test('native conversion persists the actual split-block position and can reconcile it after interruption',async()=>{
 const original=paragraph('前半後半'),attached=image('original'),r=runtime([original,attached],{selection:3});
 const made=await r.api.createNativeCard(r.view,{url,creator:'alpha'},3),hits=r.api.embedNodes(r.view);
 assert.equal(r.state.nativeCalls,1);assert.equal(hits.length,1);assert.equal(hits[0].pos,4);assert.equal(made.nextPos,hits[0].pos+hits[0].node.nodeSize);
 assert.equal(r.state.run.cardAnchorPos,hits[0].pos);assert.equal(r.state.nativeSnapshots[0].pendingCard.pos,hits[0].pos);assert.equal(r.state.nativeSnapshots[0].cardAnchorPos,hits[0].pos);
 assert.equal(r.state.run.pendingCard,null);assert.equal(r.state.run.cardKeys.length,1);
 const before=json(r.view.state.doc);await r.api.reconcileCompletedCards(r.view,r.state.run,r.state.run.rows);
 assert.deepEqual(json(r.view.state.doc),before);assert.equal(r.state.nativeCalls,1);
 const after=blocks(r.view.state.doc);assert.equal(after[0].textContent,'前半');assert.equal(after[2].textContent,'後半');assert.ok(after[3].eq(attached));
});

test('card-only deletion preserves the split text, marks and original attachment exactly',async()=>{
 const strong=schema.marks.strong.create(),original=paragraph([text('前半後半',[strong])]),attached=image('original');
 const r=runtime([original,attached],{selection:3});await r.api.createNativeCard(r.view,{url,creator:'alpha'},3);
 const nonCards=blocks(r.view.state.doc).filter(node=>node.type.name!=='embed').map(node=>node.toJSON());
 assert.equal(r.api.deleteVerifiedNotificationCardHits(r.view,r.api.embedNodes(r.view)),1);
 assert.deepEqual(blocks(r.view.state.doc).map(node=>node.toJSON()),nonCards);
 assert.equal(r.view.state.doc.textContent,original.textContent+attached.textContent);assert.ok(r.view.state.doc.lastChild.eq(attached));
});

test('a terminal native failure removes only its temporary URL before an existing identical URL paragraph',async()=>{
 const original=paragraph(url,{align:'center'}),r=runtime([paragraph('前半後半'),original,image('original')],{selection:3,native:'fail'});
 await assert.rejects(r.api.createNativeCard(r.view,{url,creator:'alpha'},3),/未処理/);
 assert.equal(r.state.nativeCalls,1);const remaining=r.api.exactUrlParagraphs(r.view,url);
 assert.equal(remaining.length,1);assert.ok(remaining[0].node.eq(original));assert.equal(remaining[0].node.attrs.align,'center');
 assert.equal(blocks(r.view.state.doc).slice(0,2).map(node=>node.textContent).join(''),'前半後半');assert.equal(r.state.run.pendingCard,null);
});

test('an insertion that cannot fit an exact URL paragraph fails before changing the document',()=>{
 const restricted=new Schema({nodes:{doc:{content:'image+'},image:{content:'text*'},paragraph:{content:'text*'},text:{}}});
 const original=restricted.nodes.image.create(null,restricted.text('画像のキャプション'));
 const r=runtime([original],{selection:2,customSchema:restricted}),before=json(r.view.state.doc);
 assert.throws(()=>r.api.insertWorkUrlAt(r.view,url,2),/配置|挿入|段落/);
 assert.deepEqual(json(r.view.state.doc),before);assert.equal(r.state.dispatches.length,0);
});


test('moving the cursor during the pre-conversion checkpoint never submits the wrong paragraph',async()=>{
 const original=paragraph('前半後半'),attached=image('original'),r=runtime([original,attached],{selection:3});
 r.state.onFlush=(number,view)=>{if(number===2)view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc,1)))};
 await assert.rejects(r.api.createNativeCard(r.view,{url,creator:'alpha'},3),/挿入位置が変わった/);
 assert.equal(r.state.nativeCalls,0);assert.equal(r.state.run.pendingCard,null);assert.equal(r.state.run.cardKeys.length,0);
 assert.equal(r.api.exactUrlParagraphs(r.view,url).length,0);assert.equal(r.api.embedNodes(r.view).length,0);
 const after=blocks(r.view.state.doc);assert.equal(after.length,3);assert.equal(after[0].textContent,'前半');assert.equal(after[1].textContent,'後半');assert.ok(after[2].eq(attached));
 assert.equal(r.view.state.doc.textContent,original.textContent+attached.textContent);
});

test('a stale numeric position inside an image caption inserts after the complete image',()=>{
 const first=image('one','変更しないキャプション'),second=image('two'),r=runtime([first,second],{selection:2});
 const work=r.api.insertWorkUrlAt(r.view,url,4),after=blocks(r.view.state.doc);
 assert.equal(work.pos,first.nodeSize);assert.equal(after.length,3);assert.ok(after[0].eq(first));assert.equal(after[1].textContent,url);assert.ok(after[2].eq(second));
});

test('the exact document-end boundary appends a URL block without changing preceding content',()=>{
 const original=paragraph('元の本文'),attached=image('original'),r=runtime([original,attached],{selection:doc=>TextSelection.atEnd(doc)}),end=r.view.state.doc.content.size;
 const work=r.api.insertWorkUrlAt(r.view,url,end),after=blocks(r.view.state.doc);
 assert.equal(work.pos,end);assert.equal(after.length,3);assert.ok(after[0].eq(original));assert.ok(after[1].eq(attached));assert.equal(after[2].textContent,url);
});


// The real note editor assigns IDs with setNodeMarkup after a change to the
// number of blocks. This replaces node objects without changing their positions.
function noteBlockIdPlugin(){
 let serial=0;
 return new Plugin({appendTransaction(transactions,oldState,newState){
  if(oldState.doc.childCount===newState.doc.childCount)return null;
  const all=[];newState.doc.descendants((node,pos)=>{if(node.isBlock&&node.attrs.id!==undefined)all.push({node,pos})});
  let tr=newState.tr,changed=false;
  for(const {node,pos} of all){
   if(node.attrs.id==null||all.filter(hit=>hit.node.attrs.id===node.attrs.id).length>1){tr.setNodeMarkup(pos,undefined,{...node.attrs,id:'note-normalized-'+(++serial)});changed=true}
  }
  return changed?tr:null;
 }});
}

test('note block-ID normalization during dispatch permits one native card and a clean resume',async()=>{
 const strong=schema.marks.strong.create(),original=paragraph([text('前半後半',[strong])],{align:'center',id:'original-paragraph'}),existing=paragraph(url,{align:'center',id:'existing-url'}),attached=image('original');
 const r=runtime([original,existing,attached],{selection:3,plugins:[noteBlockIdPlugin()]});
 const made=await r.api.createNativeCard(r.view,{url,creator:'alpha'},3),after=blocks(r.view.state.doc),hits=r.api.embedNodes(r.view);
 assert.equal(r.state.nativeCalls,1);assert.equal(hits.length,1);assert.equal(made.nextPos,hits[0].pos+hits[0].node.nodeSize);assert.equal(r.state.run.pendingCard,null);assert.equal(r.state.run.cardKeys.length,1);
 assert.equal(after[0].textContent,'前半');assert.equal(after[2].textContent,'後半');
 for(const node of [after[0],after[2]]){assert.equal(node.attrs.align,'center');assert.deepEqual(node.firstChild.marks.map(mark=>mark.toJSON()),[strong.toJSON()]);assert.match(node.attrs.id,/^note-normalized-/)}
 assert.notEqual(after[0].attrs.id,after[2].attrs.id);assert.ok(after[3].eq(existing));assert.ok(after[4].eq(attached));
 const remaining=r.api.exactUrlParagraphs(r.view,url);assert.equal(remaining.length,1);assert.ok(remaining[0].node.eq(existing));
 const before=json(r.view.state.doc);await r.api.reconcileCompletedCards(r.view,r.state.run,r.state.run.rows);assert.deepEqual(json(r.view.state.doc),before);assert.equal(r.state.nativeCalls,1);
});

test('terminal-failure cleanup after note block-ID normalization preserves an existing identical URL',async()=>{
 const original=paragraph('前半後半',{align:'center',id:'original-paragraph'}),existing=paragraph(url,{align:'center',id:'existing-url'}),attached=image('original');
 const r=runtime([original,existing,attached],{selection:3,native:'fail',plugins:[noteBlockIdPlugin()]});
 await assert.rejects(r.api.createNativeCard(r.view,{url,creator:'alpha'},3),/未処理/);
 assert.equal(r.state.nativeCalls,1);assert.equal(r.state.run.pendingCard,null);assert.equal(r.state.run.cardKeys.length,0);
 const after=blocks(r.view.state.doc);assert.equal(after.length,4);assert.equal(after[0].textContent,'前半');assert.equal(after[1].textContent,'後半');assert.ok(after[2].eq(existing));assert.ok(after[3].eq(attached));
 const remaining=r.api.exactUrlParagraphs(r.view,url);assert.equal(remaining.length,1);assert.ok(remaining[0].node.eq(existing));
});
