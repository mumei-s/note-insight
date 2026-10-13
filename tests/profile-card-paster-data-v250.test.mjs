import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync('public/note-profile-card-paster-v22.user.js','utf8');
function runtime(overrides={}){
 const values=new Map();
 const localStorage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)};
 const window={addEventListener(){},dispatchEvent(){return true},Event:class{constructor(type){this.type=type}}};
 const context=vm.createContext({window,document:{getElementById:()=>null},location:{hostname:'editor.note.com',href:'https://editor.note.com/notes/n123456789abc/edit',pathname:'/notes/n123456789abc/edit'},localStorage,GM_getValue:()=>null,GM_xmlhttpRequest(){throw Error('unexpected network')},unsafeWindow:{},DOMParser:class{parseFromString(value){return{body:{textContent:value},querySelector:()=>null}}},setTimeout,clearTimeout,setInterval:()=>1,clearInterval(){},URL,console,...overrides});
 const exposed=source.replace('const sleep=','let sleep=').replace(/let attempts=0;[\s\S]*?\n\}\)\(\);\s*$/,`globalThis.api={patch:code=>eval(code),canonicalUrlname,uniquePeople,sameCreator,validateFixedRows,completedImagePrefix,buildRows,preparePerson,waitNewNoteImage,createFixed300};})();`);
 vm.runInContext(exposed,context);
 if(!/function assignDesigns\(/.test(source))context.api.patch('globalThis.assignDesigns=rows=>rows');
 return context;
}
const people=count=>Array.from({length:count},(_,index)=>({urlname:'person'+index,likerKey:'creator-key-'+index,creator:'同じ表示名'}));
function fixedRows(){
 const rows=people(300).map((person,index)=>({...person,index:index+1,url:'https://note.com/'+person.urlname+'/n/n'+index.toString(16).padStart(12,'0')}));
 rows.push({index:301,urlname:'fuku444',likerKey:'final-performance-math',creator:'実績の算数',finalMarker:true,url:'https://note.com/fuku444/n/nb4f6934381e9'});
 return rows;
}
const image=row=>({pos:row.index*3,node:{nodeSize:1,attrs:{link:row.url}}});

test('creator deduplication combines stable keys and canonical URLs while preserving distinct same-name creators',()=>{
 const {api}=runtime();
 const rows=api.uniquePeople([{urlname:' OLD ',likerKey:'stable',creator:'同名'},{urlname:'renamed',likerKey:'stable',creator:'同名'},{urlname:'RENAMED',likerKey:'other-key',creator:'同名'},{actorUrl:'https://note.com/Independent/?x=1',likerKey:'another',creator:'同名'}]);
 assert.deepEqual(Array.from(rows,row=>row.urlname),['old','independent']);
 assert.equal(api.canonicalUrlname({actorUrl:'https://note.com/USER/n/n123456789abc'}),'user');
 assert.equal(api.uniquePeople([{urlname:'one',creator:'同名'},{urlname:'two',creator:'同名'}]).length,2);
});

test('all known aliases of the final creator are excluded even when the fuku444 record occurs later',()=>{
 const {api}=runtime();
 const rows=api.uniquePeople([{urlname:'renamed-final',likerKey:'final-key'},{urlname:'other',likerKey:'other-key'},{urlname:'FUKU444',likerKey:'final-key'}]);
 assert.deepEqual(Array.from(rows,row=>row.urlname),['other']);
});

test('the exact latest creator order is retained despite parallel preparation completion order',async()=>{
 const original=people(12),c=runtime({GM_getValue:()=>({at:1,people:original})});
 c.api.patch('preparePerson=async person=>{await new Promise(resolve=>setTimeout(resolve,person.urlname.endsWith("0")?15:1));return {...person,profileText:"本人の紹介"}};sleep=async()=>{}');
 const rows=await c.api.buildRows(10);
 assert.deepEqual(Array.from(rows,row=>row.urlname),original.slice(0,10).map(row=>row.urlname));
 assert.deepEqual(Array.from(rows,row=>row.index),Array.from({length:10},(_,index)=>index+1));
});

test('an unavailable creator is skipped and the next creator fills the target without changing the accepted order',async()=>{
 const original=people(12),c=runtime({GM_getValue:()=>({at:2,people:original})});
 c.failed=true;c.calls=[];
 c.api.patch('preparePerson=async person=>{calls.push(person.urlname);if(failed&&person.urlname==="person5")throw Error("person5さんのサムネイルを確認できません");return {...person,profileText:"本人の紹介"}};sleep=async()=>{}');
 const rows=await c.api.buildRows(10);
 const saved=JSON.parse(c.localStorage.getItem('mumei_profile_like300_fix_v230:n123456789abc'));
 assert.equal(saved.index,11);assert.equal(saved.rows.length,10);assert.equal(saved.skipped.length,1);
 assert.equal(saved.skipped[0].urlname,'person5');assert.match(saved.skipped[0].reason,/サムネイル/);
 const expected=original.filter(row=>row.urlname!=='person5').slice(0,10).map(row=>row.urlname);
 assert.deepEqual(Array.from(rows,row=>row.urlname),expected);
 c.failed=false;c.calls=[];
 const resumed=await c.api.buildRows(10);
 assert.equal(c.calls.length,0);
 assert.deepEqual(Array.from(resumed,row=>row.urlname),expected);
});

