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

test("single notification panel uses a bounded bell grace then the verified notification surface", async () => {
  const panel = await read("public/note-insight-notification-dock-watch-v312.js");
  assert.match(panel, /__mumeiNotificationDock322/);
  assert.match(panel, /function findShell\(\)/);
  assert.match(panel, /function messageContext\(\)/);
  assert.match(panel, /intentUntil/);
  assert.match(panel, /bellGraceUntil/);
  assert.match(panel, /bellHref/);
  assert.match(panel, /function bellGrace\(\)/);
  assert.match(panel, /data-mumei-notice-shell-v3/);
  assert.match(panel, /pushState/);
  assert.match(panel, /replaceState/);
  assert.match(panel, /blockNoticeNavigationWhileReading/);
  assert.match(panel, /notificationRoute\(\)/);
  assert.match(panel, /const open=notificationRoute\(\)\|\|Boolean\(shell\)\|\|bellGrace\(\)/);
  assert.match(panel, /allowed=Boolean\(on\)&&\(notificationRoute\(\)\|\|Boolean\(shell&&visible\(shell\)\)\|\|bellGrace\(\)\)/);
  assert.match(panel, /function topClick\([^)]*\).*bellGraceUntil=Date\.now\(\)\+6000.*showDock\(true\).*startBellReader\(\)/s);
  assert.match(panel, /function routeChanged\(\).*bellGraceUntil=0;bellHref=''.*showDock\(false\)/s);
  assert.doesNotMatch(panel, /bellGraceUntil=Date\.now\(\)\+30000/);
  assert.doesNotMatch(panel, /ensureLauncher|bindDrag|savePos|srcdoc=/);
});

test("parent rescue dock restores bell-first launch but clears it on close or navigation", async () => {
  const parent = await read("public/note-insight-notification-v3.user.js");
  assert.match(parent, /function notificationSurfaceOpen\(\).*notificationRoute\(\)\|\|visibleElement\(shell\)\|\|visibleNoticeRows\(\)/s);
  assert.match(parent, /function intentActive\(\)/);
  assert.match(parent, /rescueIntentHref/);
  assert.match(parent, /function showRescue\(on\).*notificationSurfaceOpen\(\)\|\|intentActive\(\)/s);
  assert.match(parent, /function refreshRescue\(\).*notificationSurfaceOpen\(\)\|\|intentActive\(\)/s);
  assert.match(parent, /function scheduleAutoRead\([^)]*\).*notificationSurfaceOpen\(\)\|\|intentActive\(\)/s);
  assert.match(parent, /function handleNotificationIntent\([^)]*\).*rescueIntentUntil=Date\.now\(\)\+6000.*showRescue\(true\)/s);
  assert.match(parent, /function handleIntentClose\(/);
  assert.match(parent, /rescueIntentUntil=0;rescueIntentHref=''/);
  assert.doesNotMatch(parent, /rescueIntentUntil=Date\.now\(\)\+30000/);
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
  assert.match(panel, /async function startBellReader\(\)/);
  assert.match(panel, /readyToScan/);
});

test("legacy notification runtime remains only a compatibility shim", async () => {
  const runtime = await read("public/note-insight-notification-runtime-v2958.js");
  assert.match(runtime, /Compatibility shim only/);
  assert.doesNotMatch(runtime, /grid-template-columns|showDock|frameHtml/);
});
