import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const read=p=>readFile(new URL(`../${p}`,import.meta.url),"utf8");

test("installer keeps participant steps compact and raw update route",async()=>{
  const page=await read("public/tool-setup.html");
  assert.match(page,/INSIGHT インストール \/ 更新/);
  assert.match(page,/更新できたか確認する/);
  assert.match(page,/Tampermonkey/);
  assert.match(page,/https:\/\/raw\.githubusercontent\.com\/mumei-s\/note-insight\/main\/public\/note-insight-notification-v3\.user\.js/);
  assert.match(page,/https:\/\/note\.com\/notifications/);
  assert.doesNotMatch(page,/Import from URL|script_installation\.php#url=|window\.open\(|文字列になった/);
});

test("V3.2.9 returns version check before rescue or remote loading",async()=>{
  const v3=await read("public/note-insight-notification-v3.user.js"),loader=await read("public/note-insight-notification-loader-v318.js"),dock=await read("public/note-insight-notification-dock-watch-v312.js"),reader=await read("public/note-insight-notification-reader-v322.js");
  assert.match(v3,/@version\s+3\.2\.9/);
  assert.match(v3,/function directVersionCheck\(\)/);
  assert.match(v3,/runtime-checked-v329/);
  assert.match(v3,/location\.replace\(dest\.href\)/);
  assert.ok(v3.indexOf('async function boot(){if(directVersionCheck())return')<v3.indexOf("await loadPart('note-insight-notification-dock-watch-v312.js')"));
  assert.match(v3,/mumei-v329-component-cache/);
  assert.doesNotMatch(v3.split("// ==/UserScript==")[0],/@require/);
  assert.match(loader,/note-insight-dashboard-integrated-v318\.js/);
  assert.match(dock,/mumei-v3-read-request/);assert.match(reader,/mumei-v3-read-request/);
});

test("parent rescue dock is fixed four-column and independent of note notification DOM",async()=>{
  const v3=await read("public/note-insight-notification-v3.user.js");
  assert.match(v3,/mumei-v3-rescue-dock-v329/);
  assert.match(v3,/position:fixed/);
  assert.match(v3,/bottom:max\(10px/);
  assert.match(v3,/grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  for(const label of ["手動読み込み","フィルターOFF","設定","INSIGHT"])assert.match(v3,new RegExp(label));
  assert.match(v3,/notificationRoute\(\)\|\|Date\.now\(\)<rescueIntentUntil/);
  assert.match(v3,/window\.addEventListener\('click',handleRescueClick,true\)/);
  assert.match(v3,/window\.__mumeiV3ParentDock=true/);
});

test("remote parts load independently with dock before reader",async()=>{
  const v3=await read("public/note-insight-notification-v3.user.js");
  assert.match(v3,/async function loadPart\(name\)/);
  const dock=v3.indexOf("loadPart('note-insight-notification-dock-watch-v312.js')");
  const reader=v3.indexOf("loadPart('note-insight-notification-reader-v322.js')");
  const loader=v3.indexOf("loadPart('note-insight-notification-loader-v318.js')");
  assert.ok(dock>0&&reader>dock&&loader>reader);
  assert.match(v3,/mumei-notification-v329-component:/);
});

test("filter settings always return to note notifications",async()=>{
  const page=await read("public/notification-filter.html"),dock=await read("public/note-insight-notification-dock-watch-v312.js");
  assert.match(page,/https:\/\/note\.com\/notifications/);assert.match(page,/mumei_return/);assert.match(page,/mumei_groups_sync/);assert.match(page,/mumei_filter_reset/);
  assert.match(dock,/processFilterCommands/);assert.match(dock,/mumei_groups_sync/);assert.match(dock,/mumei_filter_reset/);
});

test("INSIGHT notifications keep one category selector",async()=>{
  const ui=await read("src/insight-notification-ui-v18.ts"),release=await read("src/insight-release.ts");
  assert.match(release,/insight-notification-ui-v18/);
  assert.match(ui,/mumei-notification-category-button/);assert.match(ui,/通知項目：/);assert.match(ui,/PUBLIC_DUPLICATE_LABELS/);
});