test('missing public article or thumbnail gives a creator-specific error rather than returning a replacement candidate',async()=>{
 const c=runtime();c.empty=true;
 c.api.patch(`xhrJSON=async url=>url.includes('/contents?')?{data:{contents:empty?[]:[{key:'n123456789abc',name:'記事'}]}}:url.includes('/api/v3/')?{data:{}}:{data:{nickname:'花',profile:'本人の紹介',profileImageUrl:'https://assets.st-note.com/avatar.png'}};articleMetaImage=async()=>''`);
 await assert.rejects(c.api.preparePerson({urlname:'creator'}),/creatorさん.*公開記事/);
 c.empty=false;
 await assert.rejects(c.api.preparePerson({urlname:'creator'}),/creatorさん.*サムネイル/);
});

test('saved 301 rows require exactly 300 unique creators followed by the reserved final article',()=>{
 const {api}=runtime(),rows=fixedRows();
 assert.equal(api.validateFixedRows(rows),rows);
 const duplicate=structuredClone(rows);duplicate[100].likerKey=duplicate[0].likerKey;
 assert.throws(()=>api.validateFixedRows(duplicate),/重複/);
 const finalIn300=structuredClone(rows);finalIn300[100].likerKey=finalIn300[300].likerKey;
 assert.throws(()=>api.validateFixedRows(finalIn300),/300人/);
 const missingFinal=structuredClone(rows);missingFinal[300].url='https://note.com/fuku444/n/n123456789abc';
 assert.throws(()=>api.validateFixedRows(missingFinal),/実績の算数/);
 assert.throws(()=>api.validateFixedRows(rows.slice(0,300)),/301件/);
});

test('resume accepts a contiguous completed prefix and stops safely for middle gaps, duplicates or reorder',()=>{
 const {api}=runtime(),rows=fixedRows();
 assert.equal(api.completedImagePrefix(rows,rows.slice(0,300).map(image)),300);
 assert.throws(()=>api.completedImagePrefix(rows,[image(rows[0]),image(rows[2])]),/不足・順序/);
 assert.throws(()=>api.completedImagePrefix(rows,[image(rows[1]),image(rows[0])]),/不足・順序/);
 assert.throws(()=>api.completedImagePrefix(rows,[image(rows[0]),image(rows[0])]),/不足・順序/);
});

test('the creation path does not insert any image after detecting a resume gap',async()=>{
 const c=runtime();c.saved={likesHistoryFix230:true,rows:fixedRows(),items:[],imageAnchorPos:0};c.events=[];
 c.api.patch(`findView=()=>({state:{doc:{nodeAt:()=>null}}});nativeImageCommand=()=>{};selectionApi=()=>{};readRun=()=>saved;writeRun=run=>{saved=run};ownedImages=()=>[0,2].map(index=>({pos:index,node:{nodeSize:1,attrs:{link:saved.rows[index].url}}}));setStatus=(text,bad)=>{events.push({text,bad})};makeFile=async()=>{throw Error('must not make a new image')};`);
 await c.api.createFixed300();
 assert.match(c.events.at(-1).text,/画像の不足・順序/);assert.equal(c.events.at(-1).bad,true);
});

test('resume after a profile-only interruption reuses that paragraph before uploading its image',async()=>{
 const c=runtime();c.saved={likesHistoryFix230:true,rows:fixedRows(),items:[],imageAnchorPos:0};c.events=[];
 c.api.patch(`findView=()=>({state:{doc:{nodeAt:()=>null}}});nativeImageCommand=()=>{};selectionApi=()=>{};readRun=()=>saved;writeRun=run=>{saved=run};ownedImages=()=>[];isDivider=()=>false;makeFile=async row=>{if(row.index===2)throw Error('controlled stop');return {}};findHeading=()=>({pos:0,node:{nodeSize:1}});findActivity=()=>({pos:1,node:{nodeSize:1}});insertActivityAt=()=>{throw Error('must not duplicate the existing profile')};uploadOne=async(view,row,file,pos)=>{events.push({index:row.index,pos});return{hit:{},nextPos:3}};recordImage=()=>{};addDivider=()=>4;sleep=async()=>{};`);
 await c.api.createFixed300();
 assert.deepEqual(Array.from(c.events,event=>({index:event.index,pos:event.pos})),[{index:1,pos:2}]);
});

test('ambiguous newly uploaded images are not relinked as the current creator',async()=>{
 const c=runtime();
 c.api.patch(`imageNodes=()=>[{pos:1,node:{attrs:{id:'manual',src:'https://assets.st-note.com/manual.png'}}},{pos:2,node:{attrs:{id:'automatic',src:'https://assets.st-note.com/automatic.png'}}}];`);
 await assert.rejects(c.api.waitNewNoteImage({},new Set()),/複数の新しい画像/);
});
