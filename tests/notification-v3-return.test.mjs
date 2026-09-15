import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const read=p=>readFile(new URL(`../${p}`,import.meta.url),"utf8");

test("installer keeps participant steps compact and removes setup-page settings clutter",async()=>{
  const page=await read("public/tool-setup.html");
  assert.match(page,/INSIGHT インストール \/ 更新/);
  assert.match(page,/INSIGHTをインストール \/ 更新/);
  assert.match(page,/更新されたか確認する/);
  assert.match(page,/✅ 更新済み/);
  assert.match(page,/⚠ 未更新/);
  assert.match(page,/Tampermonkey/);
  assert.match(page,/note-insight-notification-v3\.user\.js/);
  assert.doesNotMatch(page,/本人通知を実働確認|ダッシュボードを読み込む|初回の連携・読み込み|通知フィルター設定|Import from URL|script_installation\.php#url=|window\.open\(/);
});

test("V3.2.6 one-script bootstrap loads current reader dock and loader without @require",async()=>{
  const v3=await read("public/note-insight-notification-v3.user.js"),loader=await read("public/note-insight-notification-loader-v318.js"),dock=await read("public/note-insight-notification-dock-watch-v312.js"),reader=await read("public/note-insight-notification-reader-v322.js");
  assert.match(v3,/@version\s+3\.2\.6/);
  assert.match(v3,/await run\('note-insight-notification-reader-v322\.js'\)/);
  assert.match(v3,/await run\('note-insight-notification-dock-watch-v312\.js'\)/);
  assert.match(v3,/await run\('note-insight-notification-loader-v318\.js'\)/);
  assert.match(v3,/mumei-v326-component-cache/);
  assert.doesNotMatch(v3.split("// ==/UserScript==")[0],/@require/);
  assert.match(loader,/const VERSION='3\.2\.6'/);assert.match(loader,/runtime-checked-v326/);
  assert.match(dock,/function startReader\(\)/);assert.match(dock,/window\.__mumeiV3Reader322/);assert.match(dock,/api\.scan\(\)/);assert.match(dock,/mumei-v3-read-request/);assert.match(reader,/mumei-v3-read-request/);assert.match(reader,/rediscoverPanel/);
});

test("notification controls use one compact four-column panel and settings opens the previous filter page",async()=>{
  const panel=await read("public/note-insight-notification-dock-watch-v312.js");
  assert.match(panel,/grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(panel,/bottom:max\(10px/);
  for(const label of ["下から読込","フィルターOFF","INSIGHT【通知】"])assert.match(panel,new RegExp(label));
  assert.match(panel,/data-act="settings">設定<\/button>/);
  assert.match(panel,/notification-filter\.html/);
  assert.match(panel,/touch-action:manipulation/);assert.match(panel,/window\.addEventListener\('click',onClick,true\)/);assert.match(panel,/stopImmediatePropagation/);
  assert.doesNotMatch(panel,/pointerdown|pointerup|touch-action:none/);
  assert.match(panel,/function routeChanged\(\)/);assert.match(panel,/pushState/);assert.match(panel,/replaceState/);assert.match(panel,/blockNoticeNavigationWhileReading/);assert.match(panel,/function findShell\(\)/);assert.match(panel,/function routeShell\(\)/);
  assert.doesNotMatch(panel,/ensureLauncher|bindDrag|savePos|srcdoc=/);
});

test("filter settings always return to note notifications",async()=>{
  const page=await read("public/notification-filter.html"),dock=await read("public/note-insight-notification-dock-watch-v312.js");
  assert.match(page,/https:\/\/note\.com\/notifications/);assert.match(page,/mumei_return/);assert.match(page,/mumei_groups_sync/);assert.match(page,/mumei_filter_reset/);
  assert.match(dock,/processFilterCommands/);assert.match(dock,/mumei_filter_export/);assert.match(dock,/mumei_groups_sync/);assert.match(dock,/mumei_filter_reset/);
});

test("INSIGHT notifications collapse category choices into one selector",async()=>{
  const ui=await read("src/insight-notification-ui-v18.ts"),release=await read("src/insight-release.ts");
  assert.match(release,/insight-notification-ui-v18/);
  assert.match(ui,/mumei-notification-category-button/);assert.match(ui,/通知項目：/);assert.match(ui,/PUBLIC_DUPLICATE_LABELS/);
});
