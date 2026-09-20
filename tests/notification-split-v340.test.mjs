import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('V3.4.2 package is only a module loader and version reporter',()=>{
  const v3=read('public/note-insight-notification-v3.user.js');
  const meta=v3.split('// ==/UserScript==')[0];
  assert.match(v3,/@version\s+3\.4\.2/);
  for(const p of [
    'note-insight-notification-network-v3300.js?v=3420',\n    'note-insight-notification-reader-v4.js?v=3420',
    'note-insight-notification-controls-v1.js?v=110',
    'note-insight-notification-filter-v4.js?v=400',
    'note-insight-notification-return-v1.js?v=110',
    'note-insight-notification-status-bridge-v1.js?v=100',
    'note-insight-notification-feature-bridge-v1.js?v=100',
    'note-insight-notification-settings-bridge-v1.js?v=100',
    'note-insight-notification-account-pair-v1.js?v=100'
  ])assert.ok(meta.includes(p),p);
  assert.doesNotMatch(meta,/notification-autoscan-v2970\.js\?v=|notification-bootstrap-v2966\.js\?v=|runtime-v2939-filter\.js\?v=|note-insight-dm-reader-v1\.js\?v=/);
  assert.match(v3,/architecture:'split-v1'/);
  assert.doesNotMatch(v3,/function directPanel|function sendBatch|function mount|function refresh|data-mumei-bell-return-cloak|mumei-filter-page-v1|pair-exchange/);
});

test('Reader owns only detection, reading, persistence and checkpoints',()=>{
  const r=read('public/note-insight-notification-reader-v4.js');
  assert.match(r,/insight-notification-ingest-v2/);
  assert.match(r,/function directPanel/);assert.match(r,/async function sendBatch/);assert.match(r,/async function scan/);assert.match(r,/function scheduleAuto/);
  assert.match(r,/mumei_insight_notification_checkpoint_v2922:/);assert.match(r,/mumei_insight_notification_saved_v2919:/);
  assert.match(r,/mumei-notification-reader-status/);
  assert.doesNotMatch(r,/INSIGHT【通知】|フィルター ON|フィルター OFF|notification-filter-settings\.html|mumei_insight_magazine_filter_enabled_v3:|TOOLBAR_ID|mountToolbar|toolbarAction/);
});

test('Controls own navigation and filter toggle but never reading or saving',()=>{
  const c=read('public/note-insight-notification-controls-v1.js');
  assert.match(c,/フィルター ON|フィルター OFF/);assert.match(c,/INSIGHT【通知】/);assert.match(c,/notification-filter-settings\.html/);
  assert.match(c,/mumei_insight_magazine_filter_enabled_v3:/);assert.match(c,/mumei-insight-filter-refresh-v2939/);
  assert.doesNotMatch(c,/insight-notification-ingest-v2|sendBatch|historyComplete|mumei_insight_notification_checkpoint_v2922:|mumei_insight_notification_saved_v2919:/);
});

test('Filter owns visibility only and never saving, return or INSIGHT navigation',()=>{
  const f=read('public/note-insight-notification-filter-v4.js');
  assert.match(f,/mumei_insight_magazine_filter_enabled_v3:/);assert.match(f,/function refresh/);assert.match(f,/mumei-insight-filter-refresh-v2939/);
  assert.match(f,/isDmRoute/);
  assert.doesNotMatch(f,/insight-notification-ingest-v2|sendBatch|INSIGHT【通知】|notification-entry\.html|mumei_filter_return/);
});

test('Return owns only note bell return navigation',()=>{
  const r=read('public/note-insight-notification-return-v1.js');
  assert.match(r,/mumei_filter_return/);assert.match(r,/data-mumei-bell-return-cloak/);assert.match(r,/function clickBell/);
  assert.match(r,/location\.pathname==='\/notifications'/);
  assert.doesNotMatch(r,/insight-notification-ingest-v2|sendBatch|フィルター ON|notification-filter-settings\.html|mumei_insight_notification_checkpoint_v2922:/);
});

test('Status, settings and pairing bridges have distinct responsibilities',()=>{
  const status=read('public/note-insight-notification-status-bridge-v1.js');
  const settings=read('public/note-insight-notification-settings-bridge-v1.js');
  const pair=read('public/note-insight-notification-account-pair-v1.js');
  const feature=read('public/note-insight-notification-feature-bridge-v1.js');
  assert.match(status,/mumei-notification-status-ui-v1/);assert.match(status,/mumei_insight_notification_checkpoint_v2922:/);
  assert.doesNotMatch(status,/pair-exchange|mumei-filter-page-v1/);
  assert.match(settings,/mumei-filter-page-v1/);assert.match(settings,/notification-filter-settings\.html/);assert.match(settings,/profiles/);
  assert.doesNotMatch(settings,/insight-notification-ingest-v2|pair-exchange/);
  assert.match(pair,/pair-exchange/);assert.match(pair,/mumei_insight_notification_sync_token_v2:/);
  assert.doesNotMatch(pair,/mumei-filter-page-v1|mumei-notification-status-ui-v1/);
  assert.match(feature,/mumei-notification-feature-ui-v1/);assert.doesNotMatch(feature,/pair-exchange|mumei-filter-page-v1|insight-notification-ingest-v2/);
});

test('DM remains isolated from every notification runtime',()=>{
  const dm=read('public/note-insight-dm-reader-v1.js');
  const reader=read('public/note-insight-notification-reader-v4.js');
  const controls=read('public/note-insight-notification-controls-v1.js');
  const filter=read('public/note-insight-notification-filter-v4.js');
  assert.match(dm,/const dmRoute=\(\)=>\/\^\\\/messages\\\/rooms/);assert.match(dm,/insight-dm-ingest/);
  assert.doesNotMatch(dm,/insight-notification-ingest-v2/);
  for(const src of [reader,controls,filter])assert.match(src,/messages\\\/rooms|isDmRoute/);
  assert.match(reader,/if\(isDmRoute\(\)\)return/);
  assert.match(controls,/if\(isDmRoute\(\)\)return/);
  assert.match(filter,/if\(isDmRoute\(\)\)return/);
});
