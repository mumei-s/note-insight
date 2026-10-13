import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync('public/note-profile-card-paster-v22.user.js','utf8');
const ARTICLE='n123456789abc',RUN_KEY='mumei_profile_card_paster_run_v15:'+ARTICLE,PREP_KEY='mumei_profile_like300_fix_v230:'+ARTICLE;
const plain=value=>JSON.parse(JSON.stringify(value));
function plan(){
 const rows=Array.from({length:300},(_,index)=>({urlname:'person'+index,likerKey:'creator-key-'+index,creator:'人'+index,index:index+1,designIndex:index%50,url:'https://note.com/person'+index+'/n/n'+index.toString(16).padStart(12,'0'),profileText:'本人の紹介'}));
 return[...rows,{index:301,urlname:'fuku444',likerKey:'final-performance-math',creator:'実績の算数',finalMarker:true,url:'https://note.com/fuku444/n/nb4f6934381e9',designIndex:0}];
}
function body(rows){
 const blocks=[{type:{name:'paragraph'},textContent:'既存の本文',nodeSize:1,attrs:{}}],items=[];
 for(let index=0;index<rows.length;index++){
  const row=rows[index];
  if(row.finalMarker||index%10===0)blocks.push({type:{name:'heading'},textContent:row.finalMarker?'最後に｜実績の算数':String(Math.floor(index/10)+1).padStart(2,'0')+'｜'+(index+1)+'人目〜'+Math.min(index+10,300)+'人目のクリエイター様',nodeSize:1,attrs:{}});
  if(!row.finalMarker)blocks.push({type:{name:'paragraph'},textContent:'プロフィール｜'+row.creator+'さん：'+row.profileText,nodeSize:1,attrs:{}});
  const attrs={id:'image-'+index,src:'https://assets.st-note.com/upload-'+index+'.png',link:row.url};
  blocks.push({type:{name:'image'},textContent:row.creator+'さん',nodeSize:1,attrs});blocks.push({type:{name:'horizontal_rule'},textContent:'',nodeSize:1,attrs:{}});
  items.push({id:attrs.id,src:attrs.src,url:row.url,creator:row.creator,at:100+index});
 }
 const view={state:{doc:{forEach:fn=>blocks.forEach((node,pos)=>fn(node,pos)),descendants:fn=>blocks.forEach((node,pos)=>fn(node,pos)),nodeAt:pos=>blocks[pos]||null}},dispatch(){throw Error('card readiness must not mutate the document')}};
 return{blocks,view,items};
}
function runtime(run,rows,prep=null){
 const values=new Map();if(run)values.set(RUN_KEY,JSON.stringify(run));if(prep)values.set(PREP_KEY,JSON.stringify(prep));
 const writes=[],backups=[],localStorage={getItem:key=>values.get(key)??null,setItem:(key,value)=>{writes.push({key,value});values.set(key,String(value))},removeItem:key=>{throw Error('card readiness must not clear saved state')}};
 const context=vm.createContext({window:{addEventListener(){},dispatchEvent(){},Event},document:{getElementById:()=>null},location:{hostname:'editor.note.com',href:'https://editor.note.com/notes/'+ARTICLE+'/edit',pathname:'/notes/'+ARTICLE+'/edit'},localStorage,GM_getValue:()=>null,GM_setValue:(key,value)=>{backups.push({key,value});return Promise.resolve()},GM_xmlhttpRequest(){throw Error('unexpected network')},unsafeWindow:{},setTimeout,clearTimeout,setInterval:()=>1,clearInterval(){},URL,console,structuredClone});
 const exposed=source.replace('const sleep=','let sleep=').replace(/let attempts=0;[\s\S]*?\n\}\)\(\);\s*$/,`globalThis.api={patch:code=>eval(code),ensureCardsRunReady,readRun};})();`);
 vm.runInContext(exposed,context);context.final=rows[300];context.calls=[];
 context.api.patch(`enrichFinal=async()=>{calls.push('final');return final};isDivider=(view,node)=>node?.type?.name==='horizontal_rule';findView=()=>{throw Error('must not invoke the paste entry')};makeFile=async()=>{throw Error('must not render or repaste images')};uploadOne=async()=>{throw Error('must not repaste images')};`);
 return{context,writes,backups};
}

