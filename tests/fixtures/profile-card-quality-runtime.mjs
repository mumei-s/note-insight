// Anonymous fixtures running the actual compiled userscript and real PM/canvas.
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {JSDOM} from 'jsdom';
const require=createRequire(import.meta.url);
export let dependencies;
try{
 const {Schema}=require(process.env.PM_MODEL_TEST_MODULE||'prosemirror-model');
 const {EditorState,Selection,TextSelection}=require(process.env.PM_STATE_TEST_MODULE||'prosemirror-state');
 const {createCanvas}=require(process.env.CANVAS_TEST_MODULE||'@napi-rs/canvas');
 dependencies={Schema,EditorState,Selection,TextSelection,createCanvas};
}catch{}
export function baselineCode(){
 if(process.env.QUALITY_BASELINE_SCRIPT)return readFileSync(process.env.QUALITY_BASELINE_SCRIPT,'utf8');
 try{return execFileSync('git',['show','e2e1b3f8a4b37721f3ddc59b4fd7abc4c1419b1b:public/note-profile-card-likes300-fix-v220.user.js'],{encoding:'utf8',stdio:['ignore','pipe','ignore'],maxBuffer:2e6})}catch{return null}
}
const digest=value=>createHash('sha256').update(value).digest('hex');
export async function runtime({baseline=false,count=3,record=true,reverse=false,render=true,realWaits=false,noArticleIndex=-2,noIconIndex=-2,noThumbIndex=-2,localStorageMap=new Map(),gmStorageMap=new Map(),restore=null,requestMutator=null}={}){
 const {Schema,EditorState,Selection,TextSelection,createCanvas}=dependencies;
 let code=baseline?baselineCode():readFileSync('public/note-profile-card-likes300-fix-v220.user.js','utf8');
 if(!code)throw Error('Baseline commit is not available');
 const schema=new Schema({nodes:{doc:{content:'block+'},paragraph:{content:'inline*',group:'block'},heading:{content:'inline*',group:'block',attrs:{level:{default:2}}},image:{content:'text*',group:'block',attrs:{id:{default:''},src:{default:''},link:{default:''}}},embed:{group:'block',atom:true,attrs:{embeddedContentKey:{default:''},src:{default:''},htmlForEmbed:{default:''}}},horizontal_rule:{group:'block'},text:{group:'inline'}},marks:{strong:{},small:{}}});
 const para=value=>schema.nodes.paragraph.create(null,value?schema.text(value):null),original=para('元の文章です。'),doc=schema.nodes.doc.create(null,[original,para('挿入位置')]);
 const restoredDoc=restore?.doc?schema.nodeFromJSON(restore.doc):doc;
 const view={state:EditorState.create({schema,doc:restoredDoc,selection:TextSelection.create(restoredDoc,Math.min(restore?.selection??original.nodeSize+1,restoredDoc.content.size))}),focus(){},dispatch(tr){this.state=this.state.apply(tr)}};
 const state={requests:[],returned:[],statuses:[],waits:[],images:[],cards:[],nativeCardRequests:[],clock:Date.UTC(2026,9,30),saves:0,saveResult:true,saveError:null,serial:0,canvasCount:0,pauseAt:0,failAt:0,targetCount:count,fixturePrefix:'quality_person_',keyOffset:0,...restore?.state,requestMutator};
 const local=localStorageMap,gm=gmStorageMap,events=new Map();
 if(!record)local.set('mumei_profile_quality_mode_v1','off');
 const page={Event,navigator:{},location:new URL(restore?.url||'https://editor.note.com/notes/naaaaaaaaaaaa/edit'),addEventListener(type,fn){if(!events.has(type))events.set(type,[]);events.get(type).push(fn)},dispatchEvent(event){for(const fn of events.get(event.type)||[])fn(event)},noteEditor:{registerNoteDraft(){state.saves++;if(state.saveError)throw state.saveError;return state.saveResult}}};
 const tiny=new Map();for(const kind of ['icon','thumb']){const canvas=createCanvas(kind==='icon'?96:320,kind==='icon'?96:168);const ctx=canvas.getContext('2d');ctx.fillStyle=kind==='icon'?'#327':'#dc7';ctx.fillRect(0,0,canvas.width,canvas.height);tiny.set(kind,canvas)}
 const document={readyState:'loading',addEventListener(){},getElementById(){return null},querySelector(){return null},querySelectorAll(){return[]},createElement(tag){if(tag!=='canvas')throw Error('Unexpected DOM creation '+tag);state.canvasCount++;const canvas=createCanvas(860,140);canvas.toBlob=callback=>callback({bytes:canvas.toBuffer('image/png')});return canvas}};
 const dom=new JSDOM('');
 class FixtureFile{constructor(parts,name,options){this.parts=parts;this.name=name;this.type=options.type}}
 class Transfer{constructor(){this.files=[];this.items={add:file=>this.files.push(file)}}}
 page.File=FixtureFile;page.DataTransfer=Transfer;
 let seed=12345;const math=Object.create(Math);math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
 class Clock extends Date{static now(){return state.clock}}
 const key=i=>'n'+(state.keyOffset+i+1).toString(16).padStart(12,'0');
 const person=i=>({urlname:state.fixturePrefix+i,likerKey:'key-'+state.fixturePrefix+i,creator:'作者🌸'+i,actorUrl:'https://note.com/'+state.fixturePrefix+i,actorImageUrl:i===noIconIndex?'':'https://assets.st-note.com/icon'+state.fixturePrefix+i+'.png'});
 const people=Array.from({length:state.targetCount+10},(_,i)=>person(i));if(!gm.has('mumei_profile_card_likes_300_v2'))gm.set('mumei_profile_card_likes_300_v2',{at:100,people});
 function note(id){const n=id==='fuku444'?-1:Number(id.split('_').at(-1)),k=n<0?'nb4f6934381e9':key(n);return{key:k,noteUrl:'https://note.com/'+id+'/n/'+k,name:'AIと暮らしの記事 '+n,body:'ワーママとして会社勤務と子育て。育児日記を書きます。',hashtags:['自己紹介','はじめてのnote','ワーママ','育児日記'],publishAt:'2025-01-01T00:00:00Z',eyecatch:n===noThumbIndex?null:{url:'https://assets.st-note.com/thumb'+n+'.png'},eyecatch_url:n===noThumbIndex?'':'https://assets.st-note.com/thumb'+n+'.png',user:{urlname:id,key:'key-'+n,nickname:'作者🌸'+n,profileImageUrl:n===noIconIndex?'':'https://assets.st-note.com/icon'+n+'.png'}}}
 async function requestPayload(url){
  state.requests.push(url);const u=new URL(url),creator=u.pathname.match(/^\/api\/v2\/creators\/([^/]+)(\/contents)?$/),article=u.pathname.match(/^\/api\/v3\/notes\/(n[a-f0-9]+)$/);
  if(reverse){const tail=Number((creator?.[1]||'').split('_').at(-1));for(let i=0;i<(6-(tail%6||0));i++)await Promise.resolve()}
  state.returned.push(url);
  if(creator){const id=creator[1],n=id==='fuku444'?-1:Number(id.split('_').at(-1));if(creator[2])return{data:{contents:u.searchParams.get('page')==='2'||n===noArticleIndex?[]:[note(id)],totalCount:n===noArticleIndex?0:1,isLastPage:true}};return{data:{creator:{urlname:id,nickname:'名前変更✨'+id,profile:'原文です。\n自然な折り返しと手動改行を区別します。AIも美容も書きます。',profileImageUrl:n===noIconIndex?'':'https://assets.st-note.com/icon'+id+'.png',noteCount:n===noArticleIndex?0:1}}}}
  if(article){if(article[1]==='n1b6e30eb9e41')return{data:{body:'https://note.com/previous_fixture/n/nffffffffffff'}};const n=article[1]==='nb4f6934381e9'?-1:parseInt(article[1].slice(1),16)-1-state.keyOffset;return{data:note(n<0?'fuku444':state.fixturePrefix+n)}}
  if(u.pathname.includes('/searches'))return{data:{notes:{contents:people.slice(0,state.targetCount).map(p=>note(p.urlname)),is_last_page:true}}};
  if(u.pathname.includes('/magazines/'))return{data:{notes:people.slice(0,state.targetCount).map(p=>note(p.urlname))}};
  if(u.pathname.endsWith('/likes'))return{data:{likes:people.slice(0,state.targetCount).map(p=>({user:{urlname:p.urlname,key:p.likerKey,nickname:p.creator}}))}};
  throw Error('Unexpected fixture request '+url);
 }
 async function requestJSON(url){const payload=await requestPayload(url);return state.requestMutator?await state.requestMutator(url,payload):payload}
 const bitmap=async url=>url?tiny.get(String(url).includes('icon')?'icon':'thumb'):null;
 const upload=(v,files)=>{
  const file=files[0];if(state.failAt&&state.serial+1===state.failAt)throw Error('fixture native image failure');
  const resolved=v.state.selection.$from;
  const pos=resolved.depth?(resolved.parentOffset===resolved.parent.content.size?resolved.after(1):resolved.before(1)):v.state.selection.from;
  const id='generated-'+(++state.serial),node=schema.nodes.image.create({id,src:'https://assets.st-note.com/'+id+'.png'});
  state.images.push({name:file.name,png:render?digest(file.parts[0].bytes):null});v.dispatch(v.state.tr.insert(pos,node));
  if(state.pauseAt===state.serial)c.editorApi.pauseFix();
  return true;
 };
 const wait=async ms=>{state.waits.push(ms);state.clock+=ms;if(realWaits)await new Promise(resolve=>setTimeout(resolve,ms))};
 const c=vm.createContext({unsafeWindow:page,window:page,document,location:page.location,URL,URLSearchParams,Event,Intl,Date:realWaits?Date:Clock,Math:math,console,setTimeout,clearTimeout,setInterval:()=>1,clearInterval(){},localStorage:{getItem:key=>local.get(key)||null,setItem:(key,value)=>{if(state.storageFailure?.('local',key))throw Error('fixture local storage failure');return local.set(key,String(value))},removeItem:key=>local.delete(key)},GM_getValue:(key,fallback)=>gm.get(key)??fallback,GM_setValue:(key,value)=>{if(state.storageFailure?.('gm',key))throw Error('fixture backup storage failure');return gm.set(key,value)},GM_xmlhttpRequest(){throw Error('Unexpected actual network')},DOMParser:dom.window.DOMParser,view,state,Selection,TextSelection,requestJSON,bitmap,upload,wait});
 code=code.replaceAll('const sleep=','let sleep=');
 const editorMarker=code.indexOf('// BEGIN INCLUDED PROFILE IMPLEMENTATION'),coreEnd=code.lastIndexOf('})();',editorMarker);
 code=code.slice(0,coreEnd)+`globalThis.coreApi={patch:code=>eval(code),createImageList,createCardsAtTap,pasteSavedSpecial,deleteNotificationCards,deleteAllGenerated,saveOnce,pauseCards,readRun,writeRun,makeFile,enrich,articleFromRaw};\n`+code.slice(coreEnd);
 const outerEnd=code.lastIndexOf('})();'),editorEnd=code.lastIndexOf('})();',outerEnd-1);
 code=code.slice(0,editorEnd)+`globalThis.editorApi={patch:code=>eval(code),createFixed300,pauseFix,readRun,writeRun,buildRows,preparePerson,prepareGalleryPerson,makeFile,assignDesigns,activityText,validateFixedRows};\n`+code.slice(editorEnd);
 vm.runInContext(code,c);
 const patch=`findView=()=>view;selectionApi=()=>Selection;nativeImageCommand=()=>upload;xhrJSON=requestJSON;xhr=async url=>'<article>自己紹介と子育て、ワーママの日常です。</article>';bitmapFromUrl=bitmap;setStatus=(text,bad)=>state.statuses.push({text,bad});sleep=wait;`;
 c.coreApi.patch(patch);c.editorApi.patch(patch);
 // Only external note capabilities are simulated; conversion/ownership/save/
 // insertion/pause/resume functions in the distributed code are not replaced.
 c.coreApi.patch(`noteUrlCommandFactory=()=>target=>(editorState,dispatch)=>{state.nativeCardRequests.push(target);const p=editorState.selection.$from.before(1),work=editorState.doc.nodeAt(p),node=editorState.schema.nodes.embed.create({embeddedContentKey:'embquality'+(state.cards.length+1),src:target,htmlForEmbed:'<div class="note-embed"></div>'});state.cards.push(target);dispatch(editorState.tr.replaceWith(p,p+work.nodeSize,node),work);return true};`);
 const quality=page.__MUMEI_PROFILE_CARD_QUALITY__;
 return{c,page,view,state,local,gm,quality,people,person,note,key,para,schema,core:c.coreApi,editor:c.editorApi,
  async history(){await c.editorApi.createFixed300({mode:'number',count:state.targetCount,target:state.targetCount});return c.editorApi.readRun()},
  async normal({kind='tag',choice='latest',mode='number',flow='normal'}={}){
   const selected=state.targetCount;
   c.coreApi.patch(`inputValues=()=>({sources:${JSON.stringify(kind==='tag'?'#fixture':kind==='mag'?'https://note.com/fixture/m/mfixture':'https://note.com/fixture/n/n000000000099')},mode:${JSON.stringify(mode)},count:${selected},choice:${JSON.stringify(choice)},specialMode:'number',specialCount:${selected},specialTags:['自己紹介'],workmomMode:'number',workmomCount:${selected},parentingMode:'number',parentingCount:${selected}});`);
   await c.coreApi.createImageList({special:flow==='special',workmom:flow==='workmom',parenting:flow==='parenting'});return c.editorApi.readRun();
  },
  async reload(overrides={}){
   await page.__MUMEI_PROFILE_CARD_RUN_STORE__?.flush?.();quality?.flush?.();
   const persisted={};for(const name of ['images','cards','nativeCardRequests','serial','clock','targetCount','fixturePrefix','keyOffset'])persisted[name]=JSON.parse(JSON.stringify(state[name]));
   return runtime({baseline,count:state.targetCount,reverse,render,realWaits,noArticleIndex,noIconIndex,noThumbIndex,localStorageMap:local,gmStorageMap:gm,restore:{doc:JSON.parse(JSON.stringify(view.state.doc.toJSON())),selection:view.state.selection.from,url:page.location.href,state:persisted},requestMutator:state.requestMutator,...overrides});
  },
  retarget({draft=2,count:nextCount=2,prefix='another_person_',replaceDoc=true}={}){
   state.fixturePrefix=prefix;state.keyOffset+=10000;state.targetCount=nextCount;state.clock+=1000;
   if(draft!==null)page.location.pathname='/notes/n'+draft.toString(16).padStart(12,'0')+'/edit';
   people.splice(0,people.length,...Array.from({length:nextCount+10},(_,i)=>person(i)));gm.set('mumei_profile_card_likes_300_v2',{at:state.clock,people});
   if(replaceDoc)view.state=EditorState.create({schema,doc:schema.nodes.doc.create(null,[para('次の記事の本文'),para('挿入位置')])});
   state.serial=0;state.images=[];state.cards=[];state.nativeCardRequests=[];state.requests=[];state.returned=[];state.waits=[];
  },
  async gallery(){
   page.__MUMEI_PROFILE_CARD_GALLERY_MANIFEST__={sourceBlob:'anonymous-quality-fixture',source:'anonymous fixture',people:Array.from({length:126},(_,i)=>person(i)),preparedRows:[],pendingPeople:noArticleIndex>=0?[{urlname:'quality_person_'+noArticleIndex,reason:'NO_PUBLIC_ARTICLE',noteCount:0}]:[]};
   await c.editorApi.createFixed300({gallery126:true});return c.editorApi.readRun();
  },
  doc:()=>JSON.parse(JSON.stringify(view.state.doc.toJSON())),
  close:()=>dom.window.close()};
}
