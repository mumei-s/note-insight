import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
const root=process.cwd(),out=path.join(root,'test-results/settings-update-20260930');
await fs.mkdir(out,{recursive:true});
const base=(await fs.readFile('/tmp/settings-update-base','utf8')).trim();
const dir=await fs.mkdtemp(path.join(os.tmpdir(),'insight-static-baseline-'));
function run(command,args,cwd){const r=spawnSync(command,args,{cwd,encoding:'utf8',maxBuffer:32*1024*1024});if(r.error)throw r.error;return r;}
try{
 const archive=path.join(dir,'base.tar');
 let r=run('git',['archive','--format=tar','--output='+archive,base],root);assert.equal(r.status,0,r.stderr);
 r=run('tar',['-xf',archive,'-C',dir],root);assert.equal(r.status,0,r.stderr);
 await fs.symlink(path.join(root,'node_modules'),path.join(dir,'node_modules'),'dir');
 r=run('npm',['run','build'],dir);assert.equal(r.status,0,r.stdout+r.stderr);
 const before=run('node',['--test','--test-reporter=tap','tests/static.test.mjs'],dir);
 const after=run('node',['--test','--test-reporter=tap','tests/static.test.mjs'],root);
 await fs.writeFile(path.join(out,'static-before.tap'),before.stdout+'\n'+before.stderr);
 await fs.writeFile(path.join(out,'static-after.tap'),after.stdout+'\n'+after.stderr);
 const failures=text=>[...text.matchAll(/^not ok \d+ - (.+)$/gm)].map(m=>m[1]).sort();
 const count=text=>Number(text.match(/^# tests (\d+)/m)?.[1]||0);
 assert.ok(count(before.stdout)>0,'Baseline must actually run');
 assert.equal(count(after.stdout),count(before.stdout),'No tests may disappear');
 assert.deepEqual(failures(after.stdout),failures(before.stdout),'New or different failure; block deployment');
 assert.equal(after.status,before.status,'Exit status regression');
 const report={baseCommit:base,total:count(after.stdout),unchangedFailures:failures(after.stdout),newFailures:[],note:'Existing assertions inspect old brand spacing, legacy HubHome source, and old OWNER text. Baseline and candidate outputs retained; tests were not removed or marked passed.'};
 await fs.writeFile(path.join(out,'static-comparison.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify(report,null,2));
}finally{await fs.rm(dir,{recursive:true,force:true});}
