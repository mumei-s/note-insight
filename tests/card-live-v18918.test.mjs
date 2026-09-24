import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { build } from "../scripts/build-card-userscript.mjs";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("18.9.18 bundle is generated from the current two source modules", async () => {
  const bundle = await read("public/note-card-batch-bridge-v610.user.js");
  assert.equal(bundle, build());
  assert.match(bundle, /@version\s+18\.9\.18/);
  assert.match(bundle, /const VERSION='18\.9\.18'/);
});

test("18.9.18 does not auto-retry after a card or recovery error", async () => {
  const live = await read("public/note-live-rebuild-v1.js");
  assert.doesNotMatch(live, /if\s*\(attempts\s*<\s*4\)/);
  assert.doesNotMatch(live, /resumeTimer\s*=\s*setTimeout\([^\n]*buildCards/);
  assert.match(live, /automatic recovery retries are intentionally disabled/);
  assert.match(live, /自動再開は停止しました/);
  assert.match(live, /自動再試行はしません/);
});

test("reload never arms or restarts a failed batch", async () => {
  const live = await read("public/note-live-rebuild-v1.js");
  assert.match(live, /function maybeResumeOvernight\(\)[\s\S]*localStorage\.removeItem\(waitResumeKey\(\)\)/);
  assert.match(live, /function maybeResumeOvernight\(\)[\s\S]*localStorage\.removeItem\(overnightKey\(\)\)/);
  assert.doesNotMatch(live, /function maybeResumeOvernight\(\)[\s\S]{0,500}scheduleWaitResume/);
});

test("manual resume discards stale auto flags and resumes only after body reconciliation", async () => {
  const live = await read("public/note-live-rebuild-v1.js");
  assert.match(live, /async function resumeWork\(manual=false\)/);
  assert.match(live, /if\(manual\)[\s\S]{0,500}localStorage\.removeItem\(overnightKey\(\)\)/);
  assert.match(live, /if\(manual\)[\s\S]{0,500}localStorage\.removeItem\(waitResumeKey\(\)\)/);
  assert.match(live, /const adopted=adoptSavedBodyImages\(view,dataset,seed\)/);
  assert.match(live, /if\(index!==resumeFloor\+1\|\|!run\.images\?\.\[row\.url\]\)break/);
  assert.match(live, /return await rebuildImages\(manual\?true:overnight\)/);
});

test("HTTP hold only watches relevant upload writes instead of every note write", async () => {
  const safety = await read("public/note-card-safety-v188.js");
  assert.match(safety, /function monitoredWriteUrl\(rawUrl\)/);
  assert.match(safety, /image\|images\|upload\|uploads\|asset\|assets\|photo\|media\|attach\|attachment\|file\|files/);
  assert.doesNotMatch(safety, /const noteWrite = \/\^\(POST\|PUT\|PATCH\)\$\/i\.test\(method\) && Boolean\(apiUrl\(url\)\)/);
  assert.match(safety, /Boolean\(monitoredWriteUrl\(url\)\)/);
});

test("thin upload uses safer pacing and keeps the post-publish card-only delete action", async () => {
  const live = await read("public/note-live-rebuild-v1.js");
  assert.match(live, /await sleep\(650\)/);
  assert.match(live, /done%20===0/);
  assert.match(live, /await sleep\(15000\)/);
  assert.match(live, /保存位置から再開/);
  assert.match(live, /通信解除＋再開/);
  assert.match(live, /投稿後カード一括削除/);
});

test("install page publishes the same recovery contract", async () => {
  const install = await read("public/note-card-batch-install.html");
  assert.match(install, /v18\.9\.18/);
  assert.match(install, /403の自動再試行ループと勝手な再開を停止/);
  assert.match(install, /保存位置から再開/);
  assert.match(install, /通信解除＋再開/);
  assert.match(install, /投稿後カード一括削除/);
});
