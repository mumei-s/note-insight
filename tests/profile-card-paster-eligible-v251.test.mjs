import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync('public/note-profile-card-paster-v22.user.js','utf8');
const PREP_KEY='mumei_profile_like300_fix_v230:n123456789abc';
function runtime(overrides={}){
 const values=new Map(),localStorage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)};
 const context=vm.createContext({window:{addEventListener(){},dispatchEvent(){},Event},document:{getElementById:()=>null},location:{hostname:'editor.note.com',href:'https://editor.note.com/notes/n123456789abc/edit',pathname:'/notes/n123456789abc/edit'},localStorage,GM_getValue:()=>null,GM_xmlhttpRequest(){throw Error('unexpected network')},unsafeWindow:{},DOMParser:class{parseFromString(value){return{body:{textContent:value},querySelector:()=>null}}},setTimeout,clearTimeout,setInterval:()=>1,clearInterval(){},URL,console,...overrides});
 const exposed=source.replace('const sleep=','let sleep=').replace(/let attempts=0;[\s\S]*?\n\}\)\(\);\s*$/,`globalThis.api={patch:code=>eval(code),preparePerson,buildRows,createFixed300};})();`);
 vm.runInContext(exposed,context);return context;
}
const people=count=>Array.from({length:count},(_,index)=>({urlname:'person'+index,likerKey:'creator-key-'+index}));
const empty={data:{contents:[],totalCount:0,isLastPage:true}};
function realApi(c,first,fallback=first,noteCount=0){
 c.first=first;c.fallback=fallback;c.noteCount=noteCount;c.urls=[];
 c.api.patch(`xhrJSON=async url=>{urls.push(url);if(url.includes('/contents?'))return url.includes('disabled_pinned=false')?fallback:first;if(url.includes('/api/v3/'))return{data:{name:'最新記事',eyecatch:'https://assets.st-note.com/thumb.png'}};return{data:{urlname:'creator',noteCount,profile:'本人の紹介',profileImageUrl:'https://assets.st-note.com/avatar.png'}}};articleMetaImage=async()=>''`);
}

test('confirmed public zero-article responses have the precise NO_PUBLIC_ARTICLE code',async()=>{
 const c=runtime();realApi(c,empty);
 await assert.rejects(c.api.preparePerson({urlname:'creator'}),error=>error.code==='NO_PUBLIC_ARTICLE');
 assert.equal(c.urls.filter(url=>url.includes('/contents?')).length,1);
});

test('malformed empty responses and transient API errors are not classified as confirmed no-public-article',async()=>{
 const c=runtime();realApi(c,{data:{}},{data:{}},0);
 await assert.rejects(c.api.preparePerson({urlname:'creator'}),error=>!error.code&&/公開記事/.test(error.message));
 c.api.patch(`xhrJSON=async()=>{throw Error('HTTP 503')}`);
 await assert.rejects(c.api.preparePerson({urlname:'creator'}),error=>!error.code&&/503/.test(error.message));
});

test('preparation scans past invalid entries and the bounded pinned fallback chooses the latest dated article',async()=>{
 const invalid={type:'magazine',key:'not-a-note'},old={key:'n000000000001',name:'固定した過去記事',publishAt:'2025-01-01',eyecatch:'https://assets.st-note.com/old.png'},latest={key:'n000000000002',name:'最新記事',publishAt:'2026-10-13',eyecatch:'https://assets.st-note.com/latest.png'};
 const c=runtime();realApi(c,{data:{contents:[invalid,latest]}},undefined,1);
 assert.equal((await c.api.preparePerson({urlname:'creator'})).key,latest.key);
 assert.equal(c.urls.filter(url=>url.includes('disabled_pinned=false')).length,0);
 realApi(c,{data:{contents:[],totalCount:2,isLastPage:true}},{data:{contents:[invalid,old,latest],totalCount:2,isLastPage:true}},2);
 assert.equal((await c.api.preparePerson({urlname:'creator'})).key,latest.key);
 assert.equal(c.urls.filter(url=>url.includes('disabled_pinned=false')).length,1);
});

