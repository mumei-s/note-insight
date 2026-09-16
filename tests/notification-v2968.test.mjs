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

test('active package uses V3.2.23 with incremental checkpoint reader',()=>{
  const manifest=JSON.parse(read('public/insight-release.json'));
  const v3=read('public/note-insight-notification-v3.user.js');
  const setup=read('public/tool-setup.html');
  const dashboardSetup=read('public/dashboard-setup.html');
  const dock=read('public/note-insight-notification-dock-watch-v312.js');
  const bridge=read('public/notification-token-bridge.html');
  const reader=read('public/note-insight-notification-reader-v323.js');
  const loader=read('public/note-insight-notification-loader-v318.js');
  const entry=read('public/notification-entry.html');
  const index=read('index.html');
  const picker=read('src/insight-notification-ui-v18.ts');
  const feed=read('supabase/functions/insight-notification-feed-final/index.ts');
  assert.equal(manifest.appVersion,'2026.09.17.2');
  assert.equal(manifest.notificationVersion,'3.2.23');
  assert.equal(manifest.dashboardVersion,'1.4.4');
  assert.match(v3,/@version\s+3\.2\.23/);
  assert.match(v3,/runtime-checked-v3223/);
  assert.match(v3,/mumei-v3-rescue-dock-v329/);
  assert.match(v3,/window\.addEventListener\('click',handleRescueClick,true\)/);
  assert.match(v3,/window\.__mumeiV3ParentDock=true/);
  for(const part of ['note-insight-notification-dock-watch-v312.js','note-insight-notification-reader-v323.js','note-insight-notification-loader-v318.js'])assert.match(v3,new RegExp(part.replaceAll('.','\\.')));
  const meta=v3.split('// ==/UserScript==')[0];
  assert.match(meta,/@require\s+https:\/\/raw\.githubusercontent\.com\/mumei-s\/note-insight\/main\/public\/note-insight-notification-reader-v323\.js\?v=3223/);
  assert.match(meta,/@require\s+https:\/\/raw\.githubusercontent\.com\/mumei-s\/note-insight\/main\/public\/note-insight-notification-dock-watch-v312\.js\?v=3223/);
  assert.match(v3,/function pinNoteReturn\(\)/);
  assert.match(v3,/history\.replaceState\(history\.state,'','\/notifications'\)/);
  assert.match(v3,/new URL\('https:\/\/mumei-s\.github\.io\/note-insight\/\?insightMode=notifications#dashboard'\)/);
  assert.doesNotMatch(v3,/notification-entry\.html\?from=note/);
  assert.match(setup,/INSIGHTをインストール \/ 更新/);
  assert.match(setup,/ユーザースクリプトの更新を確認/);
  assert.match(setup,/URLを貼り付ける操作はありません/);
  assert.match(setup,/この画面で更新結果を確認/);
  assert.match(setup,/mumei-notification-v3-loader/);
  assert.doesNotMatch(setup,/https:\/\/note\.com\/notifications/);
  assert.match(dashboardSetup,/mumei_insight_sync_seed/);
  assert.match(dashboardSetup,/if\(seed\)/);
  assert.match(dashboardSetup,/INSIGHT 自動同期を準備中/);
  assert.match(dashboardSetup,/RUNTIME_TIMEOUT/);
  assert.match(dashboardSetup,/returnToInsight/);
  assert.match(dashboardSetup,/location\.replace\(dest\.href\)/);
  assert.match(dashboardSetup,/location\.replace\(u\.href\)/);

  assert.match(dock,/function neutralizeParentDock\(\)/);
  assert.match(dock,/mumei-v3-parent-dock-sentinel-v320/);
  assert.match(dock,/p\.replaceWith\(s\)/);
  assert.match(dock,/allowed=Boolean\(on\)&&\(notificationRoute\(\)\|\|Boolean\(shell&&visible\(shell\)\)\|\|bellGrace\(\)\)/);
  assert.match(dock,/bellGraceUntil=Date\.now\(\)\+7000/);
  assert.match(dock,/startBellReader/);
  assert.match(dock,/async function ensureReader\(force=false\)/);
  assert.match(dock,/const existing=readerApi\(\),api=existing\|\|await ensureReader\(forceReader&&!existing\)/);
  assert.match(dock,/function pinBackToNotifications\(\)/);
  assert.match(dock,/history\.replaceState\(history\.state,'','\/notifications'\)/);
  assert.match(dock,/INSIGHT='https:\/\/mumei-s\.github\.io\/note-insight\/\?insightMode=notifications#dashboard'/);
  assert.match(dock,/notificationAccount/);
  assert.doesNotMatch(dock,/const INSIGHT=.*notification-entry\.html/);
  assert.match(dock,/notification-token-bridge\.html/);
  assert.match(dock,/repairAfterTokenError/);
  assert.match(dock,/repairAfterReaderError/);

  assert.match(bridge,/TARGET='https:\/\/note\.com'/);
  assert.match(bridge,/ref\.origin!==TARGET/);
  assert.match(bridge,/action:'issue'/);
  assert.match(bridge,/noteId!==expected/);
  assert.doesNotMatch(bridge,/postMessage\([^\n]+,\s*['"]\*['"]\)/);

  assert.match(reader,/mumei-v3-reader-status/);
  assert.match(reader,/confirmedClientSignatures/);
  assert.match(reader,/rediscoverPanel/);
  assert.match(reader,/scan_mode:'incremental-top-to-checkpoint'/);
  assert.match(reader,/ここまで保存済み/);
  assert.doesNotMatch(reader,/loadAbsoluteBottom|fullFallback/);
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

  assert.match(index,/mumei-insight-notification-sync-result-v1/);
  assert.match(index,/notificationSync/);
  assert.match(index,/url\.searchParams\.get\("insightMode"\)/);
  assert.match(index,/mode === "notifications"/);
  assert.match(index,/mumei-insight-entry-mode/);
  assert.match(index,/mumei-insight-notification-account/);
  assert.match(index,/url\.hash = "dashboard"/);
  assert.doesNotMatch(index,/mumei-insight-start-notification-sync-v1/);
  assert.doesNotMatch(index,/notification-entry\.html/);
  assert.doesNotMatch(index,/window\.location\.replace\(entry\.href\)/);
  assert.doesNotMatch(index,/note\.com\/notifications/);

  assert.match(picker,/通知項目：/);
  assert.match(picker,/PUBLIC_DUPLICATE_LABELS/);
  assert.match(feed,/\["like","follow","comment","creator_article_posted"\]/);
});

test('saved participants auto-recover accidental local logout but explicit logout stays logged out',()=>{
  const store=read('src/insight-account-store.ts'),main=read('src/main.tsx'),home=read('src/hub-home-v2.tsx');
  assert.match(store,/EXPLICIT_LOGOUT_KEY_PREFIX = "mumei-insight-explicit-logout:"/);
  assert.match(store,/localStorage\.removeItem\(EXPLICIT_LOGOUT_KEY_PREFIX \+ noteId\)/);
  assert.match(home,/localStorage\.setItem\(EXPLICIT_LOGOUT_KEY_PREFIX \+ activeAccount\.noteId, "1"\)/);
  assert.match(main,/function resumeCandidate\(\)/);
  assert.match(main,/requestedNotificationAccount/);
  assert.match(main,/currentStoredInsightAccount\(\)/);
  assert.match(main,/localStorage\.getItem\(EXPLICIT_LOGOUT_KEY_PREFIX \+ account\.noteId\) === "1"/);
  assert.match(main,/body: JSON\.stringify\(\{ action: "resume" \}\)/);
  assert.match(main,/window\.setInterval\(\(\) => \{ void tryReturningMemberResume\(\); \}, 5000\)/);
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