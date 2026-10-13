import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../public/note-profile-card-paster-v22.user.js',import.meta.url),'utf8');
const FINAL_URL='https://note.com/fuku444/n/nb4f6934381e9';
function fixedRows(){
 const rows=Array.from({length:300},(_,i)=>({index:i+1,urlname:'person'+i,likerKey:'key-'+i,creator:'人'+i,url:'https://note.com/person'+i+'/n/n'+i.toString(16).padStart(12,'0'),profileText:'紹介'+i,designIndex:i%50}));
 rows.push({index:301,urlname:'fuku444',likerKey:'final-performance-math',creator:'実績の算数',url:FINAL_URL,finalMarker:true,designIndex:0});
 return rows;
}
function blockView(){
 const blocks=[],types={};
 for(const name of ['paragraph','heading','image','horizontal_rule'])types[name]={name,create(attrs,child){return{type:types[name],attrs:attrs||{},textContent:child?.text||'',nodeSize:1}}};
 types.horizontal_rule.createAndFill=()=>types.horizontal_rule.create();
 const state={schema:{nodes:types,marks:{},text:text=>({text})}};
 Object.defineProperty(state,'doc',{get:()=>({content:{size:blocks.length},nodeAt:pos=>blocks[pos]||null,descendants:fn=>blocks.forEach((node,pos)=>fn(node,pos))})});
 Object.defineProperty(state,'tr',{get:()=>({steps:[],insert(pos,node){this.steps.push({pos,node});return this},delete(){throw Error('Continuing an asset failure must not delete content')}})});
 return{state,dispatch(tr){for(const {pos,node} of tr.steps)blocks.splice(pos,0,node)},blocks,types};
}
function runtime(prefixCount=2){
 const values=new Map(),localStorage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)};
 const window={addEventListener(){},dispatchEvent(){return true},Event};
 const c=vm.createContext({window,document:{getElementById:()=>null},location:{hostname:'editor.note.com',href:'https://editor.note.com/notes/n123456789abc/edit',pathname:'/notes/n123456789abc/edit'},localStorage,GM_getValue:()=>null,GM_xmlhttpRequest(){throw Error('Unexpected network')},unsafeWindow:{},setTimeout,clearTimeout,setInterval:()=>1,clearInterval(){},URL,console});
 const exposed=source.replace('const sleep=','let sleep=').replace(/let attempts=0;[\s\S]*?\n\}\)\(\);\s*$/,`globalThis.api={patch:code=>eval(code),createFixed300,headingText,activityText};})();`);
 vm.runInContext(exposed,c);
 c.view=blockView();c.rows=fixedRows();c.events=[];
 c.saved={likesHistoryFix230:true,rows:c.rows,items:[],activityTexts:[],sectionHeadings:[],dividerUrls:[],imageAnchorPos:1,count:300};
 c.view.blocks.push(c.view.types.paragraph.create(null,{text:'元の本文'}));
 for(let i=0;i<prefixCount;i++){
  const row=c.rows[i];
  if(i%10===0){const heading=c.api.headingText(Math.floor(i/10));c.view.blocks.push(c.view.types.heading.create({level:2},{text:heading}));c.saved.sectionHeadings.push(heading)}
  const profile=c.api.activityText(row),id='done-'+i,src='https://assets.st-note.com/'+id+'.png';
  c.view.blocks.push(c.view.types.paragraph.create(null,{text:profile}),c.view.types.image.create({id,src,link:row.url},{text:row.creator+'さん'}),c.view.types.horizontal_rule.create());
  c.saved.items.push({id,src,url:row.url});c.saved.activityTexts.push(profile);c.saved.dividerUrls.push(row.url);
 }
 c.prefixSnapshot=JSON.stringify(c.view.blocks);
 c.api.patch(`
readRun=()=>saved;writeRun=run=>{saved=run;events.push({kind:'write',rows:run?.rows?.map(row=>row.urlname)})};
findView=()=>view;nativeImageCommand=()=>{};selectionApi=()=>{};sleep=async()=>{};
setStatus=(text,bad=false)=>{events.push({kind:'status',text,bad})};
clearCurrentPaste=()=>{throw Error('Continue must not restart or clear the paste')};deleteHits=()=>{throw Error('Continue must not delete content')};
uploadOne=async(view,row,file,pos)=>{
 const id='upload-'+row.urlname,src='https://assets.st-note.com/'+id+'.png';
 const node=view.state.schema.nodes.image.create({id,src,link:row.url},view.state.schema.text(row.creator+'さん'));
 view.dispatch(view.state.tr.insert(pos,node));events.push({kind:'upload',urlname:row.urlname,index:row.index});
 return{hit:{pos,node},nextPos:pos+node.nodeSize};
};
makeFile=async row=>{events.push({kind:'make',urlname:row.urlname,index:row.index});return{}};
replaceUnavailableCreator=async(rows,index,error)=>{
 events.push({kind:'replace',index,urlname:rows[index].urlname,message:error.message,blockCount:view.blocks.length});
 const backup={index:300,urlname:'backup',likerKey:'backup-key',creator:'補欠',url:'https://note.com/backup/n/naaaaaaaaaaaa',profileText:'補欠の紹介',designIndex:47};
 return[...rows.slice(0,index),...rows.slice(index+1,300),backup,rows[300]].map((row,i)=>({...row,index:i+1}));
};
`);
 return c;
}
const status=c=>c.events.filter(event=>event.kind==='status').at(-1);
const nodes=(c,type)=>c.view.blocks.filter(node=>node.type.name===type);

