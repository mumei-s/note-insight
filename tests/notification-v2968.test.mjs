import {summaryDb} from "./notification-summary-db.mjs";
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

test('private analysis keeps replies and unclassified notifications and excludes public rows',async t=>{
 const h=await summaryDb(t);assert.equal((await h.summary()).sample,0);
 for(const notification_type of ['reply','membership_join','my_article_magazine_added','other','like','follow','comment','creator_article_posted'])await h.insert({notification_type});
 await h.insert({member_id:'another',notification_type:'purchase'});
 const result=await h.summary();assert.equal(result.sample,4);assert.equal(result.comments,1);assert.equal(result.ownArticleAdds,1);assert.equal(result.membershipJoins,1);assert.equal(result.other,1);
});

test('active package uses V3.6.9 split full/delta Reader',()=>{
  const manifest=JSON.parse(read('public/insight-release.json'));
  const v3=read('public/note-insight-notification-v3.user.js'),setup=read('public/notification-browser-install.html'),network=read('public/note-insight-notification-network-v3300.js'),reader=read('public/note-insight-notification-reader-v4.js'),controls=read('public/note-insight-notification-controls-v1.js'),index=read('index.html'),picker=read('src/insight-notification-ui-v18.ts'),feed=read('supabase/functions/insight-notification-feed-final/index.ts');
  assert.equal(manifest.notificationVersion,'3.6.9');assert.equal(manifest.notificationLabel,'本人通知');
  assert.match(v3,/@version\s+3\.6\.9/);
  const meta=v3.split('// ==/UserScript==')[0];
  for(const p of ['note-insight-notification-network-v3300.js?v=3650','note-insight-notification-reader-v4.js?v=3660','note-insight-notification-controls-v1.js?v=138','note-insight-notification-filter-v4.js?v=411','note-insight-notification-return-v1.js?v=120','note-insight-notification-status-bridge-v1.js?v=110','note-insight-notification-feature-bridge-v1.js?v=110','note-insight-notification-settings-bridge-v1.js?v=110','note-insight-notification-account-pair-v1.js?v=100'])assert.ok(meta.includes(p),p);
  assert.doesNotMatch(meta,/notification-autoscan-v2970\.js\?v=|notification-bootstrap-v2966\.js\?v=|runtime-v2939-filter\.js\?v=/);
  assert.match(setup,/mumei-installer-boundary/);assert.match(setup,/本人通知をインストール \/ 更新/);assert.match(setup,/insight-release\.json/);assert.doesNotMatch(setup,/本人通知 V\d/);
  assert.match(reader,/function directPanel/);assert.match(reader,/function findPanel\(\)\{return directPanel\(\)\}/);
  assert.match(reader,/actor_image_url:img/);assert.match(reader,/function scheduleAuto/);assert.match(reader,/net\.syncCurrent/);assert.match(reader,/mumei_insight_notification_avatar_repair_v338:/);
  assert.match(network,/async function syncHistory/);assert.match(network,/MAX_NOTICES=300,MAX_PAGES=3/);assert.match(network,/writeJournal/);assert.match(reader,/MAX_NOTICES=300/);assert.match(reader,/net\.syncCurrent/);
  assert.doesNotMatch(reader,/INSIGHT【通知】|フィルター ON|notification-filter-settings\.html|TOOLBAR_ID/);
  assert.match(controls,/INSIGHT【通知】/);assert.match(controls,/フィルター ON|フィルター OFF/);
  assert.match(index,/mode === "notifications"/);assert.doesNotMatch(index,/insight-tool-row/);assert.match(picker,/PUBLIC_DUPLICATE_LABELS/);assert.match(feed,/\["like","follow","comment","creator_article_posted"\]/);
});

