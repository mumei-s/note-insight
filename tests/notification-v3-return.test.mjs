import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const read=p=>readFile(new URL(`../${p}`,import.meta.url),"utf8");

test("setup center verifies the current V3 on note and resumes the same one-flow page",async()=>{
  const page=await read("public/tool-setup.html");
  assert.match(page,/insight-release\.json/);
  assert.match(page,/mumei_insight_version_check/);
  assert.match(page,/mumei_return/);
  assert.match(page,/notificationInstalled/);
  assert.match(page,/function noticeReturn\(\)/);
  assert.match(page,/function verifyNotice\(\)/);
  assert.match(page,/checked===release\.notificationVersion/);
  assert.doesNotMatch(page,/target="_blank"|window\.open\(/);
});

test("all former notification pages only redirect to setup center",async()=>{
  for(const path of ["public/notification-setup.html","public/notification-update.html","public/notification-update-v29665.html","public/notification-update-v2966.html","public/notification-setup-v2966.html"]){const page=await read(path);assert.match(page,/tool-setup\.html/);assert.doesNotMatch(page,/mumeiV3Install|recoverRawInstall|mumeiV3Verify/)}
});

test("V3.1.3 owns the visible four-button dock before remote cores finish",async()=>{
  const v3=await read("public/note-insight-notification-v3.user.js");
  assert.match(v3,/@version\s+3\.1\.3/);
  assert.match(v3,/const DOCK_HTML=/);
  assert.match(v3,/function ensureDirectDock\(\)/);
  assert.match(v3,/function showDirectDock\(/);
  assert.match(v3,/function likelyBell\(el\)/);
  assert.match(v3,/下から読込/);
  assert.match(v3,/フィルターOFF/);
  assert.match(v3,/フィルター設定/);
  assert.match(v3,/INSIGHT【通知】/);
  assert.match(v3,/const existing=document\.getElementById\(FRAME\)/);
  assert.match(v3,/frame=existing;bindFrame\(\);return frame/);
});

test("bell open auto-starts bottom-up scan once per open surface",async()=>{
  const watch=await read("public/note-insight-notification-dock-watch-v312.js"),reader=await read("public/note-insight-notification-autoscan-v2970.js");
  assert.match(watch,/function forceDock\(/);
  assert.match(watch,/function tryAutoStart\(\)/);
  assert.match(watch,/autoStarted=true/);
  assert.match(watch,/read\.click\(\)/);
  assert.match(watch,/自動で下から読込を開始します/);
  assert.match(reader,/verified-shell-bottom-to-top/);
  assert.match(reader,/slice\(\)\.reverse\(\)/);
});

test("V3 wake recovery remains able to reopen the notification dock after late core load",async()=>{
  const bootstrap=await read("public/note-insight-notification-bootstrap-v2966.js");
  assert.match(bootstrap,/function strictOpenNoticeShell\(\)/);
  assert.match(bootstrap,/function knownNotificationRowsVisible\(\)/);
  assert.match(bootstrap,/function wakeRuntime\(\)/);
  assert.match(bootstrap,/data-mumei-v3-wakeup/);
  assert.match(bootstrap,/function recoverAlreadyOpenNotice\(tries=0\)/);
  assert.match(bootstrap,/new MutationObserver/);
});
