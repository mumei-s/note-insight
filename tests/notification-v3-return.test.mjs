import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const read=p=>readFile(new URL(`../${p}`,import.meta.url),"utf8");

test("setup center verifies V3.1.1 on note and resumes the same one-flow page",async()=>{
  const page=await read("public/tool-setup.html");
  assert.match(page,/notificationVersion:'3\.1\.1'/);
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

test("V3.1.1 suppresses old sticky connection-failure docks and keeps retry plus cache",async()=>{
  const v3=await read("public/note-insight-notification-v3.user.js");
  assert.match(v3,/@version\s+3\.1\.1/);
  assert.match(v3,/mumei-v3-core-cache:/);
  assert.match(v3,/function scheduleRetry\(\)/);
  assert.match(v3,/本人通知の接続に失敗/);
  assert.match(v3,/再接続してください/);
  assert.match(v3,/function sweepOld\(\)/);
  assert.match(v3,/componentText/);
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
