import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const read=p=>readFile(new URL(`../${p}`,import.meta.url),"utf8");

test("installer keeps participant steps compact with same-page confirmation",async()=>{
  const page=await read("public/tool-setup.html");
  assert.match(page,/INSIGHT インストール \/ 更新/);
  assert.match(page,/この画面で更新結果を確認/);
  assert.match(page,/Tampermonkey/);
  assert.match(page,/https:\/\/mumei-s\.github\.io\/note-insight\/note-insight-notification-v3\.user\.js/);
  assert.doesNotMatch(page,/script_installation\.php#url=/);
  assert.match(page,/function installUrl\(\)\{return scriptUrl\(\)\}/);
  assert.match(page,/mumei-notification-v3-loader/);
  assert.doesNotMatch(page,/Import from URL|window\.open\(|https:\/\/note\.com\/notifications|mumei_insight_version_check/);
});

test("V3.2.23 preloads reader and dock and returns version checks safely",async()=>{
  const v3=await read("public/note-insight-notification-v3.user.js"),loader=await read("public/note-insight-notification-loader-v318.js"),dock=await read("public/note-insight-notification-dock-watch-v312.js"),reader=await read("public/note-insight-notification-reader-v323.js");
  assert.match(v3,/@version\s+3\.2\.23/);
  assert.match(v3,/function directVersionCheck\(\)/);
  assert.match(v3,/runtime-checked-v3223/);
  assert.match(v3,/location\.replace\(dest\.href\)/);
  assert.ok(v3.indexOf('async function boot(){if(directVersionCheck())return')>0);
  assert.match(v3,/mumei-v329-component-cache/);
  const meta=v3.split("// ==/UserScript==")[0];
  assert.match(meta,/@require\s+https:\/\/raw\.githubusercontent\.com\/mumei-s\/note-insight\/main\/public\/note-insight-notification-reader-v323\.js\?v=3223/);
  assert.match(meta,/@require\s+https:\/\/raw\.githubusercontent\.com\/mumei-s\/note-insight\/main\/public\/note-insight-notification-dock-watch-v312\.js\?v=3223/);
  assert.match(loader,/note-insight-dashboard-integrated-v318\.js/);
  assert.match(dock,/ensureReader/);assert.match(reader,/mumei-v3-read-request/);
});

test("parent rescue dock remains safe fallback with bounded bell-start grace",async()=>{
  const v3=await read("public/note-insight-notification-v3.user.js");
  assert.match(v3,/mumei-v3-rescue-dock-v329/);
  assert.match(v3,/position:fixed/);
  assert.match(v3,/function placeRescue\(/);
  assert.match(v3,/Math\.max\(10,bottomObstruction\(root\)\+8\)/);
  assert.match(v3,/visualViewport/);
  assert.match(v3,/grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  for(const label of ["手動読み込み","フィルターOFF","フィルター登録","INSIGHT"])assert.match(v3,new RegExp(label));
  assert.match(v3,/function notificationSurfaceOpen\(\)/);
  assert.match(v3,/function intentActive\(\)/);
  assert.match(v3,/function showRescue\(on\).*notificationSurfaceOpen\(\)\|\|intentActive\(\)/s);
  assert.match(v3,/function refreshRescue\(\).*notificationSurfaceOpen\(\)\|\|intentActive\(\)/s);
  assert.match(v3,/rescueIntentUntil=Date\.now\(\)\+6000/);
  assert.match(v3,/function handleIntentClose\(/);
  assert.match(v3,/rescueIntentUntil=0;rescueIntentHref=''/);
  assert.match(v3,/function pinNoteReturn\(\)/);
  assert.match(v3,/history\.replaceState\(history\.state,'','\/notifications'\)/);
  assert.match(v3,/note-insight\/\?insightMode=notifications#dashboard/);
  assert.doesNotMatch(v3,/notification-entry\.html\?from=note/);
  assert.match(v3,/window\.addEventListener\('click',handleRescueClick,true\)/);
  assert.match(v3,/window\.__mumeiV3ParentDock=true/);
});

test("runtime keeps dynamic loader only as fallback after required dock/reader",async()=>{
  const v3=await read("public/note-insight-notification-v3.user.js");
  assert.match(v3,/async function loadPart\(name\)/);
  assert.match(v3,/if\(!window\.__mumeiNotificationDock322\)await loadPart\('note-insight-notification-dock-watch-v312\.js'\)/);
  assert.match(v3,/const ready=readerApi\(\)/);
  assert.match(v3,/loadPart\('note-insight-notification-reader-v323\.js'\)/);
  assert.match(v3,/loadPart\('note-insight-notification-loader-v318\.js'\)/);
  assert.match(v3,/mumei-notification-v329-component:/);
});

test("filter settings always return to note notifications",async()=>{
  const page=await read("public/notification-filter.html"),dock=await read("public/note-insight-notification-dock-watch-v312.js");
  assert.match(page,/const returnUrl='https:\/\/note\.com\/notifications'/);assert.doesNotMatch(page,/safeNoteReturn/);assert.match(page,/mumei_groups_sync/);assert.match(page,/mumei_filter_reset/);
  assert.match(dock,/processFilterCommands/);assert.match(dock,/mumei_groups_sync/);assert.match(dock,/mumei_filter_reset/);
});

test("INSIGHT notifications keep one category selector",async()=>{
  const ui=await read("src/insight-notification-ui-v18.ts"),release=await read("src/insight-release.ts");
  assert.match(release,/insight-notification-ui-v18/);
  assert.match(ui,/mumei-notification-category-button/);assert.match(ui,/通知項目：/);assert.match(ui,/PUBLIC_DUPLICATE_LABELS/);
});