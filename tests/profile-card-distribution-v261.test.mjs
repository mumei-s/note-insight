import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const paths=['public/note-profile-card-paster-v1.user.js','public/note-profile-card-likes300-fix-v220.user.js'];
const codes=paths.map(path=>readFileSync(path,'utf8'));

function runtime({count=10,mode='number',people=[]}={}){
 const controls={'[data-count]':{value:String(count)},'[data-mode]':{value:mode}};
 const panel={querySelector(selector){return controls[selector]||null}};
 const document={hidden:true,getElementById(id){return id==='mumei-profile-card-paster-v1'?panel:null}};
 const window=new EventTarget();window.Event=Event;
 const storage=new Map();
 const context=vm.createContext({window,document,location:new URL('https://editor.note.com/notes/n123456789abc/edit'),unsafeWindow:{},localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},GM_getValue:()=>({at:1,people}),GM_setValue(){},GM_xmlhttpRequest(){throw Error('unexpected network')},setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,clearInterval(){},URL,Blob,File,console});
 // Exercise the actual editor implementation packaged into the distribution.
 // Remove only the containing distribution closure and startup polling.
 const marker='// BEGIN INCLUDED PROFILE IMPLEMENTATION\n';
 let editor=codes[1].slice(codes[1].indexOf(marker)+marker.length).replace(/\n\}\)\(\);\s*$/,'');
 editor=editor.replace('const sleep=','let sleep=').replace(/let attempts=0;[\s\S]*?\n\}\)\(\);\s*$/,`globalThis.api={patch:code=>eval(code),historyOptions,checkpointHistoryOptions,historyExportCount,prepareLikesHistoryExport,buildRows,validateFixedRows,headingText,createFixed300};})();`);
 vm.runInContext(editor,context);
 return context;
}

function rows(count){
 return [...Array.from({length:count},(_,i)=>({index:i+1,urlname:'creator'+i,creator:'Creator '+i,url:'https://note.com/creator'+i+'/n/n123456789abc'})),{index:count+1,urlname:'fuku444',creator:'実績の算数',url:'https://note.com/fuku444/n/nb4f6934381e9',finalMarker:true}];
}

test('distribution metadata names the same unrestricted tool while preserving each update identity',()=>{
 for(let i=0;i<codes.length;i++){
  const code=codes[i];
  assert.equal(code.match(/^\/\/ @name\s+(.+)$/m)?.[1],'無名S note 極薄サムネイル');
  assert.equal(code.match(/^\/\/ @version\s+(.+)$/m)?.[1],'2.9.0');
  assert.equal(code.match(/^\/\/ @downloadURL\s+(.+)$/m)?.[1],'https://raw.githubusercontent.com/mumei-s/note-insight/main/'+paths[i]);
  assert.equal(code.match(/^\/\/ @updateURL\s+(.+)$/m)?.[1],'https://raw.githubusercontent.com/mumei-s/note-insight/main/'+paths[i]);
  assert.doesNotMatch(code,/@require|@name[ \t]+[^\n]*(?:INSIGHT|300)/);
 }
 assert.notEqual(codes[0].match(/@namespace\s+(.+)/)?.[1],codes[1].match(/@namespace\s+(.+)/)?.[1]);
});

test('the packaged implementation accepts selected quantities above and below 300',()=>{
 for(const count of [1,10,43,300,450]){
  const c=runtime({count}),options=c.api.historyOptions();
  assert.equal(options.count,count);assert.equal(options.target,count);assert.equal(options.mode,'number');
  assert.ok(c.api.historyExportCount(options)>=count);
  assert.equal(c.api.validateFixedRows(rows(count)).length,count+1);
 }
});

test('saved quantity and checkpoint quantity take priority over the current control',()=>{
 const c=runtime({count:10});
 assert.equal(c.api.historyOptions({likesHistoryFix230:true,count:43,rows:rows(43)}).target,43);
 assert.equal(c.api.checkpointHistoryOptions({signature:'source|450|eligible-v251'}).target,450);
 const all=c.api.historyOptions({likesHistoryFix230:true,mode:'all',count:450,rows:rows(450)});
 assert.equal(all.target,Infinity);assert.equal(all.count,450);
});

test('all mode has no 300-person cutoff',()=>{
 const c=runtime({mode:'all'}),options=c.api.historyOptions();
 assert.equal(options.mode,'all');assert.equal(options.target,Infinity);assert.ok(c.api.historyExportCount(options)>300);
});

test('headings stop at the actual selected quantity on the final group',()=>{
 const c=runtime();
 assert.equal(c.api.headingText(0,1),'01｜1人目〜1人目のクリエイター様');
 assert.equal(c.api.headingText(4,43),'05｜41人目〜43人目のクリエイター様');
 assert.equal(c.api.headingText(44,450),'45｜441人目〜450人目のクリエイター様');
});

test('the selected amount reaches the history-reader request without launching the main application',async()=>{
 for(const count of [10,450]){
  const c=runtime({count}),popup={close(){}};
  let opened;
  c.window.open=url=>{opened=new URL(url);return popup};
  const pending=c.api.prepareLikesHistoryExport();
  assert.equal(opened.pathname,'/note-insight/note-profile-card-paster-history-export.html');
  assert.equal(opened.searchParams.get('scope'),'recent-likes');
  assert.equal(Number(opened.searchParams.get('count')),c.api.historyExportCount(c.api.historyOptions()));
  const event=new Event('message');
  Object.defineProperties(event,{origin:{value:'https://mumei-s.github.io'},source:{value:popup},data:{value:{type:'MUMEI_INSIGHT_LIKES_V1',requestId:opened.searchParams.get('request'),ok:true,rows:[{urlname:'creator'}]}}});
  c.window.dispatchEvent(event);
  assert.equal((await pending).length,1);
 }
});

test('deduplication and eligibility fill exactly the selected amount and preserve all-mode breadth',async()=>{
 const unique=Array.from({length:451},(_,i)=>({urlname:'creator'+i,likerKey:String(i)}));
 const people=[unique[0],...unique];
 for(const count of [10,450]){
  const c=runtime({count,people});
  c.api.patch(`preparePerson=async person=>{if(person.urlname==='creator0')throw new Error('No public article');return {...person,profileText:'Biography'}};sleep=async()=>{}`);
  const selected=await c.api.buildRows(count);
  assert.equal(selected.length,count);assert.equal(selected.at(-1).index,count);
  assert.equal(new Set(selected.map(person=>person.urlname)).size,count);
  assert.ok(!selected.some(person=>person.urlname==='creator0'));
 }
 const c=runtime({mode:'all',people});
 c.api.patch(`preparePerson=async person=>{if(person.urlname==='creator0')throw new Error('No public article');return {...person,profileText:'Biography'}};sleep=async()=>{}`);
 assert.equal((await c.api.buildRows(Infinity)).length,450);
});