test('notification and DM readers are hard separated with independent storage and APIs',()=>{
  const v3=read('public/note-insight-notification-v3.user.js');
  const notice=read('public/note-insight-notification-reader-v4.js');
  const dm=read('public/note-insight-dm-reader-v1.js');
  const dmUser=read('public/note-insight-dm.user.js');
  const dmPair=read('public/note-insight-dm-account-pair-v1.js');
  const controls=read('public/note-insight-notification-controls-v1.js');
  const filter=read('public/note-insight-notification-filter-v4.js');
  const migration=read('supabase/migrations/20260921035000_insight_dm_history.sql');
  const dmIngest=read('supabase/functions/insight-dm-ingest/index.ts');
  const dmFeed=read('supabase/functions/insight-dm-feed/index.ts');
  const live=read('src/member-insight-live-v2.tsx'),unified=read('src/member-insight-unified-v4.tsx'),dmUi=read('src/member-insight-dm.tsx');
  assert.doesNotMatch(v3,/note-insight-dm-reader-v1\.js\?v=/);
  assert.match(notice,/const isDmRoute=\(\)=>\/\^\\\/messages\\\/rooms/);
  assert.match(notice,/test\(location.pathname\)&&!directPanel\(\)/);
  assert.match(notice,/async function scan\(opts=\{\}\)\{\s*if\(!featureOn\(\)\|\|isDmRoute\(\)\)return/);
  assert.match(controls,/const isDmRoute=\(\)=>\/\^\\\/messages\\\/rooms/);
  assert.match(filter,/const isDmRoute=\(\)=>\/\^\\\/messages\\\/rooms/);
  assert.match(dm,/const dmRoute=\(\)=>\/\^\\\/messages\\\/rooms/);assert.match(dm,/if\(!dmRoute\(\)\)/);
  assert.match(dm,/insight-dm-ingest/);assert.doesNotMatch(dm,/insight-notification-ingest-v2/);
  assert.match(dm,/mumei_insight_dm_sync_token_v1:/);assert.doesNotMatch(dm,/mumei_insight_notification_sync_token_v2:/);
  assert.match(dmUser,/@version\s+1\.4\.7/);assert.match(dmUser,/note-insight-dm-account-pair-v1\.js\?v=100/);assert.match(dmUser,/note-insight-dm-network-v2\.js\?v=146/);assert.match(dmUser,/note-insight-dm-reader-v1\.js\?v=145/);
  assert.match(dmPair,/insight-dm-import-token/);assert.match(dmPair,/mumei_insight_dm_sync_token_v1:/);
  for(const name of ['insight_dm_threads','insight_dm_messages','insight_dm_sync_runs'])assert.match(migration,new RegExp(name));
  assert.match(dmIngest,/from\("insight_dm_messages"\)/);assert.match(dmIngest,/from\("insight_dm_threads"\)/);assert.doesNotMatch(dmIngest,/from\("insight_notifications"\)/);
  assert.match(dmFeed,/from\("insight_dm_messages"\)/);assert.match(dmFeed,/from\("insight_dm_threads"\)/);
  assert.match(dmFeed,/action==="people"/);assert.match(dmFeed,/action==="person_messages"/);assert.match(dmFeed,/person_key/);
  assert.doesNotMatch(live,/miv5-source-card dm|openMode\("dm"\)|💬 DM/);assert.match(unified,/MemberInsightDm/);assert.match(unified,/\["dm","DM"\]/);assert.match(unified,/tab==="dm"\?\(active\?<MemberInsightDm/);
  assert.match(dmUi,/PRIVATE DIRECT MESSAGES/);assert.match(dmUi,/fetchInsightRelease/);assert.match(dmUi,/dmUpdateAvailable/);assert.match(dmUi,/DM同期 v\{latestDmVersion\}へ更新/);assert.match(dmUi,/通常のnote DM画面はそのまま/);assert.match(dmUi,/midm-history-panel/);assert.match(dmUi,/feed\("people"\)/);assert.match(dmUi,/person_messages/);assert.match(dmUi,/midm-version-state/);assert.match(dmUi,/設定・状態<\/span>/);assert.doesNotMatch(dm,/location\.replace|cloak\(true\)/);assert.match(dm,/syncRoomsInBackground/);assert.match(dm,/mumei_dm_parent/);assert.match(dm,/frame\.contentDocument/);assert.match(dm,/previewMessage/);assert.match(dm,/background-hidden/);assert.match(dm,/clearLegacyQueue/);assert.match(dm,/ROOM_ID_RE/);assert.doesNotMatch(dm,/threadKey===\'new\'/);
});

test('saved participants auto-recover accidental local logout but explicit logout stays logged out',()=>{
  const store=read('src/insight-account-store.ts'),main=read('src/main.tsx'),home=read('src/hub-home-v2.tsx');
  assert.match(store,/EXPLICIT_LOGOUT_KEY_PREFIX = "mumei-insight-explicit-logout:"/);assert.match(home,/localStorage\.setItem\(EXPLICIT_LOGOUT_KEY_PREFIX \+ activeAccount\.noteId, "1"\)/);assert.match(main,/function resumeCandidate\(\)/);
});

test('seven-day selection still compares against the preceding seven days',async t=>{
 const h=await summaryDb(t);
 await h.insert({notification_type:'my_article_magazine_added',occurred_at:'2026-09-21T12:00:00Z'});
 await h.insert({notification_type:'my_article_magazine_added',occurred_at:'2026-09-13T12:00:00Z'});
 const r=await h.summary(7);assert.equal(r.recent7,1);assert.equal(r.prev7,1);assert.equal(r.ownArticleAdds,1);assert.equal(r.sample,1);
});

test('notification-only network capture rejects unrelated note APIs and V24 rechecks pending rows',()=>{
  const network=read('public/note-insight-notification-network-v3300.js');
  const reclass=read('supabase/functions/insight-notification-reclassify/index.ts');
  const ingest=read('supabase/functions/insight-notification-ingest-v2/index.ts');
  const ui=read('src/member-insight-notifications-final.tsx');
  assert.match(network,/function extractDirectNotices/);
  assert.match(network,/direct-api-root-only-v357/);
  assert.match(network,/if\(!directNoticesCap\(cap\)\)throw new Error/);
  assert.match(network,/NO_NOTIFICATION_API_CAPTURE/);
  assert.match(reclass,/action-v26-formats/);
  assert.doesNotMatch(reclass,/meta\?\.classifier==="action-v23-structured"[^\n]*continue/);
  assert.match(ingest,/action-v26-formats/);
  assert.match(ui,/action-v26-formats/);
  assert.match(ui,/retainBoard/);
  assert.match(ui,/question_answer/);
});


test('quarantined network noise stays out of feed and analysis while structured answers leave Other',async t=>{
 const feed=read('supabase/functions/insight-notification-feed-final/index.ts'),ui=read('src/member-insight-notifications-final.tsx');
 assert.match(feed,/noise_reason==="non-notification-api-capture"/);assert.match(feed,/qa_answer"\?"question_answer"/);
 const h=await summaryDb(t);await h.insert({meta:{noise_reason:'non-notification-api-capture'}});await h.insert({meta:{source:'unrelated-api'}});await h.insert({meta:{kind:'qa_answer'}});
 const r=await h.summary();assert.equal(r.sample,1);assert.equal(r.other,0);assert.deepEqual(r.topTypes,[['question_answer',1]]);
 assert.match(ui,/retainBoard/);assert.match(ui,/詳細・精度・再分類/);
});

test('summary deduplicates latest signatures, uses JST dates and denies client RPC access',async t=>{
 const h=await summaryDb(t);
 await h.insert({meta:{client_signature:'same'},notification_type:'reply',target_url:'https://note.com/tester/n/n1',occurred_at:'2026-09-21T14:59:00Z',captured_at:'2026-09-21T15:00:00Z'});
 await h.insert({meta:{client_signature:'same'},notification_type:'reply',target_url:'https://note.com/tester/n/n1',occurred_at:'2026-09-21T15:00:00Z'});
 const r=await h.summary();assert.equal(r.sample,1);assert.deepEqual(r.dailyCounts,[{date:'2026-09-22',count:1}]);assert.deepEqual(r.topTypes,[['reply_self',1]]);assert.equal(r.peakHour,0);assert.equal(r.weekName,'火');
 const permission=(await h.db.query("select has_function_privilege('anon','public.insight_notification_analysis_summary(text[],text,integer,timestamptz)','execute') as anon,has_function_privilege('authenticated','public.insight_notification_analysis_summary(text[],text,integer,timestamptz)','execute') as client,has_function_privilege('service_role','public.insight_notification_analysis_summary(text[],text,integer,timestamptz)','execute') as service")).rows[0];assert.deepEqual(permission,{anon:false,client:false,service:true});
});


test('ordinary note pages never start follower scans or inspect auth/editor traffic',()=>{
  const social=read('public/note-insight-social-compare-v1.js');
  const noticeNet=read('public/note-insight-notification-network-v3300.js');
  const dmNet=read('public/note-insight-dm-network-v2.js');
  const noticeUser=read('public/note-insight-notification-v3.user.js');
  const dmUser=read('public/note-insight-dm.user.js');
  assert.match(social,/__mumeiSocialCompareV1Loaded/);
  assert.match(social,/sessionStorage\.getItem\(ACTIVE\)!==location\.pathname/);
  assert.match(social,/mumei_social_scan/);
  assert.match(social,/sessionStorage\.setItem\(ACTIVE,location\.pathname\)/);
  assert.match(noticeNet,/function protectedNoteRoute/);
  assert.match(noticeNet,/protectedNoteRoute\(\)\|\|!noticeApiRequest\(meta\.url\)/);
  assert.match(dmNet,/const dmSurface=/);
  assert.match(dmNet,/!dmSurface\(\)&&!apiEndpoint\(meta\.url\)&&!roomFromUrl\(meta\.url\)/);
  assert.match(noticeUser,/note-insight-social-compare-v1\.js\?v=102/);
  assert.match(dmUser,/note-insight-social-compare-v1\.js\?v=102/);
});
