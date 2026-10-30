import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import './insight-update-return.test.mjs';
import './insight-update-return-context.test.mjs';

const read = path => readFileSync(path, 'utf8');
const release = JSON.parse(read('public/insight-release.json'));
test('本体・共通設定・配信ラベルは現在のrelease manifestと一致する',()=>{
 const source=read('src/insight-release.ts'),deploy=read('public/deploy-version.txt').split('\n')[0];
 for(const [constant,key] of [['CURRENT_INSIGHT_APP_VERSION','appVersion'],['CURRENT_NOTIFICATION_VERSION','notificationVersion'],['CURRENT_DASHBOARD_VERSION','dashboardVersion'],['CURRENT_DM_VERSION','dmVersion']]){
  assert.equal(source.match(new RegExp(constant+'\\s*=\\s*"([^"]+)"'))?.[1],release[key],key);
  assert.ok(deploy.includes(release[key]),key+' appears in deployment label');
 }
});
test('旧更新URLも元の画面・アカウント・hashを維持して共通installerへ進む',()=>{
 const base='https://mumei-s.github.io/note-insight/';
 for(const name of ['notification-install.html','notification-update.html','notification-update-v2961.html','notification-update-v2962.html','notification-update-v2963.html','notification-update-v2964.html','notification-update-v2965.html','notification-update-v2966.html','notification-update-v29665.html','tool-setup.html']){
  const url=new URL(base+name+'?notificationAccount=tester&from=insight&return='+encodeURIComponent(base+'?insightMode=normal&insightTab=dm#owner-insight')+'#settings');let next;
  runInNewContext(read('public/'+name).match(/<script>([\s\S]*?)<\/script>/)[1],{URL,location:{href:url.href,search:url.search,hash:url.hash,replace:href=>next=new URL(href)}});
  assert.equal(next.pathname,'/note-insight/notification-browser-install.html',name);assert.equal(next.search,url.search,name);assert.equal(next.hash,url.hash,name);
 }
});
for (const [file, field] of [['public/note-insight-dm.user.js', 'dmVersion'], ['public/note-insight-notification-v3.user.js', 'notificationVersion'], ['public/note-insight-dashboard-sync.user.js', 'dashboardVersion']]) {
  test(file + 'の公開版・導入報告・依存ファイルの更新を揃える', () => {
    const wrapper = read(file), meta = wrapper.match(/@version\s+(\S+)/)[1], runtime = wrapper.match(/const VERSION='([^']+)'/)[1];
    assert.equal(meta, release[field]);
    assert.equal(runtime, release[field]);
    if(field!=='dashboardVersion'){
      const scannerVersion=read('public/note-insight-social-compare-v1.js').match(/const VERSION='([^']+)'/)[1];
      assert.ok(wrapper.includes('note-insight-social-compare-v1.js?v='+scannerVersion.replaceAll('.','')),'social scanner updates bypass the old require cache');
    }
    for (const dependency of wrapper.matchAll(/@require\s+https:\/\/raw\.githubusercontent\.com\/mumei-s\/note-insight\/main\/(public\/note-insight-(?:dm-reader-v1|dm-network-v2|notification-filter-v4|notification-controls-v1)\.js)\?v=(\d+)/g)) {
      const version = read(dependency[1]).match(/const VERSION='([^']+)'/)[1];
      assert.equal(dependency[2], version.replaceAll('.', ''), dependency[1] + 'の古いrequireキャッシュを更新');
    }
  });
}
test('ダッシュボードの配布版と互換coreの版・requireを検証する',()=>{
 const wrapper=read('public/note-insight-dashboard-sync.user.js'),core=read('public/note-insight-dashboard-sync-core-v1.1.0.js');
 const version=core.match(/const VERSION='([^']+)'/)[1];assert.equal(version,wrapper.match(/CORE_VERSION='([^']+)'/)[1]);
 assert.equal(core.match(/@version\s+(\S+)/)[1],version);
 assert.ok(wrapper.includes("setAttribute('data-mumei-dashboard-wrapper',CORE_VERSION)"),'実行時のcore互換guardも同じ版を使う');
 assert.ok(wrapper.includes('panel()?.dataset.coreVersion!==CORE_VERSION'),'wrapperの読込guardは配布版とcore版を混同しない');
 assert.ok(wrapper.includes('sync-core-v1.1.0.js?v='+version.replaceAll('.','')));
 const featureVersion=read('public/note-insight-dashboard-feature-bridge-v1.js').match(/version:'([^']+)'/)[1];
 assert.ok(wrapper.includes('dashboard-feature-bridge-v1.js?v='+featureVersion.replaceAll('.','')));
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
