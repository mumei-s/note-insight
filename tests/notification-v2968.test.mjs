import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
function helpers(p,names){let source=read(p).replace(/^import .*;\n/gm,'');const ctx={createClient:()=>({}),Deno:{env:{get:()=>''},serve:()=>{}},console,URL,Date,Intl,Map,Set,Number,JSON};vm.createContext(ctx);source+='\nglobalThis.result={'+names.join(',')+'};';vm.runInContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,ctx);return ctx.result}

test('all known notification actions classify into explicit buckets',()=>{
  const {classify}=helpers('supabase/functions/insight-notification-ingest-v2/index.ts',['classify']);
  const cases=[
    ['あなたの記事が共同マガジンに追加されました 3分前','https://note.com/a/m/m1','my_article_magazine_added'],
    ['Aさんがあなたのコメントに返信しました 3分前','https://note.com/a/n/n1?c=c1','reply'],
    ['Aさんがあなたのメンバーシップに参加しました 3分前','https://note.com/ss_yr/membership','membership_join'],
    ['Aさんがあなたのメンバーシップの投稿にスキしました 3分前','https://note.com/ss_yr/membership','membership_reaction'],
    ['Aさんがあなたのコメントにスキしました 3分前','https://note.com/ss_yr/n/n1?c=c1','comment_like'],
    ['Aさんがあなたの記事にスキしました 3分前','https://note.com/ss_yr/n/n1','like'],
    ['Aさんがあなたの記事にコメントしました 3分前','https://note.com/ss_yr/n/n1','comment'],
    ['Aさんがメンバーシップ掲示板に投稿しました 3分前','https://note.com/a/membership/boards/1','membership_board'],
    ['Aさんがメンバーシップを始めました 3分前','https://note.com/a/membership','membership_started'],
    ['Aさんがメンバーシップに新しいプランを追加しました 3分前','https://note.com/a/membership','membership_plan'],
    ['Aさんが共同マガジンの運営メンバーに仲間入りしました 3分前','https://note.com/a/m/m1','magazine_join'],
    ['Aさんが「共同マガジン」をフォローしました 3分前','https://note.com/a/m/m1','magazine_follow'],
    ['Aさんがマガジンに新しい記事を1本追加しました 3分前','https://note.com/a/m/m1','magazine_article_added'],
    ['Aさんが新しい記事を投稿しました 3分前','https://note.com/a/n/n1','creator_article_posted'],
    ['あなたの記事が話題です 3分前','https://note.com/ss_yr/n/n1','buzz'],
    ['Aさんがあなたの有料記事を購入しました！ 3分前','https://note.com/ss_yr/n/n1','purchase'],
    ['Aさんからチップが届きました 3分前','https://note.com/ss_yr/n/n1','tip'],
    ['あなたの記事が引用されました 3分前','https://note.com/ss_yr/n/n1','quote'],
    ['Aさんがあなたの記事を高評価しました 3分前','https://note.com/ss_yr/n/n1','rating'],
    ['あなたにポイントが付与されました 3分前',null,'points'],
    ['Aさんが質問箱を始めました 3分前','https://note.com/a','question_box_started'],
    ['フォロー外したの…だ〜れだ 3分前',null,'other']
  ];
  for(const [text,target,expected] of cases)assert.equal(classify(text,target),expected,text);
});

test('ambiguous ownership stays in confirmation buckets instead of being guessed',()=>{
  const {decorate}=helpers('supabase/functions/insight-notification-feed-final/index.ts',['decorate']);
  assert.equal(decorate({notification_type:'reply',target_url:null},'ss_yr').display_category,'reply_unknown');
  assert.equal(decorate({notification_type:'membership_reaction',target_url:null},'ss_yr').display_category,'membership_reaction_unknown');
  assert.equal(decorate({notification_type:'reply',target_url:'https://note.com/ss_yr/n/n1'},'ss_yr').display_category,'reply_self');
  assert.equal(decorate({notification_type:'reply',target_url:'https://note.com/other/n/n1'},'ss_yr').display_category,'reply_other');
});

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

