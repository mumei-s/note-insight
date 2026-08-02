import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

test("GitHub Pages artifact is anonymous and installable", async () => {
  const index = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
  const manifest = JSON.parse(
    await readFile(new URL("../dist/manifest.webmanifest", import.meta.url), "utf8"),
  );
  const assetNames = await readdir(new URL("../dist/assets/", import.meta.url));
  const javascript = (
    await Promise.all(
      assetNames
        .filter((name) => name.endsWith(".js"))
        .map((name) => readFile(new URL(`../dist/assets/${name}`, import.meta.url), "utf8")),
    )
  ).join("\n");

  assert.match(index, /無名 S note/);
  assert.equal(manifest.start_url, "/note-insight/");
  assert.equal(manifest.display, "standalone");
  assert.doesNotMatch(
    index + javascript,
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
  );
});

test("private values are not checked into the public frontend", async () => {
  const apiSource = await readFile(new URL("../src/api.ts", import.meta.url), "utf8");
  assert.doesNotMatch(apiSource, /INSIGHT_SESSION_SECRET/);
  assert.doesNotMatch(apiSource, /INSIGHT_OWNER_ACCESS_HASH/);
  assert.match(apiSource, /X-Insight-Entry/);
  assert.match(apiSource, /X-Insight-Member/);
});