test('zero-public and unfetchable creators are skipped while 300 eligible unique creators retain history order',async()=>{
 const original=people(304),c=runtime({GM_getValue:()=>({at:3,people:original})});
 c.api.patch(`preparePerson=async person=>{if(person.urlname==='person1'){const error=Error('公開記事なし');error.code='NO_PUBLIC_ARTICLE';throw error}if(person.urlname==='person8')throw Error('HTTP 403');return person};sleep=async()=>{}`);
 const rows=await c.api.buildRows(300),saved=JSON.parse(c.localStorage.getItem(PREP_KEY));
 assert.equal(rows.length,300);assert.equal(new Set(rows.map(row=>row.likerKey)).size,300);
 assert.deepEqual(Array.from(rows,row=>row.urlname),original.filter(row=>!['person1','person8'].includes(row.urlname)).slice(0,300).map(row=>row.urlname));
 assert.equal(saved.index,302);assert.deepEqual(saved.skipped.map(row=>row.reason),['公開記事なし','HTTP 403']);
});

test('manual stopping is never swallowed and a checkpoint containing skips resumes from the scanned position',async()=>{
 const original=people(12),c=runtime({GM_getValue:()=>({at:4,people:original})});c.stop=true;c.calls=[];
 c.api.patch(`preparePerson=async person=>{calls.push(person.urlname);if(person.urlname==='person1'){const error=Error('公開記事なし');error.code='NO_PUBLIC_ARTICLE';throw error}if(stop&&person.urlname==='person7')throw Error('停止しました');return person};sleep=async()=>{}`);
 await assert.rejects(c.api.buildRows(8),/停止しました/);
 const saved=JSON.parse(c.localStorage.getItem(PREP_KEY));assert.equal(saved.index,6);assert.equal(saved.rows.length,5);assert.equal(saved.skipped.length,1);
 c.stop=false;c.calls=[];const rows=await c.api.buildRows(8);
 assert.equal(c.calls[0],'person6');assert.ok(!c.calls.includes('person0'));
 assert.deepEqual(Array.from(rows,row=>row.urlname),original.filter(row=>row.urlname!=='person1').slice(0,8).map(row=>row.urlname));
});

test('v2.5.0 successful loading checkpoints migrate without fetching completed creators again',async()=>{
 const original=people(12),c=runtime({GM_getValue:()=>({at:5,people:original})});c.calls=[];
 c.localStorage.setItem(PREP_KEY,JSON.stringify({signature:'5|8|exact-v250',index:4,rows:original.slice(0,4),updatedAt:123}));
 c.api.patch(`preparePerson=async person=>{calls.push(person.urlname);if(person.urlname==='person4')throw Error('公開記事なし');return person};sleep=async()=>{}`);
 const rows=await c.api.buildRows(8),saved=JSON.parse(c.localStorage.getItem(PREP_KEY));
 assert.equal(c.calls[0],'person4');assert.ok(!c.calls.includes('person0'));assert.equal(saved.signature,'5|8|eligible-v251');assert.equal(saved.skipped[0].urlname,'person4');
 assert.deepEqual(Array.from(rows,row=>row.urlname),original.filter(row=>row.urlname!=='person4').slice(0,8).map(row=>row.urlname));
});

test('exhausting unavailable candidates reports actual eligible and skipped counts without inserting images',async()=>{
 const c=runtime({GM_getValue:()=>({at:6,people:people(7)})});c.events=[];
 c.api.patch(`findView=()=>({state:{doc:{nodeAt:()=>null}}});nativeImageCommand=()=>{};selectionApi=()=>{};readRun=()=>null;preparePerson=async()=>{throw Error('HTTP 403')};makeFile=async()=>{events.push('image');return{}};setStatus=(text,bad)=>{events.push({text,bad})};sleep=async()=>{}`);
 await c.api.createFixed300();
 assert.equal(c.events.filter(event=>event==='image').length,0);assert.match(c.events.at(-1).text,/0\/10人.*7人/);assert.equal(c.events.at(-1).bad,true);
 const saved=JSON.parse(c.localStorage.getItem(PREP_KEY));assert.equal(saved.index,7);assert.equal(saved.rows.length,0);assert.equal(saved.skipped.length,7);
});

