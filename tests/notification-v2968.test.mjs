import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
function helpers(p,names){let source=read(p).replace(/^import .*;\n/gm,'');const ctx={createClient:()=>({}),Deno:{env:{get:()=>''},serve:()=>{}},console,URL,Date,Intl,Map,Set,Number,JSON};vm.createContext(ctx);source+='\nglobalThis.result={'+names.join(',')+'};';vm.runInContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,ctx);return ctx.result}

test('important actions beat words in the article title',()=>{
  const {classify,allowedExplicitSource}=helpers('supabase/functions/insight-notification-ingest-v2/index.ts',['classify','allowedExplicitSource']);
  assert.equal(classify('あなたの記事がメンバーシップ応援に追加されました スキしましたという題名3分前','https://note.com/a/m/m1'),'my_article_magazine_added');
  assert.equal(classify('Aさんがあなたのコメントに返信しました メンバーシップのスキ3分前','https://note.com/a/n/n1?c=c1'),'reply');
  assert.equal(classify('Aさんがあなたのメンバーシップに参加しました スキした人','https://note.com/ss_yr/membership'),'membership_join');
  assert.equal(allowedExplicitSource('note-notification-manual-sync-v2968'),true);
  assert.equal(allowedExplicitSource('note-notification-passive-sync'),false);
});

test('different article additions survive dedupe and unknown ownership is not invented',()=>{
  const {dedupe,decorate}=helpers('supabase/functions/insight-notification-feed-final/index.ts',['dedupe','decorate']);
  const base={notification_type:'my_article_magazine_added',actor_url:'https://note.com/a',target_url:'https://note.com/a/m/m1',occurred_at:'2026-09-13T00:00:00Z',meta:{source:'note-notification-manual-sync-v2968'}};
  assert.equal(dedupe([{...base,raw_text:'あなたの記事がMに追加されました 記事A'},{...base,raw_text:'あなたの記事がMに追加されました 記事B'}]).length,2);
  assert.equal(decorate({notification_type:'membership_reaction',target_url:'https://note.com/membership'},'ss_yr').display_category,'membership_reaction_unknown');
});

test('private analysis keeps replies and unclassified notifications and excludes public rows',()=>{
  const {useful,summarize}=helpers('supabase/functions/insight-notification-analysis-summary/index.ts',['useful','summarize']);
  for(const notification_type of ['reply','membership_join','my_article_magazine_added','other'])assert.equal(useful({notification_type,raw_text:'通知です',meta:{source:'note-notification-manual-sync-v2968'}}),true);
  for(const notification_type of ['like','follow','comment','creator_article_posted'])assert.equal(useful({notification_type,raw_text:'通知です',meta:{source:'note-notification-manual-sync-v2968'}}),false);
  assert.equal(summarize([],'ss_yr',false,0).sample,0);
});

