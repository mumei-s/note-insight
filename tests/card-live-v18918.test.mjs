import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { build } from "../scripts/build-card-userscript.mjs";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("18.9.21 emergency-stop bundle is generated from source", async () => {
  const bundle = await read("public/note-card-batch-bridge-v610.user.js");
  assert.equal(bundle, build());
  assert.match(bundle, /@version\s+18\.9\.21/);
  assert.match(bundle, /disabled: true/);
});

test("emergency-stop returns before card modules can execute", async () => {
  const buildSrc = await read("scripts/build-card-userscript.mjs");
  const posReturn = buildSrc.indexOf("  return;\\n\\n");
  const posModules = buildSrc.indexOf("export function wrapModules");
  assert.ok(posReturn > 0);
  assert.ok(posReturn < posModules);
  assert.match(buildSrc, /page\.__MUMEI_CARD_SAFETY__\?\.stop\?\.\(\)/);
});

test("stop bundle removes card panel ids but does not delete body content", async () => {
  const bundle = await read("public/note-card-batch-bridge-v610.user.js");
  assert.match(bundle, /mumei-note-source-picker-v163/);
  assert.match(bundle, /mumei-likers-thin-panel-v160/);
  assert.doesNotMatch(bundle.slice(0, bundle.indexOf("// MODULE: note-card-safety-v188.js")), /localStorage\.clear|innerHTML\s*=\s*['"]{2}|document\.body\.innerHTML/);
});

test("install page publishes emergency-stop contract", async () => {
  const install = await read("public/note-card-batch-install.html");
  assert.match(install, /v18\.9\.21/);
  assert.match(install, /緊急完全停止版/);
  assert.match(install, /INSIGHTには触りません/);
  assert.match(install, /noteのタブをすべて閉じて開き直す/);
});
