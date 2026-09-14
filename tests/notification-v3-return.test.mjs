import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const read=p=>readFile(new URL(`../${p}`,import.meta.url),"utf8");

test("setup center bypasses Tampermonkey intermediary on Edge and keeps the INSIGHT tab",async()=>{
  const page=await read("public/tool-setup.html");
  assert.match(page,/Dashboard同期を直接インストール／更新/);
  assert.match(page,/本人通知を直接インストール／更新/);
  assert.match(page,/target="_blank"/);
  assert.match(page,/note-insight-dashboard-sync\.user\.js/);
  assert.match(page,/note-insight-notification-v3\.user\.js/);
  assert.match(page,/mumei-direct-install-pending/);
  assert.match(page,/location\.replace\(back\)/);
  assert.match(page,/Import from URL/);
  assert.doesNotMatch(page,/script_installation\.php#url=/);
  assert.doesNotMatch(page,/window\.open\(/);
});

test("notification update is a dedicated recoverable page while older routes still redirect",async()=>{
  for(const path of ["public/notification-setup.html","public/notification-update-v29665.html","public/notification-update-v2966.html","public/notification-setup-v2966.html"]){const page=await read(path);assert.match(page,/tool-setup\.html/)}
  const update=await read("public/notification-update.html");assert.match(update,/本人通知 V3\.1\.5/);assert.match(update,/Raw文字列/);assert.match(update,/更新確認してINSIGHTへ戻る/);assert.match(update,/raw\.githubusercontent\.com/);
});

test("retired Bridge is a no-op compatibility stub",async()=>{
  const b=await read("public/note-insight-bridge.user.js");
  assert.match(b,/@version\s+1\.0\.1/);
  assert.match(b,/互換停止版/);
  assert.match(b,/このBridgeは何も起動しません/);
  assert.doesNotMatch(b,/note-insight-notification-v3\.user\.js|note-insight-dashboard-sync-core-v1\.1\.0\.js|note-insight-dashboard-sync\.user\.js/);
});

test("V3.1.5 adds stable recovery around the proven four-button V3 core",async()=>{
  const v3=await read("public/note-insight-notification-v3.user.js"),fix=await read("public/note-insight-notification-v315-fix.js");
  assert.match(v3,/@version\s+3\.1\.5/);assert.match(v3,/note-insight-notification-v315-fix\.js/);assert.match(v3,/19b1beec55012b53bedcd93751af552f53c0cf8a\/public\/note-insight-notification-v3\.user\.js/);
  assert.match(fix,/const VERSION='3\.1\.5'/);assert.match(fix,/mumei_insight_version_check/);assert.match(fix,/function likelyBell\(el\)/);assert.match(fix,/フィルター設定/);assert.match(fix,/INSIGHT【通知】/);assert.match(fix,/surfaceOpen/);
  assert.doesNotMatch(fix,/directPulseLoop|setTimeout\(directPulseLoop/);
});

test("bell open auto-starts bottom-up scan once without display pulsing",async()=>{
  const watch=await read("public/note-insight-notification-dock-watch-v312.js"),reader=await read("public/note-insight-notification-autoscan-v2970.js");
  assert.match(watch,/function showDock\(/);assert.match(watch,/function tryAutoStart\(\)/);assert.match(watch,/function scheduleAutoStart\(\)/);assert.match(watch,/autoStarted=true/);assert.match(watch,/read\.click\(\)/);assert.match(watch,/mumeiDockVisible/);
  assert.doesNotMatch(watch,/wakeRuntime|setTimeout\(pulse,180\)|function pulse\(/);
  assert.match(reader,/verified-shell-bottom-to-top/);assert.match(reader,/slice\(\)\.reverse\(\)/);
});