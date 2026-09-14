import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const read=p=>readFile(new URL(`../${p}`,import.meta.url),"utf8");

test("V3.1 uses one canonical same-tab installer and auto-verifies on return",async()=>{
  const page=await read("public/notification-setup.html");
  assert.match(page,/const VERSION='3\.1\.0'/);
  assert.match(page,/note-insight-notification-v3\.user\.js/);
  assert.match(page,/mumei-v3-install-pending/);
  assert.match(page,/function maybeVerify\(\)/);
  assert.match(page,/window\.addEventListener\('pageshow'/);
  assert.match(page,/window\.addEventListener\('focus'/);
  assert.match(page,/mumei_insight_version_check/);
  assert.match(page,/notificationInstalled/);
  assert.match(page,/if\(checked===VERSION\)/);
  assert.match(page,/確認完了。INSIGHTへ戻ります/);
  assert.match(page,/location\.replace\(back\)/);
  assert.doesNotMatch(page,/target="_blank"/);
  assert.doesNotMatch(page,/window\.open\(/);
});

test("all former notification install and settings routes collapse into the canonical page",async()=>{
  for(const path of ["public/notification-update.html","public/notification-update-v29665.html","public/notification-update-v2966.html","public/notification-setup-v2966.html"]){
    const page=await read(path);
    assert.match(page,/notification-setup\.html/);
    assert.doesNotMatch(page,/mumeiV3Install|recoverRawInstall|mumeiV3Verify/);
  }
});

test("V3.1 loader removes the sticky failure panel and recovers core with retry plus cache",async()=>{
  const v3=await read("public/note-insight-notification-v3.user.js");
  assert.match(v3,/@version\s+3\.1\.0/);
  assert.match(v3,/const ESSENTIAL=/);
  assert.match(v3,/const OPTIONAL=/);
  assert.match(v3,/mumei-v3-core-cache:/);
  assert.match(v3,/function scheduleRetry\(\)/);
  assert.match(v3,/function clearLegacyStatus\(\)/);
  assert.match(v3,/componentText/);
  assert.match(v3,/GM\.xmlHttpRequest/);
  assert.match(v3,/fetchText/);
  assert.match(v3,/mumei-v3-load-status/);
  assert.doesNotMatch(v3,/function loaderNotice\(/);
  assert.doesNotMatch(v3,/本人通知の接続に失敗しました/);
});

test("V3 wakes the notification dock when the popup was opened before remote core finished loading",async()=>{
  const bootstrap=await read("public/note-insight-notification-bootstrap-v2966.js");
  assert.match(bootstrap,/function strictOpenNoticeShell\(\)/);
  assert.match(bootstrap,/function hasNotificationRows\(root\)/);
  assert.match(bootstrap,/function knownNotificationRowsVisible\(\)/);
  assert.match(bootstrap,/function wakeRuntime\(\)/);
  assert.match(bootstrap,/data-mumei-v3-wakeup/);
  assert.match(bootstrap,/function recoverAlreadyOpenNotice\(tries=0\)/);
  assert.match(bootstrap,/setTimeout\(\(\)=>recoverAlreadyOpenNotice\(\),120\)/);
  assert.match(bootstrap,/new MutationObserver/);
  assert.match(bootstrap,/NOTICE_ITEM/);
  assert.match(bootstrap,/TIME_TEXT/);
  assert.match(bootstrap,/お知らせ/);
  assert.match(bootstrap,/通知/);
});
