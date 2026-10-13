import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync('public/note-profile-card-paster-v22.user.js','utf8');
const ARTICLE='n123456789abc';
function plan(){
 const rows=Array.from({length:300},(_,index)=>({urlname:'person'+index,likerKey:'creator-key-'+index,creator:'人'+index,index:index+1,designIndex:index%50,url:'https://note.com/person'+index+'/n/n'+index.toString(16).padStart(12,'0'),profileText:'本人の紹介'}));
 return[...rows,{index:301,urlname:'fuku444',likerKey:'final-performance-math',creator:'実績の算数',finalMarker:true,url:'https://note.com/fuku444/n/nb4f6934381e9',designIndex:0}];
}
function body(rows,count=2){
 const blocks=[{type:{name:'paragraph'},textContent:'既存の本文',nodeSize:1,attrs:{}}];
 for(let index=0;index<count;index++){
  if(index%10===0)blocks.push({type:{name:'heading'},textContent:String(Math.floor(index/10)+1).padStart(2,'0')+'｜'+(index+1)+'人目〜'+Math.min(index+10,300)+'人目のクリエイター様',nodeSize:1,attrs:{}});
  const row=rows[index];blocks.push({type:{name:'paragraph'},textContent:'プロフィール｜'+row.creator+'さん：'+row.profileText,nodeSize:1,attrs:{}});
  blocks.push({type:{name:'image'},textContent:row.creator+'さん',nodeSize:1,attrs:{id:'image-'+index,src:'https://assets.st-note.com/upload-'+index+'.png',link:row.url}});
  blocks.push({type:{name:'horizontal_rule'},textContent:'',nodeSize:1,attrs:{}});
 }
 blocks.push({type:{name:'paragraph'},textContent:'これは既存の末尾本文',nodeSize:1,attrs:{}});
 const view={state:{doc:{forEach:fn=>blocks.forEach((node,pos)=>fn(node,pos)),descendants:fn=>blocks.forEach((node,pos)=>fn(node,pos)),nodeAt:pos=>blocks[pos]||null}},dispatch(){throw Error('recovery must not mutate the document')}};
 return{blocks,view,records:blocks.filter(node=>node.type.name==='image').map((node,index)=>({id:node.attrs.id,src:node.attrs.src,url:node.attrs.link,creator:rows[index].creator,at:100+index}))};
}
function runtime(rows){
 const values=new Map(),localStorage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)};
 const context=vm.createContext({window:{addEventListener(){},dispatchEvent(){},Event},document:{getElementById:()=>null},location:{hostname:'editor.note.com',href:'https://editor.note.com/notes/'+ARTICLE+'/edit',pathname:'/notes/'+ARTICLE+'/edit'},localStorage,GM_getValue:()=>null,GM_setValue:()=>Promise.resolve(),GM_xmlhttpRequest(){throw Error('unexpected network')},unsafeWindow:{},setTimeout,clearTimeout,setInterval:()=>1,clearInterval(){},URL,console,structuredClone,readPrep:()=>null});
 const exposed=source.replace('const sleep=','let sleep=').replace(/let attempts=0;[\s\S]*?\n\}\)\(\);\s*$/,`globalThis.api={patch:code=>eval(code),recoverCompatibleRun};})();`);
 vm.runInContext(exposed,context);context.planned=rows;context.checkpoint={signature:'10|300|eligible-v251',index:300,rows:rows.slice(0,300),skipped:[]};context.calls=[];
 context.api.patch(`readPrep=()=>checkpoint;buildRows=async()=>{calls.push('build');return planned.slice(0,300)};enrichFinal=async()=>planned[300];isDivider=(view,node)=>node?.type?.name==='horizontal_rule';readRun=()=>{throw Error('must not alter the current run')};writeRun=()=>{throw Error('must not alter the current run')};`);
 return context;
}
const plain=value=>JSON.parse(JSON.stringify(value));

test('a missing flag with a valid 301-row plan is repaired while preserving exact images and pasted styles',async()=>{
 const rows=plan(),{blocks,view,records}=body(rows),c=runtime(rows),before=plain(blocks),existing={version:'2.5.2',articleKey:ARTICLE,rows,items:records,imageAnchorPos:1};
 const recovered=await c.api.recoverCompatibleRun(view,existing);
 assert.equal(recovered.likesHistoryFix230,true);assert.equal(recovered.rows.length,301);assert.equal(recovered.items,records);assert.equal(recovered.imageAnchorPos,1);
 assert.deepEqual(plain(recovered.rows.slice(0,2)),rows.slice(0,2));assert.deepEqual(plain(blocks),before);assert.equal(existing.likesHistoryFix230,undefined);assert.deepEqual(Array.from(c.calls),[]);
 assert.equal(recovered.activityTexts.length,2);assert.equal(recovered.sectionHeadings.length,1);assert.equal(recovered.dividerUrls.length,2);
});

