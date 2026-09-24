import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { build } from "../scripts/build-card-userscript.mjs";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("18.9.20 bundle is generated from the current source modules", async () => {
  const bundle = await read("public/note-card-batch-bridge-v610.user.js");
  assert.equal(bundle, build());
  assert.match(bundle, /@version\s+18\.9\.19/);
  assert.match(bundle, /const VERSION='18\.9\.19'/);
});

test("card-only emergency UI exposes only current-position resume and post-publish delete", async () => {
  const live = await read("public/note-live-rebuild-v1.js");
  assert.match(live, /カード続き（現在位置から）/);
  assert.match(live, /投稿後カード一括削除/);
  assert.doesNotMatch(live, /<button data-a="fresh"/);
  assert.doesNotMatch(live, /<button data-a="overnight"/);
});

test("Ruru prefix stays fixed and visible tail cards are adopted before resuming", async () => {
  const live = await read("public/note-live-rebuild-v1.js");
  assert.match(live, /CARD_CHECKPOINT_URL='https:\/\/note\.com\/ruruchan_kawaii\/n\/n5423e36ce1e1'/);
  assert.match(live, /CARD_CHECKPOINT_LABEL='るるちゃん💖🌙'/);
  assert.match(live, /for\(let i=0;i<dataset\.rows\.length;i\+\+\)/);
  assert.match(live, /current editor/);
  assert.match(live, /resumeIndex=checkpoint\+1/);
});

test("a genuine inserted card wins over a late 403 callback", async () => {
  const live = await read("public/note-live-rebuild-v1.js");
  const waitCard = live.match(/async function waitCard[\s\S]*?function statusCode/)?.[0] || "";
  assert.ok(waitCard.indexOf("const hit=") < waitCard.indexOf("if(attempt.error)"));
  assert.match(live, /One last reconciliation/);
  assert.match(live, /表示済みカードを採用して続行/);
});

test("card-only tail uses safer 3s cadence, 10-card rests and one final save", async () => {
  const live = await read("public/note-live-rebuild-v1.js");
  assert.match(live, /await sleep\(3000\)/);
  assert.match(live, /sessionCreated%10===0/);
  assert.match(live, /await sleep\(30000\)/);
  assert.match(live, /残り通知カードを最後に1回だけ保存/);
  assert.doesNotMatch(live, /await sleep\(5500\)/);
});

test("403 cooldown is respected instead of forcibly clearing the hold", async () => {
  const live = await read("public/note-live-rebuild-v1.js");
  assert.match(live, /const waitMs=Math\.max\(0,Number\(hold\.until\|\|0\)-Date\.now\(\)\)/);
  assert.match(live, /note通信制限中/);
  const buildCards = live.match(/async function buildCards[\s\S]*?const BENNETT_URL/)?.[0] || "";
  assert.doesNotMatch(buildCards, /confirmNetworkRecovered/);
});

test("successful and failed cards both refresh the local body backup", async () => {
  const live = await read("public/note-live-rebuild-v1.js");
  const count = (live.match(/safety\(\)\.capture\?\.\(\)/g) || []).length;
  assert.ok(count >= 3);
});

test("card button no longer depends on thin-image progress", async () => {
  const live = await read("public/note-live-rebuild-v1.js");
  assert.match(live, /\[data-a="cards"\][\s\S]*busy\|\|!count/);
  assert.doesNotMatch(live, /\[data-a="cards"\][\s\S]{0,160}images!==count/);
});

test("install page publishes the visible-tail cooldown contract", async () => {
  const install = await read("public/note-card-batch-install.html");
  assert.match(install, /v18\.9\.20/);
  assert.match(install, /極薄サムネイルは完了済みとして一切触りません/);
  assert.match(install, /現在の本文に見えている167番以降のカードも自動採用/);
  assert.match(install, /3秒間隔/);
  assert.match(install, /10件ごとに30秒休止/);
  assert.match(install, /投稿後カード一括削除/);
});
