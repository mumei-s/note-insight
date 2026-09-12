import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (p) => readFile(new URL(`../${p}`, import.meta.url), "utf8");

test("notification reader never creates a global fallback dock", async () => {
  const reader = await read("public/note-insight-notification-reader-v2963.js");
  assert.doesNotMatch(reader, /fallbackHtml/);
  assert.doesNotMatch(reader, /ensureFallback/);
  assert.doesNotMatch(reader, /mumei-notice-reader-v2963/);
  assert.match(reader, /function notificationRoute\(\)/);
  assert.match(reader, /if\(!notificationRoute\(\)\)return null/);
  const routeGuard = reader.indexOf("if(!notificationRoute())return null");
  const globalRows = reader.indexOf("const all=rows(document)");
  assert.ok(routeGuard >= 0 && globalRows > routeGuard, "document-wide notification scan must be route-gated");
});

test("notification safety layer contains no fallback-dock sentinel workaround", async () => {
  const safety = await read("public/note-insight-notification-filter-safety-v2961.js");
  assert.doesNotMatch(safety, /disableLegacyFallback/);
  assert.doesNotMatch(safety, /FALLBACK_SENTINEL/);
  assert.doesNotMatch(safety, /mumei-notice-reader-v2963/);
  assert.match(safety, /distinctNotificationDescendants/);
  assert.match(safety, /data-mumei-filter-container-restored/);
});
