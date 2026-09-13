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
