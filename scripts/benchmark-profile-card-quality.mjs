import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {runtime,dependencies} from '../tests/fixtures/profile-card-quality-runtime.mjs';

if(!dependencies)throw Error('Set PM_MODEL_TEST_MODULE, PM_STATE_TEST_MODULE and CANVAS_TEST_MODULE');
const repetitions=Number(process.argv[2]||3),count=Number(process.argv[3]||60),apiLatencyMs=Number(process.argv[4]||12);
if(!Number.isInteger(repetitions)||repetitions<1||!Number.isInteger(count)||count<6||!Number.isFinite(apiLatencyMs)||apiLatencyMs<=0)throw Error('Usage: node scripts/benchmark-profile-card-quality.mjs [repetitions>=1] [people>=6] [API latency ms>0]');
const baselineRef=process.env.QUALITY_GENERAL_BASELINE_REF||'260d7c3';
const baselineCode=process.env.QUALITY_GENERAL_BASELINE_SCRIPT?readFileSync(process.env.QUALITY_GENERAL_BASELINE_SCRIPT,'utf8'):execFileSync('git',['show',baselineRef+':public/note-profile-card-likes300-fix-v220.user.js'],{encoding:'utf8',maxBuffer:3e6});
const currentCode=readFileSync('public/note-profile-card-likes300-fix-v220.user.js','utf8');
const codeIdentity=code=>({version:code.match(/@version\s+(\S+)/)?.[1],sha256:createHash('sha256').update(code).digest('hex')});
const snapshot={baseline:{ref:baselineRef,...codeIdentity(baselineCode)},current:codeIdentity(currentCode)};
const requiresImageDividers=version=>{const [major,minor,patch]=String(version||'').split('.').map(Number);return major>2||major===2&&(minor>9||minor===9&&patch>=3)};
console.log(JSON.stringify({benchmarkConfig:true,...snapshot,people:count,repetitions,warmupRounds:1,apiLatencyMs}));
const range=(start,end)=>Array.from({length:Math.max(0,end-start)},(_,i)=>start+i);
const first=Math.max(2,Math.floor(count*.3)),second=Math.max(first+1,Math.floor(count*.65));
const scenarios=[
 {name:'paginated_tag',sources:'#fixture',sourceFixtures:{tags:{fixture:range(0,count)}}},
 {name:'composite_tag_magazine_note_likes',sources:'#fixture\nhttps://note.com/fixture/m/mfixture\nhttps://note.com/fixture/n/n000000000099',sourceFixtures:{tags:{fixture:range(0,first)},magazines:{mfixture:range(Math.max(0,first-2),second)},likes:{n000000000099:range(Math.max(0,second-2),count)}}}
];
const median=values=>{const sorted=[...values].sort((a,b)=>a-b),middle=Math.floor(sorted.length/2);return sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2};
const results=Object.fromEntries(scenarios.map(scenario=>[scenario.name,{baseline:[],current:[]}]));
for(const scenario of scenarios)for(let round=-1;round<repetitions;round++){
 for(const kind of round%2===0?['baseline','current']:['current','baseline']){
  const r=await runtime({moduleCode:kind==='baseline'?baselineCode:currentCode,count,render:false,realWaits:true,sourceFixtures:scenario.sourceFixtures,apiLatencyMs});
  try{
   const boundaryCalls={all:0,required:0},originalBoundary=r.quality?.imageBoundary;
   if(typeof originalBoundary==='function')r.quality.imageBoundary=function(...args){boundaryCalls.all++;if(args[3]?.dividerRequired)boundaryCalls.required++;return Reflect.apply(originalBoundary,this,args)};
   const run=await r.normal({sources:scenario.sources}),metrics=r.metrics(),ids=Array.from(run?.rows||[],row=>row.urlname),expected=[...range(0,count).map(i=>'quality_person_'+i),'fuku444'];
   const inspection=r.quality?.snapshot(),valid=run?.stage==='images_ready'&&r.state.images.length===count+1&&!inspection?.fault&&JSON.stringify(ids)===JSON.stringify(expected)&&!run.qualityHold&&run.draftSaveState==='confirmed';
   if(!valid){console.log(JSON.stringify({invalidSample:true,scenario:scenario.name,round,kind,stage:run?.stage,images:r.state.images.length,orderedPeopleMatch:JSON.stringify(ids)===JSON.stringify(expected),qualityFault:inspection?.fault,qualityFailures:inspection?.records.filter(record=>record.findings.some(finding=>finding.status==='failed')),hold:run?.qualityHold,draftSaveState:run?.draftSaveState}));throw Error('Benchmark did not complete the same ordered people, final math row, quality checks and confirmed save: '+r.state.statuses.at(-1)?.text)}
   if(!metrics.api.byKind.search||scenario.name.startsWith('composite')&&(!metrics.api.byKind.magazine||!metrics.api.byKind.likes))throw Error('Benchmark did not actually exercise its advertised source paths');
   const blocks=r.doc().content||[],nativeDividerCount=blocks.filter(node=>node.type==='horizontal_rule').length,immediateImageBoundaries=blocks.filter((node,index)=>node.type==='image'&&blocks[index+1]?.type==='horizontal_rule').length,expectsDividers=requiresImageDividers(snapshot[kind].version),retained=inspection?.records.filter(record=>record.stage==='区切り')||[],retainedConfirmed=retained.filter(record=>record.findings.some(finding=>finding.check==='直後の区切り'&&finding.status==='confirmed')).length;
   const boundaries={nativeDividerCount,immediateImageBoundaries,qualityBoundaryCalls:boundaryCalls.all,requiredQualityBoundaryCalls:boundaryCalls.required,retainedQualityBoundaryRecords:retained.length,retainedQualityBoundaryConfirmed:retainedConfirmed,expectedDividers:expectsDividers?count+1:0};
   if(expectsDividers?(nativeDividerCount!==count+1||immediateImageBoundaries!==count+1||boundaryCalls.required!==count+1||!retained.length||retainedConfirmed!==retained.length):nativeDividerCount!==0){console.log(JSON.stringify({invalidSample:true,scenario:scenario.name,round,kind,boundaryFailure:boundaries}));throw Error('Benchmark native divider/quality boundary validation failed')}
   const sample={...metrics,people:count,images:r.state.images.length,finalMathLast:ids.at(-1)==='fuku444',boundaries};
   if(round>=0)results[scenario.name][kind].push(sample);
   console.log(JSON.stringify({scenario:scenario.name,round,kind,...sample}));
  }finally{r.close()}
 }
}
const summary={};
for(const scenario of scenarios){
 const samples=results[scenario.name],baseline={},current={};
 for(const field of ['extractionMs','firstImageMs','pasteMs','totalMs','scheduledWaitMs','sourceWaitMs','pasteWaitMs']){baseline[field]=median(samples.baseline.map(sample=>sample[field]));current[field]=median(samples.current.map(sample=>sample[field]))}
 summary[scenario.name]={baseline,current,changePercent:Object.fromEntries(['extractionMs','pasteMs','totalMs'].map(field=>[field,(current[field]/baseline[field]-1)*100])),baselineApi:samples.baseline[0].api,currentApi:samples.current[0].api};
}
console.log(JSON.stringify({environment:'Same managed executor; compiled userscripts; real ProseMirror/canvas; real clock and requested waits; simulated paginated note API with nonzero latency and synchronous native uploads. This does not measure live note.com or a phone.',...snapshot,people:count,repetitions,warmupRounds:1,apiLatencyMs,summary,results},null,2));
