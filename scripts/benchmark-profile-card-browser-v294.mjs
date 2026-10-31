// Independent real-Chromium validation. This never opens the live note editor:
// the editor-origin page/font requests are fulfilled locally and all other
// browser requests are blocked. Product source and quality budgets are intact.
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {rolldown} from 'rolldown';
import {browserLayoutDependencies} from './render-profile-card-layout-v293.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),require=createRequire(import.meta.url);
const currentPath=join(root,'public/note-profile-card-likes300-fix-v220.user.js');
const expectedCurrent='3c8d104ce10ea1ef24321c334d8f1683e5d9a9ca9a6bb7c1ff122e76a131b229';
const sha=value=>createHash('sha256').update(value).digest('hex');
const identity=code=>({sha256:sha(code),version:code.match(/@version\s+(\S+)/)?.[1]||null});
function esmModule(name,override){
 const bases=[join(root,'node_modules'),join(root,'..','quality-deps','node_modules'),process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES].filter(Boolean);
 for(const base of bases){
  try{
   const resolver=createRequire(join(base,'package.json')),file=override?resolver.resolve(override):resolver.resolve(name);let directory=dirname(file);
   while(directory!==dirname(directory)){
    const manifest=join(directory,'package.json');
    if(existsSync(manifest)&&JSON.parse(readFileSync(manifest,'utf8')).name===name){const esm=join(directory,'dist/index.js');if(existsSync(esm))return esm;break;}
    directory=dirname(directory);
   }
  }catch{}
 }
 throw Error('Cannot locate the actual '+name+' ESM distribution');
}
export async function browserBenchmarkBundle(){
 const model=esmModule('prosemirror-model',process.env.PM_MODEL_TEST_MODULE),state=esmModule('prosemirror-state',process.env.PM_STATE_TEST_MODULE),fixture=join(root,'tests/fixtures/profile-card-browser-runtime-v294.mjs');
 const entry=`import * as PMModel from ${JSON.stringify(model)};import * as PMState from ${JSON.stringify(state)};import {runBrowserSample} from ${JSON.stringify(fixture)};globalThis.__MUMEI_BROWSER_BENCH__={runBrowserSample,pm:{...PMModel,...PMState}};`;
 const bundle=await rolldown({input:'profile-browser-benchmark',platform:'browser',treeshake:false,plugins:[{name:'anonymous-browser-benchmark',resolveId(id){if(id==='profile-browser-benchmark')return'\0profile-browser-benchmark';},load(id){if(id==='\0profile-browser-benchmark')return entry;}}]});
 try{const generated=await bundle.generate({format:'iife',name:'ProfileBrowserBenchmark'}),chunk=generated.output.find(item=>item.type==='chunk');if(!chunk)throw Error('No browser bundle was generated');return{code:chunk.code,sha256:sha(chunk.code),pm:{model:sha(readFileSync(model)),state:sha(readFileSync(state))},fixture:sha(readFileSync(fixture))};}
 finally{await bundle.close();}
}
const html=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>@font-face{font-family:BrowserQAJP;src:url('/__profile_qa__/NotoSansJP.ttf') format('truetype');font-display:block}body{font-family:BrowserQAJP,system-ui,sans-serif;margin:0}</style></head><body><main>匿名の検証用ページ</main></body></html>`;
const launchArgs=['--no-sandbox','--disable-gpu','--disable-software-rasterizer','--disable-gpu-compositing','--use-gl=disabled','--no-zygote','--single-process'];
function xml(value){return String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function fontConfiguration(font){
 const directory=join(root,'..','browser-speed-v294-runtime');mkdirSync(directory,{recursive:true});const cache=join(directory,'font-cache');mkdirSync(cache,{recursive:true});
 const path=join(directory,'fonts.conf');writeFileSync(path,'<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd"><fontconfig><include ignore_missing="yes">/etc/fonts/fonts.conf</include><dir>'+xml(dirname(font))+'</dir><cachedir>'+xml(cache)+'</cachedir></fontconfig>\n');return path;
}
const median=values=>{const items=[...values].sort((a,b)=>a-b),middle=Math.floor(items.length/2);return items.length%2?items[middle]:(items[middle-1]+items[middle])/2;};

export async function runBrowserBenchmark({count=200,repetitions=1,apiLatencyMs=20,scenarios=['paginated_tag'],mode='strict',smoke=true,stopOnInvalid=true,outputFile=null,currentSha256=process.env.EXPECTED_BROWSER_CURRENT_SHA256||expectedCurrent,baselineRef='9a2f79d7'}={}){
 if(!Number.isInteger(count)||count<2||!Number.isInteger(repetitions)||repetitions<0||!Number.isFinite(apiLatencyMs)||apiLatencyMs<=0)throw Error('Invalid browser benchmark configuration');
 if(!['strict','operational','clone-probe','recursive-clone-probe'].includes(mode))throw Error('Unknown browser study mode');
 const deps=browserLayoutDependencies();if(!deps.available)throw Error('Chromium, Playwright and Noto Sans JP are required');
 const codes={baseline:execFileSync('git',['show',baselineRef+':public/note-profile-card-likes300-fix-v220.user.js'],{cwd:root,encoding:'utf8',maxBuffer:3e6}),current:readFileSync(currentPath,'utf8')};
 const sources={baseline:{ref:baselineRef,...identity(codes.baseline)},current:identity(codes.current)};
 if(sources.current.sha256!==currentSha256)throw Error('Current script hash changed: '+sources.current.sha256);
 const bundled=await browserBenchmarkBundle(),font=readFileSync(deps.japaneseFont),fontConfig=fontConfiguration(deps.japaneseFont),samples=[];let engine='';
 const report={mode,objective:mode==='operational'?'Predefined completed-operation elapsed-time study, including the existing fail-safe if additional inspection faults. Every sample starts quality ON. A quality fault remains fixture.valid=false and qualityVerified=false; it is retained and never converted into an inspection pass. All fixed samples contribute to speed only if their operational output completes. This does not establish fault-free quality-speed acceptance.':'Fault-free inspection and completed-operation speed together; stop on the first invalid sample.',method:'Actual compiled userscripts, real Chromium canvas/toBlob/File/DataTransfer/DOMParser/timers and real ProseMirror model/state. Synthetic paginated API with fixed latency, synchronous simulated native uploads and positive simulated native save. All browser HTTP is intercepted; this is not live note.com, Edge, or a phone. Each sample uses a fresh Chromium process and context. Noto Sans JP is available through isolated Fontconfig and preloaded as a webfont before timing; no source font or quality-budget rewrite, Node GC subtraction, forced GC, invalid-sample replacement or discarded attempts.',sources,fixtureSha256:bundled.fixture,pmSha256:bundled.pm,bundleSha256:bundled.sha256,fontSha256:sha(font),count,repetitions,apiLatencyMs,scenarios,stopOnInvalid,engine:null,samples,summary:{},...(mode==='strict'?{allValid:false}:{outputAllCompleted:false,qualityAllVerified:false,speedTargetMet:false})};
 const persist=()=>{if(outputFile){mkdirSync(dirname(resolve(outputFile)),{recursive:true});writeFileSync(resolve(outputFile),JSON.stringify(report,null,2)+'\n');}};
 async function sample(kind,scenario,people,round,smokeSample){
  let browser;const network=[],errors=[];let result;
  try{
   browser=await deps.playwright.chromium.launch({headless:true,executablePath:deps.executablePath,ignoreDefaultArgs:['--enable-unsafe-swiftshader'],args:launchArgs,env:{...process.env,FONTCONFIG_FILE:fontConfig}});
   engine=await browser.version();report.engine='Chromium '+engine;
   const context=await browser.newContext({viewport:{width:430,height:932},deviceScaleFactor:1,isMobile:true,hasTouch:true});
   await context.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url());network.push({url:request.url(),kind:request.resourceType()});
    if(url.origin==='https://editor.note.com'&&url.pathname==='/__profile_qa__/NotoSansJP.ttf')return route.fulfill({status:200,contentType:'font/ttf',body:font});
    if(url.origin==='https://editor.note.com'&&url.pathname==='/notes/naaaaaaaaaaaa/edit')return route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:html});
    errors.push('Blocked unexpected browser request: '+request.url());await route.abort('blockedbyclient');
   });
   const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
   await page.goto('https://editor.note.com/notes/naaaaaaaaaaaa/edit',{waitUntil:'load'});
   const fontLoaded=await page.evaluate(async()=>{await document.fonts.load('700 26px BrowserQAJP','名前変更✨匿名の作者さん');await document.fonts.ready;return document.fonts.check('700 26px BrowserQAJP','名前変更✨匿名の作者さん');});
   if(!fontLoaded)throw Error('Japanese font was not loaded before timing');
   await page.addScriptTag({content:bundled.code});
   result=await page.evaluate(async input=>{const runtime=window.__MUMEI_BROWSER_BENCH__;if(!runtime)throw Error('Browser fixture bundle did not initialize');return runtime.runBrowserSample({...input,pm:runtime.pm});},{code:codes[kind],count:people,scenario,apiLatencyMs});
   const api=result.api?.byKind||{},boundaries=result.boundaries||{},outputCompleted=result.stage==='images_ready'&&result.draftSaveState==='confirmed'&&result.images===people+1&&result.orderedPeopleMatch===true&&result.finalMathLast===true&&boundaries.nativeDividerCount===people+1&&boundaries.immediateImageBoundaries===people+1&&boundaries.ownedDividerRecords===people+1&&api.search>0&&(scenario==='paginated_tag'||api.magazine>0&&api.likes>0)&&errors.length===0;
   result={...result,valid:result.valid===true&&errors.length===0,outputCompleted:Boolean(outputCompleted),qualityVerified:result.valid===true&&errors.length===0,fontLoaded:true,errors,network:network.map(item=>({...item})),version:sources[kind].version,sha256:sources[kind].sha256,kind,round,smoke:smokeSample};
   if(mode==='clone-probe'&&result.outputCompleted)result.cloneProbe=await page.evaluate(()=>{
    const run=window.coreApi.readRun(),serialized=JSON.stringify(run),canonical=JSON.parse(serialized),iterations=100,blocks=[];
    if(typeof structuredClone!=='function')throw Error('Native browser structuredClone is unavailable');
    function measure(method){
     let last;const start=performance.now();for(let index=0;index<iterations;index++)last=method==='jsonParse'?JSON.parse(serialized):structuredClone(canonical);const elapsedMs=performance.now()-start;
     const equal=JSON.stringify(last)===serialized,independent=last!==canonical&&(!canonical.rows||last.rows!==canonical.rows);
     return{method,iterations,elapsedMs,perCloneMs:elapsedMs/iterations,equal,independent};
    }
    for(let block=0;block<3;block++){const order=block%2===0?['jsonParse','structuredClone']:['structuredClone','jsonParse'];for(const method of order)blocks.push({block,...measure(method)});}
    const median=values=>[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)],jsonParseMs=median(blocks.filter(item=>item.method==='jsonParse').map(item=>item.perCloneMs)),structuredCloneMs=median(blocks.filter(item=>item.method==='structuredClone').map(item=>item.perCloneMs));
    return{objective:'Post-completion diagnostic only. Real saved-run JSON parse vs native structuredClone of its canonical parsed snapshot; alternating method order in three fixed blocks, 100 iterations each; natural GC included, no forced GC or timing subtraction. Deep JSON equality and independence checks are outside each timed loop.',serializedBytes:new TextEncoder().encode(serialized).length,people:run.rows.length-1,rows:run.rows.length,iterationsPerBlock:iterations,blocks,medianPerCloneMs:{jsonParse:jsonParseMs,structuredClone:structuredCloneMs},structuredCloneChangePercent:(structuredCloneMs/jsonParseMs-1)*100,verified:blocks.every(item=>item.equal&&item.independent)};
   });
   if(mode==='recursive-clone-probe'&&result.outputCompleted)result.cloneProbe=await page.evaluate(()=>{
    const run=window.coreApi.readRun(),serialized=JSON.stringify(run),canonical=JSON.parse(serialized),iterations=100,blocks=[];
    function cloneCanonical(value,depth=0){
     if(value===null||typeof value!=='object')return value;
     if(depth>256)throw Error('Canonical clone depth guard');
     if(Array.isArray(value)){const out=new Array(value.length);for(let index=0;index<value.length;index++)out[index]=cloneCanonical(value[index],depth+1);return out;}
     const out={};for(const key of Object.keys(value)){const item=cloneCanonical(value[key],depth+1);if(key==='__proto__')Object.defineProperty(out,key,{value:item,writable:true,enumerable:true,configurable:true});else out[key]=item;}return out;
    }
    const sourceObjects=new WeakSet();let sourceObjectCount=0;const todo=[canonical];
    while(todo.length){const value=todo.pop();if(value&&typeof value==='object'&&!sourceObjects.has(value)){sourceObjects.add(value);sourceObjectCount++;for(const key of Object.keys(value))todo.push(value[key]);}}
    function noSharing(value){const pending=[value],seen=new WeakSet();while(pending.length){const item=pending.pop();if(item&&typeof item==='object'&&!seen.has(item)){if(sourceObjects.has(item))return false;seen.add(item);for(const key of Object.keys(item))pending.push(item[key]);}}return true;}
    function measure(method){
     let last;const start=performance.now();for(let index=0;index<iterations;index++)last=method==='jsonParse'?JSON.parse(serialized):cloneCanonical(canonical);const elapsedMs=performance.now()-start;
     return{method,iterations,elapsedMs,perCloneMs:elapsedMs/iterations,equal:JSON.stringify(last)===serialized,independent:noSharing(last)};
    }
    for(let block=0;block<3;block++){const order=block%2===0?['jsonParse','recursiveClone']:['recursiveClone','jsonParse'];for(const method of order)blocks.push({block,...measure(method)});}
    const edge=JSON.parse('{"__proto__":{"polluted":true},"nested":[{"value":"日本語"},null,true,3]}'),edgeCopy=cloneCanonical(edge);
    const protoSafe=Object.getPrototypeOf(edgeCopy)===Object.prototype&&Object.hasOwn(edgeCopy,'__proto__')&&edgeCopy.polluted===undefined&&JSON.stringify(edgeCopy)===JSON.stringify(edge);
    let deep=null;for(let index=0;index<300;index++)deep={next:deep};let depthGuard=false;try{cloneCanonical(deep)}catch{depthGuard=true;}
    const median=values=>[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)],jsonParseMs=median(blocks.filter(item=>item.method==='jsonParse').map(item=>item.perCloneMs)),recursiveCloneMs=median(blocks.filter(item=>item.method==='recursiveClone').map(item=>item.perCloneMs));
    return{objective:'Post-completion diagnostic only. Actual saved-run JSON.parse vs recursive clone of its already parsed canonical JSON tree. Scalars are reused; every object and array is copied; __proto__ is defined as an own data property and depth >256 throws. Three fixed alternating blocks of 100 iterations; no forced GC or fallback inside the measured candidate. Deep JSON equality, a full source-object WeakSet sharing check and edge checks are outside timed loops.',serializedBytes:new TextEncoder().encode(serialized).length,people:run.rows.length-1,rows:run.rows.length,sourceObjectCount,iterationsPerBlock:iterations,blocks,medianPerCloneMs:{jsonParse:jsonParseMs,recursiveClone:recursiveCloneMs},recursiveCloneChangePercent:(recursiveCloneMs/jsonParseMs-1)*100,protoSafe,depthGuard,verified:protoSafe&&depthGuard&&blocks.every(item=>item.equal&&item.independent)};
   });
  }catch(error){result={kind,scenario,people,round,smoke:smokeSample,valid:false,outputCompleted:false,qualityVerified:false,error:error.message,errors,network,sha256:sources[kind].sha256,version:sources[kind].version};}
  finally{await browser?.close();}
  samples.push(result);persist();console.log(JSON.stringify({browserSample:true,mode,...result,network:undefined}));return result;
 }
 if(mode.endsWith('clone-probe')){
  report.objective='One current completed 200-person browser pipeline followed by a separately timed clone diagnostic. This is not a repeated pipeline-speed study or a quality-pass claim.';
  const result=await sample('current','paginated_tag',count,0,false);report.outputAllCompleted=result.outputCompleted;report.qualityAllVerified=result.qualityVerified;report.cloneProbe=result.cloneProbe||null;delete report.speedTargetMet;report.completedAt=new Date().toISOString();persist();return report;
 }
 if(smoke){for(const kind of ['baseline','current'])await sample(kind,'paginated_tag',2,-1,true);if(samples.some(item=>!item.valid)){report.smokeFailed=true;persist();return report;}}
 measured:for(const scenario of scenarios)for(let round=0;round<repetitions;round++)for(const kind of round%2===0?['baseline','current']:['current','baseline']){const result=await sample(kind,scenario,count,round,false);if(mode==='operational'?!result.outputCompleted:stopOnInvalid&&!result.valid){report.stoppedOnInvalid=true;break measured;}}
 for(const scenario of scenarios){
  const rows=samples.filter(item=>!item.smoke&&item.scenario===scenario),before=rows.filter(item=>item.kind==='baseline'),after=rows.filter(item=>item.kind==='current'),complete=rows.length===2*repetitions&&rows.every(item=>mode==='operational'?item.outputCompleted:item.valid);
  const summary={complete,requestedPerVariant:repetitions,baselineValid:before.filter(item=>item.valid).length,currentValid:after.filter(item=>item.valid).length,failed:rows.filter(item=>!item.valid).length,outputCompleted:rows.filter(item=>item.outputCompleted).length,qualityVerified:rows.filter(item=>item.qualityVerified).length,qualityFaults:rows.filter(item=>item.qualityFault).length,workflowFailures:rows.filter(item=>!item.outputCompleted).length};
  if(complete&&repetitions){summary.baseline=Object.fromEntries(['extractionMs','pasteMs','totalMs'].map(key=>[key,median(before.map(item=>item[key]))]));summary.current=Object.fromEntries(['extractionMs','pasteMs','totalMs'].map(key=>[key,median(after.map(item=>item[key]))]));summary.changePercent=Object.fromEntries(['extractionMs','pasteMs','totalMs'].map(key=>[key,(summary.current[key]/summary.baseline[key]-1)*100]));}
  if(mode==='operational')summary.speedTargetMet=complete&&Boolean(summary.changePercent)&&summary.changePercent.totalMs<=5;
  report.summary[scenario]=summary;
 }
 report.sourceChangedDuringRun=sha(readFileSync(currentPath))!==sources.current.sha256;
 if(mode==='strict')report.allValid=samples.length>0&&samples.every(item=>item.valid)&&!report.sourceChangedDuringRun;
 else{report.outputAllCompleted=samples.filter(item=>!item.smoke).length===2*repetitions*scenarios.length&&samples.every(item=>item.outputCompleted)&&!report.sourceChangedDuringRun;report.qualityAllVerified=samples.length>0&&samples.every(item=>item.qualityVerified);report.speedTargetMet=report.outputAllCompleted&&Object.values(report.summary).every(item=>item.speedTargetMet);}
 report.completedAt=new Date().toISOString();persist();return report;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const count=Number(process.argv[2]||200),repetitions=process.env.BROWSER_BENCH_SMOKE_ONLY==='1'?0:Number(process.argv[3]||1),outputFile=process.argv[4]||null,scenarios=(process.env.BROWSER_BENCH_SCENARIOS||'paginated_tag').split(',').filter(Boolean),mode=process.env.BROWSER_BENCH_MODE||'strict';
 const report=await runBrowserBenchmark({count,repetitions,outputFile,scenarios,mode,smoke:mode!=='operational'});console.log(JSON.stringify({browserBenchmarkSummary:true,mode,engine:report.engine,sources:report.sources,summary:report.summary,allValid:report.allValid,outputAllCompleted:report.outputAllCompleted,qualityAllVerified:report.qualityAllVerified,speedTargetMet:report.speedTargetMet,cloneProbe:report.cloneProbe,smokeFailed:report.smokeFailed||false,outputFile},null,2));if(mode.endsWith('clone-probe')?!report.cloneProbe?.verified:mode==='operational'?!report.outputAllCompleted||!report.speedTargetMet:!report.allValid)process.exitCode=1;
}
