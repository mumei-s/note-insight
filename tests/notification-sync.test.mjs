import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read=()=>readFile(new URL("../public/note-insight-notification-sync.user.js",import.meta.url),"utf8");

test("notification sync v2.9.6 only runs when a notification action button is pressed", async () => {
  const source = await read();
  assert.match(source, /@version\s+2\.9\.6/);
  assert.match(source, /note-notification-manual-sync-v296/);
  assert.match(source, /manualCurrent\(root,current\)/);
  assert.match(source, /manualSweep\(root,past\)/);
  assert.match(source, /current\.textContent='🔔 表示分反映'/);
  assert.match(source, /past\.textContent='↧ 過去まで読込'/);
  assert.match(source, /box\.scrollTop=box\.scrollHeight/);
  assert.match(source, /box\.scrollTop=start/);
  assert.match(source, /panelObserver\.observe\(root,\{childList:true,subtree:true\}\)/);
  assert.doesNotMatch(source, /scheduleSweep/);
  assert.doesNotMatch(source, /autoSweep\(root\)/);
  assert.doesNotMatch(source, /schedulePanelSync/);
});

test("notification filter can be toggled in the notification toolbar by group", async () => {
  const source = await read();
  assert.match(source, /mumei_insight_magazine_mute_ids_v5:/);
  assert.match(source, /mumei_insight_magazine_filter_enabled_v3:/);
  assert.match(source, /mumei_insight_notification_groups_v1:/);
  assert.match(source, /m296-filter-switch/);
  assert.match(source, /setMasterFilter/);
  assert.match(source, /setGroupEnabled/);
  assert.match(source, /readGroups/);
  assert.match(source, /isMag\(text\(e\)\)/);
  assert.match(source, /mumei_filter_reset/);
  assert.match(source, /mumei_groups_sync/);
});

test("v2.9.6 supports modern and legacy userscript manager APIs", async () => {
  const source = await read();
  for(const x of ["GM.xmlHttpRequest","GM.getValue","GM.setValue","GM_xmlhttpRequest","GM_getValue","GM_setValue"]) assert.match(source,new RegExp(x.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));
  assert.match(source, /@updateURL\s+https:\/\/mumei-s\.github\.io\/note-insight\/note-insight-notification-sync\.user\.js/);
});

test("dashboard auto-sync remains automatic and isolated from notification controls", async () => {
  const source = await read();
  assert.match(source, /startsWith\('\/sitesettings\/stats'\)/);
  assert.match(source, /note-dashboard-auto-v296/);
  assert.match(source, /#mumei-v296-dashboard\{position:fixed!important/);
  assert.match(source, /saveDashboardAuto/);
  assert.doesNotMatch(source, /host\.prepend/);
  assert.doesNotMatch(source, /Dashboardを読み取る → INSIGHT反映/);
  assert.doesNotMatch(source, /location\.href\s*=\s*['"]https:\/\/note\.com\/sitesettings\/stats/);
  assert.doesNotMatch(source, /documentObserver/);
  assert.doesNotMatch(source, /observe\(document\.documentElement/);
});
