import {performance} from 'node:perf_hooks';
import {runtime,dependencies} from '../tests/fixtures/profile-card-quality-runtime.mjs';
if(!dependencies)throw Error('Set PM_MODEL_TEST_MODULE, PM_STATE_TEST_MODULE and CANVAS_TEST_MODULE');
const repetitions=Number(process.argv[2]||5),count=200;
const results={baseline:[],quality:[]};
const median=values=>[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)];
for(let round=-1;round<repetitions;round++){
 for(const baseline of round%2===0?[true,false]:[false,true]){
  const r=await runtime({baseline,count,render:false,realWaits:true});
  const start=performance.now();await r.history();const elapsedMs=performance.now()-start;
  const waits=r.state.waits.reduce((sum,value)=>sum+value,0),run=r.editor.readRun();
  if(run?.stage!=='images_ready'||r.state.images.length!==201||r.quality?.snapshot().fault)throw Error('Benchmark run did not complete all original work and all additional inspections');
  // Execute the original 50ms waits, without adding quality-specific waits.
  // Native note/network capabilities remain simulated; this is not a phone test.
  if(round>=0)results[baseline?'baseline':'quality'].push({elapsedMs,scheduledWaitMs:waits});
  console.log(JSON.stringify({round,kind:baseline?'baseline':'quality',elapsedMs:Math.round(elapsedMs),scheduledWaitMs:waits}));r.close();
 }
}
const a=median(results.baseline.map(x=>x.elapsedMs)),b=median(results.quality.map(x=>x.elapsedMs));
console.log(JSON.stringify({environment:'same managed executor / Node / real PM + canvas / original waits and real clock / fake cached note capabilities / no real network or phone',people:count,repetitions,results,medianElapsedMs:{baseline:a,quality:b,changePercent:(b/a-1)*100}},null,2));