test('active package uses V3.2.60 with bottom-up resume, persistent checkpoint and fixed five-panel auto dock',()=>{
  const manifest=JSON.parse(read('public/insight-release.json'));
  const v3=read('public/note-insight-notification-v3.user.js'),checkpoint=read('public/note-insight-notification-checkpoint-v325.js'),setup=read('public/notification-browser-install.html'),runtime=read('public/note-insight-notification-runtime-v327.js'),reader=read('public/note-insight-notification-reader-v323.js'),index=read('index.html'),picker=read('src/insight-notification-ui-v18.ts'),feed=read('supabase/functions/insight-notification-feed-final/index.ts');
  assert.equal(manifest.notificationVersion,'3.2.60');assert.equal(manifest.notificationLabel,'本人通知');
  assert.match(v3,/@version\s+3\.2\.60/);assert.match(v3,/bottom-up-saved-line-v3245/);
  const meta=v3.split('// ==/UserScript==')[0];
  for(const part of ['note-insight-notification-reader-v323.js?v=3245','note-insight-notification-checkpoint-v325.js?v=3250','note-insight-notification-runtime-v327.js?v=3260'])assert.match(meta,new RegExp(part.replace(/[.?]/g,m=>'\\'+m)));
  assert.doesNotMatch(meta,/note-insight-notification-dock-watch-v312\.js/);
  assert.match(checkpoint,/mumei_insight_notification_checkpoint_local_v325:/);assert.match(checkpoint,/localStorage\.setItem/);assert.doesNotMatch(checkpoint,/new MutationObserver/);assert.match(reader,/checkpointFor/);assert.match(reader,/preserveBoundary/);assert.match(reader,/全件読み直しなし/);
  assert.match(setup,/mumei-installer-boundary/);assert.match(setup,/最新版をインストール \/ 更新/);assert.match(setup,/insight-release\.json/);assert.doesNotMatch(setup,/本人通知 V\d/);assert.match(setup,/ブラウザ別インストール/);assert.match(setup,/data-browser="ios-safari"/);assert.match(setup,/data-browser="android-edge"/);
  assert.match(runtime,/grid-template-columns:minmax\(54px,.72fr\) minmax\(46px,.62fr\) minmax\(70px,1fr\) minmax\(48px,.66fr\) minmax\(68px,.9fr\)/);
  for(const act of ['read','mode','filter','settings','ins'])assert.match(runtime,new RegExp(`data-a=\\"${act}\\"`));
  assert.match(runtime,/mountUiInSurface/);assert.match(runtime,/notificationSessionActive/);assert.match(runtime,/rememberedSurface/);assert.doesNotMatch(runtime,/window\.addEventListener\('pointerdown',onShellPointerDown,true\)/);assert.match(runtime,/function detachedUiHost/);assert.doesNotMatch(runtime,/shell\.appendChild\(r\)/);assert.match(runtime,/leadDisplayName/);assert.match(runtime,/profileCandidates/);assert.match(runtime,/filterRows/);assert.match(runtime,/runPrimaryDockAction/);assert.match(runtime,/pointerdown/);assert.match(runtime,/pointerup/);assert.match(runtime,/leadCreatorId/);assert.match(runtime,/ids\.has\(lead\)/);assert.match(runtime,/mumei_insight_notification_auto_v325:/);assert.match(runtime,/event\?\.composedPath/);assert.doesNotMatch(runtime,/new MutationObserver/);assert.match(runtime,/notification-filter-settings\.html/);assert.match(runtime,/notificationAccount/);assert.match(runtime,/location\.replace\(u\.href\)/);assert.doesNotMatch(runtime,/通知フィルター登録|data-addg/);assert.doesNotMatch(runtime,/new MutationObserver/);assert.match(runtime,/maybeAuto/);assert.match(runtime,/autoDoneForSession/);assert.doesNotMatch(runtime,/lastAutoAt/);assert.match(runtime,/creatorProfile/);assert.match(runtime,/profileImageUrl/);assert.match(runtime,/nickname/);assert.match(runtime,/openNotificationBell/);assert.match(runtime,/isNotificationOpen/);assert.match(runtime,/mumei_insight_notification_feature_enabled_v1/);assert.match(runtime,/setFeatureEnabled/);assert.match(runtime,/hideImmediately/);assert.match(runtime,/suppressUntilBell/);assert.match(runtime,/notificationLeaveAction/);assert.match(runtime,/strongNoticeSurface/);assert.match(runtime,/textEditorElement/);assert.match(runtime,/editingOutsideNotification/);assert.match(runtime,/onEditorFocus/);assert.match(runtime,/noticeRows/);assert.doesNotMatch(runtime,/return shell&&visible\(shell\)\?shell:null/);assert.match(runtime,/settingsButtonFromEvent/);assert.match(runtime,/onSettingsPressStart/);assert.match(runtime,/onSettingsPressEnd/);assert.match(runtime,/touchstart',onSettingsPressStart/);assert.match(runtime,/touchend',onSettingsPressEnd/);assert.match(runtime,/settingsNavStarted/);assert.match(runtime,/function showRoot\(on\).*suppressUntilBell/);assert.match(runtime,/function onStatus\(e\).*suppressUntilBell/);assert.match(runtime,/function confirmHide\(\).*suppressUntilBell/);assert.doesNotMatch(runtime,/if\(on\)\{ensureRoot\(\)/);assert.match(runtime,/safeScan/);
  assert.match(reader,/scan_mode:'bottom-up-from-saved-line'/);assert.match(reader,/saved-line-bottom-up-v324/);assert.match(reader,/ここまで保存済み/);assert.match(reader,/boundarySignature/);assert.match(reader,/完了ラインから上方向へ、追加分だけ読み込みます/);assert.match(reader,/findSavedRecoveryElement/);assert.match(reader,/preserveBoundary/);assert.match(reader,/全件読み直しなし/);assert.doesNotMatch(reader,/完了ラインを再作成しています/);
  assert.match(index,/mode === "notifications"/);assert.doesNotMatch(index,/insight-tool-row/);assert.match(picker,/PUBLIC_DUPLICATE_LABELS/);assert.match(feed,/\["like","follow","comment","creator_article_posted"\]/);
});

test('saved participants auto-recover accidental local logout but explicit logout stays logged out',()=>{
  const store=read('src/insight-account-store.ts'),main=read('src/main.tsx'),home=read('src/hub-home-v2.tsx');
  assert.match(store,/EXPLICIT_LOGOUT_KEY_PREFIX = "mumei-insight-explicit-logout:"/);assert.match(home,/localStorage\.setItem\(EXPLICIT_LOGOUT_KEY_PREFIX \+ activeAccount\.noteId, "1"\)/);assert.match(main,/function resumeCandidate\(\)/);
});

test('seven-day selection still compares against the preceding seven days',()=>{
  const {summarize}=helpers('supabase/functions/insight-notification-analysis-summary/index.ts',['summarize']);
  const row=days=>({notification_type:'my_article_magazine_added',occurred_at:new Date(Date.now()-days*86400000).toISOString(),actor_name:'A'});
  const recent=row(1),previous=row(9);const r=summarize([recent],'ss_yr',false,1,7,[recent,previous]);assert.equal(r.recent7,1);assert.equal(r.prev7,1);assert.equal(r.ownArticleAdds,1);
});