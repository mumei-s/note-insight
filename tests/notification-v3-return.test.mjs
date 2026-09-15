import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const read=p=>readFile(new URL(`../${p}`,import.meta.url),"utf8");

test("setup center uses one direct userscript update and keeps participant steps simple",async()=>{
  const page=await read("public/tool-setup.html");
  assert.match(page,/通知＋ダッシュボードをインストール／更新/);
  assert.match(page,/本人通知を実働確認／連携/);
  assert.match(page,/Tampermonkey自体を入れ直す必要はありません/);
  assert.match(page,/note-insight-notification-v3\.user\.js/);
  assert.doesNotMatch(page,/Import from URL|script_installation\.php#url=|window\.open\(/);
});

test("V3.2.2 loads the direct dock reader and dashboard loader only",async()=>{
  const v3=await read("public/note-insight-notification-v3.user.js"),loader=await read("public/note-insight-notification-loader-v318.js"),dock=await read("public/note-insight-notification-dock-watch-v312.js"),reader=await read("public/note-insight-notification-reader-v322.js");
  assert.match(v3,/@version\s+3\.2\.2/);
  assert.match(v3,/note-insight-notification-dock-watch-v312\.js\?v=322/);
  assert.match(v3,/note-insight-notification-reader-v322\.js\?v=322/);
  assert.match(v3,/note-insight-notification-loader-v318\.js\?v=322/);
  assert.doesNotMatch(v3,/notification-fixed-dock|notification-launcher|notification-autoscan/);
  assert.match(loader,/const VERSION='3\.2\.2'/);assert.match(loader,/runtime-checked-v322/);
  assert.match(dock,/mumei-v3-read-request/);assert.match(reader,/mumei-v3-read-request/);
});

test("notification controls use one compact four-column panel and hard-stop touch passthrough",async()=>{
  const panel=await read("public/note-insight-notification-dock-watch-v312.js");
  assert.match(panel,/grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(panel,/bottom:max\(10px/);
  for(const label of ["下から読込","フィルターOFF","フィルター設定","INSIGHT【通知】"])assert.match(panel,new RegExp(label));
  assert.match(panel,/touch-action:none/);assert.match(panel,/pointerdown/);assert.match(panel,/pointerup/);assert.match(panel,/stopImmediatePropagation/);
  assert.match(panel,/function routeChanged\(\)/);assert.match(panel,/pushState/);assert.match(panel,/replaceState/);assert.match(panel,/blockNoticeNavigationWhileReading/);assert.match(panel,/function findShell\(\)/);
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
