import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('standalone DM userscript has no本人通知 dependency',()=>{
  const dm=read('public/note-insight-dm.user.js');
  const notice=read('public/note-insight-notification-v3.user.js');
  assert.match(dm,/@version\s+1\.3\.4/);
  assert.match(dm,/note-insight-dm-account-pair-v1\.js\?v=100/);
  assert.match(dm,/note-insight-dm-network-v2\.js\?v=121/);
  assert.match(dm,/note-insight-dm-reader-v1\.js\?v=134/);
  assert.doesNotMatch(dm,/note-insight-notification-reader|notification-controls|notification-filter|notification-account-pair/);
  assert.doesNotMatch(notice,/note-insight-dm-reader-v1\.js\?v=/);
});

test('DM uses dedicated pairing and token storage',()=>{
  const pair=read('public/note-insight-dm-account-pair-v1.js');
  const reader=read('public/note-insight-dm-reader-v1.js');
  const ingest=read('supabase/functions/insight-dm-ingest/index.ts');
  const token=read('supabase/functions/insight-dm-import-token/index.ts');
  assert.match(pair,/insight-dm-import-token/);
  assert.match(pair,/mumei_insight_dm_sync_token_v1:/);
  assert.match(reader,/mumei_insight_dm_sync_token_v1:/);
  assert.doesNotMatch(reader,/mumei_insight_notification_sync_token_v2:/);
  assert.match(ingest,/insight_dm_ingest_tokens/);
  assert.doesNotMatch(ingest,/insight_notification_ingest_tokens/);
  assert.match(token,/insight_dm_pair_codes/);assert.match(token,/insight_dm_ingest_tokens/);
});

test('DM installer and release metadata are separate',()=>{
  const install=read('public/dm-browser-install.html');
  const manifest=JSON.parse(read('public/insight-release.json'));
  const release=read('src/insight-release.ts');
  assert.match(install,/note-insight-dm\.user\.js/);
  assert.match(install,/mumei-dm-tool-version/);
  assert.match(install,/dmVersion/);
  assert.equal(manifest.dmVersion,'1.3.4');
  assert.equal(manifest.dmLabel,'DM同期');
  assert.match(release,/CURRENT_DM_VERSION = "1\.3\.4"/);
  assert.match(release,/DM_VERSION_STORAGE_KEY = "mumei-dm-tool-version"/);
});

test('DM background sync never navigates the visible note screen and only accepts real rooms',()=>{
  const reader=read('public/note-insight-dm-reader-v1.js');
  const network=read('public/note-insight-dm-network-v2.js');
  assert.doesNotMatch(reader,/location\.replace|cloak\(true\)/);
  assert.match(reader,/clearLegacyQueue/);
  assert.match(reader,/syncRoomsInBackground/);
  assert.match(reader,/mumei_dm_parent/);
  assert.match(reader,/background-hidden/);assert.match(reader,/frame\.contentDocument/);assert.match(reader,/scanRoom\(a,threadKey,doc,url\)/);
  assert.match(reader,/previewMessage/);
  assert.match(reader,/ROOM_ID_RE/);
  assert.match(network,/ROOM_ID_RE/);
  assert.doesNotMatch(reader,/threadKey===['"](?:new|search)['"]/);
});

test('DM reader loads whole conversations including outbound messages',()=>{
  const reader=read('public/note-insight-dm-reader-v1.js');
  const network=read('public/note-insight-dm-network-v2.js');
  const ui=read('src/member-insight-dm.tsx');
  assert.match(reader,/MAX_MESSAGES=5000/);
  assert.match(reader,/MAX_SCROLL=1200/);
  assert.match(reader,/host\.scrollTop=0/);
  assert.match(reader,/Promise\.all\(batch\.map\(x=>syncFrame\(a,x\.url,x\.key\)\)\)/);
  assert.match(network,/direction=s\.id\?\(\(s\.id\|\|''\)\.toLowerCase\(\)===me\?'outbound':'inbound'\):'unknown'/);
  assert.match(ui,/for\(let page=2;page<=pages;page\+\+\)/);
});

test('DM feed and UI group by person, not room',()=>{
  const feed=read('supabase/functions/insight-dm-feed/index.ts');
  const ui=read('src/member-insight-dm.tsx');
  assert.match(feed,/function personKey/);assert.match(feed,/action==="people"/);assert.match(feed,/action==="person_messages"/);
  assert.match(ui,/feed\("people"\)/);assert.match(ui,/person_messages/);assert.match(ui,/person_key/);
  assert.match(ui,/相手ごとにまとめます/);assert.match(ui,/ルームを1人分として統合/);
  assert.match(ui,/DM履歴/);assert.match(ui,/validPerson/);
});

test('DM tab remains compact and top card stays removed',()=>{
  const live=read('src/member-insight-live-v2.tsx');
  const unified=read('src/member-insight-unified-v4.tsx');
  assert.doesNotMatch(live,/miv5-source-card dm|openMode\("dm"\)|💬 DM/);
  assert.match(unified,/\["dm","DM"\]/);
  assert.match(unified,/tab==="dm"\?<MemberInsightDm/);
});


test('one selected DM person hides the rest',()=>{
  const ui=read('src/member-insight-dm.tsx');
  const css=read('src/member-insight-dm.css');
  assert.match(ui,/!selected\?<aside className="midm-threads"/);
  assert.match(ui,/selected\?<div className="midm-person-view"/);
  assert.match(ui,/← DM履歴一覧/);
  assert.match(ui,/setSelected\(null\);setMessages\(\[\]\)/);
  assert.match(css,/\.midm-layout\{display:block!important\}/);
  assert.match(css,/\.midm-layout\.is-person \.midm-threads\{display:none!important\}/);
});
