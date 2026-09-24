import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { build } from "../scripts/build-card-userscript.mjs";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("18.9.19 bundle is generated from the current source modules", async () => {
  const bundle = await read("public/note-card-batch-bridge-v610.user.js");
  assert.equal(bundle, build());
  assert.match(bundle, /@version\s+18\.9\.19/);
  assert.match(bundle, /const VERSION='18\.9\.19'/);
});

test("card-only emergency UI exposes only resume-after-Ruru and post-publish delete", async () => {
  const live = await read("public/note-live-rebuild-v1.js");
  assert.match(live, /るるちゃん後カード再開/);
  assert.match(live, /投稿後カード一括削除/);
  assert.doesNotMatch(live, /<button data-a="fresh"/);
  assert.doesNotMatch(live, /<button data-a="overnight"/);
});

test("rows 1 through Ruru 166 are hard-skipped and never regenerated", async () => {
  const live = await read("public/note-live-rebuild-v1.js");
  assert.match(live, /CARD_CHECKPOINT_URL='https:\/\/note\.com\/ruruchan_kawaii\/n\/n5423e36ce1e1'/);
  assert.match(live, /CARD_CHECKPOINT_LABEL='るるちゃん💖🌙'/);
  assert.match(live, /if\(i<adopted\.checkpoint\)continue/);
  assert.match(live, /Missing detection[\s\S]*must never cause us to regenerate any of rows 1\.\.166/);
});

test("a genuine inserted card wins over a late 403 callback", async () => {
  const live = await read("public/note-live-rebuild-v1.js");
  const waitCard = live.match(/async function waitCard[\s\S]*?function statusCode/)?.[0] || "";
  assert.ok(waitCard.indexOf("const hit=") < waitCard.indexOf("if(attempt.error)"));
  assert.match(live, /One last reconciliation/);
  assert.match(live, /表示済みカードを採用して続行/);
});

test("card-only tail runs at 0.9s cadence and saves once at the end", async () => {
  const live = await read("public/note-live-rebuild-v1.js");
  assert.match(live, /await sleep\(900\)/);
  assert.match(live, /残り通知カードを最後に1回だけ保存/);
  assert.doesNotMatch(live, /note自動保存待ち/);
  assert.doesNotMatch(live, /await sleep\(5500\)/);
  assert.doesNotMatch(live, /run\.cardKeys\.length%15===0/);
});

test("card button no longer depends on thin-image progress", async () => {
  const live = await read("public/note-live-rebuild-v1.js");
  assert.match(live, /\[data-a="cards"\][\s\S]*busy\|\|!count/);
  assert.doesNotMatch(live, /\[data-a="cards"\][\s\S]{0,160}images!==count/);
});

test("install page publishes the Ruru checkpoint card-only contract", async () => {
  const install = await read("public/note-card-batch-install.html");
  assert.match(install, /v18\.9\.19/);
  assert.match(install, /極薄サムネイルは完了済みとして一切触りません/);
  assert.match(install, /るるちゃん💖🌙（166番）/);
  assert.match(install, /167番以降だけ続けます/);
  assert.match(install, /投稿後カード一括削除/);
});
