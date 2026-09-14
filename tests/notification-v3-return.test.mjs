import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const read=p=>readFile(new URL(`../${p}`,import.meta.url),"utf8");

test("V3 install auto-verifies and returns to the original INSIGHT page",async()=>{
  const page=await read("public/notification-update-v29665.html");
  assert.match(page,/target="_blank"/);
  assert.match(page,/mumei-v3-install-pending/);
  assert.match(page,/mumei-v3-install-away/);
  assert.match(page,/function maybeAutoVerify\(\)/);
  assert.match(page,/window\.addEventListener\('focus'/);
  assert.match(page,/document\.addEventListener\('visibilitychange'/);
  assert.match(page,/localStorage\.setItem\(KEY,checked\)/);
  assert.match(page,/notificationInstalled',VERSION/);
  assert.match(page,/notificationUpdateResult','checked-v3'/);
  assert.match(page,/location\.replace\(dest\.href\)/);
  assert.match(page,/INSIGHTへ戻ります/);
});

test("V3 settings also auto-return after a verified install result",async()=>{
  const page=await read("public/notification-setup-v2966.html");
  assert.match(page,/const checked=String\(q\.get\('notificationInstalled'\)\|\|''\)/);
  assert.match(page,/if\(checked===VERSION\)/);
  assert.match(page,/確認完了。INSIGHTへ戻ります/);
  assert.match(page,/setTimeout\(\(\)=>location\.replace\(back\),900\)/);
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
  assert.match(bootstrap,/n\.matches\?\.\(NOTICE_ITEM\)/);
  assert.match(bootstrap,/NOTICE_ITEM/);
  assert.match(bootstrap,/TIME_TEXT/);
  assert.match(bootstrap,/お知らせ/);
  assert.match(bootstrap,/通知/);
});
