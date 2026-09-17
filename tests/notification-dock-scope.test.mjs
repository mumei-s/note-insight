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
  assert.match(reader, /incremental-top-to-checkpoint/);
  assert.match(reader, /ここまで保存済み/);
  assert.doesNotMatch(reader, /fullFallback|loadAbsoluteBottom/);
});

test("legacy dock still keeps bounded bell grace and visible verified shell", async () => {
  const panel = await read("public/note-insight-notification-dock-watch-v312.js");
  assert.match(panel, /__mumeiNotificationDock322/);
  assert.match(panel, /function findShell\(\)/);
  assert.match(panel, /function messageContext\(\)/);
  assert.match(panel, /bellGraceUntil/);
  assert.match(panel, /bellHref/);
  assert.match(panel, /function bellGrace\(\)/);
  assert.match(panel, /data-mumei-notice-shell-v3/);
  assert.match(panel, /pushState/);
  assert.match(panel, /replaceState/);
  assert.match(panel, /blockNoticeNavigationWhileReading/);
  assert.match(panel, /notificationRoute\(\)/);
  assert.match(panel, /const open=notificationRoute\(\)\|\|Boolean\(shell&&visible\(shell\)\)\|\|bellGrace\(\)/);
  assert.match(panel, /allowed=Boolean\(on\)&&\(notificationRoute\(\)\|\|Boolean\(shell&&visible\(shell\)\)\|\|bellGrace\(\)\)/);
  assert.match(panel, /function topClick\([^)]*\).*bellGraceUntil=Date\.now\(\)\+7000.*showDock\(true\).*startBellReader\(\)/s);
  assert.match(panel, /function routeChanged\(\).*bellGraceUntil=0;bellHref='';intentUntil=0.*showDock\(false\)/s);
  assert.doesNotMatch(panel, /bellGraceUntil=Date\.now\(\)\+30000/);
  assert.doesNotMatch(panel, /ensureLauncher|bindDrag|savePos|srcdoc=/);
});

test("V3.2.24 inline runtime owns the dock and legacy dock exits behind its sentinel", async () => {
  const parent = await read("public/note-insight-notification-v3.user.js");
  const runtime = await read("public/note-insight-notification-runtime-v324.js");
  const dock = await read("public/note-insight-notification-dock-watch-v312.js");
  assert.match(parent, /note-insight-notification-runtime-v324\.js\?v=3224/);
  assert.match(runtime, /window\.__mumeiNotificationDock322=true/);
  assert.match(runtime, /ROOT='mumei-v324-dock'/);
  assert.match(runtime, /function findSurface\(\)/);
  assert.match(runtime, /showRoot\(Boolean\(shell\)\)/);
  assert.match(runtime, /通知フィルター登録/);
  assert.match(dock, /if\(window\.__mumeiNotificationDock322\)return/);
});

test("filter registration and read operations use one native click path without pointer interception", async () => {
  const panel = await read("public/note-insight-notification-dock-watch-v312.js");
  assert.match(panel,/touch-action:manipulation/);
  assert.match(panel,/window\.addEventListener\('click',onClick,true\)/);
  assert.match(panel,/stopImmediatePropagation/);
  assert.doesNotMatch(panel,/pointerdown|pointerup|touch-action:none/);
  assert.match(panel, /function openSettings\(\)/);
  assert.match(panel, /フィルター登録/);
  assert.match(panel,/async function ensureReader\(force=false\)/);
  assert.doesNotMatch(panel, /backendButton|ensureBackend|contentDocument/);
});

test("dock uses the current reader immediately and self-heals by one forced reload after a real reader error", async () => {
  const panel = await read("public/note-insight-notification-dock-watch-v312.js");
  assert.match(panel, /READER_URL/);
  assert.match(panel, /async function ensureReader\(force=false\)/);
  assert.match(panel, /readerRetryAt/);
  assert.match(panel, /READER_API_MISSING/);
  assert.match(panel, /const existing=readerApi\(\),api=existing\|\|await ensureReader\(forceReader&&!existing\)/);
  assert.match(panel, /async function repairAfterReaderError\(message\)/);
  assert.match(panel, /readerReloadedOnce/);
  assert.match(panel, /ensureReader\(true\)/);
  assert.match(panel, /async function startBellReader\(\)/);
});

test("filter back target and INSIGHT target are explicit and never inherit a creator page", async () => {
  const panel = await read("public/note-insight-notification-dock-watch-v312.js");
  assert.match(panel, /function pinBackToNotifications\(\).*history\.replaceState\(history\.state,'','\/notifications'\)/s);
  assert.match(panel, /FILTER_BASE='https:\/\/mumei-s\.github\.io\/note-insight\/notification-filter\.html'/);
  assert.match(panel, /mumei_return','https:\/\/note\.com\/notifications'/);
  assert.match(panel, /INSIGHT='https:\/\/mumei-s\.github\.io\/note-insight\/\?insightMode=notifications#dashboard'/);
  assert.match(panel, /notificationAccount/);
  assert.doesNotMatch(panel, /const INSIGHT=.*notification-entry\.html/);
});

test("ingest token bridge is origin-locked and never posts a token to a wildcard target", async () => {
  const bridge = await read("public/notification-token-bridge.html");
  assert.match(bridge, /TARGET='https:\/\/note\.com'/);
  assert.match(bridge, /document\.referrer/);
  assert.match(bridge, /ref\.origin!==TARGET/);
  assert.match(bridge, /insight-notification-import-token/);
  assert.match(bridge, /action:'issue'/);
  assert.match(bridge, /noteId!==expected/);
  assert.match(bridge, /parent\.postMessage\(\{type:TYPE,\.\.\.data\},TARGET\)/);
  assert.doesNotMatch(bridge, /postMessage\([^\n]+,\s*['"]\*['"]\)/);
});

test("legacy notification runtime remains only a compatibility shim", async () => {
  const runtime = await read("public/note-insight-notification-runtime-v2958.js");
  assert.match(runtime, /Compatibility shim only/);
  assert.doesNotMatch(runtime, /grid-template-columns|showDock|frameHtml/);
});