test('active package uses V3.4.0 split full/delta Reader',()=>{
  const manifest=JSON.parse(read('public/insight-release.json'));
  const v3=read('public/note-insight-notification-v3.user.js'),setup=read('public/notification-browser-install.html'),reader=read('public/note-insight-notification-reader-v4.js'),controls=read('public/note-insight-notification-controls-v1.js'),index=read('index.html'),picker=read('src/insight-notification-ui-v18.ts'),feed=read('supabase/functions/insight-notification-feed-final/index.ts');
  assert.equal(manifest.notificationVersion,'3.4.0');assert.equal(manifest.notificationLabel,'本人通知');
  assert.match(v3,/@version\s+3\.4\.0/);
  const meta=v3.split('// ==/UserScript==')[0];
  for(const p of ['note-insight-notification-reader-v4.js?v=3400','note-insight-notification-controls-v1.js?v=100','note-insight-notification-filter-v4.js?v=400','note-insight-notification-return-v1.js?v=100','note-insight-notification-status-bridge-v1.js?v=100','note-insight-notification-feature-bridge-v1.js?v=100','note-insight-notification-settings-bridge-v1.js?v=100','note-insight-notification-account-pair-v1.js?v=100','note-insight-dm-reader-v1.js?v=101'])assert.ok(meta.includes(p),p);
  assert.doesNotMatch(meta,/notification-autoscan-v2970\.js\?v=|notification-bootstrap-v2966\.js\?v=|runtime-v2939-filter\.js\?v=/);
  assert.match(setup,/mumei-installer-boundary/);assert.match(setup,/本人通知をインストール \/ 更新/);assert.match(setup,/insight-release\.json/);assert.doesNotMatch(setup,/本人通知 V\d/);
  assert.match(reader,/function directPanel/);assert.match(reader,/function findPanel\(\)\{return directPanel\(\)\}/);
  assert.match(reader,/actor_image_url:img/);assert.match(reader,/function scheduleAuto/);assert.match(reader,/historyComplete/);assert.match(reader,/mumei_insight_notification_avatar_repair_v338:/);
  assert.match(reader,/for\(let i=0;i<1200&&!stop;i\+\+\)/);assert.match(reader,/steps\+\+<1200/);
  assert.doesNotMatch(reader,/INSIGHT【通知】|フィルター ON|notification-filter-settings\.html|TOOLBAR_ID/);
  assert.match(controls,/INSIGHT【通知】/);assert.match(controls,/フィルター ON|フィルター OFF/);
  assert.match(index,/mode === "notifications"/);assert.doesNotMatch(index,/insight-tool-row/);assert.match(picker,/PUBLIC_DUPLICATE_LABELS/);assert.match(feed,/\["like","follow","comment","creator_article_posted"\]/);
});

test('notification and DM readers are hard separated with independent storage and APIs',()=>{
  const v3=read('public/note-insight-notification-v3.user.js');
  const notice=read('public/note-insight-notification-reader-v4.js');
  const dm=read('public/note-insight-dm-reader-v1.js');
  const controls=read('public/note-insight-notification-controls-v1.js');
  const filter=read('public/note-insight-notification-filter-v4.js');
  const migration=read('supabase/migrations/20260921035000_insight_dm_history.sql');
  const dmIngest=read('supabase/functions/insight-dm-ingest/index.ts');
  const dmFeed=read('supabase/functions/insight-dm-feed/index.ts');
  const live=read('src/member-insight-live-v2.tsx'),unified=read('src/member-insight-unified-v4.tsx'),dmUi=read('src/member-insight-dm.tsx');
  assert.ok(v3.includes('note-insight-dm-reader-v1.js?v=101'));
  assert.match(notice,/const isDmRoute=\(\)=>\/\^\\\/messages\\\/rooms/);
  assert.match(notice,/function directPanel\(\)\{\s*if\(isDmRoute\(\)\)return null/);
  assert.match(notice,/async function scan\(\)\{\s*if\(isDmRoute\(\)\)return/);
  assert.match(controls,/const isDmRoute=\(\)=>\/\^\\\/messages\\\/rooms/);
  assert.match(filter,/const isDmRoute=\(\)=>\/\^\\\/messages\\\/rooms/);
  assert.match(dm,/const dmRoute=\(\)=>\/\^\\\/messages\\\/rooms/);assert.match(dm,/if\(!dmRoute\(\)\)return/);
  assert.match(dm,/insight-dm-ingest/);assert.doesNotMatch(dm,/insight-notification-ingest-v2/);
  for(const name of ['insight_dm_threads','insight_dm_messages','insight_dm_sync_runs'])assert.match(migration,new RegExp(name));
  assert.match(dmIngest,/from\("insight_dm_messages"\)/);assert.match(dmIngest,/from\("insight_dm_threads"\)/);assert.doesNotMatch(dmIngest,/from\("insight_notifications"\)/);
  assert.match(dmFeed,/from\("insight_dm_messages"\)/);assert.match(dmFeed,/from\("insight_dm_threads"\)/);
  assert.doesNotMatch(live,/miv5-source-card dm|openMode\("dm"\)|💬 DM/);assert.match(unified,/MemberInsightDm/);assert.match(unified,/\["dm","DM"\]/);assert.match(unified,/tab==="dm"\?<MemberInsightDm/);
  assert.match(dmUi,/PRIVATE DIRECT MESSAGES/);assert.match(dmUi,/noteのメッセージ履歴は本人通知とは完全に別保存/);
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