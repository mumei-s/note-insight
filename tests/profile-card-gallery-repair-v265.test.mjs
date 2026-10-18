import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync('public/note-profile-card-paster-v22.user.js','utf8');
const code=source.slice(source.indexOf('function repairGalleryProfileParagraphs('),source.indexOf('async function repairGalleryProfiles('));
function runtime({mismatch=false,interrupted=false,final=false,pending=false}={}){
 const rows=[{creator:'一人目'},{creator:'二人目'}];if(final)rows.push({finalMarker:true});
 const paragraph={name:'paragraph',create:(attrs,content,marks)=>({type:paragraph,attrs,textContent:content,marks,nodeSize:content.length+2})};
 const block=(name,text)=>({type:name==='paragraph'?paragraph:{name},attrs:{},textContent:text,nodeSize:name==='paragraph'?text.length+2:1});
 const first=block('paragraph',interrupted?'new-一人目':'old-one'),second=block('paragraph',mismatch?'手で編集した本文':'old-two');
 const image1=block('image','一人目さん'),image2=block('image','二人目さん'),native=block('embed','通知カード'),original=block('paragraph','もとの本文');
 const blocks=[original,block('heading','見出し'),first,image1,block('horizontal_rule',''),second,...(pending?[]:[image2,block('horizontal_rule','')]),...(final?[block('heading','実績の算数'),block('image','実績さん'),block('horizontal_rule','')]:[]),native];
 const hits=()=>{let pos=0;return blocks.map(node=>{const hit={node,pos};pos+=node.nodeSize;return hit})};
 let dispatches=0,written;
 const doc={get content(){return{size:hits().reduce((sum,hit)=>sum+hit.node.nodeSize,0)}},descendants(fn){hits().forEach(hit=>fn(hit.node,hit.pos))}};
 const view={state:{doc,schema:{text:value=>value},get tr(){const replacements=[];return{replaceWith(from,to,node){replacements.push({from,to,node});return this},mapping:{map(pos){return pos+replacements.reduce((sum,r)=>sum+(r.to<=pos?r.node.nodeSize-(r.to-r.from):0),0)}},replacements}}},dispatch(tr){dispatches++;for(const replacement of tr.replacements){const index=hits().findIndex(hit=>hit.pos===replacement.from);assert.ok(index>=0);blocks[index]=replacement.node}}};
 const run={gallery126:true,articleKey:'draft',imageAnchorPos:original.nodeSize,rows,activityTexts:['old-one','old-two'],stage:'complete'};
 const context=vm.createContext({editorArticleKey:()=> 'draft',ownedImagesForRun:()=>hits().filter(hit=>hit.node.type.name==='image'),completedImagePrefix:(rows,images)=>images.length,activityText:row=>'new-'+row.creator,writeRun:run=>written=run,VERSION:'2.6.5'});
 vm.runInContext(code+';globalThis.repair=repairGalleryProfileParagraphs',context);
 return{repair:anchors=>context.repair(view,run,rows,anchors),blocks,image1,image2,native,original,first,second,run,get dispatches(){return dispatches},get written(){return written}};
}
test('existing completed profiles change atomically while images, captions, cards and original text retain node identity',()=>{
 const r=runtime();assert.equal(r.repair(),2);assert.equal(r.dispatches,1);
 for(const node of [r.image1,r.image2,r.native,r.original])assert.ok(r.blocks.includes(node));
 assert.deepEqual(Array.from(r.written.activityTexts),['new-一人目','new-二人目']);assert.equal(r.written.stage,'complete');
});
test('an edited or missing profile halts before changing any paragraph or checkpoint',()=>{
 const r=runtime({mismatch:true});assert.throws(r.repair,/2人目/);assert.equal(r.dispatches,0);assert.equal(r.written,undefined);assert.ok(r.blocks.includes(r.first));
});
test('repair accepts an already replaced paragraph after interruption before checkpoint',()=>{
 const r=runtime({interrupted:true});assert.equal(r.repair(),1);assert.deepEqual(Array.from(r.written.activityTexts),['new-一人目','new-二人目']);
});
test('final article needs no profile and pending next creator profile stays recoverable',()=>{
 for(const options of [{final:true},{pending:true}]){const r=runtime(options);assert.equal(r.repair(),2);assert.equal(r.written.activityTexts.length,2)}
});
test('an unrelated draft or inconsistent image checkpoint cannot be repaired',()=>{
 const r=runtime();r.run.articleKey='other';assert.throws(r.repair,/作成記録/);assert.equal(r.dispatches,0);
 const missing=runtime();missing.run.activityTexts=[];assert.throws(missing.repair,/保存記録/);assert.equal(missing.dispatches,0);
});

test('profile resizing maps the saved notification-card insertion anchor through the transaction',()=>{
 const r=runtime();r.run.cardAnchorPos=100;const oldSize=r.first.nodeSize+r.second.nodeSize;assert.equal(r.repair(),2);
 const newSize=r.blocks.filter(node=>node.type.name==='paragraph'&&node.textContent.startsWith('new-')).reduce((sum,node)=>sum+node.nodeSize,0);
 assert.equal(r.written.cardAnchorPos,100+newSize-oldSize);
});

test('a first-card tap captured before asynchronous hydration is mapped with the resized profiles',()=>{
 const r=runtime(),anchors={tappedAnchor:100},oldSize=r.first.nodeSize+r.second.nodeSize;r.repair(anchors);
 const newSize=r.blocks.filter(node=>node.type.name==='paragraph'&&node.textContent.startsWith('new-')).reduce((sum,node)=>sum+node.nodeSize,0);
 assert.equal(anchors.tappedAnchor,100+newSize-oldSize);assert.equal(r.written.cardAnchorPos,undefined);
});

const anchorCode=source.slice(source.indexOf('function mapGalleryCardAnchorsAfterInsert('),source.indexOf('async function createFixed300('));
for(const from of [50,101])test('gallery appended blocks preserve card and pending anchors at insertion '+from,()=>{
 let run={gallery126:true,articleKey:'draft',cardAnchorPos:100,pendingCard:{pos:120,url:'kept'}};
 const context=vm.createContext({readRun:()=>run,writeRun:value=>run=value});vm.runInContext(anchorCode+';globalThis.map=mapGalleryCardAnchorsAfterInsert',context);
 context.map({articleKey:'draft',from,docSize:200,view:{state:{doc:{content:{size:235}}}}});
 assert.equal(run.cardAnchorPos,from<=100?135:100);assert.equal(run.pendingCard.pos,155);assert.equal(run.pendingCard.url,'kept');
});