test('301 exact tracked images heal a stale images_building stage without changing blocks, records, rows or card progress',async()=>{
 const rows=plan(),{blocks,view,items}=body(rows),before=plain(blocks),cardKeys=[{key:'existing-card',url:rows[0].url,creator:rows[0].creator}],run={version:'2.5.4',articleKey:ARTICLE,likesHistoryFix230:true,likesHistory:true,count:300,rows,items,stage:'images_building',cardKeys,cardAnchorPos:900,cardBaselineKeys:['original-card'],imageAnchorPos:1,createdAt:10};
 const {context:c,writes,backups}=runtime(run,rows),ready=await c.api.ensureCardsRunReady(view);
 assert.equal(ready.stage,'images_ready');assert.deepEqual(plain(ready.rows),rows);assert.deepEqual(plain(ready.items),items);assert.deepEqual(plain(ready.cardKeys),cardKeys);assert.equal(ready.cardAnchorPos,900);assert.equal(ready.imageAnchorPos,1);assert.deepEqual(plain(blocks),before);
 assert.equal(writes.length,1);assert.equal(writes[0].key,RUN_KEY);assert.equal(backups.length,1);assert.equal(backups[0].value.value.stage,'images_ready');assert.deepEqual(Array.from(c.calls),[]);
});

test('an incomplete 300-image prefix is refused without changing any run or document state',async()=>{
 const rows=plan(),{blocks,view,items}=body(rows.slice(0,300)),before=plain(blocks),run={version:'2.5.4',articleKey:ARTICLE,likesHistoryFix230:true,rows,items,stage:'images_building',cardKeys:[]};
 const {context:c,writes,backups}=runtime(run,rows);
 await assert.rejects(c.api.ensureCardsRunReady(view),/300\/301/);assert.equal(writes.length,0);assert.equal(backups.length,0);assert.equal(c.api.readRun().stage,'images_building');assert.deepEqual(plain(blocks),before);
});

test('a missing middle image cannot be counted as a completed plan and causes no readiness write',async()=>{
 const rows=plan(),selected=rows.filter((row,index)=>index!==6),{blocks,view,items}=body(selected),before=plain(blocks),run={version:'2.5.4',articleKey:ARTICLE,likesHistoryFix230:true,rows,items,stage:'images_building'};
 const {context:c,writes,backups}=runtime(run,rows);
 await assert.rejects(c.api.ensureCardsRunReady(view),/不足・順序/);assert.equal(writes.length,0);assert.equal(backups.length,0);assert.deepEqual(plain(blocks),before);
});

test('an unflagged quota fragment recovers from the saved prep and all 301 exact body images without network or repaste',async()=>{
 const rows=plan(),{blocks,view,items}=body(rows),before=plain(blocks),cardKeys=[{key:'preserved-card',url:rows[0].url}],run={version:'2.5.4',articleKey:ARTICLE,items,stage:'images_building',cardKeys,cardAnchorPos:1000,createdAt:99},prep={signature:'10|300|eligible-v251',index:300,rows:rows.slice(0,300),skipped:[]};
 const {context:c,writes,backups}=runtime(run,rows,prep),ready=await c.api.ensureCardsRunReady(view);
 assert.equal(ready.likesHistoryFix230,true);assert.equal(ready.stage,'images_ready');assert.equal(ready.rows.length,301);assert.deepEqual(plain(ready.items),items);assert.deepEqual(plain(ready.cardKeys),cardKeys);assert.equal(ready.cardAnchorPos,1000);assert.equal(ready.createdAt,99);assert.deepEqual(plain(blocks),before);
 assert.equal(ready.activityTexts.length,300);assert.equal(ready.sectionHeadings.length,31);assert.equal(ready.dividerUrls.length,301);assert.equal(writes.length,1);assert.equal(backups.length,1);assert.deepEqual(Array.from(c.calls),['final']);
});

