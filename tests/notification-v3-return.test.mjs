import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const read=p=>readFile(new URL(`../${p}`,import.meta.url),"utf8");

test("setup center keeps the INSIGHT tab and installs Bridge through Tampermonkey official intermediary",async()=>{
  const page=await read("public/tool-setup.html");
  assert.match(page,/script_installation\.php#url=/);
  assert.match(page,/target="_blank"/);
  assert.match(page,/mumei-insight-bridge-install-pending/);
  assert.match(page,/mumei-insight-bridge-version/);
  assert.match(page,/function returnIfInstalled\(\)/);
  assert.match(page,/location\.replace\(back\)/);
  assert.match(page,/ユーザースクリプトを許可/);
  assert.doesNotMatch(page,/location\.assign\(scriptUrl|dash-install|notice-install/);
});

test("all former notification pages only redirect to setup center",async()=>{
  for(const path of ["public/notification-setup.html","public/notification-update.html","public/notification-update-v29665.html","public/notification-update-v2966.html","public/notification-setup-v2966.html"]){const page=await read(path);assert.match(page,/tool-setup\.html/)}
});

test("Bridge loads notification and Dashboard runtimes from one installed userscript",async()=>{
  const b=await read("public/note-insight-bridge.user.js");
  assert.match(b,/@version\s+1\.0\.0/);
  assert.match(b,/note-insight-notification-v3\.user\.js/);
  assert.match(b,/note-insight-dashboard-sync-core-v1\.1\.0\.js/);
  assert.match(b,/note-insight-dashboard-sync\.user\.js/);
  assert.match(b,/mumei-insight-bridge-version/);
  assert.match(b,/mumei-insight-bridge-ready/);
});

test("V3.1.3 owns the visible four-button dock before remote cores finish",async()=>{
  const v3=await read("public/note-insight-notification-v3.user.js");
  assert.match(v3,/@version\s+3\.1\.3/);assert.match(v3,/const DOCK_HTML=/);assert.match(v3,/function ensureDirectDock\(\)/);assert.match(v3,/function showDirectDock\(/);assert.match(v3,/function likelyBell\(el\)/);assert.match(v3,/下から読込/);assert.match(v3,/フィルターOFF/);assert.match(v3,/フィルター設定/);assert.match(v3,/INSIGHT【通知】/);
});

test("bell open auto-starts bottom-up scan once per open surface",async()=>{
  const watch=await read("public/note-insight-notification-dock-watch-v312.js"),reader=await read("public/note-insight-notification-autoscan-v2970.js");
  assert.match(watch,/function forceDock\(/);assert.match(watch,/function tryAutoStart\(\)/);assert.match(watch,/autoStarted=true/);assert.match(watch,/read\.click\(\)/);assert.match(reader,/verified-shell-bottom-to-top/);assert.match(reader,/slice\(\)\.reverse\(\)/);
});
