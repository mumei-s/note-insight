import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import test from 'node:test';

const read = path => readFileSync(path, 'utf8');
const release = JSON.parse(read('public/insight-release.json'));
for (const [file, field] of [['public/note-insight-dm.user.js', 'dmVersion'], ['public/note-insight-notification-v3.user.js', 'notificationVersion'], ['public/note-insight-dashboard-sync.user.js', 'dashboardVersion']]) {
  test(file + 'の公開版・導入報告・依存ファイルの更新を揃える', () => {
    const wrapper = read(file), meta = wrapper.match(/@version\s+(\S+)/)[1], runtime = wrapper.match(/const VERSION='([^']+)'/)[1];
    assert.equal(meta, release[field]);
    assert.equal(runtime, release[field]);
    for (const dependency of wrapper.matchAll(/@require\s+https:\/\/raw\.githubusercontent\.com\/mumei-s\/note-insight\/main\/(public\/note-insight-(?:dm-reader-v1|dm-network-v2|notification-filter-v4|notification-controls-v1)\.js)\?v=(\d+)/g)) {
      const version = read(dependency[1]).match(/const VERSION='([^']+)'/)[1];
      assert.equal(dependency[2], version.replaceAll('.', ''), dependency[1] + 'の古いrequireキャッシュを更新');
    }
  });
}
test('ダッシュボードのcoreと配布ラッパーの版・requireを一致させる',()=>{
 const wrapper=read('public/note-insight-dashboard-sync.user.js'),core=read('public/note-insight-dashboard-sync-core-v1.1.0.js');
 const version=core.match(/const VERSION='([^']+)'/)[1];assert.equal(version,release.dashboardVersion);
 assert.equal(core.match(/@version\s+(\S+)/)[1],version);
 assert.ok(wrapper.includes('sync-core-v1.1.0.js?v='+version.replaceAll('.','')));
 assert.ok(wrapper.includes('dashboard-feature-bridge-v1.js?v=101'));
 const queueVersion=read('public/note-insight-dashboard-save-queue-v1.js').match(/version:'([^']+)'/)[1];
 assert.ok(wrapper.includes('dashboard-save-queue-v1.js?v='+queueVersion.replaceAll('.','')),'保存処理の更新が古いrequireキャッシュに隠れない');
});


test('DM readerと配布wrapperだけを同一機能として扱い、他機能の混在を許可しない', t => {
 const dir=mkdtempSync(join(tmpdir(),'dm-feature-boundary-'));
 t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const git=(...args)=>execFileSync('git',args,{cwd:dir,stdio:'pipe'});
 git('init','-q');git('config','user.name','Test');git('config','user.email','test@example.invalid');git('commit','--allow-empty','-qm','base');
 const put=path=>{mkdirSync(dirname(join(dir,path)),{recursive:true});writeFileSync(join(dir,path),'fixture');};
 for(const path of ['public/note-insight-dm-reader-v1.js','public/note-insight-dm.user.js','public/insight-release.json','src/insight-release.ts','tests/dm-composer-v143.test.mjs'])put(path);
 git('add','.');git('commit','-qm','one DM release');
 const script=resolve('scripts/check-feature-boundaries.mjs');
 const check=()=>spawnSync(process.execPath,[script],{cwd:dir,encoding:'utf8'});
 const valid=check();assert.equal(valid.status,0,valid.stdout+valid.stderr);assert.match(valid.stdout,/OK -> dm/);
 for(const path of ['public/note-insight-notification-controls-v1.js','src/member-insight-social.tsx']){
  put(path);git('add','.');git('commit','--amend','--no-edit','-q');
  const invalid=check();assert.equal(invalid.status,1);assert.match(invalid.stderr,/FEATURE BOUNDARY VIOLATION/);
  git('rm','-q',path);git('commit','--amend','--no-edit','-q');
 }
});
