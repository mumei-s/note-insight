/**
 * Fresh-process v2.9.3/v2.9.4 normalization benchmark, real PM/canvas + mocked APIs.
 * Usage: node scripts/benchmark-profile-card-normalization-v294.mjs [current-sha256] [output.jsonl] [resume.jsonl]
 * Dependencies: PM_MODEL_TEST_MODULE, PM_STATE_TEST_MODULE, CANVAS_TEST_MODULE, KATEX_TEST_MODULE.
 * Each version in a pair runs even if its counterpart fails. A rejected pair excludes BOTH timings.
 * Three observed rejected pairs stop collection; at most two rejected pairs may be replaced.
 * No forced GC, warmup, cache reset, budget change, or hidden retry is performed.
 */
import {spawnSync,execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,appendFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const expected=process.argv[2]||'c7a4da167068ca689a4b5a0a5f4384fc2b959d84698e008dffb38bbfaf50b9b6';
const output=resolve(process.argv[3]||'profile-card-normalization-v294.jsonl');
const resume=process.argv[4]?resolve(process.argv[4]):null;
const hash=value=>createHash('sha256').update(value).digest('hex');
const currentCode=readFileSync(resolve(root,'public/note-profile-card-likes300-fix-v220.user.js'),'utf8');
const baselineCode=execFileSync('git',['show','9a2f79d:public/note-profile-card-likes300-fix-v220.user.js'],{cwd:root,encoding:'utf8',maxBuffer:3e6});
const fixtureSha256=hash(readFileSync(resolve(root,'tests/fixtures/profile-card-quality-runtime.mjs')));
const current={version:currentCode.match(/@version\s+(\S+)/)?.[1],sha256:hash(currentCode)};
const baseline={ref:'9a2f79d',version:baselineCode.match(/@version\s+(\S+)/)?.[1],sha256:hash(baselineCode)};
if(current.sha256!==expected)throw Error('Frozen current bundle SHA mismatch');
const worker=String.raw`
import {readFileSync} from 'node:fs';import {execFileSync} from 'node:child_process';import {createHash} from 'node:crypto';import {runtime} from './tests/fixtures/profile-card-quality-runtime.mjs';
const variant=process.env.PROFILE_BENCH_VARIANT,scenario=process.env.PROFILE_BENCH_CASE,round=Number(process.env.PROFILE_BENCH_ROUND),range=(start,end)=>Array.from({length:end-start},(_,i)=>start+i),hash=value=>createHash('sha256').update(value).digest('hex'),code=variant==='baseline'?execFileSync('git',['show','9a2f79d:public/note-profile-card-likes300-fix-v220.user.js'],{encoding:'utf8',maxBuffer:3e6}):readFileSync('public/note-profile-card-likes300-fix-v220.user.js','utf8'),sha256=hash(code),fixtureSha256=hash(readFileSync('tests/fixtures/profile-card-quality-runtime.mjs'));
if(sha256!==process.env.PROFILE_BENCH_EXPECTED_SHA||fixtureSha256!==process.env.PROFILE_BENCH_FIXTURE_SHA)throw Error('Frozen bundle or fixture changed during collection');
const sourceFixtures=scenario==='paginated_tag'?{tags:{fixture:range(0,200)}}:{tags:{fixture:range(0,60)},magazines:{mfixture:range(58,130)},likes:{n000000000099:range(128,200)}},sources=scenario==='paginated_tag'?'#fixture':'#fixture\nhttps://note.com/fixture/m/mfixture\nhttps://note.com/fixture/n/n000000000099',r=await runtime({moduleCode:code,count:200,render:false,realWaits:true,sourceFixtures,apiLatencyMs:20}),calls={all:0,required:0},original=r.quality?.imageBoundary;
if(typeof original==='function')r.quality.imageBoundary=function(...args){calls.all++;if(args[3]?.dividerRequired)calls.required++;return Reflect.apply(original,this,args)};
try{
 const run=await r.normal({sources}),inspection=r.quality.snapshot(),blocks=r.doc().content||[],nativeDividerCount=blocks.filter(node=>node.type==='horizontal_rule').length,immediateImageBoundaries=blocks.filter((node,index)=>node.type==='image'&&blocks[index+1]?.type==='horizontal_rule').length,retained=inspection.records.filter(record=>record.stage==='区切り'),retainedConfirmed=retained.filter(record=>record.findings.some(finding=>finding.check==='直後の区切り'&&finding.status==='confirmed')).length,ids=Array.from(run?.rows||[],row=>row.urlname),expected=[...range(0,200).map(i=>'quality_person_'+i),'fuku444'],metrics=r.metrics(),boundaries={nativeDividerCount,immediateImageBoundaries,qualityBoundaryCalls:calls.all,requiredQualityBoundaryCalls:calls.required,retainedQualityBoundaryRecords:retained.length,retainedQualityBoundaryConfirmed:retainedConfirmed,ownedDividerRecords:run?.coreDividerRecords?.length||0};
 const valid=run?.stage==='images_ready'&&run.draftSaveState==='confirmed'&&r.state.images.length===201&&JSON.stringify(ids)===JSON.stringify(expected)&&!inspection.fault&&!run.qualityHold&&nativeDividerCount===201&&immediateImageBoundaries===201&&calls.required===201&&retained.length>0&&retainedConfirmed===retained.length&&boundaries.ownedDividerRecords===201&&metrics.api.byKind.search&&(scenario==='paginated_tag'||metrics.api.byKind.magazine&&metrics.api.byKind.likes);
 console.log(JSON.stringify({scenario,kind:variant,round,version:code.match(/@version\s+(\S+)/)?.[1],sha256,fixtureSha256,processIsolation:'fresh Node process; no per-process warmup',...metrics,people:200,images:r.state.images.length,finalMathLast:ids.at(-1)==='fuku444',orderedPeopleMatch:JSON.stringify(ids)===JSON.stringify(expected),stage:run?.stage,draftSaveState:run?.draftSaveState,boundaries,qualityFault:inspection.fault,qualityFailures:inspection.records.filter(record=>record.findings.some(finding=>finding.status==='failed')),valid:Boolean(valid),invalidSample:!valid}));if(!valid)process.exitCode=1;
}finally{r.close()}
`;

const prior=resume?readFileSync(resume,'utf8').split('\n').filter(Boolean).map(line=>JSON.parse(line)):[];
if(prior.length&&(prior[0].sampleWorkerSha256!==hash(worker)||prior[0].fixtureSha256!==fixtureSha256||prior[0].baseline?.sha256!==baseline.sha256||prior[0].current?.sha256!==current.sha256))throw Error('Resume worker/fixture/bundle fingerprint mismatch');
const config={benchmarkConfig:true,baseline,current,fixtureSha256,sampleWorkerSha256:hash(worker),driverSha256:hash(readFileSync(new URL(import.meta.url))),people:200,apiLatencyMs:20,repetitions:3,processPolicy:'Fresh Node process per sample, sequential, no per-process warmup; initialization outside measured normal(); first PNG cold work included; B/C, C/B, B/C balanced logical rounds in each scenario.',boundedMatchedPairPolicy:{requiredValidPairsPerScenario:3,maxRejectedPairs:2,maxAttemptedSamples:16,discard:'If either version faults or is incomplete, exclude BOTH samples, retain raw records, replace whole pair in the same order.'},resumedSamples:prior.filter(row=>row.scenario&&!row.pairDecision).length};
const samples=prior.filter(row=>row.scenario&&!row.pairDecision),pairs=[],groups=new Map();
writeFileSync(output,JSON.stringify(config)+'\n');
const emit=row=>appendFileSync(output,JSON.stringify(row)+'\n');
for(const row of samples){row.pairAttempt??=0;row.sampleId??=row.scenario+':'+row.round+':'+row.pairAttempt+':'+row.kind;emit(row);const key=row.scenario+'|'+row.round+'|'+row.pairAttempt;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row)}
function decide(group){if(group.length!==2)throw Error('Incomplete input pair');const first=group[0],valid=group.every(row=>row.valid===true&&!row.qualityFault&&!row.invalidSample);const decision={pairDecision:true,scenario:first.scenario,round:first.round,pairAttempt:first.pairAttempt,order:group.map(row=>row.kind),valid,acceptedForMedians:valid,sampleIds:group.map(row=>row.sampleId),reason:valid?'both versions completed with all inspections':'At least one version failed the real inspection/completion guard; BOTH timings excluded.'};pairs.push(decision);emit(decision);return decision}
for(const group of groups.values())decide(group);
let attempted=samples.length,rejected=pairs.filter(row=>!row.valid).length,unstable=rejected>2;
outer:for(const scenario of ['paginated_tag','composite_tag_magazine_note_likes'])for(let round=0;round<3;round++)while(!pairs.some(row=>row.scenario===scenario&&row.round===round&&row.valid)){
 if(unstable||attempted+2>16){unstable=true;break outer}
 const attempts=pairs.filter(row=>row.scenario===scenario&&row.round===round).map(row=>row.pairAttempt),pairAttempt=attempts.length?Math.max(...attempts)+1:0,order=round%2===0?['baseline','current']:['current','baseline'],group=[];
 for(const kind of order){
  const result=spawnSync(process.execPath,['--input-type=module','-e',worker],{cwd:root,env:{...process.env,PROFILE_BENCH_VARIANT:kind,PROFILE_BENCH_CASE:scenario,PROFILE_BENCH_ROUND:String(round),PROFILE_BENCH_EXPECTED_SHA:(kind==='baseline'?baseline:current).sha256,PROFILE_BENCH_FIXTURE_SHA:fixtureSha256},encoding:'utf8',maxBuffer:4e6});
  let row;try{row=result.stdout.split('\n').filter(Boolean).map(line=>JSON.parse(line)).find(value=>value.scenario)}catch{}
  row??={scenario,kind,round,valid:false,invalidSample:true,processFailure:{status:result.status,stderr:result.stderr}};row.pairAttempt=pairAttempt;row.sampleId=scenario+':'+round+':'+pairAttempt+':'+kind;row.workerExitCode=result.status;samples.push(row);group.push(row);attempted++;emit(row);
 }
 const decision=decide(group);if(!decision.valid)rejected++;console.log(JSON.stringify({...decision,attemptedSamples:attempted,rejectedPairs:rejected}));if(rejected>2||group.some(row=>row.processFailure)){unstable=true;break outer}
}
const complete=!unstable&&pairs.filter(row=>row.valid).length===6;
const result={collectionComplete:true,complete,unstable,validPairs:pairs.filter(row=>row.valid).length,rejectedPairs:rejected,attemptedSamples:attempted};emit(result);console.log(JSON.stringify(result));if(!complete)process.exitCode=1;
