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

test("single notification panel requires notification intent or route and excludes messages", async () => {
  const panel = await read("public/note-insight-notification-dock-watch-v312.js");
  assert.match(panel, /__mumeiNotificationSingleDock320/);
  assert.match(panel, /function findShell\(\)/);
  assert.match(panel, /function messageContext\(\)/);
  assert.match(panel, /intentUntil/);
  assert.match(panel, /data-mumei-notice-shell-v3/);
  assert.match(panel, /pushState/);
  assert.match(panel, /replaceState/);
  assert.match(panel, /blockNoticeNavigationWhileReading/);
  assert.match(panel, /notificationRoute\(\)/);
  assert.doesNotMatch(panel, /ensureLauncher|bindDrag|savePos/);
});

test("legacy notification runtime is only a compatibility shim", async () => {
  const runtime = await read("public/note-insight-notification-runtime-v2958.js");
  assert.match(runtime, /Compatibility shim only/);
  assert.match(runtime, /clean panel controller/);
  assert.doesNotMatch(runtime, /frameHtml|showDock|grid-template-columns/);
});

test("notification safety layer contains no fallback-dock sentinel workaround", async () => {
  const safety = await read("public/note-insight-notification-filter-safety-v2961.js");
  assert.doesNotMatch(safety, /disableLegacyFallback/);
  assert.doesNotMatch(safety, /FALLBACK_SENTINEL/);
  assert.doesNotMatch(safety, /mumei-notice-reader-v2963/);
  assert.match(safety, /distinctNotificationDescendants/);
  assert.match(safety, /data-mumei-filter-container-restored/);
});
