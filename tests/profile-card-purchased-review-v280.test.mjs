import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync('public/note-profile-card-paster-v22.user.js','utf8');
const implementation=source.slice(source.indexOf("const PURCHASE_REVIEW_FORMAT="),source.indexOf('function patchPurchasedReviewPanel('));
const prefix=source.slice(source.indexOf('function completedImagePrefix('),source.indexOf('async function buildRows('));
const tracking=source.slice(source.indexOf('function assertGalleryTracking('),source.indexOf('function reconcileGalleryHeadings('));
const format='mumei-note-purchase-review-v1';
function input(count=27){return{format,items:Array.from({length:count},(_,i)=>({urlname:'creator'+i,key:'n'+i.toString(16).padStart(12,'0'),url:'https://note.com/creator'+i+'/n/n'+i.toString(16).padStart(12,'0'),creator:'作者'+i,displayCreator:'作者'+i+'さん',title:'記事のタイトル'+i,summary:'記事の無料公開部分をもとにした紹介です。体験や工夫を、自分の言葉で短く伝えます。',thumbUrl:'https://assets.st-note.com/test.jpg',sourceScope:'public-free-section',sourceCheckedAt:'2026-10-27T00:00:00Z'}))}}
function runtime(){
 let run=null;const blocks=[],uploads=[],statuses=[],saves=[];
 const view={state:{doc:{content:{get size(){return blocks.length}}}}};
 const images=()=>blocks.flatMap((node,pos)=>node.image?[{node,pos}]:[]);
 const own=(_view,current)=>images().filter(hit=>current.items.some(item=>item.id===hit.node.attrs.id));
 const context=vm.createContext({URL,Intl,Date,Number,Set,Promise,console,
  VERSION:'2.8.0',document:{},page:{async __MUMEI_PROFILE_CARD_SAVE_DRAFT__(message){saves.push(message);return{confirmed:true}}},
  coreBusy:()=>false,notifyFixedState(){},hydrateRunBackup:async()=>{},flushRunBackup:async()=>{},
  readRun:()=>run,writeRun:value=>{run=value},editorArticleKey:()=> 'nffffffffffff',findView:()=>view,
  nativeImageCommand(){return()=>true},selectionApi(){},cardAnchorFromSelection:()=>0,
  imageNodes:images,embedNodes:()=>[],cardKey:()=>'',norm:value=>String(value),ownedImagesForRun:own,
  keepAwake:async()=>{},releaseAwake:async()=>{},GM_getValue:async()=>input(),
  checkPause(){if(context.pauseRequested)throw Object.assign(new Error('一時停止しました'),{code:'PAUSED'})},
  addDivider(_view,hit){const next=hit.pos+1;if(!blocks[next]?.divider)blocks.splice(next,0,{divider:true});return next+1},
  async uploadOne(_view,row,_file,pos){const node={image:true,attrs:{id:row.key,src:row.key+'.png',link:row.url}};blocks.splice(pos,0,node);uploads.push(row.key);if(context.pauseAfter===uploads.length)vm.runInContext('pauseRequested=true',context);return{hit:{node,pos},nextPos:pos+1}},
  recordImage(hit,row){run={...run,items:[...run.items,{id:hit.node.attrs.id,url:row.url}]};},
  setStatus(message,error){statuses.push({message,error})}
 });
 vm.runInContext('let busy=false,exportWaiter=null,stopRequested=false,pauseRequested=false;'+prefix+tracking+implementation+';makePurchasedReviewFile=async row=>({name:row.key+".png"});globalThis.api={validatePurchasedReview,purchaseReviewLines,drawPurchasedReview,pastePurchasedReview};',context);
 return{context,api:context.api,blocks,uploads,statuses,saves,get run(){return run},set run(value){run=value}};
}
test('purchase input requires explicit free-section evidence, matching owner/key and unique article URLs',()=>{
 const r=runtime();assert.equal(r.api.validatePurchasedReview(input()).length,27);
 for(const change of [x=>x.items[0].url='https://note.com/other/n/'+x.items[0].key,x=>x.items[0].sourceScope='profile',x=>x.items[0].sourceCheckedAt='',x=>x.items[0].thumbUrl='https://other.example/image.png',x=>x.items[1]={...x.items[0]}]){
  const data=input();change(data);assert.throws(()=>r.api.validatePurchasedReview(data));
 }
});
test('purchase thumbnails retain the complete aspect ratio, stay about 300px at a 620px article width and do not crop descriptions',()=>{
 const r=runtime(),texts=[],draws=[];
 const ctx={font:'',measureText(value){return{width:[...value].length*11}},fillRect(){},drawImage(...args){draws.push(args)},fillText(...args){texts.push(args[0])}};
 const canvas={getContext:()=>ctx};const row=input(1).items[0],thumb={width:1280,height:670};
 const result=r.api.drawPurchasedReview(canvas,row,thumb);
 assert.equal(result.width,860);assert.equal(result.thumbnailWidth,420);
 assert.ok(result.thumbnailWidth*620/860<304);
 assert.equal(draws[0].length,5,'contain draw must not use a cropping source rectangle');
 assert.equal(draws[0][3]/draws[0][4],1280/670);
 assert.equal(texts.join(''),row.displayCreator+row.summary);
 assert.ok(result.height>=252&&result.height<400,'the normal thumbnail is not a thin strip');
});
test('purchase paste uses exactly the specified 27 articles, then resumes without duplication or an extra final creator',async()=>{
 const r=runtime();await r.api.pastePurchasedReview(input());
 assert.equal(r.uploads.length,27);assert.equal(r.run.rows.length,27);assert.equal(r.run.count,27);
 assert.equal(r.run.stage,'images_ready');assert.equal(r.blocks.filter(x=>x.image).length,27);
 assert.equal(r.blocks.filter(x=>x.divider).length,27);
 assert.deepEqual(Array.from(r.run.sectionHeadings),[]);assert.deepEqual(Array.from(r.run.activityTexts),[]);
 assert.ok(r.run.rows.every(row=>!row.finalMarker&&!('profileText' in row)));
 assert.equal(r.saves.length,1);await r.api.pastePurchasedReview();assert.equal(r.uploads.length,27);
});
test('pause persists a completed item and restarts at the next article, preserving a pre-existing paragraph',async()=>{
 const r=runtime();r.blocks.push({original:true});
 vm.runInContext('pauseAfter=1;checkPause=()=>{if(pauseRequested)throw Object.assign(new Error("一時停止"),{code:"PAUSED"})};',r.context);
 await r.api.pastePurchasedReview(input());assert.equal(r.uploads.length,1);assert.equal(r.run.paused,true);assert.equal(r.saves.length,1);
 r.context.pauseAfter=null;await r.api.pastePurchasedReview();
 assert.equal(r.uploads.length,27);assert.equal(new Set(r.uploads).size,27);assert.equal(r.blocks.filter(x=>x.original).length,1);
});
test('untracked late uploads and another existing workflow stop purchase paste before any new image is created',async()=>{
 const r=runtime();await r.api.pastePurchasedReview(input(1));r.blocks.push({image:true,attrs:{id:'late-upload',src:'late.png',link:'https://note.com/creator0/n/n000000000000'}});
 await r.api.pastePurchasedReview();assert.equal(r.uploads.length,1);assert.match(r.statuses.at(-1).message,/保存記録のない画像/);
 const other=runtime();other.run={gallery126:true};await other.api.pastePurchasedReview(input());assert.equal(other.uploads.length,0);assert.match(other.statuses.at(-1).message,/別の作成記録/);
});
