import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (p) => readFile(new URL(`../${p}`, import.meta.url), "utf8");

test("direct reader has no global fallback dock or legacy frame dependency", async () => {
  const reader = await read("public/note-insight-notification-reader-v323.js");
  assert.doesNotMatch(reader, /fallbackHtml|ensureFallback|mumei-notice-reader-v2963|contentDocument/);
  assert.match(reader, /data-mumei-notice-shell-v3/);
  assert.match(reader, /mumei-v3-read-request/);
  assert.match(reader, /mumei-v3-reader-status/);
  assert.match(reader, /verified-shell-bottom-to-top/);
});

test("single notification panel requires a verified notification surface or notifications route", async () => {
  const panel = await read("public/note-insight-notification-dock-watch-v312.js");
  assert.match(panel, /__mumeiNotificationDock322/);
  assert.match(panel, /function findShell\(\)/);
  assert.match(panel, /function messageContext\(\)/);
  assert.match(panel, /intentUntil/);
  assert.match(panel, /data-mumei-notice-shell-v3/);
  assert.match(panel, /pushState/);
  assert.match(panel, /replaceState/);
  assert.match(panel, /blockNoticeNavigationWhileReading/);
  assert.match(panel, /notificationRoute\(\)/);
  assert.match(panel, /const open=notificationRoute\(\)\|\|Boolean\(shell\)/);
  assert.match(panel, /allowed=Boolean\(on\)&&\(notificationRoute\(\)\|\|Boolean\(shell&&visible\(shell\)\)\)/);
  assert.doesNotMatch(panel, /const open=.*intentUntil/);
  assert.match(panel, /function topClick\([^)]*\).*showDock\(false\)/s);
  assert.doesNotMatch(panel, /function topClick\([^)]*\).*showDock\(true\)/s);
  assert.doesNotMatch(panel, /ensureLauncher|bindDrag|savePos|srcdoc=/);
});

test("parent rescue dock also refuses creator-page intent-only display and read", async () => {
  const parent = await read("public/note-insight-notification-v3.user.js");
  assert.match(parent, /function notificationSurfaceOpen\(\).*notificationRoute\(\)\|\|visibleElement\(shell\)/s);
  assert.match(parent, /function showRescue\(on\).*allowed=Boolean\(on\)&&notificationSurfaceOpen\(\)/s);
  assert.match(parent, /function refreshRescue\(\).*showRescue\(notificationSurfaceOpen\(\)\)/s);
  assert.match(parent, /function scheduleAutoRead\([^)]*\).*if\(notificationSurfaceOpen\(\)\)/s);
  assert.doesNotMatch(parent, /notificationSurfaceOpen\(\)\|\|Date\.now\(\)<rescueIntentUntil/);
});

test("settings and read operations use one native click path without pointer interception", async () => {
  const panel = await read("public/note-insight-notification-dock-watch-v312.js");
  assert.match(panel,/touch-action:manipulation/);
  assert.match(panel,/window\.addEventListener\('click',onClick,true\)/);
  assert.match(panel,/stopImmediatePropagation/);
  assert.doesNotMatch(panel,/pointerdown|pointerup|touch-action:none/);
  assert.match(panel, /function openSettings\(\)/);assert.match(panel,/mumei-v3-read-request|ensureReader/);
  assert.doesNotMatch(panel, /backendButton|ensureBackend|contentDocument/);
});

test("dock can self-heal the reader after parent loader failure", async () => {
  const panel = await read("public/note-insight-notification-dock-watch-v312.js");
  assert.match(panel, /READER_URL/);
  assert.match(panel, /async function ensureReader\(\)/);
  assert.match(panel, /readerRetryAt/);
  assert.match(panel, /READER_API_MISSING/);
  assert.match(panel, /healParentLoadError/);
});

test("legacy notification runtime remains only a compatibility shim", async () => {
  const runtime = await read("public/note-insight-notification-runtime-v2958.js");
  assert.match(runtime, /Compatibility shim only/);
  assert.doesNotMatch(runtime, /grid-template-columns|showDock|frameHtml/);
});
