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
  assert.doesNotMatch(page,/script_installation\.php#url=|本人通知 V\d|V3\.3\.7/);
});

test("V3.3.7 preloads restored iframe dock and automatic stable reader",async()=>{
  const v3=await read("public/note-insight-notification-v3.user.js"),runtime=await read("public/note-insight-notification-runtime-v2958.js"),reader=await read("public/note-insight-notification-autoscan-v2970.js"),filterSettings=await read("public/notification-filter-settings.html");
  assert.match(v3,/@version\s+3\.3\.7/);
  const meta=v3.split("// ==/UserScript==")[0];
  for(const part of ["note-insight-notification-runtime-v2958.js?v=3370","note-insight-notification-filter-restore-v2962.js?v=3370","note-insight-notification-autoscan-v2970.js?v=3370","note-insight-notification-filter-safety-v2961.js?v=3370","note-insight-notification-bootstrap-v2966.js?v=3370"])assert.ok(meta.includes(part));
  assert.doesNotMatch(meta,/note-insight-notification-runtime-v327\.js\?v=/);
  assert.match(runtime,/grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  for(const label of ["下から読込","フィルターOFF","フィルター設定","INSIGHT【通知】"])assert.match(runtime,new RegExp(label));
  assert.match(runtime,/frame\.srcdoc=frameHtml\(\)/);assert.match(runtime,/pointer-events:auto/);
  assert.match(reader,/function scheduleAuto/);assert.match(reader,/actor_image_url:img/);assert.match(reader,/historyComplete/);
  assert.match(filterSettings,/https:\/\/note\.com\/\?mumei_filter_return=bell/);assert.doesNotMatch(filterSettings,/note\.com\/notifications/);
  assert.match(v3,/@run-at\s+document-start/);assert.match(v3,/data-mumei-bell-return-cloak/);assert.match(v3,/clickRealBell/);assert.doesNotMatch(v3,/note\.com\/notifications/);
});

test("four-panel iframe dock appears independently and automatic reader runs scans",async()=>{
  const runtime=await read("public/note-insight-notification-runtime-v2958.js"),reader=await read("public/note-insight-notification-autoscan-v2970.js");
  assert.match(runtime,/position:fixed!important/);assert.match(runtime,/bottom:max\(8px,env\(safe-area-inset-bottom,0px\)\)!important/);
  assert.match(runtime,/frame\.srcdoc=frameHtml\(\)/);assert.match(runtime,/showDock\(true\)/);
  assert.match(reader,/function scheduleAuto/);assert.match(reader,/void scan\(\)/);assert.match(reader,/自動読込を開始します/);
});

test("automatic reading is default and no tap-sensitive auto toggle is required",async()=>{
  const runtime=await read("public/note-insight-notification-runtime-v2958.js"),reader=await read("public/note-insight-notification-autoscan-v2970.js");
  assert.doesNotMatch(runtime,/data-a="mode"|自動読み込みOFF/);
  assert.match(reader,/function scheduleAuto/);assert.match(reader,/setTimeout\(\(\)=>\{later\(\);scheduleAuto\(900\)\},150\)/);
});

test("first scan reaches history end and later scans stop at saved overlap",async()=>{
  const reader=await read("public/note-insight-notification-autoscan-v2970.js");
  assert.match(reader,/const overlap=\(\)=>cp\.historyComplete===true&&currentRows\(\)\.some/);
  assert.match(reader,/const reachedEnd=await seekOldest/);
  assert.match(reader,/complete=!stop&&\(reachedEnd\|\|overlap\(\)\)/);
  assert.match(reader,/historyComplete:cp\.historyComplete===true\|\|complete/);
  assert.match(reader,/✓全履歴確認/);assert.match(reader,/✓追加確認/);
});

test("INSIGHT notifications keep one category selector",async()=>{
  const ui=await read("src/insight-notification-ui-v18.ts"),release=await read("src/insight-release.ts");
  assert.match(release,/insight-notification-ui-v18/);assert.match(ui,/mumei-notification-category-button/);assert.match(ui,/通知項目：/);assert.match(ui,/PUBLIC_DUPLICATE_LABELS/);
});