test('a current quota fragment reconstructs 301 rows from prep and only claims adjacent generated blocks',async()=>{
 const rows=plan(),{blocks,view,records}=body(rows),c=runtime(rows),existing={version:'2.5.2',articleKey:ARTICLE,items:records,createdAt:123};
 blocks[0].textContent='プロフィール｜人99さん：無関係な既存本文';const before=plain(blocks);
 const recovered=await c.api.recoverCompatibleRun(view,existing);
 assert.equal(recovered.likesHistoryFix230,true);assert.equal(recovered.createdAt,123);assert.equal(recovered.rows.length,301);assert.equal(recovered.imageAnchorPos,1);assert.equal(recovered.items,records);
 assert.ok(!recovered.activityTexts.some(text=>text.includes('人99')));assert.deepEqual(plain(blocks),before);assert.deepEqual(Array.from(c.calls),[]);
});

test('an unrelated legacy job or wrong article is refused without reading a new plan or deleting anything',async()=>{
 const rows=plan(),{blocks,view,records}=body(rows),c=runtime(rows),before=plain(blocks);
 await assert.rejects(c.api.recoverCompatibleRun(view,{version:'2.3.2',articleKey:ARTICLE,items:records}),/スキ300人/);
 await assert.rejects(c.api.recoverCompatibleRun(view,{version:'2.5.2',articleKey:'nffffffffffff',items:records}),/現在の記事/);
 assert.deepEqual(plain(blocks),before);assert.deepEqual(Array.from(c.calls),[]);
});

test('visible old article URLs are preserved only when the creator position and exact stored caption agree',async()=>{
 const rows=plan(),{blocks,view,records}=body(rows),latest=structuredClone(rows);latest[0].url='https://note.com/person0/n/nffffffffffff';const c=runtime(latest),before=plain(blocks);
 const recovered=await c.api.recoverCompatibleRun(view,{version:'2.5.2',articleKey:ARTICLE,items:records});
 assert.equal(recovered.rows[0].url,rows[0].url);assert.equal(recovered.rows[0].key,'n000000000000');assert.deepEqual(plain(blocks),before);
 blocks.find(node=>node.type.name==='image').textContent='別人さん';
 await assert.rejects(c.api.recoverCompatibleRun(view,{version:'2.5.2',articleKey:ARTICLE,items:records}),/順序/);
});

test('a missing middle tracked image cannot be promoted as a valid completed prefix',async()=>{
 const rows=plan(),selected=[rows[0],rows[2]],{blocks,view,records}=body(selected),c=runtime(rows),before=plain(blocks);
 await assert.rejects(c.api.recoverCompatibleRun(view,{version:'2.5.2',articleKey:ARTICLE,items:records}),/順序/);
 assert.deepEqual(plain(blocks),before);
});

test('missing trailing unsaved records and changed editor IDs retain the exact original tracking metadata',async()=>{
 const rows=plan(),{blocks,view,records}=body(rows),c=runtime(rows);records.push({id:'unsaved-last',src:'https://assets.st-note.com/unsaved.png',url:rows[2].url,creator:rows[2].creator});
 blocks.find(node=>node.type.name==='image').attrs.id='rehydrated-id';
 const recovered=await c.api.recoverCompatibleRun(view,{version:'2.5.2',articleKey:ARTICLE,rows,items:records});
 assert.equal(recovered.items,records);assert.equal(recovered.items[0].id,'image-0');assert.equal(recovered.items.length,3);assert.equal(recovered.rows[0].url,rows[0].url);assert.equal(recovered.stage,'images_building');
});

test('a quota fragment requires an exact visible tracked image and never claims arbitrary body thumbnails',async()=>{
 const rows=plan(),{blocks,view,records}=body(rows),c=runtime(rows),before=plain(blocks);const lost=records.map(record=>({...record,id:'lost-'+record.id,src:'https://assets.st-note.com/lost.png'}));
 await assert.rejects(c.api.recoverCompatibleRun(view,{version:'2.5.2',articleKey:ARTICLE,items:lost}),/貼り付け済み画像/);assert.deepEqual(plain(blocks),before);
});
