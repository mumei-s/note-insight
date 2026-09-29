import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = (p) => readFile(new URL(p, root), "utf8");

test("isolated retest only matches editor and has no note-wide runtime", async () => {
  const s = await read("public/note-card-isolated-retest-v1.user.js");
  assert.match(s, /@match\s+https:\/\/editor\.note\.com\/\*/);
  assert.doesNotMatch(s, /@match\s+https:\/\/note\.com\/\*/);
  assert.doesNotMatch(s, /\/api\/v2\/current_user/);
  assert.doesNotMatch(s, /setInterval\s*\(/);
  assert.doesNotMatch(s, /XMLHttpRequest\.prototype|page\.fetch\s*=|window\.fetch\s*=/);
});

test("isolated retest starts only from explicit button action", async () => {
  const s = await read("public/note-card-isolated-retest-v1.user.js");
  assert.match(s, /data-a="run"/);
  assert.match(s, /if\(a==='run'\)void run\(\)/);
  const boot = s.match(/let tries=0;function boot[\s\S]*?\}\)\(\);/)?.[0] || "";
  assert.doesNotMatch(boot, /void run\(\)|await run\(\)|run\(\);/);
});

test("isolated retest keeps the previous card cadence and manual stop", async () => {
  const s = await read("public/note-card-isolated-retest-v1.user.js");
  assert.match(s, /await sleep\(3000\)/);
  assert.match(s, /session%10===0/);
  assert.match(s, /await sleep\(30000\)/);
  assert.match(s, /自動再試行なし/);
  assert.match(s, /function stop\(\)/);
});

test("isolated retest adopts existing cards and only fills missing targets", async () => {
  const s = await read("public/note-card-isolated-retest-v1.user.js");
  assert.match(s, /function scanExisting/);
  assert.match(s, /function firstMissing/);
  assert.match(s, /if\(owned\.has\(row\.url\)\)continue/);
  assert.match(s, /投稿後・今回カード一括削除/);
});

test("isolated installer points only to isolated userscript", async () => {
  const h = await read("public/note-card-isolated-retest-install.html");
  assert.match(h, /note-card-isolated-retest-v1\.user\.js/);
  assert.match(h, /INSIGHTから完全分離/);
  assert.match(h, /正本18\.9\.21停止版とINSIGHTは変更しません/);
});