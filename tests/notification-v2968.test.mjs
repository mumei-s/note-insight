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
  assert.equal(classify('Aさんがあなたをフォローしました3分前',null),'follow');
  assert.equal(classify('Aさんが「共同マガジン」をフォローしました3分前','https://note.com/a/m/m1'),'magazine_follow');
  assert.equal(classify('フォロー外したの…だ〜れだ 3分前',null),'other');
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

test('active package uses V3.3.8 panel-free automatic full/delta reader',()=>{
  const manifest=JSON.parse(read('public/insight-release.json'));
  const v3=read('public/note-insight-notification-v3.user.js'),setup=read('public/notification-browser-install.html'),reader=read('public/note-insight-notification-autoscan-v2970.js'),index=read('index.html'),picker=read('src/insight-notification-ui-v18.ts'),feed=read('supabase/functions/insight-notification-feed-final/index.ts');
  assert.equal(manifest.notificationVersion,'3.3.8');assert.equal(manifest.notificationLabel,'本人通知');
  assert.match(v3,/@version\s+3\.3\.8/);
  const meta=v3.split('// ==/UserScript==')[0];
  assert.ok(meta.includes('note-insight-notification-autoscan-v2970.js?v=3380'));
  assert.ok(meta.includes('note-insight-notification-bootstrap-v2966.js?v=3380'));
  assert.doesNotMatch(meta,/note-insight-notification-runtime-v2958\.js\?v=|note-insight-notification-runtime-v327\.js\?v=/);
  assert.match(setup,/mumei-installer-boundary/);assert.match(setup,/本人通知をインストール \/ 更新/);assert.match(setup,/insight-release\.json/);assert.doesNotMatch(setup,/本人通知 V\d/);
  assert.match(reader,/function directPanel/);assert.match(reader,/function findPanel\(\)\{return directPanel\(\)\}/);
  assert.match(reader,/actor_image_url:img/);assert.match(reader,/function scheduleAuto/);assert.match(reader,/historyComplete/);assert.match(reader,/mumei_insight_notification_avatar_repair_v338:/);
  assert.match(reader,/for\(let i=0;i<1200&&!stop;i\+\+\)/);assert.match(reader,/steps\+\+<1200/);
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