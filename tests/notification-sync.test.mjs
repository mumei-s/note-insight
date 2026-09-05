import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read=()=>readFile(new URL("../public/note-insight-notification-sync.user.js",import.meta.url),"utf8");

test("notification sync v2.9.3 is explicit and does not auto ingest", async () => {
  const source = await read();
  assert.match(source, /@version\s+2\.9\.3/);
  assert.match(source, /表示通知を読み込む/);
  assert.match(source, /過去通知を読み込む/);
  assert.match(source, /note-notification-explicit-sync-v292/);
  assert.match(source, /mumei-v293-fallback/);
  assert.match(source, /retryPanel/);
  assert.match(source, /\[role=\"menu\"\]/);
  assert.doesNotMatch(source, /note-notification-auto-sync.*notifications/);
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

test("dashboard is manual and limited to official stats route", async () => {
  const source = await read();
  assert.match(source, /startsWith\('\/sitesettings\/stats'\)/);
  assert.match(source, /Dashboardを読み取る → INSIGHT反映/);
  assert.match(source, /note-dashboard-manual-v292/);
  assert.doesNotMatch(source, /location\.href\s*=\s*['"]https:\/\/note\.com\/sitesettings\/stats/);
  assert.doesNotMatch(source, /documentObserver/);
  assert.doesNotMatch(source, /observe\(document\.documentElement/);
});