test('an unavailable third creator is replaced before any paragraph is inserted and resumes to 300 unique creators plus final',async()=>{
 const c=runtime(2),before=c.view.blocks.length,initial=c.rows.slice(0,2).map(row=>({...row}));
 c.api.patch(`makeFile=async row=>{events.push({kind:'make',urlname:row.urlname,index:row.index});if(row.urlname==='person2'){const error=Error('icon 通信失敗');error.code='ASSET_UNAVAILABLE';throw error}return{}}`);
 await c.api.createFixed300();
 const replacement=c.events.find(event=>event.kind==='replace');
 assert.equal(replacement.index,2);assert.equal(replacement.urlname,'person2');assert.equal(replacement.blockCount,before);
 assert.equal(c.events.filter(event=>event.kind==='replace').length,1);
 assert.equal(JSON.stringify(c.view.blocks.slice(0,before)),c.prefixSnapshot);
 assert.deepEqual(Array.from(c.saved.rows.slice(0,2),row=>({...row})),initial);
 assert.equal(c.saved.rows.length,301);assert.equal(c.saved.stage,'images_ready');
 assert.equal(new Set(c.saved.rows.slice(0,300).map(row=>row.urlname)).size,300);
 assert.ok(!c.saved.rows.some(row=>row.urlname==='person2'));assert.equal(c.saved.rows[299].urlname,'backup');assert.equal(c.saved.rows[300].url,FINAL_URL);
 const images=nodes(c,'image'),profiles=nodes(c,'paragraph').filter(node=>node.textContent.startsWith('プロフィール｜'));
 assert.equal(images.length,301);assert.equal(new Set(images.map(node=>node.attrs.link)).size,301);
 assert.equal(new Set(images.map(node=>node.textContent)).size,301);
 assert.equal(profiles.length,300);assert.equal(new Set(profiles.map(node=>node.textContent)).size,300);
 assert.ok(!profiles.some(node=>node.textContent.includes('人2さん：')));
 assert.equal(nodes(c,'horizontal_rule').length,301);assert.equal(nodes(c,'heading').length,31);
 for(let i=0;i<c.view.blocks.length;i++)if(c.view.blocks[i].type.name==='image')assert.equal(c.view.blocks[i+1]?.type.name,'horizontal_rule');
 assert.equal(c.events.filter(event=>event.kind==='upload').length,299);
 assert.match(status(c).text,/完了/);assert.equal(status(c).bad,false);
});

test('a generic non-asset error keeps the existing prefix and does not trigger replacement or insert orphan profile text',async()=>{
 const c=runtime(2);
 c.api.patch(`makeFile=async()=>{throw Error('controlled stop')}`);
 await c.api.createFixed300();
 assert.equal(JSON.stringify(c.view.blocks),c.prefixSnapshot);
 assert.equal(c.events.filter(event=>event.kind==='replace'||event.kind==='upload').length,0);
 assert.match(status(c).text,/controlled stop/);assert.equal(status(c).bad,true);
 assert.equal(c.saved.stage,'images_building');
});

test('manual stopping during asset decoding is not swallowed as an unavailable-creator skip',async()=>{
 const c=runtime(2);
 c.api.patch(`makeFile=async()=>{stopRequested=true;const error=Error('停止しました');error.code='ASSET_UNAVAILABLE';throw error}`);
 await c.api.createFixed300();
 assert.equal(JSON.stringify(c.view.blocks),c.prefixSnapshot);
 assert.equal(c.events.filter(event=>event.kind==='replace'||event.kind==='upload').length,0);
 assert.match(status(c).text,/停止しました/);assert.equal(status(c).bad,true);
});

test('the required final asset failure stops without replacing or adding its heading',async()=>{
 const c=runtime(300);
 c.api.patch(`makeFile=async row=>{if(!row.finalMarker)throw Error('Must not recreate prefix');const error=Error('final icon 通信失敗');error.code='ASSET_UNAVAILABLE';throw error}`);
 await c.api.createFixed300();
 assert.equal(JSON.stringify(c.view.blocks),c.prefixSnapshot);
 assert.equal(c.events.filter(event=>event.kind==='replace'||event.kind==='upload').length,0);
 assert.equal(nodes(c,'image').length,300);assert.equal(nodes(c,'heading').length,30);
 assert.match(status(c).text,/final icon/);assert.equal(status(c).bad,true);
});

test('a replacement that changes an already completed creator is rejected before any insertion or deletion',async()=>{
 const c=runtime(2);
 c.api.patch(`makeFile=async()=>{const error=Error('icon 通信失敗');error.code='ASSET_UNAVAILABLE';throw error};replaceUnavailableCreator=async rows=>rows.map((row,index)=>index===0?{...row,url:'https://note.com/changed/n/nbbbbbbbbbbbb'}:row)`);
 await c.api.createFixed300();
 assert.equal(JSON.stringify(c.view.blocks),c.prefixSnapshot);
 assert.equal(c.events.filter(event=>event.kind==='upload').length,0);
 assert.match(status(c).text,/不足・順序/);assert.equal(status(c).bad,true);
});

test('replacement candidate exhaustion stops with the completed prefix preserved',async()=>{
 const c=runtime(2);
 c.api.patch(`makeFile=async()=>{const error=Error('icon 通信失敗');error.code='ASSET_UNAVAILABLE';throw error};replaceUnavailableCreator=async()=>{throw Error('補欠候補が不足しています')}`);
 await c.api.createFixed300();
 assert.equal(JSON.stringify(c.view.blocks),c.prefixSnapshot);
 assert.equal(c.events.filter(event=>event.kind==='upload').length,0);
 assert.match(status(c).text,/候補が不足/);assert.equal(status(c).bad,true);
});
