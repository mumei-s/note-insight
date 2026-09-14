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

test("notification update persists confirmed version before returning to INSIGHT",async()=>{
  for(const path of ["public/notification-setup.html","public/notification-update-v29665.html","public/notification-update-v2966.html","public/notification-setup-v2966.html"]){const page=await read(path);assert.match(page,/tool-setup\.html/)}
  const update=await read("public/notification-update.html");assert.match(update,/本人通知 V3\.1\.7/);assert.match(update,/Raw文字列/);assert.match(update,/更新確認してINSIGHTへ戻る/);assert.match(update,/raw\.githubusercontent\.com/);assert.match(update,/localStorage\.setItem\('mumei-notification-tool-version',installed\)/);assert.match(update,/dest\.searchParams\.set\('notificationInstalled',installed\)/);
});

test("retired Bridge is a no-op compatibility stub",async()=>{
  const b=await read("public/note-insight-bridge.user.js");
  assert.match(b,/@version\s+1\.0\.1/);
  assert.match(b,/互換停止版/);
  assert.match(b,/このBridgeは何も起動しません/);
});

test("V3.1.7 keeps version return and hands visible dock to dock-watch",async()=>{
  const v3=await read("public/note-insight-notification-v3.user.js"),fix=await read("public/note-insight-notification-v317-fix.js"),watch=await read("public/note-insight-notification-dock-watch-v312.js");
  assert.match(v3,/@version\s+3\.1\.7/);assert.match(v3,/note-insight-notification-v317-fix\.js/);assert.match(v3,/19b1beec55012b53bedcd93751af552f53c0cf8a\/public\/note-insight-notification-v3\.user\.js/);
  assert.match(fix,/const VERSION='3\.1\.7'/);assert.match(fix,/mumei_insight_version_check/);assert.match(fix,/loader-checked-v317/);
  assert.match(watch,/function makeVisible\(/);assert.match(watch,/function forceDock\(/);assert.match(watch,/removeLauncher/);
});

test("four-button dock is always visible and notification surface auto-starts bottom-up scan",async()=>{
  const watch=await read("public/note-insight-notification-dock-watch-v312.js"),reader=await read("public/note-insight-notification-autoscan-v2970.js");
  assert.match(watch,/function makeVisible\(/);assert.match(watch,/function forceDock\(/);assert.match(watch,/function tryAutoStart\(\)/);assert.match(watch,/mumeiAlwaysVisible/);assert.match(watch,/display','block','important/);assert.match(watch,/autoStarted=true/);assert.match(watch,/read\.click\(\)/);
  assert.match(watch,/下から読込/);assert.match(watch,/フィルターOFF/);assert.match(watch,/フィルター設定/);assert.match(watch,/INSIGHT【通知】/);
  assert.match(watch,/LEGACY_LAUNCHER/);assert.match(watch,/removeLauncher/);
  assert.doesNotMatch(watch,/manualVisible|closeIntent|scheduleHide|setTimeout\(pulse,180\)|function pulse\(/);
  assert.match(reader,/verified-shell-bottom-to-top/);assert.match(reader,/slice\(\)\.reverse\(\)/);
});
