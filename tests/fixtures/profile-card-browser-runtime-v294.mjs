// A fresh, intercepted editor-origin fixture. No request reaches note.com.
// Only note API/native upload/save capabilities are replaced. PM, DOMParser,
// canvas, File, DataTransfer, timers and the compiled tool are real browser APIs.
export async function runBrowserSample({code,count=200,scenario='paginated_tag',apiLatencyMs=20,pm}){
 const {Schema,EditorState,Selection}=pm,w=window;
 if(location.hostname!=='editor.note.com')throw Error('Use the intercepted editor-origin fixture');
 const schema=new Schema({nodes:{doc:{content:'block+'},paragraph:{content:'inline*',group:'block'},heading:{content:'inline*',group:'block',attrs:{level:{default:2}}},image:{content:'text*',group:'block',attrs:{id:{default:''},src:{default:''},link:{default:''}}},embed:{group:'block',atom:true,attrs:{embeddedContentKey:{default:''},src:{default:''},htmlForEmbed:{default:''}}},horizontal_rule:{group:'block'},text:{group:'inline'}},marks:{strong:{},small:{}}});
 const para=text=>schema.nodes.paragraph.create(null,text?schema.text(text):null),doc=schema.nodes.doc.create(null,[para('元の文章です。'),para('挿入位置')]);
 const view={state:EditorState.create({schema,doc,selection:Selection.near(doc.resolve(doc.firstChild.nodeSize+1))}),focus(){},dispatch(transaction){this.state=this.state.apply(transaction)}};
 const state={requests:[],statuses:[],waits:[],images:[],cards:[],serial:0,saves:0,startedAt:null,rowsReadyAt:null,firstUploadAt:null,finishedAt:null,api:{started:0,completed:0,active:0,peakActive:0,byKind:{},scheduledLatencyMs:0}};
 const range=(a,b)=>Array.from({length:Math.max(0,b-a)},(_,i)=>a+i),first=Math.max(2,Math.floor(count*.3)),second=Math.max(first+1,Math.floor(count*.65));
 const fixtures=scenario==='paginated_tag'?{tags:{fixture:range(0,count)}}:{tags:{fixture:range(0,first)},magazines:{mfixture:range(Math.max(0,first-2),second)},likes:{n000000000099:range(Math.max(0,second-2),count)}};
 const sourceText=scenario==='paginated_tag'?'#fixture':'#fixture\nhttps://note.com/fixture/m/mfixture\nhttps://note.com/fixture/n/n000000000099';
 const key=i=>'n'+(i+1).toString(16).padStart(12,'0'),person=i=>({urlname:'quality_person_'+i,likerKey:'key-quality_person_'+i,creator:'作者🌸'+i});
 function note(id){const n=id==='fuku444'?-1:Number(id.split('_').at(-1)),k=n<0?'nb4f6934381e9':key(n);return{key:k,noteUrl:'https://note.com/'+id+'/n/'+k,name:'AIと暮らしの記事 '+n,body:'ワーママとして会社勤務と子育て。育児日記を書きます。',price:0,hashtags:['自己紹介','はじめてのnote','ワーママ','育児日記',...Object.entries(fixtures.tags||{}).filter(([,values])=>values.includes(n)).map(([tag])=>tag)],publishAt:'2025-01-01T00:00:00Z',eyecatch:{url:'https://assets.st-note.com/thumb'+n+'.png'},eyecatch_url:'https://assets.st-note.com/thumb'+n+'.png',user:{urlname:id,key:'key-'+n,nickname:'作者🌸'+n,profileImageUrl:'https://assets.st-note.com/icon'+n+'.png'}}}
 function payload(url){
  const u=new URL(url),creator=u.pathname.match(/^\/api\/v2\/creators\/([^/]+)(\/contents)?$/),article=u.pathname.match(/^\/api\/v3\/notes\/(n[a-f0-9]+)$/);
  if(creator){const id=creator[1];if(creator[2])return{data:{contents:u.searchParams.get('page')==='2'?[]:[note(id)],totalCount:1,isLastPage:true}};return{data:{creator:{urlname:id,nickname:'名前変更✨'+id,profile:'原文です。\n自然な折り返しと手動改行を区別します。AIも美容も書きます。',profileImageUrl:'https://assets.st-note.com/icon'+id+'.png',noteCount:1}}}}
  if(article){const n=article[1]==='nb4f6934381e9'?-1:parseInt(article[1].slice(1),16)-1;return{data:note(n<0?'fuku444':'quality_person_'+n)}}
  if(u.pathname.includes('/searches')){const values=fixtures.tags[u.searchParams.get('q')]||[],start=Number(u.searchParams.get('start'))||0,size=Math.min(20,Number(u.searchParams.get('size'))||20),end=start+size,last=end>=values.length;return{data:{notes:{contents:values.slice(start,end).map(i=>note(person(i).urlname)),is_last_page:last},cursor:{note:last?null:String(end)}}}}
  if(u.pathname.includes('/magazines/')){const name=u.pathname.match(/\/magazines\/([^/]+)/)?.[1],values=fixtures.magazines?.[name]||[],start=Number(u.searchParams.get('start'))||0,size=Number(u.searchParams.get('limit'))||100;return{data:{notes:values.slice(start,start+size).map(i=>note(person(i).urlname))}}}
  if(u.pathname.endsWith('/likes')){const values=fixtures.likes?.[u.pathname.match(/\/notes\/([^/]+)/)?.[1]]||[],size=Number(u.searchParams.get('per'))||50,start=((Number(u.searchParams.get('page'))||1)-1)*size;return{data:{likes:values.slice(start,start+size).map(i=>{const p=person(i);return{user:{urlname:p.urlname,key:p.likerKey,nickname:p.creator}}})}}}
  throw Error('Unexpected simulated API '+url);
 }
 async function requestJSON(url){
  const path=new URL(url).pathname,kind=path.includes('/searches')?'search':path.includes('/magazines/')?'magazine':path.endsWith('/likes')?'likes':path.endsWith('/contents')?'creatorContents':path.includes('/api/v2/creators/')?'profile':path.includes('/api/v3/notes/')?'note':'other',api=state.api;
  state.requests.push(url);api.started++;api.active++;api.peakActive=Math.max(api.peakActive,api.active);api.byKind[kind]=(api.byKind[kind]||0)+1;api.scheduledLatencyMs+=apiLatencyMs;
  try{const out=payload(url);await new Promise(resolve=>setTimeout(resolve,apiLatencyMs));return out}finally{api.active--;api.completed++}
 }
 const assets=new Map();for(const kind of ['icon','thumb']){const canvas=document.createElement('canvas');canvas.width=kind==='icon'?96:320;canvas.height=kind==='icon'?96:168;const ctx=canvas.getContext('2d');ctx.fillStyle=kind==='icon'?'#327':'#dc7';ctx.fillRect(0,0,canvas.width,canvas.height);assets.set(kind,canvas)}
 const bitmap=async url=>url?assets.get(String(url).includes('icon')?'icon':'thumb'):null;
 function upload(target,files){
  state.firstUploadAt??=performance.now();const file=files[0],from=target.state.selection.$from,pos=from.depth?(from.parentOffset===from.parent.content.size?from.after(1):from.before(1)):target.state.selection.from,id='generated-'+(++state.serial),node=target.state.schema.nodes.image.create({id,src:'https://assets.st-note.com/'+id+'.png'});
  state.images.push({name:file.name,bytes:file.size});target.dispatch(target.state.tr.insert(pos,node));return true;
 }
 const gm=new Map();w.unsafeWindow=w;w.GM_getValue=(name,fallback)=>gm.get(name)??fallback;w.GM_setValue=(name,value)=>gm.set(name,value);w.GM_xmlhttpRequest=()=>{throw Error('Live request forbidden')};w.noteEditor={registerNoteDraft(){state.saves++;return true}};
 const wait=async ms=>{state.waits.push({ms,phase:state.rowsReadyAt===null?'extraction':'paste'});await new Promise(resolve=>setTimeout(resolve,ms))};
 w.__PROFILE_BROWSER_FIXTURE__={view,state,Selection,requestJSON,bitmap,upload,wait,sourceText,count};
 // Expose entry points exactly as the Node fixture does, without replacing the
 // compiled conversion, ownership, quality, insertion or save functions.
 const marker=code.indexOf('// BEGIN INCLUDED PROFILE IMPLEMENTATION'),coreEnd=code.lastIndexOf('})();',marker);
 if(marker<0||coreEnd<0)throw Error('Missing compiled source markers');
 code=code.slice(0,coreEnd)+`globalThis.coreApi={patch:source=>eval(source),createImageList,pasteSavedSpecial,readRun};\n`+code.slice(coreEnd);
 code=code.replaceAll('const sleep=','let sleep=');
 // The host editor panel is absent, as in the Node fixture. Canvas creation
 // and DOMParser remain native; a lexical document facade prevents startup
 // UI/watchers from joining the measured API pipeline.
 const hostDocument=new Proxy(document,{get(target,key){
  if(key==='readyState')return 'loading';if(key==='body')return undefined;if(key==='hidden')return true;
  if(['getElementById','querySelector'].includes(key))return()=>null;if(key==='querySelectorAll')return()=>[];
  if(key==='addEventListener')return()=>{};
  const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;
 }}),nativeInterval=w.setInterval,nativeTimeout=w.setTimeout;
 try{w.setInterval=()=>0;w.setTimeout=()=>0;(new Function('document',code))(hostDocument)}finally{w.setInterval=nativeInterval;w.setTimeout=nativeTimeout}

 if(!w.coreApi)throw Error('Compiled API did not initialize');
 w.coreApi.patch(`findView=()=>globalThis.__PROFILE_BROWSER_FIXTURE__.view;selectionApi=()=>globalThis.__PROFILE_BROWSER_FIXTURE__.Selection;nativeImageCommand=()=>globalThis.__PROFILE_BROWSER_FIXTURE__.upload;noteUrlCommandFactory=()=>()=>()=>true;xhrJSON=globalThis.__PROFILE_BROWSER_FIXTURE__.requestJSON;xhr=async()=>'<article>自己紹介と子育て、ワーママの日常です。</article>';bitmapFromUrl=globalThis.__PROFILE_BROWSER_FIXTURE__.bitmap;setStatus=(text,bad)=>globalThis.__PROFILE_BROWSER_FIXTURE__.state.statuses.push({text,bad});sleep=globalThis.__PROFILE_BROWSER_FIXTURE__.wait;
const fixtureBuildRows=buildRows;buildRows=async function(...args){const rows=await fixtureBuildRows(...args);globalThis.__PROFILE_BROWSER_FIXTURE__.state.rowsReadyAt=performance.now();return rows};
inputValues=()=>({sources:globalThis.__PROFILE_BROWSER_FIXTURE__.sourceText,mode:'number',count:globalThis.__PROFILE_BROWSER_FIXTURE__.count,choice:'latest'});`);
 const q=w.__MUMEI_PROFILE_CARD_QUALITY__,calls={all:0,required:0},original=q.imageBoundary;q.imageBoundary=function(...args){calls.all++;if(args[3]?.dividerRequired)calls.required++;return Reflect.apply(original,this,args)};
 state.startedAt=performance.now();await w.coreApi.createImageList();state.finishedAt=performance.now();
 const run=w.coreApi.readRun(),inspection=q.snapshot(),blocks=[];view.state.doc.forEach(node=>blocks.push(node));const ids=(run?.rows||[]).map(row=>row.urlname),expected=[...range(0,count).map(i=>person(i).urlname),'fuku444'],records=inspection.records.filter(row=>row.stage==='区切り');
 const boundaries={nativeDividerCount:blocks.filter(node=>node.type.name==='horizontal_rule').length,immediateImageBoundaries:blocks.filter((node,i)=>node.type.name==='image'&&blocks[i+1]?.type.name==='horizontal_rule').length,qualityBoundaryCalls:calls.all,requiredQualityBoundaryCalls:calls.required,ownedDividerRecords:run?.coreDividerRecords?.length||0,retainedQualityBoundaryRecords:records.length,retainedQualityBoundaryConfirmed:records.filter(row=>row.findings.some(item=>item.check==='直後の区切り'&&item.status==='confirmed')).length};
 const valid=run?.stage==='images_ready'&&run.draftSaveState==='confirmed'&&state.images.length===count+1&&JSON.stringify(ids)===JSON.stringify(expected)&&!inspection.fault&&!run.qualityHold&&boundaries.nativeDividerCount===count+1&&boundaries.immediateImageBoundaries===count+1&&boundaries.requiredQualityBoundaryCalls===count+1&&boundaries.ownedDividerRecords===count+1&&records.length>0&&boundaries.retainedQualityBoundaryConfirmed===records.length&&state.api.byKind.search&&(scenario==='paginated_tag'||state.api.byKind.magazine&&state.api.byKind.likes);
 return{scenario,people:count,api:state.api,extractionMs:state.rowsReadyAt===null?null:state.rowsReadyAt-state.startedAt,pasteMs:state.rowsReadyAt===null?null:state.finishedAt-state.rowsReadyAt,totalMs:state.finishedAt-state.startedAt,firstImageMs:state.firstUploadAt===null?null:state.firstUploadAt-state.startedAt,scheduledWaitMs:state.waits.reduce((sum,item)=>sum+item.ms,0),sourceWaitMs:state.waits.filter(item=>item.phase==='extraction').reduce((sum,item)=>sum+item.ms,0),pasteWaitMs:state.waits.filter(item=>item.phase==='paste').reduce((sum,item)=>sum+item.ms,0),images:state.images.length,stage:run?.stage,draftSaveState:run?.draftSaveState,finalMathLast:ids.at(-1)==='fuku444',orderedPeopleMatch:JSON.stringify(ids)===JSON.stringify(expected),boundaries,qualityFault:inspection.fault,qualityFailures:inspection.records.filter(row=>row.findings.some(item=>item.status==='failed')),valid:Boolean(valid),lastStatus:state.statuses.at(-1)};
}
