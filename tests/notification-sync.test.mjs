import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read=()=>readFile(new URL("../public/note-insight-notification-sync.user.js",import.meta.url),"utf8");

test("notification sync v2.9.5 auto-sweeps opened notification history", async () => {
  const source = await read();
  assert.match(source, /@version\s+2\.9\.5/);
  assert.match(source, /note-notification-auto-sync-v295/);
  assert.match(source, /notification-panel-auto-sweep/);
  assert.match(source, /autoSweep\(root\)/);
  assert.match(source, /scrollBox\(root\)/);
  assert.match(source, /box\.scrollTop=box\.scrollHeight/);
  assert.match(source, /box\.scrollTop=start/);
  assert.match(source, /scheduleSweep/);
  assert.match(source, /panelObserver\.observe\(root,\{childList:true,subtree:true\}\)/);
  assert.match(source, /\[role=\"menu\"\]/);
  assert.doesNotMatch(source, /one\.textContent='🔔 表示通知を読み込む'/);
  assert.doesNotMatch(source, /past\.textContent='↧ 過去通知を読み込む'/);
  assert.doesNotMatch(source, /\.click\(\)/);
});

test("notification filter stays scoped and old filters can be reset", async () => {
  const source = await read();
  assert.match(source, /mumei_insight_magazine_mute_ids_v5:/);
  assert.match(source, /mumei_insight_magazine_filter_enabled_v3:/);
  assert.match(source, /mumei_insight_notification_groups_v1:/);
  assert.match(source, /isMag\(text\(e\)\)/);
  assert.match(source, /mumei_filter_reset/);
  assert.match(source, /mumei_groups_sync/);
});

test("v2.9.5 supports modern and legacy userscript manager APIs", async () => {
  const source = await read();
  for(const x of ["GM.xmlHttpRequest","GM.getValue","GM.setValue","GM_xmlhttpRequest","GM_getValue","GM_setValue"]) assert.match(source,new RegExp(x.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));
  assert.match(source, /@updateURL\s+https:\/\/mumei-s\.github\.io\/note-insight\/note-insight-notification-sync\.user\.js/);
});

test("dashboard auto-sync is fixed overlay only and limited to official stats route", async () => {
  const source = await read();
  assert.match(source, /startsWith\('\/sitesettings\/stats'\)/);
  assert.match(source, /note-dashboard-auto-v295/);
  assert.match(source, /#mumei-v295-dashboard\{position:fixed!important/);
  assert.match(source, /saveDashboardAuto/);
  assert.doesNotMatch(source, /host\.prepend/);
  assert.doesNotMatch(source, /Dashboardを読み取る → INSIGHT反映/);
  assert.doesNotMatch(source, /location\.href\s*=\s*['"]https:\/\/note\.com\/sitesettings\/stats/);
  assert.doesNotMatch(source, /documentObserver/);
  assert.doesNotMatch(source, /observe\(document\.documentElement/);
});
