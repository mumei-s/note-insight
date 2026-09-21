import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const read=p=>readFile(new URL(`../${p}`,import.meta.url),"utf8");

test("installer entry redirects to isolated compact browser page",async()=>{
  const redirect=await read("public/tool-setup.html"),page=await read("public/notification-browser-install.html");
  assert.match(redirect,/notification-browser-install\.html/);
  assert.doesNotMatch(redirect,/Tampermonkey|Userscripts|ブラウザ別インストール/);
  assert.match(page,/mumei-installer-boundary/);
  assert.match(page,/INSIGHT インストール \/ 更新/);
  assert.match(page,/insight-release\.json/);
  assert.match(page,/Tampermonkey/);
  assert.match(page,/Userscripts/);
  assert.match(page,/Yahoo!ブラウザー/);
  assert.match(page,/data-browser="ios-safari"/);
  assert.match(page,/data-browser="android-edge"/);
  assert.match(page,/https:\/\/raw\.githubusercontent\.com\/mumei-s\/note-insight\/main\/public\/note-insight-notification-v3\.user\.js/);
  assert.doesNotMatch(page,/script_installation\.php#url=|本人通知 V\d|V3\.5\.2/);
});

test("V3.5.2 preloads split runtime modules",async()=>{
  const v3=await read("public/note-insight-notification-v3.user.js"),network=await read("public/note-insight-notification-network-v3300.js"),reader=await read("public/note-insight-notification-reader-v4.js"),controls=await read("public/note-insight-notification-controls-v1.js"),ret=await read("public/note-insight-notification-return-v1.js"),filterSettings=await read("public/notification-filter-settings.html");
  assert.match(v3,/@version\s+3\.5\.2/);
  const meta=v3.split("// ==/UserScript==")[0];
  for(const p of ["note-insight-notification-network-v3300.js?v=3520","note-insight-notification-reader-v4.js?v=3520","note-insight-notification-controls-v1.js?v=131","note-insight-notification-filter-v4.js?v=400","note-insight-notification-return-v1.js?v=120","note-insight-notification-status-bridge-v1.js?v=110","note-insight-notification-settings-bridge-v1.js?v=100","note-insight-notification-account-pair-v1.js?v=100"])assert.ok(meta.includes(p),p);
  assert.doesNotMatch(meta,/notification-autoscan-v2970\.js\?v=|notification-bootstrap-v2966\.js\?v=|runtime-v2939-filter\.js\?v=|note-insight-dm-reader-v1\.js\?v=/);
  assert.match(network,/async function syncHistory/);assert.match(network,/syncDirectFullAscending/);assert.match(network,/direction:'bottom-up'/);assert.match(network,/needsDom:false/);assert.match(reader,/function directPanel/);assert.match(reader,/function scheduleAuto/);assert.match(reader,/net\.syncCurrent/);assert.match(reader,/actor_image_url:img/);
  assert.match(controls,/INSIGHT【通知】/);assert.match(controls,/フィルター ON|フィルター OFF/);
  assert.match(filterSettings,/https:\/\/note\.com\/\?mumei_filter_return=bell/);assert.doesNotMatch(filterSettings,/note\.com\/notifications/);
  assert.match(ret,/data-mumei-bell-return-cloak/);assert.match(ret,/function clickBell/);assert.match(ret,/location\.pathname==='\/notifications'/);
  assert.doesNotMatch(v3,/data-mumei-bell-return-cloak|function clickBell/);
});

test("notification Reader stays automatic while Controls are a separate module",async()=>{
  const v3=await read("public/note-insight-notification-v3.user.js"),reader=await read("public/note-insight-notification-reader-v4.js"),controls=await read("public/note-insight-notification-controls-v1.js");
  assert.doesNotMatch(v3,/note-insight-notification-runtime-v2958\.js\?v=/);
  assert.match(reader,/function scheduleAuto/);assert.match(reader,/void scan\(\)/);
  assert.doesNotMatch(reader,/mumei-inline-notification-controls-v1|INSIGHT【通知】|フィルター ON/);
  assert.match(controls,/mumei-inline-notification-controls-v1/);assert.match(controls,/document\.body\.appendChild\(bar\)/);assert.match(controls,/data-action="read"/);assert.match(controls,/position:fixed/);
  assert.match(controls,/INSIGHT【通知】/);assert.match(controls,/フィルター ON|フィルター OFF/);
});

test("automatic reading is owned only by Reader",async()=>{
  const reader=await read("public/note-insight-notification-reader-v4.js"),controls=await read("public/note-insight-notification-controls-v1.js");
  assert.match(reader,/setTimeout\(\(\)=>scheduleAuto\(600\),120\)/);
  assert.match(reader,/scheduleAuto\(300\)/);assert.match(reader,/if\(!p\)\{autoPanel=null;return\}/);
  assert.doesNotMatch(controls,/void scan\(\)|sendBatch|historyComplete/);
});

test("split Reader reaches history end and later stops at saved overlap",async()=>{
  const reader=await read("public/note-insight-notification-reader-v4.js");
  assert.match(reader,/const overlap=\(\)=>cp\.historyComplete===true&&currentRows\(\)\.some/);
  assert.match(reader,/const reachedEnd=await seekOldest/);assert.match(reader,/complete=!stop&&\(reachedEnd\|\|overlap\(\)\)/);
  assert.match(reader,/historyComplete:cp\.historyComplete===true\|\|complete/);
  assert.match(reader,/✓全履歴確認/);assert.match(reader,/✓追加確認/);
});

test("INSIGHT notifications keep one category selector",async()=>{
  const ui=await read("src/insight-notification-ui-v18.ts"),release=await read("src/insight-release.ts");
  assert.match(release,/insight-notification-ui-v18/);assert.match(ui,/mumei-notification-category-button/);assert.match(ui,/通知項目：/);assert.match(ui,/PUBLIC_DUPLICATE_LABELS/);
});

test("V3.5.2 supports checkpoint stop without losing partial progress",async()=>{
  const network=await read("public/note-insight-notification-network-v3300.js"),reader=await read("public/note-insight-notification-reader-v4.js"),controls=await read("public/note-insight-notification-controls-v1.js");
  assert.match(network,/stopRequested/);assert.match(network,/function stop\(\)/);assert.match(network,/停止・途中保存/);assert.match(network,/resume:/);
  assert.match(reader,/__mumeiNotificationNetwork3300\?\.stop\?\.\(\)/);assert.match(reader,/現在ページを保存してから停止/);assert.match(reader,/r\?\.partial\?'途中保存'/);
  assert.match(controls,/停止 \$\{read\}/);assert.match(controls,/VERSION='1\.3\.1'/);
});
