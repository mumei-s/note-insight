import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
function helpers(p,names){
  let source=read(p).replace(/^import .*;\n/gm,'');
  const ctx={createClient:()=>({}),Deno:{env:{get:()=>''},serve:()=>{}},console,URL,Date,Intl,Map,Set,Number,JSON};
  vm.createContext(ctx);
  source+='\nglobalThis.result={'+names.join(',')+'};';
  vm.runInContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,ctx);
  return ctx.result;
}

test('important actions beat words in the article title',()=>{
  const {classify,allowedExplicitSource}=helpers('supabase/functions/insight-notification-ingest-v2/index.ts',['classify','allowedExplicitSource']);
  assert.equal(classify('あなたの記事がメンバーシップ応援に追加されました スキしましたという題名3分前','https://note.com/a/m/m1'),'my_article_magazine_added');
  assert.equal(classify('Aさんがあなたのコメントに返信しました メンバーシップのスキ3分前','https://note.com/a/n/n1?c=c1'),'reply');
  assert.equal(classify('Aさんがあなたのメンバーシップに参加しました スキした人','https://note.com/ss_yr/membership'),'membership_join');
  assert.equal(classify('新形式の通知','https://note.com/a/membership?kind=circle_plan_join'),'membership_join');
  assert.equal(classify('新形式の通知',null),'other');
  assert.equal(allowedExplicitSource('note-notification-manual-sync-v2968'),true);
  assert.equal(allowedExplicitSource('note-notification-passive-sync'),false);
});

test('different article additions survive dedupe and unknown ownership is not invented',()=>{
  const {dedupe,decorate}=helpers('supabase/functions/insight-notification-feed-final/index.ts',['dedupe','decorate']);
  const base={notification_type:'my_article_magazine_added',actor_url:'https://note.com/a',target_url:'https://note.com/a/m/m1',occurred_at:'2026-09-13T00:00:00Z',meta:{source:'note-notification-manual-sync-v2968'}};
  assert.equal(dedupe([{...base,raw_text:'あなたの記事がMに追加されました 記事A'},{...base,raw_text:'あなたの記事がMに追加されました 記事B'}]).length,2);
  assert.equal(decorate({notification_type:'membership_reaction',target_url:'https://note.com/membership'},'ss_yr').display_category,'membership_reaction_unknown');
  assert.equal(decorate({notification_type:'reply',target_url:null},'ss_yr').display_category,'reply_unknown');
  assert.equal(dedupe([{notification_type:'other',raw_text:'未知通知',meta:{source:'note-notification-manual-sync-v2968'}}]).length,1);
});

test('private analysis keeps replies and unclassified notifications and excludes public rows',()=>{
  const {useful,summarize}=helpers('supabase/functions/insight-notification-analysis-summary/index.ts',['useful','summarize']);
  for(const notification_type of ['reply','membership_join','my_article_magazine_added','other'])assert.equal(useful({notification_type,raw_text:'通知です',meta:{source:'note-notification-manual-sync-v2968'}}),true);
  for(const notification_type of ['like','follow','comment','creator_article_posted'])assert.equal(useful({notification_type,raw_text:'通知です',meta:{source:'note-notification-manual-sync-v2968'}}),false);
  assert.equal(summarize([],'ss_yr',false,0).sample,0);
  assert.equal(summarize([],'ss_yr',false,0).classifiedRate,0);
});

test('active package keeps the V3.2.13 parent dock and persistent INSIGHT launch sync',()=>{
  const manifest=JSON.parse(read('public/insight-release.json'));
  const v3=read('public/note-insight-notification-v3.user.js');
  const setup=read('public/tool-setup.html');
  const dock=read('public/note-insight-notification-dock-watch-v312.js');
  const reader=read('public/note-insight-notification-reader-v323.js');
  const loader=read('public/note-insight-notification-loader-v318.js');
  const entry=read('public/notification-entry.html');
  const index=read('index.html');
  const picker=read('src/insight-notification-ui-v18.ts');
  const feed=read('supabase/functions/insight-notification-feed-final/index.ts');
  assert.equal(manifest.appVersion,'2026.09.16.10');
  assert.equal(manifest.notificationVersion,'3.2.13');
  assert.equal(manifest.dashboardVersion,'1.4.4');
  assert.match(v3,/@version\s+3\.2\.13/);
  assert.match(v3,/runtime-checked-v329/);
  assert.match(v3,/mumei-v3-rescue-dock-v329/);
  assert.match(v3,/window\.addEventListener\('click',handleRescueClick,true\)/);
  assert.match(v3,/window\.__mumeiV3ParentDock=true/);
  for(const part of ['note-insight-notification-dock-watch-v312.js','note-insight-notification-reader-v323.js','note-insight-notification-loader-v318.js'])assert.match(v3,new RegExp(part.replaceAll('.','\\.')));
  assert.doesNotMatch(v3.split('// ==/UserScript==')[0],/@require/);
  assert.match(setup,/INSIGHTをインストール \/ 更新/);
  assert.match(setup,/ユーザースクリプトの更新を確認/);
  assert.match(setup,/URLを貼り付ける操作はありません/);
  assert.match(setup,/この画面で更新結果を確認/);
  assert.match(setup,/mumei-notification-v3-loader/);
  assert.doesNotMatch(setup,/https:\/\/note\.com\/notifications/);
  assert.match(dock,/function parentDock\(\)/);
  assert.match(dock,/document\.documentElement\.contains\(p\)/);
  assert.match(dock,/display',on\?'grid':'none'/);
  assert.match(reader,/mumei-v3-reader-status/);
  assert.match(reader,/confirmedClientSignatures/);
  assert.match(reader,/rediscoverPanel/);
  assert.match(loader,/mumei-dashboard-flow-v143/);
  assert.match(loader,/notificationSyncBridge/);
  assert.match(loader,/openNotificationSurface/);
  assert.match(loader,/findNotificationTrigger/);
  assert.match(loader,/markNotificationSheet/);
  assert.match(loader,/mumei_insight_pending_sync_v1/);
  assert.match(loader,/seedNotificationSync/);
  assert.match(loader,/mumei-insight-auto-sync-v1/);
  assert.match(loader,/NOTE_ACCOUNT_MISMATCH/);
  assert.match(entry,/dashboard-setup\.html/);
  assert.match(entry,/mumei_insight_sync_seed/);
  assert.doesNotMatch(entry,/new URL\('https:\/\/note\.com\/'\)/);
  assert.match(entry,/notificationSync/);
  assert.match(index,/mumei-insight-start-notification-sync-v1/);
  assert.match(index,/notification-entry\.html/);
  assert.match(index,/mumei-insight-access-token/);
  assert.match(index,/mumei-notification-v3-loader/);
  assert.match(index,/mumei-notification-tool-version/);
  assert.match(picker,/通知項目：/);
  assert.match(picker,/PUBLIC_DUPLICATE_LABELS/);
  assert.match(feed,/\["like","follow","comment","creator_article_posted"\]/);
});

test('seven-day selection still compares against the preceding seven days',()=>{
  const {summarize}=helpers('supabase/functions/insight-notification-analysis-summary/index.ts',['summarize']);
  const row=days=>({notification_type:'my_article_magazine_added',occurred_at:new Date(Date.now()-days*86400000).toISOString(),actor_name:'A'});
  const recent=row(1),previous=row(9);
  const r=summarize([recent],'ss_yr',false,1,7,[recent,previous]);
  assert.equal(r.recent7,1);
  assert.equal(r.prev7,1);
  assert.equal(r.ownArticleAdds,1);
});